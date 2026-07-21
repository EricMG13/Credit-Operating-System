// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AlertEventDTO } from "@/lib/api";
import MonitorPage from "./page";

let mockBreakpoint: "wide" | "desktop" | "tablet" | "mobile" = "wide";
const getAlertEventPage = vi.fn();
const getWatchRulePage = vi.fn();
const getSettings = vi.fn().mockResolvedValue({ features: { alert_rules_v1_enabled: true } });
const getPortfolio = vi.fn();
const getDigest = vi.fn();
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
  getAlertEventPage: (...args: unknown[]) => getAlertEventPage(...args),
  getWatchRulePage: (...args: unknown[]) => getWatchRulePage(...args),
  getPortfolio: (...args: unknown[]) => getPortfolio(...args),
  getDigest: (...args: unknown[]) => getDigest(...args),
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

beforeEach(() => {
  getSettings.mockReset().mockResolvedValue({ features: { alert_rules_v1_enabled: true } });
  getAlertEventPage.mockReset();
  getWatchRulePage.mockReset();
  getPortfolio.mockReset();
  getDigest.mockReset();
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
});
