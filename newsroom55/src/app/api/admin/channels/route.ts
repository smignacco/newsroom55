import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { getDb } from "@/lib/database";
import { requireAdmin } from "@/lib/security/auth";
import { validateHttpUrl } from "@/lib/security/urls";
import { ADAPTERS } from "@/lib/video/player";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const rows = getDb()
    .prepare(
      `SELECT tv_channels.*, iptv_playlists.name AS playlist_name
       FROM tv_channels
       LEFT JOIN iptv_playlists
         ON tv_channels.catalog_source = 'iptv-org:' || iptv_playlists.playlist_key
       ORDER BY tv_channels.enabled DESC, tv_channels.is_default DESC,
         tv_channels.name COLLATE NOCASE`,
    )
    .all();
  return NextResponse.json({ channels: rows, adapters: ADAPTERS });
}

const schema = z.object({
  name: z.string().min(1).max(80),
  adapter: z.enum(["none", "hls", "rtmp", "rtsp", "webrtc"]),
  stream_ref: z.string().max(500).optional().nullable(),
  is_default: z.boolean().optional(),
  autoplay: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  if (parsed.data.stream_ref) {
    const url = validateHttpUrl(parsed.data.stream_ref);
    if (!url.ok) return NextResponse.json({ error: url.error }, { status: 400 });
  }
  const database = getDb();
  const id = database.transaction(() => {
    if (parsed.data.is_default) database.prepare("UPDATE tv_channels SET is_default = 0").run();
    const result = database
      .prepare(
        `INSERT INTO tv_channels (name, adapter, stream_ref, enabled, is_default, autoplay, status)
         VALUES (?, ?, ?, 1, ?, ?, 'waiting')`,
      )
      .run(
        parsed.data.name,
        parsed.data.adapter,
        parsed.data.stream_ref || null,
        parsed.data.is_default ? 1 : 0,
        parsed.data.autoplay ? 1 : 0,
      );
    return result.lastInsertRowid;
  })();
  return NextResponse.json({ id });
}
