"use client";

// Monitor's live alert inbox — shares lib/alerts/inbox.ts derivation with
// Command's RankedChanges so the two surfaces can never disagree about what
// an alert says. Renders event → impact → owner → ack/assign. The final
// state column reads "Ack/assigned", never "Resolved" — there is no
// server-side resolution event; the honest loop ends at acknowledgement
// (P2-WP-3).
//
// Renders null when there is nothing live to show (offline, or a settled
// empty draft) — the caller (Monitor page) decides what DEMO fallback to
// show in that case; this component never fabricates rows.

import { useEffect, useState } from "react";
import { IssuerLink } from "@/components/shared/IssuerLink";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { BatchBar } from "@/components/shared/BatchBar";
import { useAutonomyDraft } from "@/lib/engine/useAutonomyDraft";
import { draftToAlertRows, type AlertRow } from "@/lib/alerts/inbox";
import { getAlertStates, setAlertState, type AlertStateDTO } from "@/lib/api";

function Row({
  row,
  state,
  selected,
  onToggleSelect,
  onAck,
  onAssign,
}: {
  row: AlertRow;
  state: AlertStateDTO | undefined;
  selected: boolean;
  onToggleSelect: () => void;
  onAck: () => void;
  onAssign: (name: string) => void;
}) {
  const [assigneeInput, setAssigneeInput] = useState("");
  const acked = state?.state === "ack";
  return (
    <div className="px-3 py-[6px] border-b border-caos-border/50">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${row.event}`}
          className="min-h-8 min-w-8 caos-target"
        />
        <ProvenanceChip prov={{ origin: "LIVE", method: row.method === "MODELLED" ? "MODELLED" : "DERIVED" }} />
        <IssuerLink
          query={row.issuerName}
          title={`Open ${row.issuerName} profile`}
          className="tabular text-caos-md text-caos-accent hover:text-caos-text transition-caos focus-ring rounded px-0.5 outline-none"
        >
          {row.issuerName}
        </IssuerLink>
        <span
          className="tabular text-caos-2xs uppercase tracking-wider ml-auto"
          style={{ color: acked ? "var(--caos-success)" : "var(--caos-muted)" }}
        >
          {acked ? "Ack/assigned" : "Open"}
        </span>
      </div>
      <div className="text-caos-md text-caos-text leading-snug mt-1">{row.event}</div>
      <div className="text-caos-xs text-caos-muted leading-snug mt-0.5">{row.reason}</div>
      <div className="flex items-center gap-2 mt-1.5">
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
      </div>
    </div>
  );
}

export function AlertInbox() {
  const { draft, loading, offline } = useAutonomyDraft();
  const [states, setStates] = useState<Map<string, AlertStateDTO>>(new Map());
  const [selected, setSelected] = useState<string[]>([]);

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
      {rows.map((row) => (
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
        />
      ))}
    </div>
  );
}
