// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

const { get, post, patch, authState } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  authState: { user: { id: "analyst-1" }, principalGeneration: 0 },
}));

vi.mock("@/lib/api", () => ({
  api: { get, post, patch },
  toErrorMessage: vi.fn((_reason, fallback) => fallback),
}));
vi.mock("@/components/shared/AuthProvider", () => ({
  useAuth: () => authState,
}));

import {
  activeFindings,
  analysisApi,
  contextHref,
  mergeContextIntoCurrentUrl,
  useAnalysisContext,
  type AnalysisContext,
  type AnalysisArtifactRefs,
  type AnalysisSurfaceName,
  type InsightArtifact,
  type InsightPage,
} from "./analysis-workbench";

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  authState.user.id = "analyst-1";
  authState.principalGeneration = 0;
});

describe("shared insight contracts", () => {
  it("keeps new surfaces and refs null-compatible", () => {
    const surfaces: AnalysisSurfaceName[] = ["portfolio-lab", "ic-book"];
    const refs: Partial<AnalysisArtifactRefs> = {
      portfolio_id: null,
      decision_id: null,
      insight_id: null,
      artifact_refs: [
        { kind: "document", id: "document-1" },
        { kind: "document_chunk", id: "chunk-1" },
        { kind: "market_snapshot", id: "snapshot-1", version: "v2" },
      ],
    };
    expect(surfaces).toEqual(["portfolio-lab", "ic-book"]);
    expect(refs.insight_id).toBeNull();
    expect(refs.artifact_refs?.map((ref) => ref.kind)).toEqual([
      "document", "document_chunk", "market_snapshot",
    ]);
    const statuses: InsightArtifact["status"][] = [
      "queued", "running", "ready", "partial", "error", "stale", "ratified", "rejected",
    ];
    expect(statuses).toHaveLength(8);
  });

  it("merges a late analysis context without discarding newer URL state", () => {
    expect(mergeContextIntoCurrentUrl(
      "https://desk.test/query?lane=graph&selected=issuer-7#result",
      "context-1",
    )).toBe("/query?lane=graph&selected=issuer-7&context=context-1#result");
    expect(mergeContextIntoCurrentUrl(
      "https://desk.test/query?context=context-existing&lane=metric",
      "context-new",
    )).toBe("/query?context=context-existing&lane=metric");
  });

  it("maps list, create, ratify, and reject to the analysis routes", async () => {
    const page: InsightPage = { items: [], current: null, next_cursor: null };
    get.mockResolvedValue({ data: page });
    post.mockResolvedValue({ data: { id: "insight-1" } });

    const listed = await analysisApi.listInsights("context-1", {
      surface: "query", kind: "desk-brief", cursor: "cursor-1", limit: 25,
    });
    expect(get).toHaveBeenCalledWith("/api/analysis/contexts/context-1/insights", {
      params: { surface: "query", kind: "desk-brief", cursor: "cursor-1", limit: 25 },
    });
    expect(listed.current).toBeNull();

    await analysisApi.createInsight("context-1", {
      surface: "query",
      kind: "desk-brief",
      force: true,
      subject_refs: { issuer_run_id: "run-1" },
    });
    expect(post).toHaveBeenCalledWith("/api/analysis/contexts/context-1/insights", {
      surface: "query",
      kind: "desk-brief",
      force: true,
      subject_refs: { issuer_run_id: "run-1" },
    });

    await analysisApi.ratifyInsight("insight-1");
    expect(post).toHaveBeenCalledWith("/api/analysis/insights/insight-1/ratify");
    await analysisApi.rejectInsight("insight-1");
    expect(post).toHaveBeenCalledWith("/api/analysis/insights/insight-1/reject");
  });

  it("maps findings, query, sector, RV, and workbook calls to their API contracts", async () => {
    get.mockImplementation((url: string) => Promise.resolve({ data: url === "/api/analysis/taxonomy"
      ? { sectors: [{ id: "energy", label: "Energy", aliases: [] }] }
      : url === "/api/rv/snapshots" ? { snapshots: [{ id: "snapshot-1" }] } : [] }));
    post.mockResolvedValue({ data: { id: "result-1" } });
    patch.mockResolvedValue({ data: { id: "finding-1", status: "archived" } });

    expect(await analysisApi.getTaxonomy()).toHaveLength(1);
    await analysisApi.listFindings("context-1");
    await analysisApi.createFinding({ context_id: "context-1", kind: "note", title: "Finding", source_surface: "query", source_run_id: "run-1" });
    await analysisApi.archiveFinding("finding-1");
    await analysisApi.createQueryRun({ context_id: "context-1", question: "Why?", selected_lane: "grounded" });
    await analysisApi.listQueryRuns("context-1");
    await analysisApi.createSectorReview({ context_id: "context-1", sector_id: "energy" });
    await analysisApi.listSectorReviews("context-1");
    await analysisApi.ratifySectorReview("review-1", [{ section_id: "posture", decision: "ratified" }]);
    await analysisApi.publishSectorReview("review-1");
    await analysisApi.createRVScreen({ context_id: "context-1", snapshot_id: "snapshot-1" });
    expect(await analysisApi.listMarketSnapshots()).toHaveLength(1);
    await analysisApi.getRVScreen("rv-1");
    await analysisApi.ratifyRVCandidate("rv-1", "candidate-1", "Override");

    const file = new File(["issuer,spread"], "market.csv", { type: "text/csv" });
    await analysisApi.previewMarketWorkbook({ file, mapping: { spread: "OAS" } });
    const previewCall = post.mock.calls.find(([url]) => url === "/api/rv/snapshots/import/preview")!;
    expect((previewCall[1] as FormData).get("issuer_mappings")).toBe("{}");
    await analysisApi.commitMarketWorkbook({
      file, mapping: {}, issuerMappings: { ATLS: "issuer-1" }, sourceLabel: "Desk marks",
      preview: { workbook_sha256: "sha-1", preview_token: "token-1" } as never,
    });
    const commitCall = post.mock.calls.find(([url]) => url === "/api/rv/snapshots/import/commit")!;
    expect((commitCall[1] as FormData).get("preview_sha256")).toBe("sha-1");
    expect((commitCall[1] as FormData).get("source_label")).toBe("Desk marks");
  });

  it("filters archived findings and builds context-scoped links", () => {
    const rows = [{ id: "active", status: "draft" }, { id: "archived", status: "archived" }] as never;
    expect(activeFindings(rows).map((row) => row.id)).toEqual(["active"]);
    expect(contextHref("/reports", "context-1", { section: "capital-structure" })).toBe("/reports?context=context-1&section=capital-structure");
    expect(contextHref("/query", "context-1")).toBe("/query?context=context-1");
  });
});

afterEach(() => cleanup());

const CONTEXT: AnalysisContext = {
  id: "context-1", revision: 1, name: "Desk", sector_id: null, sub_segments: [],
  issuer_ids: [], instrument_ids: [], portfolio_scope: null, as_of: null,
  sector_review_run_id: null, rv_snapshot_id: null, rv_run_id: null,
  query_session_id: null,
  artifacts: {
    issuer_run_id: null, source_manifest_id: null, research_job_id: null,
    model_checkpoint_id: null, report_version_id: null, alert_event_id: null,
    sponsor_id: null,
  },
  surface_state: {}, filters: {}, selected: {}, created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("useAnalysisContext mutation ordering", () => {
  it("treats an explicit null context id as a request for a fresh context", async () => {
    window.history.replaceState({}, "", "/command?context=stale-url-context");
    post.mockResolvedValue({ data: CONTEXT });
    const { result } = renderHook(() => useAnalysisContext({ name: "Desk", context_id: null }));
    await waitFor(() => expect(result.current.context?.id).toBe("context-1"));
    expect(post).toHaveBeenCalledWith("/api/analysis/contexts", { name: "Desk", sector_id: undefined });
    expect(get).not.toHaveBeenCalled();
  });
  it("publishes a presentation-only error event when initial context resolution fails", async () => {
    window.history.replaceState({}, "", "/command");
    post.mockRejectedValue(new Error("context service unavailable"));
    const onContextError = vi.fn();
    window.addEventListener("caos:analysis-context-error", onContextError);

    const { result } = renderHook(() => useAnalysisContext({ name: "Desk" }));
    await waitFor(() => expect(result.current.error).toBe("Analysis context unavailable."));

    expect(onContextError).toHaveBeenCalledTimes(1);
    expect(result.current.context).toBeNull();
    window.removeEventListener("caos:analysis-context-error", onContextError);
  });

  it("does not reuse or publish a pending create across a principal epoch", async () => {
    window.history.replaceState({}, "", "/command");
    let resolveExpired!: (value: { data: AnalysisContext }) => void;
    post
      .mockImplementationOnce(() => new Promise((resolve) => { resolveExpired = resolve; }))
      .mockResolvedValueOnce({ data: { ...CONTEXT, id: "context-new-session" } });

    const { result, rerender } = renderHook(() => useAnalysisContext({ name: "Desk" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    authState.principalGeneration = 1;
    rerender();

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.context?.id).toBe("context-new-session"));
    await act(async () => {
      resolveExpired({ data: { ...CONTEXT, id: "context-expired-session" } });
      await Promise.resolve();
    });
    expect(result.current.context?.id).toBe("context-new-session");
  });

  it("retries once after a 429 with bounded backoff, staying throttled (not error) until it succeeds", async () => {
    window.history.replaceState({}, "", "/command");
    vi.useFakeTimers();
    try {
      post
        .mockRejectedValueOnce({ isAxiosError: true, response: { status: 429 } })
        .mockResolvedValueOnce({ data: { ...CONTEXT, name: "Desk Throttle A" } });
      const onContextError = vi.fn();
      const onThrottled = vi.fn();
      window.addEventListener("caos:analysis-context-error", onContextError);
      window.addEventListener("caos:analysis-context-throttled", onThrottled);

      const { result } = renderHook(() => useAnalysisContext({ name: "Desk Throttle A" }));

      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(post).toHaveBeenCalledTimes(1);
      expect(result.current.throttled).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.context).toBeNull();
      expect(onContextError).not.toHaveBeenCalled();
      // The shell-wide chrome (AnalysisContextStrip) hears this to show an
      // honest "throttled — retrying" state instead of silence or churn.
      expect(onThrottled).toHaveBeenCalledTimes(1);

      await act(async () => { await vi.advanceTimersByTimeAsync(30000); });

      expect(post).toHaveBeenCalledTimes(2);
      expect(result.current.throttled).toBe(false);
      expect(result.current.context?.name).toBe("Desk Throttle A");
      expect(onContextError).not.toHaveBeenCalled();
      window.removeEventListener("caos:analysis-context-error", onContextError);
      window.removeEventListener("caos:analysis-context-throttled", onThrottled);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not refire the create request when the shell remounts mid-backoff (no storm)", async () => {
    window.history.replaceState({}, "", "/command");
    vi.useFakeTimers();
    try {
      post
        .mockRejectedValueOnce({ isAxiosError: true, response: { status: 429 } })
        .mockResolvedValueOnce({ data: { ...CONTEXT, name: "Desk Throttle B" } });

      const { result, unmount } = renderHook(() => useAnalysisContext({ name: "Desk Throttle B" }));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(post).toHaveBeenCalledTimes(1);
      expect(result.current.throttled).toBe(true);

      // Simulate the shell tearing this surface down and remounting it before
      // the backoff window elapses — the observed churn pattern.
      unmount();
      const remount = renderHook(() => useAnalysisContext({ name: "Desk Throttle B" }));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(post).toHaveBeenCalledTimes(1); // still just the one attempt — no storm
      expect(remount.result.current.throttled).toBe(true);

      await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
      expect(post).toHaveBeenCalledTimes(2);
      expect(remount.result.current.context?.name).toBe("Desk Throttle B");
    } finally {
      vi.useRealTimers();
    }
  });

  it("serializes patches and sends the newest revision to the queued mutation", async () => {
    window.history.replaceState({}, "", "/command?context=context-1");
    get.mockResolvedValue({ data: CONTEXT });
    let resolveFirst!: (value: { data: AnalysisContext }) => void;
    patch
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: { ...CONTEXT, revision: 3, selected: { row: "b" } } });

    const { result } = renderHook(() => useAnalysisContext({ name: "Desk" }));
    await waitFor(() => expect(result.current.context?.id).toBe("context-1"));

    let first!: Promise<AnalysisContext | null>;
    let second!: Promise<AnalysisContext | null>;
    await act(async () => {
      first = result.current.patch({ filters: { lane: "credit" } });
      second = result.current.patch({ selected: { row: "b" } });
      await Promise.resolve();
    });
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch.mock.calls[0][1]).toMatchObject({ expected_revision: 1 });

    await act(async () => {
      resolveFirst({ data: { ...CONTEXT, revision: 2, filters: { lane: "credit" } } });
      await first;
      await second;
    });
    expect(patch).toHaveBeenCalledTimes(2);
    expect(patch.mock.calls[1][1]).toMatchObject({ expected_revision: 2 });
    expect(result.current.context?.revision).toBe(3);
    expect(result.current.mutationState).toBe("idle");
  });

  it("reduces legacy full nested objects to the caller's sparse intent", async () => {
    window.history.replaceState({}, "", "/command?context=context-1");
    const base: AnalysisContext = {
      ...CONTEXT,
      artifacts: { ...CONTEXT.artifacts, issuer_run_id: "run-1" },
      surface_state: {
        command: {
          active_id: "issuer-1", view: "portfolio",
          filters: { rating: "B", sector: "industrials" },
        },
        pipeline: { active_id: "run-1", view: "graph" },
      },
      filters: { lane: "credit", basis: "reported" },
      selected: { issuer: "issuer-1", run: "run-1" },
    };
    get.mockResolvedValue({ data: base });
    patch.mockResolvedValue({ data: { ...base, revision: 2 } });

    const { result } = renderHook(() => useAnalysisContext({ name: "Desk" }));
    await waitFor(() => expect(result.current.context?.revision).toBe(1));
    await act(async () => {
      await result.current.patch({
        artifacts: { ...base.artifacts, report_version_id: "report-1" },
        surface_state: {
          ...base.surface_state,
          command: {
            ...base.surface_state.command,
            active_id: "issuer-2",
            filters: { ...base.surface_state.command?.filters, sector: "telecom" },
          },
        },
        filters: { ...base.filters, basis: "adjusted" },
        selected: { ...base.selected, run: "run-2" },
      });
    });

    expect(patch.mock.calls[0][1]).toEqual({
      artifacts: { report_version_id: "report-1" },
      surface_state: { command: {
        active_id: "issuer-2", filters: { sector: "telecom" },
      } },
      filters: { basis: "adjusted" },
      selected: { run: "run-2" },
      expected_revision: 1,
    });
  });

  it("removes an unchanged nested filter block from the sparse surface patch", async () => {
    window.history.replaceState({}, "", "/command?context=context-1");
    const base = { ...CONTEXT, surface_state: { command: { filters: { rating: "B", sector: "industrials" } } } };
    get.mockResolvedValue({ data: base });
    patch.mockResolvedValue({ data: { ...base, revision: 2 } });
    const { result } = renderHook(() => useAnalysisContext({ name: "Desk" }));
    await waitFor(() => expect(result.current.context).not.toBeNull());
    await act(async () => { await result.current.patch({ surface_state: { command: { filters: { rating: "B", sector: "industrials" } } } }); });
    expect(patch.mock.calls[0][1]).toEqual({ surface_state: {}, expected_revision: 1 });
  });

  it("refetches and replays a sparse patch once after a 409", async () => {
    window.history.replaceState({}, "", "/command?context=context-1");
    get
      .mockResolvedValueOnce({ data: CONTEXT })
      .mockResolvedValueOnce({ data: { ...CONTEXT, revision: 5 } });
    patch
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 409 } })
      .mockResolvedValueOnce({ data: { ...CONTEXT, revision: 6, filters: { lane: "graph" } } });

    const { result } = renderHook(() => useAnalysisContext({ name: "Desk" }));
    await waitFor(() => expect(result.current.context?.revision).toBe(1));
    await act(async () => { await result.current.patch({ filters: { lane: "graph" } }); });

    expect(get).toHaveBeenCalledTimes(2);
    expect(patch.mock.calls[0][1]).toMatchObject({ expected_revision: 1, filters: { lane: "graph" } });
    expect(patch.mock.calls[1][1]).toMatchObject({ expected_revision: 5, filters: { lane: "graph" } });
    expect(result.current.context?.revision).toBe(6);
  });

  it.each([401, 429, 500, undefined])("keeps a rejected %s mutation visibly retryable", async (status) => {
    window.history.replaceState({}, "", "/command?context=context-1");
    get.mockResolvedValue({ data: CONTEXT });
    const failure = status === undefined
      ? new Error("network unavailable")
      : { isAxiosError: true, response: { status } };
    patch
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ data: { ...CONTEXT, revision: 2, selected: { row: "recovered" } } });

    const { result } = renderHook(() => useAnalysisContext({ name: "Desk" }));
    await waitFor(() => expect(result.current.context?.revision).toBe(1));
    await act(async () => {
      await result.current.patch({ selected: { row: "recovered" } }).catch(() => undefined);
    });
    expect(result.current.mutationState).toBe("error");
    expect(result.current.mutationError).toBe("Analysis context was not saved.");

    await act(async () => { await result.current.retryLastPatch(); });
    expect(patch).toHaveBeenCalledTimes(2);
    expect(result.current.context?.selected).toEqual({ row: "recovered" });
    expect(result.current.mutationState).toBe("idle");
  });
});
