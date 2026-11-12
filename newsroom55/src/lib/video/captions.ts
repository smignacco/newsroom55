export function isCaptionTextTrack(track: { kind: string }) {
  return track.kind === "subtitles" || track.kind === "captions";
}
