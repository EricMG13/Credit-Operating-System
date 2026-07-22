// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AlertEventDTO } from "@/lib/api";
import { PhoneTriage } from "./PhoneTriage";
import { usePersistedMonitorController } from "./usePersistedMonitorController";

const getAlertEventPage = vi.fn();
const getWatchRulePage = vi.fn();
const getChunk = vi.fn();
const getQA = vi.fn();
const patchAlertEvent = vi.fn();
const forbiddenDraft = vi.fn();
const forbiddenLegacyStates = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getAlertEventPage: async (...args: unknown[]) => ({ canMutate: true, ...await getAlertEventPage(...args) }),
  getWatchRulePage: (...args: unknown[]) => getWatchRulePage(...args),
  getChunk: (...args: unknown[]) => getChunk(...args),
  getQA: (...args: unknown[]) => getQA(...args),
  patchAlertEvent: (...args: unknown[]) => patchAlertEvent(...args),
  getAutonomyDraft: (...args: unknown[]) => forbiddenDraft(...args),
  getAlertStates: (...args: unknown[]) => forbiddenLegacyStates(...args),
}));

function persistedEvent(overrides: Partial<AlertEventDTO> = {}): AlertEventDTO {
  return {
    id: "alert-1",
    alert_key: "c3:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    issuer_id: "issuer-17",
    run_id: "run-17",
    kind: "qa_change",
    title: "QA gate moved to blocked",
    impact: "Review the governed evidence before committee.",
    evidence: { observed_at: "2026-07-20T10:00:00Z" },
    authority: { watch_rule_id: "rule-1", rule_version: 2 },
    state: "open",
    assignee: null,
    note: null,
    resolved_at: null,
    resolution_note: null,
    created_at: "2026-07-20T10:01:00Z",
    updated_at: "2026-07-20T10:01:00Z",
    ...overrides,
  };
}

function Harness({ initialActive = null }: { initialActive?: string | null }) {
  const controller = usePersistedMonitorController(initialActive);
  return (
    <>
      <output data-testid="active">{controller.activeEventId ?? "none"}</output>
      <output data-testid="batch">{controller.selectedIds.join(",") || "none"}</output>
      <button type="button" onClick={() => {
        if (controller.activeEventId) controller.toggleSelected(controller.activeEventId);
      }}>Toggle active for batch</button>
      <button type="button" className="min-h-11" onClick={() => void controller.refresh({ preserveReadyView: true })}>Refresh persisted alerts</button>
      <PhoneTriage controller={controller} />
    </>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  getAlertEventPage.mockReset();
  getWatchRulePage.mockReset();
  getChunk.mockReset();
  getQA.mockReset();
  patchAlertEvent.mockReset();
  forbiddenDraft.mockReset();
  forbiddenLegacyStates.mockReset();
  getAlertEventPage.mockResolvedValue({ items: [], nextCursor: null });
  getWatchRulePage.mockResolvedValue({ items: [], nextCursor: null });
  getChunk.mockResolvedValue({ id: "chunk-default", text: "Persisted evidence." });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PhoneTriage · persisted controller", () => {
  it("distinguishes an unavailable persisted read from a settled empty worklist", async () => {
    getAlertEventPage.mockRejectedValueOnce(new Error("network error"));
    const unavailable = render(<Harness />);
    expect(await screen.findByText("Persisted alert events unavailable")).toBeTruthy();
    expect(screen.getByText("network error")).toBeTruthy();
    expect(screen.queryByText(/autonomy/i)).toBeNull();
    unavailable.unmount();

    getAlertEventPage.mockResolvedValueOnce({ items: [], nextCursor: null });
    render(<Harness />);
    expect(await screen.findByText("No persisted alerts to triage")).toBeTruthy();
  });

  it("shows one persisted event at a time and keeps navigation separate from batch selection", async () => {
    getAlertEventPage.mockResolvedValue({
      items: [
        persistedEvent(),
        persistedEvent({ id: "alert-2", issuer_id: null, title: "Unscoped covenant event", kind: "covenant" }),
      ],
      nextCursor: null,
    });
    render(<Harness />);

    expect(await screen.findByText("QA gate moved to blocked")).toBeTruthy();
    expect(screen.getByText("1 of 2")).toBeTruthy();
    expect(screen.queryByText("Unscoped covenant event")).toBeNull();
    expect(screen.getByTestId("batch").textContent).toBe("none");

    fireEvent.click(screen.getByRole("button", { name: "Next alert" }));
    expect(await screen.findByText("Unscoped covenant event")).toBeTruthy();
    expect(screen.getByTestId("active").textContent).toBe("alert-2");
    expect(screen.getByTestId("batch").textContent).toBe("none");
    expect(screen.getByText("Unscoped alert")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Toggle active for batch" }));
    expect(screen.getByTestId("batch").textContent).toBe("alert-2");
  });

  it("opens governed run evidence on phone when automatic alerts carry run and QA-finding refs", async () => {
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent({
      kind: "run_finding",
      evidence: {
        observed_at: "2026-07-20T10:00:00Z",
        detail: { run_id: "run-17", finding_row_id: "row-17", finding_id: "CP5-PHONE" },
        source_artifact_refs: ["run:run-17", "qa_finding:row-17"],
      },
    })], nextCursor: null });
    getQA.mockResolvedValue({
      run_id: "run-17",
      qa_status: "Blocked",
      committee_status: "Not Ready",
      findings_by_severity: { MATERIAL: 1 },
      findings: [{ finding_id: "CP5-PHONE", severity: "MATERIAL", lane: 5, module_id: "CP-5", description: "Phone governed evidence.", affected_claim_id: null, required_remediation: null }],
    });
    render(<Harness />);

    const source = await screen.findByRole("button", { name: "Open source run:run-17" });
    expect(source.className).toContain("min-h-11");
    fireEvent.click(source);

    expect(await screen.findByText(/Run run-17 · QA Blocked · committee Not Ready/)).toBeTruthy();
    expect(screen.getByText(/CP5-PHONE · MATERIAL · Phone governed evidence/)).toBeTruthy();
    expect(getQA).toHaveBeenCalledWith("run-17");
  });

  it("hydrates a resolved deep link without granting it batch-action authority", async () => {
    getAlertEventPage.mockResolvedValue({
      items: [
        persistedEvent(),
        persistedEvent({ id: "alert-resolved", title: "Resolved persisted event", state: "resolved", resolution_note: "Reviewed." }),
      ],
      nextCursor: null,
    });
    render(<Harness initialActive="alert-resolved" />);

    expect(await screen.findByText("Resolved persisted event")).toBeTruthy();
    expect(screen.getByTestId("active").textContent).toBe("alert-resolved");
    fireEvent.click(screen.getByRole("button", { name: "Toggle active for batch" }));
    expect(screen.getByTestId("batch").textContent).toBe("none");
    expect(screen.queryByRole("button", { name: "Ack" })).toBeNull();
  });

  it("acknowledges, assigns, and resolves through the persisted event endpoint with phone-sized targets", async () => {
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent({ evidence: { chunk_id: "chunk-phone" } })], nextCursor: null });
    patchAlertEvent.mockImplementation(async (
      id: string,
      state: AlertEventDTO["state"],
      options?: { assignee?: string; resolutionNote?: string },
    ) => persistedEvent({ id, state, assignee: options?.assignee ?? null, resolution_note: options?.resolutionNote ?? null }));
    render(<Harness />);
    await screen.findByText("QA gate moved to blocked");

    const assignee = screen.getByLabelText("Alert assignee");
    fireEvent.change(assignee, { target: { value: "Sam" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenNthCalledWith(1, "alert-1", "open", { assignee: "Sam" }));
    expect(await screen.findByText("Sam")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ack" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenNthCalledWith(2, "alert-1", "ack", undefined));
    expect(await screen.findByText("Acknowledged")).toBeTruthy();

    for (const target of screen.getAllByRole("button").concat(screen.getAllByRole("link"))) {
      if (target.textContent === "Toggle active for batch") continue;
      expect(target.className).toContain("min-h-11");
    }
    expect(screen.getByLabelText("Alert state filter").className).toContain("min-h-11");

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    fireEvent.change(screen.getByLabelText("Alert resolution note"), { target: { value: "Reviewed." } });
    const confirm = screen.getByRole("button", { name: "Confirm" });
    confirm.focus();
    fireEvent.click(confirm);
    await waitFor(() => expect(patchAlertEvent).toHaveBeenNthCalledWith(3, "alert-1", "resolved", { resolutionNote: "Reviewed." }));
    expect(await screen.findByText("Resolved")).toBeTruthy();
    const article = screen.getByRole("article", { name: "Persisted alert QA gate moved to blocked" });
    await waitFor(() => expect(document.activeElement).toBe(article));
    expect(screen.getByText("QA gate moved to blocked resolved. Persisted workflow state updated.").getAttribute("role")).toBe("status");
  });

  it("preserves failed mutation input, fences rapid duplicates, and retries the current phone intent", async () => {
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent()], nextCursor: null });
    patchAlertEvent
      .mockRejectedValueOnce(new Error("optimistic conflict"))
      .mockResolvedValueOnce(persistedEvent({ assignee: "Priya" }));
    render(<Harness />);
    await screen.findByText("QA gate moved to blocked");

    const assignee = screen.getByLabelText("Alert assignee") as HTMLInputElement;
    fireEvent.change(assignee, { target: { value: "Sam" } });
    const assign = screen.getByRole("button", { name: "Assign" });
    fireEvent.click(assign);
    fireEvent.click(assign);
    expect(await screen.findByText(/optimistic conflict.*Input was preserved/)).toBeTruthy();
    expect(patchAlertEvent).toHaveBeenCalledTimes(1);
    expect(assignee.value).toBe("Sam");

    fireEvent.change(assignee, { target: { value: "Priya" } });
    expect(screen.getByRole("alert").textContent).toMatch(/retry submits the current draft/i);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenCalledTimes(2));
    expect(patchAlertEvent).toHaveBeenNthCalledWith(2, "alert-1", "open", { assignee: "Priya" });
    expect(await screen.findByText("Priya")).toBeTruthy();
    await waitFor(() => expect(assignee.value).toBe(""));
    expect(forbiddenDraft).not.toHaveBeenCalled();
    expect(forbiddenLegacyStates).not.toHaveBeenCalled();
  });

  it("states that input is preserved when a phone Ack transition can be retried", async () => {
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent()], nextCursor: null });
    patchAlertEvent.mockRejectedValueOnce(new Error("phone acknowledgment unavailable"));
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

  it("drops phone retry and draft custody after a successful authoritative refresh of the same row", async () => {
    getAlertEventPage
      .mockResolvedValueOnce({ items: [persistedEvent()], nextCursor: null })
      .mockResolvedValueOnce({ items: [persistedEvent({ updated_at: "2026-07-20T10:05:00Z" })], nextCursor: null });
    patchAlertEvent
      .mockRejectedValueOnce(new Error("stale phone assignment"))
      .mockResolvedValueOnce(persistedEvent({ assignee: "Fresh analyst" }));
    render(<Harness />);
    const input = await screen.findByLabelText("Alert assignee") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Stale analyst" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    expect((await screen.findByRole("alert")).textContent).toContain("stale phone assignment");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Refresh persisted alerts" }));
    await waitFor(() => expect(getAlertEventPage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(input.value).toBe("");
    expect(patchAlertEvent).toHaveBeenCalledOnce();

    fireEvent.change(input, { target: { value: "Fresh analyst" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenNthCalledWith(2, "alert-1", "open", { assignee: "Fresh analyst" }));
  });

  it("keeps phone retry and current draft mounted when a preserve-view refresh fails", async () => {
    getAlertEventPage
      .mockResolvedValueOnce({ items: [persistedEvent()], nextCursor: null })
      .mockRejectedValueOnce(new Error("phone refresh unavailable"));
    patchAlertEvent
      .mockRejectedValueOnce(new Error("recoverable phone assignment"))
      .mockResolvedValueOnce(persistedEvent({ assignee: "Recoverable analyst" }));
    render(<Harness />);
    const input = await screen.findByLabelText("Alert assignee") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Recoverable analyst" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    expect((await screen.findByRole("alert")).textContent).toContain("recoverable phone assignment");

    fireEvent.click(screen.getByRole("button", { name: "Refresh persisted alerts" }));
    await waitFor(() => expect(getAlertEventPage).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Alert assignee")).toBe(input);
    expect(input.value).toBe("Recoverable analyst");
    expect(screen.getByRole("alert").textContent).toContain("recoverable phone assignment");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenNthCalledWith(2, "alert-1", "open", { assignee: "Recoverable analyst" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect((screen.getByLabelText("Alert state filter") as HTMLSelectElement).disabled).toBe(false);
  });

  it("locks phone assignee and resolution drafts until each submitted request settles", async () => {
    const assignment = deferred<AlertEventDTO>();
    const resolution = deferred<AlertEventDTO>();
    const sibling = persistedEvent({ id: "alert-2", title: "Sibling pending navigation" });
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent(), sibling], nextCursor: null });
    patchAlertEvent
      .mockReturnValueOnce(assignment.promise)
      .mockReturnValueOnce(resolution.promise);
    render(<Harness />);
    const assignee = await screen.findByLabelText("Alert assignee") as HTMLInputElement;
    fireEvent.change(assignee, { target: { value: "Alice" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(assignee.disabled).toBe(true));
    expect(patchAlertEvent).toHaveBeenNthCalledWith(1, "alert-1", "open", { assignee: "Alice" });
    expect((screen.getByLabelText("Alert state filter") as HTMLSelectElement).disabled).toBe(true);
    const next = screen.getByRole("button", { name: "Next alert" });
    expect(next.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(next);
    expect(screen.getByText("QA gate moved to blocked")).toBeTruthy();
    expect(screen.queryByText("Sibling pending navigation")).toBeNull();

    assignment.resolve(persistedEvent({ assignee: "Alice" }));
    await assignment.promise;
    await waitFor(() => expect(assignee.value).toBe(""));

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    const note = screen.getByLabelText("Alert resolution note") as HTMLInputElement;
    fireEvent.change(note, { target: { value: "Captured phone note" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(note.disabled).toBe(true));
    expect(patchAlertEvent).toHaveBeenNthCalledWith(2, "alert-1", "resolved", { resolutionNote: "Captured phone note" });

    resolution.resolve(persistedEvent({ state: "resolved", resolution_note: "Captured phone note" }));
    await resolution.promise;
    await waitFor(() => expect(screen.queryByLabelText("Alert resolution note")).toBeNull());
  });

  it("reloads a phone lifecycle conflict before another action and never retries the stale transition", async () => {
    const reload = deferred<{ items: AlertEventDTO[]; nextCursor: null }>();
    getAlertEventPage
      .mockResolvedValueOnce({ items: [persistedEvent()], nextCursor: null })
      .mockReturnValueOnce(reload.promise);
    patchAlertEvent
      .mockRejectedValueOnce({ response: { status: 409, data: { detail: "Cannot move alert state backward: ack -> open." } } })
      .mockResolvedValueOnce(persistedEvent({ state: "ack", assignee: "Sam" }));
    render(<Harness />);
    await screen.findByText("QA gate moved to blocked");

    const assignee = screen.getByLabelText("Alert assignee") as HTMLInputElement;
    fireEvent.change(assignee, { target: { value: "Sam" } });
    const assign = screen.getByRole("button", { name: "Assign" });
    fireEvent.click(assign);

    await waitFor(() => expect(getAlertEventPage).toHaveBeenCalledTimes(2));
    expect(assign.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(assign);
    expect(patchAlertEvent).toHaveBeenCalledTimes(1);

    reload.resolve({ items: [persistedEvent({ state: "ack", assignee: "other.analyst" })], nextCursor: null });
    const conflictCopy = await screen.findByText(/Persisted events were reloaded/);
    expect(conflictCopy.closest('[role="alert"]')?.textContent).not.toMatch(/retry submits the current draft/i);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByLabelText("Alert assignee")).toBe(assignee);
    expect(assignee.value).toBe("Sam");

    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenNthCalledWith(2, "alert-1", "ack", { assignee: "Sam" }));
  });

  it("preserves phone input and exposes only persisted reload authority after conflict reconciliation fails", async () => {
    getAlertEventPage
      .mockResolvedValueOnce({ items: [persistedEvent()], nextCursor: null })
      .mockRejectedValueOnce(new Error("phone reconciliation unavailable"))
      .mockResolvedValueOnce({ items: [persistedEvent({ state: "ack", assignee: "other.analyst" })], nextCursor: null });
    patchAlertEvent.mockRejectedValueOnce({ response: { status: 409, data: { detail: "Cannot move ack alert back to open." } } });
    render(<Harness />);
    await screen.findByText("QA gate moved to blocked");

    const assignee = screen.getByLabelText("Alert assignee") as HTMLInputElement;
    fireEvent.change(assignee, { target: { value: "Sam" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));

    expect(await screen.findByText(/authoritative reload could not be confirmed/i)).toBeTruthy();
    expect(assignee.value).toBe("Sam");
    expect(screen.getByRole("button", { name: "Assign" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reload persisted alerts" }));

    expect(await screen.findByText(/Persisted events were reloaded/)).toBeTruthy();
    expect(assignee.value).toBe("Sam");
    expect(screen.getByRole("button", { name: "Assign" }).getAttribute("aria-disabled")).toBeNull();
    expect(patchAlertEvent).toHaveBeenCalledTimes(1);
  });

  it("keeps persisted reload authority reachable when the current phone filter has no event", async () => {
    getAlertEventPage
      .mockResolvedValueOnce({ items: [persistedEvent()], nextCursor: null })
      .mockRejectedValueOnce(new Error("phone reconciliation unavailable"))
      .mockResolvedValueOnce({ items: [persistedEvent({ state: "resolved", resolution_note: "Resolved elsewhere." })], nextCursor: null });
    patchAlertEvent.mockRejectedValueOnce({ response: { status: 409, data: { detail: "Alert lifecycle changed." } } });
    render(<Harness />);
    await screen.findByText("QA gate moved to blocked");
    fireEvent.change(screen.getByLabelText("Alert assignee"), { target: { value: "Sam" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    expect(await screen.findByText(/authoritative reload could not be confirmed/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Alert state filter"), { target: { value: "resolved" } });
    expect(await screen.findByText("No resolved alerts to triage")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reload persisted alerts" }));

    expect(await screen.findByText("resolved: Resolved elsewhere.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reload persisted alerts" })).toBeNull();
    expect(patchAlertEvent).toHaveBeenCalledTimes(1);
  });

  it("retains failed action custody until dismissal, then resets local state when phone navigation changes events", async () => {
    const second = persistedEvent({
      id: "alert-2",
      alert_key: "c3:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      issuer_id: "issuer-22",
      title: "Second phone event",
      evidence: { chunk_id: "chunk-b" },
    });
    getAlertEventPage.mockResolvedValue({
      items: [persistedEvent({ evidence: { chunk_id: "chunk-a" } }), second],
      nextCursor: null,
    });
    getChunk
      .mockResolvedValueOnce({ id: "chunk-a", text: "Evidence for alert A only." })
      .mockResolvedValueOnce({ id: "chunk-b", text: "Evidence for alert B only." });
    patchAlertEvent
      .mockRejectedValueOnce(new Error("alert A assignment failed"))
      .mockResolvedValueOnce(second);
    render(<Harness />);
    await screen.findByText("QA gate moved to blocked");

    fireEvent.click(screen.getByText("Open persisted source"));
    expect(await screen.findByText("Evidence for alert A only.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Alert assignee"), { target: { value: "Analyst A" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    expect(await screen.findByText(/alert A assignment failed.*Input was preserved/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();

    const next = screen.getByRole("button", { name: "Next alert" });
    expect(next.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(next);
    expect(screen.getByText("QA gate moved to blocked")).toBeTruthy();
    expect(screen.getByText(/alert A assignment failed/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    fireEvent.click(screen.getByRole("button", { name: "Next alert" }));
    expect(await screen.findByText("Second phone event")).toBeTruthy();
    expect(screen.queryByText("Evidence for alert A only.")).toBeNull();
    expect(screen.queryByText(/alert A assignment failed/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect((screen.getByLabelText("Alert assignee") as HTMLInputElement).value).toBe("");

    fireEvent.click(screen.getByText("Open persisted source"));
    expect(await screen.findByText("Evidence for alert B only.")).toBeTruthy();
    expect(getChunk).toHaveBeenNthCalledWith(2, "chunk-b");
    fireEvent.change(screen.getByLabelText("Alert assignee"), { target: { value: "Analyst B" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenNthCalledWith(2, "alert-2", "open", { assignee: "Analyst B" }));
  });
});
