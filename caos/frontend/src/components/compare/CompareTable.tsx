"use client";

// The Loan Compare grid: deals as columns (one pinned Benchmark), terms as rows
// grouped into collapsible catalog sections. Numeric cells show their delta vs
// the Benchmark, tinted by the term's "looser" direction (warning = more
// borrower room / weaker protection; success = tighter) — the "discover
// loopholes" heat. Per the project a11y rule, tone is never carried by color
// alone: deltas carry a ▲/▼ glyph + title, scores show their 1–5 number.

import { useState } from "react";
import type { CompareCell, CompareGrid, CompareRow } from "@/lib/compare/types";

const LABEL_W = 248;

// 1 = most protective → 5 = seriously deficient.
const SCORE_BG: Record<number, string> = {
  1: "#16432b", 2: "#3a4a16", 3: "#4a3a12", 4: "#4a2a12", 5: "#4a1717",
};
const SCORE_FG: Record<number, string> = {
  1: "#22c55e", 2: "#84cc16", 3: "#f5a524", 4: "#fb923c", 5: "#ef4444",
};

const LONG_TYPES = new Set(["quote", "text"]);

type Tone = "looser" | "tighter" | null;

function tone(row: CompareRow, cell: CompareCell, bench: CompareCell | undefined): Tone {
  if (!cell.present || !bench || cell.deal_id === bench.deal_id) return null;
  switch (row.looser) {
    case "higher":
    case "lower": {
      if (cell.delta == null || cell.delta === 0) return null;
      const looserWhenPositive = row.looser === "higher";
      const isLooser = looserWhenPositive ? cell.delta > 0 : cell.delta < 0;
      return isLooser ? "looser" : "tighter";
    }
    case "yes": {
      if (!bench.present || cell.value_text === bench.value_text) return null;
      return cell.value_text === "Yes" ? "looser" : "tighter";
    }
    default:
      return null;
  }
}

function rowVaries(row: CompareRow): boolean {
  const keys = row.cells.map((c) => (c.present ? `P:${c.value_text ?? c.value_num}` : "·"));
  return new Set(keys).size > 1;
}

function fmtDelta(d: number): string {
  const v = Number.isInteger(d) ? String(Math.abs(d)) : Math.abs(d).toFixed(2).replace(/\.?0+$/, "");
  return `${d > 0 ? "+" : d < 0 ? "−" : ""}${v}`;
}

export function CompareTable({
  grid,
  benchmarkId,
  diffOnly,
  onRemove,
  onSetBenchmark,
}: {
  grid: CompareGrid;
  benchmarkId: string | null;
  diffOnly: boolean;
  onRemove: (dealId: string) => void;
  onSetBenchmark: (dealId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const deals = grid.deals;
  const cols = `${LABEL_W}px repeat(${deals.length}, minmax(150px, 1fr))`;
  const canRemove = deals.length > 2;

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  const benchOf = (row: CompareRow) => row.cells.find((c) => c.deal_id === benchmarkId);

  function renderValue(row: CompareRow, cell: CompareCell, cellKey: string) {
    if (!cell.present) {
      return <span className="text-caos-muted/50" title="Not extracted">·</span>;
    }
    if (row.vtype === "score_1_5" && cell.value_num != null) {
      const n = Math.max(1, Math.min(5, Math.round(cell.value_num)));
      return (
        <span
          className="tabular inline-flex items-center justify-center w-6 h-5 rounded text-[11px] font-semibold"
          style={{ background: SCORE_BG[n], color: SCORE_FG[n] }}
          title={`Documentation score ${n} of 5 (1 = most protective, 5 = seriously deficient)`}
        >
          {n}
        </span>
      );
    }
    if (LONG_TYPES.has(row.vtype) && cell.value_text) {
      const open = expanded.has(cellKey);
      return (
        <button
          type="button"
          onClick={() => toggle(expanded, cellKey, setExpanded)}
          className="text-left w-full text-caos-text/90 hover:text-caos-text transition-caos cursor-pointer"
          style={
            open
              ? undefined
              : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }
          }
          title={open ? "Collapse" : "Expand"}
        >
          {cell.value_text}
        </button>
      );
    }
    // Numeric (with delta) or plain enum/date/text.
    const t = tone(row, cell, benchOf(row));
    const toneColor = t === "looser" ? "var(--caos-warning)" : t === "tighter" ? "var(--caos-success)" : undefined;
    return (
      <span className="inline-flex items-baseline gap-1.5">
        <span className="tabular text-caos-text">{cell.display || "—"}</span>
        {cell.delta != null && cell.delta !== 0 && (
          <span
            className="tabular text-caos-micro"
            style={{ color: toneColor ?? "var(--caos-muted)" }}
            title={
              t === "looser"
                ? "Looser than benchmark (more borrower room / weaker protection)"
                : t === "tighter"
                  ? "Tighter than benchmark"
                  : "Δ vs benchmark"
            }
          >
            {t === "looser" ? "▲" : t === "tighter" ? "▼" : ""}
            {fmtDelta(cell.delta)}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="h-full overflow-auto text-caos-body">
      <div className="w-full">
        {/* Header row — deal columns */}
        <div className="grid sticky top-0 z-20 bg-caos-elevated border-b border-caos-border" style={{ gridTemplateColumns: cols }}>
          <div className="sticky left-0 z-10 bg-caos-elevated px-3 py-2 border-r border-caos-border text-caos-label uppercase tracking-wider text-caos-muted">
            Term
          </div>
          {deals.map((d) => {
            const isBench = d.id === benchmarkId;
            return (
              <div
                key={d.id}
                className={"px-3 py-2 border-r border-caos-border min-w-0 " + (isBench ? "bg-caos-accent/10" : "")}
              >
                <div className="flex items-start gap-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-caos-text font-semibold truncate" title={d.label}>{d.label}</div>
                    <div className="text-caos-micro text-caos-muted truncate" title={d.issuer_name ?? ""}>
                      {d.issuer_name}{d.industry ? ` · ${d.industry}` : ""}
                    </div>
                  </div>
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => onRemove(d.id)}
                      aria-label={`Remove ${d.label}`}
                      className="shrink-0 text-caos-muted hover:text-caos-critical transition-caos leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onSetBenchmark(d.id)}
                  aria-pressed={isBench}
                  className={
                    "mt-1.5 tabular text-caos-micro uppercase tracking-wider px-1.5 py-0.5 rounded border transition-caos " +
                    (isBench
                      ? "border-caos-accent text-caos-accent"
                      : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
                  }
                >
                  {isBench ? "● Benchmark" : "Set benchmark"}
                </button>
              </div>
            );
          })}
        </div>

        {/* Sections */}
        {grid.sections.map((section) => {
          const rows = diffOnly ? section.rows.filter(rowVaries) : section.rows;
          if (rows.length === 0) return null;
          const isCollapsed = collapsed.has(section.key);
          return (
            <div key={section.key}>
              <button
                type="button"
                onClick={() => toggle(collapsed, section.key, setCollapsed)}
                aria-expanded={!isCollapsed}
                className="grid w-full text-left sticky left-0 bg-caos-panel hover:bg-caos-elevated transition-caos border-b border-caos-border"
                style={{ gridTemplateColumns: "1fr" }}
              >
                <span className="px-3 py-1.5 text-caos-label font-semibold uppercase tracking-wider text-caos-text flex items-center gap-2">
                  <span className="text-caos-muted">{isCollapsed ? "▸" : "▾"}</span>
                  {section.label}
                  <span className="text-caos-muted font-normal normal-case tracking-normal">({rows.length})</span>
                </span>
              </button>
              {!isCollapsed &&
                rows.map((row) => {
                  return (
                    <div
                      key={row.term_key}
                      className="grid border-b border-caos-border/50 hover:bg-caos-elevated/40 transition-caos"
                      style={{ gridTemplateColumns: cols }}
                    >
                      <div className="sticky left-0 z-10 bg-caos-panel px-3 py-2 border-r border-caos-border text-caos-muted">
                        {row.label}
                      </div>
                      {row.cells.map((cell) => {
                        const isBench = cell.deal_id === benchmarkId;
                        const cellKey = `${row.term_key}:${cell.deal_id}`;
                        return (
                          <div
                            key={cell.deal_id}
                            className={"px-3 py-2 border-r border-caos-border align-top min-w-0 break-words " + (isBench ? "bg-caos-accent/5" : "")}
                          >
                            {renderValue(row, cell, cellKey)}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
