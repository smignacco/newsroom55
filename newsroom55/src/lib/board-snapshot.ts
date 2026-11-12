import { listStories, featuredStory, sourceHealth } from "@/lib/news/aggregator";
import { marketStatusPayload } from "@/lib/markets/service";
import { publicChannels } from "@/lib/video/player";
import { getSetting } from "@/lib/database";
import { pulseEnabled } from "@/lib/health/service";
import { isFreshAlert } from "@/lib/news/breaking";

export async function getBoardSnapshot() {
  const timezone = getSetting("timezone", "America/Montreal");
  const stories = listStories(22);
  const featured = featuredStory(stories);
  const headlines = stories.filter((s) => s.id !== featured?.id).slice(0, 10);
  const breaking =
    stories.find((story) => story.priority === "BREAKING" && isFreshAlert(story)) ??
    null;
  const important = !breaking
    ? stories.find(
        (story) => story.priority === "IMPORTANT" && isFreshAlert(story),
      ) ?? null
    : null;
  const newsHealth = sourceHealth();
  const markets = marketStatusPayload();
  const channels = publicChannels();
  return {
    stories,
    featured,
    headlines,
    alert: breaking ?? important,
    newsHealth,
    markets,
    channels,
    video: {
      state: "waiting" as const,
      message: "Authorized IPTV source not connected",
    },
    personalPulse: {
      enabled: pulseEnabled(),
    },
    appearance: {
      layout: getSetting("layout", "broadcast-classic"),
      textScale: Number(getSetting("text_scale", "100")),
      tickerSpeed: Number(getSetting("ticker_speed", "42")),
      animations: getSetting("animations", "full"),
      sound: getSetting("sound", "muted"),
      timezone,
      newsRefreshIntervalSec: Number(getSetting("news_interval_sec", "180")),
    },
    serverTime: new Date().toISOString(),
  };
}

export type BoardSnapshot = Awaited<ReturnType<typeof getBoardSnapshot>>;
