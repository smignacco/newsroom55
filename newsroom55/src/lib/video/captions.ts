export function isCaptionTextTrack(track: { kind: string }) {
  return track.kind === "subtitles" || track.kind === "captions";
}

export function captionTextTracks<T extends { kind: string }>(
  tracks: ArrayLike<T> | null | undefined,
): T[] {
  if (!tracks) return [];
  try {
    return Array.from(tracks).filter(isCaptionTextTrack);
  } catch {
    return [];
  }
}

type CaptionTrack = {
  kind: string;
  mode: string;
};

type HlsCaptionController = {
  subtitleTracks?: ArrayLike<unknown>;
  subtitleDisplay: boolean;
  subtitleTrack: number;
};

export function applyCaptionSelection(
  hls: HlsCaptionController | null,
  nativeTracks: ArrayLike<CaptionTrack> | null | undefined,
  enabled: boolean,
) {
  const tracks = captionTextTracks(nativeTracks);
  let hlsAvailable = false;
  if (hls) {
    try {
      const count = hls.subtitleTracks?.length ?? 0;
      hlsAvailable = count > 0;
      hls.subtitleDisplay = enabled && hlsAvailable;
      hls.subtitleTrack = enabled && hlsAvailable ? 0 : -1;
    } catch {
      hlsAvailable = false;
    }
  }
  tracks.forEach((track, index) => {
    try {
      track.mode = enabled && index === 0 ? "showing" : "disabled";
    } catch {
      // Caption support is optional and must never stop video rendering.
    }
  });
  return hlsAvailable || tracks.length > 0;
}
