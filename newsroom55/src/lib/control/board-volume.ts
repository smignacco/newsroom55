import { NextRequest } from "next/server";
import {
  clampBoardVolume,
  type VolumeApplied,
} from "@/lib/control/volume";
import { verifyPulseDisplayRequest } from "@/lib/health/display-auth";
import { requireAdmin } from "@/lib/security/auth";

export async function authorizedForRoomOsVolume(
  req: NextRequest,
): Promise<boolean> {
  if (await verifyPulseDisplayRequest(req)) return true;
  const admin = await requireAdmin(req);
  return admin.ok;
}

export async function applyBoardOutputVolume(input: {
  authorized: boolean;
  configured: boolean;
  level: number;
  setVolume: (level: number) => Promise<void>;
}): Promise<{ level: number; applied: VolumeApplied }> {
  const level = clampBoardVolume(input.level);
  if (!input.configured || !input.authorized) {
    return { level, applied: "player" };
  }
  try {
    await input.setVolume(level);
    return { level, applied: "roomos" };
  } catch {
    return { level, applied: "player" };
  }
}
