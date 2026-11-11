import { redirect } from "next/navigation";
import { RemoteControl } from "@/components/remote/RemoteControl";
import { boot } from "@/lib/boot";
import { getBoardControlState } from "@/lib/control/state";
import { healthSettings } from "@/lib/health/service";
import { listStories } from "@/lib/news/aggregator";
import { publicChannels } from "@/lib/video/player";
import { readSession } from "@/lib/security/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function RemotePage() {
  await boot();
  const session = await readSession();
  if (!session) redirect("/admin/login?next=/remote");
  const channels = publicChannels().filter(
    (channel) => channel.adapter === "hls" && channel.configured,
  );
  return (
    <RemoteControl
      csrf={session.csrf}
      initialState={getBoardControlState()}
      channels={channels}
      initialHealth={healthSettings()}
      stories={listStories(20)}
    />
  );
}
