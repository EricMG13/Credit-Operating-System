module.exports = [
"[project]/src/lib/chart-colors.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Canvas chart palette — single source.
//
// @antv/g2 renders to <canvas>, where CSS custom properties (var(--…)) do NOT
// resolve, so chart series colors must be literal hex rather than design tokens.
// This module mirrors the DOM tokens (src/app/globals.css / tailwind.config.js)
// so the canvas palette stays in lockstep with the rest of the interface — when
// a token changes, change its twin here. Imported by every @antv/g2 spec
// (G2Chart, ModuleCharts, deepdive tabs) so the literals live in exactly one
// place.
// Seniority / tranche ramp on the dark app surfaces — mirrors --tranche-*.
__turbopack_context__.s([
    "CHART_HEX",
    ()=>CHART_HEX,
    "TRANCHE_HEX",
    ()=>TRANCHE_HEX,
    "TRANCHE_HEX_PAPER",
    ()=>TRANCHE_HEX_PAPER
]);
const TRANCHE_HEX = {
    "1l": "#2dd4bf",
    "2l": "#4f8cff",
    unsec: "#f5a524",
    sub: "#a855f7",
    eq: "#64748b"
};
const TRANCHE_HEX_PAPER = {
    "1l": "#0d9488",
    "2l": "#2563eb",
    unsec: "#b45309",
    sub: "#7c3aed",
    eq: "#94a3b8"
};
const CHART_HEX = {
    accent: "#63a1ff",
    teal: "#2dd4bf",
    tealDeep: "#14b8a6",
    success: "#22c55e",
    warning: "#f5a524",
    critical: "#ef4444",
    muted: "#a1a1b5",
    eq: "#64748b",
    slate: "#5b6b85",
    slateDeep: "#46506b"
};
}),
"[project]/src/components/query/node-style.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Pure node shape/color resolution for the Query graph surface, lifted out of
// NodeMark so the renderer stays a thin projector. nodeStyle(n) maps a node's
// kind/flags to its glyph shape and CSS colors; same node → same style. Colors
// and geometry are byte-identical to the former inline derivation.
__turbopack_context__.s([
    "MODEL_HUE",
    ()=>MODEL_HUE,
    "hueFor",
    ()=>hueFor,
    "nodeStyle",
    ()=>nodeStyle
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/chart-colors.ts [app-ssr] (ecmascript)");
;
const MODEL_HUE = "#a78bfa";
// Categorical hues for issuer grouping (industry/country). Distinct, no banding —
// pairs with the always-present text label, so meaning is never color-only.
// Deliberately excludes the semantic hues (warning/critical/success/MODEL_HUE):
// a hashed sector must never read as "exposed" (warning) or model/ratified
// provenance (purple). First two mirror tokens (via chart-colors); the rest are
// graph-only neutral/distinct hues.
const CATEGORICAL = [
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TRANCHE_HEX"]["1l"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CHART_HEX"].accent,
    "#94a3b8",
    "#f472b6",
    "#34d399",
    "#22d3ee",
    "#818cf8"
];
function hueFor(group) {
    if (!group) return "var(--caos-muted)";
    let h = 0;
    for(let i = 0; i < group.length; i++)h = h * 31 + group.charCodeAt(i) >>> 0;
    return CATEGORICAL[h % CATEGORICAL.length];
}
// kind → fill/stroke for non-issuer nodes. Issuer/sector nodes color by group.
// Node strokes mirror semantic tokens (via chart-colors); fills are graph-only
// dark tints with no token twin, so they stay literal.
const KIND = {
    driver: {
        fill: "rgba(245, 165, 36, 0.15)",
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CHART_HEX"].warning
    },
    module: {
        fill: "var(--caos-panel)",
        stroke: "var(--caos-border)"
    },
    claim: {
        fill: "var(--caos-panel)",
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CHART_HEX"].accent
    },
    evidence: {
        fill: "var(--caos-panel)",
        stroke: "var(--caos-border)"
    },
    chunk: {
        fill: "rgba(34, 197, 94, 0.10)",
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CHART_HEX"].success
    },
    metric: {
        fill: "var(--caos-panel)",
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CHART_HEX"].accent
    },
    "point-bull": {
        fill: "rgba(34, 197, 94, 0.15)",
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CHART_HEX"].success
    },
    "point-bear": {
        fill: "rgba(239, 68, 68, 0.15)",
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CHART_HEX"].critical
    },
    "finding-crit": {
        fill: "rgba(239, 68, 68, 0.15)",
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CHART_HEX"].critical
    },
    "finding-mat": {
        fill: "rgba(245, 165, 36, 0.15)",
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CHART_HEX"].warning
    },
    "finding-min": {
        fill: "var(--caos-elevated)",
        stroke: "var(--caos-idle)"
    }
};
const MONO_KINDS = new Set([
    "claim",
    "evidence",
    "metric",
    "module"
]);
function compactStyle(groupColor, palette) {
    return {
        shape: "compact",
        fill: palette?.fill ?? `color-mix(in srgb, ${groupColor} 20%, transparent)`,
        stroke: palette?.stroke ?? groupColor,
        r: 6,
        sw: 1.4,
        isCircle: false,
        isMono: false,
        color: groupColor
    };
}
function centerGeometry(flagged) {
    return {
        fill: "var(--caos-panel)",
        stroke: flagged ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CHART_HEX"].warning : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CHART_HEX"].accent,
        r: 19,
        sw: 2.6
    };
}
function issuerGeometry(groupColor, exposed) {
    return {
        fill: `color-mix(in srgb, ${groupColor} 20%, transparent)`,
        stroke: exposed ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CHART_HEX"].warning : groupColor,
        r: 11,
        sw: exposed ? 2.4 : 1.8
    };
}
function rectangularGeometry(flagged, palette) {
    return {
        fill: palette?.fill ?? "var(--caos-panel)",
        stroke: flagged ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CHART_HEX"].warning : palette?.stroke ?? "var(--caos-border)",
        r: 13,
        sw: 1.4
    };
}
function regularGeometry(node, groupColor, palette) {
    if (node.kind === "center") return centerGeometry(Boolean(node.flag));
    if (node.kind === "issuer") return issuerGeometry(groupColor, Boolean(node.exposed));
    return rectangularGeometry(Boolean(node.flag), palette);
}
function regularShape(kind) {
    if (kind === "issuer" || kind === "center") return {
        shape: "circle",
        isCircle: true
    };
    return {
        shape: kind === "sector" ? "pill" : "rect",
        isCircle: false
    };
}
function nodeStyle(n) {
    const groupColor = hueFor(n.group);
    const palette = KIND[n.kind];
    // Compact cluster member: a small dot, name on hover only.
    if (n.compact) return compactStyle(groupColor, palette);
    // Shape: issuers + center are circles colored by group; everything else is a
    // small rounded rect tinted by kind. Sector/cluster nodes read as a pill.
    const geometry = regularGeometry(n, groupColor, palette);
    const shape = regularShape(n.kind);
    return {
        ...geometry,
        ...shape,
        isMono: MONO_KINDS.has(n.kind),
        color: n.flag ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CHART_HEX"].warning : groupColor
    };
}
}),
"[project]/src/components/query/useGraphZoom.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useGraphZoom",
    ()=>useGraphZoom
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__ = __turbopack_context__.i("[project]/node_modules/d3-selection/src/select.js [app-ssr] (ecmascript) <export default as select>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$zoom$2f$src$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/d3-zoom/src/index.js [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$zoom$2f$src$2f$zoom$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__zoom$3e$__ = __turbopack_context__.i("[project]/node_modules/d3-zoom/src/zoom.js [app-ssr] (ecmascript) <export default as zoom>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$transition$2f$src$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/d3-transition/src/index.js [app-ssr] (ecmascript) <locals>");
"use client";
;
;
;
;
function useGraphZoom(svgRef, fitTransform, resetKey, setTransform) {
    const zoomBehaviorRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!svgRef.current) return;
        const svg = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])(svgRef.current);
        const zoom = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$zoom$2f$src$2f$zoom$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__zoom$3e$__["zoom"])().scaleExtent([
            0.1,
            8
        ]).on("zoom", (event)=>setTransform(event.transform));
        zoomBehaviorRef.current = zoom;
        svg.call(zoom);
        svg.call(zoom.transform, fitTransform);
    }, [
        fitTransform,
        resetKey,
        setTransform,
        svgRef
    ]);
    return ()=>{
        if (!svgRef.current || !zoomBehaviorRef.current) return;
        const reduce = ("TURBOPACK compile-time value", "undefined") !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])(svgRef.current).transition().duration(("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : 180).call(zoomBehaviorRef.current.transform, fitTransform);
    };
}
}),
"[project]/src/components/query/useGraphViewport.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GRAPH_HEIGHT",
    ()=>GRAPH_HEIGHT,
    "GRAPH_PADDING",
    ()=>GRAPH_PADDING,
    "GRAPH_WIDTH",
    ()=>GRAPH_WIDTH,
    "graphX",
    ()=>graphX,
    "graphY",
    ()=>graphY,
    "useGraphViewport",
    ()=>useGraphViewport
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$zoom$2f$src$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/d3-zoom/src/index.js [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$zoom$2f$src$2f$transform$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__identity__as__zoomIdentity$3e$__ = __turbopack_context__.i("[project]/node_modules/d3-zoom/src/transform.js [app-ssr] (ecmascript) <export identity as zoomIdentity>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphZoom$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/query/useGraphZoom.ts [app-ssr] (ecmascript)");
;
;
;
const GRAPH_WIDTH = 1000;
const GRAPH_HEIGHT = 600;
const GRAPH_PADDING = 78;
const graphX = (value)=>GRAPH_PADDING + value * (GRAPH_WIDTH - 2 * GRAPH_PADDING);
const graphY = (value)=>GRAPH_PADDING + value * (GRAPH_HEIGHT - 2 * GRAPH_PADDING);
function useGraphViewport(graph) {
    const [transform, setTransform] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$zoom$2f$src$2f$transform$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__identity__as__zoomIdentity$3e$__["zoomIdentity"]);
    const svgRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const fitTransform = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (graph.nodes.length === 0) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$zoom$2f$src$2f$transform$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__identity__as__zoomIdentity$3e$__["zoomIdentity"];
        const xs = graph.nodes.map((node)=>graphX(node.x));
        const ys = graph.nodes.map((node)=>graphY(node.y));
        const margin = 110;
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
        const scale = Math.max(0.3, Math.min(1.5, (GRAPH_WIDTH - 2 * margin) / Math.max(width, 1), (GRAPH_HEIGHT - 2 * margin) / Math.max(height, 1)));
        const centerX = (Math.max(...xs) + Math.min(...xs)) / 2;
        const centerY = (Math.max(...ys) + Math.min(...ys)) / 2;
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$zoom$2f$src$2f$transform$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__identity__as__zoomIdentity$3e$__["zoomIdentity"].translate(GRAPH_WIDTH / 2 - scale * centerX, GRAPH_HEIGHT / 2 - scale * centerY).scale(scale);
    }, [
        graph.nodes
    ]);
    const handleResetZoom = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphZoom$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useGraphZoom"])(svgRef, fitTransform, graph, setTransform);
    const byId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>Object.fromEntries(graph.nodes.map((node)=>[
                node.id,
                node
            ])), [
        graph.nodes
    ]);
    return {
        byId,
        handleResetZoom,
        svgRef,
        transform
    };
}
}),
"[project]/src/components/query/ScatterCanvas.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ScatterCanvas",
    ()=>ScatterCanvas
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$node$2d$style$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/query/node-style.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/query/useGraphViewport.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function scatterOpacity(focused, selected, dimmed) {
    if (focused) return 1;
    if (selected) return 0.95;
    return dimmed ? 0.15 : 0.75;
}
function ScatterFocusRing({ x, y, style, focused }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
        cx: x,
        cy: y,
        r: style.r + (focused ? 6 : 4),
        fill: "none",
        stroke: "var(--caos-accent)",
        strokeWidth: 1.5,
        strokeDasharray: focused ? "2 2" : undefined
    }, void 0, false, {
        fileName: "[project]/src/components/query/ScatterCanvas.tsx",
        lineNumber: 23,
        columnNumber: 10
    }, this);
}
function ScatterNodeShape({ x, y, style }) {
    if (style.shape === "circle") return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
        cx: x,
        cy: y,
        r: style.r,
        fill: style.fill,
        stroke: style.stroke,
        strokeWidth: style.sw
    }, void 0, false, {
        fileName: "[project]/src/components/query/ScatterCanvas.tsx",
        lineNumber: 27,
        columnNumber: 40
    }, this);
    if (style.shape === "rect") return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
        x: x - style.r,
        y: y - style.r,
        width: style.r * 2,
        height: style.r * 2,
        rx: 3,
        fill: style.fill,
        stroke: style.stroke,
        strokeWidth: style.sw
    }, void 0, false, {
        fileName: "[project]/src/components/query/ScatterCanvas.tsx",
        lineNumber: 28,
        columnNumber: 38
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
        x: x - style.r * 1.5,
        y: y - style.r * 0.8,
        width: style.r * 3,
        height: style.r * 1.6,
        rx: 6,
        fill: style.fill,
        stroke: style.stroke,
        strokeWidth: style.sw
    }, void 0, false, {
        fileName: "[project]/src/components/query/ScatterCanvas.tsx",
        lineNumber: 29,
        columnNumber: 10
    }, this);
}
function ScatterLabel({ node, x, y, radius, emphasized }) {
    if (node.compact && !emphasized) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
        x: x,
        y: y - radius - 5,
        textAnchor: "middle",
        fill: "var(--caos-text)",
        fontSize: "10px",
        fontWeight: emphasized ? "bold" : "normal",
        fontFamily: "var(--font-sans), sans-serif",
        paintOrder: "stroke",
        stroke: "#0a0a0f",
        strokeWidth: 3,
        strokeLinejoin: "round",
        children: node.label
    }, void 0, false, {
        fileName: "[project]/src/components/query/ScatterCanvas.tsx",
        lineNumber: 34,
        columnNumber: 10
    }, this);
}
function ScatterPoint({ node, focusId, selectedNodeId, connectedNodeIds, toX, toY, onSelect, onHover }) {
    const style = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$node$2d$style$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["nodeStyle"])(node);
    const focused = node.id === focusId;
    const selected = node.id === selectedNodeId;
    const emphasized = focused || selected;
    const dimmed = Boolean(focusId) && !connectedNodeIds.has(node.id);
    const x = toX(node.x);
    const y = toY(node.y);
    const activateFromKeyboard = (event)=>{
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect?.(node);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
        tabIndex: 0,
        role: "button",
        style: {
            opacity: scatterOpacity(focused, selected, dimmed),
            transition: "opacity 160ms ease-out"
        },
        className: "cursor-pointer focus-ring outline-none",
        "aria-label": `Select ${node.label}${node.kind ? ` (${node.kind})` : ""}`,
        onFocus: ()=>onHover(node.id),
        onBlur: ()=>onHover(null),
        onMouseEnter: ()=>onHover(node.id),
        onMouseLeave: ()=>onHover(null),
        onClick: ()=>onSelect?.(node),
        onKeyDown: activateFromKeyboard,
        children: [
            emphasized ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ScatterFocusRing, {
                x: x,
                y: y,
                style: style,
                focused: focused
            }, void 0, false, {
                fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                lineNumber: 63,
                columnNumber: 21
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ScatterNodeShape, {
                x: x,
                y: y,
                style: style
            }, void 0, false, {
                fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                lineNumber: 64,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ScatterLabel, {
                node: node,
                x: x,
                y: y,
                radius: style.r,
                emphasized: emphasized
            }, void 0, false, {
                fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                lineNumber: 65,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/ScatterCanvas.tsx",
        lineNumber: 54,
        columnNumber: 5
    }, this);
}
function ScatterCanvas({ graph, selectedNodeId, onSelectNode }) {
    const { byId, handleResetZoom, svgRef, transform } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useGraphViewport"])(graph);
    // Hovered node tracking for highlighting edges
    const [hoveredNodeId, setHoveredNodeId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    // Real metric-unit ticks when the builder emits domains (xdomain/ydomain in
    // meta); otherwise the honest normalized 0→1 scale. Positions mirror the
    // builder's 0.1..0.9 inset (x) and 0.9..0.1 (y, high value at top).
    const ticks = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        const parse = (p)=>{
            const m = graph.meta.find((s)=>s.startsWith(p));
            if (!m) return null;
            const [lo, hi] = m.slice(p.length).split("|").map(Number);
            return Number.isFinite(lo) && Number.isFinite(hi) ? {
                lo,
                hi
            } : null;
        };
        const dx = parse("xdomain="), dy = parse("ydomain=");
        const F = [
            0,
            0.25,
            0.5,
            0.75,
            1
        ];
        const x = dx ? F.map((f)=>({
                p: 0.1 + 0.8 * f,
                label: (dx.lo + f * (dx.hi - dx.lo)).toFixed(1) + "x"
            })) : F.map((f)=>({
                p: f,
                label: f.toFixed(2)
            }));
        const y = dy ? F.map((f)=>({
                p: 0.9 - 0.8 * f,
                label: (dy.lo + f * (dy.hi - dy.lo)).toFixed(1) + "x"
            })) : F.map((f)=>({
                p: 1 - f,
                label: f.toFixed(2)
            }));
        return {
            x,
            y
        };
    }, [
        graph.meta
    ]);
    // Compute active focus target: hovered node first, then selected node
    const activeFocusId = hoveredNodeId || selectedNodeId;
    // Filter edges connected to the active focus node
    const activeEdges = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (!activeFocusId) return [];
        return graph.edges.filter((e)=>e.source === activeFocusId || e.target === activeFocusId);
    }, [
        graph.edges,
        activeFocusId
    ]);
    // Create a set of node IDs connected to active focus
    const activeConnectedNodeIds = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (!activeFocusId) return new Set();
        const ids = new Set([
            activeFocusId
        ]);
        activeEdges.forEach((e)=>{
            ids.add(e.source);
            ids.add(e.target);
        });
        return ids;
    }, [
        activeEdges,
        activeFocusId
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex-1 min-h-0 flex flex-col relative select-none bg-caos-bg",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute top-2 right-2 z-10 flex gap-1 bg-caos-panel/90 border border-caos-border rounded p-1",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    onClick: handleResetZoom,
                    className: "tabular text-caos-3xs uppercase tracking-wider px-2 py-1 rounded bg-caos-bg border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50 transition-caos focus-ring",
                    title: "Reset Zoom",
                    children: "Reset View"
                }, void 0, false, {
                    fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                    lineNumber: 127,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                lineNumber: 126,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute bottom-2 left-4 z-10 tabular text-caos-3xs text-caos-muted font-mono uppercase tracking-wider",
                children: (()=>{
                    const axes = graph.meta.filter((m)=>/^[xy] = /.test(m));
                    return axes.length > 0 ? axes.join(" · ") : "positions normalized 0 → 1 (no metric axes)";
                })()
            }, void 0, false, {
                fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                lineNumber: 138,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                ref: svgRef,
                viewBox: `0 0 ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["GRAPH_WIDTH"]} ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["GRAPH_HEIGHT"]}`,
                className: "w-full h-full block cursor-grab active:cursor-grabbing",
                role: "group",
                "aria-label": `Scatter Plot: ${graph.title}`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("defs", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("marker", {
                            id: "scatter-arrow",
                            viewBox: "0 0 10 10",
                            refX: "9",
                            refY: "5",
                            markerWidth: "5",
                            markerHeight: "5",
                            orient: "auto-start-reverse",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                d: "M0,0 L10,5 L0,10 z",
                                fill: "var(--caos-accent)"
                            }, void 0, false, {
                                fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                                lineNumber: 154,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                            lineNumber: 153,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                        lineNumber: 152,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                        transform: transform.toString(),
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                                className: "grid-lines",
                                opacity: 0.3,
                                children: [
                                    ticks.y.map((t, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                            x1: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphX"])(0),
                                            y1: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphY"])(t.p),
                                            x2: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphX"])(1),
                                            y2: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphY"])(t.p),
                                            stroke: "var(--caos-border)",
                                            strokeWidth: 1,
                                            strokeDasharray: "2 3"
                                        }, `h-${i}`, false, {
                                            fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                                            lineNumber: 165,
                                            columnNumber: 15
                                        }, this)),
                                    ticks.x.map((t, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                            x1: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphX"])(t.p),
                                            y1: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphY"])(0),
                                            x2: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphX"])(t.p),
                                            y2: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphY"])(1),
                                            stroke: "var(--caos-border)",
                                            strokeWidth: 1,
                                            strokeDasharray: "2 3"
                                        }, `v-${i}`, false, {
                                            fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                                            lineNumber: 169,
                                            columnNumber: 15
                                        }, this))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                                lineNumber: 163,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                                className: "grid-ticks",
                                fill: "var(--caos-muted)",
                                fontSize: 10,
                                fontFamily: "var(--font-mono)",
                                opacity: 0.75,
                                children: [
                                    ticks.x.map((t, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                                            x: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphX"])(t.p),
                                            y: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphY"])(1) + 16,
                                            textAnchor: "middle",
                                            children: t.label
                                        }, `tx-${i}`, false, {
                                            fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                                            lineNumber: 180,
                                            columnNumber: 15
                                        }, this)),
                                    ticks.y.map((t, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                                            x: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphX"])(0) - 8,
                                            y: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphY"])(t.p) + 3.5,
                                            textAnchor: "end",
                                            children: t.label
                                        }, `ty-${i}`, false, {
                                            fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                                            lineNumber: 183,
                                            columnNumber: 15
                                        }, this))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                                lineNumber: 177,
                                columnNumber: 11
                            }, this),
                            activeEdges.map((e, i)=>{
                                const a = byId[e.source];
                                const b = byId[e.target];
                                if (!a || !b) return null;
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                    x1: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphX"])(a.x),
                                    y1: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphY"])(a.y),
                                    x2: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphX"])(b.x),
                                    y2: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphY"])(b.y),
                                    stroke: "var(--caos-accent)",
                                    strokeWidth: 1.8,
                                    opacity: 0.7,
                                    markerEnd: "url(#scatter-arrow)"
                                }, `edge-${i}`, false, {
                                    fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                                    lineNumber: 194,
                                    columnNumber: 15
                                }, this);
                            }),
                            graph.nodes.map((node)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ScatterPoint, {
                                    node: node,
                                    focusId: activeFocusId,
                                    selectedNodeId: selectedNodeId,
                                    connectedNodeIds: activeConnectedNodeIds,
                                    toX: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphX"],
                                    toY: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["graphY"],
                                    onSelect: onSelectNode,
                                    onHover: setHoveredNodeId
                                }, node.id, false, {
                                    fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                                    lineNumber: 209,
                                    columnNumber: 38
                                }, this))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                        lineNumber: 159,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/query/ScatterCanvas.tsx",
                lineNumber: 145,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/ScatterCanvas.tsx",
        lineNumber: 124,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=src_1n189ne._.js.map