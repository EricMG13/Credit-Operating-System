"use client";

// Shared multi-select batch bar — one component for Issuers, Sector Review,
// and Monitor's ack/assign (P2-WP-7/WP-10/WP-3). Backed only by real endpoints
// per surface; every action reports PER-ITEM outcomes (never a blanket
// success), since batch posts can partially fail (rate limits, per-analyst
// caps) and silently claiming "done" would misreport a real failure.

import { useState } from "react";

export interface BatchAction {
  id: string;
  label: string;
  /** Runs for one selected id; resolve/reject per item, never throw for the whole batch. */
  run: (id: string) => Promise<void>;
}

export interface BatchOutcome {
  id: string;
  ok: boolean;
  error?: string;
}

export function BatchBar({
  selected,
  onClear,
  actions,
  itemLabel = "item",
}: {
  selected: string[];
  onClear: () => void;
  actions: BatchAction[];
  itemLabel?: string;
}) {
  const [running, setRunning] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<BatchOutcome[] | null>(null);

  if (selected.length === 0) return null;

  const runAction = async (action: BatchAction) => {
    setRunning(action.id);
    setOutcomes(null);
    const results: BatchOutcome[] = [];
    for (const id of selected) {
      try {
        await action.run(id);
        results.push({ id, ok: true });
      } catch (err) {
        results.push({ id, ok: false, error: err instanceof Error ? err.message : "failed" });
      }
    }
    setRunning(null);
    setOutcomes(results);
  };

  const failCount = outcomes ? outcomes.filter((o) => !o.ok).length : 0;

  return (
    <div
      role="toolbar"
      aria-label="Batch actions"
      className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-caos-accent/50 bg-caos-elevated tabular text-caos-xs"
    >
      <span className="font-semibold text-caos-text whitespace-nowrap">
        {selected.length} {itemLabel}
        {selected.length === 1 ? "" : "s"} selected
      </span>
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={running !== null}
          onClick={() => runAction(a)}
          className="tabular text-caos-xs px-2 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring disabled:opacity-50 caos-target"
        >
          {running === a.id ? `${a.label}…` : a.label}
        </button>
      ))}
      {outcomes ? (
        <span
          className="tabular text-caos-2xs whitespace-nowrap"
          style={{ color: failCount > 0 ? "var(--caos-warning)" : "var(--caos-success)" }}
          role="status"
        >
          {failCount > 0
            ? `${outcomes.length - failCount}/${outcomes.length} succeeded`
            : `${outcomes.length} succeeded`}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onClear}
        title="Clear selection (Esc)"
        className="ml-auto tabular text-caos-xs text-caos-muted hover:text-caos-text px-1.5 min-h-8 rounded focus-ring caos-target"
      >
        clear
      </button>
    </div>
  );
}
