import type { MarketProvider, Quote, SymbolConfig } from "@/lib/markets/provider";
import { unavailableQuote, unconfiguredQuotes } from "@/lib/markets/provider";
import { resolveSymbolConfig, usableMarketPrice } from "@/lib/markets/resolve";

function finnhubQuotaError(status: number, error: string | undefined) {
  if (status === 429) return true;
  return /limit|quota|too many/i.test(error || "");
}

export class FinnhubProvider implements MarketProvider {
  id = "finnhub";
  name = "Finnhub";
  delayed = true;
  configured: boolean;
  quotaExhausted = false;
  private token: string | null;

  constructor(token: string | null | undefined) {
    this.token = token?.trim() || null;
    this.configured = Boolean(this.token);
  }

  async fetchQuotes(symbols: SymbolConfig[]): Promise<Quote[]> {
    this.quotaExhausted = false;
    if (!this.token) return unconfiguredQuotes(symbols, this.id);
    const out: Quote[] = [];
    for (const [index, symbol] of symbols.entries()) {
      try {
        const listed = resolveSymbolConfig(symbol);
        const url = new URL("https://finnhub.io/api/v1/quote");
        url.searchParams.set("symbol", listed.finnhubSymbol);
        url.searchParams.set("token", this.token);
        const res = await fetch(url, { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as {
          c?: number;
          d?: number;
          dp?: number;
          t?: number;
          error?: string;
        };
        if (!res.ok || finnhubQuotaError(res.status, data.error)) {
          if (finnhubQuotaError(res.status, data.error)) {
            this.quotaExhausted = true;
            return [...out, ...unconfiguredQuotes(symbols.slice(index), this.id)];
          }
          out.push(unavailableQuote(symbol, this.id));
          continue;
        }
        if (data.error || !usableMarketPrice(data.c) || !data.t) {
          out.push(unavailableQuote(symbol, this.id));
          continue;
        }
        out.push({
          symbolId: symbol.id,
          symbol: symbol.symbol,
          displayName: symbol.displayName,
          price: data.c,
          changeAbs: typeof data.d === "number" ? data.d : null,
          changePct: typeof data.dp === "number" ? data.dp : null,
          currency: symbol.currency,
          asOf: new Date(data.t * 1000).toISOString(),
          status: "DELAYED",
          provider: this.id,
        });
      } catch {
        out.push(unavailableQuote(symbol, this.id));
      }
    }
    return out;
  }
}
