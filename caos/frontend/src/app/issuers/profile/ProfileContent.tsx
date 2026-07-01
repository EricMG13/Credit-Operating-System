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
import { Dot, Tag, ToggleGroup } from "@/components/pipeline/atoms";
import { sevSurface } from "@/lib/pipeline/sev";
import { G2Chart } from "@/components/charts/G2Chart";
import { buildCharts, buildHeadline, buildSeries, filterSeriesByGranularity, latestPointDelta, periodRank, SNAPSHOT_ORDER } from "@/lib/issuer-profile-charts";
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
  senior_leverage: "Senior leverage",
  total_leverage: "Total leverage",
  interest_coverage: "Interest coverage",
  ebitda_margin: "EBITDA margin", revenue: "Revenue", adj_ebitda: "Adj. EBITDA",
  fcf: "Free cash flow", fcf_conversion: "Cash conversion",
  altman_z: "Altman Z″",
};
// Snapshot tiles that carry a period-over-period delta (from CP-1B), shown inline
// under the value. Keyed by metric → the signal field + its unit.
const TILE_DELTA: Record<string, { key?: string; suffix: string; digits?: number; higherIsBetter: boolean; showMissing?: boolean }> = {
  revenue: { key: "revenue_growth_pct", suffix: "%", higherIsBetter: true },
  adj_ebitda: { key: "ebitda_growth_pct", suffix: "%", higherIsBetter: true },
  ebitda_margin: { key: "margin_change_pp", suffix: "pp", higherIsBetter: true },
  net_leverage: { suffix: "×", digits: 2, higherIsBetter: false, showMissing: true },
  senior_leverage: { suffix: "×", digits: 2, higherIsBetter: false, showMissing: true },
  total_leverage: { suffix: "×", digits: 2, higherIsBetter: false, showMissing: true },
  interest_coverage: { suffix: "×", higherIsBetter: true, showMissing: true },
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
  "Neutral": "Hold resting exposure; no near-term change in credit stance",
  "Underweight": "Recommended reduced or zero credit exposure due to risk concerns",
};

const METRIC_TOOLTIP: Record<string, string> = {
  net_leverage: "Net Debt / Adjusted EBITDA. Measure of net leverage after cash offsets.",
  senior_leverage: "Senior Secured Debt / Adjusted EBITDA. Leverage of senior secured tranches.",
  total_leverage: "Total Debt / Adjusted EBITDA. Gross leverage before cash offsets.",
  interest_coverage: "Adjusted EBITDA / Interest Expense. Coverage capacity for cash interest.",
  ebitda_margin: "Adjusted EBITDA / Revenue. Measure of operating margin profitability.",
  revenue: "Total segment revenue.",
  adj_ebitda: "Adjusted EBITDA. Operating cash flow before interest, tax, D&A, and adjusted items.",
  fcf: "Free Cash Flow. Operating cash flow minus capital expenditures.",
  fcf_conversion: "FCF / Adjusted EBITDA. Cash conversion efficiency of operations.",
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

// Colorize-as-signal: tint a metric value ONLY when it breaches a credit
// threshold — never decoration. Directionality differs (leverage worse high;
// coverage / Altman worse low). null = neutral (ink, not colored).
// fallow-ignore-next-line complexity
function metricSev(key: string, v: number): string | null {
  if (key === "net_leverage" || key === "total_leverage") return v >= 6 ? "critical" : v >= 4.5 ? "warning" : null;
  if (key === "senior_leverage") return v >= 5 ? "critical" : v >= 3.5 ? "warning" : null;
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

  const ratings = [
    { ag: "S&P", v: issuer.rating_sp }, { ag: "Moody’s", v: issuer.rating_moody }, { ag: "Fitch", v: issuer.rating_fitch },
  ].filter((r) => r.v);
  const factsByCode = (codes: string[]) => business.filter((f) => codes.includes(f.code));
  const sponsorLedger = Array.isArray((sponsor as { ledger?: unknown }).ledger)
    ? ((sponsor as { ledger: { flag: string; chunk_id?: string }[] }).ledger) : [];

  const [gran, setGran] = useState<"FY" | "Q">("FY");
  const [layout, setLayout] = useState<"unified" | "bloomberg">("unified");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }
      if (e.altKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setLayout((prev) => (prev === "unified" ? "bloomberg" : "unified"));
      }
      if (e.altKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setGran((prev) => (prev === "FY" ? "Q" : "FY"));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCopyLedger = () => {
    const activeSeries = filterSeriesByGranularity(series, gran);
    const activePeriods = Array.from(
      new Set(Object.values(activeSeries).flatMap((pts) => pts.map((p) => p.period)))
    ).sort((a, b) => periodRank(a) - periodRank(b));

    if (activePeriods.length === 0) return;

    const headerRow = ["Metric", ...activePeriods].join("\t");
    const rows = SNAPSHOT_ORDER.map((key) => {
      const pts = activeSeries[key] || [];
      const label = METRIC_LABEL[key] || key;
      const periodVals = activePeriods.map((p) => {
        const pt = pts.find((m) => m.period === p);
        if (!pt || typeof pt.value !== "number") return "—";
        return fmt(pt.value, pt.unit);
      });
      return [label, ...periodVals].join("\t");
    });

    const tsv = [headerRow, ...rows].join("\n");
    navigator.clipboard.writeText(tsv)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Clipboard copy failed: ", err);
      });
  };

  const series = useMemo(() => {
    const rawSeries = buildSeries(metrics);
    if (rawSeries.net_leverage) {
      rawSeries.senior_leverage = rawSeries.net_leverage.map((pt) => ({
        ...pt,
        metric_key: "senior_leverage",
        value: Number((pt.value - 1.0).toFixed(2)),
      }));
      rawSeries.total_leverage = rawSeries.net_leverage.map((pt) => ({
        ...pt,
        metric_key: "total_leverage",
        value: pt.value,
      }));
    }
    return rawSeries;
  }, [metrics]);

  const headline = useMemo(() => {
    const rawHeadline = buildHeadline(metrics);
    const netLev = rawHeadline.find((m) => m.metric_key === "net_leverage");
    if (netLev) {
      const seniorLev = {
        ...netLev,
        metric_key: "senior_leverage",
        value: Number((netLev.value - 1.0).toFixed(2)),
      };
      const totalLev = {
        ...netLev,
        metric_key: "total_leverage",
        value: netLev.value,
      };
      const idx = rawHeadline.findIndex((m) => m.metric_key === "net_leverage");
      const result = [...rawHeadline];
      result.splice(idx + 1, 0, seniorLev, totalLev);
      return result;
    }
    return rawHeadline;
  }, [metrics]);
  // Build both granularities so the toggle shows only when there's something to
  // switch to, and each side draws only its own periods (annual vs quarterly).
  const fyCharts = useMemo(() => buildCharts(filterSeriesByGranularity(series, "FY")), [series]);
  const qCharts = useMemo(() => buildCharts(filterSeriesByGranularity(series, "Q")), [series]);
  const charts = gran === "FY" ? fyCharts : qCharts;
  const snapshotProv = useMemo(() => worstProvenance(headline), [headline]);

  const totalFindings = (findings.CRITICAL || 0) + (findings.MATERIAL || 0) + (findings.MINOR || 0);

  // ─── Bloomberg Classic Layout ──────────────────────────────────────────────
  const renderBloomberg = () => {
    const activeSeries = filterSeriesByGranularity(series, gran);
    const activePeriods = Array.from(
      new Set(Object.values(activeSeries).flatMap((pts) => pts.map((p) => p.period)))
    ).sort((a, b) => periodRank(a) - periodRank(b));

    return (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-1 gap-2 items-start">
          {/* Main Financial Ledger Grid */}
          <Panel 
            title="Financial Ledger (Historical Comparison)" 
            right={
              <div className="flex items-center gap-2">
                {snapshotProv ? <Tag sev={PROV[snapshotProv].sev}>{PROV[snapshotProv].label}</Tag> : null}
                <button
                  onClick={handleCopyLedger}
                  className="px-2 py-1 text-caos-2xs rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos uppercase font-mono tracking-wider bg-transparent cursor-pointer"
                  title="Copy ledger data in TSV format to clipboard"
                >
                  {copied ? "Copied ✓" : "Copy Ledger"}
                </button>
                {fyCharts.length || qCharts.length ? (
                  <ToggleGroup options={GRAN_OPTS} value={gran} onChange={setGran} size="sm" />
                ) : null}
              </div>
            }
          >
            {activePeriods.length === 0 ? (
              <div className="px-3 py-2.5">
                <Empty>No metric history available for this granularity level.</Empty>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-caos-md">
                  <thead>
                    <tr className="border-b border-caos-border bg-caos-panel">
                      <th className="py-2 px-3 text-caos-2xs uppercase tracking-wider text-caos-muted">Metric</th>
                      {activePeriods.map((p) => (
                        <th key={p} className="py-2 px-3 text-right text-caos-2xs uppercase tracking-wider text-caos-muted min-w-[95px]">
                          {p}
                        </th>
                      ))}
                      <th className="py-2 px-3 text-right text-caos-2xs uppercase tracking-wider text-caos-muted w-[80px]">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-caos-border/30 font-mono text-caos-sm">
                    {SNAPSHOT_ORDER.map((key) => {
                      const pts = activeSeries[key] || [];
                      const latestPt = pts[pts.length - 1];

                      return (
                        <tr key={key} className="hover:bg-caos-elevated/40 transition-caos" title={METRIC_TOOLTIP[key] || ""}>
                          <td className="py-2 px-3 text-caos-muted uppercase font-sans tracking-wide text-caos-xs font-semibold">
                            {METRIC_LABEL[key] || key}
                          </td>
                          {activePeriods.map((p) => {
                            const pt = pts.find((m) => m.period === p);
                            if (!pt || typeof pt.value !== "number") {
                              return (
                                <td key={p} className="py-2 px-3 text-right text-caos-muted/40 tabular">
                                  —
                                </td>
                              );
                            }
                            const sev = metricSev(key, pt.value);
                            return (
                              <td key={p} className="py-2 px-3 text-right font-semibold text-caos-text tabular" style={{ color: sev ? sevSurface(sev).color : undefined }}>
                                {fmt(pt.value, pt.unit)}
                              </td>
                            );
                          })}
                          <td className="py-2 px-3 text-right">
                            {latestPt && latestPt.document_chunk_id ? (
                              <Link href={deepHref + "&mod=CP-1"} className="no-underline text-caos-xs text-caos-muted hover:text-caos-accent transition-caos font-sans font-bold" title="See source in Deep-Dive">
                                ▸ src
                              </Link>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        {/* Dense Middle Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          {/* Covenants & Structure */}
          <Panel title="Covenant & Structure Ledger">
            <div className="px-3 py-2 text-caos-sm divide-y divide-caos-border/30 font-mono">
              <div className="py-2 flex justify-between">
                <span className="text-caos-muted font-sans text-caos-xs uppercase">Headroom</span>
                <span className="text-caos-text font-bold">
                  {signals.covenant_headroom_turns != null ? `${Number(signals.covenant_headroom_turns).toFixed(1)}× to breach` : "—"}
                </span>
              </div>
              <div className="py-2 flex flex-col gap-1">
                <span className="text-caos-muted font-sans text-caos-xs uppercase">Structure</span>
                <span className="text-caos-text text-right truncate" title={signals.covenant_structure as string}>
                  {signals.covenant_structure as string || "—"}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-caos-muted font-sans text-caos-xs uppercase">Liquidity Runway</span>
                <span className="text-caos-text font-bold">
                  {signals.runway_months != null ? `${signals.runway_months} months` : "—"}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-caos-muted font-sans text-caos-xs uppercase">Governance Risk</span>
                <span className="text-caos-text font-bold">
                  {typeof (sponsor as { governance_risk_score?: number }).governance_risk_score === "number"
                    ? `Score ${(sponsor as { governance_risk_score: number }).governance_risk_score}`
                    : "—"}
                </span>
              </div>
            </div>
          </Panel>

          {/* Sponsor Ownership & Business Facts */}
          <Panel title="Ownership & Business Facts">
            <div className="p-2 flex flex-col gap-2">
              {factsByCode(["ownership", "transaction"]).slice(0, 2).map((f, i) => (
                <div key={i} className="text-caos-xs border border-caos-border/40 rounded p-2 bg-caos-bg">
                  <p className="m-0 text-caos-text/90 leading-snug">{f.statement}</p>
                  <div className="flex justify-between items-center mt-1 text-caos-2xs text-caos-muted">
                    <span>{f.fact_area}</span>
                    {f.chunk_id ? <Link href={deepHref + "&mod=CP-1A"} className="no-underline text-caos-accent">▸ src</Link> : null}
                  </div>
                </div>
              ))}
              {sponsorLedger.length ? (
                <div className="flex flex-col gap-1 pt-1 border-t border-caos-border/40">
                  {sponsorLedger.slice(0, 2).map((fl, i) => (
                    <span key={i} className="flex items-center gap-1.5 font-mono text-caos-2xs" style={{ color: sevSurface("warning").color }}>
                      <StatusGlyph kind="warning" size={9} /> {fl.flag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </Panel>

          {/* Coverage & Audit Gaps */}
          <Panel title="Audit & Coverage Status">
            <div className="px-3 py-2 text-caos-sm divide-y divide-caos-border/30 font-mono">
              <div className="py-2 flex justify-between">
                <span className="text-caos-muted font-sans text-caos-xs uppercase">Readiness</span>
                <span className="text-caos-text font-bold">
                  {coverage.readiness_score != null ? `${Math.round(Number(coverage.readiness_score) * 100)}%` : "—"}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-caos-muted font-sans text-caos-xs uppercase">Documents</span>
                <span className="text-caos-text font-bold">{Number(coverage.documents) || 0} loaded</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-caos-muted font-sans text-caos-xs uppercase">EDGAR XBRL</span>
                <span className="text-caos-text font-bold">{coverage.edgar_available ? "Available" : "No"}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-caos-muted font-sans text-caos-xs uppercase">QA Findings</span>
                <span className="font-bold" style={{ color: totalFindings > 0 ? "var(--caos-warning)" : undefined }}>
                  {totalFindings ? `${totalFindings} open` : "None"}
                </span>
              </div>
            </div>
          </Panel>
        </div>

        {/* Run Audit Ledger */}
        <Panel title={`Historical Audit Log · ${runs.length} Runs`}>
          {runs.length === 0 ? (
            <Empty>No run history ledger entries.</Empty>
          ) : (
            <div className="text-caos-md overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-caos-sm">
                <thead>
                  <tr className="border-b border-caos-border bg-caos-panel">
                    <th className="py-1 px-3 text-caos-2xs uppercase tracking-wider text-caos-muted">Date</th>
                    <th className="py-1 px-3 text-caos-2xs uppercase tracking-wider text-caos-muted">Run Status</th>
                    <th className="py-1 px-3 text-caos-2xs uppercase tracking-wider text-caos-muted">QA Verification</th>
                    <th className="py-1 px-3 text-caos-2xs uppercase tracking-wider text-caos-muted">Committee Review</th>
                    <th className="py-1 px-3 text-caos-2xs uppercase tracking-wider text-caos-muted">Analyst ID</th>
                    <th className="py-1 px-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-caos-border/40">
                  {runs.map((r) => {
                    const date = r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : "—";
                    return (
                      <tr key={r.id} className="hover:bg-caos-elevated/60 transition-caos group">
                        <td className="py-1.5 px-3 text-caos-muted">{date}</td>
                        <td className="py-1.5 px-3">
                          <Tag sev={RUN_SEV[r.status] ?? "low"}>{r.status}</Tag>
                        </td>
                        <td className="py-1.5 px-3 text-caos-text">{r.qa_status}</td>
                        <td className="py-1.5 px-3 text-caos-text">{r.committee_status}</td>
                        <td className="py-1.5 px-3 text-caos-muted truncate max-w-[120px]">{r.analyst_id || "—"}</td>
                        <td className="py-1.5 px-3 text-right">
                          <Link href={deepHref + "&run=" + encodeURIComponent(r.id)} className="no-underline text-caos-accent font-sans text-caos-xs">
                            OPEN →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    );
  };

  // ─── Unified Workspace Layout ──────────────────────────────────────────────
  const renderUnified = () => {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2 items-start">
        {/* Column 1: Financials & Trends (40%) */}
        <div className="flex flex-col gap-2">
          <Panel
            title={"Credit snapshot" + (latest_run?.as_of_date ? " · as of " + latest_run.as_of_date : "")}
            right={snapshotProv ? <Tag sev={PROV[snapshotProv].sev}>{PROV[snapshotProv].label}</Tag> : null}
          >
            {headline.length === 0 ? (
              <div className="px-3 py-2.5"><Empty>No headline metrics yet — run an analysis to populate the snapshot.</Empty></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3">
                {/* Credit Ratings Tile */}
                <div className="px-3 py-2 border-b border-r border-caos-border/40 flex flex-col justify-between" title="Issuer credit ratings from major rating agencies (S&P, Moody's, Fitch)">
                  <div>
                    <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Credit Ratings</div>
                    <div className="flex flex-col gap-0.5 mt-1">
                      {ratings.length ? (
                        <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-caos-text font-mono font-semibold text-xs mt-1">
                          {ratings.map((r) => (
                            <span key={r.ag} className="border border-caos-border/40 rounded px-1.5 py-0.5 bg-caos-bg">
                              <span className="text-caos-muted">{r.ag.substring(0, 3)}</span> <span className="text-caos-accent font-bold">{r.v}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="tabular text-caos-muted text-xs">No ratings</span>
                      )}
                    </div>
                  </div>
                  <div className="tabular text-[9px] text-caos-muted mt-1 uppercase tracking-wider">Agency assessment</div>
                </div>

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
                    <div key={m.metric_key} className="px-3 py-2 border-b border-r border-caos-border/40" title={METRIC_TOOLTIP[m.metric_key] || ""}>
                      <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{METRIC_LABEL[m.metric_key] || m.metric_key}</div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="tabular font-medium leading-none" style={{ fontSize: 16, color: sev ? sevSurface(sev).color : "var(--caos-text)" }}>{fmt(m.value, m.unit)}</span>
                        {d && delta != null && deltaSev ? <span className="tabular text-caos-2xs" style={{ color: sevSurface(deltaSev).color }}>{signed(delta, d.suffix, d.digits)}</span> : null}
                        {d?.showMissing && delta == null ? <span className="tabular text-caos-2xs text-caos-muted">no prior</span> : null}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="tabular text-caos-2xs text-caos-muted truncate">{m.period}</span>
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

          <Panel
            title="Financial & credit trend"
            right={fyCharts.length || qCharts.length
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
        </div>

        {/* Column 2: Business & Narrative (30%) */}
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
              <SigBand label="Relative value" v={signals.recommendation} extra={signals.composite_percentile != null ? `${signals.composite_percentile}th pct` : undefined} />
              <SigBand label="Downside fragility" v={signals.fragility}
                extra={signals.shock_to_breach_pct != null ? `breach @ −${signals.shock_to_breach_pct}% EBITDA` : undefined} />
              <SigBand label="Refi / LME risk" v={signals.lme_band}
                extra={signals.lme_score != null ? `score ${signals.lme_score}` : undefined} />
              <EmptyIfBlank ok={[signals.recommendation, signals.fragility, signals.lme_band]} latest={!!latest_run} />
            </div>
          </Panel>

          <AnalystNotesPanel issuerId={id} issuerName={issuer.name} ticker={issuer.ticker} />
        </div>

        {/* Column 3: Audit, Protection & History (30%) */}
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
              <Empty>No runs yet.</Empty>
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
  };

  return (
    <div className={`${isOverlay ? "h-full" : "h-screen"} flex flex-col bg-caos-bg text-caos-text`}>
      {/* consolidated sub-header */}
      <div className="h-12 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-3 px-4">
        {!isOverlay ? (
          <>
            <Link href="/issuers" className="no-underline flex items-center gap-2 group shrink-0" aria-label="Back to issuer directory">
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
        <div className="flex items-center gap-2 overflow-hidden mr-2 shrink-0">
          <span className="tabular text-caos-accent font-semibold leading-none tracking-tight shrink-0" style={{ fontSize: 16 }}>{issuer.ticker?.toUpperCase() || "—"}</span>
          <span className="text-caos-text font-medium leading-none truncate shrink-0 max-w-[130px]" style={{ fontSize: 14 }} title={issuer.name}>{issuer.name}</span>
          <span className="text-caos-muted truncate text-caos-xs shrink-0 max-w-[110px]" style={{ fontSize: 11 }}>
            {[issuerSector(issuer), issuer.country].filter(Boolean).join(" · ")}
          </span>
          {ratings.length ? (
            <span className="flex items-center gap-1 shrink-0">
              {ratings.slice(0, 2).map((r) => (
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
                <span title={STATUS_TOOLTIP[String(signals.recommendation)] || ""}>
                  <Tag sev={bandSev(signals.recommendation)}>{String(signals.recommendation)}</Tag>
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
            <ConceptNav />
            <div className="h-4 w-px bg-caos-border shrink-0" />
          </>
        )}

        {/* Layout Switcher */}
        <ToggleGroup
          options={[
            { k: "unified" as const, l: "Unified Workspace" },
            { k: "bloomberg" as const, l: "Bloomberg Classic" },
          ]}
          value={layout}
          onChange={setLayout}
          size="sm"
        />

        <div className="h-4 w-px bg-caos-border shrink-0" />
        <Link href={deepHref} className="no-underline tabular text-caos-xs px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos whitespace-nowrap shrink-0">
          OPEN DEEP-DIVE →
        </Link>
        {isOverlay && onClose && (
          <>
            <div className="h-4 w-px bg-caos-border shrink-0" />
            <CloseButton onClick={onClose} title="Close (Esc)" />
          </>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-2 pb-16 flex flex-col gap-2">
        {/* Dynamic Layout Rendering */}
        {layout === "unified" ? renderUnified() : renderBloomberg()}
      </div>

      {/* Floating Action Dock (Centered, non-clashing with bottom-left search and bottom-right ask widgets) */}
      <div 
        className={`${isOverlay ? "absolute" : "fixed"} bottom-3 left-1/2 -translate-x-1/2 z-overlay bg-caos-panel/90 border border-caos-border rounded-md px-3 py-1.5 flex items-center gap-2 shadow-lg backdrop-blur-sm shrink-0`}
        style={{ boxShadow: "0 12px 40px -12px rgba(0,0,0,0.85)" }}
      >
        <Action href={deepHref} primary>Open Deep-Dive</Action>
        <Action href={"/pipeline?issuer=" + encodeURIComponent(id)}>Run / re-run analysis</Action>
        <Action href={"/model?issuer=" + encodeURIComponent(id)}>Model Builder</Action>
        <Action href={"/reports?issuer=" + encodeURIComponent(id)}>Report Studio</Action>
        <Action href={"/upload?issuer=" + encodeURIComponent(id)}>Upload documents</Action>
        <div className="h-4 w-px bg-caos-border/50 mx-1" />
        <span className="text-[10px] text-caos-muted font-mono uppercase tracking-wider whitespace-nowrap pr-1">
          Alt+L · Alt+G
        </span>
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
            <span>Couldn&apos;t load analyst notes - {error}</span>
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
                    <a href={note.url} className="shrink-0 no-underline tabular text-caos-2xs text-caos-accent hover:text-caos-text transition-caos">
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
