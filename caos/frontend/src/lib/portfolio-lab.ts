import { api } from "@/lib/api";
import type { AuthorityEnvelope } from "@/lib/analysis-workbench";

export const PORTFOLIO_SORTS = [
  "borrower_name", "ticker", "sector", "sub_sector", "ranking",
  "rating_moody", "rating_sp", "par_usd", "price", "margin_bps",
  "maturity", "created_at",
] as const;

export type PortfolioPositionSort = typeof PORTFOLIO_SORTS[number];
export type SortDirection = "asc" | "desc";

export interface PortfolioPosition {
  id: string;
  portfolio_id: string;
  issuer_id: string | null;
  borrower_name: string;
  ticker: string | null;
  figi: string | null;
  loan_name: string | null;
  sector: string | null;
  sub_sector: string | null;
  ranking: string | null;
  rating_moody: string | null;
  rating_sp: string | null;
  par_usd: number | null;
  facility_musd: number | null;
  margin_bps: number | null;
  maturity: string | null;
  price: number | null;
  ytm: number | null;
  dm: number | null;
  market_value: number | null;
  created_at: string;
}

export interface PortfolioPositionFilters {
  limit?: number;
  cursor?: string;
  sort?: PortfolioPositionSort;
  direction?: SortDirection;
  text?: string;
  sector?: string;
  rating?: string;
  ranking?: string;
}

export interface PortfolioPositionPage {
  items: PortfolioPosition[];
  total: number;
  next_cursor: string | null;
  as_of: string | null;
  authority: AuthorityEnvelope;
}

export type CommandPosture = "OVERWEIGHT" | "NEUTRAL" | "UNDERWEIGHT" | "UNKNOWN";

export interface CommandPortfolioPosition extends PortfolioPosition {
  posture: CommandPosture;
  run_id: string | null;
  qa_status: string | null;
  committee_status: string | null;
}

export interface CommandPortfolioSnapshot {
  portfolio: {
    id: string;
    name: string;
    kind: string;
    as_of_date: string | null;
  };
  positions: CommandPortfolioPosition[];
  posture_counts: Record<CommandPosture, number>;
  position_count: number;
  as_of: string | null;
  authority: AuthorityEnvelope;
}

export interface PortfolioConstraint {
  code: string | null;
  category: string | null;
  parameter: string | null;
  limit_text: string | null;
  current: number | null;
  headroom: number | null;
  status: "Pass" | "Watch" | "Breach" | "Info";
  breach_type?: string | null;
  source_document?: string | null;
}

export interface PortfolioAnalytics {
  as_of: string | null;
  concentration: {
    n_positions: number;
    n_obligors: number;
    total_nav: number | null;
    total_par: number | null;
    sectors: Array<{ sector: string; mv: number | null; pct_nav: number | null; n_obligors: number }>;
    rating_dist: Array<{ bucket: string; mv: number | null; pct_nav: number | null; n_obligors: number }>;
    top10: Array<{ obligor: string; mv: number | null; pct_nav: number | null }>;
    top10_pct_nav: number | null;
    wa_rating: string | null;
    wa_margin: number | null;
    wa_price: number | null;
    first_lien_pct: number | null;
  };
  rating_distribution: Record<string, number | null>;
  maturity_wall: Record<string, number | null>;
  risk_budget: {
    status_counts: Record<string, number>;
    headroom: PortfolioConstraint[];
  };
  liquidity: { priced_nav_pct: number | null; wa_price: number | null; unpriced_positions: number };
  compliance: PortfolioConstraint[];
  authority: AuthorityEnvelope;
  missing_dependencies: string[];
  latest_stress_runs?: Array<{
    id: string; label: string; status: string; source_fingerprint: string;
    base_nav: number | null; stressed_nav: number | null; loss_amount: number | null;
    loss_percent: number | null; created_at: string;
  }>;
}

export interface StressRunInput {
  label: string;
  book_price_shock_pct: number;
  sector_shock_pcts: Record<string, number>;
}

export interface StressRun {
  id: string;
  portfolio_id: string;
  created_by: string;
  label: string;
  input: StressRunInput;
  output: {
    base_nav: number | null;
    stressed_nav: number | null;
    loss_amount: number | null;
    loss_percent: number | null;
    sector_contributions: Array<{ sector: string; loss_amount: number | null }>;
    authority: AuthorityEnvelope;
    missing_dependencies: string[];
  };
  source_fingerprint: string;
  authority: AuthorityEnvelope;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface StressRunPage {
  items: StressRun[];
  total: number;
  authority: AuthorityEnvelope;
}

export const portfolioLabApi = {
  getCommandSnapshot: (portfolioId: string) =>
    api.get<CommandPortfolioSnapshot>(`/api/portfolios/${portfolioId}/command`)
      .then((response) => response.data),
  getPositions: (portfolioId: string, filters: PortfolioPositionFilters = {}) =>
    api.get<PortfolioPositionPage>(`/api/portfolios/${portfolioId}/positions`, { params: filters })
      .then((response) => response.data),
  getAnalytics: (portfolioId: string, asOf?: string) =>
    api.get<PortfolioAnalytics>(`/api/portfolios/${portfolioId}/analytics`, {
      params: asOf ? { as_of: asOf } : {},
    }).then((response) => response.data),
  listStressRuns: (portfolioId: string, limit = 50) =>
    api.get<StressRunPage>(`/api/portfolios/${portfolioId}/stress-runs`, { params: { limit } })
      .then((response) => response.data),
  createStressRun: (portfolioId: string, input: StressRunInput) =>
    api.post<StressRun>(`/api/portfolios/${portfolioId}/stress-runs`, input)
      .then((response) => response.data),
};
