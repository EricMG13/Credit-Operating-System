"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent, type ReactNode, type SetStateAction } from "react";
import { ActionReason } from "@/components/shared/ActionReason";
import { DecisionHeader } from "@/components/shared/DecisionHeader";
import { DominantTableRegion } from "@/components/shared/DominantTableRegion";
import { EnterprisePage } from "@/components/shared/EnterprisePage";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { useRoleView } from "@/components/shared/RoleViewProvider";
import { useAuth } from "@/components/shared/AuthProvider";
import { DataTable, type DataTableColumn, type DataTableSort } from "@/components/ui/DataTable";
import { useAnalysisContext } from "@/lib/analysis-workbench";
import { analystOpinionsApi, type AnalystOpinionVersion } from "@/lib/analyst-opinions";
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
import { fmtLocalDateTime, fmtUtcDate, fmtUtcDateTime } from "@/lib/format-date";

const URL_KEYS = ["dataset", "status", "issuer", "portfolio", "sort", "direction", "cursor", "selected", "context"] as const;
type Dataset = "agenda" | "history";

function formatDate(value: string | null) {
  const local = fmtLocalDateTime(value);
  const utc = fmtUtcDateTime(value);
  return local === "—" ? utc : `${local} · ${utc}`;
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

type DecisionSnapshot = {
  context?: { id?: unknown };
  evidence_manifest?: {
    records?: {
      modules?: Array<{ id?: unknown }>;
      claims?: Array<{ id?: unknown; module_output_id?: unknown }>;
      evidence?: Array<{
        id?: unknown;
        claim_pk?: unknown;
        evidence_id?: unknown;
        chunk?: { id?: unknown; document_id?: unknown } | null;
      }>;
      documents?: Array<{ id?: unknown }>;
    };
  };
  portfolio?: {
    records?: {
      id?: unknown;
      holdings?: Array<{ id?: unknown }>;
      constraints?: Array<{ id?: unknown }>;
      stress?: { id?: unknown } | null;
    };
  };
};

function snapshotContextId(snapshot: DecisionSnapshot) {
  return typeof snapshot.context?.id === "string" ? snapshot.context.id : "";
}

function semanticEvidenceId(snapshot: DecisionSnapshot, sourceId: string) {
  if (sourceId.startsWith("E-")) return sourceId;
  const records = snapshot.evidence_manifest?.records;
  const claimIds = new Set((records?.claims ?? [])
    .filter((claim) => claim.id === sourceId || claim.module_output_id === sourceId)
    .map((claim) => claim.id)
    .filter((value): value is string => typeof value === "string"));
  return (records?.evidence ?? []).find((record) => (
    record.id === sourceId
    || record.claim_pk === sourceId
    || claimIds.has(String(record.claim_pk ?? ""))
    || record.chunk?.id === sourceId
    || record.chunk?.document_id === sourceId
  ))?.evidence_id;
}

function portfolioSourceIds(snapshot: DecisionSnapshot) {
  const records = snapshot.portfolio?.records;
  return new Set<string>([
    records?.id,
    ...(records?.holdings ?? []).map((record) => record.id),
    ...(records?.constraints ?? []).map((record) => record.id),
    records?.stress?.id,
  ].filter((value): value is string => typeof value === "string"));
}

function isPortfolioSource(sourceId: string, row: DecisionBookItem, snapshot: DecisionSnapshot) {
  return Boolean(row.portfolio_id && (
    sourceId === row.portfolio_id
    || portfolioSourceIds(snapshot).has(sourceId)
    || sourceId.startsWith("portfolio-snapshot:")
    || sourceId.startsWith("holdings:")
    || sourceId.startsWith("constraints:")
  ));
}

function withContext(params: URLSearchParams, contextId: string) {
  if (contextId) params.set("context", contextId);
  return params.toString();
}

function sourceHref(sourceId: string, row: DecisionBookItem) {
  const snapshot = row.snapshot as DecisionSnapshot;
  const contextId = snapshotContextId(snapshot);
  if (sourceId === row.report_version_id || sourceId === row.report_id) {
    const params = new URLSearchParams({ issuer: row.issuer_id, report: sourceId });
    return `/reports?${withContext(params, contextId)}`;
  }
  if (row.portfolio_id && isPortfolioSource(sourceId, row, snapshot)) {
    const params = new URLSearchParams({ portfolio: row.portfolio_id, selected: sourceId });
    return `/portfolios?${withContext(params, contextId)}`;
  }
  if (sourceId === contextId) return `/command?context=${encodeURIComponent(contextId)}`;
  const params = new URLSearchParams({ issuer: row.issuer_id, run: row.run_id });
  const evidenceId = semanticEvidenceId(snapshot, sourceId);
  if (typeof evidenceId === "string" && evidenceId) params.set("evidence", evidenceId);
  return `/deepdive?${withContext(params, contextId)}`;
}

function AgendaTable({ rows, selected, sort, onSort, onSelect, issuerLabel, ownerLabel }: { rows: CommitteeAgendaItem[]; selected: string | null; sort: DataTableSort; onSort: (key: string) => void; onSelect: (id: string) => void; issuerLabel: (id: string) => string; ownerLabel: (id: string) => string }) {
  const columns: DataTableColumn<CommitteeAgendaItem>[] = [
    { key: "scheduled_for", header: "Meeting", align: "numeric", rowHeader: true, sortable: true, render: (row) => formatDate(row.scheduled_for) },
    { key: "issuer", header: "Issuer", render: (row) => issuerLabel(row.issuer_id) },
    { key: "recommendation", header: "Recommendation", render: (row) => row.recommendation.toUpperCase() },
    { key: "conviction", header: "Conviction", align: "numeric", unit: "%", render: (row) => row.conviction ?? "—" },
    { key: "owner", header: "Owner", render: (row) => ownerLabel(row.owner_id) },
    { key: "readiness", header: "Readiness", render: (row) => <span className="ic-book__status" data-status={row.status}><span aria-hidden="true">●</span> {row.status}{row.readiness_failures.length ? ` · ${row.readiness_failures.length} blockers` : ""}</span> },
  ];
  return <DataTable columns={columns} rows={rows} getRowId={(row) => row.id} caption="Committee agenda" sort={sort} onSort={onSort} selectedRowId={selected} onRowActivate={(row) => onSelect(row.id)} rowClassName={(row) => selected === row.id ? "bg-caos-accent/10" : ""} />;
}

function HistoryTable({ rows, selected, sort, onSort, onSelect, issuerLabel }: { rows: DecisionBookItem[]; selected: string | null; sort: DataTableSort; onSort: (key: string) => void; onSelect: (id: string) => void; issuerLabel: (id: string) => string }) {
  const columns: DataTableColumn<DecisionBookItem>[] = [
    { key: "created_at", header: "Decision date", align: "numeric", rowHeader: true, sortable: true, render: (row) => formatDate(row.created_at) },
    { key: "issuer", header: "Issuer", render: (row) => issuerLabel(row.issuer_id) },
    { key: "action", header: "Action", render: (row) => row.action.toUpperCase() },
    { key: "status", header: "Status", render: (row) => <span className="ic-book__status" data-status={row.status}><span aria-hidden="true">●</span> {row.status}</span> },
    { key: "votes", header: "Votes", align: "numeric", render: (row) => row.votes.length },
    { key: "expiry", header: "Expiry", align: "numeric", sortable: true, render: (row) => formatCalendarDate(row.expiry) },
  ];
  return <DataTable columns={columns} rows={rows} getRowId={(row) => row.id} caption="Decision history" sort={sort} onSort={onSort} selectedRowId={selected} onRowActivate={(row) => onSelect(row.id)} rowClassName={(row) => selected === row.id ? "bg-caos-accent/10" : ""} />;
}

function ConditionsSection({ conditions }: { conditions: string[] }) {
  return (
    <section>
      <h3>Conditions</h3>
      {conditions.length
        ? <ul>{conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>
        : <p>No conditions recorded.</p>}
    </section>
  );
}

type AgendaPreparationPatch = {
  thesis: string;
  conditions: string[];
  scheduled_for: string;
  expiry: string | null;
  recommendation: CommitteeRecommendation;
  conviction: number | null;
};

type AgendaDraft = {
  thesis: string;
  conditions: string;
  scheduled: string;
  expiry: string;
  recommendation: CommitteeRecommendation;
  conviction: string;
};

type AgendaFormState = {
  issuer: string;
  portfolio: string;
  scheduled: string;
  expiry: string;
  recommendation: CommitteeRecommendation;
  conviction: string;
  run: string;
  report: string;
  contextId: string;
  opinion: string;
  thesis: string;
  conditions: string;
};

type SetAgendaForm = Dispatch<SetStateAction<AgendaFormState>>;

function AgendaPreparationForm({ row, busy, draft, originalScheduledInput, onDraft, onSave, onCancel }: {
  row: CommitteeAgendaItem;
  busy: boolean;
  draft: AgendaDraft;
  originalScheduledInput: string;
  onDraft: (patch: Partial<AgendaDraft>) => void;
  onSave: (patch: AgendaPreparationPatch) => void;
  onCancel: () => void;
}) {
  const invalid = busy || !draft.thesis.trim() || !draft.scheduled;
  const save = () => {
    if (invalid) return;
    onSave({
      thesis: draft.thesis.trim(),
      conditions: draft.conditions.split("\n").map((value) => value.trim()).filter(Boolean),
      scheduled_for: draft.scheduled === originalScheduledInput ? row.scheduled_for : new Date(draft.scheduled).toISOString(),
      expiry: draft.expiry || null,
      recommendation: draft.recommendation,
      conviction: draft.conviction ? Number(draft.conviction) : null,
    });
  };
  return (
    <div className="ic-book__edit">
      <label>Meeting time<input name="edit-scheduled" type="datetime-local" autoComplete="off" value={draft.scheduled} onChange={(event) => onDraft({ scheduled: event.target.value })} /></label>
      <label>Decision expiry<input name="edit-expiry" type="date" autoComplete="off" value={draft.expiry} onChange={(event) => onDraft({ expiry: event.target.value })} /></label>
      <label>Recommendation<select name="edit-recommendation" value={draft.recommendation} onChange={(event) => onDraft({ recommendation: event.target.value as CommitteeRecommendation })}><option value="approve">Approve</option><option value="decline">Decline</option><option value="revisit">Revisit</option></select></label>
      <label>Conviction<input name="edit-conviction" type="number" min="0" max="100" inputMode="decimal" autoComplete="off" value={draft.conviction} onChange={(event) => onDraft({ conviction: event.target.value })} /></label>
      <label>Thesis<textarea name="edit-thesis" rows={5} maxLength={50_000} value={draft.thesis} onChange={(event) => onDraft({ thesis: event.target.value })} /></label>
      <label>Conditions · one per line<textarea name="edit-conditions" rows={3} value={draft.conditions} onChange={(event) => onDraft({ conditions: event.target.value })} /></label>
      <div>
        <button type="button" aria-disabled={invalid || undefined} title={!draft.thesis.trim() || !draft.scheduled ? "Thesis and meeting time are required" : undefined} onClick={save}>Save preparation</button>
        <ActionReason reason={busy ? "An action is already in progress" : null} onClick={onCancel}>Cancel edit</ActionReason>
      </div>
    </div>
  );
}

function AgendaSummary({ row, issuerLabel }: { row: CommitteeAgendaItem; issuerLabel: (id: string) => string }) {
  return (
    <>
      <h2>{row.recommendation.toUpperCase()} · {issuerLabel(row.issuer_id)}</h2>
      <p>{row.thesis}</p>
      <dl><div><dt>Scheduled</dt><dd>{formatDate(row.scheduled_for)}</dd></div><div><dt>Expiry</dt><dd>{row.expiry ?? "—"}</dd></div><div><dt>Run</dt><dd>{row.run_id ?? "Missing"}</dd></div><div><dt>Report version</dt><dd>{row.report_version_id ?? "Optional"}</dd></div><div><dt>Revision</dt><dd>{row.revision}</dd></div></dl>
      <ConditionsSection conditions={row.conditions} />
    </>
  );
}

function ReadinessSection({ failures }: { failures: string[] }) {
  return <section><h3>Readiness</h3>{failures.length ? <ul>{failures.map((failure) => <li key={failure}>{failure.replaceAll("_", " ")}</li>)}</ul> : <p>No deterministic readiness blockers.</p>}</section>;
}

function AnalystViewSection({ row, busy, opinions, onLinkOpinion }: {
  row: CommitteeAgendaItem;
  busy: boolean;
  opinions: AnalystOpinionVersion[];
  onLinkOpinion: (opinionId: string) => void;
}) {
  if (row.analyst_opinion_version_id) return <section><h3>Analyst view</h3><p>Linked analyst-view version {row.analyst_opinion_version_id.slice(0, 8)}…</p></section>;
  if (!opinions.length) return <section><h3>Analyst view</h3><p>No current analyst view for this issuer. Publish one in Issuer Profile first.</p></section>;
  return <section><h3>Analyst view</h3><div><p>Required before this agenda item can be marked ready.</p><button type="button" disabled={busy} onClick={() => onLinkOpinion(opinions[0].id)}>Link current view · {opinions[0].stance} · v{opinions[0].version}</button></div></section>;
}

function ExistingEvidenceException({ exception, busy, canReview, onReview, onRevoke }: {
  exception: NonNullable<CommitteeAgendaItem["evidence_exception"]>;
  busy: boolean;
  canReview: boolean;
  onReview: (exceptionId: string, revision: number, decision: "approve" | "reject", reviewNote: string) => void;
  onRevoke: (exceptionId: string, revision: number, reviewNote: string) => void;
}) {
  const [reviewNote, setReviewNote] = useState("");
  return (
    <div>
      <p><strong>{exception.status.toUpperCase()}</strong> · expires {exception.expires_at}</p>
      <p>{exception.rationale}</p>
      {exception.mitigants.length ? <ul>{exception.mitigants.map((mitigant) => <li key={mitigant}>{mitigant}</li>)}</ul> : null}
      {exception.review_note ? <p>QA note · {exception.review_note}</p> : null}
      {canReview && exception.status === "pending" ? <div><label>QA review note<textarea rows={2} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} /></label><div><button type="button" disabled={busy || !reviewNote.trim()} onClick={() => onReview(exception.id, exception.revision, "approve", reviewNote.trim())}>Approve exception</button><button type="button" disabled={busy || !reviewNote.trim()} onClick={() => onReview(exception.id, exception.revision, "reject", reviewNote.trim())}>Reject exception</button></div></div> : null}
      {canReview && exception.status === "approved" ? <div><label>Revocation note<textarea rows={2} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} /></label><button type="button" disabled={busy || !reviewNote.trim()} onClick={() => onRevoke(exception.id, exception.revision, reviewNote.trim())}>Revoke exception</button></div> : null}
    </div>
  );
}

function EvidenceExceptionRequest({ busy, onRequest }: {
  busy: boolean;
  onRequest: (input: { rationale: string; mitigants: string[]; expires_at: string }) => void;
}) {
  const [rationale, setRationale] = useState("");
  const [mitigants, setMitigants] = useState("");
  const [expiry, setExpiry] = useState("");
  return (
    <div>
      <p>Available only for a Restricted or Insufficient Information run with no critical QA finding. Approval is independent and never changes CP-5 status.</p>
      <label>Rationale<textarea rows={3} value={rationale} onChange={(event) => setRationale(event.target.value)} /></label>
      <label>Mitigants · one per line<textarea rows={2} value={mitigants} onChange={(event) => setMitigants(event.target.value)} /></label>
      <label>Expiry<input type="date" name="evidence-exception-expiry" autoComplete="off" value={expiry} onChange={(event) => setExpiry(event.target.value)} /></label>
      <button type="button" disabled={busy || !rationale.trim() || !expiry} onClick={() => onRequest({ rationale: rationale.trim(), mitigants: mitigants.split("\n").map((value) => value.trim()).filter(Boolean), expires_at: expiry })}>Request QA exception</button>
    </div>
  );
}

function EvidenceExceptionSection({ row, busy, canReview, onRequest, onReview, onRevoke }: {
  row: CommitteeAgendaItem;
  busy: boolean;
  canReview: boolean;
  onRequest: (input: { rationale: string; mitigants: string[]; expires_at: string }) => void;
  onReview: (exceptionId: string, revision: number, decision: "approve" | "reject", reviewNote: string) => void;
  onRevoke: (exceptionId: string, revision: number, reviewNote: string) => void;
}) {
  const exceptionEligible = row.readiness_failures.length === 1 && row.readiness_failures[0] === "run_not_committee_ready";
  let content = <p>Exceptions are unavailable unless the sole blocker is a non-critical run readiness gap.</p>;
  if (row.evidence_exception) content = <ExistingEvidenceException exception={row.evidence_exception} busy={busy} canReview={canReview} onReview={onReview} onRevoke={onRevoke} />;
  else if (exceptionEligible) content = <EvidenceExceptionRequest busy={busy} onRequest={onRequest} />;
  return <section><h3>Evidence exception</h3>{content}</section>;
}

function AgendaEditAction({ row, busy, editing, onEdit }: {
  row: CommitteeAgendaItem;
  busy: boolean;
  editing: boolean;
  onEdit: () => void;
}) {
  const immutable = row.status === "decided" || row.status === "cancelled";
  if (immutable || editing) return null;
  return <ActionReason reason={busy ? "An action is already in progress" : null} onClick={onEdit}>Edit preparation</ActionReason>;
}

function AgendaReadyAction({ row, busy, onMarkReady }: { row: CommitteeAgendaItem; busy: boolean; onMarkReady: () => void }) {
  if (row.status !== "draft") return null;
  const blocked = row.readiness_failures.length > 0;
  return <button type="button" aria-disabled={(busy || blocked) || undefined} title={blocked ? "Resolve the readiness blockers listed above first" : undefined} onClick={() => { if (!busy && !blocked) onMarkReady(); }}>Mark ready</button>;
}

function AgendaFinalizationActions({ row, busy, onReturnDraft, onFinalize }: {
  row: CommitteeAgendaItem;
  busy: boolean;
  onReturnDraft: () => void;
  onFinalize: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (row.status !== "ready") return null;
  return (
    <>
      <ActionReason reason={busy ? "An action is already in progress" : null} onClick={onReturnDraft}>Return to draft</ActionReason>
      {!confirming ? <ActionReason reason={busy ? "An action is already in progress" : null} onClick={() => setConfirming(true)}>Review finalization</ActionReason> : null}
      {confirming ? <div className="ic-book__confirm" role="alert"><strong>Freeze this committee record?</strong><p>Finalization creates one immutable decision and locks the linked run, report, context, portfolio, and evidence snapshot.</p><div><ActionReason reason={busy ? "Finalizing…" : null} onClick={onFinalize}>{busy ? "Finalizing…" : "Confirm finalization"}</ActionReason><ActionReason reason={busy ? "An action is already in progress" : null} onClick={() => setConfirming(false)}>Cancel</ActionReason></div></div> : null}
    </>
  );
}

function AgendaEditableSections({ row, busy, opinions, canReviewException, onLinkOpinion, onRequestException, onReviewException, onRevokeException }: {
  row: CommitteeAgendaItem;
  busy: boolean;
  opinions: AnalystOpinionVersion[];
  canReviewException: boolean;
  onLinkOpinion: (opinionId: string) => void;
  onRequestException: (input: { rationale: string; mitigants: string[]; expires_at: string }) => void;
  onReviewException: (exceptionId: string, revision: number, decision: "approve" | "reject", reviewNote: string) => void;
  onRevokeException: (exceptionId: string, revision: number, reviewNote: string) => void;
}) {
  if (row.status === "decided" || row.status === "cancelled") return null;
  return <><AnalystViewSection row={row} busy={busy} opinions={opinions} onLinkOpinion={onLinkOpinion} /><EvidenceExceptionSection row={row} busy={busy} canReview={canReviewException} onRequest={onRequestException} onReview={onReviewException} onRevoke={onRevokeException} /></>;
}

function FrozenSnapshotHash({ value }: { value: string | null }) {
  return value ? <p className="ic-book__hash">Frozen SHA {value}</p> : null;
}

function AgendaInspector({
  row,
  busy,
  onSave,
  onMarkReady,
  onReturnDraft,
  onFinalize,
  opinions,
  onLinkOpinion,
  canReviewException,
  onRequestException,
  onReviewException,
  onRevokeException,
  issuerLabel,
}: {
  row: CommitteeAgendaItem;
  busy: boolean;
  onSave: (patch: AgendaPreparationPatch) => void;
  onMarkReady: () => void;
  onReturnDraft: () => void;
  onFinalize: () => void;
  opinions: AnalystOpinionVersion[];
  onLinkOpinion: (opinionId: string) => void;
  canReviewException: boolean;
  onRequestException: (input: { rationale: string; mitigants: string[]; expires_at: string }) => void;
  onReviewException: (exceptionId: string, revision: number, decision: "approve" | "reject", reviewNote: string) => void;
  onRevokeException: (exceptionId: string, revision: number, reviewNote: string) => void;
  issuerLabel: (id: string) => string;
}) {
  const [editing, setEditing] = useState(false);
  const originalScheduledInput = toLocalDateTimeInput(row.scheduled_for);
  const [draft, setDraft] = useState<AgendaDraft>({
    thesis: row.thesis,
    conditions: row.conditions.join("\n"),
    scheduled: originalScheduledInput,
    expiry: row.expiry ?? "",
    recommendation: row.recommendation,
    conviction: row.conviction == null ? "" : String(row.conviction),
  });
  const save = (patch: AgendaPreparationPatch) => {
    onSave(patch);
    setEditing(false);
  };
  return (
    <article className="ic-book__inspector" aria-label="Agenda inspector">
      <header>
        <span className="ic-book__eyebrow">Agenda preparation</span>
        <span className="ic-book__status" data-status={row.status}>● {row.status}</span>
      </header>
      {editing
        ? <AgendaPreparationForm row={row} busy={busy} draft={draft} originalScheduledInput={originalScheduledInput} onDraft={(patch) => setDraft((current) => ({ ...current, ...patch }))} onSave={save} onCancel={() => setEditing(false)} />
        : <AgendaSummary row={row} issuerLabel={issuerLabel} />}
      <ReadinessSection failures={row.readiness_failures} />
      <AgendaEditableSections row={row} busy={busy} opinions={opinions} canReviewException={canReviewException} onLinkOpinion={onLinkOpinion} onRequestException={onRequestException} onReviewException={onReviewException} onRevokeException={onRevokeException} />
      <FrozenSnapshotHash value={row.snapshot_sha256} />
      <AgendaEditAction row={row} busy={busy} editing={editing} onEdit={() => setEditing(true)} />
      <AgendaReadyAction row={row} busy={busy} onMarkReady={onMarkReady} />
      <AgendaFinalizationActions row={row} busy={busy} onReturnDraft={onReturnDraft} onFinalize={onFinalize} />
    </article>
  );
}

function FrozenAuthoritySection({ row }: { row: DecisionBookItem }) {
  const authority = row.snapshot.authority as { source_ids?: unknown; as_of?: unknown; approval_state?: unknown } | undefined;
  const sourceIds = Array.isArray(authority?.source_ids) ? authority.source_ids.filter((value): value is string => typeof value === "string") : [];
  return (
    <section>
      <h3>Frozen authority & evidence</h3>
      <p>{String(authority?.approval_state ?? "unknown")} · as of {String(authority?.as_of ?? "unavailable")}</p>
      {sourceIds.length ? <ul>{sourceIds.map((sourceId) => <li key={sourceId}><Link href={sourceHref(sourceId, row)}>{sourceId}</Link></li>)}</ul> : <p>No frozen source identifiers.</p>}
    </section>
  );
}

function DecisionVotes({ row, busy, onVote, issuerLabel }: {
  row: DecisionBookItem;
  busy: boolean;
  onVote: (vote: "approve" | "dissent" | "abstain", note?: string) => void;
  issuerLabel: (id: string) => string;
}) {
  const [dissent, setDissent] = useState("");
  const [armedVote, setArmedVote] = useState<{ choice: "approve" | "dissent" | "abstain"; note?: string } | null>(null);
  if (armedVote) {
    return (
      <section>
        <h3>Votes & dissent</h3>
        <div className="ic-book__confirm" role="alert">
          <strong>Confirm {armedVote.choice} vote?</strong>
          <p>Record this vote on immutable {row.action} decision for {issuerLabel(row.issuer_id)}.</p>
          <ActionReason reason={busy ? "Vote is being recorded…" : null} onClick={() => { onVote(armedVote.choice, armedVote.note); setArmedVote(null); }}>Confirm {armedVote.choice}</ActionReason>
          <ActionReason reason={busy ? "An action is already in progress" : null} onClick={() => setArmedVote(null)}>Cancel</ActionReason>
        </div>
      </section>
    );
  }
  return (
    <section>
      <h3>Votes & dissent</h3>
      {row.votes.length ? <ul>{row.votes.map((vote) => <li key={vote.id}><strong>{vote.vote}</strong> · {vote.member}{vote.dissent_note ? ` — ${vote.dissent_note}` : ""}</li>)}</ul> : <p>No votes recorded.</p>}
      <div className="ic-book__vote-actions">
        <ActionReason reason={busy ? "An action is already in progress" : null} onClick={() => setArmedVote({ choice: "approve" })}>Approve</ActionReason>
        <ActionReason reason={busy ? "An action is already in progress" : null} onClick={() => setArmedVote({ choice: "abstain" })}>Abstain</ActionReason>
        <label htmlFor={`ic-dissent-${row.id}`}>Dissent rationale</label>
        <textarea id={`ic-dissent-${row.id}`} name="dissent" rows={3} value={dissent} onChange={(event) => setDissent(event.target.value)} />
        <ActionReason reason={!dissent.trim() ? "Enter a dissent rationale first" : busy ? "An action is already in progress" : null} onClick={() => { if (dissent.trim()) setArmedVote({ choice: "dissent", note: dissent.trim() }); }}>Record dissent</ActionReason>
      </div>
    </section>
  );
}

function DecisionReopen({ row, busy, onReopen }: { row: DecisionBookItem; busy: boolean; onReopen: (triggerAlertKey: string) => void }) {
  const [reopenKey, setReopenKey] = useState("");
  if (row.status !== "active") return null;
  return <section><h3>Reopen decision</h3><label htmlFor={`ic-reopen-${row.id}`}>Trigger alert key</label><input id={`ic-reopen-${row.id}`} name="reopen-alert-key" autoComplete="off" value={reopenKey} onChange={(event) => setReopenKey(event.target.value)} placeholder={`alert:${row.issuer_id}:material-change…`} /><ActionReason reason={busy ? "An action is already in progress" : !reopenKey.trim() ? "Enter a trigger alert key first" : null} onClick={() => onReopen(reopenKey.trim())}>Reopen for material change</ActionReason></section>;
}

function DecisionInspector({
  row,
  busy,
  onVote,
  onReopen, issuerLabel,
}: {
  row: DecisionBookItem;
  busy: boolean;
  onVote: (vote: "approve" | "dissent" | "abstain", note?: string) => void;
  onReopen: (triggerAlertKey: string) => void;
  issuerLabel: (id: string) => string;
}) {
  const thesis = String((row.snapshot.agenda as { thesis?: unknown } | undefined)?.thesis ?? row.snapshot.thesis_md ?? "No frozen thesis text.");
  return (
    <article className="ic-book__inspector" aria-label="Decision inspector">
      <header><span className="ic-book__eyebrow">Immutable decision</span><span className="ic-book__status" data-status={row.status}>● {row.status}</span></header>
      <h2>{row.action.toUpperCase()} · {issuerLabel(row.issuer_id)}</h2>
      <p>{thesis}</p>
      <dl><div><dt>Snapshot</dt><dd>{row.snapshot_sha256}</dd></div><div><dt>Run</dt><dd>{row.run_id}</dd></div><div><dt>Report version</dt><dd>{row.report_version_id ?? "—"}</dd></div><div><dt>Expiry</dt><dd>{row.expiry ?? "—"}</dd></div></dl>
      <FrozenAuthoritySection row={row} />
      <ConditionsSection conditions={row.conditions} />
      <DecisionVotes row={row} busy={busy} onVote={onVote} issuerLabel={issuerLabel} />
      <DecisionReopen row={row} busy={busy} onReopen={onReopen} />
      {row.reopened_at ? <section><h3>Reopen timeline</h3><p>Reopened {formatDate(row.reopened_at)} · {row.reopen_alert_key}</p></section> : null}
    </article>
  );
}

const IC_BOOK_LOADING_STATE: DecisionContextState = {
  whatChanged: { kind: "loading", message: "Checking the register…" },
  whyItMatters: { kind: "loading", message: "Checking priority…" },
  requiredAction: { kind: "loading", message: "Checking readiness…" },
  evidenceHealth: { kind: "loading", message: "Checking evidence…" },
};

function unavailableICBookState(message: string): DecisionContextState {
  const cell: DecisionDatumState = { kind: "unavailable", message };
  return { whatChanged: cell, whyItMatters: cell, requiredAction: cell, evidenceHealth: cell };
}

function registerAuthority(): DecisionAuthority {
  return {
    provenance: { origin: "LIVE", method: "DERIVED", detail: "Committee register roll-up." },
    approval: "UNRATIFIED",
  };
}

type RegisterDatumInput = {
  dataset: Dataset;
  agenda: CommitteeAgendaItem[];
  decisions: DecisionBookItem[];
  asOf: string;
  authority: DecisionAuthority;
};

function changedRegisterDatum({ dataset, agenda, decisions, asOf, authority }: RegisterDatumInput, total: number): DecisionDatumState {
  if (total === 0) {
    return { kind: "observed-empty", message: dataset === "agenda" ? "No agenda items in the register" : "No decisions in the register", asOf, authority };
  }
  const active = dataset === "agenda"
    ? `${agenda.filter((row) => row.status === "ready").length} ready`
    : `${decisions.filter((row) => row.status === "active").length} active`;
  return { kind: "ready", value: `${total} ${dataset === "agenda" ? "agenda items" : "decisions"} · ${active}`, asOf, authority };
}

function priorityRegisterDatum({ dataset, agenda, decisions, asOf, authority }: RegisterDatumInput): DecisionDatumState {
  const rows = dataset === "agenda" ? agenda : decisions;
  if (!rows.length) {
    return { kind: "observed-empty", message: dataset === "agenda" ? "No meeting scheduled" : "No decisions recorded", asOf, authority };
  }
  const value = dataset === "agenda"
    ? `Next meeting ${fmtUtcDateTime([...agenda].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))[0].scheduled_for)}`
    : `Latest decision ${fmtUtcDateTime([...decisions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0].created_at)}`;
  return { kind: "ready", value, asOf, authority };
}

function actionRegisterDatum({ dataset, agenda, decisions, asOf, authority }: RegisterDatumInput): DecisionDatumState {
  const count = dataset === "agenda"
    ? agenda.filter((row) => row.readiness_failures.length > 0).length
    : decisions.filter((row) => row.status === "reopened").length;
  if (count === 0) {
    return { kind: "observed-empty", message: dataset === "agenda" ? "No readiness blockers" : "No reopened decisions", asOf, authority };
  }
  const label = dataset === "agenda"
    ? `${count === 1 ? "draft" : "drafts"} with readiness blockers`
    : count === 1 ? "reopened decision" : "reopened decisions";
  return { kind: "ready", value: `${count} ${label}`, asOf, authority };
}

function evidenceRegisterDatum({ dataset, agenda, decisions, asOf, authority }: RegisterDatumInput): DecisionDatumState {
  const count = dataset === "agenda"
    ? agenda.filter((row) => !row.run_id).length
    : decisions.filter((row) => !row.report_id).length;
  if (count === 0) {
    return { kind: "observed-empty", message: dataset === "agenda" ? "Every item is linked to a run" : "Every decision is linked to a report", asOf, authority };
  }
  const label = dataset === "agenda"
    ? count === 1 ? "item lacks" : "items lack"
    : count === 1 ? "decision lacks" : "decisions lack";
  return { kind: "ready", value: `${count} ${label} ${dataset === "agenda" ? "a linked run" : "a report link"}`, asOf, authority };
}

function buildICBookDecision({ dataset, loading, error, agenda, decisions, total, fetchedAt }: {
  dataset: Dataset;
  loading: boolean;
  error: string | null;
  agenda: CommitteeAgendaItem[];
  decisions: DecisionBookItem[];
  total: number;
  fetchedAt: string | null;
}): DecisionContextState {
  if (loading || fetchedAt == null) return IC_BOOK_LOADING_STATE;
  if (error && !agenda.length && !decisions.length) return unavailableICBookState("IC Book register unavailable");
  const input: RegisterDatumInput = { dataset, agenda, decisions, asOf: fetchedAt, authority: registerAuthority() };
  return {
    whatChanged: changedRegisterDatum(input, total),
    whyItMatters: priorityRegisterDatum(input),
    requiredAction: actionRegisterDatum(input),
    evidenceHealth: evidenceRegisterDatum(input),
  };
}

function ClearRegisterFilters({ onClear }: { onClear: () => void }) {
  return <button type="button" className="caos-action-secondary focus-ring" onClick={onClear}>Clear filters</button>;
}

type RegisterSelectionProps = {
  selected: string | null;
  sort: string | null;
  direction: string | null;
  filtered: boolean;
  issuerLabel: (id: string) => string;
  onSort: (key: string, current: string) => void;
  onSelect: (id: string) => void;
  onClear: () => void;
};

function AgendaRegisterContent({ rows, selected, sort, direction, filtered, issuerLabel, ownerLabel, onSort, onSelect, onClear, onAdd }: RegisterSelectionProps & {
  rows: CommitteeAgendaItem[];
  ownerLabel: (id: string | null) => string;
  onAdd: () => void;
}) {
  if (rows.length) {
    return <AgendaTable rows={rows} selected={selected} sort={{ key: sort === "updated_at" ? "updated_at" : "scheduled_for", direction: direction === "desc" ? "desc" : "asc" }} onSort={(key) => onSort(key, "scheduled_for")} onSelect={onSelect} issuerLabel={issuerLabel} ownerLabel={ownerLabel} />;
  }
  if (filtered) {
    return <SurfaceState kind="empty" headingLevel={2} title="No items match the current filters" detail="Clear the filters to see every agenda item." primaryAction={<ClearRegisterFilters onClear={onClear} />} />;
  }
  return <SurfaceState kind="empty" headingLevel={2} title="No agenda items yet" detail="Add the first committee agenda item to begin the book." primaryAction={<button type="button" className="caos-action-primary focus-ring" onClick={onAdd}>Add agenda item</button>} />;
}

function HistoryRegisterContent({ rows, selected, sort, direction, filtered, issuerLabel, onSort, onSelect, onClear }: RegisterSelectionProps & {
  rows: DecisionBookItem[];
}) {
  if (rows.length) {
    return <HistoryTable rows={rows} selected={selected} sort={{ key: sort === "expiry" ? "expiry" : "created_at", direction: direction === "desc" ? "desc" : "asc" }} onSort={(key) => onSort(key, "created_at")} onSelect={onSelect} issuerLabel={issuerLabel} />;
  }
  return <SurfaceState kind="empty" headingLevel={2} title={filtered ? "No decisions match the current filters" : "No immutable decisions yet"} detail={filtered ? "Clear the filters to see every recorded decision." : "Finalized committee decisions will appear here."} {...(filtered ? { primaryAction: <ClearRegisterFilters onClear={onClear} /> } : {})} />;
}

type ICBookRegisterProps = RegisterSelectionProps & {
  dataset: Dataset;
  loading: boolean;
  error: string | null;
  agenda: CommitteeAgendaItem[];
  decisions: DecisionBookItem[];
  nextCursor: string | null;
  ownerLabel: (id: string | null) => string;
  onAdd: () => void;
  onNext: (cursor: string) => void;
};

function ICBookRegisterContent(props: Omit<ICBookRegisterProps, "nextCursor" | "onNext">) {
  if (props.loading) return <SurfaceState kind="loading" headingLevel={2} title="Loading IC Book" compact />;
  if (props.error && !props.agenda.length && !props.decisions.length) return <SurfaceState kind="error" headingLevel={2} title="IC Book unavailable" detail={props.error} compact />;
  if (props.dataset === "agenda") return <AgendaRegisterContent rows={props.agenda} selected={props.selected} sort={props.sort} direction={props.direction} filtered={props.filtered} issuerLabel={props.issuerLabel} ownerLabel={props.ownerLabel} onSort={props.onSort} onSelect={props.onSelect} onClear={props.onClear} onAdd={props.onAdd} />;
  return <HistoryRegisterContent rows={props.decisions} selected={props.selected} sort={props.sort} direction={props.direction} filtered={props.filtered} issuerLabel={props.issuerLabel} onSort={props.onSort} onSelect={props.onSelect} onClear={props.onClear} />;
}

function ICBookRegister(props: ICBookRegisterProps) {
  const { nextCursor, onNext, ...contentProps } = props;
  return (
    <DominantTableRegion ownerId="ic-book-register" label={props.dataset === "agenda" ? "Committee agenda register" : "Decision history register"}>
      <div className="ic-book__table-scroll"><ICBookRegisterContent {...contentProps} /></div>
      {nextCursor ? <button type="button" onClick={() => onNext(nextCursor)}>Next page</button> : null}
    </DominantTableRegion>
  );
}

type ICBookInspectorProps = {
  agenda: CommitteeAgendaItem | null;
  decision: DecisionBookItem | null;
  opinions: AnalystOpinionVersion[];
  busy: boolean;
  canReviewException: boolean;
  issuerLabel: (id: string) => string;
  onSave: (patch: AgendaPreparationPatch) => void;
  onMarkReady: () => void;
  onReturnDraft: () => void;
  onFinalize: () => void;
  onLinkOpinion: (id: string) => void;
  onRequestException: (input: { rationale: string; mitigants: string[]; expires_at: string }) => void;
  onReviewException: (id: string, revision: number, decision: "approve" | "reject", note: string) => void;
  onRevokeException: (id: string, revision: number, note: string) => void;
  onVote: (vote: "approve" | "dissent" | "abstain", note?: string) => void;
  onReopen: (triggerAlertKey: string) => void;
};

function ICBookInspector(props: ICBookInspectorProps) {
  if (props.agenda) {
    const row = props.agenda;
    return <AgendaInspector key={`${row.id}:${row.revision}`} row={row} busy={props.busy} onSave={props.onSave} onMarkReady={props.onMarkReady} onReturnDraft={props.onReturnDraft} onFinalize={props.onFinalize} opinions={props.opinions.filter((view) => view.issuer_id === row.issuer_id)} onLinkOpinion={props.onLinkOpinion} canReviewException={props.canReviewException} onRequestException={props.onRequestException} onReviewException={props.onReviewException} onRevokeException={props.onRevokeException} issuerLabel={props.issuerLabel} />;
  }
  if (props.decision) {
    return <DecisionInspector key={props.decision.id} row={props.decision} busy={props.busy} onVote={props.onVote} onReopen={props.onReopen} issuerLabel={props.issuerLabel} />;
  }
  return <div className="ic-book__empty">Select an agenda item or decision to inspect its thesis, conditions, lineage and governance record.</div>;
}

function AgendaContextSummary({ form, issuers }: { form: AgendaFormState; issuers: Issuer[] }) {
  if (!form.contextId) return null;
  const issuer = issuers.find((item) => item.id === form.issuer);
  const label = issuer ? (issuer.ticker ?? issuer.name) : null;
  return <p className="ic-book__hash">Linked context{label ? ` · ${label}` : ""}{form.run ? ` · run ${form.run.slice(0, 8)}` : ""} <span title={form.contextId}>{form.contextId.slice(0, 8)}…</span></p>;
}

function AgendaReferenceFields({ form, setForm, issuers, portfolios, runs, opinions }: {
  form: AgendaFormState;
  setForm: SetAgendaForm;
  issuers: Issuer[];
  portfolios: PortfolioSummary[];
  runs: RunListItemDTO[];
  opinions: AnalystOpinionVersion[];
}) {
  return <>
    <label>Issuer<select name="issuer" value={form.issuer} onChange={(event) => setForm((current) => ({ ...current, issuer: event.target.value, run: "", report: "", contextId: "", opinion: "" }))} required><option value="">Select issuer…</option>{issuers.map((issuer) => <option key={issuer.id} value={issuer.id}>{issuer.ticker ?? issuer.name}</option>)}</select></label>
    <label>Portfolio<select name="portfolio" value={form.portfolio} onChange={(event) => setForm((current) => ({ ...current, portfolio: event.target.value, run: "", report: "", contextId: "" }))}><option value="">No portfolio</option>{portfolios.map((portfolio) => <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>)}</select></label>
    <label>Analyst view<select name="analyst-opinion" value={form.opinion} onChange={(event) => setForm((current) => ({ ...current, opinion: event.target.value }))}><option value="">No analyst view linked</option>{opinions.map((view) => <option key={view.id} value={view.id}>{view.stance} · v{view.version} · {view.evidence_state}</option>)}</select></label>
    <label>Run<select name="run" value={form.run} onChange={(event) => setForm((current) => ({ ...current, run: event.target.value, report: event.target.value === current.run ? current.report : "", contextId: event.target.value === current.run ? current.contextId : "" }))}><option value="">Select run…</option>{runs.map((run) => <option key={run.id} value={run.id}>{run.id.slice(0, 8)} · {run.committee_status}</option>)}</select></label>
    <label>Report version<input name="report-version" autoComplete="off" value={form.report} readOnly placeholder="Optional — select in Report Studio…" /></label>
  </>;
}

function AgendaDecisionFields({ form, setForm }: { form: AgendaFormState; setForm: SetAgendaForm }) {
  return <>
    <label>Meeting time<input name="scheduled" type="datetime-local" autoComplete="off" value={form.scheduled} onChange={(event) => setForm((current) => ({ ...current, scheduled: event.target.value }))} required /></label>
    <label>Decision expiry<input name="expiry" type="date" autoComplete="off" value={form.expiry} onChange={(event) => setForm((current) => ({ ...current, expiry: event.target.value }))} /></label>
    <label>Recommendation<select name="recommendation" value={form.recommendation} onChange={(event) => setForm((current) => ({ ...current, recommendation: event.target.value as CommitteeRecommendation }))}><option value="approve">Approve</option><option value="decline">Decline</option><option value="revisit">Revisit</option></select></label>
    <label>Conviction · 0–100%<input name="conviction" type="number" min="0" max="100" inputMode="decimal" autoComplete="off" placeholder="0–100…" value={form.conviction} onChange={(event) => setForm((current) => ({ ...current, conviction: event.target.value }))} /></label>
  </>;
}

function AgendaThesisFields({ form, setForm }: { form: AgendaFormState; setForm: SetAgendaForm }) {
  return <>
    <label>Thesis<textarea name="thesis" rows={5} maxLength={50_000} value={form.thesis} onChange={(event) => setForm((current) => ({ ...current, thesis: event.target.value }))} required /></label>
    <label>Conditions · one per line<textarea name="conditions" rows={3} value={form.conditions} onChange={(event) => setForm((current) => ({ ...current, conditions: event.target.value }))} /></label>
  </>;
}

function AgendaCreateForm({ form, setForm, issuers, portfolios, runs, opinions, errors, busy, onSubmit }: {
  form: AgendaFormState;
  setForm: SetAgendaForm;
  issuers: Issuer[];
  portfolios: PortfolioSummary[];
  runs: RunListItemDTO[];
  opinions: AnalystOpinionVersion[];
  errors: Array<string | null>;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <details className="ic-book__create" id="ic-book-create">
      <summary className="ic-book__create-summary">Agenda item form</summary>
      <form className="ic-book__form" aria-label="Add agenda item" onSubmit={onSubmit}>
        {errors.filter((message): message is string => Boolean(message)).map((message) => <p key={message} role="alert">{message}</p>)}
        <AgendaContextSummary form={form} issuers={issuers} />
        <AgendaReferenceFields form={form} setForm={setForm} issuers={issuers} portfolios={portfolios} runs={runs} opinions={opinions} />
        <AgendaDecisionFields form={form} setForm={setForm} />
        <AgendaThesisFields form={form} setForm={setForm} />
        <ActionReason type="submit" reason={busy ? "Saving…" : null}>{busy ? "Saving…" : "Add agenda item"}</ActionReason>
      </form>
    </details>
  );
}

function moveToolbarTab(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const activeIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
  const offset = event.key === "ArrowRight" ? 1 : -1;
  const nextIndex = (activeIndex + offset + tabs.length) % tabs.length;
  tabs[nextIndex]?.focus();
  tabs[nextIndex]?.click();
}

function ICBookToolbar({ dataset, status, brief, onDataset, onStatus, onRefresh }: {
  dataset: Dataset;
  status: string | null;
  brief: string;
  onDataset: (dataset: Dataset) => void;
  onStatus: (status: string | null) => void;
  onRefresh: () => void;
}) {
  return (
    <header className="ic-book__toolbar">
      <div><p>{brief}</p></div>
      <div role="tablist" aria-label="IC Book dataset" onKeyDown={moveToolbarTab}>
        {(["agenda", "history"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={dataset === value} tabIndex={dataset === value ? 0 : -1} onClick={() => onDataset(value)}>{value === "agenda" ? "Agenda" : "Decision history"}</button>)}
      </div>
      <label>Status<select name="ic-book-status" value={status ?? ""} onChange={(event) => onStatus(event.target.value || null)}><option value="">All statuses</option>{dataset === "agenda" ? <><option value="draft">Draft</option><option value="ready">Ready</option><option value="decided">Decided</option><option value="cancelled">Cancelled</option></> : <><option value="active">Active</option><option value="reopened">Reopened</option></>}</select></label>
      <button type="button" onClick={onRefresh}>Refresh</button>
    </header>
  );
}

function ReadyFinalization({ row }: { row: CommitteeAgendaItem | null }) {
  if (row?.status !== "ready") return null;
  const href = row.run_id ? `/deepdive?run=${encodeURIComponent(row.run_id)}` : "/deepdive";
  return <p className="ic-book__finalization">Ready for immutable finalization · <Link href={href}>review run evidence</Link></p>;
}

function useReferenceCatalogs() {
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([getIssuers(), getPortfolios()])
      .then(([issuerRows, portfolioRows]) => {
        setIssuers(issuerRows);
        setPortfolios(portfolioRows);
        setCatalogError(null);
      })
      .catch((reason) => setCatalogError(toErrorMessage(reason, "IC Book reference data unavailable.")));
  }, []);
  return { issuers, portfolios, catalogError };
}

function useAgendaForm(initialIssuer: string, initialPortfolio: string, context: ReturnType<typeof useAnalysisContext>["context"]) {
  const [form, setForm] = useState<AgendaFormState>({ issuer: initialIssuer, portfolio: initialPortfolio, scheduled: "", expiry: "", recommendation: "approve", conviction: "", run: "", report: "", contextId: "", opinion: "", thesis: "", conditions: "" });
  const appliedContextId = useRef<string | null>(null);
  useEffect(() => {
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
  }, [context]);
  return { form, setForm };
}

function useIssuerRuns(issuerId: string, setForm: SetAgendaForm) {
  const [runs, setRuns] = useState<RunListItemDTO[]>([]);
  const [runsError, setRunsError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!issuerId) {
      setRuns([]);
      return () => { alive = false; };
    }
    listRuns(issuerId).then((rows) => {
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
  }, [issuerId, setForm]);
  return { runs, runsError };
}

function useIssuerOpinions(issuerId: string, setForm: SetAgendaForm, setError: Dispatch<SetStateAction<string | null>>) {
  const [opinions, setOpinions] = useState<AnalystOpinionVersion[]>([]);
  useEffect(() => {
    let alive = true;
    if (!issuerId) {
      setOpinions([]);
      return () => { alive = false; };
    }
    analystOpinionsApi.list(issuerId).then((history) => {
      if (!alive) return;
      setOpinions(history.items);
      setForm((current) => ({ ...current, opinion: history.items.some((view) => view.id === current.opinion) ? current.opinion : history.current?.id ?? "" }));
    }).catch((reason) => {
      if (!alive) return;
      setOpinions([]);
      setError(toErrorMessage(reason, "Analyst view unavailable."));
    });
    return () => { alive = false; };
  }, [issuerId, setError, setForm]);
  return opinions;
}

type RegisterFilters = {
  issuer: string | null;
  portfolio: string | null;
  cursor: string | null;
  direction: string | null;
  status: string | null;
  sort: string | null;
};

async function loadICBookRegister(dataset: Dataset, filters: RegisterFilters) {
  const common = { issuer_id: filters.issuer || undefined, portfolio_id: filters.portfolio || undefined, cursor: filters.cursor || undefined, direction: filters.direction === "desc" ? "desc" as const : "asc" as const, limit: 50 };
  if (dataset === "agenda") {
    const page = await icBookApi.listAgenda({ ...common, status: filters.status as AgendaStatus | undefined, sort: filters.sort === "updated_at" ? "updated_at" : "scheduled_for" });
    return { items: page.items, next: page.next_cursor, total: page.total, kind: "agenda" as const };
  }
  const status = filters.status === "reopened" ? "reopened" : filters.status === "active" ? "active" : undefined;
  const page = await icBookApi.listDecisions({ ...common, status, sort: filters.sort === "expiry" ? "expiry" : "created_at" });
  return { items: page.items, next: page.next_cursor, total: page.total, kind: "history" as const };
}

function useICBookRegisterData(
  dataset: Dataset,
  issuer: string | null,
  portfolio: string | null,
  cursor: string | null,
  direction: string | null,
  status: string | null,
  sort: string | null,
  setError: Dispatch<SetStateAction<string | null>>,
) {
  const [agenda, setAgenda] = useState<CommitteeAgendaItem[]>([]);
  const [decisions, setDecisions] = useState<DecisionBookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loadICBookRegister(dataset, { issuer, portfolio, cursor, direction, status, sort }).then((result) => {
      if (!alive) return;
      if (result.kind === "agenda") {
        setAgenda(result.items);
        setDecisions([]);
      } else {
        setDecisions(result.items);
        setAgenda([]);
      }
      setNextCursor(result.next);
      setTotal(result.total);
      setFetchedAt(new Date().toISOString());
    }).catch((reason) => {
      if (alive) setError(toErrorMessage(reason, "IC Book data unavailable."));
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [dataset, issuer, portfolio, cursor, direction, status, sort, reloadToken, setError]);
  return { agenda, decisions, setDecisions, loading, nextCursor, total, fetchedAt, reload: () => setReloadToken((current) => current + 1) };
}

type MutationContext = {
  setBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  reload: () => void;
};

type MutationOptions<T> = {
  clearError?: boolean;
  reload?: boolean;
  onSuccess?: (result: T) => void;
};

async function performICBookMutation<T>(context: MutationContext, message: string, action: () => Promise<T>, options: MutationOptions<T> = {}) {
  context.setBusy(true);
  if (options.clearError) context.setError(null);
  try {
    const result = await action();
    options.onSuccess?.(result);
    if (options.reload) context.reload();
    return result;
  } catch (reason) {
    context.setError(toErrorMessage(reason, message));
    return undefined;
  } finally {
    context.setBusy(false);
  }
}

function withSelectedRow<Row, Result>(row: Row | null, context: MutationContext, message: string, action: (selected: Row) => Promise<Result>, options?: MutationOptions<Result>) {
  if (!row) return Promise.resolve(undefined);
  return performICBookMutation(context, message, () => action(row), options);
}

function buildAgendaActions(row: CommitteeAgendaItem | null, context: MutationContext) {
  return {
    savePreparation: (patch: AgendaPreparationPatch) => withSelectedRow(row, context, "Agenda preparation could not be saved.", (selected) => icBookApi.patchAgenda(selected.id, { expected_revision: selected.revision, ...patch }), { clearError: true, reload: true }),
    markReady: () => withSelectedRow(row, context, "Agenda readiness failed.", (selected) => icBookApi.patchAgenda(selected.id, { expected_revision: selected.revision, status: "ready" }), { reload: true }),
    returnDraft: () => withSelectedRow(row, context, "Agenda could not return to draft.", (selected) => icBookApi.patchAgenda(selected.id, { expected_revision: selected.revision, status: "draft" }), { reload: true }),
    finalize: () => withSelectedRow(row, context, "Agenda finalization failed.", (selected) => icBookApi.finalizeAgenda(selected.id, selected.revision), { reload: true }),
    linkOpinion: (opinionId: string) => withSelectedRow(row, context, "Analyst view could not be linked.", (selected) => icBookApi.patchAgenda(selected.id, { expected_revision: selected.revision, analyst_opinion_version_id: opinionId }), { clearError: true, reload: true }),
    requestException: (input: { rationale: string; mitigants: string[]; expires_at: string }) => withSelectedRow(row, context, "Evidence exception could not be requested.", (selected) => icBookApi.requestException(selected.id, { expected_revision: selected.revision, ...input }), { clearError: true, reload: true }),
    reviewException: (id: string, revision: number, decision: "approve" | "reject", note: string) => performICBookMutation(context, "Evidence exception could not be reviewed.", () => icBookApi.reviewException(id, { expected_revision: revision, decision, review_note: note }), { clearError: true, reload: true }),
    revokeException: (id: string, revision: number, note: string) => performICBookMutation(context, "Evidence exception could not be revoked.", () => icBookApi.revokeException(id, { expected_revision: revision, review_note: note }), { clearError: true, reload: true }),
  };
}

function buildDecisionActions(row: DecisionBookItem | null, context: MutationContext, setDecisions: Dispatch<SetStateAction<DecisionBookItem[]>>) {
  return {
    vote: (choice: "approve" | "dissent" | "abstain", note?: string) => withSelectedRow(row, context, "Vote could not be recorded.", (selected) => icBookApi.vote(selected.id, choice, note), { clearError: true, onSuccess: (updated) => { setDecisions((rows) => rows.map((item) => item.id === updated.id ? updated : item)); context.setError(null); } }),
    reopen: (triggerAlertKey: string) => withSelectedRow(row, context, "Decision could not be reopened.", (selected) => icBookApi.reopen(selected.id, triggerAlertKey), { reload: true }),
  };
}

function buildCreateAgendaHandler({ form, setForm, busy, context, onCreated }: {
  form: AgendaFormState;
  setForm: SetAgendaForm;
  busy: boolean;
  context: MutationContext;
  onCreated: (row: CommitteeAgendaItem) => void;
}) {
  return async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !form.issuer || !form.scheduled || !form.thesis.trim()) return;
    await performICBookMutation(context, "Agenda item could not be created.", () => icBookApi.createAgenda({
      issuer_id: form.issuer,
      portfolio_id: form.portfolio || null,
      scheduled_for: new Date(form.scheduled).toISOString(),
      expiry: form.expiry || null,
      recommendation: form.recommendation,
      conviction: form.conviction ? Number(form.conviction) : null,
      thesis: form.thesis.trim(),
      conditions: form.conditions.split("\n").map((value) => value.trim()).filter(Boolean),
      run_id: form.run || null,
      report_version_id: form.report || null,
      context_id: form.contextId || null,
      analyst_opinion_version_id: form.opinion || null,
      status: "draft",
    }), { clearError: true, onSuccess: (created) => { onCreated(created); context.reload(); setForm((current) => ({ ...current, thesis: "", conditions: "" })); } });
  };
}

function personaBriefFor(roleView: ReturnType<typeof useRoleView>["roleView"]) {
  if (roleView === "pm") return "Rank committee actions, dissent and expiring conditions.";
  if (roleView === "qa") return "Validate readiness, frozen lineage and immutable governance records.";
  return "Prepare agenda items, inspect evidence and record committee votes.";
}

function issuerName(issuers: Issuer[], id: string) {
  const issuer = issuers.find((row) => row.id === id);
  return issuer ? (issuer.ticker ?? issuer.name) : `Unavailable issuer ID · ${id}`;
}

function ownerName(id: string | null) {
  return id ? `Unavailable owner ID · ${id}` : "Unassigned";
}

function openAgendaCreateForm() {
  const element = document.getElementById("ic-book-create") as HTMLDetailsElement | null;
  if (!element) return;
  element.open = true;
  element.scrollIntoView({ behavior: "smooth" });
  requestAnimationFrame(() => element.querySelector<HTMLElement>("select, input")?.focus());
}

function nextRegisterSortDirection(currentSort: string | null, fallback: string, key: string, direction: string | null) {
  return (currentSort ?? fallback) === key && direction !== "desc" ? "desc" : "asc";
}

function hasRegisterFilters(filters: RegisterFilters) {
  return Boolean(filters.status || filters.issuer || filters.portfolio);
}

type ICBookPageProps = {
  dataset: Dataset;
  total: number;
  roleView: ReturnType<typeof useRoleView>["roleView"];
  brief: string;
  status: string | null;
  error: string | null;
  decision: DecisionContextState;
  primary: ReactNode;
  inspector: ReactNode;
  utility: ReactNode;
  finalization: ReactNode;
  onAdd: () => void;
  onDataset: (dataset: Dataset) => void;
  onStatus: (status: string | null) => void;
  onRefresh: () => void;
};

function ICBookPage(props: ICBookPageProps) {
  const registerLabel = props.dataset === "agenda" ? "agenda items" : "decisions";
  return (
    <EnterprisePage
      kind="worklist"
      identity={<ShellIdentity tag="IC" title="IC Book" />}
      status={<span className="tabular text-caos-2xs text-caos-muted">{props.total} {registerLabel}</span>}
      primaryAction={<button type="button" className="caos-primary-action focus-ring" onClick={props.onAdd}>Add agenda item</button>}
      narrowContract={{ essentialControls: <span className="tabular text-caos-2xs text-caos-muted">{props.total} records</span> }}
    >
      <div className="ic-book">
        <ICBookToolbar dataset={props.dataset} status={props.status} brief={props.brief} onDataset={props.onDataset} onStatus={props.onStatus} onRefresh={props.onRefresh} />
        {props.error ? <p className="ic-book__error" role="alert">{props.error}</p> : null}
        <PersonaWorkbench surface="ic-book" persona={props.roleView} decision={<DecisionHeader state={props.decision} defaultOpen={false} />} primary={props.primary} inspector={props.inspector} utility={props.utility} finalization={props.finalization} />
      </div>
    </EnterprisePage>
  );
}

function datasetFromUrl(value: string | null | undefined): Dataset {
  return value === "history" ? "history" : "agenda";
}

function registerFiltersFromUrl(values: { issuer?: string | null; portfolio?: string | null; cursor?: string | null; direction?: string | null; status?: string | null; sort?: string | null }): RegisterFilters {
  return {
    issuer: values.issuer ?? null,
    portfolio: values.portfolio ?? null,
    cursor: values.cursor ?? null,
    direction: values.direction ?? null,
    status: values.status ?? null,
    sort: values.sort ?? null,
  };
}

function nullableUrlValue(value: string | null | undefined) {
  return value ?? null;
}

function selectedRegisterRow<Row extends { id: string }>(rows: Row[], selectedId: string | null | undefined) {
  return rows.find((row) => row.id === selectedId) ?? null;
}

function canReviewEvidenceException(user: ReturnType<typeof useAuth>["user"]) {
  return ["qa", "admin"].includes(user?.role.toLowerCase() ?? "");
}

type BuildICBookPanelsInput = {
  dataset: Dataset;
  register: ReturnType<typeof useICBookRegisterData>;
  error: string | null;
  filters: RegisterFilters;
  selectedId: string | null;
  selectedAgenda: CommitteeAgendaItem | null;
  selectedDecision: DecisionBookItem | null;
  filtered: boolean;
  issuerLabel: (id: string) => string;
  ownerLabel: (id: string | null) => string;
  opinions: AnalystOpinionVersion[];
  busy: boolean;
  canReview: boolean;
  agendaActions: ReturnType<typeof buildAgendaActions>;
  decisionActions: ReturnType<typeof buildDecisionActions>;
  form: AgendaFormState;
  setForm: SetAgendaForm;
  issuers: Issuer[];
  portfolios: PortfolioSummary[];
  runs: RunListItemDTO[];
  formErrors: Array<string | null>;
  create: (event: FormEvent<HTMLFormElement>) => void;
  sortRegister: (key: string, current: string) => void;
  clearFilters: () => void;
  select: (id: string) => void;
  next: (cursor: string) => void;
};

function buildRegisterPanel({ dataset, register, error, filters, selectedId, filtered, issuerLabel, ownerLabel, sortRegister, clearFilters, select, next }: BuildICBookPanelsInput) {
  const registerProps: ICBookRegisterProps = {
    dataset,
    loading: register.loading,
    error,
    agenda: register.agenda,
    decisions: register.decisions,
    selected: selectedId,
    sort: filters.sort,
    direction: filters.direction,
    nextCursor: register.nextCursor,
    filtered,
    issuerLabel,
    ownerLabel,
    onSort: sortRegister,
    onSelect: select,
    onClear: clearFilters,
    onAdd: openAgendaCreateForm,
    onNext: next,
  };
  return <ICBookRegister {...registerProps} />;
}

function buildInspectorPanel({ selectedAgenda, selectedDecision, opinions, busy, canReview, issuerLabel, agendaActions, decisionActions }: BuildICBookPanelsInput) {
  const inspectorProps: ICBookInspectorProps = {
    agenda: selectedAgenda,
    decision: selectedDecision,
    opinions,
    busy,
    canReviewException: canReview,
    issuerLabel,
    onSave: agendaActions.savePreparation,
    onMarkReady: agendaActions.markReady,
    onReturnDraft: agendaActions.returnDraft,
    onFinalize: agendaActions.finalize,
    onLinkOpinion: agendaActions.linkOpinion,
    onRequestException: agendaActions.requestException,
    onReviewException: agendaActions.reviewException,
    onRevokeException: agendaActions.revokeException,
    onVote: decisionActions.vote,
    onReopen: decisionActions.reopen,
  };
  return <ICBookInspector {...inspectorProps} />;
}

function buildCreateFormPanel({ form, setForm, issuers, portfolios, runs, opinions, formErrors, busy, create }: BuildICBookPanelsInput) {
  const createFormProps: Parameters<typeof AgendaCreateForm>[0] = { form, setForm, issuers, portfolios, runs, opinions, errors: formErrors, busy, onSubmit: create };
  return <AgendaCreateForm {...createFormProps} />;
}

function buildICBookPanels(input: BuildICBookPanelsInput) {
  return {
    primary: buildRegisterPanel(input),
    inspector: buildInspectorPanel(input),
    utility: buildCreateFormPanel(input),
    finalization: <ReadyFinalization row={input.selectedAgenda} />,
  };
}

export function ICBookWorkbench() {
  const { roleView } = useRoleView();
  const { user } = useAuth();
  const analysis = useAnalysisContext({ name: "IC Book" });
  const { values, update } = useTypedUrlState(URL_KEYS);
  const dataset = datasetFromUrl(values.dataset);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { issuers, portfolios, catalogError } = useReferenceCatalogs();
  const filters = registerFiltersFromUrl(values);
  const selectedId = nullableUrlValue(values.selected);
  const { form, setForm } = useAgendaForm(filters.issuer ?? "", filters.portfolio ?? "", analysis.context);
  const { runs, runsError } = useIssuerRuns(form.issuer, setForm);
  const opinions = useIssuerOpinions(form.issuer, setForm, setError);
  const register = useICBookRegisterData(
    dataset,
    filters.issuer,
    filters.portfolio,
    filters.cursor,
    filters.direction,
    filters.status,
    filters.sort,
    setError,
  );
  const selectedAgenda = selectedRegisterRow(register.agenda, selectedId);
  const selectedDecision = selectedRegisterRow(register.decisions, selectedId);
  const issuerLabel = (id: string) => issuerName(issuers, id);
  // The current IC Book contract carries an owner id but no analyst directory.
  // Preserve that fact instead of substituting an unrelated catalog name.
  const ownerLabel = ownerName;

  const personaBrief = personaBriefFor(roleView);
  const icDecision = useMemo(
    () => buildICBookDecision({ dataset, loading: register.loading, error, agenda: register.agenda, decisions: register.decisions, total: register.total, fetchedAt: register.fetchedAt }),
    [dataset, register.loading, error, register.agenda, register.decisions, register.total, register.fetchedAt],
  );
  // An empty register with active filters ("no match") reads differently from a
  // genuinely empty book ("add the first item") — the copy and CTA must match.
  const icBookEmpty = hasRegisterFilters(filters);
  // Open the collapsed create form and focus its first control — the one
  // affordance for adding an item (replaces the bare scrollIntoView anchor).
  const mutationContext = { setBusy, setError, reload: register.reload };
  const agendaActions = buildAgendaActions(selectedAgenda, mutationContext);
  const decisionActions = buildDecisionActions(selectedDecision, mutationContext, register.setDecisions);
  const create = buildCreateAgendaHandler({ form, setForm, busy, context: mutationContext, onCreated: (row) => update({ dataset: "agenda", selected: row.id, status: null, cursor: null }, "replace") });
  const refresh = () => { update({ cursor: null }, "replace"); register.reload(); };
  const sortRegister = (key: string, current: string) => update({ sort: key, direction: nextRegisterSortDirection(filters.sort, current, key, filters.direction), cursor: null });
  const clearFilters = () => update({ status: null, issuer: null, portfolio: null, cursor: null });
  const selectDataset = (next: Dataset) => update({ dataset: next, cursor: null, selected: null, status: null });
  const panels = buildICBookPanels({ dataset, register, error, filters, selectedId, selectedAgenda, selectedDecision, filtered: icBookEmpty, issuerLabel, ownerLabel, opinions, busy, canReview: canReviewEvidenceException(user), agendaActions, decisionActions, form, setForm, issuers, portfolios, runs, formErrors: [catalogError, runsError], create, sortRegister, clearFilters, select: (selected) => update({ selected }), next: (cursor) => update({ cursor }) });

  return (
    <ICBookPage
      dataset={dataset} total={register.total} roleView={roleView} brief={personaBrief} status={filters.status} error={error} decision={icDecision}
      onAdd={openAgendaCreateForm} onDataset={selectDataset} onStatus={(status) => update({ status, cursor: null })} onRefresh={refresh}
      primary={panels.primary} inspector={panels.inspector} utility={panels.utility} finalization={panels.finalization}
    />
  );
}
