// Committee-pack model export (C9, expansion 4.2) — a real .xlsx via SheetJS
// (port of design bundle concept-d.jsx exportXlsx), replacing the earlier
// dependency-free CSV stub. Five sheets: Model grid, Assumptions (base/down
// case), Scenarios (best/base/worst 3y projection), Headline Facts
// (metric_facts from the issuer profile), Overrides (manual input log).
// Every sheet opens with an ORIGIN/METHOD/RUN/AS-OF stamp row so a committee
// reader can trust the export exactly as far as the on-screen chip already
// does — no sheet's numbers can be quoted without also carrying that line.
//
// SECURITY: the `xlsx` package (SheetJS) has two open, unpatched high-severity
// advisories — prototype pollution (GHSA-4r6h-8v6p-xvw6) and ReDoS
// (GHSA-5pgg-2g8v-p4x9) — both in its PARSE path (`XLSX.read`/`readFile`).
// This module is write-only: it never parses xlsx/csv content, only builds
// one via `aoa_to_sheet`/`book_new`/`writeFile`. Do not add a read/import path
// here without re-auditing those advisories first.

import * as XLSX from "xlsx";
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

function stampCell(prov: Provenance, runId?: string | null): Cell {
  const parts = [
    `ORIGIN: ${prov.origin}`,
    prov.method ? `METHOD: ${prov.method}` : null,
    runId ? `RUN: ${runId}` : null,
    prov.asOf ? `AS OF: ${prov.asOf}` : null,
  ].filter((p): p is string => p != null);
  return safeStr(parts.join(" · "));
}

const NUMFMT: Record<RowFormat, string> = {
  m: '#,##0;(#,##0);"–"',
  p: "0.0%",
  r: "0.0%",
  x: '0.00"x"',
  d: "0",
};

function applyFormats(ws: XLSX.WorkSheet, fmtMap: Record<string, string>): void {
  Object.entries(fmtMap).forEach(([ref, fmt]) => {
    if (ws[ref]) ws[ref].z = fmt;
  });
}

// A stamped sheet's real content (header/data rows) starts 2 rows down —
// the stamp row, then a blank spacer row.
const STAMP_ROWS = 2;
function stampedSheet(rows: Cell[][], stamp: Cell): Cell[][] {
  return [[stamp], [], ...rows];
}

/* ---------- Sheet 1: Model grid ---------- */
function buildModelSheet(
  model: Model, showQ: boolean, meta: { header: string; subheader: string }, prov: Provenance, runId?: string | null,
): XLSX.WorkSheet {
  const colDefs = model.columns
    .filter((c) => showQ || c.group !== "Q")
    .map((c) => ({ ...c, ctx: model.cols[c.key] }));

  const round3 = (v: number | null | undefined): Cell =>
    v == null || Number.isNaN(v) ? "" : Math.round(v * 1000) / 1000;

  const rows: Cell[][] = [];
  rows.push([safeStr(meta.header), ...colDefs.map((c) => GROUPS_META[c.group])]);
  rows.push([safeStr(meta.subheader), ...colDefs.map((c) => safeStr(c.ctx.label + (c.ctx.derived ? "*" : "")))]);

  const fmtMap: Record<string, string> = {};
  const aoa = stampedSheet(rows, stampCell(prov, runId));

  ROWS.forEach((row) => {
    const r = aoa.length;
    if (row.sec) {
      aoa.push([safeStr(row.sec)]);
      return;
    }
    const label = safeStr((row.ind ? "   " : "") + row.l + (row.sub ? " (" + row.sub + ")" : ""));
    const cells: Cell[] = [label];
    colDefs.forEach((c, i) => {
      const v = round3(row.g!(c.ctx));
      cells.push(v);
      if (typeof v === "number" && row.f) {
        fmtMap[XLSX.utils.encode_cell({ r, c: i + 1 })] = NUMFMT[row.f];
      }
    });
    aoa.push(cells);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  applyFormats(ws, fmtMap);
  ws["!cols"] = [{ wch: 32 }, ...colDefs.map(() => ({ wch: 10 }))];
  return ws;
}

/* ---------- Sheet 2: Assumptions ---------- */
const CASE_FIELD_LABELS: [keyof CaseAssumptions, string, RowFormat][] = [
  ["gDrive", "Δ Drivetrain growth", "p"], ["gFluid", "Δ Fluid Systems growth", "p"], ["gAfter", "Δ Aftermarket growth", "p"],
  ["dGpm", "Δ gross margin", "p"], ["dAdjm", "Δ adj. EBITDA margin", "p"], ["daPct", "D&A % of sales", "p"],
  ["mInt", "× cash interest", "x"], ["mLeases", "× leases", "x"], ["mTax", "× cash taxes", "x"],
  ["mWc", "× changes in WC", "x"], ["mCapex", "× capex", "x"], ["mAcq", "× acquisitions", "x"], ["mDiss", "× debt issue/(repay)", "x"],
  ["divDelta", "Dividends $/yr", "m"],
  ["sofrRate", "SOFR rate", "p"], ["euriborRate", "EURIBOR rate", "p"], ["soniaRate", "SONIA rate", "p"],
];

function buildAssumptionsSheet(a: Assumptions, prov: Provenance, runId?: string | null): XLSX.WorkSheet {
  const fmtMap: Record<string, string> = {};
  const header: Cell[] = ["Assumption", "Base case", "Downside case"];
  const rows: Cell[][] = [header];
  const push = (label: string, base: number, down: number, f: RowFormat) => {
    const r = rows.length;
    rows.push([safeStr(label), base, down]);
    fmtMap[XLSX.utils.encode_cell({ r, c: 1 })] = NUMFMT[f];
    fmtMap[XLSX.utils.encode_cell({ r, c: 2 })] = NUMFMT[f];
  };
  CASE_FIELD_LABELS.forEach(([key, label, f]) => push(label, a.base[key], a.down[key], f));
  rows.push([]);
  rows.push([safeStr("Add-back acceptance (1 = accept in full, 0 = disallow)")]);
  ADDBACKS.forEach((ab) => push(ab.label, a.base[ab.key as keyof CaseAssumptions], a.down[ab.key as keyof CaseAssumptions], "x"));

  // fmtMap row indices above were computed against `rows` before the stamp's
  // leading rows are prepended — shift every reference down by STAMP_ROWS.
  const shifted: Record<string, string> = {};
  Object.entries(fmtMap).forEach(([ref, fmt]) => {
    const cellRef = XLSX.utils.decode_cell(ref);
    shifted[XLSX.utils.encode_cell({ r: cellRef.r + STAMP_ROWS, c: cellRef.c })] = fmt;
  });

  const aoa = stampedSheet(rows, stampCell(prov, runId));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  applyFormats(ws, shifted);
  ws["!cols"] = [{ wch: 36 }, { wch: 14 }, { wch: 14 }];
  return ws;
}

/* ---------- Sheet 3: Scenarios ---------- */
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

function buildScenariosSheet(model: Model, prov: Provenance, runId?: string | null): XLSX.WorkSheet {
  const lens = buildScenarios(model);
  const projections = lens.scenarios.map((s) => ({ s, p: lens.project(s.drivers) }));
  const years = projections[0]?.p.years ?? [];

  const fmtMap: Record<string, string> = {};
  const header: Cell[] = ["Metric", ...projections.flatMap(({ s }) => years.map((y) => `${s.label} ${y}`))];
  const rows: Cell[][] = [header];
  SCEN_METRICS.forEach((m) => {
    const r = rows.length;
    const cells: Cell[] = [safeStr(m.label)];
    let col = 1;
    projections.forEach(({ p }) => {
      years.forEach((_y, yi) => {
        const raw = p[m.key][yi];
        const v = Number.isFinite(raw) ? Math.round(raw * 1000) / 1000 : "";
        cells.push(v);
        if (typeof v === "number") fmtMap[XLSX.utils.encode_cell({ r: r + STAMP_ROWS, c: col })] = NUMFMT[m.f];
        col++;
      });
    });
    rows.push(cells);
  });

  const aoa = stampedSheet(rows, stampCell(prov, runId));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  applyFormats(ws, fmtMap);
  ws["!cols"] = [{ wch: 20 }, ...header.slice(1).map(() => ({ wch: 12 }))];
  return ws;
}

/* ---------- Sheet 4: Headline Facts ---------- */
function buildFactsSheet(metrics: ProfileMetric[], prov: Provenance, runId?: string | null): XLSX.WorkSheet {
  const header: Cell[] = ["Metric", "Period", "Value", "Unit", "Basis", "Provenance", "QA status"];
  const headline = metrics.filter((m) => m.headline);
  const rows: Cell[][] = [header, ...headline.map((m): Cell[] => [
    safeStr(m.metric_key), safeStr(m.period), m.value, safeStr(m.unit || ""),
    safeStr(m.basis || ""), safeStr(m.provenance), safeStr(m.qa_status),
  ])];
  if (headline.length === 0) rows.push([safeStr("No headline metric_facts on file for this issuer.")]);

  const aoa = stampedSheet(rows, stampCell(prov, runId));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  return ws;
}

/* ---------- Sheet 5: Overrides ---------- */
const OVERRIDE_LABELS: Record<string, string> = {
  rev: "Revenues", adj: "Adj. EBITDA", ab: "Adjustments", int: "Cash interest",
  tax: "Cash taxes", wc: "Changes in WC", capex: "Capex", diss: "Debt issue/(repay)", div: "Dividends",
};

function buildOverridesSheet(model: Model, overrides: Overrides, prov: Provenance, runId?: string | null): XLSX.WorkSheet {
  const header: Cell[] = ["Period", "Account", "Override value ($m, model basis)"];
  const ovKeys = Object.keys(overrides || {});
  const rows: Cell[][] = [header];
  if (!ovKeys.length) {
    rows.push([safeStr("No manual overrides on this model.")]);
  } else {
    ovKeys.forEach((k) => {
      const [colKey, field] = k.split(":");
      const ctx: ModelCol | undefined = model.cols[colKey];
      rows.push([
        safeStr(ctx ? ctx.label + (ctx.kind === "q" ? " (Q)" : " (FY)") : colKey),
        safeStr(OVERRIDE_LABELS[field] || field),
        overrides[k],
      ]);
    });
  }
  const aoa = stampedSheet(rows, stampCell(prov, runId));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 16 }];
  return ws;
}

// Pure — no DOM/download side effect, so it's directly unit-testable (the
// round-trip test reads this workbook's own bytes back with SheetJS, and was
// separately verified once by hand against openpyxl — see export.test.ts).
export function buildWorkbook(
  model: Model,
  showQ: boolean,
  overrides: Overrides,
  meta: { header: string; subheader: string },
  ctx: { prov: Provenance; runId?: string | null; assumptions: Assumptions; metrics: ProfileMetric[] },
): XLSX.WorkBook {
  const { prov, runId, assumptions, metrics } = ctx;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildModelSheet(model, showQ, meta, prov, runId), "Model");
  XLSX.utils.book_append_sheet(wb, buildScenariosSheet(model, prov, runId), "Scenarios");
  XLSX.utils.book_append_sheet(wb, buildAssumptionsSheet(assumptions, prov, runId), "Assumptions");
  XLSX.utils.book_append_sheet(wb, buildFactsSheet(metrics, prov, runId), "Headline Facts");
  XLSX.utils.book_append_sheet(wb, buildOverridesSheet(model, overrides, prov, runId), "Overrides");
  return wb;
}

export function exportModel(
  model: Model,
  showQ: boolean,
  overrides: Overrides,
  meta: { header: string; subheader: string; filename: string },
  ctx: { prov: Provenance; runId?: string | null; assumptions: Assumptions; metrics: ProfileMetric[] },
): void {
  XLSX.writeFile(buildWorkbook(model, showQ, overrides, meta, ctx), meta.filename);
}
