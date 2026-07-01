"use client";

import { useMemo, useState } from "react";
import type { GraphResult, GraphNode } from "@/lib/query/graph";
import { hueFor } from "./node-style";

interface RelativeValueTableProps {
  graph: GraphResult;
  selectedNodeId?: string | null;
  onSelectNode?: (node: GraphNode) => void;
}

type SortField = "label" | "kind" | "group" | "weight" | "confidence" | "inDegree" | "outDegree";
type SortDir = "asc" | "desc";

export function RelativeValueTable({
  graph,
  selectedNodeId,
  onSelectNode,
}: RelativeValueTableProps) {
  const [filterText, setFilterText] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("label");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Calculate degrees for all nodes from edges
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

  // Handle column sorting
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc"); // Default to desc (highest weight/degree first)
    }
  };

  // Filter and sort nodes
  const processedNodes = useMemo(() => {
    const query = filterText.toLowerCase().trim();
    let result = [...graph.nodes];

    // Filter
    if (query) {
      result = result.filter(
        (n) =>
          n.label.toLowerCase().includes(query) ||
          n.id.toLowerCase().includes(query) ||
          (n.kind || "").toLowerCase().includes(query) ||
          (n.group || "").toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";

      if (sortBy === "label") {
        valA = a.label;
        valB = b.label;
      } else if (sortBy === "kind") {
        valA = a.kind || "";
        valB = b.kind || "";
      } else if (sortBy === "group") {
        valA = a.group || "";
        valB = b.group || "";
      } else if (sortBy === "weight") {
        valA = a.weight ?? 0;
        valB = b.weight ?? 0;
      } else if (sortBy === "confidence") {
        valA = a.confidence || "";
        valB = b.confidence || "";
      } else if (sortBy === "inDegree") {
        valA = degrees[a.id]?.in ?? 0;
        valB = degrees[b.id]?.in ?? 0;
      } else if (sortBy === "outDegree") {
        valA = degrees[a.id]?.out ?? 0;
        valB = degrees[b.id]?.out ?? 0;
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [graph.nodes, filterText, sortBy, sortDir, degrees]);

  const renderSortIndicator = (field: SortField) => {
    if (sortBy !== field) return <span className="opacity-25 font-normal ml-1">▲</span>;
    return sortDir === "asc" ? (
      <span className="text-caos-accent ml-1">▲</span>
    ) : (
      <span className="text-caos-accent ml-1">▼</span>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-caos-bg text-caos-text font-sans">
      {/* Sub-header Filter and Metadata */}
      <div className="flex items-center justify-between p-2.5 border-b border-caos-border bg-caos-panel/40 shrink-0 gap-3">
        <div className="flex items-center gap-2">
          <span className="tabular text-caos-2xs text-caos-muted font-mono uppercase tracking-wider">
            Nodes: {processedNodes.length} / {graph.nodes.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-caos-panel border border-caos-border rounded px-2 py-0.5 focus-within:border-caos-accent/70 transition-caos">
          <span className="text-caos-muted text-caos-xs">🔍</span>
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter by label, kind, group..."
            className="bg-transparent outline-none border-none tabular text-caos-xs text-caos-text placeholder:text-caos-muted w-48 font-mono"
          />
          {filterText && (
            <button
              onClick={() => setFilterText("")}
              className="text-caos-muted hover:text-caos-text text-caos-xs font-mono px-1"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full border-collapse text-left text-caos-sm tabular">
          <thead className="sticky top-0 bg-caos-panel border-b border-caos-border z-10">
            <tr className="text-caos-3xs uppercase tracking-wider text-caos-muted font-mono select-none">
              <th
                tabIndex={0}
                role="button"
                onClick={() => handleSort("label")}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("label"); } }}
                className="p-2.5 cursor-pointer hover:text-caos-text hover:bg-caos-elevated/40 transition-colors pl-4 focus-ring"
              >
                Node / Label {renderSortIndicator("label")}
              </th>
              <th
                tabIndex={0}
                role="button"
                onClick={() => handleSort("kind")}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("kind"); } }}
                className="p-2.5 cursor-pointer hover:text-caos-text hover:bg-caos-elevated/40 transition-colors w-28 focus-ring"
              >
                Kind {renderSortIndicator("kind")}
              </th>
              <th
                tabIndex={0}
                role="button"
                onClick={() => handleSort("group")}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("group"); } }}
                className="p-2.5 cursor-pointer hover:text-caos-text hover:bg-caos-elevated/40 transition-colors w-32 focus-ring"
              >
                Group {renderSortIndicator("group")}
              </th>
              <th
                tabIndex={0}
                role="button"
                onClick={() => handleSort("weight")}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("weight"); } }}
                className="p-2.5 cursor-pointer hover:text-caos-text hover:bg-caos-elevated/40 transition-colors text-right w-24 focus-ring"
              >
                Weight {renderSortIndicator("weight")}
              </th>
              <th
                tabIndex={0}
                role="button"
                onClick={() => handleSort("confidence")}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("confidence"); } }}
                className="p-2.5 cursor-pointer hover:text-caos-text hover:bg-caos-elevated/40 transition-colors text-center w-24 focus-ring"
              >
                Conf. {renderSortIndicator("confidence")}
              </th>
              <th
                tabIndex={0}
                role="button"
                onClick={() => handleSort("inDegree")}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("inDegree"); } }}
                className="p-2.5 cursor-pointer hover:text-caos-text hover:bg-caos-elevated/40 transition-colors text-center w-20 focus-ring"
              >
                In {renderSortIndicator("inDegree")}
              </th>
              <th
                tabIndex={0}
                role="button"
                onClick={() => handleSort("outDegree")}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("outDegree"); } }}
                className="p-2.5 cursor-pointer hover:text-caos-text hover:bg-caos-elevated/40 transition-colors text-center w-20 focus-ring"
              >
                Out {renderSortIndicator("outDegree")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-caos-border/40 font-mono text-caos-xs">
            {processedNodes.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-caos-muted">
                  No matching nodes found
                </td>
              </tr>
            ) : (
              processedNodes.map((n) => {
                const isActive = selectedNodeId === n.id;
                const nodeColor = hueFor(n.group);

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
                    {/* Node / Label */}
                    <td className="p-2.5 pl-4 font-sans font-medium text-caos-text flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-current"
                        style={{
                          color: nodeColor === "var(--caos-muted)" ? "var(--caos-border)" : nodeColor,
                          backgroundColor: nodeColor === "var(--caos-muted)" ? "transparent" : `${nodeColor}33`,
                        }}
                      />
                      <span className="truncate max-w-sm" title={n.label}>
                        {n.label}
                      </span>
                    </td>

                    {/* Kind */}
                    <td className="p-2.5 text-caos-muted text-caos-2xs uppercase tracking-wide">
                      {n.kind.replace("-", " ")}
                    </td>

                    {/* Group */}
                    <td className="p-2.5 text-caos-muted truncate" title={n.group || "N/A"}>
                      {n.group || "—"}
                    </td>

                    {/* Weight */}
                    <td className="p-2.5 text-right font-mono text-caos-text">
                      {n.weight !== undefined && n.weight !== null ? (
                        <div className="inline-flex items-center gap-1.5">
                          <span className="text-caos-2xs">{(n.weight * 100).toFixed(0)}%</span>
                          <span className="inline-block w-8 h-1.5 bg-caos-border/50 rounded-sm overflow-hidden">
                            <span
                              className="block h-full bg-caos-accent"
                              style={{ width: `${Math.min(100, n.weight * 100)}%` }}
                            />
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Confidence */}
                    <td className="p-2.5 text-center">
                      {n.confidence ? (
                        <span
                          className="inline-block text-caos-3xs font-semibold px-1.5 py-0.5 rounded border leading-none"
                          style={{
                            color: n.confidence === "High" ? "var(--caos-success)" : "var(--caos-warning)",
                            borderColor:
                              (n.confidence === "High" ? "var(--caos-success)" : "var(--caos-warning)") +
                              "55",
                            backgroundColor:
                              (n.confidence === "High" ? "var(--caos-success)" : "var(--caos-warning)") +
                              "11",
                          }}
                        >
                          {n.confidence}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* In degree */}
                    <td className="p-2.5 text-center text-caos-muted">{degrees[n.id]?.in ?? 0}</td>

                    {/* Out degree */}
                    <td className="p-2.5 text-center text-caos-muted">{degrees[n.id]?.out ?? 0}</td>
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
