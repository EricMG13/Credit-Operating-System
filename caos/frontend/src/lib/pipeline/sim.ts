"use client";

// React binding for the live-run simulation engine (sim-engine.ts). Steps the
// pure engine on a timer and exposes play/speed/reset controls plus the derived
// completed/total counts to the Pipeline Visualizer.

import { useCallback, useEffect, useRef, useState } from "react";
import { type PlanStep } from "./data";
import { type Sim, initSim, simClock, stepSim } from "./sim-engine";

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
  const completed = plan.filter((m) => ["pass", "warning", "held"].includes(sim.mods[m.id]?.state)).length;
  return {
    sim, playing, setPlaying, speed, setSpeed, reset,
    clock: simClock(sim.tick), completed,
    total: plan.filter((m) => m.outcome !== "idle").length,
  };
}
