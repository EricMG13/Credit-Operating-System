"use client";

// Layout F — the exported research report. Portals a light ink-on-cream document
// into document.body (same print-root mechanism as QueryPrintSheet) that lists
// every accumulated report section as a filed committee memo, closing with the
// current graph exhibit. Only ONE print-root is live at a time: the page toggles
// between this and QueryPrintSheet so window.print() never renders both.
//
// AI-written sections are labeled "AI-generated" in the document itself — the
// report is transparent about which prose is model-authored, consistent with the
// on-screen marking. The figures inside were grounded by the answer/insight gates
// before they ever reached a section.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { GraphResult } from "@/lib/query/graph";
import type { ReportSection } from "@/lib/query/report";
import { kindLabel } from "@/lib/query/report";
import { PrintChart } from "@/components/query/QueryPrintSheet";

const INK = "var(--paper-query-ink)";
const MUTED = "var(--paper-query-meta)";
const RULE = "var(--paper-query-rule)";
const PAPER = "var(--paper-query-bg)";

const label: React.CSSProperties = {
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: "8px",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: MUTED,
};

interface Props {
  sections: ReportSection[];
  graph: GraphResult | null;
}

export function QueryReportSheet({ sections, graph }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `2px solid ${INK}`, paddingBottom: "6px", marginBottom: "16px", fontFamily: '"JetBrains Mono", monospace' }}>
        <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em" }}>CAOS · QUERY</span>
        <span style={{ ...label, fontSize: "9px" }}>research report · {sections.length} {sections.length === 1 ? "section" : "sections"}</span>
      </div>

      {sections.map((s, i) => (
        <div key={s.id} style={{ marginBottom: "16px", paddingBottom: "12px", borderBottom: i < sections.length - 1 ? `1px solid ${RULE}` : "none" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "3px" }}>
            <span style={label}>{kindLabel(s.kind)}</span>
            {s.ai && <span style={{ ...label, color: "var(--paper-ai)" }}>AI-generated</span>}
          </div>
          <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: s.body ? "4px" : 0 }}>{s.title}</div>
          {s.body && <div style={{ fontSize: "11px", lineHeight: 1.5 }}>{s.body}</div>}
          {s.sources.length > 0 && (
            <div style={{ marginTop: "5px", fontSize: "9px", color: MUTED }}>
              Sources: {s.sources.map((src) => src.label).join(" · ")}
            </div>
          )}
        </div>
      ))}

      {graph && graph.nodes.length > 0 && (
        <div style={{ marginTop: "8px" }}>
          <div style={{ ...label, marginBottom: "6px" }}>Closing exhibit — {graph.title}</div>
          <PrintChart graph={graph} />
        </div>
      )}
    </div>
  );

  return createPortal(sheet, document.body);
}
