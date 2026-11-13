import type { MarketProvider, Quote, SymbolConfig } from "@/lib/markets/provider";
import { unavailableQuote, unconfiguredQuotes } from "@/lib/markets/provider";
import { twelveDataMaxSymbols } from "@/lib/config";
import { parsePriceField, parseSignedNumber, resolveSymbolConfig } from "@/lib/markets/resolve";

function twelveQuotaError(status: number, data: { status?: string; code?: number; message?: string }) {
  if (status === 429 || data.code === 429) return true;
  const message = `${data.message || ""} ${data.code || ""}`.toLowerCase();
  return /credit|quota|rate limit|limit reached/.test(message);
}

export class TwelveDataProvider implements MarketProvider {
  id = "twelvedata";
  name = "Twelve Data";
  delayed = true;
  configured: boolean;
  quotaExhausted = false;
  private key: string | null;

  constructor(key: string | null | undefined) {
    this.key = key?.trim() || null;
    this.configured = Boolean(this.key);
  }

  async fetchQuotes(symbols: SymbolConfig[]): Promise<Quote[]> {
    this.quotaExhausted = false;
    if (!this.key) return unconfiguredQuotes(symbols, this.id);
    const limit = twelveDataMaxSymbols();
    const selected = symbols.slice(0, limit);
    const overflow = symbols.slice(limit);
    const out: Quote[] = [];
    for (const [index, symbol] of selected.entries()) {
      try {
        const listed = resolveSymbolConfig(symbol);
        const url = new URL("https://api.twelvedata.com/quote");
        url.searchParams.set("symbol", listed.twelveSymbol);
        if (listed.twelveExchange) url.searchParams.set("exchange", listed.twelveExchange);
        if (listed.micCode) url.searchParams.set("mic_code", listed.micCode);
        url.searchParams.set("apikey", this.key);
        const res = await fetch(url, { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as {
          close?: string | number;
          change?: string | number;
          percent_change?: string | number;
          datetime?: string;
          status?: string;
          code?: number;
          message?: string;
        };
        if (!res.ok || twelveQuotaError(res.status, data)) {
          if (res.status === 429 || twelveQuotaError(res.status, data)) {
            this.quotaExhausted = true;
            return [
              ...out,
              ...unconfiguredQuotes(selected.slice(index), this.id),
              ...unconfiguredQuotes(overflow, this.id),
            ];
          }
          out.push(unavailableQuote(symbol, this.id));
          continue;
        }
        const price = parsePriceField(data.close);
        if (data.status === "error" || price == null) {
          out.push(unavailableQuote(symbol, this.id));
          continue;
        }
        out.push({
          symbolId: symbol.id,
          symbol: symbol.symbol,
          displayName: symbol.displayName,
          price,
          changeAbs: parseSignedNumber(data.change),
          changePct: parseSignedNumber(data.percent_change),
          currency: symbol.currency,
          asOf: data.datetime ? new Date(data.datetime).toISOString() : new Date().toISOString(),
          status: "DELAYED",
          provider: this.id,
        });
      } catch {
        out.push(unavailableQuote(symbol, this.id));
      }
    }
    return [...out, ...unconfiguredQuotes(overflow, this.id)];
  }
}
