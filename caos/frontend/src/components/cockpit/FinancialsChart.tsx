"use client";

import { useEffect, useRef } from "react";
import type { AgentOutputs } from "@/types/agents";

interface Props {
  data: AgentOutputs["cp2"];
}

export function FinancialsChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data || !containerRef.current) return;

    // Dynamically import AntV G2 to avoid SSR issues
    import("@antv/g2").then(({ Chart }) => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = "";

      const periods = [...(data.historical_periods || []), data.ltm_period].filter(Boolean);
      const chartData: Record<string, unknown>[] = [];

      periods.forEach((p) => {
        chartData.push({ period: p.period, type: "Revenue", value: p.revenue_mm });
        chartData.push({ period: p.period, type: "EBITDA", value: p.ebitda_mm });
      });

      const chart = new Chart({
        container: containerRef.current,
        autoFit: true,
        height: 320,
        theme: "dark",
      });

      chart.options({
        type: "view",
        data: chartData,
        children: [
          {
            type: "interval",
            encode: { x: "period", y: "value", color: "type", series: "type" },
            transform: [{ type: "dodgeX" }],
            style: { fillOpacity: 0.85 },
            scale: { color: { range: ["#3b82f6", "#10b981"] } },
          },
          {
            type: "line",
            data: periods.map((p) => ({
              period: p.period,
              margin: (p.ebitda_margin_pct * 100).toFixed(1),
            })),
            encode: { x: "period", y: "margin", shape: "smooth" },
            style: { stroke: "#f59e0b", lineWidth: 2 },
            axis: { y: { position: "right", title: "EBITDA Margin (%)" } },
          },
        ],
      });

      chart.render();
      return () => chart.destroy();
    });
  }, [data]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        No financial data — run CP-2.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-white font-semibold text-sm">Historical Financials</h2>
        <p className="text-gray-500 text-xs mt-0.5">Revenue / EBITDA (bars) · EBITDA Margin % (line)</p>
      </div>
      <div ref={containerRef} className="w-full" />

      {/* KPI summary strip */}
      {data.ltm_period && (
        <div className="grid grid-cols-4 gap-3 mt-6">
          {[
            { label: "LTM Revenue", value: `$${data.ltm_period.revenue_mm?.toLocaleString()}mm` },
            { label: "LTM EBITDA", value: `$${data.ltm_period.ebitda_mm?.toLocaleString()}mm` },
            { label: "Net Leverage", value: `${data.ltm_period.net_leverage_x}x` },
            { label: "Interest Cov.", value: `${data.ltm_period.interest_coverage_x}x` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className="text-white font-semibold">{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
