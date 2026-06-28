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
    config.headers.set("X-Model-Mode", loadMode());
    const qm = localStorage.getItem("caos_query_model");
    if (qm) config.headers.set("X-Query-Model", qm);
  }
  return config;
});

// ─── Identity ─────────────────────────────────────────────────────────────
// Authentication is platform-managed (Databricks workspace OAuth at the
// edge). /api/auth/me reflects the forwarded identity.
// Bounded: a down/hung API (or proxy to a dead :8000) must not strand the whole
// app on the RequireAuth "Loading…" gate — on timeout the request rejects and
// the error card (with RETRY) shows instead. Long-running calls set their own.
export const getMe = () => api.get("/api/auth/me", { timeout: 8000 }).then((r) => r.data);

// In-app login: the shared access code mints (or re-attaches to) a named analyst
// profile and sets the signed identity cookie. logout clears it.
// fallow-ignore-next-line unused-export
export const createProfile = (code: string, name: string) =>
  api.post("/api/auth/profile", { code, name }, { timeout: 8000 }).then((r) => r.data);
export const logout = () => api.post("/api/auth/logout", {}, { timeout: 8000 });

// Email + password account lane (alongside edge SSO). register creates the account
// (gated by the shared invite code) and signs in; login authenticates an existing
// one. Both return the same { source: "profile" } identity and set the cookie.
export const register = (data: { code: string; name: string; email: string; password: string }) =>
  api.post("/api/auth/register", data, { timeout: 8000 }).then((r) => r.data);
export const login = (email: string, password: string) =>
  api.post("/api/auth/login", { email, password }, { timeout: 8000 }).then((r) => r.data);

// ─── Issuers ──────────────────────────────────────────────────────────────
// `q` searches name, ticker, sector/industry, sub-sector, country, and FIGI.
export const getIssuers = (q?: string) =>
  api.get("/api/issuers/", { params: q && q.trim() ? { q: q.trim() } : {} }).then((r) => r.data);
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
  runs: ProfileRun[];
  metrics: ProfileMetric[];
  // Free-form roll-ups (nullable values) — Deep-Dive owns module detail.
  signals: Record<string, number | string | null>;
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

// ─── Issuer Q&A chat ──────────────────────────────────────────────────────
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
export const askIssuer = (messages: ChatMessage[]): Promise<string> =>
  api.post("/api/chat/issuer", { messages }).then((r) => r.data.reply);

// ─── Ingestion ────────────────────────────────────────────────────────────
export const uploadDocument = (formData: FormData) =>
  api.post("/api/ingestion/upload/document", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((r) => r.data);

export const uploadPricingSheet = (formData: FormData) =>
  api.post("/api/ingestion/upload/pricing-sheet", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((r) => r.data);

// ─── Analytical engine (runs) ───────────────────────────────────────────────
import type {
  ModuleDetailDTO,
  QAReportDTO,
  RunListItemDTO,
  RunSummaryDTO,
} from "@/lib/engine/types";

// API-client surface for POST /api/runs — kept ahead of its UI consumer.
// fallow-ignore-next-line unused-export
export const createRun = (issuerId: string, asOfDate?: string): Promise<RunSummaryDTO> =>
  api.post("/api/runs", { issuer_id: issuerId, as_of_date: asOfDate }).then((r) => r.data);

export const listRuns = (issuerId?: string): Promise<RunListItemDTO[]> =>
  api.get("/api/runs", { params: issuerId ? { issuer_id: issuerId } : {} }).then((r) => r.data);

export const getRun = (runId: string): Promise<RunSummaryDTO> =>
  api.get(`/api/runs/${runId}`).then((r) => r.data);

export const getModule = (runId: string, moduleId: string): Promise<ModuleDetailDTO> =>
  api.get(`/api/runs/${runId}/modules/${moduleId}`).then((r) => r.data);

export const getQA = (runId: string): Promise<QAReportDTO> =>
  api.get(`/api/runs/${runId}/qa`).then((r) => r.data);

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

export const nlQuery = (question: string): Promise<NlQueryResult> =>
  api.post("/api/query/nl", { question }).then((r) => r.data);

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

// Run one capability → a positioned node-link graph.
export const queryGraph = (capabilityId: string, issuerId?: string): Promise<GraphResult> =>
  api.post("/api/query/graph", { capability_id: capabilityId, issuer_id: issuerId }).then((r) => r.data);

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
interface ResearchJob extends ResearchResult {
  id: string;
  status: "running" | "complete" | "failed";
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

export const deepResearch = async (brief: ResearchBrief): Promise<ResearchResult> => {
  const { id } = (await api.post("/api/research", brief)).data as { id: string };
  const deadline = Date.now() + _RESEARCH_DEADLINE_MS;
  let pollErrors = 0;
  let first = true;
  while (Date.now() < deadline) {
    if (!first) await new Promise((r) => setTimeout(r, _RESEARCH_POLL_MS));
    first = false; // poll immediately first so a fast/demo completion isn't delayed
    let job: ResearchJob;
    try {
      job = (await api.get(`/api/research/${id}`)).data as ResearchJob;
      pollErrors = 0;
    } catch {
      // Transport error — the durable job is unaffected; keep polling. Bail only
      // after many consecutive failures (the backend is likely actually down).
      if (++pollErrors >= _RESEARCH_MAX_POLL_ERRORS)
        throw _detail("Lost contact with the research backend — the run may still be completing; retry shortly.");
      continue;
    }
    if (job.status === "complete")
      return { report: job.report, sources: job.sources, demo: job.demo, truncated: job.truncated };
    if (job.status === "failed") throw _detail(job.error || "Research failed — try again.");
  }
  throw _detail("Research timed out on the client — it may still be completing; retry shortly.");
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
}
export const getSettings = (): Promise<WorkspaceSettings> =>
  api.get("/api/settings").then((r) => r.data);
