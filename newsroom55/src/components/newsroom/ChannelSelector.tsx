"use client";

import type { PublicChannel } from "@/lib/video/player";

export function ChannelSelector({
  channels,
  selectedId,
  onSelect,
  onClose,
}: {
  channels: PublicChannel[];
  selectedId: number | null;
  onSelect: (channel: PublicChannel) => void;
  onClose: () => void;
}) {
  return (
    <div className="nr-overlay" role="dialog" aria-label="Sélection des chaînes">
      <div className="nr-overlay-card">
        <div className="nr-kicker">Chemin du signal</div>
        <h2>Chaînes en direct</h2>
        {channels.length === 0 ? (
          <p className="nr-channel-empty">
            Aucune source en direct autorisée n’est configurée. Il s’agit d’un
            état d’attente, pas d’une diffusion simulée. Les identifiants IPTV
            restent sur le serveur.
          </p>
        ) : (
          <div className="nr-channel-list">
            {channels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                className={`nr-chip ${selectedId === ch.id ? "nr-chip-on" : ""}`}
                style={{ textAlign: "left" }}
                onClick={() => onSelect(ch)}
              >
                {ch.name} ·{" "}
                {ch.configured
                  ? `${ch.adapter.toUpperCase()} répertorié, non vérifié`
                  : "aucune source de flux"}
              </button>
            ))}
          </div>
        )}
        <div style={{ marginTop: "0.85rem" }}>
          <button type="button" className="nr-chip" onClick={onClose}>
            Retour au tableau
          </button>
        </div>
      </div>
    </div>
  );
}
