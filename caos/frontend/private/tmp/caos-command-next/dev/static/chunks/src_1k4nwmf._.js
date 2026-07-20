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
"[project]/src/components/query/LineageFlow.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LineageFlow",
    ()=>LineageFlow
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$node$2d$style$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/query/node-style.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
const COLUMN_TITLES = [
    "Raw Sources",
    "Analytical Inputs",
    "Core Claims",
    "Drivers & Modules",
    "Final Conclusion"
];
function edgeStroke(upstream, downstream) {
    if (upstream) return "var(--caos-accent)";
    if (downstream) return "var(--caos-warning)";
    return "var(--caos-border)";
}
function upstreamTrace(edge, focusId, lineage) {
    return lineage.upstream.has(edge.source) && (lineage.upstream.has(edge.target) || edge.target === focusId);
}
function downstreamTrace(edge, focusId, lineage) {
    return lineage.downstream.has(edge.target) && (lineage.downstream.has(edge.source) || edge.source === focusId);
}
function edgeVisualState(edge, focusId, lineage) {
    const sourceActive = edge.source === focusId;
    const targetActive = edge.target === focusId;
    const upstream = upstreamTrace(edge, focusId, lineage);
    const downstream = downstreamTrace(edge, focusId, lineage);
    const active = [
        sourceActive,
        targetActive,
        upstream,
        downstream
    ].some(Boolean);
    const upstreamStroke = [
        upstream,
        targetActive && lineage.upstream.has(edge.source)
    ].some(Boolean);
    const downstreamStroke = [
        downstream,
        sourceActive && lineage.downstream.has(edge.target)
    ].some(Boolean);
    return {
        active,
        dimmed: Boolean(focusId) && !active,
        stroke: edgeStroke(upstreamStroke, downstreamStroke)
    };
}
function edgeOpacity(active, dimmed) {
    if (active) return 0.8;
    return dimmed ? 0.04 : 0.3;
}
function LineageEdgePath({ edge, index, coordinates, focusId, lineage }) {
    const from = coordinates[edge.source];
    const to = coordinates[edge.target];
    if (!from || !to) return null;
    const visual = edgeVisualState(edge, focusId, lineage);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
        d: `M ${from.x} ${from.y} C ${from.x + 4} ${from.y}, ${to.x - 4} ${to.y}, ${to.x} ${to.y}`,
        vectorEffect: "non-scaling-stroke",
        fill: "none",
        stroke: visual.stroke,
        strokeWidth: visual.active ? 2.0 : 0.8,
        opacity: edgeOpacity(visual.active, visual.dimmed),
        style: {
            transition: "opacity 160ms"
        },
        className: "motion-reduce:transition-none"
    }, `edge-${index}`, false, {
        fileName: "[project]/src/components/query/LineageFlow.tsx",
        lineNumber: 63,
        columnNumber: 5
    }, this);
}
_c = LineageEdgePath;
function nodeBorderColor(focused, selected, upstream, downstream) {
    if (focused || selected || upstream) return "var(--caos-accent)";
    if (downstream) return "var(--caos-warning)";
    return "var(--caos-border)";
}
function LineageNodeCard({ node, focusId, selectedNodeId, lineage, onSelect, onHover }) {
    const nodeColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$node$2d$style$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["hueFor"])(node.group);
    const focused = node.id === focusId;
    const selected = node.id === selectedNodeId;
    const upstream = lineage.upstream.has(node.id);
    const downstream = lineage.downstream.has(node.id);
    const highlighted = focused || selected || upstream || downstream;
    const dimmed = Boolean(focusId) && !highlighted;
    const activateFromKeyboard = (event)=>{
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect?.(node);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        tabIndex: 0,
        role: "button",
        onClick: ()=>onSelect?.(node),
        onKeyDown: activateFromKeyboard,
        onFocus: ()=>onHover(node.id),
        onBlur: ()=>onHover(null),
        onMouseEnter: ()=>onHover(node.id),
        onMouseLeave: ()=>onHover(null),
        style: {
            opacity: dimmed ? 0.25 : 1.0,
            borderColor: nodeBorderColor(focused, selected, upstream, downstream)
        },
        className: `w-full max-w-[170px] bg-caos-panel/90 border rounded p-2 cursor-pointer transition-colors duration-150 motion-reduce:transition-none flex flex-col gap-1 text-left relative focus-ring ${focused || selected ? "shadow-pop bg-caos-elevated" : "hover:border-caos-accent/50"}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between gap-1 w-full",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-[8px] uppercase tracking-wider text-caos-muted font-mono truncate max-w-[70%]",
                        children: node.kind.replace("-", " ")
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/LineageFlow.tsx",
                        lineNumber: 113,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "inline-block w-1.5 h-1.5 rounded-full shrink-0",
                        style: {
                            backgroundColor: nodeColor === "var(--caos-muted)" ? "var(--caos-border)" : nodeColor
                        }
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/LineageFlow.tsx",
                        lineNumber: 114,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/query/LineageFlow.tsx",
                lineNumber: 112,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: `tabular text-caos-xs text-caos-text font-sans font-medium line-clamp-2 leading-tight break-words ${focused || selected ? "text-caos-accent" : ""}`,
                title: node.label,
                children: node.label
            }, void 0, false, {
                fileName: "[project]/src/components/query/LineageFlow.tsx",
                lineNumber: 116,
                columnNumber: 7
            }, this),
            node.group ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-3xs text-caos-muted font-mono truncate",
                children: node.group
            }, void 0, false, {
                fileName: "[project]/src/components/query/LineageFlow.tsx",
                lineNumber: 117,
                columnNumber: 21
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/LineageFlow.tsx",
        lineNumber: 100,
        columnNumber: 5
    }, this);
}
_c1 = LineageNodeCard;
function LineageColumn({ nodes, index, focusId, selectedNodeId, lineage, onSelect, onHover }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex-1 flex flex-col items-center justify-start py-4 border-r border-caos-border/20 last:border-r-0 select-none min-w-0",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-center mb-6 shrink-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-3xs uppercase tracking-wider text-caos-muted font-mono block",
                        children: [
                            "Step ",
                            index + 1
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/query/LineageFlow.tsx",
                        lineNumber: 129,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs font-semibold text-caos-text font-sans",
                        children: COLUMN_TITLES[index]
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/LineageFlow.tsx",
                        lineNumber: 130,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-3xs text-caos-muted font-mono block mt-0.5",
                        children: [
                            nodes.length,
                            " item",
                            nodes.length === 1 ? "" : "s"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/query/LineageFlow.tsx",
                        lineNumber: 131,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/query/LineageFlow.tsx",
                lineNumber: 128,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "w-full flex-1 flex flex-col justify-around items-center px-2 min-h-0 overflow-y-auto custom-scrollbar gap-2",
                children: nodes.map((node)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LineageNodeCard, {
                        node: node,
                        focusId: focusId,
                        selectedNodeId: selectedNodeId,
                        lineage: lineage,
                        onSelect: onSelect,
                        onHover: onHover
                    }, node.id, false, {
                        fileName: "[project]/src/components/query/LineageFlow.tsx",
                        lineNumber: 134,
                        columnNumber: 30
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/components/query/LineageFlow.tsx",
                lineNumber: 133,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/LineageFlow.tsx",
        lineNumber: 127,
        columnNumber: 5
    }, this);
}
_c2 = LineageColumn;
function LineageFlow({ graph, selectedNodeId, onSelectNode }) {
    _s();
    const [hoveredNodeId, setHoveredNodeId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Group nodes into 5 sequential columns/levels
    const columns = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "LineageFlow.useMemo[columns]": ()=>{
            const cols = Array.from({
                length: 5
            }, {
                "LineageFlow.useMemo[columns].cols": ()=>[]
            }["LineageFlow.useMemo[columns].cols"]);
            graph.nodes.forEach({
                "LineageFlow.useMemo[columns]": (n)=>{
                    let level;
                    switch(n.kind){
                        case "evidence":
                        case "chunk":
                            level = 0;
                            break;
                        case "metric":
                        case "point-bull":
                        case "point-bear":
                            level = 1;
                            break;
                        case "claim":
                        case "finding-min":
                        case "finding-mat":
                            level = 2;
                            break;
                        case "driver":
                        case "module":
                        case "finding-crit":
                            level = 3;
                            break;
                        case "center":
                        case "issuer":
                        case "sector":
                            level = 4;
                            break;
                        default:
                            level = Math.max(0, Math.min(4, Math.floor(n.x * 5)));
                            break;
                    }
                    cols[level].push(n);
                }
            }["LineageFlow.useMemo[columns]"]);
            // Sort nodes inside columns by kind then weight or label
            cols.forEach({
                "LineageFlow.useMemo[columns]": (col)=>{
                    col.sort({
                        "LineageFlow.useMemo[columns]": (a, b)=>{
                            if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
                            return a.label.localeCompare(b.label);
                        }
                    }["LineageFlow.useMemo[columns]"]);
                }
            }["LineageFlow.useMemo[columns]"]);
            return cols;
        }
    }["LineageFlow.useMemo[columns]"], [
        graph.nodes
    ]);
    // Map nodes to their position coordinates in the columns view
    const nodeCoordinates = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "LineageFlow.useMemo[nodeCoordinates]": ()=>{
            const coords = {};
            const colWidth = 100 / 5; // column width in percent
            columns.forEach({
                "LineageFlow.useMemo[nodeCoordinates]": (col, colIdx)=>{
                    const xPercent = colWidth * colIdx + colWidth / 2;
                    const count = col.length;
                    col.forEach({
                        "LineageFlow.useMemo[nodeCoordinates]": (node, nodeIdx)=>{
                            // Distribute y coordinates evenly in column height
                            const yPercent = count > 1 ? 10 + nodeIdx / (count - 1) * 80 : 50;
                            coords[node.id] = {
                                x: xPercent,
                                y: yPercent
                            };
                        }
                    }["LineageFlow.useMemo[nodeCoordinates]"]);
                }
            }["LineageFlow.useMemo[nodeCoordinates]"]);
            return coords;
        }
    }["LineageFlow.useMemo[nodeCoordinates]"], [
        columns
    ]);
    const activeFocusId = hoveredNodeId || selectedNodeId;
    const hasNodes = graph.nodes.length > 0;
    // Trace upstream (parents) and downstream (children) nodes using BFS/DFS
    const activeLineage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "LineageFlow.useMemo[activeLineage]": ()=>{
            if (!activeFocusId) {
                return {
                    upstream: new Set(),
                    downstream: new Set()
                };
            }
            const upstream = new Set();
            const downstream = new Set();
            // BFS Upstream
            let queue = [
                activeFocusId
            ];
            while(queue.length > 0){
                const current = queue.shift();
                graph.edges.forEach({
                    "LineageFlow.useMemo[activeLineage]": (e)=>{
                        if (e.target === current && !upstream.has(e.source) && e.source !== activeFocusId) {
                            upstream.add(e.source);
                            queue.push(e.source);
                        }
                    }
                }["LineageFlow.useMemo[activeLineage]"]);
            }
            // BFS Downstream
            queue = [
                activeFocusId
            ];
            while(queue.length > 0){
                const current = queue.shift();
                graph.edges.forEach({
                    "LineageFlow.useMemo[activeLineage]": (e)=>{
                        if (e.source === current && !downstream.has(e.target) && e.target !== activeFocusId) {
                            downstream.add(e.target);
                            queue.push(e.target);
                        }
                    }
                }["LineageFlow.useMemo[activeLineage]"]);
            }
            return {
                upstream,
                downstream
            };
        }
    }["LineageFlow.useMemo[activeLineage]"], [
        graph.edges,
        activeFocusId
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex-1 flex flex-col min-h-0 bg-caos-bg text-caos-text font-sans",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "p-2.5 border-b border-caos-border bg-caos-panel/40 shrink-0 select-none",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "tabular text-caos-3xs text-caos-muted font-mono uppercase tracking-wider",
                    children: "Lineage Flow · Select or focus a node to highlight its direct upstream evidence or downstream impact paths."
                }, void 0, false, {
                    fileName: "[project]/src/components/query/LineageFlow.tsx",
                    lineNumber: 261,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/query/LineageFlow.tsx",
                lineNumber: 260,
                columnNumber: 7
            }, this),
            !hasNodes ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 flex flex-col items-center justify-center text-center p-6 select-none",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "tabular text-caos-xs font-mono uppercase tracking-wider text-caos-text mb-1",
                        children: "Lineage"
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/LineageFlow.tsx",
                        lineNumber: 268,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "tabular text-caos-2xs text-caos-muted font-mono max-w-xs leading-normal",
                        children: "No lineage steps for this walk."
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/LineageFlow.tsx",
                        lineNumber: 269,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/query/LineageFlow.tsx",
                lineNumber: 267,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 flex min-h-0 relative overflow-hidden",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                        "aria-hidden": "true",
                        focusable: "false",
                        className: "absolute inset-0 w-full h-full pointer-events-none z-0",
                        viewBox: "0 0 100 100",
                        preserveAspectRatio: "none",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                            children: graph.edges.map((edge, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LineageEdgePath, {
                                    edge: edge,
                                    index: index,
                                    coordinates: nodeCoordinates,
                                    focusId: activeFocusId,
                                    lineage: activeLineage
                                }, `edge-${index}`, false, {
                                    fileName: "[project]/src/components/query/LineageFlow.tsx",
                                    lineNumber: 284,
                                    columnNumber: 47
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/src/components/query/LineageFlow.tsx",
                            lineNumber: 283,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/LineageFlow.tsx",
                        lineNumber: 276,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex-1 flex h-full justify-between items-stretch z-10 px-4",
                        children: columns.map((nodes, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LineageColumn, {
                                nodes: nodes,
                                index: index,
                                focusId: activeFocusId,
                                selectedNodeId: selectedNodeId,
                                lineage: activeLineage,
                                onSelect: onSelectNode,
                                onHover: setHoveredNodeId
                            }, index, false, {
                                fileName: "[project]/src/components/query/LineageFlow.tsx",
                                lineNumber: 290,
                                columnNumber: 42
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/LineageFlow.tsx",
                        lineNumber: 289,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/query/LineageFlow.tsx",
                lineNumber: 274,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/LineageFlow.tsx",
        lineNumber: 258,
        columnNumber: 5
    }, this);
}
_s(LineageFlow, "JfBOczCzq1Gyf+jVcsNj2mRp4Bc=");
_c3 = LineageFlow;
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "LineageEdgePath");
__turbopack_context__.k.register(_c1, "LineageNodeCard");
__turbopack_context__.k.register(_c2, "LineageColumn");
__turbopack_context__.k.register(_c3, "LineageFlow");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_1k4nwmf._.js.map