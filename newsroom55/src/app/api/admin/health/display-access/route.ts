import { NextRequest, NextResponse } from "next/server";
import { boot } from "@/lib/boot";
import { requireAdmin } from "@/lib/security/auth";
import {
  attachPulseDisplayCookie,
  clearPulseDisplayCookie,
  createPulseDisplayToken,
} from "@/lib/health/display-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const response = NextResponse.json({ ok: true });
  attachPulseDisplayCookie(
    response,
    await createPulseDisplayToken(),
    req.nextUrl.protocol === "https:",
  );
  return response;
}

export async function DELETE(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const response = NextResponse.json({ ok: true });
  clearPulseDisplayCookie(response);
  return response;
}
