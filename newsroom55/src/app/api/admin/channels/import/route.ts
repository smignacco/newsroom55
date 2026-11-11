import { NextRequest, NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { requireAdmin } from "@/lib/security/auth";
import {
  refreshIptvPlaylistDirectory,
  setIptvPlaylistSubscription,
  syncIptvPlaylist,
} from "@/lib/video/playlist-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    await refreshIptvPlaylistDirectory();
    setIptvPlaylistSubscription({ key: "ca.m3u", subscribed: true });
    const result = await syncIptvPlaylist("ca.m3u");
    return NextResponse.json({
      ok: true,
      source: "iptv-org:ca.m3u",
      ...result,
      note: "Catalog entries are unverified and remain disabled until selected by an administrator.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog import failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
