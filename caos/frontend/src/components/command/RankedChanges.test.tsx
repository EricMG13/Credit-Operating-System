// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent, waitFor } from "@testing-library/react";
import { RankedChanges } from "./RankedChanges";

const getAutonomyDraft = vi.fn();
const getAlertStates = vi.fn();
const setAlertState = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getAutonomyDraft: (...a: unknown[]) => getAutonomyDraft(...a),
    getAlertStates: (...a: unknown[]) => getAlertStates(...a),
    setAlertState: (...a: unknown[]) => setAlertState(...a),
  };
});

afterEach(cleanup);

const EMPTY_DRAFT = {
  status: "draft", ai_generated: true, ratified: false, export_allowed: false,
  marking: "AI-GENERATED, UNRATIFIED", sections: [],
  summary: { n_sections: 0, n_claims: 0, n_deterministic_bullets: 0, n_anomalies: 0 },
  refreshing: false,
};

describe("RankedChanges", () => {
  it("shows an honest OFFLINE state when the endpoint is unreachable — never a fabricated list", async () => {
    getAutonomyDraft.mockRejectedValue(new Error("network error"));
    render(<RankedChanges />);
    await waitFor(() => expect(screen.getByText("Watchtower unreachable")).toBeTruthy());
    expect(screen.getByText("DEMO")).toBeTruthy();
  });

  it("shows 'cycle running' while refreshing with no sections yet — distinct from a settled empty draft", async () => {
    getAutonomyDraft.mockResolvedValue({ ...EMPTY_DRAFT, refreshing: true });
    render(<RankedChanges />);
    await waitFor(() => expect(screen.getByText("cycle running — no changes yet")).toBeTruthy());
  });

  it("settled empty draft reads 'no ranked changes' as LIVE, not DEMO", async () => {
    getAutonomyDraft.mockResolvedValue(EMPTY_DRAFT);
    render(<RankedChanges />);
    await waitFor(() => expect(screen.getByText("no ranked changes to report")).toBeTruthy());
    expect(screen.getByText("LIVE")).toBeTruthy();
  });

  it("renders ranked rows with the disclosed severity-only basis chip, and Ack posts the alert state", async () => {
    getAutonomyDraft.mockResolvedValue({
      ...EMPTY_DRAFT,
      generated_at: "2026-07-12T09:00:00Z",
      sections: [
        {
          issuer_id: "ATLF",
          issuer_name: "Atlas Forge",
          max_severity: 0.9,
          claims: [
            {
              text: "EBITDA margin compressed sharply vs peers",
              claim_type: "anomaly",
              anomaly_kind: "peer-outlier",
              anomaly_severity: 0.9,
              chunk_ids: [],
              fact_ids: [],
              model: "claude-opus-4-8",
            },
          ],
          deterministic_bullets: [],
          exhibit: [],
        },
      ],
    });
    getAlertStates.mockResolvedValue([]);
    setAlertState.mockResolvedValue({
      id: "1", alert_key: "2026-07-12T09:00:00Z:ATLF:peer-outlier:claim", state: "ack",
      assignee: null, note: null, analyst_id: "a1", created_at: "2026-07-12T09:05:00Z",
    });

    render(<RankedChanges />);
    await waitFor(() => expect(screen.getByText("EBITDA margin compressed sharply vs peers")).toBeTruthy());
    expect(screen.getByText("Ranked by severity — holdings not loaded")).toBeTruthy();
    expect(screen.getByText("compare to peers")).toBeTruthy();
    expect(screen.getByText("unassigned")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ack" }));
    });
    await waitFor(() => expect(setAlertState).toHaveBeenCalledWith("2026-07-12T09:00:00Z:ATLF:peer-outlier:claim", "ack"));
    await waitFor(() => expect(screen.getByText("Acked")).toBeTruthy());
  });
});
