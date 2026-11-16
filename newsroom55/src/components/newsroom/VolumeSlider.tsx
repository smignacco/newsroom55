"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { clampBoardVolume } from "@/lib/control/volume";

function levelFromClientX(track: HTMLElement, clientX: number) {
  const box = track.getBoundingClientRect();
  if (box.width <= 0) return 0;
  return clampBoardVolume(((clientX - box.left) / box.width) * 100);
}

export function VolumeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (level: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const level = clampBoardVolume(value);

  const applyPointer = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    onChange(levelFromClientX(track, event.clientX));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 5;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(clampBoardVolume(level - step));
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(clampBoardVolume(level + step));
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(0);
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(100);
    }
  };

  return (
    <div
      className="nr-volume-slider"
      data-testid="board-volume"
      role="slider"
      tabIndex={0}
      aria-label="Volume du Board"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={level}
      aria-valuetext={`${level} pour cent`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        applyPointer(event);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        applyPointer(event);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDown={onKeyDown}
    >
      <span className="nr-volume-icon" aria-hidden>
        <svg viewBox="0 0 16 14">
          <path d="M2.2 5.1h2.2L7.4 2.6v8.8L4.4 8.9H2.2z" />
          <path d="M9.4 4.2c1.3 1.1 1.3 4.5 0 5.6" />
          <path d="M11.2 2.6c2.4 2 2.4 6.8 0 8.8" />
        </svg>
      </span>
      <div className="nr-volume-track" ref={trackRef} aria-hidden>
        <i style={{ width: `${level}%` }} />
      </div>
      <strong>{level}</strong>
    </div>
  );
}
