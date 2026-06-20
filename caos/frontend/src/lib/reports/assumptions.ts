// Forward-case assumptions — analyst nudges to the agent's BASE / DOWN forecast
// drivers, surfaced in the Model Builder's Assumptions panel. Each field is an
// adjustment *relative to the agent's baseline*, so the defaults are no-ops and
// buildModel reproduces the agent build exactly.
//
// Units:
//  - growth / margin fields are additive deltas in decimal (0.01 = +1pp),
//    applied to every forecast year;
//  - daPct is the D&A % of sales itself (absolute; agent baseline 4.6%);
//  - cash-flow lines (mInt … mDiss) are multipliers on the agent baseline $;
//  - divDelta is an absolute $/yr dividend (the agent forecasts none, so a
//    multiplier would be inert — negative = a sponsor distribution, CP-2D).

export interface CaseAssumptions {
  gDrive: number;  // Δ Drivetrain growth
  gFluid: number;  // Δ Fluid Systems growth
  gAfter: number;  // Δ Aftermarket & Services growth
  dGpm: number;    // Δ gross margin
  dAdjm: number;   // Δ adj. EBITDA margin
  daPct: number;   // D&A % of sales (absolute)
  mInt: number;    // × cash interest
  mLeases: number; // × leases
  mTax: number;    // × cash taxes
  mWc: number;     // × changes in working capital
  mCapex: number;  // × capex (scales capex % of revenue)
  mAcq: number;    // × acquisitions
  mDiss: number;   // × debt issue/(repay)
  divDelta: number; // dividends $/yr (− = distribution)
}

export interface Assumptions {
  base: CaseAssumptions;
  down: CaseAssumptions;
}

export const DEFAULT_DA_PCT = 0.046;

export const DEFAULT_CASE: CaseAssumptions = {
  gDrive: 0, gFluid: 0, gAfter: 0,
  dGpm: 0, dAdjm: 0, daPct: DEFAULT_DA_PCT,
  mInt: 1, mLeases: 1, mTax: 1, mWc: 1, mCapex: 1, mAcq: 1, mDiss: 1,
  divDelta: 0,
};

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  base: { ...DEFAULT_CASE },
  down: { ...DEFAULT_CASE },
};

const KEY = "caos-d-assumptions";

export function loadAssumptions(): Assumptions {
  if (typeof window === "undefined") return DEFAULT_ASSUMPTIONS;
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && s.base && s.down) {
      return { base: { ...DEFAULT_CASE, ...s.base }, down: { ...DEFAULT_CASE, ...s.down } };
    }
  } catch { /* first visit */ }
  return DEFAULT_ASSUMPTIONS;
}

export function saveAssumptions(a: Assumptions): void {
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* private mode / quota */ }
}

/** Count of fields in a case that differ from the agent baseline (panel chip). */
export function caseModifiedCount(c: CaseAssumptions): number {
  return (Object.keys(DEFAULT_CASE) as (keyof CaseAssumptions)[]).filter((k) => c[k] !== DEFAULT_CASE[k]).length;
}
