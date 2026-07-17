// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act, fireEvent, waitFor, within } from "@testing-library/react";
import { AlertInbox } from "./AlertInbox";

const getAutonomyDraft = vi.fn();
const getAlertStates = vi.fn();
const setAlertState = vi.fn();
const refreshAlertEvents = vi.fn();
const getAlertEvents = vi.fn();
const patchAlertEvent = vi.fn();
const getDecisions = vi.fn();
const reopenDecision = vi.fn();
const getChunk = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getAutonomyDraft: (...a: unknown[]) => getAutonomyDraft(...a),
    getAlertStates: (...a: unknown[]) => getAlertStates(...a),
    setAlertState: (...a: unknown[]) => setAlertState(...a),
    refreshAlertEvents: (...a: unknown[]) => refreshAlertEvents(...a),
    getAlertEvents: (...a: unknown[]) => getAlertEvents(...a),
    patchAlertEvent: (...a: unknown[]) => patchAlertEvent(...a),
    getDecisions: (...a: unknown[]) => getDecisions(...a),
    reopenDecision: (...a: unknown[]) => reopenDecision(...a),
    getChunk: (...a: unknown[]) => getChunk(...a),
  };
});

beforeEach(() => {
  refreshAlertEvents.mockResolvedValue([]);
  getAlertEvents.mockResolvedValue([]);
  getDecisions.mockResolvedValue([]);
  getChunk.mockResolvedValue({ chunk_id: "chunk-live-1", doc: "Q1 earnings release", text: "Persisted source extract." });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

const MATERIAL_DRAFT = {
  ...DRAFT_WITH_ROW,
  sections: [{
    ...DRAFT_WITH_ROW.sections[0],
    deterministic_bullets: [{
      ...DRAFT_WITH_ROW.sections[0].deterministic_bullets[0],
      kind: "rating-watch",
      metric: "rating",
    }],
  }],
};

const DURABLE_EVENT = {
  id: "event-1",
  alert_key: "2026-07-12T09:00:00Z:EG:ts-jump:dm",
  issuer_id: "EG",
  run_id: "run-1",
  kind: "ts-jump",
  title: "ts-jump dm up",
  impact: "0.7σ",
  evidence: {},
  authority: {},
  state: "open",
  assignee: "durable.owner",
  note: "watch",
  resolved_at: null,
  resolution_note: null,
  created_at: "2026-07-12T09:05:00Z",
  updated_at: "2026-07-12T09:05:00Z",
} as const;

const ACTIVE_DECISION = {
  id: "decision-1",
  issuer_id: "EG",
  run_id: "run-1",
  report_id: null,
  action: "approve",
  status: "active",
  conditions: [],
  expiry: null,
  snapshot: {},
  snapshot_sha256: "sha256",
  created_by: "analyst",
  reopened_at: null,
  reopen_alert_key: null,
  created_at: "2026-07-12T08:00:00Z",
  votes: [],
} as const;

interface TestFiber {
  type?: { name?: string } | null;
  return?: TestFiber | null;
  memoizedProps?: unknown;
}

function reactFiber(element: Element): TestFiber | null {
  const key = Object.keys(element).find((candidate) => candidate.startsWith("__reactFiber$"));
  return key ? (element as unknown as Record<string, TestFiber>)[key] ?? null : null;
}

function componentProps(element: Element, name: string) {
  let fiber = reactFiber(element);
  while (fiber && fiber.type?.name !== name) fiber = fiber.return ?? null;
  if (!fiber) throw new Error(`React component ${name} was not found`);
  return fiber.memoizedProps as Record<string, (...args: unknown[]) => unknown>;
}

function hostProps(element: Element) {
  const fiber = reactFiber(element);
  if (!fiber) throw new Error("React host fiber was not found");
  return fiber.memoizedProps as Record<string, (...args: unknown[]) => unknown>;
}

describe("AlertInbox", () => {
  it("renders an honest offline status — never a fabricated row, never silent null", async () => {
    getAutonomyDraft.mockRejectedValue(new Error("network error"));
    render(<AlertInbox />);
    await act(async () => {});
    expect(screen.getByText("Autonomy engine unreachable")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("renders an honest empty status on a settled empty draft — never a fabricated row, never silent null", async () => {
    getAutonomyDraft.mockResolvedValue(EMPTY_DRAFT);
    render(<AlertInbox />);
    await act(async () => {});
    expect(screen.getByText("No live alerts")).toBeTruthy();
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
    expect(screen.getByText("low")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ack" }));
    });
    await waitFor(() => expect(screen.getByText("Ack/assigned")).toBeTruthy());
    expect(screen.queryByText("Resolved")).toBeNull();
  });

  it("opens only a persisted source chunk and explains missing provenance without a dead source control", async () => {
    getAutonomyDraft.mockResolvedValue({
      ...DRAFT_WITH_ROW,
      sections: [{
        ...DRAFT_WITH_ROW.sections[0],
        deterministic_bullets: [{ ...DRAFT_WITH_ROW.sections[0].deterministic_bullets[0], chunk_id: "chunk-live-1" }],
      }],
    });
    render(<AlertInbox />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Open source chunk-live-1" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Open source chunk-live-1" }));
    expect(await screen.findByText("Persisted source extract.")).toBeTruthy();
    expect(getChunk).toHaveBeenCalledWith("chunk-live-1");

    cleanup();
    getAutonomyDraft.mockResolvedValue(DRAFT_WITH_ROW);
    render(<AlertInbox />);
    expect(await screen.findByText(/Source unavailable · The autonomy draft did not carry a persisted source identifier/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Open source/ })).toBeNull();
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

  it("preserves assignment input and surfaces a retryable mutation failure", async () => {
    getAutonomyDraft.mockResolvedValue(DRAFT_WITH_ROW);
    getAlertStates.mockResolvedValue([]);
    setAlertState.mockRejectedValueOnce(new Error("assignment unavailable")).mockResolvedValueOnce({
      id: "1", alert_key: "2026-07-12T09:00:00Z:EG:ts-jump:dm", state: "open",
      assignee: "j.mora", note: null, analyst_id: "a1", created_at: "2026-07-12T09:05:00Z",
    });
    render(<AlertInbox />);
    const input = await screen.findByPlaceholderText("assign to…") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "j.mora" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));

    expect((await screen.findByRole("alert")).textContent).toContain("assignment unavailable");
    expect(input.value).toBe("j.mora");
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(setAlertState).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(input.value).toBe(""));
  });

  it("guards rapid duplicate acknowledgements", async () => {
    getAutonomyDraft.mockResolvedValue(DRAFT_WITH_ROW);
    getAlertStates.mockResolvedValue([]);
    let resolveAck!: (value: never) => void;
    setAlertState.mockImplementationOnce(() => new Promise((resolve) => { resolveAck = resolve; }));
    render(<AlertInbox />);
    const ack = await screen.findByRole("button", { name: "Ack" });
    fireEvent.click(ack);
    fireEvent.click(ack);
    await waitFor(() => expect(ack.getAttribute("aria-disabled")).toBe("true"));
    act(() => { hostProps(ack).onClick(); });
    expect(setAlertState).toHaveBeenCalledTimes(1);
    resolveAck({
      id: "1", alert_key: "2026-07-12T09:00:00Z:EG:ts-jump:dm", state: "ack",
      assignee: null, note: null, analyst_id: "a1", created_at: "2026-07-12T09:05:00Z",
    } as never);
    await waitFor(() => expect(screen.getByText("Ack/assigned")).toBeTruthy());
  });

  it("claims the custom ack-selected batch synchronously across duplicate events", async () => {
    getAutonomyDraft.mockResolvedValue(DRAFT_WITH_ROW);
    getAlertStates.mockResolvedValue([]);
    let resolveAck!: (value: never) => void;
    setAlertState.mockImplementationOnce(() => new Promise((resolve) => { resolveAck = resolve; }));
    render(<AlertInbox />);
    fireEvent.click(await screen.findByRole("checkbox"));
    await screen.findByText("1 alert selected");

    act(() => {
      window.dispatchEvent(new Event("caos:monitor-ack-selected"));
      window.dispatchEvent(new Event("caos:monitor-ack-selected"));
    });
    expect(setAlertState).toHaveBeenCalledTimes(1);

    resolveAck({
      id: "1", alert_key: "2026-07-12T09:00:00Z:EG:ts-jump:dm", state: "ack",
      assignee: null, note: null, analyst_id: "a1", created_at: "2026-07-12T09:05:00Z",
    } as never);
    await waitFor(() => expect(screen.getByText("Ack/assigned")).toBeTruthy());
  });

  it("hydrates durable events, falls back after refresh, and patches the durable workflow", async () => {
    getAutonomyDraft.mockResolvedValue(DRAFT_WITH_ROW);
    getAlertStates.mockResolvedValue([{
      id: "legacy", alert_key: DURABLE_EVENT.alert_key, state: "open", assignee: "legacy.owner",
      note: null, analyst_id: "a1", created_at: DURABLE_EVENT.created_at,
    }]);
    refreshAlertEvents.mockRejectedValue(new Error("refresh unavailable"));
    getAlertEvents.mockResolvedValue([DURABLE_EVENT]);
    patchAlertEvent
      .mockResolvedValueOnce({ ...DURABLE_EVENT, state: "ack", updated_at: "2026-07-12T09:06:00Z" })
      .mockResolvedValueOnce({
        ...DURABLE_EVENT,
        state: "ack",
        assignee: "credit.desk",
        updated_at: "2026-07-12T09:07:00Z",
      });
    const selections: Array<{ count: number; eventId: string | null }> = [];
    const capture = (event: Event) => selections.push((event as CustomEvent).detail);
    window.addEventListener("caos:monitor-selection", capture);

    render(<AlertInbox />);
    await screen.findByText("durable.owner");
    expect(getAlertEvents).toHaveBeenCalledOnce();

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    await waitFor(() => expect(selections.at(-1)).toEqual({ count: 1, eventId: "event-1" }));
    fireEvent.click(checkbox);
    await waitFor(() => expect(screen.queryByText("1 alert selected")).toBeNull());
    fireEvent.click(checkbox);
    fireEvent.click(await screen.findByRole("button", { name: "clear" }));
    await waitFor(() => expect(screen.queryByText("1 alert selected")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Ack" }));
    await screen.findByText("Ack/assigned");
    expect(patchAlertEvent).toHaveBeenNthCalledWith(1, "event-1", "ack", undefined);

    fireEvent.change(screen.getByPlaceholderText("assign to…"), { target: { value: "credit.desk" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await screen.findByText("credit.desk");
    expect(patchAlertEvent).toHaveBeenNthCalledWith(2, "event-1", "ack", { assignee: "credit.desk" });
    window.removeEventListener("caos:monitor-selection", capture);
  });

  it("surfaces and retries a failed custom acknowledgement without dropping selection", async () => {
    getAutonomyDraft.mockResolvedValue(DRAFT_WITH_ROW);
    getAlertStates.mockResolvedValue([]);
    setAlertState
      .mockRejectedValueOnce(new Error("batch endpoint unavailable"))
      .mockResolvedValueOnce({
        id: "1", alert_key: DURABLE_EVENT.alert_key, state: "ack", assignee: null,
        note: null, analyst_id: "a1", created_at: DURABLE_EVENT.created_at,
      });
    render(<AlertInbox />);
    fireEvent.click(await screen.findByRole("checkbox"));
    act(() => window.dispatchEvent(new Event("caos:monitor-ack-selected")));

    expect((await screen.findByRole("alert")).textContent).toContain("batch endpoint unavailable");
    expect(screen.getByText("1 alert selected")).toBeTruthy();
    act(() => window.dispatchEvent(new Event("caos:monitor-ack-selected")));
    await screen.findByText("Ack/assigned");
    await waitFor(() => expect(screen.queryByText("1 alert selected")).toBeNull());
  });

  it("cancels resolution and submits an empty note as undefined", async () => {
    getAutonomyDraft.mockResolvedValue(DRAFT_WITH_ROW);
    getAlertStates.mockResolvedValue([]);
    setAlertState.mockResolvedValue({
      id: "1", alert_key: DURABLE_EVENT.alert_key, state: "resolved", assignee: null,
      note: null, analyst_id: "a1", created_at: DURABLE_EVENT.created_at,
      resolved_at: "2026-07-12T09:10:00Z", resolution_note: null,
    });
    render(<AlertInbox />);
    fireEvent.click(await screen.findByRole("button", { name: "Resolve" }));
    fireEvent.change(screen.getByPlaceholderText("resolution note (optional)…"), { target: { value: "discard me" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText("resolution note (optional)…")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm resolve" }));
    await waitFor(() => expect(setAlertState).toHaveBeenCalledWith(
      DURABLE_EVENT.alert_key, "resolved", { resolutionNote: undefined },
    ));
  });

  it("handles material-decision reopen failure, retry, and reopened terminal state", async () => {
    getAutonomyDraft.mockResolvedValue(MATERIAL_DRAFT);
    getAlertStates.mockResolvedValue([]);
    getDecisions.mockResolvedValue([ACTIVE_DECISION]);
    reopenDecision
      .mockRejectedValueOnce(new Error("decision service unavailable"))
      .mockResolvedValueOnce({
        ...ACTIVE_DECISION,
        status: "reopened",
        reopened_at: "2026-07-12T09:15:00Z",
        reopen_alert_key: "2026-07-12T09:00:00Z:EG:rating-watch:rating",
      });
    render(<AlertInbox />);

    fireEvent.click(await screen.findByRole("button", { name: "Reopen IC" }));
    expect((await screen.findByRole("alert")).textContent).toContain("decision service unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry reopen" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /reopen/i })).toBeNull());
    expect(reopenDecision).toHaveBeenNthCalledWith(
      2,
      "decision-1",
      "2026-07-12T09:00:00Z:EG:rating-watch:rating",
    );
  });

  it("guards a busy decision reopen and ignores material alerts without an issuer", async () => {
    getAutonomyDraft.mockResolvedValue(MATERIAL_DRAFT);
    getAlertStates.mockResolvedValue([]);
    getDecisions.mockResolvedValue([ACTIVE_DECISION]);
    let finish!: (value: unknown) => void;
    reopenDecision.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const first = render(<AlertInbox />);
    fireEvent.click(await screen.findByRole("button", { name: "Reopen IC" }));
    const busy = await screen.findByRole("button", { name: "Reopening…" });
    await act(async () => { await hostProps(busy).onClick(); });
    expect(reopenDecision).toHaveBeenCalledOnce();
    finish({ ...ACTIVE_DECISION, status: "reopened" });
    await waitFor(() => expect(screen.queryByRole("button", { name: /reopen/i })).toBeNull());
    first.unmount();

    getDecisions.mockResolvedValue([]);
    getAutonomyDraft.mockResolvedValue({ ...MATERIAL_DRAFT, generated_at: "2026-07-12T09:30:00Z" });
    const withoutDecision = render(<AlertInbox />);
    await waitFor(() => expect(getDecisions).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(screen.queryByRole("button", { name: /reopen/i })).toBeNull();
    withoutDecision.unmount();

    getAutonomyDraft.mockResolvedValue({
      ...MATERIAL_DRAFT,
      generated_at: "2026-07-12T10:00:00Z",
      sections: [{ ...MATERIAL_DRAFT.sections[0], issuer_id: null }],
    });
    render(<AlertInbox />);
    await screen.findByText("rating-watch rating up");
    expect(getDecisions).toHaveBeenCalledTimes(2);
  });

  it("drops late enrichment after unmount", async () => {
    getAutonomyDraft.mockResolvedValue(DRAFT_WITH_ROW);
    let finishStates!: (value: unknown[]) => void;
    getAlertStates.mockImplementation(() => new Promise((resolve) => { finishStates = resolve; }));
    const view = render(<AlertInbox />);
    await screen.findByRole("checkbox");
    await waitFor(() => expect(getAlertStates).toHaveBeenCalledOnce());
    view.unmount();
    await act(async () => { finishStates([]); });
  });

  it("renders a non-finite impact honestly and invokes resolved-row defensive callbacks", async () => {
    getAutonomyDraft.mockResolvedValue({
      ...DRAFT_WITH_ROW,
      generated_at: "2026-07-12T11:00:00Z",
      sections: [{
        ...DRAFT_WITH_ROW.sections[0],
        deterministic_bullets: [{ ...DRAFT_WITH_ROW.sections[0].deterministic_bullets[0], severity: Number.POSITIVE_INFINITY }],
      }],
    });
    const key = "2026-07-12T11:00:00Z:EG:ts-jump:dm";
    getAlertStates.mockResolvedValue([{
      id: "resolved-1", alert_key: key, state: "resolved", assignee: null,
      note: null, analyst_id: "a1", created_at: DURABLE_EVENT.created_at,
      resolved_at: "2026-07-12T11:05:00Z", resolution_note: null,
    }]);
    render(<AlertInbox />);
    const disclosure = await screen.findByRole("button", { name: "+ Resolved (1)" });
    expect(screen.queryByText(/σ$/)).toBeNull();
    fireEvent.click(disclosure);
    const checkbox = screen.getByRole("checkbox");
    const props = componentProps(checkbox, "Row");
    await act(async () => {
      props.onToggleSelect();
      await props.onAck();
      await props.onAssign("nobody");
      await props.onResolve("unused");
    });
    fireEvent.click(screen.getByRole("button", { name: "− Resolved (1)" }));
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
