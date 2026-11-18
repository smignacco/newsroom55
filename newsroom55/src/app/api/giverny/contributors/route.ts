import { NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { getGivernyContributors } from "@/lib/giverny/service";
import { givernySettings } from "@/lib/giverny/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await boot();
  if (!givernySettings().enabled) {
    return NextResponse.json({ error: "Module désactivé" }, { status: 404 });
  }
  return NextResponse.json(getGivernyContributors(), {
    headers: { "cache-control": "no-store" },
  });
}
