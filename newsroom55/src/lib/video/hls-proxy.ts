import { createHmac, timingSafeEqual } from "crypto";
import { isIP } from "net";
import { lookup } from "dns/promises";
import { sessionSecret } from "@/lib/config";

const TOKEN_LIFETIME_MS = 12 * 60 * 60 * 1000;

type PlaybackToken = {
  channelId: number;
  url: string;
  referrer: string | null;
  expiresAt: number;
};

function signature(payload: string): Buffer {
  return createHmac("sha256", sessionSecret()).update(payload).digest();
}

export function signPlaybackUrl(channelId: number, url: string, referrer: string | null): string {
  const payload = Buffer.from(
    JSON.stringify({
      channelId,
      url,
      referrer,
      expiresAt: Date.now() + TOKEN_LIFETIME_MS,
    } satisfies PlaybackToken),
  ).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

export function verifyPlaybackToken(token: string): PlaybackToken | null {
  const [payload, encodedSignature, extra] = token.split(".");
  if (!payload || !encodedSignature || extra) return null;
  const expected = signature(payload);
  const actual = Buffer.from(encodedSignature, "base64url");
  if (
    actual.toString("base64url") !== encodedSignature ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<PlaybackToken>;
    if (
      !Number.isInteger(parsed.channelId) ||
      typeof parsed.url !== "string" ||
      (parsed.referrer !== null && typeof parsed.referrer !== "string") ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt < Date.now()
    ) {
      return null;
    }
    return parsed as PlaybackToken;
  } catch {
    return null;
  }
}

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return true;
  }
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (isIP(normalized) === 4) return isPrivateIpv4(normalized);
  if (isIP(normalized) !== 6) return true;
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIpv4(mapped[1]) : false;
}

export async function assertPublicPlaybackUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid playback URL");
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
    throw new Error("Playback URL is not allowed");
  }
  if (url.hostname.toLowerCase() === "localhost") throw new Error("Playback host is not allowed");
  if (isIP(url.hostname)) {
    if (isPrivateAddress(url.hostname)) throw new Error("Private playback hosts are not allowed");
  } else {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new Error("Playback host does not resolve to a public address");
    }
  }
  return url;
}

export function rewriteHlsManifest(
  manifest: string,
  baseUrl: string,
  channelId: number,
  referrer: string | null,
): string {
  const proxyUrl = (value: string) => {
    const absolute = new URL(value, baseUrl).toString();
    const token = signPlaybackUrl(channelId, absolute, referrer);
    return `/api/video/proxy?token=${encodeURIComponent(token)}`;
  };

  return manifest
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (!trimmed.startsWith("#")) return proxyUrl(trimmed);
      return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => `URI="${proxyUrl(uri)}"`);
    })
    .join("\n");
}
