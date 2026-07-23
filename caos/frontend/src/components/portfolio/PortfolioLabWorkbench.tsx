"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { VisualizationSpec } from "@/components/charts/SemanticVisualization";
import { PortfolioVisualization } from "@/components/portfolio/PortfolioVisualization";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { ActionReason } from "@/components/shared/ActionReason";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { useRoleView } from "@/components/shared/RoleViewProvider";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { SourceRef } from "@/components/ui/SourceRef";
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
import { useTypedUrlState, type TypedUrlUpdate, type TypedUrlValues } from "@/lib/typed-url-state";

const URL_KEYS = [
  "portfolio", "dataset", "sort", "direction", "text", "sector", "rating",
  "ranking", "cursor", "selected", "chart", "stress", "context",
] as const;

type DatasetMode = "positions" | "constraints";
type ChartMode = "concentration" | "ratings" | "maturity" | "risk" | "stress";
type PortfolioUrlKey = (typeof URL_KEYS)[number];
type PortfolioUrlUpdater = (changes: TypedUrlUpdate<PortfolioUrlKey>, mode?: "push" | "replace") => void;
type PortfolioUrlValues = TypedUrlValues<PortfolioUrlKey>;
type NullableErrorSetter = Dispatch<SetStateAction<string | null>>;

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

function visualizationCommon(analytics: PortfolioAnalytics) {
  return { asOf: analytics.as_of ?? undefined, sourceIds: sourceIds(analytics) };
}

function ratingVisualization(analytics: PortfolioAnalytics): VisualizationSpec {
  const data = Object.entries(analytics.rating_distribution).map(([rating, value]) => ({ rating, value }));
  return {
    ...visualizationCommon(analytics),
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

function maturityVisualization(analytics: PortfolioAnalytics): VisualizationSpec {
  const data = Object.entries(analytics.maturity_wall).map(([year, value]) => ({ year, value }));
  return {
    ...visualizationCommon(analytics),
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

function riskVisualization(analytics: PortfolioAnalytics): VisualizationSpec {
  const data = analytics.risk_budget.headroom.map((row) => ({
    code: row.code ?? "Unknown",
    headroom: row.headroom,
    status: row.status,
  }));
  const breached = (analytics.risk_budget.status_counts.Breach ?? 0) > 0;
  return {
    ...visualizationCommon(analytics),
    kind: "bullet",
    title: "Risk-budget headroom",
    unit: "limit units",
    accessibleSummary: `${analytics.risk_budget.status_counts.Breach ?? 0} breached and ${analytics.risk_budget.status_counts.Watch ?? 0} watched constraints are reported.`,
    status: breached ? { label: "Breach present", tone: "critical" } : { label: "Within limits", tone: "success" },
    data,
    tabularFallback: { label: "Risk-budget headroom data", columns: [{ key: "code", label: "Constraint" }, { key: "headroom", label: "Headroom" }, { key: "status", label: "Status" }], data },
    chart: { type: "interval", encode: { x: "code", y: "headroom", color: "status" } },
  };
}

function stressVisualization(analytics: PortfolioAnalytics): VisualizationSpec {
  const data = (analytics.latest_stress_runs ?? []).map((run) => ({
    scenario: run.label,
    loss: run.loss_percent,
    status: run.status,
  }));
  return {
    ...visualizationCommon(analytics),
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

function concentrationVisualization(analytics: PortfolioAnalytics): VisualizationSpec {
  const data = analytics.concentration.sectors.map((row) => ({
    sector: row.sector,
    value: row.pct_nav,
    obligors: row.n_obligors,
  }));
  const lead = data[0];
  return {
    ...visualizationCommon(analytics),
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

export function createPortfolioVisualizationSpec(
  mode: ChartMode,
  analytics: PortfolioAnalytics,
): VisualizationSpec {
  if (mode === "ratings") return ratingVisualization(analytics);
  if (mode === "maturity") return maturityVisualization(analytics);
  if (mode === "risk") return riskVisualization(analytics);
  if (mode === "stress") return stressVisualization(analytics);
  return concentrationVisualization(analytics);
}

export function PortfolioInsightCard({ insight, onRatify }: { insight: InsightArtifact; onRatify?: () => void }) {
  return (
    <article className="portfolio-lab__insight" aria-label="Portfolio advisory insight">
      <header>
        <span className="caos-panel-title text-caos-muted">Advisory synthesis</span>
        <span className="portfolio-lab__status" data-status={insight.status}>
          <span aria-hidden="true">●</span> <span>{insight.status}</span>
        </span>
      </header>
      <p>{insight.summary}</p>
      {insight.claims.map((claim) => (
        <div key={claim.id} className="portfolio-lab__claim">
          <strong>{claim.statement}</strong>
          <ul aria-label="Claim evidence">{claim.evidence_ids.length ? claim.evidence_ids.map((id) => <li key={id}><SourceRef source={{ state: "unavailable", reason: `Source ${id} has no persisted action.` }} /></li>) : <li><SourceRef source={{ state: "unavailable", reason: "No persisted source identifier for this claim." }} /></li>}</ul>
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
  const columns: DataTableColumn<PortfolioPosition>[] = [
    {
      key: "borrower",
      header: "Borrower",
      rowHeader: true,
      render: (position) => (
        <div className="flex items-center gap-2 font-semibold text-caos-text">
          <span>
            {position.issuer_id ? <IssuerLink issuer={{ id: position.issuer_id }}>{position.borrower_name}</IssuerLink> : position.borrower_name}
          </span>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onSelect(position); }}
            onKeyDown={(event) => event.stopPropagation()}
            aria-label={`Select ${position.borrower_name}`}
            aria-pressed={selectedId === position.id}
            className="focus-ring"
          >
            Inspect
          </button>
        </div>
      ),
    },
    { key: "instrument", header: "Instrument", render: (position) => position.loan_name ?? position.ticker ?? "—" },
    { key: "sector", header: "Sector", render: (position) => position.sector ?? "—" },
    { key: "rating", header: "Rating", render: (position) => position.rating_moody ?? position.rating_sp ?? "—" },
    { key: "par", header: "Par", align: "numeric", render: (position) => position.par_usd == null ? "—" : money.format(position.par_usd) },
    { key: "price", header: "Price", align: "numeric", render: (position) => numberText(position.price) },
    { key: "maturity", header: "Maturity", render: (position) => position.maturity ?? "—" },
  ];
  return (
    <div className="min-h-0 overflow-auto">
      <DataTable
        columns={columns}
        rows={page.items}
        getRowId={(position) => position.id}
        caption="Portfolio positions"
        selectedRowId={selectedId}
        onRowActivate={onSelect}
        rowClassName={(position) => [
          page.total > 50 ? "portfolio-lab__virtual-row" : "",
          selectedId === position.id ? "bg-caos-accent/10" : "",
        ].filter(Boolean).join(" ")}
      />
    </div>
  );
}

function ConstraintsTable({ rows }: { rows: PortfolioConstraint[] }) {
  const columns: DataTableColumn<PortfolioConstraint>[] = [
    { key: "constraint", header: "Constraint", rowHeader: true, render: (row) => <span className="font-semibold text-caos-text">{row.parameter ?? row.code ?? "Unnamed"}</span> },
    { key: "limit", header: "Limit", align: "numeric", render: (row) => row.limit_text ?? "—" },
    { key: "current", header: "Current", align: "numeric", render: (row) => numberText(row.current) },
    { key: "headroom", header: "Headroom", align: "numeric", render: (row) => numberText(row.headroom) },
    { key: "status", header: "Status", render: (row) => <span className="portfolio-lab__status" data-status={row.status.toLowerCase()}>● {row.status}</span> },
  ];
  return (
    <div className="min-h-0 overflow-auto">
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row, index) => `${row.code ?? "constraint"}-${index}`}
        caption="Portfolio constraints"
      />
    </div>
  );
}

function LoadingTable() {
  return <div className="portfolio-lab__empty" role="status">Loading portfolio data…</div>;
}

function resolveDataset(value: string | null): DatasetMode {
  return value === "constraints" ? "constraints" : "positions";
}

function resolveChart(value: string | null): ChartMode {
  return ["ratings", "maturity", "risk", "stress"].includes(value ?? "") ? value as ChartMode : "concentration";
}

function resolveSort(value: string | null): PortfolioPositionSort {
  return PORTFOLIO_SORTS.includes(value as PortfolioPositionSort) ? value as PortfolioPositionSort : "borrower_name";
}

function resolvePortfolioSelection(values: PortfolioUrlValues, portfolios: PortfolioSummary[], loaded: boolean) {
  const requestedId = values.portfolio;
  const requestedIsMissing = Boolean(requestedId && loaded && portfolios.length > 0 && !portfolios.some((row) => row.id === requestedId));
  const id = requestedIsMissing || (loaded && portfolios.length === 0) ? null : requestedId ?? portfolios[0]?.id ?? null;
  return { requestedId, requestedIsMissing, id };
}

function usePortfolioDirectory(update: PortfolioUrlUpdater, setError: NullableErrorSetter) {
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setDirectoryError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getPortfolios().then((rows) => {
      if (!alive) return;
      setPortfolios(rows);
      if (!new URL(window.location.href).searchParams.get("portfolio") && rows[0]) {
        update({ portfolio: rows[0].id }, "replace");
      }
    }).catch((reason) => {
      if (!alive) return;
      const message = toErrorMessage(reason, "Portfolio list unavailable.");
      setDirectoryError(message);
      setError(message);
    }).finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [setError, update]);
  return { portfolios, loaded, error };
}

function usePortfolioFilters(values: PortfolioUrlValues) {
  const [draft, setDraft] = useState(() => ({
    text: values.text ?? "",
    sector: values.sector ?? "",
    rating: values.rating ?? "",
  }));
  useEffect(() => {
    setDraft({ text: values.text ?? "", sector: values.sector ?? "", rating: values.rating ?? "" });
  }, [values.rating, values.sector, values.text]);
  return { draft, setDraft };
}

function positionRequest(
  values: Pick<PortfolioUrlValues, "cursor" | "direction" | "ranking" | "rating" | "sector" | "text">,
  sort: PortfolioPositionSort,
) {
  return {
    cursor: values.cursor ?? undefined,
    sort,
    direction: values.direction === "desc" ? "desc" as const : "asc" as const,
    text: values.text ?? undefined,
    sector: values.sector ?? undefined,
    rating: values.rating ?? undefined,
    ranking: values.ranking ?? undefined,
    limit: 100,
  };
}

function usePortfolioPositions(id: string | null, loaded: boolean, values: PortfolioUrlValues, sort: PortfolioPositionSort, setError: NullableErrorSetter) {
  const [positions, setPositions] = useState<PortfolioPositionPage | null>(null);
  const [loading, setLoading] = useState(true);
  const { cursor, direction, ranking, rating, sector, text } = values;
  useEffect(() => {
    if (!loaded || !id) {
      if (loaded) setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    setPositions(null);
    portfolioLabApi.getPositions(id, positionRequest({ cursor, direction, ranking, rating, sector, text }, sort))
      .then((page) => { if (alive) setPositions(page); })
      .catch((reason) => { if (alive) setError(toErrorMessage(reason, "Portfolio positions unavailable.")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [cursor, direction, id, loaded, ranking, rating, sector, setError, sort, text]);
  return { positions, loading };
}

function applySupportResult<T>(
  result: PromiseSettledResult<T>,
  onSuccess: (value: T) => void,
  onFailure: NullableErrorSetter,
  fallback: string,
) {
  if (result.status === "fulfilled") {
    onSuccess(result.value);
    return null;
  }
  const message = toErrorMessage(result.reason, fallback);
  onFailure(message);
  return message;
}

function usePortfolioSupport(contextId: string | null | undefined, id: string | null, loaded: boolean) {
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [stressRuns, setStressRuns] = useState<StressRun[]>([]);
  const [insight, setInsight] = useState<InsightArtifact | null>(null);
  const [refreshInsight, setRefreshInsight] = useState<InsightArtifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [stressError, setStressError] = useState<string | null>(null);
  const [insightError, setInsightError] = useState<string | null>(null);
  useEffect(() => {
    if (!loaded || !id) return;
    let alive = true;
    setError(null); setAnalyticsError(null); setStressError(null); setInsightError(null);
    setAnalytics(null); setStressRuns([]); setInsight(null); setRefreshInsight(null);
    const insightRequest = contextId
      ? analysisApi.listInsights(contextId, { surface: "portfolio-lab", kind: "portfolio-brief", limit: 20 })
      : Promise.resolve({ items: [], current: null, next_cursor: null });
    Promise.allSettled([portfolioLabApi.getAnalytics(id), portfolioLabApi.listStressRuns(id), insightRequest])
      .then(([analyticsResult, stressResult, insightResult]) => {
        if (!alive) return;
        const failures = [
          applySupportResult(analyticsResult, setAnalytics, setAnalyticsError, "Analytics unavailable."),
          applySupportResult(stressResult, (page) => setStressRuns(page.items), setStressError, "Stress history unavailable."),
          applySupportResult(insightResult, (page) => setInsight(page.current), setInsightError, "Cited brief unavailable."),
        ].filter((message): message is string => message !== null);
        setError(failures.length ? failures.join(" ") : null);
      });
    return () => { alive = false; };
  }, [contextId, id, loaded]);
  return { analytics, stressRuns, setStressRuns, insight, setInsight, refreshInsight, setRefreshInsight, error, analyticsError, stressError, insightError };
}

function buildVisualizationAnalytics(analytics: PortfolioAnalytics | null, stressRuns: StressRun[]) {
  if (!analytics) return null;
  return {
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
  };
}

function usePortfolioStress(id: string | null, update: PortfolioUrlUpdater, setStressRuns: Dispatch<SetStateAction<StressRun[]>>, setError: NullableErrorSetter) {
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState(false);
  const persist = async () => {
    if (!id) return;
    setPending(true);
    try {
      const created = await portfolioLabApi.createStressRun(id, { label: "Base downside", book_price_shock_pct: -8, sector_shock_pcts: {} });
      setStressRuns((current) => [created, ...current]);
      update({ stress: created.id, chart: "stress" });
      setPreview(false);
    } catch (reason) {
      setError(toErrorMessage(reason, "Stress run failed."));
    } finally {
      setPending(false);
    }
  };
  return { preview, setPreview, pending, persist };
}

function readyInsight(insight: InsightArtifact) {
  return insight.status === "ready" || insight.status === "ratified";
}

function usePortfolioInsightActions(
  contextId: string | null | undefined,
  id: string | null,
  support: ReturnType<typeof usePortfolioSupport>,
  setError: NullableErrorSetter,
) {
  const generate = async () => {
    if (!contextId || !id) return;
    try {
      const created = await analysisApi.createInsight(contextId, {
        surface: "portfolio-lab", kind: "portfolio-brief", subject_refs: { portfolio_id: id }, force: Boolean(support.insight),
      });
      if (readyInsight(created)) {
        support.setInsight(created);
        support.setRefreshInsight(null);
      } else {
        support.setRefreshInsight(created);
      }
    } catch (reason) {
      setError(toErrorMessage(reason, "Portfolio insight unavailable."));
    }
  };
  const ratify = (candidate: InsightArtifact) => {
    void analysisApi.ratifyInsight(candidate.id)
      .then((ratified) => { support.setInsight(ratified); support.setRefreshInsight(null); })
      .catch((reason) => setError(toErrorMessage(reason, "Insight ratification failed.")));
  };
  return { generate, ratify };
}

function selectedPortfolio(portfolios: PortfolioSummary[], id: string | null) {
  return portfolios.find((row) => row.id === id) ?? null;
}

function selectedPortfolioPosition(positionLane: ReturnType<typeof usePortfolioPositions>, selectedId: string | null | undefined) {
  return positionLane.positions?.items.find((row) => row.id === selectedId) ?? null;
}

function selectedStressRun(stressRuns: StressRun[], selectedId: string | null | undefined) {
  return stressRuns.find((run) => run.id === selectedId) ?? stressRuns[0] ?? null;
}

function portfolioChartSpec(chart: ChartMode, analytics: PortfolioAnalytics | null, stressRuns: StressRun[]) {
  const visualizationAnalytics = buildVisualizationAnalytics(analytics, stressRuns);
  return visualizationAnalytics ? createPortfolioVisualizationSpec(chart, visualizationAnalytics) : null;
}

function usePortfolioLabView() {
  const { roleView } = useRoleView();
  const analysis = useAnalysisContext({ name: "Portfolio Lab" });
  const { values, update } = useTypedUrlState(URL_KEYS);
  const [error, setError] = useState<string | null>(null);
  const directory = usePortfolioDirectory(update, setError);
  const selection = resolvePortfolioSelection(values, directory.portfolios, directory.loaded);
  const dataset = resolveDataset(values.dataset);
  const chart = resolveChart(values.chart);
  const sort = resolveSort(values.sort);
  const filters = usePortfolioFilters(values);
  const positionLane = usePortfolioPositions(selection.id, directory.loaded, values, sort, setError);
  const support = usePortfolioSupport(analysis.context?.id, selection.id, directory.loaded);
  const portfolio = selectedPortfolio(directory.portfolios, selection.id);
  const selectedPosition = selectedPortfolioPosition(positionLane, values.selected);
  const selectedStress = selectedStressRun(support.stressRuns, values.stress);
  const chartSpec = useMemo(() => portfolioChartSpec(chart, support.analytics, support.stressRuns), [chart, support.analytics, support.stressRuns]);
  const stress = usePortfolioStress(selection.id, update, support.setStressRuns, setError);
  const insightActions = usePortfolioInsightActions(analysis.context?.id, selection.id, support, setError);
  return {
    roleView, analysis, values, update, error, directory, selection, dataset, chart, sort, filters,
    positions: { ...positionLane, selected: selectedPosition },
    support: { ...support, selectedStress, displayedInsight: support.insight ?? support.refreshInsight, chartSpec },
    portfolio, stress, insightActions,
  };
}

type PortfolioLabViewModel = ReturnType<typeof usePortfolioLabView>;

function PortfolioDecision({ view }: { view: PortfolioLabViewModel }) {
  const label = view.roleView === "pm" ? "Portfolio posture" : view.roleView === "qa" ? "Evidence & compliance" : "Sizing workbench";
  const authority = !view.selection.id ? "No portfolio" : view.support.analytics?.authority.approval_state ?? (view.support.analyticsError ? "Unavailable" : "Loading");
  return (
    <header className="portfolio-lab__decision-header">
      <div><p className="caos-panel-title text-caos-muted">{label}</p><h2>{view.portfolio?.name ?? "Portfolio Lab"}</h2></div>
      <dl><div><dt>As of</dt><dd>{view.support.analytics?.as_of ?? view.portfolio?.as_of_date ?? "Unavailable"}</dd></div><div><dt>Positions</dt><dd>{view.positions.loading ? "—" : view.positions.positions?.total ?? view.portfolio?.n_positions ?? "—"}</dd></div><div><dt>Authority</dt><dd>{authority}</dd></div></dl>
    </header>
  );
}

function PortfolioDatasetTabs({ view }: { view: PortfolioLabViewModel }) {
  const selectDataset = (dataset: DatasetMode) => view.update({ dataset, cursor: null });
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = view.dataset === "positions" ? "constraints" : "positions";
    selectDataset(next);
    requestAnimationFrame(() => document.getElementById(`portfolio-tab-${next}`)?.focus());
  };
  return (
    <div role="tablist" aria-label="Portfolio datasets" onKeyDown={handleKeyDown}>
      <button id="portfolio-tab-positions" type="button" role="tab" aria-controls="portfolio-dataset-panel" aria-selected={view.dataset === "positions"} tabIndex={view.dataset === "positions" ? 0 : -1} onClick={() => selectDataset("positions")}>Positions</button>
      <button id="portfolio-tab-constraints" type="button" role="tab" aria-controls="portfolio-dataset-panel" aria-selected={view.dataset === "constraints"} tabIndex={view.dataset === "constraints" ? 0 : -1} onClick={() => selectDataset("constraints")}>Constraints</button>
    </div>
  );
}

function PortfolioFilters({ view }: { view: PortfolioLabViewModel }) {
  const { draft, setDraft } = view.filters;
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    view.update({ text: draft.text || null, sector: draft.sector || null, rating: draft.rating || null, cursor: null });
  };
  const descending = view.values.direction === "desc";
  return (
    <form aria-label="Portfolio position filters" className="portfolio-lab__filters" onSubmit={submit}>
      <label>Search<input name="portfolio-search" autoComplete="off" value={draft.text} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} /></label>
      <label>Sector<input name="portfolio-sector" autoComplete="off" value={draft.sector} onChange={(event) => setDraft((current) => ({ ...current, sector: event.target.value }))} /></label>
      <label>Rating<input name="portfolio-rating" autoComplete="off" value={draft.rating} onChange={(event) => setDraft((current) => ({ ...current, rating: event.target.value }))} /></label>
      <label>Sort<select value={view.sort} onChange={(event) => view.update({ sort: event.target.value, cursor: null })}><option value="borrower_name">Borrower</option><option value="par_usd">Par</option><option value="price">Price</option><option value="maturity">Maturity</option><option value="rating_moody">Moody&apos;s</option></select></label>
      <button type="button" aria-label={`Sort ${descending ? "ascending" : "descending"}`} onClick={() => view.update({ direction: descending ? "asc" : "desc", cursor: null })}>{descending ? "DESC ↓" : "ASC ↑"}</button>
      <button type="submit">APPLY</button>
    </form>
  );
}

function PortfolioToolbar({ view }: { view: PortfolioLabViewModel }) {
  return (
    <div className="portfolio-lab__toolbar">
      <PortfolioDatasetTabs view={view} />
      <label>Portfolio<select value={view.selection.id ?? ""} onChange={(event) => view.update({ portfolio: event.target.value, cursor: null, selected: null })}>{view.directory.portfolios.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      {view.dataset === "positions" ? <PortfolioFilters view={view} /> : null}
      {view.values.ranking ? <div className="portfolio-lab__active-filter" role="status">Ranking: {view.values.ranking}<button type="button" className="focus-ring" onClick={() => view.update({ ranking: null, cursor: null })}>Clear ranking</button></div> : null}
    </div>
  );
}

function portfolioDatasetGate(view: PortfolioLabViewModel) {
  if (view.selection.requestedIsMissing) return <SurfaceState kind="unavailable" headingLevel={2} title="Portfolio not found" detail={`The requested portfolio (${view.selection.requestedId}) is not available. Choose a portfolio from the picker.`} compact />;
  if (!view.selection.id && view.directory.error) return <SurfaceState kind="offline" headingLevel={2} title="Portfolio register unavailable" detail={view.directory.error} compact />;
  if (!view.selection.id && view.directory.loaded) return <SurfaceState kind="empty" headingLevel={2} title="No portfolios are configured" detail="Create or import a portfolio in Settings before opening the lab." primaryAction={<Link href="/settings?tab=portfolios" className="text-caos-accent underline focus-ring">Open Settings</Link>} compact />;
  if (view.positions.loading && !view.positions.positions) return <LoadingTable />;
  if (view.error && !view.positions.positions) return <SurfaceState kind="unavailable" headingLevel={2} title="Portfolio positions unavailable" detail={view.error} compact />;
  return null;
}

function PositionDatasetContent({ view }: { view: PortfolioLabViewModel }) {
  if (view.positions.positions?.items.length) return <PositionsTable page={view.positions.positions} selectedId={view.values.selected} onSelect={(row) => view.update({ selected: row.id })} />;
  return <SurfaceState kind="empty" headingLevel={2} title="No positions match the active filters" detail="Clear or adjust the visible filters to broaden the result." compact />;
}

function ConstraintDatasetContent({ view }: { view: PortfolioLabViewModel }) {
  if (view.support.analytics?.compliance.length) return <ConstraintsTable rows={view.support.analytics.compliance} />;
  if (view.support.analytics) return <SurfaceState kind="empty" headingLevel={2} title="No portfolio constraints are configured" compact />;
  if (view.support.error) return <SurfaceState kind="unavailable" headingLevel={2} title="Constraint analytics unavailable" detail="Positions remain accessible." compact />;
  return <LoadingTable />;
}

function PortfolioDatasetContent({ view }: { view: PortfolioLabViewModel }) {
  const gate = portfolioDatasetGate(view);
  if (gate) return gate;
  return view.dataset === "positions" ? <PositionDatasetContent view={view} /> : <ConstraintDatasetContent view={view} />;
}

function PortfolioPrimary({ view }: { view: PortfolioLabViewModel }) {
  const totalRows = view.dataset === "positions" ? view.positions.positions?.total : view.support.analytics?.compliance.length;
  return (
    <section className="portfolio-lab__primary" aria-label="Portfolio working set">
      <PortfolioToolbar view={view} />
      <div id="portfolio-dataset-panel" role="tabpanel" aria-labelledby={`portfolio-tab-${view.dataset}`}>
        <DominantTableRegion ownerId="portfolio-lab-main" label={`${view.dataset === "positions" ? "Portfolio positions" : "Portfolio constraints"} table`} data-total-rows={totalRows}>
          <PortfolioDatasetContent view={view} />
        </DominantTableRegion>
      </div>
      {view.dataset === "positions" && view.positions.positions?.next_cursor ? <button type="button" className="portfolio-lab__next" onClick={() => view.update({ cursor: view.positions.positions?.next_cursor, selected: null })}>Next positions</button> : null}
    </section>
  );
}

function PortfolioContextPane({ view }: { view: PortfolioLabViewModel }) {
  let content = <p role="status">Loading portfolio analytics…</p>;
  if (!view.selection.id) content = <p role="status">No portfolio selected — analytics unavailable.</p>;
  else if (view.support.chartSpec) content = <PortfolioVisualization spec={view.support.chartSpec} headingLevel={2} />;
  else if (view.support.analyticsError) content = <p role="status">{view.support.analyticsError} The positions workflow remains live.</p>;
  return (
    <section className="portfolio-lab__context" aria-label="Portfolio visualization">
      <label>View<select value={view.chart} onChange={(event) => view.update({ chart: event.target.value as ChartMode })}><option value="concentration">Concentration</option><option value="ratings">Ratings</option><option value="maturity">Maturity wall</option><option value="risk">Risk budget</option><option value="stress">Stress history</option></select></label>
      {content}
    </section>
  );
}

function PositionSources({ ids }: { ids: string[] | undefined }) {
  if (!ids?.length) return <SourceRef source={{ state: "unavailable", reason: "No persisted source identifier for this position." }} />;
  return <>{ids.map((id) => <SourceRef key={id} source={{ state: "unavailable", reason: `Source ${id} has no persisted action.` }} />)}</>;
}

function PositionDetails({ view }: { view: PortfolioLabViewModel }) {
  const position = view.positions.selected;
  if (!position) return <p>Select a position to inspect its sizing and source lineage.</p>;
  return (
    <>
      <dl><div><dt>Instrument</dt><dd>{position.loan_name ?? position.ticker ?? "—"}</dd></div><div><dt>Market value</dt><dd>{position.market_value == null ? "—" : money.format(position.market_value)}</dd></div><div><dt>Source</dt><dd className="grid gap-1"><PositionSources ids={view.positions.positions?.authority.source_ids} /></dd></div></dl>
      {position.issuer_id ? <Link href={`/issuers/profile?id=${encodeURIComponent(position.issuer_id)}&context=${encodeURIComponent(view.analysis.context?.id ?? "")}`}>Open issuer profile</Link> : null}
    </>
  );
}

function PortfolioInsight({ view }: { view: PortfolioLabViewModel }) {
  const displayed = view.support.displayedInsight;
  if (displayed) return <PortfolioInsightCard insight={displayed} onRatify={displayed.status === "ready" ? () => view.insightActions.ratify(displayed) : undefined} />;
  if (view.support.insightError) return <p role="status">{view.support.insightError}</p>;
  return <p>No cited advisory brief has been generated.</p>;
}

function PortfolioInspectorPane({ view }: { view: PortfolioLabViewModel }) {
  const missing = view.support.analytics?.missing_dependencies ?? [];
  return (
    <aside className="portfolio-lab__inspector" aria-label="Portfolio evidence inspector">
      <h2>{view.positions.selected?.borrower_name ?? "Evidence Atlas"}</h2>
      <PositionDetails view={view} />
      {missing.length ? <><h3>Missing dependencies</h3><ul>{missing.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
      <div className="portfolio-lab__insight-actions"><ActionReason reason={view.selection.id ? null : "Create or open a portfolio first"} onClick={() => void view.insightActions.generate()}>{view.support.insight ? "Refresh cited brief" : "Generate cited brief"}</ActionReason></div>
      {view.support.refreshInsight && view.support.insight ? <p role="status">Latest refresh is {view.support.refreshInsight.status}; the last ready or ratified brief remains effective.</p> : null}
      <PortfolioInsight view={view} />
    </aside>
  );
}

function StressPreview({ view }: { view: PortfolioLabViewModel }) {
  if (!view.stress.preview) return null;
  return <div className="portfolio-lab__stress-preview"><strong>Preview only</strong><p>Apply an 8% book price decline. Holdings and limits will not be changed.</p><ActionReason reason={view.stress.pending ? "Stress run in progress" : null} onClick={() => void view.stress.persist()}>{view.stress.pending ? "Persisting…" : "Confirm and persist"}</ActionReason></div>;
}

function StressTimeline({ view }: { view: PortfolioLabViewModel }) {
  if (view.support.stressRuns.length) {
    return <ol className="portfolio-lab__timeline" aria-label="Persisted stress history">{view.support.stressRuns.map((run) => <li key={run.id} data-selected={view.support.selectedStress?.id === run.id}><button type="button" aria-pressed={view.support.selectedStress?.id === run.id} onClick={() => view.update({ stress: run.id, chart: "stress" })}>{run.label}</button><span>{numberText(run.output.loss_percent, "% loss")}</span><code>{run.source_fingerprint}</code></li>)}</ol>;
  }
  return view.support.stressError ? <p role="status">{view.support.stressError}</p> : <p>No persisted stress snapshots.</p>;
}

function StressResult({ run }: { run: StressRun | null }) {
  if (!run) return null;
  return (
    <article className="portfolio-lab__stress-result" aria-label="Selected stress result">
      <h3>{run.label} result</h3>
      <dl><div><dt>Base NAV</dt><dd>{run.output.base_nav == null ? "—" : money.format(run.output.base_nav)}</dd></div><div><dt>Stressed NAV</dt><dd>{run.output.stressed_nav == null ? "—" : money.format(run.output.stressed_nav)}</dd></div><div><dt>Loss</dt><dd>{numberText(run.output.loss_percent, "%")}</dd></div><div><dt>Authority</dt><dd>{run.authority ? `${run.authority.approval_state} · ${run.authority.method}` : "—"}</dd></div></dl>
      {/* Older persisted stress runs predate missing_dependencies — tolerate its absence. */}
      {run.output.missing_dependencies?.length ? <><h4>Missing dependencies</h4><ul>{run.output.missing_dependencies.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
    </article>
  );
}

function PortfolioStressPane({ view }: { view: PortfolioLabViewModel }) {
  return (
    <section className="portfolio-lab__stress" aria-label="Deterministic stress controls">
      <header><div><p className="caos-panel-title text-caos-muted">Deterministic scenario</p><h2>Base downside</h2></div><ActionReason reason={view.selection.id ? null : "Create or open a portfolio first"} reasonDisplay="hidden" onClick={() => view.stress.setPreview(true)}>Preview stress</ActionReason></header>
      <StressPreview view={view} />
      <StressTimeline view={view} />
      <StressResult run={view.support.selectedStress} />
    </section>
  );
}

function PortfolioSetupState({ view }: { view: PortfolioLabViewModel }) {
  let state = <SurfaceState kind="loading" headingLevel={2} title="Loading portfolio register" compact />;
  if (view.selection.requestedIsMissing) {
    state = <SurfaceState kind="unavailable" headingLevel={2} title="Portfolio not found" detail={`The requested portfolio (${view.selection.requestedId}) is not available. Choose a portfolio from Settings.`} primaryAction={<Link href="/settings?tab=portfolios" className="text-caos-accent underline focus-ring">Open Settings</Link>} compact />;
  } else if (view.directory.error) {
    state = <SurfaceState kind="offline" headingLevel={2} title="Portfolio register unavailable" detail={view.directory.error} compact />;
  } else if (view.directory.loaded) {
    state = <SurfaceState kind="empty" headingLevel={2} title="No portfolios are configured" detail="Create or import a portfolio in Settings before opening the lab." primaryAction={<Link href="/settings?tab=portfolios" className="text-caos-accent underline focus-ring">Open Settings</Link>} compact />;
  }
  return <section className="portfolio-lab__setup" aria-label="Portfolio setup">{state}</section>;
}

function PortfolioLabView({ view }: { view: PortfolioLabViewModel }) {
  const status = view.error
    ? <span role="alert">{view.error}</span>
    : <span>{view.portfolio ? view.portfolio.kind : <span className="text-caos-muted">No portfolio selected</span>}</span>;
  return (
    <EnterprisePage
      kind="analytical"
      identity={<ShellIdentity tag="CP-PORT" title="Portfolio Lab" />}
      status={status}
      primaryAction={view.selection.id ? {
        label: "Preview portfolio stress",
        onAction: () => view.stress.setPreview(true),
      } : undefined}
      narrowContract={{ essentialControls: <span>{view.positions.loading ? "—" : view.positions.positions?.total ?? 0} positions</span> }}
    >
      {view.selection.id
        ? <PersonaWorkbench surface="portfolio-lab" decision={<PortfolioDecision view={view} />} primary={<PortfolioPrimary view={view} />} context={<PortfolioContextPane view={view} />} inspector={<PortfolioInspectorPane view={view} />} utility={<PortfolioStressPane view={view} />} />
        : <PersonaWorkbench surface="portfolio-lab" primary={<PortfolioSetupState view={view} />} />}
    </EnterprisePage>
  );
}

export function PortfolioLabWorkbench() {
  const view = usePortfolioLabView();
  return <PortfolioLabView view={view} />;
}
