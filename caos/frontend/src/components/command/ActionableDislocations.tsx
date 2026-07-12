"use client";

// Sector RV's decision-first opener: the widest |RV| dislocations across the
// WHOLE loan universe, ranked ahead of the scatter/toolbar/heatmap/averages
// (which stay exactly as-is, just demoted below — WP-6, design-rebuild
// Phase 2). Deliberately NOT sector-scoped — the analyst shouldn't have to
// pick a sector tab before seeing where the cheap/rich tails sit.
//
// Held badge and the Deep-Dive action both key off the SAME
// portfolioRv.held match SectorRV already uses for the peer table and
// Top-of-book (built in buildRVHoldingsMap from figi/id/name/borrower).
// There is no broader issuer registry available on RVRow, so a name that
// doesn't match the portfolio holdings never gets a badge or a link — never
// fabricate a holdings check, never a dead Deep-Dive link (seam-honesty
// discipline, P2 WP-1/2/3).
//
// No self-wrapping Panel chrome here (matches RankedChanges.tsx) — the
// caller wraps this in a collapsible PanelShell.

import Link from "next/link";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import type { ProvFreshness } from "@/lib/provenance";
import { rankDislocations, canOpenDeepDive, deepDiveHref, type Dislocation } from "@/lib/command/dislocations";
import { RV_AS_OF, rvStaleness, type RVRow } from "@/lib/command/rvdata";

function freshnessFrom(label: string): ProvFreshness {
  if (label === "UNKNOWN") return "UNKNOWN";
  if (label.startsWith("CURRENT")) return "CURRENT";
  return "STALE";
}

function DislocationRow({ d }: { d: Dislocation }) {
  const color =
    d.rvBp > 0 ? "var(--caos-success-bright)" : d.rvBp < 0 ? "var(--caos-critical-bright)" : "var(--caos-muted)";
  const sign = d.rvBp > 0 ? "+" : "";
  const carrySign = d.carryRv !== null && d.carryRv > 0 ? "+" : "";

  return (
    <div className="px-3 py-[6px] border-b border-caos-border/50 flex items-center gap-2 flex-wrap">
      {/* Sign + explicit rv label so direction never rides on colour alone. */}
      <span className="tabular text-caos-sm font-semibold whitespace-nowrap" style={{ color }}>
        {sign}
        {Math.round(d.rvBp)}bp
      </span>
      <span className="tabular text-caos-2xs whitespace-nowrap" style={{ color }}>
        {d.rv}
      </span>
      <IssuerLink
        query={d.company}
        title={`Open ${d.company} profile`}
        className="tabular text-caos-sm text-caos-accent hover:text-caos-text transition-caos focus-ring rounded px-0.5 outline-none min-w-0 truncate"
      >
        {d.company}
      </IssuerLink>
      {d.held && (
        <span
          className="tabular text-[9px] uppercase font-bold text-caos-success border border-caos-success/30 bg-caos-success/5 px-1 rounded-sm whitespace-nowrap"
          title="Matched to a current portfolio holding"
        >
          held {d.headroomPct !== undefined ? `+${d.headroomPct}%` : ""}
        </span>
      )}
      <span className="tabular text-caos-2xs text-caos-muted whitespace-nowrap">
        {d.rating} · {d.subSector}
      </span>
      <span className="tabular text-caos-xs text-caos-muted ml-auto whitespace-nowrap">
        carry {d.carryRv !== null ? `${carrySign}${d.carryRv.toFixed(1)}` : "—"} bp/yr
      </span>
      {canOpenDeepDive(d) ? (
        <Link
          href={deepDiveHref(d)}
          title={`Open ${d.company} in Deep-Dive`}
          className="no-underline tabular text-caos-xs text-caos-accent hover:text-caos-text border border-caos-border/70 hover:border-caos-accent/60 rounded px-1.5 min-h-8 flex items-center transition-caos focus-ring outline-none caos-target"
        >
          Deep-Dive →
        </Link>
      ) : null}
    </div>
  );
}

export function ActionableDislocations({ rows }: { rows: RVRow[] }) {
  const ranked = rankDislocations(rows);
  const benchedCount = rows.filter((r) => r.rvBp !== null).length;
  const staleness = rvStaleness(RV_AS_OF);

  return (
    <div>
      <div className="px-3 py-1.5 flex items-center gap-2 border-b border-caos-border/50 flex-wrap">
        <ProvenanceChip
          prov={{
            origin: "REFERENCE",
            method: "DERIVED",
            freshness: freshnessFrom(staleness.label),
            detail: "market-data.json reference feed · RV = 3Y DM − sector×rating median (n ≥ 2)",
            asOf: RV_AS_OF,
          }}
        />
        <span
          className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted"
          title="Ranked by |RV vs sector×rating median| across the full loan universe, widest dislocation first; carry = rvBp / years to maturity."
        >
          Ranked by |RV| + carry — full universe
        </span>
        <span className="tabular text-caos-2xs text-caos-muted ml-auto">
          {ranked.length} of {benchedCount} benchmarked
        </span>
      </div>
      {ranked.length === 0 ? (
        <p className="m-0 px-3 py-4 tabular text-caos-xs text-caos-muted">
          No benchmarked loans in the current universe — no actionable dislocation to rank.
        </p>
      ) : (
        <div>
          {ranked.map((d) => (
            <DislocationRow key={d.figi} d={d} />
          ))}
        </div>
      )}
    </div>
  );
}
