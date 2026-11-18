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

const US_EXCHANGES = new Set(["US", "UN", "UW", "UA", "N", "A", "P", "OQ"]);

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

export async function mapCusips(
  rows: Array<{ cusip: string; issuerName: string }>,
): Promise<{ mapped: Map<string, string>; error: string | null }> {
  const known = readCusipMap();
  const missing = rows.filter((row) => !known.has(row.cusip));
  if (missing.length === 0) return { mapped: known, error: null };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const posted = await fetch("https://api.openfigi.com/v3/mapping", {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(missing.map((row) => ({ idType: "ID_CUSIP", idValue: row.cusip }))),
    });
    if (!posted.ok) {
      return {
        mapped: known,
        error: `OpenFIGI ${posted.status}: correspondance CUSIP incomplète.`,
      };
    }
    const payload = (await posted.json()) as OpenFigiRow[];
    const discovered: Array<{ cusip: string; ticker: string; issuerName?: string | null; source: string }> = [];
    payload.forEach((row, index) => {
      const ticker = pickOpenFigiTicker(row.data);
      const cusip = missing[index]?.cusip;
      if (!ticker || !cusip) return;
      known.set(cusip, ticker);
      discovered.push({
        cusip,
        ticker,
        issuerName: missing[index]?.issuerName,
        source: "openfigi",
      });
    });
    if (discovered.length) upsertCusipMap(discovered);
    return {
      mapped: known,
      error: discovered.length === missing.length ? null : "Certains CUSIP n’ont pas de ticker américain.",
    };
  } catch {
    return {
      mapped: known,
      error: "OpenFIGI injoignable; les titres non mis en cache restent non appariés.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
