"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type FilterState = Record<string, string[] | undefined>;

export function updateColumnFilter(
  filters: FilterState,
  col: string,
  values: string[] | undefined,
): FilterState {
  const next = { ...filters };
  if (values === undefined) delete next[col];
  else next[col] = values;
  return next;
}

// Sort direction a sortable column header can be in. `null` = unsorted (the
// register falls back to its default order). Clicking a sortable label cycles
// asc → desc → null.
export type SortDir = "asc" | "desc";
export type SortState = { col: string; dir: SortDir } | null;

type Primitive = string | number | boolean | null | undefined;

const keyOf = (v: Primitive) => (v == null || v === "" ? "—" : String(v));
const MAX_VISIBLE_OPTIONS = 100;

// The funnel glyph used by every filter-trigger variant below (icon-only,
// label+icon combined, and sortable-column-adjacent).
function FunnelIcon() {
  return (
    <svg viewBox="0 0 12 12" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h8M3.5 6h5M5 9h2" />
    </svg>
  );
}

export function useColumnFilters<T>(
  rows: T[],
  filters: FilterState,
  getters: Record<string, (row: T) => Primitive>,
): T[] {
  return useMemo(() => rows.filter((row) =>
    Object.entries(filters).every(([col, allowed]) => {
      if (allowed === undefined) return true;
      const get = getters[col];
      return !get || allowed.includes(keyOf(get(row)));
    }),
  ), [rows, filters, getters]);
}

interface FilterHeaderProps<T> {
  label: string;
  col: string;
  rows: T[];
  getValue: (row: T) => Primitive;
  selected?: string[];
  onChange: (col: string, values: string[] | undefined) => void;
  className?: string;
  iconOnly?: boolean;
  // When set, the label becomes a sort control that cycles asc → desc → none.
  // The funnel filter stays a separate control. Opt-in so existing call sites
  // (Command views, NlQuery, SectorRV, LiveCoverage) are unchanged.
  sortable?: boolean;
  sortState?: SortState;
  onSort?: (col: string) => void;
  // Set when this header renders as a direct child of a role="row"/"grid"
  // container instead of a real <th> — gives the returned element
  // role="columnheader" (and, when sortable, moves aria-sort onto that same
  // element) so it satisfies aria-required-children on the row and
  // aria-sort's required-context rule.
  asHeaderCell?: boolean;
  children: ReactNode;
}

function optionComparator(allNumeric: boolean) {
  return (a: string, b: string) => {
    if (!allNumeric) return a.localeCompare(b);
    if (a === "—") return 1;
    if (b === "—") return -1;
    return Number(a) - Number(b);
  };
}

function useFilterOptions<T>(rows: T[], getValue: (row: T) => Primitive) {
  return useMemo(() => {
    const unique = Array.from(new Set(rows.map((row) => keyOf(getValue(row)))));
    const allNumeric = unique.every((value) => value === "—" || (value !== "" && !Number.isNaN(Number(value))));
    return unique.sort(optionComparator(allNumeric));
  }, [rows, getValue]);
}

function trapDialogFocus(event: KeyboardEvent, panel: HTMLDivElement | null) {
  if (event.key !== "Tab") return;
  const focusable = panel?.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  if (!focusable?.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const movingBeforeFirst = event.shiftKey && document.activeElement === first;
  const movingPastLast = !event.shiftKey && document.activeElement === last;
  if (!movingBeforeFirst && !movingPastLast) return;
  event.preventDefault();
  (movingBeforeFirst ? last : first).focus();
}

function useFilterDialog() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [q, setQ] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openAt = (el: HTMLElement) => {
    triggerRef.current = el;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(r.left, window.innerWidth - 264)),
      y: Math.max(8, Math.min(r.bottom + 4, window.innerHeight - 264)),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) triggerRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); return; }
      trapDialogFocus(e, panelRef.current);
    };
    const onPointer = (e: PointerEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);
  return { mounted, open, openAt, panelRef, pos, q, setOpen, setQ };
}

type FilterDialogController = ReturnType<typeof useFilterDialog>;

function nextOptionSelection(selected: string[] | undefined, options: string[], option: string, checked: boolean) {
  const base = selected ?? options;
  const next = checked ? Array.from(new Set([...base, option])) : base.filter((value) => value !== option);
  return next.length === options.length ? undefined : next;
}

function FilterOption({ col, onChange, option, options, selected }: { col: string; onChange: FilterHeaderProps<unknown>["onChange"]; option: string; options: string[]; selected: string[] | undefined }) {
  const checked = selected === undefined || selected.includes(option);
  return <label className="flex min-w-0 items-center gap-2 px-1 py-1 hover:bg-caos-elevated/70 rounded">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(col, nextOptionSelection(selected, options, option, event.target.checked))}
      className="accent-[var(--caos-accent)]"
    />
    <span className="tabular text-caos-xs text-caos-text truncate" title={option}>{option}</span>
  </label>;
}

function FilterOptions({ col, onChange, options, selected, visible }: { col: string; onChange: FilterHeaderProps<unknown>["onChange"]; options: string[]; selected: string[] | undefined; visible: string[] }) {
  if (!visible.length) return <div className="px-1 py-2 tabular text-caos-xs text-caos-muted">No values</div>;
  return <>{visible.map((option) => <FilterOption key={option} col={col} onChange={onChange} option={option} options={options} selected={selected} />)}</>;
}

function FilterDialog<T>({ controller, matches, options, props, visible }: { controller: FilterDialogController; matches: string[]; options: string[]; props: FilterHeaderProps<T>; visible: string[] }) {
  if (!controller.mounted || !controller.open) return null;
  return createPortal(
    <div
      ref={controller.panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Filter ${props.label}`}
      className="fixed z-overlay w-64 rounded border border-caos-border bg-caos-panel p-2 shadow-lg"
      style={{ left: controller.pos.x, top: controller.pos.y, boxShadow: "var(--shadow-pop)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted flex-1 min-w-0 truncate" title={`Filter ${props.label}`}>Filter {props.label}</span>
        <button type="button" aria-label={`Close ${props.label} filter`} className="rounded px-1 tabular text-caos-xs text-caos-muted hover:text-caos-text focus-ring" onClick={() => controller.setOpen(false)}>×</button>
      </div>
      <input
        autoFocus
        value={controller.q}
        onChange={(event) => controller.setQ(event.target.value)}
        placeholder="Search values"
        aria-label={`Search ${props.label} values`}
        className="w-full rounded border border-caos-border bg-caos-elevated px-2 py-1 tabular text-caos-xs text-caos-text outline-none focus-ring"
      />
      <div className="mt-2 flex gap-1">
        <button type="button" className="tabular text-caos-2xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text focus-ring" onClick={() => props.onChange(props.col, undefined)}>All</button>
        <button type="button" className="tabular text-caos-2xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text focus-ring" onClick={() => props.onChange(props.col, [])}>Clear</button>
      </div>
      <div className="mt-2 max-h-44 overflow-auto"><FilterOptions col={props.col} onChange={props.onChange} options={options} selected={props.selected} visible={visible} /></div>
      {matches.length > visible.length ? <div className="mt-1 px-1 tabular text-caos-2xs text-caos-muted">Showing first {visible.length} of {matches.length} values</div> : null}
    </div>,
    document.body,
  );
}

function iconFilterClass(active: boolean) {
  const state = active
    ? "border-caos-accent text-caos-accent bg-caos-elevated"
    : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60";
  return `inline-flex h-6 min-h-6 w-6 min-w-6 shrink-0 items-center justify-center rounded border transition-caos focus-ring ${state}`;
}

function openFilter(event: React.MouseEvent<HTMLButtonElement>, controller: FilterDialogController) {
  event.preventDefault();
  event.stopPropagation();
  controller.openAt(event.currentTarget);
}

function IconFilterTrigger({ active, controller, label }: { active: boolean; controller: FilterDialogController; label: string }) {
  return <button
    type="button"
    aria-label={`Filter ${label}`}
    aria-haspopup="dialog"
    aria-expanded={controller.open}
    title={`Filter ${label}`}
    onClick={(event) => openFilter(event, controller)}
    className={iconFilterClass(active)}
  ><FunnelIcon /></button>;
}

function sortDirection(props: FilterHeaderProps<unknown>) {
  return props.sortState?.col === props.col ? props.sortState.dir : null;
}

function ariaSortDirection(dir: SortDir | null) {
  if (dir === "asc") return "ascending" as const;
  if (dir === "desc") return "descending" as const;
  return "none" as const;
}

function nextSortVerb(dir: SortDir | null) {
  if (dir === "asc") return "descending";
  if (dir === "desc") return "clear sort on";
  return "ascending";
}

function SortGlyph({ dir }: { dir: SortDir | null }) {
  return dir ? <span aria-hidden="true" className="inline-flex w-2 shrink-0 justify-center leading-none text-caos-2xs">{dir === "asc" ? "▲" : "▼"}</span> : null;
}

function SortableFilterHeader<T>({ active, controller, dialog, props }: { active: boolean; controller: FilterDialogController; dialog: ReactNode; props: FilterHeaderProps<T> }) {
  const dir = sortDirection(props as FilterHeaderProps<unknown>);
  const sort = () => props.onSort?.(props.col);
  return <>
    <span {...(props.asHeaderCell ? { role: "columnheader", "aria-sort": ariaSortDirection(dir) } : {})} className="inline-flex items-center gap-1.5 min-w-0">
      <button
        type="button"
        aria-label={`Sort ${props.label} ${nextSortVerb(dir)}`}
        title={`Sort ${props.label} ${nextSortVerb(dir)}`}
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); sort(); }}
        className={`inline-flex items-center gap-1 min-w-0 hover:text-caos-text transition-caos focus-ring ${props.className ?? ""}${dir ? " text-caos-accent" : " text-caos-muted"}`}
      >
        <span className="truncate">{props.children}</span><SortGlyph dir={dir} />
      </button>
      <IconFilterTrigger active={active} controller={controller} label={props.label} />
    </span>
    {dialog}
  </>;
}

function combinedFunnelClass(active: boolean) {
  const state = active
    ? "border-caos-accent text-caos-accent bg-caos-elevated"
    : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60";
  return `inline-flex h-4 w-4 items-center justify-center rounded border transition-caos ${state}`;
}

function CombinedFilterHeader<T>({ active, controller, dialog, props }: { active: boolean; controller: FilterDialogController; dialog: ReactNode; props: FilterHeaderProps<T> }) {
  const trigger = <button
    type="button"
    aria-label={`Filter ${props.label}`}
    aria-haspopup="dialog"
    aria-expanded={controller.open}
    title={`Filter ${props.label}`}
    onClick={(event) => openFilter(event, controller)}
    className={`inline-flex items-center gap-1.5 hover:text-caos-text transition-caos focus-ring ${props.className ?? ""}${active ? " text-caos-accent" : " text-caos-muted"}`}
  >
    <span>{props.children}</span><span className={combinedFunnelClass(active)}><FunnelIcon /></span>
  </button>;
  return <>{props.asHeaderCell ? <span role="columnheader" className="contents">{trigger}</span> : trigger}{dialog}</>;
}

function IconOnlyFilterHeader<T>({ active, controller, dialog, props }: { active: boolean; controller: FilterDialogController; dialog: ReactNode; props: FilterHeaderProps<T> }) {
  return <>
    <span title={`Filter ${props.label}`} className={`inline-flex items-center ${props.className ?? ""}${active ? " text-caos-accent" : ""}`}>
      <IconFilterTrigger active={active} controller={controller} label={props.label} />
    </span>
    {dialog}
  </>;
}

export function FilterHeader<T>(props: FilterHeaderProps<T>) {
  const controller = useFilterDialog();
  const options = useFilterOptions(props.rows, props.getValue);
  const query = controller.q.trim().toLowerCase();
  const matches = options.filter((option) => option.toLowerCase().includes(query));
  const visible = matches.slice(0, MAX_VISIBLE_OPTIONS);
  const active = props.selected !== undefined;
  const dialog = <FilterDialog controller={controller} matches={matches} options={options} props={props} visible={visible} />;
  if (!props.iconOnly && props.sortable && props.onSort) return <SortableFilterHeader active={active} controller={controller} dialog={dialog} props={props} />;
  if (!props.iconOnly) return <CombinedFilterHeader active={active} controller={controller} dialog={dialog} props={props} />;
  return <IconOnlyFilterHeader active={active} controller={controller} dialog={dialog} props={props} />;
}
