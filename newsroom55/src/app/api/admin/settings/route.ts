import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { getDb, getSetting, setSetting } from "@/lib/database";
import { requireAdmin } from "@/lib/security/auth";
import { TIMEZONES } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEYS = [
  "layout",
  "text_scale",
  "ticker_speed",
  "animations",
  "sound",
  "alerts",
  "news_interval_sec",
  "timezone",
] as const;

export async function GET(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const settings: Record<string, string> = {};
  for (const key of KEYS) settings[key] = getSetting(key, "");
  const rules = getDb().prepare("SELECT * FROM breaking_rules ORDER BY id").all();
  return NextResponse.json({ settings, rules });
}

const schema = z.object({
  layout: z.enum(["broadcast-classic", "compact"]).optional(),
  text_scale: z.enum(["90", "100", "110", "125"]).optional(),
  ticker_speed: z.enum(["28", "42", "60"]).optional(),
  animations: z.enum(["full", "reduced"]).optional(),
  sound: z.enum(["muted", "on"]).optional(),
  alerts: z.enum(["on", "off"]).optional(),
  news_interval_sec: z.enum(["180", "300", "600"]).optional(),
  timezone: z.enum(TIMEZONES).optional(),
});

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) setSetting(key, String(value));
  }
  return NextResponse.json({ ok: true });
}
