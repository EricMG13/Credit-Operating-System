// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

const { get, post, patch } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock("@/lib/api", () => ({
  api: { get, post, patch },
  toErrorMessage: vi.fn((_reason, fallback) => fallback),
}));
vi.mock("@/components/shared/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "analyst-1" } }),
}));

import {
  analysisApi,
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
});
