"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { EnterprisePage, type PageAction } from "@/components/shared/EnterprisePage";
import { Panel } from "@/components/shared/Panel";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { CompletionStateSummary } from "@/components/shared/CompletionStateSummary";
import { useNavigationGuard } from "@/components/shared/NavigationGuardProvider";
import { ScenarioNetworkPanel } from "@/components/model/ScenarioNetworkPanel";
import { Button } from "@/components/ui/Button";
import {
  calculateModelV2,
  commitModelV2Workbook,
  createModelV2Checkpoint,
  exportModelV2Workbook,
  getAnalystSettings,
  getModelV2,
  getModelV2Checkpoints,
  getModelV2History,
  mutateModelV2OverridesBatch,
  previewModelV2Workbook,
  replayModelV2Override,
  restoreModelV2Checkpoint,
  saveModelV2,
  toErrorMessage,
} from "@/lib/api";
import type {
  ModelV2Authority,
  ModelV2Calculation,
  ModelV2CellOverride,
  ModelV2Checkpoint,
  ModelV2DraftPayload,
  ModelV2DraftRecord,
  ModelV2Node,
  ModelV2OverrideBatchMutation,
  ModelV2OverrideEvent,
  ModelV2OverrideSnapshot,
  ModelV2PeriodCalculation,
  ModelV2ReadResponse,
  ModelV2LegacyWorkbookMapping,
  ModelV2WorkbookMappingAmbiguity,
  ModelV2WorkbookPreview,
} from "@/lib/engine/modelV2";
import { readWarnOnUnsavedLeave } from "@/lib/model-builder-preferences";
import { fmtLocalDateTime } from "@/lib/format-date";

type PendingMutations = Record<string, ModelV2OverrideBatchMutation>;
interface PendingPreview {
  calculation: ModelV2Calculation;
  pendingFingerprint: string;
}
interface ScenarioPreview {
  baseline: ModelV2Calculation;
  calculation: ModelV2Calculation;
  pendingFingerprint: string;
  nodeId: string;
  value: number;
}
type BusyAction =
  | "save-suggestion"
  | "recalculate"
  | "preview"
  | "scenario-preview"
  | "commit"
  | "history"
  | "checkpoint"
  | "restore"
  | "export"
  | "import-preview"
  | "import-commit"
  | null;

interface ModelV2WorkbenchProps {
  issuerId: string;
  contextId: string | null;
  exactRunId?: string | null;
  initialResponse: ModelV2ReadResponse;
}

interface DisplayNode extends ModelV2Node {
  period_key: string;
  period_label: string;
  period_kind: string;
}

interface NodeOrigin {
  label: "LIVE" | "DERIVED" | "REFERENCE" | "ANALYST" | "IMPORTED" | "UNAVAILABLE";
  glyph: "●" | "ƒ" | "◇" | "△" | "↧" | "○";
  title: string;
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ORIGINAL_HISTORY_ACTIONS = new Set<ModelV2OverrideEvent["action"]>([
  "set",
  "reset",
  "import_set",
  "import_reset",
]);
const DERIVED_DEBT_FIELDS = new Set([
  "opening_balance",
  "closing_balance",
  "average_balance",
  "expected_closing_balance",
  "rollforward_residual",
  "benchmark_interest",
  "margin_interest",
  "coupon_interest",
  "fees",
  "pik_interest",
  "fx_effect",
  "cash_interest",
  "debt_reporting_currency",
]);
const SCENARIO_DECISION_FIELDS = [
  ["adjusted_ebitda", "Adjusted EBITDA"],
  ["total_debt", "Total debt"],
  ["net_debt", "Net debt"],
  ["cash_interest", "Cash interest"],
  ["gross_leverage", "Gross leverage"],
  ["net_leverage", "Net leverage"],
  ["interest_coverage", "Interest coverage"],
  ["free_cash_flow", "Free cash flow"],
] as const satisfies ReadonlyArray<readonly [keyof ModelV2PeriodCalculation, string]>;
const NODE_PAGE_SIZE = 100;
const NODE_PICKER_LIMIT = 200;

const CLOSE_FORMAT_MAPPING_TEMPLATE: ModelV2LegacyWorkbookMapping = {
  mode: "mapped_legacy",
  assumptions: {
    layout: "records",
    sheet: "Model",
    header_row: 1,
    columns: {
      period_key: "Period Key",
      label: "Label",
      kind: "Kind",
      months: "Months",
      revenue: "Revenue",
      reported_ebitda: "Reported EBITDA",
      adjusted_ebitda: "Adjusted EBITDA",
      cash: "Cash",
      total_debt: "Total Debt",
      cash_interest: "Cash Interest",
    },
  },
  debt_schedule: null,
  overrides: null,
  reporting_currency: "",
  reporting_unit: "",
  source_ids: [],
  authority_as_of: null,
};

const MATRIX_MAPPING_TEMPLATE: ModelV2LegacyWorkbookMapping = {
  mode: "mapped_legacy",
  assumptions: {
    layout: "account_period_matrix",
    sheet: "Model",
    header_row: 1,
    account_column: "Account",
    account_rows: {
      revenue: "Revenue",
      adjusted_ebitda: "Adjusted EBITDA",
      cash: "Cash",
      total_debt: "Total Debt",
      cash_interest: "Cash Interest",
    },
    period_columns: {
      FY2026: "FY26E",
      FY2027: "FY27E",
    },
    period_labels: {
      FY2026: "FY26e",
      FY2027: "FY27e",
    },
    period_kinds: {
      FY2026: "forecast",
      FY2027: "forecast",
    },
  },
  debt_schedule: null,
  overrides: null,
  reporting_currency: "",
  reporting_unit: "",
  source_ids: [],
  authority_as_of: null,
};

function parseLegacyMapping(value: string): ModelV2LegacyWorkbookMapping | null {
  if (!value.trim()) return null;
  const parsed: unknown = JSON.parse(value);
  if (
    typeof parsed !== "object"
    || parsed === null
    || !("mode" in parsed)
    || parsed.mode !== "mapped_legacy"
  ) {
    throw new Error('Close-format mapping must be a JSON object with mode "mapped_legacy".');
  }
  const mapping = parsed as Partial<ModelV2LegacyWorkbookMapping>;
  if (
    typeof mapping.reporting_currency !== "string"
    || !mapping.reporting_currency.trim()
    || typeof mapping.reporting_unit !== "string"
    || !mapping.reporting_unit.trim()
  ) {
    throw new Error(
      "Close-format mapping requires an explicit reporting_currency and reporting_unit; CAOS will not infer USD or millions.",
    );
  }
  return mapping as ModelV2LegacyWorkbookMapping;
}

function ambiguityColumn(candidate: string): number | null {
  const match = candidate.match(/\((\d+)\)\s*$/);
  if (!match) return null;
  const column = Number(match[1]);
  return Number.isInteger(column) && column > 0 ? column : null;
}

function requiresOverrideReason(nodeId: string): boolean {
  const parts = nodeId.split(":");
  return parts[0] === "calc"
    || (parts[0] === "debt" && DERIVED_DEBT_FIELDS.has(parts.at(-1) ?? ""));
}

function scenarioPeriodKey(nodeId: string): string | null {
  const parts = nodeId.split(":");
  if (parts[0] === "input" || parts[0] === "calc") return parts[1] || null;
  if (parts[0] === "debt") return parts[2] || null;
  return null;
}

function toDateTimeLocal(value: string | null | undefined): string {
  const parsed = value ? new Date(value) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);
  if (!Number.isFinite(parsed.getTime())) return "";
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function futureIso(value: string): string | null {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.getTime() > Date.now()
    ? parsed.toISOString()
    : null;
}

/** Build only the request payload. All financial calculation remains server-side. */
export function payloadWithPendingMutations(
  payload: ModelV2DraftPayload,
  pending: PendingMutations,
): ModelV2DraftPayload {
  const overrides = new Map(payload.overrides.map((item) => [item.node_id, item]));
  for (const mutation of Object.values(pending)) {
    if (mutation.action === "set") overrides.set(mutation.override.node_id, mutation.override);
    else overrides.delete(mutation.node_id);
  }
  return {
    ...payload,
    overrides: Array.from(overrides.values()).sort((left, right) =>
      left.node_id.localeCompare(right.node_id),
    ),
  };
}

function flattenNodes(calculation: ModelV2Calculation | null): DisplayNode[] {
  if (!calculation) return [];
  return calculation.periods.flatMap((period) => period.nodes.map((node) => ({
    ...node,
    period_key: period.period_key,
    period_label: period.label,
    period_kind: period.kind,
  })));
}

function authorityOrigin(authority: ModelV2Authority | undefined): NodeOrigin {
  if (!authority) {
    return { label: "UNAVAILABLE", glyph: "○", title: "No authority is attached to this input." };
  }
  if (authority.origin === "analyst") {
    return { label: "ANALYST", glyph: "△", title: authority.method || "Analyst-authored input." };
  }
  if (authority.origin === "reference") {
    return { label: "REFERENCE", glyph: "◇", title: authority.method || "Reference input." };
  }
  if (authority.source_ids.length === 0) {
    return {
      label: "UNAVAILABLE",
      glyph: "○",
      title: `${authority.origin.toUpperCase()} authority has no persisted source identifier.`,
    };
  }
  if (authority.origin === "imported") {
    return { label: "IMPORTED", glyph: "↧", title: authority.method || "Imported source input." };
  }
  return { label: "LIVE", glyph: "●", title: authority.method || "Live persisted source input." };
}

function nodeOrigin(
  node: DisplayNode,
  payload: ModelV2DraftPayload | null,
  mutation: ModelV2OverrideBatchMutation | undefined,
): NodeOrigin {
  if (mutation?.action === "set" || (!mutation && node.overridden)) {
    return { label: "ANALYST", glyph: "△", title: "Analyst override." };
  }
  if (node.value == null) {
    return { label: "UNAVAILABLE", glyph: "○", title: "No calculated value is available." };
  }
  if (node.formula) {
    return { label: "DERIVED", glyph: "ƒ", title: `Formula-derived: ${node.formula}` };
  }
  if (!payload) return authorityOrigin(undefined);

  const parts = node.node_id.split(":");
  if (parts[0] === "input") {
    return authorityOrigin(payload.periods.find((period) => period.period_key === parts[1])?.authority);
  }
  if (parts[0] === "debt") {
    return authorityOrigin(payload.debt_instruments.find((instrument) => instrument.instrument_id === parts[1])?.authority);
  }
  return authorityOrigin(undefined);
}

function originClassName(origin: NodeOrigin["label"]): string {
  if (origin === "LIVE") return "text-caos-success";
  if (origin === "ANALYST") return "text-caos-accent";
  if (origin === "UNAVAILABLE") return "text-caos-muted";
  return "text-caos-text";
}

function formatValue(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatOverrideSnapshot(snapshot: ModelV2OverrideSnapshot | null): string {
  if (!snapshot) return "—";
  if ("calculation_hash" in snapshot) return `HASH ${snapshot.calculation_hash.slice(0, 12)}`;
  return snapshot.value_type === "null" ? "NULL" : formatValue(snapshot.value);
}

function formatAuditTime(value: string): string {
  const formatted = fmtLocalDateTime(value);
  return formatted === "—" ? value : formatted;
}

function scenarioNodeLabel(node: DisplayNode): string {
  const parts = node.node_id.split(":");
  return `${node.period_label} · ${parts.at(-1) ?? node.node_id} · ${parts[0]?.toUpperCase() ?? "NODE"}`;
}

function mutationLabel(mutation: ModelV2OverrideBatchMutation | undefined): string | null {
  if (!mutation) return null;
  if (mutation.action === "reset") return "RESTORE PENDING";
  return mutation.override.value_type === "null"
    ? "NULL PENDING"
    : `${formatValue(mutation.override.value)} PENDING`;
}

function fingerprintPendingMutations(pending: PendingMutations): string {
  return JSON.stringify(
    Object.entries(pending).sort(([left], [right]) => left.localeCompare(right)),
  );
}

interface ReplayCandidate {
  key: string;
  eventId: string;
}

function removeReplayCandidate(
  stack: ReplayCandidate[],
  key: string,
): ReplayCandidate | null {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index].key !== key) continue;
    return stack.splice(index, 1)[0] ?? null;
  }
  return null;
}

type ReplayGroup =
  | { kind: "original"; candidate: ReplayCandidate }
  | { kind: "inverse"; mode: "undo" | "redo"; candidate: ReplayCandidate }
  | { kind: "invalid" };

function replayGroup(
  revision: number,
  events: ModelV2OverrideEvent[],
  originalRevisionByEventId: Map<string, number>,
): ReplayGroup {
  if (events.every((event) => ORIGINAL_HISTORY_ACTIONS.has(event.action))) {
    const eventId = events.map((event) => event.id).sort()[0];
    return eventId
      ? { kind: "original", candidate: { key: `revision:${revision}`, eventId } }
      : { kind: "invalid" };
  }
  const mode = events.every((event) => event.action === "undo")
    ? "undo"
    : events.every((event) => event.action === "redo") ? "redo" : null;
  const inverseEventIds = events
    .map((event) => event.inverse_event_id)
    .filter((eventId): eventId is string => eventId !== null)
    .sort();
  if (!mode || inverseEventIds.length !== events.length) return { kind: "invalid" };
  const originalRevisions = new Set(
    inverseEventIds
      .map((eventId) => originalRevisionByEventId.get(eventId))
      .filter((value): value is number => value !== undefined),
  );
  if (originalRevisions.size > 1) return { kind: "invalid" };
  const originalRevision = originalRevisions.values().next().value as number | undefined;
  return {
    kind: "inverse",
    mode,
    candidate: {
      key: originalRevision === undefined
        ? `events:${inverseEventIds.join("|")}`
        : `revision:${originalRevision}`,
      eventId: inverseEventIds[0],
    },
  };
}

function applyInverseReplay(
  group: Extract<ReplayGroup, { kind: "inverse" }>,
  undoStack: ReplayCandidate[],
  redoStack: ReplayCandidate[],
) {
  const source = group.mode === "undo" ? undoStack : redoStack;
  const target = group.mode === "undo" ? redoStack : undoStack;
  const prior = removeReplayCandidate(source, group.candidate.key) ?? group.candidate;
  removeReplayCandidate(target, group.candidate.key);
  target.push(prior);
}

function deriveHistoryReplayCandidates(history: ModelV2OverrideEvent[]): {
  undoEventId: string | null;
  redoEventId: string | null;
} {
  const eventsByRevision = new Map<number, ModelV2OverrideEvent[]>();
  const originalRevisionByEventId = new Map<string, number>();
  for (const event of history) {
    const group = eventsByRevision.get(event.revision) ?? [];
    group.push(event);
    eventsByRevision.set(event.revision, group);
    if (ORIGINAL_HISTORY_ACTIONS.has(event.action)) {
      originalRevisionByEventId.set(event.id, event.revision);
    }
  }

  const undoStack: ReplayCandidate[] = [];
  const redoStack: ReplayCandidate[] = [];
  const orderedGroups = Array.from(eventsByRevision.entries())
    .sort(([left], [right]) => left - right);

  for (const [revision, events] of orderedGroups) {
    const group = replayGroup(revision, events, originalRevisionByEventId);
    if (group.kind === "original") {
      undoStack.push(group.candidate);
      redoStack.length = 0;
      continue;
    }
    if (group.kind === "invalid") {
      undoStack.length = 0;
      redoStack.length = 0;
      continue;
    }
    applyInverseReplay(group, undoStack, redoStack);
  }

  return {
    undoEventId: undoStack.at(-1)?.eventId ?? null,
    redoEventId: redoStack.at(-1)?.eventId ?? null,
  };
}

type AmbiguityResolution =
  | { mapping: ModelV2LegacyWorkbookMapping; error: null }
  | { mapping: null; error: string };

function applyAmbiguityResolution(
  mapping: ModelV2LegacyWorkbookMapping,
  ambiguity: ModelV2WorkbookMappingAmbiguity,
  column: number | null,
): AmbiguityResolution {
  const table = mapping[ambiguity.table];
  if (!table || column === null) return { mapping: null, error: "The selected duplicate header could not be bound to this mapping." };
  if (ambiguity.table === "assumptions" && table.layout === "account_period_matrix") {
    const selectorUpdate = ambiguity.selector === "row"
      ? { account_row_indices: { ...(table.account_row_indices ?? {}), [ambiguity.field]: column } }
      : ambiguity.field === "account_column"
        ? { account_column_index: column }
        : { period_column_indices: { ...(table.period_column_indices ?? {}), [ambiguity.field]: column } };
    return { mapping: { ...mapping, assumptions: { ...table, ...selectorUpdate } }, error: null };
  }
  if ("columns" in table) {
    return {
      mapping: {
        ...mapping,
        [ambiguity.table]: {
          ...table,
          column_indices: { ...(table.column_indices ?? {}), [ambiguity.field]: column },
        },
      },
      error: null,
    };
  }
  return { mapping: null, error: "The selected ambiguity does not match this mapping layout." };
}

interface WorkbookImportViewState {
  busy: BusyAction;
  dirty: boolean;
  importConfirmed: boolean;
  importMapping: ModelV2LegacyWorkbookMapping | null;
  importMappingText: string;
  importPreview: ModelV2WorkbookPreview | null;
  commitImport: () => Promise<void>;
  previewImport: () => Promise<void>;
  resolveAmbiguity: (ambiguity: ModelV2WorkbookMappingAmbiguity, candidate: string) => void;
  selectImportFile: (file: File | null) => void;
  setCloseFormatTemplate: () => void;
  setImportConfirmed: (confirmed: boolean) => void;
  setMatrixTemplate: () => void;
  updateMappingText: (value: string) => void;
  hasImportFile: boolean;
}

function selectedAmbiguitySource(state: WorkbookImportViewState, ambiguity: ModelV2WorkbookMappingAmbiguity) {
  const table = state.importMapping?.[ambiguity.table];
  if (table && "columns" in table) return table.column_indices?.[ambiguity.field];
  if (table?.layout !== "account_period_matrix") return undefined;
  if (ambiguity.selector === "row") return table.account_row_indices?.[ambiguity.field];
  return ambiguity.field === "account_column" ? table.account_column_index : table.period_column_indices?.[ambiguity.field];
}

function WorkbookAmbiguityField({ ambiguity, state }: { ambiguity: ModelV2WorkbookMappingAmbiguity; state: WorkbookImportViewState }) {
  const selectedSource = selectedAmbiguitySource(state, ambiguity);
  const chooseCandidate = (column: number) => {
    const candidate = ambiguity.candidates.find((item) => ambiguityColumn(item) === column);
    if (candidate) state.resolveAmbiguity(ambiguity, candidate);
  };
  return (
    <label className="grid gap-1 text-caos-xs text-caos-text sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] sm:items-center">
      <span>{ambiguity.table} · {ambiguity.field}</span>
      <select aria-label={`Source ${ambiguity.selector} for ${ambiguity.table} ${ambiguity.field}`} value={selectedSource ? String(selectedSource) : ""} onChange={(event) => chooseCandidate(Number(event.target.value))} className="h-8 rounded border border-caos-border bg-caos-bg px-2 text-caos-text focus-ring">
        <option value="">Select reviewed {ambiguity.selector}</option>
        {ambiguity.candidates.map((candidate) => { const column = ambiguityColumn(candidate); return column === null ? null : <option key={candidate} value={column}>{candidate}</option>; })}
      </select>
    </label>
  );
}

function WorkbookAmbiguities({ state }: { state: WorkbookImportViewState }) {
  const ambiguities = state.importPreview?.ambiguities ?? [];
  if (!ambiguities.length) return null;
  return (
    <fieldset className="space-y-2 rounded border border-caos-warning/60 p-2">
      <legend className="px-1 text-caos-2xs uppercase tracking-wider text-caos-warning">Duplicate rows or columns · analyst selection required</legend>
      {ambiguities.map((ambiguity) => <WorkbookAmbiguityField key={`${ambiguity.table}-${ambiguity.field}-${ambiguity.selector}`} ambiguity={ambiguity} state={state} />)}
      <p className="text-caos-muted">Re-preview after resolving every duplicate row or column. Commit remains disabled until the server validates the exact mapping.</p>
    </fieldset>
  );
}

function workbookCommitReason(state: WorkbookImportViewState) {
  const preview = state.importPreview;
  if (!preview) return "Preview the workbook first";
  if (preview.blocking_count > 0) return "Resolve blocking validation issues first";
  if (preview.ambiguities.length > 0) return "Resolve duplicate row or column selections first";
  if (!preview.preview_token) return "Re-preview the workbook to get a valid preview token";
  if (!state.importConfirmed) return "Confirm the review checkbox first";
  if (state.busy !== null) return "An action is already in progress";
  return null;
}

function WorkbookPreview({ state }: { state: WorkbookImportViewState }) {
  const preview = state.importPreview;
  if (!preview) return null;
  return (
    <div className="space-y-2 rounded border border-caos-border bg-caos-bg/50 p-2 text-caos-xs">
      <p className="tabular text-caos-text">{preview.mode} · {preview.sheet_names.length} sheets · {preview.warning_count} warnings · {preview.blocking_count} blocking</p>
      <p className="text-caos-muted">{preview.formula_audit.length} formulas audited · calculation {preview.calculation?.status ?? "unavailable"}</p>
      <WorkbookAmbiguities state={state} />
      {preview.issues.length ? (
        <ul className="max-h-28 space-y-1 overflow-auto" aria-label="Model workbook validation issues">
          {preview.issues.slice(0, 20).map((issue, index) => <li key={`${issue.code}-${issue.sheet ?? "all"}-${issue.cell ?? index}`} className={issue.severity === "blocking" ? "text-caos-critical" : "text-caos-warning"}>{issue.severity === "blocking" ? "BLOCK" : "WARN"} · {issue.message}</li>)}
        </ul>
      ) : <p className="text-caos-success">No validation issues.</p>}
      <label className="flex items-start gap-2 text-caos-xs text-caos-text">
        <input type="checkbox" name="confirm-workbook-import" autoComplete="off" checked={state.importConfirmed} onChange={(event) => state.setImportConfirmed(event.target.checked)} disabled={preview.blocking_count > 0 || preview.ambiguities.length > 0 || !preview.preview_token} className="mt-0.5 focus-ring" />
        I reviewed this preview and confirm creating or replacing the canonical model revision.
      </label>
      <Button variant="primary" onClick={() => void state.commitImport()} reason={workbookCommitReason(state)}>{state.busy === "import-commit" ? "Committing…" : "Commit workbook import"}</Button>
    </div>
  );
}

function WorkbookMappingControls({ state }: { state: WorkbookImportViewState }) {
  return (
    <div className="rounded border border-caos-border bg-caos-bg/40 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-caos-xs text-caos-muted">Canonical CAOS exports need no mapping. For a close-format workbook, provide reviewed column bindings.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={state.setCloseFormatTemplate} reason={state.busy !== null ? "An action is already in progress" : null}>Use row-record template</Button>
          <Button variant="secondary" onClick={state.setMatrixTemplate} reason={state.busy !== null ? "An action is already in progress" : null}>Use account matrix template</Button>
        </div>
      </div>
      <label className="mt-2 block text-caos-xs text-caos-text">
        Close-format mapping JSON · currency and unit required when used
        <textarea value={state.importMappingText} onChange={(event) => state.updateMappingText(event.target.value)} rows={state.importMappingText ? 10 : 3} spellCheck={false} placeholder='{"mode":"mapped_legacy","mapping":{}}…' className="mt-1 block w-full resize-y rounded border border-caos-border bg-caos-bg p-2 font-mono text-caos-2xs text-caos-text focus-ring" />
      </label>
    </div>
  );
}

function WorkbookImportPanel({ state }: { state: WorkbookImportViewState }) {
  const previewReason = !state.hasImportFile ? "Select a workbook file first" : state.dirty ? "Discard or save local pending edits first" : state.busy !== null ? "An action is already in progress" : null;
  return (
    <Panel title="Workbook import" right={<span className="text-caos-2xs text-caos-muted">.xlsx · preview first</span>}>
      <div className="space-y-3 p-3">
        <p className="text-caos-xs leading-relaxed text-caos-muted">Preview is read-only. Commit revalidates the same bytes and atomically creates or replaces the canonical model revision.</p>
        <label className="block text-caos-xs text-caos-text">Model workbook<input type="file" name="model-workbook" autoComplete="off" accept={`.xlsx,${XLSX_MIME}`} onChange={(event) => state.selectImportFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-caos-xs text-caos-muted file:mr-2 file:rounded file:border file:border-caos-border file:bg-caos-elevated file:px-2 file:py-1 file:text-caos-text" /></label>
        <WorkbookMappingControls state={state} />
        <Button variant="secondary" onClick={() => void state.previewImport()} reason={previewReason}>{state.busy === "import-preview" ? "Validating…" : "Preview workbook"}</Button>
        <WorkbookPreview state={state} />
      </div>
    </Panel>
  );
}

interface WorkbookImportControllerArgs {
  issuerId: string;
  record: ModelV2DraftRecord | null;
  dirty: boolean;
  busy: BusyAction;
  setBusy: (action: BusyAction) => void;
  setError: (message: string | null) => void;
  setNotice: (message: string | null) => void;
  adoptRecord: (next: ModelV2DraftRecord, message: string) => void;
  refreshArtifacts: () => Promise<void>;
}

function useWorkbookImportController(args: WorkbookImportControllerArgs): WorkbookImportViewState {
  const { adoptRecord, busy, dirty, issuerId, record, refreshArtifacts, setBusy, setError, setNotice } = args;
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ModelV2WorkbookPreview | null>(null);
  const [importConfirmed, setImportConfirmed] = useState(false);
  const [importMappingText, setImportMappingText] = useState("");
  const [importMapping, setImportMapping] = useState<ModelV2LegacyWorkbookMapping | null>(null);

  const previewImport = async () => {
    if (!importFile || dirty || busy) return;
    let mapping: ModelV2LegacyWorkbookMapping | null;
    try {
      mapping = parseLegacyMapping(importMappingText);
    } catch (reason) {
      setImportPreview(null); setImportConfirmed(false); setImportMapping(null);
      setError(toErrorMessage(reason, "Close-format mapping JSON is invalid."));
      return;
    }
    setBusy("import-preview"); setError(null); setImportConfirmed(false);
    try {
      const next = await previewModelV2Workbook({ issuerId, file: importFile, expectedRevision: record?.revision ?? 0, ...(mapping ? { mapping } : {}) });
      const reviewedMapping = next.mapping ?? mapping;
      setImportPreview(next); setImportMapping(reviewedMapping);
      if (reviewedMapping) setImportMappingText(JSON.stringify(reviewedMapping, null, 2));
      setNotice("Workbook preview completed without writing model state.");
    } catch (reason) {
      setImportPreview(null); setError(toErrorMessage(reason, "Model workbook preview failed."));
    } finally {
      setBusy(null);
    }
  };

  const commitImport = async () => {
    if (!importFile || !importPreview || !importConfirmed || !importPreview.preview_token || dirty || busy) return;
    setBusy("import-commit"); setError(null);
    try {
      const committed = await commitModelV2Workbook({ issuerId, file: importFile, preview: importPreview, ...(importMapping ? { mapping: importMapping } : {}) });
      adoptRecord(committed.record, `${committed.existing ? "Existing" : "New"} workbook import committed at revision ${committed.committed_revision}.`);
      setImportConfirmed(false); setImportPreview(null);
      await refreshArtifacts();
    } catch (reason) {
      setError(toErrorMessage(reason, "Model workbook commit failed. Preview again before retrying."));
    } finally {
      setBusy(null);
    }
  };

  const loadTemplate = (next: ModelV2LegacyWorkbookMapping, message: string) => {
    setImportMapping(next); setImportMappingText(JSON.stringify(next, null, 2));
    setImportPreview(null); setImportConfirmed(false); setError(null); setNotice(message);
  };
  const setCloseFormatTemplate = () => loadTemplate(
    structuredClone(CLOSE_FORMAT_MAPPING_TEMPLATE),
    "Close-format mapping template loaded. Enter reporting currency and unit, then review sheet names and headers before previewing.",
  );
  const setMatrixTemplate = () => loadTemplate(
    structuredClone(MATRIX_MAPPING_TEMPLATE),
    "Account-row matrix template loaded. Enter reporting currency and unit, bind stable period keys, and review every row and column selector.",
  );
  const updateMappingText = (value: string) => {
    setImportMappingText(value); setImportMapping(null); setImportPreview(null); setImportConfirmed(false); setError(null);
  };
  const resolveAmbiguity = (ambiguity: ModelV2WorkbookMappingAmbiguity, candidate: string) => {
    const mapping = importMapping ?? parseLegacyMapping(importMappingText);
    if (!mapping) return;
    const resolution = applyAmbiguityResolution(mapping, ambiguity, ambiguityColumn(candidate));
    if (!resolution.mapping) { setError(resolution.error); return; }
    setImportMapping(resolution.mapping); setImportMappingText(JSON.stringify(resolution.mapping, null, 2));
    setImportConfirmed(false); setError(null);
    setNotice("Duplicate header selection recorded locally. Re-preview to validate the resolved mapping.");
  };
  const selectImportFile = (file: File | null) => {
    setImportFile(file); setImportPreview(null); setImportConfirmed(false); setError(null);
  };
  return {
    busy, commitImport, dirty, hasImportFile: Boolean(importFile), importConfirmed, importMapping,
    importMappingText, importPreview, previewImport, resolveAmbiguity, selectImportFile,
    setCloseFormatTemplate, setImportConfirmed, setMatrixTemplate, updateMappingText,
  };
}

interface ScenarioControllerArgs {
  issuerId: string;
  contextId: string | null;
  record: ModelV2DraftRecord | null;
  payload: ModelV2DraftPayload | null;
  nodes: DisplayNode[];
  pending: PendingMutations;
  pendingFingerprint: string;
  pendingGenerationRef: { current: number };
  requiresRecalculation: boolean;
  editorDirty: boolean;
  busy: BusyAction;
  setBusy: (action: BusyAction) => void;
  setError: (message: string | null) => void;
  setNotice: (message: string | null) => void;
}

function useScenarioController(args: ScenarioControllerArgs) {
  const {
    busy, contextId, editorDirty, issuerId, nodes, payload, pending, pendingFingerprint,
    pendingGenerationRef, record, requiresRecalculation, setBusy, setError, setNotice,
  } = args;
  const [scenarioNodeId, setScenarioNodeId] = useState("");
  const [scenarioNodeQuery, setScenarioNodeQuery] = useState("");
  const [scenarioValue, setScenarioValue] = useState("");
  const [scenarioPreview, setScenarioPreview] = useState<ScenarioPreview | null>(null);
  const [scenarioMode, setScenarioMode] = useState<"model" | "network">("model");
  const scenarioGenerationRef = useRef(0);
  const scenarioNodeOptions = useMemo(() => {
    const normalizedQuery = scenarioNodeQuery.trim().toLowerCase();
    const matches = nodes.filter((node) => (
      !normalizedQuery
      || node.node_id.toLowerCase().includes(normalizedQuery)
      || scenarioNodeLabel(node).toLowerCase().includes(normalizedQuery)
    ));
    const bounded = matches.slice(0, NODE_PICKER_LIMIT);
    const selected = nodes.find((node) => node.node_id === scenarioNodeId);
    return selected && !bounded.some((node) => node.node_id === selected.node_id)
      ? [selected, ...bounded.slice(0, NODE_PICKER_LIMIT - 1)]
      : bounded;
  }, [nodes, scenarioNodeId, scenarioNodeQuery]);
  const activeScenarioPreview = scenarioPreview?.pendingFingerprint === pendingFingerprint ? scenarioPreview : null;
  const scenarioResultNode = useMemo(
    () => flattenNodes(activeScenarioPreview?.calculation ?? null).find((node) => node.node_id === activeScenarioPreview?.nodeId) ?? null,
    [activeScenarioPreview],
  );
  const scenarioPeriod = scenarioPeriodKey(activeScenarioPreview?.nodeId ?? "");
  const scenarioBaselinePeriod = activeScenarioPreview?.baseline.periods.find((period) => period.period_key === scenarioPeriod) ?? null;
  const scenarioResultPeriod = activeScenarioPreview?.calculation.periods.find((period) => period.period_key === scenarioPeriod) ?? null;

  const resetScenario = () => {
    scenarioGenerationRef.current += 1;
    setScenarioNodeId(""); setScenarioNodeQuery(""); setScenarioValue(""); setScenarioPreview(null); setError(null);
    setNotice("Transient sensitivity reset. Manual pending overrides are unchanged.");
  };
  const previewScenario = async () => {
    const parsedValue = Number(scenarioValue);
    if (!record || !payload || requiresRecalculation || !scenarioNodeId || !scenarioValue.trim() || !Number.isFinite(parsedValue) || editorDirty || busy) return;
    const requestGeneration = ++scenarioGenerationRef.current;
    const requestPendingGeneration = pendingGenerationRef.current;
    const workingPayload = payloadWithPendingMutations(payload, pending);
    const scenarioPayload = payloadWithPendingMutations(workingPayload, {
      [scenarioNodeId]: { action: "set", override: { node_id: scenarioNodeId, value_type: "number", value: parsedValue, reason: "Transient sensitivity preview", scope: "scenario", source: "analyst-ui-scenario", expires_at: new Date(Date.now() + 60 * 60 * 1_000).toISOString() } },
    });
    setBusy("scenario-preview"); setError(null);
    try {
      const requestContext = { context_id: contextId ?? record.context_id, source_run_id: record.source_run_id };
      const [baseline, next] = await Promise.all([
        calculateModelV2(issuerId, { payload: workingPayload, ...requestContext }),
        calculateModelV2(issuerId, { payload: scenarioPayload, ...requestContext }),
      ]);
      if (scenarioGenerationRef.current !== requestGeneration || pendingGenerationRef.current !== requestPendingGeneration) {
        setScenarioPreview(null); setNotice("Working inputs changed while the sensitivity was running. Preview again."); return;
      }
      setScenarioPreview({ baseline, calculation: next, pendingFingerprint, nodeId: scenarioNodeId, value: parsedValue });
      setNotice("Transient sensitivity calculated on the server. It will not be committed.");
    } catch (reason) {
      setScenarioPreview(null); setError(toErrorMessage(reason, "Transient sensitivity could not be calculated."));
    } finally {
      setBusy(null);
    }
  };
  return {
    activeScenarioPreview, previewScenario, resetScenario, scenarioBaselinePeriod, scenarioGenerationRef,
    scenarioMode, scenarioNodeId, scenarioNodeOptions, scenarioNodeQuery, scenarioPreview, scenarioResultNode,
    scenarioResultPeriod, scenarioValue, setScenarioMode, setScenarioNodeId, setScenarioNodeQuery,
    setScenarioPreview, setScenarioValue,
  };
}

function activeOverrideMap(record: ModelV2DraftRecord | null, now: number) {
  return new Map(
    (record?.payload.overrides ?? [])
      .filter((item) => {
        if (!item.expires_at) return true;
        const expiresAt = Date.parse(item.expires_at);
        return Number.isFinite(expiresAt) && expiresAt > now;
      })
      .map((item) => [item.node_id, item]),
  );
}

function editorBaselineValue(node: DisplayNode | null, override: ModelV2CellOverride | undefined) {
  if (override?.value != null) return String(override.value);
  return node?.value != null ? String(node.value) : "";
}

function hasEditorChanges(
  node: DisplayNode | null,
  override: ModelV2CellOverride | undefined,
  draft: { value: string; isNull: boolean; reason: string; expiry: string; initialExpiry: string },
) {
  if (!node) return false;
  if (draft.isNull !== (override?.value_type === "null" || node.value == null)) return true;
  if (draft.value !== editorBaselineValue(node, override)) return true;
  if (draft.reason !== (override?.reason ?? node.override_reason ?? "")) return true;
  return requiresOverrideReason(node.node_id) && draft.expiry !== draft.initialExpiry;
}

function useEditorState(nodes: DisplayNode[], record: ModelV2DraftRecord | null, overrideNow: number) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [editorNull, setEditorNull] = useState(false);
  const [editorReason, setEditorReason] = useState("");
  const [editorExpiry, setEditorExpiry] = useState("");
  const [editorInitialExpiry, setEditorInitialExpiry] = useState("");
  const editorRef = useRef<HTMLInputElement | null>(null);
  const selectedNode = nodes.find((node) => node.node_id === selectedNodeId) ?? null;
  const activeOverrides = useMemo(() => activeOverrideMap(record, overrideNow), [overrideNow, record]);
  const selectedOverride = selectedNode ? activeOverrides.get(selectedNode.node_id) : undefined;
  const editorDirty = hasEditorChanges(selectedNode, selectedOverride, {
    value: editorValue, isNull: editorNull, reason: editorReason,
    expiry: editorExpiry, initialExpiry: editorInitialExpiry,
  });
  return {
    activeOverrides, editorDirty, editorExpiry, editorInitialExpiry, editorNull, editorReason, editorRef,
    editorValue, selectedNode, selectedNodeId, setEditorExpiry, setEditorInitialExpiry, setEditorNull,
    setEditorReason, setEditorValue, setSelectedNodeId,
  };
}

type EditorState = ReturnType<typeof useEditorState>;
type OverrideResult = { override: ModelV2CellOverride; error: null } | { override: null; error: string };

function buildQueuedOverride(state: EditorState): OverrideResult {
  const node = state.selectedNode;
  if (!node) return { override: null, error: "Select a model node first." };
  const reason = state.editorReason.trim();
  const reasonRequired = requiresOverrideReason(node.node_id);
  if (reasonRequired && !reason) return { override: null, error: "A derived-cell override requires a non-empty reason." };
  const expiresAt = reasonRequired ? futureIso(state.editorExpiry) : null;
  if (reasonRequired && expiresAt === null) return { override: null, error: "A derived-cell override requires a future expiry." };
  const value = Number(state.editorValue);
  if (!state.editorNull && (!state.editorValue.trim() || !Number.isFinite(value))) return { override: null, error: "Enter a finite number or select Set unavailable (null)." };
  return { override: { node_id: node.node_id, value_type: state.editorNull ? "null" : "number", value: state.editorNull ? null : value, reason: reason || null, scope: "draft", source: "analyst-ui", expires_at: expiresAt }, error: null };
}

interface EditorActionArgs {
  busy: BusyAction;
  record: ModelV2DraftRecord | null;
  pendingGenerationRef: { current: number };
  scenarioGenerationRef: { current: number };
  setPending: Dispatch<SetStateAction<PendingMutations>>;
  setPendingPreview: Dispatch<SetStateAction<PendingPreview | null>>;
  setScenarioPreview: Dispatch<SetStateAction<ScenarioPreview | null>>;
  setError: (message: string | null) => void;
  setNotice: (message: string | null) => void;
}

function useEditorActions(state: EditorState, args: EditorActionArgs) {
  const beginEdit = (node: DisplayNode) => {
    if (state.editorDirty || args.busy) return;
    const existing = state.activeOverrides.get(node.node_id);
    state.setSelectedNodeId(node.node_id); state.setEditorNull(existing?.value_type === "null" || node.value == null);
    state.setEditorValue(existing?.value != null ? String(existing.value) : node.value != null ? String(node.value) : "");
    state.setEditorReason(existing?.reason ?? node.override_reason ?? "");
    const expiry = requiresOverrideReason(node.node_id) ? toDateTimeLocal(existing?.expires_at) : "";
    state.setEditorExpiry(expiry); state.setEditorInitialExpiry(expiry); args.setError(null);
  };
  const finishMutation = (message: string) => {
    args.pendingGenerationRef.current += 1; args.setPendingPreview(null);
    args.scenarioGenerationRef.current += 1; args.setScenarioPreview(null);
    state.setSelectedNodeId(null); args.setError(null); args.setNotice(message);
  };
  const queueOverride = () => {
    if (!args.record || !state.selectedNode) return;
    const result = buildQueuedOverride(state);
    if (!result.override) { args.setError(result.error); return; }
    args.setPending((current) => ({ ...current, [result.override.node_id]: { action: "set", override: result.override } }));
    finishMutation(`${result.override.node_id} queued locally. Preview before committing.`);
  };
  const restoreNode = (nodeId: string) => {
    if (state.editorDirty || args.busy) return;
    args.setPending((current) => { const next = { ...current }; if (state.activeOverrides.has(nodeId)) next[nodeId] = { action: "reset", node_id: nodeId }; else delete next[nodeId]; return next; });
    finishMutation(`${nodeId} restoration queued locally.`);
  };
  return { beginEdit, queueOverride, restoreNode };
}

function useModelArtifacts(issuerId: string, record: ModelV2DraftRecord | null, setNotice: (message: string | null) => void) {
  const [history, setHistory] = useState<ModelV2OverrideEvent[]>([]);
  const [checkpoints, setCheckpoints] = useState<ModelV2Checkpoint[]>([]);
  const [checkpointLabel, setCheckpointLabel] = useState("Analyst checkpoint");
  const refreshArtifacts = useCallback(async () => {
    if (!record) { setHistory([]); setCheckpoints([]); return; }
    const [nextHistory, nextCheckpoints] = await Promise.all([getModelV2History(issuerId), getModelV2Checkpoints(issuerId)]);
    setHistory(nextHistory); setCheckpoints(nextCheckpoints);
  }, [issuerId, record]);
  useEffect(() => {
    let active = true;
    if (!record?.id) return;
    Promise.all([getModelV2History(issuerId), getModelV2Checkpoints(issuerId)])
      .then(([nextHistory, nextCheckpoints]) => { if (active) { setHistory(nextHistory); setCheckpoints(nextCheckpoints); } })
      .catch(() => { if (active) setNotice("History or checkpoints could not be loaded."); });
    return () => { active = false; };
  }, [issuerId, record?.id, setNotice]);
  return { checkpointLabel, checkpoints, history, refreshArtifacts, setCheckpointLabel, setCheckpoints, setHistory };
}

interface AdoptRecordArgs {
  pendingGenerationRef: { current: number };
  scenarioGenerationRef: { current: number };
  setRecord: Dispatch<SetStateAction<ModelV2DraftRecord | null>>;
  setSuggestedPayload: Dispatch<SetStateAction<ModelV2DraftPayload | null>>;
  setSuggestedCalculation: Dispatch<SetStateAction<ModelV2Calculation | null>>;
  setCurrentCalculation: Dispatch<SetStateAction<ModelV2Calculation | null>>;
  setRequiresRecalculation: Dispatch<SetStateAction<boolean>>;
  setPending: Dispatch<SetStateAction<PendingMutations>>;
  setPendingPreview: Dispatch<SetStateAction<PendingPreview | null>>;
  setScenarioNodeId: Dispatch<SetStateAction<string>>;
  setScenarioValue: Dispatch<SetStateAction<string>>;
  setScenarioPreview: Dispatch<SetStateAction<ScenarioPreview | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
}

function useAdoptRecord(args: AdoptRecordArgs) {
  const argsRef = useRef(args);
  argsRef.current = args;
  return useCallback((next: ModelV2DraftRecord, message: string) => {
    const current = argsRef.current;
    current.pendingGenerationRef.current += 1; current.scenarioGenerationRef.current += 1;
    current.setRecord(next); current.setSuggestedPayload(null); current.setSuggestedCalculation(null); current.setCurrentCalculation(null);
    current.setRequiresRecalculation(false); current.setPending({}); current.setPendingPreview(null);
    current.setScenarioNodeId(""); current.setScenarioValue(""); current.setScenarioPreview(null);
    current.setSelectedNodeId(null); current.setError(null); current.setNotice(message);
  }, []);
}

interface SaveActionArgs {
  issuerId: string;
  contextId: string | null;
  sourceRunId: string | null | undefined;
  suggestedPayload: ModelV2DraftPayload | null;
  record: ModelV2DraftRecord | null;
  requiresRecalculation: boolean;
  dirty: boolean;
  busy: BusyAction;
  adoptRecord: (next: ModelV2DraftRecord, message: string) => void;
  refreshArtifacts: () => Promise<void>;
  setBusy: (action: BusyAction) => void;
  setError: (message: string | null) => void;
}

function useSaveActions(args: SaveActionArgs) {
  const saveSuggestion = async () => {
    if (!args.suggestedPayload || !args.sourceRunId || args.busy) return;
    args.setBusy("save-suggestion"); args.setError(null);
    try {
      const next = await saveModelV2(args.issuerId, { payload: args.suggestedPayload, expected_revision: 0, context_id: args.contextId, source_run_id: args.sourceRunId });
      args.adoptRecord(next, "Suggested server draft saved. Editing is now enabled.");
    } catch (reason) { args.setError(toErrorMessage(reason, "Suggested model draft could not be saved.")); }
    finally { args.setBusy(null); }
  };
  const recalculateAndSave = async () => {
    if (!args.record || !args.requiresRecalculation || args.dirty || args.busy) return;
    args.setBusy("recalculate"); args.setError(null);
    try {
      const next = await saveModelV2(args.issuerId, { payload: args.record.payload, expected_revision: args.record.revision, context_id: args.record.context_id, source_run_id: args.record.source_run_id });
      args.adoptRecord(next, `Current server calculation saved as revision ${next.revision}.`); await args.refreshArtifacts();
    } catch (reason) { args.setError(toErrorMessage(reason, "Current model calculation could not be saved.")); }
    finally { args.setBusy(null); }
  };
  return { recalculateAndSave, saveSuggestion };
}

interface PendingActionArgs {
  issuerId: string;
  contextId: string | null;
  record: ModelV2DraftRecord | null;
  payload: ModelV2DraftPayload | null;
  pending: PendingMutations;
  pendingCount: number;
  pendingFingerprint: string;
  pendingGenerationRef: { current: number };
  previewCalculation: ModelV2Calculation | null;
  requiresRecalculation: boolean;
  editorDirty: boolean;
  busy: BusyAction;
  adoptRecord: (next: ModelV2DraftRecord, message: string) => void;
  refreshArtifacts: () => Promise<void>;
  setPendingPreview: Dispatch<SetStateAction<PendingPreview | null>>;
  setBusy: (action: BusyAction) => void;
  setError: (message: string | null) => void;
  setNotice: (message: string | null) => void;
}

function pendingActionBlocked(args: PendingActionArgs, requirePreview: boolean) {
  return !args.record || !args.payload || args.requiresRecalculation || args.pendingCount === 0
    || args.editorDirty || (requirePreview && !args.previewCalculation) || Boolean(args.busy);
}

function usePendingActions(args: PendingActionArgs) {
  const stalePreview = (generation: number) => {
    if (args.pendingGenerationRef.current === generation) return false;
    args.setPendingPreview(null); args.setError(null);
    args.setNotice("Pending edits changed while the server preview was running. Preview again before committing.");
    return true;
  };
  const previewPending = async () => {
    if (pendingActionBlocked(args, false) || !args.record || !args.payload) return;
    const requestGeneration = args.pendingGenerationRef.current;
    args.setBusy("preview"); args.setError(null);
    try {
      const next = await calculateModelV2(args.issuerId, { payload: payloadWithPendingMutations(args.payload, args.pending), context_id: args.contextId ?? args.record.context_id, source_run_id: args.record.source_run_id });
      if (stalePreview(requestGeneration)) return;
      args.setPendingPreview({ calculation: next, pendingFingerprint: args.pendingFingerprint });
      args.setNotice("Server preview refreshed. No mutation has been committed.");
    } catch (reason) {
      args.setPendingPreview(null);
      if (!stalePreview(requestGeneration)) args.setError(toErrorMessage(reason, "Server preview failed. Pending edits remain local."));
    } finally { args.setBusy(null); }
  };
  const commitPending = async () => {
    if (pendingActionBlocked(args, true) || !args.record) return;
    args.setBusy("commit"); args.setError(null);
    try {
      const next = await mutateModelV2OverridesBatch(args.issuerId, { expected_revision: args.record.revision, mutations: Object.values(args.pending) });
      args.adoptRecord(next, `${args.pendingCount} pending mutation${args.pendingCount === 1 ? "" : "s"} committed atomically.`);
      await args.refreshArtifacts();
    } catch (reason) { args.setError(toErrorMessage(reason, "Pending model mutations were not committed.")); }
    finally { args.setBusy(null); }
  };
  return { commitPending, previewPending };
}

interface ReplayActionArgs {
  issuerId: string;
  record: ModelV2DraftRecord | null;
  history: ModelV2OverrideEvent[];
  dirty: boolean;
  busy: BusyAction;
  adoptRecord: (next: ModelV2DraftRecord, message: string) => void;
  refreshArtifacts: () => Promise<void>;
  setBusy: (action: BusyAction) => void;
  setError: (message: string | null) => void;
}

function useReplayActions(args: ReplayActionArgs) {
  const { undoEventId, redoEventId } = useMemo(() => deriveHistoryReplayCandidates(args.history), [args.history]);
  const replayHistory = async (mode: "undo" | "redo") => {
    const eventId = mode === "undo" ? undoEventId : redoEventId;
    if (!args.record || !eventId || args.dirty || args.busy) return;
    args.setBusy("history"); args.setError(null);
    try {
      const next = await replayModelV2Override(args.issuerId, eventId, { expected_revision: args.record.revision, mode });
      args.adoptRecord(next, `${mode === "undo" ? "Undo" : "Redo"} committed as revision ${next.revision}.`);
      await args.refreshArtifacts();
    } catch (reason) { args.setError(toErrorMessage(reason, `${mode === "undo" ? "Undo" : "Redo"} failed.`)); }
    finally { args.setBusy(null); }
  };
  return { redoEventId, replayHistory, undoEventId };
}

interface CheckpointActionArgs {
  issuerId: string;
  contextId: string | null;
  record: ModelV2DraftRecord | null;
  checkpointLabel: string;
  requiresRecalculation: boolean;
  dirty: boolean;
  busy: BusyAction;
  adoptRecord: (next: ModelV2DraftRecord, message: string) => void;
  refreshArtifacts: () => Promise<void>;
  setBusy: (action: BusyAction) => void;
  setError: (message: string | null) => void;
  setNotice: (message: string | null) => void;
  setCheckpoints: Dispatch<SetStateAction<ModelV2Checkpoint[]>>;
  setRecord: Dispatch<SetStateAction<ModelV2DraftRecord | null>>;
}

function useCheckpointActions(args: CheckpointActionArgs) {
  const createCheckpoint = async () => {
    const checkpointContextId = args.contextId ?? args.record?.context_id;
    if (!args.record || !checkpointContextId || args.requiresRecalculation || args.dirty || args.busy) return;
    args.setBusy("checkpoint"); args.setError(null);
    try {
      const created = await createModelV2Checkpoint(args.issuerId, { context_id: checkpointContextId, label: args.checkpointLabel.trim() || "Analyst checkpoint", issuer_run_id: args.record.source_run_id, expected_revision: args.record.revision, calculation_hash: args.record.calculation_hash });
      args.setCheckpoints((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      args.setRecord((current) => current ? { ...current, revision: created.draft_revision } : current);
      args.setNotice(`Checkpoint ${created.id.slice(0, 8)} created from revision ${created.draft_revision}.`);
    } catch (reason) { args.setError(toErrorMessage(reason, "Checkpoint could not be created.")); }
    finally { args.setBusy(null); }
  };
  const restoreCheckpoint = async (checkpoint: ModelV2Checkpoint) => {
    if (!args.record || args.busy) return;
    if (args.dirty && !window.confirm("Discard local pending edits and restore this checkpoint?")) return;
    args.setBusy("restore"); args.setError(null);
    try {
      const next = await restoreModelV2Checkpoint(args.issuerId, checkpoint.id, { expected_revision: args.record.revision });
      args.adoptRecord(next, `Checkpoint ${checkpoint.label} restored as revision ${next.revision}.`); await args.refreshArtifacts();
    } catch (reason) { args.setError(toErrorMessage(reason, "Checkpoint could not be restored.")); }
    finally { args.setBusy(null); }
  };
  return { createCheckpoint, restoreCheckpoint };
}

function useWorkbookExport(issuerId: string, record: ModelV2DraftRecord | null, requiresRecalculation: boolean, dirty: boolean, busy: BusyAction, setBusy: (action: BusyAction) => void, setError: (message: string | null) => void, setNotice: (message: string | null) => void) {
  const downloadWorkbook = async () => {
    if (!record || requiresRecalculation || dirty || busy) return;
    setBusy("export"); setError(null);
    try {
      const exported = await exportModelV2Workbook(issuerId);
      const url = URL.createObjectURL(exported.blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = exported.filename;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      setNotice(`Workbook exported from revision ${exported.revision ?? record.revision}.`);
    } catch (reason) { setError(toErrorMessage(reason, "Model workbook export failed.")); }
    finally { setBusy(null); }
  };
  return downloadWorkbook;
}

function selectBaseCalculation(
  record: ModelV2DraftRecord | null,
  requiresRecalculation: boolean,
  currentCalculation: ModelV2Calculation | null,
  suggestedCalculation: ModelV2Calculation | null,
) {
  if (!record) return suggestedCalculation;
  if (requiresRecalculation) return currentCalculation ?? record.calculation;
  return record.calculation;
}

function selectPreviewCalculation(preview: PendingPreview | null, fingerprint: string) {
  return preview?.pendingFingerprint === fingerprint ? preview.calculation : null;
}

function useModelRecordState(initialResponse: ModelV2ReadResponse) {
  const [record, setRecord] = useState<ModelV2DraftRecord | null>(initialResponse.record);
  const [suggestedPayload, setSuggestedPayload] = useState(initialResponse.suggested_payload);
  const [suggestedCalculation, setSuggestedCalculation] = useState(initialResponse.suggested_calculation);
  const [currentCalculation, setCurrentCalculation] = useState(initialResponse.current_calculation);
  const [requiresRecalculation, setRequiresRecalculation] = useState(initialResponse.requires_recalculation);
  const payload = record?.payload ?? suggestedPayload;
  const baseCalculation = selectBaseCalculation(record, requiresRecalculation, currentCalculation, suggestedCalculation);
  return {
    baseCalculation, currentCalculation, payload, record, requiresRecalculation, setCurrentCalculation,
    setRecord, setRequiresRecalculation, setSuggestedCalculation, setSuggestedPayload,
    suggestedCalculation, suggestedPayload,
  };
}

function useModelSessionState(baseCalculation: ModelV2Calculation | null) {
  const [pending, setPending] = useState<PendingMutations>({});
  const [pendingPreview, setPendingPreview] = useState<PendingPreview | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warnOnLeave, setWarnOnLeave] = useState(true);
  const [overrideNow, setOverrideNow] = useState(() => Date.now());
  const pendingGenerationRef = useRef(0);
  const pendingFingerprint = useMemo(() => fingerprintPendingMutations(pending), [pending]);
  const previewCalculation = selectPreviewCalculation(pendingPreview, pendingFingerprint);
  const calculation = previewCalculation ?? baseCalculation;
  const pendingCount = Object.keys(pending).length;
  return {
    busy, calculation, error, notice, overrideNow, pending, pendingCount, pendingFingerprint,
    pendingGenerationRef, pendingPreview, previewCalculation, setBusy, setError, setNotice,
    setOverrideNow, setPending, setPendingPreview, setWarnOnLeave, warnOnLeave,
  };
}

function useModelCoreState(initialResponse: ModelV2ReadResponse) {
  const recordState = useModelRecordState(initialResponse);
  const sessionState = useModelSessionState(recordState.baseCalculation);
  return { ...recordState, ...sessionState };
}

function useNodeBrowser(calculation: ModelV2Calculation | null) {
  const [nodeQuery, setNodeQuery] = useState("");
  const [nodePeriodFilter, setNodePeriodFilter] = useState("");
  const [nodePage, setNodePage] = useState(0);
  const nodes = useMemo(() => flattenNodes(calculation), [calculation]);
  const nodePeriods = useMemo(() => Array.from(new Map(nodes.map((node) => [node.period_key, node.period_label]))), [nodes]);
  const filteredNodes = useMemo(() => {
    const normalizedQuery = nodeQuery.trim().toLowerCase();
    return nodes.filter((node) => (!nodePeriodFilter || node.period_key === nodePeriodFilter) && (!normalizedQuery || node.node_id.toLowerCase().includes(normalizedQuery)));
  }, [nodePeriodFilter, nodeQuery, nodes]);
  const nodePageCount = Math.max(1, Math.ceil(filteredNodes.length / NODE_PAGE_SIZE));
  const boundedNodePage = Math.min(nodePage, nodePageCount - 1);
  const visibleNodes = useMemo(() => {
    const start = boundedNodePage * NODE_PAGE_SIZE;
    return filteredNodes.slice(start, start + NODE_PAGE_SIZE);
  }, [boundedNodePage, filteredNodes]);
  return {
    boundedNodePage, filteredNodes, nodePageCount, nodePeriodFilter, nodePeriods, nodeQuery, nodes,
    setNodePage, setNodePeriodFilter, setNodeQuery, visibleNodes,
  };
}

interface PendingGuardArgs {
  dirty: boolean;
  warnOnLeave: boolean;
  pendingGenerationRef: { current: number };
  scenarioGenerationRef: { current: number };
  setPending: Dispatch<SetStateAction<PendingMutations>>;
  setPendingPreview: Dispatch<SetStateAction<PendingPreview | null>>;
  setScenarioNodeId: Dispatch<SetStateAction<string>>;
  setScenarioValue: Dispatch<SetStateAction<string>>;
  setScenarioPreview: Dispatch<SetStateAction<ScenarioPreview | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
}

function usePendingNavigation(args: PendingGuardArgs) {
  const argsRef = useRef(args);
  argsRef.current = args;
  const discardPending = useCallback(() => {
    const current = argsRef.current;
    current.pendingGenerationRef.current += 1; current.scenarioGenerationRef.current += 1;
    current.setPending({}); current.setPendingPreview(null); current.setScenarioNodeId(""); current.setScenarioValue("");
    current.setScenarioPreview(null); current.setSelectedNodeId(null); current.setError(null);
  }, []);
  useNavigationGuard({ dirty: args.dirty, enabled: args.warnOnLeave, onDiscard: discardPending });
}

interface OverrideExpiryArgs {
  exactRunId?: string | null;
  issuerId: string;
  record: ModelV2DraftRecord | null;
  overrideNow: number;
  pendingGenerationRef: { current: number };
  scenarioGenerationRef: { current: number };
  setOverrideNow: Dispatch<SetStateAction<number>>;
  setPendingPreview: Dispatch<SetStateAction<PendingPreview | null>>;
  setScenarioPreview: Dispatch<SetStateAction<ScenarioPreview | null>>;
  setCurrentCalculation: Dispatch<SetStateAction<ModelV2Calculation | null>>;
  setRequiresRecalculation: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
}

function activeOverrideExpiries(record: ModelV2DraftRecord | null, now: number) {
  return (record?.payload.overrides ?? [])
    .map((item) => item.expires_at ? Date.parse(item.expires_at) : Number.NaN)
    .filter((value) => Number.isFinite(value) && value > now);
}

async function refreshExpiredModel(args: OverrideExpiryArgs, record: ModelV2DraftRecord | null) {
  try {
    const next = args.exactRunId ? await getModelV2(args.issuerId, args.exactRunId) : await getModelV2(args.issuerId);
    if (!record || !next.record || next.record.id !== record.id || next.record.revision !== record.revision) return;
    args.setCurrentCalculation(next.current_calculation); args.setRequiresRecalculation(true);
    args.setNotice("An override expired. The current server calculation is shown; save it before checkpoint or export.");
  } catch {
    args.setNotice("An override expired, but the current server calculation could not be refreshed.");
  }
}

function useOverrideExpiryRefresh(args: OverrideExpiryArgs) {
  const argsRef = useRef(args);
  argsRef.current = args;
  const { exactRunId, issuerId, overrideNow, record } = args;
  useEffect(() => {
    const current = argsRef.current;
    const expiries = activeOverrideExpiries(record, overrideNow);
    if (!expiries.length) return;
    const delay = Math.min(Math.max(Math.min(...expiries) - Date.now() + 25, 0), 2_147_483_647);
    const timer = window.setTimeout(() => {
      current.setOverrideNow(Date.now()); current.pendingGenerationRef.current += 1; current.scenarioGenerationRef.current += 1;
      current.setPendingPreview(null); current.setScenarioPreview(null); current.setRequiresRecalculation(true);
      current.setNotice("An override expired. Refreshing the current server calculation; save it before checkpoint or export.");
      void refreshExpiredModel(current, record);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [exactRunId, issuerId, overrideNow, record]);
}

function useAnalystLeavePreference(setWarnOnLeave: Dispatch<SetStateAction<boolean>>) {
  useEffect(() => {
    let active = true;
    getAnalystSettings().then((settings) => { if (active) setWarnOnLeave(readWarnOnUnsavedLeave(settings)); }).catch(() => {});
    return () => { active = false; };
  }, [setWarnOnLeave]);
}

function useEditorFocus(editor: EditorState) {
  useEffect(() => { if (editor.selectedNode) editor.editorRef.current?.focus(); }, [editor.selectedNode, editor.editorRef]);
}

interface ModelV2BootstrapState {
  kind: "bootstrap";
  surfaceKind: "unavailable" | "partial";
  issuerId: string;
  detail: string;
  error: string | null;
  notice: string | null;
  workbookImportState: WorkbookImportViewState;
}

function ModelV2BootstrapView({ state }: { state: ModelV2BootstrapState }) {
  return (
    <EnterprisePage kind="editor" identity={<ShellIdentity tag="MODEL V2" title={`${state.issuerId} — canonical model`} />} narrowContract={{ essentialControls: null }}>
      <div className="space-y-3 p-3">
        {state.error ? <div role="alert" className="rounded border border-caos-critical/60 bg-caos-critical/10 px-3 py-2 text-caos-xs text-caos-critical">{state.error}</div> : null}
        {state.notice ? <div role="status" className="rounded border border-caos-border bg-caos-panel px-3 py-2 text-caos-xs text-caos-muted">{state.notice}</div> : null}
        <SurfaceState kind={state.surfaceKind} title="Canonical model unavailable" detail={state.detail} />
        <WorkbookImportPanel state={state.workbookImportState} />
      </div>
    </EnterprisePage>
  );
}

function calculationStatusColor(status: ModelV2Calculation["status"]) {
  if (status === "ready") return "var(--caos-success)";
  return status === "partial" ? "var(--caos-warning)" : "var(--caos-critical)";
}

function useModelWorkspace({ issuerId, contextId, exactRunId, initialResponse }: ModelV2WorkbenchProps) {
  const core = useModelCoreState(initialResponse);
  const artifacts = useModelArtifacts(issuerId, core.record, core.setNotice);
  const nodeBrowser = useNodeBrowser(core.calculation);
  const editor = useEditorState(nodeBrowser.nodes, core.record, core.overrideNow);
  const dirty = core.pendingCount > 0 || editor.editorDirty;
  const scenario = useScenarioController({
    busy: core.busy, contextId, editorDirty: editor.editorDirty, issuerId, nodes: nodeBrowser.nodes,
    payload: core.payload, pending: core.pending, pendingFingerprint: core.pendingFingerprint,
    pendingGenerationRef: core.pendingGenerationRef, record: core.record,
    requiresRecalculation: core.requiresRecalculation, setBusy: core.setBusy,
    setError: core.setError, setNotice: core.setNotice,
  });
  const editorActions = useEditorActions(editor, {
    busy: core.busy, pendingGenerationRef: core.pendingGenerationRef, record: core.record,
    scenarioGenerationRef: scenario.scenarioGenerationRef, setError: core.setError,
    setNotice: core.setNotice, setPending: core.setPending, setPendingPreview: core.setPendingPreview,
    setScenarioPreview: scenario.setScenarioPreview,
  });
  usePendingNavigation({
    dirty, pendingGenerationRef: core.pendingGenerationRef, scenarioGenerationRef: scenario.scenarioGenerationRef,
    setError: core.setError, setPending: core.setPending, setPendingPreview: core.setPendingPreview,
    setScenarioNodeId: scenario.setScenarioNodeId, setScenarioPreview: scenario.setScenarioPreview,
    setScenarioValue: scenario.setScenarioValue, setSelectedNodeId: editor.setSelectedNodeId,
    warnOnLeave: core.warnOnLeave,
  });
  useOverrideExpiryRefresh({
    exactRunId, issuerId, overrideNow: core.overrideNow, pendingGenerationRef: core.pendingGenerationRef,
    record: core.record, scenarioGenerationRef: scenario.scenarioGenerationRef,
    setCurrentCalculation: core.setCurrentCalculation, setNotice: core.setNotice,
    setOverrideNow: core.setOverrideNow, setPendingPreview: core.setPendingPreview,
    setRequiresRecalculation: core.setRequiresRecalculation, setScenarioPreview: scenario.setScenarioPreview,
  });
  useAnalystLeavePreference(core.setWarnOnLeave);
  useEditorFocus(editor);
  return { artifacts, core, dirty, editor, editorActions, nodeBrowser, scenario };
}

type ModelWorkspace = ReturnType<typeof useModelWorkspace>;

function useModelServerActions(props: ModelV2WorkbenchProps, workspace: ModelWorkspace) {
  const { issuerId, contextId, initialResponse } = props;
  const { artifacts, core, dirty, editor, scenario } = workspace;
  const adoptRecord = useAdoptRecord({
    pendingGenerationRef: core.pendingGenerationRef, scenarioGenerationRef: scenario.scenarioGenerationRef,
    setCurrentCalculation: core.setCurrentCalculation, setError: core.setError, setNotice: core.setNotice,
    setPending: core.setPending, setPendingPreview: core.setPendingPreview, setRecord: core.setRecord,
    setRequiresRecalculation: core.setRequiresRecalculation, setScenarioNodeId: scenario.setScenarioNodeId,
    setScenarioPreview: scenario.setScenarioPreview, setScenarioValue: scenario.setScenarioValue,
    setSelectedNodeId: editor.setSelectedNodeId, setSuggestedCalculation: core.setSuggestedCalculation,
    setSuggestedPayload: core.setSuggestedPayload,
  });
  const saveActions = useSaveActions({
    adoptRecord, busy: core.busy, contextId, dirty, issuerId, record: core.record,
    refreshArtifacts: artifacts.refreshArtifacts, requiresRecalculation: core.requiresRecalculation,
    setBusy: core.setBusy, setError: core.setError, sourceRunId: initialResponse.suggested_source_run_id,
    suggestedPayload: core.suggestedPayload,
  });
  const pendingActions = usePendingActions({
    adoptRecord, busy: core.busy, contextId, editorDirty: editor.editorDirty, issuerId,
    payload: core.payload, pending: core.pending, pendingCount: core.pendingCount,
    pendingFingerprint: core.pendingFingerprint, pendingGenerationRef: core.pendingGenerationRef,
    previewCalculation: core.previewCalculation, record: core.record, refreshArtifacts: artifacts.refreshArtifacts,
    requiresRecalculation: core.requiresRecalculation, setBusy: core.setBusy, setError: core.setError,
    setNotice: core.setNotice, setPendingPreview: core.setPendingPreview,
  });
  const replayActions = useReplayActions({
    adoptRecord, busy: core.busy, dirty, history: artifacts.history, issuerId, record: core.record,
    refreshArtifacts: artifacts.refreshArtifacts, setBusy: core.setBusy, setError: core.setError,
  });
  const checkpointActions = useCheckpointActions({
    adoptRecord, busy: core.busy, checkpointLabel: artifacts.checkpointLabel, contextId, dirty, issuerId,
    record: core.record, refreshArtifacts: artifacts.refreshArtifacts, requiresRecalculation: core.requiresRecalculation,
    setBusy: core.setBusy, setCheckpoints: artifacts.setCheckpoints, setError: core.setError,
    setNotice: core.setNotice, setRecord: core.setRecord,
  });
  const downloadWorkbook = useWorkbookExport(issuerId, core.record, core.requiresRecalculation, dirty, core.busy, core.setBusy, core.setError, core.setNotice);
  const workbookImportState = useWorkbookImportController({
    adoptRecord, busy: core.busy, dirty, issuerId, record: core.record,
    refreshArtifacts: artifacts.refreshArtifacts, setBusy: core.setBusy, setError: core.setError,
    setNotice: core.setNotice,
  });
  return { ...checkpointActions, downloadWorkbook, ...pendingActions, ...replayActions, ...saveActions, workbookImportState };
}

function useModelV2Controller({ issuerId, contextId, exactRunId, initialResponse }: ModelV2WorkbenchProps) {
  const workspace = useModelWorkspace({ issuerId, contextId, exactRunId, initialResponse });
  const actions = useModelServerActions({ issuerId, contextId, exactRunId, initialResponse }, workspace);
  const { artifacts, core, dirty, editor, editorActions, nodeBrowser, scenario } = workspace;
  const { baseCalculation, calculation, payload } = core;
  if (!payload || !baseCalculation || !calculation) {
    return {
      kind: "bootstrap" as const,
      surfaceKind: initialResponse.availability === "unavailable" ? "unavailable" as const : "partial" as const,
      issuerId, error: core.error, notice: core.notice, workbookImportState: actions.workbookImportState,
      detail: initialResponse.detail ?? "The server did not return a saved or suggested Model Engine v2 calculation.",
    };
  }
  const status = calculation.status;
  return {
    kind: "ready" as const,
    ...core, ...nodeBrowser, ...artifacts, ...scenario, ...editor, ...editorActions, ...actions,
    baseCalculation, calculation, contextId, dirty, initialResponse, issuerId, payload,
    saveContractMissing: !core.record && !initialResponse.suggested_source_run_id,
    status, statusColor: calculationStatusColor(status),
  };
}

type ModelV2Controller = ReturnType<typeof useModelV2Controller>;
type ReadyModelV2Controller = Extract<ModelV2Controller, { kind: "ready" }>;

function ModelV2Identity({ state }: { state: ReadyModelV2Controller }) {
  const { issuerId, payload, record, status, statusColor } = state;
  return (
    <ShellIdentity
      tag="MODEL V2"
      title={`${issuerId} — canonical model`}
      badges={
        <span className="tabular text-caos-2xs uppercase tracking-wider" style={{ color: statusColor }}>
          {payload.reporting_currency} · {payload.reporting_unit} · {status.replace("_", " ")} · {record ? `REV ${record.revision}` : "SUGGESTED"}
        </span>
      }
    />
  );
}

function pendingCommitReason(state: ReadyModelV2Controller) {
  if (state.requiresRecalculation) return "Recalculate and save the current server calculation first";
  if (state.pendingCount === 0) return "No pending overrides to commit";
  if (state.editorDirty) return "Queue or cancel the open editor change first";
  if (!state.previewCalculation) return "Preview the pending overrides first";
  if (state.busy !== null) return "An action is already in progress";
  return null;
}

function SuggestedModelPrimaryAction({ state }: { state: ReadyModelV2Controller }): PageAction {
  const reason = state.saveContractMissing
    ? "No owned source run was identified to save against"
    : state.busy !== null
      ? "An action is already in progress"
      : null;
  return {
    label: "Save suggested draft",
    onAction: () => { void state.saveSuggestion(); },
    unavailableReason: reason,
  };
}

function ModelV2PrimaryAction({ state }: { state: ReadyModelV2Controller }): PageAction {
  const {
    busy, commitPending, dirty, pendingCount, recalculateAndSave, record, requiresRecalculation,
  } = state;
  if (!record) return SuggestedModelPrimaryAction({ state });
  if (requiresRecalculation) {
    return {
      label: "Recalculate & save",
      onAction: () => { void recalculateAndSave(); },
      unavailableReason: dirty
        ? "Commit or discard local pending edits first"
        : busy !== null
          ? "An action is already in progress"
          : null,
      title: "Persist the current server calculation without changing model inputs",
    };
  }
  return {
    label: `Commit ${pendingCount} pending`,
    onAction: () => { void commitPending(); },
    unavailableReason: pendingCommitReason(state),
  };
}

function ModelV2Status({ state }: { state: ReadyModelV2Controller }) {
  const { calculation, dirty, editorDirty, pendingCount, record, requiresRecalculation, warnOnLeave } = state;
  let label = "Read-only server suggestion";
  if (dirty) label = editorDirty
    ? `${pendingCount ? `${pendingCount} pending · ` : ""}editor change · not queued`
    : `${pendingCount} local · not saved`;
  else if (record && requiresRecalculation) {
    label = `Saved ${record.calculation_hash.slice(0, 10)} · current ${calculation.calculation_hash.slice(0, 10)} · save required`;
  } else if (record) label = `Hash ${record.calculation_hash.slice(0, 10)}`;
  return <div className="flex min-w-0 flex-wrap items-center gap-2">
    <CompletionStateSummary
      label="Model v2 completion"
      execution={state.busy !== null ? "running" : record ? "complete" : "not-started"}
      persistence={dirty || requiresRecalculation ? "unsaved" : record ? "saved" : "draft"}
      approval="not-applicable"
      freshness="unknown"
    />
    <span className="tabular text-caos-2xs text-caos-muted">{label} · leave warning {warnOnLeave ? "on" : "off"}</span>
  </div>;
}

function pendingPreviewReason(state: ReadyModelV2Controller) {
  if (state.requiresRecalculation) return "Recalculate and save the current server calculation first";
  if (state.pendingCount === 0) return "No pending overrides to preview";
  if (state.editorDirty) return "Queue or cancel the open editor change first";
  if (state.busy !== null) return "An action is already in progress";
  return null;
}

function replayReason(state: ReadyModelV2Controller, eventId: string | null | undefined, direction: "undo" | "redo") {
  if (!eventId) return direction === "undo" ? "No committed change available to undo" : "No undone change available to redo";
  if (state.dirty) return "Commit or discard local pending edits first";
  if (state.busy !== null) return "An action is already in progress";
  return null;
}

function ModelV2ContextualControls({ state }: { state: ReadyModelV2Controller }) {
  const {
    busy, previewPending, redoEventId, replayHistory, undoEventId,
  } = state;
  return (
    <span className="flex items-center gap-1">
      <Button
        variant="secondary"
        onClick={() => void previewPending()}
        reason={pendingPreviewReason(state)}
      >
        {busy === "preview" ? "Calculating…" : "Preview pending"}
      </Button>
      <Button
        variant="secondary"
        onClick={() => void replayHistory("undo")}
        reason={replayReason(state, undoEventId, "undo")}
      >
        Undo
      </Button>
      <Button
        variant="secondary"
        onClick={() => void replayHistory("redo")}
        reason={replayReason(state, redoEventId, "redo")}
      >
        Redo
      </Button>
    </span>
  );
}

function ModelV2UtilityControls({ state }: { state: ReadyModelV2Controller }) {
  const { busy, dirty, downloadWorkbook, requiresRecalculation } = state;
  return (
    <button
      type="button"
      onClick={() => void downloadWorkbook()}
      aria-disabled={(requiresRecalculation || dirty || busy !== null) || undefined}
      title={requiresRecalculation ? "Recalculate and save before exporting" : "Export the persisted canonical workbook"}
      className="caos-action-secondary focus-ring aria-disabled:opacity-40"
    >
      {busy === "export" ? "Exporting…" : "Export workbook"}
    </button>
  );
}

type VisibleModelNode = ReadyModelV2Controller["visibleNodes"][number];

function nodeActionReason(state: ReadyModelV2Controller, restorable?: boolean) {
  if (!state.record) return "Save the suggested draft before editing";
  if (restorable === false) return "No override or pending change to restore";
  if (state.editorDirty) return "Queue or cancel the open editor change first";
  if (state.busy !== null) return "An action is already in progress";
  return null;
}

function CalculationNodeRow({ node, state }: { node: VisibleModelNode; state: ReadyModelV2Controller }) {
  const { activeOverrides, beginEdit, payload, pending, restoreNode } = state;
  const mutation = pending[node.node_id];
  const origin = nodeOrigin(node, payload, mutation);
  const restorable = activeOverrides.has(node.node_id) || mutation?.action === "set";
  return (
    <tr className="border-b border-caos-border/60 align-top hover:bg-caos-elevated/50">
      <td className="px-2 py-2 text-caos-muted"><span className="block text-caos-text">{node.period_label}</span><span className="text-caos-3xs uppercase tracking-wide">{node.period_kind}</span></td>
      <th scope="row" className="px-2 py-2 font-mono font-normal text-caos-text">{node.node_id}</th>
      <td className="px-2 py-2 text-right font-mono text-caos-text">{formatValue(node.value)}</td>
      <td className="px-2 py-2 text-right font-mono text-caos-muted">{formatValue(node.original_value)}</td>
      <td className="max-w-[320px] px-2 py-2 font-mono text-caos-muted">{node.formula ?? "INPUT"}</td>
      <td className="px-2 py-2">
        <span className={`whitespace-nowrap text-caos-2xs font-semibold uppercase tracking-wider ${originClassName(origin.label)}`} title={origin.title}>
          {origin.glyph} {origin.label}
        </span>
      </td>
      <td className="px-2 py-2">
        {mutationLabel(mutation) ? <span className="text-caos-warning">{mutationLabel(mutation)}</span>
          : node.overridden ? <span className="text-caos-accent">OVERRIDDEN · {node.override_reason || "NO REASON"}</span>
            : <span className="text-caos-muted">CANONICAL</span>}
      </td>
      <td className="px-2 py-2">
        <span className="flex justify-end gap-1">
          <Button variant="secondary" onClick={() => beginEdit(node)} aria-label={`Edit ${node.node_id}`} reason={nodeActionReason(state)}>Edit</Button>
          <Button variant="secondary" onClick={() => restoreNode(node.node_id)} aria-label={`Restore ${node.node_id}`} reason={nodeActionReason(state, restorable)}>Restore</Button>
        </span>
      </td>
    </tr>
  );
}

function CalculationNodeFilters({ state }: { state: ReadyModelV2Controller }) {
  const {
    boundedNodePage, nodePageCount, nodePeriodFilter, nodePeriods, nodeQuery,
    setNodePage, setNodePeriodFilter, setNodeQuery,
  } = state;
  return (
    <div className="flex flex-wrap items-end gap-2 border-b border-caos-border p-2">
      <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-caos-2xs uppercase tracking-wider text-caos-muted">
        Filter nodes
        <input name="calculation-node-filter" autoComplete="off" aria-label="Filter calculation nodes" value={nodeQuery} onChange={(event) => { setNodeQuery(event.target.value); setNodePage(0); }} placeholder="Stable node ID…" className="h-8 rounded border border-caos-border bg-caos-bg px-2 font-mono text-caos-xs normal-case tracking-normal text-caos-text focus-ring" />
      </label>
      <label className="flex min-w-[12rem] flex-col gap-1 text-caos-2xs uppercase tracking-wider text-caos-muted">
        Period
        <select aria-label="Filter calculation period" value={nodePeriodFilter} onChange={(event) => { setNodePeriodFilter(event.target.value); setNodePage(0); }} className="h-8 rounded border border-caos-border bg-caos-bg px-2 text-caos-xs normal-case tracking-normal text-caos-text focus-ring">
          <option value="">All periods</option>
          {nodePeriods.map(([periodKey, periodLabel]) => <option key={periodKey} value={periodKey}>{periodLabel} · {periodKey}</option>)}
        </select>
      </label>
      <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Page {boundedNodePage + 1} / {nodePageCount}</span>
      <Button variant="secondary" onClick={() => setNodePage((current) => Math.max(0, current - 1))} reason={boundedNodePage === 0 ? "Already at the first page" : null}>Previous nodes</Button>
      <Button variant="secondary" onClick={() => setNodePage((current) => Math.min(nodePageCount - 1, current + 1))} reason={boundedNodePage >= nodePageCount - 1 ? "Already at the last page" : null}>Next nodes</Button>
    </div>
  );
}

function CalculationNodesTable({ state }: { state: ReadyModelV2Controller }) {
  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[980px] border-collapse text-left tabular text-caos-xs">
        <caption className="sr-only">Canonical Model Engine v2 calculation nodes</caption>
        <thead className="sticky top-0 z-10 bg-caos-panel text-caos-2xs uppercase tracking-wider text-caos-muted">
          <tr className="border-b border-caos-border">
            <th scope="col" className="px-2 py-2">Period</th><th scope="col" className="px-2 py-2">Node ID</th>
            <th scope="col" className="px-2 py-2 text-right">Value</th><th scope="col" className="px-2 py-2 text-right">Original</th>
            <th scope="col" className="px-2 py-2">Formula</th><th scope="col" className="px-2 py-2">Origin</th>
            <th scope="col" className="px-2 py-2">State</th><th scope="col" className="px-2 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {state.visibleNodes.map((node) => <CalculationNodeRow key={node.node_id} node={node} state={state} />)}
          {state.visibleNodes.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-center text-caos-xs text-caos-muted">No calculation nodes match the current filters.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function CalculationNodesPanel({ state }: { state: ReadyModelV2Controller }) {
  const { filteredNodes, nodes, previewCalculation, record, requiresRecalculation } = state;
  const count = filteredNodes.length === nodes.length ? `${nodes.length} stable nodes` : `${filteredNodes.length} of ${nodes.length} stable nodes`;
  const source = previewCalculation ? "server preview" : record && requiresRecalculation ? "current · save required" : record ? "saved" : "suggested";
  return (
    <Panel title="Calculation nodes" right={<span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{count} · {source}</span>}>
      <CalculationNodeFilters state={state} />
      <CalculationNodesTable state={state} />
    </Panel>
  );
}

function OverrideEditor({ state }: { state: ReadyModelV2Controller }) {
  const {
    editorExpiry, editorNull, editorReason, editorRef, editorValue, queueOverride, selectedNode,
    setEditorExpiry, setEditorNull, setEditorReason, setEditorValue, setSelectedNodeId,
  } = state;
  if (!selectedNode) return null;
  const reasonRequired = requiresOverrideReason(selectedNode.node_id);
  return (
    <Panel title="Override editor" right={<code className="text-caos-2xs text-caos-muted">{selectedNode.node_id}</code>}>
      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(13rem,0.7fr)_auto] lg:items-end">
        <label className="flex flex-col gap-1 text-caos-xs text-caos-text">
          Numeric value
          <input ref={editorRef} name="model-override-value" autoComplete="off" value={editorValue} onChange={(event) => setEditorValue(event.target.value)} disabled={editorNull} inputMode="decimal" className="h-8 rounded border border-caos-border bg-caos-bg px-2 font-mono text-caos-text focus-ring disabled:opacity-40" />
        </label>
        <label className="flex flex-col gap-1 text-caos-xs text-caos-text">
          Reason {reasonRequired ? "· required" : "· optional"}
          <input name="model-override-reason" autoComplete="off" value={editorReason} onChange={(event) => setEditorReason(event.target.value)} className="h-8 rounded border border-caos-border bg-caos-bg px-2 text-caos-text focus-ring" />
        </label>
        {reasonRequired ? (
          <label className="flex flex-col gap-1 text-caos-xs text-caos-text">
            Override expiry · required
            <input type="datetime-local" name="model-override-expiry" autoComplete="off" aria-label="Override expiry" value={editorExpiry} onChange={(event) => setEditorExpiry(event.target.value)} className="h-8 rounded border border-caos-border bg-caos-bg px-2 font-mono text-caos-text focus-ring" />
            <span className="text-caos-3xs uppercase tracking-wide text-caos-muted">Source · analyst-ui</span>
          </label>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-caos-xs text-caos-muted"><input type="checkbox" name="model-override-unavailable" autoComplete="off" checked={editorNull} onChange={(event) => setEditorNull(event.target.checked)} className="focus-ring" />Set unavailable (null)</label>
          <button type="button" onClick={queueOverride} className="caos-primary-action focus-ring">Queue override</button>
          <button type="button" onClick={() => setSelectedNodeId(null)} className="caos-action-secondary focus-ring">Cancel</button>
        </div>
        <div className="lg:col-span-4 grid gap-1 rounded border border-caos-border bg-caos-bg/60 p-2 font-mono text-caos-2xs text-caos-muted">
          <span>ORIGINAL {formatValue(selectedNode.original_value)}</span><span>FORMULA {selectedNode.formula ?? "input value"}</span>
        </div>
      </div>
    </Panel>
  );
}

function scenarioPreviewReason(state: ReadyModelV2Controller) {
  if (state.requiresRecalculation) return "Recalculate and save the current server calculation first";
  if (!state.scenarioNodeId) return "Select a scenario node first";
  if (!state.scenarioValue.trim()) return "Enter a scenario value first";
  if (!Number.isFinite(Number(state.scenarioValue))) return "Enter a finite scenario value";
  if (state.editorDirty) return "Queue or cancel the open editor change first";
  if (state.busy !== null) return "An action is already in progress";
  return null;
}

function ScenarioInputs({ state }: { state: ReadyModelV2Controller }) {
  const {
    busy, nodes, requiresRecalculation, scenarioGenerationRef, scenarioNodeId, scenarioNodeOptions,
    scenarioNodeQuery, scenarioValue, setScenarioNodeId, setScenarioNodeQuery, setScenarioPreview, setScenarioValue,
  } = state;
  const clearPreview = () => { scenarioGenerationRef.current += 1; setScenarioPreview(null); };
  return (
    <>
      <label className="flex flex-col gap-1 text-caos-xs text-caos-text">
        Find scenario node
        <input name="scenario-node-filter" autoComplete="off" aria-label="Filter scenario nodes" value={scenarioNodeQuery} onChange={(event) => setScenarioNodeQuery(event.target.value)} disabled={requiresRecalculation} placeholder="Period or stable node ID…" className="h-8 rounded border border-caos-border bg-caos-bg px-2 font-mono text-caos-text focus-ring" />
      </label>
      <label className="flex flex-col gap-1 text-caos-xs text-caos-text">
        Scenario node
        <select aria-label="Scenario node" value={scenarioNodeId} onChange={(event) => { clearPreview(); setScenarioNodeId(event.target.value); }} disabled={requiresRecalculation || (busy !== null && busy !== "scenario-preview")} className="h-8 rounded border border-caos-border bg-caos-bg px-2 font-mono text-caos-text focus-ring disabled:opacity-40">
          <option value="">Select stable node</option>
          {scenarioNodeOptions.map((node) => <option key={node.node_id} value={node.node_id}>{scenarioNodeLabel(node)}</option>)}
        </select>
        {nodes.length > NODE_PICKER_LIMIT ? <span className="text-caos-3xs text-caos-muted">Showing up to {NODE_PICKER_LIMIT} matches. Refine the node filter to reach the full graph.</span> : null}
      </label>
      <label className="flex flex-col gap-1 text-caos-xs text-caos-text">
        Scenario value
        <input name="scenario-value" autoComplete="off" value={scenarioValue} onChange={(event) => { clearPreview(); setScenarioValue(event.target.value); }} disabled={requiresRecalculation || (busy !== null && busy !== "scenario-preview")} inputMode="decimal" className="h-8 rounded border border-caos-border bg-caos-bg px-2 font-mono text-caos-text focus-ring disabled:opacity-40" />
      </label>
    </>
  );
}

function ScenarioActions({ state }: { state: ReadyModelV2Controller }) {
  const { busy, previewScenario, resetScenario, scenarioNodeId, scenarioPreview, scenarioValue } = state;
  const resetReason = !scenarioNodeId && !scenarioValue && !scenarioPreview
    ? "No sensitivity inputs to reset"
    : busy !== null && busy !== "scenario-preview"
      ? "An action is already in progress"
      : null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => void previewScenario()} reason={scenarioPreviewReason(state)}>{busy === "scenario-preview" ? "Calculating…" : "Preview sensitivity"}</Button>
      <Button variant="secondary" onClick={resetScenario} reason={resetReason}>Reset sensitivity</Button>
    </div>
  );
}

function ScenarioDecisionDeltas({ state }: { state: ReadyModelV2Controller }) {
  const { activeScenarioPreview, scenarioBaselinePeriod, scenarioResultNode, scenarioResultPeriod } = state;
  if (!activeScenarioPreview) return null;
  return (
    <div className="space-y-2 rounded border border-caos-accent/50 bg-caos-bg/60 p-2 text-caos-2xs text-caos-text lg:col-span-4">
      <div className="grid gap-1 font-mono">
        <span>SCENARIO {activeScenarioPreview.nodeId} = {formatValue(activeScenarioPreview.value)}</span>
        <span>SELECTED RESULT {formatValue(scenarioResultNode?.value ?? null)} · HASH {activeScenarioPreview.calculation.calculation_hash.slice(0, 12)}</span>
      </div>
      <table className="w-full border-collapse text-left tabular" aria-label="Sensitivity decision deltas">
        <thead className="uppercase tracking-wider text-caos-muted"><tr className="border-b border-caos-border"><th scope="col" className="py-1 pr-2">Decision output</th><th scope="col" className="px-2 py-1 text-right">Base</th><th scope="col" className="px-2 py-1 text-right">Scenario</th><th scope="col" className="py-1 pl-2 text-right">Delta</th></tr></thead>
        <tbody>
          {SCENARIO_DECISION_FIELDS.map(([field, label]) => {
            const baseValue = scenarioBaselinePeriod?.[field] as number | null | undefined;
            const resultValue = scenarioResultPeriod?.[field] as number | null | undefined;
            const delta = baseValue != null && resultValue != null ? resultValue - baseValue : null;
            return <tr key={field} className="border-b border-caos-border/60 last:border-0"><th scope="row" className="py-1 pr-2 font-normal text-caos-text">{label}</th><td className="px-2 py-1 text-right font-mono text-caos-muted">{formatValue(baseValue ?? null)}</td><td className="px-2 py-1 text-right font-mono text-caos-text">{formatValue(resultValue ?? null)}</td><td className="py-1 pl-2 text-right font-mono text-caos-text">{delta == null ? "—" : `${delta > 0 ? "+" : ""}${formatValue(delta)}`}</td></tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function ModelScenarioMode({ state }: { state: ReadyModelV2Controller }) {
  return (
    <div hidden={state.scenarioMode !== "model"} className="grid gap-3 p-3 lg:grid-cols-[minmax(12rem,0.6fr)_minmax(16rem,1fr)_minmax(10rem,0.5fr)_auto] lg:items-end">
      <ScenarioInputs state={state} />
      <ScenarioActions state={state} />
      <p className="text-caos-xs leading-relaxed text-caos-muted lg:col-span-4">Applies one temporary override to the current working inputs through Model Engine v2. It never enters the manual mutation queue.</p>
      <ScenarioDecisionDeltas state={state} />
    </div>
  );
}

function ScenarioPanel({ state }: { state: ReadyModelV2Controller }) {
  const { issuerId, payload, record, scenarioMode, setScenarioMode } = state;
  if (!record || !payload.ui_preferences.show_scenarios) return null;
  return (
    <Panel title="Scenario modes" right={<span className="text-caos-2xs uppercase tracking-wider text-caos-muted">Server only · not saved</span>}>
      <div role="tablist" aria-label="Scenario mode" className="m-3 mb-0 flex flex-wrap gap-1 rounded border border-caos-border bg-caos-bg p-1">
        <button type="button" role="tab" aria-selected={scenarioMode === "model"} onClick={() => setScenarioMode("model")} className={scenarioMode === "model" ? "caos-action-primary focus-ring" : "caos-action-secondary focus-ring"}>Model scenario</button>
        <button type="button" role="tab" aria-selected={scenarioMode === "network"} onClick={() => setScenarioMode("network")} className={scenarioMode === "network" ? "caos-action-primary focus-ring" : "caos-action-secondary focus-ring"}>Cross-module propagation</button>
      </div>
      <ModelScenarioMode state={state} />
      <div hidden={scenarioMode !== "network"} className="p-3">
        <p className="mb-2 text-caos-xs leading-relaxed text-caos-muted">Propagates EBITDA and rate shocks through the exact completed source run. It does not mutate this draft, its override queue, checkpoints, or reports.</p>
        <ScenarioNetworkPanel issuerId={issuerId} runId={record.source_run_id} />
      </div>
    </Panel>
  );
}

function CalculationControls({ state }: { state: ReadyModelV2Controller }) {
  const { gaps, warnings } = state.calculation;
  if (!gaps.length && !warnings.length) return null;
  return (
    <Panel title="Calculation controls">
      <div className="grid gap-3 p-3 md:grid-cols-2">
        <div><div className="text-caos-2xs uppercase tracking-wider text-caos-muted">Named gaps · {gaps.length}</div>{gaps.length ? <ul className="mt-1 space-y-1 text-caos-xs text-caos-warning">{gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul> : <p className="mt-1 text-caos-xs text-caos-muted">None.</p>}</div>
        <div><div className="text-caos-2xs uppercase tracking-wider text-caos-muted">Invariant warnings · {warnings.length}</div>{warnings.length ? <ul className="mt-1 space-y-1 text-caos-xs text-caos-warning">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p className="mt-1 text-caos-xs text-caos-muted">None.</p>}</div>
      </div>
    </Panel>
  );
}

type ModelCheckpoint = ReadyModelV2Controller["checkpoints"][number];
type ModelHistoryEvent = ReadyModelV2Controller["history"][number];

function CheckpointRow({ checkpoint, state }: { checkpoint: ModelCheckpoint; state: ReadyModelV2Controller }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-caos-border/60 px-2 py-2 last:border-0">
      <span className="min-w-0 text-caos-xs text-caos-text"><span className="block truncate">{checkpoint.label}</span><span className="tabular text-caos-3xs text-caos-muted">REV {checkpoint.draft_revision} · {fmtLocalDateTime(checkpoint.created_at)}</span></span>
      <Button variant="secondary" onClick={() => void state.restoreCheckpoint(checkpoint)} reason={!state.record ? "Save the suggested draft first" : state.busy !== null ? "An action is already in progress" : null}>Restore</Button>
    </div>
  );
}

function CheckpointControls({ state }: { state: ReadyModelV2Controller }) {
  const { busy, checkpointLabel, checkpoints, contextId, createCheckpoint, dirty, record, requiresRecalculation, setCheckpointLabel } = state;
  const activeContextId = contextId ?? record?.context_id;
  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-caos-xs text-caos-text">Checkpoint label<input name="model-checkpoint-label" autoComplete="off" value={checkpointLabel} maxLength={160} onChange={(event) => setCheckpointLabel(event.target.value)} disabled={!record} className="h-8 rounded border border-caos-border bg-caos-bg px-2 text-caos-text focus-ring disabled:opacity-40" /></label>
        <button type="button" onClick={() => void createCheckpoint()} aria-disabled={(!record || !activeContextId || requiresRecalculation || dirty || busy !== null) || undefined} className="caos-action-secondary focus-ring aria-disabled:opacity-40" title={requiresRecalculation ? "Recalculate and save before checkpointing" : activeContextId ? "Create immutable checkpoint" : "Bind an analysis context before checkpointing"}>{busy === "checkpoint" ? "Creating…" : "Create checkpoint"}</button>
      </div>
      <div className="max-h-48 overflow-auto rounded border border-caos-border">
        {checkpoints.length ? checkpoints.map((checkpoint) => <CheckpointRow key={checkpoint.id} checkpoint={checkpoint} state={state} />) : <p className="p-2 text-caos-xs text-caos-muted">No Model Engine v2 checkpoints.</p>}
      </div>
    </>
  );
}

function HistoryEvent({ event }: { event: ModelHistoryEvent }) {
  return (
    <article aria-label={`Override event ${event.node_id} revision ${event.revision}`} className="space-y-1 border-b border-caos-border/60 px-2 py-2 text-caos-2xs last:border-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><span className="min-w-0 truncate font-mono text-caos-text">{event.node_id}</span><span className="uppercase text-caos-muted">{event.action} · REV {event.revision}</span></div>
      <div className="grid gap-x-3 gap-y-1 text-caos-muted md:grid-cols-2">
        <span>ACTOR <strong className="font-normal text-caos-text">{event.actor_id}</strong> · {formatAuditTime(event.created_at)}</span>
        <span>BEFORE <strong className="font-mono font-normal text-caos-text">{formatOverrideSnapshot(event.before_value)}</strong> → AFTER <strong className="font-mono font-normal text-caos-text">{formatOverrideSnapshot(event.after_value)}</strong></span>
        <span>ORIGINAL <strong className="font-mono font-normal text-caos-text">{formatValue(event.original_value?.value ?? null)}</strong> · FORMULA <strong className="font-mono font-normal text-caos-text">{event.original_formula ?? "INPUT"}</strong></span>
        <span>REASON <strong className="font-normal text-caos-text">{event.reason ?? "Not supplied"}</strong></span>
        <span>SCOPE <strong className="font-normal text-caos-text">{event.scope}</strong> · SOURCE <strong className="font-normal text-caos-text">{event.source ?? "Not supplied"}</strong></span>
        <span>EXPIRY <strong className="font-normal text-caos-text">{event.expires_at ? formatAuditTime(event.expires_at) : "None"}</strong></span>
      </div>
    </article>
  );
}

function ModelHistoryPanel({ state }: { state: ReadyModelV2Controller }) {
  return (
    <Panel title="Server history & checkpoints" right={<span className="text-caos-2xs text-caos-muted">{state.history.length} events · {state.checkpoints.length} checkpoints</span>}>
      <div className="space-y-3 p-3">
        <CheckpointControls state={state} />
        <div className="max-h-64 overflow-auto rounded border border-caos-border">
          {state.history.length ? state.history.slice(0, 20).map((event) => <HistoryEvent key={event.id} event={event} />) : <p className="p-2 text-caos-xs text-caos-muted">No committed override history.</p>}
        </div>
      </div>
    </Panel>
  );
}

function ModelV2Notices({ state }: { state: ReadyModelV2Controller }) {
  const { error, initialResponse, notice, record, requiresRecalculation, saveContractMissing } = state;
  return (
    <>
      {error ? <div role="alert" className="rounded border border-caos-critical/60 bg-caos-critical/10 px-3 py-2 text-caos-xs text-caos-critical">{error}</div> : null}
      {notice ? <div role="status" className="rounded border border-caos-border bg-caos-panel px-3 py-2 text-caos-xs text-caos-muted">{notice}</div> : null}
      {record && requiresRecalculation ? <SurfaceState kind="partial" title="Recalculation required" detail={initialResponse.detail ?? "The persisted revision is still visible, but the table shows the current server calculation. Save it explicitly before checkpoint or export."} /> : null}
      {!record ? (
        <SurfaceState
          kind={saveContractMissing ? "error" : "partial"}
          title={saveContractMissing ? "Suggested draft cannot be saved" : "Server suggestion · save before editing"}
          detail={saveContractMissing
            ? "The read contract did not identify the exact owned source run. Editing remains disabled; no source ID was inferred."
            : "This calculation is server-produced and read-only. Save it explicitly to create revision 1 before making overrides."}
        />
      ) : null}
    </>
  );
}

function ModelV2View({ state }: { state: ReadyModelV2Controller }) {
  const { record, workbookImportState } = state;
  return (
    <EnterprisePage
      kind="editor"
      identity={<ModelV2Identity state={state} />}
      primaryAction={ModelV2PrimaryAction({ state })}
      status={<ModelV2Status state={state} />}
      contextualControls={record ? <ModelV2ContextualControls state={state} /> : undefined}
      utilityLabel="Model v2 tools"
      utilityControls={record ? <ModelV2UtilityControls state={state} /> : undefined}
      narrowContract={{ essentialControls: null }}
    >
      <div className="model-v2-workbench flex-1 min-h-0 overflow-auto p-2">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-2">
          <ModelV2Notices state={state} />

          <CalculationNodesPanel state={state} />

          <OverrideEditor state={state} />

          <ScenarioPanel state={state} />

          <CalculationControls state={state} />

          <div className="grid gap-2 xl:grid-cols-2">
            <ModelHistoryPanel state={state} />

            <WorkbookImportPanel state={workbookImportState} />
          </div>
        </div>
      </div>
    </EnterprisePage>
  );
}

export function ModelV2Workbench(props: ModelV2WorkbenchProps) {
  const state = useModelV2Controller(props);
  if (state.kind === "bootstrap") return <ModelV2BootstrapView state={state} />;
  return <ModelV2View state={state} />;
}
