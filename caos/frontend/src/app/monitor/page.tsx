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
import dynamic from "next/dynamic";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { Button } from "@/components/ui/Button";
import { EnterprisePage, type PageAction } from "@/components/shared/EnterprisePage";
import { useBreakpoint } from "@/lib/useBreakpoint";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { fmtUtcDateTime } from "@/lib/format-date";
import { Panel as PanelShell } from "@/components/shared/Panel";
import { AlertInbox } from "@/components/monitor/AlertInbox";
import { PhoneTriage } from "@/components/monitor/PhoneTriage";
import { useAutonomyDraft } from "@/lib/engine/useAutonomyDraft";
import { draftToAlertRows, requiredActionFor } from "@/lib/alerts/inbox";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { ControlPlanePanel } from "@/components/monitor/ControlPlanePanel";
import { usePortfolio } from "@/lib/engine/usePortfolio";
import { useGovernanceSources } from "@/lib/command/useGovernanceSources";
import type { DecisionAuthority, DecisionContextState, DecisionDatumState } from "@/lib/decision-state";
import { WorkbenchToolbar } from "@/components/shared/WorkbenchToolbar";
import { PersonaWorkbench, usePersonaComposition, useWorkbenchComposition } from "@/components/shared/PersonaWorkbench";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { SemanticVisualization, type VisualizationSpec } from "@/components/charts/SemanticVisualization";
import { contextHref, useAnalysisContext, type InsightArtifact } from "@/lib/analysis-workbench";
import { useTypedUrlState, type TypedUrlUpdate } from "@/lib/typed-url-state";
import { AnalysisContextSaveState } from "@/components/shared/AnalysisContextSaveState";
import { GovernanceSummary } from "@/components/shared/GovernanceSummary";
import { useSurfaceInsight } from "@/lib/use-surface-insight";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { useDataMode, type DataMode } from "@/lib/data-mode";
import { useScrollOwner } from "@/lib/use-scroll-owner";

const GovernancePanel = dynamic(
  () => import("@/components/command/GovernancePanel").then((module) => module.GovernancePanel),
  { loading: () => <div role="status" aria-live="polite" className="min-h-72 p-3 text-caos-xs text-caos-muted">Loading governance queue…</div> },
);

const ReferenceMonitorReplay = dynamic(
  () => import("@/components/monitor/ReferenceMonitorReplay").then((module) => module.ReferenceMonitorReplay),
  { ssr: false, loading: () => <div role="status" className="p-3 text-caos-xs text-caos-muted">Loading Reference replay…</div> },
);

const ReferenceEmailIntel = dynamic(
  () => import("@/components/command/MonitorStreams").then((module) => module.EmailIntel),
  { ssr: false, loading: () => <div role="status" className="p-3 text-caos-xs text-caos-muted">Loading Reference email intelligence…</div> },
);

const MONITOR_URL_KEYS = ["dataset", "severity", "selected"] as const;
type MonitorDataset = "alerts" | "email" | "governance";
type MonitorUrlKey = (typeof MONITOR_URL_KEYS)[number];
type MonitorUrlUpdater = (changes: TypedUrlUpdate<MonitorUrlKey>, mode?: "push" | "replace") => void;

function resolveMonitorDataset(value: string | null, leadingDataset: string | undefined, dataMode: DataMode): MonitorDataset {
  const allowed: readonly MonitorDataset[] = dataMode === "reference" ? ["alerts", "email"] : ["alerts", "governance"];
  if (allowed.includes(value as MonitorDataset)) return value as MonitorDataset;
  if (allowed.includes(leadingDataset as MonitorDataset)) return leadingDataset as MonitorDataset;
  return "alerts";
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
  dataMode: DataMode;
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
  criticalOnly: boolean;
  draftAsOf: string | null;
  monitorDecision: DecisionContextState;
  insight: InsightArtifact | null;
  insightMessage: string | null;
  generateInsight: () => Promise<void>;
};

function MonitorIdentity({ view }: { view: MonitorViewProps }) {
  const provenance = view.dataMode === "reference"
    ? <ProvenanceChip prov={{ origin: "REFERENCE", detail: "Seeded replay and email examples. No issuer alert routing is represented." }} />
    : <ProvenanceChip prov={{ origin: "LIVE", detail: "Persisted alert routing, governance, and control-plane sources only." }} />;
  return <ShellIdentity tag="CP-MON" badges={provenance} title={view.dataMode === "reference" ? "Monitor — Reference replay & email examples" : "Monitor — live alert worklist"} />;
}

function acknowledgeReason(view: MonitorViewProps) {
  if (view.dataMode === "reference") return "Reference replay is read-only.";
  if (view.selectedAlertCount > 0) return null;
  if (view.hasLiveAlerts) return "Select live alerts in the worklist first.";
  return "No live alerts to acknowledge.";
}

function MonitorPrimaryAction({ view }: { view: MonitorViewProps }): PageAction {
  const count = view.selectedAlertCount ? ` (${view.selectedAlertCount})` : "";
  return {
    label: `Acknowledge selected${count}`,
    onAction: () => window.dispatchEvent(new Event("caos:monitor-ack-selected")),
    unavailableReason: acknowledgeReason(view),
  };
}

function MonitorHeaderStatus({ view }: { view: MonitorViewProps }) {
  return <>{view.draftAsOf ? <span className="tabular text-caos-2xs text-caos-muted">Observed {view.draftAsOf}</span> : null}<AnalysisContextSaveState analysis={view.analysis} /></>;
}

function MonitorUtilities({ view }: { view: MonitorViewProps }) {
  return <div className="grid gap-3"><span className="tabular text-caos-xs text-caos-muted">{view.dataMode === "reference" ? "Seeded Reference fixtures" : "Live routed-alert sources"}</span>{view.analysis.context ? <Link href={contextHref("/command", view.analysis.context.id)} className="caos-action-secondary no-underline focus-ring">Open Command</Link> : null}</div>;
}

function MonitorToolbar({ view }: { view: MonitorViewProps }) {
  const count = view.dataMode === "reference" ? "Seeded examples" : view.autonomyLoading ? "Loading" : view.autonomyOffline ? "Offline" : `${view.liveRows.length} live alerts`;
  return <WorkbenchToolbar title={view.dataMode === "reference" ? "Reference monitor" : "Alert worklist"} description={view.dataMode === "reference" ? "Inspect seeded replay and email examples without asserting issuer state." : "Acknowledge, assign and hand off routed events; phone remains triage-only."} count={count} viewLabel={view.dataMode === "reference" ? "Reference" : "Live worklist"} />;
}

function LiveAlertContent({ view }: { view: MonitorViewProps }) {
  if (view.autonomyLoading) return <SurfaceState kind="loading" title="Loading live alerts" compact className="m-2" />;
  if (view.autonomyOffline) return <SurfaceState kind="unavailable" title="Live alert service unavailable" detail="No routed-alert state can be asserted while the autonomy endpoint is offline." compact className="m-2" />;
  if (!view.hasLiveAlerts) return <SurfaceState kind="empty" title="No live alerts routed" detail="The current live worklist is empty. Reference replay and email examples remain available only in Reference mode." compact className="m-2" />;
  return <AlertInbox />;
}

function governanceStatus(status: MonitorSurfaceStatus, count: number) {
  if (status === "loading") return "Checking";
  if (status === "error") return "Unavailable";
  return count === 0 ? "Clear" : `${count} open`;
}

function GovernanceQueueTable({ view }: { view: MonitorViewProps }) {
  const tableScroll = useScrollOwner<HTMLDivElement>();
  const stale = view.digestLive ? view.digest?.stale ?? [] : [];
  const aging = stale.filter((row) => row.detail !== "never run");
  const overdue = stale.filter((row) => row.detail === "never run");
  const rows = [
    ["CP-5 findings", governanceStatus(view.findingStatus, view.liveQa?.length ?? 0), "Research QA", view.liveQa?.[0]?.age ?? "Current", "Finding citations"],
    ["Committee gates", governanceStatus(view.qaStatus, view.liveFailed?.length ?? 0), "IC governance", "Current run", "Approval prerequisites"],
    ["CP-0 source gaps", governanceStatus(view.qaStatus, view.liveGapsItems?.length ?? 0), "Coverage analyst", view.liveGapsItems?.[0]?.requested ?? "Current", "Source readiness"],
    ["Mixed-origin content", governanceStatus(view.qaStatus, view.liveMixed?.length ?? 0), "Research QA", "Persisted run", "Live/reference boundary"],
    ["Stale sources", governanceStatus(view.digestStatus, aging.length), "Coverage analyst", aging.length ? `${aging.length} outside window` : "Within window", "Digest freshness"],
    ["Overdue refresh", governanceStatus(view.digestStatus, overdue.length), "Coverage lead", overdue.length ? `${overdue.length} never run` : "Covered", "Coverage evidence"],
  ] as const;
  return (
    <div>
      <div ref={tableScroll.ref} className={`overflow-x-auto${tableScroll.scrollable ? " focus-ring" : ""}`} tabIndex={tableScroll.scrollable ? 0 : undefined} role={tableScroll.scrollable ? "region" : undefined} aria-label={tableScroll.scrollable ? "QA governance gates and evidence health" : undefined}>
        <table className="caos-table min-w-[760px] w-full">
          <thead>
            <tr>
              <th scope="col">Gate or exception</th>
              <th scope="col">Status</th>
              <th scope="col">Owner</th>
              <th scope="col">Freshness</th>
              <th scope="col">Evidence health</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([gate, status, owner, freshness, evidence]) => (
              <tr key={gate}>
                <th scope="row" className="text-left">{gate}</th>
                <td className="tabular">{status}</td>
                <td>{owner}</td>
                <td className="tabular">{freshness}</td>
                <td>{evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="border-t border-caos-border" open>
        <summary className="caos-details-summary focus-ring">Open finding registers</summary>
        <GovernancePanel findingStatus={view.findingStatus} qaStatus={view.qaStatus} digestStatus={view.digestStatus} liveQa={view.liveQa} liveFailedGates={view.liveFailed} liveGaps={view.liveGapsItems} liveMixedOrigin={view.liveMixed} staleRows={stale} />
      </details>
    </div>
  );
}

function MonitorDatasetContent({ view }: { view: MonitorViewProps }) {
  const composition = useWorkbenchComposition();
  if (view.dataset === "email") return <ReferenceEmailIntel />;
  if (view.dataset === "governance") return composition.tableColumnPreset === "qa-gates"
    ? <GovernanceQueueTable view={view} />
    : <GovernancePanel findingStatus={view.findingStatus} qaStatus={view.qaStatus} digestStatus={view.digestStatus} liveQa={view.liveQa} liveFailedGates={view.liveFailed} liveGaps={view.liveGapsItems} liveMixedOrigin={view.liveMixed} staleRows={view.digestLive ? view.digest?.stale ?? [] : []} />;
  if (view.dataMode === "reference") return <ReferenceMonitorReplay criticalOnly={view.criticalOnly} onCriticalChange={(criticalOnly) => view.updateUrlState({ severity: criticalOnly ? "critical" : null })} />;
  return view.isPhone ? <PhoneTriage /> : <LiveAlertContent view={view} />;
}

function monitorDatasetTitle(view: MonitorViewProps) {
  if (view.dataset === "email") return "Email Intelligence · CP-MON intake";
  if (view.dataset === "governance") return "Live governance queue · CP-5 / CP-0 / Staleness";
  if (view.dataMode === "reference") return "Reference alert replay · CP-MON-H";
  return view.isPhone ? "Alert triage · autonomy routing" : "Alert inbox · autonomy routing";
}

function monitorDatasetLabel(dataset: MonitorDataset) {
  if (dataset === "email") return "Email intelligence worklist";
  if (dataset === "governance") return "Governance worklist";
  return "Alert inbox worklist";
}

function MonitorDatasetTabs({ view }: { view: MonitorViewProps }) {
  return <div role="tablist" aria-label="Monitor dataset" aria-busy={!view.datasetControlsReady} className="flex items-center gap-1"><Button variant="secondary" type="button" role="tab" aria-selected={view.dataset === "alerts"} reason={view.datasetSwitchReason} reasonDisplay="hidden" onClick={() => view.updateUrlState({ dataset: "alerts" })}>{view.dataMode === "reference" ? "Replay" : "Alerts"}</Button>{view.dataMode === "reference" ? <Button variant="secondary" type="button" role="tab" aria-selected={view.dataset === "email"} reason={view.datasetSwitchReason} reasonDisplay="hidden" onClick={() => view.updateUrlState({ dataset: "email" })}>Email intake</Button> : <Button variant="secondary" type="button" role="tab" aria-selected={view.dataset === "governance"} reason={view.datasetSwitchReason} reasonDisplay="hidden" onClick={() => view.updateUrlState({ dataset: "governance" })}>Governance</Button>}</div>;
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
  if (view.dataMode === "reference") return <PanelShell title="Reference scope"><p className="p-2 text-caos-xs text-caos-muted">Seeded replay and email examples only. Live governance and control-plane state are not merged into this workspace.</p></PanelShell>;
  return <div className="grid gap-2"><GovernanceSummary coldStart={!view.portfolio.live && !view.portfolio.error && !view.portfolio.loading} qa={view.liveQa?.length} failed={view.liveFailed?.length} gaps={view.liveGapsItems?.length} mixed={view.liveMixed?.length} stale={view.digestLive ? view.digest?.stale?.length ?? 0 : undefined} onOpen={() => view.updateUrlState({ dataset: "governance" })} /><PanelShell title="Source intake health"><ControlPlanePanel /></PanelShell><MonitorCitedBrief view={view} /></div>;
}

function MonitorWorkbench({ view }: { view: MonitorViewProps }) {
  const decision = view.dataMode === "reference"
    ? <SurfaceState kind="unavailable" title="Decision context not applicable" detail="Reference replay does not assert a live issuer decision or observation timestamp." compact />
    : <DecisionHeader state={view.monitorDecision} />;
  const sparseAlerts = view.dataMode === "live" && view.dataset === "alerts" && view.liveRows.length > 0 && view.liveRows.length <= 3;
  return <><MonitorToolbar view={view} /><div id="alert-inbox" className={`caos-persona-route monitor-workbench flex-1 min-h-0 p-2${sparseAlerts ? " monitor-workbench--sparse" : ""}`} tabIndex={-1}><PersonaWorkbench surface="monitor" retainEmphasizedSupportOnNarrow={!view.isPhone} decision={decision} primary={<MonitorDatasetPanel view={view} />} context={<MonitorContext rows={view.liveRows} asOf={view.draftAsOf} dataMode={view.dataMode} />} inspector={<MonitorInspector view={view} />} /></div></>;
}

function MonitorView({ view }: { view: MonitorViewProps }) {
  return <EnterprisePage kind="worklist" identity={<MonitorIdentity view={view} />} primaryAction={MonitorPrimaryAction({ view })} status={<MonitorHeaderStatus view={view} />} utilityLabel="Monitor shortcuts" utilityControls={<MonitorUtilities view={view} />} narrowContract={{ essentialControls: null }}><MonitorWorkbench view={view} /></EnterprisePage>;
}

function useMonitorNavigation(dataMode: DataMode) {
  const analysis = useAnalysisContext({ name: "Alert oversight" });
  const composition = usePersonaComposition("monitor");
  const { values, update } = useTypedUrlState(MONITOR_URL_KEYS);
  const selectedAlertCount = useMonitorSelection(analysis, update);
  const { breakpoint } = useBreakpoint();
  const datasetControlsReady = !analysis.loading;
  return {
    dataMode,
    analysis,
    dataset: resolveMonitorDataset(values.dataset, composition.leadingDataset, dataMode),
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
  const liveRows = autonomy.draft ? draftToAlertRows(autonomy.draft) : [];
  const hasLiveAlerts = !autonomy.offline && liveRows.length > 0;
  return { autonomy, liveRows, hasLiveAlerts };
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

function useLiveMonitorView() {
  const navigation = useMonitorNavigation("live");
  const alerts = useMonitorAlerts();
  const governanceModel = useMonitorGovernance();
  const insight = useMonitorInsight(navigation.analysis.context?.id, navigation.selected);
  const decisionInput = { draft: alerts.autonomy.draft, loading: alerts.autonomy.loading, offline: alerts.autonomy.offline, rows: alerts.liveRows };
  const governance = governanceModel.governance;
  return {
    dataMode: navigation.dataMode,
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
    criticalOnly: navigation.criticalOnly,
    draftAsOf: monitorDecisionAuthority(decisionInput).asOf,
    monitorDecision: buildMonitorDecision(decisionInput),
    insight: insight.insight,
    insightMessage: insight.message,
    generateInsight: insight.generate,
  } satisfies MonitorViewProps;
}

function useReferenceMonitorView() {
  const navigation = useMonitorNavigation("reference");
  return {
    dataMode: "reference",
    analysis: navigation.analysis,
    dataset: navigation.dataset,
    updateUrlState: navigation.updateUrlState,
    datasetControlsReady: navigation.datasetControlsReady,
    datasetSwitchReason: navigation.datasetSwitchReason,
    selectedAlertCount: 0,
    isPhone: navigation.isPhone,
    autonomyLoading: false,
    autonomyOffline: false,
    liveRows: [],
    hasLiveAlerts: false,
    portfolio: null as unknown as ReturnType<typeof usePortfolio>,
    digest: null,
    digestLive: false,
    liveQa: [],
    liveFailed: [],
    liveGapsItems: [],
    liveMixed: [],
    qaStatus: "ready",
    findingStatus: "ready",
    digestStatus: "ready",
    criticalOnly: navigation.criticalOnly,
    draftAsOf: null,
    monitorDecision: {} as DecisionContextState,
    insight: null,
    insightMessage: null,
    generateInsight: async () => undefined,
  } satisfies MonitorViewProps;
}

function LiveMonitor() {
  const view = useLiveMonitorView();
  return <MonitorView view={view} />;
}

function ReferenceMonitor() {
  const view = useReferenceMonitorView();
  return <MonitorView view={view} />;
}

function Monitor() {
  const dataMode = useDataMode();
  return dataMode === "reference" ? <ReferenceMonitor /> : <LiveMonitor />;
}

function MonitorContext({ rows, asOf, dataMode }: { rows: ReturnType<typeof draftToAlertRows>; asOf: string | null; dataMode: DataMode }) {
  if (dataMode === "reference" || rows.length <= 1) return null;
  const severityBand = (value: number) => value >= 3 ? "critical" : value >= 2 ? "high" : value >= 1 ? "medium" : "low";
  const severities = ["critical", "high", "medium", "low"].map((severity) => ({ severity, count: rows.filter((row) => severityBand(row.severity) === severity).length }));
  const spec: VisualizationSpec = {
    kind: "bar",
    title: "Routed alerts by severity",
    unit: "alerts",
    asOf: asOf ?? undefined,
    sourceIds: ["autonomy-draft"],
    accessibleSummary: `${rows.length} live routed alerts; ${severities[0].count} are critical.`,
    status: severities[0].count ? { label: "Critical present", tone: "critical" } : { label: "No critical alert", tone: "success" },
    data: severities,
    tabularFallback: { label: "Alert severity counts", columns: [{ key: "severity", label: "Severity" }, { key: "count", label: "Count" }], data: severities },
    chart: { type: "interval", encode: { x: "severity", y: "count" } },
  };
  return <SemanticVisualization spec={spec} />;
}
