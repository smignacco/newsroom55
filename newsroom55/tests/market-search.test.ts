import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCsvLine, searchMarketInstruments } from "@/lib/markets/search";

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

describe("Twelve Data symbol search", () => {
  const originalKey = process.env.TWELVE_DATA_API_KEY;
  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env.TWELVE_DATA_API_KEY;
    else process.env.TWELVE_DATA_API_KEY = originalKey;
  });

  it("strips a Yahoo TSX suffix before querying Twelve Data", async () => {
    process.env.TWELVE_DATA_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          data: [
            {
              symbol: "XEQT",
              instrument_name: "iShares Core Equity ETF Portfolio",
              exchange: "NEO",
              mic_code: "NEOE",
              instrument_type: "ETF",
              country: "Canada",
              currency: "CAD",
            },
            {
              symbol: "XEQT",
              instrument_name: "iShares Core Equity ETF Portfolio",
              exchange: "TSX",
              mic_code: "XTSE",
              instrument_type: "ETF",
              country: "Canada",
              currency: "CAD",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchMarketInstruments("XEQT.TO", "twelvedata");
    const requested = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requested.searchParams.get("symbol")).toBe("XEQT");
    expect(result.results[0]).toMatchObject({
      symbol: "XEQT",
      exchange: "TSX",
      twelveSymbol: "XEQT",
      finnhubSymbol: "XEQT.TO",
      cboeEligible: false,
    });
    delete process.env.TWELVE_DATA_API_KEY;
  });
});
