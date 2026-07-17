// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  createQueryRun: vi.fn(),
  listQueryRuns: vi.fn().mockResolvedValue([]),
  listFindings: vi.fn().mockResolvedValue([]),
  createFinding: vi.fn(),
  setContext: vi.fn(),
  context: { id: "context-1", name: "Coverage", sector_id: null, query_session_id: null, filters: {}, selected: {} } as {
    id: string; name: string; sector_id: null; query_session_id: null; filters: Record<string, never>; selected: Record<string, never>;
  } | null,
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/query" }));
vi.mock("@/components/shared/RequireAuth", () => ({ RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/AnalysisContextStrip", () => ({ AnalysisContextStrip: () => null }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  queryCapabilities: vi.fn().mockResolvedValue({ groups: [{ capabilities: [{ id: "peer-set", enabled: true }] }] }),
}));
vi.mock("@/lib/analysis-workbench", () => ({
  useAnalysisContext: () => ({
    context: mocks.context,
    setContext: mocks.setContext,
    patch: vi.fn(),
    loading: mocks.context === null,
    error: null,
  }),
  contextHref: (path: string, id: string) => `${path}?context=${id}`,
  analysisApi: {
    createQueryRun: mocks.createQueryRun,
    listQueryRuns: mocks.listQueryRuns,
    listFindings: mocks.listFindings,
    createFinding: mocks.createFinding,
  },
}));

import QueryPage from "./page";

const authority = {
  origin: "live", method: "metric", freshness: "current", as_of: "2026-07-13T09:00:00Z",
  source_ids: ["fact-1"], run_id: "run-1", version_id: null, confidence: 0.9,
  approval_state: "draft", analyst_override: null,
};

beforeEach(() => {
  window.history.replaceState({}, "", "/query?context=context-1");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.listQueryRuns.mockResolvedValue([]);
  mocks.context = { id: "context-1", name: "Coverage", sector_id: null, query_session_id: null, filters: {}, selected: {} };
});

describe("Query investigation workbench", () => {
  it("declares the metric lane before execution and persists one versioned run", async () => {
    mocks.createQueryRun.mockResolvedValue({
      id: "run-1", context_id: "context-1", question: "which issuers are most levered",
      selected_lane: "metric", method_override: null, status: "ready",
      result: { rows: [{ issuer_name: "Atlas Forge", net_leverage: 7.4 }] }, authority,
      error: null, created_at: authority.as_of, updated_at: authority.as_of,
    });
    render(<QueryPage />);
    const input = await screen.findByLabelText("Query coverage");
    fireEvent.change(input, { target: { value: "which issuers are most levered" } });
    expect(screen.getByRole("button", { name: "metric" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Run Query" }));
    await waitFor(() => expect(mocks.createQueryRun).toHaveBeenCalledWith(expect.objectContaining({
      context_id: "context-1", selected_lane: "metric", question: "which issuers are most levered",
    })));
    expect(await screen.findByText("Atlas Forge")).toBeTruthy();
  });

  it("keeps the composer usable and names alternatives when a grounded lane is partial", async () => {
    mocks.createQueryRun.mockResolvedValue({
      id: "run-2", context_id: "context-1", question: "explain the evidence",
      selected_lane: "grounded", method_override: null, status: "partial",
      result: { missing_dependencies: ["model_provider"], available_lanes: ["metric", "graph"], recovery: "Choose a deterministic lane." },
      authority: { ...authority, method: "grounded" }, error: null,
      created_at: authority.as_of, updated_at: authority.as_of,
    });
    render(<QueryPage />);
    const input = await screen.findByLabelText("Query coverage");
    fireEvent.change(input, { target: { value: "explain the evidence" } });
    expect(screen.getByRole("button", { name: "grounded" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Run Query" }));
    expect(await screen.findByText("Question preserved")).toBeTruthy();
    expect(screen.getByText(/metric · graph/)).toBeTruthy();
    expect(screen.getByLabelText("Query coverage")).toBeTruthy();
  });

  it("keeps Run Query disabled until a question is entered", async () => {
    render(<QueryPage />);
    expect((await screen.findByRole("button", { name: "Run Query" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps composer interactions inert until the analysis context is ready", async () => {
    mocks.context = null;
    const { rerender } = render(<QueryPage />);
    expect((screen.getByRole("button", { name: "graph" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Query coverage") as HTMLTextAreaElement).disabled).toBe(true);

    mocks.context = { id: "context-1", name: "Coverage", sector_id: null, query_session_id: null, filters: {}, selected: {} };
    rerender(<QueryPage />);
    expect((screen.getByRole("button", { name: "graph" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText("Query coverage") as HTMLTextAreaElement).disabled).toBe(false);
  });

  it("surfaces a rejected run and retries without an unhandled promise", async () => {
    mocks.createQueryRun
      .mockRejectedValueOnce(new Error("query transport failed"))
      .mockResolvedValueOnce({
        id: "run-retry", context_id: "context-1", question: "retry this query",
        selected_lane: "metric", method_override: null, status: "ready",
        result: { answer: "Recovered answer" }, authority, error: null,
        created_at: authority.as_of, updated_at: authority.as_of,
      });
    render(<QueryPage />);
    fireEvent.change(await screen.findByLabelText("Query coverage"), { target: { value: "retry this query" } });
    fireEvent.click(screen.getByRole("button", { name: "Run Query" }));
    expect((await screen.findByRole("alert")).textContent).toContain("query transport failed");
    fireEvent.click(screen.getByRole("button", { name: "Retry query" }));
    expect(await screen.findByText("Recovered answer")).toBeTruthy();
  });

  it("keeps a failed finding pin visibly retryable", async () => {
    mocks.createQueryRun.mockResolvedValue({
      id: "run-pin", context_id: "context-1", question: "pin this",
      selected_lane: "metric", method_override: null, status: "ready",
      result: { answer: "Pin candidate" }, authority, error: null,
      created_at: authority.as_of, updated_at: authority.as_of,
    });
    mocks.createFinding.mockRejectedValueOnce(new Error("pin failed")).mockResolvedValueOnce({});
    render(<QueryPage />);
    fireEvent.change(await screen.findByLabelText("Query coverage"), { target: { value: "pin this" } });
    fireEvent.click(screen.getByRole("button", { name: "Run Query" }));
    fireEvent.click(await screen.findByRole("button", { name: "Pin finding" }));
    expect((await screen.findByRole("alert")).textContent).toContain("pin failed");
    fireEvent.click(screen.getByRole("button", { name: "Retry pin" }));
    await waitFor(() => expect(mocks.createFinding).toHaveBeenCalledTimes(2));
  });

  it("ignores history from a superseded context", async () => {
    let resolveA!: (rows: never[]) => void;
    let resolveB!: (rows: never[]) => void;
    mocks.listQueryRuns
      .mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveB = resolve; }));
    const { rerender } = render(<QueryPage />);
    await waitFor(() => expect(mocks.listQueryRuns).toHaveBeenCalledWith("context-1"));
    mocks.context = { ...mocks.context!, id: "context-2", name: "Second context" };
    rerender(<QueryPage />);
    await waitFor(() => expect(mocks.listQueryRuns).toHaveBeenCalledWith("context-2"));
    fireEvent.click(screen.getByRole("button", { name: "Open Query utilities" }));

    resolveB([{ id: "run-b", question: "Context B history" }] as never[]);
    await screen.findByText("Context B history");
    resolveA([{ id: "run-a", question: "Context A stale history" }] as never[]);
    await Promise.resolve();
    expect(screen.queryByText("Context A stale history")).toBeNull();
  });

  it("does not publish a deferred query completion into a replacement context", async () => {
    let resolveA!: (run: never) => void;
    mocks.createQueryRun.mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }));
    const { rerender } = render(<QueryPage />);
    fireEvent.change(await screen.findByLabelText("Query coverage"), { target: { value: "context A question" } });
    fireEvent.click(screen.getByRole("button", { name: "Run Query" }));
    await waitFor(() => expect(mocks.createQueryRun).toHaveBeenCalledWith(expect.objectContaining({ context_id: "context-1" })));

    mocks.context = { ...mocks.context!, id: "context-2", name: "Second context" };
    rerender(<QueryPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Run Query" })).toBeTruthy());
    resolveA({
      id: "run-stale", context_id: "context-1", question: "context A question",
      selected_lane: "metric", status: "ready", result: { answer: "Stale A answer" },
      authority, error: null, created_at: authority.as_of, updated_at: authority.as_of,
    } as never);
    await Promise.resolve();

    expect(screen.queryByText("Stale A answer")).toBeNull();
    expect(mocks.setContext).not.toHaveBeenCalled();
  });
});
