// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SurfaceState, type SurfaceStateKind } from "./SurfaceState";

afterEach(cleanup);

describe("SurfaceState", () => {
  it.each([
    ["loading", "Loading"],
    ["empty", "No observed data"],
    ["unavailable", "Unavailable"],
    ["stale", "Stale"],
    ["partial", "Partial"],
    ["offline", "Offline"],
    ["error", "Error"],
  ] satisfies [SurfaceStateKind, string][])("renders %s with a text status", (kind, label) => {
    const { container } = render(<SurfaceState kind={kind} title="State title" detail="State detail" />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText("State title")).toBeTruthy();
    expect(container.querySelector(`[data-surface-state="${kind}"]`)).toBeTruthy();
  });

  it("renders caller-owned recovery actions without inventing authority", () => {
    render(
      <SurfaceState
        kind="partial"
        title="Coverage incomplete"
        primaryAction={<button type="button">Retry coverage</button>}
        secondaryAction={<a href="/evidence">Review evidence</a>}
      />,
    );
    expect(screen.getByRole("button", { name: "Retry coverage" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review evidence" })).toBeTruthy();
  });
});
