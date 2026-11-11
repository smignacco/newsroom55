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
): HomeAssistantState {
  return {
    entity_id: entityId,
    state: value,
    last_changed: updatedAt,
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
