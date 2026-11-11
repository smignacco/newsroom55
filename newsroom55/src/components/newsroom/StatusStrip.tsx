"use client";

import { formatNewsTime } from "@/lib/time";
import type { PlaybackState } from "@/components/newsroom/HlsPlayer";

export function StatusStrip({
  online,
  news,
  markets,
  videoState,
  timezone,
  onDesk,
}: {
  online: boolean;
  news: { ok: number; error: number; total: number; lastFetch: string | null };
  markets: { board: string; providerName: string };
  videoState: PlaybackState;
  timezone: string;
  onDesk: () => void;
}) {
  const videoLabel =
    videoState === "playing"
      ? "DIRECT"
      : videoState === "loading"
        ? "CONNEXION"
        : videoState === "error"
          ? "ERREUR"
          : "ATTENTE";
  const marketLabel =
    markets.board === "LIVE"
      ? "DIRECT"
      : markets.board === "DELAYED"
        ? "DIFFÉRÉ"
        : markets.board === "UNAVAILABLE"
          ? "INDISPONIBLE"
          : "NON CONFIGURÉ";
  return (
    <footer className="nr-status">
      <span>
        Serveur <b>OK</b>
      </span>
      <span>
        Nouvelles <b>{news.ok}/{news.total} actives</b>
        {news.error ? ` · ${news.error} en erreur` : ""} ·{" "}
        {formatNewsTime(news.lastFetch, timezone)}
      </span>
      <span>
        Marchés <b>{marketLabel}</b> · {markets.providerName}
      </span>
      <span>
        Vidéo <b>{videoLabel}</b>
      </span>
      <span>
        Réseau <b>{online ? "JOIGNABLE" : "HORS LIGNE"}</b>
      </span>
      <button type="button" className="nr-filter" style={{ marginLeft: "auto", minHeight: "1.4rem", padding: "0 0.2rem" }} onClick={onDesk}>
        Admin
      </button>
    </footer>
  );
}
