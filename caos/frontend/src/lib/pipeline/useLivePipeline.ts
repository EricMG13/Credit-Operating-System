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
import { MODULES, type PlanStep, type SimOutcome } from "./data";
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

// Pure transform (no I/O) so the mapping is unit-testable: a completed run + its
// CP-X route plan → the {sim, plan, scope} the Pipeline views already render.
export function buildLiveSnapshot(
  run: RunSummaryDTO,
  cpx: ModuleDetailDTO | null,
  details: readonly ModuleDetailDTO[] = [],
): LivePipeline {
  const statusById = new Map(run.modules.map((m) => [m.module_id, m]));
  const rt = (cpx?.runtime_output ?? {}) as {
    gate_status?: string;
    summary?: string;
    execution_sequence?: RouteStep[];
  };
  const depsById = new Map(
    (rt.execution_sequence ?? []).map((s) => [s.module_id, s.depends_on ?? []]),
  );
  const plannedIds = (rt.execution_sequence ?? []).map((step) => step.module_id);
  const blockedReasonById = new Map(details.map((detail) => {
    const runtime = detail.runtime_output ?? {};
    const runtimeReason = typeof runtime.blocked_reason === "string" ? runtime.blocked_reason : null;
    const limitationReason = detail.limitation_flags.find((flag) => typeof flag === "string" && flag.trim()) ?? null;
    return [detail.module_id, runtimeReason || limitationReason] as const;
  }));

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
    const blockedReason = outcome === "blocked" ? blockedReasonById.get(id) : null;
    return {
      id,
      deps: (depsById.get(id) ?? []).filter((d) => statusById.has(d)),
      dur: 1,
      outcome,
      // committee_status collapses to the confidence label verbatim when gated
      // on Insufficient Information (server gate.py) — omit the redundant
      // repeat rather than stutter "Insufficient Information · Insufficient Information".
      event: `${id} ${m.module_name} — ${m.committee_status}`
        + (m.confidence !== m.committee_status ? ` · ${m.confidence}` : "")
        + (blockedReason ? ` · Blocked: ${blockedReason}` : ""),
    };
  });

  const events: SimEvent[] = plan
    .filter((p) => p.event)
    .map((p) => ({ t: "", sev: p.outcome === "pass" ? "ok" : p.outcome, text: p.event }));

  const cleared = (s: string) => s === "pass" || s === "warning" || s === "held";
  const partialScope = run.status === "complete" || plannedIds.length === 0
    ? new Set(statusById.keys())
    : new Set(plannedIds);
  const blocked = run.modules
    .filter((module) => liveOutcome(module) === "blocked")
    .map((module) => ({ moduleId: module.module_id, reason: blockedReasonById.get(module.module_id) ?? null }));
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
    completed: plan.filter((p) => cleared(p.outcome)).length,
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
