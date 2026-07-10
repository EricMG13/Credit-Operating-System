// @vitest-environment jsdom
// One-box unification (additive) — locks the "Scan metrics" lane contract on the
// Query page: the button is the explicit secondary action beside walk-primary Run
// (Enter never triggers a metric scan), it calls /api/query/nl, and the shared
// QueryResultsModal renders the ranked table / interpretation / caveats using the
// same surface as the Command Center /nl box (RT-2026-07-07-26 / 27). Walk state
// (graph/answer/route) is untouched by a metric scan.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { StructuredResult } from "@/lib/query/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/query",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/shared/Notifications", () => ({ useNotify: () => () => {} }));

// Stub every heavy child so the page renders offline + deterministically — only
// the command bar + modal are under test here.
vi.mock("@/components/charts/G2Chart", () => ({ G2Chart: () => <div data-testid="g2-chart" /> }));
vi.mock("@/components/command/CitationViewer", () => ({
  CitationViewer: () => <div data-testid="citation-viewer" />,
}));
vi.mock("@/components/query/GroupLauncher", () => ({
  GroupLauncher: () => <div data-testid="group-launcher" />,
}));
vi.mock("@/components/query/EvidenceDock", () => ({
  EvidenceDock: () => <div data-testid="evidence-dock" />,
}));
vi.mock("@/components/query/VaultMemoUpload", () => ({
  VaultMemoUpload: () => <div data-testid="vault-memo-upload" />,
}));
vi.mock("@/components/query/InsightFeed", () => ({
  InsightFeed: () => <div data-testid="insight-feed" />,
}));
vi.mock("@/components/query/AiAnswer", () => ({
  AiAnswer: () => <div data-testid="ai-answer" />,
}));
vi.mock("@/components/query/GraphCanvas", () => ({
  GraphCanvas: () => <div data-testid="graph-canvas" />,
}));
vi.mock("@/components/query/RelativeValueTable", () => ({
  RelativeValueTable: () => <div data-testid="rv-table" />,
}));
vi.mock("@/components/query/ScatterCanvas", () => ({
  ScatterCanvas: () => <div data-testid="scatter-canvas" />,
}));
vi.mock("@/components/query/LineageFlow", () => ({
  LineageFlow: () => <div data-testid="lineage-flow" />,
}));
vi.mock("@/components/query/QueryPrintSheet", () => ({
  QueryPrintSheet: () => <div data-testid="query-print-sheet" />,
}));
vi.mock("@/components/query/QueryReportSheet", () => ({
  QueryReportSheet: () => <div data-testid="query-report-sheet" />,
}));
vi.mock("@/components/query/ReportRail", () => ({
  ReportRail: () => <div data-testid="report-rail" />,
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  // No capabilities → no auto-walk, no model lane → keyword-only walk path. The
  // canvas stays on the placeholder so the modal is the only result surface.
  queryCapabilities: vi.fn().mockResolvedValue({ groups: [], availability: { model_lane: false } }),
  queryInsights: vi.fn().mockResolvedValue({ cards: [], refreshing: false }),
  queryGraph: vi.fn().mockResolvedValue({ nodes: [], edges: [], caveats: [], capability_id: "peer-set", mode: "peer", title: "peers" }),
  queryRoute: vi.fn().mockResolvedValue({ candidates: [], source: "keyword" }),
  queryAnswer: vi.fn().mockResolvedValue({ answer: "", sentences: [], citations: [], unavailable: true, model: null, created_at: null, cached: false }),
  queryOverlay: vi.fn().mockResolvedValue({ edges: [], commentary: null, model: null, cached: false }),
  listQueryLinks: vi.fn().mockResolvedValue({ links: [] }),
  acceptQueryLink: vi.fn(),
  retractQueryLink: vi.fn(),
  nlQuery: vi.fn(),
}));

import QueryPage from "./page";
import { nlQuery, queryGraph, queryRoute } from "@/lib/api";

const mockNlQuery = vi.mocked(nlQuery);
const mockQueryGraph = vi.mocked(queryGraph);
const mockQueryRoute = vi.mocked(queryRoute);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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
        net_leverage: { value: 7.4, unit: "x", provenance: "run", qa_status: "ok", period: "FY24",
          citation: { claim_id: "C-1", evidence_id: "E-CS1", chunk_id: "chunk-abc123def456" } },
      },
    },
    {
      issuer: { id: "iss-2", name: "Borealis Metals", ticker: "BRM", industry: "Materials", country: "US" },
      rank_value: 4.1,
      metrics: { net_leverage: { value: 4.1, unit: "x", provenance: "seed", qa_status: "ok", period: "FY24", citation: null } },
    },
  ],
};

describe("Query · Scan metrics lane (one-box unification, additive)", () => {
  it("SCAN METRICS button calls /nl and opens the shared modal with the ranked table (RT-2026-07-07-26/27)", async () => {
    mockNlQuery.mockResolvedValue(structuredResult);
    render(<QueryPage />);

    // The button is the explicit secondary action — distinct from walk-primary Run.
    const scanBtn = await screen.findByRole("button", { name: "Scan metrics across coverage" });
    const input = screen.getByLabelText("Query coverage") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "which issuers are most levered" } });
    fireEvent.click(scanBtn);

    // /nl is called with the typed question; the walk endpoints are NOT called by a scan.
    await waitFor(() => {
      expect(mockNlQuery).toHaveBeenCalledTimes(1);
      expect(mockNlQuery).toHaveBeenCalledWith("which issuers are most levered", expect.anything());
    });
    expect(mockQueryGraph).not.toHaveBeenCalled();
    expect(mockQueryRoute).not.toHaveBeenCalled();

    // The shared modal renders the interpretation + ranked rows + caveat, exactly
    // as it does on the Command Center /nl box.
    expect(await screen.findByText("Ranking issuers by net leverage, highest first.")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Ranked query results" })).toBeTruthy();
    expect(screen.getByText("Atlas Forge")).toBeTruthy();
    expect(screen.getByText("Borealis Metals")).toBeTruthy();
    expect(screen.getByText("· Seeded values are illustrative.")).toBeTruthy();
  });

  it("Enter on the input stays walk-primary — it never triggers a metric scan", async () => {
    mockNlQuery.mockResolvedValue(structuredResult);
    render(<QueryPage />);

    const input = await screen.findByLabelText("Query coverage") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "which issuers are most levered" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Enter routes through the walk path (keywordSubmit, since model_lane is off),
    // never through /nl. The metric lane is button-only by design.
    await waitFor(() => {
      expect(mockNlQuery).not.toHaveBeenCalled();
    });
  });

  it("a /nl 422 (no metric match) surfaces as an in-modal alert, not a page-level crash", async () => {
    mockNlQuery.mockRejectedValue({ response: { data: { detail: "Couldn't map that to a known metric — foo." } } });
    render(<QueryPage />);

    const scanBtn = await screen.findByRole("button", { name: "Scan metrics across coverage" });
    const input = screen.getByLabelText("Query coverage") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "rank by frobnication" } });
    fireEvent.click(scanBtn);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Couldn't map that to a known metric");
    // No ranked table on the error branch.
    expect(screen.queryByRole("table", { name: "Ranked query results" })).toBeNull();
  });

  it("SCAN METRICS is disabled until text is entered", async () => {
    render(<QueryPage />);
    const scanBtn = await screen.findByRole("button", { name: "Scan metrics across coverage" });
    expect((scanBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
