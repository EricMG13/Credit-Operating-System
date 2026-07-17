"use client";

// The Analyst / PM / QA presentation selector — persistent but secondary
// chrome, mounted beside the AnalystBadge on every surface. A radiogroup, not
// tabs: it changes how surfaces COMPOSE, never what the user may access.

import { useRoleView } from "./RoleViewProvider";
import type { RoleView } from "@/lib/api";
import { useRovingTabs } from "@/lib/useRovingTabs";

const OPTIONS: { value: RoleView; label: string; hint: string }[] = [
  { value: "analyst", label: "Analyst", hint: "Analyst view — full working density" },
  { value: "pm", label: "PM", hint: "PM view — posture and what-changed first" },
  { value: "qa", label: "QA", hint: "QA view — governance and gates first" },
];

export function RoleViewSwitch() {
  const { roleView, setRoleView } = useRoleView();
  const activeIndex = OPTIONS.findIndex((o) => o.value === roleView);
  // A role=radiogroup promises arrow-key movement per WAI-ARIA — this was
  // radio semantics with no keyboard behavior behind them (3 plain Tab stops,
  // no ArrowLeft/Right). setRoleView on activate matches the radiogroup
  // pattern: arrow keys move AND select, not just move.
  const { getItemProps } = useRovingTabs(OPTIONS.length, Math.max(activeIndex, 0), (index) => setRoleView(OPTIONS[index].value));
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0" title="Presentation only — permissions and approval authority do not change">
      <span className="inline tabular text-caos-2xs uppercase tracking-wider text-caos-muted">View</span>
      <span
        role="radiogroup"
        aria-label="View composition — presentation only, permissions unchanged"
        className="flex items-center rounded border border-caos-border overflow-hidden"
      >
        {OPTIONS.map((o, i) => {
        const active = roleView === o.value;
        const { ref, tabIndex, onKeyDown } = getItemProps(i);
        return (
          <button
            key={o.value}
            ref={ref as React.Ref<HTMLButtonElement>}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={tabIndex}
            onKeyDown={onKeyDown}
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
