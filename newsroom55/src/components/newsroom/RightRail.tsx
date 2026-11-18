"use client";

import type { ComponentProps } from "react";
import { ActivitySleepPulse } from "@/components/newsroom/ActivitySleepPulse";
import { GivernyTracker } from "@/components/newsroom/GivernyTracker";
import { NewsFeed } from "@/components/newsroom/NewsFeed";
import type { GivernyHeight } from "@/lib/giverny/types";

export function RightRail({
  pulseEnabled,
  givernyEnabled,
  givernyHeight,
  newsFeed,
}: {
  pulseEnabled: boolean;
  givernyEnabled: boolean;
  givernyHeight: GivernyHeight;
  newsFeed: ComponentProps<typeof NewsFeed>;
}) {
  return (
    <aside
      className={`nr-right-rail ${pulseEnabled ? "with-pulse" : ""} ${
        givernyEnabled ? `with-giverny is-${givernyHeight}` : ""
      }`}
    >
      {givernyEnabled ? <GivernyTracker /> : null}
      <NewsFeed {...newsFeed} />
      {pulseEnabled ? <ActivitySleepPulse /> : null}
    </aside>
  );
}
