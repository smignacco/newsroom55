"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicChannel } from "@/lib/video/player";
import { ChannelSelector } from "@/components/newsroom/ChannelSelector";
import { HlsPlayer, type PlaybackState } from "@/components/newsroom/HlsPlayer";

function Globe() {
  return (
    <div className="nr-globe" aria-hidden>
      <svg viewBox="0 0 200 200">
        <defs>
          <radialGradient id="glow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#35C6F4" stopOpacity="0.22" />
            <stop offset="70%" stopColor="#35C6F4" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#35C6F4" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="78" fill="url(#glow)" />
        <circle cx="100" cy="100" r="72" fill="none" stroke="#35C6F4" strokeOpacity="0.35" strokeWidth="1.2" />
        <ellipse cx="100" cy="100" rx="72" ry="24" fill="none" stroke="#35C6F4" strokeOpacity="0.25" />
        <ellipse cx="100" cy="100" rx="72" ry="48" fill="none" stroke="#35C6F4" strokeOpacity="0.18" />
        <line x1="28" y1="100" x2="172" y2="100" stroke="#35C6F4" strokeOpacity="0.28" />
        <line x1="100" y1="28" x2="100" y2="172" stroke="#35C6F4" strokeOpacity="0.16" />
        <g className="nr-spin">
          <ellipse cx="100" cy="100" rx="28" ry="72" fill="none" stroke="#35C6F4" strokeOpacity="0.22" />
          <circle cx="100" cy="100" r="86" fill="none" stroke="#35C6F4" strokeOpacity="0.28" strokeDasharray="3 10" />
        </g>
      </svg>
    </div>
  );
}

function ChannelPlayer({
  channel,
  muted,
  captionsEnabled,
  concurrentStreams,
  onState,
  onCaptionsAvailable,
}: {
  channel: PublicChannel;
  muted: boolean;
  captionsEnabled: boolean;
  concurrentStreams: number;
  onState: (channelId: number, state: PlaybackState, message?: string) => void;
  onCaptionsAvailable: (channelId: number, available: boolean) => void;
}) {
  const reportState = useCallback(
    (state: PlaybackState, message = "") => onState(channel.id, state, message),
    [channel.id, onState],
  );
  return (
    <HlsPlayer
      channel={channel}
      muted={muted}
      captionsEnabled={captionsEnabled}
      concurrentStreams={concurrentStreams}
      onState={reportState}
      onCaptionsAvailable={(available) =>
        onCaptionsAvailable(channel.id, available)
      }
    />
  );
}

export function LiveChannel({
  channels,
  selectedChannels,
  audioChannelId,
  layoutMode,
  focusChannelId,
  interacting,
  selectorOpen,
  onOpenSelector,
  onCloseSelector,
  onSelectChannels,
  onPlaybackState,
  muted,
  onToggleMute,
  captionsEnabled,
  onToggleCaptions,
  onFullscreen,
}: {
  channels: PublicChannel[];
  selectedChannels: PublicChannel[];
  audioChannelId: number | null;
  layoutMode: "grid" | "focus";
  focusChannelId: number | null;
  interacting: boolean;
  selectorOpen: boolean;
  onOpenSelector: () => void;
  onCloseSelector: () => void;
  onSelectChannels: (channels: PublicChannel[]) => void;
  onPlaybackState: (state: PlaybackState) => void;
  muted: boolean;
  onToggleMute: () => void;
  captionsEnabled: boolean;
  onToggleCaptions: () => void;
  onFullscreen: () => void;
}) {
  const [activeSlot, setActiveSlot] = useState(0);
  const [playback, setPlayback] = useState<
    Record<number, { state: PlaybackState; message: string }>
  >({});
  const [captionsAvailable, setCaptionsAvailable] = useState<
    Record<number, boolean>
  >({});
  const selectedIdsRef = useRef(selectedChannels.map((channel) => channel.id));
  useEffect(() => {
    selectedIdsRef.current = selectedChannels.map((channel) => channel.id);
  }, [selectedChannels]);
  const updatePlaybackState = useCallback(
    (channelId: number, state: PlaybackState, message = "") => {
      setPlayback((current) => {
        const next = { ...current, [channelId]: { state, message } };
        const visibleStates = selectedIdsRef.current.map(
          (channelId) => next[channelId]?.state ?? "idle",
        );
        const aggregate: PlaybackState = visibleStates.includes("playing")
          ? "playing"
          : visibleStates.includes("loading")
            ? "loading"
            : visibleStates.includes("error")
              ? "error"
              : "idle";
        onPlaybackState(aggregate);
        return next;
      });
    },
    [onPlaybackState],
  );
  const updateCaptionsAvailability = useCallback(
    (channelId: number, available: boolean) => {
      setCaptionsAvailable((current) =>
        current[channelId] === available
          ? current
          : { ...current, [channelId]: available },
      );
    },
    [],
  );
  const playbackStates = selectedChannels.map(
    (channel) => playback[channel.id]?.state ?? "idle",
  );
  const programState = playbackStates.includes("playing")
    ? "Diffusion en direct"
    : playbackStates.includes("loading")
      ? "Connexion"
      : playbackStates.includes("error")
        ? "Signal indisponible"
        : "En attente";
  const focusMuted =
    layoutMode === "focus" && selectedChannels.length > 1 && muted;
  const focusedCaptionsAvailable =
    focusChannelId === null ? false : captionsAvailable[focusChannelId];

  const selectChannel = (channel: PublicChannel) => {
    const next = [...selectedChannels];
    const existingIndex = next.findIndex((candidate) => candidate.id === channel.id);
    if (existingIndex >= 0 && existingIndex !== activeSlot) {
      const previous = next[activeSlot];
      next[activeSlot] = channel;
      if (previous) next[existingIndex] = previous;
    } else {
      next[activeSlot] = channel;
    }
    onSelectChannels(next.filter(Boolean).slice(0, 4));
  };

  return (
    <section className={`nr-tv ${interacting ? "interacting" : ""}`}>
      <div className="nr-frame" data-testid="iptv-wait">
        <div className="nr-frame-bar">
          <span>
            {layoutMode === "focus" && selectedChannels.length > 1 ? "Vue principale" : "Multivue"} ·{" "}
            {selectedChannels.length} source(s) · <strong>{programState}</strong>
          </span>
          <span>1–4 flux HLS · audio unique</span>
        </div>
        <div
          className={`nr-viewfinder nr-multiview nr-multiview-${selectedChannels.length || 1} ${
            layoutMode === "focus" && selectedChannels.length > 1
              ? "nr-multiview-focus"
              : ""
          }`}
        >
          {selectedChannels.map((channel, index) => {
            const channelPlayback = playback[channel.id] ?? {
              state: "idle" as PlaybackState,
              message: "",
            };
            const canPlay = channel.adapter === "hls" && channel.configured;
            return (
              <div
                className={`nr-multiview-tile ${
                  channelPlayback.state === "playing" ? "is-playing" : ""
                } ${channel.id === audioChannelId && !muted ? "is-audio" : ""} ${
                  channel.id === focusChannelId ? "is-focused" : ""
                }`}
                key={channel.id}
                role="button"
                tabIndex={0}
                aria-label={`Changer la source ${index + 1}: ${channel.name}`}
                onClick={() => {
                  setActiveSlot(index);
                  onOpenSelector();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    setActiveSlot(index);
                    onOpenSelector();
                  }
                }}
              >
                {canPlay ? (
                  <ChannelPlayer
                    channel={channel}
                    muted={muted || channel.id !== audioChannelId}
                    captionsEnabled={
                      captionsEnabled &&
                      focusMuted &&
                      channel.id === focusChannelId
                    }
                    concurrentStreams={selectedChannels.length}
                    onState={updatePlaybackState}
                    onCaptionsAvailable={updateCaptionsAvailability}
                  />
                ) : null}
                <Globe />
                <div
                  className="nr-wait-copy"
                  style={
                    selectorOpen || channelPlayback.state === "playing"
                      ? { opacity: 0 }
                      : undefined
                  }
                >
                  <div className="nr-wait-kicker">Source {index + 1}</div>
                  <div className="nr-wait-title">
                    {channelPlayback.state === "loading"
                      ? "CONNEXION"
                      : channelPlayback.state === "error"
                        ? "INDISPONIBLE"
                        : channel.name}
                  </div>
                  <div className="nr-wait-sub">
                    {channelPlayback.message || "HLS sécurisé"}
                  </div>
                </div>
                <div className="nr-multiview-label">
                  <span>ÉCRAN {String(index + 1).padStart(2, "0")}</span>
                  <strong>{channel.name}</strong>
                  {channel.id === audioChannelId ? <em>AUDIO</em> : null}
                </div>
            </div>
            );
          })}
        </div>
        {selectorOpen ? (
          <ChannelSelector
            channels={channels}
            selectedId={selectedChannels[activeSlot]?.id ?? null}
            onSelect={selectChannel}
            onClose={onCloseSelector}
          />
        ) : null}
        <div className="nr-tv-controls">
          <button
            type="button"
            className="nr-chip"
            onClick={() => {
              setActiveSlot(0);
              onOpenSelector();
            }}
          >
            Choisir une source
          </button>
          <div style={{ display: "flex", gap: "0.45rem" }}>
            {focusMuted ? (
              <button
                type="button"
                className={`nr-chip ${captionsEnabled ? "nr-chip-accent" : ""}`}
                disabled={focusedCaptionsAvailable === false}
                onClick={onToggleCaptions}
              >
                {focusedCaptionsAvailable === false
                  ? "Sous-titres indisponibles"
                  : captionsEnabled
                    ? "Désactiver les sous-titres"
                    : "Activer les sous-titres"}
              </button>
            ) : null}
            <button type="button" className="nr-chip" onClick={onToggleMute}>
              {muted ? "Son coupé" : "Audio actif"}
            </button>
            <button type="button" className="nr-chip" onClick={onFullscreen}>
              Plein écran
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
