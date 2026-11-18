import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { requireAdmin } from "@/lib/security/auth";
import { ingestUploadedFiling } from "@/lib/giverny/service";
import { getGivernyValidation } from "@/lib/giverny/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  xml: z.string().min(40).max(2_000_000),
  accession: z.string().max(20).optional(),
});

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Fichier 13F invalide" },
      { status: 400, headers: { "cache-control": "private, no-store" } },
    );
  }
  try {
    const stored = await ingestUploadedFiling(parsed.data.xml, parsed.data.accession);
    return NextResponse.json(
      { ok: true, ...stored, validation: getGivernyValidation() },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import 13F impossible";
    return NextResponse.json(
      { error: message },
      { status: 400, headers: { "cache-control": "private, no-store" } },
    );
  }
}
