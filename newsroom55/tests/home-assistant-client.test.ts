import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeAssistantClient } from "@/lib/home-assistant/client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Home Assistant REST client", () => {
  it("keeps the token in the authorization header and validates responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            entity_id: "sensor.health_steps",
            state: "1200",
            last_changed: "2026-11-11T12:00:00Z",
            last_updated: "2026-11-11T12:00:00Z",
            attributes: { unit_of_measurement: "steps" },
          },
          { entity_id: "invalid", state: "secret", attributes: {} },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new HomeAssistantClient({
      baseUrl: "https://ha.example.test/",
      token: "private-test-token",
    });

    await expect(client.getStates()).resolves.toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ha.example.test/api/states");
    expect(url).not.toContain("private-test-token");
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer private-test-token",
    );
  });

  it("rejects credentials in the configured URL and malformed entity ids", async () => {
    expect(
      () =>
        new HomeAssistantClient({
          baseUrl: "https://user:password@ha.example.test",
          token: "test-token",
        }),
    ).toThrow(/Credentials/);
    const client = new HomeAssistantClient({
      baseUrl: "https://ha.example.test",
      token: "test-token",
    });
    await expect(
      client.getHistory(["../../config"], new Date().toISOString()),
    ).rejects.toThrow(/entité/);
  });

  it("aborts a stalled Home Assistant request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        });
      }),
    );
    const client = new HomeAssistantClient({
      baseUrl: "https://ha.example.test",
      token: "test-token",
      timeoutMs: 5,
    });
    await expect(client.testConnection()).rejects.toThrow(/Délai/);
  });
});
