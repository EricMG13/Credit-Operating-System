// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef, useState } from "react";
import type { ZoomTransform } from "d3-zoom";

const d3 = vi.hoisted(() => ({
  duration: vi.fn(),
  select: vi.fn(),
  transform: vi.fn(),
  zoomHandler: null as ((event: { transform: unknown }) => void) | null,
}));

vi.mock("d3-selection", () => ({
  select: d3.select,
}));
vi.mock("d3-zoom", () => ({
  zoom: () => {
    const behavior = Object.assign(vi.fn(), {
      scaleExtent: vi.fn(),
      on: vi.fn(),
      transform: d3.transform,
    });
    behavior.scaleExtent.mockReturnValue(behavior);
    behavior.on.mockImplementation((_name: string, handler: typeof d3.zoomHandler) => {
      d3.zoomHandler = handler;
      return behavior;
    });
    return behavior;
  },
}));
vi.mock("d3-transition", () => ({}));

import { useGraphZoom } from "./useGraphZoom";

const fit = { k: 1, x: 2, y: 3, apply: vi.fn(), applyX: vi.fn(), applyY: vi.fn(), invert: vi.fn(), invertX: vi.fn(), invertY: vi.fn(), rescaleX: vi.fn(), rescaleY: vi.fn(), scale: vi.fn(), translate: vi.fn(), toString: vi.fn() } as unknown as ZoomTransform;

function Harness({ renderSvg = true }: { renderSvg?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState<ZoomTransform>(fit);
  const reset = useGraphZoom(ref, fit, "key", setTransform);
  return <>{renderSvg ? <svg ref={ref} /> : null}<button onClick={reset}>reset</button><span data-testid="transform">{String((transform as { k: number }).k)}</span></>;
}

beforeEach(() => {
  const selection = {
    call: vi.fn(function (this: unknown, fn: (...args: unknown[]) => unknown, ...args: unknown[]) { fn(this, ...args); return this; }),
    transition: vi.fn(),
    duration: d3.duration,
  };
  selection.transition.mockReturnValue(selection);
  selection.duration.mockReturnValue(selection);
  d3.select.mockReturnValue(selection);
  d3.transform.mockImplementation(() => undefined);
  d3.zoomHandler = null;
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("useGraphZoom", () => {
  it("binds the zoom behavior, propagates transforms, and animates reset", () => {
    render(<Harness />);
    expect(d3.select).toHaveBeenCalled();
    act(() => d3.zoomHandler?.({ transform: { ...fit, k: 2 } }));
    expect(screen.getByTestId("transform").textContent).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "reset" }));
    expect(d3.duration).toHaveBeenCalledWith(180);
    expect(d3.transform).toHaveBeenCalled();
  });

  it("uses zero-duration reset for reduced motion and tolerates a missing svg", () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "reset" }));
    expect(d3.duration).toHaveBeenCalledWith(0);
    cleanup();
    d3.select.mockClear();
    render(<Harness renderSvg={false} />);
    fireEvent.click(screen.getByRole("button", { name: "reset" }));
    expect(d3.select).not.toHaveBeenCalled();
  });
});
