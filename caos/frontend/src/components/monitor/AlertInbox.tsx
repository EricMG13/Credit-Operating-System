"use client";

import { useEffect, useRef, useState } from "react";
import { ActionReason } from "@/components/shared/ActionReason";
import { ConclusionAuthority } from "@/components/shared/ConclusionAuthority";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { getDecisions, reopenDecision, toErrorMessage, type AlertEventDTO, type IcDecision } from "@/lib/api";
import { AlertEvidence } from "./AlertEvidence";
import {
  alertIssuerLabel,
  isAlertAuthorityInvalidation,
  isAlertLifecycleConflict,
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

function AlertStateMark({ state }: { state: AlertEventDTO["state"] }) {
  const glyph = state === "resolved" ? "✓" : state === "ack" ? "◐" : "○";
  const color = state === "resolved" || state === "ack" ? "var(--caos-success)" : "var(--caos-muted)";
  return <span className="tabular text-caos-2xs uppercase tracking-wider ml-auto" style={{ color }}><span aria-hidden="true">{glyph} </span>{stateLabel(state)}</span>;
}

function ReopenDecision({ event, blockedReason }: { event: AlertEventDTO; blockedReason?: string | null }) {
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
  return <><ActionReason reason={blockedReason || (busy ? "Reopening…" : null)} onClick={() => void reopen()} className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-warning text-caos-warning transition-caos focus-ring caos-target">{busy ? "Reopening…" : error ? "Retry reopen" : "Reopen IC"}</ActionReason>{error ? <span role="alert" className="text-caos-2xs text-caos-critical">{error}</span> : null}</>;
}

function AlertRowHeader({ event, controller }: { event: AlertEventDTO; controller: PersistedMonitorController }) {
  const issuer = alertIssuerLabel(event);
  const selected = controller.selectedIds.includes(event.id);
  const selectionBlocked = controller.workflowSurfaceLocked;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {controller.canMutate && event.state === "open" ? <input
        type="checkbox"
        name={`select-alert-${event.id}`}
        autoComplete="off"
        checked={selected}
        onChange={() => controller.toggleSelected(event.id)}
        disabled={selectionBlocked}
        aria-label={`Select ${event.title}`}
        className="min-h-8 min-w-8 caos-target disabled:opacity-40"
      /> : null}
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
type AlertRetryIntent = {
  kind: "assign" | "ack" | "resolve";
  success?: () => void;
};

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
  const [conflict, setConflict] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const retryRef = useRef<AlertRetryIntent | null>(null);
  const actionPendingRef = useRef(false);
  const [observedRefreshEpoch, setObservedRefreshEpoch] = useState(controller.authoritativeRefreshEpoch);
  const refreshCustodyStale = observedRefreshEpoch !== controller.authoritativeRefreshEpoch;
  const pending = controller.pendingIds.has(event.id);
  const busyReason = !controller.canMutate
    ? "Alert workflow is read only for this caller"
    : refreshCustodyStale
    ? "Applying refreshed persisted alert state…"
    : reconciling
    ? "Reloading persisted alert state…"
    : controller.requiresAuthoritativeReload
      ? "Reload persisted alert state before another action"
      : controller.batchPending
        ? "Batch acknowledgment is in progress…"
        : controller.workflowSurfaceLocked
          ? "Review or dismiss the current workflow failure"
          : actionPending || pending ? "Update in progress…" : null;
  const inputsLocked = !controller.canMutate || refreshCustodyStale || actionPending || pending || controller.batchPending || reconciling || controller.requiresAuthoritativeReload;

  useEffect(() => {
    if (controller.requiresAuthoritativeReload) retryRef.current = null;
  }, [controller.requiresAuthoritativeReload]);

  useEffect(() => {
    if (observedRefreshEpoch === controller.authoritativeRefreshEpoch) return;
    if (retryRef.current) {
      retryRef.current = null;
      setError(null);
      setConflict(false);
      setAssignee("");
      setResolving(false);
      setResolutionNote("");
    }
    setObservedRefreshEpoch(controller.authoritativeRefreshEpoch);
  }, [controller.authoritativeRefreshEpoch, observedRefreshEpoch]);

  useEffect(() => {
    if (!conflict || controller.requiresAuthoritativeReload) return;
    setConflict(false);
    setError("Alert state changed in another session. Persisted events were reloaded; review the latest state before choosing another action");
  }, [conflict, controller.requiresAuthoritativeReload]);

  const reconcilePersistedState = async () => {
    setConflict(true);
    setReconciling(true);
    setError("Alert state changed in another session. Reloading persisted events before another action");
    try {
      const reconciled = await controller.refresh({ preserveReadyView: true });
      setConflict(!reconciled);
      setError(reconciled
        ? "Alert state changed in another session. Persisted events were reloaded; review the latest state before choosing another action"
        : "Alert state changed in another session. An authoritative reload could not be confirmed; reload persisted alerts before choosing another action");
    } finally {
      setReconciling(false);
    }
  };

  const run = async (kind: AlertRetryIntent["kind"], state: AlertEventDTO["state"], options?: AlertActionOptions, success?: () => void) => {
    if (refreshCustodyStale || actionPendingRef.current || pending || reconciling || controller.requiresAuthoritativeReload) return;
    actionPendingRef.current = true;
    setActionPending(true);
    retryRef.current = { kind, success };
    setError(null);
    setConflict(false);
    try {
      await controller.mutateEvent(event.id, state, options);
      retryRef.current = null;
      if (state === "resolved" || (controller.filter !== "all" && state !== controller.filter)) {
        focusStableAlertTarget(event.id);
      }
      success?.();
    } catch (reason) {
      if (isAlertLifecycleConflict(reason)) {
        retryRef.current = null;
        await reconcilePersistedState();
      } else if (isAlertAuthorityInvalidation(reason)) {
        retryRef.current = null;
        setAssignee("");
        setResolving(false);
        setResolutionNote("");
        setError("Alert mutation authority changed. Persisted events are being reloaded; stale input cannot be retried.");
      } else {
        setError(toErrorMessage(reason, "Alert workflow update failed"));
      }
    } finally {
      actionPendingRef.current = false;
      setActionPending(false);
    }
  };
  const retry = () => {
    const action = retryRef.current;
    if (!action) return;
    if (action.kind === "assign") {
      void run("assign", event.state, { assignee: assignee.trim() }, action.success);
      return;
    }
    if (action.kind === "resolve") {
      void run("resolve", "resolved", { resolutionNote: resolutionNote || undefined }, action.success);
      return;
    }
    void run("ack", "ack", undefined, action.success);
  };
  const retryReason = retryRef.current?.kind === "assign" && !assignee.trim()
    ? "Enter a name to retry assignment"
    : null;
  const retryCopy = retryRef.current
    ? retryRef.current.kind === "ack"
      ? " Input was preserved. The workflow transition is available to retry."
      : " Input was preserved. Retry submits the current draft."
    : " Input was preserved.";
  const cancelResolution = () => {
    retryRef.current = null;
    setError(null);
    setConflict(false);
    setResolving(false);
    setResolutionNote("");
    controller.releaseWorkflowSurface(event.id);
  };
  const dismissFailure = () => {
    retryRef.current = null;
    setError(null);
    setConflict(false);
    controller.releaseWorkflowSurface(event.id);
  };

  return (
    <div className="mt-2 grid gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="tabular text-caos-xs text-caos-muted">{event.assignee || "unassigned"}</span>
        <input name="alert-assignee" autoComplete="off" aria-label="Alert assignee" value={assignee} disabled={inputsLocked} onChange={(change) => setAssignee(change.target.value)} placeholder="Assign to…" className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border bg-transparent text-caos-text w-28 focus-ring caos-target disabled:opacity-50" />
        <ActionReason reason={!assignee.trim() ? "Enter a name to assign" : busyReason} onClick={() => void run("assign", event.state, { assignee: assignee.trim() }, () => setAssignee(""))} className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos focus-ring caos-target">Assign</ActionReason>
        <ActionReason reason={event.state === "ack" ? "Already acknowledged" : busyReason} onClick={() => void run("ack", "ack")} className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos focus-ring caos-target">Ack</ActionReason>
        {!resolving ? <ActionReason reason={busyReason} onClick={() => setResolving(true)} className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos focus-ring caos-target">Resolve</ActionReason> : null}
        <ReopenDecision event={event} blockedReason={!controller.canMutate ? "Alert workflow is read only for this caller" : busyReason} />
      </div>
      {resolving ? (
        <div className="flex items-center gap-2 flex-wrap">
          <input name="alert-resolution-note" autoComplete="off" aria-label="Alert resolution note" value={resolutionNote} disabled={inputsLocked} onChange={(change) => setResolutionNote(change.target.value)} placeholder="Resolution note (optional)…" autoFocus className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border bg-transparent text-caos-text w-44 focus-ring caos-target disabled:opacity-50" />
          <ActionReason reason={busyReason} onClick={() => void run("resolve", "resolved", { resolutionNote: resolutionNote || undefined }, () => { setResolving(false); setResolutionNote(""); })} className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-accent text-caos-accent transition-caos focus-ring caos-target">Confirm resolve</ActionReason>
          <button type="button" disabled={inputsLocked} onClick={cancelResolution} className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted transition-caos focus-ring caos-target disabled:opacity-50">Cancel</button>
        </div>
      ) : null}
      {error && !refreshCustodyStale ? <div role="alert" className="flex items-center gap-2 text-caos-2xs text-caos-critical"><span>{error}.{retryCopy}</span>{!conflict && !controller.requiresAuthoritativeReload && retryRef.current ? <><ActionReason reason={retryReason} reasonDisplay="hidden" onClick={retry} className="min-h-8 px-2 rounded border border-caos-border focus-ring caos-target">Retry</ActionReason><button type="button" onClick={dismissFailure} className="min-h-8 px-2 rounded border border-caos-border focus-ring caos-target">Dismiss</button></> : null}</div> : null}
    </div>
  );
}

function AlertRow({ event, controller }: { event: AlertEventDTO; controller: PersistedMonitorController }) {
  return (
    <article tabIndex={-1} aria-label={`Persisted alert ${event.title}`} className="px-3 py-2 border-b border-caos-border/50 focus-ring" data-alert-event-id={event.id}>
      <AlertRowHeader event={event} controller={controller} />
      <h3 className="text-caos-md text-caos-text leading-snug mt-1">{event.title}</h3>
      <p className="text-caos-xs text-caos-muted leading-snug mt-0.5">{event.impact || "No persisted impact copy."}</p>
      <AlertEvidence event={event} />
      {event.state === "resolved" && event.resolution_note ? <p className="text-caos-xs text-caos-muted mt-1 italic">resolved: {event.resolution_note}</p> : null}
      {event.state !== "resolved" ? <AlertRowActions event={event} controller={controller} /> : null}
    </article>
  );
}

function AlertFilters({ controller }: { controller: PersistedMonitorController }) {
  const total = controller.events.length;
  const filterBlocked = controller.workflowSurfaceLocked;
  return (
    <div className="flex items-center gap-1 border-b border-caos-border px-2 py-1.5 flex-wrap">
      <span className="mr-2 tabular text-caos-xs text-caos-muted">{total} persisted alert{total === 1 ? "" : "s"}</span>
      {FILTERS.map(({ value, label }) => {
        const count = value === "all" ? total : controller.counts[value];
        return <ActionReason key={value} type="button" reasonDisplay="hidden" reason={filterBlocked ? "An alert workflow update is in progress" : null} aria-pressed={controller.filter === value} aria-label={`Show ${label.toLowerCase()} alerts`} onClick={() => controller.setFilter(value)} className="min-h-8 rounded border border-caos-border px-2 tabular text-caos-xs text-caos-muted aria-pressed:border-caos-accent aria-pressed:text-caos-accent transition-caos focus-ring caos-target">{label} {count}</ActionReason>;
      })}
    </div>
  );
}

function PersistedReloadAuthority({ controller }: { controller: PersistedMonitorController }) {
  const [reloading, setReloading] = useState(false);
  if (!controller.requiresAuthoritativeReload) return null;
  const reload = async () => {
    if (reloading) return;
    setReloading(true);
    try {
      await controller.refresh({ preserveReadyView: true });
    } finally {
      setReloading(false);
    }
  };
  return (
    <div role="alert" className="flex items-center gap-2 border-b border-caos-border px-3 py-2 text-caos-xs text-caos-critical">
      <span>Persisted alert authority changed. Reload persisted events before any further workflow action.</span>
      <ActionReason reason={reloading ? "Reloading persisted alerts…" : null} onClick={() => void reload()} className="min-h-8 px-2 rounded border border-caos-border focus-ring caos-target">Reload persisted alerts</ActionReason>
    </div>
  );
}

function PersistedAlertBatchBar({ controller }: { controller: PersistedMonitorController }) {
  const selectionCount = controller.selectedIds.length;
  const { batchPending, clearSelection } = controller;
  const batchReason = batchPending
    ? "Batch acknowledgment is in progress"
    : controller.pendingIds.size > 0
      ? "An individual alert workflow update is in progress"
      : controller.workflowSurfaceLocked && !controller.batchError
        ? "Review or dismiss the current alert workflow failure"
        : null;
  useEffect(() => {
    if (selectionCount === 0) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || batchPending) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      clearSelection();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [batchPending, clearSelection, selectionCount]);
  if (selectionCount === 0 || controller.requiresAuthoritativeReload) return null;
  return (
    <div role="toolbar" aria-label="Batch actions" className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-caos-accent/50 bg-caos-elevated tabular text-caos-xs">
      <span className="font-semibold text-caos-text whitespace-nowrap">
        {selectionCount} alert{selectionCount === 1 ? "" : "s"} selected
      </span>
      <ActionReason reason={batchReason} onClick={() => void controller.acknowledgeSelected().catch(() => undefined)} className="tabular text-caos-xs px-2 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring aria-disabled:opacity-50 caos-target">
        {controller.batchPending ? "Ack…" : "Ack"}
      </ActionReason>
      <ActionReason reason={controller.workflowSurfaceLocked ? "Resolve the current workflow operation before clearing selection" : null} reasonDisplay="hidden" actionTitle="Clear selection (Esc)" onClick={clearSelection} className="ml-auto tabular text-caos-xs text-caos-muted hover:text-caos-text px-1.5 min-h-8 rounded focus-ring caos-target">clear</ActionReason>
    </div>
  );
}

function AlertInboxReady({ controller }: { controller: PersistedMonitorController }) {
  return (
    <div data-testid="monitor-persisted-ready">
      <p role="status" aria-live="polite" className="sr-only">{controller.error ?? controller.lastMutationMessage}</p>
      <AlertFilters controller={controller} />
      <PersistedReloadAuthority controller={controller} />
      {controller.batchError ? <div role="alert" className="flex items-center gap-2 border-b border-caos-border px-3 py-2 text-caos-xs text-caos-critical"><span>{controller.batchError}</span>{controller.batchErrorAction === "retry" && !controller.requiresAuthoritativeReload ? <button type="button" onClick={() => void controller.acknowledgeSelected().catch(() => undefined)} className="min-h-8 px-2 rounded border border-caos-border focus-ring caos-target">Retry acknowledgment</button> : null}{controller.batchErrorAction !== "reload" ? <button type="button" onClick={controller.dismissBatchError} className="min-h-8 px-2 rounded border border-caos-border focus-ring caos-target">Review selection</button> : null}</div> : null}
      <PersistedAlertBatchBar controller={controller} />
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
