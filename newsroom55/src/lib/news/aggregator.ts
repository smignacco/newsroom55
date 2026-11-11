import Parser from "rss-parser";
import { getDb } from "@/lib/database";
import { parseRssDate, nowIso } from "@/lib/time";
import { classifyStory } from "@/lib/news/classify";
import { fingerprintTitle, isDuplicate } from "@/lib/news/dedupe";
import { applyBreakingRules, type BreakingRule } from "@/lib/news/breaking";
import { redactUrl } from "@/lib/security/urls";

const parser = new Parser({
  timeout: 12000,
  headers: {
    "User-Agent": "Newsroom55/1.0 (local broadcast board; +http://localhost:3000)",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
  },
});

type SourceRow = {
  id: number;
  name: string;
  url: string;
  enabled: number;
  default_category: string | null;
  last_status: string | null;
};

declare global {
  var __newsroomNewsFetching: boolean | undefined;
}

export async function aggregateNews(force = false): Promise<{ fetched: number; stored: number; errors: number }> {
  if (globalThis.__newsroomNewsFetching) return { fetched: 0, stored: 0, errors: 0 };
  globalThis.__newsroomNewsFetching = true;
  const db = getDb();
  let fetched = 0;
  let stored = 0;
  let errors = 0;
  try {
    const sources = db
      .prepare("SELECT id, name, url, enabled, default_category, last_status FROM news_sources WHERE enabled = 1")
      .all() as SourceRow[];
    const rules = db.prepare("SELECT pattern, field, level, enabled FROM breaking_rules").all() as BreakingRule[];
    const recent = db
      .prepare(
        `SELECT title FROM news_items WHERE datetime(fetched_at) > datetime('now', '-24 hours') ORDER BY fetched_at DESC LIMIT 400`,
      )
      .all() as { title: string }[];
    const existingTitles = recent.map((r) => r.title);

    for (const source of sources) {
      try {
        const feed = await parser.parseURL(source.url);
        fetched += 1;
        const items = feed.items ?? [];
        const insert = db.prepare(
          `INSERT INTO news_items
            (source_id, guid, title, url, summary, category, published_at, fetched_at, priority, fingerprint, hidden)
           VALUES (@source_id, @guid, @title, @url, @summary, @category, @published_at, @fetched_at, @priority, @fingerprint, 0)
           ON CONFLICT(source_id, guid) DO UPDATE SET
             title = excluded.title,
             url = excluded.url,
             summary = excluded.summary,
             category = excluded.category,
             published_at = excluded.published_at,
             priority = excluded.priority`,
        );
        for (const item of items.slice(0, 20)) {
          const title = (item.title || "").trim();
          if (!title) continue;
          const link = item.link || item.guid || "";
          const guid = (item.guid || item.id || link || title).slice(0, 500);
          const summary = (item.contentSnippet || item.summary || item.content || "").replace(/<[^>]+>/g, "").slice(0, 600);
          if (!force && isDuplicate(title, existingTitles)) continue;
          const category = classifyStory(title, summary, source.default_category);
          const priority = applyBreakingRules(title, summary, rules);
          const published = parseRssDate(item.isoDate || item.pubDate);
          insert.run({
            source_id: source.id,
            guid,
            title: title.slice(0, 400),
            url: link.slice(0, 1000),
            summary,
            category,
            published_at: published,
            fetched_at: nowIso(),
            priority,
            fingerprint: fingerprintTitle(title).slice(0, 300),
          });
          existingTitles.push(title);
          stored += 1;
        }
        db.prepare(
          "UPDATE news_sources SET last_fetch_at = ?, last_status = 'ok', last_error = NULL WHERE id = ?",
        ).run(nowIso(), source.id);
      } catch (err) {
        errors += 1;
        let message = err instanceof Error ? err.message : "fetch failed";
        if (/unexpected close tag|non-whitespace before first tag|invalid character/i.test(message)) {
          message = "Publisher returned HTML instead of RSS (temporary or blocked)";
        }
        console.warn(`[newsroom55] source failed ${source.name} ${redactUrl(source.url)}: ${message}`);
        db.prepare(
          "UPDATE news_sources SET last_fetch_at = ?, last_status = 'error', last_error = ? WHERE id = ?",
        ).run(nowIso(), message.slice(0, 300), source.id);
      }
    }
  } finally {
    globalThis.__newsroomNewsFetching = false;
  }
  return { fetched, stored, errors };
}

export type NewsStory = {
  id: number;
  title: string;
  url: string | null;
  summary: string | null;
  category: string;
  published_at: string | null;
  fetched_at: string;
  priority: "NORMAL" | "IMPORTANT" | "BREAKING";
  source: string;
};

export function listStories(limit = 18, category?: string | null): NewsStory[] {
  const db = getDb();
  const sql = category
    ? `SELECT n.id, n.title, n.url, n.summary, n.category, n.published_at, n.fetched_at, n.priority, s.name as source
       FROM news_items n JOIN news_sources s ON s.id = n.source_id
       WHERE n.hidden = 0 AND n.category = ?
       ORDER BY CASE n.priority WHEN 'BREAKING' THEN 0 WHEN 'IMPORTANT' THEN 1 ELSE 2 END,
                COALESCE(n.published_at, n.fetched_at) DESC
       LIMIT ?`
    : `SELECT n.id, n.title, n.url, n.summary, n.category, n.published_at, n.fetched_at, n.priority, s.name as source
       FROM news_items n JOIN news_sources s ON s.id = n.source_id
       WHERE n.hidden = 0
       ORDER BY CASE n.priority WHEN 'BREAKING' THEN 0 WHEN 'IMPORTANT' THEN 1 ELSE 2 END,
                COALESCE(n.published_at, n.fetched_at) DESC
       LIMIT ?`;
  const rows = category ? db.prepare(sql).all(category, limit) : db.prepare(sql).all(limit);
  return rows as NewsStory[];
}

export function featuredStory(stories: NewsStory[]): NewsStory | null {
  return stories[0] ?? null;
}

export function sourceHealth(): { ok: number; error: number; total: number; lastFetch: string | null } {
  const db = getDb();
  const rows = db.prepare("SELECT last_status, last_fetch_at FROM news_sources WHERE enabled = 1").all() as {
    last_status: string | null;
    last_fetch_at: string | null;
  }[];
  const lastFetch = rows.map((r) => r.last_fetch_at).filter(Boolean).sort().at(-1) ?? null;
  return {
    ok: rows.filter((r) => r.last_status === "ok").length,
    error: rows.filter((r) => r.last_status === "error").length,
    total: rows.length,
    lastFetch,
  };
}
