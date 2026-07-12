// Live CP-0 source-gap board — derived from real run gap logs (A-1 mock→engine).
//
// The Command "Source Gaps" board seeds a per-issuer list (data.ts GAPS). This
// derives the same shape from the live portfolio: each issuer's latest run carries
// CP-0's source-readiness gap log (a missing source category → "No X vaulted"),
// surfaced on PortfolioRowDTO.gaps. Falls back to the seed offline so the demo is
// unchanged.

import type { PortfolioRowDTO } from "@/lib/api";
import type { GapItem } from "@/lib/command/data";

const RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Latest run's as-of (ISO, UTC-stamped by the API) → the board's "Mon DD" label.
// UTC parts, not locale, so it matches the seed format and is test-deterministic.
function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")}`;
}

function normSev(sev: string): "high" | "medium" | "low" {
  return sev === "high" || sev === "medium" || sev === "low" ? sev : "low";
}

export function liveGaps(rows: PortfolioRowDTO[]): GapItem[] {
  return rows
    .flatMap((r) =>
      (r.gaps || []).map((g): GapItem => ({
        issuer: r.ticker || r.name,
        doc: g.doc,
        impact: "CP-0 source-readiness gap — downstream modules degrade until vaulted.",
        sev: normSev(g.sev),
        requested: shortDate(r.as_of),
      })),
    )
    .sort((a, b) => RANK[a.sev] - RANK[b.sev]);
}
