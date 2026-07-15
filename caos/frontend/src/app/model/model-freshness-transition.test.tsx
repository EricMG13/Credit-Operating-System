// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import ModelPage from "./page";

const state = vi.hoisted(() => ({
  checkpointId: "checkpoint-1",
  updatedAt: "2026-07-13T00:00:00Z",
  freshnessCalls: [] as Array<Record<string, unknown>>,
}));

const checkpointEvaluation = (id: string) => ({
  state: id === "checkpoint-1" ? "stale" as const : "due" as const,
  source_kind: "derived_artifact" as const,
  observed_at: "2026-07-10T00:00:00Z",
  effective_period_end: null,
  expected_next_at: null,
  due_at: "2026-07-14T00:00:00Z",
  age_days: 4,
  reason: id === "checkpoint-1" ? "source_version_changed" : "refresh_due",
  policy_version: "caos-freshness-v1",
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/model",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams({ issuer: "a71f0000-0000-0000-0000-000000000001" }),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/analysis-workbench", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analysis-workbench")>()),
  useAnalysisContext: () => ({
    context: {
      id: "context-1", name: "Model", sector_id: null, sub_segments: [],
      issuer_ids: ["a71f0000-0000-0000-0000-000000000001"], instrument_ids: [], portfolio_scope: null, as_of: null,
      sector_review_run_id: null, rv_snapshot_id: null, rv_run_id: null,
      query_session_id: null,
      artifacts: {
        issuer_run_id: "run-shared", source_manifest_id: null, research_job_id: null,
        model_checkpoint_id: state.checkpointId, report_version_id: null,
        alert_event_id: null, sponsor_id: null,
      },
      surface_state: {}, filters: {}, selected: {},
      created_at: "2026-07-13T00:00:00Z", updated_at: state.updatedAt,
    },
    loading: false, error: null, patch: vi.fn(), replace: vi.fn(), refresh: vi.fn(),
  }),
}));
vi.mock("@/lib/engine/useModelEngine", () => ({
  useModelEngine: () => ({
    anchor: {
      ltmRevenue: 1_000, ltmAdjEbitda: 200, netDebt: 800,
      netLeverage: 4, intCov: 2,
    },
    downside: null, runId: "run-shared", committeeStatus: "Committee Ready",
    live: true, loading: false, phase: "complete", asOf: "2026-07-14T00:00:00Z",
  }),
}));
vi.mock("@/lib/engine/useFreshness", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/engine/useFreshness")>()),
  useIssuerFreshness: (args: Record<string, unknown>) => {
    state.freshnessCalls.push(args);
    const id = String(args.artifactRevision).split(":").at(-1) || state.checkpointId;
    return {
      issuer: null, run: null,
      context: {
        context_id: "context-1", evaluated_at: "2026-07-14T00:00:00Z",
        artifacts: [{
          artifact: { kind: "model_checkpoint", id, version: null },
          evaluation: checkpointEvaluation(id),
        }],
      },
      issuerStatus: "idle", runStatus: "idle", contextStatus: "ready",
      contextRequested: true, loading: false, compatibilityUnavailable: false,
      error: false, unavailable: false,
    };
  },
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSettings: vi.fn().mockResolvedValue({ features: { model_engine_v2_enabled: false } }),
  getSavedModel: vi.fn().mockResolvedValue(null),
  getModelCheckpoints: vi.fn().mockResolvedValue([]),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  state.checkpointId = "checkpoint-1";
  state.updatedAt = "2026-07-13T00:00:00Z";
  state.freshnessCalls.length = 0;
  vi.clearAllMocks();
});

describe("Model Builder freshness lifecycle", () => {
  it("rebinds exact freshness when a checkpoint changes under the same context and run", async () => {
    const view = render(<ModelPage />);
    expect((await screen.findAllByLabelText(/Freshness STALE/i)).length).toBeGreaterThan(0);
    expect(state.freshnessCalls.some((args) =>
      String(args.artifactRevision).endsWith(":checkpoint-1"),
    )).toBe(true);

    state.checkpointId = "checkpoint-2";
    state.updatedAt = "2026-07-14T00:00:00Z";
    view.rerender(<ModelPage />);

    await waitFor(() => {
      expect(screen.getAllByLabelText(/Freshness DUE/i).length).toBeGreaterThan(0);
    });
    expect(state.freshnessCalls.some((args) =>
      String(args.artifactRevision).endsWith(":checkpoint-2"),
    )).toBe(true);
    expect(state.freshnessCalls.every((args) => args.runId === "run-shared")).toBe(true);
  });
});
