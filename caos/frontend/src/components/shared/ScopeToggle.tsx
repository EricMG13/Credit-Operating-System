"use client";

// Sector / issuer scope toggle — the two-button segmented control that picks the
// analysis grain. Used by the Deep Research brief and its Settings default. The
// label captions the group and (unless overridden) names it for screen readers.

import { labelCls } from "./styles";

export type AnalysisScope = "sector" | "issuer";

export function ScopeToggle({
  value,
  onChange,
  label = "Scope",
  ariaLabel = label,
}: {
  value: AnalysisScope;
  onChange: (v: AnalysisScope) => void;
  label?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      <div className="flex gap-1" role="group" aria-label={ariaLabel}>
        {(["sector", "issuer"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={value === m}
            onClick={() => onChange(m)}
            className={
              "flex-1 tabular text-caos-sm uppercase tracking-wider px-2 py-1.5 rounded border transition-caos focus-ring " +
              (value === m
                ? "bg-caos-elevated text-caos-text border-caos-accent"
                : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
            }
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
