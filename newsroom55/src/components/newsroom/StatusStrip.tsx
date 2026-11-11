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
      ? "LIVE"
      : videoState === "loading"
        ? "CONNECTING"
        : videoState === "error"
          ? "FAULT"
          : "WAITING";
  return (
    <footer className="nr-status">
      <span>
        Server <b>OK</b>
      </span>
      <span>
        News <b>{news.ok}/{news.total} live</b>
        {news.error ? ` · ${news.error} fault` : ""} · {formatNewsTime(news.lastFetch, timezone)}
      </span>
      <span>
        Finance <b>{markets.board}</b> · {markets.providerName}
      </span>
      <span>
        Video <b>{videoLabel}</b>
      </span>
      <span>
        Network <b>{online ? "REACHABLE" : "OFFLINE"}</b>
      </span>
      <button type="button" className="nr-filter" style={{ marginLeft: "auto", minHeight: "1.4rem", padding: "0 0.2rem" }} onClick={onDesk}>
        Admin
      </button>
    </footer>
  );
}
