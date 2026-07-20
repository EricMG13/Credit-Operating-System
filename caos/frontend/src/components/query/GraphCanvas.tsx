"use client";

import { useMemo, useState } from "react";
import type { GraphEdge, GraphNode, GraphResult, OverlayEdge } from "@/lib/query/graph";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { CHART_HEX } from "@/lib/chart-colors";
import { onActivate } from "@/lib/a11y";
import { hueFor, nodeStyle, MODEL_HUE } from "./node-style";
import { GRAPH_HEIGHT as H, GRAPH_WIDTH as W, graphX as px, graphY as py, useGraphViewport } from "./useGraphViewport";

const EDGE: Record<string, { stroke: string; width: number; dash?: string }> = {
  dep: { stroke: "#5f6f8f", width: 1.3 },
  cite: { stroke: CHART_HEX.accent, width: 1.2 },
  driver: { stroke: CHART_HEX.warning, width: 2.4 },
  // Wiki walk: membership IS the answer, so make these hairlines legible — a
  // touch lighter than the raw border and rendered at higher opacity below.
  member: { stroke: "#34384a", width: 1 },
  seq: { stroke: CHART_HEX.accent, width: 1.8 },
  bull: { stroke: CHART_HEX.success, width: 1.5, dash: "4 3" },
  bear: { stroke: CHART_HEX.critical, width: 1.5, dash: "4 3" },
  finding: { stroke: CHART_HEX.warning, width: 1.2 },
  // Analyst-ratified model proposal: solid (ratified) in the model hue (origin).
  accepted: { stroke: MODEL_HUE, width: 1.8 },
};

const HALO = {
  paintOrder: "stroke" as const,
  stroke: "#0a0a0f",
  strokeWidth: 3.5,
  strokeLinejoin: "round" as const,
};

const short = (s: string, n = 18) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// Issuer/center labels are real names ("Virgin Media O2 Investments Holdings")
// on a mostly-empty canvas — hard-cutting at 18 wastes the space. Split onto up
// to two lines at the space nearest the midpoint (generous ~18-char budget per
// line), ellipsis only if a single word still overflows. Returns 1 or 2 lines.
const wrapLabel = (s: string, budget = 18): string[] => {
  if (s.length <= budget) return [s];
  const mid = s.length / 2;
  let best = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === " " && (best === -1 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  if (best === -1) return [short(s, budget)]; // no break point — one clipped line
  return [short(s.slice(0, best), budget), short(s.slice(best + 1), budget)];
};

type OpenChunk = (chunkId: string, label?: string | null) => void;
type SelectNode = (node: GraphNode) => void;

export function GraphCanvas({
  graph,
  overlay,
  onOpenChunk,
  onSelectNode,
}: {
  graph: GraphResult;
  overlay?: OverlayEdge[]; // model-proposed links — dashed, labeled, excluded from print
  onOpenChunk: OpenChunk;
  onSelectNode?: SelectNode;
}) {
  const { byId, handleResetZoom, svgRef, transform } = useGraphViewport(graph);

  // Keep track of hovered node for visual connection path highlighting
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Adjacent node tracking for hover-highlight filters
  const adjacentNodeIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    const adjacent = new Set<string>([hoveredNodeId]);
    graph.edges.forEach((e) => {
      if (e.source === hoveredNodeId) adjacent.add(e.target);
      if (e.target === hoveredNodeId) adjacent.add(e.source);
    });
    return adjacent;
  }, [hoveredNodeId, graph.edges]);

  const legend = useMemo(() => legendFor(graph.nodes), [graph]);

  if (graph.nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-6">
        <SurfaceState kind="empty" title={graph.title} detail={graph.meta[0]} className="max-w-md" />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col relative select-none">
      {/* Zoom / Reset Floating Actions */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 bg-caos-panel/90 border border-caos-border rounded p-1">
        <button
          onClick={handleResetZoom}
          className="tabular text-caos-3xs uppercase tracking-wider px-2 py-1 rounded bg-caos-bg border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50 transition-caos focus-ring"
          title="Reset Zoom"
        >
          Reset View
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={`Graph: ${graph.title}`}
        style={{ display: "block" }}
      >
        <title>{graph.title}</title>
        <desc>{`${graph.title}. ${graph.nodes.length} nodes, ${graph.edges.length} links. ${graph.meta.join(". ")}.`}</desc>
        <defs>
          <marker id="qg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#5f6f8f" />
          </marker>
        </defs>

        {/* View transform group */}
        <g transform={transform.toString()}>
          {graph.edges.map((e, i) => {
            const a = byId[e.source];
            const b = byId[e.target];
            if (!a || !b) return null;

            // Hover highlight check: edge is highlighted if connected to hovered node
            const isDimmed = hoveredNodeId && (e.source !== hoveredNodeId && e.target !== hoveredNodeId);

            return (
              <g key={i} style={{ opacity: isDimmed ? 0.08 : 1.0, transition: "opacity 160ms ease-out" }}>
                <EdgeLine edge={e} x1={px(a.x)} y1={py(a.y)} x2={px(b.x)} y2={py(b.y)} />
              </g>
            );
          })}

          {(overlay ?? []).map((e, i) => {
            const a = byId[e.source];
            const b = byId[e.target];
            if (!a || !b) return null;
            return (
              // print:hidden — model-proposed links never enter a printed exhibit.
              <g key={`ov-${i}`} className="print:hidden">
                <line
                  x1={px(a.x)} y1={py(a.y)} x2={px(b.x)} y2={py(b.y)}
                  stroke={MODEL_HUE} strokeWidth={1.6} strokeDasharray="6 4" opacity={0.8}
                />
                <text
                  x={(px(a.x) + px(b.x)) / 2} y={(py(a.y) + py(b.y)) / 2 - 5}
                  textAnchor="middle" fill={MODEL_HUE} fontFamily="var(--font-mono)" fontSize={11} {...HALO}
                >
                  model · {e.confidence}
                </text>
              </g>
            );
          })}

          {graph.nodes.map((n) => {
            // Hover highlight check: node is dimmed if another node is hovered and this isn't connected
            const isDimmed = hoveredNodeId && !adjacentNodeIds.has(n.id);

            return (
              <g
                key={n.id}
                style={{ opacity: isDimmed ? 0.15 : 1.0, transition: "opacity 160ms ease-out" }}
                onMouseEnter={() => setHoveredNodeId(n.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                <NodeMark
                  n={n}
                  cx={px(n.x)}
                  cy={py(n.y)}
                  onOpenChunk={onOpenChunk}
                  onSelectNode={onSelectNode}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Text alternative for accessibility */}
      <div className="sr-only">
        <h3>{graph.title} — {graph.nodes.length} nodes, {graph.edges.length} links</h3>
        <ul>
          {graph.nodes.map((n) => (
            <li key={n.id}>{n.kind.replace("-", " ")}: {n.label}{n.sub ? `, ${n.sub}` : ""}</li>
          ))}
        </ul>
        {graph.edges.length > 0 && (
          <ul>
            {graph.edges.map((e, i) => (
              <li key={i}>{byId[e.source]?.label ?? e.source} → {byId[e.target]?.label ?? e.target}{e.label ? ` (${e.label})` : ""}{e.kind ? `, ${e.kind}` : ""}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-x-4 gap-y-1 px-1 pt-2 overflow-x-auto whitespace-nowrap sm:flex-wrap">
        {legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5 shrink-0 tabular text-caos-2xs text-caos-muted">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
        {graph.edges.some((e) => e.kind === "accepted") && (
          <span className="inline-flex items-center gap-1.5 shrink-0 tabular text-caos-2xs" style={{ color: MODEL_HUE }}>
            <svg width="14" height="6" aria-hidden="true"><line x1="0" y1="3" x2="14" y2="3" stroke={MODEL_HUE} strokeWidth="1.8" /></svg>
            analyst-accepted
          </span>
        )}
        {overlay && overlay.length > 0 && (
          <span className="inline-flex items-center gap-1.5 shrink-0 tabular text-caos-2xs print:hidden" style={{ color: MODEL_HUE }}>
            <svg width="14" height="6" aria-hidden="true"><line x1="0" y1="3" x2="14" y2="3" stroke={MODEL_HUE} strokeWidth="1.6" strokeDasharray="4 3" /></svg>
            model-proposed ({overlay.length})
          </span>
        )}
      </div>
    </div>
  );
}

function EdgeLine({ edge, x1, y1, x2, y2 }: { edge: GraphEdge; x1: number; y1: number; x2: number; y2: number }) {
  const k = edge.kind;
  const base = k && EDGE[k] ? EDGE[k] : { stroke: "var(--caos-border)", width: 1 + (edge.weight ?? 0) * 3, dash: undefined };
  const arrow = k === "dep" || k === "cite" || k === "seq" || k === "bull" || k === "bear";
  return (
    <g>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={base.stroke} strokeWidth={base.width} strokeDasharray={base.dash}
        markerEnd={arrow ? "url(#qg-arrow)" : undefined}
        opacity={k === "member" ? 0.5 : k === "dep" || k === "finding" ? 0.32 : 0.85}
      />
      {edge.label ? (
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} textAnchor="middle" fill="#aeb9d4" fontFamily="var(--font-mono)" fontSize={13} {...HALO}>
          {edge.label}
        </text>
      ) : null}
    </g>
  );
}

type NodeMarkProps = {
  n: GraphNode;
  cx: number;
  cy: number;
  onOpenChunk: OpenChunk;
  onSelectNode?: SelectNode;
};

type NodeMarkStyle = ReturnType<typeof nodeStyle>;

function selectGraphNode(node: GraphNode, onOpenChunk: OpenChunk, onSelectNode?: SelectNode) {
  if (node.chunk_id) onOpenChunk(node.chunk_id, node.label);
  else onSelectNode?.(node);
}

function NodeWikiLink({ cx, cy, n, style }: { cx: number; cy: number; n: GraphNode; style: NodeMarkStyle }) {
  if (!n.obsidian_url) return null;
  return (
    <a
      href={n.obsidian_url}
      title="Reveal in Obsidian Wiki"
      className="focus-ring"
      onMouseDown={(e) => e.stopPropagation()}
      style={{ cursor: "pointer" }}
      aria-label={`Reveal ${n.label} in Obsidian Wiki`}
    >
      <circle cx={cx + style.r + 8} cy={cy - style.r - 2} r={7.5} fill={MODEL_HUE} stroke="#0a0a0f" strokeWidth={1} />
      <text x={cx + style.r + 8} y={cy - style.r + 0.5} textAnchor="middle" fill="#0a0a0f" fontSize={9} fontWeight="bold" fontFamily="var(--font-mono)">W</text>
    </a>
  );
}

function NodeInteraction({ children, n, onOpenChunk, onSelectNode }: Pick<NodeMarkProps, "n" | "onOpenChunk" | "onSelectNode"> & { children: React.ReactNode }) {
  const select = () => selectGraphNode(n, onOpenChunk, onSelectNode);
  return (
    <g
      opacity={n.dim ? 0.5 : 1}
      style={{ cursor: "pointer" }}
      onClick={(event) => {
        event.stopPropagation();
        select();
      }}
      className="graph-node select-none focus-ring"
      role="button"
      tabIndex={0}
      onKeyDown={onActivate(select)}
      aria-label={`Select ${n.label}${n.exposed && n.kind === "issuer" ? " (exposed)" : ""}`}
    >
      <title>{n.title || n.label}</title>
      {children}
    </g>
  );
}

function NodeShape({ cx, cy, n, style }: { cx: number; cy: number; n: GraphNode; style: NodeMarkStyle }) {
  if (style.shape === "compact") return <circle cx={cx} cy={cy} r={style.r} fill={style.fill} stroke={style.stroke} strokeWidth={style.sw} />;
  if (style.shape === "pill") return <NodePill cx={cx} cy={cy} label={n.label} color={style.color} />;
  if (!style.isCircle) return <RectMark cx={cx} cy={cy} fill={style.fill} stroke={style.stroke} sw={style.sw} />;
  return (
    <>
      {n.exposed && n.kind === "issuer" ? <circle cx={cx} cy={cy} r={style.r + 3.5} fill="none" stroke={style.stroke} strokeWidth={1} opacity={0.7} /> : null}
      <circle cx={cx} cy={cy} r={style.r} fill={style.fill} stroke={style.stroke} strokeWidth={style.sw} />
    </>
  );
}

function NodeLabel({ cx, cy, labelLines, n, style }: { cx: number; cy: number; labelLines: string[]; n: GraphNode; style: NodeMarkStyle }) {
  if (n.kind === "sector" || style.shape === "compact") return null;
  const shared = {
    textAnchor: "middle" as const,
    fill: n.dim ? "var(--caos-muted)" : "var(--caos-text)",
    fontWeight: n.kind === "center" ? 600 : 400,
  };
  if (style.isCircle) {
    return (
      <text x={cx} y={cy + style.r + 16} fontSize={13.5} {...shared} {...HALO}>
        {labelLines.map((line, index) => <tspan key={index} x={cx} dy={index === 0 ? 0 : 15}>{line}</tspan>)}
      </text>
    );
  }
  return (
    <text x={cx} y={cy + 4.5} fontSize={12.5} fontFamily={style.isMono ? "var(--font-mono)" : undefined} {...shared} {...HALO}>
      {labelLines.map((line, index) => <tspan key={index} x={cx} dy={index === 0 ? 0 : 14}>{line}</tspan>)}
    </text>
  );
}

function NodeSubLabel({ cx, cy, labelLines, n, style }: { cx: number; cy: number; labelLines: string[]; n: GraphNode; style: NodeMarkStyle }) {
  if (!n.sub || n.kind === "module" || style.shape === "compact") return null;
  const lineOffset = labelLines.length > 1 ? (style.isCircle ? 15 : 14) : 0;
  const y = cy + (style.isCircle ? style.r + 31 : 19) + lineOffset;
  return <text x={cx} y={y} textAnchor="middle" fill="#a6a6b8" fontSize={11.5} fontFamily="var(--font-mono)" {...HALO}>{short(n.sub, 24)}</text>;
}

function NodeMark({ n, cx, cy, onOpenChunk, onSelectNode }: NodeMarkProps) {
  const style = nodeStyle(n);
  const labelLines = n.kind === "module" ? [short(n.label, 8)] : wrapLabel(n.label, style.isCircle ? 18 : 20);
  return (
    <>
      <NodeInteraction n={n} onOpenChunk={onOpenChunk} onSelectNode={onSelectNode}>
        <NodeShape cx={cx} cy={cy} n={n} style={style} />
        <NodeLabel cx={cx} cy={cy} labelLines={labelLines} n={n} style={style} />
        <NodeSubLabel cx={cx} cy={cy} labelLines={labelLines} n={n} style={style} />
      </NodeInteraction>
      <NodeWikiLink cx={cx} cy={cy} n={n} style={style} />
    </>
  );
}

function NodePill({ cx, cy, label, color }: { cx: number; cy: number; label: string; color: string }) {
  const text = short(label, 26);
  const w = Math.max(64, text.length * 8.2 + 22);
  return (
    <g>
      <rect x={cx - w / 2} y={cy - 14} width={w} height={28} rx={6} fill={`color-mix(in srgb, ${color} 13%, transparent)`} stroke={color} strokeWidth={1.2} />
      <text x={cx} y={cy + 4.5} textAnchor="middle" fill={color} fontSize={12.5} fontWeight={500} fontFamily="var(--font-mono)" {...HALO}>{text}</text>
    </g>
  );
}

function RectMark({ cx, cy, fill, stroke, sw }: { cx: number; cy: number; fill: string; stroke: string; sw: number }) {
  return <rect x={cx - 9} y={cy - 9} width={18} height={18} rx={4} fill={fill} stroke={stroke} strokeWidth={sw} />;
}

const GROUP_LEGEND_KINDS = new Set(["issuer", "center", "sector"]);
const NODE_LEGEND_ENTRIES: Record<string, readonly [string, string]> = {
  chunk: ["source chunk", CHART_HEX.success],
  claim: ["claim", CHART_HEX.accent],
  evidence: ["evidence", CHART_HEX.muted],
  module: ["module", "#3a4a6a"],
  driver: ["risk driver", CHART_HEX.warning],
  "point-bull": ["bull point", CHART_HEX.success],
  "point-bear": ["bear point", CHART_HEX.critical],
  metric: ["metric", CHART_HEX.accent],
};

function legendEntryForNode(node: GraphNode): readonly [string, string] | null {
  if (GROUP_LEGEND_KINDS.has(node.kind)) return node.group ? [node.group, hueFor(node.group)] : null;
  if (node.kind.startsWith("finding")) return ["QA finding", CHART_HEX.warning];
  return NODE_LEGEND_ENTRIES[node.kind] ?? null;
}

function legendFor(nodes: GraphNode[]): { label: string; color: string }[] {
  const out: { label: string; color: string }[] = [];
  const seen = new Set<string>();
  const add = (label: string, color: string) => {
    if (!seen.has(label)) { seen.add(label); out.push({ label, color }); }
  };
  for (const node of nodes) {
    const entry = legendEntryForNode(node);
    if (entry) add(...entry);
    if (GROUP_LEGEND_KINDS.has(node.kind) && node.exposed) add("exposed", CHART_HEX.warning);
  }
  return out.slice(0, 8);
}
