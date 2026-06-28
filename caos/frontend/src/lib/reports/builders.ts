// Report builders — assembles the 5 committee deliverables from the model
// + ATLF module outputs (port of design bundle concept-e-reports.js).

import { buildModel, type Model, type ModelCol, type Overrides } from "./model";
import { CAPACITY, COVENANTS, DEAL, DEBATE, SIZING, TRIGGERS } from "./deal";
import { ROWS } from "@/components/model/rows";
import { fmt } from "@/components/model/model-format";
import { cellTextColor } from "@/components/model/cell-style";
import type { ModelAnchor } from "@/lib/engine/modelAnchor";
import type { G2Spec } from "@/components/charts/G2Chart";

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

export type Section =
  | { t: "table"; title?: string; sub?: string; cols: string[]; align: number[]; rows: TableRow[]; note?: string }
  | { t: "profile"; title?: string; rows: [string, string][]; boldLast?: 1 }
  | { t: "text"; title?: string; subhead?: string; body: string; label?: string; labelBody?: string }
  | { t: "list"; title?: string; subhead?: string; items: string[] }
  | { t: "chart"; title?: string; sub?: string; h?: number; note?: string; spec: G2Spec }
  | { t: "cols"; title?: string; w?: number[]; items: Section[][] };

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
const fm = (v: number | null | undefined): string => {
  if (v == null || Number.isNaN(v)) return "";
  const r = Math.round(v);
  if (r === 0) return "–";
  const s = Math.abs(r).toLocaleString("en-US");
  return r < 0 ? "(" + s + ")" : s;
};
const fp = (v: number | null | undefined): string => (v == null || Number.isNaN(v) ? "" : (v * 100).toFixed(1) + "%");
const fx = (v: number | null | undefined): string => (v == null || Number.isNaN(v) ? "" : v.toFixed(2) + "x");
const APPENDIX_PCT_BLUE = "#2f64b7";

/* ---------- financials grid (FY22…LTM, template layout) ---------- */
const FIN_KEYS = ["f22", "f23", "f24", "f25", "y0", "y1", "l1"] as const;
const FIN_LBL = ["FY22", "FY23", "FY24", "FY25", "PYTD", "YTD", "LTM"];
const PRIOR: Record<string, string> = { f23: "f22", f24: "f23", f25: "f24", y1: "y0" };

function finSections(model: Model): Section[] {
  const C = FIN_KEYS.map((k) => model.cols[k]);
  const row = (label: string, f: (c: ModelCol) => number | null, fmt: (v: number | null) => string, opt?: Partial<TableRow>): TableRow =>
    ({ cells: [label, ...C.map((c) => fmt(f(c)))], ...opt });
  const growth = (f: (c: ModelCol) => number): (string | number)[] =>
    ["", ...FIN_KEYS.map((k) => { const p = PRIOR[k]; return p ? fp(f(model.cols[k]) / f(model.cols[p]) - 1) : "n.a."; })];

  const fin: Section = {
    t: "table", title: "FINANCIALS", sub: "US$ in Mns", cols: ["", ...FIN_LBL], align: [0, 1, 1, 1, 1, 1, 1, 1], rows: [
      row("Revenue", (c) => c.rev, fm, { b: 1 }),
      { cells: growth((c) => c.rev), it: 1, lbl0: "%Δ" },
      row("Gross Profit", (c) => c.gp, fm, { b: 1, gap: 1 }),
      { cells: growth((c) => c.gp), it: 1, lbl0: "%Δ" },
      { ...row("% margin", (c) => c.gpm, fp), it: 1 },
      row("EBITDA (adj.)", (c) => c.adj, fm, { b: 1, gap: 1 }),
      { cells: growth((c) => c.adj), it: 1, lbl0: "%Δ" },
      { ...row("% margin", (c) => c.adjm, fp), it: 1 },
      row("Cash Interest", (c) => -c.int, fm, { gap: 1 }),
      row("Leases", (c) => -c.leases, fm),
      row("Cash tax", (c) => -c.tax, fm),
      row("Other", (c) => -c.oth, fm, { line: 1 }),
      row("FFO", (c) => c.ffo, fm, { b: 1 }),
      row("WC", (c) => c.wc, fm, { line: 1 }),
      row("CFO", (c) => c.cfo, fm, { b: 1 }),
      row("Capex", (c) => -c.capex, fm, { line: 1 }),
      row("FCF", (c) => c.fcf, fm, { b: 1 }),
      row("M&A", (c) => c.acq, fm),
      row("Δ in debt", (c) => c.diss, fm),
      row("Dividends", (c) => c.div, fm),
      row("Other", (c) => c.othf, fm, { line: 1 }),
      row("Net Δ in cash", (c) => c.ncf, fm, { b: 1 }),
    ],
  };
  const bs: Section = {
    t: "table", title: "BALANCE SHEET", cols: ["", ...FIN_LBL], align: [0, 1, 1, 1, 1, 1, 1, 1], rows: [
      row("Cash", (c) => c.cash, fm),
      row("Senior debt", (c) => c.secured, fm),
      row("Total debt", (c) => c.tdebt, fm),
      row("Net debt", (c) => c.ndebt, fm, { b: 1 }),
    ],
  };
  const cm: Section = {
    t: "table", title: "CREDIT METRICS", cols: ["", ...FIN_LBL], align: [0, 1, 1, 1, 1, 1, 1, 1], rows: [
      row("Senior Leverage", (c) => c.srsec, fx),
      row("Total Leverage", (c) => c.totlev, fx),
      row("Net Leverage", (c) => c.netlev, fx, { b: 1 }),
      row("Interest Cover", (c) => c.intcov, fx),
    ],
  };
  return [fin, bs, cm];
}

function modelAppendix(model: Model, currency = "USD"): Report {
  const subtotalLines = new Set(["gp", "ebit", "ffo", "cfo"]);
  const kpiGroupLines = new Set(["intcov", "sga", "dso", "taxr"]);
  const appendixPctColor = (v: number | null, rowId: string, bold: boolean, rowFmt?: string): string =>
    cellTextColor({ rowId, v, isOv: false, pct: true, bold, rowFmt }).replace("rgba(79,140,255,0.9)", APPENDIX_PCT_BLUE);
  const labelFor = (key: string) => {
    const c = model.cols[key];
    const col = model.columns.find((x) => x.key === key);
    if (!col) return c.label;
    if (col.group === "Q") return `Q ${c.label}`;
    return `${col.group} ${c.label}`;
  };
  const cols = ["Line", ...model.columns.map((c) => labelFor(c.key))];
  const rows: TableRow[] = ROWS.map((r) => r.sec
    ? { cells: [r.sec, ...model.columns.map(() => "")], b: 1, line: 1, gap: 1 }
    : (() => {
        const values = model.columns.map((c) => r.g?.(model.cols[c.key]) ?? null);
        return {
          cells: [
            r.sub ? `${r.l} (${r.sub})` : r.l || "",
            ...values.map((v) => fmt(v, r.f)),
          ],
          cellColors: r.pct && r.id ? [
            undefined,
            ...values.map((v) => appendixPctColor(v, r.id!, !!r.bold, r.f)),
          ] : undefined,
          b: r.bold,
          line: r.line || (r.id && (subtotalLines.has(r.id) || kpiGroupLines.has(r.id)) ? 1 : undefined),
          gap: r.line || (r.id && kpiGroupLines.has(r.id) ? 1 : undefined),
        };
      })());
  return {
    id: "model",
    title: "Model Appendix",
    file: "ATLF_Model_Appendix.pdf",
    subtitle: `Atlas Forge Industrials (ATLF) · full M-118 model · ${currency} in Mns`,
    icon: "▦",
    srcs: [{ chip: "MODEL", ev: ["E-103"] }],
    sections: [
      { t: "table", title: "FULL MODEL", sub: `${currency} in Mns except ratios`, cols, align: cols.map((_, i) => i === 0 ? 0 : 1), rows },
    ],
  };
}

/* ---------- Credit Snapshot ---------- */
function creditSnapshot(model: Model): Report {
  const l1 = model.cols.l1;
  const reported = l1.ebitda, addbacks = l1.ab, adj = l1.adj;
  const haircut = 35, structEbitda = adj - haircut;
  // Canonical ATLF capital structure (CP-3B dashboard, step-outputs.ts) — the
  // authoritative tranche set this committee snapshot must tie to. Was seeded ad hoc
  // (rcf 55 / sub 200 / model tlb ~1,420 → total 2,575), contradicting the CP-3B
  // total of 3,270 under the same facility names. (review run-2 #F2)
  const rcf = 120, tlb = 1850, ssn = 900, sub = 400;
  const secured = rcf + tlb + ssn, tdebt = secured + sub, cash = Math.round(l1.cash);
  const ev = Math.round(9.5 * structEbitda), equity = ev - tdebt;
  const xm = (d: number) => (d / structEbitda).toFixed(2) + "x";
  const pev = (d: number) => ((d / ev) * 100).toFixed(0) + "%";
  const pfInt = Math.round(l1.int);
  return {
    id: "snapshot", title: "Credit Snapshot", file: "ATLF Credit Snapshot",
    subtitle: "Atlas Forge Industrials (ATLF) · generated from RUN #2641 module outputs · Jun 10, 2026",
    icon: "dashboard",
    srcs: [
      { chip: "CP-1 T4.7", ev: ["E-103"] }, { chip: "CP-1A 06", ev: ["E-12", "E-15"] }, { chip: "CP-1 K-09", ev: ["E-09"] },
      { chip: "CP-3B T3B.2", ev: ["E-63"] }, { chip: "CP-6A 06", ev: [] }, { chip: "MKT", ev: ["E-71"] }, { chip: "M-118", ev: [] },
    ],
    sections: [
      { t: "cols", w: [1, 1], items: [
        [{ t: "profile", title: "COMPANY PROFILE", rows: [
          ["Company", "Atlas Forge Industrials (ATLF)"], ["Sector", "Industrials — engineered metal components"],
          ["Shareholders", "Kestrel Fund V 68.4% · co-invest 22.4% · mgmt 9.2%"], ["Corp Ratings (M/S/F)", "B2 / B / —"],
          ["Country", "United States"], ["Management", "T. Renner (CEO) · M. Okafor (CFO)"],
          ["Sector Outlook", "STABLE — order book 1.06x"], ["Sponsor Quality", "Competent operator · extractive policy (CP-2D)"],
          ["Credit Score", "71 / 100 (CP-3 T3.3)"], ["Credit Direction", "IMPROVING — gated on Q3-26 certificate"],
        ] }],
        [{ t: "profile", title: "ANALYST RECOMMENDATION", rows: [
          ["Analyst", "CAOS · RUN #2641"], ["Date", "Jun 10, 2026"],
          ["Recommendation", "BUY — 75bps initial → 125bps max (CP-6E)"], ["Entry", "+388bps or wider · limit at +400"],
          ["CLO", "eligible — B3 bucket check on trade date"], ["Indexed Loans", "TLB — HOLD (defensive rotation)"],
          ["Indexed Lev Loan", "2L TL '31 — ADD ON WEAKNESS"], ["Clearance", "CP-5 CONDITIONAL — QA-117 open"],
        ] }],
      ] },
      { t: "table", title: "TRANSACTION SUMMARY AND NEW DEBT ISSUES", cols: ["Borrower", "Instrument", "Debt Type", "UoP", "Tranche ($Mn)", "Guidance / IPT", "OID", "Maturity", "Exp. Ratings", "CR Score", "Commit"], align: [0, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0], rows: [
        { cells: ["Atlas Forge Intermediate Holdings", "2L TL '31", "2nd Lien Term Loan", "Refi 2L bridge + GCP", "900", "S+400–425 / IPT S+450", "99.41", "2031", "B3 / B−", "71", "May-26"] },
      ] },
      { t: "table", title: "CAPITAL STRUCTURE", cols: ["Facility", "Spread / Coupon", "CCY", "Maturity", "Bid", "Ask", "Outstanding ($Mn)", "Multiple", "% EV", "Recommendation"], align: [0, 1, 0, 1, 1, 1, 1, 1, 1, 0], rows: [
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
      ] },
      { t: "chart", title: "SENIORITY STACK — CLAIMS INCL. IMPLIED EQUITY ($MN)", h: 52, spec: {
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
        scale: { color: {
          domain: ["RCF (drawn)", "1L Term Loan B", "2L TL '31 (subject)", "Sub Notes '32", "Implied equity @ 9.5x"],
          range: ["#0f766e", "#0d9488", "#2563eb", "#7c3aed", "#94a3b8"],
        } },
        labels: [{
          text: (d: { cls: string; v: number }) => d.cls.split(" ")[0] + " " + d.v.toLocaleString(),
          position: "inside", fontSize: 8,
          // overlapHide drops labels that would collide (narrow tranches like RCF /
          // Sub) instead of letting them overlap — exact $ stay in the cap-structure
          // table above. overflowHide alone doesn't stop adjacent-segment collisions.
          transform: [{ type: "contrastReverse" }, { type: "overflowHide" }, { type: "overlapHide" }],
        }],
      } },
      { t: "cols", w: [3, 2], items: [
        [{ t: "text", title: "BUSINESS DESCRIPTION", body: "Engineered metal components for industrial OEMs across Drivetrain (46% of revenue), Fluid Systems (31%) and Aftermarket & Services (23% of revenue, 44% of gross profit). 14 plants (9 US, 4 EU, 1 MX); #1–2 share in 7 of 9 core lines. The credit rests on a 1.9M-unit installed base feeding contract-locked aftermarket revenue renewing at 92%; 71% of COGS is pass-through-indexed with a 60–90 day lag. Owned by Kestrel Capital Fund V since the 2021 LBO ($2,150M EV, 7.9x)." }],
        [{ t: "profile", title: "EBITDA ADJUSTMENTS", rows: [
          ["Reported EBITDA (LTM)", fm(reported)], ["Company add-backs", fm(addbacks)],
          ["Adj. EBITDA (company)", fm(adj)], ["Analyst adj. 1 — recurring 'one-time' charges", "(25)"],
          ["Analyst adj. 2 — cost-out phasing risk", "(10)"], ["Analyst adj. 3", "—"],
          ["Structuring EBITDA", fm(structEbitda)],
        ], boldLast: 1 }],
      ] },
      { t: "text", title: "INVESTMENT THESIS", body: "Carry plus deleveraging, not convergence: at +388bps the 2L TL pays +48–63bps over the fair band (+20–25bps ex-E-44) for risks that are monitorable rather than structural. Base case deleverages to ~4.9x by FY27 on realized add-backs alone (sponsor model demoted to upside). The bear case — structural add-backs, $612M priming capacity, sponsor recap record — is real but priced; the IC haircuts base EBITDA by $35M and stages sizing accordingly. Verdict: CONSTRUCTIVE, add on weakness (CP-6A).", label: "Catalysts and near-term events", labelBody: "Jul 28 Q2-26 print (first add-back realization read) · Oct-26 Q3-26 compliance certificate (T-1 — thesis-defining) · Sep-26 RCF extension window · Jun-27 MFN sunset · Q2-27 Meridian repricing." },
      { t: "cols", w: [1, 1], items: [
        [
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
      ] },
    ],
  };
}

/* ---------- Earnings Update ---------- */
function earningsUpdate(): Report {
  return {
    id: "earnings", title: "Earnings Update — Q1-26", file: "ATLF Earnings Update Q1-26",
    subtitle: "Atlas Forge Industrials (ATLF) · CP-1B monitoring output · print date Apr 29, 2026",
    icon: "trend",
    srcs: [{ chip: "CP-1B T6", ev: ["E-58"] }, { chip: "CP-1 T4.7", ev: ["E-103"] }, { chip: "CP-2C T5.2", ev: [] }],
    sections: [
      { t: "profile", title: "PRINT SUMMARY", rows: [
        ["Issuer / period", "Atlas Forge Industrials — Q1 FY26 (Mar-26)"],
        ["Headline", "In line — trajectory intact, sponsor model runs hot"],
        ["Thesis impact", "NEUTRAL-POSITIVE · no trigger trips"],
        ["Next checkpoint", "Jul 28 — Q2-26 print, first add-back realization read"],
      ] },
      { t: "table", title: "TOP SHEET", cols: ["Metric", "Q1-26", "vs Q1-25", "Read"], align: [0, 1, 1, 0], rows: [
        { cells: ["Revenue", "$715M", "+3.9%", "in line"] },
        { cells: ["Adj. EBITDA", "$108M", "+4.9%", "in line"] },
        { cells: ["Margin", "15.1%", "+10bps", "stable"] },
        { cells: ["Book-to-bill", "1.06x", "+0.04x", "supportive"] },
        { cells: ["Net leverage", "5.68x", "−0.3x", "deleveraging on EBITDA"] },
      ] },
      { t: "table", title: "KPI DASHBOARD (QUARTERLY)", cols: ["", "Q2-25", "Q3-25", "Q4-25*", "Q1-26"], align: [0, 1, 1, 1, 1], rows: [
        { cells: ["Revenue ($M)", "688", "701", "697", "715"] },
        { cells: ["Adj. EBITDA ($M)", "103", "106", "104", "108"] },
        { cells: ["Margin", "15.0%", "15.1%", "14.9%", "15.1%"] },
        { cells: ["Orders / book-to-bill", "1.02x", "1.04x", "0.98x", "1.06x"] },
        { cells: ["Aftermarket mix (rev)", "22.4%", "22.8%", "23.1%", "23.4%"] },
      ], note: "* Q4-25 derived period — management accounts missing (gap G-02)" },
      { t: "chart", title: "REVENUE & ADJ. EBITDA — TRAILING QUARTERS ($M)", h: 168, spec: {
        type: "interval",
        data: [
          { q: "Q2-25", m: "Revenue", v: 688 }, { q: "Q3-25", m: "Revenue", v: 701 }, { q: "Q4-25*", m: "Revenue", v: 697 }, { q: "Q1-26", m: "Revenue", v: 715 },
          { q: "Q2-25", m: "Adj. EBITDA", v: 103 }, { q: "Q3-25", m: "Adj. EBITDA", v: 106 }, { q: "Q4-25*", m: "Adj. EBITDA", v: 104 }, { q: "Q1-26", m: "Adj. EBITDA", v: 108 },
        ],
        encode: { x: "q", y: "v", color: "m" },
        transform: [{ type: "dodgeX" }],
        scale: { color: { domain: ["Revenue", "Adj. EBITDA"], range: ["#16161e", "#b45309"] } },
        axis: { x: { title: false }, y: { title: false } },
        legend: { color: { position: "top" } },
        labels: [{ text: "v", position: "top", fontSize: 8, transform: [{ type: "overlapHide" }] }],
      } },
      { t: "table", title: "VARIANCE VS SPONSOR MODEL", cols: ["Line", "Model", "Actual", "Δ", "Driver"], align: [0, 1, 1, 1, 0], rows: [
        { cells: ["Revenue", "722.0", "715.0", "−1.0%", "Fluid Systems volume"] },
        { cells: ["Adj. EBITDA", "112.7", "108.0", "−4.2%", "volume (−3.1) + cost-out phasing (−1.6)"] },
        { cells: ["Margin", "15.6%", "15.1%", "−50bps", "absorption"] },
      ] },
      { t: "text", title: "OVERALL EARNINGS VIEW", body: "Earnings trajectory intact: +6.2% LTM EBITDA growth, realized price (+180bps) running ahead of input inflation (+140bps), and aftermarket mix grinding up (+100bps over four quarters) — the most thesis-supportive trend on the dashboard. The sponsor model runs hot; conflict logged to CP-5 and the model demoted to upside case. CP-1 normalized actuals remain the base for all downstream work." },
      { t: "table", title: "WATCH ITEMS → NEXT PRINT (JUL 28)", cols: ["Item", "Threshold", "Routed to"], align: [0, 0, 0], rows: [
        { cells: ["Add-back realization (first print)", "< $30M run-rate → T-1 trips", "CP-6A re-vote"] },
        { cells: ["Fluid Systems volume", "second consecutive miss", "CP-2B P1 refresh"] },
        { cells: ["Book-to-bill", "< 0.95x", "CP-2B flag"] },
      ] },
    ],
  };
}

/* ---------- IC Credit Memo ---------- */
function creditMemo(): Report {
  const w = DEBATE.weighting;
  return {
    id: "memo", title: "IC Credit Memo", file: "ATLF IC Credit Memo",
    subtitle: "Atlas Forge Industrials (ATLF) · CP-6A / CP-6E committee output · HELD pending QA-117",
    icon: "gavel", watermark: "CONDITIONAL — QA-117 OPEN",
    srcs: [{ chip: "CP-6A", ev: ["E-09", "E-87"] }, { chip: "CP-6E", ev: ["E-71"] }, { chip: "CP-4C", ev: ["E-63", "E-64"] }, { chip: "CP-3B", ev: [] }],
    sections: [
      { t: "profile", title: "DECISION SUMMARY", rows: [
        ["Deal", DEAL.deal], ["IC verdict", DEBATE.bias],
        ["Sizing", SIZING.decision], ["Entry discipline", SIZING.entry],
        ["Initial / max", SIZING.initial + " / " + SIZING.max], ["Binding constraint", "B3-or-below bucket — 91% utilized"],
        ["Clearance", "CP-5 CONDITIONAL — pack held on QA-117 (E-44)"],
      ] },
      { t: "text", title: "PRE-DEBATE THESIS MAP", body: DEBATE.thesis },
      { t: "table", title: "CHAIR EVIDENCE WEIGHTING & RESOLUTION", cols: ["Contested claim", "Bull", "Bear", "Chair verdict"], align: [0, 1, 1, 0], rows:
        w.map((x) => ({ cells: [x.claim, (x.bull * 100).toFixed(0), (x.bear * 100).toFixed(0), x.verdict] })),
      },
      { t: "cols", w: [1, 1], items: [
        [{ t: "table", title: "RECOVERY SCENARIOS — 2L TL (CP-3B)", cols: ["Scenario", "EV basis", "1L", "2L TL", "Sub"], align: [0, 0, 1, 1, 1], rows: [
          { cells: ["Going concern", "7.0x × $421M", "100%", "100%", "100%"] },
          { cells: ["Base distress", "5.5x × $360M", "100%", "22%", "0%"] },
          { cells: ["Severe", "5.0x × $295M", "75%", "0%", "0%"] },
        ], note: "Market-implied 2L recovery at px 96.4 ≈ 38% under base-distress probability weights" }],
        [{ t: "chart", title: "RECOVERY BY TRANCHE (% OF PAR)", h: 150, spec: {
          type: "interval",
          data: [
            { scen: "Going concern", tr: "1L", rec: 100 }, { scen: "Going concern", tr: "2L TL", rec: 100 }, { scen: "Going concern", tr: "Sub", rec: 100 },
            { scen: "Base distress", tr: "1L", rec: 100 }, { scen: "Base distress", tr: "2L TL", rec: 22 }, { scen: "Base distress", tr: "Sub", rec: 0 },
            { scen: "Severe", tr: "1L", rec: 75 }, { scen: "Severe", tr: "2L TL", rec: 0 }, { scen: "Severe", tr: "Sub", rec: 0 },
          ],
          encode: { x: "scen", y: "rec", color: "tr" },
          transform: [{ type: "dodgeX" }],
          coordinate: { transform: [{ type: "transpose" }] },
          scale: { y: { domain: [0, 100] }, color: { domain: ["1L", "2L TL", "Sub"], range: ["#0d9488", "#2563eb", "#7c3aed"] } },
          axis: { x: { title: false }, y: { title: false, labelFormatter: (d: number) => d + "%" } },
          legend: { color: { position: "top" } },
          labels: [{ text: (d: { rec: number }) => d.rec + "%", position: "inside", fontSize: 8, transform: [{ type: "contrastReverse" }, { type: "overflowHide" }] }],
        } }],
      ] },
      { t: "table", title: "DOCUMENTATION RED FLAGS (CP-4 / 4C)", cols: ["Flag", "Quantum", "Trigger"], align: [0, 1, 0], rows: [
        { cells: ["Day-one incremental capacity — pari/senior to 2L", "$612M", "T-2 — raise >$200M in MFN window"] },
        { cells: ["MFN sunset", "Jun-27", "calendar — protection decays"] },
        { cells: ["RP capacity usable today", "$310M", "T-4 — any activation"] },
        { cells: ["Add-backs (uncapped credit agreement definition)", "18.2% of adj.", "T-1 — Q3-26 certificate"] },
      ] },
      { t: "text", title: "SINGLE GREATEST UNCERTAINTY", body: DEBATE.uncertainty },
      { t: "text", title: "IC CHAIR FINAL MEMO", body: DEBATE.memo },
      { t: "list", title: "ADD / TRIM DISCIPLINE", items: SIZING.addTriggers.map((x) => "ADD — " + x).concat(SIZING.trimTriggers.map((x) => "TRIM — " + x)) },
    ],
  };
}

/* ---------- Covenant & Capacity Brief ---------- */
function covenantBrief(): Report {
  return {
    id: "covenant", title: "Covenant & Capacity Brief", file: "ATLF Covenant Brief",
    subtitle: "Atlas Forge Industrials (ATLF) · CP-4 / CP-4C legal outputs · conformed docs control",
    icon: "scroll",
    srcs: [{ chip: "CP-4 T4.11", ev: ["E-63", "E-64"] }, { chip: "CP-4C T4C.5", ev: ["E-103"] }, { chip: "CP-1 K-09", ev: ["E-09"] }],
    sections: [
      { t: "profile", title: "HEADLINE CAPACITY", rows: [
        ["Aggressiveness score", "7.2 / 10 — Aggressive (2026 single-B norm: 6.1)"],
        ["Day-one incremental capacity", "$612M — pari or senior to the 2L TL"],
        ["RP capacity usable today", "$310M ($240M builder pre-positioned)"],
        ["EBITDA add-backs", "18.2% of adj. — uncapped under the credit agreement"],
        ["Nearest pressure point", CAPACITY.nearest],
      ] },
      { t: "table", title: "KEY PROVISIONS", cols: ["Provision · doc", "Feature", "Aggressiveness", "Headroom / capacity"], align: [0, 0, 1, 1], rows:
        COVENANTS.slice(0, 6).map((c) => ({ cells: [c.ref, c.name, c.agg + " / 10", c.headroom] })),
      },
      { t: "table", title: "CAPACITY BUILD ($M)", cols: ["Component", "Amount", "Basis"], align: [0, 1, 0], rows: [
        { cells: ["Freebie basket", "150", "greater of $150M / 35% × EBITDA"] },
        { cells: ["Ratio capacity", "310", "to 5.25x secured at 4.68x current"] },
        { cells: ["Reclassification headroom", "155", "basket migration mechanics"] },
        { cells: ["Total — incurrable pari or senior to 2L", "612", ""], b: 1, line: 1 },
      ] },
      { t: "text", title: "PD vs LGD TRANSLATION", body: "This document set shifts risk from PD to LGD: default is not nearer (no maintenance covenant to trip; liquidity strong), but the creditor's position at default is erodible — used capacity cuts the 6.0x-stress 2L recovery from 21% to ~8%. The single most consequential date in the documents is the MFN sunset, June 2027, after which a priming raise carries no yield protection for 2L lenders." },
    ],
  };
}

/* ---------- Monitoring Digest ---------- */
function monitoringDigest(): Report {
  return {
    id: "monitor", title: "Monitoring Digest", file: "ATLF Monitoring Digest",
    subtitle: "Atlas Forge Industrials (ATLF) · CP-MON standing posture · week of Jun 8, 2026",
    icon: "bell",
    srcs: [{ chip: "CP-2C T5.2", ev: [] }, { chip: "CP-2 T12", ev: [] }, { chip: "CP-6E", ev: [] }],
    sections: [
      { t: "table", title: "TRIGGERS ARMED", cols: ["ID", "Trigger", "On trip"], align: [0, 0, 0], rows:
        TRIGGERS.map((tr) => ({ cells: [tr.id, tr.text, tr.owner] })),
      },
      { t: "table", title: "CATALYST CALENDAR — NEXT 12 MONTHS", cols: ["Date", "Event", "Prob.", "Impact", "Route"], align: [0, 0, 1, 0, 0], rows: [
        { cells: ["Jul 28, 2026", "Q2-26 earnings + first add-back realization print", "100%", "HIGH", "CP-1B · CP-6A"] },
        { cells: ["Sep 2026", "RCF extension / repricing window opens", "70%", "MED", "CP-3D"] },
        { cells: ["Oct 2026", "Q3-26 compliance certificate (add-back test)", "100%", "HIGH", "CP-1 · T-1"] },
        { cells: ["Q4 2026", "Kestrel Fund V exit-window commentary", "40%", "MED", "CP-2D"] },
        { cells: ["Q2 2027", "Meridian-platform contract repricing", "100%", "HIGH", "CP-2B P1"] },
      ] },
      { t: "list", title: "ADD / TRIM DISCIPLINE", items: SIZING.addTriggers.map((x) => "ADD — " + x).concat(SIZING.trimTriggers.map((x) => "TRIM — " + x)) },
      { t: "text", title: "STANDING POSTURE", body: "ADD-ON-WEAKNESS at 75bps with a standing limit order at +400bps. Path to 125bps max runs through trigger T-1 (Q3-26 certificate ≥ $30M realized add-backs) plus a same-day B3-bucket headroom re-test. Open QA item: E-44 re-anchor (QA-117) — committee pack held until remediation R-1 lands." },
    ],
  };
}

export function buildReports(inputs?: ModelInputs): Report[] {
  const model = buildModel(inputs?.severity ?? 1, inputs?.overrides ?? {}, inputs?.anchor);
  return [creditSnapshot(model), earningsUpdate(), creditMemo(), covenantBrief(), monitoringDigest(), modelAppendix(model)];
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
