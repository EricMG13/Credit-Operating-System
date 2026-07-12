"use client";

// Read-only hook: load the latest COMPLETE run for an issuer and adapt the CP-X
// route plan + per-module statuses into the same {sim, plan, scope} shape the
// Pipeline views already render. Side-effect-free and fully guarded — on no run,
// no backend, or any error it returns null, so the page falls back to the
// offline sim demo unchanged ("prefer live, static fallback", same contract as
// useLiveRun).

import { getModule, getRun } from "@/lib/api";
import type { ModuleDetailDTO, ModuleStatusDTO, RunSummaryDTO } from "@/lib/engine/types";
import { useLatestRunStatus, type LatestRunStatus } from "@/lib/engine/useLatestRun";
import { MODULES, type PlanStep, type SimOutcome } from "./data";
import type { Sim, SimEvent } from "./sim-engine";

export interface LivePipeline {
  runId: string;
  gateStatus: string; // CP-X route-plan gate status (Full Run / Ready with Limitations / Blocked)
  committeeStatus: string; // run-level QA verdict (Committee Ready / Restricted / Blocked)
  summary: string; // CP-X one-line route summary
  sim: Sim;
  plan: PlanStep[]; // synthesized so the Inspector finds a per-module entry
  scope: Set<string>;
  completed: number;
  total: number;
}

// committee_status (preferred) → graph node state. A run is terminal, so nothing
// is "running"; idle is reserved for nodes the run never produced.
export function liveOutcome(m: ModuleStatusDTO): SimOutcome {
  switch (m.committee_status) {
    case "Committee Ready":
      return "pass";
    case "Blocked":
      return "blocked";
    case "Restricted":
    case "Draft Only":
    case "Insufficient Information":
      return "warning";
    default:
      // Fail closed: an unknown/missing committee_status must NOT read green
      // "pass" on a clearance tool. A Blocked QA verdict is the harder signal;
      // otherwise degrade to a non-pass "warning" (flagged, not cleared-green).
      return m.qa_status === "Blocked" ? "blocked" : "warning";
  }
}

interface RouteStep {
  module_id: string;
  depends_on?: string[];
}

// Pure transform (no I/O) so the mapping is unit-testable: a completed run + its
// CP-X route plan → the {sim, plan, scope} the Pipeline views already render.
export function buildLiveSnapshot(run: RunSummaryDTO, cpx: ModuleDetailDTO | null): LivePipeline {
  const statusById = new Map(run.modules.map((m) => [m.module_id, m]));
  const rt = (cpx?.runtime_output ?? {}) as {
    gate_status?: string;
    summary?: string;
    execution_sequence?: RouteStep[];
  };
  const depsById = new Map(
    (rt.execution_sequence ?? []).map((s) => [s.module_id, s.depends_on ?? []]),
  );

  // Node states: every graph node defaults idle, overridden by what the run
  // actually produced. Unproduced infra/export nodes stay idle.
  const mods: Sim["mods"] = {};
  for (const node of MODULES) {
    const m = statusById.get(node.id);
    mods[node.id] = { state: m ? liveOutcome(m) : "idle", prog: m ? 1 : 0 };
  }

  // Inspector reads plan.find(id) for per-module detail; synthesize one entry per
  // produced module, ordered by the route plan's execution order.
  const ordered = (rt.execution_sequence ?? []).map((s) => s.module_id)
    .filter((id) => statusById.has(id));
  for (const id of statusById.keys()) if (!ordered.includes(id)) ordered.push(id);

  const plan: PlanStep[] = ordered.map((id) => {
    const m = statusById.get(id)!;
    const outcome = liveOutcome(m);
    return {
      id,
      deps: (depsById.get(id) ?? []).filter((d) => statusById.has(d)),
      dur: 1,
      outcome,
      // committee_status collapses to the confidence label verbatim when gated
      // on Insufficient Information (server gate.py) — omit the redundant
      // repeat rather than stutter "Insufficient Information · Insufficient Information".
      event: `${id} ${m.module_name} — ${m.committee_status}` + (m.confidence !== m.committee_status ? ` · ${m.confidence}` : ""),
    };
  });

  const events: SimEvent[] = plan
    .filter((p) => p.event)
    .map((p) => ({ t: "", sev: p.outcome === "pass" ? "ok" : p.outcome, text: p.event }));

  const cleared = (s: string) => s === "pass" || s === "warning" || s === "held";
  return {
    runId: run.id,
    gateStatus: rt.gate_status ?? run.committee_status,
    committeeStatus: run.committee_status,
    summary: rt.summary ?? "",
    sim: { mods, events, tick: 0, done: true },
    plan,
    scope: new Set(statusById.keys()),
    completed: plan.filter((p) => cleared(p.outcome)).length,
    total: plan.length,
  };
}

const buildPipeline = async (latest: { id: string }): Promise<LivePipeline> => {
  const [run, cpx] = await Promise.all([
    getRun(latest.id),
    getModule(latest.id, "CP-X").catch(() => null),
  ]);
  return buildLiveSnapshot(run, cpx);
};

// Status-aware variant: same load, but also reports the load phase so the page
// can tell a genuine error / an in-flight run / no-coverage apart instead of
// collapsing all three to the offline demo ("fail open"). `value` is the live
// pipeline only on the `complete` phase, null otherwise.
export function useLivePipelineStatus(issuerId: string): LatestRunStatus<LivePipeline | null> {
  return useLatestRunStatus<LivePipeline | null>(issuerId, null, null, buildPipeline);
}
