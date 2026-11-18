import { afterEach, describe, expect, it, vi } from "vitest";
import { EDGAR_CONTACT_EMAIL, EDGAR_BLOCKED_FR } from "../src/lib/giverny/types";
import { fetchText, isEdgarUrl, requestHeaders } from "../src/lib/giverny/http";
import { listEdgarFilings, parseEftsFilings } from "../src/lib/giverny/edgar";
import { secUserAgent } from "../src/lib/giverny/identity";

afterEach(() => {
  delete process.env.EDGAR_CONTACT_EMAIL;
  delete process.env.EDGAR_USER_AGENT;
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

describe("EDGAR HTTP identity", () => {
  it("sends a declared SEC User-Agent, contact, and never a Host override", () => {
    const headers = requestHeaders("https://data.sec.gov/submissions/CIK0001641864.json", {
      host: "data.sec.gov",
    });
    expect(isEdgarUrl("https://data.sec.gov/submissions/CIK0001641864.json")).toBe(true);
    expect(headers["user-agent"]).toBe(secUserAgent(EDGAR_CONTACT_EMAIL));
    expect(headers["user-agent"]).toMatch(/^NEWSROOM55 GivernyTracker /);
    expect(headers["user-agent"]).not.toMatch(/Mozilla\/5\.0/);
    expect(headers.from).toBe(EDGAR_CONTACT_EMAIL);
    expect(headers.referer).toBe("https://www.sec.gov/");
    expect(headers.host).toBeUndefined();
    expect(headers.Host).toBeUndefined();
  });

  it("uses EDGAR_CONTACT_EMAIL when it is a reachable address", () => {
    process.env.EDGAR_CONTACT_EMAIL = "desk@example.com";
    const headers = requestHeaders("https://data.sec.gov/submissions/CIK0001641864.json");
    expect(headers.from).toBe("desk@example.com");
    expect(headers["user-agent"]).toBe("NEWSROOM55 GivernyTracker desk@example.com");
  });

  it("does not apply the SEC profile to Yahoo or Bank of Canada", () => {
    const yahoo = requestHeaders("https://query1.finance.yahoo.com/v8/finance/chart/AAPL");
    expect(yahoo["user-agent"]).toBe("NEWSROOM55/1.0");
    expect(yahoo.from).toBeUndefined();
  });

  it("retries EDGAR 403 with backoff then returns the failed response", async () => {
    const fetchMock = vi.fn(async () => fakeResponse(403, "Your Request Originates from an Undeclared Automated Tool"));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchText("https://data.sec.gov/submissions/CIK0001641864.json", {
      attempts: 3,
      backoffMs: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const firstInit = (fetchMock.mock.calls[0] as unknown[])[1] as
      | { headers?: Record<string, string> }
      | undefined;
    expect(firstInit?.headers?.from).toBe(EDGAR_CONTACT_EMAIL);
    expect(firstInit?.headers?.["user-agent"]).toMatch(/^NEWSROOM55 GivernyTracker /);
  });

  it("recovers after a transient EDGAR 403", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(403, "blocked"))
      .mockResolvedValueOnce(fakeResponse(200, '{"ok":true}'));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchText("https://efts.sec.gov/LATEST/search-index", { attempts: 4, backoffMs: 0 });
    expect(result.ok).toBe(true);
    expect(result.body).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses native TLS when Node is forbidden", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fakeResponse(403, "blocked")));
    const nativeFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: '{"cik":"0001641864"}',
    }));
    const result = await fetchText("https://data.sec.gov/submissions/CIK0001641864.json", {
      attempts: 1,
      backoffMs: 0,
      nativeFetch,
    });
    expect(result.ok).toBe(true);
    expect(result.body).toContain("0001641864");
    expect(nativeFetch).toHaveBeenCalledTimes(1);
  });
});

describe("13F listing fallbacks", () => {
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

  it("keeps the French refusal when every EDGAR host blocks automated traffic", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fakeResponse(403, "blocked")));
    const listed = await listEdgarFilings("0001641864");
    expect(listed.filings).toEqual([]);
    expect(listed.error).toBe(EDGAR_BLOCKED_FR);
    expect(listed.source).toBe("sec-edgar");
  });

  it("uses the atom feed when submissions JSON is refused", async () => {
    const atom = `<?xml version="1.0"?>
      <feed>
        <conformed-name>Giverny Capital Inc.</conformed-name>
        <entry>
          <filing-type>13F-HR</filing-type>
          <accession-number>0001641864-26-000011</accession-number>
          <filing-date>2026-11-12</filing-date>
        </entry>
      </feed>`;
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("browse-edgar")) return fakeResponse(200, atom);
      return fakeResponse(403, "blocked");
    });
    vi.stubGlobal("fetch", fetchMock);
    const listed = await listEdgarFilings("0001641864");
    expect(listed.error).toBeNull();
    expect(listed.source).toBe("sec-atom");
    expect(listed.filings[0]?.accession).toBe("0001641864-26-000011");
    expect(listed.name).toBe("Giverny Capital Inc.");
  });
});
