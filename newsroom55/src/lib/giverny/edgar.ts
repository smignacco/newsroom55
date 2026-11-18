import { fetchJson, fetchText } from "@/lib/giverny/http";
import { parse13FDocuments, weightsFromHoldings } from "@/lib/giverny/parse-13f";
import { accessionPath, nySessionDate, padCik } from "@/lib/giverny/tickers";
import type { Parsed13FFiling } from "@/lib/giverny/types";
import { GIVERNY_DEFAULT_FILER } from "@/lib/giverny/types";

export type EdgarFilingMeta = {
  accession: string;
  form: string;
  filingDate: string;
  reportDate: string | null;
  primaryDocument: string | null;
  acceptanceDateTime: string | null;
};

type SubmissionsJson = {
  cik?: string | number;
  name?: string;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      reportDate?: string[];
      form?: string[];
      primaryDocument?: string[];
      acceptanceDateTime?: string[];
    };
  };
};

type IndexJson = {
  directory?: {
    item?: Array<{ name?: string; type?: string }>;
  };
};

function is13F(form: string) {
  return /^13F-HR/i.test(form);
}

export function pickLatestFilings(rows: EdgarFilingMeta[], limit = 8): EdgarFilingMeta[] {
  const byPeriod = new Map<string, EdgarFilingMeta>();
  const sorted = [...rows]
    .filter((row) => is13F(row.form) && row.accession && row.filingDate)
    .sort((left, right) => {
      if (left.filingDate !== right.filingDate) return left.filingDate.localeCompare(right.filingDate);
      const amend = Number(right.form.includes("/A")) - Number(left.form.includes("/A"));
      if (amend !== 0) return amend;
      return left.accession.localeCompare(right.accession);
    });
  for (const row of sorted) {
    const period = row.reportDate || row.filingDate;
    byPeriod.set(period, row);
  }
  return [...byPeriod.values()].sort((left, right) => right.filingDate.localeCompare(left.filingDate)).slice(0, limit);
}

export async function listEdgarFilings(cik: string): Promise<{
  name: string;
  filings: EdgarFilingMeta[];
  source: string;
  error: string | null;
}> {
  const padded = padCik(cik);
  const submissions = await fetchJson<SubmissionsJson>(
    `https://data.sec.gov/submissions/CIK${padded}.json`,
    { headers: { host: "data.sec.gov" } },
  );
  const recent = submissions?.filings?.recent;
  const accessionNumbers = recent?.accessionNumber ?? [];
  if (recent && accessionNumbers.length > 0) {
    const filings = accessionNumbers.map((accession, index) => ({
      accession,
      form: recent.form?.[index] || "",
      filingDate: recent.filingDate?.[index] || "",
      reportDate: recent.reportDate?.[index] || null,
      primaryDocument: recent.primaryDocument?.[index] || null,
      acceptanceDateTime: recent.acceptanceDateTime?.[index] || null,
    }));
    return {
      name: submissions?.name || GIVERNY_DEFAULT_FILER,
      filings: pickLatestFilings(filings),
      source: "data.sec.gov",
      error: null,
    };
  }

  const atom = await fetchText(
    `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${padded}&type=13F-HR&count=40&output=atom`,
  );
  if (!atom.ok) {
    return {
      name: GIVERNY_DEFAULT_FILER,
      filings: [],
      source: "sec-edgar",
      error: atom.status === 403
        ? "EDGAR a refusé le trafic automatisé. L’indice reste indisponible tant que le dépôt n’est pas lisible."
        : `EDGAR injoignable (${atom.status || "réseau"}).`,
    };
  }
  return {
    name: xmlTag(atom.body, "conformed-name") || GIVERNY_DEFAULT_FILER,
    filings: pickLatestFilings(parseAtomFilings(atom.body)),
    source: "sec-atom",
    error: null,
  };
}

function xmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1].trim() : null;
}

export function parseAtomFilings(atom: string): EdgarFilingMeta[] {
  const entries = atom.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  return entries.flatMap((entry) => {
    const accession =
      xmlTag(entry, "accession-number") ||
      (xmlTag(entry, "id") || "").replace(/^.*accession-number=/i, "") ||
      (entry.match(/AccNo:\s*([0-9-]+)/i)?.[1] ?? null);
    const form = xmlTag(entry, "filing-type") || xmlTag(entry, "category") || "";
    const filingDate = (xmlTag(entry, "filing-date") || xmlTag(entry, "updated") || "").slice(0, 10);
    const href = entry.match(/href="([^"]+-index\.htm)"/i)?.[1] ?? null;
    if (!accession || !filingDate) return [];
    return [
      {
        accession,
        form,
        filingDate,
        reportDate: xmlTag(entry, "period") || xmlTag(entry, "report-date"),
        primaryDocument: href,
        acceptanceDateTime: xmlTag(entry, "updated"),
      },
    ];
  });
}

export async function downloadFiling(cik: string, meta: EdgarFilingMeta): Promise<Parsed13FFiling | null> {
  const padded = padCik(cik);
  const unpadded = String(Number(padded));
  const folder = accessionPath(meta.accession);
  const base = `https://www.sec.gov/Archives/edgar/data/${unpadded}/${folder}`;
  const index = await fetchJson<IndexJson>(`${base}/index.json`);
  const names = (index?.directory?.item ?? [])
    .map((item) => item.name || "")
    .filter((name) => /\.xml$/i.test(name));
  const infoName =
    names.find((name) => /info.?table|form13fInfoTable/i.test(name)) ||
    names.find((name) => /info/i.test(name) && /xml/i.test(name));
  const coverName =
    names.find((name) => /primary_doc|primarydoc|form13fCover/i.test(name)) ||
    names.find((name) => /primary/i.test(name));

  const infoXml = infoName ? await fetchText(`${base}/${infoName}`) : await tryCommon(base);
  if (!infoXml?.ok) return null;
  const coverXml = coverName ? await fetchText(`${base}/${coverName}`) : null;
  const combined = `${coverXml?.ok ? coverXml.body : ""}\n${infoXml.body}`;
  return parse13FDocuments(combined, {
    accession: meta.accession,
    cik: padded,
    form: meta.form,
    periodOfReport: meta.reportDate,
    filedAt: meta.filingDate,
    acceptedAt: meta.acceptanceDateTime,
  });
}

async function tryCommon(base: string) {
  for (const name of ["form13fInfoTable.xml", "infotable.xml", "InfoTable.xml", "informationtable.xml"]) {
    const response = await fetchText(`${base}/${name}`, { attempts: 2 });
    if (response.ok && /infoTable/i.test(response.body)) return response;
  }
  return null;
}

export function filingStoredDate(value: string | null | undefined): string {
  if (!value) return nySessionDate();
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  if (/^\d{8}$/.test(trimmed)) return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  const us = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? nySessionDate(new Date(parsed)) : nySessionDate();
}

export function filingToHoldings(parsed: Parsed13FFiling) {
  const weighted = weightsFromHoldings(parsed.holdings);
  const weightByCusip = new Map(weighted.map((row) => [row.cusip, row.weight]));
  return parsed.holdings.map((holding) => ({
    ...holding,
    weight: holding.derivative ? null : (weightByCusip.get(holding.cusip) ?? null),
  }));
}
