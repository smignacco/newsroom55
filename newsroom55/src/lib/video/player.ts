import { getDb } from "@/lib/database";

export type VideoAdapterId = "none" | "hls" | "rtmp" | "rtsp" | "webrtc";

export type PublicChannel = {
  id: number;
  name: string;
  adapter: VideoAdapterId;
  configured: boolean;
  isDefault: boolean;
  status: string;
};

export type PlayerAdapter = {
  id: VideoAdapterId;
  label: string;
  /** Browser support is implemented only for HLS; RoomOS hardware support remains untested. */
  clientPlayable: boolean;
};

export const ADAPTERS: PlayerAdapter[] = [
  { id: "none", label: "Waiting / unconfigured", clientPlayable: false },
  { id: "hls", label: "HLS (native / Media Source)", clientPlayable: true },
  { id: "webrtc", label: "WebRTC (future)", clientPlayable: false },
  { id: "rtmp", label: "RTMP via server relay (future)", clientPlayable: false },
  { id: "rtsp", label: "RTSP via server relay (future)", clientPlayable: false },
];

export function publicChannels(): PublicChannel[] {
  const rows = getDb()
    .prepare(
      `SELECT id, name, adapter, stream_ref, is_default, status FROM tv_channels WHERE enabled = 1 ORDER BY is_default DESC, id ASC`,
    )
    .all() as {
    id: number;
    name: string;
    adapter: VideoAdapterId;
    stream_ref: string | null;
    is_default: number;
    status: string;
  }[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    adapter: row.adapter,
    configured: Boolean(row.stream_ref),
    isDefault: Boolean(row.is_default),
    status: row.status,
  }));
}
