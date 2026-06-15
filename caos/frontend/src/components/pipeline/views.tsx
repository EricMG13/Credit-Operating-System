"use client";

// Pipeline Visualizer views: DAG graph, swimlanes, inspector, CP-5B lineage
// rail, and orchestrator event log (port of design bundle concept-b.jsx).

import { useMemo } from "react";
import {
  ancestorsOf, descendantsOf, DRIVERS, EDGES, LAYERS, MODULES,
  NODE_LIMITS, NODE_QA, NODE_REQS, SIM_PLAN, type Driver, type PlanStep,
} from "@/lib/pipeline/data";
import { SEV_COLOR, type Sim, type SimEvent } from "@/lib/pipeline/sim";
import { EvChip } from "@/components/reports/EvidenceModal";
import { Bar, Dot, Tag } from "./atoms";
import { StatusGlyph } from "@/components/shared/StatusGlyph";

const COL_ORDER = ["L0", "ORCH", "L1", "L2", "L3", "L4", "L6", "L5", "INFRA"];

/* ---------- graph geometry ---------- */
const GW = 1490, GH = 596;
function layoutNodes(): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  COL_ORDER.forEach((layer, ci) => {
    const mods = MODULES.filter((m) => m.layer === layer);
    const x = 110 + ci * 158;
    const spacing = Math.min(104, (GH - 60) / Math.max(1, mods.length));
    mods.forEach((m, i) => {
      const y = GH / 2 + (i - (mods.length - 1) / 2) * spacing;
      pos[m.id] = { x, y };
    });
  });
  return pos;
}
const NODE_POS = layoutNodes();
const NW = 128, NH = 44;

/* ---------- DAG view ---------- */
export function GraphView({
  sim, selected, onSelect, dim, scope, onDoubleClick,
}: {
  sim: Sim;
  selected: string | null;
  onSelect: (id: string | null) => void;
  dim: boolean;
  scope: Set<string>;
  onDoubleClick?: (id: string) => void;
}) {
  const up = useMemo(() => (selected ? ancestorsOf(selected) : new Set<string>()), [selected]);
  const down = useMemo(() => (selected ? descendantsOf(selected) : new Set<string>()), [selected]);
  const inUp = (n: string) => n === selected || up.has(n);
  const inDown = (n: string) => n === selected || down.has(n);

  return (
    <div className="relative" style={{ width: GW, height: GH }}>
      <svg width={GW} height={GH} className="absolute inset-0">
        {EDGES.map(([a, b], i) => {
          const pa = NODE_POS[a], pb = NODE_POS[b];
          if (!pa || !pb) return null;
          const x1 = pa.x + NW / 2, y1 = pa.y, x2 = pb.x - NW / 2, y2 = pb.y;
          const mx = (x1 + x2) / 2;
          const upEdge = selected != null && inUp(a) && inUp(b) && (up.has(a) || a === selected);
          const downEdge = selected != null && inDown(a) && inDown(b);
          const active = upEdge || downEdge;
          const off = !scope.has(a) || !scope.has(b);
          const stroke = upEdge ? "var(--caos-accent)" : downEdge ? "#a855f7" : "#34344a";
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={stroke}
              strokeWidth={active ? 1.6 : 1}
              opacity={off ? 0.07 : selected ? (active ? 0.95 : 0.16) : 0.5}
            />
          );
        })}
      </svg>
      {COL_ORDER.map((l, ci) => {
        const meta = LAYERS.find((x) => x.id === l);
        return (
          <div key={l} className="absolute text-center" style={{ left: 110 + ci * 158 - NW / 2, top: 4, width: NW }}>
            <div className="tabular text-caos-xs uppercase tracking-widest text-caos-muted">{l}</div>
            <div className="text-caos-2xs text-caos-muted">{meta ? meta.label : ""}</div>
          </div>
        );
      })}
      {MODULES.map((m) => {
        const p = NODE_POS[m.id];
        const st = sim.mods[m.id]?.state || "idle";
        const prog = sim.mods[m.id]?.prog || 0;
        const sel = selected === m.id;
        const inScope = scope.has(m.id);
        const related = !selected || sel || up.has(m.id) || down.has(m.id);
        const doneDim = dim && st === "pass" && !sel;
        const color = SEV_COLOR[st] || "var(--caos-idle)";
        return (
          <button
            key={m.id}
            onClick={() => onSelect(sel ? null : m.id)}
            onDoubleClick={() => onDoubleClick && onDoubleClick(m.id)}
            title={inScope ? m.name + " — double-click to open module outputs" : "Out of scope for this route plan"}
            className={"absolute text-left rounded border bg-caos-panel transition-caos hover:border-caos-accent/70 " + (sel ? "caos-selected z-10" : "")}
            style={{
              left: p.x - NW / 2, top: p.y - NH / 2, width: NW, height: NH,
              borderColor: sel ? "var(--caos-accent)" : st === "idle" ? "var(--caos-border)" : color + "66",
              borderStyle: inScope ? "solid" : "dashed",
              opacity: !inScope ? 0.22 : related && !doneDim ? 1 : 0.32,
            }}
          >
            <div className="flex items-center gap-1.5 px-2 pt-1.5 whitespace-nowrap">
              <Dot sev={st} pulse={st === "running"} />
              <span className="tabular text-caos-md text-caos-text whitespace-nowrap">{m.id}</span>
              {inScope && NODE_QA[m.id] ? <span className="ml-auto text-caos-xs" style={{ color: "var(--caos-critical)" }}>⛨</span> : null}
              {inScope && NODE_LIMITS[m.id] ? <span className="ml-auto inline-flex items-center" style={{ color: "var(--caos-warning)" }} title="Has limitations"><StatusGlyph kind="warning" /></span> : null}
              {st === "held" ? <span className="ml-auto text-caos-xs" style={{ color: "var(--caos-warning)" }}>🔒</span> : null}
            </div>
            <div className="px-2 text-caos-2xs text-caos-muted truncate leading-tight">{m.name}</div>
            <div className="px-2 pt-[3px]"><Bar pct={!inScope || st === "idle" ? 0 : prog * 100} color={color} h={2} /></div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- swimlane view ---------- */
export function SwimlaneView({
  sim, selected, onSelect, scope, onDoubleClick,
}: {
  sim: Sim;
  selected: string | null;
  onSelect: (id: string | null) => void;
  scope: Set<string>;
  onDoubleClick?: (id: string) => void;
}) {
  return (
    <div className="grid h-full gap-1.5 p-2" style={{ gridTemplateColumns: "repeat(9, 1fr)" }}>
      {COL_ORDER.map((l) => {
        const meta = LAYERS.find((x) => x.id === l);
        const mods = MODULES.filter((m) => m.layer === l);
        return (
          <div key={l} className="flex flex-col min-h-0 rounded border border-caos-border bg-caos-bg/50">
            <div className="px-2 py-1.5 border-b border-caos-border shrink-0">
              <div className="tabular text-caos-sm uppercase tracking-widest text-caos-text">{l}</div>
              <div className="text-caos-2xs text-caos-muted">{meta ? meta.label : ""}</div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-1.5 flex flex-col gap-1.5">
              {mods.map((m) => {
                const st = sim.mods[m.id]?.state || "idle";
                const prog = sim.mods[m.id]?.prog || 0;
                const sel = selected === m.id;
                const inScope = scope.has(m.id);
                const color = SEV_COLOR[st] || "var(--caos-idle)";
                return (
                  <button
                    key={m.id}
                    onClick={() => onSelect(sel ? null : m.id)}
                    onDoubleClick={() => onDoubleClick && onDoubleClick(m.id)}
                    title={inScope ? m.name + " — double-click to open module outputs" : "Out of scope for this route plan"}
                    className={"text-left rounded border bg-caos-panel px-2 py-1.5 transition-caos hover:border-caos-accent/70 " + (sel ? "caos-selected" : "")}
                    style={{
                      borderColor: sel ? "var(--caos-accent)" : st === "idle" ? "var(--caos-border)" : color + "55",
                      borderStyle: inScope ? "solid" : "dashed",
                      opacity: !inScope ? 0.25 : st === "idle" ? 0.55 : 1,
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Dot sev={st} pulse={st === "running"} />
                      <span className="tabular text-caos-md text-caos-text">{m.id}</span>
                      <span className="tabular text-caos-2xs ml-auto" style={{ color: inScope ? color : "var(--caos-muted)" }}>
                        {!inScope ? "skip" : st === "idle" ? "queued" : st}
                      </span>
                    </div>
                    <div className="text-caos-xs text-caos-muted leading-tight mt-0.5">{m.name}</div>
                    <div className="mt-1"><Bar pct={!inScope || st === "idle" ? 0 : prog * 100} color={color} h={2} /></div>
                    {inScope && NODE_QA[m.id] ? <div className="mt-1"><Tag sev="critical">QA {NODE_QA[m.id].id}</Tag></div> : null}
                    {inScope && NODE_LIMITS[m.id] ? <div className="mt-1"><Tag sev="warning">LIMIT L-04</Tag></div> : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- inspector rail ---------- */
const REQ_TAG_COLOR: Record<string, string> = {
  missing: "var(--caos-critical)",
  open: "var(--caos-warning)",
  requested: "var(--caos-accent)",
  gated: "var(--caos-muted)",
};

export function Inspector({
  sim, selected, plan, scope, modeLabel,
}: {
  sim: Sim;
  selected: string | null;
  plan: PlanStep[];
  scope: Set<string>;
  modeLabel: string;
}) {
  if (!selected) {
    return (
      <div className="p-4 text-caos-xl text-caos-muted leading-relaxed">
        <div className="text-caos-text font-medium mb-2">Select a module</div>
        Click any node to trace its <span style={{ color: "var(--caos-accent)" }}>upstream data lineage</span> and{" "}
        <span style={{ color: "var(--tranche-sub)" }}>downstream consumers</span> through the CP-X route graph, inspect payload
        status, QA findings and propagated limitations.
      </div>
    );
  }
  const m = MODULES.find((x) => x.id === selected)!;
  const planEntry = plan.find((x) => x.id === selected);
  const base = SIM_PLAN.find((x) => x.id === selected);
  const inScope = scope.has(selected);
  const st = sim.mods[selected]?.state || "idle";
  const deps = planEntry ? planEntry.deps : base ? base.deps : [];
  const consumers = EDGES.filter(([a]) => a === selected).map(([, b]) => b);
  const qa = inScope ? NODE_QA[selected] : null;
  const lim = inScope ? NODE_LIMITS[selected] : null;
  const degraded = ["warning", "held", "blocked"].includes(st);
  const reqs = inScope && degraded ? NODE_REQS[selected] : null;
  return (
    <div className="text-caos-xl">
      <div className="px-3 py-2.5 border-b border-caos-border">
        <div className="flex items-center gap-2">
          <Dot sev={st} pulse={st === "running"} />
          <span className="tabular text-[13px] text-caos-text">{m.id}</span>
          <Tag sev={st}>{st === "idle" ? "queued" : st}</Tag>
        </div>
        <div className="text-caos-2xl text-caos-text mt-1 font-medium">{m.name}</div>
        <div className="text-caos-md text-caos-muted mt-1 leading-snug">{m.desc}</div>
      </div>
      {!inScope ? (
        <div className="px-3 py-2 border-b border-caos-border flex items-start gap-2" style={{ background: "rgba(138,138,154,0.06)" }}>
          <span className="text-caos-md text-caos-muted mt-px">⊘</span>
          <span className="text-caos-md text-caos-muted leading-snug">
            Out of scope for the {modeLabel} route — CP-X skipped this module; registers inherit from the last
            full-committee run (#2641).
          </span>
        </div>
      ) : null}
      {planEntry && planEntry.event && ["pass", "warning", "held"].includes(st) ? (
        <div className="px-3 py-2 border-b border-caos-border">
          <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1">Latest payload</div>
          <div className="text-caos-lg text-caos-text leading-snug">{planEntry.event}</div>
        </div>
      ) : null}
      {qa ? (
        <div className="px-3 py-2 border-b border-caos-border">
          <div className="tabular text-caos-xs uppercase tracking-wider mb-1" style={{ color: "var(--caos-critical)" }}>QA finding · CP-5</div>
          <div className="flex items-center gap-2 mb-1"><Tag sev="critical">{qa.sev}</Tag><span className="tabular text-caos-md text-caos-accent">{qa.id}</span></div>
          <div className="text-caos-lg text-caos-text leading-snug">{qa.text}</div>
        </div>
      ) : null}
      {lim ? (
        <div className="px-3 py-2 border-b border-caos-border">
          <div className="tabular text-caos-xs uppercase tracking-wider mb-1" style={{ color: "var(--caos-warning)" }}>Propagated limitation · CP-X-06</div>
          <div className="text-caos-lg text-caos-text leading-snug">{lim}</div>
        </div>
      ) : null}
      {reqs && reqs.length ? (
        <div className="px-3 py-2 border-b border-caos-border">
          <div className="tabular text-caos-xs uppercase tracking-wider mb-1.5" style={{ color: "var(--caos-warning)" }}>
            {st === "warning" ? "Required to clear warning" : "Required to release hold"} · documents & information
          </div>
          <div className="flex flex-col gap-1.5">
            {reqs.map((r) => (
              <div key={r.doc} className="flex items-start gap-1.5">
                <span className="text-caos-xs mt-px shrink-0" style={{ color: "var(--caos-warning)" }}>▦</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-caos-lg text-caos-text leading-snug">{r.doc}</span>
                    <span
                      className="tabular text-caos-3xs uppercase tracking-wide px-1 py-px rounded border whitespace-nowrap"
                      style={{
                        color: REQ_TAG_COLOR[r.tag],
                        borderColor: REQ_TAG_COLOR[r.tag] + "55",
                        background: REQ_TAG_COLOR[r.tag] + "14",
                      }}
                    >
                      {r.tag}
                    </span>
                  </div>
                  <div className="text-caos-sm text-caos-muted leading-snug">{r.why}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="px-3 py-2 border-b border-caos-border">
        <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Upstream inputs · {deps.length}</div>
        <div className="flex flex-wrap gap-1">
          {deps.length ? deps.map((d) => (
            <span key={d} className="flex items-center gap-1 tabular text-caos-sm px-1.5 py-0.5 rounded border border-caos-border bg-caos-bg">
              <Dot sev={sim.mods[d]?.state || "idle"} />{d}
            </span>
          )) : <span className="text-caos-md text-caos-muted">— root node (source intake)</span>}
        </div>
      </div>
      <div className="px-3 py-2 border-b border-caos-border">
        <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Downstream consumers · {consumers.length}</div>
        <div className="flex flex-wrap gap-1">
          {consumers.length ? consumers.map((d) => (
            <span key={d} className="flex items-center gap-1 tabular text-caos-sm px-1.5 py-0.5 rounded border border-caos-border bg-caos-bg" style={{ color: "#c4b5fd" }}>
              {d}
            </span>
          )) : <span className="text-caos-md text-caos-muted">— terminal node</span>}
        </div>
      </div>
    </div>
  );
}

/* ---------- CP-5B lineage rail ---------- */
export function LineagePanel({
  onPick, drivers, onOpenEvidence,
}: {
  onPick: (d: Driver) => void;
  drivers: number[] | null;
  onOpenEvidence: (id: string) => void;
}) {
  const list = drivers ? DRIVERS.filter((d) => drivers.includes(d.n)) : DRIVERS;
  return (
    <div>
      {list.map((d) => (
        <div
          key={d.n}
          className="px-3 py-2 border-b border-caos-border/50 hover:bg-caos-elevated/60 transition-caos cursor-pointer"
          onClick={() => onPick(d)}
        >
          <div className="flex items-center gap-2">
            <span className="tabular text-caos-md text-caos-muted">#{d.n}</span>
            <span className="text-caos-lg text-caos-text leading-snug flex-1">{d.driver}</span>
            <Tag sev={d.status === "verified" ? "ok" : "warning"}>{d.status}</Tag>
          </div>
          <div className="tabular text-caos-xs text-caos-muted mt-1 leading-relaxed">{d.lineage}</div>
          {d.evs.length ? (
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">sources</span>
              {d.evs.map((e) => <EvChip key={e} id={e} onOpen={onOpenEvidence} />)}
            </div>
          ) : null}
          <div className="flex items-center gap-1.5 mt-1">
            <Bar pct={d.conf * 100} color={d.conf > 0.7 ? "var(--caos-success)" : "var(--caos-warning)"} h={2} />
            <span className="tabular text-caos-xs text-caos-muted shrink-0">{(d.conf * 100).toFixed(0)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- event log ---------- */
export function EventLog({ events }: { events: SimEvent[] }) {
  return (
    <div className="h-full overflow-auto">
      {events.length === 0 ? <div className="px-3 py-2 text-caos-md text-caos-muted">Awaiting run start…</div> : null}
      {events.map((e, i) => (
        <div key={events.length - i} className={"flex items-center gap-2 px-3 py-[3.5px] border-b border-caos-border/40 " + (i === 0 ? "caos-enter" : "")}>
          <span className="tabular text-caos-sm text-caos-muted shrink-0">{e.t}</span>
          <Dot sev={e.sev} />
          <span className={"tabular text-caos-md leading-snug truncate " + (e.sev === "running" ? "text-caos-muted" : "text-caos-text")}>{e.text}</span>
        </div>
      ))}
    </div>
  );
}
