// Read-only hook: load the latest COMPLETE run for an issuer and adapt its
// module payloads into the {kpis, sections} shape the deep-dive renderer uses.
// Deliberately side-effect-free (never creates a run) and fully guarded — on no
// run, no backend, or any error it returns empty, so the offline sim demo falls
// back to the seeded constants unchanged ("prefer live, static fallback").

import { useEffect, useState } from "react";
import { getModule, listRuns } from "@/lib/api";
import type { ModuleOutput } from "@/lib/deepdive/module-outputs";
import { adaptModule } from "./adapt";

// Modules the engine produces live today (the Tier-1 slice + QA auditors).
const LIVE_MODULES = ["CP-0", "CP-1", "CP-5", "CP-5B"];

export interface LiveRunState {
  liveOuts: Record<string, ModuleOutput>;
  runId: string | null;
  committeeStatus: string | null;
  loading: boolean;
}

const EMPTY: LiveRunState = { liveOuts: {}, runId: null, committeeStatus: null, loading: false };

export function useLiveRun(issuerId: string): LiveRunState {
  const [state, setState] = useState<LiveRunState>({ ...EMPTY, loading: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const runs = await listRuns(issuerId);
        const latest = runs.find((r) => r.status === "complete");
        if (!latest) {
          if (!cancelled) setState(EMPTY);
          return;
        }
        const entries = await Promise.all(
          LIVE_MODULES.map(async (m) => {
            try {
              return [m, adaptModule(await getModule(latest.id, m))] as const;
            } catch {
              return null; // module not in this run — skip, fall back to static
            }
          }),
        );
        const liveOuts: Record<string, ModuleOutput> = {};
        for (const e of entries) if (e) liveOuts[e[0]] = e[1];
        if (!cancelled) {
          setState({ liveOuts, runId: latest.id, committeeStatus: latest.committee_status, loading: false });
        }
      } catch {
        if (!cancelled) setState(EMPTY); // no backend / network error → static fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [issuerId]);

  return state;
}
