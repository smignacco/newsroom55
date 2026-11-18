const CLASS_SHARE = /^([A-Z]{1,5})[./-]([A-Z])$/;

export function padCik(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.padStart(10, "0");
}

export function accessionPath(accession: string): string {
  return accession.replace(/-/g, "");
}

export function normalizeUsTicker(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;
  const compact = trimmed.replace(/\s+/g, "");
  const classShare = compact.match(CLASS_SHARE);
  if (classShare) return `${classShare[1]}.${classShare[2]}`;
  if (/^[A-Z]{1,5}$/.test(compact)) return compact;
  if (/^[A-Z]{1,5}\.[A-Z]$/.test(compact)) return compact;
  return compact.replace(/\//g, ".");
}

export function yahooHistorySymbol(ticker: string): string {
  if (ticker === "SPX" || ticker === "^GSPC" || ticker === "GSPC") return "^GSPC";
  return ticker.replace(/\./g, "-");
}

export function finnhubHistorySymbol(ticker: string): string {
  if (ticker === "SPX" || ticker === "^GSPC" || ticker === "GSPC") return "SPX";
  return ticker;
}

export function twelveHistorySymbol(ticker: string): string {
  if (ticker === "SPX" || ticker === "^GSPC" || ticker === "GSPC") return "GSPC";
  return ticker;
}

export function cboeHistorySymbol(ticker: string): string {
  return ticker.replace(/-/g, ".");
}

export function sessionDateInZone(isoOrDate: Date | string, timeZone: string): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return `${map.year}-${map.month}-${map.day}`;
}

export function nySessionDate(isoOrDate: Date | string = new Date()): string {
  return sessionDateInZone(isoOrDate, "America/New_York");
}

export function yearMonthOf(sessionDate: string): string {
  return sessionDate.slice(0, 7);
}

export function isNyWeekend(sessionDate: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sessionDate);
  if (!match) return true;
  const weekday = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function nyTradingSessions(dates: Iterable<string>): string[] {
  return [...dates].filter((date) => !isNyWeekend(date)).sort();
}

export function quoteTradingSession(asOf: string | null | undefined, today = nySessionDate()): string | null {
  if (!asOf) return null;
  const parsed = Date.parse(asOf);
  if (!Number.isFinite(parsed)) return null;
  const session = nySessionDate(new Date(parsed));
  if (!session || isNyWeekend(session) || session > today) return null;
  return session;
}
