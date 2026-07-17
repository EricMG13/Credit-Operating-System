"use client";

import { useEffect, useState } from "react";
import { api, toErrorMessage } from "@/lib/api";

export interface LatestQaFindingDTO {
  id: string;
  finding_id: string;
  run_id: string;
  issuer_id: string;
  issuer: string;
  ticker: string | null;
  module_id: string | null;
  severity: "CRITICAL" | "MATERIAL" | "MINOR" | string;
  lane: number | null;
  description: string;
  affected_claim_id: string | null;
  required_remediation: string | null;
  as_of: string | null;
}

export interface QaFindingsState {
  findings: LatestQaFindingDTO[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
}

const EMPTY: QaFindingsState = { findings: [], loading: false, error: null, loaded: false };
const REFRESH_MS = 60_000;

export function useQaFindings(enabled: boolean): QaFindingsState {
  const [state, setState] = useState<QaFindingsState>(enabled ? { ...EMPTY, loading: true } : EMPTY);

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY);
      return;
    }
    let alive = true;
    const load = () => {
      api.get<LatestQaFindingDTO[]>("/api/qa/findings")
        .then((response) => {
          if (alive) setState({ findings: response.data, loading: false, error: null, loaded: true });
        })
        .catch((reason) => {
          if (!alive) return;
          setState((previous) => ({
            findings: previous.findings,
            loading: false,
            error: toErrorMessage(reason, "Live CP-5 findings unavailable."),
            loaded: true,
          }));
        });
    };
    load();
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      clearInterval(tick);
      window.removeEventListener("focus", load);
    };
  }, [enabled]);

  // `enabled` turns true only after the portfolio request resolves. Without
  // this derived first-load guard, one render could mark the exact queue ready
  // and briefly show coarse gate roll-ups before this effect starts its fetch.
  return enabled && !state.loaded ? { ...state, loading: true } : state;
}
