import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NewsFeed } from "../src/components/newsroom/NewsFeed";
import { BOARD_HEADLINE_LIMIT } from "../src/lib/news/aggregator";
import type { NewsStory } from "../src/lib/news/aggregator";

function story(id: number, priority: NewsStory["priority"] = "NORMAL"): NewsStory {
  return {
    id,
    title: `Manchette ${id} — titre assez long pour deux lignes`,
    url: `https://example.com/${id}`,
    summary: null,
    category: "Canada",
    published_at: "2026-11-18T14:00:00.000Z",
    fetched_at: "2026-11-18T14:00:00.000Z",
    priority,
    source: "Test",
  };
}

describe("News feed without featured tile", () => {
  it("keeps sixteen headlines and the compact badge, not an à la une tile", () => {
    const headlines = Array.from({ length: BOARD_HEADLINE_LIMIT }, (_, index) =>
      story(index + 1, index === 0 ? "BREAKING" : "NORMAL"),
    );
    const html = renderToStaticMarkup(
      <NewsFeed
        headlines={headlines}
        category={null}
        timezone="America/Toronto"
        lastRefresh={null}
        refreshIntervalSec={180}
        breaking={headlines[0] ?? null}
        breakingMode="compact"
        onCategory={() => undefined}
        onOpen={() => undefined}
      />,
    );
    expect(BOARD_HEADLINE_LIMIT).toBe(16);
    expect(html.match(/class="nr-headline /g)?.length).toBe(16);
    expect(html).toContain("nr-breaking-badge");
    expect(html).toContain("ALERTE");
    expect(html).not.toContain("nr-featured");
    expect(html).not.toContain("À la une");
    expect(html).not.toContain("nr-breaking-bar");
  });
});
