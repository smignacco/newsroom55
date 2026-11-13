import { NextRequest, NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { searchMarketInstruments } from "@/lib/markets/search";
import { requireAdmin } from "@/lib/security/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const requestedProvider = req.nextUrl.searchParams.get("provider") ?? "cboe";
  if (query.length < 2 || query.length > 80) {
    return NextResponse.json(
      { error: "Enter at least two characters" },
      { status: 400 },
    );
  }
  if (
    requestedProvider !== "cboe" &&
    requestedProvider !== "twelvedata" &&
    requestedProvider !== "finnhub"
  ) {
    return NextResponse.json({ error: "Invalid market provider" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await searchMarketInstruments(
        query,
        requestedProvider as "cboe" | "twelvedata" | "finnhub",
      ),
      {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
