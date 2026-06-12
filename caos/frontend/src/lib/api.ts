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
