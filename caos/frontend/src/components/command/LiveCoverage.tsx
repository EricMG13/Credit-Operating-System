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
import { useRovingFocus } from "@/lib/useRovingFocus";
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

export function LiveCoverage({
  rows,
  selected = null,
  onSelect,
}: {
  rows: PortfolioRowDTO[];
  selected?: string | null;
  onSelect?: (ticker: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const th = "tabular text-caos-xs uppercase tracking-wider text-caos-muted focus-ring rounded outline-none";
  const [filters, setFilters] = useState<FilterState>({});
  const [sort, setSort] = useState<SortState>(null);
  const [actionRowId, setActionRowId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingFocusId = useRef<string | null>(null);
  const setFilter = (col: string, values: string[] | undefined) =>
    setFilters((filters) => updateColumnFilter(filters, col, values));
  const vals = useMemo<Record<string, (r: PortfolioRowDTO) => string | number | null | undefined>>(() => ({
    issuer: (r) => r.name,
    sector: (r) => r.sector,
    netlev: (r) => r.metrics.net_leverage,
    intcov: (r) => r.metrics.interest_coverage,
    rv: (r) => r.rv_recommendation,
    fragility: (r) => r.downside_fragility,
    qa: (r) => r.qa_status,
  }), []);
  const filtered = useColumnFilters(rows, filters, vals);
  const shown = useMemo(() => {
    if (!sort) return filtered;
    const getValue = vals[sort.col];
    if (!getValue) return filtered;
    const direction = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((left, right) => {
      const a = getValue(left);
      const b = getValue(right);
      if (a == null || a === "") return b == null || b === "" ? 0 : 1;
      if (b == null || b === "") return -1;
      if (typeof a === "number" && typeof b === "number") return direction * (a - b);
      return direction * String(a).localeCompare(String(b));
    });
  }, [filtered, sort, vals]);
  const handleSort = (col: string) => setSort((current) =>
    current?.col !== col ? { col, dir: "asc" } : current.dir === "asc" ? { col, dir: "desc" } : null,
  );
  const { startIndex, endIndex, paddingTop, paddingBottom } = useVirtualScroll({
    itemCount: shown.length,
    estimateHeight: 28,
    overscan: 10,
    containerRef: scrollerRef,
  });
  const visibleRows = useMemo(() => shown.slice(startIndex, endIndex + 1), [shown, startIndex, endIndex]);
  const visibleRowIds = useMemo(() => visibleRows.map((row) => row.issuer_id), [visibleRows]);
  const rowIds = useMemo(() => shown.map((row) => row.issuer_id), [shown]);
  const { activeId, getItemProps: getRowFocusProps, setActiveId: setActiveRowId } = useRovingFocus(rowIds);

  useEffect(() => {
    if (selected && visibleRowIds.includes(selected)) setActiveRowId(selected);
  }, [selected, setActiveRowId, visibleRowIds]);

  useEffect(() => {
    if (actionRowId && !visibleRowIds.includes(actionRowId)) setActionRowId(null);
    for (const [id, row] of rowRefs.current) {
      syncRowActionTabStops(row, actionRowId === id);
    }
  }, [actionRowId, rowIds, visibleRowIds]);

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
    if (activeId && !visibleRowIds.includes(activeId) && visibleRowIds[0]) {
      setActiveRowId(visibleRowIds[0]);
    }
  }, [activeId, setActiveRowId, visibleRowIds]);

  const heads = [
    ["Issuer", "issuer"], ["Sector", "sector"], ["NetLev", "netlev"], ["IntCov", "intcov"],
    ["RV posture", "rv"], ["Fragility", "fragility"], ["QA", "qa"],
  ] as const;
  return (
    <>
    <p id="live-coverage-grid-help" className="sr-only">
      Use Up and Down Arrow to move between issuer rows. Press Enter or Space to open row details. Press F2 to enter row actions; press Escape to return to the row.
    </p>
    <div role="grid" aria-label="Live coverage worklist" aria-rowcount={shown.length + 1} className="text-caos-md flex-1 min-h-0 flex flex-col" style={{ minWidth: 760, height: "100%" }}>
      <div role="row" aria-rowindex={1} className={COLS + " px-3 h-7 border-b border-caos-border bg-caos-panel z-10 shrink-0"}>
        {heads.map(([h, key], i) => (
          <FilterHeader
            key={key}
            label={h}
            col={key}
            rows={rows}
            getValue={vals[key]}
            selected={filters[key]}
            onChange={setFilter}
            sortable
            sortState={sort}
            onSort={handleSort}
            asHeaderCell
            className={th + ([2, 3].includes(i) ? " text-right" : "")}
          >
            {h}
          </FilterHeader>
        ))}
      </div>
      <div ref={scrollerRef} className="flex-1 overflow-y-auto min-h-0">
        <div style={{ paddingTop, paddingBottom }}>
          {visibleRows.map((r, visibleIndex) => {
            const rv = r.rv_recommendation;
            const frag = r.downside_fragility;
            // Stable issuer IDs avoid collisions when tickers are reused.
            const selectKey = r.issuer_id;
            const isSelected = selected === selectKey;
            const focusProps = getRowFocusProps(selectKey);

            const activate = () => {
              if (onSelect) {
                onSelect(selectKey);
              }
            };

            const handleKeyDown = (e: React.KeyboardEvent) => {
              if (e.key === "Escape" && actionRowId === selectKey) {
                e.preventDefault();
                setActionRowId(null);
                (e.currentTarget as HTMLElement).focus();
                return;
              }
              if (e.currentTarget !== e.target) return;
              if (e.key === "F2") {
                if (focusFirstRowAction(e.currentTarget as HTMLElement)) {
                  e.preventDefault();
                  setActionRowId(selectKey);
                }
                return;
              }
              if (["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const currentIndex = rowIds.indexOf(selectKey);
                const targetIndex = e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? rowIds.length - 1
                    : Math.max(0, Math.min(rowIds.length - 1, currentIndex + (e.key === "ArrowDown" ? 1 : -1)));
                const targetId = rowIds[targetIndex];
                setActionRowId(null);
                setActiveRowId(targetId);
                const targetRow = rowRefs.current.get(targetId);
                if (targetRow) targetRow.focus();
                else {
                  pendingFocusId.current = targetId;
                  if (scrollerRef.current) {
                    scrollerRef.current.scrollTop = targetIndex * 28;
                    scrollerRef.current.dispatchEvent(new Event("scroll"));
                  }
                }
                return;
              }
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                activate();
              }
            };

            return (
              <div
                key={r.issuer_id}
                role="row"
                ref={(element) => {
                  focusProps.ref(element);
                  if (element) {
                    rowRefs.current.set(selectKey, element);
                    syncRowActionTabStops(element, actionRowId === selectKey);
                  } else rowRefs.current.delete(selectKey);
                }}
                tabIndex={actionRowId === selectKey ? -1 : focusProps.tabIndex}
                onFocus={focusProps.onFocus}
                onBlur={(event) => {
                  if (actionRowId === selectKey && !event.currentTarget.contains(event.relatedTarget as Node | null)) setActionRowId(null);
                }}
                onClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest("a, button, input, select, textarea, [role='button'], [role='link']")) return;
                  activate();
                }}
                onKeyDown={handleKeyDown}
                aria-rowindex={startIndex + visibleIndex + 2}
                aria-selected={isSelected}
                aria-keyshortcuts="F2"
                aria-describedby="live-coverage-grid-help"
                aria-label={`${r.ticker || ""} ${r.name || ""} details`}
                className={
                  COLS +
                  " px-3 py-[3px] border-b border-caos-border/50 transition-caos cursor-pointer focus-ring outline-none " +
                  (isSelected
                    ? "bg-caos-accent/10 border-caos-accent/30 text-caos-text"
                    : "hover:bg-caos-panel/30 text-caos-text")
                }
              >
                <span role="rowheader" className="flex items-center gap-1.5 min-w-0">
                  <IssuerLink issuer={{ id: r.issuer_id }} className="tabular text-caos-accent focus-ring rounded" title={`Open ${r.name} profile`}>{r.ticker || "—"}</IssuerLink>
                  <IssuerLink issuer={{ id: r.issuer_id }} className="text-caos-text truncate text-caos-md focus-ring rounded" title={`Open ${r.name} profile`}>{r.name}</IssuerLink>
                </span>
                <span role="gridcell" className="text-caos-muted text-caos-md truncate">{r.sector || "—"}</span>
                <span role="gridcell" className="tabular text-right">{fmtX(r.metrics.net_leverage)}</span>
                <span role="gridcell" className="tabular text-right">{fmtX(r.metrics.interest_coverage)}</span>
                <span role="gridcell" className="tabular text-caos-xs tracking-wide" style={{ color: rv ? RV_COLOR[rv] ?? "var(--caos-text)" : "var(--caos-muted)" }}>
                  {rv ?? "—"}{typeof r.rv_percentile === "number" ? ` · p${Math.round(r.rv_percentile)}` : ""}
                </span>
                <span role="gridcell" className="tabular text-caos-xs tracking-wide" style={{ color: frag ? FRAGILITY_COLOR[frag] : "var(--caos-muted)" }}>
                  {frag ? `${frag === "HIGH" ? "▲" : frag === "MODERATE" ? "■" : "●"} ${frag}` : "—"}
                </span>
                <span
                  role="gridcell"
                  className="tabular text-caos-2xs px-1 py-px rounded border whitespace-nowrap justify-self-start"
                  style={{ color: QA_COLOR[r.qa_status] ?? "var(--caos-muted)", borderColor: QA_COLOR[r.qa_status] ?? "var(--caos-border)" }}
                  title={`Committee: ${r.committee_status}`}
                >
                  {r.qa_status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </>
  );
}
