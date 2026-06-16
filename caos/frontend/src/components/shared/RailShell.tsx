"use client";

// Shared collapsible side-rail shell: a thin vertical strip with a toggle when
// collapsed, and the full panel stack when open. Centralizes the open/closed
// chrome shared by the Deep-Dive SourceRail and DecisionRail so the two rails
// stop hand-rolling the same structure. Phase 0 foundation — rails adopt this
// in Phase 1.

export function RailShell({
  open,
  onToggle,
  collapsed,
  expandTitle = "Expand",
  glyph = "⊐",
  children,
}: {
  open: boolean;
  onToggle: () => void;
  /** Vertical-label content shown in the collapsed strip (under the toggle). */
  collapsed: React.ReactNode;
  expandTitle?: string;
  /** Toggle glyph for the collapsed strip (rails point it toward their edge). */
  glyph?: string;
  children: React.ReactNode;
}) {
  if (!open) {
    return (
      <div className="flex flex-col items-center gap-3 min-h-0 bg-caos-panel border border-caos-border rounded-md py-2.5">
        <button
          onClick={onToggle}
          title={expandTitle}
          aria-label={expandTitle}
          className="text-caos-muted hover:text-caos-text transition-caos text-caos-2xl"
        >
          {glyph}
        </button>
        {collapsed}
      </div>
    );
  }
  return <div className="flex flex-col gap-2 min-h-0">{children}</div>;
}
