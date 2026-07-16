"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { useRoleView } from "@/components/shared/RoleViewProvider";
import { useAnalysisContext } from "@/lib/analysis-workbench";
import { getIssuers, getPortfolios, listRuns, toErrorMessage, type PortfolioSummary } from "@/lib/api";
import type { DecisionAuthority, DecisionContextState, DecisionDatumState } from "@/lib/decision-state";
import {
  icBookApi,
  type AgendaStatus,
  type CommitteeAgendaItem,
  type CommitteeRecommendation,
  type DecisionBookItem,
} from "@/lib/ic-book";
import { useTypedUrlState } from "@/lib/typed-url-state";
import type { Issuer } from "@/types/issuers";
import type { RunListItemDTO } from "@/lib/engine/types";
import { fmtUtcDate, fmtUtcDateTime } from "@/lib/format-date";

const URL_KEYS = ["dataset", "status", "issuer", "portfolio", "sort", "direction", "cursor", "selected", "context"] as const;
type Dataset = "agenda" | "history";

function formatDate(value: string | null) {
  return fmtUtcDateTime(value);
}

function toLocalDateTimeInput(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function formatCalendarDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "—";
  return fmtUtcDate(`${value}T00:00:00Z`);
}

function sourceHref(sourceId: string, row: DecisionBookItem) {
  const snapshot = row.snapshot as {
    context?: { id?: unknown };
    evidence_manifest?: { records?: {
      modules?: Array<{ id?: unknown }>;
      claims?: Array<{ id?: unknown; module_output_id?: unknown }>;
      evidence?: Array<{ id?: unknown; claim_pk?: unknown; evidence_id?: unknown; chunk?: { id?: unknown; document_id?: unknown } | null }>;
      documents?: Array<{ id?: unknown }>;
    } };
    portfolio?: { records?: { id?: unknown; holdings?: Array<{ id?: unknown }>; constraints?: Array<{ id?: unknown }>; stress?: { id?: unknown } | null } };
  };
  const contextId = typeof snapshot.context?.id === "string" ? snapshot.context.id : "";
  const evidenceRecords = snapshot.evidence_manifest?.records;
  const claims = evidenceRecords?.claims ?? [];
  const claimIdsForSource = new Set(claims
    .filter((claim) => claim.id === sourceId || claim.module_output_id === sourceId)
    .map((claim) => claim.id)
    .filter((value): value is string => typeof value === "string"));
  const semanticEvidenceId = sourceId.startsWith("E-") ? sourceId : (evidenceRecords?.evidence ?? [])
    .find((record) => record.id === sourceId
      || record.claim_pk === sourceId
      || claimIdsForSource.has(String(record.claim_pk ?? ""))
      || record.chunk?.id === sourceId
      || record.chunk?.document_id === sourceId)
    ?.evidence_id;
  const portfolioRecords = snapshot.portfolio?.records;
  const portfolioIds = new Set<string>([
    portfolioRecords?.id,
    ...(portfolioRecords?.holdings ?? []).map((record) => record.id),
    ...(portfolioRecords?.constraints ?? []).map((record) => record.id),
    portfolioRecords?.stress?.id,
  ].filter((value): value is string => typeof value === "string"));
  if (sourceId === row.report_version_id || sourceId === row.report_id) {
    const params = new URLSearchParams({ issuer: row.issuer_id, report: sourceId });
    if (contextId) params.set("context", contextId);
    return `/reports?${params.toString()}`;
  }
  if (row.portfolio_id && (sourceId === row.portfolio_id || portfolioIds.has(sourceId) || sourceId.startsWith("portfolio-snapshot:") || sourceId.startsWith("holdings:") || sourceId.startsWith("constraints:"))) {
    const params = new URLSearchParams({ portfolio: row.portfolio_id, selected: sourceId });
    if (contextId) params.set("context", contextId);
    return `/portfolios?${params.toString()}`;
  }
  if (sourceId === contextId) return `/command?context=${encodeURIComponent(contextId)}`;
  const params = new URLSearchParams({ issuer: row.issuer_id, run: row.run_id });
  if (typeof semanticEvidenceId === "string" && semanticEvidenceId) params.set("evidence", semanticEvidenceId);
  if (contextId) params.set("context", contextId);
  return `/deepdive?${params.toString()}`;
}

function AgendaTable({ rows, selected, onSelect }: { rows: CommitteeAgendaItem[]; selected: string | null; onSelect: (id: string) => void }) {
  return <table aria-label="Committee agenda"><thead><tr><th scope="col">Meeting</th><th scope="col">Issuer</th><th scope="col">Recommendation</th><th scope="col">Conviction</th><th scope="col">Owner</th><th scope="col">Readiness</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} data-selected={selected === row.id}><th scope="row"><button type="button" onClick={() => onSelect(row.id)} aria-pressed={selected === row.id}>{formatDate(row.scheduled_for)}</button></th><td>{row.issuer_id}</td><td>{row.recommendation.toUpperCase()}</td><td>{row.conviction == null ? "—" : `${row.conviction}%`}</td><td>{row.owner_id}</td><td><span className="ic-book__status" data-status={row.status}><span aria-hidden="true">●</span> {row.status}{row.readiness_failures.length ? ` · ${row.readiness_failures.length} blockers` : ""}</span></td></tr>)}</tbody></table>;
}

function HistoryTable({ rows, selected, onSelect }: { rows: DecisionBookItem[]; selected: string | null; onSelect: (id: string) => void }) {
  return <table aria-label="Decision history"><thead><tr><th scope="col">Decision date</th><th scope="col">Issuer</th><th scope="col">Action</th><th scope="col">Status</th><th scope="col">Votes</th><th scope="col">Expiry</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} data-selected={selected === row.id}><th scope="row"><button type="button" onClick={() => onSelect(row.id)} aria-pressed={selected === row.id}>{formatDate(row.created_at)}</button></th><td>{row.issuer_id}</td><td>{row.action.toUpperCase()}</td><td><span className="ic-book__status" data-status={row.status}><span aria-hidden="true">●</span> {row.status}</span></td><td>{row.votes.length}</td><td>{formatCalendarDate(row.expiry)}</td></tr>)}</tbody></table>;
}

function AgendaInspector({
  row,
  busy,
  onSave,
  onMarkReady,
  onReturnDraft,
  onFinalize,
}: {
  row: CommitteeAgendaItem;
  busy: boolean;
  onSave: (patch: {
    thesis: string;
    conditions: string[];
    scheduled_for: string;
    expiry: string | null;
    recommendation: CommitteeRecommendation;
    conviction: number | null;
  }) => void;
  onMarkReady: () => void;
  onReturnDraft: () => void;
  onFinalize: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const originalScheduledInput = toLocalDateTimeInput(row.scheduled_for);
  const [draft, setDraft] = useState({
    thesis: row.thesis,
    conditions: row.conditions.join("\n"),
    scheduled: originalScheduledInput,
    expiry: row.expiry ?? "",
    recommendation: row.recommendation,
    conviction: row.conviction == null ? "" : String(row.conviction),
  });
  const immutable = row.status === "decided" || row.status === "cancelled";
  return (
    <article className="ic-book__inspector" aria-label="Agenda inspector">
      <header>
        <span className="ic-book__eyebrow">Agenda preparation</span>
        <span className="ic-book__status" data-status={row.status}>● {row.status}</span>
      </header>
      {editing ? (
        <div className="ic-book__edit">
          <label>Meeting time<input name="edit-scheduled" type="datetime-local" value={draft.scheduled} onChange={(event) => setDraft((current) => ({ ...current, scheduled: event.target.value }))} /></label>
          <label>Decision expiry<input name="edit-expiry" type="date" value={draft.expiry} onChange={(event) => setDraft((current) => ({ ...current, expiry: event.target.value }))} /></label>
          <label>Recommendation<select name="edit-recommendation" value={draft.recommendation} onChange={(event) => setDraft((current) => ({ ...current, recommendation: event.target.value as CommitteeRecommendation }))}><option value="approve">Approve</option><option value="decline">Decline</option><option value="revisit">Revisit</option></select></label>
          <label>Conviction<input name="edit-conviction" type="number" min="0" max="100" inputMode="decimal" value={draft.conviction} onChange={(event) => setDraft((current) => ({ ...current, conviction: event.target.value }))} /></label>
          <label>Thesis<textarea name="edit-thesis" rows={5} maxLength={50_000} value={draft.thesis} onChange={(event) => setDraft((current) => ({ ...current, thesis: event.target.value }))} /></label>
          <label>Conditions · one per line<textarea name="edit-conditions" rows={3} value={draft.conditions} onChange={(event) => setDraft((current) => ({ ...current, conditions: event.target.value }))} /></label>
          <div>
            <button type="button" aria-disabled={(busy || !draft.thesis.trim() || !draft.scheduled) || undefined} title={!draft.thesis.trim() || !draft.scheduled ? "Thesis and meeting time are required" : undefined} onClick={() => {
              if (busy || !draft.thesis.trim() || !draft.scheduled) return;
              onSave({
                thesis: draft.thesis.trim(),
                conditions: draft.conditions.split("\n").map((value) => value.trim()).filter(Boolean),
                scheduled_for: draft.scheduled === originalScheduledInput ? row.scheduled_for : new Date(draft.scheduled).toISOString(),
                expiry: draft.expiry || null,
                recommendation: draft.recommendation,
                conviction: draft.conviction ? Number(draft.conviction) : null,
              });
              setEditing(false);
            }}>Save preparation</button>
            <button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel edit</button>
          </div>
        </div>
      ) : (
        <>
          <h2>{row.recommendation.toUpperCase()} · {row.issuer_id}</h2>
          <p>{row.thesis}</p>
          <dl><div><dt>Scheduled</dt><dd>{formatDate(row.scheduled_for)}</dd></div><div><dt>Expiry</dt><dd>{row.expiry ?? "—"}</dd></div><div><dt>Run</dt><dd>{row.run_id ?? "Missing"}</dd></div><div><dt>Report version</dt><dd>{row.report_version_id ?? "Optional"}</dd></div><div><dt>Revision</dt><dd>{row.revision}</dd></div></dl>
          <section><h3>Conditions</h3>{row.conditions.length ? <ul>{row.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul> : <p>No conditions recorded.</p>}</section>
        </>
      )}
      <section><h3>Readiness</h3>{row.readiness_failures.length ? <ul>{row.readiness_failures.map((failure) => <li key={failure}>{failure.replaceAll("_", " ")}</li>)}</ul> : <p>No deterministic readiness blockers.</p>}</section>
      {row.snapshot_sha256 ? <p className="ic-book__hash">Frozen SHA {row.snapshot_sha256}</p> : null}
      {!immutable && !editing ? <button type="button" disabled={busy} onClick={() => setEditing(true)}>Edit preparation</button> : null}
      {!immutable && row.status === "draft" ? <button type="button" aria-disabled={(busy || row.readiness_failures.length > 0) || undefined} title={row.readiness_failures.length > 0 ? "Resolve the readiness blockers listed above first" : undefined} onClick={() => { if (!busy && row.readiness_failures.length === 0) onMarkReady(); }}>Mark ready</button> : null}
      {row.status === "ready" ? <button type="button" disabled={busy} onClick={onReturnDraft}>Return to draft</button> : null}
      {row.status === "ready" && !confirming ? <button type="button" disabled={busy} onClick={() => setConfirming(true)}>Review finalization</button> : null}
      {row.status === "ready" && confirming ? <div className="ic-book__confirm" role="alert"><strong>Freeze this committee record?</strong><p>Finalization creates one immutable decision and locks the linked run, report, context, portfolio, and evidence snapshot.</p><div><button type="button" disabled={busy} onClick={onFinalize}>{busy ? "Finalizing…" : "Confirm finalization"}</button><button type="button" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button></div></div> : null}
    </article>
  );
}

function DecisionInspector({
  row,
  busy,
  onVote,
  onReopen,
}: {
  row: DecisionBookItem;
  busy: boolean;
  onVote: (vote: "approve" | "dissent" | "abstain", note?: string) => void;
  onReopen: (triggerAlertKey: string) => void;
}) {
  const [dissent, setDissent] = useState("");
  const [reopenKey, setReopenKey] = useState("");
  const thesis = String((row.snapshot.agenda as { thesis?: unknown } | undefined)?.thesis ?? row.snapshot.thesis_md ?? "No frozen thesis text.");
  const authority = row.snapshot.authority as { source_ids?: unknown; as_of?: unknown; approval_state?: unknown } | undefined;
  const sourceIds = Array.isArray(authority?.source_ids) ? authority.source_ids.filter((value): value is string => typeof value === "string") : [];
  return (
    <article className="ic-book__inspector" aria-label="Decision inspector">
      <header><span className="ic-book__eyebrow">Immutable decision</span><span className="ic-book__status" data-status={row.status}>● {row.status}</span></header>
      <h2>{row.action.toUpperCase()} · {row.issuer_id}</h2>
      <p>{thesis}</p>
      <dl><div><dt>Snapshot</dt><dd>{row.snapshot_sha256}</dd></div><div><dt>Run</dt><dd>{row.run_id}</dd></div><div><dt>Report version</dt><dd>{row.report_version_id ?? "—"}</dd></div><div><dt>Expiry</dt><dd>{row.expiry ?? "—"}</dd></div></dl>
      <section><h3>Frozen authority & evidence</h3><p>{String(authority?.approval_state ?? "unknown")} · as of {String(authority?.as_of ?? "unavailable")}</p>{sourceIds.length ? <ul>{sourceIds.map((sourceId) => <li key={sourceId}><Link href={sourceHref(sourceId, row)}>{sourceId}</Link></li>)}</ul> : <p>No frozen source identifiers.</p>}</section>
      <section><h3>Conditions</h3>{row.conditions.length ? <ul>{row.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul> : <p>No conditions recorded.</p>}</section>
      <section><h3>Votes & dissent</h3>{row.votes.length ? <ul>{row.votes.map((vote) => <li key={vote.id}><strong>{vote.vote}</strong> · {vote.member}{vote.dissent_note ? ` — ${vote.dissent_note}` : ""}</li>)}</ul> : <p>No votes recorded.</p>}<div className="ic-book__vote-actions"><button type="button" disabled={busy} onClick={() => onVote("approve")}>Approve</button><button type="button" disabled={busy} onClick={() => onVote("abstain")}>Abstain</button><label htmlFor={`ic-dissent-${row.id}`}>Dissent rationale</label><textarea id={`ic-dissent-${row.id}`} name="dissent" rows={3} value={dissent} onChange={(event) => setDissent(event.target.value)} /><button type="button" aria-disabled={(busy || !dissent.trim()) || undefined} title={!dissent.trim() ? "Enter a dissent rationale first" : undefined} onClick={() => { if (busy || !dissent.trim()) return; onVote("dissent", dissent.trim()); setDissent(""); }}>Record dissent</button></div></section>
      {row.status === "active" ? <section><h3>Reopen decision</h3><label htmlFor={`ic-reopen-${row.id}`}>Trigger alert key</label><input id={`ic-reopen-${row.id}`} name="reopen-alert-key" value={reopenKey} onChange={(event) => setReopenKey(event.target.value)} placeholder={`alert:${row.issuer_id}:material-change…`} /><button type="button" disabled={busy || !reopenKey.trim()} onClick={() => onReopen(reopenKey.trim())}>Reopen for material change</button></section> : null}
      {row.reopened_at ? <section><h3>Reopen timeline</h3><p>Reopened {formatDate(row.reopened_at)} · {row.reopen_alert_key}</p></section> : null}
    </article>
  );
}

export function ICBookWorkbench() {
  const { roleView } = useRoleView();
  const analysis = useAnalysisContext({ name: "IC Book" });
  const { values, update } = useTypedUrlState(URL_KEYS);
  const dataset: Dataset = values.dataset === "history" ? "history" : "agenda";
  const [agenda, setAgenda] = useState<CommitteeAgendaItem[]>([]);
  const [decisions, setDecisions] = useState<DecisionBookItem[]>([]);
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [runs, setRuns] = useState<RunListItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [form, setForm] = useState({ issuer: values.issuer ?? "", portfolio: values.portfolio ?? "", scheduled: "", expiry: "", recommendation: "approve" as CommitteeRecommendation, conviction: "", run: "", report: "", contextId: "", thesis: "", conditions: "" });
  const appliedContextId = useRef<string | null>(null);
  const selectedAgenda = agenda.find((row) => row.id === values.selected) ?? null;
  const selectedDecision = decisions.find((row) => row.id === values.selected) ?? null;

  useEffect(() => { Promise.all([getIssuers(), getPortfolios()]).then(([issuerRows, portfolioRows]) => { setIssuers(issuerRows); setPortfolios(portfolioRows); setCatalogError(null); }).catch((reason) => setCatalogError(toErrorMessage(reason, "IC Book reference data unavailable."))); }, []);
  useEffect(() => {
    const context = analysis.context;
    if (!context || appliedContextId.current === context.id) return;
    appliedContextId.current = context.id;
    setForm((current) => ({
      ...current,
      issuer: context.issuer_ids?.[0] || "",
      portfolio: context.artifacts.portfolio_id || context.portfolio_scope || "",
      run: context.artifacts.issuer_run_id || "",
      report: context.artifacts.report_version_id || "",
      contextId: context.id,
    }));
  }, [analysis.context]);
  useEffect(() => {
    let alive = true;
    if (!form.issuer) { setRuns([]); return () => { alive = false; }; }
    listRuns(form.issuer).then((rows) => {
      if (!alive) return;
      setRuns(rows);
      setRunsError(null);
      setForm((current) => {
        const linkedRunExists = rows.some((run) => run.id === current.run);
        return { ...current, run: linkedRunExists ? current.run : "", report: linkedRunExists ? current.report : "", contextId: linkedRunExists ? current.contextId : "" };
      });
    }).catch((reason) => {
      if (!alive) return;
      setRuns([]);
      setRunsError(toErrorMessage(reason, "Issuer runs unavailable."));
    });
    return () => { alive = false; };
  }, [form.issuer]);
  useEffect(() => {
    let alive = true; setLoading(true); setError(null);
    const common = { issuer_id: values.issuer || undefined, portfolio_id: values.portfolio || undefined, cursor: values.cursor || undefined, direction: values.direction === "desc" ? "desc" as const : "asc" as const, limit: 50 };
    const request = dataset === "agenda"
      ? icBookApi.listAgenda({ ...common, status: values.status as AgendaStatus | undefined, sort: values.sort === "updated_at" ? "updated_at" : "scheduled_for" }).then((page) => ({ items: page.items, next: page.next_cursor, total: page.total, kind: "agenda" as const }))
      : icBookApi.listDecisions({ ...common, status: values.status === "reopened" ? "reopened" : values.status === "active" ? "active" : undefined, sort: values.sort === "expiry" ? "expiry" : "created_at" }).then((page) => ({ items: page.items, next: page.next_cursor, total: page.total, kind: "history" as const }));
    request.then((result) => { if (!alive) return; if (result.kind === "agenda") { setAgenda(result.items); setDecisions([]); } else { setDecisions(result.items); setAgenda([]); } setNextCursor(result.next); setTotal(result.total); setFetchedAt(new Date().toISOString()); }).catch((reason) => alive && setError(toErrorMessage(reason, "IC Book data unavailable."))).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [dataset, reloadToken, values.cursor, values.direction, values.issuer, values.portfolio, values.sort, values.status]);

  const personaBrief = useMemo(() => roleView === "pm" ? "Rank committee actions, dissent and expiring conditions." : roleView === "qa" ? "Validate readiness, frozen lineage and immutable governance records." : "Prepare agenda items, inspect evidence and record committee votes.", [roleView]);
  const icDecision: DecisionContextState = useMemo(() => {
    const loadingCells: DecisionContextState = {
      whatChanged: { kind: "loading", message: "Checking the register…" },
      whyItMatters: { kind: "loading", message: "Checking priority…" },
      requiredAction: { kind: "loading", message: "Checking readiness…" },
      evidenceHealth: { kind: "loading", message: "Checking evidence…" },
    };
    if (loading) return loadingCells;
    if (error && !agenda.length && !decisions.length) {
      const message = "IC Book register unavailable";
      return {
        whatChanged: { kind: "unavailable", message },
        whyItMatters: { kind: "unavailable", message },
        requiredAction: { kind: "unavailable", message },
        evidenceHealth: { kind: "unavailable", message },
      };
    }
    if (fetchedAt == null) return loadingCells;

    const asOf = fetchedAt;
    const authority: DecisionAuthority = {
      provenance: { origin: "LIVE", method: "DERIVED", detail: "Committee register roll-up." },
      approval: "UNRATIFIED",
    };

    const readyCount = agenda.filter((row) => row.status === "ready").length;
    const activeCount = decisions.filter((row) => row.status === "active").length;
    const whatChanged: DecisionDatumState = total === 0
      ? { kind: "observed-empty", message: dataset === "agenda" ? "No agenda items in the register" : "No decisions in the register", asOf, authority }
      : { kind: "ready", value: dataset === "agenda" ? `${total} agenda items · ${readyCount} ready` : `${total} decisions · ${activeCount} active`, asOf, authority };

    let whyItMatters: DecisionDatumState;
    if (dataset === "agenda") {
      whyItMatters = agenda.length
        ? { kind: "ready", value: `Next meeting ${fmtUtcDateTime([...agenda].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))[0].scheduled_for)}`, asOf, authority }
        : { kind: "observed-empty", message: "No meeting scheduled", asOf, authority };
    } else {
      whyItMatters = decisions.length
        ? { kind: "ready", value: `Latest decision ${fmtUtcDateTime([...decisions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0].created_at)}`, asOf, authority }
        : { kind: "observed-empty", message: "No decisions recorded", asOf, authority };
    }

    let requiredAction: DecisionDatumState;
    if (dataset === "agenda") {
      const blockedCount = agenda.filter((row) => row.readiness_failures.length > 0).length;
      requiredAction = blockedCount > 0
        ? { kind: "ready", value: `${blockedCount} ${blockedCount === 1 ? "draft" : "drafts"} with readiness blockers`, asOf, authority }
        : { kind: "observed-empty", message: "No readiness blockers", asOf, authority };
    } else {
      const reopenedCount = decisions.filter((row) => row.status === "reopened").length;
      requiredAction = reopenedCount > 0
        ? { kind: "ready", value: `${reopenedCount} ${reopenedCount === 1 ? "reopened decision" : "reopened decisions"}`, asOf, authority }
        : { kind: "observed-empty", message: "No reopened decisions", asOf, authority };
    }

    let evidenceHealth: DecisionDatumState;
    if (dataset === "agenda") {
      const noRunCount = agenda.filter((row) => !row.run_id).length;
      evidenceHealth = noRunCount > 0
        ? { kind: "ready", value: `${noRunCount} ${noRunCount === 1 ? "item lacks" : "items lack"} a linked run`, asOf, authority }
        : { kind: "observed-empty", message: "Every item is linked to a run", asOf, authority };
    } else {
      const noReportCount = decisions.filter((row) => !row.report_id).length;
      evidenceHealth = noReportCount > 0
        ? { kind: "ready", value: `${noReportCount} ${noReportCount === 1 ? "decision lacks" : "decisions lack"} a report link`, asOf, authority }
        : { kind: "observed-empty", message: "Every decision is linked to a report", asOf, authority };
    }

    return { whatChanged, whyItMatters, requiredAction, evidenceHealth };
  }, [dataset, loading, error, agenda, decisions, total, fetchedAt]);
  // An empty register with active filters ("no match") reads differently from a
  // genuinely empty book ("add the first item") — the copy and CTA must match.
  const icBookEmpty = !!(values.status || values.issuer || values.portfolio);
  // Open the collapsed create form and focus its first control — the one
  // affordance for adding an item (replaces the bare scrollIntoView anchor).
  const openCreateForm = () => {
    const el = document.getElementById("ic-book-create") as HTMLDetailsElement | null;
    if (el) { el.open = true; el.scrollIntoView({ behavior: "smooth" }); requestAnimationFrame(() => el.querySelector<HTMLElement>("select, input")?.focus()); }
  };
  const refresh = () => { update({ cursor: null }, "replace"); setReloadToken((current) => current + 1); };
  const create = async (event: FormEvent) => { event.preventDefault(); if (!form.issuer || !form.scheduled || !form.thesis.trim()) return; setBusy(true); setError(null); try { const row = await icBookApi.createAgenda({ issuer_id: form.issuer, portfolio_id: form.portfolio || null, scheduled_for: new Date(form.scheduled).toISOString(), expiry: form.expiry || null, recommendation: form.recommendation, conviction: form.conviction ? Number(form.conviction) : null, thesis: form.thesis.trim(), conditions: form.conditions.split("\n").map((value) => value.trim()).filter(Boolean), run_id: form.run || null, report_version_id: form.report || null, context_id: form.contextId || null, status: "draft" }); update({ dataset: "agenda", selected: row.id, status: null, cursor: null }, "replace"); setReloadToken((current) => current + 1); setForm((current) => ({ ...current, thesis: "", conditions: "" })); } catch (reason) { setError(toErrorMessage(reason, "Agenda item could not be created.")); } finally { setBusy(false); } };
  const savePreparation = async (patch: { thesis: string; conditions: string[]; scheduled_for: string; expiry: string | null; recommendation: CommitteeRecommendation; conviction: number | null }) => { if (!selectedAgenda) return; setBusy(true); setError(null); try { await icBookApi.patchAgenda(selectedAgenda.id, { expected_revision: selectedAgenda.revision, ...patch }); setReloadToken((current) => current + 1); } catch (reason) { setError(toErrorMessage(reason, "Agenda preparation could not be saved.")); } finally { setBusy(false); } };
  const markReady = async () => { if (!selectedAgenda) return; setBusy(true); try { await icBookApi.patchAgenda(selectedAgenda.id, { expected_revision: selectedAgenda.revision, status: "ready" }); setReloadToken((current) => current + 1); } catch (reason) { setError(toErrorMessage(reason, "Agenda readiness failed.")); } finally { setBusy(false); } };
  const returnDraft = async () => { if (!selectedAgenda) return; setBusy(true); try { await icBookApi.patchAgenda(selectedAgenda.id, { expected_revision: selectedAgenda.revision, status: "draft" }); setReloadToken((current) => current + 1); } catch (reason) { setError(toErrorMessage(reason, "Agenda could not return to draft.")); } finally { setBusy(false); } };
  const finalize = async () => { if (!selectedAgenda) return; setBusy(true); try { await icBookApi.finalizeAgenda(selectedAgenda.id, selectedAgenda.revision); setReloadToken((current) => current + 1); } catch (reason) { setError(toErrorMessage(reason, "Agenda finalization failed.")); } finally { setBusy(false); } };
  const vote = async (choice: "approve" | "dissent" | "abstain", note?: string) => { if (!selectedDecision) return; setBusy(true); setError(null); try { const updated = await icBookApi.vote(selectedDecision.id, choice, note); setDecisions((rows) => rows.map((row) => row.id === updated.id ? updated : row)); setError(null); } catch (reason) { setError(toErrorMessage(reason, "Vote could not be recorded.")); } finally { setBusy(false); } };
  const reopen = async (triggerAlertKey: string) => { if (!selectedDecision) return; setBusy(true); try { await icBookApi.reopen(selectedDecision.id, triggerAlertKey); setReloadToken((current) => current + 1); } catch (reason) { setError(toErrorMessage(reason, "Decision could not be reopened.")); } finally { setBusy(false); } };

  const primary = <DominantTableRegion ownerId="ic-book-register" label={dataset === "agenda" ? "Committee agenda register" : "Decision history register"}><div className="ic-book__table-scroll">{loading ? <p role="status">Loading IC Book…</p> : error && !agenda.length && !decisions.length ? <p role="alert">{error}</p> : dataset === "agenda" ? agenda.length ? <AgendaTable rows={agenda} selected={values.selected ?? null} onSelect={(selected) => update({ selected })} /> : icBookEmpty ? <SurfaceState kind="empty" title="No items match the current filters" detail="Clear the filters to see every agenda item." primaryAction={<button type="button" className="caos-action-secondary focus-ring" onClick={() => update({ status: null, issuer: null, portfolio: null, cursor: null })}>Clear filters</button>} /> : <SurfaceState kind="empty" title="No agenda items yet" detail="Add the first committee agenda item to begin the book." primaryAction={<button type="button" className="caos-action-primary focus-ring" onClick={openCreateForm}>Add agenda item</button>} /> : decisions.length ? <HistoryTable rows={decisions} selected={values.selected ?? null} onSelect={(selected) => update({ selected })} /> : <SurfaceState kind="empty" title={icBookEmpty ? "No decisions match the current filters" : "No immutable decisions yet"} detail={icBookEmpty ? "Clear the filters to see every recorded decision." : "Finalized committee decisions will appear here."} {...(icBookEmpty ? { primaryAction: <button type="button" className="caos-action-secondary focus-ring" onClick={() => update({ status: null, issuer: null, portfolio: null, cursor: null })}>Clear filters</button> } : {})} />}</div>{nextCursor ? <button type="button" onClick={() => update({ cursor: nextCursor })}>Next page</button> : null}</DominantTableRegion>;
  const inspector = selectedAgenda ? <AgendaInspector key={`${selectedAgenda.id}:${selectedAgenda.revision}`} row={selectedAgenda} busy={busy} onSave={savePreparation} onMarkReady={markReady} onReturnDraft={returnDraft} onFinalize={finalize} /> : selectedDecision ? <DecisionInspector key={selectedDecision.id} row={selectedDecision} busy={busy} onVote={vote} onReopen={reopen} /> : <div className="ic-book__empty">Select an agenda item or decision to inspect its thesis, conditions, lineage and governance record.</div>;
  const utility = <details className="ic-book__create" id="ic-book-create"><summary className="ic-book__create-summary">Add agenda item</summary><form className="ic-book__form" aria-label="Add agenda item" onSubmit={create}>{[catalogError, runsError].filter(Boolean).map((message) => <p key={message} role="alert">{message}</p>)}{form.contextId ? (() => { const li = issuers.find((i) => i.id === form.issuer); const label = li ? (li.ticker ?? li.name) : null; return <p className="ic-book__hash">Linked context{label ? ` · ${label}` : ""}{form.run ? ` · run ${form.run.slice(0, 8)}` : ""} <span title={form.contextId}>{form.contextId.slice(0, 8)}…</span></p>; })() : null}<label>Issuer<select name="issuer" value={form.issuer} onChange={(event) => setForm((current) => ({ ...current, issuer: event.target.value, run: "", report: "", contextId: "" }))} required><option value="">Select issuer…</option>{issuers.map((issuer) => <option key={issuer.id} value={issuer.id}>{issuer.ticker ?? issuer.name}</option>)}</select></label><label>Portfolio<select name="portfolio" value={form.portfolio} onChange={(event) => setForm((current) => ({ ...current, portfolio: event.target.value, run: "", report: "", contextId: "" }))}><option value="">No portfolio</option>{portfolios.map((portfolio) => <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>)}</select></label><label>Meeting time<input name="scheduled" type="datetime-local" value={form.scheduled} onChange={(event) => setForm((current) => ({ ...current, scheduled: event.target.value }))} required /></label><label>Decision expiry<input name="expiry" type="date" value={form.expiry} onChange={(event) => setForm((current) => ({ ...current, expiry: event.target.value }))} /></label><label>Recommendation<select name="recommendation" value={form.recommendation} onChange={(event) => setForm((current) => ({ ...current, recommendation: event.target.value as CommitteeRecommendation }))}><option value="approve">Approve</option><option value="decline">Decline</option><option value="revisit">Revisit</option></select></label><label>Conviction · 0–100%<input name="conviction" type="number" min="0" max="100" inputMode="decimal" placeholder="0–100" value={form.conviction} onChange={(event) => setForm((current) => ({ ...current, conviction: event.target.value }))} /></label><label>Run<select name="run" value={form.run} onChange={(event) => setForm((current) => ({ ...current, run: event.target.value, report: event.target.value === current.run ? current.report : "", contextId: event.target.value === current.run ? current.contextId : "" }))}><option value="">Select run…</option>{runs.map((run) => <option key={run.id} value={run.id}>{run.id.slice(0, 8)} · {run.committee_status}</option>)}</select></label><label>Report version<input name="report-version" value={form.report} readOnly placeholder="Optional — select in Report Studio…" /></label><label>Thesis<textarea name="thesis" rows={5} maxLength={50_000} value={form.thesis} onChange={(event) => setForm((current) => ({ ...current, thesis: event.target.value }))} required /></label><label>Conditions · one per line<textarea name="conditions" rows={3} value={form.conditions} onChange={(event) => setForm((current) => ({ ...current, conditions: event.target.value }))} /></label><button type="submit" disabled={busy}>{busy ? "Saving…" : "Add agenda item"}</button></form></details>;

  return <EnterprisePage kind="worklist" identity={<ShellIdentity tag="IC" title="IC Book" />} status={<span className="tabular text-caos-2xs text-caos-muted">{total} {dataset === "agenda" ? "agenda items" : "decisions"}</span>} primaryAction={<button type="button" className="caos-primary-action focus-ring" onClick={openCreateForm}>Add agenda item</button>} narrowContract={{ essentialControls: <span className="tabular text-caos-2xs text-caos-muted">{total} records</span> }}><div className="ic-book"><header className="ic-book__toolbar"><div><p>{personaBrief}</p></div><div role="tablist" aria-label="IC Book dataset" onKeyDown={(event) => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')); const activeIndex = tabs.indexOf(document.activeElement as HTMLButtonElement); const nextIndex = event.key === "ArrowRight" ? (activeIndex + 1) % tabs.length : (activeIndex - 1 + tabs.length) % tabs.length; tabs[nextIndex]?.focus(); tabs[nextIndex]?.click(); }}>{(["agenda", "history"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={dataset === value} tabIndex={dataset === value ? 0 : -1} onClick={() => update({ dataset: value, cursor: null, selected: null, status: null })}>{value === "agenda" ? "Agenda" : "Decision history"}</button>)}</div><label>Status<select name="ic-book-status" value={values.status ?? ""} onChange={(event) => update({ status: event.target.value || null, cursor: null })}><option value="">All statuses</option>{dataset === "agenda" ? <><option value="draft">Draft</option><option value="ready">Ready</option><option value="decided">Decided</option><option value="cancelled">Cancelled</option></> : <><option value="active">Active</option><option value="reopened">Reopened</option></>}</select></label><button type="button" onClick={refresh}>Refresh</button></header>{error ? <p className="ic-book__error" role="alert">{error}</p> : null}<PersonaWorkbench surface="ic-book" persona={roleView} decision={<DecisionHeader state={icDecision} defaultOpen={false} />} primary={primary} inspector={inspector} utility={utility} finalization={selectedAgenda?.status === "ready" ? <p className="ic-book__finalization">Ready for immutable finalization · <Link href={selectedAgenda.run_id ? `/deepdive?run=${encodeURIComponent(selectedAgenda.run_id)}` : "/deepdive"}>review run evidence</Link></p> : null} /></div></EnterprisePage>;
}
