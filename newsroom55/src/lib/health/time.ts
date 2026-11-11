function parts(date: Date, timeZone: string) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    values.find((part) => part.type === type)?.value || "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
  };
}

export function localDate(
  instant: Date | string,
  timeZone = "America/Toronto",
) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime()))
    throw new Error("Horodatage de santé invalide.");
  return parts(date, timeZone).date;
}

export function shiftDate(date: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error("Date locale invalide.");
  const shifted = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days),
  );
  return shifted.toISOString().slice(0, 10);
}

export function sleepNightDate(
  instant: Date | string,
  timeZone = "America/Toronto",
) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime()))
    throw new Error("Horodatage de sommeil invalide.");
  const local = parts(date, timeZone);
  return local.hour < 18 ? shiftDate(local.date, -1) : local.date;
}

export function mondayOfWeek(date: string) {
  const utc = new Date(`${date}T12:00:00Z`);
  const day = utc.getUTCDay();
  return shiftDate(date, -(day === 0 ? 6 : day - 1));
}

export function sevenDayDates(today: string) {
  const monday = mondayOfWeek(today);
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index));
}
