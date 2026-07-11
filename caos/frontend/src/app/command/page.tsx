"use client";

// Concept A — The Command Center: portfolio posture and governance.
// Unified CIO/PM and Head of Research dashboard with toggleable sleeve and run tables.
// Sector RV has been promoted to a standalone route under /sector-rv.
// Click a row for the issuer detail strip; ATLF links into the Analytical Deep-Dive.

import { useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { headStat } from "@/components/shared/headStat";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { COVERAGE, GAPS, PORTFOLIO, QA_QUEUE, simAlertsToday } from "@/lib/command/data";
import { ATLF_COVERAGE_ROW, worstStatus } from "@/lib/command/coverage";
import { PORTFOLIO_AVG_DM_LABEL } from "@/lib/command/stats";
import { SIM_PLAN } from "@/lib/pipeline/data";
import { useSimRun } from "@/lib/pipeline/sim";
import { SimControls } from "@/components/pipeline/atoms";
import { Panel as PanelShell } from "@/components/shared/Panel";
import { LiveCoverage } from "@/components/command/LiveCoverage";
import { usePortfolio } from "@/lib/engine/usePortfolio";
import {
  GapsList, IssuerStrip,
  PortfolioTable, PostureSummary, QaQueue,
} from "@/components/command/views";
import { NlQuery } from "@/components/command/NlQuery";
import { ResponsiveShell, type NarrowContract } from "@/components/shared/ResponsiveShell";

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
  const [selected, setSelected] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"positions" | "runs">("positions");

  const run = useSimRun({ autoplay: true, plan: SIM_PLAN });
  const live = run.playing && !run.sim.done;
  const tick = run.sim.tick;
  const portfolio = usePortfolio();

  const alertsToday = simAlertsToday(tick, live || run.sim.done);

  const narrowContract: NarrowContract = {
    essentialControls: (
      <div className="flex items-center gap-4 shrink-0 overflow-x-auto caos-no-scrollbar">
        {headStat("Issuers", String(PORTFOLIO.length))}
        {headStat("Live Coverage", `${portfolio.coveredCount}/${portfolio.issuerCount}`, "var(--caos-success)")}
        {headStat("Refreshes Due", String(REFRESHES_DUE), "var(--caos-warning)", REFRESHES_DUE > 0)}
        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Alerts</span>
          <span className="tabular text-caos-md font-medium" style={{ color: "var(--caos-accent)" }}>{alertsToday}</span>
        </span>
      </div>
    ),
  };

  return (
    <ResponsiveShell
      identity={
        <>
          <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-caos-xl transition-caos whitespace-nowrap">
            ← Directory
          </Link>
          <span className="h-4 w-px bg-caos-border shrink-0" />
          <ConceptNav compact />
          <span className="h-4 w-px bg-caos-border shrink-0" />
          <span className="text-caos-md text-caos-muted truncate min-w-0">US HY sleeve</span>
          <span
            className="tabular text-caos-2xs uppercase tracking-wider whitespace-nowrap shrink-0 text-caos-muted hidden sm:inline"
            title="Sample US HY sleeve for the Phase-1 showcase — not live positions."
          >
            Sample portfolio — not live
          </span>
        </>
      }
      primaryAction={
        <Link
          href="/monitor"
          title="Open Monitor — CP-MON email intelligence & alert routing (demo replay; CP-MON is spec-only, not an executing module)"
          className="no-underline flex items-baseline gap-1.5 whitespace-nowrap rounded border border-caos-border px-2 py-1 hover:border-caos-accent/60 transition-caos group"
        >
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Alerts today</span>
          <span className="tabular text-[14px] font-medium" style={{ color: "var(--caos-accent)" }}>{alertsToday}</span>
          <span className="tabular text-caos-xs text-caos-muted group-hover:text-caos-accent transition-caos">→ Monitor</span>
        </Link>
      }
      contextualControls={
        <>
          {headStat("Avg 3Y DM", PORTFOLIO_AVG_DM_LABEL)}
          {headStat("Issuers", String(PORTFOLIO.length))}
          {headStat("Live Coverage", `${portfolio.coveredCount}/${portfolio.issuerCount}`, "var(--caos-success)")}
          {headStat("Refreshes Due", String(REFRESHES_DUE), "var(--caos-warning)", REFRESHES_DUE > 0)}
          {headStat("QA Findings", String(QA_QUEUE.length), "var(--caos-warning)", QA_QUEUE.length > 0)}
          {headStat("Source Gaps", String(GAPS.length), "var(--caos-critical)", GAPS.length > 0)}
          <SimControls run={run} />
          <span className="tabular text-caos-md text-caos-muted whitespace-nowrap">{run.clock} ET</span>
        </>
      }
      narrowContract={narrowContract}
    >
      {/* workspace */}
      <div className="flex-1 min-h-0 gap-2 p-2 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col gap-3.5 min-h-0 min-w-0">
          {/* Posture bar above query bar */}
          <PostureSummary />
          <NlQuery />

          {/* Coverage area */}
          <div className="flex-1 flex flex-col gap-3.5 min-h-0 min-w-0">
            <div className="flex-1 flex flex-col gap-2 min-h-0 min-w-0">
              <PanelShell
                title="Coverage"
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

          {/* Consolidated QA Findings & Source Gaps at the bottom */}
          <PanelShell
            title="QA Findings & Source Gaps · CP-5 / CP-0"
            className="flex-none min-h-0"
            collapsible
            defaultCollapsed={true}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2.5">
              <div>
                <h3 className="text-caos-xs font-semibold uppercase tracking-wider text-caos-muted mb-2 px-3">QA Queue · CP-5 open findings</h3>
                <QaQueue />
              </div>
              <div>
                <h3 className="text-caos-xs font-semibold uppercase tracking-wider text-caos-muted mb-2 px-3">Source Gaps · CP-0 gap log</h3>
                <GapsList />
              </div>
            </div>
          </PanelShell>
        </div>
      </div>

      {selected ? <IssuerStrip code={selected} onClose={() => setSelected(null)} /> : null}
    </ResponsiveShell>
  );
}