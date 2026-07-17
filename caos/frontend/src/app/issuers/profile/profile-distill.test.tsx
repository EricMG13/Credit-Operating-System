// @vitest-environment jsdom
// Locks in the distilled Profile contract: one layout, one primary action
// (header OPEN DEEP-DIVE), issuer-scoped jumps in the static bottom bar,
// ratings shown once (header), no layout switcher / hidden shortcuts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import IssuerProfilePage, { Profile } from "./ProfileContent";
import { getIssuerProfile, type IssuerProfile, type ProfileMetric, type ProfileRun } from "@/lib/api";
import { useSearchParams } from "next/navigation";

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
vi.mock("@/components/shared/RequireAuth", () => ({ RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
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

const metric = (
  metric_key: string,
  period: string,
  value: number,
  unit: string,
  headline = false,
  provenance = "run",
): ProfileMetric => ({
  run_id: "run-1", metric_key, period, value, unit, basis: null, provenance, headline,
  qa_status: "Passed", source_claim_id: "claim-1", source_evidence_id: "E-1",
  document_chunk_id: headline ? "chunk-1" : null, source_run_as_of: "2026-06-30",
});

const historyRuns: ProfileRun[] = [
  { ...data.latest_run!, id: "run-complete", status: "complete", committee_status: "Committee Ready" },
  { ...data.latest_run!, id: "run-running", status: "running", qa_status: "Not Reviewed", committee_status: "Draft Only", created_at: null },
  { ...data.latest_run!, id: "run-failed", status: "failed", qa_status: "Blocked", committee_status: "Blocked" },
];

const richData: IssuerProfile = {
  ...data,
  latest_run: { ...data.latest_run!, committee_status: "Blocked", qa_status: "Blocked" },
  runs: historyRuns,
  metrics: [
    metric("revenue", "FY2023", 900, "$M"), metric("revenue", "FY2024", 1100, "$M"), metric("revenue", "Q1 2025", 270, "$M"), metric("revenue", "Q2 2025", 280, "$M"), metric("revenue", "LTM", 1200, "$M", true),
    metric("adj_ebitda", "FY2023", 150, "$M"), metric("adj_ebitda", "FY2024", 180, "$M"), metric("adj_ebitda", "Q1 2025", 45, "$M"), metric("adj_ebitda", "Q2 2025", 50, "$M"), metric("adj_ebitda", "LTM", 200, "$M", true, "derived"),
    metric("ebitda_margin", "FY2023", 18, "%"), metric("ebitda_margin", "FY2024", 18, "%"), metric("ebitda_margin", "Q1 2025", 17, "%"), metric("ebitda_margin", "Q2 2025", 19, "%"), metric("ebitda_margin", "LTM", 20, "%", true, "fixture"),
    metric("net_leverage", "FY2023", 4.2, "x"), metric("net_leverage", "FY2024", 5.0, "x"), metric("net_leverage", "Q1 2025", 5.8, "x"), metric("net_leverage", "Q2 2025", 6.0, "x"), metric("net_leverage", "LTM", 6.2, "x", true),
    metric("interest_coverage", "FY2023", 3.0, "x"), metric("interest_coverage", "FY2024", 2.0, "x"), metric("interest_coverage", "Q1 2025", 1.8, "x"), metric("interest_coverage", "Q2 2025", 1.4, "x"), metric("interest_coverage", "LTM", 1.2, "x", true),
    metric("fcf", "LTM", -12, "$M", true, "demo_fixture"),
    metric("fcf_conversion", "LTM", -4, "%", true),
    metric("altman_z", "LTM", 0.9, "score", true),
  ],
  signals: {
    recommendation: "OVERWEIGHT", composite_percentile: 92,
    fragility: "HIGH", shock_to_breach_pct: 12,
    lme_band: "MODERATE", lme_score: 7,
    covenant_headroom_turns: 0.8, covenant_structure: "springing 1L", runway_months: 14,
    rp_basket_musd: 125, cross_default_musd: 50,
    addback_cap_pct: 0.25, addback_utilization_pct: 95, addback_breach: true,
    revenue_growth_pct: 4.5, ebitda_growth_pct: -2.5, margin_change_pp: 0,
  },
  coverage: { readiness_score: 0.72, documents: 1, categories_missing: ["Covenants", "Sponsor"] },
  findings: { CRITICAL: 1, MATERIAL: 2, MINOR: 3 },
  business: [
    { fact_area: "profile", code: "transaction", statement: "Take-private financing", chunk_id: "b1" },
    { fact_area: "profile", code: "history", statement: "Founded in 1998", chunk_id: null },
    { fact_area: "profile", code: "operating_model", statement: "Subscription revenue", chunk_id: "b2" },
    { fact_area: "profile", code: "ownership", statement: "Sponsor controlled", chunk_id: "b3" },
  ],
  sponsor: { governance_risk_score: 8, ledger: [{ flag: "Aggressive dividends", chunk_id: "s1" }, { flag: "Board control" }] },
  strengths: ["Recurring revenue", "Scale"],
  weaknesses: ["Leverage elevated", "Refinancing wall"],
  earnings: {
    latest_period: "Q2 2026", prior_period: "Q2 2025",
    revenue_growth_pct: 4.5, ebitda_growth_pct: -2.5, margin_change_pp: 0,
    monitoring_signals: ["Margin compression", " ", 7 as unknown as string],
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

  it("renders and interacts with the full live issuer read-model", async () => {
    render(<Profile id="iss-1" data={richData} />);
    expect(screen.getAllByText("OVERWEIGHT · GATED").length).toBeGreaterThan(0);
    expect(screen.getByText("fabricated")).toBeTruthy();
    expect(screen.getAllByRole("img", { name: /Critical|Warning/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Open source chunk-1" }).length).toBeGreaterThan(0);

    const snapshot = screen.getByRole("tab", { name: "Snapshot" });
    snapshot.focus();
    fireEvent.keyDown(snapshot.closest('[role="tablist"]')!, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Evidence / QA" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Evidence / QA" }).closest('[role="tablist"]')!, { key: "ArrowRight" });

    fireEvent.click(screen.getByRole("tab", { name: "Financials" }));
    expect(screen.getByText("Margin compression")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Quarters" }));
    fireEvent.click(screen.getByRole("button", { name: "Full year" }));
    const sparkline = screen.getAllByRole("img", { name: /Metric trend sparkline/ })[0];
    vi.spyOn(sparkline, "getBoundingClientRect").mockReturnValue({ left: 0, width: 240 } as DOMRect);
    fireEvent.focus(sparkline);
    fireEvent.keyDown(sparkline, { key: "ArrowLeft" });
    fireEvent.keyDown(sparkline, { key: "ArrowRight" });
    fireEvent.keyDown(sparkline, { key: "Escape" });
    fireEvent.pointerMove(sparkline, { clientX: 120 });
    fireEvent.pointerLeave(sparkline);
    fireEvent.blur(sparkline);

    fireEvent.click(screen.getByRole("tab", { name: "Structure & Covenant" }));
    expect(screen.getByText("25% of EBITDA · 95% used · BREACH")).toBeTruthy();
    expect(screen.getByText("Aggressive dividends")).toBeTruthy();
    expect(screen.getByText("72% · 1 doc")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Events" }));
    expect(screen.getByText("Q2 2025 → Q2 2026 · YoY")).toBeTruthy();
    expect(screen.getByText("Run history · 3")).toBeTruthy();
    expect(screen.getByText("running")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Evidence / QA" }));
    expect(screen.getAllByText(/Covenants/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("3", { selector: "span" }).length).toBeGreaterThan(0);
  });

  it("degrades every profile section when no run or read-model facts exist", () => {
    const empty: IssuerProfile = {
      ...data,
      issuer: { ...data.issuer, ticker: null, sector: null, country: null, rating_sp: null, rating_moody: null, rating_fitch: null },
      latest_run: null,
      runs: [], metrics: [], signals: {}, coverage: {}, findings: {}, business: [], sponsor: {}, strengths: [], weaknesses: [],
      earnings: undefined as unknown as IssuerProfile["earnings"],
    };
    render(<Profile id="issuer empty" data={empty} />);
    expect(screen.getByText("no run")).toBeTruthy();
    expect(screen.getByText(/No headline metrics yet/)).toBeTruthy();
    expect(screen.getAllByText(/No completed run yet/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: "Financials" }));
    expect(screen.getByText(/Time series needs/)).toBeTruthy();
    expect(screen.getAllByText(/No completed run yet/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("tab", { name: "Structure & Covenant" }));
    expect(screen.getByText("No business disclosure ingested.")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Events" }));
    expect(screen.getByText("No earnings delta yet.")).toBeTruthy();
    expect(screen.getByText("No runs yet.")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Evidence / QA" }));
    expect(screen.getByText("Unavailable — no completed run")).toBeTruthy();
  });

  it("exposes overlay close controls without taking ownership of the page title", () => {
    const onClose = vi.fn();
    document.title = "Host title";
    render(<Profile id="iss-1" data={data} isOverlay onClose={onClose} />);
    expect(document.title).toBe("Host title");
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Issuer profile route states", () => {
  const search = (id: string | null) => vi.mocked(useSearchParams).mockReturnValue({ get: () => id } as unknown as ReturnType<typeof useSearchParams>);

  it("rejects a profile URL without an issuer id", async () => {
    search(null);
    render(<IssuerProfilePage />);
    expect(await screen.findByText(/profile link is missing its issuer/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "OPEN DEEP-DIVE" })).toBeNull();
    expect(getIssuerProfile).not.toHaveBeenCalled();
  });

  it("loads a profile and replaces the splash with the read-model", async () => {
    search("iss-1");
    let resolve!: (value: IssuerProfile) => void;
    vi.mocked(getIssuerProfile).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<IssuerProfilePage />);
    expect(screen.getByText("Loading profile…")).toBeTruthy();
    resolve(data);
    expect(await screen.findByRole("heading", { name: "VMO2" })).toBeTruthy();
    expect(getIssuerProfile).toHaveBeenCalledWith("iss-1");
  });

  it.each([
    [{ response: { status: 404 } }, "Issuer not found."],
    [{ response: { status: 500, data: { detail: "profile store unavailable" } } }, "profile store unavailable"],
    [new Error("offline"), "Couldn’t load this profile."],
  ])("renders an actionable load failure %#", async (failure, message) => {
    search("issuer / one");
    vi.mocked(getIssuerProfile).mockRejectedValueOnce(failure);
    render(<IssuerProfilePage />);
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByRole("link", { name: "OPEN DEEP-DIVE" }).getAttribute("href")).toBe("/deepdive?issuer=issuer%20%2F%20one");
  });

  it("renders the no-data guard and ignores a response after unmount", async () => {
    search("empty");
    vi.mocked(getIssuerProfile).mockResolvedValueOnce(null as unknown as IssuerProfile);
    const first = render(<IssuerProfilePage />);
    expect(await screen.findByText("No data.")).toBeTruthy();
    first.unmount();

    let resolve!: (value: IssuerProfile) => void;
    vi.mocked(getIssuerProfile).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const second = render(<IssuerProfilePage />);
    second.unmount();
    resolve(data);
    await waitFor(() => expect(document.body.textContent).not.toContain("VMO2"));
  });
});
