(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
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
"[project]/src/components/reports/EvidenceModal.tsx [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EvidenceModal",
    ()=>EvidenceModal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// E-xx evidence source viewer (port of design bundle concept-c-views.jsx).
// Shows the exact cited source extract with the passage highlighted, document
// metadata, extraction anchor, CP-5B trace status, and cited-by trail.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/use-modal-a11y.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/CloseButton.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ModalBackdrop.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$evidence$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/reports/evidence.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/reports/deal.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$module$2d$outputs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/deepdive/module-outputs.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$FlagToQa$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/FlagToQa.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/engine/types.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/reports/EvChip.tsx [app-client] (ecmascript)");
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
// lineage_class → resolved/flagged, mirroring adapt.ts lineageSev.
function liveStatus(lineageClass) {
    return [
        "Conflicting",
        "Weak Lineage",
        "Untraced",
        "Insufficient Information"
    ].includes(lineageClass) ? "open" : "verified";
}
function findCitations(id, reports) {
    const hits = [];
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEBATE"].rounds.forEach((r)=>r.points.forEach((p, i)=>{
            if (p.ev.includes(id)) hits.push(`CP-6A · ${r.who} ${r.phase} · point ${i + 1}`);
        }));
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEBATE"].weighting.forEach((w)=>{
        if (w.ev.includes(id)) hits.push(`CP-6A · Chair weighting — "${w.claim}"`);
    });
    Object.entries(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$module$2d$outputs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODULE_OUTPUTS"]).forEach(([mid, out])=>{
        out.sections.forEach((s)=>{
            if ("ev" in s && s.ev && s.ev.includes(id)) hits.push(`${mid} · ${s.title}`);
            if (s.type === "flags") s.items.forEach((f)=>{
                if (f.ev && f.ev.includes(id)) hits.push(`${mid} · ${s.title}`);
            });
        });
    });
    reports.forEach((rep)=>{
        rep.srcs.forEach((s)=>{
            if (s.ev.includes(id)) hits.push(`${rep.title} · ${s.chip}`);
        });
    });
    return hits;
}
function Bar({ pct, color }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "w-full rounded-full overflow-hidden",
        style: {
            height: 3,
            background: "var(--caos-border)"
        },
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "h-full rounded-full",
            style: {
                width: Math.max(0, Math.min(100, pct)) + "%",
                background: color
            }
        }, void 0, false, {
            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
            lineNumber: 55,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
        lineNumber: 54,
        columnNumber: 5
    }, this);
}
_c = Bar;
function StatusBadge({ status, label }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "tabular text-caos-xs uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap",
        style: {
            color: status === "open" ? "var(--caos-warning)" : "var(--caos-success)",
            borderColor: status === "open" ? "color-mix(in srgb, var(--caos-warning) 40%, transparent)" : "color-mix(in srgb, var(--caos-success) 40%, transparent)",
            background: status === "open" ? "color-mix(in srgb, var(--caos-warning) 8%, transparent)" : "color-mix(in srgb, var(--caos-success) 8%, transparent)"
        },
        children: label ?? (status === "open" ? "UNRESOLVED" : "VERIFIED")
    }, void 0, false, {
        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
        lineNumber: 62,
        columnNumber: 5
    }, this);
}
_c1 = StatusBadge;
function Row({ k, v, accent, title }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex justify-between gap-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-caos-muted whitespace-nowrap",
                children: k
            }, void 0, false, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 78,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-right break-words" + (accent ? " text-caos-accent" : ""),
                title: title,
                children: v
            }, void 0, false, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 79,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
        lineNumber: 77,
        columnNumber: 5
    }, this);
}
_c2 = Row;
// Shared dialog shell for the live / unresolved panels (narrower than the rich
// seeded viewer, which keeps its own layout below).
function EvShell({ id, status, panelRef, onClose, children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ModalBackdrop"], {
        onClose: onClose,
        padded: true,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            ref: panelRef,
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "Source evidence " + id,
            className: "bg-caos-panel border border-caos-border rounded-md flex flex-col overflow-hidden overscroll-contain w-full max-w-[760px]",
            style: {
                maxHeight: "86vh",
                boxShadow: "var(--shadow-modal)"
            },
            onClick: (e)=>e.stopPropagation(),
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "h-10 shrink-0 px-3 flex items-center gap-2.5 border-b border-caos-border bg-caos-elevated/60",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "tabular text-caos-2xl text-caos-text whitespace-nowrap",
                            children: id
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 107,
                            columnNumber: 11
                        }, this),
                        status,
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex-1"
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 109,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CloseButton"], {
                            onClick: onClose,
                            size: "md",
                            className: "ml-2"
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 110,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                    lineNumber: 106,
                    columnNumber: 9
                }, this),
                children
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
            lineNumber: 97,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
        lineNumber: 96,
        columnNumber: 5
    }, this);
}
_c3 = EvShell;
// Live click-to-source: resolve a run's own evidence to its real source chunk,
// instead of the seeded demo map (which 404s for live ids).
function LiveEvidencePanel({ id, ev, text, error, panelRef, onClose }) {
    const status = liveStatus(ev.lineage_class);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(EvShell, {
        id: id,
        status: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatusBadge, {
            status: status
        }, void 0, false, {
            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
            lineNumber: 132,
            columnNumber: 30
        }, this),
        panelRef: panelRef,
        onClose: onClose,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex-1 min-h-0 overflow-auto",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "px-4 py-3 border-b border-caos-border bg-caos-bg",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5",
                            children: "Source extract"
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 135,
                            columnNumber: 11
                        }, this),
                        ev.document_chunk_id ? text != null ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-caos-lg leading-[1.7] text-caos-text whitespace-pre-wrap",
                            children: text
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 138,
                            columnNumber: 15
                        }, this) : error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            role: "alert",
                            className: "text-caos-md",
                            style: {
                                color: "var(--caos-warning)"
                            },
                            children: "Source unavailable — the linked chunk could not be loaded. Retry, or reopen once the run finishes."
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 140,
                            columnNumber: 15
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-caos-md text-caos-muted",
                            children: "Loading source…"
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 144,
                            columnNumber: 15
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-caos-md text-caos-muted",
                            children: "No source chunk is linked to this citation — lineage is unresolved."
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 147,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                    lineNumber: 134,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "px-4 py-3 text-caos-md text-caos-text leading-relaxed grid gap-1.5",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                            k: "Cited claim",
                            v: ev.claim
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 151,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                            k: "Extracted by",
                            v: ev.module,
                            accent: true
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 152,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                            k: "Locator",
                            v: ev.source_locator || "—"
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 153,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                            k: "Lineage class",
                            v: ev.lineage_class
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 154,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                            k: "Confidence",
                            v: ev.confidence
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 155,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                            k: "Trace status",
                            v: status === "open" ? "lineage flagged" : "CP-5B verified"
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 156,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                            k: "Source ref",
                            v: ev.document_chunk_id ? ev.document_chunk_id.slice(0, 8) : "—",
                            title: ev.document_chunk_id || undefined
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 159,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                    lineNumber: 150,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
            lineNumber: 133,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
        lineNumber: 132,
        columnNumber: 5
    }, this);
}
_c4 = LiveEvidencePanel;
function UnresolvedEvidencePanel({ id, panelRef, onClose }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(EvShell, {
        id: id,
        status: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatusBadge, {
            status: "open"
        }, void 0, false, {
            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
            lineNumber: 174,
            columnNumber: 30
        }, this),
        panelRef: panelRef,
        onClose: onClose,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "px-5 py-6 text-caos-md text-caos-text leading-relaxed",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mb-2",
                    children: "This citation could not be resolved to a source for the current run."
                }, void 0, false, {
                    fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                    lineNumber: 176,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-caos-muted",
                    children: [
                        "Evidence id ",
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "tabular text-caos-text",
                            children: id
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 178,
                            columnNumber: 23
                        }, this),
                        "is not in this run's evidence set nor the seeded reference deal — it may belong to a module that did not run, or a superseded run."
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                    lineNumber: 177,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
            lineNumber: 175,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
        lineNumber: 174,
        columnNumber: 5
    }, this);
}
_c5 = UnresolvedEvidencePanel;
function SeededEvidenceHeader({ id, evidence, confidenceColor, onClose }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "h-10 shrink-0 px-3 flex items-center gap-2.5 border-b border-caos-border bg-caos-elevated/60",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xl text-caos-text whitespace-nowrap",
                children: id
            }, void 0, false, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 192,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatusBadge, {
                status: evidence.status
            }, void 0, false, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 193,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-caos-xl text-caos-muted truncate",
                children: evidence.section
            }, void 0, false, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 194,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1"
            }, void 0, false, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 195,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-xs text-caos-muted whitespace-nowrap",
                children: "confidence"
            }, void 0, false, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 196,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "w-20",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Bar, {
                    pct: evidence.conf * 100,
                    color: confidenceColor
                }, void 0, false, {
                    fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                    lineNumber: 197,
                    columnNumber: 29
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 197,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-md",
                style: {
                    color: confidenceColor
                },
                children: [
                    (evidence.conf * 100).toFixed(0),
                    "%"
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 198,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CloseButton"], {
                onClick: onClose,
                size: "md",
                className: "ml-2"
            }, void 0, false, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 199,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
        lineNumber: 191,
        columnNumber: 5
    }, this);
}
_c6 = SeededEvidenceHeader;
function SeededSourceExtract({ evidence, document, documentName }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-0 overflow-auto border-r border-caos-border bg-caos-bg",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "sticky top-0 px-4 py-2 border-b border-caos-border bg-caos-bg flex items-center gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-caos-lg text-caos-text whitespace-nowrap",
                        children: documentName
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 208,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-sm text-caos-muted whitespace-nowrap",
                        children: [
                            evidence.doc,
                            evidence.page ? ` · p.${evidence.page}` : ""
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 209,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex-1"
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 210,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs text-caos-muted uppercase tracking-wider whitespace-nowrap",
                        children: "source extract"
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 210,
                        columnNumber: 35
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 207,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-6 py-5 max-w-[640px]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "tabular text-caos-sm uppercase tracking-widest text-caos-muted mb-3",
                        children: evidence.section
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 213,
                        columnNumber: 9
                    }, this),
                    evidence.excerpt.map((passage, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: `text-caos-xl leading-[1.75] mb-3 ${passage.hit ? "clause-highlight px-2.5 py-2 text-caos-text" : "text-caos-text/70"}`,
                            children: passage.t
                        }, index, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 214,
                            columnNumber: 51
                        }, this)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "tabular text-caos-2xs text-caos-muted mt-4 pt-2 border-t border-caos-border flex justify-between whitespace-nowrap",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: documentName
                            }, void 0, false, {
                                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                                lineNumber: 216,
                                columnNumber: 11
                            }, this),
                            evidence.page ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: [
                                    "page ",
                                    evidence.page,
                                    " of ",
                                    document?.pages ?? "—"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                                lineNumber: 216,
                                columnNumber: 55
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "live feed"
                            }, void 0, false, {
                                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                                lineNumber: 216,
                                columnNumber: 119
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 215,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 212,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
        lineNumber: 206,
        columnNumber: 5
    }, this);
}
_c7 = SeededSourceExtract;
function DocumentMetadata({ evidence, document }) {
    if (!document) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "text-caos-md text-caos-muted",
        children: "External market data — LoanX marks + dealer runs, Jun 8 2026."
    }, void 0, false, {
        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
        lineNumber: 224,
        columnNumber: 25
    }, this);
    const gradeColor = document.grade === "A" ? "var(--caos-success)" : document.grade === "B" ? "var(--caos-warning)" : "var(--caos-critical)";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "text-caos-md text-caos-text leading-relaxed",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                k: "Document",
                v: evidence.doc
            }, void 0, false, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 228,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                k: "Type",
                v: document.type
            }, void 0, false, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 228,
                columnNumber: 44
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex justify-between gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-caos-muted",
                        children: "Quality grade"
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 229,
                        columnNumber: 51
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular whitespace-nowrap",
                        style: {
                            color: gradeColor
                        },
                        children: document.grade
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 229,
                        columnNumber: 105
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 229,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                k: "Dated",
                v: document.date
            }, void 0, false, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 230,
                columnNumber: 7
            }, this),
            document.mnpi ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex justify-between gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-caos-muted",
                        children: "Handling"
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 231,
                        columnNumber: 68
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular whitespace-nowrap",
                        style: {
                            color: "var(--caos-warning)"
                        },
                        children: "MNPI"
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 231,
                        columnNumber: 117
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 231,
                columnNumber: 24
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
        lineNumber: 227,
        columnNumber: 5
    }, this);
}
_c8 = DocumentMetadata;
function ExtractionMetadata({ evidence }) {
    const flagged = evidence.status === "open";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "text-caos-md text-caos-text leading-relaxed",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                k: "Extracted by",
                v: evidence.module,
                accent: true
            }, void 0, false, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 240,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                k: "Anchor",
                v: evidence.page ? `p.${evidence.page} · quote` : "feed snapshot"
            }, void 0, false, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 241,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex justify-between gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-caos-muted",
                        children: "Trace status"
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 242,
                        columnNumber: 51
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular whitespace-nowrap",
                        style: {
                            color: flagged ? "var(--caos-warning)" : "var(--caos-success)"
                        },
                        children: flagged ? "lineage flagged" : "CP-5B verified"
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 242,
                        columnNumber: 104
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 242,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
        lineNumber: 239,
        columnNumber: 5
    }, this);
}
_c9 = ExtractionMetadata;
function CitationList({ citations }) {
    if (!citations.length) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "text-caos-sm text-caos-muted",
        children: "No registered citations."
    }, void 0, false, {
        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
        lineNumber: 248,
        columnNumber: 33
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: citations.map((citation, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-caos-sm text-caos-text/85 leading-relaxed flex gap-1.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-caos-accent",
                        children: "▸"
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 249,
                        columnNumber: 137
                    }, this),
                    citation
                ]
            }, index, true, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 249,
                columnNumber: 48
            }, this))
    }, void 0, false);
}
_c10 = CitationList;
function SeededMetadataRail({ id, evidence, document, citations }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-0 overflow-auto",
        children: [
            evidence.qa ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-3 py-2.5 border-b border-caos-border",
                style: {
                    background: "color-mix(in srgb, var(--caos-warning) 6%, transparent)"
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "tabular text-caos-xs uppercase tracking-wider mb-1",
                        style: {
                            color: "var(--caos-warning)"
                        },
                        children: "QA finding"
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 255,
                        columnNumber: 161
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-caos-md text-caos-text leading-snug",
                        children: evidence.qa
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 255,
                        columnNumber: 286
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 255,
                columnNumber: 22
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-3 py-2.5 border-b border-caos-border",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5",
                        children: "Source"
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 256,
                        columnNumber: 64
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DocumentMetadata, {
                        evidence: evidence,
                        document: document
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 256,
                        columnNumber: 162
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 256,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-3 py-2.5 border-b border-caos-border",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5",
                        children: "Extraction"
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 257,
                        columnNumber: 64
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ExtractionMetadata, {
                        evidence: evidence
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 257,
                        columnNumber: 166
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 257,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-3 py-2.5 border-b border-caos-border",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "tabular text-caos-xs uppercase tracking-wider text-caos-muted mb-1.5",
                        children: [
                            "Cited by · ",
                            citations.length
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 258,
                        columnNumber: 64
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CitationList, {
                        citations: citations
                    }, void 0, false, {
                        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                        lineNumber: 258,
                        columnNumber: 185
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 258,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-3 py-2.5 flex flex-col gap-1.5",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$FlagToQa$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FlagToQa"], {
                    issuerId: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ATLF_REFERENCE_ISSUER_ID"],
                    moduleId: evidence.module,
                    stepRef: `evidence ${id}`
                }, void 0, false, {
                    fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                    lineNumber: 259,
                    columnNumber: 58
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                lineNumber: 259,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
        lineNumber: 254,
        columnNumber: 5
    }, this);
}
_c11 = SeededMetadataRail;
function SeededEvidencePanel({ id, evidence, reports, panelRef, onClose }) {
    const document = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DOCS"].find((candidate)=>candidate.id === evidence.doc);
    const documentName = document?.name ?? "Market Data Feed (LoanX / desk)";
    const confidenceColor = evidence.conf > 0.7 ? "var(--caos-success)" : "var(--caos-warning)";
    const citations = findCitations(id, reports);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ModalBackdrop"], {
        onClose: onClose,
        padded: true,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            ref: panelRef,
            role: "dialog",
            "aria-modal": "true",
            "aria-label": `Source evidence ${id}`,
            className: "bg-caos-panel border border-caos-border rounded-md flex flex-col overflow-hidden overscroll-contain w-full max-w-[1150px]",
            style: {
                maxHeight: "86vh",
                boxShadow: "var(--shadow-modal)"
            },
            onClick: (event)=>event.stopPropagation(),
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SeededEvidenceHeader, {
                    id: id,
                    evidence: evidence,
                    confidenceColor: confidenceColor,
                    onClose: onClose
                }, void 0, false, {
                    fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                    lineNumber: 272,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex-1 min-h-0 grid grid-cols-[1fr_300px]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SeededSourceExtract, {
                            evidence: evidence,
                            document: document,
                            documentName: documentName
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 274,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SeededMetadataRail, {
                            id: id,
                            evidence: evidence,
                            document: document,
                            citations: citations
                        }, void 0, false, {
                            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                            lineNumber: 275,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/reports/EvidenceModal.tsx",
                    lineNumber: 273,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/reports/EvidenceModal.tsx",
            lineNumber: 271,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
        lineNumber: 270,
        columnNumber: 5
    }, this);
}
_c12 = SeededEvidencePanel;
function EvidenceModal({ id, reports, live, isLiveRun = false, onClose }) {
    _s();
    const panelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useModalA11y"])(onClose);
    const liveEv = live?.[id];
    // Prefer the run's own evidence. Fall back to the seeded demo map ONLY for the
    // reference deal; for a live run a missing id is unresolved, never the seeded
    // ATLF excerpt (cross-issuer "verified" leak).
    // Parenthesized on purpose: when liveEv exists the early return below renders it;
    // `ev` only matters for the seeded-vs-unresolved split on non-live lookups.
    const ev = liveEv || isLiveRun ? undefined : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$evidence$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EVIDENCE"][id];
    const [chunkText, setChunkText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [chunkErr, setChunkErr] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const chunkId = liveEv?.document_chunk_id ?? null;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "EvidenceModal.useEffect": ()=>{
            if (!chunkId) return;
            let alive = true;
            setChunkText(null);
            setChunkErr(false);
            // On failure surface an explicit unavailable state — the render had no error
            // branch, so a 404 / failed chunk fetch spun "Loading source…" forever. SEAM3-3.
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getChunk"])(chunkId).then({
                "EvidenceModal.useEffect": (c)=>{
                    if (alive) setChunkText(c.text);
                }
            }["EvidenceModal.useEffect"]).catch({
                "EvidenceModal.useEffect": ()=>{
                    if (alive) setChunkErr(true);
                }
            }["EvidenceModal.useEffect"]);
            return ({
                "EvidenceModal.useEffect": ()=>{
                    alive = false;
                }
            })["EvidenceModal.useEffect"];
        }
    }["EvidenceModal.useEffect"], [
        chunkId
    ]);
    if (liveEv) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LiveEvidencePanel, {
        id: id,
        ev: liveEv,
        text: chunkText,
        error: chunkErr,
        panelRef: panelRef,
        onClose: onClose
    }, void 0, false, {
        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
        lineNumber: 325,
        columnNumber: 22
    }, this);
    // Unknown id (neither live nor seeded): an explicit state, never a silent no-op.
    if (!ev) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(UnresolvedEvidencePanel, {
        id: id,
        panelRef: panelRef,
        onClose: onClose
    }, void 0, false, {
        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
        lineNumber: 327,
        columnNumber: 19
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SeededEvidencePanel, {
        id: id,
        evidence: ev,
        reports: reports,
        panelRef: panelRef,
        onClose: onClose
    }, void 0, false, {
        fileName: "[project]/src/components/reports/EvidenceModal.tsx",
        lineNumber: 328,
        columnNumber: 10
    }, this);
}
_s(EvidenceModal, "/X488UPZGy8xzPP80VM1x2QiUWU=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useModalA11y"]
    ];
});
_c13 = EvidenceModal;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c10, _c11, _c12, _c13;
__turbopack_context__.k.register(_c, "Bar");
__turbopack_context__.k.register(_c1, "StatusBadge");
__turbopack_context__.k.register(_c2, "Row");
__turbopack_context__.k.register(_c3, "EvShell");
__turbopack_context__.k.register(_c4, "LiveEvidencePanel");
__turbopack_context__.k.register(_c5, "UnresolvedEvidencePanel");
__turbopack_context__.k.register(_c6, "SeededEvidenceHeader");
__turbopack_context__.k.register(_c7, "SeededSourceExtract");
__turbopack_context__.k.register(_c8, "DocumentMetadata");
__turbopack_context__.k.register(_c9, "ExtractionMetadata");
__turbopack_context__.k.register(_c10, "CitationList");
__turbopack_context__.k.register(_c11, "SeededMetadataRail");
__turbopack_context__.k.register(_c12, "SeededEvidencePanel");
__turbopack_context__.k.register(_c13, "EvidenceModal");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/reports/EvidenceModal.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EvChip",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EvChip"],
    "EvidenceModal",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvidenceModal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["EvidenceModal"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvidenceModal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/src/components/reports/EvidenceModal.tsx [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$EvChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/reports/EvChip.tsx [app-client] (ecmascript)");
}),
"[project]/src/components/reports/EvidenceModal.tsx [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/src/components/reports/EvidenceModal.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=src_components_1imlh81._.js.map