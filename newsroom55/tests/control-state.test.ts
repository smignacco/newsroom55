import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "newsroom-control-"));
process.env.DATA_DIR = dataDir;

describe("board control state", () => {
  beforeAll(async () => {
    const { getDb } = await import("@/lib/database");
    getDb()
      .prepare(
        `INSERT INTO board_control (id, channel_id, muted, power_state, revision, updated_at)
         VALUES (1, NULL, 1, 'active', 0, ?)`,
      )
      .run(new Date().toISOString());
    const insert = getDb().prepare(
      `INSERT INTO tv_channels (name, adapter, stream_ref, enabled, status)
       VALUES (?, 'hls', ?, 1, 'ready')`,
    );
    for (const name of ["Source 1", "Source 2", "Source 3", "Source 4"]) {
      insert.run(name, `https://example.com/${name.at(-1)}.m3u8`);
    }
  });

  it("persists remote changes and increments the revision", async () => {
    const { getBoardControlState, updateBoardControlState } = await import("@/lib/control/state");
    expect(getBoardControlState()).toMatchObject({ muted: true, powerState: "active", revision: 0 });

    const updated = updateBoardControlState({ muted: false, powerState: "halfwake" });
    expect(updated).toMatchObject({ muted: false, powerState: "halfwake", revision: 1 });
  });

  it("persists up to four video sources and one audio source", async () => {
    const { getBoardControlState, updateBoardControlState } = await import("@/lib/control/state");
    const ids = getBoardControlState().channelIds;
    const { getDb } = await import("@/lib/database");
    const allIds = (
      getDb().prepare("SELECT id FROM tv_channels ORDER BY id LIMIT 4").all() as {
        id: number;
      }[]
    ).map((channel) => channel.id);
    expect(ids).toHaveLength(1);
    const updated = updateBoardControlState({
      channelIds: allIds,
      audioChannelId: allIds[2],
      layoutMode: "focus",
      focusChannelId: allIds[1],
    });
    expect(updated.channelIds).toEqual(allIds);
    expect(updated.audioChannelId).toBe(allIds[2]);
    expect(updated.layoutMode).toBe("focus");
    expect(updated.focusChannelId).toBe(allIds[1]);
    expect(updated.channelId).toBe(allIds[0]);
  });
});
