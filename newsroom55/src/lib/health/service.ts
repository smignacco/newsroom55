import { getDb, getSetting, setSetting } from "@/lib/database";
import {
  HomeAssistantClient,
  homeAssistantConfigured,
  type HomeAssistantReader,
  type HomeAssistantState,
} from "@/lib/home-assistant/client";
import {
  HEALTH_METRICS,
  METRIC_LABELS,
  discoverHealthEntities,
  measurementValue,
  type DiscoveredHealthEntity,
  type HealthMetric,
} from "@/lib/health/metrics";
import {
  activityInstant,
  dailyTotalsFromSeries,
  nightlySleepFromSeries,
  HEALTH_TIMEZONE,
} from "@/lib/health/daily";
import {
  localDate,
  mondayOfWeek,
  sevenDayDates,
  shiftDate,
  sleepNightDate,
  weekdayLabel,
} from "@/lib/health/time";

const TIMEZONE = HEALTH_TIMEZONE;

export type HealthMapping = {
  metric: HealthMetric;
  entityId: string;
  unit: string | null;
};

export type PulseSnapshot = {
  generatedAt: string;
  lastSyncAt: string | null;
  stale: boolean;
  privacyMode: boolean;
  activity: {
    date: string;
    steps: number | null;
    exerciseMinutes: number | null;
    activeEnergyKcal: number | null;
    dailyStepsGoal: number | null;
    dailyExerciseGoal: number | null;
    weeklyExerciseMinutes: number | null;
    weeklyGoalMinutes: number | null;
    activeDays: number;
    days: {
      date: string;
      label: string;
      minutes: number | null;
      status: "recorded" | "missing" | "future";
    }[];
  };
  sleep: {
    lastNight: {
      nightDate: string;
      totalMinutes: number;
      inBedMinutes: number | null;
      awakeMinutes: number | null;
      coreMinutes: number | null;
      deepMinutes: number | null;
      remMinutes: number | null;
      sourceUpdatedAt: string;
    } | null;
    averageMinutes: number | null;
    nightsUsed: number;
    incompleteHistory: boolean;
    targetMinutes: number | null;
    showAverage: boolean;
    showPhases: boolean;
    trend: { nightDate: string; totalMinutes: number }[];
  };
};

function optionalNumber(key: string) {
  const value = getSetting(key, "").trim();
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function healthSettings() {
  const envEnabled = ["1", "true", "yes", "on"].includes(
    (process.env.ACTIVITY_PULSE_ENABLED || "").toLowerCase(),
  );
  return {
    enabled:
      getSetting("health_pulse_enabled", envEnabled ? "on" : "off") === "on",
    privacyMode: getSetting("health_privacy_mode", "off") === "on",
    dailyExerciseGoal: optionalNumber("health_daily_exercise_goal"),
    dailyStepsGoal: optionalNumber("health_daily_steps_goal"),
    weeklyActivityGoal: optionalNumber("health_weekly_activity_goal"),
    sleepTargetMinutes: optionalNumber("health_sleep_target_minutes"),
    showAverage: getSetting("health_show_weekly_average", "on") === "on",
    showPhases: getSetting("health_show_sleep_phases", "off") === "on",
    showActiveEnergy: getSetting("health_show_active_energy", "on") === "on",
  };
}

export function updateHealthSettings(input: {
  enabled?: boolean;
  privacyMode?: boolean;
  dailyExerciseGoal?: number | null;
  dailyStepsGoal?: number | null;
  weeklyActivityGoal?: number | null;
  sleepTargetMinutes?: number | null;
  showAverage?: boolean;
  showPhases?: boolean;
  showActiveEnergy?: boolean;
}) {
  const values: Record<string, string> = {};
  if (input.enabled !== undefined)
    values.health_pulse_enabled = input.enabled ? "on" : "off";
  if (input.privacyMode !== undefined)
    values.health_privacy_mode = input.privacyMode ? "on" : "off";
  if (input.showAverage !== undefined)
    values.health_show_weekly_average = input.showAverage ? "on" : "off";
  if (input.showPhases !== undefined)
    values.health_show_sleep_phases = input.showPhases ? "on" : "off";
  if (input.showActiveEnergy !== undefined)
    values.health_show_active_energy = input.showActiveEnergy ? "on" : "off";
  for (const [inputKey, settingKey] of [
    ["dailyExerciseGoal", "health_daily_exercise_goal"],
    ["dailyStepsGoal", "health_daily_steps_goal"],
    ["weeklyActivityGoal", "health_weekly_activity_goal"],
    ["sleepTargetMinutes", "health_sleep_target_minutes"],
  ] as const) {
    if (input[inputKey] !== undefined) {
      values[settingKey] =
        input[inputKey] == null ? "" : String(input[inputKey]);
    }
  }
  for (const [key, value] of Object.entries(values)) setSetting(key, value);
  return healthSettings();
}

export function readHealthMappings(): HealthMapping[] {
  return getDb()
    .prepare(
      `SELECT metric, entity_id as entityId, unit
       FROM health_sensor_mappings ORDER BY metric`,
    )
    .all() as HealthMapping[];
}

export function saveHealthMappings(
  mappings: Partial<Record<HealthMetric, string | null>>,
) {
  const database = getDb();
  const upsert = database.prepare(
    `INSERT INTO health_sensor_mappings (metric, entity_id, unit, updated_at)
     VALUES (?, ?, NULL, ?)
     ON CONFLICT(metric) DO UPDATE SET
       entity_id = excluded.entity_id,
       updated_at = excluded.updated_at`,
  );
  const remove = database.prepare(
    "DELETE FROM health_sensor_mappings WHERE metric = ?",
  );
  const now = new Date().toISOString();
  const transaction = database.transaction(() => {
    for (const metric of HEALTH_METRICS) {
      if (!(metric in mappings)) continue;
      const entityId = mappings[metric]?.trim();
      if (!entityId) remove.run(metric);
      else upsert.run(metric, entityId, now);
    }
  });
  transaction();
  return readHealthMappings();
}

function stateMap(states: HomeAssistantState[], mappings: HealthMapping[]) {
  const byEntity = new Map(states.map((state) => [state.entity_id, state]));
  return new Map(
    mappings.map((mapping) => [mapping.metric, byEntity.get(mapping.entityId)]),
  ) as Map<HealthMetric, HomeAssistantState | undefined>;
}

function dateForState(state: HomeAssistantState | undefined) {
  const instant = state ? activityInstant(state) : null;
  if (!instant) return null;
  try {
    return localDate(instant, TIMEZONE);
  } catch {
    return null;
  }
}

const LIVE_ACTIVITY_FIELDS = [
  ["steps", "steps"],
  ["exercise_minutes", "exerciseMinutes"],
  ["active_energy", "activeEnergyKcal"],
  ["move_goal", "moveGoalKcal"],
  ["exercise_goal", "exerciseGoalMinutes"],
  ["stand_hours", "standHours"],
] as const;

function upsertActivity(
  date: string,
  values: {
    steps?: number | null;
    exerciseMinutes?: number | null;
    activeEnergyKcal?: number | null;
    moveGoalKcal?: number | null;
    exerciseGoalMinutes?: number | null;
    standHours?: number | null;
    sourceUpdatedAt?: string | null;
  },
  syncedAt: string,
) {
  getDb()
    .prepare(
      `INSERT INTO activity_daily_totals (
        activity_date, timezone, steps, exercise_minutes, active_energy_kcal,
        move_goal_kcal, exercise_goal_minutes, stand_hours, source_updated_at, synced_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(activity_date) DO UPDATE SET
        steps = COALESCE(excluded.steps, activity_daily_totals.steps),
        exercise_minutes = COALESCE(excluded.exercise_minutes, activity_daily_totals.exercise_minutes),
        active_energy_kcal = COALESCE(excluded.active_energy_kcal, activity_daily_totals.active_energy_kcal),
        move_goal_kcal = COALESCE(excluded.move_goal_kcal, activity_daily_totals.move_goal_kcal),
        exercise_goal_minutes = COALESCE(excluded.exercise_goal_minutes, activity_daily_totals.exercise_goal_minutes),
        stand_hours = COALESCE(excluded.stand_hours, activity_daily_totals.stand_hours),
        source_updated_at = COALESCE(excluded.source_updated_at, activity_daily_totals.source_updated_at),
        synced_at = excluded.synced_at`,
    )
    .run(
      date,
      TIMEZONE,
      values.steps ?? null,
      values.exerciseMinutes ?? null,
      values.activeEnergyKcal ?? null,
      values.moveGoalKcal ?? null,
      values.exerciseGoalMinutes ?? null,
      values.standHours ?? null,
      values.sourceUpdatedAt ?? null,
      syncedAt,
    );
}

function upsertSleep(
  nightDate: string,
  totalMinutes: number,
  values: {
    inBedMinutes?: number | null;
    awakeMinutes?: number | null;
    coreMinutes?: number | null;
    deepMinutes?: number | null;
    remMinutes?: number | null;
    sourceUpdatedAt: string;
  },
  syncedAt: string,
) {
  getDb()
    .prepare(
      `INSERT INTO sleep_nightly_totals (
        night_date, timezone, total_minutes, in_bed_minutes, awake_minutes,
        core_minutes, deep_minutes, rem_minutes, source_updated_at, synced_at, reliable
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(night_date) DO UPDATE SET
        total_minutes = CASE
          WHEN excluded.source_updated_at > sleep_nightly_totals.source_updated_at
            THEN excluded.total_minutes
          WHEN excluded.source_updated_at = sleep_nightly_totals.source_updated_at
            AND excluded.total_minutes > sleep_nightly_totals.total_minutes
            THEN excluded.total_minutes
          ELSE sleep_nightly_totals.total_minutes
        END,
        in_bed_minutes = CASE
          WHEN excluded.source_updated_at >= sleep_nightly_totals.source_updated_at
            THEN COALESCE(excluded.in_bed_minutes, sleep_nightly_totals.in_bed_minutes)
          ELSE sleep_nightly_totals.in_bed_minutes
        END,
        awake_minutes = CASE
          WHEN excluded.source_updated_at >= sleep_nightly_totals.source_updated_at
            THEN COALESCE(excluded.awake_minutes, sleep_nightly_totals.awake_minutes)
          ELSE sleep_nightly_totals.awake_minutes
        END,
        core_minutes = CASE
          WHEN excluded.source_updated_at >= sleep_nightly_totals.source_updated_at
            THEN COALESCE(excluded.core_minutes, sleep_nightly_totals.core_minutes)
          ELSE sleep_nightly_totals.core_minutes
        END,
        deep_minutes = CASE
          WHEN excluded.source_updated_at >= sleep_nightly_totals.source_updated_at
            THEN COALESCE(excluded.deep_minutes, sleep_nightly_totals.deep_minutes)
          ELSE sleep_nightly_totals.deep_minutes
        END,
        rem_minutes = CASE
          WHEN excluded.source_updated_at >= sleep_nightly_totals.source_updated_at
            THEN COALESCE(excluded.rem_minutes, sleep_nightly_totals.rem_minutes)
          ELSE sleep_nightly_totals.rem_minutes
        END,
        source_updated_at = CASE
          WHEN excluded.source_updated_at > sleep_nightly_totals.source_updated_at
            THEN excluded.source_updated_at
          ELSE sleep_nightly_totals.source_updated_at
        END,
        synced_at = excluded.synced_at,
        reliable = 1`,
    )
    .run(
      nightDate,
      TIMEZONE,
      totalMinutes,
      values.inBedMinutes ?? null,
      values.awakeMinutes ?? null,
      values.coreMinutes ?? null,
      values.deepMinutes ?? null,
      values.remMinutes ?? null,
      values.sourceUpdatedAt,
      syncedAt,
    );
}

function historySeriesMap(history: HomeAssistantState[][]) {
  const map = new Map<string, HomeAssistantState[]>();
  for (const series of history) {
    const entityId = series.find((state) => state.entity_id)?.entity_id;
    if (entityId) map.set(entityId, series);
  }
  return map;
}

async function syncRecorderHistory(
  reader: HomeAssistantReader,
  mappings: HealthMapping[],
  syncedAt: string,
  today: string,
) {
  const relevant = mappings.filter((mapping) =>
    ["steps", "exercise_minutes", "sleep_duration"].includes(mapping.metric),
  );
  if (relevant.length === 0) return;
  const start = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const end = new Date().toISOString();
  let history: HomeAssistantState[][];
  try {
    history = await reader.getHistory(
      relevant.map((mapping) => mapping.entityId),
      start,
      end,
    );
  } catch {
    return;
  }
  const byEntity = historySeriesMap(history);
  for (const mapping of relevant) {
    const series = (byEntity.get(mapping.entityId) || [])
      .slice()
      .filter((state) => activityInstant(state));
    if (mapping.metric === "sleep_duration") {
      for (const [nightDate, point] of nightlySleepFromSeries(
        series,
        TIMEZONE,
      )) {
        upsertSleep(
          nightDate,
          point.value,
          { sourceUpdatedAt: point.sourceUpdatedAt },
          syncedAt,
        );
      }
      continue;
    }
    if (mapping.metric !== "steps" && mapping.metric !== "exercise_minutes") {
      continue;
    }
    const totals = dailyTotalsFromSeries(
      series,
      mapping.metric,
      today,
      TIMEZONE,
    );
    for (const [date, point] of totals) {
      upsertActivity(
        date,
        mapping.metric === "steps"
          ? { steps: point.value, sourceUpdatedAt: point.sourceUpdatedAt }
          : {
              exerciseMinutes: point.value,
              sourceUpdatedAt: point.sourceUpdatedAt,
            },
        syncedAt,
      );
    }
  }
}

function retractCarriedDailyTotals(
  today: string,
  live: { steps: boolean; exerciseMinutes: boolean },
) {
  const yesterday = shiftDate(today, -1);
  const rows = getDb()
    .prepare(
      `SELECT activity_date, steps, exercise_minutes
       FROM activity_daily_totals WHERE activity_date IN (?, ?)`,
    )
    .all(yesterday, today) as Array<{
    activity_date: string;
    steps: number | null;
    exercise_minutes: number | null;
  }>;
  const byDate = new Map(rows.map((row) => [row.activity_date, row]));
  const previous = byDate.get(yesterday);
  const current = byDate.get(today);
  if (!current) return;
  const steps =
    !live.steps &&
    current.steps != null &&
    previous?.steps != null &&
    current.steps === previous.steps
      ? null
      : current.steps;
  const exerciseMinutes =
    !live.exerciseMinutes &&
    current.exercise_minutes != null &&
    previous?.exercise_minutes != null &&
    current.exercise_minutes === previous.exercise_minutes
      ? null
      : current.exercise_minutes;
  if (steps === current.steps && exerciseMinutes === current.exercise_minutes) {
    return;
  }
  getDb()
    .prepare(
      `UPDATE activity_daily_totals
       SET steps = ?, exercise_minutes = ?
       WHERE activity_date = ?`,
    )
    .run(steps, exerciseMinutes, today);
}

let healthSyncInFlight: Promise<PulseSnapshot> | null = null;
let healthSyncIncludesHistory = false;

async function performHealthSync(
  reader: HomeAssistantReader,
  options: { history?: boolean } = {},
) {
  const database = getDb();
  const attemptAt = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO health_sync_state (id, last_attempt_at)
       VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET last_attempt_at = excluded.last_attempt_at`,
    )
    .run(attemptAt);

  try {
    const mappings = readHealthMappings();
    const states = await reader.getStates();
    const mapped = stateMap(states, mappings);
    const syncedAt = new Date().toISOString();
    const today = localDate(syncedAt, TIMEZONE);
    const activityByDate = new Map<
      string,
      {
        steps?: number | null;
        exerciseMinutes?: number | null;
        activeEnergyKcal?: number | null;
        moveGoalKcal?: number | null;
        exerciseGoalMinutes?: number | null;
        standHours?: number | null;
        sourceUpdatedAt?: string | null;
      }
    >();
    const liveToday = { steps: false, exerciseMinutes: false };
    for (const [metric, field] of LIVE_ACTIVITY_FIELDS) {
      const state = mapped.get(metric);
      const date = dateForState(state);
      if (!state || !date || date > today) continue;
      const value = measurementValue(metric, state);
      if (value == null) continue;
      const row = activityByDate.get(date) ?? {};
      row[field] = value;
      row.sourceUpdatedAt = activityInstant(state);
      activityByDate.set(date, row);
      if (date === today && (field === "steps" || field === "exerciseMinutes")) {
        liveToday[field] = true;
      }
    }
    if (options.history !== false) {
      await syncRecorderHistory(reader, mappings, syncedAt, today);
    }

    const totalState = mapped.get("sleep_duration");
    const totalMinutes = measurementValue("sleep_duration", totalState);
    const sleepInstant = totalState ? activityInstant(totalState) : null;
    if (sleepInstant && totalMinutes != null && totalMinutes > 0) {
      upsertSleep(
        sleepNightDate(sleepInstant, TIMEZONE),
        totalMinutes,
        {
          inBedMinutes: measurementValue("in_bed", mapped.get("in_bed")),
          awakeMinutes: measurementValue("awake", mapped.get("awake")),
          coreMinutes: measurementValue("core_sleep", mapped.get("core_sleep")),
          deepMinutes: measurementValue("deep_sleep", mapped.get("deep_sleep")),
          remMinutes: measurementValue("rem_sleep", mapped.get("rem_sleep")),
          sourceUpdatedAt: sleepInstant,
        },
        syncedAt,
      );
    }

    for (const [date, values] of activityByDate) {
      upsertActivity(date, values, syncedAt);
    }
    retractCarriedDailyTotals(today, liveToday);
    database
      .prepare(
        `INSERT INTO health_sync_state (id, last_attempt_at, last_success_at, last_error)
         VALUES (1, ?, ?, NULL)
         ON CONFLICT(id) DO UPDATE SET
           last_attempt_at = excluded.last_attempt_at,
           last_success_at = excluded.last_success_at,
           last_error = NULL`,
      )
      .run(attemptAt, syncedAt);
    return getPulseSnapshot();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Synchronisation impossible";
    database
      .prepare(
        `INSERT INTO health_sync_state (id, last_attempt_at, last_error)
         VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           last_attempt_at = excluded.last_attempt_at,
           last_error = excluded.last_error`,
      )
      .run(attemptAt, message.slice(0, 500));
    throw error;
  }
}

export function syncHealthData(
  reader?: HomeAssistantReader,
  options: { history?: boolean } = {},
) {
  const wantHistory = options.history !== false;
  const client = reader ?? new HomeAssistantClient();
  if (healthSyncInFlight && (healthSyncIncludesHistory || !wantHistory)) {
    return healthSyncInFlight;
  }
  const start = () => {
    healthSyncIncludesHistory = wantHistory;
    healthSyncInFlight = performHealthSync(client, { history: wantHistory }).finally(
      () => {
        healthSyncInFlight = null;
        healthSyncIncludesHistory = false;
      },
    );
    return healthSyncInFlight;
  };
  if (healthSyncInFlight) {
    return healthSyncInFlight.then(() => start());
  }
  return start();
}

export const HEALTH_LIVE_MIN_INTERVAL_MS = 10_000;
export const HEALTH_STALE_AFTER_MS = 2 * 60 * 1000;
export const HEALTH_HISTORY_INTERVAL_MS = 5 * 60 * 1000;
export const HEALTH_SYNC_MIN_SECONDS = 15;
export const HEALTH_SYNC_DEFAULT_SECONDS = 15;

export async function refreshPulseLive() {
  if (!pulseEnabled() || !homeAssistantConfigured()) {
    return getPulseSnapshot();
  }
  const sync = getDb()
    .prepare("SELECT last_success_at FROM health_sync_state WHERE id = 1")
    .get() as { last_success_at: string | null } | undefined;
  const last = sync?.last_success_at
    ? new Date(sync.last_success_at).getTime()
    : 0;
  if (last && Date.now() - last < HEALTH_LIVE_MIN_INTERVAL_MS) {
    return getPulseSnapshot();
  }
  try {
    return await syncHealthData(undefined, { history: false });
  } catch {
    return getPulseSnapshot();
  }
}

export async function discoverHealthSensors(
  reader: HomeAssistantReader = new HomeAssistantClient(),
) {
  const states = await reader.getStates();
  const discovered = discoverHealthEntities(states);
  getDb()
    .prepare(
      `INSERT INTO health_sync_state (id, last_discovery_at, discovered_entities)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         last_discovery_at = excluded.last_discovery_at,
         discovered_entities = excluded.discovered_entities`,
    )
    .run(new Date().toISOString(), JSON.stringify(discovered));
  return discovered;
}

export async function testHomeAssistantConnection(
  reader: HomeAssistantReader = new HomeAssistantClient(),
) {
  return reader.testConnection();
}

type ActivityRow = {
  activity_date: string;
  steps: number | null;
  exercise_minutes: number | null;
  active_energy_kcal: number | null;
  exercise_goal_minutes: number | null;
  source_updated_at: string | null;
};

type SleepRow = {
  night_date: string;
  total_minutes: number;
  in_bed_minutes: number | null;
  awake_minutes: number | null;
  core_minutes: number | null;
  deep_minutes: number | null;
  rem_minutes: number | null;
  source_updated_at: string;
};

export function getPulseSnapshot(now = new Date()): PulseSnapshot {
  const settings = healthSettings();
  const today = localDate(now, TIMEZONE);
  const weekDates = sevenDayDates(today);
  const activityRows = getDb()
    .prepare(
      `SELECT activity_date, steps, exercise_minutes, active_energy_kcal,
              exercise_goal_minutes, source_updated_at
       FROM activity_daily_totals
       WHERE activity_date BETWEEN ? AND ?`,
    )
    .all(weekDates[0], weekDates[6]) as ActivityRow[];
  const activityByDate = new Map(
    activityRows.map((row) => [row.activity_date, row]),
  );
  const todayActivity = activityByDate.get(today);
  const days = weekDates.map((date) => {
    const row = activityByDate.get(date);
    return {
      date,
      label: weekdayLabel(date),
      minutes: row?.exercise_minutes ?? null,
      status: (date > today ? "future" : row ? "recorded" : "missing") as
        "recorded" | "missing" | "future",
    };
  });
  const recordedMinutes = days.flatMap((day) =>
    day.status === "recorded" && day.minutes != null ? [day.minutes] : [],
  );

  const sleepRows = getDb()
    .prepare(
      `SELECT night_date, total_minutes, in_bed_minutes, awake_minutes,
              core_minutes, deep_minutes, rem_minutes, source_updated_at
       FROM sleep_nightly_totals
       WHERE reliable = 1
       ORDER BY night_date DESC LIMIT 7`,
    )
    .all() as SleepRow[];
  const lastNight = sleepRows[0] || null;
  const averageMinutes =
    sleepRows.length > 0
      ? sleepRows.reduce((sum, row) => sum + row.total_minutes, 0) /
        sleepRows.length
      : null;
  const sync = getDb()
    .prepare("SELECT last_success_at FROM health_sync_state WHERE id = 1")
    .get() as { last_success_at: string | null } | undefined;
  const lastSyncAt = sync?.last_success_at || null;
  const stale =
    !lastSyncAt ||
    now.getTime() - new Date(lastSyncAt).getTime() > HEALTH_STALE_AFTER_MS;

  return {
    generatedAt: now.toISOString(),
    lastSyncAt,
    stale,
    privacyMode: settings.privacyMode,
    activity: {
      date: today,
      steps: todayActivity?.steps ?? null,
      exerciseMinutes: todayActivity?.exercise_minutes ?? null,
      activeEnergyKcal: settings.showActiveEnergy
        ? (todayActivity?.active_energy_kcal ?? null)
        : null,
      dailyStepsGoal: settings.dailyStepsGoal,
      dailyExerciseGoal:
        todayActivity?.exercise_goal_minutes ?? settings.dailyExerciseGoal,
      weeklyExerciseMinutes:
        recordedMinutes.length > 0
          ? recordedMinutes.reduce((sum, minutes) => sum + minutes, 0)
          : null,
      weeklyGoalMinutes: settings.weeklyActivityGoal,
      activeDays: days.filter(
        (day) => day.status === "recorded" && (day.minutes || 0) > 0,
      ).length,
      days,
    },
    sleep: {
      lastNight: lastNight
        ? {
            nightDate: lastNight.night_date,
            totalMinutes: lastNight.total_minutes,
            inBedMinutes: lastNight.in_bed_minutes,
            awakeMinutes: lastNight.awake_minutes,
            coreMinutes: lastNight.core_minutes,
            deepMinutes: lastNight.deep_minutes,
            remMinutes: lastNight.rem_minutes,
            sourceUpdatedAt: lastNight.source_updated_at,
          }
        : null,
      averageMinutes: settings.showAverage ? averageMinutes : null,
      nightsUsed: sleepRows.length,
      incompleteHistory: sleepRows.length < 7,
      targetMinutes: settings.sleepTargetMinutes,
      showAverage: settings.showAverage,
      showPhases: settings.showPhases,
      trend: sleepRows
        .slice()
        .reverse()
        .map((row) => ({
          nightDate: row.night_date,
          totalMinutes: row.total_minutes,
        })),
    },
  };
}

export function getHealthAdminSnapshot() {
  const sync = getDb()
    .prepare("SELECT * FROM health_sync_state WHERE id = 1")
    .get() as Record<string, unknown> | undefined;
  let discovered: DiscoveredHealthEntity[] = [];
  try {
    discovered = JSON.parse(String(sync?.discovered_entities || "[]"));
  } catch {
    discovered = [];
  }
  return {
    configured: homeAssistantConfigured(),
    settings: healthSettings(),
    mappings: readHealthMappings(),
    metrics: HEALTH_METRICS.map((metric) => ({
      metric,
      label: METRIC_LABELS[metric],
    })),
    sync: sync || null,
    discovered,
    history: getPulseSnapshot(),
  };
}

export function pulseEnabled() {
  return healthSettings().enabled;
}

export function healthSyncIntervalMs() {
  const seconds = Number(
    process.env.HA_SYNC_INTERVAL_SECONDS || HEALTH_SYNC_DEFAULT_SECONDS,
  );
  return (
    Math.min(
      86_400,
      Math.max(
        HEALTH_SYNC_MIN_SECONDS,
        Number.isFinite(seconds) ? seconds : HEALTH_SYNC_DEFAULT_SECONDS,
      ),
    ) * 1000
  );
}

export function historyStartDate(days = 7) {
  return shiftDate(localDate(new Date(), TIMEZONE), -days);
}

export function currentWeekStart() {
  return mondayOfWeek(localDate(new Date(), TIMEZONE));
}
