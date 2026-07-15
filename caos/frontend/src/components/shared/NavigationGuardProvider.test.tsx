// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NavigationGuardProvider,
  useNavigationAttempt,
  useNavigationGuard,
} from "./NavigationGuardProvider";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

beforeAll(() => {
  // useModalA11y filters hidden controls through offsetParent; jsdom has no layout.
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    get() { return document.body; },
    configurable: true,
  });
});

beforeEach(() => {
  navigation.push.mockReset();
  navigation.replace.mockReset();
  window.history.replaceState({}, "", "/model");
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/model");
  vi.restoreAllMocks();
});

function Harness({
  dirty,
  enabled,
  onDiscard,
  onProgrammatic,
}: {
  dirty: boolean;
  enabled: boolean;
  onDiscard: () => void;
  onProgrammatic: () => void;
}) {
  useNavigationGuard({ dirty, enabled, onDiscard });
  const attemptNavigation = useNavigationAttempt();
  return (
    <div>
      <a href="/reports?issuer=issuer-1#memo">Open reports</a>
      <button type="button" onClick={() => attemptNavigation(onProgrammatic)}>Programmatic leave</button>
    </div>
  );
}

function renderHarness(props: Partial<React.ComponentProps<typeof Harness>> = {}) {
  const defaults: React.ComponentProps<typeof Harness> = {
    dirty: true,
    enabled: true,
    onDiscard: vi.fn(),
    onProgrammatic: vi.fn(),
  };
  const all = { ...defaults, ...props };
  const view = render(
    <NavigationGuardProvider>
      <Harness {...all} />
    </NavigationGuardProvider>,
  );
  return { ...view, props: all };
}

describe("NavigationGuardProvider", () => {
  it.each([
    { dirty: false, enabled: true, label: "clean" },
    { dirty: true, enabled: false, label: "preference off" },
  ])("runs programmatic navigation immediately when $label", ({ dirty, enabled }) => {
    const onProgrammatic = vi.fn();
    renderHarness({ dirty, enabled, onProgrammatic });

    fireEvent.click(screen.getByRole("button", { name: "Programmatic leave" }));

    expect(onProgrammatic).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("installs beforeunload only while dirty and enabled", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const onDiscard = vi.fn();
    const onProgrammatic = vi.fn();
    const view = renderHarness({ dirty: false, enabled: true, onDiscard, onProgrammatic });
    expect(add.mock.calls.filter(([name]) => name === "beforeunload")).toHaveLength(0);

    view.rerender(
      <NavigationGuardProvider>
        <Harness dirty enabled onDiscard={onDiscard} onProgrammatic={onProgrammatic} />
      </NavigationGuardProvider>,
    );
    expect(add.mock.calls.filter(([name]) => name === "beforeunload")).toHaveLength(1);
    const event = new Event("beforeunload", { cancelable: true });
    expect(window.dispatchEvent(event)).toBe(false);
    expect(event.defaultPrevented).toBe(true);

    view.rerender(
      <NavigationGuardProvider>
        <Harness dirty enabled={false} onDiscard={onDiscard} onProgrammatic={onProgrammatic} />
      </NavigationGuardProvider>,
    );
    expect(remove.mock.calls.filter(([name]) => name === "beforeunload")).toHaveLength(1);
  });

  it("guards same-origin anchors and Escape means Stay with focus restored", () => {
    const onDiscard = vi.fn();
    renderHarness({ onDiscard });
    const link = screen.getByRole("link", { name: "Open reports" });
    link.focus();

    fireEvent.click(link);

    expect(navigation.push).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Leave with unsaved changes?" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Stay" }));

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(link);
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("traps focus and discards before continuing the same-origin anchor", () => {
    const onDiscard = vi.fn();
    renderHarness({ onDiscard });
    fireEvent.click(screen.getByRole("link", { name: "Open reports" }));
    const stay = screen.getByRole("button", { name: "Stay" });
    const discard = screen.getByRole("button", { name: "Discard & leave" });

    discard.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(stay);
    fireEvent.click(discard);

    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(navigation.push).toHaveBeenCalledWith("/reports?issuer=issuer-1#memo");
  });

  it("guards a programmatic attempt and never calls discard when the user stays", () => {
    const onDiscard = vi.fn();
    const onProgrammatic = vi.fn();
    renderHarness({ onDiscard, onProgrammatic });

    fireEvent.click(screen.getByRole("button", { name: "Programmatic leave" }));
    expect(onProgrammatic).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    expect(onDiscard).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Programmatic leave" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard & leave" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onProgrammatic).toHaveBeenCalledTimes(1);
  });

  it("bounces Back, then resumes it only after Discard & leave", () => {
    const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    const onDiscard = vi.fn();
    const view = renderHarness({ onDiscard });
    const priorState = window.history.state;
    window.history.pushState({ page: "current" }, "", "/model?step=2");
    const currentState = window.history.state;

    fireEvent(window, new PopStateEvent("popstate", { state: priorState }));
    expect(go).toHaveBeenLastCalledWith(1);
    expect(screen.queryByRole("dialog")).toBeNull();

    // Next may transiently unmount the leaving route before the history bounce
    // returns. The guard snapshot from the original Back attempt still owns the
    // decision and discard callback.
    const onProgrammatic = vi.fn();
    view.rerender(
      <NavigationGuardProvider>
        <Harness dirty={false} enabled onDiscard={onDiscard} onProgrammatic={onProgrammatic} />
      </NavigationGuardProvider>,
    );
    fireEvent(window, new PopStateEvent("popstate", { state: currentState }));
    expect(screen.getByRole("dialog", { name: "Leave with unsaved changes?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Discard & leave" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenLastCalledWith(-1);
  });

  it("bounces Forward, then resumes it only after Discard & leave", () => {
    const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    const onDiscard = vi.fn();
    const onProgrammatic = vi.fn();
    const view = renderHarness({ dirty: false, onDiscard, onProgrammatic });
    const currentState = window.history.state;
    window.history.pushState({ page: "forward" }, "", "/reports");
    const forwardState = window.history.state;
    fireEvent(window, new PopStateEvent("popstate", { state: currentState }));

    view.rerender(
      <NavigationGuardProvider>
        <Harness dirty enabled onDiscard={onDiscard} onProgrammatic={onProgrammatic} />
      </NavigationGuardProvider>,
    );
    fireEvent(window, new PopStateEvent("popstate", { state: forwardState }));
    expect(go).toHaveBeenLastCalledWith(-1);
    fireEvent(window, new PopStateEvent("popstate", { state: currentState }));
    expect(screen.getByRole("dialog", { name: "Leave with unsaved changes?" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Discard & leave" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenLastCalledWith(1);
  });
});
