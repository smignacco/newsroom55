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
    <div className="nr-overlay" role="dialog" aria-label="Channel selection">
      <div className="nr-overlay-card">
        <div className="nr-kicker">Signal path</div>
        <h2>Live channels</h2>
        {channels.length === 0 ? (
          <p className="nr-channel-empty">
            No authorized live source is configured. This is a waiting state, not a simulated broadcast. IPTV
            credentials remain on the server.
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
                {ch.name} · {ch.configured ? `${ch.adapter.toUpperCase()} catalogued, unverified` : "no stream source"}
              </button>
            ))}
          </div>
        )}
        <div style={{ marginTop: "0.85rem" }}>
          <button type="button" className="nr-chip" onClick={onClose}>
            Return to newsroom
          </button>
        </div>
      </div>
    </div>
  );
}
