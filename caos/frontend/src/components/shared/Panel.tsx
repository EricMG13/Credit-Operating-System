"use client";

import { useState } from "react";

export function Panel({
  title,
  right,
  children,
  className = "",
  as: Heading = "h2",
  collapsible = false,
  defaultCollapsed = false,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  as?: "h2" | "h3";
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className={"bg-caos-panel border border-caos-border rounded-md flex flex-col min-h-0 " + className}
      style={collapsed ? { flex: "none", height: "auto" } : undefined}
    >
      <div className={`h-8 shrink-0 px-3 flex items-center gap-2 ${collapsed ? "" : "border-b border-caos-border"}`}>
        {collapsible && (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="w-5 h-5 -ml-1 rounded flex items-center justify-center text-caos-muted hover:text-caos-text hover:bg-caos-elevated transition-caos focus-ring cursor-pointer"
            aria-label={collapsed ? `Expand ${title} panel` : `Collapse ${title} panel`}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="w-3.5 h-3.5 stroke-current" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={collapsed ? "m4 6 4 4 4-4" : "m4 10 4-4 4 4"} />
            </svg>
          </button>
        )}
        <Heading className="text-caos-md font-semibold tracking-[0.12em] uppercase text-caos-muted m-0">{title}</Heading>
        <div className="flex-1" />
        {right}
      </div>
      {/* Body is keyboard-focusable so a clipping panel can be scrolled without a
          mouse (WCAG 2.1.1; axe scrollable-region-focusable). Labeled by the panel
          title so the focused region is announced. */}
      {!collapsed && (
        <div tabIndex={0} aria-label={title} className="flex-1 min-h-0 overflow-auto focus-ring">
          {children}
        </div>
      )}
    </div>
  );
}

