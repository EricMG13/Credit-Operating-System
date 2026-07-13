"use client";

// The Analyst / PM / QA presentation selector — persistent but secondary
// chrome, mounted beside the AnalystBadge on every surface. A radiogroup, not
// tabs: it changes how surfaces COMPOSE, never what the user may access.

import { useRoleView } from "./RoleViewProvider";
import type { RoleView } from "@/lib/api";

const OPTIONS: { value: RoleView; label: string; hint: string }[] = [
  { value: "analyst", label: "Analyst", hint: "Analyst view — full working density" },
  { value: "pm", label: "PM", hint: "PM view — posture and what-changed first" },
  { value: "qa", label: "QA", hint: "QA view — governance and gates first" },
];

export function RoleViewSwitch() {
  const { roleView, setRoleView } = useRoleView();
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0" title="Presentation only — permissions and approval authority do not change">
      <span className="hidden xl:inline tabular text-caos-2xs uppercase tracking-wider text-caos-muted">View</span>
      <span
        role="radiogroup"
        aria-label="View composition — presentation only, permissions unchanged"
        className="flex items-center rounded border border-caos-border overflow-hidden"
      >
        {OPTIONS.map((o) => {
        const active = roleView === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.hint}
            onClick={() => setRoleView(o.value)}
            className={
              "tabular text-caos-2xs tracking-wider px-1.5 min-h-8 min-w-8 transition-caos focus-ring " +
              (active
                ? "bg-caos-elevated text-caos-accent font-semibold"
                : "text-caos-muted hover:text-caos-text")
            }
          >
            {o.label}
          </button>
        );
        })}
      </span>
      <span className="sr-only">Presentation only — permissions unchanged.</span>
    </span>
  );
}
