import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("subtitle-free Board playback", () => {
  it("does not access browser text tracks and disables HLS caption parsers", () => {
    const player = fs.readFileSync(
      path.join(process.cwd(), "src/components/newsroom/HlsPlayer.tsx"),
      "utf8",
    );
    const remote = fs.readFileSync(
      path.join(process.cwd(), "src/components/remote/RemoteControl.tsx"),
      "utf8",
    );

    expect(player).not.toMatch(/textTracks|SUBTITLE_TRACKS_UPDATED/);
    expect(player).toContain("enableWebVTT: false");
    expect(player).toContain("enableIMSC1: false");
    expect(player).toContain("enableCEA708Captions: false");
    expect(remote).not.toContain("SOUS-TITRES");
  });
});
