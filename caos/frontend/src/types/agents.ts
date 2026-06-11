// Agent output types mirroring backend Pydantic schemas

export type Severity = "PASS" | "WARNING" | "CRITICAL";
export type RunType = "FULL_RUN" | "DELTA_RUN";
export type DagStatus = "PENDING" | "RUNNING" | "COMPLETED" | "BLOCKED" | "FAILED";
export type Posture = "BUY" | "HOLD" | "SELL" | "AVOID" | "SPLIT";
export type Persona = "RV_TRADER" | "COMPLIANCE" | "CIO";
export type FairValueVerdict = "CHEAP" | "FAIR" | "RICH";
export type CovenantSeverity = "OK" | "WARNING" | "CRITICAL";

export interface EvidenceChain {
  evidence: string;
  source_doc: string;
  risk_mechanic: string;
  credit_implication: string;
}

export interface MaterialConclusion {
  label: string;
  value: string;
  evidence_chain: EvidenceChain[];
}

export interface DebtTranche {
  name: string;
  type: string;
  amount_mm: number;
  currency: string;
  maturity: string;
  rate: string;
  seniority_rank: number;
  lien_position: number;
}

export interface FinancialPeriod {
  period: string;
  revenue_mm: number;
  ebitda_mm: number;
  ebitda_margin_pct: number;
  net_leverage_x: number;
  interest_coverage_x: number;
  fcf_mm: number;
  capex_mm?: number;
}

export interface CovenantHeadroom {
  covenant_name: string;
  limit_value: number;
  actual_value: number;
  headroom_pct: number;
  severity: CovenantSeverity;
}

export interface DebateAgentOutput {
  persona: Persona;
  posture: Posture;
  conviction: number;
  thesis: string;
  key_risks: string[];
  key_supports: string[];
}

export interface DagRun {
  dag_run_id: string;
  issuer_id: string;
  run_type: RunType | string;
  status: DagStatus;
}

export interface AgentOutputs {
  cp0?: Record<string, unknown>;
  cp1?: { tranches: DebtTranche[]; total_debt_mm: number };
  cp2?: { historical_periods: FinancialPeriod[]; ltm_period: FinancialPeriod; business_description: string };
  cp3?: {
    subject_spread_bps: number;
    subject_net_leverage_x?: number;
    fair_value_verdict: FairValueVerdict;
    rv_commentary: string;
    comparables?: { issuer_name: string; net_leverage_x: number; spread_bps: number; ytw_pct?: number }[];
  };
  cp4?: Record<string, unknown>;
  cp4c?: { headroom_items: CovenantHeadroom[]; liquidity_runway_months?: number; rcf_availability_mm?: number };
  cp6e?: { debate_agents: DebateAgentOutput[]; consensus_posture: Posture; composite_score: number; final_recommendation: string };
  blocked_modules?: string[];
  errors?: string[];
}
