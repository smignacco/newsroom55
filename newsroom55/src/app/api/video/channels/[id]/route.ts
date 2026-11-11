import { NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { getDb } from "@/lib/database";
import { signPlaybackUrl } from "@/lib/video/hls-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChannelRow = {
  id: number;
  name: string;
  adapter: string;
  stream_ref: string | null;
  stream_referrer: string | null;
  catalog_source: string | null;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await boot();
  const { id } = await context.params;
  const channelId = Number(id);
  if (!Number.isInteger(channelId) || channelId < 1) {
    return NextResponse.json({ error: "Invalid channel id" }, { status: 400 });
  }
  const channel = getDb()
    .prepare(
      `SELECT id, name, adapter, stream_ref, stream_referrer, catalog_source
       FROM tv_channels WHERE id = ? AND enabled = 1`,
    )
    .get(channelId) as ChannelRow | undefined;
  if (!channel) return NextResponse.json({ error: "Channel is not enabled" }, { status: 404 });
  if (
    channel.catalog_source !== "iptv-org-ca" &&
    !channel.catalog_source?.startsWith("iptv-org:")
  ) {
    return NextResponse.json({ error: "Playback is limited to the verified catalogue integration" }, { status: 409 });
  }
  if (channel.adapter !== "hls" || !channel.stream_ref) {
    return NextResponse.json({ error: "This channel does not use a supported HLS stream" }, { status: 409 });
  }

  const token = signPlaybackUrl(channel.id, channel.stream_ref, channel.stream_referrer);
  return NextResponse.json(
    {
      channel: { id: channel.id, name: channel.name },
      playbackUrl: `/api/video/proxy?token=${encodeURIComponent(token)}`,
      mode: "hls",
      compatibility: "unverified",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
