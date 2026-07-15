"use client";

import { useDigest } from "@/lib/engine/useDigest";
import type { usePortfolio } from "@/lib/engine/usePortfolio";
import { liveGaps } from "./gaps";
import { liveMixedOrigin } from "./mixedOrigin";
import { liveFailedGates, liveQaItems } from "./qa";

export function useGovernanceSources(portfolio: ReturnType<typeof usePortfolio>) {
  const digestState = useDigest();
  if (!portfolio.live) {
    return {
      ...digestState,
      liveQa: undefined,
      liveFailed: undefined,
      liveGapsItems: undefined,
      liveMixed: undefined,
    };
  }
  return {
    ...digestState,
    liveQa: liveQaItems(portfolio.rows),
    liveFailed: liveFailedGates(portfolio.rows),
    liveGapsItems: liveGaps(portfolio.rows),
    liveMixed: liveMixedOrigin(portfolio.rows),
  };
}
