"use client";

import { useEffect, useRef, useState } from "react";
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
  const headlinesRef = useRef<HTMLDivElement>(null);
  const headlineKey = headlines.map((story) => story.id).join(",");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const element = headlinesRef.current;
    if (
      !element ||
      headlines.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let pointerInside = false;
    let focusInside = false;
    let pausedUntil = 0;
    const pauseTemporarily = () => {
      pausedUntil = Date.now() + 12_000;
    };
    const onPointerEnter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") pointerInside = true;
    };
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") pointerInside = false;
    };
    const onFocusIn = () => {
      focusInside = true;
    };
    const onFocusOut = () => {
      focusInside = false;
    };

    element.addEventListener("pointerenter", onPointerEnter);
    element.addEventListener("pointerleave", onPointerLeave);
    element.addEventListener("focusin", onFocusIn);
    element.addEventListener("focusout", onFocusOut);
    element.addEventListener("wheel", pauseTemporarily, { passive: true });
    element.addEventListener("touchstart", pauseTemporarily, { passive: true });

    const timer = window.setInterval(() => {
      const maximum = element.scrollHeight - element.clientHeight;
      if (
        maximum <= 1 ||
        pointerInside ||
        focusInside ||
        Date.now() < pausedUntil
      ) {
        return;
      }
      const reachedEnd = element.scrollTop >= maximum - 4;
      element.scrollTo({
        top: reachedEnd
          ? 0
          : Math.min(
              maximum,
              element.scrollTop + Math.max(72, element.clientHeight * 0.68),
            ),
        behavior: "smooth",
      });
    }, 4_500);

    return () => {
      window.clearInterval(timer);
      element.removeEventListener("pointerenter", onPointerEnter);
      element.removeEventListener("pointerleave", onPointerLeave);
      element.removeEventListener("focusin", onFocusIn);
      element.removeEventListener("focusout", onFocusOut);
      element.removeEventListener("wheel", pauseTemporarily);
      element.removeEventListener("touchstart", pauseTemporarily);
    };
  }, [headlineKey, headlines.length]);

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
        ref={headlinesRef}
        className="nr-headlines"
        tabIndex={0}
        aria-label="Toutes les manchettes — défilement automatique"
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
