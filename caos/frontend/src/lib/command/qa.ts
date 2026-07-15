// Live CP-5 QA queue — derived from real run gate roll-ups (A-1 mock→engine).
//
// The Command QA board seeds a per-finding triage list (data.ts QA_QUEUE). This
// derives the same shape from the live portfolio: an issuer whose latest run did
// not clear the CP-5 gate (Blocked / Restricted) is an open governance item. It
// is a per-issuer gate roll-up — coarser than the seeded per-finding view (that
// needs an aggregated findings endpoint, a later slice) but real engine output,
// so the board reflects actual gate outcomes when a backend is present and falls
// back to the seed offline.

import type { PortfolioRowDTO } from "@/lib/api";
import type { QaQueueItem } from "@/lib/command/data";

// CP-5 gate verdict → queue severity. Passed / Not Reviewed / anything cleared is
// not a triage item, so it is excluded (returns undefined).
const GATE_SEV: Record<string, "HIGH" | "MEDIUM"> = {
  Blocked: "HIGH",
  Restricted: "MEDIUM",
};

const SEV_ORDER: Record<"HIGH" | "MEDIUM" | "LOW", number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function liveQaItems(rows: PortfolioRowDTO[]): QaQueueItem[] {
  return rows
    .map((r): QaQueueItem | null => {
      const sev = GATE_SEV[r.qa_status];
      if (!sev) return null;
      return {
        id: r.run_id.slice(0, 8),
        issuer: r.ticker || r.name,
        module: "CP-5",
        sev,
        age: r.as_of || "—",
        text: `CP-5 gate ${r.qa_status} — committee ${r.committee_status}`,
      };
    })
    .filter((x): x is QaQueueItem => x !== null)
    .sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
}

// A distinct, non-overlapping gate-failure tier: the CP-5 severity gate itself
// PASSED, but engine/gate.py's fail-closed committee_status_from still refuses
// committee readiness (low confidence, or an unrecognized/partial status the
// default degrades). liveQaItems already owns Blocked/Restricted — this only
// catches the rows that gate would silently miss, so a genuinely separate
// "Failed Gates" governance category never double-counts a row liveQaItems
// already lists.
const COMMITTEE_ONLY_SEV: Record<string, "MEDIUM" | "LOW"> = {
  "Draft Only": "MEDIUM",
  "Insufficient Information": "LOW",
};

export function liveFailedGates(rows: PortfolioRowDTO[]): QaQueueItem[] {
  return rows
    .map((r): QaQueueItem | null => {
      if (GATE_SEV[r.qa_status]) return null; // already a liveQaItems row
      const sev = COMMITTEE_ONLY_SEV[r.committee_status];
      if (!sev) return null;
      return {
        id: r.run_id.slice(0, 8),
        issuer: r.ticker || r.name,
        module: "CP-5",
        sev,
        age: r.as_of || "—",
        text: `CP-5 gate ${r.qa_status} but committee status is "${r.committee_status}" — not committee-ready`,
      };
    })
    .filter((x): x is QaQueueItem => x !== null)
    .sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
}
