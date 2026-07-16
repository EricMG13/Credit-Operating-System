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
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { ConclusionAuthority } from "@/components/shared/ConclusionAuthority";
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

export function PhoneTriage() {
  const { draft, loading, offline } = useAutonomyDraft();
  const [states, setStates] = useState<Map<string, AlertStateDTO>>(new Map());
  // Tracked by alert KEY, not array index — resolving/acking the current
  // card changes its rank in `ordered` (open-first), which would silently
  // shift a plain index onto a DIFFERENT alert the moment the action lands.
  // The card must stay put on the same alert until the analyst explicitly
  // taps Next, however the queue reorders underneath it.
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [assigneeInput, setAssigneeInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [mutationPending, setMutationPending] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const mutationPendingRef = useRef(false);
  const retryMutationRef = useRef<(() => Promise<void>) | null>(null);

  const rows = draft ? draftToAlertRows(draft) : [];
  // Untouched alerts first — an analyst triaging on a phone wants the ones
  // nothing has happened to yet, not to re-page past everything already
  // acked. Stable within a rank (draftToAlertRows already sorted by severity).
  const ordered = [...rows].sort(
    (a, b) => (STATE_RANK[states.get(a.key)?.state ?? "open"] ?? 0) - (STATE_RANK[states.get(b.key)?.state ?? "open"] ?? 0),
  );

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

  // Land on the first alert once the queue has any; if the current key drops
  // out of the queue entirely (a later cycle resets the draft), fall back to
  // the new first item rather than stranding the view on a dead key.
  useEffect(() => {
    if (ordered.length === 0) return;
    if (currentKey == null || !ordered.some((r) => r.key === currentKey)) {
      setCurrentKey(ordered[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered.map((r) => r.key).join(","), currentKey]);

  useEffect(() => {
    // A retry belongs to the alert that produced it. Never carry a failed
    // mutation onto the next card where retrying would update a hidden alert.
    setMutationError(null);
    retryMutationRef.current = null;
  }, [currentKey]);

  if (loading) {
    return <div className="px-3 py-4 tabular text-caos-xs text-caos-muted">loading…</div>;
  }
  if (offline) {
    return (
      <div className="px-3 py-4 flex items-center gap-2">
        <ProvenanceChip prov={{ origin: "DEMO", detail: "Autonomy engine unreachable — Watchtower has no data to show." }} />
        <span className="tabular text-caos-xs text-caos-muted">Watchtower unreachable</span>
      </div>
    );
  }
  if (ordered.length === 0) {
    return (
      <div className="px-3 py-4 flex items-center gap-2">
        <ConclusionAuthority prov={{ origin: "LIVE", method: "MODELLED", detail: draft?.marking }} />
        <span className="tabular text-caos-xs text-caos-muted">no alerts to triage</span>
      </div>
    );
  }

  const idx = Math.max(0, ordered.findIndex((r) => r.key === currentKey));
  const current = ordered[idx];
  const goto = (i: number) => setCurrentKey(ordered[Math.max(0, Math.min(ordered.length - 1, i))].key);
  const state = states.get(current.key);
  const acked = state?.state === "ack";
  const resolved = state?.state === "resolved";
  const impact = formatImpact(current);
  const applyState = (next: AlertStateDTO) => setStates((m) => new Map(m).set(current.key, next));
  const performMutation = async (action: () => Promise<void>) => {
    if (mutationPendingRef.current) return;
    retryMutationRef.current = action;
    mutationPendingRef.current = true;
    setMutationPending(true);
    setMutationError(null);
    try {
      await action();
      retryMutationRef.current = null;
    } catch (reason) {
      setMutationError(toErrorMessage(reason, "Alert workflow update failed"));
    } finally {
      mutationPendingRef.current = false;
      setMutationPending(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 p-3 overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="tabular text-caos-xs text-caos-muted">
          {idx + 1} of {ordered.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => goto(idx - 1)}
            aria-label="Previous alert"
            className={`${TOUCH} flex items-center justify-center rounded border border-caos-border text-caos-muted hover:text-caos-text disabled:opacity-40 focus-ring caos-target`}
          >
            ‹
          </button>
          <button
            type="button"
            disabled={idx >= ordered.length - 1}
            onClick={() => goto(idx + 1)}
            aria-label="Next alert"
            className={`${TOUCH} flex items-center justify-center rounded border border-caos-border text-caos-muted hover:text-caos-text disabled:opacity-40 focus-ring caos-target`}
          >
            ›
          </button>
        </div>
      </div>

      <div className="rounded border border-caos-border bg-caos-panel p-3 flex flex-col gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <ConclusionAuthority prov={rowProvenance(current)} />
          {impact ? (
            <span
              className="tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border whitespace-nowrap"
              title="Anomaly severity — standard deviations from the baseline/peer median"
              style={{ color: "var(--caos-muted)", borderColor: "var(--caos-border)" }}
            >
              {impact}
            </span>
          ) : null}
          <span
            className="tabular text-caos-2xs uppercase tracking-wider ml-auto"
            style={{ color: resolved || acked ? "var(--caos-success)" : "var(--caos-muted)" }}
          >
            {resolved ? "Resolved" : acked ? "Ack/assigned" : "Open"}
          </span>
        </div>
        <IssuerLink
          query={current.issuerName}
          title={`Open ${current.issuerName} profile`}
          className={`${TOUCH} inline-flex items-center tabular text-caos-lg text-caos-accent hover:text-caos-text transition-caos focus-ring rounded px-0.5 outline-none`}
        >
          {current.issuerName}
        </IssuerLink>
        <div className="text-caos-md text-caos-text leading-snug">{current.event}</div>
        <div className="text-caos-sm text-caos-muted leading-snug">{current.reason}</div>
        <div className="text-caos-sm text-caos-muted leading-snug">{requiredActionFor(current)}</div>
        {resolved && state?.resolution_note ? (
          <div className="text-caos-sm text-caos-muted leading-snug italic">resolved: {state.resolution_note}</div>
        ) : null}
      </div>

      {!resolved ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="tabular text-caos-xs text-caos-muted shrink-0">{state?.assignee || "unassigned"}</span>
            <input
              value={assigneeInput}
              onChange={(e) => setAssigneeInput(e.target.value)}
              placeholder="assign to…"
              className={`${TOUCH} flex-1 tabular text-caos-md px-2 rounded border border-caos-border bg-transparent text-caos-text focus-ring caos-target`}
            />
            <button
              type="button"
              disabled={!assigneeInput.trim() || mutationPending}
              onClick={() => {
                const assignee = assigneeInput.trim();
                void performMutation(async () => {
                  applyState(await setAlertState(current.key, acked ? "ack" : "open", { assignee }));
                  setAssigneeInput("");
                });
              }}
              className={`${TOUCH} px-3 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring disabled:opacity-50 caos-target`}
            >
              Assign
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={acked || mutationPending}
              onClick={() => void performMutation(async () => applyState(await setAlertState(current.key, "ack")))}
              className={`${TOUCH} flex-1 tabular text-caos-md rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring disabled:opacity-50 caos-target`}
            >
              Ack
            </button>
            <button
              type="button"
              onClick={() => setResolving(true)}
              className={`${TOUCH} flex-1 tabular text-caos-md rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring caos-target`}
            >
              Resolve
            </button>
          </div>
          {resolving ? (
            <div className="flex items-center gap-2">
              <input
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="resolution note (optional)…"
                autoFocus
                className={`${TOUCH} flex-1 tabular text-caos-md px-2 rounded border border-caos-border bg-transparent text-caos-text focus-ring caos-target`}
              />
              <button
                type="button"
                disabled={mutationPending}
                onClick={() => {
                  const note = resolveNote;
                  void performMutation(async () => {
                    applyState(await setAlertState(current.key, "resolved", { resolutionNote: note || undefined }));
                    setResolving(false);
                    setResolveNote("");
                  });
                }}
                className={`${TOUCH} px-3 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring caos-target`}
              >
                Confirm
              </button>
            </div>
          ) : null}
          {mutationError ? (
            <div role="alert" className="flex items-center gap-2 rounded border border-caos-critical/50 px-2 py-2 text-caos-xs text-caos-critical">
              <span className="flex-1">{mutationError}. Input was preserved.</span>
              <button type="button" disabled={mutationPending} className={`${TOUCH} px-2 rounded border border-caos-border focus-ring`} onClick={() => { const retry = retryMutationRef.current; if (retry) void performMutation(retry); }}>Retry</button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Desktop handoff — the ONLY route out of the triage card into a real
          analytical workflow. Deep-Dive is honestly not a phone surface
          (locked decision #4); this hands the issuer over rather than
          pretending phone can do the review itself. */}
      <a
        href={issuerHref(current)}
        className={`${TOUCH} flex items-center justify-center gap-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring caos-target tabular text-caos-sm`}
      >
        Continue on desktop — open {current.issuerName} in Deep-Dive →
      </a>
    </div>
  );
}
