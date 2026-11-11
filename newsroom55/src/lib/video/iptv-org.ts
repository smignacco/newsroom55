import { createHash } from "crypto";

export const IPTV_ORG_CA_SOURCE = "iptv-org-ca";
export const IPTV_ORG_CA_CATALOG_URL =
  "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ca.m3u";
export const IPTV_ORG_REPOSITORY_URL = "https://github.com/iptv-org/iptv";
export const IPTV_ORG_CONTENTS_API =
  "https://api.github.com/repos/iptv-org/iptv/contents/streams?ref=master";
export const IPTV_ORG_RAW_PREFIX =
  "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/";

const MAX_CATALOG_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 12_000;
const PLAYLIST_KEY = /^[a-z0-9_-]+\.m3u$/;

export type IptvPlaylist = {
  key: string;
  name: string;
  catalogUrl: string;
  repositorySha: string;
};

export type CatalogChannel = {
  catalogKey: string;
  name: string;
  tvgId: string | null;
  logoUrl: string | null;
  groupTitle: string | null;
  streamUrl: string;
  streamReferrer: string | null;
  adapter: "hls" | "none";
  status: "catalogued-unverified" | "unsupported-format";
};

function attribute(line: string, name: string): string | null {
  const match = line.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return match?.[1]?.trim() || null;
}

function channelName(line: string): string {
  const comma = line.indexOf(",");
  return (comma >= 0 ? line.slice(comma + 1) : "Unnamed channel").trim().slice(0, 160);
}

function safeHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function stableCatalogKey(identity: string): string {
  return createHash("sha256").update(identity).digest("hex").slice(0, 32);
}

function normalizeIdentity(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function parseM3uCatalog(input: string): CatalogChannel[] {
  const channels: CatalogChannel[] = [];
  const identityOccurrences = new Map<string, number>();
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/);
  let metadata: string | null = null;
  let referrer: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF:")) {
      metadata = line;
      referrer = null;
      continue;
    }
    if (metadata && line.startsWith("#EXTVLCOPT:http-referrer=")) {
      referrer = safeHttpUrl(line.slice("#EXTVLCOPT:http-referrer=".length))?.toString() ?? null;
      continue;
    }
    if (line.startsWith("#")) continue;
    if (!metadata) continue;

    const stream = safeHttpUrl(line);
    if (stream) {
      const isHls = stream.pathname.toLowerCase().endsWith(".m3u8");
      const logo = attribute(metadata, "tvg-logo");
      const tvgId = attribute(metadata, "tvg-id");
      const name = channelName(metadata);
      const groupTitle = attribute(metadata, "group-title");
      const identity = tvgId
        ? `tvg:${normalizeIdentity(tvgId)}`
        : `name:${normalizeIdentity(name)}|group:${normalizeIdentity(groupTitle || "")}`;
      const occurrence = identityOccurrences.get(identity) ?? 0;
      identityOccurrences.set(identity, occurrence + 1);
      channels.push({
        catalogKey: stableCatalogKey(`${identity}|variant:${occurrence}`),
        name,
        tvgId,
        logoUrl: logo && safeHttpUrl(logo) ? safeHttpUrl(logo)!.toString() : null,
        groupTitle,
        streamUrl: stream.toString(),
        streamReferrer: referrer,
        adapter: isHls ? "hls" : "none",
        status: isHls ? "catalogued-unverified" : "unsupported-format",
      });
    }
    metadata = null;
    referrer = null;
  }

  return channels;
}

function playlistName(key: string): string {
  const [region, ...variants] = key.replace(/\.m3u$/, "").split("_");
  let regionName = region.toUpperCase();
  if (/^[a-z]{2}$/i.test(region)) {
    regionName =
      new Intl.DisplayNames(["fr"], { type: "region" }).of(region.toUpperCase()) ?? regionName;
  } else if (region === "int") {
    regionName = "International";
  }
  const variant = variants
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" · ");
  return variant ? `${regionName} · ${variant}` : regionName;
}

export async function discoverIptvPlaylists(): Promise<IptvPlaylist[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(IPTV_ORG_CONTENTS_API, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "newsroom55-iptv-catalog",
        "x-github-api-version": "2022-11-28",
      },
    });
    if (!response.ok) throw new Error(`GitHub catalog request failed (${response.status})`);
    const entries = (await response.json()) as unknown;
    if (!Array.isArray(entries)) throw new Error("GitHub catalog response is invalid");
    return entries
      .filter(
        (entry): entry is { name: string; sha: string; download_url: string; type: string } =>
          typeof entry === "object" &&
          entry !== null &&
          "type" in entry &&
          entry.type === "file" &&
          "name" in entry &&
          typeof entry.name === "string" &&
          PLAYLIST_KEY.test(entry.name) &&
          "sha" in entry &&
          typeof entry.sha === "string" &&
          "download_url" in entry &&
          typeof entry.download_url === "string" &&
          entry.download_url === `${IPTV_ORG_RAW_PREFIX}${entry.name}`,
      )
      .map((entry) => ({
        key: entry.name,
        name: playlistName(entry.name),
        catalogUrl: entry.download_url,
        repositorySha: entry.sha,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  } finally {
    clearTimeout(timeout);
  }
}

export function isValidPlaylistKey(key: string): boolean {
  return PLAYLIST_KEY.test(key);
}

export async function fetchIptvPlaylist(
  catalogUrl: string,
  etag?: string | null,
): Promise<
  | { notModified: true; etag: string | null }
  | { notModified: false; etag: string | null; contentHash: string; channels: CatalogChannel[] }
> {
  if (!catalogUrl.startsWith(IPTV_ORG_RAW_PREFIX)) throw new Error("Untrusted catalog URL");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(catalogUrl, {
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: {
        accept: "audio/x-mpegurl,text/plain",
        ...(etag ? { "if-none-match": etag } : {}),
      },
    });
    if (response.status === 304) {
      return { notModified: true, etag: response.headers.get("etag") ?? etag ?? null };
    }
    if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > MAX_CATALOG_BYTES) throw new Error("Catalog exceeds the size limit");
    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > MAX_CATALOG_BYTES) {
      throw new Error("Catalog exceeds the size limit");
    }
    if (!body.trimStart().startsWith("#EXTM3U")) throw new Error("Catalog is not a valid M3U playlist");
    const channels = parseM3uCatalog(body);
    if (channels.length === 0) throw new Error("Catalog contains no usable HTTP channels");
    return {
      notModified: false,
      etag: response.headers.get("etag"),
      contentHash: createHash("sha256").update(body).digest("hex"),
      channels,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchCanadianCatalog(): Promise<CatalogChannel[]> {
  const result = await fetchIptvPlaylist(IPTV_ORG_CA_CATALOG_URL);
  if (result.notModified) return [];
  return result.channels;
}
