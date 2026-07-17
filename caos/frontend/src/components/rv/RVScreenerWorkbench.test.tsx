// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisContext, AuthorityEnvelope, RVCandidate, RVScreenRun } from "@/lib/analysis-workbench";

const controls = vi.hoisted(() => ({
  roleView: "analyst" as "analyst" | "pm" | "qa",
  context: null as AnalysisContext | null,
  loading: false,
  contextError: null as string | null,
  setContext: vi.fn(),
  patch: vi.fn(),
  getRVScreen: vi.fn(),
  createRVScreen: vi.fn(),
  createFinding: vi.fn(),
  ratifyRVCandidate: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/sector-rv" }));
vi.mock("@/components/shared/RoleViewProvider", () => ({
  useRoleView: () => ({ roleView: controls.roleView, setRoleView: vi.fn(), ready: true }),
}));
vi.mock("@/components/shared/ActionReason", () => ({
  ActionReason: ({ children, onClick, reason, className }: { children: ReactNode; onClick?: () => void; reason?: string | null; className?: string }) => (
    <button type="button" className={className} data-reason={reason ?? ""} onClick={onClick}>{children}</button>
  ),
}));
vi.mock("@/components/shared/AnalysisWorkbench", () => ({
  AnalysisStateBadge: ({ state }: { state: string }) => <span data-testid="analysis-state">{state}</span>,
  AuthorityLine: ({ authority }: { authority: AuthorityEnvelope }) => <span>Authority {authority.origin}</span>,
  FindingsTray: ({ contextId, refreshKey }: { contextId: string; refreshKey: number }) => <span data-testid="findings">{contextId}:{refreshKey}</span>,
}));
vi.mock("@/components/shared/ConceptNav", () => ({ ConceptNav: () => <nav>Concepts</nav> }));
vi.mock("@/components/shared/DecisionHeader", () => ({
  DecisionHeader: ({ state }: { state: Record<string, { kind: string; value?: ReactNode; message?: string }> }) => (
    <section aria-label="Decision header">
      {Object.entries(state).map(([key, value]) => <div key={key} data-kind={value.kind}>{value.value ?? value.message}</div>)}
    </section>
  ),
}));
vi.mock("@/components/shared/DominantTableRegion", () => ({
  DominantTableRegion: ({ children, label }: { children: ReactNode; label: string }) => <section aria-label={label}>{children}</section>,
}));
vi.mock("@/components/shared/EnterprisePage", () => ({
  EnterprisePage: ({ identity, status, primaryAction, contextualControls, utilityControls, children }: Record<string, ReactNode>) => (
    <div>{identity}{status}{primaryAction}{contextualControls}<aside aria-label="RV utilities">{utilityControls}</aside>{children}</div>
  ),
}));
vi.mock("@/components/shared/PersonaWorkbench", () => ({
  PersonaWorkbench: ({ decision, primary, context, inspector, utility }: Record<string, ReactNode>) => <>{decision}{primary}{context}{inspector}{utility}</>,
}));
vi.mock("@/components/charts/SemanticVisualization", () => ({
  SemanticVisualization: ({ spec }: { spec: { title: string; accessibleSummary: string } }) => <section data-testid="visualization"><h2>{spec.title}</h2><p>{spec.accessibleSummary}</p></section>,
}));
vi.mock("@/components/shared/SlideOver", () => ({
  SlideOver: ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => <aside aria-label={title}><button onClick={onClose}>Close import</button>{children}</aside>,
}));
vi.mock("@/components/rv/MarketWorkbookImport", () => ({
  MarketWorkbookImport: ({ onCommitted }: { onCommitted: (value: { snapshot_id: string }) => void }) => <button onClick={() => onCommitted({ snapshot_id: "snapshot-imported" })}>Commit workbook</button>,
}));
vi.mock("@/lib/analysis-workbench", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analysis-workbench")>();
  return {
    ...actual,
    contextHref: (path: string, id: string, params?: Record<string, string>) => `${path}?context=${id}${params ? `&${new URLSearchParams(params)}` : ""}`,
    useAnalysisContext: () => ({
      context: controls.context,
      setContext: controls.setContext,
      patch: controls.patch,
      loading: controls.loading,
      error: controls.contextError,
    }),
    analysisApi: {
      ...actual.analysisApi,
      getRVScreen: controls.getRVScreen,
      createRVScreen: controls.createRVScreen,
      createFinding: controls.createFinding,
      ratifyRVCandidate: controls.ratifyRVCandidate,
    },
  };
});

import { RVScreenerWorkbench } from "./RVScreenerWorkbench";

function authority(
  origin: AuthorityEnvelope["origin"] = "live",
  freshness: AuthorityEnvelope["freshness"] = "current",
  approval_state: AuthorityEnvelope["approval_state"] = "draft",
): AuthorityEnvelope {
  return {
    origin,
    method: "gated-screen-v2",
    freshness,
    as_of: "2026-07-13T09:00:00Z",
    source_ids: ["snapshot-1"],
    run_id: "rv-1",
    version_id: null,
    confidence: 0.9,
    approval_state,
    analyst_override: null,
  };
}

function candidate(index: number, classification: RVCandidate["classification"] = "screen-only"): RVCandidate {
  const names = ["Alpha Telecom", "Beta Fiber", "Gamma Towers", "Delta Mobile", "Epsilon Cable", "Zeta Networks"];
  return {
    id: `candidate-${index}`,
    instrument_id: `instrument-${index}`,
    instrument_key: `FIGI-${index}:0`,
    figi: index === 3 ? null : `FIGI-${index}`,
    borrower: names[index - 1] ?? `Borrower ${index}`,
    rank: index,
    classification,
    recommendation: classification === "actionable" ? "ADD" : "WATCH",
    missing_gates: classification === "actionable" ? [] : ["live market origin", "recovery evidence"],
    market: {
      dm: index === 3 ? Number.NaN : 600 + index,
      bid: index === 4 ? null : 97,
      ask: index === 4 ? "98A" : 98,
      ranking: index === 3 ? null : "1L",
      maturity: index === 3 ? "" : "2029",
    },
    pitch: {
      market_relative_value: {
        dm_pickup_bps: index === 3 ? undefined : 30 + index,
        bid_ask: { bid: 97, ask: 98 },
        range: { low: 20, high: 40 },
        misc_object: { spread_pickup: 31, note: "wide" },
        observations: [1, "two", null],
        desk_label: "cheap",
      },
      instrument_mispricing: { recovery: null, collateral: "first lien" },
      portfolio_implementation: { held: false, size: 1.5 },
    },
    evidence: { ids: [`E-${index}`] },
    portfolio_impact: {},
    ratified_at: null,
  };
}

function rvScreen(overrides: Partial<RVScreenRun> = {}): RVScreenRun {
  const candidates = [
    candidate(1, "actionable"), candidate(2, "screen-only"), candidate(3, "unavailable"),
    candidate(4), candidate(5), candidate(6),
  ];
  return {
    id: "rv-1",
    context_id: "context-rv",
    snapshot_id: "snapshot-123456789",
    status: "ready",
    snapshot_source_label: "LoanX close",
    snapshot_freshness: { state: "current" },
    filters: { sector_id: "telecom" },
    authority: authority(),
    candidates,
    counts: { actionable: 1, "screen-only": 4, unavailable: 1 },
    missing_dependencies: [],
    created_at: "2026-07-13T09:00:00Z",
    updated_at: "2026-07-13T09:00:00Z",
    ...overrides,
  };
}

function context(rvRunId: string | null = "rv-1", sectorId: string | null = "telecom"): AnalysisContext {
  return {
    id: "context-rv",
    revision: 1,
    name: "Telecom RV",
    sector_id: sectorId,
    sub_segments: [],
    issuer_ids: [],
    instrument_ids: [],
    portfolio_scope: null,
    as_of: null,
    sector_review_run_id: null,
    rv_run_id: rvRunId,
    rv_snapshot_id: null,
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
    surface_state: {},
    filters: { existing: true },
    selected: {},
    created_at: "2026-07-13T09:00:00Z",
    updated_at: "2026-07-13T09:00:00Z",
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  window.history.replaceState({}, "", "/sector-rv?selected=candidate-1");
  controls.roleView = "analyst";
  controls.context = context();
  controls.loading = false;
  controls.contextError = null;
  controls.setContext.mockReset();
  controls.patch.mockReset().mockResolvedValue(undefined);
  controls.getRVScreen.mockReset().mockResolvedValue(rvScreen());
  controls.createRVScreen.mockReset().mockResolvedValue(rvScreen());
  controls.createFinding.mockReset().mockResolvedValue({});
  controls.ratifyRVCandidate.mockReset().mockResolvedValue(rvScreen({ candidates: [candidate(1, "actionable")] }));
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RV Screener workbench", () => {
  it("navigates the virtual grid, switches views, and enforces the five-name compare cap", async () => {
    render(<RVScreenerWorkbench />);
    const grid = await screen.findByRole("grid", { name: "Ranked RV candidates" });
    fireEvent.click(screen.getByRole("button", { name: "Review top candidate" }));
    expect(screen.getAllByText("97 / 98").length).toBeGreaterThan(0);
    expect(screen.getByText("20–40")).toBeTruthy();
    expect(screen.getByText(/spread pickup: 31/)).toBeTruthy();
    expect(screen.getByText("1 · two · —")).toBeTruthy();

    const alpha = within(grid).getByText(/Alpha Telecom/).closest('[role="row"]') as HTMLElement;
    fireEvent.keyDown(alpha, { key: "Enter" });
    fireEvent.click(alpha);
    fireEvent.keyDown(alpha, { key: "ArrowDown" });
    expect((HTMLElement.prototype.scrollTo as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
    expect(window.location.search).toContain("selected=candidate-2");
    const beta = within(grid).getByText(/Beta Fiber/).closest('[role="row"]') as HTMLElement;
    fireEvent.keyDown(beta, { key: "ArrowUp" });

    const viewport = grid.querySelector(".overflow-auto") as HTMLDivElement;
    Object.defineProperty(viewport, "scrollTop", { configurable: true, writable: true, value: 460 });
    fireEvent.scroll(viewport);
    viewport.scrollTop = 0;
    fireEvent.scroll(viewport);

    fireEvent.click(screen.getByRole("tab", { name: "distribution" }));
    expect(screen.getAllByTestId("visualization")[0].textContent).toContain("6 instruments");
    fireEvent.click(screen.getByRole("tab", { name: "table" }));

    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(screen.getAllByRole("button", { name: "Compare" })[0]);
    }
    const capped = screen.getByRole("button", { name: "Compare" });
    expect(capped.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(capped);
    expect(screen.getByRole("tab", { name: "compare (5)" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[1]);
    expect(screen.getByRole("tab", { name: "compare (4)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "compare (4)" }));
    expect(screen.getAllByText("All gates satisfied").length).toBeGreaterThan(0);
  });

  it("runs once while busy, handles an empty result, and reruns from an imported snapshot", async () => {
    controls.context = context(null);
    const pending = deferred<RVScreenRun>();
    controls.createRVScreen.mockReturnValueOnce(pending.promise);
    render(<RVScreenerWorkbench />);
    expect(await screen.findByText("Immutable snapshot required")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Run screen" }));
    fireEvent.click(screen.getByRole("button", { name: "Running…" }));
    expect(controls.createRVScreen).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(rvScreen({ candidates: [], counts: {} })));
    expect(await screen.findByRole("grid", { name: "Ranked RV candidates" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Review top screen-only name" }));

    controls.createRVScreen.mockResolvedValueOnce(rvScreen());
    fireEvent.click(screen.getByRole("button", { name: "Import pricing" }));
    fireEvent.click(screen.getByRole("button", { name: "Commit workbook" }));
    await waitFor(() => expect(controls.createRVScreen).toHaveBeenLastCalledWith(expect.objectContaining({ snapshot_id: "snapshot-imported" })));
    expect(controls.setContext).toHaveBeenCalledWith(expect.objectContaining({ rv_run_id: "rv-1", rv_snapshot_id: "snapshot-123456789" }));
  });

  it("surfaces run failure and sends no sector filter when the context is unclassified", async () => {
    controls.context = context(null, null);
    controls.createRVScreen.mockRejectedValueOnce(new Error("screen service offline"));
    render(<RVScreenerWorkbench />);
    fireEvent.click(await screen.findByRole("button", { name: "Run screen" }));
    expect((await screen.findByRole("alert")).textContent).toContain("screen service offline");
    expect(controls.createRVScreen).toHaveBeenCalledWith(expect.objectContaining({ filters: {} }));
  });

  it("pins both finding kinds, ratifies an actionable candidate, and surfaces action failures", async () => {
    render(<RVScreenerWorkbench />);
    const grid = await screen.findByRole("grid", { name: "Ranked RV candidates" });
    fireEvent.click(screen.getByRole("button", { name: "Pin pitch" }));
    await waitFor(() => expect(controls.createFinding).toHaveBeenCalledWith(expect.objectContaining({
      kind: "rv-pitch", body: "All RV decision gates satisfied.",
    })));
    expect(screen.getByTestId("findings").textContent).toBe("context-rv:1");

    controls.createFinding.mockRejectedValueOnce(new Error("finding offline"));
    fireEvent.click(screen.getByRole("tab", { name: "table" }));
    fireEvent.click(within(grid).getByText(/Beta Fiber/).closest('[role="row"]') as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Monitor threshold" }));
    expect((await screen.findByRole("alert")).textContent).toContain("finding offline");
    expect(controls.createFinding).toHaveBeenLastCalledWith(expect.objectContaining({
      body: "Decision gates missing: live market origin, recovery evidence.",
    }));

    fireEvent.click(within(grid).getByText(/Alpha Telecom/).closest('[role="row"]') as HTMLElement);
    controls.ratifyRVCandidate.mockResolvedValueOnce(rvScreen({ candidates: [] }));
    fireEvent.click(screen.getByRole("button", { name: "Ratify candidate" }));
    await waitFor(() => expect(controls.ratifyRVCandidate).toHaveBeenCalledWith("rv-1", "candidate-1"));
    controls.ratifyRVCandidate.mockRejectedValueOnce(new Error("ratification offline"));
    fireEvent.click(screen.getByRole("button", { name: "Ratify candidate" }));
    expect((await screen.findByRole("alert")).textContent).toContain("ratification offline");

    fireEvent.click(screen.getByRole("button", { name: "Save current screen" }));
    expect(controls.patch).toHaveBeenCalledWith({ filters: { existing: true, rv: { sector_id: "telecom" } } });
    fireEvent.click(screen.getByRole("button", { name: "Review top candidate" }));
  });

  it("uses unavailable identity and saved-filter fallbacks and guards pinning after context loss", async () => {
    const unavailable = { ...candidate(3, "unavailable"), ratified_at: "2026-07-14T00:00:00Z", pitch: {
      ...candidate(3, "unavailable").pitch,
      instrument_mispricing: null,
      portfolio_implementation: "not available",
    } } as unknown as RVCandidate;
    controls.context = { ...context(), filters: null as unknown as Record<string, unknown> };
    controls.getRVScreen.mockResolvedValue(rvScreen({
      filters: undefined as unknown as Record<string, unknown>,
      authority: { ...authority("reference", "unknown"), as_of: null },
      candidates: [unavailable],
      counts: { actionable: 0, "screen-only": 0, unavailable: 1 },
    }));
    window.history.replaceState({}, "", "/sector-rv?selected=candidate-3");
    const view = render(<RVScreenerWorkbench />);
    await waitFor(() => expect(screen.getByRole("complementary", { name: "RV evidence inspector" }).textContent).toContain("No exact identity"));
    expect(screen.getByTestId("analysis-state").textContent).toBe("error");
    expect(screen.getByRole("button", { name: "Ratified" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save current screen" }));
    expect(controls.patch).toHaveBeenCalledWith({ filters: { rv: {} } });

    controls.context = null;
    view.rerender(<RVScreenerWorkbench />);
    fireEvent.click(screen.getByRole("button", { name: "Pin pitch" }));
    expect(controls.createFinding).not.toHaveBeenCalled();
  });

  it("renders PM ordering and QA gate review, and guards non-actionable ratification", async () => {
    controls.roleView = "pm";
    window.history.replaceState({}, "", "/sector-rv?selected=candidate-2");
    const view = render(<RVScreenerWorkbench />);
    expect((await screen.findAllByText("Beta Fiber")).length).toBeGreaterThan(0);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent);
    expect(headings.indexOf("3 · Portfolio implementation")).toBeLessThan(headings.indexOf("1 · Market relative value"));

    controls.roleView = "qa";
    view.rerender(<RVScreenerWorkbench />);
    expect(screen.getByText("QA gate review")).toBeTruthy();
    expect(screen.queryByText("Decision gates missing")).toBeNull();
    const ratify = screen.getByRole("button", { name: "Ratify candidate" });
    Object.defineProperty(ratify, "disabled", { configurable: true, value: false });
    fireEvent.click(ratify);
    expect(controls.ratifyRVCandidate).not.toHaveBeenCalled();
  });

  it("rechecks actionability inside ratification even if the selected record changes after render", async () => {
    const mutable = candidate(1, "actionable");
    controls.getRVScreen.mockResolvedValue(rvScreen({ candidates: [mutable], counts: { actionable: 1 } }));
    render(<RVScreenerWorkbench />);
    const ratify = await screen.findByRole("button", { name: "Ratify candidate" });
    mutable.classification = "screen-only";
    fireEvent.click(ratify);
    expect(controls.ratifyRVCandidate).not.toHaveBeenCalled();
  });

  it("opens and closes the importer and tolerates failure to restore a saved run", async () => {
    controls.getRVScreen.mockRejectedValueOnce(new Error("gone"));
    render(<RVScreenerWorkbench />);
    expect(await screen.findByText("Immutable snapshot required")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Import pricing" }));
    expect(screen.getByRole("complementary", { name: "Import immutable pricing snapshot" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close import" }));
    expect(screen.queryByRole("complementary", { name: "Import immutable pricing snapshot" })).toBeNull();
  });

  it.each([
    ["error", "reference", "current", "draft", "error"],
    ["stale", "demo", "stale", "ratified", "stale"],
    ["observed-empty", "live", "unknown", "draft", "observed-empty"],
  ] as const)("maps %s screens into decision-safe state", async (status, origin, freshness, approval, expectedKind) => {
    controls.getRVScreen.mockResolvedValue(rvScreen({
      status,
      authority: { ...authority(origin, freshness, approval), as_of: null },
      candidates: status === "observed-empty" ? [] : [candidate(1, "actionable")],
      counts: status === "observed-empty" ? {} : { actionable: 1 },
      snapshot_source_label: null,
      snapshot_freshness: null,
    }));
    render(<RVScreenerWorkbench />);
    await waitFor(() => expect(screen.getByLabelText("Decision header").querySelector(`[data-kind="${expectedKind}"]`)).toBeTruthy());
  });

  it("discloses context loading and failure states", () => {
    controls.context = null;
    controls.loading = true;
    const view = render(<RVScreenerWorkbench />);
    expect(screen.getByText("Preparing workspace")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Run screen" }).getAttribute("data-reason")).toContain("Preparing analysis workspace");

    controls.loading = false;
    controls.contextError = "offline";
    view.rerender(<RVScreenerWorkbench />);
    expect(screen.getByText(/Analysis workspace unavailable — the screen cannot run/)).toBeTruthy();
    vi.spyOn(console, "error").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Reload to retry" }));
  });
});
