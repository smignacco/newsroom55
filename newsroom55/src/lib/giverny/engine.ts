import {
  GIVERNY_COMPLETE_COVERAGE,
  GIVERNY_INCEPTION_LEVEL,
  GIVERNY_MIN_COVERAGE,
  type Contributor,
  type DailyPoint,
  type FilingBook,
  type GivernyChartRange,
  type GivernyPointStatus,
  type HoldingWeight,
} from "@/lib/giverny/types";
import { yearMonthOf } from "@/lib/giverny/tickers";

export function usablePrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function sessionReturn(previous: number | null | undefined, next: number | null | undefined): number | null {
  if (!usablePrice(previous) || !usablePrice(next)) return null;
  return next / previous - 1;
}

export function compoundReturns(returns: Array<number | null | undefined>): number | null {
  if (returns.length === 0) return null;
  let product = 1;
  for (const value of returns) {
    if (value == null || !Number.isFinite(value)) return null;
    product *= 1 + value;
  }
  return product - 1;
}

export function portfolioSessionReturn(
  weights: HoldingWeight[],
  returns: Map<string, number | null>,
  minCoverage = GIVERNY_MIN_COVERAGE,
): { value: number | null; coverage: number; status: GivernyPointStatus } {
  let total = 0;
  let covered = 0;
  let weighted = 0;
  for (const holding of weights) {
    if (!(holding.weight > 0)) continue;
    total += holding.weight;
    const value = returns.get(holding.ticker);
    if (value == null || !Number.isFinite(value)) continue;
    covered += holding.weight;
    weighted += holding.weight * value;
  }
  const coverage = total > 0 ? covered / total : 0;
  if (covered <= 0 || coverage < minCoverage) {
    return { value: null, coverage, status: "unavailable" };
  }
  return {
    value: weighted / covered,
    coverage,
    status: coverage >= GIVERNY_COMPLETE_COVERAGE ? "ok" : "incomplete",
  };
}

export function driftWeights(
  weights: HoldingWeight[],
  returns: Map<string, number | null>,
): HoldingWeight[] {
  const next = weights.map((holding) => {
    const value = returns.get(holding.ticker);
    if (value == null || !Number.isFinite(value)) return { ...holding };
    return { ...holding, weight: holding.weight * (1 + value) };
  });
  const sum = next.reduce((total, holding) => total + holding.weight, 0);
  if (!(sum > 0)) return weights.map((holding) => ({ ...holding }));
  return next.map((holding) => ({ ...holding, weight: holding.weight / sum }));
}

export function bookAsOf(filings: FilingBook[], sessionDate: string): FilingBook | null {
  const publicFilings = filings
    .filter((filing) => filing.filedOn <= sessionDate && filing.holdings.length > 0)
    .sort((left, right) => {
      if (left.filedOn !== right.filedOn) return left.filedOn.localeCompare(right.filedOn);
      return left.accession.localeCompare(right.accession);
    });
  return publicFilings.at(-1) ?? null;
}

function priceOn(series: Map<string, number>, date: string): number | null {
  const value = series.get(date);
  return usablePrice(value) ? value : null;
}

export function reconstructIndex(input: {
  sessions: string[];
  filings: FilingBook[];
  prices: Map<string, Map<string, number>>;
  fx: Map<string, number>;
  spx: Map<string, number>;
  minCoverage?: number;
}): DailyPoint[] {
  const sessions = [...input.sessions].sort();
  const points: DailyPoint[] = [];
  let weights: HoldingWeight[] = [];
  let accession: string | null = null;
  let givUsd: number | null = null;
  let spxUsd: number | null = null;
  let fx0: number | null = null;
  let previousDate: string | null = null;

  for (const sessionDate of sessions) {
    const book = bookAsOf(input.filings, sessionDate);
    if (!book) {
      points.push(emptyPoint(sessionDate, "unavailable"));
      continue;
    }
    if (book.accession !== accession) {
      weights = book.holdings.map((holding) => ({ ...holding }));
      accession = book.accession;
    }
    if (givUsd == null) {
      const fx = priceOn(input.fx, sessionDate);
      const spx = priceOn(input.spx, sessionDate);
      if (!usablePrice(spx)) {
        points.push(emptyPoint(sessionDate, "unavailable", accession));
        continue;
      }
      givUsd = GIVERNY_INCEPTION_LEVEL;
      spxUsd = GIVERNY_INCEPTION_LEVEL;
      fx0 = fx;
      previousDate = sessionDate;
      points.push({
        sessionDate,
        givUsd,
        givCad: cadLevel(givUsd, fx, fx0),
        givAlpha: GIVERNY_INCEPTION_LEVEL,
        spxUsd,
        spxCad: cadLevel(spxUsd, fx, fx0),
        usdCad: fx,
        dayReturnUsd: null,
        dayReturnCad: null,
        spxReturnUsd: null,
        coverage: 1,
        status: fx == null ? "incomplete" : "ok",
        accession,
      });
      continue;
    }

    const equityReturns = new Map<string, number | null>();
    for (const holding of weights) {
      const previous = input.prices.get(holding.ticker)?.get(previousDate ?? "");
      const current = input.prices.get(holding.ticker)?.get(sessionDate);
      equityReturns.set(holding.ticker, sessionReturn(previous ?? null, current ?? null));
    }
    const portfolio = portfolioSessionReturn(weights, equityReturns, input.minCoverage);
    const spxReturn = sessionReturn(priceOn(input.spx, previousDate ?? ""), priceOn(input.spx, sessionDate));
    const fx = priceOn(input.fx, sessionDate);
    const status: GivernyPointStatus =
      portfolio.value == null || spxReturn == null
        ? "unavailable"
        : portfolio.status === "incomplete"
          ? "incomplete"
          : "ok";

    if (portfolio.value == null || spxUsd == null || spxReturn == null) {
      points.push({
        sessionDate,
        givUsd,
        givCad: cadLevel(givUsd, fx, fx0),
        givAlpha: alphaLevel(givUsd, spxUsd),
        spxUsd,
        spxCad: cadLevel(spxUsd, fx, fx0),
        usdCad: fx,
        dayReturnUsd: null,
        dayReturnCad: null,
        spxReturnUsd: spxReturn,
        coverage: portfolio.coverage,
        status,
        accession,
      });
      previousDate = sessionDate;
      continue;
    }

    givUsd *= 1 + portfolio.value;
    spxUsd *= 1 + spxReturn;
    const givCad = cadLevel(givUsd, fx, fx0);
    const previousCad = points.at(-1)?.givCad ?? null;
    weights = driftWeights(weights, equityReturns);
    points.push({
      sessionDate,
      givUsd,
      givCad,
      givAlpha: alphaLevel(givUsd, spxUsd),
      spxUsd,
      spxCad: cadLevel(spxUsd, fx, fx0),
      usdCad: fx,
      dayReturnUsd: portfolio.value,
      dayReturnCad: sessionReturn(previousCad, givCad),
      spxReturnUsd: spxReturn,
      coverage: portfolio.coverage,
      status,
      accession,
    });
    previousDate = sessionDate;
  }
  return points;
}

function cadLevel(usdLevel: number | null, fx: number | null, fx0: number | null): number | null {
  if (!usablePrice(usdLevel) || !usablePrice(fx) || !usablePrice(fx0)) return null;
  return usdLevel * (fx / fx0);
}

function alphaLevel(givUsd: number | null, spxUsd: number | null): number | null {
  if (!usablePrice(givUsd) || !usablePrice(spxUsd)) return null;
  return (givUsd / spxUsd) * GIVERNY_INCEPTION_LEVEL;
}

function emptyPoint(sessionDate: string, status: GivernyPointStatus, accession: string | null = null): DailyPoint {
  return {
    sessionDate,
    givUsd: null,
    givCad: null,
    givAlpha: null,
    spxUsd: null,
    spxCad: null,
    usdCad: null,
    dayReturnUsd: null,
    dayReturnCad: null,
    spxReturnUsd: null,
    coverage: null,
    status,
    accession,
  };
}

export function contributorsForSession(
  weights: HoldingWeight[],
  returns: Map<string, number | null>,
  names: Map<string, string>,
  limit = 3,
): { up: Contributor[]; down: Contributor[] } {
  const rows: Contributor[] = [];
  for (const holding of weights) {
    const value = returns.get(holding.ticker);
    if (value == null || !Number.isFinite(value)) continue;
    rows.push({
      ticker: holding.ticker,
      name: names.get(holding.ticker) ?? holding.issuerName,
      weight: holding.weight,
      return: value,
      contribution: holding.weight * value,
    });
  }
  const up = [...rows].sort((left, right) => right.contribution - left.contribution).filter((row) => row.contribution > 0).slice(0, limit);
  const down = [...rows].sort((left, right) => left.contribution - right.contribution).filter((row) => row.contribution < 0).slice(0, limit);
  return { up, down };
}

export function windowReturn(points: DailyPoint[], field: "givCad" | "givUsd" | "spxCad" | "spxUsd"): number | null {
  const series = points.map((point) => point[field]).filter(usablePrice);
  if (series.length < 2) return null;
  return sessionReturn(series[0], series[series.length - 1]);
}

export function lastCompletedReturn(points: DailyPoint[], count: number, field: "dayReturnUsd" | "dayReturnCad"): number | null {
  const returns = points
    .map((point) => point[field])
    .filter((value): value is number => value != null && Number.isFinite(value))
    .slice(-count);
  if (returns.length < count) return null;
  return compoundReturns(returns);
}

export function monthToDateReturn(points: DailyPoint[], asOf: string, field: "givCad" | "givUsd"): number | null {
  const month = yearMonthOf(asOf);
  const inMonth = points.filter((point) => yearMonthOf(point.sessionDate) === month && usablePrice(point[field]));
  const prior = [...points]
    .reverse()
    .find((point) => point.sessionDate < (inMonth[0]?.sessionDate ?? asOf) && usablePrice(point[field]));
  const start = prior?.[field] ?? inMonth[0]?.[field] ?? null;
  const end = inMonth.at(-1)?.[field] ?? null;
  return sessionReturn(start, end);
}

export function yearToDateReturn(points: DailyPoint[], asOf: string, field: "givCad" | "givUsd" | "spxCad" | "spxUsd"): number | null {
  const year = asOf.slice(0, 4);
  const inYear = points.filter((point) => point.sessionDate.startsWith(year) && usablePrice(point[field]));
  const prior = [...points]
    .reverse()
    .find((point) => point.sessionDate < `${year}-01-01` && usablePrice(point[field]));
  const start = prior?.[field] ?? inYear[0]?.[field] ?? null;
  const end = inYear.at(-1)?.[field] ?? null;
  return sessionReturn(start, end);
}

export function chartSeries(
  points: DailyPoint[],
  range: GivernyChartRange,
  asOf: string,
  field: "givCad" | "givUsd",
): Array<{ date: string; value: number }> {
  const start = chartStart(range, asOf);
  return points
    .filter((point) => point.sessionDate >= start && usablePrice(point[field]))
    .map((point) => ({ date: point.sessionDate, value: point[field] as number }));
}

function chartStart(range: GivernyChartRange, asOf: string): string {
  if (range === "YTD") return `${asOf.slice(0, 4)}-01-01`;
  const date = new Date(`${asOf}T20:00:00Z`);
  const months = range === "1M" ? 1 : range === "3M" ? 3 : 12;
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

export function monthlyIndexReturns(
  points: DailyPoint[],
  field: "givCad" | "givUsd",
): Array<{ yearMonth: string; value: number }> {
  const byMonth = new Map<string, DailyPoint[]>();
  for (const point of points) {
    if (!usablePrice(point[field])) continue;
    const key = yearMonthOf(point.sessionDate);
    const list = byMonth.get(key) ?? [];
    list.push(point);
    byMonth.set(key, list);
  }
  const months = [...byMonth.keys()].sort();
  const out: Array<{ yearMonth: string; value: number }> = [];
  for (let index = 0; index < months.length; index += 1) {
    const month = months[index];
    const rows = byMonth.get(month) ?? [];
    const end = rows.at(-1)?.[field] ?? null;
    const previousMonth = months[index - 1];
    const start = previousMonth
      ? (byMonth.get(previousMonth)?.at(-1)?.[field] ?? null)
      : (rows[0]?.[field] ?? null);
    const value = sessionReturn(start, end);
    if (value == null) continue;
    out.push({ yearMonth: month, value });
  }
  return out;
}

export function trackingError(gaps: number[]): number | null {
  if (gaps.length < 2) return null;
  const mean = gaps.reduce((sum, value) => sum + value, 0) / gaps.length;
  const variance =
    gaps.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (gaps.length - 1);
  return Math.sqrt(variance);
}

export function cumulativeGap(official: number[], synthetic: number[]): number | null {
  if (official.length === 0 || official.length !== synthetic.length) return null;
  let off = 1;
  let syn = 1;
  for (let index = 0; index < official.length; index += 1) {
    off *= 1 + official[index];
    syn *= 1 + synthetic[index];
  }
  if (!(syn > 0)) return null;
  return off / syn - 1;
}
