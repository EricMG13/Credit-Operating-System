// @vitest-environment jsdom
// Regression for M-4: useModelEngine used the value-only useLatestRun wrapper,
// so a genuine backend error (listRuns throwing — no backend / network / 5xx)
// collapsed into the exact same {anchor:null, live:false, loading:false}
// shape as a truly empty issuer (backend reachable, zero runs). Switching to
// useLatestRunStatus and threading its RunPhase through as an additive
// `phase` field lets a caller tell the two apart.
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useModelEngine } from "./useModelEngine";
import { listRuns } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  listRuns: vi.fn(),
  getModule: vi.fn(),
}));

describe("useModelEngine · phase (M-4)", () => {
  it("distinguishes a backend error from genuine no-coverage", async () => {
    // Genuine no-coverage: backend reachable, issuer has zero runs.
    vi.mocked(listRuns).mockResolvedValueOnce([]);
    const noCoverage = renderHook(() => useModelEngine("issuer-empty"));
    await waitFor(() => expect(noCoverage.result.current.loading).toBe(false));
    expect(noCoverage.result.current.phase).toBe("none");

    // Backend error: listRuns throws (no backend / network / 5xx).
    vi.mocked(listRuns).mockRejectedValueOnce(new Error("network error"));
    const backendError = renderHook(() => useModelEngine("issuer-error"));
    await waitFor(() => expect(backendError.result.current.loading).toBe(false));
    expect(backendError.result.current.phase).toBe("error");

    // The pre-fix value-only contract collapsed both cases to an identical
    // shape (proved below); `phase` is what now tells them apart.
    expect(backendError.result.current.phase).not.toBe(noCoverage.result.current.phase);
    const { phase: _p1, ...noCoverageRest } = noCoverage.result.current;
    const { phase: _p2, ...backendErrorRest } = backendError.result.current;
    expect(noCoverageRest).toEqual(backendErrorRest);
    expect(noCoverageRest).toEqual({
      anchor: null, downside: null, runId: null, committeeStatus: null, live: false, loading: false,
    });
  });
});
