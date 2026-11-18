import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type {
  HomeAssistantReader,
  HomeAssistantState,
} from "@/lib/home-assistant/client";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "newsroom-health-"));
process.env.DATA_DIR = dataDir;

function state(
  entityId: string,
  value: string,
  unit: string,
  updatedAt: string,
  changedAt = updatedAt,
): HomeAssistantState {
  return {
    entity_id: entityId,
    state: value,
    last_changed: changedAt,
    last_updated: updatedAt,
    attributes: { unit_of_measurement: unit },
  };
}

class Reader implements HomeAssistantReader {
  constructor(
    public states: HomeAssistantState[],
    public history: HomeAssistantState[][] = [],
  ) {}
  async testConnection() {
    return { version: "2026.11" };
  }
  async getStates() {
    return this.states;
  }
  async getHistory() {
    return this.history;
  }
}

describe("health synchronization", () => {
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-11T15:00:00Z"));
    const { saveHealthMappings, updateHealthSettings } =
      await import("@/lib/health/service");
    saveHealthMappings({
      steps: "sensor.health_steps",
      exercise_minutes: "sensor.exercise_time",
      sleep_duration: "sensor.sleep_duration",
      deep_sleep: "sensor.deep_sleep",
      rem_sleep: "sensor.rem_sleep",
    });
    updateHealthSettings({
      privacyMode: false,
      showAverage: true,
      showPhases: true,
    });
  });

  afterAll(() => {
    vi.useRealTimers();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("stores nullable phases and daily activity without converting missing data to zero", async () => {
    const { syncHealthData } = await import("@/lib/health/service");
    const snapshot = await syncHealthData(
      new Reader([
        state("sensor.health_steps", "6400", "steps", "2026-11-11T14:58:00Z"),
        state("sensor.exercise_time", "35", "min", "2026-11-11T14:58:00Z"),
        state("sensor.sleep_duration", "7", "h", "2026-11-11T12:00:00Z"),
        state("sensor.deep_sleep", "unknown", "min", "2026-11-11T12:00:00Z"),
        state("sensor.rem_sleep", "80", "min", "2026-11-11T12:00:00Z"),
      ]),
    );

    expect(snapshot.activity).toMatchObject({
      steps: 6400,
      exerciseMinutes: 35,
      activeDays: 1,
    });
    expect(snapshot.sleep.lastNight).toMatchObject({
      nightDate: "2026-11-10",
      totalMinutes: 420,
      deepMinutes: null,
      remMinutes: 80,
      coreMinutes: null,
    });
  });

  it("does not assign yesterday's unchanged daily counters to today", async () => {
    const { syncHealthData } = await import("@/lib/health/service");
    vi.setSystemTime(new Date("2026-11-12T15:00:00Z"));
    try {
      const snapshot = await syncHealthData(
        new Reader([
          state("sensor.health_steps", "6400", "steps", "2026-11-11T23:30:00Z"),
          state("sensor.exercise_time", "35", "min", "2026-11-11T23:30:00Z"),
        ]),
      );
      expect(snapshot.activity.date).toBe("2026-11-12");
      expect(snapshot.activity.steps).toBeNull();
      expect(snapshot.activity.exerciseMinutes).toBeNull();
      expect(
        snapshot.activity.days.find((day) => day.date === "2026-11-12")?.status,
      ).toBe("missing");
    } finally {
      vi.setSystemTime(new Date("2026-11-11T15:00:00Z"));
    }
  });

  it("does not copy a polled yesterday total onto today's week bar", async () => {
    const { syncHealthData } = await import("@/lib/health/service");
    vi.setSystemTime(new Date("2026-11-12T15:00:00Z"));
    try {
      const snapshot = await syncHealthData(
        new Reader(
          [
            state(
              "sensor.health_steps",
              "6400",
              "steps",
              "2026-11-12T15:00:00Z",
              "2026-11-11T23:30:00Z",
            ),
            state(
              "sensor.exercise_time",
              "35",
              "min",
              "2026-11-12T15:00:00Z",
              "2026-11-11T23:30:00Z",
            ),
          ],
          [
            [
              state("sensor.exercise_time", "35", "min", "2026-11-11T23:30:00Z"),
              state(
                "sensor.exercise_time",
                "35",
                "min",
                "2026-11-12T10:05:00Z",
              ),
              state("sensor.exercise_time", "12", "min", "2026-11-12T14:50:00Z"),
            ],
          ],
        ),
      );
      expect(snapshot.activity.date).toBe("2026-11-12");
      expect(
        snapshot.activity.days.find((day) => day.date === "2026-11-11")?.minutes,
      ).toBe(35);
      expect(snapshot.activity.exerciseMinutes).toBe(12);
      expect(
        snapshot.activity.days.find((day) => day.date === "2026-11-12")?.minutes,
      ).toBe(12);
      expect(
        snapshot.activity.days.find((day) => day.date === "2026-11-12")?.label,
      ).toBe("JE");
    } finally {
      vi.setSystemTime(new Date("2026-11-11T15:00:00Z"));
    }
  });

  it("corrects a late synchronization without duplicating the logical night", async () => {
    const { syncHealthData } = await import("@/lib/health/service");
    const { getDb } = await import("@/lib/database");
    await syncHealthData(
      new Reader([
        state("sensor.sleep_duration", "7.5", "h", "2026-11-11T14:30:00Z"),
        state("sensor.deep_sleep", "65", "min", "2026-11-11T14:30:00Z"),
        state("sensor.rem_sleep", "85", "min", "2026-11-11T14:30:00Z"),
      ]),
    );
    const rows = getDb()
      .prepare(
        `SELECT night_date, total_minutes, deep_minutes
         FROM sleep_nightly_totals WHERE night_date = ?`,
      )
      .all("2026-11-10") as Array<{
      night_date: string;
      total_minutes: number;
      deep_minutes: number | null;
    }>;
    expect(rows).toEqual([
      {
        night_date: "2026-11-10",
        total_minutes: 450,
        deep_minutes: 65,
      },
    ]);
  });

  it("shares one in-flight synchronization between scheduler and manual requests", async () => {
    const { syncHealthData } = await import("@/lib/health/service");
    let release!: () => void;
    let stateReads = 0;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reader: HomeAssistantReader = {
      async testConnection() {
        return { version: "2026.11" };
      },
      async getStates() {
        stateReads += 1;
        await gate;
        return [];
      },
      async getHistory() {
        return [];
      },
    };

    const scheduled = syncHealthData(reader);
    const manual = syncHealthData(reader);
    expect(manual).toBe(scheduled);
    expect(stateReads).toBe(1);
    release();
    await Promise.all([scheduled, manual]);
    expect(stateReads).toBe(1);
  });

  it("can refresh live states without pulling Recorder history", async () => {
    const { syncHealthData } = await import("@/lib/health/service");
    let historyReads = 0;
    const reader: HomeAssistantReader = {
      async testConnection() {
        return { version: "2026.11" };
      },
      async getStates() {
        return [
          state("sensor.health_steps", "6500", "steps", "2026-11-11T14:59:00Z"),
        ];
      },
      async getHistory() {
        historyReads += 1;
        return [];
      },
    };
    const snapshot = await syncHealthData(reader, { history: false });
    expect(historyReads).toBe(0);
    expect(snapshot.activity.steps).toBe(6500);
  });

  it("defaults health sync to 15 seconds and refuses a shorter interval", async () => {
    const { healthSyncIntervalMs } = await import("@/lib/health/service");
    const previous = process.env.HA_SYNC_INTERVAL_SECONDS;
    delete process.env.HA_SYNC_INTERVAL_SECONDS;
    expect(healthSyncIntervalMs()).toBe(15_000);
    process.env.HA_SYNC_INTERVAL_SECONDS = "5";
    expect(healthSyncIntervalMs()).toBe(15_000);
    process.env.HA_SYNC_INTERVAL_SECONDS = "20";
    expect(healthSyncIntervalMs()).toBe(20_000);
    if (previous === undefined) delete process.env.HA_SYNC_INTERVAL_SECONDS;
    else process.env.HA_SYNC_INTERVAL_SECONDS = previous;
  });

  it("uses only reliable available nights for the seven-night average", async () => {
    const { syncHealthData } = await import("@/lib/health/service");
    const history = [
      state("sensor.sleep_duration", "6", "h", "2026-11-09T12:00:00Z"),
      state("sensor.sleep_duration", "8", "h", "2026-11-10T12:00:00Z"),
      state("sensor.sleep_duration", "7.5", "h", "2026-11-11T14:30:00Z"),
    ];
    const snapshot = await syncHealthData(
      new Reader(
        [state("sensor.sleep_duration", "7.5", "h", "2026-11-11T14:30:00Z")],
        [history],
      ),
    );
    expect(snapshot.sleep.nightsUsed).toBe(3);
    expect(snapshot.sleep.incompleteHistory).toBe(true);
    expect(snapshot.sleep.averageMinutes).toBe(430);
  });
});
