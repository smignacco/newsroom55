import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { requireAdmin } from "@/lib/security/auth";
import {
  listIptvPlaylists,
  refreshIptvPlaylistDirectory,
  setIptvPlaylistSubscription,
  syncIptvPlaylist,
} from "@/lib/video/playlist-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  let directoryWarning: string | null = null;
  try {
    await refreshIptvPlaylistDirectory(req.nextUrl.searchParams.get("refresh") === "1");
  } catch (error) {
    directoryWarning =
      error instanceof Error ? error.message : "Repository directory refresh failed";
  }
  const playlists = listIptvPlaylists();
  if (playlists.length === 0 && directoryWarning) {
    return NextResponse.json({ error: directoryWarning }, { status: 502 });
  }
  return NextResponse.json({ playlists, directoryWarning });
}

const schema = z.object({
  key: z.string().regex(/^[a-z0-9_-]+\.m3u$/),
  subscribed: z.boolean().optional(),
  syncIntervalMin: z.union([z.literal(0), z.literal(15), z.literal(60), z.literal(360), z.literal(1440)]).optional(),
});

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  try {
    await refreshIptvPlaylistDirectory();
    setIptvPlaylistSubscription(parsed.data);
    const result = parsed.data.subscribed ? await syncIptvPlaylist(parsed.data.key) : null;
    return NextResponse.json({ ok: true, result, playlists: listIptvPlaylists() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Playlist update failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
