import { describe, expect, it } from "vitest";
import {
  compoundReturns,
  contributorsForSession,
  cumulativeGap,
  lastCompletedReturn,
  portfolioSessionReturn,
  reconstructIndex,
  sessionReturn,
  trackingError,
  usablePrice,
} from "../src/lib/giverny/engine";
import type { FilingBook, HoldingWeight } from "../src/lib/giverny/types";

const book = (filedOn: string, weights: Array<[string, number]>): FilingBook => ({
  accession: `acc-${filedOn}`,
  filedOn,
  periodOfReport: filedOn,
  holdings: weights.map(([ticker, weight]) => ({
    ticker,
    cusip: ticker,
    issuerName: ticker,
    weight,
    shares: 1,
    value: weight * 100,
  })),
});

function series(rows: Array<[string, number]>) {
  return new Map(rows);
}

describe("Giverny portfolio math", () => {
  it("never treats a missing or zero price as a usable last or a 0% return", () => {
    expect(usablePrice(0)).toBe(false);
    expect(usablePrice(null)).toBe(false);
    expect(sessionReturn(10, 0)).toBeNull();
    expect(sessionReturn(10, null)).toBeNull();
    expect(sessionReturn(null, 11)).toBeNull();
    expect(sessionReturn(10, 11)).toBeCloseTo(0.1);
  });

  it("renormalizes among names with prices so a missing quote is not a 0% contribution", () => {
    const weights: HoldingWeight[] = [
      { ticker: "AAA", cusip: "1", issuerName: "A", weight: 0.5, shares: 1, value: 50 },
      { ticker: "BBB", cusip: "2", issuerName: "B", weight: 0.5, shares: 1, value: 50 },
    ];
    const asZero = portfolioSessionReturn(weights, new Map([["AAA", 0.1], ["BBB", 0]]));
    expect(asZero.value).toBeCloseTo(0.05);

    const missing = portfolioSessionReturn(weights, new Map([["AAA", 0.1], ["BBB", null]]));
    expect(missing.value).toBeNull();
    expect(missing.coverage).toBeCloseTo(0.5);
    expect(missing.status).toBe("unavailable");

    const mostlyCovered = portfolioSessionReturn(
      [
        { ticker: "AAA", cusip: "1", issuerName: "A", weight: 0.9, shares: 1, value: 90 },
        { ticker: "BBB", cusip: "2", issuerName: "B", weight: 0.1, shares: 1, value: 10 },
      ],
      new Map([["AAA", 0.1], ["BBB", null]]),
    );
    expect(mostlyCovered.value).toBeCloseTo(0.1);
    expect(mostlyCovered.coverage).toBeCloseTo(0.9);
    expect(mostlyCovered.status).toBe("incomplete");
  });

  it("compounds session returns and ignores an incomplete last-5 window", () => {
    expect(compoundReturns([0.01, 0.01])).toBeCloseTo(0.0201);
    expect(compoundReturns([0.01, null])).toBeNull();
    expect(
      lastCompletedReturn(
        [
          { sessionDate: "2026-11-10", dayReturnUsd: 0.01 } as never,
          { sessionDate: "2026-11-11", dayReturnUsd: 0.02 } as never,
        ],
        5,
        "dayReturnUsd",
      ),
    ).toBeNull();
  });

  it("does not look ahead to a 13F that was not yet public", () => {
    const points = reconstructIndex({
      sessions: ["2026-02-01", "2026-02-02"],
      filings: [book("2026-02-02", [["AAA", 1]])],
      prices: new Map([["AAA", series([["2026-02-01", 10], ["2026-02-02", 11]])]]),
      fx: series([["2026-02-01", 1.3], ["2026-02-02", 1.31]]),
      spx: series([["2026-02-01", 5000], ["2026-02-02", 5050]]),
    });
    expect(points[0]?.givUsd).toBeNull();
    expect(points[1]?.givUsd).toBe(100);
    expect(points[1]?.accession).toBe("acc-2026-02-02");
  });

  it("keeps CAD unavailable when FX is missing without inventing a rate", () => {
    const points = reconstructIndex({
      sessions: ["2026-03-02", "2026-03-03"],
      filings: [book("2026-03-01", [["AAA", 1]])],
      prices: new Map([["AAA", series([["2026-03-02", 10], ["2026-03-03", 11]])]]),
      fx: series([["2026-03-02", 1.4]]),
      spx: series([["2026-03-02", 100], ["2026-03-03", 101]]),
    });
    expect(points[0]?.givCad).toBe(100);
    expect(points[1]?.givUsd).toBeCloseTo(110);
    expect(points[1]?.givCad).toBeNull();
    expect(points[1]?.usdCad).toBeNull();
  });

  it("attributes contributors from previous weights and known returns only", () => {
    const { up, down } = contributorsForSession(
      [
        { ticker: "META", cusip: "m", issuerName: "Meta", weight: 0.6, shares: 1, value: 60 },
        { ticker: "GOOG", cusip: "g", issuerName: "Alphabet", weight: 0.4, shares: 1, value: 40 },
      ],
      new Map([["META", 0.02], ["GOOG", -0.01]]),
      new Map([
        ["META", "Meta"],
        ["GOOG", "Alphabet"],
      ]),
    );
    expect(up[0]?.ticker).toBe("META");
    expect(up[0]?.contribution).toBeCloseTo(0.012);
    expect(down[0]?.ticker).toBe("GOOG");
  });

  it("measures official vs synthetic tracking without overwriting the synthetic series", () => {
    expect(trackingError([0.01, -0.01, 0])).toBeCloseTo(0.01);
    expect(cumulativeGap([0.02, 0.02], [0.01, 0.01])).toBeCloseTo((1.02 * 1.02) / (1.01 * 1.01) - 1);
  });
});
