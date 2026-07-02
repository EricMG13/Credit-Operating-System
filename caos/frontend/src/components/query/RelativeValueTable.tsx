"use client";

// The tabular view of a query graph, with columns adapted to what the graph
// actually carries — never a raw node dump. A centred graph (peer set,
// contagion) gets Rank/Similarity relative to the focus; weight/confidence
// columns appear only when some node has them; in/out degree only where edge
// counts mean something to an analyst (the provenance DAG).

import { useMemo, useState } from "react";
import type { GraphResult, GraphNode } from "@/lib/query/graph";
import { hueFor } from "./node-style";

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

export function RelativeValueTable({
  graph,
  selectedNodeId,
  onSelectNode,
}: RelativeValueTableProps) {
  const [filterText, setFilterText] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("label");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const degrees = useMemo(() => {
    const counts: Record<string, { in: number; out: number }> = {};
    graph.nodes.forEach((n) => {
      counts[n.id] = { in: 0, out: 0 };
    });
    graph.edges.forEach((e) => {
      if (counts[e.source]) counts[e.source].out++;
      if (counts[e.target]) counts[e.target].in++;
    });
    return counts;
  }, [graph]);

  // Relation to the focus node, when the graph has one (peer set, contagion).
  const center = useMemo(() => graph.nodes.find((n) => n.kind === "center" || n.center), [graph]);
  const relById = useMemo(() => {
    const m: Record<string, Rel> = {};
    if (!center) return m;
    for (const e of graph.edges) {
      const other = e.source === center.id ? e.target : e.target === center.id ? e.source : null;
      if (!other) continue;
      const rank = e.label && /^#\d+$/.test(e.label) ? Number(e.label.slice(1)) : null;
      m[other] = { rank, label: e.label ?? null, weight: typeof e.weight === "number" ? e.weight : null };
    }
    return m;
  }, [graph, center]);

  // Column presence, driven by the payload.
  const cols = useMemo(() => {
    const ns = graph.nodes;
    const rels = Object.values(relById);
    return {
      kind: new Set(ns.map((n) => n.kind)).size > 1,
      group: ns.some((n) => n.group),
      detail: ns.some((n) => n.sub && n.sub !== n.group),
      rank: rels.some((r) => r.rank !== null || r.label !== null),
      relWeight: rels.some((r) => r.weight !== null),
      weight: ns.some((n) => typeof n.weight === "number"),
      confidence: ns.some((n) => n.confidence),
      degree: graph.mode === "provenance",
    };
  }, [graph, relById]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(field === "label" || field === "rank" ? "asc" : "desc");
    }
  };

  const processedNodes = useMemo(() => {
    const query = filterText.toLowerCase().trim();
    let result = [...graph.nodes];

    if (query) {
      result = result.filter(
        (n) =>
          n.label.toLowerCase().includes(query) ||
          n.id.toLowerCase().includes(query) ||
          (n.kind || "").toLowerCase().includes(query) ||
          (n.group || "").toLowerCase().includes(query) ||
          (n.sub || "").toLowerCase().includes(query)
      );
    }

    const val = (n: GraphNode): string | number => {
      switch (sortBy) {
        case "label": return n.label;
        case "kind": return n.kind || "";
        case "group": return n.group || "";
        case "detail": return n.sub || "";
        case "rank": {
          // Centre first, then ranked, then unranked.
          if (center && n.id === center.id) return -1;
          const r = relById[n.id]?.rank;
          return r === null || r === undefined ? Number.MAX_SAFE_INTEGER : r;
        }
        case "weight": return relById[n.id]?.weight ?? n.weight ?? 0;
        case "confidence": return n.confidence || "";
        case "inDegree": return degrees[n.id]?.in ?? 0;
        case "outDegree": return degrees[n.id]?.out ?? 0;
      }
    };

    result.sort((a, b) => {
      const valA = val(a);
      const valB = val(b);
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [graph.nodes, filterText, sortBy, sortDir, degrees, relById, center]);

  const renderSortIndicator = (field: SortField) => {
    if (sortBy !== field) return <span className="opacity-25 font-normal ml-1">▲</span>;
    return sortDir === "asc" ? (
      <span className="text-caos-accent ml-1">▲</span>
    ) : (
      <span className="text-caos-accent ml-1">▼</span>
    );
  };

  const Th = ({ field, className, children }: { field: SortField; className?: string; children: React.ReactNode }) => (
    <th
      tabIndex={0}
      role="button"
      onClick={() => handleSort(field)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort(field); } }}
      className={`p-2.5 cursor-pointer hover:text-caos-text hover:bg-caos-elevated/40 transition-colors focus-ring ${className ?? ""}`}
    >
      {children} {renderSortIndicator(field)}
    </th>
  );

  const colCount = 1 + Number(cols.kind) + Number(cols.group) + Number(cols.detail) + Number(cols.rank)
    + Number(cols.relWeight) + Number(cols.weight) + Number(cols.confidence) + 2 * Number(cols.degree);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-caos-bg text-caos-text font-sans">
      <div className="flex items-center justify-between p-2.5 border-b border-caos-border bg-caos-panel/40 shrink-0 gap-3">
        <div className="flex items-center gap-2">
          <span className="tabular text-caos-2xs text-caos-muted font-mono uppercase tracking-wider">
            Nodes: {processedNodes.length} / {graph.nodes.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-caos-panel border border-caos-border rounded px-2 py-0.5 focus-within:border-caos-accent/70 transition-caos">
          <span className="text-caos-muted text-caos-xs" aria-hidden>⌕</span>
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter by label, kind, group..."
            aria-label="Filter nodes"
            className="bg-transparent outline-none border-none tabular text-caos-xs text-caos-text placeholder:text-caos-muted w-48 font-mono"
          />
          {filterText && (
            <button
              onClick={() => setFilterText("")}
              className="text-caos-muted hover:text-caos-text text-caos-xs font-mono px-1"
              aria-label="Clear filter"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full border-collapse text-left text-caos-sm tabular">
          <thead className="sticky top-0 bg-caos-panel border-b border-caos-border z-10">
            <tr className="text-caos-3xs uppercase tracking-wider text-caos-muted font-mono select-none">
              <Th field="label" className="pl-4">Node / Label</Th>
              {cols.kind && <Th field="kind" className="w-28">Kind</Th>}
              {cols.group && <Th field="group" className="w-32">Group</Th>}
              {cols.detail && <Th field="detail" className="w-40">Detail</Th>}
              {cols.rank && <Th field="rank" className="text-center w-20">Rank</Th>}
              {cols.relWeight && <Th field="weight" className="text-right w-28">Similarity</Th>}
              {cols.weight && !cols.relWeight && <Th field="weight" className="text-right w-24">Weight</Th>}
              {cols.confidence && <Th field="confidence" className="text-center w-24">Conf.</Th>}
              {cols.degree && <Th field="inDegree" className="text-center w-16">In</Th>}
              {cols.degree && <Th field="outDegree" className="text-center w-16">Out</Th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-caos-border/40 font-mono text-caos-xs">
            {processedNodes.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="p-8 text-center text-caos-muted">
                  No matching nodes found
                </td>
              </tr>
            ) : (
              processedNodes.map((n) => {
                const isActive = selectedNodeId === n.id;
                const nodeColor = hueFor(n.group);
                const rel = relById[n.id];
                const isCenter = center?.id === n.id;
                const w = rel?.weight ?? n.weight;

                return (
                  <tr
                    key={n.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => onSelectNode?.(n)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectNode?.(n);
                      }
                    }}
                    className={`cursor-pointer transition-colors hover:bg-caos-elevated/50 focus-ring ${
                      isActive ? "bg-caos-elevated border-l-2 border-l-caos-accent" : ""
                    }`}
                  >
                    <td className="p-2.5 pl-4 font-sans font-medium text-caos-text">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-current"
                          style={{
                            color: nodeColor === "var(--caos-muted)" ? "var(--caos-border)" : nodeColor,
                            backgroundColor: nodeColor === "var(--caos-muted)" ? "transparent" : `${nodeColor}33`,
                          }}
                        />
                        <span className="truncate max-w-sm" title={n.label}>{n.label}</span>
                        {isCenter && (
                          <span className="tabular text-caos-3xs uppercase tracking-wide text-caos-accent border border-caos-accent/40 rounded px-1 py-px shrink-0">
                            focus
                          </span>
                        )}
                      </span>
                    </td>

                    {cols.kind && (
                      <td className="p-2.5 text-caos-muted text-caos-2xs uppercase tracking-wide">
                        {n.kind.replace("-", " ")}
                      </td>
                    )}

                    {cols.group && (
                      <td className="p-2.5 text-caos-muted truncate" title={n.group || undefined}>
                        {n.group || "—"}
                      </td>
                    )}

                    {cols.detail && (
                      <td className="p-2.5 text-caos-muted truncate" title={n.sub || undefined}>
                        {n.sub && n.sub !== n.group ? n.sub : "—"}
                      </td>
                    )}

                    {cols.rank && (
                      <td className="p-2.5 text-center text-caos-text">
                        {isCenter ? "—" : rel?.label ?? "—"}
                      </td>
                    )}

                    {(cols.relWeight || cols.weight) && (
                      <td className="p-2.5 text-right font-mono text-caos-text">
                        {typeof w === "number" ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-caos-2xs">{(w * 100).toFixed(0)}%</span>
                            <span className="inline-block w-8 h-1.5 bg-caos-border/50 rounded-sm overflow-hidden">
                              <span
                                className="block h-full bg-caos-accent"
                                style={{ width: `${Math.min(100, w * 100)}%` }}
                              />
                            </span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}

                    {cols.confidence && (
                      <td className="p-2.5 text-center">
                        {n.confidence ? (
                          <span
                            className="inline-block text-caos-3xs font-semibold px-1.5 py-0.5 rounded border leading-none"
                            style={{
                              color: n.confidence === "High" ? "var(--caos-success)" : "var(--caos-warning)",
                              borderColor:
                                (n.confidence === "High" ? "var(--caos-success)" : "var(--caos-warning)") + "55",
                              backgroundColor:
                                (n.confidence === "High" ? "var(--caos-success)" : "var(--caos-warning)") + "11",
                            }}
                          >
                            {n.confidence}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}

                    {cols.degree && <td className="p-2.5 text-center text-caos-muted">{degrees[n.id]?.in ?? 0}</td>}
                    {cols.degree && <td className="p-2.5 text-center text-caos-muted">{degrees[n.id]?.out ?? 0}</td>}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
