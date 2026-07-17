// The initial analyst load requests a stale/missing refresh through the guarded
// POST, then polls with read-only GET only while the server reports `refreshing`
// (a cycle is actively
// running) — never on a fixed interval forever, so Command + Monitor open
// together don't double-poll a settled draft (the server single-flights the
// enqueue regardless, but a polite client still shouldn't hammer it).
//
// Distinguishes two states an autonomy consumer must never conflate
// (mock-vs-live seam): OFFLINE (the endpoint itself is unreachable — network
// error, 5xx after retries never happen here since the route is fault-
// isolated and always returns 200, so `error` really means "couldn't reach
// the server at all") vs EMPTY-LIVE (the endpoint answered, the draft is
// simply empty — first cycle still running, or genuinely nothing to report).
// Callers must show a DEMO fallback only for the former, and an honest "no
// changes yet" for the latter — never render one as the other.

import { useEffect, useRef, useState } from "react";
import { getAutonomyDraft, type AutonomyDraft } from "@/lib/api";

export interface AutonomyDraftState {
  draft: AutonomyDraft | null;
  /** True once at least one fetch has resolved (success or failure). */
  loading: boolean;
  /** The endpoint itself was unreachable — distinct from an empty-but-live draft. */
  offline: boolean;
}

const POLL_MS = 4000;

export function useAutonomyDraft(): AutonomyDraftState {
  const [state, setState] = useState<AutonomyDraftState>({ draft: null, loading: true, offline: false });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    const load = (refresh = false) => {
      // A read-only viewer cannot initiate a refresh. Fall back to GET so the
      // latest available draft remains visible without treating 403 as offline.
      const request = refresh
        ? getAutonomyDraft(true).catch(() => getAutonomyDraft())
        : getAutonomyDraft();
      request
        .then((d) => {
          if (!alive) return;
          setState({ draft: d, loading: false, offline: false });
          if (timerRef.current) clearTimeout(timerRef.current);
          if (d.refreshing) {
            timerRef.current = setTimeout(() => load(false), POLL_MS);
          }
        })
        .catch((err) => {
          if (!alive) return;
          console.warn("useAutonomyDraft: getAutonomyDraft failed — endpoint unreachable", err);
          setState({ draft: null, loading: false, offline: true });
        });
    };
    load(true);
    return () => {
      alive = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return state;
}
