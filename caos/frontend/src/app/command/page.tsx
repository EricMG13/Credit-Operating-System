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
import { ALERTS, GAPS, PORTFOLIO, QA_QUEUE } from "@/lib/command/data";
import { SECTORS as RV_SECTORS } from "@/lib/command/rvdata";
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
  PortfolioTable, QaQueue, SectorBoard,
} from "@/components/command/views";

export default function CommandPage() {
  return (
    <RequireAuth>
      <CommandCenter />
    </RequireAuth>
  );
}


function CommandCenter() {
  const [view, setView] = useState<"cio" | "res" | "rv">("cio");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const onCycle = (e: Event) => {
      const customEvent = e as CustomEvent<{ direction: number }>;
      const dir = customEvent.detail?.direction || 1;
      const views = ["cio", "res", "rv"] as const;
      setView((curr) => {
        const idx = views.indexOf(curr);
        const nextIdx = (idx + dir + views.length) % views.length;
        return views[nextIdx];
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

  const alertsToday = live || run.sim.done ? Math.min(ALERTS.length, Math.floor(tick / 5) + 2) : ALERTS.length;
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
      <div className="h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-5 px-4">
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
        <span className="text-caos-xl text-caos-text font-medium truncate min-w-0">
          {view === "cio"
            ? "Coverage — US HY"
            : view === "res"
            ? "Coverage Health — US HY"
            : "Sector Relative Value — Loan Universe"}
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
        {/* Progressive disclosure by value (header is too dense to show all at
            laptop widths). Always: the live "what changed" signal
            (Watch/QA/Alerts). ≥1280: portfolio context KPIs. */}
        {view === "rv" ? (
          <>
            <div className="hidden xl:flex items-center gap-5 shrink-0">
              {headStat("Universe", "US HY Loan")}
              {headStat("Sectors", String(RV_SECTORS.length))}
              {headStat("Peer Loans", String(rvLoanCount))}
            </div>
            <div className="h-4 w-px bg-caos-border hidden xl:block shrink-0" />
            {headStat("Source", "market-data.json", "var(--caos-accent)")}
            {headStat("File Date", "Jun 29 08:39")}
          </>
        ) : view === "res" ? (
          <>
            <div className="hidden xl:flex items-center gap-5 shrink-0">
              {headStat("Compliance", "L1–L6 SLA")}
              {headStat("Refreshes Due", "2", "var(--caos-warning)", true)}
            </div>
            <div className="h-4 w-px bg-caos-border hidden xl:block shrink-0" />
            {headStat("QA Findings", String(QA_QUEUE.length), "var(--caos-warning)", true)}
            {headStat("Source Gaps", String(GAPS.length), "var(--caos-critical)", true)}
          </>
        ) : (
          <>
            <div className="hidden xl:flex items-center gap-5 shrink-0">
              {headStat("Avg 3Y DM", "+504bps")}
              {headStat("Issuers", String(portfolio.issuerCount || PORTFOLIO.length))}
            </div>
            <div className="h-4 w-px bg-caos-border hidden xl:block shrink-0" />
            {headStat("Watch List", "3", "var(--caos-critical)", true)}
            {headStat("QA Posture", "5 open", "var(--caos-warning)", true)}
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
          <div className="flex flex-col gap-2 min-h-0 min-w-0">
            <NlQuery />
            {portfolio.coveredCount > 0 ? (
              <PanelShell
                title="Live Coverage · latest runs"
                className="flex-[2]"
                right={<span className="tabular text-caos-xs" style={{ color: "var(--caos-success)" }}>● LIVE · {portfolio.coveredCount} of {portfolio.issuerCount} covered</span>}
              >
                <div className="overflow-x-auto">
                  <LiveCoverage rows={portfolio.rows} />
                </div>
              </PanelShell>
            ) : null}
            <PanelShell
              title="Coverage"
              className="flex-[3]"
              right={<span className="tabular text-caos-xs text-caos-muted">{PORTFOLIO.length} positions · marks {run.clock}</span>}
            >
              <PortfolioTable selected={selected} onSelect={setSelected} tick={tick} />
            </PanelShell>
            <PanelShell
              title="Sector Review Board · CP-SR"
              className="flex-[2]"
              collapsible
              right={<span className="tabular text-caos-xs text-caos-muted">8 sectors · 2 refreshes due</span>}
            >
              <SectorBoard />
            </PanelShell>
          </div>
        ) : (
          <div className="flex flex-col gap-2 min-h-0 min-w-0">
            <PanelShell
              title="Module Coverage Matrix · L1–L6 freshness"
              className="flex-[3]"
              right={<span className="tabular text-caos-xs text-caos-muted">refresh SLA: L1 5d · L2 10d · L4 30d</span>}
            >
              <CoverageMatrix />
            </PanelShell>
            <div className="flex-[2] grid grid-cols-2 gap-2 min-h-0">
              <PanelShell title="QA Queue · CP-5 open findings"><QaQueue /></PanelShell>
              <PanelShell title="Source Gaps · CP-0 gap log"><GapsList /></PanelShell>
            </div>
          </div>
        )}
      </div>

      {selected ? <IssuerStrip code={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
