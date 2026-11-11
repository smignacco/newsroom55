import { describe, expect, it } from "vitest";
import { hlsBufferProfile } from "@/lib/video/buffer-profile";

describe("RoomOS HLS buffer profiles", () => {
  it("uses deeper buffers for fewer simultaneous streams", () => {
    expect(hlsBufferProfile(1)).toMatchObject({
      forwardSeconds: 60,
      backSeconds: 10,
    });
    expect(hlsBufferProfile(2).forwardSeconds).toBe(45);
    expect(hlsBufferProfile(3).forwardSeconds).toBe(25);
    expect(hlsBufferProfile(4)).toEqual(hlsBufferProfile(3));
  });
});
