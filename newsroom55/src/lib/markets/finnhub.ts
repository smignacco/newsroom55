import type { MarketProvider, Quote, SymbolConfig } from "@/lib/markets/provider";
import { unavailableQuote, unconfiguredQuotes } from "@/lib/markets/provider";
import { resolveSymbolConfig, usableMarketPrice } from "@/lib/markets/resolve";

export class FinnhubProvider implements MarketProvider {
  id = "finnhub";
  name = "Finnhub";
  delayed = true;
  configured: boolean;
  private token: string | null;

  constructor(token: string | null | undefined) {
    this.token = token?.trim() || null;
    this.configured = Boolean(this.token);
  }

  async fetchQuotes(symbols: SymbolConfig[]): Promise<Quote[]> {
    if (!this.token) return unconfiguredQuotes(symbols, this.id);
    const out: Quote[] = [];
    for (const symbol of symbols) {
      try {
        const listed = resolveSymbolConfig(symbol);
        const url = new URL("https://finnhub.io/api/v1/quote");
        url.searchParams.set("symbol", listed.finnhubSymbol);
        url.searchParams.set("token", this.token);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          out.push(unavailableQuote(symbol, this.id));
          continue;
        }
        const data = (await res.json()) as {
          c?: number;
          d?: number;
          dp?: number;
          t?: number;
          error?: string;
        };
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
