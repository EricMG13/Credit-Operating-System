// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DecisionRoomDrawer } from "./DecisionRoomDrawer";
import { createDecision, getDecisions } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getDecisions: vi.fn(), createDecision: vi.fn(), voteDecision: vi.fn(),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("captures the thesis in an immutable decision snapshot", async () => {
  vi.mocked(getDecisions).mockResolvedValue([]);
  vi.mocked(createDecision).mockResolvedValue({
    id: "d", issuer_id: "i", run_id: "r", report_id: "snapshot", action: "approve",
    status: "active", conditions: [], expiry: null, snapshot: { thesis_md: "Defensible." },
    snapshot_sha256: "a".repeat(64), created_by: "a", reopened_at: null,
    reopen_alert_key: null, created_at: "2026-07-12T00:00:00Z", votes: [],
  });
  render(<DecisionRoomDrawer issuerId="i" runId="run-12345678" reportId="snapshot" onClose={() => undefined} />);
  fireEvent.change(screen.getByLabelText("THESIS SNAPSHOT"), { target: { value: "Defensible." } });
  fireEvent.click(screen.getByText("CAPTURE DECISION"));
  await waitFor(() => expect(createDecision).toHaveBeenCalledWith(expect.objectContaining({
    issuer_id: "i", run_id: "run-12345678", snapshot: { thesis_md: "Defensible." },
  })));
  expect(await screen.findByText(/SHA aaaaaaaaaa/)).toBeTruthy();
});
