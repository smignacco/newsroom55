import { describe, expect, it } from "vitest";
import {
  applyCaptionSelection,
  captionTextTracks,
  isCaptionTextTrack,
} from "@/lib/video/captions";

describe("caption track selection", () => {
  it("accepts subtitle and caption tracks only", () => {
    expect(isCaptionTextTrack({ kind: "subtitles" })).toBe(true);
    expect(isCaptionTextTrack({ kind: "captions" })).toBe(true);
    expect(isCaptionTextTrack({ kind: "metadata" })).toBe(false);
    expect(isCaptionTextTrack({ kind: "chapters" })).toBe(false);
    expect(isCaptionTextTrack({ kind: "descriptions" })).toBe(false);
  });

  it("degrades safely when an embedded browser omits text tracks", () => {
    expect(captionTextTracks(undefined)).toEqual([]);
    expect(
      captionTextTracks({
        0: { kind: "metadata" },
        1: { kind: "subtitles" },
        length: 2,
      }),
    ).toEqual([{ kind: "subtitles" }]);
    const broken = new Proxy(
      { length: 0 } as ArrayLike<{ kind: string }>,
      {
        get() {
          throw new Error("unsupported TextTrackList");
        },
      },
    );
    expect(captionTextTracks(broken)).toEqual([]);
  });

  it("reports one final fallback result when HLS caption setters fail", () => {
    const controller = {
      subtitleTracks: [{}],
      get subtitleDisplay() {
        return false;
      },
      set subtitleDisplay(_value: boolean) {
        throw new Error("unsupported subtitle setter");
      },
      subtitleTrack: -1,
    };
    expect(applyCaptionSelection(controller, undefined, true)).toBe(false);

    const metadata = { kind: "metadata", mode: "hidden" };
    const subtitles = { kind: "subtitles", mode: "disabled" };
    expect(
      applyCaptionSelection(null, [metadata, subtitles], true),
    ).toBe(true);
    expect(metadata.mode).toBe("hidden");
    expect(subtitles.mode).toBe("showing");
  });
});
