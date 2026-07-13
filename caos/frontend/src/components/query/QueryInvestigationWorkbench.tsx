"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { useRoleView } from "@/components/shared/RoleViewProvider";
import { AnalysisStateBadge, AuthorityLine, FindingsTray } from "@/components/shared/AnalysisWorkbench";
import { headStat } from "@/components/shared/headStat";
import { queryCapabilities } from "@/lib/api";
import {
  analysisApi,
  contextHref,
  useAnalysisContext,
  type AuthorityEnvelope,
  type QueryRun,
} from "@/lib/analysis-workbench";
import type { DecisionAuthority, DecisionContextState, DecisionDatumState } from "@/lib/decision-state";

const STARTERS = [
  "Which credits have the largest leverage deterioration?",
  "Show evidence linking refinancing risk to sector posture.",
  "Compare recovery assumptions across the selected instruments.",
];

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
    asOf: run.authority.as_of ?? run.updated_at,
    authority: decisionAuthority(run.authority),
  };
  if (run.status === "observed-empty") return {
    kind: "observed-empty",
    message: "Successful query returned no qualifying observations.",
    asOf: run.authority.as_of ?? run.updated_at,
    authority: decisionAuthority(run.authority),
  };
  return {
    kind: "ready",
    value,
    asOf: run.authority.as_of ?? run.updated_at,
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
  return Math.abs(value) >= 100 ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function QueryResult({ run }: { run: QueryRun | null }) {
  if (!run) {
    return (
      <div className="h-full grid place-items-center p-6 text-center">
        <div className="max-w-xl">
          <p className="tabular text-caos-xs uppercase tracking-widest text-caos-accent">Investigation ready</p>
          <h2 className="mt-2 text-lg font-semibold text-caos-text">Ask one cross-coverage question.</h2>
          <p className="mt-2 text-caos-sm leading-relaxed text-caos-muted">The lane is declared before execution. No graph, model overlay or report is generated until you run it.</p>
        </div>
      </div>
    );
  }
  if (run.status === "partial" || run.status === "error") {
    const alternatives = Array.isArray(run.result.available_lanes) ? run.result.available_lanes.join(" · ") : "metric · graph";
    return (
      <div className="m-3 rounded-md border border-caos-warning/50 bg-caos-warning/5 p-4" role="status">
        <AnalysisStateBadge state={run.status} />
        <h2 className="mt-2 text-caos-md font-semibold text-caos-text">Question preserved</h2>
        <p className="mt-1 text-caos-sm text-caos-muted">{run.error ?? stringValue(run.result.recovery) ?? "The selected lane is incomplete."}</p>
        <p className="mt-3 tabular text-caos-xs uppercase tracking-wider text-caos-muted">Available alternatives · {alternatives}</p>
      </div>
    );
  }
  const answer = stringValue(run.result.answer) ?? stringValue(run.result.summary) ?? stringValue(run.result.synthesis) ?? stringValue(run.result.interpretation);
  const rows = resultRows(run);
  const rankKey = stringValue(run.result.rank_by);
  const columns = Array.isArray(run.result.columns) ? run.result.columns.filter((column): column is Record<string, unknown> => !!column && typeof column === "object") : [];
  const rankColumn = columns.find((column) => stringValue(column.key) === rankKey);
  const rankLabel = stringValue(rankColumn?.label) ?? rankKey ?? "Rank";
  const rankUnit = stringValue(rankColumn?.unit) ?? "";
  return (
    <div className="min-h-0 overflow-auto p-3">
      <div className="rounded-md border border-caos-border bg-caos-panel p-3">
        <div className="flex flex-wrap items-center gap-2">
          <AnalysisStateBadge state={run.status} />
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Native {run.selected_lane} view</span>
        </div>
        <h2 className="mt-2 text-base font-semibold leading-snug text-caos-text">{answer ?? run.question}</h2>
        {rows.length ? (
          <div className="mt-3 overflow-auto border-t border-caos-border">
            <table className="w-full border-collapse text-left tabular text-caos-xs">
              <thead className="sticky top-0 bg-caos-panel text-caos-muted">
                <tr><th className="px-2 py-2">#</th><th className="px-2 py-2">Observation</th><th className="px-2 py-2">Details</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((row, index) => {
                  const issuer = rowIssuer(row);
                  const label = stringValue(row.label) ?? stringValue(row.name) ?? stringValue(row.company) ?? stringValue(row.issuer_name) ?? stringValue(issuer?.name) ?? `Result ${index + 1}`;
                  const issuerMeta = [stringValue(issuer?.ticker), stringValue(issuer?.industry)].filter(Boolean).join(" · ");
                  const rankValue = row.rank_value === undefined ? "" : `${rankLabel} ${formatMetricValue(row.rank_value)}${rankUnit}`;
                  const details = [issuerMeta, rankValue].filter(Boolean).join(" · ") || Object.entries(row).filter(([key]) => !["label", "name", "company", "issuer_name", "issuer", "metrics"].includes(key)).slice(0, 4).map(([key, value]) => `${key}: ${stringValue(value) ?? "…"}`).join(" · ");
                  return <tr key={`${label}-${index}`} className="border-t border-caos-border/70 hover:bg-caos-elevated/40"><td className="px-2 py-2 text-caos-accent">{index + 1}</td><td className="px-2 py-2 font-semibold text-caos-text">{label}</td><td className="px-2 py-2 text-caos-muted">{details}</td></tr>;
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
  const { roleView } = useRoleView();
  const contextState = useAnalysisContext({ name: "Cross-coverage investigation" });
  const [question, setQuestion] = useState("");
  const [lane, setLane] = useState<QueryRun["selected_lane"]>("metric");
  const [manualLane, setManualLane] = useState(false);
  const [run, setRun] = useState<QueryRun | null>(null);
  const [history, setHistory] = useState<QueryRun[]>([]);
  const [running, setRunning] = useState(false);
  const [capabilityId, setCapabilityId] = useState("peer-set");
  const [capabilityError, setCapabilityError] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);
  const [findingsKey, setFindingsKey] = useState(0);

  useEffect(() => {
    if (!contextState.context) return;
    analysisApi.listQueryRuns(contextState.context.id).then((rows) => {
      setHistory(rows);
      if (contextState.context?.query_session_id) {
        const latest = rows.find((item) => item.id === contextState.context?.query_session_id);
        if (latest) setRun(latest);
      }
    }).catch(() => setHistory([]));
    queryCapabilities().then((value) => {
      const groups = (value as { groups?: Array<{ capabilities?: Array<{ id: string; enabled: boolean }> }> }).groups ?? [];
      const first = groups.flatMap((group) => group.capabilities ?? []).find((capability) => capability.enabled);
      if (first) setCapabilityId(first.id);
      setCapabilityError(null);
    }).catch(() => setCapabilityError("Graph capabilities unavailable. Metric questions remain usable."));
  }, [contextState.context]);

  const runQuery = useCallback(async () => {
    if (!contextState.context || !question.trim() || running) return;
    setRunning(true);
    try {
      const next = await analysisApi.createQueryRun({
        context_id: contextState.context.id,
        question: question.trim(),
        selected_lane: lane,
        capability_id: lane === "graph" ? capabilityId : undefined,
      });
      setRun(next);
      setHistory((current) => [next, ...current.filter((item) => item.id !== next.id)].slice(0, 100));
      contextState.setContext({ ...contextState.context, query_session_id: next.id });
    } finally {
      setRunning(false);
    }
  }, [capabilityId, contextState, lane, question, running]);

  const missing = useMemo(() => Array.isArray(run?.result.missing_dependencies) ? run.result.missing_dependencies.map(String) : [], [run]);
  const decisionState: DecisionContextState = {
    whatChanged: datum(run, run ? `Query completed via ${run.selected_lane}` : null, missing),
    whyItMatters: datum(run, run?.question ?? null, missing),
    requiredAction: datum(run, run?.status === "ready" ? "Inspect citations and pin the finding" : "Choose a recovery lane", missing),
    evidenceHealth: datum(run, run ? `${run.authority.source_ids.length} cited sources · ${run.authority.freshness}` : null, missing),
  };

  const pinFinding = async () => {
    if (!contextState.context || !run || !["ready", "observed-empty"].includes(run.status)) return;
    setPinning(true);
    try {
      await analysisApi.createFinding({
        context_id: contextState.context.id,
        kind: "query-answer",
        title: stringValue(run.result.answer) ?? stringValue(run.result.summary) ?? run.question,
        body: run.question,
        source_surface: "query",
        source_run_id: run.id,
        evidence: { source_ids: run.authority.source_ids, result: run.result },
      });
      setFindingsKey((value) => value + 1);
    } finally {
      setPinning(false);
    }
  };

  const context = contextState.context;
  const roleLabel = roleView === "pm" ? "PM" : roleView === "qa" ? "QA" : "Analyst";
  const narrow = { essentialControls: <span className="tabular text-caos-2xs uppercase text-caos-muted">View: {roleLabel}</span> };
  return (
    <EnterprisePage
      kind="analytical"
      identity={<><ConceptNav compact /><span className="h-4 w-px bg-caos-border" /><span className="text-caos-sm font-semibold text-caos-text">Query</span>{context ? <span className="tabular text-caos-2xs text-caos-muted">{context.name}</span> : null}</>}
      status={contextState.loading ? <span className="tabular text-caos-2xs text-caos-muted">Loading context…</span> : contextState.error ? <span className="text-caos-xs text-caos-critical">{contextState.error}</span> : <span className="tabular text-caos-2xs uppercase text-caos-accent">View: {roleLabel} · composition only</span>}
      primaryAction={<button type="button" onClick={() => void runQuery()} disabled={!context || !question.trim() || running} className="caos-primary-action focus-ring disabled:opacity-40">{running ? "Running…" : "Run Query"}</button>}
      contextualControls={<>{headStat("Lane", lane)}{headStat("History", String(history.length))}{headStat("Findings", context ? "Shared" : "—")}</>}
      utilityLabel="Query utilities"
      utilityControls={<div className="space-y-4 text-caos-xs"><div><h3 className="tabular uppercase tracking-wider text-caos-muted">Saved investigations</h3><ol className="mt-2 space-y-1">{history.slice(0, 8).map((item) => <li key={item.id}><button type="button" className="w-full rounded-sm px-2 py-1.5 text-left text-caos-text hover:bg-caos-elevated focus-ring" onClick={() => { setRun(item); setQuestion(item.question); setLane(item.selected_lane); setManualLane(true); }}>{item.question}</button></li>)}</ol></div><div><h3 className="tabular uppercase tracking-wider text-caos-muted">Advanced graph</h3><label className="mt-2 block">Capability<input value={capabilityId} onChange={(event) => setCapabilityId(event.target.value)} className="mt-1 w-full rounded-sm border border-caos-border bg-caos-bg px-2 py-1.5 text-caos-text focus-ring" /></label></div>{context ? <Link href={contextHref("/reports", context.id)} className="caos-action-secondary focus-ring no-underline">Open in Report Studio</Link> : null}</div>}
      decisionContext={<DecisionHeader state={decisionState} defaultOpen={!!run} />}
      narrowContract={narrow}
    >
      <main className="min-h-0 flex-1 overflow-hidden flex flex-col">
        <section className="border-b border-caos-border bg-caos-panel/70 p-3" aria-label="Query composer">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted">Selected lane</span>
            {(["metric", "graph", "grounded"] as const).map((value) => <button key={value} type="button" aria-pressed={lane === value} onClick={() => { setLane(value); setManualLane(true); }} className={`caos-action-secondary focus-ring ${lane === value ? "border-caos-accent text-caos-text" : ""}`}>{value}</button>)}
            {manualLane ? <button type="button" className="tabular text-caos-2xs text-caos-accent focus-ring" onClick={() => { setManualLane(false); setLane(inferLane(question)); }}>Use suggested lane</button> : null}
          </div>
          <textarea aria-label="Query coverage" value={question} onChange={(event) => { const value = event.target.value; setQuestion(value); if (!manualLane) setLane(inferLane(value)); }} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void runQuery(); } }} rows={2} placeholder="Ask across coverage, evidence and published analysis…" className="mt-2 w-full resize-none rounded-md border border-caos-border bg-caos-bg px-3 py-2 text-caos-md text-caos-text placeholder:text-caos-muted focus-ring" />
          <div className="mt-2 flex flex-wrap gap-2">{STARTERS.map((starter) => <button type="button" key={starter} onClick={() => { setQuestion(starter); if (!manualLane) setLane(inferLane(starter)); }} className="rounded-sm border border-caos-border px-2 py-1 text-left text-caos-xs text-caos-muted hover:text-caos-text focus-ring">{starter}</button>)}</div>
          {capabilityError ? <p className="mt-2 text-caos-xs text-caos-warning">△ {capabilityError}</p> : null}
        </section>
        <div className="grid flex-1 min-h-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-h-0 overflow-hidden" aria-label="Query answer"><QueryResult run={run} /></section>
          <aside className="min-h-0 overflow-auto border-l border-caos-border bg-caos-panel/50 p-3" aria-label="Query evidence inspector">
            <div className="flex items-center gap-2"><h2 className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-text">Evidence inspector</h2>{run ? <button type="button" onClick={() => void pinFinding()} disabled={pinning || !["ready", "observed-empty"].includes(run.status)} className="caos-action-secondary ml-auto focus-ring disabled:opacity-40">{pinning ? "Pinning…" : "Pin finding"}</button> : null}</div>
            {run ? <><div className="mt-3"><AuthorityLine authority={run.authority} /></div><div className="mt-4"><h3 className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Claims and citations</h3><p className="mt-1 text-caos-xs leading-relaxed text-caos-text">{run.authority.source_ids.length ? `${run.authority.source_ids.length} source identifiers attached to this run.` : "No citation identifiers were attached; keep this result in draft."}</p>{run.authority.source_ids.length ? <ol className="mt-2 space-y-1">{run.authority.source_ids.slice(0, 20).map((id, index) => <li key={id} className="tabular text-caos-xs text-caos-muted"><span className="text-caos-accent">C{index + 1}</span> · {id}</li>)}</ol> : null}</div><div className="mt-4"><h3 className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Downstream consumers</h3><p className="mt-1 text-caos-xs text-caos-text">Deep-Dive · Report Studio · Command · Monitor</p></div></> : <p className="mt-3 text-caos-xs text-caos-muted">Run an investigation to inspect its method, caveats and citations.</p>}
            {context ? <div className="mt-4"><FindingsTray contextId={context.id} refreshKey={findingsKey} /></div> : null}
          </aside>
        </div>
      </main>
    </EnterprisePage>
  );
}
