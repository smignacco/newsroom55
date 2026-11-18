import { describe, expect, it } from "vitest";
import { formatHealthDuration } from "@/lib/health/format";

describe("sleep duration display", () => {
  it("renders 481 minutes as 8 h 01, not 4 h 55", () => {
    expect(formatHealthDuration(481)).toBe("8 h 01");
    expect(formatHealthDuration(295)).toBe("4 h 55");
    expect(formatHealthDuration(null)).toBe("—");
  });
});
