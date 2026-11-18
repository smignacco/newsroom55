import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "newsroom-giverny-fx-"));
process.env.DATA_DIR = dataDir;

afterEach(() => vi.unstubAllGlobals());

describe("Giverny FX persistence", () => {
  it("stores delayed Bank of Canada USD/CAD observations and refuses a zero rate", async () => {
    const { refreshUsdCadHistory } = await import("../src/lib/giverny/fx");
    const { fxSeries } = await import("../src/lib/giverny/store");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            observations: [
              { d: "2026-11-10", FXUSDCAD: { v: "1.3925" } },
              { d: "2026-11-09", FXUSDCAD: { v: "0" } },
              { d: "2026-11-08", FXUSDCAD: { v: "1.3900" } },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const result = await refreshUsdCadHistory("2026-11-01", "2026-11-10");
    expect(result.count).toBe(2);
    expect(fxSeries().get("2026-11-10")).toBeCloseTo(1.3925);
    expect(fxSeries().has("2026-11-09")).toBe(false);
  });
});
