"use client";

// Concept C — The Analytical Deep-Dive: three-pane split for the Atlas Forge
// SSN review. Source register + CP-5B evidence rail · full L0–L6 module
// launcher (bespoke CP-6A debate / CP-3B recovery / CP-4 covenants tabs +
// generic module views with clickable step-output registers) · IC verdict,
// CP-6E sizing and armed monitoring triggers. Loads complete; reset replays
// the run and outputs unlock as their producing modules clear.

import { useMemo, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { EvidenceModal } from "@/components/reports/EvidenceModal";
import { buildReports } from "@/lib/reports/builders";
import { DEAL } from "@/lib/reports/deal";
import { MODULES, SIM_PLAN } from "@/lib/pipeline/data";
import { useSimRun } from "@/lib/pipeline/sim";
import { Dot, SimControls } from "@/components/pipeline/atoms";
import { CovenantsTab, DebateTab, ModuleView, RecoveryTab } from "@/components/deepdive/tabs";
import { DecisionRail, Panel, SourceRail } from "@/components/deepdive/rails";
import { IssuerChat } from "@/components/deepdive/IssuerChat";

export default function DeepDivePage() {
  return (
    <RequireAuth>
      <DeepDive />
    </RequireAuth>
  );
}

const BESPOKE: Record<string, { label: string; code: string }> = {
  "CP-6A": { label: "Adversarial Debate", code: "CP-6A" },
  "CP-3B": { label: "Recovery Waterfall", code: "CP-3B" },
  "CP-4": { label: "Legal & Covenants", code: "CP-4 / 4C" },
};
const GATE: Record<string, string> = { "CP-4": "CP-4C" };
const GROUPS = [
  { label: "L0 · ORCH", mods: ["CP-0", "CP-X"] },
  { label: "L1 BASE", mods: ["CP-1", "CP-1A", "CP-1B", "CP-1C"] },
  { label: "L2 SYNTHESIS", mods: ["CP-2", "CP-2B", "CP-2C", "CP-2D", "CP-2E", "CP-2F"] },
  { label: "L3 REL VALUE", mods: ["CP-3", "CP-3B", "CP-3C", "CP-3D"] },
  { label: "L4 LEGAL", mods: ["CP-4"] },
  { label: "L5 GOV", mods: ["CP-5B", "CP-5"] },
  { label: "L6 DEBATE", mods: ["CP-6A", "CP-6E"] },
];

function DeepDive() {
  const [tab, setTab] = useState("CP-6A");
  const [evModal, setEvModal] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(true);
  const [decisionOpen, setDecisionOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const run = useSimRun({ prefill: true, plan: SIM_PLAN });
  const reports = useMemo(() => buildReports(), []);

  const gateState = (id: string) => run.sim.mods[id]?.state || "idle";
  const meta = MODULES.find((m) => m.id === tab);
  const bespoke = BESPOKE[tab];
  const gateId = GATE[tab] || tab;
  const unlocked = ["pass", "warning"].includes(gateState(gateId));
  const title = bespoke ? bespoke.label + " · " + bespoke.code : (meta?.name || tab) + " · " + tab;

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <div className="h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-4 px-4">
        <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-[11px] transition-caos whitespace-nowrap">
          ← Directory
        </Link>
        <div className="h-4 w-px bg-caos-border" />
        <ConceptNav compact />
        <div className="h-4 w-px bg-caos-border" />
        <span className="text-[11px] text-caos-text font-medium whitespace-nowrap">{DEAL.deal}</span>
        <span className="tabular text-[9.5px] text-caos-muted whitespace-nowrap">RUN #2641 · {run.completed}/{run.total} modules complete</span>
        <div className="flex-1"></div>
        <span className="tabular text-[9px] text-caos-muted hidden xl:inline">click any E-xx chip to open its source · replay run to watch outputs unlock →</span>
        <SimControls run={run} />
      </div>

      {/* module launcher strip */}
      <div className="h-9 shrink-0 border-b border-caos-border bg-caos-panel/40 flex items-center px-4 gap-3 overflow-x-auto">
        <span className="tabular text-[8.5px] uppercase tracking-widest text-caos-muted whitespace-nowrap">Module outputs</span>
        {GROUPS.map((g) => (
          <div key={g.label} className="flex items-center gap-1 pl-3 border-l border-caos-border">
            <span className="tabular text-[8.5px] text-caos-muted/70 whitespace-nowrap mr-0.5">{g.label}</span>
            {g.mods.map((id) => {
              const st = gateState(GATE[id] || id);
              const ok = ["pass", "warning"].includes(st);
              const sel = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  title={MODULES.find((m) => m.id === id)?.name}
                  className={
                    "flex items-center gap-1.5 tabular text-[9.5px] px-2 py-1 rounded border transition-caos whitespace-nowrap " +
                    (sel ? "bg-caos-elevated text-caos-text border-caos-accent" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
                  }
                  style={{ opacity: ok || sel ? 1 : 0.55 }}
                >
                  {!ok ? <span className="text-[8px]">🔒</span> : <Dot sev={st} pulse={st === "running"} />}
                  {BESPOKE[id] ? BESPOKE[id].code : id}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* three-pane workspace */}
      <div
        className="flex-1 min-h-0 grid gap-2 p-2"
        style={{ gridTemplateColumns: (railOpen ? "330px" : "42px") + " minmax(0,1fr) " + (decisionOpen ? "352px" : "42px") }}
      >
        <SourceRail ev={evModal} open={railOpen} onToggle={() => setRailOpen(!railOpen)} />
        <Panel
          title={title}
          right={
            <span className="flex items-center gap-3">
              <span className="tabular text-[9px] text-caos-muted">RUN #2641 · ATLF</span>
              <button
                onClick={() => setChatOpen(!chatOpen)}
                title="Ask follow-up questions about this issuer"
                className="tabular text-[9.5px] whitespace-nowrap px-2.5 py-1 rounded flex items-center gap-1.5 transition-caos hover:opacity-85"
                style={{ background: "var(--caos-accent)", color: "#0a0a0f", boxShadow: "0 0 14px rgba(79,140,255,0.4)" }}
              >
                ✦ ASK ATLF
              </button>
            </span>
          }
        >
          {unlocked ? (
            tab === "CP-6A" ? <DebateTab onOpenEvidence={setEvModal} /> :
            tab === "CP-3B" ? <RecoveryTab onOpenEvidence={setEvModal} /> :
            tab === "CP-4" ? <CovenantsTab onOpenEvidence={setEvModal} /> :
            <ModuleView id={tab} sim={run.sim} onOpenEvidence={setEvModal} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-caos-muted">
              <Dot sev={gateState(gateId)} pulse={gateState(gateId) === "running"} />
              <div className="tabular text-[11px]">{gateId} {gateState(gateId) === "running" ? "running…" : "awaiting upstream dependencies"}</div>
              <div className="text-[10px]">output unlocks when the producing module clears its gate</div>
            </div>
          )}
        </Panel>
        <DecisionRail open={decisionOpen} onToggle={() => setDecisionOpen(!decisionOpen)} />
      </div>

      {evModal ? <EvidenceModal id={evModal} reports={reports} onClose={() => setEvModal(null)} /> : null}
      {chatOpen ? <IssuerChat tab={tab} onClose={() => setChatOpen(false)} /> : null}
    </div>
  );
}
