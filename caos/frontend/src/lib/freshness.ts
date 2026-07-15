import type { FreshnessEvaluation, FreshnessState } from "@/lib/api";
import type { ProvFreshness } from "@/lib/provenance";

export const FRESHNESS_VIEW: Record<FreshnessState, { label: ProvFreshness; glyph: "success" | "warning" | "critical" | "idle"; color: string }> = {
  current: { label: "CURRENT", glyph: "success", color: "var(--caos-success)" },
  due: { label: "DUE", glyph: "warning", color: "var(--caos-warning)" },
  stale: { label: "STALE", glyph: "critical", color: "var(--caos-critical)" },
  unknown: { label: "UNKNOWN", glyph: "idle", color: "var(--caos-muted)" },
};

export function toProvFreshness(evaluation: FreshnessEvaluation | null | undefined): ProvFreshness {
  return evaluation ? FRESHNESS_VIEW[evaluation.state].label : "UNKNOWN";
}

// Stale is known-bad, unknown is unverified, due needs review, current is clear.
// Choosing the maximum prevents a current sibling from hiding a weaker source.
const SEVERITY: Record<FreshnessState, number> = { current: 0, due: 1, unknown: 2, stale: 3 };
export function worstFreshness(evaluations: Array<FreshnessEvaluation | null | undefined>): FreshnessEvaluation | null {
  return evaluations.filter((item): item is FreshnessEvaluation => !!item)
    .reduce<FreshnessEvaluation | null>((worst, item) => !worst || SEVERITY[item.state] > SEVERITY[worst.state] ? item : worst, null);
}

export function freshnessDetail(evaluation: FreshnessEvaluation): string {
  const stamp = evaluation.effective_period_end
    ? `effective ${evaluation.effective_period_end}`
    : evaluation.observed_at
      ? `observed ${evaluation.observed_at}`
      : "as-of unavailable";
  return `${evaluation.source_kind.replaceAll("_", " ")} · ${evaluation.reason.replaceAll("_", " ")} · ${stamp} · ${evaluation.policy_version}`;
}

const STATES = new Set<FreshnessState>(["current", "due", "stale", "unknown"]);
const SOURCE_KINDS = new Set<FreshnessEvaluation["source_kind"]>([
  "reported_financials", "price", "rating", "legal_document", "run", "derived_artifact",
]);

/** Parse only a complete policy-backed evaluation from immutable authority. */
export function freshnessFromAuthority(authority: Record<string, unknown> | null | undefined): FreshnessEvaluation | null {
  const raw = authority?.freshness_evaluation;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (!STATES.has(value.state as FreshnessState)) return null;
  if (!SOURCE_KINDS.has(value.source_kind as FreshnessEvaluation["source_kind"])) return null;
  if (typeof value.reason !== "string" || typeof value.policy_version !== "string") return null;
  const optionalString = (field: string) => value[field] == null || typeof value[field] === "string";
  if (!["observed_at", "effective_period_end", "expected_next_at", "due_at"].every(optionalString)) return null;
  if (value.age_days != null && (typeof value.age_days !== "number" || !Number.isFinite(value.age_days))) return null;
  return {
    state: value.state as FreshnessState,
    source_kind: value.source_kind as FreshnessEvaluation["source_kind"],
    observed_at: value.observed_at as string | null,
    effective_period_end: value.effective_period_end as string | null,
    expected_next_at: value.expected_next_at as string | null,
    due_at: value.due_at as string | null,
    age_days: value.age_days as number | null,
    reason: value.reason,
    policy_version: value.policy_version,
  };
}

export function resolvePipelineFreshnessRunId(
  runParam: string | null | undefined,
  liveRunId: string | null | undefined,
): string | null {
  return runParam ?? liveRunId ?? null;
}

export function resolveReportFreshnessTarget(
  selectedVersion: { id: string; run_id: string } | null | undefined,
  engineRunId: string | null | undefined,
): { artifactId: string | null; runId: string | null } {
  return selectedVersion
    ? { artifactId: selectedVersion.id, runId: selectedVersion.run_id }
    : { artifactId: null, runId: engineRunId ?? null };
}
