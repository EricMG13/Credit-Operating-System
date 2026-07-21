// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AlertEventDTO } from "@/lib/api";
import MonitorPage from "./page";

const getAlertEventPage = vi.fn();
const getWatchRulePage = vi.fn();
const getPortfolio = vi.fn();
const getDigest = vi.fn();
const patchAlertEvent = vi.fn();
const forbiddenAutonomyDraft = vi.fn();
const forbiddenLegacyStates = vi.fn();
const analysisState = vi.hoisted(() => ({
  context: null as null | { id: string; artifacts: Record<string, string>; surface_state: Record<string, Record<string, string>> },
  patch: vi.fn(() => Promise.resolve()),
  listInsights: vi.fn(),
  createInsight: vi.fn(),
}));
const roleState = vi.hoisted(() => ({ role: "analyst" as "analyst" | "pm" | "qa" }));
const modeState = vi.hoisted(() => ({ mode: "live" as "live" | "reference" }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/monitor",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/shared/RoleViewProvider", () => ({
  useRoleView: () => ({ roleView: roleState.role, setRoleView: vi.fn(), ready: true }),
}));
vi.mock("@/lib/data-mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data-mode")>()),
  useDataMode: () => modeState.mode,
}));
vi.mock("@/lib/analysis-workbench", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analysis-workbench")>()),
  analysisApi: {
    listInsights: (...args: unknown[]) => analysisState.listInsights(...args),
    createInsight: (...args: unknown[]) => analysisState.createInsight(...args),
  },
  useAnalysisContext: () => ({
    context: analysisState.context,
    setContext: vi.fn(),
    patch: analysisState.patch,
    loading: false,
    error: null,
    mutationState: "idle",
    mutationError: null,
    retryLastPatch: vi.fn(),
  }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getAlertEventPage: (...args: unknown[]) => getAlertEventPage(...args),
  getWatchRulePage: (...args: unknown[]) => getWatchRulePage(...args),
  getPortfolio: (...args: unknown[]) => getPortfolio(...args),
  getDigest: (...args: unknown[]) => getDigest(...args),
  patchAlertEvent: (...args: unknown[]) => patchAlertEvent(...args),
  getAutonomyDraft: (...args: unknown[]) => forbiddenAutonomyDraft(...args),
  getAlertStates: (...args: unknown[]) => forbiddenLegacyStates(...args),
}));

function persistedEvent(overrides: Partial<AlertEventDTO> = {}): AlertEventDTO {
  return {
    id: "alert-1",
    alert_key: "c3:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    issuer_id: "issuer-17",
    run_id: "run-17",
    kind: "covenant",
    title: "Covenant headroom moved below 1.5x",
    impact: "Liquidity and waiver options require review.",
    evidence: { observed_at: "2026-07-20T10:00:00Z", chunk_ids: ["chunk-17"] },
    authority: { watch_rule_id: "rule-1", rule_version: 2 },
    state: "open",
    assignee: null,
    note: null,
    resolved_at: null,
    resolution_note: null,
    created_at: "2026-07-20T10:01:00Z",
    updated_at: "2026-07-20T10:01:00Z",
    ...overrides,
  };
}

const EMPTY_PORTFOLIO = { rows: [], issuer_count: 0, covered_count: 0 };
const EMPTY_DIGEST = {
  as_of: null,
  coverage: { issuers: 0 },
  stale_threshold_days: 30,
  stale: [],
  warf: null,
  warf_band: null,
  ccc_watch: [],
  qa: {},
  activity_24h: {},
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  getAlertEventPage.mockReset();
  getWatchRulePage.mockReset();
  getPortfolio.mockReset();
  getDigest.mockReset();
  patchAlertEvent.mockReset();
  forbiddenAutonomyDraft.mockReset();
  forbiddenLegacyStates.mockReset();
  analysisState.patch.mockReset().mockResolvedValue(undefined);
  analysisState.listInsights.mockReset().mockResolvedValue({ items: [], current: null, next_cursor: null });
  analysisState.createInsight.mockReset();
  getAlertEventPage.mockResolvedValue({ items: [], nextCursor: null });
  getWatchRulePage.mockResolvedValue({ items: [], nextCursor: null });
  getPortfolio.mockResolvedValue(EMPTY_PORTFOLIO);
  getDigest.mockResolvedValue(EMPTY_DIGEST);
  analysisState.context = null;
  roleState.role = "analyst";
  modeState.mode = "live";
  window.history.replaceState({}, "", "/monitor");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Monitor · persisted decision and governance authority", () => {
  it("uses one persisted event for the worklist, toolbar, decision header, and workflow-state context", async () => {
    const acknowledged = persistedEvent({
      id: "alert-2",
      alert_key: "c3:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      title: "QA finding acknowledged",
      kind: "qa_change",
      state: "ack",
      created_at: "2026-07-20T09:01:00Z",
    });
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent(), acknowledged], nextCursor: null });

    render(<MonitorPage />);

    expect(await screen.findByTestId("monitor-persisted-ready")).toBeTruthy();
    expect(screen.getAllByText("2 persisted alerts")).toHaveLength(2);
    expect(screen.getAllByText("Covenant headroom moved below 1.5x").length).toBeGreaterThanOrEqual(1);
    const decision = screen.getByLabelText("Decision header");
    expect(decision.textContent).toContain("Covenant headroom moved below 1.5x");
    expect(decision.textContent).toContain("Liquidity and waiver options require review.");
    expect(decision.textContent).toContain("2 persisted alert events · 1 open");
    expect(screen.getByText("Persisted alerts by workflow state")).toBeTruthy();
    expect(screen.getByText("1 open").closest("[data-tone]")?.getAttribute("data-tone")).toBe("idle");
    fireEvent.click(screen.getByRole("button", { name: "Show equivalent table" }));
    expect(screen.getByRole("table", { name: "Alert workflow state counts" }).textContent).toContain("ack1");
    expect(getAlertEventPage).toHaveBeenCalledOnce();
    expect(getWatchRulePage).toHaveBeenCalledOnce();
    expect(forbiddenAutonomyDraft).not.toHaveBeenCalled();
    expect(forbiddenLegacyStates).not.toHaveBeenCalled();
  });

  it("keeps loading/error, settled-empty, and missing-timestamp decision states distinct", async () => {
    getAlertEventPage.mockRejectedValueOnce(new Error("persisted read offline"));
    const unavailable = render(<MonitorPage />);
    const errorHeader = await screen.findByLabelText("Decision header");
    await waitFor(() => expect(errorHeader.textContent).toContain("persisted read offline"));
    expect(errorHeader.textContent).not.toContain("No persisted alert events observed");
    const unavailableAction = screen.getByRole("button", { name: "Acknowledge selected" });
    expect(unavailableAction.getAttribute("aria-disabled")).toBe("true");
    expect(unavailableAction.getAttribute("title")).toBe("Persisted alert list is unavailable; reload before acknowledging.");
    unavailable.unmount();

    getAlertEventPage.mockResolvedValueOnce({ items: [], nextCursor: null });
    const empty = render(<MonitorPage />);
    const emptyHeader = await screen.findByLabelText("Decision header");
    await waitFor(() => expect(emptyHeader.textContent).toContain("No persisted alert events observed"));
    expect(await screen.findByText("No persisted alerts observed")).toBeTruthy();
    empty.unmount();

    getAlertEventPage.mockResolvedValueOnce({
      items: [persistedEvent({ evidence: {}, created_at: "not-a-date" })],
      nextCursor: null,
    });
    render(<MonitorPage />);
    const partialHeader = await screen.findByLabelText("Decision header");
    await waitFor(() => expect(partialHeader.textContent).toContain("Persisted events lack a valid observation or event timestamp"));
    expect(document.body.textContent).not.toContain("Observed Invalid Date");
  });

  it("disables the primary acknowledgment action while its captured batch is pending", async () => {
    const patch = deferred<AlertEventDTO>();
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent()], nextCursor: null });
    patchAlertEvent.mockReturnValueOnce(patch.promise);
    render(<MonitorPage />);
    await screen.findByTestId("monitor-persisted-ready");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Covenant headroom moved below 1.5x" }));
    const action = screen.getByRole("button", { name: "Acknowledge selected (1)" });
    expect(action.getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(action);
    await waitFor(() => expect(screen.getByRole("button", { name: "Acknowledge selected (1)" }).getAttribute("title"))
      .toBe("Batch acknowledgment is already in progress."));

    patch.resolve(persistedEvent({ state: "ack" }));
    await patch.promise;
    await waitFor(() => expect(screen.getByRole("button", { name: "Acknowledge selected" })).toBeTruthy());
  });

  it("keeps active selection, URL state, analysis context, and cited insight on the same persisted event", async () => {
    analysisState.context = { id: "ctx-monitor", artifacts: {}, surface_state: {} };
    const second = persistedEvent({
      id: "alert-2",
      alert_key: "c3:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      title: "Second persisted alert",
    });
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent(), second], nextCursor: null });
    analysisState.createInsight.mockResolvedValue({
      id: "insight-1",
      context_id: "ctx-monitor",
      surface: "monitor",
      kind: "alert-brief",
      status: "ready",
      subject_refs: { alert_event_id: "alert-2" },
      summary: "Cited alert brief is ready.",
      claims: [],
      recommended_actions: [],
      missing_dependencies: [],
      authority: {},
      source_fingerprint: "fp-1",
      version: 1,
      model: "test",
      generated_at: "2026-07-20T10:05:00Z",
      ratified_at: null,
      rejected_at: null,
      lease_owner: null,
      lease_expires_at: null,
    });
    window.history.replaceState({}, "", "/monitor?selected=alert-2");

    render(<MonitorPage />);
    await screen.findByTestId("monitor-persisted-ready");
    await waitFor(() => expect(analysisState.patch).toHaveBeenCalledWith(expect.objectContaining({
      artifacts: expect.objectContaining({ alert_event_id: "alert-2" }),
      surface_state: expect.objectContaining({ monitor: expect.objectContaining({ active_id: "alert-2" }) }),
    })));

    fireEvent.click(screen.getByRole("button", { name: "Generate cited brief" }));
    await waitFor(() => expect(analysisState.createInsight).toHaveBeenCalledWith(
      "ctx-monitor",
      expect.objectContaining({ subject_refs: { alert_event_id: "alert-2" } }),
    ));
    expect(await screen.findByText("Cited alert brief is ready.")).toBeTruthy();

    window.history.replaceState({}, "", "/monitor?selected=alert-1");
    fireEvent(window, new PopStateEvent("popstate"));
    await waitFor(() => expect(analysisState.patch).toHaveBeenLastCalledWith(expect.objectContaining({
      artifacts: expect.objectContaining({ alert_event_id: "alert-1" }),
    })));
    expect(window.location.search).toContain("selected=alert-1");
  });

  it("normalizes a requested event hidden by the current filter to the visible active event", async () => {
    analysisState.context = { id: "ctx-monitor-filter", artifacts: {}, surface_state: {} };
    const acknowledged = persistedEvent({
      id: "alert-ack",
      alert_key: "c3:1212121212121212121212121212121212121212121212121212121212121212",
      title: "Hidden acknowledged alert",
      state: "ack",
    });
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent(), acknowledged], nextCursor: null });
    render(<MonitorPage />);
    await screen.findByTestId("monitor-persisted-ready");
    fireEvent.click(screen.getByRole("button", { name: "Show open alerts" }));

    window.history.replaceState({}, "", "/monitor?selected=alert-ack");
    fireEvent(window, new PopStateEvent("popstate"));
    await waitFor(() => expect(window.location.search).toContain("selected=alert-1"));
    expect(window.location.search).not.toContain("alert-ack");
    await waitFor(() => expect(analysisState.patch).toHaveBeenLastCalledWith(expect.objectContaining({
      artifacts: expect.objectContaining({ alert_event_id: "alert-1" }),
      surface_state: expect.objectContaining({ monitor: expect.objectContaining({ active_id: "alert-1" }) }),
    })));
    expect(screen.queryByText("Hidden acknowledged alert")).toBeNull();
  });

  it("discloses a mixed timestamp set without asserting unmeasured freshness", async () => {
    getAlertEventPage.mockResolvedValue({
      items: [
        persistedEvent(),
        persistedEvent({
          id: "alert-without-time",
          alert_key: "c3:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          title: "Persisted event without an observation time",
          evidence: {},
          created_at: "invalid",
        }),
      ],
      nextCursor: null,
    });

    render(<MonitorPage />);
    const header = await screen.findByLabelText("Decision header");
    await waitFor(() => expect(header.textContent).toContain("1 missing observation/event timestamp"));
    expect(header.textContent).not.toContain("CURRENT");
  });

  it("retains the QA governance hierarchy while alert authority stays persisted", async () => {
    roleState.role = "qa";
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent()], nextCursor: null });
    getPortfolio.mockResolvedValue({
      rows: [{
        issuer_id: "i1",
        name: "Quantum Labs",
        ticker: "QLMH",
        sector: "Tech",
        run_id: "abcdef1234567890",
        qa_status: "Blocked",
        committee_status: "Blocked",
        as_of: "2026-06-30",
        metrics: {},
        rv_recommendation: null,
        rv_percentile: null,
        downside_fragility: null,
        gaps: [],
      }],
      issuer_count: 1,
      covered_count: 1,
    });
    getDigest.mockResolvedValue({ ...EMPTY_DIGEST, coverage: { issuers: 1 }, stale: [{ issuer_id: "i2", name: "Never Run Co", detail: "never run" }] });

    render(<MonitorPage />);
    expect(await screen.findByText("Live governance queue · CP-5 / CP-0 / Staleness")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Governance" }).getAttribute("aria-selected")).toBe("true");
    const workbench = screen.getByTestId("persona-workbench");
    expect(Array.from(workbench.querySelectorAll<HTMLElement>("[data-slot]")).map((slot) => slot.dataset.slot))
      .toEqual(["inspector", "decision", "primary"]);
    expect(screen.getByRole("columnheader", { name: "Gate or exception" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Evidence health" })).toBeTruthy();
    expect(await screen.findByText("Never Run Co")).toBeTruthy();
  });

  it("rejects unsupported URL state without leaking it into the live worklist", async () => {
    window.history.replaceState({}, "", "/monitor?dataset=javascript%3Aalert(1)&severity=urgent&selected=%3Cscript%3E");
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent()], nextCursor: null });

    render(<MonitorPage />);
    expect((await screen.findByRole("tab", { name: "Alerts" })).getAttribute("aria-selected")).toBe("true");
    expect(document.body.textContent).not.toContain("javascript:alert(1)");
    expect(document.body.textContent).not.toContain("<script>");
    expect(window.location.search).toContain("selected=alert-1");
  });

  it("keeps Reference replay read-only and mounts zero live alert, rule, governance, or autonomy reads", async () => {
    modeState.mode = "reference";
    analysisState.context = { id: "ctx-reference", artifacts: {}, surface_state: {} };

    render(<MonitorPage />);

    expect(await screen.findByRole("button", { name: /Seeded replay · CP-MON-H demo tape/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Email intake" })).toBeTruthy();
    expect(screen.queryByLabelText("Decision header")).toBeNull();
    expect(screen.queryByTestId("monitor-persisted-ready")).toBeNull();
    expect(getAlertEventPage).not.toHaveBeenCalled();
    expect(getWatchRulePage).not.toHaveBeenCalled();
    expect(getPortfolio).not.toHaveBeenCalled();
    expect(getDigest).not.toHaveBeenCalled();
    expect(forbiddenAutonomyDraft).not.toHaveBeenCalled();
    expect(forbiddenLegacyStates).not.toHaveBeenCalled();
    expect(analysisState.listInsights).not.toHaveBeenCalled();
    expect(analysisState.createInsight).not.toHaveBeenCalled();
  });
});
