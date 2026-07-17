"use client";

import { useDigest } from "@/lib/engine/useDigest";
import type { usePortfolio } from "@/lib/engine/usePortfolio";
import { useQaFindings } from "@/lib/engine/useQaFindings";
import { liveGaps } from "./gaps";
import { liveMixedOrigin } from "./mixedOrigin";
import { liveFailedGates, liveQaItems } from "./qa";

export function useGovernanceSources(portfolio: ReturnType<typeof usePortfolio>) {
  const digestState = useDigest();
  const findingsState = useQaFindings(portfolio.live);
  if (!portfolio.live) {
    // Two different "no live queues" states, never conflated (mock↔live seam
    // policy): a reachable backend with zero completed runs is an OBSERVED
    // empty — the queues exist and are genuinely clear-by-vacancy, so they
    // report as [] (renders as honest zeros + a "first run populates this"
    // affordance). A failed/loading portfolio read is UNKNOWN — undefined,
    // which consumers render as "Unavailable".
    const observedEmpty = !portfolio.loading && !portfolio.error;
    return {
      ...digestState,
      liveQa: observedEmpty ? [] : undefined,
      liveFailed: observedEmpty ? [] : undefined,
      liveGapsItems: observedEmpty ? [] : undefined,
      liveMixed: observedEmpty ? [] : undefined,
      qaFindingsLoading: false,
      qaFindingsError: null,
    };
  }
  return {
    ...digestState,
    liveQa: liveQaItems(portfolio.rows, findingsState.findings),
    liveFailed: liveFailedGates(portfolio.rows),
    liveGapsItems: liveGaps(portfolio.rows),
    liveMixed: liveMixedOrigin(portfolio.rows),
    qaFindingsLoading: findingsState.loading,
    qaFindingsError: findingsState.error,
  };
}
