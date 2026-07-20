"use client";

// Concept D — The Model Builder: cash-flow model constructed from upstream
// module outputs. Sheet grid with sourced rows, build-manifest tracing,
// formula bar with E-xx lineage, manual overrides with recompute, downside
// severity control, and model export.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { EvidenceModal } from "@/components/reports/EvidenceModal";
import { FormulaBar, Manifest, Sheet, type CellRef } from "@/components/model/ModelSheet";
import { ScenarioPanel } from "@/components/model/ScenarioPanel";
import { AssumptionsPanel } from "@/components/model/AssumptionsPanel";
import { ModelHistoryControls } from "@/components/model/ModelHistoryControls";
import { useModelHistory } from "@/lib/model/useModelHistory";
import { CollapseButton } from "@/components/shared/CollapseButton";
import { OV_SIGN, ovField, parseNum, type PasteResult } from "@/components/model/model-format";
import { ROWS } from "@/components/model/rows";
import type { Model, Overrides } from "@/lib/reports/model";
import {
  type Assumptions, type CaseAssumptions, type FY, ADDBACKS, DEFAULT_ASSUMPTIONS, DEFAULT_CASE, loadAssumptions, parseAssumptions, saveAssumptions,
} from "@/lib/reports/assumptions";
import { useModelEngine, type ModelEngineState } from "@/lib/engine/useModelEngine";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";
import {
  createModelCheckpoint,
  getIssuerProfile,
  getModelCheckpoints,
  getSavedModel,
  restoreModelCheckpoint,
  saveModel as saveIssuerModel,
  type ModelCheckpointDTO,
} from "@/lib/api";
import { EnterprisePage, type NarrowContract, type PageAction } from "@/components/shared/EnterprisePage";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { CompletionStateSummary } from "@/components/shared/CompletionStateSummary";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { fromModelEngine } from "@/lib/provenance";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import type { DecisionAuthority, DecisionContextState, DecisionDatumState } from "@/lib/decision-state";
import { useAnalysisContext } from "@/lib/analysis-workbench";
import { FreshnessIndicator } from "@/components/shared/FreshnessIndicator";
import { derivedFreshness, useIssuerFreshness } from "@/lib/engine/useFreshness";
import { freshnessDetail, toProvFreshness } from "@/lib/freshness";
import type { FreshnessEvaluation } from "@/lib/api";
import type { LegacyModelRuntime } from "./LegacyCalculatorBridge";
import { ModelAuthorityRoute } from "./ModelAuthorityRoute";
import { fmtLocalDateTime, fmtUtcDateTime } from "@/lib/format-date";
import { useDataMode, type DataMode } from "@/lib/data-mode";
import { SurfaceState } from "@/components/shared/SurfaceState";

type SavedModel = Awaited<ReturnType<typeof getSavedModel>>;

// A first-open worksheet shows the committee-relevant totals while keeping
// segment, add-back, and instrument detail one row disclosure away. Persisted
// analyst choices replace this default during hydration, including an explicit
// empty set for a fully expanded workbook.
const DEFAULT_COLLAPSED_MODEL_ROWS = ["rev", "adj", "tdebt"] as const;

function defaultCollapsedModelRows() {
  return new Set<string>(DEFAULT_COLLAPSED_MODEL_ROWS);
}

// Pull the typed, guarded pieces out of a saved-model payload (shared by the
// hydrate effect and the retry handler). Returns null when there's no payload.
function parseSavedPayload(saved: SavedModel) {
  const p = saved?.payload;
  if (!p) return null;
  const o = sanitizeOverrides(p.overrides);
  const a = p.assumptions && typeof p.assumptions === "object"
    ? parseAssumptions(JSON.stringify(p.assumptions)) ?? undefined
    : undefined;
  const c = Array.isArray(p.collapsedRows)
    ? new Set(p.collapsedRows.filter((row): row is string => typeof row === "string"))
    : undefined;
  return { o, a, c, updatedAt: saved?.updated_at ?? null };
}

function sanitizeOverrides(raw: unknown): Overrides | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Overrides = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

export default function ModelPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <ModelAuthorityRoute renderLegacy={(runtime) => <ModelBuilder legacyRuntime={runtime} />} />
      </Suspense>
    </RequireAuth>
  );
}

// Which sheet rows each assumption driver feeds — used to flash the affected
// forecast cells while a driver is scrubbed. Keyed by CaseAssumptions field;
// includes the directly-edited line(s) plus every KPI the change recomputes
// (leverage/coverage key off adj-EBITDA & cash; SG&A/tax/capex ratios off their
// own inputs). Cross-year cash roll-forward is not chased — same-column only.
const DRIVER_ROWS: Record<string, string[]> = {
  gDrive: ["segD", "srsec", "totlev", "netlev", "intcov", "fcfd", "sga", "taxr"],
  gFluid: ["segF", "srsec", "totlev", "netlev", "intcov", "fcfd", "sga", "taxr"],
  gAfter: ["segA", "srsec", "totlev", "netlev", "intcov", "fcfd", "sga", "taxr"],
  dGpm: ["gp", "gpm", "sga"],
  dAdjm: ["adj", "adj2", "adjm", "srsec", "totlev", "netlev", "intcov", "fcfd", "sga", "taxr"],
  daPct: ["da", "dapc", "taxr"],
  mInt: ["int", "intcov", "fcfd", "netlev", "srsec", "taxr"],
  mLeases: ["leases", "fcfd", "netlev", "srsec"],
  mTax: ["tax", "fcfd", "netlev", "srsec", "taxr"],
  mWc: ["wc", "fcfd", "netlev", "srsec"],
  mCapex: ["capex", "cpr", "fcfd", "netlev", "srsec"],
  mAcq: ["acq", "netlev", "srsec"],
  mDiss: ["diss", "netlev", "srsec"],
  divDelta: ["div", "netlev", "srsec"],
  sofrDelta: ["sofr", "int", "intcov", "fcfd", "netlev", "srsec", "taxr"],
  // each add-back account moves Adj. EBITDA → leverage & coverage KPIs
  ...Object.fromEntries(ADDBACKS.map((a) => [a.key,
    [a.key, "abunreal", "ab", "adj", "adj2", "adjm", "srsec", "totlev", "netlev", "intcov", "fcfd"]])),
};

// Cash-based KPI rows that roll forward: a year-scoped change to a cash-affecting
// driver moves these in that year AND every later forecast year (cash carries).
const CASCADE_ROWS = new Set(["netlev", "srsec"]);
// Drivers that never touch the cash-flow statement (D&A is non-cash; gross-margin
// only reshapes opex) — their KPI impact stays in the scrubbed year.
const NON_CASH_DRIVERS = new Set(["dGpm", "daPct"]);

function checkpointFailureMessage(reason: unknown) {
  if (!axios.isAxiosError(reason)) return "Checkpoint could not be saved.";
  return String(reason.response?.data?.detail ?? "Checkpoint could not be saved.");
}

function checkpointContextNotice(error: string | null) {
  if (error) return "Working draft saved. Checkpoint unavailable: " + error;
  return "Working draft saved. Checkpoint will be available when analysis context is ready.";
}

function useModelHistoryKeyboard(undo: () => void, redo: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);
}

function pasteNoticeMessage(result: PasteResult) {
  const parts = [
    result.applied > 0 ? "pasted " + result.applied + " cell" + (result.applied === 1 ? "" : "s") : null,
    result.skippedNotEditable > 0 ? result.skippedNotEditable + " not editable" : null,
    result.invalid.length > 0 ? result.invalid.length + " invalid value" + (result.invalid.length === 1 ? "" : "s") + " discarded" : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function useModelGridUi(issuerId: string) {
  const [hl, setHl] = useState<string | null>(null);
  const [sel, setSel] = useState<CellRef | null>({ row: "netlev", col: "l1" });
  const [evModal, setEvModal] = useState<string | null>(null);
  const [editing, setEditing] = useState<CellRef | null>(null);
  const [hlCells, setHlCells] = useState<Set<string> | null>(null);
  const history = useModelHistory(issuerId);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [armReset, setArmReset] = useState(false);
  const pasteNoticeTimer = useRef<number | null>(null);
  const editErrTimer = useRef<number | null>(null);
  const armTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (editErrTimer.current) window.clearTimeout(editErrTimer.current);
    if (armTimer.current) window.clearTimeout(armTimer.current);
    if (pasteNoticeTimer.current) window.clearTimeout(pasteNoticeTimer.current);
  }, []);
  useModelHistoryKeyboard(history.undo, history.redo);
  const flashPasteNotice = (text: string) => {
    setPasteNotice(text);
    if (pasteNoticeTimer.current) window.clearTimeout(pasteNoticeTimer.current);
    pasteNoticeTimer.current = window.setTimeout(() => setPasteNotice(null), 3500);
  };
  const onPasteCells = (result: PasteResult) => {
    if (result.applied > 0) history.setOverrides((current) => ({ ...current, ...result.patch }));
    const notice = pasteNoticeMessage(result);
    if (notice) flashPasteNotice(notice);
  };
  return {
    ...history, hl, setHl, sel, setSel, evModal, setEvModal, editing, setEditing,
    hlCells, setHlCells, pasteNotice, editError, setEditError, editErrTimer,
    armReset, setArmReset, armTimer, onPasteCells,
  };
}

type ModelGridUi = ReturnType<typeof useModelGridUi>;

function useModelDraftState() {
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [collapsedRows, setCollapsedRows] = useState<Set<string>>(defaultCollapsedModelRows);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState(false);
  const [restoreNonce, setRestoreNonce] = useState(0);
  const [hydratedIssuerId, setHydratedIssuerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saveConflict, setSaveConflict] = useState(false);
  const [serverCheckpoints, setServerCheckpoints] = useState<ModelCheckpointDTO[]>([]);
  const [serverCheckpointsIssuerId, setServerCheckpointsIssuerId] = useState<string | null>(null);
  const [checkpointing, setCheckpointing] = useState(false);
  const [checkpointNotice, setCheckpointNotice] = useState<string | null>(null);
  const savedSnapshot = useRef<string | null>(null);
  const hydrateGeneration = useRef(0);
  return {
    assumptions, setAssumptions, collapsedRows, setCollapsedRows, savedAt, setSavedAt,
    restoreError, setRestoreError, restoreNonce, setRestoreNonce, hydratedIssuerId,
    setHydratedIssuerId, saving, setSaving, saveError, setSaveError, saveConflict,
    setSaveConflict, serverCheckpoints, setServerCheckpoints, serverCheckpointsIssuerId,
    setServerCheckpointsIssuerId, checkpointing, setCheckpointing, checkpointNotice,
    setCheckpointNotice, savedSnapshot, hydrateGeneration,
  };
}

type ModelDraftState = ReturnType<typeof useModelDraftState>;

function serializeSavable(assumptions: Assumptions, overrides: Overrides, collapsedRows: Set<string>) {
  return JSON.stringify({ a: assumptions, o: overrides, c: [...collapsedRows].sort() });
}

function resetDraftForHydration(draft: ModelDraftState, replaceOverrides: (overrides: Overrides) => void) {
  draft.setHydratedIssuerId(null);
  replaceOverrides({});
  draft.setAssumptions({ base: { ...DEFAULT_CASE }, down: { ...DEFAULT_CASE }, baseYears: {}, downYears: {} });
  draft.setCollapsedRows(defaultCollapsedModelRows());
  draft.setSavedAt(null);
  draft.setRestoreError(false);
  draft.setSaveError(false);
  draft.setSaveConflict(false);
  draft.setSaving(false);
  draft.setCheckpointing(false);
  draft.setCheckpointNotice(null);
  draft.savedSnapshot.current = null;
}

function loadLocalModelDraft(issuerId: string, storageKey: string, isReference: boolean) {
  let overrides: Overrides = {};
  let assumptions = DEFAULT_ASSUMPTIONS;
  const collapsedRows = defaultCollapsedModelRows();
  try {
    let raw = sessionStorage.getItem(storageKey);
    if (raw == null && isReference) {
      const legacy = localStorage.getItem("caos-d-overrides");
      if (legacy != null) {
        raw = legacy;
        localStorage.removeItem("caos-d-overrides");
      }
    }
    overrides = sanitizeOverrides(JSON.parse(raw || "{}")) ?? {};
    assumptions = loadAssumptions(issuerId);
  } catch {
    // First visit or unavailable storage keeps guarded defaults.
  }
  return { overrides, assumptions, collapsedRows };
}

function applySavedDraft(
  parsed: NonNullable<ReturnType<typeof parseSavedPayload>>,
  local: ReturnType<typeof loadLocalModelDraft>,
  draft: ModelDraftState,
  replaceOverrides: (overrides: Overrides) => void,
) {
  if (parsed.o) replaceOverrides(parsed.o);
  if (parsed.a) draft.setAssumptions(parsed.a);
  if (parsed.c) draft.setCollapsedRows(parsed.c);
  draft.setSavedAt(parsed.updatedAt);
  draft.savedSnapshot.current = serializeSavable(
    parsed.a ?? local.assumptions,
    parsed.o ?? local.overrides,
    parsed.c ?? local.collapsedRows,
  );
}

function useModelHydration(issuerId: string, isReference: boolean, grid: ModelGridUi, draft: ModelDraftState) {
  const storageKey = "caos-d-overrides:" + issuerId;
  useEffect(() => {
    let stale = false;
    const generation = ++draft.hydrateGeneration.current;
    resetDraftForHydration(draft, grid.replaceOverrides);
    const local = loadLocalModelDraft(issuerId, storageKey, isReference);
    if (Object.keys(local.overrides).length) grid.replaceOverrides(local.overrides);
    draft.setAssumptions(local.assumptions);
    draft.savedSnapshot.current = serializeSavable(local.assumptions, local.overrides, local.collapsedRows);
    getSavedModel(issuerId)
      .then((saved) => {
        if (stale || generation !== draft.hydrateGeneration.current) return;
        const parsed = parseSavedPayload(saved);
        if (parsed) applySavedDraft(parsed, local, draft, grid.replaceOverrides);
        draft.setHydratedIssuerId(issuerId);
      })
      .catch(() => {
        if (!stale && generation === draft.hydrateGeneration.current) draft.setRestoreError(true);
      });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issuerId, storageKey, isReference, draft.restoreNonce]);
  const hydrated = draft.hydratedIssuerId === issuerId;
  const retryRestore = () => draft.setRestoreNonce((nonce) => nonce + 1);
  useEffect(() => {
    if (!hydrated) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(grid.overrides)); } catch {}
  }, [hydrated, storageKey, grid.overrides]);
  useEffect(() => {
    if (hydrated) saveAssumptions(issuerId, draft.assumptions);
  }, [hydrated, issuerId, draft.assumptions]);
  return { hydrated, retryRestore };
}

type ModelSupportPanel = "assumptions" | "scenario" | "evidence" | "history" | null;

function useModelPanels(hydrated: boolean) {
  const [showQuarters, setShowQuarters] = useState(true);
  const [activeSupport, setActiveSupport] = useState<ModelSupportPanel>(null);
  const showScenarios = activeSupport === "scenario";
  const showAssumptions = activeSupport === "assumptions";
  const setShowScenarios = (show: boolean) => setActiveSupport((current) => show ? "scenario" : current === "scenario" ? null : current);
  const setShowAssumptions = (show: boolean) => setActiveSupport((current) => show ? "assumptions" : current === "assumptions" ? null : current);
  useEffect(() => {
    const onCollapse = () => setActiveSupport((current) => current ? null : "assumptions");
    window.addEventListener("caos:collapse-toggle", onCollapse);
    return () => window.removeEventListener("caos:collapse-toggle", onCollapse);
  }, []);
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const onResize = () => {
      if (window.innerWidth < 1024) setActiveSupport(null);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [hydrated]);
  return { showQuarters, setShowQuarters, activeSupport, setActiveSupport, showScenarios, setShowScenarios, showAssumptions, setShowAssumptions };
}

type ModelPanels = ReturnType<typeof useModelPanels>;
type ModelAnalysisContext = ReturnType<typeof useAnalysisContext>;

function useModelContextBinding(
  analysis: ModelAnalysisContext,
  issuerId: string,
  runId: string | null,
  setNotice: (notice: string | null) => void,
) {
  const context = analysis.context;
  const patch = analysis.patch;
  useEffect(() => {
    if (!context) return;
    const issuerIds = context.issuer_ids.includes(issuerId) ? context.issuer_ids : [...context.issuer_ids, issuerId];
    const nextRunId = runId ?? context.artifacts.issuer_run_id;
    if (issuerIds === context.issuer_ids && nextRunId === context.artifacts.issuer_run_id) return;
    void patch({ issuer_ids: issuerIds, artifacts: { issuer_run_id: nextRunId } })
      .catch(() => setNotice("Analysis context could not be updated."));
  }, [context, issuerId, patch, runId, setNotice]);
}

function useServerCheckpointLoad(issuerId: string, draft: ModelDraftState) {
  const { setServerCheckpoints, setServerCheckpointsIssuerId } = draft;
  useEffect(() => {
    let cancelled = false;
    setServerCheckpoints([]);
    setServerCheckpointsIssuerId(null);
    getModelCheckpoints(issuerId)
      .then((rows) => {
        if (cancelled || rows.some((row) => row.issuer_id !== issuerId)) return;
        setServerCheckpoints(rows);
        setServerCheckpointsIssuerId(issuerId);
      })
      .catch(() => {
        if (!cancelled) {
          setServerCheckpoints([]);
          setServerCheckpointsIssuerId(null);
        }
      });
    return () => { cancelled = true; };
  }, [issuerId, setServerCheckpoints, setServerCheckpointsIssuerId]);
}

function changedModelCells(previous: Model, current: Model) {
  const changed = new Set<string>();
  for (const row of ROWS) {
    if (!row.g) continue;
    for (const column of current.columns) {
      const before = row.g(previous.cols[column.key]);
      const after = row.g(current.cols[column.key]);
      const bothNaN = typeof before === "number" && typeof after === "number" && Number.isNaN(before) && Number.isNaN(after);
      if (before !== after && !bothNaN) changed.add(row.id + ":" + column.key);
    }
  }
  return changed;
}

function useChangedModelHighlight(model: Model, setHighlight: (cells: Set<string> | null | ((current: Set<string> | null) => Set<string> | null)) => void) {
  const previousModel = useRef<Model | null>(null);
  useEffect(() => {
    const previous = previousModel.current;
    previousModel.current = model;
    if (!previous) return;
    const changed = changedModelCells(previous, model);
    if (!changed.size) return;
    setHighlight(changed);
    const timer = window.setTimeout(() => setHighlight((current) => (current === changed ? null : current)), 650);
    return () => window.clearTimeout(timer);
  }, [model, setHighlight]);
}

function modelProvenance(eng: ModelEngineState, freshness: FreshnessEvaluation | null, asOf: string | null) {
  const provenance = fromModelEngine(eng);
  return {
    ...provenance,
    ...(eng.live ? { freshness: toProvFreshness(freshness) } : {}),
    detail: eng.live
      ? freshness ? freshnessDetail(freshness) : "Central anchor-run freshness unavailable."
      : provenance.detail,
    asOf: asOf ?? undefined,
  };
}

function unavailableModelDecision(eng: ModelEngineState) {
  if (eng.loading) return { kind: "loading" as const, message: "Linking latest engine run…" };
  if (eng.phase === "error") return { kind: "error" as const, message: "Live model anchor could not be loaded" };
  return { kind: "unavailable" as const, message: "No completed CP-1 anchor available" };
}

function evidenceHealthState(
  eng: ModelEngineState,
  freshness: FreshnessEvaluation | null,
  provenance: ReturnType<typeof modelProvenance>,
  asOf: string,
  authority: DecisionAuthority,
): DecisionDatumState {
  const kind: "stale" | "ready" | "partial" = !eng.live || freshness?.state === "stale" ? "stale" : freshness?.state === "current" ? "ready" : "partial";
  const missingSources = !freshness || freshness.state === "unknown"
    ? ["central anchor-run freshness"]
    : freshness.state === "due" ? ["anchor run refresh due"] : [];
  return {
    kind,
    value: <span className="inline-flex items-center gap-2"><FreshnessIndicator evaluation={freshness} />{provenance.detail ?? "Model lineage available"}</span>,
    missingSources,
    asOf,
    authority,
  };
}

function buildModelDecision(
  eng: ModelEngineState,
  model: Model,
  freshness: FreshnessEvaluation | null,
  asOf: string | null,
  dirty: boolean,
): DecisionContextState {
  const unavailable = unavailableModelDecision(eng);
  if (!asOf) return { whatChanged: unavailable, whyItMatters: unavailable, requiredAction: unavailable, evidenceHealth: unavailable };
  const provenance = modelProvenance(eng, freshness, asOf);
  const authority = { provenance, approval: "UNRATIFIED" as const };
  const leverage = model.cols.d0.netlev;
  return {
    whatChanged: { kind: "ready", value: "Down case FCF " + (model.cols.d0.fcf < 0 ? "turns negative" : "remains positive") + " · FY27 " + model.cols.d0.fcf.toFixed(0), asOf, authority },
    whyItMatters: leverage != null
      ? { kind: "ready", value: "Down-case net leverage " + leverage.toFixed(1) + "×", asOf, authority }
      : { kind: "partial", value: "Down-case leverage unavailable", missingSources: ["net leverage"], asOf, authority },
    requiredAction: { kind: "ready", value: dirty ? "Save changes before Report Studio" : "Review downside and affirm the credit view", asOf, authority },
    evidenceHealth: evidenceHealthState(eng, freshness, provenance, asOf, authority),
  };
}

function modelExportMeta(isReference: boolean, issuerName: string, runId: string | null) {
  if (isReference) {
    return { header: "Atlas Forge Industrials — cash-flow model M-118", subheader: "YE 31-Dec · $m · RUN #2641 · * derived period (G-02)", filename: "ATLF Cash-Flow Model M-118.xlsx" };
  }
  return {
    header: issuerName + " — cash-flow model",
    subheader: "YE 31-Dec · $m" + (runId ? " · RUN " + runId : "") + " · * derived period (G-02)",
    filename: issuerName + " Cash-Flow Model.xlsx",
  };
}

function useModelExport(
  issuerId: string,
  model: Model,
  panels: ModelPanels,
  overrides: Overrides,
  assumptions: Assumptions,
  exportMeta: ReturnType<typeof modelExportMeta>,
  eng: ModelEngineState,
) {
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const [{ exportModel }, profile] = await Promise.all([
        import("@/components/model/export"),
        getIssuerProfile(issuerId).catch(() => null),
      ]);
      await exportModel(model, panels.showQuarters, overrides, exportMeta, {
        prov: fromModelEngine(eng), runId: eng.runId, assumptions, metrics: profile?.metrics ?? [],
      });
    } finally {
      setExporting(false);
    }
  };
  return { exporting, handleExport };
}

function useModelEditingActions(grid: ModelGridUi) {
  const flashEditError = (bad: string) => {
    grid.setEditError(bad);
    if (grid.editErrTimer.current) window.clearTimeout(grid.editErrTimer.current);
    grid.editErrTimer.current = window.setTimeout(() => grid.setEditError(null), 2500);
  };
  const commitEdit = (text: string | null) => {
    if (!grid.editing) return;
    const trimmed = text?.trim() ?? "";
    const value = text == null ? null : parseNum(text);
    if (value != null) {
      const field = ovField(grid.editing.row);
      const key = grid.editing.col + ":" + field;
      grid.setOverrides((current) => ({ ...current, [key]: value * OV_SIGN[field] }));
      grid.setSel({ row: grid.editing.row, col: grid.editing.col });
    } else if (trimmed) {
      flashEditError(trimmed);
      grid.setSel({ row: grid.editing.row, col: grid.editing.col });
    }
    grid.setEditing(null);
  };
  const resetCell = (key: string) => grid.setOverrides((current) => {
    const next = { ...current };
    delete next[key];
    return next;
  });
  const resetAll = () => grid.setOverrides({});
  return { commitEdit, resetCell, resetAll };
}

function hydrationRequestIsStale(draft: ModelDraftState, generation: number, issuerId: string) {
  return generation !== draft.hydrateGeneration.current || draft.hydratedIssuerId !== issuerId;
}

type SavedIssuerModel = Awaited<ReturnType<typeof saveIssuerModel>>;

async function saveCurrentModel(params: {
  issuerId: string;
  hydrated: boolean;
  draft: ModelDraftState;
  grid: ModelGridUi;
  panels: ModelPanels;
  model: Model;
}): Promise<SavedIssuerModel | null> {
  const { issuerId, draft, grid, panels, model } = params;
  const generation = draft.hydrateGeneration.current;
  draft.setSaving(true);
  draft.setSaveError(false);
  draft.setSaveConflict(false);
  try {
    const saved = await saveIssuerModel(issuerId, {
      version: 1,
      assumptions: draft.assumptions,
      overrides: grid.overrides,
      collapsedRows: [...draft.collapsedRows],
      view: { showQuarters: panels.showQuarters, showAssumptions: panels.showAssumptions, showScenarios: panels.showScenarios },
      model: { columns: model.columns, cols: model.cols, provenance: model.provenance },
    }, draft.savedAt);
    if (hydrationRequestIsStale(draft, generation, issuerId)) return null;
    draft.setSavedAt(saved.updated_at);
    draft.savedSnapshot.current = serializeSavable(draft.assumptions, grid.overrides, draft.collapsedRows);
    return saved;
  } catch (error) {
    if (hydrationRequestIsStale(draft, generation, issuerId)) return null;
    if (axios.isAxiosError(error) && error.response?.status === 409) draft.setSaveConflict(true);
    else draft.setSaveError(true);
    return null;
  } finally {
    if (generation === draft.hydrateGeneration.current) draft.setSaving(false);
  }
}

async function saveCheckpoint(params: {
  issuerId: string;
  hydrated: boolean;
  draft: ModelDraftState;
  analysis: ModelAnalysisContext;
  eng: ModelEngineState;
  saveDraft: () => Promise<SavedIssuerModel | null>;
}) {
  const { issuerId, hydrated, draft, analysis, eng, saveDraft } = params;
  if (!hydrated) return;
  const generation = draft.hydrateGeneration.current;
  draft.setCheckpointing(true);
  draft.setCheckpointNotice(null);
  try {
    const saved = await saveDraft();
    if (!saved || hydrationRequestIsStale(draft, generation, issuerId)) return;
    const context = analysis.context;
    if (!context) {
      draft.setCheckpointNotice(checkpointContextNotice(analysis.error));
      return;
    }
    const checkpoint = await createModelCheckpoint(issuerId, {
      context_id: context.id,
      label: "Checkpoint " + fmtLocalDateTime(new Date()),
      issuer_run_id: eng.runId ?? undefined,
      parent_checkpoint_id: context.artifacts.model_checkpoint_id ?? undefined,
      expected_updated_at: saved.updated_at,
    });
    if (hydrationRequestIsStale(draft, generation, issuerId) || checkpoint.issuer_id !== issuerId) return;
    draft.setServerCheckpoints((rows) => [checkpoint, ...rows.filter((row) => row.id !== checkpoint.id)]);
    draft.setServerCheckpointsIssuerId(issuerId);
    await analysis.patch({
      artifacts: {
        issuer_run_id: eng.runId ?? context.artifacts.issuer_run_id,
        model_checkpoint_id: checkpoint.id,
      },
    });
    draft.setCheckpointNotice("Checkpoint " + checkpoint.id.slice(0, 8) + " saved.");
  } catch (reason) {
    if (!hydrationRequestIsStale(draft, generation, issuerId)) draft.setCheckpointNotice(checkpointFailureMessage(reason));
  } finally {
    if (generation === draft.hydrateGeneration.current) draft.setCheckpointing(false);
  }
}

async function restoreServerCheckpoint(params: {
  checkpoint: ModelCheckpointDTO;
  issuerId: string;
  hydrated: boolean;
  dirty: boolean;
  draft: ModelDraftState;
}) {
  const { checkpoint, issuerId, hydrated, dirty, draft } = params;
  if (!hydrated || draft.serverCheckpointsIssuerId !== issuerId || checkpoint.issuer_id !== issuerId) {
    draft.setCheckpointNotice("Checkpoint list changed with the active issuer. Reload the issuer before restoring.");
    return;
  }
  if (dirty && !window.confirm("Restore this immutable checkpoint and replace the current unsaved draft?")) return;
  const generation = draft.hydrateGeneration.current;
  draft.setCheckpointing(true);
  draft.setCheckpointNotice(null);
  try {
    const restored = await restoreModelCheckpoint(checkpoint.id, draft.savedAt);
    if (hydrationRequestIsStale(draft, generation, issuerId)) return;
    draft.setSavedAt(restored.updated_at);
    draft.setRestoreNonce((nonce) => nonce + 1);
    draft.setCheckpointNotice("Restored " + checkpoint.label + ".");
  } catch (reason) {
    if (hydrationRequestIsStale(draft, generation, issuerId)) return;
    draft.setCheckpointNotice(axios.isAxiosError(reason)
      ? String(reason.response?.data?.detail ?? "Checkpoint could not be restored.")
      : "Checkpoint could not be restored.");
  } finally {
    if (generation === draft.hydrateGeneration.current) draft.setCheckpointing(false);
  }
}

function yearsKey(caseKey: "base" | "down"): "baseYears" | "downYears" {
  return caseKey === "base" ? "baseYears" : "downYears";
}

function highlightedDriverCells(caseKey: "base" | "down", field: keyof CaseAssumptions, scope: "all" | FY) {
  const rows = DRIVER_ROWS[field] ?? [];
  const prefix = caseKey === "base" ? "b" : "d";
  const cascades = !NON_CASH_DRIVERS.has(field as string);
  const cells = new Set<string>();
  rows.forEach((row) => {
    const years = scope === "all" ? [0, 1, 2]
      : cascades && CASCADE_ROWS.has(row) ? [0, 1, 2].filter((year) => year >= scope)
        : [scope];
    years.forEach((year) => cells.add(row + ":" + prefix + year));
  });
  return cells;
}

function useAssumptionActions(draft: ModelDraftState, grid: ModelGridUi) {
  const setAsmp = (caseKey: "base" | "down", field: keyof CaseAssumptions, value: number) =>
    draft.setAssumptions((current) => ({ ...current, [caseKey]: { ...current[caseKey], [field]: value } }));
  const setAsmpYear = (caseKey: "base" | "down", year: FY, field: keyof CaseAssumptions, value: number) =>
    draft.setAssumptions((current) => {
      const key = yearsKey(caseKey);
      const years = current[key] ?? {};
      return { ...current, [key]: { ...years, [year]: { ...years[year], [field]: value } } };
    });
  const resetCase = (caseKey: "base" | "down") =>
    draft.setAssumptions((current) => ({ ...current, [caseKey]: { ...DEFAULT_CASE }, [yearsKey(caseKey)]: {} }));
  const scrubHighlight = (caseKey: "base" | "down", field: keyof CaseAssumptions, scope: "all" | FY) =>
    grid.setHlCells(highlightedDriverCells(caseKey, field, scope));
  const clearYearDriver = (caseKey: "base" | "down", year: FY, field: keyof CaseAssumptions) =>
    draft.setAssumptions((current) => {
      const key = yearsKey(caseKey);
      const years = { ...(current[key] ?? {}) };
      const yearOverrides = { ...(years[year] ?? {}) };
      delete yearOverrides[field];
      if (Object.keys(yearOverrides).length) years[year] = yearOverrides;
      else delete years[year];
      return { ...current, [key]: years };
    });
  return { setAsmp, setAsmpYear, resetCase, scrubHighlight, clearYearDriver };
}

function narrowModelContract(panels: ModelPanels): NarrowContract {
  return {
    essentialControls: (
      <>
        <ModelToggle label="QTRS" active={panels.showQuarters} onClick={() => panels.setShowQuarters(!panels.showQuarters)} />
      </>
    ),
  };
}

function modelIssuerIdentity(searchParams: { get(name: string): string | null }, dataMode: DataMode) {
  const requestedIssuerId = searchParams.get("issuer");
  const isReference = dataMode === "reference";
  const issuerId = isReference ? ATLF_REFERENCE_ISSUER_ID : requestedIssuerId;
  if (!issuerId) throw new Error("Live Model Builder requires an explicit issuer");
  return {
    issuerId,
    isReference,
    issuerName: isReference ? "Atlas Forge Industrials" : issuerId,
  };
}

function modelAsOfValue(eng: ModelEngineState, isReference: boolean) {
  if (eng.asOf) return fmtUtcDateTime(eng.asOf);
  if (isReference) return "2026-05-31 · reference fixture";
  return null;
}

function decisionForModel(
  available: boolean,
  eng: ModelEngineState,
  model: Model,
  freshness: FreshnessEvaluation | null,
  asOf: string | null,
  dirty: boolean,
) {
  if (available) return buildModelDecision(eng, model, freshness, asOf, dirty);
  const unavailable = unavailableModelDecision(eng);
  return { whatChanged: unavailable, whyItMatters: unavailable, requiredAction: unavailable, evidenceHealth: unavailable };
}

function useModelEngineState(
  legacyRuntime: LegacyModelRuntime,
  identity: ReturnType<typeof modelIssuerIdentity>,
  analysis: ModelAnalysisContext,
  grid: ModelGridUi,
  draft: ModelDraftState,
) {
  const eng = useModelEngine(identity.issuerId);
  const activeCheckpointId = analysis.context?.artifacts.model_checkpoint_id;
  const freshnessRead = useIssuerFreshness({
    contextId: analysis.context?.id,
    runId: eng.runId,
    artifactRevision: (analysis.context?.updated_at ?? "") + ":" + (activeCheckpointId ?? ""),
  });
  const modelFreshness = derivedFreshness(freshnessRead, activeCheckpointId);
  const severity = 1;
  const model = useMemo(
    () => legacyRuntime.buildModel(severity, grid.overrides, eng.anchor ?? undefined, draft.assumptions),
    [legacyRuntime, severity, grid.overrides, eng.anchor, draft.assumptions],
  );
  useChangedModelHighlight(model, grid.setHlCells);
  const hasIssuerModel = identity.isReference || !!eng.anchor;
  const dirty = hasIssuerModel && draft.savedSnapshot.current !== null
    && serializeSavable(draft.assumptions, grid.overrides, draft.collapsedRows) !== draft.savedSnapshot.current;
  const modelAsOf = modelAsOfValue(eng, identity.isReference);
  return {
    eng, modelFreshness, severity, model, hasIssuerModel, dirty, modelAsOf,
    engineLoading: !identity.isReference && eng.loading,
    modelDecision: decisionForModel(hasIssuerModel, eng, model, modelFreshness, modelAsOf, dirty),
    exportMeta: modelExportMeta(identity.isReference, identity.issuerName, eng.runId),
  };
}

function useModelBuilderController({ legacyRuntime, dataMode }: { legacyRuntime: LegacyModelRuntime; dataMode: DataMode }) {
  const identity = modelIssuerIdentity(useSearchParams(), dataMode);
  const analysis = useAnalysisContext({ name: identity.issuerName + " model" });
  const grid = useModelGridUi(identity.issuerId);
  const draft = useModelDraftState();
  const hydration = useModelHydration(identity.issuerId, identity.isReference, grid, draft);
  const panels = useModelPanels(hydration.hydrated);
  const engine = useModelEngineState(legacyRuntime, identity, analysis, grid, draft);
  useModelContextBinding(analysis, identity.issuerId, engine.eng.runId, draft.setCheckpointNotice);
  useServerCheckpointLoad(identity.issuerId, draft);
  const modelExport = useModelExport(identity.issuerId, engine.model, panels, grid.overrides, draft.assumptions, engine.exportMeta, engine.eng);
  const editingActions = useModelEditingActions(grid);
  const assumptionActions = useAssumptionActions(draft, grid);
  const reports = useMemo(() => legacyRuntime.buildReports(), [legacyRuntime]);
  const saveDraft = () => saveCurrentModel({ issuerId: identity.issuerId, hydrated: hydration.hydrated, draft, grid, panels, model: engine.model });
  const saveModelCheckpoint = () => saveCheckpoint({ issuerId: identity.issuerId, hydrated: hydration.hydrated, draft, analysis, eng: engine.eng, saveDraft });
  const restoreCheckpointFromServer = (checkpoint: ModelCheckpointDTO) =>
    restoreServerCheckpoint({ checkpoint, issuerId: identity.issuerId, hydrated: hydration.hydrated, dirty: engine.dirty, draft });
  return {
    analysis, ...grid, ...draft, ...panels, ...editingActions, ...assumptionActions,
    ...modelExport, hydrated: hydration.hydrated, retryRestore: hydration.retryRestore,
    ...identity, ...engine, reports,
    ovCount: Object.keys(grid.overrides).length,
    narrowContract: narrowModelContract(panels),
    saveCheckpoint: saveModelCheckpoint,
    restoreServerCheckpoint: restoreCheckpointFromServer,
  };
}

type ModelBuilderController = ReturnType<typeof useModelBuilderController>;

function ModelIdentityBadge({ state }: { state: ModelBuilderController }) {
  if (state.isReference) {
    return <span className="tabular text-caos-md text-caos-accent truncate min-w-[8ch]" title="MODEL M-118">MODEL M-118</span>;
  }
  if (state.eng.runId) {
    return <span className="tabular text-caos-md text-caos-accent whitespace-nowrap">RUN {state.eng.runId.slice(0, 8)}</span>;
  }
  return null;
}

function ModelSaveState({ state }: { state: ModelBuilderController }) {
  if (state.restoreError) {
    return (
      <span role="alert" className="inline-flex">
        <button type="button" onClick={state.retryRestore} title="Couldn't load this issuer's saved model — showing your local draft. Click to retry." className="focus-ring min-h-6 tabular text-caos-2xs uppercase tracking-wide whitespace-nowrap px-1.5 py-px rounded border" style={{ color: "var(--caos-warning)", borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)" }}>
          <span className="md:hidden">⚠ MODEL · RETRY</span>
          <span className="hidden md:inline">⚠ SAVED MODEL UNAVAILABLE · RETRY</span>
        </button>
      </span>
    );
  }
  if (!state.isReference && state.eng.phase === "error") {
    return <span role="alert" title="Could not load this issuer's live run — showing the local/seeded model, not a confirmed no-run." className="tabular text-caos-2xs uppercase tracking-wide whitespace-nowrap px-1.5 py-px rounded border" style={{ color: "var(--caos-warning)", borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)" }}>⚠ LIVE RUN UNAVAILABLE</span>;
  }
  if (state.saveConflict) {
    return (
      <span role="alert" className="inline-flex">
        <button type="button" onClick={() => { state.setSaveConflict(false); state.retryRestore(); }} title="This model was saved elsewhere (e.g. another tab) since you loaded it — your edits were NOT saved. Click to reload the latest version, then reapply your changes." className="focus-ring min-h-6 tabular text-caos-2xs uppercase tracking-wide whitespace-nowrap px-1.5 py-px rounded border" style={{ color: "var(--caos-critical)", borderColor: "color-mix(in srgb, var(--caos-critical) 40%, transparent)" }}>
          <span className="md:hidden">✗ CONFLICT · RELOAD</span>
          <span className="hidden md:inline">✗ SAVED ELSEWHERE · RELOAD</span>
        </button>
      </span>
    );
  }
  if (state.saveError) return <span role="alert" className="tabular text-caos-2xs whitespace-nowrap" style={{ color: "var(--caos-critical)" }}>✗ SAVE FAILED</span>;
  if (state.dirty) return <span className="tabular text-caos-2xs whitespace-nowrap" title="You have edits not yet saved to the database. Report Studio reads the last saved version." style={{ color: "var(--caos-warning)" }}>● UNSAVED</span>;
  if (state.savedAt) return <span className="tabular text-caos-2xs text-caos-muted whitespace-nowrap">SAVED {fmtLocalDateTime(state.savedAt)}</span>;
  return null;
}

function ModelIdentity({ state }: { state: ModelBuilderController }) {
  return (
    <ShellIdentity tag="MODEL" badges={<ModelIdentityBadge state={state} />} title={state.issuerName + " — cash-flow model"}>
      <ModelProvenance eng={state.eng} model={state.model} allowSeededFallback={state.isReference} freshness={state.modelFreshness} />
      <ModelSaveState state={state} />
    </ShellIdentity>
  );
}

function checkpointActionTitle(state: ModelBuilderController) {
  if (!state.hasIssuerModel) return "Load an issuer model first — the reference fixture cannot be checkpointed";
  if (!state.hydrated || state.analysis.loading) return "Preparing the model workspace…";
  return "Save the working model, then create an immutable checkpoint for downstream reporting";
}

function ModelPrimaryActions({ state }: { state: ModelBuilderController }): PageAction {
  const checkpointDisabled = !state.hasIssuerModel || !state.hydrated || state.saving || state.checkpointing || state.analysis.loading;
  return {
    label: "Save model checkpoint",
    onAction: state.saveCheckpoint,
    unavailableReason: checkpointDisabled
      ? state.saving || state.checkpointing
        ? "Model checkpoint save is in progress…"
        : checkpointActionTitle(state)
      : null,
    title: checkpointActionTitle(state),
  };
}

function ModelStatus({ state }: { state: ModelBuilderController }) {
  const execution = state.saving || state.checkpointing || state.analysis.loading
    ? "running"
    : state.saveError || state.saveConflict
      ? "failed"
      : state.hasIssuerModel && state.hydrated
        ? "complete"
        : "not-started";
  const persistence = state.dirty
    ? "unsaved"
    : state.savedAt || state.checkpointNotice
      ? "saved"
      : state.hasIssuerModel
        ? "draft"
        : "unsaved";
  const compactStatus = execution === "running"
    ? "Updating model"
    : execution === "failed"
      ? "Model action failed"
      : persistence === "unsaved"
        ? "Unsaved changes"
        : persistence === "saved"
          ? "Checkpoint saved"
          : "Model draft";
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="2xl:hidden tabular text-caos-xs text-caos-muted">{compactStatus}</span>
      <span className="hidden 2xl:inline"><CompletionStateSummary label="Model completion" execution={execution} persistence={persistence} approval="not-applicable" freshness="unknown" /></span>
      {state.modelAsOf ? <span className="hidden 2xl:inline tabular text-caos-2xs text-caos-muted">Anchor {state.modelAsOf}</span> : null}
      {state.checkpointNotice ? <span role="status" className="tabular text-caos-2xs text-caos-muted">{state.checkpointNotice}</span> : null}
    </div>
  );
}

function ModelHistory({ state }: { state: ModelBuilderController }) {
  return (
    <span className="flex items-center gap-2">
      <ModelHistoryControls
        canUndo={state.canUndo}
        canRedo={state.canRedo}
        onUndo={state.undo}
        onRedo={state.redo}
        checkpoints={state.checkpoints}
        onCheckpoint={state.checkpoint}
        onRestore={state.restoreCheckpoint}
        onDelete={state.deleteCheckpoint}
        disabled={!state.hydrated}
        status={state.persistenceState}
        error={state.persistenceError}
      />
    </span>
  );
}

const MODEL_SUPPORT_OPTIONS: readonly { id: Exclude<ModelSupportPanel, null>; label: string }[] = [
  { id: "assumptions", label: "Assumptions" },
  { id: "scenario", label: "Scenario" },
  { id: "evidence", label: "Evidence" },
  { id: "history", label: "History" },
];

function ModelSupportControls({ state }: { state: ModelBuilderController }) {
  return (
    <div role="group" aria-label="Model support" className="flex min-w-0 items-center gap-1">
      {MODEL_SUPPORT_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-label={option.label}
          aria-pressed={state.activeSupport === option.id}
          onClick={() => state.setActiveSupport(state.activeSupport === option.id ? null : option.id)}
          className="focus-ring tabular min-h-7 rounded border border-caos-border px-1.5 text-caos-xs text-caos-muted hover:border-caos-accent/60 hover:text-caos-text"
        >
          {option.id === "assumptions" ? "Inputs" : option.id === "scenario" ? "Cases" : option.id === "evidence" ? "Sources" : "History"}
        </button>
      ))}
    </div>
  );
}

function ServerCheckpointButton({ state, item }: { state: ModelBuilderController; item: ModelCheckpointDTO }) {
  const disabled = !state.hydrated || state.checkpointing || item.issuer_id !== state.issuerId;
  return (
    <button
      type="button"
      onClick={() => { if (!disabled) void state.restoreServerCheckpoint(item); }}
      aria-disabled={disabled || undefined}
      title={item.issuer_id !== state.issuerId ? "Checkpoint belongs to a different issuer" : undefined}
      className="focus-ring flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-caos-xs text-caos-muted hover:bg-caos-elevated hover:text-caos-text"
    >
      <span className="truncate">{item.label}</span>
      <span className="tabular shrink-0">{new Date(item.created_at).toLocaleDateString("en-CA")}</span>
    </button>
  );
}

function ModelServerCheckpoints({ state }: { state: ModelBuilderController }) {
  if (state.serverCheckpointsIssuerId !== state.issuerId || !state.serverCheckpoints.length) return null;
  return (
    <details className="relative">
      <summary className="caos-secondary-action focus-ring cursor-pointer">Server checkpoints · {state.serverCheckpoints.length}</summary>
      <div className="absolute right-0 top-full z-40 mt-1 w-80 max-h-72 overflow-auto rounded border border-caos-border bg-caos-panel p-1 shadow-xl">
        {state.serverCheckpoints.map((item) => <ServerCheckpointButton key={item.id} state={state} item={item} />)}
      </div>
    </details>
  );
}

function ModelToggle({ label, active, title, onClick }: { label: string; active: boolean; title?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title} className={"tabular text-caos-xs px-1.5 h-6 rounded border transition-caos focus-ring whitespace-nowrap " + (active ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")}>
      {label}
    </button>
  );
}

function requestOverrideReset(state: ModelBuilderController) {
  if (state.armReset) {
    if (state.armTimer.current) window.clearTimeout(state.armTimer.current);
    state.setArmReset(false);
    state.resetAll();
    return;
  }
  state.setArmReset(true);
  if (state.armTimer.current) window.clearTimeout(state.armTimer.current);
  state.armTimer.current = window.setTimeout(() => state.setArmReset(false), 3000);
}

function ModelOverrideReset({ state }: { state: ModelBuilderController }) {
  if (!state.ovCount) return null;
  const critical = state.armReset;
  return (
    <button onClick={() => requestOverrideReset(state)} title={critical ? "Click again to confirm — clears every manual override" : "Clear all manual overrides"} aria-pressed={critical} className="flex items-center gap-1.5 tabular text-caos-xs px-2 py-1 rounded border transition-caos whitespace-nowrap hover:bg-caos-elevated focus-ring" style={critical ? { color: "var(--caos-critical)", borderColor: "color-mix(in srgb, var(--caos-critical) 60%, transparent)", background: "color-mix(in srgb, var(--caos-critical) 10%, transparent)" } : { color: "var(--caos-warning)", borderColor: "color-mix(in srgb, var(--caos-warning) 50%, transparent)" }}>
      {critical ? <>▲ CONFIRM RESET?</> : <>↶ {state.ovCount} OVERRIDE{state.ovCount > 1 ? "S" : ""} · RESET</>}
    </button>
  );
}

function ModelUtilityControls({ state }: { state: ModelBuilderController }) {
  const exportDisabled = !state.hasIssuerModel || state.exporting;
  return (
    <>
      {state.restoreError ? <button type="button" onClick={state.retryRestore} className="md:hidden caos-action-secondary focus-ring w-full justify-start">Retry saved model</button> : null}
      {state.saveConflict ? <button type="button" onClick={() => { state.setSaveConflict(false); state.retryRestore(); }} className="md:hidden caos-action-secondary focus-ring w-full justify-start">Reload saved model</button> : null}
      <button type="button" onClick={() => { if (!exportDisabled) state.handleExport(); }} aria-disabled={exportDisabled || undefined} title={!state.hasIssuerModel ? "Load an issuer model first — the reference fixture is not exportable" : "Export the committee pack (.xlsx — model grid, scenarios, assumptions, headline facts, overrides)"} className="caos-action-secondary focus-ring w-full justify-start">{state.exporting ? "Exporting model…" : "Export model"}</button>
      <ModelToggle label="QUARTERS" active={state.showQuarters} onClick={() => state.setShowQuarters(!state.showQuarters)} />
      <ModelOverrideReset state={state} />
      <span className="tabular text-caos-xs uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap hidden xl:inline" style={{ color: "var(--caos-warning)", borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)", background: "color-mix(in srgb, var(--caos-warning) 8%, transparent)" }}>
        forecast cells unaudited — CP-5 scope is actuals only
      </span>
    </>
  );
}

function ModelEditorNotice({ state }: { state: ModelBuilderController }) {
  return (
    <>
      {state.editError ? <div role="alert" className="tabular text-caos-2xs px-2 py-1 rounded border whitespace-nowrap self-start" style={{ color: "var(--caos-critical)", borderColor: "color-mix(in srgb, var(--caos-critical) 50%, transparent)", background: "color-mix(in srgb, var(--caos-critical) 8%, transparent)" }}>✗ &ldquo;{state.editError}&rdquo; is not a valid number — override discarded</div> : null}
      {state.pasteNotice ? <div role="status" className="tabular text-caos-2xs px-2 py-1 rounded border whitespace-nowrap self-start" style={{ color: "var(--caos-accent)", borderColor: "color-mix(in srgb, var(--caos-accent) 40%, transparent)", background: "color-mix(in srgb, var(--caos-accent) 8%, transparent)" }}>{state.pasteNotice}</div> : null}
    </>
  );
}

function ModelAssumptionsRail({ state }: { state: ModelBuilderController }) {
  if (!state.showAssumptions) return <CollapsedRail side="left" label="Assumptions" onExpand={() => state.setShowAssumptions(true)} />;
  return (
    <AssumptionsPanel
      assumptions={state.assumptions}
      onChange={state.setAsmp}
      onChangeYear={state.setAsmpYear}
      onResetCase={state.resetCase}
      onResetYearCell={state.clearYearDriver}
      onScrub={state.scrubHighlight}
      onScrubEnd={() => state.setHlCells(null)}
      onCollapse={() => state.setShowAssumptions(false)}
    />
  );
}

function toggleCollapsedRow(state: ModelBuilderController, row: string) {
  state.setCollapsedRows((current) => {
    const next = new Set(current);
    if (next.has(row)) next.delete(row);
    else next.add(row);
    return next;
  });
}

function ModelSheetRegion({ state }: { state: ModelBuilderController }) {
  return (
    <div className="model-sheet-region flex-1 min-w-0 min-h-0 flex">
      <Sheet
        model={state.model}
        showQ={state.showQuarters}
        isReference={state.isReference}
        hl={state.hl}
        hlCells={state.hlCells}
        sel={state.sel}
        onSel={state.setSel}
        editing={state.editing}
        onEdit={state.setEditing}
        onCommit={state.commitEdit}
        onPasteCells={state.onPasteCells}
        collapsedRows={state.collapsedRows}
        onToggleRow={(row) => toggleCollapsedRow(state, row)}
      />
    </div>
  );
}

function ModelScenarioRail({ state }: { state: ModelBuilderController }) {
  if (!state.showScenarios) return <CollapsedRail side="right" label="Scenario & Sensitivity" onExpand={() => state.setShowScenarios(true)} />;
  return <ScenarioPanel model={state.model} downside={state.eng.downside} downsideState={state.eng.downsideState} issuerId={state.issuerId} runId={state.eng.runId} onCollapse={() => state.setShowScenarios(false)} />;
}

function AvailableModelWorkspace({ state }: { state: ModelBuilderController }) {
  return (
    <>
      <Manifest hl={state.hl} setHl={state.setHl} isReference={state.isReference} />
      <FormulaBar model={state.model} sel={state.sel} severity={state.severity} overrides={state.overrides} onResetCell={state.resetCell} onOpenEvidence={(id) => { state.setEvModal(id); state.setActiveSupport("evidence"); }} showQ={state.showQuarters} collapsedRows={state.collapsedRows} isReference={state.isReference} />
      <ModelEditorNotice state={state} />
      <div className="model-editor-layout flex-1 min-h-0 flex gap-2">
        <ModelSheetRegion state={state} />
        <ModelSupportSurface state={state} />
      </div>
    </>
  );
}

function MissingModelWorkspace({ state }: { state: ModelBuilderController }) {
  if (state.engineLoading) {
    return (
      <div className="flex-1 min-h-0 rounded border border-caos-border bg-caos-panel flex flex-col items-center justify-center gap-2 text-center px-6" role="status" aria-live="polite">
        <div className="flex items-center gap-2 tabular text-caos-md text-caos-muted">
          <span className="w-1.5 h-1.5 rounded-sm animate-pulse motion-reduce:animate-none" style={{ background: "var(--caos-accent)" }} />
          Linking engine…
        </div>
        <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Loading {state.issuerName} CP-1 anchor</div>
      </div>
    );
  }
  return (
    <div className="flex-1 min-h-0 rounded border border-caos-border bg-caos-panel flex flex-col items-center justify-center gap-3 text-center px-6">
      <div className="tabular text-caos-xl text-caos-text">No issuer-specific model output</div>
      <div className="text-caos-md text-caos-muted max-w-[520px] leading-relaxed">Model Builder needs a completed run with a usable CP-1 anchor. Run the issuer first; the seeded Atlas Forge grid is available only in the reference demo.</div>
      <a href={"/deepdive?issuer=" + encodeURIComponent(state.issuerId)} className="tabular text-caos-xs px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos whitespace-nowrap">Open {state.issuerName} in Deep-Dive →</a>
    </div>
  );
}

function ModelEditorWorkspace({ state }: { state: ModelBuilderController }) {
  return (
    <div className="model-editor-workspace flex flex-1 min-h-0 flex-col gap-2 p-2">
      {state.hasIssuerModel ? <AvailableModelWorkspace state={state} /> : <MissingModelWorkspace state={state} />}
    </div>
  );
}

function ModelPrimary({ state }: { state: ModelBuilderController }) {
  return (
    <div className="h-full min-h-0 flex flex-col">
      <ModelEditorWorkspace state={state} />
    </div>
  );
}

function ModelSupportSurface({ state }: { state: ModelBuilderController }) {
  if (!state.activeSupport) return null;
  return (
    <aside aria-label={`${MODEL_SUPPORT_OPTIONS.find((option) => option.id === state.activeSupport)?.label ?? "Model"} support`} className="min-w-0 shrink-0">
      {state.activeSupport === "assumptions" ? <ModelAssumptionsRail state={state} /> : null}
      {state.activeSupport === "scenario" ? <ModelScenarioRail state={state} /> : null}
      {state.activeSupport === "history" ? <div className="w-80 max-w-[36vw] rounded border border-caos-border bg-caos-panel p-2"><ModelHistory state={state} /><ModelServerCheckpoints state={state} /></div> : null}
      {state.activeSupport === "evidence" && state.evModal ? <EvidenceModal id={state.evModal} reports={state.reports} isLiveRun={!state.isReference} onClose={() => { state.setEvModal(null); state.setActiveSupport(null); }} /> : null}
      {state.activeSupport === "evidence" && !state.evModal ? <div className="w-80 max-w-[36vw] rounded border border-caos-border bg-caos-panel p-3 text-caos-sm text-caos-muted">Select a model cell citation to inspect its source.</div> : null}
    </aside>
  );
}

function ModelBuilderView({ state }: { state: ModelBuilderController }) {
  return (
    <EnterprisePage
      kind="editor"
      identity={<ModelIdentity state={state} />}
      primaryAction={ModelPrimaryActions({ state })}
      status={<ModelStatus state={state} />}
      contextualControls={<ModelSupportControls state={state} />}
      utilityLabel="Model tools"
      utilityControls={<ModelUtilityControls state={state} />}
      narrowContract={state.narrowContract}
    >
      <div className="caos-persona-route model-workbench flex-1 min-h-0">
        <PersonaWorkbench surface="model" decision={<DecisionHeader state={state.modelDecision} defaultOpen={false} />} primary={<ModelPrimary state={state} />} />
      </div>
    </EnterprisePage>
  );
}

function ModelBuilder({ legacyRuntime }: { legacyRuntime: LegacyModelRuntime }) {
  const searchParams = useSearchParams();
  const dataMode = useDataMode();
  if (dataMode === "live" && !searchParams.get("issuer")) return <ModelSetupState />;
  return <BoundModelBuilder legacyRuntime={legacyRuntime} dataMode={dataMode} />;
}

function ModelSetupState() {
  return (
    <EnterprisePage
      kind="editor"
      identity={<ShellIdentity title="Model Builder — issuer model" />}
      primaryAction={{ label: "Open reference model", href: "/model?mode=reference" }}
      narrowContract={{ essentialControls: null }}
    >
      <div className="caos-persona-route model-workbench flex-1 min-h-0 p-2">
        <PersonaWorkbench
          surface="model"
          primary={<SurfaceState kind="empty" title="Select an issuer model" detail="Open Model Builder from an issuer or choose the explicitly labelled reference model." headingLevel={2} compact />}
        />
      </div>
    </EnterprisePage>
  );
}

function BoundModelBuilder({ legacyRuntime, dataMode }: { legacyRuntime: LegacyModelRuntime; dataMode: DataMode }) {
  const state = useModelBuilderController({ legacyRuntime, dataMode });
  return <ModelBuilderView state={state} />;
}

// Thin expandable rail shown in place of a collapsed side panel: a vertical
// label + chevron that restores the full panel. Keeps the workspace bounds
// stable so the sheet doesn't reflow jarringly on collapse.
function CollapsedRail({ side, label, onExpand }: { side: "left" | "right"; label: string; onExpand: () => void }) {
  return (
    <div className="model-collapsed-rail w-7 shrink-0 bg-caos-panel border border-caos-border rounded-md flex flex-col items-center gap-2 py-2 text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos font-bold">
      <CollapseButton direction={side === "left" ? "right" : "left"} label={`Expand ${label} panel`} onClick={onExpand} />
      <span
        aria-hidden
        className="tabular text-caos-2xs uppercase tracking-wider whitespace-nowrap"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {label}
      </span>
    </div>
  );
}

// Engine provenance for the sub-header: whether the LTM/PF anchor is grounded in
// a live CP-1 run or the seeded demo model, plus a tie-out reconciling the
// leverage the grid actually DISPLAYS against CP-1's separately-reported figure.
// Status is always glyph-paired (dot / ✓ / ⚠), never carried by color alone.
function MissingModelProvenance({ eng, allowSeededFallback }: { eng: ModelEngineState; allowSeededFallback: boolean }) {
  if (!allowSeededFallback) {
    return (
      <span
        className="flex items-center gap-1.5 tabular text-caos-xs whitespace-nowrap text-caos-muted"
        title="No completed run with usable CP-1 anchor found; seeded model suppressed for issuer-scoped view."
      >
        <span className="w-1.5 h-1.5 rounded-sm" style={{ background: "var(--caos-idle)" }} />
        NO MODEL OUTPUT
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <ProvenanceChip prov={fromModelEngine(eng)} />
      <span className="tabular text-caos-xs text-caos-muted">RUN #2641</span>
    </span>
  );
}

function leverageTieOut(shown: number | null, cp1: number) {
  const drift = shown == null ? null : Math.abs(shown - cp1);
  const ties = drift != null && drift <= 0.05;
  if (shown == null) {
    return {
      ties,
      title: "Grid LTM net leverage is undefined (degenerate denominator); CP-1 reports " + cp1.toFixed(2) + "x.",
      label: <><StatusGlyph kind="warning" /> CP-1 {cp1.toFixed(2)}x · grid n/a</>,
    };
  }
  if (ties) {
    return {
      ties,
      title: "Grid LTM net leverage (" + shown.toFixed(2) + "x = net debt / adj. EBITDA) ties CP-1 reported (" + cp1.toFixed(2) + "x).",
      label: <>✓ net lev ties CP-1 {cp1.toFixed(2)}x</>,
    };
  }
  return {
    ties,
    title: "Grid shows " + shown.toFixed(2) + "x (net debt / adj. EBITDA) but CP-1 reports " + cp1.toFixed(2) + "x — likely a different net-debt / EBITDA basis. Shown side by side, not reconciled.",
    label: <><StatusGlyph kind="warning" /> grid {shown.toFixed(2)}x vs CP-1 {cp1.toFixed(2)}x</>,
  };
}

function LeverageTieOut({ shown, cp1 }: { shown: number | null; cp1: number }) {
  const tieOut = leverageTieOut(shown, cp1);
  const color = tieOut.ties ? "var(--caos-success)" : "var(--caos-warning)";
  return (
    <span
      className="flex items-center gap-1 tabular text-caos-xs px-1.5 py-px rounded border"
      style={{
        color,
        borderColor: "color-mix(in srgb, " + color + " 40%, transparent)",
        background: "color-mix(in srgb, " + color + " 8%, transparent)",
      }}
      title={tieOut.title}
    >
      {tieOut.label}
    </span>
  );
}

function LiveModelProvenance({ eng, model, freshness }: { eng: ModelEngineState; model: Model; freshness: FreshnessEvaluation | null }) {
  const cp1 = eng.anchor!.netLeverage;
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span
        className="flex items-center gap-1.5"
        title={"Anchored to live CP-1 from run " + eng.runId + " · committee: " + (eng.committeeStatus ?? "—")}
      >
        <ProvenanceChip prov={fromModelEngine(eng)} />
        <FreshnessIndicator evaluation={freshness} />
        <span className="tabular text-caos-xs" style={{ color: "var(--caos-success)" }}>
          CP-1 · RUN {eng.runId?.slice(0, 8) ?? "—"}
        </span>
      </span>
      <LeverageTieOut shown={model.cols.l1.netlev} cp1={cp1} />
    </span>
  );
}

function ModelProvenance({ eng, model, allowSeededFallback, freshness }: { eng: ModelEngineState; model: Model; allowSeededFallback: boolean; freshness: FreshnessEvaluation | null }) {
  if (eng.loading) return <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">· linking engine…</span>;
  if (!eng.live || !eng.anchor) return <MissingModelProvenance eng={eng} allowSeededFallback={allowSeededFallback} />;
  return <LiveModelProvenance eng={eng} model={model} freshness={freshness} />;
}
