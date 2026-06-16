"use client";

// G2 v5 chart wrapper (port of design bundle shared/charts.jsx, deployed from
// the antv-g2-chart skill): spec-mode only, single chart.options() call,
// classicDark theme on app surfaces / classic on paper reports, transparent
// viewFill. Sizes from clientWidth and rebuilds on container resize.

import { useEffect, useRef } from "react";
// Type-only — the runtime g2 module is dynamically imported inside the effect so
// it is code-split out of the first-load bundle (g2 v5 dominated /deepdive +
// /reports). A type-only import is erased at compile time and adds no bundle cost.
import type { Chart } from "@antv/g2";

const CAOS_G2_THEMES = {
  dark: { type: "classicDark", view: { viewFill: "transparent" } },
  paper: { type: "classic", view: { viewFill: "transparent" } },
} as const;

// Tranche palettes live in lib/chart-colors (the single source for canvas hex);
// re-exported here for the historical import path.
export { TRANCHE_HEX, TRANCHE_HEX_PAPER } from "@/lib/chart-colors";

// G2 specs are loosely-typed option trees; keep them as plain objects.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type G2Spec = Record<string, any>;

export function G2Chart({
  spec,
  height = 220,
  mode = "dark",
  className = "",
  style,
}: {
  spec: G2Spec;
  height?: number;
  mode?: "dark" | "paper";
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let chart: Chart | null = null;
    let ChartCtor: typeof import("@antv/g2").Chart | null = null;
    let dead = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let builtWidth = -1;

    // Size from clientWidth (layout px). Wait on timers (not rAF — rAF never
    // fires in hidden/backgrounded frames) for the width to hold still before
    // the first build, then rebuild on real container resizes.
    const build = () => {
      if (dead || !ChartCtor) return;
      try { chart?.destroy(); } catch { /* already gone */ }
      el.innerHTML = "";
      builtWidth = el.clientWidth || 320;
      chart = new ChartCtor({ container: el, width: builtWidth, height });
      chart.options({ theme: CAOS_G2_THEMES[mode] || CAOS_G2_THEMES.dark, ...spec });
      const p = chart.render();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };

    let last = -1, stable = 0, tries = 0;
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (dead || !chart) return;
        const cw = el.clientWidth || 320;
        if (Math.abs(cw - builtWidth) > 1) build();
      }, 120);
    });
    const settle = () => {
      if (dead) return;
      const cw = el.clientWidth;
      if (cw > 0 && cw === last) stable++;
      else { stable = 0; last = cw; }
      tries++;
      if (stable >= 2 || tries > 24) { build(); ro.observe(el); }
      else settleTimer = setTimeout(settle, 32);
    };
    // Defer loading g2 until a chart actually mounts; then start sizing.
    import("@antv/g2").then((m) => {
      if (dead) return;
      ChartCtor = m.Chart;
      settleTimer = setTimeout(settle, 0);
    });

    return () => {
      dead = true;
      clearTimeout(settleTimer);
      clearTimeout(timer);
      ro.disconnect();
      try { chart?.destroy(); } catch { /* already gone */ }
    };
  }, [spec, height, mode]);

  return <div ref={ref} className={className} style={{ height, minWidth: 0, overflow: "hidden", ...style }} />;
}
