"use client";

import type { PublicChannel } from "@/lib/video/player";

export function TileContextMenu({
  slotIndex,
  channels,
  tileChannel,
  audioEnabled,
  onSelectChannel,
  onSetAudio,
  onClose,
}: {
  slotIndex: number;
  channels: PublicChannel[];
  tileChannel: PublicChannel | null;
  audioEnabled: boolean;
  onSelectChannel: (channel: PublicChannel) => void;
  onSetAudio: (enabled: boolean) => void;
  onClose: () => void;
}) {
  const screen = String(slotIndex + 1).padStart(2, "0");
  return (
    <div
      className="nr-overlay nr-tile-menu"
      role="dialog"
      aria-label={`Menu de l’écran ${screen}`}
      data-testid="tile-context-menu"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="nr-overlay-card nr-tile-menu-card"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="nr-kicker">Tuile {screen}</div>
        <h2>{tileChannel?.name ?? "Source"}</h2>
        <p className="nr-tile-menu-lead">
          Choisissez la chaîne de cet écran et activez ou coupez son audio. Le
          toucher reste dans NEWSROOM.
        </p>

        <div className="nr-tile-audio" role="group" aria-label="Audio de cette tuile">
          <span>Audio de cette tuile</span>
          <div>
            <button
              type="button"
              className={`nr-chip ${audioEnabled ? "nr-chip-on" : ""}`}
              onClick={() => onSetAudio(true)}
            >
              Activer l’audio
            </button>
            <button
              type="button"
              className={`nr-chip ${!audioEnabled ? "nr-chip-on" : ""}`}
              onClick={() => onSetAudio(false)}
            >
              Couper l’audio
            </button>
          </div>
        </div>

        <div className="nr-kicker" style={{ marginTop: "0.85rem" }}>
          Chaîne
        </div>
        {channels.length === 0 ? (
          <p className="nr-channel-empty">
            Aucune source en direct autorisée n’est configurée. Il s’agit d’un
            état d’attente, pas d’une diffusion simulée. Les identifiants IPTV
            restent sur le serveur.
          </p>
        ) : (
          <div className="nr-channel-list nr-tile-channel-grid">
            {channels.map((channel) => (
              <button
                key={channel.id}
                type="button"
                className={`nr-chip ${tileChannel?.id === channel.id ? "nr-chip-on" : ""}`}
                onClick={() => onSelectChannel(channel)}
              >
                {channel.name} ·{" "}
                {channel.configured
                  ? `${channel.adapter.toUpperCase()} répertorié, non vérifié`
                  : "aucune source de flux"}
              </button>
            ))}
          </div>
        )}
        <div style={{ marginTop: "0.85rem" }}>
          <button type="button" className="nr-chip" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
