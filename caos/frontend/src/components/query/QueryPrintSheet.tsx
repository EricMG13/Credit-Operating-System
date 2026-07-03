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
const INK = "#1a1a1a";
const MUTED = "#5a5a5a";
const RULE = "#c9c4b5";
const PAPER = "#faf8f2";

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
        fontFamily: 'Inter, "Helvetica Neue", Arial, sans-serif',
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
          {graph.mode} · committee exhibit
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
      {graph.meta.length > 0 && (
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
            {graph.meta.map((m, i) => (
              <li key={i} style={{ marginBottom: "1px" }}>
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

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
