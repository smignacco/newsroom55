import { describe, expect, it } from "vitest";
import {
  localDate,
  mondayOfWeek,
  sevenDayDates,
  shiftDate,
  sleepNightDate,
} from "@/lib/health/time";

describe("health calendar handling", () => {
  it("assigns a sleep record to the 18:00–18:00 Toronto night", () => {
    expect(sleepNightDate("2026-01-12T22:59:59Z")).toBe("2026-01-11");
    expect(sleepNightDate("2026-01-12T23:00:00Z")).toBe("2026-01-12");
    expect(sleepNightDate("2026-07-12T21:59:59Z")).toBe("2026-07-11");
    expect(sleepNightDate("2026-07-12T22:00:00Z")).toBe("2026-07-12");
  });

  it("keeps local dates stable across daylight-saving changes", () => {
    expect(localDate("2026-03-08T06:59:00Z")).toBe("2026-03-08");
    expect(localDate("2026-03-08T07:01:00Z")).toBe("2026-03-08");
    expect(localDate("2026-11-01T05:30:00Z")).toBe("2026-11-01");
    expect(localDate("2026-11-01T06:30:00Z")).toBe("2026-11-01");
    expect(shiftDate("2026-03-08", 1)).toBe("2026-03-09");
  });

  it("builds a Monday-to-Sunday activity week", () => {
    expect(mondayOfWeek("2026-11-11")).toBe("2026-11-09");
    expect(sevenDayDates("2026-11-11")).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ]);
  });
});
