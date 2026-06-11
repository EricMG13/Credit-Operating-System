"use client";

import type { AgentOutputs, DebateAgentOutput, Posture } from "@/types/agents";

interface Props {
  data: AgentOutputs["cp6e"];
}

const POSTURE_COLORS: Record<Posture, string> = {
  BUY: "bg-emerald-900/40 text-emerald-400 border-emerald-800",
  HOLD: "bg-blue-900/40 text-blue-400 border-blue-800",
  SELL: "bg-amber-900/40 text-amber-400 border-amber-800",
  AVOID: "bg-red-900/40 text-red-400 border-red-800",
  SPLIT: "bg-purple-900/40 text-purple-400 border-purple-800",
};

const PERSONA_ICONS: Record<string, string> = {
  RV_TRADER: "📈",
  COMPLIANCE: "⚖️",
  CIO: "🎯",
};

function ConvictionDots({ value }: { value: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${i < value ? "bg-blue-400" : "bg-gray-700"}`}
        />
      ))}
    </div>
  );
}

function AgentCard({ agent }: { agent: DebateAgentOutput }) {
  const postureStyle = POSTURE_COLORS[agent.posture] || POSTURE_COLORS.HOLD;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{PERSONA_ICONS[agent.persona] || "🤖"}</span>
          <div>
            <div className="text-white text-sm font-medium">{agent.persona.replace("_", " ")}</div>
            <ConvictionDots value={agent.conviction} />
          </div>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded border ${postureStyle}`}>
          {agent.posture}
        </span>
      </div>
      <p className="text-gray-300 text-xs leading-relaxed mb-3">{agent.thesis}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-red-400 mb-1 font-medium">Risks</div>
          {agent.key_risks.slice(0, 2).map((r, i) => (
            <div key={i} className="text-gray-500 text-xs">· {r}</div>
          ))}
        </div>
        <div>
          <div className="text-xs text-emerald-400 mb-1 font-medium">Supports</div>
          {agent.key_supports.slice(0, 2).map((s, i) => (
            <div key={i} className="text-gray-500 text-xs">· {s}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DebateMatrix({ data }: Props) {
  if (!data?.debate_agents?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        No debate data — run CP-6E.
      </div>
    );
  }

  const consensusStyle = POSTURE_COLORS[data.consensus_posture] || POSTURE_COLORS.HOLD;

  return (
    <div>
      {/* Consensus banner */}
      <div className={`mb-5 p-4 rounded-xl border ${consensusStyle} bg-opacity-20`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">Consensus: {data.consensus_posture}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Composite Score</span>
            <span className="text-white font-bold text-lg">{data.composite_score}/100</span>
          </div>
        </div>
        <p className="text-gray-300 text-xs leading-relaxed">{data.final_recommendation}</p>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {data.debate_agents.map((agent) => (
          <AgentCard key={agent.persona} agent={agent} />
        ))}
      </div>
    </div>
  );
}
