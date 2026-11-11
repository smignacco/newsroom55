import fs from "fs";
import Database from "better-sqlite3";
import { dataDir, dbPath } from "@/lib/config";
import { SCHEMA_SQL } from "@/lib/database/schema";

let db: Database.Database | null = null;

const TV_CHANNEL_COLUMNS: Record<string, string> = {
  tvg_id: "TEXT",
  logo_url: "TEXT",
  group_title: "TEXT",
  catalog_source: "TEXT",
  catalog_key: "TEXT",
  catalog_url: "TEXT",
  stream_referrer: "TEXT",
  last_catalog_sync_at: "TEXT",
};

const MARKET_SYMBOL_COLUMNS: Record<string, string> = {
  exchange: "TEXT",
  quote_provider: "TEXT NOT NULL DEFAULT 'cboe'",
};

const BOARD_CONTROL_COLUMNS: Record<string, string> = {
  channel_ids: "TEXT NOT NULL DEFAULT '[]'",
  audio_channel_id: "INTEGER",
  layout_mode: "TEXT NOT NULL DEFAULT 'grid'",
  focus_channel_id: "INTEGER",
};

function migrate(database: Database.Database) {
  const columns = new Set(
    (database.pragma("table_info(tv_channels)") as { name: string }[]).map((column) => column.name),
  );
  for (const [name, type] of Object.entries(TV_CHANNEL_COLUMNS)) {
    if (!columns.has(name)) database.exec(`ALTER TABLE tv_channels ADD COLUMN ${name} ${type}`);
  }
  const marketColumns = new Set(
    (database.pragma("table_info(market_symbols)") as { name: string }[]).map(
      (column) => column.name,
    ),
  );
  for (const [name, type] of Object.entries(MARKET_SYMBOL_COLUMNS)) {
    if (!marketColumns.has(name)) {
      database.exec(`ALTER TABLE market_symbols ADD COLUMN ${name} ${type}`);
    }
  }
  if (!marketColumns.has("quote_provider")) {
    database.exec(
      `UPDATE market_symbols
       SET quote_provider = CASE
         WHEN kind = 'fx-public' THEN 'bankofcanada'
         WHEN kind = 'index' OR currency != 'USD' THEN 'twelvedata'
         ELSE 'cboe'
       END`,
    );
  }
  const boardColumns = new Set(
    (database.pragma("table_info(board_control)") as { name: string }[]).map(
      (column) => column.name,
    ),
  );
  for (const [name, type] of Object.entries(BOARD_CONTROL_COLUMNS)) {
    if (!boardColumns.has(name)) {
      database.exec(`ALTER TABLE board_control ADD COLUMN ${name} ${type}`);
    }
  }
  if (!boardColumns.has("channel_ids")) {
    database.exec(
      `UPDATE board_control
       SET channel_ids = CASE
         WHEN channel_id IS NULL THEN '[]'
         ELSE '[' || channel_id || ']'
       END`,
    );
  }
  if (!boardColumns.has("audio_channel_id")) {
    database.exec("UPDATE board_control SET audio_channel_id = channel_id");
  }
  if (!boardColumns.has("focus_channel_id")) {
    database.exec("UPDATE board_control SET focus_channel_id = channel_id");
  }
  database.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_tv_catalog_key
     ON tv_channels(catalog_source, catalog_key)
     WHERE catalog_source IS NOT NULL AND catalog_key IS NOT NULL`,
  );
}

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(dataDir(), { recursive: true });
  db = new Database(dbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  migrate(db);
  return db;
}

export function getSetting(key: string, fallback: string): string {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}
