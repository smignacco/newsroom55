import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { requireAdmin } from "@/lib/security/auth";
import { givernySettings, updateGivernySettings } from "@/lib/giverny/settings";
import { getGivernyRefreshProgress, getGivernySummary, getGivernyValidation } from "@/lib/giverny/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function privateJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    ...init,
    headers: { "cache-control": "private, no-store" },
  });
}

function boardPreview() {
  const summary = getGivernySummary();
  return {
    currency: summary.currency,
    givCad: summary.levels.givCad,
    navEstimate: summary.navEstimate,
    message: summary.message,
  };
}

const schema = z.object({
  enabled: z.boolean().optional(),
  refreshMinutes: z.number().int().min(5).max(240).optional(),
  heatmapSeconds: z.number().int().min(0).max(60).optional(),
  currency: z.enum(["CAD", "USD"]).optional(),
  chartRange: z.enum(["1M", "3M", "YTD", "1Y"]).optional(),
  height: z.enum(["compact", "standard", "tall"]).optional(),
  breakingBanner: z.enum(["compact", "banner", "off"]).optional(),
  cik: z.string().min(1).max(20).optional(),
  filerName: z.string().min(1).max(120).optional(),
});

export async function GET(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  return privateJson({
    settings: givernySettings(),
    validation: getGivernyValidation(),
    progress: getGivernyRefreshProgress(),
    board: boardPreview(),
  });
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return privateJson({ error: "Configuration Giverny invalide" }, { status: 400 });
  }
  updateGivernySettings(parsed.data);
  return privateJson({
    settings: givernySettings(),
    validation: getGivernyValidation(),
    progress: getGivernyRefreshProgress(),
    board: boardPreview(),
  });
}
