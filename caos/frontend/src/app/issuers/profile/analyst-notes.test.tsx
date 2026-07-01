// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AnalystNotesPanel, analystNotesFromGraph } from "./ProfileContent";
import { queryGraph } from "@/lib/api";
import type { GraphResult } from "@/lib/query/graph";

vi.mock("next/navigation", () => ({ useSearchParams: vi.fn() }));
vi.mock("@/components/charts/G2Chart", () => ({ G2Chart: () => null }));
vi.mock("@/lib/api", () => ({
  getIssuerProfile: vi.fn(),
  queryGraph: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const graph = (nodes: GraphResult["nodes"]): GraphResult => ({
  capability_id: "analyst-memos",
  mode: "provenance",
  title: "Analyst memos for VMO2",
  nodes,
  edges: [],
  meta: [],
  caveats: [],
});

describe("AnalystNotesPanel", () => {
  it("extracts memo nodes from the graph", () => {
    expect(analystNotesFromGraph(graph([
      { id: "vmo2", label: "VMO2", kind: "center", x: 0.5, y: 0.5 },
      { id: "memo:1", label: "Downside read", kind: "claim", x: 0.1, y: 0.2, sub: "Watch leverage.", obsidian_url: "obsidian://note" },
    ]))).toEqual([
      { id: "memo:1", title: "Downside read", excerpt: "Watch leverage.", url: "obsidian://note" },
    ]);
  });

  it("renders linked notes with vault links", async () => {
    vi.mocked(queryGraph).mockResolvedValue(graph([
      { id: "memo:1", label: "Downside read", kind: "claim", x: 0.1, y: 0.2, sub: "Watch leverage.", obsidian_url: "obsidian://note" },
    ]));

    render(<AnalystNotesPanel issuerId="iss-1" issuerName="VMO2" ticker="VMO2" />);

    expect(await screen.findByText("Downside read")).toBeTruthy();
    expect(screen.getByText("Watch leverage.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "OPEN IN VAULT" }).getAttribute("href")).toBe("obsidian://note");
    expect(queryGraph).toHaveBeenCalledWith("analyst-memos", "iss-1");
  });

  it("renders the empty state", async () => {
    vi.mocked(queryGraph).mockResolvedValue(graph([]));

    render(<AnalystNotesPanel issuerId="iss-1" issuerName="VMO2" ticker="VMO2" />);

    expect(await screen.findByText("No analyst notes linked to this issuer. Add [[VMO2]] or [[VMO2]] in the vault.")).toBeTruthy();
  });

  it("renders a quiet error state", async () => {
    vi.mocked(queryGraph).mockRejectedValue({ response: { data: { detail: "sync failed" } } });

    render(<AnalystNotesPanel issuerId="iss-1" issuerName="VMO2" ticker={null} />);

    expect(await screen.findByText("Couldn't load analyst notes - sync failed")).toBeTruthy();
  });
});
