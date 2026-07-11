// M-118 cash-flow model engine — full port of design bundle concept-d-model.js.
// Constructs the ATLF model grid from upstream module outputs: CP-1 normalized
// financials · CP-1A segments · CP-1B quarterly dashboard · CP-2E liquidity ·
// CP-2F rate registers · CP-3B capital structure · CP-2B P1 downside ·
// CP-6A base-case haircut.
//
// Consumed by both the Model Builder (/model — full grid incl. PF/BASE/DOWN,
// severity, manual overrides) and the Report Studio (/reports — historical
// columns only).
//
// Optionally grounded in a live CP-1 run: passing a `ModelAnchor` re-bases the
// LTM and PF columns onto the engine's reported figures (see `applyAnchor`),
// leaving historicals and the forecast on the seeded build.

import type { ModelAnchor } from "@/lib/engine/modelAnchor";
import { type Assumptions, type FY, ADDBACKS, DEFAULT_ASSUMPTIONS, effectiveYear } from "./assumptions";

export interface ModelCol {
  key: string;
  label: string;
  kind: "q" | "fy" | "ytd" | "ltm" | "pf" | "b" | "d";
  mult: number;
  derived: boolean;
  // income statement
  rev: number;
  segA: number;
  segD: number;
  segF: number;
  gp: number;
  gpm: number;
  cogs: number;
  opex: number;
  ebit: number;
  da: number;
  ebitda: number;
  ab: number;
  abAccts: number[]; // add-back register decomposed by account (sums to ab)
  adj: number;
  adjm: number;
  gRev: number | null;
  gAdj: number | null;
  // per-business-unit YoY revenue growth (Drivetrain / Fluid / Aftermarket)
  gSegD: number | null;
  gSegF: number | null;
  gSegA: number | null;
  // cash flow
  int: number;
  leases: number;
  tax: number;
  oth: number;
  ffo: number;
  wc: number;
  cfo: number;
  capex: number;
  fcf: number;
  acq: number;
  diss: number;
  div: number;
  othf: number;
  ncf: number;
  // balance sheet
  cash: number;
  rcfSize: number;
  rcf: number;
  tlb: number;
  ssn: number;
  sub: number;
  secured: number;
  tdebt: number;
  ndebt: number;
  ar: number;
  inv: number;
  ap: number;
  // KPIs (annualized kinds only)
  srsec: number | null;
  totlev: number | null;
  netlev: number | null;
  intcov: number | null;
  fcfdebt: number | null;
  taxrate: number | null;
  sga: number;
  dapc: number;
  capexrev: number;
  sofr: number;
  days: { dso: number; dsi: number; dpo: number };
  // which override fields are active on this column (display)
  ov: Record<string, boolean>;
}

export interface ModelColumnDef {
  key: string;
  group: "Q" | "YTD" | "HIST" | "LTM" | "PF" | "BASE" | "DOWN";
}

export interface Model {
  cols: Record<string, ModelCol>;
  columns: ModelColumnDef[];
  // Provenance for the Model Builder's LIVE/SEEDED chip + tie-out badge.
  // `seededLtmNetlev` is the model's own LTM net leverage *before* any anchor,
  // so the UI can reconcile it against CP-1's reported figure.
  provenance: { seededLtmNetlev: number; anchored: boolean };
}

export type Overrides = Record<string, number>; // "colKey:field" -> model-basis value

/* ---- quarterly actuals Mar-24 … Mar-26 (CP-1B T6 grain; Dec-25 is derived period G-02) ---- */
const QL = ["Mar-24", "Jun-24", "Sep-24", "Dec-24", "Mar-25", "Jun-25", "Sep-25", "Dec-25", "Mar-26"];
const REV = [615, 640, 655, 678, 656, 688, 701, 697, 715];
const ADJ = [94, 97, 99, 102, 102, 103, 106, 104, 108];
const AB = [15, 16, 16, 16, 18, 18, 19, 19, 21];
const AFT = [0.218, 0.22, 0.222, 0.224, 0.226, 0.228, 0.23, 0.231, 0.234];
const DRV = [0.465, 0.463, 0.461, 0.459, 0.457, 0.455, 0.453, 0.452, 0.45];
const GPM = [0.262, 0.263, 0.264, 0.264, 0.265, 0.265, 0.266, 0.265, 0.266];
const INT = [47, 48, 48, 49, 49, 49, 50, 50, 49];
const TAX = [5, 6, 6, 7, 6, 6, 7, 7, 7];
const WC = [-14, 4, 2, 6, -15, 5, 2, 7, -16];
const DISS = [16.5, -3.5, -3.5, -3.5, -3.5, -3.5, -3.5, -3.5, -3.5];
const DIV = [0, -30, 0, 0, 0, -40, 0, 0, 0];
const OTHF = [-1, -1, -1, -1, -1.25, -1.25, -1.25, -1.25, -2.8];
const TLBQ = [1448, 1445, 1441, 1438, 1434, 1431, 1427, 1424, 1420];
const SOFRQ = [5.33, 5.31, 4.96, 4.59, 4.41, 4.36, 4.33, 4.31, 4.3];
const DAYS_H = { dso: 52, dsi: 78, dpo: 45 };

export const OV_FIELDS = ["rev", "adj", "ab", "int", "tax", "wc", "capex", "diss", "div"] as const;

type Ctx = Partial<ModelCol> & {
  capexPct?: number;
  daPct?: number;
  gpmF?: number;
};

function finishFlows(input: Ctx) {
  const c = input as Ctx & Required<Pick<ModelCol,
    "rev" | "gp" | "adj" | "ab" | "int" | "leases" | "tax" | "oth" |
    "wc" | "capex" | "acq" | "diss" | "div" | "othf"
  >>;
  c.cogs = c.rev - c.gp;
  c.ebitda = c.adj - c.ab;
  // D&A is 4.6% of sales unless a forecast column sets its own assumption (daPct).
  c.da = c.rev * (typeof c.daPct === "number" ? c.daPct : 0.046);
  c.ebit = c.ebitda - c.da;
  c.opex = c.gp - c.ebit;
  c.ffo = c.adj - c.int - c.leases - c.tax - c.oth;
  c.cfo = c.ffo + c.wc;
  c.fcf = c.cfo - c.capex;
  c.ncf = c.fcf + c.acq + c.diss + c.div + c.othf;
  return input;
}

// The annual credit KPIs, derived from the column's debt stack + adj. EBITDA.
// Used by finishBalances (build) and the quarterly rolling-LTM pass — NOT by
// applyAnchor: on an anchored column these ratios would mix live figures with
// the seeded stack (finding 4.3), so applyAnchor sets its KPIs explicitly.
function deriveCreditKpis(input: Partial<ModelCol>) {
  const c = input as Partial<ModelCol> & Required<Pick<ModelCol,
    "rcf" | "tlb" | "ssn" | "cash" | "adj" | "tdebt" | "ndebt" | "int" | "fcf"
  >>;
  // Guard each denominator so a degenerate column (adj ≤ 0 under deep margin
  // stress, no debt, zero interest) degrades to null rather than leaking
  // NaN/±Infinity into the grid — which `?.toFixed() ?? "—"` would print as
  // "Infinityx" since Infinity is a real number that survives optional chaining.
  const div = (num: number, den: number): number | null => (den ? num / den : null);
  c.srsec = div(c.rcf + c.tlb + c.ssn - c.cash, c.adj);
  c.totlev = div(c.tdebt, c.adj);
  c.netlev = div(c.ndebt, c.adj);
  c.intcov = div(c.adj, c.int);
  c.fcfdebt = div(c.fcf, c.tdebt);
}

function finishBalances(input: Ctx) {
  const c = input as Ctx & Required<Pick<ModelCol,
    "rcf" | "tlb" | "ssn" | "sub" | "cash" | "gp" | "rev" | "adj" |
    "cogs" | "kind" | "ebit" | "int" | "tax" | "opex" | "da" | "capex" |
    "ab" | "days"
  >>;
  c.secured = c.rcf + c.tlb + c.ssn;
  c.tdebt = c.secured + c.sub;
  c.ndebt = c.tdebt - c.cash;
  c.gpm = c.gp / c.rev;
  c.adjm = c.adj / c.rev;
  const m = c.mult || 1;
  c.ar = (c.rev * m * c.days.dso) / 365;
  c.inv = (c.cogs * m * c.days.dsi) / 365;
  c.ap = (c.cogs * m * c.days.dpo) / 365;
  const annual = ["fy", "ltm", "pf", "b", "d"].includes(c.kind);
  if (annual) {
    deriveCreditKpis(c);
    const ebt = c.ebit - c.int;
    c.taxrate = ebt > 5 ? c.tax / ebt : null;
  } else {
    c.srsec = null; c.totlev = null; c.netlev = null; c.intcov = null;
    c.fcfdebt = null; c.taxrate = null;
  }
  c.sga = (c.opex - c.da) / c.rev;
  c.dapc = c.da / c.rev;
  c.capexrev = c.capex / c.rev;
  // Default: split add-backs across the register by weight (forecast columns
  // pass their own per-account amounts, reflecting analyst acceptance).
  if (!c.abAccts) c.abAccts = ADDBACKS.map((a) => c.ab * a.w);
  if (!c.ov) c.ov = {};
  return input as ModelCol;
}

// Ground an annual anchor column (LTM / PF) in a live CP-1 run: re-base its
// revenue, adj. EBITDA and net debt onto the engine's reported figures. Applied
// as a post-step *after* the forecast is built, so BASE/DOWN (which read the
// seeded l1.cash) and the historicals are untouched. Debt stack (tdebt) stays
// seeded; cash is back-solved from net debt to keep the column self-consistent —
// unless the back-solve goes negative (live net debt above the seeded stack):
// no honest cash figure exists then, so it degrades to NaN, which every
// formatter (fmt/fm/round3) renders blank.
//
// KPIs (finding 4.3): only net leverage is honestly live/live here. The other
// ratios would mix bases — totlev/srsec/fcfdebt divide the SEEDED debt stack by
// live adj. EBITDA, and a derived intcov would put live adj over seeded ATLF
// interest — fabricated figures a committee would read as reported. Null them,
// and take interest coverage from CP-1's own reported figure (null → "—").
function applyAnchor(c: ModelCol, a: ModelAnchor): void {
  c.rev = a.ltmRevenue;
  c.adj = a.ltmAdjEbitda;
  c.adjm = c.adj / c.rev;
  // Keep the reported-EBITDA bridge footing after the re-base: reported + add-backs
  // = adj. The anchor carries no live add-back detail, so hold the seeded add-back
  // amount (c.ab) and back out reported EBITDA from the live adj — otherwise the
  // committee EBITDA-adjustments panel would print a bridge that doesn't tie.
  c.ebitda = c.adj - c.ab;
  c.ndebt = a.netDebt;
  // FE 4.3 / E2E-5d (branch re-base + main's mongrel-null, reconciled): re-base
  // interest from the anchor's own reported coverage so intcov ties to the live
  // figure AND is internally consistent (c.adj/c.int == a.intCov); suppress it when
  // the run reported none. Guard a negative cash back-solve to NaN. Then null the
  // debt-stack-derived KPIs the SEEDED stack can't honestly source for a live issuer.
  const cash = c.tdebt - c.ndebt;
  c.cash = cash >= 0 ? cash : NaN;
  const cov = a.intCov;
  if (cov != null && isFinite(cov) && cov > 0) {
    c.int = c.adj / cov;
    deriveCreditKpis(c);
  } else {
    deriveCreditKpis(c);
    c.intcov = null;
  }
  c.netlev = c.adj ? c.ndebt / c.adj : null;
  c.totlev = null;
  c.srsec = null;
  c.fcfdebt = null;
}

function qCtx(i: number, prevCash: number, A: Record<string, number[]>, capexOv: Record<number, number>): ModelCol {
  const rev = A.rev[i];
  const c: Ctx = {
    key: "q" + i, label: QL[i], kind: "q", mult: 4, derived: i === 7,
    rev, segA: rev * AFT[i], segD: rev * DRV[i], segF: rev * (1 - AFT[i] - DRV[i]),
    gp: rev * GPM[i], adj: A.adj[i], ab: A.ab[i],
    int: A.int[i], leases: 2.5, tax: A.tax[i], oth: 1,
    wc: A.wc[i], capex: capexOv[i] != null ? capexOv[i] : rev * 0.043,
    acq: 0, diss: A.diss[i], div: A.div[i], othf: OTHF[i],
    rcfSize: 250, rcf: 55, tlb: TLBQ[i], ssn: 900, sub: 200, sofr: SOFRQ[i], days: DAYS_H,
    gRev: i >= 4 ? A.rev[i] / A.rev[i - 4] - 1 : null,
    gAdj: i >= 4 ? A.adj[i] / A.adj[i - 4] - 1 : null,
    gSegD: i >= 4 ? (A.rev[i] * DRV[i]) / (A.rev[i - 4] * DRV[i - 4]) - 1 : null,
    gSegF: i >= 4 ? (A.rev[i] * (1 - AFT[i] - DRV[i])) / (A.rev[i - 4] * (1 - AFT[i - 4] - DRV[i - 4])) - 1 : null,
    gSegA: i >= 4 ? (A.rev[i] * AFT[i]) / (A.rev[i - 4] * AFT[i - 4]) - 1 : null,
  };
  finishFlows(c);
  c.cash = prevCash + (c.ncf as number);
  return finishBalances(c);
}

type Prior = { rev: number; adj: number; segD?: number; segF?: number; segA?: number };

function sumCtx(
  key: string, label: string, kind: "fy" | "ytd" | "ltm",
  qs: ModelCol[], balOf: ModelCol, prior: Prior | null,
): ModelCol {
  const S = (f: keyof ModelCol) => qs.reduce((s, q) => s + (q[f] as number), 0);
  const gSeg = (sum: number, p?: number) => (prior && p != null ? sum / p - 1 : null);
  const c: Ctx = {
    key, label, kind, mult: kind === "ytd" ? 4 : 1, derived: qs.some((q) => q.derived),
    rev: S("rev"), segA: S("segA"), segD: S("segD"), segF: S("segF"), gp: S("gp"),
    adj: S("adj"), ab: S("ab"), int: S("int"), leases: S("leases"), tax: S("tax"), oth: S("oth"),
    wc: S("wc"), capex: S("capex"), acq: S("acq"), diss: S("diss"), div: S("div"), othf: S("othf"),
    cash: balOf.cash, rcfSize: 250, rcf: balOf.rcf, tlb: balOf.tlb, ssn: balOf.ssn, sub: balOf.sub,
    sofr: qs[qs.length - 1].sofr, days: DAYS_H,
    gRev: prior ? S("rev") / prior.rev - 1 : null,
    gAdj: prior ? S("adj") / prior.adj - 1 : null,
    gSegD: gSeg(S("segD"), prior?.segD), gSegF: gSeg(S("segF"), prior?.segF), gSegA: gSeg(S("segA"), prior?.segA),
  };
  finishFlows(c);
  return finishBalances(c);
}

// FY22 / FY23 from CP-1 normalized history (pre-quarterly window)
function fyManual(key: string, label: string, p: Ctx, prior: ModelCol | null): ModelCol {
  const c: Ctx = {
    key, label, kind: "fy", mult: 1, derived: false, rcfSize: 250, days: DAYS_H,
    gRev: prior ? (p.rev as number) / prior.rev - 1 : null,
    gAdj: prior ? (p.adj as number) / prior.adj - 1 : null,
    gSegD: prior ? (p.segD as number) / prior.segD - 1 : null,
    gSegF: prior ? (p.segF as number) / prior.segF - 1 : null,
    gSegA: prior ? (p.segA as number) / prior.segA - 1 : null,
    ...p,
  };
  finishFlows(c);
  return finishBalances(c);
}

// Forecast year
function fCtx(key: string, label: string, kind: "b" | "d", p: Ctx, prevCash: number, prior: ModelCol): ModelCol {
  const c: Ctx = {
    key, label, kind, mult: 1, derived: false, rcfSize: 250, leases: 10,
    acq: (p.acq as number) || 0, div: 0, ...p,
  };
  c.rev = (c.segA as number) + (c.segD as number) + (c.segF as number);
  c.gp = (c.rev as number) * (c.gpmF as number);
  c.capex = (c.rev as number) * (c.capexPct as number);
  c.gRev = prior ? (c.rev as number) / prior.rev - 1 : null;
  c.gAdj = prior ? (c.adj as number) / prior.adj - 1 : null;
  c.gSegD = prior ? (c.segD as number) / prior.segD - 1 : null;
  c.gSegF = prior ? (c.segF as number) / prior.segF - 1 : null;
  c.gSegA = prior ? (c.segA as number) / prior.segA - 1 : null;
  finishFlows(c);
  c.cash = prevCash + (c.ncf as number);
  return finishBalances(c);
}

export function buildModel(sev: number = 1, OV: Overrides = {}, anchor?: ModelAnchor, asmp: Assumptions = DEFAULT_ASSUMPTIONS): Model {
  const s = Math.max(0.25, Math.min(1.6, sev || 1));
  const g = (col: string, f: string, dflt: number) => {
    const v = OV[col + ":" + f];
    return v != null ? v : dflt;
  };
  const ovOf = (col: string) => {
    const o: Record<string, boolean> = {};
    OV_FIELDS.forEach((f) => { if (OV[col + ":" + f] != null) o[f] = true; });
    return o;
  };

  // apply quarterly overrides onto cloned input arrays (growth ratios stay consistent)
  const A: Record<string, number[]> = {
    rev: REV.slice(), adj: ADJ.slice(), ab: AB.slice(), int: INT.slice(),
    tax: TAX.slice(), wc: WC.slice(), diss: DISS.slice(), div: DIV.slice(),
  };
  const capexOv: Record<number, number> = {};
  Object.keys(OV).forEach((k) => {
    const p = k.split(":"), col = p[0], f = p[1];
    if (col.charAt(0) === "q" && col.length <= 2) {
      const i = parseInt(col.slice(1), 10);
      if (!(i >= 0 && i < 9)) return;
      if (f === "capex") capexOv[i] = OV[k];
      else if (A[f]) A[f][i] = OV[k];
    }
  });

  // quarterly chain (cash rolls from Dec-23: 168)
  const q: ModelCol[] = [];
  let cash = 168;
  for (let i = 0; i < 9; i++) {
    const c = qCtx(i, cash, A, capexOv);
    c.ov = ovOf("q" + i);
    cash = c.cash;
    q.push(c);
  }
  for (let i = 3; i < q.length; i++) {
    const l4q = q.slice(i - 3, i + 1);
    const sum = (f: keyof ModelCol) => l4q.reduce((n, c) => n + (c[f] as number), 0);
    const c = q[i];
    const saved = { adj: c.adj, int: c.int, fcf: c.fcf };
    c.adj = sum("adj"); c.int = sum("int"); c.fcf = sum("fcf");
    deriveCreditKpis(c);
    c.adj = saved.adj; c.int = saved.int; c.fcf = saved.fcf;
  }

  const r22 = g("f22", "rev", 2295);
  const f22 = fyManual("f22", "FY22", {
    rev: r22, segA: r22 * 0.21, segD: r22 * 0.47, segF: r22 * 0.32, gp: r22 * 0.258,
    adj: g("f22", "adj", 331), ab: g("f22", "ab", 24), int: g("f22", "int", 168), leases: 10, tax: g("f22", "tax", 18), oth: 4,
    wc: g("f22", "wc", -6), capex: g("f22", "capex", 96), acq: 0, diss: g("f22", "diss", -14), div: g("f22", "div", 0), othf: -2,
    cash: 161, rcf: 55, tlb: 1216, ssn: 900, sub: 200, sofr: 1.62,
  }, null);
  f22.ov = ovOf("f22");
  const r23 = g("f23", "rev", 2410);
  const f23 = fyManual("f23", "FY23", {
    rev: r23, segA: r23 * 0.216, segD: r23 * 0.463, segF: r23 * 0.321, gp: r23 * 0.26,
    adj: g("f23", "adj", 358), ab: g("f23", "ab", 40), int: g("f23", "int", 178), leases: 10, tax: g("f23", "tax", 20), oth: 4,
    wc: g("f23", "wc", -8), capex: g("f23", "capex", 96), acq: -210, diss: g("f23", "diss", 216), div: g("f23", "div", 0), othf: -41,
    cash: 168, rcf: 55, tlb: 1202, ssn: 1130, sub: 200, sofr: 5.05,
  }, f22);
  f23.ov = ovOf("f23");
  const f24 = sumCtx("f24", "FY24", "fy", q.slice(0, 4), q[3], f23);
  const f25 = sumCtx("f25", "FY25", "fy", q.slice(4, 8), q[7], f24);

  const y0 = sumCtx("y0", "Mar-25", "ytd", [q[4]], q[4], { rev: q[0].rev, adj: q[0].adj, segD: q[0].segD, segF: q[0].segF, segA: q[0].segA });
  const y1 = sumCtx("y1", "Mar-26", "ytd", [q[8]], q[8], { rev: q[4].rev, adj: q[4].adj, segD: q[4].segD, segF: q[4].segF, segA: q[4].segA });
  const l0 = sumCtx("l0", "Mar-25", "ltm", q.slice(1, 5), q[4], f24);
  const l1 = sumCtx("l1", "Mar-26", "ltm", q.slice(5, 9), q[8], l0);
  ["srsec", "totlev", "netlev", "intcov", "fcfdebt"].forEach((k) => {
    (y0 as unknown as Record<string, unknown>)[k] = (l0 as unknown as Record<string, unknown>)[k];
    (y1 as unknown as Record<string, unknown>)[k] = (l1 as unknown as Record<string, unknown>)[k];
  });

  // PF: LTM Mar-26 pro forma for the 2L TL '31 issue (refis 2L bridge; interest restated)
  const pf: Ctx = { ...l1, key: "pf", label: "Jun-26", kind: "pf", int: 193 };
  finishFlows(pf);
  pf.cash = l1.cash;
  finishBalances(pf);

  // base forecast — sponsor model less CP-6A chair haircut ($35M) and CP-1B phasing
  const segs25 = { a: f25.segA, d: f25.segD, f: f25.segF };
  const BASE = [
    { g: { d: 0.020, f: 0.030, a: 0.070 }, adj: 446, ab: 60, gpmF: 0.268, int: 196, tax: 30, oth: 4, wc: -10, capexPct: 0.043, acq: -24, diss: -14, othf: -4, tlb: 1406, sofr: 3.8, days: DAYS_H },
    { g: { d: 0.025, f: 0.030, a: 0.065 }, adj: 468, ab: 45, gpmF: 0.270, int: 188, tax: 36, oth: 4, wc: -10, capexPct: 0.043, acq: 0, diss: -14, othf: -4, tlb: 1392, sofr: 3.5, days: DAYS_H },
    { g: { d: 0.025, f: 0.030, a: 0.060 }, adj: 490, ab: 35, gpmF: 0.272, int: 180, tax: 42, oth: 4, wc: -12, capexPct: 0.043, acq: 0, diss: -18, othf: -4, tlb: 1374, sofr: 3.3, days: DAYS_H },
  ];
  // downside — CP-2B pathway P1 (OEM destocking), scaled by severity s
  const DOWN = [
    { g: { d: 0.020 - 0.140 * s, f: 0.030 - 0.070 * s, a: 0.070 - 0.040 * s }, adjK: 0.18, ab: 60, gpmF: 0.258, int: 196 + 4 * s, tax: 12, oth: 10 + 15 * s, wc: 18 * s, capexPct: 0.038, acq: 0, diss: 60 * s - 14, othf: -4, rcfD: 55 + 60 * s, tlb: 1406, sofr: 3.3, days: { dso: 58, dsi: 86, dpo: 42 } },
    { g: { d: 0.010, f: 0.010, a: 0.040 }, adjK: 0.16, ab: 45, gpmF: 0.260, int: 192 + 4 * s, tax: 16, oth: 12, wc: -2, capexPct: 0.038, acq: 0, diss: -34, othf: -4, rcfD: 55 + 40 * s, tlb: 1392, sofr: 3.0, days: { dso: 56, dsi: 83, dpo: 43 } },
    { g: { d: 0.050, f: 0.040, a: 0.050 }, adjK: 0.12, ab: 35, gpmF: 0.263, int: 186 + 4 * s, tax: 24, oth: 6, wc: -8, capexPct: 0.040, acq: 0, diss: -34, othf: -4, rcfD: 55 + 20 * s, tlb: 1374, sofr: 3.0, days: { dso: 54, dsi: 80, dpo: 44 } },
  ];
  const fLabels = ["FY26e", "FY27e", "FY28e"];

  type Segs = { a: number; d: number; f: number };
  type FcastRow = (typeof BASE)[number] | (typeof DOWN)[number];

  // Agent-baseline revenue per forecast year (segments grown with the agent's
  // own growth, no analyst delta). Used to hold the implied adj-EBITDA margin
  // fixed as the growth sliders move revenue, so a margin slider is the *only*
  // thing that moves the margin.
  const baseRevOf = (rows: { g: { a: number; d: number; f: number } }[]): number[] => {
    let sg = segs25;
    return rows.map((p) => { sg = { a: sg.a * (1 + p.g.a), d: sg.d * (1 + p.g.d), f: sg.f * (1 + p.g.f) }; return sg.a + sg.d + sg.f; });
  };

  // Build a forecast column applying a case's assumptions. `agentAdj` is the
  // agent's baseline adj. EBITDA for the year; we re-express it as a margin on
  // the agent-baseline revenue, then re-apply on the slider-adjusted revenue.
  const fcast = (
    key: string, kind: "b" | "d", i: number, p: FcastRow, A: typeof asmp.base,
    agentAdj: number, baseRev: number, prevSeg: Segs, pc: number, prior: ModelCol, rcf: number,
  ): ModelCol => {
    const seg = {
      a: prevSeg.a * (1 + p.g.a + A.gAfter),
      d: prevSeg.d * (1 + p.g.d + A.gDrive),
      f: prevSeg.f * (1 + p.g.f + A.gFluid),
    };
    const rev = seg.a + seg.d + seg.f;
    const adj = rev * (agentAdj / baseRev + A.dAdjm);
    // Add-back register. `abAccts` is the sponsor's gross claim per account.
    // Acceptance (A[account]) credits only the realised portion to Adj. EBITDA;
    // the unrealised remainder is deducted, leaving reported EBITDA unchanged.
    const abAccts = ADDBACKS.map((a) => p.ab * a.w);
    const abAdj = ADDBACKS.reduce((s, a, i) => s + abAccts[i] * A[a.key], 0);
    const sofrDebtInterest = rcf * (A.sofrRate + 0.035) + p.tlb * (A.sofrRate + 0.0375) + 900 * (A.sofrRate + 0.0425);
    const fixedInterest = 200 * 0.10;
    return fCtx(key, fLabels[i], kind, {
      ab: abAdj, abAccts, oth: p.oth, othf: p.othf, tlb: p.tlb, sofr: A.sofrRate * 100, days: p.days,
      adj: adj + (abAdj - p.ab), gpmF: p.gpmF + A.dGpm, daPct: A.daPct,
      int: (sofrDebtInterest + fixedInterest) * A.mInt, leases: 10 * A.mLeases, tax: p.tax * A.mTax, wc: p.wc * A.mWc,
      capexPct: p.capexPct * A.mCapex, acq: p.acq * A.mAcq, diss: p.diss * A.mDiss, div: A.divDelta,
      segA: seg.a, segD: seg.d, segF: seg.f, rcf, ssn: 900, sub: 200,
    }, pc, prior);
  };

  const baseRevB = baseRevOf(BASE);
  const base: ModelCol[] = [];
  let pc = l1.cash;
  let prevSeg: Segs = segs25;
  let prior: ModelCol = f25;
  BASE.forEach((p, i) => {
    const A = effectiveYear(asmp.base, asmp.baseYears?.[i as FY]);
    const c = fcast("b" + i, "b", i, p, A, p.adj, baseRevB[i], prevSeg, pc, prior, 55);
    base.push(c); pc = c.cash; prevSeg = { a: c.segA, d: c.segD, f: c.segF }; prior = c;
  });

  const baseRevD = baseRevOf(DOWN);
  const down: ModelCol[] = [];
  pc = l1.cash; prevSeg = segs25; prior = f25;
  DOWN.forEach((p, i) => {
    const agentAdj = BASE[i].adj * (1 - p.adjK * s); // agent downside adj before sliders
    const A = effectiveYear(asmp.down, asmp.downYears?.[i as FY]);
    const c = fcast("d" + i, "d", i, p, A, agentAdj, baseRevD[i], prevSeg, pc, prior, p.rcfD);
    down.push(c); pc = c.cash; prevSeg = { a: c.segA, d: c.segD, f: c.segF }; prior = c;
  });

  const cols: Record<string, ModelCol> = {};
  [...q, f22, f23, f24, f25, y0, y1, l0, l1, pf as ModelCol, ...base, ...down].forEach((c) => { cols[c.key] = c; });
  const columns: ModelColumnDef[] = [
    ...q.map((c) => ({ key: c.key, group: "Q" as const })),
    { key: "y0", group: "YTD" }, { key: "y1", group: "YTD" },
    { key: "f22", group: "HIST" }, { key: "f23", group: "HIST" }, { key: "f24", group: "HIST" }, { key: "f25", group: "HIST" },
    { key: "l0", group: "LTM" }, { key: "l1", group: "LTM" },
    { key: "pf", group: "PF" },
    { key: "b0", group: "BASE" }, { key: "b1", group: "BASE" }, { key: "b2", group: "BASE" },
    { key: "d0", group: "DOWN" }, { key: "d1", group: "DOWN" }, { key: "d2", group: "DOWN" },
  ];

  // Capture the model's own LTM net leverage before any anchor, so the UI can
  // reconcile the seeded build against CP-1's reported figure, then ground the
  // LTM (l1) and PF columns in the live run if one is supplied.
  const seededLtmNetlev = cols.l1.netlev ?? 0;
  if (anchor) {
    applyAnchor(cols.l1, anchor);
    applyAnchor(cols.pf, anchor);
  }
  return { cols, columns, provenance: { seededLtmNetlev, anchored: !!anchor } };
}
