import { describe, expect, it } from "vitest";
import { parseM3uCatalog } from "../src/lib/video/iptv-org";

describe("iptv-org M3U parser", () => {
  it("parses HTTP channels, metadata and referrers without asserting availability", () => {
    const result = parseM3uCatalog(`#EXTM3U
#EXTINF:-1 tvg-id="CBC.ca" tvg-logo="https://img.example/cbc.png" group-title="News",CBC Toronto (720p) [Geo-blocked]
#EXTVLCOPT:http-referrer=https://cbc.example/
https://video.example/live/master.m3u8
#EXTINF:-1 tvg-id="BNN.ca",BNN Bloomberg
https://video.example/live/manifest.mpd
`);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      name: "CBC Toronto (720p) [Geo-blocked]",
      tvgId: "CBC.ca",
      logoUrl: "https://img.example/cbc.png",
      groupTitle: "News",
      streamReferrer: "https://cbc.example/",
      adapter: "hls",
      status: "catalogued-unverified",
    });
    expect(result[1]).toMatchObject({
      name: "BNN Bloomberg",
      adapter: "none",
      status: "unsupported-format",
    });
  });

  it("rejects non-HTTP streams and malformed entries", () => {
    const result = parseM3uCatalog(`#EXTM3U
#EXTINF:-1,Local file
file:///tmp/channel.m3u8
#EXTINF:-1,Missing stream
# comment
`);

    expect(result).toEqual([]);
  });

  it("keeps a stable catalog key when a known channel source URL changes", () => {
    const first = parseM3uCatalog(`#EXTM3U
#EXTINF:-1 tvg-id="ChannelA.ca",Channel A
https://example.com/old.m3u8
`);
    const changed = parseM3uCatalog(`#EXTM3U
#EXTINF:-1 tvg-id="ChannelA.ca",Channel A
https://example.com/new.m3u8
`);
    expect(first[0].catalogKey).toBe(changed[0].catalogKey);
    expect(first[0].catalogKey).toHaveLength(32);
  });
});
