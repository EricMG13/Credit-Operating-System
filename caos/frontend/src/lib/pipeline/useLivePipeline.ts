"use client";

// Read-only hook: load the latest COMPLETE run for an issuer and adapt the CP-X
// route plan + per-module statuses into the same {sim, plan, scope} shape the
// Pipeline views already render. Side-effect-free and fully guarded — on no run,
// no backend, or any error it returns null, so the page falls back to the
// offline sim demo unchanged ("prefer live, static fallback", same contract as
// useLiveRun).

import { useEffect, useState } from "react";
import { getModule, getRun, listRuns } from "@/lib/api";
import type { ModuleDetailDTO, ModuleStatusDTO, RunSummaryDTO } from "@/lib/engine/types";
import { MODULES, type PlanStep, type SimOutcome } from "./data";
import type { Sim, SimEvent } from "./sim";

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
      return m.qa_status === "Blocked" ? "blocked" : "pass";
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
      event: `${id} ${m.module_name} — ${m.committee_status} · ${m.confidence}`,
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

export function useLivePipeline(issuerId: string): LivePipeline | null {
  const [live, setLive] = useState<LivePipeline | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const runs = await listRuns(issuerId);
        const latest = runs.find((r) => r.status === "complete");
        if (!latest) {
          if (!cancelled) setLive(null);
          return;
        }
        const [run, cpx] = await Promise.all([
          getRun(latest.id),
          getModule(latest.id, "CP-X").catch(() => null),
        ]);
        if (!cancelled) setLive(buildLiveSnapshot(run, cpx));
      } catch {
        if (!cancelled) setLive(null); // no backend / error → static sim fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [issuerId]);

  return live;
}
