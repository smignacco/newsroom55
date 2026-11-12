"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BoardControlState } from "@/lib/control/state";
import { nextRemotePowerControl } from "@/lib/control/remote";
import type { NewsStory } from "@/lib/news/aggregator";
import type { PublicChannel } from "@/lib/video/player";

type HealthDisplaySettings = {
  enabled: boolean;
  privacyMode: boolean;
  showAverage: boolean;
  showPhases: boolean;
  showActiveEnergy: boolean;
};

type HealthToggleKey = keyof HealthDisplaySettings;
type RemoteControlState = BoardControlState & {
  roomOsSynchronized?: boolean;
};

type Action =
  | "mute"
  | "captions"
  | "power"
  | "wake"
  | "volume-up"
  | "volume-down"
  | `layout-${number}`
  | `source-${number}`
  | "audio"
  | `audio-${number}`
  | `focus-${number}`
  | `health-${HealthToggleKey}`
  | `story-${number}`
  | "mode-grid"
  | "mode-focus"
  | "reload-board"
  | "close-story";

export function RemoteControl({
  csrf,
  initialState,
  channels,
  initialHealth,
  stories,
}: {
  csrf: string;
  initialState: BoardControlState;
  channels: PublicChannel[];
  initialHealth: HealthDisplaySettings;
  stories: NewsStory[];
}) {
  const [state, setState] = useState<RemoteControlState>(initialState);
  const [health, setHealth] = useState(initialHealth);
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [connected, setConnected] = useState(true);
  const [roomOsSynchronized, setRoomOsSynchronized] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(new Date());

  useEffect(() => {
    if (pending !== null) return;
    let cancelled = false;
    const sync = async () => {
      try {
        const response = await fetch("/api/admin/control", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("sync failed");
        const next = (await response.json()) as RemoteControlState;
        if (!cancelled) {
          setState(next);
          setConnected(true);
          setRoomOsSynchronized(Boolean(next.roomOsSynchronized));
          setLastSyncedAt(new Date());
        }
      } catch {
        if (!cancelled) setConnected(false);
      }
    };
    void sync();
    const interval = window.setInterval(() => {
      if (!document.hidden) void sync();
    }, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pending]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3_000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function update(payload: object, action: Action, success = "") {
    setPending(action);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/control", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as
        | BoardControlState
        | { error?: string }
        | null;
      if (!response.ok) {
        setError(data && "error" in data && data.error ? data.error : "La commande a échoué.");
        return;
      }
      setState(data as BoardControlState);
      setConnected(true);
      setLastSyncedAt(new Date());
      if (success) setNotice(success);
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setPending(null);
    }
  }

  async function updateHealth(key: HealthToggleKey, value: boolean) {
    const action: Action = `health-${key}`;
    setPending(action);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/health", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ settings: { [key]: value } }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        setError(data?.error || "La configuration n’a pas pu être enregistrée.");
        return;
      }
      setHealth((current) => ({ ...current, [key]: value }));
      const reload = await fetch("/api/admin/control", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ displayCommand: "reload" }),
      });
      if (!reload.ok) {
        setError("Configuration enregistrée, mais le tableau n’a pas pu être rechargé.");
        return;
      }
      setState((await reload.json()) as BoardControlState);
      setNotice("Affichage personnel mis à jour sur le tableau.");
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setPending(null);
    }
  }

  const selectedIds = state.channelIds.length
    ? state.channelIds
    : state.channelId !== null
      ? [state.channelId]
      : [];
  const activeChannel = channels.find((channel) => channel.id === state.audioChannelId);
  const selectedChannels = selectedIds.flatMap((channelId) => {
    const channel = channels.find((candidate) => candidate.id === channelId);
    return channel ? [channel] : [];
  });
  const canUseCaptions =
    state.layoutMode === "focus" && state.muted && selectedIds.length > 1;
  const nextPower = nextRemotePowerControl(state.powerState);

  function setLayout(count: number) {
    const next = selectedIds.slice(0, count);
    for (const channel of channels) {
      if (next.length >= count) break;
      if (!next.includes(channel.id)) next.push(channel.id);
    }
    const audioChannelId =
      state.audioChannelId !== null && next.includes(state.audioChannelId)
        ? state.audioChannelId
        : next[0];
    const focusChannelId =
      state.focusChannelId !== null && next.includes(state.focusChannelId)
        ? state.focusChannelId
        : next[0];
    void update(
      {
        channelIds: next,
        audioChannelId,
        focusChannelId,
        layoutMode: count < 2 ? "grid" : state.layoutMode,
      },
      `layout-${count}`,
      `Multivue ajustée à ${count} source${count > 1 ? "s" : ""}.`,
    );
  }

  function setSource(slot: number, channelId: number) {
    const next = [...selectedIds];
    const duplicate = next.indexOf(channelId);
    if (duplicate >= 0 && duplicate !== slot) {
      [next[slot], next[duplicate]] = [next[duplicate], next[slot]];
    } else {
      next[slot] = channelId;
    }
    const audioChannelId =
      state.audioChannelId !== null && next.includes(state.audioChannelId)
        ? state.audioChannelId
        : next[0];
    const focusChannelId =
      state.focusChannelId !== null && next.includes(state.focusChannelId)
        ? state.focusChannelId
        : next[0];
    void update(
      { channelIds: next, audioChannelId, focusChannelId },
      `source-${slot}`,
      `Source ${slot + 1} mise à jour.`,
    );
  }
  return (
    <main className="remote-shell">
      <header className="remote-header">
        <div>
          <span className="remote-eyebrow">CISCO · BOARD 55</span>
          <h1>Télécommande</h1>
        </div>
        <div className="remote-connection" aria-live="polite">
          <span>
            {!connected
              ? "Serveur hors ligne"
              : roomOsSynchronized
                ? `Board synchronisé${
                  lastSyncedAt
                    ? ` · ${lastSyncedAt.toLocaleTimeString("fr-CA", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : ""
                  }`
                : "État du Board indisponible"}
          </span>
          <i
            className={`remote-dot ${
              !connected
                ? "is-offline"
                : !roomOsSynchronized
                  ? ""
                  : state.powerState === "active"
                  ? "is-active"
                  : state.powerState === "halfwake"
                    ? "is-halfwake"
                    : ""
            }`}
          />
        </div>
      </header>

      <section className="remote-now">
        <span>MULTIVUE EN ONDES</span>
        <strong>{selectedIds.length} source(s) · {activeChannel?.name ?? "Audio non sélectionné"}</strong>
        <div className="remote-status-chips">
          <small>{state.layoutMode === "focus" ? "Focus" : "Grille"}</small>
          <small>{state.muted ? "Son coupé" : "Audio actif"}</small>
          <small>
            {state.captionsEnabled
              ? "Sous-titres demandés"
              : "Sous-titres désactivés"}
          </small>
        </div>
      </section>

      <section
        className="remote-control-section remote-section-card"
        id="remote-live"
        aria-label="Contrôles rapides"
      >
        <div className="remote-section-title">
          <h2>Contrôles rapides</h2>
          <span>Affichage et audio</span>
        </div>
        <div className="remote-quick-grid">
          <button
            type="button"
            className={`remote-quick-action ${state.muted ? "is-on" : ""}`}
            aria-pressed={state.muted}
            disabled={pending !== null}
            onClick={() =>
              void update(
                { muted: !state.muted },
                "mute",
                state.muted ? "Son activé." : "Son coupé.",
              )
            }
          >
            <span>{state.muted ? "SON COUPÉ" : "AUDIO"}</span>
            <strong>{state.muted ? "Réactiver le son" : "Couper le son"}</strong>
          </button>
          <button
            type="button"
            className={`remote-quick-action ${state.captionsEnabled ? "is-on" : ""}`}
            aria-pressed={state.captionsEnabled}
            disabled={pending !== null || (!canUseCaptions && !state.captionsEnabled)}
            onClick={() =>
              void update(
                { captionsEnabled: !state.captionsEnabled },
                "captions",
                state.captionsEnabled
                  ? "Sous-titres désactivés."
                  : "Sous-titres activés si le flux en fournit.",
              )
            }
          >
            <span>SOUS-TITRES</span>
            <strong>{state.captionsEnabled ? "Désactiver" : "Activer"}</strong>
            {!canUseCaptions && !state.captionsEnabled ? (
              <small>Focus + son coupé requis</small>
            ) : null}
          </button>
          <button
            type="button"
            className="remote-quick-action"
            disabled={pending !== null}
            onClick={() =>
              void update(
                { displayCommand: "reload" },
                "reload-board",
                "Rechargement du tableau demandé.",
              )
            }
          >
            <span>AFFICHAGE</span>
            <strong>Recharger l’écran</strong>
          </button>
          <button
            type="button"
            className={`remote-quick-action ${state.powerState !== "active" ? "is-on" : ""}`}
            disabled={pending !== null}
            onClick={() =>
              void update(
                { power: nextPower.command },
                "power",
                state.powerState === "active"
                  ? "Board mis en veille."
                  : state.powerState === "standby"
                    ? "Signalisation réaffichée en Halfwake."
                    : "Board activé.",
              )
            }
          >
            <span>WEBEX BOARD</span>
            <strong>{nextPower.label}</strong>
          </button>
        </div>
        <div className="remote-volume-row">
          <button
            type="button"
            disabled={pending !== null}
            aria-label="Diminuer le volume"
            onClick={() =>
              void update(
                { volume: "down" },
                "volume-down",
                "Volume du Board diminué.",
              )
            }
          >
            −
          </button>
          <div>
            <span>VOLUME</span>
            <strong>{state.muted ? "Son coupé" : "Contrôle du Board"}</strong>
          </div>
          <button
            type="button"
            disabled={pending !== null}
            aria-label="Augmenter le volume"
            onClick={() =>
              void update(
                { volume: "up" },
                "volume-up",
                "Volume du Board augmenté.",
              )
            }
          >
            +
          </button>
        </div>
        <label className="remote-audio-source">
          <span>Source audio</span>
          <select
            value={state.muted ? "" : (state.audioChannelId ?? "")}
            disabled={pending !== null || selectedIds.length === 0}
            onChange={(event) => {
              const next = event.target.value ? Number(event.target.value) : null;
              void update(
                next === null
                  ? { muted: true }
                  : { audioChannelId: next, muted: false },
                "audio",
                next === null ? "Audio coupé." : "Source audio modifiée.",
              );
            }}
          >
            <option value="">Aucune</option>
            {selectedChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section
        className="remote-control-section remote-section-card"
        id="remote-sources"
        aria-label="Gestion multivue"
      >
        <div className="remote-section-title">
          <h2>Sources</h2>
          <span>Une à quatre chaînes simultanées</span>
        </div>
        <div className="remote-layout-picker">
          {[1, 2, 3, 4].map((count) => (
            <button
              type="button"
              key={count}
              className={selectedIds.length === count ? "is-selected" : ""}
              disabled={pending !== null || channels.length < count}
              onClick={() => setLayout(count)}
            >
              {count}
            </button>
          ))}
        </div>
        <div className="remote-view-picker">
          <button
            type="button"
            className={state.layoutMode === "grid" ? "is-selected" : ""}
            disabled={pending !== null}
            onClick={() =>
              void update(
                { layoutMode: "grid" },
                "mode-grid",
                "Disposition en grille activée.",
              )
            }
          >
            Grille
          </button>
          <button
            type="button"
            className={state.layoutMode === "focus" ? "is-selected" : ""}
            disabled={pending !== null || selectedIds.length < 2}
            onClick={() =>
              void update(
                {
                  layoutMode: "focus",
                  focusChannelId: state.focusChannelId ?? selectedIds[0],
                },
                "mode-focus",
                "Mode focus activé.",
              )
            }
          >
            Focus
          </button>
        </div>
        <div className="remote-source-grid">
          {selectedIds.map((channelId, slot) => {
            const channel = channels.find((candidate) => candidate.id === channelId);
            const hasAudio = state.audioChannelId === channelId && !state.muted;
            return (
              <article
                className={`${hasAudio ? "is-audio" : ""} ${
                  state.layoutMode === "focus" && state.focusChannelId === channelId
                    ? "is-focused"
                    : ""
                }`}
                key={`${slot}-${channelId}`}
              >
                <div>
                  <span>SOURCE {slot + 1}</span>
                  <strong>{channel?.name ?? "Chaîne indisponible"}</strong>
                </div>
                <select
                  aria-label={`Chaîne de la source ${slot + 1}`}
                  value={channelId}
                  disabled={pending !== null}
                  onChange={(event) => setSource(slot, Number(event.target.value))}
                >
                  {channels.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
                <div className="remote-source-actions">
                  <button
                    type="button"
                    className={hasAudio ? "is-selected" : ""}
                    disabled={pending !== null}
                    onClick={() =>
                      void update(
                        { audioChannelId: channelId, muted: false },
                        `audio-${channelId}`,
                        `Audio sélectionné : ${channel?.name ?? `source ${slot + 1}`}.`,
                      )
                    }
                  >
                    {hasAudio ? "Audio actif" : "Écouter"}
                  </button>
                  <button
                    type="button"
                    className={
                      state.layoutMode === "focus" && state.focusChannelId === channelId
                        ? "is-selected"
                        : ""
                    }
                    disabled={pending !== null || selectedIds.length < 2}
                    onClick={() =>
                      void update(
                        { layoutMode: "focus", focusChannelId: channelId },
                        `focus-${channelId}`,
                        `Focus : ${channel?.name ?? `source ${slot + 1}`}.`,
                      )
                    }
                  >
                    Focus
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section
        className="remote-control-section remote-section-card"
        id="remote-news"
        aria-label="Nouvelles à l’écran"
      >
        <div className="remote-section-title">
          <h2>Nouvelles</h2>
          <span>Ouvrir sur le Board</span>
        </div>
        <button
          type="button"
          className="remote-close-story"
          disabled={pending !== null}
          onClick={() =>
            void update(
              { displayCommand: "close-story" },
              "close-story",
              "Nouvelle fermée sur le tableau.",
            )
          }
        >
          {pending === "close-story" ? "Fermeture…" : "Fermer la nouvelle à l’écran"}
        </button>
        <div className="remote-story-list">
          {stories.map((item) => (
            <button
              type="button"
              key={item.id}
              disabled={pending !== null}
              onClick={() =>
                void update(
                  { displayCommand: "open-story", storyId: item.id },
                  `story-${item.id}`,
                  "Nouvelle affichée sur le tableau.",
                )
              }
            >
              <span>{item.category} · {item.source}</span>
              <strong>{item.title}</strong>
            </button>
          ))}
        </div>
      </section>

      <section
        className="remote-control-section remote-section-card"
        id="remote-settings"
        aria-label="Affichage du tableau"
      >
        <div className="remote-section-title">
          <h2>Réglages</h2>
          <span>Activity & Sleep</span>
        </div>
        <div className="remote-health-grid">
          {(
            [
              ["enabled", "Afficher le panneau"],
              ["privacyMode", "Mode confidentiel"],
              ["showAverage", "Moyenne sommeil"],
              ["showPhases", "Phases sommeil"],
              ["showActiveEnergy", "Énergie active"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="remote-health-toggle">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={health[key]}
                disabled={pending !== null}
                onChange={(event) => void updateHealth(key, event.target.checked)}
              />
            </label>
          ))}
        </div>
      </section>

      {error ? <div className="remote-error" role="alert">{error}</div> : null}
      {notice ? <div className="remote-notice" role="status">{notice}</div> : null}

      <aside className="remote-install-hint">
        <span>RACCOURCI IPHONE</span>
        <p>Dans Safari : Partager → Sur l’écran d’accueil.</p>
      </aside>

      <footer className="remote-footer">
        <Link href="/">Voir le tableau</Link>
        <Link href="/admin">Administration</Link>
      </footer>

      <nav className="remote-bottom-nav" aria-label="Navigation de la télécommande">
        <a href="#remote-live">Direct</a>
        <a href="#remote-sources">Sources</a>
        <a href="#remote-news">Nouvelles</a>
        <a href="#remote-settings">Réglages</a>
      </nav>
    </main>
  );
}
