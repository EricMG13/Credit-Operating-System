// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { DecisionHeader } from "./DecisionHeader";

let mockRole = "pm";
vi.mock("./RoleViewProvider", () => ({
  useRoleView: () => ({ roleView: mockRole, setRoleView: () => {}, ready: true }),
}));

afterEach(cleanup);

describe("DecisionHeader", () => {
  it("renders explicit '— no data' for empty cells (never hides them)", () => {
    mockRole = "pm";
    render(<DecisionHeader whatChanged="3 repricings" />);
    expect(screen.getByText("3 repricings")).toBeTruthy();
    expect(screen.getAllByText("— no data")).toHaveLength(3);
  });

  it("renders a Provenance-shaped evidenceHealth cell as a grammar chip", () => {
    mockRole = "pm";
    render(
      <DecisionHeader
        evidenceHealth={{ origin: "LIVE", freshness: "STALE", detail: "3 stale of 12" }}
      />,
    );
    expect(screen.getByText("LIVE")).toBeTruthy();
    expect(screen.getByText("STALE")).toBeTruthy();
  });

  it("PM view opens expanded; Analyst view opens collapsed; toggle overrides", () => {
    mockRole = "pm";
    render(<DecisionHeader whatChanged="x" />);
    expect(screen.getByRole("button", { expanded: true })).toBeTruthy();
    cleanup();

    mockRole = "analyst";
    render(<DecisionHeader whatChanged="x" />);
    const btn = screen.getByRole("button", { expanded: false });
    expect(screen.queryByText("x")).toBeNull();
    fireEvent.click(btn);
    expect(screen.getByRole("button", { expanded: true })).toBeTruthy();
    expect(screen.getByText("x")).toBeTruthy();
  });
});
