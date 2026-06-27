// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";

vi.mock("@/lib/api", () => ({ scenarioFromNL: vi.fn() }));

import { scenarioFromNL } from "@/lib/api";
import { ScenarioPanel } from "./ScenarioPanel";
import { buildModel } from "@/lib/reports/model";

const model = buildModel(); // real seeded BASE/DOWN forecast

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("ScenarioPanel", () => {
  it("renders the three-case comparison, the tornado, and the builder", () => {
    render(<ScenarioPanel model={model} />);
    expect(screen.getByText(/Best · base · worst/)).toBeTruthy();
    expect(screen.getByText("Sensitivity — tornado")).toBeTruthy();
    expect(screen.getByText("Scenario builder")).toBeTruthy();
    expect(screen.getByLabelText("Describe a scenario")).toBeTruthy();
  });

  it("applying a preset re-centers the lens and shows the active chip + reset", () => {
    render(<ScenarioPanel model={model} />);
    expect(screen.queryByText("↶ RESET")).toBeNull();
    fireEvent.click(screen.getByText("Rate hike +200bps"));
    // active scenario chip appears twice (comparison header ▸ + builder card)
    expect(screen.getAllByText("Rate hike +200bps").length).toBeGreaterThan(1);
    const reset = screen.getByText("↶ RESET");
    expect(reset).toBeTruthy();
    expect(screen.getByText("+200bps rate")).toBeTruthy(); // delta summary
    fireEvent.click(reset);
    expect(screen.queryByText("↶ RESET")).toBeNull(); // reverted to module forecasts
  });

  it("switching the tornado output metric is reflected in the selector state", () => {
    render(<ScenarioPanel model={model} />);
    const cumFcf = screen.getByText("Cumulative FCF · 3y");
    fireEvent.click(cumFcf);
    expect(cumFcf.className).toContain("border-caos-accent"); // selected styling
  });

  it("builds a scenario from natural language via the API", async () => {
    vi.mocked(scenarioFromNL).mockResolvedValue({
      rev_growth_delta: 0, margin_delta: -0.02, capex_delta: 0, rate_delta: 0.005,
      label: "Oil shock", rationale: "Energy input costs compress margin.",
    });
    render(<ScenarioPanel model={model} />);
    fireEvent.change(screen.getByLabelText("Describe a scenario"), { target: { value: "oil shock" } });
    fireEvent.click(screen.getByText("BUILD"));
    await waitFor(() => expect(scenarioFromNL).toHaveBeenCalledWith("oil shock"));
    const card = screen.getByText("Energy input costs compress margin.").closest("div")!;
    expect(within(card.parentElement!).getByText("Oil shock")).toBeTruthy();
  });
});
