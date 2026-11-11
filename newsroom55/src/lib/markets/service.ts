import { getDb, getSetting, setSetting } from "@/lib/database";
import {
  marketRefreshIntervalMs,
  marketsProviderName,
} from "@/lib/config";
import type { MarketProvider, Quote, SymbolConfig } from "@/lib/markets/provider";
import { FinnhubProvider } from "@/lib/markets/finnhub";
import { TwelveDataProvider } from "@/lib/markets/twelvedata";
import { BankOfCanadaProvider } from "@/lib/markets/bank-of-canada";
import { CboeProvider } from "@/lib/markets/cboe";
import { tsxSession, usEquitySession } from "@/lib/markets/session";

export function getMarketProvider(): MarketProvider {
  const name = marketsProviderName();
  if (name === "hybrid") {
    return {
      id: "hybrid",
      name: "Cboe + Twelve Data",
      configured: true,
      delayed: true,
      fetchQuotes: async () => [],
    };
  }
  if (name === "finnhub") return new FinnhubProvider(process.env.FINNHUB_API_KEY);
  if (name === "twelvedata") return new TwelveDataProvider(process.env.TWELVE_DATA_API_KEY);
  if (name === "bankofcanada") return new BankOfCanadaProvider();
  return new CboeProvider();
}

export function listSymbols(providerId = getMarketProvider().id): SymbolConfig[] {
  const rows = getDb()
    .prepare(
      `SELECT id, symbol, display_name as displayName, kind, currency,
        provider_symbol as providerSymbol, quote_provider as quoteProvider, exchange
       FROM market_symbols
       WHERE enabled = 1
         AND ((? = 'bankofcanada' AND kind = 'fx-public')
           OR (? = 'hybrid' AND kind != 'fx-public')
           OR (? = 'cboe' AND quote_provider = 'cboe' AND kind IN ('equity', 'fund'))
           OR (? = 'twelvedata' AND quote_provider = 'twelvedata' AND kind != 'fx-public')
           OR (? = 'finnhub' AND kind != 'fx-public'))
       ORDER BY sort_order ASC, id ASC`,
    )
    .all(providerId, providerId, providerId, providerId, providerId) as SymbolConfig[];
  return rows;
}

export async function refreshQuotes(): Promise<Quote[]> {
  const provider = getMarketProvider();
  const isTwelveDue = () => {
    const lastFetch = Date.parse(getSetting("markets_last_fetch_twelvedata", ""));
    return (
      !Number.isFinite(lastFetch) ||
      Date.now() - lastFetch >= marketRefreshIntervalMs("twelvedata")
    );
  };
  if (provider.id === "twelvedata" && !isTwelveDue()) return readQuotes(provider.id);

  let quotes: Quote[];
  if (provider.id === "hybrid") {
    const symbols = listSymbols("hybrid");
    const cboeSymbols = symbols.filter((symbol) => symbol.quoteProvider === "cboe");
    const twelveSymbols = symbols.filter((symbol) => symbol.quoteProvider === "twelvedata");
    const cboe = new CboeProvider();
    const twelve = new TwelveDataProvider(process.env.TWELVE_DATA_API_KEY);
    const [cboeQuotes, twelveQuotes] = await Promise.all([
      cboe.fetchQuotes(cboeSymbols),
      isTwelveDue() ? twelve.fetchQuotes(twelveSymbols) : Promise.resolve([]),
    ]);
    quotes = [...cboeQuotes, ...twelveQuotes];
    if (twelveQuotes.length > 0) {
      setSetting("markets_last_fetch_twelvedata", new Date().toISOString());
    }
  } else {
    quotes = await provider.fetchQuotes(listSymbols(provider.id));
  }
  if (provider.id === "twelvedata" && quotes.length > 0) {
    setSetting("markets_last_fetch_twelvedata", new Date().toISOString());
  }
  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO market_quotes (symbol_id, price, change_abs, change_pct, currency, as_of, status, provider)
     VALUES (@symbolId, @price, @changeAbs, @changePct, @currency, @asOf, @status, @provider)
     ON CONFLICT(symbol_id) DO UPDATE SET
       price = excluded.price,
       change_abs = excluded.change_abs,
       change_pct = excluded.change_pct,
       currency = excluded.currency,
       as_of = excluded.as_of,
       status = excluded.status,
       provider = excluded.provider`,
  );
  const tx = db.transaction((items: Quote[]) => {
    for (const q of items) {
      upsert.run({
        symbolId: q.symbolId,
        price: q.price,
        changeAbs: q.changeAbs,
        changePct: q.changePct,
        currency: q.currency,
        asOf: q.asOf,
        status: q.status,
        provider: q.provider,
      });
    }
  });
  tx(quotes);
  return readQuotes(provider.id);
}

export function readQuotes(providerId = getMarketProvider().id): Quote[] {
  const rows = getDb()
    .prepare(
      `SELECT s.id as symbolId, s.symbol, s.display_name as displayName, q.price, q.change_abs as changeAbs,
              q.change_pct as changePct, COALESCE(q.currency, s.currency) as currency, q.as_of as asOf,
              COALESCE(q.status, 'UNAVAILABLE') as status, COALESCE(q.provider, 'none') as provider
       FROM market_symbols s
       LEFT JOIN market_quotes q ON q.symbol_id = s.id
       WHERE s.enabled = 1
         AND ((? = 'bankofcanada' AND s.kind = 'fx-public')
           OR (? = 'hybrid' AND s.kind != 'fx-public')
           OR (? = 'cboe' AND s.quote_provider = 'cboe' AND s.kind IN ('equity', 'fund'))
           OR (? = 'twelvedata' AND s.quote_provider = 'twelvedata' AND s.kind != 'fx-public')
           OR (? = 'finnhub' AND s.kind != 'fx-public'))
       ORDER BY s.sort_order ASC, s.id ASC`,
    )
    .all(providerId, providerId, providerId, providerId, providerId) as Quote[];
  return rows;
}

export function marketStatusPayload() {
  const provider = getMarketProvider();
  const quotes = readQuotes(provider.id);
  const anyLive = quotes.some((q) => q.status === "LIVE");
  const anyDelayed = quotes.some((q) => q.status === "DELAYED");
  let board: "UNAVAILABLE" | "DELAYED" | "LIVE" | "UNCONFIGURED" = "UNCONFIGURED";
  if (!provider.configured) board = "UNCONFIGURED";
  else if (anyLive) board = "LIVE";
  else if (anyDelayed) board = "DELAYED";
  else board = "UNAVAILABLE";
  return {
    provider: provider.id,
    providerName: provider.name,
    configured: provider.configured,
    board,
    usSession: usEquitySession(),
    tsxSession: tsxSession(),
    quotes,
  };
}
