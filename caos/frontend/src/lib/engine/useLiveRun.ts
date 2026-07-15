// Read-only hook: load the latest COMPLETE run for an issuer and adapt its
// module payloads into the {kpis, sections} shape the deep-dive renderer uses.
// Deliberately side-effect-free (never creates a run) and fully guarded — on no
// run, no backend, or any error it returns empty, so the offline sim demo falls
// back to the seeded constants unchanged ("prefer live, static fallback").

import { getModules, getQA } from "@/lib/api";
import type { EvidenceDTO, FindingDTO } from "@/lib/engine/types";
import type { ModuleOutput } from "@/lib/deepdive/module-outputs";
import { adaptModule } from "./adapt";
import { useLatestRunStatus, type RunPhase } from "./useLatestRun";

// One run's own evidence, indexed by E-xx id, so the click-to-source modal can
// resolve a LIVE chip to the run's real source instead of the seeded demo map
// (which 404s for live ids → silent no-op, or worse collides on E-103 and shows
// another issuer's source as VERIFIED).
export interface LiveEvidence extends EvidenceDTO {
  module: string; // module_id that extracted it
  claim: string;  // the claim_text it supports
}

// Modules the engine persists and ModuleView renders live (every module except
// the four with bespoke tabs — CP-6A/6E debate, CP-3B recovery, CP-4 covenants —
// which have their own renderers). adaptModule turns each ModuleDetailDTO into the
// {kpis, sections} shape; a module absent from a given run is skipped (catch →
// static fallback), so this list is the *eligible* set, not a per-run guarantee.
// ponytail: fetches all eligible modules up-front on deep-dive open; if that gets
// heavy, fetch the active tab's module on demand instead.
// The bespoke modules (CP-6A/6E/3B/4) are included too: their live output drives
// the generic ModuleView for a non-reference issuer (page.tsx `useBespoke`), while
// the reference deal keeps the bespoke showcase renderers.
const LIVE_MODULES = [
  "CP-0", "CP-1", "CP-1A", "CP-1B", "CP-1C",
  "CP-2", "CP-2B", "CP-2C", "CP-2D", "CP-2E", "CP-2F", "CP-2G",
  "CP-3", "CP-3B", "CP-3C", "CP-3D", "CP-4", "CP-4D", "CP-4C",
  "CP-5", "CP-5B", "CP-6A", "CP-6E",
];

export interface LiveRunState {
  liveOuts: Record<string, ModuleOutput>;
  // Per-produced-module qa_status (Passed / Restricted / Blocked / Not Reviewed),
  // keyed by module_id. Carried alongside liveOuts because a *failed* module is
  // persisted as a real row with output — so presence in liveOuts can't tell a
  // failure from a pass. The deep-dive launcher reads this (via moduleLiveState)
  // to light a Blocked module as failed instead of a false green. Empty when no
  // live run exists.
  liveStatus: Record<string, string>;
  // The run's own evidence, by E-xx id (see LiveEvidence). Drives live
  // click-to-source; empty when no live run exists.
  liveEvidence: Record<string, LiveEvidence>;
  runId: string | null;
  /** Source observation time for decision-state disclosure. */
  asOf?: string | null;
  committeeStatus: string | null;
  // CP-5C semantic committee-review findings for this run (empty when the
  // council is disabled or no live run exists).
  council: FindingDTO[];
  loading: boolean;
  // Underlying listRuns/build load phase (see RunPhase in useLatestRun), so a
  // caller can tell a genuine backend *error* apart from a truly *empty*
  // coverage (none/in_flight) instead of both collapsing into the same
  // empty-looking state. Additive field — existing consumers that only
  // destructure liveOuts/liveEvidence/runId/etc. are unaffected.
  phase: RunPhase;
}

// The build/init/empty values threaded through useLatestRunStatus — everything
// but `phase`, which useLiveRun attaches afterward from the status envelope
// itself (the authoritative phase; see LiveRunState.phase above).
type LiveRunValue = Omit<LiveRunState, "phase">;

const EMPTY: LiveRunValue = {
  liveOuts: {}, liveStatus: {}, liveEvidence: {}, runId: null, asOf: null, committeeStatus: null,
  council: [], loading: false,
};

export function useLiveRun(issuerId: string, exactRunId?: string | null): LiveRunState {
  const status = useLatestRunStatus<LiveRunValue>(
    issuerId,
    { ...EMPTY, loading: true },
    EMPTY,
    async (latest) => {
      // One bulk request for every produced module (server joins claims/evidence in
      // three queries) instead of the old 21-request fan-out per deep-dive open.
      // LIVE_MODULES still scopes which ids the UI adapts; extras are ignored.
      const eligible = new Set(LIVE_MODULES);
      const all = await getModules(latest.id);
      const details = all.filter((d) => eligible.has(d.module_id));
      const liveOuts: Record<string, ModuleOutput> = {};
      const liveStatus: Record<string, string> = {};
      const liveEvidence: Record<string, LiveEvidence> = {};
      for (const detail of details) {
        liveOuts[detail.module_id] = adaptModule(detail);
        liveStatus[detail.module_id] = detail.qa_status;
        for (const c of detail.claims || []) {
          for (const ev of c.evidence) {
            liveEvidence[ev.evidence_id] = { ...ev, module: detail.module_id, claim: c.claim_text };
          }
        }
      }
      // Committee review from CP-5C's own persisted output (issue_log) — the typed
      // channel, so the panel no longer depends on the backend's finding_id string
      // format ("CP-5C-…", an untyped coupling a mint reformat would silently
      // break). Runs persisted before CP-5C outputs existed fall back to the old
      // QA-findings prefix filter.
      const cp5c = all.find((d) => d.module_id === "CP-5C");
      const log = (cp5c?.runtime_output as { issue_log?: unknown } | undefined)?.issue_log;
      let council: FindingDTO[];
      if (Array.isArray(log)) {
        council = (log as Array<Record<string, unknown>>).map((e) => ({
          finding_id: String(e.id ?? ""),
          severity: String(e.severity ?? "MINOR"),
          lane: typeof e.lane === "number" ? e.lane : null,
          module_id: typeof e.module === "string" ? e.module : null,
          description: String(e.finding ?? ""),
          affected_claim_id: typeof e.claim === "string" ? e.claim : null,
          required_remediation: null,
        }));
      } else {
        const qa = await getQA(latest.id);
        council = qa.findings.filter((f) => f.finding_id.startsWith("CP-5C-"));
      }
      return {
        liveOuts, liveStatus, liveEvidence, runId: latest.id, asOf: latest.as_of_date ?? latest.created_at, committeeStatus: latest.committee_status,
        council, loading: false,
      };
    },
    exactRunId,
  );
  // Thread the underlying load phase through so a caller can distinguish a
  // genuine backend error from no-coverage-yet (M-1/M-2 fix) — see RunPhase.
  return { ...status.value, phase: status.phase };
}
