// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GraphResult } from "@/lib/query/graph";
import { GraphCanvas } from "./GraphCanvas";
import { LineageFlow } from "./LineageFlow";
import { RelativeValueTable } from "./RelativeValueTable";
import { ScatterCanvas } from "./ScatterCanvas";

vi.mock("./useGraphZoom", () => ({ useGraphZoom: () => vi.fn() }));

afterEach(cleanup);

const graph: GraphResult = {
  capability_id: "cap", mode: "provenance", title: "Credit lineage",
  meta: ["xdomain=1|8", "ydomain=0|5"], caveats: [],
  nodes: [
    { id: "center", label: "Very Long Focus Issuer Holdings", kind: "center", x: 0.5, y: 0.5, center: true, group: "Media", confidence: "High", weight: 1 },
    { id: "evidence", label: "Credit Agreement", kind: "evidence", x: 0.1, y: 0.2, sub: "Source", group: "Docs", chunk_id: "chunk-1" },
    { id: "metric", label: "Net leverage", kind: "metric", x: 0.3, y: 0.35, sub: "5.2x", group: "Metrics", compact: true },
    { id: "claim", label: "Leverage elevated", kind: "claim", x: 0.5, y: 0.4, flag: true },
    { id: "driver", label: "Revenue pressure", kind: "driver", x: 0.7, y: 0.6, dim: true },
    { id: "issuer", label: "Peer Co", kind: "issuer", x: 0.9, y: 0.8, exposed: true },
  ],
  edges: [
    { source: "evidence", target: "metric", kind: "cite", label: "#1", weight: 0.9 },
    { source: "metric", target: "claim", kind: "dep" },
    { source: "claim", target: "driver", kind: "driver" },
    { source: "driver", target: "center", kind: "accepted" },
    { source: "center", target: "issuer", kind: "member", label: "#2", weight: 0.7 },
  ],
};

describe("query visualization smoke", () => {
  it("renders graph, lineage, scatter and tabular views from the same rich payload", () => {
    const select = vi.fn();
    const openChunk = vi.fn();
    render(<>
      <GraphCanvas graph={graph} overlay={[{ source: "metric", target: "center", rationale: "proposal", chunk_ids: [], confidence: "High" }]} onOpenChunk={openChunk} onSelectNode={select} />
      <LineageFlow graph={graph} selectedNodeId="claim" onSelectNode={select} />
      <ScatterCanvas graph={graph} selectedNodeId="center" onSelectNode={select} />
      <RelativeValueTable graph={graph} selectedNodeId="center" onSelectNode={select} />
    </>);

    expect(screen.getAllByText("Credit lineage").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Net leverage").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /Net leverage/i })[0]);
    expect(select).toHaveBeenCalled();
  });

  it("renders an explicit empty graph state", () => {
    render(<GraphCanvas graph={{ ...graph, title: "No relationships", nodes: [], edges: [], meta: ["No qualifying links"] }} onOpenChunk={vi.fn()} />);
    expect(screen.getByText("No relationships")).toBeTruthy();
    expect(screen.getByText("No qualifying links")).toBeTruthy();
  });

  it("highlights adjacency, opens chunks, and renders a wiki-linked sector pill", () => {
    const openChunk = vi.fn();
    const select = vi.fn();
    const interactive: GraphResult = {
      ...graph,
      nodes: [
        { id: "sector", label: "Telecommunications Services and Infrastructure", kind: "sector", x: 0.2, y: 0.3, group: "Telecom", obsidian_url: "obsidian://open?vault=Credit&file=Telecom" },
        { id: "chunk", label: "Covenant extract", kind: "chunk", x: 0.5, y: 0.5, chunk_id: "chunk-77" },
        { id: "peer", label: "Peer issuer", kind: "issuer", x: 0.8, y: 0.7, group: "Telecom" },
      ],
      edges: [
        { source: "sector", target: "chunk", kind: "seq" },
        { source: "peer", target: "sector", kind: "bear" },
      ],
    };
    render(<GraphCanvas graph={interactive} onOpenChunk={openChunk} onSelectNode={select} />);
    const sector = screen.getByRole("button", { name: /Select Telecommunications/ });
    fireEvent.mouseEnter(sector.parentElement!);
    fireEvent.mouseLeave(sector.parentElement!);
    fireEvent.click(screen.getByRole("button", { name: "Select Covenant extract" }));
    expect(openChunk).toHaveBeenCalledWith("chunk-77", "Covenant extract");
    const wiki = screen.getByRole("link", { name: /Reveal Telecommunications/ });
    const stopPropagation = vi.fn();
    fireEvent.mouseDown(wiki, { stopPropagation });
    expect(wiki.getAttribute("href")).toContain("obsidian://open");
  });

  it("supports scatter hover, focus, click, and keyboard activation", () => {
    const select = vi.fn();
    render(<ScatterCanvas graph={graph} selectedNodeId="center" onSelectNode={select} />);
    const metric = screen.getByRole("button", { name: "Select Net leverage (metric)" });

    fireEvent.focus(metric);
    fireEvent.blur(metric);
    fireEvent.mouseEnter(metric);
    fireEvent.click(metric);
    fireEvent.keyDown(metric, { key: "Escape" });
    fireEvent.keyDown(metric, { key: "Enter" });
    fireEvent.keyDown(metric, { key: " " });
    fireEvent.mouseLeave(metric);

    expect(select).toHaveBeenCalledTimes(3);
    expect(select).toHaveBeenLastCalledWith(expect.objectContaining({ id: "metric" }));
  });

  it("renders normalized scatter fallbacks and ignores missing edge endpoints without a selector", () => {
    const sparse: GraphResult = {
      ...graph,
      meta: ["x = normalized position →"],
      nodes: [
        { id: "plain", label: "Unclassified point", kind: "unknown", x: 0.4, y: 0.6 },
        { id: "peer", label: "Peer point", kind: "issuer", x: 0.7, y: 0.3 },
      ],
      edges: [{ source: "plain", target: "missing", kind: "dep" }],
    };
    const view = render(<ScatterCanvas graph={sparse} />);
    expect(screen.getByText("x = normalized position →")).toBeTruthy();
    expect(screen.getAllByText("0.00").length).toBeGreaterThan(0);

    const plain = screen.getByRole("button", { name: "Select Unclassified point (unknown)" });
    fireEvent.click(plain);
    fireEvent.keyDown(plain, { key: "Enter" });
    view.rerender(<ScatterCanvas graph={sparse} selectedNodeId="plain" />);
    expect(screen.getByRole("button", { name: "Select Unclassified point (unknown)" })).toBeTruthy();

    view.rerender(<ScatterCanvas graph={{
      ...sparse,
      meta: ["xdomain=bad|8", "ydomain=0|bad"],
    }} />);
    expect(screen.getByText("positions normalized 0 → 1 (no metric axes)")).toBeTruthy();
  });
});
