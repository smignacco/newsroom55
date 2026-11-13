import { describe, expect, it } from "vitest";
import {
  TILE_FOCUS_LIFT,
  TILE_GRID_DROP,
  fillChannelIds,
  pointerGestureOpensMenu,
  resolveTilePointer,
} from "@/lib/control/layout";

describe("fillChannelIds", () => {
  it("keeps current order and fills extra slots from the catalogue", () => {
    expect(fillChannelIds([2], [1, 2, 3, 4], 3)).toEqual([2, 1, 3]);
  });

  it("trims to the requested count and ignores unknown ids", () => {
    expect(fillChannelIds([9, 2, 3, 4], [2, 3, 4], 2)).toEqual([2, 3]);
  });

  it("never exceeds four sources", () => {
    expect(fillChannelIds([], [1, 2, 3, 4, 5], 8)).toEqual([1, 2, 3, 4]);
  });
});

describe("resolveTilePointer", () => {
  const base = {
    fromSlot: 1,
    overSlot: null as number | null,
    dx: 0,
    dy: 0,
    layoutMode: "grid" as const,
    selectedCount: 4,
    focusedSlot: 0 as number | null,
  };

  it("treats a short movement as a tap that opens the tile menu", () => {
    expect(resolveTilePointer({ ...base, dx: 8, dy: -6 })).toEqual({
      action: "tap",
      slot: 1,
    });
  });

  it("promotes a tile to focus when it is dragged upward", () => {
    expect(
      resolveTilePointer({ ...base, dy: -TILE_FOCUS_LIFT, dx: 4 }),
    ).toEqual({ action: "focus", slot: 1 });
  });

  it("swaps two grid tiles when one is dropped onto the other", () => {
    expect(
      resolveTilePointer({ ...base, overSlot: 3, dx: 80, dy: 12 }),
    ).toEqual({ action: "swap", from: 1, to: 3 });
  });

  it("moves focus when a thumbnail is dropped onto the large screen", () => {
    expect(
      resolveTilePointer({
        ...base,
        layoutMode: "focus",
        fromSlot: 2,
        overSlot: 0,
        dx: 10,
        dy: -90,
      }),
    ).toEqual({ action: "focus", slot: 2 });
  });

  it("moves focus when the large screen is dropped onto a thumbnail", () => {
    expect(
      resolveTilePointer({
        ...base,
        layoutMode: "focus",
        fromSlot: 0,
        overSlot: 3,
        focusedSlot: 0,
        dx: 40,
        dy: 90,
      }),
    ).toEqual({ action: "focus", slot: 3 });
  });

  it("returns to the grid when the focused screen is dragged down", () => {
    expect(
      resolveTilePointer({
        ...base,
        layoutMode: "focus",
        fromSlot: 0,
        focusedSlot: 0,
        dx: 2,
        dy: TILE_GRID_DROP,
      }),
    ).toEqual({ action: "grid" });
  });

  it("does not enter focus with a single feed", () => {
    expect(
      resolveTilePointer({
        ...base,
        selectedCount: 1,
        fromSlot: 0,
        dy: -120,
      }),
    ).toEqual({ action: "tap", slot: 0 });
  });

  it("opens the tile menu only for taps, not for drag gestures", () => {
    expect(pointerGestureOpensMenu({ action: "tap", slot: 1 })).toBe(true);
    expect(pointerGestureOpensMenu({ action: "focus", slot: 1 })).toBe(false);
    expect(pointerGestureOpensMenu({ action: "swap", from: 0, to: 1 })).toBe(false);
    expect(pointerGestureOpensMenu({ action: "grid" })).toBe(false);
    expect(pointerGestureOpensMenu(null)).toBe(false);
  });
});
