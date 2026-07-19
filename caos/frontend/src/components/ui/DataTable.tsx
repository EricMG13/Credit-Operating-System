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
import { ROW_ACTION_SELECTOR, syncRowActionTabStops } from "@/lib/rowActionMode";
import { handleActionRowKeyDown } from "@/lib/row-action-keyboard";
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

type RovingItemProps = ReturnType<ReturnType<typeof useRovingTabs>["getItemProps"]>;

const columnLabel = <T,>(column: DataTableColumn<T>): string =>
  column.unit ? `${column.header} (${column.unit})` : column.header;

const columnAriaSort = <T,>(
  column: DataTableColumn<T>,
  canSort: boolean,
  sort?: DataTableSort | null,
): "ascending" | "descending" | "none" | undefined => {
  if (!canSort) return undefined;
  if (sort?.key !== column.key) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
};

function ColumnLabel<T>({
  column,
  canSort,
  sort,
  onSort,
}: {
  column: DataTableColumn<T>;
  canSort: boolean;
  sort?: DataTableSort | null;
  onSort?: (key: string) => void;
}) {
  const label = columnLabel(column);
  if (!canSort) return label;
  const glyph = sort?.key === column.key ? sort.direction === "asc" ? " ▲" : " ▼" : null;
  return (
    <button type="button" onClick={() => onSort?.(column.key)} className="uppercase tracking-wider hover:text-caos-text focus-ring">
      {label}{glyph}
    </button>
  );
}

function DataTableHeaderCell<T>({
  column,
  sort,
  onSort,
}: {
  column: DataTableColumn<T>;
  sort?: DataTableSort | null;
  onSort?: (key: string) => void;
}) {
  const align = column.align ?? "text";
  const canSort = Boolean(column.sortable && onSort);
  return (
    <th
      scope="col"
      aria-sort={columnAriaSort(column, canSort, sort)}
      style={column.width ? { width: column.width } : undefined}
      className={`px-2 py-1 font-mono font-medium uppercase tracking-wider ${ALIGN_TH[align]}`}
    >
      <ColumnLabel column={column} canSort={canSort} sort={sort} onSort={onSort} />
    </th>
  );
}

function DataTableHeader<T>({ columns, sort, onSort }: Pick<DataTableProps<T>, "columns" | "sort" | "onSort">) {
  return (
    <thead className="sticky top-0 z-raised bg-caos-elevated text-caos-muted">
      <tr>{columns.map((column) => <DataTableHeaderCell key={column.key} column={column} sort={sort} onSort={onSort} />)}</tr>
    </thead>
  );
}

function DataTableCell<T>({ column, row, index }: { column: DataTableColumn<T>; row: T; index: number }) {
  const className = `px-2 py-1.5 ${ALIGN_TD[column.align ?? "text"]}`;
  return column.rowHeader
    ? <th scope="row" className={`${className} font-normal`}>{column.render(row, index)}</th>
    : <td className={className}>{column.render(row, index)}</td>;
}

const handleRowKeyDown = <T,>(
  event: React.KeyboardEvent<HTMLTableRowElement>,
  row: T,
  index: number,
  rowId: string,
  actionRowId: string | null,
  itemProps: RovingItemProps,
  setActionRowId: (id: string | null) => void,
  onRowActivate: (row: T, index: number) => void,
) => {
  handleActionRowKeyDown(event, {
    rowId,
    actionRowId,
    setActionRowId,
    onNavigate: itemProps.onKeyDown,
    onActivate: () => onRowActivate(row, index),
  });
};

const rowClasses = <T,>(
  itemProps: RovingItemProps | null,
  rowClassName: DataTableProps<T>["rowClassName"],
  row: T,
  index: number,
): string | undefined => [
  itemProps ? "cursor-pointer focus-ring hover:bg-caos-elevated/30" : "",
  rowClassName?.(row, index) ?? "",
].filter(Boolean).join(" ") || undefined;

const rowRefBinding = (
  itemProps: RovingItemProps | null,
  rowRefs: { readonly current: Map<string, HTMLTableRowElement> },
  rowId: string,
) => itemProps ? (element: HTMLTableRowElement | null) => {
  itemProps.ref(element);
  if (element) rowRefs.current.set(rowId, element);
  else rowRefs.current.delete(rowId);
} : undefined;

const rowKeyBinding = <T,>(
  itemProps: RovingItemProps | null,
  onRowActivate: DataTableProps<T>["onRowActivate"],
  row: T,
  index: number,
  rowId: string,
  actionRowId: string | null,
  setActionRowId: (id: string | null) => void,
) => itemProps && onRowActivate
  ? (event: React.KeyboardEvent<HTMLTableRowElement>) => handleRowKeyDown(
    event, row, index, rowId, actionRowId, itemProps, setActionRowId, onRowActivate,
  )
  : undefined;

const rowClickBinding = <T,>(
  itemProps: RovingItemProps | null,
  onRowActivate: DataTableProps<T>["onRowActivate"],
  row: T,
  index: number,
  setActiveIndex: (index: number) => void,
) => itemProps && onRowActivate ? (event: React.MouseEvent<HTMLTableRowElement>) => {
  const target = event.target as HTMLElement;
  const interactiveDescendant = target.closest?.(ROW_ACTION_SELECTOR);
  if (interactiveDescendant && interactiveDescendant !== event.currentTarget) return;
  setActiveIndex(index);
  onRowActivate(row, index);
} : undefined;

const rowBlurBinding = (
  itemProps: RovingItemProps | null,
  actionRowId: string | null,
  rowId: string,
  setActionRowId: (id: string | null) => void,
) => itemProps ? (event: React.FocusEvent<HTMLTableRowElement>) => {
  if (actionRowId === rowId && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
    setActionRowId(null);
  }
} : undefined;

function DataTableRow<T>({
  row,
  index,
  rowId,
  columns,
  itemProps,
  actionRowId,
  selectedRowId,
  rowClassName,
  rowRefs,
  setActiveIndex,
  setActionRowId,
  onRowActivate,
}: {
  row: T;
  index: number;
  rowId: string;
  columns: DataTableColumn<T>[];
  itemProps: RovingItemProps | null;
  actionRowId: string | null;
  selectedRowId?: string | null;
  rowClassName?: (row: T, index: number) => string;
  rowRefs: { readonly current: Map<string, HTMLTableRowElement> };
  setActiveIndex: (index: number) => void;
  setActionRowId: (id: string | null) => void;
  onRowActivate?: (row: T, index: number) => void;
}) {
  return (
    <tr
      ref={rowRefBinding(itemProps, rowRefs, rowId)}
      tabIndex={itemProps?.tabIndex}
      aria-selected={selectedRowId != null ? rowId === selectedRowId : undefined}
      aria-keyshortcuts={itemProps ? "F2" : undefined}
      data-action-mode={actionRowId === rowId ? "true" : undefined}
      onFocus={itemProps ? () => setActiveIndex(index) : undefined}
      onKeyDown={rowKeyBinding(itemProps, onRowActivate, row, index, rowId, actionRowId, setActionRowId)}
      onClick={rowClickBinding(itemProps, onRowActivate, row, index, setActiveIndex)}
      onBlur={rowBlurBinding(itemProps, actionRowId, rowId, setActionRowId)}
      className={rowClasses(itemProps, rowClassName, row, index)}
    >
      {columns.map((column) => <DataTableCell key={column.key} column={column} row={row} index={index} />)}
    </tr>
  );
}

const useDataTableInteraction = <T,>(
  rows: T[],
  getRowId: DataTableProps<T>["getRowId"],
  selectedRowId: DataTableProps<T>["selectedRowId"],
  onRowActivate: DataTableProps<T>["onRowActivate"],
) => {
  const selectedIndex = selectedRowId != null
    ? rows.findIndex((row, index) => getRowId(row, index) === selectedRowId)
    : -1;
  const [activeIndex, setActiveIndex] = useState(() => selectedIndex >= 0 ? selectedIndex : 0);
  const [actionRowId, setActionRowId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const rowIdsKey = JSON.stringify(rows.map((row, index) => getRowId(row, index)));
  useEffect(() => {
    if (rows.length === 0) setActiveIndex(0);
    else if (selectedIndex >= 0) setActiveIndex(selectedIndex);
    else setActiveIndex((current) => Math.min(current, rows.length - 1));
  }, [rows.length, selectedIndex]);
  useEffect(() => setActionRowId(null), [rowIdsKey]);
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
  return { actionRowId, activeIndex, getItemProps, rowRefs, setActionRowId, setActiveIndex };
};

function DataTableBody<T>({
  columns,
  rows,
  getRowId,
  onRowActivate,
  selectedRowId,
  rowClassName,
  interaction,
}: Pick<DataTableProps<T>, "columns" | "rows" | "getRowId" | "onRowActivate" | "selectedRowId" | "rowClassName"> & {
  interaction: ReturnType<typeof useDataTableInteraction<T>>;
}) {
  return (
    <tbody className="divide-y divide-caos-border/40">
      {rows.map((row, index) => {
        const rowId = getRowId(row, index);
        return (
          <DataTableRow
            key={rowId}
            row={row}
            index={index}
            rowId={rowId}
            columns={columns}
            itemProps={onRowActivate ? interaction.getItemProps(index) : null}
            actionRowId={interaction.actionRowId}
            selectedRowId={selectedRowId}
            rowClassName={rowClassName}
            rowRefs={interaction.rowRefs}
            setActiveIndex={interaction.setActiveIndex}
            setActionRowId={interaction.setActionRowId}
            onRowActivate={onRowActivate}
          />
        );
      })}
    </tbody>
  );
}

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
  const interaction = useDataTableInteraction(rows, getRowId, selectedRowId, onRowActivate);
  const keyboardInstructionsId = useId();

  return (
    <Fragment>
      {onRowActivate ? (
        <span id={keyboardInstructionsId} className="sr-only">
          {ROW_KEYBOARD_INSTRUCTIONS}
        </span>
      ) : null}
      <table
        aria-describedby={onRowActivate ? keyboardInstructionsId : undefined}
        className={`caos-data-table w-full border-collapse font-sans text-caos-xs${className ? ` ${className}` : ""}`}
      >
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      <DataTableHeader columns={columns} sort={sort} onSort={onSort} />
      <DataTableBody columns={columns} rows={rows} getRowId={getRowId} onRowActivate={onRowActivate} selectedRowId={selectedRowId} rowClassName={rowClassName} interaction={interaction} />
      </table>
    </Fragment>
  );
}
