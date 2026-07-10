import { describe, it, expect } from "vitest";
import { trimmedMeanBps, PORTFOLIO_AVG_DM } from "./stats";

describe("trimmedMeanBps (robust header DM)", () => {
  it("ignores Tukey outliers so junk marks don't poison the average", () => {
    // clean ~300 cluster + two absurd ticks; a plain mean would be wrecked
    const m = trimmedMeanBps([280, 290, 300, 310, 320, -24970, 27085])!;
    expect(m).toBeGreaterThan(280);
    expect(m).toBeLessThan(320); // outliers excluded → ~300, not the raw mean
  });

  it("guards empty / all-non-finite input (degrades, never divides an empty set)", () => {
    expect(trimmedMeanBps([])).toBeNull();
    expect(trimmedMeanBps([NaN, Infinity, -Infinity])).toBeNull();
  });

  it("the real portfolio average is a sane positive HY DM, not the poisoned raw mean (−262)", () => {
    expect(PORTFOLIO_AVG_DM).not.toBeNull();
    expect(PORTFOLIO_AVG_DM!).toBeGreaterThan(150);
    expect(PORTFOLIO_AVG_DM!).toBeLessThan(700);
  });
});
