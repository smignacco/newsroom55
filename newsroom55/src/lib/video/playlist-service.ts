import { getDb } from "@/lib/database";
import {
  discoverIptvPlaylists,
  fetchIptvPlaylist,
  IPTV_ORG_CA_SOURCE,
  isValidPlaylistKey,
  type CatalogChannel,
} from "@/lib/video/iptv-org";

const DIRECTORY_CACHE_MS = 60 * 60 * 1000;
const ALLOWED_INTERVALS = new Set([0, 15, 60, 360, 1440]);
let lastDirectoryRefresh = 0;
const activeSyncs = new Map<string, Promise<PlaylistSyncResult>>();

type PlaylistRow = {
  playlist_key: string;
  name: string;
  catalog_url: string;
  repository_sha: string | null;
  subscribed: number;
  sync_interval_min: number;
  last_etag: string | null;
  last_content_hash: string | null;
  last_sync_at: string | null;
  last_change_at: string | null;
  last_status: string;
  last_error: string | null;
  channel_count: number;
  discovered_at: string;
};

type ExistingChannel = {
  id: number;
  catalog_key: string | null;
  tvg_id: string | null;
  name: string;
  group_title: string | null;
  stream_ref: string | null;
  status: string;
};

export type PlaylistSyncResult = {
  key: string;
  fetched: number;
  imported: number;
  updated: number;
  sourceLinksUpdated: number;
  retired: number;
  changed: boolean;
  syncedAt: string;
};

function sourceId(key: string): string {
  return `iptv-org:${key}`;
}

function normalized(value: string | null): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function identity(channel: Pick<ExistingChannel, "tvg_id" | "name" | "group_title">): string {
  return channel.tvg_id
    ? `tvg:${normalized(channel.tvg_id)}`
    : `name:${normalized(channel.name)}|group:${normalized(channel.group_title)}`;
}

export async function refreshIptvPlaylistDirectory(force = false): Promise<void> {
  const database = getDb();
  const count = (
    database.prepare("SELECT COUNT(*) AS count FROM iptv_playlists").get() as { count: number }
  ).count;
  if (!force && count > 0 && Date.now() - lastDirectoryRefresh < DIRECTORY_CACHE_MS) return;

  const playlists = await discoverIptvPlaylists();
  const discoveredAt = new Date().toISOString();
  const upsert = database.prepare(
    `INSERT INTO iptv_playlists (
      playlist_key, name, catalog_url, repository_sha, discovered_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(playlist_key) DO UPDATE SET
      name = excluded.name,
      catalog_url = excluded.catalog_url,
      repository_sha = excluded.repository_sha,
      discovered_at = excluded.discovered_at`,
  );
  database.transaction(() => {
    for (const playlist of playlists) {
      upsert.run(
        playlist.key,
        playlist.name,
        playlist.catalogUrl,
        playlist.repositorySha,
        discoveredAt,
      );
    }
    const legacyCanada = database
      .prepare("SELECT 1 FROM tv_channels WHERE catalog_source = ? LIMIT 1")
      .get(IPTV_ORG_CA_SOURCE);
    if (legacyCanada) {
      database
        .prepare("UPDATE OR IGNORE tv_channels SET catalog_source = ? WHERE catalog_source = ?")
        .run(sourceId("ca.m3u"), IPTV_ORG_CA_SOURCE);
      database
        .prepare(
          `UPDATE iptv_playlists SET subscribed = 1,
           channel_count = (
             SELECT COUNT(*) FROM tv_channels WHERE catalog_source = 'iptv-org:ca.m3u'
           )
           WHERE playlist_key = 'ca.m3u'`,
        )
        .run();
    }
  })();
  lastDirectoryRefresh = Date.now();
}

export function listIptvPlaylists(): Array<PlaylistRow & { next_sync_at: string | null }> {
  const rows = getDb()
    .prepare(
      `SELECT * FROM iptv_playlists
       ORDER BY subscribed DESC,
         CASE playlist_key WHEN 'ca.m3u' THEN 0 WHEN 'us.m3u' THEN 1 ELSE 2 END,
         name COLLATE NOCASE`,
    )
    .all() as PlaylistRow[];
  return rows.map((row) => ({
    ...row,
    next_sync_at:
      row.subscribed && row.sync_interval_min > 0
        ? row.last_sync_at
          ? new Date(
              new Date(row.last_sync_at).getTime() + row.sync_interval_min * 60_000,
            ).toISOString()
          : new Date().toISOString()
        : null,
  }));
}

export function setIptvPlaylistSubscription(input: {
  key: string;
  subscribed?: boolean;
  syncIntervalMin?: number;
}): void {
  if (!isValidPlaylistKey(input.key)) throw new Error("Invalid playlist key");
  if (
    input.syncIntervalMin !== undefined &&
    !ALLOWED_INTERVALS.has(input.syncIntervalMin)
  ) {
    throw new Error("Invalid monitoring interval");
  }
  const database = getDb();
  const row = database
    .prepare("SELECT playlist_key FROM iptv_playlists WHERE playlist_key = ?")
    .get(input.key);
  if (!row) throw new Error("Playlist is not present in the verified repository directory");

  database
    .prepare(
      `UPDATE iptv_playlists SET
        subscribed = COALESCE(?, subscribed),
        sync_interval_min = COALESCE(?, sync_interval_min)
       WHERE playlist_key = ?`,
    )
    .run(
      input.subscribed === undefined ? null : input.subscribed ? 1 : 0,
      input.syncIntervalMin ?? null,
      input.key,
    );

  if (input.subscribed === false) {
    database
      .prepare(
        `UPDATE tv_channels SET enabled = 0, is_default = 0, status = 'catalog-unsubscribed'
         WHERE catalog_source = ? AND status != 'catalog-pinned'`,
      )
      .run(sourceId(input.key));
  }
}

function selectFallback(
  channel: CatalogChannel,
  existing: ExistingChannel[],
  used: Set<number>,
): ExistingChannel | undefined {
  const targetIdentity = identity({
    tvg_id: channel.tvgId,
    name: channel.name,
    group_title: channel.groupTitle,
  });
  return existing.find(
    (candidate) => !used.has(candidate.id) && identity(candidate) === targetIdentity,
  );
}

async function performIptvPlaylistSync(key: string): Promise<PlaylistSyncResult> {
  if (!isValidPlaylistKey(key)) throw new Error("Invalid playlist key");
  const database = getDb();
  const playlist = database
    .prepare("SELECT * FROM iptv_playlists WHERE playlist_key = ? AND subscribed = 1")
    .get(key) as PlaylistRow | undefined;
  if (!playlist) throw new Error("Playlist is not monitored");

  const syncedAt = new Date().toISOString();
  try {
    const fetched = await fetchIptvPlaylist(playlist.catalog_url, playlist.last_etag);
    if (fetched.notModified) {
      database
        .prepare(
          `UPDATE iptv_playlists SET last_sync_at = ?, last_status = 'unchanged',
           last_error = NULL, last_etag = COALESCE(?, last_etag)
           WHERE playlist_key = ?`,
        )
        .run(syncedAt, fetched.etag, key);
      return {
        key,
        fetched: playlist.channel_count,
        imported: 0,
        updated: 0,
        sourceLinksUpdated: 0,
        retired: 0,
        changed: false,
        syncedAt,
      };
    }

    if (fetched.contentHash === playlist.last_content_hash) {
      database
        .prepare(
          `UPDATE iptv_playlists SET last_sync_at = ?, last_status = 'unchanged',
           last_error = NULL, last_etag = ? WHERE playlist_key = ?`,
        )
        .run(syncedAt, fetched.etag, key);
      return {
        key,
        fetched: fetched.channels.length,
        imported: 0,
        updated: 0,
        sourceLinksUpdated: 0,
        retired: 0,
        changed: false,
        syncedAt,
      };
    }

    const catalogSource = sourceId(key);
    if (key === "ca.m3u") {
      database
        .prepare("UPDATE OR IGNORE tv_channels SET catalog_source = ? WHERE catalog_source = ?")
        .run(catalogSource, IPTV_ORG_CA_SOURCE);
    }
    const existing = database
      .prepare(
        `SELECT id, catalog_key, tvg_id, name, group_title, stream_ref, status
         FROM tv_channels WHERE catalog_source = ?`,
      )
      .all(catalogSource) as ExistingChannel[];
    const byKey = new Map(existing.map((channel) => [channel.catalog_key, channel]));
    const used = new Set<number>();

    const insert = database.prepare(
      `INSERT INTO tv_channels (
        name, adapter, stream_ref, enabled, is_default, autoplay, status,
        tvg_id, logo_url, group_title, catalog_source, catalog_key, catalog_url,
        stream_referrer, last_catalog_sync_at
      ) VALUES (?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const update = database.prepare(
      `UPDATE tv_channels SET
        name = ?, adapter = ?, stream_ref = ?, status = ?, tvg_id = ?,
        logo_url = ?, group_title = ?, catalog_key = ?, catalog_url = ?,
        stream_referrer = ?, last_catalog_sync_at = ?
       WHERE id = ?`,
    );
    const retire = database.prepare(
      `UPDATE tv_channels SET enabled = 0, is_default = 0, status = 'catalog-removed',
       last_catalog_sync_at = ? WHERE id = ?`,
    );

    const result = database.transaction(() => {
      let imported = 0;
      let updated = 0;
      let sourceLinksUpdated = 0;
      for (const channel of fetched.channels) {
        const exact = byKey.get(channel.catalogKey);
        const match =
          exact && !used.has(exact.id)
            ? exact
            : selectFallback(channel, existing, used);
        if (!match) {
          insert.run(
            channel.name,
            channel.adapter,
            channel.streamUrl,
            channel.status,
            channel.tvgId,
            channel.logoUrl,
            channel.groupTitle,
            catalogSource,
            channel.catalogKey,
            playlist.catalog_url,
            channel.streamReferrer,
            syncedAt,
          );
          imported += 1;
          continue;
        }
        used.add(match.id);
        if (match.stream_ref !== channel.streamUrl) sourceLinksUpdated += 1;
        update.run(
          channel.name,
          channel.adapter,
          channel.streamUrl,
          channel.status,
          channel.tvgId,
          channel.logoUrl,
          channel.groupTitle,
          channel.catalogKey,
          playlist.catalog_url,
          channel.streamReferrer,
          syncedAt,
          match.id,
        );
        updated += 1;
      }
      let retired = 0;
      for (const channel of existing) {
        if (used.has(channel.id)) continue;
        if (channel.status === "catalog-pinned") continue;
        retire.run(syncedAt, channel.id);
        retired += 1;
      }
      database
        .prepare(
          `UPDATE iptv_playlists SET
            last_etag = ?, last_content_hash = ?, last_sync_at = ?,
            last_change_at = ?, last_status = 'updated', last_error = NULL,
            channel_count = ?
           WHERE playlist_key = ?`,
        )
        .run(
          fetched.etag,
          fetched.contentHash,
          syncedAt,
          syncedAt,
          fetched.channels.length,
          key,
        );
      return { imported, updated, sourceLinksUpdated, retired };
    })();

    return {
      key,
      fetched: fetched.channels.length,
      ...result,
      changed: true,
      syncedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Playlist sync failed";
    database
      .prepare(
        `UPDATE iptv_playlists SET last_sync_at = ?, last_status = 'error', last_error = ?
         WHERE playlist_key = ?`,
      )
      .run(syncedAt, message.slice(0, 500), key);
    throw error;
  }
}

export function syncIptvPlaylist(key: string): Promise<PlaylistSyncResult> {
  const active = activeSyncs.get(key);
  if (active) return active;
  const job = performIptvPlaylistSync(key).finally(() => activeSyncs.delete(key));
  activeSyncs.set(key, job);
  return job;
}

export async function syncDueIptvPlaylists(): Promise<void> {
  const now = Date.now();
  const due = (getDb()
    .prepare(
      `SELECT playlist_key, sync_interval_min, last_sync_at
       FROM iptv_playlists WHERE subscribed = 1 AND sync_interval_min > 0`,
    )
    .all() as Array<{
    playlist_key: string;
    sync_interval_min: number;
    last_sync_at: string | null;
  }>).filter(
    (playlist) =>
      !playlist.last_sync_at ||
      now - new Date(playlist.last_sync_at).getTime() >=
        playlist.sync_interval_min * 60_000,
  );
  for (const playlist of due) {
    try {
      await syncIptvPlaylist(playlist.playlist_key);
    } catch (error) {
      console.warn(
        `[newsroom55] IPTV playlist ${playlist.playlist_key} failed`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
