"use client";

// Live-run counterpart of ModuleCharts: charts built from the module's persisted
// runtime_output instead of design fixtures. Provenance rules: every point comes
// from the payload, a time series below 2 points renders nothing, and the badge
// reads LIVE ENGINE OUTPUT so a live chart can never be mistaken for the
// reference fixtures (which stay demo-only in ModuleCharts.tsx).

import { useMemo } from "react";
import { CHART_HEX } from "@/lib/chart-colors";
import { humanize } from "@/lib/engine/adapt";
import type { VisualizationColumn } from "@/components/charts/SemanticVisualization";
import { ModuleChartGrid, type ChartGridDef } from "./ModuleCharts";

const AXIS = { x: { title: false }, y: { title: false } };
const LIVE_STATUS = { label: "Live engine output", tone: "success" as const };

export type LiveChartDef = ChartGridDef;

type Rt = Record<string, unknown>;

const isNum = (v: unknown): v is number => Number.isFinite(v);

const fmt = (v: number) =>
  Math.abs(v) >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : String(Math.round(v * 100) / 100);

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

// ponytail: mirrors engine/periods.py's (year, intra-year rank) sort_key —
// keep the two in sync by hand, they run in different runtimes. A raw string
// sort broke down for exactly this label mix once already (audit ENG-18/B3,
// fixed server-side in periods.py); synth.py's LLM-synthesized CP-1 payloads
// can freely mix "FY2024" / "Q3 2025" / bare "LTM" labels, so the same bug
// class is reachable here too — e.g. localeCompare puts "LTM_2025" before
// "Q3_2025" even though Q3 2025 precedes the current LTM figure.
// fallow-ignore-next-line complexity -- one guard per period-label shape (year digits, LTM prefix, quarter, half-year), mirroring periods.py's own branching one-for-one
function periodRank(period: string): number {
  const nums = period.match(/\d{2,4}/g);
  const raw = nums?.length ? Number(nums[nums.length - 1]) : -1;
  const isLtm = /^LTM/i.test(period);
  const year = raw < 0 ? (isLtm ? 9999 : -1) : raw < 100 ? raw + 2000 : raw;
  const q = period.match(/Q\s*([1-4])/i);
  const h = period.match(/\bH\s*([12])\b/i);
  const base = q ? Number(q[1]) : h ? (h[1] === "1" ? 2 : 4) : 4;
  return year + (base + (isLtm ? 0.5 : 0)) / 10;
}

/** {"FY2022": n, ...} -> sorted [{fy, v}] keeping only finite numbers, ordered
 * by chronological rank (not raw key text — see periodRank). Display labels
 * are then humanized so a machine key like LTM_Q1_26 reads "LTM Q1-26",
 * matching the adapter's table rendering. */
function fySeries(obj: unknown): { fy: string; v: number }[] {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  return Object.entries(obj as Rt)
    .filter((e): e is [string, number] => isNum(e[1]))
    .sort((a, b) => periodRank(a[0]) - periodRank(b[0]))
    .map(([fy, v]) => ({ fy: humanize(fy), v }));
}

/** "$M" for a USD-millions payload; "" when the payload carries no unit — the
 * chart then omits its unit line rather than showing a filler word. */
function unitLabel(rt: Rt): string {
  const sym = rt.currency === "USD" ? "$" : typeof rt.currency === "string" ? rt.currency : "";
  return rt.reporting_unit === "millions" && sym ? `${sym}M` : sym;
}

function spanText(label: string, s: { fy: string; v: number }[]): string {
  const a = s[0];
  const b = s[s.length - 1];
  return `${label} ${fmt(a.v)} in ${a.fy} to ${fmt(b.v)} in ${b.fy}`;
}

/** Column shorthand — every tabularFallback column key must mirror a data key. */
const col = (key: string, label: string): VisualizationColumn => ({ key, label });

/* ---- CP-1 · normalized financial trends ---- */
// fallow-ignore-next-line complexity -- one guard per optional payload field; the branching IS the payload contract
function cp1Charts(rt: Rt): LiveChartDef[] {
  const fin = (rt.normalized_financials ?? {}) as Rt;
  const source = `CP-1 · ${typeof rt.source === "string" && rt.source ? rt.source : "persisted run"}`;
  const unit = unitLabel(rt);
  const out: LiveChartDef[] = [];

  const revEbitda = [
    { s: "Revenue", pts: fySeries(fin.revenue) },
    { s: "Adj. EBITDA", pts: fySeries(fin.adj_ebitda) },
  ].filter((x) => x.pts.length >= 2);
  if (revEbitda.length) {
    const data = revEbitda.flatMap((x) => x.pts.map((p) => ({ fy: p.fy, s: x.s, v: p.v })));
    out.push({
      kind: "bar",
      title: "CP-1 · Revenue vs Adj. EBITDA",
      unit: unit || undefined,
      sourceIds: [source],
      accessibleSummary: revEbitda.map((x) => spanText(x.s, x.pts)).join("; ") + ".",
      columns: [col("fy", "Period"), col("s", "Measure"), col("v", unit || "Value")],
      h: 168,
      note: `Basis: ${typeof rt.basis === "string" ? rt.basis : "persisted engine output"}`,
      spec: {
        type: "interval",
        data,
        encode: { x: "fy", y: "v", color: "s" },
        transform: [{ type: "dodgeX" }],
        // fallow-ignore-next-line code-duplication -- grouped-bar tail repeats across builders by design: literal in-place specs beat shared fragments (see rewrite-tournament verdict)
        scale: { color: { domain: revEbitda.map((x) => x.s), range: [CHART_HEX.accent, CHART_HEX.teal] } },
        axis: AXIS,
        legend: { color: { position: "top" } },
        labels: [{ text: "v", position: "top", fontSize: 10.5, fontWeight: 600, transform: [{ type: "overlapHide" }] }],
      },
    });
  }

  const fcf = fySeries(fin.free_cash_flow);
  if (fcf.length >= 2) {
    out.push({
      kind: "line",
      title: "CP-1 · Free cash flow",
      unit: unit || undefined,
      sourceIds: [source],
      accessibleSummary: spanText("Free cash flow", fcf) + ".",
      columns: [col("fy", "Period"), col("v", unit || "Value")],
      h: 168,
      spec: {
        type: "view",
        data: fcf,
        // fallow-ignore-next-line code-duplication -- mirrors the demo CP-1-09 line idiom in ModuleCharts.tsx on purpose: cross-file visual parity is the feature
        children: [
          // Teal = the desk's neutral trend-line hue (demo CP-1-09). Green would
          // read as a success signal even when the FCF trend is negative.
          { type: "line", encode: { x: "fy", y: "v" }, style: { stroke: CHART_HEX.teal, lineWidth: 2 } },
          {
            type: "point",
            encode: { x: "fy", y: "v" },
            style: { fill: CHART_HEX.teal },
            labels: [{ text: (d: { v: number }) => fmt(d.v), fontSize: 10.5, fontWeight: 600, transform: [{ type: "overlapDodgeY" }] }],
          },
        ],
        axis: AXIS,
      },
    });
  }

  return out;
}

/* ---- shared percentile scorecard bar (CP-3 rv scorecard, CP-1C benchmark) ----
 * Both payloads carry rows of {metric, label, percentile, issuer_value,
 * peer_median} — CP-1C adds unit/outlier. Percentile is polarity-aware
 * ("% of peers the issuer is at least as good as"), so higher is always
 * stronger and one 0–100 scale fits mixed-unit metrics. */
const unitSuffix = (r: Rt) => (typeof r.unit === "string" ? r.unit : "");

function percentileBar(rows: Rt[], o: { title: string; sourceIds: string[]; note?: string }): LiveChartDef[] {
  const data = rows
    .filter((r) => isNum(r.percentile))
    .map((r) => ({
      m: typeof r.label === "string" ? r.label : String(r.metric ?? "metric"),
      v: r.percentile as number,
      grp: r.outlier === true ? "Bottom-quartile outlier" : "In line",
      issuer: isNum(r.issuer_value) ? fmt(r.issuer_value) + unitSuffix(r) : "—",
      median: isNum(r.peer_median) ? fmt(r.peer_median) + unitSuffix(r) : "—",
    }));
  if (!data.length) return [];
  const hasOutlier = data.some((d) => d.grp !== "In line");
  const rowText = (d: (typeof data)[number]) =>
    `${d.m} at the ${ordinal(d.v)} percentile (issuer ${d.issuer} vs peer median ${d.median})` +
    (d.grp === "In line" ? "" : ", a bottom-quartile outlier");
  return [
    {
      kind: "bar",
      title: o.title,
      unit: "pctile",
      sourceIds: o.sourceIds,
      accessibleSummary: data.map(rowText).join("; ") + ". Higher percentile is stronger versus peers.",
      columns: [col("m", "Metric"), col("v", "Percentile"), col("issuer", "Issuer"), col("median", "Peer median")],
      h: 168,
      note: o.note,
      // Color only when an outlier exists — a single-hue chart stays quiet,
      // and the outlier is also named in the note + summary (never color-only).
      // Two literal branches: each reads as the exact spec it emits, and the
      // explicit color domain can never be silently dropped by a spread edit.
      spec: hasOutlier
        ? {
            type: "interval",
            data,
            encode: { x: "m", y: "v", color: "grp" },
            scale: {
              y: { domain: [0, 100] },
              color: { domain: ["In line", "Bottom-quartile outlier"], range: [CHART_HEX.accent, CHART_HEX.warning] },
            },
            legend: { color: { position: "top" } },
            axis: AXIS,
            labels: [{ text: (d: { v: number }) => `${d.v}`, position: "top", fontSize: 10.5, fontWeight: 600 }],
          }
        : {
            type: "interval",
            data,
            encode: { x: "m", y: "v" },
            scale: { y: { domain: [0, 100] } },
            style: { fill: CHART_HEX.accent },
            axis: AXIS,
            labels: [{ text: (d: { v: number }) => `${d.v}`, position: "top", fontSize: 10.5, fontWeight: 600 }],
          },
    },
  ];
}

/* ---- CP-3 · relative-value percentile scorecard ---- */
function cp3Charts(rt: Rt): LiveChartDef[] {
  const noteBits = [
    isNum(rt.composite_percentile) ? `Composite ${ordinal(rt.composite_percentile)} pct` : null,
    typeof rt.recommendation === "string" ? rt.recommendation : null,
    typeof rt.rv_basis === "string" ? `basis: ${humanize(rt.rv_basis)}` : null,
  ].filter(Boolean);
  return percentileBar(Array.isArray(rt.scorecard) ? (rt.scorecard as Rt[]) : [], {
    title: "CP-3 · Peer percentile by metric",
    sourceIds: [`CP-3 · scored vs ${typeof rt.peer_scope === "string" ? rt.peer_scope : "peers"}`],
    note: noteBits.join(" · ") || undefined,
  });
}

/* ---- CP-1C · peer benchmark standing ---- */
function cp1cCharts(rt: Rt): LiveChartDef[] {
  const rows = Array.isArray(rt.comparisons) ? (rt.comparisons as Rt[]) : [];
  const outliers = Array.isArray(rt.outlier_metrics)
    ? (rt.outlier_metrics as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const noteBits = [
    isNum(rt.peer_count) ? `${rt.peer_count} peer${rt.peer_count === 1 ? "" : "s"}` : null,
    outliers.length ? `Bottom-quartile: ${outliers.join(", ")}` : null,
  ].filter(Boolean);
  return percentileBar(rows, {
    title: "CP-1C · Peer standing by metric",
    sourceIds: [`CP-1C · ${typeof rt.peer_scope === "string" ? rt.peer_scope : "peer benchmark"}`],
    note: noteBits.join(" · ") || undefined,
  });
}

/* ---- CP-1B · earnings delta by period ---- */
function cp1bCharts(rt: Rt): LiveChartDef[] {
  const rows = (Array.isArray(rt.periods) ? (rt.periods as Rt[]) : []).filter((p) => typeof p.period === "string");
  const sum = (rt.summary ?? {}) as Rt;
  const pct = (v: number) => `${v > 0 ? "+" : ""}${fmt(v)}`;
  const out: LiveChartDef[] = [];

  const series = [
    { s: "Revenue", key: "revenue" },
    { s: "Adj. EBITDA", key: "adj_ebitda" },
  ]
    .map((x) => ({ s: x.s, pts: rows.filter((p) => isNum(p[x.key])).map((p) => ({ p: humanize(p.period as string), v: p[x.key] as number })) }))
    .filter((x) => x.pts.length >= 2);
  if (series.length) {
    const growth = [
      isNum(sum.revenue_growth_pct) ? `Rev ${pct(sum.revenue_growth_pct)}% YoY` : null,
      isNum(sum.ebitda_growth_pct) ? `EBITDA ${pct(sum.ebitda_growth_pct)}% YoY` : null,
    ].filter(Boolean);
    out.push({
      kind: "bar",
      title: "CP-1B · Revenue vs Adj. EBITDA by period",
      sourceIds: ["CP-1B · derived from CP-1 period series"],
      accessibleSummary: series.map((x) => spanText(x.s, x.pts.map(({ p, v }) => ({ fy: p, v })))).join("; ") + ".",
      columns: [
        { key: "p", label: "Period" },
        { key: "s", label: "Measure" },
        { key: "v", label: "Value" },
      ],
      h: 168,
      note: growth.join(" · ") || undefined,
      spec: {
        type: "interval",
        data: series.flatMap((x) => x.pts.map((point) => ({ p: point.p, s: x.s, v: point.v }))),
        encode: { x: "p", y: "v", color: "s" },
        transform: [{ type: "dodgeX" }],
        // fallow-ignore-next-line code-duplication -- grouped-bar tail repeats across builders by design: literal in-place specs beat shared fragments (see rewrite-tournament verdict)
        scale: { color: { domain: series.map((x) => x.s), range: [CHART_HEX.accent, CHART_HEX.teal] } },
        axis: AXIS,
        legend: { color: { position: "top" } },
        labels: [{ text: "v", position: "top", fontSize: 10.5, fontWeight: 600, transform: [{ type: "overlapHide" }] }],
      },
    });
  }

  const margins = rows.filter((p) => isNum(p.ebitda_margin)).map((p) => ({ p: humanize(p.period as string), v: p.ebitda_margin as number }));
  if (margins.length >= 2) {
    const first = margins[0];
    const last = margins[margins.length - 1];
    out.push({
      kind: "line",
      title: "CP-1B · Adj. EBITDA margin by period",
      unit: "%",
      sourceIds: ["CP-1B · derived from CP-1 period series"],
      accessibleSummary: `Adjusted EBITDA margin moves from ${fmt(first.v)}% in ${first.p} to ${fmt(last.v)}% in ${last.p}.`,
      columns: [
        { key: "p", label: "Period" },
        { key: "v", label: "Margin (%)" },
      ],
      h: 168,
      note: isNum(sum.margin_change_pp) ? `Margin ${pct(sum.margin_change_pp)}pp YoY` : undefined,
      spec: {
        type: "view",
        data: margins,
        children: [
          { type: "line", encode: { x: "p", y: "v" }, style: { stroke: CHART_HEX.teal, lineWidth: 2 } },
          {
            type: "point",
            encode: { x: "p", y: "v" },
            style: { fill: CHART_HEX.teal },
            labels: [{ text: (d: { v: number }) => `${fmt(d.v)}%`, fontSize: 10.5, fontWeight: 600, transform: [{ type: "overlapDodgeY" }] }],
          },
        ],
        axis: AXIS,
      },
    });
  }

  return out;
}

/* ---- CP-2B · downside shock vs breach threshold ---- */
// Deliberately a standalone readout, not grid columns: the CP-2B payload is a
// leverage-shock curve, and past attempts to splice it into DOWN scenario grids
// mixed incompatible shapes.
function cp2bCharts(rt: Rt): LiveChartDef[] {
  const base = isNum(rt.current_net_leverage) ? [{ shock: "0%", v: rt.current_net_leverage }] : [];
  const shocked = (Array.isArray(rt.scenarios) ? (rt.scenarios as Rt[]) : [])
    .filter((sc) => isNum(sc.ebitda_shock_pct) && isNum(sc.stressed_net_leverage))
    .map((sc) => ({ shock: `-${sc.ebitda_shock_pct}%`, v: sc.stressed_net_leverage as number }));
  const pts = [...base, ...shocked].map((p) => ({ ...p, s: "Stressed net leverage" }));
  if (pts.length < 2) return [];
  const threshold = isNum(rt.breach_threshold_x) ? rt.breach_threshold_x : null;
  const data =
    threshold === null ? pts : [...pts, ...pts.map((p) => ({ shock: p.shock, s: `Breach threshold ${fmt(threshold)}x`, v: threshold }))];
  const note =
    (isNum(rt.shock_to_breach_pct) ? `Shock to breach: -${rt.shock_to_breach_pct}%` : "No breach within the modeled shocks") +
    (typeof rt.fragility === "string" ? ` · Fragility ${rt.fragility}` : "");
  const last = pts[pts.length - 1];
  return [
    {
      kind: "line",
      title: "CP-2B · Net leverage under EBITDA shock",
      unit: "x",
      sourceIds: ["CP-2B · persisted run"],
      accessibleSummary:
        `Stressed net leverage moves from ${fmt(pts[0].v)}x at no shock to ${fmt(last.v)}x at ${last.shock} EBITDA` +
        (threshold !== null ? `, against a ${fmt(threshold)}x breach threshold.` : "."),
      columns: [col("shock", "EBITDA shock"), col("s", "Series"), col("v", "Net leverage (x)")],
      h: 168,
      note,
      spec: {
        type: "line",
        data,
        encode: { x: "shock", y: "v", color: "s" },
        scale: {
          color: {
            domain: [...new Set(data.map((d) => d.s))],
            range: [CHART_HEX.warning, CHART_HEX.critical],
          },
        },
        style: { lineWidth: 2 },
        axis: AXIS,
        legend: { color: { position: "top" } },
      },
    },
  ];
}

/* ---- CP-2F · interest coverage under rate shock ---- */
// Same shape discipline as CP-2B: base point + payload scenarios only, no
// fabricated distress threshold (the payload carries none).
// fallow-ignore-next-line complexity -- one guard per optional payload field; the branching IS the payload contract
function cp2fCharts(rt: Rt): LiveChartDef[] {
  const scenarios = Array.isArray(rt.scenarios) ? (rt.scenarios as Rt[]) : [];
  const pts: { shock: string; v: number; addl: string }[] = [];
  if (isNum(rt.base_interest_coverage)) pts.push({ shock: "0bp", v: rt.base_interest_coverage, addl: "—" });
  for (const sc of scenarios) {
    if (isNum(sc.rate_shock_bps) && isNum(sc.stressed_interest_coverage)) {
      pts.push({
        shock: `+${fmt(sc.rate_shock_bps)}bp`,
        v: sc.stressed_interest_coverage,
        addl: isNum(sc.incremental_interest_musd) ? `$${fmt(sc.incremental_interest_musd)}M` : "—",
      });
    }
  }
  if (pts.length < 2) return [];
  const worst = pts[pts.length - 1];
  const unhedged = rt.rate_hedge_disclosed === false;
  return [
    {
      kind: "line",
      title: "CP-2F · Interest coverage under rate shock",
      unit: "x",
      sourceIds: ["CP-2F · persisted run"],
      accessibleSummary:
        `Interest coverage moves from ${fmt(pts[0].v)}x at the base rate to ${fmt(worst.v)}x at ${worst.shock}` +
        (worst.addl === "—" ? "." : `, adding ${worst.addl} of annual interest.`),
      columns: [
        { key: "shock", label: "Rate shock" },
        { key: "v", label: "Coverage (x)" },
        { key: "addl", label: "Incremental interest" },
      ],
      h: 168,
      note:
        [
          worst.addl === "—" ? null : `${worst.addl} added interest at ${worst.shock}`,
          unhedged ? "assumes 100% floating, no hedges disclosed" : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      spec: {
        type: "view",
        data: pts,
        children: [
          { type: "line", encode: { x: "shock", y: "v" }, style: { stroke: CHART_HEX.warning, lineWidth: 2 } },
          {
            type: "point",
            encode: { x: "shock", y: "v" },
            style: { fill: CHART_HEX.warning },
            labels: [{ text: (d: { v: number }) => `${fmt(d.v)}x`, fontSize: 10.5, fontWeight: 600, transform: [{ type: "overlapDodgeY" }] }],
          },
        ],
        axis: AXIS,
      },
    },
  ];
}

/* ---- CP-5 / CP-5C · findings by severity (shared) ---- */
// Severity hues mirror the app's status ramp; meaning is never color-only —
// the severity name is the axis label and the count sits on each bar. All-zero
// payloads render nothing: "no findings" is the KPI row's story, not a chart.
const SEVERITY_HEX: Record<string, string> = {
  CRITICAL: CHART_HEX.critical,
  MATERIAL: CHART_HEX.warning,
  MINOR: CHART_HEX.muted,
};

function severityCharts(id: "CP-5" | "CP-5C") {
  // fallow-ignore-next-line complexity -- per-severity guards + per-module note bits; splitting fragments one spec
  return (rt: Rt): LiveChartDef[] => {
    const by = rt.findings_by_severity;
    if (!by || typeof by !== "object" || Array.isArray(by)) return [];
    const known = Object.keys(SEVERITY_HEX);
    const data = Object.entries(by as Rt)
      .filter((e): e is [string, number] => isNum(e[1]))
      .sort((a, b) => {
        const ia = known.indexOf(a[0]);
        const ib = known.indexOf(b[0]);
        return (ia === -1 ? known.length : ia) - (ib === -1 ? known.length : ib);
      })
      .map(([sev, n]) => ({ sev, n }));
    if (!data.some((d) => d.n > 0)) return [];
    const noteBits =
      id === "CP-5"
        ? [
            typeof rt.clearance === "string" ? `Clearance: ${rt.clearance}` : null,
            isNum(rt.modules_audited) ? `${fmt(rt.modules_audited)} modules audited` : null,
          ]
        : [isNum(rt.modules_reviewed) ? `${fmt(rt.modules_reviewed)} modules reviewed` : null];
    return [
      {
        kind: "bar",
        title: `${id} · Findings by severity`,
        sourceIds: [`${id} · persisted run`],
        accessibleSummary: data.map((d) => `${d.n} ${d.sev.toLowerCase()}`).join(", ") + " findings.",
        columns: [
          { key: "sev", label: "Severity" },
          { key: "n", label: "Findings" },
        ],
        h: 168,
        note: noteBits.filter(Boolean).join(" · ") || undefined,
        spec: {
          type: "interval",
          data,
          encode: { x: "sev", y: "n", color: "sev" },
          scale: {
            color: {
              domain: data.map((d) => d.sev),
              range: data.map((d) => SEVERITY_HEX[d.sev] ?? CHART_HEX.slate),
            },
          },
          legend: false,
          axis: AXIS,
          labels: [{ text: "n", position: "top", fontSize: 10.5, fontWeight: 600 }],
        },
      },
    ];
  };
}

/* ---- CP-3B · recovery by tranche ---- */
// Renders only when the register carries actual recovery figures (a keyword-
// scan vault without amounts degrades to no chart; the tranche register table
// still lists what was found).
function cp3bCharts(rt: Rt): LiveChartDef[] {
  const tranches = Array.isArray(rt.tranches) ? (rt.tranches as Rt[]) : [];
  const rows = tranches
    .filter((t) => isNum(t.recovery_pct))
    .sort((a, b) => (isNum(a.seniority_rank) ? a.seniority_rank : 99) - (isNum(b.seniority_rank) ? b.seniority_rank : 99))
    .map((t) => ({
      tranche: typeof t.tranche === "string" ? t.tranche : String(t.code ?? "tranche"),
      v: t.recovery_pct as number,
      recovery: isNum(t.recovery_musd) ? `$${fmt(t.recovery_musd)}M` : "—",
      amount: isNum(t.amount_musd) ? `$${fmt(t.amount_musd)}M` : "—",
    }));
  if (!rows.length) return [];
  const ev = isNum(rt.distressed_ev_musd) ? `vs $${fmt(rt.distressed_ev_musd)}M distressed EV` : null;
  return [
    {
      kind: "bar",
      title: "CP-3B · Recovery by tranche",
      unit: "%",
      sourceIds: ["CP-3B · persisted waterfall"],
      accessibleSummary:
        rows.map((r) => `${r.tranche} recovers ${fmt(r.v)}%${r.recovery === "—" ? "" : ` (${r.recovery})`}`).join("; ") +
        (ev ? `, ${ev}.` : "."),
      columns: [
        { key: "tranche", label: "Tranche" },
        { key: "v", label: "Recovery (%)" },
        { key: "recovery", label: "Recovery $M" },
        { key: "amount", label: "Claim $M" },
      ],
      h: 168,
      note: [ev, typeof rt.waterfall_basis === "string" ? rt.waterfall_basis : null].filter(Boolean).join(" · ") || undefined,
      spec: {
        type: "interval",
        data: rows,
        encode: { x: "tranche", y: "v" },
        coordinate: { transform: [{ type: "transpose" }] },
        scale: { y: { domain: [0, 100] } },
        style: { fill: CHART_HEX.accent },
        axis: AXIS,
        labels: [{ text: (d: { v: number }) => `${fmt(d.v)}%`, position: "outside", fontSize: 10.5, fontWeight: 600, transform: [{ type: "exceedAdjust" }] }],
      },
    },
  ];
}

const BUILDERS: Record<string, (rt: Rt) => LiveChartDef[]> = {
  "CP-1": cp1Charts,
  "CP-1B": cp1bCharts,
  "CP-1C": cp1cCharts,
  "CP-3": cp3Charts,
  "CP-2B": cp2bCharts,
  "CP-2F": cp2fCharts,
  "CP-3B": cp3bCharts,
  "CP-5": severityCharts("CP-5"),
  "CP-5C": severityCharts("CP-5C"),
};

/** Pure builder — exported for tests. Unknown module or thin payload -> []. */
export function buildLiveCharts(id: string, runtime: unknown): LiveChartDef[] {
  const builder = BUILDERS[id];
  if (!builder || !runtime || typeof runtime !== "object") return [];
  try {
    return builder(runtime as Rt);
  } catch {
    return []; // a malformed payload degrades to "no chart", never a crashed pane
  }
}

export function LiveModuleCharts({ id, runtime }: { id: string; runtime?: Record<string, unknown> }) {
  const defs = useMemo(() => buildLiveCharts(id, runtime), [id, runtime]);
  if (!defs.length) return null;
  return <ModuleChartGrid defs={defs} status={LIVE_STATUS} />;
}
