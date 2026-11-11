import { NextRequest, NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { verifyPulseDisplayRequest } from "@/lib/health/display-auth";
import { getPulseSnapshot, healthSettings } from "@/lib/health/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function privateJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    ...init,
    headers: { "cache-control": "private, no-store" },
  });
}

export async function GET(req: NextRequest) {
  await boot();
  const settings = healthSettings();
  if (!settings.enabled) {
    return privateJson({ error: "Module désactivé" }, { status: 404 });
  }
  if (!(await verifyPulseDisplayRequest(req))) {
    return privateJson({ error: "Écran non autorisé" }, { status: 401 });
  }
  if (settings.privacyMode) {
    return privateJson({
      generatedAt: new Date().toISOString(),
      privacyMode: true,
    });
  }
  return privateJson(getPulseSnapshot());
}
