(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/lib/chart-colors.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/a11y.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Keyboard activation for elements promoted to role="button" — fires the
// handler on Enter or Space (and suppresses Space-scroll), matching native
// button behavior so clickable rows are operable without a mouse.
__turbopack_context__.s([
    "onActivate",
    ()=>onActivate
]);
function onActivate(fn) {
    return (e)=>{
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fn();
        }
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/query/node-style.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/chart-colors.ts [app-client] (ecmascript)");
;
const MODEL_HUE = "#a78bfa";
// Categorical hues for issuer grouping (industry/country). Distinct, no banding —
// pairs with the always-present text label, so meaning is never color-only.
// Deliberately excludes the semantic hues (warning/critical/success/MODEL_HUE):
// a hashed sector must never read as "exposed" (warning) or model/ratified
// provenance (purple). First two mirror tokens (via chart-colors); the rest are
// graph-only neutral/distinct hues.
const CATEGORICAL = [
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TRANCHE_HEX"]["1l"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].accent,
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
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].warning
    },
    module: {
        fill: "var(--caos-panel)",
        stroke: "var(--caos-border)"
    },
    claim: {
        fill: "var(--caos-panel)",
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].accent
    },
    evidence: {
        fill: "var(--caos-panel)",
        stroke: "var(--caos-border)"
    },
    chunk: {
        fill: "rgba(34, 197, 94, 0.10)",
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].success
    },
    metric: {
        fill: "var(--caos-panel)",
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].accent
    },
    "point-bull": {
        fill: "rgba(34, 197, 94, 0.15)",
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].success
    },
    "point-bear": {
        fill: "rgba(239, 68, 68, 0.15)",
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].critical
    },
    "finding-crit": {
        fill: "rgba(239, 68, 68, 0.15)",
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].critical
    },
    "finding-mat": {
        fill: "rgba(245, 165, 36, 0.15)",
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].warning
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
        stroke: flagged ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].warning : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].accent,
        r: 19,
        sw: 2.6
    };
}
function issuerGeometry(groupColor, exposed) {
    return {
        fill: `color-mix(in srgb, ${groupColor} 20%, transparent)`,
        stroke: exposed ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].warning : groupColor,
        r: 11,
        sw: exposed ? 2.4 : 1.8
    };
}
function rectangularGeometry(flagged, palette) {
    return {
        fill: palette?.fill ?? "var(--caos-panel)",
        stroke: flagged ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].warning : palette?.stroke ?? "var(--caos-border)",
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
        color: n.flag ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].warning : groupColor
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/query/useGraphZoom.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useGraphZoom",
    ()=>useGraphZoom
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__ = __turbopack_context__.i("[project]/node_modules/d3-selection/src/select.js [app-client] (ecmascript) <export default as select>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$zoom$2f$src$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/d3-zoom/src/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$zoom$2f$src$2f$zoom$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__zoom$3e$__ = __turbopack_context__.i("[project]/node_modules/d3-zoom/src/zoom.js [app-client] (ecmascript) <export default as zoom>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$transition$2f$src$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/d3-transition/src/index.js [app-client] (ecmascript) <locals>");
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
function useGraphZoom(svgRef, fitTransform, resetKey, setTransform) {
    _s();
    const zoomBehaviorRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useGraphZoom.useEffect": ()=>{
            if (!svgRef.current) return;
            const svg = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])(svgRef.current);
            const zoom = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$zoom$2f$src$2f$zoom$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__zoom$3e$__["zoom"])().scaleExtent([
                0.1,
                8
            ]).on("zoom", {
                "useGraphZoom.useEffect.zoom": (event)=>setTransform(event.transform)
            }["useGraphZoom.useEffect.zoom"]);
            zoomBehaviorRef.current = zoom;
            svg.call(zoom);
            svg.call(zoom.transform, fitTransform);
        }
    }["useGraphZoom.useEffect"], [
        fitTransform,
        resetKey,
        setTransform,
        svgRef
    ]);
    return ()=>{
        if (!svgRef.current || !zoomBehaviorRef.current) return;
        const reduce = ("TURBOPACK compile-time value", "object") !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$selection$2f$src$2f$select$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__select$3e$__["select"])(svgRef.current).transition().duration(reduce ? 0 : 180).call(zoomBehaviorRef.current.transform, fitTransform);
    };
}
_s(useGraphZoom, "uFAtQdo3mcHcoXlSOEAYPqatCiY=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/query/useGraphViewport.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$zoom$2f$src$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/d3-zoom/src/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$zoom$2f$src$2f$transform$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__identity__as__zoomIdentity$3e$__ = __turbopack_context__.i("[project]/node_modules/d3-zoom/src/transform.js [app-client] (ecmascript) <export identity as zoomIdentity>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphZoom$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/query/useGraphZoom.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
;
const GRAPH_WIDTH = 1000;
const GRAPH_HEIGHT = 600;
const GRAPH_PADDING = 78;
const graphX = (value)=>GRAPH_PADDING + value * (GRAPH_WIDTH - 2 * GRAPH_PADDING);
const graphY = (value)=>GRAPH_PADDING + value * (GRAPH_HEIGHT - 2 * GRAPH_PADDING);
function useGraphViewport(graph) {
    _s();
    const [transform, setTransform] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$zoom$2f$src$2f$transform$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__identity__as__zoomIdentity$3e$__["zoomIdentity"]);
    const svgRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const fitTransform = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "useGraphViewport.useMemo[fitTransform]": ()=>{
            if (graph.nodes.length === 0) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$zoom$2f$src$2f$transform$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__identity__as__zoomIdentity$3e$__["zoomIdentity"];
            const xs = graph.nodes.map({
                "useGraphViewport.useMemo[fitTransform].xs": (node)=>graphX(node.x)
            }["useGraphViewport.useMemo[fitTransform].xs"]);
            const ys = graph.nodes.map({
                "useGraphViewport.useMemo[fitTransform].ys": (node)=>graphY(node.y)
            }["useGraphViewport.useMemo[fitTransform].ys"]);
            const margin = 110;
            const width = Math.max(...xs) - Math.min(...xs);
            const height = Math.max(...ys) - Math.min(...ys);
            const scale = Math.max(0.3, Math.min(1.5, (GRAPH_WIDTH - 2 * margin) / Math.max(width, 1), (GRAPH_HEIGHT - 2 * margin) / Math.max(height, 1)));
            const centerX = (Math.max(...xs) + Math.min(...xs)) / 2;
            const centerY = (Math.max(...ys) + Math.min(...ys)) / 2;
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$d3$2d$zoom$2f$src$2f$transform$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__identity__as__zoomIdentity$3e$__["zoomIdentity"].translate(GRAPH_WIDTH / 2 - scale * centerX, GRAPH_HEIGHT / 2 - scale * centerY).scale(scale);
        }
    }["useGraphViewport.useMemo[fitTransform]"], [
        graph.nodes
    ]);
    const handleResetZoom = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphZoom$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGraphZoom"])(svgRef, fitTransform, graph, setTransform);
    const byId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "useGraphViewport.useMemo[byId]": ()=>Object.fromEntries(graph.nodes.map({
                "useGraphViewport.useMemo[byId]": (node)=>[
                        node.id,
                        node
                    ]
            }["useGraphViewport.useMemo[byId]"]))
    }["useGraphViewport.useMemo[byId]"], [
        graph.nodes
    ]);
    return {
        byId,
        handleResetZoom,
        svgRef,
        transform
    };
}
_s(useGraphViewport, "RMnF4E38CsU68yYgL44RE9ilF78=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphZoom$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGraphZoom"]
    ];
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/query/GraphCanvas.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GraphCanvas",
    ()=>GraphCanvas
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/SurfaceState.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/chart-colors.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$a11y$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/a11y.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$node$2d$style$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/query/node-style.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/query/useGraphViewport.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
const EDGE = {
    dep: {
        stroke: "#5f6f8f",
        width: 1.3
    },
    cite: {
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].accent,
        width: 1.2
    },
    driver: {
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].warning,
        width: 2.4
    },
    // Wiki walk: membership IS the answer, so make these hairlines legible — a
    // touch lighter than the raw border and rendered at higher opacity below.
    member: {
        stroke: "#34384a",
        width: 1
    },
    seq: {
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].accent,
        width: 1.8
    },
    bull: {
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].success,
        width: 1.5,
        dash: "4 3"
    },
    bear: {
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].critical,
        width: 1.5,
        dash: "4 3"
    },
    finding: {
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].warning,
        width: 1.2
    },
    // Analyst-ratified model proposal: solid (ratified) in the model hue (origin).
    accepted: {
        stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$node$2d$style$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODEL_HUE"],
        width: 1.8
    }
};
const HALO = {
    paintOrder: "stroke",
    stroke: "#0a0a0f",
    strokeWidth: 3.5,
    strokeLinejoin: "round"
};
const short = (s, n = 18)=>s.length > n ? s.slice(0, n - 1) + "…" : s;
// Issuer/center labels are real names ("Virgin Media O2 Investments Holdings")
// on a mostly-empty canvas — hard-cutting at 18 wastes the space. Split onto up
// to two lines at the space nearest the midpoint (generous ~18-char budget per
// line), ellipsis only if a single word still overflows. Returns 1 or 2 lines.
const wrapLabel = (s, budget = 18)=>{
    if (s.length <= budget) return [
        s
    ];
    const mid = s.length / 2;
    let best = -1;
    for(let i = 0; i < s.length; i++){
        if (s[i] === " " && (best === -1 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    }
    if (best === -1) return [
        short(s, budget)
    ]; // no break point — one clipped line
    return [
        short(s.slice(0, best), budget),
        short(s.slice(best + 1), budget)
    ];
};
function GraphCanvas({ graph, overlay, onOpenChunk, onSelectNode }) {
    _s();
    const { byId, handleResetZoom, svgRef, transform } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGraphViewport"])(graph);
    // Keep track of hovered node for visual connection path highlighting
    const [hoveredNodeId, setHoveredNodeId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Adjacent node tracking for hover-highlight filters
    const adjacentNodeIds = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "GraphCanvas.useMemo[adjacentNodeIds]": ()=>{
            if (!hoveredNodeId) return new Set();
            const adjacent = new Set([
                hoveredNodeId
            ]);
            graph.edges.forEach({
                "GraphCanvas.useMemo[adjacentNodeIds]": (e)=>{
                    if (e.source === hoveredNodeId) adjacent.add(e.target);
                    if (e.target === hoveredNodeId) adjacent.add(e.source);
                }
            }["GraphCanvas.useMemo[adjacentNodeIds]"]);
            return adjacent;
        }
    }["GraphCanvas.useMemo[adjacentNodeIds]"], [
        hoveredNodeId,
        graph.edges
    ]);
    const legend = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "GraphCanvas.useMemo[legend]": ()=>legendFor(graph.nodes)
    }["GraphCanvas.useMemo[legend]"], [
        graph
    ]);
    if (graph.nodes.length === 0) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex-1 flex items-center justify-center text-center px-6",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
                kind: "empty",
                title: graph.title,
                detail: graph.meta[0],
                className: "max-w-md"
            }, void 0, false, {
                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                lineNumber: 85,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/query/GraphCanvas.tsx",
            lineNumber: 84,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex-1 min-h-0 flex flex-col relative select-none",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute top-2 right-2 z-10 flex gap-1 bg-caos-panel/90 border border-caos-border rounded p-1",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    onClick: handleResetZoom,
                    className: "tabular text-caos-3xs uppercase tracking-wider px-2 py-1 rounded bg-caos-bg border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50 transition-caos focus-ring",
                    title: "Reset Zoom",
                    children: "Reset View"
                }, void 0, false, {
                    fileName: "[project]/src/components/query/GraphCanvas.tsx",
                    lineNumber: 94,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                lineNumber: 93,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                ref: svgRef,
                viewBox: `0 0 ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GRAPH_WIDTH"]} ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GRAPH_HEIGHT"]}`,
                width: "100%",
                height: "100%",
                preserveAspectRatio: "xMidYMid meet",
                role: "group",
                "aria-label": `Graph: ${graph.title}`,
                style: {
                    display: "block"
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("title", {
                        children: graph.title
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/GraphCanvas.tsx",
                        lineNumber: 113,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("desc", {
                        children: `${graph.title}. ${graph.nodes.length} nodes, ${graph.edges.length} links. ${graph.meta.join(". ")}.`
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/GraphCanvas.tsx",
                        lineNumber: 114,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("defs", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("marker", {
                            id: "qg-arrow",
                            viewBox: "0 0 10 10",
                            refX: "9",
                            refY: "5",
                            markerWidth: "6",
                            markerHeight: "6",
                            orient: "auto-start-reverse",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                d: "M0,0 L10,5 L0,10 z",
                                fill: "#5f6f8f"
                            }, void 0, false, {
                                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                                lineNumber: 117,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/query/GraphCanvas.tsx",
                            lineNumber: 116,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/GraphCanvas.tsx",
                        lineNumber: 115,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                        transform: transform.toString(),
                        children: [
                            graph.edges.map((e, i)=>{
                                const a = byId[e.source];
                                const b = byId[e.target];
                                if (!a || !b) return null;
                                // Hover highlight check: edge is highlighted if connected to hovered node
                                const isDimmed = hoveredNodeId && e.source !== hoveredNodeId && e.target !== hoveredNodeId;
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                                    style: {
                                        opacity: isDimmed ? 0.08 : 1.0,
                                        transition: "opacity 160ms ease-out"
                                    },
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(EdgeLine, {
                                        edge: e,
                                        x1: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["graphX"])(a.x),
                                        y1: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["graphY"])(a.y),
                                        x2: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["graphX"])(b.x),
                                        y2: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["graphY"])(b.y)
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/query/GraphCanvas.tsx",
                                        lineNumber: 133,
                                        columnNumber: 17
                                    }, this)
                                }, i, false, {
                                    fileName: "[project]/src/components/query/GraphCanvas.tsx",
                                    lineNumber: 132,
                                    columnNumber: 15
                                }, this);
                            }),
                            (overlay ?? []).map((e, i)=>{
                                const a = byId[e.source];
                                const b = byId[e.target];
                                if (!a || !b) return null;
                                return(// print:hidden — model-proposed links never enter a printed exhibit.
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                                    className: "print:hidden",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                            x1: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["graphX"])(a.x),
                                            y1: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["graphY"])(a.y),
                                            x2: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["graphX"])(b.x),
                                            y2: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["graphY"])(b.y),
                                            stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$node$2d$style$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODEL_HUE"],
                                            strokeWidth: 1.6,
                                            strokeDasharray: "6 4",
                                            opacity: 0.8
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/query/GraphCanvas.tsx",
                                            lineNumber: 145,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                                            x: ((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["graphX"])(a.x) + (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["graphX"])(b.x)) / 2,
                                            y: ((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["graphY"])(a.y) + (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["graphY"])(b.y)) / 2 - 5,
                                            textAnchor: "middle",
                                            fill: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$node$2d$style$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODEL_HUE"],
                                            fontFamily: "var(--font-mono)",
                                            fontSize: 11,
                                            ...HALO,
                                            children: [
                                                "model · ",
                                                e.confidence
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/query/GraphCanvas.tsx",
                                            lineNumber: 149,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, `ov-${i}`, true, {
                                    fileName: "[project]/src/components/query/GraphCanvas.tsx",
                                    lineNumber: 144,
                                    columnNumber: 15
                                }, this));
                            }),
                            graph.nodes.map((n)=>{
                                // Hover highlight check: node is dimmed if another node is hovered and this isn't connected
                                const isDimmed = hoveredNodeId && !adjacentNodeIds.has(n.id);
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                                    style: {
                                        opacity: isDimmed ? 0.15 : 1.0,
                                        transition: "opacity 160ms ease-out"
                                    },
                                    onMouseEnter: ()=>setHoveredNodeId(n.id),
                                    onMouseLeave: ()=>setHoveredNodeId(null),
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodeMark, {
                                        n: n,
                                        cx: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["graphX"])(n.x),
                                        cy: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["graphY"])(n.y),
                                        onOpenChunk: onOpenChunk,
                                        onSelectNode: onSelectNode
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/query/GraphCanvas.tsx",
                                        lineNumber: 170,
                                        columnNumber: 17
                                    }, this)
                                }, n.id, false, {
                                    fileName: "[project]/src/components/query/GraphCanvas.tsx",
                                    lineNumber: 164,
                                    columnNumber: 15
                                }, this);
                            })
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/query/GraphCanvas.tsx",
                        lineNumber: 122,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                lineNumber: 103,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "sr-only",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        children: [
                            graph.title,
                            " — ",
                            graph.nodes.length,
                            " nodes, ",
                            graph.edges.length,
                            " links"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/query/GraphCanvas.tsx",
                        lineNumber: 185,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        children: graph.nodes.map((n)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                children: [
                                    n.kind.replace("-", " "),
                                    ": ",
                                    n.label,
                                    n.sub ? `, ${n.sub}` : ""
                                ]
                            }, n.id, true, {
                                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                                lineNumber: 188,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/GraphCanvas.tsx",
                        lineNumber: 186,
                        columnNumber: 9
                    }, this),
                    graph.edges.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        children: graph.edges.map((e, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                children: [
                                    byId[e.source]?.label ?? e.source,
                                    " → ",
                                    byId[e.target]?.label ?? e.target,
                                    e.label ? ` (${e.label})` : "",
                                    e.kind ? `, ${e.kind}` : ""
                                ]
                            }, i, true, {
                                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                                lineNumber: 194,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/GraphCanvas.tsx",
                        lineNumber: 192,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                lineNumber: 184,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "shrink-0 flex items-center gap-x-4 gap-y-1 px-1 pt-2 overflow-x-auto whitespace-nowrap sm:flex-wrap",
                children: [
                    legend.map((l)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "inline-flex items-center gap-1.5 shrink-0 tabular text-caos-2xs text-caos-muted",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "inline-block w-2.5 h-2.5 rounded-full",
                                    style: {
                                        background: l.color
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/src/components/query/GraphCanvas.tsx",
                                    lineNumber: 203,
                                    columnNumber: 13
                                }, this),
                                l.label
                            ]
                        }, l.label, true, {
                            fileName: "[project]/src/components/query/GraphCanvas.tsx",
                            lineNumber: 202,
                            columnNumber: 11
                        }, this)),
                    graph.edges.some((e)=>e.kind === "accepted") && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "inline-flex items-center gap-1.5 shrink-0 tabular text-caos-2xs",
                        style: {
                            color: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$node$2d$style$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODEL_HUE"]
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                width: "14",
                                height: "6",
                                "aria-hidden": "true",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                    x1: "0",
                                    y1: "3",
                                    x2: "14",
                                    y2: "3",
                                    stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$node$2d$style$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODEL_HUE"],
                                    strokeWidth: "1.8"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/query/GraphCanvas.tsx",
                                    lineNumber: 209,
                                    columnNumber: 59
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                                lineNumber: 209,
                                columnNumber: 13
                            }, this),
                            "analyst-accepted"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/query/GraphCanvas.tsx",
                        lineNumber: 208,
                        columnNumber: 11
                    }, this),
                    overlay && overlay.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "inline-flex items-center gap-1.5 shrink-0 tabular text-caos-2xs print:hidden",
                        style: {
                            color: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$node$2d$style$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODEL_HUE"]
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                width: "14",
                                height: "6",
                                "aria-hidden": "true",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                    x1: "0",
                                    y1: "3",
                                    x2: "14",
                                    y2: "3",
                                    stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$node$2d$style$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODEL_HUE"],
                                    strokeWidth: "1.6",
                                    strokeDasharray: "4 3"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/query/GraphCanvas.tsx",
                                    lineNumber: 215,
                                    columnNumber: 59
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                                lineNumber: 215,
                                columnNumber: 13
                            }, this),
                            "model-proposed (",
                            overlay.length,
                            ")"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/query/GraphCanvas.tsx",
                        lineNumber: 214,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                lineNumber: 200,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/GraphCanvas.tsx",
        lineNumber: 91,
        columnNumber: 5
    }, this);
}
_s(GraphCanvas, "kZilpwGDfAuD/JT0m+JZ9D8I5uw=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$useGraphViewport$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGraphViewport"]
    ];
});
_c = GraphCanvas;
function EdgeLine({ edge, x1, y1, x2, y2 }) {
    const k = edge.kind;
    const base = k && EDGE[k] ? EDGE[k] : {
        stroke: "var(--caos-border)",
        width: 1 + (edge.weight ?? 0) * 3,
        dash: undefined
    };
    const arrow = k === "dep" || k === "cite" || k === "seq" || k === "bull" || k === "bear";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                x1: x1,
                y1: y1,
                x2: x2,
                y2: y2,
                stroke: base.stroke,
                strokeWidth: base.width,
                strokeDasharray: base.dash,
                markerEnd: arrow ? "url(#qg-arrow)" : undefined,
                opacity: k === "member" ? 0.5 : k === "dep" || k === "finding" ? 0.32 : 0.85
            }, void 0, false, {
                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                lineNumber: 230,
                columnNumber: 7
            }, this),
            edge.label ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                x: (x1 + x2) / 2,
                y: (y1 + y2) / 2 - 4,
                textAnchor: "middle",
                fill: "#aeb9d4",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                ...HALO,
                children: edge.label
            }, void 0, false, {
                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                lineNumber: 237,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/GraphCanvas.tsx",
        lineNumber: 229,
        columnNumber: 5
    }, this);
}
_c1 = EdgeLine;
function selectGraphNode(node, onOpenChunk, onSelectNode) {
    if (node.chunk_id) onOpenChunk(node.chunk_id, node.label);
    else onSelectNode?.(node);
}
function NodeWikiLink({ cx, cy, n, style }) {
    if (!n.obsidian_url) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
        href: n.obsidian_url,
        title: "Reveal in Obsidian Wiki",
        className: "focus-ring",
        onMouseDown: (e)=>e.stopPropagation(),
        style: {
            cursor: "pointer"
        },
        "aria-label": `Reveal ${n.label} in Obsidian Wiki`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: cx + style.r + 8,
                cy: cy - style.r - 2,
                r: 7.5,
                fill: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$node$2d$style$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODEL_HUE"],
                stroke: "#0a0a0f",
                strokeWidth: 1
            }, void 0, false, {
                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                lineNumber: 271,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                x: cx + style.r + 8,
                y: cy - style.r + 0.5,
                textAnchor: "middle",
                fill: "#0a0a0f",
                fontSize: 9,
                fontWeight: "bold",
                fontFamily: "var(--font-mono)",
                children: "W"
            }, void 0, false, {
                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                lineNumber: 272,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/GraphCanvas.tsx",
        lineNumber: 263,
        columnNumber: 5
    }, this);
}
_c2 = NodeWikiLink;
function NodeInteraction({ children, n, onOpenChunk, onSelectNode }) {
    const select = ()=>selectGraphNode(n, onOpenChunk, onSelectNode);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
        opacity: n.dim ? 0.5 : 1,
        style: {
            cursor: "pointer"
        },
        onClick: (event)=>{
            event.stopPropagation();
            select();
        },
        className: "graph-node select-none focus-ring",
        role: "button",
        tabIndex: 0,
        onKeyDown: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$a11y$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["onActivate"])(select),
        "aria-label": `Select ${n.label}${n.exposed && n.kind === "issuer" ? " (exposed)" : ""}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("title", {
                children: n.title || n.label
            }, void 0, false, {
                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                lineNumber: 293,
                columnNumber: 7
            }, this),
            children
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/GraphCanvas.tsx",
        lineNumber: 280,
        columnNumber: 5
    }, this);
}
_c3 = NodeInteraction;
function NodeShape({ cx, cy, n, style }) {
    if (style.shape === "compact") return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
        cx: cx,
        cy: cy,
        r: style.r,
        fill: style.fill,
        stroke: style.stroke,
        strokeWidth: style.sw
    }, void 0, false, {
        fileName: "[project]/src/components/query/GraphCanvas.tsx",
        lineNumber: 300,
        columnNumber: 41
    }, this);
    if (style.shape === "pill") return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodePill, {
        cx: cx,
        cy: cy,
        label: n.label,
        color: style.color
    }, void 0, false, {
        fileName: "[project]/src/components/query/GraphCanvas.tsx",
        lineNumber: 301,
        columnNumber: 38
    }, this);
    if (!style.isCircle) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RectMark, {
        cx: cx,
        cy: cy,
        fill: style.fill,
        stroke: style.stroke,
        sw: style.sw
    }, void 0, false, {
        fileName: "[project]/src/components/query/GraphCanvas.tsx",
        lineNumber: 302,
        columnNumber: 31
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            n.exposed && n.kind === "issuer" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: cx,
                cy: cy,
                r: style.r + 3.5,
                fill: "none",
                stroke: style.stroke,
                strokeWidth: 1,
                opacity: 0.7
            }, void 0, false, {
                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                lineNumber: 305,
                columnNumber: 43
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: cx,
                cy: cy,
                r: style.r,
                fill: style.fill,
                stroke: style.stroke,
                strokeWidth: style.sw
            }, void 0, false, {
                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                lineNumber: 306,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
_c4 = NodeShape;
function NodeLabel({ cx, cy, labelLines, n, style }) {
    if (n.kind === "sector" || style.shape === "compact") return null;
    const shared = {
        textAnchor: "middle",
        fill: n.dim ? "#9a9aac" : "#f0f0f6",
        fontWeight: n.kind === "center" ? 600 : 400
    };
    if (style.isCircle) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
            x: cx,
            y: cy + style.r + 16,
            fontSize: 13.5,
            ...shared,
            ...HALO,
            children: labelLines.map((line, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tspan", {
                    x: cx,
                    dy: index === 0 ? 0 : 15,
                    children: line
                }, index, false, {
                    fileName: "[project]/src/components/query/GraphCanvas.tsx",
                    lineNumber: 321,
                    columnNumber: 42
                }, this))
        }, void 0, false, {
            fileName: "[project]/src/components/query/GraphCanvas.tsx",
            lineNumber: 320,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
        x: cx,
        y: cy + 4.5,
        fontSize: 12.5,
        fontFamily: style.isMono ? "var(--font-mono)" : undefined,
        ...shared,
        ...HALO,
        children: labelLines.map((line, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tspan", {
                x: cx,
                dy: index === 0 ? 0 : 14,
                children: line
            }, index, false, {
                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                lineNumber: 327,
                columnNumber: 40
            }, this))
    }, void 0, false, {
        fileName: "[project]/src/components/query/GraphCanvas.tsx",
        lineNumber: 326,
        columnNumber: 5
    }, this);
}
_c5 = NodeLabel;
function NodeSubLabel({ cx, cy, labelLines, n, style }) {
    if (!n.sub || n.kind === "module" || style.shape === "compact") return null;
    const lineOffset = labelLines.length > 1 ? style.isCircle ? 15 : 14 : 0;
    const y = cy + (style.isCircle ? style.r + 31 : 19) + lineOffset;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
        x: cx,
        y: y,
        textAnchor: "middle",
        fill: "#a6a6b8",
        fontSize: 11.5,
        fontFamily: "var(--font-mono)",
        ...HALO,
        children: short(n.sub, 24)
    }, void 0, false, {
        fileName: "[project]/src/components/query/GraphCanvas.tsx",
        lineNumber: 336,
        columnNumber: 10
    }, this);
}
_c6 = NodeSubLabel;
function NodeMark({ n, cx, cy, onOpenChunk, onSelectNode }) {
    const style = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$node$2d$style$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nodeStyle"])(n);
    const labelLines = n.kind === "module" ? [
        short(n.label, 8)
    ] : wrapLabel(n.label, style.isCircle ? 18 : 20);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodeInteraction, {
                n: n,
                onOpenChunk: onOpenChunk,
                onSelectNode: onSelectNode,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodeShape, {
                        cx: cx,
                        cy: cy,
                        n: n,
                        style: style
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/GraphCanvas.tsx",
                        lineNumber: 345,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodeLabel, {
                        cx: cx,
                        cy: cy,
                        labelLines: labelLines,
                        n: n,
                        style: style
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/GraphCanvas.tsx",
                        lineNumber: 346,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodeSubLabel, {
                        cx: cx,
                        cy: cy,
                        labelLines: labelLines,
                        n: n,
                        style: style
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/GraphCanvas.tsx",
                        lineNumber: 347,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                lineNumber: 344,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodeWikiLink, {
                cx: cx,
                cy: cy,
                n: n,
                style: style
            }, void 0, false, {
                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                lineNumber: 349,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
_c7 = NodeMark;
function NodePill({ cx, cy, label, color }) {
    const text = short(label, 26);
    const w = Math.max(64, text.length * 8.2 + 22);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                x: cx - w / 2,
                y: cy - 14,
                width: w,
                height: 28,
                rx: 6,
                fill: `color-mix(in srgb, ${color} 13%, transparent)`,
                stroke: color,
                strokeWidth: 1.2
            }, void 0, false, {
                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                lineNumber: 359,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                x: cx,
                y: cy + 4.5,
                textAnchor: "middle",
                fill: color,
                fontSize: 12.5,
                fontWeight: 500,
                fontFamily: "var(--font-mono)",
                ...HALO,
                children: text
            }, void 0, false, {
                fileName: "[project]/src/components/query/GraphCanvas.tsx",
                lineNumber: 360,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/GraphCanvas.tsx",
        lineNumber: 358,
        columnNumber: 5
    }, this);
}
_c8 = NodePill;
function RectMark({ cx, cy, fill, stroke, sw }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
        x: cx - 9,
        y: cy - 9,
        width: 18,
        height: 18,
        rx: 4,
        fill: fill,
        stroke: stroke,
        strokeWidth: sw
    }, void 0, false, {
        fileName: "[project]/src/components/query/GraphCanvas.tsx",
        lineNumber: 366,
        columnNumber: 10
    }, this);
}
_c9 = RectMark;
const GROUP_LEGEND_KINDS = new Set([
    "issuer",
    "center",
    "sector"
]);
const NODE_LEGEND_ENTRIES = {
    chunk: [
        "source chunk",
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].success
    ],
    claim: [
        "claim",
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].accent
    ],
    evidence: [
        "evidence",
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].muted
    ],
    module: [
        "module",
        "#3a4a6a"
    ],
    driver: [
        "risk driver",
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].warning
    ],
    "point-bull": [
        "bull point",
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].success
    ],
    "point-bear": [
        "bear point",
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].critical
    ],
    metric: [
        "metric",
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].accent
    ]
};
function legendEntryForNode(node) {
    if (GROUP_LEGEND_KINDS.has(node.kind)) return node.group ? [
        node.group,
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$node$2d$style$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["hueFor"])(node.group)
    ] : null;
    if (node.kind.startsWith("finding")) return [
        "QA finding",
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].warning
    ];
    return NODE_LEGEND_ENTRIES[node.kind] ?? null;
}
function legendFor(nodes) {
    const out = [];
    const seen = new Set();
    const add = (label, color)=>{
        if (!seen.has(label)) {
            seen.add(label);
            out.push({
                label,
                color
            });
        }
    };
    for (const node of nodes){
        const entry = legendEntryForNode(node);
        if (entry) add(...entry);
        if (GROUP_LEGEND_KINDS.has(node.kind) && node.exposed) add("exposed", __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].warning);
    }
    return out.slice(0, 8);
}
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9;
__turbopack_context__.k.register(_c, "GraphCanvas");
__turbopack_context__.k.register(_c1, "EdgeLine");
__turbopack_context__.k.register(_c2, "NodeWikiLink");
__turbopack_context__.k.register(_c3, "NodeInteraction");
__turbopack_context__.k.register(_c4, "NodeShape");
__turbopack_context__.k.register(_c5, "NodeLabel");
__turbopack_context__.k.register(_c6, "NodeSubLabel");
__turbopack_context__.k.register(_c7, "NodeMark");
__turbopack_context__.k.register(_c8, "NodePill");
__turbopack_context__.k.register(_c9, "RectMark");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_0e30blq._.js.map