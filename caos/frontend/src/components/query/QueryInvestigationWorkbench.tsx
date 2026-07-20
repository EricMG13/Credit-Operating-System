"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { EnterprisePage, type PageAction } from "@/components/shared/EnterprisePage";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { ActionReason } from "@/components/shared/ActionReason";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { AnalysisStateBadge, AuthorityLine, FindingsTray } from "@/components/shared/AnalysisWorkbench";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { CitationViewer } from "@/components/command/CitationViewer";
import { GraphCanvas } from "@/components/query/GraphCanvas";
import { headStat } from "@/components/shared/headStat";
import { getChunk, queryCapabilities, toErrorMessage } from "@/lib/api";
import { fmtUtcDateTime } from "@/lib/format-date";
import type { GraphResult } from "@/lib/query/graph";
import {
  analysisApi,
  contextHref,
  useAnalysisContext,
  type AuthorityEnvelope,
  type QueryRun,
} from "@/lib/analysis-workbench";
import type { DecisionAuthority, DecisionContextState, DecisionDatumState } from "@/lib/decision-state";
import { useTypedUrlState } from "@/lib/typed-url-state";

// The first starter is the canonical seeded demo (energy-price margin
// exposure): its metric is chunk-cited even before any run completes, so the
// full gate-off → pin → unpin flow is demonstrable on a cold workspace. The
// leverage/recovery starters return uncited seed facts cold, which correctly
// leaves pinning gated.
const STARTERS = [
  "Which issuers' margins are most exposed to higher energy prices?",
  "Which credits have the largest leverage deterioration?",
  "Show evidence linking refinancing risk to sector posture.",
];
const QUERY_URL_KEYS = ["context", "lane", "run"] as const;
const QUERY_DRAFT_PREFIX = "caos.query.draft.";

function readQueryDraft(contextId: string): string {
  try {
    return sessionStorage.getItem(`${QUERY_DRAFT_PREFIX}${contextId}`) ?? "";
  } catch {
    return "";
  }
}

function writeQueryDraft(contextId: string, value: string) {
  try {
    const key = `${QUERY_DRAFT_PREFIX}${contextId}`;
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    // Private mode or a full storage quota must not block the live composer.
  }
}

function inferLane(question: string): QueryRun["selected_lane"] {
  if (/\b(graph|link|connected|relationship|contagion|lineage)\b/i.test(question)) return "graph";
  if (/\b(why|explain|evidence|source|caveat|thesis)\b/i.test(question)) return "grounded";
  return "metric";
}

const QUERY_LANE_LABELS: Record<QueryRun["selected_lane"], string> = {
  metric: "Compare metrics",
  graph: "Map relationships",
  grounded: "Research with citations",
};

function queryLaneLabel(lane: QueryRun["selected_lane"]) {
  return QUERY_LANE_LABELS[lane];
}

function decisionAuthority(authority: AuthorityEnvelope): DecisionAuthority {
  const origin = authority.origin === "live" ? "LIVE" : authority.origin === "demo" ? "DEMO" : "REFERENCE";
  const method = authority.method.includes("model") || authority.method.includes("grounded") ? "MODELLED" : authority.method.includes("metric") ? "REPORTED" : "DERIVED";
  const freshness = authority.freshness === "current" ? "CURRENT" : authority.freshness === "stale" ? "STALE" : "UNKNOWN";
  return {
    provenance: { origin, method, freshness, detail: `${authority.method} · ${authority.source_ids.length} sources` },
    approval: authority.approval_state === "ratified" ? "RATIFIED" : authority.approval_state === "draft" ? "DRAFT" : "UNRATIFIED",
  };
}

function datum(run: QueryRun | null, value: React.ReactNode, missing: string[]): DecisionDatumState {
  if (!run) return { kind: "unavailable", message: "Run a question to establish this observation." };
  if (run.status === "error") return { kind: "error", message: run.error ?? "Selected lane failed." };
  if (run.status === "partial") return {
    kind: "partial",
    value,
    missingSources: missing,
    asOf: fmtUtcDateTime(run.authority.as_of ?? run.updated_at),
    authority: decisionAuthority(run.authority),
  };
  if (run.status === "observed-empty") return {
    kind: "observed-empty",
    message: "Successful query returned no qualifying observations.",
    asOf: fmtUtcDateTime(run.authority.as_of ?? run.updated_at),
    authority: decisionAuthority(run.authority),
  };
  return {
    kind: "ready",
    value,
    asOf: fmtUtcDateTime(run.authority.as_of ?? run.updated_at),
    authority: decisionAuthority(run.authority),
  };
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

function resultRows(run: QueryRun): Array<Record<string, unknown>> {
  for (const key of ["rows", "results", "nodes"]) {
    const value = run.result[key];
    if (Array.isArray(value)) return value.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
  }
  return [];
}

function rowIssuer(row: Record<string, unknown>): Record<string, unknown> | null {
  return row.issuer && typeof row.issuer === "object" && !Array.isArray(row.issuer)
    ? row.issuer as Record<string, unknown>
    : null;
}

function formatMetricValue(value: unknown): string {
  if (typeof value !== "number") return stringValue(value) ?? "—";
  // Fixed decimals down a column (4.40 / 5.68, never 4.4 / 5.68) — mixed
  // precision in one numeric column breaks the aligned-decimal convention.
  return Math.abs(value) >= 100
    ? value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function graphResult(result: Record<string, unknown>): GraphResult | null {
  if (
    typeof result.capability_id !== "string"
    || typeof result.mode !== "string"
    || typeof result.title !== "string"
    || !Array.isArray(result.nodes)
    || !Array.isArray(result.edges)
  ) return null;
  const validNodes = result.nodes.every((node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return false;
    const value = node as Record<string, unknown>;
    return typeof value.id === "string"
      && typeof value.label === "string"
      && typeof value.kind === "string"
      && typeof value.x === "number"
      && Number.isFinite(value.x)
      && typeof value.y === "number"
      && Number.isFinite(value.y);
  });
  const validEdges = result.edges.every((edge) => {
    if (!edge || typeof edge !== "object" || Array.isArray(edge)) return false;
    const value = edge as Record<string, unknown>;
    return typeof value.source === "string" && typeof value.target === "string";
  });
  if (!validNodes || !validEdges) return null;
  return {
    capability_id: result.capability_id,
    mode: result.mode,
    title: result.title,
    nodes: result.nodes as GraphResult["nodes"],
    edges: result.edges as GraphResult["edges"],
    meta: Array.isArray(result.meta) ? result.meta.filter((item): item is string => typeof item === "string") : [],
    caveats: Array.isArray(result.caveats) ? result.caveats.filter((item): item is string => typeof item === "string") : [],
  };
}

function GraphLaneResult({ run, onCitation }: { run: QueryRun; onCitation?: (id: string, label: string) => void }) {
  const graph = graphResult(run.result);
  if (!graph) {
    return <SurfaceState kind="unavailable" title="Graph payload unavailable" detail="This run did not return a valid node-and-edge payload." className="m-3" />;
  }
  return (
    <div className="flex h-full min-h-0 flex-col bg-caos-panel">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-caos-border px-3 py-2">
        <div>
          <p className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{run.question}</p>
          <h2 className="mt-1 text-base font-semibold text-caos-text">{graph.title}</h2>
        </div>
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
          {graph.nodes.length} nodes · {graph.edges.length} links
        </span>
      </header>
      <div className="min-h-[360px] flex-1">
        <GraphCanvas
          graph={graph}
          onOpenChunk={(id, label) => onCitation?.(id, label ?? id)}
        />
      </div>
    </div>
  );
}

type CitationHandler = (id: string, label: string) => void;
type GroundedSources = { chunks: string[]; facts: string[] };

function recordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
    : [];
}

function sourceLabelMap(rows: unknown, idKey: "chunk_id" | "fact_id") {
  const labels = new Map<string, string>();
  if (!Array.isArray(rows)) return labels;
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const value = row as Record<string, unknown>;
    const id = stringValue(value[idKey]);
    if (id) labels.set(id, stringValue(value.label) ?? id);
  }
  return labels;
}

function groundedSources(sentence: Record<string, unknown>): GroundedSources {
  return {
    chunks: Array.isArray(sentence.chunk_ids) ? sentence.chunk_ids.map(stringValue).filter((id): id is string => !!id) : [],
    facts: Array.isArray(sentence.fact_ids) ? sentence.fact_ids.map(stringValue).filter((id): id is string => !!id) : [],
  };
}

function prepareGroundedResult(run: QueryRun) {
  const sentences = recordArray(run.result.sentences);
  const sentenceSources = sentences.map(groundedSources);
  const fallbackAnswer = stringValue(run.result.answer);
  return {
    citationLabels: sourceLabelMap(run.result.citations, "chunk_id"),
    factLabels: sourceLabelMap(run.result.fact_citations, "fact_id"),
    fallbackAnswer,
    sentenceSources,
    sentences,
    sourceCount: new Set(sentenceSources.flatMap(({ chunks, facts }) => [...chunks, ...facts])).size,
    unavailable: run.result.unavailable === true || (!sentences.length && !fallbackAnswer),
  };
}

type GroundedModel = ReturnType<typeof prepareGroundedResult>;

function GroundedChunk({ id, index, labels, onCitation }: { id: string; index: number; labels: Map<string, string>; onCitation: CitationHandler }) {
  const label = labels.get(id) ?? id;
  return <button
    type="button"
    aria-label={`Open cited source ${label}`}
    title={label}
    onClick={() => onCitation(id, labels.get(id) ?? `C${index + 1}`)}
    className="rounded-sm border border-caos-accent/50 px-1 py-px tabular text-caos-3xs text-caos-accent hover:bg-caos-elevated focus-ring"
  >C{index + 1} ↗</button>;
}

function GroundedFact({ id, index, labels }: { id: string; index: number; labels: Map<string, string> }) {
  return <span title={labels.get(id) ?? id} className="rounded-sm border border-caos-border px-1 py-px tabular text-caos-3xs text-caos-muted">F{index + 1} · {labels.get(id) ?? "metric fact"}</span>;
}

function GroundedClaim({ index, model, onCitation }: { index: number; model: GroundedModel; onCitation: CitationHandler }) {
  const sentence = model.sentences[index];
  const text = stringValue(sentence.text) ?? "Grounded claim unavailable.";
  const claimType = stringValue(sentence.claim_type) ?? "observation";
  const { chunks, facts } = model.sentenceSources[index];
  return <li className="border-l border-caos-border pl-3">
    <p className="text-caos-sm leading-relaxed text-caos-text">{text}</p>
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted">{claimType}</span>
      {chunks.map((id, sourceIndex) => <GroundedChunk key={id} id={id} index={sourceIndex} labels={model.citationLabels} onCitation={onCitation} />)}
      {facts.map((id, factIndex) => <GroundedFact key={id} id={id} index={factIndex} labels={model.factLabels} />)}
      {!chunks.length && !facts.length ? <span className="tabular text-caos-3xs uppercase text-caos-warning">Uncited · keep in draft</span> : null}
    </div>
  </li>;
}

function GroundedAnswer({ model, onCitation }: { model: GroundedModel; onCitation: CitationHandler }) {
  if (!model.sentences.length) return <div className="mt-2">
    <p className="text-caos-sm leading-relaxed text-caos-text">{model.fallbackAnswer}</p>
    <p className="mt-2 tabular text-caos-2xs uppercase text-caos-warning">No sentence-level citations attached · keep in draft</p>
  </div>;
  return <ol className="mt-2 space-y-3">{model.sentences.map((_sentence, index) => <GroundedClaim key={index} index={index} model={model} onCitation={onCitation} />)}</ol>;
}

function GroundedLaneResult({ run, onCitation }: { run: QueryRun; onCitation: CitationHandler }) {
  const model = prepareGroundedResult(run);

  if (model.unavailable) {
    return <SurfaceState kind="empty" title="No grounded answer" detail="The evidence gate retained no cited claims for this question." className="m-3" />;
  }

  return (
    <article className="m-3 rounded-md border border-caos-border bg-caos-panel p-3" aria-label="Grounded cited answer">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AnalysisStateBadge state={run.status} />
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
          {model.sourceCount} cited {model.sourceCount === 1 ? "source" : "sources"}
        </span>
      </div>
      <p className="mt-2 tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{run.question}</p>
      <GroundedAnswer model={model} onCitation={onCitation} />
    </article>
  );
}

function rowMetrics(row: Record<string, unknown>) {
  return row.metrics && typeof row.metrics === "object" && !Array.isArray(row.metrics) ? row.metrics as Record<string, unknown> : {};
}

function metricRowCitation(row: Record<string, unknown>) {
  return Object.values(rowMetrics(row))
    .map((cell) => (cell && typeof cell === "object" ? (cell as { citation?: { chunk_id?: string | null } | null }).citation : null))
    .find((citation) => citation && typeof citation === "object" && citation.chunk_id)?.chunk_id ?? null;
}

function MetricSourceButton({ id, label, onCitation }: { id: string | null; label: string; onCitation?: CitationHandler }) {
  if (!id || !onCitation) return null;
  return <button type="button" title="Open the cited source extract for this row" onClick={() => onCitation(id, label)} className="ml-1.5 rounded border border-caos-accent/50 px-1 py-px tabular text-caos-2xs text-caos-accent hover:bg-caos-elevated focus-ring">❝ src</button>;
}

function MetricObservation({ index, onCitation, row }: { index: number; onCitation?: CitationHandler; row: Record<string, unknown> }) {
  const issuer = rowIssuer(row);
  const issuerId = stringValue(issuer?.id) ?? stringValue(row.issuer_id);
  const label = stringValue(row.label) ?? stringValue(row.name) ?? stringValue(row.company) ?? stringValue(row.issuer_name) ?? stringValue(issuer?.name) ?? `Result ${index + 1}`;
  const issuerMeta = [stringValue(issuer?.ticker), stringValue(issuer?.industry)].filter(Boolean).join(" · ");
  const rowChunk = metricRowCitation(row);
  return <span className="font-semibold text-caos-text">
    {issuerId ? <IssuerLink issuer={{ id: issuerId }}>{label}</IssuerLink> : label}
    <MetricSourceButton id={rowChunk} label={label} onCitation={onCitation} />
    {issuerMeta ? <span className="block font-normal text-caos-2xs text-caos-muted">{issuerMeta}</span> : null}
  </span>;
}

function metricColumn(column: Record<string, unknown>, rankKey: string | null): DataTableColumn<Record<string, unknown>> {
  const key = stringValue(column.key) ?? "";
  return {
    key,
    header: stringValue(column.label) ?? key,
    align: "numeric",
    unit: stringValue(column.unit) ?? undefined,
    render: (row) => {
      const metrics = rowMetrics(row);
      const cell = metrics[key] && typeof metrics[key] === "object" ? (metrics[key] as Record<string, unknown>).value : undefined;
      const value = key === rankKey && cell === undefined ? row.rank_value : cell;
      return <span className={key === rankKey ? "text-caos-text" : "text-caos-muted"}>{value === undefined || value === null ? "—" : formatMetricValue(value)}</span>;
    },
  };
}

function metricDetails(row: Record<string, unknown>) {
  const issuer = rowIssuer(row);
  const issuerMeta = [stringValue(issuer?.ticker), stringValue(issuer?.industry)].filter(Boolean).join(" · ");
  if (issuerMeta) return issuerMeta;
  return Object.entries(row)
    .filter(([key]) => !["label", "name", "company", "issuer_name", "issuer", "metrics", "rank_value"].includes(key))
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${stringValue(value) ?? "…"}`)
    .join(" · ");
}

function fallbackMetricColumns(rankLabel: string, rankUnit: string): DataTableColumn<Record<string, unknown>>[] {
  return [
    { key: "rank-value", header: rankLabel, align: "numeric", unit: rankUnit || undefined, render: (row) => <span className="text-caos-text">{row.rank_value === undefined ? "—" : formatMetricValue(row.rank_value)}</span> },
    { key: "details", header: "Details", render: (row) => <span className="text-caos-muted">{metricDetails(row)}</span> },
  ];
}

function prepareMetricResult(run: QueryRun) {
  const answer = stringValue(run.result.answer) ?? stringValue(run.result.summary) ?? stringValue(run.result.synthesis) ?? stringValue(run.result.interpretation);
  const rows = resultRows(run);
  const rankKey = stringValue(run.result.rank_by);
  const columns = Array.isArray(run.result.columns) ? run.result.columns.filter((column): column is Record<string, unknown> => !!column && typeof column === "object") : [];
  const rankColumn = columns.find((column) => stringValue(column.key) === rankKey);
  const rankLabel = stringValue(rankColumn?.label) ?? rankKey ?? "Rank";
  const rankUnit = stringValue(rankColumn?.unit) ?? "";
  // Lead with a conclusion, not an echo of the question. When the backend
  // supplies no synthesis, compose a deterministic sentence from what the table
  // actually shows; the question renders as an eyebrow above, never as the answer.
  const composed = rows.length ? `Top ${rows.length} by ${rankLabel}${rankUnit ? ` (${rankUnit})` : ""}` : null;
  const headline = answer ?? composed ?? run.question;
  // The metric lane ranks by level. If the question asks about change/trend and
  // the result carries no delta marker, say so rather than implying it answered.
  const asksDelta = /deteriorat|worsen|improv|chang|trend|declin/i.test(run.question);
  const hasDelta = run.result.rank_is_delta === true || /delta|change|Δ/i.test(rankLabel);
  return { columns, headline, levelCaveat: asksDelta && !hasDelta, rankKey, rankLabel, rankUnit, rows, tableRows: rows.slice(0, 100) };
}

type MetricModel = ReturnType<typeof prepareMetricResult>;

function metricTableColumns(model: MetricModel, onCitation?: CitationHandler): DataTableColumn<Record<string, unknown>>[] {
  const valueColumns = model.columns.length
    ? model.columns.map((column) => metricColumn(column, model.rankKey))
    : fallbackMetricColumns(model.rankLabel, model.rankUnit);
  return [
    { key: "result-rank", header: "#", align: "numeric", render: (_row, index) => <span className="text-caos-accent">{index + 1}</span> },
    {
      key: "observation",
      header: "Observation",
      rowHeader: true,
      render: (row, index) => <MetricObservation index={index} onCitation={onCitation} row={row} />,
    },
    ...valueColumns,
  ];
}

function MetricResultsBody({ model, run, tableColumns }: { model: MetricModel; run: QueryRun; tableColumns: DataTableColumn<Record<string, unknown>>[] }) {
  if (!model.rows.length) return <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap border-t border-caos-border pt-3 text-caos-xs leading-relaxed text-caos-muted">{JSON.stringify(run.result, null, 2)}</pre>;
  return <div className="mt-3 overflow-auto border-t border-caos-border">
    <DataTable columns={tableColumns} rows={model.tableRows} getRowId={(row, index) => `${stringValue(row.issuer_id) ?? stringValue(row.label) ?? "result"}-${index}`} caption="Query metric results" rowClassName={() => "hover:bg-caos-elevated/40"} />
  </div>;
}

function MetricLaneResult({ run, onCitation }: { run: QueryRun; onCitation?: CitationHandler }) {
  const model = prepareMetricResult(run);
  const tableColumns = metricTableColumns(model, onCitation);
  return (
    <div className="min-h-0 overflow-auto p-3">
      <div className="rounded-md border border-caos-border bg-caos-panel p-3">
        <div className="flex flex-wrap items-center gap-2">
          <AnalysisStateBadge state={run.status} />
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{queryLaneLabel(run.selected_lane)}</span>
          {model.levelCaveat ? <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-warning" title="This lane ranks by current level, not by period-over-period change. Δ metrics are not yet available.">△ ranked by level, not change</span> : null}
        </div>
        {model.headline !== run.question ? <p className="mt-2 tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{run.question}</p> : null}
        <h2 className="mt-1 text-base font-semibold leading-snug text-caos-text">{model.headline}</h2>
        <MetricResultsBody model={model} run={run} tableColumns={tableColumns} />
      </div>
    </div>
  );
}

function QueryIncompleteResult({ run }: { run: QueryRun }) {
  const alternatives = Array.isArray(run.result.available_lanes)
    ? run.result.available_lanes.filter((lane): lane is QueryRun["selected_lane"] => lane === "metric" || lane === "graph" || lane === "grounded").map(queryLaneLabel).join(" · ")
    : `${queryLaneLabel("metric")} · ${queryLaneLabel("graph")}`;
  return <SurfaceState
    kind={run.status === "error" ? "error" : "partial"}
    title="Question preserved"
    detail={run.error ?? stringValue(run.result.recovery) ?? "The selected lane is incomplete."}
    supporting={<p className="tabular text-caos-xs uppercase tracking-wider text-caos-muted">Available alternatives · {alternatives}</p>}
    className="m-3"
  />;
}

function QueryResult({ run, onCitation }: { run: QueryRun; onCitation: CitationHandler }) {
  if (run.status === "partial" || run.status === "error") return <QueryIncompleteResult run={run} />;
  if (run.selected_lane === "graph") return <GraphLaneResult run={run} onCitation={onCitation} />;
  if (run.selected_lane === "grounded") return <GroundedLaneResult run={run} onCitation={onCitation} />;
  return <MetricLaneResult run={run} onCitation={onCitation} />;
}

type QueryUrlControl = ReturnType<typeof useTypedUrlState<(typeof QUERY_URL_KEYS)[number]>>;
type QueryContextState = ReturnType<typeof useAnalysisContext>;

function useQueryComposer(activeContextId: string | null, url: QueryUrlControl) {
  const [question, setQuestion] = useState("");
  const [lane, setLaneState] = useState<QueryRun["selected_lane"]>(() => url.values.lane === "graph" || url.values.lane === "grounded" ? url.values.lane : "metric");
  const [manualLane, setManualLane] = useState(false);
  const [draftContextId, setDraftContextId] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const updateUrl = url.update;
  const setLane = useCallback((next: QueryRun["selected_lane"]) => {
    setLaneState(next);
    updateUrl({ lane: next === "metric" ? null : next }, "replace");
  }, [updateUrl]);
  const setDraftQuestion = useCallback((value: string) => {
    setQuestion(value);
    if (activeContextId) writeQueryDraft(activeContextId, value);
  }, [activeContextId]);
  useEffect(() => {
    if (!activeContextId) {
      setQuestion("");
      setDraftContextId(null);
      return;
    }
    setQuestion(readQueryDraft(activeContextId));
    setDraftContextId(activeContextId);
  }, [activeContextId]);
  useEffect(() => {
    const onFocus = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text;
      if (text) {
        setDraftQuestion(text);
        if (!manualLane) setLane(inferLane(text));
      }
      composerRef.current?.focus();
    };
    window.addEventListener("caos:query-focus", onFocus);
    return () => window.removeEventListener("caos:query-focus", onFocus);
  }, [manualLane, setDraftQuestion, setLane]);
  useEffect(() => {
    if (url.values.lane === "graph" || url.values.lane === "grounded" || url.values.lane === "metric") setLaneState(url.values.lane);
    else if (url.values.lane === null) setLaneState("metric");
  }, [url.values.lane]);
  return { composerRef, draftContextId, lane, manualLane, question, setDraftQuestion, setLane, setManualLane };
}

function useQueryHistory(activeContextId: string | null, activeQuerySessionId: string | null, requestedRun: string | null) {
  const [run, setRun] = useState<QueryRun | null>(null);
  const [history, setHistory] = useState<QueryRun[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [hydratedContextId, setHydratedContextId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const historyGeneration = useRef(0);
  const historyContextId = useRef<string | null>(null);
  const runRef = useRef<QueryRun | null>(null);
  const setCurrentRun = useCallback((next: QueryRun | null) => {
    runRef.current = next;
    setRun(next);
  }, []);
  useEffect(() => {
    if (activeContextId && historyContextId.current === activeContextId && requestedRun && runRef.current?.id === requestedRun) {
      setHistoryError(null);
      setHydratedContextId(activeContextId);
      return;
    }
    const generation = ++historyGeneration.current;
    setHistoryError(null);
    setHydratedContextId(null);
    if (!activeContextId) {
      historyContextId.current = null;
      setHistory([]);
      setCurrentRun(null);
      return;
    }
    if (historyContextId.current !== activeContextId) {
      historyContextId.current = activeContextId;
      setHistory([]);
      setCurrentRun(null);
    } else if (requestedRun && runRef.current?.id !== requestedRun) {
      setCurrentRun(null);
    }
    analysisApi.listQueryRuns(activeContextId).then((rows) => {
      if (generation !== historyGeneration.current) return;
      setHistory(rows);
      const selectedId = requestedRun ?? activeQuerySessionId;
      const latest = selectedId ? rows.find((item) => item.id === selectedId) : null;
      if (selectedId) setCurrentRun(latest ?? null);
      setHydratedContextId(activeContextId);
    }).catch((error) => {
      if (generation !== historyGeneration.current) return;
      setHistoryError(toErrorMessage(error, "Saved investigations unavailable"));
      setHydratedContextId(activeContextId);
    });
    return () => { historyGeneration.current += 1; };
  }, [activeContextId, activeQuerySessionId, reloadToken, requestedRun, setCurrentRun]);
  return {
    history,
    historyError,
    hydratedContextId,
    retryHistory: () => setReloadToken((value) => value + 1),
    run,
    setHistory,
    setRun: setCurrentRun,
  };
}

function useQueryExecution(activeContextId: string | null) {
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const runGeneration = useRef(0);
  const runningRef = useRef(false);
  const activeContextIdRef = useRef<string | null>(activeContextId);
  activeContextIdRef.current = activeContextId;
  useEffect(() => {
    runGeneration.current += 1;
    runningRef.current = false;
    setRunning(false);
    setRunError(null);
  }, [activeContextId]);
  return { activeContextIdRef, runError, runGeneration, running, runningRef, setRunError, setRunning };
}

function useQueryCapabilities() {
  const [capabilityId, setCapabilityId] = useState("peer-set");
  const [capabilityError, setCapabilityError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    queryCapabilities().then((value) => {
      if (!current) return;
      const groups = (value as { groups?: Array<{ capabilities?: Array<{ id: string; enabled: boolean }> }> }).groups ?? [];
      const first = groups.flatMap((group) => group.capabilities ?? []).find((capability) => capability.enabled);
      if (first) setCapabilityId(first.id);
      setCapabilityError(null);
    }).catch((error) => {
      if (current) setCapabilityError(toErrorMessage(error, "Graph capabilities unavailable. Metric questions remain usable."));
    });
    return () => { current = false; };
  }, []);
  return { capabilityError, capabilityId, setCapabilityId };
}

function useQueryPinState() {
  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [findingsKey, setFindingsKey] = useState(0);
  const pinningRef = useRef(false);
  return { findingsKey, pinError, pinning, pinningRef, setFindingsKey, setPinError, setPinning };
}

function useQueryCitations(run: QueryRun | null) {
  const [citation, setCitation] = useState<{ id: string; label: string } | null>(null);
  const [citationMeta, setCitationMeta] = useState<Record<string, string>>({});
  const citationIds = run?.authority.source_ids;
  useEffect(() => {
    if (!citationIds?.length) { setCitationMeta({}); return; }
    let stale = false;
    void Promise.all(citationIds.slice(0, 20).map((sourceId) =>
      getChunk(sourceId)
        .then((chunk) => [sourceId, `${chunk.issuer_name} · ${chunk.doc}`] as const)
        // Non-chunk source ids (claim/evidence) 404 here — they keep the id prefix.
        .catch(() => null),
    )).then((entries) => {
      if (stale) return;
      setCitationMeta(Object.fromEntries(entries.filter((entry) => entry !== null)));
    });
    return () => { stale = true; };
  }, [citationIds]);
  return { citation, citationMeta, setCitation };
}

type QueryComposerState = ReturnType<typeof useQueryComposer>;
type QueryHistoryState = ReturnType<typeof useQueryHistory>;
type QueryExecutionState = ReturnType<typeof useQueryExecution>;
type QueryCapabilitiesState = ReturnType<typeof useQueryCapabilities>;
type QueryPinState = ReturnType<typeof useQueryPinState>;
type QueryCitationState = ReturnType<typeof useQueryCitations>;

interface QueryState {
  capabilities: QueryCapabilitiesState;
  citations: QueryCitationState;
  composer: QueryComposerState;
  contextState: QueryContextState;
  execution: QueryExecutionState;
  history: QueryHistoryState;
  pin: QueryPinState;
  url: QueryUrlControl;
}

async function runQuery(state: QueryState) {
  const contextId = state.contextState.context?.id ?? null;
  if (!contextId || !state.composer.question.trim() || state.execution.runningRef.current) return;
  const generation = ++state.execution.runGeneration.current;
  state.execution.runningRef.current = true;
  state.execution.setRunning(true);
  state.execution.setRunError(null);
  try {
    const next = await analysisApi.createQueryRun({
      context_id: contextId,
      question: state.composer.question.trim(),
      selected_lane: state.composer.lane,
      capability_id: state.composer.lane === "graph" ? state.capabilities.capabilityId : undefined,
    });
    if (generation !== state.execution.runGeneration.current || state.execution.activeContextIdRef.current !== contextId) return;
    state.history.setRun(next);
    state.url.update({ run: next.id, lane: next.selected_lane === "metric" ? null : next.selected_lane }, "replace");
    state.history.setHistory((current) => [next, ...current.filter((item) => item.id !== next.id)].slice(0, 100));
    state.contextState.setContext((current) => current?.id === contextId ? { ...current, query_session_id: next.id } : current);
  } catch (error) {
    if (generation === state.execution.runGeneration.current && state.execution.activeContextIdRef.current === contextId) {
      state.execution.setRunError(toErrorMessage(error, "Query could not be run"));
    }
  } finally {
    if (generation === state.execution.runGeneration.current && state.execution.activeContextIdRef.current === contextId) {
      state.execution.runningRef.current = false;
      state.execution.setRunning(false);
    }
  }
}

function queryPinTitle(run: QueryRun) {
  return stringValue(run.result.answer)
    ?? stringValue(run.result.summary)
    ?? stringValue(run.result.synthesis)
    ?? stringValue(run.result.interpretation)
    ?? run.question;
}

async function pinFinding(state: QueryState) {
  const context = state.contextState.context;
  const run = state.history.run;
  if (state.pin.pinningRef.current || !context || !run || !["ready", "observed-empty"].includes(run.status)) return;
  if (!run.authority.source_ids.length) return;
  state.pin.pinningRef.current = true;
  state.pin.setPinning(true);
  state.pin.setPinError(null);
  try {
    const title = queryPinTitle(run);
    await analysisApi.createFinding({
      context_id: context.id, kind: "query-answer", title,
      body: title === run.question ? "" : run.question,
      source_surface: "query", source_run_id: run.id,
      evidence: { source_ids: run.authority.source_ids, result: run.result },
    });
    state.pin.setFindingsKey((value) => value + 1);
  } catch (error) {
    state.pin.setPinError(toErrorMessage(error, "Finding was not pinned"));
  } finally {
    state.pin.pinningRef.current = false;
    state.pin.setPinning(false);
  }
}

function missingDependencies(run: QueryRun | null) {
  return Array.isArray(run?.result.missing_dependencies) ? run.result.missing_dependencies.map(String) : [];
}

function queryRequiredAction(run: QueryRun | null) {
  if (run?.status !== "ready") return "Choose a recovery lane";
  return run.authority.source_ids.length ? "Inspect citations and pin the finding" : "Attach citations before pinning — keep this draft";
}

function queryDecisionState(run: QueryRun | null): DecisionContextState {
  const missing = missingDependencies(run);
  return {
    whatChanged: datum(run, run ? `Query completed via ${queryLaneLabel(run.selected_lane)}` : null, missing),
    whyItMatters: datum(run, run?.question ?? null, missing),
    requiredAction: datum(run, queryRequiredAction(run), missing),
    evidenceHealth: datum(run, run ? `${run.authority.source_ids.length} cited sources · ${run.authority.freshness}` : null, missing),
  };
}

function useQueryController() {
  const contextState = useAnalysisContext({ name: "Cross-coverage investigation" });
  const url = useTypedUrlState(QUERY_URL_KEYS);
  const activeContextId = contextState.context?.id ?? null;
  const composer = useQueryComposer(activeContextId, url);
  const history = useQueryHistory(activeContextId, contextState.context?.query_session_id ?? null, url.values.run);
  const capabilities = useQueryCapabilities();
  const execution = useQueryExecution(activeContextId);
  const citations = useQueryCitations(history.run);
  const pin = useQueryPinState();
  const state: QueryState = { capabilities, citations, composer, contextState, execution, history, pin, url };
  const context = contextState.context;
  const contextReady = !!context
    && !contextState.loading
    && url.values.context === context.id
    && composer.draftContextId === context.id
    && history.hydratedContextId === context.id;
  return { contextReady, contextReadyReason: contextReady ? null : "Waiting for the investigation context to load", decisionState: queryDecisionState(history.run), state };
}

type QueryController = ReturnType<typeof useQueryController>;

function selectHistoryRun(state: QueryState, run: QueryRun) {
  state.history.setRun(run);
  state.composer.setDraftQuestion(run.question);
  state.composer.setLane(run.selected_lane);
  state.composer.setManualLane(true);
  state.url.update({ run: run.id }, "replace");
}

function LaneControls({ controller }: { controller: QueryController }) {
  const { contextReadyReason, state } = controller;
  return <div className="flex flex-wrap items-center gap-2">
    <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted">Selected lane</span>
    {(["metric", "graph", "grounded"] as const).map((lane) => <Button key={lane} variant="secondary" reason={contextReadyReason} aria-pressed={state.composer.lane === lane} onClick={() => { state.composer.setLane(lane); state.composer.setManualLane(true); }} className={state.composer.lane === lane ? "border-caos-accent text-caos-text" : ""}>{queryLaneLabel(lane)}</Button>)}
    {state.composer.manualLane ? <ActionReason reason={contextReadyReason} className="tabular text-caos-2xs text-caos-accent focus-ring aria-disabled:opacity-40" onClick={() => { state.composer.setManualLane(false); state.composer.setLane(inferLane(state.composer.question)); }}>Use suggested lane</ActionReason> : null}
  </div>;
}

function StarterQuestions({ controller }: { controller: QueryController }) {
  const { contextReadyReason, state } = controller;
  if (state.history.run) return null;
  return <div className="mt-2 flex flex-wrap gap-2">{STARTERS.map((starter) => <ActionReason
    key={starter}
    reason={contextReadyReason}
    aria-pressed={state.composer.question === starter}
    onClick={() => { state.composer.setDraftQuestion(starter); if (!state.composer.manualLane) state.composer.setLane(inferLane(starter)); }}
    className={`rounded-sm border px-2 py-1 text-left text-caos-xs focus-ring aria-disabled:opacity-40 ${state.composer.question === starter ? "border-caos-accent text-caos-accent" : "border-caos-border text-caos-muted hover:text-caos-text"}`}
  >{starter}</ActionReason>)}</div>;
}

function QueryComposer({ controller }: { controller: QueryController }) {
  const { contextReady, state } = controller;
  return <section className="border border-caos-border bg-caos-panel/70 p-3" aria-label="Query composer" aria-busy={!contextReady}>
    <LaneControls controller={controller} />
    <textarea
      ref={state.composer.composerRef}
      aria-label="Query coverage"
      disabled={!contextReady}
      value={state.composer.question}
      onChange={(event) => { const value = event.target.value; state.composer.setDraftQuestion(value); if (!state.composer.manualLane) state.composer.setLane(inferLane(value)); }}
      onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void runQuery(state); } }}
      rows={2}
      placeholder="Ask across coverage, evidence and published analysis…"
      className="mt-2 w-full resize-none rounded-md border border-caos-border bg-caos-bg px-3 py-2 text-caos-md text-caos-text placeholder:text-caos-muted focus-ring disabled:opacity-40"
    />
    <StarterQuestions controller={controller} />
    {state.capabilities.capabilityError ? <p className="mt-2 text-caos-xs text-caos-warning">△ {state.capabilities.capabilityError}</p> : null}
    {state.execution.runError ? <p role="alert" className="mt-2 text-caos-xs text-caos-critical">{state.execution.runError} <button type="button" className="ml-2 text-caos-accent focus-ring" onClick={() => void runQuery(state)}>Retry query</button></p> : null}
  </section>;
}

function QueryUtilities({ state }: { state: QueryState }) {
  const context = state.contextState.context;
  return <div className="space-y-4 text-caos-xs">
    <div>
      <h3 className="tabular uppercase tracking-wider text-caos-muted">Saved investigations</h3>
      {state.history.historyError ? <p role="alert" className="mt-2 text-caos-critical">{state.history.historyError}</p> : null}
      <ol className="mt-2 space-y-1">{state.history.history.slice(0, 8).map((item) => <li key={item.id}><button type="button" className="w-full rounded-sm px-2 py-1.5 text-left text-caos-text hover:bg-caos-elevated focus-ring" onClick={() => selectHistoryRun(state, item)}>{item.question}</button></li>)}</ol>
    </div>
    <details className="rounded-sm border border-caos-border p-2"><summary className="cursor-pointer tabular uppercase tracking-wider text-caos-muted focus-ring">Advanced</summary><div className="mt-2 grid gap-3"><label className="block">Capability ID<input name="query-capability" aria-label="Capability" autoComplete="off" value={state.capabilities.capabilityId} onChange={(event) => state.capabilities.setCapabilityId(event.target.value)} className="mt-1 w-full rounded-sm border border-caos-border bg-caos-bg px-2 py-1.5 text-caos-text focus-ring" /></label><div><h3 className="tabular uppercase tracking-wider text-caos-muted">Downstream consumers</h3><p className="mt-1 text-caos-text">Deep-Dive · Report Studio · Command · Monitor</p></div></div></details>
    {context ? <Link href={contextHref("/reports", context.id)} className="caos-action-secondary focus-ring no-underline">Open in Report Studio</Link> : null}
  </div>;
}

function QueryIdentity({ context }: { context: QueryContextState["context"] }) {
  return <><ConceptNav compact /><span className="h-4 w-px bg-caos-border" /><span className="text-caos-sm font-semibold text-caos-text">Query</span>{context ? <span className="tabular text-caos-2xs text-caos-muted">{context.name}</span> : null}</>;
}

function QueryStatus({ contextState }: { contextState: QueryContextState }) {
  if (contextState.loading) return <span className="tabular text-caos-2xs text-caos-muted">Loading context…</span>;
  if (contextState.error) return <span className="text-caos-xs text-caos-critical">{contextState.error}</span>;
  return <span className="tabular text-caos-2xs uppercase text-caos-accent">Shared governed workspace</span>;
}

function QueryPrimaryAction({ controller }: { controller: QueryController }): PageAction {
  const { contextReadyReason, state } = controller;
  const reason = contextReadyReason ?? (!state.composer.question.trim() ? "Enter a question first" : state.execution.running ? "Running…" : null);
  return {
    label: "Run Query",
    onAction: () => { void runQuery(state); },
    unavailableReason: reason,
  };
}

function QueryResultSurface({ state }: { state: QueryState }) {
  const run = state.history.run!;
  const result = <QueryResult run={run} onCitation={(id, label) => state.citations.setCitation({ id, label })} />;
  return <section className="min-h-0 h-full overflow-hidden border border-caos-border" aria-label="Query answer">
    {run.selected_lane === "metric" && resultRows(run).length ? <DominantTableRegion ownerId="query-result" label="Query result table" className="h-full">{result}</DominantTableRegion> : result}
  </section>;
}

function QueryPreRunSurface({ controller }: { controller: QueryController }) {
  return <section className="min-h-0 h-full overflow-auto border border-caos-border grid place-items-center p-6" aria-label="Query answer">
    <div className="w-full max-w-2xl text-center">
      <p className="tabular text-caos-xs uppercase tracking-widest text-caos-accent">Investigation ready</p>
      <h2 className="mt-2 text-lg font-semibold text-caos-text">Ask one cross-coverage question.</h2>
      <p className="mx-auto mt-2 max-w-[65ch] text-caos-sm leading-relaxed text-caos-muted">The lane is declared before execution. No graph, model overlay or report is generated until you run it.</p>
      <div className="mt-5 text-left"><QueryComposer controller={controller} /></div>
    </div>
  </section>;
}

function QueryPrimary({ controller }: { controller: QueryController }) {
  const { state } = controller;
  if (state.history.run) return <QueryResultSurface state={state} />;
  if (state.url.values.run && state.history.historyError) {
    return <section className="min-h-0 h-full overflow-auto border border-caos-border p-3" aria-label="Query answer">
      <SurfaceState
        kind="error"
        title="Selected investigation unavailable"
        detail={state.history.historyError}
        headingLevel={2}
        primaryAction={<button type="button" className="caos-action-primary focus-ring" onClick={state.history.retryHistory}>Retry investigation</button>}
      />
    </section>;
  }
  return <QueryPreRunSurface controller={controller} />;
}

function pinReason(state: QueryState) {
  const run = state.history.run;
  if (!run || !["ready", "observed-empty"].includes(run.status)) return "Only a completed run can be pinned";
  if (!run.authority.source_ids.length) return "Attach citations before pinning — draft results can't enter the tray";
  return state.pin.pinning ? "Pinning…" : null;
}

function QueryPinAction({ state }: { state: QueryState }) {
  if (!state.history.run) return null;
  return <ActionReason reason={pinReason(state)} reasonDisplay="hidden" onClick={() => void pinFinding(state)} className="caos-action-secondary ml-auto focus-ring">{state.pin.pinning ? "Pinning…" : "Pin finding"}</ActionReason>;
}

function QueryCitationRegister({ state }: { state: QueryState }) {
  const run = state.history.run!;
  const sourceIds = run.authority.source_ids;
  return <div className="mt-4">
    <h3 className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Claims and citations</h3>
    <p className="mt-1 text-caos-xs leading-relaxed text-caos-text">{sourceIds.length ? `${sourceIds.length} cited sources — open one to read the underlying extract.` : "No citation identifiers were attached; keep this result in draft."}</p>
    {sourceIds.length ? <ol className="mt-2 space-y-1">{sourceIds.slice(0, 20).map((id, index) => <li key={id}><button type="button" title={`Open source extract · ${id}`} onClick={() => state.citations.setCitation({ id, label: `C${index + 1}` })} className="w-full rounded-sm px-1 py-0.5 text-left tabular text-caos-xs text-caos-muted hover:bg-caos-elevated hover:text-caos-text focus-ring"><span className="text-caos-accent">C{index + 1}</span> · {state.citations.citationMeta[id] ?? `${id.slice(0, 8)}…`} <span className="text-caos-accent">↗</span></button></li>)}</ol> : null}
  </div>;
}

function QueryRunDetails({ state }: { state: QueryState }) {
  const run = state.history.run;
  if (!run) return <p className="mt-3 text-caos-xs text-caos-muted">Run an investigation to inspect its method, caveats and citations.</p>;
  return <>
    <div className="mt-3"><AuthorityLine authority={run.authority} /></div>
    <QueryCitationRegister state={state} />
  </>;
}

function QueryInspector({ state }: { state: QueryState }) {
  const context = state.contextState.context;
  return <aside className="min-h-0 overflow-auto border border-caos-border bg-caos-panel/50 p-3" aria-label="Query evidence inspector">
    <div className="flex items-center gap-2"><h2 className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-text">Evidence inspector</h2><QueryPinAction state={state} /></div>
    {state.pin.pinError ? <p role="alert" className="mt-2 text-caos-xs text-caos-critical">{state.pin.pinError} <button type="button" className="ml-2 text-caos-accent focus-ring" onClick={() => void pinFinding(state)}>Retry pin</button></p> : null}
    <QueryRunDetails state={state} />
    {context ? <div className="mt-4"><FindingsTray contextId={context.id} refreshKey={state.pin.findingsKey} /></div> : null}
  </aside>;
}

function QueryWorkspace({ controller }: { controller: QueryController }) {
  const run = controller.state.history.run;
  const selectedRunError = !!controller.state.url.values.run && !!controller.state.history.historyError;
  const contextRail = run || selectedRunError
    ? <QueryComposer controller={controller} />
    : <section className="border border-caos-border bg-caos-panel/70 p-3" aria-label="Query composer note"><p className="text-caos-xs leading-relaxed text-caos-muted">TIP · Choose the method before running — compare metrics, map relationships, or research with citations.</p></section>;
  return <section aria-label="Query investigation workspace" className="caos-persona-route query-workbench min-h-0 flex-1 overflow-hidden p-2">
    <PersonaWorkbench
      surface="query"
      decision={<DecisionHeader state={controller.decisionState} defaultOpen={!!run} />}
      context={contextRail}
      primary={<QueryPrimary controller={controller} />}
      inspector={<QueryInspector state={controller.state} />}
    />
  </section>;
}

function QueryCitationViewer({ state }: { state: QueryState }) {
  return state.citations.citation ? <CitationViewer chunkId={state.citations.citation.id} label={state.citations.citation.label} onClose={() => state.citations.setCitation(null)} /> : null;
}

export function QueryInvestigationWorkbench() {
  const controller = useQueryController();
  const { state } = controller;
  return <EnterprisePage
    kind="analytical"
    identity={<QueryIdentity context={state.contextState.context} />}
    status={<QueryStatus contextState={state.contextState} />}
    primaryAction={QueryPrimaryAction({ controller })}
    contextualControls={<>{headStat("Lane", state.composer.lane)}{headStat("History", `${state.history.history.length} runs`)}</>}
    utilityLabel="Query utilities"
    utilityControls={<QueryUtilities state={state} />}
    narrowContract={{ essentialControls: null }}
  >
    <QueryWorkspace controller={controller} />
    <QueryCitationViewer state={state} />
  </EnterprisePage>;
}
