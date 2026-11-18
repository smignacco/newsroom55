import type { HomeAssistantState } from "@/lib/home-assistant/client";
import { measurementValue } from "@/lib/health/metrics";
import { localDate, shiftDate } from "@/lib/health/time";

export const HEALTH_TIMEZONE = "America/Toronto";

export type DailyTotal = {
  value: number;
  sourceUpdatedAt: string;
};

export function activityInstant(state: HomeAssistantState): string | null {
  const raw = state.last_changed || state.last_updated;
  if (!raw) return null;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? null : raw;
}

function stripCarriedForward<T extends { value: number }>(
  samples: T[],
  previous: number | undefined,
): T[] {
  if (previous == null || samples.length === 0) return samples;
  let index = 0;
  while (index < samples.length && samples[index].value === previous) {
    index += 1;
  }
  return samples.slice(index);
}

export function dailyTotalsFromSeries(
  series: HomeAssistantState[],
  metric: "steps" | "exercise_minutes",
  today: string,
  timeZone = HEALTH_TIMEZONE,
): Map<string, DailyTotal> {
  const samples = series
    .flatMap((state) => {
      const at = activityInstant(state);
      if (!at) return [];
      const value = measurementValue(metric, state);
      if (value == null) return [];
      return [{ date: localDate(at, timeZone), at, value }];
    })
    .sort((left, right) => left.at.localeCompare(right.at));

  const byDate = new Map<string, typeof samples>();
  for (const sample of samples) {
    const list = byDate.get(sample.date) ?? [];
    list.push(sample);
    byDate.set(sample.date, list);
  }

  const out = new Map<string, DailyTotal>();
  for (const date of [...byDate.keys()].sort()) {
    if (date > today) continue;
    const previous = out.get(shiftDate(date, -1))?.value;
    const kept = stripCarriedForward(byDate.get(date) ?? [], previous);
    const last = kept.at(-1);
    if (last) out.set(date, { value: last.value, sourceUpdatedAt: last.at });
  }
  return out;
}
