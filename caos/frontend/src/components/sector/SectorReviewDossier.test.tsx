// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  roleView: { value: "analyst" },
  contextState: {
    context: { id: "ctx-1", sector_id: "telecom", sector_review_run_id: "review-1" },
    patch: vi.fn().mockResolvedValue(undefined),
    setContext: vi.fn(),
  },
  urlValues: { tab: null as string | null, section: null as string | null, compare: "review-0" as string | null },
  updateUrlState: vi.fn(),
  getTaxonomy: vi.fn(),
  listSectorReviews: vi.fn(),
  createSectorReview: vi.fn(),
  ratifySectorReview: vi.fn(),
  publishSectorReview: vi.fn(),
  getSectorFeeds: vi.fn(),
  updateSectorFeeds: vi.fn(),
}));

vi.mock("next/link", () => ({ default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/shared/AnalysisWorkbench", () => ({
  AnalysisStateBadge: ({ state }: { state: string }) => <span>state {state}</span>,
  AuthorityLine: () => <span>authority line</span>,
  FindingsTray: ({ contextId }: { contextId: string }) => <span>findings {contextId}</span>,
}));
vi.mock("@/components/shared/ConceptNav", () => ({ ConceptNav: () => <span>concept nav</span> }));
vi.mock("@/components/shared/DecisionHeader", () => ({ DecisionHeader: ({ state }: { state: Record<string, { kind: string }> }) => <div>decision {Object.values(state).map((item) => item.kind).join(" ")}</div> }));
vi.mock("@/components/shared/EnterprisePage", () => ({ EnterprisePage: ({ identity, status, contextualControls, utilityControls, finalizationBar, children }: { identity?: React.ReactNode; status?: React.ReactNode; contextualControls?: React.ReactNode; utilityControls?: React.ReactNode; finalizationBar?: React.ReactNode; children: React.ReactNode }) => <main>{identity}{status}{contextualControls}{utilityControls}{finalizationBar}{children}</main> }));
vi.mock("@/components/shared/PersonaWorkbench", () => ({ PersonaWorkbench: ({ decision, context, primary, inspector }: { decision?: React.ReactNode; context?: React.ReactNode; primary: React.ReactNode; inspector?: React.ReactNode }) => <>{decision}{context}{primary}{inspector}</> }));
vi.mock("@/components/shared/RoleViewProvider", () => ({ useRoleView: () => ({ roleView: mocks.roleView.value }) }));
vi.mock("@/components/shared/headStat", () => ({ headStat: (label: string, value: string) => <span>{label}: {value}</span> }));
vi.mock("./SectorReviewPanels", () => ({
  SECTOR_REVIEW_TABS: [{ id: "overview", label: "Overview" }, { id: "sources", label: "Sources" }],
  SectorReviewContent: ({ review, tab, onSelectSection, loading }: { review: { id: string } | null; tab: string; onSelectSection: (id: string) => void; loading?: boolean }) => <div>review content {loading ? "loading" : review?.id ?? "none"} {tab}<button onClick={() => onSelectSection("section-2")}>select section</button></div>,
}));
vi.mock("@/lib/api", () => ({
  getSectorFeeds: mocks.getSectorFeeds,
  updateSectorFeeds: mocks.updateSectorFeeds,
  toErrorMessage: (_reason: unknown, fallback: string) => fallback,
}));
vi.mock("@/lib/analysis-workbench", () => ({
  useAnalysisContext: () => mocks.contextState,
  contextHref: (path: string, id: string, extra?: Record<string, string>) => `${path}?context=${id}${extra ? `&section=${extra.section}` : ""}`,
  analysisApi: {
    getTaxonomy: mocks.getTaxonomy,
    listSectorReviews: mocks.listSectorReviews,
    createSectorReview: mocks.createSectorReview,
    ratifySectorReview: mocks.ratifySectorReview,
    publishSectorReview: mocks.publishSectorReview,
  },
}));
vi.mock("@/lib/typed-url-state", () => ({ useTypedUrlState: () => ({ values: mocks.urlValues, update: mocks.updateUrlState }) }));

import { SectorReviewDossier } from "./SectorReviewDossier";

const authority = {
  origin: "live", method: "sector engine", freshness: "current", as_of: "2026-07-17T00:00:00Z",
  source_ids: ["source-1"], run_id: "run-1", version_id: "v1", confidence: 0.8,
  approval_state: "draft", analyst_override: null,
};

const review = {
  id: "review-1", context_id: "ctx-1", sector_id: "telecom", sector_label: "Telecom", timeframe: "weekly", version: 2,
  status: "ready", as_of: "2026-07-17T00:00:00Z", posture: "cautious", what_changed: "Spreads widened",
  why_it_matters: "Refinancing risk", required_action: "Review maturities", evidence_health: "Current",
  sections: [
    { id: "section-1", title: "Demand", posture: "stable", summary: "Demand is stable", confidence: 0.8, freshness: "current", signal_ids: ["s1"] },
    { id: "section-2", title: "Pricing", posture: "weak", summary: "Pricing weakened", confidence: 0.6, freshness: "stale", signal_ids: [] },
  ],
  dimension_scores: [], risks: [], comparables: [], early_warning: [],
  source_register: [{ id: "source-1", title: "Filing", origin: "live", method: "reported", freshness: "current", as_of: "2026-07-17", url: null }],
  uncertainties: [], downstream_readiness: { ready: false, consumers: ["reports"], blocked_by: ["pricing"] },
  missing_dependencies: [], authority, ratifications: {}, created_at: "2026-07-17T00:00:00Z",
};

const prior = { ...review, id: "review-0", version: 1, posture: "stable", source_register: [] };

beforeEach(() => {
  mocks.roleView.value = "analyst";
  mocks.contextState.context = { id: "ctx-1", sector_id: "telecom", sector_review_run_id: "review-1" };
  mocks.urlValues.tab = null;
  mocks.urlValues.section = null;
  mocks.urlValues.compare = "review-0";
  mocks.getTaxonomy.mockResolvedValue([{ id: "telecom", label: "Telecom" }, { id: "technology", label: "Technology" }]);
  mocks.getSectorFeeds.mockResolvedValue([{ sector: "Telecom", enabled: true, notify_pref: "email", provenance: "profile" }]);
  mocks.updateSectorFeeds.mockImplementation(async (feeds: unknown) => feeds);
  mocks.listSectorReviews.mockResolvedValue([review, prior]);
  mocks.createSectorReview.mockResolvedValue(review);
  mocks.ratifySectorReview.mockImplementation(async (_id: string, decisions: unknown[]) => decisions.length === 1
    ? { ...review, ratifications: { "section-1": "ratified" } }
    : { ...review, authority: { ...authority, approval_state: "ratified" }, ratifications: { "section-1": "ratified", "section-2": "ratified" } });
  mocks.publishSectorReview.mockResolvedValue({ ...review, authority: { ...authority, approval_state: "published" } });
  mocks.contextState.patch.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SectorReviewDossier", () => {
  it("renders the current dossier and exercises review, navigation, feed, and sector actions", async () => {
    render(<SectorReviewDossier />);
    expect(await screen.findByText("Demand is stable")).toBeTruthy();
    expect(screen.getByText(/Blocked · pricing/)).toBeTruthy();
    expect(screen.getByText(/v1 stable → v2 cautious/)).toBeTruthy();
    expect(screen.getByText(/decision ready ready ready ready/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ratify section" }));
    await waitFor(() => expect(mocks.ratifySectorReview).toHaveBeenCalledWith("review-1", [{ section_id: "section-1", decision: "ratified" }]));
    fireEvent.click(screen.getByRole("button", { name: "Ratify updates" }));
    await waitFor(() => expect(mocks.ratifySectorReview).toHaveBeenLastCalledWith("review-1", [
      { section_id: "section-1", decision: "ratified" },
      { section_id: "section-2", decision: "ratified" },
    ]));
    fireEvent.click(screen.getByRole("button", { name: "Publish review" }));
    await waitFor(() => expect(mocks.publishSectorReview).toHaveBeenCalledWith("review-1"));

    fireEvent.click(screen.getByRole("button", { name: "Sources" }));
    expect(mocks.updateUrlState).toHaveBeenCalledWith({ tab: "sources" });
    fireEvent.click(screen.getByRole("button", { name: "select section" }));
    expect(mocks.updateUrlState).toHaveBeenCalledWith({ section: "section-2" }, "replace");
    fireEvent.change(screen.getByLabelText("Compare version"), { target: { value: "" } });
    expect(mocks.updateUrlState).toHaveBeenCalledWith({ compare: null });

    fireEvent.click(screen.getAllByRole("switch", { name: "Alerts on" })[0]);
    await waitFor(() => expect(mocks.updateSectorFeeds).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /Technology/ }));
    await waitFor(() => expect(mocks.contextState.patch).toHaveBeenCalledWith({ sector_id: "technology", sector_review_run_id: null, rv_run_id: null }));
  });

  it("refreshes partial work and binds the returned review to the context", async () => {
    const partial = { ...review, status: "partial", missing_dependencies: ["pricing"], authority: { ...authority, freshness: "stale", approval_state: "draft" } };
    const refreshed = { ...review, id: "review-2", version: 3 };
    mocks.listSectorReviews.mockResolvedValueOnce([partial]);
    mocks.createSectorReview.mockResolvedValueOnce(refreshed);
    render(<SectorReviewDossier />);
    const refresh = await screen.findByRole("button", { name: "Request refresh" });
    expect(screen.getByText(/decision partial partial partial partial/)).toBeTruthy();
    fireEvent.click(refresh);
    await waitFor(() => expect(mocks.createSectorReview).toHaveBeenCalledWith({ context_id: "ctx-1", sector_id: "telecom", timeframe: "weekly" }));
    expect(mocks.contextState.setContext).toHaveBeenCalledWith(expect.objectContaining({ sector_review_run_id: "review-2" }));
  });

  it("renders a loading state instead of an authoritative empty state while the history fetch is in flight", async () => {
    let resolveHistory!: (rows: typeof review[]) => void;
    mocks.listSectorReviews.mockReturnValueOnce(new Promise((resolve) => { resolveHistory = resolve; }));
    render(<SectorReviewDossier />);

    // Before the fetch settles: must read as "loading", never as the
    // authoritative "no versioned review" copy the P0 fix replaces.
    expect(screen.getByText(/review content loading/)).toBeTruthy();
    expect(screen.getByText(/decision loading loading loading loading/)).toBeTruthy();
    expect(screen.queryByText(/No change observation/)).toBeNull();

    resolveHistory([review]);
    await waitFor(() => expect(screen.getByText(/decision ready ready ready ready/)).toBeTruthy());
    expect(screen.getByText(/review content review-1/)).toBeTruthy();
  });

  it("surfaces history, refresh, and feed persistence failures", async () => {
    mocks.listSectorReviews.mockRejectedValueOnce(new Error("history"));
    mocks.createSectorReview.mockRejectedValueOnce(new Error("refresh"));
    mocks.updateSectorFeeds.mockRejectedValueOnce(new Error("feed"));
    render(<SectorReviewDossier />);
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("Sector review history unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Request refresh" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Sector review refresh failed"));
    fireEvent.click(screen.getAllByRole("switch", { name: "Alerts on" })[0]);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Feed preference could not be saved"));
  });
});
