// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  exportReportVersionBinary,
  getReportVersion,
  getReportDraft,
  getSavedModel,
  listReportVersions,
  previewReportVersion,
  publishReportVersion,
  saveReportDraft,
  type ReportDraftDTO,
  type ReportVersionDTO,
} from "@/lib/api";
import type { Report } from "@/lib/reports/builders";
import { DEFAULT_ASSUMPTIONS } from "@/lib/reports/assumptions";
import type { ReportEdits } from "@/components/reports/ReportDoc";
import ReportsPage from "./page";

type EnterprisePageMockProps = {
  identity?: React.ReactNode;
  primaryAction?: React.ReactNode;
  status?: React.ReactNode;
  utilityControls?: React.ReactNode;
  contextualControls?: React.ReactNode;
  narrowContract?: { essentialControls?: React.ReactNode };
  children?: React.ReactNode;
};

const controls = vi.hoisted(() => ({
  patch: vi.fn().mockResolvedValue(undefined),
  live: false,
  liveRunId: "run-1",
  committeeStatus: "Committee Ready" as string | null,
  enginePhase: "complete",
  contextRunId: "run-1" as string | null,
  checkpointId: "checkpoint-1" as string | null,
  hasContext: true,
  reportParam: "version-1" as string | null,
  forceReference: false,
  surfaceReports: undefined as Record<string, unknown> | null | undefined,
  liveOuts: {},
  liveStatus: {},
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/reports",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(controls.live && !controls.forceReference ? {
    issuer: "issuer-1",
    run: controls.liveRunId,
    ...(controls.reportParam ? { report: controls.reportParam } : {}),
  } : undefined),
}));

vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/shared/EnterprisePage", () => ({
  EnterprisePage: ({
    identity, primaryAction, status, utilityControls, contextualControls, narrowContract, children,
  }: EnterprisePageMockProps) => (
    <div>
      <header>{identity}{primaryAction}{status}{contextualControls}{narrowContract?.essentialControls}</header>
      <aside aria-label="Utilities">{utilityControls}</aside>
      <main>{children}</main>
    </div>
  ),
}));

vi.mock("@/components/shared/PersonaWorkbench", () => ({
  PersonaWorkbench: ({ primary }: { primary: React.ReactNode }) => <>{primary}</>,
}));

vi.mock("@/components/reports/ReportDoc", () => ({
  ReportDoc: ({ rep, paper, showSources, edits, onEdit, onOpenEvidence, hideAddbacks }: {
    rep: Report;
    paper?: string;
    showSources?: boolean;
    edits?: ReportEdits;
    onEdit?: (path: string, text: string) => void;
    onOpenEvidence?: (id: string) => void;
    hideAddbacks?: boolean;
  }) => (
    <section aria-label={`Document ${rep.id}`}>
      <output>{paper}|sources:{String(showSources)}|addbacks:{String(hideAddbacks)}|edits:{JSON.stringify(edits)}</output>
      {onEdit ? <button onClick={() => onEdit("s0.title", "Reviewed title")}>Apply document edit</button> : null}
      {onEdit ? <button onClick={() => onEdit("s9.title", "Blocked appendix edit")}>Apply appendix edit</button> : null}
      {onEdit ? <button onClick={() => onEdit("freeform", "Second edit")}>Apply second edit</button> : null}
      {onEdit ? <button onClick={() => onEdit("freeform", null as unknown as string)}>Delete second edit</button> : null}
      {onOpenEvidence ? <button onClick={() => onOpenEvidence("E-44")}>Open document evidence</button> : null}
    </section>
  ),
}));

vi.mock("@/components/reports/panels", () => ({
  ReportList: ({ reports, active, onSel, onCollapse }: {
    reports: Report[];
    active: string;
    onSel: (id: string) => void;
    onCollapse?: () => void;
  }) => (
    <nav aria-label="Report list">
      <button onClick={onCollapse}>Collapse deliverables</button>
      {reports.map((report) => (
        <button key={report.id} aria-pressed={active === report.id} onClick={() => onSel(report.id)}>
          Select {report.id}
        </button>
      ))}
    </nav>
  ),
  ComposePanel: ({ rep, onToggle }: { rep: Report; onToggle: (index: number) => void }) => <button onClick={() => onToggle(0)}>Toggle {rep.id} section</button>,
  ExportPanel: ({ rep, omitCount, editCount }: { rep: Report; omitCount: number; editCount?: number }) => <div>Export {rep.id} · {omitCount} omitted · {editCount} edits</div>,
  LineagePanel: ({ onOpenEvidence }: { onOpenEvidence: (id: string) => void }) => <button onClick={() => onOpenEvidence("E-99")}>Open lineage evidence</button>,
}));

vi.mock("@/components/reports/EvidenceModal", () => ({
  EvidenceModal: ({ id, onClose }: { id: string; onClose: () => void }) => <div role="dialog" aria-label={`Evidence ${id}`}><button onClick={onClose}>Close evidence</button></div>,
}));

vi.mock("@/components/decisions/DecisionRoomDrawer", () => ({
  DecisionRoomDrawer: ({ onClose, reportId }: { onClose: () => void; reportId?: string }) => <div role="dialog" aria-label="Decision room" data-report-id={reportId}><button onClick={onClose}>Close decision</button></div>,
}));

vi.mock("@/lib/analysis-workbench", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analysis-workbench")>()),
  useAnalysisContext: () => ({
    context: controls.hasContext ? {
      id: "context-1", name: "Report", issuer_ids: controls.live ? ["issuer-1"] : ["a71f0000-0000-0000-0000-000000000001"], instrument_ids: [],
      sub_segments: [], sector_id: null, portfolio_scope: null, as_of: null,
      sector_review_run_id: null, rv_snapshot_id: null, rv_run_id: null, query_session_id: null,
      artifacts: {
        issuer_run_id: controls.live ? controls.contextRunId : null,
        model_checkpoint_id: controls.live ? controls.checkpointId : null,
        source_manifest_id: null, report_version_id: controls.live ? "version-1" : null,
        research_job_id: null, alert_event_id: null, sponsor_id: null,
      },
      surface_state: controls.surfaceReports === undefined ? {} : { reports: controls.surfaceReports }, filters: {}, selected: {},
      created_at: "2026-07-14T00:00:00Z", updated_at: "2026-07-14T00:00:00Z",
    } : null,
    loading: false, error: null, patch: controls.patch, replace: vi.fn(), refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/engine/useLiveRun", () => ({
  useLiveRun: () => ({
    liveOuts: controls.liveOuts, liveStatus: controls.liveStatus, liveEvidence: {},
    runId: controls.live ? controls.liveRunId : null, asOf: controls.live ? "2026-06-30" : null,
    committeeStatus: controls.live ? controls.committeeStatus : null,
    council: [], loading: false, phase: controls.live ? controls.enginePhase : "none",
  }),
}));

vi.mock("@/lib/engine/useModelEngine", () => ({
  useModelEngine: () => ({
    anchor: null, downside: null, downsideState: "unavailable", runId: controls.live ? controls.liveRunId : null,
    committeeStatus: controls.live ? controls.committeeStatus : null,
    live: controls.live, loading: false, phase: controls.live ? controls.enginePhase : "none",
  }),
}));

vi.mock("@/lib/engine/useFreshness", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/engine/useFreshness")>()),
  useIssuerFreshness: () => ({
    issuer: null, run: null, context: null, issuerStatus: "idle", runStatus: "idle",
    contextStatus: "idle", contextRequested: false, loading: false,
    compatibilityUnavailable: false, error: false, unavailable: false,
  }),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSavedModel: vi.fn(),
  getReportVersion: vi.fn(),
  getReportDraft: vi.fn(),
  saveReportDraft: vi.fn(),
  listReportVersions: vi.fn(),
  previewReportVersion: vi.fn(),
  publishReportVersion: vi.fn(),
  exportReportVersionBinary: vi.fn(),
}));

beforeEach(() => {
  controls.patch.mockResolvedValue(undefined);
  controls.live = false;
  controls.liveRunId = "run-1";
  controls.committeeStatus = "Committee Ready";
  controls.enginePhase = "complete";
  controls.contextRunId = "run-1";
  controls.checkpointId = "checkpoint-1";
  controls.hasContext = true;
  controls.reportParam = "version-1";
  controls.forceReference = false;
  controls.surfaceReports = undefined;
  controls.liveOuts = {};
  controls.liveStatus = {};
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1700 });
  vi.mocked(getSavedModel).mockResolvedValue(null);
  vi.mocked(getReportDraft).mockResolvedValue({
    id: "draft-1",
    context_id: "context-1",
    revision: 4,
    payload: {
      issuer_id: "a71f0000-0000-0000-0000-000000000001",
      active_id: "snapshot",
      omit: {},
      edits: {},
      paper: "#eef0f3",
      show_sources: false,
      hide_addbacks: false,
    },
    updated_at: "2026-07-14T00:00:00Z",
  } satisfies ReportDraftDTO);
  vi.mocked(saveReportDraft).mockResolvedValue({
    id: "draft-1",
    context_id: "context-1",
    revision: 5,
    payload: {},
    updated_at: "2026-07-14T00:00:01Z",
  } satisfies ReportDraftDTO);
  vi.mocked(listReportVersions).mockResolvedValue([]);
  vi.mocked(getReportVersion).mockReset();
  vi.mocked(previewReportVersion).mockReset();
  vi.mocked(publishReportVersion).mockReset();
  vi.mocked(exportReportVersionBinary).mockReset();
  localStorage.clear();
});

interface TestFiber {
  memoizedProps: Record<string, (...args: unknown[]) => unknown>;
}

function hostProps(element: Element) {
  const key = Object.keys(element).find((candidate) => candidate.startsWith("__reactFiber$"));
  if (!key) throw new Error("React host fiber was not found");
  const fiber = (element as unknown as Record<string, TestFiber | undefined>)[key];
  if (!fiber) throw new Error("React host fiber was not readable");
  return fiber.memoizedProps;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  localStorage.clear();
});

describe("Report Studio interactions", () => {
  it("drives display, compose, keyboard, evidence, edit-reset, and rail controls", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
    render(<ReportsPage />);

    expect(await screen.findByText("REFERENCE")).toBeTruthy();
    await waitFor(() => expect(getReportDraft).toHaveBeenCalledWith("context-1"));
    await waitFor(() => expect(
      screen.getByRole("button", { name: "Paper tone Cool" }).getAttribute("aria-pressed"),
    ).toBe("true"));

    fireEvent.click(screen.getByRole("button", { name: "Paper tone White" }));
    fireEvent.click(screen.getByRole("button", { name: "SOURCES" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom 115 percent" }));
    expect(screen.getAllByText(/ZOOM 115%/).length).toBeGreaterThan(0);

    const editModeButtons = screen.getAllByRole("button", { name: "Edit report" });
    fireEvent.click(editModeButtons[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Finish editing" })[1]);

    fireEvent.keyDown(window, { key: "-" });
    expect(screen.getAllByText(/ZOOM 100%/).length).toBeGreaterThan(0);
    fireEvent.keyDown(window, { key: "+" });
    expect(screen.getAllByText(/ZOOM 115%/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "FIT" }));
    expect(screen.getAllByText(/ZOOM 40%/).length).toBeGreaterThan(0);
    const reportButtons = screen.getAllByRole("button", { name: /^Select / });
    fireEvent.keyDown(window, { key: "2" });
    expect(reportButtons[1].getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Select model" }));

    fireEvent.click(screen.getByRole("button", { name: "EDIT DOCUMENT" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply document edit" }));
    expect(screen.getByRole("button", { name: "RESET 1 EDIT" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "RESET 1 EDIT" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "RESET 1 EDIT" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "RESET 1 EDIT" }));
    expect(screen.queryByRole("button", { name: "RESET 1 EDIT" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Toggle model section" }));
    expect(screen.getByText(/1 omitted/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "HIDE EBITDA ADD-BACKS" }));
    expect(screen.getByRole("button", { name: "SHOW EBITDA ADD-BACKS" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "OPEN CP-5 CONDITIONAL · QA-117" }));
    expect(await screen.findByRole("dialog", { name: "Evidence E-44" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close evidence" }));
    fireEvent.click(screen.getByRole("button", { name: "Open document evidence" }));
    expect(await screen.findByRole("dialog", { name: "Evidence E-44" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close evidence" }));
    fireEvent.click(screen.getByRole("button", { name: "Open lineage evidence" }));
    expect(await screen.findByRole("dialog", { name: "Evidence E-99" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close evidence" }));

    fireEvent.click(screen.getByRole("button", { name: "Collapse deliverables" }));
    fireEvent.click(screen.getByTitle("Expand Deliverables"));
    expect(screen.getByRole("navigation", { name: "Report list" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "COLLAPSE" }));
    fireEvent.click(screen.getByTitle("Expand Panels"));
    expect(screen.getByRole("button", { name: "Open lineage evidence" })).toBeTruthy();

    const editor = document.createElement("input");
    document.body.appendChild(editor);
    editor.focus();
    fireEvent.keyDown(editor, { key: "1" });
    expect(screen.getByRole("button", { name: "Select model" }).getAttribute("aria-pressed")).toBe("true");
    editor.remove();
  });

  it("surfaces saved-model failure and retries the reference inputs", async () => {
    vi.mocked(getSavedModel)
      .mockRejectedValueOnce(new Error("model offline"))
      .mockRejectedValueOnce(new Error("still offline"))
      .mockResolvedValueOnce(null);
    render(<ReportsPage />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    await waitFor(() => expect(getSavedModel).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Retry saved model" }));
    await waitFor(() => expect(getSavedModel).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("hydrates valid and malformed saved-model payloads and ignores late completion", async () => {
    vi.mocked(getSavedModel).mockResolvedValue({
      payload: { overrides: {}, assumptions: DEFAULT_ASSUMPTIONS },
    } as never);
    const valid = render(<ReportsPage />);
    await waitFor(() => expect(getSavedModel).toHaveBeenCalledOnce());
    valid.unmount();

    vi.mocked(getSavedModel).mockReset().mockResolvedValue({
      payload: { overrides: "invalid", assumptions: "invalid" },
    } as never);
    const malformed = render(<ReportsPage />);
    await waitFor(() => expect(getSavedModel).toHaveBeenCalledOnce());
    malformed.unmount();

    let finish!: (value: unknown) => void;
    vi.mocked(getSavedModel).mockReset().mockImplementation(() => new Promise((resolve) => { finish = resolve; }) as never);
    const lateSuccess = render(<ReportsPage />);
    await waitFor(() => expect(getSavedModel).toHaveBeenCalledOnce());
    lateSuccess.unmount();
    await act(async () => { finish({ payload: {} }); });

    let fail!: (reason: unknown) => void;
    vi.mocked(getSavedModel).mockReset().mockImplementation(() => new Promise((_, reject) => { fail = reject; }) as never);
    const lateFailure = render(<ReportsPage />);
    await waitFor(() => expect(getSavedModel).toHaveBeenCalledOnce());
    lateFailure.unmount();
    await act(async () => { fail(new Error("late failure")); });
  });

  it("drops a late server draft after unmount", async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(getReportDraft).mockImplementation(() => new Promise((resolve) => { finish = resolve; }) as never);
    const view = render(<ReportsPage />);
    await waitFor(() => expect(getReportDraft).toHaveBeenCalledOnce());
    view.unmount();
    await act(async () => { finish(null); });
  });

  it("reports the guard message when a binary download has no immutable version", async () => {
    render(<ReportsPage />);
    await screen.findByText("REFERENCE");
    const pdf = screen.getByRole("button", { name: "Download PDF" }) as HTMLButtonElement;
    expect(pdf.disabled).toBe(true);
    fireEvent.click(pdf);
    await act(async () => { await hostProps(pdf).onClick(); });
    expect(screen.getByText(/Publish an immutable committee version before downloading/)).toBeTruthy();
    expect(exportReportVersionBinary).not.toHaveBeenCalled();
  });

  it("autosaves a hydrated server draft and reports a later revision conflict", async () => {
    render(<ReportsPage />);
    await waitFor(() => expect(getReportDraft).toHaveBeenCalledWith("context-1"));
    await waitFor(() => expect(saveReportDraft).toHaveBeenCalled(), { timeout: 2_500 });
    expect(screen.getByText("Draft autosaved")).toBeTruthy();

    vi.mocked(saveReportDraft).mockRejectedValueOnce(new Error("revision conflict"));
    fireEvent.click(screen.getByRole("button", { name: "Paper tone White" }));
    await waitFor(() => expect(screen.getByText("Draft conflict — reload before publishing.")).toBeTruthy(), { timeout: 2_500 });
  });

  it("does not claim a newer edit is saved while an older autosave is still in flight", async () => {
    let finishFirst!: (draft: ReportDraftDTO) => void;
    let finishSecond!: (draft: ReportDraftDTO) => void;
    vi.mocked(saveReportDraft)
      .mockReset()
      .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { finishSecond = resolve; }));

    render(<ReportsPage />);
    await waitFor(() => expect(saveReportDraft).toHaveBeenCalledTimes(1), { timeout: 2_500 });

    fireEvent.click(screen.getByRole("button", { name: "Paper tone White" }));
    expect(await screen.findByText("Saving draft…")).toBeTruthy();

    await act(async () => {
      finishFirst({
        id: "draft-1", context_id: "context-1", revision: 5, payload: {},
        updated_at: "2026-07-14T00:00:01Z",
      });
    });
    expect(screen.queryByText("Draft autosaved")).toBeNull();

    await waitFor(() => expect(saveReportDraft).toHaveBeenCalledTimes(2), { timeout: 2_500 });
    expect(vi.mocked(saveReportDraft).mock.calls[1]?.[1]).toMatchObject({ paper: "#ffffff" });
    expect(vi.mocked(saveReportDraft).mock.calls[1]?.[2]).toBe(5);
    expect(screen.queryByText("Draft autosaved")).toBeNull();

    await act(async () => {
      finishSecond({
        id: "draft-1", context_id: "context-1", revision: 6, payload: {},
        updated_at: "2026-07-14T00:00:02Z",
      });
    });
    expect(await screen.findByText("Draft autosaved")).toBeTruthy();
  });

  it("autosaves a new server draft without a revision precondition", async () => {
    vi.mocked(getReportDraft).mockResolvedValue(null);
    render(<ReportsPage />);
    await waitFor(() => expect(saveReportDraft).toHaveBeenCalled(), { timeout: 2_500 });
    expect(vi.mocked(saveReportDraft).mock.calls.at(-1)?.[2]).toBeUndefined();
  });

  it("loads an empty immutable summary payload on demand and reports payload failure", async () => {
    controls.live = true;
    const summary: ReportVersionDTO = {
      id: "version-1", status: "published", context_id: "context-1", run_id: "run-1",
      model_checkpoint_id: "checkpoint-1", thesis_version_id: null,
      document_sha256: "a".repeat(64), authority: {}, created_at: "2026-07-14T00:00:00Z", payload: {},
    };
    const full: ReportVersionDTO = {
      ...summary,
      payload: { composition: { rendered_report: {
        id: "memo", title: "Loaded immutable memo", file: "memo", subtitle: "Loaded",
        icon: "document", srcs: [], sections: [{ t: "text", body: "Frozen body" }],
      } } },
    };
    const other: ReportVersionDTO = { ...full, id: "version-2", document_sha256: "b".repeat(64) };
    vi.mocked(listReportVersions).mockResolvedValue([summary, other]);
    vi.mocked(getReportDraft).mockResolvedValue(null);
    vi.mocked(getReportVersion).mockResolvedValue(full);
    const success = render(<ReportsPage />);
    await waitFor(() => expect(getReportVersion).toHaveBeenCalledWith("version-1"));
    await screen.findByText(/published version-/);
    success.unmount();

    vi.clearAllMocks();
    vi.mocked(listReportVersions).mockResolvedValue([summary]);
    vi.mocked(getReportDraft).mockResolvedValue(null);
    vi.mocked(getReportVersion).mockRejectedValue(new Error("payload unavailable"));
    render(<ReportsPage />);
    expect(await screen.findByText("The immutable report payload could not be loaded.")).toBeTruthy();
  });

  it("observes preview width, auto-fits, handles keyboard fit, and disconnects cleanly", async () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    const observe = vi.fn();
    const disconnect = vi.fn();
    let resizeCallback: ResizeObserverCallback | null = null;
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) { resizeCallback = callback; }
      observe = observe;
      unobserve = vi.fn();
      disconnect = disconnect;
    }
    globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue("");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined);
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(1200);
    const view = render(<ReportsPage />);
    await waitFor(() => expect(observe).toHaveBeenCalled());
    expect(screen.getAllByText(/ZOOM 77%/).length).toBeGreaterThan(0);
    fireEvent.keyDown(window, { key: "f" });
    act(() => { resizeCallback?.([], {} as ResizeObserver); });
    const staleFit = hostProps(screen.getByRole("button", { name: "FIT" })).onClick;
    view.unmount();
    act(() => { staleFit(); });
    expect(disconnect).toHaveBeenCalled();
    width.mockRestore();
    scroll.mockRestore();
    globalThis.ResizeObserver = originalResizeObserver;
  });

  it("survives unavailable browser storage preferences", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("storage blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage blocked"); });
    render(<ReportsPage />);
    expect(await screen.findByText("REFERENCE")).toBeTruthy();
  });

  it("patches a stale report context to the live run", async () => {
    controls.live = true;
    controls.reportParam = null;
    controls.contextRunId = "run-old";
    controls.surfaceReports = { active_id: "old", view: "edit" };
    render(<ReportsPage />);
    await waitFor(() => expect(controls.patch).toHaveBeenCalledWith(expect.objectContaining({
      artifacts: { issuer_run_id: "run-1" },
      surface_state: expect.objectContaining({ reports: expect.objectContaining({ active_id: "snapshot" }) }),
    })));
    const edit = screen.getAllByRole("button", { name: "Edit report" })[0];
    act(() => { hostProps(edit).onClick(); });
    await waitFor(() => expect(controls.patch).toHaveBeenCalledWith(expect.objectContaining({
      surface_state: expect.objectContaining({ reports: expect.objectContaining({ view: "edit" }) }),
    })));
  });

  it("preserves reference issuer scope while patching a live run", async () => {
    controls.live = true;
    controls.forceReference = true;
    controls.contextRunId = "run-old";
    controls.surfaceReports = null;
    render(<ReportsPage />);
    await waitFor(() => expect(controls.patch).toHaveBeenCalledWith(expect.objectContaining({
      issuer_ids: ["issuer-1"],
      artifacts: { issuer_run_id: "run-1" },
      surface_state: { reports: { active_id: "snapshot", view: "preview" } },
    })));
  });

  it("reports a non-Error preview failure and honors a missing-checkpoint publish guard", async () => {
    controls.live = true;
    controls.reportParam = null;
    controls.liveOuts = {
      "CP-1": { kpis: [], sections: [{ type: "text", title: "Credit view", body: "Live view" }] },
    };
    controls.liveStatus = { "CP-1": "Passed" };
    vi.mocked(getReportDraft).mockResolvedValue(null);
    vi.mocked(previewReportVersion).mockRejectedValue("blocked");
    const first = render(<ReportsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Review frozen preview" }));
    await waitFor(() => expect(previewReportVersion).toHaveBeenCalledOnce());
    expect(await screen.findByText("Publish blocked by readiness or version conflict.")).toBeTruthy();
    first.unmount();

    vi.clearAllMocks();
    vi.mocked(getReportDraft).mockResolvedValue(null);
    vi.mocked(previewReportVersion).mockRejectedValue(new Error("preview exploded"));
    const errorView = render(<ReportsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Review frozen preview" }));
    expect(await screen.findByText("preview exploded")).toBeTruthy();
    errorView.unmount();

    controls.checkpointId = null;
    render(<ReportsPage />);
    const guarded = await screen.findByRole("button", { name: "Review frozen preview" }) as HTMLButtonElement;
    expect(guarded.disabled).toBe(true);
    expect(guarded.title).toContain("Save an immutable Model checkpoint");
    await act(async () => { await hostProps(guarded).onClick(); });
    expect(previewReportVersion).toHaveBeenCalledOnce();
    expect(publishReportVersion).not.toHaveBeenCalled();
  });

  it("filters frozen-preview edits, blocks appendix mutation, and exposes non-ready publication copy", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    controls.live = true;
    controls.reportParam = null;
    controls.liveOuts = {
      "CP-1": { kpis: [], sections: [{ type: "text", title: "Credit view", body: "Live view" }] },
    };
    controls.liveStatus = { "CP-1": "Passed" };
    vi.mocked(getReportDraft).mockResolvedValue(null);
    const preview = {
      id: `preview-${"c".repeat(64)}`,
      status: "preview",
      context_id: "context-1",
      run_id: "run-1",
      model_checkpoint_id: "checkpoint-1",
      thesis_version_id: null,
      document_sha256: "c".repeat(64),
      preview_sha256: "c".repeat(64),
      authority: { approval_state: "preview", model_origin: "native", model_analyst_override: true },
      created_at: "2026-07-14T00:00:00Z",
      payload: { composition: { reviewed_report: {
        id: "live-committee-pack", title: "Frozen memo", file: "frozen", subtitle: "Frozen",
        icon: "document", srcs: [], sections: [{ t: "text", title: "Credit", body: "Frozen view" }],
      } } },
    } as never;
    vi.mocked(previewReportVersion).mockResolvedValue(preview);
    const first = render(<ReportsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Review frozen preview" }));
    await screen.findByRole("button", { name: "Publish reviewed preview" });
    fireEvent.click(screen.getByRole("button", { name: "EDIT DOCUMENT" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply document edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply second edit" }));
    expect(screen.getByRole("button", { name: "RESET 2 EDITS" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "RESET 2 EDITS" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("2 analyst edits"));
    fireEvent.click(screen.getByRole("button", { name: "Apply appendix edit" }));
    expect(screen.getByText(/Reviewed title/)).toBeTruthy();
    expect(screen.queryByText(/Blocked appendix edit/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Delete second edit" }));
    expect(screen.getByRole("button", { name: "RESET 1 EDIT" })).toBeTruthy();
    const toggle = screen.getByRole("button", { name: /Toggle .* section/ });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    first.unmount();

    controls.committeeStatus = null;
    render(<ReportsPage />);
    const publish = await screen.findByRole("button", { name: "Review frozen preview" }) as HTMLButtonElement;
    expect(publish.title).toContain("Run is not committee ready");
    const submit = screen.getByRole("button", { name: "Submit to IC" }) as HTMLButtonElement;
    expect(submit.title).toContain("Run is not committee ready");
  });

  it("handles a sectionless frozen preview and editorial intents missing optional maps", async () => {
    controls.live = true;
    controls.reportParam = null;
    controls.liveOuts = {
      "CP-1": { kpis: [], sections: [{ type: "text", title: "Credit view", body: "Live view" }] },
    };
    controls.liveStatus = { "CP-1": "Passed" };
    vi.mocked(getReportDraft).mockResolvedValue(null);
    const preview = {
      id: `preview-${"d".repeat(64)}`,
      status: "preview",
      context_id: "context-1",
      run_id: "run-1",
      model_checkpoint_id: "checkpoint-1",
      thesis_version_id: null,
      document_sha256: "d".repeat(64),
      preview_sha256: "d".repeat(64),
      authority: { approval_state: "preview", model_origin: "native", model_analyst_override: false },
      created_at: "2026-07-14T00:00:00Z",
      payload: { composition: { reviewed_report: {
        id: "live-committee-pack", title: "Sectionless memo", file: "sectionless", subtitle: "Frozen",
        icon: "document", srcs: [],
      } } },
    } as never;
    vi.mocked(previewReportVersion).mockImplementation(async (request) => {
      const payload = request.payload as Record<string, unknown>;
      delete payload.edits;
      delete payload.omit;
      return preview;
    });
    render(<ReportsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Review frozen preview" }));
    await screen.findByRole("button", { name: "Publish reviewed preview" });
    expect(screen.getByLabelText(/Document preview-/)).toBeTruthy();
  });

  it("opens an IC decision against the active draft when no report exists", async () => {
    controls.live = true;
    controls.reportParam = null;
    controls.liveOuts = {};
    controls.liveStatus = {};
    vi.mocked(getReportDraft).mockResolvedValue(null);
    render(<ReportsPage />);
    await screen.findByText("No issuer-specific report output");
    fireEvent.click(screen.getByRole("button", { name: "Open IC decision" }));
    const dialog = await screen.findByRole("dialog", { name: "Decision room" });
    expect(dialog.getAttribute("data-report-id")).toBe("snapshot");
  });

  it("prints, downloads immutable binaries, and opens both IC decision controls", async () => {
    controls.live = true;
    const version: ReportVersionDTO = {
      id: "version-1",
      status: "published",
      context_id: "context-1",
      run_id: "run-1",
      model_checkpoint_id: "checkpoint-1",
      thesis_version_id: null,
      document_sha256: "a".repeat(64),
      authority: { approval_state: "approved", model_origin: "native", model_analyst_override: false },
      created_at: "2026-07-14T00:00:00Z",
      payload: {
        composition: { reviewed_report: {
          id: "live-committee-pack", title: "Live IC Credit Memo", file: "issuer-1-memo",
          subtitle: "issuer-1 · run run-1", icon: "document", srcs: [],
          sections: [{ t: "text", title: "Credit view", body: "Published view" }],
        } },
      },
    };
    vi.mocked(listReportVersions).mockResolvedValue([version]);
    vi.mocked(getReportDraft).mockResolvedValue(null);
    const pdfBlob = new Blob(["pdf"], { type: "application/pdf" });
    vi.mocked(exportReportVersionBinary)
      .mockResolvedValueOnce({ blob: pdfBlob, filename: "committee.pdf" })
      .mockRejectedValueOnce("xlsx offline")
      .mockRejectedValueOnce(new Error("pdf retry offline"));
    const createObjectURL = vi.fn(() => "blob:committee");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);

    render(<ReportsPage />);
    expect(await screen.findByText(/published version-/)).toBeTruthy();
    await waitFor(() => expect(
      (screen.getByRole("button", { name: "Download PDF" }) as HTMLButtonElement).disabled,
    ).toBe(false));

    fireEvent.click(screen.getByRole("button", { name: "Print / save PDF" }));
    expect(print).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(await screen.findByText("Downloaded committee.pdf")).toBeTruthy();
    expect(createObjectURL).toHaveBeenCalledWith(pdfBlob);
    expect(anchorClick).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:committee");

    fireEvent.click(screen.getByRole("button", { name: "Download XLSX" }));
    expect(await screen.findByText("XLSX export failed.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(await screen.findByText("pdf retry offline")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open document evidence" }));
    expect(await screen.findByRole("dialog", { name: "Evidence E-44" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close evidence" }));

    fireEvent.click(screen.getByRole("button", { name: "Submit to IC" }));
    expect(await screen.findByRole("dialog", { name: "Decision room" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close decision" }));
    fireEvent.click(screen.getByRole("button", { name: "Open IC decision" }));
    expect(await screen.findByRole("dialog", { name: "Decision room" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close decision" }));
  });
});
