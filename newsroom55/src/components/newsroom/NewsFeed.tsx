"use client";

import { useEffect, useState } from "react";
import type { NewsStory } from "@/lib/news/aggregator";
import { CATEGORIES, CATEGORY_SHORT } from "@/lib/news/classify";
import { formatNewsTime } from "@/lib/time";
import { FeaturedStory } from "@/components/newsroom/FeaturedStory";

function categoryTone(category: string): string {
  if (category === "Économie") return "economy";
  if (category === "Technologie" || category === "Intelligence artificielle")
    return "technology";
  if (category === "Cybersécurité") return "cyber";
  if (category === "Québec" || category === "Canada") return "local";
  return "world";
}

export function NewsFeed({
  featured,
  headlines,
  category,
  timezone,
  lastRefresh,
  refreshIntervalSec,
  onCategory,
  onOpen,
}: {
  featured: NewsStory | null;
  headlines: NewsStory[];
  category: string | null;
  timezone: string;
  lastRefresh: string | null;
  refreshIntervalSec: number;
  onCategory: (c: string | null) => void;
  onOpen: (story: NewsStory) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const lastRefreshMs = lastRefresh ? Date.parse(lastRefresh) : NaN;
  const remaining = Number.isFinite(lastRefreshMs)
    ? Math.max(
        0,
        Math.ceil((lastRefreshMs + refreshIntervalSec * 1000 - now) / 1000),
      )
    : null;
  const refreshLabel =
    remaining == null
      ? "Synchronisation initiale"
      : remaining === 0
        ? "Actualisation imminente"
        : `Actualisation ${Math.floor(remaining / 60)
            .toString()
            .padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;

  return (
    <section className="nr-news">
      <div className="nr-section-head">
        <h2>Fil de nouvelles</h2>
        <span className="nr-kicker nr-refresh-indicator">{refreshLabel}</span>
      </div>
      <div className="nr-filters">
        <button
          type="button"
          className={`nr-filter ${category === null ? "active" : ""}`}
          onClick={() => onCategory(null)}
        >
          Tout
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={`nr-filter ${category === c ? "active" : ""}`}
            onClick={() => onCategory(c)}
          >
            {CATEGORY_SHORT[c] ?? c}
          </button>
        ))}
      </div>
      <FeaturedStory story={featured} timezone={timezone} onOpen={onOpen} />
      <div
        className="nr-headlines"
        tabIndex={0}
        aria-label="Toutes les manchettes — faire défiler"
      >
        {headlines.length === 0 ? (
          <div className="nr-empty-news">
            En attente de nouvelles des éditeurs dans cette catégorie.
          </div>
        ) : (
          headlines.map((story) => (
            <button
              key={story.id}
              type="button"
              className={`nr-headline tone-${categoryTone(story.category)}`}
              onClick={() => onOpen(story)}
            >
              <span className="nr-cat">
                <i aria-hidden />
                {CATEGORY_SHORT[story.category] ?? story.category}
              </span>
              <span className="nr-hl-title">{story.title}</span>
              <span className="nr-time">
                {formatNewsTime(story.published_at, timezone)}
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
