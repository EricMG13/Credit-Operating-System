// Read-only hook: load the latest COMPLETE run for an issuer and adapt its
// module payloads into the {kpis, sections} shape the deep-dive renderer uses.
// Deliberately side-effect-free (never creates a run) and fully guarded — on no
// run, no backend, or any error it returns empty, so the offline sim demo falls
// back to the seeded constants unchanged ("prefer live, static fallback").

import { getModule, getQA } from "@/lib/api";
import type { EvidenceDTO, FindingDTO } from "@/lib/engine/types";
import type { ModuleOutput } from "@/lib/deepdive/module-outputs";
import { adaptModule } from "./adapt";
import { useLatestRun } from "./useLatestRun";

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
  "CP-2", "CP-2B", "CP-2C", "CP-2D", "CP-2E", "CP-2F",
  "CP-3", "CP-3B", "CP-3C", "CP-3D", "CP-4", "CP-4C",
  "CP-5", "CP-5B", "CP-6A", "CP-6E",
];

export interface LiveRunState {
  liveOuts: Record<string, ModuleOutput>;
  // The run's own evidence, by E-xx id (see LiveEvidence). Drives live
  // click-to-source; empty when no live run exists.
  liveEvidence: Record<string, LiveEvidence>;
  runId: string | null;
  committeeStatus: string | null;
  // CP-5C semantic committee-review findings for this run (empty when the
  // council is disabled or no live run exists).
  council: FindingDTO[];
  loading: boolean;
}

const EMPTY: LiveRunState = {
  liveOuts: {}, liveEvidence: {}, runId: null, committeeStatus: null,
  council: [], loading: false,
};

export function useLiveRun(issuerId: string): LiveRunState {
  return useLatestRun<LiveRunState>(issuerId, { ...EMPTY, loading: true }, EMPTY, async (latest) => {
    const entries = await Promise.all(
      LIVE_MODULES.map(async (m) => {
        try {
          const detail = await getModule(latest.id, m);
          return [m, adaptModule(detail), detail] as const;
        } catch {
          return null; // module not in this run — skip, fall back to static
        }
      }),
    );
    const liveOuts: Record<string, ModuleOutput> = {};
    const liveEvidence: Record<string, LiveEvidence> = {};
    for (const e of entries) {
      if (!e) continue;
      liveOuts[e[0]] = e[1];
      for (const c of e[2].claims || []) {
        for (const ev of c.evidence) {
          liveEvidence[ev.evidence_id] = { ...ev, module: e[2].module_id, claim: c.claim_text };
        }
      }
    }
    // CP-5C committee review is persisted as QA findings; pull the subset.
    const qa = await getQA(latest.id).catch(() => null);
    const council = qa ? qa.findings.filter((f) => f.finding_id.startsWith("CP-5C-")) : [];
    return {
      liveOuts, liveEvidence, runId: latest.id, committeeStatus: latest.committee_status,
      council, loading: false,
    };
  });
}
