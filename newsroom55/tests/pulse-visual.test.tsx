import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PulseTelemetry } from "../src/components/newsroom/ActivitySleepPulse";
import type { PulseSnapshot } from "@/lib/health/service";

const fixture: PulseSnapshot = {
  generatedAt: "2026-11-13T18:00:00.000Z",
  lastSyncAt: "2026-11-13T17:58:00.000Z",
  stale: false,
  privacyMode: false,
  activity: {
    date: "2026-11-13",
    steps: 6400,
    exerciseMinutes: 35,
    activeEnergyKcal: 420,
    dailyStepsGoal: 8000,
    dailyExerciseGoal: 30,
    weeklyExerciseMinutes: 120,
    weeklyGoalMinutes: 150,
    activeDays: 3,
    days: [
      { date: "2026-11-07", label: "SA", minutes: 20, status: "recorded" },
      { date: "2026-11-08", label: "DI", minutes: null, status: "missing" },
      { date: "2026-11-09", label: "LU", minutes: 40, status: "recorded" },
      { date: "2026-11-10", label: "MA", minutes: 15, status: "recorded" },
      { date: "2026-11-11", label: "ME", minutes: null, status: "missing" },
      { date: "2026-11-12", label: "JE", minutes: 30, status: "recorded" },
      { date: "2026-11-13", label: "VE", minutes: 35, status: "recorded" },
    ],
  },
  sleep: {
    lastNight: {
      nightDate: "2026-11-12",
      totalMinutes: 420,
      inBedMinutes: 450,
      awakeMinutes: 20,
      coreMinutes: 220,
      deepMinutes: 80,
      remMinutes: 100,
      sourceUpdatedAt: "2026-11-13T12:00:00.000Z",
    },
    averageMinutes: 410,
    nightsUsed: 5,
    incompleteHistory: true,
    targetMinutes: 480,
    showAverage: true,
    showPhases: true,
    trend: [{ nightDate: "2026-11-12", totalMinutes: 420 }],
  },
};

describe("Activity & Sleep broadcast treatment", () => {
  it("renders effort rings, a sleep arc and a week orbit from supplied samples only", () => {
    const html = renderToStaticMarkup(<PulseTelemetry snapshot={fixture} />);
    expect(html).toContain("nr-pulse-dial");
    expect(html).toContain("nr-pulse-night-arc");
    expect(html).toContain("nr-week-orbit");
    expect(html).toContain("EFFORT");
    expect(html).toContain("REPOS");
    expect(html).toMatch(/6[\s\u00a0\u202f]?400/);
    expect(html).not.toContain("nr-week-bars");
  });

  it("hides recorded sleep phases when the administrator disables them", () => {
    const html = renderToStaticMarkup(
      <PulseTelemetry
        snapshot={{
          ...fixture,
          sleep: { ...fixture.sleep, showPhases: false },
        }}
      />,
    );
    expect(html).toContain("nr-pulse-night-arc");
    expect(html).not.toContain("#8a79ea");
    expect(html).not.toContain("#646fe0");
    expect(html).not.toContain("#438fc0");
    expect(html).toContain("7 h 00");
  });

  it("keeps missing activity as an incomplete arc instead of a zero fill", () => {
    const html = renderToStaticMarkup(
      <PulseTelemetry
        snapshot={{
          ...fixture,
          activity: {
            ...fixture.activity,
            steps: null,
            exerciseMinutes: null,
            activeEnergyKcal: null,
            days: fixture.activity.days.map((day) => ({
              ...day,
              minutes: null,
              status: "missing",
            })),
          },
          sleep: { ...fixture.sleep, lastNight: null, showAverage: false },
        }}
      />,
    );
    expect(html).toContain("DONNÉES ABSENTES");
    expect(html).toContain("—");
    expect(html).not.toContain(">0<");
  });
});
