// Read-only hook: load the cross-issuer portfolio board (each issuer's latest
// complete run, rolled up by GET /api/portfolio). On no backend / any error it
// returns covered=0 with empty rows, so the Command Center keeps its seeded
// sample board ("prefer live, static fallback", same contract as useLiveRun /
// useModelEngine).
//
// REFRESH SEMANTICS (audit 2026-07-10 FE-3): the board is labeled "● LIVE", so
// it must not be a mount-time snapshot — a run completing while the PM keeps
// the page open used to never appear without a manual reload. It now re-fetches
// on an interval (skipping hidden tabs) and on tab re-focus, and exposes
// `fetchedAt` so the panel can print an honest as-of time next to the badge.

import { useEffect, useState } from "react";
import { getPortfolio, type PortfolioRowDTO } from "@/lib/api";

// `error` is additive: a genuine fetch failure (no backend / network / 5xx)
// still resolves the same empty rows/covered=0 shape every existing consumer
// reads (fail-open to the static demo board), but callers that care can now
// tell "backend reachable, genuinely no coverage yet" apart from "the fetch
// itself failed" instead of both collapsing into indistinguishable EMPTY
// (M-6; same error-phase pattern as useLatestRunStatus's RunPhase).
export interface PortfolioState {
  rows: PortfolioRowDTO[];
  issuerCount: number;
  coveredCount: number;
  live: boolean;     // at least one issuer has a completed run
  loading: boolean;
  error: boolean;     // true when the last load attempt threw
  fetchedAt: Date | null;  // when this snapshot was taken (as-of for the LIVE badge)
}

const EMPTY: PortfolioState = {
  rows: [], issuerCount: 0, coveredCount: 0, live: false, loading: false,
  error: false, fetchedAt: null,
};

// One minute: fast enough that a completed run appears while the page is open,
// slow enough to be negligible load (one aggregate read per open dashboard).
const REFRESH_MS = 60_000;

export function usePortfolio(): PortfolioState {
  const [state, setState] = useState<PortfolioState>({ ...EMPTY, loading: true });

  useEffect(() => {
    let alive = true;
    const load = () => {
      getPortfolio()
        .then((d) => {
          if (!alive) return;
          setState({
            rows: d.rows,
            issuerCount: d.issuer_count,
            coveredCount: d.covered_count,
            live: d.covered_count > 0,
            loading: false,
            error: false,
            fetchedAt: new Date(),
          });
        })
        // no backend → fall back to mock, but log + flag the phase so the
        // failure is distinguishable from genuine no-data (M-6). Keep the last
        // good rows on a transient refresh failure — only the very first
        // failure empties (FE-3).
        .catch((err) => {
          if (!alive) return;
          console.warn("usePortfolio: getPortfolio failed, falling back to static board", err);
          setState((prev) =>
            prev.fetchedAt ? { ...prev, loading: false, error: true } : { ...EMPTY, error: true });
        });
    };
    load();
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(tick);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return state;
}
