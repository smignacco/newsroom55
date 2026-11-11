"use client";

import { useState } from "react";
import Link from "next/link";
import type { BoardControlState } from "@/lib/control/state";
import type { PublicChannel } from "@/lib/video/player";

type Action =
  | "mute"
  | "power"
  | "wake"
  | "volume-up"
  | "volume-down"
  | `layout-${number}`
  | `source-${number}`
  | `audio-${number}`
  | `focus-${number}`
  | "mode-grid"
  | "mode-focus";

export function RemoteControl({
  csrf,
  initialState,
  channels,
}: {
  csrf: string;
  initialState: BoardControlState;
  channels: PublicChannel[];
}) {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
      if (success) setNotice(success);
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
        <span
          className={`remote-dot ${
            state.powerState === "active"
              ? "is-active"
              : state.powerState === "halfwake"
                ? "is-halfwake"
                : ""
          }`}
        />
      </header>

      <section className="remote-now">
        <span>MULTIVUE EN ONDES</span>
        <strong>{selectedIds.length} source(s) · {activeChannel?.name ?? "Audio non sélectionné"}</strong>
        <small>{state.muted ? "Audio général coupé" : "Audio de la source sélectionnée"}</small>
      </section>

      <section className="remote-control-section" aria-label="Gestion multivue">
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

      <section className="remote-control-section" aria-label="Contrôles audio">
        <div className="remote-section-title">
          <h2>Audio</h2>
          <span>Flux et volume du Board</span>
        </div>
        <div className="remote-audio-grid">
        <button
          type="button"
          className={`remote-command remote-command-audio ${!state.muted ? "is-on" : ""}`}
          disabled={pending !== null}
          onClick={() =>
            void update(
              { muted: !state.muted },
              "mute",
              state.muted ? "Audio du flux activé." : "Audio du flux coupé.",
            )
          }
        >
          <span className="remote-command-icon" aria-hidden>{state.muted ? "M" : "A"}</span>
          <span>{pending === "mute" ? "Envoi…" : state.muted ? "Réactiver le son" : "Couper le son"}</span>
        </button>
          <div className="remote-volume-control">
            <span>VOLUME DU BOARD</span>
            <div>
              <button
                type="button"
                aria-label="Diminuer le volume"
                disabled={pending !== null}
                onClick={() =>
                  void update(
                    { volume: "down" },
                    "volume-down",
                    "Volume du Board diminué.",
                  )
                }
              >
                {pending === "volume-down" ? "…" : "−"}
              </button>
              <button
                type="button"
                aria-label="Augmenter le volume"
                disabled={pending !== null}
                onClick={() =>
                  void update(
                    { volume: "up" },
                    "volume-up",
                    "Volume du Board augmenté.",
                  )
                }
              >
                {pending === "volume-up" ? "…" : "+"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="remote-control-section" aria-label="État du Board">
        <div className="remote-section-title">
          <h2>Énergie</h2>
          <span>
            {state.powerState === "halfwake"
              ? "Mode Halfwake"
              : state.powerState === "standby"
                ? "En veille"
                : "Mode actif"}
          </span>
        </div>
        <div className="remote-power-grid">
        <button
          type="button"
          className={`remote-command ${state.powerState === "standby" ? "remote-command-wake" : "remote-command-standby"}`}
          disabled={pending !== null}
          onClick={() =>
            void update(
              { power: state.powerState === "standby" ? "signage" : "standby" },
              "power",
              state.powerState === "standby"
                ? "Signalisation réaffichée en Halfwake."
                : "Board mis en veille.",
            )
          }
        >
          <span className="remote-command-icon" aria-hidden>◉</span>
          <span>
            {pending === "power"
              ? "Commande RoomOS…"
              : state.powerState === "standby"
                ? "Réafficher"
                : "Mettre en veille"}
          </span>
        </button>
          <button
            type="button"
            className="remote-command remote-command-active"
            disabled={pending !== null}
            onClick={() =>
              void update(
                { power: "wake" },
                "wake",
                "Halfwake quitté; Board en mode actif.",
              )
            }
          >
            <span className="remote-command-icon" aria-hidden>↗</span>
            <span>{pending === "wake" ? "Activation…" : "Quitter Halfwake"}</span>
          </button>
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
    </main>
  );
}
