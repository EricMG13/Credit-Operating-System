"use client";

// Concept D — forward Scenario & Sensitivity lens for the cash-flow model.
// best/base/worst credit outcomes (net-leverage trajectory + FCF/cash) and an
// adjustable 1-way tornado over a selectable output metric.

import { Fragment, useMemo, useState } from "react";
import { Panel } from "@/components/shared/Panel";
import {
  SCENARIOS, FORECAST_YEARS, project, tornado, METRICS, type MetricKey,
} from "@/lib/model/scenarios";

const fmtX = (v: number) => v.toFixed(2) + "x";
const fmtUsd = (v: number) => (v < 0 ? "(" : "") + "$" + Math.round(Math.abs(v)).toLocaleString() + "M" + (v < 0 ? ")" : "");
const fmtMetric = (v: number, key: MetricKey) =>
  METRICS.find((m) => m.key === key)!.unit === "x" ? fmtX(v) : fmtUsd(v);

const GOOD = "rgba(34,197,94,0.5)";
const BAD = "rgba(239,68,68,0.5)";

function ScenarioComparison() {
  const proj = useMemo(() => SCENARIOS.map((s) => ({ s, p: project(s.drivers) })), []);
  const val = "tabular text-[10px] text-right";
  const lbl = "flex items-baseline gap-1.5 min-w-0";
  const top = " mt-1 pt-1.5 border-t border-caos-border/60";
  return (
    <div>
      <div className="tabular text-caos-micro uppercase tracking-wider text-caos-muted mb-1.5">
        Best · base · worst — FY26e–FY28e
      </div>
      <div className="grid items-center gap-x-2 gap-y-1" style={{ gridTemplateColumns: "1fr repeat(3, 1fr)" }}>
        <span />
        {proj.map(({ s }) => (
          <span key={s.key} className="tabular text-[9px] uppercase tracking-wide text-right" style={{ color: s.color }}>{s.label}</span>
        ))}

        {/* net-leverage trajectory */}
        {FORECAST_YEARS.map((yr, i) => (
          <Fragment key={yr}>
            <span className={lbl}>
              <span className="text-[10px] text-caos-text">{i === 0 ? "Net leverage" : ""}</span>
              <span className="tabular text-caos-micro text-caos-muted">{yr}</span>
            </span>
            {proj.map(({ s, p }) => (
              <span key={s.key} className={val} style={{ color: i === FORECAST_YEARS.length - 1 ? s.color : "var(--caos-text)" }}>
                {fmtX(p.netLev[i])}
              </span>
            ))}
          </Fragment>
        ))}

        {/* cumulative FCF */}
        <span className={lbl + top}>
          <span className="text-[10px] text-caos-text">Cum. FCF</span>
          <span className="tabular text-caos-micro text-caos-muted">3y</span>
        </span>
        {proj.map(({ s, p }) => (
          <span key={s.key} className={val + top} style={{ color: "var(--caos-text)" }}>
            {fmtUsd(p.fcf.reduce((a, b) => a + b, 0))}
          </span>
        ))}

        {/* minimum cash */}
        <span className={lbl}>
          <span className="text-[10px] text-caos-text">Min cash</span>
          <span className="tabular text-caos-micro text-caos-muted">3y</span>
        </span>
        {proj.map(({ s, p }) => {
          const mc = Math.min(...p.cash);
          return (
            <span key={s.key} className={val} style={{ color: mc < 0 ? "var(--caos-critical)" : "var(--caos-text)" }}>
              {fmtUsd(mc)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Tornado() {
  const [metric, setMetric] = useState<MetricKey>("netLevExit");
  const [intensity, setIntensity] = useState(1);
  const meta = METRICS.find((m) => m.key === metric)!;
  const { base, bars } = useMemo(() => tornado(metric, intensity), [metric, intensity]);

  const all = [...bars.flatMap((b) => [b.low, b.high]), base];
  const dmin = Math.min(...all), dmax = Math.max(...all), span = dmax - dmin || 1;
  const pos = (x: number) => ((x - dmin) / span) * 100;
  const fmt = (x: number) => fmtMetric(x, metric);

  return (
    <div className="flex flex-col gap-2">
      <div className="tabular text-caos-micro uppercase tracking-wider text-caos-muted">Sensitivity — tornado</div>

      <div className="flex flex-wrap gap-1">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={
              "tabular text-[8.5px] px-1.5 py-0.5 rounded border transition-caos focus-ring " +
              (metric === m.key ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <span className="tabular text-caos-micro uppercase tracking-wider text-caos-muted">Swing</span>
        {([[0.5, "±½"], [1, "±1"], [1.5, "±1½"]] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setIntensity(v)}
            title={"Driver swing intensity ×" + v}
            className={
              "tabular text-[8.5px] px-1.5 py-0.5 rounded border transition-caos focus-ring " +
              (intensity === v ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
            }
          >
            {l}
          </button>
        ))}
        <span className="flex-1" />
        <span className="tabular text-caos-micro text-caos-muted">base {fmt(base)}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {bars.map((b) => {
          const a = Math.min(b.low, b.high), c = Math.max(b.low, b.high);
          const La = pos(a), Lb = pos(base), Lc = pos(c);
          const belowColor = meta.lowerIsBetter ? GOOD : BAD; // values < base
          const aboveColor = meta.lowerIsBetter ? BAD : GOOD; // values > base
          return (
            <div key={b.driver} className="flex items-center gap-2" title={`${b.label}: ${fmt(b.low)} ↔ ${fmt(b.high)}`}>
              <span className="text-[9px] text-caos-text w-[80px] shrink-0 truncate">{b.label}</span>
              <div className="relative flex-1 h-3.5 rounded-sm" style={{ background: "var(--caos-bg)" }}>
                <span className="absolute top-0 bottom-0 rounded-l-sm" style={{ left: La + "%", width: Math.max(0, Lb - La) + "%", background: belowColor }} />
                <span className="absolute top-0 bottom-0 rounded-r-sm" style={{ left: Lb + "%", width: Math.max(0, Lc - Lb) + "%", background: aboveColor }} />
                <span className="absolute top-[-1px] bottom-[-1px] w-px" style={{ left: Lb + "%", background: "var(--caos-text)" }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="tabular text-caos-micro text-caos-muted leading-snug">
        {meta.lowerIsBetter ? "Green improves (lower), red worsens." : "Green improves (higher), red worsens."} Forward FCF lens — total debt static, FCF builds cash.
      </div>
    </div>
  );
}

export function ScenarioPanel() {
  return (
    <Panel title="Scenario & Sensitivity · forward cash-flow lens" className="w-[372px] shrink-0">
      <div className="p-2.5 flex flex-col gap-3.5">
        <ScenarioComparison />
        <div className="border-t border-caos-border" />
        <Tornado />
      </div>
    </Panel>
  );
}
