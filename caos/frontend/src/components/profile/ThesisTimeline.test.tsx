// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ThesisTimeline } from "./ThesisTimeline";
import { createThesisVersion, getThesisVersions, realizeThesisPrediction } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getThesisVersions: vi.fn(), createThesisVersion: vi.fn(), realizeThesisPrediction: vi.fn(),
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

it("recovers history loading and realizes an outstanding prediction", async () => {
  vi.mocked(getThesisVersions)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce([{
      id: "t2", issuer_id: "i", version: 2, thesis_md: "Margin recovery",
      trigger: "alert", linked_decision_id: null, linked_alert_key: null,
      created_by: "a", created_at: "2026-07-13T00:00:00Z",
      predictions: [
        { id: "p1", metric: "EBITDA", horizon: "2026-12-31", predicted: 450, realized: null },
        { id: "p2", metric: "Revenue", horizon: "2026-12-31", predicted: 1000, realized: 990 },
      ],
    }]);
  vi.mocked(realizeThesisPrediction).mockResolvedValue({
    id: "p1", metric: "EBITDA", horizon: "2026-12-31", predicted: 450, realized: 442,
  });

  render(<ThesisTimeline issuerId="i"><span>Current thesis</span></ThesisTimeline>);
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Margin recovery")).toBeTruthy();
  expect(screen.getByText("990")).toBeTruthy();

  const realized = screen.getByRole("spinbutton", { name: "Realized EBITDA" }) as HTMLInputElement;
  const set = screen.getByRole("button", { name: "SET" }) as HTMLButtonElement;
  expect(set.disabled).toBe(true);
  fireEvent.change(realized, { target: { value: "not-a-number" } });
  expect(set.disabled).toBe(true);
  fireEvent.change(realized, { target: { value: "442" } });
  fireEvent.click(set);
  expect(await screen.findByText("442")).toBeTruthy();
});

it("saves a predicted thesis, handles a failed save, and toggles editing", async () => {
  vi.mocked(getThesisVersions).mockResolvedValue([]);
  vi.mocked(createThesisVersion)
    .mockRejectedValueOnce(new Error("save failed"))
    .mockResolvedValueOnce({
      id: "t3", issuer_id: "i", version: 3, thesis_md: "Refinancing closes",
      trigger: "manual", linked_decision_id: null, linked_alert_key: null,
      created_by: "a", created_at: "2026-07-17T00:00:00Z",
      predictions: [{ id: "p3", metric: "Leverage", horizon: "2027-01-01", predicted: 5.2, realized: null }],
    });
  render(<ThesisTimeline issuerId="i" />);
  await screen.findByText(/No thesis version/);
  fireEvent.click(screen.getByRole("button", { name: "+ VERSION" }));
  const initiallyDisabled = screen.getByRole("button", { name: "SAVE VERSION" }) as HTMLButtonElement;
  initiallyDisabled.disabled = false;
  fireEvent.click(initiallyDisabled);
  expect(createThesisVersion).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("New thesis version"), { target: { value: "Refinancing closes" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Prediction metric" }), { target: { value: "Leverage" } });
  fireEvent.change(screen.getByLabelText("Prediction horizon"), { target: { value: "2027-01-01" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Predicted value" }), { target: { value: "5.2" } });
  fireEvent.click(screen.getByRole("button", { name: "SAVE VERSION" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "SAVE VERSION" }));
  expect(await screen.findByText("Refinancing closes")).toBeTruthy();
  expect(createThesisVersion).toHaveBeenLastCalledWith(expect.objectContaining({
    predictions: [{ metric: "Leverage", horizon: "2027-01-01", predicted: 5.2 }],
  }));

  fireEvent.click(screen.getByRole("button", { name: "+ VERSION" }));
  fireEvent.click(screen.getByRole("button", { name: "CANCEL" }));
  expect(screen.queryByLabelText("New thesis version")).toBeNull();
});
