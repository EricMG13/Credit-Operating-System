// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  context: { id: "context-a", name: "ASK A" },
  createQueryRun: vi.fn(),
  createFinding: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/command",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/shared/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "analyst" }, needsLogin: false }),
}));
vi.mock("@/components/shared/ModalBackdrop", () => ({
  ModalBackdrop: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/use-modal-a11y", () => ({ useModalA11y: () => ({ current: null }), hasOpenModalA11yOverlay: () => false }));
vi.mock("@/components/query/GraphCanvas", () => ({ GraphCanvas: () => <div>graph canvas</div> }));
vi.mock("@/components/query/RelativeValueTable", () => ({ RelativeValueTable: () => <div>rv table</div> }));
vi.mock("@/components/query/ScatterCanvas", () => ({ ScatterCanvas: () => <div>scatter</div> }));
vi.mock("@/components/query/LineageFlow", () => ({ LineageFlow: () => <div>lineage</div> }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  queryCapabilities: vi.fn().mockResolvedValue({
    groups: [{
      id: "graph", label: "Graph", icon: "", ready: 1, total: 1,
      capabilities: [{ id: "peer-set", label: "Peer set", mode: "peers", enabled: true, reason: null }],
    }],
    availability: {},
  }),
}));
vi.mock("@/lib/analysis-workbench", () => ({
  useAnalysisContext: () => ({ context: mocks.context, error: null }),
  analysisApi: {
    createQueryRun: mocks.createQueryRun,
    createFinding: mocks.createFinding,
  },
}));

import { AskLauncher, AskProvider } from "./Ask";

const authority = {
  origin: "live", method: "graph", freshness: "current", as_of: "2026-07-16T00:00:00Z",
  source_ids: ["source-1"], run_id: "run-a", version_id: null, confidence: 0.9,
  approval_state: "draft", analyst_override: null,
};

function queryRun(id: string, contextId: string, title: string) {
  return {
    id, context_id: contextId, question: title, selected_lane: "graph", status: "ready",
    result: { capability_id: "peer-set", mode: "peers", title, nodes: [], edges: [], meta: [], caveats: [] },
    authority: { ...authority, run_id: id }, error: null,
    created_at: authority.as_of, updated_at: authority.as_of,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.context = { id: "context-a", name: "ASK A" };
});

describe("ASK finding pin scope", () => {
  it("clears the Command Center bottom action strip", () => {
    render(<AskProvider><AskLauncher /></AskProvider>);

    const launcher = screen.getByRole("button", { name: /Ask/ });
    expect(launcher.className).toContain("bottom-16");
    expect(launcher.className).not.toContain("bottom-3");
  });

  it("ignores a stale pin rejection after both the query run and context change", async () => {
    let rejectPin!: (reason: Error) => void;
    mocks.createQueryRun
      .mockResolvedValueOnce(queryRun("run-a", "context-a", "Graph A"))
      .mockResolvedValueOnce(queryRun("run-b", "context-b", "Graph B"));
    mocks.createFinding.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectPin = reject; }));

    const view = render(<AskProvider><AskLauncher /></AskProvider>);
    fireEvent.click(await screen.findByRole("button", { name: /Ask/ }));
    fireEvent.click(await screen.findByText("Map today's closest credit peers"));
    expect(await screen.findByText("Graph A")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "PIN FINDING" }));
    await waitFor(() => expect(mocks.createFinding).toHaveBeenCalledWith(expect.objectContaining({
      context_id: "context-a", source_run_id: "run-a",
    })));

    mocks.context = { id: "context-b", name: "ASK B" };
    view.rerender(<AskProvider><AskLauncher /></AskProvider>);
    fireEvent.change(screen.getByLabelText("Query coverage"), { target: { value: "peer set" } });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText("Graph B")).toBeTruthy();

    await act(async () => { rejectPin(new Error("stale pin failed")); await Promise.resolve(); });
    expect(screen.queryByText(/stale pin failed/)).toBeNull();
    expect(screen.getByRole("button", { name: "PIN FINDING" })).toBeTruthy();
  });
});
