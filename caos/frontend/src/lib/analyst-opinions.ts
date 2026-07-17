import { api } from "@/lib/api";

export type AnalystStance = "OVERWEIGHT" | "NEUTRAL" | "UNDERWEIGHT";
export type AnalystEvidenceState = "supported" | "provisional";

export interface AnalystOpinionVersion {
  id: string;
  issuer_id: string;
  analyst_id: string;
  version: number;
  stance: AnalystStance;
  conviction: number | null;
  rationale_md: string;
  evidence_state: AnalystEvidenceState;
  unresolved_items: string[];
  thesis_version_id: string | null;
  source_run_id: string | null;
  context_id: string | null;
  analyst_link_ids: string[];
  created_at: string;
}

export interface AnalystOpinionHistory {
  current: AnalystOpinionVersion | null;
  items: AnalystOpinionVersion[];
}

export interface AnalystOpinionInput {
  stance: AnalystStance;
  conviction?: number | null;
  rationale_md: string;
  evidence_state: AnalystEvidenceState;
  unresolved_items?: string[];
  thesis_version_id?: string | null;
  source_run_id?: string | null;
  context_id?: string | null;
  analyst_link_ids?: string[];
}

export const analystOpinionsApi = {
  list: (issuerId: string) =>
    api.get<AnalystOpinionHistory>(`/api/issuers/${issuerId}/analyst-opinions`).then((response) => response.data),
  create: (issuerId: string, input: AnalystOpinionInput) =>
    api.post<AnalystOpinionVersion>(`/api/issuers/${issuerId}/analyst-opinions`, input).then((response) => response.data),
};
