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
