"use client";

// The left capability rail: every graph traversal, grouped by edge type. A row is
// a live button when its edge can be walked from what's stored, and a greyed,
// non-interactive row carrying the reason otherwise (driven entirely by
// /api/query/capabilities, so the greying is honest, not decorative). Collapses
// to a slim index strip.

import type { CapabilityGroup } from "@/lib/query/graph";

export function CapabilityRail({
  groups,
  activeId,
  collapsed,
  onToggle,
  onPick,
}: {
  groups: CapabilityGroup[];
  activeId: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onPick: (capabilityId: string) => void;
}) {
  const totalReady = groups.reduce((s, g) => s + g.ready, 0);

  return (
    <aside
      className="shrink-0 border-r border-caos-border bg-caos-bg/60 flex flex-col transition-caos"
      style={{ width: collapsed ? 44 : 234 }}
      aria-label="Query capabilities"
    >
      <div className="h-9 shrink-0 px-2.5 flex items-center border-b border-caos-border">
        {!collapsed && (
          <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
            Capabilities <span className="text-caos-muted/60">· {totalReady} ready</span>
          </span>
        )}
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expand capability rail" : "Collapse capability rail"}
          className="ml-auto w-6 h-6 rounded flex items-center justify-center text-caos-muted hover:text-caos-text hover:bg-caos-elevated transition-caos focus-ring"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      {collapsed ? (
        <div className="flex flex-col items-center gap-3 py-3 text-caos-muted">
          {groups.map((g) => (
            <span
              key={g.id}
              title={`${g.label} — ${g.ready}/${g.total} ready`}
              className="tabular text-caos-2xs"
              style={{ color: g.ready ? "var(--caos-accent)" : "var(--caos-idle)" }}
            >
              {g.ready}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-auto py-1">
          {groups.map((g) => (
            <div key={g.id}>
              <div className="px-2.5 pt-2.5 pb-1 flex items-center gap-1.5">
                <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted">{g.label}</span>
                <span className="ml-auto tabular text-caos-3xs text-caos-muted/60">{g.ready}/{g.total}</span>
              </div>
              {g.capabilities.map((c) =>
                c.enabled ? (
                  <button
                    key={c.id}
                    onClick={() => onPick(c.id)}
                    title={c.label}
                    className={
                      "w-full text-left flex items-center gap-2 px-2.5 py-1 rounded transition-caos focus-ring " +
                      (c.id === activeId ? "bg-caos-elevated" : "hover:bg-caos-elevated/60")
                    }
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--caos-accent)" }} />
                    <span className="tabular text-caos-sm text-caos-text truncate">{c.label}</span>
                  </button>
                ) : (
                  <div
                    key={c.id}
                    title={c.reason ?? "unavailable"}
                    aria-disabled="true"
                    className="w-full flex items-center gap-2 px-2.5 py-1 opacity-50 cursor-not-allowed"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 border border-caos-muted/50" />
                    <span className="tabular text-caos-sm text-caos-muted truncate">{c.label}</span>
                    <span className="ml-auto tabular text-caos-3xs text-caos-muted/70 whitespace-nowrap font-mono">{c.reason}</span>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
