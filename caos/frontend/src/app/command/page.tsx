"use client";

// Concept A — The Command Center: portfolio posture and the CP-SR sector board.
// Toggleable CIO/PM ⇄ Head-of-Research lenses (research = L1–L6 coverage
// freshness matrix + CP-5 QA queue + CP-0 source gaps) plus the full-width
// Sector RV view. Click a row for the issuer detail strip; ATLF links into the
// Analytical Deep-Dive. Live CP-MON intake/alerts now live in the Monitor
// concept — the header alerts badge deep-links there.

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { headStat } from "@/components/shared/headStat";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { COVERAGE, GAPS, PORTFOLIO, QA_QUEUE, simAlertsToday } from "@/lib/command/data";
import { ATLF_COVERAGE_ROW, worstStatus } from "@/lib/command/coverage";
import { PORTFOLIO_AVG_DM_LABEL } from "@/lib/command/stats";
import { RV_SECTORS } from "@/lib/command/rvdata";
import { SIM_PLAN } from "@/lib/pipeline/data";
import { useSimRun } from "@/lib/pipeline/sim";
import { SimControls, ToggleGroup } from "@/components/pipeline/atoms";
import { Panel as PanelShell } from "@/components/shared/Panel";
import { SectorRV } from "@/components/command/SectorRV";
import { NlQuery } from "@/components/command/NlQuery";
import { LiveCoverage } from "@/components/command/LiveCoverage";
import { usePortfolio } from "@/lib/engine/usePortfolio";
import {
  CoverageMatrix, GapsList, IssuerStrip,
  PortfolioTable, PostureSummary, QaQueue, SectorBoard,
} from "@/components/command/views";

// "Refreshes Due" reconciles with the coverage matrix below (same worst-status
// helper, same seeded rows incl. the prepended engine-backed ATLF) rather than a
// hardcoded number the matrix visibly contradicts. Static data → module scope.
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


const COMMAND_VIEWS = ["cio", "res", "rv"] as const;

function CommandCenter() {
  const [view, setView] = useState<"cio" | "res" | "rv">("cio");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const onCycle = (e: Event) => {
      const customEvent = e as CustomEvent<{ direction: number }>;
      const dir = customEvent.detail?.direction || 1;
      setView((curr) => {
        const idx = COMMAND_VIEWS.indexOf(curr);
        const nextIdx = (idx + dir + COMMAND_VIEWS.length) % COMMAND_VIEWS.length;
        return COMMAND_VIEWS[nextIdx];
      });
    };
    window.addEventListener("caos:subview-cycle", onCycle);
    return () => window.removeEventListener("caos:subview-cycle", onCycle);
  }, []);

  const run = useSimRun({ autoplay: true, plan: SIM_PLAN });
  const live = run.playing && !run.sim.done;
  const tick = run.sim.tick;
  // Live cross-issuer posture from completed runs; empty → only the sample board shows.
  const portfolio = usePortfolio();
  // Sector board reports its own counts up so the panel header reflects the live
  // shown/due state instead of a hardcoded "8 sectors · 2 refreshes due".
  const [boardSummary, setBoardSummary] = useState({ shown: 0, due: 0 });
  // Unified sector filter: clicking a sector on the review board filters the portfolio positions
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  const [boardCollapsed, setBoardCollapsed] = useState(false);

  const alertsToday = simAlertsToday(tick, live || run.sim.done);
  const rvLoanCount = RV_SECTORS.reduce((sum, sector) => sum + sector.rows.length, 0);
  const lensNote = view === "rv"
    ? "Market-data file — not positions"
    : view === "res"
    ? "Research QA lens"
    : "Sample portfolio — not live";
  const lensNoteTitle = view === "rv"
    ? "Sector RV uses the loaded market-data file and is not a portfolio position view."
    : view === "res"
    ? "Research lens: coverage freshness, CP-5 QA, and CP-0 source gaps."
    : "Sample US HY sleeve for the Phase-1 showcase — not live positions. (The NL Query lane is live.)";

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <div className="min-h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex flex-wrap items-center gap-x-5 gap-y-1 py-1 px-4">
        <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-caos-xl transition-caos whitespace-nowrap">
          ← Directory
        </Link>
        <div className="h-4 w-px bg-caos-border" />
        <ConceptNav compact />
        <div className="h-4 w-px bg-caos-border" />
        <span className="text-caos-muted hover:text-caos-text text-caos-xl transition-caos whitespace-nowrap hidden lg:inline" />
        <ToggleGroup
          className="shrink-0"
          value={view}
          onChange={setView}
          options={[
            { k: "cio", l: "PORTFOLIO" },
            { k: "res", l: "RESEARCH" },
            { k: "rv", l: "SECTOR RV" },
          ] as const}
        />
        <span className="text-caos-md text-caos-muted truncate min-w-0">
          {view === "rv" ? "Loan universe" : "US HY sleeve"}
        </span>
        <span
          className="tabular text-caos-2xs uppercase tracking-wider whitespace-nowrap shrink-0"
          role="note"
          title={lensNoteTitle}
          style={{ color: view === "res" ? "var(--caos-accent)" : "var(--caos-warning)" }}
        >
          {lensNote}
        </span>
        <div className="flex-1 min-w-0"></div>
        {/* Progressive disclosure by value. The header flex-wraps (min-h, not fixed
            h-10), so at narrow widths context KPIs reflow to a second row instead
            of vanishing. Always: the live "what changed" signal. ≥1024: context
            KPIs. ≥1780: SimControls + desk clock (see below). */}
        {view === "rv" ? (
          <>
            <div className="hidden lg:flex items-center gap-5 shrink-0">
              {headStat("Universe", "US HY Loan")}
              {headStat("Sectors", String(RV_SECTORS.length))}
              {headStat("Peer Loans", String(rvLoanCount))}
            </div>
            <div className="h-4 w-px bg-caos-border hidden lg:block shrink-0" />
            {headStat("Source", "market-data", "var(--caos-accent)")}
            {headStat("File Date", "Jun 29 08:39")}
          </>
        ) : view === "res" ? (
          <>
            <div className="hidden lg:flex items-center gap-5 shrink-0">
              {headStat("Compliance", "L1–L6 SLA")}
              {headStat("Refreshes Due", String(REFRESHES_DUE), "var(--caos-warning)", true)}
            </div>
            <div className="h-4 w-px bg-caos-border hidden lg:block shrink-0" />
            {headStat("QA Findings", String(QA_QUEUE.length), "var(--caos-warning)", true)}
            {headStat("Source Gaps", String(GAPS.length), "var(--caos-critical)", true)}
          </>
        ) : (
          <>
            <div className="hidden lg:flex items-center gap-5 shrink-0">
              {headStat("Avg 3Y DM", PORTFOLIO_AVG_DM_LABEL)}
              {/* This stat sits under the "Sample portfolio — not live" lens note, so
                  it names the sample sleeve's size, not the live engine count — the
                  live count is surfaced honestly in the "Live Coverage" panel below.
                  (was `issuerCount || PORTFOLIO.length`, which silently swapped live
                  for seed under a "not live" note — W5.) */}
              {headStat("Issuers", String(PORTFOLIO.length))}
            </div>
            <div className="h-4 w-px bg-caos-border hidden lg:block shrink-0" />
            {/* Posture / on-watch / QA now live in the PostureSummary band (real
                data). Header keeps only the distinct live intake count. */}
            <Link
              href="/monitor"
              title="Open Monitor — live CP-MON email intelligence & alert routing"
              className="no-underline flex items-baseline gap-1.5 whitespace-nowrap rounded border border-caos-border px-2 py-1 hover:border-caos-accent/60 transition-caos group"
            >
              <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Alerts today</span>
              <span className="tabular text-[14px] font-medium" style={{ color: "var(--caos-accent)" }}>{alertsToday}</span>
              <span className="tabular text-caos-xs text-caos-muted group-hover:text-caos-accent transition-caos">→ Monitor</span>
            </Link>
          </>
        )}
        {/* Sim clock/controls are non-essential "desk theatre" — gated to very wide
            screens so they never force the header onto a second row at the common
            13–15" desk widths where the KPIs (the real signal) already reflow. */}
        <div className="hidden min-[1780px]:flex items-center gap-5 shrink-0">
          <SimControls run={run} />
          <span className="tabular text-caos-md text-caos-muted whitespace-nowrap">{run.clock} ET</span>
        </div>
      </div>

      {/* workspace — single column for every lens; CP-MON intake/alerts moved
          to the Monitor concept */}
      <div className="flex-1 min-h-0 gap-2 p-2 flex flex-col">
        {view === "rv" ? (
          <SectorRV />
        ) : view === "cio" ? (
          <div className="flex-1 flex flex-col gap-3.5 min-h-0 min-w-0">
            {/* Posture bar above ask bar */}
            <PostureSummary />
            <NlQuery />

            {/* Main content columns below */}
            <div className="flex-1 flex flex-col xl:flex-row gap-3.5 min-h-0 min-w-0">
              {/* Left Column: Sector Review Board (collapsible) */}
              <div className={`transition-all duration-200 flex flex-col min-h-0 ${boardCollapsed ? "w-10" : "flex-[1.2] xl:w-[420px]"} shrink-0`}>
                {boardCollapsed ? (
                  <div className="w-10 bg-caos-panel border border-caos-border rounded-md flex flex-col items-center py-2 h-full gap-4 shrink-0">
                    <button
                      type="button"
                      onClick={() => setBoardCollapsed(false)}
                      className="w-6 h-6 rounded flex items-center justify-center text-caos-muted hover:text-caos-text hover:bg-caos-elevated transition-caos cursor-pointer focus-ring"
                      aria-label="Expand Sector Review Board"
                    >
                      <svg viewBox="0 0 16 16" className="w-4 h-4 stroke-current" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 4 4 4-4 4" />
                      </svg>
                    </button>
                    <span
                      className="text-caos-2xs font-semibold tracking-[0.2em] uppercase text-caos-muted mt-2 select-none whitespace-nowrap"
                      style={{ writingMode: "vertical-lr" }}
                    >
                      Sector Board · CP-SR
                    </span>
                  </div>
                ) : (
                  <PanelShell
                    title="Sector Review Board · CP-SR"
                    className="flex-1 min-h-0"
                    collapsible
                    onCollapse={() => setBoardCollapsed(true)}
                    right={<span className="tabular text-caos-xs text-caos-muted">{boardSummary.shown} sectors · {boardSummary.due > 0 ? `${boardSummary.due} refresh${boardSummary.due === 1 ? "" : "es"} due` : "all current"}</span>}
                  >
                    <SectorBoard clock={run.clock} onSummary={setBoardSummary} selectedSector={sectorFilter} onSelectSector={setSectorFilter} />
                  </PanelShell>
                )}
              </div>

              {/* Right Column: Coverage Table (expands) */}
              <div className="flex-[3] flex flex-col gap-2 min-h-0 min-w-0">
                <PanelShell
                  title="Coverage"
                  className="flex-1 min-h-0"
                  right={<span className="tabular text-caos-xs text-caos-muted">{PORTFOLIO.length} positions · sample marks</span>}
                >
                  <PortfolioTable selected={selected} onSelect={setSelected} sectorFilter={sectorFilter} />
                </PanelShell>
              </div>
            </div>
          </div>
        ) : (
          <div className="@container flex-1 flex flex-col gap-3.5 min-h-0 min-w-0">
            {/* Live Coverage replacing Module Coverage Matrix */}
            <PanelShell
              title="Live Coverage · latest runs"
              className="flex-[3] min-h-0"
              right={<span className="tabular text-caos-xs" style={{ color: "var(--caos-success)" }}>● LIVE · {portfolio.coveredCount} of {portfolio.issuerCount} covered</span>}
            >
              <div className="overflow-x-auto">
                <LiveCoverage rows={portfolio.rows} selected={selected} onSelect={setSelected} />
              </div>
            </PanelShell>

            {/* Consolidated QA Findings & Source Gaps */}
            <PanelShell
              title="QA Findings & Source Gaps · CP-5 / CP-0"
              className="flex-[2] min-h-0"
              collapsible
              defaultCollapsed={false}
            >
              <div className="grid grid-cols-1 @[40rem]:grid-cols-2 gap-4 p-2.5">
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
        )}
      </div>

      {selected ? <IssuerStrip code={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
