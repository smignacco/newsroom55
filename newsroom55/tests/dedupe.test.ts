import { describe, expect, it } from "vitest";
import { fingerprintTitle, isDuplicate, jaccard } from "@/lib/news/dedupe";

describe("dedupe", () => {
  it("normalizes punctuation and case", () => {
    expect(fingerprintTitle("Québec: Storm Hits!")).toBe("quebec storm hits");
  });

  it("detects near-duplicate titles", () => {
    expect(isDuplicate("Ottawa unveils new housing plan", ["Ottawa unveils a new housing plan today"])).toBe(true);
  });

  it("keeps distinct events", () => {
    expect(jaccard("Apple reports quarterly earnings", "TSX closes mixed on oil")).toBeLessThan(0.3);
    expect(isDuplicate("Apple reports quarterly earnings", ["TSX closes mixed on oil"])).toBe(false);
  });
});
