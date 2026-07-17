// Live CP-5 QA queue. Exact engine findings own the queue; an issuer-level gate
// roll-up is retained only when that exact latest run emitted no finding rows.

import type { PortfolioRowDTO } from "@/lib/api";
import type { QaQueueItem } from "@/lib/command/data";
import type { LatestQaFindingDTO } from "@/lib/engine/useQaFindings";

// CP-5 gate verdict → queue severity. Passed / Not Reviewed / anything cleared is
// not a triage item, so it is excluded (returns undefined).
const GATE_SEV: Record<string, "HIGH" | "MEDIUM"> = {
  Blocked: "HIGH",
  Restricted: "MEDIUM",
};

const SEV_ORDER: Record<"HIGH" | "MEDIUM" | "LOW", number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const FINDING_SEV: Record<string, "HIGH" | "MEDIUM" | "LOW"> = {
  CRITICAL: "HIGH",
  MATERIAL: "MEDIUM",
  MINOR: "LOW",
};

export function liveQaItems(
  rows: PortfolioRowDTO[],
  findings: LatestQaFindingDTO[] = [],
): QaQueueItem[] {
  const exactRunIds = new Set(findings.map((finding) => finding.run_id));
  const exactIssuerIds = new Set(findings.map((finding) => finding.issuer_id));
  const exact = findings.map((finding): QaQueueItem => ({
    id: finding.finding_id || finding.id.slice(0, 8),
    key: finding.id,
    issuer: finding.ticker || finding.issuer,
    module: finding.module_id || "CP-5",
    sev: FINDING_SEV[finding.severity] || "LOW",
    age: finding.as_of || "—",
    text: finding.required_remediation
      ? `${finding.description} — remediation: ${finding.required_remediation}`
      : finding.description,
  }));
  const rollups = rows
    .map((r): QaQueueItem | null => {
      // The portfolio is an institutional latest-run board, while findings are
      // analyst-private unless desk sharing is enabled. Suppress the coarse row
      // by issuer too, so a newer foreign aggregate cannot duplicate the caller's
      // exact accessible finding for the same credit.
      if (exactRunIds.has(r.run_id) || exactIssuerIds.has(r.issuer_id)) return null;
      const sev = GATE_SEV[r.qa_status];
      if (!sev) return null;
      return {
        id: r.run_id.slice(0, 8),
        key: r.run_id,
        issuer: r.ticker || r.name,
        module: "CP-5",
        sev,
        age: r.as_of || "—",
        text: `CP-5 gate ${r.qa_status} — committee ${r.committee_status}`,
      };
    })
    .filter((x): x is QaQueueItem => x !== null);
  return [...exact, ...rollups].sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
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
