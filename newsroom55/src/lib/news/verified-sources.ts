/**
 * Default RSS sources. Every URL was checked on 2026-11-10 from this environment
 * against the publisher's official feed or official RSS directory.
 *
 * Wired only if HTTP fetch returned RSS/Atom, or the URL is published on the
 * outlet's official RSS index (Radio-Canada /info/rss).
 *
 * Not wired:
 * - CBC: requests timed out or reset here; URLs were not confirmed reachable.
 * - Reuters: reutersagency.com/feed/ returned 404; reuters.com/tools/rss returned 401.
 * - Radio-Canada International and Économie paths are listed on the official
 *   RSS page but returned an Error body when fetched; they are omitted from
 *   the default seed so a first boot is not filled with failing sources.
 */
export type SeedCategory =
  | "Québec"
  | "Canada"
  | "International"
  | "Économie"
  | "Technologie"
  | "Intelligence artificielle"
  | "Cybersécurité";

export type SeedSource = {
  name: string;
  url: string;
  default_category: SeedCategory;
  verified: "http-200-feed" | "official-rss-directory";
};

export const VERIFIED_SOURCES: SeedSource[] = [
  {
    name: "Radio-Canada — À la une",
    url: "https://ici.radio-canada.ca/info/rss/info",
    default_category: "Canada",
    verified: "http-200-feed",
  },
  {
    name: "Radio-Canada — En continu",
    url: "https://ici.radio-canada.ca/info/rss/info/en-continu",
    default_category: "Canada",
    verified: "http-200-feed",
  },
  {
    name: "Radio-Canada — Québec",
    url: "https://ici.radio-canada.ca/info/rss/regions/quebec/en-continu",
    default_category: "Québec",
    verified: "http-200-feed",
  },
  {
    name: "Radio-Canada — Montréal",
    url: "https://ici.radio-canada.ca/info/rss/regions/montreal-environs/en-continu",
    default_category: "Québec",
    verified: "http-200-feed",
  },
  {
    name: "Radio-Canada — Techno",
    url: "https://ici.radio-canada.ca/info/rss/info/techno/en-continu",
    default_category: "Technologie",
    verified: "http-200-feed",
  },
  {
    name: "BBC News",
    url: "https://feeds.bbci.co.uk/news/rss.xml",
    default_category: "International",
    verified: "http-200-feed",
  },
  {
    name: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    default_category: "International",
    verified: "http-200-feed",
  },
  {
    name: "BBC Technology",
    url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
    default_category: "Technologie",
    verified: "http-200-feed",
  },
  {
    name: "BBC Business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    default_category: "Économie",
    verified: "http-200-feed",
  },
  {
    name: "La Presse — Actualités",
    url: "https://www.lapresse.ca/actualites/rss",
    default_category: "Québec",
    verified: "http-200-feed",
  },
  {
    name: "La Presse — National",
    url: "https://www.lapresse.ca/actualites/national/rss",
    default_category: "Canada",
    verified: "http-200-feed",
  },
  {
    name: "La Presse — International",
    url: "https://www.lapresse.ca/international/rss",
    default_category: "International",
    verified: "http-200-feed",
  },
  {
    name: "La Presse — Affaires",
    url: "https://www.lapresse.ca/affaires/rss",
    default_category: "Économie",
    verified: "http-200-feed",
  },
  {
    name: "La Presse — Économie",
    url: "https://www.lapresse.ca/affaires/economie/rss",
    default_category: "Économie",
    verified: "http-200-feed",
  },
  {
    name: "CNBC — Top News",
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",
    default_category: "Économie",
    verified: "http-200-feed",
  },
  {
    name: "CNBC — World",
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362",
    default_category: "International",
    verified: "http-200-feed",
  },
  {
    name: "CNBC — Tech",
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910",
    default_category: "Technologie",
    verified: "http-200-feed",
  },
  {
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    default_category: "Technologie",
    verified: "http-200-feed",
  },
  {
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    default_category: "Technologie",
    verified: "http-200-feed",
  },
];
