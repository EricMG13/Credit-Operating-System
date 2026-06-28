"use client";

// Concept C — The Analytical Deep-Dive: three-pane split for the Atlas Forge
// 2L term-loan review. Source register + CP-5B evidence rail · full L0–L6 module
// launcher (bespoke CP-6A debate / CP-3B recovery / CP-4 covenants tabs +
// generic module views with clickable step-output registers) · IC verdict,
// CP-6E sizing and armed monitoring triggers. Loads complete; reset replays
// the run and outputs unlock as their producing modules clear.

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { ExportToVaultButton } from "@/components/reports/ExportToVaultButton";
import { buildReports } from "@/lib/reports/builders";
import { DEAL } from "@/lib/reports/deal";
import { MODULES, SIM_PLAN } from "@/lib/pipeline/data";
import { useSimRun } from "@/lib/pipeline/sim";
import { isCleared } from "@/lib/pipeline/sev";
import { Dot, SimControls } from "@/components/pipeline/atoms";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { FirstRunHint } from "@/components/shared/FirstRunHint";
import { EvidenceSyncProvider } from "@/lib/evidence-sync";
import { loadLayout, saveLayout, DEFAULT_LAYOUT, type DeepDiveLayout } from "@/lib/deepdive/layout-pref";
import { DecisionRail, Panel, SourceRail } from "@/components/deepdive/rails";
import { useLiveRun } from "@/lib/engine/useLiveRun";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";
import { deepDiveCaveatKind } from "@/lib/deepdive/caveat";
import { useAsk } from "@/components/shared/Ask";
import { getIssuer } from "@/lib/api";

// Code-split the heavy, on-demand surfaces out of the initial /deepdive bundle:
// the tab renderers (tabs.tsx + its fixture/chart tree) load when a module tab is
// shown, and the chat / evidence overlays only when opened. ssr:false — this is a
// client-only, statically-exported route. Trims the route's First Load JS.
const TabLoading = () => (
  <div className="h-full flex items-center justify-center text-caos-muted tabular text-caos-md">loading module…</div>
);
const DebateTab = dynamic(() => import("@/components/deepdive/tabs").then((m) => m.DebateTab), { ssr: false, loading: TabLoading });
const RecoveryTab = dynamic(() => import("@/components/deepdive/tabs").then((m) => m.RecoveryTab), { ssr: false, loading: TabLoading });
const CovenantsTab = dynamic(() => import("@/components/deepdive/tabs").then((m) => m.CovenantsTab), { ssr: false, loading: TabLoading });
const ModuleView = dynamic(() => import("@/components/deepdive/tabs").then((m) => m.ModuleView), { ssr: false, loading: TabLoading });
const IssuerChat = dynamic(() => import("@/components/deepdive/IssuerChat").then((m) => m.IssuerChat), { ssr: false });
const EvidenceModal = dynamic(() => import("@/components/reports/EvidenceModal").then((m) => m.EvidenceModal), { ssr: false });

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
// Modules with a bespoke ATLF showcase renderer (debate / recovery / covenants).
// For a real issuer with live output they fall through to the generic ModuleView.
const BESPOKE_TABS = new Set(["CP-6A", "CP-6E", "CP-3B", "CP-4"]);
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

// fallow-ignore-next-line complexity
function DeepDive() {
  const searchParams = useSearchParams();
  const modParam = searchParams.get("mod");
  // Issuer opened from the directory (?issuer=). Absent → the ATLF reference deal
  // (the bespoke showcase). The live engine overlay is keyed off this id; the
  // bespoke debate/recovery/covenant tabs and DEAL narrative are ATLF fixtures,
  // so for a non-reference issuer we land on a live module and mark them as the
  // reference template rather than implying they are that issuer's own analysis.
  const issuerId = searchParams.get("issuer") || ATLF_REFERENCE_ISSUER_ID;
  const isReference = issuerId === ATLF_REFERENCE_ISSUER_ID;
  const [issuerMeta, setIssuerMeta] = useState<{ name: string; ticker?: string | null } | null>(null);
  useEffect(() => {
    if (isReference) { setIssuerMeta(null); return; }
    let stale = false;
    getIssuer(issuerId)
      .then((d) => { if (!stale) setIssuerMeta({ name: d.name, ticker: d.ticker }); })
      .catch(() => { if (!stale) setIssuerMeta(null); });
    return () => { stale = true; };
  }, [issuerId, isReference]);
  const code = isReference ? DEAL.code : (issuerMeta?.ticker || "—");
  const dealLabel = isReference ? DEAL.deal : (issuerMeta?.name ?? "Loading issuer…");
  const [tab, setTab] = useState(modParam || (isReference ? "CP-6A" : "CP-1"));
  // keep the open module in sync when the ?mod= param changes (back/forward,
  // repeated double-clicks from the Execution Graph)
  useEffect(() => { if (modParam) setTab(modParam); }, [modParam]);
  const [evModal, setEvModal] = useState<string | null>(null);
  // Layout (core / base / dense) — toggled from the sub-header; browser-local.
  const [layout, setLayout] = useState<DeepDiveLayout>(DEFAULT_LAYOUT);
  useEffect(() => setLayout(loadLayout()), []);
  const pickLayout = (l: DeepDiveLayout) => { setLayout(l); saveLayout(l); };

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
  const live = useLiveRun(issuerId);
  // Honesty caveat for the sub-header: reference deal · resolving · live · no-run.
  const caveatKind = deepDiveCaveatKind({ isReference, loading: live.loading, runId: live.runId });

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
  useEffect(() => {
    const onCollapse = () => {
      const anyOpen = railOpen || decisionOpen;
      setRailOpen(!anyOpen);
      setDecisionOpen(!anyOpen);
    };
    window.addEventListener("caos:collapse-toggle", onCollapse);
    return () => window.removeEventListener("caos:collapse-toggle", onCollapse);
  }, [railOpen, decisionOpen]);

  const gateState = (id: string) => run.sim.mods[id]?.state || "idle";
  const meta = MODULES.find((m) => m.id === tab);
  const bespoke = BESPOKE[tab];
  const gateId = GATE[tab] || tab;
  const unlocked = isCleared(gateState(gateId));
  // Reference deal → bespoke showcase tab. Real issuers never borrow ATLF
  // showcase output; they render live ModuleView data or an explicit no-output state.
  const useBespoke = BESPOKE_TABS.has(tab) && isReference;
  // Per-module live provenance: the open tab renders genuinely-live output only
  // when it goes through the generic ModuleView with this run's own module output
  // (not a bespoke ATLF showcase, and the module was actually produced this run).
  // Drives a per-module ● LIVE / ◦ REFERENCE badge instead of a run-scoped one. (#5)
  const moduleIsLive = !useBespoke && !!live.liveOuts[tab];
  // Use the bespoke title only when the bespoke tab is actually rendered; a live
  // generic render shows the module's own name, not the showcase label.
  const title = (bespoke && useBespoke) ? bespoke.label + " · " + bespoke.code : (meta?.name || tab) + " · " + tab;

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
        <span className="text-caos-xl text-caos-text font-medium truncate min-w-0">{dealLabel}</span>
        {caveatKind === "reference" ? (
          <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap hidden xl:inline">RUN #2641 · {run.completed}/{run.total} modules complete</span>
        ) : caveatKind === "loading" ? (
          <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap hidden xl:inline">checking for live run…</span>
        ) : caveatKind === "live" ? (
          // Always visible: this caveat pairs with the ● LIVE badge (which has no
          // width gate), so hiding it <1280px would show "live" with no blend
          // disclaimer. (#20)
          <span className="tabular text-caos-xs whitespace-nowrap" style={{ color: "var(--caos-warning)" }} title="Live engine modules reflect this issuer; modules or rails without issuer-specific output show an explicit no-output state.">
            live engine output · missing panes show no output
          </span>
        ) : (
          // noRun: issuer exists but was never analysed; suppress seeded figures.
          <span className="tabular text-caos-xs whitespace-nowrap" style={{ color: "var(--caos-warning)" }} role="note" title={`No completed run for ${code}. Seeded ATLF output is suppressed for issuer-scoped views.`}>
            no run for {code} · no issuer-specific output
          </span>
        )}
        <div className="flex-1"></div>
        <span className="tabular text-caos-xs text-caos-muted hidden xl:inline">click any E-xx chip to open its source · replay run to watch outputs unlock →</span>
        <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Deep-Dive layout">
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted hidden xl:inline">Layout</span>
          {([
            { v: "core" as const, t: "Workflow register, then sections in source order" },
            { v: "base" as const, t: "Conclusion first; steps in up to 4 stretched columns" },
            { v: "dense" as const, t: "Conclusion first; steps in packed newspaper columns" },
          ]).map((o) => (
            <button
              key={o.v}
              type="button"
              aria-pressed={layout === o.v}
              onClick={() => pickLayout(o.v)}
              title={o.t}
              className={
                "tabular text-caos-2xs capitalize px-1.5 py-0.5 rounded border transition-caos focus-ring " +
                (layout === o.v
                  ? "bg-caos-elevated text-caos-text border-caos-accent"
                  : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
              }
            >
              {o.v}
            </button>
          ))}
        </div>
        {live.runId ? <ExportToVaultButton runId={live.runId} /> : null}
        <span className="hidden 2xl:flex items-center shrink-0"><SimControls run={run} /></span>
      </div>

      {/* module launcher strip — each layer collapses to its name + status dots;
          click a layer to reveal its modules (named; short label on smaller panes). */}
      <div className="h-9 shrink-0 border-b border-caos-border bg-caos-panel/40 flex items-center px-4 gap-2 overflow-x-auto">
        <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap hidden lg:inline">Module outputs</span>
        {/* fallow-ignore-next-line complexity */}
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
                  {/* fallow-ignore-next-line complexity */}
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
        <SourceRail ev={evModal} open={railOpen} onToggle={() => setRailOpen(!railOpen)} isReference={isReference} issuerCode={code} issuerName={isReference ? undefined : dealLabel} />
        <Panel
          title={title}
          right={
            <span className="flex items-center gap-3">
              <span className="tabular text-caos-xs text-caos-muted">{code}</span>
              {/* Per-MODULE provenance, not run-scoped: light ● LIVE only when THIS
                  tab's data came from the live run. Missing issuer-scoped modules
                  show no-output, never a seeded ATLF table. (#5) */}
              {moduleIsLive ? (
                <span className="tabular text-caos-xs" style={{ color: "var(--caos-accent)" }} title="Rendering this issuer's live engine output for this module">
                  ● LIVE
                </span>
              ) : !isReference ? (
                <span className="tabular text-caos-xs text-caos-muted" title="This module has no issuer-specific output available.">
                  ◦ NO OUTPUT
                </span>
              ) : null}
              <button
                onClick={() => setChatOpen(!chatOpen)}
                title="Ask follow-up questions about this issuer"
                className="tabular text-caos-sm whitespace-nowrap px-2.5 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
              >
                ASK {code}
              </button>
            </span>
          }
        >
          {unlocked ? (
            // The bespoke debate/recovery/covenant tabs are the ATLF reference
            // *showcase*. For a real issuer with a live run for that module, render
            // its honest engine output via the generic ModuleView instead of the
            // ATLF fixture; keep the bespoke tab for the reference deal (or when no
            // live output exists yet, where the "reference template" caveat applies).
            useBespoke ? (
              tab === "CP-6A" ? <DebateTab onOpenEvidence={setEvModal} layout={layout} /> :
              tab === "CP-6E" ? <DebateTab variant="CP-6E" onOpenEvidence={setEvModal} layout={layout} /> :
              tab === "CP-3B" ? <RecoveryTab onOpenEvidence={setEvModal} layout={layout} /> :
              <CovenantsTab onOpenEvidence={setEvModal} layout={layout} />
            ) :
            <ModuleView id={tab} sim={run.sim} onOpenEvidence={setEvModal} liveOut={live.liveOuts[tab]} allowSeededFallback={isReference} layout={layout} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-caos-muted">
              <Dot sev={gateState(gateId)} pulse={gateState(gateId) === "running"} />
              <div className="tabular text-caos-xl">{gateId} {gateState(gateId) === "running" ? "running…" : "awaiting upstream dependencies"}</div>
              <div className="text-caos-md">output unlocks when the producing module clears its gate</div>
            </div>
          )}
        </Panel>
        <DecisionRail open={decisionOpen} onToggle={() => setDecisionOpen(!decisionOpen)} council={live.council} isReference={isReference} issuerCode={code} />
      </div>

      {evModal ? <EvidenceModal id={evModal} reports={reports} live={live.liveEvidence} isLiveRun={!isReference && !!live.runId} onClose={() => setEvModal(null)} /> : null}
      {chatOpen ? (
        // Live-ground the chat for a real issuer run; the reference deal keeps its
        // rich seeded showcase context (consistent with the bespoke tabs).
        <IssuerChat
          // Remount when the run resolves so the transcript cache key (run-scoped)
          // re-reads from the right key instead of bleeding the loading-window fallback.
          key={isReference ? "chat-ref" : "chat-" + (live.runId || "loading")}
          tab={tab}
          onClose={() => setChatOpen(false)}
          live={isReference ? undefined : live}
          issuerName={isReference ? undefined : issuerMeta?.name}
        />
      ) : null}
    </div>
    </EvidenceSyncProvider>
  );
}
