"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import axios from "axios";
import { useAuth } from "@/components/shared/AuthProvider";
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

export type ArtifactKind =
  | "issuer_run"
  | "source_manifest"
  | "research_job"
  | "model_checkpoint"
  | "report_version"
  | "alert_event"
  | "sponsor"
  | "portfolio"
  | "decision"
  | "insight"
  | "document"
  | "document_chunk"
  | "market_snapshot";

export interface ArtifactRef {
  kind: ArtifactKind;
  id: string;
  version?: string | null;
}

export interface AnalysisArtifactRefs {
  issuer_run_id: string | null;
  source_manifest_id: string | null;
  research_job_id: string | null;
  model_checkpoint_id: string | null;
  report_version_id: string | null;
  alert_event_id: string | null;
  sponsor_id: string | null;
  portfolio_id?: string | null;
  decision_id?: string | null;
  insight_id?: string | null;
  /** Omitted on scalar-only v1 responses; present when typed refs are bound. */
  artifact_refs?: ArtifactRef[];
}

export type AnalysisSurfaceName =
  | "issuers" | "upload" | "research" | "sponsors" | "command"
  | "deep-dive" | "model" | "reports" | "pipeline" | "monitor"
  | "settings" | "issuer-profile" | "global-ask" | "query"
  | "sector-review" | "rv-screener" | "portfolio-lab" | "ic-book";

export interface InsightClaim {
  id: string;
  statement: string;
  evidence_ids: string[];
  numeric_facts: Array<{ label: string; value: number; unit?: string | null }>;
}

export interface InsightPage {
  /** Immutable version history; use current for the effective analyst view. */
  items: InsightArtifact[];
  /** Newest ready or ratified insight, independent of the history cursor. */
  current: InsightArtifact | null;
  next_cursor: string | null;
}

export interface InsightArtifact {
  id: string;
  context_id: string;
  surface: AnalysisSurfaceName;
  kind: string;
  status: "queued" | "running" | "ready" | "partial" | "error" | "stale" | "ratified" | "rejected";
  subject_refs: AnalysisArtifactRefs;
  summary: string;
  claims: InsightClaim[];
  recommended_actions: string[];
  missing_dependencies: string[];
  authority: AuthorityEnvelope;
  source_fingerprint: string;
  version: number;
  model: string | null;
  generated_at: string;
  ratified_at: string | null;
  rejected_at: string | null;
  lease_owner: string | null;
  lease_expires_at: string | null;
}

export interface InsightCreate {
  surface: AnalysisSurfaceName;
  kind: string;
  subject_refs?: Partial<AnalysisArtifactRefs>;
  force?: boolean;
}

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
  revision: number;
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

export type AnalysisContextPatch = Omit<Partial<AnalysisContext>, "artifacts" | "surface_state"> & {
  artifacts?: Partial<AnalysisArtifactRefs>;
  surface_state?: AnalysisContext["surface_state"];
  expected_revision?: number;
};

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
  snapshot_source_label: string | null;
  snapshot_freshness: Record<string, unknown> | null;
  filters: Record<string, unknown>;
  authority: AuthorityEnvelope;
  candidates: RVCandidate[];
  counts: Record<string, number>;
  missing_dependencies: string[];
  created_at: string;
  updated_at: string;
}

export interface MarketImportIssue {
  severity: "blocking" | "warning";
  code: string;
  message: string;
  row: number | null;
  column: string | null;
  field: string | null;
}

export interface MarketWorkbookPreview {
  workbook_sha256: string;
  preview_token: string;
  issuer_mappings: Record<string, string>;
  selected_sheet: string | null;
  header_row: number | null;
  mapping: Record<string, unknown>;
  as_of: string | null;
  row_count: number;
  accepted_count: number;
  rejected_count: number;
  formula_cell_count: number;
  blocking_count: number;
  warning_count: number;
  preview_truncated: boolean;
  rows: Array<Record<string, unknown>>;
  issues: MarketImportIssue[];
}

export interface MarketImportCommit {
  snapshot_id: string;
  existing: boolean;
  document_id: string | null;
  source_manifest_id: string | null;
  workbook_sha256: string;
  payload_hash: string;
  as_of: string;
  source_label: string;
  instrument_count: number;
  rejected_count: number;
  warning_count: number;
  formula_cell_count: number;
  freshness: Record<string, unknown>;
}

export interface MarketSnapshotSummary {
  id: string;
  as_of: string;
  source_label: string;
  origin: string;
  method: string;
  status: string;
  document_id: string | null;
  source_manifest_id: string | null;
  freshness: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
}

type MarketWorkbookBody = {
  file: File;
  mapping: Record<string, unknown>;
  issuerMappings?: Record<string, string>;
};

function marketWorkbookForm(body: MarketWorkbookBody) {
  const form = new FormData();
  form.append("file", body.file);
  form.append("mapping", JSON.stringify(body.mapping));
  form.append("issuer_mappings", JSON.stringify(body.issuerMappings ?? {}));
  return form;
}

export const analysisApi = {
  getTaxonomy: () => api.get<{ sectors: Array<{ id: string; label: string; aliases: string[] }> }>("/api/analysis/taxonomy").then((response) => response.data.sectors),
  createContext: (body: Partial<AnalysisContext> & { name: string }) =>
    api.post<AnalysisContext>("/api/analysis/contexts", body).then((response) => response.data),
  getContext: (id: string) =>
    api.get<AnalysisContext>(`/api/analysis/contexts/${encodeURIComponent(id)}`).then((response) => response.data),
  patchContext: (id: string, body: AnalysisContextPatch) =>
    api.patch<AnalysisContext>(`/api/analysis/contexts/${id}`, body).then((response) => response.data),
  listInsights: (
    contextId: string,
    filters: { surface?: AnalysisSurfaceName; kind?: string; cursor?: string; limit?: number } = {},
  ) => api.get<InsightPage>(`/api/analysis/contexts/${contextId}/insights`, {
    params: filters,
  }).then((response) => response.data),
  createInsight: (contextId: string, body: InsightCreate) =>
    api.post<InsightArtifact>(`/api/analysis/contexts/${contextId}/insights`, body)
      .then((response) => response.data),
  ratifyInsight: (id: string) =>
    api.post<InsightArtifact>(`/api/analysis/insights/${id}/ratify`)
      .then((response) => response.data),
  rejectInsight: (id: string) =>
    api.post<InsightArtifact>(`/api/analysis/insights/${id}/reject`)
      .then((response) => response.data),
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
  // Unpin = archive, not delete: the register keeps the row (audit trail) but
  // every tray/count reads findings through activeFindings() so an archived
  // finding disappears from downstream surfaces.
  archiveFinding: (id: string) =>
    api.patch<Finding>(`/api/analysis/findings/${id}`, { status: "archived" }).then((response) => response.data),
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
  listMarketSnapshots: () =>
    api.get<{ snapshots: MarketSnapshotSummary[] }>("/api/rv/snapshots").then((response) => response.data.snapshots),
  previewMarketWorkbook: (body: MarketWorkbookBody) => {
    const form = marketWorkbookForm(body);
    return api.post<MarketWorkbookPreview>("/api/rv/snapshots/import/preview", form)
      .then((response) => response.data);
  },
  commitMarketWorkbook: (body: MarketWorkbookBody & {
    preview: MarketWorkbookPreview;
    sourceLabel: string;
  }) => {
    const form = marketWorkbookForm(body);
    form.append("preview_sha256", body.preview.workbook_sha256);
    form.append("preview_token", body.preview.preview_token);
    form.append("source_label", body.sourceLabel);
    return api.post<MarketImportCommit>("/api/rv/snapshots/import/commit", form)
      .then((response) => response.data);
  },
  getRVScreen: (id: string) =>
    api.get<RVScreenRun>(`/api/rv/screens/${id}`).then((response) => response.data),
  ratifyRVCandidate: (runId: string, candidateId: string, analystOverride?: string) =>
    api.post<RVScreenRun>(`/api/rv/screens/${runId}/ratifications`, { candidate_id: candidateId, analyst_override: analystOverride }).then((response) => response.data),
};

/** The one read-side filter for pinned findings: archived rows stay in the
 * register for audit but never render in trays or counts. */
export function activeFindings(rows: Finding[]): Finding[] {
  return rows.filter((finding) => finding.status !== "archived");
}

export function contextHref(path: string, contextId: string, params: Record<string, string> = {}) {
  const search = new URLSearchParams({ context: contextId, ...params });
  return `${path}?${search.toString()}`;
}

export function mergeContextIntoCurrentUrl(href: string, contextId: string) {
  const current = new URL(href);
  if (!current.searchParams.has("context")) current.searchParams.set("context", contextId);
  return `${current.pathname}${current.search}${current.hash}`;
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sparseNestedDelta<T extends Record<string, unknown>>(
  incoming: T,
  current: Record<string, unknown>,
): T {
  return Object.fromEntries(
    Object.entries(incoming).filter(([key, value]) => !sameJsonValue(value, current[key])),
  ) as T;
}

const sparseArtifacts = (
  artifacts: NonNullable<AnalysisContextPatch["artifacts"]>,
  current: AnalysisContext,
): Partial<AnalysisArtifactRefs> => sparseNestedDelta(
  artifacts as Record<string, unknown>,
  current.artifacts as unknown as Record<string, unknown>,
) as Partial<AnalysisArtifactRefs>;

const sparseSurfaceEntry = (
  entry: NonNullable<AnalysisContext["surface_state"][AnalysisSurfaceName]>,
  currentEntry: NonNullable<AnalysisContext["surface_state"][AnalysisSurfaceName]>,
) => {
  const entryDelta = sparseNestedDelta(
    entry as Record<string, unknown>,
    currentEntry as Record<string, unknown>,
  );
  if (!entry.filters) return entryDelta;
  const filterDelta = sparseNestedDelta(entry.filters, currentEntry.filters ?? {});
  if (Object.keys(filterDelta).length > 0) entryDelta.filters = filterDelta;
  else delete entryDelta.filters;
  return entryDelta;
};

const sparseSurfaceState = (
  surfaceState: NonNullable<AnalysisContextPatch["surface_state"]>,
  current: AnalysisContext,
): AnalysisContext["surface_state"] => {
  const delta: Record<string, unknown> = {};
  for (const [surface, entry] of Object.entries(surfaceState)) {
    if (!entry) continue;
    const entryDelta = sparseSurfaceEntry(
      entry,
      current.surface_state[surface as AnalysisSurfaceName] ?? {},
    );
    if (Object.keys(entryDelta).length > 0) delta[surface] = entryDelta;
  }
  return delta as AnalysisContext["surface_state"];
};

function sparseContextPatch(changes: AnalysisContextPatch, current: AnalysisContext): AnalysisContextPatch {
  const sparse = { ...changes };
  if (changes.artifacts) sparse.artifacts = sparseArtifacts(changes.artifacts, current);
  if (changes.surface_state) sparse.surface_state = sparseSurfaceState(changes.surface_state, current);
  if (changes.filters) sparse.filters = sparseNestedDelta(changes.filters, current.filters);
  if (changes.selected) sparse.selected = sparseNestedDelta(changes.selected, current.selected);
  return sparse;
}

const pendingContextCreates = new Map<string, Promise<AnalysisContext>>();

function createContextOnce(
  defaults: { name: string; sector_id?: string },
  principalId: string,
  principalGeneration: number,
) {
  const key = `${principalId}@${principalGeneration}|${defaults.name}|${defaults.sector_id ?? ""}`;
  const pending = pendingContextCreates.get(key);
  if (pending) return pending;
  const created = analysisApi.createContext({ name: defaults.name, sector_id: defaults.sector_id })
    .finally(() => pendingContextCreates.delete(key));
  pendingContextCreates.set(key, created);
  return created;
}

// 429 backoff for context create/load. Keyed independent of any one mounted
// component so a shell remount mid-backoff (the observed churn pattern) sees
// the existing cool-down instead of firing a fresh request. Bounded: past
// MAX_THROTTLE_ATTEMPTS this degrades to the normal terminal-error path.
const MAX_THROTTLE_ATTEMPTS = 5;
const THROTTLE_BASE_MS = 1000;
const THROTTLE_MAX_MS = 30000;
const contextLoadThrottle = new Map<string, { attempt: number; retryAt: number }>();

function isRateLimited(reason: unknown): boolean {
  return axios.isAxiosError(reason) && reason.response?.status === 429;
}

// Half-jitter: full backoff window, then a random half on top. Keeps retries
// spread out under sustained throttling without ever exceeding THROTTLE_MAX_MS.
function throttleDelayMs(attempt: number): number {
  const window = Math.min(THROTTLE_BASE_MS * 2 ** (attempt - 1), THROTTLE_MAX_MS);
  return Math.round(window / 2 + Math.random() * (window / 2));
}

function contextLoadThrottleKey(
  contextId: string | null,
  principalId: string,
  principalGeneration: number,
  name: string,
  sectorId: string | undefined,
): string {
  // principalId scopes the "get" key too: named profiles share one edge-proxy
  // session (see AuthProvider), so a second analyst hitting the same
  // ?context= URL right after a re-login must not inherit the first
  // analyst's cool-down.
  return contextId
    ? `get:${principalId}:${contextId}`
    : `create:${principalId}@${principalGeneration}|${name}|${sectorId ?? ""}`;
}

type ContextSetter = Dispatch<SetStateAction<AnalysisContext | null>>;
type MutationState = "idle" | "saving" | "error";

const requestedContextFromLocation = (
  hasExplicitContextId: boolean,
  requestedContextId: string | null | undefined,
): string | null => hasExplicitContextId
  ? requestedContextId ?? null
  : new URL(window.location.href).searchParams.get("context");

const publishLoadedContext = (value: AnalysisContext, contextId: string | null) => {
  window.dispatchEvent(new CustomEvent("caos:analysis-context", { detail: value }));
  if (contextId) return;
  window.history.replaceState(
    window.history.state,
    "",
    mergeContextIntoCurrentUrl(window.location.href, value.id),
  );
  window.dispatchEvent(new PopStateEvent("popstate"));
};

const useContextLoad = (
  defaults: { name: string; sector_id?: string; context_id?: string | null },
  principalId: string,
  principalGeneration: number,
) => {
  const defaultName = defaults.name;
  const defaultSectorId = defaults.sector_id;
  const hasExplicitContextId = Object.prototype.hasOwnProperty.call(defaults, "context_id");
  const requestedContextId = defaults.context_id;
  const [context, setContext] = useState<AnalysisContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [throttled, setThrottled] = useState(false);
  const loadGeneration = useRef(0);
  useEffect(() => {
    const generation = ++loadGeneration.current;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const currentLoad = () => !cancelled && generation === loadGeneration.current;
    const contextId = requestedContextFromLocation(hasExplicitContextId, requestedContextId);
    const throttleKey = contextLoadThrottleKey(contextId, principalId, principalGeneration, defaultName, defaultSectorId);

    const attempt = async () => {
      if (!currentLoad()) return;
      setLoading(true);
      try {
        const value = contextId
          ? await analysisApi.getContext(contextId)
          : await createContextOnce(
            { name: defaultName, sector_id: defaultSectorId },
            principalId,
            principalGeneration,
          );
        if (!currentLoad()) return;
        contextLoadThrottle.delete(throttleKey);
        setThrottled(false);
        setError(null);
        setContext(value);
        setLoading(false);
        publishLoadedContext(value, contextId);
      } catch (reason) {
        if (!currentLoad()) return;
        const priorAttempts = contextLoadThrottle.get(throttleKey)?.attempt ?? 0;
        if (isRateLimited(reason) && priorAttempts < MAX_THROTTLE_ATTEMPTS) {
          const nextAttempt = priorAttempts + 1;
          const retryAt = Date.now() + throttleDelayMs(nextAttempt);
          contextLoadThrottle.set(throttleKey, { attempt: nextAttempt, retryAt });
          setThrottled(true);
          setError(null);
          window.dispatchEvent(new Event("caos:analysis-context-throttled"));
          timer = setTimeout(() => { void attempt(); }, retryAt - Date.now());
          return;
        }
        contextLoadThrottle.delete(throttleKey);
        setThrottled(false);
        setLoading(false);
        setError(toErrorMessage(reason, "Analysis context unavailable."));
        window.dispatchEvent(new Event("caos:analysis-context-error"));
      }
    };

    setContext(null);
    setError(null);
    const cooldown = contextLoadThrottle.get(throttleKey);
    const remaining = cooldown ? cooldown.retryAt - Date.now() : 0;
    if (remaining > 0) {
      // A prior mount is already backing off this same create/load — honor its
      // cool-down instead of firing a fresh request (prevents remount storms).
      setLoading(true);
      setThrottled(true);
      window.dispatchEvent(new Event("caos:analysis-context-throttled"));
      timer = setTimeout(() => { void attempt(); }, remaining);
    } else {
      void attempt();
    }
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [defaultName, defaultSectorId, hasExplicitContextId, principalGeneration, principalId, requestedContextId]);
  return { context, setContext, loading, error, throttled };
};

const patchContextWithConflictRetry = async (
  contextId: string,
  current: AnalysisContext,
  sparseChanges: AnalysisContextPatch,
  scopeIsCurrent: () => boolean,
): Promise<AnalysisContext | null> => {
  try {
    return await analysisApi.patchContext(contextId, {
      ...sparseChanges,
      expected_revision: current.revision,
    });
  } catch (reason) {
    const conflict = axios.isAxiosError(reason) && reason.response?.status === 409;
    if (!conflict) throw reason;
    const refreshed = await analysisApi.getContext(contextId);
    if (!scopeIsCurrent()) return null;
    return analysisApi.patchContext(contextId, {
      ...sparseChanges,
      expected_revision: refreshed.revision,
    });
  }
};

interface ContextMutationRefs {
  context: { current: AnalysisContext | null };
  scopeGeneration: { current: number };
  request: { current: number };
  lastPatch: { current: AnalysisContextPatch | null };
}

const performContextPatch = async (
  contextId: string,
  sparseChanges: AnalysisContextPatch,
  scopeGeneration: number,
  requestId: number,
  refs: ContextMutationRefs,
  setContext: ContextSetter,
  setMutationState: Dispatch<SetStateAction<MutationState>>,
  setMutationError: Dispatch<SetStateAction<string | null>>,
): Promise<AnalysisContext | null> => {
  const current = refs.context.current;
  const scopeIsCurrent = () => scopeGeneration === refs.scopeGeneration.current;
  if (!current || current.id !== contextId || !scopeIsCurrent()) return null;
  try {
    const value = await patchContextWithConflictRetry(contextId, current, sparseChanges, scopeIsCurrent);
    if (!value || !scopeIsCurrent()) return null;
    refs.context.current = value;
    setContext((active) => active?.id === contextId ? value : active);
    if (requestId === refs.request.current) {
      refs.lastPatch.current = null;
      setMutationState("idle");
      setMutationError(null);
    }
    return value;
  } catch (reason) {
    if (scopeIsCurrent() && requestId === refs.request.current) {
      setMutationState("error");
      setMutationError(toErrorMessage(reason, "Analysis context was not saved."));
    }
    throw reason;
  }
};

const useContextMutation = (
  context: AnalysisContext | null,
  setContext: ContextSetter,
  scopeKey: string,
) => {
  const [mutationState, setMutationState] = useState<MutationState>("idle");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const contextRef = useRef<AnalysisContext | null>(null);
  const scopeGeneration = useRef(0);
  const request = useRef(0);
  const lastPatch = useRef<AnalysisContextPatch | null>(null);
  const mutationQueue = useRef<Promise<unknown>>(Promise.resolve());
  contextRef.current = context;
  useEffect(() => {
    scopeGeneration.current += 1;
    request.current += 1;
    lastPatch.current = null;
    mutationQueue.current = Promise.resolve();
    setMutationState("idle");
    setMutationError(null);
  }, [scopeKey]);
  const patch = useCallback(async (changes: AnalysisContextPatch) => {
    const initial = contextRef.current;
    if (!initial) return null;
    const sparseChanges = sparseContextPatch(changes, initial);
    const contextId = initial.id;
    const patchScope = scopeGeneration.current;
    const requestId = ++request.current;
    lastPatch.current = sparseChanges;
    setMutationState("saving");
    setMutationError(null);
    const refs = { context: contextRef, scopeGeneration, request, lastPatch };
    const operation = mutationQueue.current.catch(() => undefined).then(() => performContextPatch(
      contextId,
      sparseChanges,
      patchScope,
      requestId,
      refs,
      setContext,
      setMutationState,
      setMutationError,
    ));
    mutationQueue.current = operation;
    return operation;
  }, [setContext]);
  const retryLastPatch = useCallback(() => {
    const changes = lastPatch.current;
    return changes ? patch(changes) : Promise.resolve(null);
  }, [patch]);
  return { patch, mutationState, mutationError, retryLastPatch };
};

export function useAnalysisContext(defaults: { name: string; sector_id?: string; context_id?: string | null }) {
  const { user, principalGeneration = 0 } = useAuth();
  const principalId = user?.id ?? "unresolved";
  const { context, setContext, loading, error, throttled } = useContextLoad(defaults, principalId, principalGeneration);
  const contextIdMode = Object.prototype.hasOwnProperty.call(defaults, "context_id") ? "explicit" : "implicit";
  const scopeKey = `${principalId}@${principalGeneration}|${defaults.name}|${defaults.sector_id ?? ""}|${contextIdMode}|${defaults.context_id ?? ""}`;
  const { patch, mutationState, mutationError, retryLastPatch } = useContextMutation(context, setContext, scopeKey);

  return useMemo(() => ({
    context,
    setContext,
    patch,
    loading,
    error,
    throttled,
    mutationState,
    mutationError,
    retryLastPatch,
  }), [context, setContext, patch, loading, error, throttled, mutationState, mutationError, retryLastPatch]);
}
