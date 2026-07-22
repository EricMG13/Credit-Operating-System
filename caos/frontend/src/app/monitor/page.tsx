"use client";

// Concept F — The Monitor. Live mode is governed solely by persisted C3 alert
// events and watch rules; Reference replay/email examples remain a separate,
// read-only surface and never claim live issuer authority.

import { useEffect, useRef, useState } from "react";
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
import { WatchRuleEditor } from "@/components/monitor/WatchRuleEditor";
import { alertObservationTimestamp, usePersistedMonitorController, type PersistedMonitorController, type PersistedLoadStatus } from "@/components/monitor/usePersistedMonitorController";
import type { AlertEventDTO } from "@/lib/api";
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

function syncSelectedAlert(
  context: ReturnType<typeof useAnalysisContext>["context"],
  patch: ReturnType<typeof useAnalysisContext>["patch"],
  eventId: string | null,
  lastAttempt: { current: string | null },
  inFlightTargets: { current: Set<string> },
  pendingSync: { current: boolean },
  rerun: () => void,
) {
  if (!context) {
    lastAttempt.current = null;
    pendingSync.current = false;
    return;
  }
  const artifactEventId = context.artifacts.alert_event_id;
  const surfaceEventId = context.surface_state.monitor?.active_id;
  const attempt = JSON.stringify({
    contextId: context.id,
    revision: context.revision,
    eventId,
    artifact: { defined: artifactEventId !== undefined, value: artifactEventId ?? null },
    surface: { defined: surfaceEventId !== undefined, value: surfaceEventId ?? null },
  });
  const changes: Parameters<typeof patch>[0] = {};
  if (artifactEventId !== eventId) changes.artifacts = { alert_event_id: eventId };
  if (surfaceEventId !== eventId) changes.surface_state = { monitor: { active_id: eventId } };
  if (!changes.artifacts && !changes.surface_state) {
    lastAttempt.current = null;
    return;
  }
  const target = JSON.stringify({ contextId: context.id, eventId });
  if (inFlightTargets.current.has(target)) {
    pendingSync.current = true;
    return;
  }
  if (lastAttempt.current === attempt) return;
  // Record before dispatch: mutation-state rerenders and a persistent rejection
  // must not replay the same repair indefinitely.
  lastAttempt.current = attempt;
  inFlightTargets.current.add(target);
  void patch(changes).catch(() => undefined).finally(() => {
    inFlightTargets.current.delete(target);
    if (!pendingSync.current) return;
    pendingSync.current = false;
    rerun();
  });
}

function useMonitorSelection(controller: PersistedMonitorController, requested: string | null, analysis: ReturnType<typeof useAnalysisContext>, updateUrlState: MonitorUrlUpdater) {
  const { activeEventId: selected, setActiveEvent, status, visibleEvents } = controller;
  const analysisContext = analysis.context;
  const patchAnalysisContext = analysis.patch;
  const observedRequestRef = useRef(requested);
  const pendingRequestedRef = useRef<string | null>(null);
  const lastAnalysisSyncAttemptRef = useRef<string | null>(null);
  const analysisSyncTargetsRef = useRef(new Set<string>());
  const analysisSyncPendingRef = useRef(false);
  const analysisSyncMountedRef = useRef(true);
  const [analysisSyncEpoch, setAnalysisSyncEpoch] = useState(0);
  useEffect(() => {
    // React Strict Mode runs a development-only setup/cleanup/setup cycle.
    // Re-arm on setup so a settled patch can still schedule its guarded rerun.
    analysisSyncMountedRef.current = true;
    return () => {
      analysisSyncMountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    if (status !== "ready") return;
    const pendingRequested = pendingRequestedRef.current;
    if (pendingRequested) {
      const requestStillCurrent = requested === pendingRequested;
      const targetStillVisible = visibleEvents.some((event) => event.id === pendingRequested);
      const targetSelected = selected === pendingRequested;
      // A pending request is installed only after the prior effect has observed
      // the URL. Seeing that same request again with another ready selection
      // means controller authority settled somewhere else; normalize to it.
      const selectionSettledAway = requested === observedRequestRef.current && !targetSelected;
      if (!requestStillCurrent || !targetStillVisible || targetSelected || selectionSettledAway) {
        pendingRequestedRef.current = null;
      }
    }
    if (requested === observedRequestRef.current) return;
    observedRequestRef.current = requested;
    if (!requested || requested === selected) {
      pendingRequestedRef.current = null;
      return;
    }
    if (visibleEvents.some((event) => event.id === requested)) {
      pendingRequestedRef.current = requested;
      setActiveEvent(requested);
    } else {
      pendingRequestedRef.current = null;
    }
  }, [requested, selected, setActiveEvent, status, visibleEvents]);
  useEffect(() => {
    if (status !== "ready") return;
    if (pendingRequestedRef.current && pendingRequestedRef.current !== selected) return;
    pendingRequestedRef.current = null;
    updateUrlState({ selected }, "replace");
  }, [requested, selected, status, updateUrlState]);
  useEffect(() => {
    if (status !== "ready") return;
    if (pendingRequestedRef.current && pendingRequestedRef.current !== selected) return;
    syncSelectedAlert(
      analysisContext,
      patchAnalysisContext,
      selected,
      lastAnalysisSyncAttemptRef,
      analysisSyncTargetsRef,
      analysisSyncPendingRef,
      () => {
        if (analysisSyncMountedRef.current) setAnalysisSyncEpoch((current) => current + 1);
      },
    );
  }, [analysisContext, analysisSyncEpoch, patchAnalysisContext, selected, status]);
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
  status: PersistedLoadStatus;
  error: string | null;
  events: AlertEventDTO[];
  retry: () => Promise<unknown>;
};

function monitorDecisionAuthority(input: MonitorDecisionInput) {
  if (input.status !== "ready") return { asOf: null, authority: undefined };
  const observed = input.events.map(alertObservationTimestamp).filter((value): value is string => value !== null).sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
  const asOf = observed ? fmtUtcDateTime(observed) : null;
  const authority: DecisionAuthority | undefined = asOf ? {
    provenance: { origin: "LIVE", method: "DERIVED", detail: "Persisted alert events; freshness is not inferred.", asOf },
    approval: null,
  } : undefined;
  return { asOf, authority };
}

function unavailableMonitorDatum(input: MonitorDecisionInput): DecisionDatumState {
  if (input.status === "loading") return { kind: "loading", message: "Checking persisted alert events…" };
  if (input.status === "error") return { kind: "error", message: input.error ?? "Persisted alert events unavailable", retryLabel: "Retry alerts", onRetry: () => void input.retry() };
  return { kind: "partial", value: "Persisted events lack a valid observation or event timestamp", missingSources: ["evidence.observed_at", "created_at"], asOf: "timestamp missing" };
}

function observedMonitorDatum(value: string | null, emptyMessage: string, asOf: string, authority: DecisionAuthority | undefined): DecisionDatumState {
  return value ? { kind: "ready", value, asOf, authority } : { kind: "observed-empty", message: emptyMessage, asOf, authority };
}

function selectMonitorDecisionEvent(events: AlertEventDTO[]): AlertEventDTO | null {
  const stateRank: Record<AlertEventDTO["state"], number> = { open: 0, ack: 1, resolved: 2 };
  return [...events].sort((left, right) => {
    const stateDifference = stateRank[left.state] - stateRank[right.state];
    if (stateDifference) return stateDifference;
    const leftObserved = alertObservationTimestamp(left);
    const rightObserved = alertObservationTimestamp(right);
    const observationDifference = (rightObserved ? Date.parse(rightObserved) : Number.NEGATIVE_INFINITY)
      - (leftObserved ? Date.parse(leftObserved) : Number.NEGATIVE_INFINITY);
    if (observationDifference) return observationDifference;
    const createdDifference = Date.parse(right.created_at) - Date.parse(left.created_at);
    return createdDifference || right.id.localeCompare(left.id);
  })[0] ?? null;
}

function buildMonitorDecision(input: MonitorDecisionInput): DecisionContextState {
  if (input.status !== "ready") {
    const unavailable = unavailableMonitorDatum(input);
    return { whatChanged: unavailable, whyItMatters: unavailable, requiredAction: unavailable, evidenceHealth: unavailable };
  }
  if (input.events.length === 0) {
    const empty: DecisionDatumState = { kind: "observed-empty", message: "No persisted alert events observed", asOf: "no persisted event timestamp", authority: { provenance: { origin: "LIVE", method: "DERIVED", detail: "Persisted alert-event read completed." }, approval: null } };
    return { whatChanged: empty, whyItMatters: empty, requiredAction: empty, evidenceHealth: empty };
  }
  const top = selectMonitorDecisionEvent(input.events);
  const { asOf, authority } = monitorDecisionAuthority({ ...input, events: top ? [top] : [] });
  if (!asOf) {
    const unavailable = unavailableMonitorDatum(input);
    return { whatChanged: unavailable, whyItMatters: unavailable, requiredAction: unavailable, evidenceHealth: unavailable };
  }
  const changed = top?.title ?? null;
  const impact = top?.impact || null;
  const action = top?.state === "open" ? `Review ${top.kind} alert and persisted evidence` : null;
  const open = input.events.filter((event) => event.state === "open").length;
  const routed = `${input.events.length} persisted alert event${input.events.length === 1 ? "" : "s"} · ${open} open`;
  const missingTimestampCount = input.events.filter((event) => alertObservationTimestamp(event) === null).length;
  const aggregateAuthority = monitorDecisionAuthority(input);
  const evidenceHealth: DecisionDatumState = missingTimestampCount
    ? {
        kind: "partial",
        value: `${routed} · ${missingTimestampCount} missing observation/event timestamp${missingTimestampCount === 1 ? "" : "s"}`,
        missingSources: ["evidence.observed_at", "created_at"],
        asOf: aggregateAuthority.asOf ?? asOf,
        authority: aggregateAuthority.authority ?? authority,
      }
    : { kind: "ready", value: routed, asOf: aggregateAuthority.asOf ?? asOf, authority: aggregateAuthority.authority ?? authority };
  return {
    whatChanged: observedMonitorDatum(changed, "No routed alerts observed", asOf, authority),
    whyItMatters: observedMonitorDatum(impact, "No portfolio impact observed", asOf, authority),
    requiredAction: observedMonitorDatum(action, "No acknowledgment required", asOf, authority),
    evidenceHealth,
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
  controller: PersistedMonitorController | null;
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
  alertAsOf: string | null;
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
  if (view.controller?.status === "loading") return "Persisted alert list is still loading.";
  if (view.controller?.status === "error") return "Persisted alert list is unavailable; reload before acknowledging.";
  if (view.controller?.requiresAuthoritativeReload) return "Persisted alert authority changed; reload before acknowledging.";
  if (view.controller?.batchPending) return "Batch acknowledgment is already in progress.";
  if (view.controller && view.controller.pendingIds.size > 0) return "An individual alert workflow update is in progress.";
  if (view.controller?.workflowSurfaceLocked && !view.controller.batchError) return "Review or dismiss the current alert workflow failure before acknowledging.";
  if (view.selectedAlertCount > 0) return null;
  if (view.controller?.events.length) return "Select persisted alerts in the worklist first.";
  return "No persisted alerts to acknowledge.";
}

function MonitorPrimaryAction({ view }: { view: MonitorViewProps }): PageAction | undefined {
  if (view.dataMode !== "live" || view.dataset !== "alerts" || view.isPhone || view.controller?.canMutate !== true) return undefined;
  const count = view.selectedAlertCount ? ` (${view.selectedAlertCount})` : "";
  return {
    label: `Acknowledge selected${count}`,
    onAction: () => void view.controller?.acknowledgeSelected().catch(() => undefined),
    unavailableReason: acknowledgeReason(view),
  };
}

function MonitorHeaderStatus({ view }: { view: MonitorViewProps }) {
  return <>{view.alertAsOf ? <span className="tabular text-caos-2xs text-caos-muted">Observed {view.alertAsOf}</span> : null}<AnalysisContextSaveState analysis={view.analysis} /></>;
}

function MonitorUtilities({ view }: { view: MonitorViewProps }) {
  return <div className="grid gap-3"><span className="tabular text-caos-xs text-caos-muted">{view.dataMode === "reference" ? "Seeded Reference fixtures" : "Live routed-alert sources"}</span>{view.analysis.context ? <Link href={contextHref("/command", view.analysis.context.id)} className="caos-action-secondary no-underline focus-ring">Open Command</Link> : null}</div>;
}

function MonitorToolbar({ view }: { view: MonitorViewProps }) {
  const eventCount = view.controller?.events.length ?? 0;
  const count = view.dataMode === "reference" ? "Seeded examples" : view.controller?.status === "loading" ? "Loading" : view.controller?.status === "error" ? "Unavailable" : `${eventCount} persisted alert${eventCount === 1 ? "" : "s"}`;
  return <WorkbenchToolbar title={view.dataMode === "reference" ? "Reference monitor" : "Alert worklist"} description={view.dataMode === "reference" ? "Inspect seeded replay and email examples without asserting issuer state." : "Acknowledge, assign and hand off persisted alert events; phone remains triage-only."} count={count} viewLabel={view.dataMode === "reference" ? "Reference" : "Live worklist"} />;
}

function LiveAlertContent({ view }: { view: MonitorViewProps }) {
  return <AlertInbox controller={view.controller!} />;
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
  return view.isPhone ? <PhoneTriage controller={view.controller!} /> : <LiveAlertContent view={view} />;
}

function monitorDatasetTitle(view: MonitorViewProps) {
  if (view.dataset === "email") return "Email Intelligence · CP-MON intake";
  if (view.dataset === "governance") return "Live governance queue · CP-5 / CP-0 / Staleness";
  if (view.dataMode === "reference") return "Reference alert replay · CP-MON-H";
  return view.isPhone ? "Alert triage · persisted events" : "Alert inbox · persisted events";
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
  return <div className="grid min-w-0 grid-cols-1 gap-2"><PanelShell title="Alert rule controls"><div className="p-2"><WatchRuleEditor controller={view.controller!.rules} /></div></PanelShell><fieldset disabled={!view.datasetControlsReady} title={view.datasetSwitchReason ?? undefined} className="contents"><legend className="sr-only">{view.datasetSwitchReason ?? "Governance navigation"}</legend><GovernanceSummary coldStart={!view.portfolio.live && !view.portfolio.error && !view.portfolio.loading} qa={view.liveQa?.length} failed={view.liveFailed?.length} gaps={view.liveGapsItems?.length} mixed={view.liveMixed?.length} stale={view.digestLive ? view.digest?.stale?.length ?? 0 : undefined} onOpen={() => view.updateUrlState({ dataset: "governance" })} /></fieldset><PanelShell title="Source intake health"><ControlPlanePanel /></PanelShell><MonitorCitedBrief view={view} /></div>;
}

function MonitorWorkbench({ view }: { view: MonitorViewProps }) {
  const decision = view.dataMode === "reference"
    ? <SurfaceState kind="unavailable" title="Decision context not applicable" detail="Reference replay does not assert a live issuer decision or observation timestamp." compact />
    : <DecisionHeader state={view.monitorDecision} />;
  const eventCount = view.controller?.events.length ?? 0;
  const sparseAlerts = view.dataMode === "live" && view.dataset === "alerts" && eventCount > 0 && eventCount <= 3;
  return <><MonitorToolbar view={view} /><div id="alert-inbox" className={`caos-persona-route monitor-workbench flex-1 min-h-0 p-2${sparseAlerts ? " monitor-workbench--sparse" : ""}`} tabIndex={-1}><PersonaWorkbench surface="monitor" retainEmphasizedSupportOnNarrow={!view.isPhone} decision={decision} primary={<MonitorDatasetPanel view={view} />} context={<MonitorContext events={view.controller?.events ?? []} asOf={view.alertAsOf} dataMode={view.dataMode} />} inspector={<MonitorInspector view={view} />} /></div></>;
}

function MonitorView({ view }: { view: MonitorViewProps }) {
  return <EnterprisePage kind="worklist" identity={<MonitorIdentity view={view} />} primaryAction={MonitorPrimaryAction({ view })} status={<MonitorHeaderStatus view={view} />} utilityLabel="Monitor shortcuts" utilityControls={<MonitorUtilities view={view} />} narrowContract={{ essentialControls: null }}><MonitorWorkbench view={view} /></EnterprisePage>;
}

function useMonitorNavigation(dataMode: DataMode) {
  const analysis = useAnalysisContext({ name: "Alert oversight" });
  const composition = usePersonaComposition("monitor");
  const { values, update } = useTypedUrlState(MONITOR_URL_KEYS);
  const { breakpoint } = useBreakpoint();
  const datasetControlsReady = !analysis.loading;
  return {
    dataMode,
    analysis,
    dataset: resolveMonitorDataset(values.dataset, composition.leadingDataset, dataMode),
    updateUrlState: update,
    selected: values.selected,
    criticalOnly: values.severity === "critical",
    isPhone: breakpoint === "mobile",
    datasetControlsReady,
    datasetSwitchReason: datasetControlsReady ? null : "Dataset switch is not available until the page finishes loading.",
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

function useLiveMonitorView() {
  const navigation = useMonitorNavigation("live");
  const controller = usePersistedMonitorController(navigation.selected);
  const { clearSelection: clearAlertSelection, workflowSurfaceLocked } = controller;
  useEffect(() => {
    if (!workflowSurfaceLocked && (navigation.isPhone || navigation.dataset !== "alerts")) clearAlertSelection();
  }, [clearAlertSelection, navigation.dataset, navigation.isPhone, workflowSurfaceLocked]);
  const retainedPhoneMode = useRef(navigation.isPhone);
  const retainedDataset = useRef(navigation.dataset);
  if (!controller.workflowSurfaceLocked) retainedPhoneMode.current = navigation.isPhone;
  if (!controller.workflowSurfaceLocked) retainedDataset.current = navigation.dataset;
  const updateUrlState: MonitorUrlUpdater = (changes, mode) => {
    if (controller.workflowSurfaceLocked && Object.prototype.hasOwnProperty.call(changes, "dataset")) return;
    navigation.updateUrlState(changes, mode);
  };
  useMonitorSelection(controller, navigation.selected, navigation.analysis, navigation.updateUrlState);
  const governanceModel = useMonitorGovernance();
  const insight = useMonitorInsight(navigation.analysis.context?.id, controller.activeEventId);
  const decisionInput = { status: controller.status, error: controller.error, events: controller.events, retry: controller.refresh };
  const governance = governanceModel.governance;
  return {
    dataMode: navigation.dataMode,
    analysis: navigation.analysis,
    dataset: retainedDataset.current,
    updateUrlState,
    datasetControlsReady: navigation.datasetControlsReady && !controller.workflowSurfaceLocked,
    datasetSwitchReason: controller.workflowSurfaceLocked
      ? "Dataset switch is unavailable until the current alert workflow outcome is resolved."
      : navigation.datasetSwitchReason,
    selectedAlertCount: controller.selectedIds.length,
    isPhone: controller.workflowSurfaceLocked ? retainedPhoneMode.current : navigation.isPhone,
    controller,
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
    alertAsOf: monitorDecisionAuthority(decisionInput).asOf,
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
    controller: null,
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
    alertAsOf: null,
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

function MonitorContext({ events, asOf, dataMode }: { events: AlertEventDTO[]; asOf: string | null; dataMode: DataMode }) {
  if (dataMode === "reference" || events.length === 0) return null;
  const states = ["open", "ack", "resolved"].map((state) => ({ state, count: events.filter((event) => event.state === state).length }));
  const spec: VisualizationSpec = {
    kind: "bar",
    title: "Persisted alerts by workflow state",
    unit: "alerts",
    asOf: asOf ?? undefined,
    sourceIds: events.map((event) => event.id),
    accessibleSummary: `${events.length} persisted alert events; ${states[0].count} open, ${states[1].count} acknowledged, and ${states[2].count} resolved.`,
    // C3 persists workflow state but no severity. Open is therefore neutral
    // workflow posture, not evidence of critical urgency.
    status: states[0].count ? { label: `${states[0].count} open`, tone: "idle" } : { label: "No open alert", tone: "success" },
    data: states,
    tabularFallback: { label: "Alert workflow state counts", columns: [{ key: "state", label: "State" }, { key: "count", label: "Count" }], data: states },
    chart: { type: "interval", encode: { x: "state", y: "count" } },
  };
  return <SemanticVisualization spec={spec} />;
}
