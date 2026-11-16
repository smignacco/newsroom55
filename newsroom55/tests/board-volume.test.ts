import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, describe, expect, it, vi } from "vitest";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "newsroom-board-volume-"));
process.env.DATA_DIR = dataDir;
process.env.SESSION_SECRET = "test-only-board-volume-secret";

afterAll(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("board volume hardware writes", () => {
  it("skips RoomOS unless the caller is authorized, then honors player fallback", async () => {
    const { applyBoardOutputVolume } = await import("@/lib/control/board-volume");
    const setVolume = vi.fn(async () => undefined);

    await expect(
      applyBoardOutputVolume({
        authorized: false,
        configured: true,
        level: 0,
        setVolume,
      }),
    ).resolves.toEqual({ level: 0, applied: "player" });
    expect(setVolume).not.toHaveBeenCalled();

    await expect(
      applyBoardOutputVolume({
        authorized: true,
        configured: false,
        level: 25,
        setVolume,
      }),
    ).resolves.toEqual({ level: 25, applied: "player" });
    expect(setVolume).not.toHaveBeenCalled();

    await expect(
      applyBoardOutputVolume({
        authorized: true,
        configured: true,
        level: 40,
        setVolume,
      }),
    ).resolves.toEqual({ level: 40, applied: "roomos" });
    expect(setVolume).toHaveBeenCalledWith(40);

    setVolume.mockRejectedValueOnce(new Error("unreachable"));
    await expect(
      applyBoardOutputVolume({
        authorized: true,
        configured: true,
        level: 0,
        setVolume,
      }),
    ).resolves.toEqual({ level: 0, applied: "player" });
  });

  it("authorizes a paired Board display or an admin session, not origin alone", async () => {
    const {
      authorizedForRoomOsVolume,
    } = await import("@/lib/control/board-volume");
    const {
      PULSE_DISPLAY_COOKIE,
      createPulseDisplayToken,
      revokePulseDisplays,
    } = await import("@/lib/health/display-auth");
    const { createSession } = await import("@/lib/security/auth");

    const anonymous = new NextRequest("http://192.0.2.10:3000/api/board/volume", {
      method: "POST",
    });
    expect(await authorizedForRoomOsVolume(anonymous)).toBe(false);

    const token = await createPulseDisplayToken();
    const paired = new NextRequest("http://192.0.2.10:3000/api/board/volume", {
      method: "POST",
      headers: { cookie: `${PULSE_DISPLAY_COOKIE}=${token}` },
    });
    expect(await authorizedForRoomOsVolume(paired)).toBe(true);
    revokePulseDisplays();
    expect(await authorizedForRoomOsVolume(paired)).toBe(false);

    const session = await createSession("admin");
    const withoutCsrf = new NextRequest(
      "http://192.0.2.10:3000/api/board/volume",
      {
        method: "POST",
        headers: { cookie: `nr_session=${session.token}` },
      },
    );
    expect(await authorizedForRoomOsVolume(withoutCsrf)).toBe(false);

    const admin = new NextRequest("http://192.0.2.10:3000/api/board/volume", {
      method: "POST",
      headers: {
        cookie: `nr_session=${session.token}`,
        "x-csrf-token": session.csrf,
      },
    });
    expect(await authorizedForRoomOsVolume(admin)).toBe(true);
  });
});
