// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { ScenarioPanel } from "./ScenarioPanel";
import { buildModel } from "@/lib/reports/model";

// The only async/network dep: the NL → driver-deltas endpoint. Mock it so the
// builder is deterministic and never touches the wire.
vi.mock("@/lib/api", () => ({ scenarioFromNL: vi.fn() }));
import { scenarioFromNL } from "@/lib/api";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Deterministic, fully-derived model from the seeded build (no args needed).
const model = buildModel();

describe("ScenarioPanel", () => {
  it("separates model and propagation modes without erasing model scenario state", () => {
    render(<ScenarioPanel model={model} />);
    const modelTab = screen.getByRole("tab", { name: "Model scenario" });
    const networkTab = screen.getByRole("tab", { name: "Cross-module propagation" });
    expect(modelTab.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Rate hike +200bps" }));

    fireEvent.click(networkTab);
    expect(networkTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText(/completed run required/i)).toBeTruthy();

    fireEvent.click(modelTab);
    expect(screen.getByText("+200bps rate")).toBeTruthy();
  });

  it("renders the panel and the best/base/worst comparison with the given model", () => {
    render(<ScenarioPanel model={model} />);

    // Panel chrome + the three scenario columns + the net-leverage trajectory.
    expect(
      screen.getByText("Scenario & Sensitivity · forward cash-flow lens")
    ).toBeTruthy();
    expect(screen.getByText("Best")).toBeTruthy();
    expect(screen.getByText("Base")).toBeTruthy();
    expect(screen.getByText("Worst")).toBeTruthy();
    expect(screen.getByText("Net leverage")).toBeTruthy();

    // No custom scenario applied yet → the builder shows its idle hint, not a card.
    expect(
      screen.getByText(/Apply a scenario to re-center base/i)
    ).toBeTruthy();
    expect(screen.queryByText(/RESET/)).toBeNull();
  });

  it("applying a preset re-centers the lens: shows the active card + delta summary, and RESET reverts", () => {
    render(<ScenarioPanel model={model} />);

    // Click the "Rate hike +200bps" preset → onApply fires, scenario becomes active.
    fireEvent.click(screen.getByRole("button", { name: "Rate hike +200bps" }));

    // The active card surfaces the human-readable driver delta (rate 0.02 → +200bps).
    expect(screen.getByText("+200bps rate")).toBeTruthy();
    // The re-centered badge appears in the comparison header.
    expect(screen.getByTitle(/Re-centered on scenario: Rate hike \+200bps/)).toBeTruthy();

    // RESET reverts to module forecasts (active cleared, idle hint back).
    const reset = screen.getByRole("button", { name: /RESET/ });
    fireEvent.click(reset);
    expect(screen.queryByText("+200bps rate")).toBeNull();
    expect(screen.getByText(/Apply a scenario to re-center base/i)).toBeTruthy();
  });

  it("changing the tornado output metric updates the visible base read", () => {
    render(<ScenarioPanel model={model} />);

    // Default metric is net leverage ("x" unit) → base reads like "1.23x".
    const baseBefore = screen.getByText(/^base /).textContent ?? "";
    expect(baseBefore).toMatch(/x$/);

    // Switch the tornado output to a $-unit metric → the base read re-renders in $M.
    fireEvent.click(screen.getByRole("button", { name: "Cumulative FCF · 3y" }));
    const baseAfter = screen.getByText(/^base /).textContent ?? "";
    expect(baseAfter).toContain("$");
    expect(baseAfter).not.toBe(baseBefore);
  });

  it("the NL builder applies the mocked scenarioFromNL result", async () => {
    vi.mocked(scenarioFromNL).mockResolvedValue({
      rev_growth_delta: -0.05,
      margin_delta: 0,
      capex_delta: 0,
      rate_delta: 0.01,
      label: "Oil shock",
      rationale: "Energy-led demand hit.",
    });

    render(<ScenarioPanel model={model} />);

    const input = screen.getByLabelText("Describe a scenario") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "oil shock" } });
    fireEvent.click(screen.getByRole("button", { name: "BUILD" }));

    expect(scenarioFromNL).toHaveBeenCalledWith("oil shock");

    // The resolved scenario becomes the active card (label + rationale shown).
    await waitFor(() => expect(screen.getByText("Oil shock")).toBeTruthy());
    expect(screen.getByText("Energy-led demand hit.")).toBeTruthy();
    // Driver deltas summarized: -5pp rev growth and +100bps rate.
    const card = screen.getByText("Oil shock").closest("div")!.parentElement!;
    expect(within(card).getByText(/−5pp rev growth/)).toBeTruthy();
    expect(within(card).getByText(/\+100bps rate/)).toBeTruthy();
  });

  it("surfaces an error when scenarioFromNL rejects, without applying a scenario", async () => {
    vi.mocked(scenarioFromNL).mockRejectedValue(new Error("couldn't parse that"));

    render(<ScenarioPanel model={model} />);

    const input = screen.getByLabelText("Describe a scenario") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "gibberish" } });
    fireEvent.click(screen.getByRole("button", { name: "BUILD" }));

    await waitFor(() => expect(screen.getByText(/couldn't parse that/)).toBeTruthy());
    // Still on module forecasts — no active card / RESET.
    expect(screen.queryByText(/RESET/)).toBeNull();
  });
});
