"use client";

// Concept G — Loan Compare: side-by-side documentation comparison across
// issuers. Pick 2–6 deals, pin one as Benchmark, and read the covenant/term
// grid (server pivots deal_terms against engine/terms_catalog). "Diff only"
// hides rows where every deal agrees; numeric deltas tint by the looser/tighter
// direction — the "discover loopholes" read. Data is /api/compare (seeded until
// the CP-4D extractor lands). See docs/COMPARE_SCHEMA.md.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { Panel } from "@/components/shared/Panel";
import { getComparison, getDeals } from "@/lib/api";
import type { CompareGrid, DealSummary } from "@/lib/compare/types";
import { CompareTable } from "@/components/compare/CompareTable";
import { DealPicker } from "@/components/compare/DealPicker";

const MIN_DEALS = 2;
const MAX_DEALS = 6;

export default function ComparePage() {
  return (
    <RequireAuth>
      <Compare />
    </RequireAuth>
  );
}

function Compare() {
  const [available, setAvailable] = useState<DealSummary[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [benchmark, setBenchmark] = useState<string | null>(null);
  const [grid, setGrid] = useState<CompareGrid | null>(null);
  const [diffOnly, setDiffOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bench = benchmark ?? selected[0] ?? null;

  // Load the pickable deals; preselect the first few so the grid renders on open.
  useEffect(() => {
    getDeals()
      .then((ds) => {
        setAvailable(ds);
        setSelected((prev) => (prev.length ? prev : ds.slice(0, 3).map((d) => d.id)));
      })
      .catch(() => setError("Could not load deals."))
      .finally(() => setLoading(false));
  }, []);

  // Fetch the comparison whenever the selection or benchmark changes.
  useEffect(() => {
    if (selected.length < MIN_DEALS) {
      setGrid(null);
      return;
    }
    let cancelled = false;
    getComparison(selected, bench ?? undefined)
      .then((g) => !cancelled && setGrid(g))
      .catch(() => !cancelled && setError("Could not load the comparison."));
    return () => {
      cancelled = true;
    };
  }, [selected, bench]);

  const add = (id: string) => setSelected((s) => (s.includes(id) || s.length >= MAX_DEALS ? s : [...s, id]));
  const remove = (id: string) =>
    setSelected((s) => {
      const next = s.filter((x) => x !== id);
      if (benchmark === id) setBenchmark(null);
      return next;
    });

  const rowCount = useMemo(
    () => (grid ? grid.sections.reduce((n, s) => n + s.rows.length, 0) : 0),
    [grid],
  );

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <div className="h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-5 px-4">
        <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-[11px] transition-caos whitespace-nowrap">
          ← Directory
        </Link>
        <div className="h-4 w-px bg-caos-border" />
        <ConceptNav compact />
        <div className="h-4 w-px bg-caos-border" />
        <span className="text-[11px] text-caos-text font-medium whitespace-nowrap">
          Loan Compare — documentation comparison across issuers
        </span>
        <div className="flex-1" />
        <span className="tabular text-caos-micro uppercase tracking-wider text-caos-muted whitespace-nowrap">
          {selected.length} deals · {rowCount} terms
        </span>
        <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Hide rows where every deal agrees">
          <input
            type="checkbox"
            checked={diffOnly}
            onChange={(e) => setDiffOnly(e.target.checked)}
            className="accent-caos-accent"
          />
          <span className="tabular text-[10px] uppercase tracking-wider text-caos-muted">Diff only</span>
        </label>
        <DealPicker available={available} selected={selected} max={MAX_DEALS} onAdd={add} />
      </div>

      {/* workspace */}
      <div className="flex-1 min-h-0 p-2">
        <Panel title="Documentation comparison" className="h-full">
          {loading ? (
            <div className="h-full flex items-center justify-center text-caos-muted text-caos-body">Loading deals…</div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-caos-critical text-caos-body">{error}</div>
          ) : selected.length < MIN_DEALS ? (
            <div className="h-full flex items-center justify-center text-caos-muted text-caos-body px-6 text-center">
              Select at least {MIN_DEALS} deals to compare — use “+ Add deal”.
            </div>
          ) : !grid ? (
            <div className="h-full flex items-center justify-center text-caos-muted text-caos-body">Loading comparison…</div>
          ) : (
            <CompareTable
              grid={grid}
              benchmarkId={grid.benchmark_deal_id}
              diffOnly={diffOnly}
              onRemove={remove}
              onSetBenchmark={setBenchmark}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
