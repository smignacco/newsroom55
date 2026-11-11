import { beforeAll, describe, expect, it } from "vitest";
import {
  assertPublicPlaybackUrl,
  rewriteHlsManifest,
  signPlaybackUrl,
  verifyPlaybackToken,
} from "../src/lib/video/hls-proxy";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-with-at-least-16-characters";
});

describe("HLS playback proxy", () => {
  it("signs playback URLs and rejects tampering", () => {
    const token = signPlaybackUrl(42, "https://video.example/live/master.m3u8", null);
    expect(verifyPlaybackToken(token)).toMatchObject({
      channelId: 42,
      url: "https://video.example/live/master.m3u8",
    });
    expect(verifyPlaybackToken(`${token.slice(0, -1)}x`)).toBeNull();
  });

  it("rewrites playlists, child manifests, segments and key URIs", () => {
    const rewritten = rewriteHlsManifest(
      `#EXTM3U
#EXT-X-KEY:METHOD=AES-128,URI="keys/live.key"
#EXT-X-STREAM-INF:BANDWIDTH=1280000
quality/720p.m3u8
#EXTINF:5,
segments/one.ts
`,
      "https://video.example/live/master.m3u8",
      7,
      "https://publisher.example/",
    );
    const tokens = Array.from(rewritten.matchAll(/token=([A-Za-z0-9._%-]+)/g), (match) =>
      decodeURIComponent(match[1]),
    );
    expect(tokens).toHaveLength(3);
    expect(tokens.map((token) => verifyPlaybackToken(token)?.url)).toEqual([
      "https://video.example/live/keys/live.key",
      "https://video.example/live/quality/720p.m3u8",
      "https://video.example/live/segments/one.ts",
    ]);
  });

  it("blocks private and metadata-network playback targets", async () => {
    await expect(assertPublicPlaybackUrl("http://127.0.0.1/live.m3u8")).rejects.toThrow("not allowed");
    await expect(assertPublicPlaybackUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(
      "not allowed",
    );
  });
});
