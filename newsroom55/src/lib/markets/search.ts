const CBOE_DIRECTORY_URL =
  "https://www.cboe.com/us/options/symboldir/equity_index_options/?download=csv";
const TWELVE_SEARCH_URL = "https://api.twelvedata.com/symbol_search";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_DIRECTORY_BYTES = 2_000_000;
const CACHE_MS = 24 * 60 * 60 * 1000;
const TWELVE_SEARCH_CACHE_MS = 15 * 60 * 1000;

export type MarketSearchResult = {
  symbol: string;
  providerSymbol: string;
  name: string;
  kind: "equity" | "fund";
  currency: string;
  exchange: string | null;
  country: string;
  instrumentType: string;
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
        {
          symbol,
          providerSymbol: symbol,
          name,
          kind: kindFromName(name),
          currency: "USD",
          exchange: null,
          country: "États-Unis",
          instrumentType: "Action / FNB coté aux États-Unis",
        } satisfies MarketSearchResult,
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
    url.searchParams.set("symbol", query);
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
        instrument_type?: string;
        country?: string;
        currency?: string;
      }>;
    };
    if (payload.status === "error") throw new Error(payload.message || "Twelve Data search failed");
    const results = (payload.data ?? []).flatMap((item) => {
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
        {
          symbol,
          providerSymbol: symbol,
          name,
          kind: kindFromName(name, instrumentType),
          currency,
          exchange: item.exchange?.trim() || null,
          country: item.country?.trim() || "Marché international",
          instrumentType,
        } satisfies MarketSearchResult,
      ];
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

export async function searchMarketInstruments(
  query: string,
  provider: "cboe" | "twelvedata" = "cboe",
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
  return searchCboe(query);
}
