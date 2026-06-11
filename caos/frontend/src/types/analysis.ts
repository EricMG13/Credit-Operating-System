// Types backing the narrative + Evidence Trace + Evidence Sync features.
// Mirrors the Blueprint §2 backend contract (SourceAnchor, three-tier EvidenceChain).

export interface SourceAnchor {
  document_id: string;
  clause_id?: string; // demo: clause-level anchor in the text vault
  page?: number; // real backend: PDF page
  quote?: string;
}

/** Three-tier lineage: Evidence → Risk Mechanic → Credit Implication. */
export interface EvidenceLink {
  evidence: string;
  source_doc: string;
  risk_mechanic: string;
  credit_implication: string;
  confidence?: number; // 0–1
  anchor?: SourceAnchor;
}

/** The selectable unit. Every chart datum / covenant row / citation resolves to one. */
export interface Conclusion {
  id: string;
  module: string; // e.g. "CP-2"
  label: string;
  value: string;
  evidence_chain: EvidenceLink[];
}

export interface Clause {
  id: string;
  speaker?: string;
  text: string;
}

export interface SourceDocument {
  document_id: string;
  title: string;
  doc_type: string;
  clauses: Clause[];
}
