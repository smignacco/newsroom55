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
        <div className="nr-kicker">À la une</div>
        <div className="nr-empty-featured">
          Aucun titre n’est encore en mémoire. L’agrégateur interroge les flux
          vérifiés des éditeurs. Ce panneau reste vide plutôt que d’inventer
          une nouvelle.
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
        <span>{story.priority === "BREAKING" ? "ALERTE" : story.priority}</span>
      </div>
    </article>
  );
}
