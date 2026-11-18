import type { Parsed13FFiling, Parsed13FHolding } from "@/lib/giverny/types";

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

function xmlBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>`,
    "gi",
  );
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) out.push(match[1]);
  return out;
}

function xmlText(xml: string, tag: string): string | null {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>`,
    "i",
  );
  const match = xml.match(re);
  return match ? decodeXml(match[1]) : null;
}

function xmlNumber(xml: string, tag: string): number | null {
  const text = xmlText(xml, tag);
  if (!text) return null;
  const parsed = Number(text.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCusip(value: string | null): string | null {
  if (!value) return null;
  const cusip = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return cusip.length >= 8 && cusip.length <= 9 ? cusip : null;
}

function isDerivative(putCall: string | null, shareType: string | null, title: string | null) {
  if (putCall === "PUT" || putCall === "CALL") return true;
  if (shareType === "PRN") return false;
  return /PUT|CALL|OPTION/i.test(title || "");
}

export function parse13FDocuments(xml: string, meta?: Partial<Parsed13FFiling>): Parsed13FFiling {
  const holdings = xmlBlocks(xml, "infoTable").flatMap((block) => {
    const cusip = normalizeCusip(xmlText(block, "cusip"));
    const issuerName = xmlText(block, "nameOfIssuer");
    const value = xmlNumber(block, "value");
    const shares = xmlNumber(block, "sshPrnamt");
    if (!cusip || !issuerName || value == null || shares == null) return [];
    if (!(value > 0) || !(shares > 0)) return [];
    const putCall = xmlText(block, "putCall")?.toUpperCase() ?? null;
    const shareType = xmlText(block, "sshPrnamtType")?.toUpperCase() ?? null;
    const titleOfClass = xmlText(block, "titleOfClass");
    const holding: Parsed13FHolding = {
      cusip,
      issuerName,
      titleOfClass,
      shares,
      value,
      shareType,
      putCall,
      investmentDiscretion: xmlText(block, "investmentDiscretion"),
      sole: xmlNumber(block, "Sole"),
      shared: xmlNumber(block, "Shared"),
      none: xmlNumber(block, "None"),
      derivative: isDerivative(putCall, shareType, titleOfClass),
    };
    return [holding];
  });

  return {
    accession: meta?.accession ?? xmlText(xml, "accessionNumber"),
    cik: meta?.cik ?? xmlText(xml, "cik"),
    filerName: meta?.filerName ?? xmlText(xml, "name") ?? xmlText(xml, "companyConformedName"),
    form: meta?.form ?? xmlText(xml, "conformedSubmissionType") ?? xmlText(xml, "form"),
    periodOfReport: meta?.periodOfReport ?? xmlText(xml, "periodOfReport") ?? xmlText(xml, "reportCalendarOrQuarter"),
    filedAt: meta?.filedAt ?? xmlText(xml, "filedAsOfDate"),
    acceptedAt: meta?.acceptedAt ?? xmlText(xml, "acceptanceDatetime") ?? xmlText(xml, "dateAsOfChange"),
    tableEntryTotal: meta?.tableEntryTotal ?? xmlNumber(xml, "tableEntryTotal"),
    tableValueTotal: meta?.tableValueTotal ?? xmlNumber(xml, "tableValueTotal"),
    holdings,
  };
}

export function weightsFromHoldings(
  holdings: Parsed13FHolding[],
): Array<Parsed13FHolding & { weight: number }> {
  const book = holdings.filter((holding) => !holding.derivative && holding.value > 0);
  const total = book.reduce((sum, holding) => sum + holding.value, 0);
  if (!(total > 0)) return [];
  return book.map((holding) => ({ ...holding, weight: holding.value / total }));
}

export type HoldingChange = {
  cusip: string;
  issuerName: string;
  ticker: string | null;
  action: "add" | "cut" | "exit" | "hold";
  previousWeight: number | null;
  nextWeight: number | null;
};

export function diffHoldings(
  previous: Array<{ cusip: string; issuerName: string; ticker: string | null; weight: number }>,
  next: Array<{ cusip: string; issuerName: string; ticker: string | null; weight: number }>,
): HoldingChange[] {
  const prevMap = new Map(previous.map((row) => [row.cusip, row]));
  const nextMap = new Map(next.map((row) => [row.cusip, row]));
  const keys = new Set([...prevMap.keys(), ...nextMap.keys()]);
  const changes: HoldingChange[] = [];
  for (const cusip of keys) {
    const before = prevMap.get(cusip);
    const after = nextMap.get(cusip);
    if (!before && after) {
      changes.push({
        cusip,
        issuerName: after.issuerName,
        ticker: after.ticker,
        action: "add",
        previousWeight: null,
        nextWeight: after.weight,
      });
      continue;
    }
    if (before && !after) {
      changes.push({
        cusip,
        issuerName: before.issuerName,
        ticker: before.ticker,
        action: "exit",
        previousWeight: before.weight,
        nextWeight: null,
      });
      continue;
    }
    if (!before || !after) continue;
    const delta = after.weight - before.weight;
    changes.push({
      cusip,
      issuerName: after.issuerName,
      ticker: after.ticker,
      action: Math.abs(delta) < 0.0005 ? "hold" : delta < 0 ? "cut" : "add",
      previousWeight: before.weight,
      nextWeight: after.weight,
    });
  }
  return changes.sort((left, right) => {
    const leftWeight = left.nextWeight ?? left.previousWeight ?? 0;
    const rightWeight = right.nextWeight ?? right.previousWeight ?? 0;
    return rightWeight - leftWeight;
  });
}
