"use client";

import { useEffect, useId, useRef, useState } from "react";

export function Panel({
  title,
  right,
  children,
  className = "",
  as: Heading = "h2",
  collapsible = false,
  defaultCollapsed = false,
  onCollapse,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  as?: "h2" | "h3";
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onCollapse?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const bodyId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  // Only a body that actually clips needs to be a keyboard-focusable scroll
  // region — measure real overflow so a panel whose content fits isn't an inert
  // tab stop (a dense page had ~9 of them before every real action).
  const [scrollable, setScrollable] = useState(false);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) { setScrollable(false); return; }
    const measure = () => setScrollable(el.scrollHeight > el.clientHeight + 1);
    measure();
    // ResizeObserver is absent in jsdom / non-DOM renders — a one-time measure is
    // the safe fallback (the region just won't re-evaluate on resize there).
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [collapsed]);

  return (
    <div
      className={"bg-caos-panel border border-caos-border rounded-md flex flex-col min-h-0 " + className}
      style={collapsed ? { flex: "none", height: "auto" } : undefined}
    >
      <div className={`caos-panel-header min-h-8 shrink-0 px-3 flex flex-wrap items-center gap-2 bg-caos-elevated/20 ${collapsed ? "" : "border-b border-caos-border"}`}>
        <Heading className="caos-panel-title m-0 min-w-0 flex-1 tabular text-caos-xs font-semibold tracking-[0.12em] uppercase text-caos-text">
          {collapsible ? (
            <button
              type="button"
              onClick={() => {
                if (onCollapse) onCollapse();
                else setCollapsed((current) => !current);
              }}
              className="-ml-1 flex h-7 w-full min-w-0 items-center gap-1 rounded px-1 text-left transition-caos hover:bg-caos-elevated/50 focus-ring"
              aria-expanded={!collapsed}
              aria-controls={bodyId}
              aria-label={collapsed ? `Expand ${title} panel` : `Collapse ${title} panel`}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 stroke-current text-caos-muted" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={collapsed ? "m4 6 4 4 4-4" : "m4 10 4-4 4 4"} />
              </svg>
              <span className="truncate">{title}</span>
            </button>
          ) : title}
        </Heading>
        {right ? <div className="caos-panel-actions min-w-0">{right}</div> : null}
      </div>
      {/* Body is keyboard-focusable ONLY when it actually clips, so a scrollable
          panel can be reached without a mouse (WCAG 2.1.1; axe
          scrollable-region-focusable) while a fitting one stays out of the tab
          order. Labeled by the panel title so the focused region is announced. */}
      {!collapsed && (
        <div
          id={bodyId}
          ref={bodyRef}
          tabIndex={scrollable ? 0 : undefined}
          aria-label={scrollable ? title : undefined}
          className={"flex-1 min-h-0 overflow-auto" + (scrollable ? " focus-ring" : "")}
        >
          {children}
        </div>
      )}
    </div>
  );
}
