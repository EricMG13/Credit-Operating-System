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

// G2 specs are loosely-typed option trees; keep them as plain objects.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type G2Spec = Record<string, any>;

// Period labels can arrive lowercase from run payloads ("fy2024" → "FY2024").
// Only string VALUES inside `data` subtrees are rewritten; object keys and the
// rest of the spec (encode field names like x:"fy", scale keys, formatters)
// must stay verbatim — uppercasing encode.x once detached it from the data key
// and collapsed every period onto a single "FY" category.
function normalizeFyValues(v: unknown): unknown {
  if (typeof v === "string") return v.replace(/\bfy/g, "FY");
  if (Array.isArray(v)) return v.map(normalizeFyValues);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, normalizeFyValues(val)]));
  }
  return v;
}

// Exported for unit tests.
export function normalizeFy(spec: G2Spec): G2Spec {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v).map(([k, val]) => [k, k === "data" ? normalizeFyValues(val) : walk(val)]),
      );
    }
    return v;
  };
  return walk(spec) as G2Spec;
}

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
    // A failed render used to be swallowed silently, leaving a blank (or
    // subtly wrong) frame nobody notices. Show a terse dead-frame instead so
    // a broken spec is visible in QA. Failure is deterministic per spec, so
    // no retry — a spec/mode change re-runs the effect anyway.
    const fail = () => {
      if (dead) return;
      try { chart?.destroy(); } catch { /* already gone */ }
      chart = null;
      el.innerHTML = "";
      const f = document.createElement("div");
      f.textContent = "CHART UNAVAILABLE";
      f.style.cssText =
        "display:flex;align-items:center;justify-content:center;height:100%;" +
        "font-size:10px;letter-spacing:.08em;color:#8a8a9a;border:1px dashed #8a8a9a55;border-radius:4px;";
      el.appendChild(f);
    };

    const build = () => {
      if (dead || !ChartCtor) return;
      try { chart?.destroy(); } catch { /* already gone */ }
      el.innerHTML = "";
      builtWidth = el.clientWidth || 320;
      try {
        chart = new ChartCtor({ container: el, width: builtWidth, height });
        const normalized = normalizeFy(spec);
        // globals.css @media only reaches CSS transitions — G2 canvas
        // animation needs an explicit opt-out.
        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        chart.options({
          theme: CAOS_G2_THEMES[mode] || CAOS_G2_THEMES.dark,
          ...normalized,
          ...(reduceMotion ? { animate: false } : {}),
          tooltip: {
            ...normalized.tooltip,
            css: {
              ".g2-tooltip": {
                color: mode === "paper" ? "#16161e" : "#e6e6ef",
                fontWeight: 700,
                textTransform: "uppercase",
              },
              ...(normalized.tooltip?.css || {}),
            },
          },
        });
        const p = chart.render();
        if (p && typeof p.catch === "function") p.catch(fail);
      } catch {
        fail();
      }
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
