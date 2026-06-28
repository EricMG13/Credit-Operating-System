"use client";

// Shared collapsible side-rail shell: a thin vertical strip with a toggle when
// collapsed, and the full panel stack when open. Centralizes the open/closed
// chrome shared by the Deep-Dive SourceRail and DecisionRail so the two rails
// stop hand-rolling the same structure. Phase 0 foundation — rails adopt this
// in Phase 1.

import { CollapseButton } from "@/components/shared/CollapseButton";

export function RailShell({
  open,
  onToggle,
  collapsed,
  expandTitle = "Expand",
  direction = "right",
  children,
}: {
  open: boolean;
  onToggle: () => void;
  /** Vertical-label content shown in the collapsed strip (under the toggle). */
  collapsed: React.ReactNode;
  expandTitle?: string;
  direction?: "left" | "right";
  children: React.ReactNode;
}) {
  if (!open) {
    return (
      <div className="flex flex-col items-center gap-3 min-h-0 bg-caos-panel border border-caos-border rounded-md py-2.5">
        <CollapseButton direction={direction} label={expandTitle} onClick={onToggle} />
        {collapsed}
      </div>
    );
  }
  return <div className="flex flex-col gap-2 min-h-0">{children}</div>;
}
