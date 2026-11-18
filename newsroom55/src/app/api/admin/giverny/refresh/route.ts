import { NextRequest, NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { requireAdmin } from "@/lib/security/auth";
import { getGivernyRefreshProgress, getGivernyValidation, startGivernyRefresh } from "@/lib/giverny/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const progress = startGivernyRefresh();
  return NextResponse.json(
    { ok: true, started: progress.running || Boolean(progress.finishedAt), progress, validation: getGivernyValidation() },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function GET(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json(
    { progress: getGivernyRefreshProgress(), validation: getGivernyValidation() },
    { headers: { "cache-control": "private, no-store" } },
  );
}
