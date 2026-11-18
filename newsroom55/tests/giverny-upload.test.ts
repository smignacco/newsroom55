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

  it("stores the uploaded table and never a hardcoded book", async () => {
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
    const { ingestUploadedFiling } = await import("@/lib/giverny/service");
    const { listFilings, listHoldings } = await import("@/lib/giverny/store");
    const stored = await ingestUploadedFiling(fixture, "0001641864-26-000011");
    expect(stored).toEqual({ accession: "0001641864-26-000011", holdings: 8 });
    const filing = listFilings()[0];
    expect(filing?.accession).toBe("0001641864-26-000011");
    expect(listHoldings(filing.id)).toHaveLength(8);
    expect(listHoldings(filing.id).some((row) => row.cusip === "30303M102")).toBe(true);
  });
});
