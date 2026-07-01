// Pure data helpers behind the Issuer Profile time-series visualisations.
// Kept out of the page component so the period parsing, the mock↔live seam
// preference, and the ≥2-period chart guards are unit-testable without pulling
// in React or @antv/g2. Specs are plain option trees (fed to G2Chart).

import type { ProfileMetric } from "@/lib/api";
import { CHART_HEX } from "@/lib/chart-colors";

// G2 specs are loosely-typed option trees.
export type ChartSpec = Record<string, unknown>;

// Snapshot order — credit ratios first, then scale, then distress / exposure.
export const SNAPSHOT_ORDER = [
  "net_leverage", "interest_coverage", "ebitda_margin", "revenue", "adj_ebitda",
  "fcf", "fcf_conversion", "altman_z",
];

// Prefer a live run over seed/fixture/derived when >1 fact shares a metric_key
// (and period) — the snapshot/trend must reflect the real analysis, not a
// leftover demo value. The bias to guard at the mock↔live seam.
export const provRank = (p: string): number =>
  p === "run" ? 0 : p === "fixture" ? 1 : p === "derived" ? 2 : p === "seed" ? 3 : 4;

// Chronological rank for a period label. Handles the shapes the engine emits:
// "FY2024", "FY23" (2-digit), "Q1 2025", "LTM_Q1_26", "LTM". Year wins; a quarter
// (or bare LTM) breaks the tie within a year so LTM sorts after that year's FY.
export function periodRank(p: string): number {
  const y4 = p.match(/(20\d{2})/);
  const y2 = p.match(/(\d{2})(?!\d)/);
  const year = y4 ? Number(y4[1]) : y2 ? 2000 + Number(y2[1]) : 0;
  const q = p.match(/q([1-4])/i);
  return year * 10 + (q ? Number(q[1]) : /ltm/i.test(p) ? 9 : 0);
}

// A period that denotes a single quarter (Q1–Q4), not an annual / LTM figure.
// "Q1 2025" / "Q3-25" → true; "FY24" / "FY2024" / "LTM" / "LTM_Q1_26" → false
// (LTM is a trailing-12m, annual-magnitude figure, so it belongs with full years).
export function isQuarterPeriod(p: string): boolean {
  return /q[1-4]/i.test(p) && !/ltm|fy/i.test(p);
}

// Keep only the periods of one granularity. "Q" → single quarters; "FY" →
// everything else (full fiscal years + LTM). Empty per-metric arrays are dropped
// so the ≥2-point chart guards treat a one-period granularity as "no trend".
export function filterSeriesByGranularity(
  series: Record<string, ProfileMetric[]>, gran: "FY" | "Q",
): Record<string, ProfileMetric[]> {
  const out: Record<string, ProfileMetric[]> = {};
  for (const [k, pts] of Object.entries(series)) {
    const kept = pts.filter((m) => (gran === "Q" ? isQuarterPeriod(m.period) : !isQuarterPeriod(m.period)));
    if (kept.length) out[k] = kept;
  }
  return out;
}

// One headline fact per snapshot metric, best-provenance wins (so a leftover seed
// value never out-ranks the live run's).
export function buildHeadline(metrics: ProfileMetric[]): ProfileMetric[] {
  return SNAPSHOT_ORDER
    .map((k) => metrics.filter((m) => m.metric_key === k && m.headline)
      .sort((a, b) => provRank(a.provenance) - provRank(b.provenance))[0])
    .filter((m): m is ProfileMetric => Boolean(m));
}

// Group facts into per-metric series: one point per period (preferring the live
// run over a same-period seed), oldest→newest. So a single real period doesn't
// render as a fake 2-point line.
export function buildSeries(metrics: ProfileMetric[]): Record<string, ProfileMetric[]> {
  const by: Record<string, Record<string, ProfileMetric>> = {};
  for (const m of metrics) {
    const slot = (by[m.metric_key] ??= {});
    if (!slot[m.period] || provRank(m.provenance) < provRank(slot[m.period].provenance)) slot[m.period] = m;
  }
  const out: Record<string, ProfileMetric[]> = {};
  for (const k of Object.keys(by)) out[k] = Object.values(by[k]).sort((a, b) => periodRank(a.period) - periodRank(b.period));
  return out;
}

export function latestPointDelta(pts: ProfileMetric[] | undefined): number | null {
  if (!pts || pts.length < 2) return null;
  const latest = pts[pts.length - 1]?.value;
  const prior = pts[pts.length - 2]?.value;
  return typeof latest === "number" && typeof prior === "number" ? latest - prior : null;
}

const MC_AXIS = { x: { title: false }, y: { title: false } };
// Shared dodge-bar styling (no axis titles, top legend, value labels). Factored
// out so the grouped-bar spec body isn't a near-clone of the other dodgeX charts
// in the app (e.g. ModuleCharts' CP-1B revenue/EBITDA bars).
const DODGE_BAR_STYLE = {
  transform: [{ type: "dodgeX" }],
  legend: { color: { position: "top" } },
  axis: MC_AXIS,
  labels: [{ text: "v", position: "top", fontSize: 8.5, transform: [{ type: "overlapHide" }] }],
};

// Grouped-bar spec for revenue vs adj. EBITDA over the periods both series share.
// Null (→ chart omitted) unless ≥2 shared periods exist — no fake single-bar trend.
export function financialsSpec(series: Record<string, ProfileMetric[]>): ChartSpec | null {
  const rev = (series.revenue || []).filter((r) => Number.isFinite(r.value));
  const eb = (series.adj_ebitda || []).filter((e) => Number.isFinite(e.value));
  const periods = rev.map((r) => r.period).filter((per) => eb.some((e) => e.period === per));
  if (periods.length < 2) return null;
  const data: { fy: string; s: string; v: number }[] = [];
  for (const per of periods) {
    const r = rev.find((x) => x.period === per);
    const e = eb.find((x) => x.period === per);
    if (r) data.push({ fy: per, s: "Revenue", v: r.value });
    if (e) data.push({ fy: per, s: "Adj. EBITDA", v: e.value });
  }
  return {
    type: "interval", data,
    encode: { x: "fy", y: "v", color: "s" },
    scale: { color: { domain: ["Revenue", "Adj. EBITDA"], range: [CHART_HEX.accent, CHART_HEX.teal] } },
    ...DODGE_BAR_STYLE,
  };
}

// Single-metric line+point over its periods. Null unless ≥2 points.
export function lineSpec(
  pts: ProfileMetric[] | undefined, color: string, label: (v: number) => string,
): ChartSpec | null {
  // value is typed number but arrives from JSON — drop null/NaN points so the label
  // callback (v.toFixed) can't crash the chart render on a missing metric.
  const nums = (pts ?? []).filter((p) => Number.isFinite(p.value));
  if (nums.length < 2) return null;
  return {
    type: "view",
    data: nums.map((p) => ({ fy: p.period, v: p.value })),
    children: [
      { type: "line", encode: { x: "fy", y: "v" }, style: { stroke: color, lineWidth: 2 } },
      { type: "point", encode: { x: "fy", y: "v" }, style: { fill: color },
        labels: [{ text: (d: { v: number }) => label(d.v), fontSize: 8.5, transform: [{ type: "overlapDodgeY" }] }] },
    ],
    axis: MC_AXIS,
  };
}

// The time-series charts that have enough data to draw. Financials
// (revenue/EBITDA/margin) are multi-period in a normal run; credit ratios are
// LTM-only today, so their line charts appear only once ≥2 periods land.
export function buildCharts(series: Record<string, ProfileMetric[]>): { title: string; spec: ChartSpec }[] {
  const out: { title: string; spec: ChartSpec }[] = [];
  const fin = financialsSpec(series);
  if (fin) out.push({ title: "Revenue & Adj. EBITDA ($M)", spec: fin });
  const margin = lineSpec(series.ebitda_margin, CHART_HEX.teal, (v) => v.toFixed(1) + "%");
  if (margin) out.push({ title: "EBITDA margin (%)", spec: margin });
  const lev = lineSpec(series.net_leverage, CHART_HEX.warning, (v) => v.toFixed(2).replace(/0$/, "") + "×");
  if (lev) out.push({ title: "Net leverage (×)", spec: lev });
  const cov = lineSpec(series.interest_coverage, CHART_HEX.success, (v) => v.toFixed(1) + "×");
  if (cov) out.push({ title: "Interest coverage (×)", spec: cov });
  return out;
}
