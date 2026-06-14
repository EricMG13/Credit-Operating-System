import { describe, it, expect } from "vitest";
import {
  BASE_DRIVERS, SCENARIOS, project, metricValue, tornado, METRICS,
} from "./scenarios";

const scen = (k: "best" | "base" | "worst") => SCENARIOS.find((s) => s.key === k)!.drivers;

describe("project (cash-flow lens)", () => {
  it("projects three forecast years of finite credit metrics", () => {
    const p = project(BASE_DRIVERS);
    expect(p.years).toHaveLength(3);
    for (const arr of [p.revenue, p.adjEbitda, p.fcf, p.cash, p.netDebt, p.netLev, p.intCov]) {
      expect(arr).toHaveLength(3);
      expect(arr.every((x) => Number.isFinite(x))).toBe(true);
    }
  });

  it("deleverages in the base case (net leverage falls as FCF builds cash)", () => {
    const p = project(BASE_DRIVERS);
    expect(p.netLev[2]).toBeLessThan(p.netLev[0]);
    expect(p.cash[2]).toBeGreaterThan(p.cash[0]);
  });
});

describe("best / base / worst ordering", () => {
  it("orders exit net leverage best < base < worst", () => {
    const lev = (k: "best" | "base" | "worst") => metricValue(project(scen(k)), "netLevExit");
    expect(lev("best")).toBeLessThan(lev("base"));
    expect(lev("base")).toBeLessThan(lev("worst"));
  });

  it("orders cumulative FCF best > base > worst", () => {
    const fcf = (k: "best" | "base" | "worst") => metricValue(project(scen(k)), "cumFcf");
    expect(fcf("best")).toBeGreaterThan(fcf("base"));
    expect(fcf("base")).toBeGreaterThan(fcf("worst"));
  });
});

describe("tornado (adjustable sensitivity)", () => {
  it("returns one bar per driver, sorted widest-impact first", () => {
    const { base, bars } = tornado("netLevExit");
    expect(base).toBe(metricValue(project(BASE_DRIVERS), "netLevExit"));
    expect(bars).toHaveLength(4);
    for (let i = 0; i < bars.length - 1; i++) {
      const wi = Math.abs(bars[i].high - bars[i].low);
      const wj = Math.abs(bars[i + 1].high - bars[i + 1].low);
      expect(wi).toBeGreaterThanOrEqual(wj);
    }
  });

  it("has correct directionality: more revenue growth lowers leverage; a higher rate raises it", () => {
    const { bars } = tornado("netLevExit");
    const rev = bars.find((b) => b.driver === "revGrowth")!;
    const rate = bars.find((b) => b.driver === "rate")!;
    expect(rev.high).toBeLessThan(rev.low);   // +growth → lower net leverage
    expect(rate.high).toBeGreaterThan(rate.low); // +rate → higher net leverage
  });

  it("intensity widens the swing", () => {
    const narrow = tornado("netLevExit", 0.5).bars[0];
    const wide = tornado("netLevExit", 1.5).bars[0];
    expect(Math.abs(wide.high - wide.low)).toBeGreaterThan(Math.abs(narrow.high - narrow.low));
  });

  it("exposes the four selectable output metrics", () => {
    expect(METRICS.map((m) => m.key)).toEqual(["netLevExit", "cumFcf", "minCash", "intCovExit"]);
  });
});
