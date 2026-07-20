// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { GraphResult } from "@/lib/query/graph";
import { RelativeValueTable } from "./RelativeValueTable";

afterEach(cleanup);

const centered: GraphResult = {
  capability_id: "peers",
  mode: "peer-set",
  title: "Peer set",
  meta: [],
  caveats: [],
  nodes: [
    { id: "focus", label: "Focus Co", kind: "center", x: 0, y: 0, center: true, group: "Media", sub: "Media", confidence: "High" },
    { id: "alpha-id", label: "Alpha", kind: "issuer", x: 1, y: 1, group: "Tech", sub: "Detail", confidence: "High", weight: 0.4 },
    { id: "beta-id", label: "Beta", kind: "issuer", x: 2, y: 2, group: "Media", confidence: "Medium" },
    { id: "gamma-id", label: "Gamma", kind: "evidence", x: 3, y: 3 },
  ],
  edges: [
    { source: "focus", target: "alpha-id", kind: "member", label: "#2", weight: 0.75 },
    { source: "beta-id", target: "focus", kind: "member", label: "peer" },
    { source: "alpha-id", target: "gamma-id", kind: "related", label: "#9", weight: 0.2 },
  ],
};

const provenance: GraphResult = {
  capability_id: "lineage",
  mode: "provenance",
  title: "Lineage",
  meta: [],
  caveats: [],
  nodes: [
    { id: "a", label: "Source", kind: "evidence", x: 0, y: 0, weight: 1.4 },
    { id: "b", label: "Metric", kind: "evidence", x: 1, y: 1 },
    { id: "c", label: "Claim", kind: "evidence", x: 2, y: 2, weight: 0.2 },
  ],
  edges: [
    { source: "a", target: "b", kind: "cite" },
    { source: "missing", target: "b", kind: "cite" },
    { source: "c", target: "missing", kind: "cite" },
  ],
};

function header(name: RegExp): HTMLElement {
  return screen.getAllByRole("button", { name }).find((element) => element.tagName === "TH")!;
}

describe("RelativeValueTable", () => {
  it("filters, selects, and sorts every rich peer-set column", () => {
    const onSelect = vi.fn();
    render(<RelativeValueTable graph={centered} selectedNodeId="alpha-id" onSelectNode={onSelect} />);

    expect(screen.getByText("focus")).toBeTruthy();
    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getAllByText("High")).toHaveLength(2);
    expect(screen.getByText("Medium")).toBeTruthy();

    const alpha = screen.getByRole("button", { name: /Alpha/ });
    expect(alpha.className).toContain("caos-selected");
    fireEvent.click(alpha);
    fireEvent.keyDown(alpha, { key: "Escape" });
    expect(onSelect).toHaveBeenCalledTimes(1);

    const fields = [/Node \/ Label/, /Kind/, /Group/, /Detail/, /Rank/, /Similarity/, /Conf\./];
    for (const field of fields) fireEvent.click(header(field));
    fireEvent.click(header(/Conf\./));
    fireEvent.keyDown(header(/Kind/), { key: "Enter" });
    fireEvent.keyDown(header(/Kind/), { key: " " });
    fireEvent.keyDown(header(/Kind/), { key: "Escape" });

    const filter = screen.getByRole("textbox", { name: "Filter nodes" });
    for (const [query, count] of [["alpha-id", 1], ["issuer", 2], ["tech", 1], ["detail", 1]] as const) {
      fireEvent.change(filter, { target: { value: query } });
      expect(screen.getByText(`Nodes: ${count} / 4`)).toBeTruthy();
    }
    fireEvent.change(filter, { target: { value: "no such node" } });
    expect(screen.getByText("No matching nodes found")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(screen.getByText("Nodes: 4 / 4")).toBeTruthy();
  });

  it("renders provenance degree and node-weight columns without a center", () => {
    const { rerender } = render(<RelativeValueTable graph={provenance} />);
    expect(screen.getByText("140%")).toBeTruthy();
    expect(screen.queryByText("focus")).toBeNull();

    fireEvent.click(header(/Weight/));
    fireEvent.click(header(/Weight/));
    fireEvent.click(header(/^In /));
    fireEvent.click(header(/^Out /));
    fireEvent.click(screen.getByRole("button", { name: /Metric/ }));

    rerender(<RelativeValueTable graph={{ ...provenance, mode: "other" as GraphResult["mode"], nodes: [] }} />);
    expect(screen.getByText("No matching nodes found")).toBeTruthy();
  });
});
