"use client";

import type { AgentOutputs, CovenantHeadroom } from "@/types/agents";
import { useSelectionStore } from "@/store/selection";

interface Props {
  data: AgentOutputs["cp4c"];
}

/** Stable conclusion id for a covenant row (matches the analysis registry). */
export const covenantConclusionId = (name: string) =>
  "cp4c." + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const SEVERITY_COLORS = {
  OK: { bar: "bg-emerald-500", text: "text-emerald-400", badge: "bg-emerald-900/30 text-emerald-400" },
  WARNING: { bar: "bg-amber-500", text: "text-amber-400", badge: "bg-amber-900/30 text-amber-400" },
  CRITICAL: { bar: "bg-red-500", text: "text-red-400", badge: "bg-red-900/30 text-red-400 animate-pulse" },
};

function BulletGauge({ item }: { item: CovenantHeadroom }) {
  const colors = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.OK;
  const usedPct = Math.min(100, 100 - item.headroom_pct);
  const { select, conclusionId } = useSelectionStore();
  const id = covenantConclusionId(item.covenant_name);
  const active = conclusionId === id;

  return (
    <div
      onClick={() => select(id, "covenant")}
      className={`bg-caos-panel border rounded-lg p-4 cursor-pointer transition-caos ${
        active ? "border-caos-accent caos-selected" : "border-caos-border hover:border-caos-accent/50"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-300 text-sm font-medium">{item.covenant_name}</span>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${colors.badge}`}>
          {item.severity}
        </span>
      </div>

      {/* Bullet chart bar */}
      <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden mb-2">
        {/* Warning threshold at 75% */}
        <div className="absolute left-[75%] top-0 h-full w-px bg-amber-500/50 z-10" />
        {/* Critical threshold at 90% */}
        <div className="absolute left-[90%] top-0 h-full w-px bg-red-500/50 z-10" />
        {/* Utilization fill */}
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
          style={{ width: `${usedPct}%` }}
        />
      </div>

      <div className="flex justify-between text-xs">
        <span className="text-gray-500">
          Actual: <span className="text-gray-300">{item.actual_value}</span>
        </span>
        <span className="text-gray-500">
          Limit: <span className="text-gray-300">{item.limit_value}</span>
        </span>
        <span className={colors.text}>
          {item.headroom_pct?.toFixed(1)}% headroom
        </span>
      </div>
    </div>
  );
}

export function CovenantGauges({ data }: Props) {
  if (!data?.headroom_items?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        No covenant data — run CP-4C.
      </div>
    );
  }

  const criticalItems = data.headroom_items.filter((h) => h.severity === "CRITICAL");
  const otherItems = data.headroom_items.filter((h) => h.severity !== "CRITICAL");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-sm">Covenant Headroom</h2>
          <p className="text-gray-500 text-xs mt-0.5">Utilization vs. limit · Alert at &gt;75% (warning), &gt;90% (critical)</p>
        </div>
        {data.liquidity_runway_months && (
          <div className="text-right">
            <div className="text-xs text-gray-500">Liquidity Runway</div>
            <div className="text-white font-bold">{data.liquidity_runway_months}mo</div>
          </div>
        )}
      </div>

      {criticalItems.length > 0 && (
        <div className="mb-3 p-3 bg-red-950/30 border border-red-900/50 rounded-lg">
          <p className="text-red-400 text-xs font-medium">
            ⚠ {criticalItems.length} covenant{criticalItems.length > 1 ? "s" : ""} in CRITICAL breach territory
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {[...criticalItems, ...otherItems].map((item) => (
          <BulletGauge key={item.covenant_name} item={item} />
        ))}
      </div>
    </div>
  );
}
