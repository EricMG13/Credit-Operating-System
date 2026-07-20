// Pure live-run simulation engine (port of design bundle shared/ui.jsx).
// Modules start when their deps clear (max 6 concurrent), progress per tick,
// and emit orchestrator events. No React — useSimRun (sim.ts) drives this on a
// timer. Kept separate so the scheduling logic is unit-testable and so type /
// clock consumers don't depend on the React hook.

import type { PlanStep } from "./data";
import { MODULES } from "./topology";
import { isCleared } from "./sev";

export type SimState = "idle" | "running" | "pass" | "warning" | "held" | "blocked";

export interface SimEvent {
  t: string;
  sev: string;
  text: string;
}

export interface Sim {
  mods: Record<string, { state: SimState; prog: number }>;
  events: SimEvent[];
  tick: number;
  done: boolean;
}

export function simClock(tick: number): string {
  const safeTick = Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : 0;
  const s = 9 * 3600 + 30 * 60 + safeTick * 7; // 7 sim-seconds per tick
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function initSim(plan: PlanStep[]): Sim {
  const mods: Sim["mods"] = {};
  plan.forEach((m) => { mods[m.id] = { state: "idle", prog: 0 }; });
  return { mods, events: [], tick: 0, done: false };
}

export function stepSim(sim: Sim, plan: PlanStep[], complete: { sev: string; text: string } | null): Sim {
  const mods = { ...sim.mods };
  const events = sim.events.slice();
  const tick = sim.tick + 1;
  const t = simClock(tick);
  const doneStates: SimState[] = ["pass", "warning", "held", "blocked"];
  const satisfied = (m: PlanStep) => m.deps.every((d) => isCleared(mods[d]?.state));
  let runningCount = Object.values(mods).filter((m) => m.state === "running").length;

  plan.forEach((m) => {
    const cur = mods[m.id];
    if (cur.state === "running") {
      const prog = cur.prog + 1 / m.dur;
      if (prog >= 1) {
        const out = m.outcome === "idle" ? "idle" : m.outcome;
        mods[m.id] = { state: out, prog: 1 };
        runningCount--;
        if (m.event) events.unshift({ t, sev: out === "pass" ? "ok" : out, text: m.event });
      } else {
        mods[m.id] = { state: "running", prog };
      }
    }
  });
  plan.forEach((m) => {
    const cur = mods[m.id];
    if (cur.state === "idle" && m.outcome !== "idle" && satisfied(m) && runningCount < 6) {
      mods[m.id] = { state: "running", prog: 0.04 };
      runningCount++;
      const meta = MODULES.find((x) => x.id === m.id);
      events.unshift({ t, sev: "running", text: `${m.id} started — ${meta ? meta.name : ""}` });
    }
  });
  const done = plan.every((m) => (m.outcome === "idle" ? true : doneStates.includes(mods[m.id].state)));
  if (done && !sim.done) {
    const c = complete || { sev: "warning", text: "RUN COMPLETE — clearance CONDITIONAL · committee pack HELD on QA-117 remediation" };
    events.unshift({ t, sev: c.sev, text: c.text });
  }
  return { mods, events: events.slice(0, 80), tick, done };
}
