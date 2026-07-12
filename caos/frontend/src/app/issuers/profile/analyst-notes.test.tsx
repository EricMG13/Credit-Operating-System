// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AnalystNotesPanel, analystNotesFromGraph } from "./ProfileContent";
import { queryGraph, uploadVaultMemo } from "@/lib/api";
import type { GraphResult } from "@/lib/query/graph";

vi.mock("next/navigation", () => ({ useSearchParams: vi.fn() }));
vi.mock("@/components/charts/G2Chart", () => ({ G2Chart: () => null }));
vi.mock("@/lib/api", () => ({
  getIssuerProfile: vi.fn(),
  getCrossDefaultMap: vi.fn(),
  queryGraph: vi.fn(),
  uploadVaultMemo: vi.fn(),
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

    expect(await screen.findByText("Couldn't load analyst notes — sync failed")).toBeTruthy();
  });

  it("logs a quick note tagged to the issuer through the vault memo path (D4)", async () => {
    vi.mocked(queryGraph).mockResolvedValue(graph([]));
    vi.mocked(uploadVaultMemo).mockResolvedValue(
      { note: "note.md", issuer_links: ["VMO2"] } as Awaited<ReturnType<typeof uploadVaultMemo>>,
    );

    render(<AnalystNotesPanel issuerId="iss-1" issuerName="VMO2" ticker="VMO2" />);

    fireEvent.click(await screen.findByRole("button", { name: "LOG NOTE" }));
    fireEvent.change(screen.getByLabelText("Note text"), {
      target: { value: "Q1 call: pricing holding up." },
    });
    fireEvent.click(screen.getByRole("button", { name: "SAVE NOTE" }));

    await waitFor(() => expect(uploadVaultMemo).toHaveBeenCalledTimes(1));
    const fd = vi.mocked(uploadVaultMemo).mock.calls[0][0] as FormData;
    expect(fd.get("memo_type")).toBe("memo");
    const file = fd.get("file") as File;
    expect(file.name).toMatch(/^note-\d{4}-\d{2}-\d{2}\.md$/);
    const text = await file.text();
    // The composed memo mentions the issuer so the server autolinker tags it —
    // that mention IS the "tagged" contract (no new store, no new schema).
    expect(text).toContain("VMO2");
    expect(text).toContain("Q1 call: pricing holding up.");
    // A vaulted note re-reads the analyst-memos walk so it appears immediately.
    await waitFor(() => expect(queryGraph).toHaveBeenCalledTimes(2));
  });
});
