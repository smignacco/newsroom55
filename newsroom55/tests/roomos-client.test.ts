import { describe, expect, it } from "vitest";
import {
  parseRoomOsPowerState,
  roomOsCommandXml,
} from "@/lib/roomos/client";

describe("RoomOS remote commands", () => {
  it("builds the official standby and wake command paths", () => {
    expect(roomOsCommandXml("standby")).toContain(
      "<Command><Standby><Activate/></Standby></Command>",
    );
    expect(roomOsCommandXml("halfwake")).toContain(
      "<Command><Standby><Halfwake/></Standby></Command>",
    );
    expect(roomOsCommandXml("wake")).toContain(
      "<Command><Standby><Deactivate/></Standby></Command>",
    );
  });

  it("builds RoomOS volume increase and decrease commands", () => {
    expect(roomOsCommandXml("volume-up")).toContain(
      "<Command><Audio><Volume><Increase/></Volume></Audio></Command>",
    );
    expect(roomOsCommandXml("volume-down")).toContain(
      "<Command><Audio><Volume><Decrease/></Volume></Audio></Command>",
    );
  });

  it("maps the RoomOS standby status to the remote state", () => {
    expect(
      parseRoomOsPowerState(
        '<Status><Standby><State item="1">Off</State></Standby></Status>',
      ),
    ).toBe("active");
    expect(
      parseRoomOsPowerState(
        '<Status><Standby><State item="1">Halfwake</State></Standby></Status>',
      ),
    ).toBe("halfwake");
    expect(
      parseRoomOsPowerState(
        '<Status><Standby><State item="1">Standby</State></Standby></Status>',
      ),
    ).toBe("standby");
    expect(parseRoomOsPowerState("<Status />")).toBeNull();
  });
});
