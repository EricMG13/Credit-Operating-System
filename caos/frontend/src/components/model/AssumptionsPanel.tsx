"use client";

// Concept D — Assumptions panel. Lets the analyst nudge the agent's BASE and
// DOWNSIDE forecast drivers (segment growth, margins, D&A, cash-flow lines) via
// sliders; changes flow into buildModel and recompute the grid + scenario lens.
// Each slider is an adjustment to the agent's baseline — centered = the agent's
// own call. The derived lines (FFO/CFO/FCF/NCF/cash/leverage) move dynamically.

import { Panel } from "@/components/shared/Panel";
import {
  type Assumptions, type CaseAssumptions, DEFAULT_CASE, caseModifiedCount,
} from "@/lib/reports/assumptions";

/* ---------- formatters ---------- */
const pp = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "±") + (Math.abs(v) * 100).toFixed(2).replace(/0$/, "") + "pp";
const pct = (v: number) => (v * 100).toFixed(1) + "%";
const mult = (v: number) => "×" + v.toFixed(2);
const usd = (v: number) => (v === 0 ? "$0" : (v < 0 ? "(" : "") + "$" + Math.abs(v) + (v < 0 ? ")" : "") + "M");

interface SliderSpec {
  key: keyof CaseAssumptions;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
}

// Slider groups, in display order. Mirrors the agent's forecast drivers; cash
// flow lists every line except the derived ones (FFO/CFO/FCF/NCF) and the two
// "Other" lines, which stay on the agent's baseline.
const GROUPS: { title: string; items: SliderSpec[] }[] = [
  { title: "Revenue growth (Δ / yr)", items: [
    { key: "gDrive", label: "Drivetrain", min: -0.1, max: 0.1, step: 0.0025, fmt: pp },
    { key: "gFluid", label: "Fluid Systems", min: -0.1, max: 0.1, step: 0.0025, fmt: pp },
    { key: "gAfter", label: "Aftermarket & Services", min: -0.1, max: 0.1, step: 0.0025, fmt: pp },
  ] },
  { title: "Margins", items: [
    { key: "dGpm", label: "Gross margin (Δ)", min: -0.05, max: 0.05, step: 0.0025, fmt: pp },
    { key: "dAdjm", label: "Adj. EBITDA margin (Δ)", min: -0.05, max: 0.05, step: 0.0025, fmt: pp },
    { key: "daPct", label: "D&A % of sales", min: 0.02, max: 0.08, step: 0.0025, fmt: pct },
  ] },
  { title: "Cash flow (× agent baseline)", items: [
    { key: "mInt", label: "Cash interest", min: 0.5, max: 1.5, step: 0.05, fmt: mult },
    { key: "mLeases", label: "Leases", min: 0.5, max: 1.5, step: 0.05, fmt: mult },
    { key: "mTax", label: "Cash taxes", min: 0.5, max: 1.5, step: 0.05, fmt: mult },
    { key: "mWc", label: "Changes in WC", min: 0.5, max: 1.5, step: 0.05, fmt: mult },
    { key: "mCapex", label: "Capex", min: 0.5, max: 1.5, step: 0.05, fmt: mult },
    { key: "mAcq", label: "Acquisitions", min: 0.5, max: 1.5, step: 0.05, fmt: mult },
    { key: "mDiss", label: "Debt issue/(repay)", min: 0.5, max: 1.5, step: 0.05, fmt: mult },
    { key: "divDelta", label: "Dividends ($/yr)", min: -150, max: 0, step: 5, fmt: usd },
  ] },
];

function Slider({ spec, value, accent, onChange }: {
  spec: SliderSpec;
  value: number;
  accent: string;
  onChange: (v: number) => void;
}) {
  const modified = value !== DEFAULT_CASE[spec.key];
  return (
    <label className="flex flex-col gap-0.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="tabular text-caos-2xs text-caos-text/80 truncate">{spec.label}</span>
        <span className="tabular text-caos-2xs shrink-0" style={{ color: modified ? accent : "var(--caos-muted)" }}>
          {spec.fmt(value)}
        </span>
      </span>
      <input
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        aria-label={spec.label}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 cursor-pointer"
        style={{ accentColor: accent }}
      />
    </label>
  );
}

function CaseBlock({ title, accent, ca, onChange, onReset }: {
  title: string;
  accent: string;
  ca: CaseAssumptions;
  onChange: (k: keyof CaseAssumptions, v: number) => void;
  onReset: () => void;
}) {
  const changed = caseModifiedCount(ca);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ background: accent }} />
        <span className="tabular text-caos-xs uppercase tracking-wider font-semibold" style={{ color: accent }}>{title}</span>
        <span className="flex-1" />
        {changed > 0 ? (
          <button
            onClick={onReset}
            title={`Reset ${changed} change${changed > 1 ? "s" : ""} to the agent's forecast`}
            className="tabular text-caos-3xs px-1.5 py-px rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos whitespace-nowrap"
          >
            ↶ {changed}
          </button>
        ) : null}
      </div>
      {GROUPS.map((g) => (
        <div key={g.title} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted whitespace-nowrap">{g.title}</span>
            <span className="h-px flex-1 bg-caos-border/60" />
          </div>
          {g.items.map((spec) => (
            <Slider key={spec.key} spec={spec} value={ca[spec.key]} accent={accent} onChange={(v) => onChange(spec.key, v)} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function AssumptionsPanel({ assumptions, onChange, onResetCase }: {
  assumptions: Assumptions;
  onChange: (caseKey: "base" | "down", field: keyof CaseAssumptions, value: number) => void;
  onResetCase: (caseKey: "base" | "down") => void;
}) {
  return (
    <Panel title="Assumptions · forecast drivers" className="w-[244px] shrink-0">
      <div className="p-2.5 flex flex-col gap-4">
        <p className="tabular text-caos-2xs text-caos-muted leading-snug">
          Nudge the agent&apos;s forecast. Centered = the agent&apos;s call; derived lines recompute.
        </p>
        <CaseBlock
          title="Base forecast"
          accent="var(--caos-success)"
          ca={assumptions.base}
          onChange={(k, v) => onChange("base", k, v)}
          onReset={() => onResetCase("base")}
        />
        <div className="border-t border-caos-border" />
        <CaseBlock
          title="Downside forecast"
          accent="var(--caos-warning)"
          ca={assumptions.down}
          onChange={(k, v) => onChange("down", k, v)}
          onReset={() => onResetCase("down")}
        />
      </div>
    </Panel>
  );
}
