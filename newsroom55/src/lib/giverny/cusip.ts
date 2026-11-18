import { normalizeUsTicker } from "@/lib/giverny/tickers";
import { readCusipMap, upsertCusipMap } from "@/lib/giverny/store";

type OpenFigiHit = {
  ticker?: string;
  exchCode?: string;
  marketSector?: string;
  securityType?: string;
  name?: string;
};

type OpenFigiRow = { data?: OpenFigiHit[]; error?: string };

type HeaderBag = { get(name: string): string | null };

const US_EXCHANGES = new Set(["US", "UN", "UW", "UA", "N", "A", "P", "OQ"]);
const OPENFIGI_URL = "https://api.openfigi.com/v3/mapping";
const OPENFIGI_WINDOW_MS = 60_000;
const OPENFIGI_MAX_WAIT_MS = 120_000;
const OPENFIGI_429_RETRIES = 3;

export function openFigiBatchSize() {
  return process.env.OPENFIGI_API_KEY?.trim() ? 100 : 10;
}

export function openFigiDefaultPaceMs() {
  return process.env.OPENFIGI_API_KEY?.trim() ? 240 : 2_400;
}

function scoreHit(hit: OpenFigiHit): number {
  let score = 0;
  if (hit.exchCode && US_EXCHANGES.has(hit.exchCode)) score += 4;
  if (hit.marketSector === "Equity") score += 3;
  if (/common|class|ordinary/i.test(hit.securityType || "")) score += 2;
  if (/warrant|right|preferred|unit|option/i.test(hit.securityType || "")) score -= 5;
  return score;
}

export function pickOpenFigiTicker(hits: OpenFigiHit[] | undefined): string | null {
  if (!hits?.length) return null;
  const ranked = [...hits].sort((left, right) => scoreHit(right) - scoreHit(left));
  return normalizeUsTicker(ranked[0]?.ticker ?? null);
}

function figiHeaders() {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };
  const key = process.env.OPENFIGI_API_KEY?.trim();
  if (key) headers["X-OPENFIGI-APIKEY"] = key;
  return headers;
}

function sleep(ms: number) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pacedSleep(ms: number) {
  if (!(ms > 0) || process.env.VITEST === "true") return;
  await sleep(ms);
}

function headerNumber(headers: HeaderBag, names: string[]): number | null {
  for (const name of names) {
    const raw = headers.get(name);
    if (raw == null || raw === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function rateLimitResetMs(headers: HeaderBag): number {
  const reset = headerNumber(headers, ["ratelimit-reset", "x-ratelimit-reset"]);
  if (reset == null || reset < 0) return 0;
  if (reset > 1_000_000_000) {
    return Math.min(Math.max(reset * 1000 - Date.now(), 0), OPENFIGI_MAX_WAIT_MS);
  }
  return Math.min(reset * 1000, OPENFIGI_MAX_WAIT_MS);
}

export function openFigiNextDelayMs(headers: HeaderBag, status: number): number {
  if (status === 429) {
    const retryAfter = headerNumber(headers, ["retry-after"]);
    if (retryAfter != null && retryAfter >= 0) {
      return Math.min(retryAfter * 1000, OPENFIGI_MAX_WAIT_MS);
    }
    const reset = rateLimitResetMs(headers);
    return reset > 0 ? reset : OPENFIGI_WINDOW_MS;
  }
  const remaining = headerNumber(headers, ["ratelimit-remaining", "x-ratelimit-remaining"]);
  if (remaining != null) {
    if (remaining <= 0) {
      const reset = rateLimitResetMs(headers);
      return reset > 0 ? reset : OPENFIGI_WINDOW_MS;
    }
    return 0;
  }
  return openFigiDefaultPaceMs();
}

async function mapChunk(
  chunk: Array<{ cusip: string; issuerName: string }>,
): Promise<{
  discovered: Array<{ cusip: string; ticker: string; issuerName?: string | null; source: string }>;
  error: string | null;
  retry: boolean;
  delayMs: number;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const posted = await fetch(OPENFIGI_URL, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: figiHeaders(),
      body: JSON.stringify(chunk.map((row) => ({ idType: "ID_CUSIP", idValue: row.cusip }))),
    });
    const delayMs = openFigiNextDelayMs(posted.headers, posted.status);
    if (posted.status === 429) {
      return {
        discovered: [],
        error: "OpenFIGI 429: quota minute atteinte.",
        retry: true,
        delayMs,
      };
    }
    if (!posted.ok) {
      return {
        discovered: [],
        error: `OpenFIGI ${posted.status}: correspondance CUSIP incomplète.`,
        retry: false,
        delayMs,
      };
    }
    const payload = (await posted.json()) as OpenFigiRow[];
    const discovered: Array<{ cusip: string; ticker: string; issuerName?: string | null; source: string }> = [];
    payload.forEach((row, index) => {
      const ticker = pickOpenFigiTicker(row.data);
      const cusip = chunk[index]?.cusip;
      if (!ticker || !cusip) return;
      discovered.push({
        cusip,
        ticker,
        issuerName: chunk[index]?.issuerName,
        source: "openfigi",
      });
    });
    return { discovered, error: null, retry: false, delayMs };
  } catch {
    return {
      discovered: [],
      error: "OpenFIGI injoignable; les titres non mis en cache restent non appariés.",
      retry: false,
      delayMs: openFigiDefaultPaceMs(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function mapCusips(
  rows: Array<{ cusip: string; issuerName: string }>,
): Promise<{ mapped: Map<string, string>; error: string | null }> {
  const known = readCusipMap();
  const missing: Array<{ cusip: string; issuerName: string }> = [];
  const queued = new Set<string>();
  for (const row of rows) {
    if (!row.cusip || known.has(row.cusip) || queued.has(row.cusip)) continue;
    queued.add(row.cusip);
    missing.push(row);
  }
  if (missing.length === 0) return { mapped: known, error: null };

  const size = openFigiBatchSize();
  const discoveredAll: Array<{ cusip: string; ticker: string; issuerName?: string | null; source: string }> = [];
  let error: string | null = null;
  let retries = 0;
  for (let offset = 0; offset < missing.length; ) {
    const chunk = missing.slice(offset, offset + size);
    const { discovered, error: chunkError, retry, delayMs } = await mapChunk(chunk);
    if (retry && retries < OPENFIGI_429_RETRIES) {
      retries += 1;
      await pacedSleep(delayMs);
      continue;
    }
    retries = 0;
    discoveredAll.push(...discovered);
    for (const row of discovered) known.set(row.cusip, row.ticker);
    if (chunkError) error = error ?? chunkError;
    offset += size;
    if (offset < missing.length) {
      await pacedSleep(delayMs);
    }
  }
  if (discoveredAll.length) upsertCusipMap(discoveredAll);
  if (discoveredAll.length !== missing.length) {
    error = error ?? "Certains CUSIP n’ont pas de ticker américain.";
  } else {
    error = null;
  }
  return { mapped: known, error };
}
