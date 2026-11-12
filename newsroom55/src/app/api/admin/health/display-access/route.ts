import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { requireAdmin } from "@/lib/security/auth";
import {
  clearPulseDisplayCookie,
  approvePulseDisplayPairing,
  revokePulseDisplays,
} from "@/lib/health/display-auth";

export const runtime = "nodejs";

const schema = z.object({
  code: z.string().regex(/^\s*\d{3}\s?\d{3}\s*$/),
});

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Entrez le code à six chiffres affiché sur le Board." },
      { status: 400 },
    );
  }
  if (!approvePulseDisplayPairing(parsed.data.code)) {
    return NextResponse.json(
      { error: "Code invalide ou expiré. Utilisez le code actuellement affiché sur le Board." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  revokePulseDisplays();
  const response = NextResponse.json({ ok: true });
  clearPulseDisplayCookie(response);
  return response;
}
