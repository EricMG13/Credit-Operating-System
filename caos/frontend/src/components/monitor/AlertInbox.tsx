"use client";

import { useEffect, useRef, useState } from "react";
import { ActionReason } from "@/components/shared/ActionReason";
import { BatchBar } from "@/components/shared/BatchBar";
import { ConclusionAuthority } from "@/components/shared/ConclusionAuthority";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { SourceRef } from "@/components/ui/SourceRef";
import { getChunk, getDecisions, reopenDecision, toErrorMessage, type AlertEventDTO, type IcDecision } from "@/lib/api";
import type { ChunkDTO } from "@/lib/query/types";
import {
  alertIssuerLabel,
  explicitAlertChunkIds,
  type MonitorAlertFilter,
  type PersistedMonitorController,
} from "./usePersistedMonitorController";

const FILTERS: Array<{ value: MonitorAlertFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "ack", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
];

function stateLabel(state: AlertEventDTO["state"]): string {
  if (state === "ack") return "Acknowledged";
  if (state === "resolved") return "Resolved";
  return "Open";
}

function AlertSource({ event }: { event: AlertEventDTO }) {
  const chunkId = explicitAlertChunkIds(event)[0] ?? null;
  const [chunk, setChunk] = useState<ChunkDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!chunkId) {
    return <SourceRef source={{ state: "unavailable", reason: "No explicit persisted chunk id accompanies this alert event." }} />;
  }
  const open = async () => {
    if (loading || chunk) return;
    setLoading(true);
    setError(null);
    try {
      setChunk(await getChunk(chunkId));
    } catch (reason) {
      setError(toErrorMessage(reason, "The persisted source chunk could not be loaded"));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="mt-1 grid gap-1">
      <SourceRef className="inline-flex min-h-8 items-center caos-target" source={{ state: "ready", id: chunkId, onOpen: () => void open() }}>Open persisted source</SourceRef>
      {loading ? <span role="status" className="text-caos-2xs text-caos-muted">Loading source…</span> : null}
      {error ? <span role="alert" className="text-caos-2xs text-caos-warning">Source unavailable · {error}</span> : null}
      {chunk ? <details className="text-caos-2xs text-caos-muted"><summary className="inline-flex min-h-8 cursor-pointer items-center focus-ring rounded caos-target">{chunk.doc} · source extract</summary><p className="mt-1 whitespace-pre-wrap leading-snug text-caos-text">{chunk.text}</p></details> : null}
    </div>
  );
}

function AlertStateMark({ state }: { state: AlertEventDTO["state"] }) {
  const glyph = state === "resolved" ? "✓" : state === "ack" ? "◐" : "○";
  const color = state === "resolved" || state === "ack" ? "var(--caos-success)" : "var(--caos-muted)";
  return <span className="tabular text-caos-2xs uppercase tracking-wider ml-auto" style={{ color }}><span aria-hidden="true">{glyph} </span>{stateLabel(state)}</span>;
}

function ReopenDecision({ event }: { event: AlertEventDTO }) {
  const material = /covenant|rating/i.test([event.kind, event.title, event.impact].join(" "));
  const [decision, setDecision] = useState<IcDecision | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!material || !event.issuer_id) return;
    let alive = true;
    void getDecisions(event.issuer_id).then((rows) => {
      if (alive) setDecision(rows.find((item) => item.status === "active") ?? null);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [event.issuer_id, material]);

  if (!decision || decision.status === "reopened") return null;
  const reopen = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      setDecision(await reopenDecision(decision.id, event.alert_key));
    } catch (reason) {
      setError(toErrorMessage(reason, "IC decision was not reopened"));
    } finally {
      pendingRef.current = false;
      setBusy(false);
    }
  };
  return <><ActionReason reason={busy ? "Reopening…" : null} onClick={() => void reopen()} className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-warning text-caos-warning transition-caos focus-ring caos-target">{busy ? "Reopening…" : error ? "Retry reopen" : "Reopen IC"}</ActionReason>{error ? <span role="alert" className="text-caos-2xs text-caos-critical">{error}</span> : null}</>;
}

function AlertRowHeader({ event, controller }: { event: AlertEventDTO; controller: PersistedMonitorController }) {
  const issuer = alertIssuerLabel(event);
  const selected = controller.selectedIds.includes(event.id);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="checkbox"
        name={`select-alert-${event.id}`}
        autoComplete="off"
        checked={selected}
        onChange={() => controller.toggleSelected(event.id)}
        disabled={event.state === "resolved"}
        aria-label={`Select ${event.title}`}
        className="min-h-8 min-w-8 caos-target disabled:opacity-40"
      />
      <ConclusionAuthority prov={{ origin: "LIVE", method: "DERIVED", detail: "Persisted alert event." }} approval={null} />
      <span className="tabular text-caos-2xs uppercase tracking-wider rounded border border-caos-border px-1.5 py-px text-caos-muted">{event.kind}</span>
      {event.issuer_id ? (
        <IssuerLink issuer={{ id: event.issuer_id }} title={`Open issuer ${event.issuer_id} profile`} className="inline-flex min-h-8 items-center tabular text-caos-sm text-caos-accent hover:text-caos-text transition-caos focus-ring rounded px-0.5 outline-none caos-target">{issuer}</IssuerLink>
      ) : <span className="tabular text-caos-sm text-caos-muted">{issuer}</span>}
      <AlertStateMark state={event.state} />
    </div>
  );
}

type AlertActionOptions = { assignee?: string; note?: string; resolutionNote?: string };

function focusStableAlertTarget(eventId: string) {
  window.setTimeout(() => {
    const root = document.querySelector<HTMLElement>('[data-testid="monitor-persisted-ready"]');
    if (!root) return;
    const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-alert-event-id]"));
    const target = rows.find((row) => row.dataset.alertEventId === eventId)
      ?? rows[0]
      ?? root.querySelector<HTMLElement>('[aria-label="Show all alerts"]');
    target?.focus();
  }, 0);
}

function AlertRowActions({ event, controller }: { event: AlertEventDTO; controller: PersistedMonitorController }) {
  const [assignee, setAssignee] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const retryRef = useRef<null | { state: AlertEventDTO["state"]; options?: AlertActionOptions; success?: () => void }>(null);
  const pending = controller.pendingIds.has(event.id);

  const run = async (state: AlertEventDTO["state"], options?: AlertActionOptions, success?: () => void) => {
    if (pending) return;
    retryRef.current = { state, options, success };
    setError(null);
    try {
      await controller.mutateEvent(event.id, state, options);
      retryRef.current = null;
      if (state === "resolved" || (controller.filter !== "all" && state !== controller.filter)) {
        focusStableAlertTarget(event.id);
      }
      success?.();
    } catch (reason) {
      setError(toErrorMessage(reason, "Alert workflow update failed"));
    }
  };
  const retry = () => {
    const action = retryRef.current;
    if (action) void run(action.state, action.options, action.success);
  };

  return (
    <div className="mt-2 grid gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="tabular text-caos-xs text-caos-muted">{event.assignee || "unassigned"}</span>
        <input name="alert-assignee" autoComplete="off" aria-label="Alert assignee" value={assignee} onChange={(change) => setAssignee(change.target.value)} placeholder="Assign to…" className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border bg-transparent text-caos-text w-28 focus-ring caos-target" />
        <ActionReason reason={!assignee.trim() ? "Enter a name to assign" : pending ? "Update in progress…" : null} onClick={() => void run(event.state, { assignee: assignee.trim() }, () => setAssignee(""))} className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos focus-ring caos-target">Assign</ActionReason>
        <ActionReason reason={event.state === "ack" ? "Already acknowledged" : pending ? "Update in progress…" : null} onClick={() => void run("ack")} className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos focus-ring caos-target">Ack</ActionReason>
        {!resolving ? <button type="button" onClick={() => setResolving(true)} className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos focus-ring caos-target">Resolve</button> : null}
        <ReopenDecision event={event} />
      </div>
      {resolving ? (
        <div className="flex items-center gap-2 flex-wrap">
          <input name="alert-resolution-note" autoComplete="off" aria-label="Alert resolution note" value={resolutionNote} onChange={(change) => setResolutionNote(change.target.value)} placeholder="Resolution note (optional)…" autoFocus className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border bg-transparent text-caos-text w-44 focus-ring caos-target" />
          <ActionReason reason={pending ? "Update in progress…" : null} onClick={() => void run("resolved", { resolutionNote: resolutionNote || undefined }, () => { setResolving(false); setResolutionNote(""); })} className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-accent text-caos-accent transition-caos focus-ring caos-target">Confirm resolve</ActionReason>
          <button type="button" onClick={() => { setResolving(false); setResolutionNote(""); }} className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted transition-caos focus-ring caos-target">Cancel</button>
        </div>
      ) : null}
      {error ? <div role="alert" className="flex items-center gap-2 text-caos-2xs text-caos-critical"><span>{error}. Input was preserved.</span><button type="button" onClick={retry} className="min-h-8 px-2 rounded border border-caos-border focus-ring caos-target">Retry</button></div> : null}
    </div>
  );
}

function AlertRow({ event, controller }: { event: AlertEventDTO; controller: PersistedMonitorController }) {
  return (
    <article tabIndex={-1} aria-label={`Persisted alert ${event.title}`} className="px-3 py-2 border-b border-caos-border/50 focus-ring" data-alert-event-id={event.id}>
      <AlertRowHeader event={event} controller={controller} />
      <h3 className="text-caos-md text-caos-text leading-snug mt-1">{event.title}</h3>
      <p className="text-caos-xs text-caos-muted leading-snug mt-0.5">{event.impact || "No persisted impact copy."}</p>
      <AlertSource event={event} />
      {event.state === "resolved" && event.resolution_note ? <p className="text-caos-xs text-caos-muted mt-1 italic">resolved: {event.resolution_note}</p> : null}
      {event.state !== "resolved" ? <AlertRowActions event={event} controller={controller} /> : null}
    </article>
  );
}

function AlertFilters({ controller }: { controller: PersistedMonitorController }) {
  const total = controller.events.length;
  return (
    <div className="flex items-center gap-1 border-b border-caos-border px-2 py-1.5 flex-wrap">
      <span className="mr-2 tabular text-caos-xs text-caos-muted">{total} persisted alert{total === 1 ? "" : "s"}</span>
      {FILTERS.map(({ value, label }) => {
        const count = value === "all" ? total : controller.counts[value];
        return <button key={value} type="button" aria-pressed={controller.filter === value} aria-label={`Show ${label.toLowerCase()} alerts`} onClick={() => controller.setFilter(value)} className="min-h-8 rounded border border-caos-border px-2 tabular text-caos-xs text-caos-muted aria-pressed:border-caos-accent aria-pressed:text-caos-accent transition-caos focus-ring caos-target">{label} {count}</button>;
      })}
    </div>
  );
}

function AlertInboxReady({ controller }: { controller: PersistedMonitorController }) {
  return (
    <div data-testid="monitor-persisted-ready">
      <p role="status" aria-live="polite" className="sr-only">{controller.lastMutationMessage}</p>
      <AlertFilters controller={controller} />
      {controller.batchError ? <div role="alert" className="flex items-center gap-2 border-b border-caos-border px-3 py-2 text-caos-xs text-caos-critical"><span>{controller.batchError}</span><button type="button" onClick={() => void controller.acknowledgeSelected().catch(() => undefined)} className="min-h-8 px-2 rounded border border-caos-border focus-ring caos-target">Retry acknowledgment</button></div> : null}
      <BatchBar selected={controller.selectedIds} onClear={controller.clearSelection} itemLabel="alert" actions={[{ id: "ack", label: "Ack", run: async (id) => { await controller.mutateEvent(id, "ack"); } }]} />
      {controller.visibleEvents.length ? controller.visibleEvents.map((event) => <AlertRow key={event.id} event={event} controller={controller} />) : (
        <SurfaceState kind="empty" title={controller.events.length ? `No ${controller.filter} alerts` : "No persisted alerts observed"} detail="The persisted alert-event read completed; Reference fixtures remain separate." compact className="m-2" />
      )}
    </div>
  );
}

export function AlertInbox({ controller }: { controller: PersistedMonitorController }) {
  if (controller.status === "loading") return <SurfaceState kind="loading" title="Loading persisted alert events" compact className="m-2" />;
  if (controller.status === "error") return <SurfaceState kind="unavailable" title="Persisted alert events unavailable" detail={controller.error ?? undefined} primaryAction={<button type="button" onClick={() => void controller.refresh()} className="min-h-8 rounded border border-caos-border px-2 text-caos-xs text-caos-muted focus-ring caos-target">Retry persisted alerts</button>} compact className="m-2" />;
  return <AlertInboxReady controller={controller} />;
}
