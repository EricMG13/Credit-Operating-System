// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const EVENT = {
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
} as const;

function Harness() {
  const controller = usePersistedMonitorController();
  return <AlertInbox controller={controller} />;
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
