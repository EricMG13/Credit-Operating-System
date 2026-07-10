"use client";

// Layout F — the live report rail. As the analyst explores, grounded sections
// (answers, pinned insights, accepted connections) accumulate here into one
// committee report they can export to PDF. Every section is AI-marked where the
// prose is model-written; nothing is added that wasn't already grounded on the
// surface. print:hidden — the rail is the workbench, the exported sheet is the
// deliverable.

import { useEffect, useRef, useState } from "react";
import type { ReportSection, ReportSectionKind } from "@/lib/query/report";
import { kindLabel } from "@/lib/query/report";
import { MODEL_HUE } from "@/components/query/node-style";

const KIND_COLOR: Record<ReportSectionKind, string> = {
  answer: MODEL_HUE,
  insight: MODEL_HUE,
  link: "var(--caos-accent)",
  exhibit: "var(--caos-muted)",
};

interface Props {
  sections: ReportSection[];
  onRemove: (id: string) => void;
  onExport: () => void;
  onClear: () => void;
  onOpenChunk: (chunkId: string, label?: string) => void;
}

export function ReportRail({ sections, onRemove, onExport, onClear, onOpenChunk }: Props) {
  // Guard the destructive Clear behind a two-step confirm — clearing wipes a
  // whole session of assembled work, so a single stray click must never do it.
  // The confirm auto-dismisses so it can't strand the footer in a scary state.
  const [confirming, setConfirming] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!confirming) return;
    confirmBtnRef.current?.focus();
    const t = window.setTimeout(() => setConfirming(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirming]);
  // If the report empties (last section removed, or cleared), drop the pending
  // confirm so it can't linger over an already-empty footer.
  useEffect(() => {
    if (sections.length === 0) setConfirming(false);
  }, [sections.length]);

  return (
    <div className="flex flex-col h-full min-h-0 print:hidden">
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-caos-border">
        <span className="w-3.5 h-3.5 shrink-0 rounded-sm flex items-center justify-center" style={{ border: `1px solid ${MODEL_HUE}`, background: `${MODEL_HUE}18` }} aria-hidden>
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke={MODEL_HUE} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 1.5 h4.5 L10 4 v6.5 H3 Z" /><path d="M4.6 5.2 h2.8 M4.6 7 h2.8" />
          </svg>
        </span>
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-text font-semibold">Report</span>
        <span className="tabular text-caos-3xs uppercase tracking-wider rounded px-1.5 py-px border" style={{ color: MODEL_HUE, borderColor: `${MODEL_HUE}66`, backgroundColor: `${MODEL_HUE}14` }}>
          Auto-assembled
        </span>
        {sections.length > 0 && (
          <span className="tabular text-caos-3xs text-caos-muted font-mono ml-auto">{sections.length}</span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {sections.length === 0 ? (
          <p className="tabular text-caos-xs text-caos-muted px-3 py-4 leading-relaxed">
            Ask a question, accept a connection, or pin a brief card — grounded sections collect here into one report you can export.
          </p>
        ) : (
          <ul className="p-2 flex flex-col gap-2">
            {sections.map((s) => (
              <li key={s.id} className="rounded-md border border-caos-border bg-caos-bg p-2.5" style={{ borderLeft: `2px solid ${KIND_COLOR[s.kind]}` }}>
                <div className="flex items-center gap-1.5">
                  <span className="tabular text-caos-3xs uppercase tracking-wider font-mono" style={{ color: KIND_COLOR[s.kind] }}>{kindLabel(s.kind)}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(s.id)}
                    aria-label={`Remove ${s.title} from report`}
                    className="ml-auto tabular text-caos-3xs text-caos-muted hover:text-caos-critical transition-caos focus-ring rounded px-1"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-caos-sm text-caos-text font-medium font-sans leading-snug mt-1">{s.title}</p>
                {s.body && <p className="text-caos-xs text-caos-muted font-sans leading-relaxed mt-1 line-clamp-4">{s.body}</p>}
                {s.sources.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    {s.sources.map((src, i) =>
                      src.chunk_id ? (
                        <button
                          key={`${src.chunk_id}-${i}`}
                          type="button"
                          onClick={() => onOpenChunk(src.chunk_id as string, src.label)}
                          className="tabular text-caos-3xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring truncate max-w-[70%]"
                          title={`Open source — ${src.label}`}
                        >
                          {src.label}
                        </button>
                      ) : (
                        <span key={`${src.label}-${i}`} className="tabular text-caos-3xs px-1.5 py-0.5 rounded border border-caos-border/60 text-caos-muted truncate max-w-[70%]" title={src.label}>
                          {src.label}
                        </span>
                      ),
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-t border-caos-border">
        <button
          type="button"
          onClick={onExport}
          disabled={sections.length === 0}
          className="flex-1 tabular text-caos-xs uppercase tracking-wider px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg disabled:opacity-40 disabled:cursor-not-allowed transition-caos focus-ring"
        >
          Export report
        </button>
        {confirming ? (
          <span className="flex items-center gap-1.5">
            <button
              ref={confirmBtnRef}
              type="button"
              onClick={() => { onClear(); setConfirming(false); }}
              aria-label={`Confirm clearing all ${sections.length} report sections`}
              className="tabular text-caos-xs uppercase tracking-wider px-2 py-1 rounded border border-caos-critical text-caos-critical hover:bg-caos-critical hover:text-caos-bg transition-caos focus-ring"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              aria-label="Keep report"
              className="tabular text-caos-xs uppercase tracking-wider px-2 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos focus-ring"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={sections.length === 0}
            className="tabular text-caos-xs uppercase tracking-wider px-2 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text disabled:opacity-40 disabled:cursor-not-allowed transition-caos focus-ring"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
