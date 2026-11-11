import { describe, expect, it } from "vitest";
import { parseCsvLine } from "@/lib/markets/search";

describe("market instrument search", () => {
  it("parses quoted company names from the Cboe directory", () => {
    expect(
      parseCsvLine(
        '"VANGUARD S&P 500 ETF, CLASS A","VOO","Market Maker, LLC","1/2","-"',
      ),
    ).toEqual([
      "VANGUARD S&P 500 ETF, CLASS A",
      "VOO",
      "Market Maker, LLC",
      "1/2",
      "-",
    ]);
  });

  it("handles escaped quotes in official CSV fields", () => {
    expect(parseCsvLine('"ACME ""GLOBAL"" FUND","ACME"')).toEqual([
      'ACME "GLOBAL" FUND',
      "ACME",
    ]);
  });
});
