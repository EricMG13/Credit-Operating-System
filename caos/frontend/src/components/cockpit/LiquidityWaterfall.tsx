"use client";

import { useEffect, useRef } from "react";
import type { AgentOutputs } from "@/types/agents";

interface Props {
  data: AgentOutputs["cp4c"];
}

export function LiquidityWaterfall({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data || !containerRef.current) return;

    import("@antv/g2").then(({ Chart }) => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = "";

      const runway = data.liquidity_runway_months || 0;
      const rcf = data.rcf_availability_mm || 0;

      // Build step-down waterfall data (months to empty simulation)
      const waterfallData = Array.from({ length: Math.min(Math.ceil(runway), 24) }, (_, i) => ({
        month: `M${i + 1}`,
        liquidity: Math.max(0, 100 - (100 / runway) * (i + 1)),
      }));

      const chart = new Chart({
        container: containerRef.current,
        autoFit: true,
        height: 280,
        theme: "dark",
      });

      chart.options({
        type: "area",
        data: waterfallData,
        encode: { x: "month", y: "liquidity", shape: "smooth" },
        style: { fill: "l(90) 0:#3b82f6 1:transparent", fillOpacity: 0.4, stroke: "#3b82f6" },
        axis: {
          y: { title: "Liquidity (%)", grid: { stroke: "#1f2937" } },
          x: { title: "Forward Months" },
        },
      });

      chart.render();
      return () => chart.destroy();
    });
  }, [data]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-white font-semibold text-sm">Liquidity Runway</h2>
        <p className="text-gray-500 text-xs mt-0.5">Step-down projection · Months to empty</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Runway</div>
          <div className="text-2xl font-bold text-white">{data?.liquidity_runway_months ?? "—"}<span className="text-sm text-gray-400 ml-1">months</span></div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">RCF Availability</div>
          <div className="text-2xl font-bold text-white">
            {data?.rcf_availability_mm ? `$${data.rcf_availability_mm}mm` : "—"}
          </div>
        </div>
      </div>

      <div ref={containerRef} className="w-full" />
    </div>
  );
}
