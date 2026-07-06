// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { useResizeObserver } from "./use-resize-observer";
import { describe, it, expect } from "vitest";

describe("useResizeObserver", () => {
  it("should initialize with 0 dimensions", () => {
    const { result } = renderHook(() => useResizeObserver<HTMLDivElement>());
    expect(result.current[1]).toEqual({ width: 0, height: 0 });
  });
});
