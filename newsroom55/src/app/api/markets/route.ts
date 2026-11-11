import { NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { marketStatusPayload } from "@/lib/markets/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  await boot();
  return NextResponse.json(marketStatusPayload());
}
