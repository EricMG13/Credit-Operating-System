"use client";

import { useState } from "react";

type Stage = "Origination" | "Analysis" | "Diligence" | "Committee Prep" | "Execution";

const STAGES: Stage[] = ["Origination", "Analysis", "Diligence", "Committee Prep", "Execution"];

export function WorkflowStageHeader({
  active = "Diligence",
  sourceQuality,
  confidence,
}: {
  active?: Stage;
  sourceQuality?: string; // e.g. "HIGH"
  confidence?: number; // 0–1
}) {
  const [stage, setStage] = useState<Stage>(active);

  return (
    <div className="flex items-center gap-1 h-10 px-4 border-b border-caos-border bg-caos-bg shrink-0">
      {STAGES.map((s, i) => {
        const isActive = s === stage;
        return (
          <div key={s} className="flex items-center">
            <button
              onClick={() => setStage(s)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-caos ${
                isActive
                  ? "bg-caos-elevated text-white"
                  : "text-caos-muted hover:text-caos-text"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isActive ? "bg-caos-accent" : "bg-[color:var(--caos-idle)]"
                }`}
              />
              {s}
              {/* Origination carries the source-quality gate + confidence chip */}
              {s === "Origination" && (sourceQuality || confidence != null) && (
                <span className="tabular ml-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400">
                  {sourceQuality ?? "OK"}
                  {confidence != null && ` · ${Math.round(confidence * 100)}%`}
                </span>
              )}
            </button>
            {i < STAGES.length - 1 && <span className="text-caos-border mx-0.5">›</span>}
          </div>
        );
      })}
    </div>
  );
}
