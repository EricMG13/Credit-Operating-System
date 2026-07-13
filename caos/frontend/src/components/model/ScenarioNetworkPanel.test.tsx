// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScenarioNetworkPanel } from "./ScenarioNetworkPanel";
import { propagateScenario } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  propagateScenario: vi.fn(),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("renders computed and degraded nodes with text status, not color alone", async () => {
  vi.mocked(propagateScenario).mockResolvedValue({
    shock: { issuer_id: "i", run_id: "r", ebitda_pct: -0.2, rate_bps: 0 },
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
});

describe("missing run", () => {
  it("compacts unavailable controls and explains the prerequisite", () => {
    render(<ScenarioNetworkPanel issuerId="i" runId={null} />);
    expect(screen.queryByRole("button", { name: "PROPAGATE" })).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.getByText(/completed run required/i)).toBeTruthy();
    expect(screen.getByText(/run the issuer analysis/i)).toBeTruthy();
  });
});
