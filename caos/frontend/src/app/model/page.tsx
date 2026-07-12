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
import { exportModel } from "@/components/model/export";
import { OV_SIGN, ovField, parseNum, type PasteResult } from "@/components/model/model-format";
import { ROWS } from "@/components/model/rows";
import { buildModel, type Model, type Overrides } from "@/lib/reports/model";
import {
  type Assumptions, type CaseAssumptions, type FY, ADDBACKS, DEFAULT_ASSUMPTIONS, DEFAULT_CASE, loadAssumptions, saveAssumptions,
} from "@/lib/reports/assumptions";
import { buildReports } from "@/lib/reports/builders";
import { useModelEngine, type ModelEngineState } from "@/lib/engine/useModelEngine";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";
import { getSavedModel, saveModel as saveIssuerModel } from "@/lib/api";
import { ResponsiveShell, type NarrowContract } from "@/components/shared/ResponsiveShell";
import Link from "next/link";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { fromModelEngine } from "@/lib/provenance";

type SavedModel = Awaited<ReturnType<typeof getSavedModel>>;

// Pull the typed, guarded pieces out of a saved-model payload (shared by the
// hydrate effect and the retry handler). Returns null when there's no payload.
function parseSavedPayload(saved: SavedModel) {
  const p = saved?.payload;
  if (!p) return null;
  const o = p.overrides && typeof p.overrides === "object" ? (p.overrides as Overrides) : undefined;
  const a = p.assumptions && typeof p.assumptions === "object" ? (p.assumptions as Assumptions) : undefined;
  const c = Array.isArray(p.collapsedRows) ? new Set(p.collapsedRows as string[]) : undefined;
  return { o, a, c, updatedAt: saved?.updated_at ?? null };
}

export default function ModelPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <ModelBuilder />
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

function ModelBuilder() {
  const searchParams = useSearchParams();
  const issuerId = searchParams.get("issuer") || ATLF_REFERENCE_ISSUER_ID;
  const isReference = issuerId === ATLF_REFERENCE_ISSUER_ID;
  // No display-name source exists in useModelEngine; the issuerId is the honest
  // minimum for a live name — do NOT fabricate a company name.
  const issuerName = isReference ? "Atlas Forge Industrials" : issuerId;
  const [hl, setHl] = useState<string | null>(null);
  const [sel, setSel] = useState<CellRef | null>({ row: "netlev", col: "l1" });
  const [evModal, setEvModal] = useState<string | null>(null);
  const severity = 1; // downside built at CP-2B base pathway (P1); no analyst severity dial
  const [showQuarters, setShowQuarters] = useState(true);
  const [showScenarios, setShowScenarios] = useState(true);
  const [showAssumptions, setShowAssumptions] = useState(true);
  const [editing, setEditing] = useState<CellRef | null>(null);
  const [hlCells, setHlCells] = useState<Set<string> | null>(null);
  const history = useModelHistory(issuerId);
  const { overrides, setOverrides, replaceOverrides, undo, redo, canUndo, canRedo, checkpoints, checkpoint, restoreCheckpoint, deleteCheckpoint } = history;
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const pasteNoticeTimer = useRef<number | null>(null);
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [collapsedRows, setCollapsedRows] = useState<Set<string>>(new Set());
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // True when a DB-saved model exists but the restore fetch failed (network/500):
  // the analyst is looking at the local draft and must be told, with a retry.
  const [restoreError, setRestoreError] = useState(false);
  const [restoreNonce, setRestoreNonce] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // True when a save was rejected because this issuer's model was saved
  // elsewhere since it was last loaded here (another tab, same analyst) —
  // distinct from saveError so the recovery affordance (reload) can differ
  // from a generic failure (retry the same save).
  const [saveConflict, setSaveConflict] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [armReset, setArmReset] = useState(false);
  const savedSnapshot = useRef<string | null>(null);
  const editErrTimer = useRef<number | null>(null);
  const armTimer = useRef<number | null>(null);

  // evidence modal cited-by needs the report set
  const reports = useMemo(() => buildReports(), []);

  // clear transient timers on unmount
  useEffect(() => () => {
    if (editErrTimer.current) window.clearTimeout(editErrTimer.current);
    if (armTimer.current) window.clearTimeout(armTimer.current);
    if (pasteNoticeTimer.current) window.clearTimeout(pasteNoticeTimer.current);
  }, []);

  // ⌘Z / ⌘⇧Z (or Ctrl+Z / Ctrl+Y) undo/redo the override grid — G3. Skipped
  // while a text field has focus (the Assumptions sliders' number inputs, a
  // Deep-Dive-style search box, or an open CellInput) so the browser's own
  // native input-undo isn't fought; the CellInput editor closes on blur before
  // any of this could double-fire on the same keystroke in practice, but the
  // guard is cheap insurance regardless.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const flashPasteNotice = (text: string) => {
    setPasteNotice(text);
    if (pasteNoticeTimer.current) window.clearTimeout(pasteNoticeTimer.current);
    pasteNoticeTimer.current = window.setTimeout(() => setPasteNotice(null), 3500);
  };
  const onPasteCells = (result: PasteResult) => {
    if (result.applied > 0) setOverrides((o) => ({ ...o, ...result.patch }));
    const parts = [
      result.applied > 0 ? `pasted ${result.applied} cell${result.applied === 1 ? "" : "s"}` : null,
      result.skippedNotEditable > 0 ? `${result.skippedNotEditable} not editable` : null,
      result.invalid.length > 0 ? `${result.invalid.length} invalid value${result.invalid.length === 1 ? "" : "s"} discarded` : null,
    ].filter(Boolean);
    if (parts.length === 0) return; // nothing landed and nothing to report — a no-op paste
    flashPasteNotice(parts.join(" · "));
  };

  // Overrides localStorage key is per-issuer so a live issuer never inherits the
  // reference demo's fabricated overrides (cross-issuer contamination). Legacy
  // global key is adopted once, and only by the reference issuer.
  const ovKey = "caos-d-overrides:" + issuerId;

  useEffect(() => {
    // Cancel-safe: a slow getSavedModel for the PRIOR issuer must not land on the
    // new issuer's grid (and then get persisted under it) when the analyst navigates
    // A -> B mid-fetch. (audit F1)
    let stale = false;
    // locals track what was actually loaded so the dirty-baseline snapshot below
    // reflects restored state, not the stale render closure.
    let lo: Overrides = {};
    let la: Assumptions = DEFAULT_ASSUMPTIONS;
    const lc: Set<string> = new Set();
    try {
      let raw = localStorage.getItem(ovKey);
      if (raw == null && isReference) {
        const legacy = localStorage.getItem("caos-d-overrides");
        if (legacy != null) raw = legacy; // reference issuer inherits old demo state
      }
      const o = JSON.parse(raw || "{}");
      if (o && typeof o === "object") { lo = o; replaceOverrides(o); }
      la = loadAssumptions(issuerId);
      setAssumptions(la);
    } catch { /* first visit */ }
    // baseline dirty at local-storage state; refined below if a DB model restores
    savedSnapshot.current = serializeSavable(la, lo, lc);
    setRestoreError(false);
    getSavedModel(issuerId).then((saved) => {
      if (stale) return;
      const parsed = parseSavedPayload(saved);
      if (!parsed) return;
      const { o, a, c, updatedAt } = parsed;
      if (o) replaceOverrides(o);
      if (a) setAssumptions(a);
      if (c) setCollapsedRows(c);
      setSavedAt(updatedAt);
      // re-baseline the dirty flag at the just-restored DB state
      savedSnapshot.current = serializeSavable(a ?? la, o ?? lo, c ?? lc);
    }).catch(() => { if (!stale) setRestoreError(true); });
    setHydrated(true);
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issuerId, ovKey, isReference, restoreNonce]);
  // Retry a failed DB-model restore by re-running the guarded hydrate effect above —
  // the retry then inherits the same SEC-H1 stale-flag. (A bespoke getSavedModel here
  // had no stale guard, so a retry left in-flight across an issuer switch landed A's
  // model on B's state and persisted it under B's keys — the exact H-1 race, on the
  // retry path. The local draft the effect re-reads from storage equals current state:
  // the persist effects below write through on every change once hydrated.)
  const retryRestore = () => setRestoreNonce((n) => n + 1);
  // persist only after restore — writing earlier clobbers stored state with defaults
  useEffect(() => { if (hydrated) try { localStorage.setItem(ovKey, JSON.stringify(overrides)); } catch {} }, [hydrated, ovKey, overrides]);
  useEffect(() => { if (hydrated) saveAssumptions(issuerId, assumptions); }, [hydrated, issuerId, assumptions]);
  useEffect(() => {
    const onCollapse = () => {
      const next = !(showAssumptions || showScenarios);
      setShowAssumptions(next);
      setShowScenarios(next);
    };
    window.addEventListener("caos:collapse-toggle", onCollapse);
    return () => window.removeEventListener("caos:collapse-toggle", onCollapse);
  }, [showAssumptions, showScenarios]);

  // Keyhole guard: the two fixed flank panels (Assumptions 348 + Scenario 372)
  // starve the sheet below ~1280 and push the action buttons off-canvas. On
  // hydrate, collapse the flanks that don't fit; on resize ONE-WAY collapse as
  // width crosses below a threshold (never force-expand — respect the user's
  // choice above threshold). SSR-guarded via the hydrated gate.
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const w0 = window.innerWidth;
    if (w0 < 1280) setShowScenarios(false);
    if (w0 < 1024) setShowAssumptions(false);
    let prev = w0;
    const onResize = () => {
      const w = window.innerWidth;
      if (prev >= 1280 && w < 1280) setShowScenarios(false);
      if (prev >= 1024 && w < 1024) setShowAssumptions(false);
      prev = w;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Prefer a live CP-1 run for the LTM/PF anchor. Only the ATLF reference page
  // may fall back to the seeded demo model.
  const eng = useModelEngine(issuerId);
  const model = useMemo(
    () => buildModel(severity, overrides, eng.anchor ?? undefined, assumptions),
    [severity, overrides, eng.anchor, assumptions],
  );
  const hasIssuerModel = isReference || !!eng.anchor;
  // While a live issuer's engine anchor is still loading, hasIssuerModel is
  // false but the empty state ("Run the issuer first") is a wrong, alarming
  // conclusion — the run may be perfectly good. Gate on eng.loading so the
  // workspace shows a neutral "linking engine…" panel until the fetch settles,
  // and only assert the empty state once loading is false and no anchor exists.
  const engineLoading = !isReference && eng.loading;
  const ovCount = Object.keys(overrides).length;
  const prevModel = useRef<Model | null>(null);

  // Stable serialization of the savable payload — Report Studio reads only the
  // DB-saved model, so compare current savable state against the last-saved
  // snapshot to signal unsaved edits.
  const serializeSavable = (a: Assumptions, o: Overrides, c: Set<string>): string =>
    JSON.stringify({ a, o, c: [...c].sort() });
  const currentSnapshot = serializeSavable(assumptions, overrides, collapsedRows);
  const dirty = hasIssuerModel && savedSnapshot.current !== null && currentSnapshot !== savedSnapshot.current;

  // Export masthead: reference keeps the ATLF demo lineage verbatim; a live
  // issuer must NOT carry fabricated M-118 / #2641 lineage.
  const exportMeta = isReference
    ? { header: "Atlas Forge Industrials — cash-flow model M-118", subheader: "YE 31-Dec · $m · RUN #2641 · * derived period (G-02)", filename: "ATLF Cash-Flow Model M-118.csv" }
    : { header: `${issuerName} — cash-flow model`, subheader: `YE 31-Dec · $m${eng.runId ? " · RUN " + eng.runId : ""} · * derived period (G-02)`, filename: `${issuerName} Cash-Flow Model.csv` };

  useEffect(() => {
    const prev = prevModel.current;
    prevModel.current = model;
    if (!prev) return;
    const changed = new Set<string>();
    for (const row of ROWS) {
      if (!row.g) continue;
      for (const col of model.columns) {
        const a = row.g(prev.cols[col.key]);
        const b = row.g(model.cols[col.key]);
        if (a !== b && !(typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b))) changed.add(row.id + ":" + col.key);
      }
    }
    if (!changed.size) return;
    setHlCells(changed);
    const t = window.setTimeout(() => setHlCells((cur) => (cur === changed ? null : cur)), 650);
    return () => window.clearTimeout(t);
  }, [model]);

  const flashEditError = (bad: string) => {
    setEditError(bad);
    if (editErrTimer.current) window.clearTimeout(editErrTimer.current);
    editErrTimer.current = window.setTimeout(() => setEditError(null), 2500);
  };
  const commitEdit = (txt: string | null) => {
    if (!editing) return;
    if (txt != null) {
      const trimmed = txt.trim();
      const v = parseNum(txt);
      if (v != null) {
        const field = ovField(editing.row);
        const key = editing.col + ":" + field;
        setOverrides((o) => ({ ...o, [key]: v * OV_SIGN[field] }));
        setSel({ row: editing.row, col: editing.col });
      } else if (trimmed) {
        // non-empty but unparseable — don't silently discard; surface it briefly
        flashEditError(trimmed);
        setSel({ row: editing.row, col: editing.col });
      }
    }
    setEditing(null);
  };
  const resetCell = (key: string) => setOverrides((o) => { const n = { ...o }; delete n[key]; return n; });
  const resetAll = () => setOverrides({});
  const saveCurrentModel = () => {
    setSaving(true);
    setSaveError(false);
    setSaveConflict(false);
    return saveIssuerModel(issuerId, {
      version: 1,
      assumptions,
      overrides,
      collapsedRows: [...collapsedRows],
      view: { showQuarters, showAssumptions, showScenarios },
      model: { columns: model.columns, cols: model.cols, provenance: model.provenance },
    }, savedAt)
      .then((r) => {
        setSavedAt(r.updated_at);
        // re-baseline the dirty flag to the just-saved state
        savedSnapshot.current = serializeSavable(assumptions, overrides, collapsedRows);
      })
      .catch((e) => {
        if (axios.isAxiosError(e) && e.response?.status === 409) setSaveConflict(true);
        else setSaveError(true);
      })
      .finally(() => setSaving(false));
  };

  const yearsKey = (caseKey: "base" | "down"): "baseYears" | "downYears" => (caseKey === "base" ? "baseYears" : "downYears");
  const setAsmp = (caseKey: "base" | "down", field: keyof CaseAssumptions, value: number) =>
    setAssumptions((a) => ({ ...a, [caseKey]: { ...a[caseKey], [field]: value } }));
  const setAsmpYear = (caseKey: "base" | "down", year: FY, field: keyof CaseAssumptions, value: number) =>
    setAssumptions((a) => {
      const yk = yearsKey(caseKey);
      const years = a[yk] ?? {};
      return { ...a, [yk]: { ...years, [year]: { ...years[year], [field]: value } } };
    });
  const resetCase = (caseKey: "base" | "down") =>
    setAssumptions((a) => ({ ...a, [caseKey]: { ...DEFAULT_CASE }, [yearsKey(caseKey)]: {} }));
  // Flash the sheet cells a driver feeds while it is scrubbed: its row(s) ×
  // the case's forecast columns. ALL → all three years. A single year → that
  // column, except cash-based KPIs (net/sr-sec leverage) which roll forward via
  // cash, so a year-scoped change to a cash-affecting driver also moves them in
  // every LATER year — highlight those too.
  const scrubHighlight = (caseKey: "base" | "down", field: keyof CaseAssumptions, scope: "all" | FY) => {
    const rows = DRIVER_ROWS[field] ?? [];
    const pre = caseKey === "base" ? "b" : "d";
    const cascades = !NON_CASH_DRIVERS.has(field as string);
    const set = new Set<string>();
    rows.forEach((r) => {
      const yrs = scope === "all" ? [0, 1, 2]
        : cascades && CASCADE_ROWS.has(r) ? [0, 1, 2].filter((y) => y >= scope)
          : [scope];
      yrs.forEach((y) => set.add(r + ":" + pre + y));
    });
    setHlCells(set);
  };
  // Clear one year's override for a single driver (cell tracks the ALL value again).
  const clearYearDriver = (caseKey: "base" | "down", year: FY, field: keyof CaseAssumptions) =>
    setAssumptions((a) => {
      const yk = yearsKey(caseKey);
      const years = { ...(a[yk] ?? {}) };
      const yo = { ...(years[year] ?? {}) };
      delete yo[field];
      if (Object.keys(yo).length) years[year] = yo; else delete years[year];
      return { ...a, [yk]: years };
    });

  const narrowContract: NarrowContract = {
    essentialControls: (
      <>
        <button
          onClick={() => setShowQuarters(!showQuarters)}
          className={
            "tabular text-caos-xs px-1.5 h-6 rounded border transition-caos focus-ring whitespace-nowrap " +
            (showQuarters ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
          }
        >
          QTRS
        </button>
        <button
          onClick={() => setShowAssumptions(!showAssumptions)}
          title="Toggle the Assumptions panel"
          className={
            "tabular text-caos-xs px-1.5 h-6 rounded border transition-caos focus-ring whitespace-nowrap " +
            (showAssumptions ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
          }
        >
          ASMP
        </button>
        <button
          onClick={() => setShowScenarios(!showScenarios)}
          title="Toggle the Scenario & Sensitivity panel"
          className={
            "tabular text-caos-xs px-1.5 h-6 rounded border transition-caos focus-ring whitespace-nowrap " +
            (showScenarios ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
          }
        >
          SCEN
        </button>
      </>
    ),
  };

  return (
    <ResponsiveShell
      identity={
        <>
          <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-caos-xl transition-caos whitespace-nowrap">
            ← Directory
          </Link>
          <span className="h-4 w-px bg-caos-border shrink-0" />
          <ConceptNav compact />
          <span className="h-4 w-px bg-caos-border shrink-0" />
          {isReference ? (
            <span className="tabular text-caos-md text-caos-accent whitespace-nowrap">MODEL M-118</span>
          ) : eng.runId ? (
            <span className="tabular text-caos-md text-caos-accent whitespace-nowrap">RUN {eng.runId.slice(0, 8)}</span>
          ) : null}
          <span className="text-caos-xl text-caos-text font-medium truncate min-w-0">{issuerName} — cash-flow model</span>
          <ModelProvenance eng={eng} model={model} allowSeededFallback={isReference} />
          {/* Save status — paired with the provenance badge since both describe model state */}
          {restoreError ? (
            <button
              type="button"
              onClick={retryRestore}
              role="alert"
              title="Couldn't load this issuer's saved model — showing your local draft. Click to retry."
              className="focus-ring tabular text-caos-2xs uppercase tracking-wide whitespace-nowrap px-1.5 py-px rounded border"
              style={{ color: "var(--caos-warning)", borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)" }}
            >
              ⚠ SAVED MODEL UNAVAILABLE · RETRY
            </button>
          ) : !isReference && eng.phase === "error" ? (
            // M-5: eng (useModelEngine) collapsed a genuine backend error into the
            // same empty state as "no run yet" before the phase field existed —
            // surface it distinctly, same posture as restoreError above (no retry
            // action here: useModelEngine has no on-demand refetch to wire).
            <span
              role="alert"
              title="Could not load this issuer's live run — showing the local/seeded model, not a confirmed no-run."
              className="tabular text-caos-2xs uppercase tracking-wide whitespace-nowrap px-1.5 py-px rounded border"
              style={{ color: "var(--caos-warning)", borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)" }}
            >
              ⚠ LIVE RUN UNAVAILABLE
            </span>
          ) : saveConflict ? (
            <button
              type="button"
              onClick={() => { setSaveConflict(false); retryRestore(); }}
              role="alert"
              title="This model was saved elsewhere (e.g. another tab) since you loaded it — your edits were NOT saved. Click to reload the latest version, then reapply your changes."
              className="focus-ring tabular text-caos-2xs uppercase tracking-wide whitespace-nowrap px-1.5 py-px rounded border"
              style={{ color: "var(--caos-critical)", borderColor: "color-mix(in srgb, var(--caos-critical) 40%, transparent)" }}
            >
              ✗ SAVED ELSEWHERE · RELOAD
            </button>
          ) : saveError ? (
            <span role="alert" className="tabular text-caos-2xs whitespace-nowrap" style={{ color: "var(--caos-critical)" }}>
              ✗ SAVE FAILED
            </span>
          ) : dirty ? (
            <span
              className="tabular text-caos-2xs whitespace-nowrap"
              title="You have edits not yet saved to the database. Report Studio reads the last saved version."
              style={{ color: "var(--caos-warning)" }}
            >
              ● UNSAVED
            </span>
          ) : savedAt ? (
            <span className="tabular text-caos-2xs text-caos-muted whitespace-nowrap">SAVED {new Date(savedAt).toLocaleString()}</span>
          ) : null}
        </>
      }
      primaryAction={
        <>
          <button
            onClick={saveCurrentModel}
            disabled={!hasIssuerModel || saving}
            title="Save this issuer model to the database; Report Builder reads the saved version only"
            className="inline-flex items-center gap-1.5 tabular text-caos-xs px-2 py-1 rounded border border-caos-success text-caos-success hover:bg-caos-success hover:text-caos-bg transition-caos whitespace-nowrap focus-ring disabled:opacity-40"
          >
            {saving ? "SAVING..." : "SAVE MODEL"}
          </button>
          <button
            onClick={() => exportModel(model, showQuarters, overrides, exportMeta)}
            disabled={!hasIssuerModel}
            title="Export the model grid (CSV — opens in Excel)"
            className="inline-flex items-center gap-1.5 tabular text-caos-xs px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos whitespace-nowrap focus-ring disabled:opacity-40"
          >
            ▦ EXPORT MODEL
          </button>
        </>
      }
      contextualControls={
        <>
          <ModelHistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            checkpoints={checkpoints}
            onCheckpoint={checkpoint}
            onRestore={restoreCheckpoint}
            onDelete={deleteCheckpoint}
          />
          <span className="h-4 w-px bg-caos-border shrink-0" />
          <button
            onClick={() => setShowQuarters(!showQuarters)}
            className={
              "tabular text-caos-xs px-1.5 h-6 rounded border transition-caos focus-ring whitespace-nowrap " +
              (showQuarters ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
            }
          >
            QUARTERS
          </button>
          <button
            onClick={() => setShowAssumptions(!showAssumptions)}
            title="Toggle the Assumptions panel — sliders to nudge the agent's base/downside forecast drivers"
            className={
              "tabular text-caos-xs px-1.5 h-6 rounded border transition-caos focus-ring whitespace-nowrap " +
              (showAssumptions ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
            }
          >
            ASSUMPTIONS
          </button>
          <button
            onClick={() => setShowScenarios(!showScenarios)}
            title="Toggle the forward Scenario & Sensitivity panel (best/base/worst + tornado)"
            className={
              "tabular text-caos-xs px-1.5 h-6 rounded border transition-caos focus-ring whitespace-nowrap " +
              (showScenarios ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
            }
          >
            SCENARIOS
          </button>
          {ovCount ? (
            <button
              onClick={() => {
                if (armReset) {
                  if (armTimer.current) window.clearTimeout(armTimer.current);
                  setArmReset(false);
                  resetAll();
                } else {
                  setArmReset(true);
                  if (armTimer.current) window.clearTimeout(armTimer.current);
                  armTimer.current = window.setTimeout(() => setArmReset(false), 3000);
                }
              }}
              title={armReset ? "Click again to confirm — clears every manual override" : "Clear all manual overrides"}
              aria-pressed={armReset}
              className="flex items-center gap-1.5 tabular text-caos-xs px-2 py-1 rounded border transition-caos whitespace-nowrap hover:bg-caos-elevated focus-ring"
              style={
                armReset
                  ? { color: "var(--caos-critical)", borderColor: "color-mix(in srgb, var(--caos-critical) 60%, transparent)", background: "color-mix(in srgb, var(--caos-critical) 10%, transparent)" }
                  : { color: "var(--caos-warning)", borderColor: "color-mix(in srgb, var(--caos-warning) 50%, transparent)" }
              }
            >
              {armReset
                ? <>▲ CONFIRM RESET?</>
                : <>↶ {ovCount} OVERRIDE{ovCount > 1 ? "S" : ""} · RESET</>}
            </button>
          ) : null}
          <span
            className="tabular text-caos-xs uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap hidden xl:inline"
            style={{ color: "var(--caos-warning)", borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)", background: "color-mix(in srgb, var(--caos-warning) 8%, transparent)" }}
          >
            forecast cells unaudited — CP-5 scope is actuals only
          </span>
        </>
      }
      narrowContract={narrowContract}
    >
      {/* workspace */}
      <div className="flex-1 min-h-0 flex flex-col gap-2 p-2">
        {hasIssuerModel ? (
          <>
            <Manifest hl={hl} setHl={setHl} isReference={isReference} />
            <FormulaBar
              model={model}
              sel={sel}
              severity={severity}
              overrides={overrides}
              onResetCell={resetCell}
              onOpenEvidence={setEvModal}
              showQ={showQuarters}
              collapsedRows={collapsedRows}
              isReference={isReference}
            />
            {editError ? (
              <div
                role="alert"
                className="tabular text-caos-2xs px-2 py-1 rounded border whitespace-nowrap self-start"
                style={{ color: "var(--caos-critical)", borderColor: "color-mix(in srgb, var(--caos-critical) 50%, transparent)", background: "color-mix(in srgb, var(--caos-critical) 8%, transparent)" }}
              >
                ✗ &ldquo;{editError}&rdquo; is not a valid number — override discarded
              </div>
            ) : null}
            {pasteNotice ? (
              <div
                role="status"
                className="tabular text-caos-2xs px-2 py-1 rounded border whitespace-nowrap self-start"
                style={{ color: "var(--caos-accent)", borderColor: "color-mix(in srgb, var(--caos-accent) 40%, transparent)", background: "color-mix(in srgb, var(--caos-accent) 8%, transparent)" }}
              >
                {pasteNotice}
              </div>
            ) : null}
            <div className="flex-1 min-h-0 flex gap-2">
              {showAssumptions ? (
                <AssumptionsPanel
                  assumptions={assumptions}
                  onChange={setAsmp}
                  onChangeYear={setAsmpYear}
                  onResetCase={resetCase}
                  onResetYearCell={clearYearDriver}
                  onScrub={scrubHighlight}
                  onScrubEnd={() => setHlCells(null)}
                  onCollapse={() => setShowAssumptions(false)}
                />
              ) : (
                <CollapsedRail side="left" label="Assumptions" onExpand={() => setShowAssumptions(true)} />
              )}
              <div className="flex-1 min-w-0 min-h-0 flex">
                <Sheet
                  model={model}
                  showQ={showQuarters}
                  isReference={isReference}
                  hl={hl}
                  hlCells={hlCells}
                  sel={sel}
                  onSel={setSel}
                  editing={editing}
                  onEdit={setEditing}
                  onCommit={commitEdit}
                  onPasteCells={onPasteCells}
                  collapsedRows={collapsedRows}
                  onToggleRow={(row) => setCollapsedRows((cur) => {
                    const next = new Set(cur);
                    if (next.has(row)) next.delete(row); else next.add(row);
                    return next;
                  })}
                />
              </div>
              {showScenarios ? (
                <ScenarioPanel model={model} downside={eng.downside} issuerId={issuerId} runId={eng.runId} onCollapse={() => setShowScenarios(false)} />
              ) : (
                <CollapsedRail side="right" label="Scenario & Sensitivity" onExpand={() => setShowScenarios(true)} />
              )}
            </div>
          </>
        ) : engineLoading ? (
          <div
            className="flex-1 min-h-0 rounded border border-caos-border bg-caos-panel flex flex-col items-center justify-center gap-2 text-center px-6"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 tabular text-caos-md text-caos-muted">
              <span
                className="w-1.5 h-1.5 rounded-sm animate-pulse motion-reduce:animate-none"
                style={{ background: "var(--caos-accent)" }}
              />
              Linking engine…
            </div>
            <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
              Loading {issuerName} CP-1 anchor
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 rounded border border-caos-border bg-caos-panel flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="tabular text-caos-xl text-caos-text">No issuer-specific model output</div>
            <div className="text-caos-md text-caos-muted max-w-[520px] leading-relaxed">
              Model Builder needs a completed run with a usable CP-1 anchor. Run the
              issuer first; the seeded Atlas Forge grid is available only in the reference demo.
            </div>
            <a
              href={`/deepdive?issuer=${encodeURIComponent(issuerId)}`}
              className="tabular text-caos-xs px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos whitespace-nowrap"
            >
              Open {issuerName} in Deep-Dive →
            </a>
          </div>
        )}
      </div>

      {/* isLiveRun: a live issuer's E-xx id must hit the explicit unresolved
          panel, never shadow-resolve to the seeded ATLF excerpt as "VERIFIED". */}
      {evModal ? <EvidenceModal id={evModal} reports={reports} isLiveRun={!isReference} onClose={() => setEvModal(null)} /> : null}
    </ResponsiveShell>
  );
}

// Thin expandable rail shown in place of a collapsed side panel: a vertical
// label + chevron that restores the full panel. Keeps the workspace bounds
// stable so the sheet doesn't reflow jarringly on collapse.
function CollapsedRail({ side, label, onExpand }: { side: "left" | "right"; label: string; onExpand: () => void }) {
  return (
    <div className="w-7 shrink-0 bg-caos-panel border border-caos-border rounded-md flex flex-col items-center gap-2 py-2 text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos font-bold">
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
function ModelProvenance({ eng, model, allowSeededFallback }: { eng: ModelEngineState; model: Model; allowSeededFallback: boolean }) {
  if (eng.loading) {
    return <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">· linking engine…</span>;
  }
  if (!eng.live || !eng.anchor) {
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
  // CP-1's separately-reported adj. net leverage (net_leverage_adj_ltm).
  const cp1 = eng.anchor.netLeverage;
  // What the grid actually DISPLAYS for the anchored LTM column: net debt / adj
  // EBITDA recomputed from the live anchor (see applyAnchor + deriveCreditKpis).
  // This — not the pre-anchor seeded value — is the number the analyst reads, so
  // it is the number the tie-out must reconcile. (null if a denominator degraded.)
  const shown = model.cols.l1.netlev;
  // Only claim a tie when the DISPLAYED leverage equals CP-1's reported figure
  // within tolerance. CP-1 may report on a different net-debt/EBITDA basis, so a
  // recomputed netDebt/adjEbitda can legitimately differ — never fabricate "ties".
  const drift = shown != null ? Math.abs(shown - cp1) : null;
  const ties = drift != null && drift <= 0.05;
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span
        className="flex items-center gap-1.5"
        title={`Anchored to live CP-1 from run ${eng.runId} · committee: ${eng.committeeStatus ?? "—"}`}
      >
        <ProvenanceChip prov={fromModelEngine(eng)} />
        <span className="tabular text-caos-xs" style={{ color: "var(--caos-success)" }}>
          CP-1 · RUN {eng.runId?.slice(0, 8) ?? "—"}
        </span>
      </span>
      <span
        className="flex items-center gap-1 tabular text-caos-xs px-1.5 py-px rounded border"
        style={
          ties
            ? { color: "var(--caos-success)", borderColor: "color-mix(in srgb, var(--caos-success) 40%, transparent)", background: "color-mix(in srgb, var(--caos-success) 8%, transparent)" }
            : { color: "var(--caos-warning)", borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)", background: "color-mix(in srgb, var(--caos-warning) 8%, transparent)" }
        }
        title={
          shown == null
            ? `Grid LTM net leverage is undefined (degenerate denominator); CP-1 reports ${cp1.toFixed(2)}x.`
            : ties
            ? `Grid LTM net leverage (${shown.toFixed(2)}x = net debt / adj. EBITDA) ties CP-1 reported (${cp1.toFixed(2)}x).`
            : `Grid shows ${shown.toFixed(2)}x (net debt / adj. EBITDA) but CP-1 reports ${cp1.toFixed(2)}x — likely a different net-debt / EBITDA basis. Shown side by side, not reconciled.`
        }
      >
        {ties
          ? <>✓ net lev ties CP-1 {cp1.toFixed(2)}x</>
          : shown == null
          ? <><StatusGlyph kind="warning" /> CP-1 {cp1.toFixed(2)}x · grid n/a</>
          : <><StatusGlyph kind="warning" /> grid {shown.toFixed(2)}x vs CP-1 {cp1.toFixed(2)}x</>}
      </span>
    </span>
  );
}
