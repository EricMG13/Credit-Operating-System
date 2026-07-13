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
  PortfolioTable, PostureSummary,
} from "@/components/command/views";
import { NlQuery } from "@/components/command/NlQuery";
import { EnterprisePage, type NarrowContract } from "@/components/shared/EnterprisePage";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { RankedChanges } from "@/components/command/RankedChanges";
import { GovernancePanel } from "@/components/command/GovernancePanel";
import { useRoleView } from "@/components/shared/RoleViewProvider";
import type { DecisionContextState } from "@/lib/decision-state";
import { WorkbenchToolbar } from "@/components/shared/WorkbenchToolbar";
import { contextHref, useAnalysisContext } from "@/lib/analysis-workbench";

const REFRESHES_DUE = [ATLF_COVERAGE_ROW, ...COVERAGE].filter(
  (c) => worstStatus(c.cells) === "stale",
).length;

export default function CommandPage() {
  return (
    <RequireAuth>
      <CommandCenter />
    </RequireAuth>
  );
}

function CommandCenter() {
  const analysis = useAnalysisContext({ name: "Portfolio command" });
  const [selected, setSelected] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"positions" | "runs">("positions");
  const { roleView } = useRoleView();

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
    if (current?.active_id === selected && current?.view === activeTab && current?.filters?.role === roleView) return;
    void analysis.patch({
      surface_state: {
        ...context.surface_state,
        command: {
          ...current,
          active_id: selected,
          view: activeTab,
          filters: { ...current?.filters, role: roleView },
        },
      },
    });
  }, [activeTab, analysis, roleView, selected]);

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
      decisionContext={<DecisionHeader state={commandDecision} />}
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
        <div className="flex-1 flex flex-col gap-3.5 min-h-0 min-w-0">
          {/* Dominant opener: the live Watchtower ranked-changes list. PM/QA
              default expanded via DecisionHeader; the panel itself always
              shows (empty/offline states render honestly inline). */}
          <div id="ranked-changes" tabIndex={-1}>
            <PanelShell title="Ranked Changes · Watchtower draft" className="flex-none min-h-0" collapsible>
              <RankedChanges />
            </PanelShell>
          </div>
          {/* Posture bar above query bar */}
          <PostureSummary />
          <NlQuery />

          {/* Coverage area — PM/QA default collapsed (ranked changes above is
              their answer); Analyst keeps it expanded. `key={roleView}` forces
              Panel's uncontrolled defaultCollapsed to re-evaluate on a role
              switch (it's an initial-only useState otherwise). */}
          <div className="flex-1 flex flex-col gap-3.5 min-h-0 min-w-0">
            <div className="flex-1 flex flex-col gap-2 min-h-0 min-w-0">
              <PanelShell
                key={roleView}
                title="Coverage"
                collapsible
                defaultCollapsed={roleView !== "analyst"}
                className="flex-1 min-h-0"
                right={
                  <div className="flex items-center gap-3">
                    <span className="tabular text-caos-xs text-caos-muted">
                      {activeTab === "positions"
                        ? `${PORTFOLIO.length} positions`
                        : `${portfolio.coveredCount} of ${portfolio.issuerCount} covered` +
                          // Honest staleness stamp (FE-3): the board refreshes on an
                          // interval, and the as-of makes the snapshot age visible.
                          (portfolio.fetchedAt
                            ? ` · as of ${portfolio.fetchedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : "")}
                    </span>
                    <div className="flex bg-caos-bg border border-caos-border/80 rounded p-[2px] gap-0.5">
                      {([
                        ["Sample Sleeve", "positions"],
                        ["Live Coverage", "runs"],
                      ] as const).map(([label, mode]) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setActiveTab(mode)}
                          className={
                            "shrink-0 tabular text-caos-2xs px-2.5 py-0.5 rounded-sm transition-caos focus-ring cursor-pointer " +
                            (activeTab === mode
                              ? "bg-caos-elevated text-caos-text font-medium"
                              : "text-caos-muted hover:text-caos-text")
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                }
              >
                {activeTab === "positions" ? (
                  <PortfolioTable selected={selected} onSelect={setSelected} />
                ) : (
                  <div className="overflow-x-auto h-full flex flex-col">
                    <LiveCoverage rows={portfolio.rows} selected={selected} onSelect={setSelected} />
                  </div>
                )}
              </PanelShell>
            </div>
          </div>

          {/* Daily Digest — live coverage-health readout (WARF, staleness,
              CCC-cliff watch, 24h activity); hidden until the registry is
              live so the research lens keeps only its seeded panels offline. */}
          {digestLive && digest ? (
            <PanelShell
              title="Daily Digest · coverage & ratings"
              className="flex-none min-h-0"
              collapsible
              defaultCollapsed={true}
              right={
                <span className="tabular text-caos-xs" style={{ color: "var(--caos-success)" }}>
                  ● LIVE · as of {new Date(digest.as_of).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </span>
              }
            >
              <DailyDigestPanel digest={digest} />
            </PanelShell>
          ) : null}

          {/* Combined governance panel: QA + Gaps (unchanged, live-wired) plus
              a new stale-sources category from the digest already fetched
              above — zero new endpoints. mb-9 keeps this panel's title bar
              clear of the floating Ask launcher (fixed bottom-3 right-3),
              which otherwise sits on top of it at this collapsed height
              (critique P2). */}
          <PanelShell
            title="Governance · CP-5 / CP-0 / Staleness"
            className="flex-none min-h-0 mb-9"
            collapsible
            defaultCollapsed={true}
          >
            <GovernancePanel
              liveQa={liveQa}
              liveFailedGates={liveFailed}
              liveGaps={liveGapsItems}
              liveMixedOrigin={liveMixed}
              staleRows={digestLive ? digest?.stale ?? [] : []}
            />
          </PanelShell>
        </div>
      </div>

      {selected ? <IssuerStrip code={selected} liveRow={liveSelected} onClose={() => setSelected(null)} /> : null}
    </EnterprisePage>
  );
}
