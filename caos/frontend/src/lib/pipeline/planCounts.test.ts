// Locks the one module-count rule: idle bookkeeping steps (the CP-DB commit)
// are excluded from BOTH total and completed, so the worklist "N/M modules"
// and the inspector "M modules in scope" can never disagree again.
import { describe, expect, it } from "vitest";
import { planCounts } from "./sim";
import { SIM_PLAN } from "./data";
import type { Sim } from "./sim-engine";

describe("planCounts", () => {
  it("excludes idle steps from the total (SIM_PLAN: 25 steps, 24 graded)", () => {
    expect(SIM_PLAN.length).toBe(25);
    expect(planCounts(SIM_PLAN).total).toBe(24);
  });

  it("counts completed over graded steps only, with the pass/warning/held rule", () => {
    const mods = Object.fromEntries(
      SIM_PLAN.map((step) => [step.id, { state: step.outcome === "idle" ? "pass" : "running", prog: 1 }]),
    ) as Sim["mods"];
    // The idle step "passing" must not count; nothing graded has finished.
    expect(planCounts(SIM_PLAN, mods).completed).toBe(0);

    const done = Object.fromEntries(
      SIM_PLAN.map((step) => [step.id, { state: "pass", prog: 1 }]),
    ) as Sim["mods"];
    expect(planCounts(SIM_PLAN, done)).toEqual({ total: 24, completed: 24 });
  });
});
