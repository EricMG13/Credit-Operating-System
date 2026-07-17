"use client";

// Concept B — The Pipeline Visualizer: the CP-X route graph as a live DAG.
// Run-mode templates (COMMITTEE / EARNINGS / LEGAL / RV), upstream/downstream
// lineage tracing, module inspector, CP-5B driver lineage with E-xx evidence,
// QA gating on CP-5, and the orchestrator event log.

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { SurfaceState, type SurfaceStateKind } from "@/components/shared/SurfaceState";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EvidenceModal } from "@/components/reports/EvidenceModal";
import { buildReports } from "@/lib/reports/builders";
import { listRuns } from "@/lib/api";
import { MODULES, RUN_MODES, type Driver, type RunMode, type PlanStep } from "@/lib/pipeline/data";
import { useSimRun, type SimRun } from "@/lib/pipeline/sim";
import { useLivePipelineStatus } from "@/lib/pipeline/useLivePipeline";
import { useLiveRun } from "@/lib/engine/useLiveRun";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";
import { Bar, Dot, SimControls, Tag, ToggleGroup } from "@/components/pipeline/atoms";
import { EventLog, GraphView, Inspector, LineagePanel, LiveLineagePanel, SwimlaneView } from "@/components/pipeline/views";
import { deriveClearance } from "@/lib/pipeline/clearance";
import { Panel as PanelShell } from "@/components/shared/Panel";
import type { Sim } from "@/lib/pipeline/sim-engine";
import { EnterprisePage, type NarrowContract } from "@/components/shared/EnterprisePage";
import { SubHeader } from "@/components/shared/SubHeader";
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
    const v = localStorage.getItem("caos-b-view");
    if (v === "graph" || v === "lanes") setView(v);
    setViewHydrated(true);
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

function PipelineVisualizer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const issuerParam = searchParams.get("issuer");
  const runParam = searchParams.get("run");
  const viewParam = searchParams.get("view");
  const analysis = useAnalysisContext({ name: "Pipeline run review" });
  const [latestLiveIssuer, setLatestLiveIssuer] = useState<string | null>(null);
  const [runRows, setRunRows] = useState<RunListItemDTO[]>([]);
  const [runRowsError, setRunRowsError] = useState(false);
  const [runRowsLoading, setRunRowsLoading] = useState(true);
  const [view, setView] = useViewPreference("graph");

  useEffect(() => {
    if (viewParam === "graph" || viewParam === "lanes") setView(viewParam);
  }, [setView, viewParam]);

  useEffect(() => {
    const onCycle = (e: Event) => {
      const customEvent = e as CustomEvent<{ direction: number }>;
      const dir = customEvent.detail?.direction || 1;
      setView((curr) => {
        const idx = VIEWS.indexOf(curr);
        const nextIdx = (idx + dir + 2) % 2;
        return VIEWS[nextIdx];
      });
    };
    window.addEventListener("caos:subview-cycle", onCycle);
    return () => window.removeEventListener("caos:subview-cycle", onCycle);
  }, [setView]);

  const [modeK, setModeK] = useState("full");
  const [dimCompleted, setDimCompleted] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [evModal, setEvModal] = useState<string | null>(null);

  const mode = RUN_MODES.find((m) => m.k === modeK)!;
  const simScope = useMemo(() => new Set(mode.plan.map((p) => p.id)), [mode]);
  const run = useSimRun({ autoplay: true, plan: mode.plan, complete: mode.complete });
  const reports = useMemo(() => buildReports(), []);

  useEffect(() => {
    // The worklist must populate regardless of whether the URL already names
    // an issuer/run — a deep link, bookmark, or refresh after selectRun()
    // (which writes ?issuer=&run=) used to short-circuit this fetch entirely,
    // leaving the worklist permanently empty ("0 runs") on every non-bare
    // /pipeline visit. issuerParam only decides whether we ALSO derive a
    // fallback latestLiveIssuer — it must never gate the fetch itself.
    let stale = false;
    setRunRowsLoading(true);
    listRuns()
      .then((runs) => {
        if (stale) return;
        setRunRows(runs);
        setRunRowsError(false);
        if (!issuerParam) {
          setLatestLiveIssuer(runs.find((r) => r.status === "complete")?.issuer_id ?? null);
        }
      })
      .catch(() => {
        if (stale) return;
        setRunRows([]);
        setRunRowsError(true);
        setLatestLiveIssuer(null);
      })
      .finally(() => {
        if (!stale) setRunRowsLoading(false);
      });
    return () => { stale = true; };
  }, [issuerParam]);

  // Prefer the requested issuer, otherwise the newest complete live run; fall
  // back to the ATLF reference demo when no live run is available.
  const selectedRunRow = runRows.find((item) => item.id === runParam) ?? null;
  const issuerId = issuerParam || selectedRunRow?.issuer_id || latestLiveIssuer || ATLF_REFERENCE_ISSUER_ID;
  const isReference = issuerId === ATLF_REFERENCE_ISSUER_ID;
  const { value: live, phase, latest } = useLivePipelineStatus(issuerId, runParam);
  const freshnessRunId = resolvePipelineFreshnessRunId(runParam, live?.runId);
  const selectedFreshnessRead = useIssuerFreshness({ runId: freshnessRunId });
  const selectedRunFreshness = selectedFreshnessRead.run?.evaluation ?? null;
  const liveRun = useLiveRun(issuerId, runParam);
  const [liveMode, setLiveMode] = useState(true);
  const useLive = liveMode && live != null;
  // Fail-open guard: for a *real* issuer the analyst opened expecting their run,
  // a genuine error / an in-flight (queued·running·failed) run / no coverage must
  // NOT silently render the animated green-PASS demo. Show an honest state instead.
  // The ATLF reference issuer keeps the demo — it is the labelled showcase.
  const blockingState: "error" | "in_flight" | "none" | null =
    !isReference && liveMode && live == null && phase !== "complete" && phase !== "loading"
      ? phase
      : null;
  // While a *real* issuer's run is still loading, blockingState is null and
  // useLive is false — falling through would autoplay the ATLF green-PASS demo
  // stamped with another deal's name under this issuer's URL (the same fabricated
  // -green leak the fail-open guard exists to prevent, on the loading phase it
  // forgot). Show a neutral loading shell until the real state resolves instead.
  const loadingState = !isReference && liveMode && phase === "loading";

  const sim = useLive ? live!.sim : run.sim;
  const scope = useLive ? live!.scope : simScope;
  const plan = useLive ? live!.plan : mode.plan;
  const completed = useLive ? live!.completed : run.completed;
  const total = useLive ? live!.total : run.total;
  const modeLabel = useLive ? "LIVE" : mode.label;
  const liveIsPartial = useLive && ["queued", "running", "failed"].includes(live!.status);
  const partialBlocked = live?.blocked ?? [];
  const rerunHref = analysis.context
    ? contextHref("/upload", analysis.context.id, { issuer: issuerId })
    : `/upload?issuer=${encodeURIComponent(issuerId)}`;

  const cp5 = sim.mods["CP-5"]?.state || "idle";
  const clearance = deriveClearance({ useLive, live, cp5, modeDone: mode.done });

  const pickDriver = (d: Driver) => {
    const mod = d.lineage.match(/CP-[0-9A-Z]+/);
    if (mod) setSelected(mod[0]);
  };

  const selectRun = (row: RunListItemDTO) => {
    const query = new URLSearchParams(searchParams.toString());
    query.set("issuer", row.issuer_id);
    query.set("run", row.id);
    if (analysis.context) query.set("context", analysis.context.id);
    router.replace(`/pipeline?${query.toString()}`);
  };

  const pipelineContext = analysis.context;
  const patchPipelineContext = analysis.patch;
  useEffect(() => {
    const context = pipelineContext;
    if (!context) return;
    const nextArtifacts = runParam && context.artifacts.issuer_run_id !== runParam
      ? { ...context.artifacts, issuer_run_id: runParam }
      : context.artifacts;
    const current = context.surface_state.pipeline;
    if (current?.active_id === (runParam ?? null) && current?.view === view && nextArtifacts === context.artifacts) return;
    void patchPipelineContext({
      artifacts: nextArtifacts,
      issuer_ids: issuerId === ATLF_REFERENCE_ISSUER_ID ? context.issuer_ids : Array.from(new Set([...context.issuer_ids, issuerId])),
      surface_state: {
        ...context.surface_state,
        pipeline: { ...current, active_id: runParam, view },
      },
    }).catch(() => undefined);
  }, [issuerId, patchPipelineContext, pipelineContext, runParam, view]);

  // Double-click a module → its output register in the Concept C deep-dive.
  // CP-0 is the L0 intake stage, so it opens Document Intake; INFRA nodes
  // produce the committee pack itself, so they land on Concept E.
  const openModule = (id: string) => {
    const shared = {
      issuer: issuerId,
      ...(runParam ? { run: runParam } : {}),
    };
    if (id === "CP-0") {
      router.push(analysis.context ? contextHref("/upload", analysis.context.id, shared) : `/upload?issuer=${encodeURIComponent(issuerId)}`);
      return;
    }
    const infra = MODULES.find((m) => m.id === id)?.layer === "INFRA";
    const path = infra ? "/reports" : "/deepdive";
    const extra = infra ? shared : { ...shared, mod: id };
    if (analysis.context) {
      router.push(contextHref(path, analysis.context.id, extra));
      return;
    }
    const params = new URLSearchParams(extra);
    router.push(`${path}?${params.toString()}`);
  };

  // A real issuer's run errored / is mid-flight / never ran — render an honest
  // state, never the fabricated green-PASS demo under their name.
  if (blockingState) {
    return <PipelineRunState state={blockingState} issuerId={issuerId} runStatus={latest?.status ?? null} />;
  }
  // Real issuer, fetch still in flight — show a neutral loading shell rather than
  // the autoplaying demo sim (which would flash another deal's green PASS run).
  if (loadingState) {
    return <PipelineLoadingState issuerId={issuerId} />;
  }

  const runIdLabel = useLive ? `RUN ${live!.runId.slice(0, 8)}` : mode.runId;
  const issuerName = useLive && issuerId !== ATLF_REFERENCE_ISSUER_ID ? issuerId : "Atlas Forge";
  // Split the run-mode designator into its own span so it stays visible even when a
  // long issuer id truncates — it names what the header shows (the live CP-X run vs
  // the offline route template), so it must never be clipped out of view.
  const issuerModeSuffix = useLive ? " — live CP-X run" : " — " + mode.title;
  const openRunHref = analysis.context
    ? contextHref("/deepdive", analysis.context.id, { issuer: issuerId, ...(live?.runId ? { run: live.runId } : {}) })
    : `/deepdive?issuer=${encodeURIComponent(issuerId)}${live?.runId ? `&run=${encodeURIComponent(live.runId)}` : ""}`;

  const narrowContract: NarrowContract = {
    essentialControls: (
      <>
        <span className="tabular text-caos-md text-caos-accent whitespace-nowrap">{runIdLabel}</span>
        <div className="w-32 flex items-center gap-2 shrink-0">
          <Bar pct={total ? (completed / total) * 100 : 0} color="var(--caos-accent)" />
          <span className="tabular text-caos-md text-caos-muted whitespace-nowrap">{completed}/{total}</span>
        </div>
        <Tag sev={clearance.tag}>{clearance.text}</Tag>
        <ToggleGroup
          className="shrink-0"
          value={view}
          onChange={setView}
          options={[
            { k: "graph", l: "DAG" },
            { k: "lanes", l: "SWIMLANES" },
          ] as const}
        />
      </>
    ),
  };

  return (
    <EnterprisePage kind="worklist"
      identity={
        <ShellIdentity
          tag="PIPELINE"
          badges={
            <>
              {live ? (
                <ToggleGroup
                  size="sm"
                  className="shrink-0"
                  value={liveMode}
                  onChange={(k) => { setLiveMode(k); setSelected(null); }}
                  options={[
                    { k: true, l: "LIVE", title: "Live CP-X run for the reference issuer" },
                    { k: false, l: "DEMO", title: "Offline route-template demo" },
                  ]}
                />
              ) : null}
              {/* When no live run exists the LIVE/DEMO toggle above doesn't
                  render, so mark the seeded run id explicitly — it must never
                  read as a live run beside the worklist's live "0 runs" count. */}
              {!useLive && !live ? <Tag sev="idle">DEMO</Tag> : null}
              <span className="tabular text-caos-xs text-caos-accent whitespace-nowrap">{runIdLabel}</span>
              {freshnessRunId ? <FreshnessIndicator evaluation={selectedRunFreshness} /> : null}
            </>
          }
          title={<>{issuerName}{issuerModeSuffix}</>}
        />
      }
      primaryAction={
        <Link
          href={openRunHref}
          title="Open the selected run in Deep-Dive"
          className="caos-action-primary no-underline focus-ring"
        >
          OPEN SELECTED RUN
        </Link>
      }
      status={<AnalysisContextSaveState analysis={analysis} />}
      contextualControls={
        <Link
          href={analysis.context ? contextHref("/upload", analysis.context.id, { issuer: issuerId }) : `/upload?issuer=${encodeURIComponent(issuerId)}`}
          className="caos-action-secondary no-underline focus-ring"
        >
          Document intake
        </Link>
      }
      utilityLabel="Run display controls"
      utilityControls={
        <>
          {/* CP-X route template switcher (demo mode only) */}
          {!useLive ? (
            <ToggleGroup
              size="sm"
              className="shrink-0"
              value={modeK}
              onChange={(k) => { setModeK(k); setSelected(null); }}
              options={RUN_MODES.map((m) => ({ k: m.k, l: m.label, title: m.title }))}
            />
          ) : null}
          <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap truncate hidden 2xl:inline">
            {useLive ? live!.summary : mode.sub}
          </span>
          <div className="w-44 flex items-center gap-2 shrink-0">
            <Bar pct={total ? (completed / total) * 100 : 0} color="var(--caos-accent)" />
            <span className="tabular text-caos-md text-caos-muted whitespace-nowrap">{completed}/{total}</span>
          </div>
          <Tag sev={clearance.tag}>{clearance.text}</Tag>
          {!useLive ? <SimControls run={run} /> : null}
          {!useLive ? <span className="tabular text-caos-md text-caos-muted whitespace-nowrap hidden 2xl:inline">{run.clock} ET</span> : null}
          <ToggleGroup
            className="shrink-0"
            value={view}
            onChange={setView}
            options={[
              { k: "graph", l: "DAG" },
              { k: "lanes", l: "SWIMLANES" },
            ] as const}
          />
          <button
            onClick={() => setDimCompleted(!dimCompleted)}
            title="Dim completed nodes"
            className={
              "tabular text-caos-xs px-1.5 h-6 rounded border transition-caos whitespace-nowrap shrink-0 focus-ring " +
              (dimCompleted ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
            }
          >
            DIM ✓
          </button>
        </>
      }
      narrowContract={narrowContract}
    >
      <div className="caos-persona-route pipeline-workbench flex-1 min-h-0">
      <PersonaWorkbench surface="pipeline" primary={<div className="h-full min-h-0 flex flex-col">
      <WorkbenchToolbar
        title="Run worklist"
        description="Inspect stage clearance, failures and evidence for the selected analysis run."
        count={useLive
          ? `${runRows.length} runs · ${completed}/${total} modules`
          : `${runRows.length} live runs · demo route ${completed}/${total} modules`}
        viewLabel={useLive ? "Live run" : "Demo route"}
      />
      <DominantTableRegion ownerId="pipeline-run-worklist" label="Recent analysis runs" className="shrink-0">
      <PipelineRunWorklist
        runs={runRows}
        selectedRunId={runParam}
        unavailable={runRowsError}
        loading={runRowsLoading}
        onSelect={selectRun}
      />
      </DominantTableRegion>
      {liveIsPartial ? (
        <PanelShell
          title="Persisted execution snapshot"
          className="shrink-0 mx-2"
          right={<Tag sev={live!.status === "failed" ? "blocked" : "running"}>{live!.status === "failed" ? "FAILED · PARTIAL" : "RUNNING · PARTIAL"}</Tag>}
        >
          <div className="p-2 grid gap-2">
            <p className="text-caos-xs text-caos-muted leading-snug">
              This is the persisted subset of the selected run, not a completed route simulation. Produced rows remain inspectable; pending rows have not produced output.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Tag sev="ok">produced {live!.produced}</Tag>
              <Tag sev="idle">pending {live!.pending}</Tag>
              <Tag sev={partialBlocked.length ? "blocked" : "idle"}>blocked {partialBlocked.length}</Tag>
            </div>
            {partialBlocked.length ? <div className="grid gap-1 border-t border-caos-border pt-2">
              {partialBlocked.map((blocked) => (
                <div key={blocked.moduleId} className="flex flex-wrap items-center gap-2 text-caos-xs">
                  <Tag sev="blocked">{blocked.moduleId} blocked</Tag>
                  <span className="text-caos-muted">{blocked.reason ?? "Persisted block reason unavailable."}</span>
                  {blocked.reason ? <Link href={rerunHref} className="caos-action-secondary no-underline focus-ring">Prepare re-run</Link> : null}
                </div>
              ))}
            </div> : null}
          </div>
        </PanelShell>
      ) : null}
      <PipelineWorkspace
        view={view}
        sim={sim}
        selected={selected}
        setSelected={setSelected}
        dimCompleted={dimCompleted}
        scope={scope}
        openModule={openModule}
        run={run}
        plan={plan}
        modeLabel={modeLabel}
        useLive={useLive}
        mode={mode}
        liveLineage={liveRun.liveOuts["CP-5B"]}
        liveLineageLoading={liveRun.loading || liveRun.phase === "loading"}
        pickDriver={pickDriver}
        setEvModal={setEvModal}
      />
      </div>} />
      </div>

      {evModal ? <EvidenceModal id={evModal} reports={reports} live={liveRun.liveEvidence} isLiveRun={!isReference && !!liveRun.runId} onClose={() => setEvModal(null)} /> : null}
    </EnterprisePage>
  );
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
  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      <SubHeader
        identity={<ShellIdentity tag="PIPELINE" title="Run state" />}
        contextualControls={<Tag sev={cfg.tag}>{cfg.head.toUpperCase()}</Tag>}
      />
      <div className="flex-1 min-h-0 flex items-center justify-center p-6">
        <SurfaceState
          kind={cfg.kind}
          title={cfg.head}
          detail={cfg.body}
          supporting={<div className="tabular text-caos-3xs text-caos-muted truncate">issuer {issuerId}</div>}
          className="max-w-md w-full"
          primaryAction={<Link href="/upload" className="caos-action-primary no-underline focus-ring">Document intake</Link>}
          secondaryAction={<Link href={`/pipeline?issuer=${ATLF_REFERENCE_ISSUER_ID}`} className="caos-action-secondary no-underline focus-ring">View reference demo</Link>}
        />
      </div>
    </div>
  );
}

// Neutral loading shell for a real issuer whose run is still being fetched.
function PipelineLoadingState({ issuerId }: { issuerId: string }) {
  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      <SubHeader
        identity={<ShellIdentity tag="PIPELINE" title={issuerId} />}
        contextualControls={<Tag sev="idle">LOADING</Tag>}
      />
      <div className="flex-1 min-h-0 flex items-center justify-center p-6">
        <SurfaceState kind="loading" title="Loading run" detail={`Retrieving the latest persisted pipeline state for ${issuerId}.`} className="max-w-md w-full" />
      </div>
    </div>
  );
}

interface PipelineWorkspaceProps {
  view: "graph" | "lanes";
  sim: Sim;
  selected: string | null;
  setSelected: (v: string | null) => void;
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
  pickDriver: (d: Driver) => void;
  setEvModal: (v: string | null) => void;
}

function PipelineWorkspace({
  view,
  sim,
  selected,
  setSelected,
  dimCompleted,
  scope,
  openModule,
  run,
  plan,
  modeLabel,
  useLive,
  mode,
  liveLineage,
  liveLineageLoading,
  pickDriver,
  setEvModal,
}: PipelineWorkspaceProps) {
  const hasLiveDriverRegister = liveLineage?.sections.some((section) =>
    section.title.includes("Decision-relevant driver lineage"),
  ) ?? false;
  return (
    <div className="pipeline-workspace flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_368px] gap-2 p-2">
      <div className="pipeline-workspace__primary flex flex-col gap-2 min-h-0 min-w-0">
        <PanelShell
          title={view === "graph" ? "Execution Graph · CP-X route plan" : "Execution Swimlanes · L0 → Export"}
          className="flex-1"
          right={
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-caos-xs text-caos-muted">
                <span className="w-3 h-px" style={{ background: "var(--caos-accent)" }}></span>lineage (upstream)
              </span>
              <span className="flex items-center gap-1 text-caos-xs text-caos-muted">
                <span className="w-3 h-px" style={{ background: "var(--tranche-sub)" }}></span>consumers
              </span>
            </span>
          }
        >
          {view === "graph" ? (
            <div className="h-full overflow-auto">
              <GraphView sim={sim} selected={selected} onSelect={setSelected} dim={dimCompleted} scope={scope} onDoubleClick={openModule} />
            </div>
          ) : (
            <SwimlaneView sim={sim} selected={selected} onSelect={setSelected} scope={scope} onDoubleClick={openModule} />
          )}
        </PanelShell>
        <PanelShell
          title="Execution Trace · orchestrator event log"
          className="h-[200px] shrink-0"
          right={
            <span className="flex items-center gap-1.5">
              <Dot sev="running" pulse={run.playing && !sim.done} />
              <span className="tabular text-caos-xs text-caos-muted">{sim.events.length} events</span>
            </span>
          }
        >
          <EventLog events={sim.events} />
        </PanelShell>
      </div>
      <aside className="pipeline-workspace__inspector flex flex-col gap-2 min-h-0" aria-label="Run module inspection and lineage">
        <PanelShell title="Module Inspector" className="flex-[3]">
          <Inspector sim={sim} selected={selected} plan={plan} scope={scope} modeLabel={modeLabel} isLive={useLive} onOpen={openModule} />
        </PanelShell>
        <PanelShell
          title={useLive
            ? "Data Lineage · CP-5B decision-relevant drivers"
            : mode.drivers
              ? `Data Lineage · CP-5B drivers in scope (${mode.drivers.length}/5)`
              : "Data Lineage · CP-5B decision-relevant drivers"}
          className="flex-[2]"
          right={useLive
            ? <Tag sev={hasLiveDriverRegister ? "ok" : "idle"}>{hasLiveDriverRegister ? "live persisted" : "unavailable"}</Tag>
            : <Tag sev="idle">seeded reference · demo</Tag>}
        >
          {useLive ? (
            <LiveLineagePanel output={liveLineage} loading={liveLineageLoading} onOpenEvidence={setEvModal} />
          ) : (
            <LineagePanel drivers={mode.drivers} onPick={pickDriver} onOpenEvidence={setEvModal} />
          )}
        </PanelShell>
      </aside>
    </div>
  );
}
