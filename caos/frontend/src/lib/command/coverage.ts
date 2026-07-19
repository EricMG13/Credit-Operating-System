// Command Center · research-lens coverage helpers. Pure (no React), so the
// CoverageMatrix and its unit test share one source of truth for status
// ordering, the seeded↔engine boundary, and the honest roll-up of a real run
// into per-layer cell states.

import { ATLF_REFERENCE_ISSUER_ID, type RunSummaryDTO } from "@/lib/engine/types";
import { isCleared } from "@/lib/pipeline/sev";

export const COVERAGE_LAYERS = ["L1", "L2", "L3", "L4", "L5", "L6"] as const;
export type CoverageLayer = (typeof COVERAGE_LAYERS)[number];

// The five seeded cell states. `fresh | aging | stale` is a SEQUENTIAL freshness
// ramp (green → amber → red fill); `running | blocked` are CATEGORICAL process
// states, rendered with a glyph rather than another red fill so `blocked` never
// reads as merely "more stale".
export type CoverageStatus = "fresh" | "aging" | "stale" | "running" | "blocked";

// Worst-first ordering (lower = needs attention sooner) — drives staleness sort
// and the row's worst-cell roll-up. Mirrors the GapsList severity-rank pattern.
export const STATUS_RANK: Record<string, number> = {
  blocked: 0, stale: 1, running: 2, aging: 3, fresh: 4,
};

/** The worst (most attention-needing) status across a row's layer cells. */
export function worstStatus(cells: Record<string, string>): string {
  let worst = "fresh";
  for (const s of Object.values(cells)) {
    if ((STATUS_RANK[s] ?? 9) < (STATUS_RANK[worst] ?? 9)) worst = s;
  }
  return worst;
}

// Which run modules make up each visible matrix layer — hand-mirrored from the
// backend registry (caos/server/engine/registry.py) module→layer assignments.
// L5 has no routed modules: it is the QA phase, so its cell rolls up from the
// run's own qa_status (handled in rollupRunToCells).
// ponytail: hand-mirrored map with a known ceiling — if the registry's layer
// assignments churn this drifts silently. The upgrade path is exposing `layer`
// on the /api/runs ModuleStatus payload and reading it here; cheap enough to
// hand-maintain for the 6 visible layers today.
export const MODULE_LAYER: Record<string, CoverageLayer> = {
  "CP-1": "L1", "CP-1A": "L1", "CP-1B": "L1", "CP-1C": "L1",
  "CP-2": "L2", "CP-2B": "L2", "CP-2C": "L2", "CP-2D": "L2", "CP-2E": "L2", "CP-2F": "L2",
  "CP-3": "L3", "CP-3B": "L3", "CP-3C": "L3", "CP-3D": "L3",
  "CP-4": "L4", "CP-4C": "L4",
  "CP-6A": "L6", "CP-6E": "L6",
};

// Matrix issuer code → real backend issuer UUID. Only issuers with a real
// engine-backed run can be RE-RUN; every other row is a seeded sample.
// ponytail: ATLF (the seeded reference deal) is the only engine-backed issuer in
// Phase-1. Resolve the rest through the issuers API once they become real.
export const RUNNABLE_ISSUERS: Record<string, string> = {
  ATLF: ATLF_REFERENCE_ISSUER_ID,
};

/** Real backend issuer id for a matrix code, or null when the row is seeded-only. */
export const runnableIssuerId = (code: string): string | null =>
  RUNNABLE_ISSUERS[code] ?? null;

// The one engine-backed reference deal (Atlas Forge Industrials). It is NOT one
// of the demo-sleeve positions in the coverage matrix (tickers like AAWW/ACOM),
// so the matrix prepends it explicitly — otherwise no row would be runnable and
// the whole RE-RUN path is unreachable. Cells are a seeded starting point; a
// completed real run overwrites the touched layers via rollupRunToCells.
export const ATLF_COVERAGE_ROW: { code: string; id: string; cells: Record<string, string> } = {
  code: "ATLF",
  id: "ATLF",
  cells: { L1: "fresh", L2: "aging", L3: "fresh", L4: "stale", L5: "aging", L6: "fresh" },
};

interface LayerCoverage {
  total: number;
  cleared: number;
}

const layerCoverage = (run: RunSummaryDTO): Partial<Record<CoverageLayer, LayerCoverage>> => {
  const byLayer: Partial<Record<CoverageLayer, LayerCoverage>> = {};
  for (const moduleStatus of run.modules || []) {
    const layer = MODULE_LAYER[moduleStatus.module_id];
    if (!layer) continue;
    const bucket = (byLayer[layer] ??= { total: 0, cleared: 0 });
    bucket.total += 1;
    if (isCleared(moduleStatus.qa_status)) bucket.cleared += 1;
  }
  return byLayer;
};

const coverageStatus = (coverage: LayerCoverage): CoverageStatus => {
  if (coverage.cleared === coverage.total) return "fresh";
  return coverage.cleared === 0 ? "blocked" : "aging";
};

const populatedLayerStatuses = (
  byLayer: Partial<Record<CoverageLayer, LayerCoverage>>,
): Partial<Record<CoverageLayer, CoverageStatus>> => {
  const statuses: Partial<Record<CoverageLayer, CoverageStatus>> = {};
  for (const layer of COVERAGE_LAYERS) {
    if (layer === "L5") continue;
    const coverage = byLayer[layer];
    if (coverage?.total) statuses[layer] = coverageStatus(coverage);
  }
  return statuses;
};

// Roll a COMPLETED real run up into per-layer cell statuses — the honest
// replacement for the old "set every layer fresh" fake. Only layers whose
// modules actually ran are returned; layers the run didn't touch are omitted so
// the caller LEAVES the seeded cell rather than fabricating freshness.
//   all of a layer's modules cleared (pass/warning) → fresh
//   some cleared                                    → aging
//   none cleared                                    → blocked
// L5 (the QA gate for the whole run) rolls up from run.qa_status.
export function rollupRunToCells(
  run: RunSummaryDTO,
): Partial<Record<CoverageLayer, CoverageStatus>> {
  const out = populatedLayerStatuses(layerCoverage(run));
  if (run.qa_status) out.L5 = isCleared(run.qa_status) ? "fresh" : "blocked";
  return out;
}
