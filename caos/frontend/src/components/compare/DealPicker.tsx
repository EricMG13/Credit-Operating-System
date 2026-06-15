"use client";

// Add-a-deal control for the Compare header. Lists deals not already selected
// (filtered by a small search box) and adds one as a new column, up to `max`.

import { useEffect, useRef, useState } from "react";
import type { DealSummary } from "@/lib/compare/types";

export function DealPicker({
  available,
  selected,
  max,
  onAdd,
}: {
  available: DealSummary[];
  selected: string[];
  max: number;
  onAdd: (dealId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const atMax = selected.length >= max;
  const needle = q.trim().toLowerCase();
  const choices = available.filter(
    (d) =>
      !selected.includes(d.id) &&
      (!needle || d.label.toLowerCase().includes(needle) || (d.issuer_name ?? "").toLowerCase().includes(needle)),
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={atMax}
        onClick={() => setOpen((o) => !o)}
        className={
          "tabular text-[10px] uppercase tracking-wider px-2 py-1 rounded border transition-caos " +
          (atMax
            ? "border-caos-border text-caos-muted/50 cursor-not-allowed"
            : "border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg")
        }
        title={atMax ? `Maximum ${max} deals` : "Add a deal column"}
      >
        + Add deal
      </button>
      {open && !atMax && (
        <div className="absolute right-0 mt-1 z-30 w-72 max-h-80 overflow-auto bg-caos-elevated border border-caos-border rounded-md shadow-lg">
          <div className="p-2 sticky top-0 bg-caos-elevated border-b border-caos-border">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search deals / issuers…"
              className="w-full bg-caos-bg border border-caos-border rounded px-2 py-1 text-caos-body text-caos-text placeholder:text-caos-muted focus:outline-none focus:border-caos-accent"
            />
          </div>
          {choices.length === 0 ? (
            <div className="px-3 py-3 text-caos-body text-caos-muted">No deals match.</div>
          ) : (
            choices.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  onAdd(d.id);
                  setOpen(false);
                  setQ("");
                }}
                className="block w-full text-left px-3 py-2 hover:bg-caos-panel transition-caos border-b border-caos-border/50"
              >
                <div className="text-caos-text text-caos-body truncate">{d.label}</div>
                <div className="text-caos-micro text-caos-muted truncate">
                  {d.issuer_name}{d.industry ? ` · ${d.industry}` : ""}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
