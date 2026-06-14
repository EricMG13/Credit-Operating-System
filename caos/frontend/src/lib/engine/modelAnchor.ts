// Adapter: canonical CP-1 engine payload -> the LTM anchor the Model Builder
// grounds its grid in. This is the Model Builder's counterpart to adapt.ts
// (which maps the same CP-1 normalized_financials into the deep-dive
// {kpis, sections} shape) — here we pull just the scalar anchor the cash-flow
// grid pins its LTM/PF columns to. Returns null on any missing field so the
// caller falls back to the seeded model ("prefer live, static fallback").

import type { ModuleDetailDTO } from "./types";

export interface ModelAnchor {
  ltmRevenue: number;    // LTM revenue ($M)
  ltmAdjEbitda: number;  // LTM adj. EBITDA ($M)
  netDebt: number;       // LTM net debt ($M)
  netLeverage: number;   // adj. net leverage (x) as CP-1 reports it
  intCov: number | null; // interest coverage (x), if reported
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Pull the LTM anchor from a live CP-1 payload, or null if the shape is absent
 *  (caller then falls back to the seeded model). Reads the same
 *  runtime_output.normalized_financials fields as adapt.ts `adaptCp1`. */
export function cp1ToAnchor(detail: ModuleDetailDTO): ModelAnchor | null {
  if (detail.module_id !== "CP-1") return null;
  const fin = (detail.runtime_output?.normalized_financials as Record<string, unknown>) || null;
  if (!fin) return null;

  const rev = fin.revenue as Record<string, unknown> | undefined;
  const eb = fin.adj_ebitda as Record<string, unknown> | undefined;
  const ltmRevenue = rev ? num(rev.LTM_Q1_26) : null;
  const ltmAdjEbitda = eb ? num(eb.LTM_Q1_26) : null;
  const netDebt = num(fin.net_debt_ltm);
  const netLeverage = num(fin.net_leverage_adj_ltm);

  // The four figures the anchor actually drives; anything missing → fall back.
  if (ltmRevenue == null || ltmAdjEbitda == null || netDebt == null || netLeverage == null) {
    return null;
  }
  return {
    ltmRevenue,
    ltmAdjEbitda,
    netDebt,
    netLeverage,
    intCov: num(fin.interest_coverage_ltm),
  };
}
