"use client";

// Deep-Dive's decision-first opener: the standing view (posture/conviction)
// leads the workspace, above the module content. Sourced from EXACTLY the
// same fixture DecisionRail already renders (DEBATE.bias / SIZING.decision,
// components/reports/deal.ts) — the reference issuer's CP-6A/CP-6E content is
// fixture-only today (rails.tsx gates it on `isReference`, no live
// equivalent exists yet), so a real issuer honestly shows "no standing view"
// rather than inventing one.
//
// Affirm/Revise are PERSONAL ANNOTATIONS, not a governance action — no
// server-side CP-6 write path exists. They persist to the analyst's
// workspace settings (workspace.affirmations, capped at 20, P2-WP-0) via the
// same read-modify-write wrapper every workspace writer uses.

import { useState } from "react";
import { DEBATE, SIZING } from "@/lib/reports/deal";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { updateAnalystWorkspace } from "@/lib/api";

interface Affirmation {
  issuerId: string;
  runId: string | null;
  stance: string;
  ts: string;
}

const MAX_AFFIRMATIONS = 20;

export function StandingViewStrip({
  isReference,
  issuerId,
  runId,
  onRevise,
}: {
  isReference: boolean;
  issuerId: string;
  runId: string | null;
  /** Deep-links to the module the revise action should open (CP-6A). */
  onRevise: (moduleId: string) => void;
}) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  if (!isReference) {
    return (
      <div className="flex items-center gap-2 px-3 min-h-9 border-b border-caos-border bg-caos-panel/40 shrink-0">
        <ProvenanceChip prov={{ origin: "LIVE", detail: "No CP-6 verdict has run for this issuer yet." }} />
        <span className="tabular text-caos-sm text-caos-muted">No standing view — run CP-6 to establish one.</span>
      </div>
    );
  }

  const [head, ...rest] = DEBATE.bias.split(" — ");
  const tail = rest.join(" — ");

  const affirm = () => {
    setSaveState("saving");
    updateAnalystWorkspace((ws) => {
      const prior = Array.isArray(ws.affirmations) ? (ws.affirmations as Affirmation[]) : [];
      const next: Affirmation[] = [
        { issuerId, runId, stance: head, ts: new Date().toISOString() },
        ...prior,
      ].slice(0, MAX_AFFIRMATIONS);
      return { ...ws, affirmations: next };
    })
      .then(() => setSaveState("saved"))
      .catch(() => setSaveState("idle"));
  };

  return (
    <div className="flex items-center gap-3 px-3 min-h-9 border-b border-caos-border bg-caos-panel/40 shrink-0">
      <ProvenanceChip prov={{ origin: "DEMO", detail: "Atlas Forge reference fixture — not a live issuer verdict." }} />
      <div className="flex-1 min-w-0 flex items-baseline gap-2 truncate">
        <span className="tabular text-caos-md font-semibold" style={{ color: "var(--caos-success-bright)" }}>{head}</span>
        {tail ? <span className="tabular text-caos-sm text-caos-muted truncate">— {tail}</span> : null}
        <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap">· conviction: {SIZING.decision}</span>
      </div>
      <button
        type="button"
        onClick={affirm}
        disabled={saveState === "saving"}
        className="tabular text-caos-xs px-2 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring disabled:opacity-50 caos-target"
      >
        {saveState === "saved" ? "Affirmed" : "Affirm"}
      </button>
      <button
        type="button"
        onClick={() => onRevise("CP-6A")}
        className="tabular text-caos-xs px-2 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring caos-target"
      >
        Revise
      </button>
      <span
        className="tabular text-caos-3xs text-caos-muted whitespace-nowrap hidden lg:inline"
        title="Affirm/Revise write a personal note to your own workspace settings — there is no server-side CP-6 write path, so this never changes the committee record."
      >
        personal annotation, not a governance action
      </span>
    </div>
  );
}
