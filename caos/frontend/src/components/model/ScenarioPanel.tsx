"use client";

// Concept D — forward Scenario & Sensitivity lens for the cash-flow model.
// best/base/worst credit outcomes (net-leverage trajectory + FCF/cash) and an
// adjustable 1-way tornado over a selectable output metric.

import { Fragment, useMemo, useState } from "react";
import { Panel } from "@/components/shared/Panel";
import { CollapseButton } from "@/components/shared/CollapseButton";
import { TextInput } from "@/components/shared/TextInput";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import type { Model } from "@/lib/reports/model";
import { scenarioFromNL } from "@/lib/api";
import {
  buildScenarios, FORECAST_YEARS, swingLabel, METRICS,
  type Drivers, type MetricKey, type ScenarioLens, type TornadoBar,
} from "@/lib/model/scenarios";
import { fmtMult2, fmtUsdAcct } from "@/lib/format";

// NaN/Infinity-safe (a degenerate projection — interest 0, adj ≤ 0 — renders
// "—" rather than "NaNx" / "$InfinityM"). Same finite display as before.
const fmtX = (v: number) => fmtMult2(v);
const fmtUsd = (v: number) => fmtUsdAcct(v);
const fmtMetric = (v: number, key: MetricKey) =>
  METRICS.find((m) => m.key === key)!.unit === "x" ? fmtX(v) : fmtUsd(v);

const GOOD = "rgba(34,197,94,0.5)";
const BAD = "rgba(239,68,68,0.5)";

function ScenarioComparison({ sc, active }: { sc: ScenarioLens; active?: string | null }) {
  const proj = useMemo(() => sc.scenarios.map((s) => ({ s, p: sc.project(s.drivers) })), [sc]);
  const val = "tabular text-caos-md text-right";
  const lbl = "flex items-baseline gap-1.5 min-w-0";
  const top = " mt-1 pt-1.5 border-t border-caos-border/60";
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">
          Best · base · worst — FY26e–FY28e
        </span>
        {active ? (
          <span className="tabular text-caos-3xs px-1 py-px rounded border whitespace-nowrap truncate" style={{ color: "var(--caos-accent)", borderColor: "rgba(79,140,255,0.4)", background: "rgba(79,140,255,0.08)" }} title={`Re-centered on scenario: ${active}`}>
            ▸ {active}
          </span>
        ) : null}
      </div>
      <div className="grid items-center gap-x-2 gap-y-1" style={{ gridTemplateColumns: "1fr repeat(3, 1fr)" }}>
        <span />
        {proj.map(({ s }) => (
          <span key={s.key} className="tabular text-caos-xs uppercase tracking-wide text-right" style={{ color: s.color }}>{s.label}</span>
        ))}

        {/* net-leverage trajectory */}
        {FORECAST_YEARS.map((yr, i) => (
          <Fragment key={yr}>
            <span className={lbl}>
              <span className="text-caos-md text-caos-text">{i === 0 ? "Net leverage" : ""}</span>
              <span className="tabular text-caos-2xs text-caos-muted">{yr}</span>
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
          <span className="text-caos-md text-caos-text">Cum. FCF</span>
          <span className="tabular text-caos-2xs text-caos-muted">3y</span>
        </span>
        {proj.map(({ s, p }) => (
          <span key={s.key} className={val + top} style={{ color: "var(--caos-text)" }}>
            {fmtUsd(p.fcf.reduce((a, b) => a + b, 0))}
          </span>
        ))}

        {/* minimum cash */}
        <span className={lbl}>
          <span className="text-caos-md text-caos-text">Min cash</span>
          <span className="tabular text-caos-2xs text-caos-muted">3y</span>
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
    !Number.isFinite(v) ? "—"
    : meta.unit === "x" ? Math.abs(v).toFixed(2) + "x"
    : "$" + Math.round(Math.abs(v)).toLocaleString() + "M";
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
      <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Sensitivity — tornado</div>

      <div className="flex flex-wrap gap-1">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={
              "tabular text-caos-2xs px-1.5 min-h-[24px] inline-flex items-center rounded border transition-caos focus-ring " +
              (metric === m.key ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Swing</span>
        {([[0.5, "±½"], [1, "±1"], [1.5, "±1½"]] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setIntensity(v)}
            title={"Driver swing intensity ×" + v}
            className={
              "tabular text-caos-2xs px-1.5 min-h-[24px] inline-flex items-center rounded border transition-caos focus-ring " +
              (intensity === v ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
            }
          >
            {l}
          </button>
        ))}
        <span className="flex-1" />
        <span className="tabular text-caos-2xs text-caos-muted">base {fmt(base)}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {bars.map((b) => {
          const a = Math.min(b.low, b.high), c = Math.max(b.low, b.high);
          const La = pos(a), Lb = pos(base), Lc = pos(c);
          const belowColor = meta.lowerIsBetter ? GOOD : BAD; // values < base
          const aboveColor = meta.lowerIsBetter ? BAD : GOOD; // values > base
          return (
            <div key={b.driver} className="flex items-center gap-1.5" title={`${b.label}: ${fmt(b.low)} ↔ ${fmt(b.high)} (base ${fmt(base)})`}>
              <span className="text-caos-xs text-caos-text w-[72px] shrink-0 truncate">{b.label}</span>
              <span className="tabular text-caos-2xs text-caos-text w-[48px] shrink-0 text-right whitespace-nowrap tabular-nums">{fmt(a)}</span>
              <div className="relative flex-1 h-3.5 rounded-sm" style={{ background: "var(--caos-bg)" }}>
                <span className="absolute top-0 bottom-0 rounded-l-sm" style={{ left: La + "%", width: Math.max(0, Lb - La) + "%", background: belowColor }} />
                <span className="absolute top-0 bottom-0 rounded-r-sm" style={{ left: Lb + "%", width: Math.max(0, Lc - Lb) + "%", background: aboveColor }} />
                <span className="absolute top-[-1px] bottom-[-1px] w-px" style={{ left: Lb + "%", background: "var(--caos-text)" }} />
              </div>
              <span className="tabular text-caos-2xs text-caos-text w-[48px] shrink-0 text-left whitespace-nowrap tabular-nums">{fmt(c)}</span>
            </div>
          );
        })}
      </div>

      <div className="tabular text-caos-2xs text-caos-muted leading-snug">
        {meta.lowerIsBetter ? "Green improves (lower), red worsens." : "Green improves (higher), red worsens."} Bar spans low–high outcome; tick = {fmt(base)} base.
      </div>

      {/* Narrative read — interprets the tornado for the credit, live with the selectors. */}
      <div className="flex flex-col gap-1 pt-2 border-t border-caos-border/60">
        <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Sensitivity read</div>
        <p className="text-caos-md text-caos-muted leading-relaxed">
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

// ── Scenario builder ─────────────────────────────────────────────────────────
interface ActiveScenario { label: string; rationale: string; deltas: Partial<Drivers> }

// Pre-defined scenarios — deterministic driver deltas (Drivers units: pp as
// fractions, rate as a fraction). Parallel the issuer-Q&A starter chips.
const PRESETS: { label: string; deltas: Partial<Drivers> }[] = [
  { label: "Energy price spike", deltas: { adjMargin: -0.03, rate: 0.005 } },
  { label: "Rate hike +200bps", deltas: { rate: 0.02 } },
  { label: "Demand recession", deltas: { revGrowth: -0.05, adjMargin: -0.02 } },
  { label: "Margin compression", deltas: { adjMargin: -0.025 } },
  { label: "Capex surge", deltas: { capexPct: 0.02 } },
];

const DRIVER_LABEL: Record<keyof Drivers, string> = {
  revGrowth: "rev growth", adjMargin: "margin", capexPct: "capex", rate: "rate",
};
function fmtDelta(key: keyof Drivers, v: number): string {
  const sign = v >= 0 ? "+" : "−";
  if (key === "rate") return `${sign}${Math.round(Math.abs(v) * 10000)}bps rate`;
  return `${sign}${parseFloat((Math.abs(v) * 100).toFixed(2))}pp ${DRIVER_LABEL[key]}`;
}
function deltaSummary(d: Partial<Drivers>): string {
  return (["revGrowth", "adjMargin", "capexPct", "rate"] as (keyof Drivers)[])
    .filter((k) => d[k]).map((k) => fmtDelta(k, d[k] as number)).join(" · ");
}

function ScenarioBuilder({
  active, onApply, onReset,
}: {
  active: ActiveScenario | null;
  onApply: (deltas: Partial<Drivers>, label: string, rationale: string) => void;
  onReset: () => void;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const runNL = async (text?: string) => {
    const t = (text ?? q).trim();
    if (!t || busy) return;
    setBusy(true); setErr(null);
    try {
      const s = await scenarioFromNL(t);
      const deltas: Partial<Drivers> = {};
      if (s.rev_growth_delta) deltas.revGrowth = s.rev_growth_delta;
      if (s.margin_delta) deltas.adjMargin = s.margin_delta;
      if (s.capex_delta) deltas.capexPct = s.capex_delta;
      if (s.rate_delta) deltas.rate = s.rate_delta;
      onApply(deltas, s.label || t, s.rationale || "");
      setQ("");
    } catch (e) {
      const d = (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
        || (e as Error)?.message || "couldn't build that scenario";
      setErr(String(d));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Scenario builder</div>

      {active ? (
        <div className="rounded border px-2 py-1.5 flex flex-col gap-1" style={{ borderColor: "rgba(79,140,255,0.4)", background: "rgba(79,140,255,0.08)" }}>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ background: "var(--caos-accent)" }} />
            <span className="text-caos-md text-caos-text font-medium truncate">{active.label}</span>
            <span className="flex-1" />
            <button onClick={onReset} title="Revert to module forecasts" className="tabular text-caos-2xs px-1.5 min-h-[24px] inline-flex items-center rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring whitespace-nowrap">↶ RESET</button>
          </div>
          <div className="tabular text-caos-xs" style={{ color: "var(--caos-accent)" }}>{deltaSummary(active.deltas) || "no driver change"}</div>
          {active.rationale ? <div className="text-caos-xs text-caos-muted leading-snug">{active.rationale}</div> : null}
        </div>
      ) : (
        <div className="tabular text-caos-xs text-caos-muted leading-snug">Apply a scenario to re-center base &amp; downside. Module forecasts shown.</div>
      )}

      {/* pre-defined scenarios */}
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onApply(p.deltas, p.label, "")}
            title={deltaSummary(p.deltas)}
            className="tabular text-caos-2xs px-1.5 min-h-[24px] inline-flex items-center rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* natural-language scenario */}
      <div className="flex items-center gap-1.5">
        <span className="text-caos-accent text-caos-xl">✦</span>
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runNL(); } }}
          placeholder="Describe a scenario — e.g. oil shock, margins compress 200bps"
          aria-label="Describe a scenario"
          maxLength={500}
          className="flex-1 px-2 py-1 text-caos-md"
        />
        <button
          onClick={() => runNL()}
          disabled={busy || !q.trim()}
          className="shrink-0 tabular text-caos-xs px-2 py-1 rounded transition-caos disabled:opacity-40"
          style={{ background: "var(--caos-accent)", color: "var(--caos-bg)" }}
        >
          {busy ? "…" : "BUILD"}
        </button>
      </div>
      {err ? <div className="tabular text-caos-xs" style={{ color: "var(--caos-warning)" }}><StatusGlyph kind="warning" /> {err}</div> : null}
    </div>
  );
}

// Derived from the model's assumptions-adjusted forecast: base = the BASE
// columns, worst = the DOWNSIDE columns, so both the base- and downside-case
// Assumptions sliders re-center the lens (best/base/worst + tornado). The
// Scenario Builder layers a custom scenario on top; Reset reverts to it.
export function ScenarioPanel({ model, onCollapse }: { model: Model; onCollapse?: () => void }) {
  const [active, setActive] = useState<ActiveScenario | null>(null);
  const sc = useMemo(() => buildScenarios(model, active?.deltas), [model, active]);
  return (
    <Panel
      title="Scenario & Sensitivity · forward cash-flow lens"
      className="w-[372px] shrink-0"
      right={onCollapse ? (
        <CollapseButton direction="right" label="Collapse Scenario panel" onClick={onCollapse} />
      ) : undefined}
    >
      <div className="p-2.5 flex flex-col gap-3.5">
        <ScenarioComparison sc={sc} active={active?.label ?? null} />
        <div className="border-t border-caos-border" />
        <Tornado sc={sc} />
        <div className="border-t border-caos-border" />
        <ScenarioBuilder
          active={active}
          onApply={(deltas, label, rationale) => setActive({ deltas, label, rationale })}
          onReset={() => setActive(null)}
        />
      </div>
    </Panel>
  );
}
