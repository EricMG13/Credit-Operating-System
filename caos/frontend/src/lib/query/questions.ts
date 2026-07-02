// The analyst-first IA for the Query rail: every engine capability rephrased as
// the question it answers, grouped by the job the analyst is doing — not by
// edge type. The backend keeps its own grouping (/api/query/capabilities);
// this remap is presentation only, so an unmapped capability still renders
// (engine label, "Watch the book") instead of disappearing.

import type { Capability, CapabilitiesResult } from "@/lib/query/graph";

export type JobId = "position" | "exposure" | "defend" | "watch";

export const JOBS: { id: JobId; label: string }[] = [
  { id: "position", label: "Position the credit" },
  { id: "exposure", label: "Map the exposures" },
  { id: "defend", label: "Defend a number" },
  { id: "watch", label: "Watch the book" },
];

export const QUESTIONS: Record<string, { q: string; job: JobId }> = {
  "peer-set": { q: "Who are the closest peers?", job: "position" },
  "peer-profile": { q: "Which names share this profile?", job: "position" },
  distribution: { q: "How does the focus rank on each metric?", job: "position" },
  scatter: { q: "Where does each name sit on leverage × coverage?", job: "position" },
  "metric-trend": { q: "How has a metric moved over time?", job: "position" },
  "concentration-map": { q: "Where is the book concentrated?", job: "exposure" },
  contagion: { q: "Who co-moves under an energy shock?", job: "exposure" },
  "shared-theme": { q: "Which names share a risk theme?", job: "exposure" },
  "sponsor-graph": { q: "Who owns and backs whom?", job: "exposure" },
  "trace-source": { q: "Where did this number come from?", job: "defend" },
  "conclusion-lineage": { q: "What supports the conclusion?", job: "defend" },
  "lineage-audit": { q: "How strong is the evidence lineage?", job: "defend" },
  "provenance-split": { q: "What is the evidence mix by source?", job: "defend" },
  "orphan-claims": { q: "Any claims without evidence?", job: "defend" },
  "impact-analysis": { q: "What breaks if this changes?", job: "defend" },
  tension: { q: "Where do bull and bear disagree?", job: "defend" },
  "debate-digest": { q: "What did the IC debate flag?", job: "defend" },
  "run-diff": { q: "What changed since the last run?", job: "watch" },
  "coverage-changed": { q: "Did coverage posture change?", job: "watch" },
  "coverage-completeness": { q: "Where are the coverage gaps?", job: "watch" },
  "open-findings": { q: "What QA findings are open?", job: "watch" },
  "gate-lane": { q: "Which gate lanes are hot?", job: "watch" },
  "committee-board": { q: "Is this committee-ready?", job: "watch" },
  "wiki-links": { q: "How is the wiki organised?", job: "watch" },
  "analyst-memos": { q: "What have analysts written?", job: "watch" },
};

// Which engine + module backs each walk — shown as the transparency line under
// the answer title, and as the rail row tooltip.
export const ENGINE_NOTES: Record<string, string> = {
  "trace-source": "CP-5B EvidenceTraceValidator — evidence lineage, 8-value taxonomy",
  "lineage-audit": "CP-5B EvidenceTraceValidator — research-integrity lineage audit",
  "provenance-split": "CP-5B EvidenceTraceValidator — evidence mix by provenance category",
  "orphan-claims": "CP-5B EvidenceTraceValidator — claims without supporting evidence",
  "conclusion-lineage": "CP-2 FundamentalCreditSynthesizer — conclusions back to fact packs",
  "impact-analysis": "CP-X PlannerRouter — downstream consequences and transmission paths",
  "coverage-completeness": "CP-0 SourceReadiness — coverage gaps across the watchlist",
  "peer-set": "CP-1C PeerBenchmark — 15-formula profile-distance ranking",
  "peer-profile": "CP-1C PeerBenchmark — 6-level peer hierarchy",
  "shared-theme": "CP-2 FundamentalCreditSynthesizer — shared macro drivers across issuers",
  "concentration-map": "CP-1 CanonicalDataFoundation — concentration by sector and country",
  contagion: "CP-2F MacroFXHedgingSensitivity — shock transmission across the watchlist",
  "sponsor-graph": "CP-1A BusinessTransactionFactPack — ownership and counterparty map",
  distribution: "CP-1 CanonicalDataFoundation — KPI distributions across the cohort",
  scatter: "CP-1C PeerBenchmark — leverage × interest-coverage cross-plot",
  "metric-trend": "CP-1 CanonicalDataFoundation — multi-period KPI series",
  "run-diff": "CP-1B EarningsDelta — current vs prior run deltas",
  "coverage-changed": "CP-SR SectorReview — coverage and watch changes",
  "open-findings": "CP-5 ResearchIntegrityQA — open findings by severity",
  "gate-lane": "CP-5 ResearchIntegrityQA — findings rolled up by gate lane",
  "committee-board": "CP-5 ResearchIntegrityQA — committee-readiness challenge board",
};

export const engineNote = (id: string): string => ENGINE_NOTES[id] || "Modular OS capability walk";
export const questionFor = (c: Capability): string => QUESTIONS[c.id]?.q || c.label;

export interface QuestionGroup {
  id: JobId;
  label: string;
  ready: number;
  total: number;
  capabilities: Capability[];
}

export function questionGroups(caps: CapabilitiesResult | null): QuestionGroup[] {
  const flat = caps?.groups.flatMap((g) => g.capabilities) ?? [];
  const seen = new Set<string>();
  return JOBS.map((job) => {
    const capabilities = flat.filter((c) => {
      if (seen.has(c.id)) return false;
      const owns = (QUESTIONS[c.id]?.job ?? "watch") === job.id;
      if (owns) seen.add(c.id);
      return owns;
    });
    return {
      id: job.id,
      label: job.label,
      ready: capabilities.filter((c) => c.enabled).length,
      total: capabilities.length,
      capabilities,
    };
  }).filter((g) => g.total > 0);
}
