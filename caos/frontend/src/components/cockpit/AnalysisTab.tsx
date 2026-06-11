"use client";

import type { AgentOutputs } from "@/types/agents";
import { NarrativeBlock } from "@/components/narrative/NarrativeBlock";
import { FinancialsChart } from "./FinancialsChart";
import { RVScatterPlot } from "./RVScatterPlot";
import { CovenantGauges } from "./CovenantGauges";
import { DebateMatrix } from "./DebateMatrix";
import { useAnalysisStore } from "@/store/analysis";

function Section({
  tag,
  title,
  children,
}: {
  tag: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="tabular text-[10px] px-1.5 py-0.5 rounded bg-caos-accent/15 text-caos-accent border border-caos-accent/30">
          {tag}
        </span>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function AnalysisTab({ agentOutputs }: { agentOutputs: AgentOutputs | null }) {
  const conclusions = useAnalysisStore((s) => s.conclusions);
  const o = (agentOutputs ?? {}) as Record<string, any>;

  if (!agentOutputs) {
    return (
      <div className="flex items-center justify-center h-full text-caos-muted text-sm">
        No analysis yet — run the pipeline.
      </div>
    );
  }

  const chainOf = (id: string) => conclusions[id]?.evidence_chain ?? [];

  return (
    <div className="h-full overflow-auto px-5 py-5">
      {/* CP-2 — Fundamental Credit Review */}
      {o.cp2 && (
        <Section tag="CP-2 · L2" title="Fundamental Credit Review">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            <NarrativeBlock
              markdown={o.cp2.credit_thesis_md ?? o.cp2.business_description ?? ""}
              conclusionId="cp2.thesis"
              chain={chainOf("cp2.thesis")}
            />
            <div className="min-h-[280px]"><FinancialsChart data={agentOutputs.cp2} /></div>
          </div>
        </Section>
      )}

      {/* CP-3 — Relative Value */}
      {o.cp3 && (
        <Section tag="CP-3 · L3" title="Relative Value Assessment">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            <NarrativeBlock
              markdown={o.cp3.rv_commentary_md ?? o.cp3.rv_commentary ?? ""}
              conclusionId="cp3.subject"
              chain={chainOf("cp3.subject")}
            />
            <div className="min-h-[280px]"><RVScatterPlot data={agentOutputs.cp3} /></div>
          </div>
        </Section>
      )}

      {/* CP-4C — Covenant Capacity */}
      {o.cp4c && (
        <Section tag="CP-4C · L4" title="Covenant Capacity & Headroom">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            <NarrativeBlock
              markdown={o.cp4c.capacity_commentary_md ?? "Covenant headroom summarized at right; click a row to trace its source."}
              conclusionId="cp4c.summary"
              chain={chainOf("cp4c.summary")}
            />
            <div className="min-h-[280px]"><CovenantGauges data={agentOutputs.cp4c} /></div>
          </div>
        </Section>
      )}

      {/* CP-6E — Debate Rationale */}
      {o.cp6e && (
        <Section tag="CP-6E · L6" title="Investment Committee Debate Rationale">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            <NarrativeBlock
              markdown={o.cp6e.debate_rationale_md ?? o.cp6e.final_recommendation ?? ""}
              conclusionId="cp6e.consensus"
              chain={chainOf("cp6e.consensus")}
            />
            <div><DebateMatrix data={agentOutputs.cp6e} /></div>
          </div>
        </Section>
      )}
    </div>
  );
}
