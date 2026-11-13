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
  it("renders effort meters, a dated sleep target and week bars from supplied samples only", () => {
    const html = renderToStaticMarkup(<PulseTelemetry snapshot={fixture} />);
    expect(html).toContain("nr-effort-meters");
    expect(html).toContain("nr-sleep-target");
    expect(html).toContain("nr-week-bars");
    expect(html).toContain("EFFORT");
    expect(html).toContain("REPOS");
    expect(html).toContain("12 nov.");
    expect(html).not.toContain("2026-11-12");
    expect(html).not.toContain("nr-pulse-night-arc");
    expect(html).toMatch(/6[\s\u00a0\u202f]?400/);
    expect(html).toContain("80 %");
    expect(html).toContain("117 %");
    expect(html).toContain("88 %");
    expect(html).toContain("cible 8 h 00");
    expect(html).toContain("Profond");
    expect(html).toContain("1 h 20");
    expect(html).toContain('data-fill="80"');
    expect(html).toContain('data-fill="100"');
    expect(html).toContain("is-heat");
    expect(html).toContain("nr-effort-track is-plain");
    expect(html).not.toContain("105 %");
    expect(html).not.toContain('data-fill="105"');
    expect(html).not.toContain("nr-pulse-dial");
    expect(html).not.toContain("nr-week-orbit");
  });

  it("hides recorded sleep phases on the compact board and when the administrator disables them", () => {
    const compact = renderToStaticMarkup(
      <PulseTelemetry snapshot={fixture} compact />,
    );
    expect(compact).toContain("12 nov.");
    expect(compact).toContain("cible 8 h 00");
    expect(compact).not.toContain("Profond");
    expect(compact).not.toContain("nr-pulse-night-arc");

    const html = renderToStaticMarkup(
      <PulseTelemetry
        snapshot={{
          ...fixture,
          sleep: { ...fixture.sleep, showPhases: false },
        }}
      />,
    );
    expect(html).not.toContain("nr-sleep-phases");
    expect(html).not.toContain("Profond");
    expect(html).not.toContain("nr-pulse-night-arc");
    expect(html).toContain("7 h 00");
  });

  it("keeps missing activity as an incomplete track instead of a zero fill", () => {
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
    expect(html).toContain("nr-effort-track is-missing");
    expect(html).toContain("nr-week-day missing");
    expect(html).not.toContain(">0<");
    expect(html).not.toContain("nr-pulse-dial");
    expect(html).not.toContain("nr-week-orbit");
  });
});
