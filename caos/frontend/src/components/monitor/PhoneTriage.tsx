"use client";

// Phone triage (G6, design-rebuild WP-3) — the ONE alert-workflow surface
// phone is a first-class citizen for. Locked handoff decision #4: phone
// supports reading, alerts, evidence, acknowledgement, assignment, and
// desktop handoff — never deep modeling, graph authoring, or report editing.
// So this component does exactly four things and nothing else: show one
// alert at a time (event → impact → reason → required action), ack it,
// assign it, resolve it (with an optional note) — then hand off to Deep-Dive
// for anything that actually needs a desktop workflow.
//
// Deliberately sequential (one card, prev/next) rather than the dense list
// AlertInbox renders on tablet/desktop — a phone screen can't show ten rows
// at readable density, and a triage queue is exactly the shape phone reading
// is good at. Shares every data source and mutation (useAutonomyDraft,
// draftToAlertRows, alert_states) with AlertInbox/RankedChanges, so the same
// alert reads identically everywhere; only the layout is phone-specific.

import { useEffect, useRef, useState } from "react";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { ConclusionAuthority } from "@/components/shared/ConclusionAuthority";
import { ActionReason } from "@/components/shared/ActionReason";
import { useAutonomyDraft } from "@/lib/engine/useAutonomyDraft";
import { draftToAlertRows, formatImpact, requiredActionFor, rowProvenance, type AlertRow } from "@/lib/alerts/inbox";
import { getAlertStates, setAlertState, toErrorMessage, type AlertStateDTO } from "@/lib/api";

// Touch targets are 44px on phone (vs 32px desktop) — Sam's persona
// resolution. Every actionable control here uses this class.
const TOUCH = "min-h-11 min-w-11";
const STATE_RANK: Record<string, number> = { open: 0, ack: 1, resolved: 2 };

function issuerHref(row: AlertRow): string {
  const q = row.issuerId ?? row.issuerName;
  return `/deepdive?issuer=${encodeURIComponent(q)}`;
}

function orderAlertRows(rows: AlertRow[], states: Map<string, AlertStateDTO>) {
  return [...rows].sort((a, b) => (STATE_RANK[states.get(a.key)?.state ?? "open"] ?? 0) - (STATE_RANK[states.get(b.key)?.state ?? "open"] ?? 0));
}

function useAlertStateEnrichment(rows: AlertRow[], generatedAt: string | undefined) {
  const [states, setStates] = useState<Map<string, AlertStateDTO>>(new Map());
  useEffect(() => {
    if (rows.length === 0) return;
    let alive = true;
    getAlertStates()
      .then((list) => { if (alive) setStates(new Map(list.map((state) => [state.alert_key, state]))); })
      .catch(() => undefined);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedAt]);
  return { states, setStates };
}

function useAlertSelection(ordered: AlertRow[]) {
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const orderSignature = ordered.map((row) => row.key).join(",");
  useEffect(() => {
    if (ordered.length === 0) return;
    if (currentKey == null || !ordered.some((row) => row.key === currentKey)) setCurrentKey(ordered[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderSignature, currentKey]);
  const index = Math.max(0, ordered.findIndex((row) => row.key === currentKey));
  const current = ordered[index] ?? null;
  const goto = (nextIndex: number) => setCurrentKey(ordered[Math.max(0, Math.min(ordered.length - 1, nextIndex))]?.key ?? null);
  return { currentKey, current, index, goto };
}

function useAlertMutation(currentKey: string | null) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const retryRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    setError(null);
    retryRef.current = null;
  }, [currentKey]);
  const perform = async (action: () => Promise<void>) => {
    if (pendingRef.current) return;
    retryRef.current = action;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await action();
      retryRef.current = null;
    } catch (reason) {
      setError(toErrorMessage(reason, "Alert workflow update failed"));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  const retry = () => { if (retryRef.current) void perform(retryRef.current); };
  return { pending, error, perform, retry };
}

function usePhoneTriageModel() {
  const autonomy = useAutonomyDraft();
  const rows = autonomy.draft ? draftToAlertRows(autonomy.draft) : [];
  const alertStates = useAlertStateEnrichment(rows, autonomy.draft?.generated_at);
  const ordered = orderAlertRows(rows, alertStates.states);
  const selection = useAlertSelection(ordered);
  const [assigneeInput, setAssigneeInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const mutation = useAlertMutation(selection.currentKey);
  const state = selection.current ? alertStates.states.get(selection.current.key) : undefined;
  const applyState = (next: AlertStateDTO) => alertStates.setStates((current) => new Map(current).set(next.alert_key, next));
  const assign = () => {
    const current = selection.current;
    const assignee = assigneeInput.trim();
    if (!current || !assignee) return;
    void mutation.perform(async () => {
      applyState(await setAlertState(current.key, state?.state === "ack" ? "ack" : "open", { assignee }));
      setAssigneeInput("");
    });
  };
  const acknowledge = () => {
    const current = selection.current;
    if (!current) return;
    void mutation.perform(async () => applyState(await setAlertState(current.key, "ack")));
  };
  const resolve = () => {
    const current = selection.current;
    if (!current) return;
    const note = resolveNote;
    void mutation.perform(async () => {
      applyState(await setAlertState(current.key, "resolved", { resolutionNote: note || undefined }));
      setResolving(false);
      setResolveNote("");
    });
  };
  return { autonomy, ordered, selection, state, assigneeInput, setAssigneeInput, resolving, setResolving, resolveNote, setResolveNote, mutation, assign, acknowledge, resolve };
}

type PhoneTriageModel = ReturnType<typeof usePhoneTriageModel>;

function TriageNavigation({ model }: { model: PhoneTriageModel }) {
  const { index } = model.selection;
  return (
    <div className="flex items-center justify-between">
      <span className="tabular text-caos-xs text-caos-muted">{index + 1} of {model.ordered.length}</span>
      <div className="flex items-center gap-2">
        <ActionReason type="button" reason={index === 0 ? "Already at the first alert" : null} onClick={() => model.selection.goto(index - 1)} aria-label="Previous alert" className={`${TOUCH} flex items-center justify-center rounded border border-caos-border text-caos-muted hover:text-caos-text aria-disabled:opacity-40 focus-ring caos-target`}>‹</ActionReason>
        <ActionReason type="button" reason={index >= model.ordered.length - 1 ? "Already at the last alert" : null} onClick={() => model.selection.goto(index + 1)} aria-label="Next alert" className={`${TOUCH} flex items-center justify-center rounded border border-caos-border text-caos-muted hover:text-caos-text aria-disabled:opacity-40 focus-ring caos-target`}>›</ActionReason>
      </div>
    </div>
  );
}

function triageStatus(state: AlertStateDTO | undefined) {
  if (state?.state === "resolved") return "Resolved";
  if (state?.state === "ack") return "Ack/assigned";
  return "Open";
}

function TriageAlertCard({ model }: { model: PhoneTriageModel }) {
  const current = model.selection.current!;
  const impact = formatImpact(current);
  const settled = model.state?.state === "resolved" || model.state?.state === "ack";
  return (
    <div className="rounded border border-caos-border bg-caos-panel p-3 flex flex-col gap-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <ConclusionAuthority prov={rowProvenance(current)} />
        {impact ? <span className="tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border whitespace-nowrap" title="Anomaly severity — standard deviations from the baseline/peer median" style={{ color: "var(--caos-muted)", borderColor: "var(--caos-border)" }}>{impact}</span> : null}
        <span className="tabular text-caos-2xs uppercase tracking-wider ml-auto" style={{ color: settled ? "var(--caos-success)" : "var(--caos-muted)" }}>{triageStatus(model.state)}</span>
      </div>
      <IssuerLink query={current.issuerName} title={`Open ${current.issuerName} profile`} className={`${TOUCH} inline-flex items-center tabular text-caos-lg text-caos-accent hover:text-caos-text transition-caos focus-ring rounded px-0.5 outline-none`}>{current.issuerName}</IssuerLink>
      <div className="text-caos-md text-caos-text leading-snug">{current.event}</div>
      <div className="text-caos-sm text-caos-muted leading-snug">{current.reason}</div>
      <div className="text-caos-sm text-caos-muted leading-snug">{requiredActionFor(current)}</div>
      {model.state?.state === "resolved" && model.state.resolution_note ? <div className="text-caos-sm text-caos-muted leading-snug italic">resolved: {model.state.resolution_note}</div> : null}
    </div>
  );
}

function AssignmentControls({ model }: { model: PhoneTriageModel }) {
  const reason = model.mutation.pending ? "Update in progress" : !model.assigneeInput.trim() ? "Enter an assignee name first" : null;
  return (
    <div className="flex items-center gap-2">
      <span className="tabular text-caos-xs text-caos-muted shrink-0">{model.state?.assignee || "unassigned"}</span>
      <input value={model.assigneeInput} onChange={(event) => model.setAssigneeInput(event.target.value)} placeholder="assign to…" className={`${TOUCH} flex-1 tabular text-caos-md px-2 rounded border border-caos-border bg-transparent text-caos-text focus-ring caos-target`} />
      <ActionReason type="button" reason={reason} onClick={model.assign} className={`${TOUCH} px-3 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring aria-disabled:opacity-50 caos-target`}>Assign</ActionReason>
    </div>
  );
}

function ResolutionControls({ model }: { model: PhoneTriageModel }) {
  if (!model.resolving) return null;
  return (
    <div className="flex items-center gap-2">
      <input value={model.resolveNote} onChange={(event) => model.setResolveNote(event.target.value)} placeholder="resolution note (optional)…" autoFocus className={`${TOUCH} flex-1 tabular text-caos-md px-2 rounded border border-caos-border bg-transparent text-caos-text focus-ring caos-target`} />
      <ActionReason type="button" reason={model.mutation.pending ? "Update in progress" : null} onClick={model.resolve} className={`${TOUCH} px-3 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring caos-target`}>Confirm</ActionReason>
    </div>
  );
}

function MutationFailure({ model }: { model: PhoneTriageModel }) {
  if (!model.mutation.error) return null;
  return <div role="alert" className="flex items-center gap-2 rounded border border-caos-critical/50 px-2 py-2 text-caos-xs text-caos-critical"><span className="flex-1">{model.mutation.error}. Input was preserved.</span><ActionReason type="button" reason={model.mutation.pending ? "Update in progress" : null} className={`${TOUCH} px-2 rounded border border-caos-border focus-ring`} onClick={model.mutation.retry}>Retry</ActionReason></div>;
}

function TriageActions({ model }: { model: PhoneTriageModel }) {
  if (model.state?.state === "resolved") return null;
  const acknowledged = model.state?.state === "ack";
  return (
    <div className="flex flex-col gap-2">
      <AssignmentControls model={model} />
      <div className="flex items-center gap-2">
        <ActionReason type="button" reason={acknowledged ? "Already acknowledged" : model.mutation.pending ? "Update in progress" : null} onClick={model.acknowledge} className={`${TOUCH} flex-1 tabular text-caos-md rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring aria-disabled:opacity-50 caos-target`}>Ack</ActionReason>
        <button type="button" onClick={() => model.setResolving(true)} className={`${TOUCH} flex-1 tabular text-caos-md rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring caos-target`}>Resolve</button>
      </div>
      <ResolutionControls model={model} />
      <MutationFailure model={model} />
    </div>
  );
}

function PhoneTriageView({ model }: { model: PhoneTriageModel }) {
  const current = model.selection.current!;
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 p-3 overflow-y-auto">
      <TriageNavigation model={model} />
      <TriageAlertCard model={model} />
      <TriageActions model={model} />
      <a href={issuerHref(current)} className={`${TOUCH} flex items-center justify-center gap-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring caos-target tabular text-caos-sm`}>Continue on desktop — open {current.issuerName} in Deep-Dive →</a>
    </div>
  );
}

export function PhoneTriage() {
  const model = usePhoneTriageModel();
  if (model.autonomy.loading) return <SurfaceState kind="loading" title="Loading alert triage" compact className="m-2" />;
  if (model.autonomy.offline) return <SurfaceState kind="offline" title="Autonomy engine unreachable" detail="No draft data to show." compact className="m-2" />;
  if (!model.selection.current) return <SurfaceState kind="empty" title="No alerts to triage" detail={model.autonomy.draft?.marking ?? undefined} compact className="m-2" />;
  return <PhoneTriageView model={model} />;
}
