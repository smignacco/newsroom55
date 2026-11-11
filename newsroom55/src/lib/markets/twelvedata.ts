import type { MarketProvider, Quote, SymbolConfig } from "@/lib/markets/provider";
import { unconfiguredQuotes } from "@/lib/markets/provider";
import { twelveDataMaxSymbols } from "@/lib/config";

export class TwelveDataProvider implements MarketProvider {
  id = "twelvedata";
  name = "Twelve Data";
  delayed = true;
  configured: boolean;
  private key: string | null;

  constructor(key: string | null | undefined) {
    this.key = key?.trim() || null;
    this.configured = Boolean(this.key);
  }

  async fetchQuotes(symbols: SymbolConfig[]): Promise<Quote[]> {
    if (!this.key) return unconfiguredQuotes(symbols, this.id);
    const limit = twelveDataMaxSymbols();
    const selected = symbols.slice(0, limit);
    const overflow = symbols.slice(limit);
    const out: Quote[] = [];
    for (const symbol of selected) {
      try {
        const url = new URL("https://api.twelvedata.com/quote");
        url.searchParams.set("symbol", symbol.providerSymbol);
        if (symbol.exchange) url.searchParams.set("exchange", symbol.exchange);
        url.searchParams.set("apikey", this.key);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          out.push(empty(symbol, this.id));
          continue;
        }
        const data = (await res.json()) as {
          close?: string;
          change?: string;
          percent_change?: string;
          datetime?: string;
          status?: string;
        };
        const price = data.close ? Number(data.close) : NaN;
        if (!Number.isFinite(price)) {
          out.push(empty(symbol, this.id));
          continue;
        }
        out.push({
          symbolId: symbol.id,
          symbol: symbol.symbol,
          displayName: symbol.displayName,
          price,
          changeAbs: data.change ? Number(data.change) : null,
          changePct: data.percent_change ? Number(data.percent_change) : null,
          currency: symbol.currency,
          asOf: data.datetime ? new Date(data.datetime).toISOString() : new Date().toISOString(),
          status: "DELAYED",
          provider: this.id,
        });
      } catch {
        out.push(empty(symbol, this.id));
      }
    }
    return [...out, ...unconfiguredQuotes(overflow, this.id)];
  }
}

function empty(symbol: SymbolConfig, provider: string): Quote {
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
    provider,
  };
}
