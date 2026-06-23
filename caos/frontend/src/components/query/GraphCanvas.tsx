"use client";

// The Query graph surface: a dumb projector for the positioned node-link graph
// the backend ([querygraph.py]) returns. Backend owns layout (normalized x/y) so
// this renders one way for every capability — peers, contagion, the provenance
// DAG, sector clusters — and only maps node/edge *kind* to color + shape. Chunk
// nodes are click-to-source (the citation chain stays one interaction from text).

import { useMemo } from "react";
import type { GraphEdge, GraphNode, GraphResult } from "@/lib/query/graph";
import { CHART_HEX } from "@/lib/chart-colors";
import { onActivate } from "@/lib/a11y";
import { hueFor, nodeStyle } from "./node-style";

const EDGE: Record<string, { stroke: string; width: number; dash?: string }> = {
  dep: { stroke: "#5f6f8f", width: 1.3 },
  cite: { stroke: CHART_HEX.accent, width: 1.2 },
  driver: { stroke: CHART_HEX.warning, width: 2.4 },
  member: { stroke: "#2a2a36", width: 1 },
  seq: { stroke: CHART_HEX.accent, width: 1.8 },
  bull: { stroke: CHART_HEX.success, width: 1.5, dash: "4 3" },
  bear: { stroke: CHART_HEX.critical, width: 1.5, dash: "4 3" },
  finding: { stroke: CHART_HEX.warning, width: 1.2 },
};

const W = 1000;
const H = 600;
const PAD = 78;

// A dark halo painted *behind* the glyphs (paint-order: stroke) so every label
// stays legible where it crosses an edge or another node — the single biggest
// legibility win on a dense graph.
const HALO = { paintOrder: "stroke" as const, stroke: "#0a0a0f", strokeWidth: 3.5, strokeLinejoin: "round" as const };

const short = (s: string, n = 18) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

type OpenChunk = (chunkId: string, label?: string | null) => void;

export function GraphCanvas({ graph, onOpenChunk }: { graph: GraphResult; onOpenChunk: OpenChunk }) {
  const px = (x: number) => PAD + x * (W - 2 * PAD);
  const py = (y: number) => PAD + y * (H - 2 * PAD);
  const byId = useMemo(() => Object.fromEntries(graph.nodes.map((n) => [n.id, n])), [graph]);

  const legend = useMemo(() => legendFor(graph.nodes), [graph]);

  if (graph.nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-6">
        <div className="tabular text-caos-xl text-caos-muted max-w-md">
          {graph.meta[0] || graph.title}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
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

        {graph.edges.map((e, i) => {
          const a = byId[e.source];
          const b = byId[e.target];
          if (!a || !b) return null;
          return <EdgeLine key={i} edge={e} a={a} b={b} px={px} py={py} />;
        })}

        {graph.nodes.map((n) => (
          <NodeMark key={n.id} n={n} cx={px(n.x)} cy={py(n.y)} onOpenChunk={onOpenChunk} />
        ))}
      </svg>

      {/* Text alternative: the graph's meaning carried in the DOM, not just by
          color + position — screen-reader reachable and not pixels-only. */}
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

      <div className="shrink-0 flex items-center gap-x-4 gap-y-1 flex-wrap px-1 pt-2">
        {legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5 tabular text-caos-2xs text-caos-muted">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function EdgeLine({ edge, a, b, px, py }: { edge: GraphEdge; a: GraphNode; b: GraphNode; px: (x: number) => number; py: (y: number) => number }) {
  const x1 = px(a.x), y1 = py(a.y), x2 = px(b.x), y2 = py(b.y);
  const k = edge.kind;
  // Peer edges (no kind, weighted) scale width + carry a match label at midpoint.
  const base = k && EDGE[k] ? EDGE[k] : { stroke: "#3a5a8a", width: 1 + (edge.weight ?? 0) * 3, dash: undefined as string | undefined };
  const arrow = k === "dep" || k === "cite" || k === "seq" || k === "bull" || k === "bear";
  return (
    <g>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={base.stroke} strokeWidth={base.width} strokeDasharray={base.dash}
        markerEnd={arrow ? "url(#qg-arrow)" : undefined}
        opacity={k === "member" || k === "dep" || k === "finding" ? 0.32 : 0.85}
      />
      {edge.label ? (
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} textAnchor="middle" fill="#aeb9d4" fontFamily="var(--font-mono)" fontSize={13} {...HALO}>
          {edge.label}
        </text>
      ) : null}
    </g>
  );
}

function NodeMark({ n, cx, cy, onOpenChunk }: { n: GraphNode; cx: number; cy: number; onOpenChunk: OpenChunk }) {
  const clickable = !!n.chunk_id;
  const onClick = clickable ? () => onOpenChunk(n.chunk_id!, n.label) : undefined;
  const s = nodeStyle(n);

  const wrap = (children: React.ReactNode) => (
    <g
      opacity={n.dim ? 0.5 : 1}
      style={clickable ? { cursor: "pointer" } : undefined}
      onClick={onClick}
      className={clickable ? "graph-node" : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? onActivate(() => onClick?.()) : undefined}
      aria-label={clickable ? `Open source for ${n.label}` : undefined}
    >
      <title>{n.title || n.label}</title>
      {children}
    </g>
  );

  // Compact cluster member: a small dot, name on hover only. Keeps a 12-issuer
  // sector (or a 60-finding lane) an orderly block instead of a smear of labels.
  if (s.shape === "compact") {
    return wrap(<circle cx={cx} cy={cy} r={s.r} fill={s.fill} stroke={s.stroke} strokeWidth={s.sw} />);
  }

  return wrap(
    <>
      {s.isCircle ? (
        <circle cx={cx} cy={cy} r={s.r} fill={s.fill} stroke={s.stroke} strokeWidth={s.sw} />
      ) : s.shape === "pill" ? (
        <NodePill cx={cx} cy={cy} label={n.label} color={s.color} />
      ) : (
        <RectMark cx={cx} cy={cy} fill={s.fill} stroke={s.stroke} sw={s.sw} />
      )}

      {n.kind !== "sector" ? (
        <text x={cx} y={cy + (s.isCircle ? s.r + 16 : 4.5)} textAnchor="middle"
          fill={n.dim ? "#9a9aac" : "#f0f0f6"} fontSize={s.isCircle ? 13.5 : 12.5}
          fontWeight={n.kind === "center" ? 600 : 400}
          fontFamily={s.isMono ? "var(--font-mono)" : undefined} {...HALO}>
          {short(n.label, n.kind === "module" ? 8 : 18)}
        </text>
      ) : null}
      {n.sub && n.kind !== "module" ? (
        <text x={cx} y={cy + (s.isCircle ? s.r + 31 : 19)} textAnchor="middle"
          fill="#a6a6b8" fontSize={11.5} fontFamily="var(--font-mono)" {...HALO}>
          {short(n.sub, 24)}
        </text>
      ) : null}
    </>
  );
}

function NodePill({ cx, cy, label, color }: { cx: number; cy: number; label: string; color: string }) {
  const text = short(label, 26);
  const w = Math.max(64, text.length * 8.2 + 22);
  return (
    <g>
      <rect x={cx - w / 2} y={cy - 14} width={w} height={28} rx={6} fill={color + "22"} stroke={color} strokeWidth={1.2} />
      <text x={cx} y={cy + 4.5} textAnchor="middle" fill={color} fontSize={12.5} fontWeight={500} fontFamily="var(--font-mono)" {...HALO}>{text}</text>
    </g>
  );
}

function RectMark({ cx, cy, fill, stroke, sw }: { cx: number; cy: number; fill: string; stroke: string; sw: number }) {
  return <rect x={cx - 9} y={cy - 9} width={18} height={18} rx={4} fill={fill} stroke={stroke} strokeWidth={sw} />;
}

function legendFor(nodes: GraphNode[]): { label: string; color: string }[] {
  const out: { label: string; color: string }[] = [];
  const seen = new Set<string>();
  const add = (label: string, color: string) => {
    if (!seen.has(label)) { seen.add(label); out.push({ label, color }); }
  };
  for (const n of nodes) {
    if (n.kind === "issuer" || n.kind === "center" || n.kind === "sector") {
      if (n.group) add(n.group, hueFor(n.group));
      if (n.exposed) add("exposed", CHART_HEX.warning);
    } else if (n.kind === "chunk") add("source chunk", CHART_HEX.success);
    else if (n.kind === "claim") add("claim", CHART_HEX.accent);
    else if (n.kind === "evidence") add("evidence", "#8a8a9a");
    else if (n.kind === "module") add("module", "#3a4a6a");
    else if (n.kind === "driver") add("risk driver", CHART_HEX.warning);
    else if (n.kind === "point-bull") add("bull point", CHART_HEX.success);
    else if (n.kind === "point-bear") add("bear point", CHART_HEX.critical);
    else if (n.kind.startsWith("finding")) add("QA finding", CHART_HEX.warning);
    else if (n.kind === "metric") add("metric", CHART_HEX.accent);
  }
  return out.slice(0, 8);
}
