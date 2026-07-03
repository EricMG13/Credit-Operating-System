"use client";

// Issuer Profile — the per-name landing view. Click an issuer ticker/name and
// land here: identity + current house view + headline metrics + what-changed +
// thesis/risk + structure + coverage, one read, before drilling into Deep-Dive.
// Backed by GET /api/issuers/{id}/profile (a read-model; no synthesis). Every
// section degrades to an explicit empty state rather than fabricating — a name
// with no completed run shows "no run yet", not demo numbers.

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getIssuerProfile, queryGraph, type BusinessFact, type EarningsSummary, type IssuerProfile, type ProfileRun } from "@/lib/api";
import type { GraphResult } from "@/lib/query/graph";
import { CloseButton } from "@/components/shared/CloseButton";

const EMPTY_EARNINGS: EarningsSummary = {
  latest_period: null, prior_period: null, revenue_growth_pct: null,
  ebitda_growth_pct: null, margin_change_pp: null, monitoring_signals: [],
};
import { RequireAuth } from "@/components/shared/RequireAuth";
import { Panel } from "@/components/shared/Panel";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { Tag, ToggleGroup } from "@/components/pipeline/atoms";
import { sevSurface } from "@/lib/pipeline/sev";
import { G2Chart } from "@/components/charts/G2Chart";
import { buildCharts, buildHeadline, buildSeries, filterSeriesByGranularity, latestPointDelta } from "@/lib/issuer-profile-charts";
import { issuerSector } from "@/lib/issuers";

// FY ↔ quarter granularity options for the trend toggle (as-const so the union
// "FY" | "Q" flows into ToggleGroup's generic and back to setGran).
const GRAN_OPTS = [{ k: "FY" as const, l: "Full year" }, { k: "Q" as const, l: "Quarters" }];

// Issuer-scoped jumps into the other concepts, rendered in the bottom bar.
const ISSUER_ACTIONS = [
  { href: "/pipeline?issuer=", label: "Run analysis" },
  { href: "/model?issuer=", label: "Model Builder" },
  { href: "/reports?issuer=", label: "Report Studio" },
  { href: "/upload?issuer=", label: "Upload docs" },
];

export default function IssuerProfilePage() {
  return (
    <RequireAuth>
      <Suspense fallback={<Splash msg="Loading profile…" />}>
        <IssuerProfileView />
      </Suspense>
    </RequireAuth>
  );
}

// ─── status → severity token (drives Tag/glyph color) ───────────────────────
const COMMITTEE_SEV: Record<string, string> = {
  "Committee Ready": "pass", Restricted: "warning", Blocked: "critical",
  "Draft Only": "low", "Insufficient Information": "low",
};
const RUN_SEV: Record<string, string> = {
  complete: "pass", running: "running", queued: "queued", failed: "critical",
};
// Categorical bands shared by fragility / LME / recommendation.
const BAND_SEV: Record<string, string> = {
  HIGH: "critical", MODERATE: "warning", MEDIUM: "warning", LOW: "pass",
  OVERWEIGHT: "pass", NEUTRAL: "low", UNDERWEIGHT: "critical",
};
const bandSev = (v: unknown) => BAND_SEV[String(v).toUpperCase()] ?? "low";

// ─── value formatting (tabular, aligned) ────────────────────────────────────
// fallow-ignore-next-line complexity
function fmt(value: number, unit: string): string {
  if (unit === "x") return value.toFixed(1) + "×";
  if (unit === "%") return value.toFixed(1) + "%";
  if (unit === "$M")
    return Math.abs(value) >= 1000 ? "$" + (value / 1000).toFixed(1) + "bn" : "$" + value.toFixed(0) + "m";
  return value.toFixed(1);
}
const signed = (v: number, suffix = "", digits = 1) => {
  const rounded = Number(v.toFixed(digits));
  return (rounded >= 0 ? "+" : "") + rounded.toFixed(digits) + suffix;
};

const METRIC_LABEL: Record<string, string> = {
  net_leverage: "Net leverage",
  interest_coverage: "Interest coverage",
  ebitda_margin: "EBITDA margin", revenue: "Revenue", adj_ebitda: "Adj. EBITDA",
  fcf: "Free cash flow", fcf_conversion: "FCF margin",
  altman_z: "Altman Z″",
};
// Snapshot tiles that carry a period-over-period delta (from CP-1B), shown inline
// under the value. Keyed by metric → the signal field + its unit.
const TILE_DELTA: Record<string, { key?: string; suffix: string; digits?: number; higherIsBetter: boolean; showMissing?: boolean }> = {
  revenue: { key: "revenue_growth_pct", suffix: "%", higherIsBetter: true },
  adj_ebitda: { key: "ebitda_growth_pct", suffix: "%", higherIsBetter: true },
  ebitda_margin: { key: "margin_change_pp", suffix: "pp", higherIsBetter: true },
  net_leverage: { suffix: "×", digits: 2, higherIsBetter: false, showMissing: true },
  interest_coverage: { suffix: "×", higherIsBetter: true, showMissing: true },
  fcf: { suffix: "m", digits: 0, higherIsBetter: true, showMissing: true },
  fcf_conversion: { suffix: "pp", higherIsBetter: true, showMissing: true },
};

const STATUS_TOOLTIP: Record<string, string> = {
  "Committee Ready": "Analysis meets all standards and is ready for Investment Committee presentation",
  "Restricted": "Trading or analyst coverage is restricted due to regulatory or internal compliance guidelines",
  "Blocked": "Blocked from committee presentation due to compliance or severe data quality issues",
  "Draft Only": "Work in progress draft analysis; not verified",
  "Insufficient Information": "Missing critical document inputs to complete analysis",
  "Passed": "QA check completed with zero critical findings",
  "Not Reviewed": "QA analysis has not yet been performed",
  "Overweight": "Recommended high conviction buy-side exposure relative to benchmark index",
  "Neutral": "Hold existing exposure; no near-term change in credit stance",
  "Underweight": "Recommended reduced or zero credit exposure due to risk concerns",
};

const METRIC_TOOLTIP: Record<string, string> = {
  net_leverage: "Net Debt / Adjusted EBITDA. Measure of net leverage after cash offsets.",
  interest_coverage: "Adjusted EBITDA / Interest Expense. Coverage capacity for cash interest.",
  ebitda_margin: "Adjusted EBITDA / Revenue. Measure of operating margin profitability.",
  revenue: "Total segment revenue.",
  adj_ebitda: "Adjusted EBITDA. Operating cash flow before interest, tax, D&A, and adjusted items.",
  fcf: "Free Cash Flow. Operating cash flow minus capital expenditures.",
  fcf_conversion: "FCF / Revenue. Free cash flow as a percent of revenue (the engine's basis — not FCF/EBITDA cash conversion).",
  altman_z: "Altman Z''-Score. Formulaic assessment of credit strength and solvency (lower is weaker).",
};

// Provenance → how trustworthy. demo_fixture is fabricated and flagged loud.
const PROV: Record<string, { sev: string; label: string }> = {
  run: { sev: "pass", label: "live run" },
  derived: { sev: "low", label: "derived" },
  seed: { sev: "low", label: "demo seed" },
  fixture: { sev: "info", label: "reference demo" },
  demo_fixture: { sev: "critical", label: "fabricated" },
};
// Visible per-tile provenance shorthand — shown only when tiles MIX live and
// non-live sources (uniform provenance is covered once by the panel tag), except
// "fabricated" which is always marked. A text label, not a hover-only dot: the
// old glyph read as "refreshing/live" and meaning lived in the tooltip.
const PROV_SHORT: Record<string, string> = {
  derived: "drv", seed: "seed", fixture: "demo", demo_fixture: "FAB",
};

// Colorize-as-signal: tint a metric value ONLY when it breaches a credit
// threshold — never decoration. Directionality differs (leverage worse high;
// coverage / Altman worse low). null = neutral (ink, not colored).
// fallow-ignore-next-line complexity
function metricSev(key: string, v: number): string | null {
  if (key === "net_leverage") return v >= 6 ? "critical" : v >= 4.5 ? "warning" : null;
  if (key === "interest_coverage") return v < 1.5 ? "critical" : v < 2.5 ? "warning" : null;
  if (key === "altman_z") return v < 1.1 ? "critical" : v < 2.6 ? "warning" : null;
  return null;
}

// Plain-text threshold note for a breached metric — carried on the breach marker
// so the amber/red value tint is never the sole signal (house "never color-alone").
const BREACH_NOTE: Record<string, string> = {
  net_leverage: "elevated leverage: ≥4.5× warning · ≥6.0× critical",
  interest_coverage: "thin coverage: <2.5× warning · <1.5× critical",
  altman_z: "distress zone: <2.6 warning · <1.1 critical",
};

// The least-trustworthy provenance among the shown metrics, surfaced ONCE as a
// panel-level legend (distill) instead of repeating the word on every tile.
function worstProvenance(ms: { provenance: string }[]): string | null {
  for (const p of ["demo_fixture", "fixture", "seed", "derived"])
    if (ms.some((m) => m.provenance === p)) return p;
  return null;
}

// Trim the trailing grid hairlines so the last row/column doesn't hang borders
// into empty cells (e.g. 7 tiles in a 3-col grid leave a 2-cell hole).
function tileEdge(i: number, n: number): string {
  return [
    (i + 1) % 2 === 0 ? "max-md:border-r-0" : "",
    (i + 1) % 3 === 0 ? "md:border-r-0" : "",
    i === n - 1 ? "border-r-0" : "", // orphan tile: no hairline into the empty cell
    i >= n - (n % 2 || 2) ? "max-md:border-b-0" : "",
    i >= n - (n % 3 || 3) ? "md:border-b-0" : "",
  ].filter(Boolean).join(" ");
}

function Splash({ msg }: { msg: string }) {
  return (
    <div className="h-screen flex items-center justify-center bg-caos-bg">
      <span className="tabular text-caos-lg text-caos-muted">{msg}</span>
    </div>
  );
}

// fallow-ignore-next-line complexity
function IssuerProfileView() {
  const id = useSearchParams().get("id");
  const [data, setData] = useState<IssuerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setError("No issuer id."); setLoading(false); return; }
    let stale = false;
    setLoading(true);
    getIssuerProfile(id)
      .then((d) => { if (!stale) { setData(d); setError(null); } })
      // fallow-ignore-next-line complexity
      .catch((e) => {
        if (stale) return;
        const detail = (e as { response?: { status?: number; data?: { detail?: string } } })?.response;
        setError(detail?.status === 404 ? "Issuer not found." : (detail?.data?.detail || "Couldn’t load this profile."));
      })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [id]);

  if (loading) return <Splash msg="Loading profile…" />;
  if (error || !data) return <ErrorView id={id} msg={error || "No data."} />;

  return <Profile id={id!} data={data} />;
}

function ErrorView({ id, msg }: { id: string | null; msg: string }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-3 bg-caos-bg text-center">
      <span style={{ color: "var(--caos-warning)" }}><StatusGlyph kind="warning" size={20} /></span>
      <p className="text-caos-2xl text-caos-text font-medium">{msg}</p>
      <div className="flex gap-2">
        <Link href="/issuers" className="no-underline tabular text-caos-md px-3 py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring">
          ← BACK TO DIRECTORY
        </Link>
        {id ? (
          <Link href={"/deepdive?issuer=" + encodeURIComponent(id)} className="no-underline tabular text-caos-md px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring">
            OPEN DEEP-DIVE
          </Link>
        ) : null}
      </div>
    </div>
  );
}

// fallow-ignore-next-line complexity
export function Profile({
  id,
  data,
  isOverlay = false,
  onClose,
}: {
  id: string;
  data: IssuerProfile;
  isOverlay?: boolean;
  onClose?: () => void;
}) {
  const { issuer, latest_run, runs, metrics, signals, coverage, findings, business, sponsor, strengths, weaknesses } = data;
  const earnings = data.earnings ?? EMPTY_EARNINGS;  // trust boundary — old/odd payloads may omit it
  const deepHref = "/deepdive?issuer=" + encodeURIComponent(id);
  // A Blocked run must not flash a committee-green stance: the recommendation
  // chip is rendered gated (idle sev + explicit label) so a screenshot can never
  // show the overweight without the block.
  const recGated = latest_run?.committee_status === "Blocked";

  const ratings = [
    { ag: "S&P", v: issuer.rating_sp }, { ag: "Moody’s", v: issuer.rating_moody }, { ag: "Fitch", v: issuer.rating_fitch },
  ].filter((r) => r.v);
  const factsByCode = (codes: string[]) => business.filter((f) => codes.includes(f.code));
  const sponsorLedger = Array.isArray((sponsor as { ledger?: unknown }).ledger)
    ? ((sponsor as { ledger: { flag: string; chunk_id?: string }[] }).ledger) : [];

  const [gran, setGran] = useState<"FY" | "Q">("FY");

  // Snapshot + trend series come straight from the engine's metric facts. We do
  // NOT synthesize senior/total leverage from net leverage — a fabricated figure
  // would inherit net_leverage's "live run" provenance and ▸ src link, i.e. a
  // made-up number that reads as sourced. Only keys the engine actually emits
  // render; missing ones degrade to an empty state.
  const series = useMemo(() => buildSeries(metrics), [metrics]);
  const headline = useMemo(() => buildHeadline(metrics), [metrics]);

  // Build both granularities so the toggle shows only when there's something to
  // switch to, and each side draws only its own periods (annual vs quarterly).
  const fyCharts = useMemo(() => buildCharts(filterSeriesByGranularity(series, "FY")), [series]);
  const qCharts = useMemo(() => buildCharts(filterSeriesByGranularity(series, "Q")), [series]);
  // Fall through to whichever granularity has data — the toggle only renders
  // when both do, so a one-sided dataset can't strand the user on an empty tab.
  const charts = fyCharts.length === 0 ? qCharts : qCharts.length === 0 ? fyCharts : gran === "FY" ? fyCharts : qCharts;
  const snapshotProv = useMemo(() => worstProvenance(headline), [headline]);
  const provMixed = useMemo(
    () => headline.some((m) => m.provenance === "run") && headline.some((m) => m.provenance !== "run"),
    [headline]
  );
  // "no prior" is only meaningful when SOME tile actually has a prior-period delta
  // to contrast against; on a fresh single-period snapshot (no tile has a prior)
  // the annotation wrongly implied the unlabeled tiles did have deltas.
  const anyPriorDelta = useMemo(
    () => headline.some((m) => {
      const dd = TILE_DELTA[m.metric_key];
      if (!dd) return false;
      const sd = dd.key ? signals[dd.key] : latestPointDelta(series[m.metric_key]);
      return typeof sd === "number";
    }),
    [headline, signals, series]
  );

  // Per-issuer tab identity — 40 open profiles are otherwise all "CAOS". Skipped
  // in overlay mode (the host page owns the title). Restored on unmount.
  useEffect(() => {
    if (isOverlay) return;
    const prev = document.title;
    const who = issuer.ticker?.toUpperCase() || issuer.name || "Issuer";
    document.title = `${who} · Issuer Profile · CAOS`;
    return () => { document.title = prev; };
  }, [isOverlay, issuer.ticker, issuer.name]);

  const totalFindings = (findings.CRITICAL || 0) + (findings.MATERIAL || 0) + (findings.MINOR || 0);

  const body = (
      // Multi-window desk: 3 tracks only at full width (≥1280); an intermediate
      // 2-track tier (≥1024) keeps a half-monitor from collapsing to one 1100px
      // column (col 3 wraps under col 1). Single column only when truly narrow.
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2 items-start">
        {/* Column 1: Financials & Trends */}
        <div className="flex flex-col gap-2">
          <Panel
            title={"Credit snapshot" + (latest_run?.as_of_date ? " · as of " + latest_run.as_of_date : "")}
            right={snapshotProv ? <Tag sev={PROV[snapshotProv].sev}>{PROV[snapshotProv].label}</Tag> : null}
          >
            {headline.length === 0 ? (
              <div className="px-3 py-2.5"><Empty>No headline metrics yet — run an analysis to populate the snapshot.</Empty></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3">
                {headline.map((m, ti) => {
                  const isLive = m.provenance === "run";
                  // Breach tint fires only for a live run — a seed/derived value must
                  // not paint the page's loudest colour on a number the system won't
                  // stand behind. Non-live values also render muted (below).
                  const sev = isLive ? metricSev(m.metric_key, m.value) : null;
                  const d = TILE_DELTA[m.metric_key];
                  const signalDelta = d?.key ? signals[d.key] : null;
                  const seriesDelta = d && !d.key ? latestPointDelta(series[m.metric_key]) : null;
                  const dv = typeof signalDelta === "number" ? signalDelta : seriesDelta;
                  const delta = typeof dv === "number" ? dv : null;
                  const deltaSev = d && delta != null
                    ? (delta >= 0) === d.higherIsBetter ? "pass" : "high"
                    : null;
                  return (
                    <div key={m.metric_key} className={"px-3 py-2 border-b border-r border-caos-border/40 " + tileEdge(ti, headline.length)} title={METRIC_TOOLTIP[m.metric_key] || ""}>
                      <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{METRIC_LABEL[m.metric_key] || m.metric_key}</div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span
                          className="tabular font-medium leading-none inline-flex items-center gap-1"
                          style={{ fontSize: 16, color: sev ? sevSurface(sev).color : isLive ? "var(--caos-text)" : "var(--caos-muted)" }}
                        >
                          {sev ? (
                            // role="img" so the threshold note is an accessible name AT
                            // announces (aria-label on a bare generic span is dropped) —
                            // the breach severity must not be color-alone for SR users.
                            <span role="img" style={{ color: sevSurface(sev).color }} title={BREACH_NOTE[m.metric_key] || "breaches a credit threshold"} aria-label={`${sev === "critical" ? "Critical" : "Warning"} — ${BREACH_NOTE[m.metric_key] || "breaches a credit threshold"}`}>
                              <StatusGlyph kind="warning" size={11} />
                            </span>
                          ) : null}
                          {fmt(m.value, m.unit)}
                        </span>
                        {d && delta != null && deltaSev ? <span className="tabular text-caos-xs font-medium" style={{ color: sevSurface(deltaSev).color }}>{signed(delta, d.suffix, d.digits)}</span> : null}
                        {d?.showMissing && delta == null && anyPriorDelta ? <span className="tabular text-caos-2xs text-caos-muted">no prior</span> : null}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="tabular text-caos-2xs text-caos-muted truncate">{m.period}</span>
                        {m.provenance !== "run" && (provMixed || m.provenance === "demo_fixture") ? (
                          <span
                            className="tabular text-caos-2xs uppercase"
                            style={{ color: sevSurface(PROV[m.provenance]?.sev || "low").color }}
                            title={PROV[m.provenance]?.label}
                          >
                            {PROV_SHORT[m.provenance] || "n/l"}
                          </span>
                        ) : null}
                        <div className="flex-1" />
                        {m.document_chunk_id ? (
                          <Link href={deepHref + "&mod=CP-1"} className="no-underline tabular text-caos-2xs text-caos-muted hover:text-caos-accent transition-caos rounded focus-ring" title="See source in Deep-Dive" aria-label={`See ${METRIC_LABEL[m.metric_key] || m.metric_key} source in Deep-Dive`}>▸ src</Link>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* What changed leads the column (PM scan order: delta → trajectory),
              so the earnings movement sits directly under the snapshot. */}
          <Panel title={"Latest earnings" + (earnings.latest_period ? " · " + earnings.latest_period : "")}>
            {(() => {
              const ms = earnings.monitoring_signals || [];
              const hasDelta = [earnings.revenue_growth_pct, earnings.ebitda_growth_pct, earnings.margin_change_pp].some((v) => typeof v === "number");
              if (!hasDelta && !ms.length)
                return <div className="px-3 py-2.5"><Empty>No earnings delta yet.</Empty></div>;
              return (
                <div className="px-3 py-2 flex flex-col gap-2">
                  {earnings.prior_period && earnings.latest_period ? (
                    <div className="tabular text-caos-2xs text-caos-muted">{earnings.prior_period} → {earnings.latest_period} · YoY</div>
                  ) : null}
                  <DeltaRow label="Revenue" v={earnings.revenue_growth_pct} suffix="%" />
                  <DeltaRow label="Adj. EBITDA" v={earnings.ebitda_growth_pct} suffix="%" />
                  <DeltaRow label="EBITDA margin" v={earnings.margin_change_pp} suffix="pp" />
                  {ms.length ? (
                    <div className="flex flex-col gap-1 pt-1 border-t border-caos-border/40">
                      <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Watch</span>
                      {ms.slice(0, 2).map((s, i) => (
                        <span key={i} className="flex items-start gap-1.5 tabular text-caos-2xs" style={{ color: sevSurface("warning").color }}>
                          <span className="mt-0.5 shrink-0"><StatusGlyph kind="warning" size={9} /></span>{s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="tabular text-caos-2xs pt-1" style={{ color: sevSurface("pass").color }}>No deterioration signals.</span>
                  )}
                </div>
              );
            })()}
          </Panel>

          <Panel
            title="Financial & credit trend"
            right={fyCharts.length && qCharts.length
              ? <ToggleGroup options={GRAN_OPTS} value={gran} onChange={setGran} size="sm" />
              : null}
          >
            {charts.length === 0 ? (
              <div className="px-3 py-2.5">
                <Empty>Time series needs ≥2 periods to populate trends.</Empty>
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-1">
                {charts.slice(0, 2).map((c) => (
                  <div key={c.title} className="rounded border border-caos-border bg-caos-bg">
                    <div className="px-3 py-1 border-b border-caos-border">
                      <span className="tabular text-caos-xs uppercase tracking-wider text-caos-muted">{c.title}</span>
                    </div>
                    <div className="px-2 pt-1 pb-1"><G2Chart spec={c.spec} height={130} /></div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Column 2: Business & Narrative */}
        <div className="flex flex-col gap-2">
          <Panel title="Business profile">
            {business.length === 0 && sponsorLedger.length === 0 ? (
              <div className="px-3 py-2.5"><Empty>No business disclosure ingested.</Empty></div>
            ) : (
              <div className="flex flex-col divide-y divide-caos-border/40">
                <BizCol title="Description" facts={factsByCode(["transaction", "history", "geography"]).slice(0, 2)} deepHref={deepHref} />
                <BizCol title="Operating model" facts={factsByCode(["operating_model"]).slice(0, 1)} deepHref={deepHref} />
                <OwnershipCol facts={factsByCode(["ownership"]).slice(0, 1)} ledger={sponsorLedger} score={(sponsor as { governance_risk_score?: number }).governance_risk_score} deepHref={deepHref} />
              </div>
            )}
          </Panel>

          <Panel title="Thesis & risk">
            <div className="px-3 py-2 flex flex-col gap-2">
              <SigBand label="Relative value" v={signals.recommendation} gated={recGated} extra={signals.composite_percentile != null ? `${signals.composite_percentile}th pct` : undefined} />
              <SigBand label="Downside fragility" v={signals.fragility}
                extra={signals.shock_to_breach_pct != null ? `breach @ −${signals.shock_to_breach_pct}% EBITDA` : undefined} />
              <SigBand label="Refi / LME risk" v={signals.lme_band}
                extra={signals.lme_score != null ? `score ${signals.lme_score}` : undefined} />
              <EmptyIfBlank ok={[signals.recommendation, signals.fragility, signals.lme_band]} latest={!!latest_run} />
            </div>
          </Panel>

          <AnalystNotesPanel issuerId={id} issuerName={issuer.name} ticker={issuer.ticker} />
        </div>

        {/* Column 3: Audit, Protection & History */}
        <div className="flex flex-col gap-2">
          {strengths.length || weaknesses.length ? (
            <Panel title="Key strengths & weaknesses" right={<span className="tabular text-caos-2xs text-caos-muted">derived</span>}>
              <div className="flex flex-col divide-y divide-caos-border/40">
                <SWCol kind="success" title="Strengths" items={strengths.slice(0, 3)} />
                <SWCol kind="warning" title="Weaknesses" items={weaknesses.slice(0, 3)} />
              </div>
            </Panel>
          ) : null}

          <Panel title="Structure & protection">
            <div className="px-3 py-2 flex flex-col gap-2">
              <SigText label="Covenant headroom" v={signals.covenant_headroom_turns != null ? `${Number(signals.covenant_headroom_turns).toFixed(1)}× to breach` : null} />
              <SigText label="Covenant structure" v={signals.covenant_structure as string | null} />
              <SigText label="Liquidity runway" v={signals.runway_months != null ? `${signals.runway_months} mo` : null} />
              <EmptyIfBlank ok={[signals.covenant_headroom_turns, signals.covenant_structure, signals.runway_months]} latest={!!latest_run} />
            </div>
          </Panel>

          <Panel title="Coverage & trust">
            <div className="px-3 py-2 flex flex-col gap-2">
              <SigText label="Source readiness" v={coverage.readiness_score != null ? `${Math.round(Number(coverage.readiness_score) * 100)}% · ${Number(coverage.documents) || 0} doc${Number(coverage.documents) === 1 ? "" : "s"}` : null} />
              {Array.isArray(coverage.categories_missing) && coverage.categories_missing.length ? (
                <SigText label="Source gaps" v={(coverage.categories_missing as string[]).slice(0, 2).join(", ")} sev="warning" />
              ) : null}
              <SigText label="Open QA findings" v={totalFindings ? `${findings.CRITICAL} crit · ${findings.MATERIAL} mat` : "none"} sev={findings.CRITICAL || findings.MATERIAL ? "warning" : undefined} />
            </div>
          </Panel>

          <Panel title={`Run history · ${runs.length}`}>
            {runs.length === 0 ? (
              <div className="px-3 py-2.5"><Empty>No runs yet.</Empty></div>
            ) : (
              <div className="text-caos-md divide-y divide-caos-border/30">
                {runs.slice(0, 3).map((r) => (
                  <RunRow key={r.id} r={r} href={deepHref + "&run=" + encodeURIComponent(r.id)} />
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
  );

  return (
    <div className={`${isOverlay ? "h-full" : "h-screen"} flex flex-col bg-caos-bg text-caos-text`}>
      {/* consolidated sub-header */}
      <div className="h-12 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-3 px-4">
        {!isOverlay ? (
          <>
            <Link href="/issuers" className="no-underline flex items-center gap-2 group shrink-0 rounded focus-ring" aria-label="Back to issuer register">
              <span className="w-5 h-5 rounded-sm flex items-center justify-center text-caos-md font-bold" style={{ background: "var(--caos-accent)", color: "var(--caos-bg)" }}>C</span>
              <span className="text-caos-2xl font-semibold tracking-wide text-caos-text group-hover:text-white transition-caos whitespace-nowrap">CREDIT OS</span>
            </Link>
            <div className="h-4 w-px bg-caos-border shrink-0" />
          </>
        ) : (
          <span className="text-caos-md text-caos-muted font-mono uppercase tracking-wider whitespace-nowrap shrink-0">
            Issuer Profile
          </span>
        )}
        
        {/* Consolidated Ticker & Metadata in Header */}
        {/* Identity shrinks (name truncates first) before actions ever clip. */}
        <div className="flex items-center gap-2 overflow-hidden mr-2 min-w-0">
          <span className="tabular text-caos-accent font-semibold leading-none tracking-tight shrink-0" style={{ fontSize: 16 }}>{issuer.ticker?.toUpperCase() || "—"}</span>
          {/* The issuer name is the page's content heading (h2 under the route's
              sr-only h1) so assistive tech can jump straight to *whose* profile
              this is — a plain span left the only heading as "Issuers". */}
          <h2 className="text-caos-text font-medium leading-none truncate min-w-[64px] m-0" style={{ fontSize: 14 }} title={issuer.name} aria-label={`${issuer.ticker ? issuer.ticker.toUpperCase() + " " : ""}${issuer.name} — issuer profile`}>{issuer.name}</h2>
          <span className="text-caos-muted truncate text-caos-xs shrink-0 max-w-[110px]" style={{ fontSize: 11 }}>
            {[issuerSector(issuer), issuer.country].filter(Boolean).join(" · ")}
          </span>
          {ratings.length ? (
            <span className="flex items-center gap-1 shrink-0">
              {ratings.map((r) => (
                <span key={r.ag} className="tabular text-[10px] border border-caos-border rounded px-1 py-px" title={`${r.ag} rating`}>
                  <span className="text-caos-muted">{r.ag.substring(0, 3)}</span> <span className="text-caos-text font-semibold">{r.v}</span>
                </span>
              ))}
            </span>
          ) : null}
          {latest_run ? (
            <span className="flex items-center gap-1 shrink-0">
              <span title={STATUS_TOOLTIP[latest_run.committee_status] || ""}>
                <Tag sev={COMMITTEE_SEV[latest_run.committee_status] ?? "low"}>{latest_run.committee_status}</Tag>
              </span>
              {signals.recommendation ? (
                <span title={recGated
                  ? "Gated: committee status is Blocked — the stance is informational until the block clears."
                  : STATUS_TOOLTIP[String(signals.recommendation)] || ""}>
                  <Tag sev={recGated ? "low" : bandSev(signals.recommendation)}>
                    {String(signals.recommendation) + (recGated ? " · GATED" : "")}
                  </Tag>
                </span>
              ) : null}
            </span>
          ) : (
            <Tag sev="low">no run</Tag>
          )}
        </div>

        <div className="flex-1" />
        {!isOverlay && (
          <>
            {/* Full labelled nav only when the row has room (≥1450px). Between
                1100 and 1450 a compact (icon + active-label) nav keeps every
                concept reachable instead of vanishing; below 1100 it yields to
                the identity row (brand link + bottom function bar still route). */}
            <span className="hidden min-[1450px]:flex items-center gap-3 shrink-0">
              <ConceptNav />
              <div className="h-4 w-px bg-caos-border shrink-0" />
            </span>
            <span className="hidden min-[1100px]:flex min-[1450px]:hidden items-center gap-3 shrink-0">
              <ConceptNav compact />
              <div className="h-4 w-px bg-caos-border shrink-0" />
            </span>
          </>
        )}

        <Link href={deepHref} className="no-underline tabular text-caos-xs px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos whitespace-nowrap shrink-0 focus-ring">
          OPEN DEEP-DIVE →
        </Link>
        {isOverlay && onClose && (
          <>
            <div className="h-4 w-px bg-caos-border shrink-0" />
            <CloseButton onClick={onClose} title="Close (Esc)" />
          </>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-2 flex flex-col gap-2">
        {body}
      </div>

      {/* Issuer-scoped jumps — static desk function bar (Deep-Dive stays the
          header's single primary action). In overlay mode ConceptNav is hidden,
          so this bar is the only issuer-context route to the other concepts. */}
      <div className="h-8 shrink-0 border-t border-caos-border bg-caos-panel flex items-center gap-1 px-2">
        {ISSUER_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href + encodeURIComponent(id)}
            className="no-underline tabular text-caos-xs uppercase tracking-wider px-2 py-1 rounded text-caos-muted hover:text-caos-text hover:bg-caos-elevated transition-caos focus-ring"
          >
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── small building blocks ──────────────────────────────────────────────────
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="tabular text-caos-sm text-caos-muted py-1">{children}</p>;
}

export function analystNotesFromGraph(graph: GraphResult | null) {
  return (graph?.nodes ?? [])
    .filter((n) => n.id.startsWith("memo:"))
    .map((n) => ({
      id: n.id,
      title: n.label,
      excerpt: n.analyst_excerpt || n.sub || "",
      url: n.obsidian_url,
    }));
}

export function AnalystNotesPanel({ issuerId, issuerName, ticker }: { issuerId: string; issuerName: string; ticker?: string | null }) {
  const [graph, setGraph] = useState<GraphResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    setError(null);
    queryGraph("analyst-memos", issuerId)
      .then((g) => { if (!stale) setGraph(g); })
      .catch((e) => {
        if (stale) return;
        const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          || (e as Error)?.message || "could not load analyst notes";
        setError(String(detail));
      })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [issuerId]);

  const notes = analystNotesFromGraph(graph);
  const linkHint = "[[" + issuerName + "]]" + (ticker ? " or [[" + ticker + "]]" : "");

  return (
    <Panel title="Analyst notes" right={notes.length ? <span className="tabular text-caos-2xs text-caos-muted">{notes.length} linked</span> : null}>
      <div className="px-3 py-2 flex flex-col gap-2">
        {loading ? (
          <Empty>Loading analyst notes...</Empty>
        ) : error ? (
          <div className="flex items-start gap-1.5 tabular text-caos-sm text-caos-warning">
            <span className="mt-0.5 shrink-0"><StatusGlyph kind="warning" size={10} /></span>
            <span>Couldn&apos;t load analyst notes — {error}</span>
          </div>
        ) : notes.length === 0 ? (
          <Empty>No analyst notes linked to this issuer. Add {linkHint} in the vault.</Empty>
        ) : (
          <div className="flex flex-col divide-y divide-caos-border/40">
            {notes.map((note) => (
              <div key={note.id} className="py-1.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="tabular text-caos-sm text-caos-text truncate">{note.title}</span>
                  {note.url ? (
                    <a href={note.url} className="shrink-0 no-underline tabular text-caos-2xs text-caos-accent hover:text-caos-text transition-caos rounded focus-ring">
                      OPEN IN VAULT
                    </a>
                  ) : null}
                </div>
                {note.excerpt ? <p className="tabular text-caos-xs text-caos-muted mt-0.5">{note.excerpt}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

// Shown when every signal in a panel is blank — distinguishes "ran, nothing to
// say" from "never ran" so we never imply analysis happened when it didn't.
function EmptyIfBlank({ ok, latest }: { ok: unknown[]; latest: boolean }) {
  if (ok.some((v) => v != null)) return null;
  return <Empty>{latest ? "Not surfaced by the latest run." : "No completed run yet — run an analysis."}</Empty>;
}

// fallow-ignore-next-line complexity
function DeltaRow({ label, v, suffix }: { label: string; v: unknown; suffix: string }) {
  if (v == null || typeof v !== "number") return null;
  const sev = v > 0 ? "pass" : v < 0 ? "high" : "low";
  return (
    <div className="flex items-baseline justify-between">
      <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{label}</span>
      <span className="tabular font-medium leading-none" style={{ fontSize: 15, color: sevSurface(sev).color }}>{signed(v, suffix)}</span>
    </div>
  );
}

function SigBand({ label, v, extra, gated = false }: { label: string; v: unknown; extra?: string; gated?: boolean }) {
  if (v == null) return null;
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted pt-0.5">{label}</span>
      <span className="flex flex-col items-end gap-0.5">
        <Tag sev={gated ? "low" : bandSev(v)}>{String(v) + (gated ? " · GATED" : "")}</Tag>
        {gated ? <span className="tabular text-caos-2xs text-caos-muted text-right">committee Blocked</span> : null}
        {extra ? <span className="tabular text-caos-2xs text-caos-muted text-right">{extra}</span> : null}
      </span>
    </div>
  );
}

function SigText({ label, v, sev }: { label: string; v: string | null; sev?: string }) {
  if (v == null) return null;
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted pt-0.5">{label}</span>
      <span className="tabular text-caos-sm text-right" style={{ color: sev ? sevSurface(sev).color : "var(--caos-text)" }}>{v}</span>
    </div>
  );
}

function RunRow({ r, href }: { r: ProfileRun; href: string }) {
  const date = r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : "—";
  // One truncating labeled cell (QA · IC, analyst in the tooltip) instead of the
  // former six fixed columns, which overflowed the ~500px panel into a scrollbar
  // and read as a stutter ("Blocked Blocked") with the analyst id clipped.
  return (
    <Link
      href={href}
      title={`QA ${r.qa_status} · IC ${r.committee_status}${r.analyst_id ? " · " + r.analyst_id : ""}`}
      className="no-underline grid grid-cols-[84px_auto_minmax(0,1fr)_44px] gap-x-2 px-3 py-[7px] border-b border-caos-border/50 items-center hover:bg-caos-elevated/60 transition-caos group focus-ring"
    >
      <span className="tabular text-caos-sm text-caos-muted">{date}</span>
      <Tag sev={RUN_SEV[r.status] ?? "low"}>{r.status}</Tag>
      <span className="tabular text-caos-sm text-caos-text truncate">QA {r.qa_status} · IC {r.committee_status}</span>
      <span className="tabular text-caos-2xs text-caos-muted text-right group-hover:text-caos-accent transition-caos">OPEN →</span>
    </Link>
  );
}

// A column of CP-1A sourced statements (business description / operating model).
function BizCol({ title, facts, deepHref }: { title: string; facts: BusinessFact[]; deepHref: string }) {
  return (
    <div className="px-3 py-2.5">
      <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5">{title}</div>
      {facts.length === 0 ? (
        <p className="tabular text-caos-2xs text-caos-muted">—</p>
      ) : (
        <div className="flex flex-col gap-2">
          {facts.map((f, i) => (
            <div key={i}>
              <p className="text-caos-md text-caos-text/90 leading-snug m-0">{f.statement}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="tabular text-caos-2xs text-caos-muted">{f.fact_area}</span>
                {f.chunk_id ? <Link href={deepHref + "&mod=CP-1A"} className="no-underline tabular text-caos-2xs text-caos-muted hover:text-caos-accent transition-caos rounded focus-ring" title="See source in Deep-Dive" aria-label="See source in Deep-Dive">▸ src</Link> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Ownership fact(s) plus the CP-2D sponsor red-flag ledger.
// fallow-ignore-next-line complexity
function OwnershipCol({ facts, ledger, score, deepHref }: {
  facts: BusinessFact[]; ledger: { flag: string; chunk_id?: string }[]; score?: number; deepHref: string;
}) {
  return (
    <div className="px-3 py-2.5">
      <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5">Ownership &amp; sponsor</div>
      {facts.length === 0 && ledger.length === 0 ? (
        <p className="tabular text-caos-2xs text-caos-muted">—</p>
      ) : (
        <div className="flex flex-col gap-2">
          {facts.map((f, i) => (
            <div key={i}>
              <p className="text-caos-md text-caos-text/90 leading-snug m-0">{f.statement}</p>
              {f.chunk_id ? <Link href={deepHref + "&mod=CP-1A"} className="no-underline tabular text-caos-2xs text-caos-muted hover:text-caos-accent transition-caos rounded focus-ring" title="See source in Deep-Dive" aria-label="See source in Deep-Dive">▸ src</Link> : null}
            </div>
          ))}
          {ledger.length ? (
            <div className="flex flex-col gap-1 pt-0.5">
              {typeof score === "number" ? <span className="tabular text-caos-2xs text-caos-muted">Governance risk score {score}</span> : null}
              {ledger.map((fl, i) => (
                <span key={i} className="flex items-center gap-1.5 tabular text-caos-2xs" style={{ color: sevSurface("warning").color }}>
                  <StatusGlyph kind="warning" size={9} /> {fl.flag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// A strengths or weaknesses list, glyph-marked (success ✓ / warning ▾).
function SWCol({ kind, title, items }: { kind: "success" | "warning"; title: string; items: string[] }) {
  const sev = kind === "success" ? "pass" : "warning";
  return (
    <div className="px-3 py-2.5">
      <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5">{title}</div>
      {items.length === 0 ? (
        <p className="tabular text-caos-2xs text-caos-muted">—</p>
      ) : (
        <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
          {items.map((t, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span style={{ color: sevSurface(sev).color }} className="mt-0.5 shrink-0"><StatusGlyph kind={kind} size={10} /></span>
              <span className="text-caos-md text-caos-text/90 leading-snug">{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
