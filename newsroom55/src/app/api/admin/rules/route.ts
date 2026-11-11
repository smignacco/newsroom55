import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { getDb } from "@/lib/database";
import { requireAdmin } from "@/lib/security/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  pattern: z.string().min(2).max(80),
  field: z.enum(["title", "summary"]),
  level: z.enum(["IMPORTANT", "BREAKING"]),
});

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  try {
    new RegExp(parsed.data.pattern, "i");
  } catch {
    return NextResponse.json({ error: "Invalid regular expression" }, { status: 400 });
  }
  const r = getDb()
    .prepare("INSERT INTO breaking_rules (pattern, field, level, enabled) VALUES (?, ?, ?, 1)")
    .run(parsed.data.pattern, parsed.data.field, parsed.data.level);
  return NextResponse.json({ id: r.lastInsertRowid });
}

export async function PATCH(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const body = z.object({ id: z.number(), enabled: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  getDb().prepare("UPDATE breaking_rules SET enabled = ? WHERE id = ?").run(body.data.enabled ? 1 : 0, body.data.id);
  return NextResponse.json({ ok: true });
}
