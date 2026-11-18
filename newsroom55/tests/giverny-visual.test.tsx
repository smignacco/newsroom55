import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GivernyPanel } from "../src/components/newsroom/GivernyTracker";
import { NewsFeed } from "../src/components/newsroom/NewsFeed";
import type { GivernySummary } from "../src/lib/giverny/types";

const summary: GivernySummary = {
  identity: "synthetic",
  officialNav: false,
  enabled: true,
  currency: "CAD",
  marketStatus: "delayed",
  marketStatusLabel: "DONNÉES DIFFÉRÉES",
  lastRefreshAt: "2026-11-18T19:00:00.000Z",
  lastCloseAt: "2026-11-17T21:30:00.000Z",
  lastSuccessfulRefreshAt: "2026-11-18T19:00:00.000Z",
  coverage: 0.98,
  filing: {
    accession: "0001641864-26-000011",
    periodOfReport: "2026-09-30",
    filedAt: "2026-11-12",
    holdings: 51,
    mapped: 50,
  },
  levels: { givCad: 104.32, givUsd: 101.1, givAlpha: 101.8 },
  last: { givCad: 104.32, givUsd: 101.1, asOf: "2026-11-18" },
  returns: {
    session: 0.0042,
    last5: 0.011,
    mtd: 0.021,
    ytd: 0.087,
    vsSpxSession: 0.001,
    vsSpxYtd: 0.015,
  },
  chart: [
    { date: "2026-11-12", value: 103.1 },
    { date: "2026-11-13", value: 103.8 },
    { date: "2026-11-14", value: 104.32 },
  ],
  contributors: {
    up: [{ ticker: "META", name: "Meta", weight: 0.07, return: 0.02, contribution: 0.0014 }],
    down: [{ ticker: "BKNG", name: "Booking", weight: 0.04, return: -0.01, contribution: -0.0004 }],
  },
  providerHealth: [],
  navEstimate: null,
  message: "Indice synthétique estimé à partir des 13F publics. Ce n’est pas le VL officiel.",
};

describe("Giverny board treatment", () => {
  it("labels the panel as a synthetic index and never prints a fake zero last", () => {
    const html = renderToStaticMarkup(<GivernyPanel summary={summary} />);
    expect(html).toContain("Indice synthétique");
    expect(html).toContain("Pas un VL officiel");
    expect(html).toContain("GIV-CAD");
    expect(html).toContain("DONNÉES DIFFÉRÉES");
    expect(html).toContain("META");
    expect(html).not.toContain(">0,00</strong>");
    expect(html).not.toContain("nr-giverny-spark");
  });

  it("labels a NAV estimate without claiming an official fund price", () => {
    const html = renderToStaticMarkup(
      <GivernyPanel
        summary={{
          ...summary,
          levels: { ...summary.levels, givCad: 77.84 },
          navEstimate: {
            value: 77.84,
            officialNav: 76.31,
            officialMonth: "2026-10",
            anchorDate: "2026-10-31",
          },
        }}
      />,
    );
    expect(html).toContain("Estimation VL");
    expect(html).toContain("pas le VL officiel");
    expect(html).not.toContain(">76,31</strong>");
  });

  it("keeps a reserved compact breaking slot so the news header does not shift", () => {
    const html = renderToStaticMarkup(
      <NewsFeed
        headlines={[]}
        category={null}
        timezone="America/Toronto"
        lastRefresh={null}
        refreshIntervalSec={180}
        breaking={null}
        breakingMode="compact"
        onCategory={() => undefined}
        onOpen={() => undefined}
      />,
    );
    expect(html).toContain("nr-breaking-badge");
    expect(html).toContain("FIL");
    expect(html).not.toContain("nr-breaking-bar");
    expect(html).not.toContain("nr-featured");
    expect(html).not.toContain("À la une");
  });

  it("does not hardcode the production 13F book in runtime source", () => {
    const service = fs.readFileSync(path.join(process.cwd(), "src/lib/giverny/service.ts"), "utf8");
    expect(service).not.toContain("30303M102");
    expect(service).not.toContain("VALIDATION_HOLDINGS");
  });
});
