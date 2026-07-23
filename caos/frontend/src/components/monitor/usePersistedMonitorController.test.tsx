// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AlertInbox } from "./AlertInbox";
import { PhoneTriage } from "./PhoneTriage";
import { usePersistedMonitorController } from "./usePersistedMonitorController";

const getAlertEventPage = vi.fn();
const getWatchRulePage = vi.fn();
const patchAlertEvent = vi.fn();
const getSettings = vi.fn().mockResolvedValue({ features: { alert_rules_v1_enabled: true } });
const forbiddenDraft = vi.fn();
const forbiddenLegacyStates = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSettings: (...args: unknown[]) => getSettings(...args),
  getAlertEventPage: async (...args: unknown[]) => ({ canMutate: true, ...await getAlertEventPage(...args) }),
  getWatchRulePage: (...args: unknown[]) => getWatchRulePage(...args),
  patchAlertEvent: (...args: unknown[]) => patchAlertEvent(...args),
  getAutonomyDraft: (...args: unknown[]) => forbiddenDraft(...args),
  getAlertStates: (...args: unknown[]) => forbiddenLegacyStates(...args),
}));

const event = (overrides: Record<string, unknown> = {}) => ({
  id: "event-open",
  alert_key: "c3:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  issuer_id: "issuer-17",
  run_id: "run-17",
  kind: "qa_change",
  title: "QA gate moved to blocked",
  impact: "Review governed evidence.",
  evidence: {
    observed_at: "2026-07-20T10:00:00Z",
    source_artifact_refs: ["run:run-17", "qa_finding:f-2"],
  },
  authority: { watch_rule_id: "rule-1", rule_version: 2 },
  state: "open",
  assignee: null,
  note: null,
  resolved_at: null,
  resolution_note: null,
  created_at: "2026-07-20T10:01:00Z",
  updated_at: "2026-07-20T10:01:00Z",
  ...overrides,
});

function Harness() {
  const controller = usePersistedMonitorController();
  return (
    <>
      <output data-testid="controller-status">{controller.status}:{controller.events.length}:{controller.selectedIds.length}</output>
      <output data-testid="mutation-capability">{controller.canMutate ? "write" : "read-only"}</output>
      <output data-testid="active-event">{controller.activeEventId ?? "none"}</output>
      <output data-testid="first-state">{controller.events[0]?.state ?? "none"}</output>
      <output data-testid="batch-state">{controller.batchPending ? "pending" : controller.batchError ?? "idle"}</output>
      <output data-testid="workflow-lock">{controller.workflowSurfaceLocked ? "locked" : "open"}</output>
      <output data-testid="authoritative-epoch">{controller.authoritativeRefreshEpoch}</output>
      <output data-testid="mutation-message">{controller.lastMutationMessage ?? "none"}</output>
      <button type="button" onClick={() => void controller.refresh()}>Reload controller</button>
      <button type="button" onClick={() => void controller.refresh({ preserveReadyView: true })}>Reconcile controller</button>
      <button type="button" onClick={() => { const first = controller.events[0]; if (first) void controller.mutateEvent(first.id, "ack").catch(() => undefined); }}>Mutate first alert</button>
      <button type="button" onClick={() => { const first = controller.events[0]; if (first) void controller.mutateEvent(first.id, "resolved").catch(() => undefined); }}>Resolve first alert</button>
      <button type="button" onClick={() => { const first = controller.events[0]; if (first) void controller.mutateEvent(first.id, first.state, { assignee: "Analyst" }).catch(() => undefined); }}>Assign first alert</button>
      <button type="button" onClick={() => { const second = controller.events[1]; if (second) void controller.mutateEvent(second.id, "ack").catch(() => undefined); }}>Mutate second alert</button>
      <button type="button" onClick={() => controller.events.forEach((item) => { if (item.state !== "resolved" && !controller.selectedIds.includes(item.id)) controller.toggleSelected(item.id); })}>Select active alerts</button>
      <button type="button" onClick={() => void controller.acknowledgeSelected().catch(() => undefined)}>Acknowledge controller batch</button>
      <AlertInbox controller={controller} />
      <PhoneTriage controller={controller} />
    </>
  );
}

function DeepLinkHarness() {
  const controller = usePersistedMonitorController("event-resolved");
  return <><output data-testid="deep-active">{controller.activeEventId ?? "none"}</output><output data-testid="deep-selected">{controller.selectedIds.length}</output><PhoneTriage controller={controller} /></>;
}

function ActivationHarness() {
  const controller = usePersistedMonitorController();
  return <>
    <output data-testid="activation-alert-status">{controller.status}:{controller.events.length}:{controller.selectedIds.length}</output>
    <output data-testid="activation-rule-availability">{controller.rules.availability}</output>
    <output data-testid="activation-alert-state">{controller.events[0]?.state ?? "none"}</output>
    <button type="button" onClick={() => { const first = controller.events[0]; if (first) controller.toggleSelected(first.id); }}>Select historical alert</button>
    <button type="button" onClick={() => { const first = controller.events[0]; if (first) void controller.mutateEvent(first.id, "ack").catch(() => undefined); }}>Acknowledge historical alert</button>
    <button type="button" onClick={() => void controller.refresh()}>Refresh historical alerts</button>
  </>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  getSettings.mockReset().mockResolvedValue({ features: { alert_rules_v1_enabled: true } });
  getAlertEventPage.mockReset();
  getWatchRulePage.mockReset();
  patchAlertEvent.mockReset();
  forbiddenDraft.mockReset();
  forbiddenLegacyStates.mockReset();
  getAlertEventPage.mockResolvedValue({ items: [], nextCursor: null });
  getWatchRulePage.mockResolvedValue({ items: [], nextCursor: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("persisted Monitor controller", () => {
  it("loads every persisted page once and feeds desktop, phone, counts, filter, selection, and mutation from one instance", async () => {
    const acknowledged = event({
      id: "event-ack",
      alert_key: "c3:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      issuer_id: null,
      title: "Covenant observation reviewed",
      state: "ack",
      created_at: "2026-07-20T09:00:00Z",
      updated_at: "2026-07-20T09:05:00Z",
    });
    getAlertEventPage
      .mockResolvedValueOnce({ items: [event()], nextCursor: "cursor-2" })
      .mockResolvedValueOnce({ items: [acknowledged], nextCursor: null });
    patchAlertEvent.mockResolvedValue(event({ state: "ack", updated_at: "2026-07-20T10:02:00Z" }));

    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:0"));
    expect(getAlertEventPage).toHaveBeenNthCalledWith(1, expect.objectContaining({ limit: 200, cursor: undefined }));
    expect(getAlertEventPage).toHaveBeenNthCalledWith(2, expect.objectContaining({ limit: 200, cursor: "cursor-2" }));
    expect(screen.getAllByText("QA gate moved to blocked")).toHaveLength(2);
    expect(screen.getByText("2 persisted alerts")).toBeTruthy();
    expect(forbiddenDraft).not.toHaveBeenCalled();
    expect(forbiddenLegacyStates).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Show acknowledged alerts" }));
    await waitFor(() => expect(screen.queryAllByText("QA gate moved to blocked")).toHaveLength(0));
    expect(screen.getAllByText("Covenant observation reviewed")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Show all alerts" }));
    const checkbox = await screen.findByRole("checkbox", { name: "Select QA gate moved to blocked" });
    fireEvent.click(checkbox);
    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:1"));
    fireEvent.click(screen.getAllByRole("button", { name: "Ack" })[0]!);
    await waitFor(() => expect(patchAlertEvent).toHaveBeenCalledWith("event-open", "ack", undefined));
    await waitFor(() => expect(screen.getAllByText("Acknowledged").length).toBeGreaterThanOrEqual(2));
  });

  it("rejects a repeated cursor instead of looping and exposes an explicit retry", async () => {
    getAlertEventPage
      .mockResolvedValueOnce({ items: [event()], nextCursor: "repeat" })
      .mockResolvedValueOnce({ items: [], nextCursor: "repeat" })
      .mockResolvedValueOnce({ items: [], nextCursor: null });

    render(<Harness />);

    expect((await screen.findAllByText(/Persisted alert pagination repeated a cursor/))).toHaveLength(2);
    expect(getAlertEventPage).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Retry persisted alerts" })[0]!);
    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:0:0"));
  });

  it("ignores a late stale load and ignores completion after unmount", async () => {
    const first = deferred<{ items: ReturnType<typeof event>[]; nextCursor: null }>();
    getAlertEventPage
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ items: [event({ id: "event-new", title: "Newest persisted alert" })], nextCursor: null });

    const rendered = render(<Harness />);
    await waitFor(() => expect(getAlertEventPage).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Reload controller" }));
    expect(await screen.findAllByText("Newest persisted alert")).toHaveLength(2);

    await act(async () => {
      first.resolve({ items: [event({ id: "event-old", title: "Stale alert" })], nextCursor: null });
      await first.promise;
    });
    expect(screen.queryByText("Stale alert")).toBeNull();

    const afterUnmount = deferred<{ items: never[]; nextCursor: null }>();
    getAlertEventPage.mockReturnValueOnce(afterUnmount.promise);
    fireEvent.click(screen.getByRole("button", { name: "Reload controller" }));
    rendered.unmount();
    await act(async () => {
      afterUnmount.resolve({ items: [], nextCursor: null });
      await afterUnmount.promise;
    });
  });

  it("keeps the ready view mounted during reconciliation while fencing mutation authority", async () => {
    const reconciliation = deferred<{ items: ReturnType<typeof event>[]; nextCursor: null }>();
    getAlertEventPage
      .mockResolvedValueOnce({ items: [event()], nextCursor: null })
      .mockReturnValueOnce(reconciliation.promise);
    patchAlertEvent.mockResolvedValue(event({ state: "ack", assignee: "Analyst" }));
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:1:0"));

    fireEvent.click(screen.getByRole("button", { name: "Reconcile controller" }));
    await waitFor(() => expect(getAlertEventPage).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("controller-status").textContent).toBe("ready:1:0");
    expect(screen.getAllByText("QA gate moved to blocked")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Mutate first alert" }));
    expect(patchAlertEvent).not.toHaveBeenCalled();

    reconciliation.resolve({ items: [event({ state: "ack", assignee: "other.analyst" })], nextCursor: null });
    await waitFor(() => expect(screen.getByTestId("first-state").textContent).toBe("ack"));
    expect(screen.getByTestId("controller-status").textContent).toBe("ready:1:0");

    fireEvent.click(screen.getByRole("button", { name: "Assign first alert" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenCalledWith("event-open", "ack", { assignee: "Analyst" }));
  });

  it("keeps a prior ready surface mounted when an ordinary preserve-view refresh fails", async () => {
    const failedReconciliation = deferred<{ items: ReturnType<typeof event>[]; nextCursor: null }>();
    getAlertEventPage
      .mockResolvedValueOnce({ items: [event()], nextCursor: null })
      .mockReturnValueOnce(failedReconciliation.promise);
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:1:0"));

    fireEvent.click(screen.getByRole("button", { name: "Reconcile controller" }));
    await waitFor(() => expect(getAlertEventPage).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Mutate first alert" }));
    expect(patchAlertEvent).not.toHaveBeenCalled();

    failedReconciliation.reject(new Error("authoritative reconciliation failed"));
    await failedReconciliation.promise.catch(() => undefined);
    await waitFor(() => expect(screen.getAllByText("authoritative reconciliation failed")).toHaveLength(2));
    expect(screen.getByTestId("controller-status").textContent).toBe("ready:1:0");
    expect(screen.getAllByText("QA gate moved to blocked")).toHaveLength(2);
    expect(screen.queryAllByRole("button", { name: "Retry persisted alerts" })).toHaveLength(0);
  });

  it("does not let a superseded preserve-view reconciliation overwrite a newer full reload", async () => {
    const staleReconciliation = deferred<{ items: ReturnType<typeof event>[]; nextCursor: null }>();
    getAlertEventPage
      .mockResolvedValueOnce({ items: [event()], nextCursor: null })
      .mockReturnValueOnce(staleReconciliation.promise)
      .mockResolvedValueOnce({ items: [event({ id: "event-new", title: "Newer full reload", state: "ack" })], nextCursor: null });
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:1:0"));

    fireEvent.click(screen.getByRole("button", { name: "Reconcile controller" }));
    await waitFor(() => expect(getAlertEventPage).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Reload controller" }));
    expect(await screen.findAllByText("Newer full reload")).toHaveLength(2);

    await act(async () => {
      staleReconciliation.resolve({ items: [event({ title: "Stale reconciliation" })], nextCursor: null });
      await staleReconciliation.promise;
    });
    expect(screen.queryByText("Stale reconciliation")).toBeNull();
    expect(screen.getByTestId("controller-status").textContent).toBe("ready:1:0");
  });

  it("does not let a list snapshot that started before a mutation overwrite the new state", async () => {
    const stale = deferred<{ items: ReturnType<typeof event>[]; nextCursor: null }>();
    const mutation = deferred<ReturnType<typeof event>>();
    getAlertEventPage
      .mockResolvedValueOnce({ items: [event()], nextCursor: null })
      .mockReturnValueOnce(stale.promise);
    patchAlertEvent.mockReturnValueOnce(mutation.promise);
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("first-state").textContent).toBe("open"));

    fireEvent.click(screen.getByRole("button", { name: "Mutate first alert" }));
    fireEvent.click(screen.getByRole("button", { name: "Reload controller" }));
    mutation.resolve(event({ state: "ack", updated_at: "2026-07-20T10:04:00Z" }));
    await mutation.promise;
    await waitFor(() => expect(screen.getByTestId("first-state").textContent).toBe("ack"));
    await act(async () => {
      stale.resolve({ items: [event({ state: "open" })], nextCursor: null });
      await stale.promise;
    });
    expect(screen.getByTestId("first-state").textContent).toBe("ack");
  });

  it("releases non-conflict workflow custody after a successful authoritative refresh", async () => {
    const acknowledged = event({
      id: "event-ack",
      alert_key: "c3:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      title: "Authoritative acknowledged event",
      state: "ack",
    });
    getAlertEventPage
      .mockResolvedValueOnce({ items: [event(), acknowledged], nextCursor: null })
      .mockResolvedValueOnce({ items: [event({ state: "resolved", resolution_note: "Resolved externally." }), acknowledged], nextCursor: null });
    patchAlertEvent.mockRejectedValueOnce(new Error("assignment transport failed"));
    render(<Harness />);
    await screen.findAllByText("Authoritative acknowledged event");

    fireEvent.click(screen.getByRole("button", { name: "Assign first alert" }));
    await waitFor(() => expect(screen.getByTestId("workflow-lock").textContent).toBe("locked"));
    fireEvent.click(screen.getByRole("button", { name: "Show acknowledged alerts" }));
    expect(screen.getAllByText("QA gate moved to blocked")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Reload controller" }));
    await waitFor(() => expect(getAlertEventPage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("workflow-lock").textContent).toBe("open"));
    expect(screen.getByTestId("authoritative-epoch").textContent).toBe("2");

    fireEvent.click(screen.getByRole("button", { name: "Show acknowledged alerts" }));
    await waitFor(() => expect(screen.queryByText("QA gate moved to blocked")).toBeNull());
    expect(screen.queryByRole("checkbox", { name: "Select Authoritative acknowledged event" })).toBeNull();
    expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:0");
  });

  it("does not advance authoritative refresh identity when the list refresh fails", async () => {
    getAlertEventPage
      .mockResolvedValueOnce({ items: [event()], nextCursor: null })
      .mockRejectedValueOnce(new Error("authoritative refresh failed"));
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("authoritative-epoch").textContent).toBe("1"));

    fireEvent.click(screen.getByRole("button", { name: "Reload controller" }));
    expect((await screen.findAllByText("authoritative refresh failed")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId("authoritative-epoch").textContent).toBe("1");
  });

  it("keeps typed run and QA references out of chunk controls while exposing governed run evidence", async () => {
    getAlertEventPage.mockResolvedValue({ items: [event()], nextCursor: null });
    render(<Harness />);
    await screen.findAllByText("QA gate moved to blocked");
    expect(screen.queryByRole("button", { name: /Open source chunk:/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Open source run:run-17" })).toHaveLength(2);
  });

  it("hydrates a valid deep-linked active event while keeping resolved phone navigation out of batch selection", async () => {
    getAlertEventPage.mockResolvedValue({ items: [
      event(),
      event({ id: "event-resolved", title: "Resolved persisted alert", state: "resolved", resolution_note: "Closed." }),
    ], nextCursor: null });
    render(<DeepLinkHarness />);
    expect(await screen.findByText("Resolved persisted alert")).toBeTruthy();
    expect(screen.getByTestId("deep-active").textContent).toBe("event-resolved");
    expect(screen.getByTestId("deep-selected").textContent).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Previous alert" }));
    await waitFor(() => expect(screen.getByText("QA gate moved to blocked")).toBeTruthy());
    expect(screen.getByTestId("deep-selected").textContent).toBe("0");
  });

  it("shares each in-flight mutation and retains only failed IDs after a partial failure", async () => {
    const firstPatch = deferred<ReturnType<typeof event>>();
    getAlertEventPage.mockResolvedValue({ items: [
      event(),
      event({ id: "event-two", alert_key: "c3:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc", title: "Second open event" }),
    ], nextCursor: null });
    patchAlertEvent
      .mockReturnValueOnce(firstPatch.promise)
      .mockResolvedValueOnce(event({ id: "event-two", state: "ack", title: "Second open event" }));
    render(<Harness />);
    await screen.findAllByText("Second open event");
    fireEvent.click(screen.getByRole("button", { name: "Select active alerts" }));
    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:2"));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge controller batch" }));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge controller batch" }));
    expect(patchAlertEvent).toHaveBeenCalledTimes(2);
    firstPatch.reject(new Error("first alert unavailable"));
    await waitFor(() => expect(screen.getByTestId("batch-state").textContent).toContain("first alert unavailable"));
    expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:1");
  });

  it("fences filter retargeting until a non-conflict batch failure is published", async () => {
    const failedPatch = deferred<ReturnType<typeof event>>();
    const successfulPatch = deferred<ReturnType<typeof event>>();
    getAlertEventPage.mockResolvedValue({ items: [
      event(),
      event({ id: "event-two", alert_key: "c3:abababababababababababababababababababababababababababababababab", title: "Retargeted batch sibling" }),
    ], nextCursor: null });
    patchAlertEvent
      .mockReturnValueOnce(failedPatch.promise)
      .mockReturnValueOnce(successfulPatch.promise);
    render(<Harness />);
    await screen.findAllByText("Retargeted batch sibling");
    fireEvent.click(screen.getByRole("button", { name: "Select active alerts" }));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge controller batch" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "Show acknowledged alerts" }));
    expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:2");

    failedPatch.reject(new Error("retargeted batch failure"));
    successfulPatch.resolve(event({ id: "event-two", state: "ack", title: "Retargeted batch sibling" }));
    await failedPatch.promise.catch(() => undefined);
    await successfulPatch.promise;

    await waitFor(() => expect(screen.getByTestId("batch-state").textContent).toContain("retargeted batch failure"));
    expect(screen.getByTestId("batch-state").textContent).toMatch(/only failed alerts remain selected.*retry acknowledgment/i);
    expect(screen.getAllByRole("button", { name: "Retry acknowledgment" })).toHaveLength(2);
  });

  it("reconciles a batch lifecycle conflict and requires a fresh selection before another acknowledgment", async () => {
    getAlertEventPage
      .mockResolvedValueOnce({ items: [
        event(),
        event({ id: "event-two", alert_key: "c3:1212121212121212121212121212121212121212121212121212121212121212", title: "Concurrent batch sibling" }),
      ], nextCursor: null })
      .mockResolvedValueOnce({ items: [
        event({ state: "resolved", resolution_note: "Resolved in another session." }),
        event({ id: "event-two", alert_key: "c3:1212121212121212121212121212121212121212121212121212121212121212", title: "Concurrent batch sibling", state: "ack" }),
      ], nextCursor: null });
    patchAlertEvent
      .mockRejectedValueOnce({ response: { status: 409, data: { detail: "Alert lifecycle changed." } } })
      .mockResolvedValueOnce(event({ id: "event-two", title: "Concurrent batch sibling", state: "ack" }));
    render(<Harness />);
    await screen.findAllByText("Concurrent batch sibling");
    fireEvent.click(screen.getByRole("button", { name: "Select active alerts" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Ack" })[0]!);

    await waitFor(() => expect(getAlertEventPage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:0"));
    expect(screen.getByTestId("batch-state").textContent).toMatch(/reloaded.*fresh selection/i);
    expect(screen.queryByRole("button", { name: "Retry acknowledgment" })).toBeNull();
    expect(patchAlertEvent).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText("resolved: Resolved in another session.")).toHaveLength(1);
  });

  it("treats a masked alert mutation denial as authority invalidation without retaining Retry", async () => {
    getAlertEventPage
      .mockResolvedValueOnce({ items: [event()], nextCursor: null })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    patchAlertEvent.mockRejectedValueOnce({ response: { status: 404, data: { detail: "Not Found" } } });
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:1:0"));

    fireEvent.click(screen.getByRole("button", { name: "Mutate first alert" }));

    await waitFor(() => expect(getAlertEventPage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:0:0"));
    expect(patchAlertEvent).toHaveBeenCalledOnce();
    expect(screen.getByTestId("workflow-lock").textContent).toBe("open");
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reload persisted alerts" })).toBeNull();
  });

  it("fails closed for viewer alert authority and never exposes or submits workflow controls", async () => {
    getAlertEventPage.mockResolvedValueOnce({ items: [event()], nextCursor: null, canMutate: false });
    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId("mutation-capability").textContent).toBe("read-only"));
    expect(screen.queryByRole("checkbox", { name: "Select QA gate moved to blocked" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Ack" }).every((button) => button.getAttribute("aria-disabled") === "true")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Mutate first alert" }));
    expect(patchAlertEvent).not.toHaveBeenCalled();
  });

  it("rejects inconsistent alert mutation capability across cursor pages", async () => {
    getAlertEventPage
      .mockResolvedValueOnce({ items: [event()], nextCursor: "page-2", canMutate: true })
      .mockResolvedValueOnce({ items: [], nextCursor: null, canMutate: false });
    render(<Harness />);

    expect((await screen.findAllByText(/inconsistent mutation authority/i))).toHaveLength(2);
    expect(screen.getByTestId("mutation-capability").textContent).toBe("read-only");
    expect(patchAlertEvent).not.toHaveBeenCalled();
  });

  it("reconciles a 403 into read-only authority without retaining a retryable mutation", async () => {
    getAlertEventPage
      .mockResolvedValueOnce({ items: [event()], nextCursor: null, canMutate: true })
      .mockResolvedValueOnce({ items: [event()], nextCursor: null, canMutate: false });
    patchAlertEvent.mockRejectedValueOnce({ response: { status: 403, data: { detail: "Forbidden" } } });
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("mutation-capability").textContent).toBe("write"));

    fireEvent.click(screen.getByRole("button", { name: "Mutate first alert" }));

    await waitFor(() => expect(getAlertEventPage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("mutation-capability").textContent).toBe("read-only"));
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Select QA gate moved to blocked" })).toBeNull();
  });

  it("never grants acknowledged rows batch-ack selection authority", async () => {
    getAlertEventPage.mockResolvedValueOnce({ items: [event({ state: "ack" })], nextCursor: null });
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:1:0"));

    fireEvent.click(screen.getByRole("button", { name: "Select active alerts" }));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge controller batch" }));

    expect(screen.getByTestId("controller-status").textContent).toBe("ready:1:0");
    expect(screen.queryByRole("checkbox", { name: "Select QA gate moved to blocked" })).toBeNull();
    expect(patchAlertEvent).not.toHaveBeenCalled();
  });

  it("keeps a conflicted batch fenced behind persisted reload authority when reconciliation fails", async () => {
    getAlertEventPage
      .mockResolvedValueOnce({ items: [event()], nextCursor: null })
      .mockRejectedValueOnce(new Error("reconciliation transport failed"))
      .mockResolvedValueOnce({ items: [event({ state: "ack" })], nextCursor: null });
    patchAlertEvent.mockRejectedValueOnce({ response: { status: 409, data: { detail: "Alert lifecycle changed." } } });
    render(<Harness />);
    await screen.findAllByText("QA gate moved to blocked");
    fireEvent.click(screen.getByRole("button", { name: "Select active alerts" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Ack" })[0]!);

    await waitFor(() => expect(screen.getByTestId("batch-state").textContent).toMatch(/authoritative reload.*required/i));
    expect(screen.queryByRole("button", { name: "Retry acknowledgment" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Ack" }).every((button) => button.getAttribute("aria-disabled") === "true")).toBe(true);
    const reloads = screen.getAllByRole("button", { name: "Reload persisted alerts" });
    fireEvent.click(reloads[0]!);

    await waitFor(() => expect(getAlertEventPage).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:1:0"));
    await waitFor(() => expect(screen.getByTestId("batch-state").textContent).toBe("idle"));
    expect(patchAlertEvent).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Retry acknowledgment" })).toBeNull();
  });

  it("blocks batch acknowledgment while an individual same-alert intent is pending", async () => {
    const assignment = deferred<ReturnType<typeof event>>();
    getAlertEventPage.mockResolvedValue({ items: [event()], nextCursor: null });
    patchAlertEvent.mockReturnValueOnce(assignment.promise);
    render(<Harness />);
    await screen.findAllByText("QA gate moved to blocked");
    fireEvent.click(screen.getByRole("button", { name: "Select active alerts" }));
    fireEvent.click(screen.getByRole("button", { name: "Assign first alert" }));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge controller batch" }));

    expect(patchAlertEvent).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("batch-state").textContent).toBe("idle");
    expect(screen.getByTestId("controller-status").textContent).toBe("ready:1:1");
    expect(screen.getByTestId("first-state").textContent).toBe("open");
    expect(screen.getByTestId("mutation-message").textContent).toBe("none");

    assignment.resolve(event({ assignee: "Analyst" }));
    await assignment.promise;
    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:1:1"));
    expect(screen.getByTestId("first-state").textContent).toBe("open");
    expect(screen.getByTestId("mutation-message").textContent).not.toMatch(/acknowledged/i);
  });

  it("fences new selections and removes the captured selection after batch success", async () => {
    const firstAck = deferred<ReturnType<typeof event>>();
    getAlertEventPage.mockResolvedValue({ items: [
      event(),
      event({ id: "event-two", alert_key: "c3:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", title: "Later selection" }),
    ], nextCursor: null });
    patchAlertEvent.mockReturnValueOnce(firstAck.promise);
    render(<Harness />);
    await screen.findAllByText("Later selection");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select QA gate moved to blocked" }));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge controller batch" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Later selection" }));
    expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:1");

    firstAck.resolve(event({ state: "ack" }));
    await firstAck.promise;
    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:0"));
    expect((screen.getByRole("checkbox", { name: "Select Later selection" }) as HTMLInputElement).checked).toBe(false);
  });

  it("clears a batch failure when selection identity changes and does not revive stale retry authority", async () => {
    getAlertEventPage.mockResolvedValue({ items: [
      event(),
      event({ id: "event-two", alert_key: "c3:2323232323232323232323232323232323232323232323232323232323232323", title: "Partial sibling" }),
      event({ id: "event-three", alert_key: "c3:3434343434343434343434343434343434343434343434343434343434343434", title: "Later unprocessed selection" }),
    ], nextCursor: null });
    patchAlertEvent
      .mockRejectedValueOnce(new Error("captured partial failure"))
      .mockResolvedValueOnce(event({ id: "event-two", state: "ack", title: "Partial sibling" }));
    render(<Harness />);
    await screen.findAllByText("Later unprocessed selection");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select QA gate moved to blocked" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Partial sibling" }));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge controller batch" }));
    await waitFor(() => expect(screen.getByTestId("batch-state").textContent).toContain("captured partial failure"));
    expect(screen.getAllByRole("button", { name: "Retry acknowledgment" })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "Review selection" })[0]!);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Later unprocessed selection" }));
    await waitFor(() => expect(screen.getByTestId("batch-state").textContent).toBe("idle"));
    expect(screen.queryAllByRole("button", { name: "Retry acknowledgment" })).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "clear" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select QA gate moved to blocked" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Later unprocessed selection" }));
    expect(screen.getByTestId("batch-state").textContent).toBe("idle");
    expect(screen.queryAllByRole("button", { name: "Retry acknowledgment" })).toHaveLength(0);
    expect(patchAlertEvent).toHaveBeenCalledTimes(2);
  });

  it("waits for every captured patch to settle before releasing a failed batch fence", async () => {
    const firstAck = deferred<ReturnType<typeof event>>();
    getAlertEventPage.mockResolvedValue({ items: [
      event(),
      event({ id: "event-two", alert_key: "c3:999999999999999999999999999999999999999999999999999999999999", title: "Deferred sibling" }),
    ], nextCursor: null });
    patchAlertEvent
      .mockRejectedValueOnce(new Error("first rejected"))
      .mockReturnValueOnce(firstAck.promise);
    render(<Harness />);
    await screen.findAllByText("Deferred sibling");
    fireEvent.click(screen.getByRole("button", { name: "Select active alerts" }));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge controller batch" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("batch-state").textContent).toBe("pending");
    const clear = screen.getByRole("button", { name: "clear" });
    expect(clear.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(clear);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:2");
    expect(clear.isConnected).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge controller batch" }));
    expect(patchAlertEvent).toHaveBeenCalledTimes(2);

    firstAck.resolve(event({ id: "event-two", state: "ack", title: "Deferred sibling" }));
    await firstAck.promise;
    await waitFor(() => expect(screen.getByTestId("batch-state").textContent).toContain("first rejected"));
    expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:1");
  });

  it("binds partial-failure retry to the failed-only selection left by the open filter", async () => {
    getAlertEventPage.mockResolvedValue({ items: [
      event(),
      event({ id: "event-two", alert_key: "c3:5656565656565656565656565656565656565656565656565656565656565656", title: "Failed open sibling" }),
    ], nextCursor: null });
    patchAlertEvent
      .mockResolvedValueOnce(event({ state: "ack" }))
      .mockRejectedValueOnce(new Error("second open acknowledgment failed"))
      .mockResolvedValueOnce(event({ id: "event-two", state: "ack", title: "Failed open sibling" }));
    render(<Harness />);
    await screen.findAllByText("Failed open sibling");
    fireEvent.click(screen.getByRole("button", { name: "Show open alerts" }));
    fireEvent.click(screen.getByRole("button", { name: "Select active alerts" }));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge controller batch" }));

    await waitFor(() => expect(screen.getByTestId("batch-state").textContent).toContain("second open acknowledgment failed"));
    expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:1");
    expect(screen.queryByRole("checkbox", { name: "Select QA gate moved to blocked" })).toBeNull();
    expect((screen.getByRole("checkbox", { name: "Select Failed open sibling" }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: "Retry acknowledgment" })[0]!);
    await waitFor(() => expect(patchAlertEvent).toHaveBeenNthCalledWith(3, "event-two", "ack", undefined));
    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:0"));
    expect(screen.queryAllByRole("button", { name: "Retry acknowledgment" })).toHaveLength(0);
  });

  it("reconciles the active event when a mutation moves it out of the current filter", async () => {
    getAlertEventPage.mockResolvedValue({ items: [
      event(),
      event({ id: "event-two", alert_key: "c3:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", title: "Still open event" }),
    ], nextCursor: null });
    patchAlertEvent.mockResolvedValue(event({ state: "ack" }));
    render(<Harness />);
    await screen.findAllByText("Still open event");
    fireEvent.click(screen.getByRole("button", { name: "Show open alerts" }));
    expect(screen.getByTestId("active-event").textContent).toBe("event-open");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select QA gate moved to blocked" }));
    expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:1");
    fireEvent.click(screen.getByRole("button", { name: "Mutate first alert" }));
    await waitFor(() => expect(screen.getByTestId("active-event").textContent).toBe("event-two"));
    expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:0");
    expect(screen.getAllByText("Still open event")).toHaveLength(2);
    expect(screen.queryByText("QA gate moved to blocked")).toBeNull();
  });

  it("activates an event when its pending mutation moves it into the current filter", async () => {
    const resolution = deferred<ReturnType<typeof event>>();
    getAlertEventPage.mockResolvedValue({ items: [event()], nextCursor: null });
    patchAlertEvent.mockReturnValueOnce(resolution.promise);
    render(<Harness />);
    await screen.findAllByText("QA gate moved to blocked");
    fireEvent.click(screen.getByRole("button", { name: "Show resolved alerts" }));
    expect(screen.getByTestId("active-event").textContent).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Resolve first alert" }));

    resolution.resolve(event({ state: "resolved", resolution_note: "Reviewed." }));
    await resolution.promise;
    await waitFor(() => expect(screen.getByTestId("active-event").textContent).toBe("event-open"));
    expect(screen.getAllByText("QA gate moved to blocked")).toHaveLength(2);
  });

  it("reconciles active and selected IDs to the current filter after external state drift", async () => {
    const second = event({
      id: "event-two",
      alert_key: "c3:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      title: "Second externally mutable event",
    });
    getAlertEventPage
      .mockResolvedValueOnce({ items: [event(), second], nextCursor: null })
      .mockResolvedValueOnce({ items: [event({ state: "resolved" }), second], nextCursor: null });
    render(<Harness />);
    await screen.findAllByText("Second externally mutable event");
    fireEvent.click(screen.getByRole("button", { name: "Show open alerts" }));
    fireEvent.click(screen.getByRole("button", { name: "Select active alerts" }));
    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:2"));

    fireEvent.click(screen.getByRole("button", { name: "Reload controller" }));
    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:1"));
    expect(screen.getByTestId("active-event").textContent).toBe("event-two");
    expect(screen.queryByRole("checkbox", { name: "Select QA gate moved to blocked" })).toBeNull();
  });

  it("does not allow a hidden event to enter batch selection under the current filter", async () => {
    getAlertEventPage.mockResolvedValue({ items: [
      event(),
      event({ id: "event-ack", alert_key: "c3:4545454545454545454545454545454545454545454545454545454545454545", state: "ack", title: "Hidden acknowledged event" }),
    ], nextCursor: null });
    render(<Harness />);
    await screen.findAllByText("Hidden acknowledged event");
    fireEvent.click(screen.getByRole("button", { name: "Show open alerts" }));
    fireEvent.click(screen.getByRole("button", { name: "Select active alerts" }));
    expect(screen.getByTestId("controller-status").textContent).toBe("ready:2:1");
    expect(screen.getByTestId("active-event").textContent).toBe("event-open");
  });

  it("refuses hidden stale mutations while refreshing and restores prior ready authority after failure", async () => {
    const failedReload = deferred<{ items: never[]; nextCursor: null }>();
    getAlertEventPage
      .mockResolvedValueOnce({ items: [event()], nextCursor: null })
      .mockReturnValueOnce(failedReload.promise);
    patchAlertEvent.mockResolvedValueOnce(event({ state: "ack" }));
    render(<Harness />);
    await screen.findAllByText("QA gate moved to blocked");
    fireEvent.click(screen.getByRole("button", { name: "Select active alerts" }));
    fireEvent.click(screen.getByRole("button", { name: "Reload controller" }));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge controller batch" }));
    await waitFor(() => expect(screen.getByTestId("batch-state").textContent).toContain("authority is not ready"));
    expect(patchAlertEvent).not.toHaveBeenCalled();

    failedReload.reject(new Error("authoritative list failed"));
    await failedReload.promise.catch(() => undefined);
    await waitFor(() => expect(screen.getByTestId("controller-status").textContent).toBe("ready:1:1"));
    expect(screen.getAllByText("authoritative list failed")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Mutate first alert" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenCalledWith("event-open", "ack", undefined));
  });

  it("keeps historical alert load, selection, mutation, and refresh available while rule activation is off or unverifiable", async () => {
    const cases: Array<{
      label: string;
      settings: unknown;
      rejects?: boolean;
      availability: "disabled" | "unavailable";
    }> = [
      {
        label: "rules default off",
        settings: { features: { alert_rules_v1_enabled: false } },
        availability: "disabled",
      },
      {
        label: "settings snapshot unavailable",
        settings: new Error("workspace configuration offline"),
        rejects: true,
        availability: "unavailable",
      },
    ];

    for (const scenario of cases) {
      cleanup();
      vi.clearAllMocks();
      getSettings.mockReset();
      getAlertEventPage.mockReset();
      getWatchRulePage.mockReset();
      patchAlertEvent.mockReset();
      if (scenario.rejects) getSettings.mockRejectedValue(scenario.settings);
      else getSettings.mockResolvedValue(scenario.settings);
      getAlertEventPage
        .mockResolvedValueOnce({ items: [event()], nextCursor: null })
        .mockResolvedValueOnce({ items: [event({ state: "ack" })], nextCursor: null });
      patchAlertEvent.mockResolvedValue(event({ state: "ack" }));

      render(<ActivationHarness />);

      await waitFor(() => expect(screen.getByTestId("activation-alert-status").textContent, scenario.label).toBe("ready:1:0"));
      expect(screen.getByTestId("activation-rule-availability").textContent, scenario.label).toBe(scenario.availability);
      expect(getSettings, scenario.label).toHaveBeenCalledOnce();
      expect(getWatchRulePage, scenario.label).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Select historical alert" }));
      await waitFor(() => expect(screen.getByTestId("activation-alert-status").textContent, scenario.label).toBe("ready:1:1"));
      fireEvent.click(screen.getByRole("button", { name: "Acknowledge historical alert" }));
      await waitFor(() => expect(patchAlertEvent, scenario.label).toHaveBeenCalledWith("event-open", "ack", undefined));
      await waitFor(() => expect(screen.getByTestId("activation-alert-state").textContent, scenario.label).toBe("ack"));

      fireEvent.click(screen.getByRole("button", { name: "Refresh historical alerts" }));
      await waitFor(() => expect(getAlertEventPage, scenario.label).toHaveBeenCalledTimes(2));
      expect(screen.getByTestId("activation-alert-status").textContent, scenario.label).toMatch(/^ready:1:/);
      expect(getWatchRulePage, scenario.label).not.toHaveBeenCalled();
    }
  });
});
