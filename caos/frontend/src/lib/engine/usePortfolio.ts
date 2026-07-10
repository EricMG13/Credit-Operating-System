// Read-only hook: load the cross-issuer portfolio board (each issuer's latest
// complete run, rolled up by GET /api/portfolio). Side-effect-free, fetched once
// on mount; on no backend / any error it returns covered=0 with empty rows, so
// the Command Center keeps its seeded sample board ("prefer live, static
// fallback", same contract as useLiveRun / useModelEngine).

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
}

const EMPTY: PortfolioState = {
  rows: [], issuerCount: 0, coveredCount: 0, live: false, loading: false, error: false,
};

export function usePortfolio(): PortfolioState {
  const [state, setState] = useState<PortfolioState>({ ...EMPTY, loading: true });

  useEffect(() => {
    let alive = true;
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
        });
      })
      .catch((err) => {
        // no backend → fall back to mock, but log + flag the phase so the
        // failure is distinguishable from genuine no-data (M-6).
        console.warn("usePortfolio: getPortfolio failed, falling back to static board", err);
        if (alive) setState({ ...EMPTY, error: true });
      });
    return () => { alive = false; };
  }, []);

  return state;
}
