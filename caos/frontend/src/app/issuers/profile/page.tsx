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
import { getIssuerProfile, type BusinessFact, type EarningsSummary, type IssuerProfile, type ProfileRun } from "@/lib/api";

const EMPTY_EARNINGS: EarningsSummary = {
  latest_period: null, prior_period: null, revenue_growth_pct: null,
  ebitda_growth_pct: null, margin_change_pp: null, monitoring_signals: [],
};
import { RequireAuth } from "@/components/shared/RequireAuth";
import { Panel } from "@/components/shared/Panel";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { Dot, Tag, ToggleGroup } from "@/components/pipeline/atoms";
import { sevSurface } from "@/lib/pipeline/sev";
import { G2Chart } from "@/components/charts/G2Chart";
import { buildCharts, buildHeadline, buildSeries, filterSeriesByGranularity, latestPointDelta } from "@/lib/issuer-profile-charts";
import { issuerSector } from "@/lib/issuers";

// FY ↔ quarter granularity options for the trend toggle (as-const so the union
// "FY" | "Q" flows into ToggleGroup's generic and back to setGran).
const GRAN_OPTS = [{ k: "FY" as const, l: "Full year" }, { k: "Q" as const, l: "Quarters" }];

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
const QA_SEV: Record<string, string> = {
  Passed: "pass", Restricted: "warning", Blocked: "critical", "Not Reviewed": "low",
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
  net_leverage: "Net leverage", interest_coverage: "Interest coverage",
  ebitda_margin: "EBITDA margin", revenue: "Revenue", adj_ebitda: "Adj. EBITDA",
  fcf: "Free cash flow", fcf_conversion: "Cash conversion",
  altman_z: "Altman Z″", energy_cost_pct: "Energy / COGS",
};
// Snapshot tiles that carry a period-over-period delta (from CP-1B), shown inline
// under the value. Keyed by metric → the signal field + its unit.
const TILE_DELTA: Record<string, { key?: string; suffix: string; digits?: number; higherIsBetter: boolean; showMissing?: boolean }> = {
  revenue: { key: "revenue_growth_pct", suffix: "%", higherIsBetter: true },
  adj_ebitda: { key: "ebitda_growth_pct", suffix: "%", higherIsBetter: true },
  ebitda_margin: { key: "margin_change_pp", suffix: "pp", higherIsBetter: true },
  net_leverage: { suffix: "×", digits: 2, higherIsBetter: false, showMissing: true },
  interest_coverage: { suffix: "×", higherIsBetter: true, showMissing: true },
  fcf_conversion: { suffix: "pp", higherIsBetter: true, showMissing: true },
};

const BASIS_LABEL: Record<string, string> = {
  reported: "reported", reported_disclosure: "reported (disclosed)", adjusted: "adjusted",
};
// Provenance → how trustworthy. demo_fixture is fabricated and flagged loud.
const PROV: Record<string, { sev: string; label: string }> = {
  run: { sev: "pass", label: "live run" },
  derived: { sev: "low", label: "derived" },
  seed: { sev: "low", label: "demo seed" },
  fixture: { sev: "info", label: "reference demo" },
  demo_fixture: { sev: "critical", label: "fabricated" },
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

// The least-trustworthy provenance among the shown metrics, surfaced ONCE as a
// panel-level legend (distill) instead of repeating the word on every tile.
function worstProvenance(ms: { provenance: string }[]): string | null {
  for (const p of ["demo_fixture", "fixture", "seed", "derived"])
    if (ms.some((m) => m.provenance === p)) return p;
  return null;
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
      <StatusGlyph kind="warning" size={20} />
      <p className="text-caos-2xl text-caos-text font-medium">{msg}</p>
      <div className="flex gap-2">
        <Link href="/issuers" className="no-underline tabular text-caos-md px-3 py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos">
          ← BACK TO DIRECTORY
        </Link>
        {id ? (
          <Link href={"/deepdive?issuer=" + encodeURIComponent(id)} className="no-underline tabular text-caos-md px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos">
            OPEN DEEP-DIVE
          </Link>
        ) : null}
      </div>
    </div>
  );
}

// fallow-ignore-next-line complexity
function Profile({ id, data }: { id: string; data: IssuerProfile }) {
  const { issuer, latest_run, runs, metrics, signals, coverage, findings, business, sponsor, strengths, weaknesses } = data;
  const earnings = data.earnings ?? EMPTY_EARNINGS;  // trust boundary — old/odd payloads may omit it
  const deepHref = "/deepdive?issuer=" + encodeURIComponent(id);

  const ratings = [
    { ag: "S&P", v: issuer.rating_sp }, { ag: "Moody’s", v: issuer.rating_moody }, { ag: "Fitch", v: issuer.rating_fitch },
  ].filter((r) => r.v);
  const factsByCode = (codes: string[]) => business.filter((f) => codes.includes(f.code));
  const sponsorLedger = Array.isArray((sponsor as { ledger?: unknown }).ledger)
    ? ((sponsor as { ledger: { flag: string; chunk_id?: string }[] }).ledger) : [];

  const [gran, setGran] = useState<"FY" | "Q">("FY");
  const headline = useMemo(() => buildHeadline(metrics), [metrics]);
  const series = useMemo(() => buildSeries(metrics), [metrics]);
  // Build both granularities so the toggle shows only when there's something to
  // switch to, and each side draws only its own periods (annual vs quarterly).
  const fyCharts = useMemo(() => buildCharts(filterSeriesByGranularity(series, "FY")), [series]);
  const qCharts = useMemo(() => buildCharts(filterSeriesByGranularity(series, "Q")), [series]);
  const charts = gran === "FY" ? fyCharts : qCharts;
  const snapshotProv = useMemo(() => worstProvenance(headline), [headline]);

  const totalFindings = (findings.CRITICAL || 0) + (findings.MATERIAL || 0) + (findings.MINOR || 0);

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header — matches the directory chrome */}
      <div className="h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-3 px-4">
        <Link href="/issuers" className="no-underline flex items-center gap-2 group" aria-label="Back to issuer directory">
          <span className="w-5 h-5 rounded-sm flex items-center justify-center text-caos-md font-bold" style={{ background: "var(--caos-accent)", color: "var(--caos-bg)" }}>C</span>
          <span className="text-caos-2xl font-semibold tracking-wide text-caos-text group-hover:text-white transition-caos whitespace-nowrap">CREDIT OS</span>
        </Link>
        <div className="h-4 w-px bg-caos-border" />
        <span className="text-caos-xl text-caos-text font-medium whitespace-nowrap">Issuer Profile</span>
        <div className="flex-1" />
        <ConceptNav />
        <div className="h-4 w-px bg-caos-border" />
        <Link href={deepHref} className="no-underline tabular text-caos-xs px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos whitespace-nowrap">
          OPEN DEEP-DIVE →
        </Link>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-2 flex flex-col gap-2">
        {/* identity + stance */}
        <div className="bg-caos-panel border border-caos-border rounded-md px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="tabular text-caos-accent font-semibold leading-none tracking-tight" style={{ fontSize: 17 }}>{issuer.ticker?.toUpperCase() || "—"}</span>
          <span className="text-caos-text font-medium leading-none" style={{ fontSize: 15 }}>{issuer.name}</span>
          <span className="text-caos-md text-caos-muted">{[issuerSector(issuer), issuer.sub_sector, issuer.country].filter(Boolean).join(" · ") || "—"}</span>
          {issuer.figi ? <span className="tabular text-caos-2xs text-caos-muted border border-caos-border rounded px-1.5 py-px">{issuer.figi}</span> : null}
          {ratings.length ? (
            <span className="flex items-center gap-1.5">
              {ratings.map((r) => (
                <span key={r.ag} className="tabular text-caos-2xs border border-caos-border rounded px-1.5 py-px" title={`${r.ag} issuer rating`}>
                  <span className="text-caos-muted">{r.ag}</span> <span className="text-caos-text font-medium">{r.v}</span>
                </span>
              ))}
            </span>
          ) : null}
          <div className="flex-1" />
          {latest_run ? (
            <span className="flex items-center gap-1.5">
              <Tag sev={COMMITTEE_SEV[latest_run.committee_status] ?? "low"}>{latest_run.committee_status}</Tag>
              <Tag sev={QA_SEV[latest_run.qa_status] ?? "low"}>QA {latest_run.qa_status}</Tag>
              {signals.recommendation ? <Tag sev={bandSev(signals.recommendation)}>{String(signals.recommendation)}</Tag> : null}
              {totalFindings > 0 ? <Tag sev={findings.CRITICAL || findings.MATERIAL ? "warning" : "low"}>{totalFindings} finding{totalFindings === 1 ? "" : "s"}</Tag> : null}
            </span>
          ) : (
            <Tag sev="low">no completed run</Tag>
          )}
        </div>

        {/* snapshot + what-changed */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-2">
          <Panel
            title={"Credit snapshot" + (latest_run?.as_of_date ? " · as of " + latest_run.as_of_date : "")}
            right={snapshotProv ? <Tag sev={PROV[snapshotProv].sev}>{PROV[snapshotProv].label}</Tag> : null}
          >
            {headline.length === 0 ? (
              <div className="px-3 py-2.5"><Empty>No headline metrics yet — run an analysis to populate the snapshot.</Empty></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3">
                {/* fallow-ignore-next-line complexity */}
                {headline.map((m) => {
                  const sev = metricSev(m.metric_key, m.value);
                  const d = TILE_DELTA[m.metric_key];
                  const signalDelta = d?.key ? signals[d.key] : null;
                  const seriesDelta = d && !d.key ? latestPointDelta(series[m.metric_key]) : null;
                  const dv = typeof signalDelta === "number" ? signalDelta : seriesDelta;
                  const delta = typeof dv === "number" ? dv : null;
                  const deltaSev = d && delta != null
                    ? (delta >= 0) === d.higherIsBetter ? "pass" : "high"
                    : null;
                  return (
                    <div key={m.metric_key} className="px-3 py-2.5 border-b border-r border-caos-border/40">
                      <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{METRIC_LABEL[m.metric_key] || m.metric_key}</div>
                      <div className="flex items-baseline gap-2 mt-1.5">
                        <span className="tabular font-medium leading-none" style={{ fontSize: 18, color: sev ? sevSurface(sev).color : "var(--caos-text)" }}>{fmt(m.value, m.unit)}</span>
                        {d && delta != null && deltaSev ? <span className="tabular text-caos-2xs" style={{ color: sevSurface(deltaSev).color }}>{signed(delta, d.suffix, d.digits)}</span> : null}
                        {d?.showMissing && delta == null ? <span className="tabular text-caos-2xs text-caos-muted">no prior</span> : null}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="tabular text-caos-2xs text-caos-muted truncate">{m.period}{m.basis ? " · " + (BASIS_LABEL[m.basis] || m.basis) : ""}</span>
                        {m.provenance !== "run" ? <span title={PROV[m.provenance]?.label}><Dot sev={PROV[m.provenance]?.sev || "low"} glyph /></span> : null}
                        <div className="flex-1" />
                        {m.document_chunk_id ? (
                          <Link href={deepHref + "&mod=CP-1"} className="no-underline tabular text-caos-2xs text-caos-muted hover:text-caos-accent transition-caos" title="See source in Deep-Dive">▸ src</Link>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title={"Latest earnings" + (earnings.latest_period ? " · " + earnings.latest_period : "")}>
            {/* fallow-ignore-next-line complexity */}
            {(() => {
              const ms = earnings.monitoring_signals || [];
              const hasDelta = [earnings.revenue_growth_pct, earnings.ebitda_growth_pct, earnings.margin_change_pp].some((v) => typeof v === "number");
              if (!hasDelta && !ms.length)
                return <div className="px-3 py-2.5"><Empty>No earnings delta yet — needs ≥2 comparable periods.</Empty></div>;
              return (
                <div className="px-3 py-2.5 flex flex-col gap-2.5">
                  {earnings.prior_period && earnings.latest_period ? (
                    <div className="tabular text-caos-2xs text-caos-muted">{earnings.prior_period} → {earnings.latest_period} · YoY</div>
                  ) : null}
                  <DeltaRow label="Revenue" v={earnings.revenue_growth_pct} suffix="%" />
                  <DeltaRow label="Adj. EBITDA" v={earnings.ebitda_growth_pct} suffix="%" />
                  <DeltaRow label="EBITDA margin" v={earnings.margin_change_pp} suffix="pp" />
                  {ms.length ? (
                    <div className="flex flex-col gap-1 pt-1.5 border-t border-caos-border/40">
                      <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Watch</span>
                      {ms.map((s, i) => (
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
        </div>

        {/* business profile (CP-1A facts + CP-2D sponsor) */}
        <Panel title="Business profile" className="shrink-0">
          {business.length === 0 && sponsorLedger.length === 0 ? (
            <div className="px-3 py-2.5">
              <Empty>{latest_run
                ? "No business disclosure ingested — upload an offering memo / 10-K to populate description, operating model, and ownership."
                : "No completed run yet — run an analysis to extract the business profile."}</Empty>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-caos-border/40">
              <BizCol title="Description" facts={factsByCode(["transaction", "history", "geography"])} deepHref={deepHref} />
              <BizCol title="Operating model" facts={factsByCode(["operating_model"])} deepHref={deepHref} />
              <OwnershipCol facts={factsByCode(["ownership"])} ledger={sponsorLedger} score={(sponsor as { governance_risk_score?: number }).governance_risk_score} deepHref={deepHref} />
            </div>
          )}
        </Panel>

        {/* time-series visualisations — shrink-0 so the fixed-height canvases
            keep their height in the scrolling flex column rather than being
            squeezed (min-h-0) and clipped by the panel's overflow. */}
        <Panel
          title="Financial & credit trend"
          className="shrink-0"
          right={fyCharts.length || qCharts.length
            ? <ToggleGroup options={GRAN_OPTS} value={gran} onChange={setGran} size="sm" />
            : null}
        >
          {charts.length === 0 ? (
            <div className="px-3 py-2.5">
              <Empty>{gran === "Q"
                ? "No quarterly periods in this run — figures are annual (FY / LTM). Quarterly trends populate from a 10-Q / quarterly run."
                : "Time series needs ≥2 fiscal periods — run an EDGAR or multi-period analysis to populate trends."}</Empty>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-2">
              {charts.map((c) => (
                <div key={c.title} className="rounded border border-caos-border bg-caos-bg">
                  <div className="px-3 py-2 border-b border-caos-border">
                    <span className="tabular text-caos-xs uppercase tracking-wider text-caos-muted">{c.title}</span>
                  </div>
                  <div className="px-2 pt-1 pb-2"><G2Chart spec={c.spec} height={170} /></div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* key strengths & weaknesses (derived, rule-based) */}
        {strengths.length || weaknesses.length ? (
          <Panel title="Key strengths & weaknesses" className="shrink-0" right={<span className="tabular text-caos-2xs text-caos-muted">derived from this run’s signals</span>}>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-caos-border/40">
              <SWCol kind="success" title="Strengths" items={strengths} />
              <SWCol kind="warning" title="Weaknesses" items={weaknesses} />
            </div>
          </Panel>
        ) : latest_run ? (
          <Panel title="Key strengths & weaknesses" className="shrink-0">
            <div className="px-3 py-2.5"><Empty>No decisive strengths or weaknesses surfaced by this run.</Empty></div>
          </Panel>
        ) : null}

        {/* thesis/risk + structure + coverage */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          <Panel title="Thesis & risk">
            <div className="px-3 py-2.5 flex flex-col gap-2">
              <SigBand label="Relative value" v={signals.recommendation} extra={signals.composite_percentile != null ? `${signals.composite_percentile}th pct ${signals.peer_scope ? "· " + signals.peer_scope : ""}` : undefined} />
              <SigBand label="Downside fragility" v={signals.fragility}
                extra={signals.shock_to_breach_pct != null ? `breach @ −${signals.shock_to_breach_pct}% EBITDA${signals.breach_threshold_x ? ` (${signals.breach_threshold_x}×)` : ""}` : undefined} />
              <SigBand label="Refi / LME risk" v={signals.lme_band}
                extra={signals.lme_score != null ? `score ${signals.lme_score}` : undefined} />
              <EmptyIfBlank ok={[signals.recommendation, signals.fragility, signals.lme_band]} latest={!!latest_run} />
            </div>
          </Panel>

          <Panel title="Structure & protection">
            <div className="px-3 py-2.5 flex flex-col gap-2">
              <SigText label="Covenant headroom" v={signals.covenant_headroom_turns != null ? `${Number(signals.covenant_headroom_turns).toFixed(1)}× to breach${signals.covenant_cushion_pct != null ? ` · ${Number(signals.covenant_cushion_pct).toFixed(0)}% EBITDA cushion` : ""}` : null} />
              <SigText label="Covenant structure" v={signals.covenant_structure as string | null} />
              <SigText label="Liquidity runway" v={signals.runway_months != null ? `${signals.runway_months} mo of interest${signals.liquidity_musd != null ? ` · $${Number(signals.liquidity_musd).toFixed(0)}m disclosed` : ""}` : null} />
              <EmptyIfBlank ok={[signals.covenant_headroom_turns, signals.covenant_structure, signals.runway_months]} latest={!!latest_run} />
            </div>
          </Panel>

          <Panel title="Coverage & trust">
            <div className="px-3 py-2.5 flex flex-col gap-2">
              <SigText label="Source readiness" v={coverage.readiness_score != null ? `${Math.round(Number(coverage.readiness_score) * 100)}% · ${Number(coverage.documents) || 0} doc${Number(coverage.documents) === 1 ? "" : "s"}` : `${Number(coverage.documents) || 0} doc${Number(coverage.documents) === 1 ? "" : "s"} vaulted`} />
              {Array.isArray(coverage.categories_missing) && coverage.categories_missing.length ? (
                <SigText label="Source gaps" v={(coverage.categories_missing as string[]).join(", ")} sev="warning" />
              ) : null}
              <SigText label="EDGAR XBRL" v={coverage.edgar_available == null ? null : coverage.edgar_available ? "available" : "not available"} />
              <SigText label="Open QA findings" v={totalFindings ? `${findings.CRITICAL} crit · ${findings.MATERIAL} mat · ${findings.MINOR} min` : "none"} sev={findings.CRITICAL || findings.MATERIAL ? "warning" : undefined} />
            </div>
          </Panel>
        </div>

        {/* run history */}
        <Panel title={`Run history · ${runs.length}`}>
          {runs.length === 0 ? (
            <Empty>No runs yet. Start one from the Execution Graph to build this issuer’s view.</Empty>
          ) : (
            <div className="text-caos-md">
              <div className="grid grid-cols-[100px_1fr_1fr_1fr_110px_90px] gap-x-3 px-3 h-7 border-b border-caos-border sticky top-0 bg-caos-panel">
                {["Date", "Status", "QA", "Committee", "Analyst", ""].map((h, i) => (
                  <span key={i} className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted self-center">{h}</span>
                ))}
              </div>
              {runs.map((r) => (
                <RunRow key={r.id} r={r} href={deepHref + "&run=" + encodeURIComponent(r.id)} />
              ))}
            </div>
          )}
        </Panel>

        {/* actions */}
        <div className="flex flex-wrap gap-2 pb-1">
          <Action href={deepHref} primary>Open Deep-Dive</Action>
          <Action href={"/pipeline?issuer=" + encodeURIComponent(id)}>Run / re-run analysis</Action>
          <Action href={"/model?issuer=" + encodeURIComponent(id)}>Model Builder</Action>
          <Action href={"/reports?issuer=" + encodeURIComponent(id)}>Report Studio</Action>
          <Action href={"/upload?issuer=" + encodeURIComponent(id)}>Upload documents</Action>
        </div>
      </div>
    </div>
  );
}

// ─── small building blocks ──────────────────────────────────────────────────
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="tabular text-caos-sm text-caos-muted py-1">{children}</p>;
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

function SigBand({ label, v, extra }: { label: string; v: unknown; extra?: string }) {
  if (v == null) return null;
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted pt-0.5">{label}</span>
      <span className="flex flex-col items-end gap-0.5">
        <Tag sev={bandSev(v)}>{String(v)}</Tag>
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
  return (
    <Link href={href} className="no-underline grid grid-cols-[100px_1fr_1fr_1fr_110px_90px] gap-x-3 px-3 py-[7px] border-b border-caos-border/50 items-center hover:bg-caos-elevated/60 transition-caos group">
      <span className="tabular text-caos-sm text-caos-muted">{date}</span>
      <span className="flex items-center gap-1.5"><Tag sev={RUN_SEV[r.status] ?? "low"}>{r.status}</Tag></span>
      <span className="tabular text-caos-sm text-caos-text">{r.qa_status}</span>
      <span className="tabular text-caos-sm text-caos-text">{r.committee_status}</span>
      <span className="tabular text-caos-sm text-caos-muted truncate">{r.analyst_id || "—"}</span>
      <span className="tabular text-caos-2xs text-caos-muted text-right group-hover:text-caos-accent transition-caos">OPEN →</span>
    </Link>
  );
}

function Action({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link href={href} className={"no-underline tabular text-caos-md px-3 py-1.5 rounded border transition-caos " + (primary ? "border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60")}>
      {children}
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
                {f.chunk_id ? <Link href={deepHref + "&mod=CP-1A"} className="no-underline tabular text-caos-2xs text-caos-muted hover:text-caos-accent transition-caos" title="See source in Deep-Dive">▸ src</Link> : null}
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
              {f.chunk_id ? <Link href={deepHref + "&mod=CP-1A"} className="no-underline tabular text-caos-2xs text-caos-muted hover:text-caos-accent transition-caos">▸ src</Link> : null}
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
