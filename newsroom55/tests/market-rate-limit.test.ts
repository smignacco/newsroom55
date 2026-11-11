import { afterEach, describe, expect, it } from "vitest";
import {
  marketRefreshIntervalMs,
  marketsProviderName,
  twelveDataMaxSymbols,
  twelveDataRefreshMinutes,
} from "@/lib/config";

const originalRefresh = process.env.TWELVE_DATA_REFRESH_MINUTES;
const originalMax = process.env.TWELVE_DATA_MAX_SYMBOLS;
const originalProvider = process.env.MARKETS_PROVIDER;
const originalKey = process.env.TWELVE_DATA_API_KEY;

afterEach(() => {
  if (originalRefresh === undefined) delete process.env.TWELVE_DATA_REFRESH_MINUTES;
  else process.env.TWELVE_DATA_REFRESH_MINUTES = originalRefresh;
  if (originalMax === undefined) delete process.env.TWELVE_DATA_MAX_SYMBOLS;
  else process.env.TWELVE_DATA_MAX_SYMBOLS = originalMax;
  if (originalProvider === undefined) delete process.env.MARKETS_PROVIDER;
  else process.env.MARKETS_PROVIDER = originalProvider;
  if (originalKey === undefined) delete process.env.TWELVE_DATA_API_KEY;
  else process.env.TWELVE_DATA_API_KEY = originalKey;
});

describe("Twelve Data free-tier guardrails", () => {
  it("uses a conservative default refresh period and symbol cap", () => {
    delete process.env.TWELVE_DATA_REFRESH_MINUTES;
    delete process.env.TWELVE_DATA_MAX_SYMBOLS;
    expect(twelveDataRefreshMinutes()).toBe(30);
    expect(twelveDataMaxSymbols()).toBe(6);
    expect(marketRefreshIntervalMs("twelvedata")).toBe(30 * 60_000);
  });

  it("does not allow settings faster or wider than the protected bounds", () => {
    process.env.TWELVE_DATA_REFRESH_MINUTES = "1";
    process.env.TWELVE_DATA_MAX_SYMBOLS = "99";
    expect(twelveDataRefreshMinutes()).toBe(15);
    expect(twelveDataMaxSymbols()).toBe(6);
  });

  it("activates hybrid routing only when Twelve Data is configured", () => {
    process.env.MARKETS_PROVIDER = "hybrid";
    delete process.env.TWELVE_DATA_API_KEY;
    expect(marketsProviderName()).toBe("cboe");
    process.env.TWELVE_DATA_API_KEY = "configured-test-key";
    expect(marketsProviderName()).toBe("hybrid");
  });
});
