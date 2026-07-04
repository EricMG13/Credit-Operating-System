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
      let level = 4;
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
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <g>
            {graph.edges.map((e, idx) => {
              const fromPos = nodeCoordinates[e.source];
              const toPos = nodeCoordinates[e.target];
              if (!fromPos || !toPos) return null;

              // Check if edge is active in our highlighted lineage
              const isSourceActive = e.source === activeFocusId;
              const isTargetActive = e.target === activeFocusId;
              
              const isUpstreamTrace = activeLineage.upstream.has(e.source) && 
                (activeLineage.upstream.has(e.target) || e.target === activeFocusId);
              
              const isDownstreamTrace = activeLineage.downstream.has(e.target) && 
                (activeLineage.downstream.has(e.source) || e.source === activeFocusId);

              const isActive = isSourceActive || isTargetActive || isUpstreamTrace || isDownstreamTrace;
              const isDimmed = activeFocusId && !isActive;

              return (
                <path
                  key={`edge-${idx}`}
                  d={`M ${fromPos.x} ${fromPos.y} C ${fromPos.x + 4} ${fromPos.y}, ${toPos.x - 4} ${toPos.y}, ${toPos.x} ${toPos.y}`}
                  vectorEffect="non-scaling-stroke"
                  fill="none"
                  stroke={
                    isUpstreamTrace || (isTargetActive && activeLineage.upstream.has(e.source))
                      ? "var(--caos-accent)"
                      : isDownstreamTrace || (isSourceActive && activeLineage.downstream.has(e.target))
                      ? "var(--caos-warning)"
                      : "var(--caos-border)"
                  }
                  strokeWidth={isActive ? 2.0 : 0.8}
                  opacity={isActive ? 0.8 : isDimmed ? 0.04 : 0.3}
                  style={{ transition: "opacity 160ms" }}
                  className="motion-reduce:transition-none"
                />
              );
            })}
          </g>
        </svg>

        {/* Render columns side by side */}
        <div className="flex-1 flex h-full justify-between items-stretch z-10 px-4">
          {columns.map((col, colIdx) => (
            <div
              key={colIdx}
              className="flex-1 flex flex-col items-center justify-start py-4 border-r border-caos-border/20 last:border-r-0 select-none min-w-0"
            >
              {/* Column title */}
              <div className="text-center mb-6 shrink-0">
                <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted font-mono block">
                  Step {colIdx + 1}
                </span>
                <span className="tabular text-caos-xs font-semibold text-caos-text font-sans">
                  {COLUMN_TITLES[colIdx]}
                </span>
                <span className="tabular text-caos-3xs text-caos-muted font-mono block mt-0.5">
                  {col.length} item{col.length === 1 ? "" : "s"}
                </span>
              </div>

              {/* Column node stack container */}
              <div className="w-full flex-1 flex flex-col justify-around items-center px-2 min-h-0 overflow-y-auto custom-scrollbar gap-2">
                {col.map((node) => {
                  const nodeColor = hueFor(node.group);
                  const isFocused = node.id === activeFocusId;
                  const isSelected = node.id === selectedNodeId;

                  const isUpstream = activeLineage.upstream.has(node.id);
                  const isDownstream = activeLineage.downstream.has(node.id);
                  
                  const isHighlighted = isFocused || isSelected || isUpstream || isDownstream;
                  const isDimmed = activeFocusId && !isHighlighted;

                  return (
                    <div
                      key={node.id}
                      tabIndex={0}
                      role="button"
                      onClick={() => onSelectNode?.(node)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectNode?.(node);
                        }
                      }}
                      onFocus={() => setHoveredNodeId(node.id)}
                      onBlur={() => setHoveredNodeId(null)}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      style={{
                        opacity: isDimmed ? 0.25 : 1.0,
                        borderColor: isFocused 
                          ? "var(--caos-accent)" 
                          : isSelected 
                          ? "var(--caos-accent)" 
                          : isUpstream 
                          ? "var(--caos-accent)" 
                          : isDownstream 
                          ? "var(--caos-warning)" 
                          : "var(--caos-border)",
                      }}
                      className={`w-full max-w-[170px] bg-caos-panel/90 border rounded p-2 cursor-pointer transition-all duration-150 motion-reduce:transition-none flex flex-col gap-1 text-left relative focus-ring ${
                        isFocused || isSelected ? "shadow-pop bg-caos-elevated" : "hover:border-caos-accent/50"
                      }`}
                    >
                      {/* Indicator Tag / Category Badge */}
                      <div className="flex items-center justify-between gap-1 w-full">
                        <span className="tabular text-[8px] uppercase tracking-wider text-caos-muted font-mono truncate max-w-[70%]">
                          {node.kind.replace("-", " ")}
                        </span>
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: nodeColor === "var(--caos-muted)" ? "var(--caos-border)" : nodeColor,
                          }}
                        />
                      </div>

                      {/* Main Title / Label */}
                      <span
                        className={`tabular text-caos-xs text-caos-text font-sans font-medium line-clamp-2 leading-tight break-words ${
                          isFocused || isSelected ? "text-caos-accent" : ""
                        }`}
                        title={node.label}
                      >
                        {node.label}
                      </span>

                      {/* Small support details */}
                      {node.group && (
                        <span className="tabular text-[9px] text-caos-muted font-mono truncate">
                          {node.group}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
