// Read-only hook: load the latest COMPLETE run for an issuer and pull the CP-1
// LTM anchor the Model Builder grounds its grid in. Mirrors useLiveRun (same
// "prefer live, static fallback" contract) — side-effect-free, never creates a
// run, and on no run / no backend / any error returns {live:false, anchor:null}
// so the offline Model Builder falls back to its seeded constants unchanged.

import { getModule } from "@/lib/api";
import { cp1ToAnchor, type ModelAnchor } from "./modelAnchor";
import { cp2bToDownside, type DownsidePathway } from "./downsidePathway";
import { useLatestRun } from "./useLatestRun";

export interface ModelEngineState {
  anchor: ModelAnchor | null;
  downside: DownsidePathway | null; // CP-2B first-order EBITDA-shock fragility, if the run produced it
  runId: string | null;
  committeeStatus: string | null;
  live: boolean;
  loading: boolean;
}

const EMPTY: ModelEngineState = {
  anchor: null, downside: null, runId: null, committeeStatus: null, live: false, loading: false,
};

export function useModelEngine(issuerId: string): ModelEngineState {
  return useLatestRun<ModelEngineState>(issuerId, { ...EMPTY, loading: true }, EMPTY, async (latest) => {
    // CP-1 drives the anchor (primary); CP-2B is a bonus readout — guard its
    // fetch so a Blocked/absent CP-2B never rejects the pair and drops the anchor.
    const [cp1, cp2b] = await Promise.all([
      getModule(latest.id, "CP-1"),
      getModule(latest.id, "CP-2B").catch(() => null),
    ]);
    const anchor = cp1ToAnchor(cp1);
    return {
      anchor,
      downside: cp2b ? cp2bToDownside(cp2b) : null,
      runId: latest.id,
      committeeStatus: latest.committee_status,
      live: anchor != null, // a run with no usable CP-1 anchor still falls back
      loading: false,
    };
  });
}
