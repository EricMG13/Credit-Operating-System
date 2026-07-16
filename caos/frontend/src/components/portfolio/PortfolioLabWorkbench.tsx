"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SemanticVisualization, type VisualizationSpec } from "@/components/charts/SemanticVisualization";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { ActionReason } from "@/components/shared/ActionReason";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { useRoleView } from "@/components/shared/RoleViewProvider";
import {
  analysisApi,
  type InsightArtifact,
  useAnalysisContext,
} from "@/lib/analysis-workbench";
import { getPortfolios, toErrorMessage, type PortfolioSummary } from "@/lib/api";
import {
  PORTFOLIO_SORTS,
  portfolioLabApi,
  type PortfolioAnalytics,
  type PortfolioConstraint,
  type PortfolioPosition,
  type PortfolioPositionPage,
  type PortfolioPositionSort,
  type StressRun,
} from "@/lib/portfolio-lab";
import { useTypedUrlState } from "@/lib/typed-url-state";

const URL_KEYS = [
  "portfolio", "dataset", "sort", "direction", "text", "sector", "rating",
  "ranking", "cursor", "selected", "chart", "stress", "context",
] as const;

type DatasetMode = "positions" | "constraints";
type ChartMode = "concentration" | "ratings" | "maturity" | "risk" | "stress";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function numberText(value: number | null | undefined, suffix = "") {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toLocaleString()}${suffix}`;
}

function sourceIds(analytics: PortfolioAnalytics) {
  return analytics.authority.source_ids;
}

export function createPortfolioVisualizationSpec(
  mode: ChartMode,
  analytics: PortfolioAnalytics,
): VisualizationSpec {
  const common = {
    asOf: analytics.as_of ?? undefined,
    sourceIds: sourceIds(analytics),
  };
  if (mode === "ratings") {
    const data = Object.entries(analytics.rating_distribution).map(([rating, value]) => ({ rating, value }));
    return {
      ...common,
      kind: "bar",
      title: "Rating distribution",
      unit: "% NAV",
      accessibleSummary: data.length
        ? `${data[0].rating} is the first reported rating bucket at ${numberText(data[0].value, "%")}.`
        : "No rating distribution is available.",
      data,
      tabularFallback: { label: "Rating distribution data", columns: [{ key: "rating", label: "Rating" }, { key: "value", label: "% NAV" }], data },
      chart: { type: "interval", encode: { x: "rating", y: "value" } },
    };
  }
  if (mode === "maturity") {
    const data = Object.entries(analytics.maturity_wall).map(([year, value]) => ({ year, value }));
    return {
      ...common,
      kind: "maturity-wall",
      title: "Maturity wall",
      unit: "USD",
      accessibleSummary: data.length
        ? `${data[0].year} is the first reported maturity year with ${data[0].value == null ? "unavailable exposure" : money.format(data[0].value)}.`
        : "No maturity schedule is available.",
      data,
      tabularFallback: { label: "Maturity wall data", columns: [{ key: "year", label: "Year" }, { key: "value", label: "Market value" }], data },
      chart: { type: "interval", encode: { x: "year", y: "value" } },
    };
  }
  if (mode === "risk") {
    const data = analytics.risk_budget.headroom.map((row) => ({
      code: row.code ?? "Unknown",
      headroom: row.headroom,
      status: row.status,
    }));
    return {
      ...common,
      kind: "bullet",
      title: "Risk-budget headroom",
      unit: "limit units",
      accessibleSummary: `${analytics.risk_budget.status_counts.Breach ?? 0} breached and ${analytics.risk_budget.status_counts.Watch ?? 0} watched constraints are reported.`,
      status: (analytics.risk_budget.status_counts.Breach ?? 0) > 0
        ? { label: "Breach present", tone: "critical" }
        : { label: "Within limits", tone: "success" },
      data,
      tabularFallback: { label: "Risk-budget headroom data", columns: [{ key: "code", label: "Constraint" }, { key: "headroom", label: "Headroom" }, { key: "status", label: "Status" }], data },
      chart: { type: "interval", encode: { x: "code", y: "headroom", color: "status" } },
    };
  }
  if (mode === "stress") {
    const data = (analytics.latest_stress_runs ?? []).map((run) => ({
      scenario: run.label,
      loss: run.loss_percent,
      status: run.status,
    }));
    return {
      ...common,
      kind: "heatmap",
      title: "Stress history",
      unit: "% NAV loss",
      accessibleSummary: data.length
        ? `${data.length} persisted stress snapshots are available; latest is ${data[0].scenario}.`
        : "No persisted stress snapshot is available.",
      data,
      tabularFallback: { label: "Stress history data", columns: [{ key: "scenario", label: "Scenario" }, { key: "loss", label: "Loss" }, { key: "status", label: "Status" }], data },
      chart: { type: "cell", encode: { x: "scenario", y: "status", color: "loss" } },
    };
  }
  const data = analytics.concentration.sectors.map((row) => ({
    sector: row.sector,
    value: row.pct_nav,
    obligors: row.n_obligors,
  }));
  const lead = data[0];
  return {
    ...common,
    kind: "bar",
    title: "Sector concentration",
    unit: "% NAV",
    accessibleSummary: lead
      ? `${lead.sector} is the largest reported sector at ${numberText(lead.value, "%")} across ${lead.obligors} obligor${lead.obligors === 1 ? "" : "s"}.`
      : "No sector concentration is available.",
    data,
    tabularFallback: { label: "Sector concentration data", columns: [{ key: "sector", label: "Sector" }, { key: "value", label: "% NAV" }, { key: "obligors", label: "Obligors" }], data },
    chart: { type: "interval", coordinate: { transform: [{ type: "transpose" }] }, encode: { x: "sector", y: "value" } },
  };
}

export function PortfolioInsightCard({ insight, onRatify }: { insight: InsightArtifact; onRatify?: () => void }) {
  return (
    <article className="portfolio-lab__insight" aria-label="Portfolio advisory insight">
      <header>
        <span className="portfolio-lab__eyebrow">Advisory synthesis</span>
        <span className="portfolio-lab__status" data-status={insight.status}>
          <span aria-hidden="true">●</span> <span>{insight.status}</span>
        </span>
      </header>
      <p>{insight.summary}</p>
      {insight.claims.map((claim) => (
        <div key={claim.id} className="portfolio-lab__claim">
          <strong>{claim.statement}</strong>
          <ul aria-label="Claim evidence">{claim.evidence_ids.map((id) => <li key={id}>{id}</li>)}</ul>
        </div>
      ))}
      {insight.status === "ready" && onRatify ? <button type="button" onClick={onRatify}>Ratify cited brief</button> : null}
      <small>AI interpretation is cited and advisory; deterministic portfolio calculations remain authoritative.</small>
    </article>
  );
}

function PositionsTable({
  page,
  selectedId,
  onSelect,
}: {
  page: PortfolioPositionPage;
  selectedId: string | null;
  onSelect: (position: PortfolioPosition) => void;
}) {
  return (
    <div className="portfolio-lab__table-scroll">
      <table aria-label="Portfolio positions">
        <thead><tr><th scope="col">Borrower</th><th scope="col">Instrument</th><th scope="col">Sector</th><th scope="col">Rating</th><th scope="col">Par</th><th scope="col">Price</th><th scope="col">Maturity</th></tr></thead>
        <tbody>
          {page.items.map((position) => (
            <tr key={position.id} className={page.total > 50 ? "portfolio-lab__virtual-row" : undefined} data-selected={selectedId === position.id}>
              <th scope="row">
                <div className="flex items-center gap-2">
                  {position.issuer_id ? <IssuerLink issuer={{ id: position.issuer_id }}>{position.borrower_name}</IssuerLink> : position.borrower_name}
                  <button type="button" onClick={() => onSelect(position)} aria-label={`Select ${position.borrower_name}`} aria-pressed={selectedId === position.id}>Inspect</button>
                </div>
              </th>
              <td>{position.loan_name ?? position.ticker ?? "—"}</td><td>{position.sector ?? "—"}</td>
              <td>{position.rating_moody ?? position.rating_sp ?? "—"}</td><td>{position.par_usd == null ? "—" : money.format(position.par_usd)}</td>
              <td>{numberText(position.price)}</td><td>{position.maturity ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConstraintsTable({ rows }: { rows: PortfolioConstraint[] }) {
  return (
    <div className="portfolio-lab__table-scroll">
      <table aria-label="Portfolio constraints">
        <thead><tr><th scope="col">Constraint</th><th scope="col">Limit</th><th scope="col">Current</th><th scope="col">Headroom</th><th scope="col">Status</th></tr></thead>
        <tbody>{rows.map((row, index) => <tr key={`${row.code ?? "constraint"}-${index}`}><th scope="row">{row.parameter ?? row.code ?? "Unnamed"}</th><td>{row.limit_text ?? "—"}</td><td>{numberText(row.current)}</td><td>{numberText(row.headroom)}</td><td><span className="portfolio-lab__status" data-status={row.status.toLowerCase()}>● {row.status}</span></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function LoadingTable() {
  return <div className="portfolio-lab__empty" role="status">Loading portfolio data…</div>;
}

export function PortfolioLabWorkbench() {
  const { roleView } = useRoleView();
  const analysis = useAnalysisContext({ name: "Portfolio Lab" });
  const { values, update } = useTypedUrlState(URL_KEYS);
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [positions, setPositions] = useState<PortfolioPositionPage | null>(null);
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [stressRuns, setStressRuns] = useState<StressRun[]>([]);
  const [insight, setInsight] = useState<InsightArtifact | null>(null);
  const [refreshInsight, setRefreshInsight] = useState<InsightArtifact | null>(null);
  const [portfolioListLoaded, setPortfolioListLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolioListError, setPortfolioListError] = useState<string | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [stressError, setStressError] = useState<string | null>(null);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [stressPreview, setStressPreview] = useState(false);
  const [stressPending, setStressPending] = useState(false);
  const [filterDraft, setFilterDraft] = useState(() => ({
    text: values.text ?? "",
    sector: values.sector ?? "",
    rating: values.rating ?? "",
  }));

  const requestedPortfolioId = values.portfolio;
  const portfolioId = requestedPortfolioId && (!portfolioListLoaded || portfolios.some((row) => row.id === requestedPortfolioId))
    ? requestedPortfolioId
    : portfolios[0]?.id ?? null;
  const dataset: DatasetMode = values.dataset === "constraints" ? "constraints" : "positions";
  const chart: ChartMode = ["ratings", "maturity", "risk", "stress"].includes(values.chart ?? "")
    ? values.chart as ChartMode
    : "concentration";
  const selectedPosition = positions?.items.find((row) => row.id === values.selected) ?? null;
  const sort: PortfolioPositionSort = PORTFOLIO_SORTS.includes(values.sort as PortfolioPositionSort)
    ? values.sort as PortfolioPositionSort
    : "borrower_name";
  const selectedStress = stressRuns.find((run) => run.id === values.stress) ?? stressRuns[0] ?? null;

  useEffect(() => {
    setFilterDraft({ text: values.text ?? "", sector: values.sector ?? "", rating: values.rating ?? "" });
  }, [values.rating, values.sector, values.text]);

  useEffect(() => {
    let alive = true;
    getPortfolios().then((rows) => {
      if (!alive) return;
      setPortfolios(rows);
      if (!new URL(window.location.href).searchParams.get("portfolio") && rows[0]) {
        update({ portfolio: rows[0].id }, "replace");
      }
      if (rows.length === 0) setLoading(false);
    }).catch((reason) => {
      if (!alive) return;
      const message = toErrorMessage(reason, "Portfolio list unavailable.");
      setPortfolioListError(message);
      setError(message);
      setLoading(false);
    }).finally(() => alive && setPortfolioListLoaded(true));
    return () => { alive = false; };
  }, [update]);

  useEffect(() => {
    if (!portfolioId) {
      if (portfolioListLoaded) setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    setPositions(null);
    portfolioLabApi.getPositions(portfolioId, {
      cursor: values.cursor ?? undefined,
      sort,
      direction: values.direction === "desc" ? "desc" : "asc",
      text: values.text ?? undefined,
      sector: values.sector ?? undefined,
      rating: values.rating ?? undefined,
      ranking: values.ranking ?? undefined,
      limit: 100,
    }).then((positionPage) => {
      if (alive) setPositions(positionPage);
    }).catch((reason) => {
      if (alive) setError(toErrorMessage(reason, "Portfolio positions unavailable."));
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [portfolioId, portfolioListLoaded, sort, values.cursor, values.direction, values.ranking, values.rating, values.sector, values.text]);

  useEffect(() => {
    if (!portfolioId) return;
    let alive = true;
    setSupportError(null);
    setAnalyticsError(null);
    setStressError(null);
    setInsightError(null);
    setAnalytics(null);
    setStressRuns([]);
    setInsight(null);
    setRefreshInsight(null);
    Promise.allSettled([
      portfolioLabApi.getAnalytics(portfolioId),
      portfolioLabApi.listStressRuns(portfolioId),
      analysis.context?.id
        ? analysisApi.listInsights(analysis.context.id, { surface: "portfolio-lab", kind: "portfolio-brief", limit: 20 })
        : Promise.resolve({ items: [], current: null, next_cursor: null }),
    ]).then(([analyticsResult, stressResult, insightResult]) => {
      if (!alive) return;
      const failures: string[] = [];
      if (analyticsResult.status === "fulfilled") setAnalytics(analyticsResult.value);
      else { const message = toErrorMessage(analyticsResult.reason, "Analytics unavailable."); setAnalyticsError(message); failures.push(message); }
      if (stressResult.status === "fulfilled") setStressRuns(stressResult.value.items);
      else { const message = toErrorMessage(stressResult.reason, "Stress history unavailable."); setStressError(message); failures.push(message); }
      if (insightResult.status === "fulfilled") setInsight(insightResult.value.current);
      else { const message = toErrorMessage(insightResult.reason, "Cited brief unavailable."); setInsightError(message); failures.push(message); }
      setSupportError(failures.length ? failures.join(" ") : null);
    });
    return () => { alive = false; };
  }, [analysis.context?.id, portfolioId]);

  const portfolio = portfolios.find((row) => row.id === portfolioId) ?? null;
  const visualizationAnalytics = useMemo(() => analytics ? {
    ...analytics,
    latest_stress_runs: stressRuns.map((run) => ({
      id: run.id,
      label: run.label,
      status: run.status,
      source_fingerprint: run.source_fingerprint,
      base_nav: run.output.base_nav,
      stressed_nav: run.output.stressed_nav,
      loss_amount: run.output.loss_amount,
      loss_percent: run.output.loss_percent,
      created_at: run.created_at,
    })),
  } : null, [analytics, stressRuns]);
  const chartSpec = useMemo(() => visualizationAnalytics ? createPortfolioVisualizationSpec(chart, visualizationAnalytics) : null, [chart, visualizationAnalytics]);
  const displayedInsight = insight ?? refreshInsight;

  const persistStress = async () => {
    if (!portfolioId) return;
    setStressPending(true);
    try {
      const created = await portfolioLabApi.createStressRun(portfolioId, {
        label: "Base downside",
        book_price_shock_pct: -8,
        sector_shock_pcts: {},
      });
      setStressRuns((current) => [created, ...current]);
      update({ stress: created.id, chart: "stress" });
      setStressPreview(false);
    } catch (reason) {
      setError(toErrorMessage(reason, "Stress run failed."));
    } finally {
      setStressPending(false);
    }
  };

  const generateInsight = async () => {
    if (!analysis.context?.id || !portfolioId) return;
    try {
      const created = await analysisApi.createInsight(analysis.context.id, {
        surface: "portfolio-lab",
        kind: "portfolio-brief",
        subject_refs: { portfolio_id: portfolioId },
        force: Boolean(insight),
      });
      if (created.status === "ready" || created.status === "ratified") {
        setInsight(created);
        setRefreshInsight(null);
      } else {
        setRefreshInsight(created);
      }
    } catch (reason) {
      setError(toErrorMessage(reason, "Portfolio insight unavailable."));
    }
  };

  const decision = (
    <header className="portfolio-lab__decision-header">
      <div><span className="portfolio-lab__eyebrow">{roleView === "pm" ? "Portfolio posture" : roleView === "qa" ? "Evidence & compliance" : "Sizing workbench"}</span><h1>{portfolio?.name ?? "Portfolio Lab"}</h1></div>
      <dl><div><dt>As of</dt><dd>{analytics?.as_of ?? portfolio?.as_of_date ?? "Unavailable"}</dd></div><div><dt>Positions</dt><dd>{positions?.total ?? portfolio?.n_positions ?? "—"}</dd></div><div><dt>Authority</dt><dd>{!portfolioId ? "No portfolio" : analytics?.authority.approval_state ?? (analyticsError ? "Unavailable" : "Loading")}</dd></div></dl>
    </header>
  );

  const primary = (
    <section className="portfolio-lab__primary" aria-label="Portfolio working set">
      <div className="portfolio-lab__toolbar">
        <div role="tablist" aria-label="Portfolio datasets" onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const next = dataset === "positions" ? "constraints" : "positions";
          update({ dataset: next, cursor: null });
          requestAnimationFrame(() => document.getElementById(`portfolio-tab-${next}`)?.focus());
        }}>
          <button id="portfolio-tab-positions" type="button" role="tab" aria-controls="portfolio-dataset-panel" aria-selected={dataset === "positions"} tabIndex={dataset === "positions" ? 0 : -1} onClick={() => update({ dataset: "positions", cursor: null })}>Positions</button>
          <button id="portfolio-tab-constraints" type="button" role="tab" aria-controls="portfolio-dataset-panel" aria-selected={dataset === "constraints"} tabIndex={dataset === "constraints" ? 0 : -1} onClick={() => update({ dataset: "constraints", cursor: null })}>Constraints</button>
        </div>
        <label>Portfolio<select value={portfolioId ?? ""} onChange={(event) => update({ portfolio: event.target.value, cursor: null, selected: null })}>{portfolios.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        {dataset === "positions" ? <form className="portfolio-lab__filters" onSubmit={(event) => {
          event.preventDefault();
          update({ text: filterDraft.text || null, sector: filterDraft.sector || null, rating: filterDraft.rating || null, cursor: null });
        }}>
          <label>Search<input value={filterDraft.text} onChange={(event) => setFilterDraft((current) => ({ ...current, text: event.target.value }))} /></label>
          <label>Sector<input value={filterDraft.sector} onChange={(event) => setFilterDraft((current) => ({ ...current, sector: event.target.value }))} /></label>
          <label>Rating<input value={filterDraft.rating} onChange={(event) => setFilterDraft((current) => ({ ...current, rating: event.target.value }))} /></label>
          <label>Sort<select value={sort} onChange={(event) => update({ sort: event.target.value, cursor: null })}><option value="borrower_name">Borrower</option><option value="par_usd">Par</option><option value="price">Price</option><option value="maturity">Maturity</option><option value="rating_moody">Moody&apos;s</option></select></label>
          <button type="button" aria-label={`Sort ${values.direction === "desc" ? "ascending" : "descending"}`} onClick={() => update({ direction: values.direction === "desc" ? "asc" : "desc", cursor: null })}>{values.direction === "desc" ? "DESC ↓" : "ASC ↑"}</button>
          <button type="submit">APPLY</button>
        </form> : null}
      </div>
      <div id="portfolio-dataset-panel" role="tabpanel" aria-labelledby={`portfolio-tab-${dataset}`}>
        <DominantTableRegion ownerId="portfolio-lab-main" label={`${dataset === "positions" ? "Portfolio positions" : "Portfolio constraints"} table`} data-total-rows={dataset === "positions" ? positions?.total : analytics?.compliance.length}>
          {!portfolioId && portfolioListError ? <div className="portfolio-lab__empty" role="alert">{portfolioListError}</div> : !portfolioId && portfolioListLoaded ? <div className="portfolio-lab__empty">No portfolios are configured. <Link href="/settings?tab=portfolios" className="text-caos-accent underline focus-ring">Create or import one in Settings</Link>.</div> : loading && !positions ? <LoadingTable /> : error && !positions ? <div className="portfolio-lab__empty" role="alert">{error}</div> : dataset === "positions" && positions?.items.length ? <PositionsTable page={positions} selectedId={values.selected} onSelect={(row) => update({ selected: row.id })} /> : dataset === "positions" && positions ? <div className="portfolio-lab__empty" role="status">No positions match the active filters.</div> : analytics?.compliance.length ? <ConstraintsTable rows={analytics.compliance} /> : analytics ? <div className="portfolio-lab__empty" role="status">No portfolio constraints are configured.</div> : supportError ? <div className="portfolio-lab__empty" role="status">Constraint analytics unavailable. Positions remain accessible.</div> : <LoadingTable />}
        </DominantTableRegion>
      </div>
      {dataset === "positions" && positions?.next_cursor ? <button type="button" className="portfolio-lab__next" onClick={() => update({ cursor: positions.next_cursor, selected: null })}>Next positions</button> : null}
    </section>
  );

  const context = (
    <section className="portfolio-lab__context" aria-label="Portfolio visualization">
      <label>View<select value={chart} onChange={(event) => update({ chart: event.target.value as ChartMode })}><option value="concentration">Concentration</option><option value="ratings">Ratings</option><option value="maturity">Maturity wall</option><option value="risk">Risk budget</option><option value="stress">Stress history</option></select></label>
      {!portfolioId ? <p role="status">No portfolio selected — analytics unavailable.</p> : chartSpec ? <SemanticVisualization spec={chartSpec} /> : analyticsError ? <p role="status">{analyticsError} The positions workflow remains live.</p> : <p role="status">Loading portfolio analytics…</p>}
    </section>
  );

  const inspector = (
    <aside className="portfolio-lab__inspector" aria-label="Portfolio evidence inspector">
      <h2>{selectedPosition?.borrower_name ?? "Evidence Atlas"}</h2>
      {selectedPosition ? <dl><div><dt>Instrument</dt><dd>{selectedPosition.loan_name ?? selectedPosition.ticker ?? "—"}</dd></div><div><dt>Market value</dt><dd>{selectedPosition.market_value == null ? "—" : money.format(selectedPosition.market_value)}</dd></div><div><dt>Source</dt><dd>{positions?.authority.source_ids.length ? positions.authority.source_ids.join(", ") : "Source identifier unavailable"}</dd></div></dl> : <p>Select a position to inspect its sizing and source lineage.</p>}
      {selectedPosition?.issuer_id ? <Link href={`/issuers/profile?id=${encodeURIComponent(selectedPosition.issuer_id)}&context=${encodeURIComponent(analysis.context?.id ?? "")}`}>Open issuer profile</Link> : null}
      {analytics?.missing_dependencies.length ? <><h3>Missing dependencies</h3><ul>{analytics.missing_dependencies.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
      <div className="portfolio-lab__insight-actions"><ActionReason reason={portfolioId ? null : "Create or open a portfolio first"} onClick={() => void generateInsight()}>{insight ? "Refresh cited brief" : "Generate cited brief"}</ActionReason></div>
      {refreshInsight && insight ? <p role="status">Latest refresh is {refreshInsight.status}; the last ready or ratified brief remains effective.</p> : null}
      {displayedInsight ? <PortfolioInsightCard insight={displayedInsight} onRatify={displayedInsight.status === "ready" ? () => {
        const candidate = displayedInsight;
        void analysisApi.ratifyInsight(candidate.id).then((ratified) => { setInsight(ratified); setRefreshInsight(null); }).catch((reason) => setError(toErrorMessage(reason, "Insight ratification failed.")));
      } : undefined} /> : insightError ? <p role="status">{insightError}</p> : <p>No cited advisory brief has been generated.</p>}
    </aside>
  );

  const utility = (
    <section className="portfolio-lab__stress" aria-label="Deterministic stress controls">
      <header><div><span className="portfolio-lab__eyebrow">Deterministic scenario</span><h2>Base downside</h2></div><ActionReason reason={portfolioId ? null : "Create or open a portfolio first"} reasonDisplay="hidden" onClick={() => setStressPreview(true)}>Preview stress</ActionReason></header>
      {stressPreview ? <div className="portfolio-lab__stress-preview"><strong>Preview only</strong><p>Apply an 8% book price decline. Holdings and limits will not be changed.</p><button type="button" disabled={stressPending} onClick={() => void persistStress()}>{stressPending ? "Persisting…" : "Confirm and persist"}</button></div> : null}
      {stressRuns.length ? <ol className="portfolio-lab__timeline" aria-label="Persisted stress history">{stressRuns.map((run) => <li key={run.id} data-selected={selectedStress?.id === run.id}><button type="button" aria-pressed={selectedStress?.id === run.id} onClick={() => update({ stress: run.id, chart: "stress" })}>{run.label}</button><span>{numberText(run.output.loss_percent, "% loss")}</span><code>{run.source_fingerprint}</code></li>)}</ol> : stressError ? <p role="status">{stressError}</p> : <p>No persisted stress snapshots.</p>}
      {selectedStress ? <article className="portfolio-lab__stress-result" aria-label="Selected stress result"><h3>{selectedStress.label} result</h3><dl><div><dt>Base NAV</dt><dd>{selectedStress.output.base_nav == null ? "—" : money.format(selectedStress.output.base_nav)}</dd></div><div><dt>Stressed NAV</dt><dd>{selectedStress.output.stressed_nav == null ? "—" : money.format(selectedStress.output.stressed_nav)}</dd></div><div><dt>Loss</dt><dd>{numberText(selectedStress.output.loss_percent, "%")}</dd></div><div><dt>Authority</dt><dd>{selectedStress.authority.approval_state} · {selectedStress.authority.method}</dd></div></dl>{selectedStress.output.missing_dependencies.length ? <><h4>Missing dependencies</h4><ul>{selectedStress.output.missing_dependencies.map((item) => <li key={item}>{item}</li>)}</ul></> : null}</article> : null}
    </section>
  );

  return (
    <EnterprisePage
      kind="analytical"
      identity={<ShellIdentity tag="CP-PORT" title="Portfolio Lab" />}
      status={error ? <span role="alert">{error}</span> : <span>{portfolio ? portfolio.kind : <span className="text-caos-muted">No portfolio selected</span>}</span>}
      primaryAction={<ActionReason className="caos-action-primary focus-ring" reason={portfolioId ? null : "Create or open a portfolio first"} reasonDisplay="hidden" onClick={() => setStressPreview(true)}>Run portfolio stress</ActionReason>}
      narrowContract={{ essentialControls: <span>{positions?.total ?? 0} positions</span> }}
    >
      <PersonaWorkbench surface="portfolio-lab" decision={decision} primary={primary} context={context} inspector={inspector} utility={utility} />
    </EnterprisePage>
  );
}
