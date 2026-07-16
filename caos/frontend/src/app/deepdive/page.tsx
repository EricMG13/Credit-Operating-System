"use client";

// Concept C — The Analytical Deep-Dive: three-pane split for the Atlas Forge
// 2L term-loan review. Source register + CP-5B evidence rail · full L0–L6 module
// launcher (bespoke CP-6A debate / CP-3B recovery / CP-4 covenants tabs +
// generic module views with clickable step-output registers) · IC verdict,
// CP-6E sizing and armed monitoring triggers. Loads complete; reset replays
// the run and outputs unlock as their producing modules clear.

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { ExportToVaultButton } from "@/components/reports/ExportToVaultButton";
import type { Report } from "@/lib/reports/builders";
import { DEAL } from "@/lib/reports/deal";
import { MODULES, SIM_PLAN } from "@/lib/pipeline/data";
import { fmtUtcDateTime } from "@/lib/format-date";
import { useSimRun } from "@/lib/pipeline/sim";
import { isCleared, moduleLiveState } from "@/lib/pipeline/sev";
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
import { useAsk } from "@/components/shared/Ask";
import { createThesisVersion, getIssuerProfile, updateAnalystWorkspace } from "@/lib/api";
import { EnterprisePage, type NarrowContract } from "@/components/shared/EnterprisePage";
import type { DecisionContextState } from "@/lib/decision-state";
import { analysisApi, useAnalysisContext } from "@/lib/analysis-workbench";

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
const LiveCovenantCapacity = dynamic(() => import("@/components/deepdive/LiveCovenantCapacity").then((m) => m.LiveCovenantCapacity), { ssr: false, loading: TabLoading });
const ScenarioNetworkPanel = dynamic(() => import("@/components/model/ScenarioNetworkPanel").then((m) => m.ScenarioNetworkPanel), { ssr: false, loading: TabLoading });
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
const GROUPS: readonly { label: string; mods: readonly string[] }[] = [
  { label: "L0 · ORCH", mods: ["CP-0", "CP-X"] },
  { label: "L1 BASE", mods: ["CP-1", "CP-1A", "CP-1B", "CP-1C"] },
  { label: "L2 SYNTHESIS", mods: ["CP-2", "CP-2B", "CP-2C", "CP-2D", "CP-2E", "CP-2F", "CP-2G"] },
  { label: "L3 REL VALUE", mods: ["CP-3", "CP-3B", "CP-3C", "CP-3D"] },
  { label: "L4 LEGAL", mods: ["CP-4", "CP-4D"] },
  { label: "L5 GOV", mods: ["CP-5B", "CP-5"] },
  { label: "L6 DEBATE", mods: ["CP-6A", "CP-6E"] },
];

// fallow-ignore-next-line complexity
function DeepDive() {
  const searchParams = useSearchParams();
  const modParam = searchParams.get("mod");
  const evidenceParam = searchParams.get("evidence");
  const exactRunId = searchParams.get("run");
  // Issuer opened from the directory (?issuer=). Absent → the ATLF reference deal
  // (the bespoke showcase). The live engine overlay is keyed off this id; the
  // bespoke debate/recovery/covenant tabs and DEAL narrative are ATLF fixtures,
  // so for a non-reference issuer we land on a live module and mark them as the
  // reference template rather than implying they are that issuer's own analysis.
  const issuerId = searchParams.get("issuer") || ATLF_REFERENCE_ISSUER_ID;
  const isReference = issuerId === ATLF_REFERENCE_ISSUER_ID;
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
    if (isReference) { setIssuerMeta(null); return; }
    let stale = false;
    setIssuerErr(false);
    getIssuerProfile(issuerId)
      .then((d) => { if (!stale) setIssuerMeta({ name: d.issuer.name, ticker: d.issuer.ticker, signals: d.signals }); })
      .catch(() => { if (!stale) { setIssuerMeta(null); setIssuerErr(true); } });
    return () => { stale = true; };
  }, [issuerId, isReference, issuerAttempt]);
  const code = isReference ? DEAL.code : (issuerMeta?.ticker || "—");
  const dealLabel = isReference ? DEAL.deal : (issuerMeta?.name ?? (issuerErr ? "Issuer unavailable" : "Loading issuer…"));
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

  // Module-launcher accordion. Wide screens (≥2xl) open every layer at once —
  // there is room for the whole tree. Below 2xl the accordion is EXCLUSIVE: one
  // layer open at a time (opening a layer closes the others), so the strip never
  // accumulates open layers and grows past the viewport into a scroll-hunt.
  // (critique: launcher overflow) The active tab's layer is always the open one
  // after a navigation.
  const activeLayer = GROUPS.find((g) => g.mods.includes(tab))?.label ?? null;
  const [wide, setWide] = useState(false);
  const [openLayers, setOpenLayers] = useState<Set<string>>(() => new Set(activeLayer ? [activeLayer] : []));
  // Track the 2xl breakpoint so the accordion knows whether to be all-open or
  // exclusive; matchMedia so it flips exactly at the layout boundary.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1536px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  // Reset to the mode default when the breakpoint flips: all-open when wide,
  // just the active layer when narrow (collapses everything else).
  useEffect(() => {
    setOpenLayers(wide ? new Set(GROUPS.map((g) => g.label)) : new Set(activeLayer ? [activeLayer] : []));
    // Only re-seed on a breakpoint flip; navigations are handled below so a
    // user's opened layer isn't wiped on every resize tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wide]);
  // Keep the active layer visible on tab navigation — exclusive when narrow.
  useEffect(() => {
    if (!activeLayer) return;
    setOpenLayers((prev) => (wide ? new Set(prev).add(activeLayer) : new Set([activeLayer])));
  }, [activeLayer, wide]);
  const toggleLayer = (l: string) => setOpenLayers((prev) => {
    if (wide) { const n = new Set(prev); if (n.has(l)) n.delete(l); else n.add(l); return n; }
    // Narrow: exclusive. Re-clicking the only open layer collapses it.
    return prev.has(l) && prev.size === 1 ? new Set() : new Set([l]);
  });

  // Launcher strip horizontal-scroll affordance: edge fades + chevrons that
  // appear only when there's more off-screen, and the active chip is scrolled
  // into view on navigation so it's never stranded past the fold. (critique:
  // active chip can sit outside the viewport / only affordance is a 7px bar)
  const stripRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const syncEdges = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);
  const nudgeStrip = (dir: number) => {
    const el = stripRef.current;
    // Instant paging, not smooth: this is a flow-state terminal control, and an
    // instant jump is also the correct reduced-motion behaviour.
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7 });
  };
  // Re-measure the fades whenever the content width can change (layer open/close,
  // breakpoint flip) and on window resize.
  useEffect(() => {
    syncEdges();
    window.addEventListener("resize", syncEdges);
    return () => window.removeEventListener("resize", syncEdges);
  }, [syncEdges, openLayers, wide]);
  // Bring the selected module chip into view after a navigation (click, ?mod=,
  // or Alt+,/. cycle) or when its layer (re)opens — but ONLY when it's actually
  // off-screen. Scrolling an already-visible chip on first paint slices the
  // left group label ("‹ …OUTPUTS"); leave the strip at its start instead.
  useEffect(() => {
    const strip = stripRef.current;
    const chip = strip?.querySelector<HTMLElement>('[data-active-chip="true"]');
    if (!strip || !chip) return;
    const chipLeft = chip.offsetLeft;
    const chipRight = chipLeft + chip.offsetWidth;
    const offLeft = chipLeft < strip.scrollLeft;
    const offRight = chipRight > strip.scrollLeft + strip.clientWidth;
    if (offLeft || offRight) chip.scrollIntoView({ inline: "center", block: "nearest" });
  }, [tab, openLayers]);
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
  // Launcher/gate display state. The ATLF sim narrates the reference deal only;
  // a real issuer's module reflects THIS run's per-module qa_status via
  // moduleLiveState — pass / warning (Restricted) / failed (Blocked) / hollow-idle
  // (not produced). A Blocked module is persisted with output, so keying off
  // liveOuts presence alone would light it a false green; qa_status is the honest
  // signal. Never the reference sim's green theater. (critique: implied completion
  // that is not this issuer's; identify failed modules)
  const modState = (id: string) => (isReference ? gateState(GATE[id] || id) : moduleLiveState(live.liveStatus[id]));
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
  const moduleIsLive = !useBespoke && !!live.liveOuts[tab];
  // A real issuer's open module that hit the engine's failure gate (qa_status
  // Blocked). Distinct from "no output" (never produced) — the row exists, the
  // analysis didn't complete. Drives a ✕ FAILED badge + an explicit failed pane
  // instead of an empty ModuleView under a ● LIVE badge.
  const moduleFailed = !isReference && moduleLiveState(live.liveStatus[tab]) === "failed";
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
  const decisionAsOf = live.asOf ? fmtUtcDateTime(live.asOf) : (isReference ? "2026-05-31 · reference fixture" : null);
  const decisionProvenance = fromReportCaveat(caveatKind, caveatKind === "reference" && !!live.runId);
  const deepAuthority = decisionAsOf && decisionProvenance ? {
    provenance: { ...decisionProvenance, asOf: decisionAsOf },
    approval: live.committeeStatus === "Approved" ? "RATIFIED" as const : "UNRATIFIED" as const,
  } : undefined;
  const unavailableDeepState = live.loading
    ? { kind: "loading" as const, message: "Checking latest completed run…" }
    : live.phase === "error"
      ? { kind: "error" as const, message: "Latest run could not be loaded" }
      : { kind: "unavailable" as const, message: live.phase === "in_flight" ? "Latest run is still in flight" : "No completed run available" };
  const deepDecision: DecisionContextState = decisionAsOf && (caveatKind === "reference" || caveatKind === "live")
    ? {
        whatChanged: { kind: "ready", value: caveatKind === "reference" ? `${run.completed}/${run.total} modules cleared` : `${Object.keys(live.liveOuts).length} module${Object.keys(live.liveOuts).length === 1 ? "" : "s"} with live output`, asOf: decisionAsOf, authority: deepAuthority },
        whyItMatters: live.council[0]
          ? { kind: "ready", value: `${live.council[0].finding_id} — ${live.council[0].severity}${live.council.length > 1 ? ` (+${live.council.length - 1} more)` : ""}`, asOf: decisionAsOf, authority: deepAuthority }
          : live.committeeStatus
            ? { kind: "ready", value: `Committee status: ${live.committeeStatus}`, asOf: decisionAsOf, authority: deepAuthority }
            : { kind: "observed-empty", message: "No committee finding observed", asOf: decisionAsOf, authority: deepAuthority },
        requiredAction: { kind: "ready", value: live.council[0]?.required_remediation ?? (caveatKind === "reference" ? "Review CP-6A debate before committee" : "Review live module outputs"), asOf: decisionAsOf, authority: deepAuthority },
        evidenceHealth: { kind: "ready", value: decisionProvenance?.detail ?? "Evidence lineage available", asOf: decisionAsOf, authority: deepAuthority },
      }
    : { whatChanged: unavailableDeepState, whyItMatters: unavailableDeepState, requiredAction: unavailableDeepState, evidenceHealth: unavailableDeepState };

  const syncContext = analysis.context;
  const patchContext = analysis.patch;
  useEffect(() => {
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
  }, [issuerId, live.runId, patchContext, syncContext]);

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
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Layout</span>
        {([
          { v: "summary" as const, label: "Summary", t: "Clean layer read: verdict-first, no model outputs or workflow cards" },
          { v: "report" as const, label: "Report", t: "Committee report: module outputs plus consolidated workflow cards" },
          { v: "dense" as const, label: "Dense", t: "Audit view: module outputs plus every workflow card packed tight" },
        ]).map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={layout === o.v}
            onClick={() => pickLayout(o.v)}
            title={o.t}
            className={
              "tabular text-caos-2xs px-1.5 py-0.5 rounded border transition-caos focus-ring " +
              (layout === o.v
                ? "bg-caos-elevated text-caos-text border-caos-accent"
                : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
            }
          >
            {o.label}
          </button>
        ))}
        <SimControls run={run} />
      </>
    ),
  };

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
              title="Seeded ATLF reference showcase — illustrative run #2641, not a database run. Genuinely live engine output is marked ● LIVE per module."
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
      primaryAction={
        <button
          onClick={() => void affirmView()}
          disabled={isReference || !live.runId || analysis.loading || affirmState === "saving"}
          title={isReference ? "Reference output cannot be ratified" : "Append an immutable thesis version and pin the affirmed view"}
          className="caos-primary-action focus-ring disabled:opacity-40"
        >
          {affirmState === "saving" ? "Affirming…" : affirmState === "saved" ? "Thesis affirmed" : "Affirm thesis"}
        </button>
      }
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
            <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted hidden xl:inline">Layout</span>
            {([
              { v: "summary" as const, label: "Summary", t: "Clean layer read: verdict-first, no model outputs or workflow cards" },
              { v: "report" as const, label: "Report", t: "Committee report: module outputs plus consolidated workflow cards" },
              { v: "dense" as const, label: "Dense", t: "Audit view: module outputs plus every workflow card packed tight" },
            ]).map((o) => (
              <button
                key={o.v}
                type="button"
                aria-pressed={layout === o.v}
                onClick={() => pickLayout(o.v)}
                title={o.t}
                className={
                  "tabular text-caos-2xs px-1.5 py-0.5 rounded border transition-caos focus-ring " +
                  (layout === o.v
                    ? "bg-caos-elevated text-caos-text border-caos-accent"
                    : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
                }
              >
                {o.label}
              </button>
            ))}
          </div>
          {live.runId ? <ExportToVaultButton runId={live.runId} /> : null}
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
      <section className="sm:hidden flex-1 min-h-0 overflow-auto p-3" aria-label="Deep-Dive phone triage">
        <div className="rounded border border-caos-border bg-caos-panel">
          <div className="flex items-center justify-between gap-3 border-b border-caos-border px-3 py-2">
            <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-accent">Phone triage · read only</span>
            <span className="flex items-center gap-1 tabular text-caos-xs text-caos-muted">
              <StatusGlyph kind={caveatKind === "live" ? "success" : caveatKind === "error" ? "blocked" : "idle"} />
              {caveatKind === "live" ? "Live run" : caveatKind === "error" ? "Run unavailable" : "Reference or incomplete"}
            </span>
          </div>
          <div className="grid gap-4 p-4">
            <div>
              <div className="text-caos-xl font-medium text-caos-text">{dealLabel}</div>
              <div className="mt-1 text-caos-sm leading-relaxed text-caos-muted">
                Read posture, freshness and clearance here. Module authoring, evidence synchronization, layouts, simulation, issuer chat, QA actions and exports remain available on the desktop workstation.
              </div>
            </div>
            <dl className="grid gap-px overflow-hidden rounded border border-caos-border bg-caos-border tabular text-caos-xs">
              <div className="bg-caos-elevated p-3"><dt className="uppercase tracking-wider text-caos-muted">Standing view</dt><dd className="mt-1 text-caos-text">{"value" in deepDecision.whatChanged ? deepDecision.whatChanged.value : "message" in deepDecision.whatChanged ? deepDecision.whatChanged.message : "Observation unavailable"}</dd></div>
              <div className="bg-caos-elevated p-3"><dt className="uppercase tracking-wider text-caos-muted">Required action</dt><dd className="mt-1 text-caos-text">{"value" in deepDecision.requiredAction ? deepDecision.requiredAction.value : "message" in deepDecision.requiredAction ? deepDecision.requiredAction.message : "Action unavailable"}</dd></div>
              <div className="bg-caos-elevated p-3"><dt className="uppercase tracking-wider text-caos-muted">Evidence health</dt><dd className="mt-1 text-caos-text">{"value" in deepDecision.evidenceHealth ? deepDecision.evidenceHealth.value : "message" in deepDecision.evidenceHealth ? deepDecision.evidenceHealth.message : "Evidence unavailable"}</dd></div>
              <div className="bg-caos-elevated p-3"><dt className="uppercase tracking-wider text-caos-muted">Run progress</dt><dd className="mt-1 text-caos-text">{run.completed}/{run.total} modules</dd></div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/query?issuer=${encodeURIComponent(issuerId)}${analysis.context ? `&context=${encodeURIComponent(analysis.context.id)}` : ""}`}
                className="caos-action-secondary no-underline focus-ring"
              >
                Investigate in Query
              </Link>
              <Link
                href={`/pipeline?issuer=${encodeURIComponent(issuerId)}${live.runId ? `&run=${encodeURIComponent(live.runId)}` : ""}${analysis.context ? `&context=${encodeURIComponent(analysis.context.id)}` : ""}`}
                className="caos-action-secondary no-underline focus-ring"
              >
                Hand off to desk
              </Link>
            </div>
          </div>
        </div>
      </section>
      <div className="hidden sm:contents">
      {/* Decision header — evidence health mirrors the same caveat grammar the
          identity chip already states; the other three cells lean only on
          data this page already fetched (the sim clock, live module count,
          CP-5C council). Loading/error/no-run all honestly read "— no data"
          rather than a guessed decision. */}
      <div className="px-2.5 py-2 bg-caos-panel border-b border-caos-border">
        <ScenarioNetworkPanel issuerId={issuerId} runId={live.runId} />
      </div>
      {/* module launcher strip — each layer collapses to its name + status dots;
          click a layer to reveal its modules (named; short label on smaller panes).
          Wrapped so edge fades + chevrons sit above the scroller and signal
          off-screen layers (the native bar is hidden — redundant noise). */}
      <div className="relative shrink-0 border-b border-caos-border">
      <div
        ref={stripRef}
        onScroll={syncEdges}
        className="h-9 bg-caos-panel/40 flex items-center px-4 gap-2 overflow-x-auto caos-no-scrollbar"
      >
        <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap hidden lg:inline" title="Alt + , / .  cycles the open module">Module outputs</span>
        <ModuleFinder onSelect={setTab} activeId={tab} />
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
                {!open ? (() => {
                  // Aggregate the layer's module states into counts instead of a
                  // run of up to 7 undifferentiated glyphs (which read as soup).
                  let cleared = 0, failed = 0, pending = 0;
                  for (const id of g.mods) {
                    const st = modState(id);
                    if (isCleared(st)) cleared++;
                    else if (st === "failed") failed++;
                    else pending++;
                  }
                  const parts = [
                    cleared ? { key: "ok", n: cleared, dot: <Dot sev="pass" glyph />, word: `${cleared} cleared` } : null,
                    failed ? { key: "fail", n: failed, dot: <Dot sev="blocked" glyph />, word: `${failed} failed` } : null,
                    pending ? { key: "pend", n: pending, dot: <StatusGlyph kind={isReference ? "locked" : "idle"} />, word: `${pending} ${isReference ? "gated" : "no output"}` } : null,
                  ].filter(Boolean) as { key: string; n: number; dot: React.ReactNode; word: string }[];
                  return (
                    <span className="flex items-center gap-1.5" aria-label={parts.map((p) => p.word).join(", ")}>
                      {parts.map((p) => (
                        <span key={p.key} className="flex items-center gap-0.5" aria-hidden="true">
                          <span className="tabular text-caos-2xs text-caos-muted">{p.n}</span>
                          {p.dot}
                        </span>
                      ))}
                    </span>
                  );
                })() : null}
                <span className="tabular text-caos-2xs text-caos-muted">{open ? "▾" : "▸"}</span>
              </button>
              {open ? (
                <span className="flex items-center gap-1">
                  {/* fallow-ignore-next-line complexity */}
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
              className="absolute left-0 inset-y-0 px-1.5 flex items-center text-caos-lg text-caos-muted hover:text-caos-text transition-caos focus-ring"
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
              className="absolute right-0 inset-y-0 px-1.5 flex items-center text-caos-lg text-caos-muted hover:text-caos-text transition-caos focus-ring"
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
        runId={live.runId}
        onRevise={(id) => setTab(id)}
      />

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
              {moduleFailed ? (
                <span className="tabular text-caos-xs" style={{ color: "var(--caos-critical)" }} title="This module hit its failure gate (qa_status Blocked) and did not complete — no usable output.">
                  ✕ FAILED
                </span>
              ) : moduleIsLive ? (
                <span className="tabular text-caos-xs" style={{ color: "var(--caos-accent)" }} title="Rendering this issuer's live engine output for this module">
                  ● LIVE
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
              <>
                <CovenantsTab onOpenEvidence={setEvModal} layout={layout} />
                <CrossDefaultDominoes issuerId={issuerId} hasRun={!!live.runId} />
              </>
            ) : (
              <>
                <ModuleView id={tab} sim={run.sim} onOpenEvidence={setEvModal} liveOut={live.liveOuts[tab]} allowSeededFallback={isReference} layout={layout} />
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
          council={live.council}
          councilState={isReference ? "ready" : live.loading ? "loading" : live.phase === "error" ? "error" : live.runId ? "ready" : "unavailable"}
          isReference={isReference}
          issuerCode={code}
        />
      </div>

      {evModal && reports ? <EvidenceModal id={evModal} reports={reports} live={live.liveEvidence} isLiveRun={!isReference && !!live.runId} onClose={() => setEvModal(null)} /> : null}
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
