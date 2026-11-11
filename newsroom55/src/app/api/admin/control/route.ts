import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { getDb } from "@/lib/database";
import {
  getBoardControlState,
  issueBoardDisplayCommand,
  updateBoardControlState,
} from "@/lib/control/state";
import { sendRoomOsCommand, type RoomOsAction } from "@/lib/roomos/client";
import { requireAdmin } from "@/lib/security/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    channelId: z.number().int().positive().optional(),
    channelIds: z
      .array(z.number().int().positive())
      .min(1)
      .max(4)
      .refine((ids) => new Set(ids).size === ids.length)
      .optional(),
    audioChannelId: z.number().int().positive().optional(),
    layoutMode: z.enum(["grid", "focus"]).optional(),
    focusChannelId: z.number().int().positive().optional(),
    muted: z.boolean().optional(),
    power: z.enum(["standby", "signage", "wake"]).optional(),
    volume: z.enum(["up", "down"]).optional(),
    displayCommand: z.enum(["reload", "open-story", "close-story"]).optional(),
    storyId: z.number().int().positive().optional(),
  })
  .refine((value) => Object.keys(value).length > 0)
  .superRefine((value, context) => {
    if (value.displayCommand === "open-story" && value.storyId === undefined) {
      context.addIssue({
        code: "custom",
        message: "storyId is required to open a story",
        path: ["storyId"],
      });
    }
    if (value.storyId !== undefined && value.displayCommand !== "open-story") {
      context.addIssue({
        code: "custom",
        message: "storyId is only valid with open-story",
        path: ["storyId"],
      });
    }
  });

export async function GET(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json(getBoardControlState());
}

export async function PATCH(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  if (parsed.data.displayCommand === "open-story") {
    const story = getDb()
      .prepare("SELECT id FROM news_items WHERE id = ?")
      .get(parsed.data.storyId) as { id: number } | undefined;
    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }
  }

  if (parsed.data.displayCommand) {
    return NextResponse.json(
      issueBoardDisplayCommand(
        parsed.data.displayCommand,
        parsed.data.displayCommand === "open-story" ? parsed.data.storyId : null,
      ),
    );
  }

  const current = getBoardControlState();
  const requestedIds =
    parsed.data.channelIds ??
    (parsed.data.channelId !== undefined ? [parsed.data.channelId] : current.channelIds);
  if (parsed.data.channelIds || parsed.data.channelId !== undefined) {
    const placeholders = requestedIds.map(() => "?").join(",");
    const rows = getDb()
      .prepare(
        `SELECT id FROM tv_channels
         WHERE id IN (${placeholders}) AND enabled = 1
           AND adapter = 'hls' AND stream_ref IS NOT NULL`,
      )
      .all(...requestedIds) as { id: number }[];
    if (rows.length !== requestedIds.length) {
      return NextResponse.json(
        { error: "Every source must be an enabled and configured HLS channel" },
        { status: 400 },
      );
    }
  }
  if (
    parsed.data.audioChannelId !== undefined &&
    !requestedIds.includes(parsed.data.audioChannelId)
  ) {
    return NextResponse.json(
      { error: "The audio source must be one of the displayed channels" },
      { status: 400 },
    );
  }
  if (
    parsed.data.focusChannelId !== undefined &&
    !requestedIds.includes(parsed.data.focusChannelId)
  ) {
    return NextResponse.json(
      { error: "The focused source must be one of the displayed channels" },
      { status: 400 },
    );
  }

  if (parsed.data.power || parsed.data.volume) {
    try {
      if (parsed.data.power) {
        const action: RoomOsAction =
          parsed.data.power === "standby"
            ? "standby"
            : parsed.data.power === "signage"
              ? "halfwake"
              : "wake";
        await sendRoomOsCommand(action);
      }
      if (parsed.data.volume) {
        await sendRoomOsCommand(
          parsed.data.volume === "up" ? "volume-up" : "volume-down",
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "RoomOS command failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const state = updateBoardControlState({
    channelId: parsed.data.channelId,
    channelIds: parsed.data.channelIds,
    audioChannelId: parsed.data.audioChannelId,
    layoutMode: parsed.data.layoutMode,
    focusChannelId: parsed.data.focusChannelId,
    muted: parsed.data.muted,
    powerState: parsed.data.power
      ? parsed.data.power === "standby"
        ? "standby"
        : parsed.data.power === "signage"
          ? "halfwake"
          : "active"
      : undefined,
  });
  return NextResponse.json(state);
}
