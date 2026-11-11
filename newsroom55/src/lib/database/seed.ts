import { getDb, getSetting, setSetting } from "@/lib/database";
import { VERIFIED_SOURCES } from "@/lib/news/verified-sources";
import { DEFAULT_BREAKING_RULES } from "@/lib/news/breaking";
import { TIMEZONE } from "@/lib/config";

const DEFAULT_SYMBOLS = [
  { symbol: "CSCO", display_name: "Cisco", kind: "equity", currency: "USD", provider_symbol: "CSCO", quote_provider: "cboe", sort_order: 1 },
  { symbol: "NVDA", display_name: "NVIDIA", kind: "equity", currency: "USD", provider_symbol: "NVDA", quote_provider: "cboe", sort_order: 2 },
  { symbol: "MSFT", display_name: "Microsoft", kind: "equity", currency: "USD", provider_symbol: "MSFT", quote_provider: "cboe", sort_order: 3 },
  { symbol: "AAPL", display_name: "Apple", kind: "equity", currency: "USD", provider_symbol: "AAPL", quote_provider: "cboe", sort_order: 4 },
  { symbol: "SPX", display_name: "S&P 500", kind: "index", currency: "USD", provider_symbol: "^GSPC", quote_provider: "twelvedata", sort_order: 5 },
  { symbol: "IXIC", display_name: "NASDAQ", kind: "index", currency: "USD", provider_symbol: "^IXIC", quote_provider: "twelvedata", sort_order: 6 },
  { symbol: "TSX", display_name: "TSX", kind: "index", currency: "CAD", provider_symbol: "^GSPTSE", quote_provider: "twelvedata", sort_order: 7 },
];

const PUBLIC_MARKET_SYMBOLS = [
  {
    symbol: "USD/CAD",
    display_name: "US dollar in Canadian dollars",
    kind: "fx-public",
    currency: "CAD",
    provider_symbol: "FXUSDCAD",
    quote_provider: "bankofcanada",
    sort_order: 1,
  },
  {
    symbol: "EUR/CAD",
    display_name: "Euro in Canadian dollars",
    kind: "fx-public",
    currency: "CAD",
    provider_symbol: "FXEURCAD",
    quote_provider: "bankofcanada",
    sort_order: 2,
  },
  {
    symbol: "GBP/CAD",
    display_name: "UK pound in Canadian dollars",
    kind: "fx-public",
    currency: "CAD",
    provider_symbol: "FXGBPCAD",
    quote_provider: "bankofcanada",
    sort_order: 3,
  },
  {
    symbol: "JPY/CAD",
    display_name: "Japanese yen in Canadian dollars",
    kind: "fx-public",
    currency: "CAD",
    provider_symbol: "FXJPYCAD",
    quote_provider: "bankofcanada",
    sort_order: 4,
  },
];

export function seedIfNeeded() {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO board_control (id, channel_id, muted, power_state, revision, updated_at)
     VALUES (1, NULL, 1, 'active', 0, ?)`,
  ).run(new Date().toISOString());
  if (!getSetting("seeded", "")) {
    const insertSource = db.prepare(
      `INSERT OR IGNORE INTO news_sources (name, url, enabled, default_category, fetch_interval_sec)
       VALUES (@name, @url, 1, @default_category, 180)`,
    );
    for (const source of VERIFIED_SOURCES) insertSource.run(source);

    const insertSymbol = db.prepare(
      `INSERT INTO market_symbols (symbol, display_name, kind, currency, provider_symbol, quote_provider, sort_order, enabled)
       VALUES (@symbol, @display_name, @kind, @currency, @provider_symbol, @quote_provider, @sort_order, 1)`,
    );
    for (const s of DEFAULT_SYMBOLS) insertSymbol.run(s);

    const insertRule = db.prepare(
      `INSERT INTO breaking_rules (pattern, field, level, enabled) VALUES (?, ?, ?, 1)`,
    );
    for (const rule of DEFAULT_BREAKING_RULES) {
      insertRule.run(rule.pattern, rule.field, rule.level);
    }

    setSetting("layout", "broadcast-classic");
    setSetting("text_scale", "100");
    setSetting("ticker_speed", "42");
    setSetting("animations", "full");
    setSetting("sound", "muted");
    setSetting("alerts", "on");
    setSetting("news_interval_sec", "180");
    setSetting("timezone", TIMEZONE);
    setSetting("seeded", "1");
  }

  if (!getSetting("timezone", "")) setSetting("timezone", TIMEZONE);

  const insertPublicSymbol = db.prepare(
    `INSERT INTO market_symbols (symbol, display_name, kind, currency, provider_symbol, quote_provider, sort_order, enabled)
     SELECT @symbol, @display_name, @kind, @currency, @provider_symbol, @quote_provider, @sort_order, 1
     WHERE NOT EXISTS (
       SELECT 1 FROM market_symbols WHERE kind = @kind AND provider_symbol = @provider_symbol
     )`,
  );
  for (const symbol of PUBLIC_MARKET_SYMBOLS) insertPublicSymbol.run(symbol);
}
