import { NewsroomBoard } from "@/components/newsroom/NewsroomBoard";
import { getBoardSnapshot } from "@/lib/board-snapshot";
import { boot } from "@/lib/boot";
import { getBoardControlState } from "@/lib/control/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HomePage() {
  await boot();
  const snapshot = await getBoardSnapshot();
  const control = getBoardControlState();
  return <NewsroomBoard initial={snapshot} initialControl={control} />;
}
