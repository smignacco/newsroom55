import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { clampBoardVolume, DEFAULT_BOARD_VOLUME } from "@/lib/control/volume";
import { getSetting } from "@/lib/database";
import { roomOsConfigured, setRoomOsVolume } from "@/lib/roomos/client";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    level: z.number().int().min(0).max(100).optional(),
    restore: z.literal(true).optional(),
  })
  .refine((value) => value.restore === true || value.level !== undefined);

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === req.nextUrl.origin;
  } catch {
    return false;
  }
}

function defaultBoardVolume() {
  return clampBoardVolume(getSetting("board_volume", String(DEFAULT_BOARD_VOLUME)));
}

export async function POST(req: NextRequest) {
  await boot();
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  if (!rateLimit("board-volume", 80, 15_000)) {
    return NextResponse.json({ error: "Too many volume changes" }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const level = clampBoardVolume(
    parsed.data.restore ? defaultBoardVolume() : parsed.data.level,
  );
  const headers = { "cache-control": "no-store" };
  if (!roomOsConfigured()) {
    return NextResponse.json({ level, applied: "player" }, { headers });
  }
  try {
    await setRoomOsVolume(level);
    return NextResponse.json({ level, applied: "roomos" }, { headers });
  } catch {
    return NextResponse.json({ level, applied: "player" }, { headers });
  }
}
