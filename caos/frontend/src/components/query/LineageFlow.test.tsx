// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { GraphResult } from "@/lib/query/graph";
import { LineageFlow } from "./LineageFlow";

afterEach(cleanup);

const nodes: GraphResult["nodes"] = [
  { id: "e1", label: "Evidence B", kind: "evidence", x: 0, y: 0, group: "Docs" },
  { id: "e0", label: "Evidence A", kind: "evidence", x: 0, y: 0.5 },
  { id: "e2", label: "Evidence A", kind: "chunk", x: 0, y: 1 },
  { id: "m1", label: "Metric", kind: "metric", x: 0.2, y: 0 },
  { id: "bull", label: "Bull point", kind: "point-bull", x: 0.2, y: 1 },
  { id: "bear", label: "Bear point", kind: "point-bear", x: 0.2, y: 2 },
  { id: "claim", label: "Claim", kind: "claim", x: 0.4, y: 0 },
  { id: "min", label: "Minor finding", kind: "finding-min", x: 0.4, y: 1 },
  { id: "mat", label: "Material finding", kind: "finding-mat", x: 0.4, y: 2 },
  { id: "driver", label: "Driver", kind: "driver", x: 0.6, y: 0 },
  { id: "module", label: "Module", kind: "module", x: 0.6, y: 1 },
  { id: "crit", label: "Critical finding", kind: "finding-crit", x: 0.6, y: 2 },
  { id: "center", label: "Conclusion", kind: "center", x: 0.8, y: 0 },
  { id: "issuer", label: "Issuer", kind: "issuer", x: 0.8, y: 1 },
  { id: "sector", label: "Sector", kind: "sector", x: 0.8, y: 2 },
  { id: "custom", label: "Custom", kind: "other-kind", x: 0.95, y: 3 },
];

const graph: GraphResult = {
  capability_id: "lineage",
  mode: "provenance",
  title: "Lineage",
  meta: [],
  caveats: [],
  nodes,
  edges: [
    { source: "e1", target: "m1" },
    { source: "m1", target: "claim" },
    { source: "claim", target: "driver" },
    { source: "driver", target: "center" },
    { source: "center", target: "issuer" },
    { source: "missing", target: "center" },
  ],
};

describe("LineageFlow", () => {
  it("renders the empty walk honestly", () => {
    render(<LineageFlow graph={{ ...graph, nodes: [], edges: [] }} />);
    expect(screen.getByText("No lineage steps for this walk.")).toBeTruthy();
  });

  it("groups every node kind and traces keyboard, focus, and pointer lineage", () => {
    const onSelect = vi.fn();
    const { container } = render(<LineageFlow graph={graph} selectedNodeId="claim" onSelectNode={onSelect} />);
    expect(screen.getByText("Raw Sources")).toBeTruthy();
    expect(screen.getByText("Final Conclusion")).toBeTruthy();
    expect(container.querySelectorAll("path").length).toBe(5);

    const claim = screen.getByRole("button", { name: /Claim/ });
    fireEvent.click(claim);
    fireEvent.keyDown(claim, { key: "Enter" });
    fireEvent.keyDown(claim, { key: " " });
    fireEvent.keyDown(claim, { key: "Escape" });
    expect(onSelect).toHaveBeenCalledTimes(3);

    const metric = screen.getByRole("button", { name: /Metric/ });
    fireEvent.focus(metric);
    expect(metric.className).toContain("shadow-pop");
    fireEvent.blur(metric);
    fireEvent.mouseEnter(metric);
    expect(metric.className).toContain("shadow-pop");
    fireEvent.mouseLeave(metric);
    expect(screen.getByRole("button", { name: /Evidence B/ }).textContent).toContain("Docs");
  });

  it("allows rendering and interaction without a selection callback", () => {
    render(<LineageFlow graph={{ ...graph, nodes: [nodes[0], nodes[1]], edges: [{ source: "e1", target: "e0" }] }} />);
    const node = screen.getByRole("button", { name: /Evidence B/ });
    expect(() => {
      fireEvent.click(node);
      fireEvent.keyDown(node, { key: "Enter" });
    }).not.toThrow();
  });
});
