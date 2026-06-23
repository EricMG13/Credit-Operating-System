// Concept D — forward Scenario & Sensitivity lens for the cash-flow model.
//
// A simplified credit cash-flow projection that stays true to the Model Builder:
// revenue → adj EBITDA → free cash flow → cash build / deleveraging → net
// leverage. Derived from the model's *assumptions-adjusted forecast*, so it
// follows the Assumptions panel: base reads the BASE columns (b0/b1/b2), worst
// reads the DOWNSIDE columns (d0/d1/d2), and best is an optimistic swing off
// base (there is no separate upside-assumptions case). Move a slider and the
// best/base/worst set + the tornado re-center on the new forecast.
//
// Not a DCF/valuation — total debt is held static and FCF accumulates to cash
// (the deleveraging story), so the only outputs are credit metrics.
//
// The lens is built from a passed-in Model via `buildScenarios(model)`: its base
// drivers (growth, margin, capex %, rate) are the average of the BASE forecast
// columns, so analyst assumptions flow straight through; the roll-forward starts
// from FY25 revenue and the LTM cash close.

import { buildModel, type Model, type ModelCol } from "@/lib/reports/model";

export interface Drivers {
  revGrowth: number; // annual revenue growth (e.g. 0.035)
  adjMargin: number; // adj EBITDA / revenue
  capexPct: number;  // capex / revenue
  rate: number;      // blended cash interest rate on total debt
}

// Cash-tax rate the lens applies to pre-tax income (model basis); D&A % and
// leases are read off the BASE forecast columns instead.
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

/** Build the forward scenario lens from a model's assumptions-adjusted forecast.
 *  base drivers = the average realized growth / margin / capex% / rate of the
 *  BASE columns (b0/b1/b2); worst = the same off the DOWNSIDE columns (d0/d1/d2);
 *  best = an optimistic swing off base. So both the base- and downside-case
 *  Assumptions sliders flow straight through and the lens re-centers live.
 *
 *  `adjust` applies analyst-supplied driver deltas (the Scenario Builder) on top
 *  of base AND worst before building the set — re-centering the whole lens on a
 *  custom scenario. Omit it to follow the assumptions only. */
export function buildScenarios(
  model: Model = buildModel(1),
  adjust?: Partial<Drivers>,
): ScenarioLens {
  const f25 = model.cols.f25, l1 = model.cols.l1;
  const B = [model.cols.b0, model.cols.b1, model.cols.b2];
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  const anchor: Anchor = {
    rev0: f25.rev,                          // BASE forecast grows off FY25
    totalDebt: avg(B.map((c) => c.tdebt)),  // forecast debt stack
    cash0: l1.cash,                         // forecast cash rolls from the LTM close
    daPct: avg(B.map((c) => c.da / c.rev)), // = base-case D&A assumption
    leases: avg(B.map((c) => c.leases)),    // = base-case leases assumption
    taxRate: TAX_RATE,
  };

  // Average realized drivers of a forecast case's columns, with the Scenario
  // Builder deltas layered on. Base reads the BASE columns; worst reads DOWN, so
  // the downside-case assumption sliders flow straight into the worst scenario.
  const driversOf = (cols: ModelCol[]): Drivers => ({
    revGrowth: avg(cols.map((c) => c.gRev ?? 0)) + (adjust?.revGrowth ?? 0),
    adjMargin: avg(cols.map((c) => c.adjm)) + (adjust?.adjMargin ?? 0),
    capexPct: Math.max(0, avg(cols.map((c) => c.capex / c.rev)) + (adjust?.capexPct ?? 0)),
    rate: Math.max(0, avg(cols.map((c) => c.int / c.tdebt)) + (adjust?.rate ?? 0)),
  });
  const base = driversOf(B);
  const worst = driversOf([model.cols.d0, model.cols.d1, model.cols.d2]);

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
    // Worst = the DOWNSIDE forecast (CP-2B pathway + the downside-case sliders),
    // so the panel's downside assumptions drive the worst case directly rather
    // than a fixed swing off base.
    { key: "worst", label: "Worst", color: "var(--caos-critical)", drivers: { ...worst } },
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
