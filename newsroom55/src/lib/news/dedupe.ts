export function fingerprintTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(title: string): Set<string> {
  return new Set(
    fingerprintTitle(title)
      .split(" ")
      .filter((t) => t.length > 2),
  );
}

export function jaccard(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function isDuplicate(title: string, existingTitles: string[], threshold = 0.82): boolean {
  const fp = fingerprintTitle(title);
  for (const other of existingTitles) {
    if (fingerprintTitle(other) === fp) return true;
    if (jaccard(title, other) >= threshold) return true;
  }
  return false;
}
