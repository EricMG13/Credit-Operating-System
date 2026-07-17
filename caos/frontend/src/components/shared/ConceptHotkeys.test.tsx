// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { ConceptHotkeys } from "./ConceptHotkeys";
import { CONCEPT_CYCLE } from "@/lib/nav";
import {
  NavigationGuardProvider,
  useNavigationGuard,
} from "./NavigationGuardProvider";

const push = vi.fn();
const discard = vi.fn();

afterEach(() => {
  cleanup();
  push.mockClear();
  discard.mockClear();
});

// Mock useRouter and usePathname from next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (href: string) => push(href),
  }),
  usePathname: () => "/command",
}));

function DirtyModelGuard() {
  useNavigationGuard({ dirty: true, enabled: true, onDiscard: discard });
  return null;
}

function renderHotkeys({ dirty = false }: { dirty?: boolean } = {}) {
  return render(
    <NavigationGuardProvider>
      {dirty ? <DirtyModelGuard /> : null}
      <ConceptHotkeys />
    </NavigationGuardProvider>,
  );
}

describe("ConceptHotkeys", () => {
  it("opens the unified palette with Alt+S and ignores editable targets", () => {
    const listener = vi.fn();
    window.addEventListener("caos:command-palette-open", listener);
    renderHotkeys();

    fireEvent.keyDown(window, { key: "s", code: "KeyS", altKey: true });
    expect(listener).toHaveBeenCalledOnce();

    for (const element of [document.createElement("input"), document.createElement("textarea"), document.createElement("select")]) {
      fireEvent.keyDown(element, { key: "s", code: "KeyS", altKey: true });
    }
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener("caos:command-palette-open", listener);
  });

  it("fires Alt chords by physical key — macOS resolves Option+letter to a composed character", () => {
    // On macOS Chrome, Alt+S arrives as key:"ß" / Alt+K as "˚" / Alt+C as "ç";
    // matching on e.key left every advertised chord dead on the desk's
    // primary platform. e.code is layout-positional and survives it.
    const palette = vi.fn();
    const collapse = vi.fn();
    window.addEventListener("caos:command-palette-open", palette);
    window.addEventListener("caos:collapse-toggle", collapse);
    renderHotkeys();
    fireEvent.keyDown(window, { key: "ß", code: "KeyS", altKey: true });
    fireEvent.keyDown(window, { key: "ç", code: "KeyC", altKey: true });
    expect(palette).toHaveBeenCalledOnce();
    expect(collapse).toHaveBeenCalledOnce();
    window.removeEventListener("caos:command-palette-open", palette);
    window.removeEventListener("caos:collapse-toggle", collapse);
  });

  it("dispatches caos:subview-cycle event on Alt+Comma", () => {
    const listener = vi.fn();
    window.addEventListener("caos:subview-cycle", listener);

    renderHotkeys();

    const event = new KeyboardEvent("keydown", {
      key: ",",
      code: "Comma",
      altKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(listener).toHaveBeenCalled();
    const callArg = listener.mock.calls[0][0] as CustomEvent;
    expect(callArg.detail.direction).toBe(-1);

    window.removeEventListener("caos:subview-cycle", listener);
  });

  it("cycles Alt+ArrowRight to the registry neighbor of the current route", () => {
    push.mockClear();
    renderHotkeys();

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true }),
    );

    const cur = CONCEPT_CYCLE.indexOf("/command");
    expect(cur).toBeGreaterThanOrEqual(0);
    expect(push).toHaveBeenCalledWith(CONCEPT_CYCLE[(cur + 1) % CONCEPT_CYCLE.length]);
  });

  it("routes concept-cycle navigation through the unsaved-edit guard", async () => {
    push.mockClear();
    discard.mockClear();
    renderHotkeys({ dirty: true });

    fireEvent.keyDown(window, { key: "ArrowRight", altKey: true });

    expect(push).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog", { name: "Leave with unsaved changes?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Discard & leave" }));
    expect(discard).toHaveBeenCalledOnce();
    const cur = CONCEPT_CYCLE.indexOf("/command");
    expect(push).toHaveBeenCalledWith(
      CONCEPT_CYCLE[(cur + 1) % CONCEPT_CYCLE.length],
    );
  });

  it("dispatches caos:subview-cycle event on Alt+Period", () => {
    const listener = vi.fn();
    window.addEventListener("caos:subview-cycle", listener);

    renderHotkeys();

    const event = new KeyboardEvent("keydown", {
      key: ".",
      code: "Period",
      altKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(listener).toHaveBeenCalled();
    const callArg = listener.mock.calls[0][0] as CustomEvent;
    expect(callArg.detail.direction).toBe(1);

    window.removeEventListener("caos:subview-cycle", listener);
  });
});
