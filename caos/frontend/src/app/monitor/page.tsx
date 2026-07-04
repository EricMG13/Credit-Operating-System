"use client";

// Concept F — The Monitor: CP-MON email-intelligence intake with live alert
// routing, promoted out of the Command Center into its own standing surface.
// This is the "trading-desk alertness" pillar — a stream you watch, distinct in
// cadence from the posture/coverage snapshots in Command. Email Intelligence
// (CP-MON) is the primary column; Alert Routing (CP-MON-H) rides alongside.

import Link from "next/link";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { headStat } from "@/components/shared/headStat";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { simAlertsToday } from "@/lib/command/data";
import { SIM_PLAN } from "@/lib/pipeline/data";
import { useSimRun } from "@/lib/pipeline/sim";
import { Dot, SimControls } from "@/components/pipeline/atoms";
import { Panel as PanelShell } from "@/components/shared/Panel";
import { AlertFeed, EmailIntel } from "@/components/command/views";

export default function MonitorPage() {
  return (
    <RequireAuth>
      <Monitor />
    </RequireAuth>
  );
}

function Monitor() {
  const run = useSimRun({ autoplay: true, plan: SIM_PLAN });
  const live = run.playing && !run.sim.done;
  const tick = run.sim.tick;
  const alertsToday = simAlertsToday(tick, live || run.sim.done);

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
        <span className="tabular text-caos-md text-caos-accent whitespace-nowrap">CP-MON</span>
        <span className="text-caos-xl text-caos-text font-medium whitespace-nowrap">Monitor — email intelligence &amp; alert routing</span>
        {/* Honesty marker: this whole surface is a seeded simulation, not a live
            feed — same convention as Command's "Sample portfolio — not live". */}
        <span className="tabular text-caos-2xs uppercase tracking-wide text-caos-muted whitespace-nowrap border border-caos-border rounded px-1.5 py-0.5">
          Illustrative sample — not live
        </span>
        <div className="flex-1" />
        {headStat("Msgs today", "105")}
        {headStat("Unresolved", "4", "var(--caos-warning)")}
        <div className="h-4 w-px bg-caos-border" />
        {headStat("Critical", "2", "var(--caos-critical)", true)}
        {headStat("Alerts today", String(alertsToday), "var(--caos-accent)", true)}
        <SimControls run={run} />
        <span className="tabular text-caos-md text-caos-muted whitespace-nowrap hidden 2xl:inline">{run.clock} ET</span>
      </div>

      {/* workspace — intake stream is primary; alert routing rides alongside */}
      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_400px] gap-2 p-2">
        <PanelShell
          title="Email Intelligence · CP-MON intake"
          className="min-h-0"
          right={
            <span className="flex items-center gap-1.5">
              <Dot sev="running" pulse={live} />
              {/* "SIM" not "LIVE": the tick is a demo simulation, not a real feed. */}
              <span className="tabular text-caos-xs text-caos-muted">{live ? "SIM" : "PAUSED"} · 105 msgs today</span>
            </span>
          }
        >
          <EmailIntel tick={tick} live={live || run.sim.done} />
        </PanelShell>
        <PanelShell
          title="Alert Routing · CP-MON-H"
          className="min-h-0"
          right={<span className="tabular text-caos-xs text-caos-muted">{alertsToday} routed</span>}
        >
          <div className="h-full overflow-auto">
            <AlertFeed tick={tick} live={live || run.sim.done} />
          </div>
        </PanelShell>
      </div>
    </div>
  );
}
