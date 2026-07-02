"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import type { GraphResult, GraphNode } from "@/lib/query/graph";
import { nodeStyle } from "./node-style";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity } from "d3-zoom";
import type { ZoomBehavior, ZoomTransform } from "d3-zoom";

interface ScatterCanvasProps {
  graph: GraphResult;
  selectedNodeId?: string | null;
  onSelectNode?: (node: GraphNode) => void;
}

const W = 1000;
const H = 600;
const PAD = 78;

export function ScatterCanvas({
  graph,
  selectedNodeId,
  onSelectNode,
}: ScatterCanvasProps) {
  const px = (x: number) => PAD + x * (W - 2 * PAD);
  const py = (y: number) => PAD + y * (H - 2 * PAD);

  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Hovered node tracking for highlighting edges
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Setup D3 Zoom
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    
    const zoom = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        setTransform(event.transform);
      });
      
    zoomBehaviorRef.current = zoom;
    svg.call(zoom);
    svg.call(zoom.transform, zoomIdentity);
  }, [graph]);

  const handleResetZoom = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.transform, zoomIdentity);
    }
  };

  const byId = useMemo(() => Object.fromEntries(graph.nodes.map((n) => [n.id, n])), [graph]);

  // Compute active focus target: hovered node first, then selected node
  const activeFocusId = hoveredNodeId || selectedNodeId;

  // Filter edges connected to the active focus node
  const activeEdges = useMemo(() => {
    if (!activeFocusId) return [];
    return graph.edges.filter(
      (e) => e.source === activeFocusId || e.target === activeFocusId
    );
  }, [graph.edges, activeFocusId]);

  // Create a set of node IDs connected to active focus
  const activeConnectedNodeIds = useMemo(() => {
    if (!activeFocusId) return new Set<string>();
    const ids = new Set<string>([activeFocusId]);
    activeEdges.forEach((e) => {
      ids.add(e.source);
      ids.add(e.target);
    });
    return ids;
  }, [activeEdges, activeFocusId]);

  return (
    <div className="flex-1 min-h-0 flex flex-col relative select-none bg-caos-bg">
      {/* Reset view controller */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 bg-caos-panel/90 border border-caos-border rounded p-1">
        <button
          onClick={handleResetZoom}
          className="tabular text-caos-3xs uppercase tracking-wider px-2 py-1 rounded bg-caos-bg border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50 transition-caos focus-ring"
          title="Reset Zoom"
        >
          Reset View
        </button>
      </div>

      {/* Axis metadata overlay — real metric axes come from the builder's meta
          (e.g. "x = net leverage →"); the fallback names the normalized layout. */}
      <div className="absolute bottom-2 left-4 z-10 tabular text-caos-3xs text-caos-muted font-mono uppercase tracking-wider">
        {(() => {
          const axes = graph.meta.filter((m) => /^[xy] = /.test(m));
          return axes.length > 0 ? axes.join(" · ") : "positions normalized 0 → 1 (no metric axes)";
        })()}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
        role="group"
        aria-label={`Scatter Plot: ${graph.title}`}
      >
        <defs>
          <marker id="scatter-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--caos-accent)" />
          </marker>
        </defs>

        {/* View transform group */}
        <g transform={transform.toString()}>
          
          {/* Scatter Plot Grid Lines */}
          <g className="grid-lines" opacity={0.3}>
            {/* Horizontal lines */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((v) => (
              <line
                key={`h-${v}`}
                x1={px(0)}
                y1={py(v)}
                x2={px(1)}
                y2={py(v)}
                stroke="var(--caos-border)"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
            ))}
            {/* Vertical lines */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((v) => (
              <line
                key={`v-${v}`}
                x1={px(v)}
                y1={py(0)}
                x2={px(v)}
                y2={py(1)}
                stroke="var(--caos-border)"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
            ))}
          </g>

          {/* Connected linkages for active focus node */}
          {activeEdges.map((e, i) => {
            const a = byId[e.source];
            const b = byId[e.target];
            if (!a || !b) return null;

            return (
              <line
                key={`edge-${i}`}
                x1={px(a.x)}
                y1={py(a.y)}
                x2={px(b.x)}
                y2={py(b.y)}
                stroke="var(--caos-accent)"
                strokeWidth={1.8}
                opacity={0.7}
                markerEnd="url(#scatter-arrow)"
              />
            );
          })}

          {/* Plotted nodes */}
          {graph.nodes.map((n) => {
            const style = nodeStyle(n);
            const isFocused = n.id === activeFocusId;
            const isSelected = n.id === selectedNodeId;

            // Highlight connections or dim unassociated points
            const isDimmed = activeFocusId && !activeConnectedNodeIds.has(n.id);
            const opacity = isFocused ? 1.0 : isSelected ? 0.95 : isDimmed ? 0.15 : 0.75;
            
            const cx = px(n.x);
            const cy = py(n.y);

            return (
              <g
                key={n.id}
                tabIndex={0}
                role="button"
                style={{ opacity, transition: "opacity 160ms ease-out" }}
                className="cursor-pointer focus-ring outline-none"
                onFocus={() => setHoveredNodeId(n.id)}
                onBlur={() => setHoveredNodeId(null)}
                onMouseEnter={() => setHoveredNodeId(n.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={() => onSelectNode?.(n)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectNode?.(n);
                  }
                }}
              >
                {/* Visual anchor / Ring for selected or focused state */}
                {(isFocused || isSelected) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={style.r + (isFocused ? 6 : 4)}
                    fill="none"
                    stroke="var(--caos-accent)"
                    strokeWidth={1.5}
                    strokeDasharray={isFocused ? "2 2" : undefined}
                  />
                )}

                {/* Node symbol */}
                {style.shape === "circle" ? (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={style.r}
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth={style.sw}
                  />
                ) : style.shape === "rect" ? (
                  <rect
                    x={cx - style.r}
                    y={cy - style.r}
                    width={style.r * 2}
                    height={style.r * 2}
                    rx={3}
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth={style.sw}
                  />
                ) : (
                  // Pill or custom node shape
                  <rect
                    x={cx - style.r * 1.5}
                    y={cy - style.r * 0.8}
                    width={style.r * 3}
                    height={style.r * 1.6}
                    rx={6}
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth={style.sw}
                  />
                )}

                {/* Text Label (shown for active / non-compact nodes, or hovered/selected states) */}
                {(!n.compact || isFocused || isSelected) && (
                  <text
                    x={cx}
                    y={cy - style.r - 5}
                    textAnchor="middle"
                    fill="var(--caos-text)"
                    fontSize="10px"
                    fontWeight={isFocused || isSelected ? "bold" : "normal"}
                    fontFamily="var(--font-sans), sans-serif"
                    paintOrder="stroke"
                    stroke="#0a0a0f"
                    strokeWidth={3}
                    strokeLinejoin="round"
                  >
                    {n.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
