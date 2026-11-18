import { getSetting, setSetting } from "@/lib/database";
import {
  GIVERNY_DEFAULT_CIK,
  GIVERNY_DEFAULT_FILER,
  type BreakingBannerMode,
  type GivernyChartRange,
  type GivernyCurrency,
  type GivernyHeight,
  type GivernySettings,
} from "@/lib/giverny/types";
import { padCik } from "@/lib/giverny/tickers";

function boundedInteger(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function givernySettings(): GivernySettings {
  const currency = getSetting("giverny_currency", "CAD");
  const range = getSetting("giverny_chart_range", "YTD");
  const height = getSetting("giverny_height", "standard");
  const banner = getSetting("giverny_breaking_banner", "compact");
  return {
    enabled: getSetting("giverny_enabled", "on") !== "off",
    refreshMinutes: boundedInteger(getSetting("giverny_refresh_minutes", "15"), 15, 5, 240),
    currency: currency === "USD" ? "USD" : "CAD",
    benchmark: "SPX",
    chartRange: isChartRange(range) ? range : "YTD",
    height: isHeight(height) ? height : "standard",
    breakingBanner: isBanner(banner) ? banner : "compact",
    cik: padCik(getSetting("giverny_cik", GIVERNY_DEFAULT_CIK)),
    filerName: getSetting("giverny_filer_name", GIVERNY_DEFAULT_FILER),
    contactEmail: "",
  };
}

export function givernyBoardLayout() {
  const settings = givernySettings();
  return {
    enabled: settings.enabled,
    height: settings.height,
    breakingBanner: settings.breakingBanner,
  };
}

export function updateGivernySettings(patch: {
  enabled?: boolean;
  refreshMinutes?: number;
  currency?: GivernyCurrency;
  chartRange?: GivernyChartRange;
  height?: GivernyHeight;
  breakingBanner?: BreakingBannerMode;
  cik?: string;
  filerName?: string;
}) {
  if (patch.enabled !== undefined) setSetting("giverny_enabled", patch.enabled ? "on" : "off");
  if (patch.refreshMinutes !== undefined) {
    setSetting("giverny_refresh_minutes", String(boundedInteger(String(patch.refreshMinutes), 15, 5, 240)));
  }
  if (patch.currency) setSetting("giverny_currency", patch.currency);
  if (patch.chartRange) setSetting("giverny_chart_range", patch.chartRange);
  if (patch.height) setSetting("giverny_height", patch.height);
  if (patch.breakingBanner) setSetting("giverny_breaking_banner", patch.breakingBanner);
  if (patch.cik) setSetting("giverny_cik", padCik(patch.cik));
  if (patch.filerName?.trim()) setSetting("giverny_filer_name", patch.filerName.trim());
}

function isChartRange(value: string): value is GivernyChartRange {
  return value === "1M" || value === "3M" || value === "YTD" || value === "1Y";
}

function isHeight(value: string): value is GivernyHeight {
  return value === "compact" || value === "standard" || value === "tall";
}

function isBanner(value: string): value is BreakingBannerMode {
  return value === "compact" || value === "banner" || value === "off";
}
