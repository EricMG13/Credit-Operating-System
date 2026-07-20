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

  it("surfaces a module fetch failure instead of a blank successful run", async () => {
    vi.mocked(listRuns).mockResolvedValueOnce([{
      id: "run-broken",
      issuer_id: "issuer-broken",
      status: "complete",
      qa_status: "Passed",
      committee_status: "Committee Ready",
      as_of_date: null,
      created_at: "2026-07-16T00:00:00Z",
    }]);
    vi.mocked(getModules).mockRejectedValueOnce(new Error("module payload unavailable"));

    const result = renderHook(() => useLiveRun("issuer-broken"));
    await waitFor(() => expect(result.result.current.phase).toBe("error"));
    expect(result.result.current.runId).toBeNull();
    expect(result.result.current.liveOuts).toEqual({});
  });

  it("surfaces a QA fallback failure instead of reporting a complete blank council", async () => {
    vi.mocked(listRuns).mockResolvedValueOnce([{
      id: "run-qa-broken", issuer_id: "issuer-qa", status: "complete",
      qa_status: "Restricted", committee_status: "Restricted", as_of_date: null,
      created_at: "2026-07-16T00:00:00Z",
    }]);
    vi.mocked(getModules).mockResolvedValueOnce([]);
    vi.mocked(getQA).mockRejectedValueOnce(new Error("QA unavailable"));

    const result = renderHook(() => useLiveRun("issuer-qa"));
    await waitFor(() => expect(result.result.current.phase).toBe("error"));
    expect(result.result.current.runId).toBeNull();
  });

  it("adapts eligible modules, indexes evidence, and reads the typed CP-5C issue log", async () => {
    vi.mocked(listRuns).mockResolvedValueOnce([{
      id: "run-live", issuer_id: "issuer-live", status: "complete",
      qa_status: "Restricted", committee_status: "Restricted", as_of_date: null,
      created_at: "2026-07-18T12:00:00Z",
    }]);
    vi.mocked(getModules).mockResolvedValueOnce([
      {
        module_id: "CP-1", module_name: "CanonicalDataFoundation", owned_object: "financials", schema_family: "Nested",
        runtime_output: {}, confidence: "High", qa_status: "Passed", committee_status: "Restricted",
        validation_status: "Passed", limitation_flags: [], downstream_consumers: [],
        claims: [{
          claim_id: "C-1", claim_text: "EBITDA reconciles.", evidence: [{
            evidence_id: "E-1", extraction_type: "quoted_text", lineage_class: "Direct",
            source_locator: "D-1 p.2", confidence: "High", document_chunk_id: "chunk-1",
          }],
        }],
      },
      {
        module_id: "CP-Z", module_name: "Ignored", owned_object: null, schema_family: "Nested",
        runtime_output: {}, confidence: "Low", qa_status: "Not Reviewed", committee_status: "Restricted",
        validation_status: "Passed", limitation_flags: [], downstream_consumers: [], claims: [],
      },
      {
        module_id: "CP-5C", module_name: "Council", owned_object: null, schema_family: "Nested",
        runtime_output: { issue_log: [
          { id: "IC-1", severity: "MAJOR", lane: 2, module: "CP-1", finding: "Reconcile add-backs", claim: "C-1" },
          { id: null, severity: null, lane: "two", module: 5, finding: null, claim: 7 },
        ] },
        confidence: "High", qa_status: "Restricted", committee_status: "Restricted",
        validation_status: "Passed", limitation_flags: [], downstream_consumers: [], claims: [],
      },
    ]);

    const result = renderHook(() => useLiveRun("issuer-live"));
    await waitFor(() => expect(result.result.current.phase).toBe("complete"));
    expect(result.result.current.runId).toBe("run-live");
    expect(result.result.current.asOf).toBe("2026-07-18T12:00:00Z");
    expect(result.result.current.liveStatus).toEqual({ "CP-1": "Passed" });
    expect(result.result.current.liveEvidence["E-1"]).toMatchObject({ module: "CP-1", claim: "EBITDA reconciles." });
    expect(result.result.current.liveOuts["CP-1"]).toBeTruthy();
    expect(result.result.current.liveOuts["CP-Z"]).toBeUndefined();
    expect(result.result.current.council).toEqual([
      expect.objectContaining({ finding_id: "IC-1", severity: "MAJOR", lane: 2, module_id: "CP-1", affected_claim_id: "C-1" }),
      expect.objectContaining({ finding_id: "", severity: "MINOR", lane: null, module_id: null, description: "", affected_claim_id: null }),
    ]);
    expect(getQA).not.toHaveBeenCalled();
  });

  it("falls back to legacy QA findings and tolerates a module without claims", async () => {
    vi.mocked(listRuns).mockResolvedValueOnce([{
      id: "run-legacy", issuer_id: "issuer-legacy", status: "complete",
      qa_status: "Restricted", committee_status: "Restricted", as_of_date: "2026-07-17",
      created_at: null,
    }]);
    vi.mocked(getModules).mockResolvedValueOnce([{
      module_id: "CP-2", module_name: "Credit", owned_object: null, schema_family: "Nested",
      runtime_output: {}, confidence: "Medium", qa_status: "Restricted", committee_status: "Restricted",
      validation_status: "Passed", limitation_flags: [], downstream_consumers: [], claims: undefined,
    } as never]);
    vi.mocked(getQA).mockResolvedValueOnce({
      run_id: "run-legacy", qa_status: "Restricted", committee_status: "Restricted", findings_by_severity: {},
      findings: [
        { finding_id: "CP-5C-OLD", severity: "MAJOR", lane: null, module_id: "CP-2", description: "Legacy council issue", affected_claim_id: null, required_remediation: null },
        { finding_id: "QA-OTHER", severity: "MINOR", lane: null, module_id: "CP-2", description: "Ordinary QA", affected_claim_id: null, required_remediation: null },
      ],
    });

    const result = renderHook(() => useLiveRun("issuer-legacy"));
    await waitFor(() => expect(result.result.current.phase).toBe("complete"));
    expect(result.result.current.council.map((finding) => finding.finding_id)).toEqual(["CP-5C-OLD"]);
    expect(result.result.current.liveEvidence).toEqual({});
  });
});
