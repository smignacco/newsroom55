"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

function Sparkline({ points }: { points: Array<{ date: string; value: number }> }) {
  if (points.length < 2) {
    return <div className="nr-giverny-spark is-empty" aria-hidden />;
  }
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 28 - ((value - min) / span) * 24;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const last = values[values.length - 1] ?? 0;
  const first = values[0] ?? 0;
  const rising = last >= first;
  return (
    <svg className={`nr-giverny-spark ${rising ? "is-up" : "is-down"}`} viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function GivernyPanel({ summary }: { summary: GivernySummary }) {
  const field = summary.currency === "USD" ? summary.levels.givUsd : summary.levels.givCad;
  const sessionTone = tone(summary.returns.session);
  return (
    <section className="nr-giverny" data-testid="giverny-tracker" aria-label="Indice synthétique Giverny Capital">
      <header className="nr-giverny-head">
        <div>
          <div className="nr-giverny-kicker">Giverny Capital</div>
          <h2>Indice synthétique</h2>
        </div>
        <span className={`nr-giverny-status is-${summary.marketStatus}`}>{summary.marketStatusLabel}</span>
      </header>
      <div className="nr-giverny-main">
        <div className="nr-giverny-level">
          <span className="nr-giverny-code">{summary.currency === "USD" ? "GIV-USD" : "GIV-CAD"}</span>
          <strong className={`is-${sessionTone}`}>{formatLevel(field)}</strong>
          <b className={`is-${sessionTone}`}>{formatPct(summary.returns.session)}</b>
        </div>
        <Sparkline points={summary.chart} />
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
      <footer className="nr-giverny-foot">
        <span>
          MAJ {summary.lastSuccessfulRefreshAt ? new Date(summary.lastSuccessfulRefreshAt).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}
          {summary.coverage != null
            ? ` · Couverture ${Math.round(summary.coverage * 100)} %`
            : ""}
          {summary.filing ? ` · 13F ${summary.filing.filedAt.slice(0, 10)}` : ""}
        </span>
        <small>Pas un VL officiel</small>
      </footer>
    </section>
  );
}

export function GivernyTracker() {
  const [summary, setSummary] = useState<GivernySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  return <GivernyPanel summary={summary} />;
}
