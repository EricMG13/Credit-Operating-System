"use client";

import { AgentExecutionMesh } from "./AgentExecutionMesh";
import type { AgentOutputs } from "@/types/agents";

export function GlobalNavBar({
  outputs,
  running,
  user,
}: {
  outputs: AgentOutputs | null;
  running: boolean;
  user?: string;
}) {
  return (
    <header className="flex items-center gap-4 h-12 px-4 border-b border-caos-border bg-caos-panel shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
          C
        </div>
        <span className="text-sm font-semibold text-white tracking-tight">
          Credit Agent OS
        </span>
        <span className="tabular text-[10px] text-caos-muted px-1.5 py-0.5 rounded bg-caos-elevated">
          CAOS
        </span>
      </div>

      {/* Agent Execution Mesh */}
      <AgentExecutionMesh outputs={outputs} running={running} />

      <div className="flex-1" />

      {/* Global search */}
      <div className="hidden md:flex items-center gap-2 px-3 h-7 rounded-md bg-caos-elevated border border-caos-border text-caos-muted text-xs w-64">
        <span>⌕</span>
        <input
          placeholder="Search entities, CUSIPs…"
          className="bg-transparent outline-none flex-1 text-caos-text placeholder-caos-muted"
        />
      </div>

      <button className="text-caos-muted hover:text-caos-text transition-caos" title="Alerts">
        ◔
      </button>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-caos-elevated border border-caos-border flex items-center justify-center text-[10px] text-caos-muted">
          {(user || "AN").slice(0, 2).toUpperCase()}
        </div>
        <span className="tabular text-xs text-caos-muted hidden lg:inline">{user || "Trader 01"}</span>
      </div>
    </header>
  );
}
