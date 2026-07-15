// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent, waitFor, within } from "@testing-library/react";
import { AlertInbox } from "./AlertInbox";

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

const DRAFT_WITH_ROW = {
  status: "draft", ai_generated: true, ratified: false, export_allowed: false,
  marking: "AI-GENERATED, UNRATIFIED", generated_at: "2026-07-12T09:00:00Z",
  sections: [
    {
      issuer_id: "EG", issuer_name: "EG Group", max_severity: 0.7,
      claims: [],
      deterministic_bullets: [{ kind: "ts-jump", severity: 0.7, metric: "dm", direction: "up", chunk_id: null, context: {} }],
      exhibit: [],
    },
  ],
  summary: { n_sections: 1, n_claims: 0, n_deterministic_bullets: 1, n_anomalies: 1 },
  refreshing: false,
};

const EMPTY_DRAFT = {
  status: "draft", ai_generated: true, ratified: false, export_allowed: false,
  marking: "AI-GENERATED, UNRATIFIED", sections: [],
  summary: { n_sections: 0, n_claims: 0, n_deterministic_bullets: 0, n_anomalies: 0 },
  refreshing: false,
};

describe("AlertInbox", () => {
  it("renders nothing when offline — caller shows the DEMO fallback instead", async () => {
    getAutonomyDraft.mockRejectedValue(new Error("network error"));
    const { container } = render(<AlertInbox />);
    await act(async () => {});
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing on a settled empty draft — never a fabricated row", async () => {
    getAutonomyDraft.mockResolvedValue(EMPTY_DRAFT);
    const { container } = render(<AlertInbox />);
    await act(async () => {});
    expect(container.firstChild).toBeNull();
  });

  it("renders a live row and labels the acked state 'Ack/assigned', never 'Resolved'", async () => {
    getAutonomyDraft.mockResolvedValue(DRAFT_WITH_ROW);
    getAlertStates.mockResolvedValue([]);
    setAlertState.mockResolvedValue({
      id: "1", alert_key: "2026-07-12T09:00:00Z:EG:ts-jump:dm", state: "ack",
      assignee: null, note: null, analyst_id: "a1", created_at: "2026-07-12T09:05:00Z",
    });
    render(<AlertInbox />);
    await waitFor(() => expect(screen.getByText("Open")).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ack" }));
    });
    await waitFor(() => expect(screen.getByText("Ack/assigned")).toBeTruthy());
    expect(screen.queryByText("Resolved")).toBeNull();
  });

  it("assign posts the typed name and shows it as the owner", async () => {
    getAutonomyDraft.mockResolvedValue(DRAFT_WITH_ROW);
    getAlertStates.mockResolvedValue([]);
    setAlertState.mockResolvedValue({
      id: "1", alert_key: "2026-07-12T09:00:00Z:EG:ts-jump:dm", state: "open",
      assignee: "j.mora", note: null, analyst_id: "a1", created_at: "2026-07-12T09:05:00Z",
    });
    render(<AlertInbox />);
    await waitFor(() => expect(screen.getByText("unassigned")).toBeTruthy());

    fireEvent.change(screen.getByPlaceholderText("assign to…"), { target: { value: "j.mora" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    });
    await waitFor(() =>
      expect(setAlertState).toHaveBeenCalledWith("2026-07-12T09:00:00Z:EG:ts-jump:dm", "open", { assignee: "j.mora" }),
    );
    await waitFor(() => expect(screen.getByText("j.mora")).toBeTruthy());
  });

  it("BatchBar acks every selected row", async () => {
    getAutonomyDraft.mockResolvedValue(DRAFT_WITH_ROW);
    getAlertStates.mockResolvedValue([]);
    setAlertState.mockResolvedValue({
      id: "1", alert_key: "2026-07-12T09:00:00Z:EG:ts-jump:dm", state: "ack",
      assignee: null, note: null, analyst_id: "a1", created_at: "2026-07-12T09:05:00Z",
    });
    render(<AlertInbox />);
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeTruthy());

    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(screen.getByText("1 alert selected")).toBeTruthy());
    const toolbar = screen.getByRole("toolbar", { name: "Batch actions" });
    await act(async () => {
      fireEvent.click(within(toolbar).getByRole("button", { name: "Ack" }));
    });
    await waitFor(() => expect(setAlertState).toHaveBeenCalledWith("2026-07-12T09:00:00Z:EG:ts-jump:dm", "ack"));
  });

  it("shows a quantified impact badge next to the reason, in the same standard-deviations unit the engine computes", async () => {
    getAutonomyDraft.mockResolvedValue(DRAFT_WITH_ROW); // severity: 0.7
    getAlertStates.mockResolvedValue([]);
    render(<AlertInbox />);
    await waitFor(() => expect(screen.getByText("0.7σ")).toBeTruthy());
  });

  it("Resolve moves a row to the real terminal state and out of the active list, into a collapsed Resolved section", async () => {
    getAutonomyDraft.mockResolvedValue(DRAFT_WITH_ROW);
    getAlertStates.mockResolvedValue([]);
    setAlertState.mockResolvedValue({
      id: "1", alert_key: "2026-07-12T09:00:00Z:EG:ts-jump:dm", state: "resolved",
      assignee: null, note: null, analyst_id: "a1", created_at: "2026-07-12T09:05:00Z",
      resolved_at: "2026-07-12T09:10:00Z", resolution_note: "Refinanced, no longer material.",
    });
    render(<AlertInbox />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Resolve" })).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    });
    fireEvent.change(screen.getByPlaceholderText("resolution note (optional)…"), {
      target: { value: "Refinanced, no longer material." },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm resolve" }));
    });

    await waitFor(() =>
      expect(setAlertState).toHaveBeenCalledWith(
        "2026-07-12T09:00:00Z:EG:ts-jump:dm", "resolved", { resolutionNote: "Refinanced, no longer material." },
      ),
    );
    // The row leaves the active list (no more Open/Ack/Resolve buttons visible
    // for it) and the collapsed disclosure now shows a count.
    await waitFor(() => expect(screen.getByText("+ Resolved (1)")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Ack" })).toBeNull();
    expect(screen.queryByText("Resolved")).toBeNull(); // still collapsed

    fireEvent.click(screen.getByText("+ Resolved (1)"));
    expect(screen.getByText("Resolved")).toBeTruthy();
    expect(screen.getByText("resolved: Refinanced, no longer material.")).toBeTruthy();
  });
});
