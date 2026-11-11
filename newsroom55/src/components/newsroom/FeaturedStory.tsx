"use client";

import type { NewsStory } from "@/lib/news/aggregator";
import { formatNewsTime } from "@/lib/time";

function categoryTone(category: string): string {
  if (category === "Économie") return "economy";
  if (category === "Technologie" || category === "Intelligence artificielle") return "technology";
  if (category === "Cybersécurité") return "cyber";
  if (category === "Québec" || category === "Canada") return "local";
  return "world";
}

export function FeaturedStory({
  story,
  timezone,
  onOpen,
}: {
  story: NewsStory | null;
  timezone: string;
  onOpen: (story: NewsStory) => void;
}) {
  if (!story) {
    return (
      <article className="nr-featured">
        <div className="nr-kicker">Lead story</div>
        <div className="nr-empty-featured">
          No headlines in cache yet. The aggregator is polling verified publisher feeds. This panel stays empty rather
          than inventing a story.
        </div>
      </article>
    );
  }

  return (
    <article className={`nr-featured tone-${categoryTone(story.category)}`} onClick={() => onOpen(story)}>
      <div className="nr-kicker">{story.category}</div>
      <h3>{story.title}</h3>
      <div className="nr-meta">
        <span>{story.source}</span>
        <span>{formatNewsTime(story.published_at, timezone)}</span>
        <span>{story.priority}</span>
      </div>
    </article>
  );
}
