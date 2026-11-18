import { execFile } from "node:child_process";
import { edgarContactEmail, secUserAgent } from "@/lib/giverny/identity";

const EDGAR_HOST = /\.sec\.gov\b/i;
const RETRY_STATUSES = new Set([429, 502, 503]);
const STATUS_MARK = "\n__NR_HTTP__:";

export type FetchTextOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
  attempts?: number;
  backoffMs?: number;
  nativeFetch?: NativeEdgarFetch | null;
};

export type NativeEdgarFetch = (
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  maxBytes: number,
) => Promise<{ ok: boolean; status: number; body: string } | null>;

export function isEdgarUrl(url: string) {
  try {
    return EDGAR_HOST.test(new URL(url).hostname);
  } catch {
    return EDGAR_HOST.test(url);
  }
}

function headerValue(value: string) {
  return value.replace(/[\r\n]/g, "").slice(0, 300);
}

export function requestHeaders(url: string, extra?: Record<string, string>): Record<string, string> {
  const contact = edgarContactEmail();
  const edgar = isEdgarUrl(url);
  const base: Record<string, string> = edgar
    ? {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": secUserAgent(contact),
        from: contact,
        referer: "https://www.sec.gov/",
      }
    : {
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

function shouldRetry(status: number, url: string) {
  if (RETRY_STATUSES.has(status)) return true;
  return status === 403 && isEdgarUrl(url) && process.env.VITEST === "true";
}

function defaultBackoffMs() {
  return process.env.VITEST === "true" ? 0 : 500;
}

function execFileUtf8(
  file: string,
  args: string[],
  timeoutMs: number,
  maxBytes: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        timeout: timeoutMs,
        maxBuffer: maxBytes,
        encoding: "utf8",
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          const failed = error as Error & { stdout?: string; stderr?: string };
          failed.stdout = stdout;
          failed.stderr = stderr;
          reject(failed);
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

function blockedBody(body: string) {
  return /undeclared automated tool|automated access|forbidden/i.test(body);
}

async function wgetEdgarFetch(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  maxBytes: number,
): Promise<{ ok: boolean; status: number; body: string } | null> {
  const seconds = Math.max(2, Math.ceil(timeoutMs / 1000));
  const args = [
    "-q",
    "-O",
    "-",
    `--timeout=${seconds}`,
    "--tries=1",
    "--max-redirect=5",
    `--user-agent=${headers["user-agent"] || "NEWSROOM55"}`,
  ];
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "user-agent") continue;
    args.push("--header", `${key}: ${value}`);
  }
  args.push(url);
  try {
    const { stdout } = await execFileUtf8("wget", args, timeoutMs + 2000, maxBytes);
    if (blockedBody(stdout)) return { ok: false, status: 403, body: stdout.slice(0, 500) };
    return { ok: true, status: 200, body: stdout };
  } catch (error) {
    const stdout = String((error as { stdout?: string }).stdout || "");
    if (blockedBody(stdout)) return { ok: false, status: 403, body: stdout.slice(0, 500) };
    return null;
  }
}

export async function nativeEdgarFetch(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  maxBytes: number,
): Promise<{ ok: boolean; status: number; body: string } | null> {
  if (!url.startsWith("https://") || !isEdgarUrl(url)) return null;
  const seconds = Math.max(2, Math.ceil(timeoutMs / 1000));
  const args = [
    "-sS",
    "-L",
    "--http1.1",
    "--max-redirs",
    "5",
    "--max-time",
    String(seconds),
    "-A",
    headers["user-agent"] || "NEWSROOM55",
  ];
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "user-agent") continue;
    args.push("-H", `${key}: ${value}`);
  }
  args.push("-w", `${STATUS_MARK}%{http_code}`, url);
  try {
    const { stdout } = await execFileUtf8("curl", args, timeoutMs + 2000, maxBytes + 32);
    const mark = stdout.lastIndexOf(STATUS_MARK);
    const status = mark >= 0 ? Number(stdout.slice(mark + STATUS_MARK.length).trim()) : 0;
    const body = mark >= 0 ? stdout.slice(0, mark) : stdout;
    if (!Number.isInteger(status) || status <= 0) return null;
    if (Buffer.byteLength(body, "utf8") > maxBytes) return { ok: false, status, body: "" };
    return { ok: status >= 200 && status < 300, status, body };
  } catch {
    return wgetEdgarFetch(url, headers, timeoutMs, maxBytes);
  }
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
      if (shouldRetry(response.status, url) && attempt < attempts - 1) {
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
  const timeoutMs = options?.timeoutMs ?? 12_000;
  const maxBytes = options?.maxBytes ?? 2_000_000;
  const nodeResult = await fetchWithNode(url, options ?? {});
  if (nodeResult.ok || !isEdgarUrl(url)) return nodeResult;
  if (nodeResult.status !== 403 && nodeResult.status !== 0) return nodeResult;
  const native =
    options && "nativeFetch" in options
      ? options.nativeFetch
      : process.env.VITEST === "true"
        ? null
        : nativeEdgarFetch;
  if (!native) return nodeResult;
  const viaNative = await native(url, requestHeaders(url, options?.headers), timeoutMs, maxBytes);
  return viaNative ?? nodeResult;
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
