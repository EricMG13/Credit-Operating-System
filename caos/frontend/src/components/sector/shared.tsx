"use client";

// Display helpers shared between the Sector Review row list and
// SignalSlideOver's detail panel (P2-WP-7). Pulled out of
// SectorReviewWorkspace.tsx so the slide-over can reuse them without a
// circular import (workspace -> slide-over -> workspace).

import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { fromSeedFlag } from "@/lib/provenance";
import type { SectorSource } from "@/lib/api";

export const CATEGORY_LABEL: Record<string, string> = {
  earnings: "Earnings",
  liquidity: "Liquidity",
  rating: "Rating",
  macro: "Macro",
  technical: "Technical",
  covenant: "Covenant",
};

export const SEVERITY_COLOR: Record<string, string> = {
  critical: "var(--caos-critical)",
  high: "var(--caos-warning)",
  medium: "var(--caos-accent)",
  low: "var(--caos-muted)",
};

export const SEVERITY_GLYPH: Record<string, "critical" | "warning" | "idle"> = {
  critical: "critical",
  high: "warning",
  medium: "warning",
  low: "idle",
};

export const fmtAsOf = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
});

export function SourceChip({ source }: { source: SectorSource }) {
  const label = `${source.source_type} / ${source.tier}`;
  const klass = "inline-flex items-center gap-1 rounded border border-caos-border px-1.5 py-px tabular text-caos-2xs uppercase tracking-wider text-caos-muted";
  if (source.url) {
    return (
      <a href={source.url} className={klass + " hover:border-caos-accent hover:text-caos-text transition-caos"} title={source.title}>
        {label}
      </a>
    );
  }
  return (
    <span className={klass} title={`${source.title} (${source.ref})`}>
      {label}
    </span>
  );
}

export function ProvenanceBadge({ value }: { value: string }) {
  // Shared grammar for the known flags; unknown vocabulary keeps the old
  // warning badge verbatim rather than being guessed into an origin.
  const prov = fromSeedFlag(value);
  if (prov) return <ProvenanceChip prov={prov} />;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-caos-warning/50 bg-caos-warning/10 px-1.5 py-px tabular text-caos-2xs uppercase tracking-wider text-caos-warning">
      <StatusGlyph kind="warning" size={8} />
      {value}
    </span>
  );
}
