// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: (...args: unknown[]) => get(...args) },
  toErrorMessage: (_reason: unknown, fallback: string) => fallback,
}));

import { useQaFindings } from "./useQaFindings";

beforeEach(() => {
  get.mockReset();
  vi.useFakeTimers();
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useQaFindings", () => {
  it("stays idle while disabled", () => {
    const { result } = renderHook(() => useQaFindings(false));
    expect(result.current).toMatchObject({ findings: [], loading: false, loaded: false });
    expect(get).not.toHaveBeenCalled();
  });

  it("loads, refreshes while visible, and refreshes on focus", async () => {
    const finding = { id: "finding-1" };
    get.mockResolvedValue({ data: [finding] });
    const { result } = renderHook(() => useQaFindings(true));
    expect(result.current.loading).toBe(true);
    await act(async () => {});
    expect(result.current).toMatchObject({ findings: [finding], loading: false, loaded: true });

    await act(async () => { vi.advanceTimersByTime(60_000); });
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("skips hidden interval refreshes and preserves findings on an error", async () => {
    get
      .mockResolvedValueOnce({ data: [{ id: "finding-1" }] })
      .mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useQaFindings(true));
    await act(async () => {});
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(get).toHaveBeenCalledTimes(1);

    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(result.current.findings).toEqual([{ id: "finding-1" }]);
    expect(result.current.error).toBe("Live CP-5 findings unavailable.");
  });

  it("ignores a rejection after unmount", async () => {
    let reject!: (reason: Error) => void;
    get.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
    const hook = renderHook(() => useQaFindings(true));
    hook.unmount();
    await act(async () => { reject(new Error("late")); });
    expect(get).toHaveBeenCalledTimes(1);
  });
});
