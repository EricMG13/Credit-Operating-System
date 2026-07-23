"use client";

// Per-module G2 chart registry rendered inside the generic module view
// (port of design bundle shared/module-charts.jsx, deployed from the
// antv-g2-chart skill). Covers the L1 base modules + CP-3 relative value.

import { type G2Spec } from "@/components/charts/G2Chart";
import {
  SemanticVisualization,
  type VisualizationColumn,
  type VisualizationDatum,
  type VisualizationKind,
} from "@/components/charts/SemanticVisualization";
import { CHART_HEX } from "@/lib/chart-colors";

const MC_AXIS = { x: { title: false }, y: { title: false } };

interface ModuleChartDef {
  kind: VisualizationKind;
  title: string;
  unit: string;
  sourceIds: string[];
  accessibleSummary: string;
  columns: VisualizationColumn[];
  h?: number;
  note?: string;
  spec: G2Spec;
}

export const MODULE_CHARTS: Record<string, ModuleChartDef[]> = {
  /* ---- CP-1 · Financial normalization ---- */
  "CP-1": [
    { kind: "bar", title: "CP-1-07 · Adj. vs reported EBITDA", unit: "$M", sourceIds: ["CP-1:K-07", "E-09"], accessibleSummary: "Adjusted EBITDA rises from $358M in FY23 to $421M LTM, while reported pre-add-back EBITDA rises from $318M to $344M; the LTM gap is $77M.", columns: [{ key: "fy", label: "Period" }, { key: "s", label: "Measure" }, { key: "v", label: "$M" }], h: 168, note: "Gap = add-backs — 18.2% of adj. in LTM (E-09)", spec: {
      type: "interval",
      data: [
        { fy: "FY23", s: "Adj. EBITDA", v: 358 }, { fy: "FY24", s: "Adj. EBITDA", v: 392 }, { fy: "FY25", s: "Adj. EBITDA", v: 415 }, { fy: "LTM", s: "Adj. EBITDA", v: 421 },
        { fy: "FY23", s: "Reported (pre add-back)", v: 318 }, { fy: "FY24", s: "Reported (pre add-back)", v: 329 }, { fy: "FY25", s: "Reported (pre add-back)", v: 341 }, { fy: "LTM", s: "Reported (pre add-back)", v: 344 },
      ],
      encode: { x: "fy", y: "v", color: "s" },
      transform: [{ type: "dodgeX" }],
      scale: { color: { domain: ["Adj. EBITDA", "Reported (pre add-back)"], range: [CHART_HEX.accent, CHART_HEX.eq] } },
      axis: MC_AXIS,
      legend: { color: { position: "top" } },
      labels: [{ text: "v", position: "top", fontSize: 10.5, fontWeight: 600, transform: [{ type: "overlapHide" }] }],
    } },
    { kind: "line", title: "CP-1-09 · Net leverage", unit: "x", sourceIds: ["CP-1:K-09"], accessibleSummary: "Adjusted net leverage declines from 6.7x in FY23 to 5.68x LTM, with each successive period lower than the prior one.", columns: [{ key: "fy", label: "Period" }, { key: "v", label: "Net leverage (x)" }], h: 168, note: "Deleveraging from EBITDA growth — net debt flat ~$2.4B", spec: {
      type: "view",
      data: [{ fy: "FY23", v: 6.7 }, { fy: "FY24", v: 6.0 }, { fy: "FY25", v: 5.7 }, { fy: "LTM", v: 5.68 }],
      children: [
        { type: "line", encode: { x: "fy", y: "v" }, style: { stroke: CHART_HEX.teal, lineWidth: 2 } },
        { type: "point", encode: { x: "fy", y: "v" }, style: { fill: CHART_HEX.teal },
          labels: [{ text: (d: { v: number }) => d.v.toFixed(2).replace(/0$/, "") + "x", fontSize: 10.5, fontWeight: 600, transform: [{ type: "overlapDodgeY" }] }] },
      ],
      scale: { y: { domain: [5, 7] } },
      axis: MC_AXIS,
    } },
  ],

  /* ---- CP-1A · Business profile ---- */
  "CP-1A": [
    { kind: "stacked-bar", title: "CP-1A-06 · Segment mix — revenue vs gross profit", unit: "%", sourceIds: ["CP-1A:06", "E-12", "E-15"], accessibleSummary: "Aftermarket and Services represents 23% of revenue but 44% of gross profit; Drivetrain is 46% of revenue and 34% of gross profit.", columns: [{ key: "m", label: "Measure" }, { key: "seg", label: "Segment" }, { key: "v", label: "Share (%)" }], h: 132, note: "Aftermarket: 23% of revenue → 44% of gross profit. GP split ex-aftermarket pro-rata (mock).", spec: {
      type: "interval",
      data: [
        { m: "Revenue", seg: "Drivetrain", v: 46 }, { m: "Revenue", seg: "Fluid Systems", v: 31 }, { m: "Revenue", seg: "Aftermarket & Services", v: 23 },
        { m: "Gross profit", seg: "Drivetrain", v: 34 }, { m: "Gross profit", seg: "Fluid Systems", v: 22 }, { m: "Gross profit", seg: "Aftermarket & Services", v: 44 },
      ],
      encode: { x: "m", y: "v", color: "seg" },
      transform: [{ type: "stackY" }],
      coordinate: { transform: [{ type: "transpose" }] },
      scale: { color: { domain: ["Drivetrain", "Fluid Systems", "Aftermarket & Services"], range: [CHART_HEX.slateDeep, CHART_HEX.slate, CHART_HEX.teal] } },
      axis: { x: { title: false }, y: false },
      legend: { color: { position: "top" } },
      labels: [{ text: (d: { v: number }) => d.v + "%", position: "inside", fontSize: 10.5, fontWeight: 600, transform: [{ type: "contrastReverse" }, { type: "overflowHide" }] }],
    } },
  ],

  /* ---- CP-1B · Earnings monitor ---- */
  "CP-1B": [
    { kind: "bar", title: "CP-1B-06 · Revenue & Adj. EBITDA — quarterly", unit: "$M", sourceIds: ["CP-1B:T6", "E-58", "G-02"], accessibleSummary: "Quarterly revenue ranges from $688M to $715M and adjusted EBITDA from $103M to $108M; Q4-25 is a derived period.", columns: [{ key: "q", label: "Quarter" }, { key: "s", label: "Measure" }, { key: "v", label: "$M" }], h: 168, note: "* Q4-25 derived period (gap G-02)", spec: {
      type: "interval",
      data: [
        { q: "Q2-25", s: "Revenue", v: 688 }, { q: "Q3-25", s: "Revenue", v: 701 }, { q: "Q4-25*", s: "Revenue", v: 697 }, { q: "Q1-26", s: "Revenue", v: 715 },
        { q: "Q2-25", s: "Adj. EBITDA", v: 103 }, { q: "Q3-25", s: "Adj. EBITDA", v: 106 }, { q: "Q4-25*", s: "Adj. EBITDA", v: 104 }, { q: "Q1-26", s: "Adj. EBITDA", v: 108 },
      ],
      encode: { x: "q", y: "v", color: "s" },
      transform: [{ type: "dodgeX" }],
      scale: { color: { domain: ["Revenue", "Adj. EBITDA"], range: [CHART_HEX.accent, CHART_HEX.teal] } },
      axis: MC_AXIS,
      legend: { color: { position: "top" } },
      labels: [{ text: "v", position: "top", fontSize: 10.5, fontWeight: 600, transform: [{ type: "overlapHide" }] }],
    } },
    { kind: "line", title: "CP-1B-06 · Aftermarket mix & book-to-bill — quarterly", unit: "% / x10", sourceIds: ["CP-1B:T6", "E-58"], accessibleSummary: "Aftermarket mix increases from 22.4% to 23.4% over four quarters; book-to-bill dips to 0.98x in derived Q4-25 before rising to 1.06x in Q1-26.", columns: [{ key: "q", label: "Quarter" }, { key: "s", label: "Measure" }, { key: "v", label: "Chart value" }], h: 168, note: "Mix grind +100bps over 4 quarters — most thesis-supportive trend", spec: {
      type: "view",
      data: [
        { q: "Q2-25", s: "Aftermarket mix (%)", v: 22.4 }, { q: "Q3-25", s: "Aftermarket mix (%)", v: 22.8 }, { q: "Q4-25*", s: "Aftermarket mix (%)", v: 23.1 }, { q: "Q1-26", s: "Aftermarket mix (%)", v: 23.4 },
        { q: "Q2-25", s: "Book-to-bill (×10)", v: 10.2 }, { q: "Q3-25", s: "Book-to-bill (×10)", v: 10.4 }, { q: "Q4-25*", s: "Book-to-bill (×10)", v: 9.8 }, { q: "Q1-26", s: "Book-to-bill (×10)", v: 10.6 },
      ],
      children: [
        { type: "line", encode: { x: "q", y: "v", color: "s" } },
        { type: "point", encode: { x: "q", y: "v", color: "s" } },
      ],
      scale: { color: { domain: ["Aftermarket mix (%)", "Book-to-bill (×10)"], range: [CHART_HEX.teal, CHART_HEX.warning] } },
      axis: MC_AXIS,
      legend: { color: { position: "top" } },
    } },
  ],

  /* ---- CP-1C · Peer benchmarking ---- */
  "CP-1C": [
    { kind: "scatter", title: "CP-1C-04C · Peer map — EBITDA margin vs spread", unit: "% / bps", sourceIds: ["CP-1C:04C", "MKT"], accessibleSummary: "Atlas Forge plots at a 15.0% EBITDA margin and 388bps discount margin; Tarn is the widest-spread peer at 577bps and is marked as an excluded distressed outlier.", columns: [{ key: "name", label: "Issuer" }, { key: "mgn", label: "EBITDA margin (%)" }, { key: "dm", label: "DM (bps)" }, { key: "grp", label: "Peer group" }], h: 220, note: "Up-left = rich, down-right = cheap. Tarn excluded from median (distressed outlier).", spec: {
      type: "point",
      data: [
        { name: "Atlas Forge ◆", mgn: 15.0, dm: 388, grp: "Subject" },
        { name: "Forgeline", mgn: 13.8, dm: 352, grp: "Peer" },
        { name: "Karst", mgn: 12.1, dm: 459, grp: "Peer" },
        { name: "Veldt", mgn: 16.2, dm: 291, grp: "Peer" },
        { name: "Ironvale", mgn: 14.1, dm: 327, grp: "Peer" },
        { name: "Cascadia", mgn: 13.2, dm: 341, grp: "Peer" },
        { name: "Tarn (excl.)", mgn: 11.4, dm: 577, grp: "Excluded outlier" },
      ],
      encode: { x: "mgn", y: "dm", color: "grp" },
      scale: {
        x: { domain: [10.5, 17] },
        y: { domain: [250, 620] },
        color: { domain: ["Subject", "Peer", "Excluded outlier"], range: [CHART_HEX.accent, CHART_HEX.muted, CHART_HEX.warning] },
      },
      axis: { x: { title: "EBITDA margin (%)" }, y: { title: "DM (bps)" } },
      legend: { color: { position: "top" } },
      style: { r: 4, fillOpacity: 0.95 },
      labels: [{ text: "name", fontSize: 10.5, fontWeight: 600, transform: [{ type: "overlapDodgeY" }] }],
    } },
  ],

  /* ---- CP-3 · Relative value ---- */
  "CP-3": [
    { kind: "bar", title: "CP-3-05 · Excess spread vs fair-band midpoint", unit: "bps", sourceIds: ["CP-3:05", "MKT"], accessibleSummary: "The subject instrument is 56bps wide of fair value and the module note records a rank of 2 of 7 in the full set; Karst is 24bps rich.", columns: [{ key: "name", label: "Instrument" }, { key: "v", label: "Excess spread (bps)" }, { key: "grp", label: "Classification" }], h: 196, note: "Positive = trades wide of fair value (cheap). Subject ranks 2/7.", spec: {
      type: "interval",
      data: [
        { name: "ATLF 2L TL '31 ◆", v: 56, grp: "Subject" },
        { name: "Cascadia 2L TL '30", v: 51, grp: "Cheap" },
        { name: "Forgeline TLB '30", v: 15, grp: "Cheap" },
        { name: "Ironvale TLB '29", v: 10, grp: "Cheap" },
        { name: "Veldt TLB '30", v: -2, grp: "Rich" },
        { name: "Karst TLB '29", v: -24, grp: "Rich" },
      ],
      encode: { x: "name", y: "v", color: "grp" },
      coordinate: { transform: [{ type: "transpose" }] },
      transform: [{ type: "sortX", by: "y", reverse: true }],
      scale: { color: { domain: ["Subject", "Cheap", "Rich"], range: [CHART_HEX.accent, CHART_HEX.success, CHART_HEX.critical] } },
      axis: { x: { title: false }, y: { title: false, labelFormatter: (d: number) => (d > 0 ? "+" + d : String(d)) } },
      legend: { color: { position: "top" } },
      labels: [{ text: (d: { v: number }) => (d.v > 0 ? "+" + d.v : String(d.v)), position: "outside", fontSize: 10.5, fontWeight: 600, transform: [{ type: "exceedAdjust" }] }],
    } },
  ],
};

// Shared grid renderer for both chart registries: the demo fixtures here and
// the live builders in LiveModuleCharts.tsx render identically — only the
// provenance badge differs, which is exactly the invariant (a live chart is
// never mistakable for a fixture by anything except its declared status).
export interface ChartGridDef {
  kind: VisualizationKind;
  title: string;
  unit?: string;
  sourceIds: string[];
  accessibleSummary: string;
  columns: VisualizationColumn[];
  note?: string;
  h?: number;
  spec: G2Spec;
}

export function ModuleChartGrid({ defs, status }: { defs: ChartGridDef[]; status: { label: string; tone: "idle" | "success" } }) {
  return (
    <div className="module-chart-grid">
      {defs.map((c, i) => {
        const { data: chartData = [], ...chart } = c.spec;
        const data = chartData as VisualizationDatum[];
        return (
          <SemanticVisualization
            key={i}
            height={c.h || 180}
            spec={{
              kind: c.kind,
              title: c.title,
              unit: c.unit,
              sourceIds: c.sourceIds,
              accessibleSummary: c.accessibleSummary,
              note: c.note,
              status,
              data,
              tabularFallback: { label: `${c.title} data`, columns: c.columns, data },
              chart,
            }}
          />
        );
      })}
    </div>
  );
}

export function ModuleCharts({ id }: { id: string }) {
  const defs = MODULE_CHARTS[id];
  if (!defs) return null;
  return <ModuleChartGrid defs={defs} status={{ label: "Reference fixture", tone: "idle" }} />;
}
