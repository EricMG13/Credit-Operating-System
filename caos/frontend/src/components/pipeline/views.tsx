"use client";

// Pipeline Visualizer views: DAG graph, swimlanes, inspector, CP-5B lineage
// rail, and orchestrator event log (port of design bundle concept-b.jsx).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ancestorsOf, descendantsOf, DRIVERS, EDGES, LAYERS, MODULES,
  NODE_LIMITS, NODE_QA, NODE_REQS, SIM_PLAN, type Driver, type PlanStep,
} from "@/lib/pipeline/data";
import { type Sim, type SimEvent } from "@/lib/pipeline/sim-engine";
import { planCounts } from "@/lib/pipeline/sim";
import { sevVar } from "@/lib/pipeline/sev";
import { EvChip } from "@/components/reports/EvidenceModal";
import { Bar, Dot, Tag } from "./atoms";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { OutSections } from "@/components/deepdive/OutSections";
import type { ModuleOutput } from "@/lib/deepdive/module-outputs";

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
const MODULES_BY_LAYER = (() => {
  const groups: Record<string, typeof MODULES> = {};
  COL_ORDER.forEach((layer) => {
    groups[layer] = MODULES.filter((m) => m.layer === layer);
  });
  return groups;
})();
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: GW, h: GH });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (typeof ResizeObserver === "undefined") {
      setBox({ w: el.clientWidth || GW, h: el.clientHeight || GH });
      return;
    }
    const ro = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Preserve effective label size. At narrower widths the graph becomes a
  // controlled two-axis canvas instead of shrinking analytical labels until
  // they are technically present but physically unreadable.
  const scale = Math.max(0.86, Math.min(1, box.w / GW, box.h / GH));
  const inUp = (n: string) => n === selected || up.has(n);
  const inDown = (n: string) => n === selected || down.has(n);

  const scaledW = GW * scale;
  const scaledH = GH * scale;

  return (
    <div
      ref={wrapRef}
      role="region"
      tabIndex={0}
      aria-label="Execution graph; scroll horizontally to inspect all module layers"
      className="pipeline-graph-canvas focus-ring relative h-full min-h-[420px] overflow-auto overscroll-contain"
    >
      <div className="relative overflow-hidden" style={{ width: scaledW, height: scaledH }}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: GW, height: GH, transform: `scale(${scale})` }}>
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
          const stroke = upEdge ? "var(--caos-accent)" : downEdge ? "#a855f7" : "#4a4a60";
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={stroke}
              strokeWidth={active ? 1.6 : 1.2}
              opacity={off ? 0.07 : selected ? (active ? 0.95 : 0.16) : 0.62}
            />
          );
        })}
      </svg>
      {COL_ORDER.map((l, ci) => {
        const meta = LAYERS.find((x) => x.id === l);
        const seqNote = l === "L5" || l === "L6" ? "Execution order — L6 Debate feeds L5 Governance sign-off" : undefined;
        return (
          <div key={l} className="absolute text-center" style={{ left: 110 + ci * 158 - NW / 2, top: 4, width: NW }} title={seqNote}>
            <div className="tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-text">{l}</div>
            <div className="text-caos-xs text-caos-muted">{meta ? meta.label : ""}{l === "L5" ? " · after L6" : ""}</div>
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
        const color = sevVar(st);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(sel ? null : m.id)}
            onDoubleClick={() => onDoubleClick && onDoubleClick(m.id)}
            onKeyDown={(e) => {
              // Keyboard parity for the mouse's double-click-to-open: once a node
              // is selected, a second Enter opens its outputs (WCAG 2.1.1). Space
              // still toggles selection. First Enter on an unselected node selects.
              if (e.key === "Enter" && sel && onDoubleClick) {
                e.preventDefault();
                onDoubleClick(m.id);
              }
            }}
            title={inScope ? m.name + " — Enter to select, Enter again (or double-click) to open outputs" : m.name + " — out of scope for this route plan"}
            aria-pressed={sel}
            className={"absolute text-left rounded border bg-caos-panel transition-caos hover:border-caos-accent/70 focus-ring " + (sel ? "caos-selected z-10" : "")}
            style={{
              left: p.x - NW / 2, top: p.y - NH / 2, width: NW, height: NH,
              borderColor: sel ? "var(--caos-accent)" : st === "idle" ? "var(--caos-border)" : `color-mix(in srgb, ${color} 40%, transparent)`,
              borderStyle: inScope ? "solid" : "dashed",
              opacity: !inScope ? 0.22 : related && !doneDim ? 1 : 0.32,
            }}
          >
            <div className="flex items-center gap-1.5 px-2 pt-1.5 whitespace-nowrap">
              {/* glyph: a terminal warning-vs-pass node otherwise differs by hue alone (the swimlane view prints the state as text; the DAG node doesn't) */}
              <Dot sev={st} pulse={st === "running"} glyph />
              <span className="tabular text-caos-md text-caos-text whitespace-nowrap">{m.id}</span>
              {inScope && NODE_QA[m.id] ? <span role="img" aria-label="QA Finding" className="ml-auto text-caos-xs" style={{ color: "var(--caos-critical-bright)" }}>⛨</span> : null}
              {inScope && NODE_LIMITS[m.id] ? <span role="img" aria-label="Has limitations" className="ml-auto inline-flex items-center" style={{ color: "var(--caos-warning)" }} title="Has limitations"><StatusGlyph kind="warning" /></span> : null}
              {st === "held" ? <span role="img" aria-label="Held" className="ml-auto inline-flex items-center" style={{ color: "var(--caos-warning)" }} title="Held"><StatusGlyph kind="locked" /></span> : null}
            </div>
            <div className="px-2 text-caos-xs font-medium text-caos-text/90 truncate leading-tight">{m.name}</div>
            <div className="px-2 pt-[3px]"><Bar pct={!inScope || st === "idle" ? 0 : prog * 100} color={color} h={2} /></div>
          </button>
        );
      })}
        </div>
      </div>
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
    <div className="h-full overflow-x-auto">
      <div className="grid h-full gap-1.5 p-2 min-w-[1100px]" style={{ gridTemplateColumns: "repeat(9, 1fr)" }}>
        {COL_ORDER.map((l) => {
          const meta = LAYERS.find((x) => x.id === l);
          const mods = MODULES_BY_LAYER[l] || [];
          return (
            <div key={l} className="flex flex-col min-h-0 rounded border border-caos-border bg-caos-bg/50">
            <div className="px-2 py-1.5 border-b border-caos-border shrink-0" title={l === "L5" || l === "L6" ? "Execution order — L6 Debate feeds L5 Governance sign-off" : undefined}>
              <div className="tabular text-caos-sm uppercase tracking-widest text-caos-text">{l}</div>
              <div className="text-caos-2xs text-caos-muted">{meta ? meta.label : ""}{l === "L5" ? " · after L6" : ""}</div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-1.5 flex flex-col gap-1.5">
              {mods.map((m) => {
                const st = sim.mods[m.id]?.state || "idle";
                const prog = sim.mods[m.id]?.prog || 0;
                const sel = selected === m.id;
                const inScope = scope.has(m.id);
                const color = sevVar(st);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelect(sel ? null : m.id)}
                    onDoubleClick={() => onDoubleClick && onDoubleClick(m.id)}
                    onKeyDown={(e) => {
                      // Keyboard parity with double-click-to-open: a second Enter on
                      // an already-selected node opens its outputs (WCAG 2.1.1).
                      if (e.key === "Enter" && sel && onDoubleClick) {
                        e.preventDefault();
                        onDoubleClick(m.id);
                      }
                    }}
                    title={inScope ? m.name + " — Enter to select, Enter again (or double-click) to open outputs" : m.name + " — out of scope for this route plan"}
                    aria-pressed={sel}
                    className={"text-left rounded border bg-caos-panel px-2 py-1.5 transition-caos hover:border-caos-accent/70 focus-ring " + (sel ? "caos-selected" : "")}
                    style={{
                      borderColor: sel ? "var(--caos-accent)" : st === "idle" ? "var(--caos-border)" : `color-mix(in srgb, ${color} 33%, transparent)`,
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
  sim, selected, plan, scope, modeLabel, isLive = false, onOpen,
}: {
  sim: Sim;
  selected: string | null;
  plan: PlanStep[];
  scope: Set<string>;
  modeLabel: string;
  // True when the inspector is showing a LIVE run. The QA-finding / limitation /
  // required-docs cards are seeded ATLF fixtures keyed by module id with no live
  // equivalent yet, so they are suppressed under a live run rather than shown as
  // if they belonged to it. The live payload line + lineage still render.
  isLive?: boolean;
  // Open the selected module's outputs (deep-dive / report / intake). A visible,
  // keyboard-reachable action for the single most valuable navigation on this
  // surface — "show me this module's evidence" — which was previously double-
  // click-only on the graph nodes (mouse-only, undiscoverable). (a11y H3)
  onOpen?: (id: string) => void;
}) {
  const m = selected ? MODULES.find((x) => x.id === selected) : undefined;
  const planEntry = selected ? plan.find((x) => x.id === selected) : undefined;
  const base = selected ? SIM_PLAN.find((x) => x.id === selected) : undefined;
  const inScope = selected ? scope.has(selected) : false;
  const st = selected ? (sim.mods[selected]?.state || "idle") : "idle";
  const deps = planEntry ? planEntry.deps : base ? base.deps : [];
  const consumers = selected ? EDGES.filter(([a]) => a === selected).map(([, b]) => b) : [];
  // Seeded ATLF fixtures (keyed by module id) — only valid for the offline demo.
  // Suppress under a live run so they don't read as this run's QA / limitations.
  const qa = inScope && !isLive && selected ? NODE_QA[selected] : null;
  const lim = inScope && !isLive && selected ? NODE_LIMITS[selected] : null;
  const degraded = ["warning", "held", "blocked"].includes(st);
  const reqs = inScope && !isLive && degraded && selected ? NODE_REQS[selected] : null;

  if (!selected || !m) {
    return (
      <div className="p-4 text-caos-xl text-caos-muted leading-relaxed max-w-[50ch]">
        <h2 className="text-caos-text font-medium mb-2 text-balance">Module Inspector</h2>
        Select a module in the route graph or swimlanes to trace its <span style={{ color: "var(--caos-accent)" }}>upstream data lineage</span>, review <span style={{ color: "var(--caos-consumer)" }}>downstream consumers</span>, inspect execution payload logs, and view QA findings or limitations.
        <div className="mt-3 tabular text-caos-sm text-caos-muted">
          {modeLabel} route · {planCounts(plan).total} modules in scope.
        </div>
      </div>
    );
  }
  return (
    <div className="text-caos-xl">
      <div className="px-3 py-2.5 border-b border-caos-border">
        <div className="flex items-center gap-2">
          <Dot sev={st} pulse={st === "running"} />
          <span className="tabular text-caos-xl text-caos-text">{m.id}</span>
          <Tag sev={st}>{st === "idle" ? "queued" : st}</Tag>
          {onOpen ? (
            <button
              type="button"
              onClick={() => onOpen(selected)}
              title={`Open ${m.id} outputs${m.id === "CP-0" ? " · Document Intake" : m.layer === "INFRA" ? " · Report Studio" : " · Deep-Dive"}`}
              className="ml-auto tabular text-caos-xs px-1.5 h-6 rounded border border-caos-border text-caos-accent hover:bg-caos-accent hover:text-caos-bg hover:border-caos-accent transition-caos whitespace-nowrap shrink-0 focus-ring"
            >
              OPEN →
            </button>
          ) : null}
        </div>
        <h2 className="text-caos-2xl text-caos-text mt-1 font-medium text-balance">{m.name}</h2>
        <div className="text-caos-md text-caos-muted mt-1 leading-snug max-w-[55ch]">{m.desc}</div>
      </div>
      {!inScope ? (
        <div className="px-3 py-2 border-b border-caos-border flex items-start gap-2" style={{ background: "color-mix(in srgb, var(--caos-muted) 6%, transparent)" }}>
          <span aria-hidden="true" className="text-caos-md text-caos-muted mt-px">⊘</span>
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
          <div className="tabular text-caos-xs uppercase tracking-wider mb-1" style={{ color: "var(--caos-critical-bright)" }}>QA finding · CP-5</div>
          <div className="flex items-center gap-2 mb-1"><Tag sev="critical">{qa.sev}</Tag><span className="tabular text-caos-md text-caos-accent">{qa.id}</span></div>
          <div className="text-caos-lg text-caos-text leading-snug max-w-[55ch]">{qa.text}</div>
        </div>
      ) : null}
      {lim ? (
        <div className="px-3 py-2 border-b border-caos-border">
          <div className="tabular text-caos-xs uppercase tracking-wider mb-1" style={{ color: "var(--caos-warning)" }}>Propagated limitation · CP-X-06</div>
          <div className="text-caos-lg text-caos-text leading-snug max-w-[55ch]">{lim}</div>
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
                <span aria-hidden="true" className="text-caos-xs mt-px shrink-0" style={{ color: "var(--caos-warning)" }}>▦</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-caos-lg text-caos-text leading-snug">{r.doc}</span>
                    <span
                      className="tabular text-caos-3xs uppercase tracking-wider px-1 py-px rounded border whitespace-nowrap"
                      style={{
                        color: REQ_TAG_COLOR[r.tag],
                        borderColor: `color-mix(in srgb, ${REQ_TAG_COLOR[r.tag]} 33%, transparent)`,
                        background: `color-mix(in srgb, ${REQ_TAG_COLOR[r.tag]} 8%, transparent)`,
                      }}
                    >
                      {r.tag}
                    </span>
                  </div>
                  <div className="text-caos-sm text-caos-muted leading-snug max-w-[50ch]">{r.why}</div>
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
              {/* glyph: the dot is the sole status carrier here (the id text says nothing) — never color-alone */}
              <Dot sev={sim.mods[d]?.state || "idle"} glyph />{d}
            </span>
          )) : <span className="text-caos-md text-caos-muted">— root node (source intake)</span>}
        </div>
      </div>
      <div className="px-3 py-2 border-b border-caos-border">
        <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Downstream consumers · {consumers.length}</div>
        <div className="flex flex-wrap gap-1">
          {consumers.length ? consumers.map((d) => (
            <span key={d} className="flex items-center gap-1 tabular text-caos-sm px-1.5 py-0.5 rounded border border-caos-border bg-caos-bg text-caos-consumer">
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
  const list = useMemo(() => {
    return drivers ? DRIVERS.filter((d) => drivers.includes(d.n)) : DRIVERS;
  }, [drivers]);
  return (
    <div>
      {/* Default (no node selected) shows the full seeded reference register —
          label it so it never reads as this run's live lineage. */}
      {drivers === null ? (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-caos-border/50">
          <Tag sev="idle">DEMO</Tag>
          <span className="tabular text-caos-2xs text-caos-muted">Seeded CP-5B reference — select a node to trace its drivers.</span>
        </div>
      ) : null}
      {list.map((d) => (
        <div
          key={d.n}
          className="border-b border-caos-border/50 hover:bg-caos-elevated/60 transition-caos focus-within:bg-caos-elevated/60"
        >
          <button
            type="button"
            className={"w-full text-left px-3 pt-2 cursor-pointer focus-ring outline-none " + (d.evs.length ? "pb-1" : "pb-2")}
            onClick={() => onPick(d)}
          >
            <span className="flex items-center gap-2">
              <span className="tabular text-caos-md text-caos-muted">#{d.n}</span>
              <span className="text-caos-lg text-caos-text leading-snug flex-1">{d.driver}</span>
              <Tag sev={d.status === "verified" ? "ok" : "warning"}>{d.status}</Tag>
            </span>
            <span className="block tabular text-caos-xs text-caos-muted mt-1 leading-relaxed">{d.lineage}</span>
            <span className="flex items-center gap-1.5 mt-1" title={`Confidence score: ${(d.conf * 100).toFixed(0)}%`}>
              <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted shrink-0">conf</span>
              <Bar pct={d.conf * 100} color={d.conf > 0.7 ? "var(--caos-success)" : "var(--caos-warning)"} h={2} />
              <span className="tabular text-caos-xs text-caos-muted shrink-0">{(d.conf * 100).toFixed(0)}%</span>
            </span>
          </button>
          {d.evs.length ? (
            // Each EvChip is itself a ≥24×24 target (WCAG 2.5.8) — size, not
            // spacing, carries the requirement here.
            <div className="px-3 pb-2 pt-1 flex flex-wrap items-center gap-x-1 gap-y-2">
              <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">sources</span>
              {d.evs.map((e) => <EvChip key={e} id={e} onOpen={onOpenEvidence} />)}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function LiveLineagePanel({
  output,
  loading,
  onOpenEvidence,
}: {
  output?: ModuleOutput;
  loading: boolean;
  onOpenEvidence: (id: string) => void;
}) {
  if (loading) {
    return (
      <div role="status" className="px-3 py-2 text-caos-md text-caos-muted">
        Loading persisted CP-5B driver lineage…
      </div>
    );
  }
  const hasDriverRegister = output?.sections.some((section) => section.title.includes("Decision-relevant driver lineage"));
  if (!output || !hasDriverRegister) {
    return (
      <div role="status" className="m-3 rounded border border-caos-warning/50 bg-caos-panel px-3 py-2.5">
        <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-warning">⚠ LIVE REGISTER UNAVAILABLE</div>
        <div className="mt-1 text-caos-md text-caos-muted leading-relaxed">
          This run has no persisted CP-5B decision-driver register. Re-run the issuer to produce one; demo lineage is not substituted.
        </div>
      </div>
    );
  }
  return (
    <div className="p-2 flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-1.5">
        {output.kpis.map((kpi) => (
          <div key={kpi.l} className="rounded border border-caos-border bg-caos-bg px-2 py-1.5">
            <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">{kpi.l}</div>
            <div className="tabular text-caos-md text-caos-text">{kpi.v}</div>
          </div>
        ))}
      </div>
      <OutSections sections={output.sections} onOpenEvidence={onOpenEvidence} />
    </div>
  );
}

/* ---------- event log ---------- */
export function EventLog({ events }: { events: SimEvent[] }) {
  return (
    <div tabIndex={0} aria-label="Execution trace log" role="log" aria-live="polite" className="h-full overflow-auto focus-ring">
      {events.length === 0 ? <div className="px-3 py-2 text-caos-md text-caos-muted">Awaiting run start…</div> : null}
      {events.map((e, i) => (
        <div key={events.length - i} className={"flex items-center gap-2 px-3 py-[3.5px] border-b border-caos-border/40 " + (i === 0 ? "caos-enter" : "")}>
          <span className="tabular text-caos-sm text-caos-muted shrink-0">{e.t}</span>
          <Dot sev={e.sev} />
          <span className={"min-w-0 tabular text-caos-md leading-snug truncate " + (e.sev === "running" ? "text-caos-muted" : "text-caos-text")}>{e.text}</span>
        </div>
      ))}
    </div>
  );
}
