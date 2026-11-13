import { describe, expect, it } from "vitest";
import {
  parsePriceField,
  rankTwelveTargets,
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

  it("defaults a CAD listing without exchange to the TSX Yahoo suffix", () => {
    const listed = resolveListedInstrument("XEQT", null, "XEQT", "CAD", "fund");
    expect(listed.finnhubSymbol).toBe("XEQT.TO");
    expect(listed.yahooSuffix).toBe("TO");
    expect(listed.cboeEligible).toBe(false);
  });

  it("does not infer .TO on a Canadian index identifier", () => {
    const tsx = resolveListedInstrument("GSPTSE", null, "GSPTSE", "CAD", "index");
    expect(tsx.finnhubSymbol).toBe("GSPTSE");
    expect(tsx.yahooSuffix).toBeNull();
    expect(tsx.cboeEligible).toBe(false);

    const caret = resolveListedInstrument("GSPTSE", null, "^GSPTSE", "CAD", "index");
    expect(caret.twelveSymbol).toBe("^GSPTSE");
    expect(caret.finnhubSymbol).toBe("GSPTSE");
    expect(caret.yahooSuffix).toBeNull();
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

  it("keeps US equities Cboe-eligible and preserves index provider codes", () => {
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

  it("keeps dots that are part of the ticker and explicit non-Canadian exchanges", () => {
    const berkshire = resolveListedInstrument("BRK.B", null, "BRK.B", "USD", "equity");
    expect(berkshire.ticker).toBe("BRK.B");
    expect(berkshire.twelveSymbol).toBe("BRK.B");
    expect(berkshire.cboeEligible).toBe(true);

    const dlr = resolveListedInstrument("DLR.U", "TSX", "DLR.U", "CAD", "fund");
    expect(dlr.ticker).toBe("DLR.U");
    expect(dlr.twelveSymbol).toBe("DLR.U");
    expect(dlr.twelveExchange).toBe("TSX");
    expect(dlr.finnhubSymbol).toBe("DLR.U.TO");

    const vod = resolveListedInstrument("VOD", "LSE", "VOD", "GBP", "equity");
    expect(vod.twelveSymbol).toBe("VOD");
    expect(vod.twelveExchange).toBe("LSE");
    expect(vod.exchange).toBe("LSE");
    expect(vod.cboeEligible).toBe(false);
  });

  it("prefers live vendors while they are available, then delayed Cboe for US names", () => {
    const xeqt = resolveListedInstrument("XEQT.TO");
    expect(
      recommendQuoteProvider(xeqt, { twelve: true, finnhub: true }),
    ).toBe("twelvedata");
    expect(
      recommendQuoteProvider(xeqt, { twelve: false, finnhub: true }),
    ).toBe("finnhub");
    const apple = resolveListedInstrument("AAPL", null, "AAPL", "USD", "equity");
    expect(recommendQuoteProvider(apple, { twelve: true, finnhub: true })).toBe(
      "finnhub",
    );
    expect(recommendQuoteProvider(apple, { twelve: true, finnhub: false })).toBe(
      "twelvedata",
    );
    expect(recommendQuoteProvider(apple, { twelve: false, finnhub: false })).toBe(
      "cboe",
    );
  });

  it("gives Twelve Data slots to listings Cboe cannot serve first", () => {
    const ranked = rankTwelveTargets(
      [
        {
          id: 1,
          symbol: "AAPL",
          displayName: "Apple",
          kind: "equity",
          currency: "USD",
          providerSymbol: "AAPL",
          quoteProvider: "cboe",
        },
        {
          id: 2,
          symbol: "XEQT",
          displayName: "XEQT",
          kind: "fund",
          currency: "CAD",
          providerSymbol: "XEQT.TO",
          exchange: "TSX",
          quoteProvider: "twelvedata",
        },
        {
          id: 3,
          symbol: "MSFT",
          displayName: "Microsoft",
          kind: "equity",
          currency: "USD",
          providerSymbol: "MSFT",
          quoteProvider: "twelvedata",
        },
      ],
      2,
    );
    expect(ranked.map((row) => row.symbol)).toEqual(["XEQT", "MSFT"]);
  });
});
