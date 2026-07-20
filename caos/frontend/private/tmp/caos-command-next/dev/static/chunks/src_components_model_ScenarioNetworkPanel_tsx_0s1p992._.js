(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/components/model/ScenarioNetworkPanel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ScenarioNetworkPanel",
    ()=>ScenarioNetworkPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/StatusGlyph.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/SurfaceState.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ActionReason.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
const STATUS = {
    computed: {
        glyph: "success",
        label: "COMPUTED",
        color: "var(--caos-success)"
    },
    degraded: {
        glyph: "warning",
        label: "DEGRADED",
        color: "var(--caos-warning)"
    },
    "no-data": {
        glyph: "idle",
        label: "NO DATA",
        color: "var(--caos-muted)"
    }
};
function ScenarioControls({ ebitdaPct, rateBps, busy, onEbitdaChange, onRateChange, onRun }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mt-2 flex items-center justify-end gap-2 flex-wrap",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "tabular text-caos-2xs text-caos-muted",
                children: [
                    "EBITDA %",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "number",
                        name: "scenario-ebitda-change",
                        autoComplete: "off",
                        min: -90,
                        max: 50,
                        value: ebitdaPct,
                        onChange: (event)=>onEbitdaChange(Number(event.target.value)),
                        className: "ml-1 w-14 rounded border border-caos-border bg-caos-bg px-1 py-0.5 text-caos-text focus-ring"
                    }, void 0, false, {
                        fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                        lineNumber: 34,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                lineNumber: 32,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "tabular text-caos-2xs text-caos-muted",
                children: [
                    "RATE BP",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "number",
                        name: "scenario-rate-change",
                        autoComplete: "off",
                        min: -500,
                        max: 1000,
                        value: rateBps,
                        onChange: (event)=>onRateChange(Number(event.target.value)),
                        className: "ml-1 w-16 rounded border border-caos-border bg-caos-bg px-1 py-0.5 text-caos-text focus-ring"
                    }, void 0, false, {
                        fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                        lineNumber: 38,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                lineNumber: 36,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ActionReason"], {
                type: "button",
                onClick: onRun,
                reason: busy ? "Propagating…" : null,
                className: "tabular text-caos-2xs min-h-[24px] px-2 rounded border border-caos-accent text-caos-accent aria-disabled:opacity-40 transition-caos focus-ring",
                children: busy ? "PROPAGATING…" : "PROPAGATE"
            }, void 0, false, {
                fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                lineNumber: 40,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
        lineNumber: 31,
        columnNumber: 5
    }, this);
}
_c = ScenarioControls;
function ScenarioNode({ node, index }) {
    const status = STATUS[node.status];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "contents",
        children: [
            index > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                "aria-hidden": "true",
                className: "self-center text-caos-muted",
                children: "→"
            }, void 0, false, {
                fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                lineNumber: 51,
                columnNumber: 20
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "min-w-[126px] rounded border border-caos-border bg-caos-bg px-2 py-1.5",
                title: node.basis,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                                kind: status.glyph
                            }, void 0, false, {
                                fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                                lineNumber: 54,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "tabular text-caos-3xs uppercase tracking-wider",
                                style: {
                                    color: status.color
                                },
                                children: status.label
                            }, void 0, false, {
                                fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                                lineNumber: 55,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                        lineNumber: 53,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "tabular text-caos-xs uppercase text-caos-muted mt-1",
                        children: node.node
                    }, void 0, false, {
                        fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                        lineNumber: 57,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-caos-xs text-caos-text leading-snug mt-0.5",
                        children: node.label
                    }, void 0, false, {
                        fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                        lineNumber: 58,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                lineNumber: 52,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
        lineNumber: 50,
        columnNumber: 5
    }, this);
}
_c1 = ScenarioNode;
function ScenarioResult({ result }) {
    if (!result) return null;
    const signed = (value, digits)=>`${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(digits)}`;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mt-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-1",
                children: [
                    "Run ",
                    result.shock.run_id,
                    " · EBITDA ",
                    signed(result.shock.ebitda_pct * 100, 1),
                    "% · rate ",
                    signed(result.shock.rate_bps, 0),
                    " bp"
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                lineNumber: 69,
                columnNumber: 7
            }, this),
            result.source ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-1.5",
                children: [
                    "Source ",
                    result.source.qa_status,
                    " · ",
                    result.source.included_modules.length,
                    " accepted modules",
                    result.source.excluded_modules.length ? ` · ${result.source.excluded_modules.length} blocked excluded` : ""
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                lineNumber: 73,
                columnNumber: 9
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex gap-1.5 overflow-x-auto pb-1",
                "aria-label": "Scenario propagation chain",
                children: result.nodes.map((node, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ScenarioNode, {
                        node: node,
                        index: index
                    }, node.node, false, {
                        fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                        lineNumber: 79,
                        columnNumber: 44
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                lineNumber: 78,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
        lineNumber: 68,
        columnNumber: 5
    }, this);
}
_c2 = ScenarioResult;
const scenarioKey = (issuerId, runId, ebitdaPct, rateBps)=>`${issuerId}\u0000${runId ?? ""}\u0000${ebitdaPct}\u0000${rateBps}`;
function ScenarioNetworkPanel({ issuerId, runId }) {
    _s();
    const [ebitdaPct, setEbitdaPct] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(-20);
    const [rateBps, setRateBps] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [resultState, setResultState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [pending, setPending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [errorKey, setErrorKey] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const requestId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(0);
    const currentKey = scenarioKey(issuerId, runId, ebitdaPct, rateBps);
    const currentKeyRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(currentKey);
    currentKeyRef.current = currentKey;
    const result = resultState?.key === currentKey ? resultState.value : null;
    const busy = pending?.key === currentKey;
    const error = errorKey === currentKey;
    const run = async ()=>{
        if (!runId || busy) return;
        const key = currentKey;
        const id = ++requestId.current;
        setPending({
            id,
            key
        });
        setErrorKey(null);
        try {
            const value = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["propagateScenario"])({
                issuer_id: issuerId,
                run_id: runId,
                ebitda_pct: ebitdaPct / 100,
                rate_bps: rateBps
            });
            if (currentKeyRef.current === key && requestId.current === id) {
                setResultState({
                    key,
                    value
                });
            }
        } catch  {
            if (currentKeyRef.current === key && requestId.current === id) {
                setErrorKey(key);
            }
        } finally{
            setPending((current)=>current?.id === id ? null : current);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "border-t border-caos-border pt-2",
        "aria-labelledby": "scenario-network-title",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                id: "scenario-network-title",
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                children: "Scenario network · cross-module propagation"
            }, void 0, false, {
                fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                lineNumber: 127,
                columnNumber: 7
            }, this),
            !runId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
                kind: "unavailable",
                title: "Completed run required",
                detail: "Seeded reference content elsewhere on this page is illustrative. A completed live run is required before a scenario can propagate across live modules.",
                compact: true,
                className: "mt-2"
            }, void 0, false, {
                fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                lineNumber: 131,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ScenarioControls, {
                ebitdaPct: ebitdaPct,
                rateBps: rateBps,
                busy: busy,
                onEbitdaChange: setEbitdaPct,
                onRateChange: setRateBps,
                onRun: run
            }, void 0, false, {
                fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                lineNumber: 139,
                columnNumber: 9
            }, this),
            error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                role: "alert",
                className: "tabular text-caos-xs mt-2",
                style: {
                    color: "var(--caos-critical)"
                },
                children: "Couldn’t propagate this scenario. Retry without changing the current model."
            }, void 0, false, {
                fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                lineNumber: 141,
                columnNumber: 16
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ScenarioResult, {
                result: result
            }, void 0, false, {
                fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
                lineNumber: 142,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/model/ScenarioNetworkPanel.tsx",
        lineNumber: 126,
        columnNumber: 5
    }, this);
}
_s(ScenarioNetworkPanel, "PJbteO8HMnAckdq2xVkCgLxleZ4=");
_c3 = ScenarioNetworkPanel;
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "ScenarioControls");
__turbopack_context__.k.register(_c1, "ScenarioNode");
__turbopack_context__.k.register(_c2, "ScenarioResult");
__turbopack_context__.k.register(_c3, "ScenarioNetworkPanel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/model/ScenarioNetworkPanel.tsx [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/src/components/model/ScenarioNetworkPanel.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=src_components_model_ScenarioNetworkPanel_tsx_0s1p992._.js.map