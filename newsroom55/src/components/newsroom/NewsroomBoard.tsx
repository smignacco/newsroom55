"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { BoardSnapshot } from "@/lib/board-snapshot";
import type { BoardControlState } from "@/lib/control/state";
import type { NewsStory } from "@/lib/news/aggregator";
import type { Quote } from "@/lib/markets/provider";
import { BroadcastHeader } from "@/components/newsroom/BroadcastHeader";
import { LiveChannel } from "@/components/newsroom/LiveChannel";
import { NewsFeed } from "@/components/newsroom/NewsFeed";
import { BreakingNews } from "@/components/newsroom/BreakingNews";
import { MarketTicker } from "@/components/newsroom/MarketTicker";
import { StatusStrip } from "@/components/newsroom/StatusStrip";
import type { PlaybackState } from "@/components/newsroom/HlsPlayer";

export function NewsroomBoard({
  initial,
  initialControl,
}: {
  initial: BoardSnapshot;
  initialControl: BoardControlState;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [online, setOnline] = useState(true);
  const [category, setCategory] = useState<string | null>(null);
  const [selector, setSelector] = useState(false);
  const [selectedChannelIds, setSelectedChannelIds] = useState<number[]>(
    initialControl.channelIds.length
      ? initialControl.channelIds
      : [
          initial.channels.find((channel) => channel.isDefault)?.id ??
            initial.channels[0]?.id,
        ].filter((id): id is number => id !== undefined),
  );
  const [audioChannelId, setAudioChannelId] = useState<number | null>(
    initialControl.audioChannelId,
  );
  const [layoutMode, setLayoutMode] = useState(initialControl.layoutMode);
  const [focusChannelId, setFocusChannelId] = useState<number | null>(
    initialControl.focusChannelId,
  );
  const [muted, setMuted] = useState(initialControl.muted);
  const [paused, setPaused] = useState(false);
  const [story, setStory] = useState<NewsStory | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [settings, setSettings] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [videoState, setVideoState] = useState<PlaybackState>("idle");
  const controlRevision = useRef(initialControl.revision);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/board", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as BoardSnapshot;
      setSnapshot(data);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void refresh();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const poll = setInterval(() => {
      if (document.hidden) return;
      void refresh();
    }, 20_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(poll);
    };
  }, [refresh]);

  useEffect(() => {
    const pollControl = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/control", { cache: "no-store" });
        if (!response.ok) return;
        const control = (await response.json()) as BoardControlState;
        if (control.revision === controlRevision.current) return;
        controlRevision.current = control.revision;
        setSelectedChannelIds(control.channelIds);
        setAudioChannelId(control.audioChannelId);
        setLayoutMode(control.layoutMode);
        setFocusChannelId(control.focusChannelId);
        setMuted(control.muted);
      } catch {
        // The regular board health poll reports connectivity.
      }
    };
    const interval = window.setInterval(() => void pollControl(), 1500);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let idle: number | undefined;
    const bump = () => {
      setInteracting(true);
      window.clearTimeout(idle);
      idle = window.setTimeout(() => setInteracting(false), 5000);
    };
    window.addEventListener("pointerdown", bump);
    return () => {
      window.removeEventListener("pointerdown", bump);
      window.clearTimeout(idle);
    };
  }, []);

  const headlines = useMemo(() => {
    const list = category ? snapshot.stories.filter((s) => s.category === category) : snapshot.headlines;
    return list.filter((s) => s.id !== snapshot.featured?.id).slice(0, 10);
  }, [category, snapshot]);

  const featured = useMemo(() => {
    if (!category) return snapshot.featured;
    return snapshot.stories.find((s) => s.category === category) ?? null;
  }, [category, snapshot]);

  const performance = snapshot.appearance.animations === "reduced";
  const selectedChannels = selectedChannelIds.flatMap((id) => {
    const channel = snapshot.channels.find((candidate) => candidate.id === id);
    return channel ? [channel] : [];
  });

  return (
    <div className={`nr-board ${performance ? "performance" : ""}`} style={{ fontSize: `${snapshot.appearance.textScale}%` }}>
      <BroadcastHeader timezone={snapshot.appearance.timezone} />
      <LiveChannel
        channels={snapshot.channels}
        selectedChannels={selectedChannels}
        audioChannelId={audioChannelId}
        layoutMode={layoutMode}
        focusChannelId={focusChannelId}
        interacting={interacting}
        selectorOpen={selector}
        onOpenSelector={() => setSelector(true)}
        onCloseSelector={() => setSelector(false)}
        onSelectChannels={(channels) => {
          setSelectedChannelIds(channels.map((channel) => channel.id));
          if (!channels.some((channel) => channel.id === audioChannelId)) {
            setAudioChannelId(channels[0]?.id ?? null);
          }
          if (!channels.some((channel) => channel.id === focusChannelId)) {
            setFocusChannelId(channels[0]?.id ?? null);
          }
          setSelector(false);
        }}
        onPlaybackState={setVideoState}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onFullscreen={() => {
          const el = document.documentElement;
          if (!document.fullscreenElement) void el.requestFullscreen?.();
          else void document.exitFullscreen?.();
        }}
      />
      <NewsFeed
        featured={featured}
        headlines={headlines}
        category={category}
        timezone={snapshot.appearance.timezone}
        lastRefresh={snapshot.newsHealth.lastFetch}
        refreshIntervalSec={snapshot.appearance.newsRefreshIntervalSec}
        onCategory={setCategory}
        onOpen={setStory}
      />
      <BreakingNews story={snapshot.alert} timezone={snapshot.appearance.timezone} />
      <MarketTicker
        quotes={snapshot.markets.quotes}
        board={snapshot.markets.board}
        providerName={snapshot.markets.providerName}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        onOpen={setQuote}
      />
      <StatusStrip
        online={online}
        news={snapshot.newsHealth}
        markets={snapshot.markets}
        videoState={videoState}
        timezone={snapshot.appearance.timezone}
        onDesk={() => setSettings(true)}
      />

      {story ? (
        <div className="nr-drawer" onClick={() => setStory(null)}>
          <div className="nr-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="nr-kicker">
              {story.category} · {story.priority === "BREAKING" ? "ALERTE" : story.priority}
            </div>
            <h3>{story.title}</h3>
            <p>
              {story.summary ||
                "Ouvrez la page de l’éditeur pour lire l’article complet. Seuls le titre et les métadonnées sont affichés ici."}
            </p>
            <div className="nr-meta">
              <span>{story.source}</span>
              {story.url ? (
                <a href={story.url} target="_blank" rel="noopener noreferrer">
                  Article original
                </a>
              ) : null}
            </div>
            <div style={{ marginTop: "1rem" }}>
              <button type="button" className="nr-chip" onClick={() => setStory(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {quote ? (
        <div className="nr-drawer" onClick={() => setQuote(null)}>
          <div className="nr-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="nr-kicker">
              {quote.status === "LIVE"
                ? "DIRECT"
                : quote.status === "DELAYED"
                  ? "DIFFÉRÉ"
                  : "INDISPONIBLE"}
            </div>
            <h3>
              {quote.displayName} · {quote.symbol}
            </h3>
            <p>
              {quote.price == null
                ? "Aucun cours fiable n’est disponible. Les prix ne sont jamais inventés."
                : `${quote.price} ${quote.currency}`}
            </p>
            <div className="nr-meta">
              <span>Fournisseur {quote.provider}</span>
              <span>{quote.asOf ?? "aucun horodatage"}</span>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <button type="button" className="nr-chip" onClick={() => setQuote(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {settings ? (
        <div className="nr-drawer" onClick={() => setSettings(false)}>
          <div className="nr-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Réglages</h3>
            <p>L’apparence et les sources sont gérées dans la console protégée /admin.</p>
            <Link href="/admin">Ouvrir l’administration</Link>
            <div style={{ marginTop: "1rem" }}>
              <button type="button" className="nr-chip" onClick={() => setSettings(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
