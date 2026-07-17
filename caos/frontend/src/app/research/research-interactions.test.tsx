// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

type ResearchResultMock = {
  report: string;
  sources: Array<{ title: string }>;
  demo: boolean;
  truncated: boolean;
};

type ResearchContextMock = {
  id: string;
  issuer_ids: string[];
  artifacts: Record<string, unknown>;
  surface_state: Record<string, unknown>;
};

type ResearchPrefsMock = {
  mode: string;
  audience: string;
  decision: string;
  timeframe: string;
  criteria: string;
  ai_mode: string;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const state = vi.hoisted(() => ({
  userId: "analyst-research",
  settings: { llm_configured: true } as Record<string, unknown>,
  settingsError: null as Error | null,
  context: null as ResearchContextMock | null,
  patch: vi.fn(),
  finding: vi.fn(),
  notify: vi.fn(),
  deepPromise: null as Promise<ResearchResultMock> | null,
  deepCalls: [] as unknown[][],
  progress: null as ((value: unknown) => void) | null,
  lastSignal: null as AbortSignal | null,
  status: null as { state: string; result?: ResearchResultMock } | null,
  statusError: null as Error | null,
  resumePromise: null as Promise<ResearchResultMock> | null,
  prefs: {
    mode: "sector",
    audience: "Credit IC",
    decision: "Position sizing",
    timeframe: "Last 12 months",
    criteria: "Leverage\nLiquidity",
    ai_mode: "standard",
  } as ResearchPrefsMock,
}));

vi.mock("@/components/shared/RequireAuth", () => ({ RequireAuth: ({ children }: { children?: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/AuthProvider", () => ({ useAuth: () => ({ user: state.userId ? { id: state.userId } : null }) }));
vi.mock("@/components/shared/EnterprisePage", () => ({
  EnterprisePage: ({ identity, primaryAction, contextualControls, children }: { identity?: React.ReactNode; primaryAction?: React.ReactNode; contextualControls?: React.ReactNode; children?: React.ReactNode }) => <main>{identity}<div data-testid="header-action">{primaryAction}</div><div data-testid="contextual">{contextualControls}</div>{children}</main>,
}));
vi.mock("@/components/shared/PersonaWorkbench", () => ({ PersonaWorkbench: ({ context, primary }: { context?: React.ReactNode; primary: React.ReactNode }) => <div>{context}{primary}</div> }));
vi.mock("@/components/shared/ShellIdentity", () => ({ ShellIdentity: ({ title }: { title: React.ReactNode }) => <h1>{title}</h1> }));
vi.mock("@/components/shared/Panel", () => ({ Panel: ({ title, children }: { title: string; children?: React.ReactNode }) => <section aria-label={title}>{children}</section> }));
vi.mock("@/components/shared/Notifications", () => ({ useNotify: () => (...args: unknown[]) => state.notify(...args) }));
vi.mock("@/components/shared/ActionReason", () => ({
  ActionReason: ({ reason, onClick, children, className }: { reason?: string | null; onClick?: () => void; children?: React.ReactNode; className?: string }) => <button aria-disabled={reason ? "true" : undefined} title={reason ?? undefined} className={className} onClick={onClick}>{children}</button>,
}));
vi.mock("@/components/shared/ScopeToggle", () => ({
  ScopeToggle: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <div role="group" aria-label="Research scope"><button aria-pressed={value === "sector"} onClick={() => onChange("sector")}>Sector</button><button aria-pressed={value === "issuer"} onClick={() => onChange("issuer")}>Issuer</button></div>,
}));
vi.mock("@/components/shared/AiModeToggle", () => ({ AiModeToggle: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <button onClick={() => onChange(value === "standard" ? "max" : "standard")}>AI mode {value}</button> }));
vi.mock("@/components/shared/TextInput", () => ({
  INPUT_BASE: "input-base",
  TextInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
vi.mock("@/components/research/ReportPane", () => ({
  ReportPane: ({ running, error, result, prevResult, progress, elapsed, subj, mode, onDetach, onRestorePrev }: { running: boolean; error?: string | null; result?: ResearchResultMock | null; prevResult?: ResearchResultMock | null; progress?: { phase?: string } | null; elapsed: number; subj: string; mode: string; onDetach: () => void; onRestorePrev: () => void }) => (
    <section aria-label="report pane">
      <div>pane running {String(running)} elapsed {elapsed} subject {subj} mode {mode}</div>
      <div>result {result?.report ?? "none"}</div>
      <div>previous {prevResult?.report ?? "none"}</div>
      <div>progress {progress?.phase ?? "none"}</div>
      <div>error {error ?? "none"}</div>
      {running ? <button onClick={onDetach}>Detach</button> : null}
      {prevResult ? <button onClick={onRestorePrev}>Restore previous</button> : null}
    </section>
  ),
}));
vi.mock("@/lib/research-prefs", () => ({
  DEFAULT_CRITERIA: "Leverage\nLiquidity",
  loadPrefs: () => state.prefs,
}));
vi.mock("@/lib/analysis-workbench", () => ({
  useAnalysisContext: () => ({ context: state.context, patch: (...args: unknown[]) => state.patch(...args) }),
  contextHref: (path: string, id: string, params?: Record<string, string>) => `${path}?context=${id}${params ? `&${new URLSearchParams(params)}` : ""}`,
  analysisApi: { createFinding: (...args: unknown[]) => state.finding(...args) },
}));
vi.mock("@/lib/api", () => ({
  getSettings: () => state.settingsError ? Promise.reject(state.settingsError) : Promise.resolve(state.settings),
  getResearchStatus: () => state.statusError ? Promise.reject(state.statusError) : Promise.resolve(state.status),
  resumeResearch: (_id: string, onProgress: (value: unknown) => void, signal: AbortSignal) => {
    state.progress = onProgress;
    state.lastSignal = signal;
    return state.resumePromise!;
  },
  deepResearch: (...args: unknown[]) => {
    state.deepCalls.push(args);
    state.progress = args[1] as (value: unknown) => void;
    (args[2] as (id: string) => void)("job-new");
    state.lastSignal = args[3] as AbortSignal;
    return state.deepPromise!;
  },
  isResearchAborted: (error: unknown) => error instanceof Error && error.message === "aborted",
  isResearchGone: (error: unknown) => error instanceof Error && error.message === "gone",
  toErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));

import ResearchPage from "./page";

function context(overrides: Record<string, unknown> = {}) {
  return {
    id: "research-context",
    issuer_ids: ["issuer-1"],
    artifacts: {},
    surface_state: {},
    ...overrides,
  };
}

function result(report: string) {
  return { report, sources: [{ title: "Source" }], demo: false, truncated: false };
}

beforeEach(() => {
  state.userId = "analyst-research";
  state.settings = { llm_configured: true };
  state.settingsError = null;
  state.context = context();
  state.patch.mockReset().mockResolvedValue(null);
  state.finding.mockReset().mockResolvedValue({ id: "finding-1" });
  state.notify.mockReset();
  state.deepPromise = null;
  state.deepCalls = [];
  state.progress = null;
  state.lastSignal = null;
  state.status = null;
  state.statusError = null;
  state.resumePromise = null;
  state.prefs = {
    mode: "sector", audience: "Credit IC", decision: "Position sizing",
    timeframe: "Last 12 months", criteria: "Leverage\nLiquidity", ai_mode: "standard",
  };
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("Deep Research durable job interactions", () => {
  it("runs a fully framed live brief, records progress, links context, and exposes destination exits", async () => {
    // research-01 research-02 research-03 research-04 research-05 research-06
    // research-08 research-09 research-10 research-28 research-29
    // Assertion-level contract: scope, focal subject, advanced framing/boundaries,
    // criteria normalization, valid AI mode, submission, durable id, progress,
    // context linkage, and progressive disclosure all participate in one run.
    vi.useFakeTimers();
    const job = deferred<ResearchResultMock>();
    state.deepPromise = job.promise;
    localStorage.setItem("caos.research.adv", "1");
    render(<ResearchPage />);

    await act(async () => { await Promise.resolve(); });
    const brief = screen.getByRole("region", { name: "Research brief" });
    const subject = within(brief).getByPlaceholderText(/enterprise software/i);
    fireEvent.change(subject, { target: { value: "Enterprise software" } });
    expect(within(brief).getByRole("button", { name: "Advanced brief" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.change(within(brief).getByPlaceholderText(/geographies/i), { target: { value: "Europe" } });
    fireEvent.change(within(brief).getByPlaceholderText(/topics to avoid/i), { target: { value: "Equities" } });
    fireEvent.change(within(brief).getByLabelText("Investigation criteria — one per line"), { target: { value: "Leverage\n\nLiquidity\nCovenants" } });
    fireEvent.click(within(brief).getByRole("button", { name: "AI mode standard" }));
    fireEvent.click(within(brief).getByRole("button", { name: "Run deep research" }));

    expect(sessionStorage.getItem("caos.research.job.analyst-research.research-context")).toBe("job-new");
    expect(screen.getByText(/pane running true/)).toBeTruthy();
    act(() => { state.progress?.({ phase: "searching" }); vi.advanceTimersByTime(2000); });
    expect(screen.getByText(/progress searching/)).toBeTruthy();
    expect(screen.getByText(/elapsed 2/)).toBeTruthy();

    await act(async () => { job.resolve(result("Committee-ready software report")); await job.promise; });
    expect(screen.getByText("result Committee-ready software report")).toBeTruthy();
    expect(state.patch).toHaveBeenCalledWith(expect.objectContaining({ artifacts: expect.objectContaining({ research_job_id: "job-new" }) }));
    expect(state.finding).toHaveBeenCalledWith(expect.objectContaining({ source_surface: "research", source_run_id: "job-new" }));
    expect(state.notify).toHaveBeenCalledWith("Research complete", "Sector · Enterprise software");
    expect(within(screen.getByTestId("contextual")).getByRole("link", { name: "Open Deep-Dive" }).getAttribute("href")).toContain("issuer=issuer-1");
    expect(within(screen.getByTestId("contextual")).getByRole("link", { name: "Open Report Studio" })).toBeTruthy();

    const call = state.deepCalls[0];
    expect(call[0]).toEqual(expect.objectContaining({ subject: "Enterprise software", mode: "sector", ai_mode: "max", focus: "Europe", exclusions: "Equities", criteria: ["Leverage", "Liquidity", "Covenants"] }));
  });

  it("retains and restores a prior report after a failed rerun", async () => {
    // research-12: a failed replacement preserves and restores the last good report.
    const first = deferred<ResearchResultMock>();
    state.deepPromise = first.promise;
    render(<ResearchPage />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Run deep research" })).toHaveLength(2));
    fireEvent.change(screen.getByPlaceholderText(/enterprise software/i), { target: { value: "Chemicals" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Run deep research" })[0]);
    await act(async () => { first.resolve(result("Original chemicals report")); await first.promise; });

    const rerun = deferred<ResearchResultMock>();
    state.deepPromise = rerun.promise;
    fireEvent.click(screen.getAllByRole("button", { name: "Run deep research" })[1]);
    expect(screen.getByText("previous Original chemicals report")).toBeTruthy();
    await act(async () => { rerun.reject(new Error("research backend failed")); try { await rerun.promise; } catch {} });
    expect(screen.getByText("error research backend failed")).toBeTruthy();
    expect(state.notify).toHaveBeenCalledWith("Research failed", "research backend failed");
    fireEvent.click(screen.getByRole("button", { name: "Restore previous" }));
    expect(screen.getByText("result Original chemicals report")).toBeTruthy();
    expect(screen.getByText("error none")).toBeTruthy();
  });

  it("detaches an active run and quietly handles aborted and gone terminals", async () => {
    // research-10 research-12: detach is non-terminal; authoritative gone clears
    // the durable pointer without surfacing a false research failure.
    const job = deferred<ResearchResultMock>();
    state.deepPromise = job.promise;
    render(<ResearchPage />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Run deep research" })).toHaveLength(2));
    fireEvent.change(screen.getByPlaceholderText(/enterprise software/i), { target: { value: "Media" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Run deep research" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Detach" }));
    expect(state.lastSignal?.aborted).toBe(true);
    expect(state.notify).toHaveBeenCalledWith("Detached", expect.stringContaining("continues in the background"));
    await act(async () => { job.reject(new Error("aborted")); try { await job.promise; } catch {} });
    expect(screen.getByText("error none")).toBeTruthy();

    cleanup();
    const gone = deferred<ResearchResultMock>();
    state.deepPromise = gone.promise;
    render(<ResearchPage />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Run deep research" })).toHaveLength(2));
    fireEvent.change(screen.getByPlaceholderText(/enterprise software/i), { target: { value: "Retail" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Run deep research" })[0]);
    await act(async () => { gone.reject(new Error("gone")); try { await gone.promise; } catch {} });
    expect(sessionStorage.getItem("caos.research.job.analyst-research.research-context")).toBeNull();
    expect(screen.getByText("error none")).toBeTruthy();
  });

  it("restores context state, demo configuration, advanced persistence, and a completed durable job", async () => {
    // research-01 research-07 research-10 research-17 research-29
    // Restored scope/query, honest demo provenance, completed-job hydration, and
    // persisted disclosure state are asserted together at the page boundary.
    state.settings = { llm_configured: false };
    state.context = context({ surface_state: { research: { query: "Saved issuer", view: "issuer" } } });
    state.prefs = { ...state.prefs, mode: "issuer" };
    state.status = { state: "complete", result: result("Recovered durable report") };
    sessionStorage.setItem("caos.research.job.analyst-research", "legacy-job");
    render(<ResearchPage />);

    expect(await screen.findByText("Recovered durable report", { exact: false })).toBeTruthy();
    expect(screen.getByText("Demo mode")).toBeTruthy();
    expect((screen.getByPlaceholderText(/Atlas Forge/i) as HTMLInputElement).value).toBe("Saved issuer");
    const advanced = screen.getByRole("button", { name: "Advanced brief" });
    fireEvent.click(advanced);
    expect(localStorage.getItem("caos.research.adv")).toBe("1");
    fireEvent.click(advanced);
    expect(localStorage.getItem("caos.research.adv")).toBe("0");
  });

  it("resumes a running durable job and reports a context-link save failure without losing the report", async () => {
    // research-10 research-12 research-28: running reattachment forwards real
    // progress and degrades a context-link write failure without losing output.
    const resumed = deferred<ResearchResultMock>();
    state.status = { state: "running" };
    state.resumePromise = resumed.promise;
    state.patch.mockRejectedValueOnce(new Error("context offline"));
    sessionStorage.setItem("caos.research.job.analyst-research.research-context", "job-resume");
    render(<ResearchPage />);

    expect(await screen.findByText(/pane running true/)).toBeTruthy();
    act(() => state.progress?.({ phase: "synthesizing" }));
    expect(screen.getByText("progress synthesizing")).toBeTruthy();
    await act(async () => { resumed.resolve(result("Resumed report")); await resumed.promise; });
    expect(screen.getByText("result Resumed report")).toBeTruthy();
    expect(state.notify).toHaveBeenCalledWith("Research saved", expect.stringContaining("context link needs retry"));
    expect(state.notify).toHaveBeenCalledWith("Research complete", "Sector research");
  });
});
