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
import { getModule, listRuns } from "@/lib/api";
import type { ModuleDetailDTO } from "./types";

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
      anchor: null, downside: null, downsideState: "unavailable", runId: null, committeeStatus: null, live: false, loading: false,
    });
  });

  it("treats only a CP-2B 404 as optional", async () => {
    vi.mocked(listRuns).mockResolvedValue([{
      id: "run-1", issuer_id: "issuer-1", status: "complete", qa_status: "Passed",
      committee_status: "Committee Ready", as_of_date: null, created_at: "2026-07-16T00:00:00Z",
    }]);
    const cp1 = {
      module_id: "CP-1", module_name: "CP-1", owned_object: "financials", schema_family: "Nested",
      confidence: "High", qa_status: "Passed", committee_status: "Committee Ready",
      validation_status: "Passed", limitation_flags: [], downstream_consumers: [], claims: [],
      runtime_output: { normalized_financials: {
        revenue: { LTM: 100 }, adj_ebitda: { LTM: 20 }, net_debt_ltm: 80,
        net_leverage_adj_ltm: 4, interest_coverage_ltm: 2,
      } },
    } as ModuleDetailDTO;
    vi.mocked(getModule)
      .mockResolvedValueOnce(cp1)
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 404 } });

    const missing = renderHook(() => useModelEngine("issuer-1"));
    await waitFor(() => expect(missing.result.current.phase).toBe("complete"));
    expect(missing.result.current.anchor?.ltmRevenue).toBe(100);
    expect(missing.result.current.downside).toBeNull();
    expect(missing.result.current.downsideState).toBe("unavailable");

    vi.mocked(listRuns).mockResolvedValueOnce([{
      id: "run-2", issuer_id: "issuer-2", status: "complete", qa_status: "Passed",
      committee_status: "Committee Ready", as_of_date: null, created_at: "2026-07-16T00:00:00Z",
    }]);
    vi.mocked(getModule)
      .mockResolvedValueOnce(cp1)
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 500 } });
    const broken = renderHook(() => useModelEngine("issuer-2"));
    await waitFor(() => expect(broken.result.current.phase).toBe("complete"));
    expect(broken.result.current.anchor?.ltmRevenue).toBe(100);
    expect(broken.result.current.downside).toBeNull();
    expect(broken.result.current.downsideState).toBe("error");
  });
});
