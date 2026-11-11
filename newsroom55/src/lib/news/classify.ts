import type { SeedCategory } from "@/lib/news/verified-sources";

export const CATEGORIES: SeedCategory[] = [
  "Québec",
  "Canada",
  "International",
  "Économie",
  "Technologie",
  "Intelligence artificielle",
  "Cybersécurité",
];

export const CATEGORY_SHORT: Record<string, string> = {
  Québec: "Qc",
  Canada: "Can",
  International: "Monde",
  Économie: "Éco",
  Technologie: "Tech",
  "Intelligence artificielle": "I.A.",
  Cybersécurité: "Cyber",
};

const RULES: { category: SeedCategory; patterns: RegExp[] }[] = [
  {
    category: "Intelligence artificielle",
    patterns: [
      /\b(artificial intelligence|intelligence artificielle|\bai\b|genai|chatgpt|openai|anthropic|llm|machine learning|apprentissage automatique|midjourney|gemini ai)\b/i,
    ],
  },
  {
    category: "Cybersécurité",
    patterns: [
      /\b(cyber|ransomware|malware|phishing|data breach|fuite de donn|hacker|zero[- ]day|ddos|ransomware)\b/i,
    ],
  },
  {
    category: "Québec",
    patterns: [
      /\b(qu[eé]bec|montr[eé]al|laval|gatineau|sherbrooke|saguenay|trois[- ]rivi[eè]res|assembl[eé]e nationale|legault|caq|qu[eé]b[eé]cois)\b/i,
    ],
  },
  {
    category: "Économie",
    patterns: [
      /\b(inflation|banque du canada|federal reserve|interest rate|taux directeur|gdp|pib|ch[oô]mage|stock market|bourse|nasdaq|s&p|tsx|earnings|r[eé]cession)\b/i,
    ],
  },
  {
    category: "Technologie",
    patterns: [
      /\b(apple|google|microsoft|nvidia|semiconductor|startup|software|smartphone|chip|puce|cybern[eé]tique)\b/i,
    ],
  },
  {
    category: "Canada",
    patterns: [
      /\b(ottawa|toronto|vancouver|calgary|canada|trudeau|carney|parlement|federal|premi[eè]re ministre|prime minister)\b/i,
    ],
  },
];

export function classifyStory(
  title: string,
  summary: string | null | undefined,
  defaultCategory: string | null | undefined,
): SeedCategory {
  const hay = `${title} ${summary ?? ""}`;
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(hay))) return rule.category;
  }
  if (defaultCategory && (CATEGORIES as string[]).includes(defaultCategory)) {
    return defaultCategory as SeedCategory;
  }
  return "International";
}
