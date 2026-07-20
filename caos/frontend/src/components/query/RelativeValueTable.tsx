"use client";

// The tabular view of a query graph, with columns adapted to what the graph
// actually carries — never a raw node dump. A centred graph (peer set,
// contagion) gets Rank/Similarity relative to the focus; weight/confidence
// columns appear only when some node has them; in/out degree only where edge
// counts mean something to an analyst (the provenance DAG).

import { useMemo, useState } from "react";
import type { GraphResult, GraphNode } from "@/lib/query/graph";
import { hueFor } from "./node-style";
import { sevSurface } from "@/lib/pipeline/sev";

interface RelativeValueTableProps {
  graph: GraphResult;
  selectedNodeId?: string | null;
  onSelectNode?: (node: GraphNode) => void;
}

type SortField = "label" | "kind" | "group" | "detail" | "rank" | "weight" | "confidence" | "inDegree" | "outDegree";
type SortDir = "asc" | "desc";

interface Rel {
  rank: number | null; // parsed from the centre edge label "#1"
  label: string | null;
  weight: number | null; // centre edge weight (similarity)
}

type Degrees = Record<string, { in: number; out: number }>;
type Relations = Record<string, Rel>;
interface TableColumns {
  kind: boolean;
  group: boolean;
  detail: boolean;
  rank: boolean;
  relWeight: boolean;
  weight: boolean;
  confidence: boolean;
  degree: boolean;
}

function countDegrees(graph: GraphResult): Degrees {
  const counts: Degrees = Object.fromEntries(graph.nodes.map((node) => [node.id, { in: 0, out: 0 }]));
  graph.edges.forEach((edge) => {
    if (counts[edge.source]) counts[edge.source].out += 1;
    if (counts[edge.target]) counts[edge.target].in += 1;
  });
  return counts;
}

function buildRelations(graph: GraphResult, center: GraphNode | undefined): Relations {
  const relations: Relations = {};
  if (!center) return relations;
  graph.edges.forEach((edge) => {
    const other = edge.source === center.id ? edge.target : edge.target === center.id ? edge.source : null;
    if (!other) return;
    const rank = edge.label && /^#\d+$/.test(edge.label) ? Number(edge.label.slice(1)) : null;
    relations[other] = { rank, label: edge.label ?? null, weight: typeof edge.weight === "number" ? edge.weight : null };
  });
  return relations;
}

function deriveColumns(graph: GraphResult, relations: Relations): TableColumns {
  const nodes = graph.nodes;
  const rels = Object.values(relations);
  return {
    kind: new Set(nodes.map((node) => node.kind)).size > 1,
    group: nodes.some((node) => node.group),
    detail: nodes.some((node) => node.sub && node.sub !== node.group),
    rank: rels.some((rel) => rel.rank !== null || rel.label !== null),
    relWeight: rels.some((rel) => rel.weight !== null),
    weight: nodes.some((node) => typeof node.weight === "number"),
    confidence: nodes.some((node) => node.confidence),
    degree: graph.mode === "provenance",
  };
}

function nodeMatches(node: GraphNode, query: string) {
  return node.label.toLowerCase().includes(query)
    || node.id.toLowerCase().includes(query)
    || (node.kind || "").toLowerCase().includes(query)
    || (node.group || "").toLowerCase().includes(query)
    || (node.sub || "").toLowerCase().includes(query);
}

function rankSortValue(node: GraphNode, centerId: string | undefined, relations: Relations) {
  if (node.id === centerId) return -1;
  return relations[node.id]?.rank ?? Number.MAX_SAFE_INTEGER;
}

function weightSortValue(node: GraphNode, relations: Relations) {
  return relations[node.id]?.weight ?? node.weight ?? 0;
}

function degreeSortValue(node: GraphNode, field: "inDegree" | "outDegree", degrees: Degrees) {
  const degree = degrees[node.id];
  if (!degree) return 0;
  return field === "inDegree" ? degree.in : degree.out;
}

function sortValue(node: GraphNode, field: SortField, centerId: string | undefined, relations: Relations, degrees: Degrees): string | number {
  const textValues: Partial<Record<SortField, string>> = {
    label: node.label, kind: node.kind || "", group: node.group || "", detail: node.sub || "",
    confidence: node.confidence || "",
  };
  const textValue = textValues[field];
  if (textValue !== undefined) return textValue;
  if (field === "rank") {
    return rankSortValue(node, centerId, relations);
  }
  if (field === "weight") return weightSortValue(node, relations);
  if (field === "inDegree" || field === "outDegree") return degreeSortValue(node, field, degrees);
  return "";
}

function processNodes(nodes: GraphNode[], filterText: string, field: SortField, direction: SortDir, centerId: string | undefined, relations: Relations, degrees: Degrees) {
  const query = filterText.toLowerCase().trim();
  const result = query ? nodes.filter((node) => nodeMatches(node, query)) : [...nodes];
  return result.sort((left, right) => {
    const a = sortValue(left, field, centerId, relations, degrees);
    const b = sortValue(right, field, centerId, relations, degrees);
    if (a === b) return 0;
    const order = a < b ? -1 : 1;
    return direction === "asc" ? order : -order;
  });
}

function SortIndicator({ active, direction }: { active: boolean; direction: SortDir }) {
  if (!active) return <span className="opacity-25 font-normal ml-1">▲</span>;
  return <span className="text-caos-accent ml-1">{direction === "asc" ? "▲" : "▼"}</span>;
}

function SortHeader({ field, className, children, sortBy, sortDir, onSort }: { field: SortField; className?: string; children: React.ReactNode; sortBy: SortField; sortDir: SortDir; onSort: (field: SortField) => void }) {
  return (
    <th tabIndex={0} role="button" onClick={() => onSort(field)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSort(field); } }} className={`p-2.5 cursor-pointer hover:text-caos-text hover:bg-caos-elevated/40 transition-colors focus-ring ${className ?? ""}`}>
      {children} <SortIndicator active={sortBy === field} direction={sortDir} />
    </th>
  );
}

function RelativeValueToolbar({ filteredCount, totalCount, filterText, setFilterText }: { filteredCount: number; totalCount: number; filterText: string; setFilterText: (value: string) => void }) {
  return (
    <div className="flex items-center justify-between p-2.5 border-b border-caos-border bg-caos-panel/40 shrink-0 gap-3">
      <span className="tabular text-caos-2xs text-caos-muted font-mono uppercase tracking-wider">Nodes: {filteredCount} / {totalCount}</span>
      <div className="flex items-center gap-1.5 bg-caos-panel border border-caos-border rounded px-2 py-0.5 focus-within:border-caos-accent/70 transition-caos">
        <span className="text-caos-muted text-caos-xs" aria-hidden>⌕</span>
        <input name="relative-value-node-filter" autoComplete="off" value={filterText} onChange={(event) => setFilterText(event.target.value)} placeholder="Filter by label, kind, group…" aria-label="Filter nodes" className="bg-transparent outline-none border-none tabular text-caos-xs text-caos-text placeholder:text-caos-muted w-48 font-mono" />
        {filterText ? <button onClick={() => setFilterText("")} className="text-caos-muted hover:text-caos-text text-caos-xs font-mono px-1" aria-label="Clear filter">&times;</button> : null}
      </div>
    </div>
  );
}

function NodeIdentityCell({ node, isCenter, onSelect, selected }: { node: GraphNode; isCenter: boolean; onSelect: () => void; selected: boolean }) {
  const nodeColor = hueFor(node.group);
  const muted = nodeColor === "var(--caos-muted)";
  return (
    <td className="p-2.5 pl-4 font-sans font-medium text-caos-text">
      <button type="button" onClick={onSelect} className={`flex w-full items-center gap-2 rounded-sm text-left focus-ring ${selected ? "caos-selected" : ""}`}>
        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-current" style={{ color: muted ? "var(--caos-border)" : nodeColor, backgroundColor: muted ? "transparent" : `${nodeColor}33` }} />
        <span className="truncate max-w-sm" title={node.label}>{node.label}</span>
        {isCenter ? <span className="tabular text-caos-3xs uppercase tracking-wide text-caos-accent border border-caos-accent/40 rounded px-1 py-px shrink-0">focus</span> : null}
      </button>
    </td>
  );
}

function WeightCell({ weight }: { weight: number | undefined }) {
  return (
    <td className="p-2.5 text-right font-mono text-caos-text">
      {typeof weight === "number" ? <span className="inline-flex items-center gap-1.5"><span className="text-caos-2xs">{(weight * 100).toFixed(0)}%</span><span className="inline-block w-8 h-1.5 bg-caos-border/50 rounded-sm overflow-hidden"><span className="block h-full bg-caos-accent" style={{ width: `${Math.min(100, weight * 100)}%` }} /></span></span> : "—"}
    </td>
  );
}

function ConfidenceCell({ confidence }: { confidence: GraphNode["confidence"] }) {
  return (
    <td className="p-2.5 text-center">
      {confidence ? <span className="inline-block text-caos-3xs font-semibold px-1.5 py-0.5 rounded border leading-none" style={sevSurface(confidence === "High" ? "ok" : "warning", { border: 33, wash: 7 })}>{confidence}</span> : "—"}
    </td>
  );
}

function NodeMetadataCells({ node, columns }: { node: GraphNode; columns: TableColumns }) {
  return (
    <>
      {columns.kind ? <td className="p-2.5 text-caos-muted text-caos-2xs uppercase tracking-wide">{node.kind.replace("-", " ")}</td> : null}
      {columns.group ? <td className="p-2.5 text-caos-muted truncate" title={node.group || undefined}>{node.group || "—"}</td> : null}
      {columns.detail ? <td className="p-2.5 text-caos-muted truncate" title={node.sub || undefined}>{node.sub && node.sub !== node.group ? node.sub : "—"}</td> : null}
    </>
  );
}

function NodeMetricCells({ node, columns, relation, isCenter, degrees }: { node: GraphNode; columns: TableColumns; relation: Rel | undefined; isCenter: boolean; degrees: Degrees }) {
  return (
    <>
      {columns.rank ? <td className="p-2.5 text-center text-caos-text">{isCenter ? "—" : relation?.label ?? "—"}</td> : null}
      {columns.relWeight || columns.weight ? <WeightCell weight={relation?.weight ?? node.weight} /> : null}
      {columns.confidence ? <ConfidenceCell confidence={node.confidence} /> : null}
      {columns.degree ? <td className="p-2.5 text-center text-caos-muted">{degrees[node.id]?.in ?? 0}</td> : null}
      {columns.degree ? <td className="p-2.5 text-center text-caos-muted">{degrees[node.id]?.out ?? 0}</td> : null}
    </>
  );
}

function RelativeValueRow({ node, columns, centerId, relations, degrees, selectedNodeId, onSelectNode }: { node: GraphNode; columns: TableColumns; centerId?: string; relations: Relations; degrees: Degrees; selectedNodeId?: string | null; onSelectNode?: (node: GraphNode) => void }) {
  const relation = relations[node.id];
  const isCenter = centerId === node.id;
  const select = () => onSelectNode?.(node);
  return (
    <tr className={`transition-colors hover:bg-caos-elevated/50 ${selectedNodeId === node.id ? "bg-caos-elevated" : ""}`}>
      <NodeIdentityCell node={node} isCenter={isCenter} onSelect={select} selected={selectedNodeId === node.id} />
      <NodeMetadataCells node={node} columns={columns} />
      <NodeMetricCells node={node} columns={columns} relation={relation} isCenter={isCenter} degrees={degrees} />
    </tr>
  );
}

function columnCount(columns: TableColumns) {
  return 1 + Number(columns.kind) + Number(columns.group) + Number(columns.detail) + Number(columns.rank)
    + Number(columns.relWeight) + Number(columns.weight) + Number(columns.confidence) + 2 * Number(columns.degree);
}

interface HeaderGroupProps {
  columns: TableColumns;
  sortBy: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}

function MetadataHeaders({ columns, ...sort }: HeaderGroupProps) {
  return (
    <>
      <SortHeader field="label" className="pl-4" {...sort}>Node / Label</SortHeader>
      {columns.kind ? <SortHeader field="kind" className="w-28" {...sort}>Kind</SortHeader> : null}
      {columns.group ? <SortHeader field="group" className="w-32" {...sort}>Group</SortHeader> : null}
      {columns.detail ? <SortHeader field="detail" className="w-40" {...sort}>Detail</SortHeader> : null}
    </>
  );
}

function MetricHeaders({ columns, ...sort }: HeaderGroupProps) {
  return (
    <>
      {columns.rank ? <SortHeader field="rank" className="text-center w-20" {...sort}>Rank</SortHeader> : null}
      {columns.relWeight ? <SortHeader field="weight" className="text-right w-28" {...sort}>Similarity</SortHeader> : null}
      {columns.weight && !columns.relWeight ? <SortHeader field="weight" className="text-right w-24" {...sort}>Weight</SortHeader> : null}
      {columns.confidence ? <SortHeader field="confidence" className="text-center w-24" {...sort}>Conf.</SortHeader> : null}
      {columns.degree ? <SortHeader field="inDegree" className="text-center w-16" {...sort}>In</SortHeader> : null}
      {columns.degree ? <SortHeader field="outDegree" className="text-center w-16" {...sort}>Out</SortHeader> : null}
    </>
  );
}

function RelativeValueGrid({ nodes, columns, centerId, relations, degrees, selectedNodeId, onSelectNode, sortBy, sortDir, onSort }: { nodes: GraphNode[]; columns: TableColumns; centerId?: string; relations: Relations; degrees: Degrees; selectedNodeId?: string | null; onSelectNode?: (node: GraphNode) => void; sortBy: SortField; sortDir: SortDir; onSort: (field: SortField) => void }) {
  const headerProps = { columns, sortBy, sortDir, onSort };
  return (
    <div className="flex-1 overflow-auto min-h-0">
      <table className="rv-table w-full border-collapse text-left text-caos-sm tabular">
        <thead className="sticky top-0 bg-caos-panel border-b border-caos-border z-10">
          <tr className="text-caos-3xs uppercase tracking-wider text-caos-muted font-mono select-none">
            <MetadataHeaders {...headerProps} />
            <MetricHeaders {...headerProps} />
          </tr>
        </thead>
        <tbody className="divide-y divide-caos-border/40 font-mono text-caos-xs">
          {nodes.length ? nodes.map((node) => <RelativeValueRow key={node.id} node={node} columns={columns} centerId={centerId} relations={relations} degrees={degrees} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} />) : <tr><td colSpan={columnCount(columns)} className="p-8 text-center text-caos-muted">No matching nodes found</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function RelativeValueTable({
  graph,
  selectedNodeId,
  onSelectNode,
}: RelativeValueTableProps) {
  const [filterText, setFilterText] = useState("");
  // A centred graph (peer set, contagion) exists to rank against the focus, so
  // open on Rank asc (#1, #2, #3…) rather than alphabetical label — the ranking
  // is the point. Non-centred graphs still open on label.
  const [sortBy, setSortBy] = useState<SortField>(() =>
    graph.nodes.some((n) => n.kind === "center" || n.center) ? "rank" : "label"
  );
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const degrees = useMemo(() => countDegrees(graph), [graph]);

  // Relation to the focus node, when the graph has one (peer set, contagion).
  const center = useMemo(() => graph.nodes.find((n) => n.kind === "center" || n.center), [graph]);
  const relById = useMemo(() => buildRelations(graph, center), [graph, center]);

  // Column presence, driven by the payload.
  const cols = useMemo(() => deriveColumns(graph, relById), [graph, relById]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(field === "label" || field === "rank" ? "asc" : "desc");
    }
  };

  const processedNodes = useMemo(
    () => processNodes(graph.nodes, filterText, sortBy, sortDir, center?.id, relById, degrees),
    [graph.nodes, filterText, sortBy, sortDir, center?.id, relById, degrees],
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-caos-bg text-caos-text font-sans">
      <RelativeValueToolbar filteredCount={processedNodes.length} totalCount={graph.nodes.length} filterText={filterText} setFilterText={setFilterText} />
      <RelativeValueGrid nodes={processedNodes} columns={cols} centerId={center?.id} relations={relById} degrees={degrees} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
    </div>
  );
}
