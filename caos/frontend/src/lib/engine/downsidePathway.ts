// Adapter: canonical CP-2B engine payload -> the downside-fragility read the
// Model Builder's Scenario panel surfaces. Counterpart to modelAnchor.ts (CP-1
// -> LTM anchor): here we pull the first-order EBITDA-shock sensitivity CP-2B
// computes (stressed leverage/coverage at 10/20/30% declines, shock-to-breach,
// fragility band). Returns null on any absent/garbage field — and on the
// degraded "no leverage" payload (empty scenarios) — so the caller falls back to
// hiding the section ("prefer live, static fallback").

import type { ModuleDetailDTO } from "./types";

export type Fragility = "HIGH" | "MODERATE" | "LOW";

export interface DownsideShock {
  shockPct: number;                 // EBITDA decline applied: 10 | 20 | 30
  stressedNetLeverage: number;      // net leverage after the shock (x)
  stressedCoverage: number | null;  // interest coverage after the shock (x), if CP-1 reported coverage
}

export interface DownsidePathway {
  currentNetLeverage: number;
  breachThresholdX: number;          // distress marker (7.0x leveraged-loan convention)
  shocks: DownsideShock[];
  shockToBreachPct: number | null;   // smallest decline that reaches the marker; null = survives -30%
  fragility: Fragility;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Pull the downside-fragility read from a live CP-2B payload, or null if the
 *  shape is absent/degraded (caller then hides the section). Mirrors the lenient
 *  guards in modelAnchor.ts `cp1ToAnchor`. */
export function cp2bToDownside(detail: ModuleDetailDTO): DownsidePathway | null {
  if (detail.module_id !== "CP-2B") return null;
  const ro = detail.runtime_output as Record<string, unknown> | undefined;
  if (!ro) return null;

  const currentNetLeverage = num(ro.current_net_leverage);
  const breachThresholdX = num(ro.breach_threshold_x);
  const fragility =
    ro.fragility === "HIGH" || ro.fragility === "MODERATE" || ro.fragility === "LOW"
      ? (ro.fragility as Fragility)
      : null;

  const shocks: DownsideShock[] = [];
  for (const s of Array.isArray(ro.scenarios) ? ro.scenarios : []) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const shockPct = num(o.ebitda_shock_pct);
    const stressedNetLeverage = num(o.stressed_net_leverage);
    if (shockPct == null || stressedNetLeverage == null) continue;
    shocks.push({ shockPct, stressedNetLeverage, stressedCoverage: num(o.stressed_interest_coverage) });
  }

  // Need the core figures + at least one usable shock; the degraded
  // "CP-1 gave no leverage" payload (empty scenarios) falls through to null.
  if (currentNetLeverage == null || breachThresholdX == null || fragility == null || shocks.length === 0) {
    return null;
  }
  return {
    currentNetLeverage,
    breachThresholdX,
    shocks,
    shockToBreachPct: num(ro.shock_to_breach_pct), // null is valid: survives a -30% decline
    fragility,
  };
}
