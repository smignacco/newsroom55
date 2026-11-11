export type Priority = "NORMAL" | "IMPORTANT" | "BREAKING";

export type BreakingRule = {
  pattern: string;
  field: "title" | "summary";
  level: "IMPORTANT" | "BREAKING";
  enabled: number | boolean;
};

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
