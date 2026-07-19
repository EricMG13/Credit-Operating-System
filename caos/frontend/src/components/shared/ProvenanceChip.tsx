"use client";

// The shared provenance chip cluster — renders whichever of the three grammar
// axes are populated (lib/provenance.ts). Origin carries the color signal
// (LIVE green / REFERENCE accent / DEMO idle) paired with a square dot and an
// uppercase label so meaning never rides on hue alone; freshness colors only
// when STALE (warning); method chips stay monochrome. An omitted axis renders
// nothing — never a fabricated CURRENT.

import type { CSSProperties } from "react";
import type { Provenance, ProvFreshness, ProvOrigin } from "@/lib/provenance";

const ORIGIN_VAR: Record<ProvOrigin, string> = {
  LIVE: "var(--caos-success)",
  REFERENCE: "var(--caos-accent)",
  DEMO: "var(--caos-idle)",
};

const CHIP =
  "inline-flex items-center gap-1 tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border whitespace-nowrap";

const originStyle = (origin: ProvOrigin, color: string): CSSProperties => ({
  color: origin === "DEMO" ? "var(--caos-muted)" : color,
  borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
  background: `color-mix(in srgb, ${color} 8%, transparent)`,
});

const freshnessStyle = (freshness: ProvFreshness): CSSProperties => {
  if (freshness !== "STALE" && freshness !== "DUE") {
    return { color: "var(--caos-muted)", borderColor: "var(--caos-border)" };
  }
  const color = freshness === "STALE" ? "var(--caos-critical)" : "var(--caos-warning)";
  return {
    color,
    borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
    background: `color-mix(in srgb, ${color} 8%, transparent)`,
  };
};

function FreshnessChip({ freshness }: { freshness?: ProvFreshness }) {
  if (!freshness) return null;
  return <span className={CHIP} style={freshnessStyle(freshness)}>{freshness}</span>;
}

function MethodChip({ method }: { method?: string }) {
  if (!method) return null;
  return (
    <span className={CHIP} style={{ color: "var(--caos-muted)", borderColor: "var(--caos-border)" }}>
      {method}
    </span>
  );
}

export function ProvenanceChip({ prov, className = "" }: { prov: Provenance; className?: string }) {
  const originColor = ORIGIN_VAR[prov.origin];
  const title =
    [prov.detail, prov.asOf ? `as of ${prov.asOf}` : null].filter(Boolean).join(" · ") || undefined;
  return (
    <span className={"inline-flex items-center gap-1 shrink-0 " + className} title={title}>
      <span
        className={CHIP}
        style={originStyle(prov.origin, originColor)}
      >
        <span
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-sm shrink-0"
          style={{ background: originColor }}
        />
        {prov.origin}
      </span>
      <FreshnessChip freshness={prov.freshness} />
      <MethodChip method={prov.method} />
    </span>
  );
}
