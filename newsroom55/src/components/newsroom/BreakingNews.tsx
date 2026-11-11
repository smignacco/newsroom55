"use client";

import type { NewsStory } from "@/lib/news/aggregator";
import { formatNewsTime } from "@/lib/time";

export function BreakingNews({ story, timezone }: { story: NewsStory | null; timezone: string }) {
  if (!story) return <div className="nr-breaking" />;
  const level = story.priority === "BREAKING" ? "BREAKING" : "IMPORTANT";
  return (
    <div className="nr-breaking">
      <div className={`nr-breaking-bar ${level === "IMPORTANT" ? "important" : ""}`}>
        <div className="nr-breaking-kicker">{level}</div>
        <div className="nr-breaking-title">{story.title}</div>
        <div className="nr-meta">
          <span>{story.source}</span>
          <span>{formatNewsTime(story.published_at, timezone)}</span>
        </div>
      </div>
    </div>
  );
}
