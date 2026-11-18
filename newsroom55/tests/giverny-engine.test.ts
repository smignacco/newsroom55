import { describe, expect, it } from "vitest";
import {
  compoundReturns,
  contributorsForSession,
  cumulativeGap,
  lastCompletedReturn,
  monthToDateReturn,
  portfolioSessionReturn,
  reconstructIndex,
  latestDisplayPoint,
  officialNavEstimate,
  sessionReturn,
  yearToDateReturn,
  tickerCoverage,
  trackingError,
  usablePrice,
} from "../src/lib/giverny/engine";
import { earliestFiledOn } from "../src/lib/giverny/store";
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

  it("scales the synthetic CAD index onto a user-entered month-end NAV", () => {
    const series = officialNavEstimate(
      [
        { sessionDate: "2026-10-30", givCad: 100, coverage: 0.98 } as never,
        { sessionDate: "2026-10-31", givCad: 100, coverage: 0.98 } as never,
        { sessionDate: "2026-11-18", givCad: 102, coverage: 0.98 } as never,
      ],
      [{ yearMonth: "2026-10", officialNav: 76.31 }],
    );
    expect(series.find((row) => row.date === "2026-10-31")?.value).toBeCloseTo(76.31);
    expect(series.find((row) => row.date === "2026-11-18")?.value).toBeCloseTo(76.31 * 1.02);
    expect(series.find((row) => row.date === "2026-11-18")?.anchorDate).toBe("2026-10-31");
  });

  it("does not invent a NAV when no official unit price was entered", () => {
    expect(
      officialNavEstimate(
        [{ sessionDate: "2026-11-18", givCad: 98.19, coverage: 0.98 } as never],
        [],
      ),
    ).toEqual([]);
  });

  it("counts unmapped equity weight in the coverage denominator", () => {
    const unmapped = portfolioSessionReturn(
      [
        { ticker: "AAA", cusip: "1", issuerName: "A", weight: 0.1, shares: 1, value: 10 },
        { ticker: null, cusip: "2", issuerName: "Unmapped", weight: 0.9, shares: 1, value: 90 },
      ],
      new Map([["AAA", 0.05]]),
    );
    expect(unmapped.coverage).toBeCloseTo(0.1);
    expect(unmapped.value).toBeNull();
    expect(unmapped.status).toBe("unavailable");
  });

  it("does not publish a mapped-subset return when most of the book is unmapped", () => {
    const points = reconstructIndex({
      sessions: ["2026-11-09", "2026-11-10"],
      filings: [
        {
          accession: "acc-partial",
          filedOn: "2026-11-01",
          periodOfReport: "2026-09-30",
          holdings: [
            { ticker: "AAA", cusip: "1", issuerName: "A", weight: 0.1, shares: 1, value: 10 },
            { ticker: null, cusip: "2", issuerName: "Unmapped", weight: 0.9, shares: 1, value: 90 },
          ],
        },
      ],
      prices: new Map([["AAA", series([["2026-11-09", 10], ["2026-11-10", 11]])]]),
      fx: series([["2026-11-09", 1.4], ["2026-11-10", 1.4]]),
      spx: series([["2026-11-09", 100], ["2026-11-10", 101]]),
    });
    expect(points[0]?.givUsd).toBeNull();
    expect(points[0]?.status).toBe("unavailable");
    expect(points[0]?.coverage).toBeCloseTo(0.1);
    expect(points[1]?.status).toBe("unavailable");
    expect(points[1]?.dayReturnUsd).toBeNull();
    expect(points[1]?.coverage).toBeCloseTo(0.1);
    expect(points[1]?.givUsd).toBeNull();
  });

  it("reports ticker coverage without treating unmapped weight as a complete book", () => {
    expect(
      tickerCoverage([
        { ticker: "AAA", cusip: "1", issuerName: "A", weight: 0.4, shares: 1, value: 40 },
        { ticker: null, cusip: "2", issuerName: "B", weight: 0.6, shares: 1, value: 60 },
      ]),
    ).toBeCloseTo(0.4);
  });

  it("keeps last-good baselines across an unavailable session so recovered returns include the gap", () => {
    const points = reconstructIndex({
      sessions: ["2026-11-09", "2026-11-10", "2026-11-11"],
      filings: [book("2026-11-01", [["AAA", 0.8], ["BBB", 0.2]])],
      prices: new Map([
        ["AAA", series([["2026-11-09", 10], ["2026-11-10", 11], ["2026-11-11", 12]])],
        ["BBB", series([["2026-11-09", 10], ["2026-11-11", 12]])],
      ]),
      fx: series([
        ["2026-11-09", 1.4],
        ["2026-11-10", 1.4],
        ["2026-11-11", 1.4],
      ]),
      spx: series([
        ["2026-11-09", 100],
        ["2026-11-10", 110],
        ["2026-11-11", 121],
      ]),
    });
    expect(points[0]?.givUsd).toBe(100);
    expect(points[0]?.spxUsd).toBe(100);
    expect(points[1]?.status).toBe("unavailable");
    expect(points[1]?.dayReturnUsd).toBeNull();
    expect(points[1]?.spxUsd).toBe(100);
    expect(points[2]?.status).toBe("ok");
    expect(points[2]?.spxUsd).toBeCloseTo(121);
    expect(points[2]?.givUsd).toBeCloseTo(120);
  });

  it("recovers the SPX baseline across a missing intermediate session", () => {
    const points = reconstructIndex({
      sessions: ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"],
      filings: [book("2026-11-01", [["AAA", 1]])],
      prices: new Map([
        [
          "AAA",
          series([
            ["2026-11-09", 10],
            ["2026-11-10", 11],
            ["2026-11-11", 12],
            ["2026-11-12", 12],
          ]),
        ],
      ]),
      fx: series([
        ["2026-11-09", 1.4],
        ["2026-11-10", 1.4],
        ["2026-11-11", 1.4],
        ["2026-11-12", 1.4],
      ]),
      spx: series([
        ["2026-11-09", 100],
        ["2026-11-11", 121],
        ["2026-11-12", 133.1],
      ]),
    });
    expect(points[0]?.spxUsd).toBe(100);
    expect(points[0]?.givAlpha).toBe(100);
    expect(points[1]?.givUsd).toBeCloseTo(110);
    expect(points[1]?.spxReturnUsd).toBeNull();
    expect(points[1]?.givAlpha).toBeNull();
    expect(points[1]?.status).toBe("incomplete");
    expect(points[2]?.spxUsd).toBeCloseTo(121);
    expect(points[2]?.givAlpha).toBeCloseTo((120 / 121) * 100);
    expect(points[3]?.spxUsd).toBeCloseTo(133.1);
    expect(points[3]?.givAlpha).toBeCloseTo((120 / 133.1) * 100);
  });

  it("keeps the last CAD level when the latest session has no FX yet", () => {
    const points = reconstructIndex({
      sessions: ["2026-11-12", "2026-11-13", "2026-11-14"],
      filings: [book("2026-11-01", [["AAA", 1]])],
      prices: new Map([
        [
          "AAA",
          series([
            ["2026-11-12", 10],
            ["2026-11-13", 11],
            ["2026-11-14", 12],
          ]),
        ],
      ]),
      fx: series([
        ["2026-11-12", 1.4],
        ["2026-11-13", 1.4],
      ]),
      spx: series([
        ["2026-11-12", 100],
        ["2026-11-13", 101],
        ["2026-11-14", 102],
      ]),
    });
    expect(points[2]?.givUsd).toBeCloseTo(120);
    expect(points[2]?.givCad).toBeNull();
    expect(latestDisplayPoint(points, "givUsd")?.sessionDate).toBe("2026-11-14");
    expect(latestDisplayPoint(points, "givCad")?.sessionDate).toBe("2026-11-13");
    expect(latestDisplayPoint(points, "givCad")?.givCad).toBeCloseTo(110);
    expect(
      latestDisplayPoint(
        [
          { sessionDate: "2026-10-31", givCad: 110, coverage: 0.98 } as never,
          { sessionDate: "2026-11-02", givCad: 110, coverage: 0 } as never,
        ],
        "givCad",
      ),
    ).toBeNull();
  });

  it("still publishes GIV when SPX history is missing", () => {
    const points = reconstructIndex({
      sessions: ["2026-11-09", "2026-11-10"],
      filings: [book("2026-11-01", [["AAA", 1]])],
      prices: new Map([["AAA", series([["2026-11-09", 10], ["2026-11-10", 11]])]]),
      fx: series([["2026-11-09", 1.4], ["2026-11-10", 1.4]]),
      spx: series([]),
    });
    expect(points[0]?.givUsd).toBe(100);
    expect(points[0]?.spxUsd).toBeNull();
    expect(points[0]?.givAlpha).toBeNull();
    expect(points[0]?.status).toBe("incomplete");
    expect(points[1]?.givUsd).toBeCloseTo(110);
    expect(points[1]?.dayReturnUsd).toBeCloseTo(0.1);
    expect(points[1]?.spxReturnUsd).toBeNull();
    expect(points[1]?.status).toBe("incomplete");
  });

  it("starts FX history at the oldest filing, not the newest", () => {
    expect(
      earliestFiledOn([book("2026-11-14", [["AAA", 1]]), book("2025-02-14", [["AAA", 1]])]),
    ).toBe("2025-02-14");
    expect(earliestFiledOn([])).toBeNull();
  });

  it("returns null MTD/YTD for a later period that has no observations", () => {
    const october = [
      { sessionDate: "2026-10-30", givCad: 100 } as never,
      { sessionDate: "2026-10-31", givCad: 110 } as never,
    ];
    expect(monthToDateReturn(october, "2026-10-31", "givCad")).toBeCloseTo(0.1);
    expect(monthToDateReturn(october, "2026-11-02", "givCad")).toBeNull();
    const yearEnd = [
      { sessionDate: "2025-12-30", givCad: 100 } as never,
      { sessionDate: "2025-12-31", givCad: 110 } as never,
    ];
    expect(yearToDateReturn(yearEnd, "2025-12-31", "givCad")).toBeCloseTo(0.1);
    expect(yearToDateReturn(yearEnd, "2026-01-02", "givCad")).toBeNull();
  });
});
