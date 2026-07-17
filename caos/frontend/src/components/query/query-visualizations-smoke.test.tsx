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
});
