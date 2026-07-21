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

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getAlertEventPage: (...args: unknown[]) => getAlertEventPage(...args),
  getWatchRulePage: (...args: unknown[]) => getWatchRulePage(...args),
  patchAlertEvent: (...args: unknown[]) => patchAlertEvent(...args),
  getDecisions: (...args: unknown[]) => getDecisions(...args),
  reopenDecision: (...args: unknown[]) => reopenDecision(...args),
  getChunk: (...args: unknown[]) => getChunk(...args),
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
  return <AlertInbox controller={controller} />;
}

function ConflictRaceHarness() {
  const controller = usePersistedMonitorController();
  return <>
    <button type="button" onClick={() => void controller.mutateEvent("event-2", "ack").catch(() => undefined)}>Mutate sibling</button>
    <AlertInbox controller={controller} />
  </>;
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
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AlertInbox · persisted event presentation", () => {
  it("assigns through the event PATCH and preserves input for an explicit retry", async () => {
    patchAlertEvent
      .mockRejectedValueOnce(new Error("assignment unavailable"))
      .mockResolvedValueOnce({ ...EVENT, assignee: "j.mora" });
    render(<Harness />);
    const input = await screen.findByLabelText("Alert assignee") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "j.mora" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    expect((await screen.findByRole("alert")).textContent).toContain("assignment unavailable");
    expect(input.value).toBe("j.mora");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenNthCalledWith(2, "event-1", "open", { assignee: "j.mora" }));
    await waitFor(() => expect(input.value).toBe(""));
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
    expect(await screen.findByText(/Persisted events were reloaded/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByLabelText("Alert assignee")).toBe(input);
    expect(input.value).toBe("j.mora");

    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenNthCalledWith(2, "event-1", "ack", { assignee: "j.mora" }));
  });

  it("waits for a pre-conflict sibling mutation before loading final authority and never lets its late response clobber resolved notes", async () => {
    const siblingMutation = deferred<AlertEventDTO>();
    const sibling: AlertEventDTO = {
      ...EVENT,
      id: "event-2",
      alert_key: "c3:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      title: "Sibling mutation",
    };
    getAlertEventPage
      .mockResolvedValueOnce({ items: [EVENT, sibling], nextCursor: null })
      .mockResolvedValueOnce({ items: [
        { ...EVENT, state: "resolved", resolution_note: "Resolved by persisted authority." },
        { ...sibling, state: "resolved", resolution_note: "Sibling resolved by persisted authority." },
      ], nextCursor: null });
    patchAlertEvent.mockImplementation((id: string) => {
      if (id === "event-2") return siblingMutation.promise;
      return Promise.reject({ response: { status: 409, data: { detail: "Cannot move resolved alert back to open." } } });
    });
    render(<ConflictRaceHarness />);
    await screen.findByText("Sibling mutation");

    fireEvent.click(screen.getByRole("button", { name: "Mutate sibling" }));
    const input = screen.getAllByLabelText("Alert assignee")[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: "j.mora" } });
    const assign = screen.getAllByRole("button", { name: "Assign" })[0]!;
    fireEvent.click(assign);
    await waitFor(() => expect(patchAlertEvent).toHaveBeenCalledTimes(2));
    expect(getAlertEventPage).toHaveBeenCalledTimes(1);
    expect(assign.getAttribute("aria-disabled")).toBe("true");

    siblingMutation.resolve({ ...sibling, state: "ack", note: "Sibling write completed." });
    await siblingMutation.promise;

    expect(await screen.findByText("resolved: Resolved by persisted authority.")).toBeTruthy();
    expect(screen.getByText("resolved: Sibling resolved by persisted authority.")).toBeTruthy();
    expect(getAlertEventPage).toHaveBeenCalledTimes(2);
    expect(patchAlertEvent).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Reload persisted alerts" })).toBeNull();
    expect(input.isConnected).toBe(false);
    expect(screen.queryByLabelText("Alert assignee")).toBeNull();
  });

  it("does not issue a post-drain authority GET after unmount", async () => {
    const siblingMutation = deferred<AlertEventDTO>();
    const sibling: AlertEventDTO = {
      ...EVENT,
      id: "event-2",
      alert_key: "c3:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      title: "Unmounted sibling mutation",
    };
    getAlertEventPage.mockResolvedValueOnce({ items: [EVENT, sibling], nextCursor: null });
    patchAlertEvent.mockImplementation((id: string) => id === sibling.id
      ? siblingMutation.promise
      : Promise.reject({ response: { status: 409, data: { detail: "Row lifecycle changed." } } }));
    const rendered = render(<ConflictRaceHarness />);
    await screen.findByText("Unmounted sibling mutation");
    fireEvent.click(screen.getByRole("button", { name: "Mutate sibling" }));
    fireEvent.change(screen.getAllByLabelText("Alert assignee")[0]!, { target: { value: "j.mora" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Assign" })[0]!);
    await waitFor(() => expect(patchAlertEvent).toHaveBeenCalledTimes(2));
    expect(getAlertEventPage).toHaveBeenCalledTimes(1);

    rendered.unmount();
    await act(async () => {
      siblingMutation.resolve({ ...sibling, state: "ack" });
      await siblingMutation.promise;
    });
    expect(getAlertEventPage).toHaveBeenCalledTimes(1);
  });

  it("does not expose an ordinary batch retry after an unrelated row conflict raises reload authority", async () => {
    const batchFailure = deferred<AlertEventDTO>();
    const batchSuccess = deferred<AlertEventDTO>();
    const reconciliation = deferred<{ items: AlertEventDTO[]; nextCursor: null }>();
    const second: AlertEventDTO = {
      ...EVENT,
      id: "event-2",
      alert_key: "c3:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      title: "Batch sibling",
    };
    const third: AlertEventDTO = {
      ...EVENT,
      id: "event-3",
      alert_key: "c3:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      title: "Conflicted row",
    };
    getAlertEventPage
      .mockResolvedValueOnce({ items: [EVENT, second, third], nextCursor: null })
      .mockReturnValueOnce(reconciliation.promise);
    patchAlertEvent.mockImplementation((id: string) => {
      if (id === EVENT.id) return batchFailure.promise;
      if (id === second.id) return batchSuccess.promise;
      return Promise.reject({ response: { status: 409, data: { detail: "Row lifecycle changed." } } });
    });
    render(<Harness />);
    await screen.findByText("Conflicted row");
    fireEvent.click(screen.getByRole("checkbox", { name: `Select ${EVENT.title}` }));
    fireEvent.click(screen.getByRole("checkbox", { name: `Select ${second.title}` }));
    fireEvent.click(screen.getAllByRole("button", { name: "Ack" })[0]!);

    const thirdAssignee = screen.getAllByLabelText("Alert assignee")[2]!;
    fireEvent.change(thirdAssignee, { target: { value: "j.mora" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Assign" })[2]!);
    await waitFor(() => expect(patchAlertEvent).toHaveBeenCalledTimes(3));

    batchFailure.reject(new Error("ordinary batch transport failure"));
    batchSuccess.resolve({ ...second, state: "ack" });
    await Promise.allSettled([batchFailure.promise, batchSuccess.promise]);
    expect(await screen.findByText(/ordinary batch transport failure/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry acknowledgment" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reload persisted alerts" })).toBeTruthy();
    expect(screen.queryByRole("toolbar", { name: "Batch actions" })).toBeNull();

    reconciliation.resolve({ items: [EVENT, { ...second, state: "ack" }, { ...third, state: "resolved", resolution_note: "Resolved elsewhere." }], nextCursor: null });
    expect(await screen.findByText("resolved: Resolved elsewhere.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reload persisted alerts" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry acknowledgment" })).toBeNull();
  });

  it("withdraws an existing ordinary batch retry when an already-pending row later raises reload authority", async () => {
    const batchFailure = deferred<AlertEventDTO>();
    const batchSuccess = deferred<AlertEventDTO>();
    const rowConflict = deferred<AlertEventDTO>();
    const reconciliation = deferred<{ items: AlertEventDTO[]; nextCursor: null }>();
    const second: AlertEventDTO = {
      ...EVENT,
      id: "event-2",
      alert_key: "c3:abababababababababababababababababababababababababababababababab",
      title: "Reverse-order batch sibling",
    };
    const third: AlertEventDTO = {
      ...EVENT,
      id: "event-3",
      alert_key: "c3:cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd",
      title: "Reverse-order conflicted row",
    };
    getAlertEventPage
      .mockResolvedValueOnce({ items: [EVENT, second, third], nextCursor: null })
      .mockReturnValueOnce(reconciliation.promise);
    patchAlertEvent.mockImplementation((id: string) => {
      if (id === EVENT.id) return batchFailure.promise;
      if (id === second.id) return batchSuccess.promise;
      return rowConflict.promise;
    });
    render(<Harness />);
    await screen.findByText("Reverse-order conflicted row");
    fireEvent.click(screen.getByRole("checkbox", { name: `Select ${EVENT.title}` }));
    fireEvent.click(screen.getByRole("checkbox", { name: `Select ${second.title}` }));
    fireEvent.click(screen.getAllByRole("button", { name: "Ack" })[0]!);
    fireEvent.change(screen.getAllByLabelText("Alert assignee")[2]!, { target: { value: "j.mora" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Assign" })[2]!);
    await waitFor(() => expect(patchAlertEvent).toHaveBeenCalledTimes(3));

    batchFailure.reject(new Error("reverse-order batch failure"));
    batchSuccess.resolve({ ...second, state: "ack" });
    await Promise.allSettled([batchFailure.promise, batchSuccess.promise]);
    expect(await screen.findByRole("button", { name: "Retry acknowledgment" })).toBeTruthy();

    rowConflict.reject({ response: { status: 409, data: { detail: "Row lifecycle changed." } } });
    await rowConflict.promise.catch(() => undefined);
    expect(await screen.findByRole("button", { name: "Reload persisted alerts" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry acknowledgment" })).toBeNull();
    expect(document.body.textContent).not.toMatch(/retry acknowledgment/i);
    expect(document.body.textContent).toMatch(/authoritative reload is required/i);
    expect(screen.queryByRole("toolbar", { name: "Batch actions" })).toBeNull();

    reconciliation.resolve({ items: [EVENT, { ...second, state: "ack" }, { ...third, state: "resolved", resolution_note: "Resolved elsewhere." }], nextCursor: null });
    expect(await screen.findByText("resolved: Resolved elsewhere.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reload persisted alerts" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry acknowledgment" })).toBeNull();
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
