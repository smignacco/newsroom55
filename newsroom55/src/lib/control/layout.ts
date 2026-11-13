export const TILE_TAP_SLOP = 24;
export const TILE_FOCUS_LIFT = 48;
export const TILE_GRID_DROP = 64;

export type TilePointerResult =
  | { action: "tap"; slot: number }
  | { action: "swap"; from: number; to: number }
  | { action: "focus"; slot: number }
  | { action: "grid" };

export function fillChannelIds(
  currentIds: number[],
  availableIds: number[],
  count: number,
): number[] {
  const cap = Math.min(4, Math.max(1, Math.trunc(count)));
  const allowed = new Set(availableIds);
  const next = currentIds.filter((id) => allowed.has(id)).slice(0, cap);
  for (const id of availableIds) {
    if (next.length >= cap) break;
    if (!next.includes(id)) next.push(id);
  }
  return next;
}

export function resolveTilePointer(input: {
  fromSlot: number;
  overSlot: number | null;
  dx: number;
  dy: number;
  layoutMode: "grid" | "focus";
  selectedCount: number;
  focusedSlot: number | null;
}): TilePointerResult | null {
  const distance = Math.hypot(input.dx, input.dy);
  if (distance < TILE_TAP_SLOP) {
    return { action: "tap", slot: input.fromSlot };
  }
  if (input.selectedCount < 2) {
    return { action: "tap", slot: input.fromSlot };
  }
  if (input.overSlot !== null && input.overSlot !== input.fromSlot) {
    if (input.layoutMode === "focus") {
      const overIsFocus = input.overSlot === input.focusedSlot;
      const fromIsFocus = input.fromSlot === input.focusedSlot;
      if (overIsFocus || fromIsFocus) {
        return {
          action: "focus",
          slot: fromIsFocus ? input.overSlot : input.fromSlot,
        };
      }
    }
    return { action: "swap", from: input.fromSlot, to: input.overSlot };
  }
  if (input.dy <= -TILE_FOCUS_LIFT) {
    return { action: "focus", slot: input.fromSlot };
  }
  if (
    input.layoutMode === "focus" &&
    input.fromSlot === input.focusedSlot &&
    input.dy >= TILE_GRID_DROP
  ) {
    return { action: "grid" };
  }
  return null;
}
