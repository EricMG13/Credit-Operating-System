// Read-only hook: load the cross-issuer portfolio board (each issuer's latest
// complete run, rolled up by GET /api/portfolio). Side-effect-free, fetched once
// on mount; on no backend / any error it returns covered=0 with empty rows, so
// the Command Center keeps its seeded sample board ("prefer live, static
// fallback", same contract as useLiveRun / useModelEngine).

import { useEffect, useState } from "react";
import { getPortfolio, type PortfolioRowDTO } from "@/lib/api";

export interface PortfolioState {
  rows: PortfolioRowDTO[];
  issuerCount: number;
  coveredCount: number;
  live: boolean;     // at least one issuer has a completed run
  loading: boolean;
}

const EMPTY: PortfolioState = {
  rows: [], issuerCount: 0, coveredCount: 0, live: false, loading: false,
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
        });
      })
      .catch(() => { if (alive) setState(EMPTY); }); // no backend → fall back to mock
    return () => { alive = false; };
  }, []);

  return state;
}
