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
