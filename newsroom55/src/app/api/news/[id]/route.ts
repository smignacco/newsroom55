import { NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { storyById } from "@/lib/news/aggregator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await boot();
  const { id } = await context.params;
  const storyId = Number(id);
  if (!Number.isInteger(storyId) || storyId < 1) {
    return NextResponse.json({ error: "Invalid story id" }, { status: 400 });
  }
  const story = storyById(storyId);
  if (!story) {
    return NextResponse.json(
      { error: "Story not found" },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }
  return NextResponse.json(
    { story },
    { headers: { "cache-control": "no-store" } },
  );
}
