// Read-only hook: load the daily digest (GET /api/digest/daily — coverage
// staleness, WARF over manual ratings, CCC-cliff watch, 24h run activity).
// Fetched once on mount; on no backend / any error it stays null so the
// Command Center keeps its seeded research panels ("prefer live, static
// fallback", same contract as usePortfolio / useLiveRun).

import { useEffect, useState } from "react";
import { getDigest, toErrorMessage, type DailyDigest } from "@/lib/api";

export interface DigestState {
  digest: DailyDigest | null;
  live: boolean; // registry has issuers → the digest is worth a panel
  loading: boolean;
  error: string | null;
}

export function useDigest(): DigestState {
  const [state, setState] = useState<DigestState>({ digest: null, live: false, loading: true, error: null });

  useEffect(() => {
    let alive = true;
    getDigest()
      .then((d) => {
        if (!alive) return;
        setState({ digest: d, live: (d.coverage?.issuers ?? 0) > 0, loading: false, error: null });
      })
      .catch((reason) => {
        if (alive) setState({
          digest: null,
          live: false,
          loading: false,
          error: toErrorMessage(reason, "Daily digest unavailable."),
        });
      });
    return () => { alive = false; };
  }, []);

  return state;
}
