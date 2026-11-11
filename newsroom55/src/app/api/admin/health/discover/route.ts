import { NextRequest, NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { requireAdmin } from "@/lib/security/auth";
import { discoverHealthSensors } from "@/lib/health/service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ entities: await discoverHealthSensors() });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Découverte impossible",
      },
      { status: 502 },
    );
  }
}
