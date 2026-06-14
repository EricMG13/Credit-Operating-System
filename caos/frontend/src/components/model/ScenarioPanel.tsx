"use client";

// Concept D — forward Scenario & Sensitivity lens for the cash-flow model.
// best/base/worst credit outcomes (net-leverage trajectory + FCF/cash) and an
// adjustable 1-way tornado over a selectable output metric.

import { Fragment, useMemo, useState } from "react";
import { Panel } from "@/components/shared/Panel";
import type { Model } from "@/lib/reports/model";
import {
  buildScenarios, FORECAST_YEARS, swingLabel, METRICS,
  type MetricKey, type ScenarioLens, type TornadoBar,
} from "@/lib/model/scenarios";

const fmtX = (v: number) => v.toFixed(2) + "x";
const fmtUsd = (v: number) => (v < 0 ? "(" : "") + "$" + Math.round(Math.abs(v)).toLocaleString() + "M" + (v < 0 ? ")" : "");
const fmtMetric = (v: number, key: MetricKey) =>
  METRICS.find((m) => m.key === key)!.unit === "x" ? fmtX(v) : fmtUsd(v);

const GOOD = "rgba(34,197,94,0.5)";
const BAD = "rgba(239,68,68,0.5)";

function ScenarioComparison({ sc }: { sc: ScenarioLens }) {
  const proj = useMemo(() => sc.scenarios.map((s) => ({ s, p: sc.project(s.drivers) })), [sc]);
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

function Tornado({ sc }: { sc: ScenarioLens }) {
  const [metric, setMetric] = useState<MetricKey>("netLevExit");
  const [intensity, setIntensity] = useState(1);
  const meta = METRICS.find((m) => m.key === metric)!;
  const { base, bars } = useMemo(() => sc.tornado(metric, intensity), [sc, metric, intensity]);

  const all = [...bars.flatMap((b) => [b.low, b.high]), base];
  const dmin = Math.min(...all), dmax = Math.max(...all), span = dmax - dmin || 1;
  const pos = (x: number) => ((x - dmin) / span) * 100;
  const fmt = (x: number) => fmtMetric(x, metric);

  // Plain-language read of the tornado for the credit. `bars` arrives sorted
  // widest-impact first (tornado order), so bars[0] is the binding driver.
  const top = bars[0];
  const range = (b: TornadoBar) => Math.abs(b.high - b.low);
  const worseOf = (b: TornadoBar) => (meta.lowerIsBetter ? Math.max(b.low, b.high) : Math.min(b.low, b.high));
  const betterOf = (b: TornadoBar) => (meta.lowerIsBetter ? Math.min(b.low, b.high) : Math.max(b.low, b.high));
  const fmtMag = (v: number) =>
    meta.unit === "x" ? Math.abs(v).toFixed(2) + "x" : "$" + Math.round(Math.abs(v)).toLocaleString() + "M";
  const worstV = worseOf(top), bestV = betterOf(top);
  const downAmt = Math.abs(worstV - base), upAmt = Math.abs(bestV - base);
  const ratio = upAmt === 0 ? Infinity : downAmt / upAmt;
  const skew =
    ratio >= 1.5 ? "markedly downside-skewed" : ratio >= 1.15 ? "modestly downside-skewed"
    : ratio <= 0.67 ? "markedly upside-skewed" : ratio <= 0.87 ? "modestly upside-skewed"
    : "roughly symmetric";
  const conc = range(bars[1]) === 0 ? Infinity : range(top) / range(bars[1]);
  const concPhrase = isFinite(conc) ? `${conc.toFixed(1)}× the next-widest factor (${bars[1].label})` : "far wider than any other factor";
  const tLo = Math.min(top.low, top.high), tHi = Math.max(top.low, top.high);
  const adverseDir = worstV > base ? "above" : "below";
  const favorDir = bestV > base ? "above" : "below";

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
            <div key={b.driver} className="flex items-center gap-1.5" title={`${b.label}: ${fmt(b.low)} ↔ ${fmt(b.high)} (base ${fmt(base)})`}>
              <span className="text-[9px] text-caos-text w-[72px] shrink-0 truncate">{b.label}</span>
              <span className="tabular text-[8.5px] text-caos-text w-[48px] shrink-0 text-right whitespace-nowrap tabular-nums">{fmt(a)}</span>
              <div className="relative flex-1 h-3.5 rounded-sm" style={{ background: "var(--caos-bg)" }}>
                <span className="absolute top-0 bottom-0 rounded-l-sm" style={{ left: La + "%", width: Math.max(0, Lb - La) + "%", background: belowColor }} />
                <span className="absolute top-0 bottom-0 rounded-r-sm" style={{ left: Lb + "%", width: Math.max(0, Lc - Lb) + "%", background: aboveColor }} />
                <span className="absolute top-[-1px] bottom-[-1px] w-px" style={{ left: Lb + "%", background: "var(--caos-text)" }} />
              </div>
              <span className="tabular text-[8.5px] text-caos-text w-[48px] shrink-0 text-left whitespace-nowrap tabular-nums">{fmt(c)}</span>
            </div>
          );
        })}
      </div>

      <div className="tabular text-caos-micro text-caos-muted leading-snug">
        {meta.lowerIsBetter ? "Green improves (lower), red worsens." : "Green improves (higher), red worsens."} Bar spans low–high outcome; tick = {fmt(base)} base.
      </div>

      {/* Narrative read — interprets the tornado for the credit, live with the selectors. */}
      <div className="flex flex-col gap-1 pt-2 border-t border-caos-border/60">
        <div className="tabular text-caos-micro uppercase tracking-wider text-caos-muted">Sensitivity read</div>
        <p className="text-[10px] text-caos-muted leading-relaxed">
          <span className="font-medium text-caos-text">{top.label} is the binding lever.</span>{" "}
          A {swingLabel(top.driver, intensity)} swing alone moves the outcome{" "}
          <span className="tabular text-caos-text">{fmt(tLo)}–{fmt(tHi)}</span>{" "}({fmtMag(range(top))}), {concPhrase}.{" "}
          Risk is {skew}: the adverse case (<span className="tabular text-caos-text">{fmt(worstV)}</span>){" "}
          sits {fmtMag(downAmt)} {adverseDir} the {fmt(base)} base versus {fmtMag(upAmt)} {favorDir} on the upside.{" "}
          {bars[2].label} and {bars[3].label} are second-order (≤{fmtMag(range(bars[2]))} each).{" "}
          Debt is held static — FCF accrues to cash, so this is a deleveraging lens, not a valuation.
        </p>
      </div>
    </div>
  );
}

// Anchored on the model's pro-forma (PF) column, so the lens re-bases on the
// same live CP-1 run the grid does (and falls back to the seeded PF offline).
export function ScenarioPanel({ model }: { model: Model }) {
  const sc = useMemo(() => buildScenarios(model.cols.pf), [model]);
  return (
    <Panel title="Scenario & Sensitivity · forward cash-flow lens" className="w-[372px] shrink-0">
      <div className="p-2.5 flex flex-col gap-3.5">
        <ScenarioComparison sc={sc} />
        <div className="border-t border-caos-border" />
        <Tornado sc={sc} />
      </div>
    </Panel>
  );
}
