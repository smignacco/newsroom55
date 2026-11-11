"use client";

import type { Quote } from "@/lib/markets/provider";

function direction(q: Quote): "up" | "down" | "flat" {
  if (q.changePct == null || q.changePct === 0) return "flat";
  return q.changePct > 0 ? "up" : "down";
}

function formatPx(q: Quote): string {
  if (q.price == null) return "—";
  const decimals = Math.abs(q.price) < 0.1 ? 5 : Math.abs(q.price) < 10 ? 4 : 2;
  return q.price.toLocaleString("en-CA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatChg(q: Quote): string {
  if (q.changePct == null) return "n/a";
  const sign = q.changePct > 0 ? "+" : "";
  const arrow = q.changePct > 0 ? "▲" : q.changePct < 0 ? "▼" : "•";
  return `${arrow} ${sign}${q.changePct.toFixed(2)}%`;
}

export function MarketTicker({
  quotes,
  board,
  providerName,
  paused,
  onTogglePause,
  onOpen,
}: {
  quotes: Quote[];
  board: string;
  providerName: string;
  paused: boolean;
  onTogglePause: () => void;
  onOpen: (q: Quote) => void;
}) {
  const unconfigured = board === "UNCONFIGURED";
  const noQuotes = quotes.length === 0;
  const seq = (
    <>
      {quotes.map((q) => (
        <button
          key={q.symbolId}
          type="button"
          className={`nr-quote ${direction(q)}`}
          onClick={() => onOpen(q)}
        >
          <span className="nr-sym">{q.symbol}</span>
          <span className="nr-px">{formatPx(q)}</span>
          <span className={`nr-chg ${direction(q)}`}>{formatChg(q)}</span>
          <span className="nr-time">{q.currency}</span>
        </button>
      ))}
    </>
  );

  return (
    <section className={`nr-ticker ${paused ? "paused" : ""}`} style={{ ["--ticker-speed" as string]: "42s" }}>
      <div className="nr-ticker-label">
        <strong>Marchés</strong>
        <span>{board}</span>
      </div>
      {unconfigured || noQuotes ? (
        <div className="nr-unconfigured" data-testid="markets-unconfigured">
          <span className="nr-market-pulse" aria-hidden />
          <span>
            {unconfigured
              ? "INDISPONIBLE · Fournisseur de marché non configuré"
              : "AUCUN TITRE SÉLECTIONNÉ · Choisissez les actions dans l’administration"}
          </span>
          <span className="nr-market-rule" aria-hidden />
          <span>{unconfigured ? "LIAISON EN ATTENTE" : "SÉLECTION EN ATTENTE"}</span>
        </div>
      ) : (
        <div className="nr-ticker-track">
          <div className="nr-ticker-seq">
            {seq}
            {seq}
          </div>
        </div>
      )}
      <button type="button" className="nr-ticker-status" onClick={onTogglePause}>
        {providerName} · {paused ? "Hold" : "Scroll"}
      </button>
    </section>
  );
}
