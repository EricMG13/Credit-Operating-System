"use client";

import { StatCard } from "@/components/shared/StatCard";

type Signals = Record<string, number | string | boolean | null>;

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function LiveCovenantCapacity({ signals }: { signals: Signals }) {
  const rp = signals.rp_basket_musd;
  const headroom = signals.covenant_headroom_turns;
  const addbackCap = signals.addback_cap_pct;
  const addbackUtil = signals.addback_utilization_pct;
  const hasData = [rp, headroom, addbackCap, addbackUtil].some(finite);

  if (!hasData) {
    return (
      <div className="px-3 py-3 border-t border-caos-border tabular text-caos-xs text-caos-muted">
        CP-4C did not extract live basket-capacity terms for this issuer.
      </div>
    );
  }

  return (
    <section className="p-3 border-t border-caos-border" aria-labelledby="live-covenant-capacity-title">
      <h3 id="live-covenant-capacity-title" className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-2">
        Live covenant capacity · CP-4C
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <StatCard
          value={finite(rp) ? `$${rp.toLocaleString()}M` : "—"}
          label="RP basket usable today"
          sub="governing-document extraction"
          sev={finite(rp) ? "warning" : undefined}
        />
        <StatCard
          value={finite(headroom) ? `${headroom.toFixed(2)}x` : "—"}
          label="Covenant headroom"
          sub="threshold less current leverage"
          sev={finite(headroom) && headroom < 1 ? "critical" : undefined}
        />
        <StatCard
          value={finite(addbackCap) ? `${(addbackCap * 100).toFixed(0)}%` : "—"}
          label="EBITDA add-back cap"
          sub={finite(addbackUtil) ? `${addbackUtil.toFixed(0)}% utilized` : "utilization unavailable"}
          sev={signals.addback_breach === true ? "critical" : finite(addbackCap) ? "warning" : undefined}
        />
      </div>
    </section>
  );
}
