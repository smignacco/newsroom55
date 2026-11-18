const RETRY_STATUSES = new Set([429, 502, 503]);

export type FetchTextOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
  attempts?: number;
  backoffMs?: number;
};

function headerValue(value: string) {
  return value.replace(/[\r\n]/g, "").slice(0, 300);
}

export function requestHeaders(_url: string, extra?: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = {
    accept: "application/json, application/xml, text/xml, text/html;q=0.8, */*;q=0.5",
    "user-agent": "NEWSROOM55/1.0",
  };
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...base, ...extra })) {
    if (!key || value == null || value === "") continue;
    if (key.toLowerCase() === "host") continue;
    headers[key] = headerValue(value);
  }
  return headers;
}

function defaultBackoffMs() {
  return process.env.VITEST === "true" ? 0 : 500;
}

async function fetchWithNode(
  url: string,
  options: FetchTextOptions,
): Promise<{ ok: boolean; status: number; body: string }> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const maxBytes = options.maxBytes ?? 2_000_000;
  const attempts = options.attempts ?? 4;
  const backoffMs = options.backoffMs ?? defaultBackoffMs();
  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: requestHeaders(url, options.headers),
      });
      lastStatus = response.status;
      const declared = Number(response.headers.get("content-length") || 0);
      if (declared > maxBytes) return { ok: false, status: response.status, body: "" };
      lastBody = await response.text();
      if (Buffer.byteLength(lastBody, "utf8") > maxBytes) {
        return { ok: false, status: response.status, body: "" };
      }
      if (RETRY_STATUSES.has(response.status) && attempt < attempts - 1) {
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
      return { ok: response.ok, status: response.status, body: lastBody };
    } catch {
      lastStatus = 0;
      if (attempt < attempts - 1) await sleep(Math.max(backoffMs, 200) * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  return { ok: false, status: lastStatus, body: lastBody };
}

export async function fetchText(
  url: string,
  options?: FetchTextOptions,
): Promise<{ ok: boolean; status: number; body: string }> {
  return fetchWithNode(url, options ?? {});
}

export async function fetchJson<T>(url: string, options?: FetchTextOptions): Promise<T | null> {
  const response = await fetchText(url, options);
  if (!response.ok) return null;
  try {
    return JSON.parse(response.body) as T;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
