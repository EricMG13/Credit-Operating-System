// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

// M-7: `import("@antv/g2").then(...)` had no `.catch`. A failed dynamic
// import (network blip, CDN issue, chunk-load error after a deploy) became
// an unhandled promise rejection while the chart silently never rendered —
// no user-visible explanation. Simulate that failure by making the dynamic
// import of the charting library reject, and assert the component surfaces
// the same "CHART UNAVAILABLE" dead-frame it already uses for a failed
// build/render, instead of leaving a blank/crashed component.
vi.mock("@antv/g2", () => {
  throw new Error("Loading chunk @antv/g2 failed");
});

import { G2Chart } from "./G2Chart";

beforeAll(() => {
  // jsdom has no ResizeObserver; G2Chart constructs one unconditionally on
  // mount (before the dynamic import settles), so it must exist for the
  // effect to run at all.
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("G2Chart dynamic import failure (M-7)", () => {
  it("renders a visible fallback instead of silently failing when @antv/g2 fails to load", async () => {
    render(<G2Chart spec={{ type: "interval", data: [], encode: {} }} />);

    await waitFor(() => {
      expect(screen.getByText("CHART UNAVAILABLE")).toBeTruthy();
    });
  });
});
