import { NextRequest, NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { requireAdmin } from "@/lib/security/auth";
import { aggregateNews } from "@/lib/news/aggregator";
import { refreshQuotes, getMarketProvider } from "@/lib/markets/service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const news = await aggregateNews(true);
  const provider = getMarketProvider();
  const markets = provider.configured ? await refreshQuotes() : [];
  return NextResponse.json({ news, markets: markets.length, provider: provider.id });
}
