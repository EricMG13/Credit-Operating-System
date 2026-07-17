"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { ActionReason } from "@/components/shared/ActionReason";
import { AnalysisStateBadge, AuthorityLine, FindingsTray } from "@/components/shared/AnalysisWorkbench";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { CitationViewer } from "@/components/command/CitationViewer";
import { headStat } from "@/components/shared/headStat";
import { getChunk, queryCapabilities, toErrorMessage } from "@/lib/api";
import { fmtUtcDateTime } from "@/lib/format-date";
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

function inferLane(question: string): QueryRun["selected_lane"] {
  if (/\b(graph|link|connected|relationship|contagion|lineage)\b/i.test(question)) return "graph";
  if (/\b(why|explain|evidence|source|caveat|thesis)\b/i.test(question)) return "grounded";
  return "metric";
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

function QueryResult({ run, onCitation }: { run: QueryRun | null; onCitation?: (id: string, label: string) => void }) {
  if (!run) {
    return (
      <div className="h-full grid place-items-center p-6 text-center">
        <SurfaceState
          kind="not-run"
          title="Ask one cross-coverage question."
          detail="The lane is declared before execution. No graph, model overlay or report is generated until you run it."
          className="max-w-xl"
        />
      </div>
    );
  }
  if (run.status === "partial" || run.status === "error") {
    const alternatives = Array.isArray(run.result.available_lanes) ? run.result.available_lanes.join(" · ") : "metric · graph";
    return (
      <SurfaceState
        kind={run.status}
        title="Question preserved"
        detail={run.error ?? stringValue(run.result.recovery) ?? "The selected lane is incomplete."}
        supporting={<p className="tabular text-caos-xs uppercase tracking-wider text-caos-muted">Available alternatives · {alternatives}</p>}
        className="m-3"
      />
    );
  }
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
  const levelCaveat = asksDelta && !hasDelta;
  return (
    <div className="min-h-0 overflow-auto p-3">
      <div className="rounded-md border border-caos-border bg-caos-panel p-3">
        <div className="flex flex-wrap items-center gap-2">
          <AnalysisStateBadge state={run.status} />
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Native {run.selected_lane} view</span>
          {levelCaveat ? <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-warning" title="This lane ranks by current level, not by period-over-period change. Δ metrics are not yet available.">△ ranked by level, not change</span> : null}
        </div>
        {headline !== run.question ? <p className="mt-2 tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{run.question}</p> : null}
        <h2 className="mt-1 text-base font-semibold leading-snug text-caos-text">{headline}</h2>
        {rows.length ? (
          <div className="mt-3 overflow-auto border-t border-caos-border">
            <table className="w-full border-collapse text-left tabular text-caos-xs">
              <thead className="sticky top-0 bg-caos-panel text-caos-muted">
                {/* Every backend column renders as a real column — the old
                    table showed only the rank metric and flattened the rest
                    into a prose "Details" cell, so a synthesis promising two
                    metrics delivered a table showing one. */}
                <tr>
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Observation</th>
                  {columns.length ? columns.map((column) => {
                    const key = stringValue(column.key) ?? "";
                    const unit = stringValue(column.unit);
                    return <th key={key} className={`px-2 py-2 text-right ${key === rankKey ? "text-caos-accent" : ""}`}>{stringValue(column.label) ?? key}{unit ? ` (${unit})` : ""}</th>;
                  }) : <th className="px-2 py-2 text-right">{rankLabel}{rankUnit ? ` (${rankUnit})` : ""}</th>}
                  {!columns.length ? <th className="px-2 py-2">Details</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((row, index) => {
                  const issuer = rowIssuer(row);
                  const issuerId = stringValue(issuer?.id) ?? stringValue(row.issuer_id);
                  const label = stringValue(row.label) ?? stringValue(row.name) ?? stringValue(row.company) ?? stringValue(row.issuer_name) ?? stringValue(issuer?.name) ?? `Result ${index + 1}`;
                  const issuerMeta = [stringValue(issuer?.ticker), stringValue(issuer?.industry)].filter(Boolean).join(" · ");
                  const metrics = row.metrics && typeof row.metrics === "object" && !Array.isArray(row.metrics) ? row.metrics as Record<string, unknown> : {};
                  // Unit lives in the column header; bare tabular numbers so
                  // decimals align down the column (DESIGN.md aligned-decimals).
                  const rankCell = row.rank_value === undefined ? "—" : formatMetricValue(row.rank_value);
                  const details = issuerMeta || Object.entries(row).filter(([key]) => !["label", "name", "company", "issuer_name", "issuer", "metrics", "rank_value"].includes(key)).slice(0, 4).map(([key, value]) => `${key}: ${stringValue(value) ?? "…"}`).join(" · ");
                  // Row-level click-to-source: the first chunk-cited metric backs
                  // the row's chip, so tying a figure to its document never
                  // requires opening every citation and matching from memory.
                  const rowChunk = onCitation ? Object.values(metrics)
                    .map((cell) => (cell && typeof cell === "object" ? (cell as { citation?: { chunk_id?: string | null } | null }).citation : null))
                    .find((cite) => cite && typeof cite === "object" && cite.chunk_id)?.chunk_id ?? null : null;
                  return <tr key={`${label}-${index}`} className="border-t border-caos-border/70 hover:bg-caos-elevated/40">
                    <td className="px-2 py-2 text-caos-accent">{index + 1}</td>
                    <td className="px-2 py-2 font-semibold text-caos-text">{issuerId ? <IssuerLink issuer={{ id: issuerId }}>{label}</IssuerLink> : label}{rowChunk ? <button type="button" title="Open the cited source extract for this row" onClick={() => onCitation?.(rowChunk, label)} className="ml-1.5 tabular text-caos-2xs px-1 py-px rounded border border-caos-accent/50 text-caos-accent hover:bg-caos-elevated focus-ring">❝ src</button> : null}{issuerMeta ? <span className="block font-normal text-caos-2xs text-caos-muted">{issuerMeta}</span> : null}</td>
                    {columns.length ? columns.map((column) => {
                      const key = stringValue(column.key) ?? "";
                      const cell = metrics[key] && typeof metrics[key] === "object" ? (metrics[key] as Record<string, unknown>).value : undefined;
                      const value = key === rankKey && cell === undefined ? row.rank_value : cell;
                      return <td key={key} className={`px-2 py-2 text-right ${key === rankKey ? "text-caos-text" : "text-caos-muted"}`}>{value === undefined || value === null ? "—" : formatMetricValue(value)}</td>;
                    }) : <td className="px-2 py-2 text-right text-caos-text">{rankCell}</td>}
                    {!columns.length ? <td className="px-2 py-2 text-caos-muted">{details}</td> : null}
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap border-t border-caos-border pt-3 text-caos-xs leading-relaxed text-caos-muted">{JSON.stringify(run.result, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}

export function QueryInvestigationWorkbench() {
  const contextState = useAnalysisContext({ name: "Cross-coverage investigation" });
  const { values: urlState, update: updateUrlState } = useTypedUrlState(QUERY_URL_KEYS);
  const [question, setQuestion] = useState("");
  const [lane, setLaneState] = useState<QueryRun["selected_lane"]>(() => urlState.lane === "graph" || urlState.lane === "grounded" ? urlState.lane : "metric");
  const [manualLane, setManualLane] = useState(false);
  const [run, setRun] = useState<QueryRun | null>(null);
  const [history, setHistory] = useState<QueryRun[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [capabilityId, setCapabilityId] = useState("peer-set");
  const [capabilityError, setCapabilityError] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  // Click-to-source for the citation register — every C-n identifier opens the
  // underlying document extract (or an explicit failure) instead of sitting as
  // inert text on the surface whose required action says "inspect citations".
  const [citation, setCitation] = useState<{ id: string; label: string } | null>(null);
  // Resolved citation labels (issuer · document) — a bare UUID prefix forces the
  // analyst to open every extract and match issuers from memory. Chunk-backed
  // ids resolve; non-chunk ids (claim/evidence) keep the id prefix.
  const [citationMeta, setCitationMeta] = useState<Record<string, string>>({});
  const [findingsKey, setFindingsKey] = useState(0);
  const historyGeneration = useRef(0);
  const historyContextId = useRef<string | null>(null);
  const runGeneration = useRef(0);
  const runningRef = useRef(false);
  const pinningRef = useRef(false);
  const activeContextId = contextState.context?.id ?? null;
  const activeQuerySessionId = contextState.context?.query_session_id ?? null;
  const activeContextIdRef = useRef<string | null>(activeContextId);
  activeContextIdRef.current = activeContextId;
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const setLane = useCallback((next: QueryRun["selected_lane"]) => {
    setLaneState(next);
    updateUrlState({ lane: next === "metric" ? null : next }, "replace");
  }, [updateUrlState]);

  // Ask.tsx's openWith() redirects ⌘K "Ask CAOS: <text>" here on /query — it
  // used to dispatch a bare Event with no payload, so the composer was never
  // even focused, let alone prefilled, and the typed question was silently
  // dropped. `detail?.text` is undefined for the plain Alt+K/header-button
  // toggle (which only wants a focus, no prefill change).
  useEffect(() => {
    const onFocus = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text;
      if (text) {
        setQuestion(text);
        if (!manualLane) setLane(inferLane(text));
      }
      composerRef.current?.focus();
    };
    window.addEventListener("caos:query-focus", onFocus);
    return () => window.removeEventListener("caos:query-focus", onFocus);
  }, [manualLane, setLane]);

  useEffect(() => {
    // A run belongs to the exact context that created it. Scope navigation
    // invalidates the completion synchronously via the render-updated ref and
    // resets the pending UI when the new context commits.
    runGeneration.current += 1;
    runningRef.current = false;
    setRunning(false);
    setRunError(null);
  }, [activeContextId]);

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

  useEffect(() => {
    if (urlState.lane === "graph" || urlState.lane === "grounded" || urlState.lane === "metric") {
      setLaneState(urlState.lane);
    } else if (urlState.lane === null) {
      setLaneState("metric");
    }
  }, [urlState.lane]);

  useEffect(() => {
    const generation = ++historyGeneration.current;
    setHistory([]);
    setHistoryError(null);
    if (!activeContextId) {
      historyContextId.current = null;
      setRun(null);
      return;
    }
    if (historyContextId.current !== activeContextId) {
      historyContextId.current = activeContextId;
      setRun(null);
    }
    analysisApi.listQueryRuns(activeContextId).then((rows) => {
      if (generation !== historyGeneration.current) return;
      setHistory(rows);
      if (urlState.run || activeQuerySessionId) {
        const latest = rows.find((item) => item.id === (urlState.run ?? activeQuerySessionId));
        if (latest) setRun(latest);
      }
    }).catch((error) => {
      if (generation === historyGeneration.current) {
        setHistoryError(toErrorMessage(error, "Saved investigations unavailable"));
      }
    });
    return () => { historyGeneration.current += 1; };
  }, [activeContextId, activeQuerySessionId, urlState.run]);

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

  const setAnalysisContext = contextState.setContext;
  const runQuery = useCallback(async () => {
    if (!activeContextId || !question.trim() || runningRef.current) return;
    const generation = ++runGeneration.current;
    const contextId = activeContextId;
    runningRef.current = true;
    setRunning(true);
    setRunError(null);
    try {
      const next = await analysisApi.createQueryRun({
        context_id: contextId,
        question: question.trim(),
        selected_lane: lane,
        capability_id: lane === "graph" ? capabilityId : undefined,
      });
      if (generation !== runGeneration.current || activeContextIdRef.current !== contextId) return;
      setRun(next);
      updateUrlState({ run: next.id, lane: next.selected_lane === "metric" ? null : next.selected_lane }, "replace");
      setHistory((current) => [next, ...current.filter((item) => item.id !== next.id)].slice(0, 100));
      setAnalysisContext((current) => current?.id === contextId
        ? { ...current, query_session_id: next.id }
        : current);
    } catch (error) {
      if (generation === runGeneration.current && activeContextIdRef.current === contextId) {
        setRunError(toErrorMessage(error, "Query could not be run"));
      }
    } finally {
      if (generation === runGeneration.current && activeContextIdRef.current === contextId) {
        runningRef.current = false;
        setRunning(false);
      }
    }
  }, [activeContextId, capabilityId, lane, question, setAnalysisContext, updateUrlState]);

  const missing = useMemo(() => Array.isArray(run?.result.missing_dependencies) ? run.result.missing_dependencies.map(String) : [], [run]);
  const decisionState: DecisionContextState = {
    whatChanged: datum(run, run ? `Query completed via ${run.selected_lane}` : null, missing),
    whyItMatters: datum(run, run?.question ?? null, missing),
    requiredAction: datum(run, run?.status === "ready" ? (run.authority.source_ids.length === 0 ? "Attach citations before pinning — keep this draft" : "Inspect citations and pin the finding") : "Choose a recovery lane", missing),
    evidenceHealth: datum(run, run ? `${run.authority.source_ids.length} cited sources · ${run.authority.freshness}` : null, missing),
  };

  const pinFinding = async () => {
    // Same rule the button's reason states: no citations, no pin. CP-5 would
    // refuse to ratify an uncited finding anyway — block it at the source.
    if (pinningRef.current || !contextState.context || !run || !["ready", "observed-empty"].includes(run.status)) return;
    if (run.authority.source_ids.length === 0) return;
    pinningRef.current = true;
    setPinning(true);
    setPinError(null);
    try {
      // Title mirrors the on-screen headline chain; the question goes in the
      // body ONLY when it isn't already the title — otherwise the pinned card
      // printed the same sentence twice (bold title + muted body).
      const pinTitle =
        stringValue(run.result.answer) ??
        stringValue(run.result.summary) ??
        stringValue(run.result.synthesis) ??
        stringValue(run.result.interpretation) ??
        run.question;
      await analysisApi.createFinding({
        context_id: contextState.context.id,
        kind: "query-answer",
        title: pinTitle,
        body: pinTitle === run.question ? "" : run.question,
        source_surface: "query",
        source_run_id: run.id,
        evidence: { source_ids: run.authority.source_ids, result: run.result },
      });
      setFindingsKey((value) => value + 1);
    } catch (error) {
      setPinError(toErrorMessage(error, "Finding was not pinned"));
    } finally {
      pinningRef.current = false;
      setPinning(false);
    }
  };

  const context = contextState.context;
  // The context row and its URL binding are one readiness boundary. Publishing
  // controls after the row arrives but before `?context=` lands lets a slower
  // browser accept input that the pending history update can then overwrite.
  const contextReady = !!context
    && !contextState.loading
    && urlState.context === context.id;
  // The RoleViewSwitch in the compact header already shows the active view —
  // repeating it here was the double "View:" the critique flagged.
  const narrow = { essentialControls: null };
  // One composer, two homes: the dominant region pre-run, the context rail
  // once results exist.
  const composer = (
    <section className="border border-caos-border bg-caos-panel/70 p-3" aria-label="Query composer" aria-busy={!contextReady}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted">Selected lane</span>
        {(["metric", "graph", "grounded"] as const).map((value) => <button key={value} type="button" disabled={!contextReady} aria-pressed={lane === value} onClick={() => { setLane(value); setManualLane(true); }} className={`caos-action-secondary focus-ring disabled:opacity-40 ${lane === value ? "border-caos-accent text-caos-text" : ""}`}>{value}</button>)}
        {manualLane ? <button type="button" disabled={!contextReady} className="tabular text-caos-2xs text-caos-accent focus-ring disabled:opacity-40" onClick={() => { setManualLane(false); setLane(inferLane(question)); }}>Use suggested lane</button> : null}
      </div>
      <textarea ref={composerRef} aria-label="Query coverage" disabled={!contextReady} value={question} onChange={(event) => { const value = event.target.value; setQuestion(value); if (!manualLane) setLane(inferLane(value)); }} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void runQuery(); } }} rows={2} placeholder="Ask across coverage, evidence and published analysis…" className="mt-2 w-full resize-none rounded-md border border-caos-border bg-caos-bg px-3 py-2 text-caos-md text-caos-text placeholder:text-caos-muted focus-ring disabled:opacity-40" />
      {!run ? <div className="mt-2 flex flex-wrap gap-2">{STARTERS.map((starter) => <button type="button" disabled={!contextReady} key={starter} aria-pressed={question === starter} onClick={() => { setQuestion(starter); if (!manualLane) setLane(inferLane(starter)); }} className={"rounded-sm border px-2 py-1 text-left text-caos-xs focus-ring disabled:opacity-40 " + (question === starter ? "border-caos-accent text-caos-accent" : "border-caos-border text-caos-muted hover:text-caos-text")}>{starter}</button>)}</div> : null}
      {capabilityError ? <p className="mt-2 text-caos-xs text-caos-warning">△ {capabilityError}</p> : null}
      {runError ? <p role="alert" className="mt-2 text-caos-xs text-caos-critical">{runError} <button type="button" className="ml-2 text-caos-accent focus-ring" onClick={() => void runQuery()}>Retry query</button></p> : null}
    </section>
  );
  return (
    <EnterprisePage
      kind="analytical"
      identity={<><ConceptNav compact /><span className="h-4 w-px bg-caos-border" /><span className="text-caos-sm font-semibold text-caos-text">Query</span>{context ? <span className="tabular text-caos-2xs text-caos-muted">{context.name}</span> : null}</>}
      status={contextState.loading ? <span className="tabular text-caos-2xs text-caos-muted">Loading context…</span> : contextState.error ? <span className="text-caos-xs text-caos-critical">{contextState.error}</span> : <span className="tabular text-caos-2xs uppercase text-caos-accent">Composition only · permissions unchanged</span>}
      primaryAction={<button type="button" onClick={() => void runQuery()} disabled={!context || !question.trim() || running} className="caos-primary-action focus-ring disabled:opacity-40">{running ? "Running…" : "Run Query"}</button>}
      contextualControls={<>{headStat("Lane", lane)}{headStat("History", `${history.length} runs`)}</>}
      utilityLabel="Query utilities"
      utilityControls={<div className="space-y-4 text-caos-xs"><div><h3 className="tabular uppercase tracking-wider text-caos-muted">Saved investigations</h3>{historyError ? <p role="alert" className="mt-2 text-caos-critical">{historyError}</p> : null}<ol className="mt-2 space-y-1">{history.slice(0, 8).map((item) => <li key={item.id}><button type="button" className="w-full rounded-sm px-2 py-1.5 text-left text-caos-text hover:bg-caos-elevated focus-ring" onClick={() => { setRun(item); setQuestion(item.question); setLane(item.selected_lane); setManualLane(true); updateUrlState({ run: item.id }, "replace"); }}>{item.question}</button></li>)}</ol></div><div><h3 className="tabular uppercase tracking-wider text-caos-muted">Advanced graph</h3><label className="mt-2 block">Capability<input value={capabilityId} onChange={(event) => setCapabilityId(event.target.value)} className="mt-1 w-full rounded-sm border border-caos-border bg-caos-bg px-2 py-1.5 text-caos-text focus-ring" /></label></div>{context ? <Link href={contextHref("/reports", context.id)} className="caos-action-secondary focus-ring no-underline">Open in Report Studio</Link> : null}</div>}
      narrowContract={narrow}
    >
      <main className="caos-persona-route query-workbench min-h-0 flex-1 overflow-hidden p-2">
        <PersonaWorkbench
          surface="query"
          decision={<DecisionHeader state={decisionState} defaultOpen={!!run} />}
          context={run ? composer : <section className="border border-caos-border bg-caos-panel/70 p-3" aria-label="Query composer note"><p className="text-caos-xs leading-relaxed text-caos-muted">TIP · Declare the lane before running — metric ranks coverage, graph traverses relationships, grounded answers from cited documents.</p></section>}
          primary={run
            ? <section className="min-h-0 h-full overflow-hidden border border-caos-border" aria-label="Query answer">{resultRows(run).length ? <DominantTableRegion ownerId="query-result" label="Query result table" className="h-full"><QueryResult run={run} onCitation={(id, label) => setCitation({ id, label })} /></DominantTableRegion> : <QueryResult run={run} onCitation={(id, label) => setCitation({ id, label })} />}</section>
            : <section className="min-h-0 h-full overflow-auto border border-caos-border grid place-items-center p-6" aria-label="Query answer">
              {/* Pre-run, the question IS the work — the composer owns the
                  dominant region instead of a blank canvas dwarfing a
                  sidebar-width input (2026-07-16 critique H8). */}
              <div className="w-full max-w-2xl text-center">
                <p className="tabular text-caos-xs uppercase tracking-widest text-caos-accent">Investigation ready</p>
                <h2 className="mt-2 text-lg font-semibold text-caos-text">Ask one cross-coverage question.</h2>
                <p className="mx-auto mt-2 max-w-[65ch] text-caos-sm leading-relaxed text-caos-muted">The lane is declared before execution. No graph, model overlay or report is generated until you run it.</p>
                <div className="mt-5 text-left">{composer}</div>
              </div>
            </section>}
          inspector={<aside className="min-h-0 overflow-auto border border-caos-border bg-caos-panel/50 p-3" aria-label="Query evidence inspector">
            <div className="flex items-center gap-2"><h2 className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-text">Evidence inspector</h2>{run ? <ActionReason
              reason={!["ready", "observed-empty"].includes(run.status)
                ? "Only a completed run can be pinned"
                : run.authority.source_ids.length === 0
                ? "Attach citations before pinning — draft results can't enter the tray"
                : pinning ? "Pinning…" : null}
              reasonDisplay="hidden"
              onClick={() => void pinFinding()}
              className="caos-action-secondary ml-auto focus-ring"
            >{pinning ? "Pinning…" : "Pin finding"}</ActionReason> : null}</div>
            {pinError ? <p role="alert" className="mt-2 text-caos-xs text-caos-critical">{pinError} <button type="button" className="ml-2 text-caos-accent focus-ring" onClick={() => void pinFinding()}>Retry pin</button></p> : null}
            {run ? <><div className="mt-3"><AuthorityLine authority={run.authority} /></div><div className="mt-4"><h3 className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Claims and citations</h3><p className="mt-1 text-caos-xs leading-relaxed text-caos-text">{run.authority.source_ids.length ? `${run.authority.source_ids.length} cited sources — open one to read the underlying extract.` : "No citation identifiers were attached; keep this result in draft."}</p>{run.authority.source_ids.length ? <ol className="mt-2 space-y-1">{run.authority.source_ids.slice(0, 20).map((id, index) => <li key={id}><button type="button" title={`Open source extract · ${id}`} onClick={() => setCitation({ id, label: `C${index + 1}` })} className="w-full rounded-sm px-1 py-0.5 text-left tabular text-caos-xs text-caos-muted hover:bg-caos-elevated hover:text-caos-text focus-ring"><span className="text-caos-accent">C{index + 1}</span> · {citationMeta[id] ?? `${id.slice(0, 8)}…`} <span className="text-caos-accent">↗</span></button></li>)}</ol> : null}</div><div className="mt-4"><h3 className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Downstream consumers</h3><p className="mt-1 text-caos-xs text-caos-text">Deep-Dive · Report Studio · Command · Monitor</p></div></> : <p className="mt-3 text-caos-xs text-caos-muted">Run an investigation to inspect its method, caveats and citations.</p>}
            {context ? <div className="mt-4"><FindingsTray contextId={context.id} refreshKey={findingsKey} /></div> : null}
          </aside>}
        />
      </main>
      {citation ? <CitationViewer chunkId={citation.id} label={citation.label} onClose={() => setCitation(null)} /> : null}
    </EnterprisePage>
  );
}
