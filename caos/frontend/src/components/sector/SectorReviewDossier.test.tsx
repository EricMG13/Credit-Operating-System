// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  roleView: { value: "analyst" },
  contextState: {
    context: { id: "ctx-1", sector_id: "telecom", sector_review_run_id: "review-1" as string | null },
    patch: vi.fn().mockResolvedValue(undefined),
    setContext: vi.fn(),
    loading: false,
    error: null as string | null,
    mutationError: null as string | null,
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

type TestPageAction = { label: string; onAction?: () => void; href?: string; unavailableReason?: string | null };
function renderPageAction(action?: TestPageAction) {
  if (!action) return null;
  if (action.href && !action.unavailableReason) return <a href={action.href}>{action.label}</a>;
  return <button type="button" aria-disabled={action.unavailableReason ? "true" : undefined} onClick={action.unavailableReason ? undefined : action.onAction}>{action.label}</button>;
}

vi.mock("next/link", () => ({ default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/shared/AnalysisWorkbench", () => ({
  AnalysisStateBadge: ({ state }: { state: string }) => <span>state {state}</span>,
  AuthorityLine: () => <span>authority line</span>,
  FindingsTray: ({ contextId }: { contextId: string }) => <span>findings {contextId}</span>,
}));
vi.mock("@/components/shared/ConceptNav", () => ({ ConceptNav: () => <span>concept nav</span> }));
vi.mock("@/components/shared/DecisionHeader", () => ({ DecisionHeader: ({ state }: { state: Record<string, { kind: string; authority?: { approval?: string } }> }) => <div>decision {Object.values(state).map((item) => item.kind).join(" ")}<span>approval {Object.values(state).map((item) => item.authority?.approval ?? "NONE").join(" ")}</span></div> }));
vi.mock("@/components/shared/EnterprisePage", () => ({ EnterprisePage: ({ identity, status, primaryAction, contextualControls, utilityControls, finalizationBar, children }: { identity?: React.ReactNode; status?: React.ReactNode; primaryAction?: TestPageAction; contextualControls?: React.ReactNode; utilityControls?: React.ReactNode; finalizationBar?: React.ReactNode; children: React.ReactNode }) => <main>{identity}{renderPageAction(primaryAction)}{status}{contextualControls}{utilityControls}{finalizationBar}{children}</main> }));
vi.mock("@/components/shared/PersonaWorkbench", () => ({ PersonaWorkbench: ({ decision, context, primary, inspector }: { decision?: React.ReactNode; context?: React.ReactNode; primary: React.ReactNode; inspector?: React.ReactNode }) => <>{decision}{context}{primary}{inspector}</> }));
vi.mock("@/components/shared/RoleViewProvider", () => ({ useRoleView: () => ({ roleView: mocks.roleView.value }) }));
vi.mock("@/components/shared/headStat", () => ({ headStat: (label: string, value: string) => <span>{label}: {value}</span> }));
vi.mock("./SectorReviewPanels", () => ({
  SECTOR_REVIEW_TABS: [
    { id: "overview", label: "Overview" }, { id: "signals", label: "Signals" },
    { id: "comparables", label: "Comparables" }, { id: "risks", label: "Risks" },
    { id: "early-warning", label: "Early Warning" }, { id: "sources", label: "Sources" },
  ],
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
  mocks.ratifySectorReview.mockImplementation(async (_id: string, decisions: Array<{ section_id: string }>) => decisions.some((decision) => decision.section_id === "section-2")
    ? { ...review, authority: { ...authority, approval_state: "ratified" }, ratifications: { "section-1": "ratified", "section-2": "ratified" } }
    : { ...review, ratifications: { "section-1": "ratified" } });
  mocks.publishSectorReview.mockResolvedValue({ ...review, authority: { ...authority, approval_state: "published" } });
  mocks.contextState.loading = false;
  mocks.contextState.error = null;
  mocks.contextState.mutationError = null;
  mocks.contextState.patch.mockResolvedValue(mocks.contextState.context);
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
    expect(screen.getByText("Confirm ratification scope · Pricing")).toBeTruthy();
    expect(mocks.ratifySectorReview).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Confirm ratify 1 section" }));
    await waitFor(() => expect(mocks.ratifySectorReview).toHaveBeenLastCalledWith("review-1", [
      { section_id: "section-2", decision: "ratified" },
    ]));
    fireEvent.click(await screen.findByRole("button", { name: "Publish review" }));
    await waitFor(() => expect(mocks.publishSectorReview).toHaveBeenCalledWith("review-1"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Ratify updates" })).toBeNull());
    expect(screen.getByText(/approval RATIFIED RATIFIED RATIFIED RATIFIED/)).toBeTruthy();

    expect(screen.getByRole("button", { name: "Overview" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Signals" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Comparables" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Risks" })).toBeTruthy();
    const moreSummary = screen.getByText("More");
    const more = moreSummary.closest("details");
    expect(more).toBeTruthy();
    expect(more?.parentElement?.className).not.toContain("overflow-x-auto");
    fireEvent.click(moreSummary);
    expect(more?.hasAttribute("open")).toBe(true);
    expect(more?.querySelector("[data-sector-more-menu]")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sources" }));
    expect(mocks.updateUrlState).toHaveBeenCalledWith({ tab: "sources" });
    fireEvent.click(screen.getByRole("button", { name: "select section" }));
    expect(mocks.updateUrlState).toHaveBeenCalledWith({ section: "section-2" }, "replace");
    fireEvent.change(screen.getByLabelText("Compare version"), { target: { value: "" } });
    expect(mocks.updateUrlState).toHaveBeenCalledWith({ compare: null });

    fireEvent.click(screen.getAllByRole("switch", { name: "Alert coverage · active" })[0]);
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

  it("keeps the refresh action name stable while refresh is in progress", async () => {
    let resolveRefresh!: (value: typeof review) => void;
    mocks.createSectorReview.mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    render(<SectorReviewDossier />);
    const readyAction = await screen.findByRole("button", { name: "Request refresh" });
    fireEvent.click(readyAction);
    await waitFor(() => expect(mocks.createSectorReview).toHaveBeenCalledOnce());

    const pendingAction = screen.getByRole("button", { name: "Request refresh" });
    expect(pendingAction.getAttribute("aria-disabled")).toBe("true");
    await act(async () => resolveRefresh(review));
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

  it("surfaces history and refresh failures without restoring cold-state side rails", async () => {
    mocks.listSectorReviews.mockRejectedValueOnce(new Error("history"));
    mocks.createSectorReview.mockRejectedValueOnce(new Error("refresh"));
    render(<SectorReviewDossier />);
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("Sector review history unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Request refresh" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Sector review refresh failed"));
    expect(screen.queryByLabelText("Canonical sectors")).toBeNull();
    expect(screen.queryByLabelText("Sector evidence inspector")).toBeNull();
  });

  it("surfaces feed persistence failure while a populated dossier remains visible", async () => {
    mocks.updateSectorFeeds.mockRejectedValueOnce(new Error("feed"));
    render(<SectorReviewDossier />);
    const feed = (await screen.findAllByRole("switch", { name: "Alert coverage · active" }))[0];
    fireEvent.click(feed);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Feed preference could not be saved"));
    expect((screen.getAllByRole("switch")[0] as HTMLButtonElement).disabled).toBe(false);
  });

  it("surfaces taxonomy and feed read failures instead of presenting authoritative empty reference data", async () => {
    mocks.getTaxonomy.mockRejectedValueOnce(new Error("taxonomy"));
    mocks.getSectorFeeds.mockRejectedValueOnce(new Error("feeds"));
    render(<SectorReviewDossier />);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Sector taxonomy unavailable."));
    expect(screen.getByRole("alert").textContent).toContain("Sector feed preferences unavailable.");
  });

  it("surfaces section-ratification rejection without discarding the active dossier", async () => {
    mocks.ratifySectorReview.mockRejectedValueOnce(new Error("ratification rejected"));
    render(<SectorReviewDossier />);
    expect(await screen.findByText(/review content review-1/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ratify section" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Section ratification failed."));
    expect(screen.getByText(/review content review-1/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Ratify section" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("surfaces publication-gate rejection without losing the ratified review", async () => {
    const ratified = {
      ...review,
      authority: { ...authority, approval_state: "ratified" },
      ratifications: { "section-1": "ratified", "section-2": "ratified" },
    };
    mocks.listSectorReviews.mockResolvedValueOnce([ratified]);
    mocks.publishSectorReview.mockRejectedValueOnce(new Error("publication rejected"));
    render(<SectorReviewDossier />);

    const publish = await screen.findByRole("button", { name: "Publish review" });
    fireEvent.click(publish);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Publication gates are not satisfied."));
    expect(screen.getByText(/review content review-1/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Publish review" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("preserves the prior dossier and recovers controls when a sector change cannot be saved", async () => {
    mocks.contextState.patch.mockRejectedValueOnce(new Error("offline"));
    render(<SectorReviewDossier />);
    expect(await screen.findByText(/review content review-1/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Technology/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Sector change could not be saved"));
    expect(screen.getByText(/review content review-1/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Technology/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("serializes feed updates, disables competing mutations, and recovers after the request settles", async () => {
    let resolveFeed!: (value: Array<{ sector: string; enabled: boolean; notify_pref: string; provenance: string }>) => void;
    mocks.updateSectorFeeds.mockImplementationOnce(() => new Promise((resolve) => { resolveFeed = resolve; }));
    render(<SectorReviewDossier />);
    const feed = (await screen.findAllByRole("switch", { name: "Alert coverage · active" }))[0];

    fireEvent.click(feed);
    fireEvent.click(feed);
    expect(mocks.updateSectorFeeds).toHaveBeenCalledOnce();
    expect((screen.getAllByRole("switch")[0] as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Technology/ }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => resolveFeed([{ sector: "Telecom", enabled: false, notify_pref: "email", provenance: "profile" }]));
    await waitFor(() => expect((screen.getByRole("switch", { name: "Alert coverage · inactive" }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("updates section URL state without refetching history and falls back from invalid tab and compare values", async () => {
    mocks.roleView.value = "qa";
    mocks.urlValues.tab = "not-a-tab";
    mocks.urlValues.compare = "missing-review";
    const { rerender } = render(<SectorReviewDossier />);
    expect(await screen.findByText(/review content review-1 sources/)).toBeTruthy();
    expect(screen.queryByText(/Source count/)).toBeNull();
    expect(mocks.listSectorReviews).toHaveBeenCalledOnce();

    mocks.urlValues.section = "section-2";
    rerender(<SectorReviewDossier />);
    await waitFor(() => expect(mocks.listSectorReviews).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: /Telecom/ }));
    expect(mocks.contextState.patch).not.toHaveBeenCalled();
  });

  it("does not resurrect another sector's dossier when the active context sector changes", async () => {
    const { rerender } = render(<SectorReviewDossier />);
    expect(await screen.findByText(/review content review-1/)).toBeTruthy();

    mocks.contextState.context = {
      id: "ctx-1",
      sector_id: "software",
      sector_review_run_id: null,
    };
    mocks.listSectorReviews.mockResolvedValueOnce([review, prior]);
    rerender(<SectorReviewDossier />);

    await waitFor(() => expect(screen.getByText(/review content none/)).toBeTruthy());
    expect(screen.queryByText(/review content review-1/)).toBeNull();
  });

  it("ignores a superseded history response after the analysis context changes", async () => {
    const review2 = { ...review, id: "review-2", context_id: "ctx-2", sector_id: "technology", sector_label: "Technology" };
    let resolveFirst!: (value: typeof review[]) => void;
    let resolveSecond!: (value: typeof review[]) => void;
    mocks.listSectorReviews.mockReset();
    mocks.listSectorReviews
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    const { rerender } = render(<SectorReviewDossier />);
    expect(screen.getByText(/review content loading/)).toBeTruthy();

    mocks.contextState.context = { id: "ctx-2", sector_id: "technology", sector_review_run_id: "review-2" };
    rerender(<SectorReviewDossier />);
    await act(async () => resolveSecond([review2]));
    expect(await screen.findByText(/review content review-2/)).toBeTruthy();

    await act(async () => resolveFirst([review]));
    expect(screen.getByText(/review content review-2/)).toBeTruthy();
    expect(screen.queryByText(/review content review-1/)).toBeNull();
  });
});
