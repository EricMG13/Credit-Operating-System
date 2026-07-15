// @vitest-environment jsdom
// M-1/M-2 regression: useLiveRun used to call the value-only useLatestRun
// wrapper, which collapses a genuine backend ERROR (listRuns rejects) and a
// truly empty/no-coverage issuer (listRuns resolves []) into the exact same
// `EMPTY` value — a caller had no way to tell "backend is down" apart from
// "this issuer just has no runs yet". The fix switches to useLatestRunStatus
// and threads its `phase` through useLiveRun's return shape. This test fails
// if that swap is reverted, because both scenarios would then be
// indistinguishable to the caller.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useLiveRun } from "./useLiveRun";
import { getModules, getQA, getRun, listRuns } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  listRuns: vi.fn(),
  getRun: vi.fn(),
  getModules: vi.fn(),
  getModule: vi.fn(),
  getQA: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useLiveRun · phase (M-1/M-2 regression)", () => {
  it("exposes a backend error as a distinct phase from empty/no-coverage", async () => {
    // Backend/network failure — listRuns throws.
    vi.mocked(listRuns).mockRejectedValueOnce(new Error("network down"));
    const errRun = renderHook(() => useLiveRun("issuer-err"));
    await waitFor(() => expect(errRun.result.current.phase).toBe("error"));
    expect(errRun.result.current.liveOuts).toEqual({});
    expect(errRun.result.current.runId).toBeNull();

    // Genuine no-coverage issuer — listRuns resolves with no runs at all.
    vi.mocked(listRuns).mockResolvedValueOnce([]);
    const emptyRun = renderHook(() => useLiveRun("issuer-empty"));
    await waitFor(() => expect(emptyRun.result.current.phase).toBe("none"));

    // Both collapse to the same empty-looking value fields, but the phase
    // must distinguish "backend error" from "no coverage yet".
    expect(errRun.result.current.phase).not.toBe(emptyRun.result.current.phase);
  });

  it("loads the exact URL-bound run instead of substituting the latest run", async () => {
    vi.mocked(getRun).mockResolvedValue({
      id: "run-exact",
      issuer_id: "issuer-exact",
      status: "complete",
      qa_status: "Restricted",
      committee_status: "Restricted",
      as_of_date: "2026-06-30",
      model_id: null,
      prompt_version: null,
      error: null,
      modules: [],
    });
    vi.mocked(getModules).mockResolvedValue([]);
    vi.mocked(getQA).mockResolvedValue({
      run_id: "run-exact",
      qa_status: "Restricted",
      committee_status: "Restricted",
      findings_by_severity: {},
      findings: [],
    });

    const exact = renderHook(() => useLiveRun("issuer-exact", "run-exact"));
    await waitFor(() => expect(exact.result.current.phase).toBe("complete"));

    expect(exact.result.current.runId).toBe("run-exact");
    expect(getRun).toHaveBeenCalledWith("run-exact");
    expect(listRuns).not.toHaveBeenCalled();
  });
});
