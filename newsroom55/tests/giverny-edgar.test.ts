import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse13FDocuments, weightsFromHoldings } from "../src/lib/giverny/parse-13f";
import { filingStoredDate, parseAtomFilings, pickLatestFilings } from "../src/lib/giverny/edgar";
import { pickOpenFigiTicker } from "../src/lib/giverny/cusip";
import { normalizeUsTicker } from "../src/lib/giverny/tickers";
import expected from "./fixtures/giverny-validation-holdings.json";

const fixture = fs.readFileSync(
  path.join(process.cwd(), "tests/fixtures/giverny-13f-infotable.xml"),
  "utf8",
);

describe("13F ingest", () => {
  it("extracts the validation GOOG/META table from the fixture filing without using it as a live book", () => {
    const parsed = parse13FDocuments(fixture);
    const weighted = weightsFromHoldings(parsed.holdings);
    expect(parsed.holdings).toHaveLength(8);
    expect(parsed.filerName).toBe("Giverny Capital Inc.");
    for (const row of expected.holdings) {
      const holding = weighted.find((item) => item.cusip === row.cusip);
      expect(holding?.issuerName).toBe(row.issuerName);
      expect(holding?.value).toBe(row.value);
      expect(holding?.weight).toBeCloseTo(row.weight);
    }
    expect(weighted.find((row) => row.cusip === "02079K107")?.issuerName).toContain("ALPHABET");
    expect(weighted.find((row) => row.cusip === "30303M102")?.issuerName).toContain("META");
  });

  it("keeps the latest amendment per period and later public filings", () => {
    const picked = pickLatestFilings([
      { accession: "a", form: "13F-HR", filingDate: "2026-08-14", reportDate: "2026-06-30", primaryDocument: null, acceptanceDateTime: null },
      { accession: "b", form: "13F-HR/A", filingDate: "2026-08-26", reportDate: "2026-06-30", primaryDocument: null, acceptanceDateTime: null },
      { accession: "c", form: "13F-HR", filingDate: "2026-11-12", reportDate: "2026-09-30", primaryDocument: null, acceptanceDateTime: null },
    ]);
    expect(picked.map((row) => row.accession)).toEqual(["c", "b"]);
  });

  it("parses EDGAR atom accessions and normalizes US filing dates", () => {
    const atom = `
      <entry>
        <filing-type>13F-HR</filing-type>
        <accession-number>0001641864-26-000011</accession-number>
        <filing-date>2026-11-12</filing-date>
        <id>urn:tag:sec.gov,2008:accession-number=0001641864-26-000011</id>
      </entry>`;
    expect(parseAtomFilings(atom)[0]?.accession).toBe("0001641864-26-000011");
    expect(filingStoredDate("09-30-2026")).toBe("2026-09-30");
    expect(filingStoredDate("20261112")).toBe("2026-11-12");
  });

  it("maps OpenFIGI class shares and ignores non-equity noise", () => {
    expect(normalizeUsTicker("BRK/B")).toBe("BRK.B");
    expect(normalizeUsTicker("HEI-A")).toBe("HEI.A");
    expect(
      pickOpenFigiTicker([
        { ticker: "GOOG", exchCode: "UW", marketSector: "Equity", securityType: "Common Stock" },
        { ticker: "GOOG", exchCode: "US", marketSector: "Equity", securityType: "Warrant" },
      ]),
    ).toBe("GOOG");
  });
});
