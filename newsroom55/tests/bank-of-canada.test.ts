import { afterEach, describe, expect, it, vi } from "vitest";
import { BankOfCanadaProvider } from "../src/lib/markets/bank-of-canada";
import type { SymbolConfig } from "../src/lib/markets/provider";

const usdCad: SymbolConfig = {
  id: 1,
  symbol: "USD/CAD",
  displayName: "US dollar in Canadian dollars",
  kind: "fx-public",
  currency: "CAD",
  providerSymbol: "FXUSDCAD",
};

afterEach(() => vi.unstubAllGlobals());

describe("Bank of Canada public provider", () => {
  it("returns delayed observations and computes the daily change", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            observations: [
              { d: "2026-11-10", FXUSDCAD: { v: "1.4200" } },
              { d: "2026-11-09", FXUSDCAD: { v: "1.4000" } },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const [quote] = await new BankOfCanadaProvider().fetchQuotes([usdCad]);
    expect(quote).toMatchObject({
      price: 1.42,
      status: "DELAYED",
      provider: "bankofcanada",
      asOf: "2026-11-10",
    });
    expect(quote.changeAbs).toBeCloseTo(0.02, 8);
    expect(quote.changePct).toBeCloseTo(1.42857, 4);
  });

  it("returns unavailable instead of inventing data on an API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const [quote] = await new BankOfCanadaProvider().fetchQuotes([usdCad]);
    expect(quote).toMatchObject({ price: null, changePct: null, status: "UNAVAILABLE" });
  });
});
