// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const REFERENCE_ISSUER = "a71f0000-0000-0000-0000-000000000001";

const state = vi.hoisted(() => ({
  search: "",
  wide: false,
  mediaListener: null as (() => void) | null,
  simMods: {} as Record<string, { state: string }>,
  live: {
    loading: false,
    phase: "none",
    runId: null,
    asOf: null,
    committeeStatus: null,
    council: [] as Array<Record<string, string>>,
    liveEvidence: {},
    liveOuts: {} as Record<string, unknown>,
    liveStatus: {} as Record<string, string>,
  } as Record<string, unknown>,
  context: null as Record<string, unknown> | null,
  analysisError: null as string | null,
  analysisLoading: false,
  patchContext: vi.fn(),
  createFinding: vi.fn(),
  createThesisVersion: vi.fn(),
  getIssuerProfile: vi.fn(),
  updateWorkspace: vi.fn(),
  saveLayout: vi.fn(),
  setAsk: vi.fn(),
  exportRun: vi.fn(),
  provenanceDetail: "Evidence lineage available" as string | null,
}));

vi.mock("next/dynamic", () => {
  let index = 0;
  const names = ["debate", "recovery", "covenants", "module", "capacity", "scenario", "chat", "evidence"];
  return {
    default: (loader: () => Promise<unknown>, options?: { loading?: React.ComponentType }) => {
      void loader().catch(() => undefined);
      const name = names[index++] ?? "dynamic";
      return function DynamicCoverageStub(props: Record<string, unknown>) {
        const Loading = options?.loading;
        return (
          <div data-testid={`dynamic-${name}`}>
            {Loading ? <Loading /> : null}
            <span>{name} dynamic</span>
            {name === "capacity" ? <span>capacity signals {Object.keys((props.signals as Record<string, unknown> | undefined) ?? {}).length}</span> : null}
            {name === "chat" ? <span>chat issuer {String(props.issuerName)}</span> : null}
            {typeof props.onOpenEvidence === "function" ? <button onClick={() => (props.onOpenEvidence as (id: string) => void)("E-202")}>open {name} evidence</button> : null}
            {typeof props.onClose === "function" ? <button onClick={() => (props.onClose as () => void)()}>close {name}</button> : null}
          </div>
        );
      };
    },
  };
});
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(state.search) }));
vi.mock("@/components/shared/RequireAuth", () => ({ RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/EnterprisePage", () => ({
  EnterprisePage: (props: {
    identity?: React.ReactNode;
    primaryAction?: React.ReactNode;
    status?: React.ReactNode;
    contextualControls?: React.ReactNode;
    utilityControls?: React.ReactNode;
    narrowContract?: { essentialControls?: React.ReactNode };
    children: React.ReactNode;
  }) => (
    <main>
      <div data-testid="identity">{props.identity}</div>
      <div data-testid="primary-action">{props.primaryAction}</div>
      <div data-testid="status">{props.status}</div>
      <div data-testid="contextual">{props.contextualControls}</div>
      <div data-testid="utility">{props.utilityControls}</div>
      <div data-testid="narrow">{props.narrowContract?.essentialControls}</div>
      {props.children}
    </main>
  ),
}));
vi.mock("@/components/shared/ShellIdentity", () => ({
  ShellIdentity: ({ title, children }: { title: string; children?: React.ReactNode }) => <div><h1>{title}</h1>{children}</div>,
}));
vi.mock("@/components/shared/DecisionHeader", () => ({ DecisionHeader: () => <div>decision header</div> }));
vi.mock("@/components/shared/PersonaWorkbench", () => ({
  PersonaWorkbench: ({ decision, primary }: { decision?: React.ReactNode; primary: React.ReactNode }) => <div>{decision}{primary}</div>,
}));
vi.mock("@/components/shared/FirstRunHint", () => ({ FirstRunHint: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/shared/CrossDefaultDominoes", () => ({ CrossDefaultDominoes: ({ issuerId, hasRun }: { issuerId: string; hasRun: boolean }) => <div>dominoes {issuerId} {String(hasRun)}</div> }));
vi.mock("@/components/shared/StatusGlyph", () => ({ StatusGlyph: ({ kind }: { kind: string }) => <span>status {kind}</span> }));
vi.mock("@/components/reports/ExportToVaultButton", () => ({
  ExportToVaultButton: ({ runId }: { runId: string }) => <button onClick={() => state.exportRun(runId)}>export {runId}</button>,
}));
vi.mock("@/components/pipeline/atoms", () => ({
  Dot: ({ sev }: { sev: string }) => <span>dot {sev}</span>,
  SimControls: () => <div>sim controls</div>,
}));
vi.mock("@/components/deepdive/rails", () => ({
  Panel: ({ children, title, right }: { children: React.ReactNode; title: string; right?: React.ReactNode }) => <section><h2>{title}</h2>{right}{children}</section>,
  SourceRail: ({ open, onToggle }: { open: boolean; onToggle: () => void }) => <aside>source rail {String(open)}<button onClick={onToggle}>toggle source rail</button></aside>,
  DecisionRail: ({ open, onToggle, councilState }: { open: boolean; onToggle: () => void; councilState: string }) => <aside>decision rail {String(open)} · {councilState}<button onClick={onToggle}>toggle decision rail</button></aside>,
}));
vi.mock("@/components/deepdive/ModuleFinder", () => ({
  ModuleFinder: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <div>
      <button onClick={() => onSelect("CP-4")}>finder CP-4</button>
      <button onClick={() => onSelect("CP-2G")}>finder CP-2G</button>
      <button onClick={() => onSelect("not-a-module")}>finder invalid</button>
    </div>
  ),
}));
vi.mock("@/components/deepdive/StandingViewStrip", () => ({
  StandingViewStrip: ({ onRevise }: { onRevise: (id: string) => void }) => <button onClick={() => onRevise("CP-3B")}>revise recovery</button>,
}));
vi.mock("@/lib/evidence-sync", () => ({ EvidenceSyncProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/provenance", () => ({
  fromReportCaveat: () => ({ kind: "fixture", label: "Fixture", detail: state.provenanceDetail }),
}));
vi.mock("@/lib/pipeline/sim", () => ({
  useSimRun: () => ({
    completed: Object.values(state.simMods).filter((m) => m.state === "pass").length,
    total: 27,
    sim: { mods: new Proxy(state.simMods, { get: (target, prop: string) => target[prop] ?? { state: "pass" } }) },
  }),
}));
vi.mock("@/lib/engine/useLiveRun", () => ({ useLiveRun: () => state.live }));
vi.mock("@/components/shared/Ask", async () => {
  const React = await import("react");
  return {
    useAsk: () => {
      const [open, setOpenState] = React.useState(false);
      return {
        open,
        setOpen: (next: boolean) => {
          state.setAsk(next);
          setOpenState(next);
        },
      };
    },
  };
});
vi.mock("@/lib/deepdive/layout-pref", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/deepdive/layout-pref")>()),
  loadLayout: () => "report",
  saveLayout: (layout: string) => state.saveLayout(layout),
}));
vi.mock("@/lib/analysis-workbench", () => ({
  useAnalysisContext: () => ({
    context: state.context,
    error: state.analysisError,
    loading: state.analysisLoading,
    patch: (...args: unknown[]) => state.patchContext(...args),
  }),
  analysisApi: { createFinding: (...args: unknown[]) => state.createFinding(...args) },
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  createThesisVersion: (...args: unknown[]) => state.createThesisVersion(...args),
  getIssuerProfile: (...args: unknown[]) => state.getIssuerProfile(...args),
  updateAnalystWorkspace: (updater: (workspace: Record<string, unknown>) => Record<string, unknown>) => state.updateWorkspace(updater),
}));

import { MODULES as PIPELINE_MODULES } from "@/lib/pipeline/data";
import DeepDivePage from "./page";

function context(issuerIds = [REFERENCE_ISSUER]) {
  return {
    id: "context-deep",
    issuer_ids: issuerIds,
    artifacts: { issuer_run_id: null },
    surface_state: {},
  };
}

function live(overrides: Record<string, unknown> = {}) {
  return {
    loading: false,
    phase: "complete",
    runId: "run-live-123456",
    asOf: "2026-07-14T00:00:00Z",
    committeeStatus: "Approved",
    council: [{ finding_id: "F-1", severity: "Material", required_remediation: "Reduce exposure" }],
    liveEvidence: { "E-202": { title: "Credit agreement" } },
    liveOuts: { "CP-1": { summary: "Live output" }, "CP-4": { summary: "Covenant output" } },
    liveStatus: { "CP-1": "pass", "CP-4": "pass" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  state.search = "";
  state.wide = false;
  state.mediaListener = null;
  state.simMods = {};
  state.live = {
    loading: false,
    phase: "none",
    runId: null,
    asOf: null,
    committeeStatus: null,
    council: [],
    liveEvidence: {},
    liveOuts: {},
    liveStatus: {},
  };
  state.context = context();
  state.analysisError = null;
  state.analysisLoading = false;
  state.provenanceDetail = "Evidence lineage available";
  state.patchContext.mockResolvedValue(null);
  state.createFinding.mockResolvedValue({ id: "finding-1" });
  state.createThesisVersion.mockResolvedValue({ id: "thesis-1", version: 3 });
  state.getIssuerProfile.mockResolvedValue({
    issuer: { id: "issuer-live", name: "Kestrel Chemicals", ticker: "KSTL" },
    signals: { net_leverage: 5.4 },
  });
  state.updateWorkspace.mockImplementation(async (updater: (workspace: Record<string, unknown>) => Record<string, unknown>) => updater({ affirmations: [{ issuerId: "old" }] }));
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1600 });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      get matches() { return state.wide; },
      media: "(min-width: 1536px)",
      onchange: null,
      addEventListener: (_name: string, listener: () => void) => { state.mediaListener = listener; },
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Deep-Dive reference interaction coverage", () => {
  it("covers layouts, module navigation, accordion modes, pane collapse, chat, and lazy evidence", async () => {
    const view = render(<DeepDivePage />);
    expect(await screen.findByText("debate dynamic")).toBeTruthy();
    expect(screen.getByText("decision header")).toBeTruthy();
    expect(screen.getByText("scenario dynamic")).toBeTruthy();
    expect(screen.getByText(/Three panes:/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Affirm thesis" }));
    expect(await screen.findByText("Reference output cannot be ratified.")).toBeTruthy();

    // Narrow layouts preserve the complete analyst workflow instead of
    // substituting the former read-only triage card.
    expect(screen.queryByText("Compact review · read only")).toBeNull();
    expect(screen.getByRole("button", { name: "toggle source rail" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "toggle decision rail" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "open debate evidence" })).toBeTruthy();

    for (const containerId of ["narrow", "utility"]) {
      for (const label of ["Summary", "Report", "Dense"]) {
        fireEvent.click(findButton(screen.getByTestId(containerId), label));
        expect(state.saveLayout).toHaveBeenLastCalledWith(label.toLowerCase());
      }
    }

    fireEvent.click(screen.getByRole("button", { name: "revise recovery" }));
    expect(await screen.findByText("recovery dynamic")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "finder CP-4" }));
    expect(await screen.findByText("covenants dynamic")).toBeTruthy();
    expect(screen.getByText(/dominoes.*false/)).toBeTruthy();
    fireEvent.click(screen.getByTitle("Expand L6 DEBATE"));
    fireEvent.click(screen.getByRole("button", { name: "Portfolio Debate" }));
    expect(await screen.findByText("debate dynamic")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "finder CP-2G" }));
    expect(await screen.findByText("◦ NO REFERENCE OUTPUT")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "finder invalid" }));
    fireEvent(window, new CustomEvent("caos:subview-cycle", { detail: { direction: 0 } }));
    expect(await screen.findByText(/Source Readiness.*CP-0/)).toBeTruthy();
    fireEvent(window, new CustomEvent("caos:subview-cycle", { detail: { direction: -1 } }));

    const layer = screen.getByTitle(/Collapse L0 · ORCH|Expand L0 · ORCH/);
    fireEvent.click(layer);
    fireEvent.click(screen.getByTitle(/Expand L0 · ORCH|Collapse L0 · ORCH/));
    state.wide = true;
    act(() => state.mediaListener?.());
    fireEvent.click(screen.getByTitle(/Collapse L0 · ORCH/));
    fireEvent.click(screen.getByTitle(/Expand L0 · ORCH/));

    fireEvent.click(screen.getByRole("button", { name: "toggle source rail" }));
    fireEvent.click(screen.getByRole("button", { name: "toggle decision rail" }));
    fireEvent(window, new Event("caos:collapse-toggle"));
    fireEvent(window, new Event("caos:collapse-toggle"));

    fireEvent.click(findButton(screen.getByTestId("contextual"), /ASK/));
    expect(await screen.findByText("chat dynamic")).toBeTruthy();
    expect(screen.getByText("chat issuer undefined")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "close chat" }));
    expect(state.setAsk).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "finder CP-4" }));
    fireEvent.click(await screen.findByRole("button", { name: "open covenants evidence" }));
    expect(await screen.findByText("evidence dynamic")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "close evidence" }));

    state.simMods["CP-4C"] = { state: "idle" };
    view.rerender(<DeepDivePage />);
    expect(await screen.findByText("CP-4C awaiting upstream dependencies")).toBeTruthy();
    expect(screen.getByText(/Awaiting:/)).toBeTruthy();
    state.simMods["CP-4C"] = { state: "running" };
    view.rerender(<DeepDivePage />);
    expect(await screen.findByText("CP-4C running…")).toBeTruthy();
    expect(screen.queryByText(/Awaiting:/)).toBeNull();
  });

  it("measures strip overflow, exposes paging controls, and handles responsive decision collapse", async () => {
    window.innerWidth = 1300;
    render(<DeepDivePage />);
    await screen.findByText("debate dynamic");
    const strip = screen.getByRole("button", { name: "finder CP-4" }).parentElement!.parentElement!;
    Object.defineProperty(strip, "clientWidth", { configurable: true, value: 300 });
    Object.defineProperty(strip, "scrollWidth", { configurable: true, value: 900 });
    Object.defineProperty(strip, "scrollLeft", { configurable: true, writable: true, value: 120 });
    Object.defineProperty(strip, "scrollBy", { configurable: true, value: vi.fn() });
    fireEvent.scroll(strip);
    fireEvent.click(await screen.findByRole("button", { name: "Scroll module layers left" }));
    fireEvent.click(screen.getByRole("button", { name: "Scroll module layers right" }));
    expect((strip as HTMLElement & { scrollBy: ReturnType<typeof vi.fn> }).scrollBy).toHaveBeenCalledTimes(2);

    act(() => {
      window.innerWidth = 1500;
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByText(/decision rail true/)).toBeTruthy();
  });

  it("scrolls a genuinely off-screen active module and tolerates the deferred measurement after unmount", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
      return this.getAttribute("data-active-chip") === "true" ? 800 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(60);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("caos-no-scrollbar") ? 300 : 0;
    });
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scrollTo });

    const view = render(<DeepDivePage />);
    await screen.findByText("debate dynamic");
    expect(scrollTo).toHaveBeenCalledWith({ left: 680, behavior: "auto" });
    expect(frames.length).toBeGreaterThan(0);

    view.unmount();
    act(() => frames.forEach((callback) => callback(0)));
  });

  it("summarizes unknown replay states as idle and renders an invalid gate without invented dependencies", async () => {
    state.simMods = {
      "CP-1": { state: "mystery" },
      "CP-1A": { state: "warning" },
      "CP-1B": { state: "failed" },
      "CP-1C": { state: "not-reviewed" },
      "not-a-module": { state: "idle" },
    };
    state.search = "mod=not-a-module";
    render(<DeepDivePage />);

    expect(await screen.findByText("not-a-module awaiting upstream dependencies")).toBeTruthy();
    expect(screen.queryByText(/^Awaiting:/)).toBeNull();
    const layer = screen.getByTitle("Expand L1 BASE");
    expect(layer.textContent).toContain("w/ concerns");
    expect(layer.textContent).toContain("failed");
    expect(layer.textContent).toContain("not reviewed");
    expect(layer.textContent).toContain("gated");
  });

  it("falls back to a module id when the static module catalog is incomplete", async () => {
    const modules = PIPELINE_MODULES as Array<(typeof PIPELINE_MODULES)[number]>;
    const index = modules.findIndex((module) => module.id === "CP-X");
    const [removed] = modules.splice(index, 1);
    state.search = "mod=CP-X";
    try {
      render(<DeepDivePage />);
      expect(await screen.findByRole("button", { name: "CP-X" })).toBeTruthy();
    } finally {
      modules.splice(index, 0, removed);
    }
  });
});

describe("Deep-Dive live issuer and affirmation coverage", () => {
  it("distinguishes issuer lookup failure/retry and live run caveat states", async () => {
    state.search = "issuer=issuer-live&mod=CP-1";
    state.context = context(["issuer-live"]);
    state.getIssuerProfile.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({
      issuer: { id: "issuer-live", name: "Kestrel Chemicals", ticker: "KSTL" },
      signals: { net_leverage: 5.4 },
    });
    state.live = { ...live(), loading: true, phase: "loading", runId: null, asOf: null };
    const view = render(<DeepDivePage />);
    expect(await screen.findByTitle("Issuer lookup failed — retry")).toBeTruthy();
    expect(screen.getByText("checking for live run…")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Issuer lookup failed — retry"));
    expect((await screen.findAllByText("Kestrel Chemicals")).length).toBeGreaterThan(0);

    state.live = { ...live(), loading: false, phase: "error", runId: null, asOf: null };
    view.rerender(<DeepDivePage />);
    expect(await screen.findByText("could not load live run")).toBeTruthy();
    state.live = { ...live(), phase: "none", runId: null, asOf: null };
    view.rerender(<DeepDivePage />);
    expect(await screen.findByText(/no run for KSTL/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Affirm thesis" }));
    expect(await screen.findByText("A completed owned run is required before affirmation.")).toBeTruthy();
    fireEvent.click(findButton(screen.getByTestId("contextual"), /ASK/));
    expect(await screen.findByText("chat dynamic")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "close chat" }));

    state.live = live();
    view.rerender(<DeepDivePage />);
    expect(await screen.findByTitle(/Rendering this issuer's live engine output.*QA status: Passed/)).toBeTruthy();
    expect(screen.getByText("module dynamic")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "export run-live-123456" }));
    expect(state.exportRun).toHaveBeenCalledWith("run-live-123456");
    fireEvent.click(screen.getByRole("button", { name: "finder CP-4" }));
    expect(await screen.findByText("capacity dynamic")).toBeTruthy();
    expect(screen.getByText(/dominoes issuer-live true/)).toBeTruthy();

    // CP-4's pane includes the CP-4C gate: the worst persisted status wins, so
    // a passed CP-4 can never greenwash a restricted or blocked covenant gate.
    state.live = live({ liveStatus: { "CP-4": "Passed", "CP-4C": "Restricted" } });
    view.rerender(<DeepDivePage />);
    expect(await screen.findByText("△ RESTRICTED")).toBeTruthy();
    state.live = live({ liveStatus: { "CP-4": "Passed", "CP-4C": "Blocked" } });
    view.rerender(<DeepDivePage />);
    expect(await screen.findByText("✕ BLOCKED")).toBeTruthy();

    state.live = live({ liveStatus: { "CP-4": "Blocked" } });
    view.rerender(<DeepDivePage />);
    expect(await screen.findByText("CP-4 failed")).toBeTruthy();
    state.live = live({ liveOuts: {}, liveStatus: {} });
    view.rerender(<DeepDivePage />);
    expect(await screen.findByText("◦ NO OUTPUT")).toBeTruthy();
  });

  it("affirms and pins a live thesis, including partial and error recovery", async () => {
    state.search = "issuer=issuer-live&mod=CP-1";
    state.context = context([]);
    state.live = live();
    state.patchContext.mockRejectedValueOnce(new Error("sync failed")).mockResolvedValue(null);
    render(<DeepDivePage />);
    expect(await screen.findByText("Analysis context could not be updated.")).toBeTruthy();

    const affirm = screen.getByRole("button", { name: "Affirm thesis" });
    fireEvent.click(affirm);
    expect(await screen.findByText("Thesis v3 saved and pinned.")).toBeTruthy();
    expect(state.createThesisVersion).toHaveBeenCalledWith(expect.objectContaining({ issuer_id: "issuer-live", trigger: "manual" }));
    expect(state.createFinding).toHaveBeenCalledWith(expect.objectContaining({ source_surface: "deep-dive", source_run_id: "run-live-123456" }));
    const workspaceUpdater = state.updateWorkspace.mock.calls[0][0] as (workspace: Record<string, unknown>) => Record<string, unknown>;
    expect((workspaceUpdater({ affirmations: "invalid" }).affirmations as unknown[]).length).toBe(1);

    state.createFinding.mockRejectedValueOnce(new Error("pin offline"));
    fireEvent.click(screen.getByRole("button", { name: "Thesis affirmed" }));
    expect(await screen.findByText("Thesis v3 saved; finding pin needs retry.")).toBeTruthy();

    state.createThesisVersion.mockRejectedValueOnce(new Error("thesis conflict"));
    fireEvent.click(screen.getByRole("button", { name: "Affirm thesis" }));
    expect(await screen.findByText("thesis conflict")).toBeTruthy();
    state.createThesisVersion.mockRejectedValueOnce("unknown");
    fireEvent.click(screen.getByRole("button", { name: "Affirm thesis" }));
    expect(await screen.findByText("View could not be affirmed.")).toBeTruthy();
  });

  it("requires an analysis context even when a live run is present", async () => {
    state.search = "issuer=issuer-live&mod=CP-1";
    state.context = null;
    state.analysisError = "analysis context offline";
    state.live = live({ council: [], committeeStatus: null });
    render(<DeepDivePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Affirm thesis" }));
    expect(await screen.findByText("analysis context offline")).toBeTruthy();
  });

  it("fails unknown persisted QA closed and covers every accepted status spelling", async () => {
    state.search = "issuer=issuer-live&mod=CP-1";
    state.context = context(["issuer-live"]);
    state.live = live({
      liveOuts: { "CP-1": { summary: "Only output" } },
      liveStatus: { "CP-1": "future-status" },
      council: [
        { finding_id: "F-1", severity: "Material", required_remediation: "One" },
        { finding_id: "F-2", severity: "Minor", required_remediation: "Two" },
      ],
    });
    state.provenanceDetail = null;
    const view = render(<DeepDivePage />);
    expect(await screen.findByText("◦ NOT REVIEWED")).toBeTruthy();

    for (const [status, label] of [
      [undefined, "◦ NO QA STATUS"],
      ["warning", "△ RESTRICTED"],
      ["pass", "● LIVE · PASSED"],
      ["failed", "CP-1 failed"],
    ] as const) {
      state.live = live({
        liveOuts: { "CP-1": { summary: "Only output" } },
        liveStatus: status === undefined ? {} : { "CP-1": status },
      });
      view.rerender(<DeepDivePage />);
      expect(await screen.findByText(label)).toBeTruthy();
    }

    state.live = live({ liveOuts: { "CP-1": { summary: "Only output" } }, council: [], committeeStatus: "Approved" });
    view.rerender(<DeepDivePage />);
    expect(await screen.findByText("● LIVE · PASSED")).toBeTruthy();

    state.live = { ...live(), loading: false, phase: "in_flight", runId: null, asOf: null };
    view.rerender(<DeepDivePage />);
    expect(await screen.findByText(/no run for KSTL/)).toBeTruthy();
  });

  it("grounds live evidence and chat while the issuer profile is available", async () => {
    state.search = "issuer=issuer-live&mod=CP-1";
    state.context = context(["issuer-live"]);
    state.live = live({ liveOuts: { "CP-1": { summary: "Only output" } } });
    render(<DeepDivePage />);

    fireEvent.click(await screen.findByRole("button", { name: "open module evidence" }));
    expect(await screen.findByText("evidence dynamic")).toBeTruthy();
    expect((await screen.findAllByText("Kestrel Chemicals")).length).toBeGreaterThan(0);
    fireEvent.click(findButton(screen.getByTestId("contextual"), /ASK/));
    expect(await screen.findByText("chat dynamic")).toBeTruthy();
    expect(screen.getByText("chat issuer Kestrel Chemicals")).toBeTruthy();
  });

  it("renders CP-4 capacity without profile signals and exposes the analysis-loading action reason", async () => {
    state.search = "issuer=issuer-live&mod=CP-4";
    state.context = context(["issuer-live"]);
    state.analysisLoading = true;
    state.getIssuerProfile.mockRejectedValue(new Error("profile offline"));
    state.live = live({ liveOuts: { "CP-4": { summary: "Covenant output" } } });
    render(<DeepDivePage />);

    expect(await screen.findByText("capacity signals 0")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Affirm thesis" }).title).toBe("Preparing analysis workspace…");
    expect(await screen.findByTitle("Issuer lookup failed — retry")).toBeTruthy();
    fireEvent.click(findButton(screen.getByTestId("contextual"), /ASK/));
    expect(await screen.findByText("chat dynamic")).toBeTruthy();
    expect(screen.getByText("chat issuer undefined")).toBeTruthy();
  });

  it("affirms a default live module without optional run metadata", async () => {
    state.search = "issuer=issuer-live";
    state.context = context(["issuer-live"]);
    state.provenanceDetail = null;
    state.live = live({
      asOf: null,
      committeeStatus: null,
      council: [],
      liveOuts: { "CP-1": { summary: "Single output" } },
      liveStatus: { "CP-1": "pass" },
    });
    render(<DeepDivePage />);

    fireEvent.click(await screen.findByRole("button", { name: "Affirm thesis" }));
    expect(await screen.findByText("Thesis v3 saved and pinned.")).toBeTruthy();
    expect(state.createThesisVersion).toHaveBeenCalledWith(expect.objectContaining({
      thesis_md: expect.stringContaining("Observed: unknown\nCommittee state: unratified"),
    }));
    expect(state.patchContext).toHaveBeenCalledWith(expect.objectContaining({
      issuer_ids: ["issuer-live"],
    }));
  });
});

function findButton(container: HTMLElement, name: string | RegExp): HTMLElement {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) => {
    const text = candidate.textContent?.trim() ?? "";
    return typeof name === "string" ? text === name : name.test(text);
  });
  if (!button) throw new Error(`Missing button ${String(name)}`);
  return button as HTMLElement;
}
