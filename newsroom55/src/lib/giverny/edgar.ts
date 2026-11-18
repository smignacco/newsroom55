import { weightsFromHoldings } from "@/lib/giverny/parse-13f";
import { nySessionDate } from "@/lib/giverny/tickers";
import type { Parsed13FFiling } from "@/lib/giverny/types";

export type EdgarFilingMeta = {
  accession: string;
  form: string;
  filingDate: string;
  reportDate: string | null;
  primaryDocument: string | null;
  acceptanceDateTime: string | null;
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

type EftsHit = {
  _id?: string;
  _source?: {
    adsh?: string;
    file_date?: string;
    period_ending?: string;
    form?: string;
    display_names?: string[];
  };
};

export function parseEftsFilings(payload: unknown): { name: string | null; filings: EdgarFilingMeta[] } {
  const hits = (payload as { hits?: { hits?: EftsHit[] } } | null)?.hits?.hits ?? [];
  const filings: EdgarFilingMeta[] = [];
  let name: string | null = null;
  for (const hit of hits) {
    const src = hit._source ?? {};
    const accession = src.adsh || String(hit._id || "").split(":")[0];
    const filingDate = String(src.file_date || "").slice(0, 10);
    if (!accession || !filingDate) continue;
    const display = src.display_names?.[0];
    if (display && !name) {
      name = display.replace(/\s+\(CIK\s+\d+\)\s*$/i, "").trim() || null;
    }
    filings.push({
      accession,
      form: src.form || "13F-HR",
      filingDate,
      reportDate: src.period_ending ? String(src.period_ending).slice(0, 10) : null,
      primaryDocument: null,
      acceptanceDateTime: null,
    });
  }
  return { name, filings };
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
