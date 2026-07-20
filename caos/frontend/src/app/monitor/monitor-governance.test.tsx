// @vitest-environment jsdom
// G4/G5: Monitor now carries the shared DecisionHeader (four-cell decision
// strip, populated from the live autonomy draft) and the shared Governance
// queue (identical categories to Command's, off the same live portfolio/
// digest sources) — locks both against a live and an offline fixture so
// neither promotes seeded/demo content into a decision claim.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MonitorPage from "./page";

const getAutonomyDraft = vi.fn();
const getAlertStates = vi.fn();
const getPortfolio = vi.fn();
const getDigest = vi.fn();
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
  useSearchParams: () => new URLSearchParams(),
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
  getAutonomyDraft: (...a: unknown[]) => getAutonomyDraft(...a),
  getAlertStates: (...a: unknown[]) => getAlertStates(...a),
  getPortfolio: (...a: unknown[]) => getPortfolio(...a),
  getDigest: (...a: unknown[]) => getDigest(...a),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  analysisState.context = null;
  roleState.role = "analyst";
  modeState.mode = "live";
  window.history.replaceState({}, "", "/monitor");
});

describe("Monitor · DecisionHeader + Governance (G4/G5)", () => {
  it("opens Monitor QA on the governance dataset with the control plane hierarchy first", async () => {
    roleState.role = "qa";
    getAutonomyDraft.mockRejectedValue(new Error("network error"));
    getAlertStates.mockRejectedValue(new Error("network error"));
    getPortfolio.mockRejectedValue(new Error("network error"));
    getDigest.mockRejectedValue(new Error("network error"));

    render(<MonitorPage />);

    expect(await screen.findByText("Live governance queue · CP-5 / CP-0 / Staleness")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Governance" }).getAttribute("aria-selected")).toBe("true");
    const workbench = screen.getByTestId("persona-workbench");
    const slots = Array.from(workbench.querySelectorAll<HTMLElement>("[data-slot]"));
    expect(slots.map((slot) => slot.dataset.slot)).toEqual(["inspector", "decision", "primary"]);
    expect(slots[0].getAttribute("data-emphasized")).toBe("true");
    expect(screen.getByText("Source intake health")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Gate or exception" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Owner" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Freshness" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Evidence health" })).toBeTruthy();
  });

  it("renders decision-safe empty states and an offline Governance queue when every backend is unreachable", async () => {
    getAutonomyDraft.mockRejectedValue(new Error("network error"));
    getAlertStates.mockRejectedValue(new Error("network error"));
    getPortfolio.mockRejectedValue(new Error("network error"));
    getDigest.mockRejectedValue(new Error("network error"));

    render(<MonitorPage />);

    // Decision context is visible on arrival for the primary analyst persona.
    const header = await screen.findByLabelText("Decision header");
    expect(header.textContent).toContain("Autonomy endpoint unavailable");
    expect(header.textContent).not.toContain("No material change");
    expect(header.textContent).not.toContain("No action required");
    expect(screen.getByText("Governance summary")).toBeTruthy();

    expect(screen.queryByRole("tab", { name: "Email intake" })).toBeNull();
    expect(screen.queryByText("Email Intelligence · CP-MON intake")).toBeNull();
    expect(screen.queryByText("Showing 8 of 105 today · sample")).toBeNull();
    expect(screen.queryByText(/Seeded replay · CP-MON-H demo tape/)).toBeNull();
  });

  it("populates the decision header from a live autonomy draft and shows the shared governance categories", async () => {
    getAutonomyDraft.mockResolvedValue({
      status: "draft", ai_generated: true, ratified: false, export_allowed: false,
      marking: "AI-GENERATED, UNRATIFIED",
      generated_at: "2026-07-12T09:00:00Z",
      sections: [
        {
          issuer_id: "ATLF", issuer_name: "Atlas Forge", max_severity: 0.9,
          claims: [{
            text: "EBITDA margin compressed sharply vs peers", claim_type: "anomaly",
            anomaly_kind: "peer-outlier", anomaly_severity: 0.9, chunk_ids: [], fact_ids: [],
            model: "claude-opus-4-8",
          }],
          deterministic_bullets: [], exhibit: [],
        },
      ],
      summary: { n_sections: 1, n_claims: 1, n_deterministic_bullets: 0, n_anomalies: 1 },
      refreshing: false,
    });
    getAlertStates.mockResolvedValue([]);
    getPortfolio.mockResolvedValue({
      rows: [
        {
          issuer_id: "i1", name: "Quantum Labs", ticker: "QLMH", sector: "Tech",
          run_id: "abcdef1234567890", qa_status: "Blocked", committee_status: "Blocked",
          as_of: "2026-06-30", metrics: {}, rv_recommendation: null, rv_percentile: null,
          downside_fragility: null, gaps: [],
        },
      ],
      issuer_count: 1, covered_count: 1,
    });
    getDigest.mockResolvedValue({
      as_of: "2026-07-12T09:00:00Z",
      coverage: { issuers: 1 }, stale_threshold_days: 30,
      stale: [{ issuer_id: "i2", name: "Never Run Co", detail: "never run" }],
      warf: null, warf_band: null, ccc_watch: [], qa: {}, activity_24h: {},
    });

    render(<MonitorPage />);

    const header = screen.getByLabelText("Decision header");
    await waitFor(() => expect(header.textContent).toContain("EBITDA margin compressed sharply vs peers"));
    expect(header.textContent).toContain("compare to peers");

    fireEvent.click(screen.getByRole("tab", { name: "Governance" }));
    expect(screen.getByText("Live governance queue · CP-5 / CP-0 / Staleness")).toBeTruthy();
    expect(await screen.findByText("QA Queue · CP-5 open findings")).toBeTruthy();
    expect(screen.getByText("Failed Gates · committee gate")).toBeTruthy();
    expect(screen.getByText("Mixed Origin · reference + live run")).toBeTruthy();
    expect(screen.getByText("Overdue Refresh · never run")).toBeTruthy();
    expect(screen.getByText("Never Run Co")).toBeTruthy();
  });

  it("tracks the selected alert and generates a cited brief for the active analysis context", async () => {
    analysisState.context = { id: "ctx-monitor", artifacts: {}, surface_state: {} };
    analysisState.listInsights.mockResolvedValue({ items: [], current: null, next_cursor: null });
    analysisState.createInsight.mockResolvedValue({
      id: "insight-1",
      context_id: "ctx-monitor",
      surface: "monitor",
      kind: "alert-brief",
      status: "ready",
      subject_refs: { alert_event_id: "alert-9" },
      summary: "Cited alert brief is ready.",
      claims: [],
      recommended_actions: [],
      missing_dependencies: [],
      authority: {},
      source_fingerprint: "fp-1",
      version: 1,
      model: "test",
      generated_at: "2026-07-12T09:00:00Z",
      ratified_at: null,
      rejected_at: null,
      lease_owner: null,
      lease_expires_at: null,
    });
    getAutonomyDraft.mockRejectedValue(new Error("network error"));
    getAlertStates.mockRejectedValue(new Error("network error"));
    getPortfolio.mockRejectedValue(new Error("network error"));
    getDigest.mockRejectedValue(new Error("network error"));

    render(<MonitorPage />);
    await screen.findByRole("button", { name: "Generate cited brief" });

    fireEvent(window, new CustomEvent("caos:monitor-selection", {
      detail: { count: 2, eventId: "alert-9" },
    }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Acknowledge selected (2)" })).toBeTruthy());
    expect(analysisState.patch).toHaveBeenCalledWith(expect.objectContaining({
      artifacts: expect.objectContaining({ alert_event_id: "alert-9" }),
    }));

    const acknowledged = vi.fn();
    window.addEventListener("caos:monitor-ack-selected", acknowledged, { once: true });
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge selected (2)" }));
    expect(acknowledged).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Open Monitor shortcuts" }));
    expect((await screen.findByRole("link", { name: "Open Command" })).getAttribute("href")).toContain("ctx-monitor");

    fireEvent.click(screen.getByRole("button", { name: "Open governance queue" }));
    expect(screen.getByText("Live governance queue · CP-5 / CP-0 / Staleness")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Generate cited brief" }));
    await waitFor(() => expect(analysisState.createInsight).toHaveBeenCalledWith(
      "ctx-monitor",
      expect.objectContaining({ subject_refs: { alert_event_id: "alert-9" } }),
    ));
    expect(await screen.findByText("Cited alert brief is ready.")).toBeTruthy();
  });

  it("marks a successful draft without generated_at as timestamp-partial", async () => {
    getAutonomyDraft.mockResolvedValue({
      status: "draft", ai_generated: true, ratified: false, export_allowed: false,
      marking: "AI-GENERATED, UNRATIFIED", generated_at: null, sections: [],
      summary: { n_sections: 0, n_claims: 0, n_deterministic_bullets: 0, n_anomalies: 0 },
      refreshing: false,
    });
    getAlertStates.mockResolvedValue([]);
    getPortfolio.mockResolvedValue({ rows: [], issuer_count: 0, covered_count: 0 });
    getDigest.mockResolvedValue({
      as_of: null, coverage: { issuers: 0 }, stale_threshold_days: 30, stale: [],
      warf: null, warf_band: null, ccc_watch: [], qa: {}, activity_24h: {},
    });

    render(<MonitorPage />);
    const header = await screen.findByLabelText("Decision header");
    await waitFor(() => expect(header.textContent).toContain("Draft answered without an observation timestamp"));
  });

  it("monitor-01 monitor-02 monitor-03 monitor-04 monitor-05 monitor-06 monitor-07 invalid input rejects unsupported URL state without leaking it into the worklist", async () => {
    window.history.replaceState({}, "", "/monitor?dataset=javascript%3Aalert(1)&severity=urgent&selected=%3Cscript%3E");
    getAutonomyDraft.mockRejectedValue(new Error("network error"));
    getAlertStates.mockRejectedValue(new Error("network error"));
    getPortfolio.mockRejectedValue(new Error("network error"));
    getDigest.mockRejectedValue(new Error("network error"));

    render(<MonitorPage />);

    expect((await screen.findByRole("tab", { name: "Alerts" })).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("button", { name: /Replay criticals/ })).toBeNull();
    expect(document.body.textContent).not.toContain("javascript:alert(1)");
    expect(document.body.textContent).not.toContain("<script>");
  });

  it("keeps an empty live worklist concise and excludes every seeded reference surface", async () => {
    getAutonomyDraft.mockResolvedValue({
      status: "draft", ai_generated: true, ratified: false, export_allowed: false,
      marking: "AI-GENERATED, UNRATIFIED", generated_at: "2026-07-12T09:00:00Z", sections: [],
      summary: { n_sections: 0, n_claims: 0, n_deterministic_bullets: 0, n_anomalies: 0 }, refreshing: false,
    });
    getAlertStates.mockResolvedValue([]);
    getPortfolio.mockResolvedValue({ rows: [], issuer_count: 0, covered_count: 0 });
    getDigest.mockResolvedValue({ as_of: null, coverage: { issuers: 0 }, stale_threshold_days: 30, stale: [], warf: null, warf_band: null, ccc_watch: [], qa: {}, activity_24h: {} });

    render(<MonitorPage />);

    expect(await screen.findAllByText("No live alerts routed")).toHaveLength(1);
    expect(screen.queryByText("Routed alerts by severity")).toBeNull();
    expect(screen.queryByRole("button", { name: /equivalent table/i })).toBeNull();
    expect(screen.queryByRole("table", { name: "Alert severity counts" })).toBeNull();
    expect(screen.queryByText(/Replay state/)).toBeNull();
    expect(screen.queryByText(/Seeded replay/)).toBeNull();
    expect(screen.queryByRole("tab", { name: "Email intake" })).toBeNull();
  });

  it("mounts replay and seeded email intelligence only in explicit Reference mode", async () => {
    modeState.mode = "reference";
    analysisState.context = { id: "ctx-reference", artifacts: {}, surface_state: {} };
    analysisState.listInsights.mockResolvedValue({ items: [], current: null, next_cursor: null });
    getAutonomyDraft.mockResolvedValue({
      status: "draft", ai_generated: true, ratified: false, export_allowed: false,
      marking: "AI-GENERATED, UNRATIFIED", generated_at: "2026-07-18T12:34:56Z",
      sections: [{
        issuer_id: "live-leak", issuer_name: "LEAKED LIVE ISSUER", max_severity: 0.9,
        claims: [{ text: "LEAKED LIVE CLAIM", claim_type: "anomaly", anomaly_kind: "peer-outlier", anomaly_severity: 0.9, chunk_ids: [], fact_ids: [], model: "test" }],
        deterministic_bullets: [], exhibit: [],
      }],
      summary: { n_sections: 1, n_claims: 1, n_deterministic_bullets: 0, n_anomalies: 1 },
      refreshing: false,
    });
    getAlertStates.mockResolvedValue([]);
    getPortfolio.mockResolvedValue({ rows: [], issuer_count: 0, covered_count: 0 });
    getDigest.mockResolvedValue({ as_of: "2026-07-18T12:34:56Z", coverage: { issuers: 0 }, stale_threshold_days: 30, stale: [], warf: null, warf_band: null, ccc_watch: [], qa: {}, activity_24h: {} });

    render(<MonitorPage />);

    expect(await screen.findByRole("button", { name: /Seeded replay · CP-MON-H demo tape/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Email intake" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Governance" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Email intake" }));
    expect(screen.getByText("Email Intelligence · CP-MON intake")).toBeTruthy();
    expect(screen.getByText("Showing 8 of 105 today · sample")).toBeTruthy();
    expect(screen.queryByLabelText("Decision header")).toBeNull();
    expect(document.body.textContent).not.toContain("LEAKED LIVE ISSUER");
    expect(document.body.textContent).not.toContain("LEAKED LIVE CLAIM");
    expect(getAutonomyDraft).not.toHaveBeenCalled();
    expect(getAlertStates).not.toHaveBeenCalled();
    expect(getPortfolio).not.toHaveBeenCalled();
    expect(getDigest).not.toHaveBeenCalled();
    expect(analysisState.listInsights).not.toHaveBeenCalled();
    expect(analysisState.createInsight).not.toHaveBeenCalled();
  });
});
