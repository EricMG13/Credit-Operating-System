// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutonomyDraft } from "./useAutonomyDraft";

const getAutonomyDraft = vi.fn();
vi.mock("@/lib/api", () => ({
  getAutonomyDraft: (...a: unknown[]) => getAutonomyDraft(...a),
}));

// Fake timers + testing-library's `waitFor` don't mix (waitFor polls on real
// timers and hangs) — every assertion here instead flushes pending promises
// with a bare `await act(async () => {})`, same pattern as
// RoleViewProvider.test.tsx's debounce tests.

beforeEach(() => {
  vi.useFakeTimers();
  getAutonomyDraft.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

const EMPTY_DRAFT = {
  status: "draft", ai_generated: true, ratified: false, export_allowed: false,
  marking: "AI-GENERATED, UNRATIFIED", sections: [],
  summary: { n_sections: 0, n_claims: 0, n_deterministic_bullets: 0, n_anomalies: 0 },
  refreshing: false,
};

describe("useAutonomyDraft", () => {
  it("resolves the draft and stops polling when refreshing is false", async () => {
    getAutonomyDraft.mockResolvedValue(EMPTY_DRAFT);
    const { result } = renderHook(() => useAutonomyDraft());
    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(result.current.draft).toEqual(EMPTY_DRAFT);
    expect(result.current.offline).toBe(false);
    expect(getAutonomyDraft).toHaveBeenCalledWith(true);

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(getAutonomyDraft).toHaveBeenCalledTimes(1); // no poll — settled
  });

  it("polls while refreshing is true, stops once a later fetch settles", async () => {
    getAutonomyDraft
      .mockResolvedValueOnce({ ...EMPTY_DRAFT, refreshing: true })
      .mockResolvedValueOnce({ ...EMPTY_DRAFT, refreshing: true })
      .mockResolvedValueOnce({ ...EMPTY_DRAFT, refreshing: false });
    const { result } = renderHook(() => useAutonomyDraft());
    await act(async () => {});
    expect(getAutonomyDraft).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(getAutonomyDraft).toHaveBeenCalledTimes(2);
    expect(getAutonomyDraft).toHaveBeenLastCalledWith();

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(getAutonomyDraft).toHaveBeenCalledTimes(3);
    expect(result.current.draft?.refreshing).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(getAutonomyDraft).toHaveBeenCalledTimes(3); // settled — no further polls
  });

  it("distinguishes OFFLINE (fetch throws) from EMPTY-LIVE (resolves with empty sections)", async () => {
    getAutonomyDraft.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useAutonomyDraft());
    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(result.current.offline).toBe(true);
    expect(result.current.draft).toBeNull();
  });

  it("falls back to read-only GET when the caller cannot request a refresh", async () => {
    getAutonomyDraft
      .mockRejectedValueOnce(new Error("403 read-only"))
      .mockResolvedValueOnce(EMPTY_DRAFT);
    const { result } = renderHook(() => useAutonomyDraft());
    await act(async () => {});
    expect(getAutonomyDraft).toHaveBeenNthCalledWith(1, true);
    expect(getAutonomyDraft).toHaveBeenNthCalledWith(2);
    expect(result.current.offline).toBe(false);
    expect(result.current.draft).toEqual(EMPTY_DRAFT);
  });

  it("ignores a response that settles after unmount", async () => {
    let resolve!: (draft: typeof EMPTY_DRAFT) => void;
    getAutonomyDraft.mockReturnValue(new Promise((done) => { resolve = done; }));
    const hook = renderHook(() => useAutonomyDraft());
    hook.unmount();
    await act(async () => { resolve(EMPTY_DRAFT); });
    expect(getAutonomyDraft).toHaveBeenCalledTimes(1);
  });

  it("ignores a rejection after unmount", async () => {
    let reject!: (reason: Error) => void;
    getAutonomyDraft.mockReturnValue(new Promise((_done, fail) => { reject = fail; }));
    const hook = renderHook(() => useAutonomyDraft());
    hook.unmount();
    await act(async () => { reject(new Error("late")); });
  });

  it("clears a scheduled poll when unmounted while refreshing", async () => {
    getAutonomyDraft.mockResolvedValue({ ...EMPTY_DRAFT, refreshing: true });
    const hook = renderHook(() => useAutonomyDraft());
    await act(async () => {});
    hook.unmount();
    await act(async () => { vi.advanceTimersByTime(4000); });
    expect(getAutonomyDraft).toHaveBeenCalledTimes(1);
  });
});
