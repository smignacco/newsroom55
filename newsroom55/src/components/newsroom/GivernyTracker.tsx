"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { layoutHeatmap } from "@/lib/giverny/heatmap";
import type { GivernySummary } from "@/lib/giverny/types";

function formatLevel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

function tone(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "na";
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

function heatmapFill(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "rgba(145, 168, 189, 0.16)";
  const mag = Math.min(1, Math.abs(value) / 0.03);
  if (value > 0) return `rgba(50, 201, 151, ${0.2 + mag * 0.58})`;
  if (value < 0) return `rgba(240, 68, 82, ${0.2 + mag * 0.58})`;
  return "rgba(145, 168, 189, 0.22)";
}

export function GivernyPanel({
  summary,
  view = "levels",
}: {
  summary: GivernySummary;
  view?: "levels" | "heatmap";
}) {
  const field = summary.currency === "USD" ? summary.levels.givUsd : summary.levels.givCad;
  const sessionTone = tone(summary.returns.session);
  const cells = summary.heatmap ?? [];
  const showMap = view === "heatmap" && cells.length > 0;
  const rects = showMap ? layoutHeatmap(cells) : [];
  return (
    <section
      className={`nr-giverny${showMap ? " is-map" : ""}`}
      data-testid="giverny-tracker"
      data-view={showMap ? "heatmap" : "levels"}
      aria-label="Indice synthétique Giverny Capital"
    >
      <header className="nr-giverny-head">
        <div>
          <div className="nr-giverny-kicker">Giverny Capital</div>
          <h2>
            {showMap
              ? "Carte 13F"
              : summary.navEstimate
                ? "Estimation VL"
                : "Indice synthétique"}
          </h2>
        </div>
        <span className={`nr-giverny-status is-${summary.marketStatus}`}>{summary.marketStatusLabel}</span>
      </header>
      {showMap ? (
        <div className="nr-giverny-map" aria-hidden="true">
          {rects.map((cell) => {
            const shortest = Math.min(cell.w, cell.h);
            const size = shortest < 5 ? "is-micro" : shortest < 8 ? "is-tiny" : "is-full";
            return (
              <span
                key={`${cell.ticker ?? cell.name}-${cell.x}-${cell.y}`}
                className={`nr-giverny-cell ${size} is-${tone(cell.return)}`}
                style={{
                  left: `${cell.x}%`,
                  top: `${cell.y}%`,
                  width: `${cell.w}%`,
                  height: `${cell.h}%`,
                  background: heatmapFill(cell.return),
                }}
                title={
                  cell.return == null
                    ? `${cell.ticker ?? cell.name} · cours manquant`
                    : `${cell.ticker ?? cell.name} ${formatPct(cell.return)}`
                }
              >
                <b>{cell.ticker ?? (cell.name === "Autres" ? "Autres" : "·")}</b>
                <i>{formatPct(cell.return)}</i>
              </span>
            );
          })}
        </div>
      ) : (
        <>
          <div className="nr-giverny-main">
            <div className="nr-giverny-level">
              <span className="nr-giverny-code">
                {summary.navEstimate ? "VL CAD" : summary.currency === "USD" ? "GIV-USD" : "GIV-CAD"}
              </span>
              <strong className={`is-${sessionTone}`}>{formatLevel(field)}</strong>
              <b className={`is-${sessionTone}`}>{formatPct(summary.returns.session)}</b>
            </div>
          </div>
          <div className="nr-giverny-metrics">
            <span>
              5 séances <b className={`is-${tone(summary.returns.last5)}`}>{formatPct(summary.returns.last5)}</b>
            </span>
            <span>
              MTD <b className={`is-${tone(summary.returns.mtd)}`}>{formatPct(summary.returns.mtd)}</b>
            </span>
            <span>
              YTD <b className={`is-${tone(summary.returns.ytd)}`}>{formatPct(summary.returns.ytd)}</b>
            </span>
            <span>
              vs S&P <b className={`is-${tone(summary.returns.vsSpxYtd)}`}>{formatPct(summary.returns.vsSpxYtd)}</b>
            </span>
            <span>
              α <b className={`is-${tone((summary.levels.givAlpha ?? 100) - 100)}`}>{formatLevel(summary.levels.givAlpha)}</b>
            </span>
          </div>
          <div className="nr-giverny-contrib">
            {summary.contributors.up.length === 0 && summary.contributors.down.length === 0 ? (
              <span>Contributions indisponibles</span>
            ) : (
              <>
                {summary.contributors.up.map((row) => (
                  <span key={`up-${row.ticker}`} className="is-up">
                    {row.ticker} {formatPct(row.contribution)}
                  </span>
                ))}
                {summary.contributors.down.map((row) => (
                  <span key={`down-${row.ticker}`} className="is-down">
                    {row.ticker} {formatPct(row.contribution)}
                  </span>
                ))}
              </>
            )}
          </div>
        </>
      )}
      <footer className="nr-giverny-foot">
        <span>
          MAJ {summary.lastSuccessfulRefreshAt ? new Date(summary.lastSuccessfulRefreshAt).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}
          {summary.coverage != null
            ? ` · Couverture ${Math.round(summary.coverage * 100)} %`
            : ""}
          {summary.filing ? ` · 13F ${summary.filing.filedAt.slice(0, 10)}` : ""}
        </span>
        <small>
          {showMap
            ? "Livre 13F public · pas le NBN125 officiel"
            : summary.navEstimate
              ? `Ancré sur le VL saisi (${summary.navEstimate.anchorDate}) · pas le VL officiel`
              : "Pas un VL officiel"}
        </small>
      </footer>
    </section>
  );
}

export function GivernyTracker() {
  const [summary, setSummary] = useState<GivernySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heatmapOn, setHeatmapOn] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/giverny/summary", { cache: "no-store" });
      if (response.status === 404) {
        setSummary(null);
        setError(null);
        return;
      }
      if (!response.ok) {
        setError("Indice synthétique indisponible.");
        return;
      }
      setSummary((await response.json()) as GivernySummary);
      setError(null);
    } catch {
      setError("Indice synthétique indisponible.");
    }
  }, []);

  useEffect(() => {
    // Initial API hydration is the effect's synchronization target.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void refresh();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const rotateMs = (summary?.heatmapRotateSeconds ?? 0) * 1000;
  const canRotate = Boolean(summary && rotateMs > 0 && (summary.heatmap?.length ?? 0) > 0);

  useEffect(() => {
    if (!canRotate) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setHeatmapOn((current) => !current);
    }, rotateMs);
    return () => window.clearInterval(timer);
  }, [canRotate, rotateMs]);

  const waiting = useMemo(() => !summary && !error, [summary, error]);

  if (waiting) {
    return (
      <section className="nr-giverny is-wait" data-testid="giverny-tracker">
        <div className="nr-giverny-kicker">Giverny Capital</div>
        <p>Chargement de l’indice synthétique.</p>
      </section>
    );
  }
  if (!summary) {
    return (
      <section className="nr-giverny is-wait" data-testid="giverny-tracker">
        <div className="nr-giverny-kicker">Giverny Capital</div>
        <p>{error || "Indice synthétique indisponible."}</p>
      </section>
    );
  }
  return <GivernyPanel summary={summary} view={canRotate && heatmapOn ? "heatmap" : "levels"} />;
}
