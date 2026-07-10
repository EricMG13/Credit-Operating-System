// Pure cell-styling logic for the Model Builder sheet, lifted out of Sheet's
// renderCell so the grid render stays readable. Every function is pure:
// same inputs → same CSS string. Behavior is identical to the former inline
// derivations.

// KPI distress shading: leverage worsens up (orange 6.0x → red 8.0x), interest
// coverage worsens down (orange 2.0x → red 0.5x). Returns null when the metric
// is benign (below/above the band) so the normal cell color applies.
const LEV_ROWS = new Set(["srsec", "totlev", "netlev"]);
const ORANGE = [245, 165, 36];
const RED = [239, 68, 68];

export function kpiDistressColor(rowId: string, v: number | null): string | null {
  if (v == null) return null;
  let t: number | null = null;
  if (LEV_ROWS.has(rowId)) t = (v - 6) / 2;        // 6x → 0 (orange), 8x → 1 (red)
  else if (rowId === "intcov") t = (2 - v) / 1.5;  // 2x → 0 (orange), 0.5x → 1 (red)
  if (t == null || t < 0) return null;
  t = Math.min(1, t);
  const c = ORANGE.map((o, i) => Math.round(o + (RED[i] - o) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Severity band for a KPI cell, mirroring kpiDistressColor's thresholds so
// distress is signalled by a glyph too (never color-alone, per the design
// mandate). null where the color is null (benign); "crit" at the red end where
// the interpolation clamps (t >= 1); "warn" through the orange→red ramp.
export function kpiDistressLevel(rowId: string, v: number | null): "warn" | "crit" | null {
  if (v == null) return null;
  let t: number | null = null;
  if (LEV_ROWS.has(rowId)) t = (v - 6) / 2;
  else if (rowId === "intcov") t = (2 - v) / 1.5;
  if (t == null || t < 0) return null;
  return t >= 1 ? "crit" : "warn";
}

// Glyph paired with each distress band (▲ = critical, ■ = warning) so the
// KPI shading meaning survives without color. Drawn glyphs, no emoji.
export const KPI_DISTRESS_GLYPH: Record<"warn" | "crit", string> = { warn: "■", crit: "▲" };

// Cell text color: KPI distress shading wins; otherwise override > pct sign >
// negative-money muting > bold > default.
export function cellTextColor(opts: {
  rowId: string;
  v: number | null;
  isOv: boolean;
  pct: boolean;
  bold: boolean;
  rowFmt?: string;
}): string {
  const { rowId, v, isOv, pct, bold, rowFmt } = opts;
  return (
    kpiDistressColor(rowId, v) ??
    (isOv
      ? "var(--caos-warning)"
      : pct
      ? v != null && v < 0
        ? "var(--caos-critical)"
        : "var(--caos-accent)"
      : v != null && v < 0 && rowFmt === "m"
      ? "var(--caos-muted)"
      : bold
      ? "var(--caos-text)"
      : "var(--caos-text)")
  );
}

// Cell background: selection > flashed cell > column/row highlight > shade band.
export function cellBackground(opts: {
  isSel: boolean;
  cellHl: boolean;
  colHl: boolean;
  isHl: boolean;
  shade: boolean;
}): string {
  const { isSel, cellHl, colHl, isHl, shade } = opts;
  return isSel
    ? "color-mix(in srgb, var(--caos-accent) 22%, transparent)"
    : cellHl
    ? "rgba(79,140,255,0.28)"
    : colHl || isHl
    ? "rgba(79,140,255,0.08)"
    : shade
    ? "rgba(255,255,255,0.025)"
    : "transparent";
}

export function cellBoxShadow(isSel: boolean, cellHl: boolean): string {
  return isSel
    ? "inset 0 0 0 1px var(--caos-accent)"
    : cellHl
    ? "inset 0 0 0 1px rgba(79,140,255,0.6)"
    : "none";
}
