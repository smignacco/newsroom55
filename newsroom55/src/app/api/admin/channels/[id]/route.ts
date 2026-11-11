import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { getDb } from "@/lib/database";
import { requireAdmin } from "@/lib/security/auth";
import { validateHttpUrl } from "@/lib/security/urls";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  adapter: z.enum(["none", "hls", "rtmp", "rtsp", "webrtc"]).optional(),
  stream_ref: z.string().max(500).nullable().optional(),
  enabled: z.boolean().optional(),
  is_default: z.boolean().optional(),
  autoplay: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  if (parsed.data.stream_ref) {
    const url = validateHttpUrl(parsed.data.stream_ref);
    if (!url.ok) return NextResponse.json({ error: url.error }, { status: 400 });
  }
  const channelId = Number(id);
  if (!Number.isInteger(channelId) || channelId < 1) {
    return NextResponse.json({ error: "Invalid channel id" }, { status: 400 });
  }
  const database = getDb();
  const existing = database
    .prepare("SELECT adapter, stream_ref, status FROM tv_channels WHERE id = ?")
    .get(channelId) as
    | { adapter: string; stream_ref: string | null; status: string }
    | undefined;
  if (!existing) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  const archived = ["catalog-removed", "catalog-unsubscribed"].includes(existing.status);
  const effectiveAdapter = parsed.data.adapter ?? existing.adapter;
  const effectiveStream =
    parsed.data.stream_ref === undefined ? existing.stream_ref : parsed.data.stream_ref;
  if (
    parsed.data.enabled === true &&
    archived &&
    (effectiveAdapter !== "hls" || !effectiveStream)
  ) {
    return NextResponse.json(
      { error: "This archived station no longer has a playable HLS source" },
      { status: 400 },
    );
  }
  database.transaction(() => {
    if (parsed.data.is_default) {
      database.prepare("UPDATE tv_channels SET is_default = 0").run();
    }
    database
      .prepare(
      `UPDATE tv_channels SET
        name = COALESCE(?, name),
        adapter = COALESCE(?, adapter),
        stream_ref = COALESCE(?, stream_ref),
        enabled = COALESCE(?, enabled),
        is_default = COALESCE(?, is_default),
        autoplay = COALESCE(?, autoplay),
        status = CASE
          WHEN ? = 1 AND status IN ('catalog-removed', 'catalog-unsubscribed')
          THEN 'catalog-pinned'
          ELSE status
        END
       WHERE id = ?`,
      )
      .run(
        parsed.data.name ?? null,
        parsed.data.adapter ?? null,
        parsed.data.stream_ref === undefined ? null : parsed.data.stream_ref,
        parsed.data.enabled === undefined ? null : parsed.data.enabled ? 1 : 0,
        parsed.data.enabled === false
          ? 0
          : parsed.data.is_default === undefined
            ? null
            : parsed.data.is_default
              ? 1
              : 0,
        parsed.data.autoplay === undefined ? null : parsed.data.autoplay ? 1 : 0,
        parsed.data.enabled === true ? 1 : 0,
        channelId,
      );
    if (parsed.data.is_default) {
      database.prepare("UPDATE tv_channels SET enabled = 1 WHERE id = ?").run(channelId);
    }
  })();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  getDb().prepare("DELETE FROM tv_channels WHERE id = ?").run(Number(id));
  return NextResponse.json({ ok: true });
}
