"use client";

// Per-module G2 chart registry rendered inside the generic module view
// (port of design bundle shared/module-charts.jsx, deployed from the
// antv-g2-chart skill). Covers the L1 base modules + CP-3 relative value.

import { G2Chart, type G2Spec } from "@/components/charts/G2Chart";
import { CHART_HEX } from "@/lib/chart-colors";

const MC_AXIS = { x: { title: false }, y: { title: false } };

interface ModuleChartDef {
  title: string;
  h?: number;
  note?: string;
  spec: G2Spec;
}

export const MODULE_CHARTS: Record<string, ModuleChartDef[]> = {
  /* ---- CP-1 · Financial normalization ---- */
  "CP-1": [
    { title: "CP-1-07 · Adj. vs reported EBITDA ($M)", h: 168, note: "Gap = add-backs — 18.2% of adj. in LTM (E-09)", spec: {
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
      labels: [{ text: "v", position: "top", fontSize: 8.5, transform: [{ type: "overlapHide" }] }],
    } },
    { title: "CP-1-09 · Net leverage (adj.)", h: 168, note: "Deleveraging from EBITDA growth — net debt flat ~$2.4B", spec: {
      type: "view",
      data: [{ fy: "FY23", v: 6.7 }, { fy: "FY24", v: 6.0 }, { fy: "FY25", v: 5.7 }, { fy: "LTM", v: 5.68 }],
      children: [
        { type: "line", encode: { x: "fy", y: "v" }, style: { stroke: CHART_HEX.teal, lineWidth: 2 } },
        { type: "point", encode: { x: "fy", y: "v" }, style: { fill: CHART_HEX.teal },
          labels: [{ text: (d: { v: number }) => d.v.toFixed(2).replace(/0$/, "") + "x", fontSize: 8.5, transform: [{ type: "overlapDodgeY" }] }] },
      ],
      scale: { y: { domain: [5, 7] } },
      axis: MC_AXIS,
    } },
  ],

  /* ---- CP-1A · Business profile ---- */
  "CP-1A": [
    { title: "CP-1A-06 · Segment mix — revenue vs gross profit (%)", h: 132, note: "Aftermarket: 23% of revenue → 44% of gross profit. GP split ex-aftermarket pro-rata (mock).", spec: {
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
      labels: [{ text: (d: { v: number }) => d.v + "%", position: "inside", fontSize: 8.5, transform: [{ type: "contrastReverse" }, { type: "overflowHide" }] }],
    } },
  ],

  /* ---- CP-1B · Earnings monitor ---- */
  "CP-1B": [
    { title: "CP-1B-06 · Revenue & Adj. EBITDA ($M, quarterly)", h: 168, note: "* Q4-25 derived period (gap G-02)", spec: {
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
      labels: [{ text: "v", position: "top", fontSize: 8.5, transform: [{ type: "overlapHide" }] }],
    } },
    { title: "CP-1B-06 · Aftermarket mix & book-to-bill (quarterly)", h: 168, note: "Mix grind +100bps over 4 quarters — most thesis-supportive trend", spec: {
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
    { title: "CP-1C-04C · Peer map — EBITDA margin vs spread", h: 220, note: "Up-left = rich, down-right = cheap. Tarn excluded from median (distressed outlier).", spec: {
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
      labels: [{ text: "name", fontSize: 8.5, transform: [{ type: "overlapDodgeY" }] }],
    } },
  ],

  /* ---- CP-3 · Relative value ---- */
  "CP-3": [
    { title: "CP-3-05 · Excess spread vs fair band (bps, band mid)", h: 196, note: "Positive = trades wide of fair value (cheap). Subject ranks 2/7.", spec: {
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
      labels: [{ text: (d: { v: number }) => (d.v > 0 ? "+" + d.v : String(d.v)), position: "outside", fontSize: 8.5, transform: [{ type: "exceedAdjust" }] }],
    } },
  ],
};

export function ModuleCharts({ id }: { id: string }) {
  const defs = MODULE_CHARTS[id];
  if (!defs) return null;
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: defs.length > 1 ? "1fr 1fr" : "1fr" }}>
      {defs.map((c, i) => (
        <div key={i} className="rounded border border-caos-border bg-caos-bg">
          <div className="px-3 py-2 border-b border-caos-border flex items-center">
            <span className="tabular text-[9px] uppercase tracking-wider text-caos-muted">{c.title}</span>
          </div>
          <div className="px-2 pt-1">
            <G2Chart spec={c.spec} height={c.h || 180} />
          </div>
          {c.note ? <div className="px-3 py-1.5 tabular text-[8.5px] text-caos-muted">{c.note}</div> : null}
        </div>
      ))}
    </div>
  );
}
