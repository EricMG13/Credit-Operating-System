import axios from "axios";
import { loadMode } from "@/lib/model-mode";
import type { Issuer } from "@/types/issuers";

// Same-origin API: the FastAPI server serves both /api and the static
// frontend in deployment (Databricks Apps). In `next dev`, the rewrite in
// next.config.js proxies /api to the local server on :8000.
export const api = axios.create({
  headers: { "Content-Type": "application/json" },
  // Default timeout so a hung/dead API (or a proxy to a dead :8000) can't strand
  // the UI forever — live-overlay module fetches, the settings probe, run polls.
  // Deep Research is now a durable background job polled by short GETs, so it
  // relies on this default too (no long-held per-request override). P1/P2/L6.
  timeout: 20000,
});

// Per-analyst model mode → X-Model-Mode on every request. The server resolves it
// to a model tier per LLM lane (engine/presets.py); runs persist the mode they
// ran at. SSR has no localStorage, so this only attaches in the browser.
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    try {
      config.headers.set("X-Model-Mode", loadMode());
      const qm = localStorage.getItem("caos_query_model");
      if (qm) config.headers.set("X-Query-Model", qm);
    } catch {
      // private-mode Safari / storage disabled or blocked — degrade to no
      // mode/query-model header rather than breaking every request's interceptor.
    }
  }
  return config;
});

// SEAM4-1: surface a lost/rotated session. Any /api 401 (an expired or revoked
// profile cookie behind SSO, a lost cookie off-proxy) fires an app-level event
// that AuthProvider handles by re-resolving /api/auth/me — so the UI routes to the
// login landing instead of silently 401-ing every call over stale, still-rendered
// data. The /me probe is excluded (AuthProvider owns its own result) to avoid a
// self-trigger. The error is re-thrown untouched so every per-call handler still
// runs exactly as before.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      typeof window !== "undefined" &&
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !error.config?.url?.includes("/api/auth/me")
    ) {
      window.dispatchEvent(new Event("caos:auth-lost"));
    }
    return Promise.reject(error);
  },
);

// ─── Error normalization ──────────────────────────────────────────────────
// FastAPI's `detail` is only sometimes a string: 422 validation errors arrive
// as a LIST of {loc, msg, type} objects, and structured errors (e.g. the
// committee-export 409 in runs.py) as a DICT with .message. Passing either
// into string-typed state and rendering it as a JSX child crashes React
// ("Objects are not valid as a React child") — so every catch that surfaces a
// detail to the user must parse it through here, never `detail || e.message`
// directly. (SEAM3-1 / SEAM3-2)
export function toErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => {
        if (typeof d === "string") return d;
        const { loc, msg } = (d ?? {}) as { loc?: unknown[]; msg?: unknown };
        if (typeof msg !== "string") return "";
        const field = Array.isArray(loc) && loc.length ? String(loc[loc.length - 1]) : "";
        return field ? `${field}: ${msg}` : msg;
      })
      .filter(Boolean);
    if (msgs.length) return msgs.join("; ");
  }
  if (detail && typeof detail === "object") {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  const msg = (err as { message?: unknown })?.message;
  return typeof msg === "string" && msg ? msg : fallback;
}

// ─── Identity ─────────────────────────────────────────────────────────────
// Authentication is platform-managed (Databricks workspace OAuth at the
// edge). /api/auth/me reflects the forwarded identity.
// Bounded: a down/hung API (or proxy to a dead :8000) must not strand the whole
// app on the RequireAuth "Loading…" gate — on timeout the request rejects and
// the error card (with RETRY) shows instead. Long-running calls set their own.
export const getMe = () => api.get("/api/auth/me", { timeout: 8000 }).then((r) => r.data);

// ─── Portfolio board (cross-issuer latest-run posture) ──────────────────────
export interface PortfolioGapDTO {
  sev: string; // high | medium | low
  doc: string; // the missing source, e.g. "No audited financials vaulted."
}

export interface PortfolioRowDTO {
  issuer_id: string;
  name: string;
  ticker: string | null;
  sector: string | null;
  run_id: string;
  qa_status: string;
  committee_status: string;
  as_of: string | null;
  metrics: Record<string, number>; // headline metric_key -> LTM value
  rv_recommendation: string | null;
  rv_percentile: number | null;
  downside_fragility: "HIGH" | "MODERATE" | "LOW" | null;
  gaps: PortfolioGapDTO[]; // CP-0 source-readiness gap log
}
export interface PortfolioDTO {
  rows: PortfolioRowDTO[];
  issuer_count: number;
  covered_count: number;
}
export const getPortfolio = (): Promise<PortfolioDTO> =>
  api.get("/api/portfolio").then((r) => r.data);

// In-app login: the shared access code mints (or re-attaches to) a named analyst
// profile and sets the signed identity cookie. logout clears it.
// fallow-ignore-next-line unused-export
export const createProfile = (code: string, name: string) =>
  api.post("/api/auth/profile", { code, name }, { timeout: 8000 }).then((r) => r.data);
export const logout = () => api.post("/api/auth/logout", {}, { timeout: 8000 });

// Routine background-work events are deliberately separate from Watchtower
// alerts. The signed cursor is opaque to the browser and analyst-bound by the
// server; the notification provider uses its first read only as a high-water
// mark so historical completions never replay as fresh toasts.
export interface NotificationEventDTO {
  id: string;
  kind: "run_complete" | "run_failed" | string;
  subject_kind: string;
  subject_id: string;
  issuer_id: string | null;
  title: string;
  body: string | null;
  href: string | null;
  seen_at: string | null;
  created_at: string;
}

export interface NotificationFeedDTO {
  items: NotificationEventDTO[];
  next_cursor: string | null;
}

export const listNotifications = (cursor?: string | null): Promise<NotificationFeedDTO> =>
  api.get("/api/notifications", {
    params: cursor ? { cursor } : undefined,
    timeout: 8000,
  }).then((r) => r.data);

export const markNotificationSeen = (notificationId: string): Promise<NotificationEventDTO> =>
  api.patch(`/api/notifications/${encodeURIComponent(notificationId)}/seen`, undefined, {
    timeout: 8000,
  }).then((r) => r.data);

// Clear all browser-local workspace state on logout. On a shared workstation the
// next analyst must not inherit the prior one's chat transcripts (caos-chat-*),
// Report Studio committee-deliverable edits (caos-e-*), model inputs (caos-d-*),
// query history, or — critically — their model-mode / query-model tier (sent as
// X-Model-Mode / X-Query-Model on every request, which would silently run the next
// analyst's work at the wrong tier). Every app key is "caos"-prefixed by convention.
export const clearWorkspaceStorage = () => {
  if (typeof window === "undefined") return;
  const clearCaosKeys = (storage: Storage) => {
    const keys = new Set<string>();
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key) keys.add(key);
    }
    for (const key of Object.keys(storage)) keys.add(key);
    for (const key of keys) {
      if (key.startsWith("caos")) storage.removeItem(key);
    }
  };
  try {
    clearCaosKeys(localStorage);
  } catch { /* private mode / quota — nothing to clear */ }
  try {
    clearCaosKeys(sessionStorage);
  } catch { /* private mode / quota — nothing to clear */ }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("context")) {
      url.searchParams.delete("context");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  } catch { /* non-browser test harness */ }
};

export const PRINCIPAL_STORAGE_KEY = "caos.principal.id";

/** Re-key browser caches before a newly resolved principal is rendered. */
export const bindWorkspacePrincipal = (principalId: string) => {
  if (typeof window === "undefined") return;
  let prior: string | null = null;
  try { prior = localStorage.getItem(PRINCIPAL_STORAGE_KEY); } catch {}
  // A missing marker is not proof that the remaining browser state belongs to
  // this analyst (it may pre-date principal binding). Treat it exactly like a
  // principal change and start from a clean workspace.
  if (prior !== principalId) clearWorkspaceStorage();
  try { localStorage.setItem(PRINCIPAL_STORAGE_KEY, principalId); } catch {}
};

// Email + password account lane (alongside edge SSO). register creates the account
// (gated by the shared invite code) and signs in; login authenticates an existing
// one. Both return the same { source: "profile" } identity and set the cookie.
export const register = (data: {
  code: string;
  name: string;
  email: string;
  passcode: string;
  coverage_area: string;
  location: string;
  recovery_words: string[];
  recovery_hints: string[];
}) =>
  api.post("/api/auth/register", data, { timeout: 8000 }).then((r) => r.data);
export const login = (email: string, passcode: string) =>
  api.post("/api/auth/login", { email, passcode }, { timeout: 8000 }).then((r) => r.data);
export const recoverLogin = (email: string, recovery_words: string[]) =>
  api.post("/api/auth/recover", { email, recovery_words }, { timeout: 8000 }).then((r) => r.data);

// ─── Issuers ──────────────────────────────────────────────────────────────
// `q` searches name, ticker, sector/industry, sub-sector, country, and FIGI.
export const getIssuers = (q?: string): Promise<Issuer[]> =>
  api.get("/api/issuers/", { params: q && q.trim() ? { q: q.trim() } : {} }).then((r) => {
    if (Array.isArray(r.data)) return r.data;
    throw new Error("Invalid issuer response");
  });
export const createIssuer = (data: Record<string, unknown>) =>
  api.post("/api/issuers/", data).then((r) => r.data);
// Single issuer by id — used by Deep-Dive to label the chrome for the issuer
// opened from the directory (the live run overlay is keyed off the same id).
export const getIssuer = (id: string) =>
  api.get(`/api/issuers/${id}`).then((r) => r.data);

// Issuer profile — the per-name roll-up (identity + house view + headline
// metrics + run history) that backs the /issuers/profile landing view. A
// read-model; see routes/issuers.py.
export interface ProfileRun {
  id: string;
  status: string;
  qa_status: string;
  committee_status: string;
  as_of_date: string | null;
  analyst_id: string | null;
  model_mode: string | null;
  created_at: string | null;
  completed_at: string | null;
}
export interface ProfileMetric {
  run_id?: string | null;
  metric_key: string;
  period: string;
  value: number;
  unit: string;
  basis: string | null;
  provenance: string;
  headline: boolean;
  qa_status: string;
  source_claim_id: string | null;
  source_evidence_id: string | null;
  document_chunk_id: string | null;
  created_at?: string | null;
  source_run_as_of?: string | null;
}
export interface BusinessFact {
  fact_area: string;
  code: string;
  statement: string;
  chunk_id: string | null;
}
export interface EarningsSummary {
  latest_period: string | null;
  prior_period: string | null;
  revenue_growth_pct: number | null;
  ebitda_growth_pct: number | null;
  margin_change_pp: number | null;
  monitoring_signals: string[];
}
export interface IssuerProfile {
  issuer: Issuer;
  latest_run: ProfileRun | null;
  signal_run_id?: string | null;
  runs: ProfileRun[];
  metrics: ProfileMetric[];
  // Free-form roll-ups (nullable values) — Deep-Dive owns module detail.
  signals: Record<string, number | string | boolean | null>;
  coverage: Record<string, unknown>;
  findings: Record<string, number>;
  business: BusinessFact[];           // CP-1A sourced facts
  sponsor: Record<string, unknown>;   // CP-2D governance review
  strengths: string[];
  weaknesses: string[];
  earnings: EarningsSummary;          // CP-1B latest earnings summary
}
export const getIssuerProfile = (id: string): Promise<IssuerProfile> =>
  api.get(`/api/issuers/${id}/profile`).then((r) => r.data);

// Cross-default domino map — which tranches get pulled in when one facility
// defaults (CP-3B tranche register × CP-4C material-indebtedness threshold).
// Read-model over the latest complete run; degrades to a note, never a guess.
export interface CrossDefaultDomino {
  code: string;
  tranche: string;
  amount_musd: number | null;
  trips_cross_default: boolean | null; // null = unsized tranche or no threshold
  pulls_in: string[];
}
export interface CrossDefaultMap {
  issuer_id: string;
  run_id: string | null;
  threshold_musd: number | null;
  dominoes: CrossDefaultDomino[];
  note: string | null;
}
export const getCrossDefaultMap = (id: string): Promise<CrossDefaultMap> =>
  api.get(`/api/issuers/${encodeURIComponent(id)}/cross-default`).then((r) => r.data);

// Sponsor track record — CP-2D governance scores/flags rolled up across a
// sponsor's covered names (analyst-entered Issuer.sponsor grouping).
export interface SponsorSummary {
  sponsor: string;
  issuer_count: number;
}
export interface SponsorIssuerRow {
  issuer_id: string;
  name: string;
  ticker: string | null;
  run_id: string | null;
  qa_status: string | null;
  governance_risk_score: number | null;
  flags: string[];
  net_leverage: number | null;
}
export interface SponsorTrackRecord {
  sponsor: string;
  issuer_count: number;
  avg_governance_risk_score: number | null;
  flag_counts: Record<string, number>;
  issuers: SponsorIssuerRow[];
}
export const getSponsors = (): Promise<SponsorSummary[]> =>
  api.get("/api/sponsors/").then((r) => r.data);
export const getSponsorTrackRecord = (name: string): Promise<SponsorTrackRecord> =>
  api.get(`/api/sponsors/${encodeURIComponent(name)}`).then((r) => r.data);

// Daily digest — deterministic coverage/ratings/activity roll-up (no LLM):
// staleness watch, equal-weighted WARF over manual ratings, CCC-cliff watch,
// 24h run activity. Backs the Command Center research lens.
export interface DigestWatchRow {
  issuer_id: string;
  name: string;
  detail: string | null;
}
export interface DailyDigest {
  as_of: string;
  coverage: Record<string, number>; // issuers / rated / unrated / with_complete_run
  stale_threshold_days: number;
  stale: DigestWatchRow[];
  warf: number | null;
  warf_band: string | null;
  ccc_watch: DigestWatchRow[];
  qa: Record<string, number>;
  activity_24h: Record<string, number>;
  freshness?: DigestFreshnessSummary;
}
export const getDigest = (): Promise<DailyDigest> =>
  api.get("/api/digest/daily").then((r) => r.data);

export type FreshnessState = "current" | "due" | "stale" | "unknown";
export type FreshnessSourceKind = "reported_financials" | "price" | "rating" | "legal_document" | "run" | "derived_artifact";
export interface FreshnessEvaluation {
  state: FreshnessState;
  source_kind: FreshnessSourceKind;
  observed_at: string | null;
  effective_period_end: string | null;
  expected_next_at: string | null;
  due_at: string | null;
  age_days: number | null;
  reason: string;
  policy_version: string;
}
export interface DigestFreshnessSummary {
  policy_version: string;
  source_kind: "run";
  counts: Record<FreshnessState, number>;
  rows: Array<{ issuer_id: string; name: string; run_id: string | null; evaluation: FreshnessEvaluation }>;
}
export interface IssuerFreshnessResponse {
  issuer_id: string;
  evaluated_at: string;
  evaluations: FreshnessEvaluation[];
}
export interface RunFreshnessResponse {
  run_id: string;
  evaluated_at: string;
  evaluation: FreshnessEvaluation;
}
export interface ContextFreshnessResponse {
  context_id: string;
  evaluated_at: string;
  artifacts: Array<{
    artifact: { kind: string; id: string; version: string | null };
    evaluation: FreshnessEvaluation;
  }>;
}
export const getIssuerFreshness = (id: string, signal?: AbortSignal): Promise<IssuerFreshnessResponse> =>
  api.get(`/api/issuers/${encodeURIComponent(id)}/freshness`, { signal }).then((r) => r.data);
export const getRunFreshness = (id: string, signal?: AbortSignal): Promise<RunFreshnessResponse> =>
  api.get(`/api/runs/${encodeURIComponent(id)}/freshness`, { signal }).then((r) => r.data);
export const getContextFreshness = (id: string, signal?: AbortSignal): Promise<ContextFreshnessResponse> =>
  api.get(`/api/analysis/contexts/${encodeURIComponent(id)}/freshness`, { signal }).then((r) => r.data);

export interface IngestionGapRow {
  document_id: string;
  issuer_id: string;
  issuer_name: string;
  file_name: string;
  doc_type: string;
  uploaded_at: string;
  detail: string;
}
export interface CoverageOriginRow {
  issuer_id: string;
  issuer_name: string;
  analyst_owner: string | null;
  origins: Array<"NATIVE" | "OCR" | "NO_TEXT">;
  document_count: number;
}
export interface IngestionGapsResponse {
  as_of: string;
  truncated: boolean;
  zero_chunk: IngestionGapRow[];
  ocr_lane: IngestionGapRow[];
  coverage: CoverageOriginRow[];
}
export const getIngestionGaps = (): Promise<IngestionGapsResponse> =>
  api.get("/api/digest/ingestion-gaps").then((r) => r.data);

// ─── Issuer Q&A chat ──────────────────────────────────────────────────────
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
export const askIssuer = (messages: ChatMessage[]): Promise<string> =>
  api.post("/api/chat/issuer", { messages }).then((r) => r.data.reply);

// ─── Sector Review ────────────────────────────────────────────────────────
export interface SectorFeed {
  sector: string;
  enabled: boolean;
  notify_pref: string;
  provenance: string;
}
export interface SectorSource {
  source_type: string;
  ref: string;
  title: string;
  url?: string | null;
  tier: string;
  provenance: string;
}
export interface SectorIssuer {
  issuer_id?: string | null;
  name: string;
  ticker?: string | null;
  exposure: string;
}
export interface SectorSignal {
  id: string;
  sector: string;
  signal_date: string;
  category: string;
  severity: string;
  headline: string;
  summary: string;
  materiality_score: number;
  issuers: SectorIssuer[];
  sources: SectorSource[];
  provenance: string;
  staleness_flag: string;
  confidence: string;
}
export interface SectorReviewSection {
  id: string;
  title: string;
  posture: string;
  summary: string;
  signal_ids: string[];
}
export interface SectorReview {
  sector: string;
  timeframe: string;
  as_of: string;
  posture: string;
  confidence: string;
  staleness_flag: string;
  provenance: string;
  module_status: string;
  refresh_trigger: string;
  sections: SectorReviewSection[];
  signals: SectorSignal[];
}
export interface SectorAskResponse {
  signal_id: string;
  answer: string;
  financial_impact_summary: string;
  affected_issuers: SectorIssuer[];
  recommended_actions: string[];
  sources: SectorSource[];
  provenance: string;
  retrieval_scope: string;
}
export const getSectorFeeds = (): Promise<SectorFeed[]> =>
  api.get("/api/sector/feeds").then((r) => r.data);
export const updateSectorFeeds = (feeds: SectorFeed[]): Promise<SectorFeed[]> =>
  api.put("/api/sector/feeds", { feeds }).then((r) => r.data);
export const getSectorSignals = (params: {
  sector?: string;
  from?: string;
  to?: string;
  q?: string;
  category?: string;
  severity?: string;
  limit?: number;
}): Promise<SectorSignal[]> =>
  api.get("/api/sector/signals", { params }).then((r) => r.data);
export const getSectorReview = (params: {
  sector: string;
  timeframe?: string;
  as_of?: string;
}): Promise<SectorReview> =>
  api.get("/api/sector/review", { params }).then((r) => r.data);
export const refreshSectorReview = (data: {
  sector: string;
  timeframe?: string;
  as_of?: string;
}): Promise<SectorReview> =>
  api.post("/api/sector/review/refresh", data).then((r) => r.data);
export const askSectorTopic = (signal_id: string, question: string): Promise<SectorAskResponse> =>
  api.post("/api/sector/ask", { signal_id, question }).then((r) => r.data);

// ─── Ingestion ────────────────────────────────────────────────────────────
// The server parses, virus-scans, and chunks the file inside the request, so a
// real filing can run well past the 20s default. Give ingestion a generous
// 5-min ceiling (still bounded, so a truly hung API can't strand the wizard).
export interface IngestionResult {
  document_id: string;
  issuer_id: string;
  minio_key: string;
  run_mode: string;
  chunks_created: number;
  message: string;
  warning?: string | null;
  ratings_updated?: number | null;
  source_manifest_id: string;
}

export const uploadDocument = (formData: FormData): Promise<IngestionResult> =>
  api.post("/api/ingestion/upload/document", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 300_000,
  }).then((r) => r.data);

export const uploadPricingSheet = (formData: FormData): Promise<IngestionResult> =>
  api.post("/api/ingestion/upload/pricing-sheet", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 300_000,
  }).then((r) => r.data);

export const appendIngestionContext = (formData: FormData, contextId?: string): FormData => {
  if (contextId) formData.append("context_id", contextId);
  return formData;
};

export interface VaultMemoResult {
  note: string;
  path: string;
  memo_type: string;
  issuer_links: string[];
  message: string;
}

// Analyst commentary → the Obsidian vault's Analyst-Memos/ (auto-wikilinked).
export const uploadVaultMemo = (formData: FormData): Promise<VaultMemoResult> =>
  api.post("/api/ingestion/upload/memo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    // Same synchronous ingest pipeline (AV scan + parse) as the sibling uploads —
    // don't leave this one on the 20s instance default.
    timeout: 60_000,
  }).then((r) => r.data);

// ─── Portfolios (managed CLO books; exposure + compliance computed server-side) ─
export interface PortfolioSummary {
  id: string;
  name: string;
  kind: string;
  as_of_date?: string | null;
  n_positions: number;
  total_nav: number | null;
  total_par: number | null;
  breaches: number;
  watches: number;
  created_at?: string | null;
}

export interface PortfolioDetail {
  id: string;
  name: string;
  kind: string;
  as_of_date?: string | null;
  // Free-form (like a module runtime_output) — typed loosely on purpose.
  mandate: Record<string, unknown>;
  exposure: Record<string, unknown>;
  compliance: Array<Record<string, unknown>>;
}

export const getPortfolios = (): Promise<PortfolioSummary[]> =>
  api.get("/api/portfolios/").then((r) => r.data);

export const getPortfolioDetail = (id: string): Promise<PortfolioDetail> =>
  api.get(`/api/portfolios/${id}`).then((r) => r.data);

// Create a portfolio from a holdings xlsx (+ optional constraints / mandate CSV).
export const createPortfolio = (formData: FormData): Promise<PortfolioSummary> =>
  api.post("/api/portfolios/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 300_000,
  }).then((r) => r.data);

// Drag-drop a new holdings file → replace a portfolio's positions.
export const uploadPortfolioHoldings = (id: string, formData: FormData): Promise<PortfolioSummary> =>
  api.post(`/api/portfolios/${id}/holdings`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 300_000,
  }).then((r) => r.data);

// ─── Analytical engine (runs) ───────────────────────────────────────────────
import type {
  ModuleDetailDTO,
  QAReportDTO,
  RunListItemDTO,
  RunSummaryDTO,
} from "@/lib/engine/types";

// API-client surface for POST /api/runs, used by UploadWizard. portfolioId is
// optional: omit to let the server auto-bind the book that holds the issuer
// (CP-3C concentration); pass one to evaluate against a specific book.
// idempotencyKey is optional too: the server persists the
// Idempotency-Key header to dedupe a dropped-response retry against a run it
// already created, rather than creating a duplicate across app replicas.
export const createRun = (
  issuerId: string, asOfDate?: string, portfolioId?: string, idempotencyKey?: string,
  contextId?: string,
): Promise<RunSummaryDTO> =>
  api.post(
    "/api/runs",
    buildRunCreatePayload(issuerId, asOfDate, portfolioId, contextId),
    idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined,
  ).then((r) => r.data);

export const buildRunCreatePayload = (
  issuerId: string, asOfDate?: string, portfolioId?: string, contextId?: string,
) => ({
  issuer_id: issuerId,
  as_of_date: asOfDate,
  portfolio_id: portfolioId,
  context_id: contextId,
});

export const listRuns = (issuerId?: string): Promise<RunListItemDTO[]> =>
  api.get("/api/runs", { params: issuerId ? { issuer_id: issuerId } : {} }).then((r) => r.data);

export const getRun = (runId: string): Promise<RunSummaryDTO> =>
  api.get(`/api/runs/${runId}`).then((r) => r.data);

export const getModule = (runId: string, moduleId: string): Promise<ModuleDetailDTO> =>
  api.get(`/api/runs/${runId}/modules/${moduleId}`).then((r) => r.data);

// Bulk read: every produced module (with claims + evidence) in one request —
// the Deep-Dive open used to fan out one getModule per eligible module id.
export const getModules = (runId: string): Promise<ModuleDetailDTO[]> =>
  api.get(`/api/runs/${runId}/modules`).then((r) => r.data);

export const getQA = (runId: string): Promise<QAReportDTO> =>
  api.get(`/api/runs/${runId}/qa`).then((r) => r.data);

// ─── Analyst QA flags (Deep-Dive register "FLAG TO QA · CP-5") ───────────────
// Audit-trail escalations, recorded server-side; deliberately separate from
// engine qa_findings so a flag can never gate a run.
export interface QaFlagDTO {
  id: string;
  issuer_id: string | null;
  run_id: string | null;
  module_id: string;
  step_ref: string | null;
  note: string | null;
  analyst_id: string | null;
  created_at: string | null;
}

export const createQaFlag = (data: {
  module_id: string;
  step_ref?: string;
  note?: string;
  issuer_id?: string;
  run_id?: string;
}): Promise<QaFlagDTO> => api.post("/api/qa/flags", data).then((r) => r.data);

export const listQaFlags = (params: {
  module_id?: string;
  step_ref?: string;
  issuer_id?: string;
  run_id?: string;
}): Promise<QaFlagDTO[]> => api.get("/api/qa/flags", { params }).then((r) => r.data);

// Committee export — rejects (409) unless the run is Committee Ready.
// Surface ahead of its UI consumer (Report Studio).
// fallow-ignore-next-line unused-export
export const exportReport = (runId: string): Promise<unknown> =>
  api.post(`/api/runs/${runId}/report`).then((r) => r.data);

// One-way Markdown export of a run into the Obsidian vault (hub + spoke notes).
// 503s when VAULT_EXPORT_DIR is unset. Not gated on Committee Ready — status is
// stamped into the note frontmatter instead.
export const exportToVault = (runId: string): Promise<{ written: string[]; vault_dir: string }> =>
  api.post(`/api/runs/${runId}/vault`).then((r) => r.data);

// ─── Cross-issuer natural-language query ─────────────────────────────────────
import type { ChunkDTO, MetricDef, NlQueryResult } from "@/lib/query/types";

export const nlQuery = (question: string, signal?: AbortSignal): Promise<NlQueryResult> =>
  api.post("/api/query/nl", { question }, { signal }).then((r) => r.data);

// Catalog for the NL-query lane — surface ahead of its UI consumer.
// fallow-ignore-next-line unused-export
export const getMetricCatalog = (): Promise<MetricDef[]> =>
  api.get("/api/query/catalog").then((r) => r.data.metrics);

// Click-to-source: fetch one ingested chunk behind a citation chip.
export const getChunk = (chunkId: string): Promise<ChunkDTO> =>
  api.get(`/api/query/chunk/${chunkId}`).then((r) => r.data);

// ─── Query concept (graph traversals over the run-derived store) ─────────────
import type { CapabilitiesResult, GraphResult } from "@/lib/query/graph";

// The capability rail: which graph edges are runnable now (+ grey reasons).
export const queryCapabilities = (): Promise<CapabilitiesResult> =>
  api.get("/api/query/capabilities").then((r) => r.data);

// Run one capability → a positioned node-link graph. `theme` is a free-text risk
// theme for the shared-theme walk (BM25 corpus overlay); `issuerIdB` is the
// second issuer for the head-to-head walk. Both are ignored by every other
// capability, so callers may pass them unconditionally.
export const queryGraph = (
  capabilityId: string, issuerId?: string, theme?: string, issuerIdB?: string,
): Promise<GraphResult> =>
  api.post("/api/query/graph", {
    capability_id: capabilityId, issuer_id: issuerId, theme, issuer_id_b: issuerIdB,
  }).then((r) => r.data);

// The analyst's coverage watchlist — the issuers their Desk Brief is scoped to.
// Non-empty → a per-analyst brief (cache row keyed by analyst_id); empty → the
// shared book-level brief. PUT replaces the full set idempotently.
export const getWatchlist = (): Promise<{ issuer_ids: string[] }> =>
  api.get("/api/query/watchlist").then((r) => r.data);
export const saveWatchlist = (issuer_ids: string[]): Promise<{ issuer_ids: string[] }> =>
  api.put("/api/query/watchlist", { issuer_ids }).then((r) => r.data);

// ─── Scenario builder (NL → driver deltas) ───────────────────────────────────
// Deltas are in the Drivers' own units (fractions): 0.03 = +3pp, rate 0.02 = +200bps.
export interface ScenarioSpec {
  rev_growth_delta: number;
  margin_delta: number;
  capex_delta: number;
  rate_delta: number;
  label: string;
  rationale: string;
}

export const scenarioFromNL = (text: string): Promise<ScenarioSpec> =>
  api.post("/api/scenario/nl", { text }).then((r) => r.data);

export type ScenarioNodeStatus = "computed" | "degraded" | "no-data";
export interface ScenarioPropagationNode {
  node: "stress" | "liquidity" | "covenant" | "recovery" | "rv" | "portfolio" | "recommendation" | "report";
  status: ScenarioNodeStatus;
  value: number | null;
  label: string;
  basis: string;
}
export interface ScenarioPropagationResult {
  shock: { issuer_id: string; run_id: string; ebitda_pct: number; rate_bps: number };
  nodes: ScenarioPropagationNode[];
  source: {
    run_status: string;
    qa_status: string;
    committee_status: string;
    included_modules: string[];
    excluded_modules: string[];
  } | null;
}
export const propagateScenario = (body: {
  issuer_id: string;
  run_id: string;
  ebitda_pct: number;
  rate_bps: number;
}): Promise<ScenarioPropagationResult> =>
  api.post("/api/scenario/propagate", body).then((r) => r.data);

export interface DecisionVote {
  id: string; member: string; vote: "approve" | "dissent" | "abstain";
  dissent_note: string | null; created_at: string;
}
export interface IcDecision {
  id: string; issuer_id: string; run_id: string; report_id: string | null;
  action: "approve" | "decline" | "revisit"; status: "active" | "reopened";
  conditions: string[]; expiry: string | null; snapshot: Record<string, unknown>;
  snapshot_sha256: string; created_by: string | null; reopened_at: string | null;
  reopen_alert_key: string | null; created_at: string; votes: DecisionVote[];
}
export const getDecisions = (issuerId: string): Promise<IcDecision[]> =>
  api.get("/api/decisions", { params: { issuer_id: issuerId } }).then((r) => r.data);
export const createDecision = (body: {
  issuer_id: string; run_id: string; report_id?: string | null;
  action: "approve" | "decline" | "revisit"; conditions?: string[];
  expiry?: string | null; snapshot?: Record<string, unknown>;
}): Promise<IcDecision> => api.post("/api/decisions", body).then((r) => r.data);
export const voteDecision = (id: string, vote: "approve" | "dissent" | "abstain", dissentNote?: string): Promise<IcDecision> =>
  api.post(`/api/decisions/${id}/votes`, { vote, dissent_note: dissentNote }).then((r) => r.data);
export const reopenDecision = (id: string, triggerAlertKey: string): Promise<IcDecision> =>
  api.post(`/api/decisions/${id}/reopen`, { trigger_alert_key: triggerAlertKey }).then((r) => r.data);

export interface ThesisPrediction {
  id: string; metric: string; horizon: string; predicted: number; realized: number | null;
}
export interface ThesisVersion {
  id: string; issuer_id: string; version: number; thesis_md: string;
  trigger: "manual" | "decision" | "alert" | "model_override";
  linked_decision_id: string | null; linked_alert_key: string | null;
  created_by: string | null; created_at: string; predictions: ThesisPrediction[];
}
export const getThesisVersions = (issuerId: string): Promise<ThesisVersion[]> =>
  api.get("/api/thesis", { params: { issuer_id: issuerId } }).then((r) => r.data);
export const createThesisVersion = (body: {
  issuer_id: string; thesis_md: string; trigger?: ThesisVersion["trigger"];
  predictions?: Array<{ metric: string; horizon: string; predicted: number }>;
}): Promise<ThesisVersion> => api.post("/api/thesis", body).then((r) => r.data);
export const realizeThesisPrediction = (id: string, realized: number): Promise<ThesisPrediction> =>
  api.patch(`/api/thesis/predictions/${id}`, { realized }).then((r) => r.data);

// ─── SEC EDGAR retrieval lane (free, no key; gated on EDGAR_USER_AGENT) ───────
// Endpoints 503 until EDGAR_USER_AGENT is configured server-side.
export interface EdgarVaultResult {
  document_id: string;
  storage_key: string;
  doc_type: string;
  run_mode: string;
  chunks_created: number;
  provenance: string;
  message: string;
}

export const edgarVaultUrl = (
  issuerId: string,
  exhibitUrl: string,
  runMode = "legal",
): Promise<EdgarVaultResult> =>
  api
    .post("/api/edgar/vault-url", { issuer_id: issuerId, exhibit_url: exhibitUrl, run_mode: runMode })
    .then((r) => r.data);
export interface EdgarVaultBatchResult {
  ok: EdgarVaultResult[];
  // M-12: which URLs failed and why — previously dropped silently whenever at
  // least one URL succeeded, so a partial batch looked identical to a full one.
  failed: { url: string; reason: string }[];
}
export const edgarVaultUrls = async (issuerId: string, urls: string, runMode = "legal"): Promise<EdgarVaultBatchResult> => {
  const list = urls.split(",").map((u) => u.trim()).filter(Boolean);
  if (!list.length) return { ok: [], failed: [] };
  const settled = await Promise.allSettled(list.map((u) => edgarVaultUrl(issuerId, u, runMode)));
  const ok = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  // Throw only when every URL failed, so an all-fail 503 (not-configured) still
  // reaches the caller's catch instead of one bad URL sinking the whole batch.
  if (!ok.length) {
    const firstErr = settled.find((s) => s.status === "rejected") as PromiseRejectedResult | undefined;
    throw firstErr ? firstErr.reason : new Error("EDGAR URL vaulting failed.");
  }
  const failed = settled.flatMap((s, i) =>
    s.status === "rejected" ? [{ url: list[i], reason: toErrorMessage(s.reason, "vaulting failed") }] : [],
  );
  return { ok, failed };
};

// ─── Deep Research (autonomous web research, credit lens) ─────────────────────
export interface ResearchBrief {
  subject: string;
  mode: "sector" | "issuer";
  ai_mode?: "max" | "standard" | "lite";
  persona?: string;
  audience?: string;
  decision?: string;
  timeframe?: string;
  focus?: string;
  exclusions?: string;
  criteria?: string[];
  source_directives?: string;
}
export interface ResearchSource {
  title: string;
  url: string;
}
export interface ResearchResult {
  report: string;
  sources: ResearchSource[];
  demo: boolean;
  truncated?: boolean;
}
// Live running counts the server rewrites per continuation turn — real work, not
// a fabricated ticker. Absent until the first turn reports.
export interface ResearchProgress {
  sources: number;
  searches: number;
}
interface ResearchJob extends ResearchResult {
  id: string;
  status: "running" | "complete" | "failed";
  progress?: ResearchProgress | null;
  error?: string | null;
}

// Durable Deep Research (M-3): POST persists a job and returns its id immediately,
// then we poll until terminal. Execution lives server-side and is independent of
// this loop, so a transient poll failure (a proxy 502/504, a slow GET, a network
// blip) must NOT abort the run — we tolerate consecutive transport errors and keep
// polling; only a server-reported `failed` ends it. A wall-clock cap stops the UI
// from spinning forever if a job ever wedges. Resolves with the report (or throws
// an axios-shaped error) to keep the caller's contract unchanged.
const _RESEARCH_POLL_MS = 2000;
const _RESEARCH_DEADLINE_MS = 15 * 60 * 1000; // generous backstop; deep research runs minutes
const _RESEARCH_MAX_POLL_ERRORS = 10; // ~20s of consecutive transport failures → give up
const _detail = (detail: string) => ({ response: { data: { detail } } });

// Sentinel thrown when a poll loop is aborted (unmount / analyst detach). The
// durable server-side job is untouched — the caller just stops watching it — so
// the page must NOT surface this as a run failure.
export const RESEARCH_ABORTED = Symbol("research-aborted");
const _aborted = () => ({ [RESEARCH_ABORTED]: true });
export const isResearchAborted = (e: unknown): boolean =>
  typeof e === "object" && e !== null && (e as Record<symbol, unknown>)[RESEARCH_ABORTED] === true;

// Thrown when the polled job is gone (404 — server restart lost the in-memory
// job, or a foreign id under a shared machine). Distinct from a transient blip:
// retrying a 404 is pointless, so resume drops the stale id quietly rather than
// spinning ~20s into a "Lost contact" error.
export const RESEARCH_GONE = Symbol("research-gone");
const _gone = () => ({ [RESEARCH_GONE]: true });
export const isResearchGone = (e: unknown): boolean =>
  typeof e === "object" && e !== null && (e as Record<symbol, unknown>)[RESEARCH_GONE] === true;

// Poll an already-created durable job to terminal. Shared by a fresh run and by
// resume-on-reload, so both paths tolerate transport blips identically. Honors an
// AbortSignal so an unmount / detach stops the loop without touching the job.
const _pollResearch = async (
  id: string,
  onProgress?: (p: ResearchProgress | null) => void,
  signal?: AbortSignal,
): Promise<ResearchResult> => {
  const deadline = Date.now() + _RESEARCH_DEADLINE_MS;
  let pollErrors = 0;
  let first = true;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw _aborted();
    if (!first) await new Promise((r) => setTimeout(r, _RESEARCH_POLL_MS));
    first = false; // poll immediately first so a fast/demo completion isn't delayed
    if (signal?.aborted) throw _aborted();
    let job: ResearchJob;
    try {
      job = (await api.get(`/api/research/${id}`)).data as ResearchJob;
      pollErrors = 0;
    } catch (e) {
      // 404 = the job genuinely doesn't exist (or isn't ours) — retrying can't
      // recover it, so signal "gone" immediately instead of burning the retry
      // budget. The reattach path treats this as a quiet reset.
      if (axios.isAxiosError(e) && e.response?.status === 404) throw _gone();
      // Any other transport error — the durable job is unaffected; keep polling.
      // Bail only after many consecutive failures (the backend is likely down).
      if (++pollErrors >= _RESEARCH_MAX_POLL_ERRORS)
        throw _detail("Lost contact with the research backend — the run may still be completing; retry shortly.");
      continue;
    }
    if (job.status === "complete")
      return { report: job.report, sources: job.sources, demo: job.demo, truncated: job.truncated };
    if (job.status === "failed") throw _detail(job.error || "Research failed — try again.");
    onProgress?.(job.progress ?? null); // still running — surface live counts
  }
  throw _detail("Research timed out on the client — it may still be completing; retry shortly.");
};

export const deepResearch = async (
  brief: ResearchBrief,
  onProgress?: (p: ResearchProgress | null) => void,
  onJobId?: (id: string) => void, // fires the durable id so the page can persist it for reattach
  signal?: AbortSignal,
  contextId?: string,
): Promise<ResearchResult> => {
  const { id } = (await api.post("/api/research", brief, {
    params: contextId ? { context_id: contextId } : undefined,
  })).data as { id: string };
  onJobId?.(id); // persist before the (multi-minute) poll, so a reload can reattach
  return _pollResearch(id, onProgress, signal);
};

// Reattach to a job created in a prior page life (durable id restored from
// sessionStorage). A 404 means the job is gone/foreign — surfaced as a thrown
// axios-shaped error so the page can quietly drop the stale id.
export const resumeResearch = (
  id: string,
  onProgress?: (p: ResearchProgress | null) => void,
  signal?: AbortSignal,
): Promise<ResearchResult> => _pollResearch(id, onProgress, signal);

// The terminal state of a durable job resolved by a durable id: whether it is
// still running (reattach and keep watching), already complete (hydrate the
// finished report straight into the result view — a report survives a reload /
// cross-check trip in Deep-Dive instead of being forfeited, H3), or gone/failed
// (drop the stale pointer). A single GET, no polling — the mount decides how to
// route from there.
export type ResearchStatus =
  | { state: "running" }
  | { state: "complete"; result: ResearchResult }
  | { state: "gone" }
  | { state: "failed"; error: string };

export const getResearchStatus = async (id: string): Promise<ResearchStatus> => {
  let job: ResearchJob;
  try {
    job = (await api.get(`/api/research/${id}`)).data as ResearchJob;
  } catch (e) {
    // Mirror _pollResearch: only an actual 404 means the job is genuinely gone
    // (server restart lost it, or a foreign id). Any other failure (network
    // blip, 5xx, timeout) is NOT the same as "gone" — misreporting a transient
    // failure as permanently deleted would be a real correctness bug, so
    // rethrow and let the caller treat it as an unknown/transient error.
    if (axios.isAxiosError(e) && e.response?.status === 404) return { state: "gone" };
    throw e;
  }
  if (job.status === "complete")
    return {
      state: "complete",
      result: { report: job.report, sources: job.sources, demo: job.demo, truncated: job.truncated },
    };
  if (job.status === "failed") return { state: "failed", error: job.error || "Research failed — try again." };
  return { state: "running" };
};

// ─── Workspace settings (read-only snapshot of server config) ─────────────────
export interface WorkspaceSettings {
  model: string;
  llm_configured: boolean;
  gemini_configured: boolean;
  openrouter_configured: boolean;
  governance: { council_enabled: boolean; council_seats: number; council_peer_round: boolean; council_cross_model: boolean; debate_enabled: boolean };
  model_tiers: { cheap: string; fast: string; strong: string; top: string };
  engine_cost: { run_token_budget: number; advisor_enabled: boolean; synth_executor_model: string; advisor_model: string };
  deep_research: { effort: string; max_searches: number; max_tokens: number };
  retrieval: { edgar_enabled: boolean; markitdown_enabled: boolean };
  workspace: { environment: string; demo_seed: boolean; max_upload_mb: number; run_concurrency: number };
  features: {
    lineage_v2_enabled: boolean;
    market_xlsx_v2_enabled: boolean;
    /** Compatibility alias used by staged workspace-settings deployments. */
    model_engine_v2?: boolean;
    model_engine_v2_enabled: boolean;
    cp_4d_enabled?: boolean;
    cp_2g_enabled?: boolean;
  };
}
export const getSettings = (): Promise<WorkspaceSettings> =>
  api.get("/api/settings").then((r) => r.data);

export type RoleView = "analyst" | "pm" | "qa";

export interface AnalystSettings {
  model_lanes: Record<string, string>;
  email_intelligence: { outlook_connected?: boolean; approved_senders?: string[] };
  /** Presentation preference only — never authorization (server coerces unknown values to "analyst"). */
  role_view?: RoleView;
  /** Deep-Dive pins/recents, standing-view affirmations — see updateAnalystWorkspace. */
  workspace?: Record<string, unknown>;
  revision?: number;
}
export const getAnalystSettings = (): Promise<AnalystSettings> =>
  api.get("/api/settings/analyst").then((r) => r.data);
export const saveAnalystSettings = (data: AnalystSettings): Promise<AnalystSettings> =>
  api.put("/api/settings/analyst", data).then((r) => r.data);
export const patchAnalystSettings = (
  expectedRevision: number,
  patch: Partial<Omit<AnalystSettings, "revision">>,
): Promise<AnalystSettings> =>
  api.patch("/api/settings/analyst", { expected_revision: expectedRevision, ...patch }).then((r) => r.data);

// ─── Analyst workspace (Deep-Dive pins/recents/affirmations) ──────────────
// PUT /api/settings/analyst REPLACES the whole blob — every write here reads
// the current settings first so sibling fields (role_view, model_lanes,
// email_intelligence) are never clobbered by a workspace-only update.
export const updateAnalystWorkspace = async (
  patch: (workspace: Record<string, unknown>) => Record<string, unknown>,
): Promise<AnalystSettings> => {
  const current = await getAnalystSettings();
  return patchAnalystSettings(current.revision ?? 0, { workspace: patch(current.workspace || {}) });
};

export interface SavedModelDTO {
  issuer_id: string;
  analyst_id: string;
  payload: Record<string, unknown>;
  updated_at: string;
}
export const getSavedModel = (issuerId: string): Promise<SavedModelDTO | null> =>
  api.get(`/api/models/${issuerId}`).then((r) => r.data);
// expectedUpdatedAt: the updated_at this client last saw. Pass it so a save
// made stale by another tab (same analyst) rejects with 409 instead of
// silently overwriting — see routes/models.py save_model's optimistic-
// concurrency guard. Omit (undefined) to skip the check.
export const saveModel = (
  issuerId: string,
  payload: Record<string, unknown>,
  expectedUpdatedAt?: string | null,
): Promise<SavedModelDTO> =>
  api
    .put(`/api/models/${issuerId}`, { payload, expected_updated_at: expectedUpdatedAt ?? undefined })
    .then((r) => r.data);

export interface ModelCheckpointDTO {
  id: string;
  issuer_id: string;
  context_id: string;
  issuer_run_id: string | null;
  parent_checkpoint_id: string | null;
  label: string;
  payload_hash: string;
  payload: Record<string, unknown>;
  authority: Record<string, unknown>;
  created_at: string;
}
export const getModelCheckpoints = (issuerId: string): Promise<ModelCheckpointDTO[]> =>
  api.get(`/api/models/${issuerId}/checkpoints`).then((r) => r.data);
export const createModelCheckpoint = (issuerId: string, body: {
  context_id: string;
  label?: string;
  issuer_run_id?: string;
  parent_checkpoint_id?: string;
  expected_updated_at?: string | null;
}): Promise<ModelCheckpointDTO> =>
  api.post(`/api/models/${issuerId}/checkpoints`, body).then((r) => r.data);
export const restoreModelCheckpoint = (
  checkpointId: string,
  expectedUpdatedAt?: string | null,
): Promise<SavedModelDTO> =>
  api.post(`/api/models/checkpoints/${checkpointId}/restore`, {
    expected_updated_at: expectedUpdatedAt ?? undefined,
  }).then((r) => r.data);

// ─── Canonical Model Engine v2 ───────────────────────────────────────────
import type {
  ModelV2CalculateRequest,
  ModelV2Calculation,
  ModelV2Checkpoint,
  ModelV2CheckpointCreateRequest,
  ModelV2CheckpointRestoreRequest,
  ModelV2DraftRecord,
  ModelV2OverrideEvent,
  ModelV2OverrideBatchRequest,
  ModelV2OverrideMutationRequest,
  ModelV2OverrideReplayRequest,
  ModelV2ReadResponse,
  ModelV2SaveRequest,
  ModelV2LegacyWorkbookMapping,
  ModelV2WorkbookCommit,
  ModelV2WorkbookExport,
  ModelV2WorkbookPreview,
} from "@/lib/engine/modelV2";

const modelV2Path = (issuerId: string): string =>
  `/api/models/v2/${encodeURIComponent(issuerId)}`;

export const getModelV2 = (
  issuerId: string,
  exactRunId?: string,
  signal?: AbortSignal,
): Promise<ModelV2ReadResponse> =>
  api.get<ModelV2ReadResponse>(modelV2Path(issuerId), {
    params: exactRunId ? { run_id: exactRunId } : undefined,
    signal,
  }).then((r) => r.data);

export const calculateModelV2 = (
  issuerId: string,
  body: ModelV2CalculateRequest,
  signal?: AbortSignal,
): Promise<ModelV2Calculation> =>
  api.post<ModelV2Calculation>(`${modelV2Path(issuerId)}/calculate`, body, { signal }).then((r) => r.data);

export const saveModelV2 = (
  issuerId: string,
  body: ModelV2SaveRequest,
): Promise<ModelV2DraftRecord> =>
  api.put<ModelV2DraftRecord>(modelV2Path(issuerId), body).then((r) => r.data);

export const getModelV2History = (
  issuerId: string,
  signal?: AbortSignal,
): Promise<ModelV2OverrideEvent[]> =>
  api.get<ModelV2OverrideEvent[]>(`${modelV2Path(issuerId)}/history`, { signal }).then((r) => r.data);

export const mutateModelV2Override = (
  issuerId: string,
  body: ModelV2OverrideMutationRequest,
): Promise<ModelV2DraftRecord> =>
  api.post<ModelV2DraftRecord>(`${modelV2Path(issuerId)}/overrides`, body).then((r) => r.data);

export const mutateModelV2OverridesBatch = (
  issuerId: string,
  body: ModelV2OverrideBatchRequest,
): Promise<ModelV2DraftRecord> =>
  api.post<ModelV2DraftRecord>(`${modelV2Path(issuerId)}/overrides/batch`, body).then((r) => r.data);

export const replayModelV2Override = (
  issuerId: string,
  eventId: string,
  body: ModelV2OverrideReplayRequest,
): Promise<ModelV2DraftRecord> =>
  api.post<ModelV2DraftRecord>(
    `${modelV2Path(issuerId)}/history/${encodeURIComponent(eventId)}/replay`,
    body,
  ).then((r) => r.data);

export const getModelV2Checkpoints = (
  issuerId: string,
  signal?: AbortSignal,
): Promise<ModelV2Checkpoint[]> =>
  api.get<ModelV2Checkpoint[]>(`${modelV2Path(issuerId)}/checkpoints`, { signal }).then((r) => r.data);

export const createModelV2Checkpoint = (
  issuerId: string,
  body: ModelV2CheckpointCreateRequest,
): Promise<ModelV2Checkpoint> =>
  api.post<ModelV2Checkpoint>(`${modelV2Path(issuerId)}/checkpoints`, body).then((r) => r.data);

export const restoreModelV2Checkpoint = (
  issuerId: string,
  checkpointId: string,
  body: ModelV2CheckpointRestoreRequest,
): Promise<ModelV2DraftRecord> =>
  api.post<ModelV2DraftRecord>(
    `${modelV2Path(issuerId)}/checkpoints/${encodeURIComponent(checkpointId)}/restore`,
    body,
  ).then((r) => r.data);

export const exportModelV2Workbook = (
  issuerId: string,
): Promise<ModelV2WorkbookExport> =>
  api.get<Blob>(`${modelV2Path(issuerId)}/workbook/export`, { responseType: "blob" }).then((response) => {
    const disposition = String(response.headers["content-disposition"] ?? "");
    const revisionHeader = response.headers["x-caos-model-revision"];
    const parsedRevision = Number(revisionHeader);
    return {
      blob: response.data,
      filename: disposition.match(/filename="([^"]+)"/)?.[1] ?? `caos-model-${issuerId}.xlsx`,
      revision: Number.isInteger(parsedRevision) && parsedRevision >= 0 ? parsedRevision : null,
    };
  });

export const previewModelV2Workbook = (body: {
  issuerId: string;
  file: File;
  expectedRevision: number;
  mapping?: ModelV2LegacyWorkbookMapping | null;
}): Promise<ModelV2WorkbookPreview> => {
  const form = new FormData();
  form.append("file", body.file);
  form.append("mapping", body.mapping ? JSON.stringify(body.mapping) : "");
  form.append("expected_revision", String(body.expectedRevision));
  return api.post<ModelV2WorkbookPreview>(
    `${modelV2Path(body.issuerId)}/workbook/import/preview`,
    form,
  ).then((response) => response.data);
};

export const commitModelV2Workbook = (body: {
  issuerId: string;
  file: File;
  preview: ModelV2WorkbookPreview;
  mapping?: ModelV2LegacyWorkbookMapping | null;
}): Promise<ModelV2WorkbookCommit> => {
  const form = new FormData();
  form.append("file", body.file);
  form.append("mapping", body.mapping ? JSON.stringify(body.mapping) : "");
  form.append("expected_revision", String(body.preview.expected_revision));
  form.append("preview_sha256", body.preview.workbook_sha256);
  form.append("preview_token", body.preview.preview_token ?? "");
  return api.post<ModelV2WorkbookCommit>(
    `${modelV2Path(body.issuerId)}/workbook/import/commit`,
    form,
  ).then((response) => response.data);
};

export interface ReportDraftDTO {
  id: string;
  context_id: string;
  payload: Record<string, unknown>;
  revision: number;
  updated_at: string;
}
export interface ReportVersionDTO {
  id: string;
  context_id: string;
  run_id: string;
  model_checkpoint_id: string;
  thesis_version_id: string | null;
  status: string;
  payload: Record<string, unknown>;
  document_sha256: string;
  authority: Record<string, unknown>;
  created_at: string;
}
export interface ReportVersionPreviewDTO extends ReportVersionDTO {
  status: "preview";
  preview_sha256: string;
}
export const getReportDraft = (contextId: string): Promise<ReportDraftDTO | null> =>
  api.get(`/api/reports/drafts/${contextId}`).then((r) => r.data);
export const saveReportDraft = (
  contextId: string,
  payload: Record<string, unknown>,
  expectedRevision?: number,
): Promise<ReportDraftDTO> =>
  api.put(`/api/reports/drafts/${contextId}`, {
    payload,
    expected_revision: expectedRevision,
  }).then((r) => r.data);
export const listReportVersions = (contextId: string): Promise<ReportVersionDTO[]> =>
  api.get("/api/reports/versions", { params: { context_id: contextId } }).then((r) =>
    (r.data as Array<Omit<ReportVersionDTO, "payload">>).map((version) => ({
      ...version,
      payload: {},
    })),
  );
export const getReportVersion = (versionId: string): Promise<ReportVersionDTO> =>
  api.get(`/api/reports/versions/${encodeURIComponent(versionId)}`).then((r) => r.data);
export const previewReportVersion = (body: {
  context_id: string;
  run_id: string;
  model_checkpoint_id: string;
  thesis_version_id?: string;
  payload: Record<string, unknown>;
}): Promise<ReportVersionPreviewDTO> =>
  api.post("/api/reports/versions/preview", body).then((r) => r.data);
export const publishReportVersion = (body: {
  context_id: string;
  run_id: string;
  model_checkpoint_id: string;
  thesis_version_id?: string;
  payload: Record<string, unknown>;
  preview_sha256: string;
}): Promise<ReportVersionDTO> =>
  api.post("/api/reports/versions", body).then((r) => r.data);
export const exportReportVersionBinary = (
  versionId: string,
  format: "pdf" | "xlsx",
): Promise<{ blob: Blob; filename: string }> =>
  api.post(`/api/reports/versions/${versionId}/export`, null, {
    params: { format },
    responseType: "blob",
  }).then((response) => {
    const disposition = String(response.headers["content-disposition"] ?? "");
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `caos-report-${versionId}.${format}`;
    return { blob: response.data as Blob, filename };
  });

// ─── Autonomy draft (Watchtower — Sentinel→Anomaly→Analyst→Reporter DAG) ───
export interface AutonomyClaim {
  text: string;
  claim_type: string;
  anomaly_kind: string;
  anomaly_severity: number;
  chunk_ids: string[];
  fact_ids: string[];
  model: string | null;
}
export interface AutonomyBullet {
  kind: string;
  severity: number;
  metric: string | null;
  direction: string | null;
  chunk_id: string | null;
  context: Record<string, unknown>;
}
export interface AutonomyExhibitRow {
  id: string;
  label: string;
  text: string;
  numbers: number[];
}
export interface AutonomySection {
  issuer_id: string | null;
  issuer_name: string;
  max_severity: number;
  claims: AutonomyClaim[];
  deterministic_bullets: AutonomyBullet[];
  exhibit: AutonomyExhibitRow[];
}
export interface AutonomyDraft {
  status: string;
  ai_generated: boolean;
  ratified: boolean;
  export_allowed: boolean;
  marking: string;
  generated_at?: string;
  sections: AutonomySection[];
  summary: { n_sections: number; n_claims: number; n_deterministic_bullets: number; n_anomalies: number };
  refreshing: boolean;
  error?: string;
}
// force=true skips the staleness check server-side and enqueues a fresh cycle
// (explicit "refresh" affordance — never fired automatically on an interval).
export const getAutonomyDraft = (force = false): Promise<AutonomyDraft> =>
  api.get("/api/autonomy/draft", { params: force ? { force: true } : {} }).then((r) => r.data);

// ─── Alert states (Watchtower ack/assign — Command + Monitor share these) ──
export interface AlertStateDTO {
  id: string;
  alert_key: string;
  state: "open" | "ack" | "resolved";
  assignee: string | null;
  note: string | null;
  analyst_id: string | null;
  created_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
}
export const setAlertState = (
  alertKey: string,
  state: "open" | "ack" | "resolved",
  opts?: { assignee?: string; note?: string; resolutionNote?: string },
): Promise<AlertStateDTO> =>
  api
    .post("/api/alerts/state", {
      alert_key: alertKey, state, assignee: opts?.assignee, note: opts?.note, resolution_note: opts?.resolutionNote,
    })
    .then((r) => r.data);
export const getAlertStates = (alertKey?: string): Promise<AlertStateDTO[]> =>
  api.get("/api/alerts/state", { params: alertKey ? { alert_key: alertKey } : {} }).then((r) => r.data);

export interface AlertEventDTO {
  id: string;
  alert_key: string;
  issuer_id: string | null;
  run_id: string | null;
  kind: string;
  title: string;
  impact: string;
  evidence: Record<string, unknown>;
  authority: Record<string, unknown>;
  state: "open" | "ack" | "resolved";
  assignee: string | null;
  note: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}
export const refreshAlertEvents = (): Promise<AlertEventDTO[]> =>
  api.post("/api/alerts/refresh").then((r) => r.data);
export const getAlertEvents = (state?: AlertEventDTO["state"]): Promise<AlertEventDTO[]> =>
  api.get("/api/alerts/events", { params: state ? { state } : {} }).then((r) => r.data);
export const patchAlertEvent = (
  id: string,
  state: AlertEventDTO["state"],
  opts?: { assignee?: string; note?: string; resolutionNote?: string },
): Promise<AlertEventDTO> =>
  api.patch(`/api/alerts/events/${id}`, {
    state,
    assignee: opts?.assignee,
    note: opts?.note,
    resolution_note: opts?.resolutionNote,
  }).then((r) => r.data);
