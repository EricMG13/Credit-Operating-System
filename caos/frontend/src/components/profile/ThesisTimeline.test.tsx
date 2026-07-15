// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ThesisTimeline } from "./ThesisTimeline";
import { createThesisVersion, getThesisVersions } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getThesisVersions: vi.fn(), createThesisVersion: vi.fn(),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("renders history and appends a manual version", async () => {
  vi.mocked(getThesisVersions).mockResolvedValue([]);
  vi.mocked(createThesisVersion).mockResolvedValue({
    id: "t1", issuer_id: "i", version: 1, thesis_md: "Debt paydown remains on track.",
    trigger: "manual", linked_decision_id: null, linked_alert_key: null,
    created_by: "a", created_at: "2026-07-12T00:00:00Z", predictions: [],
  });
  render(<ThesisTimeline issuerId="i" />);
  await screen.findByText(/No thesis version/);
  fireEvent.click(screen.getByText("+ VERSION"));
  fireEvent.change(screen.getByLabelText("New thesis version"), { target: { value: "Debt paydown remains on track." } });
  fireEvent.click(screen.getByText("SAVE VERSION"));
  await waitFor(() => expect(createThesisVersion).toHaveBeenCalled());
  expect(await screen.findByText("Debt paydown remains on track.")).toBeTruthy();
});
