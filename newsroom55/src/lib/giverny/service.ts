import { usEquitySession } from "@/lib/markets/session";
import {
  chartSeries,
  contributorsForSession,
  lastCompletedReturn,
  monthToDateReturn,
  monthlyIndexReturns,
  reconstructIndex,
  sessionReturn,
  trackingError,
  cumulativeGap,
  usablePrice,
  yearToDateReturn,
  latestDisplayPoint,
  officialNavEstimate,
} from "@/lib/giverny/engine";
import {
  filingStoredDate,
  filingToHoldings,
  type EdgarFilingMeta,
} from "@/lib/giverny/edgar";
import { parse13FDocuments } from "@/lib/giverny/parse-13f";
import type { Parsed13FFiling } from "@/lib/giverny/types";
import { mapCusips } from "@/lib/giverny/cusip";
import { refreshUsdCadHistory } from "@/lib/giverny/fx";
import { liveQuotePriceRows, refreshLiveQuotes, refreshYahooHistory } from "@/lib/giverny/prices";
import { givernySettings } from "@/lib/giverny/settings";
import {
  allPriceSeries,
  applyCusipMapToHoldings,
  deleteOfficialMonth,
  earliestFiledOn,
  filingBooks,
  fxSeries,
  lastGivernyError,
  lastRefresh,
  latestFiling,
  listFilings,
  listHoldings,
  listOfficialMonths,
  mappedTickers,
  markGivernyError,
  markRefresh,
  priceSeries,
  providerNote,
  readIndexPoints,
  readProviderNotes,
  replaceFiling,
  replaceIndexPoints,
  setRefreshProgress,
  getRefreshProgress,
  clearRetiredProviderNotes,
  upsertOfficialMonth,
  upsertPrices,
} from "@/lib/giverny/store";
import { nySessionDate, nyTradingSessions, padCik } from "@/lib/giverny/tickers";
import type {
  Contributor,
  GivernyRefreshProgress,
  GivernySummary,
  OfficialMonth,
  ValidationReport,
} from "@/lib/giverny/types";
import { GIVERNY_DEFAULT_FILER, GIVERNY_MIN_COVERAGE } from "@/lib/giverny/types";

let computeInFlight: Promise<void> | null = null;
let refreshInFlight: Promise<void> | null = null;
let manualRefreshProgress = false;

function reportManualRefreshProgress(patch: Parameters<typeof setRefreshProgress>[0]) {
  if (!manualRefreshProgress) return;
  setRefreshProgress(patch);
}

function hoursSince(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? (Date.now() - parsed) / 3_600_000 : Number.POSITIVE_INFINITY;
}

function minutesInNewYork() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return {
    weekday: map.weekday,
    minutes: Number(map.hour) * 60 + Number(map.minute),
  };
}

export async function tickGiverny(force = false): Promise<void> {
  const settings = givernySettings();
  if (!settings.enabled && !force) return;
  clearRetiredProviderNotes();
  if (listFilings().length === 0) {
    markGivernyError("Aucun 13F importé. Chargez le XML depuis sec.gov dans un navigateur.");
    return;
  }
  markGivernyError(null);
  const newlyMapped = await remapStoredHoldings();
  const session = usEquitySession();
  const priceDue = hoursSince(lastRefresh("prices")) * 60 >= settings.refreshMinutes;
  const closeDue = session === "closed" && minutesInNewYork().minutes >= 16 * 60 + 30 && hoursSince(lastRefresh("close")) > 12;
  if (force || priceDue || closeDue || newlyMapped > 0 || hoursSince(lastRefresh("success")) > 24) {
    await refreshMarketHistory(closeDue);
    await recomputeIndex();
    if (closeDue) markRefresh("close");
  }
}

const ACCESSION = /^\d{10}-\d{2}-\d{6}$/;
const INFO_TABLE = /<(?:[\w.-]+:)?infoTable\b/i;

function requireFiledAt(value: string | null | undefined): string {
  const trimmed = value?.trim() || "";
  if (!trimmed) {
    throw new Error("Date de dépôt public manquante (filedAsOfDate), pas la fin de trimestre.");
  }
  return trimmed;
}

async function persistParsedFiling(
  parsed: Parsed13FFiling,
  meta: Pick<EdgarFilingMeta, "accession" | "form" | "filingDate" | "reportDate" | "acceptanceDateTime">,
  filerName: string,
) {
  const settings = givernySettings();
  const accession = parsed.accession || meta.accession;
  const cik = padCik(parsed.cik || settings.cik);
  const mapped = await mapCusips(
    parsed.holdings.map((row) => ({ cusip: row.cusip, issuerName: row.issuerName })),
  );
  providerNote("openfigi", mapped.error == null, mapped.error || "CUSIP appariés.");
  const holdings = filingToHoldings(parsed).map((holding) => ({
    ...holding,
    ticker: mapped.mapped.get(holding.cusip) ?? null,
  }));
  replaceFiling({
    accession,
    cik,
    filerName: parsed.filerName || filerName || GIVERNY_DEFAULT_FILER,
    form: parsed.form || meta.form || "13F-HR",
    periodOfReport: filingStoredDate(parsed.periodOfReport || meta.reportDate),
    filedAt: filingStoredDate(requireFiledAt(parsed.filedAt || meta.filingDate)),
    acceptedAt: parsed.acceptedAt || meta.acceptanceDateTime,
    documentUrl: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, "")}/`,
    tableValueTotal: parsed.tableValueTotal,
    holdings,
  });
  return holdings.length;
}

export async function ingestUploadedFiling(
  xml: string,
  accessionHint?: string | null,
  filedAtHint?: string | null,
) {
  const trimmed = xml.trim();
  if (trimmed.length < 40 || trimmed.length > 2_000_000) {
    throw new Error("Fichier 13F invalide.");
  }
  if (!INFO_TABLE.test(trimmed)) {
    throw new Error("Le XML ne contient pas de tableau infoTable.");
  }
  const parsed = parse13FDocuments(trimmed);
  if (parsed.holdings.length === 0) {
    throw new Error("Aucun titre lisible dans le 13F.");
  }
  const accession = ACCESSION.test((parsed.accession || "").trim())
    ? (parsed.accession || "").trim()
    : (accessionHint || "").trim();
  if (!ACCESSION.test(accession)) {
    throw new Error("Numéro d’accession manquant ou invalide (ex. 0001641864-26-000011).");
  }
  const filedAt = (parsed.filedAt || filedAtHint || "").trim();
  requireFiledAt(filedAt);
  const settings = givernySettings();
  await persistParsedFiling(
    { ...parsed, accession, filedAt },
    {
      accession,
      form: parsed.form || "13F-HR",
      filingDate: filedAt,
      reportDate: parsed.periodOfReport,
      acceptanceDateTime: parsed.acceptedAt,
    },
    parsed.filerName || settings.filerName || GIVERNY_DEFAULT_FILER,
  );
  providerNote("13f", true, `13F importé ${accession} (${parsed.holdings.length} titres).`);
  clearRetiredProviderNotes();
  markGivernyError(null);
  markRefresh("filings");
  await remapStoredHoldings();
  await refreshMarketHistory(usEquitySession() === "closed");
  await recomputeIndex();
  return { accession, holdings: parsed.holdings.length };
}

async function remapStoredHoldings() {
  const filings = listFilings();
  if (filings.length === 0) return 0;
  const before = mappedTickers(filingBooks()).length;
  const seen = new Set<string>();
  const rows: Array<{ cusip: string; issuerName: string }> = [];
  for (const filing of filings) {
    for (const row of listHoldings(filing.id)) {
      if (!row.cusip || seen.has(row.cusip)) continue;
      seen.add(row.cusip);
      rows.push({ cusip: row.cusip, issuerName: row.issuerName });
    }
  }
  const mapped = await mapCusips(rows);
  providerNote("openfigi", mapped.error == null, mapped.error || "CUSIP appariés.");
  applyCusipMapToHoldings(mapped.mapped);
  const after = mappedTickers(filingBooks()).length;
  return Math.max(0, after - before);
}

async function refreshMarketHistory(officialClose: boolean) {
  const books = filingBooks();
  const tickers = mappedTickers(books);
  if (!tickers.includes("SPX")) tickers.push("SPX");
  const today = nySessionDate();
  const stale = tickers.filter((ticker) => {
    const last = [...priceSeries(ticker).keys()].at(-1);
    return !last || last < today;
  });
  if (stale.length > 0) {
    const history = await refreshYahooHistory(stale, (done, total) => {
      reportManualRefreshProgress({
        running: true,
        stage: "Cours",
        detail: `Historique Yahoo ${done}/${total}.`,
        percent: 25 + Math.round((done / Math.max(total, 1)) * 45),
      });
    });
    providerNote("yahoo", history.count > 0, history.error || `${history.count} barres quotidiennes.`);
  }
  const start = earliestFiledOn(books) ?? `${Number(today.slice(0, 4)) - 1}-01-01`;
  reportManualRefreshProgress({
    running: true,
    stage: "Change",
    detail: "USD/CAD Banque du Canada.",
    percent: 78,
  });
  const fx = await refreshUsdCadHistory(start, today);
  providerNote("bankofcanada", fx.count > 0, fx.error || `${fx.count} observations USD/CAD.`);

  const live = await refreshLiveQuotes(tickers);
  const liveRows = liveQuotePriceRows(live, today, officialClose);
  if (liveRows.length) upsertPrices(liveRows);
  markRefresh("prices");
}

export async function recomputeIndex(): Promise<void> {
  if (computeInFlight) return computeInFlight;
  computeInFlight = (async () => {
    const books = filingBooks();
    if (books.length === 0) return;
    const tickers = mappedTickers(books);
    const prices = allPriceSeries(tickers);
    const spx = priceSeries("SPX");
    const datePool = new Set<string>([...spx.keys()]);
    for (const series of prices.values()) {
      for (const date of series.keys()) datePool.add(date);
    }
    const sessions = nyTradingSessions(datePool);
    const today = nySessionDate();
    if (usEquitySession() !== "weekend" && !sessions.includes(today) && priceSeries(tickers[0] ?? "SPX").has(today)) {
      sessions.push(today);
    }
    const points = reconstructIndex({
      sessions,
      filings: books,
      prices,
      fx: fxSeries(),
      spx,
    });
    replaceIndexPoints(points);
    if (points.some((point) => usablePrice(point.givCad) || usablePrice(point.givUsd))) {
      markRefresh("success");
      markGivernyError(null);
    }
  })().finally(() => {
    computeInFlight = null;
  });
  return computeInFlight;
}

function marketStatus(coverage: number | null, hasLevel: boolean): GivernySummary["marketStatus"] {
  if (!hasLevel) return "unavailable";
  if (coverage != null && coverage < GIVERNY_MIN_COVERAGE) return "unavailable";
  const session = usEquitySession();
  if (coverage != null && coverage < 0.995) return "delayed";
  if (session === "open") return "delayed";
  if (session === "closed") return "closed";
  return "unavailable";
}

function marketStatusLabel(status: GivernySummary["marketStatus"]): string {
  if (status === "open") return "OUVERT";
  if (status === "closed") return "FERMÉ";
  if (status === "delayed") return "DONNÉES DIFFÉRÉES";
  return "INDISPONIBLE";
}

function liveContributors(points: ReturnType<typeof readIndexPoints>): { up: Contributor[]; down: Contributor[] } {
  const filing = latestFiling();
  if (!filing) return { up: [], down: [] };
  const holdings = listHoldings(filing.id).filter(
    (row): row is typeof row & { ticker: string; weight: number } =>
      Boolean(row.ticker) && row.weight != null && !row.derivative,
  );
  const dates = [...new Set(holdings.flatMap((row) => [...priceSeries(row.ticker).keys()]))].sort();
  const last = dates.at(-1);
  const prev = dates.at(-2);
  if (!last || !prev) return { up: [], down: [] };
  const returns = new Map<string, number | null>();
  const names = new Map<string, string>();
  for (const row of holdings) {
    names.set(row.ticker, row.issuerName);
    returns.set(row.ticker, sessionReturn(priceSeries(row.ticker).get(prev) ?? null, priceSeries(row.ticker).get(last) ?? null));
  }
  void points;
  return contributorsForSession(
    holdings.map((row) => ({
      ticker: row.ticker,
      cusip: row.cusip,
      issuerName: row.issuerName,
      weight: row.weight,
      shares: row.shares,
      value: row.value,
    })),
    returns,
    names,
  );
}

export function getGivernySummary(): GivernySummary {
  const settings = givernySettings();
  const points = readIndexPoints();
  const field = settings.currency === "USD" ? "givUsd" : "givCad";
  const spxField = settings.currency === "USD" ? "spxUsd" : "spxCad";
  const latest = points.at(-1) ?? null;
  const display = latestDisplayPoint(points, field);
  const qualified = points.filter((point) => (point.coverage ?? 0) >= GIVERNY_MIN_COVERAGE);
  const asOf = display?.sessionDate ?? latest?.sessionDate ?? nySessionDate();
  const sessionUsd = display?.dayReturnUsd ?? null;
  const session = settings.currency === "USD" ? sessionUsd : (display?.dayReturnCad ?? null);
  const ytd = yearToDateReturn(qualified, asOf, field);
  const spxYtd = yearToDateReturn(qualified, asOf, spxField);
  const filing = latestFiling();
  const hasLevel = usablePrice(display?.[field] ?? null);
  const status = marketStatus(display?.coverage ?? null, hasLevel);
  const lastError = lastGivernyError();
  const navAnchors = listOfficialMonths().flatMap((row) =>
    usablePrice(row.officialNav)
      ? [{ yearMonth: row.yearMonth, officialNav: row.officialNav }]
      : [],
  );
  const navSeries = officialNavEstimate(points, navAnchors);
  const navByDate = new Map(navSeries.map((row) => [row.date, row]));
  const navToday = display?.sessionDate
    ? (navByDate.get(display.sessionDate) ?? null)
    : null;
  const showNav = settings.currency === "CAD" && navToday != null;
  const scaledPoints = showNav
    ? qualified.map((point) => {
        const estimate = navByDate.get(point.sessionDate);
        return estimate ? { ...point, givCad: estimate.value } : { ...point, givCad: null };
      })
    : qualified;
  const displayCad = showNav ? navToday.value : (display?.givCad ?? null);
  return {
    identity: "synthetic",
    officialNav: false,
    enabled: settings.enabled,
    currency: settings.currency,
    marketStatus: status,
    marketStatusLabel: marketStatusLabel(status),
    lastRefreshAt: lastRefresh("prices"),
    lastCloseAt: lastRefresh("close"),
    lastSuccessfulRefreshAt: lastRefresh("success"),
    coverage: display?.coverage ?? null,
    filing: filing
      ? {
          accession: filing.accession,
          periodOfReport: filing.periodOfReport,
          filedAt: filing.filedAt,
          holdings: filing.holdingsCount,
          mapped: filing.mappedCount,
        }
      : null,
    levels: {
      givCad: displayCad,
      givUsd: display?.givUsd ?? null,
      givAlpha: display?.givAlpha ?? null,
    },
    last: {
      givCad: displayCad,
      givUsd: display?.givUsd ?? null,
      asOf: display?.sessionDate ?? null,
    },
    returns: {
      session,
      last5: lastCompletedReturn(qualified, 5, settings.currency === "USD" ? "dayReturnUsd" : "dayReturnCad"),
      mtd: monthToDateReturn(qualified, asOf, field),
      ytd,
      vsSpxSession:
        sessionUsd != null && display?.spxReturnUsd != null ? sessionUsd - display.spxReturnUsd : null,
      vsSpxYtd: ytd != null && spxYtd != null ? ytd - spxYtd : null,
    },
    chart: chartSeries(scaledPoints, settings.chartRange, asOf, field),
    contributors: liveContributors(points),
    providerHealth: readProviderNotes(),
    navEstimate: showNav
      ? {
          value: navToday.value,
          officialNav: navToday.officialNav,
          officialMonth: navToday.officialMonth,
          anchorDate: navToday.anchorDate,
        }
      : null,
    message: !settings.enabled
      ? "Module désactivé."
      : listFilings().length === 0
        ? "Aucun 13F importé. Chargez le XML depuis sec.gov dans un navigateur."
        : hasLevel
          ? showNav
            ? "Estimation du VL à partir du dernier VL saisi et du 13F public. Ce n’est pas le VL officiel."
            : "Indice synthétique estimé à partir des 13F publics. Ce n’est pas le VL officiel."
          : lastError
            ? lastError
            : (points.at(-1)?.coverage ?? 0) < GIVERNY_MIN_COVERAGE
              ? "Indice synthétique indisponible — CUSIP non appariés ou cours insuffisants."
              : "Indice synthétique indisponible — aucun cours fiable pour cette séance.",
  };
}

export function getGivernyHoldings() {
  const filing = latestFiling();
  if (!filing) return { filing: null, holdings: [], changes: [] };
  const holdings = listHoldings(filing.id);
  const previous = listFilings()[1];
  const previousHoldings = previous ? listHoldings(previous.id) : [];
  return {
    filing,
    holdings: holdings.map((row) => ({
      ...row,
      last: row.ticker ? (priceSeries(row.ticker).get(nySessionDate()) ?? [...priceSeries(row.ticker).values()].at(-1) ?? null) : null,
    })),
    previous: previous
      ? { accession: previous.accession, periodOfReport: previous.periodOfReport, holdings: previousHoldings }
      : null,
  };
}

export function getGivernyHistory(range?: string) {
  const settings = givernySettings();
  const points = readIndexPoints();
  const asOf = points.at(-1)?.sessionDate ?? nySessionDate();
  const field = settings.currency === "USD" ? "givUsd" : "givCad";
  const selected = range === "1M" || range === "3M" || range === "YTD" || range === "1Y" ? range : settings.chartRange;
  return {
    range: selected,
    currency: settings.currency,
    points: chartSeries(points, selected, asOf, field),
    series: points,
  };
}

export function getGivernyContributors() {
  return liveContributors(readIndexPoints());
}

export function getGivernyFilings() {
  return listFilings().map((filing) => ({
    ...filing,
    holdings: listHoldings(filing.id).map((row) => ({
      cusip: row.cusip,
      ticker: row.ticker,
      issuerName: row.issuerName,
      weight: row.weight,
      value: row.value,
      derivative: row.derivative,
    })),
  }));
}

export function getGivernyValidation(): ValidationReport {
  const filing = latestFiling();
  const holdings = filing ? listHoldings(filing.id) : [];
  const equity = holdings.filter((row) => !row.derivative);
  const mapped = equity.filter((row) => row.ticker);
  const points = readIndexPoints();
  const syntheticMonths = monthlyIndexReturns(points, givernySettings().currency === "USD" ? "givUsd" : "givCad");
  const syntheticMap = new Map(syntheticMonths.map((row) => [row.yearMonth, row.value]));
  const officialMonths: OfficialMonth[] = listOfficialMonths().map((row) => {
    const syntheticReturn = syntheticMap.get(row.yearMonth) ?? null;
    return {
      ...row,
      syntheticReturn,
      gap: syntheticReturn == null ? null : row.officialReturn - syntheticReturn,
    };
  });
  const overlapping = officialMonths.filter((row) => row.syntheticReturn != null && row.gap != null);
  return {
    identity: "synthetic",
    officialNav: false,
    filing,
    mappingCoverage: equity.length ? mapped.length / equity.length : null,
    priceCoverage: points.at(-1)?.coverage ?? null,
    unmapped: equity.filter((row) => !row.ticker).map((row) => ({ cusip: row.cusip, issuerName: row.issuerName })),
    officialMonths,
    trackingError: trackingError(overlapping.map((row) => row.gap as number)),
    cumulativeGap: cumulativeGap(
      overlapping.map((row) => row.officialReturn),
      overlapping.map((row) => row.syntheticReturn as number),
    ),
    lastError: lastGivernyError(),
    lastRefreshAt: lastRefresh("success"),
    providers: readProviderNotes(),
  };
}

export function saveOfficialMonth(
  yearMonth: string,
  officialReturn: number,
  officialNav: number | null,
  note: string | null,
) {
  upsertOfficialMonth(yearMonth, officialReturn, officialNav, note);
}

export function removeOfficialMonth(yearMonth: string) {
  deleteOfficialMonth(yearMonth);
}

export function getGivernyRefreshProgress(): GivernyRefreshProgress {
  return getRefreshProgress();
}

export function startGivernyRefresh(): GivernyRefreshProgress {
  clearRetiredProviderNotes();
  if (listFilings().length === 0) {
    markGivernyError("Aucun 13F importé. Chargez le XML depuis sec.gov dans un navigateur.");
    providerNote("13f", false, "Aucun XML 13F importé.");
    setRefreshProgress({
      running: false,
      stage: "13F",
      detail: "Aucun XML 13F importé.",
      percent: 0,
      error: "Aucun 13F importé. Chargez le XML depuis sec.gov dans un navigateur.",
      finishedAt: new Date().toISOString(),
    });
    return getRefreshProgress();
  }
  if (!refreshInFlight) {
    const startedAt = new Date().toISOString();
    setRefreshProgress({
      running: true,
      stage: "Préparation",
      detail: "Lecture du 13F importé.",
      percent: 5,
      startedAt,
      finishedAt: null,
      error: null,
    });
    refreshInFlight = runGivernyRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return getRefreshProgress();
}

export async function refreshGivernyNow() {
  startGivernyRefresh();
  if (refreshInFlight) await refreshInFlight;
}

async function runGivernyRefresh() {
  manualRefreshProgress = true;
  try {
    markGivernyError(null);
    setRefreshProgress({
      running: true,
      stage: "CUSIP",
      detail: "Appariement OpenFIGI en cours.",
      percent: 12,
    });
    await remapStoredHoldings();
    setRefreshProgress({
      running: true,
      stage: "Cours",
      detail: "Téléchargement des historiques et du change.",
      percent: 25,
    });
    await refreshMarketHistory(usEquitySession() === "closed");
    setRefreshProgress({
      running: true,
      stage: "Indice",
      detail: "Calcul de la série synthétique.",
      percent: 88,
    });
    await recomputeIndex();
    setRefreshProgress({
      running: false,
      stage: "Terminé",
      detail: "CUSIP et cours à jour.",
      percent: 100,
      finishedAt: new Date().toISOString(),
      error: null,
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "L’actualisation a échoué.";
    markGivernyError(message);
    setRefreshProgress({
      running: false,
      stage: "Erreur",
      detail: message,
      percent: 100,
      finishedAt: new Date().toISOString(),
      error: message,
    });
  } finally {
    manualRefreshProgress = false;
  }
}
