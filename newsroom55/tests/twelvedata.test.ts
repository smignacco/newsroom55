import { afterEach, describe, expect, it, vi } from "vitest";
import { TwelveDataProvider } from "@/lib/markets/twelvedata";
import type { SymbolConfig } from "@/lib/markets/provider";

const xeqt: SymbolConfig = {
  id: 9,
  symbol: "XEQT",
  displayName: "iShares Core Equity ETF Portfolio",
  kind: "fund",
  currency: "CAD",
  providerSymbol: "XEQT.TO",
  exchange: null,
};

afterEach(() => vi.unstubAllGlobals());

describe("Twelve Data quotes", () => {
  it("requests the TSX ticker and exchange rather than the Yahoo suffix", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "error",
          code: 400,
          message: "Unable to fetch data for this symbol",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [quote] = await new TwelveDataProvider("test-key").fetchQuotes([xeqt]);
    const requested = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requested.searchParams.get("symbol")).toBe("XEQT");
    expect(requested.searchParams.get("exchange")).toBe("TSX");
    expect(requested.searchParams.get("mic_code")).toBe("XTSE");
    expect(requested.searchParams.get("symbol")).not.toBe("XEQT.TO");
    expect(quote).toMatchObject({ price: null, status: "UNAVAILABLE", provider: "twelvedata" });
  });

  it("stops further Twelve Data calls when the credit quota is exhausted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "error", code: 429, message: "run out of API credits" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new TwelveDataProvider("test-key");
    const quotes = await provider.fetchQuotes([
      xeqt,
      { ...xeqt, id: 10, symbol: "SHOP", providerSymbol: "SHOP.TO" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(provider.quotaExhausted).toBe(true);
    expect(quotes.every((quote) => quote.status === "UNAVAILABLE")).toBe(true);
  });

  it("does not treat a zero close as a real last price", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ close: "0.00000", percent_change: "0" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const [quote] = await new TwelveDataProvider("test-key").fetchQuotes([xeqt]);
    expect(quote.price).toBeNull();
    expect(quote.status).toBe("UNAVAILABLE");
  });
});
