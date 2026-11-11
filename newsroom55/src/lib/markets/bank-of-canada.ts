import type { MarketProvider, Quote, SymbolConfig } from "@/lib/markets/provider";

const API_BASE = "https://www.bankofcanada.ca/valet/observations";
const PUBLIC_SERIES = new Set(["FXUSDCAD", "FXEURCAD", "FXGBPCAD", "FXJPYCAD"]);
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1_000_000;

type Observation = {
  d?: string;
  [series: string]: { v?: string } | string | undefined;
};

type ValetResponse = {
  observations?: Observation[];
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
    provider: "bankofcanada",
  };
}

export class BankOfCanadaProvider implements MarketProvider {
  id = "bankofcanada";
  name = "Banque du Canada · quotidien";
  configured = true;
  delayed = true;

  async fetchQuotes(symbols: SymbolConfig[]): Promise<Quote[]> {
    const supported = symbols.filter((symbol) => PUBLIC_SERIES.has(symbol.providerSymbol));
    if (!supported.length) return symbols.map(unavailable);

    const series = [...new Set(supported.map((symbol) => symbol.providerSymbol))];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE}/${series.join(",")}/json?recent=2`, {
        cache: "no-store",
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!response.ok) return symbols.map(unavailable);
      const declaredSize = Number(response.headers.get("content-length") || 0);
      if (declaredSize > MAX_RESPONSE_BYTES) return symbols.map(unavailable);
      const body = await response.text();
      if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) return symbols.map(unavailable);
      const payload = JSON.parse(body) as ValetResponse;
      const observations = (payload.observations || [])
        .filter((item): item is Observation & { d: string } => typeof item.d === "string")
        .sort((a, b) => b.d.localeCompare(a.d));
      const latest = observations[0];
      const previous = observations[1];
      if (!latest) return symbols.map(unavailable);

      return symbols.map((symbol) => {
        if (!PUBLIC_SERIES.has(symbol.providerSymbol)) return unavailable(symbol);
        const currentValue = latest[symbol.providerSymbol];
        const previousValue = previous?.[symbol.providerSymbol];
        const price = Number(typeof currentValue === "object" ? currentValue?.v : NaN);
        const prior = Number(typeof previousValue === "object" ? previousValue?.v : NaN);
        if (!Number.isFinite(price)) return unavailable(symbol);
        const changeAbs = Number.isFinite(prior) ? price - prior : null;
        const changePct = changeAbs != null && prior !== 0 ? (changeAbs / prior) * 100 : null;
        return {
          symbolId: symbol.id,
          symbol: symbol.symbol,
          displayName: symbol.displayName,
          price,
          changeAbs,
          changePct,
          currency: symbol.currency,
          asOf: latest.d,
          status: "DELAYED",
          provider: this.id,
        };
      });
    } catch {
      return symbols.map(unavailable);
    } finally {
      clearTimeout(timeout);
    }
  }
}
