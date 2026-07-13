import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/lib/api", () => ({
  api: { get, post, patch: vi.fn() },
  toErrorMessage: vi.fn(),
}));

import {
  analysisApi,
  mergeContextIntoCurrentUrl,
  type AnalysisArtifactRefs,
  type AnalysisSurfaceName,
  type InsightArtifact,
  type InsightPage,
} from "./analysis-workbench";

describe("shared insight contracts", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it("keeps new surfaces and refs null-compatible", () => {
    const surfaces: AnalysisSurfaceName[] = ["portfolio-lab", "ic-book"];
    const refs: Partial<AnalysisArtifactRefs> = {
      portfolio_id: null,
      decision_id: null,
      insight_id: null,
    };
    expect(surfaces).toEqual(["portfolio-lab", "ic-book"]);
    expect(refs.insight_id).toBeNull();
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
