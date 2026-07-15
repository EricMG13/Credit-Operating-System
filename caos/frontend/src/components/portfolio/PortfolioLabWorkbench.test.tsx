// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const state = vi.hoisted(() => ({ roleView: "analyst" as "analyst" | "pm" | "qa" }));
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
    useAnalysisContext: () => ({ context: { id: "ctx-1", name: "Portfolio Lab" }, loading: false, error: null, patch: vi.fn() }),
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

afterEach(cleanup);

beforeEach(() => {
  window.history.replaceState({}, "", "/portfolios?portfolio=p1&context=ctx-1&dataset=positions&chart=concentration");
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) });
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver;
  state.roleView = "analyst";
  mocks.getPortfolios.mockReset().mockResolvedValue([{ id: "p1", name: "Credit Opportunities I", kind: "CLO", as_of_date: "2026-06-30", n_positions: 5000, total_nav: 9850000, total_par: 10000000, breaches: 1, watches: 0 }]);
  mocks.getPositions.mockReset().mockResolvedValue({ items: [position], total: 5000, next_cursor: "cursor-2", as_of: "2026-06-30", authority });
  mocks.getAnalytics.mockReset().mockResolvedValue(analytics);
  mocks.listStressRuns.mockReset().mockResolvedValue({ items: [], total: 0, authority });
  mocks.createStressRun.mockReset().mockResolvedValue({ id: "stress-1", portfolio_id: "p1", label: "Base downside", input: { label: "Base downside", book_price_shock_pct: -8, sector_shock_pcts: {} }, output: { base_nav: 9850000, stressed_nav: 9062000, loss_amount: 788000, loss_percent: 8, authority, missing_dependencies: [] }, source_fingerprint: "fingerprint-1", authority, status: "complete", created_at: "2026-07-13T10:00:00Z", updated_at: "2026-07-13T10:00:00Z" });
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
});

describe("Portfolio Lab semantic artifacts", () => {
  it("builds complete visualization metadata and equivalent data", () => {
    const spec = createPortfolioVisualizationSpec("concentration", analytics);
    expect(spec).toMatchObject({ kind: "bar", unit: "% NAV", asOf: "2026-06-30", sourceIds: ["portfolio:p1"] });
    expect(spec.accessibleSummary).toMatch(/Software/);
    expect(spec.tabularFallback.data).toHaveLength(1);
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
