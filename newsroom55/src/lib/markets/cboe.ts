import type { MarketProvider, Quote, SymbolConfig } from "@/lib/markets/provider";

const API_BASE = "https://cdn.cboe.com/api/global/delayed_quotes/quotes";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 256_000;
const SYMBOL = /^[A-Z][A-Z0-9.-]{0,11}$/;

type CboeResponse = {
  timestamp?: string;
  data?: {
    symbol?: string;
    current_price?: number;
    price_change?: number;
    price_change_percent?: number;
  };
};

function unavailable(symbol: SymbolConfig): Quote {
  return {
    symbolId: symbol.id,
    symbol: symbol.symbol,
    displayName: symbol.displayName,
    price: null,
    changeAbs: null,
    changePct: null,
    currency: symbol.currency,
    asOf: null,
    status: "UNAVAILABLE",
    provider: "cboe",
  };
}

function timestamp(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export class CboeProvider implements MarketProvider {
  id = "cboe";
  name = "Cboe · delayed 15 min";
  configured = true;
  delayed = true;

  async fetchQuotes(symbols: SymbolConfig[]): Promise<Quote[]> {
    return Promise.all(
      symbols.map(async (symbol) => {
        const providerSymbol = symbol.providerSymbol.trim().toUpperCase();
        if (!SYMBOL.test(providerSymbol)) return unavailable(symbol);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          const response = await fetch(`${API_BASE}/${encodeURIComponent(providerSymbol)}.json`, {
            cache: "no-store",
            signal: controller.signal,
            headers: { accept: "application/json" },
          });
          if (!response.ok) return unavailable(symbol);
          const declaredSize = Number(response.headers.get("content-length") || 0);
          if (declaredSize > MAX_RESPONSE_BYTES) return unavailable(symbol);
          const body = await response.text();
          if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) return unavailable(symbol);
          const payload = JSON.parse(body) as CboeResponse;
          const data = payload.data;
          if (
            !data ||
            data.symbol?.toUpperCase() !== providerSymbol ||
            typeof data.current_price !== "number" ||
            !Number.isFinite(data.current_price)
          ) {
            return unavailable(symbol);
          }
          return {
            symbolId: symbol.id,
            symbol: symbol.symbol,
            displayName: symbol.displayName,
            price: data.current_price,
            changeAbs: typeof data.price_change === "number" ? data.price_change : null,
            changePct: typeof data.price_change_percent === "number" ? data.price_change_percent : null,
            currency: symbol.currency,
            asOf: timestamp(payload.timestamp),
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
