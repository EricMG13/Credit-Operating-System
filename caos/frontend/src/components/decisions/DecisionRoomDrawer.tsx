"use client";

import { useEffect, useState } from "react";
import { ActionReason } from "@/components/shared/ActionReason";
import { SlideOver } from "@/components/shared/SlideOver";
import { TextInput } from "@/components/shared/TextInput";
import { createDecision, getDecisions, voteDecision, type IcDecision } from "@/lib/api";

export function DecisionRoomDrawer({
  issuerId, runId, reportId, onClose,
}: {
  issuerId: string; runId: string; reportId?: string | null; onClose(): void;
}) {
  const [decisions, setDecisions] = useState<IcDecision[]>([]);
  const [action, setAction] = useState<"approve" | "decline" | "revisit">("approve");
  const [thesis, setThesis] = useState("");
  const [conditions, setConditions] = useState("");
  const [expiry, setExpiry] = useState("");
  const [dissent, setDissent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getDecisions(issuerId).then(setDecisions).catch(() => setError("Couldn’t load prior decisions.")); }, [issuerId]);

  const submit = async () => {
    // ActionReason only wires this callback while the trimmed thesis is non-empty.
    setBusy(true); setError(null);
    try {
      const next = await createDecision({
        issuer_id: issuerId, run_id: runId, report_id: reportId,
        action, conditions: conditions.split("\n").map((v) => v.trim()).filter(Boolean),
        expiry: expiry || null, snapshot: { thesis_md: thesis.trim() },
      });
      setDecisions((current) => [next, ...current]);
      setThesis(""); setConditions("");
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: { message?: string } | string } } })?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : detail?.message || "Decision capture failed.");
    } finally { setBusy(false); }
  };

  const vote = async (decision: IcDecision, choice: "approve" | "dissent" | "abstain") => {
    try {
      const updated = await voteDecision(decision.id, choice, choice === "dissent" ? dissent : undefined);
      setDecisions((rows) => rows.map((row) => row.id === updated.id ? updated : row));
      if (choice === "dissent") setDissent("");
    } catch { setError("Vote could not be recorded."); }
  };

  return (
    <SlideOver title="IC Decision Room" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">RUN {runId.slice(0, 8)} · immutable snapshot on submit</div>
        <div className="flex gap-1" role="group" aria-label="Decision action">
          {(["approve", "decline", "revisit"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={action === value} onClick={() => setAction(value)} className={`tabular text-caos-xs min-h-8 px-2 rounded border focus-ring transition-caos ${action === value ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted"}`}>{value.toUpperCase()}</button>
          ))}
        </div>
        <label className="tabular text-caos-xs text-caos-muted">THESIS SNAPSHOT
          <textarea value={thesis} onChange={(e) => setThesis(e.target.value)} rows={5} maxLength={50_000} className="mt-1 w-full rounded border border-caos-border bg-caos-bg p-2 text-caos-text focus-ring" />
        </label>
        <label className="tabular text-caos-xs text-caos-muted">CONDITIONS · ONE PER LINE
          <textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={3} className="mt-1 w-full rounded border border-caos-border bg-caos-bg p-2 text-caos-text focus-ring" />
        </label>
        <label className="tabular text-caos-xs text-caos-muted">EXPIRY
          <TextInput type="date" name="decision-expiry" autoComplete="off" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="mt-1 w-full" />
        </label>
        <ActionReason reason={busy ? "Capturing decision…" : !thesis.trim() ? "Enter a thesis first" : null} onClick={submit} className="tabular text-caos-xs min-h-9 rounded bg-caos-accent text-caos-bg aria-disabled:opacity-40 focus-ring">{busy ? "CAPTURING…" : "CAPTURE DECISION"}</ActionReason>
        {error ? <div role="alert" className="tabular text-caos-xs" style={{ color: "var(--caos-critical)" }}>{error}</div> : null}

        <div className="border-t border-caos-border pt-2 flex flex-col gap-2">
          <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Decision history</div>
          {decisions.length === 0 ? <div className="text-caos-xs text-caos-muted">No captured decisions for this issuer.</div> : decisions.map((decision) => (
            <div key={decision.id} className="rounded border border-caos-border bg-caos-bg p-2">
              <div className="flex items-center gap-2">
                <span className="tabular text-caos-xs text-caos-text">{decision.action.toUpperCase()}</span>
                <span className="tabular text-caos-2xs text-caos-muted">{decision.status.toUpperCase()} · SHA {decision.snapshot_sha256.slice(0, 10)}</span>
              </div>
              <div className="text-caos-xs text-caos-muted mt-1">{String(decision.snapshot.thesis_md ?? "No thesis text")}</div>
              <div className="flex gap-1 mt-2">
                <button type="button" onClick={() => vote(decision, "approve")} className="tabular text-caos-2xs min-h-7 px-2 rounded border border-caos-border text-caos-muted focus-ring">APPROVE</button>
                <button type="button" onClick={() => vote(decision, "abstain")} className="tabular text-caos-2xs min-h-7 px-2 rounded border border-caos-border text-caos-muted focus-ring">ABSTAIN</button>
                <span className="tabular text-caos-2xs text-caos-muted self-center ml-auto">{decision.votes.length} votes</span>
              </div>
              <div className="flex gap-1 mt-1.5">
                <TextInput name="dissent-rationale" autoComplete="off" value={dissent} onChange={(e) => setDissent(e.target.value)} placeholder="Dissent rationale…" aria-label="Dissent rationale" className="flex-1" />
                <ActionReason reason={!dissent.trim() ? "Enter a dissent rationale first" : null} onClick={() => vote(decision, "dissent")} className="tabular text-caos-2xs min-h-7 px-2 rounded border border-caos-warning text-caos-warning aria-disabled:opacity-40 focus-ring">DISSENT</ActionReason>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideOver>
  );
}
