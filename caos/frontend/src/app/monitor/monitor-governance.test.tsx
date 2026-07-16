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

vi.mock("next/navigation", () => ({
  usePathname: () => "/monitor",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
});

describe("Monitor · DecisionHeader + Governance (G4/G5)", () => {
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
    expect(screen.getByText("Governance queue · CP-5 / CP-0 / Staleness")).toBeTruthy();
    expect(screen.getByText("QA Queue · CP-5 open findings")).toBeTruthy();
    expect(screen.getByText("Failed Gates · committee gate")).toBeTruthy();
    expect(screen.getByText("Mixed Origin · reference + live run")).toBeTruthy();
    expect(screen.getByText("Overdue Refresh · never run")).toBeTruthy();
    expect(screen.getByText("Never Run Co")).toBeTruthy();
  });
});
