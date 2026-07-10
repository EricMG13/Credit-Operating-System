// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useVirtualScroll } from "./useVirtualScroll";

describe("useVirtualScroll", () => {
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
});
