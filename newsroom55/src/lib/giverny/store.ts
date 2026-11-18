import { getDb, getSetting, setSetting } from "@/lib/database";
import type {
  DailyPoint,
  FilingBook,
  FilingRecord,
  GivernyRefreshProgress,
  HoldingRecord,
  HoldingWeight,
} from "@/lib/giverny/types";
import { GIVERNY_IDLE_PROGRESS } from "@/lib/giverny/types";

export function listFilings(): FilingRecord[] {
  return getDb()
    .prepare(
      `SELECT id, accession, cik, filer_name as filerName, form,
              period_of_report as periodOfReport, filed_at as filedAt,
              accepted_at as acceptedAt, document_url as documentUrl,
              holdings_count as holdingsCount, mapped_count as mappedCount,
              table_value_total as tableValueTotal
       FROM giverny_filings
       ORDER BY filed_at DESC, accession DESC`,
    )
    .all() as FilingRecord[];
}

export function latestFiling(): FilingRecord | null {
  return listFilings()[0] ?? null;
}

export function listHoldings(filingId: number): HoldingRecord[] {
  return getDb()
    .prepare(
      `SELECT filing_id as filingId, cusip, issuer_name as issuerName,
              title_of_class as titleOfClass, ticker, shares, value,
              put_call as putCall, share_type as shareType,
              derivative, weight
       FROM giverny_holdings
       WHERE filing_id = ?
       ORDER BY value DESC, cusip ASC`,
    )
    .all(filingId) as HoldingRecord[];
}

export function filingBooks(): FilingBook[] {
  const filings = [...listFilings()].reverse();
  return filings.map((filing) => ({
    accession: filing.accession,
    filedOn: filing.filedAt.slice(0, 10),
    periodOfReport: filing.periodOfReport.slice(0, 10),
    holdings: listHoldings(filing.id)
      .filter((row) => !row.derivative && row.weight != null && row.weight > 0)
      .map(
        (row): HoldingWeight => ({
          ticker: row.ticker,
          cusip: row.cusip,
          issuerName: row.issuerName,
          weight: row.weight as number,
          shares: row.shares,
          value: row.value,
        }),
      ),
  }));
}

export function earliestFiledOn(books: FilingBook[]): string | null {
  const dates = books.map((book) => book.filedOn).filter(Boolean).sort();
  return dates[0] ?? null;
}

export function mappedTickers(books: FilingBook[]): string[] {
  return [
    ...new Set(
      books.flatMap((book) =>
        book.holdings.map((holding) => holding.ticker).filter((ticker): ticker is string => Boolean(ticker)),
      ),
    ),
  ];
}

export function replaceFiling(input: {
  accession: string;
  cik: string;
  filerName: string;
  form: string;
  periodOfReport: string;
  filedAt: string;
  acceptedAt: string | null;
  documentUrl: string;
  tableValueTotal: number | null;
  holdings: Array<
    Omit<HoldingRecord, "filingId"> & { ticker: string | null; weight: number | null }
  >;
}): number {
  const db = getDb();
  const mappedCount = input.holdings.filter((row) => row.ticker && !row.derivative).length;
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM giverny_filings WHERE accession = ?").run(input.accession);
    const result = db
      .prepare(
        `INSERT INTO giverny_filings (
           accession, cik, filer_name, form, period_of_report, filed_at, accepted_at,
           document_url, holdings_count, mapped_count, table_value_total, fetched_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.accession,
        input.cik,
        input.filerName,
        input.form,
        input.periodOfReport,
        input.filedAt,
        input.acceptedAt,
        input.documentUrl,
        input.holdings.length,
        mappedCount,
        input.tableValueTotal,
        new Date().toISOString(),
      );
    const filingId = Number(result.lastInsertRowid);
    const insert = db.prepare(
      `INSERT INTO giverny_holdings (
         filing_id, cusip, issuer_name, title_of_class, ticker, shares, value,
         put_call, share_type, derivative, weight
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const holding of input.holdings) {
      insert.run(
        filingId,
        holding.cusip,
        holding.issuerName,
        holding.titleOfClass,
        holding.ticker,
        holding.shares,
        holding.value,
        holding.putCall,
        holding.shareType,
        holding.derivative ? 1 : 0,
        holding.weight,
      );
    }
    return filingId;
  });
  return tx();
}

export function readCusipMap(): Map<string, string> {
  const rows = getDb()
    .prepare("SELECT cusip, ticker FROM giverny_cusip_map")
    .all() as Array<{ cusip: string; ticker: string }>;
  return new Map(rows.map((row) => [row.cusip, row.ticker]));
}

export function upsertCusipMap(rows: Array<{ cusip: string; ticker: string; issuerName?: string | null; source: string }>) {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO giverny_cusip_map (cusip, ticker, issuer_name, source, updated_at)
     VALUES (@cusip, @ticker, @issuerName, @source, @updatedAt)
     ON CONFLICT(cusip) DO UPDATE SET
       ticker = excluded.ticker,
       issuer_name = excluded.issuer_name,
       source = excluded.source,
       updated_at = excluded.updated_at`,
  );
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const row of rows) {
      if (!row.ticker) continue;
      stmt.run({
        cusip: row.cusip,
        ticker: row.ticker,
        issuerName: row.issuerName ?? null,
        source: row.source,
        updatedAt: now,
      });
    }
  });
  tx();
}

export function applyCusipMapToHoldings(mapped: Map<string, string>) {
  if (mapped.size === 0) return;
  const db = getDb();
  const update = db.prepare(
    `UPDATE giverny_holdings SET ticker = ?
     WHERE cusip = ? AND (ticker IS NULL OR ticker = '')`,
  );
  const recount = db.prepare(
    `UPDATE giverny_filings SET mapped_count = (
       SELECT COUNT(*) FROM giverny_holdings
       WHERE filing_id = giverny_filings.id
         AND ticker IS NOT NULL AND ticker != ''
         AND derivative = 0
     )`,
  );
  const tx = db.transaction(() => {
    for (const [cusip, ticker] of mapped) {
      if (!ticker) continue;
      update.run(ticker, cusip);
    }
    recount.run();
  });
  tx();
}

export function upsertPrices(
  rows: Array<{
    symbol: string;
    sessionDate: string;
    close: number | null;
    adjClose: number | null;
    currency?: string;
    provider: string;
    official?: boolean;
    asOf?: string | null;
  }>,
) {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO giverny_prices (symbol, session_date, close, adj_close, currency, provider, official, as_of)
     VALUES (@symbol, @sessionDate, @close, @adjClose, @currency, @provider, @official, @asOf)
     ON CONFLICT(symbol, session_date) DO UPDATE SET
       close = COALESCE(excluded.close, giverny_prices.close),
       adj_close = COALESCE(excluded.adj_close, giverny_prices.adj_close),
       provider = excluded.provider,
       official = MAX(excluded.official, giverny_prices.official),
       as_of = COALESCE(excluded.as_of, giverny_prices.as_of)`,
  );
  const tx = db.transaction(() => {
    for (const row of rows) {
      if (row.close != null && !(row.close > 0)) continue;
      if (row.adjClose != null && !(row.adjClose > 0)) continue;
      stmt.run({
        symbol: row.symbol,
        sessionDate: row.sessionDate,
        close: row.close,
        adjClose: row.adjClose,
        currency: row.currency ?? "USD",
        provider: row.provider,
        official: row.official === false ? 0 : 1,
        asOf: row.asOf ?? null,
      });
    }
  });
  tx();
}

export function priceSeries(symbol: string): Map<string, number> {
  const rows = getDb()
    .prepare(
      `SELECT session_date as sessionDate, adj_close as adjClose, close
       FROM giverny_prices
       WHERE symbol = ?
       ORDER BY session_date ASC`,
    )
    .all(symbol) as Array<{ sessionDate: string; adjClose: number | null; close: number | null }>;
  const map = new Map<string, number>();
  for (const row of rows) {
    const value = row.adjClose ?? row.close;
    if (value != null && value > 0) map.set(row.sessionDate, value);
  }
  return map;
}

export function allPriceSeries(symbols: string[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const symbol of symbols) out.set(symbol, priceSeries(symbol));
  return out;
}

export function upsertFx(rows: Array<{ sessionDate: string; usdCad: number; provider: string; asOf?: string | null }>) {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO giverny_fx (session_date, usd_cad, provider, as_of)
     VALUES (@sessionDate, @usdCad, @provider, @asOf)
     ON CONFLICT(session_date) DO UPDATE SET
       usd_cad = excluded.usd_cad,
       provider = excluded.provider,
       as_of = excluded.as_of`,
  );
  const tx = db.transaction(() => {
    for (const row of rows) {
      if (!(row.usdCad > 0)) continue;
      stmt.run(row);
    }
  });
  tx();
}

export function fxSeries(): Map<string, number> {
  const rows = getDb()
    .prepare("SELECT session_date as sessionDate, usd_cad as usdCad FROM giverny_fx ORDER BY session_date")
    .all() as Array<{ sessionDate: string; usdCad: number }>;
  return new Map(rows.filter((row) => row.usdCad > 0).map((row) => [row.sessionDate, row.usdCad]));
}

export function replaceIndexPoints(points: DailyPoint[]) {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO giverny_index_daily (
       session_date, giv_usd, giv_cad, giv_alpha, spx_usd, spx_cad, usd_cad,
       day_return_usd, day_return_cad, spx_return_usd, coverage, status, accession, computed_at
     ) VALUES (
       @sessionDate, @givUsd, @givCad, @givAlpha, @spxUsd, @spxCad, @usdCad,
       @dayReturnUsd, @dayReturnCad, @spxReturnUsd, @coverage, @status, @accession, @computedAt
     )
     ON CONFLICT(session_date) DO UPDATE SET
       giv_usd = excluded.giv_usd,
       giv_cad = excluded.giv_cad,
       giv_alpha = excluded.giv_alpha,
       spx_usd = excluded.spx_usd,
       spx_cad = excluded.spx_cad,
       usd_cad = excluded.usd_cad,
       day_return_usd = excluded.day_return_usd,
       day_return_cad = excluded.day_return_cad,
       spx_return_usd = excluded.spx_return_usd,
       coverage = excluded.coverage,
       status = excluded.status,
       accession = excluded.accession,
       computed_at = excluded.computed_at`,
  );
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM giverny_index_daily").run();
    for (const point of points) insert.run({ ...point, computedAt: now });
  });
  tx();
}

export function readIndexPoints(): DailyPoint[] {
  return getDb()
    .prepare(
      `SELECT session_date as sessionDate, giv_usd as givUsd, giv_cad as givCad,
              giv_alpha as givAlpha, spx_usd as spxUsd, spx_cad as spxCad,
              usd_cad as usdCad, day_return_usd as dayReturnUsd,
              day_return_cad as dayReturnCad, spx_return_usd as spxReturnUsd,
              coverage, status, accession
       FROM giverny_index_daily
       ORDER BY session_date ASC`,
    )
    .all() as DailyPoint[];
}

export function listOfficialMonths(): Array<{ yearMonth: string; officialReturn: number; note: string | null; enteredAt: string }> {
  return getDb()
    .prepare(
      `SELECT year_month as yearMonth, official_return as officialReturn, note, entered_at as enteredAt
       FROM giverny_official_months
       ORDER BY year_month ASC`,
    )
    .all() as Array<{ yearMonth: string; officialReturn: number; note: string | null; enteredAt: string }>;
}

export function upsertOfficialMonth(yearMonth: string, officialReturn: number, note: string | null) {
  getDb()
    .prepare(
      `INSERT INTO giverny_official_months (year_month, official_return, note, entered_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(year_month) DO UPDATE SET
         official_return = excluded.official_return,
         note = excluded.note,
         entered_at = excluded.entered_at`,
    )
    .run(yearMonth, officialReturn, note, new Date().toISOString());
}

export function deleteOfficialMonth(yearMonth: string) {
  getDb().prepare("DELETE FROM giverny_official_months WHERE year_month = ?").run(yearMonth);
}

const RETIRED_HEALTH_PROVIDERS = new Set(["edgar"]);
const REFRESH_PROGRESS_KEY = "giverny_refresh_progress";

export function providerNote(provider: string, ok: boolean, detail: string) {
  if (RETIRED_HEALTH_PROVIDERS.has(provider)) return;
  setSetting(`giverny_health_${provider}`, JSON.stringify({ ok, detail, at: new Date().toISOString() }));
}

export function clearRetiredProviderNotes() {
  getDb().prepare("DELETE FROM settings WHERE key = ?").run("giverny_health_edgar");
}

export function readProviderNotes(): Array<{ provider: string; ok: boolean; detail: string }> {
  const db = getDb();
  const rows = db
    .prepare("SELECT key, value FROM settings WHERE key LIKE 'giverny_health_%'")
    .all() as Array<{ key: string; value: string }>;
  return rows.flatMap((row) => {
    const provider = row.key.replace("giverny_health_", "");
    if (RETIRED_HEALTH_PROVIDERS.has(provider) || !row.value) return [];
    try {
      const parsed = JSON.parse(row.value) as { ok?: boolean; detail?: string };
      return [
        {
          provider,
          ok: Boolean(parsed.ok),
          detail: parsed.detail || "",
        },
      ];
    } catch {
      return [{ provider, ok: false, detail: row.value }];
    }
  });
}

export function markGivernyError(message: string | null) {
  setSetting("giverny_last_error", message ?? "");
}

export function lastGivernyError(): string | null {
  const stored = getSetting("giverny_last_error", "") || null;
  if (stored && /EDGAR a refusé/i.test(stored)) {
    markGivernyError(null);
    return null;
  }
  return stored;
}

export function setRefreshProgress(patch: Partial<GivernyRefreshProgress>) {
  const current = getRefreshProgress();
  const next: GivernyRefreshProgress = {
    ...current,
    ...patch,
    percent: Math.max(0, Math.min(100, patch.percent ?? current.percent)),
  };
  setSetting(REFRESH_PROGRESS_KEY, JSON.stringify(next));
}

export function getRefreshProgress(): GivernyRefreshProgress {
  const raw = getSetting(REFRESH_PROGRESS_KEY, "");
  if (!raw) return { ...GIVERNY_IDLE_PROGRESS };
  try {
    const parsed = JSON.parse(raw) as Partial<GivernyRefreshProgress>;
    return {
      running: Boolean(parsed.running),
      stage: typeof parsed.stage === "string" ? parsed.stage : "",
      detail: typeof parsed.detail === "string" ? parsed.detail : "",
      percent: typeof parsed.percent === "number" && Number.isFinite(parsed.percent) ? parsed.percent : 0,
      startedAt: parsed.startedAt ?? null,
      finishedAt: parsed.finishedAt ?? null,
      error: parsed.error ?? null,
    };
  } catch {
    return { ...GIVERNY_IDLE_PROGRESS };
  }
}

export function markRefresh(kind: "filings" | "prices" | "close" | "success") {
  setSetting(`giverny_last_${kind}`, new Date().toISOString());
}

export function lastRefresh(kind: "filings" | "prices" | "close" | "success"): string | null {
  return getSetting(`giverny_last_${kind}`, "") || null;
}
