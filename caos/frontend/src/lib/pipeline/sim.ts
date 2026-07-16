"use client";

// React binding for the live-run simulation engine (sim-engine.ts). Steps the
// pure engine on a timer and exposes play/speed/reset controls plus the derived
// completed/total counts to the Pipeline Visualizer.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SIM_PLAN, type PlanStep } from "./data";
import { type Sim, initSim, simClock, stepSim } from "./sim-engine";

// The one module-count rule for a route plan. Terminal bookkeeping steps
// (outcome "idle", e.g. the CP-DB commit) never reach a graded outcome, so
// they are excluded from BOTH the total and the in-scope figure — previously
// the worklist filtered them ("24/24 modules") while the inspector counted
// the raw plan ("25 modules in scope"), and the two contradicted on screen.
export function planCounts(plan: PlanStep[], mods?: Sim["mods"]) {
  const graded = plan.filter((m) => m.outcome !== "idle");
  return {
    total: graded.length,
    completed: mods
      ? graded.filter((m) => ["pass", "warning", "held"].includes(mods[m.id]?.state)).length
      : 0,
  };
}

export interface SimRun {
  sim: Sim;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  speed: number;
  setSpeed: (s: number) => void;
  reset: () => void;
  clock: string;
  completed: number;
  total: number;
}

export function useSimRun({
  tickMs = 650,
  autoplay = true,
  prefill = false,
  plan,
  complete = null,
}: {
  tickMs?: number;
  autoplay?: boolean;
  prefill?: boolean;
  plan: PlanStep[];
  complete?: { sev: string; text: string } | null;
}): SimRun {
  const makeInit = useCallback(() => {
    let s = initSim(plan);
    if (prefill) { let guard = 0; while (!s.done && guard++ < 500) s = stepSim(s, plan, complete); }
    return s;
  }, [plan, prefill, complete]);

  const [sim, setSim] = useState<Sim>(makeInit);
  const [playing, setPlaying] = useState(autoplay && !prefill);
  const [speed, setSpeed] = useState(1);
  const planRef = useRef(plan);

  useEffect(() => {
    if (planRef.current === plan) return;
    planRef.current = plan;
    setSim(makeInit());
    setPlaying(autoplay && !prefill);
  }, [plan, autoplay, prefill, makeInit]);

  useEffect(() => {
    if (!playing || sim.done) return;
    const id = setInterval(() => setSim((s) => stepSim(s, plan, complete)), tickMs / speed);
    return () => clearInterval(id);
  }, [playing, speed, sim.done, plan, complete, tickMs]);

  const reset = useCallback(() => { setSim(initSim(plan)); setPlaying(true); }, [plan]);
  const counts = planCounts(plan, sim.mods);
  return {
    sim, playing, setPlaying, speed, setSpeed, reset,
    clock: simClock(sim.tick), completed: counts.completed,
    total: counts.total,
  };
}

// Command, Monitor, and Sector RV all replay the SAME SIM_PLAN as "today" —
// each previously called useSimRun independently, so "alerts today" and the
// clock disagreed depending on which page had been mounted longer (critique
// P1: PM-facing numbers must agree). This module-level singleton (same
// pattern as the scroll-lock counter in use-modal-a11y.ts) is the one ongoing
// clock all three subscribe to via useSyncExternalStore, so navigating
// between them shows the same tick everywhere. Pipeline (per-scenario plans)
// and Deep-Dive (prefill/instant-complete) are a different use case and keep
// their own independent useSimRun instance.
interface SharedDayState { sim: Sim; playing: boolean; speed: number }
let sharedState: SharedDayState = { sim: initSim(SIM_PLAN), playing: true, speed: 1 };
let sharedIntervalId: ReturnType<typeof setInterval> | null = null;
const sharedListeners = new Set<() => void>();
const notifySharedDay = () => sharedListeners.forEach((l) => l());

function stopSharedDayInterval() {
  if (sharedIntervalId !== null) {
    clearInterval(sharedIntervalId);
    sharedIntervalId = null;
  }
}
function startSharedDayInterval() {
  if (sharedIntervalId !== null || sharedListeners.size === 0 || !sharedState.playing || sharedState.sim.done) return;
  sharedIntervalId = setInterval(() => {
    sharedState = { ...sharedState, sim: stepSim(sharedState.sim, SIM_PLAN, null) };
    notifySharedDay();
    if (sharedState.sim.done) stopSharedDayInterval();
  }, 650 / sharedState.speed);
}
// Started lazily by the first subscriber (below), not at module load: an
// unconditional top-level start here has no owner to stop it when a consumer
// never mounts, and under per-test-file module isolation every file that
// imports this module — even indirectly — spawns another orphaned interval
// in the same worker process, none of them ever cleared (each closes over
// its own now-unreachable module instance), which compounds across a test
// run until the process OOMs.

export function useSharedDayRun(): SimRun {
  const subscribe = useCallback((cb: () => void) => {
    sharedListeners.add(cb);
    startSharedDayInterval();
    return () => {
      sharedListeners.delete(cb);
      if (sharedListeners.size === 0) stopSharedDayInterval();
    };
  }, []);
  const getSnapshot = useCallback(() => sharedState, []);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setPlaying = useCallback((p: boolean) => {
    sharedState = { ...sharedState, playing: p };
    stopSharedDayInterval();
    if (p) startSharedDayInterval();
    notifySharedDay();
  }, []);
  const setSpeed = useCallback((s: number) => {
    sharedState = { ...sharedState, speed: s };
    stopSharedDayInterval();
    startSharedDayInterval();
    notifySharedDay();
  }, []);
  const reset = useCallback(() => {
    stopSharedDayInterval();
    sharedState = { sim: initSim(SIM_PLAN), playing: true, speed: sharedState.speed };
    startSharedDayInterval();
    notifySharedDay();
  }, []);

  const { sim, playing, speed } = state;
  const counts = planCounts(SIM_PLAN, sim.mods);
  return {
    sim, playing, setPlaying, speed, setSpeed, reset,
    clock: simClock(sim.tick), completed: counts.completed,
    total: counts.total,
  };
}
