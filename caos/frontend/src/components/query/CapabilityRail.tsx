"use client";

// The left capability rail: every graph traversal, grouped by edge type. A row is
// a live button when its edge can be walked from what's stored, and a greyed,
// non-interactive row carrying the reason otherwise (driven entirely by
// /api/query/capabilities, so the greying is honest, not decorative). Collapses
// to a slim index strip.

import { useState, useEffect } from "react";
import type { CapabilityGroup } from "@/lib/query/graph";
import { CollapseButton } from "@/components/shared/CollapseButton";
import { StatusGlyph } from "@/components/shared/StatusGlyph";

const TOOLTIPS: Record<string, string> = {
  "trace-source": "CP-5B EvidenceTraceValidator: Validate evidence lineage using 8-value taxonomy.",
  "lineage-audit": "CP-5B EvidenceTraceValidator: Audit research integrity and validate evidence trace linkages.",
  "provenance-split": "CP-5B EvidenceTraceValidator: Check evidence distribution by provenance category and source hierarchy.",
  "orphan-claims": "CP-5B EvidenceTraceValidator: Extract and list claims without supporting evidence (orphan claim register).",
  "conclusion-lineage": "CP-2 FundamentalCreditSynthesizer: Trace output conclusions back to operational fact packs.",
  "impact-analysis": "CP-X PlannerRouter: Map downstream consequences and risk transmission paths.",
  "coverage-completeness": "CP-0 SourceReadiness: Assess coverage gaps and source readiness across watchlist issuers.",
  "peer-set": "CP-1C PeerBenchmark: Compare issuer to peer companies using a 15-core formula registry.",
  "peer-profile": "CP-1C PeerBenchmark: Compare peer profile metrics using a 6-level peer hierarchy.",
  "shared-theme": "CP-2 FundamentalCreditSynthesizer: Trace shared macro drivers and shock transmission across issuers.",
  "concentration-map": "CP-1 CanonicalDataFoundation: Map credit concentration across sectors, countries, and portfolio constraints.",
  "contagion": "CP-2F MacroFXHedgingSensitivity: Trace contagion shock transmission across watchlist issuers.",
  "sponsor-graph": "CP-1A BusinessTransactionFactPack: Map ownership networks, sponsor strength, and transaction counterparties.",
  "distribution": "CP-1 CanonicalDataFoundation: Analyze credit KPI distributions across the issuer cohort.",
  "scatter": "CP-1C PeerBenchmark: Leverage × interest coverage cross-plots of watchlist issuers.",
  "metric-trend": "CP-1 CanonicalDataFoundation: Multi-period trends and rolling financial KPI series.",
  "run-diff": "CP-1B EarningsDelta: Compare current vs prior period output models and delta performance.",
  "coverage-changed": "CP-SR SectorReview: Compare sector review coverage performance and watches changes.",
  "open-findings": "CP-5 ResearchIntegrityQA: Audit open findings and severity classification across active runs.",
  "gate-lane": "CP-5 ResearchIntegrityQA: Roll up open QA findings by severity classification and gate lane.",
  "committee-board": "CP-5 ResearchIntegrityQA: Gate outputs and build the final committee-readiness challenge board."
};

function tooltipFor(id: string): string {
  return TOOLTIPS[id] || "Modular OS capability walk.";
}

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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Auto-expand the group containing the active capability on activeId or groups change
  useEffect(() => {
    if (activeId) {
      const activeGroup = groups.find((g) => g.capabilities.some((c) => c.id === activeId));
      if (activeGroup) {
        setExpandedGroups((prev) => {
          if (prev[activeGroup.id] !== undefined) return prev;
          return { ...prev, [activeGroup.id]: true };
        });
      }
    }
  }, [activeId, groups]);

  return (
    <aside
      className="shrink-0 border-r border-caos-border bg-caos-panel flex flex-col transition-caos"
      style={{ width: collapsed ? 48 : 260 }}
      aria-label="Query capabilities"
    >
      <div className="h-10 shrink-0 px-3 flex items-center border-b border-caos-border bg-caos-elevated/35">
        {!collapsed && (
          <div className="min-w-0">
            <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-text leading-none">Capability Index</div>
            <div className="tabular text-caos-3xs text-caos-muted leading-none mt-1">{totalReady} ready</div>
          </div>
        )}
        <CollapseButton direction={collapsed ? "right" : "left"} label={collapsed ? "Expand capability rail" : "Collapse capability rail"} onClick={onToggle} className="ml-auto" />
      </div>

      {collapsed ? (
        <div className="flex-col items-center gap-2 py-3 text-caos-muted hidden md:flex">
          {groups.map((g) => (
            <span
              key={g.id}
              title={`${g.label} — ${g.ready}/${g.total} ready`}
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
            const isExpanded = !!expandedGroups[g.id];
            return (
              <div key={g.id} className="px-2 py-1.5 border-b border-caos-border/10 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setExpandedGroups((prev) => ({ ...prev, [g.id]: !prev[g.id] }))}
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
                        <div key={c.id} className="w-full flex items-center justify-between group/cap">
                          <button
                            type="button"
                            onClick={() => onPick(c.id)}
                            className={
                              "flex-1 text-left flex items-center gap-2 px-2 py-1.5 min-h-[30px] rounded transition-caos focus-ring " +
                              (c.id === activeId ? "bg-caos-elevated caos-selected" : "hover:bg-caos-elevated/60")
                            }
                          >
                            <StatusGlyph kind="success" size={8} className="text-caos-accent" />
                            <span className="tabular text-caos-sm text-caos-text truncate">{c.label}</span>
                          </button>
                          <span 
                            title={tooltipFor(c.id)}
                            className="hidden group-hover/cap:inline-block text-caos-muted hover:text-caos-text text-caos-3xs font-mono px-1.5 cursor-help shrink-0"
                            aria-label="Capability Info"
                          >
                            ⓘ
                          </span>
                        </div>
                      ) : (
                        <div
                          key={c.id}
                          className="w-full flex items-center justify-between group/cap px-2 py-1.5 min-h-[30px]"
                        >
                          <div
                            title={c.reason ?? "unavailable"}
                            aria-disabled="true"
                            className="flex-1 flex items-center gap-2 opacity-55 cursor-not-allowed min-w-0"
                          >
                            <StatusGlyph kind="idle" size={8} className="text-caos-muted" />
                            <span className="tabular text-caos-sm text-caos-muted truncate">{c.label}</span>
                            <span 
                              className="ml-auto tabular text-[10px] text-caos-muted font-mono truncate max-w-[90px]"
                              title={c.reason ?? "unavailable"}
                            >
                              {c.reason}
                            </span>
                          </div>
                          <span 
                            title={tooltipFor(c.id)}
                            className="hidden group-hover/cap:inline-block text-caos-muted hover:text-caos-text text-caos-3xs font-mono px-1.5 cursor-help shrink-0"
                            aria-label="Capability Info"
                          >
                            ⓘ
                          </span>
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
