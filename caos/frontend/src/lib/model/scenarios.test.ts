import { describe, it, expect } from "vitest";
import { buildScenarios, metricValue, METRICS } from "./scenarios";
import { buildModel } from "@/lib/reports/model";
import { DEFAULT_CASE, type Assumptions } from "@/lib/reports/assumptions";

// The default lens derives from the seeded BASE forecast (offline fallback).
const lens = buildScenarios();

// An Assumptions with one base-case field patched (downside left at agent baseline).
const withBase = (patch: Partial<typeof DEFAULT_CASE>): Assumptions => ({
  base: { ...DEFAULT_CASE, ...patch },
  down: { ...DEFAULT_CASE },
});
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

describe("lens follows the BASE forecast assumptions", () => {
  it("defaults to the seeded BASE forecast", () => {
    expect(lens.base).toEqual(buildScenarios(buildModel(1)).base);
  });

  it("lifts base revGrowth when the growth assumption rises", () => {
    const up = buildScenarios(buildModel(1, {}, undefined, withBase({ gDrive: 0.05, gFluid: 0.05, gAfter: 0.05 })));
    expect(up.base.revGrowth).toBeGreaterThan(lens.base.revGrowth);
  });

  it("lifts base adjMargin by the margin-assumption delta", () => {
    const up = buildScenarios(buildModel(1, {}, undefined, withBase({ dAdjm: 0.02 })));
    expect(up.base.adjMargin).toBeCloseTo(lens.base.adjMargin + 0.02, 4);
  });

  it("shifts the tornado base when an assumption changes", () => {
    const up = buildScenarios(buildModel(1, {}, undefined, withBase({ dAdjm: 0.02 })));
    expect(up.tornado("netLevExit").base).not.toBeCloseTo(lens.tornado("netLevExit").base, 3);
  });

  it("rolls the projection forward from FY25 revenue at the base growth", () => {
    const m = buildModel(1);
    const l = buildScenarios(m);
    const p = l.project(l.base);
    expect(p.revenue[0]).toBeCloseTo(m.cols.f25.rev * (1 + l.base.revGrowth), 6);
  });

  it("wires downside-case assumptions into the worst scenario only", () => {
    const exit = (l: ReturnType<typeof buildScenarios>, k: "base" | "worst") =>
      metricValue(l.project(l.scenarios.find((s) => s.key === k)!.drivers), "netLevExit");
    // tighten the downside margin; base case untouched
    const m = buildModel(1, {}, undefined, {
      base: { ...DEFAULT_CASE },
      down: { ...DEFAULT_CASE, dAdjm: -0.03 },
    });
    const l = buildScenarios(m);
    expect(exit(l, "worst")).toBeGreaterThan(exit(lens, "worst")); // worse downside → higher worst leverage
    expect(exit(l, "base")).toBeCloseTo(exit(lens, "base"), 6);    // base unchanged
  });
});

describe("scenario builder adjust re-centers base & downside", () => {
  const model = buildModel(1);
  const exitLev = (l: ReturnType<typeof buildScenarios>, k: "best" | "base" | "worst") =>
    metricValue(l.project(l.scenarios.find((s) => s.key === k)!.drivers), "netLevExit");

  it("a downside scenario raises base AND worst exit leverage vs the assumption lens", () => {
    const stressed = buildScenarios(model, { adjMargin: -0.03, rate: 0.01 });
    expect(exitLev(stressed, "base")).toBeGreaterThan(exitLev(lens, "base"));
    expect(exitLev(stressed, "worst")).toBeGreaterThan(exitLev(lens, "worst"));
  });

  it("applies deltas on top of the assumption-derived base drivers", () => {
    const adjusted = buildScenarios(model, { revGrowth: -0.05, adjMargin: -0.02 });
    expect(adjusted.base.revGrowth).toBeCloseTo(lens.base.revGrowth - 0.05, 6);
    expect(adjusted.base.adjMargin).toBeCloseTo(lens.base.adjMargin - 0.02, 6);
  });

  it("reset (no adjust) equals the assumption forecast", () => {
    expect(buildScenarios(model, undefined).base).toEqual(buildScenarios(model).base);
  });
});
