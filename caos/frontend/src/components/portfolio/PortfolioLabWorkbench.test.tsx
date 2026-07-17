// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const state = vi.hoisted(() => ({
  roleView: "analyst" as "analyst" | "pm" | "qa",
  contextId: "ctx-1" as string | null,
}));
const mocks = vi.hoisted(() => ({
  getPortfolios: vi.fn(), getPositions: vi.fn(), getAnalytics: vi.fn(),
  listStressRuns: vi.fn(), createStressRun: vi.fn(),
  listInsights: vi.fn(), createInsight: vi.fn(), ratifyInsight: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/portfolios",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/shared/ConceptNav", () => ({ ConceptNav: () => <nav>Concepts</nav> }));
vi.mock("@/components/shared/AnalysisContextStrip", () => ({ AnalysisContextStrip: () => null }));
vi.mock("@/components/shared/RoleViewProvider", () => ({
  useRoleView: () => ({ roleView: state.roleView, setRoleView: vi.fn(), ready: true }),
}));
vi.mock("@/components/shared/ActionReason", () => ({
  ActionReason: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <button type="button" className={className} onClick={onClick}>{children}</button>
  ),
}));
vi.mock("@/components/charts/G2Chart", () => ({ G2Chart: () => <div data-testid="g2-chart" /> }));
vi.mock("@/lib/api", () => ({
  getPortfolios: mocks.getPortfolios,
  toErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
}));
vi.mock("@/lib/portfolio-lab", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/portfolio-lab")>();
  return { ...actual, portfolioLabApi: {
    getPositions: mocks.getPositions,
    getAnalytics: mocks.getAnalytics,
    listStressRuns: mocks.listStressRuns,
    createStressRun: mocks.createStressRun,
  } };
});
vi.mock("@/lib/analysis-workbench", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analysis-workbench")>();
  return {
    ...actual,
    useAnalysisContext: () => ({
      context: state.contextId ? { id: state.contextId, name: "Portfolio Lab" } : null,
      loading: false,
      error: null,
      patch: vi.fn(),
    }),
    analysisApi: {
      ...actual.analysisApi,
      listInsights: mocks.listInsights,
      createInsight: mocks.createInsight,
      ratifyInsight: mocks.ratifyInsight,
    },
  };
});

import {
  PortfolioInsightCard,
  PortfolioLabWorkbench,
  createPortfolioVisualizationSpec,
} from "./PortfolioLabWorkbench";
import type { InsightArtifact } from "@/lib/analysis-workbench";

const authority = {
  origin: "live", method: "deterministic-portfolio-v1", freshness: "current",
  as_of: "2026-06-30T00:00:00Z", source_ids: ["portfolio:p1"], run_id: null,
  version_id: null, confidence: 1, approval_state: "draft" as const, analyst_override: null,
};
const position = {
  id: "pos-1", portfolio_id: "p1", issuer_id: "issuer-1", borrower_name: "Alpha Software",
  ticker: "ALPH", figi: "BBG1", loan_name: "TLB", sector: "Software", sub_sector: null,
  ranking: "1L", rating_moody: "B2", rating_sp: "B", par_usd: 10_000_000,
  facility_musd: 500, margin_bps: 450, maturity: "2029", price: 98.5,
  ytm: 8, dm: 520, market_value: 9_850_000, created_at: "2026-06-30T00:00:00Z",
};
const analytics = {
  as_of: "2026-06-30",
  concentration: {
    n_positions: 5000, n_obligors: 4000, total_nav: 9850000, total_par: 10000000,
    sectors: [{ sector: "Software", mv: 9850000, pct_nav: 100, n_obligors: 1 }],
    rating_dist: [{ bucket: "B", mv: 9850000, pct_nav: 100, n_obligors: 1 }],
    top10: [{ obligor: "Alpha Software", mv: 9850000, pct_nav: 100 }], top10_pct_nav: 100,
    wa_rating: "B", wa_margin: 450, wa_price: 98.5, first_lien_pct: 100,
  },
  rating_distribution: { B2: 100 }, maturity_wall: { "2029": 9850000 },
  risk_budget: { status_counts: { Breach: 1, Watch: 0, Pass: 0, Info: 0 }, headroom: [] },
  liquidity: { priced_nav_pct: 100, wa_price: 98.5, unpriced_positions: 0 },
  compliance: [{ code: "SINGLE", category: "Single name", parameter: "Max single name", limit_text: "<= 3%", current: 100, headroom: -97, status: "Breach" as const }],
  authority, missing_dependencies: ["maturity:pos-2"], latest_stress_runs: [],
};

function makeInsight(
  status: InsightArtifact["status"] = "ready",
  overrides: Partial<InsightArtifact> = {},
): InsightArtifact {
  return {
    id: `insight-${status}`,
    context_id: "ctx-1",
    surface: "portfolio-lab",
    kind: "portfolio-brief",
    status,
    subject_refs: { issuer_run_id: null, source_manifest_id: null, research_job_id: null, model_checkpoint_id: null, report_version_id: null, alert_event_id: null, sponsor_id: null, portfolio_id: "p1" },
    summary: `${status} portfolio brief`,
    claims: [],
    recommended_actions: [],
    missing_dependencies: [],
    authority,
    source_fingerprint: `${status}-fp`,
    version: 1,
    model: null,
    generated_at: "2026-07-13T10:00:00Z",
    ratified_at: status === "ratified" ? "2026-07-13T11:00:00Z" : null,
    rejected_at: null,
    lease_owner: null,
    lease_expires_at: null,
    ...overrides,
  };
}

const stressRun = {
  id: "stress-1", portfolio_id: "p1", created_by: "analyst", label: "Base downside",
  input: { label: "Base downside", book_price_shock_pct: -8, sector_shock_pcts: {} },
  output: { base_nav: 9850000, stressed_nav: 9062000, loss_amount: 788000, loss_percent: 8, sector_contributions: [], authority, missing_dependencies: [] },
  source_fingerprint: "fingerprint-1", authority, status: "complete",
  created_at: "2026-07-13T10:00:00Z", updated_at: "2026-07-13T10:00:00Z",
};

afterEach(cleanup);

beforeEach(() => {
  window.history.replaceState({}, "", "/portfolios?portfolio=p1&context=ctx-1&dataset=positions&chart=concentration");
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) });
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  state.roleView = "analyst";
  state.contextId = "ctx-1";
  mocks.getPortfolios.mockReset().mockResolvedValue([{ id: "p1", name: "Credit Opportunities I", kind: "CLO", as_of_date: "2026-06-30", n_positions: 5000, total_nav: 9850000, total_par: 10000000, breaches: 1, watches: 0 }]);
  mocks.getPositions.mockReset().mockResolvedValue({ items: [position], total: 5000, next_cursor: "cursor-2", as_of: "2026-06-30", authority });
  mocks.getAnalytics.mockReset().mockResolvedValue(analytics);
  mocks.listStressRuns.mockReset().mockResolvedValue({ items: [], total: 0, authority });
  mocks.createStressRun.mockReset().mockResolvedValue(stressRun);
  mocks.listInsights.mockReset().mockResolvedValue({ items: [], current: null, next_cursor: null });
  mocks.createInsight.mockReset();
  mocks.ratifyInsight.mockReset();
});

describe("Portfolio Lab workbench", () => {
  it("owns one table, switches datasets in place, and marks 5,000-row virtualization", async () => {
    render(<PortfolioLabWorkbench />);
    expect(await screen.findByRole("table", { name: "Portfolio positions" })).toBeTruthy();
    await screen.findByRole("button", { name: /select alpha software/i });
    expect(document.querySelectorAll("[data-caos-dominant-table-owner]")).toHaveLength(1);
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Portfolio positions table" }).getAttribute("data-total-rows")).toBe("5000");
    });
    expect(document.querySelector(".portfolio-lab__virtual-row")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /constraints/i }));
    expect(await screen.findByRole("table", { name: "Portfolio constraints" })).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Portfolio positions" })).toBeNull();
    expect(document.querySelectorAll("[data-caos-dominant-table-owner]")).toHaveLength(1);
    expect(window.location.search).toContain("dataset=constraints");
  });

  it("keeps working state and records when the persona emphasis changes", async () => {
    const view = render(<PortfolioLabWorkbench />);
    expect(await screen.findByText("Alpha Software")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /select alpha software/i }));
    const before = window.location.search;
    state.roleView = "pm";
    view.rerender(<PortfolioLabWorkbench />);
    expect(screen.getByText("Alpha Software")).toBeTruthy();
    expect(window.location.search).toBe(before);
  });

  it("previews before persisting a deterministic stress run", async () => {
    render(<PortfolioLabWorkbench />);
    await screen.findByRole("table", { name: "Portfolio positions" });
    fireEvent.click(screen.getByRole("button", { name: "Preview stress" }));
    expect(screen.getByText(/preview only/i)).toBeTruthy();
    expect(mocks.createStressRun).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm and persist" }));
    await waitFor(() => expect(mocks.createStressRun).toHaveBeenCalledWith("p1", expect.objectContaining({ book_price_shock_pct: -8 })));
    expect(await screen.findByText("fingerprint-1")).toBeTruthy();
    expect(screen.getByRole("article", { name: "Selected stress result" })).toBeTruthy();
    expect((screen.getByLabelText("View") as HTMLSelectElement).value).toBe("stress");
  });

  it("keeps positions usable when optional analytics, stress, and insight lanes fail", async () => {
    mocks.getAnalytics.mockRejectedValueOnce(new Error("analytics offline"));
    mocks.listStressRuns.mockRejectedValueOnce(new Error("stress offline"));
    mocks.listInsights.mockRejectedValueOnce(new Error("insight offline"));
    render(<PortfolioLabWorkbench />);
    expect(await screen.findByRole("table", { name: "Portfolio positions" })).toBeTruthy();
    expect(screen.getByText(/analytics offline/i)).toBeTruthy();
    expect(screen.getByText("stress offline")).toBeTruthy();
    expect(screen.getByText("insight offline")).toBeTruthy();
  });

  it("submits filters once instead of requesting on each keystroke", async () => {
    render(<PortfolioLabWorkbench />);
    await screen.findByRole("table", { name: "Portfolio positions" });
    mocks.getPositions.mockClear();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "beta" } });
    expect(mocks.getPositions).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "APPLY" }));
    await waitFor(() => expect(mocks.getPositions).toHaveBeenCalledWith("p1", expect.objectContaining({ text: "beta" })));
  });

  it("preserves the last good brief when a refresh degrades", async () => {
    const ready = {
      id: "ready-1", context_id: "ctx-1", surface: "portfolio-lab", kind: "portfolio-brief", status: "ready",
      subject_refs: { issuer_run_id: null, source_manifest_id: null, research_job_id: null, model_checkpoint_id: null, report_version_id: null, alert_event_id: null, sponsor_id: null, portfolio_id: "p1" }, summary: "Last committee-usable brief.", claims: [], recommended_actions: [], missing_dependencies: [],
      authority, source_fingerprint: "ready-fp", version: 1, model: null, generated_at: "2026-07-13T10:00:00Z",
      ratified_at: null, rejected_at: null, lease_owner: null, lease_expires_at: null,
    } as InsightArtifact;
    const partial = { ...ready, id: "partial-2", status: "partial", summary: "Incomplete refresh." } as InsightArtifact;
    mocks.listInsights.mockResolvedValueOnce({ items: [ready], current: ready, next_cursor: null });
    mocks.createInsight.mockResolvedValueOnce(partial);
    render(<PortfolioLabWorkbench />);
    expect(await screen.findByText("Last committee-usable brief.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Refresh cited brief" }));
    expect(await screen.findByText(/latest refresh is partial/i)).toBeTruthy();
    expect(screen.getByText("Last committee-usable brief.")).toBeTruthy();
    expect(screen.queryByText("Incomplete refresh.")).toBeNull();
  });

  it("shows an explicit empty configuration state", async () => {
    mocks.getPortfolios.mockResolvedValue([]);
    render(<PortfolioLabWorkbench />);
    expect(await screen.findByText(/no portfolios are configured/i)).toBeTruthy();
  });

  it("distinguishes empty datasets from loading", async () => {
    mocks.getPositions.mockResolvedValueOnce({ items: [], total: 0, next_cursor: null, as_of: "2026-06-30", authority });
    mocks.getAnalytics.mockResolvedValueOnce({ ...analytics, compliance: [] });
    render(<PortfolioLabWorkbench />);
    expect(await screen.findByText(/no positions match/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /constraints/i }));
    expect(await screen.findByText(/no portfolio constraints/i)).toBeTruthy();
  });

  it("does not mislabel a portfolio-list failure as empty configuration", async () => {
    mocks.getPortfolios.mockRejectedValue(new Error("portfolio directory offline"));
    render(<PortfolioLabWorkbench />);
    expect((await screen.findAllByText("portfolio directory offline")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/no portfolios are configured/i)).toBeNull();
  });

  it("drives keyboard tabs, URL-backed controls, pagination, and the primary stress action", async () => {
    window.history.replaceState({}, "", "/portfolios?portfolio=p1&context=ctx-1&dataset=positions&chart=concentration&sort=price&direction=desc");
    mocks.getPortfolios.mockResolvedValue([
      { id: "p1", name: "Credit Opportunities I", kind: "CLO", as_of_date: "2026-06-30", n_positions: 5000, total_nav: 9850000, total_par: 10000000, breaches: 1, watches: 0 },
      { id: "p2", name: "Credit Opportunities II", kind: "SMA", as_of_date: null, n_positions: 0, total_nav: null, total_par: null, breaches: 0, watches: 0 },
    ]);
    render(<PortfolioLabWorkbench />);
    await screen.findByRole("table", { name: "Portfolio positions" });
    expect(mocks.getPositions).toHaveBeenCalledWith("p1", expect.objectContaining({ sort: "price", direction: "desc" }));

    const tablist = screen.getByRole("tablist", { name: "Portfolio datasets" });
    const before = window.location.search;
    fireEvent.keyDown(tablist, { key: "Home" });
    expect(window.location.search).toBe(before);
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(await screen.findByRole("table", { name: "Portfolio constraints" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Constraints" }));
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(await screen.findByRole("table", { name: "Portfolio positions" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Positions" }));

    fireEvent.change(screen.getByLabelText("Portfolio"), { target: { value: "p2" } });
    await waitFor(() => expect(mocks.getPositions).toHaveBeenCalledWith("p2", expect.any(Object)));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "beta" } });
    fireEvent.change(screen.getByLabelText("Sector"), { target: { value: "Healthcare" } });
    fireEvent.change(screen.getByLabelText("Rating"), { target: { value: "B3" } });
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "maturity" } });
    fireEvent.click(screen.getByRole("button", { name: "Sort ascending" }));
    fireEvent.click(screen.getByRole("button", { name: "APPLY" }));
    await waitFor(() => expect(mocks.getPositions).toHaveBeenLastCalledWith("p2", expect.objectContaining({
      text: "beta", sector: "Healthcare", rating: "B3", sort: "maturity", direction: "asc",
    })));

    fireEvent.click(screen.getByRole("button", { name: "Next positions" }));
    await waitFor(() => expect(window.location.search).toContain("cursor=cursor-2"));
    fireEvent.change(screen.getByLabelText("View"), { target: { value: "ratings" } });
    expect((screen.getByLabelText("View") as HTMLSelectElement).value).toBe("ratings");
    fireEvent.click(screen.getByRole("button", { name: "Run portfolio stress" }));
    expect(screen.getByText("Preview only")).toBeTruthy();
  });

  it("renders sparse position, constraint, and stress records with explicit unavailable values", async () => {
    const sparse = {
      ...position,
      id: "pos-sparse", issuer_id: null, borrower_name: "Sparse Borrower", loan_name: null,
      ticker: null, sector: null, rating_moody: null, rating_sp: null, par_usd: null,
      price: Number.NaN, maturity: null, market_value: null,
    };
    const sparseAuthority = { ...authority, source_ids: [] };
    mocks.getPositions.mockResolvedValue({ items: [sparse], total: 1, next_cursor: null, as_of: null, authority: sparseAuthority });
    mocks.getAnalytics.mockResolvedValue({
      ...analytics,
      compliance: [{ code: null, category: null, parameter: null, limit_text: null, current: null, headroom: null, status: "Info" }],
      missing_dependencies: [],
    });
    mocks.listStressRuns.mockResolvedValue({
      items: [{ ...stressRun, output: { ...stressRun.output, base_nav: null, stressed_nav: null, loss_percent: null, missing_dependencies: ["market prices"] } }],
      total: 1,
      authority,
    });
    window.history.replaceState({}, "", "/portfolios?portfolio=p1&dataset=positions&selected=pos-sparse&stress=missing");
    render(<PortfolioLabWorkbench />);

    const table = await screen.findByRole("table", { name: "Portfolio positions" });
    expect(table.querySelector(".portfolio-lab__virtual-row")).toBeNull();
    expect(screen.getByText("Source identifier unavailable")).toBeTruthy();
    expect(screen.queryByText("Open issuer profile")).toBeNull();
    expect(screen.getByRole("article", { name: "Selected stress result" }).textContent).toContain("market prices");
    fireEvent.click(screen.getByRole("button", { name: "Base downside" }));

    fireEvent.click(screen.getByRole("tab", { name: "Constraints" }));
    expect(await screen.findByRole("table", { name: "Portfolio constraints" })).toBeTruthy();
    expect(screen.getByText("Unnamed")).toBeTruthy();
  });

  it("auto-selects the first portfolio and reports a positions failure", async () => {
    window.history.replaceState({}, "", "/portfolios?dataset=positions");
    mocks.getPositions.mockRejectedValue(new Error("position lane offline"));
    render(<PortfolioLabWorkbench />);
    expect((await screen.findAllByText("position lane offline")).length).toBeGreaterThan(0);
    expect(window.location.search).toContain("portfolio=p1");
  });

  it("covers stress persistence failure and its pending state", async () => {
    let rejectStress!: (reason: unknown) => void;
    mocks.createStressRun.mockReturnValue(new Promise((_, reject) => { rejectStress = reject; }));
    render(<PortfolioLabWorkbench />);
    await screen.findByRole("table", { name: "Portfolio positions" });
    fireEvent.click(screen.getByRole("button", { name: "Preview stress" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and persist" }));
    expect(await screen.findByRole("button", { name: "Persisting…" })).toBeTruthy();
    rejectStress(new Error("stress persist offline"));
    expect((await screen.findAllByText("stress persist offline")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Confirm and persist" })).toBeTruthy();
  });

  it("generates, ratifies, and refreshes ready or ratified cited briefs", async () => {
    const ready = makeInsight("ready");
    const ratified = makeInsight("ratified", { id: ready.id, summary: "ratified portfolio brief" });
    mocks.createInsight.mockResolvedValueOnce(ready).mockResolvedValueOnce(ratified);
    mocks.ratifyInsight.mockResolvedValue(ratified);
    render(<PortfolioLabWorkbench />);
    await screen.findByRole("table", { name: "Portfolio positions" });

    fireEvent.click(screen.getByRole("button", { name: "Generate cited brief" }));
    expect(await screen.findByText("ready portfolio brief")).toBeTruthy();
    expect(mocks.createInsight).toHaveBeenCalledWith("ctx-1", expect.objectContaining({ force: false }));
    fireEvent.click(screen.getByRole("button", { name: "Ratify cited brief" }));
    expect(await screen.findByText("ratified portfolio brief")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Refresh cited brief" }));
    await waitFor(() => expect(mocks.createInsight).toHaveBeenLastCalledWith("ctx-1", expect.objectContaining({ force: true })));
  });

  it("surfaces insight generation and ratification failures", async () => {
    const ready = makeInsight("ready");
    mocks.listInsights.mockResolvedValue({ items: [ready], current: ready, next_cursor: null });
    mocks.ratifyInsight.mockRejectedValue(new Error("ratification offline"));
    mocks.createInsight.mockRejectedValue(new Error("generation offline"));
    render(<PortfolioLabWorkbench />);
    expect(await screen.findByText("ready portfolio brief")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ratify cited brief" }));
    expect((await screen.findAllByText("ratification offline")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Refresh cited brief" }));
    expect((await screen.findAllByText("generation offline")).length).toBeGreaterThan(0);
  });

  it("guards insight creation without a context and stress or insight actions without a portfolio", async () => {
    state.contextId = null;
    render(<PortfolioLabWorkbench />);
    await screen.findByRole("table", { name: "Portfolio positions" });
    fireEvent.click(screen.getByRole("button", { name: "Generate cited brief" }));
    expect(mocks.listInsights).not.toHaveBeenCalled();
    expect(mocks.createInsight).not.toHaveBeenCalled();
    cleanup();

    state.contextId = "ctx-1";
    mocks.getPortfolios.mockResolvedValue([]);
    render(<PortfolioLabWorkbench />);
    await screen.findByText(/no portfolios are configured/i);
    fireEvent.click(screen.getByRole("button", { name: "Generate cited brief" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview stress" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and persist" }));
    expect(mocks.createInsight).not.toHaveBeenCalled();
    expect(mocks.createStressRun).not.toHaveBeenCalled();
  });

  it("renders QA persona emphasis and the constraint support fallback", async () => {
    state.roleView = "qa";
    mocks.getAnalytics.mockRejectedValue(new Error("analytics unavailable"));
    render(<PortfolioLabWorkbench />);
    expect(await screen.findByText("Evidence & compliance")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Constraints" }));
    expect(await screen.findByText("Constraint analytics unavailable. Positions remain accessible.")).toBeTruthy();
  });

  it("falls back from an unknown requested portfolio to the first available portfolio", async () => {
    window.history.replaceState({}, "", "/portfolios?portfolio=unknown&dataset=positions");
    render(<PortfolioLabWorkbench />);
    await waitFor(() => expect(mocks.getPositions).toHaveBeenCalledWith("p1", expect.any(Object)));
    expect(await screen.findByRole("table", { name: "Portfolio positions" })).toBeTruthy();
  });

  it("shows the constraint loading fallback before optional analytics settle", async () => {
    let resolveAnalytics!: (value: typeof analytics) => void;
    mocks.getAnalytics.mockReturnValue(new Promise((resolve) => { resolveAnalytics = resolve; }));
    render(<PortfolioLabWorkbench />);
    await screen.findByRole("table", { name: "Portfolio positions" });
    fireEvent.click(screen.getByRole("tab", { name: "Constraints" }));
    expect(screen.getByText("Loading portfolio data…")).toBeTruthy();
    resolveAnalytics(analytics);
    expect(await screen.findByRole("table", { name: "Portfolio constraints" })).toBeTruthy();
  });

  it("submits empty filters, toggles the default ascending sort, and preserves an empty context in issuer links", async () => {
    state.contextId = null;
    window.history.replaceState({}, "", "/portfolios?portfolio=p1&dataset=positions&selected=pos-1");
    render(<PortfolioLabWorkbench />);
    await screen.findByRole("table", { name: "Portfolio positions" });
    fireEvent.click(screen.getByRole("button", { name: "APPLY" }));
    fireEvent.click(screen.getByRole("button", { name: "Sort descending" }));
    await waitFor(() => expect(mocks.getPositions).toHaveBeenLastCalledWith("p1", expect.objectContaining({
      text: undefined, sector: undefined, rating: undefined, direction: "desc",
    })));
    expect((screen.getByText("Open issuer profile") as HTMLAnchorElement).href).toContain("context=");
  });

  it("ignores portfolio-list fulfillment, rejection, and support results after unmount", async () => {
    let resolveList!: (value: Awaited<ReturnType<typeof mocks.getPortfolios>>) => void;
    mocks.getPortfolios.mockReturnValue(new Promise((resolve) => { resolveList = resolve; }));
    const fulfilled = render(<PortfolioLabWorkbench />);
    fulfilled.unmount();
    resolveList([]);
    await Promise.resolve();

    let rejectList!: (reason: unknown) => void;
    mocks.getPortfolios.mockReturnValue(new Promise((_, reject) => { rejectList = reject; }));
    const rejected = render(<PortfolioLabWorkbench />);
    rejected.unmount();
    rejectList(new Error("late directory failure"));
    await Promise.resolve();

    mocks.getPortfolios.mockResolvedValue([{ id: "p1", name: "Credit Opportunities I", kind: "CLO", as_of_date: "2026-06-30", n_positions: 1, total_nav: 1, total_par: 1, breaches: 0, watches: 0 }]);
    let resolveAnalytics!: (value: typeof analytics) => void;
    let resolveStress!: (value: { items: typeof stressRun[]; total: number; authority: typeof authority }) => void;
    let resolveInsights!: (value: { items: InsightArtifact[]; current: InsightArtifact | null; next_cursor: null }) => void;
    mocks.getAnalytics.mockReturnValue(new Promise((resolve) => { resolveAnalytics = resolve; }));
    mocks.listStressRuns.mockReturnValue(new Promise((resolve) => { resolveStress = resolve; }));
    mocks.listInsights.mockReturnValue(new Promise((resolve) => { resolveInsights = resolve; }));
    const support = render(<PortfolioLabWorkbench />);
    await waitFor(() => expect(mocks.getAnalytics).toHaveBeenCalled());
    support.unmount();
    resolveAnalytics(analytics);
    resolveStress({ items: [], total: 0, authority });
    resolveInsights({ items: [], current: null, next_cursor: null });
    await Promise.all([Promise.resolve(), Promise.resolve()]);
  });
});

describe("Portfolio Lab semantic artifacts", () => {
  it("builds complete visualization metadata and equivalent data", () => {
    const spec = createPortfolioVisualizationSpec("concentration", analytics);
    expect(spec).toMatchObject({ kind: "bar", unit: "% NAV", asOf: "2026-06-30", sourceIds: ["portfolio:p1"] });
    expect(spec.accessibleSummary).toMatch(/Software/);
    expect(spec.tabularFallback.data).toHaveLength(1);
  });

  it("builds every visualization mode and its empty or unavailable summary", () => {
    expect(createPortfolioVisualizationSpec("ratings", analytics)).toMatchObject({
      kind: "bar", accessibleSummary: "B2 is the first reported rating bucket at 100%." ,
    });
    expect(createPortfolioVisualizationSpec("ratings", { ...analytics, rating_distribution: {} }).accessibleSummary).toBe("No rating distribution is available.");
    expect(createPortfolioVisualizationSpec("ratings", { ...analytics, rating_distribution: { NR: null } }).accessibleSummary).toContain("at —.");

    expect(createPortfolioVisualizationSpec("maturity", analytics).accessibleSummary).toContain("$9.9M");
    expect(createPortfolioVisualizationSpec("maturity", { ...analytics, maturity_wall: { "2030": null } }).accessibleSummary).toContain("unavailable exposure");
    expect(createPortfolioVisualizationSpec("maturity", { ...analytics, maturity_wall: {} }).accessibleSummary).toBe("No maturity schedule is available.");

    const within = { ...analytics, risk_budget: { status_counts: {}, headroom: [{ ...analytics.compliance[0], code: null, status: "Pass" as const }] } };
    expect(createPortfolioVisualizationSpec("risk", analytics).status).toEqual({ label: "Breach present", tone: "critical" });
    expect(createPortfolioVisualizationSpec("risk", within)).toMatchObject({
      status: { label: "Within limits", tone: "success" },
      accessibleSummary: "0 breached and 0 watched constraints are reported.",
      data: [{ code: "Unknown" }],
    });

    expect(createPortfolioVisualizationSpec("stress", analytics).accessibleSummary).toBe("No persisted stress snapshot is available.");
    expect(createPortfolioVisualizationSpec("stress", { ...analytics, latest_stress_runs: undefined }).accessibleSummary).toBe("No persisted stress snapshot is available.");
    expect(createPortfolioVisualizationSpec("stress", { ...analytics, latest_stress_runs: [{
      id: "s1", label: "Downside", status: "complete", source_fingerprint: "fp",
      base_nav: 10, stressed_nav: 9, loss_amount: 1, loss_percent: 10, created_at: "2026-01-01",
    }] }).accessibleSummary).toContain("latest is Downside");

    expect(createPortfolioVisualizationSpec("concentration", { ...analytics, as_of: null, concentration: { ...analytics.concentration, sectors: [] } })).toMatchObject({
      asOf: undefined,
      accessibleSummary: "No sector concentration is available.",
    });
    expect(createPortfolioVisualizationSpec("concentration", { ...analytics, concentration: { ...analytics.concentration, sectors: [{ sector: "Mixed", mv: null, pct_nav: Number.NaN, n_obligors: 2 }] } }).accessibleSummary).toContain("across 2 obligors");
  });

  it("invokes the ready insight ratification control", () => {
    const onRatify = vi.fn();
    render(<PortfolioInsightCard insight={makeInsight("ready")} onRatify={onRatify} />);
    fireEvent.click(screen.getByRole("button", { name: "Ratify cited brief" }));
    expect(onRatify).toHaveBeenCalledOnce();
  });

  it.each(["ready", "partial", "stale", "ratified"] as const)("labels %s insights as advisory and cited", (status) => {
    const insight = {
      id: "insight-1", context_id: "ctx-1", surface: "portfolio-lab", kind: "portfolio-brief", status,
      subject_refs: { issuer_run_id: null, source_manifest_id: null, research_job_id: null, model_checkpoint_id: null, report_version_id: null, alert_event_id: null, sponsor_id: null, portfolio_id: "p1" },
      summary: "Concentration transmits through Software exposure.",
      claims: [{ id: "c1", statement: "Software is binding.", evidence_ids: ["portfolio:p1"], numeric_facts: [{ label: "Software", value: 100, unit: "% NAV" }] }],
      recommended_actions: ["Review sizing"], missing_dependencies: [], authority,
      source_fingerprint: "insight-fp", version: 1, model: "test", generated_at: "2026-07-13T10:00:00Z",
      ratified_at: status === "ratified" ? "2026-07-13T11:00:00Z" : null, rejected_at: null, lease_owner: null, lease_expires_at: null,
    } satisfies InsightArtifact;
    render(<PortfolioInsightCard insight={insight} />);
    expect(screen.getByText(status)).toBeTruthy();
    expect(screen.getByText(/advisory synthesis/i)).toBeTruthy();
    expect(screen.getByText("portfolio:p1")).toBeTruthy();
  });
});
