"use client";

// Model Builder sheet grid + formula bar + manifest strip
// (port of design bundle concept-d.jsx Sheet / FormulaBar / Manifest).
// Sourced cash-flow grid: every cell traces to an upstream module; historical
// cells are double-click editable (manual overrides), forecast cells are derived.

import { useMemo } from "react";
import type { Model, ModelCol } from "@/lib/reports/model";
import type { Overrides } from "@/lib/reports/model";
import { EvChip } from "@/components/reports/EvidenceModal";
import { ROWS, SRC } from "./rows";
import { CW, fmt, GROUPS_META, isEditable, LBL, ovField } from "./model-format";
import { cellBackground, cellBoxShadow, cellTextColor, kpiDistressLevel, KPI_DISTRESS_GLYPH } from "./cell-style";

export interface CellRef {
  row: string;
  col: string;
}

export function getColLetter(idx: number): string {
  let letter = "";
  let temp = idx;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

interface ColDef {
  key: string;
  group: string;
  ctx: ModelCol;
  w: number;
  gap: boolean;
}

/* ---------- cell editor ---------- */
function CellInput({ initial, label, onCommit }: { initial: string; label: string; onCommit: (v: string | null) => void }) {
  // A no-op edit (open the editor, click away, no keystrokes) must NOT stamp a
  // spurious MANUAL OVERRIDE. `initial` is the rounded display seed, so any value
  // string-identical to it is an unchanged blur — commit null (cancel) instead of
  // re-stamping the cell with a rounded copy of its own sourced actual.
  const commit = (v: string | null) => onCommit(v != null && v === initial ? null : v);
  return (
    <input
      autoFocus
      defaultValue={initial}
      aria-label={label}
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        const t = e.target as HTMLInputElement;
        if (e.key === "Enter") { t.dataset.done = "1"; commit(t.value); }
        else if (e.key === "Escape") { t.dataset.done = "1"; onCommit(null); }
      }}
      onBlur={(e) => { if (!e.target.dataset.done) commit(e.target.value); }}
      className="w-full tabular text-caos-xs text-right bg-caos-elevated outline-none px-0.5 rounded-sm"
      style={{ height: 15, border: "1px solid var(--caos-accent)", color: "var(--caos-text)" }}
    />
  );
}

/* ---------- the sheet ---------- */
// One source of truth for which child rows a collapsed group hides — Sheet's
// grid and FormulaBar's visible-row coordinates both derive from it, so the
// formula bar's cell address can never disagree with the sheet's row numbers.
const COLLAPSE_CHILDREN: Record<string, string[]> = {
  rev: ["segD", "gsegD", "segF", "gsegF", "segA", "gsegA"],
  adj: ROWS.filter((r) => r.id?.startsWith("ab")).map((r) => r.id!).filter((id) => id !== "ab"),
  secured: ["rcf", "tlb", "ssn"],
  tdebt: ["rcf", "tlb", "ssn", "sub"],
};

function hiddenRows(collapsedRows: Set<string> | undefined): Set<string> {
  return new Set(
    Object.entries(COLLAPSE_CHILDREN).flatMap(([parent, kids]) => (collapsedRows?.has(parent) ? kids : [])),
  );
}

export function Sheet({
  model, showQ, hl, hlCells, sel, onSel, editing, onEdit, onCommit, collapsedRows, onToggleRow,
}: {
  model: Model;
  showQ: boolean;
  hl: string | null;
  /** "rowId:colKey" cells to flash while an assumption driver is being scrubbed. */
  hlCells?: Set<string> | null;
  sel: CellRef | null;
  onSel: (s: CellRef) => void;
  editing: CellRef | null;
  onEdit: (e: CellRef) => void;
  onCommit: (value: string | null) => void;
  collapsedRows?: Set<string>;
  onToggleRow?: (row: string) => void;
  /** Reference (seeded Atlas Forge demo) vs live issuer. Accepted for prop
   *  symmetry with FormulaBar/Manifest; the Sheet grid itself carries no
   *  ATLF-specific lineage, so it is not read in the body. Default false. */
  isReference?: boolean;
}) {
  const colDefs: ColDef[] = useMemo(() => {
    const list = model.columns.filter((c) => showQ || c.group !== "Q");
    return list.map((c, i) => ({
      ...c, ctx: model.cols[c.key], w: CW[c.group],
      gap: i > 0 && list[i - 1].group !== c.group,
    }));
  }, [model, showQ]);

  const groups = useMemo(() => {
    const out: { group: string; w: number; n: number; gap: boolean }[] = [];
    colDefs.forEach((c) => {
      const last = out[out.length - 1];
      if (last && last.group === c.group) { last.w += c.w; last.n++; }
      else out.push({ group: c.group, w: c.w, n: 1, gap: c.gap });
    });
    return out;
  }, [colDefs]);

  const hlGroup = hl && SRC[hl] ? SRC[hl].colGroup : undefined;
  const hidden = hiddenRows(collapsedRows);

  const labelColor = (c: ColDef) =>
    c.ctx.derived ? "var(--caos-warning)" : c.group === "BASE" ? "var(--caos-success)" : c.group === "DOWN" ? "var(--caos-warning)" : "var(--caos-muted)";

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editing) return;

    const selectableRows = ROWS.filter((row) => row.id && !hidden.has(row.id));
    const rowIds = selectableRows.map((r) => r.id!);
    const colKeys = colDefs.map((c) => c.key);

    if (!sel || rowIds.length === 0 || colKeys.length === 0) return;

    const startRowIdx = rowIds.indexOf(sel.row);
    const startColIdx = colKeys.indexOf(sel.col);
    let rowIdx = startRowIdx;
    let colIdx = startColIdx;

    if (rowIdx === -1 || colIdx === -1) return;

    let preventDefault = true;

    switch (e.key) {
      case "ArrowUp":
        if (rowIdx > 0) rowIdx--;
        break;
      case "ArrowDown":
        if (rowIdx < rowIds.length - 1) rowIdx++;
        break;
      case "ArrowLeft":
        if (colIdx > 0) colIdx--;
        break;
      case "ArrowRight":
        if (colIdx < colKeys.length - 1) colIdx++;
        break;
      case "Tab":
        if (e.shiftKey) {
          if (colIdx > 0) {
            colIdx--;
          } else if (rowIdx > 0) {
            rowIdx--;
            colIdx = colKeys.length - 1;
          }
        } else {
          if (colIdx < colKeys.length - 1) {
            colIdx++;
          } else if (rowIdx < rowIds.length - 1) {
            rowIdx++;
            colIdx = 0;
          }
        }
        // WCAG 2.1.2: at a grid boundary the Tab indices don't change — let the
        // browser move focus naturally out of the grid instead of trapping it.
        if (rowIdx === startRowIdx && colIdx === startColIdx) {
          preventDefault = false;
        }
        break;
      case "Escape":
        // Return focus to the grid container's natural tab position.
        (e.currentTarget as HTMLElement).focus();
        break;
      case "Enter":
        const rowId = sel.row;
        const colKey = sel.col;
        if (isEditable(rowId, colKey)) {
          onEdit({ row: rowId, col: colKey });
        }
        break;
      default:
        preventDefault = false;
    }

    if (preventDefault) {
      e.preventDefault();
      // Escape doesn't move the selection; every other handled key may.
      if (e.key !== "Escape") onSel({ row: rowIds[rowIdx], col: colKeys[colIdx] });
    }
  };

  // Stable per-cell DOM id, referenced by aria-activedescendant so AT announces
  // the active cell as arrow keys move the selection.
  const cellDomId = (rowId: string, colKey: string) => `cell-${rowId}-${colKey}`;
  const selectedCellId = sel ? cellDomId(sel.row, sel.col) : undefined;

  // Screen-reader description of the current selection (row · period · value).
  let selectionSummary = "";
  if (sel) {
    const selRow = ROWS.find((r) => r.id === sel.row);
    const selCtx = model.cols[sel.col];
    if (selRow && selCtx) {
      const sv = selRow.g ? selRow.g(selCtx) : null;
      selectionSummary = `${selRow.l} · ${selCtx.label} · ${fmt(sv, selRow.f) || "—"}`;
    }
  }

  const renderCell = (rowId: string, c: ColDef, opts: { bold?: 1; pct?: 1; shade?: 1; line?: 1; isHl?: boolean }) => {
    const isSel = sel != null && sel.row === rowId && sel.col === c.key;
    const colHl = hlGroup === c.group;
    const cellHl = !!hlCells && hlCells.has(rowId + ":" + c.key);
    const isEditing = editing != null && editing.row === rowId && editing.col === c.key;

    const row = ROWS.find((r) => r.id === rowId)!;
    const v = row.g!(c.ctx);
    const field = ovField(rowId);
    const editable = isEditable(rowId, c.key);
    const isOv = editable && !!c.ctx.ov && !!c.ctx.ov[field];
    const display = fmt(v, row.f);
    const color = cellTextColor({ rowId, v, isOv, pct: !!opts.pct, bold: !!opts.bold, rowFmt: row.f });
    // Color-alone fix (interface #3): pair the distress-shaded value with a glyph.
    const distress = kpiDistressLevel(rowId, v);
    const distressGlyph = distress ? KPI_DISTRESS_GLYPH[distress] : null;

    return (
      <div
        key={c.key}
        id={cellDomId(rowId, c.key)}
        role="gridcell"
        aria-selected={isSel}
        onClick={() => onSel({ row: rowId, col: c.key })}
        onDoubleClick={(e) => {
          if (editable) {
            // Stop the row-level onDoubleClick (which toggles a collapsible
            // parent's children) from firing on the SAME gesture that opens the
            // editor — otherwise overriding a rev / Adj. EBITDA quarterly yanks
            // the segment / add-back rows shut mid-edit.
            e.stopPropagation();
            onEdit({ row: rowId, col: c.key });
          }
        }}
        title={editable ? "double-click to override" : undefined}
        className="shrink-0 text-right pr-1.5 cursor-cell"
        style={{
          width: c.w, marginLeft: c.gap ? 8 : 0,
          background: cellBackground({ isSel, cellHl, colHl, isHl: !!opts.isHl, shade: !!opts.shade }),
          borderRight: "1px solid var(--caos-border)",
          borderBottom: "1px solid var(--caos-border)",
          boxShadow: cellBoxShadow(isSel, cellHl),
        }}
      >
        {isEditing ? (
          <CellInput
            initial={v == null ? "" : String(Math.round(v * 10) / 10)}
            label={`Edit ${row.l}, ${c.ctx.label}`}
            onCommit={onCommit}
          />
        ) : (
          <span
            className={"tabular text-caos-xs leading-[15px] whitespace-nowrap " + (opts.bold ? "font-semibold" : "")}
            style={{ color, borderBottom: isOv ? "1px dotted var(--caos-warning)" : "none" }}
          >
            {distressGlyph ? (
              <span aria-hidden className="mr-0.5" style={{ fontSize: "0.75em" }}>{distressGlyph}</span>
            ) : null}
            {display}
          </span>
        )}
      </div>
    );
  };

  let rowCounter = 0;

  return (
    <>
      {/* Visually-hidden live region: names the active cell as selection moves.
          Lives OUTSIDE the grid — an un-roled div with global ARIA as a direct
          grid child violates aria-required-children. */}
      <div className="sr-only" aria-live="polite">
        {selectionSummary ? `Selected ${selectionSummary}` : ""}
      </div>
    <div
      tabIndex={0}
      role="grid"
      aria-label="Model worksheet"
      aria-activedescendant={selectedCellId}
      onKeyDown={handleKeyDown}
      className="flex-1 min-h-0 overflow-auto rounded border border-caos-border bg-caos-bg focus-ring"
    >
      <div style={{ width: "max-content", minWidth: "100%" }}>
        {/* group bar */}
        <div role="row" className="flex sticky top-0 z-30" style={{ background: "var(--caos-bg)" }}>
          <div
            role="presentation"
            className="sticky left-0 z-30 shrink-0 flex items-center justify-end pr-1 text-[9px] font-mono select-none"
            style={{ width: 24, background: "var(--caos-panel)", borderRight: "1px solid var(--caos-border)" }}
          />
          <div role="columnheader" className="sticky z-10 shrink-0 px-2 flex items-center" style={{ left: 24, width: LBL, background: "var(--caos-bg)", borderRight: "1px solid var(--caos-border)" }}>
            <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap overflow-hidden">YE 31-Dec · $m</span>
          </div>
          {groups.map((gr, i) => (
            <div key={i} role="columnheader" className="shrink-0 flex items-center justify-center" style={{ width: gr.w, marginLeft: gr.gap ? 8 : 0 }}>
              <div
                className="w-full mx-px h-[18px] my-[3px] flex items-center justify-center rounded-sm overflow-hidden"
                style={{ background: hlGroup === gr.group ? "var(--caos-accent)" : "color-mix(in srgb, var(--tranche-2l) 16%, transparent)", transition: "background 160ms" }}
              >
                <span className="tabular text-caos-2xs uppercase tracking-wider font-semibold whitespace-nowrap" style={{ color: hlGroup === gr.group ? "var(--caos-bg)" : "var(--caos-text)" }}>
                  {GROUPS_META[gr.group]}
                </span>
              </div>
            </div>
          ))}
        </div>
        {/* period labels */}
        <div role="row" className="flex sticky z-30 border-b border-caos-border" style={{ top: 24, background: "var(--caos-bg)" }}>
          <div
            role="presentation"
            className="sticky left-0 z-30 shrink-0 flex items-center justify-end pr-1 text-[9px] font-mono select-none"
            style={{ width: 24, background: "var(--caos-panel)", borderRight: "1px solid var(--caos-border)" }}
          />
          <div role="columnheader" className="sticky z-10 shrink-0 flex items-end justify-end pr-1.5 pb-0.5" style={{ left: 24, width: LBL, background: "var(--caos-bg)", borderRight: "1px solid var(--caos-border)" }}>
            {colDefs.some((c) => c.ctx.derived) ? (
              <span className="tabular text-[9px] leading-[10px] whitespace-nowrap select-none" style={{ color: "var(--caos-warning)" }}>* derived period</span>
            ) : null}
          </div>
          {colDefs.map((c, colIdx) => (
            <div key={c.key} role="columnheader" className="shrink-0 flex flex-col justify-end items-end pl-1 pr-1.5 pb-0.5" style={{ width: c.w, marginLeft: c.gap ? 8 : 0, borderRight: "1px solid var(--caos-border)" }}>
              <span className="tabular text-[9px] font-bold text-caos-accent leading-[10px] select-none">{getColLetter(colIdx)}</span>
              <span
                className="tabular text-caos-xs font-semibold whitespace-nowrap truncate"
                style={{ color: labelColor(c) }}
              >
                {c.ctx.label + (c.ctx.derived ? "*" : "")}
              </span>
            </div>
          ))}
        </div>

        {ROWS.filter((row) => !row.id || !hidden.has(row.id)).map((row, ri) => {
          if (row.sec) {
            rowCounter++;
            return (
              // Section dividers are visual banding, not data rows — presentation
              // keeps them out of the grid's aria-required-children contract.
              <div key={"s" + ri} role="presentation" className="flex mt-1.5">
                <div
                  className="sticky left-0 z-10 shrink-0 flex items-center justify-end pr-1 text-[9px] font-mono select-none"
                  style={{
                    width: 24,
                    background: "var(--caos-panel)",
                    borderRight: "1px solid var(--caos-border)",
                    borderBottom: "1px solid var(--caos-border)",
                    color: "var(--caos-muted)",
                  }}
                >
                  {rowCounter}
                </div>
                <div
                  className="sticky z-10 shrink-0 px-2 flex items-center"
                  style={{
                    left: 24,
                    width: LBL,
                    background: "var(--caos-bg)",
                    borderRight: "1px solid var(--caos-border)",
                    borderBottom: "1px solid var(--caos-border)",
                  }}
                >
                  <span className="text-caos-md font-semibold text-caos-text">{row.sec}</span>
                </div>
                {colDefs.map((c) => (
                  <div
                    key={c.key}
                    className="shrink-0 flex items-center"
                    style={{
                      width: c.w,
                      marginLeft: c.gap ? 8 : 0,
                      borderRight: "1px solid var(--caos-border)",
                      borderBottom: "1px solid var(--caos-border)",
                    }}
                  >
                    <div className="w-full mx-px h-[13px] rounded-sm" style={{ background: "color-mix(in srgb, var(--tranche-2l) 16%, transparent)" }}></div>
                  </div>
                ))}
              </div>
            );
          }
          rowCounter++;
          const rowIdx = rowCounter;
          const isHl = hl != null && row.src === hl;
          const collapsible = !!row.id && !!COLLAPSE_CHILDREN[row.id];
          const collapsed = !!row.id && !!collapsedRows?.has(row.id);
          return (
            <div
              key={row.id}
              role="row"
              onDoubleClick={() => collapsible && onToggleRow?.(row.id!)}
              className="flex group"
              style={{ background: isHl ? "color-mix(in srgb, var(--tranche-2l) 10%, transparent)" : "transparent" }}
            >
              <div
                role="presentation"
                className="sticky left-0 z-10 shrink-0 flex items-center justify-end pr-1 text-[9px] font-mono select-none"
                style={{
                  width: 24,
                  background: isHl ? "color-mix(in srgb, var(--caos-accent) 10%, var(--caos-bg))" : "var(--caos-panel)",
                  borderRight: "1px solid var(--caos-border)",
                  borderBottom: "1px solid var(--caos-border)",
                  color: "var(--caos-muted)",
                }}
              >
                {rowIdx}
              </div>
              <div
                role="rowheader"
                className="sticky z-10 shrink-0 flex items-baseline gap-1.5 px-2"
                style={{
                  left: 24,
                  width: LBL,
                  background: isHl ? "color-mix(in srgb, var(--caos-accent) 10%, var(--caos-bg))" : "var(--caos-bg)",
                  borderRight: "1px solid var(--caos-border)",
                  borderBottom: "1px solid var(--caos-border)",
                }}
              >
                {collapsible ? (
                  <button
                    onClick={() => onToggleRow?.(row.id!)}
                    aria-label={(collapsed ? "Expand " : "Collapse ") + row.l + " rows"}
                    aria-expanded={!collapsed}
                    title={(collapsed ? "Expand " : "Collapse ") + row.l + " rows"}
                    className="tabular text-caos-3xs text-caos-accent focus-ring"
                  >
                    {collapsed ? "▸" : "▾"}
                  </button>
                ) : null}
                <span className={"text-caos-sm leading-[15px] whitespace-nowrap " + (row.bold ? "font-semibold text-caos-text" : "text-caos-text/80")} style={{ paddingLeft: row.ind ? 8 : 0 }}>
                  {row.l}
                </span>
                {row.sub ? <span className="tabular text-caos-3xs text-caos-muted ml-auto whitespace-nowrap">{row.sub}</span> : null}
              </div>
              {colDefs.map((c) => renderCell(row.id!, c, { bold: row.bold, pct: row.pct, shade: row.shade, line: row.line, isHl }))}
            </div>
          );
        })}
        <div className="h-2"></div>
      </div>
    </div>
    </>
  );
}

/* ---------- formula bar ---------- */
// Flat sequence of conditional readouts (address, value, override badge, case
// note, source chips) — cyclomatic is inflated by display branches, not control
// flow. Extracting would scatter the bar's layout for no real simplification.
// fallow-ignore-next-line complexity
export function FormulaBar({
  model, sel, overrides, onResetCell, onOpenEvidence, showQ, collapsedRows, isReference = false,
}: {
  model: Model;
  sel: CellRef | null;
  /** Reserved for a future analyst severity dial; currently const 1 upstream. */
  severity?: number;
  overrides: Overrides;
  onResetCell: (key: string) => void;
  onOpenEvidence: (id: string) => void;
  showQ: boolean;
  collapsedRows: Set<string>;
  /** Reference (seeded Atlas Forge demo) vs live issuer. When false, ATLF-specific
   *  case notes + the netlev compliance-cert tail are suppressed. Default false. */
  isReference?: boolean;
}) {
  if (!sel) {
    return (
      <div className="h-8 shrink-0 rounded border border-caos-border bg-caos-panel/60 px-3 flex items-center gap-2">
        <span className="tabular text-caos-xl text-caos-muted">ƒ</span>
        <span className="tabular text-caos-sm text-caos-muted">select any cell to trace its formula and source lineage · double-click historical cells to override</span>
      </div>
    );
  }

  const row = ROWS.find((r) => r.id === sel.row)!;
  const ctx = model.cols[sel.col];
  // SRC is the seeded Atlas Forge module-output set (same registry the Manifest
  // gates): rendering its chips / L-04 warn / E-xx evidence for a live issuer
  // would fabricate lineage, so the whole chip block is reference-only.
  const src = isReference && row.src ? SRC[row.src] : null;
  const v = row.g!(ctx);
  const editable = isEditable(sel.row, sel.col);
  const ovKey = sel.col + ":" + ovField(sel.row);
  const isOv = editable && overrides && overrides[ovKey] != null;
  const caseNote = ctx.kind === "b"
    ? (isReference
        ? "base case = sponsor model − CP-6A chair haircut ($35M) − CP-1B phasing"
        : "base case = agent forecast")
    : ctx.kind === "d"
    ? (isReference
        ? "downside = CP-2B pathway P1 (OEM destocking)"
        : "downside = CP-2B first-order EBITDA-shock pathway")
    : ctx.derived
    ? (isReference
        ? "derived period — Q4-25 management accounts missing (gap G-02)"
        : "derived period")
    : null;

  // Formula string: keep `row.formula` generic; append the ATLF-specific
  // `refNote` (e.g. the Q1-26 compliance-cert tie) ONLY for the reference issuer.
  // A refNote-only row (no generic formula exists) shows the note for the
  // reference and falls through to the plain-source line for live issuers.
  const refText = isReference && row.refNote
    ? (row.formula ? row.formula + " · " + row.refNote : row.refNote)
    : row.formula;
  const formulaText = refText
    || `${row.l} — sourced from ${src ? src.name : "model logic"}`;

  // Calculate grid cell coordinate (e.g. C12)
  const colDefs = model.columns.filter((c) => showQ || c.group !== "Q");
  const colIdx = colDefs.findIndex((c) => c.key === sel.col);
  const colLetter = colIdx !== -1 ? getColLetter(colIdx) : "";

  const hidden = hiddenRows(collapsedRows);

  let visibleRowIndex = -1;
  let currentVisibleIndex = 0;
  for (const r of ROWS) {
    if (hidden.has(r.id ?? "")) continue;
    currentVisibleIndex++;
    if (r.id === sel.row) {
      visibleRowIndex = currentVisibleIndex;
      break;
    }
  }
  const cellCoord = colLetter && visibleRowIndex !== -1 ? `${colLetter}${visibleRowIndex}` : "";

  return (
    <div className="h-8 shrink-0 rounded border border-caos-accent/40 bg-caos-panel/60 px-3 flex items-center gap-2.5 overflow-x-auto overflow-y-hidden">
      <span className="tabular text-caos-xl text-caos-accent">ƒ</span>
      {cellCoord ? (
        <span className="tabular text-caos-xs px-1.5 py-0.5 rounded bg-caos-elevated border border-caos-accent/40 text-caos-accent font-semibold select-none">
          {cellCoord}
        </span>
      ) : null}
      <span className="tabular text-caos-md text-caos-text whitespace-nowrap">{row.l} · {ctx.label}</span>
      <span className="tabular text-caos-md text-caos-accent whitespace-nowrap">{fmt(v, row.f) || "—"}</span>
      <span className="w-px h-4 bg-caos-border shrink-0"></span>
      {isOv ? (
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="tabular text-caos-xs uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap" style={{ color: "var(--caos-warning)", borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)", background: "color-mix(in srgb, var(--caos-warning) 8%, transparent)" }}>
            MANUAL OVERRIDE
          </span>
          <span className="text-caos-sm text-caos-muted whitespace-nowrap">analyst input replaces sourced actual · aggregates recomputed</span>
          <button
            onClick={() => onResetCell(ovKey)}
            className="tabular text-caos-xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos whitespace-nowrap"
          >
            RESET CELL
          </button>
        </span>
      ) : (
        <span className="text-caos-sm text-caos-muted truncate">{formulaText}</span>
      )}
      {!isOv && editable ? <span className="tabular text-caos-xs whitespace-nowrap text-caos-accent">✎ historical input — double-click to override</span> : null}
      {caseNote ? (
        <span className="tabular text-caos-xs whitespace-nowrap" style={{ color: ctx.kind === "d" || ctx.derived ? "var(--caos-warning)" : "var(--caos-success)" }}>
          ▸ {caseNote}
        </span>
      ) : null}
      <span className="flex-1"></span>
      {src ? (
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">{src.chip}</span>
          {src.warn ? (
            <span className="tabular text-caos-xs uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap" style={{ color: "var(--caos-warning)", borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)", background: "color-mix(in srgb, var(--caos-warning) 8%, transparent)" }}>
              {src.warn}
            </span>
          ) : null}
          {src.ev.map((e) => <EvChip key={e} id={e} onOpen={onOpenEvidence} />)}
        </span>
      ) : null}
    </div>
  );
}

/* ---------- build manifest strip ---------- */
export function Manifest({ hl, setHl, isReference = false }: { hl: string | null; setHl: (k: string | null) => void; isReference?: boolean }) {
  // The SRC registry is the seeded Atlas Forge module output set. Presenting it
  // as a live issuer's sources would fabricate lineage, so for live issuers the
  // ATLF manifest strip renders nothing (a followup can add real per-issuer
  // sources). Reference issuer keeps the full traceable chip strip.
  if (!isReference) return null;
  return (
    <div className="h-9 shrink-0 rounded border border-caos-border bg-caos-panel/60 px-3 flex items-center gap-2 overflow-x-auto">
      <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap">Built from</span>
      {Object.entries(SRC).map(([k, s]) => (
        <button
          key={k}
          onClick={() => setHl(hl === k ? null : k)}
          title={s.name + (s.note ? " · " + s.note : "")}
          className={
            "flex items-center gap-1.5 tabular text-caos-xs px-2 py-1 rounded border transition-caos whitespace-nowrap " +
            (hl === k ? "border-caos-accent bg-caos-elevated text-caos-text" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
          }
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.warn ? "var(--caos-warning)" : "var(--caos-success)" }} />
          {s.chip}
        </button>
      ))}
      <span className="flex-1"></span>
      <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">click a module to trace which rows it feeds</span>
    </div>
  );
}
