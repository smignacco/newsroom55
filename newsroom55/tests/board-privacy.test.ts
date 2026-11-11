import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const dataDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "newsroom-board-privacy-"),
);
process.env.DATA_DIR = dataDir;

afterAll(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("public board snapshot privacy", () => {
  it("keeps confidential mode optional while the panel remains disabled by default", async () => {
    const { healthSettings } = await import("@/lib/health/service");
    expect(healthSettings()).toMatchObject({
      enabled: false,
      privacyMode: false,
    });
  });

  it("exposes only pulse enablement, never personal aggregates", async () => {
    const { getDb, setSetting } = await import("@/lib/database");
    const { getBoardSnapshot } = await import("@/lib/board-snapshot");
    setSetting("health_pulse_enabled", "on");
    getDb()
      .prepare(
        `INSERT INTO activity_daily_totals
          (activity_date, timezone, steps, exercise_minutes, synced_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        "2026-11-11",
        "America/Toronto",
        12345,
        55,
        new Date().toISOString(),
      );

    const snapshot = (await getBoardSnapshot()) as Record<string, unknown>;
    expect(snapshot.personalPulse).toEqual({ enabled: true });
    expect(snapshot).not.toHaveProperty("activity");
    expect(snapshot).not.toHaveProperty("sleep");
    expect(snapshot).not.toHaveProperty("health");
  });
});
