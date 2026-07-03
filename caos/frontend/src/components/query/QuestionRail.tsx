"use client";

// The left rail, reframed analyst-first: every graph walk phrased as the
// question it answers, grouped by the job being done (position / exposures /
// defend / watch) instead of by engine edge type. Greying stays honest — a row
// is disabled only because /api/query/capabilities says so, and the reason is
// shown in full on its own line, never truncated into a tooltip.

import { useState, useEffect } from "react";
import type { QuestionGroup } from "@/lib/query/questions";
import { engineNote, questionFor } from "@/lib/query/questions";
import { CollapseButton } from "@/components/shared/CollapseButton";
import { StatusGlyph } from "@/components/shared/StatusGlyph";

export function QuestionRail({
  groups,
  activeId,
  collapsed,
  onToggle,
  onPick,
}: {
  groups: QuestionGroup[];
  activeId: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onPick: (capabilityId: string) => void;
}) {
  const totalReady = groups.reduce((s, g) => s + g.ready, 0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Auto-expand the job containing the active walk (once — manual state wins after).
  useEffect(() => {
    if (!activeId) return;
    const owner = groups.find((g) => g.capabilities.some((c) => c.id === activeId));
    if (!owner) return;
    setExpanded((prev) => (prev[owner.id] === undefined ? { ...prev, [owner.id]: true } : prev));
  }, [activeId, groups]);

  return (
    <aside
      className="shrink-0 border-r border-caos-border bg-caos-panel flex flex-col transition-caos"
      style={{ width: collapsed ? 48 : 272 }}
      aria-label="Query questions"
    >
      <div className="h-10 shrink-0 px-3 flex items-center border-b border-caos-border bg-caos-elevated/35">
        {!collapsed && (
          <div className="min-w-0">
            <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-text leading-none">Questions</div>
            <div className="tabular text-caos-3xs text-caos-muted leading-none mt-1">{totalReady} answerable now</div>
          </div>
        )}
        <CollapseButton
          direction={collapsed ? "right" : "left"}
          label={collapsed ? "Expand question rail" : "Collapse question rail"}
          onClick={onToggle}
          className="ml-auto"
        />
      </div>

      {collapsed ? (
        <div className="flex-col items-center gap-2 py-3 text-caos-muted hidden md:flex">
          {groups.map((g) => (
            <span
              key={g.id}
              title={`${g.label} — ${g.ready}/${g.total} answerable`}
              className="w-7 h-7 rounded border border-caos-border bg-caos-bg flex items-center justify-center tabular text-caos-2xs"
              style={{ color: g.ready ? "var(--caos-accent)" : "var(--caos-muted)" }}
            >
              {g.ready}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-auto py-1">
          {groups.map((g) => {
            const isExpanded = expanded[g.id] ?? true;
            return (
              <div key={g.id} className="px-2 py-1.5 border-b border-caos-border/10 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [g.id]: !isExpanded }))}
                  aria-expanded={isExpanded}
                  className="w-full px-1 pb-1 flex items-center gap-2 text-left hover:text-caos-text transition-colors focus-ring"
                >
                  <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted font-semibold truncate">
                    {g.label}
                  </span>
                  <span className="ml-auto tabular text-caos-3xs text-caos-muted font-mono flex items-center gap-1">
                    <span>{g.ready}/{g.total}</span>
                    <span
                      className="text-[8px] transform transition-transform duration-150 inline-block font-sans"
                      style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                      aria-hidden="true"
                    >
                      ▼
                    </span>
                  </span>
                </button>

                {isExpanded && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {[...g.capabilities].sort((a, b) => Number(b.enabled) - Number(a.enabled)).map((c) =>
                      c.enabled ? (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onPick(c.id)}
                          title={engineNote(c.id)}
                          className={
                            "w-full text-left flex items-center gap-2 px-2 py-1.5 min-h-[30px] rounded transition-caos focus-ring " +
                            (c.id === activeId ? "bg-caos-elevated caos-selected" : "hover:bg-caos-elevated/60")
                          }
                        >
                          <StatusGlyph kind="success" size={8} className="text-caos-accent shrink-0" />
                          <span className="tabular text-caos-sm text-caos-text leading-snug">{questionFor(c)}</span>
                        </button>
                      ) : (
                        <div
                          key={c.id}
                          title={engineNote(c.id)}
                          aria-disabled="true"
                          className="w-full px-2 py-1.5 rounded cursor-not-allowed"
                        >
                          <div className="flex items-center gap-2">
                            <StatusGlyph kind="idle" size={8} className="text-caos-muted shrink-0" />
                            <span className="tabular text-caos-sm text-caos-muted leading-snug opacity-60">{questionFor(c)}</span>
                          </div>
                          <div className="tabular text-caos-3xs text-caos-muted font-mono mt-0.5 pl-4 leading-snug">
                            {c.reason ?? "unavailable"}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
