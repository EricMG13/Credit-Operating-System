"use client";

// Live coverage board — the engine-derived counterpart to the seeded sample
// PortfolioTable. Shows each covered issuer's latest-complete-run FUNDAMENTALS
// (net leverage, interest coverage, CP-3 RV posture, CP-2B downside fragility,
// QA status). Deliberately NOT a clone of the sample board: the market columns
// (price / DM / Δ d/d / M2E) are an external pricing feed (Phase-2,
// docs/PHASE2_SCOPE.md) and are simply absent here, not faked.

import type { PortfolioRowDTO } from "@/lib/api";

const fmtX = (v: number | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(1) + "x" : "—";

// Fragility / posture meaning never rides on colour alone — the word travels too.
const FRAGILITY_COLOR: Record<string, string> = {
  HIGH: "var(--caos-critical)", MODERATE: "var(--caos-warning)", LOW: "var(--caos-success)",
};
const RV_COLOR: Record<string, string> = {
  OVERWEIGHT: "var(--caos-success)", NEUTRAL: "var(--caos-muted)", UNDERWEIGHT: "var(--caos-critical)",
};
const QA_COLOR: Record<string, string> = {
  Pass: "var(--caos-success)", "Ready with Limitations": "var(--caos-warning)",
  Blocked: "var(--caos-critical)",
};

const COLS = "grid grid-cols-[1.6fr_1fr_0.7fr_0.7fr_1fr_0.9fr_1fr] gap-2 items-center";

export function LiveCoverage({ rows }: { rows: PortfolioRowDTO[] }) {
  const th = "tabular text-caos-xs uppercase tracking-wider text-caos-muted";
  return (
    <div className="text-caos-xl" style={{ minWidth: 760 }}>
      <div className={COLS + " px-3 h-7 border-b border-caos-border sticky top-0 bg-caos-panel z-10"}>
        {["Issuer", "Sector", "NetLev", "IntCov", "RV posture", "Fragility", "QA"].map((h, i) => (
          <span key={h} className={th + ([2, 3].includes(i) ? " text-right" : "")}>{h}</span>
        ))}
      </div>
      {rows.map((r) => {
        const rv = r.rv_recommendation;
        const frag = r.downside_fragility;
        return (
          <div key={r.issuer_id} className={COLS + " px-3 py-[5px] border-b border-caos-border/50"}>
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="tabular text-caos-accent">{r.ticker || "—"}</span>
              <span className="text-caos-text truncate text-caos-lg">{r.name}</span>
            </span>
            <span className="text-caos-muted text-caos-md truncate">{r.sector || "—"}</span>
            <span className="tabular text-right">{fmtX(r.metrics.net_leverage)}</span>
            <span className="tabular text-right">{fmtX(r.metrics.interest_coverage)}</span>
            <span className="tabular text-caos-xs tracking-wide" style={{ color: rv ? RV_COLOR[rv] ?? "var(--caos-text)" : "var(--caos-idle)" }}>
              {rv ?? "—"}{typeof r.rv_percentile === "number" ? ` · p${Math.round(r.rv_percentile)}` : ""}
            </span>
            <span className="tabular text-caos-xs tracking-wide" style={{ color: frag ? FRAGILITY_COLOR[frag] : "var(--caos-idle)" }}>
              {frag ? `${frag === "HIGH" ? "▲" : frag === "MODERATE" ? "■" : "●"} ${frag}` : "—"}
            </span>
            <span
              className="tabular text-caos-2xs px-1 py-px rounded border whitespace-nowrap justify-self-start"
              style={{ color: QA_COLOR[r.qa_status] ?? "var(--caos-muted)", borderColor: QA_COLOR[r.qa_status] ?? "var(--caos-border)" }}
              title={`Committee: ${r.committee_status}`}
            >
              {r.qa_status}
            </span>
          </div>
        );
      })}
    </div>
  );
}
