"use client";

// The committee print exhibit for /query. The app is a dark terminal, but the
// global print rule hides every body child except a body-level `.print-root` —
// Report Studio ships one, /query did not, so window.print() printed a blank
// page. This portals a light "paper" tear-sheet (ink on cream, print-only,
// all styling inline so it needs no globals change) into document.body.
//
// Engine-derived only: the deterministic synthesis line, graph.meta scope, the
// node answer table, and graph.caveats. Model-overlay proposals never appear
// here — the printed exhibit is exactly as defensible as the graph itself.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { GraphResult, GraphNode } from "@/lib/query/graph";
import { nativeView } from "@/lib/query/views";
import { displayMeta } from "@/lib/query/format";

interface QueryPrintSheetProps {
  graph: GraphResult;
  question: string;
  engineNote: string;
  synthesis: string;
}

// Relation to the focus node — mirrors RelativeValueTable: the centre edge
// label "#1" gives rank; the centre edge weight gives similarity.
interface Rel {
  label: string | null;
  weight: number | null;
}

// ink-on-cream palette — a self-contained document, independent of app tokens.
const INK = "var(--paper-query-ink)";
const MUTED = "var(--paper-query-meta)";
const RULE = "var(--paper-query-rule)";
const PAPER = "var(--paper-query-bg)";

// Ink-on-cream chart palette for the static print exhibit — deliberately NOT the
// dark-app tokens. Dark ink for node strokes/labels, muted grey for edges, a very
// light fill so the paper shows through. A filed document, not a lit terminal.
const CHART_INK = "var(--paper-ink)";
const CHART_EDGE = "var(--paper-meta)";
const CHART_FILL = "var(--paper-chart-fill)";

// Print-exhibit geometry — same normalized layout the interactive canvases use
// (W×H, PAD), so node positions read identically; PAD is a touch tighter (70) to
// leave room for the un-truncated ink labels.
const CW = 1000;
const CH = 600;
const CPAD = 70;

// The walk's native view (mirrors lib/query/views.ts). Only graph- and
// scatter-native walks get a chart exhibit; list-native walks (peer-set,
// concentration-map, analyst-memos) are already served by the answer table.
const capLabel = (capabilityId: string): string =>
  capabilityId.replace(/-(map|graph)$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

// A static, print-appropriate node-link SVG. No d3, no zoom refs, no Reset-View
// chrome — a fit-to-content exhibit fixed on the paper. Nodes carry their FULL
// label in ink (wrapped, never 18-char clipped like the live canvas). Returns
// null when there is nothing to draw, so the caller can fall back to the table.
export function PrintChart({ graph }: { graph: GraphResult }): React.ReactElement | null {
  if (graph.nodes.length === 0) return null;

  const px = (x: number) => CPAD + x * (CW - 2 * CPAD);
  const py = (y: number) => CPAD + y * (CH - 2 * CPAD);

  // Fit the node bounding box into the viewBox with a margin, so a sparse walk
  // (a few nodes in one corner) fills the exhibit rather than floating. Mirrors
  // the canvases' fit math, expressed as a plain SVG transform (no d3 identity).
  const xs = graph.nodes.map((n) => px(n.x));
  const ys = graph.nodes.map((n) => py(n.y));
  const M = 120; // room for un-truncated labels above/beside nodes
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const bw = Math.max(...xs) - minX;
  const bh = Math.max(...ys) - minY;
  const k = Math.max(0.3, Math.min(1.5, (CW - 2 * M) / Math.max(bw, 1), (CH - 2 * M) / Math.max(bh, 1)));
  const cx0 = (Math.max(...xs) + minX) / 2;
  const cy0 = (Math.max(...ys) + minY) / 2;
  const tx = CW / 2 - k * cx0;
  const ty = CH / 2 - k * cy0;

  const byId: Record<string, GraphNode> = {};
  for (const n of graph.nodes) byId[n.id] = n;

  // Wrap a full label onto up to two lines at the space nearest the midpoint —
  // no clipping (this is a filed exhibit). A single overlong word stays one line.
  const wrap = (s: string, budget = 22): string[] => {
    if (s.length <= budget) return [s];
    const mid = s.length / 2;
    let best = -1;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === " " && (best === -1 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    }
    if (best === -1) return [s];
    return [s.slice(0, best), s.slice(best + 1)];
  };

  return (
    <svg
      viewBox={`0 0 ${CW} ${CH}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={`Exhibit: ${graph.title}`}
    >
      <g transform={`translate(${tx}, ${ty}) scale(${k})`}>
        {/* edges — muted grey lines a→b, with any edge label ("#1") in ink */}
        {graph.edges.map((e, i) => {
          const a = byId[e.source];
          const b = byId[e.target];
          if (!a || !b) return null;
          const ax = px(a.x);
          const ay = py(a.y);
          const bx = px(b.x);
          const by = py(b.y);
          return (
            <g key={`e-${i}`}>
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke={CHART_EDGE} strokeWidth={1.2} />
              {e.label && (
                <text
                  x={(ax + bx) / 2}
                  y={(ay + by) / 2 - 3}
                  textAnchor="middle"
                  fill={CHART_EDGE}
                  fontSize="9px"
                  fontFamily='"JetBrains Mono", monospace'
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}

        {/* nodes — issuers/center as circles, everything else as a small rect;
            light fill, ink stroke, full ink label wrapped beneath. */}
        {graph.nodes.map((n) => {
          const cx = px(n.x);
          const cy = py(n.y);
          const isCircle = n.kind === "issuer" || n.kind === "center";
          const isCenter = n.kind === "center" || n.center;
          const r = isCenter ? 13 : 8;
          const lines = wrap(n.label);
          return (
            <g key={n.id}>
              {isCircle ? (
                <circle cx={cx} cy={cy} r={r} fill={CHART_FILL} stroke={CHART_INK} strokeWidth={isCenter ? 2.2 : 1.4} />
              ) : (
                <rect
                  x={cx - r}
                  y={cy - r}
                  width={r * 2}
                  height={r * 2}
                  rx={2}
                  fill={CHART_FILL}
                  stroke={CHART_INK}
                  strokeWidth={1.4}
                />
              )}
              {lines.map((ln, li) => (
                <text
                  key={li}
                  x={cx}
                  y={cy + r + 12 + li * 12}
                  textAnchor="middle"
                  fill={CHART_INK}
                  fontSize="11px"
                  fontWeight={isCenter ? 700 : 400}
                  fontFamily='var(--font-sans), "Helvetica Neue", Arial, sans-serif'
                >
                  {ln}
                </text>
              ))}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function QueryPrintSheet({ graph, question, engineNote, synthesis }: QueryPrintSheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;

  const center = graph.nodes.find((n) => n.kind === "center" || n.center);
  const relById: Record<string, Rel> = {};
  if (center) {
    for (const e of graph.edges) {
      const other = e.source === center.id ? e.target : e.target === center.id ? e.source : null;
      if (!other) continue;
      relById[other] = { label: e.label ?? null, weight: typeof e.weight === "number" ? e.weight : null };
    }
  }

  // Columns adapt to the payload, as the on-screen table does.
  const rels = Object.values(relById);
  const showKind = new Set(graph.nodes.map((n) => n.kind)).size > 1;
  const showGroup = graph.nodes.some((n) => n.group);
  const showRank = !!center && rels.some((r) => r.label !== null);
  const showSim = !!center && rels.some((r) => r.weight !== null);

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "4px 8px",
    borderBottom: `1px solid ${INK}`,
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: "8px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: MUTED,
    fontWeight: 600,
  };
  const td: React.CSSProperties = {
    padding: "4px 8px",
    borderBottom: `1px solid ${RULE}`,
    fontSize: "10px",
    verticalAlign: "top",
  };
  const tdNum: React.CSSProperties = {
    ...td,
    textAlign: "right",
    fontFamily: '"JetBrains Mono", monospace',
    fontVariantNumeric: "tabular-nums",
  };
  const detailOf = (n: GraphNode) => (n.sub && n.sub !== n.group ? n.sub : "");

  const sheet = (
    <div
      className="print-root"
      style={{
        display: "none",
        background: PAPER,
        color: INK,
        padding: "32px 40px",
        fontFamily: 'var(--font-sans), "Helvetica Neue", Arial, sans-serif',
        lineHeight: 1.45,
      }}
    >
      {/* masthead */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          borderBottom: `2px solid ${INK}`,
          paddingBottom: "6px",
          marginBottom: "16px",
          fontFamily: '"JetBrains Mono", monospace',
        }}
      >
        <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em" }}>CAOS · QUERY</span>
        <span style={{ fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>
          {capLabel(graph.capability_id)} · committee exhibit
        </span>
      </div>

      {/* question */}
      <div style={{ marginBottom: "12px" }}>
        <div
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "8px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: MUTED,
            marginBottom: "3px",
          }}
        >
          Question
        </div>
        <div style={{ fontSize: "13px", fontWeight: 600 }}>{question || graph.title}</div>
      </div>

      {/* synthesis — the "so what", prominent */}
      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          lineHeight: 1.35,
          padding: "10px 0 12px",
          borderTop: `1px solid ${RULE}`,
          borderBottom: `1px solid ${RULE}`,
          marginBottom: "10px",
        }}
      >
        {synthesis}
      </div>

      {/* engine note */}
      {engineNote && (
        <div style={{ fontSize: "10px", color: MUTED, marginBottom: "16px", fontStyle: "italic" }}>{engineNote}</div>
      )}

      {/* scope */}
      {displayMeta(graph.meta).length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "8px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: MUTED,
              marginBottom: "4px",
            }}
          >
            Scope
          </div>
          <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "10px", color: INK }}>
            {displayMeta(graph.meta).map((m, i) => (
              <li key={i} style={{ marginBottom: "1px" }}>
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* exhibit chart — only for graph/scatter-native walks (list-native walks
          are already served by the answer table below). Guarded: empty nodes →
          no SVG. The chart accompanies, never replaces, the table. */}
      {(() => {
        const view = nativeView(graph.capability_id, graph.mode);
        if (view !== "graph" && view !== "scatter") return null;
        if (graph.nodes.length === 0) return null;
        return (
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "8px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: MUTED,
                marginBottom: "6px",
              }}
            >
              Exhibit
            </div>
            <PrintChart graph={graph} />
          </div>
        );
      })()}

      {/* answer table */}
      {graph.nodes.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "8px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: MUTED,
              marginBottom: "4px",
            }}
          >
            Answer
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Label</th>
                {showKind && <th style={th}>Kind</th>}
                {showGroup && <th style={th}>Group / Detail</th>}
                {showRank && <th style={{ ...th, textAlign: "center" }}>Rank</th>}
                {showSim && <th style={{ ...th, textAlign: "right" }}>Similarity</th>}
              </tr>
            </thead>
            <tbody>
              {graph.nodes.map((n) => {
                const rel = relById[n.id];
                const isCenter = center?.id === n.id;
                const group = [n.group, detailOf(n)].filter(Boolean).join(" · ");
                return (
                  <tr key={n.id}>
                    <td style={td}>
                      {n.label}
                      {isCenter && (
                        <span style={{ marginLeft: "6px", fontSize: "7px", letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>
                          focus
                        </span>
                      )}
                    </td>
                    {showKind && (
                      <td style={{ ...td, fontSize: "9px", textTransform: "uppercase", color: MUTED }}>
                        {n.kind.replace("-", " ")}
                      </td>
                    )}
                    {showGroup && <td style={{ ...td, color: MUTED }}>{group || "—"}</td>}
                    {showRank && (
                      <td style={{ ...tdNum, textAlign: "center" }}>{isCenter ? "—" : rel?.label ?? "—"}</td>
                    )}
                    {showSim && (
                      <td style={tdNum}>{typeof rel?.weight === "number" ? `${(rel.weight * 100).toFixed(0)}%` : "—"}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* caveats */}
      {graph.caveats.length > 0 && (
        <div>
          <div
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "8px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: MUTED,
              marginBottom: "4px",
            }}
          >
            Caveats
          </div>
          <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "9px", color: MUTED }}>
            {graph.caveats.map((c, i) => (
              <li key={i} style={{ marginBottom: "1px" }}>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return createPortal(sheet, document.body);
}
