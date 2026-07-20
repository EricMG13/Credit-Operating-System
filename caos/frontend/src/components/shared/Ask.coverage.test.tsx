// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Capability, CapabilitiesResult, GraphNode, GraphResult } from "@/lib/query/graph";

const state = vi.hoisted(() => ({
  pathname: "/command",
  search: "",
  user: { id: "analyst-1" } as { id: string } | null,
  needsLogin: false,
  context: { id: "ctx-ask" } as { id: string } | null,
  contextError: null as string | null,
  live: { status: "ready" } as unknown,
  queryCapabilities: vi.fn(),
  getIssuer: vi.fn(),
  createQueryRun: vi.fn(),
  createFinding: vi.fn(),
  downloadQueryCsv: vi.fn(),
  print: vi.fn(),
  liveRun: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams(state.search),
}));
vi.mock("@/components/shared/AuthProvider", () => ({
  useAuth: () => ({ user: state.user, needsLogin: state.needsLogin }),
}));
vi.mock("@/components/shared/ModalBackdrop", () => ({
  ModalBackdrop: ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div><button onClick={onClose}>close backdrop</button>{children}</div>
  ),
}));
vi.mock("@/lib/use-modal-a11y", () => ({ useModalA11y: () => ({ current: null }), hasOpenModalA11yOverlay: () => false }));
vi.mock("@/lib/engine/useLiveRun", () => ({
  useLiveRun: (issuerId: string) => {
    state.liveRun(issuerId);
    return state.live;
  },
}));
vi.mock("@/components/deepdive/IssuerChat", () => ({
  IssuerChat: ({ onClose, live, issuerName }: { onClose: () => void; live?: unknown; issuerName?: string }) => (
    <div data-testid="issuer-chat">
      <span>{issuerName ?? "reference issuer"}</span>
      <span>{live ? "live run" : "fixture run"}</span>
      <button onClick={onClose}>close issuer chat</button>
    </div>
  ),
}));
vi.mock("@/components/query/GraphCanvas", () => ({
  GraphCanvas: ({ onOpenChunk, onSelectNode }: { onOpenChunk: (id: string, label: string) => void; onSelectNode: (node: GraphNode) => void }) => (
    <div>
      <span>graph canvas</span>
      <button onClick={() => onOpenChunk("chunk-1", "Credit agreement")}>open citation</button>
      <button onClick={() => onSelectNode(RICH_NODE)}>select graph node</button>
    </div>
  ),
}));
vi.mock("@/components/query/RelativeValueTable", () => ({
  RelativeValueTable: ({ onSelectNode }: { onSelectNode: (node: GraphNode) => void }) => (
    <div><span>rv table</span><button onClick={() => onSelectNode(RICH_NODE)}>select table node</button></div>
  ),
}));
vi.mock("@/components/query/ScatterCanvas", () => ({
  ScatterCanvas: ({ onSelectNode }: { onSelectNode: (node: GraphNode) => void }) => (
    <div><span>scatter canvas</span><button onClick={() => onSelectNode(RICH_NODE)}>select scatter node</button></div>
  ),
}));
vi.mock("@/components/query/LineageFlow", () => ({
  LineageFlow: ({ onSelectNode }: { onSelectNode: (node: GraphNode) => void }) => (
    <div><span>lineage flow</span><button onClick={() => onSelectNode(RICH_NODE)}>select lineage node</button></div>
  ),
}));
vi.mock("@/components/command/CitationViewer", () => ({
  CitationViewer: ({ chunkId, label, onClose }: { chunkId: string; label?: string | null; onClose: () => void }) => (
    <div role="dialog" aria-label="citation viewer">{chunkId} · {label}<button onClick={onClose}>close citation</button></div>
  ),
}));
vi.mock("@/lib/query/export", () => ({
  downloadQueryCsv: (...args: unknown[]) => state.downloadQueryCsv(...args),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  queryCapabilities: () => state.queryCapabilities(),
  getIssuer: (...args: unknown[]) => state.getIssuer(...args),
}));
vi.mock("@/lib/analysis-workbench", () => ({
  useAnalysisContext: () => ({ context: state.context, error: state.contextError }),
  analysisApi: {
    createQueryRun: (...args: unknown[]) => state.createQueryRun(...args),
    createFinding: (...args: unknown[]) => state.createFinding(...args),
  },
}));

import { AskLauncher, AskProvider, useAsk } from "./Ask";

const RICH_NODE: GraphNode = {
  id: "node-1",
  label: "Atlas Forge term loan",
  kind: "document-chunk",
  x: 0.4,
  y: 0.6,
  sub: "First-lien leverage evidence",
  title: "Leverage is 5.2x at the latest observation.",
  group: "Capital structure",
  confidence: "High",
  obsidian_url: "obsidian://open?vault=Credit&file=Atlas",
};

const AUTHORITY = {
  origin: "live",
  method: "graph",
  freshness: "current",
  as_of: "2026-07-16T00:00:00Z",
  source_ids: ["source-1"],
  run_id: "query-run",
  version_id: null,
  confidence: 0.9,
  approval_state: "draft",
  analyst_override: null,
};

const capabilities = (...items: Capability[]): CapabilitiesResult => ({
  groups: [{ id: "graph", label: "Graph", icon: "", ready: items.filter((c) => c.enabled).length, total: items.length, capabilities: items }],
  availability: {},
});

const CAP_PEERS: Capability = { id: "peer-set", label: "Peer set", mode: "peers", enabled: true, reason: null };
const CAP_SCATTER: Capability = { id: "scatter", label: "Leverage scatter", mode: "scatter", enabled: true, reason: null };
const CAP_TRACE: Capability = { id: "trace-source", label: "Trace source", mode: "provenance", enabled: true, reason: null };

function graph(capabilityId = "peer-set", mode = "peers", title = "Peer graph"): GraphResult {
  return {
    capability_id: capabilityId,
    mode,
    title,
    nodes: [RICH_NODE],
    edges: [],
    meta: ["12 issuers", "current"],
    caveats: ["Observed data only"],
  };
}

function queryRun(result: GraphResult, overrides: Record<string, unknown> = {}) {
  return {
    id: `run-${result.capability_id}`,
    context_id: "ctx-ask",
    question: result.title,
    selected_lane: "graph",
    status: "ready",
    result,
    authority: AUTHORITY,
    error: null,
    created_at: AUTHORITY.as_of,
    updated_at: AUTHORITY.as_of,
    ...overrides,
  };
}

function AskControls() {
  const ask = useAsk();
  return (
    <div>
      <span data-testid="ask-state">{ask.open ? "open" : "closed"} · {ask.prefill ?? "no prefill"}</span>
      <button onClick={() => ask.openWith("prefilled covenant question")}>open with text</button>
      <button onClick={() => ask.openWith()}>open plain</button>
      <button onClick={ask.toggle}>toggle ask</button>
      <button onClick={() => ask.setOpen(true)}>set ask open</button>
      <button onClick={() => ask.setOpen(false)}>set ask closed</button>
    </div>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  state.pathname = "/command";
  state.search = "";
  state.user = { id: "analyst-1" };
  state.needsLogin = false;
  state.context = { id: "ctx-ask" };
  state.contextError = null;
  state.live = { status: "ready" };
  state.queryCapabilities.mockResolvedValue(capabilities(CAP_PEERS, CAP_SCATTER, CAP_TRACE));
  state.getIssuer.mockResolvedValue({ id: "issuer-real", name: "Kestrel Chemicals" });
  state.createQueryRun.mockImplementation(({ capability_id }: { capability_id: string }) => {
    if (capability_id === "scatter") return Promise.resolve(queryRun(graph("scatter", "scatter", "Leverage scatter")));
    if (capability_id === "trace-source") return Promise.resolve(queryRun(graph("trace-source", "provenance", "Source lineage")));
    return Promise.resolve(queryRun(graph()));
  });
  state.createFinding.mockResolvedValue({ id: "finding-1" });
  Object.defineProperty(window, "print", { configurable: true, value: state.print });
});

afterEach(() => cleanup());

describe("Ask provider and launcher coverage", () => {
  it("keeps the context defaults safe outside a provider", () => {
    render(<AskControls />);
    fireEvent.click(screen.getByRole("button", { name: "set ask open" }));
    fireEvent.click(screen.getByRole("button", { name: "toggle ask" }));
    fireEvent.click(screen.getByRole("button", { name: "open plain" }));
    expect(screen.getByTestId("ask-state").textContent).toContain("closed · no prefill");
  });

  it("coordinates every provider entry point, keyboard close, global toggle, and competing modal", async () => {
    const modalOwners: string[] = [];
    window.addEventListener("caos:modal-open", (event: Event) => {
      modalOwners.push((event as CustomEvent<{ owner: string }>).detail.owner);
    });
    render(<AskProvider><AskControls /></AskProvider>);

    fireEvent.click(screen.getByRole("button", { name: "open with text" }));
    expect(screen.getByTestId("ask-state").textContent).toContain("open · prefilled covenant question");
    expect(modalOwners).toContain("ask");
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.getByTestId("ask-state").textContent).toContain("closed · no prefill"));

    fireEvent(window, new Event("caos:ask-toggle"));
    expect(screen.getByTestId("ask-state").textContent).toContain("open");
    fireEvent(window, new CustomEvent("caos:modal-open", { detail: { owner: "issuer-profile" } }));
    expect(screen.getByTestId("ask-state").textContent).toContain("closed");
    fireEvent.click(screen.getByRole("button", { name: "set ask open" }));
    fireEvent.click(screen.getByRole("button", { name: "set ask closed" }));
    fireEvent.click(screen.getByRole("button", { name: "toggle ask" }));
    fireEvent.click(screen.getByRole("button", { name: "toggle ask" }));
    expect(screen.getByTestId("ask-state").textContent).toContain("closed");
  });

  it("turns both query-route entry points into focus events instead of a modal", () => {
    state.pathname = "/query/investigation";
    let focusEvents = 0;
    window.addEventListener("caos:query-focus", () => { focusEvents += 1; });
    render(<AskProvider><AskControls /><AskLauncher /></AskProvider>);
    expect(screen.queryByRole("button", { name: /Ask CAOS/ })).toBeNull();
    expect(document.querySelector(".caos-ask-dock")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "open plain" }));
    fireEvent(window, new Event("caos:ask-toggle"));
    expect(focusEvents).toBe(2);
    expect(screen.getByTestId("ask-state").textContent).toContain("closed");
  });

  it("gates signed-out users and positions authenticated launchers by surface", () => {
    state.user = null;
    const view = render(<AskProvider><AskLauncher /></AskProvider>);
    expect(screen.queryByRole("button", { name: /Ask/ })).toBeNull();

    state.user = { id: "analyst-1" };
    state.needsLogin = true;
    view.rerender(<AskProvider><AskLauncher /></AskProvider>);
    expect(screen.queryByRole("button", { name: /Ask/ })).toBeNull();

    state.needsLogin = false;
    state.pathname = "/sector/industrials";
    view.rerender(<AskProvider><AskLauncher /></AskProvider>);
    expect(screen.getByRole("button", { name: /Ask/ }).className).toContain("bottom-16");

    state.pathname = "/reports";
    view.rerender(<AskProvider><AskLauncher /></AskProvider>);
    expect(screen.getByRole("button", { name: /Ask/ }).className).toContain("bottom-3");
  });

  it("lets Deep-Dive own the open chat while the global launcher only owns its trigger", () => {
    state.pathname = "/deepdive";
    render(<AskProvider><AskControls /><AskLauncher /></AskProvider>);
    expect(document.querySelector(".caos-ask-dock")).not.toBeNull();
    fireEvent.click(screen.getByTitle(/Ask CAOS/));
    expect(screen.getByTestId("ask-state").textContent).toContain("open");
    expect(document.querySelector(".caos-ask-dock")).not.toBeNull();
    expect(screen.queryByTestId("issuer-chat")).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Ask with Query" })).toBeNull();
  });

  it("grounds issuer-scoped Ask in reference fixtures and real issuer data", async () => {
    state.pathname = "/model";
    const view = render(<AskProvider><AskLauncher /></AskProvider>);
    fireEvent.click(screen.getByTitle(/Ask CAOS/));
    expect(screen.getByTestId("issuer-chat").textContent).toContain("reference issuerfixture run");
    expect(state.liveRun).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "close issuer chat" }));

    cleanup();
    state.pathname = "/pipeline";
    state.search = "issuer=issuer-real";
    render(<AskProvider><AskLauncher /></AskProvider>);
    fireEvent.click(screen.getByTitle(/Ask CAOS/));
    expect(await screen.findByText("Kestrel Chemicals")).toBeTruthy();
    expect(screen.getByTestId("issuer-chat").textContent).toContain("live run");
    expect(state.getIssuer).toHaveBeenCalledWith("issuer-real");
    view.unmount();
  });

  it("keeps an unresolved real issuer anonymous when name lookup fails", async () => {
    state.pathname = "/issuers/profile";
    state.search = "issuer=missing";
    state.getIssuer.mockRejectedValue(new Error("not found"));
    render(<AskProvider><AskLauncher /></AskProvider>);
    fireEvent.click(screen.getByTitle(/Ask CAOS/));
    await waitFor(() => expect(state.getIssuer).toHaveBeenCalled());
    expect(screen.getByTestId("issuer-chat").textContent).toContain("reference issuerlive run");
  });
});

describe("Ask cross-issuer query coverage", () => {
  async function openAsk() {
    render(<AskProvider><AskLauncher /></AskProvider>);
    fireEvent.click(screen.getByTitle(/Ask CAOS/));
    return screen.findByRole("dialog", { name: "Ask with Query" });
  }

  it("loads enabled prompts, accepts palette prefill, ignores empty submission, and closes from the backdrop", async () => {
    render(<AskProvider><AskControls /><AskLauncher /></AskProvider>);
    fireEvent.click(screen.getByRole("button", { name: "open with text" }));
    const input = await screen.findByRole("textbox", { name: "Query coverage" }) as HTMLInputElement;
    expect(input.value).toBe("prefilled covenant question");
    await screen.findByText("Map today's closest credit peers");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.queryByText("Submit a query to view results.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "close backdrop" }));
    expect(screen.queryByRole("dialog", { name: "Ask with Query" })).toBeNull();
  });

  it("renders capability-load failures and the default error message", async () => {
    state.queryCapabilities.mockRejectedValueOnce(new Error("capability endpoint offline"));
    await openAsk();
    fireEvent.change(screen.getByRole("textbox", { name: "Query coverage" }), { target: { value: "peer" } });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText(/capability endpoint offline/)).toBeTruthy();
    cleanup();

    state.queryCapabilities.mockRejectedValueOnce({});
    await openAsk();
    fireEvent.change(screen.getByRole("textbox", { name: "Query coverage" }), { target: { value: "peer" } });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText(/could not load capabilities/)).toBeTruthy();
  });

  it("suggests runnable capabilities for unmatched and disabled questions, then resets search", async () => {
    const disabled: Capability = { id: "impact-analysis", label: "Impact analysis", mode: "impact", enabled: false, reason: "requires a current run" };
    const alternative: Capability = { id: "open-findings", label: "Impact alternative", mode: "findings", enabled: true, reason: null };
    state.queryCapabilities.mockResolvedValue(capabilities(disabled, alternative));
    await openAsk();
    const input = await screen.findByRole("textbox", { name: "Query coverage" });

    fireEvent.change(input, { target: { value: "unrelated gibberish" } });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText("No capability matched. Try one of these:")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Impact alternative" })).toBeTruthy();
    fireEvent.click(screen.getByTitle("Back to search"));

    const resetInput = screen.getByRole("textbox", { name: "Query coverage" }) as HTMLInputElement;
    expect(resetInput.value).toBe("");
    fireEvent.change(resetInput, { target: { value: "impact analysis impact" } });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText(/requires a current run/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Impact alternative" }));
    expect(await screen.findByText("Peer graph")).toBeTruthy();
  });

  it("fails safely when analysis context is unavailable", async () => {
    state.context = null;
    state.contextError = "Context bootstrap failed";
    await openAsk();
    fireEvent.click(await screen.findByText("Map today's closest credit peers"));
    expect(await screen.findByText(/Context bootstrap failed/)).toBeTruthy();
    expect(state.createQueryRun).not.toHaveBeenCalled();
  });

  it("renders rich graph results, all node details, citation, exports, pin success, and back reset", async () => {
    await openAsk();
    fireEvent.click(await screen.findByText("Map today's closest credit peers"));
    expect(await screen.findByText("Peer graph")).toBeTruthy();
    expect(screen.getByText("rv table")).toBeTruthy();
    expect(screen.getByText("Observed data only")).toBeTruthy();
    expect(screen.getByText(/12 issuers/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "select table node" }));
    expect(screen.getByRole("complementary", { name: "Node detail reader" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Graph" }));
    expect(await screen.findByText("graph canvas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "open citation" }));
    expect(screen.getByRole("dialog", { name: "citation viewer" }).textContent).toContain("chunk-1 · Credit agreement");
    fireEvent.click(screen.getByRole("button", { name: "close citation" }));

    fireEvent.click(screen.getByRole("button", { name: "select graph node" }));
    const reader = screen.getByRole("complementary", { name: "Node detail reader" });
    expect(reader.textContent).toContain("document chunk");
    expect(reader.textContent).toContain("First-lien leverage evidence");
    expect(reader.textContent).toContain("Capital structure");
    expect(reader.textContent).toContain("High");
    expect(screen.getByRole("link", { name: /REVEAL IN OBSIDIAN/ }).getAttribute("href")).toContain("obsidian://");
    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));

    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    expect(state.downloadQueryCsv).toHaveBeenCalledWith(expect.objectContaining({ title: "Peer graph" }));
    expect(state.print).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "PIN FINDING" }));
    expect(await screen.findByRole("button", { name: "PINNED" })).toBeTruthy();
    expect(state.createFinding).toHaveBeenCalledWith(expect.objectContaining({
      context_id: "ctx-ask",
      source_surface: "global-ask",
      body: "Peer graph",
    }));
    fireEvent.click(screen.getByTitle("Back to search"));
    expect(screen.queryByText("Peer graph")).toBeNull();
  });

  it("uses scatter and lineage native views and opens their reader callbacks", async () => {
    await openAsk();
    fireEvent.click(await screen.findByText("Plot leverage × interest coverage across covered names"));
    expect(await screen.findByText("scatter canvas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "select scatter node" }));
    expect(screen.getByRole("complementary", { name: "Node detail reader" })).toBeTruthy();
    fireEvent.click(screen.getByTitle("Back to search"));

    fireEvent.click(await screen.findByText("Trace an IC verdict to its sources"));
    expect(await screen.findByText("lineage flow")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "select lineage node" }));
    expect(screen.getByRole("complementary", { name: "Node detail reader" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Graph" }));
    expect(screen.getByText("graph canvas")).toBeTruthy();
  });

  it("surfaces non-ready status, missing dependencies, response detail, and generic query errors", async () => {
    state.createQueryRun
      .mockResolvedValueOnce(queryRun(graph(), { status: "blocked", error: null, result: { ...graph(), missing_dependencies: ["CP-1"] } }))
      .mockResolvedValueOnce(queryRun(graph(), { status: "error", error: "explicit query error" }))
      .mockRejectedValueOnce({ response: { data: { detail: "server rejected query" } } })
      .mockRejectedValueOnce({});
    await openAsk();
    fireEvent.click(await screen.findByText("Map today's closest credit peers"));
    expect(await screen.findByText(/Query blocked.*Missing: CP-1/)).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Query coverage" }), { target: { value: "peer set" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Query coverage" }), { key: "Enter" });
    expect(await screen.findByText(/explicit query error/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText(/server rejected query/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText(/could not run query/)).toBeTruthy();
  });

  it("allows observed-empty runs and ignores an older run that resolves after a newer one", async () => {
    let resolveOld!: (value: ReturnType<typeof queryRun>) => void;
    state.createQueryRun
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(queryRun(graph("peer-set", "peers", "Newer graph"), { status: "observed-empty" }));
    await openAsk();
    fireEvent.click(await screen.findByText("Map today's closest credit peers"));
    fireEvent.change(screen.getByRole("textbox", { name: "Query coverage" }), { target: { value: "peer set" } });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText("Newer graph")).toBeTruthy();
    await act(async () => { resolveOld(queryRun(graph("peer-set", "peers", "Stale graph"))); await Promise.resolve(); });
    expect(screen.queryByText("Stale graph")).toBeNull();
    expect(screen.getByText("Newer graph")).toBeTruthy();
  });

  it("surfaces pin failures, retries successfully, and handles findings without duplicate body text", async () => {
    state.createQueryRun.mockResolvedValue(queryRun({ ...graph(), title: "" }));
    state.createFinding.mockRejectedValueOnce(new Error("pin endpoint offline")).mockResolvedValueOnce({ id: "finding-2" });
    await openAsk();
    fireEvent.click(await screen.findByText("Map today's closest credit peers"));
    await screen.findByText("rv table");
    fireEvent.click(screen.getByRole("button", { name: "PIN FINDING" }));
    expect((await screen.findByRole("alert")).textContent).toContain("pin endpoint offline");
    fireEvent.click(screen.getByRole("button", { name: "RETRY PIN" }));
    expect(await screen.findByRole("button", { name: "PINNED" })).toBeTruthy();
    expect(state.createFinding).toHaveBeenLastCalledWith(expect.objectContaining({ body: "" }));
  });
});
