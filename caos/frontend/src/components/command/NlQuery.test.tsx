// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({ nlQuery: vi.fn(), getChunk: vi.fn() }));
// G2/antv needs a real canvas; stub the chart so the table logic is what we test.
vi.mock("@/components/charts/G2Chart", () => ({ G2Chart: () => null }));

import { nlQuery, getChunk } from "@/lib/api";
import { NlQueryBody } from "./NlQuery";
import type { NlQueryResult, MetricCell } from "@/lib/query/types";

const cell = (value: number, prov: MetricCell["provenance"], chunk_id: string | null = null): MetricCell => ({
  value, unit: "x", provenance: prov, qa_status: "ok", period: "FY24",
  citation: chunk_id ? { claim_id: "c1", evidence_id: "E-CS1", chunk_id } : null,
});

const result: NlQueryResult = {
  mode: "structured",
  interpretation: "Ranking issuers by net leverage, highest first.",
  spec: {},
  rank_by: "net_leverage",
  columns: [{ key: "net_leverage", label: "Net Lev", unit: "x", higher_is_better: false }],
  rows: [
    { issuer: { id: "i1", name: "Carnival", ticker: "CCL", industry: null, country: null },
      rank_value: 6.8, metrics: { net_leverage: cell(6.8, "run", "abcdef123456") } },
    { issuer: { id: "i2", name: "Six Flags", ticker: "SIX", industry: null, country: null },
      rank_value: 4.2, metrics: { net_leverage: cell(4.2, "seed") } },
  ],
  total_ranked: 2,
  caveats: ["Seed values are illustrative."],
} as NlQueryResult;

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("NlQuery", () => {
  it("shows the question input and starter chips before any result", () => {
    render(<NlQueryBody />);
    expect(screen.getByLabelText("Ask a question across issuers")).toBeTruthy();
    expect(screen.getByText("which issuer is most levered")).toBeTruthy();
    expect((screen.getByText("ASK") as HTMLButtonElement).disabled).toBe(true); // empty → disabled
  });

  it("runs a query and renders the ranked, interpreted table", async () => {
    vi.mocked(nlQuery).mockResolvedValue(result);
    render(<NlQueryBody />);
    fireEvent.change(screen.getByLabelText("Ask a question across issuers"), { target: { value: "most levered" } });
    fireEvent.click(screen.getByText("ASK"));
    await waitFor(() => expect(screen.getByText(/Ranking issuers by net leverage/)).toBeTruthy());
    expect(nlQuery).toHaveBeenCalledWith("most levered");
    expect(screen.getByRole("table", { name: "Ranked query results" })).toBeTruthy();
    expect(screen.getByText("Carnival")).toBeTruthy();
    expect(screen.getByText("Six Flags")).toBeTruthy();
    expect(screen.getByText("CP-1 LIVE")).toBeTruthy(); // run-derived provenance badge
  });

  it("clicking a citation chip opens the source viewer", async () => {
    vi.mocked(nlQuery).mockResolvedValue(result);
    vi.mocked(getChunk).mockReturnValue(new Promise(() => {}));
    render(<NlQueryBody />);
    fireEvent.change(screen.getByLabelText("Ask a question across issuers"), { target: { value: "q" } });
    fireEvent.click(screen.getByText("ASK"));
    await waitFor(() => screen.getByText("E-CS1"));
    fireEvent.click(screen.getByText("E-CS1"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(getChunk).toHaveBeenCalledWith("abcdef123456");
  });

  it("surfaces a query error in an alert", async () => {
    vi.mocked(nlQuery).mockRejectedValue(new Error("query failed"));
    render(<NlQueryBody />);
    fireEvent.change(screen.getByLabelText("Ask a question across issuers"), { target: { value: "boom" } });
    fireEvent.click(screen.getByText("ASK"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  });
});
