// Read-only hook: load the latest COMPLETE run for an issuer and pull the CP-1
// LTM anchor the Model Builder grounds its grid in. Mirrors useLiveRun (same
// "prefer live, static fallback" contract) — side-effect-free, never creates a
// run, and on no run / no backend / any error returns {live:false, anchor:null}
// so the offline Model Builder falls back to its seeded constants unchanged.

import { getModule } from "@/lib/api";
import { cp1ToAnchor, type ModelAnchor } from "./modelAnchor";
import { useLatestRun } from "./useLatestRun";

export interface ModelEngineState {
  anchor: ModelAnchor | null;
  runId: string | null;
  committeeStatus: string | null;
  live: boolean;
  loading: boolean;
}

const EMPTY: ModelEngineState = {
  anchor: null, runId: null, committeeStatus: null, live: false, loading: false,
};

export function useModelEngine(issuerId: string): ModelEngineState {
  return useLatestRun<ModelEngineState>(issuerId, { ...EMPTY, loading: true }, EMPTY, async (latest) => {
    const anchor = cp1ToAnchor(await getModule(latest.id, "CP-1"));
    return {
      anchor,
      runId: latest.id,
      committeeStatus: latest.committee_status,
      live: anchor != null, // a run with no usable CP-1 anchor still falls back
      loading: false,
    };
  });
}
