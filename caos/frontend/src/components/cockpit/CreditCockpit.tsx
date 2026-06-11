"use client";

import { useState } from "react";
import { FinancialsChart } from "./FinancialsChart";
import { LiquidityWaterfall } from "./LiquidityWaterfall";
import { CovenantGauges } from "./CovenantGauges";
import { RVScatterPlot } from "./RVScatterPlot";
import { DebateMatrix } from "./DebateMatrix";
import { AnalysisTab } from "./AnalysisTab";
import { EvidenceTracePanel } from "./EvidenceTracePanel";
import { SourceDocViewer } from "@/components/vault/SourceDocViewer";
import type { AgentOutputs } from "@/types/agents";

type Tab = "analysis" | "financials" | "liquidity" | "covenants" | "rv" | "debate";

const TABS: { key: Tab; label: string }[] = [
  { key: "analysis", label: "Analysis" },
  { key: "financials", label: "Financials" },
  { key: "liquidity", label: "Liquidity" },
  { key: "covenants", label: "Covenants" },
  { key: "rv", label: "Rel. Value" },
  { key: "debate", label: "Debate" },
];

interface Props {
  issuerId: string;
  agentOutputs: AgentOutputs | null;
}

export function CreditCockpit({ issuerId, agentOutputs }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("analysis");
  const [splitRatio, setSplitRatio] = useState(40); // Left pane width %

  return (
    <div className="flex h-full">
      {/* Left Pane — Source Vault */}
      <div
        className="h-full border-r border-caos-border overflow-hidden"
        style={{ width: `${splitRatio}%` }}
      >
        <SourceDocViewer />
      </div>

      {/* Drag handle */}
      <div
        className="w-1 h-full bg-caos-border hover:bg-caos-accent cursor-col-resize transition-caos shrink-0"
        onMouseDown={(e) => {
          const startX = e.clientX;
          const startRatio = splitRatio;
          const onMove = (ev: MouseEvent) => {
            const dx = ev.clientX - startX;
            const newRatio = Math.max(25, Math.min(60, startRatio + (dx / window.innerWidth) * 100));
            setSplitRatio(newRatio);
          };
          const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
      />

      {/* Right Pane — Credit Cockpit */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-caos-border bg-caos-panel shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              data-testid="cockpit-tab"
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-caos ${
                activeTab === tab.key
                  ? "bg-caos-accent text-white"
                  : "text-caos-muted hover:text-caos-text hover:bg-caos-elevated"
              }`}
            >
              {tab.label}
              {tab.key === "covenants" &&
                agentOutputs?.cp4c?.headroom_items?.some((h) => h.severity === "CRITICAL") && (
                  <span className="ml-1.5 w-1.5 h-1.5 bg-red-500 rounded-full inline-block" />
                )}
            </button>
          ))}
          <div className="flex-1" />
          {agentOutputs?.blocked_modules && agentOutputs.blocked_modules.length > 0 && (
            <span className="tabular text-xs text-red-400 bg-red-900/30 px-2 py-1 rounded">
              {agentOutputs.blocked_modules.length} blocked
            </span>
          )}
        </div>

        {/* Content row: main view + persistent Evidence Trace panel */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-auto">
            {!agentOutputs ? (
              <EmptyState />
            ) : activeTab === "analysis" ? (
              <AnalysisTab agentOutputs={agentOutputs} />
            ) : (
              <div className="p-4">
                {activeTab === "financials" && <FinancialsChart data={agentOutputs.cp2} />}
                {activeTab === "liquidity" && <LiquidityWaterfall data={agentOutputs.cp4c} />}
                {activeTab === "covenants" && <CovenantGauges data={agentOutputs.cp4c} />}
                {activeTab === "rv" && <RVScatterPlot data={agentOutputs.cp3} />}
                {activeTab === "debate" && <DebateMatrix data={agentOutputs.cp6e} />}
              </div>
            )}
          </div>

          {/* Evidence Trace — dedicated panel (Blueprint §3, §4) */}
          <aside className="w-80 shrink-0 border-l border-caos-border bg-caos-bg hidden lg:flex flex-col">
            <EvidenceTracePanel />
          </aside>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <div className="text-4xl mb-4">⚡</div>
      <p className="text-gray-300 font-medium mb-2">No analysis yet</p>
      <p className="text-caos-muted text-sm max-w-xs">
        Upload the canonical documents (OM, Credit Agreement, LBO Model) then trigger a DAG run.
      </p>
    </div>
  );
}
