// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DecisionRoomDrawer } from "./DecisionRoomDrawer";
import { createDecision, getDecisions, voteDecision, type IcDecision } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getDecisions: vi.fn(), createDecision: vi.fn(), voteDecision: vi.fn(),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const decision = (overrides: Partial<IcDecision> = {}): IcDecision => ({
  id: "d", issuer_id: "i", run_id: "r", report_id: "snapshot", action: "approve",
  status: "active", conditions: [], expiry: null, snapshot: { thesis_md: "Defensible." },
  snapshot_sha256: "a".repeat(64), created_by: "a", reopened_at: null,
  reopen_alert_key: null, created_at: "2026-07-12T00:00:00Z", votes: [],
  ...overrides,
});

it("captures the thesis in an immutable decision snapshot", async () => {
  vi.mocked(getDecisions).mockResolvedValue([]);
  vi.mocked(createDecision).mockResolvedValue(decision({ action: "revisit" }));
  render(<DecisionRoomDrawer issuerId="i" runId="run-12345678" reportId="snapshot" onClose={() => undefined} />);
  fireEvent.click(screen.getByRole("button", { name: "REVISIT" }));
  fireEvent.change(screen.getByLabelText("THESIS SNAPSHOT"), { target: { value: "  Defensible.  " } });
  fireEvent.change(screen.getByLabelText("CONDITIONS · ONE PER LINE"), { target: { value: " First lien only \n\n  Monthly reporting " } });
  fireEvent.change(screen.getByLabelText("EXPIRY"), { target: { value: "2026-12-31" } });
  fireEvent.click(screen.getByRole("button", { name: "Record IC decision" }));
  await waitFor(() => expect(createDecision).toHaveBeenCalledWith(expect.objectContaining({
    issuer_id: "i", run_id: "run-12345678", action: "revisit",
    conditions: ["First lien only", "Monthly reporting"], expiry: "2026-12-31",
    snapshot: { thesis_md: "Defensible." },
  })));
  expect(await screen.findByText(/SHA aaaaaaaaaa/)).toBeTruthy();
  expect((screen.getByLabelText("THESIS SNAPSHOT") as HTMLTextAreaElement).value).toBe("");
  expect((screen.getByLabelText("CONDITIONS · ONE PER LINE") as HTMLTextAreaElement).value).toBe("");
});

it("loads decision history and records approve, abstain, and dissent votes", async () => {
  const first = decision({ id: "d-1", snapshot: { thesis_md: "Thesis A" } });
  const second = decision({ id: "d-2", action: "decline", snapshot: {} });
  vi.mocked(getDecisions).mockResolvedValue([first, second]);
  vi.mocked(voteDecision)
    .mockResolvedValueOnce(decision({ ...first, votes: [{ id: "v-1", member: "a", vote: "approve", dissent_note: null, created_at: "2026-07-12T01:00:00Z" }] }))
    .mockResolvedValueOnce(decision({ ...first, votes: [{ id: "v-2", member: "b", vote: "abstain", dissent_note: null, created_at: "2026-07-12T02:00:00Z" }] }))
    .mockResolvedValueOnce(decision({ ...first, votes: [{ id: "v-3", member: "c", vote: "dissent", dissent_note: "Refinancing risk", created_at: "2026-07-12T03:00:00Z" }] }));

  render(<DecisionRoomDrawer issuerId="i" runId="run-12345678" onClose={() => undefined} />);
  expect(await screen.findByText("Thesis A")).toBeTruthy();
  expect(screen.getByText("No thesis text")).toBeTruthy();

  fireEvent.click(screen.getAllByRole("button", { name: "APPROVE" })[1]);
  await waitFor(() => expect(voteDecision).toHaveBeenNthCalledWith(1, "d-1", "approve", undefined));

  fireEvent.click(screen.getAllByRole("button", { name: "ABSTAIN" })[0]);
  await waitFor(() => expect(voteDecision).toHaveBeenNthCalledWith(2, "d-1", "abstain", undefined));

  fireEvent.change(screen.getAllByLabelText("Dissent rationale")[0], { target: { value: "Refinancing risk" } });
  fireEvent.click(screen.getAllByRole("button", { name: "DISSENT" })[0]);
  await waitFor(() => expect(voteDecision).toHaveBeenNthCalledWith(3, "d-1", "dissent", "Refinancing risk"));
  await waitFor(() => expect((screen.getAllByLabelText("Dissent rationale")[0] as HTMLInputElement).value).toBe(""));
});

it("surfaces history and vote failures", async () => {
  vi.mocked(getDecisions).mockRejectedValueOnce(new Error("offline"));
  const first = render(<DecisionRoomDrawer issuerId="i" runId="run-12345678" onClose={() => undefined} />);
  expect((await screen.findByRole("alert")).textContent).toBe("Couldn’t load prior decisions.");
  first.unmount();

  vi.mocked(getDecisions).mockResolvedValueOnce([decision()]);
  vi.mocked(voteDecision).mockRejectedValueOnce(new Error("conflict"));
  render(<DecisionRoomDrawer issuerId="i" runId="run-12345678" onClose={() => undefined} />);
  await screen.findByText("Defensible.");
  fireEvent.click(screen.getAllByRole("button", { name: "APPROVE" })[1]);
  expect((await screen.findByRole("alert")).textContent).toBe("Vote could not be recorded.");
});

it.each([
  { label: "string response detail", failure: { response: { data: { detail: "Policy conflict." } } }, message: "Policy conflict." },
  { label: "nested response message", failure: { response: { data: { detail: { message: "QA blocked." } } } }, message: "QA blocked." },
  { label: "generic transport error", failure: new Error("network"), message: "Decision capture failed." },
])("shows the available decision-capture error detail: $label", async ({ failure, message }) => {
  vi.mocked(getDecisions).mockResolvedValue([]);
  vi.mocked(createDecision).mockRejectedValue(failure);
  render(<DecisionRoomDrawer issuerId="i" runId="run-12345678" onClose={() => undefined} />);
  fireEvent.change(screen.getByLabelText("THESIS SNAPSHOT"), { target: { value: "Thesis" } });
  fireEvent.click(screen.getByRole("button", { name: "Record IC decision" }));
  expect((await screen.findByRole("alert")).textContent).toBe(message);
});
