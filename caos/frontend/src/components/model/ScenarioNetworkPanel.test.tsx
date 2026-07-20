// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScenarioNetworkPanel } from "./ScenarioNetworkPanel";
import { propagateScenario } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  propagateScenario: vi.fn(),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const scenarioResult = (runId: string, label: string, ebitdaPct = -0.2) => ({
  shock: { issuer_id: "i", run_id: runId, ebitda_pct: ebitdaPct, rate_bps: 0 },
  source: {
    run_status: "complete", qa_status: "Restricted", committee_status: "Restricted",
    included_modules: ["CP-1", "CP-3"], excluded_modules: ["CP-2E"],
  },
  nodes: [
    { node: "stress" as const, status: "computed" as const, value: 80, label, basis: "CP-1" },
  ],
});

it("renders computed and degraded nodes with text status, not color alone", async () => {
  vi.mocked(propagateScenario).mockResolvedValue({
    shock: { issuer_id: "i", run_id: "r", ebitda_pct: -0.2, rate_bps: 0 },
    source: {
      run_status: "complete", qa_status: "Restricted", committee_status: "Restricted",
      included_modules: ["CP-1", "CP-3"], excluded_modules: ["CP-2E"],
    },
    nodes: [
      { node: "stress", status: "computed", value: 80, label: "Stressed EBITDA $80M", basis: "CP-1" },
      { node: "rv", status: "no-data", value: null, label: "No market sensitivity model", basis: "CP-3" },
    ],
  });
  render(<ScenarioNetworkPanel issuerId="i" runId="r" />);
  fireEvent.click(screen.getByText("PROPAGATE"));
  await waitFor(() => expect(screen.getByText("Stressed EBITDA $80M")).toBeTruthy());
  expect(screen.getByText("COMPUTED")).toBeTruthy();
  expect(screen.getByText("NO DATA")).toBeTruthy();
  expect(screen.getByText(/source restricted/i)).toBeTruthy();
  expect(screen.getByText(/1 blocked excluded/i)).toBeTruthy();
  expect(screen.getByText(/run r · EBITDA −20.0% · rate \+0 bp/i)).toBeTruthy();
});

it("hides a propagation result as soon as its run or shock identity changes", async () => {
  vi.mocked(propagateScenario).mockResolvedValue(scenarioResult("r1", "Run one result"));
  const view = render(<ScenarioNetworkPanel issuerId="i" runId="r1" />);

  fireEvent.click(screen.getByText("PROPAGATE"));
  await waitFor(() => expect(screen.getByText("Run one result")).toBeTruthy());

  fireEvent.change(screen.getByRole("spinbutton", { name: /EBITDA/i }), { target: { value: -10 } });
  expect(screen.queryByText("Run one result")).toBeNull();

  view.rerender(<ScenarioNetworkPanel issuerId="i" runId="r2" />);
  expect(screen.queryByText("Run one result")).toBeNull();
});

it("lets a new run propagate while an old request is pending and ignores the late result", async () => {
  let resolveOld!: (value: ReturnType<typeof scenarioResult>) => void;
  const oldRequest = new Promise<ReturnType<typeof scenarioResult>>((resolve) => { resolveOld = resolve; });
  vi.mocked(propagateScenario)
    .mockImplementationOnce(() => oldRequest)
    .mockResolvedValueOnce(scenarioResult("r2", "Run two result"));

  const view = render(<ScenarioNetworkPanel issuerId="i" runId="r1" />);
  fireEvent.click(screen.getByText("PROPAGATE"));
  expect(screen.getByText("PROPAGATING…")).toBeTruthy();

  view.rerender(<ScenarioNetworkPanel issuerId="i" runId="r2" />);
  fireEvent.click(screen.getByText("PROPAGATE"));
  await waitFor(() => expect(screen.getByText("Run two result")).toBeTruthy());

  await act(async () => { resolveOld(scenarioResult("r1", "Late run one result")); });
  expect(screen.getByText("Run two result")).toBeTruthy();
  expect(screen.queryByText("Late run one result")).toBeNull();
});

it("blocks duplicate propagation while pending and exposes a retryable failure", async () => {
  let rejectRequest!: (reason: Error) => void;
  const pending = new Promise<ReturnType<typeof scenarioResult>>((_resolve, reject) => { rejectRequest = reject; });
  vi.mocked(propagateScenario)
    .mockImplementationOnce(() => pending)
    .mockResolvedValueOnce(scenarioResult("r", "Recovered result"));

  render(<ScenarioNetworkPanel issuerId="i" runId="r" />);
  const propagate = screen.getByRole("button", { name: "PROPAGATE" });
  expect(screen.getByRole("spinbutton", { name: /EBITDA/i }).getAttribute("min")).toBe("-90");
  expect(screen.getByRole("spinbutton", { name: /RATE BP/i }).getAttribute("max")).toBe("1000");
  fireEvent.click(propagate);
  fireEvent.click(screen.getByRole("button", { name: "PROPAGATING…" }));
  expect(propagateScenario).toHaveBeenCalledTimes(1);

  await act(async () => { rejectRequest(new Error("offline")); });
  expect((await screen.findByRole("alert")).textContent).toMatch(/Retry without changing the current model/i);
  fireEvent.click(screen.getByRole("button", { name: "PROPAGATE" }));
  expect(await screen.findByText("Recovered result")).toBeTruthy();
  expect(propagateScenario).toHaveBeenCalledTimes(2);
});

describe("missing run", () => {
  it("compacts unavailable controls and explains the prerequisite", () => {
    render(<ScenarioNetworkPanel issuerId="i" runId={null} />);
    expect(screen.queryByRole("button", { name: "PROPAGATE" })).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.getByText(/completed run required/i)).toBeTruthy();
    expect(screen.getByText(/a completed live run is required/i)).toBeTruthy();
  });
});
