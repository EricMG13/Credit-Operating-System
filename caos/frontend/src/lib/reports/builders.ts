// Report builders — assembles the governed committee deliverables from the model
// + ATLF module outputs (port of design bundle concept-e-reports.js).

import { buildModel, type Model, type ModelCol, type Overrides } from "./model";
import type { Assumptions } from "./assumptions";
import {
  CAPACITY,
  CAPSTACK,
  COVENANTS,
  DEAL,
  DEBATE,
  DEBATE_6E,
  DOCS,
  RECOVERY,
  SIZING,
} from "./deal";
import { ROWS } from "@/components/model/rows";
import { fmt } from "@/components/model/model-format";
import { cellTextColor } from "@/components/model/cell-style";
import type { ModelAnchor } from "@/lib/engine/modelAnchor";
import type { G2Spec } from "@/components/charts/G2Chart";
import type { VisualizationColumn, VisualizationKind } from "@/components/charts/SemanticVisualization";

// Concept D state (severity / cell overrides) — when passed, deliverable
// figures recompute on the edited model.
export interface ModelInputs {
  severity?: number;
  overrides?: Overrides;
  // Live CP-1 LTM anchor (useModelEngine → cp1ToAnchor). When present, the model's
  // LTM/PF columns re-base on the engine's reported figures — so the snapshot
  // panels (cap structure, seniority stack, financials, EBITDA adjustments) show
  // live numbers with model.provenance.anchored set. Absent → seeded fallback.
  anchor?: ModelAnchor;
  assumptions?: Assumptions;
}

/* ---------- section DSL ---------- */

export interface TableRow {
  cells: (string | number)[];
  cellColors?: (string | undefined)[];
  b?: 1;
  it?: 1;
  line?: 1;
  gap?: 1;
  lbl0?: string;
}

export interface TableColumnGroup {
  /** Zero-based index in `cols` where this stable model period group begins. */
  start: number;
  key: "Q" | "YTD" | "HIST" | "LTM" | "PF" | "BASE" | "DOWN";
  label: string;
}

export type Section = (
  | { t: "table"; title?: string; sub?: string; cols: string[]; align: number[]; rows: TableRow[]; note?: string; columnGroups?: TableColumnGroup[] }
  | { t: "profile"; title?: string; rows: [string, string][]; boldLast?: 1 }
  | { t: "text"; title?: string; subhead?: string; body: string; label?: string; labelBody?: string; placeholder?: string; fieldId?: string }
  | { t: "list"; title?: string; subhead?: string; items: string[] }
  | { t: "chart"; title: string; sub?: string; h?: number; note?: string; kind: VisualizationKind; unit?: string; sourceIds: string[]; accessibleSummary: string; columns: VisualizationColumn[]; spec: G2Spec; showValueLabels?: boolean; valueLabelKey?: string; equivalentTable?: "period-columns" }
  | { t: "cols"; title?: string; w?: number[]; items: Section[][] }
) & { page?: string };

export interface ReportSource {
  chip: string;
  ev: string[];
}

export interface Report {
  id: string;
  title: string;
  file: string;
  subtitle: string;
  icon: string;
  watermark?: string;
  srcs: ReportSource[];
  sections: Section[];
}

/* ---------- formatting ---------- */
export const fm = (v: number | null | undefined): string => {
  // Number.isFinite (not just isNaN): a divide-by-zero Infinity must render
  // blank in the committee paper, exactly as model-format's fmt() renders it
  // blank in the grid — not "∞"/"Infinity%". (#R1)
  if (v == null || !Number.isFinite(v)) return "";
  const r = Math.round(v);
  if (r === 0) return "–";
  const s = Math.abs(r).toLocaleString("en-US");
  return r < 0 ? "(" + s + ")" : s;
};
const fp = (v: number | null | undefined): string => (v == null || !Number.isFinite(v) ? "" : (v * 100).toFixed(1) + "%");
export const fx = (v: number | null | undefined): string => (v == null || !Number.isFinite(v) ? "" : v.toFixed(2) + "x");

function seniorityStackChart(
  rcf: number,
  tlb: number,
  ssn: number,
  sub: number,
  equity: number,
  page?: string,
): Section {
  const total = rcf + tlb + ssn + sub + equity;
  const isThin = (value: number) => total > 0 && value / total < 0.18;
  const thinRows = ([
    ["RCF", rcf], ["1L TLB", tlb], ["2L TL '31", ssn], ["Sub Notes '32", sub], ["Implied equity", equity],
  ] as Array<[string, number]>).filter(([, value]) => isThin(value));
  return {
    ...(page ? { page } : {}),
    ...(thinRows.length ? { note: `Unlabeled thin tranches: ${thinRows.map(([label, value]) => `${label} $${value.toLocaleString()}M`).join(" · ")}` } : {}),
    t: "chart",
    kind: "stacked-bar",
    title: "SENIORITY STACK — CLAIMS INCL. IMPLIED EQUITY",
    unit: "$M",
    sourceIds: ["CP-3B:T3B.2", "E-63"],
    accessibleSummary: `The stack comprises $${rcf}M RCF, $${tlb}M first-lien term loan, $${ssn}M second-lien term loan, $${sub}M subordinated notes, and $${equity}M implied equity.`,
    columns: [{ key: "cls", label: "Claim" }, { key: "v", label: "$M" }],
    h: 52,
    spec: {
      type: "interval",
      data: [
        { slot: "stack", cls: "RCF (drawn)", v: rcf },
        { slot: "stack", cls: "1L Term Loan B", v: tlb },
        { slot: "stack", cls: "2L TL '31 (subject)", v: ssn },
        { slot: "stack", cls: "Sub Notes '32", v: sub },
        { slot: "stack", cls: "Implied equity @ 9.5x", v: equity },
      ],
      encode: { x: "slot", y: "v", color: "cls" },
      transform: [{ type: "stackY" }],
      coordinate: { transform: [{ type: "transpose" }] },
      axis: false,
      legend: false,
      scale: {
        color: {
          domain: ["RCF (drawn)", "1L Term Loan B", "2L TL '31 (subject)", "Sub Notes '32", "Implied equity @ 9.5x"],
          range: ["#0f766e", "#0d9488", "#2563eb", "#7c3aed", "#94a3b8"],
        },
      },
      labels: [{
        text: (datum: { cls: string; v: number }) => (isThin(datum.v) ? "" : datum.cls.split(" ")[0] + " " + datum.v.toLocaleString()),
        position: "inside",
        fontSize: 10,
        fontWeight: 600,
        transform: [{ type: "contrastReverse" }, { type: "overflowHide" }, { type: "overlapHide" }],
      }],
    },
  };
}


const APPENDIX_PCT_BLUE = "#2f64b7";
const MODEL_GROUP_LABELS: Record<TableColumnGroup["key"], string> = {
  Q: "Quarterly",
  YTD: "YTD",
  HIST: "Historic",
  LTM: "LTM",
  PF: "Pro forma",
  BASE: "Base",
  DOWN: "Downside",
};

function modelTableGroups(columns: Model["columns"]): TableColumnGroup[] {
  const groups: TableColumnGroup[] = [];
  columns.forEach((column, index) => {
    if (index === 0 || columns[index - 1].group !== column.group) {
      groups.push({ start: index + 1, key: column.group, label: MODEL_GROUP_LABELS[column.group] });
    }
  });
  return groups;
}

/* ---------- financials grid (FY22…LTM, template layout) ---------- */

const FIN_KEYS = ["f22", "f23", "f24", "f25", "y0", "y1", "l1"] as const;
const FIN_LBL = ["FY22", "FY23", "FY24", "FY25", "PYTD", "YTD", "LTM"];
const PRIOR: Record<string, string> = { f23: "f22", f24: "f23", f25: "f24", y1: "y0" };

function finSections(model: Model): Section[] {
  const columns = FIN_KEYS.map((key) => model.cols[key]);
  const row = (label: string, read: (column: ModelCol) => number | null, format: (value: number | null) => string, options?: Partial<TableRow>): TableRow =>
    ({ cells: [label, ...columns.map((column) => format(read(column)))], ...options });
  const growth = (read: (column: ModelCol) => number): (string | number)[] =>
    ["", ...FIN_KEYS.map((key) => {
      const prior = PRIOR[key];
      return prior ? fp(read(model.cols[key]) / read(model.cols[prior]) - 1) : "n.a.";
    })];

  return [
    {
      t: "table", title: "FINANCIALS", sub: "US$ in Mns", cols: ["", ...FIN_LBL], align: [0, 1, 1, 1, 1, 1, 1, 1], rows: [
        row("Revenue", (column) => column.rev, fm, { b: 1 }),
        { cells: growth((column) => column.rev), it: 1, lbl0: "%Δ" },
        row("Gross Profit", (column) => column.gp, fm, { b: 1, gap: 1 }),
        { cells: growth((column) => column.gp), it: 1, lbl0: "%Δ" },
        { ...row("% margin", (column) => column.gpm, fp), it: 1 },
        row("EBITDA (adj.)", (column) => column.adj, fm, { b: 1, gap: 1 }),
        { cells: growth((column) => column.adj), it: 1, lbl0: "%Δ" },
        { ...row("% margin", (column) => column.adjm, fp), it: 1 },
        row("Cash Interest", (column) => -column.int, fm, { gap: 1 }),
        row("Leases", (column) => -column.leases, fm),
        row("Cash tax", (column) => -column.tax, fm),
        row("Other", (column) => -column.oth, fm, { line: 1 }),
        row("FFO", (column) => column.ffo, fm, { b: 1 }),
        row("WC", (column) => column.wc, fm, { line: 1 }),
        row("CFO", (column) => column.cfo, fm, { b: 1 }),
        row("Capex", (column) => -column.capex, fm, { line: 1 }),
        row("FCF", (column) => column.fcf, fm, { b: 1 }),
        row("M&A", (column) => column.acq, fm),
        row("Δ in debt", (column) => column.diss, fm),
        row("Dividends", (column) => column.div, fm),
        row("Other", (column) => column.othf, fm, { line: 1 }),
        row("Net Δ in cash", (column) => column.ncf, fm, { b: 1 }),
      ],
    },
    {
      t: "table", title: "BALANCE SHEET", cols: ["", ...FIN_LBL], align: [0, 1, 1, 1, 1, 1, 1, 1], rows: [
        row("Cash", (column) => column.cash, fm),
        row("Senior debt", (column) => column.secured, fm),
        row("Total debt", (column) => column.tdebt, fm),
        row("Net debt", (column) => column.ndebt, fm, { b: 1 }),
      ],
    },
    {
      t: "table", title: "CREDIT METRICS", cols: ["", ...FIN_LBL], align: [0, 1, 1, 1, 1, 1, 1, 1], rows: [
        row("Senior Leverage", (column) => column.srsec, fx),
        row("Total Leverage", (column) => column.totlev, fx),
        row("Net Leverage", (column) => column.netlev, fx, { b: 1 }),
        row("Interest Cover", (column) => column.intcov, fx),
      ],
    },
  ];
}

// Canonical ATLF capital structure (CP-3B dashboard, step-outputs.ts) — the
// authoritative tranche set this committee snapshot must tie to. Was seeded ad hoc
// (rcf 55 / sub 200 / model tlb ~1,420 → total 2,575), contradicting the CP-3B
// total of 3,270 under the same facility names. (review run-2 #F2)
function getCapitalStructure(model: Model) {
  const l1 = model.cols.l1;
  const reported = l1.ebitda, addbacks = l1.ab, adj = l1.adj;
  const structEbitda = adj - 35;
  const rcf = 120, tlb = 1850, ssn = 900, sub = 400;
  const secured = rcf + tlb + ssn, tdebt = secured + sub, cash = Math.round(l1.cash);
  const ev = Math.round(9.5 * structEbitda), equity = ev - tdebt;
  const xm = (d: number) => { const m = d / structEbitda; return Number.isFinite(m) ? m.toFixed(2) + "x" : ""; };
  const pev = (d: number) => { const p = (d / ev) * 100; return Number.isFinite(p) ? p.toFixed(0) + "%" : ""; };
  const pfInt = Math.round(l1.int);
  return { reported, addbacks, adj, structEbitda, rcf, tlb, ssn, sub, secured, tdebt, cash, ev, equity, xm, pev, pfInt };
}

type CapitalStructure = ReturnType<typeof getCapitalStructure>;

const APPENDIX_SUBTOTAL_LINES = new Set(["gp", "ebit", "ffo", "cfo"]);
const APPENDIX_KPI_GROUP_LINES = new Set(["intcov", "sga", "dso", "taxr"]);

function modelAppendixTable(model: Model, columns: Model["columns"]) {
  const appendixPctColor = (v: number | null, rowId: string, bold: boolean, rowFmt?: string): string =>
    cellTextColor({ rowId, v, isOv: false, pct: true, bold, rowFmt }).replace("var(--caos-accent)", APPENDIX_PCT_BLUE);
  const labelFor = (key: string) => {
    const cell = model.cols[key];
    const column = model.columns.find((candidate) => candidate.key === key);
    if (!column) return cell.label;
    return column.group === "Q" ? `Q ${cell.label}` : `${column.group} ${cell.label}`;
  };
  const cols = ["Line", ...columns.map((column) => labelFor(column.key))];
  const rows: TableRow[] = ROWS.map((row) => row.sec
    ? { cells: [row.sec, ...columns.map(() => "")], b: 1, line: 1, gap: 1 }
    : (() => {
        const values = columns.map((column) => row.g?.(model.cols[column.key]) ?? null);
        return {
          cells: [row.sub ? `${row.l} (${row.sub})` : row.l || "", ...values.map((value) => fmt(value, row.f))],
          cellColors: row.pct && row.id ? [undefined, ...values.map((value) => appendixPctColor(value, row.id!, !!row.bold, row.f))] : undefined,
          b: row.bold,
          line: row.line || (row.id && (APPENDIX_SUBTOTAL_LINES.has(row.id) || APPENDIX_KPI_GROUP_LINES.has(row.id)) ? 1 : undefined),
          gap: row.line || (row.id && APPENDIX_KPI_GROUP_LINES.has(row.id) ? 1 : undefined),
        };
      })());
  return { cols, rows };
}

function modelAppendix(model: Model, currency = "USD"): Report {
  const { cols, rows } = modelAppendixTable(model, model.columns);
  const inputBasis = model.provenance.anchored
    ? "Persisted CP-1 anchor applied · freshness governed upstream"
    : "REFERENCE inputs · seeded example, not issuer data";
  return {
    id: "model",
    title: "Model Appendix",
    file: "ATLF_Model_Appendix.pdf",
    subtitle: `Atlas Forge Industrials (ATLF) · full M-118 model · ${currency} in Mns`,
    icon: "▦",
    srcs: [{ chip: "MODEL", ev: ["E-103"] }],
    sections: [
      { t: "profile", title: "MODEL CONTROL COVER", rows: [
        ["Model / as-of", "M-118 · Mar-26 LTM · FY26e–FY28e scenarios"],
        ["Input basis", inputBasis],
        ["Calculation state", "Output available · structural tie-outs retained"],
        ["Approval state", "CONDITIONAL · QA-117 evidence re-anchor remains open"],
        ["Change history", "Not present in this builder payload · inspect Model History before approval"],
        ["Authority", "Appendix supports review; it does not itself approve or publish the conclusion"],
      ] },
      { t: "list", title: "KNOWN REVIEW LIMITATIONS", items: [
        "Claim-level source coverage is not computed in this appendix; E-103 identifies the registered model evidence only.",
        "Manual override author, timestamp, and prior value are not present in this rendered payload.",
        "Open QA-117 affects relative-value evidence E-44, not the arithmetic of M-118; committee publication remains held.",
      ] },
      { t: "table", title: "FULL MODEL", sub: `${currency} in Mns except ratios`, cols, align: cols.map((_, i) => i === 0 ? 0 : 1), rows, columnGroups: modelTableGroups(model.columns) },
    ],
  };
}


function onReportPage(section: Section, page?: string): Section {
  return page ? { ...section, page } : section;
}

function companySummarySections(
  page?: string,
  options: { snapshotRecommendationMethodology?: boolean } = {},
): Section[] {
  const recommendationRows: [string, string][] = options.snapshotRecommendationMethodology
    ? [
        ["Analyst", "CAOS · RUN #2641"], ["Date", "Jun 10, 2026"],
        ["COAS Recommendation", "OVERWEIGHT — 75bps initial → 125bps max (CP-6E)"], ["Entry", "+388bps or wider · limit at +400"],
        ["CLO", "3 — MW"], ["Indexed Loans", "3 — MW"],
        ["Index HY", "2 — Modest OW"], ["Clearance", "CP-5 CONDITIONAL — QA-117 open"],
      ]
    : [
        ["Analyst", "CAOS · RUN #2641"], ["Date", "Jun 10, 2026"],
        ["Recommendation", "OVERWEIGHT — 75bps initial → 125bps max (CP-6E)"], ["Entry", "+388bps or wider · limit at +400"],
        ["CLO", "Market weight"], ["Indexed Loans", "Market weight"],
        ["Indexed Lev Loan", "Overweight"], ["Clearance", "CP-5 CONDITIONAL — QA-117 open"],
      ];
  return [
    onReportPage({ t: "cols", w: [1, 1], items: [
      [{ t: "profile", title: "COMPANY PROFILE", rows: [
        ["Company", "Atlas Forge Industrials (ATLF)"], ["Sector", "Industrials — engineered metal components"],
        ["Shareholders", "Kestrel Fund V 68.4% · co-invest 22.4% · mgmt 9.2%"], ["Corp Ratings (M/S/F)", "B2 / B / —"],
        ["Country", "United States"], ["Management", "T. Renner (CEO) · M. Okafor (CFO)"],
        ["Sector Outlook", "STABLE — order book 1.06x"], ["Sponsor Quality", "Competent operator · extractive policy (CP-2D)"],
        ["Credit Score", "71 / 100 (CP-3 T3.3)"], ["Credit Direction", "IMPROVING — gated on Q3-26 certificate"],
      ] }],
      [{ t: "profile", title: "RECOMMENDATION", rows: recommendationRows }],
    ] }, page),
    onReportPage({ t: "table", title: "TRANSACTION SUMMARY AND NEW DEBT ISSUES", cols: ["Borrower", "Instrument", "Debt Type", "UoP", "Tranche ($Mn)", "Guidance / IPT", "OID", "Maturity", "Exp. Ratings", "CR Score", "Commit"], align: [0, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0], rows: [
      { cells: ["Atlas Forge Intermediate Holdings", "2L TL '31", "2nd Lien Term Loan", "Refi 2L bridge + GCP", "900", "S+400–425 / IPT S+450", "99.41", "2031", "B3 / B−", "71", "May-26"] },
    ] }, page),
  ];
}

function businessOverviewSection(capital: CapitalStructure, page?: string, adjustmentsTitle = "EBITDA ADJUSTMENTS"): Section {
  const { reported, addbacks, adj, structEbitda } = capital;
  return onReportPage({ t: "cols", w: [3, 2], items: [
    [{ t: "text", title: "BUSINESS DESCRIPTION", body: "Atlas Forge designs and manufactures engineered metal components for industrial OEM platforms across Drivetrain (46% of revenue), Fluid Systems (31%) and Aftermarket & Services (23% of revenue, 44% of gross profit). It operates 14 plants (9 US, 4 EU, 1 MX) and holds a #1–2 position in 7 of 9 core product lines. Operating model: original-equipment programs create the installed base, while replacement parts and contracted service monetize 1.9M installed units at higher recurring margins; aftermarket contracts renew at 92%. Seven-year customer agreements support program duration, and 71% of COGS is pass-through-indexed, although the 60–90 day repricing lag leaves temporary input-cost exposure. Manufacturing requires inventory, receivables and approximately 4% of sales in annual capex, so free cash flow is driven by plant utilization, price-cost timing, working-capital release and aftermarket mix after cash interest. Kestrel Capital Fund V has owned 68.4% since the 2021 LBO ($2,150M EV, 7.9x)." }],
    [{ t: "profile", title: adjustmentsTitle, rows: [
      ["Reported EBITDA (LTM)", fm(reported)], ["Company add-backs", fm(addbacks)],
      ["Adj. EBITDA (company)", fm(adj)], ["Analyst adj. 1 — recurring 'one-time' charges", "(25)"],
      ["Analyst adj. 2 — cost-out phasing risk", "(10)"], ["Analyst adj. 3", "—"],
      ["Structuring EBITDA", fm(structEbitda)],
    ], boldLast: 1 }],
  ] }, page);
}

function capitalStructureSections(capital: CapitalStructure, page?: string): Section[] {
  const { rcf, tlb, ssn, sub, secured, tdebt, cash, ev, equity, xm, pev, pfInt, structEbitda } = capital;
  return [
    onReportPage({ t: "table", title: "CAPITAL STRUCTURE", cols: ["Facility", "Spread / Coupon", "CCY", "Maturity", "Bid", "Ask", "Outstanding ($Mn)", "Multiple", "% EV", "Recommendation"], align: [0, 1, 0, 1, 1, 1, 1, 1, 1, 0], rows: [
      { cells: ["RCF $250M (drawn)", "S+350", "USD", "2027", "—", "—", fm(rcf), "", "", "—"] },
      { cells: ["1L Term Loan B", "S+375", "USD", "2029", "99.10", "99.60", fm(tlb), "", "", "HOLD"] },
      { cells: ["2L TL '31 (subject)", "S+425", "USD", "2031", "96.25", "96.75", fm(ssn), "", "", "BUY"] },
      { cells: ["Senior secured debt", "", "", "", "", "", fm(secured), xm(secured), pev(secured), ""], b: 1, line: 1 },
      { cells: ["Sub Notes '32", "10.000%", "USD", "2032", "88.50", "89.80", fm(sub), "", "", "AVOID"] },
      { cells: ["Unsecured / subordinated", "", "", "", "", "", fm(sub), xm(sub), "", ""], b: 1, line: 1 },
      { cells: ["Total debt", "", "", "", "", "", fm(tdebt), xm(tdebt), pev(tdebt), ""], b: 1 },
      { cells: ["Cash", "", "", "", "", "", fm(cash), "", "", ""] },
      { cells: ["(Implied) Equity @ 9.5x", "", "", "", "", "", fm(equity), "", "", ""] },
      { cells: ["EV @ 9.5x structuring EBITDA", "", "", "", "", "", fm(ev), "9.50x", "100%", ""], b: 1, line: 1 },
      { cells: ["PF interest", "", "", "", "", "", fm(pfInt), fx(structEbitda / pfInt), "", ""], it: 1 },
    ] }, page),
    seniorityStackChart(rcf, tlb, ssn, sub, equity, page),
  ];
}


function signedPercent(current: number | null | undefined, prior: number | null | undefined): string {
  if (current == null || prior == null || !Number.isFinite(current) || !Number.isFinite(prior) || prior === 0) return "—";
  if (Math.abs(prior) < 1) return "n.m.";
  const value = (current / prior - 1) * 100;
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}%`;
}

function signedBps(current: number | null | undefined, prior: number | null | undefined): string {
  if (current == null || prior == null || !Number.isFinite(current) || !Number.isFinite(prior)) return "—";
  const value = Math.round((current - prior) * 10_000);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)}bps`;
}

function signedMultiple(current: number | null | undefined, prior: number | null | undefined): string {
  if (current == null || prior == null || !Number.isFinite(current) || !Number.isFinite(prior)) return "—";
  const value = current - prior;
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)}x`;
}

function pctValue(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(1)}%`;
}

function amountValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-US");
}

function earningsVarianceSection(model: Model, page?: string): Section {
  const actual = model.cols.l1;
  // Versioned analyst LTM base saved before the Q1-26 print. These are LTM
  // expectations, not a quarterly estimate multiplied by four.
  const saved = {
    rev: 2_829,
    gp: 750,
    gpm: 0.265,
    adj: 439,
    adjm: 0.155,
    fcf: 72,
    fcfm: 0.025,
    srsec: 4.98,
    totlev: 5.86,
    netlev: 5.43,
    intcov: 2.23,
  };
  return onReportPage({
    t: "table",
    title: "VARIANCE VS SAVED ANALYST MODEL — LTM BASIS",
    cols: ["Metric", "Saved analyst LTM · Mar-26", "Actual LTM · Mar-26", "Δ", "Driver"],
    align: [0, 1, 1, 1, 0],
    rows: [
      { cells: ["Revenue ($M)", amountValue(saved.rev), amountValue(actual.rev), signedPercent(actual.rev, saved.rev), "Fluid Systems volume"] },
      { cells: ["Gross profit ($M)", amountValue(saved.gp), amountValue(actual.gp), signedPercent(actual.gp, saved.gp), "price / mix resilience"] },
      { cells: ["Gross margin", pctValue(saved.gpm), pctValue(actual.gpm), signedBps(actual.gpm, saved.gpm), "input inflation absorbed"] },
      { cells: ["Adj. EBITDA ($M)", amountValue(saved.adj), amountValue(actual.adj), signedPercent(actual.adj, saved.adj), "volume + cost-out phasing"] },
      { cells: ["EBITDA margin", pctValue(saved.adjm), pctValue(actual.adjm), signedBps(actual.adjm, saved.adjm), "fixed-cost absorption"] },
      { cells: ["FCF ($M)", amountValue(saved.fcf), amountValue(actual.fcf), signedPercent(actual.fcf, saved.fcf), "working-capital timing"] },
      { cells: ["FCF margin", pctValue(saved.fcfm), pctValue(actual.fcf / actual.rev), signedBps(actual.fcf / actual.rev, saved.fcfm), "seasonal cash conversion"] },
      { cells: ["Senior leverage", fx(saved.srsec), fx(actual.srsec), signedMultiple(actual.srsec, saved.srsec), "EBITDA below saved base"] },
      { cells: ["Total leverage", fx(saved.totlev), fx(actual.totlev), signedMultiple(actual.totlev, saved.totlev), "EBITDA below saved base"] },
      { cells: ["Net leverage", fx(saved.netlev), fx(actual.netlev), signedMultiple(actual.netlev, saved.netlev), "cash partly offsets miss"] },
      { cells: ["Interest coverage", fx(saved.intcov), fx(actual.intcov), signedMultiple(actual.intcov, saved.intcov), "interest broadly in line"] },
    ],
    note: "Saved analyst model is the versioned LTM base as of Mar-26; it is not a single-quarter estimate.",
  }, page);
}


function catalystCalendarSection(page?: string, title = "CATALYST CALENDAR — NEXT 12 MONTHS"): Section {
  return onReportPage({ t: "table", title, cols: ["Date", "Event", "Prob.", "Impact", "Route"], align: [0, 0, 1, 0, 0], rows: [
    { cells: ["Jul 28, 2026", "Q2-26 earnings + first add-back realization print", "100%", "HIGH", "CP-1B · CP-6A"] },
    { cells: ["Sep 2026", "RCF extension / repricing window opens", "70%", "MED", "CP-3D"] },
    { cells: ["Oct 2026", "Q3-26 compliance certificate (add-back test)", "100%", "HIGH", "CP-1 · T-1"] },
    { cells: ["Q4 2026", "Kestrel Fund V exit-window commentary", "40%", "MED", "CP-2D"] },
    { cells: ["Q2 2027", "Meridian-platform contract repricing", "100%", "HIGH", "CP-2B P1"] },
  ] }, page);
}

function keyProvisionsSection(page?: string): Section {
  return onReportPage({ t: "table", title: "KEY PROVISIONS", cols: ["Provision · doc", "Feature", "Aggressiveness", "Headroom / capacity"], align: [0, 0, 1, 1], rows:
    COVENANTS.slice(0, 6).map((covenant) => ({ cells: [covenant.ref, covenant.name, covenant.agg + " / 10", covenant.headroom] })),
  }, page);
}

function capacityBuildSection(page?: string, title = "CAPACITY BUILD ($M)"): Section {
  return onReportPage({ t: "table", title, cols: ["Component", "Amount", "Basis"], align: [0, 1, 0], rows: [
    { cells: ["Freebie basket", "150", "greater of $150M / 35% × EBITDA"] },
    { cells: ["Ratio capacity", "310", "to 5.25x secured at 4.68x current"] },
    { cells: ["Reclassification headroom", "152", "residual basket migration mechanics"] },
    { cells: ["Total — incurrable pari or senior to 2L", "612", ""], b: 1, line: 1 },
  ] }, page);
}

/* ---------- Credit Snapshot ---------- */
function creditSnapshot(model: Model): Report {
  const capital = getCapitalStructure(model);
  const ltm = model.cols.l1;
  const originalPage = "Page 1: Original Snapshot";
  const decisionPage = "Page 2: Decision View";
  return {
    id: "snapshot", title: "Credit Snapshot", file: "ATLF Credit Snapshot",
    subtitle: "Atlas Forge Industrials (ATLF) · generated from RUN #2641 module outputs · Jun 10, 2026",
    icon: "dashboard",
    srcs: [
      { chip: "CP-1 T4.7", ev: ["E-103"] }, { chip: "CP-1A 06", ev: ["E-12", "E-15"] }, { chip: "CP-1 K-09", ev: ["E-09"] },
      { chip: "CP-3B T3B.2", ev: ["E-63"] }, { chip: "CP-6A 06", ev: ["E-44", "E-87"] }, { chip: "MKT", ev: ["E-71"] }, { chip: "M-118", ev: ["E-103"] },
    ],
    sections: [
      ...companySummarySections(originalPage, { snapshotRecommendationMethodology: true }),
      ...capitalStructureSections(capital, originalPage),
      businessOverviewSection(capital, originalPage),
      onReportPage({
        t: "text",
        title: "INVESTMENT THESIS",
        body: "",
        placeholder: "Write your investment thesis…",
        fieldId: "issuer-investment-thesis",
        label: "Catalysts and near-term events",
        labelBody: "Jul 28 Q2-26 print (first add-back realization read) · Oct-26 Q3-26 compliance certificate (T-1 — thesis-defining) · Sep-26 RCF extension window · Jun-27 MFN sunset · Q2-27 Meridian repricing.",
      }, originalPage),
      onReportPage({ t: "cols", w: [1, 1], items: [
        [
          { t: "text", title: "COAS THESIS", body: "Carry plus deleveraging, not convergence: at +388bps the 2L TL pays +48–63bps over the fair band (+20–25bps ex-E-44) for risks that are monitorable rather than structural. Base case deleverages to ~4.9x by FY27 on realized add-backs alone (sponsor model demoted to upside). The bear case — structural add-backs, $612M priming capacity, sponsor recap record — is real but priced; the IC haircuts base EBITDA by $35M and stages sizing accordingly. Verdict: CONSTRUCTIVE, add on weakness (CP-6A)." },
          { t: "list", title: "CREDIT SUMMARY", subhead: "Strengths", items: [
            "Aftermarket annuity — 44% of gross profit, 92% renewal, 1.9M-unit installed base (E-12)",
            "Genuine FCF and capex-light model — top-quartile conversion vs peers (E-22)",
            "Liquidity — 19.3 months-to-empty; no maturity inside 24 months (E-77)",
          ] },
          { t: "list", subhead: "Weaknesses", items: [
            "EBITDA quality — add-backs 18.2% of adj.; 'one-time' charges recurred 3 of last 4 years (E-09 · E-87)",
            "Documentation — $612M day-one capacity pari/senior to 2L; MFN sunsets Jun-27 (E-63 · E-64)",
            "Concentration — top-3 OEMs 38% of revenue; Meridian repricing Q2-27 (E-15)",
          ] },
          { t: "text", subhead: "Historical Performance", body: "Revenue compounded ~6.9% FY22–LTM with adj. margin pinned at 14.9–15.1% through an input-cost spike cycle. Deleveraging from 6.7x to 5.68x came entirely from EBITDA growth — net debt flat at ~$2.4B across four capital-structure events. Q1-26 tracked −4.2% below the sponsor model (Fluid Systems volume); conflict logged, model demoted to upside case." },
        ],
        finSections(model),
      ] }, originalPage),

      { page: decisionPage, t: "profile", title: "DECISION AT A GLANCE", rows: [
        ["Proposed action", "INITIATE — 2L TL '31"],
        ["Entry / posture", "≤ 96.75 / ≥ +380bps · add on weakness"],
        ["Initial / maximum", `${SIZING.initial} / ${SIZING.max}`],
        ["Why now", "Carry clears the hurdle without spread tightening; Jul-26 print is the next evidence point"],
        ["Binding constraint", "B3-or-below bucket 91% utilized · re-test before any add"],
        ["Approval state", "CONDITIONAL · QA-117 must re-anchor E-44 before publication"],
        ["Next decision", "Jul 28 earnings review; formal size gate at the Q3-26 compliance certificate"],
      ] },
      { page: decisionPage, t: "cols", w: [1, 1], items: [
        [
          { t: "list", title: "WHY OWN", items: [
            "Aftermarket contributes 44% of gross profit with 92% renewal and a 1.9M-unit installed base (E-12 · E-31).",
            `LTM adjusted EBITDA is $${amountValue(ltm.adj)}M and net leverage is ${fx(ltm.netlev)}; base deleveraging does not require multiple expansion (E-103).`,
            "At +388bps the instrument retains 20–25bps of excess spread after removing contested evidence E-44 (E-71).",
          ] },
          { t: "list", title: "WHY SIZE MODESTLY", items: [
            "Add-backs are 18.2% of adjusted EBITDA; the Q3-26 certificate must prove at least $38M of realization (E-09 · E-87 · E-103).",
            "The documents permit $612M of day-one debt pari or senior to the 2L and MFN protection sunsets Jun-27 (E-63 · E-64).",
            "Top-three OEM exposure is 38%; Meridian reprices in Q2-27 and can invalidate the stable-aftermarket thesis (E-15).",
          ] },
        ],
        [
          { t: "profile", title: "LATEST CREDIT FACTS", rows: [
            ["Revenue / adj. EBITDA", `$${amountValue(ltm.rev)}M / $${amountValue(ltm.adj)}M LTM`],
            ["EBITDA / FCF margin", `${pctValue(ltm.adjm)} / ${pctValue(ltm.fcf / ltm.rev)}`],
            ["Senior / total / net leverage", `${fx(ltm.srsec)} / ${fx(ltm.totlev)} / ${fx(ltm.netlev)}`],
            ["Interest coverage", fx(ltm.intcov)],
            ["Debt senior to 2L / 2L claim", `$${amountValue(capital.rcf + capital.tlb)}M / $${amountValue(capital.ssn)}M`],
            ["Liquidity", "19.3 months-to-empty · no maturity inside 24 months (E-77)"],
          ] },
          { t: "text", title: "WHAT WOULD CHANGE THE VIEW", body: "The recommendation fails if the Q3-26 certificate does not substantiate closed-plant savings, if Meridian renewal economics deteriorate by more than 200bps, or if new senior capacity is raised inside the MFN window. Those outcomes require a CP-6A re-vote rather than an editorial update." },
        ],
      ] },
      { page: decisionPage, t: "table", title: "NEXT DECISION POINTS", cols: ["When", "Evidence", "Decision consequence"], align: [0, 0, 0], rows: [
        { cells: ["Jul 28, 2026", "Q2-26 earnings and first realization read", "Hold 75bps or reopen operating case"] },
        { cells: ["Oct 2026", "Q3-26 compliance certificate", "Gate any move toward 125bps"] },
        { cells: ["Jun 2027", "MFN sunset", "Reprice priming protection and recovery"] },
      ] },
    ],
  };
}

/* ---------- Earnings Update ---------- */
function earningsUpdate(model: Model): Report {
  const quarters = model.columns
    .filter((column) => column.group === "Q")
    .map((column) => model.cols[column.key])
    .slice(-8);
  const latest = quarters[quarters.length - 1];
  const priorQuarter = quarters[quarters.length - 2];
  const priorYearQuarter = quarters[quarters.length - 5];
  const priorLtm = model.cols.l0;
  const ltm = model.cols.l1;
  const periodLabel = (column: ModelCol) => `${column.label}${column.derived ? "*" : ""}`;
  const quarterColumns = quarters.map(periodLabel);
  const quarterAlign = [0, ...quarters.map(() => 1), 1];
  const quarterCells = (read: (column: ModelCol) => string) => quarters.map(read);
  const metricDelta = (current: number | null, prior: number | null) => signedMultiple(current, prior);
  const multipleValue = (value: number | null) => fx(value) || "—";

  const operatingMarginChartData = quarters.flatMap((quarter) => [
    { period: periodLabel(quarter), metric: "Gross margin", value: quarter.gpm * 100, display: pctValue(quarter.gpm) },
    { period: periodLabel(quarter), metric: "EBITDA margin", value: quarter.adjm * 100, display: pctValue(quarter.adjm) },
    { period: periodLabel(quarter), metric: "FCF margin", value: (quarter.fcf / quarter.rev) * 100, display: pctValue(quarter.fcf / quarter.rev) },
  ]);
  const leveragePeriods = quarters.filter((quarter) => quarter.srsec != null && quarter.totlev != null && quarter.netlev != null && quarter.intcov != null);
  const leverageChartData = leveragePeriods.flatMap((quarter) => [
    { period: periodLabel(quarter), metric: "Senior leverage", value: quarter.srsec as number, display: fx(quarter.srsec) },
    { period: periodLabel(quarter), metric: "Total leverage", value: quarter.totlev as number, display: fx(quarter.totlev) },
    { period: periodLabel(quarter), metric: "Net leverage", value: quarter.netlev as number, display: fx(quarter.netlev) },
  ]);
  const coverageChartData = leveragePeriods.map((quarter) => (
    { period: periodLabel(quarter), metric: "Interest coverage", value: quarter.intcov as number, display: fx(quarter.intcov) }
  ));

  return {
    id: "earnings", title: "Earnings Update — Q1-26", file: "ATLF Earnings Update Q1-26",
    subtitle: "Atlas Forge Industrials (ATLF) · CP-1B monitoring output · print date Jun 10, 2026",
    icon: "trend",
    srcs: [{ chip: "CP-1B T6", ev: ["E-58"] }, { chip: "CP-1 T4.7", ev: ["E-103"] }],
    sections: [
      { t: "profile", title: "PRINT SUMMARY", rows: [
        ["Issuer / period", "Atlas Forge Industrials — Q1 FY26 (Mar-26)"],
        ["Headline", "In line — trajectory intact, sponsor model runs hot"],
        ["Thesis impact", "NEUTRAL-POSITIVE · no trigger trips"],
        ["Next checkpoint", "Jul 28 — Q2-26 print, first add-back realization read"],
      ] },
      { t: "table", title: "OPERATING PRINT — QUARTER AND LTM", cols: ["Metric", "Q1-26", "QoQ", "YoY", "LTM Mar-26", "LTM YoY"], align: [0, 1, 1, 1, 1, 1], rows: [
        { cells: ["Revenue ($M)", amountValue(latest.rev), signedPercent(latest.rev, priorQuarter.rev), signedPercent(latest.rev, priorYearQuarter.rev), amountValue(ltm.rev), signedPercent(ltm.rev, priorLtm.rev)] },
        { cells: ["Gross profit ($M)", amountValue(latest.gp), signedPercent(latest.gp, priorQuarter.gp), signedPercent(latest.gp, priorYearQuarter.gp), amountValue(ltm.gp), signedPercent(ltm.gp, priorLtm.gp)] },
        { cells: ["Gross margin", pctValue(latest.gpm), signedBps(latest.gpm, priorQuarter.gpm), signedBps(latest.gpm, priorYearQuarter.gpm), pctValue(ltm.gpm), signedBps(ltm.gpm, priorLtm.gpm)] },
        { cells: ["Adj. EBITDA ($M)", amountValue(latest.adj), signedPercent(latest.adj, priorQuarter.adj), signedPercent(latest.adj, priorYearQuarter.adj), amountValue(ltm.adj), signedPercent(ltm.adj, priorLtm.adj)] },
        { cells: ["EBITDA margin", pctValue(latest.adjm), signedBps(latest.adjm, priorQuarter.adjm), signedBps(latest.adjm, priorYearQuarter.adjm), pctValue(ltm.adjm), signedBps(ltm.adjm, priorLtm.adjm)] },
        { cells: ["FCF ($M)", amountValue(latest.fcf), signedPercent(latest.fcf, priorQuarter.fcf), signedPercent(latest.fcf, priorYearQuarter.fcf), amountValue(ltm.fcf), signedPercent(ltm.fcf, priorLtm.fcf)] },
        { cells: ["FCF margin", pctValue(latest.fcf / latest.rev), signedBps(latest.fcf / latest.rev, priorQuarter.fcf / priorQuarter.rev), signedBps(latest.fcf / latest.rev, priorYearQuarter.fcf / priorYearQuarter.rev), pctValue(ltm.fcf / ltm.rev), signedBps(ltm.fcf / ltm.rev, priorLtm.fcf / priorLtm.rev)] },
      ] },
      { t: "table", title: "CREDIT METRICS — ROLLING-LTM BASIS ONLY", cols: ["Metric", "Mar-26 rolling LTM", "QoQ Δ", "YoY Δ", "Saved analyst LTM", "Vs saved"], align: [0, 1, 1, 1, 1, 1], rows: [
        { cells: ["Senior leverage", multipleValue(ltm.srsec), metricDelta(ltm.srsec, priorQuarter.srsec), metricDelta(ltm.srsec, priorYearQuarter.srsec), "4.98x", signedMultiple(ltm.srsec, 4.98)] },
        { cells: ["Total leverage", multipleValue(ltm.totlev), metricDelta(ltm.totlev, priorQuarter.totlev), metricDelta(ltm.totlev, priorYearQuarter.totlev), "5.86x", signedMultiple(ltm.totlev, 5.86)] },
        { cells: ["Net leverage", multipleValue(ltm.netlev), metricDelta(ltm.netlev, priorQuarter.netlev), metricDelta(ltm.netlev, priorYearQuarter.netlev), "5.43x", signedMultiple(ltm.netlev, 5.43)] },
        { cells: ["Interest coverage", multipleValue(ltm.intcov), metricDelta(ltm.intcov, priorQuarter.intcov), metricDelta(ltm.intcov, priorYearQuarter.intcov), "2.23x", signedMultiple(ltm.intcov, 2.23)] },
      ], note: "All four metrics use rolling-LTM EBITDA or interest. No quarterly leverage basis is presented." },
      { t: "table", title: "KPI DASHBOARD — EIGHT QUARTERS + LTM", cols: ["Metric", ...quarterColumns, "LTM Mar-26"], align: quarterAlign, rows: [
        { cells: ["Revenue ($M)", ...quarterCells((quarter) => amountValue(quarter.rev)), amountValue(ltm.rev)] },
        { cells: ["Gross profit ($M)", ...quarterCells((quarter) => amountValue(quarter.gp)), amountValue(ltm.gp)] },
        { cells: ["Gross margin", ...quarterCells((quarter) => pctValue(quarter.gpm)), pctValue(ltm.gpm)] },
        { cells: ["Adj. EBITDA ($M)", ...quarterCells((quarter) => amountValue(quarter.adj)), amountValue(ltm.adj)] },
        { cells: ["EBITDA margin", ...quarterCells((quarter) => pctValue(quarter.adjm)), pctValue(ltm.adjm)] },
        { cells: ["FCF ($M)", ...quarterCells((quarter) => amountValue(quarter.fcf)), amountValue(ltm.fcf)] },
        { cells: ["FCF margin", ...quarterCells((quarter) => pctValue(quarter.fcf / quarter.rev)), pctValue(ltm.fcf / ltm.rev)] },
        { cells: ["Senior leverage", ...quarterCells((quarter) => multipleValue(quarter.srsec)), multipleValue(ltm.srsec)] },
        { cells: ["Total leverage", ...quarterCells((quarter) => multipleValue(quarter.totlev)), multipleValue(ltm.totlev)] },
        { cells: ["Net leverage", ...quarterCells((quarter) => multipleValue(quarter.netlev)), multipleValue(ltm.netlev)] },
        { cells: ["Interest coverage", ...quarterCells((quarter) => multipleValue(quarter.intcov)), multipleValue(ltm.intcov)] },
      ], note: "* Dec-25 is a derived period (management accounts gap G-02). Rolling-LTM leverage and coverage begin in Dec-24 after four normalized quarters; earlier values are unavailable, not backfilled." },
      { t: "chart", kind: "line", title: "MARGIN TRAJECTORY — EIGHT QUARTERS", unit: "%", sourceIds: ["CP-1B:T6", "E-58", "G-02"], accessibleSummary: `Gross margin, EBITDA margin, and FCF margin are shown across the eight available quarters from ${periodLabel(quarters[0])} through ${periodLabel(latest)}. Dec-25 is derived.`, columns: [{ key: "period", label: "Metric / period" }, { key: "metric", label: "Margin" }, { key: "value", label: "%" }], h: 184, showValueLabels: true, valueLabelKey: "display", equivalentTable: "period-columns", spec: {
        type: "line",
        data: operatingMarginChartData,
        encode: { x: "period", y: "value", color: "metric" },
        scale: { color: { domain: ["Gross margin", "EBITDA margin", "FCF margin"], range: ["#16161e", "#b45309", "#0f766e"] } },
        axis: { x: { title: false }, y: { title: false } },
        legend: { color: { position: "top" } },
      } },
      { t: "cols", w: [3, 2], items: [
        [{ t: "chart", kind: "line", title: "LEVERAGE — ROLLING LTM", unit: "x", sourceIds: ["CP-1:T4.7", "E-103"], accessibleSummary: `Six rolling-LTM periods are available from ${periodLabel(leveragePeriods[0])} to ${periodLabel(leveragePeriods[leveragePeriods.length - 1])}. Net leverage improves from ${fx(leveragePeriods[0].netlev)} to ${fx(latest.netlev)}.`, columns: [{ key: "period", label: "Metric / period" }, { key: "metric", label: "Leverage" }, { key: "value", label: "x" }], h: 210, note: "Six periods only; earlier rolling-LTM values are unavailable and are not synthesized.", showValueLabels: true, valueLabelKey: "display", equivalentTable: "period-columns", spec: {
          type: "line",
          data: leverageChartData,
          encode: { x: "period", y: "value", color: "metric" },
          scale: { color: { domain: ["Senior leverage", "Total leverage", "Net leverage"], range: ["#0f766e", "#2563eb", "#b45309"] } },
          axis: { x: { title: false }, y: { title: false } },
          legend: { color: { position: "top" } },
        } }],
        [{ t: "chart", kind: "line", title: "INTEREST COVERAGE — ROLLING LTM", unit: "x", sourceIds: ["CP-1:T4.7", "E-103"], accessibleSummary: `Interest coverage improves from ${fx(leveragePeriods[0].intcov)} to ${fx(latest.intcov)} across the six available rolling-LTM periods.`, columns: [{ key: "period", label: "Period" }, { key: "metric", label: "Metric" }, { key: "value", label: "x" }], h: 210, showValueLabels: true, valueLabelKey: "display", equivalentTable: "period-columns", spec: {
          type: "line",
          data: coverageChartData,
          encode: { x: "period", y: "value", color: "metric" },
          scale: { color: { domain: ["Interest coverage"], range: ["#7c3aed"] } },
          axis: { x: { title: false }, y: { title: false } },
          legend: false,
        } }],
      ] },
      earningsVarianceSection(model),
      { t: "text", title: "OVERALL EARNINGS VIEW", body: `Earnings trajectory intact: ${signedPercent(ltm.adj, priorLtm.adj)} LTM EBITDA growth, gross margin ${signedBps(ltm.gpm, priorLtm.gpm)} YoY, and FCF of $${amountValue(ltm.fcf)}M at a ${pctValue(ltm.fcf / ltm.rev)} margin. Net leverage improved ${signedMultiple(ltm.netlev, priorLtm.netlev)} to ${fx(ltm.netlev)}. The saved analyst LTM base runs hot; conflict is logged to CP-5 and the model remains an upside case. CP-1 normalized actuals remain the base for downstream work.` },
      { t: "table", title: "WATCH ITEMS → NEXT PRINT (JUL 28)", cols: ["Item", "Threshold", "Routed to"], align: [0, 0, 0], rows: [
        { cells: ["Add-back realization (first print)", "< $30M run-rate → T-1 trips", "CP-6A re-vote"] },
        { cells: ["Fluid Systems volume", "second consecutive miss", "CP-2B P1 refresh"] },
        { cells: ["Book-to-bill", "< 0.95x", "CP-2B flag"] },
      ] },
    ],
  };
}

/* ---------- IC Credit Memo ---------- */
function compactIcModelSection(model: Model, page: string): Section {
  const definitions = [
    { key: "f22", label: "FY22A" },
    { key: "f23", label: "FY23A" },
    { key: "f24", label: "FY24A" },
    { key: "f25", label: "FY25A" },
    { key: "l1", label: "LTM Mar-26A" },
    { key: "b0", label: "FY26e Base" },
    { key: "b1", label: "FY27e Base" },
    { key: "b2", label: "FY28e Base" },
    { key: "d0", label: "FY26e Down" },
    { key: "d1", label: "FY27e Down" },
    { key: "d2", label: "FY28e Down" },
  ] as const;
  const columns = definitions.map((definition) => model.cols[definition.key]);
  const row = (label: string, read: (column: ModelCol) => string, options?: Partial<TableRow>): TableRow =>
    ({ cells: [label, ...columns.map(read)], ...options });
  const multiple = (value: number | null) => fx(value) || "—";
  return {
    page,
    t: "table",
    title: "COMPACT IC MODEL — HISTORICAL, LATEST LTM, BASE AND DOWNSIDE",
    sub: "USD in Mns except margins and ratios",
    cols: ["Line", ...definitions.map((definition) => definition.label)],
    align: definitions.map(() => 1).concat(1).map((_, index) => index === 0 ? 0 : 1),
    columnGroups: [
      { start: 1, key: "HIST", label: "Historic" },
      { start: 5, key: "LTM", label: "Latest LTM" },
      { start: 6, key: "BASE", label: "Base case" },
      { start: 9, key: "DOWN", label: "Downside case" },
    ],
    rows: [
      row("Revenue", (column) => amountValue(column.rev), { b: 1 }),
      row("Gross profit", (column) => amountValue(column.gp), { gap: 1 }),
      row("Gross margin", (column) => pctValue(column.gpm)),
      row("Reported EBITDA", (column) => amountValue(column.ebitda), { gap: 1 }),
      row("Add-backs", (column) => amountValue(column.ab)),
      row("Adjusted EBITDA", (column) => amountValue(column.adj), { b: 1, line: 1 }),
      row("EBITDA margin", (column) => pctValue(column.adjm)),
      row("Cash interest", (column) => amountValue(column.int), { gap: 1 }),
      row("Free cash flow", (column) => amountValue(column.fcf), { b: 1 }),
      row("FCF margin", (column) => pctValue(column.fcf / column.rev)),
      row("Cash", (column) => amountValue(column.cash), { gap: 1 }),
      row("Total debt", (column) => amountValue(column.tdebt)),
      row("Net debt", (column) => amountValue(column.ndebt), { b: 1, line: 1 }),
      row("Senior leverage", (column) => multiple(column.srsec), { gap: 1 }),
      row("Total leverage", (column) => multiple(column.totlev)),
      row("Net leverage", (column) => multiple(column.netlev), { b: 1 }),
      row("Interest coverage", (column) => multiple(column.intcov)),
    ],
    note: `${model.provenance.anchored ? "Latest LTM is grounded in the persisted CP-1 anchor" : "REFERENCE build: latest LTM and scenarios use seeded example inputs"}. Historical columns are actual (A); base and downside columns are estimates (e). Full calculations, quarterly detail and override history remain in Model Appendix.`,
  };
}

function creditMemo(model: Model): Report {
  const capital = getCapitalStructure(model);
  const ltm = model.cols.l1;
  const base = model.cols.b1;
  const downside = model.cols.d0;
  const w = DEBATE.weighting;
  const bullCase = DEBATE.rounds
    .filter((round) => round.who === "BULL")
    .flatMap((round) => round.points)
    .map((point) => `${point.text}${point.ev.length ? ` (${point.ev.join(" · ")})` : ""}`);
  const bearCase = DEBATE.rounds
    .filter((round) => round.who === "BEAR")
    .flatMap((round) => round.points)
    .map((point) => `${point.text}${point.ev.length ? ` (${point.ev.join(" · ")})` : ""}`);
  const recoveryData = RECOVERY.flatMap((scenario) => {
    const rates = recoveryRates(scenario.ev);
    return [
      { scenario: scenario.scen, tranche: "1L", recovery: rates.firstLien, display: `${rates.firstLien.toFixed(0)}%` },
      { scenario: scenario.scen, tranche: "2L TL", recovery: rates.secondLien, display: `${rates.secondLien.toFixed(0)}%` },
      { scenario: scenario.scen, tranche: "Sub", recovery: rates.subordinated, display: `${rates.subordinated.toFixed(0)}%` },
    ];
  });

  return {
    id: "memo", title: "IC Credit Memo", file: "ATLF IC Credit Memo",
    subtitle: "Atlas Forge Industrials (ATLF) · consolidated Deep-Dive and compact model · HELD pending QA-117",
    icon: "gavel", watermark: "CONDITIONAL — QA-117 OPEN",
    srcs: [
      { chip: "CP-6A", ev: ["E-09", "E-12", "E-15", "E-22", "E-31", "E-87", "E-103"] },
      { chip: "CP-6E", ev: ["E-44", "E-71"] },
      { chip: "CP-4C", ev: ["E-63", "E-64"] },
      { chip: "CP-2E", ev: ["E-77"] },
      { chip: "CP-1B", ev: ["E-58"] },
    ],
    sections: [
      { page: "Page 1: Decision", t: "profile", title: "DECISION REQUEST", rows: [
        ["Requested authority", "INITIATE — 2L TL '31"],
        ["Entry", SIZING.entry],
        ["Initial / maximum", `${SIZING.initial} / ${SIZING.max}`],
        ["IC posture", DEBATE.bias],
        ["Why now", "Carry clears the hurdle without spread tightening; the Jul-26 print is the first realization checkpoint"],
        ["Binding constraint", "B3-or-below bucket 91% utilized · max size requires same-day headroom"],
        ["Clearance", "CONDITIONAL · QA-117 must re-anchor E-44 before publication"],
      ] },
      { page: "Page 1: Decision", t: "text", title: "CHAIR RATIONALE", body: DEBATE.memo },
      { page: "Page 1: Decision", t: "cols", w: [1, 1], items: [
        [{ t: "list", title: "CASE TO OWN", items: [
          "Aftermarket durability is the strongest evidenced claim: 44% of gross profit, 92% renewal, 1.9M installed units (E-12 · E-31).",
          `LTM EBITDA is $${amountValue(ltm.adj)}M and net leverage is ${fx(ltm.netlev)}; base FY27e net leverage falls to ${fx(base.netlev)} without multiple expansion (E-103).`,
          "The 2L retains 20–25bps of excess spread on the ex-E-44 fair-value band; convergence is upside, not the underwriting case (E-71).",
        ] }],
        [{ t: "list", title: "CASE TO LIMIT SIZE", items: [
          "EBITDA add-backs are 18.2% of adjusted EBITDA and recurrent charges weaken the sponsor presentation (E-09 · E-87).",
          "Day-one capacity permits $612M pari or senior to the 2L; MFN protection sunsets Jun-27 (E-63 · E-64).",
          "The B3 bucket, Meridian renewal and open QA-117 make sizing—not exclusion—the correct control.",
        ] }],
      ] },
      { page: "Page 1: Decision", t: "table", title: "APPROVAL CONDITIONS", cols: ["Authority", "Condition", "If unmet"], align: [0, 0, 0], rows: [
        { cells: ["Publish committee decision", "QA-117 resolves and E-44 is re-anchored or removed", "Remain held; do not imply RV confirmation"] },
        { cells: ["Initiate 75bps", "Price ≤ 96.75 / spread ≥ +380bps and no new adverse information", "No trade"] },
        { cells: ["Increase toward 125bps", "Q3-26 certificate ≥ $38M realization plus same-day B3-bucket headroom", "Retain 75bps and re-vote"] },
        { cells: ["Maintain thesis", "Meridian concession ≤ 200bps and no >$200M priming raise in MFN window", "CP-6A re-vote"] },
      ] },

      ...companySummarySections("Page 2: Business & Earnings"),
      businessOverviewSection(capital, "Page 2: Business & Earnings", "EBITDA ADJUSTMENTS — ANALYST HAIRCUT"),
      { page: "Page 2: Business & Earnings", t: "cols", w: [1, 1], items: [
        [
          { t: "list", title: "CREDIT STRENGTHS", items: [
            "Aftermarket annuity — 44% of gross profit, 92% renewal, 1.9M-unit installed base (E-12 · E-31).",
            "Genuine FCF and capex-light model — top-quartile conversion versus peers (E-22).",
            "Liquidity — 19.3 months-to-empty; no maturity inside 24 months (E-77).",
          ] },
        ],
        [
          { t: "list", title: "CREDIT WEAKNESSES", items: [
            "EBITDA quality — add-backs are 18.2% of adjusted EBITDA and recurring charges weaken the sponsor presentation (E-09 · E-87).",
            "Documentation — $612M day-one capacity can rank pari or senior to the 2L; MFN sunsets Jun-27 (E-63 · E-64).",
            "Concentration — top-three OEMs are 38% of revenue; Meridian reprices in Q2-27 (E-15).",
          ] },
        ],
      ] },
      { page: "Page 2: Business & Earnings", t: "profile", title: "EARNINGS ASSESSMENT", rows: [
        ["Period", "Q1 FY26 / LTM Mar-26"],
        ["Headline", "In line — trajectory intact; saved analyst LTM model remains high"],
        ["LTM adjusted EBITDA", `$${amountValue(ltm.adj)}M · ${signedPercent(ltm.adj, model.cols.l0.adj)} YoY`],
        ["Gross margin", `${pctValue(ltm.gpm)} · ${signedBps(ltm.gpm, model.cols.l0.gpm)} YoY`],
        ["Net leverage", `${fx(ltm.netlev)} · ${signedMultiple(ltm.netlev, model.cols.l0.netlev)} YoY`],
        ["Thesis impact", "NEUTRAL-POSITIVE · operating print does not resolve documentation or QA risk"],
      ] },
      earningsVarianceSection(model, "Page 2: Business & Earnings"),

      { page: "Page 3: Risk & Challenge", t: "text", title: "PRE-DEBATE THESIS MAP", body: DEBATE.thesis },
      { page: "Page 3: Risk & Challenge", t: "cols", w: [1, 1], items: [
        [{ t: "list", title: "BULL CASE — EVIDENCED", items: bullCase }],
        [{ t: "list", title: "BEAR CASE — EVIDENCED", items: bearCase }],
      ] },
      { page: "Page 3: Risk & Challenge", t: "table", title: "CONTESTED CLAIMS — CHAIR RESOLUTION", cols: ["Claim", "Pro", "Con", "Resolution", "Evidence"], align: [0, 1, 1, 0, 0], rows:
        w.map((item) => ({ cells: [item.claim, (item.bull * 100).toFixed(0) + "%", (item.bear * 100).toFixed(0) + "%", item.verdict, item.ev] })),
      },
      { page: "Page 3: Risk & Challenge", t: "text", title: "SINGLE GREATEST UNCERTAINTY", body: DEBATE.uncertainty },
      { page: "Page 3: Risk & Challenge", t: "table", title: "DOWNSIDE READ", cols: ["Case", "Adj. EBITDA", "FCF", "Net leverage", "Interest coverage", "Committee read"], align: [0, 1, 1, 1, 1, 0], rows: [
        { cells: ["LTM Mar-26", amountValue(ltm.adj), amountValue(ltm.fcf), fx(ltm.netlev), fx(ltm.intcov), "Current reference base"] },
        { cells: ["Base FY27e", amountValue(base.adj), amountValue(base.fcf), fx(base.netlev), fx(base.intcov), "Deleveraging supports staged add"] },
        { cells: ["Downside FY26e", amountValue(downside.adj), amountValue(downside.fcf), fx(downside.netlev), fx(downside.intcov), "No add; reopen liquidity and covenant path"] },
      ], note: "The complete FY26e–FY28e base and downside paths are consolidated in the compact model on page five." },
      catalystCalendarSection("Page 3: Risk & Challenge"),

      ...capitalStructureSections(capital, "Page 4: Capital & Documentation"),
      { page: "Page 4: Capital & Documentation", t: "cols", w: [1, 1], items: [
        [{ t: "table", title: "RECOVERY ALLOCATION", cols: ["Scenario", "EV basis", "1L", "2L TL", "Sub"], align: [0, 0, 1, 1, 1], rows: RECOVERY.map((scenario) => {
          const rates = recoveryRates(scenario.ev);
          return { cells: [scenario.scen, `${scenario.mult} × $${amountValue(scenario.ebitda)}M`, `${rates.firstLien.toFixed(0)}%`, `${rates.secondLien.toFixed(0)}%`, `${rates.subordinated.toFixed(0)}%`] };
        }), note: "Sequential allocation uses registered claims and assigns no value ahead of debt." }],
        [{ t: "chart", kind: "bar", title: "RECOVERY BY TRANCHE", unit: "% of par", sourceIds: ["CP-3B:T3B.2", "E-63"], accessibleSummary: "Recovery is allocated sequentially through first-lien, second-lien and subordinated claims across upside, base-distress and severe enterprise values.", columns: [{ key: "scenario", label: "Scenario" }, { key: "tranche", label: "Tranche" }, { key: "recovery", label: "% of par" }], h: 190, showValueLabels: true, valueLabelKey: "display", equivalentTable: "period-columns", spec: {
          type: "interval",
          data: recoveryData,
          encode: { x: "scenario", y: "recovery", color: "tranche" },
          transform: [{ type: "dodgeX" }],
          scale: { y: { domain: [0, 100] }, color: { domain: ["1L", "2L TL", "Sub"], range: ["#0f766e", "#2563eb", "#7c3aed"] } },
          axis: { x: { title: false }, y: { title: false } },
          legend: { color: { position: "top" } },
        } }],
      ] },
      keyProvisionsSection("Page 4: Capital & Documentation"),
      capacityBuildSection("Page 4: Capital & Documentation", "CAPACITY BUILD ($M) — CLAIM DILUTION"),
      { page: "Page 4: Capital & Documentation", t: "text", title: "COVENANT INTERPRETATION", body: "The document set shifts risk from probability of default to loss severity. The springing maintenance covenant is not a near-term trigger at current RCF utilization, but $612M of day-one capacity can rank pari or senior to the 2L and MFN protection expires in Jun-27. Any material raise inside that window requires a fresh recovery ranking and committee vote." },

      { page: "Page 5: Compact Model", t: "profile", title: "MODEL CONTROL COVER", rows: [
        ["Model", "M-118 · short IC view"],
        ["Included periods", "FY22A–FY25A · latest LTM Mar-26A · FY26e–FY28e base and downside"],
        ["Input basis", model.provenance.anchored ? "Persisted CP-1 anchor applied to latest LTM" : "REFERENCE seeded inputs · not issuer data"],
        ["Approval state", "CONDITIONAL · QA-117 evidence re-anchor remains open"],
        ["Scope boundary", "This page is the committee model summary; the full calculation and override history remain in Model Appendix"],
      ] },
      compactIcModelSection(model, "Page 5: Compact Model"),
      { page: "Page 5: Compact Model", t: "text", title: "MODEL INTERPRETATION", body: `Latest LTM net leverage is ${fx(ltm.netlev)}. The base case reaches ${fx(model.cols.b2.netlev)} by FY28e as FCF reduces debt; the FY26e downside rises to ${fx(model.cols.d0.netlev)} with interest coverage of ${fx(model.cols.d0.intcov)}. The recommendation therefore relies on staged sizing and evidence gates rather than a single-point base-case valuation.` },

      { page: "Page 6: Committee Controls", t: "profile", title: "POSITION AND ENTRY CONTROL", rows: [
        ["Instrument", DEAL.deal],
        ["Reference market", "96.25 bid / 96.75 ask · +388bps DM (Jun 8 reference mark)"],
        ["Standing order", "75bps at +400bps or wider · no concurrent SXAA add"],
        ["Maximum", "125bps only through certificate and bucket gates"],
        ["Loss-control principle", "Size so being wrong costs a quarter's carry, not the year's budget"],
      ] },
      { page: "Page 6: Committee Controls", t: "text", title: "PORTFOLIO CHAIR RESOLUTION", body: DEBATE_6E.memo },
      { page: "Page 6: Committee Controls", t: "table", title: "ADD / TRIM DISCIPLINE", cols: ["Action", "Condition", "Required response"], align: [0, 0, 0], rows: [
        ...SIZING.addTriggers.map((condition) => ({ cells: ["ADD", condition, "Recheck price, bucket and evidence before order"] })),
        ...SIZING.trimTriggers.map((condition) => ({ cells: ["TRIM", condition, "Reduce risk and route to CP-6A"] })),
      ] },
      { page: "Page 6: Committee Controls", t: "table", title: "OPEN GATES AND LIMITATIONS", cols: ["Item", "State", "Owner / next action"], align: [0, 0, 0], rows: [
        { cells: ["QA-117 / E-44", "OPEN · publication held", "Re-anchor or remove peer evidence"] },
        { cells: ["B3-or-below bucket", "91% utilized", "Portfolio owner re-tests at add"] },
        { cells: ["Q3-26 realization", "PENDING · due Oct-26", "Analyst validates certificate against ≥ $38M gate"] },
        { cells: ["Claim-level evidence coverage", "NOT COMPUTED in this paper", "Use Evidence & QA Control Sheet; resolve material gaps before publication"] },
      ] },
      { page: "Page 6: Committee Controls", t: "text", title: "SUPPORTING RECORD", body: "This memo consolidates the decision-relevant Deep-Dive, earnings, capital-structure, recovery, documentation, scenario and compact-model outputs. Earnings Update preserves the event detail; Scenario & Recovery preserves the full path and allocation; Covenant & Capacity preserves clause-level legal interpretation; Model Appendix preserves the complete calculation; Evidence & QA Control Sheet preserves the source inventory and unresolved limitations." },
    ],
  };
}

/* ---------- Covenant & Capacity Brief ---------- */
function covenantBrief(): Report {
  const capacityData = [
    { component: "Freebie", value: 150 },
    { component: "Ratio debt", value: 310 },
    { component: "Reclassification", value: 152 },
  ];
  return {
    id: "covenant", title: "Covenant & Capacity Brief", file: "ATLF Covenant Brief",
    subtitle: "Atlas Forge Industrials (ATLF) · CP-4 / CP-4C legal outputs · conformed docs control",
    icon: "scroll",
    srcs: [{ chip: "CP-4 T4.11", ev: ["E-63", "E-64"] }, { chip: "CP-4C T4C.5", ev: ["E-103"] }, { chip: "CP-1 K-09", ev: ["E-09"] }],
    sections: [
      { t: "profile", title: "HEADLINE CAPACITY", rows: [
        ["Committee conclusion", "Documentation increases loss severity more than near-term default probability"],
        ["Day-one incremental capacity", "$612M — pari or senior to the 2L TL"],
        ["RP capacity usable today", "$310M ($240M builder pre-positioned)"],
        ["EBITDA add-backs", "18.2% of adj. — uncapped under the credit agreement"],
        ["Nearest pressure point", CAPACITY.nearest],
        ["Control date", "Jun-27 MFN sunset · reprice recovery protection before expiry"],
      ] },
      { t: "cols", w: [1, 1], items: [
        [{ t: "chart", kind: "bar", title: "DAY-ONE CAPACITY COMPONENTS", unit: "$M", sourceIds: ["CP-4C:T4C.5", "E-63"], accessibleSummary: "The $612M day-one capacity comprises $150M of freebie capacity, $310M of ratio debt capacity, and $152M of reclassification headroom.", columns: [{ key: "component", label: "Component" }, { key: "value", label: "$M" }], h: 150, showValueLabels: true, spec: {
          type: "interval",
          data: capacityData,
          encode: { x: "component", y: "value", color: "component" },
          scale: { color: { domain: capacityData.map((item) => item.component), range: ["#0f766e", "#2563eb", "#b45309"] } },
          axis: { x: { title: false }, y: { title: false } },
          legend: false,
        } }],
        [capacityBuildSection()],
      ] },
      keyProvisionsSection(),
      { t: "cols", w: [1, 1], items: [
        [{ t: "chart", kind: "bar", title: "2L RECOVERY — CAPACITY EROSION", unit: "% of par", sourceIds: ["CP-3B:T3B.2", "CP-4C:T4C.5", "E-63"], accessibleSummary: "At a 6.0 times stress valuation, estimated second-lien recovery falls from 21 percent before capacity use to approximately 8 percent after capacity is used.", columns: [{ key: "state", label: "Claim state" }, { key: "recovery", label: "2L recovery (% of par)" }], h: 142, showValueLabels: true, spec: {
          type: "interval",
          data: [{ state: "Before use", recovery: 21 }, { state: "After use", recovery: 8 }],
          encode: { x: "state", y: "recovery", color: "state" },
          scale: { y: { domain: [0, 25] }, color: { domain: ["Before use", "After use"], range: ["#0f766e", "#b45309"] } },
          axis: { x: { title: false }, y: { title: false } },
          legend: false,
        } }],
        [{ t: "text", title: "COVENANT INTERPRETATION", body: "The debt documents do not create a near-term default trigger: the maintenance covenant is springing and current RCF utilization is below its test threshold. The economic risk is claim dilution. Ratio debt, the freebie basket and reclassification can place $612M pari or senior to the 2L, while MFN protection expires in Jun-27. Used capacity reduces the 6.0x-stress 2L recovery from approximately 21% to 8%; sizing and monitoring must therefore control LGD even while liquidity remains adequate." }],
      ] },
      { t: "table", title: "COMMITTEE CONTROLS", cols: ["Permission", "Usable quantum", "Constraint / blocker", "Action trigger"], align: [0, 1, 0, 0], rows: [
        { cells: ["Incremental / ratio debt", "$612M", "5.25x secured test; MFN only through Jun-27", "Any >$200M raise → re-rank and re-vote"] },
        { cells: ["Restricted payments", "$240M builder today", "No leverage governor on starter basket", "Any >$150M announced use → trim review"] },
        { cells: ["Asset transfer", "Blocked for material IP", "J.Crew and Chewy protections present", "Any amendment request → legal escalation"] },
        { cells: ["Springing covenant", "28% EBITDA cushion", "Tested only above 40% RCF utilization", "Utilization approaching threshold → liquidity review"] },
      ] },
    ],
  };
}

/* ---------- Monitoring Digest ---------- */
function monitoringDigest(): Report {
  return {
    id: "monitor", title: "Monitoring Exceptions — Reference", file: "ATLF Monitoring Exceptions",
    subtitle: "Atlas Forge Industrials (ATLF) · REFERENCE observations · as of Jun 10, 2026 · not a live feed",
    icon: "bell", watermark: "REFERENCE — AS OF JUN 10, 2026",
    srcs: [
      { chip: "CP-1", ev: ["E-103"] },
      { chip: "CP-2B", ev: ["E-15"] },
      { chip: "CP-4C", ev: ["E-63", "E-64"] },
      { chip: "CP-6E", ev: ["E-44", "E-71"] },
    ],
    sections: [
      { t: "profile", title: "EXCEPTION SUMMARY", rows: [
        ["Observation basis", "Seeded reference record · as of Jun 10, 2026 · no live status inference"],
        ["Immediate exceptions", "1 publication hold · 1 pending thesis gate"],
        ["New trigger trips in reference record", "None evidenced; absence is not a successful live check"],
        ["Action now", "Resolve QA-117; maintain 75bps maximum until certificate and bucket gates clear"],
        ["Next scheduled review", "Jul 28, 2026 · Q2 earnings and first add-back realization read"],
      ] },
      { t: "table", title: "EXCEPTIONS REQUIRING ACTION", cols: ["Item", "State", "Reference observation", "Threshold / due", "Owner / action", "Evidence"], align: [0, 0, 0, 0, 0, 0], rows: [
        { cells: ["QA-117 / E-44", "OPEN", "Peer anchor remains contested", "Before committee publication", "QA · re-anchor or remove E-44", "E-44"] },
        { cells: ["T-1 add-back realization", "PENDING", "$41M closed-plant run-rate cited; certificate test not yet due", "≥ $38M at Q3-26 certificate", "Analyst · validate certificate; CP-6A re-vote if missed", "E-103"] },
      ] },
      { t: "table", title: "REFERENCE TRIGGER OBSERVATIONS", cols: ["ID", "State", "Observed in seeded record", "Trip condition", "Distance / limitation", "Route"], align: [0, 0, 0, 0, 0, 0], rows: [
        { cells: ["T-1", "PENDING", "$41M run-rate support", "< $30M at Q3-26 certificate", "Final certificate unavailable", "CP-1 → CP-6A"] },
        { cells: ["T-2", "NO EVENT IN RECORD", "No qualifying raise recorded", "> $200M inside MFN window", "Not a live issuer check", "CP-4C → CP-3B"] },
        { cells: ["T-3", "BELOW THRESHOLD", "Top-three OEM concentration 38%", "> 42% on any quarter", "4 percentage points", "CP-2B pathway P1"] },
        { cells: ["T-4", "NO EVENT IN RECORD", "No recap exploration recorded", "Sponsor announces exploration", "Not a live sponsor check", "CP-2D → CP-6E"] },
      ] },
      { t: "table", title: "NEXT 90 DAYS", cols: ["Date", "Evidence expected", "Decision"], align: [0, 0, 0], rows: [
        { cells: ["Jul 28, 2026", "Q2-26 earnings and first realization read", "Maintain, trim or reopen operating case"] },
        { cells: ["Sep 2026", "RCF extension / repricing terms", "Refresh liquidity and repricing risk"] },
        { cells: ["Oct 2026", "Q3-26 compliance certificate", "Gate any increase toward 125bps"] },
      ] },
      { t: "text", title: "STANDING ACTION", body: "Keep the 75bps reference posture and the +400bps limit discipline. Do not increase size from this paper alone: the Q3-26 certificate, same-day B3-bucket headroom and QA-117 resolution are separate gates. A subsequent live monitoring run must replace these seeded observations rather than silently inheriting them." },
    ],
  };
}

function recoveryRates(enterpriseValue: number) {
  const firstLienClaim = CAPSTACK.filter((claim) => claim.key === "1l").reduce((sum, claim) => sum + claim.claim, 0);
  const secondLienClaim = CAPSTACK.filter((claim) => claim.key === "2l").reduce((sum, claim) => sum + claim.claim, 0);
  const subordinatedClaim = CAPSTACK.filter((claim) => claim.key === "sub").reduce((sum, claim) => sum + claim.claim, 0);
  const remainingAfterFirstLien = Math.max(0, enterpriseValue - firstLienClaim);
  const remainingAfterSecondLien = Math.max(0, remainingAfterFirstLien - secondLienClaim);
  const rate = (available: number, claim: number) => Math.min(100, Math.max(0, (available / claim) * 100));
  return {
    firstLien: rate(enterpriseValue, firstLienClaim),
    secondLien: rate(remainingAfterFirstLien, secondLienClaim),
    subordinated: rate(remainingAfterSecondLien, subordinatedClaim),
  };
}

function scenarioRecoveryPack(model: Model): Report {
  const years = ["FY26e", "FY27e", "FY28e"];
  const base = [model.cols.b0, model.cols.b1, model.cols.b2];
  const downside = [model.cols.d0, model.cols.d1, model.cols.d2];
  const leverageData = years.flatMap((period, index) => [
    { period, scenario: "Base", value: base[index].netlev ?? 0, display: fx(base[index].netlev) },
    { period, scenario: "Downside", value: downside[index].netlev ?? 0, display: fx(downside[index].netlev) },
  ]);
  const recoveryData = RECOVERY.flatMap((scenario) => {
    const rates = recoveryRates(scenario.ev);
    return [
      { scenario: scenario.scen, tranche: "1L", recovery: rates.firstLien, display: `${rates.firstLien.toFixed(0)}%` },
      { scenario: scenario.scen, tranche: "2L TL", recovery: rates.secondLien, display: `${rates.secondLien.toFixed(0)}%` },
      { scenario: scenario.scen, tranche: "Sub", recovery: rates.subordinated, display: `${rates.subordinated.toFixed(0)}%` },
    ];
  });

  return {
    id: "scenario", title: "Scenario & Recovery Pack", file: "ATLF Scenario and Recovery Pack",
    subtitle: "Atlas Forge Industrials (ATLF) · M-118 base/down paths · CP-3B recovery allocation",
    icon: "trend",
    srcs: [
      { chip: "M-118", ev: ["E-103"] },
      { chip: "CP-2B", ev: ["E-15", "E-77"] },
      { chip: "CP-3B", ev: ["E-63"] },
    ],
    sections: [
      { t: "profile", title: "COMMITTEE READ", rows: [
        ["Base conclusion", `Net leverage declines from ${fx(base[0].netlev)} in FY26e to ${fx(base[2].netlev)} in FY28e`],
        ["Downside conclusion", `FY26e net leverage rises to ${fx(downside[0].netlev)} with FCF of $${amountValue(downside[0].fcf)}M`],
        ["Recovery conclusion", "2L recovery is protected in upside but materially impaired in base distress after first-lien claims"],
        ["Decision use", "Gate sizing, liquidity review and recovery re-ranking; this pack does not grant trade authority"],
      ] },
      { t: "table", title: "BASE AND DOWNSIDE PATH", cols: ["Case", "Period", "Adj. EBITDA", "FCF", "Cash", "Net leverage", "Interest coverage"], align: [0, 0, 1, 1, 1, 1, 1], rows: [
        ...base.map((column, index) => ({ cells: ["Base", years[index], amountValue(column.adj), amountValue(column.fcf), amountValue(column.cash), fx(column.netlev), fx(column.intcov)] })),
        ...downside.map((column, index) => ({ cells: ["Downside", years[index], amountValue(column.adj), amountValue(column.fcf), amountValue(column.cash), fx(column.netlev), fx(column.intcov)] })),
      ] },
      { t: "chart", kind: "line", title: "NET LEVERAGE PATH — BASE VS DOWNSIDE", unit: "x", sourceIds: ["M-118", "E-103", "CP-2B:P1"], accessibleSummary: `Base and downside net leverage are compared for FY26e through FY28e. Base leverage declines while downside leverage peaks in FY26e before recovering.`, columns: [{ key: "period", label: "Period" }, { key: "scenario", label: "Scenario" }, { key: "value", label: "Net leverage" }], h: 190, showValueLabels: true, valueLabelKey: "display", equivalentTable: "period-columns", spec: {
        type: "line",
        data: leverageData,
        encode: { x: "period", y: "value", color: "scenario" },
        scale: { color: { domain: ["Base", "Downside"], range: ["#0f766e", "#b45309"] } },
        axis: { x: { title: false }, y: { title: false } },
        legend: { color: { position: "top" } },
      } },
      { t: "cols", w: [1, 1], items: [
        [{ t: "table", title: "RECOVERY ALLOCATION", cols: ["Scenario", "EV basis", "1L", "2L TL", "Sub"], align: [0, 0, 1, 1, 1], rows: RECOVERY.map((scenario) => {
          const rates = recoveryRates(scenario.ev);
          return { cells: [scenario.scen, `${scenario.mult} × $${amountValue(scenario.ebitda)}M`, `${rates.firstLien.toFixed(0)}%`, `${rates.secondLien.toFixed(0)}%`, `${rates.subordinated.toFixed(0)}%`] };
        }), note: "Sequential allocation uses the registered RCF/TLB, 2L and subordinated claims; no value is assigned ahead of debt." }],
        [{ t: "chart", kind: "bar", title: "RECOVERY BY TRANCHE", unit: "% of par", sourceIds: ["CP-3B:T3B.2", "E-63"], accessibleSummary: "Recovery is allocated sequentially through first-lien, second-lien and subordinated claims for the upside, base-distress and severe enterprise values.", columns: [{ key: "scenario", label: "Scenario" }, { key: "tranche", label: "Tranche" }, { key: "recovery", label: "% of par" }], h: 190, showValueLabels: true, valueLabelKey: "display", equivalentTable: "period-columns", spec: {
          type: "interval",
          data: recoveryData,
          encode: { x: "scenario", y: "recovery", color: "tranche" },
          transform: [{ type: "dodgeX" }],
          scale: { y: { domain: [0, 100] }, color: { domain: ["1L", "2L TL", "Sub"], range: ["#0f766e", "#2563eb", "#7c3aed"] } },
          axis: { x: { title: false }, y: { title: false } },
          legend: { color: { position: "top" } },
        } }],
      ] },
      { t: "text", title: "DECISION INTERPRETATION", body: "Base deleveraging supports the initial position, but the downside path and sequential claim allocation show why maximum sizing cannot rest on operating resilience alone. A priming raise or failure of the add-back realization gate requires both the downside model and recovery ranking to be refreshed before the committee re-votes." },
    ],
  };
}

function tradeImplementationTicket(): Report {
  return {
    id: "trade", title: "Trade Implementation Ticket", file: "ATLF Trade Implementation Ticket",
    subtitle: "Atlas Forge Industrials (ATLF) · CP-6E reference allocation · execution authority remains external",
    icon: "dashboard",
    srcs: [{ chip: "CP-6E", ev: ["E-44", "E-71"] }, { chip: "CP-6A", ev: ["E-103"] }],
    sections: [
      { t: "profile", title: "ORDER INSTRUCTION", rows: [
        ["Instrument", "2L TL '31"],
        ["Reference market", "96.25 bid / 96.75 ask · +388bps DM · Jun 8 reference mark"],
        ["Initial order", "75bps of NAV at ≤ 96.75 / ≥ +380bps"],
        ["Standing limit", "+400bps or wider · no concurrent SXAA add"],
        ["Maximum", "125bps after certificate and B3-bucket gates"],
        ["Authority boundary", "Committee paper records intent; trader and portfolio controls must validate and execute separately"],
      ] },
      { t: "table", title: "PRE-TRADE GATES", cols: ["Gate", "Required state", "Reference state", "Action if failed"], align: [0, 0, 0, 0], rows: [
        { cells: ["Price / spread", "≤ 96.75 / ≥ +380bps", "Reference ask 96.75 / DM +388bps", "Do not lift through limit"] },
        { cells: ["B3-or-below bucket", "Headroom for proposed size", "91% utilized", "Cap at 75bps or do not trade"] },
        { cells: ["QA-117 / E-44", "Resolved or excluded from sizing case", "Open", "Size on ex-E-44 band only"] },
        { cells: ["Correlation", "No concurrent SXAA add", "Cluster at 14% of 16% limit", "Sequence orders; re-test cluster"] },
        { cells: ["Adverse information", "None since reference mark", "Not evaluated by this seeded ticket", "Refresh before execution"] },
      ] },
      { t: "table", title: "PORTFOLIO CHALLENGE AND RESOLUTION", cols: ["Contested point", "Pro", "Con", "CIO resolution", "Evidence"], align: [0, 1, 1, 0, 0], rows:
        DEBATE_6E.weighting.map((item) => ({ cells: [item.claim, (item.bull * 100).toFixed(0) + "%", (item.bear * 100).toFixed(0) + "%", item.verdict, item.ev] })),
      },
      { t: "table", title: "POST-TRADE DISCIPLINE", cols: ["Action", "Condition", "Required control"], align: [0, 0, 0], rows: [
        ...SIZING.addTriggers.map((condition) => ({ cells: ["ADD", condition, "Price, evidence and bucket re-test"] })),
        ...SIZING.trimTriggers.map((condition) => ({ cells: ["TRIM", condition, "Reduce and route to CP-6A"] })),
      ] },
      { t: "text", title: "IMPLEMENTATION NOTE", body: DEBATE_6E.memo },
    ],
  };
}

function evidenceControlSheet(): Report {
  const evidenceRows = [
    ["E-09", "EBITDA adjustments", "CP-1 K-09", "Material to true leverage"],
    ["E-12 / E-31", "Aftermarket durability and contracts", "CP-1A / CP-2B", "Supports core thesis"],
    ["E-15", "OEM concentration", "CP-1A / CP-2B", "Supports pathway trigger"],
    ["E-22", "FCF conversion", "CP-1", "Supports deleveraging case"],
    ["E-44", "Relative-value peer anchor", "CP-1C", "OPEN · QA-117"],
    ["E-58", "Q1-26 earnings", "CP-1B", "Event analysis"],
    ["E-63 / E-64", "Debt capacity and MFN", "CP-4 / CP-4C", "Supports LGD risk"],
    ["E-71", "Reference market", "MKT / CP-6E", "Jun 8 reference mark"],
    ["E-77", "Liquidity runway", "CP-2E", "Supports downside path"],
    ["E-87 / E-103", "Recurring charges / compliance certificate", "CP-1 / CP-5", "Material to realization gate"],
  ];
  return {
    id: "evidence", title: "Evidence & QA Control Sheet", file: "ATLF Evidence and QA Control Sheet",
    subtitle: "Atlas Forge Industrials (ATLF) · registered reference record · claim-level coverage not computed",
    icon: "scroll", watermark: "CONDITIONAL — NOT A QA CERTIFICATE",
    srcs: [
      { chip: "CP-1", ev: ["E-09", "E-12", "E-15", "E-22", "E-31", "E-58", "E-87", "E-103"] },
      { chip: "CP-1C", ev: ["E-44", "E-71"] },
      { chip: "CP-2E", ev: ["E-77"] },
      { chip: "CP-4C", ev: ["E-63", "E-64"] },
    ],
    sections: [
      { t: "profile", title: "CONTROL STATUS", rows: [
        ["Publication state", "HELD · QA-117 remains open"],
        ["Registered documents", `${DOCS.length} reference documents`],
        ["Registered evidence IDs", `${new Set(evidenceRows.flatMap((row) => row[0].split(" / "))).size} registered IDs · not a claim-coverage score`],
        ["Freshness", "Reference dates only; no live source refresh is represented"],
        ["Certificate limitation", "This sheet inventories controls; it does not certify completeness, approval or legal sufficiency"],
      ] },
      { t: "table", title: "SOURCE DOCUMENT REGISTER", cols: ["Document", "Type", "Pages", "Date", "Grade", "Handling"], align: [0, 0, 1, 0, 0, 0], rows: DOCS.map((doc) => ({ cells: [
        doc.name, doc.type, doc.pages, doc.date, doc.grade,
        doc.mnpi ? "Analyst-declared MNPI · policy applies; validation and approval separate" : "Not marked MNPI in reference metadata",
      ] })) },
      { t: "table", title: "REGISTERED EVIDENCE INVENTORY", cols: ["Evidence", "Claim area", "Producer", "Control read"], align: [0, 0, 0, 0], rows: evidenceRows.map((cells) => ({ cells })) },
      { t: "table", title: "OPEN QA AND DATA LIMITATIONS", cols: ["Item", "State", "Effect", "Required resolution"], align: [0, 0, 0, 0], rows: [
        { cells: ["QA-117 / E-44", "OPEN", "RV cheapness cannot support approval at full weight", "Re-anchor or remove; rerun CP-1C and committee weighting"] },
        { cells: ["G-02 / Dec-25", "DERIVED PERIOD", "Eight-quarter earnings series contains a derived management-account period", "Retain disclosure; replace when filed actual arrives"] },
        { cells: ["Claim-level coverage", "NOT COMPUTED", "Registered IDs do not prove every material claim is sourced", "Map material claims to source, freshness and owner before certification"] },
        { cells: ["Live freshness", "NOT AVAILABLE", "Reference observations cannot be treated as current monitoring", "Run live source checks and replace seeded observations"] },
        { cells: ["Model change history", "NOT IN REPORT PAYLOAD", "Override author/time/prior value cannot be certified here", "Inspect Model History and approved checkpoint"] },
      ] },
      { t: "text", title: "QA DISPOSITION", body: "Do not publish the committee conclusion as fully cleared. The model calculation is available, but E-44 remains contested and the current report contract does not compute claim-level source coverage. Clearance requires evidence re-anchoring, material-claim mapping, freshness review and an approved model checkpoint." },
    ],
  };
}

export function buildReports(inputs?: ModelInputs): Report[] {
  const model = buildModel(inputs?.severity ?? 1, inputs?.overrides ?? {}, inputs?.anchor, inputs?.assumptions);
  return [
    creditSnapshot(model),
    earningsUpdate(model),
    creditMemo(model),
    scenarioRecoveryPack(model),
    covenantBrief(),
    tradeImplementationTicket(),
    monitoringDigest(),
    evidenceControlSheet(),
    modelAppendix(model),
  ];
}

export function buildReferenceReport(id: string | null | undefined, inputs?: ModelInputs): Report {
  const model = buildModel(inputs?.severity ?? 1, inputs?.overrides ?? {}, inputs?.anchor, inputs?.assumptions);
  const builders: Record<string, () => Report> = {
    snapshot: () => creditSnapshot(model),
    earnings: () => earningsUpdate(model),
    memo: () => creditMemo(model),
    scenario: () => scenarioRecoveryPack(model),
    covenant: covenantBrief,
    trade: tradeImplementationTicket,
    monitor: monitoringDigest,
    evidence: evidenceControlSheet,
    model: () => modelAppendix(model),
  };
  return (builders[id ?? "snapshot"] ?? builders.snapshot)();
}

export function citeCount(rep: Report): number {
  const set = new Set<string>();
  rep.srcs.forEach((s) => s.ev.forEach((e) => set.add(e)));
  return set.size;
}

export function secLabel(s: Section): string {
  if (s.title) return s.title;
  if (s.t === "cols") {
    const ts: string[] = [];
    s.items.forEach((col) => col.forEach((x) => {
      const l = x.title || ("subhead" in x ? x.subhead : undefined);
      if (l) ts.push(l);
    }));
    return ts.slice(0, 2).join(" · ") + (ts.length > 2 ? " · …" : "");
  }
  return ("subhead" in s && s.subhead) || s.t.toUpperCase();
}
