"use client";

import type { AgentOutputs } from "@/types/agents";

type Status = "idle" | "running" | "pass" | "warning" | "critical";

const LAYERS: { layer: string; label: string; modules: (keyof AgentOutputs)[] }[] = [
  { layer: "L0", label: "Readiness", modules: ["cp0"] },
  { layer: "L1", label: "Base", modules: ["cp1"] },
  { layer: "L2", label: "Synthesis", modules: ["cp2"] },
  { layer: "L3", label: "Rel. Value", modules: ["cp3"] },
  { layer: "L4", label: "Legal", modules: ["cp4", "cp4c"] },
  { layer: "L5", label: "Governance", modules: ["cp1"] }, // QA runs over L1–L4
  { layer: "L6", label: "Debate", modules: ["cp6e"] },
];

const DOT: Record<Status, string> = {
  idle: "bg-[color:var(--caos-idle)]",
  running: "bg-[color:var(--caos-accent)] caos-running",
  pass: "bg-[color:var(--caos-success)]",
  warning: "bg-[color:var(--caos-warning)]",
  critical: "bg-[color:var(--caos-critical)]",
};

function layerStatus(
  modules: (keyof AgentOutputs)[],
  outputs: AgentOutputs | null,
  running: boolean,
  blocked: string[]
): Status {
  if (!outputs) return running ? "running" : "idle";
  const present = modules.some((m) => outputs[m]);
  const isBlocked = modules.some((m) =>
    blocked.includes(m.toUpperCase().replace("CP", "CP-"))
  );
  if (isBlocked) return "critical";
  if (present) return "pass";
  return running ? "running" : "idle";
}

export function AgentExecutionMesh({
  outputs,
  running,
}: {
  outputs: AgentOutputs | null;
  running: boolean;
}) {
  const blocked = outputs?.blocked_modules ?? [];
  return (
    <div className="flex items-center gap-1.5" aria-label="Agent execution mesh">
      {LAYERS.map(({ layer, label, modules }) => {
        const status = layerStatus(modules, outputs, running, blocked);
        return (
          <div
            key={layer}
            title={`${layer} · ${label} — ${status}`}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-caos-elevated border border-caos-border transition-caos hover:border-caos-accent/50"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${DOT[status]}`} />
            <span className="tabular text-[10px] text-caos-muted">{layer}</span>
          </div>
        );
      })}
    </div>
  );
}
