"use client";

import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { useEvidenceSync } from "@/lib/evidence-sync";
import { EVIDENCE } from "@/lib/reports/evidence";

export function EvChip({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  const open = (EVIDENCE[id] || {}).status === "open";
  // Publish this id on hover/focus and highlight when it (or any other chip
  // citing the same id, or its source driver) is the active selection.
  const { active, setActive } = useEvidenceSync();
  const synced = active === id;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(id); }}
      onMouseEnter={() => setActive(id)}
      onMouseLeave={() => setActive(null)}
      onFocus={() => setActive(id)}
      onBlur={() => setActive(null)}
      title={"Open source for " + id}
      aria-label={"Open source for " + id}
      className="tabular text-caos-xs inline-flex items-center justify-center min-w-6 min-h-6 px-1 rounded border transition-caos whitespace-nowrap hover:bg-caos-elevated focus-ring"
      style={{
        color: open ? "var(--caos-warning)" : "var(--caos-accent)",
        borderColor: synced ? "var(--caos-accent)" : open ? "color-mix(in srgb, var(--caos-warning) 50%, transparent)" : "color-mix(in srgb, var(--caos-accent) 40%, transparent)",
        background: synced ? "color-mix(in srgb, var(--caos-accent) 18%, transparent)" : "color-mix(in srgb, var(--caos-accent) 7%, transparent)",
        boxShadow: synced ? "0 0 0 1px var(--caos-accent)" : undefined,
      }}
    >
      {id}{open ? <StatusGlyph kind="warning" className="ml-0.5" /> : null}
    </button>
  );
}
