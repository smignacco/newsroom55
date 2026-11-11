import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { getDb } from "@/lib/database";
import { requireAdmin } from "@/lib/security/auth";
import { validateHttpUrl } from "@/lib/security/urls";

export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  url: z.string().url().max(500).optional(),
  enabled: z.boolean().optional(),
  default_category: z.string().optional(),
  fetch_interval_sec: z.number().int().min(60).max(3600).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const row = getDb().prepare("SELECT id FROM news_sources WHERE id = ?").get(Number(id));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = parsed.data;
  if (data.url) {
    const url = validateHttpUrl(data.url);
    if (!url.ok) return NextResponse.json({ error: url.error }, { status: 400 });
    data.url = url.url.toString();
  }
  getDb()
    .prepare(
      `UPDATE news_sources SET
        name = COALESCE(?, name),
        url = COALESCE(?, url),
        enabled = COALESCE(?, enabled),
        default_category = COALESCE(?, default_category),
        fetch_interval_sec = COALESCE(?, fetch_interval_sec)
       WHERE id = ?`,
    )
    .run(
      data.name ?? null,
      data.url ?? null,
      data.enabled === undefined ? null : data.enabled ? 1 : 0,
      data.default_category ?? null,
      data.fetch_interval_sec ?? null,
      Number(id),
    );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  getDb().prepare("DELETE FROM news_items WHERE source_id = ?").run(Number(id));
  getDb().prepare("DELETE FROM news_sources WHERE id = ?").run(Number(id));
  return NextResponse.json({ ok: true });
}
