"use client";

import { useEffect, useRef } from "react";
import type { AgentOutputs } from "@/types/agents";
import { useSelectionStore } from "@/store/selection";

interface Props {
  data: AgentOutputs["cp3"];
}

export function RVScatterPlot({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const select = useSelectionStore((s) => s.select);

  useEffect(() => {
    if (!data || !containerRef.current) return;

    let chart: { destroy: () => void } | null = null;
    import("@antv/g2").then(({ Chart }) => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = "";

      const d = data as Record<string, any>;
      const comparables: any[] = d.comparables || [];
      const scatterData = [
        {
          name: "Subject",
          net_leverage: Number(d.subject_net_leverage_x ?? 4.7),
          spread: d.subject_spread_bps,
          type: "subject",
        },
        ...comparables.map((c: any) => ({
          name: c.issuer_name,
          net_leverage: Number(c.net_leverage_x),
          spread: Number(c.spread_bps),
          type: "comparable",
        })),
      ];

      const c = new Chart({
        container: containerRef.current,
        autoFit: true,
        height: 300,
        theme: "dark",
      });
      chart = c;

      c.options({
        type: "point",
        data: scatterData,
        encode: {
          x: "net_leverage",
          y: "spread",
          color: "type",
          shape: "point",
          size: (row: Record<string, unknown>) => (row.type === "subject" ? 14 : 7),
        },
        scale: {
          color: { domain: ["subject", "comparable"], range: ["#f5a524", "#4f8cff"] },
        },
        axis: {
          x: { title: "Net Leverage (x)" },
          y: { title: "Spread (bps)" },
        },
        labels: [
          { text: "name", style: { fill: "#9ca3af", fontSize: 10 }, transform: [{ type: "overlapHide" }] },
        ],
        tooltip: { items: ["name", "net_leverage", "spread"] },
        style: { cursor: "pointer" },
      });

      c.render();

      // Click the target (subject) bubble → drive the Evidence Trace
      c.on("element:click", (e: { data?: { data?: { type?: string } } }) => {
        if (e?.data?.data?.type === "subject") select("cp3.subject", "scatter");
      });
    });
    return () => chart?.destroy();
  }, [data, select]);

  const verdictColors: Record<string, string> = {
    CHEAP: "text-emerald-400",
    FAIR: "text-blue-400",
    RICH: "text-amber-400",
  };

  return (
    <div>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="text-white font-semibold text-sm">Relative Value</h2>
          <p className="text-caos-muted text-xs mt-0.5">Click the amber target to trace its lineage</p>
        </div>
        {data?.fair_value_verdict && (
          <span className={`tabular text-sm font-bold ${verdictColors[data.fair_value_verdict] || "text-gray-400"}`}>
            {data.fair_value_verdict}
          </span>
        )}
      </div>

      <div ref={containerRef} className="w-full" />
    </div>
  );
}
