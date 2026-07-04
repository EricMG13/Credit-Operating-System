// DTOs for cross-issuer natural-language query (caos/server/routes/query.py +
// nlquery.py). snake_case mirrors the FastAPI response verbatim.

export interface MetricDef {
  key: string;
  label: string;
  unit: string; // "x" | "%" | "$M"
  category: string;
  higher_is_better: boolean;
  description: string;
}

export interface Citation {
  claim_id: string | null;
  evidence_id: string | null;
  chunk_id: string | null;
}

export interface MetricCell {
  value: number;
  unit: string;
  // run = QA-gated engine run; derived = extracted from a cited document chunk;
  // fixture = ATLF demo numbers (not a real run, #04); seed = illustrative, no source.
  provenance: "run" | "derived" | "fixture" | "seed";
  qa_status: string;
  period: string;
  citation: Citation | null;
}

export interface QueryColumn {
  key: string;
  label: string;
  unit: string;
  higher_is_better: boolean;
}

export interface QueryIssuer {
  id: string;
  name: string;
  ticker: string | null;
  industry: string | null;
  country: string | null;
}

export interface QueryRow {
  issuer: QueryIssuer;
  rank_value: number;
  metrics: Record<string, MetricCell>;
  // Hybrid mode: a corroborating document excerpt for this issuer (or null).
  evidence?: Excerpt | null;
}

export interface StructuredResult {
  // "hybrid" = ranked + per-issuer corroborating evidence excerpts.
  mode: "structured" | "hybrid";
  interpretation: string;
  spec: unknown;
  rank_by: string;
  columns: QueryColumn[];
  rows: QueryRow[];
  // Issuers eligible to be ranked before the top-N display cap. rows.length when
  // not capped; larger when the result is "top N of total_ranked".
  total_ranked: number;
  caveats: string[];
}

// ── Semantic (evidence-retrieval) results ────────────────────────────────────
export interface Excerpt {
  chunk_id: string;
  doc: string;
  text: string;
}

export interface SemanticRow {
  issuer: QueryIssuer;
  score: number;
  excerpts: Excerpt[];
}

export interface SemanticResult {
  mode: "semantic";
  interpretation: string;
  rank_by: null;
  rows: SemanticRow[];
  caveats: string[];
}

// Synthesis (agent-wiki retrieval) results — same row shape as semantic, but
// matched against agent syntheses / claims / QA findings instead of documents.
export interface SynthesisResult {
  mode: "synthesis";
  interpretation: string;
  rank_by: null;
  rows: SemanticRow[];
  caveats: string[];
}

// The endpoint returns one of these, discriminated by `mode`.
export type NlQueryResult = StructuredResult | SemanticResult | SynthesisResult;

// One ingested source chunk — backs the click-to-source citation viewer.
export interface ChunkDTO {
  chunk_id: string;
  issuer_id: string;
  issuer_name: string;
  doc: string;
  doc_type: string;
  seq: number;
  text: string;
}
