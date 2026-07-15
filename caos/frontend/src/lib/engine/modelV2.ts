/**
 * Exact JSON contracts for the canonical Model Engine v2 HTTP API.
 *
 * Keep these DTOs aligned with `server/model_engine_v2.py` and
 * `server/routes/model_v2.py`. Dates are ISO-8601 strings on the wire.
 */

export const MODEL_ENGINE_V2_VERSION = "2.0.0" as const;
export const MODEL_ENGINE_V2_SCHEMA_VERSION = 2 as const;

export type ModelV2AuthorityOrigin = "live" | "imported" | "analyst" | "reference";
export type ModelV2PeriodKind = "actual" | "forecast" | "ltm" | "pro_forma";
export type ModelV2OverrideValueType = "number" | "null";

export interface ModelV2Authority {
  origin: ModelV2AuthorityOrigin;
  method: string;
  source_ids: string[];
  as_of: string | null;
}

export interface ModelV2PeriodInput {
  period_key: string;
  label: string;
  kind: ModelV2PeriodKind;
  months: number;
  revenue: number | null;
  reported_ebitda: number | null;
  adjustments: number | null;
  adjusted_ebitda: number | null;
  cash: number | null;
  total_debt: number | null;
  net_debt: number | null;
  cash_interest: number | null;
  taxes: number | null;
  capex: number | null;
  working_capital_change: number | null;
  other_cash_flow: number | null;
  authority: ModelV2Authority;
}

export interface ModelV2DebtPeriod {
  period_key: string;
  opening_balance: number | null;
  closing_balance: number | null;
  draws: number | null;
  repayments: number | null;
  scheduled_amortization: number | null;
  commitment: number | null;
  benchmark_rate: number | null;
  floor_rate: number | null;
  spread_rate: number | null;
  coupon_rate: number | null;
  commitment_fee_rate: number | null;
  pik_rate: number | null;
  cash_fees: number | null;
  hedge_effect: number | null;
  fx_rate: number | null;
}

export interface ModelV2DebtInstrument {
  instrument_id: string;
  name: string;
  priority: number;
  seniority: string;
  currency: string;
  rate_type: "floating" | "fixed" | "hybrid" | null;
  maturity: string | null;
  amortization: string | null;
  benchmark_curve: string | null;
  periods: ModelV2DebtPeriod[];
  sources: string[];
  authority: ModelV2Authority;
}

export interface ModelV2CellOverride {
  node_id: string;
  value_type: ModelV2OverrideValueType;
  value: number | null;
  reason: string | null;
  scope: string;
  source: string | null;
  expires_at: string | null;
}

export interface ModelV2UiPreferences {
  show_quarters: boolean;
  show_assumptions: boolean;
  show_scenarios: boolean;
  warn_on_unsaved_leave: boolean;
  collapsed_rows: string[];
}

export interface ModelV2DraftPayload {
  schema_version: typeof MODEL_ENGINE_V2_SCHEMA_VERSION;
  reporting_currency: string;
  reporting_unit: string;
  periods: ModelV2PeriodInput[];
  debt_instruments: ModelV2DebtInstrument[];
  overrides: ModelV2CellOverride[];
  ui_preferences: ModelV2UiPreferences;
  source_ids: string[];
}

export interface ModelV2Node {
  node_id: string;
  value: number | null;
  original_value: number | null;
  formula: string | null;
  overridden: boolean;
  override_reason: string | null;
}

export interface ModelV2DebtInstrumentCalculation {
  instrument_id: string;
  period_key: string;
  opening_balance: number | null;
  closing_balance: number | null;
  average_balance: number | null;
  expected_closing_balance: number | null;
  rollforward_residual: number | null;
  benchmark_interest: number | null;
  margin_interest: number | null;
  coupon_interest: number | null;
  fees: number | null;
  pik_interest: number | null;
  hedge_effect: number | null;
  fx_effect: number | null;
  cash_interest: number | null;
  debt_reporting_currency: number | null;
}

export interface ModelV2PeriodCalculation {
  period_key: string;
  label: string;
  kind: ModelV2PeriodKind;
  revenue: number | null;
  reported_ebitda: number | null;
  adjustments: number | null;
  adjusted_ebitda: number | null;
  cash_interest: number | null;
  total_debt: number | null;
  cash: number | null;
  net_debt: number | null;
  gross_leverage: number | null;
  net_leverage: number | null;
  interest_coverage: number | null;
  free_cash_flow: number | null;
  instruments: ModelV2DebtInstrumentCalculation[];
  nodes: ModelV2Node[];
}

export interface ModelV2Calculation {
  engine_version: typeof MODEL_ENGINE_V2_VERSION;
  schema_version: typeof MODEL_ENGINE_V2_SCHEMA_VERSION;
  status: "ready" | "partial" | "insufficient_inputs";
  source_fingerprint: string;
  input_fingerprint: string;
  calculation_hash: string;
  periods: ModelV2PeriodCalculation[];
  gaps: string[];
  warnings: string[];
}

export interface ModelV2DraftRecord {
  id: string;
  issuer_id: string;
  analyst_id: string;
  context_id: string | null;
  source_run_id: string | null;
  payload: ModelV2DraftPayload;
  calculation: ModelV2Calculation;
  source_fingerprint: string;
  input_fingerprint: string;
  engine_version: string;
  calculation_hash: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface ModelV2ReadResponse {
  authority: "model-engine-v2";
  record: ModelV2DraftRecord | null;
  suggested_payload: ModelV2DraftPayload | null;
  suggested_calculation: ModelV2Calculation | null;
  suggested_source_run_id: string | null;
  /** Fresh server evaluation when the persisted calculation no longer matches its payload. */
  current_calculation: ModelV2Calculation | null;
  /** True until the analyst explicitly saves a fresh calculation for the persisted revision. */
  requires_recalculation: boolean;
  availability: "saved" | "suggested" | "unavailable" | "insufficient_source";
  detail: string | null;
}

export interface ModelV2CalculateRequest {
  payload: ModelV2DraftPayload;
  context_id?: string | null;
  source_run_id?: string | null;
}

export interface ModelV2SaveRequest extends ModelV2CalculateRequest {
  expected_revision: number;
}

export type ModelV2OverrideMutationRequest =
  | {
      expected_revision: number;
      action: "set";
      override: ModelV2CellOverride;
      node_id?: never;
    }
  | {
      expected_revision: number;
      action: "reset";
      override?: never;
      node_id: string;
    };

export type ModelV2OverrideBatchMutation =
  | {
      action: "set";
      override: ModelV2CellOverride;
      node_id?: never;
    }
  | {
      action: "reset";
      override?: never;
      node_id: string;
    };

export interface ModelV2OverrideBatchRequest {
  expected_revision: number;
  mutations: ModelV2OverrideBatchMutation[];
}

export interface ModelV2OverrideReplayRequest {
  expected_revision: number;
  mode: "undo" | "redo";
}

export type ModelV2OverrideSnapshot =
  | ModelV2CellOverride
  | { calculation_hash: string };

export interface ModelV2OverrideEvent {
  id: string;
  draft_id: string;
  action:
    | "set"
    | "reset"
    | "undo"
    | "redo"
    | "restore"
    | "import_set"
    | "import_reset";
  node_id: string;
  value_type: ModelV2OverrideValueType;
  before_value: ModelV2OverrideSnapshot | null;
  after_value: ModelV2OverrideSnapshot | null;
  original_formula: string | null;
  original_value: { value: number | null } | null;
  reason: string | null;
  scope: string;
  source: string | null;
  actor_id: string;
  expires_at: string | null;
  revision: number;
  inverse_event_id: string | null;
  created_at: string;
}

export interface ModelV2CheckpointCreateRequest {
  context_id: string;
  label?: string;
  issuer_run_id?: string | null;
  parent_checkpoint_id?: string | null;
  expected_revision: number;
  calculation_hash: string;
}

export interface ModelV2CheckpointRestoreRequest {
  expected_revision: number;
}

export interface ModelV2Checkpoint {
  id: string;
  issuer_id: string;
  context_id: string;
  issuer_run_id: string | null;
  parent_checkpoint_id: string | null;
  label: string;
  payload_hash: string;
  engine_version: string;
  source_fingerprint: string;
  input_fingerprint: string;
  calculation_hash: string;
  draft_revision: number;
  created_at: string;
}

export interface ModelV2WorkbookIssue {
  severity: "blocking" | "warning";
  code: string;
  message: string;
  sheet: string | null;
  cell: string | null;
  field: string | null;
}

export interface ModelV2WorkbookMappingAmbiguity {
  table: "assumptions" | "debt_schedule" | "overrides";
  field: string;
  selector: "column" | "row";
  candidates: string[];
  message: string;
}

export interface ModelV2WorkbookFormulaAuditEntry {
  sheet: string;
  cell: string;
  formula: string;
  cached_value: number | null;
  disposition: "input_candidate" | "comparison_only" | "unused";
  blocking_codes: string[];
}

export interface ModelV2WorkbookEmbeddedHashes {
  engine_version: string | null;
  source_fingerprint: string | null;
  input_fingerprint: string | null;
  calculation_hash: string | null;
}

export interface ModelV2WorkbookIdentity {
  issuer_id: string;
  draft_revision: number;
  exported_by: string;
  exported_at: string;
}

export interface ModelV2WorkbookTableMapping {
  layout?: "records";
  sheet: string;
  header_row: number;
  columns: Record<string, string>;
  /** One-based selections used only to resolve reviewed duplicate headers. */
  column_indices?: Record<string, number>;
}

export interface ModelV2WorkbookMatrixMapping {
  layout: "account_period_matrix";
  sheet: string;
  header_row: number;
  account_column: string;
  account_column_index?: number | null;
  account_rows: Record<string, string>;
  account_row_indices?: Record<string, number>;
  /** Stable CAOS period key (aliases normalize in preview) -> physical header. */
  period_columns: Record<string, string>;
  period_column_indices?: Record<string, number>;
  period_labels?: Record<string, string>;
  period_kinds: Record<string, "actual" | "forecast" | "ltm" | "pro_forma">;
  period_months?: Record<string, number>;
}

export interface ModelV2LegacyWorkbookMapping {
  mode: "mapped_legacy";
  assumptions: ModelV2WorkbookTableMapping | ModelV2WorkbookMatrixMapping;
  debt_schedule: ModelV2WorkbookTableMapping | null;
  overrides: ModelV2WorkbookTableMapping | null;
  reporting_currency: string;
  reporting_unit: string;
  source_ids: string[];
  authority_as_of: string | null;
}

export interface ModelV2WorkbookPreview {
  mode: "strict_v1" | "mapped_legacy";
  workbook_sha256: string;
  sheet_names: string[];
  mapping: ModelV2LegacyWorkbookMapping | null;
  draft_payload: ModelV2DraftPayload | null;
  calculation: ModelV2Calculation | null;
  identity: ModelV2WorkbookIdentity | null;
  embedded_hashes: ModelV2WorkbookEmbeddedHashes;
  formula_audit: ModelV2WorkbookFormulaAuditEntry[];
  ambiguities: ModelV2WorkbookMappingAmbiguity[];
  issues: ModelV2WorkbookIssue[];
  blocking_count: number;
  warning_count: number;
  preview_token: string | null;
  expected_revision: number;
}

export interface ModelV2WorkbookCommit {
  existing: boolean;
  import_id: string;
  document_id: string;
  source_manifest_id: string;
  workbook_sha256: string;
  import_fingerprint: string;
  committed_revision: number;
  calculation_hash: string;
  record: ModelV2DraftRecord;
}

export interface ModelV2WorkbookExport {
  blob: Blob;
  filename: string;
  revision: number | null;
}
