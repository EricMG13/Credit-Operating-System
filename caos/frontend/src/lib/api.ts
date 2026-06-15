import axios from "axios";

// Same-origin API: the FastAPI server serves both /api and the static
// frontend in deployment (Databricks Apps). In `next dev`, the rewrite in
// next.config.js proxies /api to the local server on :8000.
export const api = axios.create({
  headers: { "Content-Type": "application/json" },
});

// ─── Identity ─────────────────────────────────────────────────────────────
// Authentication is platform-managed (Databricks workspace OAuth at the
// edge). /api/auth/me reflects the forwarded identity.
export const getMe = () => api.get("/api/auth/me").then((r) => r.data);

// ─── Issuers ──────────────────────────────────────────────────────────────
// `q` searches name, ticker, industry, country, and FIGI (case-insensitive).
export const getIssuers = (q?: string) =>
  api.get("/api/issuers/", { params: q && q.trim() ? { q: q.trim() } : {} }).then((r) => r.data);
export const createIssuer = (data: Record<string, unknown>) =>
  api.post("/api/issuers/", data).then((r) => r.data);

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
export const exportReport = (runId: string): Promise<unknown> =>
  api.post(`/api/runs/${runId}/report`).then((r) => r.data);

// ─── Cross-issuer natural-language query ─────────────────────────────────────
import type { ChunkDTO, MetricDef, NlQueryResult } from "@/lib/query/types";

export const nlQuery = (question: string): Promise<NlQueryResult> =>
  api.post("/api/query/nl", { question }).then((r) => r.data);

export const getMetricCatalog = (): Promise<MetricDef[]> =>
  api.get("/api/query/catalog").then((r) => r.data.metrics);

// Click-to-source: fetch one ingested chunk behind a citation chip.
export const getChunk = (chunkId: string): Promise<ChunkDTO> =>
  api.get(`/api/query/chunk/${chunkId}`).then((r) => r.data);

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
// Search → filing pointers (external · unverified) → exhibits → vault one as a
// primary source. Endpoints 503 until EDGAR_USER_AGENT is configured server-side.
export interface EdgarFilingHit {
  cik: string;
  accession: string;
  form: string;
  filed_date: string;
  title: string;
  source_url: string;
  provenance: string;
}
export interface EdgarExhibit {
  name: string;
  url: string;
  doc_label: string;
  authority_rank: number | null;
  size: number | null;
}
export interface EdgarVaultResult {
  document_id: string;
  storage_key: string;
  doc_type: string;
  run_mode: string;
  chunks_created: number;
  provenance: string;
  message: string;
}

export const edgarSearch = (q: string, forms?: string): Promise<EdgarFilingHit[]> =>
  api.get("/api/edgar/search", { params: { q, ...(forms ? { forms } : {}) } }).then((r) => r.data);

export const edgarExhibits = (cik: string, accession: string): Promise<EdgarExhibit[]> =>
  api.get("/api/edgar/exhibits", { params: { cik, accession } }).then((r) => r.data);

export const edgarVaultExhibit = (
  issuerId: string,
  exhibitUrl: string,
  runMode = "legal",
): Promise<EdgarVaultResult> =>
  api
    .post("/api/edgar/vault-exhibit", { issuer_id: issuerId, exhibit_url: exhibitUrl, run_mode: runMode })
    .then((r) => r.data);

// ─── Loan Compare (cross-issuer documentation comparison) ────────────────────
import type { CompareGrid, DealSummary } from "@/lib/compare/types";

export const getDeals = (q?: string): Promise<DealSummary[]> =>
  api.get("/api/compare/deals", { params: q && q.trim() ? { q: q.trim() } : {} }).then((r) => r.data);

export const getComparison = (dealIds: string[], benchmark?: string): Promise<CompareGrid> =>
  api
    .get("/api/compare", { params: { deals: dealIds.join(","), ...(benchmark ? { benchmark } : {}) } })
    .then((r) => r.data);

// ─── Loan Scorecard (documentation-protection score for one deal) ────────────
import type { Scorecard } from "@/lib/scorecard/types";

export const getScorecard = (dealId: string): Promise<Scorecard> =>
  api.get(`/api/scorecard/${dealId}`).then((r) => r.data);
