import { describe, expect, it } from "vitest";
import { clampBoardVolume, DEFAULT_BOARD_VOLUME } from "@/lib/control/volume";

describe("board volume", () => {
  it("clamps to a 0–100 integer and falls back when the value is unusable", () => {
    expect(DEFAULT_BOARD_VOLUME).toBe(40);
    expect(clampBoardVolume(0)).toBe(0);
    expect(clampBoardVolume(100)).toBe(100);
    expect(clampBoardVolume(37.4)).toBe(37);
    expect(clampBoardVolume("65")).toBe(65);
    expect(clampBoardVolume(-12)).toBe(0);
    expect(clampBoardVolume(140)).toBe(100);
    expect(clampBoardVolume("nope")).toBe(DEFAULT_BOARD_VOLUME);
    expect(clampBoardVolume(undefined)).toBe(DEFAULT_BOARD_VOLUME);
  });
});
