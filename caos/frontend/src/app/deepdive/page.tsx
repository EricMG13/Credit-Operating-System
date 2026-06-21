"use client";

// Concept C — The Analytical Deep-Dive: three-pane split for the Atlas Forge
// 2L term-loan review. Source register + CP-5B evidence rail · full L0–L6 module
// launcher (bespoke CP-6A debate / CP-3B recovery / CP-4 covenants tabs +
// generic module views with clickable step-output registers) · IC verdict,
// CP-6E sizing and armed monitoring triggers. Loads complete; reset replays
// the run and outputs unlock as their producing modules clear.

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { EvidenceModal } from "@/components/reports/EvidenceModal";
import { ExportToVaultButton } from "@/components/reports/ExportToVaultButton";
import { buildReports } from "@/lib/reports/builders";
import { DEAL } from "@/lib/reports/deal";
import { MODULES, SIM_PLAN } from "@/lib/pipeline/data";
import { useSimRun, isCleared } from "@/lib/pipeline/sim";
import { Dot, SimControls } from "@/components/pipeline/atoms";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { FirstRunHint } from "@/components/shared/FirstRunHint";
import { EvidenceSyncProvider } from "@/lib/evidence-sync";
import { CovenantsTab, DebateTab, ModuleView, RecoveryTab } from "@/components/deepdive/tabs";
import { loadLayout, DEFAULT_LAYOUT, type DeepDiveLayout } from "@/lib/deepdive/layout-pref";
import { DecisionRail, Panel, SourceRail } from "@/components/deepdive/rails";
import { IssuerChat } from "@/components/deepdive/IssuerChat";
import { useLiveRun } from "@/lib/engine/useLiveRun";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";
import { useAsk } from "@/components/shared/Ask";

export default function DeepDivePage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <DeepDive />
      </Suspense>
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
  // CP-4C is covered inside the CP-4 "Legal & Covenants" view (code "CP-4 / 4C",
  // which renders the CP-4C register) — so it isn't a separate launcher entry.
  { label: "L4 LEGAL", mods: ["CP-4"] },
  { label: "L5 GOV", mods: ["CP-5B", "CP-5"] },
  { label: "L6 DEBATE", mods: ["CP-6A", "CP-6E"] },
];

function DeepDive() {
  const searchParams = useSearchParams();
  const modParam = searchParams.get("mod");
  const [tab, setTab] = useState(modParam || "CP-6A");
  // keep the open module in sync when the ?mod= param changes (back/forward,
  // repeated double-clicks from the Execution Graph)
  useEffect(() => { if (modParam) setTab(modParam); }, [modParam]);
  const [evModal, setEvModal] = useState<string | null>(null);
  // Layout (core / dense) is chosen in Settings; read on mount (localStorage).
  const [layout, setLayout] = useState<DeepDiveLayout>(DEFAULT_LAYOUT);
  useEffect(() => setLayout(loadLayout()), []);

  // Module-launcher accordion: each layer collapses to its name + status dots to
  // save space; clicking a layer reveals its modules (by name). The active tab's
  // layer always stays open; wide screens (≥2xl) open every layer.
  const activeLayer = GROUPS.find((g) => g.mods.includes(tab))?.label ?? null;
  const [openLayers, setOpenLayers] = useState<Set<string>>(() => new Set(activeLayer ? [activeLayer] : []));
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1536) setOpenLayers(new Set(GROUPS.map((g) => g.label)));
  }, []);
  useEffect(() => {
    if (activeLayer) setOpenLayers((prev) => (prev.has(activeLayer) ? prev : new Set(prev).add(activeLayer)));
  }, [activeLayer]);
  const toggleLayer = (l: string) => setOpenLayers((prev) => { const n = new Set(prev); if (n.has(l)) n.delete(l); else n.add(l); return n; });
  // Evidence/source rail starts collapsed: traceability is on-demand (the E-xx
  // citation chips open the source directly), so it shouldn't hold prime
  // analytical real estate by default. The analyst expands it when they want it.
  const [railOpen, setRailOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(true);
  // Issuer Q&A open-state is owned by the global Ask launcher (⌘K), so the
  // in-panel ASK ATLF button and the shortcut drive the same chat.
  const { open: chatOpen, setOpen: setChatOpen } = useAsk();
  const run = useSimRun({ prefill: true, plan: SIM_PLAN });
  const reports = useMemo(() => buildReports(), []);
  // Live engine output for the seeded ATLF deal, when a run exists. Falls back
  // to the seeded register otherwise (offline demo unaffected).
  const live = useLiveRun(ATLF_REFERENCE_ISSUER_ID);

  // Adaptivity: the decision rail (IC verdict / sizing — analytical output)
  // earns its space and restores on wide screens, but auto-collapses below
  // ~1280px so it doesn't crush the analysis column. The evidence rail is left
  // user-controlled (default collapsed, see above) — width goes to analysis.
  useEffect(() => {
    const NARROW = 1280;
    let narrow = window.innerWidth < NARROW;
    if (narrow) setDecisionOpen(false);
    const onResize = () => {
      const now = window.innerWidth < NARROW;
      if (now !== narrow) {
        narrow = now;
        setDecisionOpen(!now);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const gateState = (id: string) => run.sim.mods[id]?.state || "idle";
  const meta = MODULES.find((m) => m.id === tab);
  const bespoke = BESPOKE[tab];
  const gateId = GATE[tab] || tab;
  const unlocked = isCleared(gateState(gateId));
  const title = bespoke ? bespoke.label + " · " + bespoke.code : (meta?.name || tab) + " · " + tab;

  return (
    <EvidenceSyncProvider>
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <div className="h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-4 px-4">
        <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-caos-xl transition-caos whitespace-nowrap">
          ← Directory
        </Link>
        <div className="h-4 w-px bg-caos-border" />
        <ConceptNav compact />
        <div className="h-4 w-px bg-caos-border" />
        <span className="text-caos-xl text-caos-text font-medium truncate min-w-0">{DEAL.deal}</span>
        <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap hidden xl:inline">RUN #2641 · {run.completed}/{run.total} modules complete</span>
        <div className="flex-1"></div>
        <span className="tabular text-caos-xs text-caos-muted hidden xl:inline">click any E-xx chip to open its source · replay run to watch outputs unlock →</span>
        {live.runId ? <ExportToVaultButton runId={live.runId} /> : null}
        <span className="hidden 2xl:flex items-center shrink-0"><SimControls run={run} /></span>
      </div>

      {/* module launcher strip — each layer collapses to its name + status dots;
          click a layer to reveal its modules (named; short label on smaller panes). */}
      <div className="h-9 shrink-0 border-b border-caos-border bg-caos-panel/40 flex items-center px-4 gap-2 overflow-x-auto">
        <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap hidden lg:inline">Module outputs</span>
        {GROUPS.map((g) => {
          const open = openLayers.has(g.label);
          return (
            <div key={g.label} className="flex items-center gap-1.5 pl-2.5 border-l border-caos-border shrink-0">
              <button
                onClick={() => toggleLayer(g.label)}
                aria-expanded={open}
                title={(open ? "Collapse " : "Expand ") + g.label}
                className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-caos-elevated/50 transition-caos focus-ring"
              >
                <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted whitespace-nowrap">{g.label}</span>
                {!open ? (
                  <span className="flex items-center gap-0.5">
                    {g.mods.map((id) => {
                      const st = gateState(GATE[id] || id);
                      return isCleared(st)
                        ? <Dot key={id} sev={st} pulse={st === "running"} />
                        : <StatusGlyph key={id} kind="locked" />;
                    })}
                  </span>
                ) : null}
                <span className="tabular text-caos-2xs text-caos-muted">{open ? "▾" : "▸"}</span>
              </button>
              {open ? (
                <span className="flex items-center gap-1">
                  {g.mods.map((id) => {
                    const st = gateState(GATE[id] || id);
                    const ok = isCleared(st);
                    const sel = tab === id;
                    const name = MODULES.find((m) => m.id === id)?.name ?? id;
                    const short = name.split(" ")[0];
                    return (
                      <button
                        key={id}
                        onClick={() => setTab(id)}
                        title={name}
                        className={
                          "flex items-center gap-1.5 tabular text-caos-sm px-2 py-1 rounded border transition-caos whitespace-nowrap " +
                          (sel ? "bg-caos-elevated text-caos-text border-caos-accent" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
                        }
                        style={{ opacity: ok || sel ? 1 : 0.55 }}
                      >
                        {!ok ? <StatusGlyph kind="locked" /> : <Dot sev={st} pulse={st === "running"} />}
                        <span className="hidden 2xl:inline">{name}</span>
                        <span className="2xl:hidden">{short}</span>
                      </button>
                    );
                  })}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <FirstRunHint id="deepdive-panes" className="mx-2 mt-2 shrink-0">
        <span className="text-white font-medium">Three panes:</span> sources &amp; evidence (left) · module analysis (center) · the IC decision &amp; sizing (right). Click any{" "}
        <span className="tabular text-caos-accent">E-xx</span> chip to open its cited source.
      </FirstRunHint>

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
              <span className="tabular text-caos-xs text-caos-muted">ATLF</span>
              {live.runId ? (
                <span className="tabular text-caos-xs" style={{ color: "var(--caos-accent)" }} title="Rendering live engine output for this module">
                  ● LIVE
                </span>
              ) : null}
              <button
                onClick={() => setChatOpen(!chatOpen)}
                title="Ask follow-up questions about this issuer"
                className="tabular text-caos-sm whitespace-nowrap px-2.5 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
              >
                ASK ATLF
              </button>
            </span>
          }
        >
          {unlocked ? (
            tab === "CP-6A" ? <DebateTab onOpenEvidence={setEvModal} layout={layout} /> :
            tab === "CP-6E" ? <DebateTab variant="CP-6E" onOpenEvidence={setEvModal} layout={layout} /> :
            tab === "CP-3B" ? <RecoveryTab onOpenEvidence={setEvModal} layout={layout} /> :
            tab === "CP-4" ? <CovenantsTab onOpenEvidence={setEvModal} layout={layout} /> :
            <ModuleView id={tab} sim={run.sim} onOpenEvidence={setEvModal} liveOut={live.liveOuts[tab]} layout={layout} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-caos-muted">
              <Dot sev={gateState(gateId)} pulse={gateState(gateId) === "running"} />
              <div className="tabular text-caos-xl">{gateId} {gateState(gateId) === "running" ? "running…" : "awaiting upstream dependencies"}</div>
              <div className="text-caos-md">output unlocks when the producing module clears its gate</div>
            </div>
          )}
        </Panel>
        <DecisionRail open={decisionOpen} onToggle={() => setDecisionOpen(!decisionOpen)} council={live.council} />
      </div>

      {evModal ? <EvidenceModal id={evModal} reports={reports} onClose={() => setEvModal(null)} /> : null}
      {chatOpen ? <IssuerChat tab={tab} onClose={() => setChatOpen(false)} /> : null}
    </div>
    </EvidenceSyncProvider>
  );
}
