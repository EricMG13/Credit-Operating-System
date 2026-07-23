"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ActionReason } from "@/components/shared/ActionReason";
import { AnalysisStateBadge, AuthorityLine, FindingsTray } from "@/components/shared/AnalysisWorkbench";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { EnterprisePage, type PageAction } from "@/components/shared/EnterprisePage";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { SemanticVisualization, type VisualizationSpec } from "@/components/charts/SemanticVisualization";
import { MarketWorkbookImport } from "@/components/rv/MarketWorkbookImport";
import { SlideOver } from "@/components/shared/SlideOver";
import { useRoleView } from "@/components/shared/RoleViewProvider";
import { headStat } from "@/components/shared/headStat";
import { toErrorMessage } from "@/lib/api";
import { fmtUtcDateTime } from "@/lib/format-date";
import { classificationLabel, recommendationLine } from "@/lib/labels";
import {
  analysisApi,
  contextHref,
  useAnalysisContext,
  type AuthorityEnvelope,
  type RVCandidate,
  type RVScreenRun,
} from "@/lib/analysis-workbench";
import type { DecisionAuthority, DecisionContextState, DecisionDatumState } from "@/lib/decision-state";
import { authorityProvenance } from "@/lib/authority-decision";
import { useTypedUrlState, type TypedUrlUpdate } from "@/lib/typed-url-state";

type View = "table" | "distribution" | "compare";
const RV_URL_KEYS = ["view", "selected"] as const;
const ROW_HEIGHT = 46;
const WINDOW_ROWS = 22;

function resolveRVView(value: string | null): View {
  if (value === "distribution" || value === "spread-distribution") return "distribution";
  if (value === "compare" || value === "compare-selected") return "compare";
  return "table";
}

const RV_VIEW_LABELS: Record<View, string> = {
  table: "Ranked names",
  distribution: "Spread distribution",
  compare: "Compare selected",
};

function display(value: unknown, suffix = "") {
  if (typeof value === "number" && Number.isFinite(value)) return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${suffix}`;
  if (typeof value === "string" && value) return value;
  return "—";
}

function decisionAuthority(authority: AuthorityEnvelope): DecisionAuthority {
  return {
    provenance: authorityProvenance(authority),
    approval: authority.approval_state === "ratified" ? "RATIFIED" : "DRAFT",
  };
}

function rvDatum(screen: RVScreenRun | null, value: React.ReactNode): DecisionDatumState {
  if (!screen) return { kind: "unavailable", message: "Run the gated screen to establish this observation." };
  if (screen.status === "error") return { kind: "error", message: "RV screen failed." };
  if (screen.status === "stale") return { kind: "stale", value, asOf: fmtUtcDateTime(screen.authority.as_of ?? screen.updated_at), authority: decisionAuthority(screen.authority) };
  if (screen.status === "observed-empty") return { kind: "observed-empty", message: "Successful screen returned no instruments.", asOf: fmtUtcDateTime(screen.authority.as_of ?? screen.updated_at), authority: decisionAuthority(screen.authority) };
  return { kind: "ready", value, asOf: fmtUtcDateTime(screen.authority.as_of ?? screen.updated_at), authority: decisionAuthority(screen.authority) };
}

// Format a provenance value for display — never leak raw JSON into the pitch.
// Known shapes get desk formatting; unknown objects flatten to one level of k: v.
function formatPitchValue(item: unknown): string {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const o = item as Record<string, unknown>;
    if ("bid" in o && "ask" in o) return `${display(o.bid)} / ${display(o.ask)}`;
    if ("low" in o && "high" in o) return `${display(o.low)}–${display(o.high)}`;
    return Object.entries(o).map(([k, v]) => `${k.replaceAll("_", " ")}: ${display(v)}`).join(" · ");
  }
  if (Array.isArray(item)) return item.map((v) => display(v)).join(" · ");
  return display(item);
}

function PitchBlock({ title, value }: { title: string; value: unknown }) {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return (
    <section className="rounded-md border border-caos-border bg-caos-bg/30 p-3">
      <h3 className="tabular text-caos-2xs font-semibold uppercase tracking-widest text-caos-muted">{title}</h3>
      <dl className="mt-2 space-y-1">{Object.entries(data).map(([key, item]) => <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-caos-xs"><dt className="text-caos-muted">{key.replaceAll("_", " ")}</dt><dd className="tabular text-right text-caos-text">{formatPitchValue(item)}</dd></div>)}</dl>
    </section>
  );
}

function VirtualCandidateGrid({
  candidates,
  selectedId,
  compareIds,
  onSelect,
  onCompare,
}: {
  candidates: RVCandidate[];
  selectedId: string | null;
  compareIds: Set<string>;
  onSelect: (candidate: RVCandidate) => void;
  onCompare: (candidate: RVCandidate) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingFocusId = useRef<string | null>(null);
  const [start, setStart] = useState(0);
  const end = Math.min(candidates.length, start + WINDOW_ROWS);
  const visible = candidates.slice(start, end);
  const activeId = selectedId ?? candidates[0]?.id ?? null;

  useEffect(() => {
    if (pendingFocusId.current && pendingFocusId.current === selectedId) {
      const el = rowRefs.current.get(selectedId);
      if (el) {
        el.focus();
        pendingFocusId.current = null;
      }
    }
  }, [selectedId, start]);

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden rounded-md border border-caos-border bg-caos-panel">
    <div className="h-full min-h-0 min-w-[700px] flex flex-col" role="grid" aria-label="Ranked RV candidates" aria-rowcount={candidates.length + 1}>
      <div role="row" className="grid h-9 grid-cols-[40px_minmax(170px,1.5fr)_100px_90px_90px_100px_110px] items-center border-b border-caos-border bg-caos-panel px-2 tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
        <span role="columnheader">#</span><span role="columnheader">Instrument</span><span role="columnheader">Class</span><span role="columnheader">Discount margin (bp)</span><span role="columnheader">Pickup (bp)</span><span role="columnheader">Bid / Ask</span><span role="columnheader">Compare</span>
      </div>
      <div ref={viewport} role="rowgroup" className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto" onScroll={(event) => setStart(Math.max(0, Math.floor(event.currentTarget.scrollTop / ROW_HEIGHT) - 4))}>
        <div role="presentation" style={{ height: candidates.length * ROW_HEIGHT, position: "relative" }}>
          {visible.map((candidate, offset) => {
            const index = start + offset;
            const pickup = (candidate.pitch.market_relative_value as Record<string, unknown> | undefined)?.dm_pickup_bps;
            return (
              <div
                key={candidate.id}
                role="row"
                aria-rowindex={index + 2}
                aria-selected={candidate.id === activeId}
                ref={(el) => { if (el) rowRefs.current.set(candidate.id, el); else rowRefs.current.delete(candidate.id); }}
                tabIndex={candidate.id === activeId ? 0 : -1}
                style={{ position: "absolute", top: index * ROW_HEIGHT, height: ROW_HEIGHT, left: 0, right: 0 }}
                className={`grid grid-cols-[40px_minmax(170px,1.5fr)_100px_90px_90px_100px_110px] items-center border-b border-caos-border/70 px-2 tabular text-caos-xs focus-ring ${selectedId === candidate.id ? "bg-caos-info-surface" : "hover:bg-caos-elevated/30"}`}
                onClick={() => onSelect(candidate)}
                onKeyDown={(event) => {
                  if (event.currentTarget !== event.target) return;
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    const next = Math.max(0, Math.min(candidates.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
                    pendingFocusId.current = candidates[next].id;
                    viewport.current?.scrollTo({ top: next * ROW_HEIGHT });
                    onSelect(candidates[next]);
                  } else if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(candidate);
                  }
                }}
              >
                <span role="gridcell" className="text-caos-accent">{candidate.rank}</span>
                <span role="gridcell" className="min-w-0"><span className="block truncate font-semibold text-caos-text">{candidate.borrower}</span><span className="block truncate text-caos-2xs text-caos-muted">{display(candidate.market.ranking)} · {candidate.figi ?? "identity unavailable"}</span></span>
                <span role="gridcell" className={candidate.classification === "actionable" ? "text-caos-success" : candidate.classification === "unavailable" ? "text-caos-critical" : "text-caos-warning"}>{classificationLabel(candidate.classification)}</span>
                <span role="gridcell" className="text-caos-text">{display(candidate.market.dm)}</span>
                <span role="gridcell" className="text-caos-text">{display(pickup)}</span>
                <span role="gridcell" className="text-caos-muted">{display(candidate.market.bid)} / {display(candidate.market.ask)}</span>
                <span role="gridcell">{(() => {
                  const atCap = !compareIds.has(candidate.id) && compareIds.size >= 5;
                  return <button type="button" aria-pressed={compareIds.has(candidate.id)} aria-disabled={atCap || undefined} title={atCap ? "Compare holds at most 5 candidates — remove one first" : undefined} onClick={(event) => { event.stopPropagation(); if (!atCap) onCompare(candidate); }} onKeyDown={(event) => event.stopPropagation()} className="caos-action-secondary focus-ring">{compareIds.has(candidate.id) ? "Remove" : "Compare"}</button>;
                })()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </div>
  );
}

type Setter<T> = Dispatch<SetStateAction<T>>;
type RVContextState = ReturnType<typeof useAnalysisContext>;
type RVUrlUpdate = (changes: TypedUrlUpdate<(typeof RV_URL_KEYS)[number]>, mode?: "push" | "replace") => void;

interface RVActionState {
  busy: boolean;
  contextState: RVContextState;
  screen: RVScreenRun | null;
  selected: RVCandidate | null;
  setBusy: Setter<boolean>;
  setError: Setter<string | null>;
  setFindingsKey: Setter<number>;
  setScreen: Setter<RVScreenRun | null>;
  setSelected: Setter<RVCandidate | null>;
  updateUrlState: RVUrlUpdate;
}

async function runRVScreen(state: RVActionState, snapshotId?: string) {
  const context = state.contextState.context;
  if (!context || state.busy) return;
  state.setBusy(true);
  state.setError(null);
  try {
    const filters = context.sector_id ? { sector_id: context.sector_id } : {};
    const next = await analysisApi.createRVScreen({ context_id: context.id, snapshot_id: snapshotId, filters });
    const first = next.candidates[0] ?? null;
    state.setScreen(next);
    state.setSelected(first);
    state.updateUrlState({ selected: first?.id ?? null }, "replace");
    state.contextState.setContext({ ...context, rv_run_id: next.id, rv_snapshot_id: next.snapshot_id });
  } catch (reason) {
    state.setError(toErrorMessage(reason, "RV screen failed."));
  } finally {
    state.setBusy(false);
  }
}

async function pinRVPitch(state: RVActionState, kind: "rv-pitch" | "monitor-threshold") {
  const context = state.contextState.context;
  if (!context || !state.screen || !state.selected) return;
  state.setBusy(true);
  try {
    const candidate = state.selected;
    await analysisApi.createFinding({
      context_id: context.id, kind,
      title: `${candidate.borrower} · ${classificationLabel(candidate.classification)}`,
      body: candidate.missing_gates.length ? `Decision gates missing: ${candidate.missing_gates.join(", ")}.` : "All RV decision gates satisfied.",
      source_surface: "rv-screener", source_run_id: state.screen.id, evidence: candidate.evidence,
    });
    state.setFindingsKey((value) => value + 1);
  } catch (reason) {
    state.setError(toErrorMessage(reason, "Finding could not be pinned."));
  } finally {
    state.setBusy(false);
  }
}

async function ratifyRVCandidate(state: RVActionState) {
  const candidate = state.selected;
  if (!state.screen || !candidate || candidate.classification !== "actionable") return;
  state.setBusy(true);
  try {
    const next = await analysisApi.ratifyRVCandidate(state.screen.id, candidate.id);
    state.setScreen(next);
    state.setSelected(next.candidates.find((value) => value.id === candidate.id) ?? candidate);
  } catch (reason) {
    state.setError(toErrorMessage(reason, "Candidate ratification failed."));
  } finally {
    state.setBusy(false);
  }
}

function preferredRVCandidate(screen: RVScreenRun) {
  return screen.candidates.find((candidate) => candidate.classification === "actionable")
    ?? screen.candidates.find((candidate) => candidate.classification === "screen-only")
    ?? screen.candidates[0];
}

function toggleCandidateComparison(current: Set<string>, candidateId: string) {
  const next = new Set(current);
  if (next.has(candidateId)) next.delete(candidateId);
  else if (next.size < 5) next.add(candidateId);
  return next;
}

function useRVScreenerController() {
  const { roleView } = useRoleView();
  const contextState = useAnalysisContext({ name: "Telecom RV screen", sector_id: "telecom" });
  const { values: urlState, update: updateUrlState } = useTypedUrlState(RV_URL_KEYS);
  const [screen, setScreen] = useState<RVScreenRun | null>(null);
  const [selected, setSelected] = useState<RVCandidate | null>(null);
  const view = resolveRVView(urlState.view);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [findingsKey, setFindingsKey] = useState(0);

  useEffect(() => {
    if (!contextState.context?.rv_run_id) return;
    analysisApi.getRVScreen(contextState.context.rv_run_id).then((value) => {
      setScreen(value); setSelected(value.candidates.find((candidate) => candidate.id === urlState.selected) ?? value.candidates[0] ?? null);
    }).catch(() => setScreen(null));
  }, [contextState.context, urlState.selected]);

  const actionState: RVActionState = { busy, contextState, screen, selected, setBusy, setError, setFindingsKey, setScreen, setSelected, updateUrlState };
  const runScreen = (snapshotId?: string) => runRVScreen(actionState, snapshotId);

  const reviewTop = () => {
    if (!screen) { void runScreen(); return; }
    const top = preferredRVCandidate(screen);
    if (top) { setSelected(top); updateUrlState({ selected: top.id, view: null }, "replace"); }
  };

  const toggleCompare = (candidate: RVCandidate) => setCompareIds((current) => toggleCandidateComparison(current, candidate.id));
  const pinPitch = (kind: "rv-pitch" | "monitor-threshold") => pinRVPitch(actionState, kind);
  const ratifyCandidate = () => ratifyRVCandidate(actionState);

  return {
    actionState, busy, compareIds, contextState, error, findingsKey, importOpen, pinPitch, ratifyCandidate,
    reviewTop, roleView, runScreen, screen, selected, setImportOpen, setSelected, toggleCompare,
    updateUrlState, view,
  };
}

type RVController = ReturnType<typeof useRVScreenerController>;

const ANALYST_PITCH_ORDER = [["1 · Market relative value", "market_relative_value"], ["2 · Instrument mispricing", "instrument_mispricing"], ["3 · Portfolio implementation", "portfolio_implementation"]] as const;
const PM_PITCH_ORDER = [["3 · Portfolio implementation", "portfolio_implementation"], ["1 · Market relative value", "market_relative_value"], ["2 · Instrument mispricing", "instrument_mispricing"]] as const;

function rvDecisionContext(screen: RVScreenRun | null, selected: RVCandidate | null): DecisionContextState {
  const pickup = selected ? (selected.pitch.market_relative_value as Record<string, unknown> | undefined)?.dm_pickup_bps : null;
  return {
    whatChanged: rvDatum(screen, selected ? `${selected.borrower} · ${display(pickup, "bp")} vs cohort` : "No candidate selected"),
    whyItMatters: rvDatum(screen, selected ? `${classificationLabel(selected.classification)} · ${selected.missing_gates.length} missing gates` : "No instrument evidence"),
    requiredAction: rvDatum(screen, selected?.classification === "actionable" ? "Review sizing and ratify" : "Resolve missing gates before any recommendation"),
    evidenceHealth: rvDatum(screen, screen ? `${screen.snapshot_source_label ?? screen.authority.origin} · ${String(screen.snapshot_freshness?.state ?? screen.authority.freshness)}` : "Snapshot unavailable"),
  };
}

function rvDistributionSpec(screen: RVScreenRun | null): VisualizationSpec {
  const data = screen ? ["actionable", "screen-only", "unavailable"].map((key) => ({ key, count: screen.counts[key] ?? 0 })) : [];
  return {
    kind: "bar", title: "RV candidate classification", unit: "instruments",
    asOf: screen?.authority.as_of ? fmtUtcDateTime(screen.authority.as_of) : undefined,
    sourceIds: screen?.authority.source_ids ?? ["rv-screen"],
    accessibleSummary: screen ? `${screen.candidates.length} instruments: ${data.map((item) => `${item.key} ${item.count}`).join(", ")}.` : "Run the screen to populate candidate classification.",
    status: (screen?.counts.actionable ?? 0) > 0 ? { label: "Actionable present", tone: "success" } : { label: "No actionable candidate", tone: "warning" },
    data,
    tabularFallback: { label: "RV classification counts", columns: [{ key: "key", label: "Classification" }, { key: "count", label: "Instruments" }], data },
    chart: { type: "interval", encode: { x: "key", y: "count" }, axis: { x: { labelAutoHide: false, labelAutoRotate: false } } },
  };
}

function rvPrimaryReason(controller: RVController) {
  if (controller.contextState.loading) return "Preparing analysis workspace…";
  if (controller.contextState.error) return "Analysis workspace unavailable — reload to retry";
  if (controller.busy) return "Screen in progress";
  if (controller.screen && !controller.screen.candidates.length) return "No candidates returned — adjust the screen filters";
  return null;
}

function rvPrimaryLabel(controller: RVController) {
  if (!controller.screen) return "Run screen";
  return (controller.screen.counts.actionable ?? 0) > 0 ? "Review top candidate" : "Review top screen-only name";
}

function RVPrimaryAction({ controller }: { controller: RVController }): PageAction {
  return { label: rvPrimaryLabel(controller), onAction: controller.reviewTop, unavailableReason: rvPrimaryReason(controller) };
}

function RVContextualControls({ controller }: { controller: RVController }) {
  const actionable = controller.screen?.counts.actionable ?? 0;
  const screenOnly = controller.screen?.counts["screen-only"] ?? 0;
  return <>{headStat("Universe", controller.contextState.context?.sector_id ?? "All")}{headStat("Actionable", String(actionable), actionable > 0 ? "var(--caos-success)" : undefined)}{headStat(classificationLabel("screen-only"), String(screenOnly), screenOnly > 0 ? "var(--caos-warning)" : undefined)}<button type="button" onClick={() => controller.setImportOpen(true)} className="caos-action-secondary focus-ring">Import pricing</button></>;
}

function RVUtilities({ controller }: { controller: RVController }) {
  const context = controller.contextState.context;
  return (
    <div className="space-y-4 text-caos-xs">
      <section><h3 className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Cohort construction</h3><p className="mt-2 leading-relaxed text-caos-text">Sector × rating cohort. Minimum n=4. Exact instruments remain separate even when the same issuer has multiple tranches.</p></section>
      <section><h3 className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Decision methodology</h3><ol className="mt-2 list-decimal space-y-1 pl-4 text-caos-muted"><li>Spread / YTW / discount margin pickup (bp)</li><li>Instrument, collateral and recovery</li><li>Portfolio yield and risk budget</li></ol></section>
      <ActionReason reason={!controller.screen ? "Run the screen first — a saved screen references its snapshot" : null} onClick={() => void controller.contextState.patch({ filters: { ...(context?.filters ?? {}), rv: controller.screen?.filters ?? {} } })} className="caos-action-secondary focus-ring">Save current screen</ActionReason>
    </div>
  );
}

function RVViewTabs({ controller }: { controller: RVController }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1" role="tablist" aria-label="RV views">
      {(["table", "distribution", "compare"] as const).map((value) => {
        const gated = value === "compare" && controller.compareIds.size < 2;
        const urlValue = value === "table" ? "ranked-names" : value === "distribution" ? "spread-distribution" : "compare-selected";
        return <button key={value} type="button" role="tab" aria-selected={controller.view === value} aria-disabled={gated || undefined} title={gated ? "Mark at least 2 candidates with each row's Compare action" : undefined} onClick={() => { if (!gated) controller.updateUrlState({ view: urlValue }); }} className={`caos-action-secondary focus-ring ${controller.view === value ? "border-caos-accent text-caos-text" : ""}`}>{RV_VIEW_LABELS[value]}{value === "compare" ? ` (${controller.compareIds.size})` : ""}</button>;
      })}
      {controller.screen ? <div className="ml-auto"><AuthorityLine authority={controller.screen.authority} /></div> : null}
    </div>
  );
}

function RVCompareView({ candidates }: { candidates: RVCandidate[] }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto"><div className="grid gap-3 xl:grid-cols-2">
      {candidates.map((candidate) => <article key={candidate.id} className="rounded-md border border-caos-border bg-caos-panel p-3"><div className="flex items-center gap-2"><h2 className="text-caos-sm font-semibold text-caos-text">{candidate.borrower}</h2><span className="ml-auto tabular text-caos-2xs uppercase tracking-wider text-caos-warning">{classificationLabel(candidate.classification)}</span></div><dl className="mt-3 grid grid-cols-2 gap-2 text-caos-xs"><div><dt className="text-caos-muted">Discount margin (bp)</dt><dd className="tabular text-caos-text">{display(candidate.market.dm)}</dd></div><div><dt className="text-caos-muted">Pickup (bp)</dt><dd className="tabular text-caos-text">{display((candidate.pitch.market_relative_value as Record<string, unknown>).dm_pickup_bps)}</dd></div><div><dt className="text-caos-muted">Ranking</dt><dd className="text-caos-text">{display(candidate.market.ranking)}</dd></div><div><dt className="text-caos-muted">Maturity</dt><dd className="text-caos-text">{display(candidate.market.maturity)}</dd></div></dl><p className="mt-3 text-caos-xs text-caos-warning">{candidate.missing_gates.join(" · ") || "All gates satisfied"}</p></article>)}
    </div></div>
  );
}

function RVWorkspaceState({ controller }: { controller: RVController }) {
  if (controller.screen) return null;
  const loading = controller.contextState.loading;
  return <SurfaceState kind={loading ? "loading" : "not-run"} headingLevel={2} title={loading ? "Preparing workspace" : "Immutable snapshot required"} detail={loading ? "Resolving the analysis context — the screen unlocks in a moment." : "Run the screen to normalize the reference pricing sheet. Reference observations can surface candidates but can never produce an actionable recommendation."} className="m-auto max-w-xl" />;
}

function RVCandidateWorkspace({ controller, distributionSpec }: { controller: RVController; distributionSpec: VisualizationSpec }) {
  const screen = controller.screen;
  const compared = screen?.candidates.filter((candidate) => controller.compareIds.has(candidate.id)) ?? [];
  return (
    <section className="min-h-0 h-full overflow-hidden flex flex-col p-3 border border-caos-border" aria-label="RV candidate workspace">
      <RVViewTabs controller={controller} />
      {controller.error ? <div className="mb-2 rounded-sm border border-caos-critical/50 bg-caos-critical/5 p-2 text-caos-xs text-caos-critical" role="alert">{controller.error}</div> : null}
      {controller.contextState.error ? <div className="mb-2 rounded-sm border border-caos-critical/50 bg-caos-critical/5 p-2 text-caos-xs text-caos-critical" role="alert">Analysis workspace unavailable — the screen cannot run without it. <button type="button" className="text-caos-accent focus-ring" onClick={() => window.location.reload()}>Reload to retry</button></div> : null}
      <RVWorkspaceState controller={controller} />
      {screen && controller.view === "table" ? <DominantTableRegion ownerId="rv-candidates" label="Ranked RV candidates" className="min-h-0 flex-1"><VirtualCandidateGrid candidates={screen.candidates} selectedId={controller.selected?.id ?? null} compareIds={controller.compareIds} onSelect={(candidate) => { controller.setSelected(candidate); controller.updateUrlState({ selected: candidate.id }, "replace"); }} onCompare={controller.toggleCompare} /></DominantTableRegion> : null}
      {screen && controller.view === "distribution" ? <div className="min-h-0 flex-1 overflow-auto"><SemanticVisualization spec={distributionSpec} headingLevel={2} /></div> : null}
      {screen && controller.view === "compare" ? <RVCompareView candidates={compared} /> : null}
    </section>
  );
}

function RVGateReview({ candidate, qa }: { candidate: RVCandidate; qa: boolean }) {
  if (!candidate.missing_gates.length) return null;
  return <section className="mt-4 rounded-md border border-caos-warning/50 bg-caos-warning/5 p-3"><h3 className="tabular text-caos-2xs font-semibold uppercase tracking-widest text-caos-warning">{qa ? "QA gate review" : "Decision gates missing"}</h3><ul className="mt-2 space-y-1 text-caos-xs text-caos-text">{candidate.missing_gates.map((gate) => <li key={gate}>△ {gate}</li>)}</ul></section>;
}

function RVInspectorActions({ candidate, controller }: { candidate: RVCandidate; controller: RVController }) {
  const context = controller.contextState.context;
  const actionable = candidate.classification === "actionable";
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={() => void controller.pinPitch("rv-pitch")} disabled={controller.busy} className="caos-action-secondary focus-ring">Pin pitch</button>
      {context ? <Link href={contextHref("/query", context.id, { instrument: candidate.instrument_id })} className="caos-action-secondary focus-ring no-underline">Investigate</Link> : null}
      <button type="button" onClick={() => void controller.ratifyCandidate()} disabled={!actionable || controller.busy} className="caos-action-secondary focus-ring disabled:opacity-40" title={actionable ? undefined : "Resolve every decision gate before ratification."}>{candidate.ratified_at ? "Ratified" : "Ratify candidate"}</button>
      <details className="relative">
        <summary className="caos-action-secondary flex cursor-pointer list-none items-center focus-ring">More</summary>
        <div className="absolute right-0 z-20 mt-1 grid min-w-48 gap-1 rounded border border-caos-border bg-caos-elevated p-1 shadow-xl">
          <button type="button" onClick={() => void controller.pinPitch("monitor-threshold")} disabled={controller.busy} className="caos-action-secondary focus-ring">Pin threshold finding</button>
          {context ? <Link href={contextHref("/sector", context.id)} className="caos-action-secondary focus-ring no-underline">Sector view</Link> : null}
        </div>
      </details>
    </div>
  );
}

function RVCandidateInspector({ controller }: { controller: RVController }) {
  const candidate = controller.selected;
  if (!candidate) return <p className="mt-3 text-caos-xs text-caos-muted">Select one exact instrument to inspect its three-part pitch, evidence and portfolio effect.</p>;
  const qa = controller.roleView === "qa";
  const pitchOrder = controller.roleView === "pm" ? PM_PITCH_ORDER : ANALYST_PITCH_ORDER;
  return <><div className="mt-3"><h3 className="text-base font-semibold text-caos-text">{candidate.borrower}</h3><p className="mt-1 tabular text-caos-xs text-caos-muted">{candidate.figi ?? "No exact identity"} · {display(candidate.market.ranking)} · {display(candidate.market.maturity)}</p><p className={`mt-2 tabular text-caos-xs uppercase ${candidate.classification === "actionable" ? "text-caos-success" : "text-caos-warning"}`}>{recommendationLine(candidate.recommendation, candidate.classification)}</p></div>{qa ? <RVGateReview candidate={candidate} qa /> : null}<div className="mt-4 space-y-2">{pitchOrder.map(([title, key]) => <PitchBlock key={key} title={title} value={candidate.pitch[key]} />)}</div>{qa ? null : <RVGateReview candidate={candidate} qa={false} />}<RVInspectorActions candidate={candidate} controller={controller} /></>;
}

function RVInspector({ controller }: { controller: RVController }) {
  const candidate = controller.selected;
  const state = candidate?.classification === "actionable" ? "ready" : candidate?.classification === "unavailable" ? "error" : "partial";
  const context = controller.contextState.context;
  return <aside className="min-h-0 overflow-auto border border-caos-border bg-caos-panel/50 p-3" aria-label="RV evidence inspector"><div className="flex items-center gap-2"><h2 className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-text">Instrument inspector</h2>{candidate ? <AnalysisStateBadge state={state} /> : null}</div><RVCandidateInspector controller={controller} />{context ? <div className="mt-4"><FindingsTray contextId={context.id} refreshKey={controller.findingsKey} /></div> : null}</aside>;
}

function RVImporter({ controller }: { controller: RVController }) {
  if (!controller.importOpen) return null;
  return <SlideOver title="Import immutable pricing snapshot" onClose={() => controller.setImportOpen(false)}><MarketWorkbookImport onCommitted={(value) => { controller.setImportOpen(false); void controller.runScreen(value.snapshot_id); }} /></SlideOver>;
}

function RVScreenerPage({ controller }: { controller: RVController }) {
  const screen = controller.screen;
  const distributionSpec = rvDistributionSpec(screen);

  return (
    <EnterprisePage
      kind="analytical"
      identity={<><ConceptNav compact /><span className="h-4 w-px bg-caos-border" /><span className="text-caos-sm font-semibold text-caos-text shrink-0">RV Screener</span>{screen ? <span className="tabular text-caos-2xs text-caos-muted min-w-0 truncate" title={`${screen.snapshot_source_label ?? "Snapshot"} · ${screen.snapshot_id}`}>{screen.snapshot_source_label ?? "Snapshot"} · {screen.snapshot_id.slice(0, 8)}</span> : null}</>}
      status={<span className="tabular text-caos-2xs uppercase tracking-wider text-caos-accent">Shared governed workspace</span>}
      primaryAction={RVPrimaryAction({ controller })}
      contextualControls={<RVContextualControls controller={controller} />}
      utilityLabel="RV utilities"
      utilityControls={<RVUtilities controller={controller} />}
      narrowContract={{ essentialControls: <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{screen?.candidates.length ?? 0} instruments</span> }}
    >
      <section aria-label="Relative value screening workspace" className="caos-persona-route rv-workbench min-h-0 flex-1 overflow-hidden p-2">
        {screen ? <PersonaWorkbench
          surface="rv-screener"
          decision={<DecisionHeader state={rvDecisionContext(screen, controller.selected)} defaultOpen />}
          primary={<RVCandidateWorkspace controller={controller} distributionSpec={distributionSpec} />}
          context={controller.view === "distribution" ? null : <SemanticVisualization spec={distributionSpec} headingLevel={2} />}
          inspector={<RVInspector controller={controller} />}
        /> : <PersonaWorkbench
          surface="rv-screener"
          primary={<section className="flex min-h-56 flex-col items-center justify-center gap-2 border border-caos-border bg-caos-panel/50 p-4" aria-label="RV screen setup">
            {controller.error ? <div className="w-full max-w-xl rounded-sm border border-caos-critical/50 bg-caos-critical/5 p-2 text-caos-xs text-caos-critical" role="alert">{controller.error}</div> : null}
            {controller.contextState.error ? <div className="w-full max-w-xl rounded-sm border border-caos-critical/50 bg-caos-critical/5 p-2 text-caos-xs text-caos-critical" role="alert">Analysis workspace unavailable — the screen cannot run without it. <button type="button" className="text-caos-accent focus-ring" onClick={() => window.location.reload()}>Reload to retry</button></div> : null}
            <RVWorkspaceState controller={controller} />
          </section>}
        />}
        <RVImporter controller={controller} />
      </section>
    </EnterprisePage>
  );
}

export function RVScreenerWorkbench() {
  return <RVScreenerPage controller={useRVScreenerController()} />;
}
