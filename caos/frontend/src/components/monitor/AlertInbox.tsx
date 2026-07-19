"use client";

// Monitor's live alert inbox — shares lib/alerts/inbox.ts derivation with
// Command's RankedChanges so the two surfaces can never disagree about what
// an alert says. Renders event → impact → owner → ack/assign/resolve. The
// loop now ends at a real "Resolved" terminal state (G8) — resolved rows
// collapse out of the active list into their own disclosure below, never
// mixed back in with (or relabeled as) an open/acked row.
//
// When there is nothing live to show (loading, offline, or a settled empty
// draft) this renders its own honest SurfaceState line instead of a row —
// never a fabricated row, and never silent null either. The Monitor page's
// demo tape sibling is a separate, user-toggled data source, not a fallback
// for this component's state.

import { useCallback, useEffect, useRef, useState } from "react";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { ConclusionAuthority } from "@/components/shared/ConclusionAuthority";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { BatchBar } from "@/components/shared/BatchBar";
import { ActionReason } from "@/components/shared/ActionReason";
import { SourceRef } from "@/components/ui/SourceRef";
import { Dot, Tag } from "@/components/pipeline/atoms";
import { useAutonomyDraft } from "@/lib/engine/useAutonomyDraft";
import { draftToAlertRows, formatImpact, rowProvenance, type AlertRow } from "@/lib/alerts/inbox";
import {
  getAlertEvents,
  getAlertStates,
  getDecisions,
  patchAlertEvent,
  refreshAlertEvents,
  reopenDecision,
  setAlertState,
  toErrorMessage,
  getChunk,
  type AlertEventDTO,
  type AlertStateDTO,
  type IcDecision,
} from "@/lib/api";
import type { ChunkDTO } from "@/lib/query/types";

function eventState(event: AlertEventDTO): AlertStateDTO {
  return {
    id: event.id,
    alert_key: event.alert_key,
    state: event.state,
    assignee: event.assignee,
    note: event.note,
    analyst_id: null,
    created_at: event.created_at,
    resolved_at: event.resolved_at,
    resolution_note: event.resolution_note,
  };
}

function ReopenDecision({ row }: { row: AlertRow }) {
  const material = /covenant|rating/i.test([row.metric, row.event, row.reason].filter(Boolean).join(" "));
  const [decision, setDecision] = useState<IcDecision | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!material || !row.issuerId) return;
    let alive = true;
    getDecisions(row.issuerId).then((rows) => {
      if (alive) setDecision(rows.find((item) => item.status === "active") ?? null);
    }).catch(() => {});
    return () => { alive = false; };
  }, [material, row.issuerId]);
  if (!decision || decision.status === "reopened") return null;
  return (
    <>
    <ActionReason
      reason={busy ? "Reopening…" : null}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try { setDecision(await reopenDecision(decision.id, row.key)); }
        catch (reason) { setError(toErrorMessage(reason, "IC decision was not reopened")); }
        finally { setBusy(false); }
      }}
      className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-warning text-caos-warning transition-caos focus-ring aria-disabled:opacity-50 caos-target"
    >
      {busy ? "Reopening…" : error ? "Retry reopen" : "Reopen IC"}
    </ActionReason>
    {error ? <span role="alert" className="text-caos-2xs text-caos-critical">{error}</span> : null}
    </>
  );
}

/** A live alert may only promise click-to-source when it carries a persisted
 * chunk id that this client can actually resolve. Fact ids alone are retained
 * provenance, but this surface has no fact-detail endpoint, so they are an
 * explicit unavailable state rather than a source-looking dead control. */
function AlertSource({ row }: { row: AlertRow }) {
  const chunkId = row.evidence.chunkIds[0] ?? null;
  const [chunk, setChunk] = useState<ChunkDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!chunkId) {
    const reason = row.evidence.factIds.length
      ? "Draft carries a fact identifier, but no persisted source chunk is available on this surface."
      : "The autonomy draft did not carry a persisted source identifier.";
    return <SourceRef source={{ state: "unavailable", reason }} />;
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
      <SourceRef source={{ state: "ready", id: chunkId, onOpen: () => void open() }}>
        Open persisted source
      </SourceRef>
      {loading ? <span role="status" className="text-caos-2xs text-caos-muted">Loading source…</span> : null}
      {error ? <span role="alert" className="text-caos-2xs text-caos-warning">Source unavailable · {error}</span> : null}
      {chunk ? <details className="text-caos-2xs text-caos-muted"><summary className="cursor-pointer focus-ring rounded">{chunk.doc} · source extract</summary><p className="mt-1 whitespace-pre-wrap leading-snug text-caos-text">{chunk.text}</p></details> : null}
    </div>
  );
}

function severityBand(value: number): "critical" | "high" | "medium" | "low" {
  if (value >= 3) return "critical";
  if (value >= 2) return "high";
  if (value >= 1) return "medium";
  return "low";
}

type RowProps = {
  row: AlertRow;
  state: AlertStateDTO | undefined;
  selected: boolean;
  onToggleSelect: () => void;
  onAck: () => Promise<void>;
  onAssign: (name: string) => Promise<void>;
  onResolve: (note: string) => Promise<void>;
};

type PerformAlertAction = (action: () => Promise<void>, onSuccess?: () => void) => Promise<void>;

function AlertRowHeader({ row, state, selected, onToggleSelect }: Pick<RowProps, "row" | "state" | "selected" | "onToggleSelect">) {
  const resolved = state?.state === "resolved";
  const acked = state?.state === "ack";
  const impact = formatImpact(row);
  const band = severityBand(row.severity);
  const stateLabel = resolved ? "Resolved" : acked ? "Ack/assigned" : "Open";
  const stateColor = resolved || acked ? "var(--caos-success)" : "var(--caos-muted)";
  return (
    <div className="flex items-center gap-2">
      <input type="checkbox" checked={selected} onChange={onToggleSelect} disabled={resolved} aria-label={`Select ${row.event}`} className="min-h-8 min-w-8 caos-target disabled:opacity-40" />
      <ConclusionAuthority prov={rowProvenance(row)} />
      <span className="inline-flex items-center gap-1" title={`Alert severity band: ${band}`}><Dot sev={band} glyph /><Tag sev={band}>{band}</Tag></span>
      {impact ? <span className="tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border whitespace-nowrap" title="Anomaly severity — standard deviations from the baseline/peer median (engine/anomaly.py's robust z-score / cusum run, never a fabricated bp figure)" style={{ color: "var(--caos-muted)", borderColor: "var(--caos-border)" }}>{impact}</span> : null}
      <IssuerLink query={row.issuerName} title={`Open ${row.issuerName} profile`} className="tabular text-caos-md text-caos-accent hover:text-caos-text transition-caos focus-ring rounded px-0.5 outline-none">{row.issuerName}</IssuerLink>
      <span className="tabular text-caos-2xs uppercase tracking-wider ml-auto" style={{ color: stateColor }}>{stateLabel}</span>
    </div>
  );
}

function AlertRowSummary({ row, state }: Pick<RowProps, "row" | "state">) {
  return (
    <>
      <div className="text-caos-md text-caos-text leading-snug mt-1">{row.event}</div>
      <div className="text-caos-xs text-caos-muted leading-snug mt-0.5">{row.reason}</div>
      <AlertSource row={row} />
      {state?.state === "resolved" && state.resolution_note ? <div className="text-caos-xs text-caos-muted leading-snug mt-0.5 italic">resolved: {state.resolution_note}</div> : null}
    </>
  );
}

function AssignmentActions({ state, value, pending, onChange, perform, onAssign, onAck }: {
  state: AlertStateDTO | undefined;
  value: string;
  pending: boolean;
  onChange: (value: string) => void;
  perform: PerformAlertAction;
  onAssign: RowProps["onAssign"];
  onAck: RowProps["onAck"];
}) {
  const assignee = value.trim();
  return (
    <>
      <span className="tabular text-caos-xs text-caos-muted">{state?.assignee || "unassigned"}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="assign to…" className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border bg-transparent text-caos-text w-28 focus-ring caos-target" />
      <ActionReason reason={!assignee ? "Enter a name to assign" : pending ? "Update in progress…" : null} onClick={() => void perform(() => onAssign(assignee), () => onChange(""))} className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring aria-disabled:opacity-50 caos-target">Assign</ActionReason>
      <ActionReason reason={state?.state === "ack" ? "Already acknowledged" : pending ? "Update in progress…" : null} onClick={() => void perform(onAck)} className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring aria-disabled:opacity-50 caos-target">Ack</ActionReason>
    </>
  );
}

function ResolutionActions({ active, note, pending, onActiveChange, onNoteChange, perform, onResolve }: {
  active: boolean;
  note: string;
  pending: boolean;
  onActiveChange: (active: boolean) => void;
  onNoteChange: (note: string) => void;
  perform: PerformAlertAction;
  onResolve: RowProps["onResolve"];
}) {
  const reset = () => { onActiveChange(false); onNoteChange(""); };
  if (!active) return <button type="button" onClick={() => onActiveChange(true)} className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring caos-target">Resolve</button>;
  return (
    <>
      <input value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder="resolution note (optional)…" autoFocus className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border bg-transparent text-caos-text w-44 focus-ring caos-target" />
      <ActionReason reason={pending ? "Update in progress…" : null} onClick={() => void perform(() => onResolve(note), reset)} className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring caos-target">Confirm resolve</ActionReason>
      <button type="button" onClick={reset} className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos focus-ring caos-target">Cancel</button>
    </>
  );
}

function AlertRowActions({ row, state, onAck, onAssign, onResolve }: Pick<RowProps, "row" | "state" | "onAck" | "onAssign" | "onResolve">) {
  const [assigneeInput, setAssigneeInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const perform = async (action: () => Promise<void>, onSuccess?: () => void) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setActionError(null);
    try {
      await action();
      onSuccess?.();
    } catch (reason) {
      setActionError(toErrorMessage(reason, "Alert workflow update failed"));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  return (
    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
      <AssignmentActions state={state} value={assigneeInput} pending={pending} onChange={setAssigneeInput} perform={perform} onAssign={onAssign} onAck={onAck} />
      <ResolutionActions active={resolving} note={resolveNote} pending={pending} onActiveChange={setResolving} onNoteChange={setResolveNote} perform={perform} onResolve={onResolve} />
      <ReopenDecision row={row} />
      {actionError ? <span role="alert" className="text-caos-2xs text-caos-critical">{actionError} — retry the same action.</span> : null}
    </div>
  );
}

function Row(props: RowProps) {
  return (
    <div className="px-3 py-[6px] border-b border-caos-border/50">
      <AlertRowHeader row={props.row} state={props.state} selected={props.selected} onToggleSelect={props.onToggleSelect} />
      <AlertRowSummary row={props.row} state={props.state} />
      {props.state?.state !== "resolved" ? <AlertRowActions row={props.row} state={props.state} onAck={props.onAck} onAssign={props.onAssign} onResolve={props.onResolve} /> : null}
    </div>
  );
}

type PersistAlertState = (
  key: string,
  state: AlertStateDTO["state"],
  opts?: { assignee?: string; note?: string; resolutionNote?: string },
) => Promise<AlertStateDTO>;

function ActiveInboxRow({
  row,
  state,
  selected,
  onToggleSelect,
  persistState,
  applyState,
}: {
  row: AlertRow;
  state?: AlertStateDTO;
  selected: boolean;
  onToggleSelect: () => void;
  persistState: PersistAlertState;
  applyState: (key: string, next: AlertStateDTO) => void;
}) {
  return (
    <Row
      row={row}
      state={state}
      selected={selected}
      onToggleSelect={onToggleSelect}
      onAck={async () => applyState(row.key, await persistState(row.key, "ack"))}
      onAssign={async (name) => applyState(
        row.key,
        await persistState(row.key, state?.state === "ack" ? "ack" : "open", { assignee: name }),
      )}
      onResolve={async (note) => applyState(
        row.key,
        await persistState(row.key, "resolved", { resolutionNote: note || undefined }),
      )}
    />
  );
}

const noAlertAction = async () => {};

function ResolvedInbox({
  rows,
  states,
  open,
  onOpenChange,
}: {
  rows: AlertRow[];
  states: Map<string, AlertStateDTO>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!rows.length) return null;
  return (
    <div className="border-t border-caos-border/50">
      <button type="button" onClick={() => onOpenChange(!open)} aria-expanded={open} className="w-full flex items-center gap-2 px-3 min-h-8 tabular text-caos-2xs uppercase tracking-widest text-caos-muted hover:text-caos-text transition-caos focus-ring caos-target">
        {open ? "− " : "+ "}Resolved ({rows.length})
      </button>
      {open ? rows.map((row) => <Row key={row.key} row={row} state={states.get(row.key)} selected={false} onToggleSelect={noAlertAction} onAck={noAlertAction} onAssign={noAlertAction} onResolve={noAlertAction} />) : null}
    </div>
  );
}

function AlertInboxContent({
  rows,
  states,
  selected,
  mutationError,
  resolvedOpen,
  setSelected,
  setResolvedOpen,
  persistState,
  applyState,
}: {
  rows: AlertRow[];
  states: Map<string, AlertStateDTO>;
  selected: string[];
  mutationError: string | null;
  resolvedOpen: boolean;
  setSelected: (selected: string[]) => void;
  setResolvedOpen: (open: boolean) => void;
  persistState: PersistAlertState;
  applyState: (key: string, next: AlertStateDTO) => void;
}) {
  const activeRows = rows.filter((row) => states.get(row.key)?.state !== "resolved");
  const resolvedRows = rows.filter((row) => states.get(row.key)?.state === "resolved");
  const toggleSelect = (key: string) => setSelected(
    selected.includes(key) ? selected.filter((selectedKey) => selectedKey !== key) : [...selected, key],
  );
  return (
    <div>
      {mutationError ? <p role="alert" className="border-b border-caos-border px-3 py-2 text-caos-xs text-caos-critical">{mutationError}. Selection was preserved; retry Ack.</p> : null}
      <BatchBar selected={selected} onClear={() => setSelected([])} itemLabel="alert" actions={[{ id: "ack", label: "Ack", run: async (key) => applyState(key, await persistState(key, "ack")) }]} />
      {activeRows.map((row) => <ActiveInboxRow key={row.key} row={row} state={states.get(row.key)} selected={selected.includes(row.key)} onToggleSelect={() => toggleSelect(row.key)} persistState={persistState} applyState={applyState} />)}
      <ResolvedInbox rows={resolvedRows} states={states} open={resolvedOpen} onOpenChange={setResolvedOpen} />
    </div>
  );
}

const alertInboxState = (loading: boolean, offline: boolean, rowCount: number) => {
  if (loading) return <SurfaceState kind="loading" title="Loading alert inbox" compact className="m-2" />;
  if (offline) return <SurfaceState kind="offline" title="Autonomy engine unreachable" detail="No draft data to show." compact className="m-2" />;
  return rowCount === 0
    ? <SurfaceState kind="empty" title="No live alerts" detail="Nothing routed from the autonomy draft." compact className="m-2" />
    : null;
};

export function AlertInbox() {
  const { draft, loading, offline } = useAutonomyDraft();
  const [states, setStates] = useState<Map<string, AlertStateDTO>>(new Map());
  const [events, setEvents] = useState<Map<string, AlertEventDTO>>(new Map());
  const [selected, setSelected] = useState<string[]>([]);
  const [resolvedOpen, setResolvedOpen] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const ackSelectedPending = useRef(false);

  const rows = draft ? draftToAlertRows(draft) : [];

  useEffect(() => {
    if (rows.length === 0) return;
    let alive = true;
    Promise.all([
      getAlertStates(),
      refreshAlertEvents().catch(() => getAlertEvents()),
    ])
      .then(([list, durable]) => {
        if (!alive) return;
        const durableByKey = new Map(durable.map((event) => [event.alert_key, event]));
        setEvents(durableByKey);
        setStates(new Map([
          ...list.map((state) => [state.alert_key, state] as const),
          ...durable.map((event) => [event.alert_key, eventState(event)] as const),
        ]));
      })
      .catch(() => {
        // enrichment only — an unreachable alerts route just shows unassigned/open.
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.generated_at]);

  const applyState = (key: string, next: AlertStateDTO) => setStates((m) => new Map(m).set(key, next));

  const persistState = useCallback(async (
    key: string,
    state: AlertStateDTO["state"],
    opts?: { assignee?: string; note?: string; resolutionNote?: string },
  ) => {
    const event = events.get(key);
    if (!event) return opts ? setAlertState(key, state, opts) : setAlertState(key, state);
    const next = await patchAlertEvent(event.id, state, opts);
    setEvents((current) => new Map(current).set(key, next));
    return eventState(next);
  }, [events]);

  useEffect(() => {
    const acknowledgeSelected = () => {
      // Custom events are synchronous: two rapid dispatches arrive before the
      // first render can disable anything. Claim the batch in a ref before any
      // await so each selected event produces at most one durable transition.
      if (ackSelectedPending.current || selected.length === 0) return;
      ackSelectedPending.current = true;
      setMutationError(null);
      void Promise.all(selected.map(async (key) => applyState(key, await persistState(key, "ack"))))
        .then(() => setSelected([]))
        .catch((reason) => setMutationError(toErrorMessage(reason, "Selected alerts were not acknowledged")))
        .finally(() => { ackSelectedPending.current = false; });
    };
    window.addEventListener("caos:monitor-ack-selected", acknowledgeSelected);
    return () => window.removeEventListener("caos:monitor-ack-selected", acknowledgeSelected);
  }, [persistState, selected]);

  useEffect(() => {
    const first = selected[0] ? events.get(selected[0]) : null;
    window.dispatchEvent(new CustomEvent("caos:monitor-selection", {
      detail: { count: selected.length, eventId: first?.id ?? null },
    }));
  }, [events, selected]);

  // Loading / offline / genuinely-empty are three different facts and must
  // read as three different things — the demo tape rendered as this panel's
  // sibling (Monitor page.tsx) is a separate data source gated on a user
  // toggle, not a fallback for this component's own state, so a silent
  // `return null` across all three used to leave the live lane's status
  // unstated regardless of which of the three was actually true. Never
  // fabricates a row here — only an honest status line for THIS component.
  const stateSurface = alertInboxState(loading, offline, rows.length);
  if (stateSurface) return stateSurface;
  return <AlertInboxContent rows={rows} states={states} selected={selected} mutationError={mutationError} resolvedOpen={resolvedOpen} setSelected={setSelected} setResolvedOpen={setResolvedOpen} persistState={persistState} applyState={applyState} />;
}
