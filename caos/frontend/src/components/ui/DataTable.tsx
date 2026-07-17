"use client";

// The plain (non-virtualized, non-ARIA-grid) data table primitive: a typed
// column contract so alignment/tabular-nums/units-in-header stay consistent
// by construction instead of hand-rolled per table (the "text-right in 22
// files, tabular in 111" divergence this exists to close). Callers still own
// cell content and number formatting (fm/fx/display helpers) — this only
// owns structure: alignment, header semantics, optional sort, optional
// roving-tabindex row focus.
//
// Scope: a real <table>, not a virtualized or ARIA-grid layout — those are a
// different shape (see RVScreenerWorkbench's VirtualCandidateGrid, which
// already has its own roving-focus solution) and are out of scope here.

import { useRovingTabs } from "@/lib/useRovingTabs";
import { focusFirstRowAction, ROW_ACTION_SELECTOR, syncRowActionTabStops } from "@/lib/rowActionMode";
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type DataTableAlign = "text" | "numeric" | "center" | "action";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** "text" (left, default) | "numeric" (right, tabular-nums) | "center" */
  align?: DataTableAlign;
  /** Render this identifying column as a native row header (`th scope="row"`). */
  rowHeader?: boolean;
  /** Appended to the header in parens, e.g. unit="bp" -> "DM (bp)". */
  unit?: string;
  sortable?: boolean;
  width?: string;
  render: (row: T, index: number) => ReactNode;
}

export interface DataTableSort {
  key: string;
  direction: "asc" | "desc";
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T, index: number) => string;
  sort?: DataTableSort | null;
  onSort?: (key: string) => void;
  /** Presence enables roving-tabindex row focus (Enter/Space activates). Omit for pure-display tables. */
  onRowActivate?: (row: T, index: number) => void;
  /** Which row is the current roving-tabindex stop; defaults to the first row. Only meaningful with onRowActivate. */
  selectedRowId?: string | null;
  /** Extra per-row classes (e.g. a selected-row highlight) merged alongside the built-in hover/focus treatment. */
  rowClassName?: (row: T, index: number) => string;
  caption?: string;
  className?: string;
}

const ALIGN_TD: Record<DataTableAlign, string> = {
  text: "text-left",
  numeric: "text-right tabular",
  center: "text-center",
  action: "text-right",
};
const ALIGN_TH: Record<DataTableAlign, string> = {
  text: "text-left",
  numeric: "text-right",
  center: "text-center",
  action: "text-right",
};

const ROW_KEYBOARD_INSTRUCTIONS =
  "Use Up and Down Arrow to move between rows. Press Enter to open a row or F2 to use actions within it; Escape returns to the row.";

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  sort,
  onSort,
  onRowActivate,
  selectedRowId,
  rowClassName,
  caption,
  className = "",
}: DataTableProps<T>) {
  const selectedIndex = selectedRowId != null ? rows.findIndex((row, i) => getRowId(row, i) === selectedRowId) : -1;
  const [activeIndex, setActiveIndex] = useState(() => (selectedIndex >= 0 ? selectedIndex : 0));
  const [actionRowId, setActionRowId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const rowIdsKey = JSON.stringify(rows.map((row, index) => getRowId(row, index)));
  const keyboardInstructionsId = useId();

  useEffect(() => {
    if (rows.length === 0) {
      setActiveIndex(0);
    } else if (selectedIndex >= 0) {
      setActiveIndex(selectedIndex);
    } else {
      setActiveIndex((current) => Math.min(current, rows.length - 1));
    }
  }, [rows.length, selectedIndex]);

  useEffect(() => {
    setActionRowId(null);
  }, [rowIdsKey]);

  // An activatable worklist contributes one Tab stop, not one stop per nested
  // link/button per row. F2 temporarily exposes only the active row's actions.
  useLayoutEffect(() => {
    if (!onRowActivate) return;
    for (const [rowId, rowElement] of rowRefs.current) {
      syncRowActionTabStops(rowElement, actionRowId === rowId);
    }
  });

  const { getItemProps } = useRovingTabs(
    onRowActivate ? rows.length : 0,
    activeIndex,
    setActiveIndex,
    { orientation: "vertical" },
  );

  return (
    <Fragment>
      {onRowActivate ? (
        <span id={keyboardInstructionsId} className="sr-only">
          {ROW_KEYBOARD_INSTRUCTIONS}
        </span>
      ) : null}
      <table
        aria-describedby={onRowActivate ? keyboardInstructionsId : undefined}
        className={`caos-data-table w-full border-collapse tabular text-caos-xs${className ? ` ${className}` : ""}`}
      >
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      <thead className="sticky top-0 z-raised bg-caos-elevated text-caos-muted">
        <tr>
          {columns.map((col) => {
            const align = col.align ?? "text";
            const label = col.unit ? `${col.header} (${col.unit})` : col.header;
            const canSort = Boolean(col.sortable && onSort);
            const ariaSort =
              canSort && sort?.key === col.key ? (sort.direction === "asc" ? "ascending" : "descending") : canSort ? "none" : undefined;
            return (
              <th
                key={col.key}
                scope="col"
                aria-sort={ariaSort}
                style={col.width ? { width: col.width } : undefined}
                className={`px-2 py-1 font-medium uppercase tracking-wider ${ALIGN_TH[align]}`}
              >
                {canSort ? (
                  <button
                    type="button"
                    onClick={() => onSort?.(col.key)}
                    className="uppercase tracking-wider hover:text-caos-text focus-ring"
                  >
                    {label}
                    {sort?.key === col.key ? (sort.direction === "asc" ? " ▲" : " ▼") : null}
                  </button>
                ) : (
                  label
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody className="divide-y divide-caos-border/40">
        {rows.map((row, i) => {
          const rowId = getRowId(row, i);
          const itemProps = onRowActivate ? getItemProps(i) : null;
          const classes = [
            itemProps ? "cursor-pointer focus-ring hover:bg-caos-elevated/30" : "",
            rowClassName?.(row, i) ?? "",
          ].filter(Boolean).join(" ");
          return (
            <tr
              key={rowId}
              ref={itemProps ? (element) => {
                itemProps.ref(element);
                if (element) rowRefs.current.set(rowId, element);
                else rowRefs.current.delete(rowId);
              } : undefined}
              tabIndex={itemProps?.tabIndex}
              aria-selected={selectedRowId != null ? rowId === selectedRowId : undefined}
              aria-keyshortcuts={itemProps ? "F2" : undefined}
              data-action-mode={actionRowId === rowId ? "true" : undefined}
              onFocus={itemProps ? () => setActiveIndex(i) : undefined}
              onKeyDown={itemProps ? (event) => {
                if (event.key === "Escape" && actionRowId === rowId) {
                  event.preventDefault();
                  setActionRowId(null);
                  event.currentTarget.focus();
                  return;
                }
                // Nested controls own their own keyboard contract. In particular,
                // Enter on an in-row action must not also activate the row.
                if (event.currentTarget !== event.target) return;
                if (event.key === "F2") {
                  if (focusFirstRowAction(event.currentTarget)) {
                    event.preventDefault();
                    setActionRowId(rowId);
                  }
                  return;
                }
                itemProps.onKeyDown(event);
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRowActivate?.(row, i);
                }
              } : undefined}
              onClick={itemProps ? (event) => {
                // Let cell content activate the row while isolating buttons,
                // links, and form controls nested inside it.
                const target = event.target as HTMLElement;
                const interactiveDescendant = target.closest?.(ROW_ACTION_SELECTOR);
                if (interactiveDescendant && interactiveDescendant !== event.currentTarget) return;
                setActiveIndex(i);
                onRowActivate?.(row, i);
              } : undefined}
              onBlur={itemProps ? (event) => {
                if (actionRowId === rowId && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setActionRowId(null);
                }
              } : undefined}
              className={classes || undefined}
            >
              {columns.map((col) => col.rowHeader ? (
                <th key={col.key} scope="row" className={`px-2 py-1.5 font-normal ${ALIGN_TD[col.align ?? "text"]}`}>
                  {col.render(row, i)}
                </th>
              ) : (
                <td key={col.key} className={`px-2 py-1.5 ${ALIGN_TD[col.align ?? "text"]}`}>
                  {col.render(row, i)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
      </table>
    </Fragment>
  );
}
