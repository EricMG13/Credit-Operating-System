// Pure node shape/color resolution for the Query graph surface, lifted out of
// NodeMark so the renderer stays a thin projector. nodeStyle(n) maps a node's
// kind/flags to its glyph shape and CSS colors; same node → same style. Colors
// and geometry are byte-identical to the former inline derivation.

import type { GraphNode } from "@/lib/query/graph";
import { CHART_HEX, TRANCHE_HEX } from "@/lib/chart-colors";

// Categorical hues for issuer grouping (industry/country). Distinct, no banding —
// pairs with the always-present text label, so meaning is never color-only. The
// first three mirror tokens (via chart-colors); the rest are graph-only hues.
const CATEGORICAL = [TRANCHE_HEX["1l"], CHART_HEX.accent, CHART_HEX.warning, "#a78bfa", "#94a3b8", "#f472b6", "#34d399", "#fb923c"];

export function hueFor(group: string | null | undefined): string {
  if (!group) return "#6b7280";
  let h = 0;
  for (let i = 0; i < group.length; i++) h = (h * 31 + group.charCodeAt(i)) >>> 0;
  return CATEGORICAL[h % CATEGORICAL.length];
}

// kind → fill/stroke for non-issuer nodes. Issuer/sector nodes color by group.
// Node strokes mirror semantic tokens (via chart-colors); fills are graph-only
// dark tints with no token twin, so they stay literal.
const KIND: Record<string, { fill: string; stroke: string }> = {
  driver: { fill: "#2a1f08", stroke: CHART_HEX.warning },
  module: { fill: "#15151d", stroke: "#3a4a6a" },
  claim: { fill: "#15151d", stroke: CHART_HEX.accent },
  evidence: { fill: "#15151d", stroke: "#33333f" },
  chunk: { fill: "#0f1a12", stroke: CHART_HEX.success },
  metric: { fill: "#15151d", stroke: CHART_HEX.accent },
  "point-bull": { fill: "#0f2417", stroke: CHART_HEX.success },
  "point-bear": { fill: "#2a1212", stroke: CHART_HEX.critical },
  "finding-crit": { fill: "#2a1212", stroke: CHART_HEX.critical },
  "finding-mat": { fill: "#2a1f08", stroke: CHART_HEX.warning },
  "finding-min": { fill: "#1a1a24", stroke: "#3f3f46" },
};

export type NodeStyle = {
  shape: "compact" | "circle" | "pill" | "rect";
  fill: string;
  stroke: string;
  r: number;
  sw: number;
  isCircle: boolean;
  isMono: boolean;
  /** Pill (sector) glyph color; ignored for other shapes. */
  color: string;
};

export function nodeStyle(n: GraphNode): NodeStyle {
  const groupColor = hueFor(n.group);
  const palette = KIND[n.kind];

  // Compact cluster member: a small dot, name on hover only.
  if (n.compact) {
    return {
      shape: "compact",
      fill: palette?.fill ?? groupColor + "33",
      stroke: palette?.stroke ?? groupColor,
      r: 6,
      sw: 1.4,
      isCircle: false,
      isMono: false,
      color: groupColor,
    };
  }

  // Shape: issuers + center are circles colored by group; everything else is a
  // small rounded rect tinted by kind. Sector/cluster nodes read as a pill.
  const isCircle = n.kind === "issuer" || n.kind === "center";
  let fill: string, stroke: string, r: number, sw: number;
  if (n.kind === "center") {
    fill = "#10131f"; stroke = n.flag ? CHART_HEX.warning : CHART_HEX.accent; r = 19; sw = 2.6;
  } else if (n.kind === "issuer") {
    fill = groupColor + "33"; stroke = n.exposed ? CHART_HEX.warning : groupColor; r = 11; sw = n.exposed ? 2.4 : 1.8;
  } else {
    fill = palette?.fill ?? "#15151d"; stroke = n.flag ? CHART_HEX.warning : palette?.stroke ?? "#33333f"; r = 13; sw = 1.4;
  }
  const isMono = n.kind === "claim" || n.kind === "evidence" || n.kind === "metric" || n.kind === "module";
  const shape = isCircle ? "circle" : n.kind === "sector" ? "pill" : "rect";

  return { shape, fill, stroke, r, sw, isCircle, isMono, color: n.flag ? CHART_HEX.warning : groupColor };
}
