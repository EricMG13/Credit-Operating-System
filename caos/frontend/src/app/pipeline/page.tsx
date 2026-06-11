"use client";

// Concept B — The Pipeline Visualizer: the CP-X route graph as a live DAG.
// Run-mode templates (COMMITTEE / EARNINGS / LEGAL / RV), upstream/downstream
// lineage tracing, module inspector, CP-5B driver lineage with E-xx evidence,
// QA gating on CP-5, and the orchestrator event log.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { EvidenceModal } from "@/components/reports/EvidenceModal";
import { buildReports } from "@/lib/reports/builders";
import { RUN_MODES, type Driver } from "@/lib/pipeline/data";
import { useSimRun } from "@/lib/pipeline/sim";
import { Bar, Dot, SimControls, Tag } from "@/components/pipeline/atoms";
import { EventLog, GraphView, Inspector, LineagePanel, SwimlaneView } from "@/components/pipeline/views";
import { Panel as PanelShell } from "@/components/shared/Panel";

export default function PipelinePage() {
  return (
    <RequireAuth>
      <PipelineVisualizer />
    </RequireAuth>
  );
}


function PipelineVisualizer() {
  const [view, setView] = useState<"graph" | "lanes">("graph");
  const [modeK, setModeK] = useState("full");
  const [dimCompleted, setDimCompleted] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [evModal, setEvModal] = useState<string | null>(null);

  const mode = RUN_MODES.find((m) => m.k === modeK)!;
  const scope = useMemo(() => new Set(mode.plan.map((p) => p.id)), [mode]);
  const run = useSimRun({ autoplay: true, plan: mode.plan, complete: mode.complete });
  const reports = useMemo(() => buildReports(), []);

  // persist view preference
  useEffect(() => {
    const v = localStorage.getItem("caos-b-view");
    if (v === "graph" || v === "lanes") setView(v);
  }, []);
  useEffect(() => { try { localStorage.setItem("caos-b-view", view); } catch {} }, [view]);

  const cp5 = run.sim.mods["CP-5"]?.state || "idle";
  const clearance = ["pass", "warning", "held"].includes(cp5) ? mode.done
    : cp5 === "running" ? { tag: "running", text: "CP-5 QA audit in progress…" }
    : { tag: "idle", text: "CLEARANCE: pending upstream completion" };

  const pickDriver = (d: Driver) => {
    const mod = d.lineage.match(/CP-[0-9A-Z]+/);
    if (mod) setSelected(mod[0]);
  };

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <div className="h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-3 px-4">
        <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-[11px] transition-caos whitespace-nowrap">
          ← Directory
        </Link>
        <div className="h-4 w-px bg-caos-border" />
        <ConceptNav compact />
        <div className="h-4 w-px bg-caos-border" />
        {/* CP-X route template switcher */}
        <div className="flex items-center rounded border border-caos-border overflow-hidden shrink-0">
          {RUN_MODES.map((m) => (
            <button
              key={m.k}
              onClick={() => { setModeK(m.k); setSelected(null); }}
              title={m.title}
              className={
                "tabular text-[9.5px] px-2.5 py-[7px] transition-caos whitespace-nowrap " +
                (modeK === m.k ? "bg-caos-elevated text-caos-text" : "text-caos-muted hover:text-caos-text")
              }
            >
              {m.label}
            </button>
          ))}
        </div>
        <span className="tabular text-[10px] text-caos-accent whitespace-nowrap hidden 2xl:inline">{mode.runId}</span>
        <span className="text-[11px] text-caos-text font-medium whitespace-nowrap truncate min-w-0">Atlas Forge — {mode.title}</span>
        <span className="tabular text-[9.5px] text-caos-muted whitespace-nowrap truncate hidden 2xl:inline">{mode.sub}</span>
        <div className="w-44 flex items-center gap-2 shrink-0">
          <Bar pct={(run.completed / run.total) * 100} color="var(--caos-accent)" />
          <span className="tabular text-[10px] text-caos-muted whitespace-nowrap">{run.completed}/{run.total}</span>
        </div>
        <div className="flex-1" />
        <Tag sev={clearance.tag}>{clearance.text}</Tag>
        <SimControls run={run} />
        <span className="tabular text-[10px] text-caos-muted whitespace-nowrap hidden 2xl:inline">{run.clock} ET</span>
        <div className="flex items-center rounded border border-caos-border overflow-hidden">
          {([
            { k: "graph", l: "DAG" },
            { k: "lanes", l: "SWIMLANES" },
          ] as const).map((v) => (
            <button
              key={v.k}
              onClick={() => setView(v.k)}
              className={
                "tabular text-[10px] px-3 py-1.5 transition-caos " +
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
            "tabular text-[9px] px-1.5 h-6 rounded border transition-caos whitespace-nowrap " +
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
                <span className="flex items-center gap-1 text-[9px] text-caos-muted">
                  <span className="w-3 h-px" style={{ background: "var(--caos-accent)" }}></span>lineage (upstream)
                </span>
                <span className="flex items-center gap-1 text-[9px] text-caos-muted">
                  <span className="w-3 h-px" style={{ background: "#a855f7" }}></span>consumers
                </span>
              </span>
            }
          >
            {view === "graph" ? (
              <div className="h-full overflow-auto">
                <GraphView sim={run.sim} selected={selected} onSelect={setSelected} dim={dimCompleted} scope={scope} />
              </div>
            ) : (
              <SwimlaneView sim={run.sim} selected={selected} onSelect={setSelected} scope={scope} />
            )}
          </PanelShell>
          <PanelShell
            title="Execution Trace · orchestrator event log"
            className="h-[200px] shrink-0"
            right={
              <span className="flex items-center gap-1.5">
                <Dot sev="running" pulse={run.playing && !run.sim.done} />
                <span className="tabular text-[9px] text-caos-muted">{run.sim.events.length} events</span>
              </span>
            }
          >
            <EventLog events={run.sim.events} />
          </PanelShell>
        </div>
        <div className="flex flex-col gap-2 min-h-0">
          <PanelShell title="Module Inspector" className="flex-[3]">
            <Inspector sim={run.sim} selected={selected} plan={mode.plan} scope={scope} modeLabel={mode.label} />
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
