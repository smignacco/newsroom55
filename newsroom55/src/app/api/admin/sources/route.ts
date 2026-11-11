import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { getDb } from "@/lib/database";
import { requireAdmin } from "@/lib/security/auth";
import { validateHttpUrl } from "@/lib/security/urls";
import { CATEGORIES } from "@/lib/news/classify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const rows = getDb()
    .prepare(
      `SELECT id, name, url, enabled, default_category, fetch_interval_sec, last_fetch_at, last_status, last_error
       FROM news_sources ORDER BY name`,
    )
    .all();
  return NextResponse.json({ sources: rows });
}

const createSchema = z.object({
  name: z.string().min(2).max(120),
  url: z.string().url().max(500),
  default_category: z.string().optional(),
  enabled: z.boolean().optional(),
  fetch_interval_sec: z.number().int().min(60).max(3600).optional(),
});

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const url = validateHttpUrl(parsed.data.url);
  if (!url.ok) return NextResponse.json({ error: url.error }, { status: 400 });
  if (parsed.data.default_category && !CATEGORIES.includes(parsed.data.default_category as never)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }
  try {
    const result = getDb()
      .prepare(
        `INSERT INTO news_sources (name, url, enabled, default_category, fetch_interval_sec)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        parsed.data.name,
        url.url.toString(),
        parsed.data.enabled === false ? 0 : 1,
        parsed.data.default_category ?? "International",
        parsed.data.fetch_interval_sec ?? 180,
      );
    return NextResponse.json({ id: result.lastInsertRowid });
  } catch {
    return NextResponse.json({ error: "Could not save source (duplicate URL?)" }, { status: 409 });
  }
}
