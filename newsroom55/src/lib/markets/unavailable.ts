import type { MarketProvider, Quote, SymbolConfig } from "@/lib/markets/provider";
import { unconfiguredQuotes } from "@/lib/markets/provider";

export class UnavailableProvider implements MarketProvider {
  id = "none";
  name = "Non configuré";
  configured = false;
  delayed = false;

  async fetchQuotes(symbols: SymbolConfig[]): Promise<Quote[]> {
    return unconfiguredQuotes(symbols, this.id);
  }
}
