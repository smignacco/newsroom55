const BLOCKED_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "metadata.google.internal.",
]);

export type UrlCheck = { ok: true; url: URL } | { ok: false; error: string };

export function validateHttpUrl(raw: string): UrlCheck {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, error: "Invalid URL" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Only http and https URLs are allowed" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "Credentials in URLs are not allowed" };
  }
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) {
    return { ok: false, error: "This host is not allowed" };
  }
  return { ok: true, url: parsed };
}

export function redactUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.username = "";
    u.password = "";
    return u.toString();
  } catch {
    return "[unparseable-url]";
  }
}
