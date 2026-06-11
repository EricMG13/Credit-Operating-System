import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

// ─── JWT Token Interceptor ────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("caos_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("caos_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  api.post("/api/auth/login", { email, password }).then((r) => {
    localStorage.setItem("caos_token", r.data.access_token);
    return r.data;
  });

export const register = (email: string, password: string, full_name: string) =>
  api.post("/api/auth/register", { email, password, full_name }).then((r) => r.data);

export const getMe = () => api.get("/api/auth/me").then((r) => r.data);

export const logout = () => {
  localStorage.removeItem("caos_token");
  window.location.href = "/login";
};

// ─── Issuers ──────────────────────────────────────────────────────────────
export const getIssuers = () => api.get("/api/issuers/").then((r) => r.data);
export const getIssuer = (id: string) => api.get(`/api/issuers/${id}`).then((r) => r.data);
export const createIssuer = (data: Record<string, unknown>) =>
  api.post("/api/issuers/", data).then((r) => r.data);

// ─── Source document + Evidence Trace registry ─────────────────────────────
// These two endpoints are not yet implemented on the backend. The functions
// resolve to `null` / `{}` so consumers (issuer cockpit) render cleanly until
// the server-side handlers land.
import type { Conclusion, SourceDocument } from "@/types/analysis";
export const getSourceDocument = async (_issuerId: string): Promise<SourceDocument | null> => null;
export const getConclusions = async (_issuerId: string): Promise<Record<string, Conclusion>> => ({});

// ─── Issuer documents ─────────────────────────────────────────────────────
export interface IssuerDocument {
  id: string;
  doc_type: string;
  file_name: string;
  uploaded_at: string;
  fiscal_period: string | null;
}
export const listIssuerDocuments = (issuerId: string): Promise<IssuerDocument[]> =>
  api.get(`/api/issuers/${issuerId}/documents`).then((r) => r.data);

// ─── DAG Runs ─────────────────────────────────────────────────────────────
export const triggerRun = (issuer_id: string, document_id: string, force_full_run = false) =>
  api.post("/api/agents/run", { issuer_id, document_id, force_full_run }).then((r) => r.data);

export const getDagRun = (dag_run_id: string) =>
  api.get(`/api/agents/runs/${dag_run_id}`).then((r) => r.data);

export const listDagRuns = (issuer_id?: string) =>
  api.get("/api/agents/runs", { params: issuer_id ? { issuer_id } : {} }).then((r) => r.data);

export const getDagRunOutputs = (dag_run_id: string) =>
  api.get(`/api/agents/runs/${dag_run_id}/outputs`).then((r) => r.data);

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
