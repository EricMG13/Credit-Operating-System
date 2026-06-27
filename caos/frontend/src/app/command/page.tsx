"use client";

// Concept A — The Command Center: portfolio posture and the CP-SR sector board.
// Toggleable CIO/PM ⇄ Head-of-Research lenses (research = L1–L6 coverage
// freshness matrix + CP-5 QA queue + CP-0 source gaps) plus the full-width
// Sector RV view. Click a row for the issuer detail strip; ATLF links into the
// Analytical Deep-Dive. Live CP-MON intake/alerts now live in the Monitor
// concept — the header alerts badge deep-links there.

import { useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { headStat } from "@/components/shared/headStat";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { ALERTS } from "@/lib/command/data";
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
  const run = useSimRun({ autoplay: true, plan: SIM_PLAN });
  const live = run.playing && !run.sim.done;
  const tick = run.sim.tick;
  // Live cross-issuer posture from completed runs; empty → only the sample board shows.
  const portfolio = usePortfolio();

  const alertsToday = live || run.sim.done ? Math.min(ALERTS.length, Math.floor(tick / 5) + 2) : ALERTS.length;

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
            ? "Portfolio Posture — US HY Sleeve"
            : view === "res"
            ? "Coverage Health — US HY Sleeve"
            : "Sector Relative Value — Loan Universe"}
        </span>
        {/* The Command Center is a Phase-1 showcase (sample sleeve), not live
            positions — there is no portfolio-level live aggregate yet. Label it so
            it's never read as live posture. The NL Query lane below IS live. (#29) */}
        <span
          className="tabular text-caos-2xs uppercase tracking-wider whitespace-nowrap shrink-0"
          role="note"
          title="Sample US HY sleeve for the Phase-1 showcase — not live positions. (The NL Query lane is live.)"
          style={{ color: "var(--caos-warning)" }}
        >
          Sample portfolio — not live
        </span>
        <div className="flex-1 min-w-0"></div>
        {/* Progressive disclosure by value (header is too dense to show all at
            laptop widths). Always: the live "what changed" signal
            (Watch/QA/Alerts). ≥1536: portfolio context KPIs. ≥1780: demo
            sim controls + clock. The title truncates rather than push KPIs off. */}
        <div className="hidden 2xl:flex items-center gap-5 shrink-0">
          {headStat("Sleeve NAV", "$2.41B", undefined, true)}
          {headStat("Avg 3Y DM", "+504bps")}
          {headStat("Names", "10")}
        </div>
        <div className="h-4 w-px bg-caos-border hidden 2xl:block shrink-0" />
        {headStat("Watch", "3", "var(--caos-critical)", true)}
        {headStat("QA open", "5", "var(--caos-warning)", true)}
        <Link
          href="/monitor"
          title="Open Monitor — live CP-MON email intelligence & alert routing"
          className="no-underline flex items-baseline gap-1.5 whitespace-nowrap rounded border border-caos-border px-2 py-1 hover:border-caos-accent/60 transition-caos group"
        >
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Alerts today</span>
          <span className="tabular text-[14px] font-medium" style={{ color: "var(--caos-accent)" }}>{alertsToday}</span>
          <span className="tabular text-caos-xs text-caos-muted group-hover:text-caos-accent transition-caos">→ Monitor</span>
        </Link>
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
              title="Portfolio Posture · CP-3C (sample)"
              className="flex-[3]"
              right={<span className="tabular text-caos-xs text-caos-muted">10 issuers · marks {run.clock}</span>}
            >
              <div className="overflow-x-auto">
                <PortfolioTable selected={selected} onSelect={setSelected} tick={tick} />
              </div>
            </PanelShell>
            <PanelShell
              title="Sector Review Board · CP-SR"
              className="flex-[2]"
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
