export type HlsBufferProfile = {
  forwardSeconds: number;
  backSeconds: number;
  maximumSeconds: number;
  maximumBytes: number;
};

const MEBIBYTE = 1024 * 1024;

export function hlsBufferProfile(streamCount: number): HlsBufferProfile {
  if (streamCount <= 1) {
    return {
      forwardSeconds: 60,
      backSeconds: 10,
      maximumSeconds: 90,
      maximumBytes: 96 * MEBIBYTE,
    };
  }
  if (streamCount === 2) {
    return {
      forwardSeconds: 45,
      backSeconds: 10,
      maximumSeconds: 65,
      maximumBytes: 64 * MEBIBYTE,
    };
  }
  return {
    forwardSeconds: 25,
    backSeconds: 8,
    maximumSeconds: 40,
    maximumBytes: 40 * MEBIBYTE,
  };
}
