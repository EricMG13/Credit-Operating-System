"use client";

// Analyst QA-flag action (compose → confirm → recorded server-side). Shared by
// the Deep-Dive step-output modal and the evidence modal so "FLAG TO QA · CP-5"
// behaves identically everywhere it appears — a silent no-op escalation button
// is the one failure a governance product can't afford.

import { useEffect, useId, useState } from "react";
import { createQaFlag, listQaFlags } from "@/lib/api";
import { ActionReason } from "@/components/shared/ActionReason";

type FlagPhase = "idle" | "composing" | "submitting" | "flagged" | "error";

const useQaFlagCount = (issuerId: string, moduleId: string, stepRef: string) => {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let stale = false;
    listQaFlags({ module_id: moduleId, step_ref: stepRef, issuer_id: issuerId })
      .then((flags) => { if (!stale) setCount(flags.length); })
      .catch(() => { if (!stale) setCount(null); });
    return () => { stale = true; };
  }, [issuerId, moduleId, stepRef]);
  return { count, setCount };
};

function FlaggedConfirmation({ count }: { count: number | null }) {
  return (
    <div role="status" className="tabular text-caos-md px-2.5 py-1.5 rounded border" style={{ borderColor: "var(--caos-success)", color: "var(--caos-success)" }}>
      ✓ FLAGGED TO QA — recorded{count != null && count > 1 ? ` · ${count} on file` : ""}
    </div>
  );
}

function FlagComposer({
  noteId,
  note,
  phase,
  onNoteChange,
  onSubmit,
  onCancel,
}: {
  noteId: string;
  note: string;
  phase: FlagPhase;
  onNoteChange: (note: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const submitting = phase === "submitting";
  return (
    <div className="flex flex-col gap-1.5">
      <label className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted" htmlFor={noteId}>
        Reason for QA (optional)
      </label>
      <textarea
        id={noteId}
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        maxLength={2000}
        rows={3}
        autoFocus
        placeholder="Describe what CP-5 should review…"
        className="rounded border border-caos-border bg-caos-bg px-2 py-1.5 text-caos-md text-caos-text outline-none focus-ring focus:border-caos-accent transition-caos placeholder:text-caos-muted resize-y"
      />
      <div className="flex gap-1.5">
        <ActionReason
          onClick={onSubmit}
          reason={submitting ? "Submitting flag to QA…" : null}
          className="tabular text-caos-md px-2.5 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring aria-disabled:opacity-40 aria-disabled:cursor-not-allowed"
        >
          {submitting ? "FLAGGING…" : "CONFIRM FLAG"}
        </ActionReason>
        <ActionReason
          onClick={onCancel}
          reason={submitting ? "Can't cancel while the flag is submitting" : null}
          className="tabular text-caos-md px-2.5 py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos focus-ring aria-disabled:opacity-40"
        >
          CANCEL
        </ActionReason>
      </div>
    </div>
  );
}

function FlagLauncher({ phase, count, onCompose }: { phase: FlagPhase; count: number | null; onCompose: () => void }) {
  const countLabel = count != null && count > 0 ? `${count} flag${count > 1 ? "s" : ""} on file for this step` : null;
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={onCompose}
        className="tabular text-caos-md whitespace-nowrap px-2.5 py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring"
      >
        FLAG TO QA · CP-5
      </button>
      {phase === "error" ? (
        <span role="alert" className="text-caos-sm" style={{ color: "var(--caos-critical-bright)" }}>
          flag failed — check connection and retry
        </span>
      ) : countLabel ? <span className="tabular text-caos-2xs text-caos-muted">{countLabel}</span> : null}
    </div>
  );
}

export function FlagToQa({ issuerId, moduleId, stepRef }: { issuerId: string; moduleId: string; stepRef: string }) {
  const [phase, setPhase] = useState<FlagPhase>("idle");
  const [note, setNote] = useState("");
  const { count, setCount } = useQaFlagCount(issuerId, moduleId, stepRef);
  // The evidence modal can open over the step modal — two instances may mount
  // at once, so the textarea id must be unique per instance.
  const noteId = useId();
  const submit = () => {
    setPhase("submitting");
    createQaFlag({
      module_id: moduleId,
      step_ref: stepRef,
      note,
      issuer_id: issuerId,
    })
      .then(() => { setPhase("flagged"); setCount((c) => (c ?? 0) + 1); })
      .catch(() => setPhase("error"));
  };

  if (phase === "flagged") return <FlaggedConfirmation count={count} />;
  if (phase === "composing" || phase === "submitting") {
    return (
      <FlagComposer noteId={noteId} note={note} phase={phase} onNoteChange={setNote} onSubmit={submit} onCancel={() => setPhase("idle")} />
    );
  }
  return <FlagLauncher phase={phase} count={count} onCompose={() => setPhase("composing")} />;
}
