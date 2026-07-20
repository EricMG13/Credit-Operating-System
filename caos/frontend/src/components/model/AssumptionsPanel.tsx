"use client";

// Concept D — Assumptions panel. Lets the analyst nudge the agent's forecast
// drivers (segment growth, margins, D&A, cash-flow lines); changes flow into
// buildModel and recompute the grid + scenario lens. Centered = the agent's own
// call; derived lines (FFO/CFO/FCF/NCF/cash/leverage) move dynamically.
//
// Layout: one case at a time (BASE / DOWNSIDE toggle), each driver edited
// side-by-side across years. The ALL column broadcasts to every year; a year
// column (FY26e/FY27e/FY28e) pins that year only and overrides ALL for it.

import { useEffect, useRef, useState } from "react";
import { Panel } from "@/components/shared/Panel";
import { CollapseButton } from "@/components/shared/CollapseButton";
import {
  type CaseAssumptions, type FY, type YearOverrides, type Assumptions,
  ADDBACKS, DEFAULT_CASE, FORECAST_LABELS, caseModifiedCount, yearModifiedCount,
} from "@/lib/reports/assumptions";

interface DriverSpec {
  key: keyof CaseAssumptions;
  label: string;
  min: number;  // model units
  max: number;
  step: number;
  scale: number; // model → display multiplier
  dp: number;    // display decimals
  unit: string;
}

// Driver groups, in display order. Cash flow lists every line except the derived
// ones (FFO/CFO/FCF/NCF) and the two "Other" lines, which stay on the baseline.
const GROUPS: { title: string; items: DriverSpec[] }[] = [
  { title: "Revenue growth (Δ / yr)", items: [
    { key: "gDrive", label: "Drivetrain", min: -0.1, max: 0.1, step: 0.0025, scale: 100, dp: 2, unit: "pp" },
    { key: "gFluid", label: "Fluid Systems", min: -0.1, max: 0.1, step: 0.0025, scale: 100, dp: 2, unit: "pp" },
    { key: "gAfter", label: "Aftermarket", min: -0.1, max: 0.1, step: 0.0025, scale: 100, dp: 2, unit: "pp" },
  ] },
  { title: "Margins", items: [
    { key: "dGpm", label: "Gross margin Δ", min: -0.05, max: 0.05, step: 0.0025, scale: 100, dp: 2, unit: "pp" },
    { key: "dAdjm", label: "Adj. EBITDA margin Δ", min: -0.05, max: 0.05, step: 0.0025, scale: 100, dp: 2, unit: "pp" },
    { key: "daPct", label: "D&A % of sales", min: 0.02, max: 0.08, step: 0.0025, scale: 100, dp: 1, unit: "%" },
  ] },
  { title: "Cash flow (× agent baseline)", items: [
    { key: "mInt", label: "Cash interest", min: 0.5, max: 5, step: 0.05, scale: 1, dp: 2, unit: "×" },
    { key: "mLeases", label: "Leases", min: 0.5, max: 5, step: 0.05, scale: 1, dp: 2, unit: "×" },
    { key: "mTax", label: "Cash taxes", min: 0.5, max: 5, step: 0.05, scale: 1, dp: 2, unit: "×" },
    { key: "mWc", label: "Changes in WC", min: 0.5, max: 5, step: 0.05, scale: 1, dp: 2, unit: "×" },
    { key: "mCapex", label: "Capex", min: 0.5, max: 5, step: 0.05, scale: 1, dp: 2, unit: "×" },
    { key: "mAcq", label: "Acquisitions", min: 0.5, max: 5, step: 0.05, scale: 1, dp: 2, unit: "×" },
    { key: "mDiss", label: "Debt issue/(repay)", min: 0.5, max: 5, step: 0.05, scale: 1, dp: 2, unit: "×" },
    { key: "divDelta", label: "Dividends", min: -150, max: 0, step: 5, scale: 1, dp: 0, unit: "$" },
  ] },
  { title: "Base rates", items: [
    { key: "sofrRate", label: "SOFR", min: 0, max: 0.12, step: 0.0005, scale: 100, dp: 2, unit: "%" },
    { key: "euriborRate", label: "EURIBOR", min: 0, max: 0.12, step: 0.0005, scale: 100, dp: 2, unit: "%" },
    { key: "soniaRate", label: "SONIA", min: 0, max: 0.12, step: 0.0005, scale: 100, dp: 2, unit: "%" },
  ] },
  { title: "Add-backs (× agent register · 1 = accept)", items: ADDBACKS.map(
    (a): DriverSpec => ({ key: a.key, label: a.label, min: 0, max: 1.5, step: 0.05, scale: 1, dp: 2, unit: "×" }),
  ) },
];

const GRID = "grid grid-cols-[1fr_repeat(4,40px)] gap-1 items-center";
const CELL =
  "w-full h-6 px-1 text-right tabular text-caos-xs rounded border bg-caos-elevated cursor-ew-resize select-none " +
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none " +
  "focus:outline-none focus:border-caos-accent";

// Horizontal drag sensitivity: px of travel per one driver step.
const PX_PER_STEP = 4;

// A value cell that is both a number input (click to type) and a horizontal
// scrubber (drag left/right to step the value, like a Figma/Blender field).
// Drag only engages past a 3px threshold, so a plain click still focuses to type.
function Cell({ spec, model, modified, accent, label, clearLabel, onChange, onReset, onScrub, onScrubEnd }: {
  spec: DriverSpec;
  model: number;
  modified: boolean;
  accent: string;
  label: string;
  // When set on a MODIFIED cell, a visible, keyboard-operable clear (✕) button
  // is rendered so per-cell reset is discoverable (double-click stays a shortcut).
  clearLabel?: string;
  onChange: (v: number) => void;
  onReset: () => void;
  onScrub?: () => void;
  onScrubEnd?: () => void;
}) {
  const disp = +(model * spec.scale).toFixed(spec.dp);
  const drag = useRef<{ x: number; v: number; moved: boolean } | null>(null);
  const set = (raw: number) => onChange(Math.max(spec.min, Math.min(spec.max, Math.round(raw * 1e6) / 1e6)));
  const showClear = !!clearLabel && modified;
  const input = (
    <input
      type="number"
      name={`assumption-${spec.key}`}
      autoComplete="off"
      value={disp}
      step={spec.step * spec.scale}
      min={spec.min * spec.scale}
      max={spec.max * spec.scale}
      aria-label={label}
      title={`${label} — drag to adjust, type, or double-click to reset`}
      onChange={(e) => {
        const d = parseFloat(e.target.value);
        if (!Number.isNaN(d)) set(d / spec.scale);
      }}
      onDoubleClick={onReset}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        drag.current = { x: e.clientX, v: model, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        if (!d.moved && Math.abs(dx) < 3) return;
        if (!d.moved) { d.moved = true; e.currentTarget.blur(); onScrub?.(); } // stop caret + flag affected sheet cells
        e.preventDefault();
        set(d.v + Math.round(dx / PX_PER_STEP) * spec.step);
      }}
      onPointerUp={(e) => {
        if (drag.current) { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} }
        if (drag.current?.moved) onScrubEnd?.();
        drag.current = null;
      }}
      onPointerCancel={() => { if (drag.current?.moved) onScrubEnd?.(); drag.current = null; }}
      className={CELL}
      style={{
        borderColor: modified ? accent : "var(--caos-border)",
        color: modified ? accent : "var(--caos-text)",
        touchAction: "none",
      }}
    />
  );
  if (!showClear) return input;
  // Reveal on hover/focus-within so an unmodified column stays clean; the button
  // is keyboard-reachable (Tab) and always visible while the cell is a target.
  return (
    <span className="relative block group/cell">
      {input}
      <button
        type="button"
        onClick={onReset}
        aria-label={clearLabel}
        title={clearLabel}
        className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center rounded-sm border bg-caos-panel tabular text-caos-3xs leading-none text-caos-muted opacity-0 group-hover/cell:opacity-100 group-focus-within/cell:opacity-100 focus:opacity-100 focus:outline-none hover:text-caos-text focus:text-caos-text transition-caos"
        style={{ borderColor: accent }}
      >
        ✕
      </button>
    </span>
  );
}

type DriverCallbacks = {
  onChange: (caseKey: "base" | "down", field: keyof CaseAssumptions, value: number) => void;
  onChangeYear: (caseKey: "base" | "down", year: FY, field: keyof CaseAssumptions, value: number) => void;
  onResetYearCell: (caseKey: "base" | "down", year: FY, field: keyof CaseAssumptions) => void;
  onScrub?: (caseKey: "base" | "down", field: keyof CaseAssumptions, scope: "all" | FY) => void;
  onScrubEnd?: () => void;
};

type DriverContext = DriverCallbacks & {
  caseKey: "base" | "down";
  ca: CaseAssumptions;
  yearsOv: YearOverrides;
  accent: string;
};

function DriverRow({ spec, caseKey, ca, yearsOv, accent, onChange, onChangeYear, onResetYearCell, onScrub, onScrubEnd }: DriverContext & { spec: DriverSpec }) {
  return (
    <div className={GRID}>
      <span className="flex items-baseline gap-1 min-w-0">
        <span className="tabular text-caos-2xs text-caos-text/80 truncate">{spec.label}</span>
        <span className="tabular text-caos-3xs text-caos-muted shrink-0">{spec.unit}</span>
      </span>
      <Cell
        spec={spec}
        model={ca[spec.key]}
        modified={ca[spec.key] !== DEFAULT_CASE[spec.key]}
        accent={accent}
        label={`${spec.label} — all years`}
        onChange={(v) => onChange(caseKey, spec.key, v)}
        onReset={() => onChange(caseKey, spec.key, DEFAULT_CASE[spec.key])}
        onScrub={() => onScrub?.(caseKey, spec.key, "all")}
        onScrubEnd={onScrubEnd}
      />
      {([0, 1, 2] as FY[]).map((y) => {
        const ov = yearsOv[y]?.[spec.key];
        return (
          <Cell
            key={y}
            spec={spec}
            model={ov ?? ca[spec.key]}
            modified={ov !== undefined}
            accent={accent}
            label={`${spec.label} — ${FORECAST_LABELS[y]}`}
            clearLabel={`Clear ${spec.label} ${FORECAST_LABELS[y]} override`}
            onChange={(v) => onChangeYear(caseKey, y, spec.key, v)}
            onReset={() => onResetYearCell(caseKey, y, spec.key)}
            onScrub={() => onScrub?.(caseKey, spec.key, y)}
            onScrubEnd={onScrubEnd}
          />
        );
      })}
    </div>
  );
}

const useCaseReset = (
  caseKey: "base" | "down",
  onResetCase: (caseKey: "base" | "down") => void,
) => {
  const [armedReset, setArmedReset] = useState<"base" | "down" | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disarm = () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = null;
    setArmedReset(null);
  };
  const request = () => {
    if (armedReset === caseKey) {
      disarm();
      onResetCase(caseKey);
      return;
    }
    setArmedReset(caseKey);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setArmedReset(null), 3000);
  };
  useEffect(() => { disarm(); }, [caseKey]);
  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);
  return { armed: armedReset === caseKey, disarm, request };
};

const caseTabClass = (active: boolean) =>
  "flex-1 flex items-center justify-center gap-1.5 tabular text-caos-2xs uppercase tracking-wider py-1 rounded border transition-caos "
  + (active ? "bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text");

function CaseToggle({ caseKey, onChange }: { caseKey: "base" | "down"; onChange: (key: "base" | "down") => void }) {
  return (
    <div className="flex gap-1.5">
      <button onClick={() => onChange("base")} aria-pressed={caseKey === "base"} className={caseTabClass(caseKey === "base")} style={caseKey === "base" ? { borderColor: "var(--caos-success)", color: "var(--caos-success)" } : undefined}>
        <span className="w-1.5 h-1.5 rounded-sm" style={{ background: "var(--caos-success)" }} /> Base
      </button>
      <button onClick={() => onChange("down")} aria-pressed={caseKey === "down"} className={caseTabClass(caseKey === "down")} style={caseKey === "down" ? { borderColor: "var(--caos-warning)", color: "var(--caos-warning)" } : undefined}>
        <span className="w-1.5 h-1.5 rounded-sm" style={{ background: "var(--caos-warning)" }} /> Downside
      </button>
    </div>
  );
}

function CaseResetControl({
  changed,
  caseKey,
  armed,
  onRequest,
  onDisarm,
}: {
  changed: number;
  caseKey: "base" | "down";
  armed: boolean;
  onRequest: () => void;
  onDisarm: () => void;
}) {
  if (changed === 0) return null;
  const resetLabel = `Reset ${changed} ${caseKey} change${changed > 1 ? "s" : ""} to the agent's forecast`;
  const label = armed ? `Confirm reset ${caseKey} case` : resetLabel;
  return (
    <button
      onClick={onRequest}
      onBlur={armed ? onDisarm : undefined}
      aria-label={label}
      title={armed ? `Confirm reset ${caseKey} case` : `Reset ${changed} change${changed > 1 ? "s" : ""} to the agent's forecast`}
      className={"tabular text-caos-3xs px-1.5 py-px rounded border transition-caos whitespace-nowrap " + (armed ? "text-caos-critical" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60")}
      style={armed ? { borderColor: "var(--caos-critical)" } : undefined}
    >
      {armed ? `confirm reset ${caseKey}?` : `↶ ${changed}`}
    </button>
  );
}

function AssumptionsColumns({
  changed,
  caseKey,
  reset,
}: {
  changed: number;
  caseKey: "base" | "down";
  reset: ReturnType<typeof useCaseReset>;
}) {
  return (
    <div className={GRID + " sticky top-0 bg-caos-panel z-10 py-0.5 border-b border-caos-border/40"}>
      <span className="flex items-center">
        <CaseResetControl changed={changed} caseKey={caseKey} armed={reset.armed} onRequest={reset.request} onDisarm={reset.disarm} />
      </span>
      <span className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted text-right pr-1">All</span>
      {([0, 1, 2] as FY[]).map((year) => (
        <span key={year} className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted text-right pr-1">
          {FORECAST_LABELS[year].replace("FY", "")}
        </span>
      ))}
    </div>
  );
}

function AssumptionGroup({
  group,
  expanded,
  caseKey,
  ca,
  yearsOv,
  accent,
  onToggle,
  onChange,
  onChangeYear,
  onResetYearCell,
  onScrub,
  onScrubEnd,
}: DriverContext & {
  group: (typeof GROUPS)[number];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <button onClick={onToggle} aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} ${group.title} drivers`} className="flex items-center justify-between w-full text-left py-1 hover:text-caos-text transition-caos border-b border-caos-border/40 select-none group">
        <span className="tabular text-caos-3xs uppercase tracking-wider font-semibold text-caos-muted group-hover:text-caos-text transition-caos">{group.title}</span>
        <span className="tabular text-caos-3xs text-caos-accent font-bold">{expanded ? "−" : "+"}</span>
      </button>
      {expanded ? (
        <div className="flex flex-col gap-1.5 mt-1">
          {group.items.map((spec) => <DriverRow key={spec.key} spec={spec} caseKey={caseKey} ca={ca} yearsOv={yearsOv} accent={accent} onChange={onChange} onChangeYear={onChangeYear} onResetYearCell={onResetYearCell} onScrub={onScrub} onScrubEnd={onScrubEnd} />)}
        </div>
      ) : null}
    </div>
  );
}

export function AssumptionsPanel({ assumptions, onChange, onChangeYear, onResetCase, onResetYearCell, onScrub, onScrubEnd, onCollapse }: {
  assumptions: Assumptions;
  onChange: (caseKey: "base" | "down", field: keyof CaseAssumptions, value: number) => void;
  onChangeYear: (caseKey: "base" | "down", year: FY, field: keyof CaseAssumptions, value: number) => void;
  onResetCase: (caseKey: "base" | "down") => void;
  onResetYearCell: (caseKey: "base" | "down", year: FY, field: keyof CaseAssumptions) => void;
  onScrub?: (caseKey: "base" | "down", field: keyof CaseAssumptions, scope: "all" | FY) => void;
  onScrubEnd?: () => void;
  onCollapse?: () => void;
}) {
  const [caseKey, setCaseKey] = useState<"base" | "down">("base");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(GROUPS.map((g) => g.title)));
  const reset = useCaseReset(caseKey, onResetCase);

  const toggleGroup = (title: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  };

  const ca = assumptions[caseKey];
  const yearsOv = (caseKey === "base" ? assumptions.baseYears : assumptions.downYears) ?? {};
  const accent = caseKey === "base" ? "var(--caos-success)" : "var(--caos-warning)";
  const changed = caseModifiedCount(ca) + ([0, 1, 2] as FY[]).reduce<number>((s, y) => s + yearModifiedCount(yearsOv[y]), 0);

  return (
    <Panel
      title="Assumptions · forecast drivers"
      className="w-[348px] shrink-0"
      right={onCollapse ? (
        <CollapseButton direction="left" label="Collapse Assumptions panel" onClick={onCollapse} />
      ) : undefined}
    >
      <div className="p-2.5 flex flex-col gap-3">
        <p className="tabular text-caos-2xs text-caos-muted leading-snug">
          Nudge the agent&apos;s forecast. ALL broadcasts to every year; a year column pins that year only.
        </p>

        {/* case toggle */}
        <CaseToggle caseKey={caseKey} onChange={setCaseKey} />

        {/* column headers */}
        <AssumptionsColumns changed={changed} caseKey={caseKey} reset={reset} />

        {GROUPS.map((group) => <AssumptionGroup key={group.title} group={group} expanded={expanded.has(group.title)} caseKey={caseKey} ca={ca} yearsOv={yearsOv} accent={accent} onToggle={() => toggleGroup(group.title)} onChange={onChange} onChangeYear={onChangeYear} onResetYearCell={onResetYearCell} onScrub={onScrub} onScrubEnd={onScrubEnd} />)}
      </div>
    </Panel>
  );
}
