// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent, waitFor } from "@testing-library/react";
import { RankedChanges, RankedChangesView } from "./RankedChanges";

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
  it("shows an honest OFFLINE state when the endpoint is unreachable — never a fabricated list, and never mislabels a real outage as DEMO content", async () => {
    getAutonomyDraft.mockRejectedValue(new Error("network error"));
    render(<RankedChanges />);
    await waitFor(() => expect(screen.getByText("Autonomy engine unreachable")).toBeTruthy());
    expect(screen.queryByText(/^DEMO$/)).toBeNull();
  });

  it("shows 'cycle running' while refreshing with no sections yet — distinct from a settled empty draft", async () => {
    getAutonomyDraft.mockResolvedValue({ ...EMPTY_DRAFT, refreshing: true });
    render(<RankedChanges />);
    await waitFor(() => expect(screen.getByText("cycle running — no changes yet")).toBeTruthy());
  });

  it("settled empty draft reads 'no ranked changes' as a genuine empty check, not DEMO or an outage", async () => {
    getAutonomyDraft.mockResolvedValue(EMPTY_DRAFT);
    const { container } = render(<RankedChanges />);
    await waitFor(() => expect(screen.getByText("no ranked changes to report")).toBeTruthy());
    expect(container.querySelector('[data-surface-state="empty"]')).toBeTruthy();
    expect(screen.queryByText(/^DEMO$/)).toBeNull();
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
    expect(screen.getByText("0.9σ")).toBeTruthy(); // quantified impact, not just the reason string

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ack" }));
    });
    await waitFor(() => expect(setAlertState).toHaveBeenCalledWith("2026-07-12T09:00:00Z:ATLF:peer-outlier:claim", "ack"));
    await waitFor(() => expect(screen.getByText("Acked")).toBeTruthy());
  });

  it("a row resolved on Monitor reads 'Resolved' here too and its Ack action is disabled — the two surfaces never disagree", async () => {
    getAutonomyDraft.mockResolvedValue({
      ...EMPTY_DRAFT,
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
    });
    getAlertStates.mockResolvedValue([{
      id: "1", alert_key: "2026-07-12T09:00:00Z:ATLF:peer-outlier:claim", state: "resolved",
      assignee: null, note: null, analyst_id: "a1", created_at: "2026-07-12T09:05:00Z",
      resolved_at: "2026-07-12T09:10:00Z", resolution_note: null,
    }]);

    render(<RankedChanges />);
    const resolveBtn = await screen.findByRole("button", { name: "Resolved" });
    expect((resolveBtn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("resolved")).toBeTruthy(); // owner slot, not "unassigned"
  });

  it("omits the impact chip and falls back to the issuer name when an alert has no issuer id", async () => {
    getAlertStates.mockResolvedValue([]);
    render(<RankedChangesView state={{
      draft: {
        ...EMPTY_DRAFT,
        generated_at: "2026-07-17T00:00:00Z",
        sections: [{
          issuer_id: null,
          issuer_name: "Name Only Co",
          max_severity: null,
          claims: [],
          deterministic_bullets: [{
            kind: "unquantified-change", severity: Number.NaN, metric: null,
            direction: null, chunk_id: null, context: {},
          }],
          exhibit: [],
        }],
      },
      loading: false,
      offline: false,
    } as never} />);

    expect(await screen.findByText("unquantified-change")).toBeTruthy();
    expect(screen.queryByText(/σ$/)).toBeNull();
    expect(screen.getByTitle("Open Name Only Co in Deep-Dive").getAttribute("href"))
      .toContain("Name%20Only%20Co");
  });

  it("ignores a late alert-state enrichment after unmount", async () => {
    let resolve!: (value: never[]) => void;
    getAlertStates.mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = render(<RankedChangesView state={{
      draft: {
        ...EMPTY_DRAFT,
        generated_at: "late",
        sections: [{
          issuer_id: "ATLF", issuer_name: "Atlas Forge", max_severity: 1,
          claims: [], deterministic_bullets: [{
            kind: "late-state", severity: 1, metric: null,
            direction: null, chunk_id: null, context: {},
          }], exhibit: [],
        }],
      }, loading: false, offline: false,
    } as never} />);
    await waitFor(() => expect(getAlertStates).toHaveBeenCalled());
    view.unmount();
    await act(async () => resolve([]));
  });
});
