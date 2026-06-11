"use client";

import { useEffect, useMemo, useState } from "react";
import { useSelectionStore } from "@/store/selection";
import { useAnalysisStore } from "@/store/analysis";
import type { Conclusion, EvidenceLink } from "@/types/analysis";

function ConfidenceBadge({ c }: { c?: number }) {
  if (c == null)
    return (
      <span className="tabular text-[10px] px-1.5 py-0.5 rounded bg-caos-elevated text-caos-muted border border-caos-border">
        auto-calc
      </span>
    );
  const verified = c >= 0.85;
  return (
    <span
      className={`tabular text-[10px] px-1.5 py-0.5 rounded border ${
        verified
          ? "bg-emerald-900/40 text-emerald-400 border-emerald-800/50"
          : "bg-amber-900/30 text-amber-400 border-amber-800/50"
      }`}
    >
      {verified ? "✓ verified" : `~ ${Math.round(c * 100)}%`}
    </span>
  );
}

function TraceCard({
  conclusion,
  link,
  idx,
  expanded,
}: {
  conclusion: Conclusion;
  link: EvidenceLink;
  idx: number;
  expanded: boolean;
}) {
  const { select, conclusionId, linkIndex } = useSelectionStore();
  const active = conclusionId === conclusion.id && (linkIndex === idx || linkIndex === null);
  const [open, setOpen] = useState(expanded);
  // Follow the expanded prop (e.g. when this card becomes the focused selection
  // or Expand All toggles) while still allowing a manual override afterwards.
  useEffect(() => setOpen(expanded), [expanded]);

  return (
    <div
      data-testid="trace-card"
      data-conclusion-id={conclusion.id}
      onClick={() => select(conclusion.id, "trace", idx)}
      className={`rounded-lg border bg-caos-panel p-3 cursor-pointer transition-caos ${
        active ? "border-caos-accent caos-selected" : "border-caos-border hover:border-caos-accent/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div>
          <div className="text-xs text-white font-medium">{conclusion.label}</div>
          <div className="tabular text-sm text-caos-accent">{conclusion.value}</div>
        </div>
        <ConfidenceBadge c={link.confidence} />
      </div>

      {/* Tier 1 — Evidence (verbatim source) */}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="text-[10px] text-caos-muted hover:text-caos-text transition-caos"
      >
        {open ? "▾" : "▸"} {link.source_doc}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="rounded bg-caos-elevated/60 border border-caos-border p-2">
            <div className="text-[9px] uppercase tracking-wide text-caos-muted mb-0.5">Evidence</div>
            <div className="text-xs italic text-caos-text/90">“{link.evidence}”</div>
          </div>
          <div className="flex items-center gap-1 text-caos-muted text-[10px] px-1">↓</div>
          <div className="rounded bg-caos-elevated/60 border border-caos-border p-2">
            <div className="text-[9px] uppercase tracking-wide text-caos-muted mb-0.5">Risk Mechanic</div>
            <div className="text-xs text-caos-text/90">{link.risk_mechanic}</div>
          </div>
          <div className="flex items-center gap-1 text-caos-muted text-[10px] px-1">↓</div>
          <div className="rounded bg-caos-elevated/60 border border-amber-900/40 p-2">
            <div className="text-[9px] uppercase tracking-wide text-amber-500/80 mb-0.5">Credit Implication</div>
            <div className="text-xs text-caos-text">{link.credit_implication}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function EvidenceTracePanel() {
  const { conclusionId } = useSelectionStore();
  const conclusions = useAnalysisStore((s) => s.conclusions);
  const [expandAll, setExpandAll] = useState(false);

  const list: Conclusion[] = useMemo(() => {
    const all = Object.values(conclusions);
    if (conclusionId && conclusions[conclusionId]) return [conclusions[conclusionId]];
    return all;
  }, [conclusions, conclusionId]);

  const focused = !!(conclusionId && conclusions[conclusionId]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-caos-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-caos-accent text-xs">⌥</span>
          <h3 className="text-sm font-semibold text-white">Evidence Trace</h3>
          {focused && (
            <span className="text-[10px] text-caos-muted">· filtered to selection</span>
          )}
        </div>
        <button
          onClick={() => setExpandAll((e) => !e)}
          className="text-[10px] text-caos-accent hover:underline transition-caos"
        >
          {expandAll ? "Collapse All" : "Expand All"}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {list.length === 0 && (
          <div className="text-caos-muted text-xs text-center py-8">
            No evidence yet — run the analysis.
          </div>
        )}
        {list.flatMap((conclusion) =>
          conclusion.evidence_chain.map((link, i) => (
            <TraceCard
              key={`${conclusion.id}-${i}`}
              conclusion={conclusion}
              link={link}
              idx={i}
              expanded={expandAll || focused}
            />
          ))
        )}
      </div>
    </div>
  );
}
