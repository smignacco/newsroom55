import { fetchJson } from "@/lib/giverny/http";
import { upsertFx } from "@/lib/giverny/store";
import { usablePrice } from "@/lib/giverny/engine";

type Observation = {
  d?: string;
  FXUSDCAD?: { v?: string };
};

type ValetResponse = {
  observations?: Observation[];
};

export async function refreshUsdCadHistory(startDate: string, endDate: string): Promise<{ count: number; error: string | null }> {
  const url = `https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?start_date=${startDate}&end_date=${endDate}`;
  const payload = await fetchJson<ValetResponse>(url, {
    headers: { accept: "application/json", "user-agent": "NEWSROOM55/1.0 (Bank of Canada Valet)" },
    maxBytes: 1_500_000,
  });
  const observations = payload?.observations ?? [];
  const rows = observations.flatMap((item) => {
    if (!item.d) return [];
    const usdCad = Number(item.FXUSDCAD?.v);
    if (!usablePrice(usdCad)) return [];
    return [{ sessionDate: item.d, usdCad, provider: "bankofcanada", asOf: item.d }];
  });
  if (rows.length === 0) {
    return { count: 0, error: payload ? "Aucune observation USD/CAD utilisable." : "Banque du Canada injoignable." };
  }
  upsertFx(rows);
  return { count: rows.length, error: null };
}
