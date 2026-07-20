// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReportsPage from "./page";

const state = vi.hoisted(() => ({
  freshnessCalls: [] as Array<Record<string, unknown>>,
  liveOuts: {},
  liveStatus: {},
  versions: [
    {
      id: "report-1", context_id: "context-1", run_id: "run-shared",
      model_checkpoint_id: "checkpoint-1", thesis_version_id: null,
      status: "published", document_sha256: "a".repeat(64), authority: {},
      created_at: "2026-07-13T00:00:00Z",
      payload: { composition: { rendered_report: {
        id: "source-1", title: "First memo", file: "first", subtitle: "First",
        icon: "document", srcs: [], sections: [{ t: "text", body: "First body" }],
      } } },
    },
    {
      id: "report-2", context_id: "context-1", run_id: "run-shared",
      model_checkpoint_id: "checkpoint-2", thesis_version_id: null,
      status: "published", document_sha256: "b".repeat(64), authority: {},
      created_at: "2026-07-14T00:00:00Z",
      payload: { composition: { rendered_report: {
        id: "source-2", title: "Second memo", file: "second", subtitle: "Second",
        icon: "document", srcs: [], sections: [{ t: "text", body: "Second body" }],
      } } },
    },
  ],
}));

const evaluation = (stateName: "due" | "stale", id: string) => ({
  state: stateName,
  source_kind: "derived_artifact" as const,
  observed_at: "2026-07-10T00:00:00Z",
  effective_period_end: null,
  expected_next_at: null,
  due_at: "2026-07-14T00:00:00Z",
  age_days: 4,
  reason: stateName === "stale" ? `source_version_changed:${id}` : `refresh_due:${id}`,
  policy_version: "caos-freshness-v1",
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/reports",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams({ issuer: "ISSX", report: "report-1" }),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/charts/G2Chart", () => ({ G2Chart: () => null }));
vi.mock("@/lib/analysis-workbench", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analysis-workbench")>()),
  useAnalysisContext: () => ({
    context: {
      id: "context-1", name: "Reports", sector_id: null, sub_segments: [],
      issuer_ids: ["ISSX"], instrument_ids: [], portfolio_scope: null, as_of: null,
      sector_review_run_id: null, rv_snapshot_id: null, rv_run_id: null,
      query_session_id: null,
      artifacts: {
        issuer_run_id: "run-shared", source_manifest_id: null, research_job_id: null,
        model_checkpoint_id: "checkpoint-2", report_version_id: "report-2",
        alert_event_id: null, sponsor_id: null,
      },
      surface_state: {}, filters: {}, selected: {},
      created_at: "2026-07-13T00:00:00Z", updated_at: "2026-07-14T00:00:00Z",
    },
    loading: false, error: null, patch: vi.fn(), replace: vi.fn(), refresh: vi.fn(),
  }),
}));
vi.mock("@/lib/engine/useLiveRun", () => ({
  useLiveRun: () => ({
    liveOuts: state.liveOuts, liveStatus: state.liveStatus, liveEvidence: {}, runId: "run-shared",
    committeeStatus: "Committee Ready", council: [], loading: false,
    phase: "complete", asOf: "2026-07-14T00:00:00Z",
  }),
}));
vi.mock("@/lib/engine/useModelEngine", () => ({
  useModelEngine: () => ({
    anchor: null, downside: null, downsideState: "unavailable", runId: "run-shared", committeeStatus: "Committee Ready",
    live: true, loading: false, phase: "complete",
  }),
}));
vi.mock("@/lib/engine/useFreshness", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/engine/useFreshness")>()),
  useIssuerFreshness: (args: Record<string, unknown>) => {
    state.freshnessCalls.push(args);
    return {
      issuer: null, run: null,
      context: {
        context_id: "context-1", evaluated_at: "2026-07-14T00:00:00Z",
        artifacts: [
          { artifact: { kind: "report_version", id: "report-1", version: null }, evaluation: evaluation("stale", "report-1") },
          { artifact: { kind: "report_version", id: "report-2", version: null }, evaluation: evaluation("due", "report-2") },
        ],
      },
      issuerStatus: "idle", runStatus: "idle", contextStatus: "ready",
      contextRequested: true, loading: false, compatibilityUnavailable: false,
      error: false, unavailable: false,
    };
  },
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSavedModel: vi.fn().mockResolvedValue(null),
  listReportVersions: vi.fn().mockResolvedValue(state.versions),
  getReportDraft: vi.fn().mockResolvedValue(null),
  saveReportDraft: vi.fn().mockResolvedValue({ revision: 1 }),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  state.freshnessCalls.length = 0;
  vi.clearAllMocks();
});

// Report Studio auto-collapses the left ReportList below 1600px; these tests
// assert against the list, so pin a wide desktop viewport.
Object.defineProperty(window, "innerWidth", { value: 1680, writable: true, configurable: true });

describe("Report Studio freshness lifecycle", () => {
  it("rebinds exact freshness when two immutable versions share one run", async () => {
    render(<ReportsPage />);

    const first = await screen.findByRole("button", { name: /First memo/ });
    await waitFor(() => expect(first.getAttribute("aria-current")).toBe("true"));
    expect(await screen.findByLabelText(/Freshness STALE/i)).toBeTruthy();
    expect(state.freshnessCalls.some((args) =>
      String(args.artifactRevision).endsWith(":report-1"),
    )).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Second memo/ }));
    expect(await screen.findByLabelText(/Freshness DUE/i)).toBeTruthy();
    expect(state.freshnessCalls.some((args) =>
      String(args.artifactRevision).endsWith(":report-2"),
    )).toBe(true);
    expect(state.freshnessCalls.every((args) => args.runId === "run-shared")).toBe(true);
  });

  it("never republishes an immutable selection against the current run/checkpoint", async () => {
    render(<ReportsPage />);

    await screen.findByRole("button", { name: /First memo/ });
    const publish = screen.getByRole("button", { name: /Review frozen preview/i }) as HTMLButtonElement;
    expect(publish.disabled).toBe(false);
    expect(publish.getAttribute("aria-disabled")).toBe("true");
    await waitFor(() => expect(publish.getAttribute("title")).toContain("already an immutable published version"));
  });
});
