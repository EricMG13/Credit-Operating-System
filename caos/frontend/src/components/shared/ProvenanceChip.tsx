"use client";

// The shared provenance chip cluster — renders whichever of the three grammar
// axes are populated (lib/provenance.ts). Origin carries the color signal
// (LIVE green / REFERENCE accent / DEMO idle) paired with a square dot and an
// uppercase label so meaning never rides on hue alone; freshness colors only
// when STALE (warning); method chips stay monochrome. An omitted axis renders
// nothing — never a fabricated CURRENT.

import type { Provenance, ProvOrigin } from "@/lib/provenance";

const ORIGIN_VAR: Record<ProvOrigin, string> = {
  LIVE: "var(--caos-success)",
  REFERENCE: "var(--caos-accent)",
  DEMO: "var(--caos-idle)",
};

const CHIP =
  "inline-flex items-center gap-1 tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border whitespace-nowrap";

export function ProvenanceChip({ prov, className = "" }: { prov: Provenance; className?: string }) {
  const originColor = ORIGIN_VAR[prov.origin];
  const title =
    [prov.detail, prov.asOf ? `as of ${prov.asOf}` : null].filter(Boolean).join(" · ") || undefined;
  return (
    <span className={"inline-flex items-center gap-1 shrink-0 " + className} title={title}>
      <span
        className={CHIP}
        style={{
          color: prov.origin === "DEMO" ? "var(--caos-muted)" : originColor,
          borderColor: `color-mix(in srgb, ${originColor} 40%, transparent)`,
          background: `color-mix(in srgb, ${originColor} 8%, transparent)`,
        }}
      >
        <span
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-sm shrink-0"
          style={{ background: originColor }}
        />
        {prov.origin}
      </span>
      {prov.freshness ? (
        <span
          className={CHIP}
          style={
            prov.freshness === "STALE" || prov.freshness === "DUE"
              ? {
                  color: prov.freshness === "STALE" ? "var(--caos-critical)" : "var(--caos-warning)",
                  borderColor: `color-mix(in srgb, ${prov.freshness === "STALE" ? "var(--caos-critical)" : "var(--caos-warning)"} 40%, transparent)`,
                  background: `color-mix(in srgb, ${prov.freshness === "STALE" ? "var(--caos-critical)" : "var(--caos-warning)"} 8%, transparent)`,
                }
              : { color: "var(--caos-muted)", borderColor: "var(--caos-border)" }
          }
        >
          {prov.freshness}
        </span>
      ) : null}
      {prov.method ? (
        <span className={CHIP} style={{ color: "var(--caos-muted)", borderColor: "var(--caos-border)" }}>
          {prov.method}
        </span>
      ) : null}
    </span>
  );
}
