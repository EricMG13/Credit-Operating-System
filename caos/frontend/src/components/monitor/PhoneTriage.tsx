"use client";

import { useRef, useState } from "react";
import { ActionReason } from "@/components/shared/ActionReason";
import { ConclusionAuthority } from "@/components/shared/ConclusionAuthority";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { SourceRef } from "@/components/ui/SourceRef";
import { getChunk, toErrorMessage, type AlertEventDTO } from "@/lib/api";
import {
  alertIssuerLabel,
  explicitAlertChunkIds,
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

function PhoneEvidence({ event }: { event: AlertEventDTO }) {
  const chunkId = explicitAlertChunkIds(event)[0] ?? null;
  const [extract, setExtract] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!chunkId) return <SourceRef source={{ state: "unavailable", reason: "No explicit persisted chunk id accompanies this alert event." }} />;
  const open = async () => {
    if (extract) return;
    setError(null);
    try {
      setExtract((await getChunk(chunkId)).text);
    } catch (reason) {
      setError(toErrorMessage(reason, "The persisted source chunk could not be loaded"));
    }
  };
  return <div className="grid gap-1"><SourceRef className="inline-flex min-h-11 min-w-11 items-center caos-target" source={{ state: "ready", id: chunkId, onOpen: () => void open() }}>Open persisted source</SourceRef>{error ? <span role="alert" className="text-caos-xs text-caos-warning">{error}</span> : null}{extract ? <p className="text-caos-xs text-caos-muted whitespace-pre-wrap">{extract}</p> : null}</div>;
}

function TriageNavigation({ controller, current }: { controller: PersistedMonitorController; current: AlertEventDTO }) {
  const index = controller.visibleEvents.findIndex((event) => event.id === current.id);
  const go = (next: number) => controller.setActiveEvent(controller.visibleEvents[next]?.id ?? current.id);
  return (
    <div className="grid min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
      <span className="tabular text-caos-xs text-caos-muted">{index + 1} of {controller.visibleEvents.length}</span>
      <select aria-label="Alert state filter" value={controller.filter} onChange={(event) => controller.setFilter(event.target.value as MonitorAlertFilter)} className={`${TOUCH} w-full min-w-0 max-w-full rounded border border-caos-border bg-caos-panel px-2 tabular text-caos-sm text-caos-text focus-ring`}>
        <option value="all">All ({controller.events.length})</option>
        <option value="open">Open ({controller.counts.open})</option>
        <option value="ack">Acknowledged ({controller.counts.ack})</option>
        <option value="resolved">Resolved ({controller.counts.resolved})</option>
      </select>
      <div className="flex items-center gap-2">
        <ActionReason type="button" reasonDisplay="hidden" reason={index <= 0 ? "Already at the first alert" : null} onClick={() => go(index - 1)} aria-label="Previous alert" className={`${TOUCH} flex items-center justify-center rounded border border-caos-border text-caos-muted focus-ring caos-target`}>‹</ActionReason>
        <ActionReason type="button" reasonDisplay="hidden" reason={index >= controller.visibleEvents.length - 1 ? "Already at the last alert" : null} onClick={() => go(index + 1)} aria-label="Next alert" className={`${TOUCH} flex items-center justify-center rounded border border-caos-border text-caos-muted focus-ring caos-target`}>›</ActionReason>
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
      <PhoneEvidence event={event} />
      {event.state === "resolved" && event.resolution_note ? <p className="text-caos-sm text-caos-muted leading-snug italic">resolved: {event.resolution_note}</p> : null}
    </article>
  );
}

function TriageActions({ controller, event }: { controller: PersistedMonitorController; event: AlertEventDTO }) {
  const [assignee, setAssignee] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const retryRef = useRef<{ action: () => Promise<unknown>; success?: () => void } | null>(null);
  const pending = controller.pendingIds.has(event.id);

  const focusStableTarget = () => {
    window.setTimeout(() => {
      const root = document.querySelector<HTMLElement>('[data-testid="monitor-persisted-ready"]');
      root?.querySelector<HTMLElement>("[data-alert-event-id]")?.focus();
    }, 0);
  };

  const perform = async (action: () => Promise<unknown>, success?: () => void) => {
    if (pending) return;
    retryRef.current = { action, success };
    setError(null);
    try {
      await action();
      retryRef.current = null;
      success?.();
    } catch (reason) {
      setError(toErrorMessage(reason, "Alert workflow update failed"));
    }
  };
  if (event.state === "resolved") return null;
  return (
    <div className="grid min-w-0 max-w-full gap-2">
      <div className="flex min-w-0 max-w-full items-center gap-2">
        <span className="tabular text-caos-xs text-caos-muted shrink-0">{event.assignee || "unassigned"}</span>
        <input name="phone-alert-assignee" autoComplete="off" aria-label="Alert assignee" value={assignee} onChange={(change) => setAssignee(change.target.value)} placeholder="Assign to…" className={`${TOUCH} min-w-0 flex-1 tabular text-caos-md px-2 rounded border border-caos-border bg-transparent text-caos-text focus-ring caos-target`} />
        <ActionReason type="button" reasonDisplay="hidden" reason={!assignee.trim() ? "Enter an assignee name first" : pending ? "Update in progress" : null} onClick={() => void perform(() => controller.mutateEvent(event.id, event.state, { assignee: assignee.trim() }), () => setAssignee(""))} className={`${TOUCH} px-3 rounded border border-caos-border text-caos-muted transition-caos focus-ring caos-target`}>Assign</ActionReason>
      </div>
      <div className="flex items-center gap-2">
        <ActionReason type="button" reasonDisplay="hidden" reason={event.state === "ack" ? "Already acknowledged" : pending ? "Update in progress" : null} onClick={() => void perform(() => controller.mutateEvent(event.id, "ack"), controller.filter !== "all" && controller.filter !== "ack" ? focusStableTarget : undefined)} className={`${TOUCH} flex-1 tabular text-caos-md rounded border border-caos-border text-caos-muted transition-caos focus-ring caos-target`}>Ack</ActionReason>
        <button type="button" onClick={() => setResolving(true)} className={`${TOUCH} flex-1 tabular text-caos-md rounded border border-caos-border text-caos-muted transition-caos focus-ring caos-target`}>Resolve</button>
      </div>
      {resolving ? <div className="flex min-w-0 max-w-full items-center gap-2"><input name="phone-alert-resolution-note" autoComplete="off" aria-label="Alert resolution note" value={resolutionNote} onChange={(change) => setResolutionNote(change.target.value)} placeholder="Resolution note (optional)…" autoFocus className={`${TOUCH} min-w-0 flex-1 tabular text-caos-md px-2 rounded border border-caos-border bg-transparent text-caos-text focus-ring caos-target`} /><ActionReason type="button" reasonDisplay="hidden" reason={pending ? "Update in progress" : null} onClick={() => void perform(() => controller.mutateEvent(event.id, "resolved", { resolutionNote: resolutionNote || undefined }), () => { setResolving(false); setResolutionNote(""); focusStableTarget(); })} className={`${TOUCH} px-3 rounded border border-caos-accent text-caos-accent transition-caos focus-ring caos-target`}>Confirm</ActionReason></div> : null}
      {error ? <div role="alert" className="flex items-center gap-2 rounded border border-caos-critical/50 px-2 py-2 text-caos-xs text-caos-critical"><span className="flex-1">{error}. Input was preserved.</span><button type="button" className={`${TOUCH} px-2 rounded border border-caos-border focus-ring`} onClick={() => { const retry = retryRef.current; if (retry) void perform(retry.action, retry.success); }}>Retry</button></div> : null}
    </div>
  );
}

function PhoneTriageReady({ controller }: { controller: PersistedMonitorController }) {
  const current = currentEvent(controller);
  if (!current) return <div data-testid="monitor-persisted-ready"><SurfaceState kind="empty" title={`No ${controller.filter === "all" ? "persisted" : controller.filter} alerts to triage`} detail="The persisted read completed; Reference fixtures remain separate." compact className="m-2" /></div>;
  return <div data-testid="monitor-persisted-ready" className="flex-1 min-h-0 w-full min-w-0 max-w-full flex flex-col gap-3 overflow-y-auto p-3"><p role="status" aria-live="polite" className="sr-only">{controller.lastMutationMessage}</p><TriageNavigation controller={controller} current={current} /><TriageAlertCard key={`card-${current.id}`} event={current} /><TriageActions key={`actions-${current.id}`} controller={controller} event={current} /><a href={issuerHref(current)} className={`${TOUCH} flex max-w-full items-center justify-center gap-1.5 rounded border border-caos-border px-2 text-center text-caos-muted transition-caos focus-ring caos-target tabular text-caos-sm [overflow-wrap:anywhere]`}>Continue on desktop — open {alertIssuerLabel(current)} in Deep-Dive →</a></div>;
}

export function PhoneTriage({ controller }: { controller: PersistedMonitorController }) {
  if (controller.status === "loading") return <SurfaceState kind="loading" title="Loading persisted alert triage" compact className="m-2" />;
  if (controller.status === "error") return <SurfaceState kind="unavailable" title="Persisted alert events unavailable" detail={controller.error ?? undefined} primaryAction={<button type="button" onClick={() => void controller.refresh()} className={`${TOUCH} rounded border border-caos-border px-2 text-caos-sm text-caos-muted focus-ring caos-target`}>Retry persisted alerts</button>} compact className="m-2" />;
  return <PhoneTriageReady controller={controller} />;
}
