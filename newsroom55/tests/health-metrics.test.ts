import { describe, expect, it } from "vitest";
import type { HomeAssistantState } from "@/lib/home-assistant/client";
import { discoverHealthEntities, measurementValue } from "@/lib/health/metrics";

function state(
  entityId: string,
  value: string,
  unit?: string,
  name?: string,
): HomeAssistantState {
  return {
    entity_id: entityId,
    state: value,
    last_changed: "2026-11-11T12:00:00Z",
    last_updated: "2026-11-11T12:00:00Z",
    attributes: {
      friendly_name: name,
      unit_of_measurement: unit,
    },
  };
}

describe("Home Assistant health metrics", () => {
  it("discovers exact candidates and localized probable sensors", () => {
    const found = discoverHealthEntities([
      state("sensor.health_steps", "4200", "steps", "Health Steps"),
      state("sensor.iphone_sommeil", "7.5", "h", "Durée de sommeil"),
      state("sensor.unrelated_temperature", "20", "°C", "Salon"),
    ]);
    expect(found).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "sensor.health_steps",
          metric: "steps",
          confidence: "exact",
        }),
        expect.objectContaining({
          entityId: "sensor.iphone_sommeil",
          metric: "sleep_duration",
          confidence: "probable",
        }),
      ]),
    );
    expect(
      found.some((item) => item.entityId === "sensor.unrelated_temperature"),
    ).toBe(false);
  });

  it("normalizes supported units and rejects incompatible values", () => {
    expect(
      measurementValue("sleep_duration", state("sensor.sleep", "7.5", "h")),
    ).toBe(450);
    expect(
      measurementValue(
        "exercise_minutes",
        state("sensor.exercise", "1800", "s"),
      ),
    ).toBe(30);
    expect(
      measurementValue("active_energy", state("sensor.energy", "418.4", "kJ")),
    ).toBeCloseTo(100);
    expect(
      measurementValue("steps", state("sensor.steps", "-10", "steps")),
    ).toBeNull();
    expect(
      measurementValue("sleep_duration", state("sensor.sleep", "unknown", "h")),
    ).toBeNull();
    expect(
      measurementValue("sleep_duration", state("sensor.sleep", "12", "kg")),
    ).toBeNull();
  });
});
