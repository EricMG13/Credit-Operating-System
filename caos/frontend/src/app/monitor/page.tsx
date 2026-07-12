"use client";

// Concept F — The Monitor: CP-MON email-intelligence intake alongside the live
// Watchtower alert-routing rail, promoted out of the Command Center into its
// own standing surface. This is the "trading-desk alertness" pillar — a
// stream you watch, distinct in cadence from the posture/coverage snapshots
// in Command. Email Intelligence (CP-MON) is the primary column; the Alert
// Routing rail leads with real Watchtower/Sentinel output and demotes CP-MON-
// H's seeded showcase tape behind a disclosure — CP-MON-H (an email-derived
// alert router) has no live implementation yet (routes/sector.py: "CP-MON
// stay registry-pending"), so it is never the panel's own name once
// Watchtower output is what's actually leading it (G8 cleanup).

import { useState } from "react";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { headStat } from "@/components/shared/headStat";
import { ResponsiveShell } from "@/components/shared/ResponsiveShell";
import { useBreakpoint } from "@/lib/useBreakpoint";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { simAlertsToday, CRITICAL_ALERTS } from "@/lib/command/data";
import { useSharedDayRun } from "@/lib/pipeline/sim";
import { Dot, SimControls } from "@/components/pipeline/atoms";
import { Panel as PanelShell } from "@/components/shared/Panel";
import { AlertFeed, EmailIntel } from "@/components/command/views";
import { AlertInbox } from "@/components/monitor/AlertInbox";
import { PhoneTriage } from "@/components/monitor/PhoneTriage";
import { useAutonomyDraft } from "@/lib/engine/useAutonomyDraft";
import { draftToAlertRows, requiredActionFor } from "@/lib/alerts/inbox";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { GovernancePanel } from "@/components/command/GovernancePanel";
import { usePortfolio } from "@/lib/engine/usePortfolio";
import { useDigest } from "@/lib/engine/useDigest";
import { liveQaItems, liveFailedGates } from "@/lib/command/qa";
import { liveGaps } from "@/lib/command/gaps";
import { liveMixedOrigin } from "@/lib/command/mixedOrigin";

export default function MonitorPage() {
  return (
    <RequireAuth>
      <Monitor />
    </RequireAuth>
  );
}

function Monitor() {
  const { breakpoint } = useBreakpoint();
  const isPhone = breakpoint === "mobile";
  const { draft, offline: autonomyOffline } = useAutonomyDraft();
  const liveRows = draft ? draftToAlertRows(draft) : [];
  const hasLiveAlerts = !autonomyOffline && liveRows.length > 0;
  const topRow = liveRows[0];
  // Governance's shared queue (Command shows the identical categories from the
  // same live sources — QA queues visible from both, per the handoff).
  const portfolio = usePortfolio();
  const liveQa = portfolio.live ? liveQaItems(portfolio.rows) : undefined;
  const liveFailed = portfolio.live ? liveFailedGates(portfolio.rows) : undefined;
  const liveGapsItems = portfolio.live ? liveGaps(portfolio.rows) : undefined;
  const liveMixed = portfolio.live ? liveMixedOrigin(portfolio.rows) : undefined;
  const { digest, live: digestLive } = useDigest();
  // Default: demo disclosure open when there's nothing live to show, closed
  // once live rows exist. `null` = follow that default; a click overrides for
  // the session (same disclosure pattern as DecisionHeader).
  const [demoOverride, setDemoOverride] = useState<boolean | null>(null);
  const showDemo = demoOverride ?? !hasLiveAlerts;
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
            /* Honesty marker in the shared grammar: this whole surface replays
               a seeded simulation, not a live feed. `badges` renders before
               the title so the title truncates first and this never clips. */
            <ProvenanceChip
              prov={{
                origin: "DEMO",
                detail: "Illustrative sample — this whole surface replays a seeded simulation, not a live feed.",
              }}
            />
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
      {/* Decision header — cells populate from the live autonomy draft only;
          offline they state "— no data" rather than promoting the seeded
          replay into a decision strip (mock-vs-live seam, matches Command). */}
      <DecisionHeader
        whatChanged={hasLiveAlerts ? liveRows.slice(0, 3).map((r) => r.event).join(" · ") : undefined}
        whyItMatters={hasLiveAlerts && topRow ? `${topRow.reason} · severity ${topRow.severity}` : undefined}
        requiredAction={hasLiveAlerts && topRow ? requiredActionFor(topRow) : undefined}
        evidenceHealth={
          hasLiveAlerts
            ? {
                origin: "LIVE",
                method: "MODELLED",
                detail: `${liveRows.length} alert${liveRows.length === 1 ? "" : "s"} routed from the live autonomy draft`,
              }
            : undefined
        }
      />
      {/* workspace — intake stream is primary; alert routing rides alongside.
          Phone triage is a deliberately different, single-purpose layout
          (locked decision #4): reading, alerts, ack/assign/resolve, and
          desktop handoff ONLY — no email intake grid, no governance table,
          no modeling. Everything else keeps the tablet/desktop workspace. */}
      {isPhone ? (
        <PhoneTriage />
      ) : (
      <div className="flex-1 min-h-0 flex flex-col gap-2 p-2 overflow-auto">
      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_400px] gap-2">
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
          title="Alert Routing · Watchtower"
          className="min-h-0 overflow-y-auto"
          right={
            hasLiveAlerts ? (
              <span className="tabular text-caos-xs" style={{ color: "var(--caos-success)" }}>
                ● LIVE · {liveRows.length} routed
              </span>
            ) : (
              <span className="tabular text-caos-xs text-caos-muted">
                {criticalOnly ? `critical only · ${alertsToday} routed` : `${alertsToday} routed${done ? " · complete" : ""}`}
              </span>
            )
          }
        >
          {/* Watchtower live inbox leads when there's something to show; the
              seeded replay demotes behind a disclosure — never merged with
              live rows, never relabeled. */}
          <AlertInbox />
          <button
            type="button"
            onClick={() => setDemoOverride(!showDemo)}
            aria-expanded={showDemo}
            className="w-full flex items-center gap-2 px-3 min-h-8 tabular text-caos-2xs uppercase tracking-widest text-caos-muted hover:text-caos-text transition-caos focus-ring border-t border-caos-border/50 caos-target"
          >
            {showDemo ? "− " : "+ "}Demo replay · CP-MON-H seeded tape
          </button>
          {showDemo ? (
            <AlertFeed tick={tick} running={running} done={done} sevFilter={criticalOnly ? "critical" : null} />
          ) : null}
        </PanelShell>
      </div>
      {/* Shared governance queue — identical categories to Command's, off the
          same live portfolio/digest sources, so QA queues are visible from
          both surfaces (handoff persona resolution). mb-9 clears the floating
          Ask launcher, matching Command's panel. */}
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
      )}
    </ResponsiveShell>
  );
}
