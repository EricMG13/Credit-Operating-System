"use client";

import { useMemo, useState } from "react";
import {
  DRIVERS, NODE_LIMITS, NODE_QA, NODE_REQS, RUN_MODES,
  type RunMode,
} from "@/lib/pipeline/data";
import { useSimRun, type SimRun } from "@/lib/pipeline/sim";
import type { PipelineReferenceFixtures } from "@/components/pipeline/views";

export interface ReferencePipelineRuntimeValue {
  modeK: string;
  setModeK: (value: string) => void;
  mode: RunMode;
  simScope: Set<string>;
  run: SimRun;
  modes: typeof RUN_MODES;
  fixtures: PipelineReferenceFixtures;
}

export interface ReferencePipelineRuntimeProps {
  children: (runtime: ReferencePipelineRuntimeValue) => React.ReactNode;
}

const fixtures: PipelineReferenceFixtures = {
  drivers: DRIVERS,
  nodeLimits: NODE_LIMITS,
  nodeQa: NODE_QA,
  nodeReqs: NODE_REQS,
};

export function ReferencePipelineRuntime({ children }: ReferencePipelineRuntimeProps) {
  const [modeK, setModeK] = useState("full");
  const mode = RUN_MODES.find((candidate) => candidate.k === modeK) ?? RUN_MODES[0];
  const simScope = useMemo(() => new Set(mode.plan.map((step) => step.id)), [mode]);
  const run = useSimRun({ autoplay: false, plan: mode.plan, complete: mode.complete });
  return children({ modeK, setModeK, mode, simScope, run, modes: RUN_MODES, fixtures });
}
