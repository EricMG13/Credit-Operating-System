// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useVirtualScroll } from "./useVirtualScroll";

describe("useVirtualScroll", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it("should initialize correctly", () => {
    const ref = { current: typeof document !== "undefined" ? document.createElement("div") : null };
    const { result } = renderHook(() =>
      useVirtualScroll({
        itemCount: 100,
        estimateHeight: 30,
        overscan: 5,
        containerRef: ref,
      })
    );

    expect(result.current.startIndex).toBe(0);
    expect(result.current.paddingTop).toBe(0);
  });

  it("tolerates an unattached ref", () => {
    const { result } = renderHook(() => useVirtualScroll({ itemCount: 0, containerRef: { current: null } }));
    expect(result.current.endIndex).toBe(-1);
  });

  it("tracks scroll and resize events when ResizeObserver is unavailable", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const element = document.createElement("div");
    Object.defineProperty(element, "clientHeight", { configurable: true, value: 64 });
    const ref = { current: element };
    const hook = renderHook(() => useVirtualScroll({ itemCount: 100, estimateHeight: 10, overscan: 1, containerRef: ref }));
    Object.defineProperty(element, "scrollTop", { configurable: true, value: 100 });
    act(() => element.dispatchEvent(new Event("scroll")));
    expect(hook.result.current.startIndex).toBe(9);
    act(() => window.dispatchEvent(new Event("resize")));
    hook.unmount();
  });

  it("observes container resizes and disconnects on unmount", () => {
    let notify = () => {};
    const disconnect = vi.fn();
    class Observer {
      constructor(callback: () => void) { notify = callback; }
      observe() {}
      disconnect() { disconnect(); }
    }
    vi.stubGlobal("ResizeObserver", Observer);
    const element = document.createElement("div");
    const hook = renderHook(() => useVirtualScroll({ itemCount: 10, containerRef: { current: element } }));
    act(() => notify());
    hook.unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
