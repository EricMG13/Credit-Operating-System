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
import type { MetricDef, NlQueryResult } from "@/lib/query/types";

export const nlQuery = (question: string): Promise<NlQueryResult> =>
  api.post("/api/query/nl", { question }).then((r) => r.data);

export const getMetricCatalog = (): Promise<MetricDef[]> =>
  api.get("/api/query/catalog").then((r) => r.data.metrics);
