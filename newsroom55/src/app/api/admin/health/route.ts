import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { requireAdmin } from "@/lib/security/auth";
import { HEALTH_METRICS } from "@/lib/health/metrics";
import {
  getHealthAdminSnapshot,
  saveHealthMappings,
  updateHealthSettings,
} from "@/lib/health/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function privateJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    ...init,
    headers: { "cache-control": "private, no-store" },
  });
}

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  privacyMode: z.boolean().optional(),
  dailyExerciseGoal: z.number().positive().max(1440).nullable().optional(),
  dailyStepsGoal: z.number().positive().max(1_000_000).nullable().optional(),
  weeklyActivityGoal: z.number().positive().max(10_080).nullable().optional(),
  sleepTargetMinutes: z.number().positive().max(1440).nullable().optional(),
  showAverage: z.boolean().optional(),
  showPhases: z.boolean().optional(),
  showActiveEnergy: z.boolean().optional(),
});

const payloadSchema = z.object({
  settings: settingsSchema.optional(),
  mappings: z
    .array(
      z.object({
        metric: z.enum(HEALTH_METRICS),
        entityId: z
          .string()
          .regex(/^[a-z0-9_]+\.[a-z0-9_]+$/)
          .nullable(),
      }),
    )
    .max(HEALTH_METRICS.length)
    .optional(),
});

export async function GET(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  return privateJson(getHealthAdminSnapshot());
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = payloadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return privateJson(
      { error: "Configuration de santé invalide" },
      { status: 400 },
    );
  }
  if (parsed.data.settings) updateHealthSettings(parsed.data.settings);
  if (parsed.data.mappings) {
    saveHealthMappings(
      Object.fromEntries(
        parsed.data.mappings.map(({ metric, entityId }) => [metric, entityId]),
      ),
    );
  }
  return privateJson(getHealthAdminSnapshot());
}
