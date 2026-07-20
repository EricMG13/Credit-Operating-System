"use client";

// Model Builder sheet grid + formula bar + manifest strip
// (port of design bundle concept-d.jsx Sheet / FormulaBar / Manifest).
// Sourced cash-flow grid: every cell traces to an upstream module; historical
// cells are double-click editable (manual overrides), forecast cells are derived.

import { useMemo } from "react";
import type { Model, ModelCol } from "@/lib/reports/model";
import type { Overrides } from "@/lib/reports/model";
import { EvChip } from "@/components/reports/EvChip";
import { ROWS, SRC } from "./rows";
import { buildPastePatch, CW, fmt, GROUPS_META, isEditable, LBL, ovField, type PasteResult } from "./model-format";
import { cellBackground, cellBoxShadow, cellTextColor, kpiDistressLevel, KPI_DISTRESS_GLYPH } from "./cell-style";
import { useScrollOwner } from "@/lib/use-scroll-owner";

export interface CellRef {
  row: string;
  col: string;
}

function getColLetter(idx: number): string {
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
      name="model-cell-editor"
      autoComplete="off"
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
const GROUP_GUTTER = 10;

function hiddenRows(collapsedRows: Set<string> | undefined): Set<string> {
  return new Set(
    Object.entries(COLLAPSE_CHILDREN).flatMap(([parent, kids]) => (collapsedRows?.has(parent) ? kids : [])),
  );
}

type RowDef = (typeof ROWS)[number];
type CellOptions = { bold?: 1; pct?: 1; shade?: 1; line?: 1; isHl?: boolean };
interface GroupDef { group: string; w: number; n: number; gap: boolean }

interface SheetProps {
  model: Model;
  showQ: boolean;
  hl: string | null;
  hlCells?: Set<string> | null;
  sel: CellRef | null;
  onSel: (selection: CellRef) => void;
  editing: CellRef | null;
  onEdit: (selection: CellRef) => void;
  onCommit: (value: string | null) => void;
  collapsedRows?: Set<string>;
  onToggleRow?: (row: string) => void;
  onPasteCells?: (result: PasteResult) => void;
  isReference?: boolean;
}

function buildColumnDefinitions(model: Model, showQ: boolean): ColDef[] {
  const columns = model.columns.filter((column) => showQ || column.group !== "Q");
  return columns.map((column, index) => ({
    ...column, ctx: model.cols[column.key], w: CW[column.group],
    gap: index > 0 && columns[index - 1].group !== column.group,
  }));
}

function buildGroups(columns: ColDef[]): GroupDef[] {
  const groups: GroupDef[] = [];
  columns.forEach((column) => {
    const last = groups[groups.length - 1];
    if (last?.group === column.group) { last.w += column.w; last.n += 1; }
    else groups.push({ group: column.group, w: column.w, n: 1, gap: column.gap });
  });
  return groups;
}

function columnLabelColor(column: ColDef) {
  if (column.ctx.derived) return "var(--caos-warning)";
  if (column.group === "BASE") return "var(--caos-success)";
  return column.group === "DOWN" ? "var(--caos-warning)" : "var(--caos-muted)";
}

function tabDestination(row: number, col: number, rowCount: number, colCount: number, backwards: boolean) {
  if (backwards && col > 0) return { row, col: col - 1 };
  if (backwards && row > 0) return { row: row - 1, col: colCount - 1 };
  if (!backwards && col < colCount - 1) return { row, col: col + 1 };
  if (!backwards && row < rowCount - 1) return { row: row + 1, col: 0 };
  return null;
}

function arrowDestination(key: string, row: number, col: number, rowCount: number, colCount: number) {
  if (key === "ArrowUp") return { row: Math.max(0, row - 1), col };
  if (key === "ArrowDown") return { row: Math.min(rowCount - 1, row + 1), col };
  if (key === "ArrowLeft") return { row, col: Math.max(0, col - 1) };
  if (key === "ArrowRight") return { row, col: Math.min(colCount - 1, col + 1) };
  return null;
}

function handleSheetKeyDown(event: React.KeyboardEvent, props: Pick<SheetProps, "editing" | "sel" | "onSel" | "onEdit">, rowIds: string[], colKeys: string[]) {
  if (props.editing || !props.sel || !rowIds.length || !colKeys.length) return;
  const row = rowIds.indexOf(props.sel.row);
  const col = colKeys.indexOf(props.sel.col);
  if (row < 0 || col < 0) return;
  if (event.key === "Escape") { event.preventDefault(); (event.currentTarget as HTMLElement).focus(); return; }
  if (event.key === "Enter") {
    event.preventDefault();
    if (isEditable(props.sel.row, props.sel.col)) props.onEdit(props.sel);
    props.onSel(props.sel);
    return;
  }
  const destination = event.key === "Tab"
    ? tabDestination(row, col, rowIds.length, colKeys.length, event.shiftKey)
    : arrowDestination(event.key, row, col, rowIds.length, colKeys.length);
  if (!destination) return;
  event.preventDefault();
  props.onSel({ row: rowIds[destination.row], col: colKeys[destination.col] });
}

function handleSheetPaste(event: React.ClipboardEvent, editing: CellRef | null, selection: CellRef | null, onPasteCells: SheetProps["onPasteCells"], rowIds: string[], colKeys: string[]) {
  if (editing || !selection || !onPasteCells) return;
  const text = event.clipboardData.getData("text/plain");
  if (text) onPasteCells(buildPastePatch(rowIds, colKeys, selection, text));
}

function cellDomId(rowId: string, colKey: string) {
  return `cell-${rowId}-${colKey}`;
}

function selectionDescription(model: Model, selection: CellRef | null) {
  if (!selection) return "";
  const row = ROWS.find((candidate) => candidate.id === selection.row);
  const context = model.cols[selection.col];
  if (!row || !context) return "";
  const value = row.g ? row.g(context) : null;
  return `${row.l} · ${context.label} · ${fmt(value, row.f) || "—"}`;
}

function CellValue({ value, row, options, isOverride }: { value: number | null; row: RowDef; options: CellOptions; isOverride: boolean }) {
  const color = cellTextColor({ rowId: row.id!, v: value, isOv: isOverride, pct: Boolean(options.pct), bold: Boolean(options.bold), rowFmt: row.f });
  const distress = kpiDistressLevel(row.id!, value);
  const glyph = distress ? KPI_DISTRESS_GLYPH[distress] : null;
  return (
    <span className={`tabular text-caos-xs leading-[15px] whitespace-nowrap ${options.bold ? "font-bold" : ""}`} style={{ color, borderBottom: isOverride ? "1px dotted var(--caos-warning)" : "none" }}>
      {glyph ? <span aria-hidden className="mr-0.5" style={{ fontSize: "0.75em" }}>{glyph}</span> : null}
      {fmt(value, row.f)}
    </span>
  );
}

function matchesCell(ref: CellRef | null, row: string, col: string) {
  return ref?.row === row && ref.col === col;
}

function deriveSheetCellState(row: RowDef, column: ColDef, sel: CellRef | null, editing: CellRef | null, hlCells?: Set<string> | null) {
  const rowId = row.id!;
  const editable = isEditable(rowId, column.key);
  return {
    rowId, editable, value: row.g!(column.ctx) ?? null,
    selected: matchesCell(sel, rowId, column.key),
    editing: matchesCell(editing, rowId, column.key),
    highlighted: Boolean(hlCells?.has(`${rowId}:${column.key}`)),
    overridden: editable && Boolean(column.ctx.ov?.[ovField(rowId)]),
  };
}

function sheetCellStyle(column: ColDef, options: CellOptions, state: ReturnType<typeof deriveSheetCellState>, hlGroup?: string) {
  return {
    width: column.w,
    marginLeft: column.gap ? GROUP_GUTTER : 0,
    background: cellBackground({ isSel: state.selected, cellHl: state.highlighted, colHl: hlGroup === column.group, isHl: Boolean(options.isHl), shade: Boolean(options.shade) }),
    borderRight: "1px solid var(--caos-border)", borderBottom: "1px solid var(--caos-border)",
    boxShadow: cellBoxShadow(state.selected, state.highlighted),
  };
}

function SheetCell({ row, column, options, hlGroup, hlCells, sel, editing, onSel, onEdit, onCommit }: { row: RowDef; column: ColDef; options: CellOptions; hlGroup?: string; hlCells?: Set<string> | null; sel: CellRef | null; editing: CellRef | null; onSel: (selection: CellRef) => void; onEdit: (selection: CellRef) => void; onCommit: (value: string | null) => void }) {
  const state = deriveSheetCellState(row, column, sel, editing, hlCells);
  const selection = { row: state.rowId, col: column.key };
  const openEditor = (event: React.MouseEvent) => {
    if (!state.editable) return;
    event.stopPropagation(); onEdit(selection);
  };
  return (
    <div id={cellDomId(state.rowId, column.key)} role="gridcell" aria-selected={state.selected} onClick={() => onSel(selection)} onDoubleClick={openEditor} title={state.editable ? "double-click to override" : undefined} className="shrink-0 text-right pr-1.5 cursor-cell" data-key-account={options.bold ? "true" : undefined} style={sheetCellStyle(column, options, state, hlGroup)}>
      {state.editing
        ? <CellInput initial={state.value == null ? "" : String(Math.round(state.value * 10) / 10)} label={`Edit ${row.l}, ${column.ctx.label}`} onCommit={onCommit} />
        : <CellValue value={state.value} row={row} options={options} isOverride={state.overridden} />}
    </div>
  );
}

function GroupHeader({ groups, hlGroup }: { groups: GroupDef[]; hlGroup?: string }) {
  return (
    <div role="row" className="flex sticky top-0 z-30" style={{ background: "var(--caos-bg)" }}>
      <div role="presentation" className="sticky left-0 z-30 shrink-0 flex items-center justify-end pr-1 text-[9px] font-mono select-none" style={{ width: 24, background: "var(--caos-panel)", borderRight: "1px solid var(--caos-border)" }} />
      <div role="columnheader" className="sticky z-10 shrink-0 px-2 flex items-center" style={{ left: 24, width: LBL, background: "var(--caos-bg)", borderRight: "1px solid var(--caos-border)" }}><span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap overflow-hidden">YE 31-Dec · $m</span></div>
      {groups.map((group) => (
        <div key={group.group} role="columnheader" className="shrink-0 flex items-center justify-center" data-period-group={group.group} style={{ width: group.w, marginLeft: group.gap ? GROUP_GUTTER : 0 }}>
          <div className="w-full mx-px h-[18px] my-[3px] flex items-center justify-center rounded-sm overflow-hidden" style={{ background: hlGroup === group.group ? "var(--caos-accent)" : "color-mix(in srgb, var(--tranche-2l) 16%, transparent)", transition: "background 160ms" }}>
            <span className="tabular text-caos-2xs uppercase tracking-wider font-semibold whitespace-nowrap" style={{ color: hlGroup === group.group ? "var(--caos-bg)" : "var(--caos-text)" }}>{GROUPS_META[group.group]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PeriodHeader({ columns }: { columns: ColDef[] }) {
  return (
    <div role="row" className="flex sticky z-30 border-b border-caos-border" style={{ top: 24, background: "var(--caos-bg)" }}>
      <div role="presentation" className="sticky left-0 z-30 shrink-0 flex items-center justify-end pr-1 text-[9px] font-mono select-none" style={{ width: 24, background: "var(--caos-panel)", borderRight: "1px solid var(--caos-border)" }} />
      <div role="columnheader" className="sticky z-10 shrink-0 flex items-end justify-end pr-1.5 pb-0.5" style={{ left: 24, width: LBL, background: "var(--caos-bg)", borderRight: "1px solid var(--caos-border)" }}>
        {columns.some((column) => column.ctx.derived) ? <span className="tabular text-caos-2xs leading-[11px] whitespace-nowrap select-none" style={{ color: "var(--caos-warning)" }}>* derived period</span> : null}
      </div>
      {columns.map((column, index) => (
        <div key={column.key} role="columnheader" className="shrink-0 flex flex-col justify-end items-end pl-1 pr-1.5 pb-0.5" data-period-group-start={column.gap ? column.group : undefined} style={{ width: column.w, marginLeft: column.gap ? GROUP_GUTTER : 0, borderRight: "1px solid var(--caos-border)" }}>
          <span className="tabular text-[9px] font-bold text-caos-accent leading-[10px] select-none">{getColLetter(index)}</span>
          <span className="tabular text-caos-xs font-semibold whitespace-nowrap truncate" style={{ color: columnLabelColor(column) }}>{column.ctx.label + (column.ctx.derived ? "*" : "")}</span>
        </div>
      ))}
    </div>
  );
}

function SectionRow({ row, rowNumber, columns }: { row: RowDef; rowNumber: number; columns: ColDef[] }) {
  return (
    <div role="presentation" className="flex mt-1.5">
      <div className="sticky left-0 z-10 shrink-0 flex items-center justify-end pr-1 text-[9px] font-mono select-none" style={{ width: 24, background: "var(--caos-panel)", borderRight: "1px solid var(--caos-border)", borderBottom: "1px solid var(--caos-border)", color: "var(--caos-muted)" }}>{rowNumber}</div>
      <div className="sticky z-10 shrink-0 px-2 flex items-center" style={{ left: 24, width: LBL, background: "var(--caos-bg)", borderRight: "1px solid var(--caos-border)", borderBottom: "1px solid var(--caos-border)" }}><span className="text-caos-md font-semibold text-caos-text">{row.sec}</span></div>
      {columns.map((column) => <div key={column.key} className="shrink-0 flex items-center" style={{ width: column.w, marginLeft: column.gap ? GROUP_GUTTER : 0, borderRight: "1px solid var(--caos-border)", borderBottom: "1px solid var(--caos-border)" }}><div className="w-full mx-px h-[13px] rounded-sm" style={{ background: "color-mix(in srgb, var(--tranche-2l) 16%, transparent)" }} /></div>)}
    </div>
  );
}

function DataRowLabel({ row, highlighted, collapsed, collapsible, onToggleRow }: { row: RowDef; highlighted: boolean; collapsed: boolean; collapsible: boolean; onToggleRow?: (row: string) => void }) {
  const label = <span className={`text-caos-sm leading-[15px] whitespace-nowrap ${row.bold ? "font-bold text-caos-text" : "text-caos-text/80"}`} style={{ paddingLeft: row.ind ? 8 : 0 }}>{row.l}</span>;
  return (
    <div role="rowheader" className="sticky z-10 shrink-0 flex items-baseline gap-1.5 px-2" style={{ left: 24, width: LBL, background: highlighted ? "color-mix(in srgb, var(--caos-accent) 10%, var(--caos-bg))" : "var(--caos-bg)", borderRight: "1px solid var(--caos-border)", borderBottom: "1px solid var(--caos-border)" }}>
      {collapsible ? <button type="button" onClick={() => onToggleRow?.(row.id!)} aria-label={`${collapsed ? "Expand" : "Collapse"} ${row.l} rows`} aria-expanded={!collapsed} title={`${collapsed ? "Expand" : "Collapse"} ${row.l} rows`} className="flex min-h-6 min-w-0 items-center gap-1.5 rounded text-left focus-ring"><span className="tabular text-caos-3xs text-caos-accent" aria-hidden="true">{collapsed ? "▸" : "▾"}</span>{label}</button> : label}
      {row.sub ? <span className="tabular text-caos-3xs text-caos-muted ml-auto whitespace-nowrap">{row.sub}</span> : null}
    </div>
  );
}

function DataRow({ row, rowNumber, columns, hl, hlGroup, hlCells, collapsedRows, onToggleRow, sel, editing, onSel, onEdit, onCommit }: { row: RowDef; rowNumber: number; columns: ColDef[]; hl: string | null; hlGroup?: string; hlCells?: Set<string> | null; collapsedRows?: Set<string>; onToggleRow?: (row: string) => void; sel: CellRef | null; editing: CellRef | null; onSel: (selection: CellRef) => void; onEdit: (selection: CellRef) => void; onCommit: (value: string | null) => void }) {
  const highlighted = hl != null && row.src === hl;
  const collapsible = Boolean(row.id && COLLAPSE_CHILDREN[row.id]);
  const collapsed = Boolean(row.id && collapsedRows?.has(row.id));
  const options = { bold: row.bold, pct: row.pct, shade: row.shade, line: row.line, isHl: highlighted };
  return (
    <div role="row" className="flex group" style={{ background: highlighted ? "color-mix(in srgb, var(--tranche-2l) 10%, transparent)" : "transparent" }}>
      <div role="presentation" className="sticky left-0 z-10 shrink-0 flex items-center justify-end pr-1 text-[9px] font-mono select-none" style={{ width: 24, background: highlighted ? "color-mix(in srgb, var(--caos-accent) 10%, var(--caos-bg))" : "var(--caos-panel)", borderRight: "1px solid var(--caos-border)", borderBottom: "1px solid var(--caos-border)", color: "var(--caos-muted)" }}>{rowNumber}</div>
      <DataRowLabel row={row} highlighted={highlighted} collapsed={collapsed} collapsible={collapsible} onToggleRow={onToggleRow} />
      {columns.map((column) => <SheetCell key={column.key} row={row} column={column} options={options} hlGroup={hlGroup} hlCells={hlCells} sel={sel} editing={editing} onSel={onSel} onEdit={onEdit} onCommit={onCommit} />)}
    </div>
  );
}

function SheetRows({ hidden, ...props }: { hidden: Set<string>; columns: ColDef[]; hl: string | null; hlGroup?: string; hlCells?: Set<string> | null; collapsedRows?: Set<string>; onToggleRow?: (row: string) => void; sel: CellRef | null; editing: CellRef | null; onSel: (selection: CellRef) => void; onEdit: (selection: CellRef) => void; onCommit: (value: string | null) => void }) {
  const rows = ROWS.filter((row) => !row.id || !hidden.has(row.id));
  return <>{rows.map((row, index) => row.sec ? <SectionRow key={`section-${index}`} row={row} rowNumber={index + 1} columns={props.columns} /> : <DataRow key={row.id} row={row} rowNumber={index + 1} {...props} />)}</>;
}

function SelectionAnnouncement({ summary }: { summary: string }) {
  return <div className="sr-only" aria-live="polite">{summary ? `Selected ${summary}` : ""}</div>;
}

function SheetGrid({ props, columns, groups, hidden, hlGroup, rowIds, colKeys, selectionSummary }: { props: SheetProps; columns: ColDef[]; groups: GroupDef[]; hidden: Set<string>; hlGroup?: string; rowIds: string[]; colKeys: string[]; selectionSummary: string }) {
  const { hl, hlCells, sel, onSel, editing, onEdit, onCommit, collapsedRows, onToggleRow, onPasteCells } = props;
  return (
    <>
      <SelectionAnnouncement summary={selectionSummary} />
      <div tabIndex={0} role="grid" aria-label="Model worksheet" aria-activedescendant={sel ? cellDomId(sel.row, sel.col) : undefined} onKeyDown={(event) => handleSheetKeyDown(event, { editing, sel, onSel, onEdit }, rowIds, colKeys)} onPaste={(event) => handleSheetPaste(event, editing, sel, onPasteCells, rowIds, colKeys)} className="flex-1 min-h-0 overflow-auto rounded border border-caos-border bg-caos-bg focus-ring">
        <div style={{ width: "max-content", minWidth: "100%" }}>
          <GroupHeader groups={groups} hlGroup={hlGroup} />
          <PeriodHeader columns={columns} />
          <SheetRows hidden={hidden} columns={columns} hl={hl} hlGroup={hlGroup} hlCells={hlCells} collapsedRows={collapsedRows} onToggleRow={onToggleRow} sel={sel} editing={editing} onSel={onSel} onEdit={onEdit} onCommit={onCommit} />
          <div className="h-2" />
        </div>
      </div>
    </>
  );
}

export function Sheet(props: SheetProps) {
  const { model, showQ, hl, collapsedRows } = props;
  const colDefs = useMemo(() => buildColumnDefinitions(model, showQ), [model, showQ]);
  const groups = useMemo(() => buildGroups(colDefs), [colDefs]);

  const hlGroup = hl && SRC[hl] ? SRC[hl].colGroup : undefined;
  const hidden = hiddenRows(collapsedRows);
  // Same visible-row order keyboard nav (handleKeyDown) and multi-cell paste
  // both walk — a paste block must never disagree with where arrow keys land.
  const rowIds = useMemo(
    () => ROWS.filter((row) => row.id && !hidden.has(row.id)).map((r) => r.id!),
    [hidden],
  );
  const colKeys = useMemo(() => colDefs.map((c) => c.key), [colDefs]);

  return <SheetGrid props={props} columns={colDefs} groups={groups} hidden={hidden} hlGroup={hlGroup} rowIds={rowIds} colKeys={colKeys} selectionSummary={selectionDescription(model, props.sel)} />;
}

/* ---------- formula bar ---------- */
// Flat sequence of conditional readouts (address, value, override badge, case
// note, source chips) — cyclomatic is inflated by display branches, not control
// flow. Extracting would scatter the bar's layout for no real simplification.
// fallow-ignore-next-line complexity -- Formula-bar layout and keyboard flow are one worksheet affordance.
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
  const formulaScroll = useScrollOwner<HTMLDivElement>();
  if (!sel) {
    return (
      <div ref={formulaScroll.ref} tabIndex={formulaScroll.scrollable ? 0 : undefined} role={formulaScroll.scrollable ? "region" : undefined} aria-label={formulaScroll.scrollable ? "Model formula and source lineage" : undefined} className={`h-8 shrink-0 rounded border border-caos-border bg-caos-panel/60 px-3 flex items-center gap-2 overflow-x-auto${formulaScroll.scrollable ? " focus-ring" : ""}`}>
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
    <div ref={formulaScroll.ref} tabIndex={formulaScroll.scrollable ? 0 : undefined} role={formulaScroll.scrollable ? "region" : undefined} aria-label={formulaScroll.scrollable ? "Model formula and source lineage" : undefined} className={`h-8 shrink-0 rounded border border-caos-accent/40 bg-caos-panel/60 px-3 flex items-center gap-2.5 overflow-x-auto overflow-y-hidden${formulaScroll.scrollable ? " focus-ring" : ""}`}>
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
        <span className="text-caos-sm text-caos-muted truncate" title={typeof formulaText === "string" ? formulaText : undefined}>{formulaText}</span>
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
  const manifestScroll = useScrollOwner<HTMLDivElement>();
  // The SRC registry is the seeded Atlas Forge module output set. Presenting it
  // as a live issuer's sources would fabricate lineage, so for live issuers the
  // ATLF manifest strip renders nothing (a followup can add real per-issuer
  // sources). Reference issuer keeps the full traceable chip strip.
  if (!isReference) return null;
  return (
    <div ref={manifestScroll.ref} tabIndex={manifestScroll.scrollable ? 0 : undefined} role={manifestScroll.scrollable ? "region" : undefined} aria-label={manifestScroll.scrollable ? "Model source manifest" : undefined} className={`h-9 shrink-0 rounded border border-caos-border bg-caos-panel/60 px-3 flex items-center gap-2 overflow-x-auto${manifestScroll.scrollable ? " focus-ring" : ""}`}>
      <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap" title="Click a module chip to trace which model rows it feeds">Built from</span>
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
    </div>
  );
}
