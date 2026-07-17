// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBreakpoint } from "./useBreakpoint";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useBreakpoint", () => {
  it("computes every breakpoint and coalesces media changes through animation frames", () => {
    const matches = [true, false, false];
    let onChange = () => {};
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 7; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(window, "matchMedia").mockImplementation((query) => {
      const index = query.includes("1280") ? 0 : query.includes("1024") ? 1 : 2;
      return {
        get matches() { return matches[index]; }, media: query, onchange: null,
        addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
          onChange = listener as () => void;
        },
        removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
      };
    });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toEqual({ breakpoint: "wide", hydrated: true });
    matches.splice(0, 3, false, true, false);
    act(() => onChange());
    expect(result.current.breakpoint).toBe("desktop");
    matches.splice(0, 3, false, false, true);
    act(() => onChange());
    expect(result.current.breakpoint).toBe("tablet");
    matches.splice(0, 3, false, false, false);
    act(() => onChange());
    expect(result.current.breakpoint).toBe("mobile");
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it("keeps the pre-hydration default when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toEqual({ breakpoint: "wide", hydrated: false });
  });
});
