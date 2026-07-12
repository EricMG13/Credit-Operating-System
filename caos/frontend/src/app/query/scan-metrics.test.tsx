// @vitest-environment jsdom
// One-composer intent router (P2-WP-4) — locks the "Scan metrics" lane
// contract on the Query page now that Run/Enter share one dispatch path
// (runLane) instead of a separate always-visible SCAN METRICS button. The
// underlying /nl call, shared QueryResultsModal rendering, and error
// surfacing are UNCHANGED from the prior contract (RT-2026-07-07-26/27);
// what changed is purely how the metric lane gets triggered — the
// deterministic classifier (lib/query/intent-router.ts) decides, visibly,
// before submit.
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
// Module-level, not inline in the factory: page.tsx's run() is a useCallback
// keyed on [notify], and the real useNotify() returns a stable reference
// (Notifications.tsx wraps it in useCallback/useMemo). An inline arrow here
// returns a NEW function every call, so run() — and the useEffect keyed on
// [run] that loads capabilities — recreates every render, infinite-looping.
const NOOP_NOTIFY = () => {};
vi.mock("@/components/shared/Notifications", () => ({ useNotify: () => NOOP_NOTIFY }));

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

let modelLaneOn = true;

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  queryCapabilities: vi.fn().mockImplementation(async () => ({ groups: [], availability: { model_lane: modelLaneOn } })),
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
  modelLaneOn = true;
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

describe("Query · Scan metrics lane (one-composer intent router)", () => {
  it("metric-shaped text routes Run into the metric lane and opens the shared modal (RT-2026-07-07-26/27)", async () => {
    mockNlQuery.mockResolvedValue(structuredResult);
    render(<QueryPage />);

    const input = await screen.findByLabelText("Query coverage") as HTMLInputElement;
    // "most" matches the ranking-language metric pattern.
    fireEvent.change(input, { target: { value: "which issuers are most levered" } });
    await screen.findByText("METRIC SCAN"); // the router chip is visible pre-submit
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

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

  it("Enter fires the SAME lane the router chip shows (no click/keyboard disagreement)", async () => {
    mockNlQuery.mockResolvedValue(structuredResult);
    render(<QueryPage />);

    const input = await screen.findByLabelText("Query coverage") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "which issuers are most levered" } });
    await screen.findByText("METRIC SCAN");
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(mockNlQuery).toHaveBeenCalledTimes(1));
    expect(mockQueryGraph).not.toHaveBeenCalled();
  });

  it("never routes into the metric lane when the model lane is unavailable — degrades to the deterministic walk", async () => {
    modelLaneOn = false;
    mockNlQuery.mockResolvedValue(structuredResult);
    render(<QueryPage />);

    const input = await screen.findByLabelText("Query coverage") as HTMLInputElement;
    // Same metric-shaped text as above — but with no live model lane the
    // classifier must still choose graph, never a dead metric lane.
    fireEvent.change(input, { target: { value: "which issuers are most levered" } });
    await screen.findByText("GRAPH WALK");
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(mockNlQuery).not.toHaveBeenCalled();
    });
  });

  it("a /nl 422 (no metric match) surfaces as an in-modal alert, not a page-level crash", async () => {
    mockNlQuery.mockRejectedValue({ response: { data: { detail: "Couldn't map that to a known metric — foo." } } });
    render(<QueryPage />);

    const input = await screen.findByLabelText("Query coverage") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "rank by frobnication" } });
    await screen.findByText("METRIC SCAN");
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Couldn't map that to a known metric");
    // No ranked table on the error branch.
    expect(screen.queryByRole("table", { name: "Ranked query results" })).toBeNull();
  });

  it("Run is disabled until text is entered", async () => {
    render(<QueryPage />);
    const runBtn = await screen.findByRole("button", { name: "Run" });
    expect((runBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("a click on the reroute chip flips the lane for that submission", async () => {
    mockNlQuery.mockResolvedValue(structuredResult);
    render(<QueryPage />);

    const input = await screen.findByLabelText("Query coverage") as HTMLInputElement;
    // Graph-shaped text (no metric pattern) — router defaults to GRAPH WALK.
    fireEvent.change(input, { target: { value: "peer network for this issuer" } });
    await screen.findByText("GRAPH WALK");
    fireEvent.click(screen.getByRole("button", { name: /reroute: METRIC SCAN/ }));
    await screen.findByText("METRIC SCAN");

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(mockNlQuery).toHaveBeenCalledTimes(1));
    expect(mockQueryGraph).not.toHaveBeenCalled();
  });
});
