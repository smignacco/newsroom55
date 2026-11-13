import { afterEach, describe, expect, it, vi } from "vitest";
import { YahooDelayedProvider } from "../src/lib/markets/yahoo";
import type { SymbolConfig } from "@/lib/markets/provider";

const xeqt: SymbolConfig = {
  id: 9,
  symbol: "XEQT",
  displayName: "iShares Core Equity ETF Portfolio",
  kind: "fund",
  currency: "CAD",
  providerSymbol: "XEQT.TO",
  exchange: "TSX",
};

afterEach(() => vi.unstubAllGlobals());

describe("Yahoo delayed Canadian quotes", () => {
  it("maps the official chart meta without inventing a last price", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                meta: {
                  currency: "CAD",
                  symbol: "XEQT.TO",
                  regularMarketPrice: 45.47,
                  regularMarketTime: 1_794_599_511,
                  regularMarketChangePercent: -0.241,
                  fulldayChange: -0.11,
                  fulldayChangePercent: -0.241,
                },
              },
            ],
            error: null,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [quote] = await new YahooDelayedProvider().fetchQuotes([xeqt]);
    const requested = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requested.pathname).toContain("/XEQT.TO");
    expect(quote).toMatchObject({
      price: 45.47,
      changeAbs: -0.11,
      changePct: -0.241,
      currency: "CAD",
      status: "DELAYED",
      provider: "yahoo",
      asOf: "2026-11-13T19:51:51.000Z",
    });
  });

  it("returns unavailable on a zero last price and does not call Yahoo for Cboe names", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            chart: {
              result: [{ meta: { symbol: "XEQT.TO", regularMarketPrice: 0 } }],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const [missing] = await new YahooDelayedProvider().fetchQuotes([xeqt]);
    expect(missing).toMatchObject({ price: null, status: "UNAVAILABLE", provider: "yahoo" });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const [apple] = await new YahooDelayedProvider().fetchQuotes([
      {
        id: 1,
        symbol: "AAPL",
        displayName: "Apple",
        kind: "equity",
        currency: "USD",
        providerSymbol: "AAPL",
      },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(apple.status).toBe("UNAVAILABLE");
  });
});
