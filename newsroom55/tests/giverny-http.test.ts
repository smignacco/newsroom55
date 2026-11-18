import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchText, requestHeaders } from "../src/lib/giverny/http";
import { parseEftsFilings } from "../src/lib/giverny/edgar";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function fakeResponse(status: number, body: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name: string) {
        return name.toLowerCase() === "content-length" ? String(Buffer.byteLength(body, "utf8")) : null;
      },
    },
    text: async () => body,
  };
}

describe("Giverny HTTP", () => {
  it("uses a generic NEWSROOM User-Agent and never a Host override", () => {
    const yahoo = requestHeaders("https://query1.finance.yahoo.com/v8/finance/chart/AAPL", {
      host: "query1.finance.yahoo.com",
    });
    expect(yahoo["user-agent"]).toBe("NEWSROOM55/1.0");
    expect(yahoo.from).toBeUndefined();
    expect(yahoo.referer).toBeUndefined();
    expect(yahoo.host).toBeUndefined();
    expect(yahoo.Host).toBeUndefined();
  });

  it("does not attach a SEC identity even when the URL is on sec.gov", () => {
    const headers = requestHeaders("https://data.sec.gov/submissions/CIK0001641864.json");
    expect(headers["user-agent"]).toBe("NEWSROOM55/1.0");
    expect(headers.from).toBeUndefined();
    expect(headers.referer).toBeUndefined();
  });

  it("retries 429 then returns the failed response", async () => {
    const fetchMock = vi.fn(async () => fakeResponse(429, "rate limited"));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchText("https://query1.finance.yahoo.com/v8/finance/chart/AAPL", {
      attempts: 3,
      backoffMs: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry HTTP 403", async () => {
    const fetchMock = vi.fn(async () => fakeResponse(403, "forbidden"));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchText("https://data.sec.gov/submissions/CIK0001641864.json", {
      attempts: 3,
      backoffMs: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("13F parsers without SEC retrieval", () => {
  it("parses EFTS hits without inventing a book", () => {
    const parsed = parseEftsFilings({
      hits: {
        hits: [
          {
            _source: {
              adsh: "0001641864-26-000011",
              file_date: "2026-11-12",
              period_ending: "2026-09-30",
              form: "13F-HR",
              display_names: ["Giverny Capital Inc.  (CIK 0001641864)"],
            },
          },
        ],
      },
    });
    expect(parsed.name).toBe("Giverny Capital Inc.");
    expect(parsed.filings).toEqual([
      {
        accession: "0001641864-26-000011",
        form: "13F-HR",
        filingDate: "2026-11-12",
        reportDate: "2026-09-30",
        primaryDocument: null,
        acceptanceDateTime: null,
      },
    ]);
    expect(parseEftsFilings({ hits: { hits: [] } }).filings).toEqual([]);
  });

  it("does not fetch 13F filings from SEC hosts", () => {
    const files = ["service.ts", "edgar.ts", "http.ts"].map((name) =>
      readFileSync(path.resolve(process.cwd(), "src/lib/giverny", name), "utf8"),
    );
    const joined = files.join("\n");
    expect(joined).not.toMatch(/listEdgarFilings|ingestFilings|data\.sec\.gov|efts\.sec\.gov|browse-edgar/);
  });
});
