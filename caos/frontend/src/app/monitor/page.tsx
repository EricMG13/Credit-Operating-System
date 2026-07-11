"use client";

// Concept F — The Monitor: CP-MON email-intelligence intake with live alert
// routing, promoted out of the Command Center into its own standing surface.
// This is the "trading-desk alertness" pillar — a stream you watch, distinct in
// cadence from the posture/coverage snapshots in Command. Email Intelligence
// (CP-MON) is the primary column; Alert Routing (CP-MON-H) rides alongside.

import { useState } from "react";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { headStat } from "@/components/shared/headStat";
import { ResponsiveShell } from "@/components/shared/ResponsiveShell";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { simAlertsToday, CRITICAL_ALERTS } from "@/lib/command/data";
import { useSharedDayRun } from "@/lib/pipeline/sim";
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
  const [criticalOnly, setCriticalOnly] = useState(false);
  // "SIM" while running, "COMPLETE" at end, "PAUSED" only before/at a pause —
  // the old build read "PAUSED" at completion, so the run ended by lying.
  const simState = running ? "SIM" : done ? "COMPLETE" : "PAUSED";

  // The red number is an affordance: toggles the rail to criticals only.
  // Rendered once — inline in the full contextual set at ≥1024px, or as a
  // narrow essential below that — so the toggle is reachable at every width
  // (the old hand-rolled wrap header existed to keep it and pause visible
  // under ~1700px; the shared shell's MoreDrawer collapse now covers that).
  const criticalFilterButton = (
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
  );

  return (
    <ResponsiveShell
      identity={
        <ShellIdentity
          tag="CP-MON"
          badges={
            /* Honesty marker: this whole surface is a seeded simulation, not a
               live feed — same convention as Command's "Sample portfolio — not
               live". `badges` renders before the title so the title truncates
               first and this chip never clips. */
            <span
              className="tabular text-caos-2xs uppercase tracking-wide text-caos-muted whitespace-nowrap border border-caos-border rounded px-1.5 py-0.5 shrink-0"
              title="Illustrative sample — this whole surface replays a seeded simulation, not a live feed"
            >
              Sample — not live
            </span>
          }
          title="Monitor — email intelligence & alert routing"
        />
      }
      contextualControls={
        <>
          {/* Msgs-today and Unresolved are NOT repeated here — the EmailIntel
              tiles directly below carry both ("Showing N of M today", the
              UNRESOLVED tile), and the freed width keeps the identity row's
              honesty chip un-clipped at 1440px. */}
          {criticalFilterButton}
          {headStat("Alerts today", String(alertsToday), "var(--caos-accent)", true)}
          <SimControls run={run} />
          <span className="tabular text-caos-md text-caos-muted whitespace-nowrap hidden 2xl:inline">{run.clock} ET</span>
        </>
      }
      narrowContract={{
        essentialControls: (
          <>
            {criticalFilterButton}
            <SimControls run={run} />
          </>
        ),
      }}
    >
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
    </ResponsiveShell>
  );
}
