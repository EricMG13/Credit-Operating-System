// @vitest-environment jsdom
// G6: phone triage — one alert at a time, ack/assign/resolve, prev/next, and
// a desktop handoff. Shares the same autonomy draft + alert_states mutation
// contract as AlertInbox, so the two can never disagree about an alert.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("PhoneTriage", () => {
  it("shows an honest offline state, never a fabricated card, and never mislabels a real outage as DEMO content", async () => {
    getAutonomyDraft.mockRejectedValue(new Error("network error"));
    render(<PhoneTriage />);
    await waitFor(() => expect(screen.getByText("Autonomy engine unreachable")).toBeTruthy());
    expect(screen.queryByText(/^DEMO$/)).toBeNull();
  });

  it("shows an honest empty state on a settled empty draft", async () => {
    getAutonomyDraft.mockResolvedValue(EMPTY_DRAFT);
    render(<PhoneTriage />);
    await waitFor(() => expect(screen.getByText("No alerts to triage")).toBeTruthy());
  });

  it("renders an empty draft without an optional marking", async () => {
    const draft = { ...EMPTY_DRAFT } as Partial<typeof EMPTY_DRAFT>;
    delete draft.marking;
    getAutonomyDraft.mockResolvedValue(draft);
    render(<PhoneTriage />);
    await screen.findByText("No alerts to triage");
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

  it("falls back to the issuer name and suppresses a non-finite impact", async () => {
    const draft = {
      ...TWO_ROW_DRAFT,
      sections: [{
        ...TWO_ROW_DRAFT.sections[0],
        issuer_id: null,
        deterministic_bullets: [{
          ...TWO_ROW_DRAFT.sections[0].deterministic_bullets[0],
          severity: Number.NaN,
        }],
      }],
      summary: { ...TWO_ROW_DRAFT.summary, n_sections: 1, n_deterministic_bullets: 1, n_anomalies: 1 },
    };
    getAutonomyDraft.mockResolvedValue(draft);
    getAlertStates.mockResolvedValue([]);
    render(<PhoneTriage />);

    await screen.findByText("EG Group");
    expect(screen.queryByText(/σ$/)).toBeNull();
    expect(screen.getByRole("link", { name: /Continue on desktop/ }).getAttribute("href"))
      .toBe("/deepdive?issuer=EG%20Group");
  });

  it("sorts defensively when persisted alert states are unknown", async () => {
    getAutonomyDraft.mockResolvedValue(TWO_ROW_DRAFT);
    getAlertStates.mockResolvedValue([
      {
        id: "unknown-eg", alert_key: "2026-07-12T09:00:00Z:EG:ts-jump:dm", state: "unknown",
        assignee: null, note: null, analyst_id: null, created_at: null, resolved_at: null, resolution_note: null,
      },
      {
        id: "unknown-qlmh", alert_key: "2026-07-12T09:00:00Z:QLMH:cusum-shift:revenue", state: "unknown",
        assignee: null, note: null, analyst_id: null, created_at: null, resolved_at: null, resolution_note: null,
      },
    ]);
    render(<PhoneTriage />);
    await screen.findByText("EG Group");
    expect(screen.getByText("Open")).toBeTruthy();
  });

  it("prev/next walk the queue and clamp at the boundaries", async () => {
    getAutonomyDraft.mockResolvedValue(TWO_ROW_DRAFT);
    getAlertStates.mockResolvedValue([]);
    render(<PhoneTriage />);
    await waitFor(() => expect(screen.getByText("EG Group")).toBeTruthy());

    const prev = screen.getByRole("button", { name: "Previous alert" });
    const next = screen.getByRole("button", { name: "Next alert" });
    expect(prev.getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(next);
    await waitFor(() => expect(screen.getByText("Quill Media")).toBeTruthy());
    expect(next.getAttribute("aria-disabled")).toBe("true");

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
    fireEvent.change(screen.getByLabelText("Alert resolution note"), {
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

  it("acknowledges and assigns both open and acknowledged alerts", async () => {
    getAutonomyDraft.mockResolvedValue(TWO_ROW_DRAFT);
    getAlertStates.mockResolvedValue([]);
    const key = "2026-07-12T09:00:00Z:EG:ts-jump:dm";
    setAlertState.mockImplementation(async (
      alertKey: string,
      state: "open" | "ack" | "resolved",
      options?: { assignee?: string },
    ) => ({
      id: `${state}-${options?.assignee ?? "none"}`,
      alert_key: alertKey,
      state,
      assignee: options?.assignee ?? null,
      note: null,
      analyst_id: "a1",
      created_at: "2026-07-12T09:05:00Z",
      resolved_at: null,
      resolution_note: null,
    }));
    render(<PhoneTriage />);
    await screen.findByText("EG Group");

    const assignee = screen.getByLabelText("Alert assignee");
    fireEvent.change(assignee, { target: { value: "Sam" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(setAlertState).toHaveBeenNthCalledWith(1, key, "open", { assignee: "Sam" }));
    expect(await screen.findByText("Sam")).toBeTruthy();
    expect((assignee as HTMLInputElement).value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Ack" }));
    await waitFor(() => expect(setAlertState).toHaveBeenNthCalledWith(2, key, "ack"));
    expect(await screen.findByText("Ack/assigned")).toBeTruthy();

    fireEvent.change(assignee, { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(setAlertState).toHaveBeenNthCalledWith(3, key, "ack", { assignee: "Alex" }));
    expect(await screen.findByText("Alex")).toBeTruthy();
  });

  it("guards a rapid duplicate acknowledgement while the first mutation is pending", async () => {
    getAutonomyDraft.mockResolvedValue(TWO_ROW_DRAFT);
    getAlertStates.mockResolvedValue([]);
    const pending = deferred<{
      id: string; alert_key: string; state: "ack"; assignee: null; note: null;
      analyst_id: string; created_at: string; resolved_at: null; resolution_note: null;
    }>();
    setAlertState.mockReturnValue(pending.promise);
    render(<PhoneTriage />);
    await screen.findByText("EG Group");

    const ack = screen.getByRole("button", { name: "Ack" });
    act(() => {
      fireEvent.click(ack);
      fireEvent.click(ack);
    });
    expect(setAlertState).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve({
      id: "ack-1", alert_key: "2026-07-12T09:00:00Z:EG:ts-jump:dm", state: "ack",
      assignee: null, note: null, analyst_id: "a1", created_at: "2026-07-12T09:05:00Z",
      resolved_at: null, resolution_note: null,
    }));
  });

  it("submits an omitted resolution note as undefined", async () => {
    getAutonomyDraft.mockResolvedValue(TWO_ROW_DRAFT);
    getAlertStates.mockResolvedValue([]);
    setAlertState.mockResolvedValue({
      id: "resolved-empty", alert_key: "2026-07-12T09:00:00Z:EG:ts-jump:dm", state: "resolved",
      assignee: null, note: null, analyst_id: "a1", created_at: "2026-07-12T09:05:00Z",
      resolved_at: "2026-07-12T09:10:00Z", resolution_note: null,
    });
    render(<PhoneTriage />);
    await screen.findByText("EG Group");

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(setAlertState).toHaveBeenCalledWith(
      "2026-07-12T09:00:00Z:EG:ts-jump:dm", "resolved", { resolutionNote: undefined },
    ));
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
    const note = screen.getByLabelText("Alert resolution note") as HTMLInputElement;
    fireEvent.change(note, { target: { value: "Keep this note" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect((await screen.findByRole("alert")).textContent).toContain("resolve unavailable");
    expect(note.value).toBe("Keep this note");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(setAlertState).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("Resolved")).toBeTruthy());
  });
});
