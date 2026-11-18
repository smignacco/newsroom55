import { NextRequest, NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { getGivernyHistory } from "@/lib/giverny/service";
import { givernySettings } from "@/lib/giverny/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await boot();
  if (!givernySettings().enabled) {
    return NextResponse.json({ error: "Module désactivé" }, { status: 404 });
  }
  const range = req.nextUrl.searchParams.get("range") ?? undefined;
  return NextResponse.json(getGivernyHistory(range), {
    headers: { "cache-control": "no-store" },
  });
}
