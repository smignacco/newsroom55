export const GIVERNY_DEFAULT_CIK = "0001641864";
export const GIVERNY_DEFAULT_FILER = "Giverny Capital Inc.";
export const GIVERNY_BENCHMARK = "SPX";
export const GIVERNY_INCEPTION_LEVEL = 100;
export const GIVERNY_MIN_COVERAGE = 0.85;
export const GIVERNY_COMPLETE_COVERAGE = 0.995;

export type GivernyCurrency = "CAD" | "USD";
export type GivernyChartRange = "1M" | "3M" | "YTD" | "1Y";
export type GivernyHeight = "compact" | "standard" | "tall";
export type BreakingBannerMode = "compact" | "banner" | "off";
export type GivernyPointStatus = "ok" | "delayed" | "incomplete" | "unavailable";
export type GivernyMarketStatus = "open" | "closed" | "delayed" | "unavailable";

export type GivernySettings = {
  enabled: boolean;
  refreshMinutes: number;
  currency: GivernyCurrency;
  benchmark: typeof GIVERNY_BENCHMARK;
  chartRange: GivernyChartRange;
  height: GivernyHeight;
  breakingBanner: BreakingBannerMode;
  cik: string;
  filerName: string;
  contactEmail: string;
};

export type Parsed13FHolding = {
  cusip: string;
  issuerName: string;
  titleOfClass: string | null;
  shares: number;
  value: number;
  shareType: string | null;
  putCall: string | null;
  investmentDiscretion: string | null;
  sole: number | null;
  shared: number | null;
  none: number | null;
  derivative: boolean;
};

export type Parsed13FFiling = {
  accession: string | null;
  cik: string | null;
  filerName: string | null;
  form: string | null;
  periodOfReport: string | null;
  filedAt: string | null;
  acceptedAt: string | null;
  tableEntryTotal: number | null;
  tableValueTotal: number | null;
  holdings: Parsed13FHolding[];
};

export type FilingRecord = {
  id: number;
  accession: string;
  cik: string;
  filerName: string;
  form: string;
  periodOfReport: string;
  filedAt: string;
  acceptedAt: string | null;
  documentUrl: string;
  holdingsCount: number;
  mappedCount: number;
  tableValueTotal: number | null;
};

export type HoldingRecord = {
  filingId: number;
  cusip: string;
  issuerName: string;
  titleOfClass: string | null;
  ticker: string | null;
  shares: number;
  value: number;
  putCall: string | null;
  shareType: string | null;
  derivative: boolean;
  weight: number | null;
};

export type HoldingWeight = {
  ticker: string | null;
  cusip: string;
  issuerName: string;
  weight: number;
  shares: number;
  value: number;
};

export type FilingBook = {
  accession: string;
  filedOn: string;
  periodOfReport: string;
  holdings: HoldingWeight[];
};

export type DailyPoint = {
  sessionDate: string;
  givUsd: number | null;
  givCad: number | null;
  givAlpha: number | null;
  spxUsd: number | null;
  spxCad: number | null;
  usdCad: number | null;
  dayReturnUsd: number | null;
  dayReturnCad: number | null;
  spxReturnUsd: number | null;
  coverage: number | null;
  status: GivernyPointStatus;
  accession: string | null;
};

export type Contributor = {
  ticker: string;
  name: string;
  weight: number;
  return: number;
  contribution: number;
};

export type GivernySummary = {
  identity: "synthetic";
  officialNav: false;
  enabled: boolean;
  currency: GivernyCurrency;
  marketStatus: GivernyMarketStatus;
  marketStatusLabel: string;
  lastRefreshAt: string | null;
  lastCloseAt: string | null;
  lastSuccessfulRefreshAt: string | null;
  coverage: number | null;
  filing: {
    accession: string;
    periodOfReport: string;
    filedAt: string;
    holdings: number;
    mapped: number;
  } | null;
  levels: {
    givCad: number | null;
    givUsd: number | null;
    givAlpha: number | null;
  };
  last: {
    givCad: number | null;
    givUsd: number | null;
    asOf: string | null;
  };
  returns: {
    session: number | null;
    last5: number | null;
    mtd: number | null;
    ytd: number | null;
    vsSpxSession: number | null;
    vsSpxYtd: number | null;
  };
  chart: Array<{ date: string; value: number }>;
  contributors: { up: Contributor[]; down: Contributor[] };
  providerHealth: Array<{ provider: string; ok: boolean; detail: string }>;
  message: string | null;
};

export type OfficialMonth = {
  yearMonth: string;
  officialReturn: number;
  syntheticReturn: number | null;
  gap: number | null;
  note: string | null;
  enteredAt: string;
};

export type ValidationReport = {
  identity: "synthetic";
  officialNav: false;
  filing: FilingRecord | null;
  mappingCoverage: number | null;
  priceCoverage: number | null;
  unmapped: Array<{ cusip: string; issuerName: string }>;
  officialMonths: OfficialMonth[];
  trackingError: number | null;
  cumulativeGap: number | null;
  lastError: string | null;
  lastRefreshAt: string | null;
  providers: Array<{ provider: string; ok: boolean; detail: string }>;
};
