import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import {
  attachPulseDisplayCookie,
  attachPulsePairingRequesterCookie,
  consumePulseDisplayPairing,
  createPulseDisplayPairing,
  createPulseDisplayToken,
  PULSE_PAIRING_REQUESTER_COOKIE,
} from "@/lib/health/display-auth";
import { healthSettings } from "@/lib/health/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create") }),
  z.object({ action: z.literal("status"), pairingId: z.uuid() }),
]);

function privateJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    ...init,
    headers: { "cache-control": "private, no-store" },
  });
}

export async function POST(req: NextRequest) {
  await boot();
  if (!healthSettings().enabled) {
    return privateJson({ error: "Module désactivé" }, { status: 404 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return privateJson({ error: "Demande d’association invalide" }, { status: 400 });
  }
  if (parsed.data.action === "create") {
    try {
      const savedRequester = req.cookies.get(
        PULSE_PAIRING_REQUESTER_COOKIE,
      )?.value;
      const requesterToken =
        savedRequester && z.uuid().safeParse(savedRequester).success
          ? savedRequester
          : randomUUID();
      const pairing = createPulseDisplayPairing(requesterToken);
      const response = privateJson(pairing, { status: 201 });
      if (requesterToken !== savedRequester) {
        attachPulsePairingRequesterCookie(
          response,
          requesterToken,
          req.nextUrl.protocol === "https:",
        );
      }
      return response;
    } catch (error) {
      return privateJson(
        {
          error:
            error instanceof Error
              ? error.message
              : "Association temporairement indisponible",
        },
        { status: 429 },
      );
    }
  }

  const status = consumePulseDisplayPairing(parsed.data.pairingId);
  if (status !== "approved") return privateJson({ status });

  const response = privateJson({ status: "approved" });
  attachPulseDisplayCookie(
    response,
    await createPulseDisplayToken(),
    req.nextUrl.protocol === "https:",
  );
  return response;
}
