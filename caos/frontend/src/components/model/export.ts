// Committee-pack model export (C9, expansion 4.2) — a real .xlsx via
// ExcelJS, replacing the earlier dependency-free CSV stub. Five sheets:
// Model grid, Scenarios (best/base/worst 3y projection), Assumptions
// (base/down case), Headline Facts (metric_facts from the issuer profile),
// Overrides (manual input log). Every sheet opens with an
// ORIGIN/METHOD/RUN/AS-OF stamp row so a committee reader can trust the
// export exactly as far as the on-screen chip already does — no sheet's
// numbers can be quoted without also carrying that line.
//
// ExcelJS, not SheetJS (`xlsx`, the stub's original suggestion): the `xlsx`
// npm package carries two open, unpatched High-severity advisories
// (prototype pollution GHSA-4r6h-8v6p-xvw6, ReDoS GHSA-5pgg-2g8v-p4x9) that
// trip CI's `npm audit --audit-level=high` gate outright — ExcelJS's own
// residual (a Moderate uuid buffer-bounds issue, unrelated to file parsing)
// stays under that threshold. See SBOM.md.
//
// SECURITY: this module is write-only — it never calls Xlsx.load/readFile,
// only Workbook.addWorksheet/addRow + xlsx.writeBuffer. Do not add a read
// path here without re-auditing ExcelJS's own advisories first.

import ExcelJS from "exceljs";
import type { Model, ModelCol, Overrides } from "@/lib/reports/model";
import type { Assumptions, CaseAssumptions } from "@/lib/reports/assumptions";
import { ADDBACKS } from "@/lib/reports/assumptions";
import type { ProfileMetric } from "@/lib/api";
import type { Provenance } from "@/lib/provenance";
import { buildScenarios, type Projection } from "@/lib/model/scenarios";
import { ROWS } from "./rows";
import { GROUPS_META, type RowFormat } from "./model-format";

type Cell = string | number;

// Formula-injection guard — identical rule to lib/csv.ts's csvCell (matrix
// 6.8): a leading =+-@ (or tab/CR) makes Excel execute the cell as a formula
// on open. Applies to every string cell built from analyst/DB-sourced text
// (issuer names, metric keys); static hardcoded labels don't need it but
// running it over them is harmless.
function safeStr(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

function stampRow(ws: ExcelJS.Worksheet, prov: Provenance, runId?: string | null): void {
  const parts = [
    `ORIGIN: ${prov.origin}`,
    prov.method ? `METHOD: ${prov.method}` : null,
    runId ? `RUN: ${runId}` : null,
    prov.asOf ? `AS OF: ${prov.asOf}` : null,
  ].filter((p): p is string => p != null);
  ws.addRow([safeStr(parts.join(" · "))]);
  ws.addRow([]);
}

const NUMFMT: Record<RowFormat, string> = {
  m: '#,##0;(#,##0);"–"',
  p: "0.0%",
  r: "0.0%",
  x: '0.00"x"',
  d: "0",
};

/* ---------- Sheet 1: Model grid ---------- */
function buildModelSheet(
  wb: ExcelJS.Workbook, model: Model, showQ: boolean,
  meta: { header: string; subheader: string }, prov: Provenance, runId?: string | null,
): void {
  const ws = wb.addWorksheet("Model");
  const colDefs = model.columns
    .filter((c) => showQ || c.group !== "Q")
    .map((c) => ({ ...c, ctx: model.cols[c.key] }));

  // Number.isFinite, not isNaN: a zero-revenue override makes the ratio rows
  // (adjm/sga/dapc) ±Infinity, which the on-screen grid blanks but this exported
  // as a numeric Infinity cell with a "0.0%" numFmt — a grid/export divergence
  // on a committee deliverable (triage 2026-07-16 P3).
  const round3 = (v: number | null | undefined): Cell =>
    !Number.isFinite(v as number) ? "" : Math.round((v as number) * 1000) / 1000;

  stampRow(ws, prov, runId);
  ws.addRow([safeStr(meta.header), ...colDefs.map((c) => GROUPS_META[c.group])]);
  ws.addRow([safeStr(meta.subheader), ...colDefs.map((c) => safeStr(c.ctx.label + (c.ctx.derived ? "*" : "")))]);

  ROWS.forEach((row) => {
    if (row.sec) {
      ws.addRow([safeStr(row.sec)]);
      return;
    }
    const label = safeStr((row.ind ? "   " : "") + row.l + (row.sub ? " (" + row.sub + ")" : ""));
    const cells: Cell[] = [label];
    colDefs.forEach((c) => cells.push(round3(row.g!(c.ctx))));
    const excelRow = ws.addRow(cells);
    if (row.f) {
      colDefs.forEach((_c, i) => {
        const cell = excelRow.getCell(i + 2);
        if (typeof cell.value === "number") cell.numFmt = NUMFMT[row.f as RowFormat];
      });
    }
  });

  ws.columns = [{ width: 32 }, ...colDefs.map(() => ({ width: 10 }))];
}

/* ---------- Sheet 2: Scenarios ---------- */
type ProjectionSeriesKey = Exclude<keyof Projection, "years">;
const SCEN_METRICS: { key: ProjectionSeriesKey; label: string; f: RowFormat }[] = [
  { key: "revenue", label: "Revenue", f: "m" },
  { key: "adjEbitda", label: "Adj. EBITDA", f: "m" },
  { key: "fcf", label: "FCF", f: "m" },
  { key: "cash", label: "Cash", f: "m" },
  { key: "netDebt", label: "Net Debt", f: "m" },
  { key: "netLev", label: "Net Leverage", f: "x" },
  { key: "intCov", label: "Interest Coverage", f: "x" },
];

function buildScenariosSheet(wb: ExcelJS.Workbook, model: Model, prov: Provenance, runId?: string | null): void {
  const ws = wb.addWorksheet("Scenarios");
  const lens = buildScenarios(model);
  const projections = lens.scenarios.map((s) => ({ s, p: lens.project(s.drivers) }));
  const years = projections[0]?.p.years ?? [];

  stampRow(ws, prov, runId);
  const header: Cell[] = ["Metric", ...projections.flatMap(({ s }) => years.map((y) => `${s.label} ${y}`))];
  ws.addRow(header);

  SCEN_METRICS.forEach((m) => {
    const cells: Cell[] = [safeStr(m.label)];
    projections.forEach(({ p }) => {
      years.forEach((_y, yi) => {
        const raw = p[m.key][yi];
        cells.push(Number.isFinite(raw) ? Math.round(raw * 1000) / 1000 : "");
      });
    });
    const excelRow = ws.addRow(cells);
    for (let c = 2; c <= cells.length; c++) {
      const cell = excelRow.getCell(c);
      if (typeof cell.value === "number") cell.numFmt = NUMFMT[m.f];
    }
  });

  ws.columns = [{ width: 20 }, ...header.slice(1).map(() => ({ width: 12 }))];
}

/* ---------- Sheet 3: Assumptions ---------- */
const CASE_FIELD_LABELS: [keyof CaseAssumptions, string, RowFormat][] = [
  ["gDrive", "Δ Drivetrain growth", "p"], ["gFluid", "Δ Fluid Systems growth", "p"], ["gAfter", "Δ Aftermarket growth", "p"],
  ["dGpm", "Δ gross margin", "p"], ["dAdjm", "Δ adj. EBITDA margin", "p"], ["daPct", "D&A % of sales", "p"],
  ["mInt", "× cash interest", "x"], ["mLeases", "× leases", "x"], ["mTax", "× cash taxes", "x"],
  ["mWc", "× changes in WC", "x"], ["mCapex", "× capex", "x"], ["mAcq", "× acquisitions", "x"], ["mDiss", "× debt issue/(repay)", "x"],
  ["divDelta", "Dividends $/yr", "m"],
  ["sofrRate", "SOFR rate", "p"], ["euriborRate", "EURIBOR rate", "p"], ["soniaRate", "SONIA rate", "p"],
];

function buildAssumptionsSheet(wb: ExcelJS.Workbook, a: Assumptions, prov: Provenance, runId?: string | null): void {
  const ws = wb.addWorksheet("Assumptions");
  stampRow(ws, prov, runId);
  ws.addRow(["Assumption", "Base case", "Downside case"]);

  const push = (label: string, base: number, down: number, f: RowFormat) => {
    const row = ws.addRow([safeStr(label), base, down]);
    row.getCell(2).numFmt = NUMFMT[f];
    row.getCell(3).numFmt = NUMFMT[f];
  };
  CASE_FIELD_LABELS.forEach(([key, label, f]) => push(label, a.base[key], a.down[key], f));
  ws.addRow([]);
  ws.addRow([safeStr("Add-back acceptance (1 = accept in full, 0 = disallow)")]);
  ADDBACKS.forEach((ab) => push(ab.label, a.base[ab.key as keyof CaseAssumptions], a.down[ab.key as keyof CaseAssumptions], "x"));

  ws.columns = [{ width: 36 }, { width: 14 }, { width: 14 }];
}

/* ---------- Sheet 4: Headline Facts ---------- */
function buildFactsSheet(wb: ExcelJS.Workbook, metrics: ProfileMetric[], prov: Provenance, runId?: string | null): void {
  const ws = wb.addWorksheet("Headline Facts");
  stampRow(ws, prov, runId);
  ws.addRow(["Metric", "Period", "Value", "Unit", "Basis", "Provenance", "QA status"]);

  const headline = metrics.filter((m) => m.headline);
  headline.forEach((m) => ws.addRow([
    safeStr(m.metric_key), safeStr(m.period), m.value, safeStr(m.unit || ""),
    safeStr(m.basis || ""), safeStr(m.provenance), safeStr(m.qa_status),
  ]));
  if (headline.length === 0) ws.addRow([safeStr("No headline metric_facts on file for this issuer.")]);

  ws.columns = [{ width: 22 }, { width: 10 }, { width: 12 }, { width: 8 }, { width: 14 }, { width: 14 }, { width: 14 }];
}

/* ---------- Sheet 5: Overrides ---------- */
const OVERRIDE_LABELS: Record<string, string> = {
  rev: "Revenues", adj: "Adj. EBITDA", ab: "Adjustments", int: "Cash interest",
  tax: "Cash taxes", wc: "Changes in WC", capex: "Capex", diss: "Debt issue/(repay)", div: "Dividends",
};

function buildOverridesSheet(wb: ExcelJS.Workbook, model: Model, overrides: Overrides, prov: Provenance, runId?: string | null): void {
  const ws = wb.addWorksheet("Overrides");
  stampRow(ws, prov, runId);
  ws.addRow(["Period", "Account", "Override value ($m, model basis)"]);

  const ovKeys = Object.keys(overrides || {});
  if (!ovKeys.length) {
    ws.addRow([safeStr("No manual overrides on this model.")]);
  } else {
    ovKeys.forEach((k) => {
      const [colKey, field] = k.split(":");
      const ctx: ModelCol | undefined = model.cols[colKey];
      ws.addRow([
        safeStr(ctx ? ctx.label + (ctx.kind === "q" ? " (Q)" : " (FY)") : colKey),
        safeStr(OVERRIDE_LABELS[field] || field),
        overrides[k],
      ]);
    });
  }
  ws.columns = [{ width: 16 }, { width: 24 }, { width: 16 }];
}

// Pure — no DOM/download side effect, so it's directly unit-testable (the
// round-trip test reads this workbook's own bytes back with ExcelJS, and was
// separately verified once by hand against openpyxl — see export.test.ts).
export function buildWorkbook(
  model: Model,
  showQ: boolean,
  overrides: Overrides,
  meta: { header: string; subheader: string },
  ctx: { prov: Provenance; runId?: string | null; assumptions: Assumptions; metrics: ProfileMetric[] },
): ExcelJS.Workbook {
  const { prov, runId, assumptions, metrics } = ctx;
  const wb = new ExcelJS.Workbook();
  buildModelSheet(wb, model, showQ, meta, prov, runId);
  buildScenariosSheet(wb, model, prov, runId);
  buildAssumptionsSheet(wb, assumptions, prov, runId);
  buildFactsSheet(wb, metrics, prov, runId);
  buildOverridesSheet(wb, model, overrides, prov, runId);
  return wb;
}

export async function exportModel(
  model: Model,
  showQ: boolean,
  overrides: Overrides,
  meta: { header: string; subheader: string; filename: string },
  ctx: { prov: Provenance; runId?: string | null; assumptions: Assumptions; metrics: ProfileMetric[] },
): Promise<void> {
  const buf = await buildWorkbook(model, showQ, overrides, meta, ctx).xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = meta.filename;
  a.click();
  URL.revokeObjectURL(url);
}
