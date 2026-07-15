"use client";

import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import { select } from "d3-selection";
import { zoom as d3zoom, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import "d3-transition";

export function useGraphZoom(
  svgRef: RefObject<SVGSVGElement | null>,
  fitTransform: ZoomTransform,
  resetKey: unknown,
  setTransform: Dispatch<SetStateAction<ZoomTransform>>,
) {
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    const zoom = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => setTransform(event.transform));

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);
    svg.call(zoom.transform, fitTransform);
  }, [fitTransform, resetKey, setTransform, svgRef]);

  return () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const reduce = typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    select(svgRef.current)
      .transition()
      .duration(reduce ? 0 : 180)
      .call(zoomBehaviorRef.current.transform, fitTransform);
  };
}
