import { describe, expect, it } from "vitest";
import {
  dailyTotalsFromSeries,
  nightlySleepFromSeries,
} from "../src/lib/health/daily";
import type { HomeAssistantState } from "../src/lib/home-assistant/client";

function sample(
  value: string,
  updatedAt: string,
  changedAt = updatedAt,
): HomeAssistantState {
  return {
    entity_id: "sensor.exercise_time",
    state: value,
    last_changed: changedAt,
    last_updated: updatedAt,
    attributes: { unit_of_measurement: "min" },
  };
}

describe("daily activity reconstruction", () => {
  it("attributes polls to last_changed and drops a carried yesterday total", () => {
    const totals = dailyTotalsFromSeries(
      [
        sample("40", "2026-11-17T22:00:00Z"),
        sample("40", "2026-11-18T10:05:00Z"),
        sample("12", "2026-11-18T20:00:00Z"),
      ],
      "exercise_minutes",
      "2026-11-18",
    );
    expect(totals.get("2026-11-17")?.value).toBe(40);
    expect(totals.get("2026-11-18")?.value).toBe(12);
  });

  it("keeps the latest sleep total when Recorder history is reversed", () => {
    const nights = nightlySleepFromSeries([
      {
        entity_id: "sensor.sleep_duration",
        state: "481",
        last_changed: "2026-11-18T15:00:00Z",
        last_updated: "2026-11-18T18:00:00Z",
        attributes: { unit_of_measurement: "min" },
      },
      {
        entity_id: "sensor.sleep_duration",
        state: "295",
        last_changed: "2026-11-18T09:55:00Z",
        last_updated: "2026-11-18T09:55:00Z",
        attributes: { unit_of_measurement: "min" },
      },
    ]);
    expect(nights.get("2026-11-17")).toEqual({
      value: 481,
      sourceUpdatedAt: "2026-11-18T15:00:00Z",
    });
  });

  it("does not copy a polled value onto today when last_changed stays yesterday", () => {
    const totals = dailyTotalsFromSeries(
      [
        sample("40", "2026-11-17T22:00:00Z"),
        sample("40", "2026-11-18T15:00:00Z", "2026-11-17T22:00:00Z"),
      ],
      "exercise_minutes",
      "2026-11-18",
    );
    expect(totals.get("2026-11-17")?.value).toBe(40);
    expect(totals.has("2026-11-18")).toBe(false);
  });
});
