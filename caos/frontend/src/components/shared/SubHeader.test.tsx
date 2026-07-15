// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { SubHeader, nextCollapseState } from "./SubHeader";

vi.mock("@/lib/useBreakpoint", () => ({
  useBreakpoint: () => ({ breakpoint: "wide", hydrated: true }),
}));

afterEach(cleanup);

describe("nextCollapseState — hysteresis", () => {
  const base = { collapsed: false, neededWidth: null };

  it("collapses and records the needed width on overflow", () => {
    expect(nextCollapseState(base, { scrollWidth: 900, clientWidth: 800 })).toEqual({
      collapsed: true,
      neededWidth: 900,
    });
  });

  it("stays collapsed while width is still below the recorded need", () => {
    const collapsed = { collapsed: true, neededWidth: 900 };
    // Content shrank (it's in the drawer now) but the header is still narrow.
    expect(nextCollapseState(collapsed, { scrollWidth: 400, clientWidth: 850 })).toEqual(collapsed);
  });

  it("re-expands only once the header clears the recorded need", () => {
    const collapsed = { collapsed: true, neededWidth: 900 };
    expect(nextCollapseState(collapsed, { scrollWidth: 400, clientWidth: 900 })).toEqual({
      collapsed: false,
      neededWidth: null,
    });
  });

  it("does not collapse when content fits", () => {
    expect(nextCollapseState(base, { scrollWidth: 700, clientWidth: 800 })).toBe(base);
  });
});

describe("SubHeader — slots", () => {
  it("keeps the primary action in the document and renders inline controls at wide", () => {
    render(
      <SubHeader
        identity={<span>Identity</span>}
        primaryAction={<button type="button">Save</button>}
        contextualControls={<span>Filters</span>}
      />,
    );
    expect(screen.getByRole("button", { name: "Save" }).closest("[data-page-primary-action]")).toBeTruthy();
    expect(screen.getByText("Filters")).toBeTruthy();
  });
});
