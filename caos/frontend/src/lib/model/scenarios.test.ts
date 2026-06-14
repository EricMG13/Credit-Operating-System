import { describe, it, expect } from "vitest";
import { buildScenarios, metricValue, METRICS } from "./scenarios";
import { buildModel } from "@/lib/reports/model";
import type { ModelAnchor } from "@/lib/engine/modelAnchor";

// The default lens anchors on the seeded build's PF column (offline fallback).
const lens = buildScenarios();
const scen = (k: "best" | "base" | "worst") => lens.scenarios.find((s) => s.key === k)!.drivers;

describe("project (cash-flow lens)", () => {
  it("projects three forecast years of finite credit metrics", () => {
    const p = lens.project(lens.base);
    expect(p.years).toHaveLength(3);
    for (const arr of [p.revenue, p.adjEbitda, p.fcf, p.cash, p.netDebt, p.netLev, p.intCov]) {
      expect(arr).toHaveLength(3);
      expect(arr.every((x) => Number.isFinite(x))).toBe(true);
    }
  });

  it("deleverages in the base case (net leverage falls as FCF builds cash)", () => {
    const p = lens.project(lens.base);
    expect(p.netLev[2]).toBeLessThan(p.netLev[0]);
    expect(p.cash[2]).toBeGreaterThan(p.cash[0]);
  });
});

describe("best / base / worst ordering", () => {
  it("orders exit net leverage best < base < worst", () => {
    const lev = (k: "best" | "base" | "worst") => metricValue(lens.project(scen(k)), "netLevExit");
    expect(lev("best")).toBeLessThan(lev("base"));
    expect(lev("base")).toBeLessThan(lev("worst"));
  });

  it("orders cumulative FCF best > base > worst", () => {
    const fcf = (k: "best" | "base" | "worst") => metricValue(lens.project(scen(k)), "cumFcf");
    expect(fcf("best")).toBeGreaterThan(fcf("base"));
    expect(fcf("base")).toBeGreaterThan(fcf("worst"));
  });
});

describe("tornado (adjustable sensitivity)", () => {
  it("returns one bar per driver, sorted widest-impact first", () => {
    const { base, bars } = lens.tornado("netLevExit");
    expect(base).toBe(metricValue(lens.project(lens.base), "netLevExit"));
    expect(bars).toHaveLength(4);
    for (let i = 0; i < bars.length - 1; i++) {
      const wi = Math.abs(bars[i].high - bars[i].low);
      const wj = Math.abs(bars[i + 1].high - bars[i + 1].low);
      expect(wi).toBeGreaterThanOrEqual(wj);
    }
  });

  it("has correct directionality: more revenue growth lowers leverage; a higher rate raises it", () => {
    const { bars } = lens.tornado("netLevExit");
    const rev = bars.find((b) => b.driver === "revGrowth")!;
    const rate = bars.find((b) => b.driver === "rate")!;
    expect(rev.high).toBeLessThan(rev.low);   // +growth → lower net leverage
    expect(rate.high).toBeGreaterThan(rate.low); // +rate → higher net leverage
  });

  it("intensity widens the swing", () => {
    const narrow = lens.tornado("netLevExit", 0.5).bars[0];
    const wide = lens.tornado("netLevExit", 1.5).bars[0];
    expect(Math.abs(wide.high - wide.low)).toBeGreaterThan(Math.abs(narrow.high - narrow.low));
  });

  it("exposes the four selectable output metrics", () => {
    expect(METRICS.map((m) => m.key)).toEqual(["netLevExit", "cumFcf", "minCash", "intCovExit"]);
  });
});

describe("live CP-1 anchor re-bases the lens", () => {
  // A live anchor deliberately offset from the seeded build, so the test proves
  // the lens re-bases on the PF column (rather than coinciding by construction).
  const ANCHOR: ModelAnchor = {
    ltmRevenue: 2850,
    ltmAdjEbitda: 450,
    netDebt: 2500,
    netLeverage: 5.9,
    intCov: 2.0,
  };

  it("defaults to the same PF column as the seeded build", () => {
    const seeded = buildScenarios(buildModel(1).cols.pf);
    expect(lens.base).toEqual(seeded.base);
  });

  it("derives base drivers from the anchored PF, not the seeded one", () => {
    const pf = buildModel(1, {}, ANCHOR).cols.pf;
    const live = buildScenarios(pf);
    // adj margin re-bases onto the live LTM (450 / 2850), diverging from seeded.
    expect(live.base.adjMargin).toBeCloseTo(ANCHOR.ltmAdjEbitda / ANCHOR.ltmRevenue, 6);
    expect(live.base.adjMargin).not.toBeCloseTo(lens.base.adjMargin, 4);
  });

  it("rolls the projection forward from the live PF revenue", () => {
    const pf = buildModel(1, {}, ANCHOR).cols.pf;
    const live = buildScenarios(pf);
    const p = live.project(live.base);
    // Year 1 revenue = live PF revenue grown one year at the base growth rate.
    expect(p.revenue[0]).toBeCloseTo(ANCHOR.ltmRevenue * (1 + live.base.revGrowth), 6);
  });

  it("shifts the tornado base off the seeded value", () => {
    const pf = buildModel(1, {}, ANCHOR).cols.pf;
    const live = buildScenarios(pf);
    const liveBase = live.tornado("netLevExit").base;
    const seededBase = lens.tornado("netLevExit").base;
    expect(liveBase).not.toBeCloseTo(seededBase, 3);
  });
});

describe("scenario builder adjust re-centers base & downside", () => {
  const pf = buildModel(1).cols.pf;
  const exitLev = (l: ReturnType<typeof buildScenarios>, k: "best" | "base" | "worst") =>
    metricValue(l.project(l.scenarios.find((s) => s.key === k)!.drivers), "netLevExit");

  it("a downside scenario raises base AND worst exit leverage vs the module lens", () => {
    const stressed = buildScenarios(pf, { adjMargin: -0.03, rate: 0.01 });
    expect(exitLev(stressed, "base")).toBeGreaterThan(exitLev(lens, "base"));
    expect(exitLev(stressed, "worst")).toBeGreaterThan(exitLev(lens, "worst"));
  });

  it("applies deltas to the base drivers", () => {
    const adjusted = buildScenarios(pf, { revGrowth: -0.05, adjMargin: -0.02 });
    expect(adjusted.base.revGrowth).toBeCloseTo(lens.base.revGrowth - 0.05, 6);
    expect(adjusted.base.adjMargin).toBeCloseTo(lens.base.adjMargin - 0.02, 6);
  });

  it("reset (no adjust) equals the module forecasts", () => {
    expect(buildScenarios(pf, undefined).base).toEqual(buildScenarios(pf).base);
  });
});
