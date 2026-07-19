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
// pairs with the always-present text label, so meaning is never color-only.
// Deliberately excludes the semantic hues (warning/critical/success/MODEL_HUE):
// a hashed sector must never read as "exposed" (warning) or model/ratified
// provenance (purple). First two mirror tokens (via chart-colors); the rest are
// graph-only neutral/distinct hues.
const CATEGORICAL = [TRANCHE_HEX["1l"], CHART_HEX.accent, "#94a3b8", "#f472b6", "#34d399", "#22d3ee", "#818cf8"];

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

type NodeGeometry = Pick<NodeStyle, "fill" | "stroke" | "r" | "sw">;
const MONO_KINDS = new Set(["claim", "evidence", "metric", "module"]);

function compactStyle(groupColor: string, palette: { fill: string; stroke: string } | undefined): NodeStyle {
  return {
    shape: "compact",
    fill: palette?.fill ?? `color-mix(in srgb, ${groupColor} 20%, transparent)`,
    stroke: palette?.stroke ?? groupColor,
    r: 6,
    sw: 1.4,
    isCircle: false,
    isMono: false,
    color: groupColor,
  };
}

function centerGeometry(flagged: boolean): NodeGeometry {
  return { fill: "var(--caos-panel)", stroke: flagged ? CHART_HEX.warning : CHART_HEX.accent, r: 19, sw: 2.6 };
}

function issuerGeometry(groupColor: string, exposed: boolean): NodeGeometry {
  return {
    fill: `color-mix(in srgb, ${groupColor} 20%, transparent)`,
    stroke: exposed ? CHART_HEX.warning : groupColor,
    r: 11,
    sw: exposed ? 2.4 : 1.8,
  };
}

function rectangularGeometry(flagged: boolean, palette: { fill: string; stroke: string } | undefined): NodeGeometry {
  return {
    fill: palette?.fill ?? "var(--caos-panel)",
    stroke: flagged ? CHART_HEX.warning : palette?.stroke ?? "var(--caos-border)",
    r: 13,
    sw: 1.4,
  };
}

function regularGeometry(node: GraphNode, groupColor: string, palette: { fill: string; stroke: string } | undefined): NodeGeometry {
  if (node.kind === "center") return centerGeometry(Boolean(node.flag));
  if (node.kind === "issuer") return issuerGeometry(groupColor, Boolean(node.exposed));
  return rectangularGeometry(Boolean(node.flag), palette);
}

function regularShape(kind: string): Pick<NodeStyle, "shape" | "isCircle"> {
  if (kind === "issuer" || kind === "center") return { shape: "circle", isCircle: true };
  return { shape: kind === "sector" ? "pill" : "rect", isCircle: false };
}

export function nodeStyle(n: GraphNode): NodeStyle {
  const groupColor = hueFor(n.group);
  const palette = KIND[n.kind];

  // Compact cluster member: a small dot, name on hover only.
  if (n.compact) return compactStyle(groupColor, palette);

  // Shape: issuers + center are circles colored by group; everything else is a
  // small rounded rect tinted by kind. Sector/cluster nodes read as a pill.
  const geometry = regularGeometry(n, groupColor, palette);
  const shape = regularShape(n.kind);
  return { ...geometry, ...shape, isMono: MONO_KINDS.has(n.kind), color: n.flag ? CHART_HEX.warning : groupColor };
}
