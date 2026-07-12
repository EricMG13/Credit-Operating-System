// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LaneRouter } from "./LaneRouter";

afterEach(cleanup);

describe("LaneRouter", () => {
  it("shows the routed lane and the matched-rule reason", () => {
    render(<LaneRouter choice={{ lane: "metric", reason: "ranking language" }} onOverride={() => {}} />);
    expect(screen.getByText("METRIC SCAN")).toBeTruthy();
    expect(screen.getByText("ranking language")).toBeTruthy();
    expect(screen.getByRole("button", { name: "reroute: GRAPH WALK" })).toBeTruthy();
  });

  it("clicking reroute overrides to the OTHER lane, not the current one", () => {
    const onOverride = vi.fn();
    render(<LaneRouter choice={{ lane: "graph", reason: "default" }} onOverride={onOverride} />);
    fireEvent.click(screen.getByRole("button", { name: "reroute: METRIC SCAN" }));
    expect(onOverride).toHaveBeenCalledWith("metric");
  });
});
