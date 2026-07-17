// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Model } from "@/lib/reports/model";
import type { Drivers, MetricKey, Projection, ScenarioLens, TornadoBar } from "@/lib/model/scenarios";

const controls = vi.hoisted(() => ({ lens: null as ScenarioLens | null }));

vi.mock("@/lib/model/scenarios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/model/scenarios")>();
  return { ...actual, buildScenarios: () => controls.lens! };
});
vi.mock("@/lib/api", () => ({ scenarioFromNL: vi.fn() }));
vi.mock("@/components/shared/Panel", () => ({ Panel: ({ children }: { children: ReactNode }) => <section>{children}</section> }));
vi.mock("./ScenarioNetworkPanel", () => ({ ScenarioNetworkPanel: () => <div>Network</div> }));

import { ScenarioPanel } from "./ScenarioPanel";

const drivers: Drivers = { revGrowth: 0, adjMargin: 0.1, capexPct: 0.02, rate: 0.05 };

function projection(): Projection {
  return {
    years: ["FY26e", "FY27e", "FY28e"],
    revenue: [100, 100, 100],
    adjEbitda: [10, 10, 10],
    fcf: [-1, -1, -1],
    cash: [-1, -2, -3],
    netDebt: [11, 12, 13],
    netLev: [1.1, 1.2, 1.3],
    intCov: [2, 2, 2],
  };
}

function bars(top: [number, number], second: [number, number] = [9, 11]): TornadoBar[] {
  return [
    { driver: "revGrowth", label: "Revenue growth", low: top[0], high: top[1] },
    { driver: "adjMargin", label: "EBITDA margin", low: second[0], high: second[1] },
    { driver: "rate", label: "Interest rate", low: 9.5, high: 10.5 },
    { driver: "capexPct", label: "Capex % rev", low: 9.75, high: 10.25 },
  ];
}

function lens(): ScenarioLens {
  return {
    base: drivers,
    scenarios: [
      { key: "best", label: "Best", color: "green", drivers },
      { key: "base", label: "Base", color: "blue", drivers },
      { key: "worst", label: "Worst", color: "red", drivers },
    ],
    project: projection,
    tornado: (metric: MetricKey, intensity = 1) => {
      if (metric === "netLevExit" && intensity === 1) return {
        base: 10,
        bars: bars([10, 10], [10, 10]).map((bar) => ({ ...bar, low: 10, high: 10 })),
      };
      if (metric === "netLevExit" && intensity === 0.5) return { base: 10, bars: bars([0, 14]) };
      if (metric === "netLevExit") return { base: 10, bars: bars([2, 16]) };
      if (metric === "cumFcf") return { base: 10, bars: bars([0, 18]) };
      if (metric === "minCash") return { base: 10, bars: bars([5, 15]) };
      return { base: 10, bars: bars([10, Number.POSITIVE_INFINITY]) };
    },
  };
}

afterEach(cleanup);

describe("ScenarioPanel tornado edge narratives", () => {
  it("covers zero-width, every skew band, infinite magnitude, and negative cash", () => {
    controls.lens = lens();
    render(<ScenarioPanel model={{} as Model} />);

    expect(screen.getByText(/far wider than any other factor/)).toBeTruthy();
    expect(screen.getByText(/markedly downside-skewed/)).toBeTruthy();
    expect(screen.getAllByText("($3M)").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTitle("Driver swing intensity ×0.5"));
    expect(screen.getByText(/markedly upside-skewed/)).toBeTruthy();

    fireEvent.click(screen.getByTitle("Driver swing intensity ×1.5"));
    expect(screen.getByText(/modestly upside-skewed/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cumulative FCF · 3y" }));
    expect(screen.getByText(/modestly downside-skewed/)).toBeTruthy();
    expect(screen.getByText(/the next-widest factor/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Minimum cash · 3y" }));
    expect(screen.getByText(/roughly symmetric/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Interest cover · FY28e" }));
    expect(screen.getByText(/moves the outcome/).textContent).toContain("—");
  });
});
