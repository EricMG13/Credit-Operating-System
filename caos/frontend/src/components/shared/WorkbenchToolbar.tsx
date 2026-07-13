"use client";

export interface WorkbenchAction {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
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
          <h2 className="tabular text-caos-md font-semibold uppercase tracking-[0.12em] text-caos-text">{title}</h2>
          {viewLabel ? <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-accent">{viewLabel}</span> : null}
          {count ? <span className="tabular text-caos-xs text-caos-muted">{count}</span> : null}
        </div>
        {description ? <p className="caos-workbench-description mt-1 text-caos-xs text-caos-muted">{description}</p> : null}
      </div>
      <div className="caos-workbench-controls">
        {search}
        {filters}
        <div role="toolbar" aria-label={`${title} actions`} className="caos-workbench-actions flex items-center gap-1.5 shrink-0">
          {visible.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={`${action.primary ? "caos-action-primary" : "caos-action-secondary"} focus-ring disabled:opacity-40`}
            >
              {action.label}
            </button>
          ))}
          {overflow.length ? (
            <details className="relative">
              <summary className="caos-action-secondary focus-ring cursor-pointer list-none" aria-label={`${title}: more actions`}>More actions</summary>
              <div className="absolute right-0 top-[calc(100%+4px)] z-overlay min-w-44 rounded-md border border-caos-border bg-caos-panel p-1 shadow-pop">
                {overflow.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className="w-full min-h-8 px-2 text-left tabular text-caos-xs text-caos-muted hover:bg-caos-elevated hover:text-caos-text rounded-sm focus-ring disabled:opacity-40"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  );
}
