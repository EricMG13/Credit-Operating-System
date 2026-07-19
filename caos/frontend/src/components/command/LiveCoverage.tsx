"use client";

// Live coverage board — the engine-derived counterpart to the seeded sample
// PortfolioTable. Shows each covered issuer's latest-complete-run FUNDAMENTALS
// (net leverage, interest coverage, CP-3 RV posture, CP-2B downside fragility,
// QA status). Deliberately NOT a clone of the sample board: the market columns
// (price / DM / Δ d/d / M2E) are an external pricing feed (Phase-2,
// docs/PHASE2_SCOPE.md) and are simply absent here, not faked.

import type { PortfolioRowDTO } from "@/lib/api";
import { useEffect, useMemo, useState, useRef } from "react";
import { FilterHeader, updateColumnFilter, useColumnFilters, type FilterState, type SortState } from "@/components/shared/TableColumnFilter";
import { useVirtualScroll } from "@/lib/useVirtualScroll";
import { fmtMult } from "@/lib/format";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { useRovingFocus, type RovingItemProps } from "@/lib/useRovingFocus";
import { focusFirstRowAction, syncRowActionTabStops } from "@/lib/rowActionMode";

// Shared formatter (lib/format.fmtMult): same 1-dp + "x" + em-dash fallback;
// the local copy could drift from every other multiple on the desk. Exported:
// the IssuerStrip live variant formats the same run metrics.
export const fmtX = (v: number | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? fmtMult(v) : "—";

// Fragility / posture meaning never rides on colour alone — the word travels too.
// Exported: the IssuerStrip live variant renders the same fields with the same coding.
export const FRAGILITY_COLOR: Record<string, string> = {
  HIGH: "var(--caos-critical)", MODERATE: "var(--caos-warning)", LOW: "var(--caos-success)",
};
export const RV_COLOR: Record<string, string> = {
  OVERWEIGHT: "var(--caos-success)", NEUTRAL: "var(--caos-muted)", UNDERWEIGHT: "var(--caos-critical)",
};
// Keys are the server's qa_status vocabulary (engine/gate.py: "Not Reviewed" /
// "Passed" / "Restricted" / "Blocked") — the previous keys ("Pass", "Ready with
// Limitations") never matched, so a Restricted run rendered the same muted grey
// as a Passed one on this clearance surface.
export const QA_COLOR: Record<string, string> = {
  Passed: "var(--caos-success)", Restricted: "var(--caos-warning)",
  Blocked: "var(--caos-critical)",
};

const COLS = "grid grid-cols-[1.6fr_1fr_0.7fr_0.7fr_1fr_0.9fr_1fr] gap-2 items-center";
const HEADS = [
  ["Issuer", "issuer"], ["Sector", "sector"], ["NetLev", "netlev"], ["IntCov", "intcov"],
  ["RV posture", "rv"], ["Fragility", "fragility"], ["QA", "qa"],
] as const;
const VALUES: Record<string, (row: PortfolioRowDTO) => string | number | null | undefined> = {
  issuer: (row) => row.name,
  sector: (row) => row.sector,
  netlev: (row) => row.metrics.net_leverage,
  intcov: (row) => row.metrics.interest_coverage,
  rv: (row) => row.rv_recommendation,
  fragility: (row) => row.downside_fragility,
  qa: (row) => row.qa_status,
};

function sortCoverageRows(rows: PortfolioRowDTO[], sort: SortState): PortfolioRowDTO[] {
  if (!sort) return rows;
  const getValue = VALUES[sort.col];
  if (!getValue) return rows;
  const direction = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const a = getValue(left);
    const b = getValue(right);
    if (a == null || a === "") return b == null || b === "" ? 0 : 1;
    if (b == null || b === "") return -1;
    if (typeof a === "number" && typeof b === "number") return direction * (a - b);
    return direction * String(a).localeCompare(String(b));
  });
}

function nextCoverageSort(current: SortState, column: string): SortState {
  if (current?.col !== column) return { col: column, dir: "asc" };
  return current.dir === "asc" ? { col: column, dir: "desc" } : null;
}

function navigationTarget(key: string, currentIndex: number, count: number): number | null {
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowUp") return Math.max(0, currentIndex - 1);
  if (key === "ArrowDown") return Math.min(count - 1, currentIndex + 1);
  return null;
}

type CoverageKeyboardContext = {
  actionMode: boolean;
  rowId: string;
  rowIds: string[];
  activate: () => void;
  setActionMode: (active: boolean) => void;
  moveTo: (rowId: string, index: number) => void;
};

function exitCoverageActionMode(event: React.KeyboardEvent, context: CoverageKeyboardContext): boolean {
  if (event.key !== "Escape" || !context.actionMode) return false;
  event.preventDefault();
  context.setActionMode(false);
  (event.currentTarget as HTMLElement).focus();
  return true;
}

function enterCoverageActionMode(event: React.KeyboardEvent, context: CoverageKeyboardContext): boolean {
  if (event.key !== "F2") return false;
  if (focusFirstRowAction(event.currentTarget as HTMLElement)) {
    event.preventDefault();
    context.setActionMode(true);
  }
  return true;
}

function moveCoverageRow(event: React.KeyboardEvent, context: CoverageKeyboardContext): boolean {
  const index = navigationTarget(event.key, context.rowIds.indexOf(context.rowId), context.rowIds.length);
  if (index === null) return false;
  event.preventDefault();
  context.setActionMode(false);
  context.moveTo(context.rowIds[index], index);
  return true;
}

function handleCoverageRowKey(event: React.KeyboardEvent, context: CoverageKeyboardContext): void {
  if (exitCoverageActionMode(event, context)) return;
  if (event.currentTarget !== event.target) return;
  if (enterCoverageActionMode(event, context) || moveCoverageRow(event, context)) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  context.activate();
}

function fragilityText(fragility: string | null | undefined): string {
  if (!fragility) return "—";
  const glyph = fragility === "HIGH" ? "▲" : fragility === "MODERATE" ? "■" : "●";
  return `${glyph} ${fragility}`;
}

function CoverageCells({ row }: { row: PortfolioRowDTO }) {
  const rv = row.rv_recommendation;
  const fragility = row.downside_fragility;
  return (
    <>
      <span role="rowheader" className="flex items-center gap-1.5 min-w-0">
        <IssuerLink issuer={{ id: row.issuer_id }} className="tabular text-caos-accent focus-ring rounded" title={`Open ${row.name} profile`}>{row.ticker || "—"}</IssuerLink>
        <IssuerLink issuer={{ id: row.issuer_id }} className="text-caos-text truncate text-caos-md focus-ring rounded" title={`Open ${row.name} profile`}>{row.name}</IssuerLink>
      </span>
      <span role="gridcell" className="text-caos-muted text-caos-md truncate">{row.sector || "—"}</span>
      <span role="gridcell" className="tabular text-right">{fmtX(row.metrics.net_leverage)}</span>
      <span role="gridcell" className="tabular text-right">{fmtX(row.metrics.interest_coverage)}</span>
      <span role="gridcell" className="tabular text-caos-xs tracking-wide" style={{ color: rv ? RV_COLOR[rv] ?? "var(--caos-text)" : "var(--caos-muted)" }}>{rv ?? "—"}{typeof row.rv_percentile === "number" ? ` · p${Math.round(row.rv_percentile)}` : ""}</span>
      <span role="gridcell" className="tabular text-caos-xs tracking-wide" style={{ color: fragility ? FRAGILITY_COLOR[fragility] : "var(--caos-muted)" }}>{fragilityText(fragility)}</span>
      <span role="gridcell" className="tabular text-caos-2xs px-1 py-px rounded border whitespace-nowrap justify-self-start" style={{ color: QA_COLOR[row.qa_status] ?? "var(--caos-muted)", borderColor: QA_COLOR[row.qa_status] ?? "var(--caos-border)" }} title={`Committee: ${row.committee_status}`}>{row.qa_status}</span>
    </>
  );
}

function CoverageRow({ row, visibleIndex, startIndex, selected, actionMode, focusProps, rowIds, rowRefs, onActivate, onActionMode, onMove }: {
  row: PortfolioRowDTO; visibleIndex: number; startIndex: number; selected: boolean; actionMode: boolean; focusProps: RovingItemProps;
  rowIds: string[]; rowRefs: { current: Map<string, HTMLDivElement> }; onActivate: () => void; onActionMode: (active: boolean) => void; onMove: (rowId: string, index: number) => void;
}) {
  const rowId = row.issuer_id;
  const register = (element: HTMLDivElement | null) => {
    focusProps.ref(element);
    if (element) {
      rowRefs.current.set(rowId, element);
      syncRowActionTabStops(element, actionMode);
    } else rowRefs.current.delete(rowId);
  };
  return (
    <div
      role="row"
      ref={register}
      tabIndex={actionMode ? -1 : focusProps.tabIndex}
      onFocus={focusProps.onFocus}
      onBlur={(event) => { if (actionMode && !event.currentTarget.contains(event.relatedTarget as Node | null)) onActionMode(false); }}
      onClick={(event) => { if (!(event.target as HTMLElement).closest("a, button, input, select, textarea, [role='button'], [role='link']")) onActivate(); }}
      onKeyDown={(event) => handleCoverageRowKey(event, { actionMode, rowId, rowIds, activate: onActivate, setActionMode: onActionMode, moveTo: onMove })}
      aria-rowindex={startIndex + visibleIndex + 2}
      aria-selected={selected}
      aria-keyshortcuts="F2"
      aria-describedby="live-coverage-grid-help"
      aria-label={`${row.ticker || ""} ${row.name || ""} details`}
      className={COLS + " px-3 py-[3px] border-b border-caos-border/50 transition-caos cursor-pointer focus-ring outline-none " + (selected ? "bg-caos-accent/10 border-caos-accent/30 text-caos-text" : "hover:bg-caos-panel/30 text-caos-text")}
    >
      <CoverageCells row={row} />
    </div>
  );
}

function useSelectedCoverageFocus(selected: string | null, visibleIds: string[], setActiveId: (id: string) => void): void {
  useEffect(() => {
    if (selected && visibleIds.includes(selected)) setActiveId(selected);
  }, [selected, setActiveId, visibleIds]);
}

function useCoverageActionSync(actionRowId: string | null, setActionRowId: (id: string | null) => void, visibleIds: string[], rowIds: string[], rowRefs: { current: Map<string, HTMLDivElement> }): void {
  useEffect(() => {
    if (actionRowId && !visibleIds.includes(actionRowId)) setActionRowId(null);
    for (const [id, row] of rowRefs.current) syncRowActionTabStops(row, actionRowId === id);
  }, [actionRowId, rowIds, rowRefs, setActionRowId, visibleIds]);
}

function usePendingCoverageFocus(activeId: string | null, visibleIds: string[], setActiveId: (id: string) => void, pendingFocusId: { current: string | null }, rowRefs: { current: Map<string, HTMLDivElement> }): void {
  useEffect(() => {
    const pending = pendingFocusId.current;
    if (pending) {
      const row = rowRefs.current.get(pending);
      if (row) {
        row.focus();
        pendingFocusId.current = null;
      }
      return;
    }
    if (activeId && !visibleIds.includes(activeId) && visibleIds[0]) setActiveId(visibleIds[0]);
  }, [activeId, pendingFocusId, rowRefs, setActiveId, visibleIds]);
}

function focusCoverageTarget(targetId: string, targetIndex: number, setActiveId: (id: string) => void, rowRefs: { current: Map<string, HTMLDivElement> }, pendingFocusId: { current: string | null }, scrollerRef: { current: HTMLDivElement | null }): void {
  setActiveId(targetId);
  const targetRow = rowRefs.current.get(targetId);
  if (targetRow) {
    targetRow.focus();
    return;
  }
  pendingFocusId.current = targetId;
  if (!scrollerRef.current) return;
  scrollerRef.current.scrollTop = targetIndex * 28;
  scrollerRef.current.dispatchEvent(new Event("scroll"));
}

function CoverageHeader({ rows, filters, sort, onFilter, onSort }: { rows: PortfolioRowDTO[]; filters: FilterState; sort: SortState; onFilter: (column: string, values: string[] | undefined) => void; onSort: (column: string) => void }) {
  const headingClass = "tabular text-caos-xs uppercase tracking-wider text-caos-muted focus-ring rounded outline-none";
  return (
    <div role="row" aria-rowindex={1} className={COLS + " px-3 h-7 border-b border-caos-border bg-caos-panel z-10 shrink-0"}>
      {HEADS.map(([label, key], index) => <FilterHeader key={key} label={label} col={key} rows={rows} getValue={VALUES[key]} selected={filters[key]} onChange={onFilter} sortable sortState={sort} onSort={onSort} asHeaderCell className={headingClass + ([2, 3].includes(index) ? " text-right" : "")}>{label}</FilterHeader>)}
    </div>
  );
}

function CoverageViewport({ scrollerRef, paddingTop, paddingBottom, visibleRows, startIndex, selected, actionRowId, rowIds, rowRefs, getRowFocusProps, onSelect, setActionRowId, onMove }: {
  scrollerRef: { current: HTMLDivElement | null }; paddingTop: number; paddingBottom: number; visibleRows: PortfolioRowDTO[]; startIndex: number; selected: string | null; actionRowId: string | null;
  rowIds: string[]; rowRefs: { current: Map<string, HTMLDivElement> }; getRowFocusProps: (id: string) => RovingItemProps; onSelect?: (id: string) => void; setActionRowId: (id: string | null) => void; onMove: (rowId: string, index: number) => void;
}) {
  return (
    <div ref={scrollerRef} className="flex-1 overflow-y-auto min-h-0">
      <div style={{ paddingTop, paddingBottom }}>
        {visibleRows.map((row, visibleIndex) => <CoverageRow key={row.issuer_id} row={row} visibleIndex={visibleIndex} startIndex={startIndex} selected={selected === row.issuer_id} actionMode={actionRowId === row.issuer_id} focusProps={getRowFocusProps(row.issuer_id)} rowIds={rowIds} rowRefs={rowRefs} onActivate={() => onSelect?.(row.issuer_id)} onActionMode={(active) => setActionRowId(active ? row.issuer_id : null)} onMove={onMove} />)}
      </div>
    </div>
  );
}

function useCoverageData(rows: PortfolioRowDTO[]) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<FilterState>({});
  const [sort, setSort] = useState<SortState>(null);
  const filtered = useColumnFilters(rows, filters, VALUES);
  const shown = useMemo(() => sortCoverageRows(filtered, sort), [filtered, sort]);
  const virtual = useVirtualScroll({ itemCount: shown.length, estimateHeight: 28, overscan: 10, containerRef: scrollerRef });
  const visibleRows = useMemo(() => shown.slice(virtual.startIndex, virtual.endIndex + 1), [shown, virtual.startIndex, virtual.endIndex]);
  const visibleRowIds = useMemo(() => visibleRows.map((row) => row.issuer_id), [visibleRows]);
  const rowIds = useMemo(() => shown.map((row) => row.issuer_id), [shown]);
  const setFilter = (column: string, values: string[] | undefined) => setFilters((current) => updateColumnFilter(current, column, values));
  const handleSort = (column: string) => setSort((current) => nextCoverageSort(current, column));
  return { scrollerRef, filters, sort, shown, visibleRows, visibleRowIds, rowIds, setFilter, handleSort, ...virtual };
}

function useCoverageInteraction(selected: string | null, visibleRowIds: string[], rowIds: string[], scrollerRef: { current: HTMLDivElement | null }) {
  const [actionRowId, setActionRowId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingFocusId = useRef<string | null>(null);
  const { activeId, getItemProps: getRowFocusProps, setActiveId: setActiveRowId } = useRovingFocus(rowIds);
  useSelectedCoverageFocus(selected, visibleRowIds, setActiveRowId);
  useCoverageActionSync(actionRowId, setActionRowId, visibleRowIds, rowIds, rowRefs);
  usePendingCoverageFocus(activeId, visibleRowIds, setActiveRowId, pendingFocusId, rowRefs);
  const moveFocus = (targetId: string, targetIndex: number) => focusCoverageTarget(targetId, targetIndex, setActiveRowId, rowRefs, pendingFocusId, scrollerRef);
  return { actionRowId, setActionRowId, rowRefs, getRowFocusProps, moveFocus };
}

export function LiveCoverage({
  rows,
  selected = null,
  onSelect,
}: {
  rows: PortfolioRowDTO[];
  selected?: string | null;
  onSelect?: (ticker: string) => void;
}) {
  const data = useCoverageData(rows);
  const interaction = useCoverageInteraction(selected, data.visibleRowIds, data.rowIds, data.scrollerRef);
  return (
    <>
    <p id="live-coverage-grid-help" className="sr-only">
      Use Up and Down Arrow to move between issuer rows. Press Enter or Space to open row details. Press F2 to enter row actions; press Escape to return to the row.
    </p>
    <div role="grid" aria-label="Live coverage worklist" aria-rowcount={data.shown.length + 1} className="text-caos-md flex-1 min-h-0 flex flex-col" style={{ minWidth: 760, height: "100%" }}>
      <CoverageHeader rows={rows} filters={data.filters} sort={data.sort} onFilter={data.setFilter} onSort={data.handleSort} />
      <CoverageViewport scrollerRef={data.scrollerRef} paddingTop={data.paddingTop} paddingBottom={data.paddingBottom} visibleRows={data.visibleRows} startIndex={data.startIndex} selected={selected} actionRowId={interaction.actionRowId} rowIds={data.rowIds} rowRefs={interaction.rowRefs} getRowFocusProps={interaction.getRowFocusProps} onSelect={onSelect} setActionRowId={interaction.setActionRowId} onMove={interaction.moveFocus} />
    </div>
    </>
  );
}
