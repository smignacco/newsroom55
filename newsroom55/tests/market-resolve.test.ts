import { describe, expect, it } from "vitest";
import {
  parsePriceField,
  recommendQuoteProvider,
  resolveListedInstrument,
  searchTicker,
  usableMarketPrice,
} from "@/lib/markets/resolve";

describe("listed instrument resolution", () => {
  it("maps a Yahoo TSX suffix to Twelve Data TSX/XTSE and Finnhub .TO", () => {
    const listed = resolveListedInstrument("XEQT.TO", null, "XEQT.TO", "CAD", "fund");
    expect(listed).toMatchObject({
      ticker: "XEQT",
      exchange: "TSX",
      micCode: "XTSE",
      yahooSuffix: "TO",
      twelveSymbol: "XEQT",
      twelveExchange: "TSX",
      finnhubSymbol: "XEQT.TO",
      cboeEligible: false,
      canadian: true,
    });
  });

  it("maps a stored TSX exchange without a suffix", () => {
    const listed = resolveListedInstrument("XEQT", "TSX", "XEQT", "CAD", "fund");
    expect(listed.finnhubSymbol).toBe("XEQT.TO");
    expect(listed.twelveExchange).toBe("TSX");
    expect(listed.cboeEligible).toBe(false);
  });

  it("maps TSXV and NEO suffixes", () => {
    expect(resolveListedInstrument("WELL.V").exchange).toBe("TSXV");
    expect(resolveListedInstrument("XEQT.NE").exchange).toBe("NEO");
    expect(searchTicker("XEQT.TO")).toEqual({
      ticker: "XEQT",
      exchange: "TSX",
      yahoo: "XEQT.TO",
    });
  });

  it("keeps US equities on Cboe and preserves index provider codes", () => {
    const apple = resolveListedInstrument("AAPL", null, "AAPL", "USD", "equity");
    expect(apple.cboeEligible).toBe(true);
    expect(apple.finnhubSymbol).toBe("AAPL");
    const spx = resolveListedInstrument("SPX", null, "^GSPC", "USD", "index");
    expect(spx.twelveSymbol).toBe("^GSPC");
    expect(spx.finnhubSymbol).toBe("SPX");
    expect(spx.cboeEligible).toBe(false);
  });

  it("treats a zero or missing last price as absent", () => {
    expect(usableMarketPrice(0)).toBe(false);
    expect(parsePriceField("0")).toBeNull();
    expect(parsePriceField("0.00000")).toBeNull();
    expect(parsePriceField("45.58")).toBe(45.58);
  });

  it("recommends Twelve Data then Finnhub for Canadian listings", () => {
    const xeqt = resolveListedInstrument("XEQT.TO");
    expect(
      recommendQuoteProvider(xeqt, { twelve: true, finnhub: true }),
    ).toBe("twelvedata");
    expect(
      recommendQuoteProvider(xeqt, { twelve: false, finnhub: true }),
    ).toBe("finnhub");
    expect(
      recommendQuoteProvider(resolveListedInstrument("AAPL", null, "AAPL", "USD", "equity"), {
        twelve: true,
        finnhub: true,
      }),
    ).toBe("cboe");
  });
});
