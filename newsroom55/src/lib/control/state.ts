import { getDb } from "@/lib/database";

export type BoardControlState = {
  channelId: number | null;
  channelIds: number[];
  audioChannelId: number | null;
  layoutMode: "grid" | "focus";
  focusChannelId: number | null;
  muted: boolean;
  powerState: "active" | "standby" | "halfwake";
  revision: number;
  updatedAt: string;
};

type Row = {
  channel_id: number | null;
  channel_ids: string;
  audio_channel_id: number | null;
  layout_mode: "grid" | "focus";
  focus_channel_id: number | null;
  muted: number;
  power_state: "active" | "standby" | "halfwake";
  revision: number;
  updated_at: string;
};

export function getBoardControlState(): BoardControlState {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT channel_id, channel_ids, audio_channel_id, layout_mode,
              focus_channel_id, muted,
              power_state, revision, updated_at
       FROM board_control WHERE id = 1`,
    )
    .get() as Row;
  let savedIds: number[] = [];
  try {
    const parsed = JSON.parse(row.channel_ids);
    if (Array.isArray(parsed)) {
      savedIds = parsed.filter(
        (value): value is number => Number.isInteger(value) && value > 0,
      );
    }
  } catch {
    savedIds = [];
  }
  if (savedIds.length === 0 && row.channel_id !== null) savedIds = [row.channel_id];
  const availableIds = new Set(
    (
      database
        .prepare(
          `SELECT id FROM tv_channels
           WHERE enabled = 1 AND adapter = 'hls' AND stream_ref IS NOT NULL`,
        )
        .all() as { id: number }[]
    ).map((channel) => channel.id),
  );
  const channelIds = [...new Set(savedIds)]
    .filter((id) => availableIds.has(id))
    .slice(0, 4);
  const fallbackChannel =
    channelIds.length === 0
      ? (database
          .prepare(
            `SELECT id FROM tv_channels
             WHERE enabled = 1 AND adapter = 'hls' AND stream_ref IS NOT NULL
             ORDER BY is_default DESC, id ASC LIMIT 1`,
          )
          .get() as { id: number } | undefined)
      : undefined;
  if (fallbackChannel) channelIds.push(fallbackChannel.id);
  const audioChannelId =
    row.audio_channel_id !== null && channelIds.includes(row.audio_channel_id)
      ? row.audio_channel_id
      : channelIds[0] ?? null;
  const focusChannelId =
    row.focus_channel_id !== null && channelIds.includes(row.focus_channel_id)
      ? row.focus_channel_id
      : channelIds[0] ?? null;
  return {
    channelId: channelIds[0] ?? null,
    channelIds,
    audioChannelId,
    layoutMode:
      row.layout_mode === "focus" && channelIds.length > 1 ? "focus" : "grid",
    focusChannelId,
    muted: Boolean(row.muted),
    powerState: row.power_state,
    revision: row.revision,
    updatedAt: row.updated_at,
  };
}

export function updateBoardControlState(input: {
  channelId?: number;
  channelIds?: number[];
  audioChannelId?: number;
  layoutMode?: "grid" | "focus";
  focusChannelId?: number;
  muted?: boolean;
  powerState?: "active" | "standby" | "halfwake";
}): BoardControlState {
  const current = getBoardControlState();
  const requestedIds =
    input.channelIds ??
    (input.channelId !== undefined ? [input.channelId] : current.channelIds);
  const channelIds = [...new Set(requestedIds)].slice(0, 4);
  const audioChannelId =
    input.audioChannelId !== undefined && channelIds.includes(input.audioChannelId)
      ? input.audioChannelId
      : current.audioChannelId !== null && channelIds.includes(current.audioChannelId)
        ? current.audioChannelId
        : channelIds[0] ?? null;
  const focusChannelId =
    input.focusChannelId !== undefined && channelIds.includes(input.focusChannelId)
      ? input.focusChannelId
      : current.focusChannelId !== null && channelIds.includes(current.focusChannelId)
        ? current.focusChannelId
        : channelIds[0] ?? null;
  getDb()
    .prepare(
      `UPDATE board_control SET
        channel_id = ?,
        channel_ids = ?,
        audio_channel_id = ?,
        layout_mode = COALESCE(?, layout_mode),
        focus_channel_id = ?,
        muted = COALESCE(?, muted),
        power_state = COALESCE(?, power_state),
        revision = revision + 1,
        updated_at = ?
       WHERE id = 1`,
    )
    .run(
      channelIds[0] ?? null,
      JSON.stringify(channelIds),
      audioChannelId,
      input.layoutMode ?? null,
      focusChannelId,
      input.muted === undefined ? null : input.muted ? 1 : 0,
      input.powerState ?? null,
      new Date().toISOString(),
    );
  return getBoardControlState();
}
