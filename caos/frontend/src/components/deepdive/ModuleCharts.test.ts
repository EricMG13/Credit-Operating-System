import { describe, expect, it } from "vitest";
import { MODULE_CHARTS } from "./ModuleCharts";

describe("Module chart semantic contracts", () => {
  it("gives every analytical chart authority, a readable summary, and an equivalent table schema", () => {
    const charts = Object.values(MODULE_CHARTS).flat();
    expect(charts.length).toBeGreaterThan(0);
    for (const chart of charts) {
      expect(chart.title).toBeTruthy();
      expect(chart.accessibleSummary.length).toBeGreaterThan(30);
      expect(chart.sourceIds.length).toBeGreaterThan(0);
      expect(chart.columns.length).toBeGreaterThan(1);
      expect(Array.isArray(chart.spec.data)).toBe(true);
      expect(chart.spec.data.length).toBeGreaterThan(0);
    }
  });

  it("formats every callback-backed chart label on both sides of its branch", () => {
    const leverageText = MODULE_CHARTS["CP-1"][1].spec.children?.[1].labels?.[0].text as (datum: { v: number }) => string;
    expect(leverageText({ v: 5.68 })).toBe("5.68x");
    expect(leverageText({ v: 6.0 })).toBe("6.0x");

    const mixText = MODULE_CHARTS["CP-1A"][0].spec.labels?.[0].text as (datum: { v: number }) => string;
    expect(mixText({ v: 44 })).toBe("44%");

    const axisText = MODULE_CHARTS["CP-3"][0].spec.axis?.y?.labelFormatter as (value: number) => string;
    const spreadText = MODULE_CHARTS["CP-3"][0].spec.labels?.[0].text as (datum: { v: number }) => string;
    expect(axisText(56)).toBe("+56");
    expect(axisText(-24)).toBe("-24");
    expect(spreadText({ v: 15 })).toBe("+15");
    expect(spreadText({ v: -2 })).toBe("-2");
  });
});
