import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "newsroom-giverny-upload-"));
process.env.DATA_DIR = dataDir;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const fixture = fs.readFileSync(
  path.join(process.cwd(), "tests/fixtures/giverny-13f-infotable.xml"),
  "utf8",
);

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({}),
      text: async () => "",
    })),
  );
}

describe("manual 13F XML import", () => {
  it("refuses XML without an info table and does not invent a book", async () => {
    const { ingestUploadedFiling } = await import("@/lib/giverny/service");
    await expect(
      ingestUploadedFiling("<edgarSubmission><headerData>empty</headerData></edgarSubmission>"),
    ).rejects.toThrow(/infoTable/);
  });

  it("requires a real accession instead of synthesizing one", async () => {
    const { ingestUploadedFiling } = await import("@/lib/giverny/service");
    await expect(ingestUploadedFiling(fixture)).rejects.toThrow(/accession/);
  });

  it("requires the public filing date instead of substituting the report period", async () => {
    const { ingestUploadedFiling } = await import("@/lib/giverny/service");
    await expect(
      ingestUploadedFiling(fixture, "0001641864-26-000011"),
    ).rejects.toThrow(/Date de dépôt public/);
  });

  it("stores the uploaded table on the filing date, never a hardcoded book", async () => {
    stubFetch();
    const { ingestUploadedFiling } = await import("@/lib/giverny/service");
    const { listFilings, listHoldings } = await import("@/lib/giverny/store");
    const stored = await ingestUploadedFiling(
      fixture,
      "0001641864-26-000011",
      "2026-11-12",
    );
    expect(stored).toEqual({ accession: "0001641864-26-000011", holdings: 8 });
    const filing = listFilings()[0];
    expect(filing?.accession).toBe("0001641864-26-000011");
    expect(filing?.filedAt.slice(0, 10)).toBe("2026-11-12");
    expect(filing?.periodOfReport.slice(0, 10)).toBe("2026-09-30");
    expect(listHoldings(filing.id)).toHaveLength(8);
    expect(listHoldings(filing.id).some((row) => row.cusip === "30303M102")).toBe(true);
  });

  it("accepts namespace-prefixed information-table elements", async () => {
    stubFetch();
    const { ingestUploadedFiling } = await import("@/lib/giverny/service");
    const { listFilings, listHoldings } = await import("@/lib/giverny/store");
    const namespaced = fixture
      .replaceAll("<infoTable>", "<ns1:infoTable>")
      .replaceAll("</infoTable>", "</ns1:infoTable>");
    expect(namespaced).toContain("<ns1:infoTable>");
    expect(namespaced).not.toMatch(/<infoTable\b/);
    const stored = await ingestUploadedFiling(
      namespaced,
      "0001641864-26-000012",
      "2026-11-12",
    );
    expect(stored.holdings).toBe(8);
    const filing = listFilings().find((row) => row.accession === "0001641864-26-000012");
    expect(filing).toBeTruthy();
    expect(listHoldings(filing!.id)).toHaveLength(8);
  });

  it("batches unauthenticated OpenFIGI jobs and writes tickers onto stored holdings", async () => {
    delete process.env.OPENFIGI_API_KEY;
    const jobs = Array.from({ length: 12 }, (_, index) => ({
      cusip: String(index + 1).padStart(9, "0"),
      issuerName: `Issuer ${index + 1}`,
    }));
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "[]")) as Array<{ idValue: string }>;
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () =>
          body.map((row) => ({
            data: [
              {
                ticker: `T${row.idValue.slice(-2)}`,
                exchCode: "US",
                marketSector: "Equity",
                securityType: "Common Stock",
              },
            ],
          })),
        text: async () => "",
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const { mapCusips, openFigiBatchSize } = await import("@/lib/giverny/cusip");
    expect(openFigiBatchSize()).toBe(10);
    const { mapped } = await mapCusips(jobs);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || "[]"))).toHaveLength(10);
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || "[]"))).toHaveLength(2);
    expect(mapped.size).toBe(12);

    const { applyCusipMapToHoldings, listFilings, listHoldings, replaceFiling } = await import(
      "@/lib/giverny/store"
    );
    replaceFiling({
      accession: "0001641864-26-000099",
      cik: "0001641864",
      filerName: "Giverny Capital Inc.",
      form: "13F-HR",
      periodOfReport: "2026-09-30",
      filedAt: "2026-11-12",
      acceptedAt: null,
      documentUrl: "https://www.sec.gov/",
      tableValueTotal: 1200,
      holdings: jobs.map((row) => ({
        cusip: row.cusip,
        issuerName: row.issuerName,
        titleOfClass: "COM",
        ticker: null,
        shares: 1,
        value: 100,
        putCall: null,
        shareType: "SH",
        derivative: false,
        weight: 1 / jobs.length,
      })),
    });
    applyCusipMapToHoldings(mapped);
    const filing = listFilings().find((row) => row.accession === "0001641864-26-000099");
    expect(filing?.mappedCount).toBe(12);
    expect(listHoldings(filing!.id).every((row) => Boolean(row.ticker))).toBe(true);
  });

  it("does not display an FX-only MTD when coverage is below the floor", async () => {
    stubFetch();
    const { ingestUploadedFiling, getGivernySummary } = await import("@/lib/giverny/service");
    const { replaceIndexPoints } = await import("@/lib/giverny/store");
    await ingestUploadedFiling(fixture, "0001641864-26-000013", "2026-11-12");
    replaceIndexPoints([
      {
        sessionDate: "2026-11-02",
        givUsd: 100,
        givCad: 100,
        givAlpha: 100,
        spxUsd: 100,
        spxCad: 100,
        usdCad: 1.4,
        dayReturnUsd: null,
        dayReturnCad: null,
        spxReturnUsd: null,
        coverage: 0,
        status: "unavailable",
        accession: "0001641864-26-000013",
      },
      {
        sessionDate: "2026-11-18",
        givUsd: 100,
        givCad: 100.25,
        givAlpha: 100,
        spxUsd: 100,
        spxCad: 100,
        usdCad: 1.4035,
        dayReturnUsd: null,
        dayReturnCad: 0.0025,
        spxReturnUsd: 0,
        coverage: 0,
        status: "unavailable",
        accession: "0001641864-26-000013",
      },
    ]);
    const summary = getGivernySummary();
    expect(summary.marketStatus).toBe("unavailable");
    expect(summary.returns.mtd).toBeNull();
    expect(summary.returns.ytd).toBeNull();
    expect(summary.levels.givCad).toBeNull();
    expect(summary.levels.givAlpha).toBeNull();
  });
});
