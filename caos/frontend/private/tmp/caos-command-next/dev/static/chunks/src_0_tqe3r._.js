(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/components/shared/ActionReason.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ActionReason",
    ()=>ActionReason
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// The desk convention for "this action exists but can't fire yet": the control
// stays focusable (aria-disabled, never the native disabled attribute), the
// click is guarded, and the *why* is announced three ways — title for pointer
// hover, aria-describedby for assistive tech, and (by default) a visible
// adjacent reason line for sighted keyboard/touch users, who a title alone
// never reaches. The reason text must never enter the button's accessible
// name: name-based queries and muscle memory both depend on the label staying
// stable whether or not the action is currently available.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
const FLASH_MS = 4000;
const FLASH_MAX_WIDTH = 280;
const flashPosition = (button)=>{
    const rect = button?.getBoundingClientRect();
    return rect ? {
        position: "fixed",
        top: rect.bottom + 6,
        left: Math.max(8, rect.right - FLASH_MAX_WIDTH),
        maxWidth: FLASH_MAX_WIDTH
    } : {};
};
const useReasonFlash = (reasonDisplay)=>{
    _s();
    const buttonRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [flashPos, setFlashPos] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const flashTimer = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useReasonFlash.useEffect": ()=>({
                "useReasonFlash.useEffect": ()=>{
                    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
                }
            })["useReasonFlash.useEffect"]
    }["useReasonFlash.useEffect"], []);
    const reveal = ()=>{
        if (reasonDisplay !== "hidden") return;
        setFlashPos(flashPosition(buttonRef.current));
        if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(()=>setFlashPos(null), FLASH_MS);
    };
    return {
        buttonRef,
        flashPos,
        reveal
    };
};
_s(useReasonFlash, "BNVIl/E99h1Q5iyY+FpZjYC+frc=");
function ActionReasonMessage({ inert, reasonId, reason, flashPos, reasonDisplay }) {
    if (!inert) return null;
    const flash = flashPos !== null;
    const showInline = reasonDisplay === "inline" || flash;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        id: reasonId,
        role: flash ? "status" : undefined,
        className: showInline ? `caos-action-reason${flash ? " caos-action-reason-pop" : ""}` : "sr-only",
        style: flash ? flashPos ?? undefined : undefined,
        children: reason
    }, void 0, false, {
        fileName: "[project]/src/components/shared/ActionReason.tsx",
        lineNumber: 70,
        columnNumber: 5
    }, this);
}
_c = ActionReasonMessage;
function ActionReason({ reason, actionTitle, reasonDisplay = "inline", onClick, children, type = "button", ...rest }) {
    _s1();
    const reasonId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    const inert = Boolean(reason);
    const { buttonRef, flashPos, reveal } = useReasonFlash(reasonDisplay);
    // A guarded click must never look ignored: in the "hidden" variant the
    // reason surfaces for a few seconds after the attempt (announced via
    // role=status). It renders as a viewport-positioned popover under the
    // button — an inline block span is invisible exactly where "hidden" is
    // used (SubHeader's shrink-0 primary-action slot clips it).
    const handleClick = inert ? reveal : onClick;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                ref: buttonRef,
                type: type,
                "aria-disabled": inert || undefined,
                title: reason || actionTitle || undefined,
                "aria-describedby": inert ? reasonId : undefined,
                onClick: handleClick,
                ...rest,
                children: children
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ActionReason.tsx",
                lineNumber: 101,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ActionReasonMessage, {
                inert: inert,
                reasonId: reasonId,
                reason: reason,
                flashPos: flashPos,
                reasonDisplay: reasonDisplay
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ActionReason.tsx",
                lineNumber: 112,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
_s1(ActionReason, "AXXhFEzI7qnQGr0YDjpd7uPPy78=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"],
        useReasonFlash
    ];
});
_c1 = ActionReason;
var _c, _c1;
__turbopack_context__.k.register(_c, "ActionReasonMessage");
__turbopack_context__.k.register(_c1, "ActionReason");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/LoginLanding.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LoginLanding",
    ()=>LoginLanding
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// Analyst sign-in / sign-up. Two lanes layered on the edge SSO gate:
//   • Sign in        — email + password           → POST /api/auth/login
//   • Create account — name + email + password + invite code → POST /api/auth/register
// Either mints the signed caos_analyst profile cookie; that name's initials then
// ride the chrome on every page and stamp every run. Shown by RequireAuth whenever
// no profile is signed in.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/axios/lib/axios.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingTabs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/useRovingTabs.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ActionReason.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RouteHeading$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/RouteHeading.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
const MODES = [
    "signin",
    "signup",
    "recover"
];
const inputCls = "rounded border border-caos-border bg-caos-elevated px-3 py-2 text-caos-text outline-none focus-ring focus:border-caos-accent transition-caos placeholder:text-caos-muted";
function Field({ label, children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
        className: "flex flex-col gap-1.5",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-caos-sm uppercase tracking-wider text-caos-muted",
                children: label
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 26,
                columnNumber: 7
            }, this),
            children
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/LoginLanding.tsx",
        lineNumber: 25,
        columnNumber: 5
    }, this);
}
_c = Field;
const EMPTY_WORDS = [
    "",
    "",
    ""
];
const INITIAL_FIELDS = {
    name: "",
    email: "",
    password: "",
    confirm: "",
    code: "",
    coverage: "TMT",
    location: "NA",
    recoveryWords: EMPTY_WORDS,
    recoveryWordConfirm: EMPTY_WORDS,
    recoveryHints: EMPTY_WORDS,
    showRecoveryWords: false
};
const COVERAGE_AREAS = [
    "TMT",
    "Industrials",
    "Healthcare",
    "Consumer",
    "Energy",
    "Financials",
    "Real Estate",
    "Other"
];
const LOCATIONS = [
    "NA",
    "EMEA",
    "APAC",
    "Other"
];
const RECOVERY_INDEXES = [
    0,
    1,
    2
];
function trimmed(values) {
    return values.map((value)=>value.trim());
}
function loginReady(mode, fields) {
    if (mode === "signup") {
        return Boolean(fields.name.trim() && fields.email.trim() && fields.password.length >= 12 && fields.confirm.length > 0 && fields.code.trim() && fields.recoveryWords.every((word, index)=>word.trim() && word.trim() === fields.recoveryWordConfirm[index].trim()));
    }
    if (mode === "recover") return Boolean(fields.email.trim() && fields.recoveryWords.every((word)=>word.trim()));
    return Boolean(fields.email.trim() && fields.password.length > 0);
}
function validationError(mode, fields) {
    if (mode !== "signup") return null;
    if (fields.password !== fields.confirm) return "Passcodes don't match.";
    if (fields.recoveryWords.some((word, index)=>word.trim() !== fields.recoveryWordConfirm[index].trim())) return "Recovery words don't match their confirmations.";
    return null;
}
async function authenticate(mode, fields) {
    if (mode === "signup") {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["register"])({
            code: fields.code.trim(),
            name: fields.name.trim(),
            email: fields.email.trim(),
            passcode: fields.password,
            coverage_area: fields.coverage,
            location: fields.location,
            recovery_words: trimmed(fields.recoveryWords),
            recovery_hints: trimmed(fields.recoveryHints)
        });
        return;
    }
    if (mode === "recover") {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["recoverLogin"])(fields.email.trim(), trimmed(fields.recoveryWords));
        return;
    }
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["login"])(fields.email.trim(), fields.password);
}
function submitLabel(mode, submitting) {
    if (submitting) return mode === "signup" ? "Creating…" : mode === "recover" ? "Recovering…" : "Signing in…";
    return mode === "signup" ? "Create account" : mode === "recover" ? "Recover access" : "Sign in";
}
function submitReason(mode, ready, submitting, label) {
    if (submitting) return label;
    if (ready) return null;
    if (mode === "signup") return "Fill in your name, email, a 12+ character passcode, confirmation, invite code, and all three recovery words.";
    if (mode === "recover") return "Enter your email and all three recovery words.";
    return "Enter your email and passcode.";
}
function clearRecovery(fields) {
    return {
        ...fields,
        recoveryWords: [
            ...EMPTY_WORDS
        ],
        recoveryWordConfirm: [
            ...EMPTY_WORDS
        ],
        recoveryHints: [
            ...EMPTY_WORDS
        ],
        showRecoveryWords: false
    };
}
function apiErrorMessage(error) {
    const detail = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].isAxiosError(error) ? error.response?.data?.detail : null;
    return typeof detail === "string" ? detail : "Something went wrong — try again.";
}
function useLoginForm(onSuccess) {
    _s();
    const [mode, setMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("signin");
    const [fields, setFields] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(INITIAL_FIELDS);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [submitting, setSubmitting] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const ready = loginReady(mode, fields);
    const label = submitLabel(mode, submitting);
    const setField = (key, value)=>setFields((current)=>({
                ...current,
                [key]: value
            }));
    const setRecovery = (key, index, value)=>{
        setFields((current)=>({
                ...current,
                [key]: current[key].map((item, itemIndex)=>itemIndex === index ? value : item)
            }));
    };
    const swap = (nextMode)=>{
        setMode(nextMode);
        setError(null);
        setFields(clearRecovery);
    };
    const submit = async (event)=>{
        event.preventDefault();
        if (!ready || submitting) return;
        setError(null);
        const invalid = validationError(mode, fields);
        if (invalid) {
            setError(invalid);
            return;
        }
        setSubmitting(true);
        try {
            await authenticate(mode, fields);
            setFields(clearRecovery);
            await onSuccess();
        } catch (reason) {
            setError(apiErrorMessage(reason));
            setSubmitting(false);
        }
    };
    return {
        mode,
        fields,
        error,
        submitting,
        ready,
        label,
        reason: submitReason(mode, ready, submitting, label),
        setField,
        setRecovery,
        swap,
        submit
    };
}
_s(useLoginForm, "3RyBSA2MusDBJ8LE/TWTJD5MLKk=");
function LoginHeader({ form }) {
    const title = form.mode === "signup" ? "Create your analyst account" : form.mode === "recover" ? "Recover analyst access" : "Analyst sign-in";
    const description = form.mode === "signup" ? "Access code, profile, passcode, and confirmed recovery words are required." : form.mode === "recover" ? "Enter your email and all three recovery words. Stored hints are not disclosed on this endpoint." : "Sign in with your email and passcode.";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col gap-1",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RouteHeading$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RouteHeadingOverride"], {
                title: title
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 155,
                columnNumber: 47
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "font-mono text-caos-sm uppercase tracking-[0.2em] text-caos-accent",
                children: "Credit Agent OS"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 155,
                columnNumber: 85
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "text-caos-text text-lg font-semibold",
                children: title
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 155,
                columnNumber: 192
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-caos-muted text-xs",
                children: description
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 155,
                columnNumber: 257
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/LoginLanding.tsx",
        lineNumber: 155,
        columnNumber: 10
    }, this);
}
_c1 = LoginHeader;
function LoginModeTabs({ form }) {
    _s1();
    const { getItemProps } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingTabs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRovingTabs"])(MODES.length, MODES.indexOf(form.mode), {
        "LoginModeTabs.useRovingTabs": (index)=>form.swap(MODES[index])
    }["LoginModeTabs.useRovingTabs"]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        role: "tablist",
        "aria-label": "Sign in or create account",
        className: "grid grid-cols-3 gap-1 rounded border border-caos-border p-1",
        children: MODES.map((mode, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                role: "tab",
                "aria-selected": form.mode === mode,
                onClick: ()=>form.swap(mode),
                ...getItemProps(index),
                className: `rounded px-3 py-1.5 text-caos-sm uppercase tracking-wider transition-caos focus-ring ${form.mode === mode ? "bg-caos-elevated text-caos-text" : "text-caos-muted hover:text-caos-text"}`,
                children: mode === "signin" ? "Sign in" : mode === "signup" ? "Create" : "Recover"
            }, mode, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 162,
                columnNumber: 35
            }, this))
    }, void 0, false, {
        fileName: "[project]/src/components/shared/LoginLanding.tsx",
        lineNumber: 161,
        columnNumber: 5
    }, this);
}
_s1(LoginModeTabs, "WbHOR3Gz+ZEnE13mqjU4mLjMmy8=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingTabs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRovingTabs"]
    ];
});
_c2 = LoginModeTabs;
function LoginCredentials({ form }) {
    const signup = form.mode === "signup";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            signup ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                label: "Analyst name",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                    type: "text",
                    name: "name",
                    value: form.fields.name,
                    onChange: (event)=>form.setField("name", event.target.value),
                    placeholder: "e.g. Eric Gub…",
                    autoComplete: "name",
                    maxLength: 120,
                    className: inputCls
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/LoginLanding.tsx",
                    lineNumber: 171,
                    columnNumber: 45
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 171,
                columnNumber: 17
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                label: "Email",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                    type: "email",
                    name: "email",
                    autoFocus: !signup,
                    value: form.fields.email,
                    onChange: (event)=>form.setField("email", event.target.value),
                    placeholder: "name@firm.com…",
                    autoComplete: signup ? "email" : "username",
                    spellCheck: false,
                    maxLength: 255,
                    className: inputCls
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/LoginLanding.tsx",
                    lineNumber: 172,
                    columnNumber: 28
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 172,
                columnNumber: 7
            }, this),
            form.mode !== "recover" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                label: "Login passcode",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                    type: "password",
                    name: "password",
                    value: form.fields.password,
                    onChange: (event)=>form.setField("password", event.target.value),
                    autoComplete: signup ? "new-password" : "current-password",
                    maxLength: 128,
                    className: inputCls
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/LoginLanding.tsx",
                    lineNumber: 173,
                    columnNumber: 64
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 173,
                columnNumber: 34
            }, this) : null
        ]
    }, void 0, true);
}
_c3 = LoginCredentials;
function SignupFields({ form }) {
    if (form.mode !== "signup") return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                        label: "Coverage area",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                            name: "coverage",
                            value: form.fields.coverage,
                            onChange: (event)=>form.setField("coverage", event.target.value),
                            className: inputCls,
                            children: COVERAGE_AREAS.map((area)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                    children: area
                                }, area, false, {
                                    fileName: "[project]/src/components/shared/LoginLanding.tsx",
                                    lineNumber: 183,
                                    columnNumber: 210
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/LoginLanding.tsx",
                            lineNumber: 183,
                            columnNumber: 38
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/LoginLanding.tsx",
                        lineNumber: 183,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                        label: "Location",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                            name: "location",
                            value: form.fields.location,
                            onChange: (event)=>form.setField("location", event.target.value),
                            className: inputCls,
                            children: LOCATIONS.map((location)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                    children: location
                                }, location, false, {
                                    fileName: "[project]/src/components/shared/LoginLanding.tsx",
                                    lineNumber: 184,
                                    columnNumber: 204
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/LoginLanding.tsx",
                            lineNumber: 184,
                            columnNumber: 33
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/LoginLanding.tsx",
                        lineNumber: 184,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 182,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                label: "Confirm passcode",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                    type: "password",
                    name: "confirm-password",
                    value: form.fields.confirm,
                    onChange: (event)=>form.setField("confirm", event.target.value),
                    autoComplete: "new-password",
                    maxLength: 128,
                    className: inputCls
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/LoginLanding.tsx",
                    lineNumber: 186,
                    columnNumber: 39
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 186,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                label: "Invite code",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                    type: "password",
                    name: "invite-code",
                    value: form.fields.code,
                    onChange: (event)=>form.setField("code", event.target.value),
                    inputMode: "numeric",
                    autoComplete: "off",
                    spellCheck: false,
                    maxLength: 64,
                    className: `${inputCls} tabular`
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/LoginLanding.tsx",
                    lineNumber: 187,
                    columnNumber: 34
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 187,
                columnNumber: 7
            }, this),
            form.fields.password.length > 0 && form.fields.password.length < 12 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-caos-sm text-caos-muted",
                children: "Passcode must be at least 12 characters."
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 188,
                columnNumber: 78
            }, this) : null
        ]
    }, void 0, true);
}
_c4 = SignupFields;
function RecoveryRow({ form, index }) {
    const signup = form.mode === "signup";
    const wordType = form.fields.showRecoveryWords ? "text" : "password";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: signup ? "grid gap-2 md:grid-cols-3" : "",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                label: `Recovery word ${index + 1}`,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                    type: wordType,
                    name: `recovery-word-${index + 1}`,
                    value: form.fields.recoveryWords[index],
                    onChange: (event)=>form.setRecovery("recoveryWords", index, event.target.value),
                    autoComplete: "off",
                    spellCheck: false,
                    maxLength: 80,
                    className: inputCls
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/LoginLanding.tsx",
                    lineNumber: 198,
                    columnNumber: 51
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 198,
                columnNumber: 7
            }, this),
            signup ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                label: `Confirm word ${index + 1}`,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                    type: wordType,
                    name: `confirm-recovery-word-${index + 1}`,
                    value: form.fields.recoveryWordConfirm[index],
                    onChange: (event)=>form.setRecovery("recoveryWordConfirm", index, event.target.value),
                    autoComplete: "off",
                    spellCheck: false,
                    maxLength: 80,
                    className: inputCls
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/LoginLanding.tsx",
                    lineNumber: 199,
                    columnNumber: 60
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 199,
                columnNumber: 17
            }, this) : null,
            signup ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                label: `Hint ${index + 1}`,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                    type: "text",
                    name: `recovery-hint-${index + 1}`,
                    value: form.fields.recoveryHints[index],
                    onChange: (event)=>form.setRecovery("recoveryHints", index, event.target.value),
                    autoComplete: "off",
                    maxLength: 160,
                    className: inputCls
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/LoginLanding.tsx",
                    lineNumber: 200,
                    columnNumber: 52
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 200,
                columnNumber: 17
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/LoginLanding.tsx",
        lineNumber: 197,
        columnNumber: 5
    }, this);
}
_c5 = RecoveryRow;
function RecoveryFields({ form }) {
    if (form.mode === "signin") return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col gap-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>form.setField("showRecoveryWords", !form.fields.showRecoveryWords),
                className: "self-start tabular text-caos-xs text-caos-muted hover:text-caos-text focus-ring rounded px-1",
                children: form.fields.showRecoveryWords ? "Hide recovery words" : "Reveal recovery words"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 209,
                columnNumber: 7
            }, this),
            RECOVERY_INDEXES.map((index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RecoveryRow, {
                    form: form,
                    index: index
                }, index, false, {
                    fileName: "[project]/src/components/shared/LoginLanding.tsx",
                    lineNumber: 210,
                    columnNumber: 40
                }, this))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/LoginLanding.tsx",
        lineNumber: 208,
        columnNumber: 5
    }, this);
}
_c6 = RecoveryFields;
function LoginForm({ form }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
        onSubmit: form.submit,
        className: "w-full max-w-sm flex flex-col gap-5 rounded-lg border border-caos-border bg-caos-panel p-7",
        "aria-describedby": form.error ? "login-error" : undefined,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LoginHeader, {
                form: form
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 218,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LoginModeTabs, {
                form: form
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 219,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LoginCredentials, {
                form: form
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 220,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SignupFields, {
                form: form
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 221,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RecoveryFields, {
                form: form
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 222,
                columnNumber: 7
            }, this),
            form.error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                id: "login-error",
                role: "alert",
                className: "text-caos-sm text-caos-critical",
                children: form.error
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 223,
                columnNumber: 21
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ActionReason"], {
                type: "submit",
                reason: form.reason,
                className: "rounded border border-caos-accent bg-caos-accent px-3 py-2 text-caos-bg font-semibold text-sm transition-caos hover:opacity-90 aria-disabled:opacity-40 aria-disabled:cursor-not-allowed focus-ring",
                children: form.label
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 224,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/LoginLanding.tsx",
        lineNumber: 217,
        columnNumber: 5
    }, this);
}
_c7 = LoginForm;
function LoginLanding({ onSuccess }) {
    _s2();
    const form = useLoginForm(onSuccess);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen flex items-center justify-center bg-caos-bg px-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LoginForm, {
            form: form
        }, void 0, false, {
            fileName: "[project]/src/components/shared/LoginLanding.tsx",
            lineNumber: 231,
            columnNumber: 89
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/LoginLanding.tsx",
        lineNumber: 231,
        columnNumber: 10
    }, this);
}
_s2(LoginLanding, "PMSi1/G3IzIa2AdIJ2G/a4N3kFE=", false, function() {
    return [
        useLoginForm
    ];
});
_c8 = LoginLanding;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8;
__turbopack_context__.k.register(_c, "Field");
__turbopack_context__.k.register(_c1, "LoginHeader");
__turbopack_context__.k.register(_c2, "LoginModeTabs");
__turbopack_context__.k.register(_c3, "LoginCredentials");
__turbopack_context__.k.register(_c4, "SignupFields");
__turbopack_context__.k.register(_c5, "RecoveryRow");
__turbopack_context__.k.register(_c6, "RecoveryFields");
__turbopack_context__.k.register(_c7, "LoginForm");
__turbopack_context__.k.register(_c8, "LoginLanding");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/RequireAuth.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RequireAuth",
    ()=>RequireAuth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AuthProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/AuthProvider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$LoginLanding$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/LoginLanding.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/SurfaceState.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
function RequireAuth({ children }) {
    _s();
    const { user, loading, error, needsLogin, refresh } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AuthProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    if (loading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "min-h-screen flex items-center justify-center bg-caos-bg px-4",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
                kind: "loading",
                title: "Checking analyst access",
                detail: "Verifying your CAOS session.",
                compact: true,
                className: "max-w-sm w-full"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/RequireAuth.tsx",
                lineNumber: 21,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/shared/RequireAuth.tsx",
            lineNumber: 20,
            columnNumber: 7
        }, this);
    }
    if (needsLogin) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$LoginLanding$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LoginLanding"], {
            onSuccess: refresh
        }, void 0, false, {
            fileName: "[project]/src/components/shared/RequireAuth.tsx",
            lineNumber: 27,
            columnNumber: 12
        }, this);
    }
    if (error || !user) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "min-h-screen flex items-center justify-center bg-caos-bg px-4",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
                kind: "error",
                title: "Analyst access could not be verified",
                detail: "The CAOS service did not respond. Check your connection, then retry. If it persists, contact your CAOS administrator.",
                primaryAction: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    onClick: ()=>refresh(),
                    type: "button",
                    className: "caos-action-primary focus-ring",
                    children: "Retry access check"
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/RequireAuth.tsx",
                    lineNumber: 38,
                    columnNumber: 13
                }, this),
                compact: true,
                className: "max-w-sm w-full text-center"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/RequireAuth.tsx",
                lineNumber: 33,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/shared/RequireAuth.tsx",
            lineNumber: 32,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: children
    }, void 0, false);
}
_s(RequireAuth, "eI39WB6W7oaMi1Ydhyo7F0z/rjc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AuthProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"]
    ];
});
_c = RequireAuth;
var _c;
__turbopack_context__.k.register(_c, "RequireAuth");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/Panel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Panel",
    ()=>Panel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
const usePanelBody = (collapsed)=>{
    _s();
    const [bodyElement, setBodyElement] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const bodyRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "usePanelBody.useCallback[bodyRef]": (element)=>setBodyElement(element)
    }["usePanelBody.useCallback[bodyRef]"], []);
    const [scrollable, setScrollable] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLayoutEffect"])({
        "usePanelBody.useLayoutEffect": ()=>{
            const element = bodyElement;
            if (!element) {
                setScrollable(false);
                return;
            }
            const measure = {
                "usePanelBody.useLayoutEffect.measure": ()=>setScrollable(element.scrollHeight > element.clientHeight + 1)
            }["usePanelBody.useLayoutEffect.measure"];
            measure();
            const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
            resizeObserver?.observe(element);
            for (const child of element.children)resizeObserver?.observe(child);
            const mutationObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver({
                "usePanelBody.useLayoutEffect": (records)=>{
                    for (const record of records){
                        for (const node of record.addedNodes){
                            if (node instanceof Element) resizeObserver?.observe(node);
                        }
                    }
                    measure();
                }
            }["usePanelBody.useLayoutEffect"]);
            mutationObserver?.observe(element, {
                subtree: true,
                childList: true,
                characterData: true
            });
            return ({
                "usePanelBody.useLayoutEffect": ()=>{
                    resizeObserver?.disconnect();
                    mutationObserver?.disconnect();
                }
            })["usePanelBody.useLayoutEffect"];
        }
    }["usePanelBody.useLayoutEffect"], [
        bodyElement,
        collapsed
    ]);
    return {
        bodyRef,
        scrollable
    };
};
_s(usePanelBody, "zGqxallMpDsAjLOr3HgNZ3RcqwI=");
function PanelHeading({ Heading, title, collapsible, collapsed, bodyId, onToggle }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Heading, {
        className: "caos-panel-title m-0 min-w-0 flex-1 tabular font-semibold text-caos-text",
        children: collapsible ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
            type: "button",
            onClick: onToggle,
            className: "-ml-1 flex h-7 w-full min-w-0 items-center gap-1 rounded px-1 text-left transition-caos hover:bg-caos-elevated/50 focus-ring",
            "aria-expanded": !collapsed,
            "aria-controls": bodyId,
            "aria-label": collapsed ? `Expand ${title} panel` : `Collapse ${title} panel`,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                    viewBox: "0 0 16 16",
                    "aria-hidden": "true",
                    className: "h-3.5 w-3.5 shrink-0 stroke-current text-caos-muted",
                    fill: "none",
                    strokeWidth: "2.5",
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                        d: collapsed ? "m4 6 4 4 4-4" : "m4 10 4-4 4 4"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Panel.tsx",
                        lineNumber: 61,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/Panel.tsx",
                    lineNumber: 60,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "truncate",
                    children: title
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/Panel.tsx",
                    lineNumber: 63,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/shared/Panel.tsx",
            lineNumber: 52,
            columnNumber: 9
        }, this) : title
    }, void 0, false, {
        fileName: "[project]/src/components/shared/Panel.tsx",
        lineNumber: 50,
        columnNumber: 5
    }, this);
}
_c = PanelHeading;
function PanelBody({ collapsed, bodyId, bodyRef, scrollable, title, children }) {
    if (collapsed) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        id: bodyId,
        ref: bodyRef,
        tabIndex: scrollable ? 0 : undefined,
        "aria-label": scrollable ? title : undefined,
        className: "flex-1 min-h-0 overflow-auto" + (scrollable ? " focus-ring" : ""),
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/shared/Panel.tsx",
        lineNumber: 87,
        columnNumber: 5
    }, this);
}
_c1 = PanelBody;
function Panel({ title, right, children, className = "", as: Heading = "h2", collapsible = false, defaultCollapsed = false, onCollapse }) {
    _s1();
    const [collapsed, setCollapsed] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(defaultCollapsed);
    const bodyId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    const { bodyRef, scrollable } = usePanelBody(collapsed);
    const toggleLocal = ()=>setCollapsed((current)=>!current);
    const toggle = onCollapse ?? toggleLocal;
    // Only a body that actually clips needs to be a keyboard-focusable scroll
    // region — measure real overflow so a panel whose content fits isn't an inert
    // tab stop (a dense page had ~9 of them before every real action).
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "bg-caos-panel border border-caos-border rounded-md flex flex-col min-h-0 " + className,
        style: collapsed ? {
            flex: "none",
            height: "auto"
        } : undefined,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: `caos-panel-header min-h-8 shrink-0 px-3 flex flex-wrap items-center gap-2 bg-caos-elevated/20 ${collapsed ? "" : "border-b border-caos-border"}`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PanelHeading, {
                        Heading: Heading,
                        title: title,
                        collapsible: collapsible,
                        collapsed: collapsed,
                        bodyId: bodyId,
                        onToggle: toggle
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Panel.tsx",
                        lineNumber: 133,
                        columnNumber: 9
                    }, this),
                    right ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "caos-panel-actions min-w-0",
                        children: right
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Panel.tsx",
                        lineNumber: 134,
                        columnNumber: 18
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/Panel.tsx",
                lineNumber: 132,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PanelBody, {
                collapsed: collapsed,
                bodyId: bodyId,
                bodyRef: bodyRef,
                scrollable: scrollable,
                title: title,
                children: children
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Panel.tsx",
                lineNumber: 140,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/Panel.tsx",
        lineNumber: 128,
        columnNumber: 5
    }, this);
}
_s1(Panel, "xaWxt+CFzRCOZXHiJZqECHPcraQ=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"],
        usePanelBody
    ];
});
_c2 = Panel;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "PanelHeading");
__turbopack_context__.k.register(_c1, "PanelBody");
__turbopack_context__.k.register(_c2, "Panel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/CrossDefaultDominoes.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CrossDefaultDominoes",
    ()=>CrossDefaultDominoes
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// Cross-default dominoes — which tranches a single facility default pulls in
// (CP-3B tranche register × the CP-4C material-indebtedness threshold).
// Shared by Issuer Profile and Deep-Dive's Covenants tab (P3 wiring, WP-4
// G13) so the two surfaces read the identical live map, never two competing
// computations of the same contagion question. Fetched lazily; when the run
// extracted no threshold or tranches the server's own honest `note` renders
// instead of a fabricated map — same contract both callers rely on.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/Panel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
function fmtMusd(value) {
    return Math.abs(value) >= 1000 ? "$" + (value / 1000).toFixed(1) + "bn" : "$" + value.toFixed(0) + "m";
}
function CrossDefaultDominoes({ issuerId, hasRun }) {
    _s();
    const [map, setMap] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Distinct from "no run yet" (hasRun=false, nothing fetched): a genuine fetch
    // failure (500/timeout/etc) must render an explicit error, not collapse to
    // the same silent nothing as "not applicable".
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CrossDefaultDominoes.useEffect": ()=>{
            if (!hasRun) return;
            let stale = false;
            setError(false);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCrossDefaultMap"])(issuerId).then({
                "CrossDefaultDominoes.useEffect": (d)=>{
                    if (!stale) setMap(d);
                }
            }["CrossDefaultDominoes.useEffect"]).catch({
                "CrossDefaultDominoes.useEffect": ()=>{
                    if (!stale) setError(true);
                }
            }["CrossDefaultDominoes.useEffect"]);
            return ({
                "CrossDefaultDominoes.useEffect": ()=>{
                    stale = true;
                }
            })["CrossDefaultDominoes.useEffect"];
        }
    }["CrossDefaultDominoes.useEffect"], [
        issuerId,
        hasRun
    ]);
    if (!hasRun) return null;
    if (error) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
            title: "Cross-default dominoes · CP-3B / CP-4C",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-3 py-2.5 text-caos-md text-caos-muted",
                children: "Couldn’t load cross-default data."
            }, void 0, false, {
                fileName: "[project]/src/components/shared/CrossDefaultDominoes.tsx",
                lineNumber: 39,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/shared/CrossDefaultDominoes.tsx",
            lineNumber: 38,
            columnNumber: 7
        }, this);
    }
    if (!map) return null;
    const computable = map.threshold_musd != null && map.dominoes.length > 0;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
        title: "Cross-default dominoes · CP-3B / CP-4C",
        right: map.threshold_musd != null ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "tabular text-caos-2xs text-caos-muted",
            children: [
                "trips ≥ ",
                fmtMusd(map.threshold_musd)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/shared/CrossDefaultDominoes.tsx",
            lineNumber: 49,
            columnNumber: 11
        }, this) : undefined,
        children: !computable ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "px-3 py-2.5 text-caos-md text-caos-muted",
            children: map.note || "No domino map for this run."
        }, void 0, false, {
            fileName: "[project]/src/components/shared/CrossDefaultDominoes.tsx",
            lineNumber: 53,
            columnNumber: 9
        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "text-caos-md divide-y divide-caos-border/30",
            children: map.dominoes.map((d)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "px-3 py-1.5 flex items-baseline gap-2 flex-wrap",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "tabular text-caos-sm text-caos-accent w-14 shrink-0",
                            children: d.code
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/CrossDefaultDominoes.tsx",
                            lineNumber: 58,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-caos-text text-caos-md truncate flex-1 min-w-0",
                            children: d.tranche
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/CrossDefaultDominoes.tsx",
                            lineNumber: 59,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "tabular text-caos-sm text-caos-muted shrink-0",
                            children: d.amount_musd != null ? fmtMusd(d.amount_musd) : "unsized"
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/CrossDefaultDominoes.tsx",
                            lineNumber: 60,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "tabular text-caos-xs w-32 text-right shrink-0",
                            style: {
                                color: d.trips_cross_default === true ? "var(--caos-critical)" : d.trips_cross_default === false ? "var(--caos-muted)" : "var(--caos-idle)"
                            },
                            children: d.trips_cross_default === true ? `⚠ pulls in ${d.pulls_in.length} tranche${d.pulls_in.length === 1 ? "" : "s"}` : d.trips_cross_default === false ? "— below threshold" : "◦ not computable"
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/CrossDefaultDominoes.tsx",
                            lineNumber: 63,
                            columnNumber: 15
                        }, this),
                        d.trips_cross_default === true && d.pulls_in.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "basis-full flex items-center gap-1 pl-16 flex-wrap",
                            children: d.pulls_in.map((p)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "tabular text-caos-3xs uppercase tracking-wider px-1.5 py-px rounded border whitespace-nowrap",
                                    style: {
                                        color: "var(--caos-critical)",
                                        borderColor: "color-mix(in srgb, var(--caos-critical) 40%, transparent)",
                                        background: "color-mix(in srgb, var(--caos-critical) 8%, transparent)"
                                    },
                                    children: p
                                }, p, false, {
                                    fileName: "[project]/src/components/shared/CrossDefaultDominoes.tsx",
                                    lineNumber: 74,
                                    columnNumber: 21
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/CrossDefaultDominoes.tsx",
                            lineNumber: 72,
                            columnNumber: 17
                        }, this) : null
                    ]
                }, d.code, true, {
                    fileName: "[project]/src/components/shared/CrossDefaultDominoes.tsx",
                    lineNumber: 57,
                    columnNumber: 13
                }, this))
        }, void 0, false, {
            fileName: "[project]/src/components/shared/CrossDefaultDominoes.tsx",
            lineNumber: 55,
            columnNumber: 9
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/CrossDefaultDominoes.tsx",
        lineNumber: 46,
        columnNumber: 5
    }, this);
}
_s(CrossDefaultDominoes, "NKsLCqGa9wArOCOtaxzd3jXmuB4=");
_c = CrossDefaultDominoes;
var _c;
__turbopack_context__.k.register(_c, "CrossDefaultDominoes");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/query/VaultMemoUpload.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "VaultMemoUpload",
    ()=>VaultMemoUpload
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// Analyst memo intake — upload market/research commentary into the Obsidian
// vault (Analyst-Memos/). The server auto-wikilinks covered issuer names and
// tickers, so a plain note lands in the Wiki & Memos graph without the analyst
// hand-writing [[links]]. Esc / ✕ / backdrop to close.
//
// With an ``issuer`` prop this becomes the Issuer Profile's "Log a note"
// quick-capture: a typed note is composed client-side into a .md memo whose
// header mentions the issuer (name + ticker), so the SAME upload endpoint +
// autolink + memochunks path tags it to the issuer — no new store, no new
// schema (plan D4).
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/CloseButton.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Notifications$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/Notifications.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/use-modal-a11y.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ModalBackdrop.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ActionReason.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
const MEMO_TYPES = [
    {
        id: "market-commentary",
        label: "Market commentary"
    },
    {
        id: "research",
        label: "Research"
    },
    {
        id: "memo",
        label: "Memo"
    }
];
const ACCEPT = ".md,.txt,.pdf";
function VaultMemoUpload({ onUploaded, issuer }) {
    _s();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>setOpen(true),
                className: "tabular text-caos-xs px-2 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring whitespace-nowrap",
                title: issuer ? `Log a quick note tagged to ${issuer.name} in the Obsidian vault` : "Upload market or research commentary into the Obsidian vault",
                children: issuer ? "LOG NOTE" : "ADD MEMO"
            }, void 0, false, {
                fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                lineNumber: 51,
                columnNumber: 7
            }, this),
            open && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MemoDialog, {
                onClose: ()=>setOpen(false),
                onUploaded: onUploaded,
                issuer: issuer
            }, void 0, false, {
                fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                lineNumber: 61,
                columnNumber: 16
            }, this)
        ]
    }, void 0, true);
}
_s(VaultMemoUpload, "xG1TONbKtDWtdOTrXaTAsNhPg/Q=");
_c = VaultMemoUpload;
function composeIssuerMemo(issuer, note) {
    if (!issuer || !note.trim()) return null;
    const ticker = issuer.ticker ? ` (${issuer.ticker})` : "";
    return new File([
        `# Note — ${issuer.name}${ticker}\n\n${note.trim()}\n`
    ], `note-${new Date().toISOString().slice(0, 10)}.md`, {
        type: "text/markdown"
    });
}
function memoUploadError(error) {
    const responseDetail = error?.response?.data?.detail;
    return String(responseDetail || error?.message || "upload failed");
}
function MemoDialogHeader({ issuer, onClose }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "h-9 shrink-0 px-3 flex items-center gap-2 border-b border-caos-border bg-caos-elevated/70",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-md uppercase tracking-wider text-caos-muted",
                children: issuer ? "Log a note" : "Add memo to vault"
            }, void 0, false, {
                fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                lineNumber: 84,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1"
            }, void 0, false, {
                fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                lineNumber: 85,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CloseButton"], {
                onClick: onClose,
                label: "Close memo upload"
            }, void 0, false, {
                fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                lineNumber: 86,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
        lineNumber: 83,
        columnNumber: 5
    }, this);
}
_c1 = MemoDialogHeader;
function MemoDestination({ issuer }) {
    if (issuer) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "text-caos-2xs text-caos-muted font-mono leading-normal",
            children: [
                "Tagged to ",
                issuer.name,
                issuer.ticker ? ` (${issuer.ticker})` : "",
                " → Analyst-Memos/ in the Obsidian vault; appears under Analyst notes and the Wiki & Memos graph."
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
            lineNumber: 93,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "text-caos-2xs text-caos-muted font-mono leading-normal",
        children: "Market or research commentary → Analyst-Memos/ in the Obsidian vault. Covered issuer names and tickers are wikilinked automatically and appear under Wiki & Memos."
    }, void 0, false, {
        fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
        lineNumber: 95,
        columnNumber: 10
    }, this);
}
_c2 = MemoDestination;
function MemoTypeSelect({ value, onChange }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
        className: "flex items-center gap-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-3xs uppercase tracking-wider text-caos-muted w-16 shrink-0",
                children: "Type"
            }, void 0, false, {
                fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                lineNumber: 101,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                value: value,
                onChange: (event)=>onChange(event.target.value),
                className: "focus-ring h-7 flex-1 rounded border border-caos-border bg-caos-elevated px-2 tabular text-caos-sm text-caos-text outline-none transition-caos hover:border-caos-accent/60",
                children: MEMO_TYPES.map((type)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                        value: type.id,
                        children: type.label
                    }, type.id, false, {
                        fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                        lineNumber: 103,
                        columnNumber: 35
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                lineNumber: 102,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
        lineNumber: 100,
        columnNumber: 5
    }, this);
}
_c3 = MemoTypeSelect;
function MemoInput({ issuer, note, fileRef, onNoteChange, onFileChange }) {
    if (issuer) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
            value: note,
            onChange: (event)=>onNoteChange(event.target.value),
            rows: 5,
            placeholder: "What did you learn? Plain text lands as a tagged vault memo…",
            "aria-label": "Note text",
            className: "focus-ring w-full rounded border border-caos-border bg-caos-elevated px-2 py-1.5 tabular text-caos-sm text-caos-text outline-none transition-caos hover:border-caos-accent/60 resize-y"
        }, void 0, false, {
            fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
            lineNumber: 117,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
        className: "flex items-center gap-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-3xs uppercase tracking-wider text-caos-muted w-16 shrink-0",
                children: "File"
            }, void 0, false, {
                fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                lineNumber: 121,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                ref: fileRef,
                type: "file",
                name: "vault-memo-file",
                autoComplete: "off",
                accept: ACCEPT,
                onChange: (event)=>onFileChange(event.target.files?.[0] ?? null),
                className: "focus-ring flex-1 min-w-0 tabular text-caos-xs text-caos-text file:mr-2 file:px-2 file:py-1 file:rounded file:border file:border-caos-border file:bg-caos-elevated file:text-caos-text file:text-caos-xs file:cursor-pointer",
                "aria-label": "Memo file (.md, .txt or .pdf)"
            }, void 0, false, {
                fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                lineNumber: 122,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
        lineNumber: 120,
        columnNumber: 5
    }, this);
}
_c4 = MemoInput;
function MemoActions({ issuer, busy, ready, onClose, onSubmit }) {
    const missingReason = issuer ? "Type a note first" : "Choose a file first";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center justify-end gap-2 pt-1",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: onClose,
                className: "tabular text-caos-xs px-3 py-1 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos focus-ring",
                children: "CANCEL"
            }, void 0, false, {
                fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                lineNumber: 137,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ActionReason"], {
                onClick: onSubmit,
                reason: busy ? "Uploading…" : !ready ? missingReason : null,
                className: "tabular text-caos-xs px-3 py-1 rounded bg-caos-accent text-caos-bg font-semibold hover:opacity-90 transition-caos focus-ring aria-disabled:opacity-40 aria-disabled:cursor-not-allowed",
                children: busy ? "UPLOADING…" : issuer ? "SAVE NOTE" : "UPLOAD"
            }, void 0, false, {
                fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                lineNumber: 138,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
        lineNumber: 136,
        columnNumber: 5
    }, this);
}
_c5 = MemoActions;
function MemoDialog({ onClose, onUploaded, issuer }) {
    _s1();
    const [memoType, setMemoType] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(issuer ? "memo" : MEMO_TYPES[0].id);
    const [file, setFile] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [note, setNote] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [err, setErr] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const fileRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const notify = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Notifications$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useNotify"])();
    const panelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useModalA11y"])(onClose);
    // Quick-capture: compose the typed note into a plain .md memo whose first
    // line mentions the issuer (and ticker), so the server's autolinker tags it
    // — the note travels the exact same vault path as a file upload.
    const composed = composeIssuerMemo(issuer, note);
    const payload = issuer ? composed : file;
    const submit = async ()=>{
        if (!payload || busy) return;
        setBusy(true);
        setErr(null);
        const fd = new FormData();
        fd.append("memo_type", memoType);
        fd.append("file", payload);
        try {
            const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uploadVaultMemo"])(fd);
            notify("Memo vaulted", `${res.note} — ${res.issuer_links.length} issuer link${res.issuer_links.length === 1 ? "" : "s"}`);
            onUploaded?.(res);
            onClose();
        } catch (error) {
            setErr(memoUploadError(error));
        } finally{
            setBusy(false);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ModalBackdrop"], {
        onClose: onClose,
        className: "caos-enter",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            ref: panelRef,
            className: "w-[440px] max-w-[92vw] flex flex-col bg-caos-panel border border-caos-accent/50 rounded-md overflow-hidden",
            style: {
                boxShadow: "var(--shadow-modal)"
            },
            onClick: (e)=>e.stopPropagation(),
            role: "dialog",
            "aria-modal": "true",
            "aria-label": issuer ? "Log a note to the vault" : "Upload memo to vault",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MemoDialogHeader, {
                    issuer: issuer,
                    onClose: onClose
                }, void 0, false, {
                    fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                    lineNumber: 194,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "p-4 flex flex-col gap-3",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MemoDestination, {
                            issuer: issuer
                        }, void 0, false, {
                            fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                            lineNumber: 196,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MemoTypeSelect, {
                            value: memoType,
                            onChange: setMemoType
                        }, void 0, false, {
                            fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                            lineNumber: 197,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MemoInput, {
                            issuer: issuer,
                            note: note,
                            fileRef: fileRef,
                            onNoteChange: setNote,
                            onFileChange: setFile
                        }, void 0, false, {
                            fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                            lineNumber: 198,
                            columnNumber: 11
                        }, this),
                        err ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "tabular text-caos-xs text-caos-warning",
                            role: "alert",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    "aria-hidden": true,
                                    children: "!"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                                    lineNumber: 199,
                                    columnNumber: 87
                                }, this),
                                " ",
                                err
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                            lineNumber: 199,
                            columnNumber: 18
                        }, this) : null,
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MemoActions, {
                            issuer: issuer,
                            busy: busy,
                            ready: Boolean(payload),
                            onClose: onClose,
                            onSubmit: submit
                        }, void 0, false, {
                            fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                            lineNumber: 200,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
                    lineNumber: 195,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
            lineNumber: 185,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/query/VaultMemoUpload.tsx",
        lineNumber: 184,
        columnNumber: 5
    }, this);
}
_s1(MemoDialog, "6fkehM5xLdt/Q/CRu3jJdlFmBMY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Notifications$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useNotify"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useModalA11y"]
    ];
});
_c6 = MemoDialog;
var _c, _c1, _c2, _c3, _c4, _c5, _c6;
__turbopack_context__.k.register(_c, "VaultMemoUpload");
__turbopack_context__.k.register(_c1, "MemoDialogHeader");
__turbopack_context__.k.register(_c2, "MemoDestination");
__turbopack_context__.k.register(_c3, "MemoTypeSelect");
__turbopack_context__.k.register(_c4, "MemoInput");
__turbopack_context__.k.register(_c5, "MemoActions");
__turbopack_context__.k.register(_c6, "MemoDialog");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/MoreDrawer.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MoreDrawer",
    ()=>MoreDrawer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2d$dom$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react-dom/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
function MoreDrawer({ open, onOpenChange, children, triggerLabel = "More", triggerId, align = "right" }) {
    _s();
    const triggerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const panelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [pos, setPos] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Anchor the fixed panel to the trigger rect. useLayoutEffect so the panel
    // never paints a frame at (0,0). Re-measures on open; window resize/scroll
    // just closes it (a popover is glance-and-return).
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLayoutEffect"])({
        "MoreDrawer.useLayoutEffect": ()=>{
            if (!open || !triggerRef.current) {
                setPos(null);
                return;
            }
            const r = triggerRef.current.getBoundingClientRect();
            setPos(align === "left" ? {
                top: r.bottom + 4,
                left: r.left
            } : {
                top: r.bottom + 4,
                right: window.innerWidth - r.right
            });
        }
    }["MoreDrawer.useLayoutEffect"], [
        open,
        align
    ]);
    // Move focus to the first focusable element when the drawer opens, so the
    // Tab trap works from the start. Stays on the trigger on close (restores).
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MoreDrawer.useEffect": ()=>{
            if (!open) return;
            const raf = requestAnimationFrame({
                "MoreDrawer.useEffect.raf": ()=>{
                    const panel = panelRef.current;
                    if (!panel) return;
                    const focusables = Array.from(panel.querySelectorAll('a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter({
                        "MoreDrawer.useEffect.raf.focusables": (el)=>el.offsetParent !== null
                    }["MoreDrawer.useEffect.raf.focusables"]);
                    if (focusables.length > 0) focusables[0].focus();
                    else panel.focus();
                }
            }["MoreDrawer.useEffect.raf"]);
            return ({
                "MoreDrawer.useEffect": ()=>cancelAnimationFrame(raf)
            })["MoreDrawer.useEffect"];
        }
    }["MoreDrawer.useEffect"], [
        open
    ]);
    // Close on outside click (pointerdown so it fires before the click lands on
    // the page behind the drawer — a click on the page would otherwise navigate).
    // Also close on scroll/resize since the fixed panel no longer tracks the
    // trigger (glance-and-return — reopening re-anchors).
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MoreDrawer.useEffect": ()=>{
            if (!open) return;
            const onPointer = {
                "MoreDrawer.useEffect.onPointer": (e)=>{
                    if (panelRef.current?.contains(e.target)) return;
                    if (triggerRef.current?.contains(e.target)) return;
                    onOpenChange(false);
                    triggerRef.current?.focus();
                }
            }["MoreDrawer.useEffect.onPointer"];
            const onKey = {
                "MoreDrawer.useEffect.onKey": (e)=>{
                    if (e.key === "Escape") {
                        onOpenChange(false);
                        triggerRef.current?.focus();
                    }
                }
            }["MoreDrawer.useEffect.onKey"];
            const onResize = {
                "MoreDrawer.useEffect.onResize": ()=>onOpenChange(false)
            }["MoreDrawer.useEffect.onResize"];
            // Close when the PAGE scrolls (the fixed panel would detach from its
            // trigger), but ignore scrolls inside the panel's own list — auto-focus
            // scrolls that list on open and must not self-close the drawer.
            const onScroll = {
                "MoreDrawer.useEffect.onScroll": (e)=>{
                    if (panelRef.current?.contains(e.target)) return;
                    onOpenChange(false);
                }
            }["MoreDrawer.useEffect.onScroll"];
            window.addEventListener("pointerdown", onPointer);
            window.addEventListener("keydown", onKey);
            window.addEventListener("resize", onResize);
            window.addEventListener("scroll", onScroll, true);
            return ({
                "MoreDrawer.useEffect": ()=>{
                    window.removeEventListener("pointerdown", onPointer);
                    window.removeEventListener("keydown", onKey);
                    window.removeEventListener("resize", onResize);
                    window.removeEventListener("scroll", onScroll, true);
                }
            })["MoreDrawer.useEffect"];
        }
    }["MoreDrawer.useEffect"], [
        open,
        onOpenChange
    ]);
    // Focus trap — Tab cycles within the drawer. Does NOT scroll-lock the body
    // (this is a popover, not a modal).
    const onKeyDown = (e)=>{
        if (e.key !== "Tab" || !panelRef.current) return;
        const focusables = Array.from(panelRef.current.querySelectorAll('a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter((el)=>el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        // Recapture: if focus escaped (e.g. a control re-rendered disabled), pull
        // it back to the first focusable on the next Tab.
        if (!active || !panelRef.current.contains(active)) {
            e.preventDefault();
            first.focus();
        } else if (e.shiftKey && (active === first || active === panelRef.current)) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative shrink-0",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                id: triggerId,
                ref: triggerRef,
                type: "button",
                onClick: ()=>onOpenChange(!open),
                "aria-expanded": open,
                "aria-haspopup": "dialog",
                "aria-label": `Open ${triggerLabel}`,
                className: "caos-utility-trigger tabular text-caos-xs px-2 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring whitespace-nowrap",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        "aria-hidden": "true",
                        children: "⋯"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/MoreDrawer.tsx",
                        lineNumber: 147,
                        columnNumber: 9
                    }, this),
                    " ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "caos-utility-trigger-label",
                        children: triggerLabel
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/MoreDrawer.tsx",
                        lineNumber: 147,
                        columnNumber: 43
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/MoreDrawer.tsx",
                lineNumber: 137,
                columnNumber: 7
            }, this),
            open && pos && typeof document !== "undefined" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2d$dom$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createPortal"])(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                ref: panelRef,
                role: "dialog",
                tabIndex: -1,
                "aria-label": triggerLabel,
                onKeyDown: onKeyDown,
                className: "fixed z-overlay w-64 rounded-md border border-caos-border bg-caos-panel p-2 flex flex-col gap-1",
                style: {
                    boxShadow: "var(--shadow-pop)",
                    top: pos.top,
                    left: pos.left,
                    right: pos.right
                },
                children: children
            }, void 0, false, {
                fileName: "[project]/src/components/shared/MoreDrawer.tsx",
                lineNumber: 150,
                columnNumber: 9
            }, this), document.body)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/MoreDrawer.tsx",
        lineNumber: 136,
        columnNumber: 5
    }, this);
}
_s(MoreDrawer, "hQdDU+LpgJ8Vd54a309F3vSKBzA=");
_c = MoreDrawer;
var _c;
__turbopack_context__.k.register(_c, "MoreDrawer");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/ConceptNav.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ConceptNav",
    ()=>ConceptNav
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// Concept switcher — every concept link, shown in every sub-header so users
// can jump between concepts from anywhere. Concepts render in workflow groups
// (Intake / Analyze / Decide / Publish / Monitor) from the shared registry in
// lib/nav.ts — the same registry drives the Alt+←/→ cycle order, so the nav
// and the hotkeys can never drift. `compact` (dense concept-page headers)
// labels only the active chip and its group (you-are-here); the rest are
// icon + tooltip, and inactive group labels collapse to separators so the
// 40px strip survives 1280px next to dense page headers. The directory always
// shows full labels. Glyphs are small inline SVGs (stroke = currentColor) — no
// icon-font dependency, consistent with the terminal chrome.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AnalystBadge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/AnalystBadge.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$MoreDrawer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/MoreDrawer.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RoleViewSwitch$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/RoleViewSwitch.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/nav.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Ask$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/Ask.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
/** Full-label concept list in a popover — the guaranteed nav path below the
 *  rail breakpoint. The icon chip row is a quick-jump enhancement that can
 *  scroll off; this drawer always reaches every destination, at every width
 *  down to phones (the chips row hides <768px, the trigger does not). */ function ConceptsDrawer({ pathname, preserveContext }) {
    _s();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$MoreDrawer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MoreDrawer"], {
        open: open,
        onOpenChange: setOpen,
        triggerLabel: "Workflows",
        triggerId: "workflow-disclosure",
        align: "left",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "border-b border-caos-border/60 px-2 pb-2",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RoleViewSwitch$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RoleViewSwitch"], {}, void 0, false, {
                    fileName: "[project]/src/components/shared/ConceptNav.tsx",
                    lineNumber: 38,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 37,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                "aria-label": "All Workflows",
                className: "flex max-h-[70vh] flex-col gap-1 overflow-y-auto",
                children: [
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NAV_GROUPS"].map((g)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            "aria-label": g.label,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "px-2 pt-1 text-caos-2xs uppercase tracking-widest text-caos-muted select-none",
                                    children: g.label
                                }, void 0, false, {
                                    fileName: "[project]/src/components/shared/ConceptNav.tsx",
                                    lineNumber: 43,
                                    columnNumber: 13
                                }, this),
                                g.items.map((s)=>{
                                    const active = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["routeMatches"])(pathname, s.href);
                                    const Glyph = ICONS[s.icon];
                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                        href: preserveContext(s.href),
                                        prefetch: false,
                                        "aria-current": active ? "page" : undefined,
                                        onClick: ()=>setOpen(false),
                                        className: `caos-rail-link no-underline flex items-center gap-2 ${active ? "caos-rail-link-active" : ""}`,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Glyph, {
                                                className: active ? "text-caos-accent" : ""
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                                                lineNumber: 56,
                                                columnNumber: 19
                                            }, this),
                                            s.label
                                        ]
                                    }, s.href, true, {
                                        fileName: "[project]/src/components/shared/ConceptNav.tsx",
                                        lineNumber: 48,
                                        columnNumber: 17
                                    }, this);
                                })
                            ]
                        }, g.id, true, {
                            fileName: "[project]/src/components/shared/ConceptNav.tsx",
                            lineNumber: 42,
                            columnNumber: 11
                        }, this)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        "aria-label": "Utility",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: preserveContext("/settings"),
                            prefetch: false,
                            "aria-current": pathname.startsWith("/settings") ? "page" : undefined,
                            onClick: ()=>setOpen(false),
                            className: `caos-rail-link no-underline flex items-center gap-2 ${pathname.startsWith("/settings") ? "caos-rail-link-active" : ""}`,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ICONS.settings, {}, void 0, false, {
                                    fileName: "[project]/src/components/shared/ConceptNav.tsx",
                                    lineNumber: 71,
                                    columnNumber: 13
                                }, this),
                                "Settings"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/shared/ConceptNav.tsx",
                            lineNumber: 64,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/ConceptNav.tsx",
                        lineNumber: 63,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 40,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/ConceptNav.tsx",
        lineNumber: 36,
        columnNumber: 5
    }, this);
}
_s(ConceptsDrawer, "xG1TONbKtDWtdOTrXaTAsNhPg/Q=");
_c = ConceptsDrawer;
const svg = (children)=>function I({ className }) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            viewBox: "0 0 14 14",
            width: "12",
            height: "12",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "1.3",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            className: "shrink-0 " + (className ?? ""),
            "aria-hidden": "true",
            children: children
        }, void 0, false, {
            fileName: "[project]/src/components/shared/ConceptNav.tsx",
            lineNumber: 85,
            columnNumber: 7
        }, this);
    };
const ICONS = {
    directory: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
            d: "M1.6 3.4h4.2l1 1.4h5.6v6.8H1.6z"
        }, void 0, false, {
            fileName: "[project]/src/components/shared/ConceptNav.tsx",
            lineNumber: 104,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false)),
    command: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                x: "1.6",
                y: "1.6",
                width: "4.3",
                height: "4.3",
                rx: "1"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 107,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                x: "8.1",
                y: "1.6",
                width: "4.3",
                height: "4.3",
                rx: "1"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 107,
                columnNumber: 61
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                x: "1.6",
                y: "8.1",
                width: "4.3",
                height: "4.3",
                rx: "1"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 108,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                x: "8.1",
                y: "8.1",
                width: "4.3",
                height: "4.3",
                rx: "1"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 108,
                columnNumber: 61
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    portfolio: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M2 3.2h10v8H2zM4.2 3.2V2h5.6v1.2"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 111,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M2 6.2h10M5.3 6.2v5.1M8.7 6.2v5.1"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 112,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    decisions: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M3 1.8h6.3l1.7 1.7v8.7H3z"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 115,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M9.3 1.8v2h1.8M5 6h4M5 8.3h4M5 10.6h2.4"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 116,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    pipeline: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M7 3.2v3M7 6.2H3.4v3.4M7 6.2h3.6v3.4"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 119,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "7",
                cy: "2.2",
                r: "1.1"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 120,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "3.4",
                cy: "11",
                r: "1.1"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 120,
                columnNumber: 39
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "10.6",
                cy: "11",
                r: "1.1"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 120,
                columnNumber: 74
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    deepdive: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "5.9",
                cy: "5.9",
                r: "3.5"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 122,
                columnNumber: 19
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M8.7 8.7l3.4 3.4"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 122,
                columnNumber: 55
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    model: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                x: "1.8",
                y: "2.6",
                width: "10.4",
                height: "8.8",
                rx: "1"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 123,
                columnNumber: 16
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M1.8 5.6h10.4M5.4 5.6v5.8"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 123,
                columnNumber: 73
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    report: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M3.6 1.9h4.6L11 4.7v7.4H3.6z"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 124,
                columnNumber: 17
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M5.4 6.6h4M5.4 8.8h4"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 124,
                columnNumber: 58
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    monitor: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
        d: "M1.5 7.4h2.6l1.6-4 2.2 7 1.5-3h3.1"
    }, void 0, false, {
        fileName: "[project]/src/components/shared/ConceptNav.tsx",
        lineNumber: 125,
        columnNumber: 16
    }, ("TURBOPACK compile-time value", void 0))),
    research: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M5.5 1.8v3.3L2.5 10.8a1 1 0 0 0 .9 1.5h7.2a1 1 0 0 0 .9-1.5L8.5 5.1V1.8"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 127,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M4.5 1.8h5M4.4 8.2h5.2"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 128,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    sponsors: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "4",
                cy: "5",
                r: "2"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 131,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "10",
                cy: "5",
                r: "2"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 131,
                columnNumber: 35
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M1.5 11c.5-2 1.6-3 3.3-3s2.8 1 3.2 3M6 11c.5-1.8 1.5-2.7 3-2.7 1.8 0 3 .9 3.5 2.7"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 132,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    query: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "7",
                cy: "3.2",
                r: "1.5"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 135,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "3.2",
                cy: "10.2",
                r: "1.5"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 135,
                columnNumber: 39
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "10.8",
                cy: "10.2",
                r: "1.5"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 135,
                columnNumber: 76
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M6.2 4.5 4 8.9M7.8 4.5 10 8.9M4.7 10.2h4.6"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 136,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    sector: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M2 3.2h10M2 7h10M2 10.8h10"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 139,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M3.4 1.8v2.8M7 5.6v2.8M10.6 9.4v2.8"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 140,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    "sector-rv": svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
            d: "M1.5 12.5h11M3.5 12.5v-4M7 12.5v-8M10.5 12.5v-6"
        }, void 0, false, {
            fileName: "[project]/src/components/shared/ConceptNav.tsx",
            lineNumber: 143,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false)),
    upload: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M7 9.6V2.4M4.4 5 7 2.4 9.6 5"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 146,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M2 9.6v2.2a.8.8 0 0 0 .8.8h8.4a.8.8 0 0 0 .8-.8V9.6"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 147,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    settings: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "7",
                cy: "7",
                r: "2.1"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 150,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M7 1.5v1.6M7 10.9v1.6M12.5 7h-1.6M3.1 7H1.5M10.9 3.1 9.8 4.2M4.2 9.8l-1.1 1.1M10.9 10.9 9.8 9.8M4.2 4.2 3.1 3.1"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 151,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true))
};
function ConceptNav({ compact = false }) {
    _s1();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    const [analysisContextId, setAnalysisContextId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ConceptNav.useEffect": ()=>{
            setAnalysisContextId(new URLSearchParams(window.location.search).get("context"));
            const onContext = {
                "ConceptNav.useEffect.onContext": (event)=>{
                    const detail = event.detail;
                    if (detail?.id) setAnalysisContextId(detail.id);
                }
            }["ConceptNav.useEffect.onContext"];
            window.addEventListener("caos:analysis-context", onContext);
            return ({
                "ConceptNav.useEffect": ()=>window.removeEventListener("caos:analysis-context", onContext)
            })["ConceptNav.useEffect"];
        }
    }["ConceptNav.useEffect"], [
        pathname
    ]);
    const preserveContext = (href)=>analysisContextId ? `${href}${href.includes("?") ? "&" : "?"}context=${encodeURIComponent(analysisContextId)}` : href;
    const Gear = ICONS.settings;
    const settingsActive = pathname.startsWith("/settings");
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "caos-compact-nav items-center gap-1 min-w-0 max-w-full",
        children: [
            compact && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ConceptsDrawer, {
                pathname: pathname,
                preserveContext: preserveContext
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 176,
                columnNumber: 19
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "caos-concept-chips flex flex-1 items-center gap-1 min-w-0 overflow-x-auto",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                        id: "concept-nav",
                        "aria-label": compact ? "Current workflow" : "Concepts",
                        className: "flex items-center gap-1 shrink-0",
                        title: "Tip: hold ALT + ← / → to switch concepts",
                        children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NAV_GROUPS"].map((g, gIdx)=>{
                            const groupActive = g.items.some((i)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["routeMatches"])(pathname, i.href));
                            // Group labels carry the workflow stage. In compact mode only the
                            // active group is labeled (you-are-here); inactive groups collapse
                            // to a separator so dense page headers still fit at 1280px (RT-60).
                            const showGroupLabel = !compact || groupActive;
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "flex items-center gap-1",
                                children: [
                                    gIdx > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "h-4 w-px bg-caos-border mx-0.5",
                                        "aria-hidden": "true"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/shared/ConceptNav.tsx",
                                        lineNumber: 195,
                                        columnNumber: 28
                                    }, this),
                                    showGroupLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-caos-2xs uppercase tracking-widest text-caos-muted select-none pl-0.5 pr-0.5",
                                        "aria-hidden": "true",
                                        title: g.label,
                                        children: g.label
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/shared/ConceptNav.tsx",
                                        lineNumber: 197,
                                        columnNumber: 17
                                    }, this),
                                    g.items.map((s)=>{
                                        // The Directory chip is self-referential (and a wide full-label
                                        // entry) on /issuers itself, the one page rendering the
                                        // non-compact nav — drop it there rather than overflow the
                                        // header; every other page keeps it as the back-link.
                                        if (!compact && s.href === "/issuers") return null;
                                        const active = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["routeMatches"])(pathname, s.href);
                                        if (compact && !active) return null;
                                        const Glyph = ICONS[s.icon];
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                            href: preserveContext(s.href),
                                            prefetch: false,
                                            title: s.label + " — " + g.label,
                                            "aria-label": s.label,
                                            "aria-current": active ? "page" : undefined,
                                            className: "no-underline flex items-center gap-1.5 tabular text-caos-sm px-2 py-1 min-h-8 rounded border transition-caos whitespace-nowrap focus-ring " + (active ? "bg-caos-elevated text-caos-accent border-caos-accent font-semibold" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50"),
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Glyph, {
                                                    className: active ? "text-caos-accent" : ""
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/shared/ConceptNav.tsx",
                                                    lineNumber: 229,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: compact ? active ? "inline" : "hidden" : "inline",
                                                    children: s.label
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/shared/ConceptNav.tsx",
                                                    lineNumber: 233,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, s.href, true, {
                                            fileName: "[project]/src/components/shared/ConceptNav.tsx",
                                            lineNumber: 215,
                                            columnNumber: 19
                                        }, this);
                                    })
                                ]
                            }, g.id, true, {
                                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                                lineNumber: 194,
                                columnNumber: 13
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/ConceptNav.tsx",
                        lineNumber: 181,
                        columnNumber: 7
                    }, this),
                    !compact || settingsActive ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "h-4 w-px bg-caos-border mx-0.5"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/ConceptNav.tsx",
                        lineNumber: 242,
                        columnNumber: 39
                    }, this) : null,
                    !compact || settingsActive ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        href: preserveContext("/settings"),
                        prefetch: false,
                        title: "Settings",
                        "aria-label": "Settings",
                        "aria-current": settingsActive ? "page" : undefined,
                        className: "no-underline flex items-center gap-1.5 tabular text-caos-sm px-2 py-1 min-h-8 rounded border transition-caos whitespace-nowrap focus-ring " + (settingsActive ? "bg-caos-elevated text-caos-accent border-caos-accent font-semibold" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50"),
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Gear, {
                                className: settingsActive ? "text-caos-accent" : ""
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                                lineNumber: 256,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: compact ? settingsActive ? "inline" : "hidden" : "inline",
                                children: "Settings"
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                                lineNumber: 257,
                                columnNumber: 9
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/shared/ConceptNav.tsx",
                        lineNumber: 243,
                        columnNumber: 39
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 180,
                columnNumber: 7
            }, this),
            compact ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "caos-ask-compact-utility",
                role: "region",
                "aria-label": "Ask utility",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Ask$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AskUtility"], {}, void 0, false, {
                    fileName: "[project]/src/components/shared/ConceptNav.tsx",
                    lineNumber: 260,
                    columnNumber: 100
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 260,
                columnNumber: 18
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "caos-compact-view flex items-center gap-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "h-4 w-px bg-caos-border mx-0.5"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/ConceptNav.tsx",
                        lineNumber: 267,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RoleViewSwitch$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RoleViewSwitch"], {}, void 0, false, {
                        fileName: "[project]/src/components/shared/ConceptNav.tsx",
                        lineNumber: 268,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 266,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "h-4 w-px bg-caos-border mx-0.5"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 271,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AnalystBadge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AnalystBadge"], {}, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 272,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/ConceptNav.tsx",
        lineNumber: 173,
        columnNumber: 5
    }, this);
}
_s1(ConceptNav, "DTMB5oQuluFzKkkrrJE3SUo+fcM=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"]
    ];
});
_c1 = ConceptNav;
var _c, _c1;
__turbopack_context__.k.register(_c, "ConceptsDrawer");
__turbopack_context__.k.register(_c1, "ConceptNav");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/ShellIdentity.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ShellIdentity",
    ()=>ShellIdentity
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ConceptNav$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ConceptNav.tsx [app-client] (ecmascript)");
"use client";
;
;
function Divider() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "h-4 w-px shrink-0 bg-caos-border",
        "aria-hidden": "true"
    }, void 0, false, {
        fileName: "[project]/src/components/shared/ShellIdentity.tsx",
        lineNumber: 6,
        columnNumber: 10
    }, this);
}
_c = Divider;
function ShellIdentity({ tag, badges, title, children, showConceptNav = true, titleAs: Title = "span" }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex min-w-0 items-center gap-3",
        children: [
            showConceptNav ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ConceptNav$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConceptNav"], {
                compact: true
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ShellIdentity.tsx",
                lineNumber: 33,
                columnNumber: 25
            }, this) : null,
            tag && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Divider, {}, void 0, false, {
                        fileName: "[project]/src/components/shared/ShellIdentity.tsx",
                        lineNumber: 36,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap shrink-0",
                        children: tag
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/ShellIdentity.tsx",
                        lineNumber: 37,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true),
            badges ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "flex min-w-0 shrink items-center gap-3 overflow-hidden",
                children: badges
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ShellIdentity.tsx",
                lineNumber: 45,
                columnNumber: 17
            }, this) : null,
            title && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Title, {
                title: typeof title === "string" ? title : undefined,
                className: "caos-shell-identity-title font-semibold leading-tight text-caos-text whitespace-nowrap min-w-0 truncate m-0",
                children: title
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ShellIdentity.tsx",
                lineNumber: 47,
                columnNumber: 9
            }, this),
            children
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/ShellIdentity.tsx",
        lineNumber: 32,
        columnNumber: 5
    }, this);
}
_c1 = ShellIdentity;
var _c, _c1;
__turbopack_context__.k.register(_c, "Divider");
__turbopack_context__.k.register(_c1, "ShellIdentity");
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
"[project]/src/lib/issuer-profile-charts.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Pure data helpers behind the Issuer Profile time-series visualisations.
// Kept out of the page component so the period parsing, the mock↔live seam
// preference, and the ≥2-period chart guards are unit-testable without pulling
// in React or @antv/g2. Specs are plain option trees (fed to G2Chart).
__turbopack_context__.s([
    "SNAPSHOT_ORDER",
    ()=>SNAPSHOT_ORDER,
    "buildCharts",
    ()=>buildCharts,
    "buildHeadline",
    ()=>buildHeadline,
    "buildSeries",
    ()=>buildSeries,
    "filterSeriesByGranularity",
    ()=>filterSeriesByGranularity,
    "financialsSpec",
    ()=>financialsSpec,
    "isQuarterPeriod",
    ()=>isQuarterPeriod,
    "latestPointDelta",
    ()=>latestPointDelta,
    "lineSpec",
    ()=>lineSpec,
    "periodRank",
    ()=>periodRank,
    "provRank",
    ()=>provRank
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/chart-colors.ts [app-client] (ecmascript)");
;
const SNAPSHOT_ORDER = [
    "net_leverage",
    "interest_coverage",
    "ebitda_margin",
    "revenue",
    "adj_ebitda",
    "fcf",
    "fcf_conversion",
    "altman_z"
];
const provRank = (p)=>p === "run" ? 0 : p === "fixture" ? 1 : p === "derived" ? 2 : p === "seed" ? 3 : 4;
function periodRank(p) {
    const y4 = p.match(/(20\d{2})/);
    const y2 = p.match(/(\d{2})(?!\d)/);
    // A bare undated "LTM" is the trailing-12m as of the LATEST data — rank it
    // after every dated period, not at year 0 (which drew it as the oldest bar).
    if (!y4 && !y2 && /ltm/i.test(p)) return Number.MAX_SAFE_INTEGER;
    const year = y4 ? Number(y4[1]) : y2 ? 2000 + Number(y2[1]) : 0;
    const q = p.match(/q([1-4])/i);
    return year * 10 + (q ? Number(q[1]) : /ltm/i.test(p) ? 9 : 0);
}
function isQuarterPeriod(p) {
    return /q[1-4]/i.test(p) && !/ltm|fy/i.test(p);
}
function filterSeriesByGranularity(series, gran) {
    const out = {};
    for (const [k, pts] of Object.entries(series)){
        const kept = pts.filter((m)=>gran === "Q" ? isQuarterPeriod(m.period) : !isQuarterPeriod(m.period));
        if (kept.length) out[k] = kept;
    }
    return out;
}
function buildHeadline(metrics) {
    return SNAPSHOT_ORDER.map((k)=>metrics.filter((m)=>m.metric_key === k && m.headline).sort((a, b)=>provRank(a.provenance) - provRank(b.provenance))[0]).filter((m)=>Boolean(m));
}
function buildSeries(metrics) {
    const by = {};
    for (const m of metrics){
        const slot = by[m.metric_key] ??= {};
        if (!slot[m.period] || provRank(m.provenance) < provRank(slot[m.period].provenance)) slot[m.period] = m;
    }
    const out = {};
    for (const k of Object.keys(by)){
        // Engines emit both a bare "LTM" and a dated "LTM_Q1_26" for the same figure;
        // plotting both draws the identical value twice (a fake flat period-over-period).
        // When a dated LTM exists, the undated alias is dropped from the series.
        const hasDatedLtm = Object.keys(by[k]).some((p)=>/ltm/i.test(p) && /\d/.test(p));
        const pts = Object.values(by[k]).filter((m)=>!(hasDatedLtm && /^ltm$/i.test(m.period.trim())));
        out[k] = pts.sort((a, b)=>periodRank(a.period) - periodRank(b.period));
    }
    return out;
}
function latestPointDelta(pts) {
    if (!pts || pts.length < 2) return null;
    const latest = pts[pts.length - 1]?.value;
    const prior = pts[pts.length - 2]?.value;
    return typeof latest === "number" && typeof prior === "number" ? latest - prior : null;
}
const MC_AXIS = {
    x: {
        title: false
    },
    y: {
        title: false
    }
};
// Shared dodge-bar styling (no axis titles, top legend, value labels). Factored
// out so the grouped-bar spec body isn't a near-clone of the other dodgeX charts
// in the app (e.g. ModuleCharts' CP-1B revenue/EBITDA bars).
const DODGE_BAR_STYLE = {
    transform: [
        {
            type: "dodgeX"
        }
    ],
    legend: {
        color: {
            position: "top"
        }
    },
    axis: MC_AXIS,
    labels: [
        {
            text: "v",
            position: "top",
            fontSize: 9,
            transform: [
                {
                    type: "overlapHide"
                }
            ]
        }
    ]
};
function financialsSpec(series) {
    const rev = (series.revenue || []).filter((r)=>Number.isFinite(r.value));
    const eb = (series.adj_ebitda || []).filter((e)=>Number.isFinite(e.value));
    const periods = rev.map((r)=>r.period).filter((per)=>eb.some((e)=>e.period === per));
    if (periods.length < 2) return null;
    const data = [];
    for (const per of periods){
        const r = rev.find((x)=>x.period === per);
        const e = eb.find((x)=>x.period === per);
        if (r) data.push({
            fy: per,
            s: "Revenue",
            v: r.value
        });
        if (e) data.push({
            fy: per,
            s: "Adj. EBITDA",
            v: e.value
        });
    }
    return {
        type: "interval",
        data,
        encode: {
            x: "fy",
            y: "v",
            color: "s"
        },
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
        ...DODGE_BAR_STYLE
    };
}
function lineSpec(pts, color, label, minSpan = 0) {
    // value is typed number but arrives from JSON — drop null/NaN points so the label
    // callback (v.toFixed) can't crash the chart render on a missing metric.
    const nums = (pts ?? []).filter((p)=>Number.isFinite(p.value));
    if (nums.length < 2) return null;
    let scale;
    if (minSpan > 0) {
        const vals = nums.map((p)=>p.value);
        const lo = Math.min(...vals), hi = Math.max(...vals);
        if (hi - lo < minSpan) {
            const mid = (hi + lo) / 2;
            let dMin = mid - minSpan / 2;
            let dMax = mid + minSpan / 2;
            if (lo >= 0 && dMin < 0) {
                dMax -= dMin;
                dMin = 0;
            }
            scale = {
                y: {
                    domainMin: dMin,
                    domainMax: dMax
                }
            };
        }
    }
    return {
        type: "view",
        ...scale ? {
            scale
        } : {},
        data: nums.map((p)=>({
                fy: p.period,
                v: p.value
            })),
        children: [
            {
                type: "line",
                encode: {
                    x: "fy",
                    y: "v"
                },
                style: {
                    stroke: color,
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
                    fill: color
                },
                labels: [
                    {
                        text: (d)=>label(d.v),
                        fontSize: 9,
                        transform: [
                            {
                                type: "overlapDodgeY"
                            }
                        ]
                    }
                ]
            }
        ],
        axis: MC_AXIS
    };
}
function buildCharts(series) {
    const out = [];
    const fin = financialsSpec(series);
    if (fin) out.push({
        title: "Revenue & Adj. EBITDA ($M)",
        spec: fin
    });
    const margin = lineSpec(series.ebitda_margin, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].teal, (v)=>v.toFixed(1) + "%", 4);
    if (margin) out.push({
        title: "EBITDA margin (%)",
        spec: margin
    });
    const lev = lineSpec(series.net_leverage, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].warning, (v)=>v.toFixed(2).replace(/0$/, "") + "×", 1);
    if (lev) out.push({
        title: "Net leverage (×)",
        spec: lev
    });
    const cov = lineSpec(series.interest_coverage, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$chart$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHART_HEX"].success, (v)=>v.toFixed(1) + "×", 1);
    if (cov) out.push({
        title: "Interest coverage (×)",
        spec: cov
    });
    return out;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/issuers.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "COUNTRIES",
    ()=>COUNTRIES,
    "issuerProfileHref",
    ()=>issuerProfileHref,
    "issuerRating",
    ()=>issuerRating,
    "issuerSearchHref",
    ()=>issuerSearchHref,
    "issuerSector",
    ()=>issuerSector,
    "ratingDistressed",
    ()=>ratingDistressed
]);
const COUNTRIES = [
    "United States",
    "United Kingdom",
    "Canada",
    "France",
    "Germany",
    "Netherlands",
    "Spain",
    "Italy",
    "Sweden",
    "Luxembourg",
    "Ireland",
    "Australia",
    "Other"
];
function issuerSector(issuer) {
    return issuer.sector || issuer.industry || "";
}
function issuerRating(i) {
    return (i.rating_sp || i.rating_moody || i.rating_fitch || "").trim();
}
const ratingDistressed = (r)=>/^[cd]/i.test(r);
function issuerProfileHref(issuer) {
    return "/issuers/profile?id=" + encodeURIComponent(issuer.id);
}
function issuerSearchHref(q) {
    return "/issuers?q=" + encodeURIComponent(q);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/useBreakpoint.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BP_COMPACT_SQUEEZE",
    ()=>BP_COMPACT_SQUEEZE,
    "BP_DESKTOP",
    ()=>BP_DESKTOP,
    "BP_TABLET",
    ()=>BP_TABLET,
    "BP_WIDE",
    ()=>BP_WIDE,
    "useBreakpoint",
    ()=>useBreakpoint
]);
// The single breakpoint source for shell chrome. Replaces two stacked,
// non-communicating systems (SubHeader's private 1280px matchMedia and
// ResponsiveShell's innerWidth resize listener at 1024/768) with one hook so
// the collapse thresholds can never disagree (RT-2026-07-11-64).
//
//   wide    ≥1280  full contextual controls inline
//   desktop ≥1024  contextual controls collapse into MoreDrawer
//   tablet  ≥768   narrow contract (essential controls only)
//   mobile  <768   narrow contract, stacked panes
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
const BP_WIDE = 1280;
const BP_COMPACT_SQUEEZE = 1150;
const BP_DESKTOP = 1024;
const BP_TABLET = 768;
function useBreakpoint() {
    _s();
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        breakpoint: "wide",
        hydrated: false
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useBreakpoint.useEffect": ()=>{
            if (("TURBOPACK compile-time value", "object") === "undefined" || !window.matchMedia) return;
            const mqs = [
                window.matchMedia(`(min-width: ${BP_WIDE}px)`),
                window.matchMedia(`(min-width: ${BP_DESKTOP}px)`),
                window.matchMedia(`(min-width: ${BP_TABLET}px)`)
            ];
            const compute = {
                "useBreakpoint.useEffect.compute": ()=>mqs[0].matches ? "wide" : mqs[1].matches ? "desktop" : mqs[2].matches ? "tablet" : "mobile"
            }["useBreakpoint.useEffect.compute"];
            // rAF-coalesced so a rapid drag across a boundary doesn't flicker.
            let raf = 0;
            const apply = {
                "useBreakpoint.useEffect.apply": ()=>setState({
                        breakpoint: compute(),
                        hydrated: true
                    })
            }["useBreakpoint.useEffect.apply"];
            apply();
            const onChange = {
                "useBreakpoint.useEffect.onChange": ()=>{
                    cancelAnimationFrame(raf);
                    raf = requestAnimationFrame(apply);
                }
            }["useBreakpoint.useEffect.onChange"];
            mqs.forEach({
                "useBreakpoint.useEffect": (m)=>m.addEventListener("change", onChange)
            }["useBreakpoint.useEffect"]);
            return ({
                "useBreakpoint.useEffect": ()=>{
                    mqs.forEach({
                        "useBreakpoint.useEffect": (m)=>m.removeEventListener("change", onChange)
                    }["useBreakpoint.useEffect"]);
                    cancelAnimationFrame(raf);
                }
            })["useBreakpoint.useEffect"];
        }
    }["useBreakpoint.useEffect"], []);
    return state;
}
_s(useBreakpoint, "M4F7cqfKc8bHsmr2U3bZIScqdu4=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/SubHeader.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SubHeader",
    ()=>SubHeader,
    "nextCollapseState",
    ()=>nextCollapseState
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$MoreDrawer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/MoreDrawer.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useBreakpoint$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/useBreakpoint.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
function nextCollapseState(s, m) {
    if (!s.collapsed && m.scrollWidth > m.clientWidth + 1) {
        return {
            collapsed: true,
            neededWidth: m.scrollWidth
        };
    }
    if (s.collapsed && s.neededWidth !== null && m.clientWidth >= s.neededWidth) {
        return {
            collapsed: false,
            neededWidth: null
        };
    }
    return s;
}
const useOverflowCollapse = (contextualControls, primaryAction, status)=>{
    _s();
    const headerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [collapse, setCollapse] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        collapsed: false,
        neededWidth: null
    });
    const measure = ()=>{
        const element = headerRef.current;
        if (!element) return;
        setCollapse((current)=>nextCollapseState(current, {
                scrollWidth: element.scrollWidth,
                clientWidth: element.clientWidth
            }));
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLayoutEffect"])({
        "useOverflowCollapse.useLayoutEffect": ()=>{
            measure();
            if (typeof ResizeObserver === "undefined") return;
            const observer = new ResizeObserver(measure);
            if (headerRef.current) observer.observe(headerRef.current);
            return ({
                "useOverflowCollapse.useLayoutEffect": ()=>observer.disconnect()
            })["useOverflowCollapse.useLayoutEffect"];
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }
    }["useOverflowCollapse.useLayoutEffect"], [
        contextualControls,
        primaryAction,
        status
    ]);
    return {
        headerRef,
        forceCollapsed: collapse.collapsed
    };
};
_s(useOverflowCollapse, "gzM7pAAD/Ck7PkElJcxgtA6UahY=");
function SubHeaderStatus({ status }) {
    return status ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "hidden lg:flex items-center gap-2 shrink-0",
        children: status
    }, void 0, false, {
        fileName: "[project]/src/components/shared/SubHeader.tsx",
        lineNumber: 55,
        columnNumber: 19
    }, this) : null;
}
_c = SubHeaderStatus;
function InlineContext({ show, children }) {
    return show && children ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center gap-2 shrink-0",
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/shared/SubHeader.tsx",
        lineNumber: 59,
        columnNumber: 29
    }, this) : null;
}
_c1 = InlineContext;
function HeaderDrawer({ showInline, contextualControls, utilityControls, drawerOpen, setDrawerOpen, utilityLabel }) {
    const content = showInline ? utilityControls : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            contextualControls,
            contextualControls && utilityControls ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "my-1 border-t border-caos-border"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SubHeader.tsx",
                lineNumber: 80,
                columnNumber: 48
            }, this) : null,
            utilityControls
        ]
    }, void 0, true);
    if (!content) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$MoreDrawer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MoreDrawer"], {
        open: drawerOpen,
        onOpenChange: setDrawerOpen,
        triggerLabel: utilityLabel,
        children: content
    }, void 0, false, {
        fileName: "[project]/src/components/shared/SubHeader.tsx",
        lineNumber: 86,
        columnNumber: 5
    }, this);
}
_c2 = HeaderDrawer;
function PrimaryAction({ children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        id: "page-actions",
        tabIndex: -1,
        "aria-label": "Page actions",
        className: children ? "shrink-0" : "sr-only focus:not-sr-only focus:relative focus:z-raised focus:rounded focus:border focus:border-caos-accent focus:bg-caos-elevated focus:px-2 focus:py-1 focus:text-caos-text focus-ring",
        "data-page-primary-action": children ? true : undefined,
        children: children ?? "No page actions available"
    }, void 0, false, {
        fileName: "[project]/src/components/shared/SubHeader.tsx",
        lineNumber: 94,
        columnNumber: 5
    }, this);
}
_c3 = PrimaryAction;
function SubHeader({ identity, status, primaryAction, contextualControls, utilityControls, utilityLabel = "Utilities", className = "", "aria-label": ariaLabel }) {
    _s1();
    // The 1280px contextual-controls collapse comes from the shared shell
    // breakpoint hook — one source with ResponsiveShell (RT-2026-07-11-64).
    const { breakpoint, hydrated } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useBreakpoint$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useBreakpoint"])();
    // MoreDrawer open state — owned here so the trigger and panel are siblings.
    const [drawerOpen, setDrawerOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // Measured overflow guard: even at the wide breakpoint, a page that passes
    // too many contextual controls (contract: ≤5) can push the primary action
    // off-screen. Observe the header and force-collapse into the drawer when it
    // overflows, with hysteresis so it can't oscillate. This is the backstop —
    // per-page configs should still respect the ≤5 rule.
    const { headerRef, forceCollapsed } = useOverflowCollapse(contextualControls, primaryAction, status);
    // While hydrating, assume wide (SSR-safe — no layout flash on desktop).
    const showInline = (!hydrated || breakpoint === "wide") && !forceCollapsed;
    // Close the drawer when the breakpoint flips to wide — otherwise a stale
    // `drawerOpen=true` state re-opens the drawer if we cross back to narrow.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SubHeader.useEffect": ()=>{
            if (showInline) setDrawerOpen(false);
        }
    }["SubHeader.useEffect"], [
        showInline
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
        ref: headerRef,
        "aria-label": ariaLabel,
        className: `h-11 shrink-0 border-b border-caos-border bg-caos-panel/75 flex items-center gap-3 px-3 md:px-4 ${className}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-3 min-w-28 overflow-hidden",
                children: identity
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SubHeader.tsx",
                lineNumber: 179,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 min-w-0"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SubHeader.tsx",
                lineNumber: 181,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SubHeaderStatus, {
                status: status
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SubHeader.tsx",
                lineNumber: 183,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(InlineContext, {
                show: showInline,
                children: contextualControls
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SubHeader.tsx",
                lineNumber: 186,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(HeaderDrawer, {
                showInline: showInline,
                contextualControls: contextualControls,
                utilityControls: utilityControls,
                drawerOpen: drawerOpen,
                setDrawerOpen: setDrawerOpen,
                utilityLabel: utilityLabel
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SubHeader.tsx",
                lineNumber: 188,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PrimaryAction, {
                children: primaryAction
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SubHeader.tsx",
                lineNumber: 191,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/SubHeader.tsx",
        lineNumber: 171,
        columnNumber: 5
    }, this);
}
_s1(SubHeader, "OT75EQwCSB0ND4oK/bYqVerrsMs=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useBreakpoint$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useBreakpoint"],
        useOverflowCollapse
    ];
});
_c4 = SubHeader;
var _c, _c1, _c2, _c3, _c4;
__turbopack_context__.k.register(_c, "SubHeaderStatus");
__turbopack_context__.k.register(_c1, "InlineContext");
__turbopack_context__.k.register(_c2, "HeaderDrawer");
__turbopack_context__.k.register(_c3, "PrimaryAction");
__turbopack_context__.k.register(_c4, "SubHeader");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/ResponsiveShell.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ResponsiveShell",
    ()=>ResponsiveShell
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SubHeader$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/SubHeader.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useBreakpoint$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/useBreakpoint.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
function ResponsiveShell({ identity, status, primaryAction, contextualControls, utilityControls, utilityLabel, narrowContract, children, className = "", heightClass = "h-screen" }) {
    _s();
    // Shared shell breakpoint — same source SubHeader uses for its 1280px
    // MoreDrawer collapse, so the two thresholds can never disagree.
    const { breakpoint } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useBreakpoint$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useBreakpoint"])();
    const isDesktop = breakpoint === "wide" || breakpoint === "desktop";
    // At narrow breakpoints, the header shows only essential controls (max 3).
    // The full set renders at desktop only.
    const headerContextual = isDesktop ? contextualControls : narrowContract.essentialControls;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `${heightClass} flex flex-col bg-caos-bg ${className}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SubHeader$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SubHeader"], {
                identity: identity,
                status: status,
                primaryAction: primaryAction,
                contextualControls: headerContextual,
                utilityControls: utilityControls,
                utilityLabel: utilityLabel,
                "aria-label": "Concept header"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ResponsiveShell.tsx",
                lineNumber: 59,
                columnNumber: 7
            }, this),
            children
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/ResponsiveShell.tsx",
        lineNumber: 58,
        columnNumber: 5
    }, this);
}
_s(ResponsiveShell, "JlkAl++SChDPrehtFQBU7bPnYF0=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useBreakpoint$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useBreakpoint"]
    ];
});
_c = ResponsiveShell;
var _c;
__turbopack_context__.k.register(_c, "ResponsiveShell");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/AnalysisContextStrip.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AnalysisContextStrip",
    ()=>AnalysisContextStrip
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/analysis-workbench.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
function AnalysisContextStrip() {
    _s();
    const [context, setContext] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [findings, setFindings] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [unavailable, setUnavailable] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [contextFree, setContextFree] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AnalysisContextStrip.useEffect": ()=>{
            let cancelled = false;
            const load = {
                "AnalysisContextStrip.useEffect.load": (id)=>{
                    setContextFree(false);
                    setUnavailable(false);
                    Promise.all([
                        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["analysisApi"].getContext(id),
                        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["analysisApi"].listFindings(id)
                    ]).then({
                        "AnalysisContextStrip.useEffect.load": ([nextContext, nextFindings])=>{
                            if (!cancelled) {
                                setContext(nextContext);
                                setFindings((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["activeFindings"])(nextFindings));
                            }
                        }
                    }["AnalysisContextStrip.useEffect.load"]).catch({
                        "AnalysisContextStrip.useEffect.load": ()=>{
                            if (!cancelled) setUnavailable(true);
                        }
                    }["AnalysisContextStrip.useEffect.load"]);
                }
            }["AnalysisContextStrip.useEffect.load"];
            const initialUrl = new URL(window.location.href);
            const initialId = initialUrl.searchParams.get("context");
            if (initialId) load(initialId);
            else if (initialUrl.pathname === "/settings") setContextFree(true);
            const onContext = {
                "AnalysisContextStrip.useEffect.onContext": (event)=>{
                    const detail = event.detail;
                    if (detail?.id) load(detail.id);
                }
            }["AnalysisContextStrip.useEffect.onContext"];
            const onContextError = {
                "AnalysisContextStrip.useEffect.onContextError": ()=>{
                    setContext(null);
                    setFindings([]);
                    setUnavailable(true);
                }
            }["AnalysisContextStrip.useEffect.onContextError"];
            window.addEventListener("caos:analysis-context", onContext);
            window.addEventListener("caos:analysis-context-error", onContextError);
            return ({
                "AnalysisContextStrip.useEffect": ()=>{
                    cancelled = true;
                    window.removeEventListener("caos:analysis-context", onContext);
                    window.removeEventListener("caos:analysis-context-error", onContextError);
                }
            })["AnalysisContextStrip.useEffect"];
        }
    }["AnalysisContextStrip.useEffect"], []);
    if (!context && contextFree) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            role: "status",
            className: "flex min-h-12 shrink-0 items-center border-b border-caos-border bg-caos-info-surface/20 px-3 md:min-h-8",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                children: "Workspace configuration · no analysis context"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
                lineNumber: 52,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
            lineNumber: 48,
            columnNumber: 7
        }, this);
    }
    if (!context && !unavailable) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            role: "status",
            "aria-busy": "true",
            className: "flex min-h-12 shrink-0 items-center border-b border-caos-border bg-caos-info-surface/20 px-3 md:min-h-8",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                children: "Analysis context · resolving"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
                lineNumber: 63,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
            lineNumber: 58,
            columnNumber: 7
        }, this);
    }
    if (unavailable) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            role: "alert",
            className: "flex min-h-12 shrink-0 items-center overflow-hidden border-b border-caos-critical/40 bg-caos-critical/5 px-3 tabular text-caos-2xs uppercase tracking-wider text-caos-critical md:min-h-8",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "truncate",
                children: "Analysis context unavailable or not owned by this analyst."
            }, void 0, false, {
                fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
                lineNumber: 68,
                columnNumber: 228
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
            lineNumber: 68,
            columnNumber: 12
        }, this);
    }
    if (!context) return null;
    const summaryTitle = `Active analysis · ${context.name} · ${context.sector_id ?? "cross-coverage"} · ${findings.length} findings`;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
        className: "shrink-0 border-b border-caos-border bg-caos-info-surface/40",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                className: "flex min-h-12 cursor-pointer items-center gap-2 overflow-hidden whitespace-nowrap px-3 tabular text-caos-xs text-caos-text focus-ring md:min-h-8",
                title: summaryTitle,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "shrink-0 uppercase tracking-wider text-caos-accent",
                        children: "Active analysis"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
                        lineNumber: 78,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "min-w-0 truncate",
                        children: context.name
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
                        lineNumber: 79,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "ml-auto shrink-0 text-caos-muted",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "hidden sm:inline",
                                children: [
                                    context.sector_id ?? "cross-coverage",
                                    " · "
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
                                lineNumber: 80,
                                columnNumber: 60
                            }, this),
                            findings.length,
                            " findings"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
                        lineNumber: 80,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
                lineNumber: 74,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid gap-2 border-t border-caos-border/70 px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "min-w-0",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-caos-xs text-caos-muted",
                                children: [
                                    "Issuer scope ",
                                    context.issuer_ids.length,
                                    " · instrument scope ",
                                    context.instrument_ids.length,
                                    " · as of ",
                                    context.as_of ?? "not fixed"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
                                lineNumber: 84,
                                columnNumber: 11
                            }, this),
                            findings.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-1 truncate text-caos-xs text-caos-text",
                                children: [
                                    "Latest finding · ",
                                    findings[0].title
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
                                lineNumber: 85,
                                columnNumber: 30
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-1 text-caos-xs text-caos-muted",
                                children: "No findings pinned yet."
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
                                lineNumber: 85,
                                columnNumber: 130
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
                        lineNumber: 83,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                        children: [
                            "Context ",
                            context.id.slice(0, 8)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
                        lineNumber: 87,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
                lineNumber: 82,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
        lineNumber: 73,
        columnNumber: 5
    }, this);
}
_s(AnalysisContextStrip, "03yWC8/QmCoHoJv/QR0jqdpPg74=");
_c = AnalysisContextStrip;
var _c;
__turbopack_context__.k.register(_c, "AnalysisContextStrip");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/Button.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Button",
    ()=>Button
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// The page-level action primitive (Blueprint action grammar, 2 tiers —
// globals.css ".caos-action-primary/secondary"). Wraps ActionReason so every
// call site gets the disabled-with-reason contract by construction: native
// `disabled` is not an accepted prop, so a Button can never go inert without
// a reason that stays keyboard/pointer/screen-reader discoverable.
//
// This does not cover in-row micro-actions (Ack, Open →, per-table styled —
// deliberately a separate tier, see the globals.css comment above
// .caos-action-primary) or icon-only/close controls with their own contract.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ActionReason.tsx [app-client] (ecmascript)");
"use client";
;
;
function Button({ variant = "secondary", reason, reasonDisplay, title, className = "", children, ...rest }) {
    const variantClass = variant === "primary" ? "caos-action-primary" : "caos-action-secondary";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ActionReason"], {
        reason: reason,
        reasonDisplay: reasonDisplay,
        actionTitle: title,
        className: `${variantClass} focus-ring${className ? ` ${className}` : ""}`,
        ...rest,
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Button.tsx",
        lineNumber: 33,
        columnNumber: 5
    }, this);
}
_c = Button;
var _c;
__turbopack_context__.k.register(_c, "Button");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/EnterprisePage.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EnterprisePage",
    ()=>EnterprisePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ResponsiveShell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ResponsiveShell.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AnalysisContextStrip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/AnalysisContextStrip.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/Button.tsx [app-client] (ecmascript)");
"use client";
;
;
;
;
;
function EnterprisePrimaryAction({ action }) {
    if (!action) return null;
    if (action.unavailableReason) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
            variant: "primary",
            reason: action.unavailableReason,
            reasonDisplay: "hidden",
            title: action.title,
            children: action.label
        }, void 0, false, {
            fileName: "[project]/src/components/shared/EnterprisePage.tsx",
            lineNumber: 25,
            columnNumber: 7
        }, this);
    }
    if (action.href !== undefined) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
            href: action.href,
            title: action.title,
            className: "caos-action-primary no-underline focus-ring",
            children: action.label
        }, void 0, false, {
            fileName: "[project]/src/components/shared/EnterprisePage.tsx",
            lineNumber: 37,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
        variant: "primary",
        onClick: action.onAction,
        title: action.title,
        children: action.label
    }, void 0, false, {
        fileName: "[project]/src/components/shared/EnterprisePage.tsx",
        lineNumber: 43,
        columnNumber: 5
    }, this);
}
_c = EnterprisePrimaryAction;
function EnterprisePage({ kind, identity, status, primaryAction, contextualControls, utilityControls, utilityLabel, decisionContext, finalizationBar, narrowContract, children, className = "", heightClass = "h-screen" }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ResponsiveShell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ResponsiveShell"], {
        identity: identity,
        status: status,
        primaryAction: primaryAction ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(EnterprisePrimaryAction, {
            action: primaryAction
        }, void 0, false, {
            fileName: "[project]/src/components/shared/EnterprisePage.tsx",
            lineNumber: 87,
            columnNumber: 38
        }, this) : undefined,
        contextualControls: contextualControls,
        utilityControls: utilityControls,
        utilityLabel: utilityLabel,
        narrowContract: narrowContract,
        className: `caos-enterprise-page caos-surface-${kind} ${className}`,
        heightClass: heightClass,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AnalysisContextStrip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AnalysisContextStrip"], {}, void 0, false, {
                fileName: "[project]/src/components/shared/EnterprisePage.tsx",
                lineNumber: 95,
                columnNumber: 7
            }, this),
            decisionContext,
            children,
            finalizationBar ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("footer", {
                className: "caos-finalization-bar",
                "aria-label": "Page finalization actions",
                children: finalizationBar
            }, void 0, false, {
                fileName: "[project]/src/components/shared/EnterprisePage.tsx",
                lineNumber: 99,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/EnterprisePage.tsx",
        lineNumber: 84,
        columnNumber: 5
    }, this);
}
_c1 = EnterprisePage;
var _c, _c1;
__turbopack_context__.k.register(_c, "EnterprisePrimaryAction");
__turbopack_context__.k.register(_c1, "EnterprisePage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/ProvenanceChip.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ProvenanceChip",
    ()=>ProvenanceChip
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
"use client";
;
const ORIGIN_VAR = {
    LIVE: "var(--caos-success)",
    REFERENCE: "var(--caos-accent)",
    DEMO: "var(--caos-idle)"
};
const CHIP = "inline-flex items-center gap-1 tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border whitespace-nowrap";
const originStyle = (origin, color)=>({
        color: origin === "DEMO" ? "var(--caos-muted)" : color,
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
        background: `color-mix(in srgb, ${color} 8%, transparent)`
    });
const freshnessStyle = (freshness)=>{
    if (freshness !== "STALE" && freshness !== "DUE") {
        return {
            color: "var(--caos-muted)",
            borderColor: "var(--caos-border)"
        };
    }
    const color = freshness === "STALE" ? "var(--caos-critical)" : "var(--caos-warning)";
    return {
        color,
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
        background: `color-mix(in srgb, ${color} 8%, transparent)`
    };
};
function FreshnessChip({ freshness }) {
    if (!freshness) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: CHIP,
        style: freshnessStyle(freshness),
        children: freshness
    }, void 0, false, {
        fileName: "[project]/src/components/shared/ProvenanceChip.tsx",
        lineNumber: 42,
        columnNumber: 10
    }, this);
}
_c = FreshnessChip;
function MethodChip({ method }) {
    if (!method) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: CHIP,
        style: {
            color: "var(--caos-muted)",
            borderColor: "var(--caos-border)"
        },
        children: method
    }, void 0, false, {
        fileName: "[project]/src/components/shared/ProvenanceChip.tsx",
        lineNumber: 48,
        columnNumber: 5
    }, this);
}
_c1 = MethodChip;
function ProvenanceChip({ prov, className = "" }) {
    const originColor = ORIGIN_VAR[prov.origin];
    const title = [
        prov.detail,
        prov.asOf ? `as of ${prov.asOf}` : null
    ].filter(Boolean).join(" · ") || undefined;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "inline-flex items-center gap-1 shrink-0 " + className,
        title: title,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: CHIP,
                style: originStyle(prov.origin, originColor),
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        "aria-hidden": "true",
                        className: "w-1.5 h-1.5 rounded-sm shrink-0",
                        style: {
                            background: originColor
                        }
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/ProvenanceChip.tsx",
                        lineNumber: 64,
                        columnNumber: 9
                    }, this),
                    prov.origin
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/ProvenanceChip.tsx",
                lineNumber: 60,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FreshnessChip, {
                freshness: prov.freshness
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ProvenanceChip.tsx",
                lineNumber: 71,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MethodChip, {
                method: prov.method
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ProvenanceChip.tsx",
                lineNumber: 72,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/ProvenanceChip.tsx",
        lineNumber: 59,
        columnNumber: 5
    }, this);
}
_c2 = ProvenanceChip;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "FreshnessChip");
__turbopack_context__.k.register(_c1, "MethodChip");
__turbopack_context__.k.register(_c2, "ProvenanceChip");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/ConclusionAuthority.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ConclusionAuthority",
    ()=>ConclusionAuthority
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ProvenanceChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ProvenanceChip.tsx [app-client] (ecmascript)");
;
;
function ConclusionAuthority({ prov, approval = "UNRATIFIED" }) {
    const label = [
        `Origin ${prov.origin}`,
        prov.method ? `method ${prov.method}` : null,
        approval ? `approval ${approval}` : null,
        prov.freshness ? `freshness ${prov.freshness}` : null
    ].filter(Boolean).join(", ");
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "inline-flex items-center gap-1",
        "aria-label": label,
        title: prov.detail,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ProvenanceChip$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ProvenanceChip"], {
                prov: prov
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConclusionAuthority.tsx",
                lineNumber: 25,
                columnNumber: 7
            }, this),
            approval ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xs uppercase tracking-wider rounded-sm border border-caos-warning/50 bg-caos-warning/5 px-1.5 py-0.5 text-caos-warning",
                children: approval
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConclusionAuthority.tsx",
                lineNumber: 26,
                columnNumber: 19
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/ConclusionAuthority.tsx",
        lineNumber: 24,
        columnNumber: 5
    }, this);
}
_c = ConclusionAuthority;
var _c;
__turbopack_context__.k.register(_c, "ConclusionAuthority");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/DecisionHeader.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DecisionHeader",
    ()=>DecisionHeader
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ConclusionAuthority$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ConclusionAuthority.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
const ORIGINS = [
    "LIVE",
    "REFERENCE",
    "DEMO"
];
function isProvenance(v) {
    return !!v && typeof v === "object" && ORIGINS.includes(v.origin);
}
function legacyState(value, unavailableMessage) {
    if (value == null || value === "") return {
        kind: "unavailable",
        message: unavailableMessage
    };
    if (isProvenance(value)) {
        return {
            kind: "ready",
            value: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ConclusionAuthority$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConclusionAuthority"], {
                prov: value
            }, void 0, false, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 19,
                columnNumber: 14
            }, this),
            asOf: value.asOf ?? "timestamp unavailable"
        };
    }
    // Compatibility adapter only. New route code must supply `state` with a real
    // observation time; the adapter says so rather than fabricating freshness.
    return {
        kind: "ready",
        value,
        asOf: "timestamp unavailable"
    };
}
function datumTimestamp(state) {
    return "asOf" in state ? state.asOf : state.kind === "offline" ? state.lastKnownAt : undefined;
}
function datumAuthority(state) {
    return "authority" in state ? state.authority : undefined;
}
function sharedAuthority(states) {
    const entries = states.map((datum)=>{
        const authority = datumAuthority(datum);
        const asOf = datumTimestamp(datum);
        if (!authority || !asOf) return null;
        const { provenance, approval } = authority;
        return {
            authority,
            asOf,
            key: [
                asOf,
                provenance.origin,
                provenance.method ?? "",
                provenance.freshness ?? "",
                approval ?? ""
            ].join("|")
        };
    });
    if (entries.some((entry)=>entry == null)) return null;
    const first = entries[0];
    return entries.every((entry)=>entry.key === first.key) ? first : null;
}
function datumPresentation(state) {
    switch(state.kind){
        case "ready":
            return {
                content: state.value,
                glyph: ""
            };
        case "observed-empty":
            // "○" = observed, nothing there. A "✓" here scan-reads as green health
            // decorating an empty board (2026-07-16 critique, PM persona).
            return {
                content: state.message ?? "No material change observed",
                glyph: "○"
            };
        case "stale":
            return {
                content: state.value,
                glyph: "△"
            };
        case "partial":
            return {
                content: state.value ?? `Partial result · missing ${state.missingSources.join(", ")}`,
                glyph: "△"
            };
        case "loading":
            return {
                content: state.message ?? "Checking source…",
                glyph: "◌"
            };
        case "offline":
            return {
                content: state.lastKnown ?? "Source offline",
                glyph: "△"
            };
        case "error":
            return {
                content: state.message,
                glyph: "✕"
            };
        case "unavailable":
            return {
                content: state.message ?? "Unavailable",
                glyph: "—"
            };
    }
}
function DatumObservation({ state, show }) {
    if (!show) return null;
    const timestamp = datumTimestamp(state);
    const authority = datumAuthority(state);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            timestamp ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "basis-full tabular text-caos-2xs text-caos-muted",
                children: [
                    "as of ",
                    timestamp
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 75,
                columnNumber: 20
            }, this) : null,
            authority ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "basis-full mt-0.5",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ConclusionAuthority$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConclusionAuthority"], {
                    prov: {
                        ...authority.provenance,
                        asOf: timestamp ?? authority.provenance.asOf
                    },
                    approval: authority.approval
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                    lineNumber: 76,
                    columnNumber: 56
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 76,
                columnNumber: 20
            }, this) : null
        ]
    }, void 0, true);
}
_c = DatumObservation;
function DatumActions({ state }) {
    const interactive = state.kind === "offline" || state.kind === "error";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            interactive && state.onRetry ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: state.onRetry,
                className: "caos-action-secondary focus-ring",
                children: state.retryLabel ?? "Retry source"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 85,
                columnNumber: 39
            }, this) : null,
            state.kind === "error" && state.onEscalate ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: state.onEscalate,
                className: "caos-action-secondary focus-ring",
                children: state.escalationLabel ?? "Escalate issue"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 86,
                columnNumber: 53
            }, this) : null
        ]
    }, void 0, true);
}
_c1 = DatumActions;
function Datum({ state, showObservation = true }) {
    const { content, glyph } = datumPresentation(state);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "caos-decision-state flex-wrap font-sans text-caos-md leading-relaxed",
        "data-kind": state.kind,
        role: state.kind === "loading" ? "status" : undefined,
        children: [
            glyph ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                "aria-hidden": "true",
                children: glyph
            }, void 0, false, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 99,
                columnNumber: 16
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "min-w-0 [overflow-wrap:anywhere]",
                children: content
            }, void 0, false, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 100,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DatumObservation, {
                state: state,
                show: showObservation
            }, void 0, false, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 101,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DatumActions, {
                state: state
            }, void 0, false, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 102,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/DecisionHeader.tsx",
        lineNumber: 94,
        columnNumber: 5
    }, this);
}
_c2 = Datum;
function Cell({ label, state, showObservation }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-kind": state.kind,
        className: "caos-decision-cell min-w-0 px-3 py-2 border-r border-caos-border last:border-r-0 max-lg:border-r-0 max-lg:border-b max-lg:last:border-b-0",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "caos-decision-label tabular text-caos-2xs uppercase tracking-widest text-caos-muted",
                children: label
            }, void 0, false, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 110,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-1",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Datum, {
                    state: state,
                    showObservation: showObservation
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                    lineNumber: 111,
                    columnNumber: 29
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 111,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/DecisionHeader.tsx",
        lineNumber: 109,
        columnNumber: 5
    }, this);
}
_c3 = Cell;
function DecisionHeader({ state, whatChanged, whyItMatters, requiredAction, evidenceHealth, defaultOpen = true, className = "" }) {
    _s();
    const [userOpen, setUserOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const open = userOpen ?? defaultOpen;
    const resolved = state ?? {
        whatChanged: legacyState(whatChanged, "Change observation unavailable"),
        whyItMatters: legacyState(whyItMatters, "Decision impact unavailable"),
        requiredAction: legacyState(requiredAction, "Required action unavailable"),
        evidenceHealth: legacyState(evidenceHealth, "Evidence state unavailable")
    };
    const hasError = Object.values(resolved).some((datum)=>datum.kind === "error");
    const cells = [
        resolved.whatChanged,
        resolved.whyItMatters,
        resolved.requiredAction,
        resolved.evidenceHealth
    ];
    const commonObservation = sharedAuthority(cells);
    // When every cell states the same value-less cause ("Run the gated screen to
    // establish this observation." ×4), the 4-cell anatomy is scaffolding, not
    // information — collapse to one spanning line. Cells that carry values
    // (ready/stale/partial) never collapse: their content differs by definition.
    const sharedCause = (()=>{
        const collapsible = new Set([
            "unavailable",
            "observed-empty",
            "loading"
        ]);
        const key = (s)=>`${s.kind}|${"message" in s ? s.message ?? "" : ""}`;
        const first = cells[0];
        if (!collapsible.has(first.kind)) return null;
        return cells.every((cell)=>key(cell) === key(first)) ? first : null;
    })();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        role: hasError ? "alert" : undefined,
        "aria-label": "Decision header",
        "data-contract": "decision-context",
        className: `caos-decision-header shrink-0 border-b border-caos-border bg-caos-panel/40 ${className}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>setUserOpen(!open),
                "aria-expanded": open,
                "aria-label": "Decision brief: change, impact, action, and evidence",
                className: "caos-decision-toggle w-full flex items-center gap-2 px-3 min-h-8 py-1 text-left focus-ring transition-caos hover:bg-caos-elevated/40",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs font-semibold uppercase tracking-[0.12em] text-caos-text",
                        children: "Decision brief"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                        lineNumber: 167,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "hidden sm:inline tabular text-caos-2xs uppercase tracking-widest text-caos-muted",
                        children: "Change · impact · action · evidence"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                        lineNumber: 168,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        "aria-hidden": "true",
                        className: "tabular text-caos-2xs text-caos-muted ml-auto",
                        children: open ? "−" : "+"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                        lineNumber: 169,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 160,
                columnNumber: 7
            }, this),
            open ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "border-t border-caos-border/60",
                children: [
                    sharedCause ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "caos-decision-grid grid grid-cols-1",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Cell, {
                            label: "Entire brief",
                            state: sharedCause,
                            showObservation: !commonObservation
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                            lineNumber: 175,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                        lineNumber: 174,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "caos-decision-grid grid grid-cols-1 md:grid-cols-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Cell, {
                                label: "What changed",
                                state: resolved.whatChanged,
                                showObservation: !commonObservation
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                                lineNumber: 179,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Cell, {
                                label: "Why it matters",
                                state: resolved.whyItMatters,
                                showObservation: !commonObservation
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                                lineNumber: 180,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Cell, {
                                label: "Required action",
                                state: resolved.requiredAction,
                                showObservation: !commonObservation
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                                lineNumber: 181,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Cell, {
                                label: "Evidence health",
                                state: resolved.evidenceHealth,
                                showObservation: !commonObservation
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                                lineNumber: 182,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                        lineNumber: 178,
                        columnNumber: 13
                    }, this),
                    commonObservation ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        "data-origin": commonObservation.authority.provenance.origin,
                        className: "caos-decision-observation flex flex-wrap items-center gap-2 border-t border-caos-border/60 px-3 py-1.5",
                        "aria-label": "Shared authority for all decision conclusions",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "caos-observation-label tabular text-caos-2xs uppercase tracking-widest text-caos-muted",
                                children: "Observation authority"
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                                lineNumber: 187,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "caos-observation-time tabular text-caos-2xs text-caos-muted",
                                children: [
                                    "as of ",
                                    commonObservation.asOf
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                                lineNumber: 188,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ConclusionAuthority$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConclusionAuthority"], {
                                prov: {
                                    ...commonObservation.authority.provenance,
                                    asOf: commonObservation.asOf
                                },
                                approval: commonObservation.authority.approval
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                                lineNumber: 189,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                        lineNumber: 186,
                        columnNumber: 13
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 172,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/DecisionHeader.tsx",
        lineNumber: 159,
        columnNumber: 5
    }, this);
}
_s(DecisionHeader, "JbWQ9pG4Qqg2Mw9MOpki/YdKDyc=");
_c4 = DecisionHeader;
var _c, _c1, _c2, _c3, _c4;
__turbopack_context__.k.register(_c, "DatumObservation");
__turbopack_context__.k.register(_c1, "DatumActions");
__turbopack_context__.k.register(_c2, "Datum");
__turbopack_context__.k.register(_c3, "Cell");
__turbopack_context__.k.register(_c4, "DecisionHeader");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/persona-composition.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ALL_ANALYSIS_SURFACES",
    ()=>ALL_ANALYSIS_SURFACES,
    "PERSONAS",
    ()=>PERSONAS,
    "PERSONA_COMPOSITIONS",
    ()=>PERSONA_COMPOSITIONS,
    "getSurfaceComposition",
    ()=>getSurfaceComposition
]);
const PERSONAS = [
    "analyst",
    "pm",
    "qa"
];
const ALL_ANALYSIS_SURFACES = [
    "issuers",
    "upload",
    "research",
    "sponsors",
    "command",
    "deep-dive",
    "model",
    "reports",
    "pipeline",
    "monitor",
    "settings",
    "issuer-profile",
    "global-ask",
    "query",
    "sector-review",
    "rv-screener",
    "portfolio-lab",
    "ic-book"
];
const ANALYST_SLOT_ORDER = [
    "decision",
    "primary",
    "context",
    "inspector",
    "utility",
    "finalization"
];
const PM_SLOT_ORDER = [
    "decision",
    "primary",
    "inspector",
    "context",
    "utility",
    "finalization"
];
const QA_SLOT_ORDER = [
    "inspector",
    "decision",
    "primary",
    "context",
    "utility",
    "finalization"
];
function defineSurfaceCompositions(surface, dominantRepresentation, configuration) {
    return {
        analyst: Object.freeze({
            surface,
            persona: "analyst",
            dominantRepresentation,
            slotOrder: configuration.analyst.slotOrder ?? ANALYST_SLOT_ORDER,
            defaultOpenPanels: configuration.analyst.defaultOpenPanels ?? [
                "primary",
                "context",
                "inspector"
            ],
            summaryDensity: "detailed",
            emphasizedSlot: "primary",
            summaryLimit: null,
            actionPriority: configuration.analyst.actionPriority ?? [
                "analyze",
                "cite",
                "save"
            ],
            leadingDataset: configuration.analyst.leadingDataset,
            tableColumnPreset: configuration.analyst.tableColumnPreset
        }),
        pm: Object.freeze({
            surface,
            persona: "pm",
            dominantRepresentation,
            slotOrder: configuration.pm.slotOrder ?? PM_SLOT_ORDER,
            defaultOpenPanels: configuration.pm.defaultOpenPanels ?? [
                "decision",
                "primary"
            ],
            summaryDensity: "compact",
            emphasizedSlot: "decision",
            summaryLimit: 4,
            actionPriority: configuration.pm.actionPriority ?? [
                "review-change",
                "decide",
                "hand-off"
            ],
            leadingDataset: configuration.pm.leadingDataset,
            tableColumnPreset: configuration.pm.tableColumnPreset ?? "pm-delta"
        }),
        qa: Object.freeze({
            surface,
            persona: "qa",
            dominantRepresentation,
            slotOrder: configuration.qa.slotOrder ?? QA_SLOT_ORDER,
            defaultOpenPanels: configuration.qa.defaultOpenPanels ?? [
                "inspector",
                "primary",
                "decision"
            ],
            summaryDensity: "standard",
            emphasizedSlot: "inspector",
            summaryLimit: 8,
            actionPriority: configuration.qa.actionPriority ?? [
                "review-gate",
                "inspect-evidence",
                "resolve"
            ],
            leadingDataset: configuration.qa.leadingDataset,
            tableColumnPreset: configuration.qa.tableColumnPreset ?? "qa-gates"
        })
    };
}
const PERSONA_COMPOSITIONS = {
    issuers: defineSurfaceCompositions("issuers", "table", {
        analyst: {
            leadingDataset: "coverage",
            tableColumnPreset: "coverage"
        },
        pm: {
            leadingDataset: "deltas"
        },
        qa: {
            leadingDataset: "gates"
        }
    }),
    upload: defineSurfaceCompositions("upload", "canvas", {
        analyst: {
            leadingDataset: "documents"
        },
        pm: {
            leadingDataset: "intake-status"
        },
        qa: {
            leadingDataset: "intake-governance"
        }
    }),
    research: defineSurfaceCompositions("research", "document", {
        analyst: {
            leadingDataset: "brief"
        },
        pm: {
            leadingDataset: "changes"
        },
        qa: {
            leadingDataset: "evidence"
        }
    }),
    sponsors: defineSurfaceCompositions("sponsors", "table", {
        analyst: {
            leadingDataset: "sponsor-risk",
            tableColumnPreset: "sponsor-risk"
        },
        pm: {
            leadingDataset: "sponsor-deltas"
        },
        qa: {
            leadingDataset: "sponsor-gates"
        }
    }),
    command: defineSurfaceCompositions("command", "table", {
        analyst: {
            leadingDataset: "coverage",
            tableColumnPreset: "ranked-changes"
        },
        pm: {
            leadingDataset: "changes"
        },
        qa: {
            leadingDataset: "governance"
        }
    }),
    "deep-dive": defineSurfaceCompositions("deep-dive", "document", {
        analyst: {
            leadingDataset: "analysis"
        },
        pm: {
            leadingDataset: "deltas"
        },
        qa: {
            leadingDataset: "evidence"
        }
    }),
    model: defineSurfaceCompositions("model", "model", {
        analyst: {
            leadingDataset: "model"
        },
        pm: {
            leadingDataset: "variance"
        },
        qa: {
            leadingDataset: "model-gates"
        }
    }),
    reports: defineSurfaceCompositions("reports", "document", {
        analyst: {
            leadingDataset: "document"
        },
        pm: {
            leadingDataset: "decision-summary"
        },
        qa: {
            leadingDataset: "qa-review"
        }
    }),
    pipeline: defineSurfaceCompositions("pipeline", "graph", {
        analyst: {
            leadingDataset: "queue",
            tableColumnPreset: "pipeline-queue"
        },
        pm: {
            leadingDataset: "deltas"
        },
        qa: {
            leadingDataset: "gates"
        }
    }),
    monitor: defineSurfaceCompositions("monitor", "table", {
        analyst: {
            leadingDataset: "alerts",
            tableColumnPreset: "alerts"
        },
        pm: {
            leadingDataset: "alerts"
        },
        qa: {
            leadingDataset: "governance"
        }
    }),
    settings: defineSurfaceCompositions("settings", "canvas", {
        analyst: {
            leadingDataset: "workspace"
        },
        pm: {
            leadingDataset: "preferences"
        },
        qa: {
            leadingDataset: "governance"
        }
    }),
    "issuer-profile": defineSurfaceCompositions("issuer-profile", "document", {
        analyst: {
            leadingDataset: "dossier"
        },
        pm: {
            leadingDataset: "posture"
        },
        qa: {
            leadingDataset: "evidence"
        }
    }),
    "global-ask": defineSurfaceCompositions("global-ask", "canvas", {
        analyst: {
            leadingDataset: "investigation"
        },
        pm: {
            leadingDataset: "decisions"
        },
        qa: {
            leadingDataset: "evidence"
        }
    }),
    query: defineSurfaceCompositions("query", "graph", {
        analyst: {
            leadingDataset: "graph"
        },
        pm: {
            leadingDataset: "deltas"
        },
        qa: {
            leadingDataset: "evidence"
        }
    }),
    "sector-review": defineSurfaceCompositions("sector-review", "document", {
        analyst: {
            leadingDataset: "sector-risk",
            tableColumnPreset: "sector-risk"
        },
        pm: {
            leadingDataset: "sector-deltas"
        },
        qa: {
            leadingDataset: "sector-gates"
        }
    }),
    "rv-screener": defineSurfaceCompositions("rv-screener", "table", {
        analyst: {
            leadingDataset: "relative-value",
            tableColumnPreset: "relative-value"
        },
        pm: {
            leadingDataset: "rv-deltas"
        },
        qa: {
            leadingDataset: "rv-gates"
        }
    }),
    "portfolio-lab": defineSurfaceCompositions("portfolio-lab", "table", {
        analyst: {
            leadingDataset: "positions",
            tableColumnPreset: "positions"
        },
        pm: {
            leadingDataset: "posture"
        },
        qa: {
            leadingDataset: "portfolio-gates"
        }
    }),
    "ic-book": defineSurfaceCompositions("ic-book", "table", {
        analyst: {
            leadingDataset: "decisions",
            tableColumnPreset: "decisions"
        },
        pm: {
            leadingDataset: "decisions"
        },
        qa: {
            leadingDataset: "decision-gates"
        }
    })
};
function getSurfaceComposition(surface, persona) {
    return PERSONA_COMPOSITIONS[surface][persona];
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/DominantTableRegion.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DominantTableOwnerGuard",
    ()=>DominantTableOwnerGuard,
    "DominantTableRegion",
    ()=>DominantTableRegion
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
const DominantOwnerRegistryContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
function DominantTableRegion({ ownerId, label, exemption, children, className = "", ...htmlProps }) {
    _s();
    const elementRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const tokenRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(Symbol(ownerId));
    const registry = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(DominantOwnerRegistryContext);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "DominantTableRegion.useEffect": ()=>{
            const element = elementRef.current;
            if (!registry || !element || exemption) return;
            return registry.register(tokenRef.current, element);
        }
    }["DominantTableRegion.useEffect"], [
        exemption,
        ownerId,
        registry
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: elementRef,
        ...htmlProps,
        role: "region",
        "aria-label": label,
        "data-caos-dominant-table-owner": exemption ? undefined : ownerId,
        "data-caos-table-exemption": exemption,
        "data-caos-table-region-id": ownerId,
        className: `caos-dominant-table-region ${className}`,
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/shared/DominantTableRegion.tsx",
        lineNumber: 53,
        columnNumber: 5
    }, this);
}
_s(DominantTableRegion, "fuXCb7CeJuUGC5WB9ptIvcdh5Rc=");
_c = DominantTableRegion;
function isInvariantVisible(element, boundary) {
    if (!element.isConnected) return false;
    let current = element;
    while(current){
        if (current.hidden || current.getAttribute("aria-hidden") === "true" || current.style.display === "none" || current.style.visibility === "hidden") return false;
        const computed = window.getComputedStyle(current);
        if (computed.display === "none" || computed.visibility === "hidden") return false;
        if (current === boundary) break;
        current = current.parentElement;
    }
    return true;
}
function duplicateOwnerMessage(owners) {
    if (owners.length <= 1) return null;
    const ids = owners.map((owner)=>owner.dataset.caosDominantTableOwner).join(", ");
    return `PersonaWorkbench permits one visible dominant table owner; found ${owners.length}: ${ids}.`;
}
function DevelopmentDominantOwnerGuard({ children }) {
    _s1();
    const ownersRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(new Map());
    const mountedRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const scheduledRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const [violation, setViolation] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const validate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "DevelopmentDominantOwnerGuard.useCallback[validate]": ()=>{
            const visibleOwners = Array.from(ownersRef.current.values()).filter({
                "DevelopmentDominantOwnerGuard.useCallback[validate].visibleOwners": (owner)=>isInvariantVisible(owner)
            }["DevelopmentDominantOwnerGuard.useCallback[validate].visibleOwners"]);
            const nextViolation = duplicateOwnerMessage(visibleOwners);
            setViolation({
                "DevelopmentDominantOwnerGuard.useCallback[validate]": (current)=>current === nextViolation ? current : nextViolation
            }["DevelopmentDominantOwnerGuard.useCallback[validate]"]);
        }
    }["DevelopmentDominantOwnerGuard.useCallback[validate]"], []);
    const scheduleValidation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "DevelopmentDominantOwnerGuard.useCallback[scheduleValidation]": ()=>{
            if (scheduledRef.current) return;
            scheduledRef.current = true;
            queueMicrotask({
                "DevelopmentDominantOwnerGuard.useCallback[scheduleValidation]": ()=>{
                    scheduledRef.current = false;
                    if (mountedRef.current) validate();
                }
            }["DevelopmentDominantOwnerGuard.useCallback[scheduleValidation]"]);
        }
    }["DevelopmentDominantOwnerGuard.useCallback[scheduleValidation]"], [
        validate
    ]);
    const registry = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "DevelopmentDominantOwnerGuard.useMemo[registry]": ()=>({
                register (token, element) {
                    ownersRef.current.set(token, element);
                    scheduleValidation();
                    return ({
                        "DevelopmentDominantOwnerGuard.useMemo[registry]": ()=>{
                            ownersRef.current.delete(token);
                            scheduleValidation();
                        }
                    })["DevelopmentDominantOwnerGuard.useMemo[registry]"];
                }
            })
    }["DevelopmentDominantOwnerGuard.useMemo[registry]"], [
        scheduleValidation
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "DevelopmentDominantOwnerGuard.useEffect": ()=>{
            mountedRef.current = true;
            const observer = new MutationObserver(scheduleValidation);
            observer.observe(document.body, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: [
                    "hidden",
                    "aria-hidden",
                    "style",
                    "class"
                ]
            });
            scheduleValidation();
            return ({
                "DevelopmentDominantOwnerGuard.useEffect": ()=>{
                    mountedRef.current = false;
                    observer.disconnect();
                }
            })["DevelopmentDominantOwnerGuard.useEffect"];
        }
    }["DevelopmentDominantOwnerGuard.useEffect"], [
        scheduleValidation
    ]);
    if (violation) throw new Error(violation);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DominantOwnerRegistryContext.Provider, {
        value: registry,
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/shared/DominantTableRegion.tsx",
        lineNumber: 145,
        columnNumber: 5
    }, this);
}
_s1(DevelopmentDominantOwnerGuard, "qdDYtOK3ovOZM6+nqHdvJ/m0vsI=");
_c1 = DevelopmentDominantOwnerGuard;
function DominantTableOwnerGuard({ children }) {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DevelopmentDominantOwnerGuard, {
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/shared/DominantTableRegion.tsx",
        lineNumber: 153,
        columnNumber: 10
    }, this);
}
_c2 = DominantTableOwnerGuard;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "DominantTableRegion");
__turbopack_context__.k.register(_c1, "DevelopmentDominantOwnerGuard");
__turbopack_context__.k.register(_c2, "DominantTableOwnerGuard");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/PersonaWorkbench.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PersonaWorkbench",
    ()=>PersonaWorkbench,
    "usePersonaComposition",
    ()=>usePersonaComposition,
    "useSurfaceComposition",
    ()=>useSurfaceComposition,
    "useWorkbenchComposition",
    ()=>useWorkbenchComposition
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$persona$2d$composition$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/persona-composition.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/use-modal-a11y.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ModalBackdrop.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RoleViewProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/RoleViewProvider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$DominantTableRegion$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/DominantTableRegion.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature(), _s4 = __turbopack_context__.k.signature(), _s5 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
function useNarrowWorkbench() {
    _s();
    // At 1024px the two supporting columns compress the dominant artifact and
    // clip dense decision cells. Treat tablet/small-laptop widths as drawer mode;
    // 1100px+ retains the multi-column desk composition.
    const query = "(max-width: 1099px)";
    // Keep the server and first hydrated client snapshot identical. The media
    // query is applied only after mount, preserving the primary subtree through
    // the responsive composition change.
    const [narrow, setNarrow] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useNarrowWorkbench.useEffect": ()=>{
            const media = window.matchMedia?.(query);
            if (!media) return;
            const update = {
                "useNarrowWorkbench.useEffect.update": ()=>setNarrow(media.matches)
            }["useNarrowWorkbench.useEffect.update"];
            update();
            media.addEventListener("change", update);
            return ({
                "useNarrowWorkbench.useEffect": ()=>media.removeEventListener("change", update)
            })["useNarrowWorkbench.useEffect"];
        }
    }["useNarrowWorkbench.useEffect"], []);
    return narrow;
}
_s(useNarrowWorkbench, "xTZnGS8DAFabb6CdaMcRipXkong=");
function defaultPanelState(defaultOpenPanels) {
    return {
        context: defaultOpenPanels.includes("context"),
        inspector: defaultOpenPanels.includes("inspector")
    };
}
function PersonaDrawer({ content, onClose, panelId, title, titleId }) {
    _s1();
    const panelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useModalA11y"])(onClose);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ModalBackdrop"], {
        onClose: onClose,
        align: "end",
        className: "persona-workbench__drawer-layer",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            ref: panelRef,
            id: panelId,
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": titleId,
            className: "persona-workbench__drawer",
            onClick: (event)=>event.stopPropagation(),
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                    className: "persona-workbench__drawer-header",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            id: titleId,
                            children: title
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
                            lineNumber: 87,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            "aria-label": `Close ${title.toLowerCase()} drawer`,
                            onClick: onClose,
                            className: "persona-workbench__drawer-close",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                "aria-hidden": "true",
                                children: "✕"
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
                                lineNumber: 94,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
                            lineNumber: 88,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
                    lineNumber: 86,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "persona-workbench__drawer-body",
                    children: content
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
                    lineNumber: 97,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
            lineNumber: 77,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
        lineNumber: 76,
        columnNumber: 5
    }, this);
}
_s1(PersonaDrawer, "NzS0XIvlwCI5xOhK6tXUvdRvvIY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useModalA11y"]
    ];
});
_c = PersonaDrawer;
const WorkbenchCompositionContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
function usePersonaComposition(surface, persona) {
    _s2();
    const provider = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RoleViewProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRoleView"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$persona$2d$composition$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSurfaceComposition"])(surface, persona ?? provider.roleView);
}
_s2(usePersonaComposition, "KnJYcD0DamM5w3xwoMpDwayaRjw=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RoleViewProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRoleView"]
    ];
});
const useSurfaceComposition = usePersonaComposition;
function useWorkbenchComposition() {
    _s3();
    const composition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(WorkbenchCompositionContext);
    if (!composition) throw new Error("useWorkbenchComposition must be used within PersonaWorkbench");
    return composition;
}
_s3(useWorkbenchComposition, "Da03ezKL9dRTOsKA51HgaAcgrHs=");
function usePersonaWorkbenchState(surface, activePersona, composition) {
    _s4();
    const narrow = useNarrowWorkbench();
    const [activeDrawer, setActiveDrawer] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const panelDefaultsKey = `${surface}:${activePersona}`;
    const [panelState, setPanelState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "usePersonaWorkbenchState.useState": ()=>({
                key: panelDefaultsKey,
                panels: defaultPanelState(composition.defaultOpenPanels)
            })
    }["usePersonaWorkbenchState.useState"]);
    const openPanels = panelState.key === panelDefaultsKey ? panelState.panels : defaultPanelState(composition.defaultOpenPanels);
    const drawerTitleId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    const contextPanelId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    const inspectorPanelId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLayoutEffect"])({
        "usePersonaWorkbenchState.useLayoutEffect": ()=>{
            setPanelState({
                "usePersonaWorkbenchState.useLayoutEffect": (current)=>current.key === panelDefaultsKey ? current : {
                        key: panelDefaultsKey,
                        panels: defaultPanelState(composition.defaultOpenPanels)
                    }
            }["usePersonaWorkbenchState.useLayoutEffect"]);
            setActiveDrawer(null);
        }
    }["usePersonaWorkbenchState.useLayoutEffect"], [
        composition.defaultOpenPanels,
        panelDefaultsKey
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "usePersonaWorkbenchState.useEffect": ()=>{
            if (!narrow) setActiveDrawer(null);
        }
    }["usePersonaWorkbenchState.useEffect"], [
        narrow
    ]);
    const toggleSupportingPanel = (slot)=>{
        if (narrow) setActiveDrawer(slot);
        else setPanelState((current)=>{
            const panels = current.key === panelDefaultsKey ? current.panels : defaultPanelState(composition.defaultOpenPanels);
            return {
                key: panelDefaultsKey,
                panels: {
                    ...panels,
                    [slot]: !panels[slot]
                }
            };
        });
    };
    return {
        activeDrawer,
        contextPanelId,
        drawerTitleId,
        inspectorPanelId,
        narrow,
        openPanels,
        setActiveDrawer,
        toggleSupportingPanel
    };
}
_s4(usePersonaWorkbenchState, "kuBGwquBMw0SMpjwwD1Gd6Vihns=", false, function() {
    return [
        useNarrowWorkbench,
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"]
    ];
});
function SupportTrigger({ slot, state }) {
    const context = slot === "context";
    const title = context ? "Context" : "Inspector";
    const expanded = state.narrow ? state.activeDrawer === slot : state.openPanels[slot];
    const panelId = context ? state.contextPanelId : state.inspectorPanelId;
    const drawerLabel = context ? "Open context drawer" : "Open evidence inspector drawer";
    const panelLabel = `${state.openPanels[slot] ? "Collapse" : "Open"} ${context ? "context" : "evidence inspector"} panel`;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        "aria-expanded": expanded,
        "aria-controls": panelId,
        "aria-label": state.narrow ? drawerLabel : panelLabel,
        onClick: ()=>state.toggleSupportingPanel(slot),
        className: "persona-workbench__drawer-trigger",
        children: state.narrow ? title : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    "aria-hidden": "true",
                    children: state.openPanels[slot] ? "▾ " : "▸ "
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
                    lineNumber: 168,
                    columnNumber: 33
                }, this),
                title
            ]
        }, void 0, true)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
        lineNumber: 167,
        columnNumber: 5
    }, this);
}
_c1 = SupportTrigger;
function SupportingPanelNav({ context, inspector, state }) {
    if (!context && !inspector) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
        className: "persona-workbench__drawer-triggers",
        "aria-label": "Workbench supporting panels",
        children: [
            context ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SupportTrigger, {
                slot: "context",
                state: state
            }, void 0, false, {
                fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
                lineNumber: 177,
                columnNumber: 18
            }, this) : null,
            inspector ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SupportTrigger, {
                slot: "inspector",
                state: state
            }, void 0, false, {
                fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
                lineNumber: 178,
                columnNumber: 20
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
        lineNumber: 176,
        columnNumber: 5
    }, this);
}
_c2 = SupportingPanelNav;
function workbenchSlots(props, state) {
    return {
        decision: props.decision,
        primary: props.primary,
        context: state.narrow || !state.openPanels.context ? null : props.context,
        inspector: state.narrow || !state.openPanels.inspector ? null : props.inspector,
        utility: props.utility,
        finalization: props.finalization
    };
}
function visibleSupportOrder(composition, props, state) {
    if (state.narrow) return [];
    return composition.slotOrder.filter((slot)=>{
        if (slot !== "context" && slot !== "inspector") return false;
        const supplied = slot === "context" ? props.context : props.inspector;
        return supplied !== null && supplied !== undefined && state.openPanels[slot];
    });
}
function WorkbenchComposition({ composition, props, state }) {
    const slots = workbenchSlots(props, state);
    const supportOrder = visibleSupportOrder(composition, props, state);
    const gridAreaFor = (slot)=>{
        if (slot === supportOrder[0]) return "support-a";
        if (slot === supportOrder[1]) return "support-b";
        return slot;
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `persona-workbench__composition persona-workbench__composition--supports-${supportOrder.length}`,
        "data-visible-support-count": supportOrder.length,
        children: composition.slotOrder.map((slot)=>slots[slot] ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                id: slot === "context" ? state.contextPanelId : slot === "inspector" ? state.inspectorPanelId : undefined,
                className: `persona-workbench__slot persona-workbench__slot--${slot} ${composition.emphasizedSlot === slot ? "persona-workbench__slot--emphasized" : ""}`,
                "data-slot": slot,
                "data-emphasized": composition.emphasizedSlot === slot,
                "data-grid-area": gridAreaFor(slot),
                style: {
                    gridArea: gridAreaFor(slot)
                },
                children: slots[slot]
            }, slot, false, {
                fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
                lineNumber: 214,
                columnNumber: 9
            }, this) : null)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
        lineNumber: 212,
        columnNumber: 5
    }, this);
}
_c3 = WorkbenchComposition;
function ActivePersonaDrawer({ context, inspector, state }) {
    if (!state.narrow || !state.activeDrawer) return null;
    const contextDrawer = state.activeDrawer === "context";
    const content = contextDrawer ? context : inspector;
    if (!content) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PersonaDrawer, {
        content: content,
        onClose: ()=>state.setActiveDrawer(null),
        panelId: contextDrawer ? state.contextPanelId : state.inspectorPanelId,
        title: contextDrawer ? "Context" : "Evidence inspector",
        titleId: state.drawerTitleId
    }, void 0, false, {
        fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
        lineNumber: 228,
        columnNumber: 5
    }, this);
}
_c4 = ActivePersonaDrawer;
function PersonaWorkbenchView({ activePersona, composition, props, state }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-testid": "persona-workbench",
        "data-surface": props.surface,
        "data-persona": activePersona,
        "data-dominant-representation": composition.dominantRepresentation,
        "data-summary-density": composition.summaryDensity,
        "data-default-open-panels": composition.defaultOpenPanels.join(" "),
        "data-table-column-preset": composition.tableColumnPreset,
        className: `persona-workbench persona-workbench--density-${composition.summaryDensity} persona-workbench--emphasis-${composition.emphasizedSlot} ${props.className ?? ""}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SupportingPanelNav, {
                context: props.context,
                inspector: props.inspector,
                state: state
            }, void 0, false, {
                fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
                lineNumber: 235,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(WorkbenchComposition, {
                composition: composition,
                props: props,
                state: state
            }, void 0, false, {
                fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
                lineNumber: 236,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ActivePersonaDrawer, {
                context: props.context,
                inspector: props.inspector,
                state: state
            }, void 0, false, {
                fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
                lineNumber: 237,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
        lineNumber: 234,
        columnNumber: 5
    }, this);
}
_c5 = PersonaWorkbenchView;
function PersonaWorkbench(props) {
    _s5();
    const composition = usePersonaComposition(props.surface, props.persona);
    const activePersona = composition.persona;
    const state = usePersonaWorkbenchState(props.surface, activePersona, composition);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(WorkbenchCompositionContext.Provider, {
        value: composition,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$DominantTableRegion$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DominantTableOwnerGuard"], {
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PersonaWorkbenchView, {
                activePersona: activePersona,
                composition: composition,
                props: props,
                state: state
            }, void 0, false, {
                fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
                lineNumber: 249,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
            lineNumber: 248,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
        lineNumber: 247,
        columnNumber: 5
    }, this);
}
_s5(PersonaWorkbench, "ug/4IiN/QGLnDWx/rBPzEfvshbA=", false, function() {
    return [
        usePersonaComposition,
        usePersonaWorkbenchState
    ];
});
_c6 = PersonaWorkbench;
var _c, _c1, _c2, _c3, _c4, _c5, _c6;
__turbopack_context__.k.register(_c, "PersonaDrawer");
__turbopack_context__.k.register(_c1, "SupportTrigger");
__turbopack_context__.k.register(_c2, "SupportingPanelNav");
__turbopack_context__.k.register(_c3, "WorkbenchComposition");
__turbopack_context__.k.register(_c4, "ActivePersonaDrawer");
__turbopack_context__.k.register(_c5, "PersonaWorkbenchView");
__turbopack_context__.k.register(_c6, "PersonaWorkbench");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/analyst-opinions.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "analystOpinionsApi",
    ()=>analystOpinionsApi
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
;
const analystOpinionsApi = {
    list: (issuerId)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["api"].get(`/api/issuers/${issuerId}/analyst-opinions`).then((response)=>response.data),
    create: (issuerId, input)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["api"].post(`/api/issuers/${issuerId}/analyst-opinions`, input).then((response)=>response.data)
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/profile/AnalystViewPanel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AnalystViewPanel",
    ()=>AnalystViewPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/Panel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/StatusGlyph.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analyst$2d$opinions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/analyst-opinions.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
const STANCE_LABEL = {
    OVERWEIGHT: "Overweight",
    NEUTRAL: "Neutral",
    UNDERWEIGHT: "Underweight"
};
function sameStance(systemStance, stance) {
    return systemStance?.trim().toUpperCase() === stance;
}
const INITIAL_DRAFT = {
    stance: "NEUTRAL",
    conviction: "",
    evidenceState: "supported",
    rationale: "",
    unresolved: ""
};
function draftFromHistory(history) {
    if (!history.current) return null;
    return {
        stance: history.current.stance,
        conviction: history.current.conviction == null ? "" : String(history.current.conviction),
        evidenceState: history.current.evidence_state,
        rationale: history.current.rationale_md,
        unresolved: history.current.unresolved_items.join("\n")
    };
}
function useOpinionHistory(issuerId, setDraft) {
    _s();
    const [history, setHistory] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useOpinionHistory.useEffect": ()=>{
            let stale = false;
            setLoading(true);
            setError(null);
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analyst$2d$opinions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["analystOpinionsApi"].list(issuerId).then({
                "useOpinionHistory.useEffect": (next)=>{
                    if (stale) return;
                    setHistory(next);
                    const nextDraft = draftFromHistory(next);
                    if (nextDraft) setDraft(nextDraft);
                }
            }["useOpinionHistory.useEffect"]).catch({
                "useOpinionHistory.useEffect": (reason)=>!stale && setError((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toErrorMessage"])(reason, "Analyst view unavailable."))
            }["useOpinionHistory.useEffect"]).finally({
                "useOpinionHistory.useEffect": ()=>!stale && setLoading(false)
            }["useOpinionHistory.useEffect"]);
            return ({
                "useOpinionHistory.useEffect": ()=>{
                    stale = true;
                }
            })["useOpinionHistory.useEffect"];
        }
    }["useOpinionHistory.useEffect"], [
        issuerId,
        setDraft
    ]);
    return {
        history,
        setHistory,
        loading,
        error,
        setError
    };
}
_s(useOpinionHistory, "4jnjqrqyQgAdEdeoAXhhLolXWX0=");
function unresolvedItems(value) {
    return value.split("\n").map((item)=>item.trim()).filter(Boolean);
}
function parseConviction(value) {
    if (value.trim() === "") return {
        value: null,
        error: null
    };
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return {
        value: null,
        error: "Conviction must be a finite percentage from 0 to 100."
    };
    return {
        value: parsed,
        error: null
    };
}
function canSubmitOpinion(draft, saving) {
    if (!draft.rationale.trim() || saving) return false;
    return draft.evidenceState !== "provisional" || unresolvedItems(draft.unresolved).length > 0;
}
function opinionRequest(props, draft) {
    const conviction = parseConviction(draft.conviction);
    if (conviction.error) return {
        error: conviction.error,
        payload: null
    };
    return {
        error: null,
        payload: {
            stance: draft.stance,
            conviction: conviction.value,
            rationale_md: draft.rationale.trim(),
            evidence_state: draft.evidenceState,
            unresolved_items: unresolvedItems(draft.unresolved),
            source_run_id: props.sourceRunId ?? null,
            context_id: props.contextId ?? null
        }
    };
}
function useAnalystViewModel(props) {
    _s1();
    const [draft, setDraft] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(INITIAL_DRAFT);
    const [saving, setSaving] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const historyState = useOpinionHistory(props.issuerId, setDraft);
    const current = historyState.history?.current ?? null;
    const updateDraft = (key, value)=>setDraft((previous)=>({
                ...previous,
                [key]: value
            }));
    const submit = async ()=>{
        if (!canSubmitOpinion(draft, saving)) return;
        const request = opinionRequest(props, draft);
        if (!request.payload) {
            historyState.setError(request.error);
            return;
        }
        setSaving(true);
        historyState.setError(null);
        try {
            const opinion = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analyst$2d$opinions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["analystOpinionsApi"].create(props.issuerId, request.payload);
            historyState.setHistory((previous)=>({
                    current: opinion,
                    items: [
                        opinion,
                        ...previous?.items ?? []
                    ]
                }));
        } catch (reason) {
            historyState.setError((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toErrorMessage"])(reason, "Analyst view could not be saved."));
        } finally{
            setSaving(false);
        }
    };
    return {
        props,
        draft,
        updateDraft,
        saving,
        ...historyState,
        current,
        divergence: Boolean(current && !sameStance(props.systemStance, current.stance)),
        submit
    };
}
_s1(useAnalystViewModel, "2pn5uNdVbWvrIze11tdgfKk+SFs=", false, function() {
    return [
        useOpinionHistory
    ];
});
function CurrentAnalystView({ model }) {
    const current = model.current;
    if (!current) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "border-y border-caos-border/40 py-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs font-semibold text-caos-text",
                        children: [
                            STANCE_LABEL[current.stance],
                            current.conviction != null ? ` · ${current.conviction}%` : ""
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                        lineNumber: 134,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: `tabular text-caos-2xs uppercase tracking-wider ${model.divergence ? "text-caos-warning" : "text-caos-success"}`,
                        children: model.divergence ? "Differs from system" : "Aligned with system"
                    }, void 0, false, {
                        fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                        lineNumber: 135,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                lineNumber: 133,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "m-0 mt-1 tabular text-caos-xs text-caos-muted",
                children: [
                    current.evidence_state,
                    current.unresolved_items.length ? ` · ${current.unresolved_items.length} unresolved` : ""
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                lineNumber: 137,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
        lineNumber: 132,
        columnNumber: 5
    }, this);
}
_c = CurrentAnalystView;
function AnalystViewFields({ model }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                children: [
                    "Stance",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        value: model.draft.stance,
                        onChange: (event)=>model.updateDraft("stance", event.target.value),
                        className: "mt-1 w-full",
                        children: Object.entries(STANCE_LABEL).map(([value, label])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: value,
                                children: label
                            }, value, false, {
                                fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                                lineNumber: 145,
                                columnNumber: 295
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                        lineNumber: 145,
                        columnNumber: 95
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                lineNumber: 145,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                children: [
                    "Conviction · 0–100%",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        name: "analyst-view-conviction",
                        autoComplete: "off",
                        value: model.draft.conviction,
                        onChange: (event)=>model.updateDraft("conviction", event.target.value),
                        type: "number",
                        min: "0",
                        max: "100",
                        inputMode: "decimal",
                        className: "mt-1 w-full",
                        placeholder: "Optional…"
                    }, void 0, false, {
                        fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                        lineNumber: 146,
                        columnNumber: 108
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                lineNumber: 146,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                children: [
                    "Evidence state",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        value: model.draft.evidenceState,
                        onChange: (event)=>model.updateDraft("evidenceState", event.target.value),
                        className: "mt-1 w-full",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: "supported",
                                children: "Supported"
                            }, void 0, false, {
                                fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                                lineNumber: 147,
                                columnNumber: 270
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: "provisional",
                                children: "Provisional"
                            }, void 0, false, {
                                fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                                lineNumber: 147,
                                columnNumber: 314
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                        lineNumber: 147,
                        columnNumber: 103
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                lineNumber: 147,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                children: [
                    "Rationale",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                        value: model.draft.rationale,
                        onChange: (event)=>model.updateDraft("rationale", event.target.value),
                        rows: 4,
                        maxLength: 50_000,
                        className: "mt-1 w-full",
                        placeholder: "Your defensible credit view…"
                    }, void 0, false, {
                        fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                        lineNumber: 148,
                        columnNumber: 98
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                lineNumber: 148,
                columnNumber: 7
            }, this),
            model.draft.evidenceState === "provisional" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-warning",
                children: [
                    "Unresolved items · one per line",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                        value: model.draft.unresolved,
                        onChange: (event)=>model.updateDraft("unresolved", event.target.value),
                        rows: 2,
                        className: "mt-1 w-full",
                        placeholder: "Confirm latest liquidity…"
                    }, void 0, false, {
                        fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                        lineNumber: 149,
                        columnNumber: 169
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                lineNumber: 149,
                columnNumber: 54
            }, this) : null
        ]
    }, void 0, true);
}
_c1 = AnalystViewFields;
function AnalystViewContent({ model }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "px-3 py-2 flex flex-col gap-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "m-0 tabular text-caos-xs text-caos-muted",
                children: [
                    "System view ",
                    model.props.systemStance ? `· ${model.props.systemStance}` : "unavailable",
                    ". Your view is separately versioned; detailed working notes remain in Analyst notes."
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                lineNumber: 157,
                columnNumber: 7
            }, this),
            model.loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "m-0 tabular text-caos-xs text-caos-muted",
                children: "Loading current analyst view…"
            }, void 0, false, {
                fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                lineNumber: 158,
                columnNumber: 24
            }, this) : null,
            model.error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "m-0 flex gap-1.5 tabular text-caos-xs text-caos-warning",
                role: "alert",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                        kind: "warning",
                        size: 10
                    }, void 0, false, {
                        fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                        lineNumber: 159,
                        columnNumber: 106
                    }, this),
                    model.error
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                lineNumber: 159,
                columnNumber: 22
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CurrentAnalystView, {
                model: model
            }, void 0, false, {
                fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                lineNumber: 160,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AnalystViewFields, {
                model: model
            }, void 0, false, {
                fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                lineNumber: 161,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                className: "caos-action-primary focus-ring self-start",
                onClick: ()=>void model.submit(),
                disabled: !canSubmitOpinion(model.draft, model.saving),
                children: model.saving ? "Saving…" : model.current ? "Publish new version" : "Publish analyst view"
            }, void 0, false, {
                fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
                lineNumber: 162,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
        lineNumber: 156,
        columnNumber: 5
    }, this);
}
_c2 = AnalystViewContent;
function AnalystViewPanel(props) {
    _s2();
    const model = useAnalystViewModel(props);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
        title: "Analyst view",
        right: model.current ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "tabular text-caos-2xs text-caos-muted",
            children: [
                "v",
                model.current.version,
                " · append-only"
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
            lineNumber: 169,
            columnNumber: 61
        }, this) : null,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AnalystViewContent, {
            model: model
        }, void 0, false, {
            fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
            lineNumber: 169,
            columnNumber: 171
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/profile/AnalystViewPanel.tsx",
        lineNumber: 169,
        columnNumber: 10
    }, this);
}
_s2(AnalystViewPanel, "5mX8vJT1KTfxy9rY8vXw5SqpaG4=", false, function() {
    return [
        useAnalystViewModel
    ];
});
_c3 = AnalystViewPanel;
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "CurrentAnalystView");
__turbopack_context__.k.register(_c1, "AnalystViewFields");
__turbopack_context__.k.register(_c2, "AnalystViewContent");
__turbopack_context__.k.register(_c3, "AnalystViewPanel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/profile/ThesisTimeline.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ThesisTimeline",
    ()=>ThesisTimeline
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/Panel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ActionReason.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
function PredictionRow({ prediction }) {
    _s();
    const [realized, setRealized] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(prediction.realized);
    const [draft, setDraft] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "contents",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-caos-text",
                children: prediction.metric
            }, void 0, false, {
                fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                lineNumber: 13,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-caos-muted",
                children: prediction.horizon
            }, void 0, false, {
                fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                lineNumber: 14,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-caos-text",
                children: prediction.predicted
            }, void 0, false, {
                fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                lineNumber: 15,
                columnNumber: 7
            }, this),
            realized != null ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-caos-text",
                children: realized
            }, void 0, false, {
                fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                lineNumber: 16,
                columnNumber: 27
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "flex gap-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "number",
                        name: `realized-${prediction.metric}`,
                        autoComplete: "off",
                        value: draft,
                        onChange: (e)=>setDraft(e.target.value),
                        "aria-label": `Realized ${prediction.metric}`,
                        className: "w-16 rounded border border-caos-border bg-caos-bg px-1 text-caos-text focus-ring"
                    }, void 0, false, {
                        fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                        lineNumber: 18,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ActionReason"], {
                        reason: !draft || !Number.isFinite(Number(draft)) ? "Enter a valid number" : null,
                        onClick: async ()=>setRealized((await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["realizeThesisPrediction"])(prediction.id, Number(draft))).realized),
                        className: "rounded border border-caos-border px-1 text-caos-muted aria-disabled:opacity-40 focus-ring",
                        children: "SET"
                    }, void 0, false, {
                        fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                        lineNumber: 19,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                lineNumber: 17,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
        lineNumber: 12,
        columnNumber: 5
    }, this);
}
_s(PredictionRow, "Ly9REeRZR+172el1oH3ci3iHtks=");
_c = PredictionRow;
function ThesisEditor({ draft, metric, horizon, predicted, busy, setDraft, setMetric, setHorizon, setPredicted, onSave }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "pt-2 border-t border-caos-border flex flex-col gap-1.5",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                htmlFor: "new-thesis-version",
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                children: "New thesis version"
            }, void 0, false, {
                fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                lineNumber: 51,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                id: "new-thesis-version",
                value: draft,
                onChange: (event)=>setDraft(event.target.value),
                rows: 4,
                maxLength: 50_000,
                className: "rounded border border-caos-border bg-caos-bg p-2 text-caos-sm text-caos-text focus-ring"
            }, void 0, false, {
                fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                lineNumber: 52,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-[1fr_auto_auto] gap-1.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        name: "prediction-metric",
                        autoComplete: "off",
                        value: metric,
                        onChange: (event)=>setMetric(event.target.value),
                        placeholder: "Prediction metric (optional)…",
                        "aria-label": "Prediction metric",
                        className: "rounded border border-caos-border bg-caos-bg px-2 text-caos-xs text-caos-text focus-ring"
                    }, void 0, false, {
                        fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                        lineNumber: 54,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "date",
                        name: "prediction-horizon",
                        autoComplete: "off",
                        value: horizon,
                        onChange: (event)=>setHorizon(event.target.value),
                        "aria-label": "Prediction horizon",
                        className: "rounded border border-caos-border bg-caos-bg px-2 text-caos-xs text-caos-text focus-ring"
                    }, void 0, false, {
                        fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                        lineNumber: 55,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "number",
                        name: "prediction-value",
                        autoComplete: "off",
                        value: predicted,
                        onChange: (event)=>setPredicted(event.target.value),
                        placeholder: "Predicted value…",
                        "aria-label": "Predicted value",
                        className: "w-24 rounded border border-caos-border bg-caos-bg px-2 text-caos-xs text-caos-text focus-ring"
                    }, void 0, false, {
                        fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                        lineNumber: 56,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                lineNumber: 53,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ActionReason"], {
                onClick: onSave,
                reason: busy ? "Saving…" : !draft.trim() ? "Enter thesis text first" : null,
                className: "self-end tabular text-caos-2xs min-h-8 px-2 rounded bg-caos-accent text-caos-bg aria-disabled:opacity-40 focus-ring",
                children: busy ? "SAVING…" : "SAVE VERSION"
            }, void 0, false, {
                fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                lineNumber: 58,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
        lineNumber: 50,
        columnNumber: 5
    }, this);
}
_c1 = ThesisEditor;
function ThesisVersionRow({ version, open }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
        className: "py-2",
        open: open,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                className: "cursor-pointer focus-ring rounded flex items-center gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs text-caos-text",
                        children: [
                            "V",
                            version.version
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                        lineNumber: 67,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs text-caos-muted",
                        children: [
                            version.trigger.toUpperCase(),
                            " · ",
                            new Date(version.created_at).toLocaleDateString("en-CA")
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                        lineNumber: 68,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                lineNumber: 66,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-1.5 text-caos-sm text-caos-text/90 whitespace-pre-wrap leading-relaxed",
                children: version.thesis_md
            }, void 0, false, {
                fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                lineNumber: 70,
                columnNumber: 7
            }, this),
            version.predictions.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-2 grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 tabular text-caos-2xs",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-caos-muted",
                        children: "METRIC"
                    }, void 0, false, {
                        fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                        lineNumber: 73,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-caos-muted",
                        children: "HORIZON"
                    }, void 0, false, {
                        fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                        lineNumber: 73,
                        columnNumber: 58
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-caos-muted",
                        children: "PREDICTED"
                    }, void 0, false, {
                        fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                        lineNumber: 73,
                        columnNumber: 106
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-caos-muted",
                        children: "REALIZED"
                    }, void 0, false, {
                        fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                        lineNumber: 73,
                        columnNumber: 156
                    }, this),
                    version.predictions.map((prediction)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PredictionRow, {
                            prediction: prediction
                        }, prediction.id, false, {
                            fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                            lineNumber: 74,
                            columnNumber: 52
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                lineNumber: 72,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
        lineNumber: 65,
        columnNumber: 5
    }, this);
}
_c2 = ThesisVersionRow;
function ThesisHistory({ versions, error, onRetry }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "pt-2 border-t border-caos-border flex flex-col divide-y divide-caos-border/50",
        children: [
            error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                role: "alert",
                className: "py-2 tabular text-caos-xs",
                style: {
                    color: "var(--caos-critical)"
                },
                children: [
                    "Couldn’t load thesis history. ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: onRetry,
                        className: "underline focus-ring",
                        children: "Retry"
                    }, void 0, false, {
                        fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                        lineNumber: 84,
                        columnNumber: 144
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                lineNumber: 84,
                columnNumber: 16
            }, this) : null,
            !error && versions.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "py-2 text-caos-xs text-caos-muted",
                children: "No thesis version captured yet."
            }, void 0, false, {
                fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                lineNumber: 85,
                columnNumber: 42
            }, this) : null,
            versions.map((version)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ThesisVersionRow, {
                    version: version,
                    open: version.version === versions[0]?.version
                }, version.id, false, {
                    fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                    lineNumber: 86,
                    columnNumber: 34
                }, this))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
        lineNumber: 83,
        columnNumber: 5
    }, this);
}
_c3 = ThesisHistory;
function ThesisTimeline({ issuerId, children }) {
    _s1();
    const [versions, setVersions] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [draft, setDraft] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [editing, setEditing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [metric, setMetric] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [horizon, setHorizon] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [predicted, setPredicted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const load = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ThesisTimeline.useCallback[load]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getThesisVersions"])(issuerId).then({
                "ThesisTimeline.useCallback[load]": (rows)=>{
                    setVersions(rows);
                    setError(false);
                }
            }["ThesisTimeline.useCallback[load]"]).catch({
                "ThesisTimeline.useCallback[load]": ()=>setError(true)
            }["ThesisTimeline.useCallback[load]"])
    }["ThesisTimeline.useCallback[load]"], [
        issuerId
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ThesisTimeline.useEffect": ()=>{
            void load();
        }
    }["ThesisTimeline.useEffect"], [
        load
    ]);
    const save = async ()=>{
        if (!draft.trim() || busy) return;
        setBusy(true);
        try {
            const hasPrediction = metric.trim() && horizon && predicted && Number.isFinite(Number(predicted));
            const row = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createThesisVersion"])({
                issuer_id: issuerId,
                thesis_md: draft.trim(),
                trigger: "manual",
                predictions: hasPrediction ? [
                    {
                        metric: metric.trim(),
                        horizon,
                        predicted: Number(predicted)
                    }
                ] : []
            });
            setVersions((current)=>[
                    row,
                    ...current
                ]);
            setDraft("");
            setMetric("");
            setHorizon("");
            setPredicted("");
            setEditing(false);
            setError(false);
        } catch  {
            setError(true);
        } finally{
            setBusy(false);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
        title: "Thesis & key drivers · memory",
        right: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
            type: "button",
            onClick: ()=>setEditing((value)=>!value),
            className: "tabular text-caos-2xs min-h-7 px-2 rounded border border-caos-border text-caos-muted hover:text-caos-text focus-ring",
            children: editing ? "CANCEL" : "+ VERSION"
        }, void 0, false, {
            fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
            lineNumber: 121,
            columnNumber: 14
        }, this),
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "px-3 py-2 flex flex-col gap-2",
            children: [
                children,
                editing ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ThesisEditor, {
                    draft: draft,
                    metric: metric,
                    horizon: horizon,
                    predicted: predicted,
                    busy: busy,
                    setDraft: setDraft,
                    setMetric: setMetric,
                    setHorizon: setHorizon,
                    setPredicted: setPredicted,
                    onSave: save
                }, void 0, false, {
                    fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                    lineNumber: 125,
                    columnNumber: 20
                }, this) : null,
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ThesisHistory, {
                    versions: versions,
                    error: error,
                    onRetry: load
                }, void 0, false, {
                    fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
                    lineNumber: 126,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
            lineNumber: 123,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/profile/ThesisTimeline.tsx",
        lineNumber: 119,
        columnNumber: 5
    }, this);
}
_s1(ThesisTimeline, "bA48A74sZQEmXlUxo2JJuT1lmUs=");
_c4 = ThesisTimeline;
var _c, _c1, _c2, _c3, _c4;
__turbopack_context__.k.register(_c, "PredictionRow");
__turbopack_context__.k.register(_c1, "ThesisEditor");
__turbopack_context__.k.register(_c2, "ThesisVersionRow");
__turbopack_context__.k.register(_c3, "ThesisHistory");
__turbopack_context__.k.register(_c4, "ThesisTimeline");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/typed-url-state.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "mergeAllowedUrlState",
    ()=>mergeAllowedUrlState,
    "useTypedUrlState",
    ()=>useTypedUrlState
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
const URL_STATE_EVENT = "caos:url-state";
function mergeAllowedUrlState(current, updates, allowedKeys) {
    const next = new URLSearchParams(current.toString());
    const allowed = new Set(allowedKeys);
    for (const [key, value] of Object.entries(updates)){
        if (!allowed.has(key)) {
            throw new Error(`URL state key "${key}" is not allow-listed.`);
        }
        if (value === undefined) continue;
        if (value === null || value === "") next.delete(key);
        else next.set(key, String(value));
    }
    return next;
}
function subscribe(listener) {
    window.addEventListener("popstate", listener);
    window.addEventListener(URL_STATE_EVENT, listener);
    return ()=>{
        window.removeEventListener("popstate", listener);
        window.removeEventListener(URL_STATE_EVENT, listener);
    };
}
function browserSnapshot() {
    return window.location.search;
}
function serverSnapshot() {
    return "";
}
function useTypedUrlState(allowedKeys) {
    _s();
    const search = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncExternalStore"])(subscribe, browserSnapshot, serverSnapshot);
    const keySignature = allowedKeys.join("\u0000");
    const values = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "useTypedUrlState.useMemo[values]": ()=>{
            const params = new URLSearchParams(search);
            return Object.fromEntries(allowedKeys.map({
                "useTypedUrlState.useMemo[values]": (key)=>[
                        key,
                        params.get(key)
                    ]
            }["useTypedUrlState.useMemo[values]"]));
        // keySignature captures the primitive key list without requiring adapter callers to memoize it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }
    }["useTypedUrlState.useMemo[values]"], [
        search,
        keySignature
    ]);
    const update = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useTypedUrlState.useCallback[update]": (changes, mode = "push")=>{
            const next = mergeAllowedUrlState(new URLSearchParams(window.location.search), changes, allowedKeys);
            const query = next.toString();
            const href = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
            const method = mode === "replace" ? "replaceState" : "pushState";
            window.history[method](window.history.state, "", href);
            window.dispatchEvent(new Event(URL_STATE_EVENT));
        }
    }["useTypedUrlState.useCallback[update]"], [
        allowedKeys
    ]);
    return {
        values,
        update
    };
}
_s(useTypedUrlState, "LeLhHDasfAkkaA1KoOUgzMD82VE=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncExternalStore"]
    ];
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/freshness.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FRESHNESS_VIEW",
    ()=>FRESHNESS_VIEW,
    "freshnessDetail",
    ()=>freshnessDetail,
    "resolvePipelineFreshnessRunId",
    ()=>resolvePipelineFreshnessRunId,
    "resolveReportFreshnessTarget",
    ()=>resolveReportFreshnessTarget,
    "toProvFreshness",
    ()=>toProvFreshness,
    "worstFreshness",
    ()=>worstFreshness
]);
const FRESHNESS_VIEW = {
    current: {
        label: "CURRENT",
        glyph: "success",
        color: "var(--caos-success)"
    },
    due: {
        label: "DUE",
        glyph: "warning",
        color: "var(--caos-warning)"
    },
    stale: {
        label: "STALE",
        glyph: "critical",
        color: "var(--caos-critical)"
    },
    unknown: {
        label: "UNKNOWN",
        glyph: "idle",
        color: "var(--caos-muted)"
    }
};
function toProvFreshness(evaluation) {
    return evaluation ? FRESHNESS_VIEW[evaluation.state].label : "UNKNOWN";
}
// Stale is known-bad, unknown is unverified, due needs review, current is clear.
// Choosing the maximum prevents a current sibling from hiding a weaker source.
const SEVERITY = {
    current: 0,
    due: 1,
    unknown: 2,
    stale: 3
};
function worstFreshness(evaluations) {
    return evaluations.filter((item)=>!!item).reduce((worst, item)=>!worst || SEVERITY[item.state] > SEVERITY[worst.state] ? item : worst, null);
}
function freshnessDetail(evaluation) {
    const stamp = evaluation.effective_period_end ? `effective ${evaluation.effective_period_end}` : evaluation.observed_at ? `observed ${evaluation.observed_at}` : "as-of unavailable";
    return `${evaluation.source_kind.replaceAll("_", " ")} · ${evaluation.reason.replaceAll("_", " ")} · ${stamp} · ${evaluation.policy_version}`;
}
function resolvePipelineFreshnessRunId(runParam, liveRunId) {
    return runParam ?? liveRunId ?? null;
}
function resolveReportFreshnessTarget(selectedVersion, engineRunId) {
    return selectedVersion ? {
        artifactId: selectedVersion.id,
        runId: selectedVersion.run_id
    } : {
        artifactId: null,
        runId: engineRunId ?? null
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/FreshnessIndicator.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FreshnessIndicator",
    ()=>FreshnessIndicator
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/StatusGlyph.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$freshness$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/freshness.ts [app-client] (ecmascript)");
;
;
;
function FreshnessIndicator({ evaluation, className = "" }) {
    if (!evaluation) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: `inline-flex items-center gap-1 tabular text-caos-2xs uppercase ${className}`,
            style: {
                color: "var(--caos-muted)"
            },
            "aria-label": "Freshness unknown; central evaluation unavailable",
            title: "Central freshness evaluation unavailable",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                    kind: "idle"
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/FreshnessIndicator.tsx",
                    lineNumber: 7,
                    columnNumber: 259
                }, this),
                "UNKNOWN"
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/shared/FreshnessIndicator.tsx",
            lineNumber: 7,
            columnNumber: 12
        }, this);
    }
    const view = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$freshness$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FRESHNESS_VIEW"][evaluation.state];
    const detail = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$freshness$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["freshnessDetail"])(evaluation);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: `inline-flex items-center gap-1 tabular text-caos-2xs uppercase ${className}`,
        style: {
            color: view.color
        },
        "aria-label": `Freshness ${view.label}; ${detail}`,
        title: detail,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                kind: view.glyph
            }, void 0, false, {
                fileName: "[project]/src/components/shared/FreshnessIndicator.tsx",
                lineNumber: 11,
                columnNumber: 201
            }, this),
            view.label
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/FreshnessIndicator.tsx",
        lineNumber: 11,
        columnNumber: 10
    }, this);
}
_c = FreshnessIndicator;
var _c;
__turbopack_context__.k.register(_c, "FreshnessIndicator");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/SourceRef.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SourceRef",
    ()=>SourceRef
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
"use client";
;
const LOCAL_SOURCE_BASE = "https://caos.invalid";
function safeSourceHref(raw) {
    // Keep the rendered href byte-for-byte identical once accepted. Reject URL
    // forms whose browser interpretation can change after trimming or slash
    // normalization rather than trying to repair an untrusted source reference.
    if (!raw || /[\s\\]/u.test(raw) || raw.startsWith("//")) return null;
    try {
        if (raw.startsWith("/")) {
            const parsed = new URL(raw, LOCAL_SOURCE_BASE);
            return parsed.origin === LOCAL_SOURCE_BASE ? raw : null;
        }
        if (!/^https?:\/\//iu.test(raw)) return null;
        const parsed = new URL(raw);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:" || parsed.username || parsed.password) {
            return null;
        }
        return raw;
    } catch  {
        return null;
    }
}
function SourceRef({ source, children, className = "" }) {
    const classes = `tabular text-caos-2xs${className ? ` ${className}` : ""}`;
    if (source.state === "unavailable") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: `${classes} text-caos-muted`,
            children: [
                "Source unavailable · ",
                source.reason
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/ui/SourceRef.tsx",
            lineNumber: 70,
            columnNumber: 12
        }, this);
    }
    const label = children ?? `Source ${source.id}`;
    const ariaLabel = `Open source ${source.id}`;
    if ("href" in source && typeof source.href === "string") {
        const href = safeSourceHref(source.href);
        if (!href) {
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: `${classes} text-caos-muted`,
                children: [
                    "Source unavailable · Source ",
                    source.id,
                    " has an invalid destination."
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ui/SourceRef.tsx",
                lineNumber: 78,
                columnNumber: 14
            }, this);
        }
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
            href: href,
            className: `${classes} rounded text-caos-muted hover:text-caos-accent transition-caos focus-ring`,
            "aria-label": ariaLabel,
            children: label
        }, void 0, false, {
            fileName: "[project]/src/components/ui/SourceRef.tsx",
            lineNumber: 80,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        className: `${classes} rounded text-caos-muted hover:text-caos-accent transition-caos focus-ring`,
        onClick: source.onOpen,
        "aria-label": ariaLabel,
        children: label
    }, void 0, false, {
        fileName: "[project]/src/components/ui/SourceRef.tsx",
        lineNumber: 82,
        columnNumber: 10
    }, this);
}
_c = SourceRef;
var _c;
__turbopack_context__.k.register(_c, "SourceRef");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/engine/useFreshness.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "derivedFreshness",
    ()=>derivedFreshness,
    "useIssuerFreshness",
    ()=>useIssuerFreshness
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
const statusFor = (requested)=>requested ? "loading" : "idle";
function compatibilityUnavailable(reason) {
    return reason?.response?.status === 404;
}
async function readFreshness(requested, read) {
    if (!requested) return {
        value: null,
        status: "idle"
    };
    try {
        return {
            value: await read(),
            status: "ready"
        };
    } catch (reason) {
        return {
            value: null,
            status: compatibilityUnavailable(reason) ? "compatibility-unavailable" : "error"
        };
    }
}
function useIssuerFreshness({ issuerId, contextId, runId, artifactRevision }) {
    _s();
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        issuer: null,
        context: null,
        run: null,
        issuerStatus: "idle",
        contextStatus: "idle",
        runStatus: "idle",
        contextRequested: false,
        loading: false,
        compatibilityUnavailable: false,
        error: false,
        unavailable: false
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useIssuerFreshness.useEffect": ()=>{
            const controller = new AbortController();
            let active = true;
            const issuerRequested = Boolean(issuerId);
            const contextRequested = Boolean(contextId);
            const runRequested = Boolean(runId);
            const anyRequested = issuerRequested || contextRequested || runRequested;
            setState({
                issuer: null,
                context: null,
                run: null,
                issuerStatus: statusFor(issuerRequested),
                contextStatus: statusFor(contextRequested),
                runStatus: statusFor(runRequested),
                contextRequested,
                loading: anyRequested,
                compatibilityUnavailable: false,
                error: false,
                unavailable: false
            });
            const issuerRead = readFreshness(issuerRequested, {
                "useIssuerFreshness.useEffect.issuerRead": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getIssuerFreshness"])(issuerId, controller.signal)
            }["useIssuerFreshness.useEffect.issuerRead"]);
            const contextRead = readFreshness(contextRequested, {
                "useIssuerFreshness.useEffect.contextRead": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getContextFreshness"])(contextId, controller.signal)
            }["useIssuerFreshness.useEffect.contextRead"]);
            const runRead = readFreshness(runRequested, {
                "useIssuerFreshness.useEffect.runRead": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getRunFreshness"])(runId, controller.signal)
            }["useIssuerFreshness.useEffect.runRead"]);
            Promise.all([
                issuerRead,
                contextRead,
                runRead
            ]).then({
                "useIssuerFreshness.useEffect": ([issuer, context, run])=>{
                    if (!active) return;
                    const requestedStatuses = [
                        issuerRequested ? issuer.status : null,
                        contextRequested ? context.status : null,
                        runRequested ? run.status : null
                    ].filter({
                        "useIssuerFreshness.useEffect.requestedStatuses": (status)=>status !== null
                    }["useIssuerFreshness.useEffect.requestedStatuses"]);
                    const onlyCompatibilityUnavailable = requestedStatuses.length > 0 && requestedStatuses.every({
                        "useIssuerFreshness.useEffect": (status)=>status === "compatibility-unavailable"
                    }["useIssuerFreshness.useEffect"]);
                    setState({
                        issuer: issuer.value,
                        context: context.value,
                        run: run.value,
                        issuerStatus: issuer.status,
                        contextStatus: context.status,
                        runStatus: run.status,
                        contextRequested,
                        loading: false,
                        compatibilityUnavailable: requestedStatuses.includes("compatibility-unavailable"),
                        error: requestedStatuses.includes("error"),
                        unavailable: onlyCompatibilityUnavailable
                    });
                }
            }["useIssuerFreshness.useEffect"]);
            return ({
                "useIssuerFreshness.useEffect": ()=>{
                    active = false;
                    controller.abort();
                }
            })["useIssuerFreshness.useEffect"];
        }
    }["useIssuerFreshness.useEffect"], [
        artifactRevision,
        contextId,
        issuerId,
        runId
    ]);
    return state;
}
_s(useIssuerFreshness, "wEmOtxuJrYvlJY9KxRoY+bBxoXY=");
function derivedFreshness(state, artifactId) {
    // Context is the preferred exact-artifact authority. If that read failed or
    // the compatibility endpoint is absent, a CURRENT run must not mask the
    // uncertainty. Callers render null as UNKNOWN.
    if (artifactId) {
        if (!state.contextRequested || state.contextStatus !== "ready") return null;
        return state.context?.artifacts.find((item)=>item.evaluation.source_kind === "derived_artifact" && item.artifact.id === artifactId)?.evaluation ?? null;
    }
    if (state.contextRequested && state.contextStatus !== "ready") return null;
    return state.run?.evaluation ?? state.issuer?.evaluations.find((item)=>item.source_kind === "derived_artifact") ?? state.issuer?.evaluations.find((item)=>item.source_kind === "run") ?? null;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/app/issuers/profile/ProfileContent.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AnalystNotesPanel",
    ()=>AnalystNotesPanel,
    "Profile",
    ()=>Profile,
    "analystNotesFromGraph",
    ()=>analystNotesFromGraph,
    "default",
    ()=>IssuerProfilePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// Issuer Profile — the per-name landing view. Click an issuer ticker/name and
// land here: identity + current house view + headline metrics + what-changed +
// thesis/risk + structure + coverage, one read, before drilling into Deep-Dive.
// Backed by GET /api/issuers/{id}/profile (a read-model; no synthesis). Every
// section degrades to an explicit empty state rather than fabricating — a name
// with no completed run shows "no run yet", not demo numbers.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/CloseButton.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RequireAuth$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/RequireAuth.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/Panel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CrossDefaultDominoes$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/CrossDefaultDominoes.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$VaultMemoUpload$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/query/VaultMemoUpload.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ShellIdentity$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ShellIdentity.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ConceptNav$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ConceptNav.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/StatusGlyph.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/SurfaceState.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/pipeline/atoms.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/sev.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$issuer$2d$profile$2d$charts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/issuer-profile-charts.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$issuers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/issuers.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/format.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$EnterprisePage$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/EnterprisePage.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$DecisionHeader$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/DecisionHeader.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$PersonaWorkbench$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/PersonaWorkbench.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$profile$2f$AnalystViewPanel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/profile/AnalystViewPanel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$profile$2f$ThesisTimeline$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/profile/ThesisTimeline.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/analysis-workbench.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$typed$2d$url$2d$state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/typed-url-state.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$FreshnessIndicator$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/FreshnessIndicator.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$SourceRef$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/SourceRef.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useFreshness$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/engine/useFreshness.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$freshness$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/freshness.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
const EMPTY_EARNINGS = {
    latest_period: null,
    prior_period: null,
    revenue_growth_pct: null,
    ebitda_growth_pct: null,
    margin_change_pp: null,
    monitoring_signals: []
};
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
;
;
;
;
;
;
;
const PROFILE_URL_KEYS = [
    "tab"
];
const PROFILE_TABS = [
    {
        id: "snapshot",
        label: "Snapshot"
    },
    {
        id: "financials",
        label: "Financials"
    },
    {
        id: "structure",
        label: "Structure & Covenant"
    },
    {
        id: "market",
        label: "Market & RV"
    },
    {
        id: "events",
        label: "Events"
    },
    {
        id: "evidence",
        label: "Evidence / QA"
    }
];
// FY ↔ quarter granularity options for the trend toggle (as-const so the union
// "FY" | "Q" flows into ToggleGroup's generic and back to setGran).
const GRAN_OPTS = [
    {
        k: "FY",
        l: "Full year"
    },
    {
        k: "Q",
        l: "Quarters"
    }
];
// Trend small-multiples (prototype design): label + big latest value + delta +
// a compact hand-SVG sparkline with a start-baseline and a hover crosshair that
// reveals the historical value at each period. Wired to the REAL metric series;
// LTM-only metrics show their value without a trend; 3Y DM has no server-side
// series so it renders an honest feed-pending card.
const TREND_ORDER = [
    "revenue",
    "adj_ebitda",
    "ebitda_margin",
    "net_leverage",
    "interest_coverage"
];
const TREND_FMT = {
    revenue: {
        title: "Revenue",
        color: "#63a1ff",
        unit: (v)=>v >= 1000 ? "$" + (v / 1000).toFixed(1) + "bn" : "$" + Math.round(v) + "m"
    },
    adj_ebitda: {
        title: "Adj. EBITDA",
        color: "#2dd4bf",
        unit: (v)=>"$" + Math.round(v) + "m"
    },
    ebitda_margin: {
        title: "EBITDA margin",
        color: "#22c55e",
        unit: (v)=>v.toFixed(1) + "%"
    },
    net_leverage: {
        title: "Net leverage",
        color: "#f5a524",
        unit: (v)=>v.toFixed(1) + "×"
    },
    interest_coverage: {
        title: "Interest cov.",
        color: "#a855f7",
        unit: (v)=>v.toFixed(1) + "×"
    }
};
function Sparkline({ pts, color, fmt }) {
    _s();
    const [active, setActive] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const W = 240, H = 46, pl = 3, pr = 7, pt = 7, pb = 7;
    const vals = pts.map((p)=>p.value);
    const lo = Math.min(...vals), top = Math.max(...vals);
    const span = top - lo || Math.abs(top) || 1;
    // TrendPlot only mounts a sparkline for a series with at least two points.
    const px = (i)=>pl + (W - pl - pr) * (i / (pts.length - 1));
    const py = (v)=>pt + (H - pt - pb) * (1 - (v - lo) / span);
    const poly = pts.map((p, i)=>`${px(i).toFixed(1)},${py(p.value).toFixed(1)}`).join(" ");
    const area = `M${px(0).toFixed(1)},${py(pts[0].value).toFixed(1)} L${pts.map((p, i)=>`${px(i).toFixed(1)},${py(p.value).toFixed(1)}`).join(" L")} L${px(pts.length - 1).toFixed(1)},${(H - pb).toFixed(1)} L${pl},${(H - pb).toFixed(1)} Z`;
    const activeIdx = active ?? -1;
    const cur = activeIdx >= 0 ? pts[activeIdx] : null;
    const trendLabel = pts.map((p)=>`${p.period} ${fmt(p.value)}`).join("; ");
    const setActiveFromX = (clientX, rect)=>{
        const x = (clientX - rect.left) / rect.width * W;
        const raw = Math.round((x - pl) / (W - pl - pr) * (pts.length - 1));
        setActive(Math.max(0, Math.min(pts.length - 1, raw)));
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                viewBox: `0 0 ${W} ${H}`,
                className: "block w-full h-auto cursor-crosshair focus-ring rounded-sm",
                role: "img",
                tabIndex: 0,
                "aria-label": `Metric trend sparkline. Use arrow keys to review points. Values: ${trendLabel}`,
                onPointerMove: (e)=>setActiveFromX(e.clientX, e.currentTarget.getBoundingClientRect()),
                onPointerLeave: ()=>setActive(null),
                onFocus: ()=>setActive((i)=>i ?? pts.length - 1),
                onBlur: ()=>setActive(null),
                onKeyDown: (e)=>{
                    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                    e.preventDefault();
                    const d = e.key === "ArrowLeft" ? -1 : 1;
                    setActive((i)=>Math.max(0, Math.min(pts.length - 1, (i ?? pts.length - 1) + d)));
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                        d: area,
                        fill: color,
                        fillOpacity: 0.12
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 110,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                        x1: pl,
                        y1: py(pts[0].value),
                        x2: W - pr,
                        y2: py(pts[0].value),
                        stroke: color,
                        strokeOpacity: 0.24,
                        strokeDasharray: "2 2"
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 111,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("polyline", {
                        points: poly,
                        fill: "none",
                        stroke: color,
                        strokeWidth: 1.8,
                        strokeLinejoin: "round"
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 112,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                        cx: px(pts.length - 1),
                        cy: py(pts[pts.length - 1].value),
                        r: 2.8,
                        fill: color
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 113,
                        columnNumber: 9
                    }, this),
                    cur ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                x1: px(activeIdx),
                                y1: pt,
                                x2: px(activeIdx),
                                y2: H - pb,
                                stroke: "#a1a1b5",
                                strokeOpacity: 0.5
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 116,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                                cx: px(activeIdx),
                                cy: py(cur.value),
                                r: 3.2,
                                fill: color,
                                stroke: "#11131d",
                                strokeWidth: 1.4
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 117,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 115,
                        columnNumber: 11
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 97,
                columnNumber: 7
            }, this),
            cur ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute pointer-events-none tabular",
                style: {
                    left: `${px(activeIdx) / W * 100}%`,
                    top: 0,
                    transform: "translate(-50%,-105%)",
                    background: "#1d2030",
                    border: "1px solid #34384a",
                    color: "#e6e6ef",
                    fontSize: 10.5,
                    padding: "3px 6px",
                    borderRadius: 4,
                    whiteSpace: "nowrap",
                    zIndex: 20
                },
                children: [
                    cur.period,
                    " · ",
                    fmt(cur.value)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 122,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 96,
        columnNumber: 5
    }, this);
}
_s(Sparkline, "UiziKGcot5E8nbuQQ2ZlRLdhk5k=");
_c = Sparkline;
const trendDelta = (delta)=>{
    if (delta == null) return null;
    const tone = delta > 0 ? "text-caos-success" : delta < 0 ? "text-caos-critical" : "text-caos-muted";
    const glyph = delta > 0 ? "▲ +" : delta < 0 ? "▼ " : "■ ";
    const value = Math.abs(delta) >= 10 ? Math.round(delta) : delta.toFixed(1);
    return {
        tone,
        glyph,
        value
    };
};
function TrendDelta({ delta, periods }) {
    const presentation = trendDelta(delta);
    if (!presentation) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `tabular text-caos-2xs ${presentation.tone}`,
        children: [
            presentation.glyph,
            presentation.value,
            " over ",
            periods,
            "p"
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 142,
        columnNumber: 5
    }, this);
}
_c1 = TrendDelta;
function TrendPlot({ pts, color, unit }) {
    if (pts.length >= 2) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Sparkline, {
        pts: pts,
        color: color,
        fmt: unit
    }, void 0, false, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 149,
        columnNumber: 31
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "tabular text-caos-2xs text-caos-muted py-2.5",
        children: "LTM only · needs ≥2 periods for a trend"
    }, void 0, false, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 150,
        columnNumber: 10
    }, this);
}
_c2 = TrendPlot;
function TrendCard({ title, pts, color, unit }) {
    const latest = pts.length ? pts[pts.length - 1].value : null;
    const delta = pts.length >= 2 ? pts[pts.length - 1].value - pts[0].value : null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rounded border border-caos-border bg-caos-bg px-3 py-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-baseline justify-between gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                        children: title
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 159,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-metric font-semibold",
                        children: latest != null ? unit(latest) : "—"
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 160,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 158,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TrendPlot, {
                pts: pts,
                color: color,
                unit: unit
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 162,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TrendDelta, {
                delta: delta,
                periods: pts.length
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 163,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 157,
        columnNumber: 5
    }, this);
}
_c3 = TrendCard;
// Issuer-scoped jumps into the other concepts, rendered in the bottom bar.
const ISSUER_ACTIONS = [
    {
        href: "/pipeline?issuer=",
        label: "Run issuer analysis"
    },
    {
        href: "/model?issuer=",
        label: "Open in Model Builder"
    },
    {
        href: "/reports?issuer=",
        label: "Open in Report Studio"
    },
    {
        href: "/upload?issuer=",
        label: "Upload issuer documents"
    }
];
function IssuerProfilePage() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RequireAuth$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RequireAuth"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Suspense"], {
            fallback: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Splash, {
                msg: "Loading profile…"
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 179,
                columnNumber: 27
            }, this),
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(IssuerProfileView, {}, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 180,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
            lineNumber: 179,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 178,
        columnNumber: 5
    }, this);
}
_c4 = IssuerProfilePage;
// ─── status → severity token (drives Tag/glyph color) ───────────────────────
const COMMITTEE_SEV = {
    "Committee Ready": "pass",
    Restricted: "warning",
    Blocked: "critical",
    "Draft Only": "low",
    "Insufficient Information": "low"
};
const RUN_SEV = {
    complete: "pass",
    running: "running",
    queued: "queued",
    failed: "critical"
};
// Categorical bands shared by fragility / LME / recommendation.
const BAND_SEV = {
    HIGH: "critical",
    MODERATE: "warning",
    MEDIUM: "warning",
    LOW: "pass",
    OVERWEIGHT: "pass",
    NEUTRAL: "low",
    UNDERWEIGHT: "critical"
};
const bandSev = (v)=>BAND_SEV[String(v).toUpperCase()] ?? "low";
// ─── value formatting (tabular, aligned) ────────────────────────────────────
// fallow-ignore-next-line complexity -- Credit metric units require one exhaustive deterministic formatter.
function fmt(value, unit) {
    if (unit === "x") return value.toFixed(1) + "×";
    if (unit === "%") return value.toFixed(1) + "%";
    if (unit === "$M") return Math.abs(value) >= 1000 ? "$" + (value / 1000).toFixed(1) + "bn" : "$" + value.toFixed(0) + "m";
    return value.toFixed(1);
}
const signed = (v, suffix = "", digits = 1)=>{
    const rounded = Number(v.toFixed(digits));
    return (rounded >= 0 ? "+" : "") + rounded.toFixed(digits) + suffix;
};
const METRIC_LABEL = {
    net_leverage: "Net leverage",
    interest_coverage: "Interest coverage",
    ebitda_margin: "EBITDA margin",
    revenue: "Revenue",
    adj_ebitda: "Adj. EBITDA",
    fcf: "Free cash flow",
    fcf_conversion: "FCF margin",
    altman_z: "Altman Z″"
};
// Snapshot tiles that carry a period-over-period delta (from CP-1B), shown inline
// under the value. Keyed by metric → the signal field + its unit.
const TILE_DELTA = {
    revenue: {
        key: "revenue_growth_pct",
        suffix: "%",
        higherIsBetter: true
    },
    adj_ebitda: {
        key: "ebitda_growth_pct",
        suffix: "%",
        higherIsBetter: true
    },
    ebitda_margin: {
        key: "margin_change_pp",
        suffix: "pp",
        higherIsBetter: true
    },
    net_leverage: {
        suffix: "×",
        digits: 2,
        higherIsBetter: false,
        showMissing: true
    },
    interest_coverage: {
        suffix: "×",
        higherIsBetter: true,
        showMissing: true
    },
    fcf: {
        suffix: "m",
        digits: 0,
        higherIsBetter: true,
        showMissing: true
    },
    fcf_conversion: {
        suffix: "pp",
        higherIsBetter: true,
        showMissing: true
    }
};
const STATUS_TOOLTIP = {
    "Committee Ready": "Analysis meets all standards and is ready for Investment Committee presentation",
    "Restricted": "Trading or analyst coverage is restricted due to regulatory or internal compliance guidelines",
    "Blocked": "Blocked from committee presentation due to compliance or severe data quality issues",
    "Draft Only": "Work in progress draft analysis; not verified",
    "Insufficient Information": "Missing critical document inputs to complete analysis",
    "Passed": "QA check completed with zero critical findings",
    "Not Reviewed": "QA analysis has not yet been performed",
    "Overweight": "Recommended high conviction buy-side exposure relative to benchmark index",
    "Neutral": "Hold existing exposure; no near-term change in credit stance",
    "Underweight": "Recommended reduced or zero credit exposure due to risk concerns"
};
const METRIC_TOOLTIP = {
    net_leverage: "Net Debt / Adjusted EBITDA. Measure of net leverage after cash offsets.",
    interest_coverage: "Adjusted EBITDA / Interest Expense. Coverage capacity for cash interest.",
    ebitda_margin: "Adjusted EBITDA / Revenue. Measure of operating margin profitability.",
    revenue: "Total segment revenue.",
    adj_ebitda: "Adjusted EBITDA. Operating cash flow before interest, tax, D&A, and adjusted items.",
    fcf: "Free Cash Flow. Operating cash flow minus capital expenditures.",
    fcf_conversion: "FCF / Revenue. Free cash flow as a percent of revenue (the engine's basis — not FCF/EBITDA cash conversion).",
    altman_z: "Altman Z''-Score. Formulaic assessment of credit strength and solvency (lower is weaker)."
};
// Provenance → how trustworthy. demo_fixture is fabricated and flagged loud.
const PROV = {
    run: {
        sev: "pass",
        label: "live run"
    },
    derived: {
        sev: "low",
        label: "derived"
    },
    seed: {
        sev: "low",
        label: "demo seed"
    },
    fixture: {
        sev: "info",
        label: "reference demo"
    },
    demo_fixture: {
        sev: "critical",
        label: "fabricated"
    }
};
// Visible per-tile provenance shorthand — shown only when tiles MIX live and
// non-live sources (uniform provenance is covered once by the panel tag), except
// "fabricated" which is always marked. A text label, not a hover-only dot: the
// old glyph read as "refreshing/live" and meaning lived in the tooltip.
const PROV_SHORT = {
    derived: "drv",
    seed: "seed",
    fixture: "demo",
    demo_fixture: "FAB"
};
// Colorize-as-signal: tint a metric value ONLY when it breaches a credit
// threshold — never decoration. Directionality differs (leverage worse high;
// coverage / Altman worse low). null = neutral (ink, not colored).
// fallow-ignore-next-line complexity -- Metric direction and severity semantics live in one keyed mapping.
function metricSev(key, v) {
    if (key === "net_leverage") return v >= 6 ? "critical" : v >= 4.5 ? "warning" : null;
    if (key === "interest_coverage") return v < 1.5 ? "critical" : v < 2.5 ? "warning" : null;
    if (key === "altman_z") return v < 1.1 ? "critical" : v < 2.6 ? "warning" : null;
    return null;
}
// Plain-text threshold note for a breached metric — carried on the breach marker
// so the amber/red value tint is never the sole signal (house "never color-alone").
const BREACH_NOTE = {
    net_leverage: "elevated leverage: ≥4.5× warning · ≥6.0× critical",
    interest_coverage: "thin coverage: <2.5× warning · <1.5× critical",
    altman_z: "distress zone: <2.6 warning · <1.1 critical"
};
// The least-trustworthy provenance among the shown metrics, surfaced ONCE as a
// panel-level legend (distill) instead of repeating the word on every tile.
function worstProvenance(ms) {
    for (const p of [
        "demo_fixture",
        "fixture",
        "seed",
        "derived"
    ])if (ms.some((m)=>m.provenance === p)) return p;
    return null;
}
function Splash({ msg }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "h-screen flex items-center justify-center bg-caos-bg",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
            kind: "loading",
            title: msg,
            className: "max-w-md"
        }, void 0, false, {
            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
            lineNumber: 304,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 303,
        columnNumber: 5
    }, this);
}
_c5 = Splash;
// Period-over-period delta for a headline tile: the CP-1B signal field when the
// metric carries one, else the series' latest-point delta. Same derivation the
// old Credit-snapshot panel used — moved out so the KPI strip can reuse it.
function headlineDelta(m, signals, series) {
    const d = TILE_DELTA[m.metric_key];
    const signalDelta = d?.key ? signals[d.key] : null;
    const seriesDelta = d && !d.key ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$issuer$2d$profile$2d$charts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["latestPointDelta"])(series[m.metric_key]) : null;
    const dv = typeof signalDelta === "number" ? signalDelta : seriesDelta;
    return typeof dv === "number" ? dv : null;
}
// One KPI-strip tile — the exact tile the "Credit snapshot" panel rendered
// (breach tint gated to live runs, provenance shorthand, ▸ src link), lifted into
// a standalone tile so Row 1 is a 6-across strip rather than a boxed grid.
// fallow-ignore-next-line complexity -- KPI value, delta, provenance, and navigation form one atomic tile.
function KpiTile({ m, delta, deepHref, provMixed, anyPriorDelta }) {
    const isLive = m.provenance === "run";
    // Breach tint fires only for a live run — a seed/derived value must not paint the
    // page's loudest colour on a number the system won't stand behind.
    const sev = isLive ? metricSev(m.metric_key, m.value) : null;
    const d = TILE_DELTA[m.metric_key];
    const deltaSev = d && delta != null ? delta >= 0 === d.higherIsBetter ? "pass" : "high" : null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rounded border border-caos-border bg-caos-panel px-3 py-2",
        title: METRIC_TOOLTIP[m.metric_key],
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                children: METRIC_LABEL[m.metric_key]
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 341,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-baseline gap-2 mt-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular font-semibold leading-none inline-flex items-center gap-1",
                        style: {
                            fontSize: 18,
                            color: sev ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sevSurface"])(sev).color : isLive ? "var(--caos-text)" : "var(--caos-muted)"
                        },
                        children: [
                            sev ? // role="img" so the threshold note is an accessible name AT announces —
                            // the breach severity must not be color-alone for SR users.
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                role: "img",
                                style: {
                                    color: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sevSurface"])(sev).color
                                },
                                title: BREACH_NOTE[m.metric_key],
                                "aria-label": `${sev === "critical" ? "Critical" : "Warning"} — ${BREACH_NOTE[m.metric_key]}`,
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                                    kind: "warning",
                                    size: 11
                                }, void 0, false, {
                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                    lineNumber: 351,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 350,
                                columnNumber: 13
                            }, this) : null,
                            fmt(m.value, m.unit)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 343,
                        columnNumber: 9
                    }, this),
                    d && delta != null && deltaSev ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs font-medium",
                        style: {
                            color: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sevSurface"])(deltaSev).color
                        },
                        children: signed(delta, d.suffix, d.digits)
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 356,
                        columnNumber: 43
                    }, this) : null,
                    d?.showMissing && delta == null && anyPriorDelta ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs text-caos-muted",
                        children: "no prior"
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 357,
                        columnNumber: 61
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 342,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-1.5 mt-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs text-caos-muted truncate",
                        children: m.period
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 360,
                        columnNumber: 9
                    }, this),
                    m.provenance !== "run" && (provMixed || m.provenance === "demo_fixture") ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs uppercase",
                        style: {
                            color: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sevSurface"])(PROV[m.provenance]?.sev || "low").color
                        },
                        title: PROV[m.provenance]?.label,
                        children: PROV_SHORT[m.provenance] || "n/l"
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 362,
                        columnNumber: 11
                    }, this) : null,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex-1"
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 370,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$SourceRef$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SourceRef"], {
                        source: m.document_chunk_id ? {
                            state: "ready",
                            id: m.document_chunk_id,
                            href: deepHref + "&mod=CP-1"
                        } : {
                            state: "unavailable",
                            reason: "No persisted document chunk for this metric."
                        },
                        className: "no-underline",
                        children: m.document_chunk_id ? `▸ src ${m.document_chunk_id}` : undefined
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 371,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 359,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 340,
        columnNumber: 5
    }, this);
}
_c6 = KpiTile;
// An HONEST one-line desk read composed only from the real earnings deltas —
// direction stated factually (revenue/EBITDA up or down, margin +/−pp), never an
// opinion or a rating. No delta on the latest run → a neutral pointer to the trend
// cards; never ran → say so. This does NOT fabricate a stance.
// fallow-ignore-next-line complexity -- Deterministic desk-read wording must cover every earnings and run state.
function deskReadLine(earnings, hasRun) {
    const rev = earnings.revenue_growth_pct;
    const eb = earnings.ebitda_growth_pct;
    const mg = earnings.margin_change_pp;
    const dir = (v)=>v > 0 ? "up" : v < 0 ? "down" : "flat";
    const parts = [];
    if (typeof rev === "number") parts.push(`revenue ${dir(rev)} ${signed(rev, "%")}`);
    if (typeof eb === "number") parts.push(`adj. EBITDA ${dir(eb)} ${signed(eb, "%")}`);
    if (typeof mg === "number") parts.push(`margin ${signed(mg, "pp")}`);
    const period = earnings.prior_period && earnings.latest_period ? `${earnings.prior_period} → ${earnings.latest_period}: ` : earnings.latest_period ? `${earnings.latest_period}: ` : "";
    if (parts.length) {
        const body = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
        const sig = (earnings.monitoring_signals || []).filter((s)=>typeof s === "string" && s.trim()).length;
        const tail = sig ? ` ${sig} monitoring signal${sig === 1 ? "" : "s"} flagged — see Watch.` : "";
        return `${period}${body.charAt(0).toUpperCase() + body.slice(1)}.${tail}`;
    }
    return hasRun ? "Latest run surfaced no period-over-period earnings delta — read trajectory off the trend cards above." : "No completed run yet — run an analysis to populate the desk read.";
}
// fallow-ignore-next-line complexity -- Profile fetch, loading, error, and route state share one view boundary.
function IssuerProfileView() {
    _s1();
    const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"])().get("id");
    const [data, setData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "IssuerProfileView.useEffect": ()=>{
            if (!id) {
                setError("This profile link is missing its issuer — open a name from the Directory.");
                setLoading(false);
                return;
            }
            let stale = false;
            setLoading(true);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getIssuerProfile"])(id).then({
                "IssuerProfileView.useEffect": (d)=>{
                    if (!stale) {
                        setData(d);
                        setError(null);
                    }
                }
            }["IssuerProfileView.useEffect"])// fallow-ignore-next-line complexity -- Error normalization distinguishes stale, missing, and failed profile requests.
            .catch({
                "IssuerProfileView.useEffect": (e)=>{
                    if (stale) return;
                    const detail = e?.response;
                    setError(detail?.status === 404 ? "Issuer not found." : detail?.data?.detail || "Couldn’t load this profile.");
                }
            }["IssuerProfileView.useEffect"]).finally({
                "IssuerProfileView.useEffect": ()=>{
                    if (!stale) setLoading(false);
                }
            }["IssuerProfileView.useEffect"]);
            return ({
                "IssuerProfileView.useEffect": ()=>{
                    stale = true;
                }
            })["IssuerProfileView.useEffect"];
        }
    }["IssuerProfileView.useEffect"], [
        id
    ]);
    if (loading) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Splash, {
        msg: "Loading profile…"
    }, void 0, false, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 436,
        columnNumber: 23
    }, this);
    if (error || !data) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ErrorView, {
        id: id,
        msg: error || "No data."
    }, void 0, false, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 437,
        columnNumber: 30
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Profile, {
        id: id,
        data: data
    }, void 0, false, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 439,
        columnNumber: 10
    }, this);
}
_s1(IssuerProfileView, "yEZj9xpEDUY5WSRU0Xl4j1pf3ZY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"]
    ];
});
_c7 = IssuerProfileView;
function ErrorView({ id, msg }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "h-screen flex items-center justify-center bg-caos-bg",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
            kind: "error",
            title: msg,
            className: "max-w-md text-center",
            primaryAction: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                href: "/issuers",
                className: "no-underline tabular text-caos-md px-3 py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring",
                children: "← BACK TO DIRECTORY"
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 450,
                columnNumber: 11
            }, this),
            secondaryAction: id ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                href: "/deepdive?issuer=" + encodeURIComponent(id),
                className: "no-underline tabular text-caos-md px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring",
                children: "OPEN DEEP-DIVE"
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 456,
                columnNumber: 13
            }, this) : undefined
        }, void 0, false, {
            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
            lineNumber: 445,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 444,
        columnNumber: 5
    }, this);
}
_c8 = ErrorView;
function Profile({ id, data, isOverlay = false, onClose }) {
    _s2();
    const { issuer, latest_run, signal_run_id, runs, metrics, signals, coverage, findings, business, sponsor, strengths, weaknesses } = data;
    const analysis = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAnalysisContext"])({
        name: `${issuer.name} issuer profile`
    });
    const activeFreshnessArtifact = analysis.context?.artifacts.model_checkpoint_id ?? analysis.context?.artifacts.report_version_id;
    const freshnessRead = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useFreshness$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIssuerFreshness"])({
        issuerId: id,
        contextId: analysis.context?.id,
        runId: latest_run?.id,
        artifactRevision: `${analysis.context?.updated_at ?? ""}:${activeFreshnessArtifact ?? ""}`
    });
    const profileFreshness = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useFreshness$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["derivedFreshness"])(freshnessRead, activeFreshnessArtifact);
    const { values: profileUrl, update: updateProfileUrl } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$typed$2d$url$2d$state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTypedUrlState"])(PROFILE_URL_KEYS);
    const activeTab = PROFILE_TABS.some((tab)=>tab.id === profileUrl.tab) ? profileUrl.tab : "snapshot";
    const earnings = data.earnings ?? EMPTY_EARNINGS; // trust boundary — old/odd payloads may omit it
    const deepHref = analysis.context ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["contextHref"])("/deepdive", analysis.context.id, {
        issuer: id
    }) : "/deepdive?issuer=" + encodeURIComponent(id);
    // A Blocked run must not flash a committee-green stance: the recommendation
    // chip is rendered gated (idle sev + explicit label) so a screenshot can never
    // show the overweight without the block.
    const recGated = latest_run?.committee_status === "Blocked";
    const ratings = [
        {
            ag: "S&P",
            short: "S&P",
            v: issuer.rating_sp
        },
        {
            ag: "Moody’s",
            short: "Mdy",
            v: issuer.rating_moody
        },
        {
            ag: "Fitch",
            short: "Fitch",
            v: issuer.rating_fitch
        }
    ].filter((r)=>r.v);
    const factsByCode = (codes)=>business.filter((f)=>codes.includes(f.code));
    const sponsorLedger = Array.isArray(sponsor.ledger) ? sponsor.ledger : [];
    const [gran, setGran] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("FY");
    // Snapshot + trend series come straight from the engine's metric facts. We do
    // NOT synthesize senior/total leverage from net leverage — a fabricated figure
    // would inherit net_leverage's "live run" provenance and ▸ src link, i.e. a
    // made-up number that reads as sourced. Only keys the engine actually emits
    // render; missing ones degrade to an empty state.
    const series = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Profile.useMemo[series]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$issuer$2d$profile$2d$charts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["buildSeries"])(metrics)
    }["Profile.useMemo[series]"], [
        metrics
    ]);
    const headline = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Profile.useMemo[headline]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$issuer$2d$profile$2d$charts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["buildHeadline"])(metrics)
    }["Profile.useMemo[headline]"], [
        metrics
    ]);
    const retainedHeadline = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Profile.useMemo[retainedHeadline]": ()=>Boolean(signal_run_id && headline.some({
                "Profile.useMemo[retainedHeadline]": (m)=>m.run_id && m.run_id !== signal_run_id
            }["Profile.useMemo[retainedHeadline]"]))
    }["Profile.useMemo[retainedHeadline]"], [
        headline,
        signal_run_id
    ]);
    const snapshotAsOf = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Profile.useMemo[snapshotAsOf]": ()=>{
            if (!retainedHeadline) return latest_run?.as_of_date ?? null;
            const dates = [
                ...new Set(headline.map({
                    "Profile.useMemo[snapshotAsOf]": (m)=>m.source_run_as_of
                }["Profile.useMemo[snapshotAsOf]"]).filter(Boolean))
            ];
            return dates.length === 1 ? dates[0] : null;
        }
    }["Profile.useMemo[snapshotAsOf]"], [
        headline,
        latest_run?.as_of_date,
        retainedHeadline
    ]);
    // Build both granularities so the toggle shows only when there's something to
    // switch to, and each side draws only its own periods (annual vs quarterly).
    const fyCharts = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Profile.useMemo[fyCharts]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$issuer$2d$profile$2d$charts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["buildCharts"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$issuer$2d$profile$2d$charts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["filterSeriesByGranularity"])(series, "FY"))
    }["Profile.useMemo[fyCharts]"], [
        series
    ]);
    const qCharts = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Profile.useMemo[qCharts]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$issuer$2d$profile$2d$charts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["buildCharts"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$issuer$2d$profile$2d$charts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["filterSeriesByGranularity"])(series, "Q"))
    }["Profile.useMemo[qCharts]"], [
        series
    ]);
    // Fall through to whichever granularity has data — the toggle only renders
    // when both do, so a one-sided dataset can't strand the user on an empty tab.
    const trendGran = fyCharts.length === 0 ? "Q" : qCharts.length === 0 ? "FY" : gran;
    const trendSeries = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Profile.useMemo[trendSeries]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$issuer$2d$profile$2d$charts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["filterSeriesByGranularity"])(series, trendGran)
    }["Profile.useMemo[trendSeries]"], [
        series,
        trendGran
    ]);
    const trendPoints = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Profile.useMemo[trendPoints]": ()=>{
            const out = {};
            for (const k of TREND_ORDER){
                const g = (trendSeries[k] ?? []).filter({
                    "Profile.useMemo[trendPoints].g": (p)=>Number.isFinite(p.value)
                }["Profile.useMemo[trendPoints].g"]);
                const full = (series[k] ?? []).filter({
                    "Profile.useMemo[trendPoints].full": (p)=>Number.isFinite(p.value)
                }["Profile.useMemo[trendPoints].full"]);
                out[k] = (g.length >= 2 ? g : full).map({
                    "Profile.useMemo[trendPoints]": (p)=>({
                            period: p.period,
                            value: p.value
                        })
                }["Profile.useMemo[trendPoints]"]);
            }
            return out;
        }
    }["Profile.useMemo[trendPoints]"], [
        series,
        trendSeries
    ]);
    const snapshotProv = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Profile.useMemo[snapshotProv]": ()=>worstProvenance(headline)
    }["Profile.useMemo[snapshotProv]"], [
        headline
    ]);
    const provMixed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Profile.useMemo[provMixed]": ()=>headline.some({
                "Profile.useMemo[provMixed]": (m)=>m.provenance === "run"
            }["Profile.useMemo[provMixed]"]) && headline.some({
                "Profile.useMemo[provMixed]": (m)=>m.provenance !== "run"
            }["Profile.useMemo[provMixed]"])
    }["Profile.useMemo[provMixed]"], [
        headline
    ]);
    // "no prior" is only meaningful when SOME tile actually has a prior-period delta
    // to contrast against; on a fresh single-period snapshot (no tile has a prior)
    // the annotation wrongly implied the unlabeled tiles did have deltas.
    const anyPriorDelta = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Profile.useMemo[anyPriorDelta]": ()=>headline.some({
                "Profile.useMemo[anyPriorDelta]": (m)=>{
                    const dd = TILE_DELTA[m.metric_key];
                    if (!dd) return false;
                    const sd = dd.key ? signals[dd.key] : (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$issuer$2d$profile$2d$charts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["latestPointDelta"])(series[m.metric_key]);
                    return typeof sd === "number";
                }
            }["Profile.useMemo[anyPriorDelta]"])
    }["Profile.useMemo[anyPriorDelta]"], [
        headline,
        signals,
        series
    ]);
    // Per-issuer tab identity — 40 open profiles are otherwise all "CAOS". Skipped
    // in overlay mode (the host page owns the title). Restored on unmount.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Profile.useEffect": ()=>{
            if (isOverlay) return;
            const prev = document.title;
            const who = issuer.ticker?.toUpperCase() || issuer.name || "Issuer";
            document.title = `${who} · Issuer Profile · CAOS`;
            return ({
                "Profile.useEffect": ()=>{
                    document.title = prev;
                }
            })["Profile.useEffect"];
        }
    }["Profile.useEffect"], [
        isOverlay,
        issuer.ticker,
        issuer.name
    ]);
    // Depend on the stable context object + patch fn, NEVER the whole `analysis`
    // hook value: its identity changes on every mutationState flip, so a single
    // failed PATCH (429 under the 45-writes/min budget) re-armed this effect and
    // produced an unthrottled retry storm that kept the analyst rate-limited
    // forever. With these deps, a failure changes nothing the effect reads —
    // recovery is the explicit "Retry context save" affordance, not a loop.
    const syncPatch = analysis.patch;
    const syncContext = analysis.context;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Profile.useEffect": ()=>{
            const context = syncContext;
            if (!context) return;
            const issuerIds = context.issuer_ids.includes(id) ? context.issuer_ids : [
                ...context.issuer_ids,
                id
            ];
            const runId = latest_run?.id ?? context.artifacts.issuer_run_id;
            const current = context.surface_state["issuer-profile"];
            if (issuerIds === context.issuer_ids && runId === context.artifacts.issuer_run_id && current?.active_id === id && current?.view === activeTab) return;
            void syncPatch({
                issuer_ids: issuerIds,
                artifacts: {
                    ...context.artifacts,
                    issuer_run_id: runId
                },
                surface_state: {
                    ...context.surface_state,
                    "issuer-profile": {
                        ...current ?? {},
                        active_id: id,
                        selected_ids: runId ? [
                            runId
                        ] : [],
                        view: activeTab
                    }
                }
            }).catch({
                "Profile.useEffect": ()=>{}
            }["Profile.useEffect"]);
        }
    }["Profile.useEffect"], [
        activeTab,
        syncContext,
        syncPatch,
        id,
        latest_run?.id
    ]);
    const totalFindings = (findings.CRITICAL || 0) + (findings.MATERIAL || 0) + (findings.MINOR || 0);
    // Honest one-line desk read, composed from the REAL earnings deltas — direction
    // stated factually (up/down, margin +/−), never an opinion. No earnings delta →
    // a neutral placeholder that points at the trend cards, not a fabricated stance.
    const deskRead = deskReadLine(earnings, !!latest_run);
    // Watch callout is surfaced only when the latest run actually raised deterioration
    // signals — a callout with warning chrome must never fire on a clean read.
    const watchSignals = (earnings.monitoring_signals || []).filter((s)=>typeof s === "string" && !!s.trim());
    // Decision header — every field reuses a value already computed above
    // for the header chips / body panels (no new compute, no LLM). Missing
    // data renders "— no data" via DecisionHeader itself, never a synthesized
    // stance. Replaces the old PM-only PmStrip: the shared header is role-aware
    // (collapsed for Analyst, open for PM/QA) rather than role-gated, so QA
    // gets the same ten-second answer PM did.
    const pmPosture = latest_run ? {
        label: String(latest_run.committee_status) + (signals.recommendation ? ` · ${signals.recommendation}${recGated ? " (gated)" : ""}` : ""),
        sev: recGated ? "low" : COMMITTEE_SEV[latest_run.committee_status] ?? "low"
    } : null;
    const pmRisk = watchSignals[0] || weaknesses[0] || "no risk flagged";
    const pmEvidence = latest_run ? {
        label: totalFindings ? `${findings.CRITICAL || 0} crit · ${findings.MATERIAL || 0} mat` : "clean",
        sev: findings.CRITICAL ? "critical" : findings.MATERIAL ? "warning" : "ok"
    } : {
        label: "no run",
        sev: "low"
    };
    const pmAction = {
        label: recGated ? "Clear CP-5 gate" : "Review thesis",
        href: deepHref
    };
    const EVIDENCE_SEV_COLOR = {
        critical: "var(--caos-critical)",
        warning: "var(--caos-warning)",
        ok: "var(--caos-success)",
        low: "var(--caos-muted)"
    };
    // A completed run is authority even when it has no as_of_date (older rows
    // predating the backfill, or a genuinely undated source) — branch on the
    // run's presence, not on the timestamp. Collapsing to "no completed run"
    // whenever as_of_date was null used to contradict the header's own
    // RESTRICTED/UNDERWEIGHT chips, which read `latest_run` directly.
    const hasCompletedRun = !!latest_run;
    const profileAsOf = latest_run?.as_of_date ?? (hasCompletedRun ? "timestamp unavailable" : null);
    const profileAuthority = hasCompletedRun ? {
        provenance: {
            origin: "LIVE",
            method: "DERIVED",
            freshness: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$freshness$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toProvFreshness"])(profileFreshness),
            detail: profileFreshness ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$freshness$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["freshnessDetail"])(profileFreshness) : "Central freshness evaluation unavailable for the issuer read-model.",
            asOf: profileAsOf
        },
        approval: latest_run?.committee_status === "Approved" ? "RATIFIED" : "UNRATIFIED"
    } : undefined;
    const profileUnavailable = {
        kind: "unavailable",
        message: "No completed run available"
    };
    const profileDecision = hasCompletedRun ? (()=>{
        const asOf = profileAsOf;
        return {
            whatChanged: {
                kind: "ready",
                value: deskRead,
                asOf,
                authority: profileAuthority
            },
            whyItMatters: {
                kind: "ready",
                value: `${pmPosture.label} · ${pmRisk}`,
                asOf,
                authority: profileAuthority
            },
            requiredAction: {
                kind: "ready",
                value: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    href: pmAction.href,
                    className: "text-caos-accent hover:text-caos-text transition-caos focus-ring rounded outline-none",
                    children: [
                        pmAction.label,
                        " →"
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                    lineNumber: 654,
                    columnNumber: 51
                }, this),
                asOf,
                authority: profileAuthority
            },
            evidenceHealth: {
                kind: profileFreshness?.state === "stale" ? "stale" : profileFreshness?.state === "current" && !totalFindings ? "ready" : "partial",
                value: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "inline-flex items-center gap-2",
                    style: {
                        color: EVIDENCE_SEV_COLOR[pmEvidence.sev]
                    },
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$FreshnessIndicator$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FreshnessIndicator"], {
                            evaluation: profileFreshness
                        }, void 0, false, {
                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                            lineNumber: 657,
                            columnNumber: 123
                        }, this),
                        pmEvidence.label
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                    lineNumber: 657,
                    columnNumber: 20
                }, this),
                missingSources: [
                    ...totalFindings ? [
                        `${totalFindings} QA finding${totalFindings === 1 ? "" : "s"}`
                    ] : [],
                    ...!profileFreshness || profileFreshness.state === "unknown" ? [
                        "central freshness evaluation"
                    ] : []
                ],
                asOf,
                authority: profileAuthority
            }
        };
    })() : {
        whatChanged: profileUnavailable,
        whyItMatters: profileUnavailable,
        requiredAction: profileUnavailable,
        evidenceHealth: profileUnavailable
    };
    const evidenceAtlas = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
        title: "Evidence Atlas",
        right: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "tabular text-caos-2xs text-caos-muted uppercase tracking-wider",
            children: "Latest run"
        }, void 0, false, {
            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
            lineNumber: 667,
            columnNumber: 42
        }, this),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                className: "grid gap-1 p-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between gap-3 border-b border-caos-border/40 py-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                className: "text-caos-xs text-caos-muted",
                                children: "Authority"
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 669,
                                columnNumber: 102
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                className: "tabular text-caos-xs text-caos-text",
                                children: profileAuthority ? `${profileAuthority.provenance.origin} · ${profileAuthority.approval}` : "Unavailable — no completed run"
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 669,
                                columnNumber: 161
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 669,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between gap-3 border-b border-caos-border/40 py-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                className: "text-caos-xs text-caos-muted",
                                children: "Freshness"
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 670,
                                columnNumber: 102
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$FreshnessIndicator$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FreshnessIndicator"], {
                                    evaluation: profileFreshness
                                }, void 0, false, {
                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                    lineNumber: 670,
                                    columnNumber: 165
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 670,
                                columnNumber: 161
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 670,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between gap-3 border-b border-caos-border/40 py-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                className: "text-caos-xs text-caos-muted",
                                children: "Source readiness"
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 671,
                                columnNumber: 102
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                className: "tabular text-caos-xs text-caos-text",
                                children: coverage.readiness_score != null ? `${Math.round(Number(coverage.readiness_score) * 100)}%` : "Unavailable"
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 671,
                                columnNumber: 168
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 671,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between gap-3 border-b border-caos-border/40 py-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                className: "text-caos-xs text-caos-muted",
                                children: "Documents"
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 672,
                                columnNumber: 102
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                className: "tabular text-caos-xs text-caos-text",
                                children: Number(coverage.documents) || 0
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 672,
                                columnNumber: 161
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 672,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between gap-3 border-b border-caos-border/40 py-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                className: "text-caos-xs text-caos-muted",
                                children: "Open findings"
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 673,
                                columnNumber: 102
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                className: "tabular text-caos-xs text-caos-text",
                                children: totalFindings
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 673,
                                columnNumber: 165
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 673,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 668,
                columnNumber: 7
            }, this),
            Array.isArray(coverage.categories_missing) && coverage.categories_missing.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-3 pb-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        className: "tabular text-caos-2xs uppercase tracking-wider text-caos-warning",
                        children: "Missing categories"
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 675,
                        columnNumber: 118
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        className: "mt-1 grid gap-1",
                        children: coverage.categories_missing.map((category)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                className: "text-caos-xs text-caos-muted",
                                children: [
                                    "△ ",
                                    category
                                ]
                            }, category, true, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 675,
                                columnNumber: 315
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 675,
                        columnNumber: 222
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 675,
                columnNumber: 91
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                href: deepHref,
                className: "caos-action-secondary focus-ring inline-flex m-3 mt-0 no-underline",
                children: "Open evidence in Deep-Dive"
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 676,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 667,
        columnNumber: 5
    }, this);
    const body = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col gap-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                role: "tablist",
                "aria-label": "Issuer profile sections",
                className: "flex items-center gap-1 overflow-x-auto border-b border-caos-border pb-2",
                onKeyDown: (event)=>{
                    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                    event.preventDefault();
                    const tabs = Array.from(event.currentTarget.querySelectorAll('[role="tab"]'));
                    const index = tabs.indexOf(document.activeElement);
                    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
                    tabs[next]?.focus();
                    tabs[next]?.click();
                },
                children: PROFILE_TABS.map((tab)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        id: `profile-tab-${tab.id}`,
                        type: "button",
                        role: "tab",
                        "aria-selected": activeTab === tab.id,
                        "aria-controls": `profile-panel-${tab.id}`,
                        tabIndex: activeTab === tab.id ? 0 : -1,
                        onClick: ()=>updateProfileUrl({
                                tab: tab.id === "snapshot" ? null : tab.id
                            }),
                        className: "caos-action-secondary focus-ring whitespace-nowrap",
                        children: tab.label
                    }, tab.id, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 691,
                        columnNumber: 38
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 682,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$PersonaWorkbench$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PersonaWorkbench"], {
                surface: "issuer-profile",
                decision: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$DecisionHeader$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DecisionHeader"], {
                    state: profileDecision
                }, void 0, false, {
                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                    lineNumber: 695,
                    columnNumber: 21
                }, this),
                inspector: activeTab === "evidence" ? null : evidenceAtlas,
                primary: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid gap-3",
                    role: "tabpanel",
                    id: `profile-panel-${activeTab}`,
                    "aria-labelledby": `profile-tab-${activeTab}`,
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            hidden: activeTab !== "snapshot",
                            className: "grid gap-3",
                            children: headline.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
                                title: "Credit snapshot" + (snapshotAsOf ? " · as of " + snapshotAsOf : ""),
                                right: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "tabular text-caos-2xs text-caos-muted uppercase tracking-wider",
                                    children: "Derived"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                    lineNumber: 702,
                                    columnNumber: 102
                                }, this),
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "px-3 py-2.5 flex flex-col gap-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-caos-sm text-caos-text/90 leading-relaxed m-0",
                                            children: deskRead
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                            lineNumber: 704,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Empty, {
                                            children: "No headline metrics yet — run an analysis to populate the snapshot."
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                            lineNumber: 705,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                    lineNumber: 703,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 702,
                                columnNumber: 11
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-col gap-2.5 pb-0.5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-baseline gap-2 px-0.5",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                className: "text-caos-md font-semibold tracking-[0.12em] uppercase text-caos-muted m-0",
                                                children: [
                                                    "Credit snapshot",
                                                    snapshotAsOf ? " · as of " + snapshotAsOf : ""
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 714,
                                                columnNumber: 15
                                            }, this),
                                            retainedHeadline ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tag"], {
                                                sev: "warning",
                                                children: "Last QA-passed"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 717,
                                                columnNumber: 35
                                            }, this) : null,
                                            snapshotProv ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tag"], {
                                                sev: PROV[snapshotProv].sev,
                                                children: PROV[snapshotProv].label
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 718,
                                                columnNumber: 31
                                            }, this) : null,
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex-1"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 719,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "tabular text-caos-2xs text-caos-muted uppercase tracking-wider shrink-0",
                                                children: "Derived"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 720,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                        lineNumber: 710,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-caos-sm text-caos-text/90 leading-relaxed m-0 px-0.5",
                                        children: deskRead
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                        lineNumber: 725,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5",
                                        children: headline.map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(KpiTile, {
                                                m: m,
                                                delta: headlineDelta(m, signals, series),
                                                deepHref: deepHref,
                                                provMixed: provMixed,
                                                anyPriorDelta: anyPriorDelta
                                            }, m.metric_key, false, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 728,
                                                columnNumber: 17
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                        lineNumber: 726,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 709,
                                columnNumber: 11
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                            lineNumber: 698,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            hidden: activeTab !== "financials",
                            className: "grid gap-3",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid grid-cols-1 lg:grid-cols-[1.65fr_minmax(300px,1fr)] gap-3 items-start",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
                                        title: "Financial & credit trend",
                                        right: fyCharts.length && qCharts.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ToggleGroup"], {
                                            options: GRAN_OPTS,
                                            value: gran,
                                            onChange: setGran,
                                            size: "sm"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                            lineNumber: 748,
                                            columnNumber: 17
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "tabular text-caos-2xs text-caos-muted",
                                            children: [
                                                TREND_ORDER.filter((k)=>trendPoints[k].length >= 2).length,
                                                " of ",
                                                TREND_ORDER.length,
                                                " series"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                            lineNumber: 749,
                                            columnNumber: 17
                                        }, this),
                                        children: TREND_ORDER.every((k)=>trendPoints[k].length === 0) ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "px-3 py-2.5",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Empty, {
                                                children: "Time series needs ≥2 periods to populate trends."
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 753,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                            lineNumber: 752,
                                            columnNumber: 15
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 p-2",
                                            children: [
                                                TREND_ORDER.map((k)=>{
                                                    const f = TREND_FMT[k];
                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TrendCard, {
                                                        title: f.title,
                                                        pts: trendPoints[k],
                                                        color: f.color,
                                                        unit: f.unit
                                                    }, k, false, {
                                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                        lineNumber: 759,
                                                        columnNumber: 26
                                                    }, this);
                                                }),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "rounded border border-caos-border bg-caos-bg px-3 py-2 flex flex-col",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex items-baseline justify-between gap-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                                                                    children: "3Y DM (bp)"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                                    lineNumber: 763,
                                                                    columnNumber: 21
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border",
                                                                    style: {
                                                                        color: "var(--caos-warning)",
                                                                        borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)"
                                                                    },
                                                                    children: "Feed pending"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                                    lineNumber: 764,
                                                                    columnNumber: 21
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                            lineNumber: 762,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "tabular text-caos-2xs text-caos-muted py-2.5",
                                                            children: "See Market · price & DM below."
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                            lineNumber: 767,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                    lineNumber: 761,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                            lineNumber: 756,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                        lineNumber: 745,
                                        columnNumber: 11
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-col gap-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$profile$2f$AnalystViewPanel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AnalystViewPanel"], {
                                                issuerId: id,
                                                systemStance: typeof signals.recommendation === "string" ? signals.recommendation : null,
                                                sourceRunId: latest_run?.id,
                                                contextId: analysis.context?.id
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 774,
                                                columnNumber: 13
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$profile$2f$ThesisTimeline$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ThesisTimeline"], {
                                                issuerId: id,
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex flex-col gap-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SigBand, {
                                                            label: "Relative value",
                                                            v: signals.recommendation,
                                                            gated: recGated,
                                                            extra: signals.composite_percentile != null ? `${signals.composite_percentile}th pct` : undefined
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                            lineNumber: 782,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SigBand, {
                                                            label: "Downside fragility",
                                                            v: signals.fragility,
                                                            extra: signals.shock_to_breach_pct != null ? `breach @ −${signals.shock_to_breach_pct}% EBITDA` : undefined
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                            lineNumber: 783,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SigBand, {
                                                            label: "Refi / LME risk",
                                                            v: signals.lme_band,
                                                            extra: signals.lme_score != null ? `score ${signals.lme_score}` : undefined
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                            lineNumber: 785,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(EmptyIfBlank, {
                                                            ok: [
                                                                signals.recommendation,
                                                                signals.fragility,
                                                                signals.lme_band
                                                            ],
                                                            latest: !!latest_run
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                            lineNumber: 788,
                                                            columnNumber: 17
                                                        }, this),
                                                        strengths.length || weaknesses.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "pt-1.5 mt-0.5 border-t border-caos-border/40 flex flex-col divide-y divide-caos-border/40",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SWCol, {
                                                                    kind: "success",
                                                                    title: "Strengths",
                                                                    items: strengths.slice(0, 3)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                                    lineNumber: 791,
                                                                    columnNumber: 21
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SWCol, {
                                                                    kind: "warning",
                                                                    title: "Weaknesses",
                                                                    items: weaknesses.slice(0, 3)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                                    lineNumber: 792,
                                                                    columnNumber: 21
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                            lineNumber: 790,
                                                            columnNumber: 19
                                                        }, this) : null
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                    lineNumber: 781,
                                                    columnNumber: 15
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 780,
                                                columnNumber: 13
                                            }, this),
                                            watchSignals.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "rounded border p-3",
                                                style: {
                                                    borderColor: "color-mix(in srgb, var(--caos-warning) 42%, transparent)",
                                                    background: "color-mix(in srgb, var(--caos-warning) 7%, transparent)"
                                                },
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "tabular text-caos-2xs uppercase tracking-wider font-semibold mb-1.5",
                                                        style: {
                                                            color: "var(--caos-warning)"
                                                        },
                                                        children: "Watch"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                        lineNumber: 800,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex flex-col gap-1.5",
                                                        children: watchSignals.slice(0, 3).map((s, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "flex items-start gap-1.5 tabular text-caos-xs leading-snug text-caos-text/90",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "mt-0.5 shrink-0",
                                                                        style: {
                                                                            color: "var(--caos-warning)"
                                                                        },
                                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                                                                            kind: "warning",
                                                                            size: 9
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                                            lineNumber: 804,
                                                                            columnNumber: 98
                                                                        }, this)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                                        lineNumber: 804,
                                                                        columnNumber: 23
                                                                    }, this),
                                                                    s
                                                                ]
                                                            }, i, true, {
                                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                                lineNumber: 803,
                                                                columnNumber: 21
                                                            }, this))
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                        lineNumber: 801,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 799,
                                                columnNumber: 15
                                            }, this) : null
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                        lineNumber: 773,
                                        columnNumber: 11
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 744,
                                columnNumber: 9
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                            lineNumber: 742,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            hidden: activeTab !== "structure",
                            className: "grid gap-3",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-3 items-start",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
                                        title: "Business profile",
                                        children: business.length === 0 && sponsorLedger.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "px-3 py-2.5",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Empty, {
                                                children: "No business disclosure ingested."
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 819,
                                                columnNumber: 44
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                            lineNumber: 819,
                                            columnNumber: 15
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-col divide-y divide-caos-border/40",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(BizCol, {
                                                    title: "Description",
                                                    facts: factsByCode([
                                                        "transaction",
                                                        "history",
                                                        "geography"
                                                    ]).slice(0, 2),
                                                    deepHref: deepHref
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                    lineNumber: 822,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(BizCol, {
                                                    title: "Operating model",
                                                    facts: factsByCode([
                                                        "operating_model"
                                                    ]).slice(0, 1),
                                                    deepHref: deepHref
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                    lineNumber: 823,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(OwnershipCol, {
                                                    facts: factsByCode([
                                                        "ownership"
                                                    ]).slice(0, 1),
                                                    ledger: sponsorLedger,
                                                    score: sponsor.governance_risk_score,
                                                    deepHref: deepHref
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                    lineNumber: 824,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                            lineNumber: 821,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                        lineNumber: 817,
                                        columnNumber: 11
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-col gap-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
                                                title: "Structure & coverage",
                                                right: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "tabular text-caos-2xs text-caos-muted uppercase tracking-wider",
                                                    children: "CP-5"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                    lineNumber: 830,
                                                    columnNumber: 56
                                                }, this),
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "px-3 py-2 flex flex-col gap-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SigText, {
                                                            label: "Covenant headroom",
                                                            v: signals.covenant_headroom_turns != null ? `${Number(signals.covenant_headroom_turns).toFixed(1)}× to breach` : null
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                            lineNumber: 832,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SigText, {
                                                            label: "Covenant structure",
                                                            v: signals.covenant_structure
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                            lineNumber: 833,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SigText, {
                                                            label: "Liquidity runway",
                                                            v: signals.runway_months != null ? `${signals.runway_months} mo` : null
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                            lineNumber: 834,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SigText, {
                                                            label: "RP / builder basket",
                                                            v: signals.rp_basket_musd != null ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fmtUsdM"])(Number(signals.rp_basket_musd)) + " capacity" : null
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                            lineNumber: 838,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SigText, {
                                                            label: "Cross-default",
                                                            v: signals.cross_default_musd != null ? `trips at ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fmtUsdM"])(Number(signals.cross_default_musd))}` : null
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                            lineNumber: 839,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SigText, {
                                                            label: "Add-back cap",
                                                            v: signals.addback_cap_pct != null ? `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fmtPct"])(Number(signals.addback_cap_pct), 0)} of EBITDA` + (signals.addback_utilization_pct != null ? ` · ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fmtPct"])(Number(signals.addback_utilization_pct) / 100, 0)} used${signals.addback_breach === true ? " · BREACH" : ""}` : "") : null,
                                                            sev: signals.addback_breach === true ? "critical" : signals.addback_utilization_pct != null && Number(signals.addback_utilization_pct) >= 80 ? "warning" : undefined
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                            lineNumber: 840,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(EmptyIfBlank, {
                                                            ok: [
                                                                signals.covenant_headroom_turns,
                                                                signals.covenant_structure,
                                                                signals.runway_months,
                                                                signals.rp_basket_musd,
                                                                signals.cross_default_musd,
                                                                signals.addback_cap_pct
                                                            ],
                                                            latest: !!latest_run
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                            lineNumber: 854,
                                                            columnNumber: 17
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "pt-1.5 mt-0.5 border-t border-caos-border/40 flex flex-col gap-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SigText, {
                                                                    label: "Source readiness",
                                                                    v: coverage.readiness_score != null ? `${Math.round(Number(coverage.readiness_score) * 100)}% · ${Number(coverage.documents) || 0} doc${Number(coverage.documents) === 1 ? "" : "s"}` : null
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                                    lineNumber: 856,
                                                                    columnNumber: 19
                                                                }, this),
                                                                Array.isArray(coverage.categories_missing) && coverage.categories_missing.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SigText, {
                                                                    label: "Source gaps",
                                                                    v: coverage.categories_missing.slice(0, 2).join(", "),
                                                                    sev: "warning"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                                    lineNumber: 858,
                                                                    columnNumber: 21
                                                                }, this) : null,
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SigText, {
                                                                    label: "Open QA findings",
                                                                    v: totalFindings ? `${findings.CRITICAL} crit · ${findings.MATERIAL} mat` : "none",
                                                                    sev: findings.CRITICAL || findings.MATERIAL ? "warning" : undefined
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                                    lineNumber: 860,
                                                                    columnNumber: 19
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                            lineNumber: 855,
                                                            columnNumber: 17
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                    lineNumber: 831,
                                                    columnNumber: 15
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 830,
                                                columnNumber: 13
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CrossDefaultDominoes$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CrossDefaultDominoes"], {
                                                issuerId: id,
                                                hasRun: runs.some((r)=>r.status === "complete")
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 865,
                                                columnNumber: 13
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                        lineNumber: 829,
                                        columnNumber: 11
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 816,
                                columnNumber: 9
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                            lineNumber: 814,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            hidden: activeTab !== "market",
                            className: "grid gap-3",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-3 items-start",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
                                        title: "Market · price & DM",
                                        right: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border",
                                            style: {
                                                color: "var(--caos-warning)",
                                                borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)"
                                            },
                                            children: "Feed pending"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                            lineNumber: 875,
                                            columnNumber: 20
                                        }, this),
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "px-3 py-4 flex flex-col items-center justify-center gap-2 text-center min-h-[120px]",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    style: {
                                                        color: "var(--caos-muted)"
                                                    },
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                                                        kind: "idle",
                                                        size: 16
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                        lineNumber: 878,
                                                        columnNumber: 60
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                    lineNumber: 878,
                                                    columnNumber: 15
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "tabular text-caos-sm text-caos-muted m-0 max-w-[360px] leading-relaxed",
                                                    children: "No loan mark or discount-margin series for this issuer yet — structured market data is a future phase."
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                    lineNumber: 879,
                                                    columnNumber: 15
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                            lineNumber: 877,
                                            columnNumber: 13
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                        lineNumber: 873,
                                        columnNumber: 11
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AnalystNotesPanel, {
                                        issuerId: id,
                                        issuerName: issuer.name,
                                        ticker: issuer.ticker
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                        lineNumber: 885,
                                        columnNumber: 11
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 872,
                                columnNumber: 9
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                            lineNumber: 870,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            hidden: activeTab !== "events",
                            className: "grid gap-3",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid grid-cols-1 lg:grid-cols-2 gap-3 items-start",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
                                        title: "Latest earnings" + (earnings.latest_period ? " · " + earnings.latest_period : ""),
                                        children: (()=>{
                                            const ms = earnings.monitoring_signals || [];
                                            const hasDelta = [
                                                earnings.revenue_growth_pct,
                                                earnings.ebitda_growth_pct,
                                                earnings.margin_change_pp
                                            ].some((v)=>typeof v === "number");
                                            if (!hasDelta && !ms.length) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "px-3 py-2.5",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Empty, {
                                                    children: "No earnings delta yet."
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                    lineNumber: 898,
                                                    columnNumber: 53
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 898,
                                                columnNumber: 24
                                            }, this);
                                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "px-3 py-2 flex flex-col gap-2",
                                                children: [
                                                    earnings.prior_period && earnings.latest_period ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "tabular text-caos-2xs text-caos-muted",
                                                        children: [
                                                            earnings.prior_period,
                                                            " → ",
                                                            earnings.latest_period,
                                                            " · YoY"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                        lineNumber: 902,
                                                        columnNumber: 21
                                                    }, this) : null,
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DeltaRow, {
                                                        label: "Revenue",
                                                        v: earnings.revenue_growth_pct,
                                                        suffix: "%"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                        lineNumber: 904,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DeltaRow, {
                                                        label: "Adj. EBITDA",
                                                        v: earnings.ebitda_growth_pct,
                                                        suffix: "%"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                        lineNumber: 905,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DeltaRow, {
                                                        label: "EBITDA margin",
                                                        v: earnings.margin_change_pp,
                                                        suffix: "pp"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                        lineNumber: 906,
                                                        columnNumber: 19
                                                    }, this),
                                                    ms.length ? null : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "tabular text-caos-2xs pt-1",
                                                        style: {
                                                            color: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sevSurface"])("pass").color
                                                        },
                                                        children: "No deterioration signals."
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                        lineNumber: 908,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 900,
                                                columnNumber: 17
                                            }, this);
                                        })()
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                        lineNumber: 893,
                                        columnNumber: 11
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
                                        title: `Run history · ${runs.length}`,
                                        children: runs.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "px-3 py-2.5",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Empty, {
                                                children: "No runs yet."
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 917,
                                                columnNumber: 44
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                            lineNumber: 917,
                                            columnNumber: 15
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-caos-md divide-y divide-caos-border/30",
                                            children: runs.slice(0, 3).map((r)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RunRow, {
                                                    r: r,
                                                    href: deepHref + "&run=" + encodeURIComponent(r.id)
                                                }, r.id, false, {
                                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                    lineNumber: 921,
                                                    columnNumber: 19
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                            lineNumber: 919,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                        lineNumber: 915,
                                        columnNumber: 11
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 892,
                                columnNumber: 9
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                            lineNumber: 889,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            hidden: activeTab !== "evidence",
                            className: "grid gap-3",
                            children: [
                                evidenceAtlas,
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
                                    title: "QA findings",
                                    right: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "tabular text-caos-2xs text-caos-muted uppercase tracking-wider",
                                        children: "CP-5"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                        lineNumber: 930,
                                        columnNumber: 45
                                    }, this),
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid grid-cols-3 gap-2 p-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SigText, {
                                                label: "Critical",
                                                v: String(findings.CRITICAL || 0),
                                                sev: findings.CRITICAL ? "critical" : undefined
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 932,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SigText, {
                                                label: "Material",
                                                v: String(findings.MATERIAL || 0),
                                                sev: findings.MATERIAL ? "warning" : undefined
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 933,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SigText, {
                                                label: "Minor",
                                                v: String(findings.MINOR || 0)
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                                lineNumber: 934,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                        lineNumber: 931,
                                        columnNumber: 13
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                    lineNumber: 930,
                                    columnNumber: 11
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                            lineNumber: 928,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                    lineNumber: 697,
                    columnNumber: 20
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 693,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 681,
        columnNumber: 7
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$EnterprisePage$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EnterprisePage"], {
        kind: "object",
        heightClass: isOverlay ? "h-full" : "h-screen",
        identity: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ShellIdentity$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ShellIdentity"], {
            showConceptNav: !isOverlay,
            tag: isOverlay ? "ISSUER PROFILE" : issuer.ticker?.toUpperCase() || "—",
            title: issuer.name,
            titleAs: "h2",
            badges: latest_run ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "flex items-center gap-1 shrink-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        title: STATUS_TOOLTIP[latest_run.committee_status] || "",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tag"], {
                            sev: COMMITTEE_SEV[latest_run.committee_status] ?? "low",
                            children: latest_run.committee_status
                        }, void 0, false, {
                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                            lineNumber: 955,
                            columnNumber: 17
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 954,
                        columnNumber: 15
                    }, this),
                    signals.recommendation ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        title: recGated ? "Gated: committee status is Blocked — the stance is informational until the block clears." : STATUS_TOOLTIP[String(signals.recommendation)] || "",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tag"], {
                            sev: recGated ? "low" : bandSev(signals.recommendation),
                            children: String(signals.recommendation) + (recGated ? " · GATED" : "")
                        }, void 0, false, {
                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                            lineNumber: 961,
                            columnNumber: 19
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 958,
                        columnNumber: 17
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 953,
                columnNumber: 13
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tag"], {
                sev: "low",
                children: "no run"
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 967,
                columnNumber: 15
            }, this),
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "text-caos-muted truncate text-caos-xs shrink-0 max-w-[110px]",
                    style: {
                        fontSize: 11
                    },
                    children: [
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$issuers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["issuerSector"])(issuer),
                        issuer.country
                    ].filter(Boolean).join(" · ")
                }, void 0, false, {
                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                    lineNumber: 969,
                    columnNumber: 11
                }, this),
                ratings.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "flex items-center gap-1 shrink-0",
                    children: ratings.map((r)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "tabular text-[10px] border border-caos-border rounded px-1 py-px",
                            title: `${r.ag} rating`,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-caos-muted",
                                    children: r.short
                                }, void 0, false, {
                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                    lineNumber: 976,
                                    columnNumber: 19
                                }, this),
                                " ",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-caos-text font-semibold",
                                    children: r.v
                                }, void 0, false, {
                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                    lineNumber: 976,
                                    columnNumber: 70
                                }, this)
                            ]
                        }, r.ag, true, {
                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                            lineNumber: 975,
                            columnNumber: 17
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                    lineNumber: 973,
                    columnNumber: 13
                }, this) : null
            ]
        }, void 0, true, {
            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
            lineNumber: 947,
            columnNumber: 9
        }, this),
        primaryAction: {
            label: "OPEN DEEP-DIVE →",
            href: deepHref
        },
        status: profileAsOf ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "tabular text-caos-2xs text-caos-muted",
            children: [
                "Latest run ",
                profileAsOf
            ]
        }, void 0, true, {
            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
            lineNumber: 984,
            columnNumber: 29
        }, this) : null,
        contextualControls: isOverlay && onClose ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CloseButton"], {
            onClick: onClose,
            title: "Close (Esc)"
        }, void 0, false, {
            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
            lineNumber: 987,
            columnNumber: 11
        }, this) : null,
        narrowContract: {
            // Overlay keeps its close affordance; the STANDALONE page keeps the
            // concept nav — previously `null`, which stripped every navigation
            // affordance from the header below 1024px (only the footer link bar
            // survived). Fixed as part of the design-rebuild shell work.
            essentialControls: isOverlay ? onClose ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CloseButton"], {
                onClick: onClose,
                title: "Close (Esc)"
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 996,
                columnNumber: 21
            }, this) : null : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ConceptNav$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConceptNav"], {
                compact: true
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 998,
                columnNumber: 11
            }, this)
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 min-h-0 overflow-auto p-2.5 md:p-3 flex flex-col gap-3",
                children: body
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1002,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "h-8 shrink-0 border-t border-caos-border bg-caos-panel flex items-center gap-1 px-2",
                children: ISSUER_ACTIONS.map((a)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        href: `${a.href}${encodeURIComponent(id)}${analysis.context ? `&context=${encodeURIComponent(analysis.context.id)}` : ""}`,
                        className: "no-underline tabular text-caos-xs uppercase tracking-wider px-2 py-1 rounded text-caos-muted hover:text-caos-text hover:bg-caos-elevated transition-caos focus-ring",
                        children: a.label
                    }, a.href, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 1011,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1009,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 944,
        columnNumber: 5
    }, this);
}
_s2(Profile, "1jDvgF6G4QZ0nTFcwR8zL9ZgI8U=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAnalysisContext"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useFreshness$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIssuerFreshness"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$typed$2d$url$2d$state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTypedUrlState"]
    ];
});
_c9 = Profile;
// ─── small building blocks ──────────────────────────────────────────────────
function Empty({ children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
        className: "tabular text-caos-sm text-caos-muted py-1",
        children: children
    }, void 0, false, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 1026,
        columnNumber: 10
    }, this);
}
_c10 = Empty;
function analystNotesFromGraph(graph) {
    return (graph?.nodes ?? []).filter((n)=>n.id.startsWith("memo:")).map((n)=>({
            id: n.id,
            title: n.label,
            excerpt: n.analyst_excerpt || n.sub || "",
            url: n.obsidian_url
        }));
}
function AnalystNotesPanel({ issuerId, issuerName, ticker }) {
    _s3();
    const [graph, setGraph] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    // Bumped by the Log-a-note quick-capture so a freshly vaulted memo shows up
    // without a page reload (the memo travels upload -> autolink -> memochunks,
    // and the analyst-memos walk re-reads it here).
    const [refresh, setRefresh] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AnalystNotesPanel.useEffect": ()=>{
            let stale = false;
            setLoading(true);
            setError(null);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["queryGraph"])("analyst-memos", issuerId).then({
                "AnalystNotesPanel.useEffect": (g)=>{
                    if (!stale) setGraph(g);
                }
            }["AnalystNotesPanel.useEffect"]).catch({
                "AnalystNotesPanel.useEffect": (e)=>{
                    if (stale) return;
                    const detail = e?.response?.data?.detail || e?.message || "could not load analyst notes";
                    setError(String(detail));
                }
            }["AnalystNotesPanel.useEffect"]).finally({
                "AnalystNotesPanel.useEffect": ()=>{
                    if (!stale) setLoading(false);
                }
            }["AnalystNotesPanel.useEffect"]);
            return ({
                "AnalystNotesPanel.useEffect": ()=>{
                    stale = true;
                }
            })["AnalystNotesPanel.useEffect"];
        }
    }["AnalystNotesPanel.useEffect"], [
        issuerId,
        refresh
    ]);
    const notes = analystNotesFromGraph(graph);
    const linkHint = "[[" + issuerName + "]]" + (ticker ? " or [[" + ticker + "]]" : "");
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
        title: "Analyst notes",
        right: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "flex items-center gap-2",
            children: [
                notes.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "tabular text-caos-2xs text-caos-muted",
                    children: [
                        notes.length,
                        " linked"
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                    lineNumber: 1073,
                    columnNumber: 27
                }, this) : null,
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$query$2f$VaultMemoUpload$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VaultMemoUpload"], {
                    issuer: {
                        name: issuerName,
                        ticker
                    },
                    onUploaded: ()=>setRefresh((r)=>r + 1)
                }, void 0, false, {
                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                    lineNumber: 1074,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
            lineNumber: 1072,
            columnNumber: 9
        }, this),
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "px-3 py-2 flex flex-col gap-2",
            children: loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Empty, {
                children: "Loading analyst notes…"
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1080,
                columnNumber: 11
            }, this) : error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-start gap-1.5 tabular text-caos-sm text-caos-warning",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "mt-0.5 shrink-0",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                            kind: "warning",
                            size: 10
                        }, void 0, false, {
                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                            lineNumber: 1083,
                            columnNumber: 47
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 1083,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: [
                            "Couldn't load analyst notes — ",
                            error
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 1084,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1082,
                columnNumber: 11
            }, this) : notes.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Empty, {
                children: [
                    "No analyst notes linked to this issuer. Add ",
                    linkHint,
                    " in the vault."
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1087,
                columnNumber: 11
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-col divide-y divide-caos-border/40",
                children: notes.map((note)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "py-1.5 first:pt-0 last:pb-0",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "tabular text-caos-sm text-caos-text truncate",
                                        children: note.title
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                        lineNumber: 1093,
                                        columnNumber: 19
                                    }, this),
                                    note.url ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                        href: note.url,
                                        className: "shrink-0 no-underline tabular text-caos-2xs text-caos-accent hover:text-caos-text transition-caos rounded focus-ring",
                                        children: "OPEN IN VAULT"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                        lineNumber: 1095,
                                        columnNumber: 21
                                    }, this) : null
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 1092,
                                columnNumber: 17
                            }, this),
                            note.excerpt ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "tabular text-caos-xs text-caos-muted mt-0.5",
                                children: note.excerpt
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 1100,
                                columnNumber: 33
                            }, this) : null
                        ]
                    }, note.id, true, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 1091,
                        columnNumber: 15
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1089,
                columnNumber: 11
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
            lineNumber: 1078,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 1069,
        columnNumber: 5
    }, this);
}
_s3(AnalystNotesPanel, "62kiT5L5e7h3SQmCQhOrIf/2g+A=");
_c11 = AnalystNotesPanel;
// Shown when every signal in a panel is blank — distinguishes "ran, nothing to
// say" from "never ran" so we never imply analysis happened when it didn't.
function EmptyIfBlank({ ok, latest }) {
    if (ok.some((v)=>v != null)) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Empty, {
        children: latest ? "Not surfaced by the latest run." : "No completed run yet — run an analysis."
    }, void 0, false, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 1114,
        columnNumber: 10
    }, this);
}
_c12 = EmptyIfBlank;
// fallow-ignore-next-line complexity -- Delta formatting and directional styling are one deterministic row projection.
function DeltaRow({ label, v, suffix }) {
    if (v == null || typeof v !== "number") return null;
    const sev = v > 0 ? "pass" : v < 0 ? "high" : "low";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-baseline justify-between",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                children: label
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1123,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular font-medium leading-none",
                style: {
                    fontSize: 15,
                    color: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sevSurface"])(sev).color
                },
                children: signed(v, suffix)
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1124,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 1122,
        columnNumber: 5
    }, this);
}
_c13 = DeltaRow;
function SigBand({ label, v, extra, gated = false }) {
    if (v == null) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-start justify-between gap-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted pt-0.5",
                children: label
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1133,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "flex flex-col items-end gap-0.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tag"], {
                        sev: gated ? "low" : bandSev(v),
                        children: String(v) + (gated ? " · GATED" : "")
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 1135,
                        columnNumber: 9
                    }, this),
                    gated ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs text-caos-muted text-right",
                        children: "committee Blocked"
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 1136,
                        columnNumber: 18
                    }, this) : null,
                    extra ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs text-caos-muted text-right",
                        children: extra
                    }, void 0, false, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 1137,
                        columnNumber: 18
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1134,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 1132,
        columnNumber: 5
    }, this);
}
_c14 = SigBand;
// Cross-default dominoes now render via the shared CrossDefaultDominoes
// component (components/shared/CrossDefaultDominoes.tsx) — Deep-Dive's
// Covenants tab reads the identical live map (WP-4 G13).
function SigText({ label, v, sev }) {
    if (v == null) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-start justify-between gap-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted pt-0.5",
                children: label
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1151,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-sm text-right",
                style: {
                    color: sev ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sevSurface"])(sev).color : "var(--caos-text)"
                },
                children: v
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1152,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 1150,
        columnNumber: 5
    }, this);
}
_c15 = SigText;
function RunRow({ r, href }) {
    // Local calendar date, not the UTC slice: a run kicked off at 21:00 ET showed
    // the NEXT day's date to the analyst (audit 2026-07-10 F14).
    const date = r.created_at ? new Date(r.created_at).toLocaleDateString("en-CA") : "—";
    // One truncating labeled cell (QA · IC, analyst in the tooltip) instead of the
    // former six fixed columns, which overflowed the ~500px panel into a scrollbar
    // and read as a stutter ("Blocked Blocked") with the analyst id clipped.
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
        href: href,
        title: `QA ${r.qa_status} · IC ${r.committee_status}${r.analyst_id ? " · " + r.analyst_id : ""}`,
        className: "no-underline grid grid-cols-[84px_auto_minmax(0,1fr)_44px] gap-x-2 px-3 py-[7px] border-b border-caos-border/50 items-center hover:bg-caos-elevated/60 transition-caos group focus-ring",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-sm text-caos-muted",
                children: date
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1170,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tag"], {
                sev: RUN_SEV[r.status] ?? "low",
                children: r.status
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1171,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-sm text-caos-text truncate",
                children: [
                    "QA ",
                    r.qa_status,
                    " · IC ",
                    r.committee_status
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1172,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xs text-caos-muted text-right group-hover:text-caos-accent transition-caos",
                children: "OPEN →"
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1173,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 1165,
        columnNumber: 5
    }, this);
}
_c16 = RunRow;
// A column of CP-1A sourced statements (business description / operating model).
function BizCol({ title, facts, deepHref }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "px-3 py-2.5",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5",
                children: title
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1182,
                columnNumber: 7
            }, this),
            facts.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "tabular text-caos-2xs text-caos-muted",
                children: "—"
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1184,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-col gap-2",
                children: facts.map((f, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-caos-md text-caos-text/90 leading-snug m-0",
                                children: f.statement
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 1189,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-1.5 mt-0.5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "tabular text-caos-2xs text-caos-muted",
                                        children: f.fact_area
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                        lineNumber: 1191,
                                        columnNumber: 17
                                    }, this),
                                    f.chunk_id ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                        href: deepHref + "&mod=CP-1A",
                                        className: "no-underline tabular text-caos-2xs text-caos-muted hover:text-caos-accent transition-caos rounded focus-ring",
                                        title: "See source in Deep-Dive",
                                        "aria-label": "See source in Deep-Dive",
                                        children: "▸ src"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                        lineNumber: 1192,
                                        columnNumber: 31
                                    }, this) : null
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 1190,
                                columnNumber: 15
                            }, this)
                        ]
                    }, i, true, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 1188,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1186,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 1181,
        columnNumber: 5
    }, this);
}
_c17 = BizCol;
// Ownership fact(s) plus the CP-2D sponsor red-flag ledger.
// fallow-ignore-next-line complexity -- Ownership facts and sponsor red flags form one credit-governance column.
function OwnershipCol({ facts, ledger, score, deepHref }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "px-3 py-2.5",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5",
                children: "Ownership & sponsor"
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1209,
                columnNumber: 7
            }, this),
            facts.length === 0 && ledger.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "tabular text-caos-2xs text-caos-muted",
                children: "—"
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1211,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-col gap-2",
                children: [
                    facts.map((f, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-caos-md text-caos-text/90 leading-snug m-0",
                                    children: f.statement
                                }, void 0, false, {
                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                    lineNumber: 1216,
                                    columnNumber: 15
                                }, this),
                                f.chunk_id ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    href: deepHref + "&mod=CP-1A",
                                    className: "no-underline tabular text-caos-2xs text-caos-muted hover:text-caos-accent transition-caos rounded focus-ring",
                                    title: "See source in Deep-Dive",
                                    "aria-label": "See source in Deep-Dive",
                                    children: "▸ src"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                    lineNumber: 1217,
                                    columnNumber: 29
                                }, this) : null
                            ]
                        }, i, true, {
                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                            lineNumber: 1215,
                            columnNumber: 13
                        }, this)),
                    ledger.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col gap-1 pt-0.5",
                        children: [
                            typeof score === "number" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "tabular text-caos-2xs text-caos-muted",
                                children: [
                                    "Governance risk score ",
                                    score
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 1222,
                                columnNumber: 44
                            }, this) : null,
                            ledger.map((fl, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "flex items-center gap-1.5 tabular text-caos-2xs",
                                    style: {
                                        color: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sevSurface"])("warning").color
                                    },
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                                            kind: "warning",
                                            size: 9
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                            lineNumber: 1225,
                                            columnNumber: 19
                                        }, this),
                                        " ",
                                        fl.flag
                                    ]
                                }, i, true, {
                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                    lineNumber: 1224,
                                    columnNumber: 17
                                }, this))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 1221,
                        columnNumber: 13
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1213,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 1208,
        columnNumber: 5
    }, this);
}
_c18 = OwnershipCol;
// A strengths or weaknesses list, glyph-marked (success ✓ / warning ▾).
function SWCol({ kind, title, items }) {
    const sev = kind === "success" ? "pass" : "warning";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "px-3 py-2.5",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5",
                children: title
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1241,
                columnNumber: 7
            }, this),
            items.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "tabular text-caos-2xs text-caos-muted",
                children: "—"
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1243,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "flex flex-col gap-1.5 m-0 p-0 list-none",
                children: items.map((t, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: "flex items-start gap-1.5",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                style: {
                                    color: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sevSurface"])(sev).color
                                },
                                className: "mt-0.5 shrink-0",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                                    kind: kind,
                                    size: 10
                                }, void 0, false, {
                                    fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                    lineNumber: 1248,
                                    columnNumber: 90
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 1248,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-caos-md text-caos-text/90 leading-snug",
                                children: t
                            }, void 0, false, {
                                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                                lineNumber: 1249,
                                columnNumber: 15
                            }, this)
                        ]
                    }, i, true, {
                        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                        lineNumber: 1247,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
                lineNumber: 1245,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/issuers/profile/ProfileContent.tsx",
        lineNumber: 1240,
        columnNumber: 5
    }, this);
}
_c19 = SWCol;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c10, _c11, _c12, _c13, _c14, _c15, _c16, _c17, _c18, _c19;
__turbopack_context__.k.register(_c, "Sparkline");
__turbopack_context__.k.register(_c1, "TrendDelta");
__turbopack_context__.k.register(_c2, "TrendPlot");
__turbopack_context__.k.register(_c3, "TrendCard");
__turbopack_context__.k.register(_c4, "IssuerProfilePage");
__turbopack_context__.k.register(_c5, "Splash");
__turbopack_context__.k.register(_c6, "KpiTile");
__turbopack_context__.k.register(_c7, "IssuerProfileView");
__turbopack_context__.k.register(_c8, "ErrorView");
__turbopack_context__.k.register(_c9, "Profile");
__turbopack_context__.k.register(_c10, "Empty");
__turbopack_context__.k.register(_c11, "AnalystNotesPanel");
__turbopack_context__.k.register(_c12, "EmptyIfBlank");
__turbopack_context__.k.register(_c13, "DeltaRow");
__turbopack_context__.k.register(_c14, "SigBand");
__turbopack_context__.k.register(_c15, "SigText");
__turbopack_context__.k.register(_c16, "RunRow");
__turbopack_context__.k.register(_c17, "BizCol");
__turbopack_context__.k.register(_c18, "OwnershipCol");
__turbopack_context__.k.register(_c19, "SWCol");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/app/issuers/profile/ProfileContent.tsx [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/src/app/issuers/profile/ProfileContent.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=src_0_tqe3r._.js.map