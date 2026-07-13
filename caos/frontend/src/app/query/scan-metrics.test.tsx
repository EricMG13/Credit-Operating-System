// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  createQueryRun: vi.fn(),
  listQueryRuns: vi.fn().mockResolvedValue([]),
  listFindings: vi.fn().mockResolvedValue([]),
  createFinding: vi.fn(),
  setContext: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/query" }));
vi.mock("@/components/shared/RequireAuth", () => ({ RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  queryCapabilities: vi.fn().mockResolvedValue({ groups: [{ capabilities: [{ id: "peer-set", enabled: true }] }] }),
}));
vi.mock("@/lib/analysis-workbench", () => ({
  useAnalysisContext: () => ({
    context: { id: "context-1", name: "Coverage", sector_id: null, query_session_id: null, filters: {}, selected: {} },
    setContext: mocks.setContext,
    patch: vi.fn(),
    loading: false,
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

afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.listQueryRuns.mockResolvedValue([]); });

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
});
