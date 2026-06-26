"use client";

// Model mode segmented control — TEST / LITE / BALANCED / MAX. Per-analyst,
// saved in this browser (lib/model-mode.ts) and sent as X-Model-Mode on every
// request; the server resolves it to a model tier per LLM lane (engine/presets.py).

import { MODEL_MODES, type ModelMode } from "@/lib/model-mode";
import { labelCls } from "./styles";

export function ModelModeToggle({
  value,
  onChange,
  label = "Model mode",
  ariaLabel = label,
}: {
  value: ModelMode;
  onChange: (v: ModelMode) => void;
  label?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1" role="group" aria-label={ariaLabel}>
        {MODEL_MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            aria-pressed={value === m.value}
            onClick={() => onChange(m.value)}
            title={m.hint}
            className={
              "flex flex-col gap-0.5 px-2 py-1.5 rounded border text-left transition-caos focus-ring " +
              (value === m.value
                ? "bg-caos-elevated text-caos-text border-caos-accent"
                : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
            }
          >
            <span className="tabular text-caos-md">{m.label}</span>
            <span className="tabular text-caos-2xs text-caos-muted leading-tight">{m.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
