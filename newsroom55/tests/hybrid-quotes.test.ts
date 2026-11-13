import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type { SymbolConfig } from "@/lib/markets/provider";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "newsroom-hybrid-quotes-"));
process.env.DATA_DIR = dataDir;
process.env.MARKETS_PROVIDER = "hybrid";
process.env.TWELVE_DATA_API_KEY = "test-twelve";
process.env.FINNHUB_API_KEY = "test-finnhub";

const apple: SymbolConfig = {
  id: 1,
  symbol: "AAPL",
  displayName: "Apple",
  kind: "equity",
  currency: "USD",
  providerSymbol: "AAPL",
  quoteProvider: "cboe",
};

const xeqt: SymbolConfig = {
  id: 2,
  symbol: "XEQT",
  displayName: "iShares Core Equity ETF Portfolio",
  kind: "fund",
  currency: "CAD",
  providerSymbol: "XEQT.TO",
  exchange: "TSX",
  quoteProvider: "twelvedata",
};

afterAll(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  const { setSetting } = await import("@/lib/database");
  setSetting("markets_finnhub_quota_until", "");
  setSetting("markets_twelve_quota_until", "");
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("hybrid live-first quote routing", () => {
  it("uses Finnhub for a Cboe-eligible name when Finnhub is under quota", async () => {
    const { refreshHybridQuotes } = await import("@/lib/markets/service");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("finnhub.io")) {
        return jsonResponse({ c: 190.25, d: 1.1, dp: 0.58, t: 1_700_000_000 });
      }
      if (url.includes("cdn.cboe.com")) {
        return jsonResponse({
          timestamp: "2026-11-13 18:00:00",
          data: { symbol: "AAPL", current_price: 189.1, price_change: 0, price_change_percent: 0 },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const [quote] = await refreshHybridQuotes([apple], false);
    expect(quote).toMatchObject({
      symbol: "AAPL",
      price: 190.25,
      provider: "finnhub",
      status: "DELAYED",
    });
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("cdn.cboe.com"))).toBe(
      false,
    );
  });

  it("falls back to delayed Cboe when Finnhub returns 429", async () => {
    const { refreshHybridQuotes } = await import("@/lib/markets/service");
    const { setSetting } = await import("@/lib/database");
    setSetting("markets_finnhub_quota_until", "");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("finnhub.io")) {
        return jsonResponse({ error: "API limit reached" }, 429);
      }
      if (url.includes("cdn.cboe.com")) {
        return jsonResponse({
          timestamp: "2026-11-13 18:00:00",
          data: {
            symbol: "AAPL",
            current_price: 188.4,
            price_change: -0.2,
            price_change_percent: -0.1,
          },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const [quote] = await refreshHybridQuotes([apple], false);
    expect(quote).toMatchObject({
      price: 188.4,
      provider: "cboe",
      status: "DELAYED",
    });
  });

  it("never invents a last price when live sources fail and Cboe cannot serve the listing", async () => {
    const { refreshHybridQuotes } = await import("@/lib/markets/service");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("twelvedata.com")) {
          return jsonResponse({ close: "0.00000", percent_change: "0" });
        }
        if (url.includes("finnhub.io")) {
          return jsonResponse({ c: 0, d: null, dp: null, t: 0 });
        }
        throw new Error(`Cboe must not be called for ${url}`);
      }),
    );

    const [quote] = await refreshHybridQuotes([xeqt], true);
    expect(quote).toMatchObject({
      price: null,
      status: "UNAVAILABLE",
    });
  });

  it("keeps the Twelve Data 6-symbol cap and sends overflow to Finnhub", async () => {
    const { refreshHybridQuotes } = await import("@/lib/markets/service");
    const cad = Array.from({ length: 7 }, (_, index) => ({
      ...xeqt,
      id: index + 10,
      symbol: `CAD${index}`,
      providerSymbol: `CAD${index}.TO`,
    }));
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("twelvedata.com")) {
        return jsonResponse({
          close: "12.5",
          change: "0.1",
          percent_change: "0.8",
          datetime: "2026-11-13 12:00:00",
        });
      }
      if (url.includes("finnhub.io")) {
        return jsonResponse({ c: 11.2, d: 0.2, dp: 1.8, t: 1_700_000_000 });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const quotes = await refreshHybridQuotes(cad, true);
    const twelveCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("twelvedata.com"),
    );
    const finnhubCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("finnhub.io"),
    );
    expect(twelveCalls).toHaveLength(6);
    expect(finnhubCalls).toHaveLength(1);
    expect(quotes.filter((quote) => quote.provider === "twelvedata")).toHaveLength(6);
    expect(quotes.filter((quote) => quote.provider === "finnhub")).toHaveLength(1);
  });
});
