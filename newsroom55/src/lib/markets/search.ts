import { resolveListedInstrument, searchTicker } from "@/lib/markets/resolve";

const CBOE_DIRECTORY_URL =
  "https://www.cboe.com/us/options/symboldir/equity_index_options/?download=csv";
const TWELVE_SEARCH_URL = "https://api.twelvedata.com/symbol_search";
const FINNHUB_SEARCH_URL = "https://finnhub.io/api/v1/search";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_DIRECTORY_BYTES = 2_000_000;
const CACHE_MS = 24 * 60 * 60 * 1000;
const TWELVE_SEARCH_CACHE_MS = 15 * 60 * 1000;

export type MarketSearchProvider = "cboe" | "twelvedata" | "finnhub";

export type MarketSearchResult = {
  symbol: string;
  providerSymbol: string;
  name: string;
  kind: "equity" | "fund";
  currency: string;
  exchange: string | null;
  micCode: string | null;
  country: string;
  instrumentType: string;
  twelveSymbol: string;
  finnhubSymbol: string;
  cboeEligible: boolean;
};

export type MarketSearchResponse = {
  provider: "cboe" | "twelvedata" | "finnhub" | "bankofcanada";
  providerName: string;
  global: boolean;
  configured: boolean;
  note: string;
  results: MarketSearchResult[];
};

let cboeCache: { loadedAt: number; rows: MarketSearchResult[] } | null = null;
const twelveSearchCache = new Map<
  string,
  { loadedAt: number; response: MarketSearchResponse }
>();

export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field.trim());
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field.trim());
  return fields;
}

function kindFromName(name: string, instrumentType = ""): "equity" | "fund" {
  return /\b(ETF|FUND|TRUST|ISHARES|SPDR|VANGUARD)\b/i.test(
    `${name} ${instrumentType}`,
  )
    ? "fund"
    : "equity";
}

function mappedResult(input: {
  symbol: string;
  name: string;
  kind: "equity" | "fund";
  currency: string;
  exchange: string | null;
  country: string;
  instrumentType: string;
  provider: MarketSearchProvider;
}): MarketSearchResult {
  const listed = resolveListedInstrument(
    input.symbol,
    input.exchange,
    input.symbol,
    input.currency,
    input.kind,
  );
  return {
    symbol: listed.displaySymbol,
    providerSymbol:
      input.provider === "finnhub" ? listed.finnhubSymbol : listed.twelveSymbol,
    name: input.name,
    kind: input.kind,
    currency: listed.currencyHint || input.currency,
    exchange: listed.exchange,
    micCode: listed.micCode,
    country: input.country,
    instrumentType: input.instrumentType,
    twelveSymbol: listed.twelveSymbol,
    finnhubSymbol: listed.finnhubSymbol,
    cboeEligible: listed.cboeEligible,
  };
}

async function fetchCboeDirectory(): Promise<MarketSearchResult[]> {
  if (cboeCache && Date.now() - cboeCache.loadedAt < CACHE_MS) return cboeCache.rows;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(CBOE_DIRECTORY_URL, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "text/csv,text/plain" },
    });
    if (!response.ok) throw new Error(`Cboe directory request failed (${response.status})`);
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > MAX_DIRECTORY_BYTES) throw new Error("Cboe directory is too large");
    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > MAX_DIRECTORY_BYTES) {
      throw new Error("Cboe directory is too large");
    }
    const lines = body.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    const header = parseCsvLine(lines.shift() || "").map((field) => field.toLowerCase());
    const nameIndex = header.indexOf("company name");
    const symbolIndex = header.indexOf("stock symbol");
    if (nameIndex < 0 || symbolIndex < 0) throw new Error("Cboe directory format changed");
    const rows = lines.flatMap((line) => {
      const fields = parseCsvLine(line);
      const name = fields[nameIndex]?.trim();
      const symbol = fields[symbolIndex]?.trim().toUpperCase();
      if (!name || !symbol || !/^[A-Z][A-Z0-9.-]{0,15}$/.test(symbol)) return [];
      return [
        mappedResult({
          symbol,
          name,
          kind: kindFromName(name),
          currency: "USD",
          exchange: null,
          country: "États-Unis",
          instrumentType: "Action / FNB coté aux États-Unis",
          provider: "cboe",
        }),
      ];
    });
    cboeCache = { loadedAt: Date.now(), rows };
    return rows;
  } finally {
    clearTimeout(timeout);
  }
}

async function searchCboe(query: string): Promise<MarketSearchResponse> {
  const normalized = query.toLocaleLowerCase();
  const rows = await fetchCboeDirectory();
  const results = rows
    .filter(
      (row) =>
        row.symbol.toLocaleLowerCase().includes(normalized) ||
        row.name.toLocaleLowerCase().includes(normalized),
    )
    .sort((left, right) => {
      const leftExact = left.symbol.toLocaleLowerCase() === normalized ? 0 : 1;
      const rightExact = right.symbol.toLocaleLowerCase() === normalized ? 0 : 1;
      return leftExact - rightExact || left.name.localeCompare(right.name);
    })
    .slice(0, 20);
  return {
    provider: "cboe",
    providerName: "Cboe · données différées 15 min",
    global: false,
    configured: true,
    note:
      "Recherche publique Cboe pour les actions et FNB américains. La couverture internationale régulière n’est pas incluse dans le forfait Basic gratuit de Twelve Data.",
    results,
  };
}

async function searchTwelveData(query: string, apiKey: string): Promise<MarketSearchResponse> {
  const cacheKey = query.trim().toLocaleLowerCase();
  const cached = twelveSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt < TWELVE_SEARCH_CACHE_MS) {
    return cached.response;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = new URL(TWELVE_SEARCH_URL);
    const wanted = searchTicker(query);
    url.searchParams.set("symbol", wanted.ticker);
    url.searchParams.set("outputsize", "30");
    url.searchParams.set("apikey", apiKey);
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Twelve Data search failed (${response.status})`);
    const payload = (await response.json()) as {
      status?: string;
      message?: string;
      data?: Array<{
        symbol?: string;
        instrument_name?: string;
        exchange?: string;
        mic_code?: string;
        instrument_type?: string;
        country?: string;
        currency?: string;
      }>;
    };
    if (payload.status === "error") throw new Error(payload.message || "Twelve Data search failed");
    const results = (payload.data ?? [])
      .flatMap((item) => {
        const symbol = item.symbol?.trim().toUpperCase();
        const name = item.instrument_name?.trim();
        const currency = item.currency?.trim().toUpperCase();
        const instrumentType = item.instrument_type?.trim() || "Instrument";
        if (
          !symbol ||
          !name ||
          !currency ||
          !/^[A-Z]{3}$/.test(currency) ||
          /forex|physical currency|cryptocurrency/i.test(instrumentType)
        ) {
          return [];
        }
        return [
          mappedResult({
            symbol,
            name,
            kind: kindFromName(name, instrumentType),
            currency,
            exchange: item.exchange?.trim() || item.mic_code?.trim() || null,
            country: item.country?.trim() || "Marché international",
            instrumentType,
            provider: "twelvedata",
          }),
        ];
      })
      .sort((left, right) => {
        if (!wanted.exchange) return 0;
        const leftMatch = left.exchange === wanted.exchange ? 0 : 1;
        const rightMatch = right.exchange === wanted.exchange ? 0 : 1;
        return leftMatch - rightMatch;
      });
    const result: MarketSearchResponse = {
      provider: "twelvedata",
      providerName: "Twelve Data",
      global: true,
      configured: true,
      note:
        "Recherche par entreprise, FNB, symbole ou ISIN selon la couverture et les droits de votre forfait Twelve Data; le forfait Basic ne garantit pas les marchés internationaux.",
      results,
    };
    twelveSearchCache.set(cacheKey, { loadedAt: Date.now(), response: result });
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function searchFinnhub(query: string, token: string): Promise<MarketSearchResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const wanted = searchTicker(query);
    const url = new URL(FINNHUB_SEARCH_URL);
    url.searchParams.set("q", wanted.yahoo);
    url.searchParams.set("token", token);
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Finnhub search failed (${response.status})`);
    const payload = (await response.json()) as {
      error?: string;
      result?: Array<{
        description?: string;
        displaySymbol?: string;
        symbol?: string;
        type?: string;
      }>;
    };
    if (payload.error) throw new Error(payload.error);
    const results = (payload.result ?? []).flatMap((item) => {
      const raw = (item.displaySymbol || item.symbol || "").trim().toUpperCase();
      const name = item.description?.trim();
      const type = item.type?.trim() || "Equity";
      if (!raw || !name || /forex|crypto/i.test(type)) return [];
      const listed = resolveListedInstrument(raw, null, raw, null, kindFromName(name, type));
      return [
        mappedResult({
          symbol: listed.displaySymbol,
          name,
          kind: kindFromName(name, type),
          currency: listed.currencyHint || (listed.canadian ? "CAD" : "USD"),
          exchange: listed.exchange,
          country: listed.canadian ? "Canada" : "Marché international",
          instrumentType: type,
          provider: "finnhub",
        }),
      ];
    });
    return {
      provider: "finnhub",
      providerName: "Finnhub",
      global: true,
      configured: true,
      note:
        "Recherche Finnhub. Les actions canadiennes utilisent le suffixe Yahoo (.TO, .V). Un forfait gratuit peut renvoyer « symbole non pris en charge » — le ticker affiche alors INDISPONIBLE, jamais un cours inventé.",
      results,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchMarketInstruments(
  query: string,
  provider: MarketSearchProvider = "cboe",
): Promise<MarketSearchResponse> {
  if (provider === "twelvedata" && process.env.TWELVE_DATA_API_KEY) {
    return searchTwelveData(query, process.env.TWELVE_DATA_API_KEY);
  }
  if (provider === "twelvedata") {
    return {
      provider,
      providerName: "Twelve Data",
      global: true,
      configured: false,
      note:
        "Ajoutez TWELVE_DATA_API_KEY pour activer la recherche Twelve Data. Cboe demeure disponible sans clé.",
      results: [],
    };
  }
  if (provider === "finnhub" && process.env.FINNHUB_API_KEY) {
    return searchFinnhub(query, process.env.FINNHUB_API_KEY);
  }
  if (provider === "finnhub") {
    return {
      provider,
      providerName: "Finnhub",
      global: true,
      configured: false,
      note: "Ajoutez FINNHUB_API_KEY pour activer la recherche Finnhub.",
      results: [],
    };
  }
  return searchCboe(query);
}
