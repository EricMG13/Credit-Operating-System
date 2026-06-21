"use client";

// The Query graph surface: a dumb projector for the positioned node-link graph
// the backend ([querygraph.py]) returns. Backend owns layout (normalized x/y) so
// this renders one way for every capability — peers, contagion, the provenance
// DAG, sector clusters — and only maps node/edge *kind* to color + shape. Chunk
// nodes are click-to-source (the citation chain stays one interaction from text).

import { useMemo } from "react";
import type { GraphEdge, GraphNode, GraphResult } from "@/lib/query/graph";

// Categorical hues for issuer grouping (industry/country). Distinct, no banding —
// pairs with the always-present text label, so meaning is never color-only.
const CATEGORICAL = ["#2dd4bf", "#4f8cff", "#f5a524", "#a78bfa", "#94a3b8", "#f472b6", "#34d399", "#fb923c"];

function hueFor(group: string | null | undefined): string {
  if (!group) return "#6b7280";
  let h = 0;
  for (let i = 0; i < group.length; i++) h = (h * 31 + group.charCodeAt(i)) >>> 0;
  return CATEGORICAL[h % CATEGORICAL.length];
}

// kind → fill/stroke for non-issuer nodes. Issuer/sector nodes color by group.
const KIND: Record<string, { fill: string; stroke: string }> = {
  driver: { fill: "#2a1f08", stroke: "#f5a524" },
  module: { fill: "#15151d", stroke: "#3a4a6a" },
  claim: { fill: "#15151d", stroke: "#4f8cff" },
  evidence: { fill: "#15151d", stroke: "#33333f" },
  chunk: { fill: "#0f1a12", stroke: "#22c55e" },
  metric: { fill: "#15151d", stroke: "#4f8cff" },
  "point-bull": { fill: "#0f2417", stroke: "#22c55e" },
  "point-bear": { fill: "#2a1212", stroke: "#ef4444" },
  "finding-crit": { fill: "#2a1212", stroke: "#ef4444" },
  "finding-mat": { fill: "#2a1f08", stroke: "#f5a524" },
  "finding-min": { fill: "#1a1a24", stroke: "#3f3f46" },
};

const EDGE: Record<string, { stroke: string; width: number; dash?: string }> = {
  dep: { stroke: "#5f6f8f", width: 1.3 },
  cite: { stroke: "#4f8cff", width: 1.2 },
  driver: { stroke: "#f5a524", width: 2.4 },
  member: { stroke: "#2a2a36", width: 1 },
  seq: { stroke: "#4f8cff", width: 1.8 },
  bull: { stroke: "#22c55e", width: 1.5, dash: "4 3" },
  bear: { stroke: "#ef4444", width: 1.5, dash: "4 3" },
  finding: { stroke: "#f5a524", width: 1.2 },
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
  const groupColor = hueFor(n.group);
  const palette = KIND[n.kind];

  const wrap = (children: React.ReactNode) => (
    <g
      opacity={n.dim ? 0.5 : 1}
      style={clickable ? { cursor: "pointer" } : undefined}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (ev) => { if (ev.key === "Enter") onClick?.(); } : undefined}
      aria-label={clickable ? `Open source for ${n.label}` : undefined}
    >
      <title>{n.title || n.label}</title>
      {children}
    </g>
  );

  // Compact cluster member: a small dot, name on hover only. Keeps a 12-issuer
  // sector (or a 60-finding lane) an orderly block instead of a smear of labels.
  if (n.compact) {
    const c = palette?.stroke ?? groupColor;
    return wrap(<circle cx={cx} cy={cy} r={6} fill={palette?.fill ?? groupColor + "33"} stroke={c} strokeWidth={1.4} />);
  }

  // Shape: issuers + center are circles colored by group; everything else is a
  // small rounded rect tinted by kind. Sector/cluster nodes read as a pill.
  const isCircle = n.kind === "issuer" || n.kind === "center";
  let fill: string, stroke: string, r: number, sw: number;
  if (n.kind === "center") {
    fill = "#10131f"; stroke = n.flag ? "#f5a524" : "#4f8cff"; r = 19; sw = 2.6;
  } else if (n.kind === "issuer") {
    fill = groupColor + "33"; stroke = n.exposed ? "#f5a524" : groupColor; r = 11; sw = n.exposed ? 2.4 : 1.8;
  } else {
    fill = palette?.fill ?? "#15151d"; stroke = n.flag ? "#f5a524" : palette?.stroke ?? "#33333f"; r = 13; sw = 1.4;
  }
  const isMono = n.kind === "claim" || n.kind === "evidence" || n.kind === "metric" || n.kind === "module";

  return wrap(
    <>
      {isCircle ? (
        <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={sw} />
      ) : n.kind === "sector" ? (
        <Pill cx={cx} cy={cy} label={n.label} color={n.flag ? "#f5a524" : groupColor} />
      ) : (
        <RectMark cx={cx} cy={cy} fill={fill} stroke={stroke} sw={sw} />
      )}

      {n.kind !== "sector" ? (
        <text x={cx} y={cy + (isCircle ? r + 16 : 4.5)} textAnchor="middle"
          fill={n.dim ? "#9a9aac" : "#f0f0f6"} fontSize={isCircle ? 13.5 : 12.5}
          fontWeight={n.kind === "center" ? 600 : 400}
          fontFamily={isMono ? "var(--font-mono)" : undefined} {...HALO}>
          {short(n.label, n.kind === "module" ? 8 : 18)}
        </text>
      ) : null}
      {n.sub && n.kind !== "module" ? (
        <text x={cx} y={cy + (isCircle ? r + 31 : 19)} textAnchor="middle"
          fill="#a6a6b8" fontSize={11.5} fontFamily="var(--font-mono)" {...HALO}>
          {short(n.sub, 24)}
        </text>
      ) : null}
    </>
  );
}

function Pill({ cx, cy, label, color }: { cx: number; cy: number; label: string; color: string }) {
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
      if (n.exposed) add("exposed", "#f5a524");
    } else if (n.kind === "chunk") add("source chunk", "#22c55e");
    else if (n.kind === "claim") add("claim", "#4f8cff");
    else if (n.kind === "evidence") add("evidence", "#8a8a9a");
    else if (n.kind === "module") add("module", "#3a4a6a");
    else if (n.kind === "driver") add("risk driver", "#f5a524");
    else if (n.kind === "point-bull") add("bull point", "#22c55e");
    else if (n.kind === "point-bear") add("bear point", "#ef4444");
    else if (n.kind.startsWith("finding")) add("QA finding", "#f5a524");
    else if (n.kind === "metric") add("metric", "#4f8cff");
  }
  return out.slice(0, 8);
}
