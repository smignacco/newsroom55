export const DEFAULT_BOARD_VOLUME = 40;

export function clampBoardVolume(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_BOARD_VOLUME;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}
