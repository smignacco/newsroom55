import { NextRequest, NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { requireAdmin } from "@/lib/security/auth";
import { refreshGivernyNow } from "@/lib/giverny/service";
import { getGivernyValidation } from "@/lib/giverny/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  await refreshGivernyNow();
  return NextResponse.json(
    { ok: true, validation: getGivernyValidation() },
    { headers: { "cache-control": "private, no-store" } },
  );
}
