import { describe, expect, it } from "vitest";
import { isCaptionTextTrack } from "@/lib/video/captions";

describe("caption track selection", () => {
  it("accepts subtitle and caption tracks only", () => {
    expect(isCaptionTextTrack({ kind: "subtitles" })).toBe(true);
    expect(isCaptionTextTrack({ kind: "captions" })).toBe(true);
    expect(isCaptionTextTrack({ kind: "metadata" })).toBe(false);
    expect(isCaptionTextTrack({ kind: "chapters" })).toBe(false);
    expect(isCaptionTextTrack({ kind: "descriptions" })).toBe(false);
  });
});
