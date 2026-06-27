import { describe, it, expect } from "vitest";
import type { ProfileMetric } from "@/lib/api";
import {
  periodRank, buildHeadline, buildSeries, financialsSpec, lineSpec, buildCharts,
  isQuarterPeriod, filterSeriesByGranularity,
} from "@/lib/issuer-profile-charts";

const m = (
  metric_key: string, period: string, value: number,
  provenance = "run", headline = true,
): ProfileMetric => ({
  metric_key, period, value, unit: "x", basis: null, provenance, headline,
  qa_status: "Passed", source_claim_id: null, source_evidence_id: null, document_chunk_id: null,
});

describe("periodRank", () => {
  it("orders fiscal years chronologically, LTM tail last", () => {
    const periods = ["LTM_Q1_26", "FY23", "FY25", "FY24"];
    expect([...periods].sort((a, b) => periodRank(a) - periodRank(b)))
      .toEqual(["FY23", "FY24", "FY25", "LTM_Q1_26"]);
  });
  it("handles 4-digit years too", () => {
    expect(periodRank("FY2023")).toBeLessThan(periodRank("FY2024"));
  });
});

describe("buildHeadline (mock↔live seam)", () => {
  it("prefers the live run over a leftover seed for the same metric", () => {
    const nl = buildHeadline([m("net_leverage", "LTM", 2.3, "seed"), m("net_leverage", "LTM", 2.5, "run")])
      .find((x) => x.metric_key === "net_leverage")!;
    expect(nl.value).toBe(2.5);
    expect(nl.provenance).toBe("run");
  });
});

describe("buildSeries", () => {
  it("dedupes a period (run wins) and sorts oldest→newest", () => {
    const s = buildSeries([
      m("net_leverage", "LTM", 2.3, "seed"), m("net_leverage", "LTM", 2.5, "run"),
      m("revenue", "FY24", 100), m("revenue", "FY23", 90),
    ]);
    expect(s.net_leverage).toHaveLength(1);
    expect(s.net_leverage[0].value).toBe(2.5);
    expect(s.revenue.map((x) => x.period)).toEqual(["FY23", "FY24"]);
  });
});

describe("financialsSpec / lineSpec — ≥2-period guard", () => {
  it("financialsSpec is null with <2 shared periods, a spec with ≥2", () => {
    expect(financialsSpec({ revenue: [m("revenue", "FY23", 90)], adj_ebitda: [m("adj_ebitda", "FY23", 10)] })).toBeNull();
    const spec = financialsSpec({
      revenue: [m("revenue", "FY23", 90), m("revenue", "FY24", 100)],
      adj_ebitda: [m("adj_ebitda", "FY23", 10), m("adj_ebitda", "FY24", 12)],
    });
    expect(spec?.type).toBe("interval");
    expect((spec?.data as unknown[]).length).toBe(4); // 2 periods × 2 series
  });
  it("lineSpec is null for a single point", () => {
    expect(lineSpec([m("x", "FY23", 1)], "#fff", String)).toBeNull();
    expect(lineSpec([m("x", "FY23", 1), m("x", "FY24", 2)], "#fff", String)).not.toBeNull();
  });
});

describe("granularity filter (FY ↔ quarters)", () => {
  it("classifies single quarters vs annual/LTM", () => {
    expect(isQuarterPeriod("Q1 2025")).toBe(true);
    expect(isQuarterPeriod("Q3-25")).toBe(true);
    expect(isQuarterPeriod("FY24")).toBe(false);
    expect(isQuarterPeriod("FY2024")).toBe(false);
    expect(isQuarterPeriod("LTM")).toBe(false);
    expect(isQuarterPeriod("LTM_Q1_26")).toBe(false); // trailing-12m → annual bucket
  });
  it("splits a mixed series and drops emptied metrics", () => {
    const series = buildSeries([
      m("revenue", "FY23", 90), m("revenue", "FY24", 100),
      m("revenue", "Q1 2025", 26), m("revenue", "Q2 2025", 27),
      m("net_leverage", "LTM", 2.3), // annual-only metric
    ]);
    const fy = filterSeriesByGranularity(series, "FY");
    const q = filterSeriesByGranularity(series, "Q");
    expect(fy.revenue.map((x) => x.period)).toEqual(["FY23", "FY24"]);
    expect(q.revenue.map((x) => x.period)).toEqual(["Q1 2025", "Q2 2025"]);
    expect(fy.net_leverage).toHaveLength(1);
    expect(q.net_leverage).toBeUndefined(); // no quarterly leverage → dropped
  });
});

describe("buildCharts", () => {
  it("includes multi-period financials, omits LTM-only credit ratios", () => {
    const titles = buildCharts(buildSeries([
      m("revenue", "FY23", 90), m("revenue", "FY24", 100),
      m("adj_ebitda", "FY23", 10), m("adj_ebitda", "FY24", 12),
      m("ebitda_margin", "FY23", 11), m("ebitda_margin", "FY24", 12),
      m("net_leverage", "LTM", 2.3), // single period → no line chart
    ])).map((c) => c.title);
    expect(titles).toContain("Revenue & Adj. EBITDA ($M)");
    expect(titles).toContain("EBITDA margin (%)");
    expect(titles).not.toContain("Net leverage (×)");
  });
});
