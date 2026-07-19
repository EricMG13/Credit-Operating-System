"use client";

// Concept F — The Monitor: CP-MON email-intelligence intake alongside the live
// Watchtower alert-routing rail, promoted out of the Command Center into its
// own standing surface. This is the "trading-desk alertness" pillar — a
// stream you watch, distinct in cadence from the posture/coverage snapshots
// in Command. Email Intelligence (CP-MON) is the primary column; the Alert
// Routing rail leads with real Watchtower/Sentinel output and demotes CP-MON-
// H's seeded showcase tape behind a disclosure — CP-MON-H (an email-derived
// alert router) has no live implementation yet (routes/sector.py: "CP-MON
// stay registry-pending"), so it is never the panel's own name once
// Watchtower output is what's actually leading it (G8 cleanup).

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { headStat } from "@/components/shared/headStat";
import { ActionReason } from "@/components/shared/ActionReason";
import { Button } from "@/components/ui/Button";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { useBreakpoint } from "@/lib/useBreakpoint";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { simAlertsToday, CRITICAL_ALERTS } from "@/lib/command/data";
import { fmtUtcDateTime } from "@/lib/format-date";
import { useSharedDayRun } from "@/lib/pipeline/sim";
import { Dot, SimControls } from "@/components/pipeline/atoms";
import { Panel as PanelShell } from "@/components/shared/Panel";
import { AlertFeed, EmailIntel } from "@/components/command/views";
import { AlertInbox } from "@/components/monitor/AlertInbox";
import { PhoneTriage } from "@/components/monitor/PhoneTriage";
import { useAutonomyDraft } from "@/lib/engine/useAutonomyDraft";
import { draftToAlertRows, requiredActionFor } from "@/lib/alerts/inbox";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { GovernancePanel } from "@/components/command/GovernancePanel";
import { ControlPlanePanel } from "@/components/monitor/ControlPlanePanel";
import { usePortfolio } from "@/lib/engine/usePortfolio";
import { useGovernanceSources } from "@/lib/command/useGovernanceSources";
import type { DecisionAuthority, DecisionContextState, DecisionDatumState } from "@/lib/decision-state";
import { WorkbenchToolbar } from "@/components/shared/WorkbenchToolbar";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { SemanticVisualization, type VisualizationSpec } from "@/components/charts/SemanticVisualization";
import { useRoleView } from "@/components/shared/RoleViewProvider";
import { contextHref, useAnalysisContext, type InsightArtifact } from "@/lib/analysis-workbench";
import { useTypedUrlState, type TypedUrlUpdate } from "@/lib/typed-url-state";
import { AnalysisContextSaveState } from "@/components/shared/AnalysisContextSaveState";
import { GovernanceSummary } from "@/components/shared/GovernanceSummary";
import { useSurfaceInsight } from "@/lib/use-surface-insight";

const MONITOR_URL_KEYS = ["dataset", "severity", "selected"] as const;
type MonitorDataset = "alerts" | "email" | "governance";
type MonitorUrlKey = (typeof MONITOR_URL_KEYS)[number];
type MonitorUrlUpdater = (changes: TypedUrlUpdate<MonitorUrlKey>, mode?: "push" | "replace") => void;

function resolveMonitorDataset(value: string | null, roleView: ReturnType<typeof useRoleView>["roleView"]): MonitorDataset {
  if (value === "email" || value === "governance") return value;
  return roleView === "qa" ? "governance" : "alerts";
}

function selectionDetail(event: Event) {
  const detail = (event as CustomEvent<{ count: number; eventId: string | null }>).detail;
  return { count: detail?.count ?? 0, eventId: detail?.eventId ?? null };
}

function syncSelectedAlert(analysis: ReturnType<typeof useAnalysisContext>, eventId: string | null) {
  const context = analysis.context;
  if (!context || !eventId || context.artifacts.alert_event_id === eventId) return;
  void analysis.patch({
    artifacts: { ...context.artifacts, alert_event_id: eventId },
    surface_state: { ...context.surface_state, monitor: { ...context.surface_state.monitor, active_id: eventId } },
  }).catch(() => undefined);
}

function useMonitorSelection(analysis: ReturnType<typeof useAnalysisContext>, updateUrlState: MonitorUrlUpdater) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const updateSelection = (event: Event) => {
      const detail = selectionDetail(event);
      setCount(detail.count);
      updateUrlState({ selected: detail.eventId }, "replace");
      syncSelectedAlert(analysis, detail.eventId);
    };
    window.addEventListener("caos:monitor-selection", updateSelection);
    return () => window.removeEventListener("caos:monitor-selection", updateSelection);
  }, [analysis, updateUrlState]);
  return count;
}

function useMonitorInsight(contextId: string | null | undefined, selected: string | null) {
  return useSurfaceInsight(contextId, {
    surface: "monitor",
    kind: "alert-brief",
    subjectRefs: { alert_event_id: selected },
    loadingMessage: "Generating cited alert brief…",
    emptyMessage: "No cited advisory brief is available.",
    errorMessage: "Cited alert brief is unavailable.",
  });
}

type MonitorDecisionInput = {
  draft: ReturnType<typeof useAutonomyDraft>["draft"];
  loading: boolean;
  offline: boolean;
  rows: ReturnType<typeof draftToAlertRows>;
};

function monitorDecisionAuthority(input: MonitorDecisionInput) {
  const asOf = input.draft?.generated_at ? fmtUtcDateTime(input.draft.generated_at) : null;
  const authority: DecisionAuthority | undefined = asOf ? {
    provenance: { origin: "LIVE", method: "MODELLED", freshness: "CURRENT", detail: "Autonomy draft alert routing.", asOf },
    approval: input.draft?.ratified ? "RATIFIED" : "UNRATIFIED",
  } : undefined;
  return { asOf, authority };
}

function unavailableMonitorDatum(input: MonitorDecisionInput): DecisionDatumState {
  if (input.loading) return { kind: "loading", message: "Checking autonomy draft…" };
  if (input.offline) return { kind: "offline", lastKnown: "Autonomy endpoint unavailable" };
  return { kind: "partial", value: "Draft answered without an observation timestamp", missingSources: ["generated_at"], asOf: "timestamp missing" };
}

function observedMonitorDatum(value: string | null, emptyMessage: string, asOf: string, authority: DecisionAuthority | undefined): DecisionDatumState {
  return value ? { kind: "ready", value, asOf, authority } : { kind: "observed-empty", message: emptyMessage, asOf, authority };
}

function buildMonitorDecision(input: MonitorDecisionInput): DecisionContextState {
  const { asOf, authority } = monitorDecisionAuthority(input);
  if (!asOf) {
    const unavailable = unavailableMonitorDatum(input);
    return { whatChanged: unavailable, whyItMatters: unavailable, requiredAction: unavailable, evidenceHealth: unavailable };
  }
  const top = input.rows[0];
  const changed = input.rows.length ? input.rows.slice(0, 3).map((row) => row.event).join(" · ") : null;
  const impact = top ? `${top.reason} · severity ${top.severity}` : null;
  const action = top ? requiredActionFor(top) : null;
  const routed = `${input.rows.length} alert${input.rows.length === 1 ? "" : "s"} routed from the autonomy draft`;
  return {
    whatChanged: observedMonitorDatum(changed, "No routed alerts observed", asOf, authority),
    whyItMatters: observedMonitorDatum(impact, "No portfolio impact observed", asOf, authority),
    requiredAction: observedMonitorDatum(action, "No acknowledgment required", asOf, authority),
    evidenceHealth: { kind: "ready", value: routed, asOf, authority },
  };
}

export default function MonitorPage() {
  return (
    <RequireAuth>
      <Monitor />
    </RequireAuth>
  );
}

type MonitorSurfaceStatus = "loading" | "error" | "ready";

type MonitorViewProps = {
  analysis: ReturnType<typeof useAnalysisContext>;
  dataset: MonitorDataset;
  updateUrlState: MonitorUrlUpdater;
  datasetControlsReady: boolean;
  datasetSwitchReason: string | null;
  selectedAlertCount: number;
  isPhone: boolean;
  autonomyLoading: boolean;
  autonomyOffline: boolean;
  liveRows: ReturnType<typeof draftToAlertRows>;
  hasLiveAlerts: boolean;
  portfolio: ReturnType<typeof usePortfolio>;
  digest: ReturnType<typeof useGovernanceSources>["digest"];
  digestLive: boolean;
  liveQa: ReturnType<typeof useGovernanceSources>["liveQa"];
  liveFailed: ReturnType<typeof useGovernanceSources>["liveFailed"];
  liveGapsItems: ReturnType<typeof useGovernanceSources>["liveGapsItems"];
  liveMixed: ReturnType<typeof useGovernanceSources>["liveMixed"];
  qaStatus: MonitorSurfaceStatus;
  findingStatus: MonitorSurfaceStatus;
  digestStatus: MonitorSurfaceStatus;
  showDemo: boolean;
  toggleDemo: () => void;
  run: ReturnType<typeof useSharedDayRun>;
  running: boolean;
  done: boolean;
  tick: number;
  alertsToday: number;
  criticalOnly: boolean;
  simState: string;
  draftAsOf: string | null;
  monitorDecision: DecisionContextState;
  insight: InsightArtifact | null;
  insightMessage: string | null;
  generateInsight: () => Promise<void>;
};

function MonitorIdentity() {
  const provenance = <ProvenanceChip prov={{ origin: "LIVE", detail: "Alert worklist, governance, and control plane are live. The routing tape inside the inbox is a seeded replay, labeled where it appears." }} />;
  return <ShellIdentity tag="CP-MON" badges={provenance} title="Monitor — email intelligence & alert routing" />;
}

function acknowledgeReason(view: MonitorViewProps) {
  if (view.selectedAlertCount > 0) return null;
  if (view.hasLiveAlerts) return "Select live alerts in the worklist first.";
  return "No live alerts to acknowledge — the demo tape below is a read-only replay.";
}

function MonitorPrimaryAction({ view }: { view: MonitorViewProps }) {
  const count = view.selectedAlertCount ? ` (${view.selectedAlertCount})` : "";
  return <ActionReason reason={acknowledgeReason(view)} reasonDisplay="hidden" onClick={() => window.dispatchEvent(new Event("caos:monitor-ack-selected"))} className="caos-action-primary focus-ring">Acknowledge selected{count}</ActionReason>;
}

function MonitorHeaderStatus({ view }: { view: MonitorViewProps }) {
  return <>{view.draftAsOf ? <span className="tabular text-caos-2xs text-caos-muted">Observed {view.draftAsOf}</span> : null}<AnalysisContextSaveState analysis={view.analysis} /></>;
}

function MonitorUtilities({ view }: { view: MonitorViewProps }) {
  return <div className="grid gap-3"><SimControls run={view.run} /><span className="tabular text-caos-xs text-caos-muted">{view.simState} · {view.run.clock} ET</span>{view.analysis.context ? <Link href={contextHref("/command", view.analysis.context.id)} className="caos-action-secondary no-underline focus-ring">Open Command</Link> : null}</div>;
}

function MonitorToolbar({ view }: { view: MonitorViewProps }) {
  const count = view.autonomyLoading ? "Loading" : view.autonomyOffline ? "Offline" : `${view.liveRows.length} live alerts`;
  return <WorkbenchToolbar title="Alert worklist" description="Acknowledge, assign and hand off routed events; phone remains triage-only." count={count} viewLabel="Shared worklist" />;
}

function CriticalReplayFilter({ view }: { view: MonitorViewProps }) {
  const title = (view.criticalOnly ? "Show all routed alerts. " : "Filter the replay tape to critical. ") + "Seeded demo replay count — not live routed alerts (see the worklist below for live).";
  const selectedClass = view.criticalOnly ? "caos-selected bg-caos-elevated border-caos-critical/60" : "border-transparent";
  return <button type="button" onClick={() => view.updateUrlState({ severity: view.criticalOnly ? null : "critical" })} aria-pressed={view.criticalOnly} title={title} className={`rounded border px-1.5 py-0.5 -my-0.5 transition-caos focus-ring hover:bg-caos-elevated/70 ${selectedClass}`}>{headStat("Replay criticals", String(CRITICAL_ALERTS), "var(--caos-critical)", true)}</button>;
}

function SeededReplay({ view }: { view: MonitorViewProps }) {
  return <>
    <AlertInbox />
    <div className="flex items-center gap-2 border-t-2 border-caos-border px-3 min-h-8">
      <button type="button" onClick={view.toggleDemo} aria-expanded={view.showDemo} className="flex items-center gap-2 tabular text-caos-2xs uppercase tracking-widest text-caos-muted hover:text-caos-text transition-caos focus-ring caos-target">{view.showDemo ? "− " : "+ "}Seeded replay · CP-MON-H demo tape</button>
      <span className="ml-auto flex items-center gap-3"><CriticalReplayFilter view={view} /><span title="Seeded demo replay count for the simulated day — live routed-alert counts are in the worklist above.">{headStat("Replay today", String(view.alertsToday), "var(--caos-accent)", true)}</span></span>
    </div>
    {view.showDemo ? <AlertFeed tick={view.tick} running={view.running} done={view.done} sevFilter={view.criticalOnly ? "critical" : null} /> : null}
  </>;
}

function MonitorDatasetContent({ view }: { view: MonitorViewProps }) {
  if (view.dataset === "email") return <EmailIntel />;
  if (view.dataset === "governance") return <GovernancePanel findingStatus={view.findingStatus} qaStatus={view.qaStatus} digestStatus={view.digestStatus} liveQa={view.liveQa} liveFailedGates={view.liveFailed} liveGaps={view.liveGapsItems} liveMixedOrigin={view.liveMixed} staleRows={view.digestLive ? view.digest?.stale ?? [] : []} />;
  return view.isPhone ? <PhoneTriage /> : <SeededReplay view={view} />;
}

function monitorDatasetTitle(view: MonitorViewProps) {
  if (view.dataset === "email") return "Email Intelligence · CP-MON intake";
  if (view.dataset === "governance") return "Governance queue · CP-5 / CP-0 / Staleness";
  return view.isPhone ? "Alert triage · autonomy routing" : "Alert inbox · autonomy routing";
}

function monitorDatasetLabel(dataset: MonitorDataset) {
  if (dataset === "email") return "Email intelligence worklist";
  if (dataset === "governance") return "Governance worklist";
  return "Alert inbox worklist";
}

function MonitorDatasetTabs({ view }: { view: MonitorViewProps }) {
  return <div role="tablist" aria-label="Monitor dataset" aria-busy={!view.datasetControlsReady} className="flex items-center gap-1"><Button variant="secondary" type="button" role="tab" aria-selected={view.dataset === "alerts"} reason={view.datasetSwitchReason} reasonDisplay="hidden" onClick={() => view.updateUrlState({ dataset: "alerts" })}>Alerts</Button><Button variant="secondary" type="button" role="tab" aria-selected={view.dataset === "email"} reason={view.datasetSwitchReason} reasonDisplay="hidden" onClick={() => view.updateUrlState({ dataset: "email" })}>Email intake</Button><Button variant="secondary" type="button" role="tab" aria-selected={view.dataset === "governance"} reason={view.datasetSwitchReason} reasonDisplay="hidden" onClick={() => view.updateUrlState({ dataset: "governance" })}>Governance</Button></div>;
}

function MonitorDatasetPanel({ view }: { view: MonitorViewProps }) {
  return <PanelShell title={monitorDatasetTitle(view)} className="min-h-0 h-full" right={<MonitorDatasetTabs view={view} />}><DominantTableRegion ownerId="monitor-alert-inbox" label={monitorDatasetLabel(view.dataset)} className="h-full"><MonitorDatasetContent view={view} /></DominantTableRegion></PanelShell>;
}

function MonitorCitedBrief({ view }: { view: MonitorViewProps }) {
  const label = view.insight ? "Refresh cited brief" : "Generate cited brief";
  const content = view.insight ? <article className="p-2 grid gap-2"><p className="text-caos-sm text-caos-text">{view.insight.summary}</p><ul className="grid gap-1">{view.insight.claims.map((claim) => <li key={claim.id} className="text-caos-xs text-caos-muted">{claim.statement} · sources {claim.evidence_ids.join(", ") || "missing"}</li>)}</ul></article> : <p role="status" className="p-2 text-caos-xs text-caos-muted">{view.insightMessage ?? "No cited brief generated."}</p>;
  return <PanelShell title="Cited alert brief"><button type="button" onClick={() => void view.generateInsight()} className="caos-action-secondary focus-ring">{label}</button>{content}</PanelShell>;
}

function MonitorInspector({ view }: { view: MonitorViewProps }) {
  return <div className="grid gap-2"><GovernanceSummary coldStart={!view.portfolio.live && !view.portfolio.error && !view.portfolio.loading} qa={view.liveQa?.length} failed={view.liveFailed?.length} gaps={view.liveGapsItems?.length} mixed={view.liveMixed?.length} stale={view.digestLive ? view.digest?.stale?.length ?? 0 : undefined} onOpen={() => view.updateUrlState({ dataset: "governance" })} /><PanelShell title="Coverage Control Plane · ingestion"><ControlPlanePanel /></PanelShell><MonitorCitedBrief view={view} /></div>;
}

function MonitorWorkbench({ view }: { view: MonitorViewProps }) {
  return <><MonitorToolbar view={view} /><div id="alert-inbox" className="caos-persona-route monitor-workbench flex-1 min-h-0 p-2" tabIndex={-1}><PersonaWorkbench surface="monitor" decision={<DecisionHeader state={view.monitorDecision} />} primary={<MonitorDatasetPanel view={view} />} context={<MonitorContext rows={view.liveRows} asOf={view.draftAsOf} simState={view.simState} running={view.running} done={view.done} />} inspector={<MonitorInspector view={view} />} /></div></>;
}

function MonitorView({ view }: { view: MonitorViewProps }) {
  return <EnterprisePage kind="worklist" identity={<MonitorIdentity />} primaryAction={<MonitorPrimaryAction view={view} />} status={<MonitorHeaderStatus view={view} />} utilityLabel="Replay controls" utilityControls={<MonitorUtilities view={view} />} narrowContract={{ essentialControls: <SimControls run={view.run} /> }}><MonitorWorkbench view={view} /></EnterprisePage>;
}

function useMonitorNavigation() {
  const analysis = useAnalysisContext({ name: "Alert oversight" });
  const { roleView } = useRoleView();
  const { values, update } = useTypedUrlState(MONITOR_URL_KEYS);
  const selectedAlertCount = useMonitorSelection(analysis, update);
  const { breakpoint } = useBreakpoint();
  const datasetControlsReady = !analysis.loading;
  return {
    analysis,
    dataset: resolveMonitorDataset(values.dataset, roleView),
    updateUrlState: update,
    selected: values.selected,
    criticalOnly: values.severity === "critical",
    selectedAlertCount,
    isPhone: breakpoint === "mobile",
    datasetControlsReady,
    datasetSwitchReason: datasetControlsReady ? null : "Dataset switch is not available until the page finishes loading.",
  };
}

function useMonitorAlerts() {
  const autonomy = useAutonomyDraft();
  const [demoOverride, setDemoOverride] = useState<boolean | null>(null);
  const run = useSharedDayRun();
  const liveRows = autonomy.draft ? draftToAlertRows(autonomy.draft) : [];
  const hasLiveAlerts = !autonomy.offline && liveRows.length > 0;
  const showDemo = demoOverride ?? !hasLiveAlerts;
  const running = run.playing && !run.sim.done;
  const done = run.sim.done;
  const tick = run.sim.tick;
  return {
    autonomy,
    liveRows,
    hasLiveAlerts,
    showDemo,
    toggleDemo: () => setDemoOverride(!showDemo),
    run,
    running,
    done,
    tick,
    alertsToday: simAlertsToday(tick, !done),
    simState: running ? "SIM" : done ? "COMPLETE" : "PAUSED",
  };
}

function monitorSurfaceStatus(loading: boolean, error: boolean): MonitorSurfaceStatus {
  if (loading) return "loading";
  if (error) return "error";
  return "ready";
}

function useMonitorGovernance() {
  const portfolio = usePortfolio();
  const governance = useGovernanceSources(portfolio);
  return {
    portfolio,
    governance,
    qaStatus: monitorSurfaceStatus(portfolio.loading, Boolean(portfolio.error)),
    findingStatus: monitorSurfaceStatus(portfolio.loading || governance.qaFindingsLoading, Boolean(portfolio.error || governance.qaFindingsError)),
    digestStatus: monitorSurfaceStatus(governance.loading, Boolean(governance.error)),
  };
}

function useMonitorView() {
  const navigation = useMonitorNavigation();
  const alerts = useMonitorAlerts();
  const governanceModel = useMonitorGovernance();
  const insight = useMonitorInsight(navigation.analysis.context?.id, navigation.selected);
  const decisionInput = { draft: alerts.autonomy.draft, loading: alerts.autonomy.loading, offline: alerts.autonomy.offline, rows: alerts.liveRows };
  const governance = governanceModel.governance;
  return {
    analysis: navigation.analysis,
    dataset: navigation.dataset,
    updateUrlState: navigation.updateUrlState,
    datasetControlsReady: navigation.datasetControlsReady,
    datasetSwitchReason: navigation.datasetSwitchReason,
    selectedAlertCount: navigation.selectedAlertCount,
    isPhone: navigation.isPhone,
    autonomyLoading: alerts.autonomy.loading,
    autonomyOffline: alerts.autonomy.offline,
    liveRows: alerts.liveRows,
    hasLiveAlerts: alerts.hasLiveAlerts,
    portfolio: governanceModel.portfolio,
    digest: governance.digest,
    digestLive: governance.live,
    liveQa: governance.liveQa,
    liveFailed: governance.liveFailed,
    liveGapsItems: governance.liveGapsItems,
    liveMixed: governance.liveMixed,
    qaStatus: governanceModel.qaStatus,
    findingStatus: governanceModel.findingStatus,
    digestStatus: governanceModel.digestStatus,
    showDemo: alerts.showDemo,
    toggleDemo: alerts.toggleDemo,
    run: alerts.run,
    running: alerts.running,
    done: alerts.done,
    tick: alerts.tick,
    alertsToday: alerts.alertsToday,
    criticalOnly: navigation.criticalOnly,
    simState: alerts.simState,
    draftAsOf: monitorDecisionAuthority(decisionInput).asOf,
    monitorDecision: buildMonitorDecision(decisionInput),
    insight: insight.insight,
    insightMessage: insight.message,
    generateInsight: insight.generate,
  } satisfies MonitorViewProps;
}

function Monitor() {
  const view = useMonitorView();
  return <MonitorView view={view} />;
}

function MonitorContext({ rows, asOf, simState, running, done }: { rows: ReturnType<typeof draftToAlertRows>; asOf: string | null; simState: string; running: boolean; done: boolean }) {
  const severityBand = (value: number) => value >= 3 ? "critical" : value >= 2 ? "high" : value >= 1 ? "medium" : "low";
  const severities = ["critical", "high", "medium", "low"].map((severity) => ({ severity, count: rows.filter((row) => severityBand(row.severity) === severity).length }));
  const spec: VisualizationSpec = {
    kind: "bar",
    title: "Routed alerts by severity",
    unit: "alerts",
    asOf: asOf ?? undefined,
    sourceIds: ["autonomy-draft"],
    accessibleSummary: rows.length ? `${rows.length} live routed alerts; ${severities[0].count} are critical.` : "No live routed alerts are available.",
    status: severities[0].count ? { label: "Critical present", tone: "critical" } : { label: "No critical alert", tone: "success" },
    data: severities,
    tabularFallback: { label: "Alert severity counts", columns: [{ key: "severity", label: "Severity" }, { key: "count", label: "Count" }], data: severities },
    chart: { type: "interval", encode: { x: "severity", y: "count" } },
  };
  return <div className="grid gap-2"><SemanticVisualization spec={spec} /><PanelShell title="Replay state"><div className="p-2 flex items-center gap-1.5"><Dot sev={done ? "ok" : "running"} pulse={running} glyph={done} /><span className="tabular text-caos-xs text-caos-muted">{simState} · alert routing follows the replay clock; email intake is the reconciled EOD tape.</span></div></PanelShell></div>;
}
