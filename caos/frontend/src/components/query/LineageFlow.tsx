"use client";

import { useMemo, useState } from "react";
import type { GraphResult, GraphNode } from "@/lib/query/graph";
import { hueFor } from "./node-style";

interface LineageFlowProps {
  graph: GraphResult;
  selectedNodeId?: string | null;
  onSelectNode?: (node: GraphNode) => void;
}

const COLUMN_TITLES = [
  "Raw Sources",
  "Analytical Inputs",
  "Core Claims",
  "Drivers & Modules",
  "Final Conclusion",
];

type Coordinates = Record<string, { x: number; y: number }>;
type ActiveLineage = { upstream: Set<string>; downstream: Set<string> };
type GraphEdge = GraphResult["edges"][number];

function edgeStroke(upstream: boolean, downstream: boolean): string {
  if (upstream) return "var(--caos-accent)";
  if (downstream) return "var(--caos-warning)";
  return "var(--caos-border)";
}

function upstreamTrace(edge: GraphEdge, focusId: string | null | undefined, lineage: ActiveLineage): boolean {
  return lineage.upstream.has(edge.source) && (lineage.upstream.has(edge.target) || edge.target === focusId);
}

function downstreamTrace(edge: GraphEdge, focusId: string | null | undefined, lineage: ActiveLineage): boolean {
  return lineage.downstream.has(edge.target) && (lineage.downstream.has(edge.source) || edge.source === focusId);
}

function edgeVisualState(edge: GraphEdge, focusId: string | null | undefined, lineage: ActiveLineage) {
  const sourceActive = edge.source === focusId;
  const targetActive = edge.target === focusId;
  const upstream = upstreamTrace(edge, focusId, lineage);
  const downstream = downstreamTrace(edge, focusId, lineage);
  const active = [sourceActive, targetActive, upstream, downstream].some(Boolean);
  const upstreamStroke = [upstream, targetActive && lineage.upstream.has(edge.source)].some(Boolean);
  const downstreamStroke = [downstream, sourceActive && lineage.downstream.has(edge.target)].some(Boolean);
  return { active, dimmed: Boolean(focusId) && !active, stroke: edgeStroke(upstreamStroke, downstreamStroke) };
}

function edgeOpacity(active: boolean, dimmed: boolean): number {
  if (active) return 0.8;
  return dimmed ? 0.04 : 0.3;
}

function LineageEdgePath({ edge, index, coordinates, focusId, lineage }: {
  edge: GraphEdge; index: number; coordinates: Coordinates; focusId?: string | null; lineage: ActiveLineage;
}) {
  const from = coordinates[edge.source];
  const to = coordinates[edge.target];
  if (!from || !to) return null;
  const visual = edgeVisualState(edge, focusId, lineage);
  return (
    <path
      key={`edge-${index}`}
      d={`M ${from.x} ${from.y} C ${from.x + 4} ${from.y}, ${to.x - 4} ${to.y}, ${to.x} ${to.y}`}
      vectorEffect="non-scaling-stroke"
      fill="none"
      stroke={visual.stroke}
      strokeWidth={visual.active ? 2.0 : 0.8}
      opacity={edgeOpacity(visual.active, visual.dimmed)}
      style={{ transition: "opacity 160ms" }}
      className="motion-reduce:transition-none"
    />
  );
}

function nodeBorderColor(focused: boolean, selected: boolean, upstream: boolean, downstream: boolean): string {
  if (focused || selected || upstream) return "var(--caos-accent)";
  if (downstream) return "var(--caos-warning)";
  return "var(--caos-border)";
}

function LineageNodeCard({ node, focusId, selectedNodeId, lineage, onSelect, onHover }: {
  node: GraphNode; focusId?: string | null; selectedNodeId?: string | null; lineage: ActiveLineage;
  onSelect?: (node: GraphNode) => void; onHover: (id: string | null) => void;
}) {
  const nodeColor = hueFor(node.group);
  const focused = node.id === focusId;
  const selected = node.id === selectedNodeId;
  const upstream = lineage.upstream.has(node.id);
  const downstream = lineage.downstream.has(node.id);
  const highlighted = focused || selected || upstream || downstream;
  const dimmed = Boolean(focusId) && !highlighted;
  const activateFromKeyboard = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect?.(node);
  };
  return (
    <div
      tabIndex={0}
      role="button"
      onClick={() => onSelect?.(node)}
      onKeyDown={activateFromKeyboard}
      onFocus={() => onHover(node.id)}
      onBlur={() => onHover(null)}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      style={{ opacity: dimmed ? 0.25 : 1.0, borderColor: nodeBorderColor(focused, selected, upstream, downstream) }}
      className={`w-full max-w-[170px] bg-caos-panel/90 border rounded p-2 cursor-pointer transition-colors duration-150 motion-reduce:transition-none flex flex-col gap-1 text-left relative focus-ring ${focused || selected ? "shadow-pop bg-caos-elevated" : "hover:border-caos-accent/50"}`}
    >
      <div className="flex items-center justify-between gap-1 w-full">
        <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted font-mono truncate max-w-[70%]">{node.kind.replace("-", " ")}</span>
        <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: nodeColor === "var(--caos-muted)" ? "var(--caos-border)" : nodeColor }} />
      </div>
      <span className={`tabular text-caos-xs text-caos-text font-sans font-medium line-clamp-2 leading-tight break-words ${focused || selected ? "text-caos-accent" : ""}`} title={node.label}>{node.label}</span>
      {node.group ? <span className="tabular text-caos-3xs text-caos-muted font-mono truncate">{node.group}</span> : null}
    </div>
  );
}

function LineageColumn({ nodes, index, focusId, selectedNodeId, lineage, onSelect, onHover }: {
  nodes: GraphNode[]; index: number; focusId?: string | null; selectedNodeId?: string | null; lineage: ActiveLineage;
  onSelect?: (node: GraphNode) => void; onHover: (id: string | null) => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-start py-4 border-r border-caos-border/20 last:border-r-0 select-none min-w-0">
      <div className="text-center mb-6 shrink-0">
        <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted font-mono block">Step {index + 1}</span>
        <span className="tabular text-caos-xs font-semibold text-caos-text font-sans">{COLUMN_TITLES[index]}</span>
        <span className="tabular text-caos-3xs text-caos-muted font-mono block mt-0.5">{nodes.length} item{nodes.length === 1 ? "" : "s"}</span>
      </div>
      <div className="w-full flex-1 flex flex-col justify-around items-center px-2 min-h-0 overflow-y-auto custom-scrollbar gap-2">
        {nodes.map((node) => <LineageNodeCard key={node.id} node={node} focusId={focusId} selectedNodeId={selectedNodeId} lineage={lineage} onSelect={onSelect} onHover={onHover} />)}
      </div>
    </div>
  );
}

export function LineageFlow({
  graph,
  selectedNodeId,
  onSelectNode,
}: LineageFlowProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Group nodes into 5 sequential columns/levels
  const columns = useMemo(() => {
    const cols: GraphNode[][] = Array.from({ length: 5 }, () => []);

    graph.nodes.forEach((n) => {
      let level: number;
      switch (n.kind) {
        case "evidence":
        case "chunk":
          level = 0;
          break;
        case "metric":
        case "point-bull":
        case "point-bear":
          level = 1;
          break;
        case "claim":
        case "finding-min":
        case "finding-mat":
          level = 2;
          break;
        case "driver":
        case "module":
        case "finding-crit":
          level = 3;
          break;
        case "center":
        case "issuer":
        case "sector":
          level = 4;
          break;
        default:
          level = Math.max(0, Math.min(4, Math.floor(n.x * 5)));
          break;
      }
      cols[level].push(n);
    });

    // Sort nodes inside columns by kind then weight or label
    cols.forEach((col) => {
      col.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
        return a.label.localeCompare(b.label);
      });
    });

    return cols;
  }, [graph.nodes]);

  // Map nodes to their position coordinates in the columns view
  const nodeCoordinates = useMemo(() => {
    const coords: Record<string, { x: number; y: number }> = {};
    const colWidth = 100 / 5; // column width in percent

    columns.forEach((col, colIdx) => {
      const xPercent = colWidth * colIdx + colWidth / 2;
      const count = col.length;

      col.forEach((node, nodeIdx) => {
        // Distribute y coordinates evenly in column height
        const yPercent = count > 1 
          ? 10 + (nodeIdx / (count - 1)) * 80 
          : 50;
        coords[node.id] = { x: xPercent, y: yPercent };
      });
    });

    return coords;
  }, [columns]);

  const activeFocusId = hoveredNodeId || selectedNodeId;

  const hasNodes = graph.nodes.length > 0;

  // Trace upstream (parents) and downstream (children) nodes using BFS/DFS
  const activeLineage = useMemo(() => {
    if (!activeFocusId) {
      return { upstream: new Set<string>(), downstream: new Set<string>() };
    }

    const upstream = new Set<string>();
    const downstream = new Set<string>();

    // BFS Upstream
    let queue: string[] = [activeFocusId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      graph.edges.forEach((e) => {
        if (e.target === current && !upstream.has(e.source) && e.source !== activeFocusId) {
          upstream.add(e.source);
          queue.push(e.source);
        }
      });
    }

    // BFS Downstream
    queue = [activeFocusId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      graph.edges.forEach((e) => {
        if (e.source === current && !downstream.has(e.target) && e.target !== activeFocusId) {
          downstream.add(e.target);
          queue.push(e.target);
        }
      });
    }

    return { upstream, downstream };
  }, [graph.edges, activeFocusId]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-caos-bg text-caos-text font-sans">
      {/* Help header */}
      <div className="p-2.5 border-b border-caos-border bg-caos-panel/40 shrink-0 select-none">
        <span className="tabular text-caos-3xs text-caos-muted font-mono uppercase tracking-wider">
          Lineage Flow · Select or focus a node to highlight its direct upstream evidence or downstream impact paths.
        </span>
      </div>

      {!hasNodes ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 select-none">
          <div className="tabular text-caos-xs font-mono uppercase tracking-wider text-caos-text mb-1">Lineage</div>
          <div className="tabular text-caos-2xs text-caos-muted font-mono max-w-xs leading-normal">
            No lineage steps for this walk.
          </div>
        </div>
      ) : (
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* Draw SVG background connectors */}
        <svg
          aria-hidden="true"
          focusable="false"
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <g>
            {graph.edges.map((edge, index) => <LineageEdgePath key={`edge-${index}`} edge={edge} index={index} coordinates={nodeCoordinates} focusId={activeFocusId} lineage={activeLineage} />)}
          </g>
        </svg>

        {/* Render columns side by side */}
        <div className="flex-1 flex h-full justify-between items-stretch z-10 px-4">
          {columns.map((nodes, index) => <LineageColumn key={index} nodes={nodes} index={index} focusId={activeFocusId} selectedNodeId={selectedNodeId} lineage={activeLineage} onSelect={onSelectNode} onHover={setHoveredNodeId} />)}
        </div>
      </div>
      )}
    </div>
  );
}
