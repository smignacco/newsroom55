import type { MarketProvider, Quote, SymbolConfig } from "@/lib/markets/provider";
import { unavailableQuote } from "@/lib/markets/provider";
import {
  resolveSymbolConfig,
  usableMarketPrice,
  yahooChartSymbol,
} from "@/lib/markets/resolve";

const API_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 256_000;
const SYMBOL = /^(\^[A-Z0-9.]+|[A-Z][A-Z0-9.-]{0,15})$/;

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        currency?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
        regularMarketChangePercent?: number;
        fulldayChange?: number;
        fulldayChangePercent?: number;
      };
    }>;
    error?: { code?: string; description?: string };
  };
};

function unavailable(symbol: SymbolConfig): Quote {
  return unavailableQuote(symbol, "yahoo");
}

export class YahooDelayedProvider implements MarketProvider {
  id = "yahoo";
  name = "Yahoo Finance · différé";
  configured = true;
  delayed = true;

  async fetchQuotes(symbols: SymbolConfig[]): Promise<Quote[]> {
    return Promise.all(
      symbols.map(async (symbol) => {
        const listed = resolveSymbolConfig(symbol);
        const yahooSymbol = yahooChartSymbol(listed);
        if (!yahooSymbol || listed.cboeEligible || !SYMBOL.test(yahooSymbol)) {
          return unavailable(symbol);
        }
        const url = new URL(`${API_BASE}/${encodeURIComponent(yahooSymbol)}`);
        url.searchParams.set("interval", "1d");
        url.searchParams.set("range", "1d");
        url.searchParams.set("includePrePost", "false");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          const response = await fetch(url, {
            cache: "no-store",
            signal: controller.signal,
            headers: {
              accept: "application/json",
              "user-agent": "NEWSROOM55/1.0 (board display; delayed quotes)",
            },
          });
          if (!response.ok) return unavailable(symbol);
          const declaredSize = Number(response.headers.get("content-length") || 0);
          if (declaredSize > MAX_RESPONSE_BYTES) return unavailable(symbol);
          const body = await response.text();
          if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) return unavailable(symbol);
          const payload = JSON.parse(body) as YahooChart;
          const meta = payload.chart?.result?.[0]?.meta;
          const price = meta?.regularMarketPrice;
          if (
            payload.chart?.error ||
            !meta ||
            meta.symbol?.toUpperCase() !== yahooSymbol ||
            !usableMarketPrice(price)
          ) {
            return unavailable(symbol);
          }
          const changePct =
            typeof meta.regularMarketChangePercent === "number"
              ? meta.regularMarketChangePercent
              : typeof meta.fulldayChangePercent === "number"
                ? meta.fulldayChangePercent
                : null;
          return {
            symbolId: symbol.id,
            symbol: symbol.symbol,
            displayName: symbol.displayName,
            price,
            changeAbs: typeof meta.fulldayChange === "number" ? meta.fulldayChange : null,
            changePct,
            currency: listed.currencyHint || symbol.currency,
            asOf:
              typeof meta.regularMarketTime === "number"
                ? new Date(meta.regularMarketTime * 1000).toISOString()
                : new Date().toISOString(),
            status: "DELAYED",
            provider: this.id,
          };
        } catch {
          return unavailable(symbol);
        } finally {
          clearTimeout(timeout);
        }
      }),
    );
  }
}
