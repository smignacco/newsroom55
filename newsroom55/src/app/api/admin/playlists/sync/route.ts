import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { requireAdmin } from "@/lib/security/auth";
import { listIptvPlaylists, syncIptvPlaylist } from "@/lib/video/playlist-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  key: z.string().regex(/^[a-z0-9_-]+\.m3u$/).optional(),
});

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const keys = parsed.data.key
    ? [parsed.data.key]
    : listIptvPlaylists()
        .filter((playlist) => Boolean(playlist.subscribed))
        .map((playlist) => playlist.playlist_key);
  const results = [];
  const errors = [];
  for (const key of keys) {
    try {
      results.push(await syncIptvPlaylist(key));
    } catch (error) {
      errors.push({
        key,
        error: error instanceof Error ? error.message : "Playlist sync failed",
      });
    }
  }
  return NextResponse.json(
    {
      ok: errors.length === 0,
      results,
      errors,
      ...(errors.length ? { error: `${errors.length} playlist sync(s) failed` } : {}),
    },
    { status: errors.length === 0 ? 200 : 502 },
  );
}
