// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { useResizeObserver } from "./use-resize-observer";
import { afterEach, describe, it, expect, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useResizeObserver", () => {
  it("should initialize with 0 dimensions", () => {
    const { result } = renderHook(() => useResizeObserver<HTMLDivElement>());
    expect(result.current[1]).toEqual({ width: 0, height: 0 });
  });

  it("does nothing when ResizeObserver is unavailable on an attached element", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    function Harness() {
      const [ref, dimensions] = useResizeObserver<HTMLDivElement>();
      return createElement("div", { ref }, `${dimensions.width}×${dimensions.height}`);
    }
    const { getByText } = render(createElement(Harness));
    expect(getByText("0×0")).toBeTruthy();
  });

  it("ignores absent and empty observer entry batches", () => {
    let notify: ResizeObserverCallback = () => undefined;
    class Observer {
      constructor(callback: ResizeObserverCallback) {
        notify = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", Observer);

    function Harness() {
      const [ref, dimensions] = useResizeObserver<HTMLDivElement>();
      return createElement("div", { ref }, `${dimensions.width}×${dimensions.height}`);
    }
    const { getByText } = render(createElement(Harness));
    act(() => {
      notify(undefined as unknown as ResizeObserverEntry[], {} as ResizeObserver);
      notify([], {} as ResizeObserver);
    });
    expect(getByText("0×0")).toBeTruthy();
  });

  it("updates dimensions from a non-empty observer batch", () => {
    let notify: ResizeObserverCallback = () => undefined;
    class Observer {
      constructor(callback: ResizeObserverCallback) { notify = callback; }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", Observer);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    function Harness() {
      const [ref, dimensions] = useResizeObserver<HTMLDivElement>();
      return createElement("div", { ref }, `${dimensions.width}×${dimensions.height}`);
    }
    const { getByText } = render(createElement(Harness));
    act(() => {
      notify([{ contentRect: { width: 320, height: 180 } } as ResizeObserverEntry], {} as ResizeObserver);
    });
    expect(getByText("320×180")).toBeTruthy();
  });
});
