// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";

// G2's default enter animation (scaleInY on intervals) draws through rAF; in
// an occluded/backgrounded pane rAF starves and the chart freezes mid-flight —
// segments at their correct offsets but a fraction of their extent, labels
// already at final positions (the 2026-07-16 "seniority stack scattered on
// the paper" defect). Every painted frame must be final geometry: the wrapper
// defaults animate:false, and a spec may opt back in.
const optionCalls: Array<Record<string, unknown>> = [];
vi.mock("@antv/g2", () => ({
  Chart: class {
    constructor(_opts: unknown) {}
    options(o: Record<string, unknown>) { optionCalls.push(o); }
    render() { return Promise.resolve(); }
    destroy() {}
  },
}));

import { G2Chart } from "./G2Chart";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  optionCalls.length = 0;
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
});
