import { SEC_USER_AGENT } from "@/lib/giverny/types";

export async function fetchText(
  url: string,
  options?: {
    timeoutMs?: number;
    maxBytes?: number;
    headers?: Record<string, string>;
    attempts?: number;
  },
): Promise<{ ok: boolean; status: number; body: string }> {
  const timeoutMs = options?.timeoutMs ?? 12_000;
  const maxBytes = options?.maxBytes ?? 2_000_000;
  const attempts = options?.attempts ?? 4;
  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          accept: "application/json, application/xml, text/xml, text/html;q=0.8, */*;q=0.5",
          "user-agent": SEC_USER_AGENT,
          ...(options?.headers ?? {}),
        },
      });
      lastStatus = response.status;
      const declared = Number(response.headers.get("content-length") || 0);
      if (declared > maxBytes) return { ok: false, status: response.status, body: "" };
      lastBody = await response.text();
      if (Buffer.byteLength(lastBody, "utf8") > maxBytes) {
        return { ok: false, status: response.status, body: "" };
      }
      if (response.status === 429 || response.status === 503) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      return { ok: response.ok, status: response.status, body: lastBody };
    } catch {
      lastStatus = 0;
      await sleep(400 * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  return { ok: false, status: lastStatus, body: lastBody };
}

export async function fetchJson<T>(url: string, options?: Parameters<typeof fetchText>[1]): Promise<T | null> {
  const response = await fetchText(url, options);
  if (!response.ok) return null;
  try {
    return JSON.parse(response.body) as T;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
