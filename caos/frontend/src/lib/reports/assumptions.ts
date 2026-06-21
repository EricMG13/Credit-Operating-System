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
  // CP-1 K-09 add-back register — analyst acceptance multiplier per account
  // (1 = accept the sponsor's add-back in full, 0 = disallow it entirely).
  abRestr: number;
  abMna: number;
  abSbc: number;
  abSyn: number;
  abOther: number;
}

// The add-back register: named accounts that decompose the aggregate add-back
// (Adj. EBITDA = reported EBITDA + Σ add-backs). Weights split each period's
// add-backs and MUST sum to 1 so default acceptance reproduces the agent build.
// `key` doubles as the CaseAssumptions multiplier field and the sheet row id.
//
// Labels mirror the engine's add-back category vocabulary (engine/adjusted.py
// `_CATEGORY_KW`). NOTE: the engine discloses only the aggregate add-back % and
// which categories are present — never a per-account dollar split. This weighted
// breakdown is therefore an ILLUSTRATIVE decomposition for analyst sensitivity,
// not a sourced line-item register.
export const ADDBACKS = [
  { key: "abRestr", label: "Restructuring", w: 0.30 },
  { key: "abMna", label: "Transaction / non-recurring", w: 0.22 },
  { key: "abSbc", label: "Stock-based comp", w: 0.20 },
  { key: "abSyn", label: "Run-rate synergies", w: 0.18 },
  { key: "abOther", label: "Pro forma", w: 0.10 },
] as const;
export type AddbackKey = (typeof ADDBACKS)[number]["key"];

// Forecast years, in build order (FY26e/FY27e/FY28e = forecast cols 0/1/2).
export type FY = 0 | 1 | 2;
export const FORECAST_LABELS = ["FY26e", "FY27e", "FY28e"] as const;

// Per-year driver overrides on top of the case's all-years baseline. A field
// present here wins for that year only; absent → the all-years value applies.
export type YearOverrides = Partial<Record<FY, Partial<CaseAssumptions>>>;

export interface Assumptions {
  base: CaseAssumptions;
  down: CaseAssumptions;
  // optional so older persisted state / test fixtures stay valid (default {})
  baseYears?: YearOverrides;
  downYears?: YearOverrides;
}

export const DEFAULT_DA_PCT = 0.046;

export const DEFAULT_CASE: CaseAssumptions = {
  gDrive: 0, gFluid: 0, gAfter: 0,
  dGpm: 0, dAdjm: 0, daPct: DEFAULT_DA_PCT,
  mInt: 1, mLeases: 1, mTax: 1, mWc: 1, mCapex: 1, mAcq: 1, mDiss: 1,
  divDelta: 0,
  abRestr: 1, abMna: 1, abSbc: 1, abSyn: 1, abOther: 1,
};

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  base: { ...DEFAULT_CASE },
  down: { ...DEFAULT_CASE },
  baseYears: {},
  downYears: {},
};

const KEY = "caos-d-assumptions";

export function loadAssumptions(): Assumptions {
  if (typeof window === "undefined") return DEFAULT_ASSUMPTIONS;
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && s.base && s.down) {
      return {
        base: { ...DEFAULT_CASE, ...s.base }, down: { ...DEFAULT_CASE, ...s.down },
        baseYears: sanitizeYears(s.baseYears), downYears: sanitizeYears(s.downYears),
      };
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

/** Effective drivers for a forecast year: all-years baseline + that year's overrides. */
export function effectiveYear(all: CaseAssumptions, ov?: Partial<CaseAssumptions>): CaseAssumptions {
  return ov ? { ...all, ...ov } : all;
}

/** Number of fields a year override pins (year-chip count). */
export function yearModifiedCount(ov?: Partial<CaseAssumptions>): number {
  return ov ? Object.keys(ov).length : 0;
}

// Keep only known driver keys under valid year indices — guards persisted state.
function sanitizeYears(raw: unknown): YearOverrides {
  const out: YearOverrides = {};
  if (!raw || typeof raw !== "object") return out;
  const keys = Object.keys(DEFAULT_CASE) as (keyof CaseAssumptions)[];
  for (const y of [0, 1, 2] as FY[]) {
    const src = (raw as Record<number, unknown>)[y];
    if (!src || typeof src !== "object") continue;
    const ov: Partial<CaseAssumptions> = {};
    for (const k of keys) {
      const v = (src as Record<string, unknown>)[k];
      if (typeof v === "number" && Number.isFinite(v)) ov[k] = v;
    }
    if (Object.keys(ov).length) out[y] = ov;
  }
  return out;
}
