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
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { useBreakpoint } from "@/lib/useBreakpoint";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { simAlertsToday, CRITICAL_ALERTS } from "@/lib/command/data";
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
import { useDigest } from "@/lib/engine/useDigest";
import { liveQaItems, liveFailedGates } from "@/lib/command/qa";
import { liveGaps } from "@/lib/command/gaps";
import { liveMixedOrigin } from "@/lib/command/mixedOrigin";
import type { DecisionContextState } from "@/lib/decision-state";
import { WorkbenchToolbar } from "@/components/shared/WorkbenchToolbar";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { SemanticVisualization, type VisualizationSpec } from "@/components/charts/SemanticVisualization";
import { useRoleView } from "@/components/shared/RoleViewProvider";
import { analysisApi, contextHref, type InsightArtifact, useAnalysisContext } from "@/lib/analysis-workbench";
import { useTypedUrlState } from "@/lib/typed-url-state";

const MONITOR_URL_KEYS = ["dataset", "severity", "selected"] as const;

export default function MonitorPage() {
  return (
    <RequireAuth>
      <Monitor />
    </RequireAuth>
  );
}

function Monitor() {
  const analysis = useAnalysisContext({ name: "Alert oversight" });
  const { roleView } = useRoleView();
  const { values: urlState, update: updateUrlState } = useTypedUrlState(MONITOR_URL_KEYS);
  const dataset = urlState.dataset === "email" || urlState.dataset === "governance"
    ? urlState.dataset
    : roleView === "qa" ? "governance" : "alerts";
  const [selectedAlertCount, setSelectedAlertCount] = useState(0);
  const [insight, setInsight] = useState<InsightArtifact | null>(null);
  const [insightMessage, setInsightMessage] = useState<string | null>(null);
  const { breakpoint } = useBreakpoint();
  const isPhone = breakpoint === "mobile";
  const { draft, offline: autonomyOffline, loading: autonomyLoading } = useAutonomyDraft();
  const liveRows = draft ? draftToAlertRows(draft) : [];
  const hasLiveAlerts = !autonomyOffline && liveRows.length > 0;
  const topRow = liveRows[0];
  // Governance's shared queue (Command shows the identical categories from the
  // same live sources — QA queues visible from both, per the handoff).
  const portfolio = usePortfolio();
  const liveQa = portfolio.live ? liveQaItems(portfolio.rows) : undefined;
  const liveFailed = portfolio.live ? liveFailedGates(portfolio.rows) : undefined;
  const liveGapsItems = portfolio.live ? liveGaps(portfolio.rows) : undefined;
  const liveMixed = portfolio.live ? liveMixedOrigin(portfolio.rows) : undefined;
  const { digest, live: digestLive } = useDigest();
  // Default: demo disclosure open when there's nothing live to show, closed
  // once live rows exist. `null` = follow that default; a click overrides for
  // the session (same disclosure pattern as DecisionHeader).
  const [demoOverride, setDemoOverride] = useState<boolean | null>(null);
  const showDemo = demoOverride ?? !hasLiveAlerts;
  const run = useSharedDayRun();
  const running = run.playing && !run.sim.done; // actively stepping (pulse)
  const done = run.sim.done; // replay finished (static, honest end state)
  const tick = run.sim.tick;
  // Tick-derived until the replay is DONE, full total only after. Gating on
  // `!done` (not on "is playing") keeps a mid-run pause frozen at the count the
  // feed actually shows — passing `running` here made pausing jump the headline
  // to the EOD 10 over a 7-row feed, contradicting the log at the exact moment
  // of scrutiny.
  const alertsToday = simAlertsToday(tick, !done);
  // Rail severity filter, toggled from the red "Critical alerts" head-stat — the
  // one red number in the header is an affordance, not dead text, and it digs
  // the two criticals out of the bottom of the completed newest-first tape.
  const criticalOnly = urlState.severity === "critical";
  // "SIM" while running, "COMPLETE" at end, "PAUSED" only before/at a pause —
  // the old build read "PAUSED" at completion, so the run ended by lying.
  const simState = running ? "SIM" : done ? "COMPLETE" : "PAUSED";
  const draftAsOf = draft?.generated_at
    ? new Date(draft.generated_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : null;
  const draftAuthority = draftAsOf ? {
    provenance: { origin: "LIVE" as const, method: "MODELLED" as const, freshness: "CURRENT" as const, detail: "Autonomy draft alert routing.", asOf: draftAsOf },
    approval: draft?.ratified ? "RATIFIED" as const : "UNRATIFIED" as const,
  } : undefined;
  const monitorUnavailable = autonomyLoading
    ? { kind: "loading" as const, message: "Checking Watchtower draft…" }
    : autonomyOffline
      ? { kind: "offline" as const, lastKnown: "Watchtower endpoint unavailable" }
      : { kind: "partial" as const, value: "Draft answered without an observation timestamp", missingSources: ["generated_at"], asOf: "timestamp missing" };
  const monitorDecision: DecisionContextState = draftAsOf
    ? {
        whatChanged: hasLiveAlerts
          ? { kind: "ready", value: liveRows.slice(0, 3).map((row) => row.event).join(" · "), asOf: draftAsOf, authority: draftAuthority }
          : { kind: "observed-empty", message: "No routed alerts observed", asOf: draftAsOf, authority: draftAuthority },
        whyItMatters: hasLiveAlerts && topRow
          ? { kind: "ready", value: `${topRow.reason} · severity ${topRow.severity}`, asOf: draftAsOf, authority: draftAuthority }
          : { kind: "observed-empty", message: "No portfolio impact observed", asOf: draftAsOf, authority: draftAuthority },
        requiredAction: hasLiveAlerts && topRow
          ? { kind: "ready", value: requiredActionFor(topRow), asOf: draftAsOf, authority: draftAuthority }
          : { kind: "observed-empty", message: "No acknowledgment required", asOf: draftAsOf, authority: draftAuthority },
        evidenceHealth: { kind: "ready", value: `${liveRows.length} alert${liveRows.length === 1 ? "" : "s"} routed from the autonomy draft`, asOf: draftAsOf, authority: draftAuthority },
      }
    : { whatChanged: monitorUnavailable, whyItMatters: monitorUnavailable, requiredAction: monitorUnavailable, evidenceHealth: monitorUnavailable };

  useEffect(() => {
    const updateSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ count: number; eventId: string | null }>).detail;
      setSelectedAlertCount(detail?.count ?? 0);
      updateUrlState({ selected: detail?.eventId ?? null }, "replace");
      const context = analysis.context;
      if (!context || !detail?.eventId || context.artifacts.alert_event_id === detail.eventId) return;
      void analysis.patch({
        artifacts: { ...context.artifacts, alert_event_id: detail.eventId },
        surface_state: {
          ...context.surface_state,
          monitor: { ...context.surface_state.monitor, active_id: detail.eventId },
        },
      });
    };
    window.addEventListener("caos:monitor-selection", updateSelection);
    return () => window.removeEventListener("caos:monitor-selection", updateSelection);
  }, [analysis, updateUrlState]);

  useEffect(() => {
    if (!analysis.context?.id) return;
    let alive = true;
    analysisApi.listInsights(analysis.context.id, { surface: "monitor", kind: "alert-brief", limit: 20 })
      .then((page) => { if (alive) setInsight(page.current); })
      .catch(() => { if (alive) setInsightMessage("No cited advisory brief is available."); });
    return () => { alive = false; };
  }, [analysis.context?.id]);

  const generateInsight = async () => {
    if (!analysis.context?.id) return;
    setInsightMessage("Generating cited alert brief…");
    try {
      const created = await analysisApi.createInsight(analysis.context.id, {
        surface: "monitor",
        kind: "alert-brief",
        subject_refs: { alert_event_id: urlState.selected },
        force: Boolean(insight),
      });
      setInsight(created.status === "ready" || created.status === "ratified" ? created : insight);
      setInsightMessage(created.status === "ready" || created.status === "ratified" ? null : `Brief is ${created.status}.`);
    } catch (reason) {
      setInsightMessage(reason instanceof Error ? reason.message : "Cited alert brief is unavailable.");
    }
  };

  // The red number is an affordance: toggles the rail to criticals only.
  // Rendered once — inline in the full contextual set at ≥1024px, or as a
  // narrow essential below that — so the toggle is reachable at every width
  // (the old hand-rolled wrap header existed to keep it and pause visible
  // under ~1700px; the shared shell's MoreDrawer collapse now covers that).
  const criticalFilterButton = (
    <button
      type="button"
      onClick={() => updateUrlState({ severity: criticalOnly ? null : "critical" })}
      aria-pressed={criticalOnly}
      title={criticalOnly ? "Show all routed alerts" : "Filter alert rail to critical"}
      className={
        "rounded border px-1.5 py-0.5 -my-0.5 transition-caos focus-ring hover:bg-caos-elevated/70 " +
        (criticalOnly ? "caos-selected bg-caos-elevated border-caos-critical/60" : "border-transparent")
      }
    >
      {headStat("Critical alerts", String(CRITICAL_ALERTS), "var(--caos-critical)", true)}
    </button>
  );

  return (
    <EnterprisePage kind="worklist"
      identity={
        <ShellIdentity
          tag="CP-MON"
          badges={
            /* Honesty marker in the shared grammar: this whole surface replays
               a seeded simulation, not a live feed. `badges` renders before
               the title so the title truncates first and this never clips. */
            <ProvenanceChip
              prov={{
                origin: "DEMO",
                detail: "Illustrative sample — this whole surface replays a seeded simulation, not a live feed.",
              }}
            />
          }
          title="Monitor — email intelligence & alert routing"
        />
      }
      primaryAction={
        <button
          type="button"
          disabled={selectedAlertCount === 0}
          onClick={() => window.dispatchEvent(new Event("caos:monitor-ack-selected"))}
          className="caos-primary-action focus-ring disabled:opacity-40"
        >
          Acknowledge selected{selectedAlertCount ? ` (${selectedAlertCount})` : ""}
        </button>
      }
      contextualControls={
        <>
          {/* Msgs-today and Unresolved are NOT repeated here — the EmailIntel
              tiles directly below carry both ("Showing N of M today", the
              UNRESOLVED tile), and the freed width keeps the identity row's
              honesty chip un-clipped at 1440px. */}
          {criticalFilterButton}
          {headStat("Alerts today", String(alertsToday), "var(--caos-accent)", true)}
        </>
      }
      status={draftAsOf ? <span className="tabular text-caos-2xs text-caos-muted">Observed {draftAsOf}</span> : null}
      utilityLabel="Replay controls"
      utilityControls={<div className="grid gap-3"><SimControls run={run} /><span className="tabular text-caos-xs text-caos-muted">{simState} · {run.clock} ET</span>{analysis.context ? <Link href={contextHref("/command", analysis.context.id)} className="caos-action-secondary no-underline focus-ring">Open Command</Link> : null}</div>}
      narrowContract={{
        essentialControls: (
          <>
            {criticalFilterButton}
            <SimControls run={run} />
          </>
        ),
      }}
    >
      <WorkbenchToolbar
        title="Alert worklist"
        description="Acknowledge, assign and hand off routed events; phone remains triage-only."
        count={autonomyLoading ? "Loading" : autonomyOffline ? "Offline" : `${liveRows.length} live alerts`}
        viewLabel="Shared worklist"
      />
      <div id="alert-inbox" className="caos-persona-route monitor-workbench flex-1 min-h-0 p-2" tabIndex={-1}>
        <PersonaWorkbench
          surface="monitor"
          decision={<DecisionHeader state={monitorDecision} />}
          primary={
            <PanelShell
              title={dataset === "email" ? "Email Intelligence · CP-MON intake" : dataset === "governance" ? "Governance queue · CP-5 / CP-0 / Staleness" : isPhone ? "Alert triage · Watchtower" : "Alert inbox · Watchtower"}
              className="min-h-0 h-full"
              right={<div role="tablist" aria-label="Monitor dataset" className="flex items-center gap-1"><button type="button" role="tab" aria-selected={dataset === "alerts"} onClick={() => updateUrlState({ dataset: "alerts" })} className="caos-action-secondary focus-ring">Alerts</button><button type="button" role="tab" aria-selected={dataset === "email"} onClick={() => updateUrlState({ dataset: "email" })} className="caos-action-secondary focus-ring">Email intake</button><button type="button" role="tab" aria-selected={dataset === "governance"} onClick={() => updateUrlState({ dataset: "governance" })} className="caos-action-secondary focus-ring">Governance</button></div>}
            >
              <DominantTableRegion ownerId="monitor-alert-inbox" label={dataset === "email" ? "Email intelligence worklist" : dataset === "governance" ? "Governance worklist" : "Alert inbox worklist"} className="h-full">
                {dataset === "email" ? <EmailIntel /> : dataset === "governance" ? <GovernancePanel liveQa={liveQa} liveFailedGates={liveFailed} liveGaps={liveGapsItems} liveMixedOrigin={liveMixed} staleRows={digestLive ? digest?.stale ?? [] : []} /> : isPhone ? <PhoneTriage /> : <>
                  <AlertInbox />
                  <button type="button" onClick={() => setDemoOverride(!showDemo)} aria-expanded={showDemo} className="w-full flex items-center gap-2 px-3 min-h-8 tabular text-caos-2xs uppercase tracking-widest text-caos-muted hover:text-caos-text transition-caos focus-ring border-t border-caos-border/50 caos-target">
                    {showDemo ? "− " : "+ "}Demo replay · CP-MON-H seeded tape
                  </button>
                  {showDemo ? <AlertFeed tick={tick} running={running} done={done} sevFilter={criticalOnly ? "critical" : null} /> : null}
                </>}
              </DominantTableRegion>
            </PanelShell>
          }
          context={<MonitorContext rows={liveRows} asOf={draftAsOf} simState={simState} running={running} done={done} />}
          inspector={<div className="grid gap-2">
            <MonitorGovernanceSummary qa={liveQa?.length} failed={liveFailed?.length} gaps={liveGapsItems?.length} mixed={liveMixed?.length} stale={digestLive ? digest?.stale?.length ?? 0 : undefined} onOpen={() => updateUrlState({ dataset: "governance" })} />
            <PanelShell title="Coverage Control Plane · ingestion"><ControlPlanePanel /></PanelShell>
            <PanelShell title="Cited alert brief"><button type="button" onClick={() => void generateInsight()} className="caos-action-secondary focus-ring">{insight ? "Refresh cited brief" : "Generate cited brief"}</button>{insight ? <article className="p-2 grid gap-2"><p className="text-caos-sm text-caos-text">{insight.summary}</p><ul className="grid gap-1">{insight.claims.map((claim) => <li key={claim.id} className="text-caos-xs text-caos-muted">{claim.statement} · sources {claim.evidence_ids.join(", ") || "missing"}</li>)}</ul></article> : <p role="status" className="p-2 text-caos-xs text-caos-muted">{insightMessage ?? "No cited brief generated."}</p>}</PanelShell>
          </div>}
        />
      </div>
    </EnterprisePage>
  );
}

function MonitorGovernanceSummary({ qa, failed, gaps, mixed, stale, onOpen }: { qa?: number; failed?: number; gaps?: number; mixed?: number; stale?: number; onOpen: () => void }) {
  const rows = [["CP-5 findings", qa], ["Failed gates", failed], ["Source gaps", gaps], ["Mixed origin", mixed], ["Stale sources", stale]] as const;
  return <PanelShell title="Governance summary"><dl className="grid gap-1 p-2">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 border-b border-caos-border/40 py-1"><dt className="text-caos-xs text-caos-muted">{label}</dt><dd className="tabular text-caos-sm text-caos-text">{value ?? "Unavailable"}</dd></div>)}</dl><button type="button" onClick={onOpen} className="caos-action-secondary focus-ring m-2">Open governance queue</button></PanelShell>;
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
