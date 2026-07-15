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
// are cited; seed is illustrative (muted slate); fixture is the reference-demo
// (warning); demo_fixture is fabricated (critical — must not read as seed, #10).
const PROV = {
  run: CHART_HEX.accent, derived: CHART_HEX.teal, seed: CHART_HEX.eq,
  fixture: CHART_HEX.warning, demo_fixture: CHART_HEX.critical,
};

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// A horizontal bar of the ranked metric across issuers, coloured by provenance.
// null when the result isn't a rankable multi-row structured result (→ no chart).
export function barSpecFor(res: NlQueryResult): G2Spec | null {
  // Only structured/hybrid results carry columns + a rankable metric; semantic
  // and synthesis (agent-wiki) results have no `columns` at all (SEAM1-1).
  if (res.mode !== "structured" && res.mode !== "hybrid") return null;
  const col = res.columns.find((c) => c.key === res.rank_by);
  if (!col) return null;
  const data = res.rows
    .map((r) => ({
      name: r.issuer.name,
      value: r.metrics[res.rank_by]?.value,
      prov: r.metrics[res.rank_by]?.provenance ?? "seed",
    }))
    .filter((d): d is { name: string; value: number; prov: keyof typeof PROV } => typeof d.value === "number");
  if (data.length < 2) return null;
  return {
    type: "interval",
    data,
    encode: { x: "name", y: "value", color: "prov" },
    coordinate: { transform: [{ type: "transpose" }] },
    scale: {
      // Full provenance domain so a fabricated (demo_fixture) or reference-demo
      // (fixture) bar gets its own honest colour + legend entry, never an
      // undefined off-domain fill that reads as an ordinary category (#10).
      color: {
        domain: ["run", "derived", "seed", "fixture", "demo_fixture"],
        range: [PROV.run, PROV.derived, PROV.seed, PROV.fixture, PROV.demo_fixture],
      },
      x: { padding: 0.3 },
    },
    axis: { x: { title: false }, y: { title: false } },
    legend: { color: { position: "top" } },
    labels: [{ text: (d: { value: number }) => fmtMetric(d.value, col.unit), position: "right", fontSize: 10.5, fontWeight: 600, dx: 2 }],
    tooltip: { items: [{ channel: "y", valueFormatter: (v: number) => fmtMetric(v, col.unit) }] },
  };
}

// One- to two-line plain-language summary of the result. Always produced.
export function narrate(res: NlQueryResult): string {
  if (res.mode === "semantic" || res.mode === "synthesis") {
    const what = res.mode === "semantic" ? "document evidence" : "agent syntheses and QA findings";
    if (!res.rows.length) {
      return res.mode === "semantic" ? "No issuer documents matched." : "No matching agent syntheses, claims, or QA findings.";
    }
    const top = res.rows[0];
    const total = res.rows.reduce((s, r) => s + r.excerpts.length, 0);
    return `${res.rows.length} issuer${res.rows.length === 1 ? "" : "s"} matched on ${what} — top hit ${top.issuer.name} (${top.excerpts.length} excerpt${top.excerpts.length === 1 ? "" : "s"}, ${total} total).`;
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
  // The cohort is capped at the top-N; the median is therefore of the shown rows,
  // not the coverage universe. Say so when capped so "above the median" isn't read
  // as an absolute universe statistic.
  const capped = res.total_ranked > res.rows.length;
  const medLabel = capped ? "median of these" : "median across";
  const vsMed =
    typeof topV === "number" && vals.length > 2
      ? `, ${fmtMetric(Math.abs(topV - med), col.unit)} ${topV >= med ? "above" : "below"} the ${fmtMetric(med, col.unit)} ${medLabel} ${res.rows.length}`
      : "";
  const ranked = capped
    ? `Top ${res.rows.length} of ${res.total_ranked} ranked`
    : `${res.rows.length} issuers ranked`;
  return `${lead}${vsMed}. ${ranked} · ${cited}/${res.rows.length} cited (run/derived), the rest seed.`;
}
