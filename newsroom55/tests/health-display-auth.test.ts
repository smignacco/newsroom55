import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";

const dataDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "newsroom-display-auth-"),
);
process.env.DATA_DIR = dataDir;
process.env.SESSION_SECRET = "test-only-display-auth-secret";

afterAll(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("health display pairing", () => {
  it("approves a pending Board code and consumes it once", async () => {
    const {
      approvePulseDisplayPairing,
      consumePulseDisplayPairing,
      createPulseDisplayPairing,
    } = await import("@/lib/health/display-auth");
    const pairing = createPulseDisplayPairing();
    expect(pairing.code).toMatch(/^\d{6}$/);
    expect(consumePulseDisplayPairing(pairing.id)).toBe("pending");
    expect(approvePulseDisplayPairing("000 000")).toBe(false);
    expect(approvePulseDisplayPairing(pairing.code)).toBe(true);
    expect(consumePulseDisplayPairing(pairing.id)).toBe("approved");
    expect(consumePulseDisplayPairing(pairing.id)).toBe("missing");
  });

  it("revokes previously issued display tokens", async () => {
    const {
      PULSE_DISPLAY_COOKIE,
      createPulseDisplayToken,
      revokePulseDisplays,
      verifyPulseDisplayRequest,
    } = await import("@/lib/health/display-auth");
    const token = await createPulseDisplayToken();
    const request = new NextRequest("http://192.0.2.10:3000/api/pulse", {
      headers: { cookie: `${PULSE_DISPLAY_COOKIE}=${token}` },
    });
    expect(await verifyPulseDisplayRequest(request)).toBe(true);
    revokePulseDisplays();
    expect(await verifyPulseDisplayRequest(request)).toBe(false);
  });
});
