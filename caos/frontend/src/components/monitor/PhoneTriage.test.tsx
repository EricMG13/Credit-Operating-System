// @vitest-environment jsdom
// G6: phone triage — one alert at a time, ack/assign/resolve, prev/next, and
// a desktop handoff. Shares the same autonomy draft + alert_states mutation
// contract as AlertInbox, so the two can never disagree about an alert.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PhoneTriage } from "./PhoneTriage";

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const TWO_ROW_DRAFT = {
  status: "draft", ai_generated: true, ratified: false, export_allowed: false,
  marking: "AI-GENERATED, UNRATIFIED", generated_at: "2026-07-12T09:00:00Z",
  sections: [
    {
      issuer_id: "EG", issuer_name: "EG Group", max_severity: 0.9,
      claims: [], deterministic_bullets: [
        { kind: "ts-jump", severity: 0.9, metric: "dm", direction: "up", chunk_id: null, context: {} },
      ],
      exhibit: [],
    },
    {
      issuer_id: "QLMH", issuer_name: "Quill Media", max_severity: 0.4,
      claims: [], deterministic_bullets: [
        { kind: "cusum-shift", severity: 0.4, metric: "revenue", direction: "down", chunk_id: null, context: {} },
      ],
      exhibit: [],
    },
  ],
  summary: { n_sections: 2, n_claims: 0, n_deterministic_bullets: 2, n_anomalies: 2 },
  refreshing: false,
};

const EMPTY_DRAFT = {
  status: "draft", ai_generated: true, ratified: false, export_allowed: false,
  marking: "AI-GENERATED, UNRATIFIED", sections: [],
  summary: { n_sections: 0, n_claims: 0, n_deterministic_bullets: 0, n_anomalies: 0 },
  refreshing: false,
};

describe("PhoneTriage", () => {
  it("shows an honest offline state, never a fabricated card", async () => {
    getAutonomyDraft.mockRejectedValue(new Error("network error"));
    render(<PhoneTriage />);
    await waitFor(() => expect(screen.getByText("Watchtower unreachable")).toBeTruthy());
  });

  it("shows an honest empty state on a settled empty draft", async () => {
    getAutonomyDraft.mockResolvedValue(EMPTY_DRAFT);
    render(<PhoneTriage />);
    await waitFor(() => expect(screen.getByText("no alerts to triage")).toBeTruthy());
  });

  it("shows one alert at a time, ranked by severity, with a real impact figure and a desktop handoff", async () => {
    getAutonomyDraft.mockResolvedValue(TWO_ROW_DRAFT);
    getAlertStates.mockResolvedValue([]);
    render(<PhoneTriage />);
    await waitFor(() => expect(screen.getByText("EG Group")).toBeTruthy());
    expect(screen.getByText("1 of 2")).toBeTruthy();
    expect(screen.getByText("0.9σ")).toBeTruthy();
    expect(screen.queryByText("Quill Media")).toBeNull(); // only one card visible at a time
    expect(screen.getByRole("link", { name: /Continue on desktop — open EG Group in Deep-Dive/ })).toBeTruthy();
  });

  it("prev/next walk the queue and clamp at the boundaries", async () => {
    getAutonomyDraft.mockResolvedValue(TWO_ROW_DRAFT);
    getAlertStates.mockResolvedValue([]);
    render(<PhoneTriage />);
    await waitFor(() => expect(screen.getByText("EG Group")).toBeTruthy());

    const prev = screen.getByRole("button", { name: "Previous alert" });
    const next = screen.getByRole("button", { name: "Next alert" });
    expect((prev as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(next);
    await waitFor(() => expect(screen.getByText("Quill Media")).toBeTruthy());
    expect((next as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Previous alert" }));
    await waitFor(() => expect(screen.getByText("EG Group")).toBeTruthy());
  });

  it("Ack, Assign, and Resolve all work from the card, and a resolved card drops its action row", async () => {
    getAutonomyDraft.mockResolvedValue(TWO_ROW_DRAFT);
    getAlertStates.mockResolvedValue([]);
    setAlertState.mockResolvedValue({
      id: "1", alert_key: "2026-07-12T09:00:00Z:EG:ts-jump:dm", state: "resolved",
      assignee: null, note: null, analyst_id: "a1", created_at: "2026-07-12T09:05:00Z",
      resolved_at: "2026-07-12T09:10:00Z", resolution_note: "Reviewed, no action needed.",
    });
    render(<PhoneTriage />);
    await waitFor(() => expect(screen.getByText("EG Group")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    fireEvent.change(screen.getByPlaceholderText("resolution note (optional)…"), {
      target: { value: "Reviewed, no action needed." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(setAlertState).toHaveBeenCalledWith(
        "2026-07-12T09:00:00Z:EG:ts-jump:dm", "resolved", { resolutionNote: "Reviewed, no action needed." },
      ),
    );
    await waitFor(() => expect(screen.getByText("Resolved")).toBeTruthy());
    expect(screen.getByText("resolved: Reviewed, no action needed.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ack" })).toBeNull(); // action row gone once resolved
  });

  it("preserves a failed resolution note and retries the exact mutation", async () => {
    getAutonomyDraft.mockResolvedValue(TWO_ROW_DRAFT);
    getAlertStates.mockResolvedValue([]);
    setAlertState.mockRejectedValueOnce(new Error("resolve unavailable")).mockResolvedValueOnce({
      id: "1", alert_key: "2026-07-12T09:00:00Z:EG:ts-jump:dm", state: "resolved",
      assignee: null, note: null, analyst_id: "a1", created_at: "2026-07-12T09:05:00Z",
      resolved_at: "2026-07-12T09:10:00Z", resolution_note: "Keep this note",
    });
    render(<PhoneTriage />);
    await screen.findByText("EG Group");
    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    const note = screen.getByPlaceholderText("resolution note (optional)…") as HTMLInputElement;
    fireEvent.change(note, { target: { value: "Keep this note" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect((await screen.findByRole("alert")).textContent).toContain("resolve unavailable");
    expect(note.value).toBe("Keep this note");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(setAlertState).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("Resolved")).toBeTruthy());
  });
});
