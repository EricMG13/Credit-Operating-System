import type { GraphResult } from "@/lib/query/graph";
import { synthesize } from "@/lib/query/synthesis";

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function graphToCsv(graph: GraphResult): string {
  const lines: string[] = [];
  lines.push(["CAOS Query", graph.title, graph.mode].map(csvCell).join(","));
  lines.push(["Synthesis", synthesize(graph)].map(csvCell).join(","));
  lines.push(["Meta", ...graph.meta].map(csvCell).join(","));
  lines.push("");
  lines.push(["Nodes"].map(csvCell).join(","));
  lines.push(["id", "label", "kind", "group", "sub"].map(csvCell).join(","));
  graph.nodes.forEach((n) => lines.push([n.id, n.label, n.kind, n.group, n.sub].map(csvCell).join(",")));
  lines.push("");
  lines.push(["Edges"].map(csvCell).join(","));
  lines.push(["source", "target", "label", "weight"].map(csvCell).join(","));
  graph.edges.forEach((e) => lines.push([e.source, e.target, e.label, e.weight].map(csvCell).join(",")));
  if (graph.caveats.length) {
    lines.push("");
    lines.push(["Caveats"].map(csvCell).join(","));
    graph.caveats.forEach((c) => lines.push([c].map(csvCell).join(",")));
  }
  return lines.join("\n");
}

export function downloadQueryCsv(graph: GraphResult): void {
  const blob = new Blob([graphToCsv(graph)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "CAOS Query - " + graph.title.replace(/[^\w.-]+/g, "_") + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}
