export function formatHealthDuration(minutes: number | null | undefined) {
  if (minutes == null) return "—";
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return hours > 0
    ? `${hours} h ${String(remainder).padStart(2, "0")}`
    : `${remainder} min`;
}
