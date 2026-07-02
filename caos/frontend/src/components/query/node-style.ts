// Pure node shape/color resolution for the Query graph surface, lifted out of
// NodeMark so the renderer stays a thin projector. nodeStyle(n) maps a node's
// kind/flags to its glyph shape and CSS colors; same node → same style. Colors
// and geometry are byte-identical to the former inline derivation.

import type { GraphNode } from "@/lib/query/graph";
import { CHART_HEX, TRANCHE_HEX } from "@/lib/chart-colors";

// The model-lane / analyst-ratified provenance hue — the categorical purple
// below (the "sub" tranche family). Named once so the overlay UI (dashed
// proposed edges, commentary chrome, accept state) references one definition
// instead of scattering the literal.
export const MODEL_HUE = "#a78bfa";

// Categorical hues for issuer grouping (industry/country). Distinct, no banding —
// pairs with the always-present text label, so meaning is never color-only. The
// first three mirror tokens (via chart-colors); the rest are graph-only hues.
const CATEGORICAL = [TRANCHE_HEX["1l"], CHART_HEX.accent, CHART_HEX.warning, MODEL_HUE, "#94a3b8", "#f472b6", "#34d399", "#fb923c"];

export function hueFor(group: string | null | undefined): string {
  if (!group) return "var(--caos-muted)";
  let h = 0;
  for (let i = 0; i < group.length; i++) h = (h * 31 + group.charCodeAt(i)) >>> 0;
  return CATEGORICAL[h % CATEGORICAL.length];
}

// kind → fill/stroke for non-issuer nodes. Issuer/sector nodes color by group.
// Node strokes mirror semantic tokens (via chart-colors); fills are graph-only
// dark tints with no token twin, so they stay literal.
const KIND: Record<string, { fill: string; stroke: string }> = {
  driver: { fill: "rgba(245, 165, 36, 0.15)", stroke: CHART_HEX.warning },
  module: { fill: "var(--caos-panel)", stroke: "var(--caos-border)" },
  claim: { fill: "var(--caos-panel)", stroke: CHART_HEX.accent },
  evidence: { fill: "var(--caos-panel)", stroke: "var(--caos-border)" },
  chunk: { fill: "rgba(34, 197, 94, 0.10)", stroke: CHART_HEX.success },
  metric: { fill: "var(--caos-panel)", stroke: CHART_HEX.accent },
  "point-bull": { fill: "rgba(34, 197, 94, 0.15)", stroke: CHART_HEX.success },
  "point-bear": { fill: "rgba(239, 68, 68, 0.15)", stroke: CHART_HEX.critical },
  "finding-crit": { fill: "rgba(239, 68, 68, 0.15)", stroke: CHART_HEX.critical },
  "finding-mat": { fill: "rgba(245, 165, 36, 0.15)", stroke: CHART_HEX.warning },
  "finding-min": { fill: "var(--caos-elevated)", stroke: "var(--caos-idle)" },
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
    fill = "var(--caos-panel)"; stroke = n.flag ? CHART_HEX.warning : CHART_HEX.accent; r = 19; sw = 2.6;
  } else if (n.kind === "issuer") {
    fill = groupColor + "33"; stroke = n.exposed ? CHART_HEX.warning : groupColor; r = 11; sw = n.exposed ? 2.4 : 1.8;
  } else {
    fill = palette?.fill ?? "var(--caos-panel)"; stroke = n.flag ? CHART_HEX.warning : palette?.stroke ?? "var(--caos-border)"; r = 13; sw = 1.4;
  }
  const isMono = n.kind === "claim" || n.kind === "evidence" || n.kind === "metric" || n.kind === "module";
  const shape = isCircle ? "circle" : n.kind === "sector" ? "pill" : "rect";

  return { shape, fill, stroke, r, sw, isCircle, isMono, color: n.flag ? CHART_HEX.warning : groupColor };
}
