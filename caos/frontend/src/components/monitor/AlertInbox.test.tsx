// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AlertEventDTO } from "@/lib/api";
import { AlertInbox } from "./AlertInbox";
import { usePersistedMonitorController } from "./usePersistedMonitorController";

const getAlertEventPage = vi.fn();
const getWatchRulePage = vi.fn();
const patchAlertEvent = vi.fn();
const getDecisions = vi.fn();
const reopenDecision = vi.fn();
const getChunk = vi.fn();
const getQA = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getAlertEventPage: async (...args: unknown[]) => ({ canMutate: true, ...await getAlertEventPage(...args) }),
  getWatchRulePage: (...args: unknown[]) => getWatchRulePage(...args),
  patchAlertEvent: (...args: unknown[]) => patchAlertEvent(...args),
  getDecisions: (...args: unknown[]) => getDecisions(...args),
  reopenDecision: (...args: unknown[]) => reopenDecision(...args),
  getChunk: (...args: unknown[]) => getChunk(...args),
  getQA: (...args: unknown[]) => getQA(...args),
}));

const EVENT: AlertEventDTO = {
  id: "event-1",
  alert_key: "c3:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  issuer_id: "issuer-1",
  run_id: "run-1",
  kind: "qa_change",
  title: "QA gate changed",
  impact: "Review governed evidence.",
  evidence: { observed_at: "2026-07-20T10:00:00Z" },
  authority: { watch_rule_id: "rule-1" },
  state: "open",
  assignee: null,
  note: null,
  resolved_at: null,
  resolution_note: null,
  created_at: "2026-07-20T10:00:00Z",
  updated_at: "2026-07-20T10:00:00Z",
};

function Harness() {
  const controller = usePersistedMonitorController();
  return <><button type="button" onClick={() => void controller.refresh({ preserveReadyView: true })}>Refresh persisted alerts</button><AlertInbox controller={controller} /></>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  getAlertEventPage.mockReset().mockResolvedValue({ items: [EVENT], nextCursor: null });
  getWatchRulePage.mockReset().mockResolvedValue({ items: [], nextCursor: null });
  patchAlertEvent.mockReset();
  getDecisions.mockReset().mockResolvedValue([]);
  reopenDecision.mockReset();
  getChunk.mockReset();
  getQA.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AlertInbox · persisted event presentation", () => {
  it("assigns through the event PATCH and retries the currently displayed assignee intent", async () => {
    patchAlertEvent
      .mockRejectedValueOnce(new Error("assignment unavailable"))
      .mockResolvedValueOnce({ ...EVENT, assignee: "s.lee" });
    render(<Harness />);
    const input = await screen.findByLabelText("Alert assignee") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "j.mora" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    expect((await screen.findByRole("alert")).textContent).toContain("assignment unavailable");
    expect(input.value).toBe("j.mora");
    fireEvent.change(input, { target: { value: "s.lee" } });
    expect(screen.getByRole("alert").textContent).toMatch(/retry submits the current draft/i);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenNthCalledWith(2, "event-1", "open", { assignee: "s.lee" }));
    await waitFor(() => expect(input.value).toBe(""));
  });

  it("states that input is preserved when an Ack transition can be retried", async () => {
    patchAlertEvent.mockRejectedValueOnce(new Error("acknowledgment unavailable"));
    render(<Harness />);
    const input = await screen.findByLabelText("Alert assignee") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Desk owner" } });
    fireEvent.click(screen.getByRole("button", { name: "Ack" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Input was preserved.");
    expect(alert.textContent).toContain("The workflow transition is available to retry.");
    expect(input.value).toBe("Desk owner");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("drops desktop retry and draft custody after a successful authoritative refresh of the same row", async () => {
    getAlertEventPage
      .mockResolvedValueOnce({ items: [EVENT], nextCursor: null })
      .mockResolvedValueOnce({ items: [{ ...EVENT, updated_at: "2026-07-20T10:05:00Z" }], nextCursor: null });
    patchAlertEvent
      .mockRejectedValueOnce(new Error("stale desktop assignment"))
      .mockResolvedValueOnce({ ...EVENT, assignee: "Fresh analyst" });
    render(<Harness />);
    const input = await screen.findByLabelText("Alert assignee") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Stale analyst" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    expect((await screen.findByRole("alert")).textContent).toContain("stale desktop assignment");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Refresh persisted alerts" }));
    await waitFor(() => expect(getAlertEventPage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(input.value).toBe("");
    expect(patchAlertEvent).toHaveBeenCalledOnce();

    fireEvent.change(input, { target: { value: "Fresh analyst" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenNthCalledWith(2, "event-1", "open", { assignee: "Fresh analyst" }));
  });

  it("keeps desktop retry and current draft mounted when a preserve-view refresh fails", async () => {
    getAlertEventPage
      .mockResolvedValueOnce({ items: [EVENT], nextCursor: null })
      .mockRejectedValueOnce(new Error("desktop refresh unavailable"));
    patchAlertEvent
      .mockRejectedValueOnce(new Error("recoverable desktop assignment"))
      .mockResolvedValueOnce({ ...EVENT, assignee: "Recoverable analyst" });
    render(<Harness />);
    const input = await screen.findByLabelText("Alert assignee") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Recoverable analyst" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    expect((await screen.findByRole("alert")).textContent).toContain("recoverable desktop assignment");

    fireEvent.click(screen.getByRole("button", { name: "Refresh persisted alerts" }));
    await waitFor(() => expect(getAlertEventPage).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Alert assignee")).toBe(input);
    expect(input.value).toBe("Recoverable analyst");
    expect(screen.getByRole("alert").textContent).toContain("recoverable desktop assignment");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenNthCalledWith(2, "event-1", "open", { assignee: "Recoverable analyst" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getByRole("button", { name: "Show resolved alerts" }).getAttribute("aria-disabled")).toBeNull();
  });

  it("retries the currently displayed resolution note instead of the failed captured payload", async () => {
    patchAlertEvent
      .mockRejectedValueOnce(new Error("resolution unavailable"))
      .mockResolvedValueOnce({ ...EVENT, state: "resolved", resolution_note: "Current committee note" });
    render(<Harness />);
    await screen.findByText("QA gate changed");
    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    const input = screen.getByLabelText("Alert resolution note") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Original committee note" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm resolve" }));
    expect((await screen.findByRole("alert")).textContent).toContain("resolution unavailable");

    fireEvent.change(input, { target: { value: "Current committee note" } });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(patchAlertEvent).toHaveBeenNthCalledWith(2, "event-1", "resolved", { resolutionNote: "Current committee note" }));
  });

  it("cancels a failed resolution draft together with its retry authority", async () => {
    patchAlertEvent.mockRejectedValueOnce(new Error("resolution unavailable"));
    render(<Harness />);
    await screen.findByText("QA gate changed");
    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    fireEvent.change(screen.getByLabelText("Alert resolution note"), {
      target: { value: "Do not lose this committee note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm resolve" }));
    expect((await screen.findByRole("alert")).textContent).toContain("resolution unavailable");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Alert resolution note")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(patchAlertEvent).toHaveBeenCalledOnce();
  });

  it("locks desktop assignee and resolution drafts until each submitted request settles", async () => {
    const assignment = deferred<AlertEventDTO>();
    const resolution = deferred<AlertEventDTO>();
    patchAlertEvent
      .mockReturnValueOnce(assignment.promise)
      .mockReturnValueOnce(resolution.promise);
    render(<Harness />);
    const assignee = await screen.findByLabelText("Alert assignee") as HTMLInputElement;
    fireEvent.change(assignee, { target: { value: "Alice" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(assignee.disabled).toBe(true));
    expect(patchAlertEvent).toHaveBeenNthCalledWith(1, "event-1", "open", { assignee: "Alice" });
    const resolvedFilter = screen.getByRole("button", { name: "Show resolved alerts" });
    expect(resolvedFilter.getAttribute("aria-disabled")).toBe("true");
    expect((screen.getByLabelText("Select QA gate changed") as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(resolvedFilter);
    expect(screen.getByText("QA gate changed")).toBeTruthy();

    assignment.resolve({ ...EVENT, assignee: "Alice" });
    await assignment.promise;
    await waitFor(() => expect(assignee.value).toBe(""));

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    const note = screen.getByLabelText("Alert resolution note") as HTMLInputElement;
    fireEvent.change(note, { target: { value: "Captured note" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm resolve" }));
    await waitFor(() => expect(note.disabled).toBe(true));
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    expect(patchAlertEvent).toHaveBeenNthCalledWith(2, "event-1", "resolved", { resolutionNote: "Captured note" });

    resolution.resolve({ ...EVENT, state: "resolved", resolution_note: "Captured note" });
    await resolution.promise;
    await waitFor(() => expect(screen.queryByLabelText("Alert resolution note")).toBeNull());
  });

  it("reconciles a lifecycle conflict before another action without exposing a stale retry", async () => {
    const reload = deferred<{ items: AlertEventDTO[]; nextCursor: null }>();
    getAlertEventPage
      .mockResolvedValueOnce({ items: [EVENT], nextCursor: null })
      .mockReturnValueOnce(reload.promise);
    patchAlertEvent
      .mockRejectedValueOnce({ response: { status: 409, data: { detail: "Cannot move alert state backward: resolved -> open." } } })
      .mockResolvedValueOnce({ ...EVENT, state: "ack", assignee: "j.mora" });
    render(<Harness />);
    const input = await screen.findByLabelText("Alert assignee") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "j.mora" } });
    const assign = screen.getByRole("button", { name: "Assign" });
    fireEvent.click(assign);

    await waitFor(() => expect(getAlertEventPage).toHaveBeenCalledTimes(2));
    expect(assign.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(assign);
    expect(patchAlertEvent).toHaveBeenCalledTimes(1);

    reload.resolve({ items: [{ ...EVENT, state: "ack", assignee: "other.analyst" }], nextCursor: null });
    const conflictCopy = await screen.findByText(/Persisted events were reloaded/);
    expect(conflictCopy.closest('[role="alert"]')?.textContent).not.toMatch(/retry submits the current draft/i);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByLabelText("Alert assignee")).toBe(input);
    expect(input.value).toBe("j.mora");

    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenNthCalledWith(2, "event-1", "ack", { assignee: "j.mora" }));
  });

  it("blocks ordinary row mutations while a captured batch is pending", async () => {
    const firstMutation = deferred<AlertEventDTO>();
    const siblingMutation = deferred<AlertEventDTO>();
    const sibling: AlertEventDTO = {
      ...EVENT,
      id: "event-2",
      alert_key: "c3:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      title: "Batch sibling",
    };
    getAlertEventPage.mockResolvedValueOnce({ items: [EVENT, sibling], nextCursor: null });
    patchAlertEvent
      .mockReturnValueOnce(firstMutation.promise)
      .mockReturnValueOnce(siblingMutation.promise);
    render(<Harness />);
    await screen.findByText("Batch sibling");
    fireEvent.click(screen.getByRole("checkbox", { name: `Select ${EVENT.title}` }));
    fireEvent.click(screen.getByRole("checkbox", { name: `Select ${sibling.title}` }));
    fireEvent.click(screen.getAllByRole("button", { name: "Ack" })[0]!);
    await waitFor(() => expect(patchAlertEvent).toHaveBeenCalledTimes(2));
    const assignees = screen.getAllByLabelText("Alert assignee") as HTMLInputElement[];
    const assigns = screen.getAllByRole("button", { name: "Assign" });
    expect(assignees.every((input) => input.disabled)).toBe(true);
    expect(assigns.every((button) => button.getAttribute("aria-disabled") === "true")).toBe(true);
    fireEvent.click(assigns[1]!);
    expect(patchAlertEvent).toHaveBeenCalledTimes(2);

    firstMutation.resolve({ ...EVENT, state: "ack" });
    siblingMutation.resolve({ ...sibling, state: "ack" });
    await Promise.all([firstMutation.promise, siblingMutation.promise]);
  });

  it("opens only an explicitly typed persisted chunk reference", async () => {
    getAlertEventPage.mockResolvedValue({ items: [{ ...EVENT, evidence: { source_artifact_refs: ["run:run-1", "chunk:chunk-7"] } }], nextCursor: null });
    getChunk.mockResolvedValue({ chunk_id: "chunk-7", doc: "Governed filing", text: "Persisted extract." });
    render(<Harness />);
    const source = await screen.findByRole("button", { name: "Open source chunk-7" });
    expect(source.className).toContain("min-h-8");
    expect(screen.getByTitle("Open issuer issuer-1 profile").className).toContain("min-h-8");
    fireEvent.click(source);
    expect(await screen.findByText("Persisted extract.")).toBeTruthy();
    expect(screen.getByText("Governed filing · source extract").className).toContain("min-h-8");
    expect(getChunk).toHaveBeenCalledWith("chunk-7");
  });

  it("opens the governed run QA report for the real run-finding materialization shape", async () => {
    getAlertEventPage.mockResolvedValue({ items: [{
      ...EVENT,
      kind: "run_finding",
      run_id: "run-1",
      evidence: {
        observed_at: "2026-07-20T10:00:00Z",
        detail: { run_id: "run-1", finding_row_id: "row-7", finding_id: "CP5-001", severity: "MATERIAL" },
        source_artifact_refs: ["run:run-1", "qa_finding:row-7"],
      },
    }], nextCursor: null });
    getQA.mockResolvedValue({
      run_id: "run-1",
      qa_status: "Blocked",
      committee_status: "Not Ready",
      findings_by_severity: { MATERIAL: 1 },
      findings: [{ finding_id: "CP5-001", severity: "MATERIAL", lane: 5, module_id: "CP-5", description: "Attach governed support.", affected_claim_id: null, required_remediation: "Rerun CP-5." }],
    });
    render(<Harness />);

    fireEvent.click(await screen.findByRole("button", { name: "Open source run:run-1" }));

    expect(await screen.findByText(/Run run-1 · QA Blocked · committee Not Ready/)).toBeTruthy();
    expect(screen.getByText(/CP5-001 · MATERIAL · Attach governed support/)).toBeTruthy();
    expect(getQA).toHaveBeenCalledWith("run-1");
    expect(getChunk).not.toHaveBeenCalled();
  });

  it("preserves the material-alert IC reopen workflow with retry and a synchronous duplicate fence", async () => {
    getAlertEventPage.mockResolvedValue({ items: [{ ...EVENT, kind: "covenant", title: "Covenant breach watch" }], nextCursor: null });
    getDecisions.mockResolvedValue([{
      id: "decision-1", issuer_id: "issuer-1", run_id: "run-1", report_id: null,
      action: "approve", status: "active", conditions: [], expiry: null, snapshot: {},
      snapshot_sha256: "hash", created_by: "analyst", reopened_at: null,
      reopen_alert_key: null, created_at: "2026-07-20T09:00:00Z", votes: [],
    }]);
    let rejectFirst!: (reason: unknown) => void;
    reopenDecision.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }));
    render(<Harness />);
    const reopen = await screen.findByRole("button", { name: "Reopen IC" });
    fireEvent.click(reopen);
    fireEvent.click(reopen);
    expect(reopenDecision).toHaveBeenCalledTimes(1);
    await act(async () => { rejectFirst(new Error("decision service unavailable")); });
    expect((await screen.findByRole("alert")).textContent).toContain("decision service unavailable");
    reopenDecision.mockResolvedValue({
      id: "decision-1", issuer_id: "issuer-1", run_id: "run-1", report_id: null,
      action: "approve", status: "reopened", conditions: [], expiry: null, snapshot: {},
      snapshot_sha256: "hash", created_by: "analyst", reopened_at: "2026-07-20T10:05:00Z",
      reopen_alert_key: EVENT.alert_key, created_at: "2026-07-20T09:00:00Z", votes: [],
    });
    fireEvent.click(screen.getByRole("button", { name: "Retry reopen" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /reopen/i })).toBeNull());
    expect(reopenDecision).toHaveBeenLastCalledWith("decision-1", EVENT.alert_key);
  });

  it("keeps desktop actions at the compact 32px contract and does not invent numeric severity", async () => {
    render(<Harness />);
    const ack = await screen.findByRole("button", { name: "Ack" });
    expect(ack.className).toContain("min-h-8");
    expect(document.body.textContent).not.toContain("σ");
    expect(document.body.textContent).not.toMatch(/severity\s+\d/i);
  });

  it("relocates focus and announces success when a filtered acknowledgment removes its row", async () => {
    patchAlertEvent.mockResolvedValue({ ...EVENT, state: "ack", updated_at: "2026-07-20T10:05:00Z" });
    render(<Harness />);
    fireEvent.click(await screen.findByRole("button", { name: "Show open alerts" }));
    const ack = screen.getByRole("button", { name: "Ack" });
    ack.focus();
    fireEvent.click(ack);

    await waitFor(() => expect(screen.queryByText("QA gate changed")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Show all alerts" })));
    expect(screen.getByRole("status").textContent).toContain("QA gate changed acknowledged. Persisted workflow state updated.");
  });
});
