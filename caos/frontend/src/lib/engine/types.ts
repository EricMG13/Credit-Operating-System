// DTOs for the analytical engine API (caos/server/routes/runs.py). Keys are
// snake_case to match the FastAPI response models verbatim.

// The seeded reference deal (Atlas Forge Industrials) — see
// caos/server/engine/fixtures.py. Used to pull the live run for the deep-dive.
export const ATLF_REFERENCE_ISSUER_ID = "a71f0000-0000-0000-0000-000000000001";

export interface EvidenceDTO {
  evidence_id: string;
  extraction_type: string;
  lineage_class: string;
  source_locator: string | null;
  confidence: string;
  document_chunk_id: string | null;
}

export interface ClaimDTO {
  claim_id: string;
  claim_text: string;
  evidence: EvidenceDTO[];
}

export interface ModuleStatusDTO {
  module_id: string;
  module_name: string;
  qa_status: string;
  committee_status: string;
  confidence: string;
  validation_status: string;
}

export interface ModuleDetailDTO {
  module_id: string;
  module_name: string;
  owned_object: string | null;
  schema_family: string;
  runtime_output: Record<string, unknown>;
  confidence: string;
  qa_status: string;
  committee_status: string;
  validation_status: string;
  limitation_flags: string[];
  downstream_consumers: string[];
  claims: ClaimDTO[];
}

export interface RunSummaryDTO {
  id: string;
  issuer_id: string;
  status: string;
  qa_status: string;
  committee_status: string;
  as_of_date: string | null;
  model_id: string | null;
  prompt_version: string | null;
  modules: ModuleStatusDTO[];
}

export interface RunListItemDTO {
  id: string;
  issuer_id: string;
  status: string;
  qa_status: string;
  committee_status: string;
  as_of_date: string | null;
  created_at: string | null;
}

export interface FindingDTO {
  finding_id: string;
  severity: string;
  lane: number | null;
  module_id: string | null;
  description: string;
  affected_claim_id: string | null;
  required_remediation: string | null;
}

export interface QAReportDTO {
  run_id: string;
  qa_status: string;
  committee_status: string;
  findings_by_severity: Record<string, number>;
  findings: FindingDTO[];
}
