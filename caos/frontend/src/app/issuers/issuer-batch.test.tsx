// @vitest-environment jsdom
// WP-10 — Issuers directory row checkboxes + BatchBar. Locks the wiring: only
// the three real actions from the master plan (Run pipeline / Add to
// watchlist / Export CSV) ever appear, Run pipeline reports honest per-item
// partial failure (never a fake blanket "done"), and Add to watchlist is one
// read-merge-PUT for the whole selection, not one per row.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import IssuersPage from "./page";
import type { Issuer } from "@/types/issuers";
import type { AnalysisContext, AnalysisSurfaceStateEntry } from "@/lib/analysis-workbench";
import { DEMO_UNIVERSE } from "@/lib/issuer-demo";

const analysisState = vi.hoisted(() => ({
  context: null as AnalysisContext | null,
  patch: vi.fn(),
  retryLastPatch: vi.fn(),
}));
const overlayState = vi.hoisted(() => ({ openProfile: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/issuers",
  useRouter: () => ({ push: routerPush, replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/shared/IssuerProfileOverlay", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/shared/IssuerProfileOverlay")>()),
  useIssuerProfileOverlay: () => ({ openProfile: overlayState.openProfile }),
}));
vi.mock("@/lib/analysis-workbench", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analysis-workbench")>()),
  useAnalysisContext: () => ({
    context: analysisState.context,
    patch: analysisState.patch,
    loading: false,
    error: null,
    mutationState: "idle" as const,
    mutationError: null,
    retryLastPatch: analysisState.retryLastPatch,
  }),
}));
// jsdom has no URL.createObjectURL — downloadCsv's real anchor-click download
// path throws there. csvCell stays real (importOriginal) so CSV-cell escaping
// is still exercised; only the DOM side-effect is stubbed.
vi.mock("@/lib/csv", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/csv")>()),
  downloadCsv: vi.fn(),
}));

const getIssuers = vi.fn();
const createIssuer = vi.fn();
const createRun = vi.fn();
const getWatchlist = vi.fn();
const saveWatchlist = vi.fn();
const routerPush = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getIssuers: (...a: unknown[]) => getIssuers(...a),
  createIssuer: (...a: unknown[]) => createIssuer(...a),
  createRun: (...a: unknown[]) => createRun(...a),
  getWatchlist: (...a: unknown[]) => getWatchlist(...a),
  saveWatchlist: (...a: unknown[]) => saveWatchlist(...a),
}));

const ISSUERS: Issuer[] = [
  { id: "iss-1", name: "Atlas Forge Industrials", ticker: "ATLF", sector: "Industrials", country: "United States", rating_sp: "B2" },
  { id: "iss-2", name: "Kestrel Chemicals", ticker: "KSTL", sector: "Chemicals", country: "United Kingdom", rating_sp: "CCC+" },
];

function makeContext(issuers: AnalysisSurfaceStateEntry = {}, issuerIds: string[] = []): AnalysisContext {
  return {
    id: "ctx-issuers",
    revision: 1,
    name: "Coverage universe",
    sector_id: null,
    sub_segments: [],
    issuer_ids: issuerIds,
    instrument_ids: [],
    portfolio_scope: null,
    as_of: null,
    sector_review_run_id: null,
    rv_snapshot_id: null,
    rv_run_id: null,
    query_session_id: null,
    artifacts: {
      issuer_run_id: null,
      source_manifest_id: null,
      research_job_id: null,
      model_checkpoint_id: null,
      report_version_id: null,
      alert_event_id: null,
      sponsor_id: null,
    },
    surface_state: { issuers },
    filters: {},
    selected: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  analysisState.context = null;
  window.history.replaceState({}, "", "/issuers");
});

async function renderSelectedTwo() {
  getIssuers.mockResolvedValue(ISSUERS);
  render(<IssuersPage />);
  fireEvent.click(await screen.findByRole("checkbox", { name: "Select Atlas Forge Industrials" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Select Kestrel Chemicals" }));
  await waitFor(() => expect(screen.getByText("2 issuers selected")).toBeTruthy());
  return within(screen.getByRole("toolbar", { name: "Batch actions" }));
}

describe("Issuers directory — batch selection", () => {
  it("shows no BatchBar until a row is selected", async () => {
    getIssuers.mockResolvedValue(ISSUERS);
    render(<IssuersPage />);
    await screen.findByText("Atlas Forge Industrials");
    expect(screen.queryByRole("toolbar", { name: "Batch actions" })).toBeNull();
    expect(document.querySelector("[data-issuer-logo-placeholder]")).toBeNull();
    expect(document.querySelector(".issuer-register-panel")?.className).not.toContain("h-full");
  });

  it("selecting rows exposes exactly the three real actions — never delete/refresh/assign", async () => {
    const toolbar = await renderSelectedTwo();
    expect(toolbar.getByRole("button", { name: "Run pipeline (2)" })).toBeTruthy();
    expect(toolbar.getByRole("button", { name: "Add to watchlist (2)" })).toBeTruthy();
    expect(toolbar.getByRole("button", { name: "Export CSV" })).toBeTruthy();
    for (const bad of [/delete/i, /refresh/i, /assign/i]) {
      expect(toolbar.queryByRole("button", { name: bad })).toBeNull();
    }
  });

  it("Run pipeline is sequential and reports the 429's server detail verbatim as a partial failure", async () => {
    createRun.mockImplementation(async (issuerId: string) => {
      if (issuerId === "iss-2") {
        throw { response: { status: 429, data: { detail: "Run rate limit reached — try again in a minute." } } };
      }
      return { id: "run-ok", issuer_id: issuerId, status: "queued" };
    });
    const toolbar = await renderSelectedTwo();
    fireEvent.click(toolbar.getByRole("button", { name: "Run pipeline (2)" }));
    expect(createRun).not.toHaveBeenCalled();
    expect(screen.getByText(/Queue 2 new pipeline runs/)).toBeTruthy();
    fireEvent.click(toolbar.getByRole("button", { name: "Confirm Run pipeline (2)" }));
    await waitFor(() => expect(screen.getByText("1/2 succeeded")).toBeTruthy());
    expect(createRun).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText("1 failed — details"));
    expect(toolbar.getByRole("listitem").textContent).toContain("Kestrel Chemicals — Run rate limit reached");
    // Never a blanket "done" — the failing issuer's own attempt is visible in the ratio.
    expect(screen.queryByText("2 succeeded")).toBeNull();
  });

  it("Add to watchlist does one read-merge-PUT for the whole selection, not one per row", async () => {
    getWatchlist.mockResolvedValue({ issuer_ids: ["existing-1"] });
    saveWatchlist.mockResolvedValue({ issuer_ids: ["existing-1", "iss-1", "iss-2"] });
    const toolbar = await renderSelectedTwo();
    fireEvent.click(toolbar.getByRole("button", { name: "Add to watchlist (2)" }));
    await waitFor(() => expect(screen.getByText("2 succeeded")).toBeTruthy());
    expect(getWatchlist).toHaveBeenCalledTimes(1);
    expect(saveWatchlist).toHaveBeenCalledTimes(1);
    expect(saveWatchlist).toHaveBeenCalledWith(["existing-1", "iss-1", "iss-2"]);
  });

  it("Export CSV never calls the server", async () => {
    const toolbar = await renderSelectedTwo();
    fireEvent.click(toolbar.getByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(screen.getByText("2 succeeded")).toBeTruthy());
    expect(createRun).not.toHaveBeenCalled();
    expect(getWatchlist).not.toHaveBeenCalled();
    expect(saveWatchlist).not.toHaveBeenCalled();
  });

  it("select-all (header checkbox) selects every visible row, and clear empties the selection", async () => {
    getIssuers.mockResolvedValue(ISSUERS);
    render(<IssuersPage />);
    await screen.findByText("Atlas Forge Industrials");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all issuers" }));
    await waitFor(() => expect(screen.getByText("2 issuers selected")).toBeTruthy());
    fireEvent.click(screen.getByRole("checkbox", { name: "Deselect all issuers" }));
    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Batch actions" })).toBeNull());
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all issuers" }));
    await waitFor(() => expect(screen.getByText("2 issuers selected")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Batch actions" })).toBeNull());
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all issuers" }));
    await waitFor(() => expect(screen.getByText("2 issuers selected")).toBeTruthy());
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Batch actions" })).toBeNull());
  });

  it("deselects an individually selected row", async () => {
    getIssuers.mockResolvedValue(ISSUERS);
    render(<IssuersPage />);
    const atlas = await screen.findByRole("checkbox", { name: "Select Atlas Forge Industrials" });
    fireEvent.click(atlas);
    await screen.findByText("1 issuer selected");
    fireEvent.click(atlas);
    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Batch actions" })).toBeNull());
  });
});

describe("Issuers directory — loading, search, sort, and filters", () => {
  it("pipeline-05 pipeline-07 labels an empty live registry as demo coverage and opens the creation dialog from its banner", async () => {
    getIssuers.mockResolvedValue([]);
    render(<IssuersPage />);

    expect(await screen.findByText(/No live coverage yet/)).toBeTruthy();
    expect(screen.getAllByText("Demo coverage").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "+ NEW ISSUER" }).at(-1)!);
    expect(screen.getByRole("dialog", { name: "New issuer" })).toBeTruthy();
    expect(screen.getByText("Creates the issuer and opens its profile")).toBeTruthy();
    expect(screen.queryByText(/module route/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "CANCEL" }));
    expect(screen.queryByRole("dialog", { name: "New issuer" })).toBeNull();
  });

  it("pipeline-07 offers the primary creation action when both live and sample coverage are empty", async () => {
    const demoRows = [...DEMO_UNIVERSE];
    DEMO_UNIVERSE.splice(0, DEMO_UNIVERSE.length);
    try {
      getIssuers.mockResolvedValue([]);
      render(<IssuersPage />);
      expect(await screen.findByText("No issuers yet")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "New issuer" }));
      expect(screen.getByRole("dialog", { name: "New issuer" })).toBeTruthy();
      cleanup();
    } finally {
      DEMO_UNIVERSE.push(...demoRows);
    }
  });

  it("pipeline-06 shows an honest degraded demo fallback, then retries into live coverage", async () => {
    getIssuers.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(ISSUERS);
    render(<IssuersPage />);

    expect((await screen.findByRole("alert")).textContent).toContain("demo coverage");
    fireEvent.click(screen.getByRole("button", { name: "RETRY" }));
    expect(await screen.findByText("Atlas Forge Industrials")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("pipeline-02 pipeline-06 retains the last real register when a later debounced search fails", async () => {
    getIssuers.mockResolvedValueOnce(ISSUERS).mockRejectedValueOnce(new Error("search unavailable"));
    render(<IssuersPage />);
    await screen.findByText("Atlas Forge Industrials");

    fireEvent.change(screen.getByRole("textbox", { name: "Search issuers" }), { target: { value: "Atlas" } });
    const alert = await screen.findByRole("alert", {}, { timeout: 1_000 });
    expect(alert.textContent).toContain("last loaded results");
    expect(screen.getByText("Kestrel Chemicals")).toBeTruthy();
  });

  it("pipeline-02 pipeline-08 restores a URL query, renders no-match state, and clears back to the sample sleeve", async () => {
    window.history.replaceState({}, "", "/issuers?q=zzzz-no-match");
    getIssuers.mockResolvedValue([]);
    render(<IssuersPage />);

    expect(await screen.findByText("No matches for “zzzz-no-match”")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(await screen.findByText(/No live coverage yet/)).toBeTruthy();
  });

  it("pipeline-02 clears a populated search with the compact input affordance", async () => {
    getIssuers.mockResolvedValue(ISSUERS);
    render(<IssuersPage />);
    await screen.findByText("Atlas Forge Industrials");
    fireEvent.change(screen.getByRole("textbox", { name: "Search issuers" }), { target: { value: "Atlas" } });
    fireEvent.click(screen.getByTitle("Clear search"));
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Search issuers" }) as HTMLInputElement).value).toBe(""));
  });

  it("cycles sortable headers and keeps missing values at the bottom in both directions", async () => {
    const rows: Issuer[] = [
      { ...ISSUERS[1], ticker: undefined, sector: "Shared" },
      { ...ISSUERS[0], ticker: "ATLF", sector: "Shared" },
      { id: "iss-3", name: "Beacon Media", ticker: "BEAC", sector: "Media", country: null, rating_sp: null },
    ];
    getIssuers.mockResolvedValue(rows);
    render(<IssuersPage />);
    await screen.findByText("Beacon Media");

    const profileNames = () => screen.getAllByRole("link", { name: /Open profile for/ }).map((node) => node.getAttribute("aria-label"));
    expect(profileNames()[0]).toContain("Atlas Forge Industrials");
    fireEvent.click(screen.getByRole("button", { name: "Sort Issuer descending" }));
    expect(profileNames()[0]).toContain("Kestrel Chemicals");
    fireEvent.click(screen.getByRole("button", { name: "Sort Issuer clear sort on" }));
    expect(profileNames()[0]).toContain("Kestrel Chemicals");

    fireEvent.click(screen.getByRole("button", { name: "Sort Ticker ascending" }));
    expect(profileNames().at(-1)).toContain("Kestrel Chemicals");
    fireEvent.click(screen.getByRole("button", { name: "Sort Ticker descending" }));
    expect(profileNames().at(-1)).toContain("Kestrel Chemicals");
  });

  it("applies and clears a column filter, including the filter value search empty state", async () => {
    getIssuers.mockResolvedValue(ISSUERS);
    render(<IssuersPage />);
    await screen.findByText("Atlas Forge Industrials");

    fireEvent.click(screen.getByRole("button", { name: "Filter Sector" }));
    const dialog = screen.getByRole("dialog", { name: "Filter Sector" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Search Sector values" }), { target: { value: "missing" } });
    expect(within(dialog).getByText("No values")).toBeTruthy();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Search Sector values" }), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Clear" }));
    expect(await screen.findByText("No rows match the active filters")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Atlas Forge Industrials")).toBeTruthy();
  });

  it("pipeline-03 pipeline-04 opens issuer profiles and routes upload actions without nesting interactions", async () => {
    getIssuers.mockResolvedValue([{ ...ISSUERS[0], id: "issuer / one" }, ISSUERS[1]]);
    render(<IssuersPage />);
    const profile = await screen.findByRole("link", { name: "Open profile for Atlas Forge Industrials" });
    expect(profile.getAttribute("href")).toBe("/issuers/profile?id=issuer%20%2F%20one");
    fireEvent.click(profile);
    fireEvent.click(screen.getByRole("button", { name: "Upload documents for Atlas Forge Industrials" }));
    expect(routerPush).toHaveBeenCalledWith("/upload?issuer=issuer%20%2F%20one");
  });

  it("uses an eight-column semantic grid with one roving row stop and isolated nested actions", async () => {
    getIssuers.mockResolvedValue(ISSUERS);
    render(<IssuersPage />);
    await screen.findByText("Atlas Forge Industrials");

    const grid = screen.getByRole("grid", { name: "Issuer coverage register" });
    expect(screen.getAllByText("2 issuers · 2 rated")).toHaveLength(2);
    expect(grid.getAttribute("aria-rowcount")).toBe("3");
    const headers = within(grid).getAllByRole("columnheader");
    expect(headers).toHaveLength(8);
    expect(headers.map((header) => header.textContent?.replace(/[▲▼]/g, "").trim())).toEqual([
      "", "Ticker", "Issuer", "Rating", "Sector", "Sub-sector", "Country", "Document intake",
    ]);
    expect(within(grid).queryByText("FIGI")).toBeNull();
    const rows = within(grid).getAllByRole("row", { name: /issuer details/ });
    expect(within(rows[0]).getAllByRole("gridcell")).toHaveLength(7);
    expect(within(rows[0]).getByRole("rowheader")).toBeTruthy();
    expect(rows[0].className).toContain("[content-visibility:auto]");
    expect(rows[0].className).toContain("[contain-intrinsic-size:auto_32px]");
    const distressedRating = within(rows[1]).getByRole("gridcell", { name: "Distressed rating: CCC+" });
    expect(distressedRating.querySelector("svg")).toBeTruthy();
    expect(rows.filter((row) => row.tabIndex === 0)).toHaveLength(1);
    const firstCheckbox = within(rows[0]).getByRole("checkbox");
    const firstUpload = within(rows[0]).getByRole("button", { name: /Upload documents/ });
    const firstProfile = within(rows[0]).getByRole("link", { name: /Open profile/ });
    const rowActions = (row: HTMLElement) =>
      Array.from(row.querySelectorAll<HTMLElement>("input, button, a[href]"));
    const secondActions = rowActions(rows[1]);
    expect([firstCheckbox, firstUpload, firstProfile, ...secondActions].every((action) => action.tabIndex === -1)).toBe(true);
    expect(rows[0].getAttribute("aria-keyshortcuts")).toBe("F2");
    expect(document.getElementById(rows[0].getAttribute("aria-describedby")!)?.textContent).toContain("Press F2");

    rows[0].focus();
    fireEvent.keyDown(rows[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows[1]);
    expect(overlayState.openProfile).not.toHaveBeenCalled();
    fireEvent.keyDown(rows[1], { key: "Enter" });
    expect(overlayState.openProfile).toHaveBeenCalledWith("iss-2");

    rows[0].focus();
    fireEvent.keyDown(rows[0], { key: "F2" });
    expect(document.activeElement).toBe(firstCheckbox);
    expect(firstCheckbox.tabIndex).toBe(0);
    expect(firstUpload.tabIndex).toBe(0);
    expect(firstProfile.tabIndex).toBe(-1); // author-specified negative tabindex is preserved
    expect(secondActions.every((action) => action.tabIndex === -1)).toBe(true);
    fireEvent.click(firstCheckbox); // rerender while action mode remains active
    expect(within(screen.getByRole("row", { name: /Atlas Forge/ })).getByRole("button", { name: /Upload documents/ }).tabIndex).toBe(0);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    const restored = screen.getByRole("row", { name: /Atlas Forge/ });
    expect(document.activeElement).toBe(restored);
    expect(rowActions(restored).every((action) => action.tabIndex === -1)).toBe(true);

    overlayState.openProfile.mockClear();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Atlas Forge Industrials" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload documents for Atlas Forge Industrials" }));
    expect(overlayState.openProfile).not.toHaveBeenCalled();
    expect(routerPush).toHaveBeenCalledWith("/upload?issuer=iss-1");
  });

  it("hydrates validated saved state without issuing an identical context write", async () => {
    analysisState.context = makeContext({
      query: "Atlas",
      selected_ids: [],
      filters: { sector: ["Industrials"] },
      sort: "ticker:desc",
      view: "directory",
    });
    analysisState.patch.mockResolvedValue(null);
    getIssuers.mockResolvedValue(ISSUERS);
    render(<IssuersPage />);

    expect(await screen.findByText("Atlas Forge Industrials")).toBeTruthy();
    expect(screen.queryByText("Kestrel Chemicals")).toBeNull();
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    expect(analysisState.patch).not.toHaveBeenCalled();
  });

  it("persists changed context state, preserves active metadata, and scopes profile/upload routes", async () => {
    analysisState.context = makeContext({ active_id: "prior-active", sort: "invalid:sideways" });
    analysisState.patch.mockRejectedValue(new Error("write budget reached"));
    getIssuers.mockResolvedValue(ISSUERS);
    render(<IssuersPage />);
    await screen.findByText("Atlas Forge Industrials");

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Atlas Forge Industrials" }));
    await waitFor(() => expect(analysisState.patch).toHaveBeenCalled(), { timeout: 1_000 });
    const persisted = analysisState.patch.mock.calls.find((call) => call[0]?.surface_state?.issuers?.view === "directory")?.[0];
    expect(persisted).toMatchObject({
      issuer_ids: ["iss-1"],
      surface_state: { issuers: { active_id: "prior-active", selected_ids: ["iss-1"], view: "directory" } },
    });

    fireEvent.click(screen.getByRole("link", { name: "Open profile for Atlas Forge Industrials" }));
    fireEvent.click(screen.getByRole("link", { name: "Open profile for Kestrel Chemicals" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload documents for Atlas Forge Industrials" }));
    expect(routerPush).toHaveBeenCalledWith("/upload?context=ctx-issuers&issuer=iss-1");
    expect(analysisState.patch).toHaveBeenCalledWith(expect.objectContaining({
      issuer_ids: ["iss-2"],
      surface_state: { issuers: expect.objectContaining({ active_id: "iss-2" }) },
    }));
  });
});

describe("Issuers directory — create issuer", () => {
  it("pipeline-05 submits every field, surfaces the API detail, and succeeds on retry with blank sponsor normalized", async () => {
    const created: Issuer = {
      id: "iss-new",
      name: "Northstar Packaging",
      ticker: "NSTP",
      sector: "Industrials",
      sub_sector: "Packaging",
      country: "Canada",
      figi: "BBG000NEW",
    };
    getIssuers.mockResolvedValue(ISSUERS);
    createIssuer
      .mockRejectedValueOnce({ response: { data: { detail: "Ticker already exists" } } })
      .mockResolvedValueOnce(created);
    render(<IssuersPage />);
    await screen.findByText("Atlas Forge Industrials");
    fireEvent.click(screen.getByRole("button", { name: "+ NEW ISSUER" }));

    fireEvent.change(screen.getByRole("textbox", { name: "Company name" }), { target: { value: created.name } });
    fireEvent.change(screen.getByRole("textbox", { name: "Ticker / CUSIP" }), { target: { value: created.ticker } });
    fireEvent.change(screen.getByRole("textbox", { name: "Sector" }), { target: { value: created.sector } });
    fireEvent.change(screen.getByRole("textbox", { name: "Sub-sector" }), { target: { value: created.sub_sector } });
    fireEvent.change(screen.getByRole("textbox", { name: "FIGI" }), { target: { value: created.figi } });
    fireEvent.change(screen.getByRole("textbox", { name: "Sponsor / PE owner" }), { target: { value: "   " } });
    fireEvent.change(screen.getByRole("combobox", { name: "Country" }), { target: { value: "Canada" } });
    fireEvent.click(screen.getByRole("button", { name: "CREATE ISSUER" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Ticker already exists");
    fireEvent.click(screen.getByRole("button", { name: "CREATE ISSUER" }));
    expect(await screen.findByText("Northstar Packaging")).toBeTruthy();
    expect(createIssuer).toHaveBeenLastCalledWith(expect.objectContaining({
      name: "Northstar Packaging",
      country: "Canada",
      sponsor: undefined,
    }));
    expect(screen.queryByRole("dialog", { name: "New issuer" })).toBeNull();
  });

  it("ignores a second form submit while creation is pending", async () => {
    let resolveCreate!: (issuer: Issuer) => void;
    createIssuer.mockImplementation(() => new Promise<Issuer>((resolve) => { resolveCreate = resolve; }));
    getIssuers.mockResolvedValue(ISSUERS);
    render(<IssuersPage />);
    await screen.findByText("Atlas Forge Industrials");
    fireEvent.click(screen.getByRole("button", { name: "+ NEW ISSUER" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Company name" }), { target: { value: "Pending Credit" } });
    const dialog = screen.getByRole("dialog", { name: "New issuer" });
    fireEvent.submit(dialog);
    await waitFor(() => expect(screen.getByRole("button", { name: "CREATING…" }).getAttribute("aria-disabled")).toBe("true"));
    fireEvent.submit(dialog);
    expect(createIssuer).toHaveBeenCalledTimes(1);
    resolveCreate({ id: "iss-pending", name: "Pending Credit" });
    expect(await screen.findByText("Pending Credit")).toBeTruthy();
  });
});
