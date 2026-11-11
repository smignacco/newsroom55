import { NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { listStories, sourceHealth } from "@/lib/news/aggregator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  await boot();
  const category = new URL(req.url).searchParams.get("category");
  return NextResponse.json({
    stories: listStories(24, category),
    health: sourceHealth(),
  });
}
