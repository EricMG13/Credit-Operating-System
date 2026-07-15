// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { StructuredResult, SynthesisResult } from "@/lib/query/types";

// Mock the one API fn the component calls (POST /api/query/nl). Set a
// resolved/rejected value per test.
vi.mock("@/lib/api", () => ({ nlQuery: vi.fn() }));

// Stub the heavy chart wrapper (dynamically imports @antv/g2) and the
// click-to-source modal (fetches a chunk) — neither is under test here, and
// keeping them out keeps the render deterministic + offline.
vi.mock("@/components/charts/G2Chart", () => ({
  G2Chart: () => <div data-testid="g2-chart" />,
}));
vi.mock("@/components/command/CitationViewer", () => ({
  CitationViewer: () => <div data-testid="citation-viewer" />,
}));

import { NlQuery } from "./NlQuery";
import { nlQuery } from "@/lib/api";

const mockNlQuery = vi.mocked(nlQuery);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// A minimal but realistic structured (ranked) result: two issuers ranked by
// net leverage, one run-derived/cited, one seeded.
const structuredResult: StructuredResult = {
  mode: "structured",
  interpretation: "Ranking issuers by net leverage, highest first.",
  spec: {},
  rank_by: "net_leverage",
  columns: [{ key: "net_leverage", label: "Net Leverage", unit: "x", higher_is_better: false }],
  total_ranked: 2,
  caveats: ["Seeded values are illustrative."],
  rows: [
    {
      issuer: { id: "iss-1", name: "Atlas Forge", ticker: "ATF", industry: "Industrials", country: "US" },
      rank_value: 7.4,
      metrics: {
        net_leverage: {
          value: 7.4,
          unit: "x",
          provenance: "run",
          qa_status: "ok",
          period: "FY24",
          citation: { claim_id: "C-1", evidence_id: "E-CS1", chunk_id: "chunk-abc123def456" },
        },
      },
    },
    {
      issuer: { id: "iss-2", name: "Borealis Metals", ticker: "BRM", industry: "Materials", country: "US" },
      rank_value: 4.1,
      metrics: {
        net_leverage: {
          value: 4.1,
          unit: "x",
          provenance: "seed",
          qa_status: "ok",
          period: "FY24",
          citation: null,
        },
      },
    },
  ],
};

// A synthesis (agent-wiki retrieval) result: no `columns`/`rank_by` metric —
// the third backend mode (SEAM1-1); rendering it must not crash the panel.
const synthesisResult: SynthesisResult = {
  mode: "synthesis",
  interpretation: "Searching agent syntheses, claims, and QA findings.",
  rank_by: null,
  caveats: ["Ranked by wiki and agent-synthesis match (BM25) — qualitative relevance, not a quantitative score."],
  rows: [
    {
      issuer: { id: "iss-1", name: "Atlas Forge", ticker: "ATF", industry: "Industrials", country: "US" },
      score: 4.213,
      excerpts: [{ chunk_id: "syn-chunk-1", doc: "CP-5 QA Debrief", text: "Two findings raised on covenant headroom." }],
    },
  ],
};

// A ranked result whose top issuer's only fact is the fabricated ATLF fixture
// (keyless run on a non-demo issuer → provenance "demo_fixture", #10 / SEAM2-1).
// It must be flagged FABRICATED, never read as a benign SEEDED value.
const fabricatedResult: StructuredResult = {
  mode: "structured",
  interpretation: "Ranking issuers by net leverage, highest first.",
  spec: {},
  rank_by: "net_leverage",
  columns: [{ key: "net_leverage", label: "Net Leverage", unit: "x", higher_is_better: false }],
  total_ranked: 1,
  caveats: ["Net leverage for one or more issuers is fabricated Atlas Forge demo-fixture data."],
  rows: [
    {
      issuer: { id: "iss-9", name: "Northwind Coil", ticker: "NWC", industry: "Industrials", country: "US" },
      rank_value: 5.68,
      metrics: {
        net_leverage: {
          value: 5.68, unit: "x", provenance: "demo_fixture",
          qa_status: "Restricted", period: "LTM", citation: null,
        },
      },
    },
  ],
};

describe("NlQuery", () => {
  it("flags a fabricated demo_fixture row as FABRICATED, never SEEDED (#10 / SEAM2-1)", async () => {
    mockNlQuery.mockResolvedValue(fabricatedResult);
    render(<NlQuery />);

    const input = screen.getByLabelText("Ask a question across issuers");
    fireEvent.change(input, { target: { value: "which issuer is most levered" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask across issuers" }));

    expect(await screen.findByText("Northwind Coil")).toBeTruthy();
    // Row badge is the loud fabricated marker, not the benign seed label.
    expect(screen.getByText("FABRICATED")).toBeTruthy();
    expect(screen.queryByText("SEEDED")).toBeNull();
    // Cell carries the critical "fab" chip (not the muted "seed" marker).
    expect(screen.getByText("fab")).toBeTruthy();
    expect(screen.queryByText("seed")).toBeNull();
  });

  it("synthesis mode: renders issuer + excerpts without throwing (no columns key — SEAM1-1)", async () => {
    mockNlQuery.mockResolvedValue(synthesisResult);
    render(<NlQuery />);

    const input = screen.getByLabelText("Ask a question across issuers");
    fireEvent.change(input, { target: { value: "show the QA findings for Atlas Forge" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask across issuers" }));

    // The panel must survive the columns-less payload and show the result.
    expect(await screen.findByText("Searching agent syntheses, claims, and QA findings.")).toBeTruthy();
    expect(screen.getByText("Atlas Forge")).toBeTruthy();
    expect(screen.getByText("“Two findings raised on covenant headroom.”")).toBeTruthy();
    // No ranked metric table, no bar chart for a qualitative result.
    expect(screen.queryByRole("table", { name: "Ranked query results" })).toBeNull();
    expect(screen.queryByTestId("g2-chart")).toBeNull();
  });

  it("renders the query input without starter chips", () => {
    render(<NlQuery />);
    expect(screen.getByLabelText("Ask a question across issuers")).toBeTruthy();
    // Starters are no longer visible.
    expect(screen.queryByText("which issuer is most levered")).toBeNull();
  });

  it("happy path: submitting a query calls the API and renders the interpretation + ranked rows", async () => {
    mockNlQuery.mockResolvedValue(structuredResult);
    render(<NlQuery />);

    const input = screen.getByLabelText("Ask a question across issuers") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "which issuer is most levered" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask across issuers" }));

    // API called with the typed question.
    expect(mockNlQuery).toHaveBeenCalledTimes(1);
    expect(mockNlQuery).toHaveBeenCalledWith("which issuer is most levered", expect.anything());

    // Interpretation surfaces once the promise resolves.
    expect(await screen.findByText("Ranking issuers by net leverage, highest first.")).toBeTruthy();

    // Ranked structured table renders both issuers in order.
    const table = screen.getByRole("table", { name: "Ranked query results" });
    expect(table).toBeTruthy();
    expect(within(table).getByText("Atlas Forge")).toBeTruthy();
    expect(within(table).getByText("Borealis Metals")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Net Leverage by issuer" })).toBeTruthy();
    expect(screen.getByText("Seeded values included")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show equivalent table" })).toBeTruthy();

    // The run-derived cell carries its clickable citation chip (evidence id);
    // the seeded cell shows the muted "seed" marker — both confirm provenance UI.
    expect(screen.getByRole("button", { name: "E-CS1" })).toBeTruthy();
    expect(within(table).getByText("seed")).toBeTruthy();

    // Caveat is shown.
    expect(screen.getByText("· Seeded values are illustrative.")).toBeTruthy();
  });

  it("opens the citation viewer when a citation chip is clicked", async () => {
    mockNlQuery.mockResolvedValue(structuredResult);
    render(<NlQuery />);

    const input = screen.getByLabelText("Ask a question across issuers");
    fireEvent.change(input, { target: { value: "which issuer is most levered" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask across issuers" }));

    const chip = await screen.findByRole("button", { name: "E-CS1" });
    expect(screen.queryByTestId("citation-viewer")).toBeNull();
    fireEvent.click(chip);
    expect(screen.getByTestId("citation-viewer")).toBeTruthy();
  });

  it("error path: a rejected query renders the yellow alert with the backend detail", async () => {
    mockNlQuery.mockRejectedValue({ response: { data: { detail: "metric store unavailable" } } });
    render(<NlQuery />);

    const input = screen.getByLabelText("Ask a question across issuers");
    fireEvent.change(input, { target: { value: "which issuer is most levered" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask across issuers" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("metric store unavailable");
    // No result table on the error branch.
    expect(screen.queryByRole("table", { name: "Ranked query results" })).toBeNull();
  });

  it("does not call the API when the input is empty", () => {
    mockNlQuery.mockResolvedValue(structuredResult);
    render(<NlQuery />);
    // ASK is disabled with no text; Enter on an empty field is a no-op.
    const input = screen.getByLabelText("Ask a question across issuers");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockNlQuery).not.toHaveBeenCalled();
  });
});
