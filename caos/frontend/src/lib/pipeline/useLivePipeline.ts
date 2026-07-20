"use client";

// Read-only hook: load the latest COMPLETE run for an issuer and adapt the CP-X
// route plan + per-module statuses into the same {sim, plan, scope} shape the
// Pipeline views already render. Side-effect-free and fully guarded — on no run,
// no backend, or any error it returns null, so the page falls back to the
// offline sim demo unchanged ("prefer live, static fallback", same contract as
// useLiveRun).

import axios from "axios";
import { getModule, getRun } from "@/lib/api";
import type { ModuleDetailDTO, ModuleStatusDTO, RunSummaryDTO } from "@/lib/engine/types";
import { useEffect, useState } from "react";
import { useLatestRunStatus, type LatestRunStatus } from "@/lib/engine/useLatestRun";
import type { PlanStep, SimOutcome } from "./data";
import { MODULES } from "./topology";
import type { Sim, SimEvent } from "./sim-engine";

export interface LivePipeline {
  runId: string;
  /** Persisted lifecycle state. Running/queued rows are a partial snapshot, not a terminal run. */
  status: string;
  gateStatus: string; // CP-X route-plan gate status (Full Run / Ready with Limitations / Blocked)
  committeeStatus: string; // run-level QA verdict (Committee Ready / Restricted / Blocked)
  summary: string; // CP-X one-line route summary
  sim: Sim;
  plan: PlanStep[]; // synthesized so the Inspector finds a per-module entry
  scope: Set<string>;
  completed: number;
  total: number;
  /** Produced rows include terminal blocked outputs; this is distinct from clearance. */
  produced: number;
  pending: number;
  /** Only reasons read from the persisted module output are exposed here. */
  blocked: Array<{ moduleId: string; reason: string | null }>;
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

interface RouteRuntime {
  gate_status?: string;
  summary?: string;
  execution_sequence?: RouteStep[];
}

const routeRuntime = (cpx: ModuleDetailDTO | null): RouteRuntime =>
  (cpx?.runtime_output ?? {}) as RouteRuntime;

const blockedReasons = (details: readonly ModuleDetailDTO[]) => new Map(
  details.map((detail) => {
    const runtime = detail.runtime_output ?? {};
    const runtimeReason = typeof runtime.blocked_reason === "string" ? runtime.blocked_reason : null;
    const limitationReason = detail.limitation_flags.find(
      (flag) => typeof flag === "string" && flag.trim(),
    ) ?? null;
    return [detail.module_id, runtimeReason || limitationReason] as const;
  }),
);

const pipelineModules = (statusById: Map<string, ModuleStatusDTO>): Sim["mods"] => {
  const mods: Sim["mods"] = {};
  for (const node of MODULES) {
    const moduleStatus = statusById.get(node.id);
    mods[node.id] = { state: moduleStatus ? liveOutcome(moduleStatus) : "idle", prog: moduleStatus ? 1 : 0 };
  }
  return mods;
};

const orderedModuleIds = (
  steps: readonly RouteStep[],
  statusById: Map<string, ModuleStatusDTO>,
): string[] => {
  const ordered = steps.map((step) => step.module_id).filter((id) => statusById.has(id));
  for (const id of statusById.keys()) if (!ordered.includes(id)) ordered.push(id);
  return ordered;
};

const moduleEvent = (
  id: string,
  module: ModuleStatusDTO,
  blockedReason: string | null,
): string => `${id} ${module.module_name} — ${module.committee_status}`
  + (module.confidence !== module.committee_status ? ` · ${module.confidence}` : "")
  + (blockedReason ? ` · Blocked: ${blockedReason}` : "");

const pipelinePlan = (
  steps: readonly RouteStep[],
  statusById: Map<string, ModuleStatusDTO>,
  blockedReasonById: Map<string, string | null>,
): PlanStep[] => {
  const depsById = new Map(steps.map((step) => [step.module_id, step.depends_on ?? []]));
  return orderedModuleIds(steps, statusById).map((id) => {
    const moduleStatus = statusById.get(id)!;
    const outcome = liveOutcome(moduleStatus);
    const blockedReason = outcome === "blocked" ? blockedReasonById.get(id) ?? null : null;
    return {
      id,
      deps: (depsById.get(id) ?? []).filter((dependency) => statusById.has(dependency)),
      dur: 1,
      outcome,
      event: moduleEvent(id, moduleStatus, blockedReason),
    };
  });
};

const pipelineEvents = (plan: readonly PlanStep[]): SimEvent[] => plan
  .filter((step) => step.event)
  .map((step) => ({
    t: "",
    sev: step.outcome === "pass" ? "ok" : step.outcome,
    text: step.event,
  }));

const pipelineScope = (
  run: RunSummaryDTO,
  plannedIds: readonly string[],
  statusById: Map<string, ModuleStatusDTO>,
): Set<string> => run.status === "complete" || plannedIds.length === 0
  ? new Set(statusById.keys())
  : new Set(plannedIds);

const blockedModules = (
  modules: readonly ModuleStatusDTO[],
  blockedReasonById: Map<string, string | null>,
) => modules
  .filter((module) => liveOutcome(module) === "blocked")
  .map((module) => ({
    moduleId: module.module_id,
    reason: blockedReasonById.get(module.module_id) ?? null,
  }));

const isCompletedOutcome = (outcome: string): boolean =>
  outcome === "pass" || outcome === "warning" || outcome === "held";

// Pure transform (no I/O) so the mapping is unit-testable: a completed run + its
// CP-X route plan → the {sim, plan, scope} the Pipeline views already render.
export function buildLiveSnapshot(
  run: RunSummaryDTO,
  cpx: ModuleDetailDTO | null,
  details: readonly ModuleDetailDTO[] = [],
): LivePipeline {
  const statusById = new Map(run.modules.map((m) => [m.module_id, m]));
  const rt = routeRuntime(cpx);
  const steps = rt.execution_sequence ?? [];
  const plannedIds = steps.map((step) => step.module_id);
  const blockedReasonById = blockedReasons(details);

  // Node states: every graph node defaults idle, overridden by what the run
  // actually produced. Unproduced infra/export nodes stay idle.
  const mods = pipelineModules(statusById);

  // Inspector reads plan.find(id) for per-module detail; synthesize one entry per
  // produced module, ordered by the route plan's execution order.
  const plan = pipelinePlan(steps, statusById, blockedReasonById);
  const events = pipelineEvents(plan);
  const partialScope = pipelineScope(run, plannedIds, statusById);
  const blocked = blockedModules(run.modules, blockedReasonById);
  return {
    runId: run.id,
    status: run.status,
    gateStatus: rt.gate_status ?? run.committee_status,
    committeeStatus: run.committee_status,
    summary: rt.summary ?? "",
    // A partial read is static *evidence of what has persisted so far*; it is
    // never an animated client-side reconstruction of the missing work.
    sim: { mods, events, tick: 0, done: run.status === "complete" || run.status === "failed" },
    plan,
    scope: partialScope,
    completed: plan.filter((step) => isCompletedOutcome(step.outcome)).length,
    total: partialScope.size,
    produced: plan.length,
    pending: Array.from(partialScope).filter((moduleId) => !statusById.has(moduleId)).length,
    blocked,
  };
}

const optionalModule = async (runId: string, moduleId: string) => {
  try {
    return await getModule(runId, moduleId);
  } catch (reason) {
    if (axios.isAxiosError(reason) && reason.response?.status === 404) return null;
    throw reason;
  }
};

export const buildPipeline = async (latest: { id: string }): Promise<LivePipeline> => {
  const [run, cpx] = await Promise.all([
    getRun(latest.id),
    optionalModule(latest.id, "CP-X"),
  ]);
  return buildPipelineFromRun(run, cpx);
};

// Exact-run polling already has the complete RunSummaryDTO in hand. Reusing it
// avoids a second, potentially newer run read that can make the displayed
// partial snapshot disagree with the lifecycle state used to label it.
const buildPipelineFromRun = async (
  run: RunSummaryDTO,
  cpx?: ModuleDetailDTO | null,
): Promise<LivePipeline> => {
  const cpxLoad = cpx === undefined ? optionalModule(run.id, "CP-X") : Promise.resolve(cpx);
  const blockedDetails = await Promise.all(
    run.modules
      .filter((module) => liveOutcome(module) === "blocked")
      .map((module) => optionalModule(run.id, module.module_id)),
  );
  return buildLiveSnapshot(
    run,
    await cpxLoad,
    blockedDetails.filter((detail): detail is ModuleDetailDTO => detail !== null),
  );
};

// Status-aware variant: same load, but also reports the load phase so the page
// can tell a genuine error / an in-flight run / no-coverage apart instead of
// collapsing all three to the offline demo ("fail open"). `value` is the live
// pipeline only on the `complete` phase, null otherwise.
function useExactPipelineStatus(runId: string | null): LatestRunStatus<LivePipeline | null> {
  const [state, setState] = useState<LatestRunStatus<LivePipeline | null>>({
    value: null,
    phase: "loading",
    latest: null,
  });

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    let loading = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    setState({ value: null, phase: "loading", latest: null });

    const schedule = () => {
      if (cancelled || timer || document.visibilityState !== "visible") return;
      timer = setTimeout(() => {
        timer = null;
        void load();
      }, 2_000);
    };
    const load = async () => {
      if (cancelled || loading) return;
      loading = true;
      try {
        const run = await getRun(runId);
        const latest = {
          id: run.id,
          issuer_id: run.issuer_id,
          status: run.status,
          qa_status: run.qa_status,
          committee_status: run.committee_status,
          as_of_date: run.as_of_date,
          created_at: null,
        };
        if (run.status !== "complete") {
          // ModuleOutput rows are committed as execution progresses. Render
          // that persisted subset as explicitly partial rather than throwing it
          // away until the terminal run roll-up arrives.
          const value = await buildPipelineFromRun(run);
          if (!cancelled) setState({ value, phase: "in_flight", latest });
          if (run.status === "queued" || run.status === "running") schedule();
          return;
        }
        const value = await buildPipelineFromRun(run);
        if (!cancelled) setState({ value, phase: "complete", latest });
      } catch {
        if (!cancelled) setState({ value: null, phase: "error", latest: null });
      } finally {
        loading = false;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        if (timer) clearTimeout(timer);
        timer = null;
        return;
      }
      void load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [runId]);

  return state;
}

export function useLivePipelineStatus(issuerId: string, runId: string | null = null): LatestRunStatus<LivePipeline | null> {
  const latest = useLatestRunStatus<LivePipeline | null>(issuerId, null, null, buildPipeline);
  const exact = useExactPipelineStatus(runId);
  return runId ? exact : latest;
}
