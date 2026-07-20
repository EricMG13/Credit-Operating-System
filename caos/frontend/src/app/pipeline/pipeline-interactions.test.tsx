// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const REFERENCE_ISSUER = "a71f0000-0000-0000-0000-000000000001";

type AnalysisContextMock = {
  id: string;
  issuer_ids: string[];
  artifacts: { issuer_run_id: string | null };
  surface_state: Record<string, unknown>;
};

type PipelineMock = {
  value: unknown;
  phase: string;
  latest: { status: string } | null;
};

type LiveRunMock = {
  liveOuts: Record<string, unknown>;
  liveEvidence: Record<string, unknown>;
  runId: string | null;
  loading: boolean;
  phase: string;
};

const state = vi.hoisted(() => ({
  dataMode: "live" as "live" | "reference",
  search: "issuer=a71f0000-0000-0000-0000-000000000001",
  pushes: [] as string[],
  replaces: [] as string[],
  runs: [] as Array<Record<string, unknown>>,
  listError: false,
  simulationCalls: 0,
  pipelineStatusCalls: 0,
  freshnessCalls: 0,
  liveRunCalls: 0,
  context: null as AnalysisContextMock | null,
  patch: vi.fn(),
  pipeline: { value: null, phase: "none", latest: null } as PipelineMock,
  liveRun: {
    liveOuts: {}, liveEvidence: {}, runId: null, loading: false, phase: "none",
  } as LiveRunMock,
}));

const sim = () => ({
  mods: { "CP-5": { state: "pass" }, "CP-1": { state: "pass" } },
  events: [{ id: "event-1" }],
  done: false,
});

const live = (overrides: Record<string, unknown> = {}) => ({
  sim: sim(),
  scope: new Set(["CP-1", "CP-5B", "CP-5"]),
  plan: [{ id: "CP-1", deps: [], dur: 1, outcome: "pass", event: "done" }],
  completed: 2,
  total: 3,
  runId: "run-live-abcdef",
  summary: "Persisted pipeline summary",
  committeeStatus: "Committee Ready",
  gateStatus: "Full Run",
  ...overrides,
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (href: string) => state.pushes.push(href),
    replace: (href: string) => state.replaces.push(href),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(state.search),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/lib/data-mode", () => ({
  useDataMode: () => state.dataMode,
  preserveDataModeInHref: (href: string, mode: string) => mode === "reference" ? `${href}${href.includes("?") ? "&" : "?"}mode=reference` : href,
  withDataMode: (href: string, mode: string) => mode === "reference" ? `${href}${href.includes("?") ? "&" : "?"}mode=reference` : href,
}));
vi.mock("@/components/shared/RequireAuth", () => ({ RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/ShellIdentity", () => ({
  ShellIdentity: ({ title, badges }: { title: React.ReactNode; badges?: React.ReactNode }) => <div data-testid="identity"><span>{title}</span>{badges}</div>,
}));
type TestPageAction = { label: string; href?: string; onAction?: () => void; unavailableReason?: string | null };
function renderPageAction(action?: TestPageAction) {
  if (!action) return null;
  if (action.href && !action.unavailableReason) return <a href={action.href}>{action.label}</a>;
  return <button type="button" aria-disabled={action.unavailableReason ? "true" : undefined} onClick={action.unavailableReason ? undefined : action.onAction}>{action.label}</button>;
}
vi.mock("@/components/shared/EnterprisePage", () => ({
  EnterprisePage: (props: {
    identity?: React.ReactNode;
    primaryAction?: TestPageAction;
    status?: React.ReactNode;
    contextualControls?: React.ReactNode;
    utilityControls?: React.ReactNode;
    narrowContract?: { essentialControls?: React.ReactNode };
    children?: React.ReactNode;
  }) => (
    <main>
      <div data-testid="enterprise-identity">{props.identity}</div>
      <div data-testid="primary">{renderPageAction(props.primaryAction)}</div>
      <div data-testid="status">{props.status}</div>
      <div data-testid="contextual">{props.contextualControls}</div>
      <div data-testid="utility">{props.utilityControls}</div>
      <div data-testid="narrow">{props.narrowContract?.essentialControls}</div>
      {props.children}
    </main>
  ),
}));
vi.mock("@/components/shared/SubHeader", () => ({ SubHeader: ({ identity, contextualControls }: { identity?: React.ReactNode; contextualControls?: React.ReactNode }) => <header>{identity}{contextualControls}</header> }));
vi.mock("@/components/shared/SurfaceState", () => ({
  SurfaceState: ({ kind, title, detail, supporting, primaryAction, secondaryAction, headingLevel = 3 }: { kind: string; title: React.ReactNode; detail: React.ReactNode; supporting?: React.ReactNode; primaryAction?: React.ReactNode; secondaryAction?: React.ReactNode; headingLevel?: number }) => <section data-testid={`surface-${kind}`}>{headingLevel === 2 ? <h2>{title}</h2> : <h3>{title}</h3>}<p>{detail}</p>{supporting}{primaryAction}{secondaryAction}</section>,
}));
vi.mock("@/components/shared/Panel", () => ({ Panel: ({ title, right, children }: { title: React.ReactNode; right?: React.ReactNode; children?: React.ReactNode }) => <section><h2>{title}</h2>{right}{children}</section> }));
vi.mock("@/components/shared/WorkbenchToolbar", () => ({ WorkbenchToolbar: ({ title, count, viewLabel }: { title: React.ReactNode; count: React.ReactNode; viewLabel: React.ReactNode }) => <div>{title} · {count} · {viewLabel}</div> }));
vi.mock("@/components/shared/PersonaWorkbench", () => ({ PersonaWorkbench: ({ primary }: { primary: React.ReactNode }) => <>{primary}</> }));
vi.mock("@/components/shared/DominantTableRegion", () => ({ DominantTableRegion: ({ children }: { children?: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/AnalysisContextSaveState", () => ({ AnalysisContextSaveState: () => <span>context save</span> }));
vi.mock("@/components/shared/FreshnessIndicator", () => ({ FreshnessIndicator: ({ evaluation }: { evaluation?: { state?: string } | null }) => <span>freshness {evaluation?.state ?? "none"}</span> }));
vi.mock("@/components/pipeline/PipelineEvidenceModal", () => ({
  PipelineEvidenceModal: ({ id, isLiveRun, onClose }: { id: string; isLiveRun: boolean; onClose: () => void }) => <div>evidence {id} live {String(isLiveRun)}<button onClick={onClose}>close evidence</button></div>,
}));
vi.mock("@/components/pipeline/atoms", () => ({
  Bar: ({ pct }: { pct: number }) => <span>bar {pct}</span>,
  Dot: ({ sev }: { sev: string }) => <span>dot {sev}</span>,
  Tag: ({ sev, children }: { sev: string; children?: React.ReactNode }) => <span>tag {sev} {children}</span>,
  SimControls: () => <button>sim controls</button>,
  ToggleGroup: ({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<{ k: string; l: string }> }) => <div>{options.map((option) => <button key={String(option.k)} aria-pressed={value === option.k} onClick={() => onChange(option.k)}>{option.l}</button>)}</div>,
}));
vi.mock("@/components/pipeline/views", () => ({
  EventLog: ({ events }: { events: unknown[] }) => <div>events {events.length}</div>,
  GraphView: ({ onSelect, onDoubleClick, dim, scope }: { onSelect: (id: string) => void; onDoubleClick: (id: string) => void; dim: boolean; scope: Set<string> }) => <div data-scope={Array.from(scope).sort().join(",")}>graph dim {String(dim)}<button onClick={() => onSelect("CP-1")}>select graph</button><button onClick={() => onDoubleClick("CP-0")}>open intake</button><button onClick={() => onDoubleClick("CP-RENDER")}>open report</button><button onClick={() => onDoubleClick("CP-1")}>open deepdive</button></div>,
  SwimlaneView: ({ onSelect, onDoubleClick }: { onSelect: (id: string) => void; onDoubleClick: (id: string) => void }) => <div>swimlanes<button onClick={() => onSelect("CP-1")}>select lane</button><button onClick={() => onDoubleClick("CP-1")}>open lane</button></div>,
  Inspector: ({ selected, onOpen }: { selected?: string | null; onOpen: (id: string) => void }) => <div>inspector {selected ?? "none"}<button onClick={() => onOpen("CP-1")}>inspect open</button></div>,
  LineagePanel: ({ onPick, onOpenEvidence }: { onPick: (driver: { lineage: string }) => void; onOpenEvidence: (id: string) => void }) => <div>demo lineage<button onClick={() => onPick({ lineage: "D-1 → CP-3B output" })}>pick driver</button><button onClick={() => onOpenEvidence("E-44")}>demo evidence</button></div>,
  LiveLineagePanel: ({ output, loading, onOpenEvidence }: { output: unknown; loading: boolean; onOpenEvidence: (id: string) => void }) => <div>live lineage {String(Boolean(output))} loading {String(loading)}<button onClick={() => onOpenEvidence("E-LIVE")}>live evidence</button></div>,
}));
vi.mock("@/lib/pipeline/sim", () => ({
  useSimRun: () => {
    state.simulationCalls += 1;
    return { sim: sim(), completed: 0, total: 24, playing: false, clock: "09:42" };
  },
}));
vi.mock("@/lib/pipeline/useLivePipeline", () => ({ useLivePipelineStatus: () => { state.pipelineStatusCalls += 1; return state.pipeline; } }));
vi.mock("@/lib/engine/useLiveRun", () => ({ useLiveRun: () => { state.liveRunCalls += 1; return state.liveRun; } }));
vi.mock("@/lib/engine/useFreshness", () => ({
  useIssuerFreshness: ({ runId }: { runId?: string | null }) => {
    state.freshnessCalls += 1;
    return { run: runId ? { evaluation: { state: `state-${runId}` } } : null };
  },
}));
vi.mock("@/lib/analysis-workbench", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analysis-workbench")>()),
  useAnalysisContext: () => ({ context: state.context, patch: (...args: unknown[]) => state.patch(...args), loading: false, error: null }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  listRuns: () => state.listError ? Promise.reject(new Error("offline")) : Promise.resolve(state.runs),
}));

import PipelinePage from "./page";

function analysisContext() {
  return {
    id: "context-pipeline",
    issuer_ids: [REFERENCE_ISSUER],
    artifacts: { issuer_run_id: null },
    surface_state: {},
  };
}

function run(id: string, issuer: string, status: string, extra: Record<string, unknown> = {}) {
  return { id, issuer_id: issuer, status, committee_status: null, as_of_date: null, ...extra };
}

beforeEach(() => {
  state.dataMode = "live";
  state.search = `issuer=${REFERENCE_ISSUER}`;
  state.pushes = [];
  state.replaces = [];
  state.runs = [];
  state.listError = false;
  state.simulationCalls = 0;
  state.pipelineStatusCalls = 0;
  state.freshnessCalls = 0;
  state.liveRunCalls = 0;
  state.context = null;
  state.patch.mockReset().mockResolvedValue(null);
  state.pipeline = { value: null, phase: "none", latest: null };
  state.liveRun = { liveOuts: {}, liveEvidence: {}, runId: null, loading: false, phase: "none" };
  localStorage.clear();
});

afterEach(() => cleanup());

describe("Pipeline route interaction coverage", () => {
  it("keeps Live and Reference controller hooks runtime-isolated in both directions", async () => {
    state.dataMode = "live";
    state.search = "issuer=issuer-live";
    state.pipeline = { value: null, phase: "none", latest: null };
    const view = render(<PipelinePage />);
    expect(await screen.findByText("No runs for this issuer")).toBeTruthy();
    expect(state.simulationCalls).toBe(0);
    expect(state.pipelineStatusCalls).toBeGreaterThan(0);
    expect(state.liveRunCalls).toBeGreaterThan(0);

    state.simulationCalls = 0;
    state.pipelineStatusCalls = 0;
    state.freshnessCalls = 0;
    state.liveRunCalls = 0;
    state.dataMode = "reference";
    state.search = `issuer=${REFERENCE_ISSUER}&run=run-live-hidden&mode=reference`;
    view.rerender(<PipelinePage />);

    expect((await screen.findAllByText(/24 planned · 0 executed/)).length).toBeGreaterThan(0);
    expect(state.simulationCalls).toBeGreaterThan(0);
    expect(state.pipelineStatusCalls).toBe(0);
    expect(state.freshnessCalls).toBe(0);
    expect(state.liveRunCalls).toBe(0);
    expect(document.body.textContent).not.toContain("state-run-live-hidden");
  });

  it("never presents reference/demo or live-unavailable fallback execution as running", () => {
    state.dataMode = "reference";
    const view = render(<PipelinePage />);
    const referenceSummary = screen.getByRole("group", { name: "Pipeline completion" });
    expect(referenceSummary.getAttribute("data-execution")).toBe("not-applicable");
    expect(referenceSummary.getAttribute("data-execution")).not.toBe("running");

    state.search = "issuer=issuer-live-unavailable";
    state.pipeline = { value: null, phase: "complete", latest: null };
    view.rerender(<PipelinePage />);
    const unavailableSummary = screen.getByRole("group", { name: "Pipeline completion" });
    expect(unavailableSummary.getAttribute("data-execution")).toBe("not-applicable");
    expect(unavailableSummary.getAttribute("data-execution")).not.toBe("running");

    state.dataMode = "live";
    state.search = "issuer=issuer-live&run=run-live-abcdef";
    state.pipeline = { value: live({ status: "running" }), phase: "in_flight", latest: { status: "running" } };
    view.rerender(<PipelinePage />);
    expect(screen.getByRole("group", { name: "Pipeline completion" }).getAttribute("data-execution")).toBe("running");
  });

  it("pipeline-10 pipeline-11 pipeline-14 pipeline-17 pipeline-18 pipeline-32 pipeline-34 pipeline-44 pipeline-45 drives reference views, route modes, module exits, lineage, evidence, and context sync", async () => {
    state.dataMode = "reference";
    state.search = `issuer=${REFERENCE_ISSUER}&run=run-demo&view=stage-lanes`;
    state.context = analysisContext();
    state.context.artifacts.issuer_run_id = "run-demo";
    render(<PipelinePage />);

    expect(await screen.findByText("swimlanes")).toBeTruthy();
    expect(state.patch).not.toHaveBeenCalled();
    const utility = screen.getByTestId("utility");
    expect(within(utility).getByRole("button", { name: "sim controls" })).toBeTruthy();
    fireEvent.click(within(utility).getByRole("button", { name: "Dependency map" }));
    const graph = await screen.findByText(/graph dim false/);
    expect(graph.getAttribute("data-scope")?.split(",")).toContain("CP-2");
    fireEvent(window, new CustomEvent("caos:subview-cycle", { detail: { direction: -1 } }));
    expect(await screen.findByText("swimlanes")).toBeTruthy();
    fireEvent(window, new CustomEvent("caos:subview-cycle", { detail: { direction: 0 } }));

    fireEvent.click(within(utility).getByTitle("Dim completed nodes"));
    expect(await screen.findByText(/graph dim true/)).toBeTruthy();
    fireEvent.click(within(utility).getByRole("button", { name: "LEGAL" }));
    await waitFor(() => {
      const legalScope = screen.getByText(/graph dim true/).getAttribute("data-scope")?.split(",") ?? [];
      expect(legalScope).toContain("CP-4");
      expect(legalScope).not.toContain("CP-2");
    });
    fireEvent.click(screen.getByRole("button", { name: "select graph" }));
    expect(screen.getByText("inspector CP-1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "pick driver" }));
    expect(screen.getByText("inspector CP-3B")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "open intake" }));
    fireEvent.click(screen.getByRole("button", { name: "open report" }));
    fireEvent.click(screen.getByRole("button", { name: "open deepdive" }));
    expect(state.pushes.some((href) => href.startsWith("/upload?") && href.includes("context-pipeline"))).toBe(true);
    expect(state.pushes.some((href) => href.startsWith("/reports?") && href.includes("context-pipeline"))).toBe(true);
    expect(state.pushes.some((href) => href.startsWith("/deepdive?") && href.includes("mod=CP-1"))).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "demo evidence" }));
    expect(await screen.findByText(/evidence E-44 live false/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "close evidence" }));
  });

  it("pipeline-09 pipeline-15 pipeline-16 loads and selects the recent live-run worklist across all statuses", async () => {
    state.search = "run=run-complete";
    state.context = analysisContext();
    state.runs = [
      run("run-complete", "issuer-complete", "complete", { committee_status: "Approved", as_of_date: "2026-07-14" }),
      run("run-failed", "issuer-failed", "failed"),
      run("run-running", "issuer-running", "running"),
    ];
    state.pipeline = { value: live(), phase: "complete", latest: { status: "complete" } };
    render(<PipelinePage />);

    expect(await screen.findByLabelText("Recent analysis runs")).toBeTruthy();
    expect(screen.getByText("Approved")).toBeTruthy();
    expect(screen.getAllByText("UNRATED").length).toBeGreaterThan(0);
    expect(screen.getAllByText("UNKNOWN").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "SELECTED" })).toBeTruthy();
    expect(screen.getAllByText(/bar 66\.666/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CLEARANCE: COMMITTEE READY/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "OPEN" })[0]);
    expect(state.replaces[0]).toContain("issuer=issuer-failed");
    expect(state.replaces[0]).toContain("run=run-failed");
    expect(state.replaces[0]).toContain("context=context-pipeline");
  });

  it("pipeline-12 pipeline-17 pipeline-34 isolates a persisted live run from the URL-addressable reference plan", async () => {
    state.search = "issuer=issuer-live&run=run-live-abcdef";
    state.pipeline = { value: live(), phase: "complete", latest: { status: "complete" } };
    state.liveRun = {
      liveOuts: { "CP-5B": { sections: [{ title: "Decision-relevant driver lineage", rows: [] }] } },
      liveEvidence: { "E-LIVE": { title: "Persisted citation" } },
      runId: "run-live-abcdef",
      loading: false,
      phase: "complete",
    };
    const view = render(<PipelinePage />);

    expect(await screen.findByText(/live lineage true loading false/)).toBeTruthy();
    expect(screen.getByText(/live persisted/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "sim controls" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "live evidence" }));
    expect(await screen.findByText(/evidence E-LIVE live true/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "close evidence" }));

    expect(within(screen.getByTestId("enterprise-identity")).queryByRole("button", { name: "DEMO" })).toBeNull();
    state.dataMode = "reference";
    state.search = `issuer=${REFERENCE_ISSUER}&mode=reference`;
    view.rerender(<PipelinePage />);
    expect(await screen.findByText("demo lineage")).toBeTruthy();
    expect(screen.getByRole("button", { name: "sim controls" })).toBeTruthy();
    expect(within(screen.getByTestId("utility")).getByRole("button", { name: "COMMITTEE" })).toBeTruthy();
    expect(screen.getByText(/REFERENCE PLAN/)).toBeTruthy();
  });

  it("pipeline-09 renders honest real-issuer loading, service error, failed, in-progress, and empty states", () => {
    state.search = "issuer=issuer-state";
    state.pipeline = { value: null, phase: "loading", latest: null };
    const view = render(<PipelinePage />);
    expect(screen.getByTestId("surface-loading")).toBeTruthy();

    state.pipeline = { value: null, phase: "error", latest: null };
    view.rerender(<PipelinePage />);
    expect(screen.getByText("Run status unavailable")).toBeTruthy();

    state.pipeline = { value: null, phase: "in_flight", latest: { status: "failed" } };
    view.rerender(<PipelinePage />);
    expect(screen.getByText("Run failed")).toBeTruthy();

    state.pipeline = { value: null, phase: "in_flight", latest: { status: "running" } };
    view.rerender(<PipelinePage />);
    expect(screen.getByText("Run in progress")).toBeTruthy();

    state.pipeline = { value: null, phase: "none", latest: null };
    view.rerender(<PipelinePage />);
    expect(screen.getByRole("heading", { level: 2, name: "No runs for this issuer" })).toBeTruthy();
  });

  it("renders persisted partial rows and only offers a re-run handoff for a blocked module with its persisted reason", async () => {
    state.search = "issuer=issuer-partial&run=run-partial";
    state.pipeline = {
      value: live({
        status: "running",
        produced: 2,
        pending: 21,
        blocked: [{ moduleId: "CP-4C", reason: "Missing compliance certificate." }],
      }),
      phase: "in_flight",
      latest: { status: "running" },
    };
    render(<PipelinePage />);
    expect(await screen.findByText("Persisted execution snapshot")).toBeTruthy();
    expect(screen.getByText(/produced 2/)).toBeTruthy();
    expect(screen.getByText(/pending 21/)).toBeTruthy();
    expect(screen.getByText("Missing compliance certificate.")).toBeTruthy();
    const rerun = screen.getByRole("link", { name: "Prepare re-run" });
    expect(rerun.getAttribute("href")).toBe("/upload?issuer=issuer-partial");
  });

  it("pipeline-14 pipeline-45 shows an unavailable live worklist and keeps Reference module URLs isolated", async () => {
    state.dataMode = "live";
    state.search = "issuer=issuer-live&run=run-live-abcdef";
    state.listError = true;
    state.pipeline = { value: live(), phase: "complete", latest: { status: "complete" } };
    const view = render(<PipelinePage />);
    expect(await screen.findByRole("status")).toHaveProperty("textContent", expect.stringContaining("Run index unavailable"));

    state.dataMode = "reference";
    state.search = "";
    state.listError = false;
    view.rerender(<PipelinePage />);
    expect(await screen.findByText(/graph dim false/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "open intake" }));
    fireEvent.click(screen.getByRole("button", { name: "open report" }));
    fireEvent.click(screen.getByRole("button", { name: "inspect open" }));
    expect(state.pushes).toContain(`/upload?issuer=${REFERENCE_ISSUER}&mode=reference`);
    expect(state.pushes.some((href) => href.startsWith("/reports?issuer=") && href.includes("mode=reference"))).toBe(true);
    expect(state.pushes.some((href) => href.startsWith("/deepdive?issuer=") && href.includes("mod=CP-1") && href.includes("mode=reference"))).toBe(true);
  });

  it("pipeline-10 hydrates the stored swimlane preference and removes the cycle listener on unmount", async () => {
    state.dataMode = "reference";
    localStorage.setItem("caos-b-view", "lanes");
    const remove = vi.spyOn(window, "removeEventListener");
    const view = render(<PipelinePage />);
    expect(await screen.findByText("swimlanes")).toBeTruthy();
    view.unmount();
    expect(remove).toHaveBeenCalledWith("caos:subview-cycle", expect.any(Function));
    remove.mockRestore();
  });

  it("pipeline-10 falls back to the graph when browser storage reads are denied", async () => {
    state.dataMode = "reference";
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
      throw new DOMException("Storage access denied", "SecurityError");
    });

    render(<PipelinePage />);

    expect(await screen.findByText(/graph dim false/)).toBeTruthy();
    expect(within(screen.getByTestId("utility")).getByRole("button", { name: "Dependency map" }).getAttribute("aria-pressed")).toBe("true");
    read.mockRestore();
  });

  it("pipeline-09 pipeline-10 pipeline-11 pipeline-12 pipeline-13 pipeline-14 pipeline-15 pipeline-16 pipeline-17 pipeline-18 pipeline-19 pipeline-20 pipeline-21 pipeline-22 pipeline-23 pipeline-24 pipeline-25 pipeline-26 pipeline-27 pipeline-28 pipeline-29 pipeline-30 pipeline-31 pipeline-32 pipeline-33 pipeline-34 pipeline-35 pipeline-43 pipeline-44 pipeline-45 keeps the composed workbench safe under invalid route and context input", async () => {
    state.dataMode = "reference";
    state.search = `issuer=${REFERENCE_ISSUER}&run=run-demo&view=diagonal`;
    state.context = analysisContext();
    state.context.id = "context/../?x=1&y=2";
    localStorage.setItem("caos-b-view", "unsupported");
    render(<PipelinePage />);

    expect(await screen.findByText(/graph dim false/)).toBeTruthy();
    expect(screen.getByRole("group", { name: "Pipeline completion" }).getAttribute("data-execution")).toBe("not-applicable");
    const utility = screen.getByTestId("utility");
    expect(within(utility).getByRole("button", { name: "Dependency map" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(utility).getByRole("button", { name: "sim controls" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "select graph" }));
    expect(screen.getByText("inspector CP-1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "pick driver" }));
    expect(screen.getByText("inspector CP-3B")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "demo evidence" }));
    expect(await screen.findByText(/evidence E-44 live false/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "close evidence" }));

    fireEvent.click(screen.getByRole("button", { name: "open deepdive" }));
    const deepDive = state.pushes.find((href) => href.startsWith("/deepdive?"));
    expect(deepDive).toBeTruthy();
    expect(deepDive).toContain("context=context%2F..%2F%3Fx%3D1%26y%3D2");
  });

  it("keeps live mode honest when no exact persisted run exists", async () => {
    state.dataMode = "live";
    state.search = "";
    state.runs = [];
    state.pipeline = { value: null, phase: "none", latest: null };
    render(<PipelinePage />);

    expect(await screen.findByText("No runs for this issuer")).toBeTruthy();
    expect(screen.getByTestId("enterprise-identity")).toHaveProperty("textContent", expect.stringContaining("Run state"));
    expect(screen.getByTestId("primary")).toHaveProperty("textContent", expect.stringContaining("DOCUMENT INTAKE"));
    expect(screen.queryByText(/graph dim/)).toBeNull();
    expect(screen.queryByRole("button", { name: "sim controls" })).toBeNull();
    expect(document.body.textContent).not.toContain("Atlas Forge");
  });

  it("labels an untouched Reference route as planned rather than executed or complete", async () => {
    state.dataMode = "reference";
    state.search = "view=dependency-map";
    state.runs = [run("run-live-hidden", "issuer-live", "complete")];
    render(<PipelinePage />);

    expect((await screen.findAllByText(/24 planned · 0 executed/)).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Recent analysis runs")).toBeNull();
    expect(document.body.textContent).not.toContain("run-live");
    expect(document.body.textContent).not.toContain("0/24");
    expect(document.body.textContent).not.toContain("bar 0");
    expect(screen.getAllByRole("button", { name: "Dependency map" })[0].getAttribute("aria-pressed")).toBe("true");
    expect(document.body.textContent).not.toContain("RUN COMPLETE");
  });
});
