"use client";

// Live coverage board — the engine-derived counterpart to the seeded sample
// PortfolioTable. Shows each covered issuer's latest-complete-run FUNDAMENTALS
// (net leverage, interest coverage, CP-3 RV posture, CP-2B downside fragility,
// QA status). Deliberately NOT a clone of the sample board: the market columns
// (price / DM / Δ d/d / M2E) are an external pricing feed (Phase-2,
// docs/PHASE2_SCOPE.md) and are simply absent here, not faked.

import type { PortfolioRowDTO } from "@/lib/api";
import { useMemo, useState, useRef } from "react";
import { FilterHeader, useColumnFilters, type FilterState } from "@/components/shared/TableColumnFilter";
import { useVirtualScroll } from "@/lib/useVirtualScroll";

const fmtX = (v: number | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(1) + "x" : "—";

// Fragility / posture meaning never rides on colour alone — the word travels too.
const FRAGILITY_COLOR: Record<string, string> = {
  HIGH: "var(--caos-critical)", MODERATE: "var(--caos-warning)", LOW: "var(--caos-success)",
};
const RV_COLOR: Record<string, string> = {
  OVERWEIGHT: "var(--caos-success)", NEUTRAL: "var(--caos-muted)", UNDERWEIGHT: "var(--caos-critical)",
};
const QA_COLOR: Record<string, string> = {
  Pass: "var(--caos-success)", "Ready with Limitations": "var(--caos-warning)",
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
  const setFilter = (col: string, values: string[] | undefined) =>
    setFilters((f) => {
      const next = { ...f };
      if (values === undefined) {
        delete next[col];
      } else {
        next[col] = values;
      }
      return next;
    });
  const vals = useMemo<Record<string, (r: PortfolioRowDTO) => string | number | null | undefined>>(() => ({
    issuer: (r) => r.name,
    sector: (r) => r.sector,
    netlev: (r) => r.metrics.net_leverage,
    intcov: (r) => r.metrics.interest_coverage,
    rv: (r) => r.rv_recommendation,
    fragility: (r) => r.downside_fragility,
    qa: (r) => r.qa_status,
  }), []);
  const shown = useColumnFilters(rows, filters, vals);
  const { startIndex, endIndex, paddingTop, paddingBottom } = useVirtualScroll({
    itemCount: shown.length,
    estimateHeight: 28,
    overscan: 10,
    containerRef: scrollerRef,
  });
  const visibleRows = useMemo(() => shown.slice(startIndex, endIndex + 1), [shown, startIndex, endIndex]);

  const heads = [
    ["Issuer", "issuer"], ["Sector", "sector"], ["NetLev", "netlev"], ["IntCov", "intcov"],
    ["RV posture", "rv"], ["Fragility", "fragility"], ["QA", "qa"],
  ] as const;
  return (
    <div role="grid" className="text-caos-md flex-1 min-h-0 flex flex-col" style={{ minWidth: 760, height: "100%" }}>
      <div role="row" className={COLS + " px-3 h-7 border-b border-caos-border bg-caos-panel z-10 shrink-0"}>
        {heads.map(([h, key], i) => (
          <FilterHeader
            key={key}
            label={h}
            col={key}
            rows={rows}
            getValue={vals[key]}
            selected={filters[key]}
            onChange={setFilter}
            className={th + ([2, 3].includes(i) ? " text-right" : "")}
          >
            {h}
          </FilterHeader>
        ))}
      </div>
      <div ref={scrollerRef} className="flex-1 overflow-y-auto min-h-0">
        <div style={{ paddingTop, paddingBottom }}>
          {visibleRows.map((r) => {
            const rv = r.rv_recommendation;
            const frag = r.downside_fragility;
            const isSelected = selected === r.ticker;

            const handleClick = () => {
              if (r.ticker && onSelect) {
                onSelect(r.ticker);
              }
            };

            const handleKeyDown = (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            };

            return (
              <div
                key={r.issuer_id}
                role="row"
                tabIndex={0}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                aria-selected={isSelected}
                aria-label={`${r.ticker || ""} ${r.name || ""} details`}
                className={
                  COLS +
                  " px-3 py-[3px] border-b border-caos-border/50 transition-caos cursor-pointer focus-ring outline-none " +
                  (isSelected
                    ? "bg-caos-accent/10 border-caos-accent/30 text-caos-text"
                    : "hover:bg-caos-panel/30 text-caos-text")
                }
              >
                <span role="gridcell" className="flex items-center gap-1.5 min-w-0">
                  <span className="tabular text-caos-accent">{r.ticker || "—"}</span>
                  <span className="text-caos-text truncate text-caos-md">{r.name}</span>
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
  );
}
