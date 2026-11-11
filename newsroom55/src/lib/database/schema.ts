export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS news_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  default_category TEXT,
  keywords TEXT,
  fetch_interval_sec INTEGER NOT NULL DEFAULT 180,
  last_fetch_at TEXT,
  last_status TEXT,
  last_error TEXT,
  etag TEXT,
  last_modified TEXT
);

CREATE TABLE IF NOT EXISTS news_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  guid TEXT,
  title TEXT NOT NULL,
  url TEXT,
  summary TEXT,
  category TEXT NOT NULL,
  published_at TEXT,
  fetched_at TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  fingerprint TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (source_id) REFERENCES news_sources(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_source_guid ON news_items(source_id, guid);
CREATE INDEX IF NOT EXISTS idx_news_published ON news_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_fingerprint ON news_items(fingerprint);

CREATE TABLE IF NOT EXISTS market_symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  display_name TEXT NOT NULL,
  kind TEXT NOT NULL,
  currency TEXT NOT NULL,
  provider_symbol TEXT NOT NULL,
  exchange TEXT,
  quote_provider TEXT NOT NULL DEFAULT 'cboe',
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS market_quotes (
  symbol_id INTEGER PRIMARY KEY,
  price REAL,
  change_abs REAL,
  change_pct REAL,
  currency TEXT,
  as_of TEXT,
  status TEXT NOT NULL,
  provider TEXT,
  FOREIGN KEY (symbol_id) REFERENCES market_symbols(id)
);

CREATE TABLE IF NOT EXISTS tv_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  adapter TEXT NOT NULL DEFAULT 'none',
  stream_ref TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  autoplay INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'waiting',
  tvg_id TEXT,
  logo_url TEXT,
  group_title TEXT,
  catalog_source TEXT,
  catalog_key TEXT,
  catalog_url TEXT,
  stream_referrer TEXT,
  last_catalog_sync_at TEXT
);

CREATE TABLE IF NOT EXISTS iptv_playlists (
  playlist_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  catalog_url TEXT NOT NULL,
  repository_sha TEXT,
  subscribed INTEGER NOT NULL DEFAULT 0,
  sync_interval_min INTEGER NOT NULL DEFAULT 360,
  last_etag TEXT,
  last_content_hash TEXT,
  last_sync_at TEXT,
  last_change_at TEXT,
  last_status TEXT NOT NULL DEFAULT 'discovered',
  last_error TEXT,
  channel_count INTEGER NOT NULL DEFAULT 0,
  discovered_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_iptv_playlists_subscribed
  ON iptv_playlists(subscribed, last_sync_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS board_control (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  channel_id INTEGER,
  channel_ids TEXT NOT NULL DEFAULT '[]',
  audio_channel_id INTEGER,
  layout_mode TEXT NOT NULL DEFAULT 'grid',
  focus_channel_id INTEGER,
  muted INTEGER NOT NULL DEFAULT 1,
  power_state TEXT NOT NULL DEFAULT 'active',
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (channel_id) REFERENCES tv_channels(id) ON DELETE SET NULL,
  FOREIGN KEY (audio_channel_id) REFERENCES tv_channels(id) ON DELETE SET NULL,
  FOREIGN KEY (focus_channel_id) REFERENCES tv_channels(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS breaking_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL,
  field TEXT NOT NULL DEFAULT 'title',
  level TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);
`;
