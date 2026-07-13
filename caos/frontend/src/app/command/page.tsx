"use client";

// Concept A — The Command Center: portfolio posture and governance.
// Unified CIO/PM and Head of Research dashboard with toggleable sleeve and run tables.
// Sector RV has been promoted to a standalone route under /sector-rv.
// Click a row for the issuer detail strip; ATLF links into the Analytical Deep-Dive.

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { headStat } from "@/components/shared/headStat";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { COVERAGE, PORTFOLIO, simAlertsToday } from "@/lib/command/data";
import { ATLF_COVERAGE_ROW, worstStatus } from "@/lib/command/coverage";
import { PORTFOLIO_AVG_DM_LABEL } from "@/lib/command/stats";
import { useSharedDayRun } from "@/lib/pipeline/sim";
import { Dot, SimControls } from "@/components/pipeline/atoms";
import { Panel as PanelShell } from "@/components/shared/Panel";
import { LiveCoverage } from "@/components/command/LiveCoverage";
import { DailyDigestPanel } from "@/components/command/DailyDigestPanel";
import { usePortfolio } from "@/lib/engine/usePortfolio";
import { liveQaItems, liveFailedGates } from "@/lib/command/qa";
import { liveGaps } from "@/lib/command/gaps";
import { liveMixedOrigin } from "@/lib/command/mixedOrigin";
import { useDigest } from "@/lib/engine/useDigest";
import {
  IssuerStrip,
  PortfolioTable,
} from "@/components/command/views";
import { EnterprisePage, type NarrowContract } from "@/components/shared/EnterprisePage";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { RankedChanges } from "@/components/command/RankedChanges";
import { GovernancePanel } from "@/components/command/GovernancePanel";
import { useRoleView } from "@/components/shared/RoleViewProvider";
import type { DecisionContextState } from "@/lib/decision-state";
import { WorkbenchToolbar } from "@/components/shared/WorkbenchToolbar";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { SemanticVisualization, type VisualizationSpec } from "@/components/charts/SemanticVisualization";
import { analysisApi, contextHref, type InsightArtifact, useAnalysisContext } from "@/lib/analysis-workbench";
import { useTypedUrlState } from "@/lib/typed-url-state";

const REFRESHES_DUE = [ATLF_COVERAGE_ROW, ...COVERAGE].filter(
  (c) => worstStatus(c.cells) === "stale",
).length;
const COMMAND_URL_KEYS = ["dataset", "selected"] as const;
type CommandDataset = "changes" | "positions" | "coverage" | "governance";

export default function CommandPage() {
  return (
    <RequireAuth>
      <CommandCenter />
    </RequireAuth>
  );
}

function CommandCenter() {
  const analysis = useAnalysisContext({ name: "Portfolio command" });
  const { roleView } = useRoleView();
  const { values: urlState, update: updateUrlState } = useTypedUrlState(COMMAND_URL_KEYS);
  const selected = urlState.selected;
  const requestedDataset = urlState.dataset as CommandDataset | null;
  const dataset: CommandDataset = requestedDataset && ["changes", "positions", "coverage", "governance"].includes(requestedDataset)
    ? requestedDataset
    : roleView === "qa" ? "governance" : roleView === "pm" ? "changes" : "coverage";
  const [insight, setInsight] = useState<InsightArtifact | null>(null);
  const [insightMessage, setInsightMessage] = useState<string | null>(null);

  const run = useSharedDayRun();
  const tick = run.sim.tick;
  const portfolio = usePortfolio();
  // Prefer the live CP-5 gate queue (real run roll-ups) over the seeded finding
  // list when a backend answered; offline, QaQueue falls back to the seed (A-1).
  const liveQa = portfolio.live ? liveQaItems(portfolio.rows) : undefined;
  // Committee-only gate failures (Draft Only / Insufficient Info despite a
  // passed CP-5 severity gate) — a distinct governance category from liveQa.
  const liveFailed = portfolio.live ? liveFailedGates(portfolio.rows) : undefined;
  // Live CP-0 source-gap board off the same portfolio fetch; seed fallback offline.
  const liveGapsItems = portfolio.live ? liveGaps(portfolio.rows) : undefined;
  // Live-run-backed issuers whose bespoke tabs still stay the reference fixture.
  const liveMixed = portfolio.live ? liveMixedOrigin(portfolio.rows) : undefined;
  // Live coverage-health digest (staleness / WARF / CCC watch); empty → the
  // research lens keeps only its seeded panels.
  const { digest, live: digestLive, loading: digestLoading } = useDigest();

  // A Live Coverage selection resolves against the LIVE rows, never the seeded
  // fixture — a live ticker matching a seeded code must not show sample figures
  // attributed to the live issuer (and an unmatched one must not dead-end).
  const liveSelected = selected
    ? portfolio.rows.find((r) => (r.ticker ?? r.issuer_id) === selected) ?? null
    : null;

  // "Still accruing" is "not done yet" — matches Monitor's identical read of
  // the same shared clock so the two pages never disagree (critique P1).
  const alertsToday = simAlertsToday(tick, !run.sim.done);
  const digestAsOf = digest?.as_of
    ? new Date(digest.as_of).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : null;
  const digestAuthority = digestAsOf ? {
    provenance: {
      origin: "LIVE" as const,
      method: "DERIVED" as const,
      freshness: digest && digest.stale.length > 0 ? "STALE" as const : "CURRENT" as const,
      detail: "Daily digest assembled from completed engine runs.",
      asOf: digestAsOf,
    },
    approval: "UNRATIFIED" as const,
  } : undefined;
  const commandDecision: DecisionContextState = {
    whatChanged: digestLoading
      ? { kind: "loading", message: "Checking 24-hour engine activity…" }
      : digestLive && digest && digestAsOf
        ? (Object.values(digest.activity_24h || {}).some((value) => typeof value === "number" && value > 0)
          ? {
              kind: "ready",
              value: `${Object.entries(digest.activity_24h || {}).filter(([, value]) => typeof value === "number" && value > 0).slice(0, 3).map(([key, value]) => `${value} ${key.replaceAll("_", " ")}`).join(" · ")} in 24h`,
              asOf: digestAsOf,
              authority: digestAuthority,
            }
          : { kind: "observed-empty", message: "No engine activity observed in 24h", asOf: digestAsOf, authority: digestAuthority })
        : { kind: "unavailable", message: "Live activity observation unavailable" },
    whyItMatters: digestLoading
      ? { kind: "loading", message: "Calculating portfolio impact…" }
      : digestLive && digest && digestAsOf && digest.warf != null
        ? { kind: "ready", value: `WARF ${digest.warf}${digest.warf_band ? ` (${digest.warf_band})` : ""} · CCC watch ${digest.ccc_watch.length}`, asOf: digestAsOf, authority: digestAuthority }
        : { kind: "unavailable", message: "Portfolio impact unavailable" },
    requiredAction: portfolio.loading
      ? { kind: "loading", message: "Checking governance queues…" }
      : portfolio.error
        ? { kind: "offline", lastKnown: "Governance queues unavailable" }
        : portfolio.fetchedAt
          ? {
              kind: "ready",
              value: `${(liveQa ?? []).length + (liveFailed ?? []).length} QA findings · ${(liveGapsItems ?? []).length} source gaps`,
              asOf: portfolio.fetchedAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
              authority: { provenance: { origin: "LIVE", method: "DERIVED", freshness: "CURRENT", detail: "Portfolio QA and source-gap roll-up." }, approval: "UNRATIFIED" },
            }
          : { kind: "unavailable", message: "Governance queue observation unavailable" },
    evidenceHealth: digestLoading
      ? { kind: "loading", message: "Checking evidence coverage…" }
      : digestLive && digest && digestAsOf
        ? {
            kind: digest.stale.length > 0 ? "stale" : "ready",
            value: `${digest.stale.length} stale of ${digest.coverage?.issuers ?? 0} covered · threshold ${digest.stale_threshold_days}d`,
            asOf: digestAsOf,
            authority: digestAuthority,
          }
        : { kind: "unavailable", message: "Evidence health unavailable" },
  };

  useEffect(() => {
    const context = analysis.context;
    if (!context) return;
    const current = context.surface_state.command;
    if (current?.active_id === selected && current?.view === dataset && current?.filters?.role === roleView) return;
    void analysis.patch({
      surface_state: {
        ...context.surface_state,
        command: {
          ...current,
          active_id: selected,
          view: dataset,
          filters: { ...current?.filters, role: roleView },
        },
      },
    });
  }, [analysis, dataset, roleView, selected]);

  useEffect(() => {
    if (!analysis.context?.id) return;
    let alive = true;
    analysisApi.listInsights(analysis.context.id, { surface: "command", kind: "decision-brief", limit: 20 })
      .then((page) => { if (alive) setInsight(page.current); })
      .catch(() => { if (alive) setInsightMessage("No cited decision brief is available."); });
    return () => { alive = false; };
  }, [analysis.context?.id]);

  const generateInsight = async () => {
    if (!analysis.context?.id) return;
    setInsightMessage("Generating cited decision brief…");
    try {
      const created = await analysisApi.createInsight(analysis.context.id, {
        surface: "command",
        kind: "decision-brief",
        subject_refs: { alert_event_id: selected },
        force: Boolean(insight),
      });
      if (created.status === "ready" || created.status === "ratified") {
        setInsight(created);
        setInsightMessage(null);
      } else {
        setInsightMessage(`Brief is ${created.status}.`);
      }
    } catch (reason) {
      setInsightMessage(reason instanceof Error ? reason.message : "Cited decision brief is unavailable.");
    }
  };

  const narrowContract: NarrowContract = {
    essentialControls: (
      <div className="flex items-center gap-4 shrink-0 overflow-x-auto caos-no-scrollbar">
        {headStat("Issuers", String(PORTFOLIO.length))}
        {/* M-6 honesty: a failed portfolio fetch must not read as a real 0/0 count */}
        {portfolio.error
          ? headStat("Live Coverage", "—", "var(--caos-warning)")
          : headStat("Live Coverage", `${portfolio.coveredCount}/${portfolio.issuerCount}`, "var(--caos-success)")}
        {headStat("Refreshes Due", String(REFRESHES_DUE), "var(--caos-warning)", REFRESHES_DUE > 0)}
        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Alerts</span>
          <span className="tabular text-caos-md font-medium" style={{ color: "var(--caos-accent)" }}>{alertsToday}</span>
        </span>
      </div>
    ),
  };

  return (
    <EnterprisePage kind="overview"
      identity={
        <ShellIdentity
          badges={
          <span
            className="tabular text-caos-2xs uppercase tracking-wider whitespace-nowrap shrink-0 text-caos-muted"
            title="Sample US HY sleeve for the Phase-1 showcase — not live positions."
          >
            Sample — not live
          </span>
          }
          title="US HY sleeve"
        />
      }
      primaryAction={
        <a href="#ranked-changes" className="caos-primary-action no-underline focus-ring">Open top change</a>
      }
      status={digestAsOf ? <span className="tabular text-caos-2xs text-caos-muted">Observed {digestAsOf}</span> : null}
      contextualControls={
        <>
          {/* Seeded sample-sleeve stat — visible on wide desks only; the DM
              column in the table below carries it everywhere else. */}
          <span className="hidden 2xl:flex">{headStat("Avg 3Y DM", PORTFOLIO_AVG_DM_LABEL)}</span>
          {portfolio.error
            ? headStat("Live Coverage", "—", "var(--caos-warning)")
            : headStat("Live Coverage", `${portfolio.coveredCount}/${portfolio.issuerCount}`, "var(--caos-success)")}
          {/* Deliberately NOT repeated here (frees the width that kept the
              active concept chip and the not-live marker clipped at 1440px):
              - Issuers count → visible as "382 positions" on the Coverage
                panel and the posture bar;
              - Refreshes-due (a seeded fixture stat) → live staleness now
                lives in the DecisionHeader's Evidence-health cell;
              - QA-findings / source-gaps → DecisionHeader Required-action
                cell + the QA panel below. */}
        </>
      }
      utilityLabel="Simulation controls"
      utilityControls={
        <div className="grid gap-3">
          <SimControls run={run} />
          <span className="flex items-center gap-1.5" title="Demo replay clock, not a live feed — matches Monitor and Sector RV">
            <Dot sev={run.sim.done ? "ok" : "running"} pulse={run.playing && !run.sim.done} glyph={run.sim.done} />
            <span className="tabular text-caos-2xs text-caos-muted uppercase tracking-wider">
              {run.playing && !run.sim.done ? "SIM" : run.sim.done ? "COMPLETE" : "PAUSED"} · {run.clock} ET
            </span>
          </span>
          {analysis.context ? <Link href={contextHref("/monitor", analysis.context.id)} className="caos-action-secondary no-underline focus-ring">Open Monitor</Link> : null}
        </div>
      }
      narrowContract={narrowContract}
    >
      {/* Decision header — cells populate from the LIVE digest + portfolio
          roll-ups only; offline they state "— no data" rather than promoting
          seeded sample counts into a decision strip (mock-vs-live seam). */}
      {/* workspace */}
      <div className="flex-1 min-h-0 gap-2 p-2 flex flex-col overflow-hidden">
        <WorkbenchToolbar
          title="Portfolio command"
          description="Ranked changes, portfolio posture and governance queues in one decision surface."
          count={portfolio.loading ? "Loading" : portfolio.error ? "Live coverage unavailable" : `${portfolio.coveredCount}/${portfolio.issuerCount} covered`}
          viewLabel={`View: ${roleView === "pm" ? "PM" : roleView === "qa" ? "QA" : "Analyst"}`}
        />
        <div id="ranked-changes" className="caos-persona-route command-workbench flex-1 min-h-0" tabIndex={-1}>
          <PersonaWorkbench
            surface="command"
            decision={<DecisionHeader state={commandDecision} />}
            primary={
              <PanelShell
                title={dataset === "changes" ? "Ranked Changes · Watchtower draft" : dataset === "positions" ? "Sample sleeve · positions" : dataset === "coverage" ? "Live Coverage" : "Governance · CP-5 / CP-0 / Staleness"}
                className="h-full min-h-0"
                right={<div role="tablist" aria-label="Command dataset" className="flex items-center gap-1 overflow-x-auto">
                  {([ ["Changes", "changes"], ["Sample sleeve", "positions"], ["Live coverage", "coverage"], ["Governance", "governance"] ] as const).map(([label, mode]) => <button key={mode} type="button" role="tab" aria-selected={dataset === mode} onClick={() => updateUrlState({ dataset: mode })} className="caos-action-secondary focus-ring whitespace-nowrap">{label}</button>)}
                </div>}
              >
                {dataset === "changes" ? <RankedChanges /> : dataset === "governance" ? <GovernancePanel liveQa={liveQa} liveFailedGates={liveFailed} liveGaps={liveGapsItems} liveMixedOrigin={liveMixed} staleRows={digestLive ? digest?.stale ?? [] : []} /> : (
                  <DominantTableRegion ownerId="command-worklist" label={dataset === "positions" ? "Sample sleeve positions" : "Live coverage worklist"} className="h-full min-h-0">
                    {dataset === "positions" ? <PortfolioTable selected={selected} onSelect={(value) => updateUrlState({ selected: value }, "replace")} /> : <div className="overflow-x-auto h-full flex flex-col"><LiveCoverage rows={portfolio.rows} selected={selected} onSelect={(value) => updateUrlState({ selected: value }, "replace")} /></div>}
                  </DominantTableRegion>
                )}
              </PanelShell>
            }
            context={<CommandContext digest={digestLive ? digest : null} digestAsOf={digestAsOf} />}
            inspector={<div className="grid gap-2">
              <CommandGovernanceSummary qa={liveQa?.length} failed={liveFailed?.length} gaps={liveGapsItems?.length} mixed={liveMixed?.length} stale={digestLive ? digest?.stale?.length ?? 0 : undefined} onOpen={() => updateUrlState({ dataset: "governance" })} />
              <PanelShell title="Cited decision brief">
                <button type="button" onClick={() => void generateInsight()} className="caos-action-secondary focus-ring m-2">{insight ? "Refresh cited brief" : "Generate cited brief"}</button>
                {insight ? <article className="p-2 pt-0 grid gap-2"><p className="text-caos-sm text-caos-text">{insight.summary}</p><ul className="grid gap-1">{insight.claims.map((claim) => <li key={claim.id} className="text-caos-xs text-caos-muted">{claim.statement} · sources {claim.evidence_ids.join(", ") || "missing"}</li>)}</ul></article> : <p role="status" className="p-2 pt-0 text-caos-xs text-caos-muted">{insightMessage ?? "No cited brief generated."}</p>}
              </PanelShell>
              {analysis.context ? <Link href={contextHref("/query", analysis.context.id)} className="caos-action-secondary no-underline focus-ring">Open cross-issuer Query</Link> : null}
            </div>}
          />
        </div>
      </div>

      {selected ? <IssuerStrip code={selected} liveRow={liveSelected} onClose={() => updateUrlState({ selected: null }, "replace")} /> : null}
    </EnterprisePage>
  );
}

function CommandGovernanceSummary({ qa, failed, gaps, mixed, stale, onOpen }: { qa?: number; failed?: number; gaps?: number; mixed?: number; stale?: number; onOpen: () => void }) {
  const rows = [["CP-5 findings", qa], ["Failed gates", failed], ["Source gaps", gaps], ["Mixed origin", mixed], ["Stale sources", stale]] as const;
  return <PanelShell title="Governance summary"><dl className="grid gap-1 p-2">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 border-b border-caos-border/40 py-1"><dt className="text-caos-xs text-caos-muted">{label}</dt><dd className="tabular text-caos-sm text-caos-text">{value ?? "Unavailable"}</dd></div>)}</dl><button type="button" onClick={onOpen} className="caos-action-secondary focus-ring m-2">Open governance queue</button></PanelShell>;
}

function CommandContext({ digest, digestAsOf }: { digest: ReturnType<typeof useDigest>["digest"] | null; digestAsOf: string | null }) {
  const postureOrder = ["OVERWEIGHT", "HOLD", "UNDERWEIGHT", "REDUCE"] as const;
  const rows = postureOrder.map((posture) => ({ posture, count: PORTFOLIO.filter((position) => position.posture === posture).length }));
  const spec: VisualizationSpec = {
    kind: "bar",
    title: "Sample sleeve posture",
    unit: "positions",
    asOf: digestAsOf ?? undefined,
    sourceIds: ["sample-portfolio-sleeve"],
    accessibleSummary: `${PORTFOLIO.length} sample positions: ${rows.map((row) => `${row.posture} ${row.count}`).join(", ")}.`,
    status: rows.some((row) => row.posture === "REDUCE" && row.count > 0) ? { label: "Reduce posture present", tone: "critical" } : { label: "No reduce posture", tone: "success" },
    data: rows,
    tabularFallback: { label: "Sample sleeve posture counts", columns: [{ key: "posture", label: "Posture" }, { key: "count", label: "Positions" }], data: rows },
    chart: { type: "interval", encode: { x: "posture", y: "count" } },
  };
  return <div className="grid gap-2"><SemanticVisualization spec={spec} />{digest ? <PanelShell title="Daily Digest · coverage & ratings" right={<span className="tabular text-caos-xs text-caos-success">● LIVE</span>}><DailyDigestPanel digest={digest} /></PanelShell> : <PanelShell title="Daily Digest"><p className="p-2 text-caos-xs text-caos-muted">Live coverage digest unavailable.</p></PanelShell>}</div>;
}
