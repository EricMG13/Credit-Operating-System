"use client";

import { useEffect, useRef, useState } from "react";
import { ActionReason } from "@/components/shared/ActionReason";
import { ConclusionAuthority } from "@/components/shared/ConclusionAuthority";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { toErrorMessage, type AlertEventDTO } from "@/lib/api";
import { AlertEvidence } from "./AlertEvidence";
import {
  alertIssuerLabel,
  isAlertAuthorityInvalidation,
  isAlertLifecycleConflict,
  type MonitorAlertFilter,
  type PersistedMonitorController,
} from "./usePersistedMonitorController";

const TOUCH = "min-h-11 min-w-11";

function currentEvent(controller: PersistedMonitorController): AlertEventDTO | null {
  const active = controller.activeEventId
    ? controller.visibleEvents.find((event) => event.id === controller.activeEventId)
    : null;
  return active ?? controller.visibleEvents[0] ?? null;
}

function issuerHref(event: AlertEventDTO): string {
  return event.issuer_id ? `/deepdive?issuer=${encodeURIComponent(event.issuer_id)}` : "/deepdive";
}

function phoneStateLabel(state: AlertEventDTO["state"]): string {
  if (state === "resolved") return "Resolved";
  if (state === "ack") return "Acknowledged";
  return "Open";
}

function TriageNavigation({ controller, current }: { controller: PersistedMonitorController; current: AlertEventDTO }) {
  const index = controller.visibleEvents.findIndex((event) => event.id === current.id);
  const navigationBlocked = controller.workflowSurfaceLocked;
  const pendingReason = navigationBlocked ? "An alert workflow update is in progress" : null;
  const go = (next: number) => controller.setActiveEvent(controller.visibleEvents[next]?.id ?? current.id);
  return (
    <div className="grid min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
      <span className="tabular text-caos-xs text-caos-muted">{index + 1} of {controller.visibleEvents.length}</span>
      <select aria-label="Alert state filter" value={controller.filter} disabled={navigationBlocked} onChange={(event) => controller.setFilter(event.target.value as MonitorAlertFilter)} className={`${TOUCH} w-full min-w-0 max-w-full rounded border border-caos-border bg-caos-panel px-2 tabular text-caos-sm text-caos-text focus-ring disabled:opacity-50`}>
        <option value="all">All ({controller.events.length})</option>
        <option value="open">Open ({controller.counts.open})</option>
        <option value="ack">Acknowledged ({controller.counts.ack})</option>
        <option value="resolved">Resolved ({controller.counts.resolved})</option>
      </select>
      <div className="flex items-center gap-2">
        <ActionReason type="button" reasonDisplay="hidden" reason={pendingReason ?? (index <= 0 ? "Already at the first alert" : null)} onClick={() => go(index - 1)} aria-label="Previous alert" className={`${TOUCH} flex items-center justify-center rounded border border-caos-border text-caos-muted focus-ring caos-target`}>‹</ActionReason>
        <ActionReason type="button" reasonDisplay="hidden" reason={pendingReason ?? (index >= controller.visibleEvents.length - 1 ? "Already at the last alert" : null)} onClick={() => go(index + 1)} aria-label="Next alert" className={`${TOUCH} flex items-center justify-center rounded border border-caos-border text-caos-muted focus-ring caos-target`}>›</ActionReason>
      </div>
    </div>
  );
}

function TriageAlertCard({ event }: { event: AlertEventDTO }) {
  const issuer = alertIssuerLabel(event);
  const settled = event.state !== "open";
  return (
    <article tabIndex={-1} aria-label={`Persisted alert ${event.title}`} className="min-w-0 max-w-full rounded border border-caos-border bg-caos-panel p-3 flex flex-col gap-2.5 focus-ring" data-alert-event-id={event.id}>
      <div className="flex items-center gap-2 flex-wrap">
        <ConclusionAuthority prov={{ origin: "LIVE", method: "DERIVED", detail: "Persisted alert event." }} approval={null} />
        <span className="tabular text-caos-2xs uppercase tracking-wider rounded border border-caos-border px-1.5 py-px text-caos-muted">{event.kind}</span>
        <span className="tabular text-caos-2xs uppercase tracking-wider ml-auto" style={{ color: settled ? "var(--caos-success)" : "var(--caos-muted)" }}><span aria-hidden="true">{event.state === "resolved" ? "✓" : event.state === "ack" ? "◐" : "○"} </span>{phoneStateLabel(event.state)}</span>
      </div>
      {event.issuer_id ? <IssuerLink issuer={{ id: event.issuer_id }} title={`Open issuer ${event.issuer_id} profile`} className={`${TOUCH} inline-flex max-w-full items-center tabular text-caos-lg text-caos-accent transition-caos focus-ring rounded px-0.5 outline-none [overflow-wrap:anywhere]`}>{issuer}</IssuerLink> : <span className="tabular text-caos-lg text-caos-muted">{issuer}</span>}
      <h3 className="text-caos-md text-caos-text leading-snug">{event.title}</h3>
      <p className="text-caos-sm text-caos-muted leading-snug">{event.impact || "No persisted impact copy."}</p>
      <AlertEvidence event={event} phone />
      {event.state === "resolved" && event.resolution_note ? <p className="text-caos-sm text-caos-muted leading-snug italic">resolved: {event.resolution_note}</p> : null}
    </article>
  );
}

function TriageActions({ controller, event }: { controller: PersistedMonitorController; event: AlertEventDTO }) {
  const [assignee, setAssignee] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const retryRef = useRef<{ intent: "assign" | "ack" | "resolve"; success?: () => void } | null>(null);
  const actionPendingRef = useRef(false);
  const [observedRefreshEpoch, setObservedRefreshEpoch] = useState(controller.authoritativeRefreshEpoch);
  const refreshCustodyStale = observedRefreshEpoch !== controller.authoritativeRefreshEpoch;
  const pending = controller.pendingIds.has(event.id);
  const busyReason = !controller.canMutate
    ? "Alert workflow is read only for this caller"
    : refreshCustodyStale
    ? "Applying refreshed persisted alert state"
    : reconciling
    ? "Reloading persisted alert state"
    : controller.requiresAuthoritativeReload
      ? "Reload persisted alert state before another action"
      : controller.batchPending
        ? "Batch acknowledgment is in progress"
        : controller.workflowSurfaceLocked
          ? "Review or dismiss the current workflow failure"
          : actionPending || pending ? "Update in progress" : null;
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

  const focusStableTarget = () => {
    window.setTimeout(() => {
      const root = document.querySelector<HTMLElement>('[data-testid="monitor-persisted-ready"]');
      root?.querySelector<HTMLElement>("[data-alert-event-id]")?.focus();
    }, 0);
  };

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

  const perform = async (intent: "assign" | "ack" | "resolve", success?: () => void) => {
    if (refreshCustodyStale || actionPendingRef.current || pending || reconciling || controller.requiresAuthoritativeReload) return;
    actionPendingRef.current = true;
    setActionPending(true);
    retryRef.current = { intent, success };
    setError(null);
    setConflict(false);
    try {
      if (intent === "assign") await controller.mutateEvent(event.id, event.state, { assignee: assignee.trim() });
      else if (intent === "resolve") await controller.mutateEvent(event.id, "resolved", { resolutionNote: resolutionNote || undefined });
      else await controller.mutateEvent(event.id, "ack");
      retryRef.current = null;
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
    if (action) void perform(action.intent, action.success);
  };
  const retryReason = retryRef.current?.intent === "assign" && !assignee.trim()
    ? "Enter an assignee name to retry"
    : null;
  const retryCopy = retryRef.current
    ? retryRef.current.intent === "ack"
      ? " Input was preserved. The workflow transition is available to retry."
      : " Input was preserved. Retry submits the current draft."
    : " Input was preserved.";
  const dismissFailure = () => {
    retryRef.current = null;
    setError(null);
    setConflict(false);
    controller.releaseWorkflowSurface(event.id);
  };
  if (event.state === "resolved") return null;
  return (
    <div className="grid min-w-0 max-w-full gap-2">
      <div className="flex min-w-0 max-w-full items-center gap-2">
        <span className="tabular text-caos-xs text-caos-muted shrink-0">{event.assignee || "unassigned"}</span>
        <input name="phone-alert-assignee" autoComplete="off" aria-label="Alert assignee" value={assignee} disabled={inputsLocked} onChange={(change) => setAssignee(change.target.value)} placeholder="Assign to…" className={`${TOUCH} min-w-0 flex-1 tabular text-caos-md px-2 rounded border border-caos-border bg-transparent text-caos-text focus-ring caos-target disabled:opacity-50`} />
        <ActionReason type="button" reasonDisplay="hidden" reason={!assignee.trim() ? "Enter an assignee name first" : busyReason} onClick={() => void perform("assign", () => setAssignee(""))} className={`${TOUCH} px-3 rounded border border-caos-border text-caos-muted transition-caos focus-ring caos-target`}>Assign</ActionReason>
      </div>
      <div className="flex items-center gap-2">
        <ActionReason type="button" reasonDisplay="hidden" reason={event.state === "ack" ? "Already acknowledged" : busyReason} onClick={() => void perform("ack", controller.filter !== "all" && controller.filter !== "ack" ? focusStableTarget : undefined)} className={`${TOUCH} flex-1 tabular text-caos-md rounded border border-caos-border text-caos-muted transition-caos focus-ring caos-target`}>Ack</ActionReason>
        <ActionReason type="button" reasonDisplay="hidden" reason={busyReason} onClick={() => setResolving(true)} className={`${TOUCH} flex-1 tabular text-caos-md rounded border border-caos-border text-caos-muted transition-caos focus-ring caos-target`}>Resolve</ActionReason>
      </div>
      {resolving ? <div className="flex min-w-0 max-w-full items-center gap-2"><input name="phone-alert-resolution-note" autoComplete="off" aria-label="Alert resolution note" value={resolutionNote} disabled={inputsLocked} onChange={(change) => setResolutionNote(change.target.value)} placeholder="Resolution note (optional)…" autoFocus className={`${TOUCH} min-w-0 flex-1 tabular text-caos-md px-2 rounded border border-caos-border bg-transparent text-caos-text focus-ring caos-target disabled:opacity-50`} /><ActionReason type="button" reasonDisplay="hidden" reason={busyReason} onClick={() => void perform("resolve", () => { setResolving(false); setResolutionNote(""); focusStableTarget(); })} className={`${TOUCH} px-3 rounded border border-caos-accent text-caos-accent transition-caos focus-ring caos-target`}>Confirm</ActionReason></div> : null}
      {error && !refreshCustodyStale ? <div role="alert" className="flex items-center gap-2 rounded border border-caos-critical/50 px-2 py-2 text-caos-xs text-caos-critical"><span className="flex-1">{error}.{retryCopy}</span>{!conflict && !controller.requiresAuthoritativeReload && retryRef.current ? <><ActionReason type="button" reasonDisplay="hidden" reason={retryReason} className={`${TOUCH} px-2 rounded border border-caos-border focus-ring`} onClick={retry}>Retry</ActionReason><button type="button" onClick={dismissFailure} className={`${TOUCH} px-2 rounded border border-caos-border focus-ring`}>Dismiss</button></> : null}</div> : null}
    </div>
  );
}

function PhoneReloadAuthority({ controller }: { controller: PersistedMonitorController }) {
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
    <div role="alert" className="grid gap-2 rounded border border-caos-critical/50 px-2 py-2 text-caos-xs text-caos-critical">
      <span>Persisted alert authority changed. Reload persisted events before any further workflow action.</span>
      <ActionReason type="button" reasonDisplay="hidden" reason={reloading ? "Reloading persisted alerts" : null} onClick={() => void reload()} className={`${TOUCH} px-3 rounded border border-caos-critical text-caos-critical transition-caos focus-ring caos-target`}>Reload persisted alerts</ActionReason>
    </div>
  );
}

function PhoneTriageReady({ controller }: { controller: PersistedMonitorController }) {
  const current = currentEvent(controller);
  const batchFailure = controller.batchError ? <div role="alert" className="flex items-center gap-2 rounded border border-caos-critical/50 px-2 py-2 text-caos-xs text-caos-critical"><span className="flex-1">{controller.batchError}</span>{controller.batchErrorAction === "retry" && !controller.requiresAuthoritativeReload ? <button type="button" onClick={() => void controller.acknowledgeSelected().catch(() => undefined)} className={`${TOUCH} px-2 rounded border border-caos-border focus-ring`}>Retry acknowledgment</button> : null}{controller.batchErrorAction !== "reload" ? <button type="button" onClick={controller.dismissBatchError} className={`${TOUCH} px-2 rounded border border-caos-border focus-ring`}>Review selection</button> : null}</div> : null;
  if (!current) return <div data-testid="monitor-persisted-ready" className="grid gap-2"><PhoneReloadAuthority controller={controller} />{batchFailure}<SurfaceState kind="empty" title={`No ${controller.filter === "all" ? "persisted" : controller.filter} alerts to triage`} detail="The persisted read completed; Reference fixtures remain separate." compact className="m-2" /></div>;
  return <div data-testid="monitor-persisted-ready" className="flex-1 min-h-0 w-full min-w-0 max-w-full flex flex-col gap-3 overflow-y-auto p-3"><p role="status" aria-live="polite" className="sr-only">{controller.error ?? controller.lastMutationMessage}</p><PhoneReloadAuthority controller={controller} />{batchFailure}<TriageNavigation controller={controller} current={current} /><TriageAlertCard key={`card-${current.id}`} event={current} /><TriageActions key={`actions-${current.id}`} controller={controller} event={current} /><a href={issuerHref(current)} className={`${TOUCH} flex max-w-full items-center justify-center gap-1.5 rounded border border-caos-border px-2 text-center text-caos-muted transition-caos focus-ring caos-target tabular text-caos-sm [overflow-wrap:anywhere]`}>Continue on desktop — open {alertIssuerLabel(current)} in Deep-Dive →</a></div>;
}

export function PhoneTriage({ controller }: { controller: PersistedMonitorController }) {
  if (controller.status === "loading") return <SurfaceState kind="loading" title="Loading persisted alert triage" compact className="m-2" />;
  if (controller.status === "error") return <SurfaceState kind="unavailable" title="Persisted alert events unavailable" detail={controller.error ?? undefined} primaryAction={<button type="button" onClick={() => void controller.refresh()} className={`${TOUCH} rounded border border-caos-border px-2 text-caos-sm text-caos-muted focus-ring caos-target`}>Retry persisted alerts</button>} compact className="m-2" />;
  return <PhoneTriageReady controller={controller} />;
}
