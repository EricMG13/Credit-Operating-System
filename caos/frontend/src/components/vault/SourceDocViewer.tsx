"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSelectionStore } from "@/store/selection";
import { useAnalysisStore } from "@/store/analysis";

export function SourceDocViewer() {
  const doc = useAnalysisStore((s) => s.activeDoc);
  const conclusions = useAnalysisStore((s) => s.conclusions);
  const { conclusionId, linkIndex, select } = useSelectionStore();
  const [query, setQuery] = useState("");
  const clauseRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // clause_id -> {conclusionId, linkIndex} so clicking a clause drives the trace
  const clauseIndex = useMemo(() => {
    const idx: Record<string, { id: string; link: number }> = {};
    Object.values(conclusions).forEach((c) =>
      c.evidence_chain.forEach((l, i) => {
        if (l.anchor?.clause_id) idx[l.anchor.clause_id] = { id: c.id, link: i };
      })
    );
    return idx;
  }, [conclusions]);

  // The clause the current selection points at (Evidence Sync target)
  const targetClause = useMemo(() => {
    if (!conclusionId) return null;
    const c = conclusions[conclusionId];
    if (!c) return null;
    const link = c.evidence_chain[linkIndex ?? 0] ?? c.evidence_chain[0];
    return link?.anchor?.clause_id ?? null;
  }, [conclusionId, linkIndex, conclusions]);

  useEffect(() => {
    if (targetClause && clauseRefs.current[targetClause]) {
      clauseRefs.current[targetClause]!.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [targetClause]);

  if (!doc) {
    return (
      <div className="flex items-center justify-center h-full text-caos-muted text-xs">
        No source document loaded.
      </div>
    );
  }

  const q = query.trim().toLowerCase();

  return (
    <div className="flex flex-col h-full bg-caos-bg">
      {/* Vault header + search */}
      <div className="px-3 py-2 border-b border-caos-border bg-caos-panel shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>▤</span> Source Vault
          </h2>
          <span className="tabular text-[10px] text-caos-muted">{doc.doc_type}</span>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search within document…"
          className="mt-2 w-full bg-caos-elevated border border-caos-border rounded px-2 py-1 text-xs text-caos-text placeholder-caos-muted outline-none focus:border-caos-accent transition-caos"
        />
      </div>

      {/* Document body */}
      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-2xl mx-auto bg-[#f6f6f2] text-gray-900 rounded-md shadow-lg p-8">
          <h1 className="text-center text-xl font-semibold mb-1">{doc.title}</h1>
          <div className="text-center text-xs text-gray-500 mb-6 tabular">{doc.doc_type}</div>
          {doc.clauses.map((clause) => {
            const mapped = clauseIndex[clause.id];
            const isTarget = clause.id === targetClause;
            const dim = q && !clause.text.toLowerCase().includes(q);
            return (
              <div
                key={clause.id}
                ref={(el) => { clauseRefs.current[clause.id] = el; }}
                data-clause-id={clause.id}
                data-highlighted={isTarget ? "true" : undefined}
                onClick={() => mapped && select(mapped.id, "vault", mapped.link)}
                className={`px-2 py-1.5 my-1 rounded transition-caos ${
                  isTarget ? "clause-highlight" : ""
                } ${mapped ? "cursor-pointer hover:bg-amber-100/60" : ""} ${
                  dim ? "opacity-30" : ""
                }`}
                title={mapped ? "Linked to Evidence Trace — click to inspect" : undefined}
              >
                {clause.speaker && (
                  <span className="font-semibold text-gray-900">{clause.speaker}: </span>
                )}
                <span className="text-sm leading-relaxed text-gray-800">{clause.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
