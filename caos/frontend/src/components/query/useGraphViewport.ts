import { useMemo, useRef, useState } from "react";
import { zoomIdentity, type ZoomTransform } from "d3-zoom";
import type { GraphNode, GraphResult } from "@/lib/query/graph";
import { useGraphZoom } from "./useGraphZoom";

export const GRAPH_WIDTH = 1000;
export const GRAPH_HEIGHT = 600;
export const GRAPH_PADDING = 78;

export const graphX = (value: number) => GRAPH_PADDING + value * (GRAPH_WIDTH - 2 * GRAPH_PADDING);
export const graphY = (value: number) => GRAPH_PADDING + value * (GRAPH_HEIGHT - 2 * GRAPH_PADDING);

export function useGraphViewport(graph: GraphResult) {
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fitTransform = useMemo(() => {
    if (graph.nodes.length === 0) return zoomIdentity;
    const xs = graph.nodes.map((node) => graphX(node.x));
    const ys = graph.nodes.map((node) => graphY(node.y));
    const margin = 110;
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    const scale = Math.max(0.3, Math.min(1.5, (GRAPH_WIDTH - 2 * margin) / Math.max(width, 1), (GRAPH_HEIGHT - 2 * margin) / Math.max(height, 1)));
    const centerX = (Math.max(...xs) + Math.min(...xs)) / 2;
    const centerY = (Math.max(...ys) + Math.min(...ys)) / 2;
    return zoomIdentity.translate(GRAPH_WIDTH / 2 - scale * centerX, GRAPH_HEIGHT / 2 - scale * centerY).scale(scale);
  }, [graph.nodes]);
  const handleResetZoom = useGraphZoom(svgRef, fitTransform, graph, setTransform);
  const byId = useMemo<Record<string, GraphNode>>(() => Object.fromEntries(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  return { byId, handleResetZoom, svgRef, transform };
}
