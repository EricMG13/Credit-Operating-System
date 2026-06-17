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
import { EvidenceModal } from "@/components/reports/EvidenceModal";
import { buildReports } from "@/lib/reports/builders";
import { MODULES, RUN_MODES, type Driver } from "@/lib/pipeline/data";
import { useSimRun } from "@/lib/pipeline/sim";
import { useLivePipeline } from "@/lib/pipeline/useLivePipeline";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";
import { Bar, Dot, SimControls, Tag } from "@/components/pipeline/atoms";
import { EventLog, GraphView, Inspector, LineagePanel, SwimlaneView } from "@/components/pipeline/views";
import { Panel as PanelShell } from "@/components/shared/Panel";

export default function PipelinePage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <PipelineVisualizer />
      </Suspense>
    </RequireAuth>
  );
}


function PipelineVisualizer() {
  const router = useRouter();
  const [view, setView] = useState<"graph" | "lanes">("graph");
  const [modeK, setModeK] = useState("full");
  const [dimCompleted, setDimCompleted] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [evModal, setEvModal] = useState<string | null>(null);

  const mode = RUN_MODES.find((m) => m.k === modeK)!;
  const simScope = useMemo(() => new Set(mode.plan.map((p) => p.id)), [mode]);
  const run = useSimRun({ autoplay: true, plan: mode.plan, complete: mode.complete });
  const reports = useMemo(() => buildReports(), []);

  // Prefer the live CP-X run for ?issuer=<id> (the reference issuer by default);
  // fall back to the offline sim demo when there's no run / no backend.
  const issuerId = useSearchParams().get("issuer") || ATLF_REFERENCE_ISSUER_ID;
  const live = useLivePipeline(issuerId);
  const [liveMode, setLiveMode] = useState(true);
  const useLive = liveMode && live != null;

  const sim = useLive ? live!.sim : run.sim;
  const scope = useLive ? live!.scope : simScope;
  const plan = useLive ? live!.plan : mode.plan;
  const completed = useLive ? live!.completed : run.completed;
  const total = useLive ? live!.total : run.total;
  const modeLabel = useLive ? "LIVE" : mode.label;

  // persist view preference — write only after restore so the mount-time
  // default can't clobber the stored choice
  const [viewHydrated, setViewHydrated] = useState(false);
  useEffect(() => {
    const v = localStorage.getItem("caos-b-view");
    if (v === "graph" || v === "lanes") setView(v);
    setViewHydrated(true);
  }, []);
  useEffect(() => { if (viewHydrated) try { localStorage.setItem("caos-b-view", view); } catch {} }, [viewHydrated, view]);

  const cp5 = sim.mods["CP-5"]?.state || "idle";
  // Live: the headline is the run's QA verdict (committee_status), not the CP-X
  // route gate — a Blocked run must never read "Full Run".
  const liveClear = useLive
    ? live!.committeeStatus === "Blocked"
      ? { tag: "critical", text: "CLEARANCE: BLOCKED" }
      : live!.committeeStatus === "Restricted"
      ? { tag: "warning", text: "CLEARANCE: RESTRICTED" }
      : live!.committeeStatus === "Committee Ready"
      ? { tag: "ok", text: `CLEARANCE: COMMITTEE READY · ${live!.gateStatus}` }
      : { tag: "idle", text: `CLEARANCE: ${live!.committeeStatus}` }
    : null;
  const clearance = liveClear
    ? liveClear
    : ["pass", "warning", "held"].includes(cp5) ? mode.done
    : cp5 === "running" ? { tag: "running", text: "CP-5 QA audit in progress…" }
    : { tag: "idle", text: "CLEARANCE: pending upstream completion" };

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
    router.push(infra ? "/reports" : `/deepdive?mod=${id}`);
  };

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <div className="h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-3 px-4">
        <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-caos-xl transition-caos whitespace-nowrap">
          ← Directory
        </Link>
        <div className="h-4 w-px bg-caos-border" />
        <ConceptNav compact />
        <div className="h-4 w-px bg-caos-border" />
        {/* Live vs. offline-demo source (only when a live run exists) */}
        {live ? (
          <div className="flex items-center rounded border border-caos-border overflow-hidden shrink-0">
            {([{ k: true, l: "LIVE" }, { k: false, l: "DEMO" }] as const).map((o) => (
              <button
                key={String(o.k)}
                onClick={() => { setLiveMode(o.k); setSelected(null); }}
                title={o.k ? "Live CP-X run for the reference issuer" : "Offline route-template demo"}
                className={
                  "tabular text-caos-sm px-2.5 py-[7px] transition-caos whitespace-nowrap " +
                  (liveMode === o.k ? "bg-caos-elevated text-caos-text" : "text-caos-muted hover:text-caos-text")
                }
              >
                {o.l}
              </button>
            ))}
          </div>
        ) : null}
        {/* CP-X route template switcher (demo mode only) */}
        {!useLive ? (
          <div className="flex items-center rounded border border-caos-border overflow-hidden shrink-0">
            {RUN_MODES.map((m) => (
              <button
                key={m.k}
                onClick={() => { setModeK(m.k); setSelected(null); }}
                title={m.title}
                className={
                  "tabular text-caos-sm px-2.5 py-[7px] transition-caos whitespace-nowrap " +
                  (modeK === m.k ? "bg-caos-elevated text-caos-text" : "text-caos-muted hover:text-caos-text")
                }
              >
                {m.label}
              </button>
            ))}
          </div>
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
        <div className="flex items-center rounded border border-caos-border overflow-hidden">
          {([
            { k: "graph", l: "DAG" },
            { k: "lanes", l: "SWIMLANES" },
          ] as const).map((v) => (
            <button
              key={v.k}
              onClick={() => setView(v.k)}
              className={
                "tabular text-caos-md px-3 py-1.5 transition-caos " +
                (view === v.k ? "bg-caos-elevated text-caos-text" : "text-caos-muted hover:text-caos-text")
              }
            >
              {v.l}
            </button>
          ))}
        </div>
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

      {/* workspace */}
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
            <Inspector sim={sim} selected={selected} plan={plan} scope={scope} modeLabel={modeLabel} />
          </PanelShell>
          <PanelShell
            title={mode.drivers ? `Data Lineage · CP-5B drivers in scope (${mode.drivers.length}/5)` : "Data Lineage · CP-5B top-5 material drivers"}
            className="flex-[2]"
            right={<Tag sev="ok">auditability STRONG</Tag>}
          >
            <LineagePanel drivers={mode.drivers} onPick={pickDriver} onOpenEvidence={setEvModal} />
          </PanelShell>
        </div>
      </div>

      {evModal ? <EvidenceModal id={evModal} reports={reports} onClose={() => setEvModal(null)} /> : null}
    </div>
  );
}
