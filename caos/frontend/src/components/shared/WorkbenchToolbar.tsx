"use client";

import { ActionReason } from "@/components/shared/ActionReason";
import { Button } from "@/components/ui/Button";

export interface WorkbenchAction {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Explains why the action is inert when `disabled` is true. Falls back to
   * a literal description built from `label` when the caller omits it. */
  disabledReason?: string;
  primary?: boolean;
}

/** Turns the boolean `disabled` flag callers pass into the aria-disabled
 * contract's required reason string, preferring the caller-supplied
 * explanation and otherwise stating the guard condition literally. */
function inertReason(action: WorkbenchAction): string | null {
  if (!action.disabled) return null;
  return action.disabledReason ?? `${action.label} is unavailable`;
}

/** One toolbar contract for list/worklist surfaces. Five actions maximum are
 * visible; remaining actions move to a native disclosure menu. */
export function WorkbenchToolbar({
  title,
  description,
  count,
  viewLabel,
  search,
  filters,
  actions = [],
}: {
  title: string;
  description?: string;
  count?: string;
  viewLabel?: string;
  search?: React.ReactNode;
  filters?: React.ReactNode;
  actions?: WorkbenchAction[];
}) {
  const visible = actions.slice(0, 5);
  const overflow = actions.slice(5);
  return (
    <section className="caos-workbench-toolbar" aria-label={`${title} controls`}>
      <div className="caos-workbench-heading min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className="caos-workbench-title font-mono font-semibold text-caos-text">{title}</h2>
          {viewLabel ? <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-accent">{viewLabel}</span> : null}
          {count ? <span className="tabular text-caos-xs text-caos-muted">{count}</span> : null}
        </div>
        {description ? <p className="caos-workbench-description mt-1 text-caos-md leading-relaxed text-caos-muted">{description}</p> : null}
      </div>
      <div className="caos-workbench-controls">
        {search}
        {filters}
        <div role="toolbar" aria-label={`${title} actions`} className="caos-workbench-actions flex items-center gap-1.5 shrink-0">
          {visible.map((action) => (
            <Button
              key={action.id}
              variant={action.primary ? "primary" : "secondary"}
              onClick={action.onClick}
              reason={inertReason(action)}
            >
              {action.label}
            </Button>
          ))}
          {overflow.length ? (
            <details className="relative">
              <summary className="caos-action-secondary focus-ring cursor-pointer list-none" aria-label={`${title}: more actions`}>More actions</summary>
              <div className="absolute right-0 top-[calc(100%+4px)] z-overlay min-w-44 rounded-md border border-caos-border bg-caos-panel p-1 shadow-pop">
                {overflow.map((action) => (
                  <ActionReason
                    key={action.id}
                    onClick={action.onClick}
                    reason={inertReason(action)}
                    className="w-full min-h-8 px-2 text-left tabular text-caos-xs text-caos-muted hover:bg-caos-elevated hover:text-caos-text rounded-sm focus-ring aria-disabled:opacity-40"
                  >
                    {action.label}
                  </ActionReason>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  );
}
