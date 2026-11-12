export type Priority = "NORMAL" | "IMPORTANT" | "BREAKING";

export type BreakingRule = {
  pattern: string;
  field: "title" | "summary";
  level: "IMPORTANT" | "BREAKING";
  enabled: number | boolean;
};

export const ALERT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function isFreshAlert(
  story: {
    priority: Priority;
    published_at: string | null;
    fetched_at: string;
  },
  now = Date.now(),
) {
  if (story.priority !== "BREAKING" && story.priority !== "IMPORTANT") {
    return false;
  }
  const timestamp = Date.parse(story.published_at || story.fetched_at);
  return Number.isFinite(timestamp) && now - timestamp < ALERT_MAX_AGE_MS;
}

export function applyBreakingRules(
  title: string,
  summary: string | null | undefined,
  rules: BreakingRule[],
): Priority {
  let level: Priority = "NORMAL";
  const hay = {
    title,
    summary: summary ?? "",
  };
  for (const rule of rules) {
    if (!rule.enabled) continue;
    let re: RegExp;
    try {
      re = new RegExp(rule.pattern, "i");
    } catch {
      continue;
    }
    const field = rule.field === "summary" ? hay.summary : hay.title;
    if (!re.test(field)) continue;
    if (rule.level === "BREAKING") return "BREAKING";
    if (rule.level === "IMPORTANT") level = "IMPORTANT";
  }
  return level;
}

export const DEFAULT_BREAKING_RULES: Omit<BreakingRule, "enabled">[] = [
  { pattern: "\\bbreaking\\b", field: "title", level: "BREAKING" },
  { pattern: "\\burgent(e)?\\b", field: "title", level: "BREAKING" },
  { pattern: "\\balerte\\b", field: "title", level: "IMPORTANT" },
  { pattern: "\\bflash info\\b", field: "title", level: "IMPORTANT" },
];
