// Concept D — forward Scenario & Sensitivity lens for the cash-flow model.
//
// A simplified credit cash-flow projection that stays true to the Model Builder:
// revenue → adj EBITDA → free cash flow → cash build / deleveraging → net
// leverage. Anchored to the model's own pro-forma (PF) figures so it ties out
// to the grid. Adds best/base/worst scenarios and an adjustable 1-way tornado.
//
// Not a DCF/valuation — total debt is held static and FCF accumulates to cash
// (the deleveraging story), so the only outputs are credit metrics.

import { buildModel } from "@/lib/reports/model";

export interface Drivers {
  revGrowth: number; // annual revenue growth (e.g. 0.035)
  adjMargin: number; // adj EBITDA / revenue
  capexPct: number;  // capex / revenue
  rate: number;      // blended cash interest rate on total debt
}

// Anchor on the pro-forma LTM Mar-26 column (post SSN-'31 issue).
const PF = buildModel(1).cols.pf;
const ANCHOR = {
  rev0: PF.rev,
  totalDebt: PF.tdebt,
  cash0: PF.cash,
  daPct: 0.046, // D&A as % of revenue (model basis)
  leases: 10,
  taxRate: 0.25,
};

export const BASE_DRIVERS: Drivers = {
  revGrowth: 0.035,
  adjMargin: PF.adjm,
  capexPct: PF.capex / PF.rev,
  rate: PF.int / PF.tdebt,
};

export const FORECAST_YEARS = ["FY26e", "FY27e", "FY28e"];

export interface Projection {
  years: string[];
  revenue: number[];
  adjEbitda: number[];
  fcf: number[];      // pre-financing free cash flow, available to delever
  cash: number[];
  netDebt: number[];
  netLev: number[];   // net debt / adj EBITDA
  intCov: number[];   // adj EBITDA / interest
}

export function project(d: Drivers): Projection {
  const p: Projection = {
    years: FORECAST_YEARS, revenue: [], adjEbitda: [], fcf: [], cash: [], netDebt: [], netLev: [], intCov: [],
  };
  let rev = ANCHOR.rev0;
  let cash = ANCHOR.cash0;
  for (let t = 0; t < FORECAST_YEARS.length; t++) {
    rev = rev * (1 + d.revGrowth);
    const adj = rev * d.adjMargin;
    const da = rev * ANCHOR.daPct;
    const interest = ANCHOR.totalDebt * d.rate;
    const ebt = adj - da - interest;
    const tax = ebt > 0 ? ebt * ANCHOR.taxRate : 0;
    const capex = rev * d.capexPct;
    const fcf = adj - interest - ANCHOR.leases - tax - capex;
    cash += fcf;
    const netDebt = ANCHOR.totalDebt - cash;
    p.revenue.push(rev);
    p.adjEbitda.push(adj);
    p.fcf.push(fcf);
    p.cash.push(cash);
    p.netDebt.push(netDebt);
    p.netLev.push(netDebt / adj);
    p.intCov.push(adj / interest);
  }
  return p;
}

export type ScenKey = "best" | "base" | "worst";

export interface Scenario {
  key: ScenKey;
  label: string;
  color: string;
  drivers: Drivers;
}

export const SCENARIOS: Scenario[] = [
  {
    key: "best",
    label: "Best",
    color: "var(--caos-success)",
    drivers: {
      revGrowth: BASE_DRIVERS.revGrowth + 0.025,
      adjMargin: BASE_DRIVERS.adjMargin + 0.01,
      capexPct: Math.max(0.02, BASE_DRIVERS.capexPct - 0.003),
      rate: Math.max(0, BASE_DRIVERS.rate - 0.005),
    },
  },
  { key: "base", label: "Base", color: "var(--caos-accent)", drivers: { ...BASE_DRIVERS } },
  {
    key: "worst",
    label: "Worst",
    color: "var(--caos-critical)",
    drivers: {
      revGrowth: BASE_DRIVERS.revGrowth - 0.035,
      adjMargin: BASE_DRIVERS.adjMargin - 0.018,
      capexPct: BASE_DRIVERS.capexPct + 0.004,
      rate: BASE_DRIVERS.rate + 0.01,
    },
  },
];

export type MetricKey = "netLevExit" | "cumFcf" | "minCash" | "intCovExit";

export const METRICS: { key: MetricKey; label: string; unit: string; lowerIsBetter: boolean }[] = [
  { key: "netLevExit", label: "Net leverage · FY28e", unit: "x", lowerIsBetter: true },
  { key: "cumFcf", label: "Cumulative FCF · 3y", unit: "$M", lowerIsBetter: false },
  { key: "minCash", label: "Minimum cash · 3y", unit: "$M", lowerIsBetter: false },
  { key: "intCovExit", label: "Interest cover · FY28e", unit: "x", lowerIsBetter: false },
];

export function metricValue(p: Projection, m: MetricKey): number {
  switch (m) {
    case "netLevExit": return p.netLev[p.netLev.length - 1];
    case "cumFcf": return p.fcf.reduce((s, x) => s + x, 0);
    case "minCash": return Math.min(...p.cash);
    case "intCovExit": return p.intCov[p.intCov.length - 1];
  }
}

export interface TornadoBar {
  driver: keyof Drivers;
  label: string;
  low: number;  // metric with the driver swung down
  high: number; // metric with the driver swung up
}

// Per-driver ± swing at intensity 1 (absolute driver units).
const SWINGS: { key: keyof Drivers; label: string; swing: number }[] = [
  { key: "revGrowth", label: "Revenue growth", swing: 0.025 }, // ±2.5pp
  { key: "adjMargin", label: "EBITDA margin", swing: 0.015 },  // ±1.5pp
  { key: "rate", label: "Interest rate", swing: 0.01 },        // ±100bps
  { key: "capexPct", label: "Capex % rev", swing: 0.01 },      // ±1.0pp
];

/** 1-way sensitivity of `m` to each driver, swung ± its base swing × intensity,
 *  holding the others at base. Sorted widest-impact first (tornado order). */
export function tornado(m: MetricKey, intensity = 1): { base: number; bars: TornadoBar[] } {
  const base = metricValue(project(BASE_DRIVERS), m);
  const bars: TornadoBar[] = SWINGS.map(({ key, label, swing }) => {
    const lo: Drivers = { ...BASE_DRIVERS, [key]: BASE_DRIVERS[key] - swing * intensity };
    const hi: Drivers = { ...BASE_DRIVERS, [key]: BASE_DRIVERS[key] + swing * intensity };
    return { driver: key, label, low: metricValue(project(lo), m), high: metricValue(project(hi), m) };
  });
  bars.sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
  return { base, bars };
}
