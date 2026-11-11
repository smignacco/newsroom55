export type QuoteStatus = "LIVE" | "DELAYED" | "UNAVAILABLE";

export type SymbolConfig = {
  id: number;
  symbol: string;
  displayName: string;
  kind: string;
  currency: string;
  providerSymbol: string;
  quoteProvider?: string;
  exchange?: string | null;
};

export type Quote = {
  symbolId: number;
  symbol: string;
  displayName: string;
  price: number | null;
  changeAbs: number | null;
  changePct: number | null;
  currency: string;
  asOf: string | null;
  status: QuoteStatus;
  provider: string;
};

export interface MarketProvider {
  id: string;
  name: string;
  configured: boolean;
  delayed: boolean;
  fetchQuotes(symbols: SymbolConfig[]): Promise<Quote[]>;
}

export function unconfiguredQuotes(symbols: SymbolConfig[], providerId: string): Quote[] {
  return symbols.map((s) => ({
    symbolId: s.id,
    symbol: s.symbol,
    displayName: s.displayName,
    price: null,
    changeAbs: null,
    changePct: null,
    currency: s.currency,
    asOf: null,
    status: "UNAVAILABLE",
    provider: providerId,
  }));
}
