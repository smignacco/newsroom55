import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boot } from "@/lib/boot";
import { getDb } from "@/lib/database";
import { requireAdmin } from "@/lib/security/auth";
import { twelveDataMaxSymbols } from "@/lib/config";

export const runtime = "nodejs";

const schema = z.object({
  enabled: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(99).optional(),
  display_name: z.string().min(1).max(40).optional(),
  provider_symbol: z.string().min(1).max(24).optional(),
  quote_provider: z.enum(["cboe", "twelvedata"]).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const symbol = getDb()
    .prepare("SELECT enabled, quote_provider, kind, currency FROM market_symbols WHERE id = ?")
    .get(Number(id)) as
    | { enabled: number; quote_provider: string; kind: string; currency: string }
    | undefined;
  if (!symbol) return NextResponse.json({ error: "Symbol not found" }, { status: 404 });
  const willBeEnabled = parsed.data.enabled ?? Boolean(symbol.enabled);
  const quoteProvider = parsed.data.quote_provider ?? symbol.quote_provider;
  if (
    quoteProvider === "cboe" &&
    (symbol.currency !== "USD" || !["equity", "fund"].includes(symbol.kind))
  ) {
    return NextResponse.json(
      { error: "Cboe supports US equities and funds only" },
      { status: 400 },
    );
  }
  if (willBeEnabled && quoteProvider === "twelvedata") {
    const active = getDb()
      .prepare(
        `SELECT COUNT(*) AS count FROM market_symbols
         WHERE enabled = 1 AND kind != 'fx-public' AND id != ?`,
      )
      .get(Number(id)) as { count: number };
    if (active.count >= twelveDataMaxSymbols()) {
      return NextResponse.json(
        { error: "Twelve Data free-mode limit reached. Hide another instrument first." },
        { status: 409 },
      );
    }
  }
  getDb()
    .prepare(
      `UPDATE market_symbols SET
        enabled = COALESCE(?, enabled),
        sort_order = COALESCE(?, sort_order),
        display_name = COALESCE(?, display_name),
        provider_symbol = COALESCE(?, provider_symbol),
        quote_provider = COALESCE(?, quote_provider)
       WHERE id = ?`,
    )
    .run(
      parsed.data.enabled === undefined ? null : parsed.data.enabled ? 1 : 0,
      parsed.data.sort_order ?? null,
      parsed.data.display_name ?? null,
      parsed.data.provider_symbol ?? null,
      parsed.data.quote_provider ?? null,
      Number(id),
    );
  if (
    parsed.data.quote_provider &&
    parsed.data.quote_provider !== symbol.quote_provider
  ) {
    getDb().prepare("DELETE FROM market_quotes WHERE symbol_id = ?").run(Number(id));
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await boot();
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  getDb().prepare("DELETE FROM market_quotes WHERE symbol_id = ?").run(Number(id));
  getDb().prepare("DELETE FROM market_symbols WHERE id = ?").run(Number(id));
  return NextResponse.json({ ok: true });
}
