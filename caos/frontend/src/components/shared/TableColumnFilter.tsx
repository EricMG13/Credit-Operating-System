"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type FilterState = Record<string, string[] | undefined>;

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

export function FilterHeader<T>({
  label,
  col,
  rows,
  getValue,
  selected,
  onChange,
  className = "",
  iconOnly = false,
  sortable = false,
  sortState = null,
  onSort,
  children,
}: {
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
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [q, setQ] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Numeric-aware order: the default lexicographic sort scrambled numeric
  // columns ('1050' < '250' < '44' < '9'), and with >MAX_VISIBLE_OPTIONS values
  // the visible slice kept a lexicographic prefix instead of the extremes.
  const opts = useMemo(() => {
    const uniq = Array.from(new Set(rows.map((r) => keyOf(getValue(r)))));
    const allNumeric = uniq.every((v) => v === "—" || (v !== "" && !Number.isNaN(Number(v))));
    return allNumeric
      ? uniq.sort((a, b) => (a === "—" ? 1 : b === "—" ? -1 : Number(a) - Number(b)))
      : uniq.sort();
  }, [rows, getValue]);
  const active = selected !== undefined;
  const matches = opts.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()));
  const visible = matches.slice(0, MAX_VISIBLE_OPTIONS);

  const openAt = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(r.left, window.innerWidth - 264)),
      y: Math.max(8, Math.min(r.bottom + 4, window.innerHeight - 264)),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
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

  const dialogNode = mounted && open ? createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Filter ${label}`}
      className="fixed z-overlay w-64 rounded border border-caos-border bg-caos-panel p-2 shadow-lg"
      style={{ left: pos.x, top: pos.y, boxShadow: "var(--shadow-pop)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted flex-1 min-w-0 truncate" title={`Filter ${label}`}>Filter {label}</span>
        <button
          type="button"
          aria-label={`Close ${label} filter`}
          className="rounded px-1 tabular text-caos-xs text-caos-muted hover:text-caos-text focus-ring"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      </div>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search values"
        aria-label={`Search ${label} values`}
        className="w-full rounded border border-caos-border bg-caos-elevated px-2 py-1 tabular text-caos-xs text-caos-text outline-none focus-ring"
      />
      <div className="mt-2 flex gap-1">
        <button type="button" className="tabular text-caos-2xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text focus-ring" onClick={() => onChange(col, undefined)}>All</button>
        <button type="button" className="tabular text-caos-2xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text focus-ring" onClick={() => onChange(col, [])}>Clear</button>
      </div>
      <div className="mt-2 max-h-44 overflow-auto">
        {visible.length ? visible.map((o) => (
          <label key={o} className="flex min-w-0 items-center gap-2 px-1 py-1 hover:bg-caos-elevated/70 rounded">
            <input
              type="checkbox"
              checked={selected === undefined || selected.includes(o)}
              onChange={(e) => {
                const base = selected !== undefined ? selected : opts;
                const next = e.target.checked
                  ? Array.from(new Set([...base, o]))
                  : base.filter((x) => x !== o);
                if (next.length === opts.length) {
                  onChange(col, undefined);
                } else {
                  onChange(col, next);
                }
              }}
              className="accent-[var(--caos-accent)]"
            />
            <span className="tabular text-caos-xs text-caos-text truncate" title={o}>{o}</span>
          </label>
        )) : (
          <div className="px-1 py-2 tabular text-caos-xs text-caos-muted">No values</div>
        )}
      </div>
      {matches.length > visible.length ? (
        <div className="mt-1 px-1 tabular text-caos-2xs text-caos-muted">
          Showing first {visible.length} of {matches.length} values
        </div>
      ) : null}
    </div>,
    document.body
  ) : null;

  // Shared funnel-filter trigger — identical chrome whether or not the column
  // is sortable, so the filter affordance never changes shape between columns.
  const filterTrigger = (
    <button
      type="button"
      aria-label={`Filter ${label}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      title={`Filter ${label}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openAt(e.currentTarget);
      }}
      className={
        "inline-flex h-4 w-4 items-center justify-center rounded border transition-caos focus-ring " +
        (active
          ? "border-caos-accent text-caos-accent bg-caos-elevated"
          : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60")
      }
    >
      <FunnelIcon />
    </button>
  );

  if (!iconOnly && sortable && onSort) {
    const dir = sortState?.col === col ? sortState.dir : null;
    // aria-sort lives on the header cell; the visible glyph + label carry the
    // same meaning by position + shape (never color alone).
    const ariaSort = dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none";
    const nextVerb = dir === "asc" ? "descending" : dir === "desc" ? "clear sort on" : "ascending";
    return (
      <>
        <span
          aria-sort={ariaSort}
          className="inline-flex items-center gap-1.5 min-w-0"
        >
          <button
            type="button"
            aria-label={`Sort ${label} ${nextVerb}`}
            title={`Sort ${label} ${nextVerb}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSort(col);
            }}
            className={
              "inline-flex items-center gap-1 min-w-0 hover:text-caos-text transition-caos focus-ring " +
              className +
              (dir ? " text-caos-accent" : " text-caos-muted")
            }
          >
            <span className="truncate">{children}</span>
            <span aria-hidden="true" className="inline-flex w-2 shrink-0 justify-center leading-none text-caos-2xs">
              {dir === "asc" ? "▲" : dir === "desc" ? "▼" : ""}
            </span>
          </button>
          {filterTrigger}
        </span>
        {dialogNode}
      </>
    );
  }

  if (!iconOnly) {
    return (
      <>
        <button
          type="button"
          aria-label={`Filter ${label}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          title={`Filter ${label}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openAt(e.currentTarget);
          }}
          className={
            "inline-flex items-center gap-1.5 hover:text-caos-text transition-caos focus-ring " +
            className +
            (active ? " text-caos-accent" : " text-caos-muted")
          }
        >
          <span>{children}</span>
          <span
            className={
              "inline-flex h-4 w-4 items-center justify-center rounded border transition-caos " +
              (active
                ? "border-caos-accent text-caos-accent bg-caos-elevated"
                : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60")
            }
          >
            <FunnelIcon />
          </span>
        </button>
        {dialogNode}
      </>
    );
  }

  return (
    <>
      <span
        title={`Filter ${label}`}
        className={
          "inline-flex items-center " +
          className +
          (active ? " text-caos-accent" : "")
        }
      >
        <button
          type="button"
          aria-label={`Filter ${label}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          title={`Filter ${label}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openAt(e.currentTarget);
          }}
          className={
            "inline-flex h-4 w-4 items-center justify-center rounded border transition-caos focus-ring relative after:absolute after:-inset-3.5 after:content-[''] " +
            (active
              ? "border-caos-accent text-caos-accent bg-caos-elevated"
              : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60")
          }
        >
          <FunnelIcon />
        </button>
      </span>
      {dialogNode}
    </>
  );
}
