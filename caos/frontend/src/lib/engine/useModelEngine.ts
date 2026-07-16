// Read-only hook: load the latest COMPLETE run for an issuer and pull the CP-1
// LTM anchor the Model Builder grounds its grid in. Mirrors useLiveRun (same
// "prefer live, static fallback" contract) — side-effect-free, never creates a
// run, and on no run / no backend / any error returns {live:false, anchor:null}
// so the offline Model Builder falls back to its seeded constants unchanged.

import axios from "axios";
import { getModule } from "@/lib/api";
import { cp1ToAnchor, type ModelAnchor } from "./modelAnchor";
import { cp2bToDownside, type DownsidePathway } from "./downsidePathway";
import { useLatestRunStatus, type RunPhase } from "./useLatestRun";

export interface ModelEngineState {
  anchor: ModelAnchor | null;
  downside: DownsidePathway | null; // CP-2B first-order EBITDA-shock fragility, if the run produced it
  downsideState: "ready" | "unavailable" | "error";
  runId: string | null;
  /** Source observation time for decision-state disclosure. */
  asOf?: string | null;
  committeeStatus: string | null;
  live: boolean;
  loading: boolean;
  // M-4 fix: additive — a genuine backend error (listRuns/getModule threw)
  // used to collapse into the exact same {anchor:null, live:false} shape as a
  // truly empty issuer (no runs at all). `phase` lets a caller (e.g. an error
  // banner) tell them apart; existing consumers reading anchor/loading/runId/
  // live/committeeStatus/downside are unaffected.
  phase: RunPhase;
}

// The part of ModelEngineState the run `build` callback produces once a
// complete run resolves — `loading`/`phase` are derived from the loader's
// status, not threaded through the value itself.
interface ModelEngineValue {
  anchor: ModelAnchor | null;
  downside: DownsidePathway | null;
  downsideState: "ready" | "unavailable" | "error";
  runId: string | null;
  asOf?: string | null;
  committeeStatus: string | null;
  live: boolean;
}

const EMPTY_VALUE: ModelEngineValue = {
  anchor: null, downside: null, downsideState: "unavailable", runId: null, committeeStatus: null, live: false,
};

async function getOptionalModule(runId: string, moduleId: string) {
  try {
    return { value: await getModule(runId, moduleId), state: "ready" as const };
  } catch (reason) {
    if (axios.isAxiosError(reason) && reason.response?.status === 404) {
      return { value: null, state: "unavailable" as const };
    }
    // CP-2B is an optional readout: its transport failure must not discard a
    // valid CP-1 anchor, but it also must not masquerade as an observed empty.
    return { value: null, state: "error" as const };
  }
}

export function useModelEngine(issuerId: string): ModelEngineState {
  const status = useLatestRunStatus<ModelEngineValue>(
    issuerId,
    EMPTY_VALUE,
    EMPTY_VALUE,
    async (latest) => {
      // CP-1 drives the anchor (primary); CP-2B is a bonus readout — guard its
      // fetch so a Blocked/absent CP-2B never rejects the pair and drops the anchor.
      const [cp1, cp2bRead] = await Promise.all([
        getModule(latest.id, "CP-1"),
        getOptionalModule(latest.id, "CP-2B"),
      ]);
      const anchor = cp1ToAnchor(cp1);
      const downside = cp2bRead.value ? cp2bToDownside(cp2bRead.value) : null;
      return {
        anchor,
        downside,
        downsideState: cp2bRead.state === "error" ? "error" : downside ? "ready" : "unavailable",
        runId: latest.id,
        asOf: latest.as_of_date ?? latest.created_at,
        committeeStatus: latest.committee_status,
        live: anchor != null, // a run with no usable CP-1 anchor still falls back
      };
    },
  );

  return {
    ...status.value,
    loading: status.phase === "loading",
    phase: status.phase,
  };
}
