// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildReports, type Section } from "@/lib/reports/builders";
import { ReportVisualization } from "./ReportVisualization";

type ChartSection = Extract<Section, { t: "chart" }>;

afterEach(cleanup);

function reportChart(reportId: string, title: string): ChartSection {
  const report = buildReports().find((candidate) => candidate.id === reportId)!;
  const sections = report.sections.flatMap((section) => section.t === "cols" ? section.items.flat() : [section]);
  return sections.find(
    (section): section is ChartSection => section.t === "chart" && section.title === title,
  )!;
}

describe("ReportVisualization equivalent tables", () => {
  it("renders Earnings Update point values and periods as table columns", () => {
    const section = reportChart("earnings", "LEVERAGE — ROLLING LTM");
    render(<ReportVisualization section={section} height={section.h!} />);

    expect(screen.getAllByText("5.62x").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Show equivalent table"));
    const table = screen.getByRole("table", { name: /periods as columns/i });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Metric / period", "Dec-24", "Mar-25", "Jun-25", "Sep-25", "Dec-25*", "Mar-26",
    ]);
    const netLeverage = within(table).getByRole("row", { name: /Net leverage/ });
    expect(netLeverage.textContent).toContain("5.68x");
  });

  it("leaves existing non-opted-in report tables in long form", () => {
    const section = reportChart("covenant", "DAY-ONE CAPACITY COMPONENTS");
    render(<ReportVisualization section={section} height={section.h!} />);

    fireEvent.click(screen.getByText("Show equivalent table"));
    const table = screen.getByRole("table", { name: "DAY-ONE CAPACITY COMPONENTS data" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Component", "$M"]);
    expect(within(table).queryByText("Metric / period")).toBeNull();
  });
});
