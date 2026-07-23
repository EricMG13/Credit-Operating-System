import { describe, expect, it } from "vitest";
import { buildLiveCharts } from "./LiveModuleCharts";

// Fixtures mirror real persisted runtime_output shapes (SS&C run 2026-07-22).
const CP1 = {
  basis: "reported_gaap_xbrl",
  currency: "USD",
  reporting_unit: "millions",
  source: "SEC EDGAR company facts (us-gaap)",
  normalized_financials: {
    revenue: { FY2022: 5283.0, FY2023: 5502.8, FY2024: 5882.0, FY2025: 6272.2 },
    adj_ebitda: { FY2022: 1814.5, FY2023: 1879.3, FY2024: 2023.6, FY2025: 2140.5 },
    free_cash_flow: { FY2022: 1070.9, FY2023: 1158.5, FY2024: 1327.2, FY2025: 1664.0 },
    net_debt_ltm: 6971.3,
    net_leverage_adj_ltm: 3.26,
  },
};

const CP3 = {
  scorecard: [
    { metric: "net_leverage", label: "Net leverage", percentile: 67, issuer_value: 3.26, peer_median: 5.1 },
    { metric: "interest_coverage", label: "Interest coverage", percentile: 75, issuer_value: 4.92, peer_median: 3.5 },
  ],
  composite_percentile: 72,
  recommendation: "OVERWEIGHT",
  rv_basis: "fundamentals_only",
  peer_scope: "peers",
};

// Real persisted CP-1B payload shape (demo-vault engine run 2026-07-22).
const CP1B = {
  periods: [
    { period: "FY2023", revenue: 2410, adj_ebitda: 358, ebitda_margin: 14.9 },
    { period: "FY2024", revenue: 2588, adj_ebitda: 392, ebitda_margin: 15.1 },
    { period: "FY2025", revenue: 2742, adj_ebitda: 415, ebitda_margin: 15.1 },
  ],
  summary: { revenue_growth_pct: 6.0, ebitda_growth_pct: 5.9, margin_change_pp: 0.0, latest_period: "FY2025", prior_period: "FY2024" },
  monitoring_signals: [],
};

// CP-1C comparisons carry unit/percentile/outlier (engine/peers.py).
const CP1C = {
  peer_scope: "Software peers",
  peer_count: 4,
  comparisons: [
    { metric: "net_leverage", label: "Net leverage", unit: "x", issuer_value: 3.26, peer_median: 5.1, peer_count: 4, percentile: 75, higher_is_better: false, outlier: false },
    { metric: "ebitda_margin", label: "EBITDA margin", unit: "%", issuer_value: 12.1, peer_median: 18.4, peer_count: 4, percentile: 25, higher_is_better: true, outlier: true },
  ],
  outlier_metrics: ["EBITDA margin"],
};

const CP2B = {
  current_net_leverage: 3.26,
  breach_threshold_x: 7.0,
  scenarios: [
    { ebitda_shock_pct: 10, stressed_net_leverage: 3.62 },
    { ebitda_shock_pct: 20, stressed_net_leverage: 4.07 },
    { ebitda_shock_pct: 30, stressed_net_leverage: 4.66 },
  ],
  shock_to_breach_pct: null,
  fragility: "LOW",
};

describe("buildLiveCharts", () => {
  it("CP-1 builds revenue/EBITDA bars and FCF line from the FY series", () => {
    const defs = buildLiveCharts("CP-1", CP1);
    expect(defs.map((d) => d.kind)).toEqual(["bar", "line"]);
    const bars = defs[0].spec.data as { fy: string; s: string; v: number }[];
    expect(bars).toHaveLength(8); // 4 FYs x 2 series, all from the payload
    expect(bars.find((d) => d.fy === "FY2025" && d.s === "Revenue")?.v).toBe(6272.2);
    expect(defs[0].unit).toBe("$M");
    expect(defs[0].sourceIds[0]).toContain("SEC EDGAR");
    expect(defs[1].accessibleSummary).toContain("1,071"); // display-rounded from 1070.9
    expect(defs[1].accessibleSummary).toContain("1,664");
  });

  it("humanizes machine period keys for display and omits the unit when the payload has none", () => {
    const defs = buildLiveCharts("CP-1", {
      normalized_financials: {
        revenue: { FY25: 2742, LTM_Q1_26: 2801 },
        adj_ebitda: { FY25: 415, LTM_Q1_26: 421 },
      },
    });
    const bars = defs[0].spec.data as { fy: string }[];
    expect(bars.map((d) => d.fy)).toEqual(["FY25", "LTM Q1-26", "FY25", "LTM Q1-26"]);
    expect(defs[0].accessibleSummary).toContain("LTM Q1-26");
    expect(defs[0].accessibleSummary).not.toContain("LTM_Q1_26");
    expect(defs[0].unit).toBeUndefined(); // no currency/reporting_unit -> no filler "value" unit
    expect(defs[0].columns[2].label).toBe("Value");
  });

  it("CP-1 drops any series below two points and charts the rest", () => {
    const defs = buildLiveCharts("CP-1", {
      ...CP1,
      normalized_financials: { revenue: { FY2025: 6272.2 }, free_cash_flow: CP1.normalized_financials.free_cash_flow },
    });
    expect(defs.map((d) => d.title)).toEqual(["CP-1 · Free cash flow"]);
  });

  it("CP-3 charts percentiles on a fixed 0-100 scale with raw values in the table", () => {
    const [def] = buildLiveCharts("CP-3", CP3);
    expect(def.kind).toBe("bar");
    expect((def.spec as { scale?: { y?: { domain?: number[] } } }).scale?.y?.domain).toEqual([0, 100]);
    // No outlier in the scorecard -> the quiet single-hue branch: accent fill,
    // no color encode, no color scale, no legend. (This branch ships blind
    // without an assertion — a spec-shape mistake here has no other net.)
    const spec = def.spec as { encode?: { color?: string }; scale?: { color?: unknown }; legend?: unknown; style?: { fill?: string } };
    expect(spec.encode?.color).toBeUndefined();
    expect(spec.scale?.color).toBeUndefined();
    expect(spec.legend).toBeUndefined();
    expect(spec.style?.fill).toBe("#63a1ff");
    const rows = def.spec.data as { m: string; v: number; issuer: string; median: string }[];
    expect(rows[0]).toMatchObject({ m: "Net leverage", v: 67, issuer: "3.26", median: "5.1" });
    expect(def.note).toContain("Composite 72nd pct");
    expect(def.note).toContain("OVERWEIGHT");
  });

  it("CP-2B includes the 0% point, scenario curve, and breach-threshold series", () => {
    const [def] = buildLiveCharts("CP-2B", CP2B);
    const data = def.spec.data as { shock: string; s: string; v: number }[];
    const curve = data.filter((d) => d.s === "Stressed net leverage");
    expect(curve.map((d) => d.shock)).toEqual(["0%", "-10%", "-20%", "-30%"]);
    expect(data.some((d) => d.s.startsWith("Breach threshold") && d.v === 7)).toBe(true);
    expect(def.note).toContain("No breach within the modeled shocks");
    expect(def.note).toContain("LOW");
  });

  it("CP-1B builds period bars plus a margin line, noting YoY growth", () => {
    const defs = buildLiveCharts("CP-1B", CP1B);
    expect(defs.map((d) => d.kind)).toEqual(["bar", "line"]);
    const bars = defs[0].spec.data as { p: string; s: string; v: number }[];
    expect(bars).toHaveLength(6); // 3 periods x 2 series
    expect(bars.find((d) => d.p === "FY2025" && d.s === "Revenue")?.v).toBe(2742);
    expect(defs[0].note).toBe("Rev +6% YoY · EBITDA +5.9% YoY");
    const margins = defs[1].spec.data as { p: string; v: number }[];
    expect(margins.map((d) => d.v)).toEqual([14.9, 15.1, 15.1]);
    expect(defs[1].accessibleSummary).toContain("14.9% in FY2023 to 15.1% in FY2025");
  });

  it("CP-1C reuses the percentile scorecard with units and outlier grouping", () => {
    const [def] = buildLiveCharts("CP-1C", CP1C);
    expect(def.title).toBe("CP-1C · Peer standing by metric");
    const rows = def.spec.data as { m: string; v: number; grp: string; issuer: string; median: string }[];
    expect(rows[0]).toMatchObject({ m: "Net leverage", v: 75, grp: "In line", issuer: "3.26x", median: "5.1x" });
    expect(rows[1]).toMatchObject({ m: "EBITDA margin", v: 25, grp: "Bottom-quartile outlier", issuer: "12.1%" });
    // Outlier meaning is never color-only: named in the note and the summary.
    expect(def.note).toContain("Bottom-quartile: EBITDA margin");
    expect(def.accessibleSummary).toContain("a bottom-quartile outlier");
    expect((def.spec as { scale?: { color?: { range?: string[] } } }).scale?.color?.range).toHaveLength(2);
  });

  it("CP-2F charts coverage under rate shock with the worst-point interest note", () => {
    const [def] = buildLiveCharts("CP-2F", {
      base_interest_coverage: 2.1,
      rate_hedge_disclosed: false,
      scenarios: [
        { rate_shock_bps: 100, incremental_interest_musd: 23.9, stressed_interest_coverage: 1.88 },
        { rate_shock_bps: 200, incremental_interest_musd: 47.8, stressed_interest_coverage: 1.7 },
      ],
    });
    const pts = def.spec.data as { shock: string; v: number }[];
    expect(pts.map((d) => d.shock)).toEqual(["0bp", "+100bp", "+200bp"]);
    expect(pts.map((d) => d.v)).toEqual([2.1, 1.88, 1.7]);
    expect(def.note).toBe("$47.8M added interest at +200bp · assumes 100% floating, no hedges disclosed");
    expect(def.accessibleSummary).toContain("2.1x at the base rate to 1.7x at +200bp");
  });

  it("CP-5 and CP-5C share the severity bar, ordered CRITICAL→MINOR, colored by ramp", () => {
    const rt = { findings_by_severity: { MINOR: 3, CRITICAL: 1, MATERIAL: 2 }, clearance: "CONDITIONAL", modules_audited: 19 };
    const [def] = buildLiveCharts("CP-5", rt);
    const data = def.spec.data as { sev: string; n: number }[];
    expect(data.map((d) => d.sev)).toEqual(["CRITICAL", "MATERIAL", "MINOR"]);
    expect(def.note).toBe("Clearance: CONDITIONAL · 19 modules audited");
    expect((def.spec as { scale?: { color?: { range?: string[] } } }).scale?.color?.range).toEqual(["#ef4444", "#f5a524", "#a1a1b5"]);
    const [council] = buildLiveCharts("CP-5C", { findings_by_severity: { MATERIAL: 1 }, modules_reviewed: 19 });
    expect(council.title).toBe("CP-5C · Findings by severity");
    expect(council.note).toBe("19 modules reviewed");
  });

  it("CP-3B charts recovery only for tranches carrying figures, in seniority order", () => {
    const [def] = buildLiveCharts("CP-3B", {
      distressed_ev_musd: 2105,
      waterfall_basis: "absolute-priority waterfall",
      tranches: [
        { tranche: "Second lien", code: "2L", seniority_rank: 1, amount_musd: 400, recovery_musd: 180, recovery_pct: 45 },
        { tranche: "Senior secured TLB", code: "TLB", seniority_rank: 0, amount_musd: 1900, recovery_musd: 1900, recovery_pct: 100 },
        { tranche: "Unscanned notes", code: "SSN", seniority_rank: 2, recovery_pct: null },
      ],
    });
    const rows = def.spec.data as { tranche: string; v: number; recovery: string }[];
    expect(rows.map((r) => r.tranche)).toEqual(["Senior secured TLB", "Second lien"]); // rank order, null dropped
    expect(rows[1]).toMatchObject({ v: 45, recovery: "$180M" });
    expect(def.note).toContain("$2,105M distressed EV");
  });

  it("degrades to no charts on thin or malformed payloads", () => {
    expect(buildLiveCharts("CP-1", {})).toEqual([]);
    expect(buildLiveCharts("CP-2B", { current_net_leverage: 3.26, scenarios: [] })).toEqual([]);
    expect(buildLiveCharts("CP-3", { scorecard: "not-a-list" })).toEqual([]);
    expect(buildLiveCharts("CP-1B", { periods: [{ period: "FY2025", revenue: 2742 }] })).toEqual([]);
    expect(buildLiveCharts("CP-1C", { comparisons: [] })).toEqual([]);
    expect(buildLiveCharts("CP-2F", { base_interest_coverage: 2.1, scenarios: [] })).toEqual([]);
    expect(buildLiveCharts("CP-5", { findings_by_severity: { CRITICAL: 0, MATERIAL: 0, MINOR: 0 } })).toEqual([]); // clean run = no chart
    expect(buildLiveCharts("CP-3B", { tranches: [{ tranche: "SSN", recovery_pct: null }] })).toEqual([]);
    expect(buildLiveCharts("CP-9", CP1)).toEqual([]);
    expect(buildLiveCharts("CP-1", null)).toEqual([]);
  });
});
