// Shared "latest complete run" loader behind useLiveRun / useModelEngine /
// useLivePipeline. Loads the latest COMPLETE run for an issuer, builds T from it,
// and on no run / no backend / any error returns `empty` — the "prefer live,
// static fallback" contract every live hook shares. Side-effect-free (never
// creates a run) and cancel-safe (a stale issuerId can't clobber a newer load).

import { useEffect, useState } from "react";
import { getRun, listRuns } from "@/lib/api";
import type { RunListItemDTO } from "@/lib/engine/types";

// Load phase, so a caller (e.g. the Pipeline page) can tell a genuine *error*
// from a run that is still *in flight* from a truly *empty* coverage — instead
// of collapsing all three into the static demo fallback ("fail open").
//   loading   — the listRuns round-trip is in flight (first paint).
//   error     — listRuns threw (no backend / network / 5xx).
//   none      — backend reachable, but the issuer has no runs at all.
//   in_flight — runs exist but none is complete (queued / running / failed).
//   complete  — a complete run was found and `build` resolved against it.
export type RunPhase = "loading" | "error" | "none" | "in_flight" | "complete";

export interface LatestRunStatus<T> {
  value: T;
  phase: RunPhase;
  // The latest run record (any status) when one exists — lets a caller surface
  // "RUN #… failed" / "running" detail without a second fetch. Null until known.
  latest: RunListItemDTO | null;
}

// Shared status-aware loader that also reports the phase and latest run record.
export function useLatestRunStatus<T>(
  issuerId: string,
  initial: T,
  empty: T,
  build: (latest: RunListItemDTO) => Promise<T>,
  exactRunId?: string | null,
): LatestRunStatus<T> {
  const [state, setState] = useState<LatestRunStatus<T>>({
    value: initial, phase: "loading", latest: null,
  });

  useEffect(() => {
    let cancelled = false;
    // Reset to the loading sentinel synchronously on issuerId change, so the PRIOR
    // issuer's resolved run (badge / module output / vault export) can't show under
    // the new issuer's chrome during the listRuns round-trip. (review run-2 #FR1)
    setState({ value: initial, phase: "loading", latest: null });
    (async () => {
      try {
        const runs: RunListItemDTO[] = exactRunId
          ? [await getRun(exactRunId).then((run) => {
              if (run.issuer_id !== issuerId) throw new Error("Run issuer mismatch");
              return { ...run, created_at: null };
            })]
          : await listRuns(issuerId);
        const complete = runs.find((r) => r.status === "complete");
        if (!complete) {
          // Latest run record by created_at, regardless of status, so the caller
          // can distinguish "in flight / failed" from "no runs at all".
          const latest = runs.length
            ? runs.reduce((a, b) => ((b.created_at ?? "") > (a.created_at ?? "") ? b : a))
            : null;
          if (!cancelled) setState({ value: empty, phase: latest ? "in_flight" : "none", latest });
          return;
        }
        const next = await build(complete);
        if (!cancelled) setState({ value: next, phase: "complete", latest: complete });
      } catch {
        // no backend / network error — surface as an error phase (not a silent
        // fallback) so the caller can choose to show an error state, not a demo.
        if (!cancelled) setState({ value: empty, phase: "error", latest: null });
      }
    })();
    return () => {
      cancelled = true;
    };
    // build/empty are recreated each render by callers; issuer/run identity are
    // the only real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exactRunId, issuerId]);

  return state;
}
