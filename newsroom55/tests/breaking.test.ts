import { describe, expect, it } from "vitest";
import { applyBreakingRules } from "@/lib/news/breaking";

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
});
