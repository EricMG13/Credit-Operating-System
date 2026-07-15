// Pure ranking logic for Sector RV's "actionable dislocations" opener —
// extracted from SectorRV.tsx's topOfBook() so the demoted Top-of-book panel
// and this new opener can never diverge on what counts as the widest
// dislocation. No React, no fabricated fields: every value is read straight
// off RVRow (rvBp, carryRv, portfolioRv.held) exactly as the peer table and
// Top-of-book already do.

import type { RVRow, RVSignal } from "./rvdata";

export interface Dislocation {
  figi: string;
  company: string;
  sector: string;
  subSector: string;
  rating: string;
  rvBp: number;
  absRvBp: number;
  rv: RVSignal;
  carryRv: number | null;
  held: boolean;
  headroomPct?: number;
}

const toDislocation = (r: RVRow): Dislocation => ({
  figi: r.figi,
  company: r.company,
  sector: r.sector,
  subSector: r.subSector,
  rating: r.rating,
  rvBp: r.rvBp as number, // callers pre-filter rvBp !== null
  absRvBp: Math.abs(r.rvBp as number),
  rv: r.rv,
  carryRv: r.carryRv,
  held: r.portfolioRv.held,
  headroomPct: r.portfolioRv.headroomPct,
});

// Widest dislocation first (either side of fair value), ties broken by
// company for a stable, deterministic list. Rows with no benchmark
// (rvBp === null, insufficient sector×rating peer set) drop out — the same
// exclusion topOfBook and the peer table's default sort already apply.
export function rankDislocations(rows: RVRow[], limit = 8): Dislocation[] {
  return rows
    .filter((r) => r.rvBp !== null)
    .map(toDislocation)
    .sort((a, b) => b.absRvBp - a.absRvBp || a.company.localeCompare(b.company))
    .slice(0, limit);
}

// Deep-Dive is only offered for a name matched to the portfolio/holdings
// registry (portfolioRv.held, built in buildRVHoldingsMap from figi/id/name/
// borrower). The wider peer universe carries unmatched, synthetic
// market-data names with no registered issuer profile — never fabricate a
// link for those (P2 seam-honesty discipline).
export function canOpenDeepDive(d: Pick<Dislocation, "held">): boolean {
  return d.held;
}

export function deepDiveHref(d: Pick<Dislocation, "company">): string {
  return `/deepdive?issuer=${encodeURIComponent(d.company)}`;
}
