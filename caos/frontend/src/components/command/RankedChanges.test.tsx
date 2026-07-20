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

  it("keeps an unchanged alert actionable and gives row-level retry feedback when acknowledgement cannot be saved", async () => {
    getAutonomyDraft.mockResolvedValue({
      ...EMPTY_DRAFT,
      generated_at: "2026-07-12T09:00:00Z",
      sections: [{
        issuer_id: "ATLF", issuer_name: "Atlas Forge", max_severity: 0.9,
        claims: [{ text: "Ack write failure", claim_type: "anomaly", anomaly_kind: "peer-outlier", anomaly_severity: 0.9, chunk_ids: [], fact_ids: [], model: "claude-opus-4-8" }],
        deterministic_bullets: [], exhibit: [],
      }],
    });
    getAlertStates.mockResolvedValue([]);
    setAlertState.mockRejectedValue(new Error("alert service unavailable"));

    render(<RankedChanges />);
    const ack = await screen.findByRole("button", { name: "Ack" });
    fireEvent.click(ack);
    expect((await screen.findByRole("alert")).textContent).toContain("alert service unavailable");
    expect(screen.getByRole("button", { name: "Ack" })).toBeTruthy();
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
    expect(resolveBtn.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("resolved")).toBeTruthy(); // owner slot, not "unassigned"
  });

  it("omits the impact chip and blocks Deep-Dive when an alert has no issuer id", async () => {
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
    expect(screen.queryByTitle("Open Name Only Co in Deep-Dive")).toBeNull();
    expect(screen.getByText("Issuer authority unavailable")).toBeTruthy();
  });

  it("honors a persona summary limit while disclosing that additional live rows remain", async () => {
    getAlertStates.mockResolvedValue([]);
    const sections = Array.from({ length: 6 }, (_, index) => ({
      issuer_id: `ISS${index + 1}`,
      issuer_name: `Issuer ${index + 1}`,
      max_severity: 1 - index / 10,
      claims: [{
        text: `Change ${index + 1}`,
        claim_type: "anomaly",
        anomaly_kind: "peer-outlier",
        anomaly_severity: 1 - index / 10,
        chunk_ids: [],
        fact_ids: [],
        model: "claude-opus-4-8",
      }],
      deterministic_bullets: [],
      exhibit: [],
    }));

    render(<RankedChangesView state={{
      draft: { ...EMPTY_DRAFT, generated_at: "2026-07-19T09:00:00Z", sections },
      loading: false,
      offline: false,
    } as never} limit={4} />);

    expect(await screen.findByText("Change 4")).toBeTruthy();
    expect(screen.queryByText("Change 5")).toBeNull();
    expect(screen.getByText("Showing 4 of 6 ranked changes")).toBeTruthy();
  });

  it("renders the PM delta, impact, owner, and action column contract as a real table", async () => {
    getAlertStates.mockResolvedValue([]);
    render(<RankedChangesView state={{
      draft: {
        ...EMPTY_DRAFT,
        generated_at: "2026-07-19T09:00:00Z",
        sections: [{
          issuer_id: "ATLF",
          issuer_name: "Atlas Forge",
          max_severity: 0.9,
          claims: [{
            text: "Margin moved below the peer range",
            claim_type: "anomaly",
            anomaly_kind: "peer-outlier",
            anomaly_severity: 0.9,
            chunk_ids: [],
            fact_ids: [],
            model: "claude-opus-4-8",
          }],
          deterministic_bullets: [],
          exhibit: [],
        }],
      },
      loading: false,
      offline: false,
    } as never} limit={4} tableColumnPreset="pm-delta" />);

    expect(await screen.findByRole("columnheader", { name: "Change" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Portfolio impact" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Required action" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Owner" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeTruthy();
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
