import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { getDb } from "@/lib/database";
import { requireAdmin } from "@/lib/security/auth";
import { getMarketProvider } from "@/lib/markets/service";
import {
  marketRefreshIntervalMs,
  twelveDataMaxSymbols,
} from "@/lib/config";
import {
  providerSymbolFor,
  recommendQuoteProvider,
  resolveListedInstrument,
  type QuoteVendor,
} from "@/lib/markets/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const rows = getDb().prepare("SELECT * FROM market_symbols ORDER BY sort_order, id").all();
  const provider = getMarketProvider();
  return NextResponse.json({
    symbols: rows,
    provider: {
      id: provider.id,
      name: provider.name,
      configured: provider.configured,
      globalSearch:
        ["hybrid", "twelvedata"].includes(provider.id) &&
        Boolean(process.env.TWELVE_DATA_API_KEY),
      refreshMinutes: Math.round(marketRefreshIntervalMs() / 60_000),
      twelveRefreshMinutes: Math.round(
        marketRefreshIntervalMs("twelvedata") / 60_000,
      ),
      maxSymbols: twelveDataMaxSymbols(),
      twelveConfigured:
        Boolean(process.env.TWELVE_DATA_API_KEY) &&
        ["hybrid", "twelvedata"].includes(provider.id),
      finnhubConfigured:
        Boolean(process.env.FINNHUB_API_KEY) &&
        ["hybrid", "finnhub"].includes(provider.id),
    },
  });
}

const schema = z.object({
  symbol: z.string().min(1).max(24),
  display_name: z.string().min(1).max(80),
  kind: z.enum(["equity", "fund", "index"]),
  currency: z.string().regex(/^[A-Z]{3}$/),
  provider_symbol: z.string().min(1).max(32),
  quote_provider: z.enum(["cboe", "twelvedata", "finnhub"]).optional(),
  exchange: z.string().max(40).nullable().optional(),
  sort_order: z.number().int().min(0).max(99).optional(),
});

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const listed = resolveListedInstrument(
    parsed.data.symbol,
    parsed.data.exchange,
    parsed.data.provider_symbol,
    parsed.data.currency,
    parsed.data.kind,
  );
  const twelveActive = getDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM market_symbols
       WHERE enabled = 1 AND quote_provider = 'twelvedata'`,
    )
    .get() as { count: number };
  const quoteProvider: QuoteVendor =
    parsed.data.quote_provider ??
    recommendQuoteProvider(listed, {
      twelve:
        Boolean(process.env.TWELVE_DATA_API_KEY) &&
        twelveActive.count < twelveDataMaxSymbols(),
      finnhub: Boolean(process.env.FINNHUB_API_KEY),
    });
  if (quoteProvider === "cboe" && !listed.cboeEligible) {
    return NextResponse.json(
      { error: "Cboe supports US equities and funds only. Choose Twelve Data or Finnhub for this listing." },
      { status: 400 },
    );
  }
  const providerSymbol = providerSymbolFor(quoteProvider, listed);
  const existing = getDb()
    .prepare(
      `SELECT id FROM market_symbols
       WHERE provider_symbol = ? AND COALESCE(exchange, '') = COALESCE(?, '')`,
    )
    .get(providerSymbol, listed.exchange);
  if (existing) {
    return NextResponse.json(
      { error: "This instrument is already in the ticker list" },
      { status: 409 },
    );
  }
  if (quoteProvider === "twelvedata") {
    if (twelveActive.count >= twelveDataMaxSymbols()) {
      return NextResponse.json(
        {
          error:
            "Twelve Data free-mode limit reached. Hide or remove an instrument before adding another.",
        },
        { status: 409 },
      );
    }
  }
  const r = getDb()
    .prepare(
      `INSERT INTO market_symbols (
        symbol, display_name, kind, currency, provider_symbol, exchange,
        quote_provider, sort_order, enabled
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    )
    .run(
      listed.displaySymbol,
      parsed.data.display_name,
      parsed.data.kind,
      listed.currencyHint || parsed.data.currency,
      providerSymbol,
      listed.exchange,
      quoteProvider,
      parsed.data.sort_order ?? 50,
    );
  return NextResponse.json({ id: r.lastInsertRowid });
}
