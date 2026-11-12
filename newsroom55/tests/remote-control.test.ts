import { describe, expect, it } from "vitest";
import { nextRemotePowerControl } from "@/lib/control/remote";

describe("iPhone remote power control", () => {
  it("restores digital signage through Halfwake after standby", () => {
    expect(nextRemotePowerControl("active")).toMatchObject({
      command: "standby",
    });
    expect(nextRemotePowerControl("standby")).toEqual({
      command: "signage",
      label: "Réafficher NEWSROOM",
    });
    expect(nextRemotePowerControl("halfwake")).toMatchObject({
      command: "wake",
    });
  });
});
