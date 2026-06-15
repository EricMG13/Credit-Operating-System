// Loan Compare — shapes returned by /api/compare (see server/routes/compare.py
// and docs/COMPARE_SCHEMA.md). A grid is deals (columns) × terms (rows) grouped
// into catalog sections; every populated cell carries its provenance.

export interface DealSummary {
  id: string;
  label: string;
  issuer_id: string;
  issuer_name?: string | null;
  industry?: string | null;
  transaction_phase?: string | null;
  launch_date?: string | null;
  provenance: string;
}

export interface CompareCell {
  deal_id: string;
  present: boolean; // false = not extracted for this deal (distinct from a "—" value)
  value_num?: number | null;
  value_text?: string | null;
  display: string;
  delta?: number | null; // numeric value − benchmark value (numeric terms only)
  lineage_class: string;
  confidence: string;
  document_chunk_id?: string | null;
  has_quote: boolean;
}

// Direction that is more borrower-favorable / less lender-protective.
export type Looser = "higher" | "lower" | "yes" | "none";

export interface CompareRow {
  term_key: string;
  label: string;
  vtype: string;
  looser: Looser;
  cells: CompareCell[];
}

export interface CompareSection {
  key: string;
  label: string;
  rows: CompareRow[];
}

export interface CompareGrid {
  deals: DealSummary[]; // requested column order
  benchmark_deal_id: string | null;
  sections: CompareSection[];
}
