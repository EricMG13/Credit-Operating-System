"use client";

// Concept C — The Analytical Deep-Dive: three-pane split for the Atlas Forge
// 2L term-loan review. Source register + CP-5B evidence rail · full L0–L6 module
// launcher (bespoke CP-6A debate / CP-3B recovery / CP-4 covenants tabs +
// generic module views with clickable step-output registers) · IC verdict,
// CP-6E sizing and armed monitoring triggers. Loads complete; reset replays
// the run and outputs unlock as their producing modules clear.

import { Suspense, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { ExportToVaultButton } from "@/components/reports/ExportToVaultButton";
import type { Report } from "@/lib/reports/builders";
import { DEAL } from "@/lib/reports/deal";
import { SIM_PLAN } from "@/lib/pipeline/data";
import {
  DEEP_DIVE_MODULE_GROUPS as GROUPS,
  DEEP_DIVE_MODULES as MODULES,
  deepDiveActiveGroup,
  isDeepDiveGroupExpanded,
} from "@/lib/deepdive/module-groups";
import { fmtUtcDateTime } from "@/lib/format-date";
import { useSimRun } from "@/lib/pipeline/sim";
import { isCleared } from "@/lib/pipeline/sev";
import { Dot, SimControls } from "@/components/pipeline/atoms";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { FirstRunHint } from "@/components/shared/FirstRunHint";
import { EvidenceSyncProvider } from "@/lib/evidence-sync";
import { CrossDefaultDominoes } from "@/components/shared/CrossDefaultDominoes";
import { loadLayout, saveLayout, DEFAULT_LAYOUT, type DeepDiveLayout } from "@/lib/deepdive/layout-pref";
import { DecisionRail, Panel, SourceRail } from "@/components/deepdive/rails";
import { ModuleFinder } from "@/components/deepdive/ModuleFinder";
import { StandingViewStrip } from "@/components/deepdive/StandingViewStrip";
import { useLiveRun } from "@/lib/engine/useLiveRun";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";
import { deepDiveCaveatKind } from "@/lib/deepdive/caveat";
import { fromReportCaveat } from "@/lib/provenance";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { useAsk } from "@/components/shared/AskContext";
import { createThesisVersion, getIssuerProfile, updateAnalystWorkspace } from "@/lib/api";
import { EnterprisePage, type NarrowContract } from "@/components/shared/EnterprisePage";
import { OpenReferenceExample } from "@/components/shared/DataMode";
import { SurfaceState } from "@/components/shared/SurfaceState";
import type { DecisionContextState } from "@/lib/decision-state";
import { analysisApi, useAnalysisContext } from "@/lib/analysis-workbench";
import { dataModeFromSearch } from "@/lib/data-mode";
import { useScrollOwner } from "@/lib/use-scroll-owner";

// Code-split the heavy, on-demand surfaces out of the initial /deepdive bundle:
// the tab renderers (tabs.tsx + its fixture/chart tree) load when a module tab is
// shown, and the chat / evidence overlays only when opened. ssr:false — this is a
// client-only, statically-exported route. Trims the route's First Load JS.
const TabLoading = () => (
  <div className="h-full flex items-center justify-center text-caos-muted tabular text-caos-md">loading module…</div>
);
const ScenarioNetworkLoading = () => (
  <div role="status" className="min-h-[153px] md:min-h-[127px] flex items-center justify-center text-caos-muted tabular text-caos-md">
    loading scenario network…
  </div>
);
const DebateTab = dynamic(() => import("@/components/deepdive/tabs").then((m) => m.DebateTab), { ssr: false, loading: TabLoading });
const RecoveryTab = dynamic(() => import("@/components/deepdive/tabs").then((m) => m.RecoveryTab), { ssr: false, loading: TabLoading });
const CovenantsTab = dynamic(() => import("@/components/deepdive/tabs").then((m) => m.CovenantsTab), { ssr: false, loading: TabLoading });
const ModuleView = dynamic(() => import("@/components/deepdive/tabs").then((m) => m.ModuleView), { ssr: false, loading: TabLoading });
const LiveCovenantCapacity = dynamic(() => import("@/components/deepdive/LiveCovenantCapacity").then((m) => m.LiveCovenantCapacity), { ssr: false, loading: TabLoading });
const ScenarioNetworkPanel = dynamic(() => import("@/components/model/ScenarioNetworkPanel").then((m) => m.ScenarioNetworkPanel), { ssr: false, loading: ScenarioNetworkLoading });
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
// CP-4's analytical pane incorporates its CP-4C covenant gate. The live QA
// status therefore has to aggregate both persisted module rows; a Passed CP-4
// cannot override a Restricted/Blocked CP-4C in the same analyst pane.
const LIVE_QA_SCOPE: Record<string, readonly string[]> = { "CP-4": ["CP-4", "CP-4C"] };
type LiveQaState = "idle" | "not-reviewed" | "pass" | "warning" | "failed";
const LIVE_QA_WEIGHT: Record<LiveQaState, number> = {
  idle: 4, "not-reviewed": 3, pass: 1, warning: 5, failed: 6,
};

function liveQaState(status: string | undefined): LiveQaState {
  if (status === "Blocked" || status === "failed") return "failed";
  if (status === "Restricted" || status === "warning") return "warning";
  if (status === "Passed" || status === "pass") return "pass";
  // Unknown future statuses must not silently promote a module to Passed.
  return status === undefined ? "idle" : "not-reviewed";
}

function worstLiveQaState(statuses: Array<string | undefined>): LiveQaState {
  return statuses.map(liveQaState).reduce(
    (worst, next) => LIVE_QA_WEIGHT[next] > LIVE_QA_WEIGHT[worst] ? next : worst,
    "pass" as LiveQaState,
  );
}
// Modules with a bespoke ATLF showcase renderer (debate / recovery / covenants).
// For a real issuer with live output they fall through to the generic ModuleView.
const BESPOKE_TABS = new Set(["CP-6A", "CP-6E", "CP-3B", "CP-4"]);
type LayerSummaryPart = { key: string; n: number; dot: React.ReactNode; word: string };

const layerSummaryParts = (
  group: (typeof GROUPS)[number],
  stateFor: (id: string) => string,
  isReference: boolean,
): LayerSummaryPart[] => {
  const counts: Record<string, number> = { pass: 0, warning: 0, failed: 0, "not-reviewed": 0, idle: 0 };
  for (const id of group.mods) {
    const state = stateFor(id);
    if (state in counts) counts[state] += 1;
    else counts.idle += 1;
  }
  return [
    counts.pass ? { key: "ok", n: counts.pass, dot: <Dot sev="pass" glyph />, word: `${counts.pass} cleared` } : null,
    counts.warning ? { key: "concerns", n: counts.warning, dot: <Dot sev="warning" glyph />, word: `${counts.warning} w/ concerns` } : null,
    counts.failed ? { key: "fail", n: counts.failed, dot: <Dot sev="blocked" glyph />, word: `${counts.failed} failed` } : null,
    counts["not-reviewed"] ? { key: "review", n: counts["not-reviewed"], dot: <StatusGlyph kind="idle" />, word: `${counts["not-reviewed"]} not reviewed` } : null,
    counts.idle ? { key: "pend", n: counts.idle, dot: <StatusGlyph kind={isReference ? "locked" : "idle"} />, word: `${counts.idle} ${isReference ? "gated" : "no output"}` } : null,
  ].filter(Boolean) as LayerSummaryPart[];
};

function CollapsedLayerSummary({ group, stateFor, isReference }: { group: (typeof GROUPS)[number]; stateFor: (id: string) => string; isReference: boolean }) {
  const parts = layerSummaryParts(group, stateFor, isReference);
  return (
    <span className="flex items-center gap-1.5" aria-label={parts.map((part) => part.word).join(", ")}>
      {parts.map((part) => (
        <span key={part.key} className="flex items-center gap-0.5" aria-hidden="true">
          <span className="tabular text-caos-2xs text-caos-muted">{part.n}</span>
          {part.dot}
          <span className="hidden xl:inline tabular text-caos-2xs text-caos-muted">{part.word.split(" ").slice(1).join(" ")}</span>
        </span>
      ))}
    </span>
  );
}

const DEEP_DIVE_LAYOUTS = [
  { value: "summary" as const, label: "Summary", title: "Clean layer read: verdict-first, no model outputs or workflow cards" },
  { value: "report" as const, label: "Report", title: "Committee report: module outputs plus consolidated workflow cards" },
  { value: "dense" as const, label: "Dense", title: "Audit view: module outputs plus every workflow card packed tight" },
];

function DeepDiveLayoutPicker({ layout, onPick, labelClassName = "" }: { layout: DeepDiveLayout; onPick: (layout: DeepDiveLayout) => void; labelClassName?: string }) {
  return <>
    <span className={`tabular text-caos-2xs uppercase tracking-wider text-caos-muted ${labelClassName}`}>Layout</span>
    {DEEP_DIVE_LAYOUTS.map((option) => <button key={option.value} type="button" aria-pressed={layout === option.value} onClick={() => onPick(option.value)} title={option.title} className={"tabular text-caos-2xs px-1.5 py-0.5 rounded border transition-caos focus-ring " + (layout === option.value ? "bg-caos-elevated text-caos-text border-caos-accent" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")}>{option.label}</button>)}
  </>;
}

// fallow-ignore-next-line complexity -- Route, evidence, pane, and module state synchronize at this workbench boundary.
function DeepDive() {
  const searchParams = useSearchParams();
  const modParam = searchParams.get("mod");
  const evidenceParam = searchParams.get("evidence");
  const exactRunId = searchParams.get("run");
  const dataMode = dataModeFromSearch(searchParams);
  const requestedIssuerId = searchParams.get("issuer");
  const isReference = dataMode === "reference";
  const missingIssuer = !isReference && !requestedIssuerId;
  const currentDeepDiveHref = searchParams.toString()
    ? `/deepdive?${searchParams.toString()}`
    : "/deepdive";
  // ATLF is an explicit reference fixture. Live mode never silently selects it
  // when the issuer query parameter is missing.
  const issuerId = isReference ? ATLF_REFERENCE_ISSUER_ID : requestedIssuerId ?? "";
  const [issuerMeta, setIssuerMeta] = useState<{
    name: string;
    ticker?: string | null;
    signals: Record<string, number | string | boolean | null>;
  } | null>(null);
  // A failed lookup must not read as an eternal "Loading issuer…" — track the
  // failure and offer a retry instead of a permanent loading label.
  const [issuerErr, setIssuerErr] = useState(false);
  const [issuerAttempt, setIssuerAttempt] = useState(0);
  useEffect(() => {
    if (isReference || missingIssuer) { setIssuerMeta(null); return; }
    let stale = false;
    setIssuerErr(false);
    getIssuerProfile(issuerId)
      .then((d) => { if (!stale) setIssuerMeta({ name: d.issuer.name, ticker: d.issuer.ticker, signals: d.signals }); })
      .catch(() => { if (!stale) { setIssuerMeta(null); setIssuerErr(true); } });
    return () => { stale = true; };
  }, [issuerId, isReference, issuerAttempt, missingIssuer]);
  const code = isReference ? DEAL.code : missingIssuer ? "—" : (issuerMeta?.ticker || "—");
  const dealLabel = isReference ? DEAL.deal : missingIssuer ? "Issuer selection required" : (issuerMeta?.name ?? (issuerErr ? "Issuer unavailable" : "Loading issuer…"));
  const analysis = useAnalysisContext({ name: `${dealLabel} credit view` });
  const [affirmState, setAffirmState] = useState<"idle" | "saving" | "saved" | "partial" | "error">("idle");
  const [affirmNotice, setAffirmNotice] = useState<string | null>(null);
  const [tab, setTab] = useState(modParam || (isReference ? "CP-6A" : "CP-1"));

  useEffect(() => {
    const onCycle = (e: Event) => {
      const customEvent = e as CustomEvent<{ direction: number }>;
      const dir = customEvent.detail?.direction || 1;
      const allMods = GROUPS.flatMap((g) => g.mods);
      setTab((curr) => {
        const idx = allMods.indexOf(curr);
        if (idx === -1) return allMods[0];
        const nextIdx = (idx + dir + allMods.length) % allMods.length;
        return allMods[nextIdx];
      });
    };
    window.addEventListener("caos:subview-cycle", onCycle);
    return () => window.removeEventListener("caos:subview-cycle", onCycle);
  }, []);

  // keep the open module in sync when the ?mod= param changes (back/forward,
  // repeated double-clicks from the Execution Graph)
  useEffect(() => { if (modParam) setTab(modParam); }, [modParam]);
  const [evModal, setEvModal] = useState<string | null>(null);
  // Layout (summary / report / dense) — toggled from the sub-header; browser-local.
  const [layout, setLayout] = useState<DeepDiveLayout>(DEFAULT_LAYOUT);
  useEffect(() => setLayout(loadLayout()), []);
  const pickLayout = (l: DeepDiveLayout) => { setLayout(l); saveLayout(l); };

  // The selected module owns the open group at every supported width. Opening a
  // different group selects its first module; this keeps all 27 modules one
  // disclosure away without allowing the launcher to accumulate open regions.
  const activeGroup = deepDiveActiveGroup(tab);
  const openGroup = (group: (typeof GROUPS)[number]) => {
    if (group.label !== activeGroup.label) setTab(group.mods[0]);
  };

  // Launcher strip horizontal-scroll affordance: edge fades + chevrons that
  // appear only when there's more off-screen, and the active chip is scrolled
  // into view on navigation so it's never stranded past the fold. (critique:
  // active chip can sit outside the viewport / only affordance is a 7px bar)
  const { ref: moduleStripScrollRef, scrollable: moduleStripScrollable } = useScrollOwner<HTMLDivElement>();
  const [stripElement, setStripElementState] = useState<HTMLDivElement | null>(null);
  const setStripElement = useCallback((element: HTMLDivElement | null) => {
    setStripElementState(element);
    moduleStripScrollRef(element);
  }, [moduleStripScrollRef]);
  const [edges, setEdges] = useState({ left: false, right: false });
  const syncEdges = useCallback(() => {
    const el = stripElement;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, [stripElement]);
  const nudgeStrip = (dir: number) => {
    const el = stripElement;
    // Instant paging, not smooth: this is a flow-state terminal control, and an
    // instant jump is also the correct reduced-motion behaviour.
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7 });
  };
  // Re-measure the fades whenever the active group changes and on window resize.
  useEffect(() => {
    syncEdges();
    window.addEventListener("resize", syncEdges);
    return () => window.removeEventListener("resize", syncEdges);
  }, [syncEdges, activeGroup.label]);
  // Bring the selected module chip into view after a navigation (click, ?mod=,
  // or Alt+,/. cycle) or when its layer (re)opens — but ONLY when it's actually
  // off-screen. Scrolling an already-visible chip on first paint slices the
  // left group label ("‹ …OUTPUTS"); leave the strip at its start instead.
  useEffect(() => {
    const strip = stripElement;
    const chip = strip?.querySelector<HTMLElement>('[data-active-chip="true"]');
    if (!strip || !chip) return;
    const chipLeft = chip.offsetLeft;
    const chipRight = chipLeft + chip.offsetWidth;
    const offLeft = chipLeft < strip.scrollLeft;
    const offRight = chipRight > strip.scrollLeft + strip.clientWidth;
    if (offLeft || offRight) {
      // Scroll only the launcher. Element.scrollIntoView() also moved the
      // route's outer workbench scroll owner on narrow screens, shifting the
      // complete analysis pane off the left edge.
      const left = Math.max(0, chipLeft - (strip.clientWidth - chip.offsetWidth) / 2);
      strip.scrollTo?.({ left, behavior: "auto" });
      requestAnimationFrame(syncEdges);
    }
  }, [tab, activeGroup.label, syncEdges, stripElement]);
  // Evidence/source rail starts collapsed: traceability is on-demand (the E-xx
  // citation chips open the source directly), so it shouldn't hold prime
  // analytical real estate by default. The analyst expands it when they want it.
  const [railOpen, setRailOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(true);
  // Issuer Q&A open-state is owned by the global Ask launcher (⌘K), so the
  // in-panel ASK ATLF button and the shortcut drive the same chat.
  const { open: chatOpen, setOpen: setChatOpen } = useAsk();
  const run = useSimRun({ prefill: true, plan: SIM_PLAN });
  // The tear-sheet report tree (builders.ts → model / ROWS / charts) is read only
  // when an evidence link is opened, so defer its import + build out of the initial
  // /deepdive bundle (PERF-2). Loads once, lazily, on the first evidence-modal open.
  const [reports, setReports] = useState<Report[] | null>(null);
  useEffect(() => {
    if (!evModal || reports) return;
    let cancelled = false;
    void import("@/lib/reports/builders").then((m) => { if (!cancelled) setReports(m.buildReports()); });
    return () => { cancelled = true; };
  }, [evModal, reports]);
  // Live engine output for the seeded ATLF deal, when a run exists. Falls back
  // to the seeded register otherwise (offline demo unaffected).
  const live = useLiveRun(issuerId, exactRunId);
  // Honesty caveat for the sub-header: reference deal · resolving · live · no-run.
  const caveatKind = deepDiveCaveatKind({ isReference, loading: live.loading, runId: live.runId, phase: live.phase });

  // Adaptivity: the decision rail (IC verdict / sizing — analytical output)
  // earns its space and restores on wide screens, but auto-collapses below
  // ~1440px so the central analysis keeps a usable instrument width before the
  // verdict rail claims 352px. The evidence rail is left
  // user-controlled (default collapsed, see above) — width goes to analysis.
  useEffect(() => {
    const NARROW = 1440;
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
  // Launcher/gate display state. A parent pane/layer takes the worst persisted
  // QA state in its scope: Blocked > Restricted > Not Reviewed/absent > Passed.
  // This prevents a green CP-4 pane when its CP-4C gate is still restricted or
  // blocked, and never turns a missing status into a clean pass.
  const qaScope = (id: string) => LIVE_QA_SCOPE[id] ?? [id];
  const modState = (id: string) => isReference
    ? gateState(GATE[id] || id)
    : worstLiveQaState(qaScope(id).map((moduleId) => live.liveStatus[moduleId]));
  const meta = MODULES.find((m) => m.id === tab);
  const bespoke = BESPOKE[tab];
  const gateId = GATE[tab] || tab;
  // Reference deal → bespoke showcase tab. Real issuers never borrow ATLF
  // showcase output; they render live ModuleView data or an explicit no-output state.
  const useBespoke = BESPOKE_TABS.has(tab) && isReference;
  // Per-module live provenance: the open tab renders genuinely-live output only
  // when it goes through the generic ModuleView with this run's own module output
  // (not a bespoke ATLF showcase, and the module was actually produced this run).
  // Drives a per-module ● LIVE / ◦ REFERENCE badge instead of a run-scoped one. (#5)
  const moduleIsLive = !isReference && !useBespoke && !!live.liveOuts[tab];
  const moduleQaState = !isReference ? modState(tab) : null;
  const moduleOwnQaState = !isReference ? liveQaState(live.liveStatus[tab]) : null;
  // A real issuer's open module that hit the engine's failure gate (qa_status
  // Blocked). Distinct from "no output" (never produced) — the row exists, the
  // analysis didn't complete. Drives a ✕ FAILED badge + an explicit failed pane
  // instead of an empty ModuleView under a ● LIVE badge.
  const moduleFailed = !isReference && moduleOwnQaState === "failed";
  const referenceUnavailable = isReference && (tab === "CP-2G" || tab === "CP-4D");
  // The replay sim gates the reference showcase only. A real issuer is never
  // sim-locked (its honest empty state is the module view's own no-output
  // screen), and live output is never held behind replay theater — otherwise
  // the pane reads "awaiting upstream" under a ● LIVE badge. (critique: two
  // state machines disagreeing)
  const unlocked = referenceUnavailable || !isReference || moduleIsLive || isCleared(gateState(gateId));
  // Use the bespoke title only when the bespoke tab is actually rendered; a live
  // generic render shows the module's own name, not the showcase label.
  const title = (bespoke && useBespoke) ? bespoke.label + " · " + bespoke.code : (meta?.name || tab) + " · " + tab;
  const referenceDecisionAsOf = "2026-05-31 · reference fixture";
  const decisionAsOf = isReference
    ? referenceDecisionAsOf
    : live.asOf ? fmtUtcDateTime(live.asOf) : null;
  const decisionProvenance = fromReportCaveat(caveatKind, !isReference && !!live.runId);
  const deepAuthority = decisionAsOf && decisionProvenance ? {
    provenance: { ...decisionProvenance, asOf: decisionAsOf },
    approval: isReference ? "UNRATIFIED" as const : live.committeeStatus === "Approved" ? "RATIFIED" as const : "UNRATIFIED" as const,
  } : undefined;
  const unavailableDeepState = live.loading
    ? { kind: "loading" as const, message: "Checking latest completed run…" }
    : live.phase === "error"
      ? { kind: "error" as const, message: "Latest run could not be loaded" }
      : { kind: "unavailable" as const, message: live.phase === "in_flight" ? "Latest run is still in flight" : "No completed run available" };
  const deepDecision: DecisionContextState = isReference
    ? {
        whatChanged: { kind: "ready", value: `${run.completed}/${run.total} reference modules cleared`, asOf: referenceDecisionAsOf, authority: deepAuthority },
        whyItMatters: { kind: "ready", value: "Illustrative decision workflow only — not issuer data", asOf: referenceDecisionAsOf, authority: deepAuthority },
        requiredAction: { kind: "ready", value: "Review CP-6A reference debate structure", asOf: referenceDecisionAsOf, authority: deepAuthority },
        evidenceHealth: { kind: "ready", value: decisionProvenance?.detail ?? "Reference evidence lineage", asOf: referenceDecisionAsOf, authority: deepAuthority },
      }
    : decisionAsOf && caveatKind === "live"
    ? {
        whatChanged: { kind: "ready", value: `${Object.keys(live.liveOuts).length} module${Object.keys(live.liveOuts).length === 1 ? "" : "s"} with live output`, asOf: decisionAsOf, authority: deepAuthority },
        whyItMatters: live.council[0]
          ? { kind: "ready", value: `${live.council[0].finding_id} — ${live.council[0].severity}${live.council.length > 1 ? ` (+${live.council.length - 1} more)` : ""}`, asOf: decisionAsOf, authority: deepAuthority }
          : live.committeeStatus
            ? { kind: "ready", value: `Committee status: ${live.committeeStatus}`, asOf: decisionAsOf, authority: deepAuthority }
            : { kind: "observed-empty", message: "No committee finding observed", asOf: decisionAsOf, authority: deepAuthority },
        requiredAction: { kind: "ready", value: live.council[0]?.required_remediation ?? "Review live module outputs", asOf: decisionAsOf, authority: deepAuthority },
        evidenceHealth: { kind: "ready", value: decisionProvenance?.detail ?? "Evidence lineage available", asOf: decisionAsOf, authority: deepAuthority },
      }
    : { whatChanged: unavailableDeepState, whyItMatters: unavailableDeepState, requiredAction: unavailableDeepState, evidenceHealth: unavailableDeepState };

  const syncContext = analysis.context;
  const patchContext = analysis.patch;
  useEffect(() => {
    if (isReference || missingIssuer) return;
    const active = syncContext;
    if (!active) return;
    const issuerIds = active.issuer_ids.includes(issuerId)
      ? active.issuer_ids
      : [...active.issuer_ids, issuerId];
    const runId = live.runId ?? active.artifacts.issuer_run_id;
    if (issuerIds === active.issuer_ids && runId === active.artifacts.issuer_run_id) return;
    void patchContext({
      issuer_ids: issuerIds,
      artifacts: { issuer_run_id: runId },
    }).catch(() => setAffirmNotice("Analysis context could not be updated."));
  }, [isReference, issuerId, live.runId, missingIssuer, patchContext, syncContext]);

  const affirmView = async () => {
    const context = analysis.context;
    if (isReference || !live.runId || !context) {
      setAffirmNotice(isReference
        ? "Reference output cannot be ratified."
        : analysis.error ?? "A completed owned run is required before affirmation.");
      return;
    }
    setAffirmState("saving");
    setAffirmNotice(null);
    try {
      const thesis = await createThesisVersion({
        issuer_id: issuerId,
        trigger: "manual",
        thesis_md: [
          `# ${dealLabel} credit view`,
          "",
          `Run: ${live.runId}`,
          `Observed: ${decisionAsOf ?? "unknown"}`,
          `Committee state: ${live.committeeStatus ?? "unratified"}`,
          `Module coverage: ${Object.keys(live.liveOuts).length}`,
          live.council[0] ? `Required action: ${live.council[0].required_remediation}` : "Required action: review live module outputs",
        ].join("\n"),
      });
      const nextSurfaceState = {
        ...context.surface_state,
        "deep-dive": {
          ...(context.surface_state["deep-dive"] ?? {}),
          active_id: thesis.id,
          selected_ids: [live.runId],
          view: layout,
        },
      };
      await analysis.patch({
        issuer_ids: context.issuer_ids.includes(issuerId) ? context.issuer_ids : [...context.issuer_ids, issuerId],
        artifacts: { ...context.artifacts, issuer_run_id: live.runId },
        surface_state: nextSurfaceState,
      });
      const [findingResult] = await Promise.allSettled([
        analysisApi.createFinding({
          context_id: context.id,
          kind: "credit-view",
          title: `${dealLabel} view affirmed`,
          body: `Thesis v${thesis.version} affirmed from run ${live.runId.slice(0, 8)}.`,
          source_surface: "deep-dive",
          source_run_id: live.runId,
          evidence: { thesis_version_id: thesis.id, module_id: tab },
        }),
        updateAnalystWorkspace((workspace) => {
          const prior = Array.isArray(workspace.affirmations) ? workspace.affirmations : [];
          return {
            ...workspace,
            affirmations: [
              { issuerId, runId: live.runId, stance: live.committeeStatus ?? "Analyst affirmed", ts: new Date().toISOString(), thesisVersionId: thesis.id },
              ...prior,
            ].slice(0, 20),
          };
        }),
      ]);
      if (findingResult.status === "rejected") {
        setAffirmState("partial");
        setAffirmNotice(`Thesis v${thesis.version} saved; finding pin needs retry.`);
      } else {
        setAffirmState("saved");
        setAffirmNotice(`Thesis v${thesis.version} saved and pinned.`);
      }
    } catch (reason) {
      setAffirmState("error");
      setAffirmNotice(reason instanceof Error ? reason.message : "View could not be affirmed.");
    }
  };

  const narrowContract: NarrowContract = {
    essentialControls: (
      <>
        <DeepDiveLayoutPicker layout={layout} onPick={pickLayout} />
        <SimControls run={run} />
      </>
    ),
  };

  if (missingIssuer) {
    return (
      <EnterprisePage
        kind="object"
        identity={<ShellIdentity tag="DEEP-DIVE" title="Issuer selection required" />}
        primaryAction={{ label: "Select issuer", href: "/issuers" }}
        narrowContract={{ essentialControls: null }}
      >
        <div className="p-3">
          <SurfaceState
            kind="not-run"
            title="Select an issuer to begin Deep-Dive"
            headingLevel={2}
            detail="Live Deep-Dive requires an issuer context. No seeded analysis has been substituted. Use the page action to select an issuer."
            secondaryAction={<OpenReferenceExample href={currentDeepDiveHref} />}
          />
        </div>
      </EnterprisePage>
    );
  }

  return (
    <EvidenceSyncProvider initialActive={evidenceParam}>
    <EnterprisePage kind="object"
      identity={
        <ShellIdentity tag="DEEP-DIVE" title={dealLabel}>
          {issuerErr && !isReference ? (
            <button
              onClick={() => setIssuerAttempt((a) => a + 1)}
              className="tabular text-caos-xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50 transition-caos focus-ring whitespace-nowrap"
              title="Issuer lookup failed — retry"
            >
              RETRY
            </button>
          ) : null}
          {caveatKind === "reference" ? (
            <span
              className="tabular text-caos-sm text-caos-muted whitespace-nowrap hidden xl:inline"
              title="Seeded ATLF reference showcase — illustrative run #2641, not a persisted issuer run. No live engine output is merged into Reference mode."
            >
              SEEDED RUN #2641 · {run.completed}/{run.total} modules
            </span>
          ) : caveatKind === "loading" ? (
            <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap hidden xl:inline">checking for live run…</span>
          ) : caveatKind === "error" ? (
            <span className="tabular text-caos-xs whitespace-nowrap" style={{ color: "var(--caos-critical)" }} role="note" title={`Could not load ${code}'s live run — showing the last known state, not a confirmed no-run.`}>
              could not load live run
            </span>
          ) : caveatKind === "live" ? (
            <span className="tabular text-caos-xs whitespace-nowrap" style={{ color: "var(--caos-warning)" }} title="Live engine modules reflect this issuer; modules or rails without issuer-specific output show an explicit no-output state.">
              live engine output · missing panes show no output
            </span>
          ) : (
            <span className="tabular text-caos-xs whitespace-nowrap" style={{ color: "var(--caos-warning)" }} role="note" title={`No completed run for ${code}. Seeded ATLF output is suppressed for issuer-scoped views. Run a new simulation in pipeline or model builder to populate.`}>
              no run for {code} · run analysis to populate
            </span>
          )}
        </ShellIdentity>
      }
      primaryAction={{
        label: "Affirm thesis",
        onAction: () => { void affirmView(); },
        unavailableReason: isReference
          ? "Reference output cannot be ratified"
          : !live.runId
            ? "Run analysis first — there is no live view to affirm"
            : analysis.loading
              ? "Preparing analysis workspace…"
              : affirmState === "saving"
                ? "Affirmation is being saved…"
                : null,
        title: "Append an immutable thesis version and pin the affirmed view",
      }}
      status={
        <span className="flex items-center gap-2">
          {decisionAsOf ? <span className="tabular text-caos-2xs text-caos-muted">Observed {decisionAsOf}</span> : null}
          {affirmNotice ? <span role="status" className="tabular text-caos-2xs text-caos-muted">{affirmNotice}</span> : null}
        </span>
      }
      contextualControls={
        <button
          onClick={() => setChatOpen(!chatOpen)}
          title={`Ask about ${code} (Alt+K)`}
          className="caos-secondary-action focus-ring"
        >
          ASK {code}
        </button>
      }
      utilityLabel="Layout and simulation"
      utilityControls={
        <>
          <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Deep-Dive layout">
            <DeepDiveLayoutPicker layout={layout} onPick={pickLayout} labelClassName="hidden xl:inline" />
          </div>
          {!isReference && live.runId ? <ExportToVaultButton runId={live.runId} /> : null}
          <SimControls run={run} />
        </>
      }
      narrowContract={narrowContract}
    >
      <div className="caos-persona-route deepdive-workbench flex-1 min-h-0">
      <PersonaWorkbench
        surface="deep-dive"
        decision={<DecisionHeader state={deepDecision} defaultOpen={false} />}
        primary={<div className="h-full min-h-0 flex flex-col">
      <div className="contents">
      {/* Decision header — evidence health mirrors the same caveat grammar the
          identity chip already states; the other three cells lean only on
          data this page already fetched (the sim clock, live module count,
          CP-5C council). Loading/error/no-run all honestly read "— no data"
          rather than a guessed decision. */}
      {!isReference ? <div className="px-2.5 py-2 bg-caos-panel border-b border-caos-border">
        <ScenarioNetworkPanel issuerId={issuerId} runId={live.runId} />
      </div> : null}
      {/* module launcher strip — each layer collapses to its name + status dots;
          click a layer to reveal its modules (named; short label on smaller panes).
          Wrapped so edge fades + chevrons sit above the scroller and signal
          off-screen layers (the native bar is hidden — redundant noise). */}
      <div className="relative shrink-0 border-b border-caos-border">
      <div
        ref={setStripElement}
        onScroll={syncEdges}
        tabIndex={moduleStripScrollable ? 0 : undefined}
        role={moduleStripScrollable ? "region" : undefined}
        aria-label={moduleStripScrollable ? "Deep-Dive module groups" : undefined}
        className={`h-9 bg-caos-panel/40 flex items-center px-4 gap-2 overflow-x-auto caos-no-scrollbar${moduleStripScrollable ? " focus-ring" : ""}`}
      >
        <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap hidden lg:inline" title="Alt + , / .  cycles the open module">Module outputs</span>
        <ModuleFinder onSelect={setTab} activeId={tab} />
        {/* fallow-ignore-next-line complexity -- Static module-group projection keeps navigation semantics local. */}
        {GROUPS.map((g) => {
          const open = isDeepDiveGroupExpanded(g, tab);
          return (
            <div key={g.label} className="flex items-center gap-1.5 pl-2.5 border-l border-caos-border shrink-0">
              <button
                onClick={() => openGroup(g)}
                aria-expanded={open}
                aria-current={open ? "true" : undefined}
                title={(open ? "Current group: " : "Open group: ") + g.label}
                className="flex min-h-6 items-center gap-1.5 rounded px-1 py-0.5 hover:bg-caos-elevated/50 transition-caos focus-ring"
              >
                <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted whitespace-nowrap">{g.label}</span>
                {!open ? <CollapsedLayerSummary group={g} stateFor={modState} isReference={isReference} /> : null}
                <span className="tabular text-caos-2xs text-caos-muted">{open ? "▾" : "▸"}</span>
              </button>
              {open ? (
                <span className="flex items-center gap-1">
                  {/* fallow-ignore-next-line complexity -- Static module-button projection preserves group-local state. */}
                  {g.mods.map((id) => {
                    const st = modState(id);
                    const ok = isCleared(st);
                    const sel = tab === id;
                    const name = MODULES.find((m) => m.id === id)?.name ?? id;
                    const short = name.split(" ")[0];
                    return (
                      <button
                        key={id}
                        onClick={() => setTab(id)}
                        title={name}
                        aria-label={name}
                        aria-current={sel ? "true" : undefined}
                        data-active-chip={sel ? "true" : undefined}
                        className={
                          "flex items-center gap-1.5 tabular text-caos-sm px-2 py-1 rounded border transition-caos whitespace-nowrap focus-ring " +
                          (sel ? "bg-caos-elevated text-caos-text border-caos-accent" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
                        }
                      >
                        {/* Recess a pending module by dimming only the GLYPH, not
                            the whole chip — the label stays at full muted contrast
                            (AA), state is carried by the padlock/idle shape.
                            (critique: locked-chip labels failed contrast) A failed
                            (Blocked) module shows a full-contrast ✕ ring in critical
                            — the one non-cleared state that must not be dimmed away. */}
                        {ok ? <Dot sev={st} pulse={st === "running"} /> : st === "failed" ? <Dot sev="blocked" glyph /> : <span className="opacity-60"><StatusGlyph kind={isReference ? "locked" : "idle"} /></span>}
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
        {/* Edge affordances — shown only when the strip actually overflows past
            that edge; chevrons page by ~70% of the visible width. */}
        {edges.left ? (
          <>
            <div aria-hidden className="pointer-events-none absolute left-0 inset-y-0 w-12" style={{ background: "linear-gradient(to right, var(--caos-strip-bg), transparent)" }} />
            <button
              type="button"
              onClick={() => nudgeStrip(-1)}
              aria-label="Scroll module layers left"
              className="absolute left-0 inset-y-0 min-w-6 px-1.5 flex items-center justify-center text-caos-lg text-caos-muted hover:text-caos-text transition-caos focus-ring"
              style={{ background: "var(--caos-strip-bg)" }}
            >
              ‹
            </button>
          </>
        ) : null}
        {edges.right ? (
          <>
            <div aria-hidden className="pointer-events-none absolute right-0 inset-y-0 w-12" style={{ background: "linear-gradient(to left, var(--caos-strip-bg), transparent)" }} />
            <button
              type="button"
              onClick={() => nudgeStrip(1)}
              aria-label="Scroll module layers right"
              className="absolute right-0 inset-y-0 min-w-6 px-1.5 flex items-center justify-center text-caos-lg text-caos-muted hover:text-caos-text transition-caos focus-ring"
              style={{ background: "var(--caos-strip-bg)" }}
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      <FirstRunHint id="deepdive-panes" className="mx-2 mt-2 shrink-0">
        <span className="text-white font-medium">Three panes:</span> sources &amp; evidence (left) · module analysis (center) · the IC decision &amp; sizing (right). Click any{" "}
        <span className="tabular text-caos-accent">E-xx</span> chip to open its cited source.{" "}
        <span className="text-caos-muted">Hold <span className="tabular text-caos-text">Alt</span> — <span className="tabular text-caos-text">,</span>/<span className="tabular text-caos-text">.</span> cycle modules, <span className="tabular text-caos-text">C</span> collapse panes, <span className="tabular text-caos-text">K</span> Ask.</span>
      </FirstRunHint>

      {/* Decision-first opener: the standing view leads, above the module
          panes (P2-WP-5). "Revise" deep-links into the module tab below. */}
      <StandingViewStrip
        isReference={isReference}
        issuerId={issuerId}
        runId={isReference ? null : live.runId}
        onRevise={(id) => setTab(id)}
      />

      {/* three-pane workspace */}
      <div
        className="deepdive-analysis-grid flex-1 min-h-0 grid gap-2 p-2"
        style={{ gridTemplateColumns: (railOpen ? "330px" : "42px") + " minmax(0,1fr) " + (decisionOpen ? "352px" : "42px") }}
      >
        <SourceRail ev={evModal} open={railOpen} onToggle={() => setRailOpen(!railOpen)} isReference={isReference} issuerCode={code} issuerName={isReference ? undefined : dealLabel} />
        <Panel
          title={title}
          className="deepdive-analysis-primary"
          right={
            <span className="flex items-center gap-3">
              <span className="tabular text-caos-xs text-caos-muted">{code}</span>
              {/* Per-MODULE provenance, not run-scoped: light ● LIVE only when THIS
                  tab's data came from the live run. Missing issuer-scoped modules
                  show no-output, never a seeded ATLF table. (#5) */}
              {moduleQaState === "failed" ? (
                <span className="tabular text-caos-xs" style={{ color: "var(--caos-critical)" }} title="This module hit its failure gate (qa_status Blocked) and did not complete — no usable output.">
                  ✕ BLOCKED
                </span>
              ) : moduleQaState === "warning" ? (
                <span className="tabular text-caos-xs" style={{ color: "var(--caos-warning)" }} title="QA gate: this module's output is Restricted — committee-usable with caveats, not a clean pass.">
                  △ RESTRICTED
                </span>
              ) : moduleQaState === "not-reviewed" && moduleIsLive ? (
                <span className="tabular text-caos-xs text-caos-muted" title="QA status: Not Reviewed. This persisted output is not a clean pass.">
                  ◦ NOT REVIEWED
                </span>
              ) : moduleQaState === "idle" && moduleIsLive ? (
                <span className="tabular text-caos-xs text-caos-muted" title="No persisted QA status is available for this live output; it is not a clean pass.">
                  ◦ NO QA STATUS
                </span>
              ) : moduleIsLive ? (
                <span className="tabular text-caos-xs" style={{ color: "var(--caos-accent)" }} title="Rendering this issuer's live engine output for this module; QA status: Passed.">
                  ● LIVE · PASSED
                </span>
              ) : !isReference ? (
                <span className="tabular text-caos-xs text-caos-muted" title="This module has no issuer-specific output available.">
                  ◦ NO OUTPUT
                </span>
              ) : referenceUnavailable ? (
                <span className="tabular text-caos-xs text-caos-muted" title="No synthetic reference finding is supplied for this module.">
                  ◦ NO REFERENCE OUTPUT
                </span>
              ) : null}
            </span>
          }
        >
          {moduleFailed ? (
            // The module ran but hit its failure gate (Blocked) — show that plainly
            // instead of an empty ModuleView, so a failed module is legible in the
            // pane, not just the launcher strip. (identify failed modules)
            <div className="h-full flex flex-col items-center justify-center gap-2 text-caos-muted text-center px-4">
              <Dot sev="blocked" glyph />
              <div className="tabular text-caos-xl" style={{ color: "var(--caos-critical)" }}>{tab} failed</div>
              <div className="text-caos-md">this module hit its failure gate and produced no usable output</div>
              <div className="text-caos-xs tabular">any downstream module that depends on {tab} is gated in turn</div>
            </div>
          ) : unlocked ? (
            // The bespoke debate/recovery/covenant tabs are the ATLF reference
            // *showcase*. For a real issuer with a live run for that module, render
            // its honest engine output via the generic ModuleView instead of the
            // ATLF fixture; keep the bespoke tab for the reference deal (or when no
            // live output exists yet, where the "reference template" caveat applies).
            useBespoke ? (
              tab === "CP-6A" ? <DebateTab onOpenEvidence={setEvModal} layout={layout} /> :
              tab === "CP-6E" ? <DebateTab variant="CP-6E" onOpenEvidence={setEvModal} layout={layout} /> :
              tab === "CP-3B" ? <RecoveryTab onOpenEvidence={setEvModal} layout={layout} /> :
              // CP-4: the ATLF showcase fixture PLUS the live cross-default domino
              // map (WP-4 G13) — the fixture has its own bespoke COVENANTS/CAPACITY
              // narrative, the domino section is real, run-sourced data (honestly
              // empty when this issuer_id has no completed run, which is the ATLF
              // reference's usual state).
              <CovenantsTab onOpenEvidence={setEvModal} layout={layout} />
            ) : (
              <>
                <ModuleView id={tab} sim={run.sim} onOpenEvidence={setEvModal} liveOut={isReference ? undefined : live.liveOuts[tab]} allowSeededFallback={isReference} layout={layout} />
                {tab === "CP-4" ? <LiveCovenantCapacity signals={issuerMeta?.signals ?? {}} /> : null}
                {/* Same live domino map for a real issuer's CP-4 tab — the map
                    the spec calls out as needing to "appear for live issuers too". */}
                {tab === "CP-4" ? <CrossDefaultDominoes issuerId={issuerId} hasRun={!!live.runId} /> : null}
              </>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-caos-muted">
              <Dot sev={gateState(gateId)} pulse={gateState(gateId) === "running"} />
              <div className="tabular text-caos-xl">{gateId} {gateState(gateId) === "running" ? "running…" : "awaiting upstream dependencies"}</div>
              {(() => {
                // "Awaiting" and "running…" are mutually exclusive truths: once
                // the gate module is running its dependencies have cleared.
                if (gateState(gateId) === "running") return null;
                const planStep = SIM_PLAN.find((s) => s.id === gateId);
                const upstreamDeps = planStep ? planStep.deps : [];
                return upstreamDeps.length > 0 ? (
                  <div className="text-caos-xs tabular text-caos-muted">
                    Awaiting: <span style={{ color: "var(--caos-accent)" }}>{upstreamDeps.join(", ")}</span>
                  </div>
                ) : null;
              })()}
              <div className="text-caos-md">output unlocks when the producing module clears its gate</div>
            </div>
          )}
        </Panel>
        <DecisionRail
          open={decisionOpen}
          onToggle={() => setDecisionOpen(!decisionOpen)}
          council={isReference ? [] : live.council}
          councilState={isReference ? "ready" : live.loading ? "loading" : live.phase === "error" ? "error" : live.runId ? "ready" : "unavailable"}
          isReference={isReference}
          issuerCode={code}
        />
      </div>

      {evModal && reports ? <EvidenceModal id={evModal} reports={reports} live={isReference ? {} : live.liveEvidence} isLiveRun={!isReference && !!live.runId} onClose={() => setEvModal(null)} /> : null}
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
        </div>}
      />
      </div>
    </EnterprisePage>
    </EvidenceSyncProvider>
  );
}
