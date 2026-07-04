"use client";

// The walk launcher — replaces the left question rail. A compact row of job
// groups sits just above the bottom ask bar; clicking one opens a popover
// (upward) with every walk that group can run given the data on hand (greyed +
// reasoned when it can't), plus the AI-generated analysis already surfaced for
// that group. One popover open at a time; picking a walk runs it and closes.

import type { QuestionGroup } from "@/lib/query/questions";
import { questionFor } from "@/lib/query/questions";
import type { Capability, InsightCard } from "@/lib/query/graph";
import { MODEL_HUE } from "@/components/query/node-style";

interface Props {
  groups: QuestionGroup[];
  cardsByGroup: Record<string, InsightCard[]>;
  openId: string | null;
  onToggle: (id: string | null) => void;
  onPick: (capId: string) => void;
  onOpenChunk: (chunkId: string, label?: string) => void;
}

export function GroupLauncher({ groups, cardsByGroup, openId, onToggle, onPick, onOpenChunk }: Props) {
  if (groups.length === 0) return null;
  const open = groups.find((g) => g.id === openId) || null;

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 flex-wrap" role="tablist" aria-label="Walk groups">
        {groups.map((g) => {
          const active = g.id === openId;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-expanded={active}
              onClick={() => onToggle(active ? null : g.id)}
              className={`tabular text-caos-2xs uppercase tracking-wider px-2.5 py-1 rounded border flex items-center gap-1.5 transition-caos focus-ring ${
                active
                  ? "border-caos-accent text-caos-text bg-caos-accent/10"
                  : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50"
              }`}
            >
              {g.label}
              <span className="tabular text-caos-3xs font-mono text-caos-muted">{g.ready}/{g.total}</span>
            </button>
          );
        })}
      </div>

      {open && (
        <div
          className="absolute left-0 right-0 bottom-full mb-1.5 z-20 bg-caos-panel border border-caos-border rounded-md overflow-hidden max-h-[52vh] overflow-y-auto"
          style={{ boxShadow: "var(--shadow-pop)" }}
          role="tabpanel"
          aria-label={open.label}
        >
          <div className="px-3 py-1.5 border-b border-caos-border/60 flex items-center gap-2">
            <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted">{open.label}</span>
            <span className="tabular text-caos-3xs font-mono text-caos-muted ml-auto">{open.ready} of {open.total} runnable</span>
            <button type="button" onClick={() => onToggle(null)} aria-label="Close group" className="tabular text-caos-3xs text-caos-muted hover:text-caos-text focus-ring rounded px-1">✕</button>
          </div>

          <Options group={open} onPick={onPick} />

          {(cardsByGroup[open.id]?.length ?? 0) > 0 && (
            <div className="border-t border-caos-border/60">
              <div className="px-3 pt-2 pb-1 flex items-center gap-1.5">
                <span className="tabular text-caos-3xs uppercase tracking-wider font-semibold" style={{ color: MODEL_HUE }}>AI analysis</span>
                <span className="tabular text-caos-3xs text-caos-muted font-mono">grounded</span>
              </div>
              <ul className="px-2 pb-2 flex flex-col gap-1.5">
                {cardsByGroup[open.id].map((card) => (
                  <li key={card.id} className="rounded border border-caos-border bg-caos-bg p-2" style={{ borderLeft: `2px solid ${MODEL_HUE}` }}>
                    <p className="text-caos-xs text-caos-text font-medium font-sans leading-snug">{card.headline}</p>
                    {card.detail && <p className="text-caos-3xs text-caos-muted font-sans leading-relaxed mt-0.5">{card.detail}</p>}
                    {card.evidence.length > 0 && (
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {card.evidence.map((e) =>
                          e.chunk_id ? (
                            <button key={e.id} type="button" onClick={() => onOpenChunk(e.chunk_id as string, e.label)} className="tabular text-caos-3xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring truncate max-w-[70%]" title={`Open source — ${e.label}`}>{e.label}</button>
                          ) : (
                            <span key={e.id} className="tabular text-caos-3xs px-1.5 py-0.5 rounded border border-caos-border/60 text-caos-muted truncate max-w-[70%]" title={e.label}>{e.label}</span>
                          ),
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Options({ group, onPick }: { group: QuestionGroup; onPick: (capId: string) => void }) {
  // Runnable walks first (clickable), then the greyed ones with their reason —
  // "all options based on the data available", honestly gated.
  const runnable = group.capabilities.filter((c) => c.enabled);
  const greyed = group.capabilities.filter((c) => !c.enabled);
  return (
    <div className="py-1">
      {runnable.map((c: Capability) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c.id)}
          className="w-full text-left px-3 py-1.5 flex items-baseline gap-2 hover:bg-caos-elevated/60 transition-caos focus-ring"
        >
          <span className="tabular text-caos-sm text-caos-text truncate">{questionFor(c)}</span>
          <span className="tabular text-caos-3xs text-caos-muted font-mono shrink-0 ml-auto truncate max-w-[40%]">{c.label}</span>
        </button>
      ))}
      {greyed.map((c: Capability) => (
        <div key={c.id} className="px-3 py-1.5 flex items-baseline gap-2 opacity-55" title={c.reason ?? "unavailable"}>
          <span className="tabular text-caos-sm text-caos-muted truncate">{questionFor(c)}</span>
          <span className="tabular text-caos-3xs text-caos-muted font-mono shrink-0 ml-auto truncate max-w-[45%]">{c.reason ?? "unavailable"}</span>
        </div>
      ))}
    </div>
  );
}
