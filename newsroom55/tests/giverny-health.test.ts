import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "newsroom-giverny-health-"));
process.env.DATA_DIR = dataDir;

describe("Giverny retired EDGAR health", () => {
  it("drops stored edgar 403 notes and last-error text", async () => {
    const { getDb } = await import("../src/lib/database");
    const {
      clearRetiredProviderNotes,
      lastGivernyError,
      markGivernyError,
      readProviderNotes,
    } = await import("../src/lib/giverny/store");

    getDb()
      .prepare("INSERT INTO settings (key, value) VALUES (?, ?)")
      .run(
        "giverny_health_edgar",
        JSON.stringify({
          ok: false,
          detail: "EDGAR a refusé le trafic automatisé. L’indice reste indisponible tant que le dépôt n’est pas lisible.",
        }),
      );
    markGivernyError(
      "EDGAR a refusé le trafic automatisé. L’indice reste indisponible tant que le dépôt n’est pas lisible.",
    );

    expect(readProviderNotes().some((row) => row.provider === "edgar")).toBe(false);
    expect(lastGivernyError()).toBeNull();
    clearRetiredProviderNotes();
    const leftover = getDb()
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("giverny_health_edgar") as { value: string } | undefined;
    expect(leftover).toBeUndefined();
  });
});
