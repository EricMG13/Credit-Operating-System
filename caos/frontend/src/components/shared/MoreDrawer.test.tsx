// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { MoreDrawer } from "./MoreDrawer";

function Harness({ align = "right" }: { align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  return <div><MoreDrawer open={open} onOpenChange={setOpen} triggerLabel="Utilities" align={align}>
    <button>First action</button><button>Last action</button>
  </MoreDrawer><button>Outside</button></div>;
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => (
    window.setTimeout(() => callback(performance.now()), 0)
  ));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
  Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: () => document.body });
  HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 20, y: 10, top: 10, left: 20, right: 120, bottom: 40, width: 100, height: 30,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MoreDrawer", () => {
  it("anchors on either edge and toggles from its trigger", async () => {
    const { rerender } = render(<Harness align="right" />);
    const trigger = screen.getByRole("button", { name: "Open Utilities" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Utilities" });
    expect(dialog.style.top).toBe("44px");
    expect(dialog.style.right).toBe(`${window.innerWidth - 120}px`);
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(<Harness align="left" />);
    fireEvent.click(screen.getByRole("button", { name: "Open Utilities" }));
    expect((await screen.findByRole("dialog", { name: "Utilities" })).style.left).toBe("20px");
  });

  it("traps focus and closes for escape, outside pointer, resize, and page scroll", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open Utilities" });
    const open = async () => {
      fireEvent.click(trigger);
      return screen.findByRole("dialog", { name: "Utilities" });
    };
    const dialog = await open();
    const first = screen.getByRole("button", { name: "First action" });
    const last = screen.getByRole("button", { name: "Last action" });
    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    dialog.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    screen.getByRole("button", { name: "Outside" }).focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(dialog, { key: "ArrowDown" });

    fireEvent.pointerDown(first);
    fireEvent.scroll(dialog);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await open();
    fireEvent.pointerDown(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await open();
    fireEvent(window, new Event("resize"));
    expect(screen.queryByRole("dialog")).toBeNull();

    await open();
    fireEvent.scroll(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("focuses the drawer itself when it contains no focusable controls", async () => {
    function EmptyHarness() {
      const [open, setOpen] = useState(false);
      return <MoreDrawer open={open} onOpenChange={setOpen}>Read-only context</MoreDrawer>;
    }
    render(<EmptyHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open More" }));
    const dialog = await screen.findByRole("dialog", { name: "More" });
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(dialog.textContent).toContain("Read-only context");
  });
});
