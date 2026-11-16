export const DEFAULT_BOARD_VOLUME = 40;

export type VolumeApplied = "roomos" | "player";

export function clampBoardVolume(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_BOARD_VOLUME;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

export function parseVolumeApplied(value: unknown): VolumeApplied | null {
  return value === "roomos" || value === "player" ? value : null;
}

export function hlsOutputVolume(level: number, applied: VolumeApplied): number {
  if (applied === "roomos") return 1;
  return clampBoardVolume(level) / 100;
}
