// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AlertEventDTO } from "@/lib/api";
import MonitorPage from "./page";

let mockBreakpoint: "wide" | "desktop" | "tablet" | "mobile" = "wide";
const getAlertEventPage = vi.fn();
const getWatchRulePage = vi.fn();
const getSettings = vi.fn().mockResolvedValue({ features: { alert_rules_v1_enabled: true } });
const getPortfolio = vi.fn();
const getDigest = vi.fn();
const patchAlertEvent = vi.fn();
const forbiddenAutonomyDraft = vi.fn();
const forbiddenLegacyStates = vi.fn();
const analysisState = vi.hoisted(() => ({ loading: false, patch: vi.fn() }));
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
  useRoleView: () => ({ roleView: "analyst", setRoleView: vi.fn(), ready: true }),
}));
vi.mock("@/lib/useBreakpoint", () => ({
  useBreakpoint: () => ({ breakpoint: mockBreakpoint, hydrated: true }),
}));
vi.mock("@/lib/data-mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data-mode")>()),
  useDataMode: () => modeState.mode,
}));
vi.mock("@/lib/analysis-workbench", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analysis-workbench")>()),
  useAnalysisContext: () => ({
    context: null,
    setContext: vi.fn(),
    patch: analysisState.patch,
    loading: analysisState.loading,
    error: null,
    mutationState: "idle",
    mutationError: null,
    retryLastPatch: vi.fn(),
  }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSettings: (...args: unknown[]) => getSettings(...args),
  getAlertEventPage: async (...args: unknown[]) => ({ canMutate: true, ...await getAlertEventPage(...args) }),
  getWatchRulePage: (...args: unknown[]) => getWatchRulePage(...args),
  getPortfolio: (...args: unknown[]) => getPortfolio(...args),
  getDigest: (...args: unknown[]) => getDigest(...args),
  patchAlertEvent: (...args: unknown[]) => patchAlertEvent(...args),
  getAutonomyDraft: (...args: unknown[]) => forbiddenAutonomyDraft(...args),
  getAlertStates: (...args: unknown[]) => forbiddenLegacyStates(...args),
}));

function persistedEvent(): AlertEventDTO {
  return {
    id: "phone-alert-1",
    alert_key: "c3:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    issuer_id: "issuer-phone",
    run_id: "run-phone",
    kind: "qa_change",
    title: "Phone and desktop share this persisted event",
    impact: "Review the governed QA evidence.",
    evidence: { observed_at: "2026-07-20T12:00:00Z" },
    authority: { watch_rule_id: "rule-phone", rule_version: 1 },
    state: "open",
    assignee: null,
    note: null,
    resolved_at: null,
    resolution_note: null,
    created_at: "2026-07-20T12:01:00Z",
    updated_at: "2026-07-20T12:01:00Z",
  };
}

function setNarrowMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches,
    media: "(max-width: 1099px)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  getSettings.mockReset().mockResolvedValue({ features: { alert_rules_v1_enabled: true } });
  getAlertEventPage.mockReset();
  getWatchRulePage.mockReset();
  getPortfolio.mockReset();
  getDigest.mockReset();
  patchAlertEvent.mockReset();
  forbiddenAutonomyDraft.mockReset();
  forbiddenLegacyStates.mockReset();
  analysisState.patch.mockReset().mockResolvedValue(undefined);
  getAlertEventPage.mockResolvedValue({ items: [], nextCursor: null });
  getWatchRulePage.mockResolvedValue({ items: [], nextCursor: null });
  getPortfolio.mockResolvedValue({ rows: [], issuer_count: 0, covered_count: 0 });
  getDigest.mockResolvedValue({ as_of: null, coverage: { issuers: 0 }, stale_threshold_days: 30, stale: [], warf: null, warf_band: null, ccc_watch: [], qa: {}, activity_24h: {} });
  mockBreakpoint = "wide";
  analysisState.loading = false;
  modeState.mode = "live";
  window.history.replaceState({}, "", "/monitor");
  setNarrowMedia(false);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Monitor · phone persisted triage gate", () => {
  it("renders the same persisted event in the phone title, card, toolbar, decision, and context drawer", async () => {
    mockBreakpoint = "mobile";
    setNarrowMedia(true);
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent()], nextCursor: null });

    render(<MonitorPage />);

    expect(await screen.findByTestId("monitor-persisted-ready")).toBeTruthy();
    expect(screen.getByText("Alert triage · persisted events")).toBeTruthy();
    expect(screen.getAllByText("Phone and desktop share this persisted event")).toHaveLength(2);
    expect(screen.getByText("1 persisted alert")).toBeTruthy();
    expect(screen.getByLabelText("Decision header").textContent).toContain("Phone and desktop share this persisted event");
    expect(screen.queryByRole("button", { name: /Acknowledge selected/ })).toBeNull();
    expect(screen.queryByText("Email Intelligence · CP-MON intake")).toBeNull();
    expect(screen.getByRole("button", { name: "Open context drawer" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open context drawer" }));
    expect(await screen.findByText("Persisted alerts by workflow state")).toBeTruthy();
    expect(getAlertEventPage).toHaveBeenCalledOnce();
    expect(getSettings).toHaveBeenCalledOnce();
    expect(getWatchRulePage).toHaveBeenCalledOnce();
    expect(forbiddenAutonomyDraft).not.toHaveBeenCalled();
    expect(forbiddenLegacyStates).not.toHaveBeenCalled();
  });

  it("clears desktop batch selection before the phone triage surface can hide it", async () => {
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent()], nextCursor: null });
    const view = render(<MonitorPage />);
    const checkbox = await screen.findByRole("checkbox", { name: "Select Phone and desktop share this persisted event" });
    fireEvent.click(checkbox);
    expect(screen.getByRole("button", { name: "Acknowledge selected (1)" })).toBeTruthy();

    mockBreakpoint = "mobile";
    setNarrowMedia(true);
    view.rerender(<MonitorPage />);

    expect(await screen.findByText("Alert triage · persisted events")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Acknowledge selected/ })).toBeNull();
    expect(patchAlertEvent).not.toHaveBeenCalled();

    mockBreakpoint = "wide";
    setNarrowMedia(false);
    view.rerender(<MonitorPage />);
    await waitFor(() => expect((screen.getByRole("checkbox", { name: "Select Phone and desktop share this persisted event" }) as HTMLInputElement).checked).toBe(false));
  });

  it("clears and hides batch authority when the visible dataset moves to Governance", async () => {
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent()], nextCursor: null });
    render(<MonitorPage />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Select Phone and desktop share this persisted event" }));
    expect(screen.getByRole("button", { name: "Acknowledge selected (1)" })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Governance" }));

    expect(await screen.findByText("Live governance queue · CP-5 / CP-0 / Staleness")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Acknowledge selected/ })).toBeNull();
    expect(patchAlertEvent).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: "Alerts" }));
    await waitFor(() => expect((screen.getByRole("checkbox", { name: "Select Phone and desktop share this persisted event" }) as HTMLInputElement).checked).toBe(false));
  });

  it("renders a viewer alert collection without row, phone, or header mutation authority", async () => {
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent()], nextCursor: null, canMutate: false });
    render(<MonitorPage />);
    await screen.findAllByText("Phone and desktop share this persisted event");

    expect(screen.queryByRole("checkbox", { name: "Select Phone and desktop share this persisted event" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Acknowledge selected/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Ack" }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Ack" }));
    expect(patchAlertEvent).not.toHaveBeenCalled();
  });

  it("renders an honest persisted-event outage on phone without fabricating Reference or autonomy content", async () => {
    mockBreakpoint = "mobile";
    setNarrowMedia(true);
    getAlertEventPage.mockRejectedValueOnce(new Error("persisted event service offline"));

    render(<MonitorPage />);

    expect(await screen.findByText("Persisted alert events unavailable")).toBeTruthy();
    expect(screen.getAllByText("persisted event service offline").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/Seeded replay/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/autonomy/i);
  });

  it("keeps Reference desktop tabs inert until context bootstrap settles and never mounts phone authority", () => {
    modeState.mode = "reference";
    mockBreakpoint = "desktop";
    analysisState.loading = true;
    const { rerender } = render(<MonitorPage />);

    const email = screen.getByRole("tab", { name: "Email intake" });
    expect(email.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(email);
    expect(screen.getByRole("tab", { name: "Replay" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByTestId("monitor-persisted-ready")).toBeNull();
    expect(getSettings).not.toHaveBeenCalled();
    expect(getAlertEventPage).not.toHaveBeenCalled();
    expect(getWatchRulePage).not.toHaveBeenCalled();

    analysisState.loading = false;
    rerender(<MonitorPage />);
    expect(screen.getByRole("tab", { name: "Email intake" }).getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Email intake" }));
    expect(screen.getByText("Email Intelligence · CP-MON intake")).toBeTruthy();
  });

  it("keeps the phone inbox and decision header on historical events when rule activation is default-off", async () => {
    getSettings.mockReset().mockResolvedValue({ features: { alert_rules_v1_enabled: false } });
    mockBreakpoint = "mobile";
    setNarrowMedia(true);
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent()], nextCursor: null });

    render(<MonitorPage />);

    expect(await screen.findByTestId("monitor-persisted-ready")).toBeTruthy();
    expect(screen.getByText("Alert triage · persisted events")).toBeTruthy();
    expect(screen.getAllByText("Phone and desktop share this persisted event")).toHaveLength(2);
    expect(screen.getByLabelText("Decision header").textContent).toContain("Phone and desktop share this persisted event");
    expect(getAlertEventPage).toHaveBeenCalledOnce();
    expect(getSettings).toHaveBeenCalledOnce();
    expect(getWatchRulePage).not.toHaveBeenCalled();
  });

  it("keeps deferred failure custody mounted across dataset and breakpoint changes until dismissal", async () => {
    const patch = deferred<AlertEventDTO>();
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent()], nextCursor: null });
    patchAlertEvent.mockReturnValueOnce(patch.promise);
    const view = render(<MonitorPage />);
    await screen.findByTestId("monitor-persisted-ready");

    fireEvent.change(screen.getByLabelText("Alert assignee"), { target: { value: "Desk analyst" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenCalledOnce());

    const governance = screen.getByRole("tab", { name: "Governance" });
    expect(governance.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(governance);
    expect(screen.getByRole("tab", { name: "Alerts" }).getAttribute("aria-selected")).toBe("true");

    mockBreakpoint = "mobile";
    setNarrowMedia(true);
    view.rerender(<MonitorPage />);
    expect(screen.getByText("Alert inbox · persisted events")).toBeTruthy();
    expect(screen.queryByText("Alert triage · persisted events")).toBeNull();

    await act(async () => {
      patch.reject(new Error("deferred assignment unavailable"));
      await patch.promise.catch(() => undefined);
    });
    expect(await screen.findByText(/deferred assignment unavailable/)).toBeTruthy();
    expect(screen.getByText("Alert inbox · persisted events")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(await screen.findByText("Alert triage · persisted events")).toBeTruthy();
    expect(screen.queryByText(/deferred assignment unavailable/)).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Governance" }));
    expect(await screen.findByText("Live governance queue · CP-5 / CP-0 / Staleness")).toBeTruthy();
  });

  it("retains the alert dataset when URL navigation changes during deferred failure custody", async () => {
    const patch = deferred<AlertEventDTO>();
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent()], nextCursor: null });
    patchAlertEvent.mockReturnValueOnce(patch.promise);
    const view = render(<MonitorPage />);
    await screen.findByTestId("monitor-persisted-ready");

    fireEvent.change(screen.getByLabelText("Alert assignee"), { target: { value: "Desk analyst" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenCalledOnce());

    window.history.replaceState({}, "", "/monitor?dataset=governance");
    view.rerender(<MonitorPage />);
    expect(screen.getByRole("tab", { name: "Alerts" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Alert inbox · persisted events")).toBeTruthy();
    expect(screen.queryByText("Live governance queue · CP-5 / CP-0 / Staleness")).toBeNull();

    await act(async () => {
      patch.reject(new Error("URL-raced assignment unavailable"));
      await patch.promise.catch(() => undefined);
    });
    expect(await screen.findByText(/URL-raced assignment unavailable/)).toBeTruthy();
    expect(screen.getByText("Alert inbox · persisted events")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(await screen.findByText("Live governance queue · CP-5 / CP-0 / Staleness")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Governance" }).getAttribute("aria-selected")).toBe("true");
  });
});
