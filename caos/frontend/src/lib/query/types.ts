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
  provenance: "run" | "seed";
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
}

export interface StructuredResult {
  mode: "structured";
  interpretation: string;
  spec: unknown;
  rank_by: string;
  columns: QueryColumn[];
  rows: QueryRow[];
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

// The endpoint returns one or the other, discriminated by `mode`.
export type NlQueryResult = StructuredResult | SemanticResult;
