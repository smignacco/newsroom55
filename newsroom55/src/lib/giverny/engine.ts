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
import {
  lastNyTradingSessionOfMonth,
  normalizeSessionDate,
  normalizeYearMonth,
  nySessionDate,
  yearMonthOf,
} from "@/lib/giverny/tickers";

export function usablePrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function asPositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function pointCoverage(point: DailyPoint): number {
  const coerced = asPositiveNumber(point.coverage);
  if (coerced != null) return coerced;
  const parsed = Number(point.coverage);
  return Number.isFinite(parsed) ? parsed : 0;
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

function mappedTicker(holding: HoldingWeight): string | null {
  return holding.ticker || null;
}

export function tickerCoverage(weights: HoldingWeight[]): number {
  let total = 0;
  let mapped = 0;
  for (const holding of weights) {
    if (!(holding.weight > 0)) continue;
    total += holding.weight;
    if (mappedTicker(holding)) mapped += holding.weight;
  }
  return total > 0 ? mapped / total : 0;
}

function holdingReturn(holding: HoldingWeight, returns: Map<string, number | null>): number | null {
  const ticker = mappedTicker(holding);
  if (!ticker) return null;
  const value = returns.get(ticker);
  return value == null || !Number.isFinite(value) ? null : value;
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
    const value = holdingReturn(holding, returns);
    if (value == null) continue;
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
    const value = holdingReturn(holding, returns);
    if (value == null) return { ...holding };
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
  let previousSpxDate: string | null = null;

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
      const mappedShare = tickerCoverage(weights);
      if (mappedShare < GIVERNY_MIN_COVERAGE) {
        points.push({
          ...emptyPoint(sessionDate, "unavailable", accession),
          coverage: mappedShare,
          usdCad: fx,
        });
        continue;
      }
      givUsd = GIVERNY_INCEPTION_LEVEL;
      spxUsd = usablePrice(spx) ? GIVERNY_INCEPTION_LEVEL : null;
      fx0 = fx;
      previousDate = sessionDate;
      previousSpxDate = usablePrice(spx) ? sessionDate : null;
      points.push({
        sessionDate,
        givUsd,
        givCad: cadLevel(givUsd, fx, fx0),
        givAlpha: usablePrice(spxUsd) ? GIVERNY_INCEPTION_LEVEL : null,
        spxUsd,
        spxCad: cadLevel(spxUsd, fx, fx0),
        usdCad: fx,
        dayReturnUsd: null,
        dayReturnCad: null,
        spxReturnUsd: null,
        coverage: mappedShare,
        status: fx == null || spxUsd == null ? "incomplete" : "ok",
        accession,
      });
      continue;
    }

    const equityReturns = new Map<string, number | null>();
    for (const holding of weights) {
      const ticker = mappedTicker(holding);
      if (!ticker) continue;
      const previous = input.prices.get(ticker)?.get(previousDate ?? "");
      const current = input.prices.get(ticker)?.get(sessionDate);
      equityReturns.set(ticker, sessionReturn(previous ?? null, current ?? null));
    }
    const portfolio = portfolioSessionReturn(weights, equityReturns, input.minCoverage);
    const currentSpx = priceOn(input.spx, sessionDate);
    const spxReturn = sessionReturn(priceOn(input.spx, previousSpxDate ?? ""), currentSpx);
    const fx = priceOn(input.fx, sessionDate);

    if (portfolio.value == null) {
      points.push({
        sessionDate,
        givUsd,
        givCad: cadLevel(givUsd, fx, fx0),
        givAlpha: currentSpx != null ? alphaLevel(givUsd, spxUsd) : null,
        spxUsd,
        spxCad: cadLevel(spxUsd, fx, fx0),
        usdCad: fx,
        dayReturnUsd: null,
        dayReturnCad: null,
        spxReturnUsd: spxReturn,
        coverage: portfolio.coverage,
        status: "unavailable",
        accession,
      });
      continue;
    }

    givUsd *= 1 + portfolio.value;
    let givAlpha: number | null = null;
    if (spxUsd != null && spxReturn != null) {
      spxUsd *= 1 + spxReturn;
      previousSpxDate = sessionDate;
      givAlpha = alphaLevel(givUsd, spxUsd);
    }
    const givCad = cadLevel(givUsd, fx, fx0);
    const previousCad = points.at(-1)?.givCad ?? null;
    weights = driftWeights(weights, equityReturns);
    const status: GivernyPointStatus =
      spxReturn == null || fx == null
        ? "incomplete"
        : portfolio.status === "incomplete"
          ? "incomplete"
          : "ok";
    points.push({
      sessionDate,
      givUsd,
      givCad,
      givAlpha,
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
    const ticker = mappedTicker(holding);
    const value = holdingReturn(holding, returns);
    if (!ticker || value == null) continue;
    rows.push({
      ticker,
      name: names.get(ticker) ?? holding.issuerName,
      weight: holding.weight,
      return: value,
      contribution: holding.weight * value,
    });
  }
  const up = [...rows].sort((left, right) => right.contribution - left.contribution).filter((row) => row.contribution > 0).slice(0, limit);
  const down = [...rows].sort((left, right) => left.contribution - right.contribution).filter((row) => row.contribution < 0).slice(0, limit);
  return { up, down };
}

export function latestDisplayPoint(
  points: DailyPoint[],
  field: "givCad" | "givUsd",
  minCoverage = GIVERNY_MIN_COVERAGE,
): DailyPoint | null {
  const latest = points.at(-1);
  if (!latest) return null;
  if ((latest.coverage ?? 0) >= minCoverage && usablePrice(latest[field])) return latest;
  if ((latest.coverage ?? 0) < minCoverage) return null;
  for (let index = points.length - 2; index >= 0; index -= 1) {
    const point = points[index];
    if ((point.coverage ?? 0) >= minCoverage && usablePrice(point[field])) return point;
  }
  return null;
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

export type OfficialNavAnchor = {
  yearMonth: string;
  officialNav: number;
};

export type NavEstimatePoint = {
  date: string;
  value: number;
  officialMonth: string;
  officialNav: number;
  anchorDate: string;
};

function usableNavAnchorPoint(point: DailyPoint | undefined, minCoverage: number): point is DailyPoint {
  return Boolean(
    point &&
      pointCoverage(point) >= minCoverage &&
      asPositiveNumber(point.givCad) != null,
  );
}

export function officialNavEstimate(
  points: DailyPoint[],
  anchors: OfficialNavAnchor[],
  minCoverage = GIVERNY_MIN_COVERAGE,
  today = nySessionDate(),
): NavEstimatePoint[] {
  const dated = points.flatMap((point) => {
    const sessionDate = normalizeSessionDate(point.sessionDate);
    return sessionDate ? [{ ...point, sessionDate }] : [];
  });
  const byDate = new Map(dated.map((point) => [point.sessionDate, point]));
  const chronological = [...dated].sort((left, right) => left.sessionDate.localeCompare(right.sessionDate));
  const asOfDay = normalizeSessionDate(today) ?? nySessionDate();
  const resolved = anchors
    .flatMap((anchor) => {
      const yearMonth = normalizeYearMonth(anchor.yearMonth);
      const nav = asPositiveNumber(anchor.officialNav);
      const monthEndDate = yearMonth ? lastNyTradingSessionOfMonth(yearMonth) : null;
      if (!yearMonth || !nav || !monthEndDate) return [];
      const monthEnd = byDate.get(monthEndDate);
      const monthInProgress = asOfDay < monthEndDate;
      const later = chronological.find(
        (point) =>
          (monthInProgress
            ? point.sessionDate >= `${yearMonth}-01`
            : point.sessionDate > monthEndDate) && usableNavAnchorPoint(point, minCoverage),
      );
      const chosen = usableNavAnchorPoint(monthEnd, minCoverage) ? monthEnd : later;
      const index = chosen ? asPositiveNumber(chosen.givCad) : null;
      if (!chosen || !index) return [];
      return [
        {
          yearMonth,
          asOf: chosen.sessionDate,
          nav,
          index,
        },
      ];
    })
    .sort((left, right) => left.asOf.localeCompare(right.asOf));
  if (resolved.length === 0) return [];

  const out: NavEstimatePoint[] = [];
  for (const point of dated) {
    const givCad = asPositiveNumber(point.givCad);
    if (pointCoverage(point) < minCoverage || givCad == null) continue;
    let chosen: (typeof resolved)[number] | null = null;
    for (const anchor of resolved) {
      if (anchor.asOf <= point.sessionDate) chosen = anchor;
    }
    if (!chosen || !(chosen.index > 0)) continue;
    out.push({
      date: point.sessionDate,
      value: givCad * (chosen.nav / chosen.index),
      officialMonth: chosen.yearMonth,
      officialNav: chosen.nav,
      anchorDate: chosen.asOf,
    });
  }
  return out;
}
