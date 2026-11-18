import { describe, expect, it } from "vitest";
import { liveQuotePriceRows } from "../src/lib/giverny/prices";
import { isNyWeekend, nyTradingSessions, quoteTradingSession } from "../src/lib/giverny/tickers";
import type { Quote } from "../src/lib/markets/provider";

function quote(overrides: Partial<Quote> & Pick<Quote, "price" | "asOf">): Quote {
  return {
    symbolId: 1,
    symbol: "SPX",
    displayName: "S&P 500",
    changeAbs: null,
    changePct: null,
    currency: "USD",
    status: "DELAYED",
    provider: "yahoo",
    ...overrides,
  };
}

describe("Giverny live quote sessions", () => {
  it("derives the NY trading session from the quote timestamp instead of today", () => {
    expect(quoteTradingSession("2026-11-13T21:00:00.000Z", "2026-11-14")).toBe("2026-11-13");
    expect(quoteTradingSession("2026-11-13T21:00:00.000Z", "2026-11-13")).toBe("2026-11-13");
  });

  it("rejects missing, invalid, weekend, and future quote timestamps", () => {
    expect(quoteTradingSession(null, "2026-11-14")).toBeNull();
    expect(quoteTradingSession("not-a-date", "2026-11-14")).toBeNull();
    expect(quoteTradingSession("2026-11-14T15:00:00.000Z", "2026-11-14")).toBeNull();
    expect(quoteTradingSession("2026-11-15T18:00:00.000Z", "2026-11-13")).toBeNull();
  });

  it("drops Saturday and Sunday from the SPX session calendar", () => {
    expect(isNyWeekend("2026-11-13")).toBe(false);
    expect(isNyWeekend("2026-11-14")).toBe(true);
    expect(isNyWeekend("2026-11-15")).toBe(true);
    expect(nyTradingSessions(["2026-11-16", "2026-11-15", "2026-11-14", "2026-11-13"])).toEqual([
      "2026-11-13",
      "2026-11-16",
    ]);
  });

  it("stores Friday's last print under Friday and ignores weekend-stamped quotes", () => {
    const rows = liveQuotePriceRows(
      [
        quote({ price: 5800, asOf: "2026-11-13T21:00:00.000Z" }),
        quote({ price: 5801, asOf: "2026-11-15T15:00:00.000Z" }),
        quote({ symbol: "AAA", price: 12.5, asOf: null }),
      ],
      "2026-11-15",
      false,
    );
    expect(rows).toEqual([
      {
        symbol: "SPX",
        sessionDate: "2026-11-13",
        close: 5800,
        adjClose: 5800,
        provider: "yahoo",
        official: true,
        asOf: "2026-11-13T21:00:00.000Z",
      },
    ]);
  });
});
