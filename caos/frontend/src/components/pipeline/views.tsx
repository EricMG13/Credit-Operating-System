"use client";

// Pipeline Visualizer views: DAG graph, swimlanes, inspector, CP-5B lineage
// rail, and orchestrator event log (port of design bundle concept-b.jsx).

import { useEffect, useMemo, useRef, useState } from "react";
import type { Driver, NodeReq, PlanStep } from "@/lib/pipeline/data";
import { EDGES, MODULES } from "@/lib/pipeline/topology";
import { type Sim, type SimEvent } from "@/lib/pipeline/sim-engine";
import { planCounts } from "@/lib/pipeline/plan-counts";
import { sevVar } from "@/lib/pipeline/sev";
import { EvChip } from "@/components/reports/EvChip";
import { Bar, Dot, Tag } from "./atoms";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { OutSections } from "@/components/deepdive/OutSections";
import type { ModuleOutput } from "@/lib/deepdive/module-outputs";

const STAGE_DEFINITIONS = [
  { id: "intake-routing", label: "Intake & routing", layers: ["L0", "ORCH"] },
  { id: "credit-fact-base", label: "Credit fact base", layers: ["L1"] },
  { id: "fundamental-analysis", label: "Fundamental analysis", layers: ["L2"] },
  { id: "value-legal", label: "Value & legal", layers: ["L3", "L4"] },
  { id: "committee-debate", label: "Committee debate", layers: ["L6"] },
  { id: "qa-clearance", label: "QA clearance", layers: ["L5"] },
  { id: "output-persistence", label: "Output & persistence", layers: ["INFRA"] },
] as const;

export const PIPELINE_STAGES = STAGE_DEFINITIONS.map((stage) => ({
  ...stage,
  moduleIds: MODULES.filter((module) => stage.layers.some((layer) => layer === module.layer)).map((module) => module.id),
}));

const STAGE_INDEX_BY_MODULE = new Map(PIPELINE_STAGES.flatMap((stage, index) => stage.moduleIds.map((moduleId) => [moduleId, index] as const)));

export const STAGE_EDGE_BUNDLES = (() => {
  const bundles = new Map<string, { sourceStage: number; targetStage: number; count: number; edges: [string, string][] }>();
  EDGES.forEach((edge) => {
    const sourceStage = STAGE_INDEX_BY_MODULE.get(edge[0]);
    const targetStage = STAGE_INDEX_BY_MODULE.get(edge[1]);
    if (sourceStage === undefined || targetStage === undefined || sourceStage === targetStage) return;
    const key = `${sourceStage}:${targetStage}`;
    const bundle = bundles.get(key) ?? { sourceStage, targetStage, count: 0, edges: [] };
    bundle.count += 1;
    bundle.edges.push(edge);
    bundles.set(key, bundle);
  });
  return [...bundles.values()].sort((a, b) => a.sourceStage - b.sourceStage || a.targetStage - b.targetStage);
})();

export interface PipelineReferenceFixtures {
  drivers: readonly Driver[];
  nodeLimits: Record<string, string>;
  nodeQa: Record<string, { id: string; sev: string; text: string }>;
  nodeReqs: Record<string, NodeReq[]>;
}

/* ---------- graph geometry ---------- */
const GW = 1480, GH = 620;
const STAGE_X = 112;
const STAGE_GAP = 208;
function layoutNodes(): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  PIPELINE_STAGES.forEach((stage, ci) => {
    const mods = stage.moduleIds.map((moduleId) => MODULES.find((module) => module.id === moduleId)).filter((module): module is PipelineModule => Boolean(module));
    const x = STAGE_X + ci * STAGE_GAP;
    const spacing = mods.length > 1 ? (GH - 150) / (mods.length - 1) : 0;
    mods.forEach((m, i) => {
      const y = mods.length > 1 ? 108 + i * spacing : GH / 2;
      pos[m.id] = { x, y };
    });
  });
  return pos;
}
const NODE_POS = layoutNodes();
const NW = 184, NH = 58;
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

function GraphEdgePath({ bundle, index, selected, scope, up, down }: { bundle: (typeof STAGE_EDGE_BUNDLES)[number]; index: number; selected: string | null; scope: Set<string>; up: Set<string>; down: Set<string> }) {
  const x1 = STAGE_X + bundle.sourceStage * STAGE_GAP + NW / 2;
  const x2 = STAGE_X + bundle.targetStage * STAGE_GAP - NW / 2;
  const y = 74 + (index % 4) * 5;
  const activeEdge = selected ? bundle.edges.find(([source, target]) => source === selected || target === selected) : undefined;
  const kind = activeEdge ? graphEdgeKind(activeEdge[0], activeEdge[1], selected, up, down) : "idle";
  const active = kind !== "idle";
  const stroke = { up: "var(--caos-accent)", down: "var(--tranche-sub)", idle: "var(--caos-border)" }[kind];
  const outOfScope = bundle.edges.every(([source, target]) => !scope.has(source) || !scope.has(target));
  const opacity = graphEdgeOpacity(outOfScope, selected, active);
  const midpoint = (x1 + x2) / 2;
  return (
    <g data-testid="stage-edge-bundle">
      <path d={`M ${x1} ${y} C ${midpoint} ${y - 12}, ${midpoint} ${y + 12}, ${x2} ${y}`} fill="none" stroke={stroke} strokeWidth={active ? 2 : Math.min(2.2, 1 + bundle.count / 12)} opacity={opacity} />
      <text x={midpoint} y={y - 4} textAnchor="middle" fill="var(--caos-muted)" fontSize="9" opacity={Math.max(0.62, opacity)}>{bundle.count}</text>
    </g>
  );
}

function GraphEdges({ selected, scope, up, down }: { selected: string | null; scope: Set<string>; up: Set<string>; down: Set<string> }) {
  return <svg width={GW} height={GH} className="absolute inset-0" aria-hidden="true" focusable="false">{STAGE_EDGE_BUNDLES.map((bundle, index) => <GraphEdgePath key={`${bundle.sourceStage}:${bundle.targetStage}`} bundle={bundle} index={index} selected={selected} scope={scope} up={up} down={down} />)}</svg>;
}

function GraphNodeBadges({ inScope, moduleId, state, fixtures }: { inScope: boolean; moduleId: string; state: string; fixtures?: PipelineReferenceFixtures }) {
  return (
    <>
      {inScope && fixtures?.nodeQa[moduleId] ? <span role="img" aria-label="QA Finding" className="ml-auto text-caos-xs" style={{ color: "var(--caos-critical-bright)" }}>⛨</span> : null}
      {inScope && fixtures?.nodeLimits[moduleId] ? <span role="img" aria-label="Has limitations" className="ml-auto inline-flex items-center" style={{ color: "var(--caos-warning)" }} title="Has limitations"><StatusGlyph kind="warning" /></span> : null}
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
  if (!inScope) return 0.38;
  if (related && !dimmed) return 1;
  return dimmed ? 0.62 : 0.68;
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

function GraphModuleNode({ dim, down, fixtures, module, onDoubleClick, onSelect, scope, selected, sim, up }: { dim: boolean; down: Set<string>; fixtures?: PipelineReferenceFixtures; module: PipelineModule; onDoubleClick?: (id: string) => void; onSelect: (id: string | null) => void; scope: Set<string>; selected: string | null; sim: Sim; up: Set<string> }) {
  const position = NODE_POS[module.id];
  const runtime = moduleRuntime(module, selected, scope, sim);
  const related = !selected || runtime.isSelected || up.has(module.id) || down.has(module.id);
  const dimmed = dim && runtime.state === "pass" && !runtime.isSelected;
  const className = "absolute text-left rounded border bg-caos-panel transition-caos hover:border-caos-accent/70 focus-ring " + (runtime.isSelected ? "caos-selected z-10" : "");
  return (
    <button type="button" onClick={() => onSelect(runtime.isSelected ? null : module.id)} onDoubleClick={() => onDoubleClick?.(module.id)} onKeyDown={(event) => openSelectedModule(event, runtime.isSelected, module.id, onDoubleClick)} title={moduleTitle(module, runtime.inScope)} aria-pressed={runtime.isSelected} className={className} style={{ left: position.x - NW / 2, top: position.y - NH / 2, width: NW, height: NH, borderColor: moduleBorderColor(runtime.isSelected, runtime.state, runtime.color, 40), borderStyle: runtime.inScope ? "solid" : "dashed", opacity: graphModuleOpacity(runtime.inScope, related, dimmed) }}>
      <div className="px-2 pt-1.5 text-caos-xs font-medium text-caos-text leading-tight line-clamp-2">{module.name}</div>
      <div className="flex items-center gap-1.5 px-2 pt-1 whitespace-nowrap">
        <Dot sev={runtime.state} pulse={runtime.state === "running"} glyph />
        <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">{module.id}</span>
        <GraphNodeBadges inScope={runtime.inScope} moduleId={module.id} state={runtime.state} fixtures={fixtures} />
      </div>
      {runtime.state !== "idle" ? <div className="px-2 pt-[3px]"><Bar pct={moduleProgress(runtime.inScope, runtime.state, runtime.progress)} color={runtime.color} h={2} /></div> : null}
    </button>
  );
}

function swimlaneOpacity(inScope: boolean, state: string) {
  if (!inScope) return 0.25;
  return state === "idle" ? 0.55 : 1;
}

function swimlaneStateLabel(inScope: boolean, state: string) {
  if (!inScope) return "skip";
  return state === "idle" ? "planned" : state;
}

function SwimlaneModuleNode({ fixtures, module, onDoubleClick, onSelect, scope, selected, sim }: { fixtures?: PipelineReferenceFixtures; module: PipelineModule; onDoubleClick?: (id: string) => void; onSelect: (id: string | null) => void; scope: Set<string>; selected: string | null; sim: Sim }) {
  const runtime = moduleRuntime(module, selected, scope, sim);
  const className = "text-left rounded border bg-caos-panel px-2 py-1.5 transition-caos hover:border-caos-accent/70 focus-ring " + (runtime.isSelected ? "caos-selected" : "");
  return (
    <button type="button" onClick={() => onSelect(runtime.isSelected ? null : module.id)} onDoubleClick={() => onDoubleClick?.(module.id)} onKeyDown={(event) => openSelectedModule(event, runtime.isSelected, module.id, onDoubleClick)} title={moduleTitle(module, runtime.inScope)} aria-pressed={runtime.isSelected} className={className} style={{ borderColor: moduleBorderColor(runtime.isSelected, runtime.state, runtime.color, 33), borderStyle: runtime.inScope ? "solid" : "dashed", opacity: swimlaneOpacity(runtime.inScope, runtime.state) }}>
      <div className="text-caos-xs text-caos-text leading-tight">{module.name}</div>
      <div className="flex items-center gap-1.5 mt-0.5"><Dot sev={runtime.state} pulse={runtime.state === "running"} /><span className="tabular text-caos-xs text-caos-muted">{module.id}</span><span className="tabular text-caos-2xs ml-auto" style={{ color: runtime.inScope ? runtime.color : "var(--caos-muted)" }}>{swimlaneStateLabel(runtime.inScope, runtime.state)}</span></div>
      {runtime.state !== "idle" ? <div className="mt-1"><Bar pct={moduleProgress(runtime.inScope, runtime.state, runtime.progress)} color={runtime.color} h={2} /></div> : null}
      {runtime.inScope && fixtures?.nodeQa[module.id] ? <div className="mt-1"><Tag sev="critical">QA {fixtures.nodeQa[module.id].id}</Tag></div> : null}
      {runtime.inScope && fixtures?.nodeLimits[module.id] ? <div className="mt-1"><Tag sev="warning">LIMIT L-04</Tag></div> : null}
    </button>
  );
}

function SwimlaneColumn({ fixtures, stage, onDoubleClick, onSelect, scope, selected, sim }: { fixtures?: PipelineReferenceFixtures; stage: (typeof PIPELINE_STAGES)[number]; onDoubleClick?: (id: string) => void; onSelect: (id: string | null) => void; scope: Set<string>; selected: string | null; sim: Sim }) {
  return (
    <div className="flex flex-col min-h-0 rounded border border-caos-border bg-caos-bg/50">
      <div className="px-2 py-1.5 border-b border-caos-border shrink-0"><div className="text-caos-sm uppercase tracking-widest text-caos-text">{stage.label}</div><div className="tabular text-caos-2xs text-caos-muted">Stage {PIPELINE_STAGES.indexOf(stage) + 1} · {stage.moduleIds.length} modules</div></div>
      <div className="flex-1 min-h-0 overflow-auto p-1.5 flex flex-col gap-1.5">{stage.moduleIds.map((moduleId) => MODULES.find((module) => module.id === moduleId)).filter((module): module is PipelineModule => Boolean(module)).map((module) => <SwimlaneModuleNode key={module.id} fixtures={fixtures} module={module} onDoubleClick={onDoubleClick} onSelect={onSelect} scope={scope} selected={selected} sim={sim} />)}</div>
    </div>
  );
}

function directGraphNeighbors(selected: string | null) {
  if (!selected) return { up: new Set<string>(), down: new Set<string>() };
  return {
    up: new Set(EDGES.filter(([, target]) => target === selected).map(([source]) => source)),
    down: new Set(EDGES.filter(([source]) => source === selected).map(([, target]) => target)),
  };
}

export function PipelineStageTable({ selected, scope, sim }: { selected: string | null; scope: Set<string>; sim: Sim }) {
  return (
    <div tabIndex={0} aria-label="Ordered stage table; scroll to inspect all modules" className="min-h-[180px] min-w-0 overflow-auto rounded border border-caos-border bg-caos-bg/55 focus-ring">
      <table aria-label="Ordered pipeline stages and modules" className="w-full border-collapse text-left">
        <caption className="sr-only">Ordered pipeline stages and modules with current route state</caption>
        <thead className="sticky top-0 z-10 bg-caos-panel">
          <tr className="border-b border-caos-border text-caos-2xs uppercase tracking-widest text-caos-muted">
            <th scope="col" className="px-2 py-1.5 font-medium">Stage</th>
            <th scope="col" className="px-2 py-1.5 font-medium">Module</th>
            <th scope="col" className="px-2 py-1.5 font-medium">State</th>
          </tr>
        </thead>
        <tbody>
          {PIPELINE_STAGES.flatMap((stage, stageIndex) => stage.moduleIds.map((moduleId) => {
            const pipelineModule = MODULES.find((candidate) => candidate.id === moduleId);
            if (!pipelineModule) return null;
            const inScope = scope.has(pipelineModule.id);
            const state = sim.mods[pipelineModule.id]?.state ?? "idle";
            const stateLabel = swimlaneStateLabel(inScope, state);
            return (
              <tr key={pipelineModule.id} aria-current={selected === pipelineModule.id ? "true" : undefined} className={`border-b border-caos-border/55 ${selected === pipelineModule.id ? "bg-caos-accent/10" : ""}`}>
                <td className="px-2 py-1.5 align-top text-caos-xs text-caos-muted"><span className="tabular mr-1">{stageIndex + 1}</span>{stage.label}</td>
                <td className="px-2 py-1.5 align-top"><span className="block text-caos-xs text-caos-text">{pipelineModule.name}</span><span className="tabular block text-caos-2xs text-caos-muted">{pipelineModule.id}</span></td>
                <td className="tabular px-2 py-1.5 align-top text-caos-xs" style={{ color: inScope && state !== "idle" ? sevVar(state) : "var(--caos-muted)" }}>{stateLabel}</td>
              </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- DAG view ---------- */
export function GraphView({
  sim, selected, onSelect, dim, scope, onDoubleClick, referenceFixtures,
}: {
  sim: Sim;
  selected: string | null;
  onSelect: (id: string | null) => void;
  dim: boolean;
  scope: Set<string>;
  onDoubleClick?: (id: string) => void;
  referenceFixtures?: PipelineReferenceFixtures;
}) {
  const neighbors = useMemo(() => directGraphNeighbors(selected), [selected]);
  const up = neighbors.up;
  const down = neighbors.down;
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
    <div className="grid h-full min-h-0 gap-2 grid-rows-[minmax(420px,1fr)_minmax(180px,35%)] lg:grid-cols-[minmax(0,1fr)_minmax(280px,34%)] lg:grid-rows-1">
      <div
        ref={wrapRef}
        role="region"
        tabIndex={0}
        aria-label="Execution graph; scroll horizontally to inspect all ordered stages"
        className="pipeline-graph-canvas focus-ring relative min-h-[420px] overflow-auto overscroll-contain"
      >
        <div className="relative overflow-hidden" style={{ width: scaledW, height: scaledH }}>
          <div className="absolute left-0 top-0 origin-top-left" style={{ width: GW, height: GH, transform: `scale(${scale})` }}>
            <GraphEdges selected={selected} scope={scope} up={up} down={down} />
            {PIPELINE_STAGES.map((stage, stageIndex) => (
              <div key={stage.id} className="absolute text-center" style={{ left: STAGE_X + stageIndex * STAGE_GAP - NW / 2, top: 4, width: NW }}>
                <div className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted">Stage {stageIndex + 1}</div>
                <div className="text-caos-xs font-semibold text-caos-text">{stage.label}</div>
                <div className="tabular text-caos-2xs text-caos-muted">{stage.moduleIds.length} modules</div>
              </div>
            ))}
            {MODULES.map((module) => <GraphModuleNode key={module.id} dim={dim} down={down} fixtures={referenceFixtures} module={module} onDoubleClick={onDoubleClick} onSelect={onSelect} scope={scope} selected={selected} sim={sim} up={up} />)}
          </div>
        </div>
      </div>
      <PipelineStageTable selected={selected} scope={scope} sim={sim} />
    </div>
  );
}

/* ---------- swimlane view ---------- */
export function SwimlaneView({
  sim, selected, onSelect, scope, onDoubleClick, referenceFixtures,
}: {
  sim: Sim;
  selected: string | null;
  onSelect: (id: string | null) => void;
  scope: Set<string>;
  onDoubleClick?: (id: string) => void;
  referenceFixtures?: PipelineReferenceFixtures;
}) {
  return (
    <div className="h-full overflow-x-auto">
      <div className="grid h-full gap-1.5 p-2 min-w-[1120px]" style={{ gridTemplateColumns: `repeat(${PIPELINE_STAGES.length}, 1fr)` }}>
        {PIPELINE_STAGES.map((stage) => <SwimlaneColumn key={stage.id} fixtures={referenceFixtures} stage={stage} onDoubleClick={onDoubleClick} onSelect={onSelect} scope={scope} selected={selected} sim={sim} />)}
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
  referenceFixtures?: PipelineReferenceFixtures;
}

function selectedById<T extends { id: string }>(selected: string | null, values: readonly T[]): T | undefined {
  return selected ? values.find((value) => value.id === selected) : undefined;
}

function seededInspectorFixture<T>(available: boolean, selected: string | null, fixtures: Record<string, T>): T | null {
  if (!available || !selected) return null;
  return fixtures[selected] ?? null;
}

function inspectorModel({ sim, selected, plan, scope, isLive = false, referenceFixtures }: InspectorProps) {
  const m = selectedById(selected, MODULES);
  const planEntry = selectedById(selected, plan);
  const inScope = Boolean(selected && scope.has(selected));
  const st = selected ? (sim.mods[selected]?.state || "idle") : "idle";
  const deps = planEntry?.deps ?? [];
  const consumers = selected ? EDGES.filter(([source]) => source === selected).map(([, target]) => target) : [];
  // Seeded ATLF fixtures (keyed by module id) — only valid for the offline demo.
  // Suppress under a live run so they don't read as this run's QA / limitations.
  const degraded = ["warning", "held", "blocked"].includes(st);
  const fixtureAvailable = inScope && !isLive && Boolean(referenceFixtures);
  const qa = seededInspectorFixture(fixtureAvailable, selected, referenceFixtures?.nodeQa ?? {});
  const lim = seededInspectorFixture(fixtureAvailable, selected, referenceFixtures?.nodeLimits ?? {});
  const reqs = seededInspectorFixture(fixtureAvailable && degraded, selected, referenceFixtures?.nodeReqs ?? {});
  return { consumers, deps, inScope, lim, m, planEntry, qa, reqs, selected, st };
}

type InspectorModel = ReturnType<typeof inspectorModel>;

function EmptyInspector({ modeLabel, plan }: Pick<InspectorProps, "modeLabel" | "plan">) {
  return (
    <div className="p-4 text-caos-xl text-caos-muted leading-relaxed max-w-[50ch]">
      <h2 className="text-caos-text font-medium mb-2 text-balance">Module Inspector</h2>
      Select a module in the dependency map or stage lanes to trace source inputs, affected modules, run details, and QA findings or limitations.
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
        <Tag sev={model.st}>{model.st === "idle" ? "planned" : model.st}</Tag>
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
  onPick, drivers, onOpenEvidence, catalog,
}: {
  onPick: (d: Driver) => void;
  drivers: number[] | null;
  onOpenEvidence: (id: string) => void;
  catalog: readonly Driver[];
}) {
  const list = useMemo(() => {
    return drivers ? catalog.filter((d) => drivers.includes(d.n)) : catalog;
  }, [catalog, drivers]);
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
