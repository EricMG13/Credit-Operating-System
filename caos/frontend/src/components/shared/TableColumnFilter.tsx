"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

export type FilterState = Record<string, string[]>;

type Primitive = string | number | boolean | null | undefined;

const keyOf = (v: Primitive) => (v == null || v === "" ? "—" : String(v));

export function useColumnFilters<T>(
  rows: T[],
  filters: FilterState,
  getters: Record<string, (row: T) => Primitive>,
): T[] {
  return useMemo(() => rows.filter((row) =>
    Object.entries(filters).every(([col, allowed]) => {
      if (!allowed.length) return true;
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
  children,
}: {
  label: string;
  col: string;
  rows: T[];
  getValue: (row: T) => Primitive;
  selected: string[];
  onChange: (col: string, values: string[]) => void;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [q, setQ] = useState("");
  const opts = useMemo(() => Array.from(new Set(rows.map((r) => keyOf(getValue(r))))).sort(), [rows, getValue]);
  const active = selected.length > 0;
  const visible = opts.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <span
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          setPos({ x: Math.min(r.left, window.innerWidth - 260), y: Math.min(r.bottom + 4, window.innerHeight - 260) });
          setOpen(true);
        }}
        title={`Double-click to filter ${label}`}
        className={className + (active ? " text-caos-accent" : "")}
      >
        {children}
      </span>
      {open ? (
        <div
          role="dialog"
          aria-label={`Filter ${label}`}
          className="fixed z-tooltip w-64 rounded border border-caos-border bg-caos-panel p-2 shadow-lg"
          style={{ left: pos.x, top: pos.y, boxShadow: "var(--shadow-pop)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted flex-1">Filter {label}</span>
            <button className="tabular text-caos-xs text-caos-muted hover:text-caos-text focus-ring" onClick={() => setOpen(false)}>×</button>
          </div>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search values"
            className="w-full rounded border border-caos-border bg-caos-elevated px-2 py-1 tabular text-caos-xs text-caos-text outline-none focus-ring"
          />
          <div className="mt-2 flex gap-1">
            <button className="tabular text-caos-2xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text focus-ring" onClick={() => onChange(col, opts)}>All</button>
            <button className="tabular text-caos-2xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text focus-ring" onClick={() => onChange(col, [])}>Clear</button>
          </div>
          <div className="mt-2 max-h-44 overflow-auto">
            {visible.map((o) => (
              <label key={o} className="flex items-center gap-2 px-1 py-1 hover:bg-caos-elevated/70 rounded">
                <input
                  type="checkbox"
                  checked={!selected.length || selected.includes(o)}
                  onChange={(e) => {
                    const base = selected.length ? selected : opts;
                    onChange(col, e.target.checked ? Array.from(new Set([...base, o])) : base.filter((x) => x !== o));
                  }}
                  className="accent-[var(--caos-accent)]"
                />
                <span className="tabular text-caos-xs text-caos-text truncate">{o}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
