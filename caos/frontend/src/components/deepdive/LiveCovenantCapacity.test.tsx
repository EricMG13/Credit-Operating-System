// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LiveCovenantCapacity } from "./LiveCovenantCapacity";

afterEach(cleanup);

describe("LiveCovenantCapacity", () => {
  it("renders only finite live CP-4C values", () => {
    render(<LiveCovenantCapacity signals={{
      rp_basket_musd: 150,
      covenant_headroom_turns: 0.72,
      addback_cap_pct: 0.25,
      addback_utilization_pct: 112,
      addback_breach: true,
    }} />);
    expect(screen.getByText("$150M")).toBeTruthy();
    expect(screen.getByText("0.72x")).toBeTruthy();
    expect(screen.getByText("25%")).toBeTruthy();
    expect(screen.getByText("112% utilized")).toBeTruthy();
  });

  it("degrades honestly when CP-4C extracted no capacity terms", () => {
    render(<LiveCovenantCapacity signals={{ rp_basket_musd: Number.NaN }} />);
    expect(screen.getByText(/did not extract live basket-capacity terms/)).toBeTruthy();
  });

  it("renders honest placeholders and non-critical states for partially extracted capacity", () => {
    const { rerender } = render(<LiveCovenantCapacity signals={{
      rp_basket_musd: null,
      covenant_headroom_turns: 1.25,
      addback_cap_pct: null,
      addback_utilization_pct: null,
      addback_breach: false,
    }} />);
    expect(screen.getByText("1.25x")).toBeTruthy();
    expect(screen.getByText("utilization unavailable")).toBeTruthy();
    expect(screen.getAllByText("—")).toHaveLength(2);

    rerender(<LiveCovenantCapacity signals={{
      rp_basket_musd: 0,
      covenant_headroom_turns: null,
      addback_cap_pct: 0.2,
      addback_utilization_pct: 50,
      addback_breach: false,
    }} />);
    expect(screen.getByText("$0M")).toBeTruthy();
    expect(screen.getByText("50% utilized")).toBeTruthy();
  });
});
