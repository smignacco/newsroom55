import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyHomeAssistantOptions,
  ensureSessionSecret,
  readHomeAssistantOptions,
  requireAdminPassword,
} from "../home-assistant-options.mjs";
import fixture from "./fixtures/home-assistant-options.json";

const originalEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

describe("Home Assistant options", () => {
  it("maps the configuration form onto environment variables and skips blanks", () => {
    const env: NodeJS.ProcessEnv = {};
    applyHomeAssistantOptions(fixture, env);
    expect(env.ADMIN_USERNAME).toBe("ha-test-admin");
    expect(env.ADMIN_PASSWORD).toBe("test-password-123");
    expect(env.TZ).toBe("America/Toronto");
    expect(env.MARKETS_PROVIDER).toBe("cboe");
    expect(env.TWELVE_DATA_REFRESH_MINUTES).toBe("45");
    expect(env.TWELVE_DATA_MAX_SYMBOLS).toBe("4");
    expect(env.ROOMOS_PROTOCOL).toBe("https");
    expect(env.ROOMOS_INSECURE_TLS).toBe("0");
    expect(env.FINNHUB_API_KEY).toBeUndefined();
    expect(env.ROOMOS_PASSWORD).toBeUndefined();
    expect(env.NEWSROOM_URL).toBeUndefined();
  });

  it("does not require a .env file", () => {
    const env: NodeJS.ProcessEnv = {};
    applyHomeAssistantOptions(
      {
        admin_username: "admin",
        admin_password: "board-pass-99",
        timezone: "America/Toronto",
        roomos_insecure_tls: true,
        newsroom_url: "http://192.168.10.10:3000",
      },
      env,
    );
    expect(env.ADMIN_PASSWORD).toBe("board-pass-99");
    expect(env.ROOMOS_INSECURE_TLS).toBe("1");
    expect(env.NEWSROOM_URL).toBe("http://192.168.10.10:3000");
    requireAdminPassword(env);
  });

  it("refuses a missing or short administrator password", () => {
    expect(() => requireAdminPassword({})).toThrow(/Configuration tab/);
    expect(() => requireAdminPassword({ ADMIN_PASSWORD: "short" })).toThrow(/8 characters/);
  });

  it("reads Supervisor options.json", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ha-options-"));
    const file = path.join(dir, "options.json");
    writeFileSync(file, JSON.stringify(fixture));
    expect(readHomeAssistantOptions(file).admin_username).toBe("ha-test-admin");
  });

  it("creates a session secret on disk instead of a .env value", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ha-secret-"));
    const env: NodeJS.ProcessEnv = {};
    const first = ensureSessionSecret(dir, env);
    const second = ensureSessionSecret(dir, {});
    expect(first.length).toBeGreaterThanOrEqual(32);
    expect(second).toBe(first);
    expect(readFileSync(path.join(dir, "session-secret"), "utf8").trim()).toBe(first);
  });
});
