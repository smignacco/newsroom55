"use client";

import type { ComponentProps } from "react";
import { ActivitySleepPulse } from "@/components/newsroom/ActivitySleepPulse";
import { NewsFeed } from "@/components/newsroom/NewsFeed";

export function RightRail({
  pulseEnabled,
  breaking,
  newsFeed,
}: {
  pulseEnabled: boolean;
  breaking: boolean;
  newsFeed: ComponentProps<typeof NewsFeed>;
}) {
  return (
    <aside
      className={`nr-right-rail ${pulseEnabled ? "with-pulse" : ""} ${
        breaking ? "has-breaking" : ""
      }`}
    >
      <NewsFeed {...newsFeed} />
      {pulseEnabled ? <ActivitySleepPulse /> : null}
    </aside>
  );
}
