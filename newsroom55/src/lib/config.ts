import path from "path";

export const TIMEZONE = process.env.TZ || "America/Montreal";

export function dataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data");
}

export function dbPath(): string {
  return path.join(dataDir(), "newsroom.db");
}

export function adminUsername(): string {
  return process.env.ADMIN_USERNAME || "admin";
}

export function adminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD;
  if (!value || value.trim().length < 8) return null;
  return value;
}

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET must be set to a random string of at least 16 characters");
  }
  return secret;
}

export type MarketsProviderName =
  | "finnhub"
  | "twelvedata"
  | "bankofcanada"
  | "cboe"
  | "hybrid";

export function marketsProviderName(): MarketsProviderName {
  const finnhub = Boolean(process.env.FINNHUB_API_KEY);
  const twelve = Boolean(process.env.TWELVE_DATA_API_KEY);
  const preferred = (process.env.MARKETS_PROVIDER || "hybrid").toLowerCase();
  if (preferred === "hybrid") return twelve || finnhub ? "hybrid" : "cboe";
  if (preferred === "cboe") return "cboe";
  if (preferred === "bankofcanada") return "bankofcanada";
  if (preferred === "twelvedata" && twelve) return "twelvedata";
  if (preferred === "finnhub" && finnhub) return "finnhub";
  if (twelve) return "twelvedata";
  if (finnhub) return "finnhub";
  return "cboe";
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function twelveDataRefreshMinutes(): number {
  return boundedInteger(process.env.TWELVE_DATA_REFRESH_MINUTES, 30, 15, 1440);
}

export function twelveDataMaxSymbols(): number {
  return boundedInteger(process.env.TWELVE_DATA_MAX_SYMBOLS, 6, 1, 6);
}

export function marketRefreshIntervalMs(
  provider: ReturnType<typeof marketsProviderName> = marketsProviderName(),
): number {
  if (provider === "twelvedata") return twelveDataRefreshMinutes() * 60_000;
  if (provider === "bankofcanada") return 60 * 60_000;
  if (provider === "finnhub") return 5 * 60_000;
  return 60_000;
}

export const NEWS_INTERVAL_MS = 3 * 60 * 1000;
