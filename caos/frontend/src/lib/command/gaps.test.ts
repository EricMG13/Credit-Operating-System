import { describe, it, expect } from "vitest";
import { liveGaps } from "./gaps";
import type { PortfolioRowDTO } from "@/lib/api";

const row = (over: Partial<PortfolioRowDTO>): PortfolioRowDTO => ({
  issuer_id: "i1", name: "Atlas Forge", ticker: "ATLF", sector: "Industrials",
  run_id: "r1", qa_status: "Passed", committee_status: "Cleared",
  as_of: "2026-06-30T00:00:00+00:00", metrics: {}, rv_recommendation: null,
  rv_percentile: null, downside_fragility: null, gaps: [], ...over,
});

describe("liveGaps", () => {
  it("flattens per-issuer CP-0 gaps, sorts worst-first, stamps issuer + as-of date", () => {
    const items = liveGaps([
      row({ ticker: "AAA", gaps: [{ sev: "low", doc: "No hedging register vaulted." }] }),
      row({ ticker: "BBB", gaps: [
        { sev: "high", doc: "No credit agreement vaulted." },
        { sev: "medium", doc: "No audited financials vaulted." },
      ] }),
    ]);
    expect(items.map((g) => g.sev)).toEqual(["high", "medium", "low"]);
    expect(items[0].issuer).toBe("BBB");
    expect(items[0].doc).toBe("No credit agreement vaulted.");
    expect(items[0].requested).toBe("Jun 30");
    expect(items.every((g) => g.impact.includes("CP-0"))).toBe(true);
  });

  it("uses ticker then name; coerces an unknown severity to low; handles null as-of", () => {
    const [g] = liveGaps([
      row({ ticker: null, name: "No Ticker Co", as_of: null, gaps: [{ sev: "weird", doc: "x" }] }),
    ]);
    expect(g.issuer).toBe("No Ticker Co");
    expect(g.sev).toBe("low");
    expect(g.requested).toBe("—");
  });

  it("is empty when no rows carry gaps", () => {
    expect(liveGaps([])).toEqual([]);
    expect(liveGaps([row({ gaps: [] })])).toEqual([]);
  });
});
