// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  createFinding: vi.fn().mockResolvedValue({}),
  createQueryRun: vi.fn(),
  getChunk: vi.fn().mockResolvedValue({ issuer_name: "Atlas Forge", doc: "FY25 filing" }),
  listFindings: vi.fn().mockResolvedValue([]),
  listQueryRuns: vi.fn().mockResolvedValue([]),
  queryCapabilities: vi.fn().mockResolvedValue({ groups: [{ capabilities: [{ id: "peer-set", enabled: true }] }] }),
  setContext: vi.fn(),
  context: { id: "context-1", name: "Coverage", sector_id: null, query_session_id: null, filters: {}, selected: {} } as {
    id: string; name: string; sector_id: null; query_session_id: string | null; filters: Record<string, never>; selected: Record<string, never>;
  } | null,
  contextError: null as string | null,
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/query" }));
vi.mock("@/components/shared/RequireAuth", () => ({ RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/AnalysisContextStrip", () => ({ AnalysisContextStrip: () => null }));
vi.mock("@/components/query/GraphCanvas", () => ({
  GraphCanvas: ({ graph, onOpenChunk }: { graph: { title: string }; onOpenChunk?: (id: string, label?: string) => void }) => (
    <button type="button" onClick={() => onOpenChunk?.("graph-chunk", undefined)}>Open {graph.title} graph source</button>
  ),
}));
vi.mock("@/components/command/CitationViewer", () => ({
  CitationViewer: ({ chunkId, label, onClose }: { chunkId: string; label?: string; onClose: () => void }) => (
    <div role="dialog" aria-label="Source document chunk">{chunkId} · {label}<button type="button" onClick={onClose}>Close source</button></div>
  ),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getChunk: mocks.getChunk,
  queryCapabilities: mocks.queryCapabilities,
}));
vi.mock("@/lib/analysis-workbench", () => ({
  useAnalysisContext: () => ({
    context: mocks.context,
    setContext: mocks.setContext,
    patch: vi.fn(),
    loading: mocks.context === null,
    error: mocks.contextError,
  }),
  contextHref: (path: string, id: string) => `${path}?context=${id}`,
  analysisApi: {
    createFinding: mocks.createFinding,
    createQueryRun: mocks.createQueryRun,
    listFindings: mocks.listFindings,
    listQueryRuns: mocks.listQueryRuns,
  },
}));

import QueryPage from "./page";

const authority = {
  origin: "live", method: "metric", freshness: "current", as_of: "2026-07-13T09:00:00Z",
  source_ids: ["chunk-1"], run_id: "run-1", version_id: null, confidence: 0.9,
  approval_state: "draft", analyst_override: null,
};

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-1", context_id: "context-1", question: "Which issuers rank highest?",
    selected_lane: "metric", method_override: null, status: "ready", result: { answer: "Ranked answer" },
    authority, error: null, created_at: authority.as_of, updated_at: authority.as_of,
    ...overrides,
  };
}

async function submit(question: string) {
  const input = await screen.findByLabelText("Query coverage");
  fireEvent.change(input, { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: "Run Query" }));
}

beforeEach(() => {
  window.history.replaceState({}, "", "/query?context=context-1");
  mocks.context = { id: "context-1", name: "Coverage", sector_id: null, query_session_id: null, filters: {}, selected: {} };
  mocks.contextError = null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.createFinding.mockResolvedValue({});
  mocks.getChunk.mockResolvedValue({ issuer_name: "Atlas Forge", doc: "FY25 filing" });
  mocks.listFindings.mockResolvedValue([]);
  mocks.listQueryRuns.mockResolvedValue([]);
  mocks.queryCapabilities.mockResolvedValue({ groups: [{ capabilities: [{ id: "peer-set", enabled: true }] }] });
});

describe("Query investigation edge interactions", () => {
  it("survives unavailable session storage and removes a cleared draft", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => { throw new Error("private mode"); });
    render(<QueryPage />);
    const input = await screen.findByLabelText("Query coverage");
    expect((input as HTMLTextAreaElement).value).toBe("");
    getItem.mockRestore();

    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    fireEvent.change(input, { target: { value: "temporary draft" } });
    fireEvent.change(input, { target: { value: "" } });
    expect(removeItem).toHaveBeenCalledWith("caos.query.draft.context-1");

    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new Error("quota full"); });
    expect(() => fireEvent.change(input, { target: { value: "still editable" } })).not.toThrow();
    expect((input as HTMLTextAreaElement).value).toBe("still editable");
  });

  it("accepts focus events, manual lane overrides, suggestions, starters, and keyboard execution", async () => {
    let resolveRun!: (value: ReturnType<typeof run>) => void;
    mocks.createQueryRun.mockImplementation(() => new Promise((resolve) => { resolveRun = resolve; }));
    render(<QueryPage />);
    const input = await screen.findByLabelText("Query coverage");

    act(() => window.dispatchEvent(new CustomEvent("caos:query-focus", { detail: { text: "show connected contagion" } })));
    expect((input as HTMLTextAreaElement).value).toBe("show connected contagion");
    expect(screen.getByRole("button", { name: "Map relationships" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Compare metrics" }));
    expect(screen.getByRole("button", { name: "Use suggested lane" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use suggested lane" }));
    expect(screen.getByRole("button", { name: "Map relationships" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    fireEvent.keyDown(input, { key: "Enter", metaKey: true });
    expect(mocks.createQueryRun).toHaveBeenCalledTimes(1);
    resolveRun(run({ id: "keyboard-run", question: "show connected contagion", selected_lane: "graph", result: {} }));
    expect(await screen.findByText("Graph payload unavailable")).toBeTruthy();
  });

  it("runs a starter and keeps its inferred grounded lane", async () => {
    mocks.createQueryRun.mockResolvedValue(run({
      id: "starter-run", question: "Show evidence linking refinancing risk to sector posture.", selected_lane: "grounded",
      result: { answer: "Evidence answer", sentences: [] }, authority: { ...authority, method: "grounded" },
    }));
    render(<QueryPage />);
    const starter = await screen.findByRole("button", { name: "Show evidence linking refinancing risk to sector posture." });
    fireEvent.click(starter);
    expect(screen.getByRole("button", { name: "Research with citations" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Run Query" }));
    expect(await screen.findByText("No sentence-level citations attached · keep in draft")).toBeTruthy();
  });

  it("uses grounded citation defaults, filters malformed sources, and opens a cited claim", async () => {
    mocks.createQueryRun.mockResolvedValue(run({
      id: "grounded-defaults", question: "explain source gaps", selected_lane: "grounded",
      result: {
        sentences: [
          { text: null, claim_type: null, chunk_ids: ["chunk-unlabelled", null], fact_ids: null },
          { text: "Uncited observation", chunk_ids: null, fact_ids: null },
        ],
        citations: [null, [], {}, { chunk_id: "unused" }],
        fact_citations: "not-an-array",
      },
      authority: { ...authority, method: "grounded", source_ids: ["chunk-unlabelled"] },
    }));
    render(<QueryPage />);
    await submit("explain source gaps");
    expect(await screen.findByText("Grounded claim unavailable.")).toBeTruthy();
    expect(screen.getByText("Uncited · keep in draft")).toBeTruthy();
    expect(screen.getByText("1 cited source")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open cited source chunk-unlabelled" }));
    expect(screen.getByRole("dialog", { name: "Source document chunk" }).textContent).toContain("chunk-unlabelled · C1");
  });

  it("renders fact citation defaults when sentence sources omit labels", async () => {
    mocks.createQueryRun.mockResolvedValue(run({
      id: "fact-defaults", question: "explain a metric fact", selected_lane: "grounded",
      result: {
        sentences: [{ text: "Metric fact claim", fact_ids: ["fact-unlabelled"] }],
        citations: "not-an-array",
        fact_citations: [],
      },
      authority: { ...authority, method: "grounded", source_ids: ["fact-unlabelled"] },
    }));
    render(<QueryPage />);
    await submit("explain a metric fact");
    expect(await screen.findByText("F1 · metric fact")).toBeTruthy();
    expect(screen.getByText("1 cited source")).toBeTruthy();
  });

  it("renders structured metric columns, fixed precision, issuer metadata, and row citations", async () => {
    mocks.createQueryRun.mockResolvedValue(run({
      question: "show current levels", result: {
        columns: [
          { key: "leverage", label: "Leverage", unit: "x" },
          { key: "revenue", label: "Revenue", unit: "$m" },
          { key: "rating", label: "Rating" },
          { key: "missing", label: "Missing" },
          { key: null, label: null },
        ],
        rank_by: "leverage",
        rows: [{
          issuer: { id: "issuer-1", name: "Atlas Forge", ticker: "ATLS", industry: "Industrials" },
          rank_value: 5.4,
          metrics: {
            leverage: { citation: { chunk_id: "row-chunk" } },
            revenue: { value: 123.45 },
            rating: { value: "B2" },
            missing: { value: null },
            "": "primitive",
            noise: "not-a-citation",
          },
        }],
      },
    }));
    render(<QueryPage />);
    await submit("show current levels");
    expect(await screen.findByText("5.40")).toBeTruthy();
    expect(screen.getByText("123.5")).toBeTruthy();
    expect(screen.getByText("B2")).toBeTruthy();
    expect(screen.getByText("ATLS · Industrials")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "❝ src" }));
    expect(screen.getByRole("dialog", { name: "Source document chunk" }).textContent).toContain("row-chunk · Atlas Forge");
    fireEvent.click(screen.getByRole("button", { name: "Close source" }));
    expect(screen.queryByRole("dialog", { name: "Source document chunk" })).toBeNull();
  });

  it("renders fallback metric columns, missing values, label fallbacks, and a level caveat", async () => {
    mocks.createQueryRun.mockResolvedValue(run({
      question: "which issuers show leverage deterioration", result: {
        rows: [
          { name: "Named row", rank_value: null, issuer: [], covenant: null },
          { company: "Company row", rank_value: 123.45, issuer: "invalid", note: "watch" },
          { issuer_name: "Issuer row", rank_value: 4.4, extra: true },
          { issuer: { name: "Nested issuer", ticker: "NEST" }, rank_value: "N/M" },
          { rank_value: 0 },
        ],
      },
    }));
    render(<QueryPage />);
    await submit("which issuers show leverage deterioration");
    expect(await screen.findByText("△ ranked by level, not change")).toBeTruthy();
    expect(screen.getByText("Named row")).toBeTruthy();
    expect(screen.getByText("Company row")).toBeTruthy();
    expect(screen.getByText("Issuer row")).toBeTruthy();
    expect(screen.getByText("Nested issuer")).toBeTruthy();
    expect(screen.getByText("Result 5")).toBeTruthy();
    expect(screen.getByText("123.5")).toBeTruthy();
    expect(screen.getByText("4.40")).toBeTruthy();
    expect(screen.getByText("N/M")).toBeTruthy();
  });

  it("opens graph and inspector citations with deterministic fallback labels", async () => {
    mocks.getChunk.mockRejectedValue(new Error("not a document chunk"));
    mocks.createQueryRun.mockResolvedValue(run({
      selected_lane: "graph", question: "show graph lineage",
      result: {
        capability_id: "peer-set", mode: "lineage", title: "Lineage",
        nodes: [{ id: "a", label: "Atlas", kind: "issuer", x: 0, y: 1 }], edges: [],
      },
      authority: { ...authority, method: "graph", source_ids: ["source-fallback"] },
    }));
    render(<QueryPage />);
    await submit("show graph lineage");
    fireEvent.click(await screen.findByRole("button", { name: "Open Lineage graph source" }));
    expect(screen.getByRole("dialog", { name: "Source document chunk" }).textContent).toContain("graph-chunk · graph-chunk");
    fireEvent.click(screen.getByRole("button", { name: "Close source" }));
    fireEvent.click(screen.getByTitle("Open source extract · source-fallback"));
    expect(screen.getByRole("dialog", { name: "Source document chunk" }).textContent).toContain("source-fallback · C1");
  });

  it("renders invalid graph and empty grounded payload states", async () => {
    mocks.createQueryRun
      .mockResolvedValueOnce(run({ selected_lane: "graph", question: "graph invalid", result: { capability_id: "x", mode: "x", title: "Bad", nodes: [null], edges: [] } }))
      .mockResolvedValueOnce(run({ selected_lane: "graph", question: "edge invalid", result: { capability_id: "x", mode: "x", title: "Bad edge", nodes: [], edges: [null] } }))
      .mockResolvedValueOnce(run({ selected_lane: "grounded", question: "why unavailable", result: { unavailable: true }, authority: { ...authority, method: "grounded" } }));
    const first = render(<QueryPage />);
    await submit("graph invalid");
    expect(await screen.findByText("Graph payload unavailable")).toBeTruthy();
    first.unmount();
    const second = render(<QueryPage />);
    await submit("edge invalid");
    expect(await screen.findByText("Graph payload unavailable")).toBeTruthy();
    second.unmount();
    render(<QueryPage />);
    await submit("why unavailable");
    expect(await screen.findByText("No grounded answer")).toBeTruthy();
  });

  it("renders a default error recovery and keeps an uncited ready run in draft", async () => {
    mocks.createQueryRun
      .mockResolvedValueOnce(run({ status: "error", error: null, result: {}, authority: { ...authority, source_ids: [] } }))
      .mockResolvedValueOnce(run({ id: "uncited", question: "uncited ready", result: {}, authority: { ...authority, source_ids: [], as_of: null } }));
    const first = render(<QueryPage />);
    await submit("failed question");
    expect(await screen.findByText("The selected lane is incomplete.")).toBeTruthy();
    expect(screen.getByText("Available alternatives · Compare metrics · Map relationships")).toBeTruthy();
    first.unmount();

    render(<QueryPage />);
    await submit("uncited ready");
    expect(await screen.findByText("No citation identifiers were attached; keep this result in draft.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pin finding" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("loads, selects, and edits saved investigations from the utility drawer", async () => {
    mocks.listQueryRuns.mockResolvedValue([run({ id: "saved-run", question: "Saved graph question", selected_lane: "graph", result: {} })]);
    render(<QueryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Open Query utilities" }));
    fireEvent.change(screen.getByLabelText("Capability"), { target: { value: "ownership-network" } });
    fireEvent.click(await screen.findByRole("button", { name: "Saved graph question" }));
    expect((screen.getByLabelText("Query coverage") as HTMLTextAreaElement).value).toBe("Saved graph question");
    expect(screen.getByRole("button", { name: "Map relationships" }).getAttribute("aria-pressed")).toBe("true");
    expect(window.location.search).toContain("run=saved-run");
  });

  it("keeps the composer inert until the active persisted selection is hydrated", async () => {
    let resolveHistory!: (rows: ReturnType<typeof run>[]) => void;
    mocks.context = { ...mocks.context!, query_session_id: "saved-run" };
    mocks.listQueryRuns.mockImplementationOnce(() => new Promise((resolve) => { resolveHistory = resolve; }));
    render(<QueryPage />);

    const input = await screen.findByLabelText("Query coverage") as HTMLTextAreaElement;
    expect(input.disabled).toBe(true);
    resolveHistory([run({ id: "saved-run", question: "Hydrated question" })]);

    expect(await screen.findByText("Ranked answer")).toBeTruthy();
    await waitFor(() => expect((screen.getByLabelText("Query coverage") as HTMLTextAreaElement).disabled).toBe(false));
  });

  it("does not refetch the full history after publishing a local query result", async () => {
    mocks.createQueryRun.mockResolvedValue(run({ id: "local-run", question: "local question" }));
    render(<QueryPage />);
    const input = await screen.findByLabelText("Query coverage") as HTMLTextAreaElement;
    await waitFor(() => expect(input.disabled).toBe(false));

    fireEvent.change(input, { target: { value: "local question" } });
    fireEvent.click(screen.getByRole("button", { name: "Run Query" }));
    expect(await screen.findByText("Ranked answer")).toBeTruthy();
    expect(mocks.listQueryRuns).toHaveBeenCalledTimes(1);
  });

  it("makes a failed URL-selected investigation explicit and retryable", async () => {
    window.history.replaceState({}, "", "/query?context=context-1&run=requested-run");
    mocks.listQueryRuns
      .mockRejectedValueOnce(new Error("Query read rate limit reached"))
      .mockResolvedValueOnce([run({ id: "requested-run", question: "Recovered question" })]);
    render(<QueryPage />);

    expect(await screen.findByRole("heading", { name: "Selected investigation unavailable" })).toBeTruthy();
    expect((screen.getByLabelText("Query coverage") as HTMLTextAreaElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Retry investigation" }));

    expect(await screen.findByText("Ranked answer")).toBeTruthy();
    expect(mocks.listQueryRuns).toHaveBeenCalledTimes(2);
  });

  it("surfaces capability, history, and context errors without disabling the loaded context", async () => {
    mocks.queryCapabilities.mockRejectedValue(new Error("capabilities offline"));
    mocks.listQueryRuns.mockRejectedValue(new Error("history offline"));
    mocks.contextError = "context warning";
    render(<QueryPage />);
    expect(await screen.findByText(/capabilities offline/)).toBeTruthy();
    expect(screen.getByText("context warning")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Query utilities" }));
    expect(await screen.findByText("history offline")).toBeTruthy();
  });

  it("ignores a capability response that arrives after unmount", async () => {
    let resolveCapabilities!: (value: { groups: never[] }) => void;
    mocks.queryCapabilities.mockImplementation(() => new Promise((resolve) => { resolveCapabilities = resolve; }));
    const view = render(<QueryPage />);
    await screen.findByLabelText("Query coverage");
    view.unmount();
    resolveCapabilities({ groups: [] });
    await Promise.resolve();
  });

  it("falls back to the default graph capability when capability groups are absent", async () => {
    mocks.queryCapabilities.mockResolvedValue({} as never);
    render(<QueryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Open Query utilities" }));
    expect((screen.getByLabelText("Capability") as HTMLInputElement).value).toBe("peer-set");
  });

  it("ignores capability groups that do not declare capabilities", async () => {
    mocks.queryCapabilities.mockResolvedValue({ groups: [{}] } as never);
    render(<QueryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Open Query utilities" }));
    expect((screen.getByLabelText("Capability") as HTMLInputElement).value).toBe("peer-set");
  });

  it("falls back to updated timestamps for partial and observed-empty decision data", async () => {
    for (const [index, status] of (["partial", "observed-empty"] as const).entries()) {
      mocks.listQueryRuns.mockResolvedValueOnce([run({
        id: `dated-${index}`, status, result: status === "partial" ? { missing_dependencies: [] } : {},
        authority: { ...authority, as_of: null },
      })]);
      mocks.context = { id: "context-1", name: "Coverage", sector_id: null, query_session_id: `dated-${index}`, filters: {}, selected: {} };
      const view = render(<QueryPage />);
      expect(await screen.findByText(status === "partial" ? "Question preserved" : "Successful query returned no qualifying observations.")).toBeTruthy();
      view.unmount();
    }
  });

  it("keeps context-dependent utilities and execution inert without a context", async () => {
    mocks.context = null;
    render(<QueryPage />);
    const input = await screen.findByLabelText("Query coverage");
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    fireEvent.click(screen.getByRole("button", { name: "Open Query utilities" }));
    expect(screen.queryByRole("link", { name: "Open in Report Studio" })).toBeNull();
    expect(mocks.createQueryRun).not.toHaveBeenCalled();
  });

  it("pins observed-empty results and uses summary, synthesis, interpretation, and question title fallbacks", async () => {
    const variants = [
      { summary: "Summary title" },
      { synthesis: "Synthesis title" },
      { interpretation: "Interpretation title" },
      {},
    ];
    for (const [index, result] of variants.entries()) {
      mocks.listQueryRuns.mockResolvedValueOnce([run({
        id: `pin-${index}`, question: `Question ${index}`, status: index === 0 ? "observed-empty" : "ready", result,
        authority: { ...authority, origin: index === 1 ? "demo" : "reference", freshness: index === 2 ? "stale" : "unknown", approval_state: index === 3 ? "unratified" : "ratified" },
      })]);
      mocks.context = { id: "context-1", name: "Coverage", sector_id: null, query_session_id: `pin-${index}`, filters: {}, selected: {} };
      const view = render(<QueryPage />);
      fireEvent.click(await screen.findByRole("button", { name: "Pin finding" }));
      await waitFor(() => expect(mocks.createFinding).toHaveBeenCalledTimes(index + 1));
      view.unmount();
    }
    expect(mocks.createFinding.mock.calls.map(([payload]) => payload.title)).toEqual([
      "Summary title", "Synthesis title", "Interpretation title", "Question 3",
    ]);
  });

  it("deduplicates a same-tick pin attempt while the first request is pending", async () => {
    let resolveFinding!: (value: object) => void;
    mocks.createFinding.mockImplementation(() => new Promise((resolve) => { resolveFinding = resolve; }));
    mocks.listQueryRuns.mockResolvedValue([run({ id: "pin-once" })]);
    mocks.context = { id: "context-1", name: "Coverage", sector_id: null, query_session_id: "pin-once", filters: {}, selected: {} };
    render(<QueryPage />);
    const button = await screen.findByRole("button", { name: "Pin finding" });
    act(() => { button.click(); button.click(); });
    expect(mocks.createFinding).toHaveBeenCalledTimes(1);
    resolveFinding({});
    await waitFor(() => expect(button.textContent).toBe("Pin finding"));
  });

  it("rechecks evidence at pin time if a previously cited run loses its sources", async () => {
    const mutableRun = run({ id: "pin-source-race", authority: { ...authority, source_ids: ["chunk-before"] } });
    mocks.listQueryRuns.mockResolvedValue([mutableRun]);
    mocks.context = { id: "context-1", name: "Coverage", sector_id: null, query_session_id: "pin-source-race", filters: {}, selected: {} };
    render(<QueryPage />);
    const button = await screen.findByRole("button", { name: "Pin finding" });
    (mutableRun.authority.source_ids as string[]).length = 0;
    fireEvent.click(button);
    expect(mocks.createFinding).not.toHaveBeenCalled();
  });
});
