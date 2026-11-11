import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "newsroom-playlists-"));
process.env.DATA_DIR = dataDir;

describe("IPTV playlist monitoring", () => {
  beforeAll(async () => {
    const { getDb } = await import("@/lib/database");
    const database = getDb();
    database
      .prepare(
        `INSERT INTO iptv_playlists (
          playlist_key, name, catalog_url, subscribed, sync_interval_min, discovered_at
        ) VALUES ('test.m3u', 'Test', ?, 1, 60, ?)`,
      )
      .run(
        "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/test.m3u",
        new Date().toISOString(),
      );
    database
      .prepare(
        `INSERT INTO tv_channels (
          name, adapter, stream_ref, enabled, status, tvg_id, catalog_source, catalog_key
        ) VALUES ('Test Channel', 'hls', 'https://video.example/old.m3u8', 1,
          'catalogued-unverified', 'TestChannel.ca', 'iptv-org:test.m3u', 'legacy-key')`,
      )
      .run();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("updates a selected channel URL without losing its database identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          `#EXTM3U
#EXTINF:-1 tvg-id="TestChannel.ca" group-title="News",Test Channel
https://video.example/new.m3u8
`,
          { status: 200, headers: { etag: '"new-revision"', "content-length": "133" } },
        ),
      ),
    );
    const { getDb } = await import("@/lib/database");
    const before = getDb()
      .prepare("SELECT id FROM tv_channels WHERE tvg_id = 'TestChannel.ca'")
      .get() as { id: number };
    const { syncIptvPlaylist } = await import("@/lib/video/playlist-service");
    const result = await syncIptvPlaylist("test.m3u");
    const after = getDb()
      .prepare(
        "SELECT id, stream_ref, enabled FROM tv_channels WHERE tvg_id = 'TestChannel.ca'",
      )
      .get() as { id: number; stream_ref: string; enabled: number };

    expect(result.sourceLinksUpdated).toBe(1);
    expect(after).toEqual({
      id: before.id,
      stream_ref: "https://video.example/new.m3u8",
      enabled: 1,
    });
  });

  it("keeps an explicitly pinned station when it disappears upstream", async () => {
    const { getDb } = await import("@/lib/database");
    getDb()
      .prepare(
        `UPDATE tv_channels SET status = 'catalog-pinned', enabled = 1
         WHERE tvg_id = 'TestChannel.ca'`,
      )
      .run();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          `#EXTM3U
#EXTINF:-1 tvg-id="OtherChannel.ca" group-title="News",Other Channel
https://video.example/other.m3u8
`,
          {
          status: 200,
          headers: { etag: '"other-revision"' },
          },
        ),
      ),
    );
    const { syncIptvPlaylist } = await import("@/lib/video/playlist-service");
    const result = await syncIptvPlaylist("test.m3u");
    const channel = getDb()
      .prepare(
        "SELECT enabled, status FROM tv_channels WHERE tvg_id = 'TestChannel.ca'",
      )
      .get() as { enabled: number; status: string };
    expect(result.retired).toBe(0);
    expect(channel).toEqual({ enabled: 1, status: "catalog-pinned" });
  });
});
