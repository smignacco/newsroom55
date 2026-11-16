import { aggregateNews } from "@/lib/news/aggregator";
import { refreshQuotes, getMarketProvider } from "@/lib/markets/service";
import { marketRefreshIntervalMs, marketsProviderName } from "@/lib/config";
import { getSetting } from "@/lib/database";
import { syncDueIptvPlaylists } from "@/lib/video/playlist-service";
import {
  HEALTH_HISTORY_INTERVAL_MS,
  healthSyncIntervalMs,
  pulseEnabled,
  syncHealthData,
} from "@/lib/health/service";
import { homeAssistantConfigured } from "@/lib/home-assistant/client";

let newsTimer: NodeJS.Timeout | null = null;
let marketsTimer: NodeJS.Timeout | null = null;
let iptvTimer: NodeJS.Timeout | null = null;
let healthTimer: NodeJS.Timeout | null = null;

declare global {
  var __newsroomSchedulerStarted: boolean | undefined;
}

export function startScheduler() {
  if (globalThis.__newsroomSchedulerStarted) return;
  globalThis.__newsroomSchedulerStarted = true;

  const runNews = async () => {
    try {
      const result = await aggregateNews();
      console.info("[newsroom55] news cycle", result);
    } catch (err) {
      console.warn("[newsroom55] news cycle failed", err instanceof Error ? err.message : err);
    }
  };

  const runMarkets = async () => {
    try {
      const provider = getMarketProvider();
      if (!provider.configured) return;
      await refreshQuotes();
    } catch (err) {
      console.warn("[newsroom55] markets cycle failed", err instanceof Error ? err.message : err);
    }
  };

  const runIptv = async () => {
    try {
      await syncDueIptvPlaylists();
    } catch (err) {
      console.warn("[newsroom55] IPTV monitor failed", err instanceof Error ? err.message : err);
    }
  };

  let healthTicks = 0;

  const runHealth = async (includeHistory = true) => {
    if (!pulseEnabled() || !homeAssistantConfigured()) return;
    try {
      await syncHealthData(undefined, { history: includeHistory });
    } catch (err) {
      console.warn(
        "[newsroom55] health cycle failed",
        err instanceof Error ? err.message : err,
      );
    }
  };

  const runNewsAndSchedule = async () => {
    await runNews();
    const seconds = Math.min(3600, Math.max(60, Number(getSetting("news_interval_sec", "180")) || 180));
    newsTimer = setTimeout(runNewsAndSchedule, seconds * 1000);
    newsTimer.unref?.();
  };

  const runMarketsAndSchedule = async () => {
    await runMarkets();
    marketsTimer = setTimeout(
      runMarketsAndSchedule,
      marketRefreshIntervalMs(marketsProviderName()),
    );
    marketsTimer.unref?.();
  };

  const runHealthAndSchedule = async () => {
    healthTicks += 1;
    const interval = healthSyncIntervalMs();
    const includeHistory =
      healthTicks === 1 ||
      (healthTicks * interval) % HEALTH_HISTORY_INTERVAL_MS < interval;
    await runHealth(includeHistory);
    healthTimer = setTimeout(runHealthAndSchedule, interval);
    healthTimer.unref?.();
  };

  void runNewsAndSchedule();
  void runMarketsAndSchedule();
  void runHealthAndSchedule();
  void runIptv();
  iptvTimer = setInterval(runIptv, 60_000);
  iptvTimer.unref?.();
}
