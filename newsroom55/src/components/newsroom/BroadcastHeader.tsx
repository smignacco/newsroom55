"use client";

import { useEffect, useState } from "react";

function clockParts(date: Date, timezone: string) {
  const clock = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
  return { clock, dateLabel };
}

export function BroadcastHeader({
  online,
  live,
  timezone,
}: {
  online: boolean;
  live: boolean;
  timezone: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const formatted = clockParts(now, timezone);

  return (
    <header className="nr-header">
      <div className="nr-brand">
        <div className="nr-mark" aria-hidden>
          {/* Supplied Cisco artwork is white with transparency for the dark broadcast header. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cisco-logo.png" alt="" className="nr-cisco-logo" />
        </div>
        <div className="nr-brand-text">
          <div className="nr-brand-name">CENTRE DE NOUVELLES</div>
          <div className="nr-brand-sig">Information en continu</div>
        </div>
      </div>
      <div className="nr-header-meta">
        <span className={`nr-dot ${online ? "on" : "off"}`} />
        <span>{online ? "Board online" : "Network lost"}</span>
        <span className="nr-header-rule" />
        <span>Montréal desk</span>
      </div>
      <div className="nr-clock-block">
        <div className="nr-clock">{formatted.clock}</div>
        <div className="nr-date">{formatted.dateLabel}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
        <div className="nr-tz">{timezone}</div>
        <div className="nr-live-slot">
          {live ? (
            <div className="nr-live-badge">
              <span className="nr-dot" />
              LIVE
            </div>
          ) : (
            <div className="nr-standby">STANDBY</div>
          )}
        </div>
      </div>
    </header>
  );
}
