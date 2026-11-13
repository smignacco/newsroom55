import { afterEach, describe, expect, it, vi } from "vitest";
import { FinnhubProvider } from "@/lib/markets/finnhub";
import type { SymbolConfig } from "@/lib/markets/provider";

const xeqt: SymbolConfig = {
  id: 9,
  symbol: "XEQT",
  displayName: "iShares Core Equity ETF Portfolio",
  kind: "fund",
  currency: "CAD",
  providerSymbol: "XEQT",
  exchange: "TSX",
};

afterEach(() => vi.unstubAllGlobals());

describe("Finnhub quotes", () => {
  it("sends the Yahoo TSX suffix and refuses a zero last price", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ c: 0, d: null, dp: null, t: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [quote] = await new FinnhubProvider("test-token").fetchQuotes([xeqt]);
    const requested = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requested.searchParams.get("symbol")).toBe("XEQT.TO");
    expect(quote).toMatchObject({ price: null, status: "UNAVAILABLE", provider: "finnhub" });
  });

  it("marks the Finnhub quota exhausted on HTTP 429 and stops the batch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "API limit reached" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new FinnhubProvider("test-token");
    const quotes = await provider.fetchQuotes([
      xeqt,
      { ...xeqt, id: 10, symbol: "SHOP", providerSymbol: "SHOP.TO" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(provider.quotaExhausted).toBe(true);
    expect(quotes).toHaveLength(2);
    expect(quotes.every((quote) => quote.status === "UNAVAILABLE")).toBe(true);
  });
});
