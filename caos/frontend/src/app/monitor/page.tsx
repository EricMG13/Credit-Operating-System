"use client";

// Concept F — The Monitor: CP-MON email-intelligence intake with live alert
// routing, promoted out of the Command Center into its own standing surface.
// This is the "trading-desk alertness" pillar — a stream you watch, distinct in
// cadence from the posture/coverage snapshots in Command. Email Intelligence
// (CP-MON) is the primary column; Alert Routing (CP-MON-H) rides alongside.

import { useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { headStat } from "@/components/shared/headStat";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { simAlertsToday, EMAIL_TILES, EMAIL_TOTAL, CRITICAL_ALERTS } from "@/lib/command/data";
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
  const [criticalOnly, setCriticalOnly] = useState(false);
  // "SIM" while running, "COMPLETE" at end, "PAUSED" only before/at a pause —
  // the old build read "PAUSED" at completion, so the run ended by lying.
  const simState = running ? "SIM" : done ? "COMPLETE" : "PAUSED";

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* Sub-header. flex-wrap + min-h-10 (not a fixed h-10): the metrics/controls
          cluster drops to a second line rather than clipping under overflow-hidden
          when the viewport can't hold the full desk strip (< ~1700px on the old
          single-row build hid the pause controls and the critical count). */}
      <div className="shrink-0 border-b border-caos-border bg-caos-panel/60 flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-1.5 min-h-10">
        {/* identity cluster — the long title truncates before the row wraps */}
        <div className="flex items-center gap-5 min-w-0 shrink">
          <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-caos-xl transition-caos whitespace-nowrap shrink-0">
            ← Directory
          </Link>
          <div className="h-4 w-px bg-caos-border shrink-0" />
          <ConceptNav compact />
          <div className="h-4 w-px bg-caos-border shrink-0" />
          <span className="tabular text-caos-md text-caos-accent whitespace-nowrap shrink-0">CP-MON</span>
          <span className="text-caos-xl text-caos-text font-medium truncate min-w-0">Monitor — email intelligence &amp; alert routing</span>
          {/* Honesty marker: this whole surface is a seeded simulation, not a live
              feed — same convention as Command's "Sample portfolio — not live". */}
          <span className="tabular text-caos-2xs uppercase tracking-wide text-caos-muted whitespace-nowrap border border-caos-border rounded px-1.5 py-0.5 shrink-0">
            Illustrative sample — not live
          </span>
        </div>
        <div className="flex-1 min-w-[1rem]" />
        {/* metrics + controls — wraps as a unit; may wrap internally when tight.
            All figures derive from single data sources (EMAIL_TOTAL / EMAIL_TILES
            / CRITICAL_ALERTS) so they can't contradict the tiles below. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 shrink-0">
          {headStat("Msgs today", String(EMAIL_TOTAL))}
          {headStat("Unresolved", String(EMAIL_TILES.unresolved), "var(--caos-warning)")}
          <div className="h-4 w-px bg-caos-border" />
          {/* The red number is an affordance: toggles the rail to criticals only. */}
          <button
            type="button"
            onClick={() => setCriticalOnly((v) => !v)}
            aria-pressed={criticalOnly}
            title={criticalOnly ? "Show all routed alerts" : "Filter alert rail to critical"}
            className={
              "rounded border px-1.5 py-0.5 -my-0.5 transition-caos focus-ring hover:bg-caos-elevated/70 " +
              (criticalOnly ? "caos-selected bg-caos-elevated border-caos-critical/60" : "border-transparent")
            }
          >
            {headStat("Critical alerts", String(CRITICAL_ALERTS), "var(--caos-critical)", true)}
          </button>
          {headStat("Alerts today", String(alertsToday), "var(--caos-accent)", true)}
          <SimControls run={run} />
          <span className="tabular text-caos-md text-caos-muted whitespace-nowrap hidden 2xl:inline">{run.clock} ET</span>
        </div>
      </div>

      {/* workspace — intake stream is primary; alert routing rides alongside */}
      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_400px] gap-2 p-2">
        <PanelShell
          title="Email Intelligence · CP-MON intake"
          className="min-h-0"
          right={
            <span className="flex items-center gap-2">
              {/* The intake tape is the day's FIXED end-of-day classification —
                  it shows the whole day from tick 0, unlike the Alert Routing
                  rail which replays against the sim clock. Declaring "EOD tape"
                  here means the differing cadence is stated, not discovered by a
                  PM comparing the two panels mid-replay (visibility of system
                  status). */}
              <span
                className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted"
                title="End-of-day classification — the full reconciled tape, shown in whole from the start (the Alert Routing rail replays live against the sim clock)"
              >
                EOD tape
              </span>
              <span className="h-3 w-px bg-caos-border" />
              <span className="flex items-center gap-1.5">
                <Dot sev={done ? "ok" : "running"} pulse={running} glyph={done} />
                {/* "SIM"/"COMPLETE"/"PAUSED": the tick is a demo replay, not a real
                    feed. (Msgs-today lives in the sub-header — not duplicated here.) */}
                <span className="tabular text-caos-xs text-caos-muted">{simState}</span>
              </span>
            </span>
          }
        >
          <EmailIntel />
        </PanelShell>
        <PanelShell
          title="Alert Routing · CP-MON-H"
          className="min-h-0"
          right={
            <span className="tabular text-caos-xs text-caos-muted">
              {criticalOnly ? `critical only · ${alertsToday} routed` : `${alertsToday} routed${done ? " · complete" : ""}`}
            </span>
          }
        >
          <AlertFeed tick={tick} running={running} done={done} sevFilter={criticalOnly ? "critical" : null} />
        </PanelShell>
      </div>
    </div>
  );
}
