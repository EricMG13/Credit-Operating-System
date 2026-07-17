// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/components/charts/SemanticVisualization", () => ({
  SemanticVisualization: ({ height, spec }: { height: number; spec: { title: string; data: unknown[]; tabularFallback: { data: unknown[] }; chart: Record<string, unknown> } }) => (
    <div data-testid="semantic-chart" data-height={height} data-points={spec.data.length} data-chart-data={String("data" in spec.chart)}>
      {spec.title} · {spec.tabularFallback.data.length}
    </div>
  ),
}));

import { MODULE_CHARTS, ModuleCharts } from "./ModuleCharts";

afterEach(() => {
  cleanup();
  delete MODULE_CHARTS.TEST;
});

describe("ModuleCharts rendering", () => {
  it("returns nothing for a module without registered charts", () => {
    const { container } = render(<ModuleCharts id="missing" />);
    expect(container.children).toHaveLength(0);
  });

  it("adapts every registered chart to the semantic visualization contract", () => {
    const expected = Object.values(MODULE_CHARTS).flat().length;
    const { rerender } = render(<ModuleCharts id="CP-1" />);
    expect(screen.getAllByTestId("semantic-chart")).toHaveLength(2);
    expect(screen.getByText(/Adj\. vs reported EBITDA/)).toBeTruthy();
    expect(screen.getAllByTestId("semantic-chart")[0].getAttribute("data-chart-data")).toBe("false");

    let rendered = 0;
    for (const id of Object.keys(MODULE_CHARTS)) {
      rerender(<ModuleCharts id={id} />);
      rendered += screen.getAllByTestId("semantic-chart").length;
    }
    expect(rendered).toBe(expected);
  });

  it("uses empty data and the default height when a definition omits both", () => {
    MODULE_CHARTS.TEST = [{
      kind: "bar",
      title: "Synthetic coverage chart",
      unit: "x",
      sourceIds: ["E-1"],
      accessibleSummary: "Synthetic chart used to cover defensive visualization defaults.",
      columns: [{ key: "x", label: "X" }, { key: "y", label: "Y" }],
      spec: { type: "interval" },
    }];
    render(<ModuleCharts id="TEST" />);
    const chart = screen.getByTestId("semantic-chart");
    expect(chart.getAttribute("data-height")).toBe("180");
    expect(chart.getAttribute("data-points")).toBe("0");
  });
});
