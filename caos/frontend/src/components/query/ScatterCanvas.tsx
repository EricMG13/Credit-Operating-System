"use client";

import { useMemo, useState } from "react";
import type { GraphResult, GraphNode } from "@/lib/query/graph";
import { nodeStyle } from "./node-style";
import { GRAPH_HEIGHT as H, GRAPH_WIDTH as W, graphX as px, graphY as py, useGraphViewport } from "./useGraphViewport";

interface ScatterCanvasProps {
  graph: GraphResult;
  selectedNodeId?: string | null;
  onSelectNode?: (node: GraphNode) => void;
}

type ScatterStyle = ReturnType<typeof nodeStyle>;

function scatterOpacity(focused: boolean, selected: boolean, dimmed: boolean): number {
  if (focused) return 1;
  if (selected) return 0.95;
  return dimmed ? 0.15 : 0.75;
}

function ScatterFocusRing({ x, y, style, focused }: { x: number; y: number; style: ScatterStyle; focused: boolean }) {
  return <circle cx={x} cy={y} r={style.r + (focused ? 6 : 4)} fill="none" stroke="var(--caos-accent)" strokeWidth={1.5} strokeDasharray={focused ? "2 2" : undefined} />;
}

function ScatterNodeShape({ x, y, style }: { x: number; y: number; style: ScatterStyle }) {
  if (style.shape === "circle") return <circle cx={x} cy={y} r={style.r} fill={style.fill} stroke={style.stroke} strokeWidth={style.sw} />;
  if (style.shape === "rect") return <rect x={x - style.r} y={y - style.r} width={style.r * 2} height={style.r * 2} rx={3} fill={style.fill} stroke={style.stroke} strokeWidth={style.sw} />;
  return <rect x={x - style.r * 1.5} y={y - style.r * 0.8} width={style.r * 3} height={style.r * 1.6} rx={6} fill={style.fill} stroke={style.stroke} strokeWidth={style.sw} />;
}

function ScatterLabel({ node, x, y, radius, emphasized }: { node: GraphNode; x: number; y: number; radius: number; emphasized: boolean }) {
  if (node.compact && !emphasized) return null;
  return <text x={x} y={y - radius - 5} textAnchor="middle" fill="var(--caos-text)" fontSize="10px" fontWeight={emphasized ? "bold" : "normal"} fontFamily="var(--font-sans), sans-serif" paintOrder="stroke" stroke="#0a0a0f" strokeWidth={3} strokeLinejoin="round">{node.label}</text>;
}

function ScatterPoint({ node, focusId, selectedNodeId, connectedNodeIds, toX, toY, onSelect, onHover }: {
  node: GraphNode; focusId?: string | null; selectedNodeId?: string | null; connectedNodeIds: Set<string>; toX: (value: number) => number; toY: (value: number) => number;
  onSelect?: (node: GraphNode) => void; onHover: (id: string | null) => void;
}) {
  const style = nodeStyle(node);
  const focused = node.id === focusId;
  const selected = node.id === selectedNodeId;
  const emphasized = focused || selected;
  const dimmed = Boolean(focusId) && !connectedNodeIds.has(node.id);
  const x = toX(node.x);
  const y = toY(node.y);
  const activateFromKeyboard = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect?.(node);
  };
  return (
    <g
      tabIndex={0}
      role="button"
      style={{ opacity: scatterOpacity(focused, selected, dimmed), transition: "opacity 160ms ease-out" }}
      className="cursor-pointer focus-ring outline-none"
      aria-label={`Select ${node.label}${node.kind ? ` (${node.kind})` : ""}`}
      onFocus={() => onHover(node.id)} onBlur={() => onHover(null)} onMouseEnter={() => onHover(node.id)} onMouseLeave={() => onHover(null)}
      onClick={() => onSelect?.(node)} onKeyDown={activateFromKeyboard}
    >
      {emphasized ? <ScatterFocusRing x={x} y={y} style={style} focused={focused} /> : null}
      <ScatterNodeShape x={x} y={y} style={style} />
      <ScatterLabel node={node} x={x} y={y} radius={style.r} emphasized={emphasized} />
    </g>
  );
}

export function ScatterCanvas({
  graph,
  selectedNodeId,
  onSelectNode,
}: ScatterCanvasProps) {
  const { byId, handleResetZoom, svgRef, transform } = useGraphViewport(graph);

  // Hovered node tracking for highlighting edges
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Real metric-unit ticks when the builder emits domains (xdomain/ydomain in
  // meta); otherwise the honest normalized 0→1 scale. Positions mirror the
  // builder's 0.1..0.9 inset (x) and 0.9..0.1 (y, high value at top).
  const ticks = useMemo(() => {
    const parse = (p: string) => {
      const m = graph.meta.find((s) => s.startsWith(p));
      if (!m) return null;
      const [lo, hi] = m.slice(p.length).split("|").map(Number);
      return Number.isFinite(lo) && Number.isFinite(hi) ? { lo, hi } : null;
    };
    const dx = parse("xdomain="), dy = parse("ydomain=");
    const F = [0, 0.25, 0.5, 0.75, 1];
    const x = dx
      ? F.map((f) => ({ p: 0.1 + 0.8 * f, label: (dx.lo + f * (dx.hi - dx.lo)).toFixed(1) + "x" }))
      : F.map((f) => ({ p: f, label: f.toFixed(2) }));
    const y = dy
      ? F.map((f) => ({ p: 0.9 - 0.8 * f, label: (dy.lo + f * (dy.hi - dy.lo)).toFixed(1) + "x" }))
      : F.map((f) => ({ p: 1 - f, label: f.toFixed(2) }));
    return { x, y };
  }, [graph.meta]);

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
          
          {/* Grid lines at the tick positions (metric-unit when the builder
              emits a domain, else normalized). */}
          <g className="grid-lines" opacity={0.3}>
            {ticks.y.map((t, i) => (
              <line key={`h-${i}`} x1={px(0)} y1={py(t.p)} x2={px(1)} y2={py(t.p)}
                stroke="var(--caos-border)" strokeWidth={1} strokeDasharray="2 3" />
            ))}
            {ticks.x.map((t, i) => (
              <line key={`v-${i}`} x1={px(t.p)} y1={py(0)} x2={px(t.p)} y2={py(1)}
                stroke="var(--caos-border)" strokeWidth={1} strokeDasharray="2 3" />
            ))}
          </g>

          {/* Tick labels — real metric values (e.g. "5.2x") when the builder
              emits a domain, else the honest normalized 0→1. Small mono muted,
              outside the plot; y reads the high value at top. */}
          <g className="grid-ticks" fill="var(--caos-muted)" fontSize={10}
            fontFamily="var(--font-mono)" opacity={0.75}>
            {ticks.x.map((t, i) => (
              <text key={`tx-${i}`} x={px(t.p)} y={py(1) + 16} textAnchor="middle">{t.label}</text>
            ))}
            {ticks.y.map((t, i) => (
              <text key={`ty-${i}`} x={px(0) - 8} y={py(t.p) + 3.5} textAnchor="end">{t.label}</text>
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
          {graph.nodes.map((node) => <ScatterPoint key={node.id} node={node} focusId={activeFocusId} selectedNodeId={selectedNodeId} connectedNodeIds={activeConnectedNodeIds} toX={px} toY={py} onSelect={onSelectNode} onHover={setHoveredNodeId} />)}
        </g>
      </svg>
    </div>
  );
}
