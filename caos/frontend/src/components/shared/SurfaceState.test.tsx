// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SurfaceState, type SurfaceStateKind } from "./SurfaceState";

afterEach(cleanup);

describe("SurfaceState", () => {
  it.each([
    ["loading", "Loading"],
    ["checking", "Checking"],
    ["not-run", "Not yet run"],
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

  it("'not-run' is a distinct fact from 'empty' — never a stand-in for either loading or a verified-empty result", () => {
    // The exact conflation that let a still-loading fetch assert an
    // authoritative empty result (Sector Review's P0): "not-run" must render
    // with its own idle-not-live presentation, not inherit loading's
    // aria-live announcement or empty's "was observed" framing.
    const { container } = render(<SurfaceState kind="not-run" title="No versioned dossier" />);
    expect(screen.getByText("Not yet run")).toBeTruthy();
    expect(screen.queryByText("No observed data")).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it.each(["loading", "checking"] satisfies SurfaceStateKind[])(
    "%s is announced live (role=status, aria-live=polite) and pulses",
    (kind) => {
      const { container } = render(<SurfaceState kind={kind} title="State title" />);
      const section = container.querySelector(`[data-surface-state="${kind}"]`);
      expect(section?.getAttribute("role")).toBe("status");
      expect(section?.getAttribute("aria-live")).toBe("polite");
      expect(container.querySelector(".caos-running")).toBeTruthy();
    },
  );

  it("non-live kinds are not announced and do not pulse", () => {
    const { container } = render(<SurfaceState kind="not-run" title="State title" />);
    const section = container.querySelector('[data-surface-state="not-run"]');
    expect(section?.getAttribute("role")).toBeNull();
    expect(section?.hasAttribute("aria-live")).toBe(false);
    expect(container.querySelector(".caos-running")).toBeNull();
  });

  it("supports a contextual heading level without changing the default", () => {
    const { rerender } = render(<SurfaceState kind="empty" title="Route section" headingLevel={2} />);
    expect(screen.getByRole("heading", { level: 2, name: "Route section" })).toBeTruthy();

    rerender(<SurfaceState kind="empty" title="Nested section" />);
    expect(screen.getByRole("heading", { level: 3, name: "Nested section" })).toBeTruthy();
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
