// Concept D — forward Scenario & Sensitivity lens for the cash-flow model.
//
// A simplified credit cash-flow projection that stays true to the Model Builder:
// revenue → adj EBITDA → free cash flow → cash build / deleveraging → net
// leverage. Anchored to the model's own pro-forma (PF) figures so it ties out
// to the grid. Adds best/base/worst scenarios and an adjustable 1-way tornado.
//
// Not a DCF/valuation — total debt is held static and FCF accumulates to cash
// (the deleveraging story), so the only outputs are credit metrics.
//
// The lens is built from a passed-in PF column via `buildScenarios(pf)`, so it
// re-bases on whatever the grid is anchored to: pass the live-anchored model's
// `pf` and best/base/worst + the tornado follow the live CP-1 run; omit it (or
// pass the seeded build's pf) and the offline demo is unchanged.

import { buildModel, type ModelCol } from "@/lib/reports/model";

export interface Drivers {
  revGrowth: number; // annual revenue growth (e.g. 0.035)
  adjMargin: number; // adj EBITDA / revenue
  capexPct: number;  // capex / revenue
  rate: number;      // blended cash interest rate on total debt
}

// Anchor parts the PF column does not carry (model-basis assumptions).
const DA_PCT = 0.046;  // D&A as % of revenue (model basis)
const LEASES = 10;
const TAX_RATE = 0.25;

// The starting balances the projection rolls forward, pinned to the PF column.
interface Anchor {
  rev0: number;
  totalDebt: number;
  cash0: number;
  daPct: number;
  leases: number;
  taxRate: number;
}

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

export type ScenKey = "best" | "base" | "worst";

export interface Scenario {
  key: ScenKey;
  label: string;
  color: string;
  drivers: Drivers;
}

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
const SWINGS: { key: keyof Drivers; label: string; swing: number; unit: "pp" | "bps" }[] = [
  { key: "revGrowth", label: "Revenue growth", swing: 0.025, unit: "pp" }, // ±2.5pp
  { key: "adjMargin", label: "EBITDA margin", swing: 0.015, unit: "pp" },  // ±1.5pp
  { key: "rate", label: "Interest rate", swing: 0.01, unit: "bps" },       // ±100bps
  { key: "capexPct", label: "Capex % rev", swing: 0.01, unit: "pp" },      // ±1.0pp
];

/** Human label for a driver's ± swing at the given intensity, e.g. "±1.5pp" / "±100bps". */
export function swingLabel(key: keyof Drivers, intensity = 1): string {
  const s = SWINGS.find((x) => x.key === key)!;
  const mag = s.swing * intensity;
  return s.unit === "bps"
    ? "±" + Math.round(mag * 10000) + "bps"
    : "±" + parseFloat((mag * 100).toFixed(2)) + "pp";
}

/** A scenario lens bound to one PF anchor: base drivers, the best/base/worst set,
 *  and the projection/tornado closures that roll those drivers forward. */
export interface ScenarioLens {
  base: Drivers;
  scenarios: Scenario[];
  project: (d: Drivers) => Projection;
  tornado: (m: MetricKey, intensity?: number) => { base: number; bars: TornadoBar[] };
}

/** Build the forward scenario lens anchored on a model's pro-forma (PF) column.
 *  Pass the live-anchored model's `cols.pf` so best/base/worst + the tornado
 *  re-base on the live CP-1 run; omit it for the seeded offline demo. */
export function buildScenarios(pf: ModelCol = buildModel(1).cols.pf): ScenarioLens {
  const anchor: Anchor = {
    rev0: pf.rev,
    totalDebt: pf.tdebt,
    cash0: pf.cash,
    daPct: DA_PCT,
    leases: LEASES,
    taxRate: TAX_RATE,
  };

  const base: Drivers = {
    revGrowth: 0.035,
    adjMargin: pf.adjm,
    capexPct: pf.capex / pf.rev,
    rate: pf.int / pf.tdebt,
  };

  function project(d: Drivers): Projection {
    const p: Projection = {
      years: FORECAST_YEARS, revenue: [], adjEbitda: [], fcf: [], cash: [], netDebt: [], netLev: [], intCov: [],
    };
    let rev = anchor.rev0;
    let cash = anchor.cash0;
    for (let t = 0; t < FORECAST_YEARS.length; t++) {
      rev = rev * (1 + d.revGrowth);
      const adj = rev * d.adjMargin;
      const da = rev * anchor.daPct;
      const interest = anchor.totalDebt * d.rate;
      const ebt = adj - da - interest;
      const tax = ebt > 0 ? ebt * anchor.taxRate : 0;
      const capex = rev * d.capexPct;
      const fcf = adj - interest - anchor.leases - tax - capex;
      cash += fcf;
      const netDebt = anchor.totalDebt - cash;
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

  const scenarios: Scenario[] = [
    {
      key: "best",
      label: "Best",
      color: "var(--caos-success)",
      drivers: {
        revGrowth: base.revGrowth + 0.025,
        adjMargin: base.adjMargin + 0.01,
        capexPct: Math.max(0.02, base.capexPct - 0.003),
        rate: Math.max(0, base.rate - 0.005),
      },
    },
    { key: "base", label: "Base", color: "var(--caos-accent)", drivers: { ...base } },
    {
      key: "worst",
      label: "Worst",
      color: "var(--caos-critical)",
      drivers: {
        revGrowth: base.revGrowth - 0.035,
        adjMargin: base.adjMargin - 0.018,
        capexPct: base.capexPct + 0.004,
        rate: base.rate + 0.01,
      },
    },
  ];

  /** 1-way sensitivity of `m` to each driver, swung ± its base swing × intensity,
   *  holding the others at base. Sorted widest-impact first (tornado order). */
  function tornado(m: MetricKey, intensity = 1): { base: number; bars: TornadoBar[] } {
    const baseVal = metricValue(project(base), m);
    const bars: TornadoBar[] = SWINGS.map(({ key, label, swing }) => {
      const lo: Drivers = { ...base, [key]: base[key] - swing * intensity };
      const hi: Drivers = { ...base, [key]: base[key] + swing * intensity };
      return { driver: key, label, low: metricValue(project(lo), m), high: metricValue(project(hi), m) };
    });
    bars.sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
    return { base: baseVal, bars };
  }

  return { base, scenarios, project, tornado };
}
