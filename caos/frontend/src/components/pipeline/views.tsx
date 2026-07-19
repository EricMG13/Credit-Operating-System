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
import { SurfaceState } from "@/components/shared/SurfaceState";
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
type PipelineModule = (typeof MODULES)[number];

function openSelectedModule(event: React.KeyboardEvent<HTMLButtonElement>, selected: boolean, moduleId: string, onOpen?: (id: string) => void) {
  if (event.key !== "Enter" || !selected || !onOpen) return;
  event.preventDefault();
  onOpen(moduleId);
}

function edgeConnected(nodeId: string, selected: string, related: Set<string>) {
  return nodeId === selected || related.has(nodeId);
}

function graphEdgeKind(source: string, target: string, selected: string | null, up: Set<string>, down: Set<string>): "up" | "down" | "idle" {
  if (!selected) return "idle";
  if (edgeConnected(source, selected, up) && edgeConnected(target, selected, up) && (up.has(source) || source === selected)) return "up";
  if (edgeConnected(source, selected, down) && edgeConnected(target, selected, down)) return "down";
  return "idle";
}

function graphEdgeOpacity(outOfScope: boolean, selected: string | null, active: boolean) {
  if (outOfScope) return 0.07;
  if (!selected) return 0.62;
  return active ? 0.95 : 0.16;
}

function GraphEdgePath({ edge, index, selected, scope, up, down }: { edge: (typeof EDGES)[number]; index: number; selected: string | null; scope: Set<string>; up: Set<string>; down: Set<string> }) {
  const [source, target] = edge;
  const start = NODE_POS[source], end = NODE_POS[target];
  if (!start || !end) return null;
  const x1 = start.x + NW / 2, y1 = start.y, x2 = end.x - NW / 2, y2 = end.y;
  const midpoint = (x1 + x2) / 2;
  const kind = graphEdgeKind(source, target, selected, up, down);
  const active = kind !== "idle";
  const stroke = { up: "var(--caos-accent)", down: "#a855f7", idle: "#4a4a60" }[kind];
  const opacity = graphEdgeOpacity(!scope.has(source) || !scope.has(target), selected, active);
  return <path key={index} d={`M ${x1} ${y1} C ${midpoint} ${y1}, ${midpoint} ${y2}, ${x2} ${y2}`} fill="none" stroke={stroke} strokeWidth={active ? 1.6 : 1.2} opacity={opacity} />;
}

function GraphEdges({ selected, scope, up, down }: { selected: string | null; scope: Set<string>; up: Set<string>; down: Set<string> }) {
  return <svg width={GW} height={GH} className="absolute inset-0">{EDGES.map((edge, index) => <GraphEdgePath key={index} edge={edge} index={index} selected={selected} scope={scope} up={up} down={down} />)}</svg>;
}

function GraphNodeBadges({ inScope, moduleId, state }: { inScope: boolean; moduleId: string; state: string }) {
  return (
    <>
      {inScope && NODE_QA[moduleId] ? <span role="img" aria-label="QA Finding" className="ml-auto text-caos-xs" style={{ color: "var(--caos-critical-bright)" }}>⛨</span> : null}
      {inScope && NODE_LIMITS[moduleId] ? <span role="img" aria-label="Has limitations" className="ml-auto inline-flex items-center" style={{ color: "var(--caos-warning)" }} title="Has limitations"><StatusGlyph kind="warning" /></span> : null}
      {state === "held" ? <span role="img" aria-label="Held" className="ml-auto inline-flex items-center" style={{ color: "var(--caos-warning)" }} title="Held"><StatusGlyph kind="locked" /></span> : null}
    </>
  );
}

function moduleBorderColor(selected: boolean, state: string, color: string, strength: number) {
  if (selected) return "var(--caos-accent)";
  if (state === "idle") return "var(--caos-border)";
  return `color-mix(in srgb, ${color} ${strength}%, transparent)`;
}

function moduleTitle(module: PipelineModule, inScope: boolean) {
  if (!inScope) return module.name + " — out of scope for this route plan";
  return module.name + " — Enter to select, Enter again (or double-click) to open outputs";
}

function graphModuleOpacity(inScope: boolean, related: boolean, dimmed: boolean) {
  if (!inScope) return 0.22;
  return related && !dimmed ? 1 : 0.32;
}

function moduleProgress(inScope: boolean, state: string, progress: number) {
  return inScope && state !== "idle" ? progress * 100 : 0;
}

function moduleRuntime(module: PipelineModule, selected: string | null, scope: Set<string>, sim: Sim) {
  const state = sim.mods[module.id]?.state || "idle";
  return {
    state,
    progress: sim.mods[module.id]?.prog || 0,
    isSelected: selected === module.id,
    inScope: scope.has(module.id),
    color: sevVar(state),
  };
}

function GraphModuleNode({ dim, down, module, onDoubleClick, onSelect, scope, selected, sim, up }: { dim: boolean; down: Set<string>; module: PipelineModule; onDoubleClick?: (id: string) => void; onSelect: (id: string | null) => void; scope: Set<string>; selected: string | null; sim: Sim; up: Set<string> }) {
  const position = NODE_POS[module.id];
  const runtime = moduleRuntime(module, selected, scope, sim);
  const related = !selected || runtime.isSelected || up.has(module.id) || down.has(module.id);
  const dimmed = dim && runtime.state === "pass" && !runtime.isSelected;
  const className = "absolute text-left rounded border bg-caos-panel transition-caos hover:border-caos-accent/70 focus-ring " + (runtime.isSelected ? "caos-selected z-10" : "");
  return (
    <button type="button" onClick={() => onSelect(runtime.isSelected ? null : module.id)} onDoubleClick={() => onDoubleClick?.(module.id)} onKeyDown={(event) => openSelectedModule(event, runtime.isSelected, module.id, onDoubleClick)} title={moduleTitle(module, runtime.inScope)} aria-pressed={runtime.isSelected} className={className} style={{ left: position.x - NW / 2, top: position.y - NH / 2, width: NW, height: NH, borderColor: moduleBorderColor(runtime.isSelected, runtime.state, runtime.color, 40), borderStyle: runtime.inScope ? "solid" : "dashed", opacity: graphModuleOpacity(runtime.inScope, related, dimmed) }}>
      <div className="flex items-center gap-1.5 px-2 pt-1.5 whitespace-nowrap">
        <Dot sev={runtime.state} pulse={runtime.state === "running"} glyph />
        <span className="tabular text-caos-md text-caos-text whitespace-nowrap">{module.id}</span>
        <GraphNodeBadges inScope={runtime.inScope} moduleId={module.id} state={runtime.state} />
      </div>
      <div className="px-2 text-caos-xs font-medium text-caos-text/90 truncate leading-tight">{module.name}</div>
      <div className="px-2 pt-[3px]"><Bar pct={moduleProgress(runtime.inScope, runtime.state, runtime.progress)} color={runtime.color} h={2} /></div>
    </button>
  );
}

function swimlaneOpacity(inScope: boolean, state: string) {
  if (!inScope) return 0.25;
  return state === "idle" ? 0.55 : 1;
}

function swimlaneStateLabel(inScope: boolean, state: string) {
  if (!inScope) return "skip";
  return state === "idle" ? "queued" : state;
}

function SwimlaneModuleNode({ module, onDoubleClick, onSelect, scope, selected, sim }: { module: PipelineModule; onDoubleClick?: (id: string) => void; onSelect: (id: string | null) => void; scope: Set<string>; selected: string | null; sim: Sim }) {
  const runtime = moduleRuntime(module, selected, scope, sim);
  const className = "text-left rounded border bg-caos-panel px-2 py-1.5 transition-caos hover:border-caos-accent/70 focus-ring " + (runtime.isSelected ? "caos-selected" : "");
  return (
    <button type="button" onClick={() => onSelect(runtime.isSelected ? null : module.id)} onDoubleClick={() => onDoubleClick?.(module.id)} onKeyDown={(event) => openSelectedModule(event, runtime.isSelected, module.id, onDoubleClick)} title={moduleTitle(module, runtime.inScope)} aria-pressed={runtime.isSelected} className={className} style={{ borderColor: moduleBorderColor(runtime.isSelected, runtime.state, runtime.color, 33), borderStyle: runtime.inScope ? "solid" : "dashed", opacity: swimlaneOpacity(runtime.inScope, runtime.state) }}>
      <div className="flex items-center gap-1.5"><Dot sev={runtime.state} pulse={runtime.state === "running"} /><span className="tabular text-caos-md text-caos-text">{module.id}</span><span className="tabular text-caos-2xs ml-auto" style={{ color: runtime.inScope ? runtime.color : "var(--caos-muted)" }}>{swimlaneStateLabel(runtime.inScope, runtime.state)}</span></div>
      <div className="text-caos-xs text-caos-muted leading-tight mt-0.5">{module.name}</div>
      <div className="mt-1"><Bar pct={moduleProgress(runtime.inScope, runtime.state, runtime.progress)} color={runtime.color} h={2} /></div>
      {runtime.inScope && NODE_QA[module.id] ? <div className="mt-1"><Tag sev="critical">QA {NODE_QA[module.id].id}</Tag></div> : null}
      {runtime.inScope && NODE_LIMITS[module.id] ? <div className="mt-1"><Tag sev="warning">LIMIT L-04</Tag></div> : null}
    </button>
  );
}

function SwimlaneColumn({ layer, onDoubleClick, onSelect, scope, selected, sim }: { layer: string; onDoubleClick?: (id: string) => void; onSelect: (id: string | null) => void; scope: Set<string>; selected: string | null; sim: Sim }) {
  const meta = LAYERS.find((value) => value.id === layer);
  const sequenceNote = layer === "L5" || layer === "L6" ? "Execution order — L6 Debate feeds L5 Governance sign-off" : undefined;
  return (
    <div className="flex flex-col min-h-0 rounded border border-caos-border bg-caos-bg/50">
      <div className="px-2 py-1.5 border-b border-caos-border shrink-0" title={sequenceNote}><div className="tabular text-caos-sm uppercase tracking-widest text-caos-text">{layer}</div><div className="text-caos-2xs text-caos-muted">{meta?.label ?? ""}{layer === "L5" ? " · after L6" : ""}</div></div>
      <div className="flex-1 min-h-0 overflow-auto p-1.5 flex flex-col gap-1.5">{(MODULES_BY_LAYER[layer] || []).map((module) => <SwimlaneModuleNode key={module.id} module={module} onDoubleClick={onDoubleClick} onSelect={onSelect} scope={scope} selected={selected} sim={sim} />)}</div>
    </div>
  );
}

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
          <GraphEdges selected={selected} scope={scope} up={up} down={down} />
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
      {MODULES.map((module) => <GraphModuleNode key={module.id} dim={dim} down={down} module={module} onDoubleClick={onDoubleClick} onSelect={onSelect} scope={scope} selected={selected} sim={sim} up={up} />)}
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
        {COL_ORDER.map((layer) => <SwimlaneColumn key={layer} layer={layer} onDoubleClick={onDoubleClick} onSelect={onSelect} scope={scope} selected={selected} sim={sim} />)}
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

interface InspectorProps {
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
}

function selectedById<T extends { id: string }>(selected: string | null, values: readonly T[]): T | undefined {
  return selected ? values.find((value) => value.id === selected) : undefined;
}

function seededInspectorFixture<T>(available: boolean, selected: string | null, fixtures: Record<string, T>): T | null {
  if (!available || !selected) return null;
  return fixtures[selected] ?? null;
}

function inspectorModel({ sim, selected, plan, scope, isLive = false }: InspectorProps) {
  const m = selectedById(selected, MODULES);
  const planEntry = selectedById(selected, plan);
  const base = selectedById(selected, SIM_PLAN);
  const inScope = Boolean(selected && scope.has(selected));
  const st = selected ? (sim.mods[selected]?.state || "idle") : "idle";
  const deps = planEntry?.deps ?? base?.deps ?? [];
  const consumers = selected ? EDGES.filter(([source]) => source === selected).map(([, target]) => target) : [];
  // Seeded ATLF fixtures (keyed by module id) — only valid for the offline demo.
  // Suppress under a live run so they don't read as this run's QA / limitations.
  const degraded = ["warning", "held", "blocked"].includes(st);
  const fixtureAvailable = inScope && !isLive;
  const qa = seededInspectorFixture(fixtureAvailable, selected, NODE_QA);
  const lim = seededInspectorFixture(fixtureAvailable, selected, NODE_LIMITS);
  const reqs = seededInspectorFixture(fixtureAvailable && degraded, selected, NODE_REQS);
  return { consumers, deps, inScope, lim, m, planEntry, qa, reqs, selected, st };
}

type InspectorModel = ReturnType<typeof inspectorModel>;

function EmptyInspector({ modeLabel, plan }: Pick<InspectorProps, "modeLabel" | "plan">) {
  return (
    <div className="p-4 text-caos-xl text-caos-muted leading-relaxed max-w-[50ch]">
      <h2 className="text-caos-text font-medium mb-2 text-balance">Module Inspector</h2>
      Select a module in the route graph or swimlanes to trace its <span style={{ color: "var(--caos-accent)" }}>upstream data lineage</span>, review <span style={{ color: "var(--caos-consumer)" }}>downstream consumers</span>, inspect execution payload logs, and view QA findings or limitations.
      <div className="mt-3 tabular text-caos-sm text-caos-muted">{modeLabel} route · {planCounts(plan).total} modules in scope.</div>
    </div>
  );
}

function InspectorHeader({ model, onOpen }: { model: InspectorModel; onOpen?: (id: string) => void }) {
  if (!model.m || !model.selected) return null;
  const destination = model.m.id === "CP-0" ? " · Document Intake" : model.m.layer === "INFRA" ? " · Report Studio" : " · Deep-Dive";
  return (
    <div className="px-3 py-2.5 border-b border-caos-border">
      <div className="flex items-center gap-2">
        <Dot sev={model.st} pulse={model.st === "running"} />
        <span className="tabular text-caos-xl text-caos-text">{model.m.id}</span>
        <Tag sev={model.st}>{model.st === "idle" ? "queued" : model.st}</Tag>
        {onOpen ? <button type="button" onClick={() => onOpen(model.selected!)} title={`Open ${model.m.id} outputs${destination}`} className="ml-auto tabular text-caos-xs px-1.5 h-6 rounded border border-caos-border text-caos-accent hover:bg-caos-accent hover:text-caos-bg hover:border-caos-accent transition-caos whitespace-nowrap shrink-0 focus-ring">OPEN →</button> : null}
      </div>
      <h2 className="text-caos-2xl text-caos-text mt-1 font-medium text-balance">{model.m.name}</h2>
      <div className="text-caos-md text-caos-muted mt-1 leading-snug max-w-[55ch]">{model.m.desc}</div>
    </div>
  );
}

function InspectorScopeNotice({ inScope, modeLabel }: { inScope: boolean; modeLabel: string }) {
  if (inScope) return null;
  return (
    <div className="px-3 py-2 border-b border-caos-border flex items-start gap-2" style={{ background: "color-mix(in srgb, var(--caos-muted) 6%, transparent)" }}>
      <span aria-hidden="true" className="text-caos-md text-caos-muted mt-px">⊘</span>
      <span className="text-caos-md text-caos-muted leading-snug">Out of scope for the {modeLabel} route — CP-X skipped this module; registers inherit from the last full-committee run (#2641).</span>
    </div>
  );
}

function InspectorPayload({ model }: { model: InspectorModel }) {
  if (!model.planEntry?.event || !["pass", "warning", "held", "blocked"].includes(model.st)) return null;
  return (
    <div className="px-3 py-2 border-b border-caos-border">
      <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1">{model.st === "blocked" ? "Persisted block status" : "Latest payload"}</div>
      <div className="text-caos-lg text-caos-text leading-snug">{model.planEntry.event}</div>
    </div>
  );
}

function InspectorQaFinding({ model }: { model: InspectorModel }) {
  if (!model.qa) return null;
  return (
    <div className="px-3 py-2 border-b border-caos-border">
      <div className="tabular text-caos-xs uppercase tracking-wider mb-1" style={{ color: "var(--caos-critical-bright)" }}>QA finding · CP-5</div>
      <div className="flex items-center gap-2 mb-1"><Tag sev="critical">{model.qa.sev}</Tag><span className="tabular text-caos-md text-caos-accent">{model.qa.id}</span></div>
      <div className="text-caos-lg text-caos-text leading-snug max-w-[55ch]">{model.qa.text}</div>
    </div>
  );
}

function InspectorLimitation({ limitation }: { limitation: string | null | undefined }) {
  if (!limitation) return null;
  return (
    <div className="px-3 py-2 border-b border-caos-border">
      <div className="tabular text-caos-xs uppercase tracking-wider mb-1" style={{ color: "var(--caos-warning)" }}>Propagated limitation · CP-X-06</div>
      <div className="text-caos-lg text-caos-text leading-snug max-w-[55ch]">{limitation}</div>
    </div>
  );
}

function InspectorRequirements({ model }: { model: InspectorModel }) {
  if (!model.reqs?.length) return null;
  return (
    <div className="px-3 py-2 border-b border-caos-border">
      <div className="tabular text-caos-xs uppercase tracking-wider mb-1.5" style={{ color: "var(--caos-warning)" }}>{model.st === "warning" ? "Required to clear warning" : "Required to release hold"} · documents & information</div>
      <div className="flex flex-col gap-1.5">
        {model.reqs.map((requirement) => (
          <div key={requirement.doc} className="flex items-start gap-1.5">
            <span aria-hidden="true" className="text-caos-xs mt-px shrink-0" style={{ color: "var(--caos-warning)" }}>▦</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-caos-lg text-caos-text leading-snug">{requirement.doc}</span>
                <span className="tabular text-caos-3xs uppercase tracking-wider px-1 py-px rounded border whitespace-nowrap" style={{ color: REQ_TAG_COLOR[requirement.tag], borderColor: `color-mix(in srgb, ${REQ_TAG_COLOR[requirement.tag]} 33%, transparent)`, background: `color-mix(in srgb, ${REQ_TAG_COLOR[requirement.tag]} 8%, transparent)` }}>{requirement.tag}</span>
              </div>
              <div className="text-caos-sm text-caos-muted leading-snug max-w-[50ch]">{requirement.why}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InspectorDependencies({ deps, sim }: { deps: string[]; sim: Sim }) {
  return (
    <div className="px-3 py-2 border-b border-caos-border">
      <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Upstream inputs · {deps.length}</div>
      <div className="flex flex-wrap gap-1">
        {deps.length ? deps.map((dependency) => <span key={dependency} className="flex items-center gap-1 tabular text-caos-sm px-1.5 py-0.5 rounded border border-caos-border bg-caos-bg"><Dot sev={sim.mods[dependency]?.state || "idle"} glyph />{dependency}</span>) : <span className="text-caos-md text-caos-muted">— root node (source intake)</span>}
      </div>
    </div>
  );
}

function InspectorConsumers({ consumers }: { consumers: string[] }) {
  return (
    <div className="px-3 py-2 border-b border-caos-border">
      <div className="tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5">Downstream consumers · {consumers.length}</div>
      <div className="flex flex-wrap gap-1">
        {consumers.length ? consumers.map((consumer) => <span key={consumer} className="flex items-center gap-1 tabular text-caos-sm px-1.5 py-0.5 rounded border border-caos-border bg-caos-bg text-caos-consumer">{consumer}</span>) : <span className="text-caos-md text-caos-muted">— terminal node</span>}
      </div>
    </div>
  );
}

export function Inspector(props: InspectorProps) {
  const model = inspectorModel(props);

  if (!model.selected || !model.m) return <EmptyInspector modeLabel={props.modeLabel} plan={props.plan} />;
  return (
    <div className="text-caos-xl">
      <InspectorHeader model={model} onOpen={props.onOpen} />
      <InspectorScopeNotice inScope={model.inScope} modeLabel={props.modeLabel} />
      <InspectorPayload model={model} />
      <InspectorQaFinding model={model} />
      <InspectorLimitation limitation={model.lim} />
      <InspectorRequirements model={model} />
      <InspectorDependencies deps={model.deps} sim={props.sim} />
      <InspectorConsumers consumers={model.consumers} />
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
    return <SurfaceState kind="loading" title="Loading persisted CP-5B driver lineage…" compact />;
  }
  const hasDriverRegister = output?.sections.some((section) => section.title.includes("Decision-relevant driver lineage"));
  if (!output || !hasDriverRegister) {
    return (
      <SurfaceState
        kind="unavailable"
        title="LIVE REGISTER UNAVAILABLE"
        detail="This run has no persisted CP-5B decision-driver register. Re-run the issuer to produce one; demo lineage is not substituted."
        compact
        className="m-3"
      />
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
