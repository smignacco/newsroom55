import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { requireAdmin } from "@/lib/security/auth";
import {
  getGivernyValidation,
  removeOfficialMonth,
  saveOfficialMonth,
} from "@/lib/giverny/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function privateJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    ...init,
    headers: { "cache-control": "private, no-store" },
  });
}

const postSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  officialReturn: z.number().gt(-1).lt(2),
  officialNav: z.number().positive().lt(100_000).nullable().optional(),
  note: z.string().max(240).nullable().optional(),
});

const deleteSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return privateJson({ error: "Mois officiel invalide" }, { status: 400 });
  }
  saveOfficialMonth(
    parsed.data.yearMonth,
    parsed.data.officialReturn,
    parsed.data.officialNav ?? null,
    parsed.data.note ?? null,
  );
  return privateJson({ validation: getGivernyValidation() });
}

export async function DELETE(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return privateJson({ error: "Mois officiel invalide" }, { status: 400 });
  }
  removeOfficialMonth(parsed.data.yearMonth);
  return privateJson({ validation: getGivernyValidation() });
}
