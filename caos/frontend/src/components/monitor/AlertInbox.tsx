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

import { useEffect, useState } from "react";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { BatchBar } from "@/components/shared/BatchBar";
import { useAutonomyDraft } from "@/lib/engine/useAutonomyDraft";
import { draftToAlertRows, formatImpact, type AlertRow } from "@/lib/alerts/inbox";
import { getAlertStates, setAlertState, type AlertStateDTO } from "@/lib/api";

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
  onAck: () => void;
  onAssign: (name: string) => void;
  onResolve: (note: string) => void;
}) {
  const [assigneeInput, setAssigneeInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
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
        <ProvenanceChip prov={{ origin: "LIVE", method: row.method === "MODELLED" ? "MODELLED" : "DERIVED" }} />
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
            disabled={!assigneeInput.trim()}
            onClick={() => {
              onAssign(assigneeInput.trim());
              setAssigneeInput("");
            }}
            className="tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring disabled:opacity-50 caos-target"
          >
            Assign
          </button>
          <button
            type="button"
            disabled={acked}
            onClick={onAck}
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
                onClick={() => { onResolve(resolveNote); setResolving(false); setResolveNote(""); }}
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
        </div>
      ) : null}
    </div>
  );
}

export function AlertInbox() {
  const { draft, loading, offline } = useAutonomyDraft();
  const [states, setStates] = useState<Map<string, AlertStateDTO>>(new Map());
  const [selected, setSelected] = useState<string[]>([]);
  const [resolvedOpen, setResolvedOpen] = useState(false);

  const rows = draft ? draftToAlertRows(draft) : [];

  useEffect(() => {
    if (rows.length === 0) return;
    let alive = true;
    getAlertStates()
      .then((list) => {
        if (alive) setStates(new Map(list.map((s) => [s.alert_key, s])));
      })
      .catch(() => {
        // enrichment only — an unreachable alerts route just shows unassigned/open.
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.generated_at]);

  if (loading || offline || rows.length === 0) return null;

  const toggleSelect = (key: string) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  const applyState = (key: string, next: AlertStateDTO) => setStates((m) => new Map(m).set(key, next));

  const activeRows = rows.filter((r) => states.get(r.key)?.state !== "resolved");
  const resolvedRows = rows.filter((r) => states.get(r.key)?.state === "resolved");

  return (
    <div>
      <BatchBar
        selected={selected}
        onClear={() => setSelected([])}
        itemLabel="alert"
        actions={[
          {
            id: "ack",
            label: "Ack",
            run: async (key) => applyState(key, await setAlertState(key, "ack")),
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
          onAck={() => setAlertState(row.key, "ack").then((r) => applyState(row.key, r))}
          onAssign={(name) =>
            setAlertState(row.key, states.get(row.key)?.state === "ack" ? "ack" : "open", { assignee: name }).then(
              (r) => applyState(row.key, r),
            )
          }
          onResolve={(note) =>
            setAlertState(row.key, "resolved", { resolutionNote: note || undefined }).then((r) => applyState(row.key, r))
          }
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
                  onAck={() => {}}
                  onAssign={() => {}}
                  onResolve={() => {}}
                />
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
