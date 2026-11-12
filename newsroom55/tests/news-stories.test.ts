import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "newsroom-stories-"));

describe("story lookup", () => {
  let olderStoryId: number;

  beforeAll(async () => {
    const { getDb } = await import("@/lib/database");
    const database = getDb();
    const source = database
      .prepare(
        "INSERT INTO news_sources (name, url, enabled) VALUES (?, ?, 1)",
      )
      .run("Test source", "https://example.com/feed");
    const insert = database.prepare(
      `INSERT INTO news_items
        (source_id, guid, title, category, published_at, fetched_at, fingerprint)
       VALUES (?, ?, ?, 'CANADA', ?, ?, ?)`,
    );
    olderStoryId = Number(
      insert.run(
        source.lastInsertRowid,
        "older",
        "Older story",
        "2026-11-10T12:00:00.000Z",
        "2026-11-10T12:00:00.000Z",
        "older-story",
      ).lastInsertRowid,
    );
    database
      .prepare("UPDATE news_items SET priority = 'BREAKING' WHERE id = ?")
      .run(olderStoryId);
    insert.run(
      source.lastInsertRowid,
      "newer",
      "Newer story",
      "2026-11-11T12:00:00.000Z",
      "2026-11-11T12:00:00.000Z",
      "newer-story",
    );
  });

  it("retrieves a story by id even when it is outside the list window", async () => {
    const { listStories, storyById } = await import("@/lib/news/aggregator");
    expect(listStories(1)[0]?.id).not.toBe(olderStoryId);
    expect(storyById(olderStoryId)).toMatchObject({
      id: olderStoryId,
      title: "Older story",
      source: "Test source",
      priority: "NORMAL",
    });
  });
});
