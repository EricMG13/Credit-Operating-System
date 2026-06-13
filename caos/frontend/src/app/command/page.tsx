"use client";

// Concept A — The Command Center: portfolio posture, CP-MON email-intelligence
// intake with live alert routing, and the CP-SR sector board. Toggleable
// CIO/PM ⇄ Head-of-Research views (research = L1–L6 coverage freshness matrix
// + CP-5 QA queue + CP-0 source gaps). Click a row for the issuer detail
// strip; ATLF links into the Analytical Deep-Dive.

import { useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { ALERTS } from "@/lib/command/data";
import { SIM_PLAN } from "@/lib/pipeline/data";
import { useSimRun } from "@/lib/pipeline/sim";
import { Dot, SimControls } from "@/components/pipeline/atoms";
import { Panel as PanelShell } from "@/components/shared/Panel";
import { SectorRV } from "@/components/command/SectorRV";
import {
  AlertFeed, CoverageMatrix, EmailIntel, GapsList, IssuerStrip,
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

  const alertsToday = live || run.sim.done ? Math.min(ALERTS.length, Math.floor(tick / 5) + 2) : ALERTS.length;
  const headStat = (l: string, v: string, c?: string, big?: boolean) => (
    <span key={l} className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="tabular text-caos-micro uppercase tracking-wider text-caos-muted">{l}</span>
      <span className={"tabular " + (big ? "text-[14px] font-medium" : "text-caos-row")} style={{ color: c }}>{v}</span>
    </span>
  );

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <div className="h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-5 px-4">
        <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-[11px] transition-caos whitespace-nowrap">
          ← Directory
        </Link>
        <div className="h-4 w-px bg-caos-border" />
        <ConceptNav compact />
        <div className="h-4 w-px bg-caos-border" />
        <div className="flex items-center rounded border border-caos-border overflow-hidden">
          {([{ k: "cio", l: "PORTFOLIO" }, { k: "res", l: "RESEARCH" }, { k: "rv", l: "SECTOR RV" }] as const).map((v) => (
            <button
              key={v.k}
              onClick={() => setView(v.k)}
              className={"tabular whitespace-nowrap text-[10px] px-3 py-1.5 transition-caos " + (view === v.k ? "bg-caos-elevated text-caos-text" : "text-caos-muted hover:text-caos-text")}
            >
              {v.l}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-caos-text font-medium whitespace-nowrap">
          {view === "cio"
            ? "Portfolio Posture — US HY Sleeve"
            : view === "res"
            ? "Coverage Health — US HY Sleeve"
            : "Sector Relative Value — Loan Universe"}
        </span>
        <div className="flex-1"></div>
        {headStat("Sleeve NAV", "$2.41B")}
        {headStat("Avg 3Y DM", "+504bps")}
        {headStat("Names", "10")}
        <div className="h-4 w-px bg-caos-border" />
        {headStat("Watch", "3", "var(--caos-critical)", true)}
        {headStat("QA open", "5", "var(--caos-warning)", true)}
        {headStat("Alerts today", String(alertsToday), "var(--caos-accent)", true)}
        <SimControls run={run} />
        <span className="tabular text-[10px] text-caos-muted whitespace-nowrap hidden 2xl:inline">{run.clock} ET</span>
      </div>

      {/* workspace — Sector RV runs full-width; the other views keep the
          CP-MON intake column on the right */}
      <div
        className={
          "flex-1 min-h-0 gap-2 p-2 " +
          (view === "rv" ? "flex flex-col" : "grid grid-cols-[minmax(0,1fr)_624px]")
        }
      >
        {view === "rv" ? (
          <SectorRV />
        ) : view === "cio" ? (
          <div className="flex flex-col gap-2 min-h-0 min-w-0">
            <PanelShell
              title="Portfolio Posture · CP-3C"
              className="flex-[3]"
              right={<span className="tabular text-[9px] text-caos-muted">10 issuers · marks {run.clock}</span>}
            >
              <div className="overflow-x-auto">
                <PortfolioTable selected={selected} onSelect={setSelected} tick={tick} />
              </div>
            </PanelShell>
            <PanelShell
              title="Sector Review Board · CP-SR"
              className="flex-[2]"
              right={<span className="tabular text-[9px] text-caos-muted">8 sectors · 2 refreshes due</span>}
            >
              <SectorBoard />
            </PanelShell>
          </div>
        ) : (
          <div className="flex flex-col gap-2 min-h-0 min-w-0">
            <PanelShell
              title="Module Coverage Matrix · L1–L6 freshness"
              className="flex-[3]"
              right={<span className="tabular text-[9px] text-caos-muted">refresh SLA: L1 5d · L2 10d · L4 30d</span>}
            >
              <CoverageMatrix />
            </PanelShell>
            <div className="flex-[2] grid grid-cols-2 gap-2 min-h-0">
              <PanelShell title="QA Queue · CP-5 open findings"><QaQueue /></PanelShell>
              <PanelShell title="Source Gaps · CP-0 gap log"><GapsList /></PanelShell>
            </div>
          </div>
        )}

        {view !== "rv" ? (
        <div className="flex flex-col gap-2 min-h-0">
          <PanelShell
            title="Email Intelligence · CP-MON intake"
            className="flex-[5]"
            right={
              <span className="flex items-center gap-1.5">
                <Dot sev="running" pulse={live} />
                <span className="tabular text-[9px] text-caos-muted">{live ? "LIVE" : "PAUSED"} · 105 msgs today</span>
              </span>
            }
          >
            <EmailIntel tick={tick} live={live || run.sim.done} />
          </PanelShell>
          <PanelShell
            title="Alert Routing · CP-MON-H"
            className="flex-[4]"
            right={<span className="tabular text-[9px] text-caos-muted">{alertsToday} routed</span>}
          >
            <AlertFeed tick={tick} live={live || run.sim.done} />
          </PanelShell>
        </div>
        ) : null}
      </div>

      {selected ? <IssuerStrip code={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
