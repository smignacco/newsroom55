import { describe, expect, it } from "vitest";
import {
  ALERT_MAX_AGE_MS,
  applyBreakingRules,
  isFreshAlert,
} from "@/lib/news/breaking";

const rules = [
  { pattern: "\\bbreaking\\b", field: "title" as const, level: "BREAKING" as const, enabled: 1 },
  { pattern: "\\balerte\\b", field: "title" as const, level: "IMPORTANT" as const, enabled: 1 },
];

describe("applyBreakingRules", () => {
  it("stays NORMAL without a match", () => {
    expect(applyBreakingRules("City council approves budget", "", rules)).toBe("NORMAL");
  });

  it("marks explicit breaking language", () => {
    expect(applyBreakingRules("Breaking: bridge closed downtown", "", rules)).toBe("BREAKING");
  });

  it("does not invent an alert from ordinary words", () => {
    expect(applyBreakingRules("Market closes slightly lower", "", rules)).toBe("NORMAL");
  });

  it("expires alert banners after 24 hours", () => {
    const now = Date.parse("2026-11-12T17:00:00.000Z");
    const story = {
      priority: "BREAKING" as const,
      published_at: new Date(now - ALERT_MAX_AGE_MS - 1).toISOString(),
      fetched_at: new Date(now).toISOString(),
    };
    expect(isFreshAlert(story, now)).toBe(false);
    expect(
      isFreshAlert(
        {
          ...story,
          published_at: new Date(now - ALERT_MAX_AGE_MS + 1).toISOString(),
        },
        now,
      ),
    ).toBe(true);
  });
});
