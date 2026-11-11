import type { HomeAssistantState } from "@/lib/home-assistant/client";

export const HEALTH_METRICS = [
  "steps",
  "exercise_minutes",
  "active_energy",
  "move_goal",
  "exercise_goal",
  "stand_hours",
  "sleep_duration",
  "in_bed",
  "awake",
  "core_sleep",
  "deep_sleep",
  "rem_sleep",
] as const;

export type HealthMetric = (typeof HEALTH_METRICS)[number];

export const METRIC_LABELS: Record<HealthMetric, string> = {
  steps: "Pas",
  exercise_minutes: "Minutes d’exercice",
  active_energy: "Énergie active",
  move_goal: "Objectif Bouger",
  exercise_goal: "Objectif Exercice",
  stand_hours: "Heures debout",
  sleep_duration: "Durée de sommeil",
  in_bed: "Temps au lit",
  awake: "Temps éveillé",
  core_sleep: "Sommeil léger / Core",
  deep_sleep: "Sommeil profond",
  rem_sleep: "Sommeil REM",
};

const CANDIDATES: Record<HealthMetric, string[]> = {
  steps: ["sensor.health_steps", "sensor.steps", "sensor.step_count"],
  exercise_minutes: ["sensor.exercise_time", "sensor.exercise_minutes"],
  active_energy: ["sensor.active_energy", "sensor.active_energy_burned"],
  move_goal: ["sensor.move_goal"],
  exercise_goal: ["sensor.exercise_goal"],
  stand_hours: ["sensor.stand_hours"],
  sleep_duration: ["sensor.sleep_duration", "sensor.time_asleep"],
  in_bed: ["sensor.in_bed", "sensor.time_in_bed"],
  awake: ["sensor.awake", "sensor.awake_time"],
  core_sleep: ["sensor.core_sleep", "sensor.light_sleep"],
  deep_sleep: ["sensor.deep_sleep"],
  rem_sleep: ["sensor.rem_sleep"],
};

const KEYWORDS: Record<HealthMetric, string[]> = {
  steps: ["step", "pas"],
  exercise_minutes: ["exercise time", "exercise minute", "temps d’exercice"],
  active_energy: ["active energy", "énergie active"],
  move_goal: ["move goal", "objectif bouger"],
  exercise_goal: ["exercise goal", "objectif exercice"],
  stand_hours: ["stand hour", "heure debout"],
  sleep_duration: ["sleep duration", "time asleep", "durée de sommeil"],
  in_bed: ["in bed", "temps au lit"],
  awake: ["awake", "éveillé"],
  core_sleep: ["core sleep", "light sleep", "sommeil léger"],
  deep_sleep: ["deep sleep", "sommeil profond"],
  rem_sleep: ["rem sleep", "sommeil paradoxal"],
};

export type DiscoveredHealthEntity = {
  entityId: string;
  name: string;
  unit: string | null;
  metric: HealthMetric;
  confidence: "exact" | "probable";
};

export function discoverHealthEntities(
  states: HomeAssistantState[],
): DiscoveredHealthEntity[] {
  const discovered: DiscoveredHealthEntity[] = [];
  for (const state of states) {
    const haystack = [
      state.entity_id,
      state.attributes.friendly_name || "",
      state.attributes.device_class || "",
      state.attributes.icon || "",
    ]
      .join(" ")
      .toLocaleLowerCase("fr-CA");
    for (const metric of HEALTH_METRICS) {
      const exact = CANDIDATES[metric].includes(state.entity_id);
      const probable = KEYWORDS[metric].some((keyword) =>
        haystack.includes(keyword),
      );
      if (!exact && !probable) continue;
      discovered.push({
        entityId: state.entity_id,
        name: state.attributes.friendly_name || state.entity_id,
        unit: state.attributes.unit_of_measurement || null,
        metric,
        confidence: exact ? "exact" : "probable",
      });
    }
  }
  return discovered.sort(
    (a, b) =>
      Number(b.confidence === "exact") - Number(a.confidence === "exact") ||
      a.metric.localeCompare(b.metric) ||
      a.name.localeCompare(b.name),
  );
}

function finiteState(state: HomeAssistantState | undefined): number | null {
  if (
    !state ||
    ["unknown", "unavailable", "none", ""].includes(state.state.toLowerCase())
  ) {
    return null;
  }
  const value = Number(state.state.replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizedUnit(state: HomeAssistantState | undefined) {
  return (state?.attributes.unit_of_measurement || "").trim().toLowerCase();
}

export function measurementValue(
  metric: HealthMetric,
  state: HomeAssistantState | undefined,
): number | null {
  const value = finiteState(state);
  if (value == null) return null;
  const unit = normalizedUnit(state);

  if (metric === "steps") {
    return !unit || ["step", "steps", "pas"].includes(unit)
      ? Math.round(value)
      : null;
  }
  if (metric === "active_energy" || metric === "move_goal") {
    if (["kcal", "cal", "calorie", "calories"].includes(unit)) return value;
    if (["kj", "kilojoule", "kilojoules"].includes(unit)) return value / 4.184;
    return null;
  }
  if (metric === "stand_hours") {
    if (
      !unit ||
      ["h", "hr", "hrs", "hour", "hours", "heure", "heures"].includes(unit)
    ) {
      return value;
    }
    return null;
  }
  if (
    metric === "exercise_minutes" ||
    metric === "exercise_goal" ||
    metric === "sleep_duration" ||
    metric === "in_bed" ||
    metric === "awake" ||
    metric === "core_sleep" ||
    metric === "deep_sleep" ||
    metric === "rem_sleep"
  ) {
    if (["min", "mins", "minute", "minutes"].includes(unit)) return value;
    if (["h", "hr", "hrs", "hour", "hours", "heure", "heures"].includes(unit)) {
      return value * 60;
    }
    if (
      ["s", "sec", "second", "seconds", "seconde", "secondes"].includes(unit)
    ) {
      return value / 60;
    }
    return null;
  }
  return null;
}

export function metricCandidates(metric: HealthMetric) {
  return CANDIDATES[metric];
}
