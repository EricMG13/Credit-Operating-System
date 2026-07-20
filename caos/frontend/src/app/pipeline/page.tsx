"use client";

// Concept B — The Pipeline Visualizer: the CP-X route graph as a live DAG.
// Run-mode templates (COMMITTEE / EARNINGS / LEGAL / RV), upstream/downstream
// lineage tracing, module inspector, CP-5B driver lineage with E-xx evidence,
// QA gating on CP-5, and the orchestrator event log.

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { SurfaceState, type SurfaceStateKind } from "@/components/shared/SurfaceState";
import { CompletionStateSummary, type CompletionExecution, type CompletionFreshness, type CompletionNotApplicable } from "@/components/shared/CompletionStateSummary";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { listRuns } from "@/lib/api";
import type { Driver, RunMode, PlanStep } from "@/lib/pipeline/data";
import type { SimRun } from "@/lib/pipeline/sim";
import { MODULES } from "@/lib/pipeline/topology";
import { useLivePipelineStatus } from "@/lib/pipeline/useLivePipeline";
import { useLiveRun } from "@/lib/engine/useLiveRun";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";
import { Bar, Dot, SimControls, Tag, ToggleGroup } from "@/components/pipeline/atoms";
import { EventLog, GraphView, Inspector, LineagePanel, LiveLineagePanel, SwimlaneView, type PipelineReferenceFixtures } from "@/components/pipeline/views";
import { deriveClearance } from "@/lib/pipeline/clearance";
import { Panel as PanelShell } from "@/components/shared/Panel";
import type { Sim } from "@/lib/pipeline/sim-engine";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { WorkbenchToolbar } from "@/components/shared/WorkbenchToolbar";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { contextHref, useAnalysisContext } from "@/lib/analysis-workbench";
import type { RunListItemDTO } from "@/lib/engine/types";
import { FreshnessIndicator } from "@/components/shared/FreshnessIndicator";
import { AnalysisContextSaveState } from "@/components/shared/AnalysisContextSaveState";
import { useIssuerFreshness } from "@/lib/engine/useFreshness";
import { resolvePipelineFreshnessRunId } from "@/lib/freshness";
import type { ModuleOutput } from "@/lib/deepdive/module-outputs";
import { preserveDataModeInHref, useDataMode, withDataMode, type DataMode } from "@/lib/data-mode";
import type { ReferencePipelineRuntimeProps, ReferencePipelineRuntimeValue } from "./ReferencePipelineRuntime";

const ReferencePipelineRuntime = dynamic<ReferencePipelineRuntimeProps>(
  () => import("./ReferencePipelineRuntime").then((module) => module.ReferencePipelineRuntime),
  { ssr: false, loading: () => <div role="status" className="p-3 text-caos-xs text-caos-muted">Loading Reference route plan…</div> },
);

const PipelineEvidenceModal = dynamic(
  () => import("@/components/pipeline/PipelineEvidenceModal").then((module) => module.PipelineEvidenceModal),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div role="status" className="rounded border border-caos-border bg-caos-panel px-4 py-3 text-caos-md text-caos-text shadow-modal">
          Loading source evidence…
        </div>
      </div>
    ),
  },
);

export default function PipelinePage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <PipelineVisualizer />
      </Suspense>
    </RequireAuth>
  );
}

function useViewPreference(initial: "graph" | "lanes") {
  const [view, setView] = useState<"graph" | "lanes">(initial);
  const [viewHydrated, setViewHydrated] = useState(false);
  useEffect(() => {
    try {
      const v = localStorage.getItem("caos-b-view");
      if (v === "graph" || v === "lanes") setView(v);
    } catch {
      // Storage can be unavailable under strict browser privacy policies.
    } finally {
      setViewHydrated(true);
    }
  }, []);
  useEffect(() => {
    if (viewHydrated) {
      try {
        localStorage.setItem("caos-b-view", view);
      } catch {}
    }
  }, [viewHydrated, view]);
  return [view, setView] as const;
}

const VIEWS = ["graph", "lanes"] as const;

function usePipelineViewState(viewParam: string | null) {
  const [view, setView] = useViewPreference("graph");
  useEffect(() => {
    if (viewParam === "graph" || viewParam === "dependency-map") setView("graph");
    if (viewParam === "lanes" || viewParam === "stage-lanes") setView("lanes");
  }, [setView, viewParam]);
  useEffect(() => {
    const onCycle = (event: Event) => {
      const direction = (event as CustomEvent<{ direction: number }>).detail?.direction || 1;
      setView((current) => VIEWS[(VIEWS.indexOf(current) + direction + VIEWS.length) % VIEWS.length]);
    };
    window.addEventListener("caos:subview-cycle", onCycle);
    return () => window.removeEventListener("caos:subview-cycle", onCycle);
  }, [setView]);
  return { view, setView };
}

function usePipelineRunRows(issuerParam: string | null, dataMode: DataMode) {
  const [latestLiveIssuer, setLatestLiveIssuer] = useState<string | null>(null);
  const [rows, setRows] = useState<RunListItemDTO[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (dataMode === "reference") {
      setRows([]);
      setError(false);
      setLatestLiveIssuer(null);
      setLoading(false);
      return;
    }
    let stale = false;
    setLoading(true);
    listRuns().then((runs) => {
      if (stale) return;
      setRows(runs);
      setError(false);
      if (!issuerParam) setLatestLiveIssuer(runs.find((row) => row.status === "complete")?.issuer_id ?? null);
    }).catch(() => {
      if (stale) return;
      setRows([]);
      setError(true);
      setLatestLiveIssuer(null);
    }).finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [dataMode, issuerParam]);
  return { latestLiveIssuer, rows, error, loading };
}

function usePipelineUiState() {
  const [dimCompleted, setDimCompleted] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [evModal, setEvModal] = useState<string | null>(null);
  return { dimCompleted, setDimCompleted, selected, setSelected, evModal, setEvModal };
}

type PipelineStatusRead = ReturnType<typeof useLivePipelineStatus>;

function pipelineAvailability(liveMode: boolean, read: PipelineStatusRead) {
  const unavailable = liveMode && read.value == null;
  const blockingState: "error" | "in_flight" | "none" | null = unavailable && read.phase !== "complete" && read.phase !== "loading" ? read.phase : null;
  return { blockingState, loadingState: unavailable && read.phase === "loading" };
}

function isPartialPipelineRun(useLive: boolean, live: PipelineStatusRead["value"]) {
  return Boolean(useLive && live && ["queued", "running", "failed"].includes(live.status));
}

function usePipelineLive(
  issuerId: string,
  runParam: string | null,
) {
  const read = useLivePipelineStatus(issuerId, runParam);
  const { value: live, phase, latest } = read;
  const freshnessRunId = resolvePipelineFreshnessRunId(runParam, live?.runId);
  const selectedFreshnessRead = useIssuerFreshness({ runId: freshnessRunId });
  const selectedRunFreshness = selectedFreshnessRead.run?.evaluation ?? null;
  const liveRun = useLiveRun(issuerId, runParam);
  const [liveMode, setLiveMode] = useState(true);
  const useLive = liveMode && live != null;
  const availability = pipelineAvailability(liveMode, read);
  const runtime = live
    ? { sim: live.sim, scope: live.scope, plan: live.plan, completed: live.completed, total: live.total, modeLabel: "LIVE" }
    : { sim: { mods: {}, events: [], tick: 0, done: false } as Sim, scope: new Set<string>(), plan: [] as PlanStep[], completed: 0, total: 0, modeLabel: "LIVE" };
  const liveIsPartial = isPartialPipelineRun(useLive, live);
  const partialBlocked = live?.blocked ?? [];
  const cp5 = runtime.sim.mods["CP-5"]?.state || "idle";
  const clearance = deriveClearance({ useLive, live, cp5, modeDone: { tag: "idle", text: "CLEARANCE: not available" } });
  return {
    isReference: false as const, live, phase, latest, freshnessRunId, selectedRunFreshness, liveRun, liveMode, setLiveMode,
    useLive, ...availability, ...runtime, liveIsPartial, partialBlocked, clearance,
  };
}

function usePipelineContextSync(
  analysis: ReturnType<typeof useAnalysisContext>,
  issuerId: string,
  runParam: string | null,
  view: "graph" | "lanes",
  isReference: boolean,
) {
  const pipelineContext = analysis.context;
  const patchPipelineContext = analysis.patch;
  useEffect(() => {
    const context = pipelineContext;
    if (!context || !issuerId || isReference) return;
    const nextArtifacts = runParam && context.artifacts.issuer_run_id !== runParam
      ? { ...context.artifacts, issuer_run_id: runParam }
      : context.artifacts;
    const current = context.surface_state.pipeline;
    if (current?.active_id === (runParam ?? null) && current?.view === view && nextArtifacts === context.artifacts) return;
    void patchPipelineContext({
      artifacts: nextArtifacts,
      issuer_ids: Array.from(new Set([...context.issuer_ids, issuerId])),
      surface_state: {
        ...context.surface_state,
        pipeline: { ...current, active_id: runParam, view },
      },
    }).catch(() => undefined);
  }, [isReference, issuerId, patchPipelineContext, pipelineContext, runParam, view]);
}

function usePipelineNavigation(
  router: ReturnType<typeof useRouter>,
  searchParams: ReturnType<typeof useSearchParams>,
  analysis: ReturnType<typeof useAnalysisContext>,
  issuerId: string,
  runParam: string | null,
  liveRunId: string | undefined,
  dataMode: DataMode,
) {
  const selectRun = (row: RunListItemDTO) => {
    const query = new URLSearchParams(searchParams.toString());
    query.set("issuer", row.issuer_id);
    query.set("run", row.id);
    if (analysis.context) query.set("context", analysis.context.id);
    router.replace(preserveDataModeInHref(`/pipeline?${query.toString()}`, dataMode));
  };
  const openModule = (id: string) => {
    const shared = {
      issuer: issuerId,
      ...(runParam ? { run: runParam } : {}),
    };
    if (id === "CP-0") {
      const href = analysis.context ? contextHref("/upload", analysis.context.id, shared) : `/upload?issuer=${encodeURIComponent(issuerId)}`;
      router.push(preserveDataModeInHref(href, dataMode));
      return;
    }
    const infra = MODULES.find((m) => m.id === id)?.layer === "INFRA";
    const path = infra ? "/reports" : "/deepdive";
    const extra = infra ? shared : { ...shared, mod: id };
    if (analysis.context) {
      router.push(preserveDataModeInHref(contextHref(path, analysis.context.id, extra), dataMode));
      return;
    }
    const params = new URLSearchParams(extra);
    router.push(preserveDataModeInHref(`${path}?${params.toString()}`, dataMode));
  };
  const rerunHref = preserveDataModeInHref(analysis.context ? contextHref("/upload", analysis.context.id, { issuer: issuerId }) : `/upload?issuer=${encodeURIComponent(issuerId)}`, dataMode);
  const openRunHref = analysis.context
    ? contextHref("/deepdive", analysis.context.id, { issuer: issuerId, ...(liveRunId ? { run: liveRunId } : {}) })
    : `/deepdive?issuer=${encodeURIComponent(issuerId)}${liveRunId ? `&run=${encodeURIComponent(liveRunId)}` : ""}`;
  const intakeHref = preserveDataModeInHref(analysis.context ? contextHref("/upload", analysis.context.id, { issuer: issuerId }) : `/upload?issuer=${encodeURIComponent(issuerId)}`, dataMode);
  return { selectRun, openModule, rerunHref, openRunHref: preserveDataModeInHref(openRunHref, dataMode), intakeHref };
}

type PipelineSimulation = ReturnType<typeof usePipelineUiState> & ReferencePipelineRuntimeValue;

function liveSimulation(ui: ReturnType<typeof usePipelineUiState>, live: ReturnType<typeof usePipelineLive>): PipelineSimulation {
  const noop = () => undefined;
  const mode: RunMode = {
    k: "live", label: "LIVE", runId: live.live?.runId ?? "LIVE", title: "Persisted run",
    sub: live.live?.summary ?? "", drivers: null, plan: live.plan, complete: null,
    done: { tag: "idle", text: "Persisted run clearance" },
  };
  const run: SimRun = {
    sim: live.sim, playing: false, setPlaying: noop, speed: 1, setSpeed: noop,
    reset: noop, clock: "", completed: live.completed, total: live.total,
  };
  return { ...ui, modeK: "live", setModeK: noop, mode, simScope: live.scope, run, modes: [], fixtures: { drivers: [], nodeLimits: {}, nodeQa: {}, nodeReqs: {} } };
}

function referencePipelineLive(runtime: ReferencePipelineRuntimeValue) {
  const cp5 = runtime.run.sim.mods["CP-5"]?.state || "idle";
  return {
    isReference: true as const,
    live: null,
    phase: "complete" as const,
    latest: null,
    freshnessRunId: null,
    selectedRunFreshness: null,
    liveRun: { liveOuts: {} as Record<string, ModuleOutput>, liveEvidence: {}, runId: null, loading: false, phase: "none" as const },
    liveMode: false,
    setLiveMode: () => undefined,
    useLive: false,
    blockingState: null,
    loadingState: false,
    sim: runtime.run.sim,
    scope: runtime.simScope,
    plan: runtime.mode.plan,
    completed: runtime.run.completed,
    total: runtime.run.total,
    modeLabel: runtime.mode.label,
    liveIsPartial: false,
    partialBlocked: [],
    clearance: deriveClearance({ useLive: false, live: null, cp5, modeDone: runtime.mode.done }),
  };
}

function useLivePipelineViewModel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const issuerParam = searchParams.get("issuer");
  const runParam = searchParams.get("run");
  const analysis = useAnalysisContext({ name: "Pipeline run review" });
  const viewState = usePipelineViewState(searchParams.get("view"));
  const worklist = usePipelineRunRows(issuerParam, "live");
  const ui = usePipelineUiState();
  const selectedRun = worklist.rows.find((item) => item.id === runParam) ?? null;
  const issuerId = issuerParam || selectedRun?.issuer_id || worklist.latestLiveIssuer || "";
  const live = usePipelineLive(issuerId, runParam);
  const simulation = liveSimulation(ui, live);
  usePipelineContextSync(analysis, issuerId, runParam, viewState.view, false);
  const navigation = usePipelineNavigation(router, searchParams, analysis, issuerId, runParam, live.live?.runId, "live");
  const pickDriver = (driver: Driver) => {
    const moduleId = driver.lineage.match(/CP-[0-9A-Z]+/)?.[0];
    if (moduleId) simulation.setSelected(moduleId);
  };
  return { analysis, viewState, worklist, simulation, issuerId, runParam, live, navigation, pickDriver };
}

function useReferencePipelineViewModel(runtime: ReferencePipelineRuntimeValue) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runParam = searchParams.get("run");
  const analysis = useAnalysisContext({ name: "Pipeline reference review" });
  const viewState = usePipelineViewState(searchParams.get("view"));
  const ui = usePipelineUiState();
  const simulation: PipelineSimulation = { ...ui, ...runtime };
  const issuerId = searchParams.get("issuer") || ATLF_REFERENCE_ISSUER_ID;
  const live = referencePipelineLive(runtime);
  const worklist = { latestLiveIssuer: null, rows: [] as RunListItemDTO[], error: false, loading: false };
  usePipelineContextSync(analysis, issuerId, runParam, viewState.view, true);
  const navigation = usePipelineNavigation(router, searchParams, analysis, issuerId, runParam, undefined, "reference");
  const pickDriver = (driver: Driver) => {
    const moduleId = driver.lineage.match(/CP-[0-9A-Z]+/)?.[0];
    if (moduleId) simulation.setSelected(moduleId);
  };
  return { analysis, viewState, worklist, simulation, issuerId, runParam, live, navigation, pickDriver };
}

type PipelineViewModel = ReturnType<typeof useLivePipelineViewModel> | ReturnType<typeof useReferencePipelineViewModel>;

const PIPELINE_VIEW_OPTIONS = [{ k: "graph", l: "Dependency map" }, { k: "lanes", l: "Stage lanes" }] as const;

function PipelineNarrowControls({ model }: { model: PipelineViewModel }) {
  const { completed, total, clearance } = model.live;
  const referenceStarted = model.live.isReference && (completed > 0 || model.simulation.run.playing);
  return (
    <>
      <span className="tabular text-caos-md text-caos-accent whitespace-nowrap">{model.live.useLive ? `RUN ${model.live.live!.runId.slice(0, 8)}` : model.simulation.mode.runId}</span>
      {model.live.isReference && !referenceStarted
        ? <span className="tabular text-caos-md text-caos-muted whitespace-nowrap">{total} planned · 0 executed</span>
        : <div className="w-32 flex items-center gap-2 shrink-0"><Bar pct={total ? (completed / total) * 100 : 0} color="var(--caos-accent)" /><span className="tabular text-caos-md text-caos-muted whitespace-nowrap">{model.live.isReference ? `${completed} executed / ${total} planned` : `${completed}/${total}`}</span></div>}
      <Tag sev={clearance.tag}>{clearance.text}</Tag>
      <ToggleGroup className="shrink-0" value={model.viewState.view} onChange={model.viewState.setView} options={PIPELINE_VIEW_OPTIONS} />
    </>
  );
}

function PipelineIdentity({ model }: { model: PipelineViewModel }) {
  const runIdLabel = model.live.useLive ? `RUN ${model.live.live!.runId.slice(0, 8)}` : model.simulation.mode.runId;
  const issuerName = model.live.useLive && !model.live.isReference ? model.issuerId : "Atlas Forge";
  const suffix = model.live.useLive ? " — persisted CP-X run" : ` — reference route plan · ${model.simulation.mode.title}`;
  const badges = (
    <>
      {model.live.isReference ? <Tag sev="idle">REFERENCE PLAN</Tag> : null}
      <span className="tabular text-caos-xs text-caos-accent whitespace-nowrap">{runIdLabel}</span>
      {model.live.freshnessRunId ? <FreshnessIndicator evaluation={model.live.selectedRunFreshness} /> : null}
    </>
  );
  return <ShellIdentity tag="PIPELINE" badges={badges} title={<>{issuerName}{suffix}</>} />;
}

function PipelineUtilityControls({ model }: { model: PipelineViewModel }) {
  const { completed, total, clearance } = model.live;
  const referenceStarted = model.live.isReference && (completed > 0 || model.simulation.run.playing);
  return (
    <>
      {model.live.isReference ? <ToggleGroup size="sm" className="shrink-0" value={model.simulation.modeK} onChange={(mode) => { model.simulation.setModeK(mode); model.simulation.setSelected(null); }} options={model.simulation.modes.map((mode) => ({ k: mode.k, l: mode.label, title: mode.title }))} /> : null}
      <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap truncate hidden 2xl:inline">{model.live.useLive ? model.live.live!.summary : model.simulation.mode.sub}</span>
      {model.live.isReference && !referenceStarted
        ? <span className="hidden lg:inline tabular text-caos-md text-caos-muted whitespace-nowrap">{total} planned · 0 executed</span>
        : <div className="w-44 hidden lg:flex items-center gap-2 shrink-0"><Bar pct={total ? (completed / total) * 100 : 0} color="var(--caos-accent)" /><span className="tabular text-caos-md text-caos-muted whitespace-nowrap">{model.live.isReference ? `${completed} executed / ${total} planned` : `${completed}/${total}`}</span></div>}
      <span className="hidden lg:inline-flex"><Tag sev={clearance.tag}>{clearance.text}</Tag></span>
      {model.live.isReference ? <SimControls run={model.simulation.run} /> : null}
      {model.live.isReference ? <span className="tabular text-caos-md text-caos-muted whitespace-nowrap hidden 2xl:inline">{model.simulation.run.clock} ET</span> : null}
      <span className="hidden lg:inline-flex"><ToggleGroup className="shrink-0" value={model.viewState.view} onChange={model.viewState.setView} options={PIPELINE_VIEW_OPTIONS} /></span>
      <button onClick={() => model.simulation.setDimCompleted(!model.simulation.dimCompleted)} title="Dim completed nodes" className={`tabular text-caos-xs px-1.5 h-6 rounded border transition-caos whitespace-nowrap shrink-0 focus-ring ${model.simulation.dimCompleted ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text"}`}>DIM ✓</button>
    </>
  );
}

function PipelinePartialSnapshot({ model }: { model: PipelineViewModel }) {
  const live = model.live.live;
  if (!model.live.liveIsPartial || !live) return null;
  return (
    <PanelShell title="Persisted execution snapshot" className="shrink-0 mx-2" right={<Tag sev={live.status === "failed" ? "blocked" : "running"}>{live.status === "failed" ? "FAILED · PARTIAL" : "RUNNING · PARTIAL"}</Tag>}>
      <div className="p-2 grid gap-2">
        <p className="text-caos-xs text-caos-muted leading-snug">This is the persisted subset of the selected run, not a completed route simulation. Produced rows remain inspectable; pending rows have not produced output.</p>
        <div className="flex flex-wrap gap-1.5"><Tag sev="ok">produced {live.produced}</Tag><Tag sev="idle">pending {live.pending}</Tag><Tag sev={model.live.partialBlocked.length ? "blocked" : "idle"}>blocked {model.live.partialBlocked.length}</Tag></div>
        {model.live.partialBlocked.length ? <div className="grid gap-1 border-t border-caos-border pt-2">{model.live.partialBlocked.map((blocked) => <div key={blocked.moduleId} className="flex flex-wrap items-center gap-2 text-caos-xs"><Tag sev="blocked">{blocked.moduleId} blocked</Tag><span className="text-caos-muted">{blocked.reason ?? "Persisted block reason unavailable."}</span>{blocked.reason ? <Link href={model.navigation.rerunHref} className="caos-action-secondary no-underline focus-ring">Prepare re-run</Link> : null}</div>)}</div> : null}
      </div>
    </PanelShell>
  );
}

interface PipelineWorkspaceModel {
  view: "graph" | "lanes";
  sim: Sim;
  selected: string | null;
  setSelected: (value: string | null) => void;
  dimCompleted: boolean;
  scope: Set<string>;
  openModule: (id: string) => void;
  run: SimRun;
  plan: PlanStep[];
  modeLabel: string;
  useLive: boolean;
  mode: RunMode;
  liveLineage?: ModuleOutput;
  liveLineageLoading: boolean;
  pickDriver: (driver: Driver) => void;
  setEvModal: (value: string | null) => void;
  referenceFixtures?: PipelineReferenceFixtures;
}

function pipelineWorkspaceModel(model: PipelineViewModel): PipelineWorkspaceModel {
  return {
    view: model.viewState.view, sim: model.live.sim, selected: model.simulation.selected, setSelected: model.simulation.setSelected,
    dimCompleted: model.simulation.dimCompleted, scope: model.live.scope, openModule: model.navigation.openModule,
    run: model.simulation.run, plan: model.live.plan, modeLabel: model.live.modeLabel, useLive: model.live.useLive,
    mode: model.simulation.mode, liveLineage: model.live.liveRun.liveOuts["CP-5B"],
    liveLineageLoading: model.live.liveRun.loading || model.live.liveRun.phase === "loading",
    pickDriver: model.pickDriver, setEvModal: model.simulation.setEvModal,
    referenceFixtures: model.live.isReference ? model.simulation.fixtures : undefined,
  };
}

function PipelineWorkbench({ model }: { model: PipelineViewModel }) {
  const plannedCount = model.simulation.mode.plan.filter((step) => step.outcome !== "idle").length;
  const count = model.live.useLive
    ? `${model.worklist.rows.length} runs · ${model.live.completed}/${model.live.total} modules`
    : `${plannedCount} planned · 0 executed`;
  return (
    <div className="h-full min-h-0 flex flex-col">
      <WorkbenchToolbar title="Run worklist" description="Inspect stage clearance, failures and evidence for the selected analysis run." count={count} viewLabel={model.live.useLive ? "Persisted run" : "Reference plan"} />
      <DominantTableRegion ownerId="pipeline-run-worklist" label="Recent analysis runs" className="shrink-0">
        <PipelineRunWorklist runs={model.worklist.rows} selectedRunId={model.runParam} unavailable={model.worklist.error} loading={model.worklist.loading} onSelect={model.navigation.selectRun} />
      </DominantTableRegion>
      <PipelinePartialSnapshot model={model} />
      <PipelineWorkspace model={pipelineWorkspaceModel(model)} />
    </div>
  );
}

function PipelinePageView({ model }: { model: PipelineViewModel }) {
  const liveStatus = model.live.useLive ? model.live.live?.status : null;
  const execution: CompletionExecution | CompletionNotApplicable = !model.live.useLive
    ? "not-applicable"
    : liveStatus === "complete"
      ? "complete"
      : liveStatus === "failed"
        ? "failed"
        : liveStatus === "queued"
          ? "queued"
          : liveStatus === "running"
            ? "running"
            : "not-started";
  const freshness: CompletionFreshness = model.live.selectedRunFreshness?.state === "current"
    ? "current"
    : model.live.selectedRunFreshness?.state === "stale"
      ? "stale"
      : "unknown";
  return (
    <EnterprisePage
      kind="worklist"
      identity={<PipelineIdentity model={model} />}
      primaryAction={{ label: "Open run", href: model.navigation.openRunHref, title: "Open the selected run in Deep-Dive" }}
      status={<div className="flex min-w-0 flex-wrap items-center gap-2">
        <CompletionStateSummary
          label="Pipeline completion"
          execution={execution}
          persistence={model.live.useLive ? "saved" : "not-applicable"}
          approval="not-applicable"
          freshness={model.live.useLive ? freshness : "not-applicable"}
        />
        <AnalysisContextSaveState analysis={model.analysis} />
      </div>}
      contextualControls={<Link href={model.navigation.intakeHref} className="caos-action-secondary no-underline focus-ring">Document intake</Link>}
      utilityLabel="Run display controls"
      utilityControls={<PipelineUtilityControls model={model} />}
      narrowContract={{ essentialControls: <PipelineNarrowControls model={model} /> }}
    >
      <div className="caos-persona-route pipeline-workbench flex-1 min-h-0"><PersonaWorkbench surface="pipeline" primary={<PipelineWorkbench model={model} />} /></div>
      {model.simulation.evModal ? <PipelineEvidenceModal id={model.simulation.evModal} live={model.live.liveRun.liveEvidence} isLiveRun={!model.live.isReference && !!model.live.liveRun.runId} onClose={() => model.simulation.setEvModal(null)} /> : null}
    </EnterprisePage>
  );
}

function PipelineVisualizer() {
  const dataMode = useDataMode();
  return dataMode === "reference"
    ? <ReferencePipelineRuntime>{(runtime) => <ReferencePipelineVisualizer runtime={runtime} />}</ReferencePipelineRuntime>
    : <LivePipelineVisualizer />;
}

function LivePipelineVisualizer() {
  const model = useLivePipelineViewModel();
  if (!model.issuerId && !model.worklist.loading) return <PipelineRunState state="none" issuerId="No issuer selected" runStatus={null} />;
  if (model.live.blockingState) return <PipelineRunState state={model.live.blockingState} issuerId={model.issuerId} runStatus={model.live.latest?.status ?? null} />;
  if (model.live.loadingState) return <PipelineLoadingState issuerId={model.issuerId} />;
  return <PipelinePageView model={model} />;
}

function ReferencePipelineVisualizer({ runtime }: { runtime: ReferencePipelineRuntimeValue }) {
  const model = useReferencePipelineViewModel(runtime);
  return <PipelinePageView model={model} />;
}

function PipelineRunWorklist({
  runs,
  selectedRunId,
  unavailable,
  loading,
  onSelect,
}: {
  runs: RunListItemDTO[];
  selectedRunId: string | null;
  unavailable: boolean;
  loading: boolean;
  onSelect: (run: RunListItemDTO) => void;
}) {
  if (unavailable) {
    return (
      <div role="status" className="mx-2 mt-2 rounded border border-caos-warning/50 bg-caos-warning-surface px-3 py-2 tabular text-caos-xs text-caos-warning">
        Run index unavailable. The selected run remains visible, but no live worklist can be asserted.
      </div>
    );
  }
  // Loading and genuinely-empty must render differently — a worklist that
  // silently shows nothing while the fetch is still in flight is what let the
  // deep-link "0 runs" state pass as normal. Only render nothing once the
  // fetch has settled with a real empty result.
  if (loading) {
    return <SurfaceState kind="loading" title="Loading run worklist" compact className="mx-2 mt-2" />;
  }
  if (!runs.length) return null;
  const visible = runs.slice(0, 20);
  const columns: DataTableColumn<RunListItemDTO>[] = [
    { key: "run", header: "Run", rowHeader: true, render: (item) => <span className="text-caos-text">{item.id.slice(0, 8)}</span> },
    { key: "issuer", header: "Issuer", render: (item) => <span className="text-caos-muted">{item.issuer_id}</span> },
    {
      key: "state",
      header: "State",
      render: (item) => {
        const statusKind = item.status === "complete" ? "pass" : item.status === "failed" ? "blocked" : "running";
        return <Tag sev={statusKind}>{item.status.toUpperCase()}</Tag>;
      },
    },
    { key: "freshness", header: "Freshness", render: (item) => <RunFreshnessCell runId={item.id} /> },
    { key: "committee", header: "Committee", render: (item) => <span className="text-caos-muted">{item.committee_status || "UNRATED"}</span> },
    { key: "as-of", header: "As of", render: (item) => <span className="text-caos-muted">{item.as_of_date || "UNKNOWN"}</span> },
    {
      key: "action",
      header: "Action",
      align: "action",
      render: (item) => {
        const selected = selectedRunId === item.id;
        return (
          <button type="button" onClick={() => onSelect(item)} aria-pressed={selected} className="caos-action-secondary focus-ring">
            {selected ? "SELECTED" : "OPEN"}
          </button>
        );
      },
    },
  ];
  return (
    <div className="mx-2 mt-2 max-h-28 shrink-0 overflow-auto rounded border border-caos-border bg-caos-panel" aria-label="Recent analysis runs">
      <DataTable
        columns={columns}
        rows={visible}
        getRowId={(item) => item.id}
        rowClassName={(item) => (selectedRunId === item.id ? "bg-caos-accent/10" : "hover:bg-caos-elevated/60")}
        className="min-w-[760px]"
        caption="Recent analysis runs"
      />
    </div>
  );
}

function RunFreshnessCell({ runId }: { runId: string }) {
  const freshness = useIssuerFreshness({ runId });
  return <FreshnessIndicator evaluation={freshness.run?.evaluation} />;
}

// Honest full-pane states for a real issuer whose run is unavailable — shown
// instead of the offline demo so an errored / in-flight / never-run pipeline is
// never disguised as a passing run. (review: pipeline "fail open")
function PipelineRunState({
  state, issuerId, runStatus,
}: {
  state: "error" | "in_flight" | "none";
  issuerId: string;
  runStatus: string | null;
}) {
  const cfg = {
    error: {
      tag: "critical" as const, kind: "error" as SurfaceStateKind, head: "Run status unavailable",
      body: "Couldn't reach the run service for this issuer. This is a connection or backend error — not a passing run. Retry, or check the service.",
    },
    in_flight: {
      tag: "warning" as const, kind: (runStatus === "failed" ? "unavailable" : "partial") as SurfaceStateKind, head: runStatus === "failed" ? "Run failed" : "Run in progress",
      body: runStatus === "failed"
        ? "The latest run for this issuer did not complete (failed). No cleared committee output is available — re-run the pipeline."
        : "A run for this issuer is queued or executing. The route graph populates once it completes — no cleared output yet.",
    },
    none: {
      tag: "idle" as const, kind: "empty" as SurfaceStateKind, head: "No runs for this issuer",
      body: "This issuer has never been analysed. Start a run from Document Intake to populate the CP-X route graph.",
    },
  }[state];
  const referenceHref = withDataMode(`/pipeline?issuer=${ATLF_REFERENCE_ISSUER_ID}`, "reference");
  return (
    <EnterprisePage
      kind="worklist"
      identity={<ShellIdentity tag="PIPELINE" title="Run state" badges={<Tag sev={cfg.tag}>{cfg.head.toUpperCase()}</Tag>} />}
      primaryAction={{ label: "DOCUMENT INTAKE", href: "/upload" }}
      contextualControls={<Link href={referenceHref} className="caos-action-secondary no-underline focus-ring">Open reference plan</Link>}
      narrowContract={{ essentialControls: <Tag sev={cfg.tag}>{cfg.head.toUpperCase()}</Tag> }}
    >
      <div className="caos-persona-route pipeline-workbench flex-1 min-h-0">
        <PersonaWorkbench
          surface="pipeline"
          primary={(
            <div className="h-full min-h-0 flex items-center justify-center p-6">
        <SurfaceState
          kind={cfg.kind}
          headingLevel={2}
          title={cfg.head}
                detail={cfg.body}
                supporting={<div className="tabular text-caos-3xs text-caos-muted truncate">issuer {issuerId}</div>}
                className="max-w-md w-full"
              />
            </div>
          )}
        />
      </div>
    </EnterprisePage>
  );
}

// Neutral loading shell for a real issuer whose run is still being fetched.
function PipelineLoadingState({ issuerId }: { issuerId: string }) {
  return (
    <EnterprisePage
      kind="worklist"
      identity={<ShellIdentity tag="PIPELINE" title={issuerId} badges={<Tag sev="idle">LOADING</Tag>} />}
      primaryAction={{ label: "DOCUMENT INTAKE", href: `/upload?issuer=${encodeURIComponent(issuerId)}` }}
      contextualControls={<Link href={withDataMode(`/pipeline?issuer=${ATLF_REFERENCE_ISSUER_ID}`, "reference")} className="caos-action-secondary no-underline focus-ring">Open reference plan</Link>}
      narrowContract={{ essentialControls: <Tag sev="idle">LOADING</Tag> }}
    >
      <div className="caos-persona-route pipeline-workbench flex-1 min-h-0">
        <PersonaWorkbench
          surface="pipeline"
          primary={(
            <div className="h-full min-h-0 flex items-center justify-center p-6">
        <SurfaceState kind="loading" headingLevel={2} title="Loading run" detail={`Retrieving the latest persisted pipeline state for ${issuerId}.`} className="max-w-md w-full" />
            </div>
          )}
        />
      </div>
    </EnterprisePage>
  );
}

function PipelineExecutionPane({ model }: { model: PipelineWorkspaceModel }) {
  return (
    <PanelShell
      title={model.view === "graph" ? "Dependency map" : "Stage lanes"}
      className="flex-1"
      right={<span className="flex items-center gap-3"><span className="flex items-center gap-1 text-caos-xs text-caos-muted"><span className="w-3 h-px" style={{ background: "var(--caos-accent)" }}></span>lineage (upstream)</span><span className="flex items-center gap-1 text-caos-xs text-caos-muted"><span className="w-3 h-px" style={{ background: "var(--tranche-sub)" }}></span>consumers</span></span>}
    >
      {model.view === "graph" ? <div className="h-full overflow-auto"><GraphView sim={model.sim} selected={model.selected} onSelect={model.setSelected} dim={model.dimCompleted} scope={model.scope} onDoubleClick={model.openModule} referenceFixtures={model.referenceFixtures} /></div> : <SwimlaneView sim={model.sim} selected={model.selected} onSelect={model.setSelected} scope={model.scope} onDoubleClick={model.openModule} referenceFixtures={model.referenceFixtures} />}
    </PanelShell>
  );
}

function PipelineTracePane({ model }: { model: PipelineWorkspaceModel }) {
  const untouchedReference = Boolean(model.referenceFixtures && !model.run.playing && model.run.completed === 0);
  const status = untouchedReference
    ? <span className="tabular text-caos-xs text-caos-muted">Execution N/A · replay not started</span>
    : <span className="flex items-center gap-1.5"><Dot sev="running" pulse={model.run.playing && !model.sim.done} /><span className="tabular text-caos-xs text-caos-muted">{model.sim.events.length} events</span></span>;
  return <PanelShell title="Run activity" className="h-[200px] shrink-0" right={status}><EventLog events={model.sim.events} /></PanelShell>;
}

function PipelineLineagePane({ model }: { model: PipelineWorkspaceModel }) {
  const persisted = model.liveLineage?.sections.some((section) => section.title.includes("Decision-relevant driver lineage")) ?? false;
  const title = model.useLive
    ? "Route plan · decision-relevant drivers"
    : model.mode.drivers
      ? `Route plan · drivers in scope (${model.mode.drivers.length}/5)`
      : "Route plan · decision-relevant drivers";
  const status = model.useLive ? <Tag sev={persisted ? "ok" : "idle"}>{persisted ? "live persisted" : "unavailable"}</Tag> : <Tag sev="idle">seeded reference · demo</Tag>;
  return (
    <PanelShell title={title} className="flex-[2]" right={status}>
      {model.useLive ? <LiveLineagePanel output={model.liveLineage} loading={model.liveLineageLoading} onOpenEvidence={model.setEvModal} /> : <LineagePanel drivers={model.mode.drivers} catalog={model.referenceFixtures?.drivers ?? []} onPick={model.pickDriver} onOpenEvidence={model.setEvModal} />}
    </PanelShell>
  );
}

function PipelineInspectorPane({ model }: { model: PipelineWorkspaceModel }) {
  return (
    <aside className="pipeline-workspace__inspector flex flex-col gap-2 min-h-0" aria-label="Run module inspection and lineage">
      <PanelShell title="QA review" className="flex-[3]" right={<span className="text-caos-xs text-caos-muted">Module inspector · CP-X</span>}><Inspector sim={model.sim} selected={model.selected} plan={model.plan} scope={model.scope} modeLabel={model.modeLabel} isLive={model.useLive} onOpen={model.openModule} referenceFixtures={model.referenceFixtures} /></PanelShell>
      <PipelineLineagePane model={model} />
    </aside>
  );
}

function PipelineWorkspace({ model }: { model: PipelineWorkspaceModel }) {
  return (
    <div className="pipeline-workspace flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_368px] gap-2 p-2">
      <div className="pipeline-workspace__primary flex flex-col gap-2 min-h-0 min-w-0"><PipelineExecutionPane model={model} /><PipelineTracePane model={model} /></div>
      <PipelineInspectorPane model={model} />
    </div>
  );
}
