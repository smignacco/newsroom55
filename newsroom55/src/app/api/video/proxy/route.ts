import { NextRequest, NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { getDb } from "@/lib/database";
import {
  assertPublicPlaybackUrl,
  rewriteHlsManifest,
  verifyPlaybackToken,
} from "@/lib/video/hls-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REDIRECTS = 4;
const MAX_MANIFEST_BYTES = 2_000_000;
const UPSTREAM_TIMEOUT_MS = 20_000;

async function fetchUpstream(
  initialUrl: string,
  referrer: string | null,
  range: string | null,
): Promise<{ response: Response; finalUrl: string }> {
  let current = initialUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const url = await assertPublicPlaybackUrl(current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = {
        accept: "*/*",
        "user-agent": "NEWSROOM55/1.0 IPTV proxy",
      };
      if (range) headers.range = range;
      if (referrer) {
        headers.referer = referrer;
        headers.origin = new URL(referrer).origin;
      }
      const response = await fetch(url, {
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
        headers,
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirect === MAX_REDIRECTS) throw new Error("Too many upstream redirects");
        current = new URL(location, url).toString();
        continue;
      }
      return { response, finalUrl: url.toString() };
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("Unable to resolve upstream stream");
}

export async function GET(request: NextRequest) {
  await boot();
  const token = request.nextUrl.searchParams.get("token");
  const playback = token ? verifyPlaybackToken(token) : null;
  if (!playback) return NextResponse.json({ error: "Invalid or expired playback token" }, { status: 403 });

  const channel = getDb()
    .prepare(
      `SELECT id FROM tv_channels
       WHERE id = ? AND enabled = 1 AND adapter = 'hls'
         AND (catalog_source = 'iptv-org-ca' OR catalog_source LIKE 'iptv-org:%')`,
    )
    .get(playback.channelId);
  if (!channel) return NextResponse.json({ error: "Channel is no longer enabled" }, { status: 404 });

  try {
    const { response, finalUrl } = await fetchUpstream(
      playback.url,
      playback.referrer,
      request.headers.get("range"),
    );
    if (!response.ok && response.status !== 206) {
      return NextResponse.json(
        { error: `Upstream stream responded with ${response.status}` },
        { status: response.status >= 400 && response.status < 600 ? response.status : 502 },
      );
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    const isManifest =
      contentType.includes("mpegurl") || contentType.includes("m3u8") || new URL(finalUrl).pathname.endsWith(".m3u8");
    if (isManifest) {
      const declaredSize = Number(response.headers.get("content-length") || 0);
      if (declaredSize > MAX_MANIFEST_BYTES) {
        return NextResponse.json({ error: "HLS manifest is too large" }, { status: 502 });
      }
      const manifest = await response.text();
      if (Buffer.byteLength(manifest, "utf8") > MAX_MANIFEST_BYTES || !manifest.trimStart().startsWith("#EXTM3U")) {
        return NextResponse.json({ error: "Invalid HLS manifest" }, { status: 502 });
      }
      return new NextResponse(
        rewriteHlsManifest(manifest, finalUrl, playback.channelId, playback.referrer),
        {
          status: 200,
          headers: {
            "content-type": "application/vnd.apple.mpegurl",
            "cache-control": "no-store",
          },
        },
      );
    }

    const headers = new Headers({
      "content-type": response.headers.get("content-type") || "application/octet-stream",
      "cache-control": "private, max-age=30",
    });
    for (const name of ["accept-ranges", "content-range", "content-length"]) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new NextResponse(response.body, { status: response.status, headers });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Upstream stream timed out"
        : error instanceof Error
          ? error.message
          : "Unable to load upstream stream";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
