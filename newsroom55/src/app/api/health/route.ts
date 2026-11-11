import { NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { sourceHealth } from "@/lib/news/aggregator";
import { getMarketProvider } from "@/lib/markets/service";
import { getDb, getSetting } from "@/lib/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  await boot();
  const news = sourceHealth();
  const markets = getMarketProvider();
  const playable = getDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM tv_channels
       WHERE enabled = 1 AND adapter = 'hls' AND stream_ref IS NOT NULL
         AND (catalog_source = 'iptv-org-ca' OR catalog_source LIKE 'iptv-org:%')`,
    )
    .get() as { count: number };
  return NextResponse.json({
    ok: true,
    tz: getSetting("timezone", "America/Montreal"),
    uptime: process.uptime(),
    news,
    markets: {
      provider: markets.id,
      configured: markets.configured,
    },
    video: playable.count > 0 ? "hls-ready" : "waiting",
    videoChannels: playable.count,
  });
}
