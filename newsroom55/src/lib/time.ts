export const TIMEZONE = "America/Montreal";
export const TIMEZONES = [
  "America/Montreal",
  "America/Toronto",
  "America/New_York",
  "America/Vancouver",
  "America/Halifax",
  "UTC",
  "Europe/Paris",
] as const;

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatClock(date: Date, timeZone = TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDateLong(date: Date, timeZone = TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatNewsTime(iso: string | null | undefined, timeZone = TIMEZONE): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function parseRssDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
