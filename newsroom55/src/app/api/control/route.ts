import { NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { getBoardControlState } from "@/lib/control/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await boot();
  return NextResponse.json(getBoardControlState(), {
    headers: { "cache-control": "no-store" },
  });
}
