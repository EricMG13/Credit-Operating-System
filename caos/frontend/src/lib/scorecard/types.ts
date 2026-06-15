// Loan Scorecard — shapes returned by /api/scorecard/{deal_id} (see
// server/routes/scorecard.py, engine/scorecard.py, and docs/SCORECARD_SCHEMA.md).
// A documentation-protection score on the 1 (most protective) → 5 (deficient)
// scale: a weighted Composite over 5 Sub-Scores, fed by 6 Quality Scores. Every
// score carries the input drivers that produced it and its basis — doc-grounded
// ("covenant_review") or computed from empirical signals ("methodology").

export interface ScoreDriver {
  label: string;
  detail: string;
  contribution?: number | null; // the 1–5 value this input pushed toward
}

export type ScoreBasis = "covenant_review" | "methodology" | "mixed" | "none" | "scored";

export interface ScoreResult {
  key: string;
  label: string;
  value: number | null; // 1–5, or null when Insufficient Information
  band: string | null; // "Strongly protective" … "Deficient"
  confidence: string; // High | Moderate | Low | Insufficient Information
  basis: ScoreBasis;
  drivers: ScoreDriver[];
}

export interface Scorecard {
  deal_id: string;
  deal_label: string;
  issuer_id: string;
  issuer_name?: string | null;
  seniority?: string | null; // "1L" | "2L" | null
  basis: ScoreBasis;
  composite: ScoreResult;
  sub_scores: ScoreResult[];
  quality_scores: ScoreResult[];
  limitation_flags: string[];
}
