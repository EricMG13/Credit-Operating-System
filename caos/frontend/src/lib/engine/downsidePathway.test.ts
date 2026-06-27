import { describe, it, expect } from "vitest";
import { cp2bToDownside } from "./downsidePathway";
import type { ModuleDetailDTO } from "./types";

const detail = (module_id: string, runtime_output: unknown) =>
  ({ module_id, runtime_output } as unknown as ModuleDetailDTO);

describe("cp2bToDownside", () => {
  it("parses a valid CP-2B payload", () => {
    const d = cp2bToDownside(detail("CP-2B", {
      current_net_leverage: 5.2, breach_threshold_x: 7.0, shock_to_breach_pct: 20,
      fragility: "MODERATE",
      scenarios: [
        { ebitda_shock_pct: 10, stressed_net_leverage: 5.78, stressed_interest_coverage: 2.7 },
        { ebitda_shock_pct: 20, stressed_net_leverage: 6.5, stressed_interest_coverage: 2.4 },
        { ebitda_shock_pct: 30, stressed_net_leverage: 7.43, stressed_interest_coverage: 2.1 },
      ],
    }));
    expect(d).not.toBeNull();
    expect(d!.fragility).toBe("MODERATE");
    expect(d!.shocks).toHaveLength(3);
    expect(d!.shocks[2].stressedNetLeverage).toBe(7.43);
    expect(d!.shockToBreachPct).toBe(20);
  });

  it("accepts a LOW pathway with null shock-to-breach and null coverage", () => {
    const d = cp2bToDownside(detail("CP-2B", {
      current_net_leverage: 3.1, breach_threshold_x: 7.0, shock_to_breach_pct: null,
      fragility: "LOW",
      scenarios: [{ ebitda_shock_pct: 10, stressed_net_leverage: 3.44, stressed_interest_coverage: null }],
    }));
    expect(d).not.toBeNull();
    expect(d!.shockToBreachPct).toBeNull();
    expect(d!.shocks[0].stressedCoverage).toBeNull();
  });

  it("returns null on wrong module, the degraded empty-scenarios payload, NaN core, and a bad band", () => {
    expect(cp2bToDownside(detail("CP-1", {}))).toBeNull();
    expect(cp2bToDownside(detail("CP-2B", undefined))).toBeNull();
    expect(cp2bToDownside(detail("CP-2B", { scenarios: [], note: "no leverage" }))).toBeNull();
    expect(cp2bToDownside(detail("CP-2B", {
      current_net_leverage: NaN, breach_threshold_x: 7, fragility: "LOW",
      scenarios: [{ ebitda_shock_pct: 10, stressed_net_leverage: 1 }],
    }))).toBeNull();
    expect(cp2bToDownside(detail("CP-2B", {
      current_net_leverage: 5, breach_threshold_x: 7, fragility: "BOGUS",
      scenarios: [{ ebitda_shock_pct: 10, stressed_net_leverage: 1 }],
    }))).toBeNull();
  });

  it("skips malformed scenario rows but keeps usable ones", () => {
    const d = cp2bToDownside(detail("CP-2B", {
      current_net_leverage: 5, breach_threshold_x: 7, shock_to_breach_pct: 30, fragility: "MODERATE",
      scenarios: [
        null,
        { ebitda_shock_pct: 10 },                                   // missing leverage -> skip
        { ebitda_shock_pct: 20, stressed_net_leverage: 6.25, stressed_interest_coverage: 2.0 },
      ],
    }));
    expect(d).not.toBeNull();
    expect(d!.shocks).toHaveLength(1);
    expect(d!.shocks[0].shockPct).toBe(20);
  });
});
