import { afterEach, describe, expect, it, vi } from "vitest";
import { CboeProvider } from "../src/lib/markets/cboe";
import type { SymbolConfig } from "../src/lib/markets/provider";

const apple: SymbolConfig = {
  id: 1,
  symbol: "AAPL",
  displayName: "Apple",
  kind: "equity",
  currency: "USD",
  providerSymbol: "AAPL",
};

afterEach(() => vi.unstubAllGlobals());

describe("Cboe delayed stock provider", () => {
  it("maps the official delayed quote response without altering values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            timestamp: "2026-11-10 21:05:46",
            data: {
              symbol: "AAPL",
              current_price: 349.871,
              price_change: -0.819,
              price_change_percent: -0.2335,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const [quote] = await new CboeProvider().fetchQuotes([apple]);
    expect(quote).toMatchObject({
      price: 349.871,
      changeAbs: -0.819,
      changePct: -0.2335,
      status: "DELAYED",
      provider: "cboe",
      asOf: "2026-11-10T21:05:46.000Z",
    });
  });

  it("returns unavailable on invalid or failed symbols", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const [quote] = await new CboeProvider().fetchQuotes([apple]);
    expect(quote).toMatchObject({ price: null, changePct: null, status: "UNAVAILABLE" });
  });

  it("does not call Cboe for a TSX listing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const [quote] = await new CboeProvider().fetchQuotes([
      {
        id: 9,
        symbol: "XEQT",
        displayName: "iShares Core Equity ETF Portfolio",
        kind: "fund",
        currency: "CAD",
        providerSymbol: "XEQT.TO",
        exchange: "TSX",
      },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(quote).toMatchObject({ price: null, status: "UNAVAILABLE", provider: "cboe" });
  });
});
