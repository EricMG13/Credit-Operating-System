import { describe, expect, it } from "vitest";
import { initSim, simClock, stepSim } from "./sim-engine";
import type { PlanStep } from "./data";

const step = (id: string, deps: string[], dur = 1, outcome: PlanStep["outcome"] = "pass", event = ""): PlanStep =>
  ({ id, deps, dur, outcome, event });

describe("simClock", () => {
  it("formats the tick offset from 09:30:00 as HH:MM:SS (7 sim-seconds/tick)", () => {
    expect(simClock(0)).toBe("09:30:00");
    expect(simClock(1)).toBe("09:30:07");
    expect(simClock(60)).toBe("09:37:00");
  });
});

describe("initSim", () => {
  it("starts every module idle at prog 0, tick 0, not done", () => {
    const s = initSim([step("A", []), step("B", ["A"])]);
    expect(s.tick).toBe(0);
    expect(s.done).toBe(false);
    expect(s.events).toEqual([]);
    expect(s.mods).toEqual({ A: { state: "idle", prog: 0 }, B: { state: "idle", prog: 0 } });
  });
});

describe("stepSim — the scheduler", () => {
  it("starts a dep-free module, increments the tick, and logs a start event", () => {
    const plan = [step("A", [], 5)];
    const s = stepSim(initSim(plan), plan, null);
    expect(s.tick).toBe(1);
    expect(s.mods.A.state).toBe("running");
    expect(s.events.some((e) => e.text.includes("A started"))).toBe(true);
  });

  it("holds a module whose deps have not cleared", () => {
    const plan = [step("A", [], 5), step("B", ["A"], 5)];
    const s = stepSim(initSim(plan), plan, null);
    expect(s.mods.A.state).toBe("running");
    expect(s.mods.B.state).toBe("idle");
  });

  it("caps concurrency at 6 running modules per step", () => {
    const plan = Array.from({ length: 8 }, (_, i) => step("M" + i, [], 5));
    const s = stepSim(initSim(plan), plan, null);
    const running = Object.values(s.mods).filter((m) => m.state === "running").length;
    expect(running).toBe(6);
  });

  it("completes a dur-1 module to its outcome and emits its event (pass → sev ok)", () => {
    const plan = [step("A", [], 1, "warning", "A WARN")];
    let s = stepSim(initSim(plan), plan, null); // A → running
    s = stepSim(s, plan, null);                 // A → warning (done)
    expect(s.mods.A.state).toBe("warning");
    expect(s.events.some((e) => e.text === "A WARN" && e.sev === "warning")).toBe(true);
  });

  it("releases a downstream module only after its dep clears (isCleared gating)", () => {
    const plan = [step("A", [], 1, "pass", "A done"), step("B", ["A"], 1, "pass", "B done")];
    let s = stepSim(initSim(plan), plan, null); // tick1: A running, B idle
    expect(s.mods.B.state).toBe("idle");
    s = stepSim(s, plan, null);                 // tick2: A passes, then B starts
    expect(s.mods.A.state).toBe("pass");
    expect(s.mods.B.state).toBe("running");
  });

  it("runs to completion and emits the complete event exactly once", () => {
    const plan = [step("A", [], 1, "pass", "A done")];
    let s = initSim(plan);
    let guard = 0;
    while (!s.done && guard++ < 50) s = stepSim(s, plan, { sev: "ok", text: "ALL DONE" });
    expect(s.done).toBe(true);
    expect(s.events.filter((e) => e.text === "ALL DONE").length).toBe(1);
  });

  it("treats idle-outcome modules as never-running and not blocking done", () => {
    const plan = [step("A", [], 1, "idle", "")];
    const s = stepSim(initSim(plan), plan, null);
    expect(s.mods.A.state).toBe("idle");
    expect(s.done).toBe(true);
  });
});
