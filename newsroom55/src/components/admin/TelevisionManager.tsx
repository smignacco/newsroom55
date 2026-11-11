"use client";

import { useEffect, useMemo, useState } from "react";

type Playlist = {
  playlist_key: string;
  name: string;
  catalog_url: string;
  repository_sha: string | null;
  subscribed: number;
  sync_interval_min: number;
  last_sync_at: string | null;
  last_change_at: string | null;
  last_status: string;
  last_error: string | null;
  channel_count: number;
  next_sync_at: string | null;
};

type Channel = {
  id: number;
  name: string;
  adapter: string;
  enabled: number;
  is_default: number;
  status: string;
  tvg_id: string | null;
  logo_url: string | null;
  group_title: string | null;
  catalog_source: string | null;
  playlist_name: string | null;
  last_catalog_sync_at: string | null;
};

async function adminApi(path: string, csrf: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf,
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function relativeDate(value: string | null): string {
  if (!value) return "Jamais";
  const deltaMinutes = Math.round((new Date(value).getTime() - Date.now()) / 60_000);
  if (Math.abs(deltaMinutes) < 1) return "Maintenant";
  return new Intl.RelativeTimeFormat("fr-CA", { numeric: "auto" }).format(
    deltaMinutes,
    "minute",
  );
}

function statusLabel(status: string): string {
  if (status === "updated") return "Dépôt actualisé";
  if (status === "unchanged") return "Aucun changement";
  if (status === "error") return "Erreur de synchronisation";
  return "Prêt à surveiller";
}

export function TelevisionManager({ csrf }: { csrf: string }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [playlistSearch, setPlaylistSearch] = useState("");
  const [channelSearch, setChannelSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<"all" | "enabled" | "attention">(
    "all",
  );
  const [sourceFilter, setSourceFilter] = useState("all");
  const [pending, setPending] = useState<string | null>(null);
  const [pendingChannels, setPendingChannels] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [directoryWarning, setDirectoryWarning] = useState("");

  async function load(refreshDirectory = false) {
    const [playlistData, channelData] = await Promise.all([
      adminApi(
        `/api/admin/playlists${refreshDirectory ? "?refresh=1" : ""}`,
        csrf,
      ),
      adminApi("/api/admin/channels", csrf),
    ]);
    setPlaylists(playlistData.playlists);
    setChannels(channelData.channels);
    setDirectoryWarning(playlistData.directoryWarning || "");
  }

  useEffect(() => {
    // Initial API hydration is the effect's synchronization target.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((caught) =>
      setError(caught instanceof Error ? caught.message : "Chargement impossible"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(key: string, action: () => Promise<string | void>) {
    setPending(key);
    setError("");
    setMessage("");
    try {
      const success = await action();
      if (success) setMessage(success);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La commande a échoué");
    } finally {
      setPending(null);
    }
  }

  async function runChannel(
    channelId: number,
    action: () => Promise<string>,
  ) {
    setPendingChannels((current) => new Set(current).add(channelId));
    setError("");
    setMessage("");
    try {
      setMessage(await action());
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La commande a échoué");
    } finally {
      setPendingChannels((current) => {
        const next = new Set(current);
        next.delete(channelId);
        return next;
      });
    }
  }

  const subscriptions = playlists.filter((playlist) => Boolean(playlist.subscribed));
  const enabledChannels = channels.filter((channel) => Boolean(channel.enabled));
  const playlistMatches = playlists
    .filter((playlist) => {
      const query = playlistSearch.trim().toLocaleLowerCase();
      return (
        !query ||
        playlist.name.toLocaleLowerCase().includes(query) ||
        playlist.playlist_key.includes(query)
      );
    })
    .slice(0, 120);
  const filteredChannels = useMemo(
    () =>
      channels.filter((channel) => {
        const query = channelSearch.trim().toLocaleLowerCase();
        const matchesSearch =
          !query ||
          channel.name.toLocaleLowerCase().includes(query) ||
          (channel.tvg_id || "").toLocaleLowerCase().includes(query) ||
          (channel.group_title || "").toLocaleLowerCase().includes(query);
        const matchesFilter =
          channelFilter === "all" ||
          (channelFilter === "enabled" && Boolean(channel.enabled)) ||
          (channelFilter === "attention" &&
            ["catalog-removed", "catalog-unsubscribed", "catalog-pinned", "unsupported-format"].includes(
              channel.status,
            ));
        const matchesSource =
          sourceFilter === "all" || channel.catalog_source === `iptv-org:${sourceFilter}`;
        return matchesSearch && matchesFilter && matchesSource;
      }),
    [channelFilter, channelSearch, channels, sourceFilter],
  );

  return (
    <div className="tv-manager">
      <header className="tv-manager-hero">
        <div>
          <div className="nr-kicker">iptv-org · dépôt officiel</div>
          <h2>Gestion des stations</h2>
          <p>
            Choisissez les listes à surveiller. Les liens des stations déjà sélectionnées
            sont actualisés automatiquement lorsqu&apos;une liste change.
          </p>
        </div>
        <button
          type="button"
          className="nr-chip nr-chip-accent"
          disabled={pending !== null || subscriptions.length === 0}
          onClick={() =>
            void run("sync-all", async () => {
              const result = await adminApi("/api/admin/playlists/sync", csrf, {
                method: "POST",
                body: "{}",
              });
              const linkUpdates = result.results.reduce(
                (sum: number, item: { sourceLinksUpdated: number }) =>
                  sum + item.sourceLinksUpdated,
                0,
              );
              return `Synchronisation terminée · ${linkUpdates} lien(s) source actualisé(s).`;
            })
          }
        >
          {pending === "sync-all" ? "Synchronisation…" : "Synchroniser maintenant"}
        </button>
      </header>

      {message ? <div className="tv-notice tv-notice-ok">{message}</div> : null}
      {error ? <div className="tv-notice tv-notice-error">{error}</div> : null}
      {directoryWarning ? (
        <div className="tv-notice">
          Répertoire GitHub temporairement indisponible; les listes déjà connues restent
          utilisables. {directoryWarning}
        </div>
      ) : null}

      <div className="tv-metrics">
        <div>
          <span>LISTES SURVEILLÉES</span>
          <strong>{subscriptions.length}</strong>
        </div>
        <div>
          <span>STATIONS AU CATALOGUE</span>
          <strong>{channels.length}</strong>
        </div>
        <div>
          <span>AU DASHBOARD</span>
          <strong>{enabledChannels.length}</strong>
        </div>
        <div>
          <span>PROCHAINE VÉRIFICATION</span>
          <strong className="tv-metric-copy">
            {relativeDate(
              subscriptions
                .map((playlist) => playlist.next_sync_at)
                .filter((value): value is string => Boolean(value))
                .sort()[0] ?? null,
            )}
          </strong>
        </div>
      </div>

      <section className="tv-section">
        <div className="tv-section-heading">
          <div>
            <span className="tv-step">01</span>
            <div>
              <h3>Listes du dépôt</h3>
              <p>Sélectionnez un pays ou une déclinaison de fournisseur.</p>
            </div>
          </div>
          <button
            type="button"
            className="nr-chip"
            disabled={pending !== null}
            onClick={() =>
              void run("directory", async () => {
                await load(true);
                return "Répertoire officiel actualisé.";
              })
            }
          >
            Actualiser le répertoire
          </button>
        </div>
        <div className="tv-playlist-toolbar">
          <input
            aria-label="Rechercher une liste"
            placeholder="Rechercher Canada, France, Samsung…"
            value={playlistSearch}
            onChange={(event) => setPlaylistSearch(event.target.value)}
          />
          <span>
            {playlists.length} listes vérifiées dans{" "}
            <a href="https://github.com/iptv-org/iptv" target="_blank" rel="noreferrer">
              iptv-org/iptv
            </a>
          </span>
        </div>
        <div className="tv-playlist-grid">
          {playlistMatches.map((playlist) => {
            const isSubscribed = Boolean(playlist.subscribed);
            return (
              <article
                className={`tv-playlist-card ${isSubscribed ? "is-subscribed" : ""}`}
                key={playlist.playlist_key}
              >
                <button
                  type="button"
                  className="tv-playlist-toggle"
                  disabled={pending !== null}
                  onClick={() =>
                    void run(`playlist-${playlist.playlist_key}`, async () => {
                      const result = await adminApi("/api/admin/playlists", csrf, {
                        method: "POST",
                        body: JSON.stringify({
                          key: playlist.playlist_key,
                          subscribed: !isSubscribed,
                        }),
                      });
                      if (!isSubscribed && result.result) {
                        return `${playlist.name} ajoutée · ${result.result.fetched} station(s) indexée(s).`;
                      }
                      return `${playlist.name} retirée de la surveillance.`;
                    })
                  }
                >
                  <span className="tv-check" aria-hidden>
                    {pending === `playlist-${playlist.playlist_key}`
                      ? "…"
                      : isSubscribed
                        ? "✓"
                        : "+"}
                  </span>
                  <span>
                    <strong>{playlist.name}</strong>
                    <small>{playlist.playlist_key}</small>
                  </span>
                </button>
                {isSubscribed ? (
                  <div className="tv-playlist-monitor">
                    <label>
                      Surveillance
                      <select
                        value={playlist.sync_interval_min}
                        disabled={pending !== null}
                        onChange={(event) =>
                          void run(`interval-${playlist.playlist_key}`, async () => {
                            await adminApi("/api/admin/playlists", csrf, {
                              method: "POST",
                              body: JSON.stringify({
                                key: playlist.playlist_key,
                                syncIntervalMin: Number(event.target.value),
                              }),
                            });
                            return "Fréquence de surveillance enregistrée.";
                          })
                        }
                      >
                        <option value={0}>Manuelle</option>
                        <option value={15}>15 minutes</option>
                        <option value={60}>1 heure</option>
                        <option value={360}>6 heures</option>
                        <option value={1440}>24 heures</option>
                      </select>
                    </label>
                    <div className={`tv-sync-state is-${playlist.last_status}`}>
                      <span>{statusLabel(playlist.last_status)}</span>
                      <small>
                        {playlist.channel_count} stations · {relativeDate(playlist.last_sync_at)}
                      </small>
                      {playlist.last_error ? <em>{playlist.last_error}</em> : null}
                    </div>
                    <button
                      type="button"
                      disabled={pending !== null}
                      onClick={() =>
                        void run(`sync-${playlist.playlist_key}`, async () => {
                          const result = await adminApi(
                            "/api/admin/playlists/sync",
                            csrf,
                            {
                              method: "POST",
                              body: JSON.stringify({ key: playlist.playlist_key }),
                            },
                          );
                          const sync = result.results[0];
                          return sync?.changed
                            ? `${playlist.name} actualisée · ${sync.sourceLinksUpdated} lien(s) remplacé(s).`
                            : `${playlist.name} est déjà à jour.`;
                        })
                      }
                    >
                      {pending === `sync-${playlist.playlist_key}`
                        ? "Vérification…"
                        : "Vérifier"}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
        {playlistMatches.length === 120 ? (
          <p className="nr-time">Affinez la recherche pour afficher les autres listes.</p>
        ) : null}
      </section>

      <section className="tv-section">
        <div className="tv-section-heading">
          <div>
            <span className="tv-step">02</span>
            <div>
              <h3>Stations du dashboard</h3>
              <p>Activez uniquement les stations qui doivent être offertes sur le Board.</p>
            </div>
          </div>
        </div>
        <div className="tv-channel-toolbar">
          <input
            aria-label="Rechercher les stations"
            placeholder="Nom, groupe ou identifiant…"
            value={channelSearch}
            onChange={(event) => setChannelSearch(event.target.value)}
          />
          <select
            aria-label="Filtrer par liste"
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
          >
            <option value="all">Toutes les listes</option>
            {subscriptions.map((playlist) => (
              <option key={playlist.playlist_key} value={playlist.playlist_key}>
                {playlist.name}
              </option>
            ))}
          </select>
          <div className="tv-segmented" aria-label="Filtrer les stations">
            {(
              [
                ["all", "Toutes"],
                ["enabled", "Dashboard"],
                ["attention", "À vérifier"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={channelFilter === value ? "active" : ""}
                onClick={() => setChannelFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="tv-channel-list">
          {filteredChannels.slice(0, 200).map((channel) => (
            <article
              key={channel.id}
              className={`tv-channel-row ${channel.enabled ? "is-enabled" : ""}`}
            >
              <div className="tv-channel-logo">
                {channel.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={channel.logo_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
                ) : (
                  <span>TV</span>
                )}
              </div>
              <div className="tv-channel-info">
                <strong>{channel.name}</strong>
                <span>
                  {channel.playlist_name ||
                    (channel.catalog_source ? "iptv-org" : "Station manuelle")}
                  {channel.group_title ? ` · ${channel.group_title}` : ""}
                </span>
                <small>
                  {channel.tvg_id || "sans identifiant"} ·{" "}
                  {channel.status === "catalogued-unverified"
                    ? "flux non vérifié"
                    : channel.status === "catalog-pinned"
                      ? "épinglée hors liste"
                    : channel.status}
                </small>
              </div>
              <div className="tv-channel-actions">
                <button
                  type="button"
                  className={`tv-dashboard-toggle ${channel.enabled ? "active" : ""}`}
                  disabled={pendingChannels.has(channel.id)}
                  title={
                    ["catalog-removed", "catalog-unsubscribed"].includes(channel.status)
                      ? "Ajouter avec le dernier lien connu. Cette station sera épinglée même si sa liste ne la contient plus."
                      : channel.enabled
                        ? "Retirer cette station du dashboard"
                        : "Ajouter cette station au dashboard"
                  }
                  onClick={() =>
                    void runChannel(channel.id, async () => {
                      await adminApi(`/api/admin/channels/${channel.id}`, csrf, {
                        method: "PATCH",
                        body: JSON.stringify({ enabled: !channel.enabled }),
                      });
                      return channel.enabled
                        ? `${channel.name} retirée du dashboard.`
                        : ["catalog-removed", "catalog-unsubscribed"].includes(channel.status)
                          ? `${channel.name} ajoutée et épinglée avec son dernier lien connu.`
                          : `${channel.name} ajoutée au dashboard.`;
                    })
                  }
                >
                  <span aria-hidden>
                    {pendingChannels.has(channel.id) ? "…" : channel.enabled ? "✓" : "+"}
                  </span>
                  {pendingChannels.has(channel.id)
                    ? "Mise à jour…"
                    : channel.enabled
                      ? "Au dashboard"
                      : ["catalog-removed", "catalog-unsubscribed"].includes(channel.status)
                        ? "Ajouter hors liste"
                        : "Ajouter"}
                </button>
                <button
                  type="button"
                  className={`tv-default-toggle ${channel.is_default ? "active" : ""}`}
                  disabled={!channel.enabled || pendingChannels.has(channel.id)}
                  aria-label={`Définir ${channel.name} par défaut`}
                  title="Station par défaut"
                  onClick={() =>
                    void runChannel(channel.id, async () => {
                      await adminApi(`/api/admin/channels/${channel.id}`, csrf, {
                        method: "PATCH",
                        body: JSON.stringify({ is_default: true }),
                      });
                      return `${channel.name} est maintenant la station par défaut.`;
                    })
                  }
                >
                  ★
                </button>
              </div>
            </article>
          ))}
          {filteredChannels.length === 0 ? (
            <div className="tv-empty">
              <strong>Aucune station dans cette vue</strong>
              <span>Sélectionnez une liste ou modifiez les filtres.</span>
            </div>
          ) : null}
        </div>
        {filteredChannels.length > 200 ? (
          <p className="nr-time">
            200 résultats affichés sur {filteredChannels.length}; utilisez la recherche pour
            préciser la sélection.
          </p>
        ) : null}
      </section>

      <p className="tv-disclaimer">
        iptv-org répertorie des flux publics sans garantir disponibilité, droits ou
        compatibilité. NEWSROOM 55 ne simule aucun flux et désactive une station retirée de
        sa liste source.
      </p>
    </div>
  );
}
