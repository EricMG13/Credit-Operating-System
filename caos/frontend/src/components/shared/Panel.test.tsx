// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Panel } from "./Panel";

type ObserverCallback = (records?: MutationRecord[]) => void;

class ResizeObserverMock {
  static callbacks = new Set<ObserverCallback>();
  callback: ObserverCallback;
  constructor(callback: ObserverCallback) {
    this.callback = callback;
    ResizeObserverMock.callbacks.add(callback);
  }
  observe() {}
  disconnect() { ResizeObserverMock.callbacks.delete(this.callback); }
  static flush() { for (const callback of ResizeObserverMock.callbacks) callback(); }
}

class MutationObserverMock {
  static callbacks = new Set<ObserverCallback>();
  callback: ObserverCallback;
  constructor(callback: ObserverCallback) {
    this.callback = callback;
    MutationObserverMock.callbacks.add(callback);
  }
  observe() {}
  disconnect() { MutationObserverMock.callbacks.delete(this.callback); }
  static flush() { for (const callback of MutationObserverMock.callbacks) callback([]); }
}

function setBox(element: HTMLElement, scrollHeight: number, clientHeight: number) {
  Object.defineProperty(element, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(element, "clientHeight", { configurable: true, value: clientHeight });
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("MutationObserver", MutationObserverMock);
});

afterEach(() => {
  cleanup();
  ResizeObserverMock.callbacks.clear();
  MutationObserverMock.callbacks.clear();
  vi.unstubAllGlobals();
});

describe("Panel focus-safe scroll owner", () => {
  it("adds a named visible focus target only when content genuinely overflows", () => {
    const { container } = render(<Panel title="Report lineage"><div>Evidence rows</div></Panel>);
    const body = container.querySelector(".overflow-auto") as HTMLDivElement;
    setBox(body, 100, 100);
    act(() => ResizeObserverMock.flush());
    expect(body.hasAttribute("tabindex")).toBe(false);
    expect(body.hasAttribute("aria-label")).toBe(false);
    expect(body.className).not.toContain("focus-ring");

    setBox(body, 240, 100);
    act(() => ResizeObserverMock.flush());
    expect(body.tabIndex).toBe(0);
    expect(body.getAttribute("aria-label")).toBe("Report lineage");
    expect(body.className).toContain("focus-ring");
  });

  it("treats horizontal clipping as a named keyboard scroll owner", () => {
    const { container } = render(<Panel title="Issuer register"><div>Wide register</div></Panel>);
    const body = container.querySelector(".overflow-auto") as HTMLDivElement;
    setBox(body, 100, 100);
    Object.defineProperty(body, "scrollWidth", { configurable: true, value: 240 });
    Object.defineProperty(body, "clientWidth", { configurable: true, value: 100 });
    act(() => ResizeObserverMock.flush());
    expect(body.tabIndex).toBe(0);
    expect(body.getAttribute("aria-label")).toBe("Issuer register");
  });

  it("remeasures overflow-to-fit on resize without moving focus", () => {
    const { container } = render(<Panel title="Report preview"><div>Report</div></Panel>);
    const body = container.querySelector(".overflow-auto") as HTMLDivElement;
    const sentinel = document.createElement("button");
    document.body.appendChild(sentinel);
    sentinel.focus();
    setBox(body, 240, 100);
    act(() => ResizeObserverMock.flush());
    expect(body.tabIndex).toBe(0);
    setBox(body, 100, 100);
    act(() => ResizeObserverMock.flush());
    expect(body.hasAttribute("tabindex")).toBe(false);
    expect(document.activeElement).toBe(sentinel);
    sentinel.remove();
  });

  it("remeasures late content mutations in both directions", () => {
    const { container } = render(<Panel title="Late report"><div>Initial</div></Panel>);
    const body = container.querySelector(".overflow-auto") as HTMLDivElement;
    setBox(body, 100, 100);
    act(() => MutationObserverMock.flush());
    expect(body.hasAttribute("tabindex")).toBe(false);
    setBox(body, 180, 100);
    act(() => MutationObserverMock.flush());
    expect(body.tabIndex).toBe(0);
    setBox(body, 90, 100);
    act(() => MutationObserverMock.flush());
    expect(body.hasAttribute("tabindex")).toBe(false);
  });

  it("disconnects the scroll owner while collapsed and remeasures when expanded", () => {
    const { container } = render(<Panel title="Collapsible evidence" collapsible><div>Rows</div></Panel>);
    let body = container.querySelector(".overflow-auto") as HTMLDivElement;
    setBox(body, 180, 100);
    act(() => ResizeObserverMock.flush());
    expect(body.tabIndex).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Collapse Collapsible evidence panel" }));
    expect(container.querySelector(".overflow-auto")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand Collapsible evidence panel" }));
    body = container.querySelector(".overflow-auto") as HTMLDivElement;
    setBox(body, 100, 100);
    act(() => ResizeObserverMock.flush());
    expect(body.hasAttribute("tabindex")).toBe(false);
  });
});
