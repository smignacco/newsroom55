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
