// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnterprisePage, type PageAction } from "./EnterprisePage";

vi.mock("@/lib/useBreakpoint", () => ({
  useBreakpoint: () => ({ breakpoint: "wide", hydrated: true }),
}));
vi.mock("./AnalysisContextStrip", () => ({ AnalysisContextStrip: () => null }));

afterEach(cleanup);

const shell = (primaryAction?: PageAction) => render(
  <EnterprisePage
    kind="object"
    identity={<span>Contract route</span>}
    primaryAction={primaryAction}
    narrowContract={{ essentialControls: null }}
  >
    <div>Route body</div>
  </EnterprisePage>,
);

const interactiveDescendants = (element: HTMLElement) => element.querySelectorAll(
  "a[href], button, input, select, textarea, [role='button'], [tabindex]:not([tabindex='-1'])",
);

describe("EnterprisePage typed page actions", () => {
  it("renders exactly one link for an available href action", () => {
    const { container } = shell({ label: "Open evidence", href: "/deepdive?issuer=issuer-1" });
    const region = container.querySelector<HTMLElement>("#page-actions")!;
    expect(within(region).getByRole("link", { name: "Open evidence" }).getAttribute("href")).toBe("/deepdive?issuer=issuer-1");
    expect(interactiveDescendants(region)).toHaveLength(1);
  });

  it("renders exactly one button for an available callback action", () => {
    const onAction = vi.fn();
    const { container } = shell({ label: "Save checkpoint", onAction, title: "Save and create an immutable checkpoint" });
    const region = container.querySelector<HTMLElement>("#page-actions")!;
    const button = within(region).getByRole("button", { name: "Save checkpoint" });
    expect(button.getAttribute("title")).toBe("Save and create an immutable checkpoint");
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledOnce();
    expect(interactiveDescendants(region)).toHaveLength(1);
  });

  it("keeps the accessible label stable when a callback becomes unavailable", () => {
    const onAction = vi.fn();
    const view = shell({ label: "Publish reviewed preview", onAction, title: "Publish the frozen report" });
    expect(screen.getByRole("button", { name: "Publish reviewed preview" }).getAttribute("title")).toBe("Publish the frozen report");

    view.rerender(
      <EnterprisePage
        kind="object"
        identity={<span>Contract route</span>}
        primaryAction={{ label: "Publish reviewed preview", onAction, title: "Publish the frozen report", unavailableReason: "Publication is in progress…" }}
        narrowContract={{ essentialControls: null }}
      >
        <div>Route body</div>
      </EnterprisePage>,
    );
    const button = screen.getByRole("button", { name: "Publish reviewed preview" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("title")).toBe("Publication is in progress…");
    fireEvent.click(button);
    expect(onAction).not.toHaveBeenCalled();
  });

  it.each([
    ["callback", { label: "Publish reviewed preview", onAction: vi.fn(), unavailableReason: "Save a checkpoint first" } satisfies PageAction],
    ["href", { label: "Open selected run", href: "/deepdive?run=run-1", unavailableReason: "Select a run first" } satisfies PageAction],
  ])("keeps an unavailable %s action focusable, named, explained, inert, and not native-disabled", (_kind, action) => {
    const { container } = shell(action);
    const region = container.querySelector<HTMLElement>("#page-actions")!;
    const button = within(region).getByRole("button", { name: action.label }) as HTMLButtonElement;
    button.focus();
    expect(document.activeElement).toBe(button);
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("title")).toBe(action.unavailableReason);
    expect(button.getAttribute("aria-describedby")).toBeTruthy();
    fireEvent.click(button);
    expect(screen.getByRole("status").textContent).toBe(action.unavailableReason);
    if ("onAction" in action) expect(action.onAction).not.toHaveBeenCalled();
    expect(interactiveDescendants(region)).toHaveLength(1);
  });

  it("keeps the honest focusable no-action target when no operation applies", () => {
    const { container } = shell();
    const region = container.querySelector<HTMLElement>("#page-actions")!;
    expect(region.textContent).toContain("No page actions available");
    expect(region.getAttribute("tabindex")).toBe("-1");
    expect(interactiveDescendants(region)).toHaveLength(0);
    region.focus();
    expect(document.activeElement).toBe(region);
  });
});

const validHrefAction = { label: "Open report", href: "/reports" } satisfies PageAction;
const validCallbackAction = { label: "Save", onAction: () => undefined } satisfies PageAction;
void validHrefAction;
void validCallbackAction;

// @ts-expect-error A page action must not expose two immediate effects.
const actionWithTwoEffects: PageAction = { label: "Ambiguous", href: "/reports", onAction: () => undefined };
// @ts-expect-error A page action must expose one immediate effect.
const actionWithNoEffect: PageAction = { label: "No effect" };
void actionWithTwoEffects;
void actionWithNoEffect;
