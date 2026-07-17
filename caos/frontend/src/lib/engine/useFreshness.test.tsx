// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { derivedFreshness, useIssuerFreshness } from "./useFreshness";
import { getContextFreshness, getIssuerFreshness, getRunFreshness } from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, getIssuerFreshness: vi.fn(), getContextFreshness: vi.fn(), getRunFreshness: vi.fn() };
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

describe("useIssuerFreshness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIssuerFreshness).mockResolvedValue(null as never);
    vi.mocked(getContextFreshness).mockResolvedValue(null as never);
    vi.mocked(getRunFreshness).mockResolvedValue(null as never);
  });

  it("does not land a slow prior issuer response after an issuer switch", async () => {
    const first = deferred<Awaited<ReturnType<typeof getIssuerFreshness>>>();
    const second = deferred<Awaited<ReturnType<typeof getIssuerFreshness>>>();
    vi.mocked(getIssuerFreshness).mockImplementation((id) => id === "issuer-a" ? first.promise : second.promise);
    const { result, rerender } = renderHook(({ issuerId }) => useIssuerFreshness({ issuerId }), { initialProps: { issuerId: "issuer-a" } });
    rerender({ issuerId: "issuer-b" });
    await act(async () => second.resolve({ issuer_id: "issuer-b", evaluated_at: "2026-07-14T00:00:00Z", evaluations: [] }));
    expect(result.current.issuer?.issuer_id).toBe("issuer-b");
    await act(async () => first.resolve({ issuer_id: "issuer-a", evaluated_at: "2026-07-14T00:00:00Z", evaluations: [] }));
    expect(result.current.issuer?.issuer_id).toBe("issuer-b");
  });

  it.each([
    [404, "compatibility-unavailable", false],
    [500, "error", true],
  ] as const)("tracks a failed preferred context read separately from a ready run (%s)", async (status, expectedStatus, expectedError) => {
    vi.mocked(getContextFreshness).mockRejectedValue({ response: { status } });
    vi.mocked(getRunFreshness).mockResolvedValue({
      run_id: "run-current",
      evaluated_at: "2026-07-14T00:00:00Z",
      evaluation: {
        state: "current", source_kind: "run", observed_at: "2026-07-14T00:00:00Z",
        effective_period_end: null, expected_next_at: null, due_at: null, age_days: 0,
        reason: "within_policy_window", policy_version: "caos-freshness-v1",
      },
    });
    const { result } = renderHook(() => useIssuerFreshness({ contextId: "context-1", runId: "run-current" }));
    await act(async () => { await Promise.resolve(); });

    expect(result.current.contextStatus).toBe(expectedStatus);
    expect(result.current.runStatus).toBe("ready");
    expect(result.current.error).toBe(expectedError);
    expect(result.current.compatibilityUnavailable).toBe(status === 404);
    expect(derivedFreshness(result.current, "report-1")).toBeNull();
  });

  it("uses an exact context artifact when the preferred read succeeds", async () => {
    const exact = {
      state: "stale" as const, source_kind: "derived_artifact" as const,
      observed_at: "2026-05-01T00:00:00Z", effective_period_end: null,
      expected_next_at: null, due_at: "2026-06-15T00:00:00Z", age_days: 74,
      reason: "source_version_changed", policy_version: "caos-freshness-v1",
    };
    vi.mocked(getContextFreshness).mockResolvedValue({
      context_id: "context-1", evaluated_at: "2026-07-14T00:00:00Z",
      artifacts: [{ artifact: { kind: "report_version", id: "report-1", version: null }, evaluation: exact }],
    });
    const { result } = renderHook(() => useIssuerFreshness({ contextId: "context-1" }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.contextStatus).toBe("ready");
    expect(derivedFreshness(result.current, "report-1")).toEqual(exact);
  });

  it("refetches the same context and run when the bound artifact revision changes", async () => {
    const first = deferred<Awaited<ReturnType<typeof getContextFreshness>>>();
    const second = deferred<Awaited<ReturnType<typeof getContextFreshness>>>();
    vi.mocked(getContextFreshness)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    vi.mocked(getRunFreshness).mockResolvedValue({
      run_id: "run-shared",
      evaluated_at: "2026-07-14T00:00:00Z",
      evaluation: {
        state: "current", source_kind: "run", observed_at: "2026-07-14T00:00:00Z",
        effective_period_end: null, expected_next_at: null, due_at: null, age_days: 0,
        reason: "within_policy_window", policy_version: "caos-freshness-v1",
      },
    });
    const { result, rerender } = renderHook(
      ({ artifactRevision }) => useIssuerFreshness({
        contextId: "context-shared", runId: "run-shared", artifactRevision,
      }),
      { initialProps: { artifactRevision: "report-1" } },
    );

    rerender({ artifactRevision: "report-2" });
    const secondEvaluation = {
      state: "due" as const, source_kind: "derived_artifact" as const,
      observed_at: "2026-07-10T00:00:00Z", effective_period_end: null,
      expected_next_at: null, due_at: "2026-07-14T00:00:00Z", age_days: 4,
      reason: "refresh_due", policy_version: "caos-freshness-v1",
    };
    await act(async () => second.resolve({
      context_id: "context-shared", evaluated_at: "2026-07-14T00:00:00Z",
      artifacts: [{
        artifact: { kind: "report_version", id: "report-2", version: null },
        evaluation: secondEvaluation,
      }],
    }));
    expect(getContextFreshness).toHaveBeenCalledTimes(2);
    expect(derivedFreshness(result.current, "report-2")).toEqual(secondEvaluation);

    // The first request may complete after the report/checkpoint rebind. It
    // must not replace the second artifact's authoritative response.
    await act(async () => first.resolve({
      context_id: "context-shared", evaluated_at: "2026-07-14T00:00:00Z",
      artifacts: [{
        artifact: { kind: "report_version", id: "report-1", version: null },
        evaluation: { ...secondEvaluation, state: "stale", reason: "source_version_changed" },
      }],
    }));
    expect(derivedFreshness(result.current, "report-2")).toEqual(secondEvaluation);
  });

  it("does not borrow a CURRENT run state when the requested rebound artifact is absent", async () => {
    vi.mocked(getContextFreshness).mockResolvedValue({
      context_id: "context-1", evaluated_at: "2026-07-14T00:00:00Z", artifacts: [],
    });
    vi.mocked(getRunFreshness).mockResolvedValue({
      run_id: "run-shared", evaluated_at: "2026-07-14T00:00:00Z",
      evaluation: {
        state: "current", source_kind: "run", observed_at: "2026-07-14T00:00:00Z",
        effective_period_end: null, expected_next_at: null, due_at: null, age_days: 0,
        reason: "within_policy_window", policy_version: "caos-freshness-v1",
      },
    });
    const { result } = renderHook(() => useIssuerFreshness({
      contextId: "context-1", runId: "run-shared", artifactRevision: "checkpoint-new",
    }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.contextStatus).toBe("ready");
    expect(result.current.runStatus).toBe("ready");
    expect(derivedFreshness(result.current, "checkpoint-new")).toBeNull();
  });
});

describe("derivedFreshness fallbacks", () => {
  const evaluation = (source_kind: "derived_artifact" | "run") => ({
    state: "current" as const,
    source_kind,
    observed_at: "2026-07-14T00:00:00Z",
    effective_period_end: null,
    expected_next_at: null,
    due_at: null,
    age_days: 0,
    reason: "within_policy_window",
    policy_version: "caos-freshness-v1",
  });
  const base = {
    issuer: null, context: null, run: null,
    issuerStatus: "idle", contextStatus: "idle", runStatus: "idle",
    contextRequested: false, loading: false,
    compatibilityUnavailable: false, error: false, unavailable: false,
  } as const;

  it("prefers run, then derived issuer, then issuer run, then null", () => {
    const directRun = evaluation("run");
    expect(derivedFreshness({ ...base, run: { run_id: "r", evaluated_at: "now", evaluation: directRun } } as never))
      .toBe(directRun);
    const derived = evaluation("derived_artifact");
    expect(derivedFreshness({ ...base, issuer: { issuer_id: "i", evaluated_at: "now", evaluations: [derived] } } as never))
      .toBe(derived);
    const issuerRun = evaluation("run");
    expect(derivedFreshness({ ...base, issuer: { issuer_id: "i", evaluated_at: "now", evaluations: [issuerRun] } } as never))
      .toBe(issuerRun);
    expect(derivedFreshness(base as never)).toBeNull();
    expect(derivedFreshness({ ...base, contextRequested: true, contextStatus: "ready" } as never)).toBeNull();
  });
});
