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
"[project]/src/components/shared/headStat.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Portfolio head-stat (label + tabular value) shared by the Command and Monitor
// sub-headers. `big` bumps the value to the hero size; `c` tints it. Extracted
// from a verbatim clone in both page headers (fallow dup:2bc80839).
__turbopack_context__.s([
    "headStat",
    ()=>headStat
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
;
const headStat = (l, v, c, big)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "flex items-baseline gap-1.5 whitespace-nowrap",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                children: l
            }, void 0, false, {
                fileName: "[project]/src/components/shared/headStat.tsx",
                lineNumber: 6,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular " + (big ? "text-caos-metric font-medium" : "text-caos-2xl"),
                style: {
                    color: c
                },
                children: v
            }, void 0, false, {
                fileName: "[project]/src/components/shared/headStat.tsx",
                lineNumber: 7,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, l, true, {
        fileName: "[project]/src/components/shared/headStat.tsx",
        lineNumber: 5,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
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
"[project]/src/components/shared/TableColumnFilter.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FilterHeader",
    ()=>FilterHeader,
    "updateColumnFilter",
    ()=>updateColumnFilter,
    "useColumnFilters",
    ()=>useColumnFilters
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2d$dom$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react-dom/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature();
"use client";
;
;
function updateColumnFilter(filters, col, values) {
    const next = {
        ...filters
    };
    if (values === undefined) delete next[col];
    else next[col] = values;
    return next;
}
const keyOf = (v)=>v == null || v === "" ? "—" : String(v);
const MAX_VISIBLE_OPTIONS = 100;
// The funnel glyph used by every filter-trigger variant below (icon-only,
// label+icon combined, and sortable-column-adjacent).
function FunnelIcon() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        viewBox: "0 0 12 12",
        width: "9",
        height: "9",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.4",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
            d: "M2 3h8M3.5 6h5M5 9h2"
        }, void 0, false, {
            fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
            lineNumber: 35,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
        lineNumber: 34,
        columnNumber: 5
    }, this);
}
_c = FunnelIcon;
function useColumnFilters(rows, filters, getters) {
    _s();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "useColumnFilters.useMemo": ()=>rows.filter({
                "useColumnFilters.useMemo": (row)=>Object.entries(filters).every({
                        "useColumnFilters.useMemo": ([col, allowed])=>{
                            if (allowed === undefined) return true;
                            const get = getters[col];
                            return !get || allowed.includes(keyOf(get(row)));
                        }
                    }["useColumnFilters.useMemo"])
            }["useColumnFilters.useMemo"])
    }["useColumnFilters.useMemo"], [
        rows,
        filters,
        getters
    ]);
}
_s(useColumnFilters, "nwk+m61qLgjDVUp4IGV/072DDN4=");
function optionComparator(allNumeric) {
    return (a, b)=>{
        if (!allNumeric) return a.localeCompare(b);
        if (a === "—") return 1;
        if (b === "—") return -1;
        return Number(a) - Number(b);
    };
}
function useFilterOptions(rows, getValue) {
    _s1();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "useFilterOptions.useMemo": ()=>{
            const unique = Array.from(new Set(rows.map({
                "useFilterOptions.useMemo.unique": (row)=>keyOf(getValue(row))
            }["useFilterOptions.useMemo.unique"])));
            const allNumeric = unique.every({
                "useFilterOptions.useMemo.allNumeric": (value)=>value === "—" || value !== "" && !Number.isNaN(Number(value))
            }["useFilterOptions.useMemo.allNumeric"]);
            return unique.sort(optionComparator(allNumeric));
        }
    }["useFilterOptions.useMemo"], [
        rows,
        getValue
    ]);
}
_s1(useFilterOptions, "nwk+m61qLgjDVUp4IGV/072DDN4=");
function trapDialogFocus(event, panel) {
    if (event.key !== "Tab") return;
    const focusable = panel?.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const movingBeforeFirst = event.shiftKey && document.activeElement === first;
    const movingPastLast = !event.shiftKey && document.activeElement === last;
    if (!movingBeforeFirst && !movingPastLast) return;
    event.preventDefault();
    (movingBeforeFirst ? last : first).focus();
}
function useFilterDialog() {
    _s2();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [mounted, setMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [pos, setPos] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        x: 0,
        y: 0
    });
    const [q, setQ] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const panelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const triggerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useFilterDialog.useEffect": ()=>{
            setMounted(true);
        }
    }["useFilterDialog.useEffect"], []);
    const openAt = (el)=>{
        triggerRef.current = el;
        const r = el.getBoundingClientRect();
        setPos({
            x: Math.max(8, Math.min(r.left, window.innerWidth - 264)),
            y: Math.max(8, Math.min(r.bottom + 4, window.innerHeight - 264))
        });
        setOpen(true);
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useFilterDialog.useEffect": ()=>{
            if (!open) triggerRef.current?.focus();
        }
    }["useFilterDialog.useEffect"], [
        open
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useFilterDialog.useEffect": ()=>{
            if (!open) return;
            const onKey = {
                "useFilterDialog.useEffect.onKey": (e)=>{
                    if (e.key === "Escape") {
                        setOpen(false);
                        return;
                    }
                    trapDialogFocus(e, panelRef.current);
                }
            }["useFilterDialog.useEffect.onKey"];
            const onPointer = {
                "useFilterDialog.useEffect.onPointer": (e)=>{
                    if (panelRef.current?.contains(e.target)) return;
                    setOpen(false);
                }
            }["useFilterDialog.useEffect.onPointer"];
            window.addEventListener("keydown", onKey);
            window.addEventListener("pointerdown", onPointer);
            return ({
                "useFilterDialog.useEffect": ()=>{
                    window.removeEventListener("keydown", onKey);
                    window.removeEventListener("pointerdown", onPointer);
                }
            })["useFilterDialog.useEffect"];
        }
    }["useFilterDialog.useEffect"], [
        open
    ]);
    return {
        mounted,
        open,
        openAt,
        panelRef,
        pos,
        q,
        setOpen,
        setQ
    };
}
_s2(useFilterDialog, "YCNK5ExxbMhl7Zf/Qo/sl4mxm14=");
function nextOptionSelection(selected, options, option, checked) {
    const base = selected ?? options;
    const next = checked ? Array.from(new Set([
        ...base,
        option
    ])) : base.filter((value)=>value !== option);
    return next.length === options.length ? undefined : next;
}
function FilterOption({ col, onChange, option, options, selected }) {
    const checked = selected === undefined || selected.includes(option);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
        className: "flex min-w-0 items-center gap-2 px-1 py-1 hover:bg-caos-elevated/70 rounded",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "checkbox",
                name: `filter-${col}`,
                autoComplete: "off",
                checked: checked,
                onChange: (event)=>onChange(col, nextOptionSelection(selected, options, option, event.target.checked)),
                className: "accent-[var(--caos-accent)]"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                lineNumber: 167,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-xs text-caos-text truncate",
                title: option,
                children: option
            }, void 0, false, {
                fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                lineNumber: 175,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
        lineNumber: 166,
        columnNumber: 10
    }, this);
}
_c1 = FilterOption;
function FilterOptions({ col, onChange, options, selected, visible }) {
    if (!visible.length) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "px-1 py-2 tabular text-caos-xs text-caos-muted",
        children: "No values"
    }, void 0, false, {
        fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
        lineNumber: 180,
        columnNumber: 31
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: visible.map((option)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FilterOption, {
                col: col,
                onChange: onChange,
                option: option,
                options: options,
                selected: selected
            }, option, false, {
                fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                lineNumber: 181,
                columnNumber: 37
            }, this))
    }, void 0, false);
}
_c2 = FilterOptions;
function FilterDialog({ controller, matches, options, props, visible }) {
    if (!controller.mounted || !controller.open) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2d$dom$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createPortal"])(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: controller.panelRef,
        role: "dialog",
        "aria-modal": "true",
        "aria-label": `Filter ${props.label}`,
        className: "fixed z-overlay w-64 rounded border border-caos-border bg-caos-panel p-2 shadow-lg",
        style: {
            left: controller.pos.x,
            top: controller.pos.y,
            boxShadow: "var(--shadow-pop)"
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-2 mb-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted flex-1 min-w-0 truncate",
                        title: `Filter ${props.label}`,
                        children: [
                            "Filter ",
                            props.label
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                        lineNumber: 196,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        "aria-label": `Close ${props.label} filter`,
                        className: "rounded px-1 tabular text-caos-xs text-caos-muted hover:text-caos-text focus-ring",
                        onClick: ()=>controller.setOpen(false),
                        children: "×"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                        lineNumber: 197,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                lineNumber: 195,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                autoFocus: true,
                name: `filter-${props.col}-values`,
                autoComplete: "off",
                value: controller.q,
                onChange: (event)=>controller.setQ(event.target.value),
                placeholder: "Search values…",
                "aria-label": `Search ${props.label} values`,
                className: "w-full rounded border border-caos-border bg-caos-elevated px-2 py-1 tabular text-caos-xs text-caos-text outline-none focus-ring"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                lineNumber: 199,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-2 flex gap-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        className: "tabular text-caos-2xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text focus-ring",
                        onClick: ()=>props.onChange(props.col, undefined),
                        children: "All"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                        lineNumber: 210,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        className: "tabular text-caos-2xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text focus-ring",
                        onClick: ()=>props.onChange(props.col, []),
                        children: "Clear"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                        lineNumber: 211,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                lineNumber: 209,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-2 max-h-44 overflow-auto",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FilterOptions, {
                    col: props.col,
                    onChange: props.onChange,
                    options: options,
                    selected: props.selected,
                    visible: visible
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                    lineNumber: 213,
                    columnNumber: 52
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                lineNumber: 213,
                columnNumber: 7
            }, this),
            matches.length > visible.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-1 px-1 tabular text-caos-2xs text-caos-muted",
                children: [
                    "Showing first ",
                    visible.length,
                    " of ",
                    matches.length,
                    " values"
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                lineNumber: 214,
                columnNumber: 42
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
        lineNumber: 187,
        columnNumber: 5
    }, this), document.body);
}
_c3 = FilterDialog;
function iconFilterClass(active) {
    const state = active ? "border-caos-accent text-caos-accent bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60";
    return `inline-flex h-6 min-h-6 w-6 min-w-6 shrink-0 items-center justify-center rounded border transition-caos focus-ring ${state}`;
}
function openFilter(event, controller) {
    event.preventDefault();
    event.stopPropagation();
    controller.openAt(event.currentTarget);
}
function IconFilterTrigger({ active, controller, label }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        "aria-label": `Filter ${label}`,
        "aria-haspopup": "dialog",
        "aria-expanded": controller.open,
        title: `Filter ${label}`,
        onClick: (event)=>openFilter(event, controller),
        className: iconFilterClass(active),
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FunnelIcon, {}, void 0, false, {
            fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
            lineNumber: 242,
            columnNumber: 4
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
        lineNumber: 234,
        columnNumber: 10
    }, this);
}
_c4 = IconFilterTrigger;
function sortDirection(props) {
    return props.sortState?.col === props.col ? props.sortState.dir : null;
}
function ariaSortDirection(dir) {
    if (dir === "asc") return "ascending";
    if (dir === "desc") return "descending";
    return "none";
}
function nextSortVerb(dir) {
    if (dir === "asc") return "descending";
    if (dir === "desc") return "clear sort on";
    return "ascending";
}
function SortGlyph({ dir }) {
    return dir ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        "aria-hidden": "true",
        className: "inline-flex w-2 shrink-0 justify-center leading-none text-caos-2xs",
        children: dir === "asc" ? "▲" : "▼"
    }, void 0, false, {
        fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
        lineNumber: 262,
        columnNumber: 16
    }, this) : null;
}
_c5 = SortGlyph;
function SortableFilterHeader({ active, controller, dialog, props }) {
    const dir = sortDirection(props);
    const sort = ()=>props.onSort?.(props.col);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                ...props.asHeaderCell ? {
                    role: "columnheader",
                    "aria-sort": ariaSortDirection(dir)
                } : {},
                className: "inline-flex items-center gap-1.5 min-w-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        "aria-label": `Sort ${props.label} ${nextSortVerb(dir)}`,
                        title: `Sort ${props.label} ${nextSortVerb(dir)}`,
                        onClick: (event)=>{
                            event.preventDefault();
                            event.stopPropagation();
                            sort();
                        },
                        className: `inline-flex items-center gap-1 min-w-0 hover:text-caos-text transition-caos focus-ring ${props.className ?? ""}${dir ? " text-caos-accent" : " text-caos-muted"}`,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "truncate",
                                children: props.children
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                                lineNumber: 277,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SortGlyph, {
                                dir: dir
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                                lineNumber: 277,
                                columnNumber: 59
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                        lineNumber: 270,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(IconFilterTrigger, {
                        active: active,
                        controller: controller,
                        label: props.label
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                        lineNumber: 279,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                lineNumber: 269,
                columnNumber: 5
            }, this),
            dialog
        ]
    }, void 0, true);
}
_c6 = SortableFilterHeader;
function combinedFunnelClass(active) {
    const state = active ? "border-caos-accent text-caos-accent bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60";
    return `inline-flex h-4 w-4 items-center justify-center rounded border transition-caos ${state}`;
}
function CombinedFilterHeader({ active, controller, dialog, props }) {
    const trigger = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        "aria-label": `Filter ${props.label}`,
        "aria-haspopup": "dialog",
        "aria-expanded": controller.open,
        title: `Filter ${props.label}`,
        onClick: (event)=>openFilter(event, controller),
        className: `inline-flex items-center gap-1.5 hover:text-caos-text transition-caos focus-ring ${props.className ?? ""}${active ? " text-caos-accent" : " text-caos-muted"}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                children: props.children
            }, void 0, false, {
                fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                lineNumber: 302,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: combinedFunnelClass(active),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FunnelIcon, {}, void 0, false, {
                    fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                    lineNumber: 302,
                    columnNumber: 80
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                lineNumber: 302,
                columnNumber: 34
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
        lineNumber: 293,
        columnNumber: 19
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            props.asHeaderCell ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                role: "columnheader",
                className: "contents",
                children: trigger
            }, void 0, false, {
                fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                lineNumber: 304,
                columnNumber: 34
            }, this) : trigger,
            dialog
        ]
    }, void 0, true);
}
_c7 = CombinedFilterHeader;
function IconOnlyFilterHeader({ active, controller, dialog, props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                title: `Filter ${props.label}`,
                className: `inline-flex items-center ${props.className ?? ""}${active ? " text-caos-accent" : ""}`,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(IconFilterTrigger, {
                    active: active,
                    controller: controller,
                    label: props.label
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                    lineNumber: 310,
                    columnNumber: 7
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
                lineNumber: 309,
                columnNumber: 5
            }, this),
            dialog
        ]
    }, void 0, true);
}
_c8 = IconOnlyFilterHeader;
function FilterHeader(props) {
    _s3();
    const controller = useFilterDialog();
    const options = useFilterOptions(props.rows, props.getValue);
    const query = controller.q.trim().toLowerCase();
    const matches = options.filter((option)=>option.toLowerCase().includes(query));
    const visible = matches.slice(0, MAX_VISIBLE_OPTIONS);
    const active = props.selected !== undefined;
    const dialog = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FilterDialog, {
        controller: controller,
        matches: matches,
        options: options,
        props: props,
        visible: visible
    }, void 0, false, {
        fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
        lineNumber: 323,
        columnNumber: 18
    }, this);
    if (!props.iconOnly && props.sortable && props.onSort) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SortableFilterHeader, {
        active: active,
        controller: controller,
        dialog: dialog,
        props: props
    }, void 0, false, {
        fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
        lineNumber: 324,
        columnNumber: 65
    }, this);
    if (!props.iconOnly) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CombinedFilterHeader, {
        active: active,
        controller: controller,
        dialog: dialog,
        props: props
    }, void 0, false, {
        fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
        lineNumber: 325,
        columnNumber: 31
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(IconOnlyFilterHeader, {
        active: active,
        controller: controller,
        dialog: dialog,
        props: props
    }, void 0, false, {
        fileName: "[project]/src/components/shared/TableColumnFilter.tsx",
        lineNumber: 326,
        columnNumber: 10
    }, this);
}
_s3(FilterHeader, "YUuQA/bnwd9gRtXubPNfLTfT94o=", false, function() {
    return [
        useFilterDialog,
        useFilterOptions
    ];
});
_c9 = FilterHeader;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9;
__turbopack_context__.k.register(_c, "FunnelIcon");
__turbopack_context__.k.register(_c1, "FilterOption");
__turbopack_context__.k.register(_c2, "FilterOptions");
__turbopack_context__.k.register(_c3, "FilterDialog");
__turbopack_context__.k.register(_c4, "IconFilterTrigger");
__turbopack_context__.k.register(_c5, "SortGlyph");
__turbopack_context__.k.register(_c6, "SortableFilterHeader");
__turbopack_context__.k.register(_c7, "CombinedFilterHeader");
__turbopack_context__.k.register(_c8, "IconOnlyFilterHeader");
__turbopack_context__.k.register(_c9, "FilterHeader");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/useVirtualScroll.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useVirtualScroll",
    ()=>useVirtualScroll
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function useVirtualScroll({ itemCount, estimateHeight = 32, overscan = 10, containerRef }) {
    _s();
    const [scrollTop, setScrollTop] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [containerHeight, setContainerHeight] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(400);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useVirtualScroll.useEffect": ()=>{
            const el = containerRef.current;
            if (!el) return;
            const handleScroll = {
                "useVirtualScroll.useEffect.handleScroll": ()=>{
                    setScrollTop(el.scrollTop);
                }
            }["useVirtualScroll.useEffect.handleScroll"];
            const handleResize = {
                "useVirtualScroll.useEffect.handleResize": ()=>{
                    setContainerHeight(el.clientHeight);
                }
            }["useVirtualScroll.useEffect.handleResize"];
            el.addEventListener("scroll", handleScroll, {
                passive: true
            });
            handleResize();
            let resizeObserver = null;
            if (typeof ResizeObserver !== "undefined") {
                resizeObserver = new ResizeObserver({
                    "useVirtualScroll.useEffect": ()=>{
                        handleResize();
                    }
                }["useVirtualScroll.useEffect"]);
                resizeObserver.observe(el);
            } else {
                window.addEventListener("resize", handleResize);
            }
            return ({
                "useVirtualScroll.useEffect": ()=>{
                    el.removeEventListener("scroll", handleScroll);
                    if (resizeObserver) {
                        resizeObserver.disconnect();
                    } else {
                        window.removeEventListener("resize", handleResize);
                    }
                }
            })["useVirtualScroll.useEffect"];
        }
    }["useVirtualScroll.useEffect"], [
        containerRef
    ]);
    const startIndex = Math.max(0, Math.floor(scrollTop / estimateHeight) - overscan);
    const endIndex = Math.min(itemCount - 1, Math.floor((scrollTop + containerHeight) / estimateHeight) + overscan);
    const paddingTop = startIndex * estimateHeight;
    const paddingBottom = Math.max(0, (itemCount - 1 - endIndex) * estimateHeight);
    const totalHeight = itemCount * estimateHeight;
    return {
        startIndex,
        endIndex,
        paddingTop,
        paddingBottom,
        totalHeight
    };
}
_s(useVirtualScroll, "GyAgg3heUzRPfhPNyymqERPyfCo=");
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
"[project]/src/components/shared/IssuerLink.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "IssuerLink",
    ()=>IssuerLink
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$issuers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/issuers.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerProfileOverlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/IssuerProfileOverlay.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
function IssuerLink({ issuer, query, children, className = "", title }) {
    _s();
    const { openProfile, openProfileByQuery } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerProfileOverlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIssuerProfileOverlay"])();
    const href = issuer ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$issuers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["issuerProfileHref"])(issuer) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$issuers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["issuerSearchHref"])(query || "");
    const handleClick = (e)=>{
        e.preventDefault();
        // Issuer links often live inside keyboard-operable coverage rows. Opening
        // the profile is the complete identity-cell action; it must not also trigger
        // the row remainder's detail-strip action.
        e.stopPropagation();
        // Prefer the id path (direct open); only fall back to a text search when all
        // we have is a free-text query (e.g. a Command Center portfolio code).
        if (issuer?.id) {
            openProfile(issuer.id);
        } else if (query) {
            openProfileByQuery(query);
        }
    };
    const handleKeyDown = (event)=>{
        if (event.key === "Enter" || event.key === " ") event.stopPropagation();
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
        href: href,
        onClick: handleClick,
        onKeyDown: handleKeyDown,
        title: title || "Open issuer profile",
        className: "no-underline cursor-pointer " + className,
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/shared/IssuerLink.tsx",
        lineNumber: 44,
        columnNumber: 5
    }, this);
}
_s(IssuerLink, "53L+5csQQ3gB3uLOJx7LM3sWd7A=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerProfileOverlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIssuerProfileOverlay"]
    ];
});
_c = IssuerLink;
var _c;
__turbopack_context__.k.register(_c, "IssuerLink");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/useRovingFocus.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useRovingFocus",
    ()=>useRovingFocus
]);
// A general-purpose roving-tabindex hook for a flat, ordered collection of
// focusable items (grid cells, scatter points, launcher tiles, ...) — G7,
// design-rebuild WP-2. Exactly one item is a real tab stop at a time; arrow
// keys move which one, and DOM focus moves with it (true roving tabindex,
// not the aria-activedescendant "virtual focus" variant ModelSheet already
// uses for its grid — that pattern fits a dense spreadsheet with its own
// cell-address readout; this one fits a loose collection with no natural
// "cell address," like SectorRV's scatter points).
//
// Callers own rendering; this hook only decides which id is active and moves
// real DOM focus to it. `ids` should already be in the analyst-facing visual
// order (left-to-right / top-to-bottom) so arrow keys track what the eye
// sees, not incidental array order.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
function useRovingFocus(ids) {
    _s();
    const [activeId, setActiveIdState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(ids[0] ?? null);
    const elRefs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(new Map());
    // Keep the active id valid as the collection changes underneath (a sector
    // switch, a column filter, a chart-type toggle that stops rendering
    // points) — fall back to the first item rather than stranding roving
    // tabindex on an id nothing renders anymore (every item would end up
    // tabIndex={-1} and the whole collection would drop out of the tab order).
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useRovingFocus.useEffect": ()=>{
            if (activeId != null && ids.includes(activeId)) return;
            setActiveIdState(ids[0] ?? null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }
    }["useRovingFocus.useEffect"], [
        ids
    ]);
    const setActiveId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRovingFocus.useCallback[setActiveId]": (id)=>setActiveIdState(id)
    }["useRovingFocus.useCallback[setActiveId]"], []);
    const focusId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRovingFocus.useCallback[focusId]": (id)=>{
            if (id == null) return;
            setActiveIdState(id);
            elRefs.current.get(id)?.focus();
        }
    }["useRovingFocus.useCallback[focusId]"], []);
    const move = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRovingFocus.useCallback[move]": (delta)=>{
            if (ids.length === 0) return;
            const i = activeId != null ? ids.indexOf(activeId) : -1;
            const next = i === -1 ? 0 : Math.max(0, Math.min(ids.length - 1, i + delta));
            focusId(ids[next]);
        }
    }["useRovingFocus.useCallback[move]"], [
        ids,
        activeId,
        focusId
    ]);
    const getItemProps = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRovingFocus.useCallback[getItemProps]": (id)=>({
                tabIndex: id === activeId ? 0 : -1,
                ref: ({
                    "useRovingFocus.useCallback[getItemProps]": (el)=>{
                        if (el) elRefs.current.set(id, el);
                        else elRefs.current.delete(id);
                    }
                })["useRovingFocus.useCallback[getItemProps]"],
                onFocus: ({
                    "useRovingFocus.useCallback[getItemProps]": ()=>setActiveIdState(id)
                })["useRovingFocus.useCallback[getItemProps]"],
                onKeyDown: ({
                    "useRovingFocus.useCallback[getItemProps]": (e)=>{
                        // Both axes walk the same 1D order — the items this hook manages
                        // (scatter points, launcher tiles) don't carry a real row/column
                        // address the way a spreadsheet grid does, so Right/Down and
                        // Left/Up are equivalent "forward"/"back" through that order.
                        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                            e.preventDefault();
                            move(1);
                        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                            e.preventDefault();
                            move(-1);
                        } else if (e.key === "Home") {
                            e.preventDefault();
                            focusId(ids[0]);
                        } else if (e.key === "End") {
                            e.preventDefault();
                            focusId(ids[ids.length - 1]);
                        }
                    }
                })["useRovingFocus.useCallback[getItemProps]"]
            })
    }["useRovingFocus.useCallback[getItemProps]"], [
        activeId,
        move,
        focusId,
        ids
    ]);
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "useRovingFocus.useMemo": ()=>({
                activeId,
                setActiveId,
                getItemProps
            })
    }["useRovingFocus.useMemo"], [
        activeId,
        setActiveId,
        getItemProps
    ]);
}
_s(useRovingFocus, "2DQ2JFYaKmCoBmiLoEG3iJLgIjg=");
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
"[project]/src/components/command/LiveCoverage.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FRAGILITY_COLOR",
    ()=>FRAGILITY_COLOR,
    "LiveCoverage",
    ()=>LiveCoverage,
    "QA_COLOR",
    ()=>QA_COLOR,
    "RV_COLOR",
    ()=>RV_COLOR,
    "fmtX",
    ()=>fmtX
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$TableColumnFilter$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/TableColumnFilter.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useVirtualScroll$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/useVirtualScroll.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/format.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerLink$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/IssuerLink.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingFocus$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/useRovingFocus.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rowActionMode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/rowActionMode.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature(), _s4 = __turbopack_context__.k.signature(), _s5 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
const fmtX = (v)=>typeof v === "number" && Number.isFinite(v) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fmtMult"])(v) : "—";
const FRAGILITY_COLOR = {
    HIGH: "var(--caos-critical)",
    MODERATE: "var(--caos-warning)",
    LOW: "var(--caos-success)"
};
const RV_COLOR = {
    OVERWEIGHT: "var(--caos-success)",
    NEUTRAL: "var(--caos-muted)",
    UNDERWEIGHT: "var(--caos-critical)"
};
const QA_COLOR = {
    Passed: "var(--caos-success)",
    Restricted: "var(--caos-warning)",
    Blocked: "var(--caos-critical)"
};
const COLS = "grid grid-cols-[1.6fr_1fr_0.7fr_0.7fr_1fr_0.9fr_1fr] gap-2 items-center";
const HEADS = [
    [
        "Issuer",
        "issuer"
    ],
    [
        "Sector",
        "sector"
    ],
    [
        "NetLev",
        "netlev"
    ],
    [
        "IntCov",
        "intcov"
    ],
    [
        "RV posture",
        "rv"
    ],
    [
        "Fragility",
        "fragility"
    ],
    [
        "QA",
        "qa"
    ]
];
const VALUES = {
    issuer: (row)=>row.name,
    sector: (row)=>row.sector,
    netlev: (row)=>row.metrics.net_leverage,
    intcov: (row)=>row.metrics.interest_coverage,
    rv: (row)=>row.rv_recommendation,
    fragility: (row)=>row.downside_fragility,
    qa: (row)=>row.qa_status
};
function sortCoverageRows(rows, sort) {
    if (!sort) return rows;
    const getValue = VALUES[sort.col];
    if (!getValue) return rows;
    const direction = sort.dir === "asc" ? 1 : -1;
    return [
        ...rows
    ].sort((left, right)=>{
        const a = getValue(left);
        const b = getValue(right);
        if (a == null || a === "") return b == null || b === "" ? 0 : 1;
        if (b == null || b === "") return -1;
        if (typeof a === "number" && typeof b === "number") return direction * (a - b);
        return direction * String(a).localeCompare(String(b));
    });
}
function nextCoverageSort(current, column) {
    if (current?.col !== column) return {
        col: column,
        dir: "asc"
    };
    return current.dir === "asc" ? {
        col: column,
        dir: "desc"
    } : null;
}
function navigationTarget(key, currentIndex, count) {
    if (key === "Home") return 0;
    if (key === "End") return count - 1;
    if (key === "ArrowUp") return Math.max(0, currentIndex - 1);
    if (key === "ArrowDown") return Math.min(count - 1, currentIndex + 1);
    return null;
}
function exitCoverageActionMode(event, context) {
    if (event.key !== "Escape" || !context.actionMode) return false;
    event.preventDefault();
    context.setActionMode(false);
    event.currentTarget.focus();
    return true;
}
function enterCoverageActionMode(event, context) {
    if (event.key !== "F2") return false;
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rowActionMode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["focusFirstRowAction"])(event.currentTarget)) {
        event.preventDefault();
        context.setActionMode(true);
    }
    return true;
}
function moveCoverageRow(event, context) {
    const index = navigationTarget(event.key, context.rowIds.indexOf(context.rowId), context.rowIds.length);
    if (index === null) return false;
    event.preventDefault();
    context.setActionMode(false);
    context.moveTo(context.rowIds[index], index);
    return true;
}
function handleCoverageRowKey(event, context) {
    if (exitCoverageActionMode(event, context)) return;
    if (event.currentTarget !== event.target) return;
    if (enterCoverageActionMode(event, context) || moveCoverageRow(event, context)) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    context.activate();
}
function fragilityText(fragility) {
    if (!fragility) return "—";
    const glyph = fragility === "HIGH" ? "▲" : fragility === "MODERATE" ? "■" : "●";
    return `${glyph} ${fragility}`;
}
function CoverageCells({ row }) {
    const rv = row.rv_recommendation;
    const fragility = row.downside_fragility;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                role: "rowheader",
                className: "flex items-center gap-1.5 min-w-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerLink$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["IssuerLink"], {
                        issuer: {
                            id: row.issuer_id
                        },
                        className: "tabular text-caos-accent focus-ring rounded",
                        title: `Open ${row.name} profile`,
                        children: row.ticker || "—"
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/LiveCoverage.tsx",
                        lineNumber: 141,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerLink$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["IssuerLink"], {
                        issuer: {
                            id: row.issuer_id
                        },
                        className: "text-caos-text truncate text-caos-md focus-ring rounded",
                        title: `Open ${row.name} profile`,
                        children: row.name
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/LiveCoverage.tsx",
                        lineNumber: 142,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/command/LiveCoverage.tsx",
                lineNumber: 140,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                role: "gridcell",
                className: "text-caos-muted text-caos-md truncate",
                children: row.sector || "—"
            }, void 0, false, {
                fileName: "[project]/src/components/command/LiveCoverage.tsx",
                lineNumber: 144,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                role: "gridcell",
                className: "tabular text-right",
                children: fmtX(row.metrics.net_leverage)
            }, void 0, false, {
                fileName: "[project]/src/components/command/LiveCoverage.tsx",
                lineNumber: 145,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                role: "gridcell",
                className: "tabular text-right",
                children: fmtX(row.metrics.interest_coverage)
            }, void 0, false, {
                fileName: "[project]/src/components/command/LiveCoverage.tsx",
                lineNumber: 146,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                role: "gridcell",
                className: "tabular text-caos-xs tracking-wide",
                style: {
                    color: rv ? RV_COLOR[rv] ?? "var(--caos-text)" : "var(--caos-muted)"
                },
                children: [
                    rv ?? "—",
                    typeof row.rv_percentile === "number" ? ` · p${Math.round(row.rv_percentile)}` : ""
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/command/LiveCoverage.tsx",
                lineNumber: 147,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                role: "gridcell",
                className: "tabular text-caos-xs tracking-wide",
                style: {
                    color: fragility ? FRAGILITY_COLOR[fragility] : "var(--caos-muted)"
                },
                children: fragilityText(fragility)
            }, void 0, false, {
                fileName: "[project]/src/components/command/LiveCoverage.tsx",
                lineNumber: 148,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                role: "gridcell",
                className: "tabular text-caos-2xs px-1 py-px rounded border whitespace-nowrap justify-self-start",
                style: {
                    color: QA_COLOR[row.qa_status] ?? "var(--caos-muted)",
                    borderColor: QA_COLOR[row.qa_status] ?? "var(--caos-border)"
                },
                title: `Committee: ${row.committee_status}`,
                children: row.qa_status
            }, void 0, false, {
                fileName: "[project]/src/components/command/LiveCoverage.tsx",
                lineNumber: 149,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
_c = CoverageCells;
function CoverageRow({ row, visibleIndex, startIndex, selected, actionMode, focusProps, rowIds, rowRefs, onActivate, onActionMode, onMove }) {
    const rowId = row.issuer_id;
    const register = (element)=>{
        focusProps.ref(element);
        if (element) {
            rowRefs.current.set(rowId, element);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rowActionMode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["syncRowActionTabStops"])(element, actionMode);
        } else rowRefs.current.delete(rowId);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        role: "row",
        ref: register,
        tabIndex: actionMode ? -1 : focusProps.tabIndex,
        onFocus: focusProps.onFocus,
        onBlur: (event)=>{
            if (actionMode && !event.currentTarget.contains(event.relatedTarget)) onActionMode(false);
        },
        onClick: (event)=>{
            if (!event.target.closest("a, button, input, select, textarea, [role='button'], [role='link']")) onActivate();
        },
        onKeyDown: (event)=>handleCoverageRowKey(event, {
                actionMode,
                rowId,
                rowIds,
                activate: onActivate,
                setActionMode: onActionMode,
                moveTo: onMove
            }),
        "aria-rowindex": startIndex + visibleIndex + 2,
        "aria-selected": selected,
        "aria-keyshortcuts": "F2",
        "aria-describedby": "live-coverage-grid-help",
        "aria-label": `${row.ticker || ""} ${row.name || ""} details`,
        className: COLS + " px-3 py-[3px] border-b border-caos-border/50 transition-caos cursor-pointer focus-ring outline-none " + (selected ? "bg-caos-accent/10 border-caos-accent/30 text-caos-text" : "hover:bg-caos-panel/30 text-caos-text"),
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CoverageCells, {
            row: row
        }, void 0, false, {
            fileName: "[project]/src/components/command/LiveCoverage.tsx",
            lineNumber: 182,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/command/LiveCoverage.tsx",
        lineNumber: 167,
        columnNumber: 5
    }, this);
}
_c1 = CoverageRow;
function useSelectedCoverageFocus(selected, visibleIds, setActiveId) {
    _s();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useSelectedCoverageFocus.useEffect": ()=>{
            if (selected && visibleIds.includes(selected)) setActiveId(selected);
        }
    }["useSelectedCoverageFocus.useEffect"], [
        selected,
        setActiveId,
        visibleIds
    ]);
}
_s(useSelectedCoverageFocus, "OD7bBpZva5O2jO+Puf00hKivP7c=");
function useCoverageActionSync(actionRowId, setActionRowId, visibleIds, rowIds, rowRefs) {
    _s1();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useCoverageActionSync.useEffect": ()=>{
            if (actionRowId && !visibleIds.includes(actionRowId)) setActionRowId(null);
            for (const [id, row] of rowRefs.current)(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rowActionMode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["syncRowActionTabStops"])(row, actionRowId === id);
        }
    }["useCoverageActionSync.useEffect"], [
        actionRowId,
        rowIds,
        rowRefs,
        setActionRowId,
        visibleIds
    ]);
}
_s1(useCoverageActionSync, "OD7bBpZva5O2jO+Puf00hKivP7c=");
function usePendingCoverageFocus(activeId, visibleIds, setActiveId, pendingFocusId, rowRefs) {
    _s2();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "usePendingCoverageFocus.useEffect": ()=>{
            const pending = pendingFocusId.current;
            if (pending) {
                const row = rowRefs.current.get(pending);
                if (row) {
                    row.focus();
                    pendingFocusId.current = null;
                }
                return;
            }
            if (activeId && !visibleIds.includes(activeId) && visibleIds[0]) setActiveId(visibleIds[0]);
        }
    }["usePendingCoverageFocus.useEffect"], [
        activeId,
        pendingFocusId,
        rowRefs,
        setActiveId,
        visibleIds
    ]);
}
_s2(usePendingCoverageFocus, "OD7bBpZva5O2jO+Puf00hKivP7c=");
function focusCoverageTarget(targetId, targetIndex, setActiveId, rowRefs, pendingFocusId, scrollerRef) {
    setActiveId(targetId);
    const targetRow = rowRefs.current.get(targetId);
    if (targetRow) {
        targetRow.focus();
        return;
    }
    pendingFocusId.current = targetId;
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = targetIndex * 28;
    scrollerRef.current.dispatchEvent(new Event("scroll"));
}
function CoverageHeader({ rows, filters, sort, onFilter, onSort }) {
    const headingClass = "tabular text-caos-xs uppercase tracking-wider text-caos-muted focus-ring rounded outline-none";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        role: "row",
        "aria-rowindex": 1,
        className: COLS + " px-3 h-7 border-b border-caos-border bg-caos-panel z-10 shrink-0",
        children: HEADS.map(([label, key], index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$TableColumnFilter$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FilterHeader"], {
                label: label,
                col: key,
                rows: rows,
                getValue: VALUES[key],
                selected: filters[key],
                onChange: onFilter,
                sortable: true,
                sortState: sort,
                onSort: onSort,
                asHeaderCell: true,
                className: headingClass + ([
                    2,
                    3
                ].includes(index) ? " text-right" : ""),
                children: label
            }, key, false, {
                fileName: "[project]/src/components/command/LiveCoverage.tsx",
                lineNumber: 232,
                columnNumber: 43
            }, this))
    }, void 0, false, {
        fileName: "[project]/src/components/command/LiveCoverage.tsx",
        lineNumber: 231,
        columnNumber: 5
    }, this);
}
_c2 = CoverageHeader;
function CoverageViewport({ scrollerRef, paddingTop, paddingBottom, visibleRows, startIndex, selected, actionRowId, rowIds, rowRefs, getRowFocusProps, onSelect, setActionRowId, onMove }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: scrollerRef,
        className: "flex-1 overflow-y-auto min-h-0",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            style: {
                paddingTop,
                paddingBottom
            },
            children: visibleRows.map((row, visibleIndex)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CoverageRow, {
                    row: row,
                    visibleIndex: visibleIndex,
                    startIndex: startIndex,
                    selected: selected === row.issuer_id,
                    actionMode: actionRowId === row.issuer_id,
                    focusProps: getRowFocusProps(row.issuer_id),
                    rowIds: rowIds,
                    rowRefs: rowRefs,
                    onActivate: ()=>onSelect?.(row.issuer_id),
                    onActionMode: (active)=>setActionRowId(active ? row.issuer_id : null),
                    onMove: onMove
                }, row.issuer_id, false, {
                    fileName: "[project]/src/components/command/LiveCoverage.tsx",
                    lineNumber: 244,
                    columnNumber: 49
                }, this))
        }, void 0, false, {
            fileName: "[project]/src/components/command/LiveCoverage.tsx",
            lineNumber: 243,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/command/LiveCoverage.tsx",
        lineNumber: 242,
        columnNumber: 5
    }, this);
}
_c3 = CoverageViewport;
function useCoverageData(rows) {
    _s3();
    const scrollerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [filters, setFilters] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [sort, setSort] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const filtered = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$TableColumnFilter$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useColumnFilters"])(rows, filters, VALUES);
    const shown = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "useCoverageData.useMemo[shown]": ()=>sortCoverageRows(filtered, sort)
    }["useCoverageData.useMemo[shown]"], [
        filtered,
        sort
    ]);
    const virtual = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useVirtualScroll$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useVirtualScroll"])({
        itemCount: shown.length,
        estimateHeight: 28,
        overscan: 10,
        containerRef: scrollerRef
    });
    const visibleRows = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "useCoverageData.useMemo[visibleRows]": ()=>shown.slice(virtual.startIndex, virtual.endIndex + 1)
    }["useCoverageData.useMemo[visibleRows]"], [
        shown,
        virtual.startIndex,
        virtual.endIndex
    ]);
    const visibleRowIds = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "useCoverageData.useMemo[visibleRowIds]": ()=>visibleRows.map({
                "useCoverageData.useMemo[visibleRowIds]": (row)=>row.issuer_id
            }["useCoverageData.useMemo[visibleRowIds]"])
    }["useCoverageData.useMemo[visibleRowIds]"], [
        visibleRows
    ]);
    const rowIds = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "useCoverageData.useMemo[rowIds]": ()=>shown.map({
                "useCoverageData.useMemo[rowIds]": (row)=>row.issuer_id
            }["useCoverageData.useMemo[rowIds]"])
    }["useCoverageData.useMemo[rowIds]"], [
        shown
    ]);
    const setFilter = (column, values)=>setFilters((current)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$TableColumnFilter$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateColumnFilter"])(current, column, values));
    const handleSort = (column)=>setSort((current)=>nextCoverageSort(current, column));
    return {
        scrollerRef,
        filters,
        sort,
        shown,
        visibleRows,
        visibleRowIds,
        rowIds,
        setFilter,
        handleSort,
        ...virtual
    };
}
_s3(useCoverageData, "mMt3mSeziQesMArQV4+XQjF6R4A=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$TableColumnFilter$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useColumnFilters"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useVirtualScroll$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useVirtualScroll"]
    ];
});
function useCoverageInteraction(selected, visibleRowIds, rowIds, scrollerRef) {
    _s4();
    const [actionRowId, setActionRowId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const rowRefs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(new Map());
    const pendingFocusId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const { activeId, getItemProps: getRowFocusProps, setActiveId: setActiveRowId } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingFocus$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRovingFocus"])(rowIds);
    useSelectedCoverageFocus(selected, visibleRowIds, setActiveRowId);
    useCoverageActionSync(actionRowId, setActionRowId, visibleRowIds, rowIds, rowRefs);
    usePendingCoverageFocus(activeId, visibleRowIds, setActiveRowId, pendingFocusId, rowRefs);
    const moveFocus = (targetId, targetIndex)=>focusCoverageTarget(targetId, targetIndex, setActiveRowId, rowRefs, pendingFocusId, scrollerRef);
    return {
        actionRowId,
        setActionRowId,
        rowRefs,
        getRowFocusProps,
        moveFocus
    };
}
_s4(useCoverageInteraction, "+rjaR1IEoFDfzBHSlg566PhXvRs=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingFocus$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRovingFocus"],
        useSelectedCoverageFocus,
        useCoverageActionSync,
        usePendingCoverageFocus
    ];
});
function LiveCoverage({ rows, selected = null, onSelect }) {
    _s5();
    const data = useCoverageData(rows);
    const interaction = useCoverageInteraction(selected, data.visibleRowIds, data.rowIds, data.scrollerRef);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                id: "live-coverage-grid-help",
                className: "sr-only",
                children: "Use Up and Down Arrow to move between issuer rows. Press Enter or Space to open row details. Press F2 to enter row actions; press Escape to return to the row."
            }, void 0, false, {
                fileName: "[project]/src/components/command/LiveCoverage.tsx",
                lineNumber: 290,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                role: "grid",
                "aria-label": "Live coverage worklist",
                "aria-rowcount": data.shown.length + 1,
                className: "text-caos-md flex-1 min-h-0 flex flex-col",
                style: {
                    minWidth: 760,
                    height: "100%"
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CoverageHeader, {
                        rows: rows,
                        filters: data.filters,
                        sort: data.sort,
                        onFilter: data.setFilter,
                        onSort: data.handleSort
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/LiveCoverage.tsx",
                        lineNumber: 294,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CoverageViewport, {
                        scrollerRef: data.scrollerRef,
                        paddingTop: data.paddingTop,
                        paddingBottom: data.paddingBottom,
                        visibleRows: data.visibleRows,
                        startIndex: data.startIndex,
                        selected: selected,
                        actionRowId: interaction.actionRowId,
                        rowIds: data.rowIds,
                        rowRefs: interaction.rowRefs,
                        getRowFocusProps: interaction.getRowFocusProps,
                        onSelect: onSelect,
                        setActionRowId: interaction.setActionRowId,
                        onMove: interaction.moveFocus
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/LiveCoverage.tsx",
                        lineNumber: 295,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/command/LiveCoverage.tsx",
                lineNumber: 293,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true);
}
_s5(LiveCoverage, "97QXVYVYNweV4+WIq0XSfGmCYgo=", false, function() {
    return [
        useCoverageData,
        useCoverageInteraction
    ];
});
_c4 = LiveCoverage;
var _c, _c1, _c2, _c3, _c4;
__turbopack_context__.k.register(_c, "CoverageCells");
__turbopack_context__.k.register(_c1, "CoverageRow");
__turbopack_context__.k.register(_c2, "CoverageHeader");
__turbopack_context__.k.register(_c3, "CoverageViewport");
__turbopack_context__.k.register(_c4, "LiveCoverage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/command/DailyDigestPanel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DailyDigestPanel",
    ()=>DailyDigestPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// Daily Digest — the live coverage-health readout for the research lens:
// coverage counts, equal-weighted WARF over the manual agency ratings, the
// staleness watch (names whose latest complete run is old or missing), the
// CCC-cliff watch (B3/B- and below), and 24h run activity. Deterministic
// server roll-up (GET /api/digest/daily), rendered only when live.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/StatusGlyph.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerProfileOverlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/IssuerProfileOverlay.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
function DailyDigestPanel({ digest }) {
    const cov = digest.coverage || {};
    const act = digest.activity_24h || {};
    const failed = act.runs_failed ?? 0;
    // Aggregate-only cells state their cohort in a title — the digest payload
    // carries no per-issuer ids for these, so an honest definition beats a fake
    // click-through.
    const stats = [
        {
            l: "WARF (eq-wt)",
            v: digest.warf != null ? `${digest.warf.toLocaleString("en-US")} · ${digest.warf_band ?? "—"}` : "no rated names",
            title: "Equal-weighted WARF over covered issuers with an agency rating on file — holdings are not par-weighted."
        },
        {
            l: "Rated / covered",
            v: `${cov.rated ?? 0} rated · of ${cov.issuers ?? 0}`,
            title: "Covered issuers with an agency rating on file."
        },
        {
            l: "Complete runs",
            v: `${cov.with_complete_run ?? 0} runs · of ${cov.issuers ?? 0}`,
            title: "Covered issuers with at least one complete analytical run."
        },
        {
            l: "Runs 24h",
            v: `${act.runs_completed ?? 0} done · ${failed} failed`,
            color: failed > 0 ? "var(--caos-critical)" : undefined
        }
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col min-h-0",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 gap-px bg-caos-border/50 border-b border-caos-border",
                children: stats.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "bg-caos-panel px-3 py-2",
                        title: s.title,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                                children: s.l
                            }, void 0, false, {
                                fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
                                lineNumber: 41,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "tabular text-caos-xl",
                                style: {
                                    color: s.color || "var(--caos-text)"
                                },
                                children: s.v
                            }, void 0, false, {
                                fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
                                lineNumber: 42,
                                columnNumber: 13
                            }, this)
                        ]
                    }, s.l, true, {
                        fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
                        lineNumber: 40,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
                lineNumber: 38,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 min-h-0 grid grid-cols-2 gap-px bg-caos-border/50",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(WatchList, {
                        title: `Stale · > ${digest.stale_threshold_days}d`,
                        rows: digest.stale,
                        kind: "warning",
                        empty: "Nothing stale — coverage is fresh."
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
                        lineNumber: 47,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(WatchList, {
                        title: "CCC cliff · ≤ B3/B−",
                        rows: digest.ccc_watch,
                        kind: "critical",
                        empty: "No names at or below B3/B−."
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
                        lineNumber: 53,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
                lineNumber: 46,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
        lineNumber: 35,
        columnNumber: 5
    }, this);
}
_c = DailyDigestPanel;
function WatchList({ title, rows, kind, empty }) {
    _s();
    const { openProfile } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerProfileOverlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIssuerProfileOverlay"])();
    const color = kind === "critical" ? "var(--caos-critical)" : "var(--caos-warning)";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "bg-caos-panel min-h-0 flex flex-col",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-3 min-h-6 py-1 shrink-0 flex items-center gap-1.5 border-b border-caos-border/50",
                children: [
                    rows.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                        kind: kind,
                        size: 9
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
                        lineNumber: 75,
                        columnNumber: 24
                    }, this) : null,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted min-w-0",
                        children: title
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
                        lineNumber: 76,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs",
                        style: {
                            color: rows.length ? color : "var(--caos-muted)"
                        },
                        children: rows.length
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
                        lineNumber: 77,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
                lineNumber: 74,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 min-h-0 overflow-auto",
                children: rows.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "px-3 py-2 tabular text-caos-2xs text-caos-muted m-0",
                    children: empty
                }, void 0, false, {
                    fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
                    lineNumber: 81,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "divide-y divide-caos-border/30",
                    children: rows.map((r)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: ()=>openProfile(r.issuer_id),
                            title: `Open ${r.name} profile`,
                            className: "w-full text-left px-3 py-1 flex items-baseline gap-2 hover:bg-caos-elevated/50 transition-caos focus-ring",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-caos-md text-caos-text truncate flex-1 min-w-0",
                                    title: r.name,
                                    children: r.name
                                }, void 0, false, {
                                    fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
                                    lineNumber: 96,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "tabular text-caos-xs whitespace-nowrap shrink-0 text-right",
                                    style: {
                                        color
                                    },
                                    children: r.detail || "—"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
                                    lineNumber: 97,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, r.issuer_id, true, {
                            fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
                            lineNumber: 85,
                            columnNumber: 15
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
                    lineNumber: 83,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
                lineNumber: 79,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/command/DailyDigestPanel.tsx",
        lineNumber: 73,
        columnNumber: 5
    }, this);
}
_s(WatchList, "08M+bUh9ExwkG7hFDGSooeDfhms=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerProfileOverlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useIssuerProfileOverlay"]
    ];
});
_c1 = WatchList;
var _c, _c1;
__turbopack_context__.k.register(_c, "DailyDigestPanel");
__turbopack_context__.k.register(_c1, "WatchList");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/engine/usePortfolio.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "usePortfolio",
    ()=>usePortfolio
]);
// Read-only hook: load the cross-issuer portfolio board (each issuer's latest
// complete run, rolled up by GET /api/portfolio). On no backend / any error it
// returns covered=0 with empty rows, so the Command Center keeps its seeded
// sample board ("prefer live, static fallback", same contract as useLiveRun /
// useModelEngine).
//
// REFRESH SEMANTICS (audit 2026-07-10 FE-3): the board is labeled "● LIVE", so
// it must not be a mount-time snapshot — a run completing while the PM keeps
// the page open used to never appear without a manual reload. It now re-fetches
// on an interval (skipping hidden tabs) and on tab re-focus, and exposes
// `fetchedAt` so the panel can print an honest as-of time next to the badge.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
const EMPTY = {
    rows: [],
    issuerCount: 0,
    coveredCount: 0,
    live: false,
    loading: false,
    error: false,
    fetchedAt: null
};
// One minute: fast enough that a completed run appears while the page is open,
// slow enough to be negligible load (one aggregate read per open dashboard).
const REFRESH_MS = 60_000;
function usePortfolio() {
    _s();
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        ...EMPTY,
        loading: true
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "usePortfolio.useEffect": ()=>{
            let alive = true;
            const load = {
                "usePortfolio.useEffect.load": ()=>{
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getPortfolio"])().then({
                        "usePortfolio.useEffect.load": (d)=>{
                            if (!alive) return;
                            setState({
                                rows: d.rows,
                                issuerCount: d.issuer_count,
                                coveredCount: d.covered_count,
                                live: d.covered_count > 0,
                                loading: false,
                                error: false,
                                fetchedAt: new Date()
                            });
                        }
                    }["usePortfolio.useEffect.load"])// no backend → fall back to mock, but log + flag the phase so the
                    // failure is distinguishable from genuine no-data (M-6). Keep the last
                    // good rows on a transient refresh failure — only the very first
                    // failure empties (FE-3).
                    .catch({
                        "usePortfolio.useEffect.load": (err)=>{
                            if (!alive) return;
                            console.warn("usePortfolio: getPortfolio failed, falling back to static board", err);
                            setState({
                                "usePortfolio.useEffect.load": (prev)=>prev.fetchedAt ? {
                                        ...prev,
                                        loading: false,
                                        error: true
                                    } : {
                                        ...EMPTY,
                                        error: true
                                    }
                            }["usePortfolio.useEffect.load"]);
                        }
                    }["usePortfolio.useEffect.load"]);
                }
            }["usePortfolio.useEffect.load"];
            load();
            const tick = setInterval({
                "usePortfolio.useEffect.tick": ()=>{
                    if (document.visibilityState === "visible") load();
                }
            }["usePortfolio.useEffect.tick"], REFRESH_MS);
            const onFocus = {
                "usePortfolio.useEffect.onFocus": ()=>load()
            }["usePortfolio.useEffect.onFocus"];
            window.addEventListener("focus", onFocus);
            return ({
                "usePortfolio.useEffect": ()=>{
                    alive = false;
                    clearInterval(tick);
                    window.removeEventListener("focus", onFocus);
                }
            })["usePortfolio.useEffect"];
        }
    }["usePortfolio.useEffect"], []);
    return state;
}
_s(usePortfolio, "qF3Hbfo5gc091dgsFXM/jKL2Ag0=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/format-date.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fmtLocalDateTime",
    ()=>fmtLocalDateTime,
    "fmtUtcDate",
    ()=>fmtUtcDate,
    "fmtUtcDateTime",
    ()=>fmtUtcDateTime
]);
// Date/time sibling to format.ts. One desk standard so as-of stamps never
// drift by locale: authority/observation timestamps render explicit UTC
// ("2026-07-15 19:27 UTC"), date-only stamps render ISO ("2026-07-15"), and
// only analyst-personal stamps (checkpoint saves, history entries) may render
// viewer-local time — locale-pinned so day/month ordering never varies.
// Invalid/null/empty input renders an em dash, matching format.ts.
function toDate(v) {
    if (v === null || v === undefined || v === "") return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}
const utcDateTime = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
});
const utcDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
});
function fmtUtcDateTime(v) {
    const d = toDate(v);
    if (!d) return "—";
    // en-CA yields "2026-07-15, 19:27"; normalize the separator.
    return utcDateTime.format(d).replace(", ", " ") + " UTC";
}
function fmtUtcDate(v) {
    const d = toDate(v);
    return d ? utcDate.format(d) : "—";
}
function fmtLocalDateTime(v, opts) {
    const d = toDate(v);
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        ...opts?.timeZone ? {
            timeZone: opts.timeZone
        } : {}
    }).format(d);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/engine/useDigest.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useDigest",
    ()=>useDigest
]);
// Read-only hook: load the daily digest (GET /api/digest/daily — coverage
// staleness, WARF over manual ratings, CCC-cliff watch, 24h run activity).
// Fetched once on mount; on no backend / any error it stays null so the
// Command Center keeps its seeded research panels ("prefer live, static
// fallback", same contract as usePortfolio / useLiveRun).
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
function useDigest() {
    _s();
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        digest: null,
        live: false,
        loading: true,
        error: null
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useDigest.useEffect": ()=>{
            let alive = true;
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDigest"])().then({
                "useDigest.useEffect": (d)=>{
                    if (!alive) return;
                    setState({
                        digest: d,
                        live: (d.coverage?.issuers ?? 0) > 0,
                        loading: false,
                        error: null
                    });
                }
            }["useDigest.useEffect"]).catch({
                "useDigest.useEffect": (reason)=>{
                    if (alive) setState({
                        digest: null,
                        live: false,
                        loading: false,
                        error: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toErrorMessage"])(reason, "Daily digest unavailable.")
                    });
                }
            }["useDigest.useEffect"]);
            return ({
                "useDigest.useEffect": ()=>{
                    alive = false;
                }
            })["useDigest.useEffect"];
        }
    }["useDigest.useEffect"], []);
    return state;
}
_s(useDigest, "uEvLhb7VhSRiOdcpKnCn5EUAeak=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/engine/useQaFindings.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useQaFindings",
    ()=>useQaFindings
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
;
const EMPTY = {
    findings: [],
    loading: false,
    error: null,
    loaded: false
};
const REFRESH_MS = 60_000;
function useQaFindings(enabled) {
    _s();
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(enabled ? {
        ...EMPTY,
        loading: true
    } : EMPTY);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useQaFindings.useEffect": ()=>{
            if (!enabled) {
                setState(EMPTY);
                return;
            }
            let alive = true;
            const load = {
                "useQaFindings.useEffect.load": ()=>{
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["api"].get("/api/qa/findings").then({
                        "useQaFindings.useEffect.load": (response)=>{
                            if (alive) setState({
                                findings: response.data,
                                loading: false,
                                error: null,
                                loaded: true
                            });
                        }
                    }["useQaFindings.useEffect.load"]).catch({
                        "useQaFindings.useEffect.load": (reason)=>{
                            if (!alive) return;
                            setState({
                                "useQaFindings.useEffect.load": (previous)=>({
                                        findings: previous.findings,
                                        loading: false,
                                        error: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toErrorMessage"])(reason, "Live CP-5 findings unavailable."),
                                        loaded: true
                                    })
                            }["useQaFindings.useEffect.load"]);
                        }
                    }["useQaFindings.useEffect.load"]);
                }
            }["useQaFindings.useEffect.load"];
            load();
            const tick = setInterval({
                "useQaFindings.useEffect.tick": ()=>{
                    if (document.visibilityState === "visible") load();
                }
            }["useQaFindings.useEffect.tick"], REFRESH_MS);
            window.addEventListener("focus", load);
            return ({
                "useQaFindings.useEffect": ()=>{
                    alive = false;
                    clearInterval(tick);
                    window.removeEventListener("focus", load);
                }
            })["useQaFindings.useEffect"];
        }
    }["useQaFindings.useEffect"], [
        enabled
    ]);
    // `enabled` turns true only after the portfolio request resolves. Without
    // this derived first-load guard, one render could mark the exact queue ready
    // and briefly show coarse gate roll-ups before this effect starts its fetch.
    return enabled && !state.loaded ? {
        ...state,
        loading: true
    } : state;
}
_s(useQaFindings, "2l8cec5H4vTrPLWBWroPpht77qg=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/command/gaps.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Live CP-0 source-gap board — derived from real run gap logs (A-1 mock→engine).
//
// The Command "Source Gaps" board seeds a per-issuer list (data.ts GAPS). This
// derives the same shape from the live portfolio: each issuer's latest run carries
// CP-0's source-readiness gap log (a missing source category → "No X vaulted"),
// surfaced on PortfolioRowDTO.gaps. Falls back to the seed offline so the demo is
// unchanged.
__turbopack_context__.s([
    "liveGaps",
    ()=>liveGaps
]);
const RANK = {
    high: 0,
    medium: 1,
    low: 2
};
const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
];
// Latest run's as-of (ISO, UTC-stamped by the API) → the board's "Mon DD" label.
// UTC parts, not locale, so it matches the seed format and is test-deterministic.
function shortDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")}`;
}
function normSev(sev) {
    return sev === "high" || sev === "medium" || sev === "low" ? sev : "low";
}
function liveGaps(rows) {
    return rows.flatMap((r)=>(r.gaps || []).map((g)=>({
                issuer: r.ticker || r.name,
                doc: g.doc,
                impact: "CP-0 source-readiness gap — downstream modules degrade until vaulted.",
                sev: normSev(g.sev),
                requested: shortDate(r.as_of)
            }))).sort((a, b)=>RANK[a.sev] - RANK[b.sev]);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/command/mixedOrigin.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Live "mixed origin" governance signal — a portfolio row whose bespoke
// Deep-Dive/Report Studio tabs stay the Atlas Forge reference fixture even
// though a real live run is anchored on it (the FE-5 case already honored by
// Deep-Dive's caveat and Report Studio's own on-screen chip). This is the one
// concrete, non-fabricated "one run, two provenances" signal the live
// portfolio can surface today — everything else (fixture-only issuers) is
// REFERENCE end to end and not a mix.
__turbopack_context__.s([
    "liveMixedOrigin",
    ()=>liveMixedOrigin
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/engine/types.ts [app-client] (ecmascript)");
;
function liveMixedOrigin(rows) {
    return rows.filter((r)=>r.issuer_id === __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ATLF_REFERENCE_ISSUER_ID"]).map((r)=>({
            issuer_id: r.issuer_id,
            name: r.ticker || r.name,
            detail: "Bespoke debate/recovery/covenant tabs stay the Atlas Forge reference fixture; other figures reflect this live run."
        }));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/command/qa.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Live CP-5 QA queue. Exact engine findings own the queue; an issuer-level gate
// roll-up is retained only when that exact latest run emitted no finding rows.
__turbopack_context__.s([
    "liveFailedGates",
    ()=>liveFailedGates,
    "liveQaItems",
    ()=>liveQaItems
]);
// CP-5 gate verdict → queue severity. Passed / Not Reviewed / anything cleared is
// not a triage item, so it is excluded (returns undefined).
const GATE_SEV = {
    Blocked: "HIGH",
    Restricted: "MEDIUM"
};
const SEV_ORDER = {
    HIGH: 0,
    MEDIUM: 1,
    LOW: 2
};
const FINDING_SEV = {
    CRITICAL: "HIGH",
    MATERIAL: "MEDIUM",
    MINOR: "LOW"
};
function liveQaItems(rows, findings = []) {
    const exactRunIds = new Set(findings.map((finding)=>finding.run_id));
    const exactIssuerIds = new Set(findings.map((finding)=>finding.issuer_id));
    const exact = findings.map((finding)=>({
            id: finding.finding_id || finding.id.slice(0, 8),
            key: finding.id,
            issuer: finding.ticker || finding.issuer,
            module: finding.module_id || "CP-5",
            sev: FINDING_SEV[finding.severity] || "LOW",
            age: finding.as_of || "—",
            text: finding.required_remediation ? `${finding.description} — remediation: ${finding.required_remediation}` : finding.description
        }));
    const rollups = rows.map((r)=>{
        // The portfolio is an institutional latest-run board, while findings are
        // analyst-private unless desk sharing is enabled. Suppress the coarse row
        // by issuer too, so a newer foreign aggregate cannot duplicate the caller's
        // exact accessible finding for the same credit.
        if (exactRunIds.has(r.run_id) || exactIssuerIds.has(r.issuer_id)) return null;
        const sev = GATE_SEV[r.qa_status];
        if (!sev) return null;
        return {
            id: r.run_id.slice(0, 8),
            key: r.run_id,
            issuer: r.ticker || r.name,
            module: "CP-5",
            sev,
            age: r.as_of || "—",
            text: `CP-5 gate ${r.qa_status} — committee ${r.committee_status}`
        };
    }).filter((x)=>x !== null);
    return [
        ...exact,
        ...rollups
    ].sort((a, b)=>SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
}
// A distinct, non-overlapping gate-failure tier: the CP-5 severity gate itself
// PASSED, but engine/gate.py's fail-closed committee_status_from still refuses
// committee readiness (low confidence, or an unrecognized/partial status the
// default degrades). liveQaItems already owns Blocked/Restricted — this only
// catches the rows that gate would silently miss, so a genuinely separate
// "Failed Gates" governance category never double-counts a row liveQaItems
// already lists.
const COMMITTEE_ONLY_SEV = {
    "Draft Only": "MEDIUM",
    "Insufficient Information": "LOW"
};
function liveFailedGates(rows) {
    return rows.map((r)=>{
        if (GATE_SEV[r.qa_status]) return null; // already a liveQaItems row
        const sev = COMMITTEE_ONLY_SEV[r.committee_status];
        if (!sev) return null;
        return {
            id: r.run_id.slice(0, 8),
            issuer: r.ticker || r.name,
            module: "CP-5",
            sev,
            age: r.as_of || "—",
            text: `CP-5 gate ${r.qa_status} but committee status is "${r.committee_status}" — not committee-ready`
        };
    }).filter((x)=>x !== null).sort((a, b)=>SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/command/useGovernanceSources.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useGovernanceSources",
    ()=>useGovernanceSources
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useDigest$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/engine/useDigest.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useQaFindings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/engine/useQaFindings.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$command$2f$gaps$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/command/gaps.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$command$2f$mixedOrigin$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/command/mixedOrigin.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$command$2f$qa$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/command/qa.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
function useGovernanceSources(portfolio) {
    _s();
    const digestState = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useDigest$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDigest"])();
    const findingsState = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useQaFindings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQaFindings"])(portfolio.live);
    if (!portfolio.live) {
        // Two different "no live queues" states, never conflated (mock↔live seam
        // policy): a reachable backend with zero completed runs is an OBSERVED
        // empty — the queues exist and are genuinely clear-by-vacancy, so they
        // report as [] (renders as honest zeros + a "first run populates this"
        // affordance). A failed/loading portfolio read is UNKNOWN — undefined,
        // which consumers render as "Unavailable".
        const observedEmpty = !portfolio.loading && !portfolio.error;
        return {
            ...digestState,
            liveQa: observedEmpty ? [] : undefined,
            liveFailed: observedEmpty ? [] : undefined,
            liveGapsItems: observedEmpty ? [] : undefined,
            liveMixed: observedEmpty ? [] : undefined,
            qaFindingsLoading: false,
            qaFindingsError: null
        };
    }
    return {
        ...digestState,
        liveQa: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$command$2f$qa$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["liveQaItems"])(portfolio.rows, findingsState.findings),
        liveFailed: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$command$2f$qa$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["liveFailedGates"])(portfolio.rows),
        liveGapsItems: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$command$2f$gaps$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["liveGaps"])(portfolio.rows),
        liveMixed: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$command$2f$mixedOrigin$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["liveMixedOrigin"])(portfolio.rows),
        qaFindingsLoading: findingsState.loading,
        qaFindingsError: findingsState.error
    };
}
_s(useGovernanceSources, "43I6Uvedxejh4SadtFuUyeN551s=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useDigest$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDigest"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useQaFindings$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQaFindings"]
    ];
});
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
"[project]/src/components/command/CommandPortfolio.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CommandPortfolioPosture",
    ()=>CommandPortfolioPosture,
    "CommandPortfolioTable",
    ()=>CommandPortfolioTable,
    "CommandPositionStrip",
    ()=>CommandPositionStrip
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/CloseButton.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerLink$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/IssuerLink.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingFocus$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/useRovingFocus.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rowActionMode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/rowActionMode.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$row$2d$action$2d$keyboard$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/row-action-keyboard.ts [app-client] (ecmascript)");
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
const POSTURE_ORDER = [
    "OVERWEIGHT",
    "NEUTRAL",
    "UNDERWEIGHT",
    "UNKNOWN"
];
const POSTURE_COLOR = {
    OVERWEIGHT: "var(--caos-success)",
    NEUTRAL: "var(--caos-muted)",
    UNDERWEIGHT: "var(--caos-critical)",
    UNKNOWN: "var(--caos-idle)"
};
const fmtMoney = (value)=>typeof value === "number" && Number.isFinite(value) ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1
    }).format(value) : "—";
const fmtNumber = (value, suffix = "")=>typeof value === "number" && Number.isFinite(value) ? `${value.toLocaleString("en-US", {
        maximumFractionDigits: 1
    })}${suffix}` : "—";
function CommandPortfolioPosture({ counts, total, portfolioName }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        "aria-label": `${portfolioName} portfolio posture`,
        className: "shrink-0 rounded-md border border-caos-border bg-caos-panel px-3 py-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-wrap items-center gap-x-4 gap-y-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs font-semibold uppercase tracking-wider text-caos-text",
                        children: [
                            "Portfolio posture · ",
                            total,
                            " positions"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                        lineNumber: 59,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex h-2.5 min-w-32 flex-1 overflow-hidden rounded border border-caos-border/60 bg-caos-bg",
                        role: "img",
                        "aria-label": POSTURE_ORDER.map((posture)=>`${posture} ${counts[posture] ?? 0}`).join(", "),
                        children: POSTURE_ORDER.map((posture)=>{
                            const count = counts[posture] ?? 0;
                            return count > 0 && total > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                title: `${posture} · ${count}`,
                                style: {
                                    width: `${count / total * 100}%`,
                                    background: POSTURE_COLOR[posture]
                                }
                            }, posture, false, {
                                fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                lineNumber: 70,
                                columnNumber: 15
                            }, this) : null;
                        })
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                        lineNumber: 62,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                        className: "flex flex-wrap items-center gap-3",
                        children: POSTURE_ORDER.map((posture)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-1.5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                        className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                                        children: posture
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                        lineNumber: 81,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                        className: "tabular text-caos-md font-semibold",
                                        style: {
                                            color: POSTURE_COLOR[posture]
                                        },
                                        children: counts[posture] ?? 0
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                        lineNumber: 84,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, posture, true, {
                                fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                lineNumber: 80,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                        lineNumber: 78,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                lineNumber: 58,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-1 text-caos-xs text-caos-muted",
                children: "CP-3 posture uses only completed runs explicitly bound to this portfolio. Unlinked positions remain UNKNOWN."
            }, void 0, false, {
                fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                lineNumber: 91,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/command/CommandPortfolio.tsx",
        lineNumber: 54,
        columnNumber: 5
    }, this);
}
_c = CommandPortfolioPosture;
const COLS = "grid grid-cols-[72px_minmax(190px,1.35fr)_minmax(180px,1.2fr)_92px_64px_72px_90px_80px_110px_86px] gap-2 items-center";
function CommandPortfolioTable({ positions, selected, onSelect }) {
    _s();
    const headers = [
        "Ticker",
        "Company",
        "Instrument",
        "Size",
        "Price",
        "Margin",
        "Maturity",
        "Ratings",
        "Posture",
        "QA"
    ];
    const [actionRowId, setActionRowId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const rowRefs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(new Map());
    const rowIds = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CommandPortfolioTable.useMemo[rowIds]": ()=>positions.map({
                "CommandPortfolioTable.useMemo[rowIds]": (position)=>position.id
            }["CommandPortfolioTable.useMemo[rowIds]"])
    }["CommandPortfolioTable.useMemo[rowIds]"], [
        positions
    ]);
    const { getItemProps: getRowFocusProps, setActiveId: setActiveRowId } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingFocus$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRovingFocus"])(rowIds);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CommandPortfolioTable.useEffect": ()=>{
            if (selected && rowIds.includes(selected)) setActiveRowId(selected);
        }
    }["CommandPortfolioTable.useEffect"], [
        rowIds,
        selected,
        setActiveRowId
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CommandPortfolioTable.useEffect": ()=>{
            if (actionRowId && !rowIds.includes(actionRowId)) setActionRowId(null);
            for (const [id, row] of rowRefs.current)(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rowActionMode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["syncRowActionTabStops"])(row, actionRowId === id);
        }
    }["CommandPortfolioTable.useEffect"], [
        actionRowId,
        rowIds
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                id: "command-portfolio-grid-help",
                className: "sr-only",
                children: "Use Up and Down Arrow to move between position rows. Press Enter or Space to open row details. Press F2 to enter row actions; press Escape to return to the row."
            }, void 0, false, {
                fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                lineNumber: 126,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                role: "grid",
                "aria-label": "Persisted portfolio positions",
                "aria-rowcount": positions.length + 1,
                className: "h-full min-h-0 overflow-auto text-caos-md",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "min-w-[1120px]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            role: "row",
                            "aria-rowindex": 1,
                            className: `${COLS} sticky top-0 z-20 h-8 border-b border-caos-border bg-caos-panel px-3`,
                            children: headers.map((header, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    role: "columnheader",
                                    className: `tabular text-caos-xs font-semibold uppercase tracking-wider text-caos-text ${[
                                        3,
                                        4,
                                        5
                                    ].includes(index) ? "text-right" : ""}`,
                                    children: header
                                }, header, false, {
                                    fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                    lineNumber: 133,
                                    columnNumber: 13
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                            lineNumber: 131,
                            columnNumber: 9
                        }, this),
                        positions.map((position, index)=>{
                            const isSelected = selected === position.id;
                            const activate = ()=>onSelect(position.id);
                            const focusProps = getRowFocusProps(position.id);
                            const issuer = position.issuer_id ? {
                                id: position.issuer_id
                            } : null;
                            const rating = [
                                position.rating_moody,
                                position.rating_sp
                            ].filter(Boolean).join(" / ") || "—";
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                role: "row",
                                ref: (element)=>{
                                    focusProps.ref(element);
                                    if (element) {
                                        rowRefs.current.set(position.id, element);
                                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rowActionMode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["syncRowActionTabStops"])(element, actionRowId === position.id);
                                    } else rowRefs.current.delete(position.id);
                                },
                                tabIndex: actionRowId === position.id ? -1 : focusProps.tabIndex,
                                onFocus: focusProps.onFocus,
                                onBlur: (event)=>{
                                    if (actionRowId === position.id && !event.currentTarget.contains(event.relatedTarget)) setActionRowId(null);
                                },
                                "aria-selected": isSelected,
                                "aria-rowindex": index + 2,
                                "aria-keyshortcuts": "F2",
                                "aria-describedby": "command-portfolio-grid-help",
                                "aria-label": `${position.borrower_name} position details`,
                                onClick: (event)=>{
                                    const target = event.target;
                                    if (target.closest("a, button, input, select, textarea, [role='button'], [role='link']")) return;
                                    activate();
                                },
                                onKeyDown: (event)=>{
                                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$row$2d$action$2d$keyboard$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["handleRovingActionRowKeyDown"])(event, position.id, actionRowId, setActionRowId, focusProps.onKeyDown, activate);
                                },
                                className: `${COLS} cursor-pointer border-b border-caos-border/50 px-3 py-1.5 outline-none transition-caos focus-ring [content-visibility:auto] [contain-intrinsic-size:auto_36px] ${isSelected ? "bg-caos-accent/10" : "hover:bg-caos-elevated/50"}`,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        role: "gridcell",
                                        className: "tabular text-caos-accent",
                                        children: issuer && position.ticker ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerLink$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["IssuerLink"], {
                                            issuer: issuer,
                                            children: position.ticker
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                            lineNumber: 180,
                                            columnNumber: 46
                                        }, this) : position.ticker || "—"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                        lineNumber: 179,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        role: "rowheader",
                                        className: "min-w-0 break-words leading-snug text-caos-text",
                                        children: issuer ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerLink$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["IssuerLink"], {
                                            issuer: issuer,
                                            children: position.borrower_name
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                            lineNumber: 183,
                                            columnNumber: 27
                                        }, this) : position.borrower_name
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                        lineNumber: 182,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        role: "gridcell",
                                        className: "min-w-0 break-words leading-snug text-caos-text",
                                        title: position.loan_name || undefined,
                                        children: position.loan_name || position.ranking || "—"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                        lineNumber: 185,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        role: "gridcell",
                                        className: "tabular text-right text-caos-text",
                                        children: fmtMoney(position.par_usd)
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                        lineNumber: 188,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        role: "gridcell",
                                        className: "tabular text-right text-caos-text",
                                        children: fmtNumber(position.price)
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                        lineNumber: 189,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        role: "gridcell",
                                        className: "tabular text-right text-caos-text",
                                        children: fmtNumber(position.margin_bps, "bp")
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                        lineNumber: 190,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        role: "gridcell",
                                        className: "tabular text-caos-muted",
                                        children: position.maturity || "—"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                        lineNumber: 191,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        role: "gridcell",
                                        className: "tabular text-caos-muted",
                                        children: rating
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                        lineNumber: 192,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        role: "gridcell",
                                        className: "tabular text-caos-xs font-medium",
                                        style: {
                                            color: POSTURE_COLOR[position.posture]
                                        },
                                        children: position.posture
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                        lineNumber: 193,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        role: "gridcell",
                                        className: "tabular text-caos-xs text-caos-muted",
                                        children: position.qa_status || "UNRATED"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                        lineNumber: 196,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, position.id, true, {
                                fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                                lineNumber: 149,
                                columnNumber: 13
                            }, this);
                        })
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                    lineNumber: 130,
                    columnNumber: 7
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                lineNumber: 129,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true);
}
_s(CommandPortfolioTable, "grcyb4DJtKV/dqWha/SQTWU+w8M=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingFocus$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRovingFocus"]
    ];
});
_c1 = CommandPortfolioTable;
function CommandPositionStrip({ position, onClose }) {
    const issuer = position.issuer_id ? {
        id: position.issuer_id
    } : null;
    const rating = [
        position.rating_moody,
        position.rating_sp
    ].filter(Boolean).join(" / ") || "—";
    const governance = [
        position.qa_status || "UNRATED",
        position.committee_status
    ].filter(Boolean).join(" · ");
    const stat = (label, value)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "flex flex-col items-start",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                    children: label
                }, void 0, false, {
                    fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                    lineNumber: 218,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "tabular text-caos-xl text-caos-text",
                    children: value
                }, void 0, false, {
                    fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                    lineNumber: 219,
                    columnNumber: 7
                }, this)
            ]
        }, label, true, {
            fileName: "[project]/src/components/command/CommandPortfolio.tsx",
            lineNumber: 217,
            columnNumber: 5
        }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "caos-enter flex min-h-12 shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-t border-caos-border bg-caos-panel px-4 py-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "flex min-w-0 items-center gap-2",
                children: issuer ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerLink$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["IssuerLink"], {
                            issuer: issuer,
                            className: "tabular text-caos-xl text-caos-accent",
                            children: position.ticker || "—"
                        }, void 0, false, {
                            fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                            lineNumber: 227,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerLink$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["IssuerLink"], {
                            issuer: issuer,
                            className: "text-caos-xl font-medium text-caos-text",
                            children: position.borrower_name
                        }, void 0, false, {
                            fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                            lineNumber: 228,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "tabular text-caos-xl text-caos-muted",
                            children: position.ticker || "—"
                        }, void 0, false, {
                            fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                            lineNumber: 231,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-caos-xl font-medium text-caos-text",
                            children: position.borrower_name
                        }, void 0, false, {
                            fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                            lineNumber: 231,
                            columnNumber: 99
                        }, this)
                    ]
                }, void 0, true)
            }, void 0, false, {
                fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                lineNumber: 224,
                columnNumber: 7
            }, this),
            stat("Instrument", position.loan_name || position.ranking || "—"),
            stat("Size", fmtMoney(position.par_usd)),
            stat("Price", fmtNumber(position.price)),
            stat("Margin", fmtNumber(position.margin_bps, "bp")),
            stat("Maturity", position.maturity || "—"),
            stat("Ratings", rating),
            stat("Posture", position.posture),
            stat("QA", governance),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "flex-1"
            }, void 0, false, {
                fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                lineNumber: 242,
                columnNumber: 7
            }, this),
            position.issuer_id && position.run_id ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                href: `/deepdive?issuer=${encodeURIComponent(position.issuer_id)}&run=${encodeURIComponent(position.run_id)}`,
                className: "caos-action-secondary no-underline focus-ring",
                children: "Open Deep-Dive"
            }, void 0, false, {
                fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                lineNumber: 244,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-caos-xs text-caos-muted",
                children: "Deep-Dive authority unavailable"
            }, void 0, false, {
                fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                lineNumber: 247,
                columnNumber: 11
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CloseButton"], {
                onClick: onClose,
                title: "Close (Esc)"
            }, void 0, false, {
                fileName: "[project]/src/components/command/CommandPortfolio.tsx",
                lineNumber: 248,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/command/CommandPortfolio.tsx",
        lineNumber: 223,
        columnNumber: 5
    }, this);
}
_c2 = CommandPositionStrip;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "CommandPortfolioPosture");
__turbopack_context__.k.register(_c1, "CommandPortfolioTable");
__turbopack_context__.k.register(_c2, "CommandPositionStrip");
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
"[project]/src/lib/engine/useAutonomyDraft.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAutonomyDraft",
    ()=>useAutonomyDraft
]);
// The initial analyst load requests a stale/missing refresh through the guarded
// POST, then polls with read-only GET only while the server reports `refreshing`
// (a cycle is actively
// running) — never on a fixed interval forever, so Command + Monitor open
// together don't double-poll a settled draft (the server single-flights the
// enqueue regardless, but a polite client still shouldn't hammer it).
//
// Distinguishes two states an autonomy consumer must never conflate
// (mock-vs-live seam): OFFLINE (the endpoint itself is unreachable — network
// error, 5xx after retries never happen here since the route is fault-
// isolated and always returns 200, so `error` really means "couldn't reach
// the server at all") vs EMPTY-LIVE (the endpoint answered, the draft is
// simply empty — first cycle still running, or genuinely nothing to report).
// Callers must show a DEMO fallback only for the former, and an honest "no
// changes yet" for the latter — never render one as the other.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
const POLL_MS = 4000;
function useAutonomyDraft() {
    _s();
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        draft: null,
        loading: true,
        offline: false
    });
    const timerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useAutonomyDraft.useEffect": ()=>{
            let alive = true;
            const load = {
                "useAutonomyDraft.useEffect.load": (refresh = false)=>{
                    // A read-only viewer cannot initiate a refresh. Fall back to GET so the
                    // latest available draft remains visible without treating 403 as offline.
                    const request = refresh ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAutonomyDraft"])(true).catch({
                        "useAutonomyDraft.useEffect.load": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAutonomyDraft"])()
                    }["useAutonomyDraft.useEffect.load"]) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAutonomyDraft"])();
                    request.then({
                        "useAutonomyDraft.useEffect.load": (d)=>{
                            if (!alive) return;
                            setState({
                                draft: d,
                                loading: false,
                                offline: false
                            });
                            if (timerRef.current) clearTimeout(timerRef.current);
                            if (d.refreshing) {
                                timerRef.current = setTimeout({
                                    "useAutonomyDraft.useEffect.load": ()=>load(false)
                                }["useAutonomyDraft.useEffect.load"], POLL_MS);
                            }
                        }
                    }["useAutonomyDraft.useEffect.load"]).catch({
                        "useAutonomyDraft.useEffect.load": (err)=>{
                            if (!alive) return;
                            console.warn("useAutonomyDraft: getAutonomyDraft failed — endpoint unreachable", err);
                            setState({
                                draft: null,
                                loading: false,
                                offline: true
                            });
                        }
                    }["useAutonomyDraft.useEffect.load"]);
                }
            }["useAutonomyDraft.useEffect.load"];
            load(true);
            return ({
                "useAutonomyDraft.useEffect": ()=>{
                    alive = false;
                    if (timerRef.current) clearTimeout(timerRef.current);
                }
            })["useAutonomyDraft.useEffect"];
        }
    }["useAutonomyDraft.useEffect"], []);
    return state;
}
_s(useAutonomyDraft, "E30rsr3I1qEZTFC9CozBqlpBiXg=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/alerts/inbox.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Pure draft→AlertRow derivation — the SINGLE shared source for both
// Command's ranked-changes opener and Monitor's alert inbox, so the two
// surfaces can never disagree about what an alert says (P2-WP-1/2/3).
//
// alert_key mirrors the server's stated contract (run:issuer:kind:metric) —
// the draft has no explicit run id, so `generated_at` stands in for the cycle
// identifier: it is stable across repeated GETs of the same completed cycle
// and changes only when a new cycle completes, which is exactly the
// "cycle-scoped" property the server design relies on (a later cycle
// re-firing the same anomaly gets a genuinely new key, per WP-0).
__turbopack_context__.s([
    "draftToAlertRows",
    ()=>draftToAlertRows,
    "formatImpact",
    ()=>formatImpact,
    "requiredActionFor",
    ()=>requiredActionFor,
    "rowProvenance",
    ()=>rowProvenance
]);
function bulletEvent(b) {
    const dir = b.direction ? ` ${b.direction}` : "";
    const metric = b.metric ? ` ${b.metric}` : "";
    return `${b.kind}${metric}${dir}`.trim();
}
function rowsForSection(section, sinceWhen) {
    const claimRows = section.claims.map((c)=>({
            key: `${sinceWhen ?? "unknown"}:${section.issuer_id ?? "_unknown"}:${c.anomaly_kind}:claim`,
            issuerId: section.issuer_id,
            issuerName: section.issuer_name,
            event: c.text,
            reason: c.anomaly_kind,
            metric: null,
            severity: c.anomaly_severity,
            method: "MODELLED",
            evidence: {
                chunkIds: c.chunk_ids,
                factIds: c.fact_ids
            },
            sinceWhen
        }));
    const bulletRows = section.deterministic_bullets.map((b)=>({
            key: `${sinceWhen ?? "unknown"}:${section.issuer_id ?? "_unknown"}:${b.kind}:${b.metric ?? "bullet"}`,
            issuerId: section.issuer_id,
            issuerName: section.issuer_name,
            event: bulletEvent(b),
            reason: b.direction ? `${b.kind} · ${b.direction}` : b.kind,
            metric: b.metric,
            severity: b.severity,
            method: "DERIVED",
            evidence: {
                chunkIds: b.chunk_id ? [
                    b.chunk_id
                ] : [],
                factIds: []
            },
            sinceWhen
        }));
    return [
        ...claimRows,
        ...bulletRows
    ];
}
function draftToAlertRows(draft) {
    const sinceWhen = draft.generated_at ?? null;
    const rows = draft.sections.flatMap((s)=>rowsForSection(s, sinceWhen));
    return rows.sort((a, b)=>b.severity - a.severity);
}
// Deterministic anomaly-kind → suggested next step. A fixed, honest mapping —
// never an LLM call — so "required action" never blocks on a model lane.
const REQUIRED_ACTION = {
    "cusum-shift": "review trend model",
    "ts-jump": "review timing shift",
    "peer-outlier": "compare to peers"
};
function requiredActionFor(row) {
    const kind = row.reason.split(" · ")[0];
    return REQUIRED_ACTION[kind] ?? "review finding";
}
function formatImpact(row) {
    return Number.isFinite(row.severity) ? `${row.severity.toFixed(1)}σ` : null;
}
function rowProvenance(row) {
    return {
        origin: "LIVE",
        method: row.method
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/command/RankedChanges.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RankedChanges",
    ()=>RankedChanges,
    "RankedChangesView",
    ()=>RankedChangesView
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// Command's opener: the ranked-changes list from the live autonomy draft
// (Watchtower). Each row: what changed / why (reason) / owner / required
// action / Open (Deep-Dive) / Ack. Severity-only ranking, disclosed via a
// basis chip — PortfolioRowDTO carries no position size, so par-weighting is
// never fabricated (P2 backend investigation finding #5). Offline vs
// empty-live are rendered as distinctly different, honest states — neither
// is ever shown as the other, and neither ever substitutes a fabricated
// demo list (this is a wholly new surface; there is no seeded fixture to
// fall back to).
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerLink$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/IssuerLink.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ConclusionAuthority$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ConclusionAuthority.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/SurfaceState.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ActionReason.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useAutonomyDraft$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/engine/useAutonomyDraft.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$alerts$2f$inbox$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/alerts/inbox.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
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
;
function issuerHref(row) {
    return row.issuerId ? `/deepdive?issuer=${encodeURIComponent(row.issuerId)}` : null;
}
const acknowledgementPresentation = (acknowledging, resolved, acknowledged)=>{
    if (acknowledging) return {
        reason: "Saving acknowledgement…",
        label: "Acknowledging…"
    };
    if (resolved) return {
        reason: "Resolved on Monitor — this row is closed",
        label: "Resolved"
    };
    if (acknowledged) return {
        reason: "Already acknowledged",
        label: "Acked"
    };
    return {
        reason: null,
        label: "Ack"
    };
};
function RankedChangeRow({ row, state, ackError, acknowledging, onAck }) {
    const acknowledged = state?.state === "ack";
    const resolved = state?.state === "resolved";
    const impact = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$alerts$2f$inbox$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatImpact"])(row);
    const acknowledgement = acknowledgementPresentation(acknowledging, resolved, acknowledged);
    const deepDiveHref = issuerHref(row);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "px-3 py-[6px] border-b border-caos-border/50",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ConclusionAuthority$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConclusionAuthority"], {
                        prov: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$alerts$2f$inbox$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["rowProvenance"])(row)
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/RankedChanges.tsx",
                        lineNumber: 59,
                        columnNumber: 9
                    }, this),
                    impact ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs uppercase tracking-wider px-1.5 py-px rounded border whitespace-nowrap",
                        title: "Anomaly severity — standard deviations from the baseline/peer median, never a fabricated bp figure",
                        style: {
                            color: "var(--caos-muted)",
                            borderColor: "var(--caos-border)"
                        },
                        children: impact
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/RankedChanges.tsx",
                        lineNumber: 61,
                        columnNumber: 11
                    }, this) : null,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerLink$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["IssuerLink"], {
                        query: row.issuerName,
                        title: `Open ${row.issuerName} profile`,
                        className: "tabular text-caos-md text-caos-accent hover:text-caos-text transition-caos focus-ring rounded px-0.5 outline-none",
                        children: row.issuerName
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/RankedChanges.tsx",
                        lineNumber: 69,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs text-caos-muted ml-auto",
                        children: resolved ? "resolved" : state?.assignee || "unassigned"
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/RankedChanges.tsx",
                        lineNumber: 76,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/command/RankedChanges.tsx",
                lineNumber: 58,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-caos-md text-caos-text leading-snug mt-1",
                children: row.event
            }, void 0, false, {
                fileName: "[project]/src/components/command/RankedChanges.tsx",
                lineNumber: 80,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-2 mt-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs text-caos-muted",
                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$alerts$2f$inbox$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["requiredActionFor"])(row)
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/RankedChanges.tsx",
                        lineNumber: 82,
                        columnNumber: 9
                    }, this),
                    deepDiveHref ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        href: deepDiveHref,
                        title: `Open ${row.issuerName} in Deep-Dive`,
                        className: "no-underline tabular text-caos-xs text-caos-accent hover:text-caos-text border border-caos-border/70 hover:border-caos-accent/60 rounded px-1.5 min-h-8 flex items-center transition-caos focus-ring outline-none caos-target",
                        children: "Open →"
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/RankedChanges.tsx",
                        lineNumber: 84,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs text-caos-muted",
                        children: "Issuer authority unavailable"
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/RankedChanges.tsx",
                        lineNumber: 91,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ActionReason"], {
                        type: "button",
                        reason: acknowledgement.reason,
                        onClick: ()=>onAck(row.key),
                        className: "tabular text-caos-xs px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring aria-disabled:opacity-50 caos-target",
                        children: acknowledgement.label
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/RankedChanges.tsx",
                        lineNumber: 92,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/command/RankedChanges.tsx",
                lineNumber: 81,
                columnNumber: 7
            }, this),
            ackError ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-1 text-caos-2xs text-caos-critical",
                role: "alert",
                children: [
                    ackError,
                    " Retry acknowledgement for this unchanged alert."
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/command/RankedChanges.tsx",
                lineNumber: 101,
                columnNumber: 19
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/command/RankedChanges.tsx",
        lineNumber: 57,
        columnNumber: 5
    }, this);
}
_c = RankedChangeRow;
function RankedChanges() {
    _s();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RankedChangesView, {
        state: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useAutonomyDraft$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAutonomyDraft"])()
    }, void 0, false, {
        fileName: "[project]/src/components/command/RankedChanges.tsx",
        lineNumber: 111,
        columnNumber: 10
    }, this);
}
_s(RankedChanges, "ItoWa2hHVVV3D3Je41LCCKKrH7I=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useAutonomyDraft$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAutonomyDraft"]
    ];
});
_c1 = RankedChanges;
function RankedChangesView({ state, limit = null }) {
    _s1();
    const { draft, loading, offline } = state;
    const [states, setStates] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(new Map());
    const [ackPending, setAckPending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [ackErrors, setAckErrors] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(new Map());
    const allRows = draft ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$alerts$2f$inbox$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["draftToAlertRows"])(draft) : [];
    const rows = limit && limit > 0 ? allRows.slice(0, limit) : allRows;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "RankedChangesView.useEffect": ()=>{
            if (rows.length === 0) return;
            let alive = true;
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAlertStates"])().then({
                "RankedChangesView.useEffect": (list)=>{
                    if (!alive) return;
                    setStates(new Map(list.map({
                        "RankedChangesView.useEffect": (s)=>[
                                s.alert_key,
                                s
                            ]
                    }["RankedChangesView.useEffect"])));
                }
            }["RankedChangesView.useEffect"]).catch({
                "RankedChangesView.useEffect": ()=>{
                // Ack/assign state is enrichment, not load-bearing — an unreachable
                // alerts route just means every row shows as unassigned/open.
                }
            }["RankedChangesView.useEffect"]);
            return ({
                "RankedChangesView.useEffect": ()=>{
                    alive = false;
                }
            })["RankedChangesView.useEffect"];
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }
    }["RankedChangesView.useEffect"], [
        draft?.generated_at
    ]);
    const ack = (key)=>{
        if (ackPending) return;
        setAckPending(key);
        setAckErrors((errors)=>{
            const next = new Map(errors);
            next.delete(key);
            return next;
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setAlertState"])(key, "ack").then((row)=>{
            setStates((m)=>new Map(m).set(key, row));
        }).catch((reason)=>{
            setAckErrors((errors)=>new Map(errors).set(key, (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toErrorMessage"])(reason, "Acknowledgement could not be saved.")));
        }).finally(()=>setAckPending(null));
    };
    if (loading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
            kind: "loading",
            title: "Loading ranked changes",
            compact: true,
            className: "m-2"
        }, void 0, false, {
            fileName: "[project]/src/components/command/RankedChanges.tsx",
            lineNumber: 157,
            columnNumber: 12
        }, this);
    }
    if (offline) {
        // Was labeled origin: "DEMO" — DEMO means seeded/illustrative, and this
        // is the opposite fact (a live service is genuinely unreachable).
        // SurfaceState's "offline" kind exists precisely for this.
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
            kind: "offline",
            title: "Autonomy engine unreachable",
            detail: "No draft data to show.",
            compact: true,
            className: "m-2"
        }, void 0, false, {
            fileName: "[project]/src/components/command/RankedChanges.tsx",
            lineNumber: 164,
            columnNumber: 12
        }, this);
    }
    if (rows.length === 0) {
        const cycling = draft?.refreshing;
        // approval={null} equivalent: an empty board has no conclusion to be
        // unratified — SurfaceState's "empty" kind already conveys "a real check
        // ran and genuinely found nothing", so no separate provenance chip is
        // needed here.
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
            kind: "empty",
            title: cycling ? "cycle running — no changes yet" : "no ranked changes to report",
            detail: draft?.marking ?? undefined,
            compact: true,
            className: "m-2"
        }, void 0, false, {
            fileName: "[project]/src/components/command/RankedChanges.tsx",
            lineNumber: 174,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-3 py-1.5 flex items-center gap-2 border-b border-caos-border/50",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs uppercase tracking-widest text-caos-muted",
                        title: "PortfolioRowDTO carries no position size — ranking never fabricates par-weighting.",
                        children: "Ranked by severity — holdings not loaded"
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/RankedChanges.tsx",
                        lineNumber: 187,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs text-caos-muted ml-auto",
                        children: draft?.marking
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/RankedChanges.tsx",
                        lineNumber: 193,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/command/RankedChanges.tsx",
                lineNumber: 186,
                columnNumber: 7
            }, this),
            rows.length < allRows.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "px-3 py-1.5 border-b border-caos-border/50 tabular text-caos-2xs text-caos-muted",
                children: [
                    "Showing ",
                    rows.length,
                    " of ",
                    allRows.length,
                    " ranked changes"
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/command/RankedChanges.tsx",
                lineNumber: 196,
                columnNumber: 9
            }, this) : null,
            rows.map((row)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RankedChangeRow, {
                    row: row,
                    state: states.get(row.key),
                    ackError: ackErrors.get(row.key),
                    acknowledging: ackPending === row.key,
                    onAck: ack
                }, row.key, false, {
                    fileName: "[project]/src/components/command/RankedChanges.tsx",
                    lineNumber: 201,
                    columnNumber: 9
                }, this))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/command/RankedChanges.tsx",
        lineNumber: 185,
        columnNumber: 5
    }, this);
}
_s1(RankedChangesView, "aLIv3cwXsciC1GlaE50dKFspnOc=");
_c2 = RankedChangesView;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "RankedChangeRow");
__turbopack_context__.k.register(_c1, "RankedChanges");
__turbopack_context__.k.register(_c2, "RankedChangesView");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/WorkbenchToolbar.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WorkbenchToolbar",
    ()=>WorkbenchToolbar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ActionReason.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/Button.tsx [app-client] (ecmascript)");
"use client";
;
;
;
/** Turns the boolean `disabled` flag callers pass into the aria-disabled
 * contract's required reason string, preferring the caller-supplied
 * explanation and otherwise stating the guard condition literally. */ function inertReason(action) {
    if (!action.disabled) return null;
    return action.disabledReason ?? `${action.label} is unavailable`;
}
function WorkbenchToolbar({ title, description, count, viewLabel, search, filters, actions = [] }) {
    const visible = actions.slice(0, 5);
    const overflow = actions.slice(5);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "caos-workbench-toolbar",
        "aria-label": `${title} controls`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "caos-workbench-heading min-w-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap items-baseline gap-x-2 gap-y-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "caos-workbench-title font-mono font-semibold text-caos-text",
                                children: title
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/WorkbenchToolbar.tsx",
                                lineNumber: 50,
                                columnNumber: 11
                            }, this),
                            viewLabel ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-accent",
                                children: viewLabel
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/WorkbenchToolbar.tsx",
                                lineNumber: 51,
                                columnNumber: 24
                            }, this) : null,
                            count ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "tabular text-caos-xs text-caos-muted",
                                children: count
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/WorkbenchToolbar.tsx",
                                lineNumber: 52,
                                columnNumber: 20
                            }, this) : null
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/shared/WorkbenchToolbar.tsx",
                        lineNumber: 49,
                        columnNumber: 9
                    }, this),
                    description ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "caos-workbench-description mt-1 text-caos-md leading-relaxed text-caos-muted",
                        children: description
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/WorkbenchToolbar.tsx",
                        lineNumber: 54,
                        columnNumber: 24
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/WorkbenchToolbar.tsx",
                lineNumber: 48,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "caos-workbench-controls",
                children: [
                    search,
                    filters,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        role: "toolbar",
                        "aria-label": `${title} actions`,
                        className: "caos-workbench-actions flex items-center gap-1.5 shrink-0",
                        children: [
                            visible.map((action)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    variant: action.primary ? "primary" : "secondary",
                                    onClick: action.onClick,
                                    reason: inertReason(action),
                                    children: action.label
                                }, action.id, false, {
                                    fileName: "[project]/src/components/shared/WorkbenchToolbar.tsx",
                                    lineNumber: 61,
                                    columnNumber: 13
                                }, this)),
                            overflow.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                                className: "relative",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                                        className: "caos-action-secondary focus-ring cursor-pointer list-none",
                                        "aria-label": `${title}: more actions`,
                                        children: "More actions"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/shared/WorkbenchToolbar.tsx",
                                        lineNumber: 72,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "absolute right-0 top-[calc(100%+4px)] z-overlay min-w-44 rounded-md border border-caos-border bg-caos-panel p-1 shadow-pop",
                                        children: overflow.map((action)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ActionReason"], {
                                                onClick: action.onClick,
                                                reason: inertReason(action),
                                                className: "w-full min-h-8 px-2 text-left tabular text-caos-xs text-caos-muted hover:bg-caos-elevated hover:text-caos-text rounded-sm focus-ring aria-disabled:opacity-40",
                                                children: action.label
                                            }, action.id, false, {
                                                fileName: "[project]/src/components/shared/WorkbenchToolbar.tsx",
                                                lineNumber: 75,
                                                columnNumber: 19
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/shared/WorkbenchToolbar.tsx",
                                        lineNumber: 73,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/shared/WorkbenchToolbar.tsx",
                                lineNumber: 71,
                                columnNumber: 13
                            }, this) : null
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/shared/WorkbenchToolbar.tsx",
                        lineNumber: 59,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/WorkbenchToolbar.tsx",
                lineNumber: 56,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/WorkbenchToolbar.tsx",
        lineNumber: 47,
        columnNumber: 5
    }, this);
}
_c = WorkbenchToolbar;
var _c;
__turbopack_context__.k.register(_c, "WorkbenchToolbar");
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
"[project]/src/lib/portfolio-lab.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PORTFOLIO_SORTS",
    ()=>PORTFOLIO_SORTS,
    "portfolioLabApi",
    ()=>portfolioLabApi
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
;
const PORTFOLIO_SORTS = [
    "borrower_name",
    "ticker",
    "sector",
    "sub_sector",
    "ranking",
    "rating_moody",
    "rating_sp",
    "par_usd",
    "price",
    "margin_bps",
    "maturity",
    "created_at"
];
const portfolioLabApi = {
    getCommandSnapshot: (portfolioId)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["api"].get(`/api/portfolios/${portfolioId}/command`).then((response)=>response.data),
    getPositions: (portfolioId, filters = {})=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["api"].get(`/api/portfolios/${portfolioId}/positions`, {
            params: filters
        }).then((response)=>response.data),
    getAnalytics: (portfolioId, asOf)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["api"].get(`/api/portfolios/${portfolioId}/analytics`, {
            params: asOf ? {
                as_of: asOf
            } : {}
        }).then((response)=>response.data),
    listStressRuns: (portfolioId, limit = 50)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["api"].get(`/api/portfolios/${portfolioId}/stress-runs`, {
            params: {
                limit
            }
        }).then((response)=>response.data),
    createStressRun: (portfolioId, input)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["api"].post(`/api/portfolios/${portfolioId}/stress-runs`, input).then((response)=>response.data)
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/AnalysisContextSaveState.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AnalysisContextSaveState",
    ()=>AnalysisContextSaveState
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
"use client";
;
function AnalysisContextSaveState({ analysis }) {
    if (analysis.mutationState === "saving") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            role: "status",
            className: "tabular text-caos-2xs text-caos-muted",
            children: "Saving context…"
        }, void 0, false, {
            fileName: "[project]/src/components/shared/AnalysisContextSaveState.tsx",
            lineNumber: 11,
            columnNumber: 12
        }, this);
    }
    if (analysis.mutationState !== "error") return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        role: "alert",
        className: "flex items-center gap-2 text-caos-xs text-caos-critical",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                children: [
                    "Last change not saved",
                    analysis.mutationError ? ` — ${analysis.mutationError}` : "."
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/AnalysisContextSaveState.tsx",
                lineNumber: 18,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                className: "tabular text-caos-2xs text-caos-accent focus-ring",
                onClick: ()=>void analysis.retryLastPatch().catch(()=>undefined),
                children: "Retry context save"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/AnalysisContextSaveState.tsx",
                lineNumber: 19,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/AnalysisContextSaveState.tsx",
        lineNumber: 15,
        columnNumber: 5
    }, this);
}
_c = AnalysisContextSaveState;
var _c;
__turbopack_context__.k.register(_c, "AnalysisContextSaveState");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/shared/GovernanceSummary.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GovernanceSummary",
    ()=>GovernanceSummary
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/Panel.tsx [app-client] (ecmascript)");
;
;
function GovernanceSummary({ qa, failed, gaps, mixed, stale, coldStart = false, onOpen }) {
    const rows = [
        [
            "CP-5 findings",
            qa
        ],
        [
            "Failed gates",
            failed
        ],
        [
            "Source gaps",
            gaps
        ],
        [
            "Mixed origin",
            mixed
        ],
        [
            "Stale sources",
            stale
        ]
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
        title: "Governance summary",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                className: "grid gap-1 p-2",
                children: rows.map(([label, value])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between gap-3 border-b border-caos-border/40 py-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                className: "text-caos-xs text-caos-muted",
                                children: label
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/GovernanceSummary.tsx",
                                lineNumber: 15,
                                columnNumber: 210
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                className: "tabular text-caos-sm text-caos-text",
                                children: value ?? "Unavailable"
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/GovernanceSummary.tsx",
                                lineNumber: 15,
                                columnNumber: 267
                            }, this)
                        ]
                    }, label, true, {
                        fileName: "[project]/src/components/shared/GovernanceSummary.tsx",
                        lineNumber: 15,
                        columnNumber: 105
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/components/shared/GovernanceSummary.tsx",
                lineNumber: 15,
                columnNumber: 44
            }, this),
            coldStart ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "px-2 pb-1 text-caos-2xs leading-snug text-caos-muted",
                children: "Queues are observed-empty — the first completed run populates them."
            }, void 0, false, {
                fileName: "[project]/src/components/shared/GovernanceSummary.tsx",
                lineNumber: 15,
                columnNumber: 374
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: onOpen,
                className: "caos-action-secondary focus-ring m-2",
                children: "Open governance queue"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/GovernanceSummary.tsx",
                lineNumber: 15,
                columnNumber: 521
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/GovernanceSummary.tsx",
        lineNumber: 15,
        columnNumber: 10
    }, this);
}
_c = GovernanceSummary;
var _c;
__turbopack_context__.k.register(_c, "GovernanceSummary");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/use-surface-insight.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useSurfaceInsight",
    ()=>useSurfaceInsight
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/analysis-workbench.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
const isReadyInsight = (insight)=>insight.status === "ready" || insight.status === "ratified";
function useSurfaceInsight(contextId, options) {
    _s();
    const [insight, setInsight] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [message, setMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const { surface, kind, subjectRefs, loadingMessage, emptyMessage, errorMessage } = options;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useSurfaceInsight.useEffect": ()=>{
            if (!contextId) return;
            let alive = true;
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["analysisApi"].listInsights(contextId, {
                surface,
                kind,
                limit: 20
            }).then({
                "useSurfaceInsight.useEffect": (page)=>{
                    if (alive) setInsight(page.current);
                }
            }["useSurfaceInsight.useEffect"]).catch({
                "useSurfaceInsight.useEffect": ()=>{
                    if (alive) setMessage(emptyMessage);
                }
            }["useSurfaceInsight.useEffect"]);
            return ({
                "useSurfaceInsight.useEffect": ()=>{
                    alive = false;
                }
            })["useSurfaceInsight.useEffect"];
        }
    }["useSurfaceInsight.useEffect"], [
        contextId,
        emptyMessage,
        kind,
        surface
    ]);
    const generate = async ()=>{
        if (!contextId) return;
        setMessage(loadingMessage);
        try {
            const created = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["analysisApi"].createInsight(contextId, {
                surface,
                kind,
                subject_refs: subjectRefs,
                force: Boolean(insight)
            });
            if (isReadyInsight(created)) setInsight(created);
            setMessage(isReadyInsight(created) ? null : `Brief is ${created.status}.`);
        } catch (reason) {
            setMessage(reason instanceof Error ? reason.message : errorMessage);
        }
    };
    return {
        insight,
        message,
        generate
    };
}
_s(useSurfaceInsight, "K/v7yKgY2aPjE/Q5stGBh27awOk=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/app/command/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>CommandPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// Concept A — The Command Center: portfolio posture and governance.
// Unified CIO/PM and Head of Research dashboard with toggleable sleeve and run tables.
// Sector RV has been promoted to a standalone route under /sector-rv.
// Click a row for the issuer detail strip; ATLF links into the Analytical Deep-Dive.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/shared/lib/app-dynamic.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RequireAuth$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/RequireAuth.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingTabs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/useRovingTabs.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$headStat$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/headStat.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ShellIdentity$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ShellIdentity.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/Panel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$command$2f$LiveCoverage$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/command/LiveCoverage.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$command$2f$DailyDigestPanel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/command/DailyDigestPanel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$usePortfolio$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/engine/usePortfolio.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2d$date$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/format-date.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$command$2f$useGovernanceSources$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/command/useGovernanceSources.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$command$2f$CommandPortfolio$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/command/CommandPortfolio.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$EnterprisePage$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/EnterprisePage.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$DecisionHeader$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/DecisionHeader.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$command$2f$RankedChanges$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/command/RankedChanges.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useAutonomyDraft$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/engine/useAutonomyDraft.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$alerts$2f$inbox$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/alerts/inbox.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$WorkbenchToolbar$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/WorkbenchToolbar.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$PersonaWorkbench$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/PersonaWorkbench.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$DominantTableRegion$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/DominantTableRegion.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/analysis-workbench.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$typed$2d$url$2d$state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/typed-url-state.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$portfolio$2d$lab$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/portfolio-lab.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/SurfaceState.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AnalysisContextSaveState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/AnalysisContextSaveState.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$GovernanceSummary$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/GovernanceSummary.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$surface$2d$insight$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/use-surface-insight.ts [app-client] (ecmascript)");
;
;
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature(), _s4 = __turbopack_context__.k.signature(), _s5 = __turbopack_context__.k.signature(), _s6 = __turbopack_context__.k.signature(), _s7 = __turbopack_context__.k.signature(), _s8 = __turbopack_context__.k.signature(), _s9 = __turbopack_context__.k.signature(), _s10 = __turbopack_context__.k.signature(), _s11 = __turbopack_context__.k.signature();
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
const GovernancePanel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(()=>__turbopack_context__.A("[project]/src/components/command/GovernancePanel.tsx [app-client] (ecmascript, next/dynamic entry, async loader)").then((module)=>module.GovernancePanel), {
    loadableGenerated: {
        modules: [
            "[project]/src/components/command/GovernancePanel.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    loading: ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            role: "status",
            "aria-live": "polite",
            className: "min-h-72 p-3 text-caos-xs text-caos-muted",
            children: "Loading governance queue…"
        }, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 49,
            columnNumber: 20
        }, ("TURBOPACK compile-time value", void 0))
});
_c = GovernancePanel;
const IssuerStrip = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(()=>__turbopack_context__.A("[project]/src/components/command/views.tsx [app-client] (ecmascript, next/dynamic entry, async loader)").then((module)=>module.IssuerStrip), {
    loadableGenerated: {
        modules: [
            "[project]/src/components/command/views.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    loading: ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            role: "status",
            "aria-live": "polite",
            className: "h-12 shrink-0 border-t border-caos-border bg-caos-panel px-4 flex items-center text-caos-xs text-caos-muted",
            children: "Loading issuer details…"
        }, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 53,
            columnNumber: 20
        }, ("TURBOPACK compile-time value", void 0))
});
_c1 = IssuerStrip;
const COMMAND_URL_KEYS = [
    "dataset",
    "selected",
    "portfolio"
];
const DATASET_TABS = [
    [
        "Changes",
        "changes"
    ],
    [
        "Positions",
        "positions"
    ],
    [
        "Live coverage",
        "coverage"
    ],
    [
        "Governance",
        "governance"
    ]
];
function resolveCommandDataset(requested, leadingDataset) {
    if (requested && DATASET_TABS.some(([, dataset])=>dataset === requested)) return requested;
    if (DATASET_TABS.some(([, dataset])=>dataset === leadingDataset)) return leadingDataset;
    return "coverage";
}
function usePortfolioDirectory() {
    _s();
    const [rows, setRows] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "usePortfolioDirectory.useEffect": ()=>{
            let alive = true;
            setLoading(true);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getPortfolios"])().then({
                "usePortfolioDirectory.useEffect": (portfolios)=>{
                    if (!alive) return;
                    setRows(portfolios);
                    setError(false);
                }
            }["usePortfolioDirectory.useEffect"]).catch({
                "usePortfolioDirectory.useEffect": ()=>{
                    if (!alive) return;
                    setRows([]);
                    setError(true);
                }
            }["usePortfolioDirectory.useEffect"]).finally({
                "usePortfolioDirectory.useEffect": ()=>{
                    if (alive) setLoading(false);
                }
            }["usePortfolioDirectory.useEffect"]);
            return ({
                "usePortfolioDirectory.useEffect": ()=>{
                    alive = false;
                }
            })["usePortfolioDirectory.useEffect"];
        }
    }["usePortfolioDirectory.useEffect"], []);
    return {
        rows,
        loading,
        error
    };
}
_s(usePortfolioDirectory, "oKPLztX35s3AvdrtPe2frq/5b7c=");
function resolvePortfolioSelection(directory, requestedId, contextId) {
    const requested = requestedId && directory.some((row)=>row.id === requestedId) ? requestedId : null;
    const contextual = contextId && directory.some((row)=>row.id === contextId) ? contextId : null;
    const id = requestedId ? requested : contextual ?? directory[0]?.id ?? null;
    return {
        id,
        portfolio: directory.find((row)=>row.id === id) ?? null
    };
}
function useCommandSnapshot(portfolioId) {
    _s1();
    const [snapshot, setSnapshot] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useCommandSnapshot.useEffect": ()=>{
            if (!portfolioId) {
                setSnapshot(null);
                setLoading(false);
                setError(false);
                return;
            }
            let alive = true;
            const load = {
                "useCommandSnapshot.useEffect.load": ()=>{
                    setLoading(true);
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$portfolio$2d$lab$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["portfolioLabApi"].getCommandSnapshot(portfolioId).then({
                        "useCommandSnapshot.useEffect.load": (value)=>{
                            if (!alive) return;
                            setSnapshot(value);
                            setError(false);
                        }
                    }["useCommandSnapshot.useEffect.load"]).catch({
                        "useCommandSnapshot.useEffect.load": ()=>{
                            if (!alive) return;
                            setSnapshot(null);
                            setError(true);
                        }
                    }["useCommandSnapshot.useEffect.load"]).finally({
                        "useCommandSnapshot.useEffect.load": ()=>{
                            if (alive) setLoading(false);
                        }
                    }["useCommandSnapshot.useEffect.load"]);
                }
            }["useCommandSnapshot.useEffect.load"];
            load();
            window.addEventListener("focus", load);
            return ({
                "useCommandSnapshot.useEffect": ()=>{
                    alive = false;
                    window.removeEventListener("focus", load);
                }
            })["useCommandSnapshot.useEffect"];
        }
    }["useCommandSnapshot.useEffect"], [
        portfolioId
    ]);
    return {
        snapshot,
        loading,
        error
    };
}
_s1(useCommandSnapshot, "LMKIFrmv+lxWYFl3UixlBL+rDK4=");
function useDefaultPortfolioUrl(portfolioId, requestedId, loading, update) {
    _s2();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useDefaultPortfolioUrl.useEffect": ()=>{
            if (!portfolioId || requestedId || loading) return;
            update({
                portfolio: portfolioId
            }, "replace");
        }
    }["useDefaultPortfolioUrl.useEffect"], [
        loading,
        portfolioId,
        requestedId,
        update
    ]);
}
_s2(useDefaultPortfolioUrl, "OD7bBpZva5O2jO+Puf00hKivP7c=");
function useCommandInsight(contextId, selected) {
    _s3();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$surface$2d$insight$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSurfaceInsight"])(contextId, {
        surface: "command",
        kind: "decision-brief",
        subjectRefs: {
            alert_event_id: selected
        },
        loadingMessage: "Generating cited decision brief…",
        emptyMessage: "No cited decision brief is available.",
        errorMessage: "Cited decision brief is unavailable."
    });
}
_s3(useCommandInsight, "Unglhl7/rGaM4KMirfvrcdD/Kx0=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$surface$2d$insight$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSurfaceInsight"]
    ];
});
function useCommandContextSync(analysis, dataset, roleView, selected, portfolioId, directoryLoading) {
    _s4();
    const context = analysis.context;
    const patch = analysis.patch;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useCommandContextSync.useEffect": ()=>{
            if (!context || directoryLoading) return;
            const current = context.surface_state.command;
            const unchanged = current?.active_id === selected && current?.view === dataset && current?.filters?.role === roleView && current?.filters?.portfolio_id === portfolioId && context.portfolio_scope === portfolioId;
            if (unchanged) return;
            void patch({
                portfolio_scope: portfolioId,
                surface_state: {
                    ...context.surface_state,
                    command: {
                        ...current,
                        active_id: selected,
                        view: dataset,
                        filters: {
                            ...current?.filters,
                            role: roleView,
                            portfolio_id: portfolioId
                        }
                    }
                }
            }).catch({
                "useCommandContextSync.useEffect": ()=>undefined
            }["useCommandContextSync.useEffect"]);
        }
    }["useCommandContextSync.useEffect"], [
        context,
        dataset,
        directoryLoading,
        patch,
        portfolioId,
        roleView,
        selected
    ]);
}
_s4(useCommandContextSync, "OD7bBpZva5O2jO+Puf00hKivP7c=");
function digestFreshness(digest) {
    if (!digest?.freshness) return null;
    if (digest.freshness.counts.stale > 0) return "stale";
    if (digest.freshness.counts.unknown > 0) return "unknown";
    if (digest.freshness.counts.due > 0) return "due";
    return "current";
}
function digestDecisionMetadata(digest) {
    const asOf = digest?.as_of ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2d$date$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fmtUtcDateTime"])(digest.as_of) : null;
    const freshnessState = digestFreshness(digest);
    const freshness = freshnessState?.toUpperCase();
    const authority = asOf && freshness ? {
        provenance: {
            origin: "LIVE",
            method: "DERIVED",
            freshness,
            detail: `Central ${digest?.freshness?.policy_version} latest-run freshness roll-up.`,
            asOf
        },
        approval: "UNRATIFIED"
    } : undefined;
    const emptyAuthority = authority ? {
        ...authority,
        approval: null
    } : undefined;
    return {
        asOf,
        freshnessState,
        authority,
        emptyAuthority
    };
}
function changedDecisionCell(input, metadata) {
    if (input.digestLoading) return {
        kind: "loading",
        message: "Checking 24-hour engine activity…"
    };
    if (!input.digestLive || !input.digest || !metadata.asOf) return {
        kind: "unavailable",
        message: "Live activity unavailable"
    };
    const activity = Object.entries(input.digest.activity_24h || {}).filter(([, value])=>typeof value === "number" && value > 0);
    if (!activity.length) return {
        kind: "observed-empty",
        message: "No engine activity observed in 24h — first run populates this",
        asOf: metadata.asOf,
        authority: metadata.emptyAuthority
    };
    const value = activity.slice(0, 3).map(([key, count])=>`${count} ${key.replaceAll("_", " ")}`).join(" · ");
    return {
        kind: "ready",
        value: `${value} in 24h`,
        asOf: metadata.asOf,
        authority: metadata.authority
    };
}
function impactDecisionCell(input, metadata) {
    if (input.digestLoading) return {
        kind: "loading",
        message: "Calculating portfolio impact…"
    };
    if (!input.digestLive || !input.digest || !metadata.asOf) return {
        kind: "unavailable",
        message: "Portfolio impact unavailable"
    };
    if (input.digest.warf == null) return {
        kind: "observed-empty",
        message: "No rated names yet — WARF forms once ratings ingest",
        asOf: metadata.asOf,
        authority: metadata.emptyAuthority
    };
    const band = input.digest.warf_band ? ` (${input.digest.warf_band})` : "";
    return {
        kind: "ready",
        value: `WARF ${input.digest.warf}${band} · CCC watch ${input.digest.ccc_watch.length}`,
        asOf: metadata.asOf,
        authority: metadata.authority
    };
}
function actionDecisionCell(input) {
    if (input.portfolio.loading) return {
        kind: "loading",
        message: "Checking governance queues…"
    };
    if (input.portfolio.error) return {
        kind: "offline",
        lastKnown: "Governance queues unavailable"
    };
    if (!input.portfolio.fetchedAt) return {
        kind: "unavailable",
        message: "Governance queue unavailable"
    };
    return {
        kind: "ready",
        value: `${(input.liveQa ?? []).length + (input.liveFailed ?? []).length} QA findings · ${(input.liveGaps ?? []).length} source gaps`,
        asOf: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2d$date$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fmtUtcDateTime"])(input.portfolio.fetchedAt),
        authority: {
            provenance: {
                origin: "LIVE",
                method: "DERIVED",
                freshness: "CURRENT",
                detail: "Portfolio QA and source-gap roll-up."
            },
            approval: "UNRATIFIED"
        }
    };
}
function evidenceDecisionCell(input, metadata) {
    if (input.digestLoading) return {
        kind: "loading",
        message: "Checking evidence coverage…"
    };
    if (!input.digestLive || !input.digest?.freshness || !metadata.asOf || !metadata.freshnessState) return {
        kind: "unavailable",
        message: "Central evidence freshness unavailable"
    };
    const counts = input.digest.freshness.counts;
    const value = `${counts.stale} stale · ${counts.due} due · ${counts.unknown} unknown · ${counts.current} current`;
    if (metadata.freshnessState === "stale") return {
        kind: "stale",
        value,
        asOf: metadata.asOf,
        authority: metadata.authority
    };
    if (metadata.freshnessState === "current") return {
        kind: "ready",
        value: `${counts.current} current · no due, stale, or unknown runs`,
        asOf: metadata.asOf,
        authority: metadata.authority
    };
    const missingSources = metadata.freshnessState === "unknown" ? [
        "unverified latest-run freshness"
    ] : [
        "run refresh due"
    ];
    return {
        kind: "partial",
        value,
        missingSources,
        asOf: metadata.asOf,
        authority: metadata.authority
    };
}
function buildCommandDecision(input) {
    const metadata = digestDecisionMetadata(input.digest);
    return {
        whatChanged: changedDecisionCell(input, metadata),
        whyItMatters: impactDecisionCell(input, metadata),
        requiredAction: actionDecisionCell(input),
        evidenceHealth: evidenceDecisionCell(input, metadata)
    };
}
function CommandPage() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RequireAuth$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RequireAuth"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CommandCenter, {}, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 271,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 270,
        columnNumber: 5
    }, this);
}
_c2 = CommandPage;
function CommandPositionsContent(props) {
    if (props.directoryLoading) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
        kind: "loading",
        title: "Loading portfolios",
        detail: "Retrieving authorized persisted holdings.",
        className: "m-auto max-w-md"
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 291,
        columnNumber: 38
    }, this);
    if (props.directoryError) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
        kind: "offline",
        title: "Portfolio directory unavailable",
        detail: "Persisted holdings could not be loaded. No sample sleeve has been substituted.",
        className: "m-auto max-w-md",
        primaryAction: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
            href: "/portfolios",
            className: "caos-action-primary no-underline focus-ring",
            children: "Open Portfolio Lab"
        }, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 292,
            columnNumber: 236
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 292,
        columnNumber: 36
    }, this);
    if (props.invalidRequested) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
        kind: "unavailable",
        title: "Portfolio unavailable",
        detail: "The requested portfolio is missing or outside your authorized scope.",
        className: "m-auto max-w-md",
        primaryAction: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
            type: "button",
            className: "caos-action-primary focus-ring",
            onClick: props.onReset,
            children: "Open default portfolio"
        }, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 293,
            columnNumber: 222
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 293,
        columnNumber: 38
    }, this);
    if (!props.directory.length) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
        kind: "empty",
        title: "No portfolio configured",
        detail: "Create or import a persisted portfolio before reviewing held positions and posture.",
        className: "m-auto max-w-md",
        primaryAction: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
            href: "/portfolios",
            className: "caos-action-primary no-underline focus-ring",
            children: "Create or open portfolio"
        }, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 294,
            columnNumber: 234
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 294,
        columnNumber: 39
    }, this);
    if (props.snapshotLoading && !props.snapshot) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
        kind: "loading",
        title: "Loading holdings",
        detail: `Retrieving ${props.selectedPortfolio?.name ?? "selected portfolio"}.`,
        className: "m-auto max-w-md"
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 295,
        columnNumber: 56
    }, this);
    if (props.snapshotError || !props.snapshot) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
        kind: "offline",
        title: "Holdings unavailable",
        detail: "The selected portfolio remains configured, but its positions could not be loaded.",
        className: "m-auto max-w-md",
        primaryAction: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
            href: "/portfolios",
            className: "caos-action-primary no-underline focus-ring",
            children: "Open Portfolio Lab"
        }, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 296,
            columnNumber: 246
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 296,
        columnNumber: 54
    }, this);
    if (!props.snapshot.positions.length) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
        kind: "empty",
        title: "No positions held",
        detail: "This persisted portfolio contains no holdings. Upload holdings in Portfolio Lab.",
        className: "m-auto max-w-md",
        primaryAction: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
            href: `/portfolios?portfolio=${encodeURIComponent(props.snapshot.portfolio.id)}`,
            className: "caos-action-primary no-underline focus-ring",
            children: "Add holdings"
        }, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 297,
            columnNumber: 234
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 297,
        columnNumber: 48
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$command$2f$CommandPortfolio$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CommandPortfolioTable"], {
        positions: props.snapshot.positions,
        selected: props.selected,
        onSelect: props.onSelect
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 298,
        columnNumber: 10
    }, this);
}
_c3 = CommandPositionsContent;
function commandNarrowContract(snapshot, portfolio) {
    const coverage = portfolio.error ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$headStat$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["headStat"])("Live Coverage", "—", "var(--caos-warning)") : (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$headStat$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["headStat"])("Live Coverage", `${portfolio.coveredCount}/${portfolio.issuerCount}`, "var(--caos-success)");
    return {
        essentialControls: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex items-center gap-4 shrink-0 overflow-x-auto caos-no-scrollbar",
            children: [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$headStat$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["headStat"])("Positions", snapshot ? String(snapshot.position_count) : "—"),
                coverage
            ]
        }, void 0, true, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 306,
            columnNumber: 24
        }, this)
    };
}
function topChangeReason(props) {
    if (props.autonomy.loading) return "Checking the autonomy draft…";
    if (props.autonomy.offline) return "Autonomy engine unreachable — no changes to open";
    if (props.rankedRowCount === 0) return props.autonomy.draft?.refreshing ? "Cycle running — no changes yet" : "No ranked changes yet — the first cycle populates this";
    if (!props.topChangeHref) return "Top ranked change has no issuer identifier";
    return null;
}
function CommandTopChangeAction({ view }) {
    return {
        label: "Open top change",
        onAction: ()=>{
            if (view.topChangeHref) view.routerPush(view.topChangeHref);
        },
        unavailableReason: topChangeReason(view)
    };
}
_c4 = CommandTopChangeAction;
function CommandIdentity({ view }) {
    const badge = view.selectedPortfolio ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "tabular text-caos-2xs uppercase tracking-wider whitespace-nowrap shrink-0 text-caos-muted",
        children: [
            view.selectedPortfolio.kind,
            " · persisted"
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 365,
        columnNumber: 42
    }, this) : null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ShellIdentity$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ShellIdentity"], {
        badges: badge,
        title: view.selectedPortfolio?.name ?? "Portfolio command"
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 366,
        columnNumber: 10
    }, this);
}
_c5 = CommandIdentity;
function CommandHeaderStatus({ view }) {
    const label = view.commandSnapshot?.as_of ? `Holdings as of ${view.commandSnapshot.as_of}` : view.digestAsOf ? `Observed ${view.digestAsOf}` : "Holdings date unavailable";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xs text-caos-muted",
                children: label
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 371,
                columnNumber: 12
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AnalysisContextSaveState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AnalysisContextSaveState"], {
                analysis: view.analysis
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 371,
                columnNumber: 82
            }, this)
        ]
    }, void 0, true);
}
_c6 = CommandHeaderStatus;
function CommandContextControls({ view }) {
    const coverage = view.portfolio.error ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$headStat$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["headStat"])("Live Coverage", "—", "var(--caos-warning)") : (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$headStat$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["headStat"])("Live Coverage", `${view.portfolio.coveredCount}/${view.portfolio.issuerCount}`, "var(--caos-success)");
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            view.portfolioDirectory.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "flex items-center gap-2 tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                children: [
                    "Portfolio",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        "aria-label": "Selected portfolio",
                        value: view.selectedPortfolioId ?? "",
                        onChange: (event)=>view.updateUrlState({
                                portfolio: event.target.value || null,
                                selected: null
                            }, "replace"),
                        className: "h-7 max-w-56 rounded border border-caos-border bg-caos-bg px-2 text-caos-xs text-caos-text focus-ring",
                        children: view.portfolioDirectory.map((row)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: row.id,
                                children: row.name
                            }, row.id, false, {
                                fileName: "[project]/src/app/command/page.tsx",
                                lineNumber: 379,
                                columnNumber: 497
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/app/command/page.tsx",
                        lineNumber: 379,
                        columnNumber: 154
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 379,
                columnNumber: 39
            }, this) : null,
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$headStat$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["headStat"])("Positions", view.commandSnapshot ? String(view.commandSnapshot.position_count) : "—"),
            coverage
        ]
    }, void 0, true);
}
_c7 = CommandContextControls;
function CommandUtilityControls({ view }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "grid gap-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                href: "/portfolios",
                className: "caos-action-secondary no-underline focus-ring",
                children: "Open Portfolio Lab"
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 386,
                columnNumber: 38
            }, this),
            view.analysis.context ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["contextHref"])("/monitor", view.analysis.context.id),
                className: "caos-action-secondary no-underline focus-ring",
                children: "Open Monitor"
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 386,
                columnNumber: 171
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 386,
        columnNumber: 10
    }, this);
}
_c8 = CommandUtilityControls;
function CommandToolbar({ view }) {
    const count = view.portfolio.loading ? "Loading" : view.portfolio.error ? "Live coverage unavailable" : `${view.portfolio.coveredCount}/${view.portfolio.issuerCount} covered`;
    const role = view.roleView === "pm" ? "PM" : view.roleView === "qa" ? "QA" : "Analyst";
    const queryHref = view.analysis.context ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["contextHref"])("/query", view.analysis.context.id) : "/query";
    const filters = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
        href: queryHref,
        className: "caos-action-secondary no-underline focus-ring whitespace-nowrap",
        children: "Open cross-issuer Query"
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 393,
        columnNumber: 19
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$WorkbenchToolbar$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WorkbenchToolbar"], {
        title: "Ranked changes & governance",
        description: "Portfolio posture and governance queues beside the ranked-change worklist.",
        count: count,
        viewLabel: `View: ${role}`,
        filters: filters
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 394,
        columnNumber: 10
    }, this);
}
_c9 = CommandToolbar;
function CommandCoverageContent({ view }) {
    if (view.portfolio.loading) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
        kind: "loading",
        title: "Loading live coverage",
        className: "m-auto max-w-md"
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 398,
        columnNumber: 38
    }, this);
    if (view.portfolio.error && !view.portfolio.rows.length) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
        kind: "offline",
        title: "Live coverage unavailable",
        detail: "Latest-run coverage could not be loaded.",
        className: "m-auto max-w-md"
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 399,
        columnNumber: 67
    }, this);
    if (!view.portfolio.rows.length) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SurfaceState"], {
        kind: "empty",
        title: "No live coverage",
        detail: "No completed analytical runs are available.",
        className: "m-auto max-w-md",
        primaryAction: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
            href: "/upload",
            className: "caos-action-primary no-underline focus-ring",
            children: "Start document intake"
        }, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 400,
            columnNumber: 191
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 400,
        columnNumber: 43
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "overflow-x-auto h-full flex flex-col",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$command$2f$LiveCoverage$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LiveCoverage"], {
            rows: view.portfolio.rows,
            selected: view.selected,
            onSelect: (value)=>view.updateUrlState({
                    selected: value
                }, "replace")
        }, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 401,
            columnNumber: 64
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 401,
        columnNumber: 10
    }, this);
}
_c10 = CommandCoverageContent;
function CommandDatasetContent({ view }) {
    _s5();
    const composition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$PersonaWorkbench$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useWorkbenchComposition"])();
    if (view.dataset === "changes") return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$command$2f$RankedChanges$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RankedChangesView"], {
        state: view.autonomy,
        limit: composition.summaryLimit
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 406,
        columnNumber: 42
    }, this);
    if (view.dataset === "governance") return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(GovernancePanel, {
        findingStatus: view.findingStatus,
        qaStatus: view.qaStatus,
        digestStatus: view.digestStatus,
        liveQa: view.liveQa,
        liveFailedGates: view.liveFailed,
        liveGaps: view.liveGapsItems,
        liveMixedOrigin: view.liveMixed,
        staleRows: view.digestLive ? view.digest?.stale ?? [] : []
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 407,
        columnNumber: 45
    }, this);
    const label = view.dataset === "positions" ? "Persisted portfolio positions" : "Live coverage worklist";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$DominantTableRegion$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DominantTableRegion"], {
        ownerId: "command-worklist",
        label: label,
        className: "h-full min-h-0",
        children: view.dataset === "positions" ? view.positionsContent : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CommandCoverageContent, {
            view: view
        }, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 409,
            columnNumber: 155
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 409,
        columnNumber: 10
    }, this);
}
_s5(CommandDatasetContent, "Hwuu9mB2fRaNatO8P/AS2HXpW8Y=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$PersonaWorkbench$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useWorkbenchComposition"]
    ];
});
_c11 = CommandDatasetContent;
function commandDatasetTitle(dataset) {
    if (dataset === "changes") return "Ranked Changes · autonomy draft";
    if (dataset === "positions") return "Persisted portfolio · positions";
    if (dataset === "coverage") return "Live Coverage";
    return "Governance · CP-5 / CP-0 / Staleness";
}
function CommandDatasetPanel({ view }) {
    const tabs = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        role: "tablist",
        "aria-label": "Command dataset",
        className: "flex items-center gap-1 overflow-x-auto",
        children: DATASET_TABS.map(([label, mode], index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                role: "tab",
                "aria-selected": view.dataset === mode,
                onClick: ()=>view.updateUrlState({
                        dataset: mode,
                        selected: null
                    }),
                ...view.getDatasetTabProps(index),
                className: "caos-action-secondary focus-ring whitespace-nowrap",
                children: label
            }, mode, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 420,
                columnNumber: 161
            }, this))
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 420,
        columnNumber: 16
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
        title: commandDatasetTitle(view.dataset),
        className: "h-full min-h-0",
        right: tabs,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CommandDatasetContent, {
            view: view
        }, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 421,
            columnNumber: 104
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 421,
        columnNumber: 10
    }, this);
}
_c12 = CommandDatasetPanel;
function CitedBriefPanel({ view }) {
    const actionLabel = view.insight ? "Refresh cited brief" : "Generate cited brief";
    const content = view.insight ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("article", {
        className: "p-2 pt-0 grid gap-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-caos-sm text-caos-text",
                children: view.insight.summary
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 427,
                columnNumber: 48
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "grid gap-1",
                children: view.insight.claims.map((claim)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: "text-caos-xs text-caos-muted",
                        children: [
                            claim.statement,
                            " · sources ",
                            claim.evidence_ids.join(", ") || "missing"
                        ]
                    }, claim.id, true, {
                        fileName: "[project]/src/app/command/page.tsx",
                        lineNumber: 427,
                        columnNumber: 180
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 427,
                columnNumber: 117
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 427,
        columnNumber: 7
    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
        role: "status",
        className: "p-2 pt-0 text-caos-xs text-caos-muted",
        children: view.insightMessage ?? "No cited brief generated."
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 428,
        columnNumber: 7
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
        title: "Cited decision brief",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>void view.generateInsight(),
                className: "caos-action-secondary focus-ring m-2",
                children: actionLabel
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 429,
                columnNumber: 51
            }, this),
            content
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 429,
        columnNumber: 10
    }, this);
}
_c13 = CitedBriefPanel;
function CommandInspector({ view }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "grid gap-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$GovernanceSummary$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GovernanceSummary"], {
                coldStart: !view.portfolio.live && !view.portfolio.error && !view.portfolio.loading,
                qa: view.liveQa?.length,
                failed: view.liveFailed?.length,
                gaps: view.liveGapsItems?.length,
                mixed: view.liveMixed?.length,
                stale: view.digestLive ? view.digest?.stale?.length ?? 0 : undefined,
                onOpen: ()=>view.updateUrlState({
                        dataset: "governance"
                    })
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 433,
                columnNumber: 38
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CitedBriefPanel, {
                view: view
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 433,
                columnNumber: 399
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 433,
        columnNumber: 10
    }, this);
}
_c14 = CommandInspector;
function CommandDecisionPanel({ view }) {
    const posture = view.commandSnapshot && view.commandSnapshot.position_count > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$command$2f$CommandPortfolio$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CommandPortfolioPosture"], {
        counts: view.commandSnapshot.posture_counts,
        total: view.commandSnapshot.position_count,
        portfolioName: view.commandSnapshot.portfolio.name
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 438,
        columnNumber: 7
    }, this) : null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "grid gap-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$DecisionHeader$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DecisionHeader"], {
                state: view.commandDecision
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 440,
                columnNumber: 38
            }, this),
            posture
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 440,
        columnNumber: 10
    }, this);
}
_c15 = CommandDecisionPanel;
function CommandWorkspace({ view }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex-1 min-h-0 gap-2 p-2 flex flex-col overflow-hidden",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CommandToolbar, {
                view: view
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 444,
                columnNumber: 82
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                id: "ranked-changes",
                className: "caos-persona-route command-workbench flex-1 min-h-0",
                tabIndex: -1,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$PersonaWorkbench$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PersonaWorkbench"], {
                    surface: "command",
                    decision: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CommandDecisionPanel, {
                        view: view
                    }, void 0, false, {
                        fileName: "[project]/src/app/command/page.tsx",
                        lineNumber: 444,
                        columnNumber: 261
                    }, this),
                    primary: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CommandDatasetPanel, {
                        view: view
                    }, void 0, false, {
                        fileName: "[project]/src/app/command/page.tsx",
                        lineNumber: 444,
                        columnNumber: 308
                    }, this),
                    context: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CommandContext, {
                        digest: view.digestLive ? view.digest : null
                    }, void 0, false, {
                        fileName: "[project]/src/app/command/page.tsx",
                        lineNumber: 444,
                        columnNumber: 354
                    }, this),
                    inspector: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CommandInspector, {
                        view: view
                    }, void 0, false, {
                        fileName: "[project]/src/app/command/page.tsx",
                        lineNumber: 444,
                        columnNumber: 431
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/app/command/page.tsx",
                    lineNumber: 444,
                    columnNumber: 215
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 444,
                columnNumber: 112
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 444,
        columnNumber: 10
    }, this);
}
_c16 = CommandWorkspace;
function CommandSelectionStrips({ view }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            view.dataset === "positions" && view.selectedCommandPosition ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$command$2f$CommandPortfolio$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CommandPositionStrip"], {
                position: view.selectedCommandPosition,
                onClose: ()=>view.updateUrlState({
                        selected: null
                    }, "replace")
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 449,
                columnNumber: 69
            }, this) : null,
            view.dataset === "coverage" && view.liveSelected ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(IssuerStrip, {
                code: view.liveSelected.issuer_id,
                liveRow: view.liveSelected,
                onClose: ()=>view.updateUrlState({
                        selected: null
                    }, "replace")
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 450,
                columnNumber: 57
            }, this) : null
        ]
    }, void 0, true);
}
_c17 = CommandSelectionStrips;
function CommandView({ view }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$EnterprisePage$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EnterprisePage"], {
        kind: "overview",
        identity: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CommandIdentity, {
            view: view
        }, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 455,
            columnNumber: 52
        }, this),
        primaryAction: CommandTopChangeAction({
            view
        }),
        status: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CommandHeaderStatus, {
            view: view
        }, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 455,
            columnNumber: 142
        }, this),
        contextualControls: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CommandContextControls, {
            view: view
        }, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 455,
            columnNumber: 199
        }, this),
        utilityLabel: "Command utilities",
        utilityControls: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CommandUtilityControls, {
            view: view
        }, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 455,
            columnNumber: 289
        }, this),
        narrowContract: view.narrowContract,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CommandWorkspace, {
                view: view
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 455,
                columnNumber: 366
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CommandSelectionStrips, {
                view: view
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 455,
                columnNumber: 398
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 455,
        columnNumber: 10
    }, this);
}
_c18 = CommandView;
function useCommandNavigation() {
    _s6();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const analysis = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAnalysisContext"])({
        name: "Portfolio command"
    });
    const composition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$PersonaWorkbench$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePersonaComposition"])("command");
    const roleView = composition.persona;
    const { values, update } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$typed$2d$url$2d$state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTypedUrlState"])(COMMAND_URL_KEYS);
    const dataset = resolveCommandDataset(values.dataset, composition.leadingDataset);
    const { getItemProps } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingTabs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRovingTabs"])(DATASET_TABS.length, DATASET_TABS.findIndex({
        "useCommandNavigation.useRovingTabs": ([, mode])=>mode === dataset
    }["useCommandNavigation.useRovingTabs"]), {
        "useCommandNavigation.useRovingTabs": (index)=>update({
                dataset: DATASET_TABS[index][1],
                selected: null
            })
    }["useCommandNavigation.useRovingTabs"]);
    return {
        analysis,
        roleView,
        dataset,
        selected: values.selected,
        requestedPortfolioId: values.portfolio,
        updateUrlState: update,
        getDatasetTabProps: getItemProps,
        routerPush: (href)=>router.push(href)
    };
}
_s6(useCommandNavigation, "h7xT2ouInVYqJcD6MVHxoc1sTR4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAnalysisContext"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$PersonaWorkbench$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePersonaComposition"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$typed$2d$url$2d$state$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTypedUrlState"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingTabs$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRovingTabs"]
    ];
});
function invalidPortfolioRequest(requestedId, directoryLoading, selectedId) {
    return Boolean(requestedId && !directoryLoading && !selectedId);
}
function useCommandPortfolioModel(navigation) {
    _s7();
    const portfolio = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$usePortfolio$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePortfolio"])();
    const directory = usePortfolioDirectory();
    const selection = resolvePortfolioSelection(directory.rows, navigation.requestedPortfolioId, navigation.analysis.context?.portfolio_scope ?? null);
    const command = useCommandSnapshot(selection.id);
    useDefaultPortfolioUrl(selection.id, navigation.requestedPortfolioId, directory.loading, navigation.updateUrlState);
    return {
        portfolio,
        directory,
        selection,
        command,
        invalidRequested: invalidPortfolioRequest(navigation.requestedPortfolioId, directory.loading, selection.id)
    };
}
_s7(useCommandPortfolioModel, "aBWJXpGJMD5QcW9aGEz60ZiwfVo=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$usePortfolio$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePortfolio"],
        usePortfolioDirectory,
        useCommandSnapshot,
        useDefaultPortfolioUrl
    ];
});
function commandSurfaceStatus(loading, error) {
    if (loading) return "loading";
    if (error) return "error";
    return "ready";
}
function deriveRankedChange(autonomy) {
    const rows = autonomy.draft ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$alerts$2f$inbox$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["draftToAlertRows"])(autonomy.draft) : [];
    const issuer = rows[0]?.issuerId;
    return {
        count: rows.length,
        href: issuer ? `/deepdive?issuer=${encodeURIComponent(issuer)}` : null
    };
}
function useCommandGovernanceModel(portfolio) {
    _s8();
    const governance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$command$2f$useGovernanceSources$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGovernanceSources"])(portfolio);
    const autonomy = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useAutonomyDraft$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAutonomyDraft"])();
    const ranked = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "useCommandGovernanceModel.useMemo[ranked]": ()=>deriveRankedChange(autonomy)
    }["useCommandGovernanceModel.useMemo[ranked]"], [
        autonomy
    ]);
    return {
        governance,
        autonomy,
        ranked,
        qaStatus: commandSurfaceStatus(portfolio.loading, Boolean(portfolio.error)),
        findingStatus: commandSurfaceStatus(portfolio.loading || governance.qaFindingsLoading, Boolean(portfolio.error || governance.qaFindingsError)),
        digestStatus: commandSurfaceStatus(governance.loading, Boolean(governance.error))
    };
}
_s8(useCommandGovernanceModel, "MtR5GNyLznrndir/yUyPd8xpXJs=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$command$2f$useGovernanceSources$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGovernanceSources"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useAutonomyDraft$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAutonomyDraft"]
    ];
});
function selectedLiveCoverage(portfolio, selected) {
    if (!selected) return null;
    return portfolio.rows.find((row)=>row.issuer_id === selected) ?? null;
}
function selectedCommandPosition(snapshot, selected) {
    if (!selected) return null;
    return snapshot?.positions.find((position)=>position.id === selected) ?? null;
}
function useCommandAnalysisModel(navigation, portfolioModel, governanceModel) {
    _s9();
    const { governance } = governanceModel;
    useCommandContextSync(navigation.analysis, navigation.dataset, navigation.roleView, navigation.selected, portfolioModel.selection.id, portfolioModel.directory.loading);
    const insight = useCommandInsight(navigation.analysis.context?.id, navigation.selected);
    return {
        insight,
        digestAsOf: digestDecisionMetadata(governance.digest).asOf,
        commandDecision: buildCommandDecision({
            digest: governance.digest,
            digestLive: governance.live,
            digestLoading: governance.loading,
            portfolio: portfolioModel.portfolio,
            liveQa: governance.liveQa,
            liveFailed: governance.liveFailed,
            liveGaps: governance.liveGapsItems
        }),
        liveSelected: selectedLiveCoverage(portfolioModel.portfolio, navigation.selected),
        selectedPosition: selectedCommandPosition(portfolioModel.command.snapshot, navigation.selected)
    };
}
_s9(useCommandAnalysisModel, "5F41LtgBzwbbLKoIJ8ydgSoknzY=", false, function() {
    return [
        useCommandContextSync,
        useCommandInsight
    ];
});
function buildPositionsContent(navigation, portfolioModel) {
    const props = {
        directory: portfolioModel.directory.rows,
        directoryLoading: portfolioModel.directory.loading,
        directoryError: portfolioModel.directory.error,
        invalidRequested: portfolioModel.invalidRequested,
        snapshot: portfolioModel.command.snapshot,
        snapshotLoading: portfolioModel.command.loading,
        snapshotError: portfolioModel.command.error,
        selectedPortfolio: portfolioModel.selection.portfolio,
        selected: navigation.selected,
        onReset: ()=>navigation.updateUrlState({
                portfolio: null,
                selected: null
            }, "replace"),
        onSelect: (positionId)=>navigation.updateUrlState({
                selected: positionId
            }, "replace")
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CommandPositionsContent, {
        ...props
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 549,
        columnNumber: 10
    }, this);
}
function buildCommandViewProps(navigation, portfolioModel, governanceModel, analysisModel) {
    const { governance } = governanceModel;
    return {
        analysis: navigation.analysis,
        roleView: navigation.roleView,
        dataset: navigation.dataset,
        selected: navigation.selected,
        updateUrlState: navigation.updateUrlState,
        getDatasetTabProps: navigation.getDatasetTabProps,
        portfolio: portfolioModel.portfolio,
        portfolioDirectory: portfolioModel.directory.rows,
        selectedPortfolioId: portfolioModel.selection.id,
        selectedPortfolio: portfolioModel.selection.portfolio,
        commandSnapshot: portfolioModel.command.snapshot,
        autonomy: governanceModel.autonomy,
        rankedRowCount: governanceModel.ranked.count,
        topChangeHref: governanceModel.ranked.href,
        digest: governance.digest,
        digestLive: governance.live,
        digestAsOf: analysisModel.digestAsOf,
        commandDecision: analysisModel.commandDecision,
        positionsContent: buildPositionsContent(navigation, portfolioModel),
        qaStatus: governanceModel.qaStatus,
        findingStatus: governanceModel.findingStatus,
        digestStatus: governanceModel.digestStatus,
        liveQa: governance.liveQa,
        liveFailed: governance.liveFailed,
        liveGapsItems: governance.liveGapsItems,
        liveMixed: governance.liveMixed,
        insight: analysisModel.insight.insight,
        insightMessage: analysisModel.insight.message,
        generateInsight: analysisModel.insight.generate,
        liveSelected: analysisModel.liveSelected,
        selectedCommandPosition: analysisModel.selectedPosition,
        narrowContract: commandNarrowContract(portfolioModel.command.snapshot, portfolioModel.portfolio),
        routerPush: navigation.routerPush
    };
}
function useCommandCenterView() {
    _s10();
    const navigation = useCommandNavigation();
    const portfolioModel = useCommandPortfolioModel(navigation);
    const governanceModel = useCommandGovernanceModel(portfolioModel.portfolio);
    const analysisModel = useCommandAnalysisModel(navigation, portfolioModel, governanceModel);
    return buildCommandViewProps(navigation, portfolioModel, governanceModel, analysisModel);
}
_s10(useCommandCenterView, "kadSASH0blQHGCepgLBsaLuK+Pk=", false, function() {
    return [
        useCommandNavigation,
        useCommandPortfolioModel,
        useCommandGovernanceModel,
        useCommandAnalysisModel
    ];
});
function CommandCenter() {
    _s11();
    const view = useCommandCenterView();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CommandView, {
        view: view
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 601,
        columnNumber: 10
    }, this);
}
_s11(CommandCenter, "Ybpc3e7d/VC2ds5G2su4VC7chBM=", false, function() {
    return [
        useCommandCenterView
    ];
});
_c19 = CommandCenter;
function CommandContext({ digest }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "grid gap-2",
        children: digest ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
            title: "Daily Digest · coverage & ratings",
            right: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-xs text-caos-success",
                children: "● LIVE"
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 605,
                columnNumber: 109
            }, this),
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$command$2f$DailyDigestPanel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DailyDigestPanel"], {
                digest: digest
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 605,
                columnNumber: 181
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 605,
            columnNumber: 48
        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Panel"], {
            title: "Daily Digest",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "p-2 text-caos-xs text-caos-muted",
                children: "Live coverage digest unavailable."
            }, void 0, false, {
                fileName: "[project]/src/app/command/page.tsx",
                lineNumber: 605,
                columnNumber: 266
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/app/command/page.tsx",
            lineNumber: 605,
            columnNumber: 233
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/command/page.tsx",
        lineNumber: 605,
        columnNumber: 10
    }, this);
}
_c20 = CommandContext;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c10, _c11, _c12, _c13, _c14, _c15, _c16, _c17, _c18, _c19, _c20;
__turbopack_context__.k.register(_c, "GovernancePanel");
__turbopack_context__.k.register(_c1, "IssuerStrip");
__turbopack_context__.k.register(_c2, "CommandPage");
__turbopack_context__.k.register(_c3, "CommandPositionsContent");
__turbopack_context__.k.register(_c4, "CommandTopChangeAction");
__turbopack_context__.k.register(_c5, "CommandIdentity");
__turbopack_context__.k.register(_c6, "CommandHeaderStatus");
__turbopack_context__.k.register(_c7, "CommandContextControls");
__turbopack_context__.k.register(_c8, "CommandUtilityControls");
__turbopack_context__.k.register(_c9, "CommandToolbar");
__turbopack_context__.k.register(_c10, "CommandCoverageContent");
__turbopack_context__.k.register(_c11, "CommandDatasetContent");
__turbopack_context__.k.register(_c12, "CommandDatasetPanel");
__turbopack_context__.k.register(_c13, "CitedBriefPanel");
__turbopack_context__.k.register(_c14, "CommandInspector");
__turbopack_context__.k.register(_c15, "CommandDecisionPanel");
__turbopack_context__.k.register(_c16, "CommandWorkspace");
__turbopack_context__.k.register(_c17, "CommandSelectionStrips");
__turbopack_context__.k.register(_c18, "CommandView");
__turbopack_context__.k.register(_c19, "CommandCenter");
__turbopack_context__.k.register(_c20, "CommandContext");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_0owp3iv._.js.map