"use client";

// Monitor's live alert inbox — shares lib/alerts/inbox.ts derivation with
// Command's RankedChanges so the two surfaces can never disagree about what
// an alert says. Renders event → impact → owner → ack/assign/resolve. The
// loop now ends at a real "Resolved" terminal state (G8) — resolved rows
// collapse out of the active list into their own disclosure below, never
// mixed back in with (or relabeled as) an open/acked row.
//
// Renders null when there is nothing live to show (offline, or a settled
// empty draft) — the caller (Monitor page) decides what DEMO fallback to
// show in that case; this component never fabricates rows.

import { useCallback, useEffect, useRef, useState } from "react";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { ConclusionAuthority } from "@/components/shared/ConclusionAuthority";
import { BatchBar } from "@/components/shared/BatchBar";
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
  type AlertEventDTO,
  type AlertStateDTO,
  type IcDecision,
} from "@/lib/api";

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
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try { setDecision(await reopenDecision(decision.id, row.key)); }
        catch (reason) { setError(toErrorMessage(reason, "IC decision was not reopened")); }
        finally { setBusy(false); }
      }}
      className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-warning text-caos-warning transition-caos focus-ring disabled:opacity-50 caos-target"
    >
      {busy ? "Reopening…" : error ? "Retry reopen" : "Reopen IC"}
    </button>
    {error ? <span role="alert" className="text-caos-2xs text-caos-critical">{error}</span> : null}
    </>
  );
}

function Row({
  row,
  state,
  selected,
  onToggleSelect,
  onAck,
  onAssign,
  onResolve,
}: {
  row: AlertRow;
  state: AlertStateDTO | undefined;
  selected: boolean;
  onToggleSelect: () => void;
  onAck: () => Promise<void>;
  onAssign: (name: string) => Promise<void>;
  onResolve: (note: string) => Promise<void>;
}) {
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
  const acked = state?.state === "ack";
  const resolved = state?.state === "resolved";
  const impact = formatImpact(row);
  const stateLabel = resolved ? "Resolved" : acked ? "Ack/assigned" : "Open";
  const stateColor = resolved || acked ? "var(--caos-success)" : "var(--caos-muted)";
  return (
    <div className="px-3 py-[6px] border-b border-caos-border/50">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          disabled={resolved}
          aria-label={`Select ${row.event}`}
          className="min-h-8 min-w-8 caos-target disabled:opacity-40"
        />
        <ConclusionAuthority prov={rowProvenance(row)} />
        {impact ? (
          <span
            className="tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border whitespace-nowrap"
            title="Anomaly severity — standard deviations from the baseline/peer median (engine/anomaly.py's robust z-score / cusum run, never a fabricated bp figure)"
            style={{ color: "var(--caos-muted)", borderColor: "var(--caos-border)" }}
          >
            {impact}
          </span>
        ) : null}
        <IssuerLink
          query={row.issuerName}
          title={`Open ${row.issuerName} profile`}
          className="tabular text-caos-md text-caos-accent hover:text-caos-text transition-caos focus-ring rounded px-0.5 outline-none"
        >
          {row.issuerName}
        </IssuerLink>
        <span
          className="tabular text-caos-2xs uppercase tracking-wider ml-auto"
          style={{ color: stateColor }}
        >
          {stateLabel}
        </span>
      </div>
      <div className="text-caos-md text-caos-text leading-snug mt-1">{row.event}</div>
      <div className="text-caos-xs text-caos-muted leading-snug mt-0.5">{row.reason}</div>
      {resolved && state?.resolution_note ? (
        <div className="text-caos-xs text-caos-muted leading-snug mt-0.5 italic">
          resolved: {state.resolution_note}
        </div>
      ) : null}
      {!resolved ? (
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="tabular text-caos-xs text-caos-muted">{state?.assignee || "unassigned"}</span>
          <input
            value={assigneeInput}
            onChange={(e) => setAssigneeInput(e.target.value)}
            placeholder="assign to…"
            className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border bg-transparent text-caos-text w-28 focus-ring caos-target"
          />
          <button
            type="button"
            disabled={!assigneeInput.trim() || pending}
            onClick={() => void perform(
              () => onAssign(assigneeInput.trim()),
              () => setAssigneeInput(""),
            )}
            className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring disabled:opacity-50 caos-target"
          >
            Assign
          </button>
          <button
            type="button"
            disabled={acked || pending}
            onClick={() => void perform(onAck)}
            className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring disabled:opacity-50 caos-target"
          >
            Ack
          </button>
          {resolving ? (
            <>
              <input
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="resolution note (optional)…"
                autoFocus
                className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border bg-transparent text-caos-text w-44 focus-ring caos-target"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => void perform(
                  () => onResolve(resolveNote),
                  () => { setResolving(false); setResolveNote(""); },
                )}
                className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring caos-target"
              >
                Confirm resolve
              </button>
              <button
                type="button"
                onClick={() => { setResolving(false); setResolveNote(""); }}
                className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos focus-ring caos-target"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setResolving(true)}
              className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring caos-target"
            >
              Resolve
            </button>
          )}
          <ReopenDecision row={row} />
          {actionError ? <span role="alert" className="text-caos-2xs text-caos-critical">{actionError} — retry the same action.</span> : null}
        </div>
      ) : null}
    </div>
  );
}

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

  const toggleSelect = (key: string) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

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

  if (loading || offline || rows.length === 0) return null;

  const activeRows = rows.filter((r) => states.get(r.key)?.state !== "resolved");
  const resolvedRows = rows.filter((r) => states.get(r.key)?.state === "resolved");

  return (
    <div>
      {mutationError ? <p role="alert" className="border-b border-caos-border px-3 py-2 text-caos-xs text-caos-critical">{mutationError}. Selection was preserved; retry Ack.</p> : null}
      <BatchBar
        selected={selected}
        onClear={() => setSelected([])}
        itemLabel="alert"
        actions={[
          {
            id: "ack",
            label: "Ack",
            run: async (key) => applyState(key, await persistState(key, "ack")),
          },
        ]}
      />
      {activeRows.map((row) => (
        <Row
          key={row.key}
          row={row}
          state={states.get(row.key)}
          selected={selected.includes(row.key)}
          onToggleSelect={() => toggleSelect(row.key)}
          onAck={async () => applyState(row.key, await persistState(row.key, "ack"))}
          onAssign={async (name) => applyState(
            row.key,
            await persistState(row.key, states.get(row.key)?.state === "ack" ? "ack" : "open", { assignee: name }),
          )}
          onResolve={async (note) => applyState(
            row.key,
            await persistState(row.key, "resolved", { resolutionNote: note || undefined }),
          )}
        />
      ))}
      {resolvedRows.length > 0 ? (
        <div className="border-t border-caos-border/50">
          <button
            type="button"
            onClick={() => setResolvedOpen((v) => !v)}
            aria-expanded={resolvedOpen}
            className="w-full flex items-center gap-2 px-3 min-h-8 tabular text-caos-2xs uppercase tracking-widest text-caos-muted hover:text-caos-text transition-caos focus-ring caos-target"
          >
            {resolvedOpen ? "− " : "+ "}Resolved ({resolvedRows.length})
          </button>
          {resolvedOpen
            ? resolvedRows.map((row) => (
                <Row
                  key={row.key}
                  row={row}
                  state={states.get(row.key)}
                  selected={false}
                  onToggleSelect={() => {}}
                  onAck={async () => {}}
                  onAssign={async () => {}}
                  onResolve={async () => {}}
                />
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
