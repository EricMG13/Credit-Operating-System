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

export interface PortfolioState {
  rows: PortfolioRowDTO[];
  issuerCount: number;
  coveredCount: number;
  live: boolean;     // at least one issuer has a completed run
  loading: boolean;
  fetchedAt: Date | null;  // when this snapshot was taken (as-of for the LIVE badge)
}

const EMPTY: PortfolioState = {
  rows: [], issuerCount: 0, coveredCount: 0, live: false, loading: false, fetchedAt: null,
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
            fetchedAt: new Date(),
          });
        })
        // No backend → fall back to the sample board. Keep the last good rows on
        // a transient refresh failure (only the very first failure empties).
        .catch(() => {
          if (!alive) return;
          setState((prev) => (prev.fetchedAt ? { ...prev, loading: false } : { ...EMPTY }));
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
