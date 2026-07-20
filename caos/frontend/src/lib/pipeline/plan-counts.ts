import type { PlanStep } from "./data";
import type { Sim } from "./sim-engine";

export function planCounts(plan: readonly PlanStep[], mods?: Sim["mods"]) {
  const graded = plan.filter((module) => module.outcome !== "idle");
  return {
    total: graded.length,
    completed: mods
      ? graded.filter((module) => ["pass", "warning", "held"].includes(mods[module.id]?.state)).length
      : 0,
  };
}
