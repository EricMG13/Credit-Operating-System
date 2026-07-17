"use client";

// Shared multi-select batch bar — one component for Issuers, Sector Review,
// and Monitor's ack/assign (P2-WP-7/WP-10/WP-3). Backed only by real endpoints
// per surface; every action reports PER-ITEM outcomes (never a blanket
// success), since batch posts can partially fail (rate limits, per-analyst
// caps) and silently claiming "done" would misreport a real failure.

import { useEffect, useState } from "react";
import { ActionReason } from "@/components/shared/ActionReason";

export interface BatchAction {
  id: string;
  label: string;
  /** Exact mutation scope shown before cost-bearing or irreversible work. */
  confirmation?: string;
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
  itemName = (id) => id,
}: {
  selected: string[];
  onClear: () => void;
  actions: BatchAction[];
  itemLabel?: string;
  itemName?: (id: string) => string;
}) {
  const [running, setRunning] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<BatchOutcome[] | null>(null);
  const [armedActionId, setArmedActionId] = useState<string | null>(null);
  const selectionKey = selected.join("\u0000");

  useEffect(() => {
    setArmedActionId(null);
    setOutcomes(null);
  }, [selectionKey]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || running) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (armedActionId) setArmedActionId(null);
      else onClear();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [armedActionId, onClear, running]);

  if (selected.length === 0) return null;

  const runAction = async (action: BatchAction) => {
    setArmedActionId(null);
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
        <ActionReason
          key={a.id}
          type="button"
          reason={running !== null ? "Another batch action is already running" : null}
          onClick={() => {
            if (a.confirmation && armedActionId !== a.id) {
              setArmedActionId(a.id);
              setOutcomes(null);
              return;
            }
            void runAction(a);
          }}
          className="tabular text-caos-xs px-2 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring aria-disabled:opacity-50 caos-target"
        >
          {running === a.id
            ? `${a.label}…`
            : armedActionId === a.id
              ? `Confirm ${a.label}`
              : a.label}
        </ActionReason>
      ))}
      {armedActionId ? (
        <span role="status" className="max-w-72 text-caos-2xs text-caos-warning">
          {actions.find((action) => action.id === armedActionId)?.confirmation}
        </span>
      ) : null}
      {outcomes ? (
        <span className="flex items-center gap-2">
          <span
            className="tabular text-caos-2xs whitespace-nowrap"
            style={{ color: failCount > 0 ? "var(--caos-warning)" : "var(--caos-success)" }}
            role="status"
          >
            {failCount > 0
              ? `${outcomes.length - failCount}/${outcomes.length} succeeded`
              : `${outcomes.length} succeeded`}
          </span>
          {failCount > 0 ? (
            <details className="relative">
              <summary className="cursor-pointer text-caos-2xs text-caos-warning focus-ring">
                {failCount} failed — details
              </summary>
              <ul className="absolute right-0 top-full z-30 mt-1 w-80 rounded-sm border border-caos-border bg-caos-elevated p-2 shadow-lg">
                {outcomes.filter((outcome) => !outcome.ok).map((outcome) => (
                  <li key={outcome.id} className="text-caos-2xs text-caos-text">
                    <span className="font-semibold">{itemName(outcome.id)}</span>
                    <span className="text-caos-muted"> — {outcome.error || "Failed without a server reason."}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
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
