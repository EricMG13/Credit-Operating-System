(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/lib/color-tokens.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Literal values needed before, or independently of, the CSS pipeline.
 * Keep ordinary UI styles on CSS custom properties; this module is reserved
 * for browser metadata, native color controls, and the root error boundary.
 */ __turbopack_context__.s([
    "CAOS_COLOR_TOKENS",
    ()=>CAOS_COLOR_TOKENS
]);
const CAOS_COLOR_TOKENS = {
    bg: "#0a0a0f",
    panel: "#11131d",
    border: "#34384a",
    text: "#e6e6ef",
    muted: "#a1a1b5",
    accent: "#63a1ff",
    critical: "#ef4444",
    paperWhite: "#ffffff",
    paperWarm: "#f7f5ee",
    paperCool: "#eef0f3"
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/app/global-error.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>GlobalError
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// Root error boundary — the only thing that catches a failure in the root layout
// itself, so it must supply its own <html>/<body> (the layout that normally
// provides them, plus its Tailwind/font wiring, has crashed). Inline styles use
// centralized literal tokens so this remains independent of the CSS pipeline.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$color$2d$tokens$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/color-tokens.ts [app-client] (ecmascript)");
"use client";
;
;
function GlobalError({ error, reset }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("html", {
        lang: "en",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("body", {
            style: {
                minHeight: "100vh",
                margin: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$color$2d$tokens$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAOS_COLOR_TOKENS"].bg,
                color: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$color$2d$tokens$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAOS_COLOR_TOKENS"].text,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, 'JetBrains Mono', monospace"
            },
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                role: "alert",
                style: {
                    maxWidth: "28rem",
                    padding: "1.75rem",
                    border: `1px solid ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$color$2d$tokens$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAOS_COLOR_TOKENS"].border}`,
                    borderRadius: "6px",
                    background: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$color$2d$tokens$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAOS_COLOR_TOKENS"].panel
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            fontSize: "0.6875rem",
                            letterSpacing: "0.2em",
                            textTransform: "uppercase",
                            color: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$color$2d$tokens$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAOS_COLOR_TOKENS"].critical
                        },
                        children: "Fatal error"
                    }, void 0, false, {
                        fileName: "[project]/src/app/global-error.tsx",
                        lineNumber: 41,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        style: {
                            fontSize: "1.125rem",
                            margin: "0.5rem 0",
                            color: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$color$2d$tokens$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAOS_COLOR_TOKENS"].text
                        },
                        children: "The workspace failed to load"
                    }, void 0, false, {
                        fileName: "[project]/src/app/global-error.tsx",
                        lineNumber: 51,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        style: {
                            fontSize: "0.75rem",
                            color: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$color$2d$tokens$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAOS_COLOR_TOKENS"].muted,
                            margin: 0
                        },
                        children: "Try again. If this keeps happening, contact your CAOS administrator."
                    }, void 0, false, {
                        fileName: "[project]/src/app/global-error.tsx",
                        lineNumber: 54,
                        columnNumber: 11
                    }, this),
                    error.digest && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        style: {
                            fontSize: "0.75rem",
                            color: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$color$2d$tokens$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAOS_COLOR_TOKENS"].muted,
                            marginTop: "0.5rem"
                        },
                        children: [
                            "ref ",
                            error.digest
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/global-error.tsx",
                        lineNumber: 58,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: reset,
                        style: {
                            marginTop: "1.25rem",
                            padding: "0.5rem 0.75rem",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            color: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$color$2d$tokens$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAOS_COLOR_TOKENS"].bg,
                            background: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$color$2d$tokens$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAOS_COLOR_TOKENS"].accent,
                            border: `1px solid ${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$color$2d$tokens$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAOS_COLOR_TOKENS"].accent}`,
                            borderRadius: "6px",
                            cursor: "pointer"
                        },
                        children: "Try again"
                    }, void 0, false, {
                        fileName: "[project]/src/app/global-error.tsx",
                        lineNumber: 62,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/global-error.tsx",
                lineNumber: 31,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/app/global-error.tsx",
            lineNumber: 19,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/global-error.tsx",
        lineNumber: 18,
        columnNumber: 5
    }, this);
}
_c = GlobalError;
var _c;
__turbopack_context__.k.register(_c, "GlobalError");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_104_n_9._.js.map