// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { RecentDecisions } from "./RecentDecisions";

const listDecisionRecords = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    listDecisionRecords: (...a: unknown[]) => listDecisionRecords(...a),
  };
});

afterEach(cleanup);

describe("RecentDecisions", () => {
  it("shows an honest empty state when there are no decisions on file", async () => {
    listDecisionRecords.mockResolvedValue([]);
    render(<RecentDecisions />);
    await waitFor(() => expect(screen.getByText(/No IC decisions recorded yet/)).toBeTruthy());
  });

  it("shows an honest error state when the endpoint is unreachable — never a fabricated list", async () => {
    listDecisionRecords.mockRejectedValue(new Error("network error"));
    render(<RecentDecisions />);
    await waitFor(() => expect(screen.getByText(/Couldn.t load recent decisions/)).toBeTruthy());
  });

  it("renders recent decisions with issuer name, recommendation, decision, and thesis", async () => {
    listDecisionRecords.mockResolvedValue([{
      id: "d1", issuer_id: "iss-1", issuer_name: "Atlas Forge Industrials",
      run_id: null, report_id: null, recommendation: "OVERWEIGHT", conviction: "HIGH",
      thesis: "Deleveraging ahead of schedule.", committee_date: "2026-07-10",
      decision: "approved", dissent: null, analyst_id: "a1", created_at: "2026-07-10T09:00:00Z",
    }]);
    render(<RecentDecisions />);
    await waitFor(() => expect(screen.getByText("Atlas Forge Industrials")).toBeTruthy());
    expect(screen.getByText("OVERWEIGHT")).toBeTruthy();
    expect(screen.getByText(/approved · 2026-07-10/)).toBeTruthy();
    expect(screen.getByText("Deleveraging ahead of schedule.")).toBeTruthy();
  });
});
