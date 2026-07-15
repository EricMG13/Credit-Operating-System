"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { Panel } from "@/components/shared/Panel";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { useNavigationGuard } from "@/components/shared/NavigationGuardProvider";
import { ScenarioNetworkPanel } from "@/components/model/ScenarioNetworkPanel";
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
    if (events.every((event) => ORIGINAL_HISTORY_ACTIONS.has(event.action))) {
      const eventId = events.map((event) => event.id).sort()[0];
      if (!eventId) continue;
      undoStack.push({ key: `revision:${revision}`, eventId });
      redoStack.length = 0;
      continue;
    }

    const mode = events.every((event) => event.action === "undo")
      ? "undo"
      : events.every((event) => event.action === "redo")
        ? "redo"
        : null;
    const inverseEventIds = events
      .map((event) => event.inverse_event_id)
      .filter((eventId): eventId is string => eventId !== null)
      .sort();
    if (!mode || inverseEventIds.length !== events.length) {
      undoStack.length = 0;
      redoStack.length = 0;
      continue;
    }

    const originalRevisions = new Set(
      inverseEventIds
        .map((eventId) => originalRevisionByEventId.get(eventId))
        .filter((originalRevision): originalRevision is number => originalRevision !== undefined),
    );
    if (originalRevisions.size > 1) {
      undoStack.length = 0;
      redoStack.length = 0;
      continue;
    }
    const originalRevision = originalRevisions.values().next().value as number | undefined;
    const candidate: ReplayCandidate = {
      key: originalRevision === undefined
        ? `events:${inverseEventIds.join("|")}`
        : `revision:${originalRevision}`,
      eventId: inverseEventIds[0],
    };
    if (mode === "undo") {
      const prior = removeReplayCandidate(undoStack, candidate.key) ?? candidate;
      removeReplayCandidate(redoStack, candidate.key);
      redoStack.push(prior);
    } else {
      const prior = removeReplayCandidate(redoStack, candidate.key) ?? candidate;
      removeReplayCandidate(undoStack, candidate.key);
      undoStack.push(prior);
    }
  }

  return {
    undoEventId: undoStack.at(-1)?.eventId ?? null,
    redoEventId: redoStack.at(-1)?.eventId ?? null,
  };
}

export function ModelV2Workbench({ issuerId, contextId, exactRunId, initialResponse }: ModelV2WorkbenchProps) {
  const [record, setRecord] = useState<ModelV2DraftRecord | null>(initialResponse.record);
  const [suggestedPayload, setSuggestedPayload] = useState(initialResponse.suggested_payload);
  const [suggestedCalculation, setSuggestedCalculation] = useState(initialResponse.suggested_calculation);
  const [currentCalculation, setCurrentCalculation] = useState(initialResponse.current_calculation);
  const [requiresRecalculation, setRequiresRecalculation] = useState(initialResponse.requires_recalculation);
  const [pending, setPending] = useState<PendingMutations>({});
  const [pendingPreview, setPendingPreview] = useState<PendingPreview | null>(null);
  const [scenarioNodeId, setScenarioNodeId] = useState("");
  const [scenarioNodeQuery, setScenarioNodeQuery] = useState("");
  const [scenarioValue, setScenarioValue] = useState("");
  const [scenarioPreview, setScenarioPreview] = useState<ScenarioPreview | null>(null);
  const [scenarioMode, setScenarioMode] = useState<"model" | "network">("model");
  const [history, setHistory] = useState<ModelV2OverrideEvent[]>([]);
  const [checkpoints, setCheckpoints] = useState<ModelV2Checkpoint[]>([]);
  const [checkpointLabel, setCheckpointLabel] = useState("Analyst checkpoint");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [editorNull, setEditorNull] = useState(false);
  const [editorReason, setEditorReason] = useState("");
  const [editorExpiry, setEditorExpiry] = useState("");
  const [editorInitialExpiry, setEditorInitialExpiry] = useState("");
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warnOnLeave, setWarnOnLeave] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ModelV2WorkbookPreview | null>(null);
  const [importConfirmed, setImportConfirmed] = useState(false);
  const [importMappingText, setImportMappingText] = useState("");
  const [importMapping, setImportMapping] = useState<ModelV2LegacyWorkbookMapping | null>(null);
  const [overrideNow, setOverrideNow] = useState(() => Date.now());
  const [nodeQuery, setNodeQuery] = useState("");
  const [nodePeriodFilter, setNodePeriodFilter] = useState("");
  const [nodePage, setNodePage] = useState(0);
  const editorRef = useRef<HTMLInputElement | null>(null);
  const pendingGenerationRef = useRef(0);
  const scenarioGenerationRef = useRef(0);

  const payload = record?.payload ?? suggestedPayload;
  const baseCalculation = record
    ? (requiresRecalculation ? currentCalculation ?? record.calculation : record.calculation)
    : suggestedCalculation;
  const pendingFingerprint = useMemo(
    () => fingerprintPendingMutations(pending),
    [pending],
  );
  const previewCalculation = pendingPreview?.pendingFingerprint === pendingFingerprint
    ? pendingPreview.calculation
    : null;
  const calculation = previewCalculation ?? baseCalculation;
  const recordId = record?.id;
  const nodes = useMemo(() => flattenNodes(calculation), [calculation]);
  const nodePeriods = useMemo(() => Array.from(new Map(
    nodes.map((node) => [node.period_key, node.period_label]),
  )), [nodes]);
  const filteredNodes = useMemo(() => {
    const normalizedQuery = nodeQuery.trim().toLowerCase();
    return nodes.filter((node) => (
      (!nodePeriodFilter || node.period_key === nodePeriodFilter)
      && (!normalizedQuery || node.node_id.toLowerCase().includes(normalizedQuery))
    ));
  }, [nodePeriodFilter, nodeQuery, nodes]);
  const nodePageCount = Math.max(1, Math.ceil(filteredNodes.length / NODE_PAGE_SIZE));
  const boundedNodePage = Math.min(nodePage, nodePageCount - 1);
  const visibleNodes = useMemo(() => {
    const start = boundedNodePage * NODE_PAGE_SIZE;
    return filteredNodes.slice(start, start + NODE_PAGE_SIZE);
  }, [boundedNodePage, filteredNodes]);
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
  const activeScenarioPreview = scenarioPreview?.pendingFingerprint === pendingFingerprint
    ? scenarioPreview
    : null;
  const scenarioResultNode = useMemo(
    () => flattenNodes(activeScenarioPreview?.calculation ?? null)
      .find((node) => node.node_id === activeScenarioPreview?.nodeId) ?? null,
    [activeScenarioPreview],
  );
  const scenarioPeriod = scenarioPeriodKey(activeScenarioPreview?.nodeId ?? "");
  const scenarioBaselinePeriod = activeScenarioPreview?.baseline.periods
    .find((period) => period.period_key === scenarioPeriod) ?? null;
  const scenarioResultPeriod = activeScenarioPreview?.calculation.periods
    .find((period) => period.period_key === scenarioPeriod) ?? null;
  const selectedNode = nodes.find((node) => node.node_id === selectedNodeId) ?? null;
  const activeOverrides = useMemo(
    () => new Map(
      (record?.payload.overrides ?? [])
        .filter((item) => {
          if (!item.expires_at) return true;
          const expiresAt = Date.parse(item.expires_at);
          return Number.isFinite(expiresAt) && expiresAt > overrideNow;
        })
        .map((item) => [item.node_id, item]),
    ),
    [overrideNow, record?.payload.overrides],
  );
  const pendingCount = Object.keys(pending).length;
  const selectedOverride = selectedNode
    ? activeOverrides.get(selectedNode.node_id)
    : undefined;
  const editorDirty = selectedNode !== null && (
    editorNull !== (selectedOverride?.value_type === "null" || selectedNode.value == null)
    || editorValue !== (
      selectedOverride?.value != null
        ? String(selectedOverride.value)
        : selectedNode.value != null
          ? String(selectedNode.value)
          : ""
    )
    || editorReason !== (selectedOverride?.reason ?? selectedNode.override_reason ?? "")
    || (requiresOverrideReason(selectedNode.node_id) && editorExpiry !== editorInitialExpiry)
  );
  const dirty = pendingCount > 0 || editorDirty;

  const discardPending = useCallback(() => {
    pendingGenerationRef.current += 1;
    scenarioGenerationRef.current += 1;
    setPending({});
    setPendingPreview(null);
    setScenarioNodeId("");
    setScenarioValue("");
    setScenarioPreview(null);
    setSelectedNodeId(null);
    setError(null);
  }, []);
  useNavigationGuard({ dirty, enabled: warnOnLeave, onDiscard: discardPending });

  useEffect(() => {
    const expiries = (record?.payload.overrides ?? [])
      .map((item) => item.expires_at ? Date.parse(item.expires_at) : Number.NaN)
      .filter((value) => Number.isFinite(value) && value > overrideNow);
    if (!expiries.length) return;
    const delay = Math.min(Math.max(Math.min(...expiries) - Date.now() + 25, 0), 2_147_483_647);
    const timer = window.setTimeout(() => {
      setOverrideNow(Date.now());
      // The local expiry deadline is already enough to invalidate a reviewed
      // preview. Fail closed before the refresh so a network error cannot
      // leave stale preview/commit controls enabled.
      pendingGenerationRef.current += 1;
      scenarioGenerationRef.current += 1;
      setPendingPreview(null);
      setScenarioPreview(null);
      setRequiresRecalculation(true);
      setNotice("An override expired. Refreshing the current server calculation; save it before checkpoint or export.");
      const refresh = exactRunId
        ? getModelV2(issuerId, exactRunId)
        : getModelV2(issuerId);
      void refresh
        .then((next) => {
          if (
            !record
            || !next.record
            || next.record.id !== record.id
            || next.record.revision !== record.revision
          ) return;
          setCurrentCalculation(next.current_calculation);
          setRequiresRecalculation(true);
          setNotice("An override expired. The current server calculation is shown; save it before checkpoint or export.");
        })
        .catch(() => {
          setNotice("An override expired, but the current server calculation could not be refreshed.");
        });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [exactRunId, issuerId, overrideNow, record]);

  useEffect(() => {
    let active = true;
    getAnalystSettings()
      .then((settings) => {
        if (active) setWarnOnLeave(readWarnOnUnsavedLeave(settings));
      })
      .catch(() => {
        // Default true is deliberately fail-safe when the persisted preference is unavailable.
      });
    return () => { active = false; };
  }, []);

  const refreshArtifacts = useCallback(async () => {
    if (!record) {
      setHistory([]);
      setCheckpoints([]);
      return;
    }
    const [nextHistory, nextCheckpoints] = await Promise.all([
      getModelV2History(issuerId),
      getModelV2Checkpoints(issuerId),
    ]);
    setHistory(nextHistory);
    setCheckpoints(nextCheckpoints);
  }, [issuerId, record]);

  useEffect(() => {
    let active = true;
    if (!recordId) return;
    Promise.all([getModelV2History(issuerId), getModelV2Checkpoints(issuerId)])
      .then(([nextHistory, nextCheckpoints]) => {
        if (!active) return;
        setHistory(nextHistory);
        setCheckpoints(nextCheckpoints);
      })
      .catch(() => {
        if (active) setNotice("History or checkpoints could not be loaded.");
      });
    return () => { active = false; };
  }, [issuerId, recordId]);

  useEffect(() => {
    if (selectedNode) editorRef.current?.focus();
  }, [selectedNode]);

  const adoptRecord = useCallback((next: ModelV2DraftRecord, message: string) => {
    pendingGenerationRef.current += 1;
    scenarioGenerationRef.current += 1;
    setRecord(next);
    setSuggestedPayload(null);
    setSuggestedCalculation(null);
    setCurrentCalculation(null);
    setRequiresRecalculation(false);
    setPending({});
    setPendingPreview(null);
    setScenarioNodeId("");
    setScenarioValue("");
    setScenarioPreview(null);
    setSelectedNodeId(null);
    setError(null);
    setNotice(message);
  }, []);

  const saveSuggestion = async () => {
    if (!suggestedPayload || !initialResponse.suggested_source_run_id || busy) return;
    setBusy("save-suggestion");
    setError(null);
    try {
      const next = await saveModelV2(issuerId, {
        payload: suggestedPayload,
        expected_revision: 0,
        context_id: contextId,
        source_run_id: initialResponse.suggested_source_run_id,
      });
      adoptRecord(next, "Suggested server draft saved. Editing is now enabled.");
    } catch (reason) {
      setError(toErrorMessage(reason, "Suggested model draft could not be saved."));
    } finally {
      setBusy(null);
    }
  };

  const recalculateAndSave = async () => {
    if (!record || !requiresRecalculation || dirty || busy) return;
    setBusy("recalculate");
    setError(null);
    try {
      const next = await saveModelV2(issuerId, {
        payload: record.payload,
        expected_revision: record.revision,
        context_id: record.context_id,
        source_run_id: record.source_run_id,
      });
      adoptRecord(next, `Current server calculation saved as revision ${next.revision}.`);
      await refreshArtifacts();
    } catch (reason) {
      setError(toErrorMessage(reason, "Current model calculation could not be saved."));
    } finally {
      setBusy(null);
    }
  };

  const beginEdit = (node: DisplayNode) => {
    if (editorDirty || busy) return;
    const existing = activeOverrides.get(node.node_id);
    setSelectedNodeId(node.node_id);
    setEditorNull(existing?.value_type === "null" || node.value == null);
    setEditorValue(existing?.value != null ? String(existing.value) : node.value != null ? String(node.value) : "");
    setEditorReason(existing?.reason ?? node.override_reason ?? "");
    const expiry = requiresOverrideReason(node.node_id)
      ? toDateTimeLocal(existing?.expires_at)
      : "";
    setEditorExpiry(expiry);
    setEditorInitialExpiry(expiry);
    setError(null);
  };

  const queueOverride = () => {
    if (!record || !selectedNode) return;
    const reason = editorReason.trim();
    if (requiresOverrideReason(selectedNode.node_id) && !reason) {
      setError("A derived-cell override requires a non-empty reason.");
      return;
    }
    const derivedExpiry = requiresOverrideReason(selectedNode.node_id)
      ? futureIso(editorExpiry)
      : null;
    if (requiresOverrideReason(selectedNode.node_id) && derivedExpiry === null) {
      setError("A derived-cell override requires a future expiry.");
      return;
    }
    const parsed = Number(editorValue);
    if (!editorNull && (!editorValue.trim() || !Number.isFinite(parsed))) {
      setError("Enter a finite number or select Set unavailable (null).");
      return;
    }
    const override: ModelV2CellOverride = {
      node_id: selectedNode.node_id,
      value_type: editorNull ? "null" : "number",
      value: editorNull ? null : parsed,
      reason: reason || null,
      scope: "draft",
      source: "analyst-ui",
      expires_at: derivedExpiry,
    };
    pendingGenerationRef.current += 1;
    setPending((current) => ({
      ...current,
      [override.node_id]: { action: "set", override },
    }));
    setPendingPreview(null);
    scenarioGenerationRef.current += 1;
    setScenarioPreview(null);
    setSelectedNodeId(null);
    setError(null);
    setNotice(`${override.node_id} queued locally. Preview before committing.`);
  };

  const restoreNode = (nodeId: string) => {
    if (editorDirty || busy) return;
    pendingGenerationRef.current += 1;
    setPending((current) => {
      const next = { ...current };
      if (activeOverrides.has(nodeId)) next[nodeId] = { action: "reset", node_id: nodeId };
      else delete next[nodeId];
      return next;
    });
    setPendingPreview(null);
    scenarioGenerationRef.current += 1;
    setScenarioPreview(null);
    setSelectedNodeId(null);
    setError(null);
    setNotice(`${nodeId} restoration queued locally.`);
  };

  const previewPending = async () => {
    if (
      !record
      || !payload
      || requiresRecalculation
      || pendingCount === 0
      || editorDirty
      || busy
    ) return;
    const requestFingerprint = pendingFingerprint;
    const requestGeneration = pendingGenerationRef.current;
    setBusy("preview");
    setError(null);
    try {
      const next = await calculateModelV2(issuerId, {
        payload: payloadWithPendingMutations(payload, pending),
        context_id: contextId ?? record.context_id,
        source_run_id: record.source_run_id,
      });
      if (pendingGenerationRef.current !== requestGeneration) {
        setPendingPreview(null);
        setNotice("Pending edits changed while the server preview was running. Preview again before committing.");
        return;
      }
      setPendingPreview({ calculation: next, pendingFingerprint: requestFingerprint });
      setNotice("Server preview refreshed. No mutation has been committed.");
    } catch (reason) {
      setPendingPreview(null);
      if (pendingGenerationRef.current !== requestGeneration) {
        setError(null);
        setNotice("Pending edits changed while the server preview was running. Preview again before committing.");
        return;
      }
      setError(toErrorMessage(reason, "Server preview failed. Pending edits remain local."));
    } finally {
      setBusy(null);
    }
  };

  const resetScenario = () => {
    scenarioGenerationRef.current += 1;
    setScenarioNodeId("");
    setScenarioNodeQuery("");
    setScenarioValue("");
    setScenarioPreview(null);
    setError(null);
    setNotice("Transient sensitivity reset. Manual pending overrides are unchanged.");
  };

  const previewScenario = async () => {
    const parsedValue = Number(scenarioValue);
    if (
      !record
      || !payload
      || requiresRecalculation
      || !scenarioNodeId
      || !scenarioValue.trim()
      || !Number.isFinite(parsedValue)
      || editorDirty
      || busy
    ) return;
    const requestGeneration = ++scenarioGenerationRef.current;
    const requestPendingGeneration = pendingGenerationRef.current;
    const workingPayload = payloadWithPendingMutations(payload, pending);
    const scenarioOverride: ModelV2CellOverride = {
      node_id: scenarioNodeId,
      value_type: "number",
      value: parsedValue,
      reason: "Transient sensitivity preview",
      scope: "scenario",
      source: "analyst-ui-scenario",
      // Scenario replacements are never persisted, but derived-node previews
      // still honor the same bounded-governance contract as committed edits.
      expires_at: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
    };
    const scenarioPayload = payloadWithPendingMutations(workingPayload, {
      [scenarioNodeId]: { action: "set", override: scenarioOverride },
    });
    setBusy("scenario-preview");
    setError(null);
    try {
      const requestContext = {
        context_id: contextId ?? record.context_id,
        source_run_id: record.source_run_id,
      };
      const [baseline, next] = await Promise.all([
        calculateModelV2(issuerId, {
          payload: workingPayload,
          ...requestContext,
        }),
        calculateModelV2(issuerId, {
          payload: scenarioPayload,
          ...requestContext,
        }),
      ]);
      if (
        scenarioGenerationRef.current !== requestGeneration
        || pendingGenerationRef.current !== requestPendingGeneration
      ) {
        setScenarioPreview(null);
        setNotice("Working inputs changed while the sensitivity was running. Preview again.");
        return;
      }
      setScenarioPreview({
        baseline,
        calculation: next,
        pendingFingerprint,
        nodeId: scenarioNodeId,
        value: parsedValue,
      });
      setNotice("Transient sensitivity calculated on the server. It will not be committed.");
    } catch (reason) {
      setScenarioPreview(null);
      setError(toErrorMessage(reason, "Transient sensitivity could not be calculated."));
    } finally {
      setBusy(null);
    }
  };

  const commitPending = async () => {
    if (
      !record
      || requiresRecalculation
      || pendingCount === 0
      || editorDirty
      || !previewCalculation
      || busy
    ) return;
    setBusy("commit");
    setError(null);
    try {
      const next = await mutateModelV2OverridesBatch(issuerId, {
        expected_revision: record.revision,
        mutations: Object.values(pending),
      });
      adoptRecord(next, `${pendingCount} pending mutation${pendingCount === 1 ? "" : "s"} committed atomically.`);
      await refreshArtifacts();
    } catch (reason) {
      setError(toErrorMessage(reason, "Pending model mutations were not committed."));
    } finally {
      setBusy(null);
    }
  };

  const { undoEventId, redoEventId } = useMemo(
    () => deriveHistoryReplayCandidates(history),
    [history],
  );
  const replayHistory = async (mode: "undo" | "redo") => {
    const eventId = mode === "undo" ? undoEventId : redoEventId;
    if (!record || !eventId || dirty || busy) return;
    setBusy("history");
    setError(null);
    try {
      const next = await replayModelV2Override(issuerId, eventId, {
        expected_revision: record.revision,
        mode,
      });
      adoptRecord(next, `${mode === "undo" ? "Undo" : "Redo"} committed as revision ${next.revision}.`);
      await refreshArtifacts();
    } catch (reason) {
      setError(toErrorMessage(reason, `${mode === "undo" ? "Undo" : "Redo"} failed.`));
    } finally {
      setBusy(null);
    }
  };

  const createCheckpoint = async () => {
    const checkpointContextId = contextId ?? record?.context_id;
    if (!record || !checkpointContextId || requiresRecalculation || dirty || busy) return;
    setBusy("checkpoint");
    setError(null);
    try {
      const created = await createModelV2Checkpoint(issuerId, {
        context_id: checkpointContextId,
        label: checkpointLabel.trim() || "Analyst checkpoint",
        issuer_run_id: record.source_run_id,
        expected_revision: record.revision,
        calculation_hash: record.calculation_hash,
      });
      setCheckpoints((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setRecord((current) => current
        ? { ...current, revision: created.draft_revision }
        : current);
      setNotice(`Checkpoint ${created.id.slice(0, 8)} created from revision ${created.draft_revision}.`);
    } catch (reason) {
      setError(toErrorMessage(reason, "Checkpoint could not be created."));
    } finally {
      setBusy(null);
    }
  };

  const restoreCheckpoint = async (checkpoint: ModelV2Checkpoint) => {
    if (!record || busy) return;
    if (dirty && !window.confirm("Discard local pending edits and restore this checkpoint?")) return;
    setBusy("restore");
    setError(null);
    try {
      const next = await restoreModelV2Checkpoint(issuerId, checkpoint.id, {
        expected_revision: record.revision,
      });
      adoptRecord(next, `Checkpoint ${checkpoint.label} restored as revision ${next.revision}.`);
      await refreshArtifacts();
    } catch (reason) {
      setError(toErrorMessage(reason, "Checkpoint could not be restored."));
    } finally {
      setBusy(null);
    }
  };

  const downloadWorkbook = async () => {
    if (!record || requiresRecalculation || dirty || busy) return;
    setBusy("export");
    setError(null);
    try {
      const exported = await exportModelV2Workbook(issuerId);
      const url = URL.createObjectURL(exported.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = exported.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice(`Workbook exported from revision ${exported.revision ?? record.revision}.`);
    } catch (reason) {
      setError(toErrorMessage(reason, "Model workbook export failed."));
    } finally {
      setBusy(null);
    }
  };

  const previewImport = async () => {
    if (!importFile || dirty || busy) return;
    let mapping: ModelV2LegacyWorkbookMapping | null;
    try {
      mapping = parseLegacyMapping(importMappingText);
    } catch (reason) {
      setImportPreview(null);
      setImportConfirmed(false);
      setImportMapping(null);
      setError(toErrorMessage(reason, "Close-format mapping JSON is invalid."));
      return;
    }
    setBusy("import-preview");
    setError(null);
    setImportConfirmed(false);
    try {
      const next = await previewModelV2Workbook({
        issuerId,
        file: importFile,
        expectedRevision: record?.revision ?? 0,
        ...(mapping ? { mapping } : {}),
      });
      const reviewedMapping = next.mapping ?? mapping;
      setImportPreview(next);
      setImportMapping(reviewedMapping);
      if (reviewedMapping) {
        setImportMappingText(JSON.stringify(reviewedMapping, null, 2));
      }
      setNotice("Workbook preview completed without writing model state.");
    } catch (reason) {
      setImportPreview(null);
      setError(toErrorMessage(reason, "Model workbook preview failed."));
    } finally {
      setBusy(null);
    }
  };

  const commitImport = async () => {
    if (!importFile || !importPreview || !importConfirmed || !importPreview.preview_token || dirty || busy) return;
    setBusy("import-commit");
    setError(null);
    try {
      const committed = await commitModelV2Workbook({
        issuerId,
        file: importFile,
        preview: importPreview,
        ...(importMapping ? { mapping: importMapping } : {}),
      });
      adoptRecord(
        committed.record,
        `${committed.existing ? "Existing" : "New"} workbook import committed at revision ${committed.committed_revision}.`,
      );
      setImportConfirmed(false);
      setImportPreview(null);
      await refreshArtifacts();
    } catch (reason) {
      setError(toErrorMessage(reason, "Model workbook commit failed. Preview again before retrying."));
    } finally {
      setBusy(null);
    }
  };

  const setCloseFormatTemplate = () => {
    const next = structuredClone(CLOSE_FORMAT_MAPPING_TEMPLATE);
    setImportMapping(next);
    setImportMappingText(JSON.stringify(next, null, 2));
    setImportPreview(null);
    setImportConfirmed(false);
    setError(null);
    setNotice("Close-format mapping template loaded. Enter reporting currency and unit, then review sheet names and headers before previewing.");
  };

  const setMatrixTemplate = () => {
    const next = structuredClone(MATRIX_MAPPING_TEMPLATE);
    setImportMapping(next);
    setImportMappingText(JSON.stringify(next, null, 2));
    setImportPreview(null);
    setImportConfirmed(false);
    setError(null);
    setNotice("Account-row matrix template loaded. Enter reporting currency and unit, bind stable period keys, and review every row and column selector.");
  };

  const updateMappingText = (value: string) => {
    setImportMappingText(value);
    setImportMapping(null);
    setImportPreview(null);
    setImportConfirmed(false);
    setError(null);
  };

  const resolveAmbiguity = (
    ambiguity: ModelV2WorkbookMappingAmbiguity,
    candidate: string,
  ) => {
    const column = ambiguityColumn(candidate);
    let mapping: ModelV2LegacyWorkbookMapping | null = importMapping;
    if (!mapping) {
      try {
        mapping = parseLegacyMapping(importMappingText);
      } catch (reason) {
        setError(toErrorMessage(reason, "Close-format mapping JSON is invalid."));
        return;
      }
    }
    const table = mapping?.[ambiguity.table];
    if (!mapping || !table || column === null) {
      setError("The selected duplicate header could not be bound to this mapping.");
      return;
    }
    let next: ModelV2LegacyWorkbookMapping;
    if (ambiguity.table === "assumptions" && table.layout === "account_period_matrix") {
      const selectorUpdate = ambiguity.selector === "row"
        ? {
            account_row_indices: {
              ...(table.account_row_indices ?? {}),
              [ambiguity.field]: column,
            },
          }
        : ambiguity.field === "account_column"
          ? { account_column_index: column }
          : {
              period_column_indices: {
                ...(table.period_column_indices ?? {}),
                [ambiguity.field]: column,
              },
            };
      next = {
        ...mapping,
        assumptions: { ...table, ...selectorUpdate },
      };
    } else if ("columns" in table) {
      next = {
        ...mapping,
        [ambiguity.table]: {
          ...table,
          column_indices: {
            ...(table.column_indices ?? {}),
            [ambiguity.field]: column,
          },
        },
      };
    } else {
      setError("The selected ambiguity does not match this mapping layout.");
      return;
    }
    setImportMapping(next);
    setImportMappingText(JSON.stringify(next, null, 2));
    setImportConfirmed(false);
    setError(null);
    setNotice("Duplicate header selection recorded locally. Re-preview to validate the resolved mapping.");
  };

  const workbookImportPanel = (
    <Panel title="Workbook import" right={<span className="text-caos-2xs text-caos-muted">.xlsx · preview first</span>}>
      <div className="space-y-3 p-3">
        <p className="text-caos-xs leading-relaxed text-caos-muted">
          Preview is read-only. Commit revalidates the same bytes and atomically creates or replaces the canonical model revision.
        </p>
        <label className="block text-caos-xs text-caos-text">
          Model workbook
          <input
            type="file"
            accept={`.xlsx,${XLSX_MIME}`}
            onChange={(event) => {
              setImportFile(event.target.files?.[0] ?? null);
              setImportPreview(null);
              setImportConfirmed(false);
              setError(null);
            }}
            className="mt-1 block w-full text-caos-xs text-caos-muted file:mr-2 file:rounded file:border file:border-caos-border file:bg-caos-elevated file:px-2 file:py-1 file:text-caos-text"
          />
        </label>
        <div className="rounded border border-caos-border bg-caos-bg/40 p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-caos-xs text-caos-muted">
              Canonical CAOS exports need no mapping. For a close-format workbook, provide reviewed column bindings.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={setCloseFormatTemplate}
                disabled={busy !== null}
                className="caos-action-secondary focus-ring disabled:opacity-40"
              >
                Use row-record template
              </button>
              <button
                type="button"
                onClick={setMatrixTemplate}
                disabled={busy !== null}
                className="caos-action-secondary focus-ring disabled:opacity-40"
              >
                Use account matrix template
              </button>
            </div>
          </div>
          <label className="mt-2 block text-caos-xs text-caos-text">
            Close-format mapping JSON · currency and unit required when used
            <textarea
              value={importMappingText}
              onChange={(event) => updateMappingText(event.target.value)}
              rows={importMappingText ? 10 : 3}
              spellCheck={false}
              placeholder='{"mode":"mapped_legacy", ...}'
              className="mt-1 block w-full resize-y rounded border border-caos-border bg-caos-bg p-2 font-mono text-caos-2xs text-caos-text focus-ring"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void previewImport()}
          disabled={!importFile || dirty || busy !== null}
          className="caos-action-secondary focus-ring disabled:opacity-40"
        >
          {busy === "import-preview" ? "Validating…" : "Preview workbook"}
        </button>
        {importPreview ? (
          <div className="space-y-2 rounded border border-caos-border bg-caos-bg/50 p-2 text-caos-xs">
            <p className="tabular text-caos-text">
              {importPreview.mode} · {importPreview.sheet_names.length} sheets · {importPreview.warning_count} warnings · {importPreview.blocking_count} blocking
            </p>
            <p className="text-caos-muted">
              {importPreview.formula_audit.length} formulas audited · calculation {importPreview.calculation?.status ?? "unavailable"}
            </p>
            {importPreview.ambiguities.length ? (
              <fieldset className="space-y-2 rounded border border-caos-warning/60 p-2">
                <legend className="px-1 text-caos-2xs uppercase tracking-wider text-caos-warning">
                  Duplicate rows or columns · analyst selection required
                </legend>
                {importPreview.ambiguities.map((ambiguity) => {
                  const table = importMapping?.[ambiguity.table];
                  const selectedSource = table && "columns" in table
                    ? table.column_indices?.[ambiguity.field]
                    : table?.layout === "account_period_matrix"
                      ? ambiguity.selector === "row"
                        ? table.account_row_indices?.[ambiguity.field]
                        : ambiguity.field === "account_column"
                          ? table.account_column_index
                          : table.period_column_indices?.[ambiguity.field]
                      : undefined;
                  return (
                    <label key={`${ambiguity.table}-${ambiguity.field}-${ambiguity.selector}`} className="grid gap-1 text-caos-xs text-caos-text sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] sm:items-center">
                      <span>{ambiguity.table} · {ambiguity.field}</span>
                      <select
                        aria-label={`Source ${ambiguity.selector} for ${ambiguity.table} ${ambiguity.field}`}
                        value={selectedSource ? String(selectedSource) : ""}
                        onChange={(event) => {
                          const candidate = ambiguity.candidates.find(
                            (item) => ambiguityColumn(item) === Number(event.target.value),
                          );
                          if (candidate) resolveAmbiguity(ambiguity, candidate);
                        }}
                        className="h-8 rounded border border-caos-border bg-caos-bg px-2 text-caos-text focus-ring"
                      >
                        <option value="">Select reviewed {ambiguity.selector}</option>
                        {ambiguity.candidates.map((candidate) => {
                          const column = ambiguityColumn(candidate);
                          return column === null ? null : <option key={candidate} value={column}>{candidate}</option>;
                        })}
                      </select>
                    </label>
                  );
                })}
                <p className="text-caos-muted">Re-preview after resolving every duplicate row or column. Commit remains disabled until the server validates the exact mapping.</p>
              </fieldset>
            ) : null}
            {importPreview.issues.length ? (
              <ul className="max-h-28 space-y-1 overflow-auto" aria-label="Model workbook validation issues">
                {importPreview.issues.slice(0, 20).map((issue, index) => (
                  <li key={`${issue.code}-${issue.sheet ?? "all"}-${issue.cell ?? index}`} className={issue.severity === "blocking" ? "text-caos-critical" : "text-caos-warning"}>
                    {issue.severity === "blocking" ? "BLOCK" : "WARN"} · {issue.message}
                  </li>
                ))}
              </ul>
            ) : <p className="text-caos-success">No validation issues.</p>}
            <label className="flex items-start gap-2 text-caos-xs text-caos-text">
              <input
                type="checkbox"
                checked={importConfirmed}
                onChange={(event) => setImportConfirmed(event.target.checked)}
                disabled={importPreview.blocking_count > 0 || importPreview.ambiguities.length > 0 || !importPreview.preview_token}
                className="mt-0.5 focus-ring"
              />
              I reviewed this preview and confirm creating or replacing the canonical model revision.
            </label>
            <button
              type="button"
              onClick={() => void commitImport()}
              disabled={!importConfirmed || !importPreview.preview_token || importPreview.blocking_count > 0 || importPreview.ambiguities.length > 0 || busy !== null}
              className="caos-primary-action focus-ring disabled:opacity-40"
            >
              {busy === "import-commit" ? "Committing…" : "Commit workbook import"}
            </button>
          </div>
        ) : null}
      </div>
    </Panel>
  );

  if (!payload || !baseCalculation || !calculation) {
    const kind = initialResponse.availability === "unavailable" ? "unavailable" : "partial";
    return (
      <EnterprisePage
        kind="editor"
        identity={<ShellIdentity tag="MODEL V2" title={`${issuerId} — canonical model`} />}
        narrowContract={{ essentialControls: null }}
      >
        <div className="space-y-3 p-3">
          {error ? (
            <div role="alert" className="rounded border border-caos-critical/60 bg-caos-critical/10 px-3 py-2 text-caos-xs text-caos-critical">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div role="status" className="rounded border border-caos-border bg-caos-panel px-3 py-2 text-caos-xs text-caos-muted">
              {notice}
            </div>
          ) : null}
          <SurfaceState
            kind={kind}
            title="Canonical model unavailable"
            detail={initialResponse.detail ?? "The server did not return a saved or suggested Model Engine v2 calculation."}
          />
          {workbookImportPanel}
        </div>
      </EnterprisePage>
    );
  }

  const saveContractMissing = !record && !initialResponse.suggested_source_run_id;
  const status = calculation.status;
  const statusColor = status === "ready"
    ? "var(--caos-success)"
    : status === "partial"
      ? "var(--caos-warning)"
      : "var(--caos-critical)";

  return (
    <EnterprisePage
      kind="editor"
      identity={
        <ShellIdentity
          tag="MODEL V2"
          title={`${issuerId} — canonical model`}
          badges={
            <span className="tabular text-caos-2xs uppercase tracking-wider" style={{ color: statusColor }}>
              {payload.reporting_currency} · {payload.reporting_unit} · {status.replace("_", " ")} · {record ? `REV ${record.revision}` : "SUGGESTED"}
            </span>
          }
        />
      }
      primaryAction={record ? (
        <span className="flex items-center gap-1">
          {requiresRecalculation ? (
            <button
              type="button"
              onClick={() => void recalculateAndSave()}
              disabled={dirty || busy !== null}
              title={dirty ? "Commit or discard local pending edits first" : "Persist the current server calculation without changing model inputs"}
              className="caos-primary-action focus-ring disabled:opacity-40"
            >
              {busy === "recalculate" ? "Saving…" : "Recalculate & save"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void commitPending()}
            disabled={requiresRecalculation || pendingCount === 0 || editorDirty || !previewCalculation || busy !== null}
            className={requiresRecalculation
              ? "caos-action-secondary focus-ring disabled:opacity-40"
              : "caos-primary-action focus-ring disabled:opacity-40"}
          >
            {busy === "commit" ? "Committing…" : `Commit ${pendingCount} pending`}
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => void saveSuggestion()}
          disabled={saveContractMissing || busy !== null}
          className="caos-primary-action focus-ring disabled:opacity-40"
        >
          {busy === "save-suggestion" ? "Saving…" : "Save suggested draft"}
        </button>
      )}
      status={
        <span className="tabular text-caos-2xs text-caos-muted">
          {dirty
            ? editorDirty
              ? `${pendingCount ? `${pendingCount} pending · ` : ""}editor change · not queued`
              : `${pendingCount} local · not saved`
            : record && requiresRecalculation
              ? `Saved ${record.calculation_hash.slice(0, 10)} · current ${calculation.calculation_hash.slice(0, 10)} · save required`
              : record
                ? `Hash ${record.calculation_hash.slice(0, 10)}`
                : "Read-only server suggestion"}
          {` · leave warning ${warnOnLeave ? "on" : "off"}`}
        </span>
      }
      contextualControls={record ? (
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void previewPending()}
            disabled={requiresRecalculation || pendingCount === 0 || editorDirty || busy !== null}
            className="caos-action-secondary focus-ring disabled:opacity-40"
          >
            {busy === "preview" ? "Calculating…" : "Preview pending"}
          </button>
          <button
            type="button"
            onClick={() => void replayHistory("undo")}
            disabled={!undoEventId || dirty || busy !== null}
            className="caos-action-secondary focus-ring disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => void replayHistory("redo")}
            disabled={!redoEventId || dirty || busy !== null}
            className="caos-action-secondary focus-ring disabled:opacity-40"
          >
            Redo
          </button>
        </span>
      ) : undefined}
      utilityLabel="Model v2 tools"
      utilityControls={record ? (
        <>
          <button
            type="button"
            onClick={() => void downloadWorkbook()}
            disabled={requiresRecalculation || dirty || busy !== null}
            title={requiresRecalculation ? "Recalculate and save before exporting" : "Export the persisted canonical workbook"}
            className="caos-action-secondary focus-ring disabled:opacity-40"
          >
            {busy === "export" ? "Exporting…" : "Export workbook"}
          </button>
        </>
      ) : undefined}
      narrowContract={{ essentialControls: null }}
    >
      <div className="model-v2-workbench flex-1 min-h-0 overflow-auto p-2">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-2">
          {error ? (
            <div role="alert" className="rounded border border-caos-critical/60 bg-caos-critical/10 px-3 py-2 text-caos-xs text-caos-critical">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div role="status" className="rounded border border-caos-border bg-caos-panel px-3 py-2 text-caos-xs text-caos-muted">
              {notice}
            </div>
          ) : null}
          {record && requiresRecalculation ? (
            <SurfaceState
              kind="partial"
              title="Recalculation required"
              detail={initialResponse.detail
                ?? "The persisted revision is still visible, but the table shows the current server calculation. Save it explicitly before checkpoint or export."}
            />
          ) : null}
          {!record ? (
            <SurfaceState
              kind={saveContractMissing ? "error" : "partial"}
              title={saveContractMissing ? "Suggested draft cannot be saved" : "Server suggestion · save before editing"}
              detail={saveContractMissing
                ? "The read contract did not identify the exact owned source run. Editing remains disabled; no source ID was inferred."
                : "This calculation is server-produced and read-only. Save it explicitly to create revision 1 before making overrides."}
            />
          ) : null}

          <Panel
            title="Calculation nodes"
            right={
              <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
                {filteredNodes.length === nodes.length
                  ? `${nodes.length} stable nodes`
                  : `${filteredNodes.length} of ${nodes.length} stable nodes`} · {previewCalculation
                  ? "server preview"
                  : record && requiresRecalculation
                    ? "current · save required"
                    : record
                      ? "saved"
                      : "suggested"}
              </span>
            }
          >
            <div className="flex flex-wrap items-end gap-2 border-b border-caos-border p-2">
              <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-caos-2xs uppercase tracking-wider text-caos-muted">
                Filter nodes
                <input
                  aria-label="Filter calculation nodes"
                  value={nodeQuery}
                  onChange={(event) => {
                    setNodeQuery(event.target.value);
                    setNodePage(0);
                  }}
                  placeholder="Stable node ID"
                  className="h-8 rounded border border-caos-border bg-caos-bg px-2 font-mono text-caos-xs normal-case tracking-normal text-caos-text focus-ring"
                />
              </label>
              <label className="flex min-w-[12rem] flex-col gap-1 text-caos-2xs uppercase tracking-wider text-caos-muted">
                Period
                <select
                  aria-label="Filter calculation period"
                  value={nodePeriodFilter}
                  onChange={(event) => {
                    setNodePeriodFilter(event.target.value);
                    setNodePage(0);
                  }}
                  className="h-8 rounded border border-caos-border bg-caos-bg px-2 text-caos-xs normal-case tracking-normal text-caos-text focus-ring"
                >
                  <option value="">All periods</option>
                  {nodePeriods.map(([periodKey, periodLabel]) => (
                    <option key={periodKey} value={periodKey}>{periodLabel} · {periodKey}</option>
                  ))}
                </select>
              </label>
              <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
                Page {boundedNodePage + 1} / {nodePageCount}
              </span>
              <button
                type="button"
                onClick={() => setNodePage((current) => Math.max(0, current - 1))}
                disabled={boundedNodePage === 0}
                className="caos-action-secondary focus-ring disabled:opacity-40"
              >
                Previous nodes
              </button>
              <button
                type="button"
                onClick={() => setNodePage((current) => Math.min(nodePageCount - 1, current + 1))}
                disabled={boundedNodePage >= nodePageCount - 1}
                className="caos-action-secondary focus-ring disabled:opacity-40"
              >
                Next nodes
              </button>
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[980px] border-collapse text-left tabular text-caos-xs">
                <caption className="sr-only">Canonical Model Engine v2 calculation nodes</caption>
                <thead className="sticky top-0 z-10 bg-caos-panel text-caos-2xs uppercase tracking-wider text-caos-muted">
                  <tr className="border-b border-caos-border">
                    <th scope="col" className="px-2 py-2">Period</th>
                    <th scope="col" className="px-2 py-2">Node ID</th>
                    <th scope="col" className="px-2 py-2 text-right">Value</th>
                    <th scope="col" className="px-2 py-2 text-right">Original</th>
                    <th scope="col" className="px-2 py-2">Formula</th>
                    <th scope="col" className="px-2 py-2">State</th>
                    <th scope="col" className="px-2 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleNodes.map((node) => {
                    const mutation = pending[node.node_id];
                    const restorable = activeOverrides.has(node.node_id) || mutation?.action === "set";
                    return (
                      <tr key={node.node_id} className="border-b border-caos-border/60 align-top hover:bg-caos-elevated/50">
                        <td className="px-2 py-2 text-caos-muted">
                          <span className="block text-caos-text">{node.period_label}</span>
                          <span className="text-caos-3xs uppercase tracking-wide">{node.period_kind}</span>
                        </td>
                        <th scope="row" className="px-2 py-2 font-mono font-normal text-caos-text">{node.node_id}</th>
                        <td className="px-2 py-2 text-right font-mono text-caos-text">{formatValue(node.value)}</td>
                        <td className="px-2 py-2 text-right font-mono text-caos-muted">{formatValue(node.original_value)}</td>
                        <td className="max-w-[320px] px-2 py-2 font-mono text-caos-muted">{node.formula ?? "INPUT"}</td>
                        <td className="px-2 py-2">
                          {mutationLabel(mutation) ? (
                            <span className="text-caos-warning">{mutationLabel(mutation)}</span>
                          ) : node.overridden ? (
                            <span className="text-caos-accent">OVERRIDDEN · {node.override_reason || "NO REASON"}</span>
                          ) : (
                            <span className="text-caos-muted">CANONICAL</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <span className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => beginEdit(node)}
                              disabled={!record || editorDirty || busy !== null}
                              title={editorDirty ? "Queue or cancel the open editor change first" : undefined}
                              aria-label={`Edit ${node.node_id}`}
                              className="caos-action-secondary focus-ring disabled:opacity-40"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => restoreNode(node.node_id)}
                              disabled={!record || !restorable || editorDirty || busy !== null}
                              title={editorDirty ? "Queue or cancel the open editor change first" : undefined}
                              aria-label={`Restore ${node.node_id}`}
                              className="caos-action-secondary focus-ring disabled:opacity-40"
                            >
                              Restore
                            </button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleNodes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-caos-xs text-caos-muted">
                        No calculation nodes match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>

          {selectedNode ? (
            <Panel title="Override editor" right={<code className="text-caos-2xs text-caos-muted">{selectedNode.node_id}</code>}>
              <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(13rem,0.7fr)_auto] lg:items-end">
                <label className="flex flex-col gap-1 text-caos-xs text-caos-text">
                  Numeric value
                  <input
                    ref={editorRef}
                    value={editorValue}
                    onChange={(event) => setEditorValue(event.target.value)}
                    disabled={editorNull}
                    inputMode="decimal"
                    className="h-8 rounded border border-caos-border bg-caos-bg px-2 font-mono text-caos-text focus-ring disabled:opacity-40"
                  />
                </label>
                <label className="flex flex-col gap-1 text-caos-xs text-caos-text">
                  Reason {requiresOverrideReason(selectedNode.node_id) ? "· required" : "· optional"}
                  <input
                    value={editorReason}
                    onChange={(event) => setEditorReason(event.target.value)}
                    className="h-8 rounded border border-caos-border bg-caos-bg px-2 text-caos-text focus-ring"
                  />
                </label>
                {requiresOverrideReason(selectedNode.node_id) ? (
                  <label className="flex flex-col gap-1 text-caos-xs text-caos-text">
                    Override expiry · required
                    <input
                      type="datetime-local"
                      aria-label="Override expiry"
                      value={editorExpiry}
                      onChange={(event) => setEditorExpiry(event.target.value)}
                      className="h-8 rounded border border-caos-border bg-caos-bg px-2 font-mono text-caos-text focus-ring"
                    />
                    <span className="text-caos-3xs uppercase tracking-wide text-caos-muted">Source · analyst-ui</span>
                  </label>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-caos-xs text-caos-muted">
                    <input
                      type="checkbox"
                      checked={editorNull}
                      onChange={(event) => setEditorNull(event.target.checked)}
                      className="focus-ring"
                    />
                    Set unavailable (null)
                  </label>
                  <button type="button" onClick={queueOverride} className="caos-primary-action focus-ring">Queue override</button>
                  <button type="button" onClick={() => setSelectedNodeId(null)} className="caos-action-secondary focus-ring">Cancel</button>
                </div>
                <div className="lg:col-span-4 grid gap-1 rounded border border-caos-border bg-caos-bg/60 p-2 font-mono text-caos-2xs text-caos-muted">
                  <span>ORIGINAL {formatValue(selectedNode.original_value)}</span>
                  <span>FORMULA {selectedNode.formula ?? "input value"}</span>
                </div>
              </div>
            </Panel>
          ) : null}

          {record && payload.ui_preferences.show_scenarios ? (
            <Panel
              title="Scenario modes"
              right={<span className="text-caos-2xs uppercase tracking-wider text-caos-muted">Server only · not saved</span>}
            >
              <div role="tablist" aria-label="Scenario mode" className="m-3 mb-0 flex flex-wrap gap-1 rounded border border-caos-border bg-caos-bg p-1">
                <button type="button" role="tab" aria-selected={scenarioMode === "model"} onClick={() => setScenarioMode("model")} className={scenarioMode === "model" ? "caos-action-primary focus-ring" : "caos-action-secondary focus-ring"}>Model scenario</button>
                <button type="button" role="tab" aria-selected={scenarioMode === "network"} onClick={() => setScenarioMode("network")} className={scenarioMode === "network" ? "caos-action-primary focus-ring" : "caos-action-secondary focus-ring"}>Cross-module propagation</button>
              </div>
              <div hidden={scenarioMode !== "model"} className="grid gap-3 p-3 lg:grid-cols-[minmax(12rem,0.6fr)_minmax(16rem,1fr)_minmax(10rem,0.5fr)_auto] lg:items-end">
                <label className="flex flex-col gap-1 text-caos-xs text-caos-text">
                  Find scenario node
                  <input
                    aria-label="Filter scenario nodes"
                    value={scenarioNodeQuery}
                    onChange={(event) => setScenarioNodeQuery(event.target.value)}
                    disabled={requiresRecalculation}
                    placeholder="Period or stable node ID"
                    className="h-8 rounded border border-caos-border bg-caos-bg px-2 font-mono text-caos-text focus-ring"
                  />
                </label>
                <label className="flex flex-col gap-1 text-caos-xs text-caos-text">
                  Scenario node
                  <select
                    aria-label="Scenario node"
                    value={scenarioNodeId}
                    onChange={(event) => {
                      scenarioGenerationRef.current += 1;
                      setScenarioNodeId(event.target.value);
                      setScenarioPreview(null);
                    }}
                    disabled={requiresRecalculation || (busy !== null && busy !== "scenario-preview")}
                    className="h-8 rounded border border-caos-border bg-caos-bg px-2 font-mono text-caos-text focus-ring disabled:opacity-40"
                  >
                    <option value="">Select stable node</option>
                    {scenarioNodeOptions.map((node) => (
                      <option key={node.node_id} value={node.node_id}>{scenarioNodeLabel(node)}</option>
                    ))}
                  </select>
                  {nodes.length > NODE_PICKER_LIMIT ? (
                    <span className="text-caos-3xs text-caos-muted">
                      Showing up to {NODE_PICKER_LIMIT} matches. Refine the node filter to reach the full graph.
                    </span>
                  ) : null}
                </label>
                <label className="flex flex-col gap-1 text-caos-xs text-caos-text">
                  Scenario value
                  <input
                    value={scenarioValue}
                    onChange={(event) => {
                      scenarioGenerationRef.current += 1;
                      setScenarioValue(event.target.value);
                      setScenarioPreview(null);
                    }}
                    disabled={requiresRecalculation || (busy !== null && busy !== "scenario-preview")}
                    inputMode="decimal"
                    className="h-8 rounded border border-caos-border bg-caos-bg px-2 font-mono text-caos-text focus-ring disabled:opacity-40"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void previewScenario()}
                    disabled={
                      requiresRecalculation
                      || !scenarioNodeId
                      || !scenarioValue.trim()
                      || !Number.isFinite(Number(scenarioValue))
                      || editorDirty
                      || busy !== null
                    }
                    className="caos-action-secondary focus-ring disabled:opacity-40"
                  >
                    {busy === "scenario-preview" ? "Calculating…" : "Preview sensitivity"}
                  </button>
                  <button
                    type="button"
                    onClick={resetScenario}
                    disabled={
                      (!scenarioNodeId && !scenarioValue && !scenarioPreview)
                      || (busy !== null && busy !== "scenario-preview")
                    }
                    className="caos-action-secondary focus-ring disabled:opacity-40"
                  >
                    Reset sensitivity
                  </button>
                </div>
                <p className="text-caos-xs leading-relaxed text-caos-muted lg:col-span-4">
                  Applies one temporary override to the current working inputs through Model Engine v2. It never enters the manual mutation queue.
                </p>
                {activeScenarioPreview ? (
                  <div className="space-y-2 rounded border border-caos-accent/50 bg-caos-bg/60 p-2 text-caos-2xs text-caos-text lg:col-span-4">
                    <div className="grid gap-1 font-mono">
                      <span>SCENARIO {activeScenarioPreview.nodeId} = {formatValue(activeScenarioPreview.value)}</span>
                      <span>SELECTED RESULT {formatValue(scenarioResultNode?.value ?? null)} · HASH {activeScenarioPreview.calculation.calculation_hash.slice(0, 12)}</span>
                    </div>
                    <table className="w-full border-collapse text-left tabular" aria-label="Sensitivity decision deltas">
                      <thead className="uppercase tracking-wider text-caos-muted">
                        <tr className="border-b border-caos-border">
                          <th scope="col" className="py-1 pr-2">Decision output</th>
                          <th scope="col" className="px-2 py-1 text-right">Base</th>
                          <th scope="col" className="px-2 py-1 text-right">Scenario</th>
                          <th scope="col" className="py-1 pl-2 text-right">Delta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SCENARIO_DECISION_FIELDS.map(([field, label]) => {
                          const baseValue = scenarioBaselinePeriod?.[field] as number | null | undefined;
                          const resultValue = scenarioResultPeriod?.[field] as number | null | undefined;
                          const delta = baseValue != null && resultValue != null
                            ? resultValue - baseValue
                            : null;
                          return (
                            <tr key={field} className="border-b border-caos-border/60 last:border-0">
                              <th scope="row" className="py-1 pr-2 font-normal text-caos-text">{label}</th>
                              <td className="px-2 py-1 text-right font-mono text-caos-muted">{formatValue(baseValue ?? null)}</td>
                              <td className="px-2 py-1 text-right font-mono text-caos-text">{formatValue(resultValue ?? null)}</td>
                              <td className="py-1 pl-2 text-right font-mono text-caos-text">{delta == null ? "—" : `${delta > 0 ? "+" : ""}${formatValue(delta)}`}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
              <div hidden={scenarioMode !== "network"} className="p-3">
                <p className="mb-2 text-caos-xs leading-relaxed text-caos-muted">Propagates EBITDA and rate shocks through the exact completed source run. It does not mutate this draft, its override queue, checkpoints, or reports.</p>
                <ScenarioNetworkPanel issuerId={issuerId} runId={record.source_run_id} />
              </div>
            </Panel>
          ) : null}

          {calculation.gaps.length || calculation.warnings.length ? (
            <Panel title="Calculation controls">
              <div className="grid gap-3 p-3 md:grid-cols-2">
                <div>
                  <div className="text-caos-2xs uppercase tracking-wider text-caos-muted">Named gaps · {calculation.gaps.length}</div>
                  {calculation.gaps.length ? <ul className="mt-1 space-y-1 text-caos-xs text-caos-warning">{calculation.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul> : <p className="mt-1 text-caos-xs text-caos-muted">None.</p>}
                </div>
                <div>
                  <div className="text-caos-2xs uppercase tracking-wider text-caos-muted">Invariant warnings · {calculation.warnings.length}</div>
                  {calculation.warnings.length ? <ul className="mt-1 space-y-1 text-caos-xs text-caos-warning">{calculation.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p className="mt-1 text-caos-xs text-caos-muted">None.</p>}
                </div>
              </div>
            </Panel>
          ) : null}

          <div className="grid gap-2 xl:grid-cols-2">
            <Panel title="Server history & checkpoints" right={<span className="text-caos-2xs text-caos-muted">{history.length} events · {checkpoints.length} checkpoints</span>}>
              <div className="space-y-3 p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-caos-xs text-caos-text">
                    Checkpoint label
                    <input
                      value={checkpointLabel}
                      maxLength={160}
                      onChange={(event) => setCheckpointLabel(event.target.value)}
                      disabled={!record}
                      className="h-8 rounded border border-caos-border bg-caos-bg px-2 text-caos-text focus-ring disabled:opacity-40"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void createCheckpoint()}
                    disabled={!record || !(contextId ?? record.context_id) || requiresRecalculation || dirty || busy !== null}
                    className="caos-action-secondary focus-ring disabled:opacity-40"
                    title={requiresRecalculation
                      ? "Recalculate and save before checkpointing"
                      : contextId ?? record?.context_id
                        ? "Create immutable checkpoint"
                        : "Bind an analysis context before checkpointing"}
                  >
                    {busy === "checkpoint" ? "Creating…" : "Create checkpoint"}
                  </button>
                </div>
                <div className="max-h-48 overflow-auto rounded border border-caos-border">
                  {checkpoints.length ? checkpoints.map((checkpoint) => (
                    <div key={checkpoint.id} className="flex items-center justify-between gap-3 border-b border-caos-border/60 px-2 py-2 last:border-0">
                      <span className="min-w-0 text-caos-xs text-caos-text">
                        <span className="block truncate">{checkpoint.label}</span>
                        <span className="tabular text-caos-3xs text-caos-muted">REV {checkpoint.draft_revision} · {fmtLocalDateTime(checkpoint.created_at)}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => void restoreCheckpoint(checkpoint)}
                        disabled={!record || busy !== null}
                        className="caos-action-secondary focus-ring disabled:opacity-40"
                      >
                        Restore
                      </button>
                    </div>
                  )) : <p className="p-2 text-caos-xs text-caos-muted">No Model Engine v2 checkpoints.</p>}
                </div>
                <div className="max-h-64 overflow-auto rounded border border-caos-border">
                  {history.length ? history.slice(0, 20).map((event) => (
                    <article
                      key={event.id}
                      aria-label={`Override event ${event.node_id} revision ${event.revision}`}
                      className="space-y-1 border-b border-caos-border/60 px-2 py-2 text-caos-2xs last:border-0"
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                        <span className="min-w-0 truncate font-mono text-caos-text">{event.node_id}</span>
                        <span className="uppercase text-caos-muted">{event.action} · REV {event.revision}</span>
                      </div>
                      <div className="grid gap-x-3 gap-y-1 text-caos-muted md:grid-cols-2">
                        <span>ACTOR <strong className="font-normal text-caos-text">{event.actor_id}</strong> · {formatAuditTime(event.created_at)}</span>
                        <span>BEFORE <strong className="font-mono font-normal text-caos-text">{formatOverrideSnapshot(event.before_value)}</strong> → AFTER <strong className="font-mono font-normal text-caos-text">{formatOverrideSnapshot(event.after_value)}</strong></span>
                        <span>ORIGINAL <strong className="font-mono font-normal text-caos-text">{formatValue(event.original_value?.value ?? null)}</strong> · FORMULA <strong className="font-mono font-normal text-caos-text">{event.original_formula ?? "INPUT"}</strong></span>
                        <span>REASON <strong className="font-normal text-caos-text">{event.reason ?? "Not supplied"}</strong></span>
                        <span>SCOPE <strong className="font-normal text-caos-text">{event.scope}</strong> · SOURCE <strong className="font-normal text-caos-text">{event.source ?? "Not supplied"}</strong></span>
                        <span>EXPIRY <strong className="font-normal text-caos-text">{event.expires_at ? formatAuditTime(event.expires_at) : "None"}</strong></span>
                      </div>
                    </article>
                  )) : <p className="p-2 text-caos-xs text-caos-muted">No committed override history.</p>}
                </div>
              </div>
            </Panel>

            {workbookImportPanel}
          </div>
        </div>
      </div>
    </EnterprisePage>
  );
}
