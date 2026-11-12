import type { BoardControlState } from "@/lib/control/state";

type PowerState = BoardControlState["powerState"];

export function nextRemotePowerControl(powerState: PowerState): {
  command: "standby" | "signage" | "wake";
  label: string;
} {
  if (powerState === "active") {
    return { command: "standby", label: "Mettre en veille" };
  }
  if (powerState === "standby") {
    return { command: "signage", label: "Réafficher NEWSROOM" };
  }
  return { command: "wake", label: "Activer le Board" };
}
