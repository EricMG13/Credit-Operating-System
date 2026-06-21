// Auto-select a visualization + generate a narrative for an NL query result.
//
// Pure over the result DTO so it unit-tests without a DOM: the NlQuery surface
// renders whatever this returns. A chart is emitted only when the result is
// multi-point (≥2 ranked numeric rows); the narrative is always produced. Keyed
// off the result shape, mirroring the intent→viz mapping (rank → bar, semantic →
// no chart, scalar/empty → narrative only).

import type { G2Spec } from "@/components/charts/G2Chart";
import { CHART_HEX } from "@/lib/chart-colors";
import { fmtMetric } from "@/lib/query/format";
import type { NlQueryResult } from "@/lib/query/types";

// Provenance → trust colour: run-derived (accent) and document-derived (teal)
// are cited; seed is illustrative (muted slate).
const PROV = { run: CHART_HEX.accent, derived: CHART_HEX.teal, seed: CHART_HEX.eq };

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// A horizontal bar of the ranked metric across issuers, coloured by provenance.
// null when the result isn't a rankable multi-row structured result (→ no chart).
export function barSpecFor(res: NlQueryResult): G2Spec | null {
  if (res.mode === "semantic") return null;
  const col = res.columns.find((c) => c.key === res.rank_by);
  if (!col) return null;
  const data = res.rows
    .map((r) => ({
      name: r.issuer.name,
      value: r.metrics[res.rank_by]?.value,
      prov: r.metrics[res.rank_by]?.provenance ?? "seed",
    }))
    .filter((d): d is { name: string; value: number; prov: "run" | "derived" | "seed" } => typeof d.value === "number");
  if (data.length < 2) return null;
  return {
    type: "interval",
    data,
    encode: { x: "name", y: "value", color: "prov" },
    coordinate: { transform: [{ type: "transpose" }] },
    scale: {
      color: { domain: ["run", "derived", "seed"], range: [PROV.run, PROV.derived, PROV.seed] },
      x: { padding: 0.3 },
    },
    axis: { x: { title: false }, y: { title: false } },
    legend: { color: { position: "top" } },
    labels: [{ text: (d: { value: number }) => fmtMetric(d.value, col.unit), position: "right", fontSize: 9, dx: 2 }],
    tooltip: { items: [{ channel: "y", valueFormatter: (v: number) => fmtMetric(v, col.unit) }] },
  };
}

// One- to two-line plain-language summary of the result. Always produced.
export function narrate(res: NlQueryResult): string {
  if (res.mode === "semantic") {
    if (!res.rows.length) return "No issuer documents matched.";
    const top = res.rows[0];
    const total = res.rows.reduce((s, r) => s + r.excerpts.length, 0);
    return `${res.rows.length} issuer${res.rows.length === 1 ? "" : "s"} matched on document evidence — top hit ${top.issuer.name} (${top.excerpts.length} excerpt${top.excerpts.length === 1 ? "" : "s"}, ${total} total).`;
  }
  if (!res.rows.length) return "No issuers matched.";
  const col = res.columns.find((c) => c.key === res.rank_by);
  if (!col) return "";
  const vals = res.rows
    .map((r) => r.metrics[res.rank_by]?.value)
    .filter((v): v is number => typeof v === "number");
  if (!vals.length) return "";
  const top = res.rows[0];
  const topV = top.metrics[res.rank_by]?.value;
  const cited = res.rows.filter((r) => {
    const p = r.metrics[res.rank_by]?.provenance;
    return p === "run" || p === "derived";
  }).length;
  // State the metric's polarity explicitly so "leads the result" isn't misread as
  // good/bad — for net leverage higher is weaker, for coverage higher is stronger.
  const dir = col.higher_is_better ? "higher = stronger" : "higher = weaker";
  const lead =
    typeof topV === "number"
      ? `${top.issuer.name} leads the result on ${col.label.toLowerCase()} at ${fmtMetric(topV, col.unit)} (${dir})`
      : `${top.issuer.name} leads the result on ${col.label.toLowerCase()} (${dir})`;
  const med = median(vals);
  const vsMed =
    typeof topV === "number" && vals.length > 2
      ? `, ${fmtMetric(Math.abs(topV - med), col.unit)} ${topV >= med ? "above" : "below"} the ${fmtMetric(med, col.unit)} median`
      : "";
  return `${lead}${vsMed}. ${res.rows.length} issuers ranked · ${cited}/${res.rows.length} cited (run/derived), the rest seed.`;
}
