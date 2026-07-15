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
});
