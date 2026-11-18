import { getSetting, setSetting } from "@/lib/database";
import { marketRefreshIntervalMs } from "@/lib/config";
import { CboeProvider } from "@/lib/markets/cboe";
import { FinnhubProvider } from "@/lib/markets/finnhub";
import { TwelveDataProvider } from "@/lib/markets/twelvedata";
import type { Quote, SymbolConfig } from "@/lib/markets/provider";
import { quoteHasPrice, usableMarketPrice } from "@/lib/markets/resolve";
import { unavailableQuote } from "@/lib/markets/provider";
import { fetchJson } from "@/lib/giverny/http";
import { nySessionDate, yahooHistorySymbol } from "@/lib/giverny/tickers";
import { upsertPrices } from "@/lib/giverny/store";
import { usablePrice } from "@/lib/giverny/engine";

type YahooHistory = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      meta?: { currency?: string; symbol?: string };
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
        adjclose?: Array<{ adjclose?: Array<number | null> }>;
      };
    }>;
    error?: { description?: string };
  };
};

function quotaBlocked(key: string) {
  const until = Date.parse(getSetting(key, ""));
  return Number.isFinite(until) && until > Date.now();
}

function markQuota(key: string, durationMs: number) {
  setSetting(key, new Date(Date.now() + durationMs).toISOString());
}

export function holdingSymbolConfig(ticker: string, id: number): SymbolConfig {
  const isIndex = ticker === "SPX" || ticker === "^GSPC" || ticker === "GSPC";
  return {
    id,
    symbol: ticker,
    displayName: ticker,
    kind: isIndex ? "index" : "equity",
    currency: "USD",
    providerSymbol: isIndex ? "^GSPC" : ticker,
    quoteProvider: isIndex ? "twelvedata" : "cboe",
    exchange: isIndex ? null : "NASDAQ",
  };
}

async function mapPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (item === undefined) return;
        await worker(item);
      }
    }),
  );
}

export async function refreshYahooHistory(tickers: string[]): Promise<{ count: number; error: string | null }> {
  let count = 0;
  let error: string | null = null;
  await mapPool(tickers, 4, async (ticker) => {
    const yahoo = yahooHistorySymbol(ticker);
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}`);
    url.searchParams.set("interval", "1d");
    url.searchParams.set("range", "2y");
    url.searchParams.set("includePrePost", "false");
    const payload = await fetchJson<YahooHistory>(url.toString(), {
      headers: {
        accept: "application/json",
        "user-agent": "NEWSROOM55/1.0 (board display; delayed historical quotes)",
      },
      maxBytes: 1_500_000,
      attempts: 2,
    });
    const result = payload?.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const adj = result?.indicators?.adjclose?.[0]?.adjclose ?? [];
    if (!timestamps.length) {
      error = error ?? `Yahoo n’a pas renvoyé d’historique pour ${ticker}.`;
      return;
    }
    const rows = timestamps.flatMap((stamp, index) => {
      const close = closes[index] ?? null;
      const adjClose = adj[index] ?? close;
      if (!usablePrice(close) && !usablePrice(adjClose)) return [];
      return [
        {
          symbol: ticker,
          sessionDate: nySessionDate(new Date(stamp * 1000)),
          close: usablePrice(close) ? close : null,
          adjClose: usablePrice(adjClose) ? adjClose : null,
          provider: "yahoo",
          official: true,
          asOf: new Date(stamp * 1000).toISOString(),
        },
      ];
    });
    upsertPrices(rows);
    count += rows.length;
  });
  return { count, error };
}

export async function refreshLiveQuotes(tickers: string[]): Promise<Quote[]> {
  const symbols = tickers.map((ticker, index) => holdingSymbolConfig(ticker, index + 1));
  const usable = new Map<number, Quote>();
  const twelve = new TwelveDataProvider(process.env.TWELVE_DATA_API_KEY);
  const finnhub = new FinnhubProvider(process.env.FINNHUB_API_KEY);
  const cboe = new CboeProvider();

  if (twelve.configured && !quotaBlocked("markets_twelve_quota_until")) {
    const quotes = await twelve.fetchQuotes(symbols.slice(0, 6));
    if (twelve.quotaExhausted) markQuota("markets_twelve_quota_until", marketRefreshIntervalMs("twelvedata"));
    for (const quote of quotes) if (quoteHasPrice(quote)) usable.set(quote.symbolId, quote);
  }

  const remaining = symbols.filter((symbol) => !usable.has(symbol.id));
  if (finnhub.configured && remaining.length > 0 && !quotaBlocked("markets_finnhub_quota_until")) {
    const quotes = await finnhub.fetchQuotes(remaining);
    if (finnhub.quotaExhausted) markQuota("markets_finnhub_quota_until", 5 * 60_000);
    for (const quote of quotes) if (quoteHasPrice(quote)) usable.set(quote.symbolId, quote);
  }

  const afterFinnhub = symbols.filter((symbol) => !usable.has(symbol.id) && symbol.kind !== "index");
  if (afterFinnhub.length > 0) {
    for (const quote of await cboe.fetchQuotes(afterFinnhub)) {
      if (quoteHasPrice(quote)) usable.set(quote.symbolId, quote);
    }
  }

  const stillMissing = symbols.filter((symbol) => !usable.has(symbol.id));
  if (stillMissing.length > 0) {
    const rows = await Promise.all(
      stillMissing.map(async (symbol) => {
        const yahooSymbol = yahooHistorySymbol(symbol.symbol);
        const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`);
        url.searchParams.set("interval", "1d");
        url.searchParams.set("range", "5d");
        url.searchParams.set("includePrePost", "false");
        const payload = await fetchJson<YahooHistory>(url.toString(), {
          headers: {
            accept: "application/json",
            "user-agent": "NEWSROOM55/1.0 (board display; delayed quotes)",
          },
          attempts: 2,
        });
        const meta = payload?.chart?.result?.[0]?.meta as
          | { regularMarketPrice?: number; regularMarketTime?: number; currency?: string }
          | undefined;
        const price = meta?.regularMarketPrice;
        if (!usableMarketPrice(price)) return unavailableQuote(symbol, "yahoo");
        return {
          symbolId: symbol.id,
          symbol: symbol.symbol,
          displayName: symbol.displayName,
          price,
          changeAbs: null,
          changePct: null,
          currency: "USD",
          asOf:
            typeof meta?.regularMarketTime === "number"
              ? new Date(meta.regularMarketTime * 1000).toISOString()
              : new Date().toISOString(),
          status: "DELAYED" as const,
          provider: "yahoo",
        };
      }),
    );
    for (const quote of rows) if (quoteHasPrice(quote)) usable.set(quote.symbolId, quote);
  }

  return symbols.map((symbol) => usable.get(symbol.id) ?? unavailableQuote(symbol, "hybrid"));
}
