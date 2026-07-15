// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import PipelinePage from "./page";

const state = vi.hoisted(() => ({
  runId: "run-old",
  freshnessCalls: [] as string[],
}));

const runEvaluation = (runId: string) => ({
  state: runId === "run-old" ? "stale" as const : "due" as const,
  source_kind: "run" as const,
  observed_at: "2026-07-10T00:00:00Z",
  effective_period_end: null,
  expected_next_at: null,
  due_at: "2026-07-14T00:00:00Z",
  age_days: 4,
  reason: runId === "run-old" ? "run_stale" : "run_refresh_due",
  policy_version: "caos-freshness-v1",
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/pipeline",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams({
    issuer: "a71f0000-0000-0000-0000-000000000001",
    run: state.runId,
  }),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/analysis-workbench", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analysis-workbench")>()),
  useAnalysisContext: () => ({
    context: null, loading: false, error: null,
    patch: vi.fn(), replace: vi.fn(), refresh: vi.fn(),
  }),
}));
vi.mock("@/lib/pipeline/useLivePipeline", () => ({
  useLivePipelineStatus: () => ({ value: null, phase: "none", latest: null }),
}));
vi.mock("@/lib/engine/useLiveRun", () => ({
  useLiveRun: () => ({
    liveOuts: {}, liveStatus: {}, liveEvidence: {}, runId: null,
    committeeStatus: null, council: [], loading: false, phase: "none",
  }),
}));
vi.mock("@/lib/engine/useFreshness", () => ({
  useIssuerFreshness: ({ runId }: { runId?: string | null }) => {
    if (runId) state.freshnessCalls.push(runId);
    return {
      issuer: null, context: null,
      run: runId ? {
        run_id: runId, evaluated_at: "2026-07-14T00:00:00Z",
        evaluation: runEvaluation(runId),
      } : null,
      issuerStatus: "idle", contextStatus: "idle", runStatus: runId ? "ready" : "idle",
      contextRequested: false, loading: false, compatibilityUnavailable: false,
      error: false, unavailable: false,
    };
  },
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  state.runId = "run-old";
  state.freshnessCalls.length = 0;
  vi.clearAllMocks();
});

describe("Pipeline freshness lifecycle", () => {
  it("renders the exact URL-selected run and changes state when that run changes", async () => {
    const view = render(<PipelinePage />);
    expect(await screen.findByLabelText(/Freshness STALE/i)).toBeTruthy();
    expect(state.freshnessCalls).toContain("run-old");

    state.runId = "run-new";
    view.rerender(<PipelinePage />);
    await waitFor(() => expect(screen.getByLabelText(/Freshness DUE/i)).toBeTruthy());
    expect(state.freshnessCalls).toContain("run-new");
  });
});
