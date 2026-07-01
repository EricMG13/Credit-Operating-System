"use client";

// Concept B — The Pipeline Visualizer: the CP-X route graph as a live DAG.
// Run-mode templates (COMMITTEE / EARNINGS / LEGAL / RV), upstream/downstream
// lineage tracing, module inspector, CP-5B driver lineage with E-xx evidence,
// QA gating on CP-5, and the orchestrator event log.

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { EvidenceModal } from "@/components/reports/EvidenceModal";
import { buildReports } from "@/lib/reports/builders";
import { listRuns } from "@/lib/api";
import { MODULES, RUN_MODES, type Driver, type RunMode, type PlanStep } from "@/lib/pipeline/data";
import { useSimRun, type SimRun } from "@/lib/pipeline/sim";
import { useLivePipelineStatus, type LivePipeline } from "@/lib/pipeline/useLivePipeline";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";
import { Bar, Dot, SimControls, Tag, ToggleGroup } from "@/components/pipeline/atoms";
import { EventLog, GraphView, Inspector, LineagePanel, SwimlaneView } from "@/components/pipeline/views";
import { deriveClearance, type Clearance } from "@/lib/pipeline/clearance";
import { Panel as PanelShell } from "@/components/shared/Panel";
import type { Sim } from "@/lib/pipeline/sim-engine";

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

function PipelineVisualizer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const issuerParam = searchParams.get("issuer");
  const [latestLiveIssuer, setLatestLiveIssuer] = useState<string | null>(null);
  const [view, setView] = useViewPreference("graph");

  useEffect(() => {
    const onCycle = (e: Event) => {
      const customEvent = e as CustomEvent<{ direction: number }>;
      const dir = customEvent.detail?.direction || 1;
      const views = ["graph", "lanes"] as const;
      setView((curr) => {
        const idx = views.indexOf(curr);
        const nextIdx = (idx + dir + views.length) % views.length;
        return views[nextIdx];
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
    if (issuerParam) { setLatestLiveIssuer(null); return; }
    let stale = false;
    listRuns()
      .then((runs) => { if (!stale) setLatestLiveIssuer(runs.find((r) => r.status === "complete")?.issuer_id ?? null); })
      .catch(() => { if (!stale) setLatestLiveIssuer(null); });
    return () => { stale = true; };
  }, [issuerParam]);

  // Prefer the requested issuer, otherwise the newest complete live run; fall
  // back to the ATLF reference demo when no live run is available.
  const issuerId = issuerParam || latestLiveIssuer || ATLF_REFERENCE_ISSUER_ID;
  const isReference = issuerId === ATLF_REFERENCE_ISSUER_ID;
  const { value: live, phase, latest } = useLivePipelineStatus(issuerId);
  const [liveMode, setLiveMode] = useState(true);
  const useLive = liveMode && live != null;
  // Fail-open guard: for a *real* issuer the analyst opened expecting their run,
  // a genuine error / an in-flight (queued·running·failed) run / no coverage must
  // NOT silently render the animated green-PASS demo. Show an honest state instead.
  // The ATLF reference issuer keeps the demo — it is the labelled showcase.
  const blockingState: "error" | "in_flight" | "none" | null =
    !isReference && liveMode && phase !== "complete" && phase !== "loading"
      ? phase
      : null;

  const sim = useLive ? live!.sim : run.sim;
  const scope = useLive ? live!.scope : simScope;
  const plan = useLive ? live!.plan : mode.plan;
  const completed = useLive ? live!.completed : run.completed;
  const total = useLive ? live!.total : run.total;
  const modeLabel = useLive ? "LIVE" : mode.label;



  const cp5 = sim.mods["CP-5"]?.state || "idle";
  const clearance = deriveClearance({ useLive, live, cp5, modeDone: mode.done });

  const pickDriver = (d: Driver) => {
    const mod = d.lineage.match(/CP-[0-9A-Z]+/);
    if (mod) setSelected(mod[0]);
  };

  // Double-click a module → its output register in the Concept C deep-dive.
  // CP-0 is the L0 intake stage, so it opens Document Intake; INFRA nodes
  // produce the committee pack itself, so they land on Concept E.
  const openModule = (id: string) => {
    if (id === "CP-0") { router.push("/upload"); return; }
    const infra = MODULES.find((m) => m.id === id)?.layer === "INFRA";
    const q = `issuer=${encodeURIComponent(issuerId)}`;
    router.push(infra ? `/reports?${q}` : `/deepdive?${q}&mod=${id}`);
  };

  // A real issuer's run errored / is mid-flight / never ran — render an honest
  // state, never the fabricated green-PASS demo monitor under their name.
  if (blockingState) {
    return <PipelineRunState state={blockingState} issuerId={issuerId} runStatus={latest?.status ?? null} />;
  }

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      <PipelineHeader
        live={live}
        liveMode={liveMode}
        setLiveMode={setLiveMode}
        setSelected={setSelected}
        useLive={useLive}
        modeK={modeK}
        setModeK={setModeK}
        mode={mode}
        issuerId={issuerId}
        total={total}
        completed={completed}
        clearance={clearance}
        run={run}
        view={view}
        setView={setView}
        dimCompleted={dimCompleted}
        setDimCompleted={setDimCompleted}
      />

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
        pickDriver={pickDriver}
        setEvModal={setEvModal}
      />

      {evModal ? <EvidenceModal id={evModal} reports={reports} onClose={() => setEvModal(null)} /> : null}
    </div>
  );
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
      tag: "critical" as const, glyph: "warning" as const, head: "Run status unavailable",
      body: "Couldn't reach the run service for this issuer. This is a connection or backend error — not a passing run. Retry, or check the service.",
    },
    in_flight: {
      tag: "warning" as const, glyph: "locked" as const, head: "Run in progress",
      body: runStatus === "failed"
        ? "The latest run for this issuer did not complete (failed). No cleared committee output is available — re-run the pipeline."
        : "A run for this issuer is queued or executing. The route graph populates once it completes — no cleared output yet.",
    },
    none: {
      tag: "idle" as const, glyph: "locked" as const, head: "No runs for this issuer",
      body: "This issuer has never been analysed. Start a run from Document Intake to populate the CP-X route graph.",
    },
  }[state];
  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      <div className="h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-3 px-4">
        <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-caos-xl transition-caos whitespace-nowrap">
          ← Directory
        </Link>
        <div className="h-4 w-px bg-caos-border" />
        <ConceptNav compact />
        <div className="flex-1" />
        <Tag sev={cfg.tag}>{cfg.head.toUpperCase()}</Tag>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-6">
        <div role="alert" className="max-w-md w-full flex flex-col gap-3 rounded-lg border border-caos-border bg-caos-panel p-7 text-center">
          <div className="flex items-center justify-center gap-2" style={{ color: `var(--caos-${cfg.tag === "critical" ? "critical" : cfg.tag === "warning" ? "warning" : "muted"})` }}>
            <StatusGlyph kind={cfg.glyph} size={14} />
            <span className="tabular text-caos-sm uppercase tracking-[0.2em]">{state === "error" ? "Error" : state === "in_flight" ? "Pending" : "Empty"}</span>
          </div>
          <h1 className="text-caos-text text-lg font-semibold">{cfg.head}</h1>
          <p className="text-caos-muted text-caos-md leading-relaxed">{cfg.body}</p>
          <div className="flex items-center justify-center gap-2 mt-1">
            <Link href="/upload" className="tabular text-caos-sm px-2.5 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos">
              ↑ DOCUMENT INTAKE
            </Link>
            <Link href={`/pipeline?issuer=${ATLF_REFERENCE_ISSUER_ID}`} className="tabular text-caos-sm px-2.5 py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos">
              VIEW REFERENCE DEMO
            </Link>
          </div>
          <div className="tabular text-caos-3xs text-caos-muted mt-1 truncate">issuer {issuerId}</div>
        </div>
      </div>
    </div>
  );
}

interface PipelineHeaderProps {
  live: LivePipeline | null;
  liveMode: boolean;
  setLiveMode: (v: boolean) => void;
  setSelected: (v: string | null) => void;
  useLive: boolean;
  modeK: string;
  setModeK: (v: string) => void;
  mode: RunMode;
  issuerId: string;
  total: number;
  completed: number;
  clearance: Clearance;
  run: SimRun;
  view: "graph" | "lanes";
  setView: (v: "graph" | "lanes") => void;
  dimCompleted: boolean;
  setDimCompleted: (v: boolean) => void;
}

function PipelineHeader({
  live,
  liveMode,
  setLiveMode,
  setSelected,
  useLive,
  modeK,
  setModeK,
  mode,
  issuerId,
  total,
  completed,
  clearance,
  run,
  view,
  setView,
  dimCompleted,
  setDimCompleted,
}: PipelineHeaderProps) {
  return (
    <div className="h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-3 px-4">
      <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-caos-xl transition-caos whitespace-nowrap">
        ← Directory
      </Link>
      <div className="h-4 w-px bg-caos-border" />
      <ConceptNav compact />
      <div className="h-4 w-px bg-caos-border" />
      {/* Live vs. offline-demo source (only when a live run exists) */}
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
      <Link
        href="/upload"
        title="L0 · Document Intake — add source documents (CP-0) that feed this route"
        className="no-underline flex items-center gap-1 tabular text-caos-xs px-1.5 h-6 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos whitespace-nowrap shrink-0"
      >
        ↑ L0 INTAKE
      </Link>
      <span className="tabular text-caos-md text-caos-accent whitespace-nowrap hidden 2xl:inline">{useLive ? `RUN ${live!.runId.slice(0, 8)}` : mode.runId}</span>
      <span className="text-caos-xl text-caos-text font-medium whitespace-nowrap truncate min-w-0">{useLive ? (issuerId === ATLF_REFERENCE_ISSUER_ID ? "Atlas Forge — live CP-X run" : "Live CP-X run") : "Atlas Forge — " + mode.title}</span>
      <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap truncate hidden 2xl:inline">{useLive ? live!.summary : mode.sub}</span>
      <div className="w-44 flex items-center gap-2 shrink-0">
        <Bar pct={total ? (completed / total) * 100 : 0} color="var(--caos-accent)" />
        <span className="tabular text-caos-md text-caos-muted whitespace-nowrap">{completed}/{total}</span>
      </div>
      <div className="flex-1" />
      <Tag sev={clearance.tag}>{clearance.text}</Tag>
      {!useLive ? <SimControls run={run} /> : null}
      {!useLive ? <span className="tabular text-caos-md text-caos-muted whitespace-nowrap hidden 2xl:inline">{run.clock} ET</span> : null}
      <ToggleGroup
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
          "tabular text-caos-xs px-1.5 h-6 rounded border transition-caos whitespace-nowrap " +
          (dimCompleted ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
        }
      >
        DIM ✓
      </button>
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
  pickDriver,
  setEvModal,
}: PipelineWorkspaceProps) {
  return (
    <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_368px] gap-2 p-2">
      <div className="flex flex-col gap-2 min-h-0 min-w-0">
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
      <div className="flex flex-col gap-2 min-h-0">
        <PanelShell title="Module Inspector" className="flex-[3]">
          <Inspector sim={sim} selected={selected} plan={plan} scope={scope} modeLabel={modeLabel} isLive={useLive} />
        </PanelShell>
        <PanelShell
          title={mode.drivers ? `Data Lineage · CP-5B drivers in scope (${mode.drivers.length}/5)` : "Data Lineage · CP-5B top-5 material drivers"}
          className="flex-[2]"
          // The CP-5B driver register is a seeded ATLF fixture; don't stamp
          // "auditability STRONG" over a live run whose lineage it doesn't reflect.
          right={useLive ? <Tag sev="idle">reference fixture</Tag> : <Tag sev="ok">auditability STRONG</Tag>}
        >
          {useLive ? (
            <div className="px-3 py-2 text-caos-md text-caos-muted leading-relaxed">
              CP-5B driver lineage is not yet wired for live runs — the seeded driver
              register reflects the ATLF reference deal, not this run. Open a module
              node to inspect its live payload, QA findings and propagated limitations.
            </div>
          ) : (
            <LineagePanel drivers={mode.drivers} onPick={pickDriver} onOpenEvidence={setEvModal} />
          )}
        </PanelShell>
      </div>
    </div>
  );
}
