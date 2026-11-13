"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import type { PublicChannel } from "@/lib/video/player";
import { LayoutDock } from "@/components/newsroom/LayoutDock";
import { TileContextMenu } from "@/components/newsroom/TileContextMenu";
import { HlsPlayer, type PlaybackState } from "@/components/newsroom/HlsPlayer";
import {
  TILE_TAP_SLOP,
  fillChannelIds,
  pointerGestureOpensMenu,
  resolveTilePointer,
  type TilePointerResult,
} from "@/lib/control/layout";

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
  concurrentStreams,
  onState,
}: {
  channel: PublicChannel;
  muted: boolean;
  concurrentStreams: number;
  onState: (channelId: number, state: PlaybackState, message?: string) => void;
}) {
  const reportState = useCallback(
    (state: PlaybackState, message = "") => onState(channel.id, state, message),
    [channel.id, onState],
  );
  return (
    <HlsPlayer
      channel={channel}
      muted={muted}
      concurrentStreams={concurrentStreams}
      onState={reportState}
    />
  );
}

function slotAtPoint(root: HTMLElement | null, x: number, y: number) {
  if (!root) return null;
  const tiles = root.querySelectorAll<HTMLElement>("[data-slot]");
  for (const tile of tiles) {
    const box = tile.getBoundingClientRect();
    if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
      const slot = Number(tile.dataset.slot);
      return Number.isInteger(slot) ? slot : null;
    }
  }
  return null;
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
  onSetLayoutMode,
  onSetFocusChannel,
  onSetTileAudio,
  onPlaybackState,
  muted,
  onToggleMute,
  onFullscreen,
}: {
  channels: PublicChannel[];
  selectedChannels: PublicChannel[];
  audioChannelId: number | null;
  layoutMode: "grid" | "focus";
  focusChannelId: number | null;
  interacting: boolean;
  selectorOpen?: boolean;
  onOpenSelector?: () => void;
  onCloseSelector?: () => void;
  onSelectChannels: (channels: PublicChannel[]) => void;
  onSetLayoutMode?: (mode: "grid" | "focus") => void;
  onSetFocusChannel?: (channelId: number) => void;
  onSetTileAudio?: (channelId: number, enabled: boolean) => void;
  onPlaybackState: (state: PlaybackState) => void;
  muted: boolean;
  onToggleMute: () => void;
  onFullscreen: () => void;
}) {
  const [activeSlot, setActiveSlot] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drag, setDrag] = useState<{
    fromSlot: number;
    overSlot: number | null;
  } | null>(null);
  const [playback, setPlayback] = useState<
    Record<number, { state: PlaybackState; message: string }>
  >({});
  const selectedIdsRef = useRef(selectedChannels.map((channel) => channel.id));
  const viewfinderRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<{
    pointerId: number;
    fromSlot: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const skipClickRef = useRef(false);
  const skipClickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const ignoreFollowingClick = () => {
    skipClickRef.current = true;
    if (skipClickTimer.current !== undefined) {
      clearTimeout(skipClickTimer.current);
    }
    skipClickTimer.current = setTimeout(() => {
      skipClickRef.current = false;
      skipClickTimer.current = undefined;
    }, 0);
  };
  useEffect(() => {
    selectedIdsRef.current = selectedChannels.map((channel) => channel.id);
  }, [selectedChannels]);
  const overlayOpen = menuOpen || Boolean(selectorOpen);
  const openMenu = (slot: number) => {
    setActiveSlot(slot);
    setMenuOpen(true);
    onOpenSelector?.();
  };
  const closeMenu = () => {
    setMenuOpen(false);
    onCloseSelector?.();
  };
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
    closeMenu();
  };
  const applyCount = (count: number) => {
    const nextIds = fillChannelIds(
      selectedChannels.map((channel) => channel.id),
      channels.map((channel) => channel.id),
      count,
    );
    const next = nextIds.flatMap((id) => {
      const channel = channels.find((candidate) => candidate.id === id);
      return channel ? [channel] : [];
    });
    onSelectChannels(next);
    if (next.length < 2) onSetLayoutMode?.("grid");
  };
  const applyLayoutGesture = (
    result: Exclude<TilePointerResult, { action: "tap" }>,
  ) => {
    if (result.action === "swap") {
      const next = [...selectedChannels];
      const left = next[result.from];
      const right = next[result.to];
      if (!left || !right) return;
      next[result.from] = right;
      next[result.to] = left;
      onSelectChannels(next);
      return;
    }
    if (result.action === "focus") {
      const channel = selectedChannels[result.slot];
      if (!channel) return;
      onSetLayoutMode?.("focus");
      onSetFocusChannel?.(channel.id);
      return;
    }
    onSetLayoutMode?.("grid");
  };
  const finishPointer = (
    event: PointerEvent<HTMLButtonElement>,
    cancelled: boolean,
  ) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    setDrag(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.preventDefault();
    event.stopPropagation();
    ignoreFollowingClick();
    if (cancelled) return;
    const focusedSlot = selectedChannels.findIndex(
      (channel) => channel.id === focusChannelId,
    );
    const result = resolveTilePointer({
      fromSlot: gesture.fromSlot,
      overSlot: slotAtPoint(viewfinderRef.current, event.clientX, event.clientY),
      dx: event.clientX - gesture.startX,
      dy: event.clientY - gesture.startY,
      layoutMode,
      selectedCount: selectedChannels.length,
      focusedSlot: focusedSlot >= 0 ? focusedSlot : null,
    });
    if (pointerGestureOpensMenu(result)) {
      openMenu(gesture.fromSlot);
      return;
    }
    if (result) applyLayoutGesture(result);
  };
  const onTilePointerDown = (event: PointerEvent<HTMLButtonElement>, slot: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = {
      pointerId: event.pointerId,
      fromSlot: slot,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
  };
  const onTilePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.dragging && Math.hypot(dx, dy) < TILE_TAP_SLOP) return;
    gesture.dragging = true;
    setDrag({
      fromSlot: gesture.fromSlot,
      overSlot: slotAtPoint(viewfinderRef.current, event.clientX, event.clientY),
    });
  };
  const onTilePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    finishPointer(event, false);
  };
  const onTilePointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    finishPointer(event, true);
  };
  const onTileClick = (event: MouseEvent<HTMLButtonElement>, slot: number) => {
    event.preventDefault();
    event.stopPropagation();
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    openMenu(slot);
  };
  const activeChannel = selectedChannels[activeSlot] ?? null;
  const tileAudioOn = Boolean(
    activeChannel && activeChannel.id === audioChannelId && !muted,
  );
  const tileFocused = Boolean(
    activeChannel && activeChannel.id === focusChannelId && layoutMode === "focus",
  );
  const dragHint =
    drag == null
      ? null
      : layoutMode === "focus"
        ? "Relâcher sur un écran pour le déplacer · glisser vers le bas pour la grille"
        : "Glisser vers le haut : focus · relâcher sur un écran : échanger";

  return (
    <section className={`nr-tv ${interacting ? "interacting" : ""}`}>
      <div className="nr-frame" data-testid="iptv-wait">
        <div className="nr-frame-bar">
          <span>
            {layoutMode === "focus" && selectedChannels.length > 1 ? "Vue principale" : "Multivue"} ·{" "}
            {selectedChannels.length} source(s) · <strong>{programState}</strong>
          </span>
          <LayoutDock
            selectedCount={selectedChannels.length || 1}
            availableCount={channels.length}
            layoutMode={layoutMode === "focus" && selectedChannels.length > 1 ? "focus" : "grid"}
            onSetCount={applyCount}
            onSetMode={(mode) => onSetLayoutMode?.(mode)}
          />
        </div>
        <div
          ref={viewfinderRef}
          className={`nr-viewfinder nr-multiview nr-multiview-${selectedChannels.length || 1} ${
            layoutMode === "focus" && selectedChannels.length > 1
              ? "nr-multiview-focus"
              : ""
          } ${drag ? "is-rearranging" : ""}`}
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
                } ${drag?.fromSlot === index ? "is-dragging" : ""} ${
                  drag?.overSlot === index && drag.fromSlot !== index ? "is-drop-target" : ""
                }`}
                key={channel.id}
                data-slot={index}
                data-testid="multiview-tile"
              >
                {canPlay ? (
                  <ChannelPlayer
                    channel={channel}
                    muted={muted || channel.id !== audioChannelId}
                    concurrentStreams={selectedChannels.length}
                    onState={updatePlaybackState}
                  />
                ) : null}
                <Globe />
                <div
                  className="nr-wait-copy"
                  style={
                    overlayOpen || channelPlayback.state === "playing"
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
                  {channel.id === audioChannelId && !muted ? <em>AUDIO</em> : null}
                </div>
                <button
                  type="button"
                  className="nr-tile-hit"
                  aria-label={`Écran ${index + 1}: ${channel.name}. Toucher pour le menu, glisser pour déplacer.`}
                  onPointerDown={(event) => onTilePointerDown(event, index)}
                  onPointerMove={onTilePointerMove}
                  onPointerUp={onTilePointerUp}
                  onPointerCancel={onTilePointerCancel}
                  onClick={(event) => onTileClick(event, index)}
                />
              </div>
            );
          })}
          {dragHint ? (
            <div className="nr-layout-hint" data-testid="layout-drag-hint">
              {dragHint}
            </div>
          ) : null}
        </div>
        {overlayOpen ? (
          <TileContextMenu
            slotIndex={activeSlot}
            channels={channels}
            tileChannel={activeChannel}
            audioEnabled={tileAudioOn}
            canFocus={selectedChannels.length > 1}
            isFocused={tileFocused}
            onSelectChannel={selectChannel}
            onSetAudio={(enabled) => {
              if (activeChannel) onSetTileAudio?.(activeChannel.id, enabled);
            }}
            onFocus={() => {
              if (!activeChannel) return;
              onSetLayoutMode?.("focus");
              onSetFocusChannel?.(activeChannel.id);
              closeMenu();
            }}
            onClose={closeMenu}
          />
        ) : null}
        <div className="nr-tv-controls">
          <button
            type="button"
            className="nr-chip"
            onClick={() => {
              openMenu(layoutMode === "focus" && focusChannelId
                ? Math.max(0, selectedChannels.findIndex((channel) => channel.id === focusChannelId))
                : 0);
            }}
          >
            Choisir une source
          </button>
          <div style={{ display: "flex", gap: "0.45rem" }}>
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
