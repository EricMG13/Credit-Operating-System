// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const refHarness = vi.hoisted(() => ({
  call: 0,
  trigger: { current: null as HTMLElement | null },
  panel: { current: document.createElement("div") as HTMLElement | null },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useRef: () => {
      const ref = refHarness.call % 2 === 0 ? refHarness.trigger : refHarness.panel;
      refHarness.call += 1;
      return ref;
    },
  };
});

import { useState } from "react";
import { MoreDrawer } from "./MoreDrawer";

const rafCallbacks: FrameRequestCallback[] = [];

function Harness({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <MoreDrawer open={open} onOpenChange={setOpen}>{children}</MoreDrawer>;
}

beforeEach(() => {
  refHarness.call = 0;
  refHarness.trigger.current = null;
  refHarness.panel.current = document.createElement("div");
  rafCallbacks.length = 0;
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
    rafCallbacks.push(callback);
    return rafCallbacks.length;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn(() => undefined));
  Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: () => document.body });
  HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 32, width: 100, height: 32,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("runs the deferred portal-focus job and focuses its first control", async () => {
  render(<Harness><button>First action</button></Harness>);
  fireEvent.click(screen.getByRole("button", { name: "Open More" }));
  await screen.findByRole("dialog", { name: "More" });
  expect(rafCallbacks).toHaveLength(1);

  act(() => rafCallbacks.shift()?.(0));
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "First action" }));
});

it("falls back to the panel when it has no focusable children", async () => {
  render(<Harness>Read-only context</Harness>);
  fireEvent.click(screen.getByRole("button", { name: "Open More" }));
  const dialog = await screen.findByRole("dialog", { name: "More" });
  expect(rafCallbacks).toHaveLength(1);
  act(() => rafCallbacks.shift()?.(0));

  expect(document.activeElement).toBe(dialog);
  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(dialog.textContent).toContain("Read-only context");
});

it("recaptures Tab when the document reports no active element", async () => {
  render(<Harness><button>First action</button></Harness>);
  fireEvent.click(screen.getByRole("button", { name: "Open More" }));
  const dialog = await screen.findByRole("dialog", { name: "More" });
  act(() => rafCallbacks.shift()?.(0));

  const active = vi.spyOn(document, "activeElement", "get").mockReturnValue(null);
  fireEvent.keyDown(dialog, { key: "Tab" });
  active.mockRestore();
  expect(screen.getByRole("button", { name: "First action" })).toBeTruthy();
});

it("drops a queued focus job after the drawer closes", async () => {
  render(<Harness><button>First action</button></Harness>);
  const trigger = screen.getByRole("button", { name: "Open More" });
  fireEvent.click(trigger);
  await screen.findByRole("dialog", { name: "More" });
  expect(rafCallbacks).toHaveLength(1);

  fireEvent.click(trigger);
  act(() => rafCallbacks.shift()?.(0));
  expect(screen.queryByRole("dialog", { name: "More" })).toBeNull();
});
