"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, toErrorMessage } from "@/lib/api";

export type AnalysisJobState =
  | "queued"
  | "running"
  | "partial"
  | "ready"
  | "observed-empty"
  | "stale"
  | "offline"
  | "unavailable"
  | "error"
  | "cancelled";

export interface AuthorityEnvelope {
  origin: string;
  method: string;
  freshness: string;
  as_of: string | null;
  source_ids: string[];
  run_id: string | null;
  version_id: string | null;
  confidence: number | null;
  approval_state: "draft" | "ratified" | "published" | "rejected";
  analyst_override: string | null;
}

export interface AnalysisArtifactRefs {
  issuer_run_id: string | null;
  source_manifest_id: string | null;
  research_job_id: string | null;
  model_checkpoint_id: string | null;
  report_version_id: string | null;
  alert_event_id: string | null;
  sponsor_id: string | null;
}

export type AnalysisSurfaceName =
  | "issuers" | "upload" | "research" | "sponsors" | "command"
  | "deep-dive" | "model" | "reports" | "pipeline" | "monitor"
  | "settings" | "issuer-profile" | "global-ask" | "query"
  | "sector-review" | "rv-screener";

export interface AnalysisSurfaceStateEntry {
  query?: string | null;
  selected_ids?: string[];
  active_id?: string | null;
  sort?: string | null;
  view?: string | null;
  filters?: Record<string, string | number | boolean | null | string[]>;
}

export interface AnalysisContext {
  id: string;
  name: string;
  sector_id: string | null;
  sub_segments: string[];
  issuer_ids: string[];
  instrument_ids: string[];
  portfolio_scope: string | null;
  as_of: string | null;
  sector_review_run_id: string | null;
  rv_snapshot_id: string | null;
  rv_run_id: string | null;
  query_session_id: string | null;
  artifacts: AnalysisArtifactRefs;
  surface_state: Partial<Record<AnalysisSurfaceName, AnalysisSurfaceStateEntry>>;
  filters: Record<string, unknown>;
  selected: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Finding {
  id: string;
  context_id: string;
  kind: string;
  title: string;
  body: string;
  source_surface:
    | "query" | "sector-review" | "rv-screener" | "research" | "sponsors"
    | "command" | "deep-dive" | "model" | "reports" | "pipeline"
    | "monitor" | "issuer-profile" | "global-ask";
  source_run_id: string | null;
  status: "draft" | "ratified" | "archived";
  evidence: Record<string, unknown>;
  authority: AuthorityEnvelope;
  created_at: string;
  updated_at: string;
}

export interface QueryRun {
  id: string;
  context_id: string;
  question: string;
  selected_lane: "metric" | "graph" | "grounded";
  method_override: string | null;
  status: AnalysisJobState;
  result: Record<string, unknown>;
  authority: AuthorityEnvelope;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SectorReviewV2 {
  id: string;
  context_id: string;
  sector_id: string;
  sector_label: string;
  timeframe: string;
  version: number;
  status: AnalysisJobState;
  as_of: string;
  posture: string;
  what_changed: string;
  why_it_matters: string;
  required_action: string;
  evidence_health: string;
  sections: Array<{ id: string; title: string; posture: string; summary: string; confidence: number; freshness: string; signal_ids: string[] }>;
  dimension_scores: Array<{ id: string; label: string; score: number | null; confidence: number; freshness: string; source_ids: string[]; missing_dependency: string | null }>;
  risks: Array<{ id: string; title: string; likelihood: string; severity: string; mitigants: string[]; residual_risk: string; source_ids: string[] }>;
  comparables: Array<{ issuer_id: string | null; issuer_name: string; posture: string; metrics: Record<string, unknown>; missing_dependencies: string[] }>;
  early_warning: Array<{ id: string; indicator: string; threshold: string; current_state: string; status: string; source_ids: string[] }>;
  source_register: Array<{ id: string; title: string; origin: string; method: string; freshness: string; as_of: string; url: string | null }>;
  uncertainties: Array<{ id: string; statement: string; impact: string; route_to_qa: boolean; source_ids: string[] }>;
  downstream_readiness: { ready: boolean; consumers: string[]; blocked_by: string[] };
  missing_dependencies: string[];
  authority: AuthorityEnvelope;
  ratifications: Record<string, string>;
  created_at: string;
}

export interface RVCandidate {
  id: string;
  instrument_id: string;
  instrument_key: string;
  figi: string | null;
  borrower: string;
  rank: number;
  classification: "actionable" | "screen-only" | "unavailable";
  recommendation: string;
  missing_gates: string[];
  market: Record<string, unknown>;
  pitch: Record<string, unknown>;
  evidence: Record<string, unknown>;
  portfolio_impact: Record<string, unknown>;
  ratified_at: string | null;
}

export interface RVScreenRun {
  id: string;
  context_id: string;
  snapshot_id: string;
  status: AnalysisJobState;
  filters: Record<string, unknown>;
  authority: AuthorityEnvelope;
  candidates: RVCandidate[];
  counts: Record<string, number>;
  missing_dependencies: string[];
  created_at: string;
  updated_at: string;
}

export const analysisApi = {
  getTaxonomy: () => api.get<{ sectors: Array<{ id: string; label: string; aliases: string[] }> }>("/api/analysis/taxonomy").then((response) => response.data.sectors),
  createContext: (body: Partial<AnalysisContext> & { name: string }) =>
    api.post<AnalysisContext>("/api/analysis/contexts", body).then((response) => response.data),
  getContext: (id: string) =>
    api.get<AnalysisContext>(`/api/analysis/contexts/${id}`).then((response) => response.data),
  patchContext: (id: string, body: Partial<AnalysisContext>) =>
    api.patch<AnalysisContext>(`/api/analysis/contexts/${id}`, body).then((response) => response.data),
  listFindings: (contextId: string) =>
    api.get<Finding[]>("/api/analysis/findings", { params: { context_id: contextId } }).then((response) => response.data),
  createFinding: (body: {
    context_id: string;
    kind: string;
    title: string;
    body?: string;
    source_surface: Finding["source_surface"];
    source_run_id: string;
    evidence?: Record<string, unknown>;
  }) => api.post<Finding>("/api/analysis/findings", body).then((response) => response.data),
  createQueryRun: (body: {
    context_id: string;
    question: string;
    selected_lane: QueryRun["selected_lane"];
    capability_id?: string;
    issuer_id?: string;
    method_override?: string;
  }) => api.post<QueryRun>("/api/query/runs", body).then((response) => response.data),
  listQueryRuns: (contextId: string) =>
    api.get<QueryRun[]>("/api/query/runs", { params: { context_id: contextId } }).then((response) => response.data),
  createSectorReview: (body: { context_id: string; sector_id?: string; timeframe?: string }) =>
    api.post<SectorReviewV2>("/api/sector/reviews", body).then((response) => response.data),
  listSectorReviews: (contextId: string) =>
    api.get<SectorReviewV2[]>("/api/sector/reviews", { params: { context_id: contextId } }).then((response) => response.data),
  ratifySectorReview: (reviewId: string, sections: Array<{ section_id: string; decision: "ratified" | "rejected"; override_text?: string }>) =>
    api.post<SectorReviewV2>(`/api/sector/reviews/${reviewId}/ratifications`, { sections }).then((response) => response.data),
  publishSectorReview: (reviewId: string) =>
    api.post<SectorReviewV2>(`/api/sector/reviews/${reviewId}/publish`).then((response) => response.data),
  createRVScreen: (body: { context_id: string; snapshot_id?: string; filters?: Record<string, unknown> }) =>
    api.post<RVScreenRun>("/api/rv/screens", body).then((response) => response.data),
  getRVScreen: (id: string) =>
    api.get<RVScreenRun>(`/api/rv/screens/${id}`).then((response) => response.data),
  ratifyRVCandidate: (runId: string, candidateId: string, analystOverride?: string) =>
    api.post<RVScreenRun>(`/api/rv/screens/${runId}/ratifications`, { candidate_id: candidateId, analyst_override: analystOverride }).then((response) => response.data),
};

export function contextHref(path: string, contextId: string, params: Record<string, string> = {}) {
  const search = new URLSearchParams({ context: contextId, ...params });
  return `${path}?${search.toString()}`;
}

const pendingContextCreates = new Map<string, Promise<AnalysisContext>>();

function createContextOnce(defaults: { name: string; sector_id?: string }) {
  const key = `${defaults.name}|${defaults.sector_id ?? ""}`;
  const pending = pendingContextCreates.get(key);
  if (pending) return pending;
  const created = analysisApi.createContext({ name: defaults.name, sector_id: defaults.sector_id })
    .finally(() => pendingContextCreates.delete(key));
  pendingContextCreates.set(key, created);
  return created;
}

export function useAnalysisContext(defaults: { name: string; sector_id?: string }) {
  const defaultName = defaults.name;
  const defaultSectorId = defaults.sector_id;
  const [context, setContext] = useState<AnalysisContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL(window.location.href);
        const contextId = url.searchParams.get("context");
        const value = contextId
          ? await analysisApi.getContext(contextId)
          : await createContextOnce({ name: defaultName, sector_id: defaultSectorId });
        if (cancelled) return;
        setContext(value);
        window.dispatchEvent(new CustomEvent("caos:analysis-context", { detail: value }));
        if (!contextId) {
          url.searchParams.set("context", value.id);
          window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
        }
      } catch (reason) {
        if (!cancelled) setError(toErrorMessage(reason, "Analysis context unavailable."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [defaultName, defaultSectorId]);

  const patch = useCallback(async (changes: Partial<AnalysisContext>) => {
    if (!context) return null;
    const value = await analysisApi.patchContext(context.id, changes);
    setContext(value);
    return value;
  }, [context]);

  return useMemo(() => ({ context, setContext, patch, loading, error }), [context, patch, loading, error]);
}
