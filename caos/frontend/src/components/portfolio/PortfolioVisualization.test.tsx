// @vitest-environment jsdom

import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { VisualizationSpec } from "@/components/charts/SemanticVisualization";
import { PortfolioVisualization } from "./PortfolioVisualization";

const spec: VisualizationSpec = {
  kind: "bullet",
  title: "Risk-budget headroom",
  unit: "limit units",
  asOf: "2026-07-20",
  sourceIds: ["portfolio:p1"],
  accessibleSummary: "One breached and one passing constraint are reported.",
  status: { label: "Breach present", tone: "critical" },
  data: [
    { code: "OC", headroom: -2, status: "Breach" },
    { code: "CCC", headroom: 6, status: "Pass" },
  ],
  tabularFallback: {
    label: "Risk-budget headroom data",
    columns: [
      { key: "code", label: "Constraint" },
      { key: "headroom", label: "Headroom" },
      { key: "status", label: "Status" },
    ],
    data: [
      { code: "OC", headroom: -2, status: "Breach" },
      { code: "CCC", headroom: 6, status: "Pass" },
    ],
  },
  chart: { type: "interval", encode: { x: "code", y: "headroom", color: "status" } },
};

describe("PortfolioVisualization", () => {
  it("retains the semantic chart contract and signed, labelled values", () => {
    const { container } = render(<PortfolioVisualization spec={spec} headingLevel={2} />);
    const view = within(container);

    expect(view.getByRole("heading", { level: 2, name: "Risk-budget headroom" })).toBeTruthy();
    const chart = view.getByRole("img", { name: "Risk-budget headroom" });
    expect(chart.getAttribute("aria-describedby")).toBeTruthy();
    expect(view.getByText("One breached and one passing constraint are reported.")).toBeTruthy();
    expect(view.getByText("Breach present")).toBeTruthy();
    expect(view.getByText("portfolio:p1")).toBeTruthy();

    const rows = container.querySelectorAll(".portfolio-visualization__row");
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute("data-tone")).toBe("critical");
    expect(rows[1].getAttribute("data-tone")).toBe("success");
    expect(within(rows[0] as HTMLElement).getByText("-2")).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText("6")).toBeTruthy();
    expect((rows[0].querySelector(".portfolio-visualization__bar") as HTMLElement).style.left).toBe("0%");
    expect((rows[1].querySelector(".portfolio-visualization__bar") as HTMLElement).style.left).toBe("25%");
  });

  it("discloses the complete equivalent table with a native button", () => {
    const { container } = render(<PortfolioVisualization spec={spec} />);
    const view = within(container);
    const toggle = view.getByRole("button", { name: "Show equivalent table" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);

    expect(view.getByRole("button", { name: "Hide equivalent table" }).getAttribute("aria-expanded")).toBe("true");
    const table = view.getByRole("table", { name: "Risk-budget headroom data" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });
});
