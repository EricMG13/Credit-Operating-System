// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AlertEventDTO } from "@/lib/api";
import { PhoneTriage } from "./PhoneTriage";
import { usePersistedMonitorController } from "./usePersistedMonitorController";

const getAlertEventPage = vi.fn();
const getWatchRulePage = vi.fn();
const getChunk = vi.fn();
const patchAlertEvent = vi.fn();
const forbiddenDraft = vi.fn();
const forbiddenLegacyStates = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getAlertEventPage: (...args: unknown[]) => getAlertEventPage(...args),
  getWatchRulePage: (...args: unknown[]) => getWatchRulePage(...args),
  getChunk: (...args: unknown[]) => getChunk(...args),
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
      <PhoneTriage controller={controller} />
    </>
  );
}

beforeEach(() => {
  getAlertEventPage.mockReset();
  getWatchRulePage.mockReset();
  getChunk.mockReset();
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

  it("preserves failed mutation input, fences rapid duplicates, and retries the same intent", async () => {
    getAlertEventPage.mockResolvedValue({ items: [persistedEvent()], nextCursor: null });
    patchAlertEvent
      .mockRejectedValueOnce(new Error("optimistic conflict"))
      .mockResolvedValueOnce(persistedEvent({ assignee: "Sam" }));
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

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(patchAlertEvent).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Sam")).toBeTruthy();
    await waitFor(() => expect(assignee.value).toBe(""));
    expect(forbiddenDraft).not.toHaveBeenCalled();
    expect(forbiddenLegacyStates).not.toHaveBeenCalled();
  });

  it("resets evidence, input, failure, and retry identity when phone navigation changes events", async () => {
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
