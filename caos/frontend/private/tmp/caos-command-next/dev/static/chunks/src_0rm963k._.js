(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/components/reports/EvChip.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EvChip",
    ()=>EvChip
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/StatusGlyph.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$evidence$2d$sync$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/evidence-sync.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$evidence$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/reports/evidence.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
function EvChip({ id, onOpen }) {
    _s();
    const open = (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$evidence$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EVIDENCE"][id] || {}).status === "open";
    // Publish this id on hover/focus and highlight when it (or any other chip
    // citing the same id, or its source driver) is the active selection.
    const { active, setActive } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$evidence$2d$sync$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEvidenceSync"])();
    const synced = active === id;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        onClick: (e)=>{
            e.stopPropagation();
            onOpen(id);
        },
        onMouseEnter: ()=>setActive(id),
        onMouseLeave: ()=>setActive(null),
        onFocus: ()=>setActive(id),
        onBlur: ()=>setActive(null),
        title: "Open source for " + id,
        "aria-label": "Open source for " + id,
        className: "tabular text-caos-xs inline-flex items-center justify-center min-w-6 min-h-6 px-1 rounded border transition-caos whitespace-nowrap hover:bg-caos-elevated focus-ring",
        style: {
            color: open ? "var(--caos-warning)" : "var(--caos-accent)",
            borderColor: synced ? "var(--caos-accent)" : open ? "color-mix(in srgb, var(--caos-warning) 50%, transparent)" : "color-mix(in srgb, var(--caos-accent) 40%, transparent)",
            background: synced ? "color-mix(in srgb, var(--caos-accent) 18%, transparent)" : "color-mix(in srgb, var(--caos-accent) 7%, transparent)",
            boxShadow: synced ? "0 0 0 1px var(--caos-accent)" : undefined
        },
        children: [
            id,
            open ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                kind: "warning",
                className: "ml-0.5"
            }, void 0, false, {
                fileName: "[project]/src/components/reports/EvChip.tsx",
                lineNumber: 30,
                columnNumber: 19
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/reports/EvChip.tsx",
        lineNumber: 14,
        columnNumber: 5
    }, this);
}
_s(EvChip, "tGEm6rQ0cLTguuiq+kbhW9ZqXEE=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$evidence$2d$sync$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEvidenceSync"]
    ];
});
_c = EvChip;
var _c;
__turbopack_context__.k.register(_c, "EvChip");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/StatCard.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StatCard",
    ()=>StatCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// Shared stat card: a value with a label and an optional sub-line, with an
// optional severity tint on its border + value color. One source for the
// hand-rolled KPI / metric cards in the Deep-Dive ModuleView and Covenants tab.
// Severity tint goes through sevSurface() — which fixes the latent
// `color + "44"` bug that silently dropped the tint for CSS-var severities.
// Phase 0 foundation — adopted across surfaces in Phase 1.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/sev.ts [app-client] (ecmascript)");
;
;
function StatCard({ value, label, sub, sev, size = "metric", className = "" }) {
    const tint = sev ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sevSurface"])(sev) : null;
    const valueTitle = typeof value === "string" || typeof value === "number" ? String(value) : undefined;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rounded border bg-caos-bg px-3 py-2 min-w-0 " + className,
        style: tint ? {
            borderColor: tint.borderColor
        } : undefined,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "tabular truncate " + (size === "hero" ? "text-caos-hero" : "text-caos-metric"),
                style: {
                    color: tint ? tint.color : "var(--caos-text)"
                },
                title: valueTitle,
                children: value
            }, void 0, false, {
                fileName: "[project]/src/components/shared/StatCard.tsx",
                lineNumber: 33,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-caos-sm text-caos-muted mt-0.5",
                children: label
            }, void 0, false, {
                fileName: "[project]/src/components/shared/StatCard.tsx",
                lineNumber: 40,
                columnNumber: 7
            }, this),
            sub ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "tabular text-caos-2xs text-caos-muted mt-0.5",
                children: sub
            }, void 0, false, {
                fileName: "[project]/src/components/shared/StatCard.tsx",
                lineNumber: 41,
                columnNumber: 14
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/StatCard.tsx",
        lineNumber: 29,
        columnNumber: 5
    }, this);
}
_c = StatCard;
var _c;
__turbopack_context__.k.register(_c, "StatCard");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/SectionHeader.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Shared inner section header: the small uppercase "CP-xx · label" strip with
// an optional right-aligned meta slot, used inside panels and cards across the
// Deep-Dive tabs. Distinct from the 32px <Panel> chrome header — this is the
// header *within* a content card. Phase 0 foundation.
__turbopack_context__.s([
    "SectionHeader",
    ()=>SectionHeader
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
;
function SectionHeader({ title, right, className = "" }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "px-3 py-2 border-b border-caos-border flex items-center gap-2 " + className,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-xs uppercase tracking-wider text-caos-muted",
                children: title
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SectionHeader.tsx",
                lineNumber: 17,
                columnNumber: 7
            }, this),
            right ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-xs text-caos-muted ml-auto",
                children: right
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SectionHeader.tsx",
                lineNumber: 18,
                columnNumber: 16
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/SectionHeader.tsx",
        lineNumber: 16,
        columnNumber: 5
    }, this);
}
_c = SectionHeader;
var _c;
__turbopack_context__.k.register(_c, "SectionHeader");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/charts/G2Chart.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "G2Chart",
    ()=>G2Chart,
    "normalizeFy",
    ()=>normalizeFy
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// G2 v5 chart wrapper (port of design bundle shared/charts.jsx, deployed from
// the antv-g2-chart skill): spec-mode only, single chart.options() call,
// classicDark theme on app surfaces / classic on paper reports, transparent
// viewFill. Sizes from clientWidth and rebuilds on container resize.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
const CAOS_G2_THEMES = {
    dark: {
        type: "classicDark",
        view: {
            viewFill: "transparent"
        }
    },
    paper: {
        type: "classic",
        view: {
            viewFill: "transparent"
        }
    }
};
function mapChanged(values, transform) {
    let changed = false;
    const next = values.map((value)=>{
        const result = transform(value);
        if (result !== value) changed = true;
        return result;
    });
    return changed ? next : values;
}
// Period labels can arrive lowercase from run payloads ("fy2024" → "FY2024").
// Only string VALUES inside `data` subtrees are rewritten; object keys and the
// rest of the spec (encode field names like x:"fy", scale keys, formatters)
// must stay verbatim — uppercasing encode.x once detached it from the data key
// and collapsed every period onto a single "FY" category.
function normalizeFyValues(v) {
    if (typeof v === "string") {
        const res = v.replace(/\bfy/g, "FY");
        return res === v ? v : res;
    }
    if (Array.isArray(v)) {
        return mapChanged(v, normalizeFyValues);
    }
    if (v && typeof v === "object") {
        const entries = Object.entries(v);
        const nextEntries = mapChanged(entries, ([key, value])=>{
            const result = normalizeFyValues(value);
            return result === value ? [
                key,
                value
            ] : [
                key,
                result
            ];
        });
        return nextEntries === entries ? v : Object.fromEntries(nextEntries);
    }
    return v;
}
function normalizeFy(spec) {
    const walk = (v)=>{
        if (Array.isArray(v)) {
            return mapChanged(v, walk);
        }
        if (v && typeof v === "object") {
            const entries = Object.entries(v);
            const nextEntries = mapChanged(entries, ([key, value])=>{
                const result = key === "data" ? normalizeFyValues(value) : walk(value);
                return result === value ? [
                    key,
                    value
                ] : [
                    key,
                    result
                ];
            });
            return nextEntries === entries ? v : Object.fromEntries(nextEntries);
        }
        return v;
    };
    return walk(spec);
}
function G2Chart({ spec, height = 220, mode = "dark", className = "", style }) {
    _s();
    const ref = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "G2Chart.useEffect": ()=>{
            const el = ref.current;
            if (!el) return;
            let chart = null;
            let ChartCtor = null;
            let dead = false;
            let timer;
            let settleTimer;
            let builtWidth = -1;
            // Size from clientWidth (layout px). Wait on timers (not rAF — rAF never
            // fires in hidden/backgrounded frames) for the width to hold still before
            // the first build, then rebuild on real container resizes.
            // A failed render used to be swallowed silently, leaving a blank (or
            // subtly wrong) frame nobody notices. Show a terse dead-frame instead so
            // a broken spec is visible in QA. Failure is deterministic per spec, so
            // no retry — a spec/mode change re-runs the effect anyway.
            const fail = {
                "G2Chart.useEffect.fail": ()=>{
                    if (dead) return;
                    try {
                        chart?.destroy();
                    } catch  {}
                    chart = null;
                    el.innerHTML = "";
                    const f = document.createElement("div");
                    f.textContent = "CHART UNAVAILABLE";
                    f.style.cssText = "display:flex;align-items:center;justify-content:center;height:100%;" + "font-size:10px;letter-spacing:.08em;color:var(--caos-muted);border:1px dashed color-mix(in srgb, var(--caos-muted) 35%, transparent);border-radius:2px;";
                    el.appendChild(f);
                }
            }["G2Chart.useEffect.fail"];
            const build = {
                "G2Chart.useEffect.build": ()=>{
                    if (dead || !ChartCtor) return;
                    try {
                        chart?.destroy();
                    } catch  {}
                    el.innerHTML = "";
                    builtWidth = el.clientWidth || 320;
                    try {
                        chart = new ChartCtor({
                            container: el,
                            width: builtWidth,
                            height
                        });
                        const normalized = normalizeFy(spec);
                        // globals.css @media only reaches CSS transitions — G2 canvas
                        // animation needs an explicit opt-out.
                        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
                        chart.options({
                            theme: CAOS_G2_THEMES[mode] || CAOS_G2_THEMES.dark,
                            // Enter animation draws through rAF; an occluded/backgrounded pane
                            // starves rAF and freezes marks mid-flight — intervals at correct
                            // offsets but a fraction of their extent, labels already at final
                            // positions (the 2026-07-16 "seniority stack scattered on paper"
                            // read). Default off so every painted frame is final geometry; a
                            // spec may opt back in, and reduced-motion still hard-disables.
                            animate: false,
                            ...normalized,
                            ...reduceMotion ? {
                                animate: false
                            } : {},
                            tooltip: {
                                ...normalized.tooltip,
                                css: {
                                    ".g2-tooltip": {
                                        color: mode === "paper" ? "#16161e" : "#e6e6ef",
                                        fontWeight: 700,
                                        textTransform: "uppercase"
                                    },
                                    ...normalized.tooltip?.css || {}
                                }
                            }
                        });
                        const p = chart.render();
                        if (p && typeof p.catch === "function") p.catch(fail);
                    } catch  {
                        fail();
                    }
                }
            }["G2Chart.useEffect.build"];
            let last = -1, stable = 0, tries = 0;
            const handleResize = {
                "G2Chart.useEffect.handleResize": ()=>{
                    clearTimeout(timer);
                    timer = setTimeout({
                        "G2Chart.useEffect.handleResize": ()=>{
                            if (dead || !chart) return;
                            const cw = el.clientWidth || 320;
                            if (Math.abs(cw - builtWidth) > 1) build();
                        }
                    }["G2Chart.useEffect.handleResize"], 120);
                }
            }["G2Chart.useEffect.handleResize"];
            const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(handleResize);
            const settle = {
                "G2Chart.useEffect.settle": ()=>{
                    if (dead) return;
                    const cw = el.clientWidth;
                    if (cw > 0 && cw === last) stable++;
                    else {
                        stable = 0;
                        last = cw;
                    }
                    tries++;
                    if (stable >= 2 || tries > 24) {
                        build();
                        if (ro) ro.observe(el);
                        else window.addEventListener("resize", handleResize);
                    } else settleTimer = setTimeout(settle, 32);
                }
            }["G2Chart.useEffect.settle"];
            // Reserved-height skeleton while the import + width-settle run — the
            // container kept its height but painted an empty hole, then the chart
            // popped in. build()/fail() both clear innerHTML, so this swaps out.
            if (!el.childElementCount) {
                const skeleton = document.createElement("div");
                skeleton.setAttribute("aria-hidden", "true");
                skeleton.style.cssText = "height:100%;border-radius:2px;" + "background:color-mix(in srgb, var(--caos-elevated) 55%, transparent);";
                el.appendChild(skeleton);
            }
            // Defer loading g2 until a chart actually mounts; then start sizing.
            // A failed dynamic import (network blip, CDN issue, chunk-load error
            // after a deploy) must not become an unhandled rejection with the chart
            // silently never rendering — route it through the same dead-frame `fail`
            // as a failed build/render.
            __turbopack_context__.A("[project]/node_modules/@antv/g2/esm/index.js [app-client] (ecmascript, async loader)").then({
                "G2Chart.useEffect": (m)=>{
                    if (dead) return;
                    ChartCtor = m.Chart;
                    settleTimer = setTimeout(settle, 0);
                }
            }["G2Chart.useEffect"]).catch(fail);
            return ({
                "G2Chart.useEffect": ()=>{
                    dead = true;
                    clearTimeout(settleTimer);
                    clearTimeout(timer);
                    ro?.disconnect();
                    window.removeEventListener("resize", handleResize);
                    try {
                        chart?.destroy();
                    } catch  {}
                }
            })["G2Chart.useEffect"];
        }
    }["G2Chart.useEffect"], [
        spec,
        height,
        mode
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: ref,
        className: className,
        style: {
            height,
            minWidth: 0,
            overflow: "hidden",
            ...style
        }
    }, void 0, false, {
        fileName: "[project]/src/components/charts/G2Chart.tsx",
        lineNumber: 218,
        columnNumber: 10
    }, this);
}
_s(G2Chart, "8uVE59eA/r6b92xF80p7sH8rXLk=");
_c = G2Chart;
var _c;
__turbopack_context__.k.register(_c, "G2Chart");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/charts/SemanticVisualization.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SemanticVisualization",
    ()=>SemanticVisualization
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$charts$2f$G2Chart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/charts/G2Chart.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$DominantTableRegion$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/DominantTableRegion.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
function cellText(value) {
    if (value === null) return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
}
// A raw GUID as a source id reads as noise; show a short, titled id. Non-uuid
// ids (e.g. "rv-screen") pass through unchanged.
function sourceLabel(id) {
    return /^[0-9a-f-]{20,}$/i.test(id) ? {
        text: `ID ${id.slice(0, 8)}…`,
        title: id
    } : {
        text: id
    };
}
// Count/interval charts over a tiny integer domain get fractional y-ticks and
// rotated x-labels from G2's autoscaling. Derive an honest axis: integer-only
// y-labels, horizontal x-labels, and real titles from the accessible table's
// column labels. An explicit spec.chart.axis/scale still wins (merged under).
function deriveAxis(spec) {
    const enc = spec.chart;
    const yKey = enc.encode?.y;
    const xKey = enc.encode?.x;
    const isCount = !!yKey && [
        "interval",
        "bar",
        "stacked-bar"
    ].includes(enc.type ?? "") && spec.data.every((d)=>Number.isInteger(d[yKey]));
    if (!isCount) return {};
    const label = (key)=>spec.tabularFallback.columns.find((c)=>c.key === key)?.label;
    return {
        axis: {
            x: {
                title: label(xKey) ?? false,
                labelAutoRotate: false
            },
            y: {
                title: label(yKey) ?? false,
                labelFormatter: (v)=>Number.isInteger(Number(v)) ? String(v) : ""
            }
        },
        scale: {
            y: {
                domainMin: 0,
                nice: false
            }
        }
    };
}
function SemanticVisualization({ spec, height = 220, mode = "dark", headingLevel = 3 }) {
    _s();
    const [showTable, setShowTable] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const summaryId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    const tableId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    const chartSpec = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "SemanticVisualization.useMemo[chartSpec]": ()=>({
                ...deriveAxis(spec),
                ...spec.chart,
                data: spec.data
            })
    }["SemanticVisualization.useMemo[chartSpec]"], [
        spec
    ]);
    const Heading = headingLevel === 2 ? "h2" : "h3";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("figure", {
        className: "semantic-visualization",
        "data-kind": spec.kind,
        "data-mode": mode,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("figcaption", {
                className: "semantic-visualization__header",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Heading, {
                                children: spec.title
                            }, void 0, false, {
                                fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                                lineNumber: 107,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "semantic-visualization__meta",
                                children: [
                                    spec.unit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: [
                                            "Unit ",
                                            spec.unit
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                                        lineNumber: 109,
                                        columnNumber: 26
                                    }, this) : null,
                                    spec.asOf ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        children: [
                                            "As of ",
                                            spec.asOf
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                                        lineNumber: 110,
                                        columnNumber: 26
                                    }, this) : null
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                                lineNumber: 108,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                        lineNumber: 106,
                        columnNumber: 9
                    }, this),
                    spec.status ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "semantic-visualization__status",
                        "data-tone": spec.status.tone,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                "aria-hidden": "true",
                                children: "●"
                            }, void 0, false, {
                                fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                                lineNumber: 115,
                                columnNumber: 13
                            }, this),
                            " ",
                            spec.status.label
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                        lineNumber: 114,
                        columnNumber: 11
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                lineNumber: 105,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                id: summaryId,
                className: "semantic-visualization__summary",
                children: spec.accessibleSummary
            }, void 0, false, {
                fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                lineNumber: 119,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                role: "img",
                "aria-label": spec.title,
                "aria-describedby": summaryId,
                className: "semantic-visualization__chart",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$charts$2f$G2Chart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["G2Chart"], {
                    spec: chartSpec,
                    height: height,
                    mode: mode
                }, void 0, false, {
                    fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                    lineNumber: 126,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                lineNumber: 120,
                columnNumber: 7
            }, this),
            spec.note ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "semantic-visualization__note",
                children: spec.note
            }, void 0, false, {
                fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                lineNumber: 128,
                columnNumber: 20
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "semantic-visualization__sources",
                "aria-label": "Visualization sources",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: "Sources"
                    }, void 0, false, {
                        fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                        lineNumber: 130,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        children: spec.sourceIds.map((sourceId)=>{
                            const s = sourceLabel(sourceId);
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                title: s.title,
                                className: "tabular",
                                children: s.text
                            }, sourceId, false, {
                                fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                                lineNumber: 131,
                                columnNumber: 89
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                        lineNumber: 131,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                lineNumber: 129,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                "aria-expanded": showTable,
                "aria-controls": tableId,
                onClick: ()=>setShowTable((visible)=>!visible),
                className: "semantic-visualization__table-toggle",
                children: showTable ? "Hide equivalent table" : "Show equivalent table"
            }, void 0, false, {
                fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                lineNumber: 133,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$DominantTableRegion$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DominantTableRegion"], {
                id: tableId,
                ownerId: `${summaryId}-fallback`,
                label: `${spec.title} equivalent data`,
                exemption: "accessible-fallback",
                "aria-hidden": !showTable,
                "data-visible": showTable ? "true" : "false",
                className: "semantic-visualization__table-region",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                    "aria-label": spec.tabularFallback.label,
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                children: spec.tabularFallback.columns.map((column)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                        scope: "col",
                                        children: column.label
                                    }, column.key, false, {
                                        fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                                        lineNumber: 153,
                                        columnNumber: 63
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                                lineNumber: 153,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                            lineNumber: 152,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                            children: spec.tabularFallback.data.map((row, rowIndex)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                    children: spec.tabularFallback.columns.map((column)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                            children: cellText(row[column.key])
                                        }, column.key, false, {
                                            fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                                            lineNumber: 158,
                                            columnNumber: 63
                                        }, this))
                                }, rowIndex, false, {
                                    fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                                    lineNumber: 157,
                                    columnNumber: 15
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                            lineNumber: 155,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                    lineNumber: 151,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
                lineNumber: 142,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/charts/SemanticVisualization.tsx",
        lineNumber: 104,
        columnNumber: 5
    }, this);
}
_s(SemanticVisualization, "ZdDVwfphJ1YGPBfkTmv3jl2/sLk=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"]
    ];
});
_c = SemanticVisualization;
var _c;
__turbopack_context__.k.register(_c, "SemanticVisualization");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
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
"[project]/src/lib/rowActionMode.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Keyboard action-mode utilities for row-focused tables and ARIA grids.
// Rows stay as the single default Tab stop; F2 temporarily exposes only that
// row's nested controls, and Escape/blur lets the caller close the mode again.
__turbopack_context__.s([
    "ROW_ACTION_SELECTOR",
    ()=>ROW_ACTION_SELECTOR,
    "focusFirstRowAction",
    ()=>focusFirstRowAction,
    "syncRowActionTabStops",
    ()=>syncRowActionTabStops
]);
const ROW_ACTION_SELECTOR = [
    "button",
    "a[href]",
    "input",
    "select",
    "textarea",
    "summary",
    "[role='button']",
    "[role='link']",
    "[contenteditable='true']",
    "[tabindex]"
].join(", ");
function syncRowActionTabStops(row, enabled) {
    row.querySelectorAll(ROW_ACTION_SELECTOR).forEach((action)=>{
        if (action.dataset.rowOriginalTabindex === undefined) {
            action.dataset.rowOriginalTabindex = action.getAttribute("tabindex") ?? "";
        }
        const authorDisabled = action.matches(":disabled, [aria-disabled='true']");
        const authorNegative = action.dataset.rowOriginalTabindex.startsWith("-");
        const available = enabled && !authorDisabled && !authorNegative;
        action.tabIndex = available ? 0 : -1;
        action.dataset.rowActionStop = available ? "true" : "false";
    });
}
function focusFirstRowAction(row) {
    syncRowActionTabStops(row, true);
    const firstAction = row.querySelector("[data-row-action-stop='true']");
    firstAction?.focus();
    return firstAction != null;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/row-action-keyboard.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "handleActionRowKeyDown",
    ()=>handleActionRowKeyDown,
    "handleRovingActionRowKeyDown",
    ()=>handleRovingActionRowKeyDown
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rowActionMode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/rowActionMode.ts [app-client] (ecmascript)");
;
function handleActionRowKeyDown(event, options) {
    if (event.key === "Escape" && options.actionRowId === options.rowId) {
        event.preventDefault();
        options.setActionRowId(null);
        event.currentTarget.focus();
        return;
    }
    if (event.currentTarget !== event.target) return;
    if (event.key === "F2") {
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rowActionMode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["focusFirstRowAction"])(event.currentTarget)) {
            event.preventDefault();
            options.setActionRowId(options.rowId);
        }
        return;
    }
    options.onNavigate?.(event);
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    options.onActivate();
}
function handleRovingActionRowKeyDown(event, rowId, actionRowId, setActionRowId, onNavigate, onActivate) {
    handleActionRowKeyDown(event, {
        rowId,
        actionRowId,
        setActionRowId,
        onNavigate: (keyEvent)=>{
            if (![
                "ArrowUp",
                "ArrowDown",
                "Home",
                "End"
            ].includes(keyEvent.key)) return;
            setActionRowId(null);
            onNavigate(keyEvent);
        },
        onActivate
    });
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/DataTable.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DataTable",
    ()=>DataTable
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// The plain (non-virtualized, non-ARIA-grid) data table primitive: a typed
// column contract so alignment/tabular-nums/units-in-header stay consistent
// by construction instead of hand-rolled per table (the "text-right in 22
// files, tabular in 111" divergence this exists to close). Callers still own
// cell content and number formatting (fm/fx/display helpers) — this only
// owns structure: alignment, header semantics, optional sort, optional
// roving-tabindex row focus.
//
// Scope: a real <table>, not a virtualized or ARIA-grid layout — those are a
// different shape (see RVScreenerWorkbench's VirtualCandidateGrid, which
// already has its own roving-focus solution) and are out of scope here.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingTabs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/useRovingTabs.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rowActionMode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/rowActionMode.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$row$2d$action$2d$keyboard$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/row-action-keyboard.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
const ALIGN_TD = {
    text: "text-left",
    numeric: "text-right tabular",
    center: "text-center",
    action: "text-right"
};
const ALIGN_TH = {
    text: "text-left",
    numeric: "text-right",
    center: "text-center",
    action: "text-right"
};
const ROW_KEYBOARD_INSTRUCTIONS = "Use Up and Down Arrow to move between rows. Press Enter to open a row or F2 to use actions within it; Escape returns to the row.";
const columnLabel = (column)=>column.unit ? `${column.header} (${column.unit})` : column.header;
const columnAriaSort = (column, canSort, sort)=>{
    if (!canSort) return undefined;
    if (sort?.key !== column.key) return "none";
    return sort.direction === "asc" ? "ascending" : "descending";
};
function ColumnLabel({ column, canSort, sort, onSort }) {
    const label = columnLabel(column);
    if (!canSort) return label;
    const glyph = sort?.key === column.key ? sort.direction === "asc" ? " ▲" : " ▼" : null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        onClick: ()=>onSort?.(column.key),
        className: "uppercase tracking-wider hover:text-caos-text focus-ring",
        children: [
            label,
            glyph
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/DataTable.tsx",
        lineNumber: 103,
        columnNumber: 5
    }, this);
}
_c = ColumnLabel;
function DataTableHeaderCell({ column, sort, onSort }) {
    const align = column.align ?? "text";
    const canSort = Boolean(column.sortable && onSort);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
        scope: "col",
        "aria-sort": columnAriaSort(column, canSort, sort),
        style: column.width ? {
            width: column.width
        } : undefined,
        className: `px-2 py-1 font-mono font-medium uppercase tracking-wider ${ALIGN_TH[align]}`,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ColumnLabel, {
            column: column,
            canSort: canSort,
            sort: sort,
            onSort: onSort
        }, void 0, false, {
            fileName: "[project]/src/components/ui/DataTable.tsx",
            lineNumber: 127,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/ui/DataTable.tsx",
        lineNumber: 121,
        columnNumber: 5
    }, this);
}
_c1 = DataTableHeaderCell;
function DataTableHeader({ columns, sort, onSort }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
        className: "sticky top-0 z-raised bg-caos-elevated text-caos-muted",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
            children: columns.map((column)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DataTableHeaderCell, {
                    column: column,
                    sort: sort,
                    onSort: onSort
                }, column.key, false, {
                    fileName: "[project]/src/components/ui/DataTable.tsx",
                    lineNumber: 135,
                    columnNumber: 36
                }, this))
        }, void 0, false, {
            fileName: "[project]/src/components/ui/DataTable.tsx",
            lineNumber: 135,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/ui/DataTable.tsx",
        lineNumber: 134,
        columnNumber: 5
    }, this);
}
_c2 = DataTableHeader;
function DataTableCell({ column, row, index }) {
    const className = `px-2 py-1.5 ${ALIGN_TD[column.align ?? "text"]}`;
    return column.rowHeader ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
        scope: "row",
        className: `${className} font-normal`,
        children: column.render(row, index)
    }, void 0, false, {
        fileName: "[project]/src/components/ui/DataTable.tsx",
        lineNumber: 143,
        columnNumber: 7
    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
        className: className,
        children: column.render(row, index)
    }, void 0, false, {
        fileName: "[project]/src/components/ui/DataTable.tsx",
        lineNumber: 144,
        columnNumber: 7
    }, this);
}
_c3 = DataTableCell;
const handleRowKeyDown = (event, row, index, rowId, actionRowId, itemProps, setActionRowId, onRowActivate)=>{
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$row$2d$action$2d$keyboard$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["handleActionRowKeyDown"])(event, {
        rowId,
        actionRowId,
        setActionRowId,
        onNavigate: itemProps.onKeyDown,
        onActivate: ()=>onRowActivate(row, index)
    });
};
const rowClasses = (itemProps, rowClassName, row, index)=>[
        itemProps ? "cursor-pointer focus-ring hover:bg-caos-elevated/30" : "",
        rowClassName?.(row, index) ?? ""
    ].filter(Boolean).join(" ") || undefined;
const rowRefBinding = (itemProps, rowRefs, rowId)=>itemProps ? (element)=>{
        itemProps.ref(element);
        if (element) rowRefs.current.set(rowId, element);
        else rowRefs.current.delete(rowId);
    } : undefined;
const rowKeyBinding = (itemProps, onRowActivate, row, index, rowId, actionRowId, setActionRowId)=>itemProps && onRowActivate ? (event)=>handleRowKeyDown(event, row, index, rowId, actionRowId, itemProps, setActionRowId, onRowActivate) : undefined;
const rowClickBinding = (itemProps, onRowActivate, row, index, setActiveIndex)=>itemProps && onRowActivate ? (event)=>{
        const target = event.target;
        const interactiveDescendant = target.closest?.(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rowActionMode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ROW_ACTION_SELECTOR"]);
        if (interactiveDescendant && interactiveDescendant !== event.currentTarget) return;
        setActiveIndex(index);
        onRowActivate(row, index);
    } : undefined;
const rowBlurBinding = (itemProps, actionRowId, rowId, setActionRowId)=>itemProps ? (event)=>{
        if (actionRowId === rowId && !event.currentTarget.contains(event.relatedTarget)) {
            setActionRowId(null);
        }
    } : undefined;
function DataTableRow({ row, index, rowId, columns, itemProps, actionRowId, selectedRowId, rowClassName, rowRefs, setActiveIndex, setActionRowId, onRowActivate }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
        ref: rowRefBinding(itemProps, rowRefs, rowId),
        tabIndex: itemProps?.tabIndex,
        "aria-selected": selectedRowId != null ? rowId === selectedRowId : undefined,
        "aria-keyshortcuts": itemProps ? "F2" : undefined,
        "data-action-mode": actionRowId === rowId ? "true" : undefined,
        onFocus: itemProps ? ()=>setActiveIndex(index) : undefined,
        onKeyDown: rowKeyBinding(itemProps, onRowActivate, row, index, rowId, actionRowId, setActionRowId),
        onClick: rowClickBinding(itemProps, onRowActivate, row, index, setActiveIndex),
        onBlur: rowBlurBinding(itemProps, actionRowId, rowId, setActionRowId),
        className: rowClasses(itemProps, rowClassName, row, index),
        children: columns.map((column)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DataTableCell, {
                column: column,
                row: row,
                index: index
            }, column.key, false, {
                fileName: "[project]/src/components/ui/DataTable.tsx",
                lineNumber: 265,
                columnNumber: 32
            }, this))
    }, void 0, false, {
        fileName: "[project]/src/components/ui/DataTable.tsx",
        lineNumber: 253,
        columnNumber: 5
    }, this);
}
_c4 = DataTableRow;
const useDataTableInteraction = (rows, getRowId, selectedRowId, onRowActivate)=>{
    _s();
    const selectedIndex = selectedRowId != null ? rows.findIndex((row, index)=>getRowId(row, index) === selectedRowId) : -1;
    const [activeIndex, setActiveIndex] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "useDataTableInteraction.useState": ()=>selectedIndex >= 0 ? selectedIndex : 0
    }["useDataTableInteraction.useState"]);
    const [actionRowId, setActionRowId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const rowRefs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(new Map());
    const rowIdsKey = JSON.stringify(rows.map((row, index)=>getRowId(row, index)));
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useDataTableInteraction.useEffect": ()=>{
            if (rows.length === 0) setActiveIndex(0);
            else if (selectedIndex >= 0) setActiveIndex(selectedIndex);
            else setActiveIndex({
                "useDataTableInteraction.useEffect": (current)=>Math.min(current, rows.length - 1)
            }["useDataTableInteraction.useEffect"]);
        }
    }["useDataTableInteraction.useEffect"], [
        rows.length,
        selectedIndex
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useDataTableInteraction.useEffect": ()=>setActionRowId(null)
    }["useDataTableInteraction.useEffect"], [
        rowIdsKey
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLayoutEffect"])({
        "useDataTableInteraction.useLayoutEffect": ()=>{
            if (!onRowActivate) return;
            for (const [rowId, rowElement] of rowRefs.current){
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rowActionMode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["syncRowActionTabStops"])(rowElement, actionRowId === rowId);
            }
        }
    }["useDataTableInteraction.useLayoutEffect"]);
    const { getItemProps } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingTabs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRovingTabs"])(onRowActivate ? rows.length : 0, activeIndex, setActiveIndex, {
        orientation: "vertical"
    });
    return {
        actionRowId,
        activeIndex,
        getItemProps,
        rowRefs,
        setActionRowId,
        setActiveIndex
    };
};
_s(useDataTableInteraction, "VvgREyT89NV0IKymWJYZ0KaizgU=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingTabs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRovingTabs"]
    ];
});
function DataTableBody({ columns, rows, getRowId, onRowActivate, selectedRowId, rowClassName, interaction }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
        className: "divide-y divide-caos-border/40",
        children: rows.map((row, index)=>{
            const rowId = getRowId(row, index);
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DataTableRow, {
                row: row,
                index: index,
                rowId: rowId,
                columns: columns,
                itemProps: onRowActivate ? interaction.getItemProps(index) : null,
                actionRowId: interaction.actionRowId,
                selectedRowId: selectedRowId,
                rowClassName: rowClassName,
                rowRefs: interaction.rowRefs,
                setActiveIndex: interaction.setActiveIndex,
                setActionRowId: interaction.setActionRowId,
                onRowActivate: onRowActivate
            }, rowId, false, {
                fileName: "[project]/src/components/ui/DataTable.tsx",
                lineNumber: 320,
                columnNumber: 11
            }, this);
        })
    }, void 0, false, {
        fileName: "[project]/src/components/ui/DataTable.tsx",
        lineNumber: 316,
        columnNumber: 5
    }, this);
}
_c5 = DataTableBody;
function DataTable({ columns, rows, getRowId, sort, onSort, onRowActivate, selectedRowId, rowClassName, caption, className = "" }) {
    _s1();
    const interaction = useDataTableInteraction(rows, getRowId, selectedRowId, onRowActivate);
    const keyboardInstructionsId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            onRowActivate ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                id: keyboardInstructionsId,
                className: "sr-only",
                children: ROW_KEYBOARD_INSTRUCTIONS
            }, void 0, false, {
                fileName: "[project]/src/components/ui/DataTable.tsx",
                lineNumber: 359,
                columnNumber: 9
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                "aria-describedby": onRowActivate ? keyboardInstructionsId : undefined,
                className: `caos-data-table w-full border-collapse font-sans text-caos-xs${className ? ` ${className}` : ""}`,
                children: [
                    caption ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("caption", {
                        className: "sr-only",
                        children: caption
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/DataTable.tsx",
                        lineNumber: 367,
                        columnNumber: 18
                    }, this) : null,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DataTableHeader, {
                        columns: columns,
                        sort: sort,
                        onSort: onSort
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/DataTable.tsx",
                        lineNumber: 368,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DataTableBody, {
                        columns: columns,
                        rows: rows,
                        getRowId: getRowId,
                        onRowActivate: onRowActivate,
                        selectedRowId: selectedRowId,
                        rowClassName: rowClassName,
                        interaction: interaction
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/DataTable.tsx",
                        lineNumber: 369,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ui/DataTable.tsx",
                lineNumber: 363,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/DataTable.tsx",
        lineNumber: 357,
        columnNumber: 5
    }, this);
}
_s1(DataTable, "7aLEioJjkdU1hVYbEjQDQnd85x0=", false, function() {
    return [
        useDataTableInteraction,
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"]
    ];
});
_c6 = DataTable;
var _c, _c1, _c2, _c3, _c4, _c5, _c6;
__turbopack_context__.k.register(_c, "ColumnLabel");
__turbopack_context__.k.register(_c1, "DataTableHeaderCell");
__turbopack_context__.k.register(_c2, "DataTableHeader");
__turbopack_context__.k.register(_c3, "DataTableCell");
__turbopack_context__.k.register(_c4, "DataTableRow");
__turbopack_context__.k.register(_c5, "DataTableBody");
__turbopack_context__.k.register(_c6, "DataTable");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/deepdive/OutSections.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OutSections",
    ()=>OutSections
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/reports/EvChip.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/pipeline/atoms.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$DataTable$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/DataTable.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
function MoreButton({ count, expanded, onToggle, controls }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        "aria-expanded": expanded,
        "aria-controls": controls,
        onClick: onToggle,
        className: "m-2 tabular text-caos-xs text-caos-accent hover:text-caos-text focus-ring",
        children: expanded ? "Show fewer" : `+${count} more`
    }, void 0, false, {
        fileName: "[project]/src/components/deepdive/OutSections.tsx",
        lineNumber: 27,
        columnNumber: 5
    }, this);
}
_c = MoreButton;
function TableSection({ section, index }) {
    _s();
    const [expanded, setExpanded] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const overflowRows = section.overflowRows ?? [];
    const rows = expanded ? [
        ...section.rows,
        ...overflowRows
    ] : section.rows;
    const contentId = `deepdive-output-${index}`;
    const columns = section.cols.map((column, ci)=>({
            key: `${ci}-${column}`,
            header: column,
            align: section.align?.[ci] ? "numeric" : "text",
            rowHeader: ci === 0,
            render: (row)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: ci === 0 ? "text-caos-text" : "text-caos-text/90",
                    children: row[ci]
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/OutSections.tsx",
                    lineNumber: 50,
                    columnNumber: 7
                }, this)
        }));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rounded border border-caos-border bg-caos-bg",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-3 py-2 border-b border-caos-border tabular text-caos-xs font-semibold uppercase tracking-wider text-caos-text",
                children: section.title
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutSections.tsx",
                lineNumber: 57,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                id: contentId,
                className: "deepdive-output-table-scroll",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$DataTable$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DataTable"], {
                    columns: columns,
                    rows: rows,
                    getRowId: (_row, ri)=>`${index}-${ri}`,
                    caption: section.title,
                    className: "deepdive-output-table"
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/OutSections.tsx",
                    lineNumber: 59,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutSections.tsx",
                lineNumber: 58,
                columnNumber: 7
            }, this),
            overflowRows.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MoreButton, {
                count: overflowRows.length,
                expanded: expanded,
                onToggle: ()=>setExpanded((open)=>!open),
                controls: contentId
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutSections.tsx",
                lineNumber: 67,
                columnNumber: 30
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/OutSections.tsx",
        lineNumber: 56,
        columnNumber: 5
    }, this);
}
_s(TableSection, "DuL5jiiQQFgbn7gBKAyxwS/H4Ek=");
_c1 = TableSection;
function FlagSection({ section, index, onOpenEvidence }) {
    _s1();
    const [expanded, setExpanded] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const overflowItems = section.overflowItems ?? [];
    const items = expanded ? [
        ...section.items,
        ...overflowItems
    ] : section.items;
    const contentId = `deepdive-output-${index}`;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rounded border border-caos-border bg-caos-bg",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-3 py-2 border-b border-caos-border tabular text-caos-xs font-semibold uppercase tracking-wider text-caos-text",
                children: section.title
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutSections.tsx",
                lineNumber: 83,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                id: contentId,
                children: items.map((flag, itemIndex)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "px-3 py-1.5 border-b border-caos-border/50 flex items-start gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dot"], {
                                sev: flag.sev
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/OutSections.tsx",
                                lineNumber: 87,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-caos-lg text-caos-text leading-snug flex-1",
                                children: [
                                    flag.text,
                                    flag.ev && flag.ev.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "inline-flex gap-1 ml-1.5 align-middle",
                                        children: flag.ev.map((e)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EvChip"], {
                                                id: e,
                                                onOpen: onOpenEvidence
                                            }, e, false, {
                                                fileName: "[project]/src/components/deepdive/OutSections.tsx",
                                                lineNumber: 92,
                                                columnNumber: 39
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/OutSections.tsx",
                                        lineNumber: 91,
                                        columnNumber: 17
                                    }, this) : null
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/deepdive/OutSections.tsx",
                                lineNumber: 88,
                                columnNumber: 13
                            }, this)
                        ]
                    }, itemIndex, true, {
                        fileName: "[project]/src/components/deepdive/OutSections.tsx",
                        lineNumber: 86,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutSections.tsx",
                lineNumber: 84,
                columnNumber: 7
            }, this),
            overflowItems.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MoreButton, {
                count: overflowItems.length,
                expanded: expanded,
                onToggle: ()=>setExpanded((open)=>!open),
                controls: contentId
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutSections.tsx",
                lineNumber: 99,
                columnNumber: 31
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/OutSections.tsx",
        lineNumber: 82,
        columnNumber: 5
    }, this);
}
_s1(FlagSection, "DuL5jiiQQFgbn7gBKAyxwS/H4Ek=");
_c2 = FlagSection;
function OutSections({ sections, onOpenEvidence }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: sections.map((s, si)=>{
            if (s.type === "table") {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TableSection, {
                    section: s,
                    index: si
                }, si, false, {
                    fileName: "[project]/src/components/deepdive/OutSections.tsx",
                    lineNumber: 115,
                    columnNumber: 18
                }, this);
            }
            if (s.type === "flags") {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FlagSection, {
                    section: s,
                    index: si,
                    onOpenEvidence: onOpenEvidence
                }, si, false, {
                    fileName: "[project]/src/components/deepdive/OutSections.tsx",
                    lineNumber: 118,
                    columnNumber: 18
                }, this);
            }
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded border border-caos-border bg-caos-bg px-3 py-2.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "tabular text-caos-xs font-semibold uppercase tracking-wider text-caos-text mb-1",
                        children: s.title
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/OutSections.tsx",
                        lineNumber: 122,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-caos-xl text-caos-text leading-relaxed",
                        children: [
                            s.body,
                            s.ev && s.ev.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "inline-flex gap-1 ml-1.5 align-middle",
                                children: s.ev.map((e)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EvChip"], {
                                        id: e,
                                        onOpen: onOpenEvidence
                                    }, e, false, {
                                        fileName: "[project]/src/components/deepdive/OutSections.tsx",
                                        lineNumber: 127,
                                        columnNumber: 36
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/OutSections.tsx",
                                lineNumber: 126,
                                columnNumber: 17
                            }, this) : null
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/OutSections.tsx",
                        lineNumber: 123,
                        columnNumber: 13
                    }, this)
                ]
            }, si, true, {
                fileName: "[project]/src/components/deepdive/OutSections.tsx",
                lineNumber: 121,
                columnNumber: 11
            }, this);
        })
    }, void 0, false);
}
_c3 = OutSections;
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "MoreButton");
__turbopack_context__.k.register(_c1, "TableSection");
__turbopack_context__.k.register(_c2, "FlagSection");
__turbopack_context__.k.register(_c3, "OutSections");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/FlagToQa.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FlagToQa",
    ()=>FlagToQa
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// Analyst QA-flag action (compose → confirm → recorded server-side). Shared by
// the Deep-Dive step-output modal and the evidence modal so "FLAG TO QA · CP-5"
// behaves identically everywhere it appears — a silent no-op escalation button
// is the one failure a governance product can't afford.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ActionReason.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
const useQaFlagCount = (issuerId, moduleId, stepRef)=>{
    _s();
    const [count, setCount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useQaFlagCount.useEffect": ()=>{
            let stale = false;
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listQaFlags"])({
                module_id: moduleId,
                step_ref: stepRef,
                issuer_id: issuerId
            }).then({
                "useQaFlagCount.useEffect": (flags)=>{
                    if (!stale) setCount(flags.length);
                }
            }["useQaFlagCount.useEffect"]).catch({
                "useQaFlagCount.useEffect": ()=>{
                    if (!stale) setCount(null);
                }
            }["useQaFlagCount.useEffect"]);
            return ({
                "useQaFlagCount.useEffect": ()=>{
                    stale = true;
                }
            })["useQaFlagCount.useEffect"];
        }
    }["useQaFlagCount.useEffect"], [
        issuerId,
        moduleId,
        stepRef
    ]);
    return {
        count,
        setCount
    };
};
_s(useQaFlagCount, "XeM2Swa48AXpsYvvdoNmFufJfaQ=");
function FlaggedConfirmation({ count }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        role: "status",
        className: "tabular text-caos-md px-2.5 py-1.5 rounded border",
        style: {
            borderColor: "var(--caos-success)",
            color: "var(--caos-success)"
        },
        children: [
            "✓ FLAGGED TO QA — recorded",
            count != null && count > 1 ? ` · ${count} on file` : ""
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/FlagToQa.tsx",
        lineNumber: 28,
        columnNumber: 5
    }, this);
}
_c = FlaggedConfirmation;
function FlagComposer({ noteId, note, phase, onNoteChange, onSubmit, onCancel }) {
    const submitting = phase === "submitting";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col gap-1.5",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                htmlFor: noteId,
                children: "Reason for QA (optional)"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/FlagToQa.tsx",
                lineNumber: 52,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                id: noteId,
                value: note,
                onChange: (event)=>onNoteChange(event.target.value),
                maxLength: 2000,
                rows: 3,
                autoFocus: true,
                placeholder: "Describe what CP-5 should review…",
                className: "rounded border border-caos-border bg-caos-bg px-2 py-1.5 text-caos-md text-caos-text outline-none focus-ring focus:border-caos-accent transition-caos placeholder:text-caos-muted resize-y"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/FlagToQa.tsx",
                lineNumber: 55,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex gap-1.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ActionReason"], {
                        onClick: onSubmit,
                        reason: submitting ? "Submitting flag to QA…" : null,
                        className: "tabular text-caos-md px-2.5 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring aria-disabled:opacity-40 aria-disabled:cursor-not-allowed",
                        children: submitting ? "FLAGGING…" : "CONFIRM FLAG"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/FlagToQa.tsx",
                        lineNumber: 66,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ActionReason"], {
                        onClick: onCancel,
                        reason: submitting ? "Can't cancel while the flag is submitting" : null,
                        className: "tabular text-caos-md px-2.5 py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos focus-ring aria-disabled:opacity-40",
                        children: "CANCEL"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/FlagToQa.tsx",
                        lineNumber: 73,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/FlagToQa.tsx",
                lineNumber: 65,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/FlagToQa.tsx",
        lineNumber: 51,
        columnNumber: 5
    }, this);
}
_c1 = FlagComposer;
function FlagLauncher({ phase, count, onCompose }) {
    const countLabel = count != null && count > 0 ? `${count} flag${count > 1 ? "s" : ""} on file for this step` : null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col gap-1",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: onCompose,
                className: "tabular text-caos-md whitespace-nowrap px-2.5 py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring",
                children: "FLAG TO QA · CP-5"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/FlagToQa.tsx",
                lineNumber: 89,
                columnNumber: 7
            }, this),
            phase === "error" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                role: "alert",
                className: "text-caos-sm",
                style: {
                    color: "var(--caos-critical-bright)"
                },
                children: "flag failed — check connection and retry"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/FlagToQa.tsx",
                lineNumber: 96,
                columnNumber: 9
            }, this) : countLabel ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xs text-caos-muted",
                children: countLabel
            }, void 0, false, {
                fileName: "[project]/src/components/shared/FlagToQa.tsx",
                lineNumber: 99,
                columnNumber: 24
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/FlagToQa.tsx",
        lineNumber: 88,
        columnNumber: 5
    }, this);
}
_c2 = FlagLauncher;
function FlagToQa({ issuerId, moduleId, stepRef }) {
    _s1();
    const [phase, setPhase] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("idle");
    const [note, setNote] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const { count, setCount } = useQaFlagCount(issuerId, moduleId, stepRef);
    // The evidence modal can open over the step modal — two instances may mount
    // at once, so the textarea id must be unique per instance.
    const noteId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    const submit = ()=>{
        setPhase("submitting");
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createQaFlag"])({
            module_id: moduleId,
            step_ref: stepRef,
            note,
            issuer_id: issuerId
        }).then(()=>{
            setPhase("flagged");
            setCount((c)=>(c ?? 0) + 1);
        }).catch(()=>setPhase("error"));
    };
    if (phase === "flagged") return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FlaggedConfirmation, {
        count: count
    }, void 0, false, {
        fileName: "[project]/src/components/shared/FlagToQa.tsx",
        lineNumber: 123,
        columnNumber: 35
    }, this);
    if (phase === "composing" || phase === "submitting") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FlagComposer, {
            noteId: noteId,
            note: note,
            phase: phase,
            onNoteChange: setNote,
            onSubmit: submit,
            onCancel: ()=>setPhase("idle")
        }, void 0, false, {
            fileName: "[project]/src/components/shared/FlagToQa.tsx",
            lineNumber: 126,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FlagLauncher, {
        phase: phase,
        count: count,
        onCompose: ()=>setPhase("composing")
    }, void 0, false, {
        fileName: "[project]/src/components/shared/FlagToQa.tsx",
        lineNumber: 129,
        columnNumber: 10
    }, this);
}
_s1(FlagToQa, "15Q1qqga7olnN/JlMjIWC670Ioo=", false, function() {
    return [
        useQaFlagCount,
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"]
    ];
});
_c3 = FlagToQa;
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "FlaggedConfirmation");
__turbopack_context__.k.register(_c1, "FlagComposer");
__turbopack_context__.k.register(_c2, "FlagLauncher");
__turbopack_context__.k.register(_c3, "FlagToQa");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/deepdive/module-steps.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// AUTO-PORTED from the Credit OS design bundle (shared/deal-modules.js).
// ATLF demo data — replace with live module outputs when CP backend persistence lands.
// [code, required output, status, note?]  status: ok | warning | gap
__turbopack_context__.s([
    "MODULE_STEPS",
    ()=>MODULE_STEPS,
    "STEP_STATUS_TEXT",
    ()=>STEP_STATUS_TEXT
]);
const STEP_STATUS_TEXT = {
    ok: "produced",
    warning: "produced w/ limitation",
    gap: "gap logged"
};
const MODULE_STEPS = {
    "CP-0": [
        [
            "A",
            "File Classification",
            "ok",
            "14 files typed"
        ],
        [
            "B",
            "Entity Identification",
            "ok"
        ],
        [
            "C",
            "Document Mapping",
            "ok"
        ],
        [
            "D",
            "Quality Assignment",
            "ok",
            "grades A–C"
        ],
        [
            "E",
            "Content-Module Mapping",
            "ok"
        ],
        [
            "F",
            "Gap Logging",
            "warning",
            "G-01 · G-02 logged"
        ],
        [
            "G",
            "Conflict Logging",
            "ok",
            "0 unresolved"
        ],
        [
            "H",
            "File Quality Risk",
            "ok"
        ],
        [
            "I",
            "Downstream Readiness",
            "ok",
            "0.91"
        ],
        [
            "J",
            "Master Index Update",
            "ok"
        ],
        [
            "K",
            "Export Assembly",
            "ok"
        ]
    ],
    "CP-X": [
        [
            "TX.1",
            "Route Plan Source Gate",
            "warning",
            "ready with limitations"
        ],
        [
            "TX.2",
            "Module Execution Sequence",
            "ok",
            "8 waves"
        ],
        [
            "TX.3",
            "Module Readiness Register",
            "ok",
            "21 GREEN"
        ],
        [
            "TX.4",
            "One-Owner-Per-Object Validation",
            "ok",
            "0 collisions"
        ],
        [
            "TX.5",
            "Source-to-Module Routing Map",
            "ok"
        ],
        [
            "TX.6",
            "Limitation Propagation Register",
            "warning",
            "L-04 → CP-2F · CP-6A"
        ],
        [
            "TX.7",
            "Route Plan Summary",
            "ok"
        ]
    ],
    "CP-1": [
        [
            "T4.1",
            "Source Register (file gate)",
            "ok"
        ],
        [
            "T4.2",
            "Entity / Period Key",
            "ok"
        ],
        [
            "T4.3",
            "Normalization Register",
            "ok"
        ],
        [
            "T4.4",
            "Income Statement Coverage",
            "ok"
        ],
        [
            "T4.5",
            "Cash Flow Statement Coverage",
            "ok"
        ],
        [
            "T4.6",
            "Balance Sheet Coverage",
            "ok"
        ],
        [
            "T4.7",
            "Normalized Financials Table",
            "ok"
        ],
        [
            "T4.8",
            "Derived Period Register",
            "warning",
            "Q4-25 from sponsor model (G-02)"
        ],
        [
            "T4.9",
            "Calc Register + KPI Build",
            "ok",
            "41 KPIs"
        ],
        [
            "T4.11",
            "Definition Conflict Register",
            "warning",
            "2 conflicts logged"
        ],
        [
            "—",
            "Evidence→Risk→Credit Narrative",
            "ok"
        ],
        [
            "T4.12",
            "Gaps + Downstream Readiness",
            "ok",
            "GREEN"
        ]
    ],
    "CP-1A": [
        [
            "1",
            "Source Basis Establishment",
            "ok"
        ],
        [
            "2",
            "Source Classification",
            "ok"
        ],
        [
            "3",
            "Transaction Summary",
            "ok"
        ],
        [
            "4",
            "Business Description",
            "ok"
        ],
        [
            "5",
            "Ownership Register",
            "ok",
            "Kestrel 68.4%"
        ],
        [
            "6",
            "Operating Model",
            "ok"
        ],
        [
            "7",
            "History / Timeline",
            "ok"
        ],
        [
            "8",
            "Credit Translation",
            "ok"
        ],
        [
            "9",
            "Gaps Ledger",
            "ok"
        ],
        [
            "10",
            "Module Summary",
            "ok"
        ]
    ],
    "CP-1B": [
        [
            "1",
            "File Gate & Source Validation",
            "ok"
        ],
        [
            "2",
            "Issuer / Period Scope",
            "ok"
        ],
        [
            "3",
            "Definition Inheritance",
            "ok",
            "CP-1 defs preserved"
        ],
        [
            "4",
            "Summary Top Sheet",
            "ok"
        ],
        [
            "5",
            "Financial Performance Table",
            "ok"
        ],
        [
            "6",
            "KPI Dashboard",
            "ok"
        ],
        [
            "7",
            "Variance Analysis",
            "warning",
            "−4.2% vs sponsor model"
        ],
        [
            "8",
            "Corporate Actions",
            "ok",
            "2 actions"
        ],
        [
            "9",
            "Comparative Evaluation",
            "ok"
        ],
        [
            "10",
            "Conflict Log",
            "warning",
            "model variance logged to CP-5"
        ],
        [
            "11",
            "Monitoring Assessment",
            "ok"
        ],
        [
            "12",
            "Gaps & Limitations Ledger",
            "ok"
        ],
        [
            "13",
            "Overall Earnings View",
            "ok"
        ]
    ],
    "CP-1C": [
        [
            "0",
            "Peer Discovery Gate",
            "ok"
        ],
        [
            "1",
            "Peer Data Gate",
            "ok"
        ],
        [
            "2",
            "Peer Universe Register",
            "ok",
            "7 names"
        ],
        [
            "3",
            "Metric Alignment Register",
            "warning",
            "E-44 anchor mismatch (QA-117)"
        ],
        [
            "4A",
            "Operating Benchmark",
            "ok"
        ],
        [
            "4B",
            "Cash Flow & Capital Intensity",
            "ok"
        ],
        [
            "4C",
            "Credit Metric Benchmark",
            "ok"
        ],
        [
            "4D",
            "Summary Statistics",
            "ok"
        ],
        [
            "5",
            "Outlier Register",
            "ok",
            "Tarn excluded"
        ],
        [
            "6A",
            "Public Trading Comps",
            "ok"
        ],
        [
            "6B",
            "Transaction Comps",
            "warning",
            "thin set — 2 datapoints"
        ],
        [
            "6C",
            "Implied EV",
            "ok"
        ],
        [
            "7",
            "Peer Interpretation & Credit Translation",
            "ok"
        ],
        [
            "8",
            "Gaps & Limitations Ledger",
            "ok"
        ],
        [
            "9",
            "Overall Peer Benchmarking View",
            "ok"
        ]
    ],
    "CP-2": [
        [
            "1",
            "Source Gate & Readiness",
            "ok"
        ],
        [
            "2",
            "Company Description",
            "ok"
        ],
        [
            "3",
            "Ownership & Group Structure",
            "ok"
        ],
        [
            "4A",
            "Revenue Drivers & Pricing Power",
            "ok"
        ],
        [
            "4B",
            "Cost Structure & Margin Resilience",
            "ok"
        ],
        [
            "4C",
            "Capital Intensity & FCF Conversion",
            "ok"
        ],
        [
            "5A",
            "Porter Five Forces",
            "ok"
        ],
        [
            "5B",
            "PEST Analysis",
            "ok"
        ],
        [
            "5C",
            "SWOT Analysis",
            "ok"
        ],
        [
            "6",
            "Key Strengths & Weaknesses",
            "ok"
        ],
        [
            "7",
            "Financial Profile & Credit Quality",
            "ok",
            "9-dim scorecard"
        ],
        [
            "8",
            "Outlook, Tailwinds & Headwinds",
            "ok"
        ],
        [
            "9",
            "Qualitative Downside Scenario",
            "ok"
        ],
        [
            "10",
            "Materiality Filter",
            "ok"
        ],
        [
            "11",
            "Issuer Matrix",
            "ok",
            "6 factors"
        ],
        [
            "12",
            "Monitoring Triggers",
            "ok",
            "4 set"
        ],
        [
            "13",
            "Overall Credit View",
            "ok"
        ]
    ],
    "CP-2B": [
        [
            "1",
            "Source Gate & Baseline",
            "ok"
        ],
        [
            "2",
            "Business Model Snapshot",
            "ok"
        ],
        [
            "3",
            "Fragility Map",
            "ok",
            "F-1…F-4"
        ],
        [
            "4",
            "Stress Transmission Table",
            "ok"
        ],
        [
            "5",
            "Downside Pathway Register",
            "ok",
            "3 pathways"
        ],
        [
            "6",
            "Downside Sensitivity Matrix",
            "ok"
        ],
        [
            "7",
            "Monitoring Sensitivity Flags",
            "ok"
        ],
        [
            "8",
            "Cross-Module Handoff Register",
            "ok",
            "→ CP-3D · CP-6A · CP-6E"
        ],
        [
            "9",
            "Gaps Ledger",
            "ok"
        ],
        [
            "10",
            "Overall Downside Pathway View",
            "ok"
        ]
    ],
    "CP-2C": [
        [
            "1",
            "Source Gate & Calendar Scope",
            "ok"
        ],
        [
            "T5.1",
            "Event Source Register",
            "ok"
        ],
        [
            "T5.2",
            "Catalyst Calendar",
            "ok",
            "9 events"
        ],
        [
            "T5.3",
            "Event Risk Register",
            "ok"
        ],
        [
            "T5.4",
            "Probability-Impact Matrix",
            "ok"
        ],
        [
            "T5.5",
            "Monitoring Priority Table",
            "ok"
        ],
        [
            "T5.6",
            "Watchlist Handoff Register",
            "ok",
            "3 handoffs"
        ],
        [
            "T5.7",
            "Gaps & Limitations Ledger",
            "ok"
        ],
        [
            "—",
            "Overall Catalyst View",
            "ok"
        ]
    ],
    "CP-2D": [
        [
            "T2D.1",
            "Source Register & Readiness",
            "ok"
        ],
        [
            "T2D.2",
            "Ownership & Control Register",
            "ok"
        ],
        [
            "T2D.3",
            "Governance Register",
            "ok",
            "1 of 7 independent"
        ],
        [
            "T2D.4",
            "Behavior Flag Register",
            "warning",
            "2 flags — recap history · RP pre-positioning"
        ],
        [
            "T2D.5",
            "Capital Allocation Risk Table",
            "ok"
        ],
        [
            "T2D.6",
            "Acquisition Appetite Table",
            "ok"
        ],
        [
            "T2D.7",
            "Disclosure Quality Log",
            "ok",
            "B+"
        ],
        [
            "T2D.8",
            "Creditor Alignment Table",
            "ok"
        ],
        [
            "T2D.9",
            "Sponsor Risk Assessment",
            "ok",
            "MODERATE-HIGH"
        ],
        [
            "T2D.10",
            "Cross-Module Handoff Register",
            "ok"
        ],
        [
            "T2D.11",
            "Gaps Ledger",
            "ok"
        ],
        [
            "T2D.12",
            "Overall Governance View",
            "ok"
        ]
    ],
    "CP-2E": [
        [
            "T2E.1",
            "Source Register & Module Status",
            "ok"
        ],
        [
            "T2E.2",
            "Beginning Liquidity Register",
            "ok",
            "$379M accessible"
        ],
        [
            "T2E.3",
            "Mandatory Cash Uses Register",
            "ok"
        ],
        [
            "T2E.4",
            "WC & Capex Pressure Table",
            "ok"
        ],
        [
            "T2E.5",
            "12-Month Liquidity Bridge",
            "ok",
            "+$96M"
        ],
        [
            "T2E.6",
            "Months to Empty Result",
            "ok",
            "19.3 / 14.0 stress"
        ],
        [
            "T2E.7",
            "Mitigants & Constraints Table",
            "ok"
        ],
        [
            "—",
            "Liquidity Risk Level + Narrative",
            "ok",
            "ADEQUATE"
        ],
        [
            "T2E.9",
            "Gaps Ledger",
            "ok"
        ],
        [
            "—",
            "Overall Liquidity View",
            "ok"
        ]
    ],
    "CP-2F": [
        [
            "T2F.1",
            "Source Register & Module Status",
            "warning",
            "ready with limitations (G-01)"
        ],
        [
            "T2F.2",
            "Debt & Rate Exposure Register",
            "ok"
        ],
        [
            "T2F.3",
            "Hedging Register",
            "gap",
            "not provided — limitation L-04"
        ],
        [
            "T2F.4",
            "Unhedged Floating Exposure",
            "warning",
            "modeled from SFA only"
        ],
        [
            "T2F.5",
            "+100bps Rate Sensitivity",
            "warning",
            "−$12.1M on unhedged assumption"
        ],
        [
            "T2F.6",
            "FX Exposure Register",
            "ok",
            "LOW"
        ],
        [
            "T2F.7",
            "Commodity & Inflation Table",
            "ok",
            "pass-through 60–90d"
        ],
        [
            "T2F.8",
            "Macro Sensitivity Summary",
            "ok"
        ],
        [
            "T2F.9",
            "Gaps Ledger",
            "ok",
            "G-01"
        ],
        [
            "T2F.10",
            "Overall Macro / Hedging View",
            "ok"
        ]
    ],
    "CP-2G": [
        [
            "T2G.1",
            "Source Register",
            "gap",
            "Live run required — no reference finding"
        ],
        [
            "T2G.2",
            "Transition Risk Register",
            "gap",
            "Live output only"
        ],
        [
            "T2G.3",
            "Social Event-Risk Register",
            "gap",
            "Live output only"
        ],
        [
            "T2G.4",
            "Materiality Table",
            "gap",
            "Live output only"
        ],
        [
            "T2G.5",
            "KPI / SPT / Ratchet Table",
            "gap",
            "Live output only"
        ],
        [
            "T2G.6",
            "Demand / Access Implications",
            "gap",
            "Live output only"
        ],
        [
            "T2G.7",
            "ESG Credit Implication Table",
            "gap",
            "Live output only"
        ],
        [
            "T2G.8",
            "Gaps Ledger",
            "gap",
            "Live output only"
        ],
        [
            "—",
            "Overall Credit View & CP-6A Handoff",
            "gap",
            "Live output only"
        ]
    ],
    "CP-3": [
        [
            "T3.1",
            "Source Register + Execution Mode",
            "ok"
        ],
        [
            "—",
            "Fundamental Credit Summary",
            "ok"
        ],
        [
            "T3.3",
            "Issuer / Security Scorecard",
            "ok",
            "71 / 100"
        ],
        [
            "T3.4",
            "Override Review",
            "ok",
            "0 overrides"
        ],
        [
            "T3.5",
            "Relative Value Table",
            "warning",
            "ex-E-44 band carried"
        ],
        [
            "T3.6",
            "Fundamental Value Matrix",
            "ok"
        ],
        [
            "T3.7",
            "Final Ranking",
            "ok",
            "2 of 7"
        ],
        [
            "—",
            "Security Selection Conclusions",
            "ok"
        ],
        [
            "T3.9",
            "Monitoring Triggers",
            "ok"
        ],
        [
            "T3.10",
            "Gaps Ledger",
            "ok"
        ],
        [
            "—",
            "Final Credit / RV View",
            "ok"
        ]
    ],
    "CP-3B": [
        [
            "T3B.1",
            "Instrument Data Gate",
            "ok"
        ],
        [
            "T3B.2",
            "Capital Structure Dashboard",
            "ok"
        ],
        [
            "T3B.3",
            "Instrument Matrix",
            "ok"
        ],
        [
            "T3B.4",
            "Structural Positioning Log",
            "ok"
        ],
        [
            "T3B.5",
            "Legal / Covenant / LME Overlay",
            "ok"
        ],
        [
            "T3B.6",
            "Recovery Sensitivity Table",
            "ok",
            "5.0–7.5x grid"
        ],
        [
            "T3B.7",
            "Compensation Cross-Check",
            "ok"
        ],
        [
            "T3B.8",
            "Preference Decision Table",
            "ok",
            "2L TL over TLB"
        ],
        [
            "—",
            "Ranking & Trade-Off Summary",
            "ok"
        ],
        [
            "T3B.10",
            "Monitoring Triggers",
            "ok"
        ],
        [
            "T3B.11",
            "Gaps Ledger",
            "ok"
        ],
        [
            "—",
            "Overall Instrument Preference View",
            "ok"
        ]
    ],
    "CP-3C": [
        [
            "T3C.1",
            "Portfolio Input Gate",
            "ok"
        ],
        [
            "T3C.2",
            "Portfolio Fit Register",
            "ok"
        ],
        [
            "T3C.3",
            "Position Sizing Posture Table",
            "ok"
        ],
        [
            "T3C.4",
            "Risk Budget Flags",
            "warning",
            "B3 bucket 91% utilized"
        ],
        [
            "T3C.5",
            "Concentration & Correlation Register",
            "ok"
        ],
        [
            "T3C.6",
            "Liquidity & Implementation",
            "ok"
        ],
        [
            "T3C.7",
            "Downside Budget & Recovery Sensitivity",
            "ok"
        ],
        [
            "T3C.8",
            "Monitoring / Add-Trim Triggers",
            "ok"
        ],
        [
            "T3C.9",
            "Gaps Ledger",
            "ok"
        ],
        [
            "—",
            "Overall Portfolio Fit View",
            "ok"
        ]
    ],
    "CP-3D": [
        [
            "T3D.1",
            "Source Register & Module Status",
            "ok"
        ],
        [
            "T3D.2",
            "Maturity Wall Register",
            "ok"
        ],
        [
            "T3D.3",
            "Liquidity / Market Access Table",
            "ok"
        ],
        [
            "T3D.4",
            "Legal Capacity for LME",
            "warning",
            "uptier path OPEN"
        ],
        [
            "T3D.5",
            "Sponsor Willingness Table",
            "ok"
        ],
        [
            "T3D.6",
            "Refinancing Path Table",
            "ok"
        ],
        [
            "T3D.7",
            "Vulnerability Score Table",
            "ok",
            "4 / 10"
        ],
        [
            "T3D.8",
            "Creditor Class Exposure Table",
            "ok"
        ],
        [
            "T3D.9",
            "Monitoring Triggers",
            "ok"
        ],
        [
            "T3D.10",
            "Scenario Map (base / stress / LME)",
            "ok"
        ],
        [
            "T3D.11",
            "Gaps Ledger",
            "ok"
        ],
        [
            "—",
            "Overall Refinancing / LME View",
            "ok"
        ]
    ],
    "CP-4": [
        [
            "T4.1",
            "Source Gate + Module Status",
            "ok"
        ],
        [
            "T4.2",
            "Controlling Document Register",
            "ok",
            "executed docs control"
        ],
        [
            "T4.3",
            "Covenant Feature Register",
            "ok",
            "41 provisions"
        ],
        [
            "—",
            "EBITDA, Definitions & Ratio Mechanics",
            "ok"
        ],
        [
            "—",
            "Debt Incurrence, Incremental & MFN",
            "ok"
        ],
        [
            "—",
            "Leakage, RP, Investments & Transfers",
            "ok"
        ],
        [
            "—",
            "Collateral, Guarantees & Subordination",
            "ok"
        ],
        [
            "—",
            "EoD, Remedies & Amendment Risk",
            "ok"
        ],
        [
            "T4.9",
            "PD vs LGD / Recovery Translation",
            "ok"
        ],
        [
            "T4.10",
            "Market Norm Comparison",
            "ok",
            "vs 6.1 norm"
        ],
        [
            "T4.11",
            "Aggressiveness Score",
            "ok",
            "7.2 / 10 — Aggressive"
        ],
        [
            "T4.12",
            "Red Flags & Monitoring Triggers",
            "warning",
            "MFN sunset · RP capacity"
        ],
        [
            "T4.13",
            "Gaps Ledger",
            "ok"
        ],
        [
            "—",
            "Overall Legal Credit View",
            "ok"
        ]
    ],
    "CP-4D": [
        [
            "T4D.1",
            "Source Gate Register",
            "gap",
            "Live run required — no reference finding"
        ],
        [
            "T4D.2",
            "Restricted / Unrestricted Entity Register",
            "gap",
            "Live output only"
        ],
        [
            "T4D.3",
            "Guarantor Coverage Matrix",
            "gap",
            "Live output only"
        ],
        [
            "T4D.4",
            "Collateral-by-Entity Matrix",
            "gap",
            "Live output only"
        ],
        [
            "T4D.5",
            "Structural Priority Table",
            "gap",
            "Live output only"
        ],
        [
            "T4D.6",
            "Drop-down / Transfer Capacity Register",
            "gap",
            "Live output only"
        ],
        [
            "T4D.7",
            "Priming-Exposure Findings",
            "gap",
            "Live output only"
        ],
        [
            "T4D.8",
            "Gaps Ledger",
            "gap",
            "Live output only"
        ],
        [
            "—",
            "Overall Structural View & Handoffs",
            "gap",
            "Live output only"
        ]
    ],
    "CP-4C": [
        [
            "T4C.1",
            "Source Gate + Module Status",
            "ok"
        ],
        [
            "T4C.2",
            "Controlling Capacity Source Map",
            "ok"
        ],
        [
            "T4C.3",
            "Definition & Ratio Mechanics Register",
            "ok"
        ],
        [
            "T4C.4",
            "Headroom Table",
            "ok"
        ],
        [
            "T4C.5",
            "Capacity Register",
            "ok",
            "$612M day-one"
        ],
        [
            "T4C.6",
            "Debt / Lien / Priming Analysis",
            "warning",
            "priming MEDIUM-HIGH"
        ],
        [
            "T4C.7",
            "RP / Leakage Analysis",
            "warning",
            "$240M builder basket"
        ],
        [
            "T4C.8",
            "Add-Back Inflation Analysis",
            "warning",
            "18.2% of adj. EBITDA"
        ],
        [
            "T4C.9",
            "Leakage & Basket Flags",
            "ok"
        ],
        [
            "—",
            "Nearest Pressure Point",
            "ok",
            "MFN sunset Jun-27"
        ],
        [
            "T4C.11",
            "Capacity Risk Priority Matrix",
            "ok"
        ],
        [
            "T4C.12",
            "Gaps Ledger",
            "ok"
        ],
        [
            "—",
            "Overall Covenant Capacity View",
            "ok"
        ]
    ],
    "CP-5": [
        [
            "T5.1",
            "Input Module Register",
            "ok",
            "24 modules"
        ],
        [
            "T5.2",
            "Citation & Evidence Audit",
            "warning",
            "QA-117 HIGH open"
        ],
        [
            "T5.3",
            "Math / Logic / Definition Audit",
            "ok",
            "0 defects"
        ],
        [
            "T5.4",
            "Legal / Structural Claim Audit",
            "ok"
        ],
        [
            "T5.5",
            "RV / Market Claim Audit",
            "ok"
        ],
        [
            "T5.6",
            "Consistency & Version Audit",
            "ok"
        ],
        [
            "T5.7",
            "Committee-Readiness Audit",
            "warning",
            "pack HELD"
        ],
        [
            "T5.8",
            "Export & Evidence Trace Audit",
            "ok"
        ],
        [
            "T5.9",
            "Consolidated Issue Log",
            "ok",
            "1 HIGH · 2 LOW"
        ],
        [
            "—",
            "Remediation Priority Map",
            "ok"
        ],
        [
            "—",
            "Clearance Decision",
            "warning",
            "CONDITIONAL"
        ]
    ],
    "CP-5B": [
        [
            "T5B.1",
            "Source Register & Readiness",
            "ok"
        ],
        [
            "T5B.2",
            "Top-5 Material Credit Drivers",
            "ok"
        ],
        [
            "T5B.3",
            "Traceability Map",
            "ok"
        ],
        [
            "T5B.4",
            "Source Lineage Register",
            "ok"
        ],
        [
            "T5B.5",
            "Calculation & Assumption Register",
            "ok"
        ],
        [
            "T5B.6",
            "Weak-Lineage Flags",
            "warning",
            "driver #5 (E-44)"
        ],
        [
            "T5B.7",
            "Auditability Assessment",
            "ok",
            "STRONG"
        ],
        [
            "T5B.8",
            "Gaps Ledger",
            "ok"
        ],
        [
            "—",
            "Overall Traceability View",
            "ok"
        ]
    ],
    "CP-6A": [
        [
            "—",
            "IC Debate Source Gate",
            "ok"
        ],
        [
            "—",
            "Pre-Debate Thesis Map",
            "ok"
        ],
        [
            "—",
            "Bull Opening Statement",
            "ok",
            "3 claims"
        ],
        [
            "T6A.4",
            "Bear Cross-Examination",
            "ok",
            "4 attacks"
        ],
        [
            "—",
            "Bull Defense",
            "ok",
            "1 concession (E-44)"
        ],
        [
            "T6A.6",
            "Chair Evidence Weighting",
            "ok",
            "5 claims scored"
        ],
        [
            "T6A.7",
            "Debate Resolution Matrix",
            "ok"
        ],
        [
            "—",
            "Action Bias Determination",
            "ok",
            "CONSTRUCTIVE — add on weakness"
        ],
        [
            "—",
            "Single Greatest Uncertainty",
            "ok",
            "add-back realization"
        ],
        [
            "—",
            "IC Chair Final Memo",
            "ok"
        ],
        [
            "T6A.11",
            "Gaps Ledger",
            "ok"
        ]
    ],
    "CP-6E": [
        [
            "—",
            "Portfolio Debate Source Gate",
            "ok"
        ],
        [
            "—",
            "Pre-Debate Portfolio Thesis Map",
            "ok"
        ],
        [
            "—",
            "RV Trader's Pitch",
            "ok",
            "3 bullets"
        ],
        [
            "T6E.4",
            "Compliance Officer's Attack",
            "ok"
        ],
        [
            "—",
            "RV Trader's Defense",
            "ok",
            "sizing constraint proposed"
        ],
        [
            "T6E.6",
            "CIO Evidence Weighting",
            "ok"
        ],
        [
            "T6E.7",
            "Allocation Decision Matrix",
            "ok"
        ],
        [
            "—",
            "Final Sizing Posture",
            "ok",
            "75 → 125bps"
        ],
        [
            "—",
            "Exact Portfolio Constraint",
            "ok",
            "B3 bucket headroom"
        ],
        [
            "—",
            "CIO Final Memo",
            "ok"
        ],
        [
            "T6E.11",
            "Gaps Ledger",
            "ok"
        ]
    ]
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/deepdive/step-notes.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// AUTO-PORTED from the Credit OS design bundle (shared/deal-modules.js + deal-step-notes.js).
// ATLF demo data — replace with live module outputs when CP backend persistence lands.
__turbopack_context__.s([
    "STEP_NOTES",
    ()=>STEP_NOTES
]);
const BASE = {
    "CP-0:Gap Logging": {
        body: "Two gaps logged at intake. G-01 (hedging register / swap confirms) degrades CP-2F to SFA-margin modeling and propagates as limitation L-04. G-02 (Q4-25 management accounts) forces CP-1 to construct Q4-25 as a derived period from the sponsor model at [Analyst estimate] status. Neither gap blocks the route; both carry degraded-mode instructions and re-request dates (Jun 04)."
    },
    "CP-0:Downstream Readiness": {
        body: "Readiness scored 0.91 against the 0.85 full-run threshold. All 24 analytical modules are routable; CP-2F is the only consumer entering degraded mode. The readiness register, master index and intake export were assembled and handed to CP-X."
    },
    "CP-X:Route Plan Source Gate": {
        body: "Gate status READY WITH LIMITATIONS — CP-0 readiness 0.91 admits a full run, with G-01 carried as limitation L-04 rather than a blocker. Route template v2.2 selected for a new-issue committee review."
    },
    "CP-X:Limitation Propagation Register": {
        body: "L-04 (no hedging register) attaches to every CP-2F output object and surfaces to CP-6A so the Chair weights macro claims accordingly. G-02 attaches a derived-period caveat to CP-1 T4.8 and to CP-1B quarterly comparisons."
    },
    "CP-X:Route Plan Summary": {
        body: "24 modules sequenced across 8 waves; one-owner-per-object validation clean (0 collisions); the J1 join holds the debate layer until every analytical feeder lands. Expected wall-clock ~46 minutes at current concurrency."
    },
    "CP-1:Normalization Register": {
        body: "12 periods normalized to a single chart of accounts with FX, 53-week and discontinued-ops adjustments logged line-by-line, each with an audit-trail reference. Tie-out to audited financials within 0.3% on every line."
    },
    "CP-1:Derived Period Register": {
        ev: [
            "E-58"
        ],
        body: "Q4-25 constructed from the sponsor model (gap G-02): derived as FY25 audited less reported Q1–Q3. Stored at [Analyst estimate] status and flagged to CP-1B so quarterly variance work does not over-read the period."
    },
    "CP-1:Calc Register + KPI Build": {
        ev: [
            "E-22",
            "E-103"
        ],
        body: "41 KPIs registered with formula, inputs and Python calc references — leverage, coverage, FCF conversion (K-22) and covenant EBITDA (K-09) among them. Every figure consumed downstream resolves to this register, never to ad-hoc math."
    },
    "CP-1:Definition Conflict Register": {
        ev: [
            "E-09",
            "E-103"
        ],
        body: "Two conflicts logged, not silently reconciled: (1) the SFA caps cost-saving add-backs at 25% over 24 months while the 2L credit agreement is uncapped — covenant calculations diverge by $14.2M; (2) the sponsor model's EBITDA basis differs from the audited presentation."
    },
    "CP-1:Gaps + Downstream Readiness": {
        body: "Coverage gate GREEN — all three statements present at quarterly grain FY23–LTM. G-02 carried as the only open item. All 11 downstream consumers cleared to start."
    },
    "CP-1A:Operating Model": {
        ev: [
            "E-12",
            "E-31"
        ],
        body: "Three-segment model: Drivetrain (46% revenue), Fluid Systems (31%), Aftermarket & Services (23% revenue / 44% gross profit). 71% of COGS is indexed pass-through with a 60–90 day lag; aftermarket attaches to a 1.9M-unit installed base renewing at 92%."
    },
    "CP-1A:Credit Translation": {
        ev: [
            "E-12",
            "E-15"
        ],
        body: "The installed-base annuity is the core credit support; top-3 OEM concentration (38%) is the principal structural weakness, concentrated in Drivetrain. Both translated into transmission mechanics and handed to CP-2 / CP-2B."
    },
    "CP-1B:Variance Analysis": {
        ev: [
            "E-58"
        ],
        body: "Q1-26 actuals $108M vs sponsor model $112.7M (−4.2%); shortfall concentrated in Fluid Systems volume (−$3.1M) and cost-out phasing (−$1.6M). Conflict logged to CP-5; the model is demoted to upside case."
    },
    "CP-1B:Overall Earnings View": {
        body: "Earnings trajectory intact — +6.2% LTM EBITDA growth, book-to-bill 1.06x, realized price (+180bps) running ahead of input inflation (+140bps). The sponsor model runs hot; CP-1 normalized actuals are the base."
    },
    "CP-1C:Metric Alignment Register": {
        ev: [
            "E-44"
        ],
        body: "Peer metrics aligned to CP-1 definitions before comparison. The peer EBITDA margin set cites CIM Annex C p.388, which actually contains the auditor consent letter — raised as QA-117 (HIGH). Benchmark conclusions are carried ex-E-44 pending re-anchor."
    },
    "CP-1C:Transaction Comps": {
        body: "Only two clean transaction datapoints in-perimeter (Hartwell bolt-on '23 at 6.4x; one sector take-private '24 at 7.8x). Thin set — used directionally for the implied-EV cross-check only and flagged as a limitation."
    },
    "CP-1C:Overall Peer Benchmarking View": {
        ev: [
            "E-71"
        ],
        body: "Subject screens +61bps wide of the B2 median with top-quartile FCF conversion and above-median margin. Ex-E-44 the cheapness compresses to +20–25bps — still positive carry against fundamentals."
    },
    "CP-2:Financial Profile & Credit Quality": {
        body: "9-dimension scorecard: EBITDA quality and leverage score weakest (add-backs 18.2% of adj. EBITDA); FCF conversion and revenue durability strongest. Composite lands mid-B2, consistent with agency ratings."
    },
    "CP-2B:Downside Pathway Register": {
        body: "Three pathways, each with an explicit transmission chain. P1 (OEM destocking) is the fastest — Drivetrain volumes −12% over two quarters with absorption deleverage compounding to −18% EBITDA, at 25% probability."
    },
    "CP-2C:Catalyst Calendar": {
        body: "Nine catalysts inside 12 months, front-loaded into H2-26 reporting. The Q3-26 compliance certificate is the thesis-defining print — wired to trigger T-1 and a CP-6A re-vote if add-back realization lands under $30M."
    },
    "CP-2D:Behavior Flag Register": {
        ev: [
            "E-91"
        ],
        body: "Two flags: dividend-recap history at two Fund IV portfolio companies within 24 months of a refinancing window, and RP builder-basket pre-positioning ($240M with no stated use). Fund VI close logged as an offsetting support-capacity INFO flag."
    },
    "CP-2E:12-Month Liquidity Bridge": {
        ev: [
            "E-77"
        ],
        body: "Bridge nets +$96M over 12 months from $379M beginning accessible liquidity (cash $184M + accessible RCF $195M net of LCs). Largest uses: cash interest $196M, capex $121M, working-capital trough $43M."
    },
    "CP-2E:Months to Empty Result": {
        ev: [
            "E-77"
        ],
        body: "19.3 months base case; 14.0 under CP-2B pathway P1 with the springing covenant untested (utilization 22% vs 40% trigger). Calculated only because both inputs are source-supported, per module calculation rules."
    },
    "CP-2F:Hedging Register": {
        body: "Not producible: the hedging register and swap confirms were not provided (gap G-01). Per prohibited-behavior rules the register is marked [Insufficient Information] rather than assumed. Floating exposure is modeled from SFA margins only and every consumer sees limitation L-04."
    },
    "CP-2F:+100bps Rate Sensitivity": {
        body: "+100bps in base rates costs ~$12.1M of FCF (7% of LTM FCF) on the fully-unhedged assumption. The figure is an upper bound — any undisclosed hedges would reduce it. Resolution of G-01 re-rates this table."
    },
    "CP-3:Relative Value Table": {
        ev: [
            "E-71",
            "E-44"
        ],
        body: "Subject at +388 vs fair band +325–340 → +48–63bps cheap to model. The band leans on E-44; the ex-E-44 construction (sector beta regression) still shows +20–25bps. Both bands carried until QA-117 resolves."
    },
    "CP-3B:Recovery Sensitivity Table": {
        body: "2L recovery spans 21–100% across the 5.0–7.5x multiple / $295–421M EBITDA grid. The cliff sits below 5.5x on stressed EBITDA, where 1L claims consume the estate before the 2L attaches."
    },
    "CP-3B:Preference Decision Table": {
        body: "2L TL preferred over the TLB: +210bps of spread pickup for an acceptable recovery delta at the 6.0x stress point. Sub notes rejected on priming exposure and thin covenant protection."
    },
    "CP-3C:Risk Budget Flags": {
        body: "The B3-or-below bucket at 91% utilization is the binding flag — max sizing (125bps) requires a same-day headroom re-test. All other budgets (issuer, sector, sponsor, correlation) pass with material headroom."
    },
    "CP-3D:Legal Capacity for LME": {
        ev: [
            "E-63",
            "E-64"
        ],
        body: "Uptier path OPEN: $612M day-one incremental capacity, sacred-rights amendment vote at 50.1%, and MFN protection sunsetting June 2027. No J.Crew/Chewy blockers — the capacity is real and is priced via sizing, not exclusion."
    },
    "CP-3D:Vulnerability Score Table": {
        body: "4/10 today — no near-term wall, genuine FCF, open market access. Re-rates to 7/10 if P1 stress coincides with the 2029 TLB refinancing approach, when legal capacity meets motive."
    },
    "CP-4:Aggressiveness Score": {
        body: "7.2/10 — Aggressive tier vs the 2026 single-B market norm of 6.1. Driven by uncapped credit agreement add-backs, $612M day-one capacity and the 12-month MFN sunset; partially offset by full guarantor coverage and the absence of an unrestricted-sub transfer basket."
    },
    "CP-4:Red Flags & Monitoring Triggers": {
        ev: [
            "E-63",
            "E-64"
        ],
        body: "Two red flags wired to standing triggers: any incremental raise above $200M inside the MFN sunset (T-2) and any RP-basket activation (T-4). Both route to a CP-3B re-rank and CP-6E sizing review on trip."
    },
    "CP-4C:Capacity Register": {
        ev: [
            "E-63"
        ],
        body: "Freebie $150M (grower ≈ 35% × EBITDA) + ratio capacity $310M at 4.68x secured leverage + reclassification headroom $155M = $612M day-one, incurrable senior or pari passu to the 2L TL."
    },
    "CP-4C:Add-Back Inflation Analysis": {
        ev: [
            "E-09",
            "E-87"
        ],
        body: "Add-backs run at 18.2% of adj. EBITDA and feed every grower basket — capacity inflates mechanically with each 'one-time' charge. CP-1's recurrence finding (charges in 3 of the last 4 years) makes the inflation structural, not episodic."
    },
    "CP-4C:Nearest Pressure Point": {
        ev: [
            "E-64"
        ],
        body: "The MFN sunset, June 2027. After it, a priming or pari incremental raise carries no yield protection for 2L lenders — the single most consequential date in the document set."
    },
    "CP-5:Citation & Evidence Audit": {
        ev: [
            "E-44"
        ],
        body: "All 24 modules audited; 1,142 citations resolved against the source vault. One HIGH defect: CP-1C's E-44 anchors to the wrong page of the conformed CIM (QA-117). No fabricated or orphaned citations found."
    },
    "CP-5:Consolidated Issue Log": {
        body: "One HIGH open (QA-117), two LOW resolved in-run (CP-2C probability labeling; CP-3 rounding). The HIGH finding blocks committee-pack assembly under clearance policy — no override path short of remediation."
    },
    "CP-5:Clearance Decision": {
        body: "CONDITIONAL — CP-RENDER and CP-EXTRACT held until remediation R-1 lands (re-anchor E-44, re-run CP-1C alignment, refresh CP-3 and the CP-6A weighting row). Math, legal, market and consistency audits are clean."
    },
    "CP-5B:Weak-Lineage Flags": {
        ev: [
            "E-44"
        ],
        body: "Driver #5's chain terminates at a mismatched anchor (E-44) and is flagged weak; remediation is owned by CP-5 R-1. The remaining four drivers trace to grade-A sources within three hops."
    },
    "CP-5B:Auditability Assessment": {
        body: "STRONG — every figure in the committee pack resolves to a registered evidence ID and a calc-register reference. Reconstruction time for any material number is under two minutes from the master index."
    },
    "CP-6A:Chair Evidence Weighting": {
        body: "Five contested claims scored bull/bear across nine evidence dimensions. Bear prevails on EBITDA quality (65/35) and documentation (75/25); bull prevails on aftermarket stickiness (80/20); RV is split pending QA-117."
    },
    "CP-6A:Action Bias Determination": {
        body: "CONSTRUCTIVE — add on weakness. The bear case is real but priced at +388: haircut the base case by $35M of EBITDA, size below max, and let carry plus deleveraging do the work."
    },
    "CP-6A:Single Greatest Uncertainty": {
        ev: [
            "E-103"
        ],
        body: "Add-back realization. If the Q3-26 certificate shows under $30M realized, base-case deleveraging fails and the position reverts to a 6.9x credit bought at a 5.7x price — trigger T-1 forces the re-vote."
    },
    "CP-6E:Final Sizing Posture": {
        body: "75bps initial at +388 or wider; path to the 125bps max is gated on trigger T-1 (Q3-26 add-back certificate) and a same-day B3-bucket headroom check. Add-on-weakness, with a standing limit order at +400bps."
    },
    "CP-6E:Exact Portfolio Constraint": {
        body: "The binding constraint is the B3-or-below quality bucket at 91% utilization — not issuer, sector, sponsor or correlation limits. Any add must re-test the bucket on trade date; this is encoded in the sizing decision."
    }
};
const EXT = {
    /* ---- CP-0 · Document Intake ---- */ "CP-0:File Classification": {
        body: "All 14 deal-room files typed against the document taxonomy on first pass — CIM, SFA, 2L credit agreement, audited financials, compliance certificate, lender presentation and sponsor model extract. No unclassifiable or corrupted files."
    },
    "CP-0:Entity Identification": {
        body: "Issuer perimeter resolved to Atlas Forge Intermediate Holdings, Inc., with Atlas Forge Industrials as the operating group. Guarantor set and the Kestrel ownership chain registered so every downstream module cites one canonical entity key."
    },
    "CP-0:Document Mapping": {
        body: "Each document mapped to its consuming modules: CIM and audits to the L1 financial modules, SFA and credit agreement to CP-4/4C, the compliance certificate to covenant calculations, the lender presentation and sponsor model (MNPI-handled) to CP-1B and CP-2D."
    },
    "CP-0:Quality Assignment": {
        body: "Grades assigned A–C: executed legal documents and audited financials grade A; lender presentation grade B (sponsor-prepared, MNPI); sponsor model extract grade C — unaudited, admissible only with [Analyst estimate] labeling."
    },
    "CP-0:Content-Module Mapping": {
        body: "Section-level routing complete — CIM Annex C to CP-1C, credit agreement §4.07/§4.09 to CP-4C, MD&A liquidity disclosure to CP-2E. 312 content anchors registered to the master index."
    },
    "CP-0:Conflict Logging": {
        body: "Zero unresolved conflicts at intake: CIM summary financials tie to the audited statements within tolerance, and the certificate's covenant EBITDA reconciles to the SFA definition."
    },
    "CP-0:File Quality Risk": {
        body: "Aggregate file-quality risk LOW: every thesis-critical claim is coverable from grade-A sources. Grade-C material (sponsor model) is confined to upside-case and variance work."
    },
    "CP-0:Master Index Update": {
        body: "Master index rebuilt: 14 documents, 312 content anchors, 2 open gaps — the single addressable map that every E-xx citation resolves against."
    },
    "CP-0:Export Assembly": {
        body: "Intake export assembled and handed to CP-X: document map, quality grades, gap/conflict logs and the 0.91 readiness score in one routable package."
    },
    /* ---- CP-X · Orchestration ---- */ "CP-X:Module Execution Sequence": {
        body: "24 modules sequenced into 8 dependency waves: financial spreading before synthesis, legal and RV before the debate layer, governance last at the J1 join. No circular dependencies detected."
    },
    "CP-X:Module Readiness Register": {
        body: "All 24 modules report GREEN inputs at route time. CP-2F enters in degraded mode (L-04) but remains routable; no module is blocked on missing sources."
    },
    "CP-X:One-Owner-Per-Object Validation": {
        body: "Every output object has exactly one producing module — 0 collisions. Capacity math is owned by CP-4C, recovery math by CP-3B; consumers reference, never recompute."
    },
    "CP-X:Source-to-Module Routing Map": {
        body: "Routing locked: each document section routes to its owning module with MNPI handling preserved (D-06 / D-07 restricted to walled consumers). 100% of grade-A anchors claimed."
    },
    /* ---- CP-1 · Financial Spreading ---- */ "CP-1:Source Register (file gate)": {
        body: "File gate PASS — audited FY23–FY25 statements, Q1-26 interims and the compliance certificate admitted as the spreading basis. Sponsor model admitted at grade C for derived-period work only."
    },
    "CP-1:Entity / Period Key": {
        body: "Single entity key (Atlas Forge Intermediate Holdings) and a 12-period quarterly grid FY23–LTM Q1-26 fixed before any spreading. All downstream KPIs cite this key."
    },
    "CP-1:Income Statement Coverage": {
        body: "Income statement covered at quarterly grain for all 12 periods — revenue through adjusted EBITDA with the add-back bridge preserved as separate lines, never netted away."
    },
    "CP-1:Cash Flow Statement Coverage": {
        ev: [
            "E-22"
        ],
        body: "Cash flow coverage complete: operating cash, capex and free cash flow reconciled to the audited statements for every period. No plugged figures."
    },
    "CP-1:Balance Sheet Coverage": {
        body: "Balance sheet covered for all periods; the net debt build ($2,391M LTM) reconciles to the facility-level debt schedule consumed by CP-3B's capital structure dashboard."
    },
    "CP-1:Normalized Financials Table": {
        ev: [
            "E-103"
        ],
        body: "The published normalized table: revenue $2,801M LTM, adj. EBITDA $421M at 15.0% margin, FCF $172M, net leverage 5.68x — the canonical figures every downstream module consumes."
    },
    "CP-1:Evidence→Risk→Credit Narrative": {
        ev: [
            "E-09"
        ],
        body: "Spreading translated into credit language: real FCF generation and stable margins support the credit; the $76.6M add-back wedge (18.2% of adj. EBITDA) is the headline quality risk handed to CP-2 and CP-4C."
    },
    /* ---- CP-1A · Company Profile ---- */ "CP-1A:Source Basis Establishment": {
        body: "Descriptive basis fixed to the CIM business section and audited segment notes. The lender presentation is used for color only, with every claim cross-checked to a grade-A anchor."
    },
    "CP-1A:Source Classification": {
        body: "Sources split factual vs promotional: CIM risk factors and audit notes drive the record; sponsor-authored growth claims are quarantined under [Sponsor view] labeling."
    },
    "CP-1A:Transaction Summary": {
        body: "Subject transaction: $900M 2L TL '31 at S+425, refinancing the 2L bridge plus general corporate purposes — the fifth capital-structure event since the 2021 Kestrel LBO at 7.9x."
    },
    "CP-1A:Business Description": {
        body: "Engineered metal components for industrial OEMs — 14 plants across US / EU / MX, a 1.9M-unit installed base, and #1 or #2 share in 7 of 9 core product lines."
    },
    "CP-1A:Ownership Register": {
        body: "Kestrel Capital Fund V controls 68.4%; management rollover 9.2%; co-invest vehicles 22.4%. Board is 1-of-7 independent — registered for CP-2D's governance work."
    },
    "CP-1A:History / Timeline": {
        body: "Timeline registered: 2021 LBO ($2,150M EV, 7.9x) → 2023 Hartwell bolt-on (6.4x) → 2024 repricing + $250M incremental TLB → 2026 2L TL refinance. The pattern: steady re-leveraging events."
    },
    "CP-1A:Gaps Ledger": {
        body: "No descriptive gaps — org chart, segment detail and plant footprint all source-supported. Carve-out detail on the MX facility noted as thin but non-material."
    },
    "CP-1A:Module Summary": {
        body: "A scaled, defensible industrial franchise with an annuity-grade aftermarket attached to a concentrated OEM book — descriptive facts handed clean to CP-2."
    },
    /* ---- CP-1B · Earnings Monitor ---- */ "CP-1B:File Gate & Source Validation": {
        body: "Gate PASS on Q1-26 interims and the compliance certificate; sponsor model admitted as a comparison basis only (grade C). Q4-25 derived-period caveat inherited from CP-1."
    },
    "CP-1B:Issuer / Period Scope": {
        body: "Scope locked to the last four quarters against CP-1's normalized history — same entity key, same definitions, no restated comparatives."
    },
    "CP-1B:Definition Inheritance": {
        body: "All KPI definitions inherited from the CP-1 calc register unchanged — margins, leverage and FCF conversion computed identically, so variances are real rather than definitional."
    },
    "CP-1B:Summary Top Sheet": {
        body: "Top sheet: Q1-26 revenue $715M (+3.9% y/y), adj. EBITDA $108M at 15.1% margin, book-to-bill 1.06x — trajectory intact against both prior year and sequential quarters."
    },
    "CP-1B:Financial Performance Table": {
        body: "Quarterly performance published Q2-25 through Q1-26: revenue compounding ~1.3% sequentially with margin pinned in a 14.9–15.1% band."
    },
    "CP-1B:KPI Dashboard": {
        body: "41 KPIs refreshed. Aftermarket mix grinding up (22.4% → 23.4% over four quarters) is the single most thesis-supportive operational trend in the dashboard."
    },
    "CP-1B:Corporate Actions": {
        body: "Two actions in window: the May-26 2L TL issuance itself and a Hartwell earnout settlement ($24M committed) — both reflected in CP-2E's liquidity bridge."
    },
    "CP-1B:Comparative Evaluation": {
        body: "Against the CP-1C peer set, the Q1 print was middle-of-pack on growth but top-quartile on margin stability. No peer-relative deterioration detected."
    },
    "CP-1B:Conflict Log": {
        ev: [
            "E-58"
        ],
        body: "One conflict: sponsor-model FY26E EBITDA phasing vs actuals (−4.2% in Q1). Logged to CP-5; the model is demoted to upside case rather than silently averaged in."
    },
    "CP-1B:Monitoring Assessment": {
        body: "Monitoring wired to the Q2-26 print (Jul 28): add-back realization, Fluid Systems volume recovery and book-to-bill are the three watch items handed to CP-2C."
    },
    "CP-1B:Gaps & Limitations Ledger": {
        body: "The Q4-25 derived-period caveat (G-02) is the only open limitation; quarterly comparisons crossing that period are flagged in-table."
    },
    /* ---- CP-1C · Peer Benchmarking ---- */ "CP-1C:Peer Discovery Gate": {
        body: "Peer discovery admitted 11 candidates from sector screens; 4 dropped for business-mix mismatch, leaving a 7-name universe of single-B engineered-components credits."
    },
    "CP-1C:Peer Data Gate": {
        body: "Peer financials sourced from public filings and the CIM industry annex. Data sufficiency PASS for 7 of 7 on the core metric set (margin, leverage, FCF, spread)."
    },
    "CP-1C:Peer Universe Register": {
        body: "Universe registered: Forgeline, Karst, Veldt, Ironvale, Cascadia, Tarn + subject — comparable scale ($1.5–3.5B revenue), B1–B3 rating band, same OEM / aftermarket structure."
    },
    "CP-1C:Operating Benchmark": {
        body: "Subject's 15.0% EBITDA margin ranks 64th percentile; revenue growth in line with peer median; aftermarket mix second-highest in the set behind Veldt."
    },
    "CP-1C:Cash Flow & Capital Intensity": {
        ev: [
            "E-22"
        ],
        body: "Capex at 4.3% of revenue is the second-lightest in the universe; 41% FCF conversion is top-quartile — the clearest fundamental edge over the peer set."
    },
    "CP-1C:Credit Metric Benchmark": {
        body: "Published 4C table: subject at 5.7x / 15.0% / 41% / +388 vs the B2 median's 5.5x / 13.9% / 31% / +327 — modestly more levered, meaningfully better converting."
    },
    "CP-1C:Summary Statistics": {
        body: "Medians computed ex-Tarn (distressed outlier): net leverage 5.5x, margin 13.9%, DM +327. The subject sits +61bps wide of median on better fundamentals."
    },
    "CP-1C:Outlier Register": {
        body: "Tarn Engineered (B3 / CCC+, +577bps) excluded from medians as a distressed outlier; retained in the table for context. No other exclusions."
    },
    "CP-1C:Public Trading Comps": {
        body: "Listed comps (3 names) trade at 8.9–10.4x EV/EBITDA; the midpoint applied to the subject implies comfortable coverage through the 2L attachment point."
    },
    "CP-1C:Implied EV": {
        body: "Implied-EV cross-check: 9.5x midpoint × $421M ≈ $4.0B vs $3.3B total debt — an equity cushion exists at trading multiples, eroding only below ~7.9x."
    },
    "CP-1C:Peer Interpretation & Credit Translation": {
        body: "Translation: the market prices ATLF as an average B2 while fundamentals (FCF conversion, aftermarket mix) screen better-than-cohort — the basis for the RV cheap reading, carried ex-E-44."
    },
    "CP-1C:Gaps & Limitations Ledger": {
        body: "Two limitations: the E-44 anchor mismatch (QA-117) and the thin transaction-comp set. Both carried visibly on the conclusions rather than papered over."
    },
    /* ---- CP-2 · Credit Synthesis ---- */ "CP-2:Source Gate & Readiness": {
        body: "Gate PASS — consumes CP-1 / 1A / 1B / 1C published outputs only; no raw-document re-extraction. All four feeders GREEN at start."
    },
    "CP-2:Company Description": {
        body: "Descriptive frame inherited from CP-1A and condensed for committee use: scaled engineered-components platform, three segments, aftermarket annuity attached to a 1.9M-unit installed base."
    },
    "CP-2:Ownership & Group Structure": {
        body: "Kestrel control (68.4%) and the covenant-group perimeter confirmed; no orphaned value sits outside the restricted group — relevant given CP-4's transfer-basket findings."
    },
    "CP-2:Revenue Drivers & Pricing Power": {
        ev: [
            "E-31",
            "E-15"
        ],
        body: "Pricing power MODERATE: indexed pass-through on 71% of OEM COGS protects gross margin mechanically, but top-3 concentration caps realized pricing on the Drivetrain book."
    },
    "CP-2:Cost Structure & Margin Resilience": {
        body: "Margin resilience tested across FY22–LTM: a 14.9–15.1% band held through an input-cost spike cycle — the 60–90 day lag creates quarter noise, not structural erosion."
    },
    "CP-2:Capital Intensity & FCF Conversion": {
        ev: [
            "E-22"
        ],
        body: "Capex 4.3% of revenue with maintenance estimated at 2.9%; 41% FCF conversion is genuine and the strongest quantitative support in the credit."
    },
    "CP-2:Porter Five Forces": {
        body: "Five-forces read: supplier power LOW (indexed inputs), buyer power HIGH (OEM concentration), entry barriers HIGH (qualified-vendor lock-in), substitutes LOW, rivalry MODERATE."
    },
    "CP-2:PEST Analysis": {
        body: "PEST: the rate environment is the live macro channel (61% floating, modeled unhedged); reshoring policy is a mild tailwind for the US footprint; no material regulatory or social exposure."
    },
    "CP-2:SWOT Analysis": {
        body: "SWOT condensed — strengths: aftermarket annuity, FCF; weaknesses: add-back quality, OEM concentration; opportunities: Fund VI-backed bolt-ons; threats: a destocking cycle meeting the MFN sunset."
    },
    "CP-2:Key Strengths & Weaknesses": {
        body: "Net assessment: two durable strengths (annuity economics, cash conversion) against two structural weaknesses (EBITDA presentation, customer concentration) — neither side dominant."
    },
    "CP-2:Outlook, Tailwinds & Headwinds": {
        body: "Outlook STABLE: the order book supports low-single-digit growth. Headwinds are the Meridian repricing (Q2-27) and cost-out phasing risk into the FY26 add-back test."
    },
    "CP-2:Qualitative Downside Scenario": {
        body: "Qualitative downside: an OEM destocking cycle compresses Drivetrain while 'one-time' charges recur — quality risk and volume risk arriving together. Quantified by CP-2B as pathway P1."
    },
    "CP-2:Materiality Filter": {
        body: "23 candidate factors filtered to 6 material ones; immaterial color (FX translation, single-plant items) dropped so the issuer matrix stays decision-grade."
    },
    "CP-2:Issuer Matrix": {
        body: "Six material factors scored with trend and weight — published as the issuer matrix consumed directly by CP-6A's pre-debate thesis map."
    },
    "CP-2:Monitoring Triggers": {
        body: "Four standing triggers set: add-back realization (T-1), incremental raise inside the MFN window (T-2), Meridian repricing terms (T-3), RP-basket activation (T-4)."
    },
    "CP-2:Overall Credit View": {
        ev: [
            "E-09"
        ],
        body: "B2 / STABLE affirmed: deleveraging to ~4.9x by FY27 is credible on realized add-backs alone. The binding risks are documentation-enabled releveraging and the Meridian contract cycle."
    },
    /* ---- CP-2B · Downside Pathways ---- */ "CP-2B:Source Gate & Baseline": {
        body: "Gate PASS off CP-1 normalized actuals ($421M LTM adj. EBITDA) as the stress baseline — the sponsor model is explicitly excluded from stress arithmetic."
    },
    "CP-2B:Business Model Snapshot": {
        body: "Snapshot fixes the stress-relevant mechanics: 46% Drivetrain exposure, operating leverage across 14 plants, the pass-through lag, and the aftermarket buffer at 44% of gross profit."
    },
    "CP-2B:Fragility Map": {
        body: "Four fragilities mapped (F-1 absorption deleverage, F-2 OEM concentration, F-3 pass-through lag, F-4 covenant-capacity interaction) — each tied to an observable early indicator."
    },
    "CP-2B:Stress Transmission Table": {
        body: "Transmission quantified: a 10% Drivetrain volume decline translates to ~−14% EBITDA after absorption effects; aftermarket dampens but does not offset within two quarters."
    },
    "CP-2B:Downside Sensitivity Matrix": {
        body: "Sensitivity grid spans volume −5% to −15% against cost-out delivery 0–100%: EBITDA outcomes of $345–415M, with leverage holding under 7.0x in all but the corner case."
    },
    "CP-2B:Monitoring Sensitivity Flags": {
        body: "Three early-warning flags wired: OEM order intake (monthly), Drivetrain book-to-bill below 0.95x, and distributor inventory above 11 weeks."
    },
    "CP-2B:Cross-Module Handoff Register": {
        body: "Handoffs registered: P1 feeds CP-3D's stress-coincidence scenario, the sensitivity grid feeds CP-3B's stressed-EBITDA axis, and all pathway probabilities feed CP-6A."
    },
    "CP-2B:Gaps Ledger": {
        body: "No module-specific gaps; inherits the G-02 derived-period caveat on quarterly granularity only."
    },
    "CP-2B:Overall Downside Pathway View": {
        ev: [
            "E-77",
            "E-64"
        ],
        body: "No pathway breaks liquidity — P1 (worst) leaves 14 months-to-empty. The structural danger is sequencing: P1 arriving inside the open MFN window invites a priming raise at the cycle bottom."
    },
    /* ---- CP-2C · Catalyst Calendar ---- */ "CP-2C:Source Gate & Calendar Scope": {
        body: "Gate PASS; calendar scoped to 12 months forward with issuer, sponsor, sector and documentation event classes all in perimeter."
    },
    "CP-2C:Event Source Register": {
        body: "Events sourced from filing calendars, facility documents (compliance dates), Kestrel fund communications and sector OEM reporting schedules — each event carries a source anchor."
    },
    "CP-2C:Event Risk Register": {
        body: "Nine events registered with direction and mechanism — six issuer-specific, two sponsor-driven, one sector-wide (the OEM destocking data cycle)."
    },
    "CP-2C:Probability-Impact Matrix": {
        body: "The matrix places the Q3-26 compliance certificate and the Meridian repricing in the high-impact / high-probability quadrant; Kestrel exit commentary is high-impact / low-probability."
    },
    "CP-2C:Monitoring Priority Table": {
        body: "Priorities ranked: certificate prints first, OEM order data second, RP-basket activity third — mapped onto the CP-MON monitoring cadence."
    },
    "CP-2C:Watchlist Handoff Register": {
        body: "Three handoffs: T-1 (certificate) to a CP-6A re-vote, Meridian terms to a CP-2B P1 refresh, and Kestrel exit signals to a CP-2D posture review."
    },
    "CP-2C:Gaps & Limitations Ledger": {
        body: "Probabilities stated without basis were re-labeled [Analyst estimate] after QA-121 — resolved in-run; no open items."
    },
    "CP-2C:Overall Catalyst View": {
        body: "Event risk front-loads into H2-26 reporting. The calendar is wired so each catalyst routes to a named module action rather than passive watching."
    },
    /* ---- CP-2D · Sponsor & Governance ---- */ "CP-2D:Source Register & Readiness": {
        body: "Gate PASS off the CP-1A ownership register, the lender presentation (MNPI-handled) and Kestrel fund communications; READY."
    },
    "CP-2D:Ownership & Control Register": {
        body: "Control confirmed: Kestrel 68.4% with drag rights and board control (6 of 7 seats); management 9.2% rolled — alignment is sponsor-dominated."
    },
    "CP-2D:Governance Register": {
        body: "Governance is institutional but sponsor-controlled: 1 of 7 directors independent, the audit committee chaired by the independent, and a monthly lender-reporting cadence."
    },
    "CP-2D:Capital Allocation Risk Table": {
        body: "Allocation history scored: bolt-on M&A is disciplined (6.4x paid vs the 7.9x platform), but two prior Kestrel-portfolio dividend recaps inside 24 months of refi windows set the pattern risk."
    },
    "CP-2D:Acquisition Appetite Table": {
        body: "Appetite HIGH: fresh Fund VI capital, a stated industrials focus and an existing platform — bolt-ons likely, fundable inside existing baskets per CP-4C capacity."
    },
    "CP-2D:Disclosure Quality Log": {
        body: "Disclosure grade B+: monthly lender packages, quarterly calls and covenant detail above market norm; deductions for sponsor-model optimism and selective KPI presentation."
    },
    "CP-2D:Creditor Alignment Table": {
        body: "Alignment MODERATE: sponsor incentives favor enterprise growth near-term, but the RP pre-positioning and recap history signal extraction risk in the 2027–28 window."
    },
    "CP-2D:Sponsor Risk Assessment": {
        body: "Composite MODERATE-HIGH: a competent operator with an extractive financial policy. The risk is behavioral and documentation-enabled, not operational."
    },
    "CP-2D:Cross-Module Handoff Register": {
        body: "Handoffs: RP-basket activation wired to trigger T-4; Fund VI support capacity logged for CP-3D's sponsor-willingness table; the recap pattern fed to the CP-6A bear file."
    },
    "CP-2D:Gaps Ledger": {
        body: "No gaps. LP-letter detail on Fund VI deployment pace noted as desirable but non-blocking."
    },
    "CP-2D:Overall Governance View": {
        ev: [
            "E-91"
        ],
        body: "Kestrel is a competent operator with an extractive financial-policy record; institutional-grade disclosure partially offsets. Posture: treat the RP basket as the tell — any activation is a posture-changing event."
    },
    /* ---- CP-2E · Liquidity ---- */ "CP-2E:Source Register & Module Status": {
        ev: [
            "E-77"
        ],
        body: "Gate PASS off the audited liquidity disclosure, facility schedules and the CP-1 cash-flow build; READY with no limitations."
    },
    "CP-2E:Beginning Liquidity Register": {
        body: "Beginning accessible liquidity $379M: cash $184M plus $195M undrawn RCF net of $12.4M of LCs — accessibility verified against facility conditions, not just stated availability."
    },
    "CP-2E:Mandatory Cash Uses Register": {
        body: "Mandatory uses over the next 12 months: cash interest $196M, TLB amortization $18M, Hartwell earnout $24M — no maturities and no mandatory prepayment events."
    },
    "CP-2E:WC & Capex Pressure Table": {
        body: "Seasonal working-capital trough of $43M (Q3) and capex of $121M registered; both covered by operating cash without RCF reliance in the base case."
    },
    "CP-2E:Mitigants & Constraints Table": {
        body: "Mitigants: capex deferability (~$25M) and a receivables-facility option. Constraints: the springing covenant above 40% RCF utilization and the LC carve-out."
    },
    "CP-2E:Liquidity Risk Level + Narrative": {
        body: "Risk level ADEQUATE — strong headline liquidity with the springing covenant comfortably untested. The only path to pressure runs through P1-scale EBITDA stress."
    },
    "CP-2E:Gaps Ledger": {
        body: "No gaps. Intercompany cash-pooling detail at the MX subsidiary noted as a minor opacity, non-material to the bridge."
    },
    "CP-2E:Overall Liquidity View": {
        ev: [
            "E-77"
        ],
        body: "Liquidity is a strength: 19.3 months-to-empty base, 14.0 under P1 stress, and nothing due inside 24 months. The springing covenant tests only above 40% utilization (currently 22%)."
    },
    /* ---- CP-2F · Macro & Hedging ---- */ "CP-2F:Source Register & Module Status": {
        body: "READY WITH LIMITATIONS — the hedging register is absent (gap G-01); the module runs in degraded mode with every output stamped L-04."
    },
    "CP-2F:Debt & Rate Exposure Register": {
        body: "Exposure register: RCF $120M, TLB $1,850M and the 2L TL $900M floating (SOFR+350/375/425); Subs $400M fixed — an 88% floating share before any undisclosed hedges."
    },
    "CP-2F:Unhedged Floating Exposure": {
        body: "Floating exposure modeled from SFA margins only and treated as fully unhedged per prohibited-assumption rules — an explicit upper bound, not an estimate."
    },
    "CP-2F:FX Exposure Register": {
        body: "FX LOW: 84% of revenue and 81% of costs in USD; EUR plant costs naturally hedged by EU revenue; translation-only exposure on the MX facility."
    },
    "CP-2F:Commodity & Inflation Table": {
        ev: [
            "E-31"
        ],
        body: "Steel and alloy inputs (71% of COGS) pass through with a 60–90 day lag — inflation is a timing exposure, not a level exposure."
    },
    "CP-2F:Macro Sensitivity Summary": {
        body: "The dominant channel is rates: +100bps ≈ −$12.1M of FCF on the unhedged bound. Commodity and FX channels are second-order."
    },
    "CP-2F:Gaps Ledger": {
        body: "G-01 open — swap confirms re-requested Jun 04. Resolution would re-rate the rate-sensitivity table and lift limitation L-04 from all consumers."
    },
    "CP-2F:Overall Macro / Hedging View": {
        body: "Macro view carried with the L-04 caveat: rate sensitivity is real but bounded above; the credit is structurally insulated on commodities and FX."
    },
    /* ---- CP-3 · Relative Value ---- */ "CP-3:Source Register + Execution Mode": {
        ev: [
            "E-71"
        ],
        body: "Gate PASS; executed in full-stack mode consuming CP-1C benchmarks, the CP-2 credit view and live desk marks."
    },
    "CP-3:Fundamental Credit Summary": {
        body: "Fundamental summary lands mid-B2 with positive trajectory: real FCF and a credible deleveraging path, with quality and concentration as the standing deductions."
    },
    "CP-3:Issuer / Security Scorecard": {
        body: "Scorecard 71/100: cash flow 17/20, business durability 15/20, leverage 12/20, documentation 9/20 — documentation is the scored weak point, consistent with CP-4."
    },
    "CP-3:Override Review": {
        body: "No analyst overrides applied — the scorecard output is carried as computed and the override register is empty."
    },
    "CP-3:Fundamental Value Matrix": {
        body: "The matrix crosses fundamentals against spread: the subject plots in the cheap / improving quadrant. Only Cascadia plots cheaper, on an unsecured-recovery adjustment the IC discounts."
    },
    "CP-3:Final Ranking": {
        body: "Final rank 2 of 7 on the value matrix. The rank is robust to the E-44 question — dropping the contested margin set moves the subject to 3 of 7, still actionable."
    },
    "CP-3:Security Selection Conclusions": {
        body: "Within the structure, the 2L TL is the expression: +210bps of pickup over the TLB for an acceptable recovery delta (per CP-3B); subs rejected on priming exposure."
    },
    "CP-3:Monitoring Triggers": {
        body: "RV triggers: exit if spread tightens through +300 (thesis complete); re-rank on any peer-set rating migration; refresh marks weekly."
    },
    "CP-3:Gaps Ledger": {
        body: "The E-44 dependency is carried as the single limitation; both fair-value bands (with and ex-E-44) are published side by side."
    },
    "CP-3:Final Credit / RV View": {
        ev: [
            "E-71"
        ],
        body: "Conviction is carry plus deleveraging, not convergence: hold-to-maturity math clears the hurdle at +388 with zero spread tightening assumed."
    },
    /* ---- CP-3B · Instrument Selection ---- */ "CP-3B:Instrument Data Gate": {
        body: "Gate PASS — facility-level terms, pricing and ranking for all five instruments verified against executed documents; claims totals tie to CP-1 net debt."
    },
    "CP-3B:Capital Structure Dashboard": {
        body: "Dashboard published: $3,270M of total debt — RCF / TLB (1L $1,970M), 2L TL $900M, Subs $400M — 5.7x through the subject tranche, 6.6x total."
    },
    "CP-3B:Instrument Matrix": {
        body: "The matrix scores each tranche on price, ranking, covenant protection and liquidity: the 2L TL carries the best spread-per-risk-unit, the TLB the best downside, the subs the worst of both."
    },
    "CP-3B:Structural Positioning Log": {
        body: "Positioning: the 2L TL sits behind $1,970M of 1L claims with full guarantor coverage and second-lien collateral — and structurally ahead of a $400M sub-notes cushion."
    },
    "CP-3B:Legal / Covenant / LME Overlay": {
        ev: [
            "E-63",
            "E-64"
        ],
        body: "CP-4C overlay applied: $612M of incremental capacity can prime the 2L and MFN protection lasts only 12 months — LME risk is priced into the preference decision rather than ignored."
    },
    "CP-3B:Compensation Cross-Check": {
        body: "Cross-check PASS: at +388 the 2L compensates its modeled loss-given-default with ~140bps of excess spread under base-distress probability weights."
    },
    "CP-3B:Ranking & Trade-Off Summary": {
        body: "Trade-off summary: 2L TL > TLB > Subs. The 2L's recovery cliff below 5.5x stressed is the accepted risk, paid for by +210bps of spread."
    },
    "CP-3B:Monitoring Triggers": {
        body: "Three triggers: any 1L incremental raise (re-runs the waterfall), a discounted sub-notes repurchase below 85 (signals LME posture), and TLB price decoupling from the 2L TL."
    },
    "CP-3B:Gaps Ledger": {
        body: "No instrument-level gaps. Lease and pension claims modeled from audit notes at $61M combined — immaterial to attachment points."
    },
    "CP-3B:Overall Instrument Preference View": {
        body: "2L TL preferred — the only tranche where spread, structural position and covenant protection are jointly acceptable. The preference stands under both fair-value bands."
    },
    /* ---- CP-3C · Portfolio Fit ---- */ "CP-3C:Portfolio Input Gate": {
        body: "Gate PASS — the live portfolio snapshot (Jun 8), limit framework v4.1 and the proposed 75 / 125bps sizing range loaded."
    },
    "CP-3C:Portfolio Fit Register": {
        body: "Fit register PASS on all hard limits at initial size: issuer 75bps of a 150bps cap, sector 6.1% of 8.0%, sponsor aggregate 2.2% of 4.0%."
    },
    "CP-3C:Position Sizing Posture Table": {
        body: "The posture table supports staged entry: 75bps initial preserves headroom in every budget; 125bps max binds only the B3-or-below bucket."
    },
    "CP-3C:Concentration & Correlation Register": {
        body: "The auto / industrial correlation cluster lands at 14.0% of the 16% limit post-add. Pairwise overlap with SXAA is the watched relationship — no concurrent adds ruled."
    },
    "CP-3C:Liquidity & Implementation": {
        ev: [
            "E-71"
        ],
        body: "Implementation feasible: $4.2M average LoanX clip and two-way desk markets support building 75bps inside ~2 weeks without moving the price."
    },
    "CP-3C:Downside Budget & Recovery Sensitivity": {
        body: "At the 21% severe-stress recovery (CP-3B), a max position consumes 9bps of the quarterly downside budget — within the 15bps single-name allowance."
    },
    "CP-3C:Monitoring / Add-Trim Triggers": {
        body: "Add / trim wiring mirrors CP-6E: add on a T-1 pass plus bucket headroom; trim on RP activation, a re-rank below 4 of 7, or a cluster breach above 15%."
    },
    "CP-3C:Gaps Ledger": {
        body: "No gaps. Portfolio snapshot staleness (T+1) noted as a standard operating limitation; re-tested on trade date by rule."
    },
    "CP-3C:Overall Portfolio Fit View": {
        body: "Fit PASS with one watch item: the B3-or-below bucket at 91% utilization is the live constraint, and it is encoded directly into the CP-6E sizing decision."
    },
    /* ---- CP-3D · Refinancing & LME ---- */ "CP-3D:Source Register & Module Status": {
        body: "Gate PASS off facility schedules, CP-2E liquidity outputs and the CP-4C capacity registers; READY."
    },
    "CP-3D:Maturity Wall Register": {
        body: "Wall registered: 2027 RCF expiry $250M, 2029 TLB $1,850M, 2031 2L TL $900M, 2032 Subs $400M — nothing due inside 24 months."
    },
    "CP-3D:Liquidity / Market Access Table": {
        body: "Market access OPEN: the May-26 2L TL priced inside talk and the TLB trades near par — both primary and secondary channels are available today."
    },
    "CP-3D:Sponsor Willingness Table": {
        ev: [
            "E-91"
        ],
        body: "Willingness MODERATE-HIGH: Fund VI capacity ($4.2B) supports the platform, but Kestrel's recap record means support is conditional on equity-value preservation, not creditor protection."
    },
    "CP-3D:Refinancing Path Table": {
        body: "Paths assessed per instrument: the RCF extends H2-26 at +25–50bps; the TLB is refinanceable at ~SOFR+400; the subs are a discounted-repurchase candidate below 85."
    },
    "CP-3D:Creditor Class Exposure Table": {
        body: "Class exposure: 2L holders are the natural LME-target class given priming capacity; the TLB is protected by 1L status; the subs are structurally first-loss."
    },
    "CP-3D:Monitoring Triggers": {
        body: "Triggers: TLB price below 97 (refi-risk tell), RCF extension terms, and any amendment solicitation — each routes to a vulnerability re-score."
    },
    "CP-3D:Scenario Map (base / stress / LME)": {
        ev: [
            "E-63"
        ],
        body: "Three scenarios mapped: base (refi on schedule), stress (P1 coinciding with the 2029 approach → 7/10 vulnerability), and LME (an uptier via §4.09 capacity after the MFN sunset)."
    },
    "CP-3D:Gaps Ledger": {
        body: "No gaps. Private-side amendment history unavailable but non-blocking for the vulnerability score."
    },
    "CP-3D:Overall Refinancing / LME View": {
        ev: [
            "E-64"
        ],
        body: "4/10 today — capacity-driven, not distress-driven: the documents allow an uptier the fundamentals don't yet motivate. The window to watch is 2028–29, when the TLB approach meets open capacity."
    },
    /* ---- CP-4 · Legal & Covenants ---- */ "CP-4:Source Gate + Module Status": {
        body: "Gate PASS — the executed SFA, 2L credit agreement and intercreditor admitted as controlling. CIM covenant summaries are used for navigation only, never as authority."
    },
    "CP-4:Controlling Document Register": {
        body: "Controlling register fixed: the executed credit agreement governs the 2L TL, the SFA governs bank debt. Where summaries conflict with executed text, executed text controls — two instances found."
    },
    "CP-4:Covenant Feature Register": {
        body: "41 provisions registered across incurrence, restricted payments, liens, transfers, reporting and events of default — each with a clause cite, feature classification and market-norm comparison."
    },
    "CP-4:EBITDA, Definitions & Ratio Mechanics": {
        ev: [
            "E-09",
            "E-103"
        ],
        body: "Definitional mechanics are the document's core aggression: uncapped credit agreement add-backs vs the SFA's 25% / 24-month cap — a $14.2M covenant-EBITDA divergence that inflates every grower basket."
    },
    "CP-4:Debt Incurrence, Incremental & MFN": {
        ev: [
            "E-63",
            "E-64"
        ],
        body: "The incurrence stack permits $612M day-one (freebie + ratio + reclassification). MFN at 50bps protects pari raises only — and sunsets in June 2027."
    },
    "CP-4:Leakage, RP, Investments & Transfers": {
        body: "RP capacity of $240M builder plus starter baskets is usable today. Investment baskets permit unrestricted-sub designation, but no Chewy-style automatic guarantee release was found."
    },
    "CP-4:Collateral, Guarantees & Subordination": {
        body: "Full guarantor coverage (87% of EBITDA) with second-lien collateral on substantially all assets; no material non-guarantor pockets — the structural floor of the credit."
    },
    "CP-4:EoD, Remedies & Amendment Risk": {
        body: "Sacred rights are limited to money terms, with a 50.1% amendment threshold for everything else — uptier-enabling architecture, standard for the vintage but live given the capacity."
    },
    "CP-4:PD vs LGD / Recovery Translation": {
        body: "Translation: this document set shifts risk from PD to LGD — default is not nearer, but the creditor's position at default is erodible via priming and leakage."
    },
    "CP-4:Market Norm Comparison": {
        body: "Versus the 2026 single-B norm set: 7.2 vs 6.1 — top-quartile aggressive on definitions and capacity, market-standard on collateral and reporting."
    },
    "CP-4:Gaps Ledger": {
        body: "No documentation gaps. The intercreditor's 120-day standstill registered for CP-3B's recovery-timing assumptions."
    },
    "CP-4:Overall Legal Credit View": {
        body: "An aggressive but not pathological document set: capacity and definitional looseness are the risks; full collateral / guarantee coverage and the absence of J.Crew / Chewy paths are the protections."
    },
    /* ---- CP-4C · Covenant Capacity ---- */ "CP-4C:Source Gate + Module Status": {
        ev: [
            "E-103"
        ],
        body: "Gate PASS — runs off CP-4's covenant register plus the Q1-26 compliance certificate for live ratio inputs; READY."
    },
    "CP-4C:Controlling Capacity Source Map": {
        body: "Each capacity figure mapped to its controlling clause: incremental to credit agreement §4.09(b)(14), RP to §4.07 — with SFA cross-defaults checked for binding constraints."
    },
    "CP-4C:Definition & Ratio Mechanics Register": {
        ev: [
            "E-103"
        ],
        body: "Ratio mechanics registered: Secured Leverage tested at 4.68x against the 5.25x incurrence ceiling — the 0.57x gap is what prices into $310M of ratio capacity."
    },
    "CP-4C:Headroom Table": {
        body: "Headroom table: secured leverage 0.57x, springing covenant 28% (untested), RP build rate ~$45M / year — all current as of the Q1-26 certificate."
    },
    "CP-4C:Debt / Lien / Priming Analysis": {
        ev: [
            "E-63"
        ],
        body: "Priming risk MEDIUM-HIGH: the full $612M is incurrable pari or senior to the 2L; after the MFN sunset it can also price freely. The 2L is the natural priming victim."
    },
    "CP-4C:RP / Leakage Analysis": {
        body: "Leakage paths: the $240M builder basket (pre-positioned, no stated use) plus starter baskets ≈ $310M of total day-one RP capacity — enough for a meaningful dividend without amendment."
    },
    "CP-4C:Leakage & Basket Flags": {
        body: "Two flags raised: builder-basket pre-positioning (a behavioral signal, fed to CP-2D) and grower-basket linkage to uncapped add-back EBITDA (mechanical inflation)."
    },
    "CP-4C:Capacity Risk Priority Matrix": {
        body: "The priority matrix ranks the MFN sunset first (time-bound), RP activation second (behavioral), and add-back inflation third (gradual) — an ordering inherited by the trigger set."
    },
    "CP-4C:Gaps Ledger": {
        body: "No gaps. The capacity math is reproducible end-to-end from registered clause cites."
    },
    "CP-4C:Overall Covenant Capacity View": {
        body: "Capacity is the credit's defining legal feature: $612M of day-one debt and $240M+ of leakage — all priced via sizing and triggers rather than exclusion."
    },
    /* ---- CP-5 · QA & Governance ---- */ "CP-5:Input Module Register": {
        body: "All 21 module outputs registered with version hashes at audit start; no stale versions found anywhere in the consumption graph."
    },
    "CP-5:Math / Logic / Definition Audit": {
        body: "Every calc-register figure recomputed independently: 0 math defects and 0 instances of definitional drift across 41 KPIs and all derived tables."
    },
    "CP-5:Legal / Structural Claim Audit": {
        body: "All legal claims traced to executed-document clauses: capacity math, MFN mechanics and ranking statements verified verbatim against the credit agreement. Clean."
    },
    "CP-5:RV / Market Claim Audit": {
        ev: [
            "E-71"
        ],
        body: "Market claims verified against LoanX marks and desk runs: the +388 DM, the 96.40 last mark and the fair-band regression inputs all reproduce. Clean."
    },
    "CP-5:Consistency & Version Audit": {
        body: "Cross-module consistency clean after the QA-122 rounding fix: every module quotes identical figures for EBITDA, leverage and capacity."
    },
    "CP-5:Committee-Readiness Audit": {
        body: "Pack HELD: clearance policy bars committee assembly while any HIGH citation defect is open. All non-citation readiness criteria pass."
    },
    "CP-5:Export & Evidence Trace Audit": {
        body: "Export audit clean: all 1,142 citations resolve to registered E-ids; no orphaned or fabricated anchors; master-index hashes match."
    },
    "CP-5:Remediation Priority Map": {
        ev: [
            "E-44"
        ],
        body: "A single remediation, R-1: re-anchor E-44 to conformed CIM p.391, re-run CP-1C alignment, then refresh the CP-3 RV table and the CP-6A weighting row. Estimated 40 minutes of module time."
    },
    /* ---- CP-5B · Traceability ---- */ "CP-5B:Source Register & Readiness": {
        body: "Gate PASS — consumes the committee-pack figure set and the master evidence index; READY."
    },
    "CP-5B:Top-5 Material Credit Drivers": {
        body: "Drivers selected by decision-weight, not narrative prominence: add-back quality, OEM concentration, incremental capacity, FCF conversion, and the contested peer-margin set."
    },
    "CP-5B:Traceability Map": {
        body: "The full map is drawn figure-by-figure: every committee-pack number resolves to a producing module, a calc-register entry and a source anchor."
    },
    "CP-5B:Source Lineage Register": {
        body: "Lineage chains published for all five drivers, averaging 3.0 hops to a grade-A source; chain confidence ranges 41–97%."
    },
    "CP-5B:Calculation & Assumption Register": {
        body: "All assumptions surfaced: four [Analyst estimate] labels in the pack (derived Q4-25, two catalyst probabilities, the maintenance-capex split) — each flagged at point of use."
    },
    "CP-5B:Gaps Ledger": {
        body: "No new gaps. The E-44 weak chain is owned by CP-5 remediation R-1 and is not re-logged here."
    },
    "CP-5B:Overall Traceability View": {
        body: "Auditability STRONG: four of five chains reach grade-A sources within three hops, and any material figure reconstructs in under two minutes from the master index."
    },
    /* ---- CP-6A · IC Debate ---- */ "CP-6A:IC Debate Source Gate": {
        body: "Gate PASS at the J1 join — all analytical feeders landed. Limitation L-04 is surfaced to the Chair so macro claims carry the unhedged caveat."
    },
    "CP-6A:Pre-Debate Thesis Map": {
        body: "The thesis map fixes the contested ground before argument: EBITDA quality, documentation capacity, aftermarket durability, the RV signal and macro exposure — five claims, no strawmen."
    },
    "CP-6A:Bull Opening Statement": {
        ev: [
            "E-12",
            "E-22"
        ],
        body: "The bull opens on three claims: an annuity-grade aftermarket (44% of gross profit), top-quartile FCF conversion, and +48–63bps of model cheapness at entry."
    },
    "CP-6A:Bear Cross-Examination": {
        ev: [
            "E-87",
            "E-63"
        ],
        body: "The bear attacks on four: add-backs are structural not episodic (recurrence in 3 of the last 4 years), $612M of priming capacity, the sponsor's recap record, and the E-44 hole in the RV case."
    },
    "CP-6A:Bull Defense": {
        ev: [
            "E-44"
        ],
        body: "The bull defends three of four and concedes E-44: the RV claim is restated on the ex-E-44 band (+20–25bps). The concession is registered in the matrix, not buried."
    },
    "CP-6A:Debate Resolution Matrix": {
        body: "The matrix closes all five claims: two to the bear (quality, documentation), one to the bull (aftermarket), one split (RV, pending QA-117), one carried with caveat (macro, under L-04)."
    },
    "CP-6A:IC Chair Final Memo": {
        body: "Chair memo: CONSTRUCTIVE at a price — haircut base EBITDA by $35M, treat the documents as the real risk, and let the Q3-26 certificate decide the upgrade to max size."
    },
    "CP-6A:Gaps Ledger": {
        body: "One debate-level gap: hedging posture unknown (L-04) — flagged as unresolvable until G-01 lands, rather than argued past."
    },
    /* ---- CP-6E · Sizing Debate ---- */ "CP-6E:Portfolio Debate Source Gate": {
        body: "Gate PASS — the CP-6A verdict, CP-3C fit register and live limit utilization loaded. The debate runs on the IC-approved credit case only."
    },
    "CP-6E:Pre-Debate Portfolio Thesis Map": {
        body: "The thesis map narrows to the sizing question: carry-adjusted return vs bucket utilization, correlation overlap, and the E-44-dependent entry signal."
    },
    "CP-6E:RV Trader's Pitch": {
        ev: [
            "E-71"
        ],
        body: "The trader pitches max size immediately: +388 entry clears the hurdle hold-to-maturity, two-way market depth supports the build, and the catalyst calendar is front-loaded."
    },
    "CP-6E:Compliance Officer's Attack": {
        body: "Compliance attacks on three fronts: the B3-or-below bucket at 91% utilization, the open E-44 dependency inside the entry band, and SXAA cluster overlap."
    },
    "CP-6E:RV Trader's Defense": {
        body: "The trader concedes staging and proposes the standing constraint: 75bps now, max gated on T-1 plus a same-day bucket re-test — adopted into the decision."
    },
    "CP-6E:CIO Evidence Weighting": {
        body: "The CIO weights the three contested points: bucket constraint upheld (compliance), entry validity split (size off the ex-E-44 band), correlation managed (no concurrent SXAA adds)."
    },
    "CP-6E:Allocation Decision Matrix": {
        body: "The decision matrix is published with each contested point, both positions and the CIO ruling — the artifact CP-5 audits for decision traceability."
    },
    "CP-6E:CIO Final Memo": {
        body: "Memo: approve 75bps at +388 or wider with a standing limit order at +400; the path to 125bps runs through T-1 and bucket headroom; trim discipline wired to T-4 and any re-rank."
    },
    "CP-6E:Gaps Ledger": {
        body: "No sizing-level gaps. Bucket utilization is marked T+1 stale and re-tested on trade date by rule."
    }
};
const STEP_NOTES = {
    ...BASE,
    ...EXT
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/deepdive/step-outputs.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "STEP_OUTPUTS",
    ()=>STEP_OUTPUTS
]);
// AUTO-PORTED from the Credit OS design bundle (shared/step-outputs-l1/l2/l3/l456.js).
// ATLF demo data — replace with live module outputs when CP backend persistence lands.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$module$2d$outputs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/deepdive/module-outputs.ts [app-client] (ecmascript)");
;
const T = (title, cols, align, rows)=>({
        type: "table",
        title,
        cols,
        align,
        rows
    });
_c = T;
const X = (title, body, ev)=>({
        type: "text",
        title,
        body,
        ev
    });
_c1 = X;
const F = (title, items)=>({
        type: "flags",
        title,
        items
    });
_c2 = F;
// ── from step-outputs-l1.js ──
const O0 = {
    /* ================= CP-0 · DocumentIntakeManager ================= */ "CP-0:File Classification": {
        ref: "REF_CP-0_A",
        out: "File classification register",
        sections: [
            T("CP-0-A · File classification register (14 files)", [
                "ID",
                "File",
                "Class",
                "Pages",
                "Status"
            ], [
                0,
                0,
                0,
                1,
                0
            ], [
                [
                    "D-01",
                    "Confidential Info Memo — 2L TL '31",
                    "CIM",
                    "412",
                    "CLASSIFIED"
                ],
                [
                    "D-02",
                    "Senior Facilities Agreement (conformed)",
                    "SFA",
                    "287",
                    "CLASSIFIED"
                ],
                [
                    "D-03",
                    "2L Credit Agt (executed, final)",
                    "CRED AGT",
                    "231",
                    "CLASSIFIED"
                ],
                [
                    "D-04",
                    "FY23–FY25 Audited Financial Statements",
                    "AUDIT",
                    "104",
                    "CLASSIFIED"
                ],
                [
                    "D-05",
                    "Q1-26 Compliance Certificate",
                    "COVENANT",
                    "9",
                    "CLASSIFIED"
                ],
                [
                    "D-06",
                    "Lender Presentation (May-26)",
                    "LP",
                    "48",
                    "CLASSIFIED · MNPI"
                ],
                [
                    "D-07",
                    "Sponsor Model Extract (FY26E bridge)",
                    "MODEL",
                    "14",
                    "CLASSIFIED · MNPI"
                ],
                [
                    "S-01–S-07",
                    "Supporting exhibits — org chart, plant list, insurance, tax structure, contracts index, IT, ESG",
                    "SUPPORT",
                    "96",
                    "CLASSIFIED"
                ]
            ]),
            X("Classification note", "All 14 files typed on first pass with zero unclassifiable or corrupted items. The two MNPI files (D-06, D-07) were flagged at intake and routed only to walled consumers (CP-1B, CP-2D).")
        ]
    },
    "CP-0:Entity Identification": {
        ref: "REF_CP-0_B",
        out: "Entity register",
        sections: [
            T("CP-0-B · Entity register", [
                "Entity",
                "Role",
                "Jurisdiction",
                "Perimeter"
            ], [
                0,
                0,
                0,
                0
            ], [
                [
                    "Atlas Forge Intermediate Holdings, Inc.",
                    "Issuer / covenant reporting entity",
                    "Delaware",
                    "RESTRICTED"
                ],
                [
                    "Atlas Forge Industrials LLC",
                    "Principal operating company · guarantor",
                    "Delaware",
                    "RESTRICTED"
                ],
                [
                    "Hartwell Precision, Inc.",
                    "Subsidiary guarantor (2023 bolt-on)",
                    "Ohio",
                    "RESTRICTED"
                ],
                [
                    "Atlas Forge de México S. de R.L.",
                    "Non-guarantor operating subsidiary",
                    "Mexico",
                    "RESTRICTED · NON-GUAR"
                ],
                [
                    "Kestrel Capital Fund V, L.P.",
                    "Sponsor — 68.4% control",
                    "Delaware",
                    "OUTSIDE GROUP"
                ]
            ]),
            X("Perimeter note", "One canonical entity key established (Atlas Forge Intermediate Holdings). No unrestricted subsidiaries exist at close — relevant to CP-4's transfer-basket analysis. Every downstream module cites this register.")
        ]
    },
    "CP-0:Document Mapping": {
        ref: "REF_CP-0_C",
        out: "Document-to-module map",
        sections: [
            T("CP-0-C · Document-to-module routing", [
                "Doc",
                "Primary consumers",
                "Secondary"
            ], [
                0,
                0,
                0
            ], [
                [
                    "D-01 CIM",
                    "CP-1 · CP-1A · CP-1C",
                    "CP-2 · CP-3B"
                ],
                [
                    "D-02 SFA",
                    "CP-4 · CP-4C",
                    "CP-1 (definitions) · CP-2F"
                ],
                [
                    "D-03 Credit Agt",
                    "CP-4 · CP-4C",
                    "CP-3B · CP-3D"
                ],
                [
                    "D-04 Audits",
                    "CP-1 · CP-2E",
                    "CP-1C · CP-5B"
                ],
                [
                    "D-05 Compliance Cert",
                    "CP-1 · CP-4C",
                    "CP-2E"
                ],
                [
                    "D-06 Lender Pres (MNPI)",
                    "CP-2D",
                    "CP-1B"
                ],
                [
                    "D-07 Sponsor Model (MNPI)",
                    "CP-1B",
                    "CP-1 (derived period only)"
                ]
            ])
        ]
    },
    "CP-0:Quality Assignment": {
        ref: "REF_CP-0_D",
        out: "Quality grade register",
        sections: [
            T("CP-0-D · Quality assignment", [
                "Doc",
                "Grade",
                "Rationale"
            ], [
                0,
                0,
                0
            ], [
                [
                    "D-01 CIM",
                    "A",
                    "Executed offering document, counsel-reviewed, conformed"
                ],
                [
                    "D-02 SFA / D-03 Credit Agt",
                    "A",
                    "Executed legal documents — controlling authority"
                ],
                [
                    "D-04 Audits",
                    "A",
                    "Audited, unqualified opinion, three fiscal years"
                ],
                [
                    "D-05 Compliance Cert",
                    "A",
                    "Officer-certified covenant calculations"
                ],
                [
                    "D-06 Lender Presentation",
                    "B",
                    "Sponsor-prepared marketing material · MNPI handling"
                ],
                [
                    "D-07 Sponsor Model",
                    "C",
                    "Unaudited, sponsor-authored — [Analyst estimate] use only"
                ]
            ])
        ]
    },
    "CP-0:Content-Module Mapping": {
        ref: "REF_CP-0_E",
        out: "Content anchor register",
        sections: [
            T("CP-0-E · Section-level anchors (sample of 312)", [
                "Anchor",
                "Content",
                "Routed to"
            ], [
                0,
                0,
                0
            ], [
                [
                    "D-01 p.97–99",
                    "Business — segments, customers, aftermarket",
                    "CP-1A"
                ],
                [
                    "D-01 p.214",
                    "Adjusted EBITDA reconciliation",
                    "CP-1 · CP-4C"
                ],
                [
                    "D-01 Annex C",
                    "Industry & peer data",
                    "CP-1C"
                ],
                [
                    "D-03 §4.07 / §4.09",
                    "RP baskets · incremental debt",
                    "CP-4C"
                ],
                [
                    "D-04 p.31 / p.44",
                    "Cash flows · liquidity disclosure",
                    "CP-1 · CP-2E"
                ],
                [
                    "D-04 p.58",
                    "Restructuring charges note FY22–25",
                    "CP-1 · CP-4C"
                ],
                [
                    "D-05 p.3",
                    "Covenant ratio calculations",
                    "CP-1 · CP-4C"
                ]
            ]),
            X("Coverage", "312 content anchors registered to the master index. Every E-xx citation issued downstream must resolve to one of these anchors — unanchored extraction is a prohibited behavior.")
        ]
    },
    "CP-0:Gap Logging": {
        ref: "REF_CP-0_F",
        out: "Gap log",
        sections: [
            F("CP-0-F · Gap log", [
                {
                    sev: "warning",
                    text: "G-01 — Hedging register / swap confirmations not provided. Affected: CP-2F (degraded mode), CP-6A (macro weighting). Limitation L-04 attached. Re-requested Jun 04; no response at route time."
                },
                {
                    sev: "low",
                    text: "G-02 — Q4-25 management accounts missing. Affected: CP-1 (derived period), CP-1B (quarterly comparability). Degraded-mode instruction: construct Q4-25 from sponsor model at [Analyst estimate] status.",
                    ev: [
                        "E-58"
                    ]
                }
            ]),
            X("Disposition", "Neither gap blocks the route. Both carry explicit degraded-mode instructions and re-request dates; both surface as limitations on every affected output object rather than being silently absorbed.")
        ]
    },
    "CP-0:Conflict Logging": {
        ref: "REF_CP-0_G",
        out: "Conflict log",
        sections: [
            T("CP-0-G · Intake tie-out checks", [
                "Check",
                "Result"
            ], [
                0,
                0
            ], [
                [
                    "CIM summary financials vs audited statements",
                    "TIE — within 0.3% on every line"
                ],
                [
                    "Compliance cert covenant EBITDA vs SFA definition",
                    "TIE — $421.4M reproduces"
                ],
                [
                    "Lender presentation KPIs vs audit",
                    "2 presentational variances — non-conflicting, noted"
                ],
                [
                    "Sponsor model basis vs audited presentation",
                    "DIVERGENT — escalated to CP-1 definition register"
                ]
            ]),
            X("Conflict count", "0 unresolved conflicts at intake. The sponsor-model basis divergence is logged for CP-1's definition conflict register rather than reconciled silently here.")
        ]
    },
    "CP-0:File Quality Risk": {
        ref: "REF_CP-0_H",
        out: "File quality risk assessment",
        sections: [
            T("CP-0-H · Quality risk by analytical surface", [
                "Surface",
                "Coverage",
                "Risk"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Historical financials",
                    "Grade A (audits + CIM)",
                    "LOW"
                ],
                [
                    "Legal / covenant analysis",
                    "Grade A (executed docs)",
                    "LOW"
                ],
                [
                    "Current-quarter earnings",
                    "Grade A (cert) + B (LP)",
                    "LOW"
                ],
                [
                    "Forward projections",
                    "Grade C only (sponsor model)",
                    "ELEVATED — quarantined to upside case"
                ],
                [
                    "Hedging posture",
                    "NOT COVERED (G-01)",
                    "ELEVATED — degraded mode"
                ]
            ])
        ]
    },
    "CP-0:Downstream Readiness": {
        ref: "REF_CP-0_I",
        out: "Readiness score + register",
        sections: [
            T("CP-0-I · Readiness by layer", [
                "Layer",
                "Modules",
                "Readiness",
                "Blockers"
            ], [
                0,
                0,
                0,
                0
            ], [
                [
                    "L1 Base",
                    "CP-1 · 1A · 1B · 1C",
                    "READY",
                    "none"
                ],
                [
                    "L2 Synthesis",
                    "CP-2 · 2B · 2C · 2D · 2E · 2F",
                    "READY*",
                    "CP-2F degraded (G-01)"
                ],
                [
                    "L3 Relative value",
                    "CP-3 · 3B · 3C · 3D",
                    "READY",
                    "none"
                ],
                [
                    "L4 Legal",
                    "CP-4 · 4C",
                    "READY",
                    "none"
                ],
                [
                    "L5–L6 Governance / debate",
                    "CP-5 · 5B · 6A · 6E",
                    "READY",
                    "gated on upstream"
                ]
            ]),
            X("Score", "Composite readiness 0.91 against the 0.85 full-run threshold — full run authorized. The only scope deviation is CP-2F's degraded mode.")
        ]
    },
    "CP-0:Master Index Update": {
        ref: "REF_CP-0_J",
        out: "Master index",
        sections: [
            T("CP-0-J · Master index summary", [
                "Field",
                "Value"
            ], [
                0,
                1
            ], [
                [
                    "Documents registered",
                    "14"
                ],
                [
                    "Content anchors",
                    "312"
                ],
                [
                    "Entities",
                    "5"
                ],
                [
                    "Open gaps",
                    "2 (G-01, G-02)"
                ],
                [
                    "Unresolved conflicts",
                    "0"
                ],
                [
                    "Index version",
                    "v1.0 · RUN #2641"
                ]
            ]),
            X("Note", "The master index is the single addressable map for the run: every downstream citation, lineage chain and QA audit resolves against it.")
        ]
    },
    "CP-0:Export Assembly": {
        ref: "REF_CP-0_K",
        out: "Intake export package",
        sections: [
            T("CP-0-K · Export package contents", [
                "Component",
                "Status"
            ], [
                0,
                0
            ], [
                [
                    "Document map + quality grades",
                    "ASSEMBLED"
                ],
                [
                    "Entity register",
                    "ASSEMBLED"
                ],
                [
                    "Content anchor index (312)",
                    "ASSEMBLED"
                ],
                [
                    "Gap / conflict logs",
                    "ASSEMBLED"
                ],
                [
                    "Readiness score + degraded-mode instructions",
                    "ASSEMBLED"
                ],
                [
                    "Handoff to CP-X",
                    "DELIVERED 09:14 ET"
                ]
            ])
        ]
    },
    /* ================= CP-X · Orchestrator ================= */ "CP-X:Route Plan Source Gate": {
        ref: "REF_CP-X · TX.1",
        out: "Gate decision",
        sections: [
            T("TX.1 · Gate criteria", [
                "Criterion",
                "Threshold",
                "Actual",
                "Result"
            ], [
                0,
                1,
                1,
                0
            ], [
                [
                    "CP-0 readiness score",
                    "≥ 0.85",
                    "0.91",
                    "PASS"
                ],
                [
                    "Grade-A coverage of thesis-critical claims",
                    "100%",
                    "100%",
                    "PASS"
                ],
                [
                    "Blocking gaps",
                    "0",
                    "0",
                    "PASS"
                ],
                [
                    "Non-blocking gaps w/ instructions",
                    "—",
                    "2",
                    "CARRIED"
                ]
            ]),
            X("Decision", "READY WITH LIMITATIONS — full run authorized on route template v2.2 (new-issue committee review). G-01 carried as limitation L-04 rather than a blocker.")
        ]
    },
    "CP-X:Module Execution Sequence": {
        ref: "REF_CP-X · TX.2",
        out: "Execution sequence",
        sections: [
            T("TX.2 · 8-wave sequence", [
                "Wave",
                "Modules",
                "Gate condition"
            ], [
                0,
                0,
                0
            ], [
                [
                    "W1",
                    "CP-0",
                    "source readiness ≥ 0.85"
                ],
                [
                    "W2",
                    "CP-X",
                    "route plan locked"
                ],
                [
                    "W3",
                    "CP-1 · CP-1A",
                    "CP-0 PASS"
                ],
                [
                    "W4",
                    "CP-1B · CP-1C",
                    "CP-1 coverage gate GREEN"
                ],
                [
                    "W5",
                    "CP-2",
                    "L1 complete"
                ],
                [
                    "W6",
                    "CP-2B–CP-2F · CP-3 · CP-3D",
                    "CP-2 view published"
                ],
                [
                    "W7",
                    "CP-3B · CP-3C · CP-4 · CP-4C",
                    "CP-3 ranking + legal docs gated"
                ],
                [
                    "W8",
                    "CP-6A → CP-6E → CP-5B → CP-5",
                    "J1 join — all upstream complete"
                ]
            ])
        ]
    },
    "CP-X:Module Readiness Register": {
        ref: "REF_CP-X · TX.3",
        out: "Readiness register",
        sections: [
            T("TX.3 · Module readiness at route time", [
                "Module group",
                "Count",
                "Status"
            ], [
                0,
                1,
                0
            ], [
                [
                    "L1 base (CP-1 family)",
                    "4",
                    "GREEN"
                ],
                [
                    "L2 synthesis (CP-2 family)",
                    "6",
                    "GREEN — CP-2F degraded"
                ],
                [
                    "L3 relative value (CP-3 family)",
                    "4",
                    "GREEN"
                ],
                [
                    "L4 legal (CP-4 / 4C)",
                    "2",
                    "GREEN"
                ],
                [
                    "L5–L6 governance / debate",
                    "5",
                    "GREEN — gated on J1"
                ]
            ])
        ]
    },
    "CP-X:One-Owner-Per-Object Validation": {
        ref: "REF_CP-X · TX.4",
        out: "Ownership validation",
        sections: [
            T("TX.4 · Object ownership (material objects)", [
                "Object class",
                "Owner",
                "Consumers"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Normalized financials + KPI register",
                    "CP-1",
                    "all L2/L3 modules"
                ],
                [
                    "Covenant capacity math",
                    "CP-4C",
                    "CP-3B · CP-3D · CP-6A"
                ],
                [
                    "Recovery waterfall",
                    "CP-3B",
                    "CP-3C · CP-6E"
                ],
                [
                    "Fair-value band",
                    "CP-3",
                    "CP-6A · CP-6E"
                ],
                [
                    "Liquidity bridge / months-to-empty",
                    "CP-2E",
                    "CP-2B · CP-3D"
                ]
            ]),
            X("Result", "0 ownership collisions. Consumers reference owned objects by ID; recomputation of another module's object is a prohibited behavior and none was detected.")
        ]
    },
    "CP-X:Source-to-Module Routing Map": {
        ref: "REF_CP-X · TX.5",
        out: "Routing map",
        sections: [
            T("TX.5 · Routing with MNPI walls", [
                "Source",
                "Routed to",
                "Wall"
            ], [
                0,
                0,
                0
            ], [
                [
                    "D-01 / D-04 / D-05 (grade A)",
                    "all analytical modules",
                    "none"
                ],
                [
                    "D-02 / D-03 (legal)",
                    "CP-4 · CP-4C (+ ref by CP-3B/3D)",
                    "none"
                ],
                [
                    "D-06 lender presentation",
                    "CP-2D · CP-1B",
                    "MNPI — walled"
                ],
                [
                    "D-07 sponsor model",
                    "CP-1B · CP-1 (derived period)",
                    "MNPI — walled"
                ],
                [
                    "MKT — LoanX / dealer runs",
                    "CP-1C · CP-3 · CP-3C",
                    "public side"
                ]
            ])
        ]
    },
    "CP-X:Limitation Propagation Register": {
        ref: "REF_CP-X · TX.6",
        out: "Limitation register",
        sections: [
            F("TX.6 · Propagated limitations", [
                {
                    sev: "warning",
                    text: "L-04 (from G-01): hedging register absent — attaches to every CP-2F output object; CP-6A instructed to weight macro claims as upper-bound estimates."
                },
                {
                    sev: "low",
                    text: "G-02 instruction: CP-1 derived Q4-25 carries [Analyst estimate] status; CP-1B caveats quarterly comparisons crossing the period.",
                    ev: [
                        "E-58"
                    ]
                }
            ])
        ]
    },
    "CP-X:Route Plan Summary": {
        ref: "REF_CP-X · TX.7",
        out: "Route plan summary",
        sections: [
            X("TX.7 · Summary", "Full run authorized, status READY WITH LIMITATIONS. 24 modules sequenced across 8 waves on route template v2.2; one-owner validation clean; J1 join holds the debate layer until every analytical feeder lands. CP-2F degraded mode is the only scope deviation. Expected wall-clock ≈ 46 minutes at current concurrency.")
        ]
    },
    /* ================= CP-1 · FinancialSpreading ================= */ "CP-1:Source Register (file gate)": {
        ref: "REF_CP-1_01 · T4.1",
        out: "Source register + gate decision",
        sections: [
            T("T4.1 · Admitted sources", [
                "Doc",
                "Role in spreading",
                "Grade",
                "Decision"
            ], [
                0,
                0,
                0,
                0
            ], [
                [
                    "D-04 Audits FY23–25",
                    "Primary basis — all statements",
                    "A",
                    "ADMITTED"
                ],
                [
                    "D-01 CIM financials",
                    "LTM + adjustment detail",
                    "A",
                    "ADMITTED"
                ],
                [
                    "D-05 Compliance cert",
                    "Covenant EBITDA + ratios",
                    "A",
                    "ADMITTED"
                ],
                [
                    "D-07 Sponsor model",
                    "Derived Q4-25 only",
                    "C",
                    "ADMITTED · RESTRICTED"
                ]
            ]),
            X("Gate decision", "PASS — three audited fiscal years plus LTM at quarterly grain available. No statement absent; no period requires interpolation beyond the registered Q4-25 derivation.")
        ]
    },
    "CP-1:Entity / Period Key": {
        ref: "REF_CP-1_02 · T4.2",
        out: "Entity / period key",
        sections: [
            T("T4.2 · Key", [
                "Field",
                "Value"
            ], [
                0,
                0
            ], [
                [
                    "Entity",
                    "Atlas Forge Intermediate Holdings, Inc. (consolidated)"
                ],
                [
                    "Fiscal year end",
                    "December 31"
                ],
                [
                    "Periods",
                    "12 — FY23, FY24, FY25 quarterly + LTM Q1-26"
                ],
                [
                    "Grain",
                    "Quarterly"
                ],
                [
                    "Currency",
                    "USD millions"
                ],
                [
                    "Basis",
                    "US GAAP, audited; LTM per CIM/cert"
                ]
            ])
        ]
    },
    "CP-1:Normalization Register": {
        ref: "REF_CP-1_03 · T4.3",
        out: "Normalization register",
        sections: [
            T("T4.3 · Normalization adjustments", [
                "Adjustment",
                "Treatment",
                "Impact ($M)"
            ], [
                0,
                0,
                1
            ], [
                [
                    "Hartwell acquisition (Jun-23)",
                    "Pro-forma included from acquisition date only — no full-year restatement",
                    "—"
                ],
                [
                    "FX translation (EUR / MXN ops)",
                    "Constant-rate KPI series built alongside reported",
                    "±4.1 rev / qtr"
                ],
                [
                    "53-week FY24",
                    "Week-53 revenue normalized out of growth rates",
                    "−12.0 rev"
                ],
                [
                    "Discontinued line (legacy castings, FY23)",
                    "Excluded from continuing-ops series",
                    "−18.2 rev · −1.1 EBITDA"
                ],
                [
                    "Operating lease classification",
                    "ASC 842 treatment preserved; leases excluded from debt for covenant series",
                    "84.0 leases"
                ]
            ]),
            X("Tie-out", "Normalized series ties to audited financials within 0.3% on every line; each adjustment carries an audit-trail reference in the calc register.")
        ]
    },
    "CP-1:Income Statement Coverage": {
        ref: "REF_CP-1_04 · T4.4",
        out: "Income statement (all periods)",
        sections: [
            T("T4.4 · Income statement ($M)", [
                "",
                "FY23",
                "FY24",
                "FY25",
                "LTM Q1-26"
            ], [
                0,
                1,
                1,
                1,
                1
            ], [
                [
                    "Revenue",
                    "2,410",
                    "2,588",
                    "2,742",
                    "2,801"
                ],
                [
                    "Cost of goods sold",
                    "(1,832)",
                    "(1,959)",
                    "(2,068)",
                    "(2,110)"
                ],
                [
                    "Gross profit",
                    "578",
                    "629",
                    "674",
                    "691"
                ],
                [
                    "Gross margin",
                    "24.0%",
                    "24.3%",
                    "24.6%",
                    "24.7%"
                ],
                [
                    "SG&A + other opex",
                    "(260)",
                    "(300)",
                    "(333)",
                    "(347)"
                ],
                [
                    "Reported EBITDA",
                    "318",
                    "329",
                    "341",
                    "344"
                ],
                [
                    "Add-backs (per CIM reconciliation)",
                    "40",
                    "63",
                    "74",
                    "77"
                ],
                [
                    "Adjusted EBITDA",
                    "358",
                    "392",
                    "415",
                    "421"
                ],
                [
                    "D&A",
                    "(128)",
                    "(131)",
                    "(134)",
                    "(136)"
                ],
                [
                    "EBIT (reported)",
                    "190",
                    "198",
                    "207",
                    "208"
                ],
                [
                    "Interest expense",
                    "(188)",
                    "(192)",
                    "(195)",
                    "(196)"
                ],
                [
                    "Pre-tax income",
                    "2",
                    "6",
                    "12",
                    "12"
                ],
                [
                    "Tax",
                    "(1)",
                    "(2)",
                    "(4)",
                    "(4)"
                ],
                [
                    "Net income",
                    "1",
                    "4",
                    "8",
                    "8"
                ]
            ]),
            X("Coverage note", "Full coverage at quarterly grain, all periods. The add-back bridge is preserved as separate lines — reported vs adjusted EBITDA never netted.", [
                "E-09"
            ])
        ]
    },
    "CP-1:Cash Flow Statement Coverage": {
        ref: "REF_CP-1_05 · T4.5",
        out: "Cash flow statement (all periods)",
        sections: [
            T("T4.5 · Cash flow statement ($M)", [
                "",
                "FY23",
                "FY24",
                "FY25",
                "LTM Q1-26"
            ], [
                0,
                1,
                1,
                1,
                1
            ], [
                [
                    "OCF before working capital",
                    "252",
                    "278",
                    "301",
                    "308"
                ],
                [
                    "Working capital change",
                    "(14)",
                    "(12)",
                    "(14)",
                    "(15)"
                ],
                [
                    "Operating cash flow",
                    "238",
                    "266",
                    "287",
                    "293"
                ],
                [
                    "Capex — maintenance",
                    "[null — not disclosed]",
                    "[null]",
                    "[null]",
                    "[null]"
                ],
                [
                    "Capex — growth",
                    "[null — not disclosed]",
                    "[null]",
                    "[null]",
                    "[null]"
                ],
                [
                    "Capex — total",
                    "(96)",
                    "(108)",
                    "(118)",
                    "(121)"
                ],
                [
                    "Levered free cash flow",
                    "142",
                    "158",
                    "169",
                    "172"
                ],
                [
                    "Acquisitions (Hartwell)",
                    "(210)",
                    "—",
                    "—",
                    "—"
                ],
                [
                    "Disposals",
                    "6",
                    "2",
                    "3",
                    "3"
                ],
                [
                    "Debt issuance / (repayment), net",
                    "192",
                    "232",
                    "(18)",
                    "(18)"
                ],
                [
                    "Dividends / equity buyback",
                    "—",
                    "—",
                    "—",
                    "—"
                ],
                [
                    "Net cash change",
                    "130",
                    "25",
                    "26",
                    "12"
                ],
                [
                    "Cash taxes paid",
                    "(31)",
                    "(36)",
                    "(41)",
                    "(42)"
                ],
                [
                    "Cash interest paid",
                    "(181)",
                    "(188)",
                    "(193)",
                    "(196)"
                ]
            ]),
            X("Coverage note", "Maintenance/growth capex split not disclosed — stored null per template, total capex carried; flagged to CP-2 (impact: capex-flexibility assessment uses analyst split). Cash interest paid (CFS) runs $0–3M below IS interest expense — PIK-free structure confirmed.", [
                "E-22"
            ])
        ]
    },
    "CP-1:Balance Sheet Coverage": {
        ref: "REF_CP-1_06 · T4.6",
        out: "Balance sheet (all periods)",
        sections: [
            T("T4.6 · Balance sheet ($M)", [
                "",
                "FY23",
                "FY24",
                "FY25",
                "LTM Q1-26"
            ], [
                0,
                1,
                1,
                1,
                1
            ], [
                [
                    "Cash & equivalents",
                    "121",
                    "146",
                    "172",
                    "184"
                ],
                [
                    "Accounts receivable",
                    "398",
                    "418",
                    "441",
                    "452"
                ],
                [
                    "Inventory",
                    "372",
                    "381",
                    "396",
                    "401"
                ],
                [
                    "Net PP&E",
                    "902",
                    "894",
                    "881",
                    "876"
                ],
                [
                    "Goodwill & intangibles",
                    "1,588",
                    "1,571",
                    "1,544",
                    "1,538"
                ],
                [
                    "Total assets",
                    "3,556",
                    "3,584",
                    "3,611",
                    "3,628"
                ],
                [
                    "Gross debt (ex-leases)",
                    "2,513",
                    "2,517",
                    "2,552",
                    "2,575"
                ],
                [
                    "Operating leases",
                    "88",
                    "86",
                    "85",
                    "84"
                ],
                [
                    "Net debt",
                    "2,392",
                    "2,371",
                    "2,380",
                    "2,391"
                ],
                [
                    "Shareholders' equity (deficit)",
                    "(184)",
                    "(178)",
                    "(196)",
                    "(202)"
                ]
            ]),
            X("Coverage note", "Full coverage all periods; the net debt build reconciles to the facility-level schedule consumed by CP-3B. Negative book equity is LBO-structural (goodwill amortization + dividend at 2021 close), not a deterioration signal.")
        ]
    },
    "CP-1:Normalized Financials Table": {
        ref: "REF_CP-1_07 · T4.7",
        out: "Normalized financials (canonical)",
        sections: [
            T("T4.7 · Normalized financials ($M)", [
                "",
                "FY23",
                "FY24",
                "FY25",
                "LTM Q1-26"
            ], [
                0,
                1,
                1,
                1,
                1
            ], __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$module$2d$outputs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NORMALIZED_FINANCIAL_ROWS"]),
            X("Status", "Canonical table — these are the figures every downstream module consumes. Any module quoting different values is a CP-5 consistency defect.", [
                "E-103"
            ])
        ]
    },
    "CP-1:Derived Period Register": {
        ref: "REF_CP-1_08 · T4.8",
        out: "Derived period register",
        sections: [
            T("T4.8 · Derived periods", [
                "Period",
                "Method",
                "Status"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Q4-25",
                    "FY25 audited less reported Q1–Q3, cross-checked to sponsor model phasing",
                    "[Analyst estimate] — gap G-02"
                ]
            ]),
            X("Caveat", "Q4-25 management accounts were not provided. The derived quarter is flagged to CP-1B so quarterly variance work does not over-read the period; annual figures are unaffected (audited).", [
                "E-58"
            ])
        ]
    },
    "CP-1:Calc Register + KPI Build": {
        ref: "REF_CP-1_09 · T4.9/T4.10",
        out: "Calculation register — 41 KPIs",
        sections: [
            T("T4.9 · Calc register (material KPIs of 41)", [
                "ID",
                "KPI",
                "Definition",
                "LTM"
            ], [
                0,
                0,
                0,
                1
            ], [
                [
                    "K-01",
                    "Net leverage (adj.)",
                    "Net debt ÷ adj. EBITDA",
                    "5.68x"
                ],
                [
                    "K-04",
                    "Secured leverage",
                    "Secured debt ÷ covenant EBITDA (SFA)",
                    "4.68x"
                ],
                [
                    "K-09",
                    "Covenant EBITDA",
                    "Per SFA §1.01 — add-backs capped 25% / 24mo",
                    "$421.4M"
                ],
                [
                    "K-14",
                    "Adj. EBITDA margin",
                    "Adj. EBITDA ÷ revenue",
                    "15.0%"
                ],
                [
                    "K-22",
                    "FCF conversion",
                    "(OCF − capex) ÷ adj. EBITDA",
                    "41%"
                ],
                [
                    "K-31",
                    "Interest coverage",
                    "Adj. EBITDA ÷ cash interest",
                    "2.1x"
                ],
                [
                    "K-36",
                    "Aftermarket mix",
                    "A&S revenue ÷ total revenue",
                    "23.4%"
                ]
            ]),
            X("Build note", "41 KPIs registered with formula, inputs and calc references. Every downstream figure resolves to this register — ad-hoc math is a prohibited behavior.", [
                "E-22",
                "E-103"
            ])
        ]
    },
    "CP-1:Definition Conflict Register": {
        ref: "REF_CP-1_10 · T4.11",
        out: "Definition conflict register",
        sections: [
            T("T4.11 · Definition conflicts", [
                "#",
                "Conflict",
                "Divergence",
                "Disposition"
            ], [
                0,
                0,
                1,
                0
            ], [
                [
                    "DC-1",
                    "EBITDA add-back cap: SFA 25% / 24mo vs 2L Credit Agt uncapped",
                    "$14.2M",
                    "Both series carried — covenant calcs use controlling doc per facility"
                ],
                [
                    "DC-2",
                    "Sponsor model EBITDA basis vs audited presentation",
                    "$8.6M",
                    "Model basis quarantined to [Sponsor view]; not reconciled silently"
                ]
            ]),
            X("Note", "Conflicts are logged, not averaged. DC-1 is thesis-relevant: credit agreement grower baskets key off the larger, uncapped figure — handed to CP-4C.", [
                "E-09",
                "E-103"
            ])
        ]
    },
    "CP-1:Evidence→Risk→Credit Narrative": {
        ref: "REF_CP-1_11",
        out: "Analytical narrative by dimension",
        sections: [
            X("Leverage trajectory", "Evidence: net leverage 6.7x → 5.68x over nine quarters on EBITDA growth, not debt paydown (net debt flat at ~$2.4B). Risk mechanic: deleveraging is entirely earnings-dependent. Credit implication: any EBITDA stress re-rates leverage immediately — there is no amortization cushion."),
            X("Coverage & cash-flow quality", "Evidence: interest coverage 2.1x and FCF conversion 41% (K-22), with working capital consuming only ~$14M/yr. Risk mechanic: thin coverage but genuine cash generation; capex is light (4.3% of revenue). Credit implication: debt service is funded from operations with headroom; the +100bps rate channel (CP-2F) is the main coverage threat.", [
                "E-22"
            ]),
            X("Earnings quality", "Evidence: $76.6M of add-backs = 18.2% of adj. EBITDA; 'one-time' charges recurred in 3 of the last 4 years (D-04 p.58). Risk mechanic: presented EBITDA overstates run-rate cash earnings if add-backs are structural. Credit implication: a $35M haircut to base EBITDA is defensible — adopted by the IC Chair in CP-6A.", [
                "E-09",
                "E-87"
            ]),
            X("Data quality & definitions", "Evidence: gap G-02 (derived Q4-25) and conflicts DC-1/DC-2. Risk mechanic: comparability noise in quarterly series; basket capacity keys off the uncapped credit agreement definition. Credit implication: covenant capacity is larger than SFA-basis intuition suggests — quantified by CP-4C at $612M.", [
                "E-58"
            ])
        ]
    },
    "CP-1:Gaps + Downstream Readiness": {
        ref: "REF_CP-1_12 · T4.12",
        out: "Coverage gate + readiness",
        sections: [
            T("T4.12 · Downstream readiness", [
                "Consumer",
                "Requires",
                "Status"
            ], [
                0,
                0,
                0
            ], [
                [
                    "CP-1B / CP-1C",
                    "KPI register + quarterly series",
                    "GREEN — Q4-25 caveat attached"
                ],
                [
                    "CP-2 family",
                    "Normalized table + narrative",
                    "GREEN"
                ],
                [
                    "CP-3B",
                    "Debt schedule + claims",
                    "GREEN"
                ],
                [
                    "CP-4C",
                    "Covenant EBITDA series (both bases)",
                    "GREEN"
                ]
            ]),
            X("Coverage gate", "GREEN — all three statements present at quarterly grain FY23–LTM. G-02 is the only open item; all 11 downstream consumers cleared to start.")
        ]
    },
    /* ================= CP-1A · CompanyProfile ================= */ "CP-1A:Source Basis Establishment": {
        ref: "REF_CP-1A_01",
        out: "Source basis register",
        sections: [
            T("Source basis", [
                "Source",
                "Use",
                "Authority"
            ], [
                0,
                0,
                0
            ], [
                [
                    "D-01 CIM — Business (p.85–112)",
                    "Segments, customers, footprint, installed base",
                    "PRIMARY"
                ],
                [
                    "D-04 Audits — segment notes",
                    "Segment revenue / profit verification",
                    "PRIMARY"
                ],
                [
                    "D-06 Lender presentation",
                    "Color only — every claim cross-checked to grade A",
                    "SECONDARY"
                ]
            ])
        ]
    },
    "CP-1A:Source Classification": {
        ref: "REF_CP-1A_02",
        out: "Factual vs promotional split",
        sections: [
            T("Classification", [
                "Content",
                "Class",
                "Handling"
            ], [
                0,
                0,
                0
            ], [
                [
                    "CIM risk factors, audit notes, contract terms",
                    "FACTUAL",
                    "Drives the record"
                ],
                [
                    "Market-share and TAM claims (LP p.8–14)",
                    "PROMOTIONAL",
                    "[Sponsor view] label, excluded from credit record"
                ],
                [
                    "Cost-out program targets (LP / model)",
                    "PROMOTIONAL",
                    "Carried only as upside case via CP-1B"
                ]
            ])
        ]
    },
    "CP-1A:Transaction Summary": {
        ref: "REF_CP-1A_03",
        out: "Transaction summary",
        sections: [
            T("Subject transaction", [
                "Field",
                "Value"
            ], [
                0,
                0
            ], [
                [
                    "Instrument",
                    "$900M 2nd Lien Term Loan due 2031"
                ],
                [
                    "Margin / OID",
                    "S+425 · issued at 99.41 (May-26)"
                ],
                [
                    "Use of proceeds",
                    "Refinance 2L bridge ($860M) + general corporate purposes"
                ],
                [
                    "Pro forma net leverage",
                    "5.68x total · 4.68x secured (1L)"
                ],
                [
                    "Context",
                    "Fifth capital-structure event since 2021 LBO"
                ]
            ])
        ]
    },
    "CP-1A:Business Description": {
        ref: "REF_CP-1A_04",
        out: "Credit-relevant issuer description",
        sections: [
            X("Description", "Engineered metal components for industrial OEMs: drivetrain assemblies, fluid-system housings and aftermarket replacement parts. 14 plants (9 US, 4 EU, 1 MX), ~8,400 employees, #1 or #2 share in 7 of 9 core product lines. The credit-relevant core is the 1.9M-unit installed base feeding Aftermarket & Services at 44% of gross profit."),
            T("Segments", [
                "Segment",
                "Revenue mix",
                "Gross profit mix",
                "Character"
            ], [
                0,
                1,
                1,
                0
            ], [
                [
                    "Drivetrain",
                    "46%",
                    "38%",
                    "OEM-cyclical, top-3 concentrated"
                ],
                [
                    "Fluid Systems",
                    "31%",
                    "18%",
                    "OEM, shorter cycles"
                ],
                [
                    "Aftermarket & Services",
                    "23%",
                    "44%",
                    "Recurring, contract-locked, 92% renewal"
                ]
            ])
        ]
    },
    "CP-1A:Ownership Register": {
        ref: "REF_CP-1A_05",
        out: "Ownership register",
        sections: [
            T("Ownership", [
                "Holder",
                "Stake",
                "Notes"
            ], [
                0,
                1,
                0
            ], [
                [
                    "Kestrel Capital Fund V",
                    "68.4%",
                    "Control — drag rights, 6 of 7 board seats"
                ],
                [
                    "Co-invest vehicles (3 LPs)",
                    "22.4%",
                    "Passive, Kestrel-managed"
                ],
                [
                    "Management rollover",
                    "9.2%",
                    "CEO/CFO/COO — vested at 2021 close"
                ]
            ])
        ]
    },
    "CP-1A:Operating Model": {
        ref: "REF_CP-1A_06",
        out: "Operating model",
        sections: [
            X("Model", "Build-to-print and engineered-spec components manufactured across 14 plants; 71% of COGS is pass-through-indexed steel and alloys with a 60–90 day lag. Aftermarket attaches to the 1.9M-unit installed base under multi-year service agreements (avg. 7-year initial term) renewing at 92.4% by revenue with CPI-or-3% escalators.", [
                "E-12",
                "E-31"
            ]),
            T("Operating economics", [
                "Driver",
                "Value",
                "Credit relevance"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Indexed COGS share",
                    "71%",
                    "Margin protection, lagged"
                ],
                [
                    "Installed base",
                    "1.9M units",
                    "Aftermarket annuity feedstock"
                ],
                [
                    "Contract renewal rate",
                    "92.4%",
                    "Revenue visibility"
                ],
                [
                    "Top-10 customer tenure",
                    ">18 yrs",
                    "Switching-cost evidence"
                ]
            ])
        ]
    },
    "CP-1A:History / Timeline": {
        ref: "REF_CP-1A_07",
        out: "History & transaction timeline",
        sections: [
            T("Timeline", [
                "Date",
                "Event",
                "Consideration",
                "Multiple"
            ], [
                0,
                0,
                1,
                1
            ], [
                [
                    "Nov 2021",
                    "LBO by Kestrel Capital Fund V",
                    "$2,150M EV",
                    "7.9x"
                ],
                [
                    "Jun 2023",
                    "Bolt-on: Hartwell Precision (aero brackets)",
                    "$210M",
                    "6.4x"
                ],
                [
                    "Mar 2024",
                    "Repricing + $250M incremental TLB",
                    "—",
                    "—"
                ],
                [
                    "May 2026",
                    "2L TL $900M — refinance 2L bridge + GCP",
                    "—",
                    "—"
                ]
            ]),
            X("Pattern", "Four capital-structure events in 4.5 years — steady re-leveraging at flat net debt. The history reads as a sponsor managing leverage to a ceiling, not amortizing toward exit.")
        ]
    },
    "CP-1A:Credit Translation": {
        ref: "REF_CP-1A_08",
        out: "Credit translation",
        sections: [
            F("Evidence → Risk Mechanic → Credit Implication", [
                {
                    sev: "ok",
                    text: "Installed-base annuity (1.9M units, 92% renewal, 44% of GP) → recurring high-margin cash flow insensitive to OEM cycles → core credit support; floors EBITDA in CP-2B stress paths.",
                    ev: [
                        "E-12",
                        "E-31"
                    ]
                },
                {
                    sev: "warning",
                    text: "Top-3 OEMs at 38% of revenue, Meridian platform 14% repricing Q2-27 → volume and price risk concentrate into Drivetrain → primary downside transmission channel (CP-2B P1).",
                    ev: [
                        "E-15"
                    ]
                },
                {
                    sev: "warning",
                    text: "60–90 day pass-through lag on 71% of COGS → input spikes create 1–2 quarter margin gaps → noise risk around covenant test dates, not structural erosion.",
                    ev: [
                        "E-31"
                    ]
                }
            ])
        ]
    },
    "CP-1A:Gaps Ledger": {
        ref: "REF_CP-1A_09",
        out: "Gaps ledger",
        sections: [
            X("Ledger", "No descriptive gaps — org chart, segment detail and plant footprint all source-supported. MX facility carve-out detail (transfer pricing, local debt capacity) noted as thin but non-material to the guarantor analysis.")
        ]
    },
    "CP-1A:Module Summary": {
        ref: "REF_CP-1A_10",
        out: "Module summary",
        sections: [
            X("Summary", "A scaled, defensible industrial franchise: genuine switching costs (qualified-vendor status, >18-year customer tenure) and an annuity-grade aftermarket, attached to a concentrated OEM book and a sponsor with a re-leveraging pattern. Descriptive facts handed clean to CP-2; concentration mechanics handed to CP-2B.")
        ]
    },
    /* ================= CP-1B · EarningsMonitor ================= */ "CP-1B:File Gate & Source Validation": {
        ref: "REF_CP-1B_01",
        out: "Gate decision",
        sections: [
            T("Gate", [
                "Source",
                "Status"
            ], [
                0,
                0
            ], [
                [
                    "Q1-26 interim financials (CIM-extracted)",
                    "ADMITTED — grade A"
                ],
                [
                    "D-05 compliance certificate",
                    "ADMITTED — grade A"
                ],
                [
                    "D-07 sponsor model",
                    "ADMITTED — comparison basis only, grade C"
                ],
                [
                    "Q4-25 management accounts",
                    "ABSENT — derived period inherited from CP-1 (G-02)"
                ]
            ])
        ]
    },
    "CP-1B:Issuer / Period Scope": {
        ref: "REF_CP-1B_02",
        out: "Scope",
        sections: [
            T("Scope", [
                "Field",
                "Value"
            ], [
                0,
                0
            ], [
                [
                    "Window",
                    "Q2-25 → Q1-26 (4 quarters)"
                ],
                [
                    "Baseline",
                    "CP-1 normalized history — same entity key, same definitions"
                ],
                [
                    "Restatements",
                    "None"
                ]
            ])
        ]
    },
    "CP-1B:Definition Inheritance": {
        ref: "REF_CP-1B_03",
        out: "Inheritance confirmation",
        sections: [
            X("Confirmation", "All KPI definitions inherited from the CP-1 calc register unchanged (K-01 through K-41). Margins, leverage and FCF conversion are computed identically to history, so the variances reported below are real rather than definitional.")
        ]
    },
    "CP-1B:Summary Top Sheet": {
        ref: "REF_CP-1B_04",
        out: "Top sheet",
        sections: [
            T("Q1-26 top sheet", [
                "Metric",
                "Q1-26",
                "vs Q1-25",
                "Read"
            ], [
                0,
                1,
                1,
                0
            ], [
                [
                    "Revenue",
                    "$715M",
                    "+3.9%",
                    "in line"
                ],
                [
                    "Adj. EBITDA",
                    "$108M",
                    "+4.9%",
                    "in line"
                ],
                [
                    "Margin",
                    "15.1%",
                    "+10bps",
                    "stable"
                ],
                [
                    "Book-to-bill",
                    "1.06x",
                    "+0.04x",
                    "supportive"
                ],
                [
                    "Net leverage",
                    "5.68x",
                    "−0.3x",
                    "deleveraging on EBITDA"
                ]
            ])
        ]
    },
    "CP-1B:Financial Performance Table": {
        ref: "REF_CP-1B_05",
        out: "Quarterly performance",
        sections: [
            T("Performance (quarterly, $M)", [
                "",
                "Q2-25",
                "Q3-25",
                "Q4-25*",
                "Q1-26"
            ], [
                0,
                1,
                1,
                1,
                1
            ], [
                [
                    "Revenue",
                    "688",
                    "701",
                    "697",
                    "715"
                ],
                [
                    "Adj. EBITDA",
                    "103",
                    "106",
                    "104",
                    "108"
                ],
                [
                    "Margin",
                    "15.0%",
                    "15.1%",
                    "14.9%",
                    "15.1%"
                ],
                [
                    "Levered FCF",
                    "41",
                    "44",
                    "42",
                    "45"
                ]
            ]),
            X("Note", "* Q4-25 is the derived period (G-02). Revenue compounds ~1.3% sequentially with margin pinned in a 14.9–15.1% band.")
        ]
    },
    "CP-1B:KPI Dashboard": {
        ref: "REF_CP-1B_06",
        out: "KPI dashboard",
        sections: [
            T("KPI dashboard", [
                "",
                "Q2-25",
                "Q3-25",
                "Q4-25*",
                "Q1-26"
            ], [
                0,
                1,
                1,
                1,
                1
            ], [
                [
                    "Orders / book-to-bill",
                    "1.02x",
                    "1.04x",
                    "0.98x",
                    "1.06x"
                ],
                [
                    "Aftermarket mix (rev)",
                    "22.4%",
                    "22.8%",
                    "23.1%",
                    "23.4%"
                ],
                [
                    "Realized price vs input inflation",
                    "+30bps",
                    "+40bps",
                    "+30bps",
                    "+40bps"
                ],
                [
                    "Interest coverage",
                    "2.0x",
                    "2.1x",
                    "2.1x",
                    "2.1x"
                ]
            ]),
            X("Read", "Aftermarket mix grinding up (+100bps over 4 quarters) is the single most thesis-supportive operational trend on the dashboard.")
        ]
    },
    "CP-1B:Variance Analysis": {
        ref: "REF_CP-1B_07",
        out: "Variance vs sponsor model",
        sections: [
            T("Q1-26 vs sponsor model ($M)", [
                "Line",
                "Model",
                "Actual",
                "Δ",
                "Driver"
            ], [
                0,
                1,
                1,
                1,
                0
            ], [
                [
                    "Revenue",
                    "722.0",
                    "715.0",
                    "−1.0%",
                    "Fluid Systems volume"
                ],
                [
                    "Adj. EBITDA",
                    "112.7",
                    "108.0",
                    "−4.2%",
                    "volume (−3.1) + cost-out phasing (−1.6)"
                ],
                [
                    "Margin",
                    "15.6%",
                    "15.1%",
                    "−50bps",
                    "absorption"
                ]
            ]),
            X("Disposition", "Conflict logged to CP-5; the sponsor model is demoted to upside case. CP-1 normalized actuals remain the base for all downstream stress and valuation work.", [
                "E-58"
            ])
        ]
    },
    "CP-1B:Corporate Actions": {
        ref: "REF_CP-1B_08",
        out: "Corporate actions register",
        sections: [
            T("Actions in window", [
                "Date",
                "Action",
                "Cash impact"
            ], [
                0,
                0,
                1
            ], [
                [
                    "May 2026",
                    "$900M 2L TL issuance — refinance 2L bridge",
                    "+$28M net (fees, OID)"
                ],
                [
                    "Mar 2026",
                    "Hartwell earnout settlement agreed",
                    "−$24M (committed, H2-26)"
                ]
            ])
        ]
    },
    "CP-1B:Comparative Evaluation": {
        ref: "REF_CP-1B_09",
        out: "Peer-relative read",
        sections: [
            X("Evaluation", "Against the CP-1C universe's Q1 prints: ATLF's +3.9% revenue growth is middle-of-pack (peer range −1% to +7%), while its margin stability (±20bps band) is top-quartile — Karst and Tarn both printed >100bps of margin compression. No peer-relative deterioration detected.")
        ]
    },
    "CP-1B:Conflict Log": {
        ref: "REF_CP-1B_10",
        out: "Conflict log",
        sections: [
            F("Conflicts", [
                {
                    sev: "warning",
                    text: "C-1: Sponsor-model FY26E phasing vs Q1-26 actuals (−4.2%). Escalated to CP-5; model reclassified as upside case. Resolution requires two consecutive quarters within ±2% of model.",
                    ev: [
                        "E-58"
                    ]
                }
            ])
        ]
    },
    "CP-1B:Monitoring Assessment": {
        ref: "REF_CP-1B_11",
        out: "Monitoring assessment",
        sections: [
            T("Watch items → next print (Jul 28)", [
                "Item",
                "Threshold",
                "Routed to"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Add-back realization (first print)",
                    "< $30M run-rate → T-1 trips",
                    "CP-6A re-vote"
                ],
                [
                    "Fluid Systems volume",
                    "second consecutive miss",
                    "CP-2B P1 refresh"
                ],
                [
                    "Book-to-bill",
                    "< 0.95x",
                    "CP-2B flag"
                ]
            ])
        ]
    },
    "CP-1B:Gaps & Limitations Ledger": {
        ref: "REF_CP-1B_12",
        out: "Gaps ledger",
        sections: [
            X("Ledger", "Q4-25 derived-period caveat (G-02) is the only open limitation. Quarterly comparisons crossing that period are flagged in-table; annual and LTM figures are unaffected.")
        ]
    },
    "CP-1B:Overall Earnings View": {
        ref: "REF_CP-1B_13",
        out: "Overall earnings view",
        sections: [
            X("View", "Earnings trajectory intact: +6.2% LTM EBITDA growth, book-to-bill 1.06x, realized price (+180bps) running ahead of input inflation (+140bps), aftermarket mix rising. The sponsor model runs hot — use CP-1 normalized actuals as the base and treat the model as upside. The Jul 28 print is the next thesis checkpoint.")
        ]
    },
    /* ================= CP-1C · PeerBenchmarking ================= */ "CP-1C:Peer Discovery Gate": {
        ref: "REF_CP-1C_00",
        out: "Discovery decision",
        sections: [
            T("Candidate screen", [
                "Candidate",
                "Decision",
                "Reason"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Forgeline · Karst · Veldt · Ironvale · Cascadia · Tarn",
                    "KEPT (6)",
                    "single-B engineered components, comparable scale"
                ],
                [
                    "Meridian Industrial (customer)",
                    "DROPPED",
                    "customer of subject — conflict"
                ],
                [
                    "2 diversified industrials",
                    "DROPPED",
                    "conglomerate mix, not comparable"
                ],
                [
                    "1 auto-pure supplier",
                    "DROPPED",
                    "end-market mismatch"
                ]
            ])
        ]
    },
    "CP-1C:Peer Data Gate": {
        ref: "REF_CP-1C_01",
        out: "Data sufficiency",
        sections: [
            T("Sufficiency by metric", [
                "Metric",
                "Coverage",
                "Source"
            ], [
                0,
                0,
                0
            ], [
                [
                    "EBITDA margin / growth",
                    "7 of 7",
                    "public filings + CIM Annex C"
                ],
                [
                    "Net leverage",
                    "7 of 7",
                    "filings"
                ],
                [
                    "FCF conversion",
                    "7 of 7",
                    "filings"
                ],
                [
                    "DM (market)",
                    "7 of 7",
                    "LoanX / desk runs Jun 8"
                ]
            ]),
            X("Decision", "PASS — full metric set available for all seven names. The CIM Annex C anchor later proved mismatched (see Metric Alignment Register).")
        ]
    },
    "CP-1C:Peer Universe Register": {
        ref: "REF_CP-1C_02",
        out: "Peer universe",
        sections: [
            T("Universe (7 names)", [
                "Name",
                "Rating",
                "Revenue",
                "Why comparable"
            ], [
                0,
                0,
                1,
                0
            ], [
                [
                    "Atlas Forge (subject)",
                    "B2 / B",
                    "$2.8B",
                    "—"
                ],
                [
                    "Forgeline Industries",
                    "B2 / B",
                    "$2.1B",
                    "forged components, OEM/aftermarket"
                ],
                [
                    "Karst Components",
                    "B3 / B−",
                    "$1.6B",
                    "machined parts, higher leverage"
                ],
                [
                    "Veldt Precision",
                    "B1 / B+",
                    "$2.4B",
                    "precision metal, best-in-cohort margins"
                ],
                [
                    "Ironvale Group",
                    "B2 / B",
                    "$3.1B",
                    "industrial metal platforms"
                ],
                [
                    "Cascadia Metalworks",
                    "B2 / B",
                    "$1.9B",
                    "metal forming, unsecured structure"
                ],
                [
                    "Tarn Engineered Sys",
                    "B3 / CCC+",
                    "$1.5B",
                    "distressed outlier — context only"
                ]
            ])
        ]
    },
    "CP-1C:Metric Alignment Register": {
        ref: "REF_CP-1C_03",
        out: "Alignment register",
        sections: [
            T("Alignment to CP-1 definitions", [
                "Metric",
                "Alignment action",
                "Status"
            ], [
                0,
                0,
                0
            ], [
                [
                    "EBITDA (peers)",
                    "Re-stated to subject's adj. definition where add-back detail disclosed",
                    "ALIGNED (5 of 6)"
                ],
                [
                    "Peer margin set (Annex C)",
                    "Cited CIM Annex C p.388 — anchor mismatched",
                    "OPEN — QA-117"
                ],
                [
                    "Leverage",
                    "Net debt standardized ex-leases",
                    "ALIGNED"
                ],
                [
                    "FCF conversion",
                    "K-22 formula applied uniformly",
                    "ALIGNED"
                ]
            ]),
            F("Open item", [
                {
                    sev: "critical",
                    text: "E-44: p.388 of the conformed CIM contains the auditor consent letter, not the peer margin table (expected p.391 of prior draft). Benchmark conclusions carried ex-E-44 until re-anchored — QA-117 (HIGH).",
                    ev: [
                        "E-44"
                    ]
                }
            ])
        ]
    },
    "CP-1C:Operating Benchmark": {
        ref: "REF_CP-1C_04A",
        out: "Operating benchmark",
        sections: [
            T("4A · Operating benchmark", [
                "Peer",
                "EBITDA mgn",
                "Rev growth (LTM)",
                "Aftermkt mix"
            ], [
                0,
                1,
                1,
                1
            ], [
                [
                    "Atlas Forge (subject)",
                    "15.0%",
                    "+4.1%",
                    "23.4%"
                ],
                [
                    "Veldt Precision",
                    "16.2%",
                    "+5.2%",
                    "27%"
                ],
                [
                    "Ironvale Group",
                    "14.1%",
                    "+3.0%",
                    "19%"
                ],
                [
                    "Forgeline Industries",
                    "13.8%",
                    "+2.2%",
                    "16%"
                ],
                [
                    "Cascadia Metalworks",
                    "13.2%",
                    "+1.4%",
                    "14%"
                ],
                [
                    "Karst Components",
                    "12.1%",
                    "−0.8%",
                    "11%"
                ],
                [
                    "Tarn Engineered Sys",
                    "11.4%",
                    "−3.1%",
                    "9%"
                ]
            ]),
            X("Read", "Subject ranks 2nd on margin (64th percentile incl. outlier) and 2nd on aftermarket mix — the operational basis for the better-than-cohort credit view.")
        ]
    },
    "CP-1C:Cash Flow & Capital Intensity": {
        ref: "REF_CP-1C_04B",
        out: "Cash flow benchmark",
        sections: [
            T("4B · Cash flow & capital intensity", [
                "Peer",
                "Capex % rev",
                "FCF conversion"
            ], [
                0,
                1,
                1
            ], [
                [
                    "Atlas Forge (subject)",
                    "4.3%",
                    "41%"
                ],
                [
                    "Veldt Precision",
                    "3.9%",
                    "38%"
                ],
                [
                    "Ironvale Group",
                    "5.1%",
                    "33%"
                ],
                [
                    "Forgeline Industries",
                    "5.6%",
                    "31%"
                ],
                [
                    "Cascadia Metalworks",
                    "6.2%",
                    "29%"
                ],
                [
                    "Karst Components",
                    "6.8%",
                    "27%"
                ],
                [
                    "Tarn Engineered Sys",
                    "7.4%",
                    "22%"
                ]
            ]),
            X("Read", "Second-lightest capex and top-quartile FCF conversion — the clearest fundamental edge over the peer set.", [
                "E-22"
            ])
        ]
    },
    "CP-1C:Credit Metric Benchmark": {
        ref: "REF_CP-1C_04C",
        out: "Credit metric benchmark",
        sections: [
            T("4C · Credit metric benchmark", [
                "Peer",
                "Rating",
                "Net lev",
                "EBITDA mgn",
                "FCF conv",
                "DM"
            ], [
                0,
                0,
                1,
                1,
                1,
                1
            ], __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$module$2d$outputs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PEER_CREDIT_METRIC_ROWS"])
        ]
    },
    "CP-1C:Summary Statistics": {
        ref: "REF_CP-1C_04D",
        out: "Summary statistics",
        sections: [
            T("4D · Summary statistics (ex-Tarn)", [
                "Metric",
                "Subject",
                "B2 median",
                "Percentile"
            ], [
                0,
                1,
                1,
                1
            ], [
                [
                    "Net leverage",
                    "5.7x",
                    "5.5x",
                    "38th"
                ],
                [
                    "EBITDA margin",
                    "15.0%",
                    "13.9%",
                    "64th"
                ],
                [
                    "FCF conversion",
                    "41%",
                    "31%",
                    "92nd"
                ],
                [
                    "DM",
                    "+388",
                    "+327",
                    "+61bps wide"
                ]
            ])
        ]
    },
    "CP-1C:Outlier Register": {
        ref: "REF_CP-1C_05",
        out: "Outlier register",
        sections: [
            X("Register", "Tarn Engineered (B3 / CCC+, +577bps, negative growth) excluded from median computation as a distressed outlier; retained in tables for context. No other exclusions. Sensitivity: including Tarn widens the median DM to +341 and flatters the subject's relative position — the conservative ex-Tarn basis is carried.")
        ]
    },
    "CP-1C:Public Trading Comps": {
        ref: "REF_CP-1C_06A",
        out: "Trading comps",
        sections: [
            T("6A · Public trading comps", [
                "Comp",
                "EV/EBITDA",
                "EBITDA mgn",
                "Note"
            ], [
                0,
                1,
                1,
                0
            ], [
                [
                    "Listed precision components A",
                    "10.4x",
                    "17.1%",
                    "scale premium"
                ],
                [
                    "Listed industrial platforms B",
                    "9.5x",
                    "14.8%",
                    "closest mix"
                ],
                [
                    "Listed metal forming C",
                    "8.9x",
                    "13.0%",
                    "lower aftermarket"
                ]
            ])
        ]
    },
    "CP-1C:Transaction Comps": {
        ref: "REF_CP-1C_06B",
        out: "Transaction comps",
        sections: [
            T("6B · Transaction comps (thin set)", [
                "Transaction",
                "Date",
                "EV/EBITDA"
            ], [
                0,
                0,
                1
            ], [
                [
                    "Hartwell Precision (subject's bolt-on)",
                    "Jun-23",
                    "6.4x"
                ],
                [
                    "Sector take-private (sponsor-led)",
                    "Sep-24",
                    "7.8x"
                ]
            ]),
            X("Limitation", "Two clean datapoints only — used directionally for the implied-EV cross-check and flagged as a limitation; no multiple conclusions drawn from this set alone.")
        ]
    },
    "CP-1C:Implied EV": {
        ref: "REF_CP-1C_06C",
        out: "Implied EV cross-check",
        sections: [
            T("6C · Implied EV vs claims ($M)", [
                "Basis",
                "Multiple",
                "EV",
                "Coverage of $3,270M debt"
            ], [
                0,
                1,
                1,
                1
            ], [
                [
                    "Trading comps — low",
                    "8.9x",
                    "3,747",
                    "1.15x"
                ],
                [
                    "Trading comps — mid",
                    "9.5x",
                    "4,000",
                    "1.22x"
                ],
                [
                    "LBO entry (2021)",
                    "7.9x",
                    "3,326",
                    "1.02x"
                ],
                [
                    "Break-even on total debt",
                    "7.8x",
                    "3,270",
                    "1.00x"
                ]
            ]),
            X("Read", "An equity cushion exists at trading multiples; it erodes to zero at ~7.8x — context for CP-3B's recovery work, where stressed multiples of 5.0–6.0x are the relevant range.")
        ]
    },
    "CP-1C:Peer Interpretation & Credit Translation": {
        ref: "REF_CP-1C_07",
        out: "Credit translation",
        sections: [
            X("Translation", "Evidence: +61bps wide of the B2 median with 92nd-percentile FCF conversion and 64th-percentile margin. Risk mechanic: the market prices ATLF as an average B2 while operating fundamentals screen better-than-cohort; the discount plausibly reflects documentation aggressiveness (CP-4) and sponsor history (CP-2D), not operations. Credit implication: positive carry vs fundamentals — the spread compensates risks that are monitorable (baskets, certificates) rather than structural.")
        ]
    },
    "CP-1C:Gaps & Limitations Ledger": {
        ref: "REF_CP-1C_08",
        out: "Gaps ledger",
        sections: [
            X("Ledger", "Two limitations carried on conclusions: (1) E-44 anchor mismatch (QA-117, HIGH) — margin-set conclusions published ex-E-44; (2) thin transaction-comp set — directional use only. Neither is papered over; both appear wherever the affected figures are quoted.")
        ]
    },
    "CP-1C:Overall Peer Benchmarking View": {
        ref: "REF_CP-1C_09",
        out: "Overall view",
        sections: [
            X("View", "Subject screens cheap: +61bps wide of the B2 median with top-quartile FCF conversion and above-median margin. Ex-E-44 the gap compresses to +20–25bps — still positive carry against fundamentals. Rank basis handed to CP-3 for the fair-value band and final ranking.", [
                "E-71"
            ])
        ]
    }
};
// ── from step-outputs-l2.js ──
const O1 = {
    /* ================= CP-2 · FundamentalCreditSynthesizer ================= */ "CP-2:Source Gate & Readiness": {
        ref: "REF_CP-2_01",
        out: "Source register + module status",
        sections: [
            T("Feeder status", [
                "Feeder",
                "Output consumed",
                "Status"
            ], [
                0,
                0,
                0
            ], [
                [
                    "CP-1",
                    "Normalized financials + 41-KPI register",
                    "GREEN"
                ],
                [
                    "CP-1A",
                    "Business / ownership / operating model",
                    "GREEN"
                ],
                [
                    "CP-1B",
                    "Q1-26 print + variance analysis",
                    "GREEN"
                ],
                [
                    "CP-1C",
                    "Peer benchmarks (ex-E-44 basis)",
                    "GREEN — limitation noted"
                ]
            ]),
            X("Status", "READY — CP-2 consumes published outputs only; no raw-document re-extraction performed.")
        ]
    },
    "CP-2:Company Description": {
        ref: "REF_CP-2_02",
        out: "Credit-relevant issuer description",
        sections: [
            X("Description", "Scaled engineered-components platform serving industrial OEMs across Drivetrain (46% of revenue), Fluid Systems (31%) and Aftermarket & Services (23% of revenue, 44% of gross profit). The credit rests on the aftermarket annuity: a 1.9M-unit installed base under multi-year contracts renewing at 92%, generating recurring high-margin cash flow that is structurally less cyclical than the OEM book it attaches to. 14 plants; 71% of COGS pass-through-indexed with a 60–90 day lag.")
        ]
    },
    "CP-2:Ownership & Group Structure": {
        ref: "REF_CP-2_03",
        out: "Ownership / governance assessment",
        sections: [
            X("Assessment", "Kestrel Capital Fund V controls 68.4% with 6 of 7 board seats; management rolled 9.2%. The covenant group is clean — no unrestricted subsidiaries at close, full guarantor coverage at 87% of EBITDA, and no orphaned value outside the restricted perimeter. Governance risk is therefore concentrated in financial policy (CP-2D), not structure.")
        ]
    },
    "CP-2:Revenue Drivers & Pricing Power": {
        ref: "REF_CP-2_04A",
        out: "Revenue durability assessment",
        sections: [
            T("Revenue drivers", [
                "Driver",
                "Share",
                "Durability read"
            ], [
                0,
                1,
                0
            ], [
                [
                    "OEM long-term agreements (indexed)",
                    "71% of OEM rev",
                    "visible, price-protected, volume-cyclical"
                ],
                [
                    "Aftermarket service contracts",
                    "23% of rev",
                    "recurring — 92% renewal, CPI-or-3% escalators"
                ],
                [
                    "Spot / short-cycle orders",
                    "~9% of rev",
                    "cyclical swing factor"
                ]
            ]),
            X("Assessment", "Evidence: indexed LTAs and contract-locked aftermarket. Risk mechanic: price is protected mechanically but volume is not — top-3 OEM concentration (38%) caps realized pricing power on the Drivetrain book. Credit implication: revenue durability MODERATE-PLUS; visibility is good, cyclicality is concentrated and mapped (CP-2B P1).", [
                "E-31",
                "E-15"
            ])
        ]
    },
    "CP-2:Cost Structure & Margin Resilience": {
        ref: "REF_CP-2_04B",
        out: "Margin resilience assessment",
        sections: [
            T("Cost structure", [
                "Bucket",
                "Share of COGS",
                "Flexibility"
            ], [
                0,
                1,
                0
            ], [
                [
                    "Steel / alloys (indexed pass-through)",
                    "71%",
                    "protected, 60–90d lag"
                ],
                [
                    "Direct labor",
                    "17%",
                    "semi-variable — plant-level flex"
                ],
                [
                    "Freight, energy, other",
                    "12%",
                    "partially contracted"
                ]
            ]),
            X("Assessment", "Margin held a 14.9–15.1% band through the FY22–24 input-cost spike cycle — the lag produces quarter noise, not erosion. Fixed-cost absorption across 14 plants is the real margin risk under volume decline (−12% volume ≈ −18% EBITDA per CP-2B). Margin stability: AVERAGE-PLUS with a defined failure mode.")
        ]
    },
    "CP-2:Capital Intensity & FCF Conversion": {
        ref: "REF_CP-2_04C",
        out: "FCF conversion assessment",
        sections: [
            X("Assessment", "Evidence: capex 4.3% of revenue (maintenance ≈ 2.9% analyst split), FCF conversion 41% (K-22), working capital consuming ~$14M/yr. Risk mechanic: capex-light model converts EBITDA to cash at top-quartile rates and roughly $25M of capex is deferrable in stress. Credit implication: FCF durability is the strongest quantitative support in the credit — debt service funds from operations with headroom at current rates.", [
                "E-22"
            ])
        ]
    },
    "CP-2:Porter Five Forces": {
        ref: "REF_CP-2_05A",
        out: "Porter — credit-translated",
        sections: [
            T("Five forces — credit translation", [
                "Force",
                "Assessment",
                "Credit implication"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Buyer power",
                    "HIGH",
                    "top-3 OEMs 38% of rev; Meridian repricing Q2-27 is the live PD/margin channel"
                ],
                [
                    "Supplier power",
                    "LOW",
                    "commodity inputs, indexed pass-through — margin protected mechanically"
                ],
                [
                    "Threat of new entrants",
                    "LOW",
                    "qualified-vendor lock-in, >18-yr tenure — protects revenue visibility and recovery value"
                ],
                [
                    "Threat of substitutes",
                    "LOW",
                    "engineered-spec parts; redesign cost exceeds savings — installed base defensible"
                ],
                [
                    "Competitive rivalry",
                    "MODERATE",
                    "consolidated niches; price rivalry concentrated in short-cycle spot work (~9% of rev)"
                ]
            ]),
            X("Per-force narrative", "Buyer power is the only force with a material credit channel: Evidence — 38% top-3 concentration and a scheduled platform repricing (Q2-27). Risk mechanic — a single negotiation can reprice ~14% of revenue; OEM destocking transmits volume shock in 1–2 quarters. Credit implication — primary downside pathway (CP-2B P1) and a named monitoring trigger (T-3). The remaining four forces are credit-supportive: they underpin margin durability, the aftermarket annuity, and recovery-relevant franchise value, and none introduces an independent PD/LGD channel.", [
                "E-15"
            ])
        ]
    },
    "CP-2:PEST Analysis": {
        ref: "REF_CP-2_05B",
        out: "PEST — credit-translated (material factors only)",
        sections: [
            T("PEST (material factors)", [
                "Factor",
                "Materiality",
                "Credit translation"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Economic — base rates",
                    "MATERIAL",
                    "61% floating (modeled unhedged): +100bps ≈ −$12.1M FCF — coverage channel"
                ],
                [
                    "Economic — industrial cycle",
                    "MATERIAL",
                    "OEM destocking is the P1 trigger; monitored via order data"
                ],
                [
                    "Political — reshoring incentives",
                    "MINOR +",
                    "US footprint (9 plants) modestly advantaged"
                ],
                [
                    "Tech / Social / Regulatory",
                    "IMMATERIAL",
                    "skipped with statement — no PD/LGD/liquidity channel identified"
                ]
            ])
        ]
    },
    "CP-2:SWOT Analysis": {
        ref: "REF_CP-2_05C",
        out: "SWOT — credit-translated",
        sections: [
            T("SWOT (credit-translated)", [
                "Quadrant",
                "Items"
            ], [
                0,
                0
            ], [
                [
                    "Strengths (credit-supportive)",
                    "aftermarket annuity (44% GP, 92% renewal) · 41% FCF conversion · indexed COGS"
                ],
                [
                    "Weaknesses (credit-constraining)",
                    "add-backs 18.2% of adj. EBITDA · top-3 OEM 38% · thin coverage (2.1x)"
                ],
                [
                    "Opportunities (quality improvers)",
                    "add-back realization → real deleveraging to ~4.9x FY27 · aftermarket mix shift"
                ],
                [
                    "Threats (quality weakeners)",
                    "destocking + MFN-sunset sequencing · sponsor recap in 2027-28 window · Meridian repricing"
                ]
            ])
        ]
    },
    "CP-2:Key Strengths & Weaknesses": {
        ref: "REF_CP-2_06",
        out: "Top strengths / weaknesses",
        sections: [
            T("Net assessment", [
                "#",
                "Strengths",
                "Weaknesses"
            ], [
                0,
                0,
                0
            ], [
                [
                    "1",
                    "Aftermarket annuity — recurring, contract-locked, 44% of GP",
                    "EBITDA quality — 18.2% add-backs, recurrence pattern"
                ],
                [
                    "2",
                    "FCF conversion 41% — top-quartile, capex-light",
                    "OEM concentration — top-3 at 38%, Meridian 14%"
                ],
                [
                    "3",
                    "Indexed cost base — margin protected through cycles",
                    "Documentation — $612M capacity + MFN sunset (CP-4)"
                ]
            ]),
            X("Balance", "Two durable strengths against two structural weaknesses plus a documentation overhang — neither side dominant; the balance prices as a mid-B2 with above-median fundamentals.")
        ]
    },
    "CP-2:Financial Profile & Credit Quality": {
        ref: "REF_CP-2_07",
        out: "9-dimension scorecard + synthesis",
        sections: [
            T("9-dimension financial profile", [
                "Dimension",
                "Rating",
                "Basis"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Scale / market position",
                    "Strong",
                    "$2.8B revenue · #1-2 in 7 of 9 lines"
                ],
                [
                    "Competitive advantage",
                    "Strong",
                    "qualified-vendor lock-in, installed base"
                ],
                [
                    "Business diversification",
                    "Average",
                    "3 segments but top-3 customers 38%"
                ],
                [
                    "Cost and capex flexibility",
                    "Average",
                    "indexed COGS; capex split undisclosed (null)"
                ],
                [
                    "Margin stability",
                    "Strong",
                    "14.9–15.1% band through input spike"
                ],
                [
                    "Free cash flow stability",
                    "Strong",
                    "41% conversion, low WC drag"
                ],
                [
                    "Refinance / market access",
                    "Average",
                    "May-26 issue priced inside talk; no near wall"
                ],
                [
                    "Liquidity position",
                    "Strong",
                    "19.3 months-to-empty, 78% RCF undrawn"
                ],
                [
                    "Financial policy / governance",
                    "Weak",
                    "sponsor recap record, RP pre-positioning, add-back presentation"
                ]
            ]),
            X("Synthesis", "Five Strong / three Average / one Weak — composite lands mid-B2, consistent with agency ratings. The single Weak dimension (financial policy) is also the one the documents amplify (CP-4C capacity), which is why governance carries disproportionate monitoring weight.")
        ]
    },
    "CP-2:Outlook, Tailwinds & Headwinds": {
        ref: "REF_CP-2_08",
        out: "Outlook",
        sections: [
            T("12–18 month outlook", [
                "Direction",
                "Items"
            ], [
                0,
                0
            ], [
                [
                    "Tailwinds",
                    "order book 1.06x · aftermarket mix +100bps/yr · realized price > input inflation · reshoring (minor)"
                ],
                [
                    "Headwinds",
                    "Meridian repricing Q2-27 · cost-out phasing risk into FY26 add-back test · rate resets on 61% floating"
                ]
            ]),
            X("Outlook", "STABLE. The order book supports low-single-digit growth; the binding uncertainty is not demand but proof of add-back realization at the Q3-26 certificate.")
        ]
    },
    "CP-2:Qualitative Downside Scenario": {
        ref: "REF_CP-2_09",
        out: "Issuer-specific downside scenario",
        sections: [
            X("Scenario", "An OEM destocking cycle hits Drivetrain (−12% volume over two quarters) while 'one-time' restructuring charges recur, compressing reported and adjusted EBITDA simultaneously — quality risk and volume risk arriving together. Absorption deleverage takes EBITDA toward $345M; leverage prints near 6.9x against a 5.7x entry assumption; and the open MFN window makes a priming incremental rational for the sponsor exactly when bondholders are weakest. Quantified by CP-2B as pathway P1; sequencing risk priced via CP-6E sizing.")
        ]
    },
    "CP-2:Materiality Filter": {
        ref: "REF_CP-2_10",
        out: "Ranked material drivers",
        sections: [
            T("Materiality ranking (23 candidates → 6 material)", [
                "Rank",
                "Driver",
                "Channel"
            ], [
                0,
                0,
                0
            ], [
                [
                    "1",
                    "EBITDA quality / add-backs (18.2%)",
                    "PD + leverage measurement"
                ],
                [
                    "2",
                    "OEM concentration / Meridian",
                    "PD — volume transmission"
                ],
                [
                    "3",
                    "Documentation capacity ($612M + MFN)",
                    "LGD — priming / leakage"
                ],
                [
                    "4",
                    "FCF conversion 41%",
                    "PD mitigant"
                ],
                [
                    "5",
                    "Rate exposure (61% floating, L-04)",
                    "coverage"
                ],
                [
                    "6",
                    "Sponsor financial policy",
                    "LGD + event risk"
                ]
            ]),
            X("Dropped", "17 immaterial factors dropped with statement (FX translation, single-plant items, ESG ratings drift, pension de-minimis) — kept out of the issuer matrix to preserve decision focus.")
        ]
    },
    "CP-2:Issuer Matrix": {
        ref: "REF_CP-2_11",
        out: "Issuer matrix",
        sections: [
            T("Issuer matrix (6 material factors)", [
                "Factor",
                "Assessment",
                "Trend",
                "Weight"
            ], [
                0,
                0,
                0,
                1
            ], [
                [
                    "Aftermarket annuity (44% GP)",
                    "STRENGTH — contract-locked, 92% renewal",
                    "stable",
                    "high"
                ],
                [
                    "EBITDA quality / add-backs",
                    "WEAKNESS — 18.2% of adj. EBITDA",
                    "improving",
                    "high"
                ],
                [
                    "OEM concentration (top-3 38%)",
                    "WEAKNESS — Meridian repricing Q2-27",
                    "stable",
                    "high"
                ],
                [
                    "FCF conversion 41%",
                    "STRENGTH — capex-light vs peers",
                    "stable",
                    "med"
                ],
                [
                    "Input cost pass-through (60–90d lag)",
                    "NEUTRAL — margin noise, not erosion",
                    "stable",
                    "med"
                ],
                [
                    "Sponsor financial policy",
                    "WEAKNESS — recap history at Kestrel",
                    "watch",
                    "med"
                ]
            ])
        ]
    },
    "CP-2:Monitoring Triggers": {
        ref: "REF_CP-2_12",
        out: "Observable trigger table",
        sections: [
            T("Standing triggers", [
                "ID",
                "Trigger",
                "Observable",
                "On trip"
            ], [
                0,
                0,
                0,
                0
            ], [
                [
                    "T-1",
                    "Add-back realization < $30M",
                    "Q3-26 compliance certificate",
                    "CP-6A re-vote"
                ],
                [
                    "T-2",
                    "Incremental raise > $200M in MFN window",
                    "facility notices / LoanX",
                    "CP-3B re-rank + CP-6E review"
                ],
                [
                    "T-3",
                    "Meridian repricing terms",
                    "Q2-27 disclosure",
                    "CP-2B P1 refresh"
                ],
                [
                    "T-4",
                    "RP basket activation",
                    "covenant certificate / notices",
                    "posture change — CP-2D + CP-6E"
                ]
            ])
        ]
    },
    "CP-2:Overall Credit View": {
        ref: "REF_CP-2_13",
        out: "Synthesis narrative",
        sections: [
            X("Overall credit view", "A fundamentally sound B2: durable aftermarket economics and genuine FCF offset by aggressive EBITDA presentation and customer concentration. Deleveraging to ~4.9x by FY27 is credible on realized add-backs alone; the binding risks are documentation-enabled releveraging (CP-4C) and the Meridian contract cycle. No new data — synthesis of steps 1–12 only.", [
                "E-22",
                "E-09"
            ])
        ]
    },
    /* ================= CP-2B · DownsidePathways ================= */ "CP-2B:Source Gate & Baseline": {
        ref: "REF_CP-2B_01",
        out: "Baseline lock",
        sections: [
            T("Baseline", [
                "Field",
                "Value"
            ], [
                0,
                0
            ], [
                [
                    "EBITDA baseline",
                    "$421M LTM adj. (CP-1 normalized actuals)"
                ],
                [
                    "Excluded",
                    "Sponsor model — prohibited from stress arithmetic"
                ],
                [
                    "Liquidity input",
                    "CP-2E bridge (+$96M / 12mo)"
                ]
            ])
        ]
    },
    "CP-2B:Business Model Snapshot": {
        ref: "REF_CP-2B_02",
        out: "Stress-relevant snapshot",
        sections: [
            X("Snapshot", "Stress-relevant mechanics: 46% Drivetrain exposure with top-3 OEMs at 38% of revenue; operating leverage across 14 plants (fixed-cost absorption is the amplifier); 60–90 day pass-through lag (timing exposure); aftermarket buffer at 44% of gross profit (the damper). The model stresses volume and lag — price is mechanically protected.")
        ]
    },
    "CP-2B:Fragility Map": {
        ref: "REF_CP-2B_03",
        out: "Fragility map",
        sections: [
            T("Fragility map", [
                "ID",
                "Fragility",
                "Early indicator"
            ], [
                0,
                0,
                0
            ], [
                [
                    "F-1",
                    "Absorption deleverage — fixed plant costs vs volume",
                    "plant utilization < 78%"
                ],
                [
                    "F-2",
                    "OEM concentration — top-3 at 38%",
                    "OEM order intake (monthly)"
                ],
                [
                    "F-3",
                    "Pass-through lag — 60–90d margin gap",
                    "alloy index vs realized price spread"
                ],
                [
                    "F-4",
                    "Covenant-capacity interaction — stress meets open baskets",
                    "incremental raise notices in MFN window"
                ]
            ])
        ]
    },
    "CP-2B:Stress Transmission Table": {
        ref: "REF_CP-2B_04",
        out: "Transmission mechanics",
        sections: [
            T("Transmission", [
                "Shock",
                "Mechanics",
                "EBITDA effect"
            ], [
                0,
                0,
                1
            ], [
                [
                    "Drivetrain volume −10%",
                    "absorption deleverage ≈ 1.4x multiplier",
                    "−14%"
                ],
                [
                    "Alloy spike +20% (lagged)",
                    "1–2 qtr margin gap, recovers",
                    "−4% (2 qtrs)"
                ],
                [
                    "Aftermarket attrition −5pp renewal",
                    "slow bleed — contract roll-off",
                    "−3% / yr"
                ],
                [
                    "Warranty cascade (SXAA read-across)",
                    "accrual build + margin compression",
                    "−9% (3 qtrs)"
                ]
            ])
        ]
    },
    "CP-2B:Downside Pathway Register": {
        ref: "REF_CP-2B_05",
        out: "Pathway register",
        sections: [
            T("Pathways", [
                "Path",
                "Trigger",
                "Transmission",
                "EBITDA impact",
                "Prob."
            ], [
                0,
                0,
                0,
                1,
                1
            ], [
                [
                    "P1",
                    "OEM destocking cycle",
                    "Drivetrain volumes −12% over 2 qtrs; absorption deleverage",
                    "−18%",
                    "25%"
                ],
                [
                    "P2",
                    "Warranty / recall cascade",
                    "Aftermarket margin compression + accrual build over 3 qtrs",
                    "−9%",
                    "35%"
                ],
                [
                    "P3",
                    "Alloy input spike > pass-through lag",
                    "60–90 day margin gap; recovers within 2 qtrs",
                    "−6%",
                    "30%"
                ]
            ])
        ]
    },
    "CP-2B:Downside Sensitivity Matrix": {
        ref: "REF_CP-2B_06",
        out: "Sensitivity matrix",
        sections: [
            T("EBITDA outcomes ($M) — volume shock × cost-out delivery", [
                "Volume shock",
                "Cost-out 0%",
                "Cost-out 50%",
                "Cost-out 100%"
            ], [
                0,
                1,
                1,
                1
            ], [
                [
                    "−5%",
                    "392",
                    "401",
                    "410"
                ],
                [
                    "−10%",
                    "362",
                    "371",
                    "380"
                ],
                [
                    "−15%",
                    "345",
                    "354",
                    "363"
                ]
            ]),
            X("Read", "Leverage holds under 7.0x in all but the corner case (−15% volume, zero cost-out → 6.93x). No cell breaches liquidity inside 12 months.")
        ]
    },
    "CP-2B:Monitoring Sensitivity Flags": {
        ref: "REF_CP-2B_07",
        out: "Early-warning flags",
        sections: [
            T("Flags wired to CP-MON", [
                "Flag",
                "Threshold",
                "Cadence"
            ], [
                0,
                0,
                0
            ], [
                [
                    "OEM order intake",
                    "−8% y/y for 2 months",
                    "monthly"
                ],
                [
                    "Drivetrain book-to-bill",
                    "< 0.95x",
                    "quarterly"
                ],
                [
                    "Distributor inventory",
                    "> 11 weeks",
                    "monthly survey"
                ]
            ])
        ]
    },
    "CP-2B:Cross-Module Handoff Register": {
        ref: "REF_CP-2B_08",
        out: "Handoff register",
        sections: [
            T("Handoffs", [
                "Output",
                "Consumer",
                "Use"
            ], [
                0,
                0,
                0
            ], [
                [
                    "P1 pathway",
                    "CP-3D",
                    "stress-coincidence scenario (vulnerability re-rate)"
                ],
                [
                    "Sensitivity grid",
                    "CP-3B",
                    "stressed-EBITDA axis of recovery table"
                ],
                [
                    "Pathway probabilities",
                    "CP-6A",
                    "bear-case weighting inputs"
                ]
            ])
        ]
    },
    "CP-2B:Gaps Ledger": {
        ref: "REF_CP-2B_09",
        out: "Gaps ledger",
        sections: [
            X("Ledger", "No module-specific gaps. Inherits the G-02 derived-period caveat on quarterly granularity only; annual stress arithmetic unaffected.")
        ]
    },
    "CP-2B:Overall Downside Pathway View": {
        ref: "REF_CP-2B_10",
        out: "Overall downside view",
        sections: [
            X("View", "No pathway breaks liquidity: P1 (worst) still leaves 14 months-to-empty and springing-covenant headroom. The danger is sequencing — P1 arriving while the 12-month MFN sunset is open invites a priming incremental at the bottom of the cycle. That interaction, not any single pathway, is what CP-6E prices via staged sizing.", [
                "E-77",
                "E-64"
            ])
        ]
    },
    /* ================= CP-2C · CatalystCalendar ================= */ "CP-2C:Source Gate & Calendar Scope": {
        ref: "REF_CP-2C_01",
        out: "Scope",
        sections: [
            T("Scope", [
                "Field",
                "Value"
            ], [
                0,
                0
            ], [
                [
                    "Window",
                    "12 months forward (Jun-26 → Jun-27)"
                ],
                [
                    "Event classes",
                    "issuer · sponsor · sector · documentation"
                ],
                [
                    "Sources",
                    "filing calendars, facility docs, fund communications, OEM schedules"
                ]
            ])
        ]
    },
    "CP-2C:Event Source Register": {
        ref: "REF_CP-2C_02",
        out: "Event source register",
        sections: [
            T("Sources", [
                "Source",
                "Events derived",
                "Anchor"
            ], [
                0,
                1,
                0
            ], [
                [
                    "Compliance calendar (D-02/D-03)",
                    "4",
                    "certificate due dates §5.01"
                ],
                [
                    "Earnings calendar",
                    "3",
                    "issuer IR schedule"
                ],
                [
                    "Kestrel fund communications",
                    "1",
                    "D-06 p.12 / LP letter"
                ],
                [
                    "Sector OEM reporting",
                    "1",
                    "Meridian platform schedule"
                ]
            ])
        ]
    },
    "CP-2C:Catalyst Calendar": {
        ref: "REF_CP-2C_03 · T5.2",
        out: "Catalyst calendar",
        sections: [
            T("Calendar (next 12 months)", [
                "Date",
                "Event",
                "Prob.",
                "Impact",
                "Route"
            ], [
                0,
                0,
                1,
                0,
                0
            ], [
                [
                    "Jul 28, 2026",
                    "Q2-26 earnings + first add-back realization print",
                    "100%",
                    "HIGH",
                    "CP-1B · CP-6A"
                ],
                [
                    "Sep 2026",
                    "RCF extension / repricing window opens",
                    "70%",
                    "MED",
                    "CP-3D"
                ],
                [
                    "Oct 2026",
                    "Q3-26 compliance certificate (add-back test)",
                    "100%",
                    "HIGH",
                    "CP-1 · T-1"
                ],
                [
                    "Q4 2026",
                    "Kestrel Fund V exit-window commentary",
                    "40%",
                    "MED",
                    "CP-2D"
                ],
                [
                    "Q2 2027",
                    "Meridian-platform contract repricing",
                    "100%",
                    "HIGH",
                    "CP-2B P1"
                ]
            ])
        ]
    },
    "CP-2C:Event Risk Register": {
        ref: "REF_CP-2C_04 · T5.3",
        out: "Event risk register",
        sections: [
            T("Risk register (9 events)", [
                "Event",
                "Direction",
                "Mechanism"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Q3-26 certificate",
                    "two-sided",
                    "proves / disproves deleveraging math"
                ],
                [
                    "Meridian repricing",
                    "negative skew",
                    "~14% of revenue repriced at once"
                ],
                [
                    "MFN sunset (Jun-27)",
                    "negative",
                    "removes yield protection — capacity becomes free"
                ],
                [
                    "RCF extension",
                    "modest negative",
                    "+25–50bps cost; failure would be a red flag"
                ],
                [
                    "Kestrel exit posture",
                    "two-sided",
                    "IPO path positive; recap path negative"
                ]
            ])
        ]
    },
    "CP-2C:Probability-Impact Matrix": {
        ref: "REF_CP-2C_05 · T5.4",
        out: "Probability-impact matrix",
        sections: [
            T("Matrix", [
                "Quadrant",
                "Events"
            ], [
                0,
                0
            ], [
                [
                    "High prob · high impact",
                    "Q3-26 certificate · Meridian repricing · Q2-26 print"
                ],
                [
                    "High prob · med impact",
                    "RCF extension window · MFN sunset approach"
                ],
                [
                    "Low prob · high impact",
                    "Kestrel recap activation (T-4)"
                ],
                [
                    "Low prob · med impact",
                    "exit-window commentary"
                ]
            ])
        ]
    },
    "CP-2C:Monitoring Priority Table": {
        ref: "REF_CP-2C_06 · T5.5",
        out: "Priority table",
        sections: [
            T("Priorities", [
                "Rank",
                "Item",
                "Cadence"
            ], [
                0,
                0,
                0
            ], [
                [
                    "1",
                    "Certificate prints (add-back test)",
                    "quarterly — hard dates"
                ],
                [
                    "2",
                    "OEM order data / destocking signals",
                    "monthly"
                ],
                [
                    "3",
                    "RP-basket and incremental notices",
                    "event-driven"
                ]
            ])
        ]
    },
    "CP-2C:Watchlist Handoff Register": {
        ref: "REF_CP-2C_07 · T5.6",
        out: "Handoff register",
        sections: [
            T("Handoffs", [
                "Trigger",
                "Consumer",
                "Action"
            ], [
                0,
                0,
                0
            ], [
                [
                    "T-1 certificate miss",
                    "CP-6A",
                    "forced re-vote"
                ],
                [
                    "Meridian terms",
                    "CP-2B",
                    "P1 refresh with actual pricing"
                ],
                [
                    "Kestrel exit signals",
                    "CP-2D",
                    "posture review"
                ]
            ])
        ]
    },
    "CP-2C:Gaps & Limitations Ledger": {
        ref: "REF_CP-2C_08 · T5.7",
        out: "Gaps ledger",
        sections: [
            X("Ledger", "Probabilities stated without basis were re-labeled [Analyst estimate] following QA-121 — resolved in-run. No open items.")
        ]
    },
    "CP-2C:Overall Catalyst View": {
        ref: "REF_CP-2C_09",
        out: "Overall catalyst view",
        sections: [
            X("View", "Event risk front-loads into H2-26 reporting. The Q3-26 certificate is the thesis-defining print — wired to trigger T-1 and a CP-6A re-vote if add-back realization lands under $30M. Every calendar entry routes to a named module action rather than passive watching.")
        ]
    },
    /* ================= CP-2D · Sponsor & Governance ================= */ "CP-2D:Source Register & Readiness": {
        ref: "REF_CP-2D_01",
        out: "Gate decision",
        sections: [
            T("Sources", [
                "Source",
                "Use",
                "Handling"
            ], [
                0,
                0,
                0
            ], [
                [
                    "CP-1A ownership register",
                    "control structure",
                    "—"
                ],
                [
                    "D-06 lender presentation",
                    "sponsor overview, fund detail",
                    "MNPI — walled"
                ],
                [
                    "Kestrel fund communications",
                    "Fund VI close, portfolio record",
                    "public + LP letter"
                ]
            ]),
            X("Status", "READY — all governance-relevant sources admitted.")
        ]
    },
    "CP-2D:Ownership & Control Register": {
        ref: "REF_CP-2D_02",
        out: "Control register",
        sections: [
            T("Control", [
                "Holder",
                "Stake",
                "Rights"
            ], [
                0,
                1,
                0
            ], [
                [
                    "Kestrel Fund V",
                    "68.4%",
                    "drag, 6/7 board seats, exit control"
                ],
                [
                    "Co-invest vehicles",
                    "22.4%",
                    "passive — Kestrel-managed"
                ],
                [
                    "Management rollover",
                    "9.2%",
                    "tag rights only"
                ]
            ])
        ]
    },
    "CP-2D:Governance Register": {
        ref: "REF_CP-2D_03",
        out: "Governance register",
        sections: [
            T("Governance", [
                "Dimension",
                "Finding"
            ], [
                0,
                0
            ], [
                [
                    "Board independence",
                    "1 of 7 — single independent chairs audit committee"
                ],
                [
                    "Reporting cadence",
                    "monthly lender packages + quarterly calls — above market"
                ],
                [
                    "Auditor",
                    "Big-4, unqualified, no disagreements disclosed"
                ],
                [
                    "Related-party items",
                    "sponsor management fee $7.3M/yr (add-back line)"
                ]
            ])
        ]
    },
    "CP-2D:Behavior Flag Register": {
        ref: "REF_CP-2D_04",
        out: "Behavior flags",
        sections: [
            F("Flags", [
                {
                    sev: "warning",
                    text: "Dividend-recap history: two Fund IV portfolio companies executed recaps within 24 months of a refinancing window — pattern, not anecdote."
                },
                {
                    sev: "warning",
                    text: "RP basket pre-positioning: builder already $240M with no stated use (credit agreement §4.07 + certificate) — capacity built before need."
                },
                {
                    sev: "low",
                    text: "Fund VI close $4.2B (Jun-26) — support-capacity positive offset; industrials 38% of deployment.",
                    ev: [
                        "E-91"
                    ]
                }
            ])
        ]
    },
    "CP-2D:Capital Allocation Risk Table": {
        ref: "REF_CP-2D_05",
        out: "Capital allocation assessment",
        sections: [
            T("Allocation record", [
                "Action",
                "Evidence",
                "Read"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Bolt-on M&A",
                    "Hartwell at 6.4x vs 7.9x platform entry",
                    "disciplined — accretive"
                ],
                [
                    "Dividends to date",
                    "none at ATLF since 2021 close",
                    "neutral"
                ],
                [
                    "Releveraging events",
                    "4 capital-structure events in 4.5 yrs at flat net debt",
                    "manages to a leverage ceiling"
                ],
                [
                    "Peer-portfolio recaps",
                    "2 of 2 Fund IV exits preceded by recap",
                    "extraction pattern"
                ]
            ])
        ]
    },
    "CP-2D:Acquisition Appetite Table": {
        ref: "REF_CP-2D_06",
        out: "Acquisition appetite",
        sections: [
            T("Appetite", [
                "Factor",
                "Read"
            ], [
                0,
                0
            ], [
                [
                    "Fund VI dry powder",
                    "$4.2B fresh, industrials-focused — HIGH appetite"
                ],
                [
                    "Platform posture",
                    "stated bolt-on strategy in LP"
                ],
                [
                    "Funding path",
                    "existing baskets sufficient for ≤$300M deals (CP-4C)"
                ],
                [
                    "Integration record",
                    "Hartwell integrated on plan — execution competent"
                ]
            ])
        ]
    },
    "CP-2D:Disclosure Quality Log": {
        ref: "REF_CP-2D_07",
        out: "Disclosure quality",
        sections: [
            X("Grade B+", "Monthly lender packages, quarterly calls, covenant detail above market norm. Deductions: sponsor-model optimism (−4.2% Q1 variance), selective KPI presentation in the LP, and the capex-split nondisclosure. Disclosure is institutional-grade and partially offsets policy risk.")
        ]
    },
    "CP-2D:Creditor Alignment Table": {
        ref: "REF_CP-2D_08",
        out: "Creditor alignment",
        sections: [
            T("Alignment", [
                "Horizon",
                "Sponsor incentive",
                "Creditor alignment"
            ], [
                0,
                0,
                0
            ], [
                [
                    "0–18 months",
                    "grow EBITDA, prove deleveraging for exit story",
                    "ALIGNED"
                ],
                [
                    "2027–28 (exit window)",
                    "maximize equity value — recap or sale",
                    "DIVERGENT — extraction risk"
                ],
                [
                    "Distress scenario",
                    "preserve option value — LME-capable docs",
                    "ADVERSE — 2L is target class"
                ]
            ])
        ]
    },
    "CP-2D:Sponsor Risk Assessment": {
        ref: "REF_CP-2D_09",
        out: "Composite assessment",
        sections: [
            X("Assessment", "MODERATE-HIGH. Kestrel is a competent operator (Hartwell integration, institutional reporting) with an extractive financial-policy record (recap pattern, RP pre-positioning). The risk is behavioral and documentation-enabled, not operational — which makes it monitorable: basket activation and certificate behavior are observable tells.")
        ]
    },
    "CP-2D:Cross-Module Handoff Register": {
        ref: "REF_CP-2D_10",
        out: "Handoff register",
        sections: [
            T("Handoffs", [
                "Output",
                "Consumer"
            ], [
                0,
                0
            ], [
                [
                    "RP-activation trigger (T-4)",
                    "CP-2 · CP-6E"
                ],
                [
                    "Fund VI support capacity",
                    "CP-3D sponsor-willingness table"
                ],
                [
                    "Recap pattern evidence",
                    "CP-6A bear file"
                ]
            ])
        ]
    },
    "CP-2D:Gaps Ledger": {
        ref: "REF_CP-2D_11",
        out: "Gaps ledger",
        sections: [
            X("Ledger", "No gaps. LP-letter detail on Fund VI deployment pace noted as desirable but non-blocking.")
        ]
    },
    "CP-2D:Overall Governance View": {
        ref: "REF_CP-2D_12",
        out: "Overall governance view",
        sections: [
            X("View", "Kestrel is a competent operator with an extractive financial-policy record; institutional-grade disclosure partially offsets. Treat any RP-basket activation as a posture-changing event (T-4). Alignment is good near-term and divergent precisely in the 2027–28 window where documentation capacity peaks (post-MFN-sunset).", [
                "E-91"
            ])
        ]
    },
    /* ================= CP-2E · Liquidity ================= */ "CP-2E:Source Register & Module Status": {
        ref: "REF_CP-2E_01",
        out: "Gate decision",
        sections: [
            T("Sources", [
                "Source",
                "Use"
            ], [
                0,
                0
            ], [
                [
                    "D-04 p.44 liquidity disclosure",
                    "cash + RCF availability"
                ],
                [
                    "D-02 SFA schedules",
                    "commitments, LC carve-out, springing test"
                ],
                [
                    "CP-1 cash flow build",
                    "12-month forward FCF"
                ]
            ]),
            X("Status", "READY — no limitations.", [
                "E-77"
            ])
        ]
    },
    "CP-2E:Beginning Liquidity Register": {
        ref: "REF_CP-2E_02",
        out: "Beginning liquidity",
        sections: [
            T("Beginning liquidity (Apr-26, $M)", [
                "Component",
                "Amount",
                "Accessibility"
            ], [
                0,
                1,
                0
            ], [
                [
                    "Cash & equivalents",
                    "184",
                    "fully accessible — no trapped-cash findings"
                ],
                [
                    "RCF commitment",
                    "250",
                    "—"
                ],
                [
                    "Drawn",
                    "(120)",
                    "—"
                ],
                [
                    "Letters of credit",
                    "(12)",
                    "carve-out"
                ],
                [
                    "RCF available",
                    "195",
                    "conditions precedent verified — no draw-stoppers"
                ],
                [
                    "Total accessible",
                    "379",
                    ""
                ]
            ])
        ]
    },
    "CP-2E:Mandatory Cash Uses Register": {
        ref: "REF_CP-2E_03",
        out: "Mandatory uses",
        sections: [
            T("Mandatory uses — 12 months ($M)", [
                "Use",
                "Amount",
                "Timing"
            ], [
                0,
                1,
                0
            ], [
                [
                    "Cash interest",
                    "(196)",
                    "quarterly floating — 1L TLB + 2L TL"
                ],
                [
                    "TLB amortization (1%)",
                    "(18)",
                    "quarterly"
                ],
                [
                    "Hartwell earnout",
                    "(24)",
                    "H2-26"
                ],
                [
                    "Maturities",
                    "—",
                    "none inside 24 months"
                ]
            ])
        ]
    },
    "CP-2E:WC & Capex Pressure Table": {
        ref: "REF_CP-2E_04",
        out: "WC / capex pressure",
        sections: [
            T("Pressure items ($M)", [
                "Item",
                "Amount",
                "Note"
            ], [
                0,
                1,
                0
            ], [
                [
                    "Working-capital trough (Q3 seasonal)",
                    "(43)",
                    "recovers Q4 — pattern stable 4 years"
                ],
                [
                    "Capex (12mo fwd)",
                    "(121)",
                    "≈ $25M deferrable in stress"
                ]
            ])
        ]
    },
    "CP-2E:12-Month Liquidity Bridge": {
        ref: "REF_CP-2E_05",
        out: "Liquidity bridge",
        sections: [
            T("Bridge ($M)", [
                "",
                "Amount"
            ], [
                0,
                1
            ], [
                [
                    "Beginning cash (Apr-26)",
                    "184"
                ],
                [
                    "RCF availability (undrawn, net LCs)",
                    "195"
                ],
                [
                    "FCF before debt service (12mo fwd)",
                    "+178"
                ],
                [
                    "Cash interest",
                    "(196)"
                ],
                [
                    "Mandatory amortization (TLB 1%)",
                    "(18)"
                ],
                [
                    "Bolt-on / earnout commitments",
                    "(24)"
                ],
                [
                    "Working capital & seasonality trough",
                    "(43)"
                ],
                [
                    "Ending liquidity (12mo)",
                    "276"
                ]
            ]),
            X("Net", "Bridge nets +$96M over 12 months from $379M beginning accessible liquidity.", [
                "E-77"
            ])
        ]
    },
    "CP-2E:Months to Empty Result": {
        ref: "REF_CP-2E_06",
        out: "Months-to-empty",
        sections: [
            T("Months-to-empty", [
                "Case",
                "MTE",
                "Basis"
            ], [
                0,
                1,
                0
            ], [
                [
                    "Base",
                    "19.3 mo",
                    "CP-1 forward FCF, full RCF access"
                ],
                [
                    "CP-2B P1 stress",
                    "14.0 mo",
                    "EBITDA −18%, WC drag, springing test untested"
                ],
                [
                    "P1 + RCF unavailable (theoretical)",
                    "9.1 mo",
                    "cash-only — not a modeled scenario"
                ]
            ]),
            X("Rule note", "Calculated only because both inputs (burn rate, accessible liquidity) are source-supported, per module calculation rules.", [
                "E-77"
            ])
        ]
    },
    "CP-2E:Mitigants & Constraints Table": {
        ref: "REF_CP-2E_07",
        out: "Mitigants / constraints",
        sections: [
            T("Mitigants & constraints", [
                "Type",
                "Item",
                "Value"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Mitigant",
                    "Capex deferability",
                    "≈ $25M"
                ],
                [
                    "Mitigant",
                    "Receivables facility option (uncommitted)",
                    "≈ $60M est."
                ],
                [
                    "Constraint",
                    "Springing 1L leverage test",
                    "trips above 40% RCF utilization (now 22%)"
                ],
                [
                    "Constraint",
                    "LC carve-out",
                    "$12.4M of RCF"
                ]
            ])
        ]
    },
    "CP-2E:Liquidity Risk Level + Narrative": {
        ref: "REF_CP-2E_08",
        out: "Risk level",
        sections: [
            X("ADEQUATE", "Strong headline liquidity with the springing covenant comfortably untested. The only path to pressure runs through P1-scale EBITDA stress sustained for 3+ quarters — and even there, months-to-empty stays in double digits. Liquidity is not the binding risk in this credit; documentation is.")
        ]
    },
    "CP-2E:Gaps Ledger": {
        ref: "REF_CP-2E_09",
        out: "Gaps ledger",
        sections: [
            X("Ledger", "No gaps. Intercompany cash-pooling detail at the MX subsidiary noted as a minor opacity — non-material (MX is <4% of group cash).")
        ]
    },
    "CP-2E:Overall Liquidity View": {
        ref: "REF_CP-2E_10",
        out: "Overall liquidity view",
        sections: [
            X("View", "Liquidity is a strength: 19.3 months-to-empty under base, 14.0 under the CP-2B P1 stress. No maturity inside 24 months; springing covenant tests only above 40% RCF utilization (currently 22%).", [
                "E-77"
            ])
        ]
    },
    /* ================= CP-2F · Macro & Hedging ================= */ "CP-2F:Source Register & Module Status": {
        ref: "REF_CP-2F_01",
        out: "Gate decision",
        sections: [
            F("Status", [
                {
                    sev: "warning",
                    text: "READY WITH LIMITATIONS — hedging register / swap confirms not provided (G-01). Module executes in degraded mode; every output object stamped L-04. Floating exposure modeled from SFA margins only."
                }
            ])
        ]
    },
    "CP-2F:Debt & Rate Exposure Register": {
        ref: "REF_CP-2F_02",
        out: "Rate exposure register",
        sections: [
            T("Exposure register", [
                "Instrument",
                "Balance ($M)",
                "Basis",
                "Modeled hedge"
            ], [
                0,
                1,
                0,
                0
            ], [
                [
                    "RCF (drawn)",
                    "120",
                    "SOFR + 350",
                    "none"
                ],
                [
                    "Term Loan B",
                    "1,850",
                    "SOFR + 375",
                    "unknown — register missing"
                ],
                [
                    "2L TL '31",
                    "900",
                    "S+425 (floating)",
                    "n/a"
                ],
                [
                    "Sub Notes '32",
                    "400",
                    "Fixed 10.00%",
                    "n/a"
                ]
            ]),
            X("Summary", "61% floating share before any undisclosed hedges — flagged with (*) wherever quoted.")
        ]
    },
    "CP-2F:Hedging Register": {
        ref: "REF_CP-2F_03",
        out: "Hedging register",
        sections: [
            T("Hedging register", [
                "Instrument",
                "Notional",
                "Rate",
                "Maturity"
            ], [
                0,
                1,
                1,
                0
            ], [
                [
                    "[Insufficient Information]",
                    "—",
                    "—",
                    "—"
                ]
            ]),
            X("Disposition", "Not producible: swap confirmations and the hedging policy were not provided (gap G-01). Per prohibited-behavior rules the register is marked [Insufficient Information] rather than assumed — no synthetic hedge book is constructed. Re-requested Jun 04.")
        ]
    },
    "CP-2F:Unhedged Floating Exposure": {
        ref: "REF_CP-2F_04",
        out: "Unhedged exposure (upper bound)",
        sections: [
            T("Unhedged floating exposure*", [
                "Measure",
                "Value"
            ], [
                0,
                1
            ], [
                [
                    "Floating-rate debt",
                    "$1,970M"
                ],
                [
                    "Share of gross debt",
                    "61%"
                ],
                [
                    "Treatment",
                    "fully unhedged (upper bound) — L-04"
                ]
            ])
        ]
    },
    "CP-2F:+100bps Rate Sensitivity": {
        ref: "REF_CP-2F_05",
        out: "Rate sensitivity",
        sections: [
            T("Base-rate sensitivity (annualized)", [
                "Shift",
                "Interest Δ",
                "FCF impact",
                "Coverage"
            ], [
                0,
                1,
                1,
                1
            ], [
                [
                    "+50bps",
                    "+$9.9M",
                    "−$6.1M",
                    "2.05x"
                ],
                [
                    "+100bps",
                    "+$19.7M",
                    "−$12.1M",
                    "2.0x"
                ],
                [
                    "+200bps",
                    "+$39.4M",
                    "−$24.2M",
                    "1.9x"
                ]
            ]),
            X("Bound note", "Figures are upper bounds on the fully-unhedged assumption — any undisclosed hedges reduce them. −$12.1M at +100bps equals 7% of LTM FCF.")
        ]
    },
    "CP-2F:FX Exposure Register": {
        ref: "REF_CP-2F_06",
        out: "FX register",
        sections: [
            T("FX exposure", [
                "Pair",
                "Revenue",
                "Cost",
                "Net"
            ], [
                0,
                1,
                1,
                0
            ], [
                [
                    "USD (functional)",
                    "84%",
                    "81%",
                    "—"
                ],
                [
                    "EUR (4 plants)",
                    "12%",
                    "13%",
                    "naturally hedged"
                ],
                [
                    "MXN (1 plant)",
                    "4%",
                    "6%",
                    "translation-only, minor"
                ]
            ]),
            X("Read", "FX risk LOW — no debt-currency mismatch (all USD), no material transactional gap.")
        ]
    },
    "CP-2F:Commodity & Inflation Table": {
        ref: "REF_CP-2F_07",
        out: "Commodity / inflation sensitivity",
        sections: [
            T("Commodity exposure", [
                "Input",
                "COGS share",
                "Mechanism",
                "Net exposure"
            ], [
                0,
                1,
                0,
                0
            ], [
                [
                    "Steel / alloys",
                    "71%",
                    "indexed pass-through, 60–90d lag",
                    "timing only"
                ],
                [
                    "Energy",
                    "6%",
                    "partially contracted",
                    "minor"
                ],
                [
                    "Freight",
                    "5%",
                    "spot + contract mix",
                    "minor"
                ]
            ]),
            X("Read", "Inflation is a timing exposure, not a level exposure — quantified at −4% EBITDA for 2 quarters under a +20% alloy spike (CP-2B P3).", [
                "E-31"
            ])
        ]
    },
    "CP-2F:Macro Sensitivity Summary": {
        ref: "REF_CP-2F_08",
        out: "Macro summary",
        sections: [
            T("Channel ranking", [
                "Channel",
                "Severity",
                "Status"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Base rates (61% floating*)",
                    "DOMINANT — −$12.1M / +100bps",
                    "L-04 upper bound"
                ],
                [
                    "Commodity (lagged pass-through)",
                    "SECOND-ORDER",
                    "modeled, recovers"
                ],
                [
                    "FX",
                    "MINOR",
                    "naturally hedged"
                ]
            ])
        ]
    },
    "CP-2F:Gaps Ledger": {
        ref: "REF_CP-2F_09",
        out: "Gaps ledger",
        sections: [
            X("Ledger", "G-01 open — swap confirms re-requested Jun 04, no response at run time. Resolution re-rates the sensitivity table and lifts L-04 from CP-6A's macro weighting.")
        ]
    },
    "CP-2F:Overall Macro / Hedging View": {
        ref: "REF_CP-2F_10",
        out: "Overall macro view",
        sections: [
            X("View", "Rate sensitivity is the dominant macro channel — real but bounded above by the unhedged assumption. The credit is structurally insulated on commodities (pass-through) and FX (natural hedge). The view carries the L-04 caveat until G-01 resolves; a confirmed hedge book covering ≥50% of the TLB would move the macro assessment from WATCH to NEUTRAL.")
        ]
    }
};
// ── from step-outputs-l3.js ──
const O2 = {
    /* ================= CP-3 · RelativeValue ================= */ "CP-3:Source Register + Execution Mode": {
        ref: "REF_CP-3_01 · T3.1",
        out: "Gate + execution mode",
        sections: [
            T("Sources", [
                "Input",
                "Status"
            ], [
                0,
                0
            ], [
                [
                    "CP-1C benchmarks (ex-E-44 basis)",
                    "GREEN — limitation carried"
                ],
                [
                    "CP-2 credit view (B2 / STABLE)",
                    "GREEN"
                ],
                [
                    "MKT — LoanX marks + dealer runs (Jun 8)",
                    "GREEN"
                ]
            ]),
            X("Mode", "Full-stack execution — fundamental scorecard, fair-value band and final ranking all produced.", [
                "E-71"
            ])
        ]
    },
    "CP-3:Fundamental Credit Summary": {
        ref: "REF_CP-3_02",
        out: "Fundamental summary",
        sections: [
            X("Summary", "Mid-B2 with positive trajectory: genuine FCF (41% conversion), credible deleveraging to ~4.9x FY27 on realized add-backs, liquidity a strength. Standing deductions: EBITDA quality (18.2% add-backs), top-3 OEM concentration, and the documentation overhang quantified by CP-4C. The credit improves on proof — the Q3-26 certificate is the catalyst that converts presentation into fact.")
        ]
    },
    "CP-3:Issuer / Security Scorecard": {
        ref: "REF_CP-3_03 · T3.3",
        out: "Scorecard — 71/100",
        sections: [
            T("Scorecard", [
                "Component",
                "Score",
                "Basis"
            ], [
                0,
                1,
                0
            ], [
                [
                    "Cash flow quality",
                    "17 / 20",
                    "41% conversion, low WC drag"
                ],
                [
                    "Business durability",
                    "15 / 20",
                    "aftermarket annuity vs OEM concentration"
                ],
                [
                    "Leverage & coverage",
                    "12 / 20",
                    "5.7x / 2.1x — mid-single-B"
                ],
                [
                    "Liquidity",
                    "13 / 15",
                    "19.3 MTE, no near wall"
                ],
                [
                    "Documentation",
                    "9 / 15",
                    "7.2/10 aggressiveness, MFN sunset"
                ],
                [
                    "Sponsor / governance",
                    "5 / 10",
                    "recap record, RP pre-positioning"
                ],
                [
                    "Composite",
                    "71 / 100",
                    "actionable band: ≥ 65"
                ]
            ])
        ]
    },
    "CP-3:Override Review": {
        ref: "REF_CP-3_04 · T3.4",
        out: "Override register",
        sections: [
            X("Register", "Empty — no analyst overrides applied to model scores. The scorecard output is carried as computed. (Override policy: any manual adjustment requires a written basis and CP-5 notification; none invoked this run.)")
        ]
    },
    "CP-3:Relative Value Table": {
        ref: "REF_CP-3_05 · T3.5",
        out: "Relative value table",
        sections: [
            T("RV table", [
                "Instrument",
                "DM",
                "Fair band",
                "Excess",
                "Rank"
            ], [
                0,
                1,
                1,
                1,
                1
            ], [
                [
                    "ATLF 2L TL '31 (subject)",
                    "+388",
                    "+325–340",
                    "+48–63",
                    "2"
                ],
                [
                    "Veldt Precision TLB '30",
                    "+291",
                    "+285–300",
                    "−9–+6",
                    "5"
                ],
                [
                    "Ironvale TLB '29",
                    "+327",
                    "+310–325",
                    "+2–17",
                    "4"
                ],
                [
                    "Forgeline TLB '30",
                    "+352",
                    "+330–345",
                    "+7–22",
                    "3"
                ],
                [
                    "Karst TLB '29",
                    "+459",
                    "+470–495",
                    "−36–−11",
                    "6"
                ],
                [
                    "Cascadia 2L TL '30",
                    "+341",
                    "+280–300",
                    "+41–61",
                    "1*"
                ]
            ]),
            X("Band note", "The fair band leans on E-44; the ex-E-44 construction (sector beta regression) still shows +20–25bps cheap. Both bands carried until QA-117 resolves.", [
                "E-71",
                "E-44"
            ])
        ]
    },
    "CP-3:Fundamental Value Matrix": {
        ref: "REF_CP-3_06 · T3.6",
        out: "Value matrix",
        sections: [
            T("Matrix — fundamentals × valuation", [
                "Quadrant",
                "Names"
            ], [
                0,
                0
            ], [
                [
                    "Cheap / improving",
                    "ATLF (subject) · Cascadia*"
                ],
                [
                    "Cheap / deteriorating",
                    "Karst"
                ],
                [
                    "Fair / stable",
                    "Ironvale · Forgeline"
                ],
                [
                    "Rich / strong",
                    "Veldt"
                ]
            ]),
            X("Note", "* Cascadia plots cheaper only on a recovery adjustment (thinner collateral coverage) the IC has historically discounted; on a like-for-like recovery basis the subject is the cheapest improving credit in the set.")
        ]
    },
    "CP-3:Final Ranking": {
        ref: "REF_CP-3_07 · T3.7",
        out: "Final ranking",
        sections: [
            T("Final ranking", [
                "Rank",
                "Name",
                "Basis"
            ], [
                1,
                0,
                0
            ], [
                [
                    "1*",
                    "Cascadia 2L TL '30",
                    "recovery-adjusted — discounted by IC"
                ],
                [
                    "2",
                    "ATLF 2L TL (subject)",
                    "carry + deleveraging, monitorable risks"
                ],
                [
                    "3",
                    "Forgeline TLB '30",
                    "fair-to-cheap, lower beta"
                ],
                [
                    "4",
                    "Ironvale TLB '29",
                    "fair"
                ],
                [
                    "5",
                    "Veldt Precision TLB '30",
                    "rich — quality priced"
                ],
                [
                    "6",
                    "Karst TLB '29",
                    "cheap for a reason — deteriorating"
                ]
            ]),
            X("Robustness", "Dropping the contested E-44 margin set moves the subject from 2 to 3 of 7 — still inside the actionable band.")
        ]
    },
    "CP-3:Security Selection Conclusions": {
        ref: "REF_CP-3_08",
        out: "Selection conclusions",
        sections: [
            X("Conclusions", "Within the ATLF structure, the 2L TL is the expression: +210bps of spread pickup over the TLB for an acceptable recovery delta at the 6.0x stress point (CP-3B). Sub notes rejected on priming exposure and thin covenant protection. Hold-to-maturity math clears the hurdle at +388 even with zero spread tightening — conviction is carry plus deleveraging, not convergence.")
        ]
    },
    "CP-3:Monitoring Triggers": {
        ref: "REF_CP-3_09 · T3.9",
        out: "RV triggers",
        sections: [
            T("Triggers", [
                "Trigger",
                "Threshold",
                "Action"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Spread tightening",
                    "through +300",
                    "exit — thesis complete"
                ],
                [
                    "Peer-set rating migration",
                    "any notch move",
                    "re-rank universe"
                ],
                [
                    "Mark refresh",
                    "weekly",
                    "desk runs + LoanX"
                ]
            ])
        ]
    },
    "CP-3:Gaps Ledger": {
        ref: "REF_CP-3_10",
        out: "Gaps ledger",
        sections: [
            X("Ledger", "E-44 dependency carried as the single limitation; both fair-value bands (with and ex-E-44) published side by side wherever the band is quoted.")
        ]
    },
    "CP-3:Final Credit / RV View": {
        ref: "REF_CP-3_11",
        out: "Final view",
        sections: [
            X("View", "Rank 2 of 7. The position pays +48–63bps over model (+20–25 ex-E-44) for risks that are monitorable rather than structural. Conviction is carry plus deleveraging; the Q3-26 certificate is the proof point that would close the band.", [
                "E-71"
            ])
        ]
    },
    /* ================= CP-3B · InstrumentSelection / Recovery ================= */ "CP-3B:Instrument Data Gate": {
        ref: "REF_CP-3B · T3B.1",
        out: "Gate decision",
        sections: [
            T("Instrument verification", [
                "Instrument",
                "Terms verified vs",
                "Status"
            ], [
                0,
                0,
                0
            ], [
                [
                    "RCF $250M · TLB $1,850M",
                    "D-02 SFA schedules",
                    "VERIFIED"
                ],
                [
                    "2L TL $900M S+425 '31",
                    "D-03 credit agreement",
                    "VERIFIED"
                ],
                [
                    "Sub Notes $400M 10.00% '32",
                    "D-03 + CIM description",
                    "VERIFIED"
                ]
            ]),
            X("Tie-out", "Claims totals tie to CP-1 net debt within rounding. Gate PASS.")
        ]
    },
    "CP-3B:Capital Structure Dashboard": {
        ref: "REF_CP-3B · T3B.2",
        out: "Capital structure dashboard",
        sections: [
            T("Capital structure ($M)", [
                "Class",
                "Rate",
                "Amount",
                "Leverage through"
            ], [
                0,
                0,
                1,
                1
            ], [
                [
                    "RCF (drawn)",
                    "S+350",
                    "120",
                    "—"
                ],
                [
                    "Term Loan B (1L)",
                    "S+375",
                    "1,850",
                    "4.68x (secured)"
                ],
                [
                    "2L TL '31 (subject)",
                    "S+425",
                    "900",
                    "5.7x"
                ],
                [
                    "Sub Notes '32",
                    "10.00%",
                    "400",
                    "6.6x"
                ],
                [
                    "Total debt",
                    "",
                    "3,270",
                    "6.6x gross · 5.68x net (adj.)"
                ]
            ])
        ]
    },
    "CP-3B:Instrument Matrix": {
        ref: "REF_CP-3B · T3B.3",
        out: "Instrument matrix",
        sections: [
            T("Matrix", [
                "Dimension",
                "TLB (1L)",
                "2L TL",
                "Subs"
            ], [
                0,
                0,
                0,
                0
            ], [
                [
                    "Spread / yield",
                    "S+375 (~+340)",
                    "+388",
                    "+545"
                ],
                [
                    "Recovery @ 6.0x stress",
                    "100%",
                    "21%",
                    "0%"
                ],
                [
                    "Covenant protection",
                    "springing only",
                    "full package",
                    "thin"
                ],
                [
                    "Liquidity (trading)",
                    "good",
                    "good — $4.2M avg print",
                    "poor"
                ],
                [
                    "Spread per risk unit",
                    "baseline",
                    "BEST",
                    "worst"
                ]
            ])
        ]
    },
    "CP-3B:Structural Positioning Log": {
        ref: "REF_CP-3B · T3B.4",
        out: "Positioning log",
        sections: [
            X("Positioning", "The 2L TL sits behind $1,970M of 1L claims with full guarantor coverage (87% of EBITDA) and second-lien collateral on substantially all assets — and structurally ahead of a $400M sub-notes cushion. Non-guarantor leakage is limited to the MX subsidiary (<4% of EBITDA). The position is conventional; the risk is documentary (priming), not structural.")
        ]
    },
    "CP-3B:Legal / Covenant / LME Overlay": {
        ref: "REF_CP-3B · T3B.5",
        out: "LME overlay",
        sections: [
            F("Overlay findings", [
                {
                    sev: "warning",
                    text: "Priming exposure: $612M of day-one incremental capacity is incurrable pari or senior to the 2L (CP-4C). MFN protects pari raises only and sunsets Jun-27 — recovery assumptions degrade if capacity is used.",
                    ev: [
                        "E-63",
                        "E-64"
                    ]
                },
                {
                    sev: "ok",
                    text: "No J.Crew / Chewy paths: no unrestricted-sub transfer basket, no automatic guarantee release — asset-stripping LME variants are blocked."
                }
            ]),
            X("Treatment", "LME risk is priced via the preference decision and CP-6E sizing, not excluded. A primed waterfall variant (+$400M 1L) cuts the 6.0x-stress 2L recovery from 21% to ~8% — the quantified cost of the open capacity.")
        ]
    },
    "CP-3B:Recovery Sensitivity Table": {
        ref: "REF_CP-3B · T3B.6",
        out: "Recovery sensitivity grid",
        sections: [
            T("2L recovery — exit multiple × stressed EBITDA (% of par)", [
                "EBITDA",
                "5.0x",
                "5.5x",
                "6.0x",
                "6.5x",
                "7.0x",
                "7.5x"
            ], [
                0,
                1,
                1,
                1,
                1,
                1,
                1
            ], [
                [
                    "$421M (LTM adj.)",
                    "16",
                    "40",
                    "63",
                    "86",
                    "100",
                    "100"
                ],
                [
                    "$360M (base stress)",
                    "0",
                    "9",
                    "29",
                    "49",
                    "69",
                    "89"
                ],
                [
                    "$295M (severe)",
                    "0",
                    "0",
                    "0",
                    "13",
                    "30",
                    "46"
                ]
            ]),
            X("Cliff", "The cliff sits below 5.5x on stressed EBITDA, where 1L claims ($1,970M) consume the estate before the 2L attaches. Scenario anchors: base distress 5.5x × $360M → 2L 22%; severe 5.0x × $295M → 0%.")
        ]
    },
    "CP-3B:Compensation Cross-Check": {
        ref: "REF_CP-3B · T3B.7",
        out: "Compensation cross-check",
        sections: [
            T("Cross-check", [
                "Input",
                "Value"
            ], [
                0,
                1
            ], [
                [
                    "Probability-weighted LGD (base-distress weights)",
                    "~62% of par"
                ],
                [
                    "Annual default probability (B2 cohort)",
                    "~2.4%"
                ],
                [
                    "Required spread for LGD",
                    "~248bps"
                ],
                [
                    "Actual DM",
                    "+388bps"
                ],
                [
                    "Excess compensation",
                    "~140bps"
                ]
            ]),
            X("Result", "PASS — at +388 the 2L compensates modeled loss-given-default with ~140bps of excess spread. Market-implied 2L recovery at px 96.4 ≈ 38% — wide of model in severe only.")
        ]
    },
    "CP-3B:Preference Decision Table": {
        ref: "REF_CP-3B · T3B.8",
        out: "Preference decision",
        sections: [
            T("Decision", [
                "Criterion",
                "TLB",
                "2L TL",
                "Subs"
            ], [
                0,
                0,
                0,
                0
            ], [
                [
                    "Spread pickup vs 1L",
                    "—",
                    "+210bps",
                    "+370bps"
                ],
                [
                    "Recovery delta @ 6.0x",
                    "—",
                    "−79pp",
                    "−100pp"
                ],
                [
                    "Covenant package",
                    "springing only",
                    "full",
                    "thin"
                ],
                [
                    "Priming exposure",
                    "protected (1L)",
                    "accepted — priced",
                    "unprotected"
                ],
                [
                    "Verdict",
                    "defensive option",
                    "SELECTED",
                    "rejected"
                ]
            ])
        ]
    },
    "CP-3B:Ranking & Trade-Off Summary": {
        ref: "REF_CP-3B",
        out: "Trade-off summary",
        sections: [
            X("Summary", "2L TL > TLB > Subs. The 2L's recovery cliff below 5.5x stressed is the accepted risk, paid for by +210bps over the TLB. The subs' extra +160bps does not compensate first-loss positioning plus priming exposure with no MFN protection — rejected. TLB retained as the defensive rotation if T-2 (incremental raise) trips.")
        ]
    },
    "CP-3B:Monitoring Triggers": {
        ref: "REF_CP-3B · T3B.10",
        out: "Instrument triggers",
        sections: [
            T("Triggers", [
                "Trigger",
                "Signal",
                "Action"
            ], [
                0,
                0,
                0
            ], [
                [
                    "1L incremental raise",
                    "facility notice / LoanX",
                    "re-run waterfall, re-test preference"
                ],
                [
                    "Sub notes repurchase < 85",
                    "LoanX marks",
                    "LME-posture tell — escalate to CP-3D"
                ],
                [
                    "1L 1L TLB / 2L TL price decoupling",
                    "weekly marks",
                    "re-test relative preference"
                ]
            ])
        ]
    },
    "CP-3B:Gaps Ledger": {
        ref: "REF_CP-3B · T3B.11",
        out: "Gaps ledger",
        sections: [
            X("Ledger", "No instrument-level gaps. Lease ($84M) and pension (de-minimis) claims modeled from audit notes at $61M combined priority-adjusted — immaterial to attachment points.")
        ]
    },
    "CP-3B:Overall Instrument Preference View": {
        ref: "REF_CP-3B",
        out: "Overall preference view",
        sections: [
            X("View", "2L TL preferred over the TLB: +210bps of spread pickup for an acceptable recovery delta at the 6.0x stress point. Sub notes rejected on priming exposure and thin covenant protection. The preference stands under both fair-value bands and both waterfall variants short of an actual priming event.")
        ]
    },
    /* ================= CP-3C · PortfolioFit ================= */ "CP-3C:Portfolio Input Gate": {
        ref: "REF_CP-3C · T3C.1",
        out: "Gate decision",
        sections: [
            T("Inputs", [
                "Input",
                "As-of",
                "Status"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Portfolio snapshot",
                    "Jun 8 (T+1)",
                    "LOADED"
                ],
                [
                    "Limit framework v4.1",
                    "current",
                    "LOADED"
                ],
                [
                    "Proposed sizing range",
                    "75–125bps",
                    "from CP-6E draft"
                ]
            ])
        ]
    },
    "CP-3C:Portfolio Fit Register": {
        ref: "REF_CP-3C · T3C.2",
        out: "Fit register",
        sections: [
            T("Hard limits at initial size (75bps)", [
                "Constraint",
                "Limit",
                "Post-add",
                "Status"
            ], [
                0,
                1,
                1,
                0
            ], [
                [
                    "Single issuer",
                    "150bps",
                    "75bps",
                    "PASS"
                ],
                [
                    "Industrials sector",
                    "8.0%",
                    "6.1%",
                    "PASS"
                ],
                [
                    "Sponsor (Kestrel) aggregate",
                    "4.0%",
                    "2.2%",
                    "PASS"
                ],
                [
                    "B3-or-below bucket",
                    "15.0%",
                    "13.7%",
                    "PASS — 91% utilized"
                ]
            ])
        ]
    },
    "CP-3C:Position Sizing Posture Table": {
        ref: "REF_CP-3C · T3C.3",
        out: "Sizing posture",
        sections: [
            T("Posture", [
                "Size",
                "Budget effect",
                "Read"
            ], [
                0,
                0,
                0
            ], [
                [
                    "75bps initial",
                    "headroom preserved in every budget",
                    "supported"
                ],
                [
                    "100bps",
                    "B3 bucket 94% utilized",
                    "requires headroom check"
                ],
                [
                    "125bps max",
                    "B3 bucket 97% utilized",
                    "binds — same-day re-test required"
                ]
            ])
        ]
    },
    "CP-3C:Risk Budget Flags": {
        ref: "REF_CP-3C · T3C.4",
        out: "Budget flags",
        sections: [
            F("Flags", [
                {
                    sev: "warning",
                    text: "B3-or-below quality bucket at 91% utilization is the binding flag — max sizing requires a same-day headroom re-test. Encoded into the CP-6E sizing constraint."
                },
                {
                    sev: "ok",
                    text: "All other budgets (issuer, sector, sponsor, correlation) pass with material headroom."
                }
            ])
        ]
    },
    "CP-3C:Concentration & Correlation Register": {
        ref: "REF_CP-3C · T3C.5",
        out: "Concentration register",
        sections: [
            T("Register", [
                "Constraint",
                "Limit",
                "Post-add",
                "Headroom",
                "Status"
            ], [
                0,
                1,
                1,
                1,
                0
            ], [
                [
                    "Single issuer",
                    "150bps",
                    "75bps",
                    "75bps",
                    "PASS"
                ],
                [
                    "Industrials sector",
                    "8.0%",
                    "6.1%",
                    "1.9%",
                    "PASS"
                ],
                [
                    "B3-or-below bucket",
                    "15.0%",
                    "13.7%",
                    "1.3%",
                    "WATCH — 91% utilized"
                ],
                [
                    "Auto/industrial correlation cluster",
                    "16.0%",
                    "14.0%",
                    "2.0%",
                    "PASS"
                ],
                [
                    "Sponsor (Kestrel) aggregate",
                    "4.0%",
                    "2.2%",
                    "1.8%",
                    "PASS"
                ]
            ]),
            X("Watched pair", "SXAA is the monitored overlap (same OEM exposure class) — no concurrent adds ruled by the CIO.")
        ]
    },
    "CP-3C:Liquidity & Implementation": {
        ref: "REF_CP-3C · T3C.6",
        out: "Implementation feasibility",
        sections: [
            X("Feasibility", "Two-way desk markets 96.25/96.75 and $4.2M average LoanX clip support building 75bps inside ~2 weeks without moving the price. Standing limit order at +400bps captures weakness. Exit liquidity adequate for a 75bps position; 125bps would take ~4 weeks to unwind in stress — acceptable for a hold-to-maturity thesis.", [
                "E-71"
            ])
        ]
    },
    "CP-3C:Downside Budget & Recovery Sensitivity": {
        ref: "REF_CP-3C · T3C.7",
        out: "Downside budget",
        sections: [
            T("Budget consumption", [
                "Case",
                "Position loss",
                "Quarterly budget use"
            ], [
                0,
                1,
                1
            ], [
                [
                    "Severe stress (21% recovery)",
                    "−59pts on 125bps",
                    "9bps of 15bps allowance"
                ],
                [
                    "Base distress (38% mkt-implied)",
                    "−36pts on 125bps",
                    "5.6bps"
                ],
                [
                    "Spread +100 mark-to-market",
                    "−4.2pts",
                    "0.7bps"
                ]
            ])
        ]
    },
    "CP-3C:Monitoring / Add-Trim Triggers": {
        ref: "REF_CP-3C · T3C.8",
        out: "Add/trim wiring",
        sections: [
            T("Wiring (mirrors CP-6E)", [
                "Direction",
                "Trigger"
            ], [
                0,
                0
            ], [
                [
                    "Add",
                    "T-1 pass (≥$30M add-backs realized) + same-day bucket headroom"
                ],
                [
                    "Add",
                    "spread > +425 with thesis intact"
                ],
                [
                    "Trim",
                    "RP-basket activation (T-4)"
                ],
                [
                    "Trim",
                    "CP-3 re-rank below 4 of 7 · cluster breach > 15%"
                ]
            ])
        ]
    },
    "CP-3C:Gaps Ledger": {
        ref: "REF_CP-3C · T3C.9",
        out: "Gaps ledger",
        sections: [
            X("Ledger", "No gaps. Portfolio snapshot staleness (T+1) is a standard operating limitation — bucket utilization re-tested on trade date by rule.")
        ]
    },
    "CP-3C:Overall Portfolio Fit View": {
        ref: "REF_CP-3C",
        out: "Overall fit view",
        sections: [
            X("View", "Initial 75bps fits all budgets. The binding constraint at max size (125bps) is the B3-or-below bucket — any add requires a same-day bucket headroom check, encoded in the CP-6E sizing constraint.")
        ]
    },
    /* ================= CP-3D · Refinancing & LME ================= */ "CP-3D:Source Register & Module Status": {
        ref: "REF_CP-3D · T3D.1",
        out: "Gate decision",
        sections: [
            T("Inputs", [
                "Input",
                "Status"
            ], [
                0,
                0
            ], [
                [
                    "Facility schedules (D-02/D-03)",
                    "GREEN"
                ],
                [
                    "CP-2E liquidity outputs",
                    "GREEN"
                ],
                [
                    "CP-4C capacity registers",
                    "GREEN"
                ]
            ])
        ]
    },
    "CP-3D:Maturity Wall Register": {
        ref: "REF_CP-3D · T3D.2",
        out: "Maturity wall",
        sections: [
            T("Wall ($M)", [
                "Year",
                "Instrument",
                "Amount",
                "Path assessment"
            ], [
                0,
                0,
                1,
                0
            ], [
                [
                    "2027",
                    "RCF commitment expiry",
                    "250",
                    "extend H2-26 — relationship banks, likely +25–50bps"
                ],
                [
                    "2029",
                    "Term Loan B",
                    "1,850",
                    "refinanceable in current market at ~SOFR+400"
                ],
                [
                    "2031",
                    "2L TL (subject)",
                    "900",
                    "inside refi horizon post-deleveraging"
                ],
                [
                    "2032",
                    "Sub Notes",
                    "400",
                    "candidate for discounted repurchase if px < 85"
                ]
            ])
        ]
    },
    "CP-3D:Liquidity / Market Access Table": {
        ref: "REF_CP-3D · T3D.3",
        out: "Market access",
        sections: [
            T("Access channels", [
                "Channel",
                "Evidence",
                "Status"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Lev loan primary",
                    "May-26 2L TL priced inside talk at 99.41",
                    "OPEN"
                ],
                [
                    "Loan market",
                    "TLB trades 99.1–99.6",
                    "OPEN"
                ],
                [
                    "RCF banks",
                    "5-bank group, all retained since 2021",
                    "SUPPORTIVE"
                ]
            ])
        ]
    },
    "CP-3D:Legal Capacity for LME": {
        ref: "REF_CP-3D · T3D.4",
        out: "LME capacity assessment",
        sections: [
            T("Capacity elements", [
                "Element",
                "Finding"
            ], [
                0,
                0
            ], [
                [
                    "Incremental debt",
                    "$612M day-one, pari or senior to 2L"
                ],
                [
                    "Amendment threshold",
                    "50.1% for non-money terms — uptier-enabling"
                ],
                [
                    "MFN protection",
                    "pari only · sunsets Jun-27"
                ],
                [
                    "J.Crew / Chewy blockers",
                    "PRESENT — drop-down / release paths blocked"
                ]
            ]),
            X("Assessment", "Uptier path OPEN: the capacity is real and is priced via sizing, not exclusion. The binding protection for the 2L today is economics (no distress motive), not documents.", [
                "E-63",
                "E-64"
            ])
        ]
    },
    "CP-3D:Sponsor Willingness Table": {
        ref: "REF_CP-3D · T3D.5",
        out: "Sponsor willingness",
        sections: [
            T("Willingness", [
                "Factor",
                "Read"
            ], [
                0,
                0
            ], [
                [
                    "Fund VI capacity ($4.2B, Jun-26)",
                    "follow-on equity available — support-positive"
                ],
                [
                    "Recap record (2 of 2 Fund IV exits)",
                    "support conditional on equity value, not creditor protection"
                ],
                [
                    "Platform status",
                    "largest industrials position — reputational stake in avoiding default"
                ]
            ]),
            X("Net", "MODERATE-HIGH willingness to support the enterprise; LOW willingness to protect any specific creditor class.", [
                "E-91"
            ])
        ]
    },
    "CP-3D:Refinancing Path Table": {
        ref: "REF_CP-3D · T3D.6",
        out: "Refi paths",
        sections: [
            T("Paths", [
                "Instrument",
                "Path",
                "Risk"
            ], [
                0,
                0,
                0
            ], [
                [
                    "RCF (2027)",
                    "extend H2-26 at +25–50bps",
                    "LOW"
                ],
                [
                    "TLB (2029)",
                    "refi at ~SOFR+400 on current fundamentals",
                    "LOW-MED — cycle-dependent"
                ],
                [
                    "2L TL (2031)",
                    "refi post-deleveraging; 101 soft-call lapsed — par-prepayable",
                    "MED"
                ],
                [
                    "Subs (2032)",
                    "discounted repurchase if px < 85",
                    "opportunistic"
                ]
            ])
        ]
    },
    "CP-3D:Vulnerability Score Table": {
        ref: "REF_CP-3D · T3D.7",
        out: "Vulnerability score",
        sections: [
            T("Score build — 4 / 10", [
                "Factor",
                "Score",
                "Basis"
            ], [
                0,
                1,
                0
            ], [
                [
                    "Maturity proximity",
                    "1 / 10",
                    "nothing inside 24 months"
                ],
                [
                    "Cash flow adequacy",
                    "2 / 10",
                    "real FCF, 19.3 MTE"
                ],
                [
                    "Market access",
                    "2 / 10",
                    "both channels open"
                ],
                [
                    "Legal LME capacity",
                    "8 / 10",
                    "uptier path open — dominates the blend"
                ],
                [
                    "Sponsor behavior",
                    "6 / 10",
                    "recap pattern"
                ],
                [
                    "Composite (weighted)",
                    "4 / 10",
                    "capacity-driven, not distress-driven"
                ]
            ])
        ]
    },
    "CP-3D:Creditor Class Exposure Table": {
        ref: "REF_CP-3D · T3D.8",
        out: "Class exposure",
        sections: [
            T("Exposure by class", [
                "Class",
                "LME exposure",
                "Mechanism"
            ], [
                0,
                0,
                0
            ], [
                [
                    "TLB (1L)",
                    "LOW",
                    "protected by lien priority + springing covenant"
                ],
                [
                    "2L TL (subject)",
                    "HIGH — target class",
                    "priming capacity lands directly above"
                ],
                [
                    "Sub Notes",
                    "STRUCTURAL",
                    "first-loss; repurchase-at-discount candidate"
                ]
            ])
        ]
    },
    "CP-3D:Monitoring Triggers": {
        ref: "REF_CP-3D · T3D.9",
        out: "Refi triggers",
        sections: [
            T("Triggers", [
                "Trigger",
                "Threshold",
                "Action"
            ], [
                0,
                0,
                0
            ], [
                [
                    "TLB price",
                    "< 97",
                    "refi-risk tell — re-score vulnerability"
                ],
                [
                    "RCF extension",
                    "terms worse than +50bps",
                    "re-score market access"
                ],
                [
                    "Amendment solicitation",
                    "any",
                    "immediate LME posture review"
                ]
            ])
        ]
    },
    "CP-3D:Scenario Map (base / stress / LME)": {
        ref: "REF_CP-3D · T3D.10",
        out: "Scenario map",
        sections: [
            T("Scenarios", [
                "Scenario",
                "Mechanics",
                "2L outcome"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Base",
                    "RCF extended H2-26; TLB refi 2028-29; deleveraging to 4.9x",
                    "par — refi or call 2028+"
                ],
                [
                    "Stress",
                    "P1 hits as 2029 TLB approach opens — vulnerability re-rates 7/10",
                    "spread +150–250; covenant pressure"
                ],
                [
                    "LME",
                    "post-sunset uptier: $612M priming raise, 50.1% amendment",
                    "recovery −13pp at 6.0x stress; px low 80s"
                ]
            ]),
            X("Note", "The LME scenario requires both motive (stress) and the open window (post Jun-27) — the sequencing watched by trigger T-2.", [
                "E-63"
            ])
        ]
    },
    "CP-3D:Gaps Ledger": {
        ref: "REF_CP-3D · T3D.11",
        out: "Gaps ledger",
        sections: [
            X("Ledger", "No gaps. Private-side amendment history unavailable but non-blocking for the vulnerability score.")
        ]
    },
    "CP-3D:Overall Refinancing / LME View": {
        ref: "REF_CP-3D",
        out: "Overall view",
        sections: [
            X("View", "Vulnerability 4/10 today: no near wall, real FCF, open market access. But legal capacity for an uptier exists ($612M incremental + open RP paths) — vulnerability re-rates to 7/10 if P1 stress coincides with the 2029 TLB approach. Capacity-driven risk, watched at the 2028–29 window.", [
                "E-64"
            ])
        ]
    }
};
// ── from step-outputs-l456.js ──
const O3 = {
    /* ================= CP-4 · Legal & Covenants ================= */ "CP-4:Source Gate + Module Status": {
        ref: "REF_CP-4 · T4.1",
        out: "Gate decision",
        sections: [
            T("Admitted documents", [
                "Doc",
                "Authority",
                "Status"
            ], [
                0,
                0,
                0
            ], [
                [
                    "D-02 SFA (executed, conformed)",
                    "controls bank debt",
                    "ADMITTED"
                ],
                [
                    "D-03 2L Credit Agt (executed)",
                    "controls the 2L loan",
                    "ADMITTED"
                ],
                [
                    "Intercreditor agreement",
                    "lien priority + standstill",
                    "ADMITTED"
                ],
                [
                    "CIM covenant summary",
                    "navigation only — never authority",
                    "REFERENCE"
                ]
            ])
        ]
    },
    "CP-4:Controlling Document Register": {
        ref: "REF_CP-4 · T4.2",
        out: "Controlling register",
        sections: [
            T("Controlling text", [
                "Provision area",
                "Controls",
                "Summary conflicts found"
            ], [
                0,
                0,
                0
            ], [
                [
                    "2L covenants, RP, incremental",
                    "D-03 Credit Agt",
                    "1 — CIM understates reclassification headroom"
                ],
                [
                    "Bank covenants, springing test",
                    "D-02 SFA",
                    "1 — CIM omits LC carve-out detail"
                ],
                [
                    "Lien priority / remedies standstill",
                    "Intercreditor",
                    "0"
                ]
            ]),
            X("Rule", "Where summaries conflict with executed text, executed text controls — both instances resolved against the executed documents and noted.")
        ]
    },
    "CP-4:Covenant Feature Register": {
        ref: "REF_CP-4 · T4.3",
        out: "Feature register — 41 provisions",
        sections: [
            T("Register (material provisions of 41)", [
                "Ref",
                "Provision",
                "Feature class",
                "Agg."
            ], [
                0,
                0,
                0,
                1
            ], [
                [
                    "§4.09(b)(14)",
                    "Incremental debt — freebie + ratio + reclass",
                    "capacity",
                    "9"
                ],
                [
                    "§4.09(d)",
                    "MFN 50bps · pari-only · 12mo sunset",
                    "protection decay",
                    "8"
                ],
                [
                    "§1.01 'Consolidated EBITDA'",
                    "uncapped add-backs (credit agreement)",
                    "definition",
                    "8"
                ],
                [
                    "§4.07",
                    "RP — builder + starter baskets",
                    "leakage",
                    "7"
                ],
                [
                    "§4.12 / §10.02",
                    "liens + collateral release mechanics",
                    "security",
                    "4"
                ],
                [
                    "§9.02",
                    "amendments — 50.1% non-money terms",
                    "remedies",
                    "7"
                ],
                [
                    "§5.01",
                    "reporting — monthly lender package",
                    "information",
                    "2"
                ]
            ])
        ]
    },
    "CP-4:EBITDA, Definitions & Ratio Mechanics": {
        ref: "REF_CP-4",
        out: "Definition mechanics",
        sections: [
            T("Definition comparison", [
                "Element",
                "SFA (bank)",
                "Credit Agt (notes)"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Cost-saving add-backs",
                    "capped 25% of EBITDA / 24mo",
                    "UNCAPPED"
                ],
                [
                    "Run-rate window",
                    "24 months",
                    "36 months"
                ],
                [
                    "Covenant EBITDA (LTM)",
                    "$421.4M",
                    "$435.6M"
                ],
                [
                    "Divergence",
                    "—",
                    "+$14.2M feeds every grower basket"
                ]
            ]),
            X("Mechanics", "Definitional looseness is the document's core aggression: the uncapped credit agreement definition inflates every grower basket and ratio test mechanically with each 'one-time' charge. Evidence → mechanic → implication: recurring charges (3 of last 4 years) → permanent basket inflation → capacity grows precisely when earnings quality falls.", [
                "E-09",
                "E-103"
            ])
        ]
    },
    "CP-4:Debt Incurrence, Incremental & MFN": {
        ref: "REF_CP-4",
        out: "Incurrence stack",
        sections: [
            T("Incurrence stack ($M)", [
                "Basket",
                "Capacity",
                "Ranking permitted"
            ], [
                0,
                1,
                0
            ], [
                [
                    "Freebie (greater of $150M / 35% EBITDA)",
                    "150",
                    "pari or senior to 2L"
                ],
                [
                    "Ratio capacity (5.25x secured test @ 4.68x)",
                    "310",
                    "pari or senior to 2L"
                ],
                [
                    "Reclassification headroom",
                    "155",
                    "pari or senior to 2L"
                ],
                [
                    "Total day-one",
                    "612",
                    ""
                ]
            ]),
            X("MFN", "MFN at 50bps protects pari incremental raises only and sunsets June 2027 — after which a priming or pari raise carries no yield protection for 2L lenders.", [
                "E-63",
                "E-64"
            ])
        ]
    },
    "CP-4:Leakage, RP, Investments & Transfers": {
        ref: "REF_CP-4",
        out: "Leakage analysis",
        sections: [
            T("Leakage paths ($M)", [
                "Path",
                "Capacity today",
                "Note"
            ], [
                0,
                1,
                0
            ], [
                [
                    "RP builder basket (§4.07)",
                    "240",
                    "pre-positioned — no stated use"
                ],
                [
                    "RP starter + general baskets",
                    "70",
                    "usable day-one"
                ],
                [
                    "Investment baskets",
                    "185",
                    "permits unrestricted-sub designation"
                ],
                [
                    "Unrestricted-sub transfer basket",
                    "ABSENT",
                    "J.Crew-style drop-down blocked"
                ]
            ])
        ]
    },
    "CP-4:Collateral, Guarantees & Subordination": {
        ref: "REF_CP-4",
        out: "Security package",
        sections: [
            T("Package", [
                "Element",
                "Finding"
            ], [
                0,
                0
            ], [
                [
                    "Guarantor coverage",
                    "87% of EBITDA — all material domestic subs"
                ],
                [
                    "Collateral",
                    "second lien on substantially all assets"
                ],
                [
                    "Non-guarantor pockets",
                    "MX subsidiary only (<4% EBITDA)"
                ],
                [
                    "Automatic release triggers",
                    "none beyond customary (Chewy blocked)"
                ]
            ]),
            X("Read", "The structural floor of the credit — coverage and collateral are market-standard-or-better and offset part of the capacity aggression.")
        ]
    },
    "CP-4:EoD, Remedies & Amendment Risk": {
        ref: "REF_CP-4",
        out: "Remedies assessment",
        sections: [
            X("Assessment", "Events of default are conventional (cross-acceleration at $40M, judgment at $50M). Sacred rights are limited to money terms: amendments to covenants, collateral and ranking-adjacent provisions pass at 50.1% — uptier-enabling architecture, standard for the 2026 vintage but live given the open capacity. The intercreditor imposes a 120-day standstill on 2L remedies — registered for CP-3B's recovery timing.")
        ]
    },
    "CP-4:PD vs LGD / Recovery Translation": {
        ref: "REF_CP-4 · T4.9",
        out: "PD/LGD translation",
        sections: [
            X("Translation", "This document set shifts risk from PD to LGD. Default is not made nearer (no maintenance covenant to trip; liquidity strong), but the creditor's position at default is erodible: priming capacity degrades the 2L's attachment point and leakage baskets can move value out before a restructuring. Quantified: a used $612M capacity cuts 6.0x-stress recovery from 21% to ~8% (CP-3B overlay).")
        ]
    },
    "CP-4:Market Norm Comparison": {
        ref: "REF_CP-4 · T4.10",
        out: "Norm comparison",
        sections: [
            T("vs 2026 single-B norm set", [
                "Dimension",
                "Subject",
                "Market norm"
            ], [
                0,
                1,
                1
            ], [
                [
                    "Add-back treatment",
                    "uncapped (credit agreement)",
                    "25–30% cap typical"
                ],
                [
                    "Day-one capacity / EBITDA",
                    "1.45x",
                    "0.9–1.1x"
                ],
                [
                    "MFN sunset",
                    "12 months",
                    "18–24 months"
                ],
                [
                    "Guarantor coverage",
                    "87%",
                    "80–85%"
                ],
                [
                    "Composite aggressiveness",
                    "7.2 / 10",
                    "6.1 / 10"
                ]
            ])
        ]
    },
    "CP-4:Aggressiveness Score": {
        ref: "REF_CP-4 · T4.11",
        out: "Aggressiveness score",
        sections: [
            T("Score build — 7.2 / 10 (Aggressive)", [
                "Component",
                "Score",
                "Driver"
            ], [
                0,
                1,
                0
            ], [
                [
                    "Definitions",
                    "8",
                    "uncapped add-backs"
                ],
                [
                    "Capacity",
                    "9",
                    "$612M day-one + reclassification"
                ],
                [
                    "Protection decay",
                    "8",
                    "12-month MFN sunset"
                ],
                [
                    "Leakage",
                    "7",
                    "$310M RP usable today"
                ],
                [
                    "Security / guarantees",
                    "4",
                    "full coverage — offsetting"
                ],
                [
                    "Reporting",
                    "2",
                    "above-market disclosure"
                ]
            ]),
            X("Verdict", "Top-quartile aggressive vs the 2026 single-B norm of 6.1 — driven by definitions and capacity, partially offset by the security package and the absence of an unrestricted-sub transfer basket.")
        ]
    },
    "CP-4:Red Flags & Monitoring Triggers": {
        ref: "REF_CP-4 · T4.12",
        out: "Red flags",
        sections: [
            F("Red flags → standing triggers", [
                {
                    sev: "critical",
                    text: "MFN sunset Jun-27: any incremental raise above $200M inside the window trips T-2 → CP-3B re-rank + CP-6E sizing review.",
                    ev: [
                        "E-64"
                    ]
                },
                {
                    sev: "warning",
                    text: "RP capacity pre-positioned ($240M builder): any activation trips T-4 → posture change at CP-2D and CP-6E.",
                    ev: [
                        "E-63"
                    ]
                }
            ])
        ]
    },
    "CP-4:Gaps Ledger": {
        ref: "REF_CP-4 · T4.13",
        out: "Gaps ledger",
        sections: [
            X("Ledger", "No documentation gaps — full executed set provided. The intercreditor's 120-day standstill detail registered for CP-3B recovery timing assumptions.")
        ]
    },
    "CP-4:Overall Legal Credit View": {
        ref: "REF_CP-4",
        out: "Overall legal view",
        sections: [
            X("View", "An aggressive but not pathological document set: capacity ($612M day-one) and definitional looseness (uncapped add-backs) are the risks; full collateral/guarantee coverage and the absence of J.Crew/Chewy paths are the protections. The single most consequential date in the document set is the MFN sunset, June 2027.")
        ]
    },
    /* ================= CP-4C · Covenant Capacity ================= */ "CP-4C:Source Gate + Module Status": {
        ref: "REF_CP-4C · T4C.1",
        out: "Gate decision",
        sections: [
            T("Inputs", [
                "Input",
                "Status"
            ], [
                0,
                0
            ], [
                [
                    "CP-4 covenant feature register",
                    "GREEN"
                ],
                [
                    "D-05 Q1-26 certificate (live ratios)",
                    "GREEN"
                ],
                [
                    "CP-1 covenant EBITDA series (both bases)",
                    "GREEN"
                ]
            ]),
            X("Status", "READY.", [
                "E-103"
            ])
        ]
    },
    "CP-4C:Controlling Capacity Source Map": {
        ref: "REF_CP-4C · T4C.2",
        out: "Capacity source map",
        sections: [
            T("Source map", [
                "Capacity figure",
                "Controlling clause",
                "Cross-checks"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Incremental $612M",
                    "Credit Agt §4.09(b)(14)",
                    "SFA cross-default — not binding"
                ],
                [
                    "RP $240M builder",
                    "Credit Agt §4.07(a)(iii)",
                    "certificate build verified"
                ],
                [
                    "Springing test",
                    "SFA §7.11",
                    "trips > 40% RCF utilization"
                ]
            ])
        ]
    },
    "CP-4C:Definition & Ratio Mechanics Register": {
        ref: "REF_CP-4C · T4C.3",
        out: "Ratio mechanics",
        sections: [
            T("Live ratios (Q1-26 certificate)", [
                "Ratio",
                "Tested",
                "Ceiling",
                "Gap"
            ], [
                0,
                1,
                1,
                1
            ], [
                [
                    "Consolidated Secured Leverage",
                    "4.68x",
                    "5.25x (incurrence)",
                    "0.57x"
                ],
                [
                    "Total Net Leverage",
                    "5.68x",
                    "no maintenance test",
                    "—"
                ],
                [
                    "Springing 1L test",
                    "untested",
                    "7.10x at >40% util.",
                    "28% headroom"
                ]
            ]),
            X("Note", "The 0.57x secured gap is what prices into $310M of ratio capacity.", [
                "E-103"
            ])
        ]
    },
    "CP-4C:Headroom Table": {
        ref: "REF_CP-4C · T4C.4",
        out: "Headroom table",
        sections: [
            T("Headroom", [
                "Dimension",
                "Current",
                "Constraint",
                "Headroom"
            ], [
                0,
                1,
                0,
                1
            ], [
                [
                    "Secured leverage",
                    "4.68x",
                    "5.25x incurrence",
                    "0.57x ≈ $310M"
                ],
                [
                    "RCF utilization",
                    "22%",
                    "40% springing trigger",
                    "28pp"
                ],
                [
                    "RP builder build-rate",
                    "$240M",
                    "50% of CNI accrual",
                    "+$45M/yr"
                ]
            ])
        ]
    },
    "CP-4C:Capacity Register": {
        ref: "REF_CP-4C · T4C.5",
        out: "Capacity register",
        sections: [
            T("Day-one debt capacity ($M)", [
                "Component",
                "Amount",
                "Basis"
            ], [
                0,
                1,
                0
            ], [
                [
                    "Freebie basket",
                    "150",
                    "greater of $150M / 35% × $421M"
                ],
                [
                    "Ratio capacity",
                    "310",
                    "to 5.25x secured at 4.68x current"
                ],
                [
                    "Reclassification headroom",
                    "155",
                    "basket migration mechanics"
                ],
                [
                    "Total — pari or senior to 2L TL",
                    "612",
                    ""
                ]
            ]),
            X("Note", "Incurrable senior or pari passu to the 2L TL — the figure consumed by CP-3B's LME overlay and CP-3D's vulnerability work.", [
                "E-63"
            ])
        ]
    },
    "CP-4C:Debt / Lien / Priming Analysis": {
        ref: "REF_CP-4C · T4C.6",
        out: "Priming analysis",
        sections: [
            X("Analysis", "Priming risk MEDIUM-HIGH. The full $612M is incurrable pari or senior to the 2L; inside the MFN window a pari raise must price within 50bps (or ratchet the 2L margin), but after June 2027 it can also price freely. The 2L is the natural priming victim: 1L lenders are protected by lien priority, subs are too small to matter. Watch: any incremental notice during stress (T-2).", [
                "E-63"
            ])
        ]
    },
    "CP-4C:RP / Leakage Analysis": {
        ref: "REF_CP-4C · T4C.7",
        out: "RP / leakage analysis",
        sections: [
            T("RP capacity today ($M)", [
                "Basket",
                "Amount",
                "Status"
            ], [
                0,
                1,
                0
            ], [
                [
                    "Builder (CNI accrual since close)",
                    "240",
                    "pre-positioned, no stated use"
                ],
                [
                    "Starter",
                    "45",
                    "day-one"
                ],
                [
                    "General RP",
                    "25",
                    "day-one"
                ],
                [
                    "Total usable today",
                    "310",
                    "no ratio test required ≤ $240M"
                ]
            ]),
            X("Read", "Enough for a meaningful dividend without amendment — the behavioral signal (pre-positioning) matters as much as the number; fed to CP-2D.")
        ]
    },
    "CP-4C:Add-Back Inflation Analysis": {
        ref: "REF_CP-4C · T4C.8",
        out: "Add-back inflation analysis",
        sections: [
            T("Add-back composition (LTM, $M)", [
                "Component",
                "Amount"
            ], [
                0,
                1
            ], [
                [
                    "Cost savings (plant closures, run-rate)",
                    "41.2"
                ],
                [
                    "Transaction / integration costs",
                    "18.7"
                ],
                [
                    "Non-recurring operational items",
                    "9.4"
                ],
                [
                    "Sponsor management fees",
                    "7.3"
                ],
                [
                    "Total — 18.2% of adj. EBITDA",
                    "76.6"
                ]
            ]),
            X("Inflation mechanics", "Add-backs feed every grower basket — capacity inflates mechanically with each 'one-time' charge. CP-1's recurrence finding (charges in 3 of the last 4 years, avg $25.6M) makes the inflation structural, not episodic.", [
                "E-09",
                "E-87"
            ])
        ]
    },
    "CP-4C:Leakage & Basket Flags": {
        ref: "REF_CP-4C · T4C.9",
        out: "Basket flags",
        sections: [
            F("Flags", [
                {
                    sev: "warning",
                    text: "Builder-basket pre-positioning — capacity built before need; behavioral signal routed to CP-2D."
                },
                {
                    sev: "warning",
                    text: "Grower-basket linkage to uncapped add-back EBITDA — mechanical inflation; every certificate that adds charges adds capacity."
                }
            ])
        ]
    },
    "CP-4C:Nearest Pressure Point": {
        ref: "REF_CP-4C",
        out: "Nearest pressure point",
        sections: [
            X("MFN sunset — June 2027", "After the sunset, a priming or pari incremental raise carries no yield protection for 2L lenders. Combined with $612M of open capacity and a 50.1% amendment threshold, this is the single most consequential date in the document set. All capacity-related triggers (T-2) reference it.", [
                "E-64"
            ])
        ]
    },
    "CP-4C:Capacity Risk Priority Matrix": {
        ref: "REF_CP-4C · T4C.11",
        out: "Priority matrix",
        sections: [
            T("Priority matrix", [
                "Rank",
                "Risk",
                "Character",
                "Trigger"
            ], [
                0,
                0,
                0,
                0
            ], [
                [
                    "1",
                    "MFN sunset (Jun-27)",
                    "time-bound — protection decays on a date",
                    "T-2"
                ],
                [
                    "2",
                    "RP activation",
                    "behavioral — sponsor's tell",
                    "T-4"
                ],
                [
                    "3",
                    "Add-back inflation",
                    "gradual — grows with each certificate",
                    "T-1"
                ]
            ])
        ]
    },
    "CP-4C:Gaps Ledger": {
        ref: "REF_CP-4C · T4C.12",
        out: "Gaps ledger",
        sections: [
            X("Ledger", "No gaps. Capacity math reproducible end-to-end from registered clause cites — every figure resolves to an credit agreement or SFA section.")
        ]
    },
    "CP-4C:Overall Covenant Capacity View": {
        ref: "REF_CP-4C",
        out: "Overall capacity view",
        sections: [
            X("View", "Capacity is the credit's defining legal feature: $612M of day-one debt and $310M of leakage, all real and all priced via sizing and triggers rather than exclusion. Nearest pressure point: MFN sunset June 2027.")
        ]
    },
    /* ================= CP-5 · QA & Governance ================= */ "CP-5:Input Module Register": {
        ref: "REF_CP-5 · T5.1",
        out: "Input register",
        sections: [
            T("Audit inputs", [
                "Field",
                "Value"
            ], [
                0,
                1
            ], [
                [
                    "Module outputs registered",
                    "21"
                ],
                [
                    "Version hashes verified",
                    "21 / 21"
                ],
                [
                    "Stale versions in consumption graph",
                    "0"
                ],
                [
                    "Citations to audit",
                    "1,142"
                ]
            ])
        ]
    },
    "CP-5:Citation & Evidence Audit": {
        ref: "REF_CP-5 · T5.2",
        out: "Citation audit",
        sections: [
            T("Audit results", [
                "Check",
                "Result"
            ], [
                0,
                0
            ], [
                [
                    "Citations resolved against source vault",
                    "1,141 of 1,142"
                ],
                [
                    "Fabricated / orphaned citations",
                    "0"
                ],
                [
                    "Anchor mismatches",
                    "1 — E-44 (HIGH)"
                ],
                [
                    "[Analyst estimate] labels verified",
                    "4 of 4 properly flagged"
                ]
            ]),
            F("Finding", [
                {
                    sev: "critical",
                    text: "QA-117 (HIGH): CP-1C cites CIM Annex C p.388 for the peer margin set; p.388 contains the auditor consent letter. Anchor must be re-mapped to conformed p.391 before clearance.",
                    ev: [
                        "E-44"
                    ]
                }
            ])
        ]
    },
    "CP-5:Math / Logic / Definition Audit": {
        ref: "REF_CP-5 · T5.3",
        out: "Math audit",
        sections: [
            X("Result — CLEAN", "Every calc-register figure recomputed independently: 0 math defects and 0 definitional drift instances across 41 KPIs, the recovery grid, the liquidity bridge and all capacity math. The CP-3 rounding inconsistency (QA-122, LOW) was corrected in-run and re-verified.")
        ]
    },
    "CP-5:Legal / Structural Claim Audit": {
        ref: "REF_CP-5 · T5.4",
        out: "Legal claim audit",
        sections: [
            X("Result — CLEAN", "All legal claims traced to executed-document clauses: the $612M capacity build, MFN mechanics, amendment thresholds and ranking statements verified verbatim against the credit agreement and SFA. No claim rests on a CIM summary.")
        ]
    },
    "CP-5:RV / Market Claim Audit": {
        ref: "REF_CP-5 · T5.5",
        out: "Market claim audit",
        sections: [
            X("Result — CLEAN", "Market claims verified against LoanX marks and desk runs: +388 DM, 96.40 last mark, and the fair-band regression inputs all reproduce. The dual-band (with / ex-E-44) presentation verified as consistent everywhere quoted.", [
                "E-71"
            ])
        ]
    },
    "CP-5:Consistency & Version Audit": {
        ref: "REF_CP-5 · T5.6",
        out: "Consistency audit",
        sections: [
            X("Result — CLEAN", "Cross-module consistency clean after the QA-122 rounding fix: every module quotes identical figures for EBITDA ($421M adj. / $421.4M covenant), leverage (5.68x), and capacity ($612M). Version graph linear — no module consumed a superseded output.")
        ]
    },
    "CP-5:Committee-Readiness Audit": {
        ref: "REF_CP-5 · T5.7",
        out: "Readiness audit",
        sections: [
            F("Result", [
                {
                    sev: "warning",
                    text: "Pack HELD. Clearance policy bars committee assembly while any HIGH citation defect is open (QA-117). All non-citation readiness criteria pass: debate complete, sizing decided, triggers armed."
                }
            ])
        ]
    },
    "CP-5:Export & Evidence Trace Audit": {
        ref: "REF_CP-5 · T5.8",
        out: "Export audit",
        sections: [
            X("Result — CLEAN", "All 1,142 citations resolve to registered E-ids; master-index hashes match; appendix structure (HANDOFF_JSON, EVIDENCE_TRACE, QA_VALIDATION, EXPORT_MANIFEST, GAPS) validates against schema.")
        ]
    },
    "CP-5:Consolidated Issue Log": {
        ref: "REF_CP-5 · T5.9",
        out: "Issue log",
        sections: [
            T("Issue log", [
                "ID",
                "Sev",
                "Module",
                "Finding",
                "Status"
            ], [
                0,
                0,
                0,
                0,
                0
            ], [
                [
                    "QA-117",
                    "HIGH",
                    "CP-1C",
                    "E-44 anchored to wrong page (CIM Annex C)",
                    "OPEN"
                ],
                [
                    "QA-121",
                    "LOW",
                    "CP-2C",
                    "probability without basis — re-labeled [Analyst estimate]",
                    "RESOLVED"
                ],
                [
                    "QA-122",
                    "LOW",
                    "CP-3",
                    "RV table rounding inconsistent with CP-1C register",
                    "RESOLVED"
                ]
            ])
        ]
    },
    "CP-5:Remediation Priority Map": {
        ref: "REF_CP-5 · T5.10",
        out: "Remediation map",
        sections: [
            F("Map", [
                {
                    sev: "critical",
                    text: "R-1 (blocks committee pack): re-anchor E-44 to conformed CIM p.391 → re-run CP-1C metric alignment → refresh CP-3 RV table → refresh CP-6A weighting row 3. Estimated 40 minutes of module time.",
                    ev: [
                        "E-44"
                    ]
                }
            ])
        ]
    },
    "CP-5:Clearance Decision": {
        ref: "REF_CP-5 · T5.11",
        out: "Clearance decision",
        sections: [
            X("CONDITIONAL", "One HIGH citation defect open; math, legal, market and consistency audits clean across all 24 modules. CP-RENDER and CP-EXTRACT held until remediation R-1 lands; debate verdict stands ex-E-44; no other gating findings. No override path short of remediation.")
        ]
    },
    /* ================= CP-5B · Traceability ================= */ "CP-5B:Source Register & Readiness": {
        ref: "REF_CP-5B · T5B.1",
        out: "Gate decision",
        sections: [
            T("Inputs", [
                "Input",
                "Status"
            ], [
                0,
                0
            ], [
                [
                    "Committee-pack figure set",
                    "LOADED"
                ],
                [
                    "Master evidence index (CP-0)",
                    "LOADED — v1.0"
                ],
                [
                    "Calc register (CP-1)",
                    "LOADED — 41 KPIs"
                ]
            ])
        ]
    },
    "CP-5B:Top-5 Material Credit Drivers": {
        ref: "REF_CP-5B · T5B.2",
        out: "Driver selection",
        sections: [
            T("Drivers (by decision-weight)", [
                "#",
                "Driver",
                "Why material"
            ], [
                0,
                0,
                0
            ], [
                [
                    "1",
                    "EBITDA quality — add-backs 18.2%",
                    "decides real leverage; T-1 keys off it"
                ],
                [
                    "2",
                    "Top-3 OEM concentration 38%",
                    "primary downside transmission"
                ],
                [
                    "3",
                    "$612M day-one incremental capacity",
                    "decides LGD; priming channel"
                ],
                [
                    "4",
                    "FCF conversion 41%",
                    "principal PD mitigant"
                ],
                [
                    "5",
                    "Peer margin citation E-44",
                    "supports the RV entry signal — contested"
                ]
            ])
        ]
    },
    "CP-5B:Traceability Map": {
        ref: "REF_CP-5B · T5B.3",
        out: "Traceability map",
        sections: [
            X("Map", "Drawn figure-by-figure: every committee-pack number resolves to (producing module → calc-register entry → source anchor). 100% of pack figures covered; no orphan numbers. The map is the artifact a regulator or IC member would use to challenge any figure.")
        ]
    },
    "CP-5B:Source Lineage Register": {
        ref: "REF_CP-5B · T5B.4",
        out: "Lineage register",
        sections: [
            T("Lineage (top-5 drivers)", [
                "#",
                "Driver",
                "Chain",
                "Conf"
            ], [
                0,
                0,
                0,
                1
            ], [
                [
                    "1",
                    "Add-backs 18.2%",
                    "D-01 p.214 → CP-1 K-09 → CP-4C add-back analysis",
                    "92%"
                ],
                [
                    "2",
                    "OEM concentration 38%",
                    "D-01 p.97 → CP-1A operating model → CP-2B F-2",
                    "95%"
                ],
                [
                    "3",
                    "$612M capacity",
                    "D-03 §4.09 → CP-4 incurrence reg → CP-4C capacity reg",
                    "97%"
                ],
                [
                    "4",
                    "FCF conversion 41%",
                    "D-04 p.31 → CP-1 K-22 → CP-1C benchmark 04B",
                    "88%"
                ],
                [
                    "5",
                    "Peer margin set",
                    "D-01 Annex C → CP-1C alignment → CP-5 QA-117",
                    "41%"
                ]
            ])
        ]
    },
    "CP-5B:Calculation & Assumption Register": {
        ref: "REF_CP-5B · T5B.5",
        out: "Assumption register",
        sections: [
            T("[Analyst estimate] labels in pack", [
                "Assumption",
                "Where used",
                "Basis"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Derived Q4-25 quarter",
                    "CP-1 / CP-1B series",
                    "FY25 audited less Q1–Q3 (G-02)"
                ],
                [
                    "Catalyst probabilities (2)",
                    "CP-2C calendar",
                    "analyst judgment — labeled per QA-121"
                ],
                [
                    "Maintenance-capex split (2.9%)",
                    "CP-2 flexibility view",
                    "analyst split — disclosure null"
                ]
            ])
        ]
    },
    "CP-5B:Weak-Lineage Flags": {
        ref: "REF_CP-5B · T5B.6",
        out: "Weak-lineage flags",
        sections: [
            F("Flags", [
                {
                    sev: "warning",
                    text: "Driver #5's chain terminates at a mismatched anchor (E-44, conf 41%) — flagged weak until re-anchored; remediation owned by CP-5 R-1. Remaining four drivers trace to grade-A sources within three hops.",
                    ev: [
                        "E-44"
                    ]
                }
            ])
        ]
    },
    "CP-5B:Auditability Assessment": {
        ref: "REF_CP-5B · T5B.7",
        out: "Auditability assessment",
        sections: [
            X("STRONG", "Four of five material chains reach grade-A sources within three hops (avg 3.0); every figure in the committee pack resolves to a registered evidence ID and a calc-register reference. Reconstruction time for any material number is under two minutes from the master index.")
        ]
    },
    "CP-5B:Gaps Ledger": {
        ref: "REF_CP-5B · T5B.8",
        out: "Gaps ledger",
        sections: [
            X("Ledger", "No new gaps. The E-44 weak chain is owned by CP-5 remediation R-1 and not re-logged here.")
        ]
    },
    "CP-5B:Overall Traceability View": {
        ref: "REF_CP-5B",
        out: "Overall traceability view",
        sections: [
            X("View", "Auditability STRONG — the run's decisions are reconstructible end-to-end. The single weak chain (E-44) is contained: it affects the RV band's width, not the existence of the cheapness signal, and is already on the remediation map.")
        ]
    },
    /* ================= CP-6A · IC Debate ================= */ "CP-6A:IC Debate Source Gate": {
        ref: "REF_CP-6A",
        out: "Gate decision",
        sections: [
            T("J1 join — feeder status", [
                "Feeder",
                "Status"
            ], [
                0,
                0
            ], [
                [
                    "CP-2 credit view · CP-2B pathways",
                    "LANDED"
                ],
                [
                    "CP-3 RV (dual band) · CP-3B preference",
                    "LANDED"
                ],
                [
                    "CP-4 / 4C legal + capacity",
                    "LANDED"
                ],
                [
                    "CP-2F macro",
                    "LANDED — L-04 surfaced to Chair"
                ]
            ])
        ]
    },
    "CP-6A:Pre-Debate Thesis Map": {
        ref: "REF_CP-6A",
        out: "Thesis map",
        sections: [
            X("Contested ground (5 claims)", "1) EBITDA quality — are add-backs structural or transitional? 2) Documentation — does $612M capacity + MFN sunset change expected recovery? 3) Aftermarket durability — does the annuity floor EBITDA in stress? 4) RV signal — is +48–63bps real given E-44? 5) Macro — is the unhedged rate exposure a coverage threat? No strawmen: each claim has evidence on both sides registered before argument.")
        ]
    },
    "CP-6A:Bull Opening Statement": {
        ref: "REF_CP-6A",
        out: "Bull opening — 3 claims",
        sections: [
            T("Bull claims", [
                "#",
                "Claim",
                "Evidence"
            ], [
                0,
                0,
                0
            ], [
                [
                    "1",
                    "Annuity-grade aftermarket: 44% of GP, 92% renewal — floors stress EBITDA",
                    "E-12 · E-31"
                ],
                [
                    "2",
                    "Top-quartile FCF conversion (41%) funds debt service with headroom",
                    "E-22"
                ],
                [
                    "3",
                    "+48–63bps cheap to model at entry — paid to wait",
                    "E-71"
                ]
            ])
        ]
    },
    "CP-6A:Bear Cross-Examination": {
        ref: "REF_CP-6A · T6A.4",
        out: "Bear cross — 4 attacks",
        sections: [
            T("Bear attacks", [
                "#",
                "Attack",
                "Evidence"
            ], [
                0,
                0,
                0
            ], [
                [
                    "1",
                    "Add-backs are structural: charges recurred 3 of last 4 years — real leverage is ~6.3x",
                    "E-87 · E-09"
                ],
                [
                    "2",
                    "$612M priming capacity + MFN sunset = recovery erosion when it matters",
                    "E-63 · E-64"
                ],
                [
                    "3",
                    "Sponsor recap record — RP basket pre-positioned at $240M",
                    "E-91"
                ],
                [
                    "4",
                    "The RV signal leans on a broken citation (E-44)",
                    "E-44"
                ]
            ])
        ]
    },
    "CP-6A:Bull Defense": {
        ref: "REF_CP-6A",
        out: "Bull defense + concession",
        sections: [
            X("Defense", "Defended (1): recurrence average is $25.6M vs $76.6M presented — a haircut, not a disqualification; the certificate test (T-1) arbitrates within two quarters. Defended (2): capacity needs motive — no maturity wall before 2029, and the springing covenant constrains 1L raises in stress. Defended (3): pre-positioning is watched (T-4), and Fund VI argues for support. CONCEDED (4): the RV claim is restated on the ex-E-44 band (+20–25bps) — concession registered in the resolution matrix, not buried.", [
                "E-44"
            ])
        ]
    },
    "CP-6A:Chair Evidence Weighting": {
        ref: "REF_CP-6A · T6A.6",
        out: "Evidence weighting",
        sections: [
            T("Weighting (bull / bear)", [
                "Claim",
                "Bull",
                "Bear",
                "Verdict"
            ], [
                0,
                1,
                1,
                0
            ], [
                [
                    "EBITDA quality",
                    "35",
                    "65",
                    "BEAR — haircut base by $35M"
                ],
                [
                    "Documentation / recovery",
                    "25",
                    "75",
                    "BEAR — price via sizing"
                ],
                [
                    "Aftermarket durability",
                    "80",
                    "20",
                    "BULL — annuity holds"
                ],
                [
                    "RV signal",
                    "50",
                    "50",
                    "SPLIT — pending QA-117"
                ],
                [
                    "Macro / rates",
                    "45",
                    "55",
                    "CAVEATED — L-04 upper bound"
                ]
            ])
        ]
    },
    "CP-6A:Debate Resolution Matrix": {
        ref: "REF_CP-6A · T6A.7",
        out: "Resolution matrix",
        sections: [
            T("Resolution", [
                "Claim",
                "Resolution",
                "Carried into"
            ], [
                0,
                0,
                0
            ], [
                [
                    "EBITDA quality",
                    "bear — $35M haircut adopted",
                    "CP-6E sizing base"
                ],
                [
                    "Documentation",
                    "bear — staged sizing + T-2/T-4",
                    "CP-6E constraint"
                ],
                [
                    "Aftermarket",
                    "bull — stress floor confirmed",
                    "CP-2B parameters"
                ],
                [
                    "RV signal",
                    "split — ex-E-44 band governs entry",
                    "CP-6E entry rule"
                ],
                [
                    "Macro",
                    "carried w/ caveat until G-01 resolves",
                    "monitoring"
                ]
            ])
        ]
    },
    "CP-6A:Action Bias Determination": {
        ref: "REF_CP-6A",
        out: "Action bias",
        sections: [
            X("CONSTRUCTIVE — add on weakness", "The bear case is real but priced at +388: haircut the base case by $35M of EBITDA, size below max, and let carry plus deleveraging do the work. The bias is conditional — it reverses if T-1 fails at the Q3-26 certificate.")
        ]
    },
    "CP-6A:Single Greatest Uncertainty": {
        ref: "REF_CP-6A",
        out: "Greatest uncertainty",
        sections: [
            X("Add-back realization", "If the Q3-26 certificate shows under $30M realized, base-case deleveraging fails and the position reverts to a 6.9x credit bought at a 5.7x price — trigger T-1 forces the re-vote. Everything else in the debate is priced; this is the one input that changes the thesis rather than the size.", [
                "E-103"
            ])
        ]
    },
    "CP-6A:IC Chair Final Memo": {
        ref: "REF_CP-6A",
        out: "Chair memo",
        sections: [
            X("Memo", "CONSTRUCTIVE at a price. The franchise is better than the documents, and the spread pays for the difference — for now. Haircut base EBITDA by $35M; treat the credit agreement, not the income statement, as the real risk; let the Q3-26 certificate decide the upgrade to max size. Verdict stands ex-E-44; pack release gated on QA-117 remediation.")
        ]
    },
    "CP-6A:Gaps Ledger": {
        ref: "REF_CP-6A · T6A.11",
        out: "Gaps ledger",
        sections: [
            X("Ledger", "One debate-level gap: hedging posture unknown (L-04) — flagged as unresolvable until G-01 lands rather than argued past. Macro claims carry upper-bound labeling in the weighting.")
        ]
    },
    /* ================= CP-6E · Sizing Debate ================= */ "CP-6E:Portfolio Debate Source Gate": {
        ref: "REF_CP-6E",
        out: "Gate decision",
        sections: [
            T("Inputs", [
                "Input",
                "Status"
            ], [
                0,
                0
            ], [
                [
                    "CP-6A verdict (CONSTRUCTIVE, $35M haircut)",
                    "LANDED"
                ],
                [
                    "CP-3C fit register + budget flags",
                    "LANDED"
                ],
                [
                    "Live limit utilization (Jun 8 snapshot)",
                    "LANDED — T+1"
                ]
            ])
        ]
    },
    "CP-6E:Pre-Debate Portfolio Thesis Map": {
        ref: "REF_CP-6E",
        out: "Sizing thesis map",
        sections: [
            X("The sizing question", "Carry-adjusted return clears the hurdle at any size — the contest is between conviction (max now at +388) and constraints: B3-bucket utilization at 91%, the E-44-dependent entry band, and SXAA correlation overlap. Three contested points, each with a named owner.")
        ]
    },
    "CP-6E:RV Trader's Pitch": {
        ref: "REF_CP-6E",
        out: "Trader pitch",
        sections: [
            T("Pitch — max size now", [
                "#",
                "Argument"
            ], [
                0,
                0
            ], [
                [
                    "1",
                    "+388 entry clears hurdle hold-to-maturity with zero tightening assumed"
                ],
                [
                    "2",
                    "two-way depth ($4.2M avg prints) supports the build inside 2 weeks"
                ],
                [
                    "3",
                    "catalyst calendar is front-loaded — being underweight into Jul 28 wastes the entry"
                ]
            ]),
            X("Basis", "Live marks Jun 8: 96.25/96.75 two-way.", [
                "E-71"
            ])
        ]
    },
    "CP-6E:Compliance Officer's Attack": {
        ref: "REF_CP-6E · T6E.4",
        out: "Compliance attack",
        sections: [
            T("Attack — 3 fronts", [
                "#",
                "Objection"
            ], [
                0,
                0
            ], [
                [
                    "1",
                    "B3-or-below bucket at 91% utilization — max size leaves 0.3% headroom for the whole book"
                ],
                [
                    "2",
                    "entry band leans on open E-44 — sizing off a contested signal"
                ],
                [
                    "3",
                    "SXAA correlation overlap — same OEM exposure class, cluster at 14% of 16%"
                ]
            ])
        ]
    },
    "CP-6E:RV Trader's Defense": {
        ref: "REF_CP-6E",
        out: "Trader defense",
        sections: [
            X("Defense + proposal", "Concedes staging; proposes the standing constraint adopted into the decision: 75bps now at +388 or wider, max gated on T-1 plus a same-day bucket re-test, standing limit at +400, and no concurrent SXAA adds. The defense converts each objection into a wired rule rather than a debate point.")
        ]
    },
    "CP-6E:CIO Evidence Weighting": {
        ref: "REF_CP-6E · T6E.6",
        out: "CIO weighting",
        sections: [
            T("Weighting", [
                "Contested point",
                "Ruling basis",
                "Outcome"
            ], [
                0,
                0,
                0
            ], [
                [
                    "Bucket constraint",
                    "hard limit — compliance upheld",
                    "75bps initial"
                ],
                [
                    "Entry validity",
                    "split — ex-E-44 band governs",
                    "size off +20–25bps cheap"
                ],
                [
                    "Correlation",
                    "managed — rule, not block",
                    "no concurrent SXAA adds"
                ]
            ])
        ]
    },
    "CP-6E:Allocation Decision Matrix": {
        ref: "REF_CP-6E · T6E.7",
        out: "Decision matrix",
        sections: [
            T("Matrix", [
                "Contested point",
                "RV Trader",
                "Compliance",
                "CIO ruling"
            ], [
                0,
                0,
                0,
                0
            ], [
                [
                    "Size at max immediately (+388 entry)",
                    "carry clears hurdle hold-to-maturity",
                    "B3 bucket 91% utilized",
                    "start 75bps — max requires bucket headroom check"
                ],
                [
                    "RV signal validity",
                    "+48–63bps cheap vs fair band",
                    "band leans on open E-44",
                    "size off ex-E-44 band until QA-117 clears"
                ],
                [
                    "Correlation with auto/industrial cluster",
                    "different end-market mix vs SXAA",
                    "cluster at 14% of 16% limit",
                    "no concurrent adds with SXAA; monitor weekly"
                ]
            ]),
            X("Audit note", "This matrix is the artifact CP-5 audits for decision traceability — every ruling cites its evidence.")
        ]
    },
    "CP-6E:Final Sizing Posture": {
        ref: "REF_CP-6E",
        out: "Sizing posture",
        sections: [
            T("Posture", [
                "Parameter",
                "Value"
            ], [
                0,
                0
            ], [
                [
                    "Initial",
                    "75bps at +388 or wider"
                ],
                [
                    "Maximum",
                    "125bps — gated on T-1 + same-day bucket re-test"
                ],
                [
                    "Standing order",
                    "limit at +400bps"
                ],
                [
                    "Posture",
                    "ADD-ON-WEAKNESS"
                ]
            ])
        ]
    },
    "CP-6E:Exact Portfolio Constraint": {
        ref: "REF_CP-6E",
        out: "Binding constraint",
        sections: [
            X("B3-or-below bucket", "The binding constraint is the quality bucket at 91% utilization — not issuer, sector, sponsor or correlation limits. Any add must re-test the bucket on trade date; the rule is encoded in the sizing decision and mirrored in CP-3C's add/trim wiring.")
        ]
    },
    "CP-6E:CIO Final Memo": {
        ref: "REF_CP-6E",
        out: "CIO memo",
        sections: [
            X("Memo", "Approve 75bps initial at +388 or wider; standing limit order at +400bps. Path to 125bps max is gated on the Q3-26 add-back certificate (T-1) and same-day B3-bucket headroom. Trim on RP-basket activation (T-4) or CP-3 re-rank below 4/7. The position is sized so that being wrong costs a quarter's carry, not the year's budget.")
        ]
    },
    "CP-6E:Gaps Ledger": {
        ref: "REF_CP-6E · T6E.11",
        out: "Gaps ledger",
        sections: [
            X("Ledger", "No sizing-level gaps. Bucket utilization is T+1 stale by construction — re-tested on trade date by rule.")
        ]
    }
};
const STEP_OUTPUTS = {
    ...O0,
    ...O1,
    ...O2,
    ...O3
};
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "T");
__turbopack_context__.k.register(_c1, "X");
__turbopack_context__.k.register(_c2, "F");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/deepdive/OutputRegister.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LiveOutputRegister",
    ()=>LiveOutputRegister,
    "OutputRegister",
    ()=>OutputRegister,
    "StepOutputGrid",
    ()=>StepOutputGrid,
    "StepOutputModal",
    ()=>StepOutputModal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// Required-output register (workflow completeness per module ACTIVE_PROMPT)
// + step-output viewer modal showing each step's full analytical output per
// the Modular OS REF templates (port of design bundle concept-c-views.jsx).
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/CloseButton.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$FlagToQa$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/FlagToQa.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ModalBackdrop.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/use-modal-a11y.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$module$2d$steps$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/deepdive/module-steps.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$step$2d$notes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/deepdive/step-notes.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$step$2d$outputs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/deepdive/step-outputs.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/data.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/sev.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/reports/EvChip.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/pipeline/atoms.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$OutSections$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/deepdive/OutSections.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/engine/types.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
function LiveOutputRegister({ id, output, onOpenEvidence, defaultOpen = true }) {
    _s();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(defaultOpen);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "rounded border border-caos-accent/45 bg-caos-bg",
        "aria-label": `${id} live runtime output register`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>setOpen((value)=>!value),
                "aria-expanded": open,
                "aria-controls": `${id}-live-runtime-outputs`,
                className: "w-full px-3 py-2 flex items-center gap-2.5 text-left hover:bg-caos-elevated/40 transition-caos focus-ring",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs uppercase tracking-wider text-caos-accent whitespace-nowrap",
                        children: [
                            id,
                            " runtime output register · ",
                            output.sections.length,
                            " emitted section",
                            output.sections.length === 1 ? "" : "s"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 45,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                        children: "Live · persisted engine output"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 48,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "flex-1"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 51,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-caos-muted text-caos-xs",
                        "aria-hidden": "true",
                        children: open ? "▲" : "▼"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 52,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 38,
                columnNumber: 7
            }, this),
            open ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                id: `${id}-live-runtime-outputs`,
                className: "border-t border-caos-border p-3 flex flex-col gap-3",
                children: output.sections.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$OutSections$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OutSections"], {
                    sections: output.sections,
                    onOpenEvidence: onOpenEvidence
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                    lineNumber: 57,
                    columnNumber: 13
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    role: "note",
                    className: "text-caos-md text-caos-muted leading-snug",
                    children: "The engine emitted headline fields only; no structured runtime sections were persisted."
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                    lineNumber: 59,
                    columnNumber: 13
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 55,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
        lineNumber: 37,
        columnNumber: 5
    }, this);
}
_s(LiveOutputRegister, "pG0khZI24VrkSmCZcWM9qqrVMh4=");
_c = LiveOutputRegister;
function OutputRegister({ id, defaultOpen = true, onOpenEvidence }) {
    _s1();
    const steps = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$module$2d$steps$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODULE_STEPS"][id];
    const storageKey = "caos-deepdive-output-open:" + id;
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(defaultOpen);
    const [sel, setSel] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OutputRegister.useEffect": ()=>{
            try {
                const saved = localStorage.getItem(storageKey);
                setOpen(saved == null ? defaultOpen : saved === "1");
            } catch  {
                setOpen(defaultOpen);
            }
        }
    }["OutputRegister.useEffect"], [
        defaultOpen,
        storageKey
    ]);
    const toggleOpen = ()=>{
        const next = !open;
        if (open) setSel(null);
        setOpen(next);
        try {
            localStorage.setItem(storageKey, next ? "1" : "0");
        } catch  {}
    };
    if (!steps) return null;
    const n = (s)=>steps.filter((x)=>x[2] === s).length;
    const selStep = sel != null ? steps[sel] : null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rounded border border-caos-border bg-caos-bg",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: toggleOpen,
                "aria-expanded": open,
                "aria-controls": `${id}-required-outputs`,
                className: "w-full px-3 py-2 flex items-center gap-2.5 text-left hover:bg-caos-elevated/40 transition-caos",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs uppercase tracking-wider text-caos-muted whitespace-nowrap",
                        children: [
                            id,
                            " required outputs · ",
                            steps.length,
                            " workflow steps"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 108,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs whitespace-nowrap",
                        style: {
                            color: "var(--caos-success)"
                        },
                        children: [
                            n("ok"),
                            " produced"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 111,
                        columnNumber: 9
                    }, this),
                    n("warning") ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs whitespace-nowrap",
                        style: {
                            color: "var(--caos-warning)"
                        },
                        children: [
                            n("warning"),
                            " w/ limitation"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 112,
                        columnNumber: 25
                    }, this) : null,
                    n("gap") ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs whitespace-nowrap",
                        style: {
                            color: "var(--caos-critical-bright)"
                        },
                        children: [
                            n("gap"),
                            " gap logged"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 113,
                        columnNumber: 21
                    }, this) : null,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "flex-1"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 114,
                        columnNumber: 9
                    }, this),
                    open ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs text-caos-muted whitespace-nowrap",
                        children: "click a step to open its full output"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 115,
                        columnNumber: 17
                    }, this) : null,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-caos-muted text-caos-xs",
                        children: open ? "▲" : "▼"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 116,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 101,
                columnNumber: 7
            }, this),
            open ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                id: `${id}-required-outputs`,
                className: "grid grid-cols-1 gap-x-5 px-3 py-1.5 border-t border-caos-border xl:grid-cols-2",
                children: steps.map((s, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>setSel(sel === i ? null : i),
                        title: "View analytical output — " + s[1],
                        className: "group flex items-start gap-2 py-[3px] border-b border-caos-border/30 text-left transition-caos rounded-sm " + (sel === i ? "bg-caos-elevated/70" : "hover:bg-caos-elevated/40"),
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "mt-[3px] ml-1",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dot"], {
                                    sev: s[2] === "gap" ? "critical" : s[2]
                                }, void 0, false, {
                                    fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                    lineNumber: 127,
                                    columnNumber: 47
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                lineNumber: 127,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "tabular text-caos-2xs text-caos-muted w-[42px] shrink-0 mt-[1.5px] whitespace-nowrap",
                                children: s[0]
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                lineNumber: 128,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-caos-md leading-snug flex-1 text-caos-text",
                                children: [
                                    s[1],
                                    s[3] ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-caos-muted",
                                        children: [
                                            " — ",
                                            s[3]
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                        lineNumber: 131,
                                        columnNumber: 25
                                    }, this) : null
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                lineNumber: 129,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "mt-[2px] mr-1 shrink-0 transition-caos text-caos-xs " + (sel === i ? "text-caos-accent" : "text-caos-muted opacity-0 group-hover:opacity-100"),
                                children: "⤢"
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                lineNumber: 133,
                                columnNumber: 15
                            }, this)
                        ]
                    }, i, true, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 121,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 119,
                columnNumber: 9
            }, this) : null,
            selStep ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepOutputModal, {
                id: id,
                step: selStep,
                onClose: ()=>setSel(null),
                onOpenEvidence: onOpenEvidence
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 138,
                columnNumber: 18
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
        lineNumber: 100,
        columnNumber: 5
    }, this);
}
_s1(OutputRegister, "CJ9Aib59yBZVpUZhslLR9o1jrC8=");
_c1 = OutputRegister;
function stepSev(s) {
    return s[2] === "gap" ? "critical" : s[2] || "ok";
}
function cardPrefix(c) {
    const title = c.data?.sections[0]?.title || c.s[1] || "Untitled step";
    return title.split("·")[0].trim() || title;
}
function reportCards(cards) {
    const groups = new Map();
    cards.forEach((card)=>{
        const key = stepSev(card.s) + ":" + cardPrefix(card);
        groups.set(key, [
            ...groups.get(key) || [],
            card
        ]);
    });
    const out = [];
    groups.forEach((group, key)=>{
        if (group.length >= 3) {
            out.push({
                kind: "group",
                key,
                title: cardPrefix(group[0]),
                sev: stepSev(group[0].s),
                cards: group
            });
        } else {
            group.forEach((card)=>out.push({
                    kind: "single",
                    card
                }));
        }
    });
    return out;
}
function StepOutputGrid({ id, onOpenEvidence, mode = "dense" }) {
    const steps = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$module$2d$steps$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODULE_STEPS"][id];
    if (!steps) return null;
    const cards = steps.map((s)=>({
            s,
            data: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$step$2d$outputs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STEP_OUTPUTS"][id + ":" + s[1]],
            narr: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$step$2d$notes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STEP_NOTES"][id + ":" + s[1]]
        })).filter((c)=>c.data || c.narr);
    if (!cards.length) return null;
    const isSummary = mode === "summary";
    const cardCls = "deepdive-step-card rounded border border-caos-border bg-caos-panel/40 p-2 flex min-w-0 flex-col gap-2";
    const visibleCards = mode === "report" ? reportCards(cards) : cards.map((card)=>({
            kind: "single",
            card
        }));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "deepdive-step-grid flex flex-col gap-2",
        "data-mode": mode,
        "aria-label": `${id} workflow steps`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "tabular text-caos-xs font-semibold uppercase tracking-wider text-caos-text px-0.5",
                children: isSummary ? `${id} workflow step summary · ${cards.length} of ${steps.length} steps with notes` : `${id} workflow step outputs · detailed output for ${cards.length} of ${steps.length} steps`
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 195,
                columnNumber: 7
            }, this),
            isSummary ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
                className: "deepdive-step-sequence",
                "aria-label": `${id} sequential workflow summary`,
                children: cards.map(({ s, narr }, i)=>{
                    const sev = stepSev(s);
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: "deepdive-step-sequence__item",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "deepdive-step-sequence__rail",
                                "aria-hidden": "true",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dot"], {
                                    sev: sev
                                }, void 0, false, {
                                    fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                    lineNumber: 206,
                                    columnNumber: 83
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                lineNumber: 206,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "tabular text-caos-xs font-semibold text-caos-text",
                                children: s[0] !== "—" ? s[0] : String(i + 1).padStart(2, "0")
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                lineNumber: 207,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "min-w-0",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-caos-md font-semibold leading-snug text-caos-text",
                                        children: s[1]
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                        lineNumber: 209,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mt-0.5 text-caos-md leading-relaxed text-caos-text/90",
                                        children: [
                                            narr ? narr.body : "No narrative summary is available for this step.",
                                            narr?.ev && narr.ev.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "ml-1.5 inline-flex gap-1 align-middle",
                                                children: narr.ev.map((e)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EvChip"], {
                                                        id: e,
                                                        onOpen: onOpenEvidence
                                                    }, e, false, {
                                                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                                        lineNumber: 212,
                                                        columnNumber: 127
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                                lineNumber: 212,
                                                columnNumber: 51
                                            }, this) : null
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                        lineNumber: 210,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                lineNumber: 208,
                                columnNumber: 17
                            }, this)
                        ]
                    }, `${s[0]}-${s[1]}`, true, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 205,
                        columnNumber: 15
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 201,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "deepdive-step-cards",
                "data-mode": mode,
                children: visibleCards.map((item, i)=>{
                    if (item.kind === "group") {
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: cardCls,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-2 px-0.5",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dot"], {
                                            sev: item.sev
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                            lineNumber: 226,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-caos-md font-semibold text-caos-text leading-snug",
                                            children: item.title
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                            lineNumber: 227,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "tabular text-caos-2xs text-caos-muted ml-auto",
                                            children: [
                                                item.cards.length,
                                                " steps consolidated"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                            lineNumber: 228,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                    lineNumber: 225,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-caos-md text-caos-text/90 leading-relaxed px-0.5 flex flex-col gap-1",
                                    children: item.cards.map(({ s, narr }, j)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "tabular text-caos-2xs text-caos-muted mr-1",
                                                    children: s[0] !== "—" ? s[0] : String(j + 1).padStart(2, "0")
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                                    lineNumber: 233,
                                                    columnNumber: 23
                                                }, this),
                                                narr ? narr.body : s[1],
                                                narr?.ev && narr.ev.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "inline-flex gap-1 ml-1.5 align-middle",
                                                    children: narr.ev.map((e)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EvChip"], {
                                                            id: e,
                                                            onOpen: onOpenEvidence
                                                        }, e, false, {
                                                            fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                                            lineNumber: 235,
                                                            columnNumber: 129
                                                        }, this))
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                                    lineNumber: 235,
                                                    columnNumber: 53
                                                }, this) : null
                                            ]
                                        }, j, true, {
                                            fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                            lineNumber: 232,
                                            columnNumber: 21
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                    lineNumber: 230,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, item.key, true, {
                            fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                            lineNumber: 224,
                            columnNumber: 15
                        }, this);
                    }
                    const { s, data, narr } = item.card;
                    const sev = stepSev(s);
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: cardCls,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-2 px-0.5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dot"], {
                                        sev: sev
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                        lineNumber: 247,
                                        columnNumber: 17
                                    }, this),
                                    s[0] !== "—" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "tabular text-caos-2xs text-caos-muted shrink-0",
                                        children: s[0]
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                        lineNumber: 248,
                                        columnNumber: 33
                                    }, this) : null,
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-caos-md font-semibold text-caos-text leading-snug",
                                        children: s[1]
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                        lineNumber: 249,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                lineNumber: 246,
                                columnNumber: 15
                            }, this),
                            narr ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-caos-md text-caos-text/90 leading-relaxed px-0.5",
                                children: [
                                    narr.body,
                                    narr.ev && narr.ev.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "inline-flex gap-1 ml-1.5 align-middle",
                                        children: narr.ev.map((e)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EvChip"], {
                                                id: e,
                                                onOpen: onOpenEvidence
                                            }, e, false, {
                                                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                                lineNumber: 254,
                                                columnNumber: 124
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                        lineNumber: 254,
                                        columnNumber: 48
                                    }, this) : null
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                lineNumber: 252,
                                columnNumber: 17
                            }, this) : null,
                            data ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$OutSections$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OutSections"], {
                                sections: data.sections,
                                onOpenEvidence: onOpenEvidence
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                lineNumber: 257,
                                columnNumber: 23
                            }, this) : null
                        ]
                    }, i, true, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 245,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 220,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
        lineNumber: 194,
        columnNumber: 5
    }, this);
}
_c2 = StepOutputGrid;
// Report Studio exhibit that carries each module's output; snapshot is the
// catch-all committee tear-sheet.
const EXPORT_REPORT = {
    "CP-1B": "earnings",
    "CP-4": "covenant",
    "CP-4C": "covenant",
    "CP-MON": "monitor",
    "CP-6A": "memo",
    "CP-6E": "memo"
};
function collectStepEvidence(data, narrative) {
    const evidence = new Set();
    data?.sections.forEach((section)=>{
        if ("ev" in section) section.ev?.forEach((id)=>evidence.add(id));
        if (section.type === "flags") section.items.forEach((flag)=>flag.ev?.forEach((id)=>evidence.add(id)));
    });
    narrative?.ev?.forEach((id)=>evidence.add(id));
    return [
        ...evidence
    ];
}
function StepModalHeader({ id, code, name, status, severity, moduleName, onClose }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "h-10 shrink-0 px-3 flex items-center gap-2.5 border-b border-caos-border bg-caos-elevated/60",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xl text-caos-text whitespace-nowrap",
                children: [
                    id,
                    code !== "—" ? " · " + code : ""
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 296,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-caos-2xl font-semibold text-caos-text whitespace-nowrap",
                children: name
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 297,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tag"], {
                sev: severity,
                children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$module$2d$steps$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STEP_STATUS_TEXT"][status] || status
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 298,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-caos-md text-caos-muted truncate",
                children: moduleName
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 299,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1"
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 300,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-xs text-caos-muted whitespace-nowrap",
                title: "Seeded ATLF reference register — not a database run",
                children: "ATLF · SEEDED RUN #2641"
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 301,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CloseButton"], {
                onClick: onClose,
                size: "md",
                className: "ml-2"
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 302,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
        lineNumber: 295,
        columnNumber: 5
    }, this);
}
_c3 = StepModalHeader;
function StepNarrativeBlock({ narrative, onOpenEvidence }) {
    if (!narrative) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rounded border px-3 py-2.5",
        style: {
            borderColor: "color-mix(in srgb, var(--tranche-2l) 35%, transparent)",
            background: "color-mix(in srgb, var(--tranche-2l) 6%, transparent)"
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "tabular text-caos-xs uppercase tracking-wider text-caos-accent mb-1",
                children: "Analyst narrative"
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 311,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-caos-xl text-caos-text leading-relaxed",
                children: [
                    narrative.body,
                    narrative.ev?.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "inline-flex gap-1 ml-1.5 align-middle",
                        children: narrative.ev.map((evidenceId)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EvChip"], {
                                id: evidenceId,
                                onOpen: onOpenEvidence
                            }, evidenceId, false, {
                                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                lineNumber: 314,
                                columnNumber: 123
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 314,
                        columnNumber: 33
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 312,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
        lineNumber: 310,
        columnNumber: 5
    }, this);
}
_c4 = StepNarrativeBlock;
function StepAnalyticalOutput({ id, name, stepNote, data, narrative, onOpenEvidence }) {
    const fallback = stepNote ? `${name} — ${stepNote}. Registered to the ${id} output set.` : `${name} registered to the ${id} output set; no findings attached.`;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-0 overflow-auto border-r border-caos-border bg-caos-bg p-3 flex flex-col gap-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepNarrativeBlock, {
                narrative: narrative,
                onOpenEvidence: onOpenEvidence
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 326,
                columnNumber: 7
            }, this),
            data ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$OutSections$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OutSections"], {
                sections: data.sections,
                onOpenEvidence: onOpenEvidence
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 327,
                columnNumber: 15
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded border border-caos-border bg-caos-bg px-3 py-2.5 text-caos-lg text-caos-muted leading-relaxed",
                children: fallback
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 327,
                columnNumber: 90
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
        lineNumber: 325,
        columnNumber: 5
    }, this);
}
_c5 = StepAnalyticalOutput;
function MetadataRow({ label, value, accent = false }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex justify-between gap-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-caos-muted",
                children: label
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 333,
                columnNumber: 54
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: `tabular text-right ${accent ? "text-caos-accent" : ""}`,
                children: value
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 333,
                columnNumber: 102
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
        lineNumber: 333,
        columnNumber: 10
    }, this);
}
_c6 = MetadataRow;
function TemplateMetadata({ id, code, name, data }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "px-3 py-2.5 border-b border-caos-border",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5",
                children: "Template"
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 339,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-caos-md text-caos-text leading-relaxed",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MetadataRow, {
                        label: "REF file",
                        value: data?.ref || "REF_" + id,
                        accent: true
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 341,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MetadataRow, {
                        label: "Required output",
                        value: data?.out || name
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 342,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MetadataRow, {
                        label: "Workflow step",
                        value: code !== "—" ? code : "unnumbered"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 343,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 340,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
        lineNumber: 338,
        columnNumber: 5
    }, this);
}
_c7 = TemplateMetadata;
function ProductionMetadata({ id, status, severity, stepNote }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "px-3 py-2.5 border-b border-caos-border",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5",
                children: "Production"
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 352,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-caos-md text-caos-text leading-relaxed",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MetadataRow, {
                        label: "Module",
                        value: id,
                        accent: true
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 354,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex justify-between gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-caos-muted",
                                children: "Status"
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                lineNumber: 355,
                                columnNumber: 53
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "tabular whitespace-nowrap",
                                style: {
                                    color: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEV_COLOR"][severity]
                                },
                                children: (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$module$2d$steps$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STEP_STATUS_TEXT"][status] || status).toUpperCase()
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                                lineNumber: 355,
                                columnNumber: 100
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 355,
                        columnNumber: 9
                    }, this),
                    stepNote ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MetadataRow, {
                        label: "Note",
                        value: stepNote
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 356,
                        columnNumber: 21
                    }, this) : null,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MetadataRow, {
                        label: "Run",
                        value: "#2641 · Jun 10 · seeded"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 357,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 353,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
        lineNumber: 351,
        columnNumber: 5
    }, this);
}
_c8 = ProductionMetadata;
function StepEvidenceList({ evidence, onOpenEvidence }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "px-3 py-2.5 border-b border-caos-border",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5",
                children: [
                    "Evidence cited · ",
                    evidence.length
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 366,
                columnNumber: 7
            }, this),
            evidence.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-wrap gap-1",
                children: evidence.map((id)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EvChip"], {
                        id: id,
                        onOpen: onOpenEvidence
                    }, id, false, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 367,
                        columnNumber: 86
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 367,
                columnNumber: 26
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-caos-sm text-caos-muted",
                children: "No registered citations — synthesis or process output."
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 367,
                columnNumber: 148
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
        lineNumber: 365,
        columnNumber: 5
    }, this);
}
_c9 = StepEvidenceList;
function StepMetadataRail({ id, code, name, status, severity, stepNote, data, evidence, onOpenEvidence }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-0 overflow-auto",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TemplateMetadata, {
                id: id,
                code: code,
                name: name,
                data: data
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 377,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ProductionMetadata, {
                id: id,
                status: status,
                severity: severity,
                stepNote: stepNote
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 378,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepEvidenceList, {
                evidence: evidence,
                onOpenEvidence: onOpenEvidence
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 379,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-3 py-2.5 flex flex-col gap-1.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        href: `/reports?report=${EXPORT_REPORT[id] || "snapshot"}`,
                        className: "tabular text-caos-md whitespace-nowrap px-2.5 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring text-center",
                        title: `Open the ${id} output in its Report Studio exhibit`,
                        children: "OPEN IN MODULE EXPORT"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 381,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$FlagToQa$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FlagToQa"], {
                        issuerId: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ATLF_REFERENCE_ISSUER_ID"],
                        moduleId: id,
                        stepRef: (code !== "—" ? code + " " : "") + name
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                        lineNumber: 382,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                lineNumber: 380,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
        lineNumber: 376,
        columnNumber: 5
    }, this);
}
_c10 = StepMetadataRail;
function StepOutputModal({ id, step, onClose, onOpenEvidence }) {
    _s2();
    const code = step[0] || "—", name = step[1] || "", status = step[2] || "ok", stepNote = step[3];
    const data = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$step$2d$outputs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STEP_OUTPUTS"][id + ":" + name];
    const narr = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$step$2d$notes$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STEP_NOTES"][id + ":" + name];
    const meta = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODULES"].find((m)=>m.id === id);
    const panelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useModalA11y"])(onClose);
    const evs = collectStepEvidence(data, narr);
    const sevKey = status === "gap" ? "critical" : status;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ModalBackdrop"], {
        onClose: onClose,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            ref: panelRef,
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "Module output register",
            className: "caos-enter bg-caos-panel border border-caos-border rounded-md flex flex-col overflow-hidden overscroll-contain",
            style: {
                width: 1080,
                maxWidth: "94vw",
                maxHeight: "min(840px, 92vh)",
                boxShadow: "var(--shadow-modal)"
            },
            onClick: (e)=>e.stopPropagation(),
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepModalHeader, {
                    id: id,
                    code: code,
                    name: name,
                    status: status,
                    severity: sevKey,
                    moduleName: meta?.name,
                    onClose: onClose
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                    lineNumber: 419,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex-1 min-h-0 grid grid-cols-[1fr_272px]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepAnalyticalOutput, {
                            id: id,
                            name: name,
                            stepNote: stepNote,
                            data: data,
                            narrative: narr,
                            onOpenEvidence: onOpenEvidence
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                            lineNumber: 421,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepMetadataRail, {
                            id: id,
                            code: code,
                            name: name,
                            status: status,
                            severity: sevKey,
                            stepNote: stepNote,
                            data: data,
                            evidence: evs,
                            onOpenEvidence: onOpenEvidence
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                            lineNumber: 422,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
                    lineNumber: 420,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
            lineNumber: 410,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/deepdive/OutputRegister.tsx",
        lineNumber: 409,
        columnNumber: 5
    }, this);
}
_s2(StepOutputModal, "NzS0XIvlwCI5xOhK6tXUvdRvvIY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useModalA11y"]
    ];
});
_c11 = StepOutputModal;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c10, _c11;
__turbopack_context__.k.register(_c, "LiveOutputRegister");
__turbopack_context__.k.register(_c1, "OutputRegister");
__turbopack_context__.k.register(_c2, "StepOutputGrid");
__turbopack_context__.k.register(_c3, "StepModalHeader");
__turbopack_context__.k.register(_c4, "StepNarrativeBlock");
__turbopack_context__.k.register(_c5, "StepAnalyticalOutput");
__turbopack_context__.k.register(_c6, "MetadataRow");
__turbopack_context__.k.register(_c7, "TemplateMetadata");
__turbopack_context__.k.register(_c8, "ProductionMetadata");
__turbopack_context__.k.register(_c9, "StepEvidenceList");
__turbopack_context__.k.register(_c10, "StepMetadataRail");
__turbopack_context__.k.register(_c11, "StepOutputModal");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/deepdive/ModuleCharts.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MODULE_CHARTS",
    ()=>MODULE_CHARTS,
    "ModuleCharts",
    ()=>ModuleCharts
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$charts$2f$SemanticVisualization$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/charts/SemanticVisualization.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/chart-colors.ts [app-client] (ecmascript)");
"use client";
;
;
;
const MC_AXIS = {
    x: {
        title: false
    },
    y: {
        title: false
    }
};
const MODULE_CHARTS = {
    /* ---- CP-1 · Financial normalization ---- */ "CP-1": [
        {
            kind: "bar",
            title: "CP-1-07 · Adj. vs reported EBITDA",
            unit: "$M",
            sourceIds: [
                "CP-1:K-07",
                "E-09"
            ],
            accessibleSummary: "Adjusted EBITDA rises from $358M in FY23 to $421M LTM, while reported pre-add-back EBITDA rises from $318M to $344M; the LTM gap is $77M.",
            columns: [
                {
                    key: "fy",
                    label: "Period"
                },
                {
                    key: "s",
                    label: "Measure"
                },
                {
                    key: "v",
                    label: "$M"
                }
            ],
            h: 168,
            note: "Gap = add-backs — 18.2% of adj. in LTM (E-09)",
            spec: {
                type: "interval",
                data: [
                    {
                        fy: "FY23",
                        s: "Adj. EBITDA",
                        v: 358
                    },
                    {
                        fy: "FY24",
                        s: "Adj. EBITDA",
                        v: 392
                    },
                    {
                        fy: "FY25",
                        s: "Adj. EBITDA",
                        v: 415
                    },
                    {
                        fy: "LTM",
                        s: "Adj. EBITDA",
                        v: 421
                    },
                    {
                        fy: "FY23",
                        s: "Reported (pre add-back)",
                        v: 318
                    },
                    {
                        fy: "FY24",
                        s: "Reported (pre add-back)",
                        v: 329
                    },
                    {
                        fy: "FY25",
                        s: "Reported (pre add-back)",
                        v: 341
                    },
                    {
                        fy: "LTM",
                        s: "Reported (pre add-back)",
                        v: 344
                    }
                ],
                encode: {
                    x: "fy",
                    y: "v",
                    color: "s"
                },
                transform: [
                    {
                        type: "dodgeX"
                    }
                ],
                scale: {
                    color: {
                        domain: [
                            "Adj. EBITDA",
                            "Reported (pre add-back)"
                        ],
                        range: [
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].accent,
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].eq
                        ]
                    }
                },
                axis: MC_AXIS,
                legend: {
                    color: {
                        position: "top"
                    }
                },
                labels: [
                    {
                        text: "v",
                        position: "top",
                        fontSize: 10.5,
                        fontWeight: 600,
                        transform: [
                            {
                                type: "overlapHide"
                            }
                        ]
                    }
                ]
            }
        },
        {
            kind: "line",
            title: "CP-1-09 · Net leverage",
            unit: "x",
            sourceIds: [
                "CP-1:K-09"
            ],
            accessibleSummary: "Adjusted net leverage declines from 6.7x in FY23 to 5.68x LTM, with each successive period lower than the prior one.",
            columns: [
                {
                    key: "fy",
                    label: "Period"
                },
                {
                    key: "v",
                    label: "Net leverage (x)"
                }
            ],
            h: 168,
            note: "Deleveraging from EBITDA growth — net debt flat ~$2.4B",
            spec: {
                type: "view",
                data: [
                    {
                        fy: "FY23",
                        v: 6.7
                    },
                    {
                        fy: "FY24",
                        v: 6.0
                    },
                    {
                        fy: "FY25",
                        v: 5.7
                    },
                    {
                        fy: "LTM",
                        v: 5.68
                    }
                ],
                children: [
                    {
                        type: "line",
                        encode: {
                            x: "fy",
                            y: "v"
                        },
                        style: {
                            stroke: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].teal,
                            lineWidth: 2
                        }
                    },
                    {
                        type: "point",
                        encode: {
                            x: "fy",
                            y: "v"
                        },
                        style: {
                            fill: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].teal
                        },
                        labels: [
                            {
                                text: (d)=>d.v.toFixed(2).replace(/0$/, "") + "x",
                                fontSize: 10.5,
                                fontWeight: 600,
                                transform: [
                                    {
                                        type: "overlapDodgeY"
                                    }
                                ]
                            }
                        ]
                    }
                ],
                scale: {
                    y: {
                        domain: [
                            5,
                            7
                        ]
                    }
                },
                axis: MC_AXIS
            }
        }
    ],
    /* ---- CP-1A · Business profile ---- */ "CP-1A": [
        {
            kind: "stacked-bar",
            title: "CP-1A-06 · Segment mix — revenue vs gross profit",
            unit: "%",
            sourceIds: [
                "CP-1A:06",
                "E-12",
                "E-15"
            ],
            accessibleSummary: "Aftermarket and Services represents 23% of revenue but 44% of gross profit; Drivetrain is 46% of revenue and 34% of gross profit.",
            columns: [
                {
                    key: "m",
                    label: "Measure"
                },
                {
                    key: "seg",
                    label: "Segment"
                },
                {
                    key: "v",
                    label: "Share (%)"
                }
            ],
            h: 132,
            note: "Aftermarket: 23% of revenue → 44% of gross profit. GP split ex-aftermarket pro-rata (mock).",
            spec: {
                type: "interval",
                data: [
                    {
                        m: "Revenue",
                        seg: "Drivetrain",
                        v: 46
                    },
                    {
                        m: "Revenue",
                        seg: "Fluid Systems",
                        v: 31
                    },
                    {
                        m: "Revenue",
                        seg: "Aftermarket & Services",
                        v: 23
                    },
                    {
                        m: "Gross profit",
                        seg: "Drivetrain",
                        v: 34
                    },
                    {
                        m: "Gross profit",
                        seg: "Fluid Systems",
                        v: 22
                    },
                    {
                        m: "Gross profit",
                        seg: "Aftermarket & Services",
                        v: 44
                    }
                ],
                encode: {
                    x: "m",
                    y: "v",
                    color: "seg"
                },
                transform: [
                    {
                        type: "stackY"
                    }
                ],
                coordinate: {
                    transform: [
                        {
                            type: "transpose"
                        }
                    ]
                },
                scale: {
                    color: {
                        domain: [
                            "Drivetrain",
                            "Fluid Systems",
                            "Aftermarket & Services"
                        ],
                        range: [
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].slateDeep,
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].slate,
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].teal
                        ]
                    }
                },
                axis: {
                    x: {
                        title: false
                    },
                    y: false
                },
                legend: {
                    color: {
                        position: "top"
                    }
                },
                labels: [
                    {
                        text: (d)=>d.v + "%",
                        position: "inside",
                        fontSize: 10.5,
                        fontWeight: 600,
                        transform: [
                            {
                                type: "contrastReverse"
                            },
                            {
                                type: "overflowHide"
                            }
                        ]
                    }
                ]
            }
        }
    ],
    /* ---- CP-1B · Earnings monitor ---- */ "CP-1B": [
        {
            kind: "bar",
            title: "CP-1B-06 · Revenue & Adj. EBITDA — quarterly",
            unit: "$M",
            sourceIds: [
                "CP-1B:T6",
                "E-58",
                "G-02"
            ],
            accessibleSummary: "Quarterly revenue ranges from $688M to $715M and adjusted EBITDA from $103M to $108M; Q4-25 is a derived period.",
            columns: [
                {
                    key: "q",
                    label: "Quarter"
                },
                {
                    key: "s",
                    label: "Measure"
                },
                {
                    key: "v",
                    label: "$M"
                }
            ],
            h: 168,
            note: "* Q4-25 derived period (gap G-02)",
            spec: {
                type: "interval",
                data: [
                    {
                        q: "Q2-25",
                        s: "Revenue",
                        v: 688
                    },
                    {
                        q: "Q3-25",
                        s: "Revenue",
                        v: 701
                    },
                    {
                        q: "Q4-25*",
                        s: "Revenue",
                        v: 697
                    },
                    {
                        q: "Q1-26",
                        s: "Revenue",
                        v: 715
                    },
                    {
                        q: "Q2-25",
                        s: "Adj. EBITDA",
                        v: 103
                    },
                    {
                        q: "Q3-25",
                        s: "Adj. EBITDA",
                        v: 106
                    },
                    {
                        q: "Q4-25*",
                        s: "Adj. EBITDA",
                        v: 104
                    },
                    {
                        q: "Q1-26",
                        s: "Adj. EBITDA",
                        v: 108
                    }
                ],
                encode: {
                    x: "q",
                    y: "v",
                    color: "s"
                },
                transform: [
                    {
                        type: "dodgeX"
                    }
                ],
                scale: {
                    color: {
                        domain: [
                            "Revenue",
                            "Adj. EBITDA"
                        ],
                        range: [
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].accent,
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].teal
                        ]
                    }
                },
                axis: MC_AXIS,
                legend: {
                    color: {
                        position: "top"
                    }
                },
                labels: [
                    {
                        text: "v",
                        position: "top",
                        fontSize: 10.5,
                        fontWeight: 600,
                        transform: [
                            {
                                type: "overlapHide"
                            }
                        ]
                    }
                ]
            }
        },
        {
            kind: "line",
            title: "CP-1B-06 · Aftermarket mix & book-to-bill — quarterly",
            unit: "% / x10",
            sourceIds: [
                "CP-1B:T6",
                "E-58"
            ],
            accessibleSummary: "Aftermarket mix increases from 22.4% to 23.4% over four quarters; book-to-bill dips to 0.98x in derived Q4-25 before rising to 1.06x in Q1-26.",
            columns: [
                {
                    key: "q",
                    label: "Quarter"
                },
                {
                    key: "s",
                    label: "Measure"
                },
                {
                    key: "v",
                    label: "Chart value"
                }
            ],
            h: 168,
            note: "Mix grind +100bps over 4 quarters — most thesis-supportive trend",
            spec: {
                type: "view",
                data: [
                    {
                        q: "Q2-25",
                        s: "Aftermarket mix (%)",
                        v: 22.4
                    },
                    {
                        q: "Q3-25",
                        s: "Aftermarket mix (%)",
                        v: 22.8
                    },
                    {
                        q: "Q4-25*",
                        s: "Aftermarket mix (%)",
                        v: 23.1
                    },
                    {
                        q: "Q1-26",
                        s: "Aftermarket mix (%)",
                        v: 23.4
                    },
                    {
                        q: "Q2-25",
                        s: "Book-to-bill (×10)",
                        v: 10.2
                    },
                    {
                        q: "Q3-25",
                        s: "Book-to-bill (×10)",
                        v: 10.4
                    },
                    {
                        q: "Q4-25*",
                        s: "Book-to-bill (×10)",
                        v: 9.8
                    },
                    {
                        q: "Q1-26",
                        s: "Book-to-bill (×10)",
                        v: 10.6
                    }
                ],
                children: [
                    {
                        type: "line",
                        encode: {
                            x: "q",
                            y: "v",
                            color: "s"
                        }
                    },
                    {
                        type: "point",
                        encode: {
                            x: "q",
                            y: "v",
                            color: "s"
                        }
                    }
                ],
                scale: {
                    color: {
                        domain: [
                            "Aftermarket mix (%)",
                            "Book-to-bill (×10)"
                        ],
                        range: [
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].teal,
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].warning
                        ]
                    }
                },
                axis: MC_AXIS,
                legend: {
                    color: {
                        position: "top"
                    }
                }
            }
        }
    ],
    /* ---- CP-1C · Peer benchmarking ---- */ "CP-1C": [
        {
            kind: "scatter",
            title: "CP-1C-04C · Peer map — EBITDA margin vs spread",
            unit: "% / bps",
            sourceIds: [
                "CP-1C:04C",
                "MKT"
            ],
            accessibleSummary: "Atlas Forge plots at a 15.0% EBITDA margin and 388bps discount margin; Tarn is the widest-spread peer at 577bps and is marked as an excluded distressed outlier.",
            columns: [
                {
                    key: "name",
                    label: "Issuer"
                },
                {
                    key: "mgn",
                    label: "EBITDA margin (%)"
                },
                {
                    key: "dm",
                    label: "DM (bps)"
                },
                {
                    key: "grp",
                    label: "Peer group"
                }
            ],
            h: 220,
            note: "Up-left = rich, down-right = cheap. Tarn excluded from median (distressed outlier).",
            spec: {
                type: "point",
                data: [
                    {
                        name: "Atlas Forge ◆",
                        mgn: 15.0,
                        dm: 388,
                        grp: "Subject"
                    },
                    {
                        name: "Forgeline",
                        mgn: 13.8,
                        dm: 352,
                        grp: "Peer"
                    },
                    {
                        name: "Karst",
                        mgn: 12.1,
                        dm: 459,
                        grp: "Peer"
                    },
                    {
                        name: "Veldt",
                        mgn: 16.2,
                        dm: 291,
                        grp: "Peer"
                    },
                    {
                        name: "Ironvale",
                        mgn: 14.1,
                        dm: 327,
                        grp: "Peer"
                    },
                    {
                        name: "Cascadia",
                        mgn: 13.2,
                        dm: 341,
                        grp: "Peer"
                    },
                    {
                        name: "Tarn (excl.)",
                        mgn: 11.4,
                        dm: 577,
                        grp: "Excluded outlier"
                    }
                ],
                encode: {
                    x: "mgn",
                    y: "dm",
                    color: "grp"
                },
                scale: {
                    x: {
                        domain: [
                            10.5,
                            17
                        ]
                    },
                    y: {
                        domain: [
                            250,
                            620
                        ]
                    },
                    color: {
                        domain: [
                            "Subject",
                            "Peer",
                            "Excluded outlier"
                        ],
                        range: [
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].accent,
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].muted,
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].warning
                        ]
                    }
                },
                axis: {
                    x: {
                        title: "EBITDA margin (%)"
                    },
                    y: {
                        title: "DM (bps)"
                    }
                },
                legend: {
                    color: {
                        position: "top"
                    }
                },
                style: {
                    r: 4,
                    fillOpacity: 0.95
                },
                labels: [
                    {
                        text: "name",
                        fontSize: 10.5,
                        fontWeight: 600,
                        transform: [
                            {
                                type: "overlapDodgeY"
                            }
                        ]
                    }
                ]
            }
        }
    ],
    /* ---- CP-3 · Relative value ---- */ "CP-3": [
        {
            kind: "bar",
            title: "CP-3-05 · Excess spread vs fair-band midpoint",
            unit: "bps",
            sourceIds: [
                "CP-3:05",
                "MKT"
            ],
            accessibleSummary: "The subject instrument is 56bps wide of fair value and the module note records a rank of 2 of 7 in the full set; Karst is 24bps rich.",
            columns: [
                {
                    key: "name",
                    label: "Instrument"
                },
                {
                    key: "v",
                    label: "Excess spread (bps)"
                },
                {
                    key: "grp",
                    label: "Classification"
                }
            ],
            h: 196,
            note: "Positive = trades wide of fair value (cheap). Subject ranks 2/7.",
            spec: {
                type: "interval",
                data: [
                    {
                        name: "ATLF 2L TL '31 ◆",
                        v: 56,
                        grp: "Subject"
                    },
                    {
                        name: "Cascadia 2L TL '30",
                        v: 51,
                        grp: "Cheap"
                    },
                    {
                        name: "Forgeline TLB '30",
                        v: 15,
                        grp: "Cheap"
                    },
                    {
                        name: "Ironvale TLB '29",
                        v: 10,
                        grp: "Cheap"
                    },
                    {
                        name: "Veldt TLB '30",
                        v: -2,
                        grp: "Rich"
                    },
                    {
                        name: "Karst TLB '29",
                        v: -24,
                        grp: "Rich"
                    }
                ],
                encode: {
                    x: "name",
                    y: "v",
                    color: "grp"
                },
                coordinate: {
                    transform: [
                        {
                            type: "transpose"
                        }
                    ]
                },
                transform: [
                    {
                        type: "sortX",
                        by: "y",
                        reverse: true
                    }
                ],
                scale: {
                    color: {
                        domain: [
                            "Subject",
                            "Cheap",
                            "Rich"
                        ],
                        range: [
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].accent,
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].success,
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].critical
                        ]
                    }
                },
                axis: {
                    x: {
                        title: false
                    },
                    y: {
                        title: false,
                        labelFormatter: (d)=>d > 0 ? "+" + d : String(d)
                    }
                },
                legend: {
                    color: {
                        position: "top"
                    }
                },
                labels: [
                    {
                        text: (d)=>d.v > 0 ? "+" + d.v : String(d.v),
                        position: "outside",
                        fontSize: 10.5,
                        fontWeight: 600,
                        transform: [
                            {
                                type: "exceedAdjust"
                            }
                        ]
                    }
                ]
            }
        }
    ]
};
function ModuleCharts({ id }) {
    const defs = MODULE_CHARTS[id];
    if (!defs) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "module-chart-grid",
        children: defs.map((c, i)=>{
            const { data: chartData = [], ...chart } = c.spec;
            const data = chartData;
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$charts$2f$SemanticVisualization$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SemanticVisualization"], {
                height: c.h || 180,
                spec: {
                    kind: c.kind,
                    title: c.title,
                    unit: c.unit,
                    sourceIds: c.sourceIds,
                    accessibleSummary: c.accessibleSummary,
                    note: c.note,
                    status: {
                        label: "Reference fixture",
                        tone: "idle"
                    },
                    data,
                    tabularFallback: {
                        label: `${c.title} data`,
                        columns: c.columns,
                        data
                    },
                    chart
                }
            }, i, false, {
                fileName: "[project]/src/components/deepdive/ModuleCharts.tsx",
                lineNumber: 166,
                columnNumber: 11
            }, this);
        })
    }, void 0, false, {
        fileName: "[project]/src/components/deepdive/ModuleCharts.tsx",
        lineNumber: 161,
        columnNumber: 5
    }, this);
}
_c = ModuleCharts;
var _c;
__turbopack_context__.k.register(_c, "ModuleCharts");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/deepdive/tabs.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CovenantsTab",
    ()=>CovenantsTab,
    "DebateTab",
    ()=>DebateTab,
    "ModuleView",
    ()=>ModuleView,
    "RecoveryTab",
    ()=>RecoveryTab
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// Bespoke deep-dive tabs: CP-6A adversarial debate, CP-3B recovery waterfall,
// CP-4/4C covenants — plus the generic module output view
// (port of design bundle concept-c-app.jsx + concept-c-views.jsx ModuleView).
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/reports/deal.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$module$2d$outputs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/deepdive/module-outputs.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/data.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/sev.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/reports/EvChip.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$evidence$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/reports/evidence.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/pipeline/atoms.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/StatCard.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SectionHeader$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/SectionHeader.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/format.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$charts$2f$SemanticVisualization$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/charts/SemanticVisualization.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/chart-colors.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$OutSections$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/deepdive/OutSections.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$OutputRegister$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/deepdive/OutputRegister.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$ModuleCharts$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/deepdive/ModuleCharts.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
const PERSONA = {
    BULL: {
        color: "var(--caos-success)",
        glyph: "▲",
        label: "Bull Analyst"
    },
    BEAR: {
        color: "var(--caos-critical-bright)",
        glyph: "▼",
        label: "Bear Analyst"
    },
    CHAIR: {
        color: "var(--caos-accent)",
        glyph: "⚖",
        label: "IC Chair"
    },
    RV: {
        color: "var(--caos-success)",
        glyph: "▲",
        label: "RV Trader"
    },
    COMPLIANCE: {
        color: "var(--caos-critical-bright)",
        glyph: "▼",
        label: "Compliance"
    },
    CIO: {
        color: "var(--caos-accent)",
        glyph: "⚖",
        label: "CIO"
    }
};
const DEBATE_CFG = {
    "CP-6A": {
        id: "CP-6A",
        data: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEBATE"],
        thesisCode: "CP-6A-02",
        matrixTitle: "IC Chair · Evidence Weighting & Resolution Matrix",
        matrixCode: "CP-6A-06 / 07",
        weightHeader: "Weighting (bull ◂ ▸ bear)",
        verdictHeader: "Chair verdict",
        proLabel: "bull",
        conLabel: "bear"
    },
    "CP-6E": {
        id: "CP-6E",
        data: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEBATE_6E"],
        thesisCode: "CP-6E-02",
        matrixTitle: "CIO · Allocation Weighting & Decision Matrix",
        matrixCode: "CP-6E-06 / 07",
        weightHeader: "Weighting (RV ◂ ▸ compliance)",
        verdictHeader: "CIO ruling",
        proLabel: "RV",
        conLabel: "compliance"
    }
};
const TRANCHE = {
    "1l": "var(--tranche-1l)",
    "2l": "var(--tranche-2l)",
    unsec: "var(--tranche-unsec)",
    sub: "var(--tranche-sub)",
    eq: "var(--tranche-eq)"
};
// The module's conclusion is reliably its final text section ("Overall … view",
// "Clearance decision", "CIO final memo", …). Promote it to a lead block so the
// view reads like a report — takeaway first, supporting work below.
const LEAD_TITLE = /overall|view|conclusion|summary|memo|clearance|readiness|selection/i;
function DebateTab({ onOpenEvidence, layout = "report", variant = "CP-6A" }) {
    const cfg = DEBATE_CFG[variant];
    const d = cfg.data;
    if (layout === "summary") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "p-3 flex flex-col gap-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "bg-caos-bg px-3 py-2.5",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1",
                            children: [
                                cfg.thesisCode,
                                " · thesis"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                            lineNumber: 76,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-caos-xl text-caos-text leading-relaxed",
                            children: d.thesis
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                            lineNumber: 77,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                    lineNumber: 75,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded border border-caos-accent/40 bg-caos-bg px-3 py-2.5",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "tabular text-caos-xs uppercase tracking-wider text-caos-accent mb-1",
                            children: cfg.verdictHeader
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                            lineNumber: 80,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-caos-xl text-caos-text leading-relaxed",
                            children: d.bias
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                            lineNumber: 81,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-1.5 text-caos-md text-caos-text/90 leading-relaxed",
                            children: d.memo
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                            lineNumber: 82,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                    lineNumber: 79,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/deepdive/tabs.tsx",
            lineNumber: 74,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-3 flex flex-col gap-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-caos-bg px-3 py-2.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1",
                        children: [
                            cfg.thesisCode,
                            " · Pre-debate thesis map"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                        lineNumber: 90,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-caos-xl text-caos-text leading-relaxed",
                        children: d.thesis
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                        lineNumber: 91,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 89,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]",
                children: d.rounds.map((r, i)=>{
                    const p = PERSONA[r.who];
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded border border-caos-border bg-caos-bg flex flex-col",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "px-3 py-2 border-b border-caos-border flex items-center gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-caos-2xl",
                                        style: {
                                            color: p.color
                                        },
                                        children: p.glyph
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                        lineNumber: 100,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-caos-2xl font-semibold",
                                        style: {
                                            color: p.color
                                        },
                                        children: p.label
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                        lineNumber: 101,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted ml-auto",
                                        children: r.phase
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                        lineNumber: 102,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                lineNumber: 99,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "p-3 flex flex-col gap-2.5",
                                children: r.points.map((pt, j)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "tabular text-caos-2xs mt-px shrink-0",
                                                style: {
                                                    color: p.color
                                                },
                                                children: String(j + 1).padStart(2, "0")
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                lineNumber: 107,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-caos-lg text-caos-text leading-relaxed",
                                                        children: pt.text
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                        lineNumber: 109,
                                                        columnNumber: 23
                                                    }, this),
                                                    pt.ev.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "inline-flex gap-1 ml-1.5 align-middle",
                                                        children: pt.ev.map((e)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EvChip"], {
                                                                id: e,
                                                                onOpen: onOpenEvidence
                                                            }, e, false, {
                                                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                                lineNumber: 112,
                                                                columnNumber: 45
                                                            }, this))
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                        lineNumber: 111,
                                                        columnNumber: 25
                                                    }, this) : null
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                lineNumber: 108,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, j, true, {
                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                        lineNumber: 106,
                                        columnNumber: 19
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                lineNumber: 104,
                                columnNumber: 15
                            }, this)
                        ]
                    }, i, true, {
                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                        lineNumber: 98,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 94,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded border border-caos-border bg-caos-bg",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SectionHeader$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SectionHeader"], {
                        title: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-caos-accent",
                                    children: "⚖"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                                    lineNumber: 125,
                                    columnNumber: 33
                                }, this),
                                " ",
                                cfg.matrixTitle
                            ]
                        }, void 0, true),
                        right: cfg.matrixCode
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                        lineNumber: 125,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "overflow-x-auto",
                        tabIndex: 0,
                        "aria-label": `${cfg.matrixTitle} table`,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "min-w-[760px]",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid grid-cols-[minmax(180px,1.1fr)_minmax(190px,1fr)_minmax(220px,1.4fr)_120px] gap-x-3 px-3 h-7 items-center border-b border-caos-border",
                                    children: [
                                        "Contested claim",
                                        cfg.weightHeader,
                                        cfg.verdictHeader,
                                        "Evidence"
                                    ].map((h)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "tabular text-caos-xs uppercase tracking-wider text-caos-muted",
                                            children: h
                                        }, h, false, {
                                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                                            lineNumber: 130,
                                            columnNumber: 17
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                                    lineNumber: 128,
                                    columnNumber: 13
                                }, this),
                                d.weighting.map((w, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid grid-cols-[minmax(180px,1.1fr)_minmax(190px,1fr)_minmax(220px,1.4fr)_120px] gap-x-3 px-3 py-1.5 items-center border-b border-caos-border/50 hover:bg-caos-elevated/50 transition-caos",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-caos-lg text-caos-text leading-snug",
                                                children: w.claim
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                lineNumber: 135,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "flex items-center gap-1.5",
                                                "aria-label": `${cfg.proLabel} ${(w.bull * 100).toFixed(0)} versus ${cfg.conLabel} ${(w.bear * 100).toFixed(0)}`,
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "tabular text-caos-xs flex items-center gap-0.5",
                                                        style: {
                                                            color: "var(--caos-success)"
                                                        },
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                "aria-hidden": "true",
                                                                children: "▲"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                                lineNumber: 137,
                                                                columnNumber: 125
                                                            }, this),
                                                            (w.bull * 100).toFixed(0)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                        lineNumber: 137,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "flex-1 h-[5px] rounded-full overflow-hidden flex",
                                                        style: {
                                                            background: "var(--caos-border)"
                                                        },
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                style: {
                                                                    width: w.bull * 100 + "%",
                                                                    background: "var(--caos-success)"
                                                                }
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                                lineNumber: 139,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                style: {
                                                                    width: w.bear * 100 + "%",
                                                                    background: "var(--caos-critical)"
                                                                }
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                                lineNumber: 140,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                        lineNumber: 138,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "tabular text-caos-xs flex items-center gap-0.5",
                                                        style: {
                                                            color: "var(--caos-critical-bright)"
                                                        },
                                                        children: [
                                                            (w.bear * 100).toFixed(0),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                "aria-hidden": "true",
                                                                children: "▼"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                                lineNumber: 142,
                                                                columnNumber: 160
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                        lineNumber: 142,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                lineNumber: 136,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-caos-md leading-snug",
                                                style: {
                                                    color: w.lean === "pro" ? "var(--caos-success)" : w.lean === "con" ? "var(--caos-critical-bright)" : "var(--caos-muted)"
                                                },
                                                children: w.verdict
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                lineNumber: 144,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "flex flex-wrap gap-1",
                                                children: w.ev.split(" · ").map((tok)=>{
                                                    const eid = tok.split(" ")[0];
                                                    return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$evidence$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EVIDENCE"][eid] ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EvChip"], {
                                                        id: eid,
                                                        onOpen: onOpenEvidence
                                                    }, eid, false, {
                                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                        lineNumber: 149,
                                                        columnNumber: 25
                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "tabular text-caos-xs text-caos-accent",
                                                        children: tok
                                                    }, tok, false, {
                                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                        lineNumber: 150,
                                                        columnNumber: 25
                                                    }, this);
                                                })
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                lineNumber: 145,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, i, true, {
                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                        lineNumber: 134,
                                        columnNumber: 15
                                    }, this))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                            lineNumber: 127,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                        lineNumber: 126,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 124,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$OutputRegister$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OutputRegister"], {
                id: cfg.id,
                defaultOpen: false,
                onOpenEvidence: onOpenEvidence
            }, cfg.id + layout, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 158,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/tabs.tsx",
        lineNumber: 88,
        columnNumber: 5
    }, this);
}
_c = DebateTab;
/* ---------- Recovery tab ---------- */ function recoveries(ev) {
    const cl1 = 1970, cl2 = 900, sub = 400;
    return {
        "1l": Math.min(1, ev / cl1),
        "2l": Math.min(1, Math.max(0, ev - cl1) / cl2),
        sub: Math.min(1, Math.max(0, ev - cl1 - cl2) / sub)
    };
}
/* G2 v5 specs (antv-g2-chart skill) — static data, module-level so refs stay stable */ const TR_LABELS = {
    "1l": "1L (RCF+TLB)",
    "2l": "2L TL ◆",
    sub: "Sub Notes"
};
const RECOVERY_CHART_DATA = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RECOVERY"].flatMap(_c1 = (s)=>{
    const r = recoveries(s.ev);
    return [
        "1l",
        "2l",
        "sub"
    ].map((k)=>({
            scenario: s.scen,
            tranche: TR_LABELS[k],
            rec: Math.round(r[k] * 100)
        }));
});
_c2 = RECOVERY_CHART_DATA;
const RECOVERY_CHART_SPEC = {
    type: "interval",
    encode: {
        x: "scenario",
        y: "rec",
        color: "tranche"
    },
    transform: [
        {
            type: "dodgeX"
        }
    ],
    coordinate: {
        transform: [
            {
                type: "transpose"
            }
        ]
    },
    scale: {
        y: {
            domain: [
                0,
                100
            ]
        },
        color: {
            domain: Object.values(TR_LABELS),
            range: [
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TRANCHE_HEX"]["1l"],
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TRANCHE_HEX"]["2l"],
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TRANCHE_HEX"].sub
            ]
        }
    },
    axis: {
        x: {
            title: false
        },
        y: {
            title: false,
            labelFormatter: (d)=>d.toFixed(0) + "%"
        }
    },
    legend: {
        color: {
            position: "top"
        }
    },
    labels: [
        {
            text: (d)=>d.rec.toFixed(0) + "%",
            position: "inside",
            fontSize: 10.5,
            fontWeight: 600,
            transform: [
                {
                    type: "contrastReverse"
                },
                {
                    type: "overflowHide"
                }
            ]
        }
    ]
};
const CAPSTACK_CHART_DATA = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAPSTACK"].map(_c3 = (c)=>({
        slot: "stack",
        cls: c.cls,
        claim: c.claim
    }));
_c4 = CAPSTACK_CHART_DATA;
const CAPSTACK_CHART_SPEC = {
    type: "interval",
    encode: {
        x: "slot",
        y: "claim",
        color: "cls"
    },
    transform: [
        {
            type: "stackY"
        }
    ],
    coordinate: {
        transform: [
            {
                type: "transpose"
            }
        ]
    },
    axis: false,
    legend: false,
    scale: {
        color: {
            domain: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAPSTACK"].map((c)=>c.cls),
            range: [
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].tealDeep,
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TRANCHE_HEX"]["1l"],
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TRANCHE_HEX"]["2l"],
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TRANCHE_HEX"].sub,
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TRANCHE_HEX"].eq
            ]
        }
    },
    labels: [
        {
            text: (d)=>"$" + d.claim.toLocaleString(),
            position: "inside",
            fontSize: 10.5,
            fontWeight: 600,
            transform: [
                {
                    type: "contrastReverse"
                },
                {
                    type: "overflowHide"
                }
            ]
        }
    ]
};
function RecoveryTab({ onOpenEvidence, layout = "report" }) {
    const total = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAPSTACK"].reduce((s, c)=>s + (c.key !== "eq" ? c.claim : 0), 0);
    const ebitdas = [
        421,
        360,
        295
    ], mults = [
        5.0,
        5.5,
        6.0,
        6.5,
        7.0,
        7.5
    ];
    if (layout === "summary") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "p-3 flex flex-col gap-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatCard"], {
                    size: "hero",
                    sev: "ok",
                    value: "2L TL over TLB",
                    label: "Instrument preference",
                    sub: "Recovery delta acceptable at 6.0x stress; position sized through downside convexity."
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                    lineNumber: 228,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "bg-caos-bg px-3 py-2.5 text-caos-lg text-caos-text/90 leading-relaxed",
                    children: "CP-3B keeps the 2L as the preferred instrument: severe-case recovery is thin, but the carry and entry discount compensate when sized below the max sleeve."
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                    lineNumber: 235,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/deepdive/tabs.tsx",
            lineNumber: 227,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-3 flex flex-col gap-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded border border-caos-border bg-caos-bg min-w-0",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SectionHeader$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SectionHeader"], {
                                title: "CP-3B-02 · Capital structure ($M)"
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                lineNumber: 248,
                                columnNumber: 11
                            }, this),
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAPSTACK"].map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid grid-cols-[14px_1fr_70px_60px_56px] gap-x-2 items-center px-3 py-1.5 border-b border-caos-border/50",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "w-2 h-2 rounded-sm",
                                            style: {
                                                background: TRANCHE[c.key]
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                                            lineNumber: 251,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-caos-lg text-caos-text",
                                            children: c.cls
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                                            lineNumber: 252,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "tabular text-caos-md text-caos-muted",
                                            children: c.rate
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                                            lineNumber: 253,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "tabular text-caos-lg text-right text-caos-text",
                                            children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fmtNum"])(c.claim)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                                            lineNumber: 254,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "tabular text-caos-sm text-right text-caos-muted",
                                            children: c.key === "eq" ? "—" : (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fmtPct"])(c.claim / total, 1)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                                            lineNumber: 255,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, c.cls, true, {
                                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                                    lineNumber: 250,
                                    columnNumber: 13
                                }, this)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid grid-cols-[14px_1fr_70px_60px_56px] gap-x-2 items-center px-3 py-1.5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {}, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                        lineNumber: 259,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-caos-md font-semibold text-caos-text",
                                        children: "Total debt"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                        lineNumber: 259,
                                        columnNumber: 26
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {}, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                        lineNumber: 259,
                                        columnNumber: 103
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "tabular text-caos-lg text-right text-caos-text font-semibold",
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fmtNum"])(total)
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                        lineNumber: 260,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "tabular text-caos-sm text-right text-caos-muted",
                                        children: "5.7x"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                        lineNumber: 261,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                lineNumber: 258,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "px-2 pb-2 pt-2 border-t border-caos-border/50",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$charts$2f$SemanticVisualization$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SemanticVisualization"], {
                                    height: 72,
                                    spec: {
                                        kind: "stacked-bar",
                                        title: "Seniority stack · claims including equity",
                                        unit: "$M",
                                        sourceIds: [
                                            "CP-3B:T3B.2",
                                            "E-63"
                                        ],
                                        accessibleSummary: "The stack shows $120M RCF, $1,850M first-lien term loan, $900M second-lien term loan, $400M subordinated notes, and implied equity above the debt claims.",
                                        data: CAPSTACK_CHART_DATA,
                                        tabularFallback: {
                                            label: "Seniority stack data",
                                            columns: [
                                                {
                                                    key: "cls",
                                                    label: "Claim"
                                                },
                                                {
                                                    key: "claim",
                                                    label: "$M"
                                                }
                                            ],
                                            data: CAPSTACK_CHART_DATA
                                        },
                                        chart: CAPSTACK_CHART_SPEC
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                                    lineNumber: 264,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                lineNumber: 263,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                        lineNumber: 247,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded border border-caos-border bg-caos-bg min-w-0",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SectionHeader$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SectionHeader"], {
                                title: "CP-3B-06 · Recovery waterfall by scenario",
                                right: "claims: 1L $1,970 · 2L $900 · Sub $400"
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                lineNumber: 281,
                                columnNumber: 11
                            }, this),
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RECOVERY"].map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-3 px-3 py-1.5 border-b border-caos-border/50",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-caos-lg font-medium text-caos-text w-24",
                                            children: s.scen
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                                            lineNumber: 284,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "tabular text-caos-sm text-caos-muted",
                                            children: [
                                                s.mult,
                                                " × $",
                                                s.ebitda,
                                                "M = ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-caos-text",
                                                    children: [
                                                        "$",
                                                        (s.ev / 1000).toFixed(2),
                                                        "B EV"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                    lineNumber: 285,
                                                    columnNumber: 96
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                                            lineNumber: 285,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-caos-xs text-caos-muted ml-auto",
                                            children: s.note
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                                            lineNumber: 286,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, s.scen, true, {
                                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                                    lineNumber: 283,
                                    columnNumber: 13
                                }, this)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "px-2 pt-2",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$charts$2f$SemanticVisualization$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SemanticVisualization"], {
                                    height: 192,
                                    spec: {
                                        kind: "bar",
                                        title: "Recovery waterfall by tranche and scenario",
                                        unit: "% of par",
                                        sourceIds: [
                                            "CP-3B:T3B.2",
                                            "E-63"
                                        ],
                                        accessibleSummary: "Second-lien recovery is 100% in the upside case, 21% in base stress, and 0% in severe stress; first lien remains 100% in upside and base stress and falls to 75% in severe stress.",
                                        data: RECOVERY_CHART_DATA,
                                        tabularFallback: {
                                            label: "Recovery waterfall data",
                                            columns: [
                                                {
                                                    key: "scenario",
                                                    label: "Scenario"
                                                },
                                                {
                                                    key: "tranche",
                                                    label: "Tranche"
                                                },
                                                {
                                                    key: "rec",
                                                    label: "Recovery (% of par)"
                                                }
                                            ],
                                            data: RECOVERY_CHART_DATA
                                        },
                                        chart: RECOVERY_CHART_SPEC
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                                    lineNumber: 290,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                lineNumber: 289,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "px-3 py-1.5 text-caos-sm text-caos-muted",
                                children: [
                                    "Market-implied 2L recovery at px 96.4 ≈ ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "tabular text-caos-text",
                                        children: "38%"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                        lineNumber: 305,
                                        columnNumber: 53
                                    }, this),
                                    " under base-distress probability weights — wide of model in severe only."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                lineNumber: 304,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                        lineNumber: 280,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 246,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded border border-caos-border bg-caos-bg",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SectionHeader$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SectionHeader"], {
                        title: "2L TL recovery sensitivity — exit multiple × stressed EBITDA",
                        right: "cells: % of par"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                        lineNumber: 311,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-3",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid",
                            style: {
                                gridTemplateColumns: `120px repeat(${mults.length}, 1fr)`,
                                gap: 4
                            },
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {}, void 0, false, {
                                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                                    lineNumber: 314,
                                    columnNumber: 13
                                }, this),
                                mults.map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "tabular text-caos-sm text-caos-muted text-center",
                                        children: [
                                            m.toFixed(1),
                                            "x"
                                        ]
                                    }, m, true, {
                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                        lineNumber: 315,
                                        columnNumber: 31
                                    }, this)),
                                ebitdas.map((e)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "contents",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "tabular text-caos-sm text-caos-muted self-center",
                                                children: [
                                                    "$",
                                                    e,
                                                    "M ",
                                                    e === 421 ? "(LTM adj.)" : e === 360 ? "(base stress)" : "(severe)"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                lineNumber: 318,
                                                columnNumber: 17
                                            }, this),
                                            mults.map((m)=>{
                                                const r = recoveries(e * m)["2l"];
                                                const cvar = r >= 0.9 ? "--caos-success" : r >= 0.5 ? "--caos-warning" : "--caos-critical";
                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "h-8 rounded-sm flex items-center justify-center transition-caos hover:opacity-80 cursor-default",
                                                    style: {
                                                        background: `color-mix(in srgb, var(${cvar}) ${12 + r * 30}%, transparent)`
                                                    },
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "tabular text-caos-lg",
                                                        style: {
                                                            color: r >= 0.9 ? "var(--caos-success-bright)" : r >= 0.5 ? "var(--caos-warning-bright)" : "var(--caos-critical-bright)"
                                                        },
                                                        children: (r * 100).toFixed(0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                        lineNumber: 324,
                                                        columnNumber: 23
                                                    }, this)
                                                }, m, false, {
                                                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                    lineNumber: 323,
                                                    columnNumber: 21
                                                }, this);
                                            })
                                        ]
                                    }, "row" + e, true, {
                                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                                        lineNumber: 317,
                                        columnNumber: 15
                                    }, this))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                            lineNumber: 313,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                        lineNumber: 312,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 310,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$OutputRegister$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OutputRegister"], {
                id: "CP-3B",
                defaultOpen: false,
                onOpenEvidence: onOpenEvidence
            }, "CP-3B" + layout, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 333,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/tabs.tsx",
        lineNumber: 242,
        columnNumber: 5
    }, this);
}
_c5 = RecoveryTab;
function CovenantsTab({ onOpenEvidence, layout = "report" }) {
    _s();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["COVENANTS"][1].ref);
    const seg = (n)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "flex gap-px",
            role: "img",
            "aria-label": `aggressiveness ${n} of 10`,
            children: Array.from({
                length: 10
            }, (_, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "w-1.5 h-2.5 rounded-[1px]",
                    style: {
                        background: i < n ? n >= 8 ? "var(--caos-critical)" : n >= 6 ? "var(--caos-warning)" : "var(--caos-success)" : "var(--caos-border)"
                    }
                }, i, false, {
                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                    lineNumber: 344,
                    columnNumber: 9
                }, this))
        }, void 0, false, {
            fileName: "[project]/src/components/deepdive/tabs.tsx",
            lineNumber: 342,
            columnNumber: 5
        }, this);
    if (layout === "summary") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "p-3 flex flex-col gap-3",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatCard"], {
                size: "hero",
                sev: "critical",
                value: "7.2 / 10",
                label: "Covenant aggressiveness — the binding read on this credit",
                sub: "Docs do not block the trade; they force sizing discipline."
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 351,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/deepdive/tabs.tsx",
            lineNumber: 350,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-3 flex flex-col gap-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatCard"], {
                size: "hero",
                sev: "critical",
                value: "7.2 / 10",
                label: "Covenant aggressiveness — the binding read on this credit",
                sub: "vs 2026 single-B market norm 6.1"
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 363,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-3 gap-2",
                children: [
                    {
                        l: "Day-one incremental capacity",
                        v: "$" + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAPACITY"].incDebt + "M",
                        sub: "ahead of the 2L TL · MFN sunsets 12mo",
                        sev: "critical"
                    },
                    {
                        l: "RP capacity usable today",
                        v: "$" + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAPACITY"].rpToday + "M",
                        sub: "builder + starter baskets",
                        sev: "warning"
                    },
                    {
                        l: "EBITDA add-backs",
                        v: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAPACITY"].addbackPct + "%",
                        sub: "$" + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAPACITY"].addback + "M of adj. EBITDA",
                        sev: "warning"
                    }
                ].map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatCard"], {
                        value: c.v,
                        label: c.l,
                        sub: c.sub,
                        sev: c.sev
                    }, c.l, false, {
                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                        lineNumber: 376,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 370,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-caos-bg px-3 py-2 flex items-center gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-caos-xl",
                        style: {
                            color: "var(--caos-warning)"
                        },
                        "aria-hidden": "true",
                        children: "⌖"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                        lineNumber: 380,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs uppercase tracking-wider text-caos-muted",
                        children: "CP-4C-10 nearest pressure point"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                        lineNumber: 381,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-caos-lg text-caos-text",
                        children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAPACITY"].nearest
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                        lineNumber: 382,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 379,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded border border-caos-border bg-caos-bg",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-[230px_1fr_120px_150px_60px] gap-x-3 px-3 h-7 items-center border-b border-caos-border",
                        children: [
                            "Provision · controlling doc",
                            "Feature",
                            "Aggressiveness",
                            "Headroom / capacity",
                            ""
                        ].map((h, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "tabular text-caos-xs uppercase tracking-wider text-caos-muted",
                                children: h
                            }, i, false, {
                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                lineNumber: 388,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                        lineNumber: 386,
                        columnNumber: 9
                    }, this),
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["COVENANTS"].map((c)=>{
                        const isOpen = open === c.ref;
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "border-b border-caos-border/50",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>setOpen(open === c.ref ? null : c.ref),
                                    "aria-expanded": isOpen,
                                    className: "w-full text-left grid grid-cols-[230px_1fr_120px_150px_60px] gap-x-3 px-3 py-1.5 items-center hover:bg-caos-elevated/50 transition-caos focus-ring",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "tabular text-caos-sm text-caos-accent",
                                            children: c.ref
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                                            lineNumber: 400,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-caos-lg text-caos-text flex items-center gap-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dot"], {
                                                    sev: c.flag
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                    lineNumber: 401,
                                                    columnNumber: 87
                                                }, this),
                                                c.name
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                                            lineNumber: 401,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "flex items-center gap-1.5",
                                            children: [
                                                seg(c.agg),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "tabular text-caos-xs text-caos-muted",
                                                    children: c.agg
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                    lineNumber: 402,
                                                    columnNumber: 73
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                                            lineNumber: 402,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "tabular text-caos-md",
                                            style: {
                                                color: c.flag === "ok" ? "var(--caos-muted)" : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEV_COLOR"][c.flag]
                                            },
                                            children: c.headroom
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                                            lineNumber: 403,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "justify-self-end text-caos-muted text-caos-xs",
                                            children: isOpen ? "▲" : "▼"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                                            lineNumber: 404,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                                    lineNumber: 395,
                                    columnNumber: 15
                                }, this),
                                isOpen ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "px-3 pb-3 grid grid-cols-2 gap-3 caos-enter",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1",
                                                    children: "Controlling clause (verbatim)"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                    lineNumber: 409,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "clause-highlight tabular px-2.5 py-2 text-caos-text/90 leading-relaxed text-caos-xl",
                                                    children: c.clause
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                    lineNumber: 410,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                                            lineNumber: 408,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1",
                                                    children: "CP-4 interpretation · credit translation"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                    lineNumber: 413,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "text-caos-lg text-caos-text leading-relaxed",
                                                    children: c.read
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                                                    lineNumber: 414,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                                            lineNumber: 412,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                                    lineNumber: 407,
                                    columnNumber: 17
                                }, this) : null
                            ]
                        }, c.ref, true, {
                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                            lineNumber: 394,
                            columnNumber: 13
                        }, this);
                    })
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 385,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$OutputRegister$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OutputRegister"], {
                id: "CP-4",
                defaultOpen: false,
                onOpenEvidence: onOpenEvidence
            }, "CP-4" + layout, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 422,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$OutputRegister$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OutputRegister"], {
                id: "CP-4C",
                defaultOpen: false,
                onOpenEvidence: onOpenEvidence
            }, "CP-4C" + layout, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 423,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/tabs.tsx",
        lineNumber: 362,
        columnNumber: 5
    }, this);
}
_s(CovenantsTab, "hnJi2yLkZTEXn6gcyMiO+xP1RkI=");
_c6 = CovenantsTab;
function missingModuleMessage(meta, allowSeededFallback, missingAnalyticalReference) {
    if (!meta) return "This module id is not part of the CP-X route graph.";
    if (!allowSeededFallback) return meta.name + " has no issuer-specific output available. Run or re-run the issuer, then inspect CP-5 for any gate reason.";
    if (missingAnalyticalReference) return meta.name + " has no synthetic reference finding. Run it for an issuer to produce a source-gated output.";
    return meta.name + " is an infrastructure module — its product is the committee pack itself, not an output register.";
}
function MissingModuleView({ allowSeededFallback, id, meta }) {
    const missingAnalyticalReference = Boolean(meta && allowSeededFallback && meta.layer !== "INFRA");
    const openPipeline = !allowSeededFallback || missingAnalyticalReference;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "h-full flex flex-col items-center justify-center gap-2 p-6 text-center text-caos-muted",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "tabular text-caos-xl text-caos-text",
                children: [
                    id,
                    " · no analytical output register"
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 455,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-caos-md leading-relaxed max-w-[400px]",
                children: missingModuleMessage(meta, allowSeededFallback, missingAnalyticalReference)
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 456,
                columnNumber: 7
            }, this),
            meta ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                href: openPipeline ? "/pipeline" : "/reports",
                className: "tabular text-caos-sm px-2.5 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos",
                children: openPipeline ? "OPEN PIPELINE — RUN THE ISSUER →" : "OPEN REPORT STUDIO →"
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 457,
                columnNumber: 15
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/tabs.tsx",
        lineNumber: 454,
        columnNumber: 5
    }, this);
}
_c7 = MissingModuleView;
function splitLeadSection(output) {
    const finalSection = output.sections.at(-1);
    const lead = finalSection?.type === "text" && LEAD_TITLE.test(finalSection.title) ? finalSection : null;
    return {
        lead,
        rest: lead ? output.sections.slice(0, -1) : output.sections
    };
}
function ModuleKpis({ live, output }) {
    const missing = live && output.kpis.length > 0 && output.kpis.every((kpi)=>!kpi.v || kpi.v === "—");
    if (missing) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "bg-caos-bg px-3 py-2 text-caos-md text-caos-muted leading-snug",
            children: "Engine ran and produced this module, but no populated headline figures are available — thin source data for this issuer. Any produced sections appear below."
        }, void 0, false, {
            fileName: "[project]/src/components/deepdive/tabs.tsx",
            lineNumber: 471,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "grid gap-2",
        style: {
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))"
        },
        children: output.kpis.map((kpi)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatCard"], {
                value: kpi.v,
                label: kpi.l,
                sev: kpi.sev
            }, kpi.l, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 475,
                columnNumber: 33
            }, this))
    }, void 0, false, {
        fileName: "[project]/src/components/deepdive/tabs.tsx",
        lineNumber: 474,
        columnNumber: 5
    }, this);
}
_c8 = ModuleKpis;
function ModuleLead({ lead, onOpenEvidence }) {
    if (!lead) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rounded border border-caos-accent/40 bg-caos-elevated px-3 py-2.5",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-accent mb-1",
                children: [
                    "▸ ",
                    lead.title
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 484,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-caos-xl text-caos-text leading-relaxed",
                children: [
                    lead.body,
                    lead.ev?.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "inline-flex gap-1 ml-1.5 align-middle",
                        children: lead.ev.map((evidenceId)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EvChip"], {
                                id: evidenceId,
                                onOpen: onOpenEvidence
                            }, evidenceId, false, {
                                fileName: "[project]/src/components/deepdive/tabs.tsx",
                                lineNumber: 487,
                                columnNumber: 113
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/tabs.tsx",
                        lineNumber: 487,
                        columnNumber: 28
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 485,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/tabs.tsx",
        lineNumber: 483,
        columnNumber: 5
    }, this);
}
_c9 = ModuleLead;
function ModuleAnalysis({ id, live, onOpenEvidence, output }) {
    const { lead, rest } = splitLeadSection(output);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModuleKpis, {
                live: live,
                output: output
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 497,
                columnNumber: 7
            }, this),
            live ? null : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModuleLead, {
                lead: lead,
                onOpenEvidence: onOpenEvidence
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 498,
                columnNumber: 22
            }, this),
            live ? null : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$OutSections$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OutSections"], {
                sections: rest,
                onOpenEvidence: onOpenEvidence
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 499,
                columnNumber: 22
            }, this),
            live ? null : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$ModuleCharts$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ModuleCharts"], {
                id: id
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 500,
                columnNumber: 22
            }, this)
        ]
    }, void 0, true);
}
_c10 = ModuleAnalysis;
function ModuleLayoutBody({ id, layout, live, onOpenEvidence, output }) {
    const liveRegister = live ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$OutputRegister$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LiveOutputRegister"], {
        id: id,
        output: output,
        onOpenEvidence: onOpenEvidence
    }, void 0, false, {
        fileName: "[project]/src/components/deepdive/tabs.tsx",
        lineNumber: 506,
        columnNumber: 31
    }, this) : null;
    if (layout === "summary") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModuleAnalysis, {
                    id: id,
                    live: live,
                    onOpenEvidence: onOpenEvidence,
                    output: output
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                    lineNumber: 508,
                    columnNumber: 14
                }, this),
                live ? liveRegister : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$OutputRegister$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StepOutputGrid"], {
                    id: id,
                    onOpenEvidence: onOpenEvidence,
                    mode: "summary"
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                    lineNumber: 508,
                    columnNumber: 123
                }, this)
            ]
        }, void 0, true);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModuleAnalysis, {
                id: id,
                live: live,
                onOpenEvidence: onOpenEvidence,
                output: output
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 512,
                columnNumber: 7
            }, this),
            live ? null : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$OutputRegister$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StepOutputGrid"], {
                id: id,
                onOpenEvidence: onOpenEvidence,
                mode: layout
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 513,
                columnNumber: 22
            }, this),
            live ? liveRegister : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$OutputRegister$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OutputRegister"], {
                id: id,
                defaultOpen: false,
                onOpenEvidence: onOpenEvidence
            }, id + layout, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 514,
                columnNumber: 30
            }, this)
        ]
    }, void 0, true);
}
_c11 = ModuleLayoutBody;
function ModuleIdentity({ id, live, meta, planEvent, state }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "bg-caos-bg px-3 py-2.5 flex items-start gap-3",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "min-w-0 flex-1",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center gap-2",
                    children: [
                        live ? null : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dot"], {
                            sev: state
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                            lineNumber: 524,
                            columnNumber: 26
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "tabular text-caos-2xl text-caos-text whitespace-nowrap",
                            children: id
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                            lineNumber: 525,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-caos-2xl font-semibold text-caos-text",
                            children: meta.name
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                            lineNumber: 526,
                            columnNumber: 11
                        }, this),
                        live ? null : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tag"], {
                            sev: state,
                            children: state
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/tabs.tsx",
                            lineNumber: 527,
                            columnNumber: 26
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                    lineNumber: 523,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "text-caos-md text-caos-muted mt-1",
                    children: meta.desc
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                    lineNumber: 529,
                    columnNumber: 9
                }, this),
                !live && planEvent ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "tabular text-caos-sm text-caos-muted mt-1.5 leading-snug",
                    children: [
                        "▸ ",
                        planEvent
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/deepdive/tabs.tsx",
                    lineNumber: 530,
                    columnNumber: 31
                }, this) : null
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/deepdive/tabs.tsx",
            lineNumber: 522,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/deepdive/tabs.tsx",
        lineNumber: 521,
        columnNumber: 5
    }, this);
}
_c12 = ModuleIdentity;
function ModuleView({ id, sim, onOpenEvidence, liveOut, allowSeededFallback = true, layout = "report" }) {
    const meta = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODULES"].find((module)=>module.id === id);
    const plan = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SIM_PLAN"].find((module)=>module.id === id);
    const output = liveOut ?? (allowSeededFallback ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$module$2d$outputs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODULE_OUTPUTS"][id] : undefined);
    if (!output || !meta) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MissingModuleView, {
        allowSeededFallback: allowSeededFallback,
        id: id,
        meta: meta
    }, void 0, false, {
        fileName: "[project]/src/components/deepdive/tabs.tsx",
        lineNumber: 540,
        columnNumber: 32
    }, this);
    const live = Boolean(liveOut);
    const state = sim.mods[id]?.state || "idle";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-3 flex flex-col gap-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModuleIdentity, {
                id: id,
                live: live,
                meta: meta,
                planEvent: plan?.event,
                state: state
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 551,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModuleLayoutBody, {
                id: id,
                layout: layout,
                live: live,
                onOpenEvidence: onOpenEvidence,
                output: output
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/tabs.tsx",
                lineNumber: 552,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/tabs.tsx",
        lineNumber: 545,
        columnNumber: 5
    }, this);
}
_c13 = ModuleView;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c10, _c11, _c12, _c13;
__turbopack_context__.k.register(_c, "DebateTab");
__turbopack_context__.k.register(_c1, "RECOVERY_CHART_DATA$RECOVERY.flatMap");
__turbopack_context__.k.register(_c2, "RECOVERY_CHART_DATA");
__turbopack_context__.k.register(_c3, "CAPSTACK_CHART_DATA$CAPSTACK.map");
__turbopack_context__.k.register(_c4, "CAPSTACK_CHART_DATA");
__turbopack_context__.k.register(_c5, "RecoveryTab");
__turbopack_context__.k.register(_c6, "CovenantsTab");
__turbopack_context__.k.register(_c7, "MissingModuleView");
__turbopack_context__.k.register(_c8, "ModuleKpis");
__turbopack_context__.k.register(_c9, "ModuleLead");
__turbopack_context__.k.register(_c10, "ModuleAnalysis");
__turbopack_context__.k.register(_c11, "ModuleLayoutBody");
__turbopack_context__.k.register(_c12, "ModuleIdentity");
__turbopack_context__.k.register(_c13, "ModuleView");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/deepdive/tabs.tsx [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/src/components/deepdive/tabs.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=src_0rm963k._.js.map