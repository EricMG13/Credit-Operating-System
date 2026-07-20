(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
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
"[project]/src/components/deepdive/LiveCovenantCapacity.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LiveCovenantCapacity",
    ()=>LiveCovenantCapacity
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/StatCard.tsx [app-client] (ecmascript)");
"use client";
;
;
const finite = (value)=>typeof value === "number" && Number.isFinite(value);
function LiveCovenantCapacity({ signals }) {
    const rp = signals.rp_basket_musd;
    const headroom = signals.covenant_headroom_turns;
    const addbackCap = signals.addback_cap_pct;
    const addbackUtil = signals.addback_utilization_pct;
    const hasData = [
        rp,
        headroom,
        addbackCap,
        addbackUtil
    ].some(finite);
    if (!hasData) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "px-3 py-3 border-t border-caos-border tabular text-caos-xs text-caos-muted",
            children: "CP-4C did not extract live basket-capacity terms for this issuer."
        }, void 0, false, {
            fileName: "[project]/src/components/deepdive/LiveCovenantCapacity.tsx",
            lineNumber: 19,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "p-3 border-t border-caos-border",
        "aria-labelledby": "live-covenant-capacity-title",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                id: "live-covenant-capacity-title",
                className: "tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-2",
                children: "Live covenant capacity · CP-4C"
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/LiveCovenantCapacity.tsx",
                lineNumber: 27,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-1 sm:grid-cols-3 gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatCard"], {
                        value: finite(rp) ? `$${rp.toLocaleString()}M` : "—",
                        label: "RP basket usable today",
                        sub: "governing-document extraction",
                        sev: finite(rp) ? "warning" : undefined
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/LiveCovenantCapacity.tsx",
                        lineNumber: 31,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatCard"], {
                        value: finite(headroom) ? `${headroom.toFixed(2)}x` : "—",
                        label: "Covenant headroom",
                        sub: "threshold less current leverage",
                        sev: finite(headroom) && headroom < 1 ? "critical" : undefined
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/LiveCovenantCapacity.tsx",
                        lineNumber: 37,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatCard"], {
                        value: finite(addbackCap) ? `${(addbackCap * 100).toFixed(0)}%` : "—",
                        label: "EBITDA add-back cap",
                        sub: finite(addbackUtil) ? `${addbackUtil.toFixed(0)}% utilized` : "utilization unavailable",
                        sev: signals.addback_breach === true ? "critical" : finite(addbackCap) ? "warning" : undefined
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/LiveCovenantCapacity.tsx",
                        lineNumber: 43,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/LiveCovenantCapacity.tsx",
                lineNumber: 30,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/LiveCovenantCapacity.tsx",
        lineNumber: 26,
        columnNumber: 5
    }, this);
}
_c = LiveCovenantCapacity;
var _c;
__turbopack_context__.k.register(_c, "LiveCovenantCapacity");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/deepdive/LiveCovenantCapacity.tsx [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/src/components/deepdive/LiveCovenantCapacity.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=src_components_04ppche._.js.map