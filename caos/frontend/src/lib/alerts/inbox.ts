// Pure draft→AlertRow derivation — the SINGLE shared source for both
// Command's ranked-changes opener and Monitor's alert inbox, so the two
// surfaces can never disagree about what an alert says (P2-WP-1/2/3).
//
// alert_key mirrors the server's stated contract (run:issuer:kind:metric) —
// the draft has no explicit run id, so `generated_at` stands in for the cycle
// identifier: it is stable across repeated GETs of the same completed cycle
// and changes only when a new cycle completes, which is exactly the
// "cycle-scoped" property the server design relies on (a later cycle
// re-firing the same anomaly gets a genuinely new key, per WP-0).

import type { AutonomyDraft, AutonomySection, AutonomyClaim, AutonomyBullet } from "@/lib/api";

export interface AlertRow {
  key: string;
  issuerId: string | null;
  issuerName: string;
  /** Headline — the claim text, or a deterministic bullet description. */
  event: string;
  /** Anomaly kind + direction, terse desk language. */
  reason: string;
  metric: string | null;
  severity: number;
  /** MODELLED = LLM-validated claim; DERIVED = deterministic bullet, no LLM. */
  method: "MODELLED" | "DERIVED";
  evidence: { chunkIds: string[]; factIds: string[] };
  /** When the cycle that produced this row completed (ISO), if known. */
  sinceWhen: string | null;
}

function bulletEvent(b: AutonomyBullet): string {
  const dir = b.direction ? ` ${b.direction}` : "";
  const metric = b.metric ? ` ${b.metric}` : "";
  return `${b.kind}${metric}${dir}`.trim();
}

function rowsForSection(section: AutonomySection, sinceWhen: string | null): AlertRow[] {
  const claimRows: AlertRow[] = section.claims.map((c: AutonomyClaim) => ({
    key: `${sinceWhen ?? "unknown"}:${section.issuer_id ?? "_unknown"}:${c.anomaly_kind}:claim`,
    issuerId: section.issuer_id,
    issuerName: section.issuer_name,
    event: c.text,
    reason: c.anomaly_kind,
    metric: null,
    severity: c.anomaly_severity,
    method: "MODELLED",
    evidence: { chunkIds: c.chunk_ids, factIds: c.fact_ids },
    sinceWhen,
  }));
  const bulletRows: AlertRow[] = section.deterministic_bullets.map((b: AutonomyBullet) => ({
    key: `${sinceWhen ?? "unknown"}:${section.issuer_id ?? "_unknown"}:${b.kind}:${b.metric ?? "bullet"}`,
    issuerId: section.issuer_id,
    issuerName: section.issuer_name,
    event: bulletEvent(b),
    reason: b.direction ? `${b.kind} · ${b.direction}` : b.kind,
    metric: b.metric,
    severity: b.severity,
    method: "DERIVED",
    evidence: { chunkIds: b.chunk_id ? [b.chunk_id] : [], factIds: [] },
    sinceWhen,
  }));
  return [...claimRows, ...bulletRows];
}

/** Severity-ranked rows from a live draft. Empty sections → empty array
 *  (an honest empty draft, not an error). */
export function draftToAlertRows(draft: AutonomyDraft): AlertRow[] {
  const sinceWhen = draft.generated_at ?? null;
  const rows = draft.sections.flatMap((s) => rowsForSection(s, sinceWhen));
  return rows.sort((a, b) => b.severity - a.severity);
}

// Deterministic anomaly-kind → suggested next step. A fixed, honest mapping —
// never an LLM call — so "required action" never blocks on a model lane.
const REQUIRED_ACTION: Record<string, string> = {
  "cusum-shift": "review trend model",
  "ts-jump": "review timing shift",
  "peer-outlier": "compare to peers",
};

export function requiredActionFor(row: Pick<AlertRow, "reason">): string {
  const kind = row.reason.split(" · ")[0];
  return REQUIRED_ACTION[kind] ?? "review finding";
}
