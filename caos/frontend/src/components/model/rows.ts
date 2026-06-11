// Model Builder row + source-manifest definitions (port of design bundle concept-d.jsx).

import type { ModelCol } from "@/lib/reports/model";

/* ---------- build manifest: module outputs consumed by the model ---------- */
export interface SrcDef {
  chip: string;
  name: string;
  ev: string[];
  note?: string;
  warn?: string;
  colGroup?: "BASE" | "DOWN";
}

export const SRC: Record<string, SrcDef> = {
  cp1:    { chip: "CP-1 T4.7",   name: "Normalized financials",            ev: ["E-103"] },
  cp1a:   { chip: "CP-1A 06",    name: "Operating model — segments",       ev: ["E-12", "E-15"] },
  cp1b:   { chip: "CP-1B T6",    name: "Quarterly KPI dashboard",          ev: ["E-58"], note: "Dec-25 derived (G-02)" },
  cp1ab:  { chip: "CP-1 K-09",   name: "Add-back register",                ev: ["E-09", "E-87"] },
  cp1k22: { chip: "CP-1 K-22",   name: "FCF conversion calc",              ev: ["E-22"] },
  cp2e:   { chip: "CP-2E T2E.5", name: "Liquidity bridge",                 ev: ["E-77"] },
  cp2f:   { chip: "CP-2F T2F.2", name: "Rate exposure register",           ev: [], warn: "L-04" },
  cp3b:   { chip: "CP-3B T3B.2", name: "Capital structure dashboard",      ev: ["E-63"] },
  cp2d:   { chip: "CP-2D T2D.5", name: "Capital allocation risk",          ev: ["E-91"] },
  cp6a:   { chip: "CP-6A 06",    name: "Chair haircut → base case",        ev: ["E-09"], colGroup: "BASE" },
  cp2b:   { chip: "CP-2B P1",    name: "Downside pathway → downside case", ev: ["E-77"], colGroup: "DOWN" },
};

/* ---------- row definitions ---------- */
export type RowFormat = "m" | "p" | "x" | "d" | "r";

export interface RowDef {
  sec?: string;
  id?: string;
  l?: string;
  sub?: string;
  g?: (c: ModelCol) => number | null;
  f?: RowFormat;
  bold?: 1;
  ind?: 1;
  shade?: 1;
  line?: 1;
  pct?: 1;
  src?: string;
  formula?: string;
}

export const ROWS: RowDef[] = [
  { sec: "Income Statement" },
  { id: "segD", l: "Drivetrain", g: (c) => c.segD, f: "m", ind: 1, shade: 1, src: "cp1a" },
  { id: "segF", l: "Fluid Systems", g: (c) => c.segF, f: "m", ind: 1, shade: 1, src: "cp1a" },
  { id: "segA", l: "Aftermarket & Services", g: (c) => c.segA, f: "m", ind: 1, shade: 1, src: "cp1a" },
  { id: "rev", l: "Revenues", g: (c) => c.rev, f: "m", bold: 1, line: 1, src: "cp1", formula: "Revenues = Σ divisions · CP-1 T4.7 normalized financials" },
  { id: "grev", l: "% growth", g: (c) => c.gRev, f: "p", ind: 1, pct: 1, src: "cp1b" },
  { id: "cogs", l: "COGS", g: (c) => -c.cogs, f: "m", ind: 1, shade: 1, src: "cp1" },
  { id: "gp", l: "Gross Profit", g: (c) => c.gp, f: "m", bold: 1, src: "cp1" },
  { id: "gpm", l: "% margin", g: (c) => c.gpm, f: "p", ind: 1, pct: 1 },
  { id: "opex", l: "OPEX", g: (c) => -c.opex, f: "m", ind: 1, shade: 1, src: "cp1" },
  { id: "ebit", l: "EBIT", g: (c) => c.ebit, f: "m", bold: 1 },
  { id: "da", l: "D&A", g: (c) => c.da, f: "m", ind: 1, shade: 1, src: "cp1" },
  { id: "ebitda", l: "EBITDA", g: (c) => c.ebitda, f: "m", bold: 1, formula: "EBITDA = EBIT + D&A (reported, pre add-backs)" },
  { id: "ab", l: "Adjustments", g: (c) => c.ab, f: "m", ind: 1, shade: 1, src: "cp1ab", formula: "Add-backs per CP-1 K-09 register — 18.2% of LTM Adj. EBITDA" },
  { id: "adj", l: "Adj. EBITDA", g: (c) => c.adj, f: "m", bold: 1, line: 1, src: "cp1ab" },
  { id: "adjm", l: "% margin", g: (c) => c.adjm, f: "p", ind: 1, pct: 1 },
  { id: "gadj", l: "% growth", g: (c) => c.gAdj, f: "p", ind: 1, pct: 1, src: "cp1b" },

  { sec: "Cash Flow" },
  { id: "adj2", l: "Adj. EBITDA", g: (c) => c.adj, f: "m", bold: 1 },
  { id: "int", l: "Cash Interest", g: (c) => -c.int, f: "m", ind: 1, shade: 1, src: "cp2f", formula: "Cash interest = Σ instrument balance × (base rate + margin) · CP-2F T2F.2 — modeled, hedging register absent (L-04)" },
  { id: "leases", l: "Leases", g: (c) => -c.leases, f: "m", ind: 1, shade: 1 },
  { id: "tax", l: "Cash Taxes", g: (c) => -c.tax, f: "m", ind: 1, shade: 1 },
  { id: "oth", l: "Other", g: (c) => -c.oth, f: "m", ind: 1, shade: 1 },
  { id: "ffo", l: "FFO", g: (c) => c.ffo, f: "m", bold: 1, formula: "FFO = Adj. EBITDA − cash interest − leases − cash taxes − other" },
  { id: "wc", l: "Changes in WC", g: (c) => c.wc, f: "m", ind: 1, shade: 1, src: "cp2e" },
  { id: "cfo", l: "CFO", g: (c) => c.cfo, f: "m", bold: 1, formula: "CFO = FFO + changes in working capital" },
  { id: "capex", l: "Capex & Intangibles", g: (c) => -c.capex, f: "m", ind: 1, shade: 1, src: "cp1k22" },
  { id: "fcf", l: "FCF", g: (c) => c.fcf, f: "m", bold: 1, src: "cp1k22", formula: "FCF = CFO − capex & intangible investment · CP-1 calc register K-22" },
  { id: "acq", l: "Acquisitions", g: (c) => c.acq, f: "m", ind: 1, shade: 1 },
  { id: "diss", l: "Debt Issue / (Repay)", g: (c) => c.diss, f: "m", ind: 1, shade: 1, src: "cp3b" },
  { id: "div", l: "Dividends", g: (c) => c.div, f: "m", ind: 1, shade: 1, src: "cp2d", formula: "Sponsor distributions · watch CP-2D flag — RP basket $240M (trigger T-4)" },
  { id: "othf", l: "Other", g: (c) => c.othf, f: "m", ind: 1, shade: 1 },
  { id: "ncf", l: "NCF", g: (c) => c.ncf, f: "m", bold: 1, line: 1, src: "cp2e", formula: "NCF = FCF + acquisitions + debt issue/(repay) + dividends + other · ties CP-2E bridge" },

  { sec: "Balance Sheet" },
  { id: "cash", l: "Cash", g: (c) => c.cash, f: "m", bold: 1, src: "cp2e", formula: "Cash rolls forward from NCF · anchored to CP-2E beginning liquidity register ($184M Mar-26)" },
  { id: "rcfsize", l: "RCF size", g: (c) => c.rcfSize, f: "m", ind: 1, shade: 1, src: "cp3b" },
  { id: "rcf", l: "RCF (drawn)", sub: "S+350", g: (c) => c.rcf, f: "m", ind: 1, shade: 1, src: "cp3b" },
  { id: "tlb", l: "1L Term Loan", sub: "S+375", g: (c) => c.tlb, f: "m", ind: 1, shade: 1, src: "cp3b" },
  { id: "ssn", l: "2L SS Notes '31", sub: "8.250%", g: (c) => c.ssn, f: "m", ind: 1, shade: 1, src: "cp3b", formula: "2L bridge to May-26, refinanced by the subject SSN '31 at issue · CP-3B T3B.2" },
  { id: "sub", l: "Sub Notes '32", sub: "10.000%", g: (c) => c.sub, f: "m", ind: 1, shade: 1, src: "cp3b" },
  { id: "secured", l: "Secured Debt", g: (c) => c.secured, f: "m", bold: 1, src: "cp3b" },
  { id: "tdebt", l: "Total Debt", g: (c) => c.tdebt, f: "m", bold: 1, line: 1, src: "cp3b" },
  { id: "ndebt", l: "Net Debt", g: (c) => c.ndebt, f: "m", bold: 1, src: "cp3b" },
  { id: "ar", l: "Net A/R", g: (c) => c.ar, f: "m", ind: 1, shade: 1 },
  { id: "inv", l: "Inventories", g: (c) => c.inv, f: "m", ind: 1, shade: 1 },
  { id: "ap", l: "A/P", g: (c) => c.ap, f: "m", ind: 1, shade: 1 },

  { sec: "KPIs" },
  { id: "srsec", l: "Sr. Sec Net Leverage", g: (c) => c.srsec, f: "x", ind: 1 },
  { id: "totlev", l: "Total Leverage", g: (c) => c.totlev, f: "x", ind: 1 },
  { id: "netlev", l: "Total Net Leverage", g: (c) => c.netlev, f: "x", bold: 1, src: "cp1", formula: "Total Net Leverage = (Total Debt − Cash) / Adj. EBITDA · ties to Q1-26 compliance cert 5.68x" },
  { id: "intcov", l: "Interest Coverage", g: (c) => c.intcov, f: "x", ind: 1 },
  { id: "fcfd", l: "FCF as % of Debt", g: (c) => c.fcfdebt, f: "p", ind: 1, pct: 1 },
  { id: "sga", l: "SG&A % of Sales", g: (c) => c.sga, f: "p", ind: 1, pct: 1, shade: 1 },
  { id: "dapc", l: "D&A % of Sales", g: (c) => c.dapc, f: "p", ind: 1, pct: 1, shade: 1 },
  { id: "dso", l: "DSO", g: (c) => c.days.dso, f: "d", ind: 1 },
  { id: "dsi", l: "DSI", g: (c) => c.days.dsi, f: "d", ind: 1 },
  { id: "dpo", l: "DPO", g: (c) => c.days.dpo, f: "d", ind: 1 },
  { id: "taxr", l: "Tax Rate", g: (c) => c.taxrate, f: "p", ind: 1, pct: 1 },
  { id: "cpr", l: "Capex / Revenue", g: (c) => c.capexrev, f: "p", ind: 1, pct: 1, src: "cp1k22" },
  { id: "sofr", l: "SOFR rate", g: (c) => c.sofr / 100, f: "r", ind: 1, pct: 1, src: "cp2f" },
];

/* ---------- formatting ---------- */
export function fmt(v: number | null | undefined, f?: RowFormat): string {
  if (v == null || Number.isNaN(v)) return "";
  if (f === "m") {
    const r = Math.round(v);
    if (r === 0) return "–";
    const s = Math.abs(r).toLocaleString("en-US");
    return r < 0 ? `(${s})` : s;
  }
  if (f === "p" || f === "r") return (v * 100).toFixed(1) + "%";
  if (f === "x") return v.toFixed(2) + "x";
  if (f === "d") return Math.round(v).toString();
  return String(v);
}

export const GROUPS_META: Record<string, string> = {
  Q: "Quarterly", YTD: "YTD", HIST: "Historic", LTM: "LTM", PF: "PF", BASE: "Base Forecast", DOWN: "Downside Forecast",
};
export const CW: Record<string, number> = { Q: 56, YTD: 60, HIST: 62, LTM: 62, PF: 62, BASE: 68, DOWN: 68 };
export const LBL = 196;

/* ---------- manual overrides: editable historical inputs ---------- */
export const OV_SIGN: Record<string, number> = { rev: 1, adj: 1, ab: 1, int: -1, tax: -1, wc: 1, capex: -1, diss: 1, div: 1 };
export const ovField = (rowId: string): string => (rowId === "adj2" ? "adj" : rowId);
export const isEditCol = (key: string): boolean => (key.charAt(0) === "q" && key.length <= 2) || key === "f22" || key === "f23";
export const isEditable = (rowId: string, colKey: string): boolean => OV_SIGN[ovField(rowId)] != null && isEditCol(colKey);

export function parseNum(input: string): number | null {
  let s = String(input).trim().replace(/,/g, "").replace(/\$/g, "");
  if (!s) return null;
  let neg = false;
  const m = s.match(/^\((.*)\)$/);
  if (m) { neg = true; s = m[1]; }
  const v = parseFloat(s);
  if (Number.isNaN(v)) return null;
  return neg ? -v : v;
}
