import { NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { getBoardSnapshot } from "@/lib/board-snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  await boot();
  const snapshot = await getBoardSnapshot();
  return NextResponse.json(snapshot);
}
