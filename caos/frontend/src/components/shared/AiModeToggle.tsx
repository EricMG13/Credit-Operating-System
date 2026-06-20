"use client";

// AI power preset toggle — max / standard / lite segmented control. Used by the
// Research brief (per-run) and its Settings default. Resolved server-side into
// model + reasoning effort + search budget (deepresearch.py · _AI_MODES).

import type { AiMode } from "@/lib/research-prefs";
import { labelCls } from "./styles";

const MODES: { value: AiMode; hint: string }[] = [
  { value: "max", hint: "Latest model, highest effort" },
  { value: "standard", hint: "Balanced — engine default" },
  { value: "lite", hint: "Lighter model, favours speed" },
];

export function AiModeToggle({
  value,
  onChange,
  label = "AI mode",
  ariaLabel = label,
}: {
  value: AiMode;
  onChange: (v: AiMode) => void;
  label?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      <div className="flex gap-1" role="group" aria-label={ariaLabel}>
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            aria-pressed={value === m.value}
            onClick={() => onChange(m.value)}
            title={m.hint}
            className={
              "flex-1 flex flex-col gap-0.5 px-2 py-1.5 rounded border text-left transition-caos focus-ring " +
              (value === m.value
                ? "bg-caos-elevated text-caos-text border-caos-accent"
                : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
            }
          >
            <span className="tabular text-caos-md capitalize">{m.value}</span>
            <span className="tabular text-caos-2xs text-caos-muted leading-tight">{m.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
