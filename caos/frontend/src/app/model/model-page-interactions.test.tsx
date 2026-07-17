// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ModelCheckpointDTO } from "@/lib/api";

const REFERENCE_ISSUER = "a71f0000-0000-0000-0000-000000000001";

const state = vi.hoisted(() => ({
  search: "",
  engine: {
    anchor: null,
    downside: null,
    downsideState: "unavailable",
    runId: null,
    committeeStatus: null,
    live: false,
    loading: false,
    phase: "none",
    asOf: null,
  } as Record<string, unknown>,
  context: null as Record<string, unknown> | null,
  analysisError: null as string | null,
  analysisLoading: false,
  patchContext: vi.fn(),
  getSavedModel: vi.fn(),
  saveModel: vi.fn(),
  getModelCheckpoints: vi.fn(),
  createModelCheckpoint: vi.fn(),
  restoreModelCheckpoint: vi.fn(),
  getIssuerProfile: vi.fn(),
  exportModel: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  checkpoint: vi.fn(),
  restoreHistory: vi.fn(),
  deleteCheckpoint: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/model",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(state.search),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("./ModelAuthorityRoute", async () => {
  const [{ buildModel }, { buildReports }] = await Promise.all([
    import("@/lib/reports/model"),
    import("@/lib/reports/builders"),
  ]);
  return {
    ModelAuthorityRoute: ({ renderLegacy }: { renderLegacy: (runtime: { buildModel: typeof buildModel; buildReports: typeof buildReports }) => React.ReactNode }) => (
      <>{renderLegacy({ buildModel, buildReports })}</>
    ),
  };
});
vi.mock("@/lib/engine/useModelEngine", () => ({ useModelEngine: () => state.engine }));
vi.mock("@/lib/engine/useFreshness", () => ({
  useIssuerFreshness: () => null,
  derivedFreshness: () => null,
}));
vi.mock("@/lib/analysis-workbench", () => ({
  useAnalysisContext: () => ({
    context: state.context,
    error: state.analysisError,
    loading: state.analysisLoading,
    patch: (...args: unknown[]) => state.patchContext(...args),
  }),
}));
vi.mock("@/lib/model/useModelHistory", async () => {
  const React = await import("react");
  return {
    useModelHistory: () => {
      const [overrides, setOverrides] = React.useState<Record<string, number>>({});
      return {
        overrides,
        setOverrides,
        replaceOverrides: (next: Record<string, number>) => setOverrides(next),
        undo: state.undo,
        redo: state.redo,
        canUndo: true,
        canRedo: true,
        checkpoints: [{ id: "local-1", name: "Local pass", overrides: {}, createdAt: 1 }],
        checkpoint: state.checkpoint,
        restoreCheckpoint: state.restoreHistory,
        deleteCheckpoint: state.deleteCheckpoint,
        persistenceState: "idle",
        persistenceError: null,
      };
    },
  };
});
vi.mock("@/components/model/ModelHistoryControls", () => ({
  ModelHistoryControls: (props: {
    onUndo: () => void;
    onRedo: () => void;
    onCheckpoint: () => void;
    onRestore: (id: string) => void;
    onDelete: (id: string) => void;
  }) => (
    <div>
      <button onClick={props.onUndo}>history undo</button>
      <button onClick={props.onRedo}>history redo</button>
      <button onClick={props.onCheckpoint}>history checkpoint</button>
      <button onClick={() => props.onRestore("local-1")}>history restore</button>
      <button onClick={() => props.onDelete("local-1")}>history delete</button>
    </div>
  ),
}));
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
    <div>
      <div data-testid="identity">{props.identity}</div>
      <div data-testid="primary-actions">{props.primaryAction}</div>
      <div data-testid="status">{props.status}</div>
      <div data-testid="context-controls">{props.contextualControls}</div>
      <div data-testid="utility-controls">{props.utilityControls}</div>
      <div data-testid="narrow-controls">{props.narrowContract?.essentialControls}</div>
      {props.children}
    </div>
  ),
}));
vi.mock("@/components/shared/ShellIdentity", () => ({
  ShellIdentity: ({ title, badges, children }: { title: string; badges?: React.ReactNode; children?: React.ReactNode }) => (
    <div>{title}{badges}{children}</div>
  ),
}));
vi.mock("@/components/shared/PersonaWorkbench", () => ({
  PersonaWorkbench: ({ decision, primary }: { decision?: React.ReactNode; primary: React.ReactNode }) => <div>{decision}{primary}</div>,
}));
vi.mock("@/components/shared/DecisionHeader", () => ({ DecisionHeader: () => <div>decision header</div> }));
vi.mock("@/components/shared/FreshnessIndicator", () => ({ FreshnessIndicator: () => <span>freshness</span> }));
vi.mock("@/components/shared/ProvenanceChip", () => ({ ProvenanceChip: () => <span>provenance</span> }));
vi.mock("@/components/model/ModelSheet", () => ({
  Manifest: ({ setHl }: { setHl: (value: string | null) => void }) => (
    <div><button onClick={() => setHl("revenue")}>highlight manifest</button><button onClick={() => setHl(null)}>clear manifest</button></div>
  ),
  FormulaBar: ({ onResetCell, onOpenEvidence }: { onResetCell: (key: string) => void; onOpenEvidence: (id: string) => void }) => (
    <div><button onClick={() => onResetCell("q1:rev")}>reset formula cell</button><button onClick={() => onOpenEvidence("E-101")}>open evidence</button></div>
  ),
  Sheet: (props: {
    onSel: (cell: { row: string; col: string }) => void;
    onEdit: (cell: { row: string; col: string } | null) => void;
    onCommit: (value: string | null) => void;
    onPasteCells: (result: { applied: number; patch: Record<string, number>; skippedNotEditable: number; invalid: string[] }) => void;
    onToggleRow: (row: string) => void;
  }) => (
    <div role="grid" aria-label="mock model sheet">
      <button onClick={() => props.onSel({ row: "rev", col: "q1" })}>select cell</button>
      <button onClick={() => props.onEdit({ row: "rev", col: "q1" })}>begin cell edit</button>
      <button onClick={() => props.onCommit("125.5")}>commit valid</button>
      <button onClick={() => props.onCommit("bad value")}>commit invalid</button>
      <button onClick={() => props.onCommit(null)}>cancel edit</button>
      <button onClick={() => props.onPasteCells({ applied: 1, patch: { "q1:rev": 10 }, skippedNotEditable: 1, invalid: ["x", "y"] })}>paste mixed</button>
      <button onClick={() => props.onPasteCells({ applied: 0, patch: {}, skippedNotEditable: 0, invalid: [] })}>paste noop</button>
      <button onClick={() => props.onToggleRow("segment")}>toggle row</button>
    </div>
  ),
}));
vi.mock("@/components/model/AssumptionsPanel", () => ({
  AssumptionsPanel: (props: {
    onChange: (caseKey: "base" | "down", field: string, value: number) => void;
    onChangeYear: (caseKey: "base" | "down", year: 0 | 1 | 2, field: string, value: number) => void;
    onResetCase: (caseKey: "base" | "down") => void;
    onResetYearCell: (caseKey: "base" | "down", year: 0 | 1 | 2, field: string) => void;
    onScrub: (caseKey: "base" | "down", field: string, scope: "all" | 0 | 1 | 2) => void;
    onScrubEnd: () => void;
    onCollapse: () => void;
  }) => (
    <div data-testid="assumptions-panel">
      <button onClick={() => props.onChange("base", "gDrive", 0.03)}>change base assumption</button>
      <button onClick={() => props.onChange("down", "dGpm", -0.02)}>change down assumption</button>
      <button onClick={() => props.onChangeYear("base", 1, "gDrive", 0.04)}>change base year</button>
      <button onClick={() => props.onChangeYear("down", 2, "mCapex", 1.1)}>change down year</button>
      <button onClick={() => props.onResetCase("base")}>reset base case</button>
      <button onClick={() => props.onResetCase("down")}>reset down case</button>
      <button onClick={() => props.onResetYearCell("base", 1, "gDrive")}>clear base year</button>
      <button onClick={() => props.onResetYearCell("down", 2, "mCapex")}>clear down year</button>
      <button onClick={() => props.onScrub("base", "gDrive", "all")}>scrub all cash</button>
      <button onClick={() => props.onScrub("down", "mCapex", 1)}>scrub cascade</button>
      <button onClick={() => props.onScrub("base", "dGpm", 2)}>scrub noncash</button>
      <button onClick={() => props.onScrub("base", "unknown", 0)}>scrub unknown</button>
      <button onClick={props.onScrubEnd}>end scrub</button>
      <button onClick={props.onCollapse}>collapse assumptions</button>
    </div>
  ),
}));
vi.mock("@/components/model/ScenarioPanel", () => ({
  ScenarioPanel: ({ onCollapse }: { onCollapse: () => void }) => <div data-testid="scenario-panel"><button onClick={onCollapse}>collapse scenarios</button></div>,
}));
vi.mock("@/components/reports/EvidenceModal", () => ({
  EvidenceModal: ({ id, isLiveRun, onClose }: { id: string; isLiveRun: boolean; onClose: () => void }) => (
    <div role="dialog" aria-label="model evidence">{id} · {isLiveRun ? "live" : "reference"}<button onClick={onClose}>close evidence</button></div>
  ),
}));
vi.mock("@/components/model/export", () => ({ exportModel: (...args: unknown[]) => state.exportModel(...args) }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSavedModel: (...args: unknown[]) => state.getSavedModel(...args),
  saveModel: (...args: unknown[]) => state.saveModel(...args),
  getModelCheckpoints: (...args: unknown[]) => state.getModelCheckpoints(...args),
  createModelCheckpoint: (...args: unknown[]) => state.createModelCheckpoint(...args),
  restoreModelCheckpoint: (...args: unknown[]) => state.restoreModelCheckpoint(...args),
  getIssuerProfile: (...args: unknown[]) => state.getIssuerProfile(...args),
}));

import ModelPage from "./page";

function context(issuerIds = [REFERENCE_ISSUER]) {
  return {
    id: "context-model",
    issuer_ids: issuerIds,
    updated_at: "2026-07-14T00:00:00Z",
    artifacts: { issuer_run_id: null, model_checkpoint_id: null },
    surface_state: {},
  };
}

function checkpoint(overrides: Partial<ModelCheckpointDTO> = {}): ModelCheckpointDTO {
  return {
    id: "checkpoint-server-1",
    issuer_id: REFERENCE_ISSUER,
    context_id: "context-model",
    issuer_run_id: null,
    parent_checkpoint_id: null,
    label: "Committee base",
    payload_hash: "a".repeat(64),
    payload: {},
    authority: {},
    created_at: "2026-07-14T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  state.search = "";
  state.engine = {
    anchor: null,
    downside: null,
    downsideState: "unavailable",
    runId: null,
    committeeStatus: null,
    live: false,
    loading: false,
    phase: "none",
    asOf: null,
  };
  state.context = context();
  state.analysisError = null;
  state.analysisLoading = false;
  state.patchContext.mockResolvedValue(null);
  state.getSavedModel.mockResolvedValue(null);
  state.saveModel.mockResolvedValue({ issuer_id: REFERENCE_ISSUER, analyst_id: "analyst", payload: {}, updated_at: "2026-07-15T00:00:00Z" });
  state.getModelCheckpoints.mockResolvedValue([checkpoint()]);
  state.createModelCheckpoint.mockResolvedValue(checkpoint({ id: "checkpoint-new", label: "New checkpoint" }));
  state.restoreModelCheckpoint.mockResolvedValue({ issuer_id: REFERENCE_ISSUER, analyst_id: "analyst", payload: {}, updated_at: "2026-07-16T00:00:00Z" });
  state.getIssuerProfile.mockResolvedValue({ metrics: [{ key: "net_leverage", label: "Net leverage", value: 5.2 }] });
  state.exportModel.mockResolvedValue(undefined);
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
  Object.defineProperty(window, "confirm", { configurable: true, value: vi.fn(() => true) });
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => cleanup());

describe("legacy Model Builder interaction coverage", () => {
  it("model-05 exercises sheet editing, paste, assumptions, rails, keyboard history, evidence, and reset controls", async () => {
    window.localStorage.setItem("caos-d-overrides", JSON.stringify({ "q1:rev": 11, "q2:rev": 12 }));
    render(<ModelPage />);
    await screen.findByRole("grid", { name: "mock model sheet" });
    expect(window.localStorage.getItem("caos-d-overrides")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "highlight manifest" }));
    fireEvent.click(screen.getByRole("button", { name: "clear manifest" }));
    fireEvent.click(screen.getByRole("button", { name: "select cell" }));
    fireEvent.click(screen.getByRole("button", { name: "begin cell edit" }));
    fireEvent.click(screen.getByRole("button", { name: "commit valid" }));
    fireEvent.click(screen.getByRole("button", { name: "begin cell edit" }));
    fireEvent.click(screen.getByRole("button", { name: "commit invalid" }));
    expect((await screen.findByRole("alert")).textContent).toContain("bad value");
    fireEvent.click(screen.getByRole("button", { name: "begin cell edit" }));
    fireEvent.click(screen.getByRole("button", { name: "cancel edit" }));
    fireEvent.click(screen.getByRole("button", { name: "reset formula cell" }));

    fireEvent.click(screen.getByRole("button", { name: "paste mixed" }));
    expect((await screen.findByRole("status")).textContent).toContain("pasted 1 cell · 1 not editable · 2 invalid values discarded");
    fireEvent.click(screen.getByRole("button", { name: "paste noop" }));
    fireEvent.click(screen.getByRole("button", { name: "toggle row" }));
    fireEvent.click(screen.getByRole("button", { name: "toggle row" }));

    for (const name of [
      "change base assumption", "change down assumption", "change base year", "change down year",
      "scrub all cash", "scrub cascade", "scrub noncash", "scrub unknown", "end scrub",
      "clear base year", "clear down year", "reset base case", "reset down case",
    ]) fireEvent.click(screen.getByRole("button", { name }));

    fireEvent.click(screen.getByRole("button", { name: "collapse assumptions" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand Assumptions panel" }));
    fireEvent.click(screen.getByRole("button", { name: "collapse scenarios" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand Scenario & Sensitivity panel" }));
    fireEvent(window, new Event("caos:collapse-toggle"));
    fireEvent(window, new Event("caos:collapse-toggle"));

    fireEvent.click(screen.getByRole("button", { name: "open evidence" }));
    expect(screen.getByRole("dialog", { name: "model evidence" }).textContent).toContain("E-101 · reference");
    fireEvent.click(screen.getByRole("button", { name: "close evidence" }));

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "z", ctrlKey: true });
    expect(state.undo).toHaveBeenCalledTimes(1);
    expect(state.redo).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /OVERRIDES? · RESET/ }));
    fireEvent.click(screen.getByRole("button", { name: "▲ CONFIRM RESET?" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /CONFIRM RESET/ })).toBeNull());
  });

  it("model-06 model-42 covers narrow and utility controls, resize collapse, export degradation, checkpoint save, and server restore", async () => {
    window.sessionStorage.setItem(`caos-d-overrides:${REFERENCE_ISSUER}`, JSON.stringify({ "q1:rev": 20 }));
    state.getIssuerProfile.mockRejectedValue(new Error("profile offline"));
    render(<ModelPage />);
    await screen.findByRole("grid", { name: "mock model sheet" });

    fireEvent.click(withinRole(screen.getByTestId("narrow-controls"), "QTRS"));
    fireEvent.click(withinRole(screen.getByTestId("narrow-controls"), "ASMP"));
    fireEvent.click(withinRole(screen.getByTestId("narrow-controls"), "SCEN"));

    fireEvent.click(withinRole(screen.getByTestId("utility-controls"), "Open assumptions"));
    fireEvent.click(withinRole(screen.getByTestId("utility-controls"), "Open scenarios"));
    fireEvent.click(withinRole(screen.getByTestId("utility-controls"), "QUARTERS"));
    fireEvent.click(withinRole(screen.getByTestId("utility-controls"), "ASSUMPTIONS"));
    fireEvent.click(withinRole(screen.getByTestId("utility-controls"), "SCENARIOS"));

    act(() => {
      window.innerWidth = 900;
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByRole("button", { name: "Expand Assumptions panel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Expand Scenario & Sensitivity panel" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /EXPORT MODEL/ }));
    await waitFor(() => expect(state.exportModel).toHaveBeenCalled());
    expect(state.exportModel.mock.calls[0][4]).toMatchObject({ metrics: [] });
    fireEvent.click(withinRole(screen.getByTestId("utility-controls"), "Export model"));
    await waitFor(() => expect(state.exportModel).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Save model checkpoint" }));
    expect(await screen.findByText(/Checkpoint checkpoi saved/)).toBeTruthy();
    expect(state.createModelCheckpoint).toHaveBeenCalled();
    expect(state.patchContext).toHaveBeenCalledWith(expect.objectContaining({ artifacts: expect.objectContaining({ model_checkpoint_id: "checkpoint-new" }) }));

    const serverCheckpoint = await screen.findByRole("button", { name: /Committee base/ });
    fireEvent.click(serverCheckpoint);
    expect(await screen.findByText("Restored Committee base.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "history undo" }));
    fireEvent.click(screen.getByRole("button", { name: "history redo" }));
    fireEvent.click(screen.getByRole("button", { name: "history checkpoint" }));
    fireEvent.click(screen.getByRole("button", { name: "history restore" }));
    fireEvent.click(screen.getByRole("button", { name: "history delete" }));
    expect(state.checkpoint).toHaveBeenCalled();
    expect(state.restoreHistory).toHaveBeenCalledWith("local-1");
    expect(state.deleteCheckpoint).toHaveBeenCalledWith("local-1");
  });

  it("model-32 hydrates guarded server payload fields and preserves only finite overrides", async () => {
    state.getSavedModel.mockResolvedValue({
      issuer_id: REFERENCE_ISSUER,
      analyst_id: "analyst",
      updated_at: "2026-07-12T10:00:00Z",
      payload: {
        overrides: { "q1:rev": 42, bad: "text", infinite: Number.POSITIVE_INFINITY },
        assumptions: { base: { gDrive: 0.02 }, down: {}, baseYears: {}, downYears: {} },
        collapsedRows: ["segment", 17, null],
      },
    });
    render(<ModelPage />);
    await screen.findByText(/SAVED/);
    expect(window.sessionStorage.getItem(`caos-d-overrides:${REFERENCE_ISSUER}`)).toContain("q1:rev");
    expect(window.sessionStorage.getItem(`caos-d-overrides:${REFERENCE_ISSUER}`)).not.toContain("bad");
  });

  it("guards malformed optional saved payload sections", async () => {
    state.getSavedModel.mockResolvedValue({
      issuer_id: REFERENCE_ISSUER,
      analyst_id: "analyst",
      updated_at: null,
      payload: { overrides: [], assumptions: "invalid", collapsedRows: { row: "segment" } },
    });
    render(<ModelPage />);
    await screen.findByRole("grid", { name: "mock model sheet" });
    expect(window.sessionStorage.getItem(`caos-d-overrides:${REFERENCE_ISSUER}`)).toBe("{}");
  });

  it("reports context sync and checkpoint creation failures without losing the draft", async () => {
    state.context = context([]);
    state.engine = { ...state.engine, runId: "run-context", live: true };
    state.patchContext.mockRejectedValueOnce(new Error("context offline")).mockResolvedValue(null);
    state.createModelCheckpoint
      .mockRejectedValueOnce({ isAxiosError: true, response: { data: { detail: "checkpoint rate limited" } } })
      .mockRejectedValueOnce(new Error("checkpoint offline"));
    render(<ModelPage />);
    await screen.findByRole("grid", { name: "mock model sheet" });
    expect(await screen.findByText("Analysis context could not be updated.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save model checkpoint" }));
    expect(await screen.findByText("checkpoint rate limited")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save model checkpoint" }));
    expect(await screen.findByText("Checkpoint could not be saved.")).toBeTruthy();
  });

  it("explains why a saved draft cannot become a checkpoint before context bootstrap", async () => {
    state.context = null;
    state.analysisError = "context endpoint offline";
    render(<ModelPage />);
    await screen.findByRole("grid", { name: "mock model sheet" });
    fireEvent.click(screen.getByRole("button", { name: "Save model checkpoint" }));
    expect(await screen.findByText(/Working draft saved.*context endpoint offline/)).toBeTruthy();

    cleanup();
    state.analysisError = null;
    render(<ModelPage />);
    await screen.findByRole("grid", { name: "mock model sheet" });
    fireEvent.click(screen.getByRole("button", { name: "Save model checkpoint" }));
    expect(await screen.findByText(/Checkpoint will be available when analysis context is ready/)).toBeTruthy();
  });

  it("surfaces server checkpoint restore detail and generic failures", async () => {
    state.restoreModelCheckpoint
      .mockRejectedValueOnce({ isAxiosError: true, response: { data: { detail: "restore revision conflict" } } })
      .mockRejectedValueOnce(new Error("restore offline"));
    render(<ModelPage />);
    const restore = await screen.findByRole("button", { name: /Committee base/ });
    fireEvent.click(restore);
    expect(await screen.findByText("restore revision conflict")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Committee base/ }));
    expect(await screen.findByText("Checkpoint could not be restored.")).toBeTruthy();
  });

  it("covers the utility-drawer save-conflict recovery callback", async () => {
    state.saveModel.mockRejectedValue({ isAxiosError: true, response: { status: 409 } });
    render(<ModelPage />);
    await screen.findByRole("grid", { name: "mock model sheet" });
    fireEvent.click(screen.getByRole("button", { name: "Save model checkpoint" }));
    await screen.findByText(/SAVED ELSEWHERE/);
    fireEvent.click(withinRole(screen.getByTestId("utility-controls"), "Reload saved model"));
    await waitFor(() => expect(screen.queryByText(/SAVED ELSEWHERE/)).toBeNull());
  });
});

describe("legacy Model Builder live-engine states", () => {
  it("model-35 distinguishes live loading, unavailable, and error states", async () => {
    state.search = "issuer=issuer-live";
    state.context = context(["issuer-live"]);
    state.getModelCheckpoints.mockResolvedValue([]);
    state.engine = { ...state.engine, loading: true, phase: "loading" };
    const view = render(<ModelPage />);
    expect(await screen.findByText("Linking engine…")).toBeTruthy();
    expect(screen.getByText("· linking engine…")).toBeTruthy();

    cleanup();
    state.engine = { ...state.engine, loading: false, phase: "none" };
    render(<ModelPage />);
    expect(await screen.findByText("No issuer-specific model output")).toBeTruthy();
    expect(screen.getByText("NO MODEL OUTPUT")).toBeTruthy();

    cleanup();
    state.engine = { ...state.engine, phase: "error" };
    render(<ModelPage />);
    expect((await screen.findByRole("alert")).textContent).toContain("LIVE RUN UNAVAILABLE");
    view.unmount();
  });

  it("model-26 model-27 renders live CP-1 tie and drift provenance with issuer-safe export metadata", async () => {
    state.search = "issuer=issuer-live";
    state.context = context(["issuer-live"]);
    state.getModelCheckpoints.mockResolvedValue([]);
    state.engine = {
      anchor: { ltmRevenue: 1_000, ltmAdjEbitda: 200, netDebt: 800, netLeverage: 4, intCov: 2 },
      downside: null,
      downsideState: "unavailable",
      runId: "run-live-123456",
      committeeStatus: "Committee Ready",
      live: true,
      loading: false,
      phase: "complete",
      asOf: "2026-07-14T00:00:00Z",
    };
    const view = render(<ModelPage />);
    expect(await screen.findByText(/net lev ties CP-1 4.00x/)).toBeTruthy();
    expect(screen.getByText(/forecast cells unaudited — CP-5 scope is actuals only/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /EXPORT MODEL/ }));
    await waitFor(() => expect(state.exportModel).toHaveBeenCalled());
    expect(state.exportModel.mock.calls[0][3]).toMatchObject({
      header: "issuer-live — cash-flow model",
      filename: "issuer-live Cash-Flow Model.xlsx",
    });

    state.engine = {
      ...state.engine,
      anchor: { ltmRevenue: 1_000, ltmAdjEbitda: 200, netDebt: 800, netLeverage: 6, intCov: 2 },
    };
    view.rerender(<ModelPage />);
    expect(await screen.findByText(/grid 4.00x vs CP-1 6.00x/)).toBeTruthy();

    state.engine = {
      ...state.engine,
      anchor: { ltmRevenue: 1_000, ltmAdjEbitda: 0, netDebt: 800, netLeverage: 6, intCov: 0 },
    };
    view.rerender(<ModelPage />);
    expect(await screen.findByText(/CP-1 6.00x · grid n\/a/)).toBeTruthy();
  });
});

function withinRole(container: HTMLElement, name: string): HTMLElement {
  const match = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.trim() === name);
  if (!match) throw new Error(`Missing button ${name}`);
  return match as HTMLElement;
}
