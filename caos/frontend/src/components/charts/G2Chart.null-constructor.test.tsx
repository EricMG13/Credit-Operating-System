// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@antv/g2", () => ({ Chart: null }));

import { G2Chart } from "./G2Chart";

beforeEach(() => {
  vi.useFakeTimers();
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("does not build when a loaded chart module has no constructor", async () => {
  render(<G2Chart spec={{ type: "interval", data: [] }} />);
  await act(async () => {
    await Promise.resolve();
    await vi.runAllTimersAsync();
  });

  expect(screen.queryByText("CHART UNAVAILABLE")).toBeNull();
});
