import { NextRequest, NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { requireAdmin } from "@/lib/security/auth";
import { testHomeAssistantConnection } from "@/lib/health/service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const result = await testHomeAssistantConnection();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Connexion impossible",
      },
      { status: 502 },
    );
  }
}
