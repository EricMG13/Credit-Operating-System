// @vitest-environment jsdom
// Locks in the distilled Profile contract: one layout, one primary action
// (header OPEN DEEP-DIVE), issuer-scoped jumps in the static bottom bar,
// ratings shown once (header), no layout switcher / hidden shortcuts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Profile } from "./ProfileContent";
import type { IssuerProfile } from "@/lib/api";

const freshnessState = vi.hoisted(() => ({
  checkpointId: null as string | null,
  updatedAt: "2026-07-13T00:00:00Z",
  calls: [] as Array<Record<string, unknown>>,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
  usePathname: () => "/issuers/profile",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/components/charts/G2Chart", () => ({ G2Chart: () => null }));
vi.mock("@/lib/analysis-workbench", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analysis-workbench")>()),
  useAnalysisContext: () => ({
    context: freshnessState.checkpointId ? {
      id: "context-profile", name: "Profile", sector_id: null, sub_segments: [],
      issuer_ids: ["iss-1"], instrument_ids: [], portfolio_scope: null, as_of: null,
      sector_review_run_id: null, rv_snapshot_id: null, rv_run_id: null,
      query_session_id: null,
      artifacts: {
        issuer_run_id: "run-1", source_manifest_id: null, research_job_id: null,
        model_checkpoint_id: freshnessState.checkpointId, report_version_id: null,
        alert_event_id: null, sponsor_id: null,
      },
      surface_state: {}, filters: {}, selected: {},
      created_at: "2026-07-13T00:00:00Z", updated_at: freshnessState.updatedAt,
    } : null,
    loading: false, error: null,
    patch: vi.fn().mockResolvedValue(null), replace: vi.fn(), refresh: vi.fn(),
  }),
}));
vi.mock("@/lib/engine/useFreshness", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/engine/useFreshness")>()),
  useIssuerFreshness: (args: Record<string, unknown>) => {
    freshnessState.calls.push(args);
    const id = freshnessState.checkpointId;
    const evaluation = id ? {
      state: id === "checkpoint-1" ? "stale" as const : "due" as const,
      source_kind: "derived_artifact" as const,
      observed_at: "2026-07-10T00:00:00Z", effective_period_end: null,
      expected_next_at: null, due_at: "2026-07-14T00:00:00Z", age_days: 4,
      reason: id === "checkpoint-1" ? "source_version_changed" : "refresh_due",
      policy_version: "caos-freshness-v1",
    } : null;
    return {
      issuer: null, run: null,
      context: id && evaluation ? {
        context_id: "context-profile", evaluated_at: "2026-07-14T00:00:00Z",
        artifacts: [{ artifact: { kind: "model_checkpoint", id, version: null }, evaluation }],
      } : null,
      issuerStatus: "idle", runStatus: "idle", contextStatus: id ? "ready" : "idle",
      contextRequested: Boolean(id), loading: false, compatibilityUnavailable: false,
      error: false, unavailable: false,
    };
  },
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getIssuerProfile: vi.fn(),
  queryGraph: vi.fn().mockResolvedValue({
    capability_id: "analyst-memos", mode: "provenance", title: "",
    nodes: [], edges: [], meta: [], caveats: [],
  }),
}));

afterEach(() => {
  cleanup();
  freshnessState.checkpointId = null;
  freshnessState.updatedAt = "2026-07-13T00:00:00Z";
  freshnessState.calls.length = 0;
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/issuers/profile");
});

const data: IssuerProfile = {
  issuer: {
    id: "iss-1", name: "VMO2", ticker: "VMO2", sector: "Telecom",
    country: "United Kingdom", rating_sp: "BB-", rating_moody: "B1", rating_fitch: "BB",
  },
  latest_run: {
    id: "run-1", status: "complete", qa_status: "Passed", committee_status: "Committee Ready",
    as_of_date: "2026-06-30", analyst_id: "eg", model_mode: null,
    created_at: "2026-06-30T10:00:00Z", completed_at: "2026-06-30T10:05:00Z",
  },
  runs: [],
  metrics: [
    {
      metric_key: "net_leverage", period: "FY2024", value: 5.0, unit: "x", basis: null,
      provenance: "run", headline: false, qa_status: "Passed",
      source_claim_id: null, source_evidence_id: null, document_chunk_id: null,
    },
    {
      metric_key: "net_leverage", period: "FY2025", value: 5.2, unit: "x", basis: null,
      provenance: "run", headline: true, qa_status: "Passed",
      source_claim_id: null, source_evidence_id: null, document_chunk_id: null,
    },
  ],
  signals: {}, coverage: {}, findings: {}, business: [], sponsor: {},
  strengths: [], weaknesses: [],
  earnings: {
    latest_period: null, prior_period: null, revenue_growth_pct: null,
    ebitda_growth_pct: null, margin_change_pp: null, monitoring_signals: [],
  },
};

describe("Profile (distilled)", () => {
  it("labels a retained last-QA-passed snapshot with its own as-of date", () => {
    const retained: IssuerProfile = {
      ...data,
      latest_run: {
        ...data.latest_run!, id: "run-blocked", qa_status: "Blocked",
        committee_status: "Blocked", as_of_date: "2026-09-30",
      },
      signal_run_id: "run-blocked",
      metrics: data.metrics.map((metric) => ({
        ...metric,
        run_id: "run-accepted",
        source_run_as_of: "2026-06-30",
        created_at: "2026-07-01T00:00:00Z",
      })),
    };

    render(<Profile id="iss-1" data={retained} />);
    expect(screen.getByText("Last QA-passed")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Credit snapshot · as of 2026-06-30/i })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Credit snapshot · as of 2026-09-30/i })).toBeNull();
  });

  it("rebinds exact freshness when the active profile artifact changes", async () => {
    freshnessState.checkpointId = "checkpoint-1";
    const view = render(<Profile id="iss-1" data={data} />);
    expect((await screen.findAllByLabelText(/Freshness STALE/i)).length).toBeGreaterThan(0);
    expect(freshnessState.calls.some((args) =>
      String(args.artifactRevision).endsWith(":checkpoint-1"),
    )).toBe(true);

    freshnessState.checkpointId = "checkpoint-2";
    freshnessState.updatedAt = "2026-07-14T00:00:00Z";
    view.rerender(<Profile id="iss-1" data={data} />);
    expect((await screen.findAllByLabelText(/Freshness DUE/i)).length).toBeGreaterThan(0);
    expect(freshnessState.calls.some((args) =>
      String(args.artifactRevision).endsWith(":checkpoint-2"),
    )).toBe(true);
  });

  it("renders one layout with a single primary Deep-Dive action and the issuer action bar", () => {
    render(<Profile id="iss-1" data={data} />);

    // Single primary action, in the header.
    const deepDive = screen.getAllByRole("link", { name: "OPEN DEEP-DIVE →" });
    expect(deepDive).toHaveLength(1);
    expect(deepDive[0].getAttribute("href")).toBe("/deepdive?issuer=iss-1");

    // Issuer-scoped jumps live in the bottom bar, carrying ?issuer=.
    for (const [label, path] of [
      ["Run issuer analysis", "/pipeline"], ["Open in Model Builder", "/model"],
      ["Open in Report Studio", "/reports"], ["Upload issuer documents", "/upload"],
    ] as const) {
      expect(screen.getByRole("link", { name: label }).getAttribute("href")).toBe(path + "?issuer=iss-1");
    }

    // Dual layout, its switcher, and the shortcut chip are gone.
    expect(screen.queryByText(/Bloomberg/)).toBeNull();
    expect(screen.queryByText(/Unified Workspace/)).toBeNull();
    expect(screen.queryByText(/Alt\+/)).toBeNull();

    // All three agency ratings render once, in the header.
    for (const rating of ["BB-", "B1", "BB"]) {
      expect(screen.getAllByText(rating)).toHaveLength(1);
    }
    expect(screen.queryByText("Credit Ratings")).toBeNull();

    // Snapshot metric tile still renders with its formatted value. The metric
    // also appears as a trend small-multiple card (snapshot value + trend), so
    // allow the deliberate duplicate.
    expect(screen.getAllByText("Net leverage").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("5.2×").length).toBeGreaterThanOrEqual(1);

    // The old simultaneous five-row stack is replaced by one URL-addressable
    // active analysis tab. Switching tabs preserves every prior capability.
    expect(screen.getByRole("tab", { name: "Snapshot" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("heading", { name: "Financial & credit trend" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Financials" }));
    expect(window.location.search).toBe("?tab=financials");
    expect(screen.getByRole("heading", { name: "Financial & credit trend" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Thesis & key drivers/ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /FY2024 5\.0×; FY2025 5\.2×/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Structure & Covenant" }));
    expect(screen.getByRole("heading", { name: "Business profile" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Structure & coverage" })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Market & RV" }));
    expect(screen.getByRole("heading", { name: "Market · price & DM" })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Events" }));
    expect(screen.getByRole("heading", { name: /Latest earnings/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Run history/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Evidence / QA" }));
    expect(screen.getByRole("heading", { name: "Evidence Atlas" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "QA findings" })).toBeTruthy();
  });
});
