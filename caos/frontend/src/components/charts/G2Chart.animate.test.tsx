// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { act, render, cleanup, screen, waitFor } from "@testing-library/react";

// G2's default enter animation (scaleInY on intervals) draws through rAF; in
// an occluded/backgrounded pane rAF starves and the chart freezes mid-flight —
// segments at their correct offsets but a fraction of their extent, labels
// already at final positions (the 2026-07-16 "seniority stack scattered on
// the paper" defect). Every painted frame must be final geometry: the wrapper
// defaults animate:false, and a spec may opt back in.
const optionCalls: Array<Record<string, unknown>> = [];
const constructorCalls: unknown[] = [];
let renderMode: "resolve" | "reject" | "pending-reject" | "throw" = "resolve";
let rejectPendingRender: ((reason: unknown) => void) | null = null;
let destroyThrows = false;
let resizeCallback: ResizeObserverCallback | null = null;
vi.mock("@antv/g2", () => ({
  Chart: class {
    constructor(opts: unknown) { constructorCalls.push(opts); }
    options(o: Record<string, unknown>) { optionCalls.push(o); }
    render() {
      if (renderMode === "throw") throw new Error("render threw");
      if (renderMode === "reject") return Promise.reject(new Error("render rejected"));
      if (renderMode === "pending-reject") return new Promise((_, reject) => { rejectPendingRender = reject; });
      return Promise.resolve();
    }
    destroy() { if (destroyThrows) throw new Error("destroy failed"); }
  },
}));

import { G2Chart } from "./G2Chart";

beforeAll(() => {
  global.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) { resizeCallback = callback; }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  optionCalls.length = 0;
  constructorCalls.length = 0;
  renderMode = "resolve";
  rejectPendingRender = null;
  destroyThrows = false;
  resizeCallback = null;
  vi.clearAllMocks();
});

describe("G2Chart animation default", () => {
  it("passes animate:false to chart.options when the spec does not opt in", async () => {
    render(<G2Chart spec={{ type: "interval", data: [], encode: {} }} />);
    await waitFor(() => expect(optionCalls.length).toBeGreaterThan(0), { timeout: 3000 });
    expect(optionCalls[optionCalls.length - 1].animate).toBe(false);
  });

  it("lets a spec explicitly opt back in to animation", async () => {
    render(<G2Chart spec={{ type: "interval", data: [], encode: {}, animate: true }} />);
    await waitFor(() => expect(optionCalls.length).toBeGreaterThan(0), { timeout: 3000 });
    expect(optionCalls[optionCalls.length - 1].animate).toBe(true);
  });

  it("rebuilds only after a material observed container resize", async () => {
    let width = 400;
    const clientWidth = vi.spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(() => width);
    const view = render(<G2Chart spec={{ type: "interval", data: [], encode: {} }} />);
    await waitFor(() => expect(constructorCalls).toHaveLength(1), { timeout: 3000 });

    width = 401;
    act(() => resizeCallback?.([], {} as ResizeObserver));
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(constructorCalls).toHaveLength(1);

    width = 0;
    act(() => resizeCallback?.([], {} as ResizeObserver));
    await waitFor(() => expect(constructorCalls).toHaveLength(2));

    width = 520;
    act(() => resizeCallback?.([], {} as ResizeObserver));
    await waitFor(() => expect(constructorCalls).toHaveLength(3));

    view.unmount();
    act(() => resizeCallback?.([], {} as ResizeObserver));
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(constructorCalls).toHaveLength(3);
    clientWidth.mockRestore();
  });

  it("uses the window resize fallback when ResizeObserver is unavailable", async () => {
    let width = 360;
    const clientWidth = vi.spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(() => width);
    const Observer = global.ResizeObserver;
    Object.defineProperty(global, "ResizeObserver", { configurable: true, value: undefined });
    const view = render(<G2Chart mode="paper" spec={{ type: "interval", data: [], encode: {} }} />);
    await waitFor(() => expect(constructorCalls).toHaveLength(1), { timeout: 3000 });

    width = 480;
    act(() => window.dispatchEvent(new Event("resize")));
    await waitFor(() => expect(constructorCalls).toHaveLength(2));

    view.unmount();
    Object.defineProperty(global, "ResizeObserver", { configurable: true, value: Observer });
    clientWidth.mockRestore();
  });

  it.each(["throw", "reject"] as const)("surfaces a chart render that %ss", async (mode) => {
    renderMode = mode;
    render(<G2Chart spec={{ type: "interval", data: [], encode: {} }} />);
    expect(await screen.findByText("CHART UNAVAILABLE", {}, { timeout: 3000 })).toBeTruthy();
  });

  it("keeps reduced motion authoritative and merges tooltip CSS with an invalid-mode fallback", async () => {
    const matchMedia = vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    render(<G2Chart mode={"invalid" as never} spec={{
      type: "interval",
      data: [],
      animate: true,
      tooltip: { css: { ".custom": { color: "red" } } },
    }} />);

    await waitFor(() => expect(optionCalls).toHaveLength(1), { timeout: 3000 });
    expect(optionCalls[0].animate).toBe(false);
    expect(optionCalls[0].theme).toEqual({ type: "classicDark", view: { viewFill: "transparent" } });
    expect(optionCalls[0].tooltip).toEqual(expect.objectContaining({
      css: expect.objectContaining({ ".custom": { color: "red" } }),
    }));
    matchMedia.mockRestore();
  });

  it("ignores a render rejection that arrives after unmount", async () => {
    renderMode = "pending-reject";
    const view = render(<G2Chart spec={{ type: "interval", data: [] }} />);
    await waitFor(() => expect(rejectPendingRender).not.toBeNull(), { timeout: 3000 });
    view.unmount();
    await act(async () => rejectPendingRender?.(new Error("late rejection")));
    expect(screen.queryByText("CHART UNAVAILABLE")).toBeNull();
  });

  it("tolerates destroy failures during failure, rebuild, and cleanup", async () => {
    let width = 400;
    const clientWidth = vi.spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(() => width);
    destroyThrows = true;
    const view = render(<G2Chart spec={{ type: "interval", data: [] }} />);
    await waitFor(() => expect(constructorCalls).toHaveLength(1), { timeout: 3000 });

    width = 520;
    act(() => resizeCallback?.([], {} as ResizeObserver));
    await waitFor(() => expect(constructorCalls).toHaveLength(2));
    view.unmount();

    renderMode = "reject";
    render(<G2Chart spec={{ type: "line", data: [] }} />);
    expect(await screen.findByText("CHART UNAVAILABLE", {}, { timeout: 3000 })).toBeTruthy();
    clientWidth.mockRestore();
  });

  it("drops a dynamic import completion after immediate unmount", async () => {
    const view = render(<G2Chart spec={{ type: "interval", data: [] }} />);
    view.unmount();
    await act(async () => { await Promise.resolve(); });
    expect(constructorCalls).toHaveLength(0);
  });

  it("drops a queued settle callback after unmount even if timer cancellation loses the race", async () => {
    vi.useFakeTimers();
    const clear = vi.spyOn(globalThis, "clearTimeout").mockImplementation(() => undefined);
    const view = render(<G2Chart spec={{ type: "interval", data: [] }} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(constructorCalls).toHaveLength(0);
    clear.mockRestore();
    vi.useRealTimers();
  });
});
