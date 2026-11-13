import type { SymbolConfig } from "@/lib/markets/provider";
import { finnhubSymbol as finnhubIndexSymbol } from "@/lib/markets/symbols";

export type QuoteVendor = "cboe" | "twelvedata" | "finnhub";

export type ListedInstrument = {
  ticker: string;
  displaySymbol: string;
  exchange: string | null;
  micCode: string | null;
  yahooSuffix: string | null;
  currencyHint: string | null;
  twelveSymbol: string;
  twelveExchange: string | null;
  finnhubSymbol: string;
  cboeEligible: boolean;
  canadian: boolean;
};

type ExchangeAlias = {
  exchange: string;
  micCode: string;
  yahooSuffix: string;
  currency: string;
  canadian: boolean;
};

const EXCHANGES: Record<string, ExchangeAlias> = {
  TSX: { exchange: "TSX", micCode: "XTSE", yahooSuffix: "TO", currency: "CAD", canadian: true },
  XTSE: { exchange: "TSX", micCode: "XTSE", yahooSuffix: "TO", currency: "CAD", canadian: true },
  TORONTO: { exchange: "TSX", micCode: "XTSE", yahooSuffix: "TO", currency: "CAD", canadian: true },
  TO: { exchange: "TSX", micCode: "XTSE", yahooSuffix: "TO", currency: "CAD", canadian: true },
  TSXV: { exchange: "TSXV", micCode: "XTSX", yahooSuffix: "V", currency: "CAD", canadian: true },
  XTSX: { exchange: "TSXV", micCode: "XTSX", yahooSuffix: "V", currency: "CAD", canadian: true },
  V: { exchange: "TSXV", micCode: "XTSX", yahooSuffix: "V", currency: "CAD", canadian: true },
  VENTURE: { exchange: "TSXV", micCode: "XTSX", yahooSuffix: "V", currency: "CAD", canadian: true },
  NEO: { exchange: "NEO", micCode: "NEOE", yahooSuffix: "NE", currency: "CAD", canadian: true },
  NEOE: { exchange: "NEO", micCode: "NEOE", yahooSuffix: "NE", currency: "CAD", canadian: true },
  NE: { exchange: "NEO", micCode: "NEOE", yahooSuffix: "NE", currency: "CAD", canadian: true },
  CSE: { exchange: "CSE", micCode: "XCNQ", yahooSuffix: "CN", currency: "CAD", canadian: true },
  CNQ: { exchange: "CSE", micCode: "XCNQ", yahooSuffix: "CN", currency: "CAD", canadian: true },
  XCNQ: { exchange: "CSE", micCode: "XCNQ", yahooSuffix: "CN", currency: "CAD", canadian: true },
  CN: { exchange: "CSE", micCode: "XCNQ", yahooSuffix: "CN", currency: "CAD", canadian: true },
};

const SUFFIX_RE = /^([A-Z0-9][A-Z0-9.-]*?)\.(TO|TSX|TSXV|V|CN|NE)$/i;
const COLON_RE = /^([A-Z0-9][A-Z0-9.-]*?):([A-Z0-9]+)$/i;
const INDEX_RE = /^\^[A-Z0-9.]+$/;

function lookupExchange(value: string | null | undefined): ExchangeAlias | null {
  if (!value) return null;
  return EXCHANGES[value.trim().toUpperCase()] ?? null;
}

function parseDecoratedSymbol(raw: string): { ticker: string; alias: ExchangeAlias | null } | null {
  const value = raw.trim().toUpperCase();
  if (!value) return null;
  const suffix = value.match(SUFFIX_RE);
  if (suffix) {
    return { ticker: suffix[1], alias: lookupExchange(suffix[2]) };
  }
  const colon = value.match(COLON_RE);
  if (colon) {
    return { ticker: colon[1], alias: lookupExchange(colon[2]) };
  }
  return null;
}

export function usableMarketPrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function parsePriceField(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return usableMarketPrice(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return usableMarketPrice(parsed) ? parsed : null;
}

export function parseSignedNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveListedInstrument(
  symbol: string,
  exchange?: string | null,
  providerSymbol?: string | null,
  currency?: string | null,
  kind?: string | null,
): ListedInstrument {
  const provider = (providerSymbol ?? "").trim();
  const decorated = parseDecoratedSymbol(provider) ?? parseDecoratedSymbol(symbol);
  const alias = decorated?.alias ?? lookupExchange(exchange);
  const providerUpper = provider.toUpperCase();
  const symbolUpper = symbol.trim().toUpperCase();
  const ticker = (
    decorated?.ticker ||
    (INDEX_RE.test(providerUpper) ? providerUpper : "") ||
    (INDEX_RE.test(symbolUpper) ? symbolUpper : "") ||
    providerUpper ||
    symbolUpper
  )
    .trim()
    .toUpperCase();
  const canadian =
    alias?.canadian === true ||
    currency?.toUpperCase() === "CAD" ||
    lookupExchange(exchange)?.canadian === true;
  const storedExchange = exchange?.trim() || null;
  const twelveSymbol = INDEX_RE.test(providerUpper) ? providerUpper : ticker;
  const finnhubSymbol = finnhubIndexSymbol(
    alias ? `${ticker}.${alias.yahooSuffix}` : provider || symbol.trim(),
  );
  const cboeEligible =
    !canadian &&
    !alias &&
    (currency == null || currency.toUpperCase() === "USD") &&
    (kind == null || kind === "equity" || kind === "fund") &&
    !INDEX_RE.test(ticker) &&
    !ticker.startsWith("^");

  return {
    ticker,
    displaySymbol: ticker,
    exchange: alias?.exchange ?? storedExchange,
    micCode: alias?.micCode ?? null,
    yahooSuffix: alias?.yahooSuffix ?? null,
    currencyHint: alias?.currency ?? currency?.toUpperCase() ?? null,
    twelveSymbol,
    twelveExchange: alias?.exchange ?? storedExchange,
    finnhubSymbol,
    cboeEligible,
    canadian,
  };
}

export function resolveSymbolConfig(symbol: SymbolConfig): ListedInstrument {
  return resolveListedInstrument(
    symbol.symbol,
    symbol.exchange,
    symbol.providerSymbol,
    symbol.currency,
    symbol.kind,
  );
}

export function searchTicker(query: string): {
  ticker: string;
  exchange: string | null;
  yahoo: string;
} {
  const resolved = resolveListedInstrument(query);
  return {
    ticker: resolved.ticker,
    exchange: resolved.exchange,
    yahoo: resolved.finnhubSymbol,
  };
}

export function providerSymbolFor(vendor: QuoteVendor, instrument: ListedInstrument): string {
  if (vendor === "finnhub") return instrument.finnhubSymbol;
  if (vendor === "cboe") return instrument.ticker;
  return instrument.twelveSymbol;
}

export function quoteHasPrice(quote: {
  price: number | null | undefined;
  status?: string;
}): boolean {
  return quote.status !== "UNAVAILABLE" && usableMarketPrice(quote.price);
}

export function twelveSlotPriority(symbol: SymbolConfig): number {
  const listed = resolveSymbolConfig(symbol);
  if (!listed.cboeEligible) return 0;
  if (symbol.quoteProvider === "twelvedata") return 1;
  return 2;
}

export function rankTwelveTargets(symbols: SymbolConfig[], limit: number): SymbolConfig[] {
  return [...symbols]
    .sort((left, right) => twelveSlotPriority(left) - twelveSlotPriority(right) || left.id - right.id)
    .slice(0, Math.max(0, limit));
}

export function recommendQuoteProvider(
  instrument: ListedInstrument,
  available: { twelve: boolean; finnhub: boolean },
): QuoteVendor {
  if (!instrument.cboeEligible) {
    if (available.twelve) return "twelvedata";
    if (available.finnhub) return "finnhub";
    return "twelvedata";
  }
  if (available.finnhub) return "finnhub";
  if (available.twelve) return "twelvedata";
  return "cboe";
}
