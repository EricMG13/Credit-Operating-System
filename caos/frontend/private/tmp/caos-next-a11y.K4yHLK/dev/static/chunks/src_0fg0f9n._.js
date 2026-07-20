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
"[project]/src/components/query/RelativeValueTable.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RelativeValueTable",
    ()=>RelativeValueTable
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// The tabular view of a query graph, with columns adapted to what the graph
// actually carries — never a raw node dump. A centred graph (peer set,
// contagion) gets Rank/Similarity relative to the focus; weight/confidence
// columns appear only when some node has them; in/out degree only where edge
// counts mean something to an analyst (the provenance DAG).
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$node$2d$style$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/query/node-style.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/sev.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
function countDegrees(graph) {
    const counts = Object.fromEntries(graph.nodes.map((node)=>[
            node.id,
            {
                in: 0,
                out: 0
            }
        ]));
    graph.edges.forEach((edge)=>{
        if (counts[edge.source]) counts[edge.source].out += 1;
        if (counts[edge.target]) counts[edge.target].in += 1;
    });
    return counts;
}
function buildRelations(graph, center) {
    const relations = {};
    if (!center) return relations;
    graph.edges.forEach((edge)=>{
        const other = edge.source === center.id ? edge.target : edge.target === center.id ? edge.source : null;
        if (!other) return;
        const rank = edge.label && /^#\d+$/.test(edge.label) ? Number(edge.label.slice(1)) : null;
        relations[other] = {
            rank,
            label: edge.label ?? null,
            weight: typeof edge.weight === "number" ? edge.weight : null
        };
    });
    return relations;
}
function deriveColumns(graph, relations) {
    const nodes = graph.nodes;
    const rels = Object.values(relations);
    return {
        kind: new Set(nodes.map((node)=>node.kind)).size > 1,
        group: nodes.some((node)=>node.group),
        detail: nodes.some((node)=>node.sub && node.sub !== node.group),
        rank: rels.some((rel)=>rel.rank !== null || rel.label !== null),
        relWeight: rels.some((rel)=>rel.weight !== null),
        weight: nodes.some((node)=>typeof node.weight === "number"),
        confidence: nodes.some((node)=>node.confidence),
        degree: graph.mode === "provenance"
    };
}
function nodeMatches(node, query) {
    return node.label.toLowerCase().includes(query) || node.id.toLowerCase().includes(query) || (node.kind || "").toLowerCase().includes(query) || (node.group || "").toLowerCase().includes(query) || (node.sub || "").toLowerCase().includes(query);
}
function rankSortValue(node, centerId, relations) {
    if (node.id === centerId) return -1;
    return relations[node.id]?.rank ?? Number.MAX_SAFE_INTEGER;
}
function weightSortValue(node, relations) {
    return relations[node.id]?.weight ?? node.weight ?? 0;
}
function degreeSortValue(node, field, degrees) {
    const degree = degrees[node.id];
    if (!degree) return 0;
    return field === "inDegree" ? degree.in : degree.out;
}
function sortValue(node, field, centerId, relations, degrees) {
    const textValues = {
        label: node.label,
        kind: node.kind || "",
        group: node.group || "",
        detail: node.sub || "",
        confidence: node.confidence || ""
    };
    const textValue = textValues[field];
    if (textValue !== undefined) return textValue;
    if (field === "rank") {
        return rankSortValue(node, centerId, relations);
    }
    if (field === "weight") return weightSortValue(node, relations);
    if (field === "inDegree" || field === "outDegree") return degreeSortValue(node, field, degrees);
    return "";
}
function processNodes(nodes, filterText, field, direction, centerId, relations, degrees) {
    const query = filterText.toLowerCase().trim();
    const result = query ? nodes.filter((node)=>nodeMatches(node, query)) : [
        ...nodes
    ];
    return result.sort((left, right)=>{
        const a = sortValue(left, field, centerId, relations, degrees);
        const b = sortValue(right, field, centerId, relations, degrees);
        if (a === b) return 0;
        const order = a < b ? -1 : 1;
        return direction === "asc" ? order : -order;
    });
}
function SortIndicator({ active, direction }) {
    if (!active) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "opacity-25 font-normal ml-1",
        children: "▲"
    }, void 0, false, {
        fileName: "[project]/src/components/query/RelativeValueTable.tsx",
        lineNumber: 129,
        columnNumber: 23
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "text-caos-accent ml-1",
        children: direction === "asc" ? "▲" : "▼"
    }, void 0, false, {
        fileName: "[project]/src/components/query/RelativeValueTable.tsx",
        lineNumber: 130,
        columnNumber: 10
    }, this);
}
_c = SortIndicator;
function SortHeader({ field, className, children, sortBy, sortDir, onSort }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
        tabIndex: 0,
        role: "button",
        onClick: ()=>onSort(field),
        onKeyDown: (event)=>{
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSort(field);
            }
        },
        className: `p-2.5 cursor-pointer hover:text-caos-text hover:bg-caos-elevated/40 transition-colors focus-ring ${className ?? ""}`,
        children: [
            children,
            " ",
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SortIndicator, {
                active: sortBy === field,
                direction: sortDir
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 136,
                columnNumber: 18
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/RelativeValueTable.tsx",
        lineNumber: 135,
        columnNumber: 5
    }, this);
}
_c1 = SortHeader;
function RelativeValueToolbar({ filteredCount, totalCount, filterText, setFilterText }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center justify-between p-2.5 border-b border-caos-border bg-caos-panel/40 shrink-0 gap-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xs text-caos-muted font-mono uppercase tracking-wider",
                children: [
                    "Nodes: ",
                    filteredCount,
                    " / ",
                    totalCount
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 144,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-1.5 bg-caos-panel border border-caos-border rounded px-2 py-0.5 focus-within:border-caos-accent/70 transition-caos",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-caos-muted text-caos-xs",
                        "aria-hidden": true,
                        children: "⌕"
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                        lineNumber: 146,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        name: "relative-value-node-filter",
                        autoComplete: "off",
                        value: filterText,
                        onChange: (event)=>setFilterText(event.target.value),
                        placeholder: "Filter by label, kind, group…",
                        "aria-label": "Filter nodes",
                        className: "bg-transparent outline-none border-none tabular text-caos-xs text-caos-text placeholder:text-caos-muted w-48 font-mono"
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                        lineNumber: 147,
                        columnNumber: 9
                    }, this),
                    filterText ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>setFilterText(""),
                        className: "text-caos-muted hover:text-caos-text text-caos-xs font-mono px-1",
                        "aria-label": "Clear filter",
                        children: "×"
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                        lineNumber: 148,
                        columnNumber: 23
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 145,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/RelativeValueTable.tsx",
        lineNumber: 143,
        columnNumber: 5
    }, this);
}
_c2 = RelativeValueToolbar;
function NodeIdentityCell({ node, isCenter, onSelect, selected }) {
    const nodeColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$node$2d$style$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["hueFor"])(node.group);
    const muted = nodeColor === "var(--caos-muted)";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
        className: "p-2.5 pl-4 font-sans font-medium text-caos-text",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
            type: "button",
            onClick: onSelect,
            className: `flex w-full items-center gap-2 rounded-sm text-left focus-ring ${selected ? "caos-selected" : ""}`,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-current",
                    style: {
                        color: muted ? "var(--caos-border)" : nodeColor,
                        backgroundColor: muted ? "transparent" : `${nodeColor}33`
                    }
                }, void 0, false, {
                    fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                    lineNumber: 160,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "truncate max-w-sm",
                    title: node.label,
                    children: node.label
                }, void 0, false, {
                    fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                    lineNumber: 161,
                    columnNumber: 9
                }, this),
                isCenter ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "tabular text-caos-3xs uppercase tracking-wide text-caos-accent border border-caos-accent/40 rounded px-1 py-px shrink-0",
                    children: "focus"
                }, void 0, false, {
                    fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                    lineNumber: 162,
                    columnNumber: 21
                }, this) : null
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/query/RelativeValueTable.tsx",
            lineNumber: 159,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/query/RelativeValueTable.tsx",
        lineNumber: 158,
        columnNumber: 5
    }, this);
}
_c3 = NodeIdentityCell;
function WeightCell({ weight }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
        className: "p-2.5 text-right font-mono text-caos-text",
        children: typeof weight === "number" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "inline-flex items-center gap-1.5",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "text-caos-2xs",
                    children: [
                        (weight * 100).toFixed(0),
                        "%"
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                    lineNumber: 171,
                    columnNumber: 88
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "inline-block w-8 h-1.5 bg-caos-border/50 rounded-sm overflow-hidden",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "block h-full bg-caos-accent",
                        style: {
                            width: `${Math.min(100, weight * 100)}%`
                        }
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                        lineNumber: 171,
                        columnNumber: 241
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                    lineNumber: 171,
                    columnNumber: 155
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/query/RelativeValueTable.tsx",
            lineNumber: 171,
            columnNumber: 37
        }, this) : "—"
    }, void 0, false, {
        fileName: "[project]/src/components/query/RelativeValueTable.tsx",
        lineNumber: 170,
        columnNumber: 5
    }, this);
}
_c4 = WeightCell;
function ConfidenceCell({ confidence }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
        className: "p-2.5 text-center",
        children: confidence ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "inline-block text-caos-3xs font-semibold px-1.5 py-0.5 rounded border leading-none",
            style: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sevSurface"])(confidence === "High" ? "ok" : "warning", {
                border: 33,
                wash: 7
            }),
            children: confidence
        }, void 0, false, {
            fileName: "[project]/src/components/query/RelativeValueTable.tsx",
            lineNumber: 179,
            columnNumber: 21
        }, this) : "—"
    }, void 0, false, {
        fileName: "[project]/src/components/query/RelativeValueTable.tsx",
        lineNumber: 178,
        columnNumber: 5
    }, this);
}
_c5 = ConfidenceCell;
function NodeMetadataCells({ node, columns }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            columns.kind ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                className: "p-2.5 text-caos-muted text-caos-2xs uppercase tracking-wide",
                children: node.kind.replace("-", " ")
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 187,
                columnNumber: 23
            }, this) : null,
            columns.group ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                className: "p-2.5 text-caos-muted truncate",
                title: node.group || undefined,
                children: node.group || "—"
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 188,
                columnNumber: 24
            }, this) : null,
            columns.detail ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                className: "p-2.5 text-caos-muted truncate",
                title: node.sub || undefined,
                children: node.sub && node.sub !== node.group ? node.sub : "—"
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 189,
                columnNumber: 25
            }, this) : null
        ]
    }, void 0, true);
}
_c6 = NodeMetadataCells;
function NodeMetricCells({ node, columns, relation, isCenter, degrees }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            columns.rank ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                className: "p-2.5 text-center text-caos-text",
                children: isCenter ? "—" : relation?.label ?? "—"
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 197,
                columnNumber: 23
            }, this) : null,
            columns.relWeight || columns.weight ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(WeightCell, {
                weight: relation?.weight ?? node.weight
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 198,
                columnNumber: 46
            }, this) : null,
            columns.confidence ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ConfidenceCell, {
                confidence: node.confidence
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 199,
                columnNumber: 29
            }, this) : null,
            columns.degree ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                className: "p-2.5 text-center text-caos-muted",
                children: degrees[node.id]?.in ?? 0
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 200,
                columnNumber: 25
            }, this) : null,
            columns.degree ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                className: "p-2.5 text-center text-caos-muted",
                children: degrees[node.id]?.out ?? 0
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 201,
                columnNumber: 25
            }, this) : null
        ]
    }, void 0, true);
}
_c7 = NodeMetricCells;
function RelativeValueRow({ node, columns, centerId, relations, degrees, selectedNodeId, onSelectNode }) {
    const relation = relations[node.id];
    const isCenter = centerId === node.id;
    const select = ()=>onSelectNode?.(node);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
        className: `transition-colors hover:bg-caos-elevated/50 ${selectedNodeId === node.id ? "bg-caos-elevated" : ""}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodeIdentityCell, {
                node: node,
                isCenter: isCenter,
                onSelect: select,
                selected: selectedNodeId === node.id
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 212,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodeMetadataCells, {
                node: node,
                columns: columns
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 213,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodeMetricCells, {
                node: node,
                columns: columns,
                relation: relation,
                isCenter: isCenter,
                degrees: degrees
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 214,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/RelativeValueTable.tsx",
        lineNumber: 211,
        columnNumber: 5
    }, this);
}
_c8 = RelativeValueRow;
function columnCount(columns) {
    return 1 + Number(columns.kind) + Number(columns.group) + Number(columns.detail) + Number(columns.rank) + Number(columns.relWeight) + Number(columns.weight) + Number(columns.confidence) + 2 * Number(columns.degree);
}
function MetadataHeaders({ columns, ...sort }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SortHeader, {
                field: "label",
                className: "pl-4",
                ...sort,
                children: "Node / Label"
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 234,
                columnNumber: 7
            }, this),
            columns.kind ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SortHeader, {
                field: "kind",
                className: "w-28",
                ...sort,
                children: "Kind"
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 235,
                columnNumber: 23
            }, this) : null,
            columns.group ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SortHeader, {
                field: "group",
                className: "w-32",
                ...sort,
                children: "Group"
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 236,
                columnNumber: 24
            }, this) : null,
            columns.detail ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SortHeader, {
                field: "detail",
                className: "w-40",
                ...sort,
                children: "Detail"
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 237,
                columnNumber: 25
            }, this) : null
        ]
    }, void 0, true);
}
_c9 = MetadataHeaders;
function MetricHeaders({ columns, ...sort }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            columns.rank ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SortHeader, {
                field: "rank",
                className: "text-center w-20",
                ...sort,
                children: "Rank"
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 245,
                columnNumber: 23
            }, this) : null,
            columns.relWeight ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SortHeader, {
                field: "weight",
                className: "text-right w-28",
                ...sort,
                children: "Similarity"
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 246,
                columnNumber: 28
            }, this) : null,
            columns.weight && !columns.relWeight ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SortHeader, {
                field: "weight",
                className: "text-right w-24",
                ...sort,
                children: "Weight"
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 247,
                columnNumber: 47
            }, this) : null,
            columns.confidence ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SortHeader, {
                field: "confidence",
                className: "text-center w-24",
                ...sort,
                children: "Conf."
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 248,
                columnNumber: 29
            }, this) : null,
            columns.degree ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SortHeader, {
                field: "inDegree",
                className: "text-center w-16",
                ...sort,
                children: "In"
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 249,
                columnNumber: 25
            }, this) : null,
            columns.degree ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SortHeader, {
                field: "outDegree",
                className: "text-center w-16",
                ...sort,
                children: "Out"
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 250,
                columnNumber: 25
            }, this) : null
        ]
    }, void 0, true);
}
_c10 = MetricHeaders;
function RelativeValueGrid({ nodes, columns, centerId, relations, degrees, selectedNodeId, onSelectNode, sortBy, sortDir, onSort }) {
    const headerProps = {
        columns,
        sortBy,
        sortDir,
        onSort
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex-1 overflow-auto min-h-0",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
            className: "rv-table w-full border-collapse text-left text-caos-sm tabular",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                    className: "sticky top-0 bg-caos-panel border-b border-caos-border z-10",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                        className: "text-caos-3xs uppercase tracking-wider text-caos-muted font-mono select-none",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MetadataHeaders, {
                                ...headerProps
                            }, void 0, false, {
                                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                                lineNumber: 262,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MetricHeaders, {
                                ...headerProps
                            }, void 0, false, {
                                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                                lineNumber: 263,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                        lineNumber: 261,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                    lineNumber: 260,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                    className: "divide-y divide-caos-border/40 font-mono text-caos-xs",
                    children: nodes.length ? nodes.map((node)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RelativeValueRow, {
                            node: node,
                            columns: columns,
                            centerId: centerId,
                            relations: relations,
                            degrees: degrees,
                            selectedNodeId: selectedNodeId,
                            onSelectNode: onSelectNode
                        }, node.id, false, {
                            fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                            lineNumber: 267,
                            columnNumber: 47
                        }, this)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                            colSpan: columnCount(columns),
                            className: "p-8 text-center text-caos-muted",
                            children: "No matching nodes found"
                        }, void 0, false, {
                            fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                            lineNumber: 267,
                            columnNumber: 239
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                        lineNumber: 267,
                        columnNumber: 235
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                    lineNumber: 266,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/query/RelativeValueTable.tsx",
            lineNumber: 259,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/query/RelativeValueTable.tsx",
        lineNumber: 258,
        columnNumber: 5
    }, this);
}
_c11 = RelativeValueGrid;
function RelativeValueTable({ graph, selectedNodeId, onSelectNode }) {
    _s();
    const [filterText, setFilterText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    // A centred graph (peer set, contagion) exists to rank against the focus, so
    // open on Rank asc (#1, #2, #3…) rather than alphabetical label — the ranking
    // is the point. Non-centred graphs still open on label.
    const [sortBy, setSortBy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "RelativeValueTable.useState": ()=>graph.nodes.some({
                "RelativeValueTable.useState": (n)=>n.kind === "center" || n.center
            }["RelativeValueTable.useState"]) ? "rank" : "label"
    }["RelativeValueTable.useState"]);
    const [sortDir, setSortDir] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("asc");
    const degrees = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "RelativeValueTable.useMemo[degrees]": ()=>countDegrees(graph)
    }["RelativeValueTable.useMemo[degrees]"], [
        graph
    ]);
    // Relation to the focus node, when the graph has one (peer set, contagion).
    const center = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "RelativeValueTable.useMemo[center]": ()=>graph.nodes.find({
                "RelativeValueTable.useMemo[center]": (n)=>n.kind === "center" || n.center
            }["RelativeValueTable.useMemo[center]"])
    }["RelativeValueTable.useMemo[center]"], [
        graph
    ]);
    const relById = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "RelativeValueTable.useMemo[relById]": ()=>buildRelations(graph, center)
    }["RelativeValueTable.useMemo[relById]"], [
        graph,
        center
    ]);
    // Column presence, driven by the payload.
    const cols = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "RelativeValueTable.useMemo[cols]": ()=>deriveColumns(graph, relById)
    }["RelativeValueTable.useMemo[cols]"], [
        graph,
        relById
    ]);
    const handleSort = (field)=>{
        if (sortBy === field) {
            setSortDir((d)=>d === "asc" ? "desc" : "asc");
        } else {
            setSortBy(field);
            setSortDir(field === "label" || field === "rank" ? "asc" : "desc");
        }
    };
    const processedNodes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "RelativeValueTable.useMemo[processedNodes]": ()=>processNodes(graph.nodes, filterText, sortBy, sortDir, center?.id, relById, degrees)
    }["RelativeValueTable.useMemo[processedNodes]"], [
        graph.nodes,
        filterText,
        sortBy,
        sortDir,
        center?.id,
        relById,
        degrees
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex-1 flex flex-col min-h-0 bg-caos-bg text-caos-text font-sans",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RelativeValueToolbar, {
                filteredCount: processedNodes.length,
                totalCount: graph.nodes.length,
                filterText: filterText,
                setFilterText: setFilterText
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 313,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RelativeValueGrid, {
                nodes: processedNodes,
                columns: cols,
                centerId: center?.id,
                relations: relById,
                degrees: degrees,
                selectedNodeId: selectedNodeId,
                onSelectNode: onSelectNode,
                sortBy: sortBy,
                sortDir: sortDir,
                onSort: handleSort
            }, void 0, false, {
                fileName: "[project]/src/components/query/RelativeValueTable.tsx",
                lineNumber: 314,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/RelativeValueTable.tsx",
        lineNumber: 312,
        columnNumber: 5
    }, this);
}
_s(RelativeValueTable, "x42kXjPSWDVOCnSigEyIUshv5NU=");
_c12 = RelativeValueTable;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c10, _c11, _c12;
__turbopack_context__.k.register(_c, "SortIndicator");
__turbopack_context__.k.register(_c1, "SortHeader");
__turbopack_context__.k.register(_c2, "RelativeValueToolbar");
__turbopack_context__.k.register(_c3, "NodeIdentityCell");
__turbopack_context__.k.register(_c4, "WeightCell");
__turbopack_context__.k.register(_c5, "ConfidenceCell");
__turbopack_context__.k.register(_c6, "NodeMetadataCells");
__turbopack_context__.k.register(_c7, "NodeMetricCells");
__turbopack_context__.k.register(_c8, "RelativeValueRow");
__turbopack_context__.k.register(_c9, "MetadataHeaders");
__turbopack_context__.k.register(_c10, "MetricHeaders");
__turbopack_context__.k.register(_c11, "RelativeValueGrid");
__turbopack_context__.k.register(_c12, "RelativeValueTable");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_0fg0f9n._.js.map