"use client";

import { useState } from "react";
import { headStat } from "@/components/shared/headStat";
import { AlertFeed } from "@/components/command/MonitorStreams";
import { Dot, SimControls } from "@/components/pipeline/atoms";
import { CRITICAL_ALERTS, simAlertsToday } from "@/lib/command/monitor-data";
import { useSharedDayRun } from "@/lib/pipeline/sim";

export function ReferenceMonitorReplay({
  criticalOnly,
  onCriticalChange,
}: {
  criticalOnly: boolean;
  onCriticalChange: (criticalOnly: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const run = useSharedDayRun();
  const running = run.playing && !run.sim.done;
  const done = run.sim.done;
  const alertsToday = simAlertsToday(run.sim.tick, !done);
  const filterTitle = (criticalOnly ? "Show all routed alerts. " : "Filter the replay tape to critical. ") + "Seeded Reference replay count — not live routed alerts.";
  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-caos-border px-3 py-2">
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="flex items-center gap-2 tabular text-caos-2xs uppercase tracking-widest text-caos-muted hover:text-caos-text transition-caos focus-ring caos-target">
          {expanded ? "− " : "+ "}Seeded replay · CP-MON-H demo tape
        </button>
        <span className="ml-auto flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => onCriticalChange(!criticalOnly)} aria-pressed={criticalOnly} title={filterTitle} className={`rounded border px-1.5 py-0.5 transition-caos focus-ring hover:bg-caos-elevated/70 ${criticalOnly ? "caos-selected bg-caos-elevated border-caos-critical/60" : "border-transparent"}`}>
            {headStat("Replay criticals", String(CRITICAL_ALERTS), "var(--caos-critical)", true)}
          </button>
          <span title="Seeded Reference replay count for the simulated day.">{headStat("Replay today", String(alertsToday), "var(--caos-accent)", true)}</span>
          <SimControls run={run} />
        </span>
      </div>
      {expanded ? <div className="flex-1 min-h-0"><AlertFeed tick={run.sim.tick} running={running} done={done} sevFilter={criticalOnly ? "critical" : null} /></div> : null}
      <div className="border-t border-caos-border px-3 py-2 flex items-center gap-1.5">
        <Dot sev={done ? "ok" : "running"} pulse={running} glyph={done} />
        <span className="tabular text-caos-xs text-caos-muted">{running ? "SIM" : done ? "COMPLETE" : "PAUSED"} · seeded Reference replay, not a live alert route.</span>
      </div>
    </div>
  );
}
