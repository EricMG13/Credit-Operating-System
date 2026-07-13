// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SemanticVisualization,
  type VisualizationKind,
  type VisualizationSpec,
} from "./SemanticVisualization";

vi.mock("./G2Chart", () => ({
  G2Chart: ({ spec }: { spec: { data?: Array<{ chartPeriod: string }> } }) => (
    <div data-testid="g2-chart">
      {spec.data?.length ?? 0} points · {spec.data?.[0]?.chartPeriod ?? "no chart period"}
    </div>
  ),
}));

function relativeLuminance(hex: string) {
  const channels = hex.match(/[a-f\d]{2}/gi)!.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

afterEach(cleanup);

describe("SemanticVisualization", () => {
  it("exposes authority and mounts the equivalent table only on demand", () => {
    const kinds: VisualizationKind[] = [
      "line", "slope", "bar", "bullet", "stacked-bar", "heatmap", "waterfall",
      "maturity-wall", "timeline", "network",
    ];
    expect(kinds).toHaveLength(10);
    const spec: VisualizationSpec = {
      kind: "bar",
      title: "Leverage by issuer",
      unit: "x",
      asOf: "2026-07-13",
      sourceIds: ["run:alpha", "document:credit-agreement"],
      accessibleSummary: "Issuer Alpha has the highest leverage at 5.1x.",
      status: { label: "Current", tone: "success" },
      data: [
        { chartPeriod: "FY2025", chartLeverage: 5.1 },
        { chartPeriod: "FY2026", chartLeverage: 4.8 },
        { chartPeriod: "FY2027", chartLeverage: 4.4 },
      ],
      tabularFallback: {
        label: "Leverage by issuer data",
        data: [
          { issuer: "Alpha", leverage: 5.1 },
          { issuer: "Beta", leverage: 4.3 },
        ],
        columns: [
          { key: "issuer", label: "Issuer" },
          { key: "leverage", label: "Leverage" },
        ],
      },
      chart: { type: "interval", encode: { x: "issuer", y: "leverage" } },
    };
    expect(spec.data).toHaveLength(3);
    expect(spec.tabularFallback.data).toHaveLength(2);

    render(<SemanticVisualization spec={spec} />);

    expect(screen.getByRole("heading", { name: "Leverage by issuer" })).toBeTruthy();
    expect(screen.getByText("As of 2026-07-13")).toBeTruthy();
    expect(screen.getByText("run:alpha")).toBeTruthy();
    expect(screen.getByText("Issuer Alpha has the highest leverage at 5.1x.")).toBeTruthy();
    expect(screen.getByText("Current")).toBeTruthy();
    expect(screen.getByTestId("g2-chart").textContent).toContain("3 points · FY2025");
    expect(screen.queryByRole("table", { name: "Leverage by issuer data" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show equivalent table" }));
    expect(screen.getByRole("table", { name: "Leverage by issuer data" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Leverage" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide equivalent table" })).toBeTruthy();
  });

  it("uses paper-specific semantic text colors with at least 4.5:1 contrast", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const readToken = (name: string) => css.match(new RegExp(`${name}:\\s*(#[a-f\\d]{6})`, "i"))?.[1];
    const paper = readToken("--paper-bg");
    const colors = [
      readToken("--paper-success"),
      readToken("--paper-warning-status"),
      readToken("--paper-critical"),
      readToken("--paper-meta"),
    ];

    expect(paper).toBeTruthy();
    for (const color of colors) {
      expect(color).toBeTruthy();
      expect(contrastRatio(color!, paper!)).toBeGreaterThanOrEqual(4.5);
    }
    expect(css).toMatch(/semantic-visualization\[data-mode="paper"\][\s\S]*data-tone="success"/);
    expect(css).toMatch(/semantic-visualization\[data-mode="paper"\][\s\S]*data-tone="warning"/);
    expect(css).toMatch(/semantic-visualization\[data-mode="paper"\][\s\S]*data-tone="critical"/);
    expect(css).toMatch(/semantic-visualization\[data-mode="paper"\][\s\S]*data-tone="idle"/);
  });
});
