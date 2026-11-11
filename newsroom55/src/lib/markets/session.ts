import { TIMEZONE } from "@/lib/time";

function partsInZone(timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return { weekday: map.weekday, minutes: Number(map.hour) * 60 + Number(map.minute) };
}

export function usEquitySession(): "open" | "closed" | "weekend" {
  const { weekday, minutes } = partsInZone("America/New_York");
  if (weekday === "Sat" || weekday === "Sun") return "weekend";
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return "open";
  return "closed";
}

export function tsxSession(): "open" | "closed" | "weekend" {
  const { weekday, minutes } = partsInZone(TIMEZONE);
  if (weekday === "Sat" || weekday === "Sun") return "weekend";
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return "open";
  return "closed";
}
