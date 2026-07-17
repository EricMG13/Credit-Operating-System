import { api } from "@/lib/api";
import type { AuthorityEnvelope } from "@/lib/analysis-workbench";

export type AgendaStatus = "draft" | "ready" | "decided" | "cancelled";
export type CommitteeRecommendation = "approve" | "decline" | "revisit";
export type CommitteeExceptionStatus = "pending" | "approved" | "rejected" | "revoked" | "expired";

export interface CommitteeEvidenceException {
  id: string;
  agenda_item_id: string;
  run_id: string;
  basis_sha256: string;
  failure_codes: string[];
  finding_ids: string[];
  rationale: string;
  mitigants: string[];
  expires_at: string;
  status: CommitteeExceptionStatus;
  requested_by: string;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
  revision: number;
}

export interface CommitteeAgendaItem {
  id: string;
  issuer_id: string;
  portfolio_id: string | null;
  owner_id: string;
  scheduled_for: string;
  expiry: string | null;
  recommendation: CommitteeRecommendation;
  conviction: number | null;
  thesis: string;
  conditions: string[];
  run_id: string | null;
  report_version_id: string | null;
  context_id: string | null;
  analyst_opinion_version_id: string | null;
  status: AgendaStatus;
  revision: number;
  readiness_failures: string[];
  readiness_state: "blocked" | "ready" | "ready_under_exception";
  evidence_exception: CommitteeEvidenceException | null;
  finalized_decision_id: string | null;
  snapshot_sha256: string | null;
  frozen_authority: Partial<AuthorityEnvelope> | null;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
}

export interface AgendaPage {
  items: CommitteeAgendaItem[];
  next_cursor: string | null;
  total: number;
}

export interface AgendaCreateInput {
  issuer_id: string;
  portfolio_id?: string | null;
  scheduled_for: string;
  expiry?: string | null;
  recommendation: CommitteeRecommendation;
  conviction?: number | null;
  thesis: string;
  conditions?: string[];
  run_id?: string | null;
  report_version_id?: string | null;
  context_id?: string | null;
  analyst_opinion_version_id?: string | null;
  status?: "draft" | "ready";
}

export interface AgendaPatch extends Partial<Omit<AgendaCreateInput, "issuer_id" | "status">> {
  expected_revision: number;
  status?: "draft" | "ready" | "cancelled";
}

export interface FinalizedDecision {
  id: string;
  issuer_id: string;
  portfolio_id: string | null;
  agenda_item_id: string | null;
  run_id: string;
  report_version_id: string | null;
  action: CommitteeRecommendation;
  status: "active" | "reopened";
  snapshot_sha256: string;
  created_at: string;
}

export interface FinalizeResult {
  agenda: CommitteeAgendaItem;
  decision: FinalizedDecision;
}

export interface DecisionVote {
  id: string;
  member: string;
  vote: "approve" | "dissent" | "abstain";
  dissent_note: string | null;
  created_at: string;
}

export interface DecisionBookItem extends FinalizedDecision {
  report_id: string | null;
  conditions: string[];
  expiry: string | null;
  snapshot: Record<string, unknown>;
  created_by: string | null;
  reopened_at: string | null;
  reopen_alert_key: string | null;
  votes: DecisionVote[];
}

export interface DecisionBookPage {
  items: DecisionBookItem[];
  next_cursor: string | null;
  total: number;
}

export interface DecisionFilters {
  issuer_id?: string;
  portfolio_id?: string;
  status?: "active" | "reopened";
  owner_id?: string;
  expiry_from?: string;
  expiry_to?: string;
  sort?: "created_at" | "expiry" | "status" | "issuer_id" | "owner";
  direction?: "asc" | "desc";
  cursor?: string;
  limit?: number;
}

export interface AgendaFilters {
  status?: AgendaStatus;
  issuer_id?: string;
  portfolio_id?: string;
  owner_id?: string;
  cursor?: string;
  limit?: number;
  sort?: "scheduled_for" | "updated_at" | "created_at" | "status" | "owner" | "expiry";
  scheduled_from?: string;
  scheduled_to?: string;
  expiry_from?: string;
  expiry_to?: string;
  direction?: "asc" | "desc";
}

export const icBookApi = {
  listAgenda: (filters: AgendaFilters = {}) =>
    api.get<AgendaPage>("/api/committee/agenda", { params: filters }).then((response) => response.data),
  getAgenda: (id: string) =>
    api.get<CommitteeAgendaItem>(`/api/committee/agenda/${id}`).then((response) => response.data),
  createAgenda: (input: AgendaCreateInput) =>
    api.post<CommitteeAgendaItem>("/api/committee/agenda", input).then((response) => response.data),
  patchAgenda: (id: string, input: AgendaPatch) =>
    api.patch<CommitteeAgendaItem>(`/api/committee/agenda/${id}`, input).then((response) => response.data),
  requestException: (id: string, input: { expected_revision: number; rationale: string; mitigants?: string[]; expires_at: string }) =>
    api.post<CommitteeAgendaItem>(`/api/committee/agenda/${id}/exceptions`, input).then((response) => response.data),
  reviewException: (id: string, input: { expected_revision: number; decision: "approve" | "reject"; review_note: string }) =>
    api.post<CommitteeAgendaItem>(`/api/committee/exceptions/${id}/review`, input).then((response) => response.data),
  revokeException: (id: string, input: { expected_revision: number; review_note: string }) =>
    api.post<CommitteeAgendaItem>(`/api/committee/exceptions/${id}/revoke`, input).then((response) => response.data),
  finalizeAgenda: (id: string, expectedRevision: number) =>
    api.post<FinalizeResult>(`/api/committee/agenda/${id}/finalize`, {
      expected_revision: expectedRevision,
    })
      .then((response) => response.data),
  listDecisions: (filters: DecisionFilters = {}) =>
    api.get<DecisionBookPage>("/api/decisions", { params: { book: true, ...filters } })
      .then((response) => response.data),
  getDecision: (id: string) =>
    api.get<DecisionBookItem>(`/api/decisions/${id}`).then((response) => response.data),
  vote: (id: string, vote: DecisionVote["vote"], dissentNote?: string) =>
    api.post<DecisionBookItem>(`/api/decisions/${id}/votes`, {
      vote,
      dissent_note: dissentNote,
    }).then((response) => response.data),
  reopen: (id: string, triggerAlertKey: string) =>
    api.post<DecisionBookItem>(`/api/decisions/${id}/reopen`, {
      trigger_alert_key: triggerAlertKey,
    }).then((response) => response.data),
};
