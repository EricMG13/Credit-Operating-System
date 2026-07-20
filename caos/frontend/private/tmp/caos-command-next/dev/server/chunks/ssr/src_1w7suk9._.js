module.exports = [
"[project]/src/components/shared/ActionReason.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ActionReason",
    ()=>ActionReason
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// The desk convention for "this action exists but can't fire yet": the control
// stays focusable (aria-disabled, never the native disabled attribute), the
// click is guarded, and the *why* is announced three ways — title for pointer
// hover, aria-describedby for assistive tech, and (by default) a visible
// adjacent reason line for sighted keyboard/touch users, who a title alone
// never reaches. The reason text must never enter the button's accessible
// name: name-based queries and muscle memory both depend on the label staying
// stable whether or not the action is currently available.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
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
    const buttonRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [flashPos, setFlashPos] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const flashTimer = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>()=>{
            if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
        }, []);
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
function ActionReasonMessage({ inert, reasonId, reason, flashPos, reasonDisplay }) {
    if (!inert) return null;
    const flash = flashPos !== null;
    const showInline = reasonDisplay === "inline" || flash;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
function ActionReason({ reason, actionTitle, reasonDisplay = "inline", onClick, children, type = "button", ...rest }) {
    const reasonId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useId"])();
    const inert = Boolean(reason);
    const { buttonRef, flashPos, reveal } = useReasonFlash(reasonDisplay);
    // A guarded click must never look ignored: in the "hidden" variant the
    // reason surfaces for a few seconds after the attempt (announced via
    // role=status). It renders as a viewport-positioned popover under the
    // button — an inline block span is invisible exactly where "hidden" is
    // used (SubHeader's shrink-0 primary-action slot clips it).
    const handleClick = inert ? reveal : onClick;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ActionReasonMessage, {
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
}),
"[project]/src/components/shared/LoginLanding.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LoginLanding",
    ()=>LoginLanding
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// Analyst sign-in / sign-up. Two lanes layered on the edge SSO gate:
//   • Sign in        — email + password           → POST /api/auth/login
//   • Create account — name + email + password + invite code → POST /api/auth/register
// Either mints the signed caos_analyst profile cookie; that name's initials then
// ride the chrome on every page and stamp every run. Shown by RequireAuth whenever
// no profile is signed in.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/axios/lib/axios.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingTabs$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/useRovingTabs.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ActionReason.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RouteHeading$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/RouteHeading.tsx [app-ssr] (ecmascript)");
"use client";
;
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
        className: "flex flex-col gap-1.5",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["register"])({
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
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["recoverLogin"])(fields.email.trim(), trimmed(fields.recoveryWords));
        return;
    }
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["login"])(fields.email.trim(), fields.password);
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
    const detail = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"].isAxiosError(error) ? error.response?.data?.detail : null;
    return typeof detail === "string" ? detail : "Something went wrong — try again.";
}
function useLoginForm(onSuccess) {
    const [mode, setMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("signin");
    const [fields, setFields] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(INITIAL_FIELDS);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [submitting, setSubmitting] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
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
function LoginHeader({ form }) {
    const title = form.mode === "signup" ? "Create your analyst account" : form.mode === "recover" ? "Recover analyst access" : "Analyst sign-in";
    const description = form.mode === "signup" ? "Access code, profile, passcode, and confirmed recovery words are required." : form.mode === "recover" ? "Enter your email and all three recovery words. Stored hints are not disclosed on this endpoint." : "Sign in with your email and passcode.";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col gap-1",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RouteHeading$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["RouteHeadingOverride"], {
                title: title
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 155,
                columnNumber: 47
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "font-mono text-caos-sm uppercase tracking-[0.2em] text-caos-accent",
                children: "Credit Agent OS"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 155,
                columnNumber: 85
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "text-caos-text text-lg font-semibold",
                children: title
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 155,
                columnNumber: 192
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
function LoginModeTabs({ form }) {
    const { getItemProps } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingTabs$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRovingTabs"])(MODES.length, MODES.indexOf(form.mode), (index)=>form.swap(MODES[index]));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        role: "tablist",
        "aria-label": "Sign in or create account",
        className: "grid grid-cols-3 gap-1 rounded border border-caos-border p-1",
        children: MODES.map((mode, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
function LoginCredentials({ form }) {
    const signup = form.mode === "signup";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            signup ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                label: "Analyst name",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                label: "Email",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
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
            form.mode !== "recover" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                label: "Login passcode",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
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
function SignupFields({ form }) {
    if (form.mode !== "signup") return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                        label: "Coverage area",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                            name: "coverage",
                            value: form.fields.coverage,
                            onChange: (event)=>form.setField("coverage", event.target.value),
                            className: inputCls,
                            children: COVERAGE_AREAS.map((area)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                        label: "Location",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                            name: "location",
                            value: form.fields.location,
                            onChange: (event)=>form.setField("location", event.target.value),
                            className: inputCls,
                            children: LOCATIONS.map((location)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                label: "Confirm passcode",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                label: "Invite code",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
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
            form.fields.password.length > 0 && form.fields.password.length < 12 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
function RecoveryRow({ form, index }) {
    const signup = form.mode === "signup";
    const wordType = form.fields.showRecoveryWords ? "text" : "password";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: signup ? "grid gap-2 md:grid-cols-3" : "",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                label: `Recovery word ${index + 1}`,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
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
            signup ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                label: `Confirm word ${index + 1}`,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
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
            signup ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Field, {
                label: `Hint ${index + 1}`,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
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
function RecoveryFields({ form }) {
    if (form.mode === "signin") return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col gap-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>form.setField("showRecoveryWords", !form.fields.showRecoveryWords),
                className: "self-start tabular text-caos-xs text-caos-muted hover:text-caos-text focus-ring rounded px-1",
                children: form.fields.showRecoveryWords ? "Hide recovery words" : "Reveal recovery words"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 209,
                columnNumber: 7
            }, this),
            RECOVERY_INDEXES.map((index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(RecoveryRow, {
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
function LoginForm({ form }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
        onSubmit: form.submit,
        className: "w-full max-w-sm flex flex-col gap-5 rounded-lg border border-caos-border bg-caos-panel p-7",
        "aria-describedby": form.error ? "login-error" : undefined,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(LoginHeader, {
                form: form
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 218,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(LoginModeTabs, {
                form: form
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 219,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(LoginCredentials, {
                form: form
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 220,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SignupFields, {
                form: form
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 221,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(RecoveryFields, {
                form: form
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 222,
                columnNumber: 7
            }, this),
            form.error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                id: "login-error",
                role: "alert",
                className: "text-caos-sm text-caos-critical",
                children: form.error
            }, void 0, false, {
                fileName: "[project]/src/components/shared/LoginLanding.tsx",
                lineNumber: 223,
                columnNumber: 21
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ActionReason"], {
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
function LoginLanding({ onSuccess }) {
    const form = useLoginForm(onSuccess);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen flex items-center justify-center bg-caos-bg px-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(LoginForm, {
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
}),
"[project]/src/components/shared/RequireAuth.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RequireAuth",
    ()=>RequireAuth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AuthProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/AuthProvider.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$LoginLanding$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/LoginLanding.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/SurfaceState.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function RequireAuth({ children }) {
    const { user, loading, error, needsLogin, refresh } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AuthProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuth"])();
    if (loading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "min-h-screen flex items-center justify-center bg-caos-bg px-4",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SurfaceState"], {
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
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$LoginLanding$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["LoginLanding"], {
            onSuccess: refresh
        }, void 0, false, {
            fileName: "[project]/src/components/shared/RequireAuth.tsx",
            lineNumber: 27,
            columnNumber: 12
        }, this);
    }
    if (error || !user) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "min-h-screen flex items-center justify-center bg-caos-bg px-4",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SurfaceState"], {
                kind: "error",
                title: "Analyst access could not be verified",
                detail: "The CAOS service did not respond. Check your connection, then retry. If it persists, contact your CAOS administrator.",
                primaryAction: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: children
    }, void 0, false);
}
}),
"[project]/src/components/shared/MoreDrawer.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MoreDrawer",
    ()=>MoreDrawer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$dom$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-dom.js [app-ssr] (ecmascript)");
"use client";
;
;
;
function MoreDrawer({ open, onOpenChange, children, triggerLabel = "More", triggerId, align = "right" }) {
    const triggerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const panelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [pos, setPos] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    // Anchor the fixed panel to the trigger rect. useLayoutEffect so the panel
    // never paints a frame at (0,0). Re-measures on open; window resize/scroll
    // just closes it (a popover is glance-and-return).
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useLayoutEffect"])(()=>{
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
    }, [
        open,
        align
    ]);
    // Move focus to the first focusable element when the drawer opens, so the
    // Tab trap works from the start. Stays on the trigger on close (restores).
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!open) return;
        const raf = requestAnimationFrame(()=>{
            const panel = panelRef.current;
            if (!panel) return;
            const focusables = Array.from(panel.querySelectorAll('a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter((el)=>el.offsetParent !== null);
            if (focusables.length > 0) focusables[0].focus();
            else panel.focus();
        });
        return ()=>cancelAnimationFrame(raf);
    }, [
        open
    ]);
    // Close on outside click (pointerdown so it fires before the click lands on
    // the page behind the drawer — a click on the page would otherwise navigate).
    // Also close on scroll/resize since the fixed panel no longer tracks the
    // trigger (glance-and-return — reopening re-anchors).
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!open) return;
        const onPointer = (e)=>{
            if (panelRef.current?.contains(e.target)) return;
            if (triggerRef.current?.contains(e.target)) return;
            onOpenChange(false);
            triggerRef.current?.focus();
        };
        const onKey = (e)=>{
            if (e.key === "Escape") {
                onOpenChange(false);
                triggerRef.current?.focus();
            }
        };
        const onResize = ()=>onOpenChange(false);
        // Close when the PAGE scrolls (the fixed panel would detach from its
        // trigger), but ignore scrolls inside the panel's own list — auto-focus
        // scrolls that list on open and must not self-close the drawer.
        const onScroll = (e)=>{
            if (panelRef.current?.contains(e.target)) return;
            onOpenChange(false);
        };
        window.addEventListener("pointerdown", onPointer);
        window.addEventListener("keydown", onKey);
        window.addEventListener("resize", onResize);
        window.addEventListener("scroll", onScroll, true);
        return ()=>{
            window.removeEventListener("pointerdown", onPointer);
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("resize", onResize);
            window.removeEventListener("scroll", onScroll, true);
        };
    }, [
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative shrink-0",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                id: triggerId,
                ref: triggerRef,
                type: "button",
                onClick: ()=>onOpenChange(!open),
                "aria-expanded": open,
                "aria-haspopup": "dialog",
                "aria-label": `Open ${triggerLabel}`,
                className: "caos-utility-trigger tabular text-caos-xs px-2 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring whitespace-nowrap",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        "aria-hidden": "true",
                        children: "⋯"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/MoreDrawer.tsx",
                        lineNumber: 147,
                        columnNumber: 9
                    }, this),
                    " ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
            open && pos && typeof document !== "undefined" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$dom$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createPortal"])(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
}),
"[project]/src/components/shared/ConceptNav.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ConceptNav",
    ()=>ConceptNav
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
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
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AnalystBadge$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/AnalystBadge.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$MoreDrawer$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/MoreDrawer.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RoleViewSwitch$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/RoleViewSwitch.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/nav.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Ask$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/Ask.tsx [app-ssr] (ecmascript)");
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
/** Full-label concept list in a popover — the guaranteed nav path below the
 *  rail breakpoint. The icon chip row is a quick-jump enhancement that can
 *  scroll off; this drawer always reaches every destination, at every width
 *  down to phones (the chips row hides <768px, the trigger does not). */ function ConceptsDrawer({ pathname, preserveContext }) {
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$MoreDrawer$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MoreDrawer"], {
        open: open,
        onOpenChange: setOpen,
        triggerLabel: "Workflows",
        triggerId: "workflow-disclosure",
        align: "left",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "border-b border-caos-border/60 px-2 pb-2",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RoleViewSwitch$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["RoleViewSwitch"], {}, void 0, false, {
                    fileName: "[project]/src/components/shared/ConceptNav.tsx",
                    lineNumber: 38,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 37,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                "aria-label": "All Workflows",
                className: "flex max-h-[70vh] flex-col gap-1 overflow-y-auto",
                children: [
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["NAV_GROUPS"].map((g)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            "aria-label": g.label,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "px-2 pt-1 text-caos-2xs uppercase tracking-widest text-caos-muted select-none",
                                    children: g.label
                                }, void 0, false, {
                                    fileName: "[project]/src/components/shared/ConceptNav.tsx",
                                    lineNumber: 43,
                                    columnNumber: 13
                                }, this),
                                g.items.map((s)=>{
                                    const active = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["routeMatches"])(pathname, s.href);
                                    const Glyph = ICONS[s.icon];
                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                        href: preserveContext(s.href),
                                        prefetch: false,
                                        "aria-current": active ? "page" : undefined,
                                        onClick: ()=>setOpen(false),
                                        className: `caos-rail-link no-underline flex items-center gap-2 ${active ? "caos-rail-link-active" : ""}`,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Glyph, {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        "aria-label": "Utility",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                            href: preserveContext("/settings"),
                            prefetch: false,
                            "aria-current": pathname.startsWith("/settings") ? "page" : undefined,
                            onClick: ()=>setOpen(false),
                            className: `caos-rail-link no-underline flex items-center gap-2 ${pathname.startsWith("/settings") ? "caos-rail-link-active" : ""}`,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ICONS.settings, {}, void 0, false, {
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
const svg = (children)=>function I({ className }) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
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
    directory: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
            d: "M1.6 3.4h4.2l1 1.4h5.6v6.8H1.6z"
        }, void 0, false, {
            fileName: "[project]/src/components/shared/ConceptNav.tsx",
            lineNumber: 104,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false)),
    command: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
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
    portfolio: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M2 3.2h10v8H2zM4.2 3.2V2h5.6v1.2"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 111,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M2 6.2h10M5.3 6.2v5.1M8.7 6.2v5.1"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 112,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    decisions: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M3 1.8h6.3l1.7 1.7v8.7H3z"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 115,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M9.3 1.8v2h1.8M5 6h4M5 8.3h4M5 10.6h2.4"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 116,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    pipeline: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M7 3.2v3M7 6.2H3.4v3.4M7 6.2h3.6v3.4"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 119,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "7",
                cy: "2.2",
                r: "1.1"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 120,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "3.4",
                cy: "11",
                r: "1.1"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 120,
                columnNumber: 39
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
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
    deepdive: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "5.9",
                cy: "5.9",
                r: "3.5"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 122,
                columnNumber: 19
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M8.7 8.7l3.4 3.4"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 122,
                columnNumber: 55
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    model: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M1.8 5.6h10.4M5.4 5.6v5.8"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 123,
                columnNumber: 73
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    report: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M3.6 1.9h4.6L11 4.7v7.4H3.6z"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 124,
                columnNumber: 17
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M5.4 6.6h4M5.4 8.8h4"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 124,
                columnNumber: 58
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    monitor: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
        d: "M1.5 7.4h2.6l1.6-4 2.2 7 1.5-3h3.1"
    }, void 0, false, {
        fileName: "[project]/src/components/shared/ConceptNav.tsx",
        lineNumber: 125,
        columnNumber: 16
    }, ("TURBOPACK compile-time value", void 0))),
    research: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M5.5 1.8v3.3L2.5 10.8a1 1 0 0 0 .9 1.5h7.2a1 1 0 0 0 .9-1.5L8.5 5.1V1.8"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 127,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M4.5 1.8h5M4.4 8.2h5.2"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 128,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    sponsors: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "4",
                cy: "5",
                r: "2"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 131,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "10",
                cy: "5",
                r: "2"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 131,
                columnNumber: 35
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M1.5 11c.5-2 1.6-3 3.3-3s2.8 1 3.2 3M6 11c.5-1.8 1.5-2.7 3-2.7 1.8 0 3 .9 3.5 2.7"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 132,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    query: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "7",
                cy: "3.2",
                r: "1.5"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 135,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "3.2",
                cy: "10.2",
                r: "1.5"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 135,
                columnNumber: 39
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "10.8",
                cy: "10.2",
                r: "1.5"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 135,
                columnNumber: 76
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M6.2 4.5 4 8.9M7.8 4.5 10 8.9M4.7 10.2h4.6"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 136,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    sector: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M2 3.2h10M2 7h10M2 10.8h10"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 139,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M3.4 1.8v2.8M7 5.6v2.8M10.6 9.4v2.8"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 140,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    "sector-rv": svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
            d: "M1.5 12.5h11M3.5 12.5v-4M7 12.5v-8M10.5 12.5v-6"
        }, void 0, false, {
            fileName: "[project]/src/components/shared/ConceptNav.tsx",
            lineNumber: 143,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false)),
    upload: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M7 9.6V2.4M4.4 5 7 2.4 9.6 5"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 146,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M2 9.6v2.2a.8.8 0 0 0 .8.8h8.4a.8.8 0 0 0 .8-.8V9.6"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 147,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true)),
    settings: svg(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "7",
                cy: "7",
                r: "2.1"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 150,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
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
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["usePathname"])();
    const [analysisContextId, setAnalysisContextId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        setAnalysisContextId(new URLSearchParams(window.location.search).get("context"));
        const onContext = (event)=>{
            const detail = event.detail;
            if (detail?.id) setAnalysisContextId(detail.id);
        };
        window.addEventListener("caos:analysis-context", onContext);
        return ()=>window.removeEventListener("caos:analysis-context", onContext);
    }, [
        pathname
    ]);
    const preserveContext = (href)=>analysisContextId ? `${href}${href.includes("?") ? "&" : "?"}context=${encodeURIComponent(analysisContextId)}` : href;
    const Gear = ICONS.settings;
    const settingsActive = pathname.startsWith("/settings");
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "caos-compact-nav items-center gap-1 min-w-0 max-w-full",
        children: [
            compact && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ConceptsDrawer, {
                pathname: pathname,
                preserveContext: preserveContext
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 176,
                columnNumber: 19
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "caos-concept-chips flex flex-1 items-center gap-1 min-w-0 overflow-x-auto",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                        id: "concept-nav",
                        "aria-label": compact ? "Current workflow" : "Concepts",
                        className: "flex items-center gap-1 shrink-0",
                        title: "Tip: hold ALT + ← / → to switch concepts",
                        children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["NAV_GROUPS"].map((g, gIdx)=>{
                            const groupActive = g.items.some((i)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["routeMatches"])(pathname, i.href));
                            // Group labels carry the workflow stage. In compact mode only the
                            // active group is labeled (you-are-here); inactive groups collapse
                            // to a separator so dense page headers still fit at 1280px (RT-60).
                            const showGroupLabel = !compact || groupActive;
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "flex items-center gap-1",
                                children: [
                                    gIdx > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "h-4 w-px bg-caos-border mx-0.5",
                                        "aria-hidden": "true"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/shared/ConceptNav.tsx",
                                        lineNumber: 195,
                                        columnNumber: 28
                                    }, this),
                                    showGroupLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                                        const active = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["routeMatches"])(pathname, s.href);
                                        if (compact && !active) return null;
                                        const Glyph = ICONS[s.icon];
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                            href: preserveContext(s.href),
                                            prefetch: false,
                                            title: s.label + " — " + g.label,
                                            "aria-label": s.label,
                                            "aria-current": active ? "page" : undefined,
                                            className: "no-underline flex items-center gap-1.5 tabular text-caos-sm px-2 py-1 min-h-8 rounded border transition-caos whitespace-nowrap focus-ring " + (active ? "bg-caos-elevated text-caos-accent border-caos-accent font-semibold" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50"),
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Glyph, {
                                                    className: active ? "text-caos-accent" : ""
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/shared/ConceptNav.tsx",
                                                    lineNumber: 229,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                    !compact || settingsActive ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "h-4 w-px bg-caos-border mx-0.5"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/ConceptNav.tsx",
                        lineNumber: 242,
                        columnNumber: 39
                    }, this) : null,
                    !compact || settingsActive ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                        href: preserveContext("/settings"),
                        prefetch: false,
                        title: "Settings",
                        "aria-label": "Settings",
                        "aria-current": settingsActive ? "page" : undefined,
                        className: "no-underline flex items-center gap-1.5 tabular text-caos-sm px-2 py-1 min-h-8 rounded border transition-caos whitespace-nowrap focus-ring " + (settingsActive ? "bg-caos-elevated text-caos-accent border-caos-accent font-semibold" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50"),
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Gear, {
                                className: settingsActive ? "text-caos-accent" : ""
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                                lineNumber: 256,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
            compact ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "caos-ask-compact-utility",
                role: "region",
                "aria-label": "Ask utility",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Ask$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AskUtility"], {}, void 0, false, {
                    fileName: "[project]/src/components/shared/ConceptNav.tsx",
                    lineNumber: 260,
                    columnNumber: 100
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 260,
                columnNumber: 18
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "caos-compact-view flex items-center gap-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "h-4 w-px bg-caos-border mx-0.5"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/ConceptNav.tsx",
                        lineNumber: 267,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RoleViewSwitch$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["RoleViewSwitch"], {}, void 0, false, {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "h-4 w-px bg-caos-border mx-0.5"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConceptNav.tsx",
                lineNumber: 271,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AnalystBadge$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AnalystBadge"], {}, void 0, false, {
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
}),
"[project]/src/components/shared/ShellIdentity.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ShellIdentity",
    ()=>ShellIdentity
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ConceptNav$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ConceptNav.tsx [app-ssr] (ecmascript)");
"use client";
;
;
function Divider() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "h-4 w-px shrink-0 bg-caos-border",
        "aria-hidden": "true"
    }, void 0, false, {
        fileName: "[project]/src/components/shared/ShellIdentity.tsx",
        lineNumber: 6,
        columnNumber: 10
    }, this);
}
function ShellIdentity({ tag, badges, title, children, showConceptNav = true, titleAs: Title = "span" }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex min-w-0 items-center gap-3",
        children: [
            showConceptNav ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ConceptNav$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ConceptNav"], {
                compact: true
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ShellIdentity.tsx",
                lineNumber: 33,
                columnNumber: 25
            }, this) : null,
            tag && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Divider, {}, void 0, false, {
                        fileName: "[project]/src/components/shared/ShellIdentity.tsx",
                        lineNumber: 36,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap shrink-0",
                        children: tag
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/ShellIdentity.tsx",
                        lineNumber: 37,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true),
            badges ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "flex min-w-0 shrink items-center gap-3 overflow-hidden",
                children: badges
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ShellIdentity.tsx",
                lineNumber: 45,
                columnNumber: 17
            }, this) : null,
            title && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Title, {
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
}),
"[project]/src/components/reports/ExportToVaultButton.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ExportToVaultButton",
    ()=>ExportToVaultButton
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// One-way "Export to vault" action: writes the run's hub + spoke Markdown notes
// into the configured Obsidian vault. Self-contained, inline button — state lives
// in the label (with detail on hover) so it fits a dense toolbar or a rail. Drop
// it wherever a live runId exists. Status is stamped into the note frontmatter
// server-side, so this is not gated on Committee Ready.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
const BASE = "tabular text-caos-sm whitespace-nowrap px-2.5 py-1 rounded border transition-caos aria-disabled:opacity-50";
const vaultExportError = (status)=>status === 503 ? "Vault export not configured (VAULT_EXPORT_DIR unset)." : "Export failed — try again.";
const vaultPresentation = (state)=>{
    switch(state.kind){
        case "busy":
            return {
                label: "EXPORTING…",
                tone: "border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg",
                title: "Write this run to the Obsidian vault (hub + spoke notes)"
            };
        case "done":
            return {
                label: `✓ EXPORTED · ${state.files.length} note${state.files.length === 1 ? "" : "s"}`,
                tone: "border-caos-success text-caos-success",
                title: `Wrote: ${state.files.join(" · ")}`
            };
        case "error":
            return {
                label: "✗ EXPORT FAILED",
                tone: "border-caos-critical text-caos-critical-bright hover:bg-caos-critical hover:text-caos-bg",
                title: state.msg
            };
        default:
            return {
                label: "⬓ EXPORT TO VAULT",
                tone: "border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg",
                title: "Write this run to the Obsidian vault (hub + spoke notes)"
            };
    }
};
function ExportToVaultButton({ runId, className = "" }) {
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        kind: "idle"
    });
    async function onClick() {
        if (state.kind === "busy") return;
        setState({
            kind: "busy"
        });
        try {
            const { written } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["exportToVault"])(runId);
            setState({
                kind: "done",
                files: written
            });
        } catch (e) {
            const status = e?.response?.status;
            setState({
                kind: "error",
                msg: vaultExportError(status)
            });
        }
    }
    const { label, tone, title } = vaultPresentation(state);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        onClick: onClick,
        "aria-disabled": state.kind === "busy" || undefined,
        title: title,
        className: `${BASE} ${tone} ${className}`,
        children: label
    }, void 0, false, {
        fileName: "[project]/src/components/reports/ExportToVaultButton.tsx",
        lineNumber: 73,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/lib/format-date.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
}),
"[project]/src/lib/pipeline/sim-engine.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "initSim",
    ()=>initSim,
    "simClock",
    ()=>simClock,
    "stepSim",
    ()=>stepSim
]);
// Pure live-run simulation engine (port of design bundle shared/ui.jsx).
// Modules start when their deps clear (max 6 concurrent), progress per tick,
// and emit orchestrator events. No React — useSimRun (sim.ts) drives this on a
// timer. Kept separate so the scheduling logic is unit-testable and so type /
// clock consumers don't depend on the React hook.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/data.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/sev.ts [app-ssr] (ecmascript)");
;
;
function simClock(tick) {
    const s = 9 * 3600 + 30 * 60 + tick * 7; // 7 sim-seconds per tick
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor(s % 3600 / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
}
function initSim(plan) {
    const mods = {};
    plan.forEach((m)=>{
        mods[m.id] = {
            state: "idle",
            prog: 0
        };
    });
    return {
        mods,
        events: [],
        tick: 0,
        done: false
    };
}
function stepSim(sim, plan, complete) {
    const mods = {
        ...sim.mods
    };
    const events = sim.events.slice();
    const tick = sim.tick + 1;
    const t = simClock(tick);
    const doneStates = [
        "pass",
        "warning",
        "held",
        "blocked"
    ];
    const satisfied = (m)=>m.deps.every((d)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isCleared"])(mods[d]?.state));
    let runningCount = Object.values(mods).filter((m)=>m.state === "running").length;
    plan.forEach((m)=>{
        const cur = mods[m.id];
        if (cur.state === "running") {
            const prog = cur.prog + 1 / m.dur;
            if (prog >= 1) {
                const out = m.outcome === "idle" ? "idle" : m.outcome;
                mods[m.id] = {
                    state: out,
                    prog: 1
                };
                runningCount--;
                if (m.event) events.unshift({
                    t,
                    sev: out === "pass" ? "ok" : out,
                    text: m.event
                });
            } else {
                mods[m.id] = {
                    state: "running",
                    prog
                };
            }
        }
    });
    plan.forEach((m)=>{
        const cur = mods[m.id];
        if (cur.state === "idle" && m.outcome !== "idle" && satisfied(m) && runningCount < 6) {
            mods[m.id] = {
                state: "running",
                prog: 0.04
            };
            runningCount++;
            const meta = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MODULES"].find((x)=>x.id === m.id);
            events.unshift({
                t,
                sev: "running",
                text: `${m.id} started — ${meta ? meta.name : ""}`
            });
        }
    });
    const done = plan.every((m)=>m.outcome === "idle" ? true : doneStates.includes(mods[m.id].state));
    if (done && !sim.done) {
        const c = complete || {
            sev: "warning",
            text: "RUN COMPLETE — clearance CONDITIONAL · committee pack HELD on QA-117 remediation"
        };
        events.unshift({
            t,
            sev: c.sev,
            text: c.text
        });
    }
    return {
        mods,
        events: events.slice(0, 80),
        tick,
        done
    };
}
}),
"[project]/src/lib/pipeline/sim.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "planCounts",
    ()=>planCounts,
    "useSharedDayRun",
    ()=>useSharedDayRun,
    "useSimRun",
    ()=>useSimRun
]);
// React binding for the live-run simulation engine (sim-engine.ts). Steps the
// pure engine on a timer and exposes play/speed/reset controls plus the derived
// completed/total counts to the Pipeline Visualizer.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/data.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sim$2d$engine$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/sim-engine.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
function planCounts(plan, mods) {
    const graded = plan.filter((m)=>m.outcome !== "idle");
    return {
        total: graded.length,
        completed: mods ? graded.filter((m)=>[
                "pass",
                "warning",
                "held"
            ].includes(mods[m.id]?.state)).length : 0
    };
}
function useSimRun({ tickMs = 650, autoplay = true, prefill = false, plan, complete = null }) {
    const makeInit = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        let s = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sim$2d$engine$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["initSim"])(plan);
        if (prefill) {
            let guard = 0;
            while(!s.done && guard++ < 500)s = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sim$2d$engine$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["stepSim"])(s, plan, complete);
        }
        return s;
    }, [
        plan,
        prefill,
        complete
    ]);
    const [sim, setSim] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(makeInit);
    const [playing, setPlaying] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(autoplay && !prefill);
    const [speed, setSpeed] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(1);
    const planRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(plan);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (planRef.current === plan) return;
        planRef.current = plan;
        setSim(makeInit());
        setPlaying(autoplay && !prefill);
    }, [
        plan,
        autoplay,
        prefill,
        makeInit
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!playing || sim.done) return;
        const id = setInterval(()=>setSim((s)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sim$2d$engine$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["stepSim"])(s, plan, complete)), tickMs / speed);
        return ()=>clearInterval(id);
    }, [
        playing,
        speed,
        sim.done,
        plan,
        complete,
        tickMs
    ]);
    const reset = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        setSim((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sim$2d$engine$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["initSim"])(plan));
        setPlaying(true);
    }, [
        plan
    ]);
    const counts = planCounts(plan, sim.mods);
    return {
        sim,
        playing,
        setPlaying,
        speed,
        setSpeed,
        reset,
        clock: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sim$2d$engine$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["simClock"])(sim.tick),
        completed: counts.completed,
        total: counts.total
    };
}
let sharedState = {
    sim: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sim$2d$engine$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["initSim"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIM_PLAN"]),
    playing: true,
    speed: 1
};
let sharedIntervalId = null;
const sharedListeners = new Set();
const notifySharedDay = ()=>sharedListeners.forEach((l)=>l());
function stopSharedDayInterval() {
    if (sharedIntervalId !== null) {
        clearInterval(sharedIntervalId);
        sharedIntervalId = null;
    }
}
function startSharedDayInterval() {
    if (sharedIntervalId !== null || sharedListeners.size === 0 || !sharedState.playing || sharedState.sim.done) return;
    sharedIntervalId = setInterval(()=>{
        sharedState = {
            ...sharedState,
            sim: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sim$2d$engine$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["stepSim"])(sharedState.sim, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIM_PLAN"], null)
        };
        notifySharedDay();
        if (sharedState.sim.done) stopSharedDayInterval();
    }, 650 / sharedState.speed);
}
function useSharedDayRun() {
    const subscribe = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((cb)=>{
        sharedListeners.add(cb);
        startSharedDayInterval();
        return ()=>{
            sharedListeners.delete(cb);
            if (sharedListeners.size === 0) stopSharedDayInterval();
        };
    }, []);
    const getSnapshot = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>sharedState, []);
    const state = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useSyncExternalStore"])(subscribe, getSnapshot, getSnapshot);
    const setPlaying = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((p)=>{
        sharedState = {
            ...sharedState,
            playing: p
        };
        stopSharedDayInterval();
        if (p) startSharedDayInterval();
        notifySharedDay();
    }, []);
    const setSpeed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((s)=>{
        sharedState = {
            ...sharedState,
            speed: s
        };
        stopSharedDayInterval();
        startSharedDayInterval();
        notifySharedDay();
    }, []);
    const reset = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        stopSharedDayInterval();
        sharedState = {
            sim: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sim$2d$engine$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["initSim"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIM_PLAN"]),
            playing: true,
            speed: sharedState.speed
        };
        startSharedDayInterval();
        notifySharedDay();
    }, []);
    const { sim, playing, speed } = state;
    const counts = planCounts(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIM_PLAN"], sim.mods);
    return {
        sim,
        playing,
        setPlaying,
        speed,
        setSpeed,
        reset,
        clock: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sim$2d$engine$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["simClock"])(sim.tick),
        completed: counts.completed,
        total: counts.total
    };
}
}),
"[project]/src/components/shared/FirstRunHint.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FirstRunHint",
    ()=>FirstRunHint
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// Dismissible first-run hint: teaches a screen's core interaction once, then
// remembers the dismissal in localStorage so it never nags again. Restrained by
// design — a thin terse callout (desk "TIP", not a splashy product tour) that
// honors the "committee-ready, no noise" brand. Enter motion degrades under
// prefers-reduced-motion (via .caos-enter).
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
function FirstRunHint({ id, children, className = "" }) {
    const key = "caos-hint-" + id;
    // Default hidden so first paint never flashes the hint before we know whether
    // it was dismissed; reveal after the localStorage check.
    const [show, setShow] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        try {
            setShow(localStorage.getItem(key) !== "1");
        } catch  {
            setShow(true);
        }
    }, [
        key
    ]);
    if (!show) return null;
    const dismiss = ()=>{
        try {
            localStorage.setItem(key, "1");
        } catch  {}
        setShow(false);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "caos-enter flex items-start gap-2.5 rounded border border-caos-border px-3 py-1.5 " + className,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-accent mt-px shrink-0",
                children: "Tip"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/FirstRunHint.tsx",
                lineNumber: 35,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-caos-lg text-caos-muted leading-snug flex-1",
                children: children
            }, void 0, false, {
                fileName: "[project]/src/components/shared/FirstRunHint.tsx",
                lineNumber: 36,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: dismiss,
                "aria-label": "Dismiss hint",
                className: "shrink-0 rounded text-caos-muted hover:text-caos-text transition-caos text-caos-xl focus-ring",
                children: "✕"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/FirstRunHint.tsx",
                lineNumber: 37,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/FirstRunHint.tsx",
        lineNumber: 34,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/components/shared/Panel.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Panel",
    ()=>Panel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
const usePanelBody = (collapsed)=>{
    const [bodyElement, setBodyElement] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const bodyRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((element)=>setBodyElement(element), []);
    const [scrollable, setScrollable] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useLayoutEffect"])(()=>{
        const element = bodyElement;
        if (!element) {
            setScrollable(false);
            return;
        }
        const measure = ()=>setScrollable(element.scrollHeight > element.clientHeight + 1);
        measure();
        const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
        resizeObserver?.observe(element);
        for (const child of element.children)resizeObserver?.observe(child);
        const mutationObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver((records)=>{
            for (const record of records){
                for (const node of record.addedNodes){
                    if (node instanceof Element) resizeObserver?.observe(node);
                }
            }
            measure();
        });
        mutationObserver?.observe(element, {
            subtree: true,
            childList: true,
            characterData: true
        });
        return ()=>{
            resizeObserver?.disconnect();
            mutationObserver?.disconnect();
        };
    }, [
        bodyElement,
        collapsed
    ]);
    return {
        bodyRef,
        scrollable
    };
};
function PanelHeading({ Heading, title, collapsible, collapsed, bodyId, onToggle }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Heading, {
        className: "caos-panel-title m-0 min-w-0 flex-1 tabular font-semibold text-caos-text",
        children: collapsible ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
            type: "button",
            onClick: onToggle,
            className: "-ml-1 flex h-7 w-full min-w-0 items-center gap-1 rounded px-1 text-left transition-caos hover:bg-caos-elevated/50 focus-ring",
            "aria-expanded": !collapsed,
            "aria-controls": bodyId,
            "aria-label": collapsed ? `Expand ${title} panel` : `Collapse ${title} panel`,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                    viewBox: "0 0 16 16",
                    "aria-hidden": "true",
                    className: "h-3.5 w-3.5 shrink-0 stroke-current text-caos-muted",
                    fill: "none",
                    strokeWidth: "2.5",
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
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
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
function PanelBody({ collapsed, bodyId, bodyRef, scrollable, title, children }) {
    if (collapsed) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
function Panel({ title, right, children, className = "", as: Heading = "h2", collapsible = false, defaultCollapsed = false, onCollapse }) {
    const [collapsed, setCollapsed] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(defaultCollapsed);
    const bodyId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useId"])();
    const { bodyRef, scrollable } = usePanelBody(collapsed);
    const toggleLocal = ()=>setCollapsed((current)=>!current);
    const toggle = onCollapse ?? toggleLocal;
    // Only a body that actually clips needs to be a keyboard-focusable scroll
    // region — measure real overflow so a panel whose content fits isn't an inert
    // tab stop (a dense page had ~9 of them before every real action).
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "bg-caos-panel border border-caos-border rounded-md flex flex-col min-h-0 " + className,
        style: collapsed ? {
            flex: "none",
            height: "auto"
        } : undefined,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: `caos-panel-header min-h-8 shrink-0 px-3 flex flex-wrap items-center gap-2 bg-caos-elevated/20 ${collapsed ? "" : "border-b border-caos-border"}`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(PanelHeading, {
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
                    right ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(PanelBody, {
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
}),
"[project]/src/components/shared/CrossDefaultDominoes.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CrossDefaultDominoes",
    ()=>CrossDefaultDominoes
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// Cross-default dominoes — which tranches a single facility default pulls in
// (CP-3B tranche register × the CP-4C material-indebtedness threshold).
// Shared by Issuer Profile and Deep-Dive's Covenants tab (P3 wiring, WP-4
// G13) so the two surfaces read the identical live map, never two competing
// computations of the same contagion question. Fetched lazily; when the run
// extracted no threshold or tranches the server's own honest `note` renders
// instead of a fabricated map — same contract both callers rely on.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/Panel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function fmtMusd(value) {
    return Math.abs(value) >= 1000 ? "$" + (value / 1000).toFixed(1) + "bn" : "$" + value.toFixed(0) + "m";
}
function CrossDefaultDominoes({ issuerId, hasRun }) {
    const [map, setMap] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    // Distinct from "no run yet" (hasRun=false, nothing fetched): a genuine fetch
    // failure (500/timeout/etc) must render an explicit error, not collapse to
    // the same silent nothing as "not applicable".
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!hasRun) return;
        let stale = false;
        setError(false);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getCrossDefaultMap"])(issuerId).then((d)=>{
            if (!stale) setMap(d);
        }).catch(()=>{
            if (!stale) setError(true);
        });
        return ()=>{
            stale = true;
        };
    }, [
        issuerId,
        hasRun
    ]);
    if (!hasRun) return null;
    if (error) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Panel"], {
            title: "Cross-default dominoes · CP-3B / CP-4C",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Panel"], {
        title: "Cross-default dominoes · CP-3B / CP-4C",
        right: map.threshold_musd != null ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
        children: !computable ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "px-3 py-2.5 text-caos-md text-caos-muted",
            children: map.note || "No domino map for this run."
        }, void 0, false, {
            fileName: "[project]/src/components/shared/CrossDefaultDominoes.tsx",
            lineNumber: 53,
            columnNumber: 9
        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "text-caos-md divide-y divide-caos-border/30",
            children: map.dominoes.map((d)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "px-3 py-1.5 flex items-baseline gap-2 flex-wrap",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "tabular text-caos-sm text-caos-accent w-14 shrink-0",
                            children: d.code
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/CrossDefaultDominoes.tsx",
                            lineNumber: 58,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-caos-text text-caos-md truncate flex-1 min-w-0",
                            children: d.tranche
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/CrossDefaultDominoes.tsx",
                            lineNumber: 59,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "tabular text-caos-sm text-caos-muted shrink-0",
                            children: d.amount_musd != null ? fmtMusd(d.amount_musd) : "unsized"
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/CrossDefaultDominoes.tsx",
                            lineNumber: 60,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                        d.trips_cross_default === true && d.pulls_in.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "basis-full flex items-center gap-1 pl-16 flex-wrap",
                            children: d.pulls_in.map((p)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
}),
"[project]/src/lib/deepdive/layout-pref.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Deep-Dive module layout preference -- browser-local (localStorage), no server
// round-trip. The Deep-Dive page reads it on mount.
//   summary -- analysis body with compact workflow-step summary
//   report  -- conclusion-first module report with consolidated workflow cards
//   dense   -- max-density audit view with unconsolidated packed steps
__turbopack_context__.s([
    "DEFAULT_LAYOUT",
    ()=>DEFAULT_LAYOUT,
    "loadLayout",
    ()=>loadLayout,
    "saveLayout",
    ()=>saveLayout
]);
const DEFAULT_LAYOUT = "report";
const KEY = "caos.deepdive.layout";
const LEGACY = {
    core: "summary",
    base: "report",
    dense: "dense"
};
function loadLayout() {
    if ("TURBOPACK compile-time truthy", 1) return DEFAULT_LAYOUT;
    //TURBOPACK unreachable
    ;
}
function saveLayout(l) {
    try {
        localStorage.setItem(KEY, l);
    } catch  {
    /* private mode / quota — preference just doesn't persist */ }
}
}),
"[project]/src/components/shared/CollapseButton.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CollapseButton",
    ()=>CollapseButton
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
"use client";
;
function CollapseButton({ direction, label, onClick, className = "" }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        onClick: onClick,
        title: label,
        "aria-label": label,
        className: "w-6 h-6 rounded flex items-center justify-center text-caos-muted hover:text-caos-text hover:bg-caos-elevated transition-caos focus-ring " + className,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            viewBox: "0 0 16 16",
            "aria-hidden": "true",
            className: "w-4 h-4 stroke-current",
            fill: "none",
            strokeWidth: "3",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: direction === "left" ? "M10.5 3.5 6 8l4.5 4.5" : "M5.5 3.5 10 8l-4.5 4.5"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/CollapseButton.tsx",
                lineNumber: 26,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/shared/CollapseButton.tsx",
            lineNumber: 25,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/CollapseButton.tsx",
        lineNumber: 15,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/components/shared/RailShell.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RailShell",
    ()=>RailShell
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// Shared collapsible side-rail shell: a thin vertical strip with a toggle when
// collapsed, and the full panel stack when open. Centralizes the open/closed
// chrome shared by the Deep-Dive SourceRail and DecisionRail so the two rails
// stop hand-rolling the same structure. Phase 0 foundation — rails adopt this
// in Phase 1.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CollapseButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/CollapseButton.tsx [app-ssr] (ecmascript)");
"use client";
;
;
function RailShell({ open, onToggle, collapsed, expandTitle = "Expand", direction = "right", children }) {
    if (!open) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "caos-rail-shell caos-rail-shell--collapsed flex flex-col items-center gap-3 min-h-0 bg-caos-panel border border-caos-border rounded-md py-2.5",
            "data-open": "false",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CollapseButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CollapseButton"], {
                    direction: direction,
                    label: expandTitle,
                    onClick: onToggle
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/RailShell.tsx",
                    lineNumber: 33,
                    columnNumber: 9
                }, this),
                collapsed
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/shared/RailShell.tsx",
            lineNumber: 29,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "caos-rail-shell caos-rail-shell--open flex flex-col gap-2 min-h-0",
        "data-open": "true",
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/shared/RailShell.tsx",
        lineNumber: 39,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/components/deepdive/rails.tsx [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DecisionRail",
    ()=>DecisionRail,
    "SourceRail",
    ()=>SourceRail
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// Deep-dive side rails: source register + CP-5B evidence trace (left),
// CP-5 clearance + IC verdict + sizing + armed triggers (right)
// (port of design bundle concept-c-app.jsx SourceRail / DecisionRail).
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/reports/deal.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/data.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/pipeline/atoms.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/Panel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CollapseButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/CollapseButton.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RailShell$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/RailShell.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$evidence$2d$sync$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/evidence-sync.tsx [app-ssr] (ecmascript)");
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
// For a non-reference issuer, do not render ATLF rail fixtures as stand-ins.
// The live engine output for the issuer is in the centre pane.
function NoIssuerRailOutput({ code, onCollapse }) {
    const who = code && code !== "—" ? code : "this issuer";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        role: "note",
        className: "bg-caos-panel border rounded-md px-3 py-2 shrink-0",
        style: {
            borderColor: "color-mix(in srgb, var(--caos-warning) 45%, transparent)"
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs uppercase tracking-wider",
                        style: {
                            color: "var(--caos-warning)"
                        },
                        children: "No issuer-specific rail output"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/rails.tsx",
                        lineNumber: 25,
                        columnNumber: 9
                    }, this),
                    onCollapse ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CollapseButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CollapseButton"], {
                        direction: "right",
                        label: "Collapse decision rail",
                        onClick: onCollapse,
                        className: "ml-auto"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/rails.tsx",
                        lineNumber: 27,
                        columnNumber: 11
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/rails.tsx",
                lineNumber: 24,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-caos-md text-caos-text leading-snug mt-0.5",
                children: [
                    "CP-0/CP-5B rail registers and committee output are not wired for ",
                    who,
                    " ",
                    "yet. Use the center module views for live engine output; the reference deal's seeded rail figures are hidden."
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/rails.tsx",
                lineNumber: 30,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/rails.tsx",
        lineNumber: 23,
        columnNumber: 5
    }, this);
}
// CP-5C reviewer seats keyed by the audit lane their findings carry
// (engine/council.py). Diversity is by review lens, not vendor.
const SEAT_BY_LANE = {
    2: "Numerical Consistency",
    3: "Covenant Construction",
    4: "Evidence Sufficiency",
    5: "Devil's Advocate"
};
// Map a finding severity to a Tag tone (severity text label carries meaning too,
// so this is never color-alone).
const SEV_TAG = {
    CRITICAL: "critical",
    MATERIAL: "warning",
    MINOR: "low"
};
// Committee Review (CP-5C): live semantic-review findings, grouped by seat.
// Opt-in on the backend; empty here in the offline/seeded demo, where it
// documents the capability without implying a fault.
function CouncilReview({ council, state }) {
    const ordered = [
        ...council
    ].sort((a, b)=>(a.lane ?? 99) - (b.lane ?? 99) || a.finding_id.localeCompare(b.finding_id));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Panel"], {
        title: "Committee Review · CP-5C",
        className: "shrink-0",
        children: state !== "ready" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            role: state === "error" ? "alert" : "status",
            className: "px-3 py-2.5 text-caos-lg text-caos-muted leading-snug",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "tabular text-caos-xs uppercase tracking-wider text-caos-warning",
                    children: "△ Committee review unknown"
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/rails.tsx",
                    lineNumber: 65,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mt-1",
                    children: state === "loading" ? "Checking CP-5C findings…" : state === "error" ? "CP-5C findings could not be read; do not infer an all-clear." : "A completed run is required to establish CP-5C findings."
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/rails.tsx",
                    lineNumber: 66,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/deepdive/rails.tsx",
            lineNumber: 64,
            columnNumber: 9
        }, this) : ordered.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "px-3 py-2.5 text-caos-lg text-caos-muted leading-snug",
            children: "No live committee findings. CP-5C runs an adversarial reviewer panel when enabled; flagged reasoning surfaces here and gates the run alongside CP-5B."
        }, void 0, false, {
            fileName: "[project]/src/components/deepdive/rails.tsx",
            lineNumber: 69,
            columnNumber: 9
        }, this) : // fallow-ignore-next-line complexity -- Static finding-row projection keeps severity and evidence local.
        ordered.map((f)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-3 py-2 border-b border-caos-border/50",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Tag"], {
                                sev: SEV_TAG[f.severity] || "low",
                                children: f.severity
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                lineNumber: 78,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted truncate",
                                children: SEAT_BY_LANE[f.lane ?? 0] || `Lane ${f.lane ?? "—"}`
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                lineNumber: 79,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/rails.tsx",
                        lineNumber: 77,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-caos-lg text-caos-text leading-snug mt-1",
                        children: f.description
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/rails.tsx",
                        lineNumber: 83,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "tabular text-caos-2xs text-caos-muted mt-1 flex gap-2 whitespace-nowrap",
                        children: [
                            f.module_id ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: f.module_id
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                lineNumber: 85,
                                columnNumber: 30
                            }, this) : null,
                            f.affected_claim_id ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: [
                                    "claim ",
                                    f.affected_claim_id
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                lineNumber: 86,
                                columnNumber: 38
                            }, this) : null
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/rails.tsx",
                        lineNumber: 84,
                        columnNumber: 13
                    }, this),
                    f.required_remediation ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-caos-2xs text-caos-muted leading-snug mt-1",
                        children: [
                            "→ ",
                            f.required_remediation
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/rails.tsx",
                        lineNumber: 89,
                        columnNumber: 15
                    }, this) : null
                ]
            }, f.finding_id, true, {
                fileName: "[project]/src/components/deepdive/rails.tsx",
                lineNumber: 76,
                columnNumber: 11
            }, this))
    }, void 0, false, {
        fileName: "[project]/src/components/deepdive/rails.tsx",
        lineNumber: 62,
        columnNumber: 5
    }, this);
}
function SourceRail({ ev, open, onToggle, isReference = true, issuerCode, issuerName }) {
    const { active, setActive } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$evidence$2d$sync$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEvidenceSync"])();
    const code = isReference ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].code : issuerCode || "—";
    const name = isReference ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].name : issuerName || "Issuer";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RailShell$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["RailShell"], {
        open: open,
        onToggle: onToggle,
        expandTitle: "Expand source rail",
        direction: "right",
        collapsed: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "tabular text-caos-md text-caos-accent",
                    style: {
                        writingMode: "vertical-rl"
                    },
                    children: code
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/rails.tsx",
                    lineNumber: 127,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "tabular text-caos-2xs uppercase tracking-widest text-caos-muted",
                    style: {
                        writingMode: "vertical-rl"
                    },
                    children: "Source register · Evidence trace"
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/rails.tsx",
                    lineNumber: 128,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-caos-panel border border-caos-border rounded-md px-3 py-2.5 shrink-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "tabular text-caos-2xl text-caos-accent",
                                children: code
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                lineNumber: 134,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-caos-2xl font-semibold text-caos-text",
                                children: name
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                lineNumber: 135,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CollapseButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CollapseButton"], {
                                direction: "left",
                                label: "Collapse source rail",
                                onClick: onToggle,
                                className: "ml-auto"
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                lineNumber: 136,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/rails.tsx",
                        lineNumber: 133,
                        columnNumber: 9
                    }, this),
                    isReference ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-caos-sm text-caos-muted mt-1 leading-relaxed",
                                children: [
                                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].sector,
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/rails.tsx",
                                        lineNumber: 140,
                                        columnNumber: 93
                                    }, this),
                                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].sponsor
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                lineNumber: 140,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex gap-3 mt-1.5 tabular text-caos-sm",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-caos-muted",
                                        children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].rating
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/rails.tsx",
                                        lineNumber: 142,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-caos-text",
                                        children: [
                                            "LTM adj. EBITDA $",
                                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].ebitda,
                                            "M"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/deepdive/rails.tsx",
                                        lineNumber: 143,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-caos-text",
                                        children: [
                                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].netLev,
                                            "x"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/deepdive/rails.tsx",
                                        lineNumber: 144,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                lineNumber: 141,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/rails.tsx",
                lineNumber: 132,
                columnNumber: 7
            }, this),
            !isReference ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(NoIssuerRailOutput, {
                code: code
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/rails.tsx",
                lineNumber: 149,
                columnNumber: 23
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Panel"], {
                        title: "Source Register · CP-0",
                        className: "flex-[2]",
                        children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DOCS"].map((d)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                disabled: true,
                                title: "Source pointer only; no URL is attached in this demo register.",
                                className: "block w-full text-left px-3 py-[5.5px] border-b border-caos-border/50 hover:bg-caos-elevated/60 transition-caos disabled:cursor-default disabled:hover:bg-transparent focus-ring",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-caos-lg text-caos-text truncate flex-1",
                                                children: d.name
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                                lineNumber: 161,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "tabular text-caos-xs px-1 rounded border",
                                                style: {
                                                    color: d.grade === "A" ? "var(--caos-success)" : d.grade === "B" ? "var(--caos-warning)" : "var(--caos-critical)",
                                                    borderColor: "currentColor"
                                                },
                                                children: d.grade
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                                lineNumber: 162,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/deepdive/rails.tsx",
                                        lineNumber: 160,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "tabular text-caos-2xs text-caos-muted mt-0.5 flex gap-2 whitespace-nowrap",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: d.id
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                                lineNumber: 165,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: d.type
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                                lineNumber: 165,
                                                columnNumber: 40
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: [
                                                    d.pages,
                                                    "pp"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                                lineNumber: 165,
                                                columnNumber: 61
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: d.date
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                                lineNumber: 165,
                                                columnNumber: 85
                                            }, this),
                                            d.mnpi ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                style: {
                                                    color: "var(--caos-warning)"
                                                },
                                                children: "MNPI"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                                lineNumber: 166,
                                                columnNumber: 31
                                            }, this) : null
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/deepdive/rails.tsx",
                                        lineNumber: 164,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, d.id, true, {
                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                lineNumber: 153,
                                columnNumber: 17
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/rails.tsx",
                        lineNumber: 151,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Panel"], {
                        title: "Evidence Trace · CP-5B drivers",
                        className: "flex-[3]",
                        children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DRIVERS"].map((d)=>{
                            const hot = !!(active && d.evs.includes(active)) || !!(ev && d.evs.includes(ev));
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                tabIndex: 0,
                                "aria-label": `Evidence for driver ${d.n}: ${d.driver}`,
                                onMouseEnter: ()=>setActive(d.evs[0]),
                                onMouseLeave: ()=>setActive(null),
                                onFocus: ()=>setActive(d.evs[0]),
                                onBlur: ()=>setActive(null),
                                className: "px-3 py-2 border-b border-caos-border/50 transition-caos " + (hot ? "caos-selected bg-caos-elevated relative z-[5]" : "hover:bg-caos-elevated/60"),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-start gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "tabular text-caos-xs text-caos-muted mt-px",
                                                children: [
                                                    "#",
                                                    d.n
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                                lineNumber: 187,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-caos-md text-caos-text leading-snug flex-1",
                                                children: d.driver
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                                lineNumber: 188,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Tag"], {
                                                sev: d.status === "verified" ? "ok" : "warning",
                                                children: d.status
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                                lineNumber: 189,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/deepdive/rails.tsx",
                                        lineNumber: 186,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "tabular text-caos-2xs text-caos-muted mt-1 leading-relaxed pl-4",
                                        children: d.lineage
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/rails.tsx",
                                        lineNumber: 191,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-1.5 mt-1 pl-4",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Bar"], {
                                                pct: d.conf * 100,
                                                color: d.conf > 0.7 ? "var(--caos-success)" : "var(--caos-warning)",
                                                h: 2
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                                lineNumber: 193,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "tabular text-caos-2xs text-caos-muted shrink-0",
                                                children: [
                                                    "conf ",
                                                    (d.conf * 100).toFixed(0),
                                                    "%"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                                lineNumber: 194,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/deepdive/rails.tsx",
                                        lineNumber: 192,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, d.n, true, {
                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                lineNumber: 176,
                                columnNumber: 17
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/rails.tsx",
                        lineNumber: 171,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/rails.tsx",
        lineNumber: 120,
        columnNumber: 5
    }, this);
}
function DecisionRail({ open, onToggle, council = [], councilState = "ready", isReference = true, issuerCode }) {
    const code = isReference ? undefined : issuerCode || "—";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RailShell$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["RailShell"], {
        open: open,
        onToggle: onToggle,
        expandTitle: "Expand decision rail",
        direction: "left",
        collapsed: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "text-caos-xl",
                    style: {
                        color: "var(--caos-warning)"
                    },
                    "aria-hidden": "true",
                    children: "⛨"
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/rails.tsx",
                    lineNumber: 230,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "tabular text-caos-2xs uppercase tracking-widest",
                    style: {
                        writingMode: "vertical-rl",
                        color: "var(--caos-warning)"
                    },
                    children: "CP-5 conditional"
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/rails.tsx",
                    lineNumber: 231,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "tabular text-caos-2xs uppercase tracking-widest text-caos-muted",
                    style: {
                        writingMode: "vertical-rl"
                    },
                    children: "Verdict · Sizing · Triggers"
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/rails.tsx",
                    lineNumber: 232,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true),
        children: [
            isReference ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-caos-panel border rounded-md px-3 py-2.5 shrink-0",
                style: {
                    borderColor: "color-mix(in srgb, var(--caos-warning) 45%, transparent)"
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-caos-2xl",
                                style: {
                                    color: "var(--caos-warning)"
                                },
                                "aria-hidden": "true",
                                children: "⛨"
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                lineNumber: 239,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                                children: "CP-5 clearance"
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                lineNumber: 240,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "tabular text-caos-2xl uppercase tracking-wide font-semibold",
                                style: {
                                    color: "var(--caos-warning)"
                                },
                                children: "CONDITIONAL"
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                lineNumber: 241,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CollapseButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CollapseButton"], {
                                direction: "right",
                                label: "Collapse decision rail",
                                onClick: onToggle,
                                className: "ml-auto"
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                lineNumber: 242,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/rails.tsx",
                        lineNumber: 238,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-caos-lg text-caos-text mt-1.5 leading-snug",
                        children: "QA-117 (HIGH) open — citation E-44 page mismatch. Committee pack assembly HELD; debate verdict stands ex-E-44."
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/rails.tsx",
                        lineNumber: 244,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/rails.tsx",
                lineNumber: 237,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(NoIssuerRailOutput, {
                code: code,
                onCollapse: onToggle
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/rails.tsx",
                lineNumber: 249,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(CouncilReview, {
                council: council,
                state: councilState
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/rails.tsx",
                lineNumber: 252,
                columnNumber: 7
            }, this),
            isReference ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Panel"], {
                title: "IC Verdict · CP-6A",
                className: "shrink-0",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "px-3 py-2.5",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1",
                            children: "Recommendation bias"
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/rails.tsx",
                            lineNumber: 256,
                            columnNumber: 11
                        }, this),
                        (()=>{
                            const [head, ...rest] = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEBATE"].bias.split(" — ");
                            const tail = rest.join(" — ");
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-caos-display font-bold",
                                        style: {
                                            color: "var(--caos-success-bright)"
                                        },
                                        children: head
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/rails.tsx",
                                        lineNumber: 264,
                                        columnNumber: 17
                                    }, this),
                                    tail ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-caos-md text-caos-text mt-1 leading-snug",
                                        children: [
                                            "— ",
                                            tail
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/deepdive/rails.tsx",
                                        lineNumber: 265,
                                        columnNumber: 25
                                    }, this) : null
                                ]
                            }, void 0, true);
                        })(),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted mt-3 mb-1",
                            children: "Single greatest uncertainty"
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/rails.tsx",
                            lineNumber: 269,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-caos-lg text-caos-text leading-snug",
                            children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEBATE"].uncertainty
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/rails.tsx",
                            lineNumber: 270,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted mt-3 mb-1",
                            children: "Chair final memo"
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/rails.tsx",
                            lineNumber: 271,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-caos-lg text-caos-muted leading-relaxed",
                            children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEBATE"].memo
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/rails.tsx",
                            lineNumber: 272,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/deepdive/rails.tsx",
                    lineNumber: 255,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/rails.tsx",
                lineNumber: 254,
                columnNumber: 22
            }, this) : null,
            isReference ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Panel"], {
                title: "Sizing & Posture · CP-6E",
                className: "shrink-0",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "px-3 py-2.5",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-caos-2xl text-caos-text font-medium",
                            children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIZING"].decision
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/rails.tsx",
                            lineNumber: 278,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid grid-cols-3 gap-2 mt-2 items-start",
                            children: [
                                [
                                    "Initial",
                                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIZING"].initial
                                ],
                                [
                                    "Max",
                                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIZING"].max
                                ],
                                [
                                    "Entry",
                                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIZING"].entry
                                ]
                            ].map(([l, v])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "tabular text-caos-2xs uppercase text-caos-muted",
                                            children: l
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/rails.tsx",
                                            lineNumber: 285,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "tabular text-caos-lg text-caos-text mt-0.5 leading-tight",
                                            children: v.split(" / ").map((part, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "block whitespace-nowrap",
                                                    children: part
                                                }, i, false, {
                                                    fileName: "[project]/src/components/deepdive/rails.tsx",
                                                    lineNumber: 288,
                                                    columnNumber: 21
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/rails.tsx",
                                            lineNumber: 286,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, l, true, {
                                    fileName: "[project]/src/components/deepdive/rails.tsx",
                                    lineNumber: 284,
                                    columnNumber: 15
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/rails.tsx",
                            lineNumber: 282,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-caos-lg text-caos-muted leading-snug mt-2",
                            children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIZING"].constraint
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/rails.tsx",
                            lineNumber: 294,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/deepdive/rails.tsx",
                    lineNumber: 277,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/rails.tsx",
                lineNumber: 276,
                columnNumber: 22
            }, this) : null,
            isReference ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Panel"], {
                title: "Triggers Armed → CP-MON",
                className: "flex-1",
                children: [
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TRIGGERS"].map((tr)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "px-3 py-[6px] border-b border-caos-border/50 flex items-start gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Dot"], {
                                    sev: tr.sev
                                }, void 0, false, {
                                    fileName: "[project]/src/components/deepdive/rails.tsx",
                                    lineNumber: 301,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-caos-lg text-caos-text leading-snug",
                                            children: tr.text
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/rails.tsx",
                                            lineNumber: 303,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "tabular text-caos-2xs text-caos-muted mt-0.5",
                                            children: [
                                                tr.id,
                                                " · on trip → ",
                                                tr.owner
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/deepdive/rails.tsx",
                                            lineNumber: 304,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/deepdive/rails.tsx",
                                    lineNumber: 302,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, tr.id, true, {
                            fileName: "[project]/src/components/deepdive/rails.tsx",
                            lineNumber: 300,
                            columnNumber: 11
                        }, this)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "px-3 py-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1",
                                children: "Add / trim discipline"
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/rails.tsx",
                                lineNumber: 309,
                                columnNumber: 11
                            }, this),
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIZING"].addTriggers.map((x, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-caos-lg text-caos-muted leading-snug flex gap-1.5",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            style: {
                                                color: "var(--caos-success)"
                                            },
                                            children: "+"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/rails.tsx",
                                            lineNumber: 311,
                                            columnNumber: 93
                                        }, this),
                                        x
                                    ]
                                }, i, true, {
                                    fileName: "[project]/src/components/deepdive/rails.tsx",
                                    lineNumber: 311,
                                    columnNumber: 13
                                }, this)),
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIZING"].trimTriggers.map((x, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-caos-lg text-caos-muted leading-snug flex gap-1.5",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            style: {
                                                color: "var(--caos-critical-bright)"
                                            },
                                            children: "−"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/rails.tsx",
                                            lineNumber: 314,
                                            columnNumber: 93
                                        }, this),
                                        x
                                    ]
                                }, i, true, {
                                    fileName: "[project]/src/components/deepdive/rails.tsx",
                                    lineNumber: 314,
                                    columnNumber: 13
                                }, this))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/rails.tsx",
                        lineNumber: 308,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/rails.tsx",
                lineNumber: 298,
                columnNumber: 22
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/rails.tsx",
        lineNumber: 223,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/components/deepdive/ModuleFinder.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ModuleFinder",
    ()=>ModuleFinder
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// Searchable module finder for Deep-Dive's 19-module launcher — ⌘M opens a
// combobox over MODULES (id/name/description), roving arrow-key focus.
// Pins/recents persist to the analyst's workspace settings
// (updateAnalystWorkspace, P2-WP-0's read-modify-write wrapper); on a 404
// (local-dev bypass identity with no profile row) they simply stay
// local-only for the session — no error surfaced, matching
// RoleViewProvider's same fallback contract. The existing 7-group accordion
// stays mounted as browse-all; this is an additive fast path, not a
// replacement.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/data.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ModalBackdrop.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/use-modal-a11y.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$list$2d$focus$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/use-modal-list-focus.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
;
const MAX_PINS = 12;
const MAX_RECENTS = 8;
const finderKeyAction = (key)=>({
        ArrowDown: "next",
        ArrowUp: "previous",
        Enter: "select"
    })[key] ?? null;
const moveFinderSelection = (current, action, resultCount)=>action === "next" ? Math.min(current + 1, resultCount - 1) : Math.max(current - 1, 0);
function ModuleShortcut({ module, active, pinned, onSelect }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        onClick: ()=>onSelect(module.id),
        title: module.name,
        "aria-current": active ? "true" : undefined,
        className: "tabular text-caos-sm px-2 min-h-8 rounded border transition-caos focus-ring whitespace-nowrap shrink-0 caos-target " + (active ? "bg-caos-elevated text-caos-text border-caos-accent" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50"),
        children: [
            pinned ? "★ " : "",
            module.id
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/ModuleFinder.tsx",
        lineNumber: 46,
        columnNumber: 5
    }, this);
}
function readList(ws, key) {
    const v = ws?.[key];
    return Array.isArray(v) ? v.filter((x)=>typeof x === "string") : [];
}
function ModuleFinder({ onSelect, activeId }) {
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [pins, setPins] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [recents, setRecents] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        let alive = true;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getAnalystSettings"])().then((s)=>{
            if (!alive) return;
            setPins(readList(s.workspace, "deepdive_pins"));
            setRecents(readList(s.workspace, "deepdive_recents"));
        }).catch(()=>{
        // No profile row (local-dev bypass) — pins/recents stay empty/local
        // for this session; togglePin/select below still update local state.
        });
        return ()=>{
            alive = false;
        };
    }, []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const onKey = (e)=>{
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "m") {
                const target = e.target;
                if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
                e.preventDefault();
                setOpen((v)=>!v);
            }
        };
        window.addEventListener("keydown", onKey);
        return ()=>window.removeEventListener("keydown", onKey);
    }, []);
    const togglePin = (id)=>{
        const next = pins.includes(id) ? pins.filter((p)=>p !== id) : [
            id,
            ...pins
        ].slice(0, MAX_PINS);
        setPins(next);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["updateAnalystWorkspace"])((ws)=>({
                ...ws,
                deepdive_pins: next
            })).catch(()=>{});
    };
    const select = (id)=>{
        onSelect(id);
        setOpen(false);
        const next = [
            id,
            ...recents.filter((r)=>r !== id)
        ].slice(0, MAX_RECENTS);
        setRecents(next);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["updateAnalystWorkspace"])((ws)=>({
                ...ws,
                deepdive_recents: next
            })).catch(()=>{});
    };
    const pinnedMods = pins.map((id)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MODULES"].find((m)=>m.id === id)).filter((m)=>!!m);
    const recentMods = recents.filter((id)=>!pins.includes(id)).slice(0, 4).map((id)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MODULES"].find((m)=>m.id === id)).filter((m)=>!!m);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>setOpen(true),
                title: "Find a module by id or name (⌘M)",
                className: "tabular text-caos-2xs uppercase tracking-wider px-1.5 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring whitespace-nowrap shrink-0 caos-target",
                children: "⌘M find module…"
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/ModuleFinder.tsx",
                lineNumber: 130,
                columnNumber: 7
            }, this),
            pinnedMods.map((module)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ModuleShortcut, {
                    module: module,
                    active: activeId === module.id,
                    pinned: true,
                    onSelect: select
                }, module.id, false, {
                    fileName: "[project]/src/components/deepdive/ModuleFinder.tsx",
                    lineNumber: 138,
                    columnNumber: 35
                }, this)),
            recentMods.map((module)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ModuleShortcut, {
                    module: module,
                    active: activeId === module.id,
                    pinned: false,
                    onSelect: select
                }, module.id, false, {
                    fileName: "[project]/src/components/deepdive/ModuleFinder.tsx",
                    lineNumber: 139,
                    columnNumber: 35
                }, this)),
            open ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ModuleFinderModal, {
                onClose: ()=>setOpen(false),
                onSelect: select,
                pins: pins,
                onTogglePin: togglePin
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/ModuleFinder.tsx",
                lineNumber: 140,
                columnNumber: 15
            }, this) : null
        ]
    }, void 0, true);
}
function ModuleFinderModal({ onClose, onSelect, pins, onTogglePin }) {
    const panelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useModalA11y"])(onClose);
    const [query, setQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [active, setActive] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const inputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$list$2d$focus$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useModalListFocus"])(active, "module-finder-row-");
    const results = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        const q = query.trim().toLowerCase();
        if (!q) return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MODULES"];
        return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MODULES"].filter((m)=>m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q));
    }, [
        query
    ]);
    const onKeyDown = (e)=>{
        const action = finderKeyAction(e.key);
        if (!action) return;
        e.preventDefault();
        if (action === "select") {
            const selected = results[active];
            if (selected) onSelect(selected.id);
            return;
        }
        setActive((current)=>moveFinderSelection(current, action, results.length));
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ModalBackdrop"], {
        onClose: onClose,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            ref: panelRef,
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "Find module",
            onClick: (e)=>e.stopPropagation(),
            className: "w-[520px] max-w-[92vw] max-h-[70vh] flex flex-col rounded-md border border-caos-border bg-caos-panel shadow-2xl overflow-hidden",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "border-b border-caos-border px-3",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        ref: inputRef,
                        name: "module-finder",
                        autoComplete: "off",
                        role: "combobox",
                        "aria-label": "Find a module",
                        "aria-expanded": "true",
                        "aria-controls": "module-finder-listbox",
                        "aria-activedescendant": results[active] ? `module-finder-row-${active}` : undefined,
                        value: query,
                        onChange: (e)=>{
                            setQuery(e.target.value);
                            setActive(0);
                        },
                        onKeyDown: onKeyDown,
                        placeholder: "Find a module by id or name…",
                        className: "w-full bg-transparent outline-none tabular text-caos-md text-caos-text placeholder:text-caos-muted min-h-11"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/ModuleFinder.tsx",
                        lineNumber: 192,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/ModuleFinder.tsx",
                    lineNumber: 191,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                    id: "module-finder-listbox",
                    role: "listbox",
                    "aria-label": "Modules",
                    className: "flex-1 overflow-y-auto py-1",
                    children: [
                        results.map((m, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                id: `module-finder-row-${i}`,
                                role: "option",
                                "aria-selected": i === active,
                                onMouseEnter: ()=>setActive(i),
                                onMouseDown: (e)=>{
                                    e.preventDefault();
                                    onSelect(m.id);
                                },
                                className: "flex items-center gap-2 px-3 min-h-9 py-1.5 cursor-pointer caos-target " + (i === active ? "bg-caos-elevated" : ""),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "tabular text-caos-2xs uppercase tracking-widest text-caos-accent w-14 shrink-0",
                                        children: m.id
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/ModuleFinder.tsx",
                                        lineNumber: 228,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "tabular text-caos-md text-caos-text truncate flex-1 min-w-0",
                                        children: m.name
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/ModuleFinder.tsx",
                                        lineNumber: 229,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onMouseDown: (e)=>{
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onTogglePin(m.id);
                                        },
                                        "aria-pressed": pins.includes(m.id),
                                        title: pins.includes(m.id) ? "Unpin" : "Pin",
                                        className: "tabular text-caos-sm px-1 min-h-8 min-w-8 rounded hover:bg-caos-bg/60 focus-ring caos-target shrink-0",
                                        children: pins.includes(m.id) ? "★" : "☆"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/deepdive/ModuleFinder.tsx",
                                        lineNumber: 230,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, m.id, true, {
                                fileName: "[project]/src/components/deepdive/ModuleFinder.tsx",
                                lineNumber: 213,
                                columnNumber: 13
                            }, this)),
                        results.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                            className: "px-3 py-4 tabular text-caos-xs text-caos-muted",
                            children: "no matching module"
                        }, void 0, false, {
                            fileName: "[project]/src/components/deepdive/ModuleFinder.tsx",
                            lineNumber: 246,
                            columnNumber: 13
                        }, this) : null
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/deepdive/ModuleFinder.tsx",
                    lineNumber: 211,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/deepdive/ModuleFinder.tsx",
            lineNumber: 183,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/deepdive/ModuleFinder.tsx",
        lineNumber: 182,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/components/shared/ProvenanceChip.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ProvenanceChip",
    ()=>ProvenanceChip
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: CHIP,
        style: freshnessStyle(freshness),
        children: freshness
    }, void 0, false, {
        fileName: "[project]/src/components/shared/ProvenanceChip.tsx",
        lineNumber: 42,
        columnNumber: 10
    }, this);
}
function MethodChip({ method }) {
    if (!method) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
function ProvenanceChip({ prov, className = "" }) {
    const originColor = ORIGIN_VAR[prov.origin];
    const title = [
        prov.detail,
        prov.asOf ? `as of ${prov.asOf}` : null
    ].filter(Boolean).join(" · ") || undefined;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "inline-flex items-center gap-1 shrink-0 " + className,
        title: title,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: CHIP,
                style: originStyle(prov.origin, originColor),
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(FreshnessChip, {
                freshness: prov.freshness
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ProvenanceChip.tsx",
                lineNumber: 71,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(MethodChip, {
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
}),
"[project]/src/components/deepdive/StandingViewStrip.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StandingViewStrip",
    ()=>StandingViewStrip
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// Deep-Dive's decision-first opener: the standing view (posture/conviction)
// leads the workspace, above the module content. Sourced from EXACTLY the
// same fixture DecisionRail already renders (DEBATE.bias / SIZING.decision,
// components/reports/deal.ts) — the reference issuer's CP-6A/CP-6E content is
// fixture-only today (rails.tsx gates it on `isReference`, no live
// equivalent exists yet), so a real issuer honestly shows "no standing view"
// rather than inventing one.
//
// Affirm/Revise are PERSONAL ANNOTATIONS, not a governance action — no
// server-side CP-6 write path exists. They persist to the analyst's
// workspace settings (workspace.affirmations, capped at 20, P2-WP-0) via the
// same read-modify-write wrapper every workspace writer uses.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/reports/deal.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ProvenanceChip$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ProvenanceChip.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ActionReason.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
const MAX_AFFIRMATIONS = 20;
function StandingViewStrip({ isReference, issuerId, runId, onRevise }) {
    const [saveState, setSaveState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("idle");
    if (!isReference) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex items-center gap-2 px-3 min-h-9 border-b border-caos-border bg-caos-panel/40 shrink-0",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ProvenanceChip$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ProvenanceChip"], {
                    prov: {
                        origin: "LIVE",
                        detail: "No CP-6 verdict has run for this issuer yet."
                    }
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/StandingViewStrip.tsx",
                    lineNumber: 48,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "tabular text-caos-sm text-caos-muted",
                    children: "No standing view — run CP-6 to establish one."
                }, void 0, false, {
                    fileName: "[project]/src/components/deepdive/StandingViewStrip.tsx",
                    lineNumber: 49,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/deepdive/StandingViewStrip.tsx",
            lineNumber: 47,
            columnNumber: 7
        }, this);
    }
    const [head, ...rest] = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEBATE"].bias.split(" — ");
    const tail = rest.join(" — ");
    const affirm = ()=>{
        setSaveState("saving");
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["updateAnalystWorkspace"])((ws)=>{
            const prior = Array.isArray(ws.affirmations) ? ws.affirmations : [];
            const next = [
                {
                    issuerId,
                    runId,
                    stance: head,
                    ts: new Date().toISOString()
                },
                ...prior
            ].slice(0, MAX_AFFIRMATIONS);
            return {
                ...ws,
                affirmations: next
            };
        }).then(()=>setSaveState("saved")).catch(()=>setSaveState("idle"));
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center gap-3 px-3 min-h-9 border-b border-caos-border bg-caos-panel/40 shrink-0",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ProvenanceChip$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ProvenanceChip"], {
                prov: {
                    origin: "DEMO",
                    detail: "Atlas Forge reference fixture — not a live issuer verdict."
                }
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/StandingViewStrip.tsx",
                lineNumber: 73,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 min-w-0 flex items-baseline gap-2 truncate",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-md font-semibold",
                        style: {
                            color: "var(--caos-success-bright)"
                        },
                        children: head
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/StandingViewStrip.tsx",
                        lineNumber: 75,
                        columnNumber: 9
                    }, this),
                    tail ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-sm text-caos-muted truncate",
                        children: [
                            "— ",
                            tail
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/StandingViewStrip.tsx",
                        lineNumber: 76,
                        columnNumber: 17
                    }, this) : null,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-sm text-caos-muted whitespace-nowrap",
                        children: [
                            "· conviction: ",
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIZING"].decision
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/StandingViewStrip.tsx",
                        lineNumber: 77,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/StandingViewStrip.tsx",
                lineNumber: 74,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ActionReason"], {
                onClick: affirm,
                reason: saveState === "saving" ? "Saving…" : null,
                className: "tabular text-caos-xs px-2 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring aria-disabled:opacity-50 caos-target",
                children: saveState === "saved" ? "Noted" : "Note agreement"
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/StandingViewStrip.tsx",
                lineNumber: 79,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>onRevise("CP-6A"),
                className: "tabular text-caos-xs px-2 min-h-8 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring caos-target",
                children: "Revise"
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/StandingViewStrip.tsx",
                lineNumber: 86,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-3xs text-caos-muted whitespace-nowrap",
                title: "Note agreement / Revise write a personal note to your own workspace settings — there is no server-side CP-6 write path, so this never changes the committee record.",
                children: "personal annotation, not a governance action"
            }, void 0, false, {
                fileName: "[project]/src/components/deepdive/StandingViewStrip.tsx",
                lineNumber: 93,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/StandingViewStrip.tsx",
        lineNumber: 72,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/lib/deepdive/caveat.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Deep-Dive honesty caveat — decides what disclaimer the sub-header shows for
// the resolved issuer. The bespoke debate/recovery/covenant tabs and the DEAL
// narrative are ATLF reference fixtures, so a non-reference issuer must never be
// shown reference content *as if it were its own analysis*.
//
// The dangerous state is `noRun`: an issuer that exists but has never been run
// still renders the full reference template. Before this, the sub-header said
// "live engine output · bespoke tabs show the ATLF reference template" for every
// non-reference issuer — implying live modules reflect the issuer even when zero
// runs exist. `noRun` makes the disclaimer truthful: nothing here is this issuer.
__turbopack_context__.s([
    "deepDiveCaveatKind",
    ()=>deepDiveCaveatKind
]);
function deepDiveCaveatKind(p) {
    if (p.isReference) return "reference"; // the ATLF showcase deal itself
    if (p.loading) return "loading"; // still resolving the latest run
    if (p.phase === "error") return "error"; // fetch failed — state is unknown, not "no run"
    if (p.runId) return "live"; // a completed run backs the live modules
    return "noRun"; // issuer exists, never analysed — all figures are template
}
}),
"[project]/src/lib/provenance.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// One provenance grammar for every surface — three orthogonal axes:
//
//   Origin:    LIVE / REFERENCE / DEMO   (where the figures come from)
//   Freshness: CURRENT / DUE / STALE / UNKNOWN (how old they are)
//   Method:    REPORTED / DERIVED / MODELLED (how they were produced)
//
// Replaces the per-surface vocabularies (Research's DEMO/●LIVE chips, Query's
// AI-Generated/Deterministic, Model's CP-1 LIVE/SEEDED, Sector Review's
// Seed/demo badge) so an analyst reads ONE grammar everywhere.
//
// Mapping rule (RT-2026-07-11-65, red-team signed): legacy copy saying
// demo/sample/illustrative → DEMO; curated reference fixtures/templates →
// REFERENCE; LIVE strictly requires a genuine live run id / engine flag and is
// NEVER inferred. An omitted axis renders nothing — absence of freshness must
// not read as CURRENT.
// Seam policy (design remediation 2026-07-15): (1) decision-bearing surfaces
// suppress seeded values when live is empty — the Command pattern; (2) where a
// seeded replay/showcase IS the surface's content, every seeded number in
// shared chrome is labeled at the value level (Replay/DEMO + tooltip), never a
// bare figure beside a live-derived zero.
__turbopack_context__.s([
    "fromModelEngine",
    ()=>fromModelEngine,
    "fromReportCaveat",
    ()=>fromReportCaveat,
    "fromResearchResult",
    ()=>fromResearchResult,
    "fromSeedFlag",
    ()=>fromSeedFlag,
    "impliedMethod",
    ()=>impliedMethod
]);
function impliedMethod(origin) {
    return origin === "LIVE" ? "DERIVED" : "MODELLED";
}
function fromSeedFlag(v) {
    if (v === "seed") return {
        origin: "DEMO",
        detail: "Seeded demo fixture — not live output."
    };
    if (v === "live") return {
        origin: "LIVE"
    };
    return null;
}
function fromModelEngine(eng) {
    if (eng.live && eng.anchor) {
        return {
            origin: "LIVE",
            method: "REPORTED",
            detail: `Anchored to live CP-1${eng.runId ? ` from run ${eng.runId}` : ""}.`
        };
    }
    return {
        origin: "DEMO",
        detail: "No completed run found — seeded demo model (offline fallback)."
    };
}
function fromResearchResult(result) {
    if (result.demo) {
        return {
            origin: "DEMO",
            method: "MODELLED",
            freshness: "UNKNOWN",
            detail: "Seeded demo narrative — not a live web-research run."
        };
    }
    return {
        origin: "LIVE",
        method: "MODELLED",
        freshness: "CURRENT",
        detail: result.truncated ? "Live web research — narrative truncated by the output limit. Verify against cited sources." : "Live web research — AI-synthesized narrative. Verify against cited sources."
    };
}
function fromReportCaveat(kind, liveRunBacked) {
    if (kind === "reference") {
        return {
            origin: "REFERENCE",
            detail: liveRunBacked ? "Reference template — bespoke tabs stay the Atlas Forge fixture; other figures reflect the live run." : "Atlas Forge reference template — not a live issuer run."
        };
    }
    if (kind === "live") {
        return {
            origin: "LIVE",
            detail: "Live engine modules reflect this issuer; CP-RENDER is not wired to issuer-specific report pages yet."
        };
    }
    return null;
}
}),
"[project]/src/components/shared/ConclusionAuthority.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ConclusionAuthority",
    ()=>ConclusionAuthority
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ProvenanceChip$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ProvenanceChip.tsx [app-ssr] (ecmascript)");
;
;
function ConclusionAuthority({ prov, approval = "UNRATIFIED" }) {
    const label = [
        `Origin ${prov.origin}`,
        prov.method ? `method ${prov.method}` : null,
        approval ? `approval ${approval}` : null,
        prov.freshness ? `freshness ${prov.freshness}` : null
    ].filter(Boolean).join(", ");
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "inline-flex items-center gap-1",
        "aria-label": label,
        title: prov.detail,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ProvenanceChip$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ProvenanceChip"], {
                prov: prov
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ConclusionAuthority.tsx",
                lineNumber: 25,
                columnNumber: 7
            }, this),
            approval ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
}),
"[project]/src/components/shared/DecisionHeader.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DecisionHeader",
    ()=>DecisionHeader
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ConclusionAuthority$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ConclusionAuthority.tsx [app-ssr] (ecmascript)");
"use client";
;
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
            value: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ConclusionAuthority$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ConclusionAuthority"], {
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            timestamp ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
            authority ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "basis-full mt-0.5",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ConclusionAuthority$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ConclusionAuthority"], {
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
function DatumActions({ state }) {
    const interactive = state.kind === "offline" || state.kind === "error";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            interactive && state.onRetry ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: state.onRetry,
                className: "caos-action-secondary focus-ring",
                children: state.retryLabel ?? "Retry source"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 85,
                columnNumber: 39
            }, this) : null,
            state.kind === "error" && state.onEscalate ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
function Datum({ state, showObservation = true }) {
    const { content, glyph } = datumPresentation(state);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "caos-decision-state flex-wrap font-sans text-caos-md leading-relaxed",
        "data-kind": state.kind,
        role: state.kind === "loading" ? "status" : undefined,
        children: [
            glyph ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                "aria-hidden": "true",
                children: glyph
            }, void 0, false, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 99,
                columnNumber: 16
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "min-w-0 [overflow-wrap:anywhere]",
                children: content
            }, void 0, false, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 100,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DatumObservation, {
                state: state,
                show: showObservation
            }, void 0, false, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 101,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DatumActions, {
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
function Cell({ label, state, showObservation }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-kind": state.kind,
        className: "caos-decision-cell min-w-0 px-3 py-2 border-r border-caos-border last:border-r-0 max-lg:border-r-0 max-lg:border-b max-lg:last:border-b-0",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "caos-decision-label tabular text-caos-2xs uppercase tracking-widest text-caos-muted",
                children: label
            }, void 0, false, {
                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                lineNumber: 110,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-1",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Datum, {
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
function DecisionHeader({ state, whatChanged, whyItMatters, requiredAction, evidenceHealth, defaultOpen = true, className = "" }) {
    const [userOpen, setUserOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        role: hasError ? "alert" : undefined,
        "aria-label": "Decision header",
        "data-contract": "decision-context",
        className: `caos-decision-header shrink-0 border-b border-caos-border bg-caos-panel/40 ${className}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>setUserOpen(!open),
                "aria-expanded": open,
                "aria-label": "Decision brief: change, impact, action, and evidence",
                className: "caos-decision-toggle w-full flex items-center gap-2 px-3 min-h-8 py-1 text-left focus-ring transition-caos hover:bg-caos-elevated/40",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs font-semibold uppercase tracking-[0.12em] text-caos-text",
                        children: "Decision brief"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                        lineNumber: 167,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "hidden sm:inline tabular text-caos-2xs uppercase tracking-widest text-caos-muted",
                        children: "Change · impact · action · evidence"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                        lineNumber: 168,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
            open ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "border-t border-caos-border/60",
                children: [
                    sharedCause ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "caos-decision-grid grid grid-cols-1",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Cell, {
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
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "caos-decision-grid grid grid-cols-1 md:grid-cols-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Cell, {
                                label: "What changed",
                                state: resolved.whatChanged,
                                showObservation: !commonObservation
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                                lineNumber: 179,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Cell, {
                                label: "Why it matters",
                                state: resolved.whyItMatters,
                                showObservation: !commonObservation
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                                lineNumber: 180,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Cell, {
                                label: "Required action",
                                state: resolved.requiredAction,
                                showObservation: !commonObservation
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                                lineNumber: 181,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Cell, {
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
                    commonObservation ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        "data-origin": commonObservation.authority.provenance.origin,
                        className: "caos-decision-observation flex flex-wrap items-center gap-2 border-t border-caos-border/60 px-3 py-1.5",
                        "aria-label": "Shared authority for all decision conclusions",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "caos-observation-label tabular text-caos-2xs uppercase tracking-widest text-caos-muted",
                                children: "Observation authority"
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/DecisionHeader.tsx",
                                lineNumber: 187,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ConclusionAuthority$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ConclusionAuthority"], {
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
}),
"[project]/src/lib/persona-composition.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
}),
"[project]/src/components/shared/DominantTableRegion.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DominantTableOwnerGuard",
    ()=>DominantTableOwnerGuard,
    "DominantTableRegion",
    ()=>DominantTableRegion
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
const DominantOwnerRegistryContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])(null);
function DominantTableRegion({ ownerId, label, exemption, children, className = "", ...htmlProps }) {
    const elementRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const tokenRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(Symbol(ownerId));
    const registry = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(DominantOwnerRegistryContext);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const element = elementRef.current;
        if (!registry || !element || exemption) return;
        return registry.register(tokenRef.current, element);
    }, [
        exemption,
        ownerId,
        registry
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
    const ownersRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(new Map());
    const mountedRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(false);
    const scheduledRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(false);
    const [violation, setViolation] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const validate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        const visibleOwners = Array.from(ownersRef.current.values()).filter((owner)=>isInvariantVisible(owner));
        const nextViolation = duplicateOwnerMessage(visibleOwners);
        setViolation((current)=>current === nextViolation ? current : nextViolation);
    }, []);
    const scheduleValidation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        if (scheduledRef.current) return;
        scheduledRef.current = true;
        queueMicrotask(()=>{
            scheduledRef.current = false;
            if (mountedRef.current) validate();
        });
    }, [
        validate
    ]);
    const registry = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>({
            register (token, element) {
                ownersRef.current.set(token, element);
                scheduleValidation();
                return ()=>{
                    ownersRef.current.delete(token);
                    scheduleValidation();
                };
            }
        }), [
        scheduleValidation
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
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
        return ()=>{
            mountedRef.current = false;
            observer.disconnect();
        };
    }, [
        scheduleValidation
    ]);
    if (violation) throw new Error(violation);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DominantOwnerRegistryContext.Provider, {
        value: registry,
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/shared/DominantTableRegion.tsx",
        lineNumber: 145,
        columnNumber: 5
    }, this);
}
function DominantTableOwnerGuard({ children }) {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DevelopmentDominantOwnerGuard, {
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/shared/DominantTableRegion.tsx",
        lineNumber: 153,
        columnNumber: 10
    }, this);
}
}),
"[project]/src/components/shared/PersonaWorkbench.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$persona$2d$composition$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/persona-composition.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/use-modal-a11y.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ModalBackdrop.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RoleViewProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/RoleViewProvider.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$DominantTableRegion$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/DominantTableRegion.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
;
function useNarrowWorkbench() {
    // At 1024px the two supporting columns compress the dominant artifact and
    // clip dense decision cells. Treat tablet/small-laptop widths as drawer mode;
    // 1100px+ retains the multi-column desk composition.
    const query = "(max-width: 1099px)";
    // Keep the server and first hydrated client snapshot identical. The media
    // query is applied only after mount, preserving the primary subtree through
    // the responsive composition change.
    const [narrow, setNarrow] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const media = window.matchMedia?.(query);
        if (!media) return;
        const update = ()=>setNarrow(media.matches);
        update();
        media.addEventListener("change", update);
        return ()=>media.removeEventListener("change", update);
    }, []);
    return narrow;
}
function defaultPanelState(defaultOpenPanels) {
    return {
        context: defaultOpenPanels.includes("context"),
        inspector: defaultOpenPanels.includes("inspector")
    };
}
function PersonaDrawer({ content, onClose, panelId, title, titleId }) {
    const panelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useModalA11y"])(onClose);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ModalBackdrop"], {
        onClose: onClose,
        align: "end",
        className: "persona-workbench__drawer-layer",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            ref: panelRef,
            id: panelId,
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": titleId,
            className: "persona-workbench__drawer",
            onClick: (event)=>event.stopPropagation(),
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                    className: "persona-workbench__drawer-header",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            id: titleId,
                            children: title
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
                            lineNumber: 87,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            "aria-label": `Close ${title.toLowerCase()} drawer`,
                            onClick: onClose,
                            className: "persona-workbench__drawer-close",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
const WorkbenchCompositionContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])(null);
function usePersonaComposition(surface, persona) {
    const provider = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RoleViewProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRoleView"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$persona$2d$composition$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getSurfaceComposition"])(surface, persona ?? provider.roleView);
}
const useSurfaceComposition = usePersonaComposition;
function useWorkbenchComposition() {
    const composition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(WorkbenchCompositionContext);
    if (!composition) throw new Error("useWorkbenchComposition must be used within PersonaWorkbench");
    return composition;
}
function usePersonaWorkbenchState(surface, activePersona, composition) {
    const narrow = useNarrowWorkbench();
    const [activeDrawer, setActiveDrawer] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const panelDefaultsKey = `${surface}:${activePersona}`;
    const [panelState, setPanelState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(()=>({
            key: panelDefaultsKey,
            panels: defaultPanelState(composition.defaultOpenPanels)
        }));
    const openPanels = panelState.key === panelDefaultsKey ? panelState.panels : defaultPanelState(composition.defaultOpenPanels);
    const drawerTitleId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useId"])();
    const contextPanelId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useId"])();
    const inspectorPanelId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useId"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useLayoutEffect"])(()=>{
        setPanelState((current)=>current.key === panelDefaultsKey ? current : {
                key: panelDefaultsKey,
                panels: defaultPanelState(composition.defaultOpenPanels)
            });
        setActiveDrawer(null);
    }, [
        composition.defaultOpenPanels,
        panelDefaultsKey
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!narrow) setActiveDrawer(null);
    }, [
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
function SupportTrigger({ slot, state }) {
    const context = slot === "context";
    const title = context ? "Context" : "Inspector";
    const expanded = state.narrow ? state.activeDrawer === slot : state.openPanels[slot];
    const panelId = context ? state.contextPanelId : state.inspectorPanelId;
    const drawerLabel = context ? "Open context drawer" : "Open evidence inspector drawer";
    const panelLabel = `${state.openPanels[slot] ? "Collapse" : "Open"} ${context ? "context" : "evidence inspector"} panel`;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        "aria-expanded": expanded,
        "aria-controls": panelId,
        "aria-label": state.narrow ? drawerLabel : panelLabel,
        onClick: ()=>state.toggleSupportingPanel(slot),
        className: "persona-workbench__drawer-trigger",
        children: state.narrow ? title : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
function SupportingPanelNav({ context, inspector, state }) {
    if (!context && !inspector) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
        className: "persona-workbench__drawer-triggers",
        "aria-label": "Workbench supporting panels",
        children: [
            context ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SupportTrigger, {
                slot: "context",
                state: state
            }, void 0, false, {
                fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
                lineNumber: 177,
                columnNumber: 18
            }, this) : null,
            inspector ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SupportTrigger, {
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `persona-workbench__composition persona-workbench__composition--supports-${supportOrder.length}`,
        "data-visible-support-count": supportOrder.length,
        children: composition.slotOrder.map((slot)=>slots[slot] ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
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
function ActivePersonaDrawer({ context, inspector, state }) {
    if (!state.narrow || !state.activeDrawer) return null;
    const contextDrawer = state.activeDrawer === "context";
    const content = contextDrawer ? context : inspector;
    if (!content) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(PersonaDrawer, {
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
function PersonaWorkbenchView({ activePersona, composition, props, state }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-testid": "persona-workbench",
        "data-surface": props.surface,
        "data-persona": activePersona,
        "data-dominant-representation": composition.dominantRepresentation,
        "data-summary-density": composition.summaryDensity,
        "data-default-open-panels": composition.defaultOpenPanels.join(" "),
        "data-table-column-preset": composition.tableColumnPreset,
        className: `persona-workbench persona-workbench--density-${composition.summaryDensity} persona-workbench--emphasis-${composition.emphasizedSlot} ${props.className ?? ""}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SupportingPanelNav, {
                context: props.context,
                inspector: props.inspector,
                state: state
            }, void 0, false, {
                fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
                lineNumber: 235,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(WorkbenchComposition, {
                composition: composition,
                props: props,
                state: state
            }, void 0, false, {
                fileName: "[project]/src/components/shared/PersonaWorkbench.tsx",
                lineNumber: 236,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ActivePersonaDrawer, {
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
function PersonaWorkbench(props) {
    const composition = usePersonaComposition(props.surface, props.persona);
    const activePersona = composition.persona;
    const state = usePersonaWorkbenchState(props.surface, activePersona, composition);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(WorkbenchCompositionContext.Provider, {
        value: composition,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$DominantTableRegion$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DominantTableOwnerGuard"], {
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(PersonaWorkbenchView, {
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
}),
"[project]/src/lib/useBreakpoint.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
const BP_WIDE = 1280;
const BP_COMPACT_SQUEEZE = 1150;
const BP_DESKTOP = 1024;
const BP_TABLET = 768;
function useBreakpoint() {
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        breakpoint: "wide",
        hydrated: false
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if ("TURBOPACK compile-time truthy", 1) return;
        //TURBOPACK unreachable
        ;
        const mqs = undefined;
        const compute = undefined;
        // rAF-coalesced so a rapid drag across a boundary doesn't flicker.
        let raf;
        const apply = undefined;
        const onChange = undefined;
    }, []);
    return state;
}
}),
"[project]/src/components/shared/SubHeader.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SubHeader",
    ()=>SubHeader,
    "nextCollapseState",
    ()=>nextCollapseState
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$MoreDrawer$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/MoreDrawer.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useBreakpoint$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/useBreakpoint.ts [app-ssr] (ecmascript)");
"use client";
;
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
    const headerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [collapse, setCollapse] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
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
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useLayoutEffect"])(()=>{
        measure();
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(measure);
        if (headerRef.current) observer.observe(headerRef.current);
        return ()=>observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        contextualControls,
        primaryAction,
        status
    ]);
    return {
        headerRef,
        forceCollapsed: collapse.collapsed
    };
};
function SubHeaderStatus({ status }) {
    return status ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "hidden lg:flex items-center gap-2 shrink-0",
        children: status
    }, void 0, false, {
        fileName: "[project]/src/components/shared/SubHeader.tsx",
        lineNumber: 55,
        columnNumber: 19
    }, this) : null;
}
function InlineContext({ show, children }) {
    return show && children ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center gap-2 shrink-0",
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/shared/SubHeader.tsx",
        lineNumber: 59,
        columnNumber: 29
    }, this) : null;
}
function HeaderDrawer({ showInline, contextualControls, utilityControls, drawerOpen, setDrawerOpen, utilityLabel }) {
    const content = showInline ? utilityControls : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            contextualControls,
            contextualControls && utilityControls ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$MoreDrawer$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MoreDrawer"], {
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
function PrimaryAction({ children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
function SubHeader({ identity, status, primaryAction, contextualControls, utilityControls, utilityLabel = "Utilities", className = "", "aria-label": ariaLabel }) {
    // The 1280px contextual-controls collapse comes from the shared shell
    // breakpoint hook — one source with ResponsiveShell (RT-2026-07-11-64).
    const { breakpoint, hydrated } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useBreakpoint$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useBreakpoint"])();
    // MoreDrawer open state — owned here so the trigger and panel are siblings.
    const [drawerOpen, setDrawerOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
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
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (showInline) setDrawerOpen(false);
    }, [
        showInline
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
        ref: headerRef,
        "aria-label": ariaLabel,
        className: `h-11 shrink-0 border-b border-caos-border bg-caos-panel/75 flex items-center gap-3 px-3 md:px-4 ${className}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-3 min-w-28 overflow-hidden",
                children: identity
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SubHeader.tsx",
                lineNumber: 179,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 min-w-0"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SubHeader.tsx",
                lineNumber: 181,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SubHeaderStatus, {
                status: status
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SubHeader.tsx",
                lineNumber: 183,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(InlineContext, {
                show: showInline,
                children: contextualControls
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SubHeader.tsx",
                lineNumber: 186,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(HeaderDrawer, {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(PrimaryAction, {
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
}),
"[project]/src/components/shared/ResponsiveShell.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ResponsiveShell",
    ()=>ResponsiveShell
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SubHeader$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/SubHeader.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useBreakpoint$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/useBreakpoint.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
function ResponsiveShell({ identity, status, primaryAction, contextualControls, utilityControls, utilityLabel, narrowContract, children, className = "", heightClass = "h-screen" }) {
    // Shared shell breakpoint — same source SubHeader uses for its 1280px
    // MoreDrawer collapse, so the two thresholds can never disagree.
    const { breakpoint } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useBreakpoint$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useBreakpoint"])();
    const isDesktop = breakpoint === "wide" || breakpoint === "desktop";
    // At narrow breakpoints, the header shows only essential controls (max 3).
    // The full set renders at desktop only.
    const headerContextual = isDesktop ? contextualControls : narrowContract.essentialControls;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `${heightClass} flex flex-col bg-caos-bg ${className}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SubHeader$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SubHeader"], {
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
}),
"[project]/src/components/shared/AnalysisContextStrip.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AnalysisContextStrip",
    ()=>AnalysisContextStrip
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/analysis-workbench.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
function AnalysisContextStrip() {
    const [context, setContext] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [findings, setFindings] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [unavailable, setUnavailable] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [contextFree, setContextFree] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        let cancelled = false;
        const load = (id)=>{
            setContextFree(false);
            setUnavailable(false);
            Promise.all([
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["analysisApi"].getContext(id),
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["analysisApi"].listFindings(id)
            ]).then(([nextContext, nextFindings])=>{
                if (!cancelled) {
                    setContext(nextContext);
                    setFindings((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["activeFindings"])(nextFindings));
                }
            }).catch(()=>{
                if (!cancelled) setUnavailable(true);
            });
        };
        const initialUrl = new URL(window.location.href);
        const initialId = initialUrl.searchParams.get("context");
        if (initialId) load(initialId);
        else if (initialUrl.pathname === "/settings") setContextFree(true);
        const onContext = (event)=>{
            const detail = event.detail;
            if (detail?.id) load(detail.id);
        };
        const onContextError = ()=>{
            setContext(null);
            setFindings([]);
            setUnavailable(true);
        };
        window.addEventListener("caos:analysis-context", onContext);
        window.addEventListener("caos:analysis-context-error", onContextError);
        return ()=>{
            cancelled = true;
            window.removeEventListener("caos:analysis-context", onContext);
            window.removeEventListener("caos:analysis-context-error", onContextError);
        };
    }, []);
    if (!context && contextFree) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            role: "status",
            className: "flex min-h-12 shrink-0 items-center border-b border-caos-border bg-caos-info-surface/20 px-3 md:min-h-8",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            role: "status",
            "aria-busy": "true",
            className: "flex min-h-12 shrink-0 items-center border-b border-caos-border bg-caos-info-surface/20 px-3 md:min-h-8",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            role: "alert",
            className: "flex min-h-12 shrink-0 items-center overflow-hidden border-b border-caos-critical/40 bg-caos-critical/5 px-3 tabular text-caos-2xs uppercase tracking-wider text-caos-critical md:min-h-8",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
        className: "shrink-0 border-b border-caos-border bg-caos-info-surface/40",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                className: "flex min-h-12 cursor-pointer items-center gap-2 overflow-hidden whitespace-nowrap px-3 tabular text-caos-xs text-caos-text focus-ring md:min-h-8",
                title: summaryTitle,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "shrink-0 uppercase tracking-wider text-caos-accent",
                        children: "Active analysis"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
                        lineNumber: 78,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "min-w-0 truncate",
                        children: context.name
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
                        lineNumber: 79,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "ml-auto shrink-0 text-caos-muted",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid gap-2 border-t border-caos-border/70 px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "min-w-0",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
                            findings.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-1 truncate text-caos-xs text-caos-text",
                                children: [
                                    "Latest finding · ",
                                    findings[0].title
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/shared/AnalysisContextStrip.tsx",
                                lineNumber: 85,
                                columnNumber: 30
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
}),
"[project]/src/components/ui/Button.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Button",
    ()=>Button
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// The page-level action primitive (Blueprint action grammar, 2 tiers —
// globals.css ".caos-action-primary/secondary"). Wraps ActionReason so every
// call site gets the disabled-with-reason contract by construction: native
// `disabled` is not an accepted prop, so a Button can never go inert without
// a reason that stays keyboard/pointer/screen-reader discoverable.
//
// This does not cover in-row micro-actions (Ack, Open →, per-table styled —
// deliberately a separate tier, see the globals.css comment above
// .caos-action-primary) or icon-only/close controls with their own contract.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ActionReason.tsx [app-ssr] (ecmascript)");
"use client";
;
;
function Button({ variant = "secondary", reason, reasonDisplay, title, className = "", children, ...rest }) {
    const variantClass = variant === "primary" ? "caos-action-primary" : "caos-action-secondary";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ActionReason$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ActionReason"], {
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
}),
"[project]/src/components/shared/EnterprisePage.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EnterprisePage",
    ()=>EnterprisePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ResponsiveShell$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ResponsiveShell.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AnalysisContextStrip$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/AnalysisContextStrip.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/Button.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
function EnterprisePrimaryAction({ action }) {
    if (!action) return null;
    if (action.unavailableReason) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
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
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
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
function EnterprisePage({ kind, identity, status, primaryAction, contextualControls, utilityControls, utilityLabel, decisionContext, finalizationBar, narrowContract, children, className = "", heightClass = "h-screen" }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ResponsiveShell$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ResponsiveShell"], {
        identity: identity,
        status: status,
        primaryAction: primaryAction ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(EnterprisePrimaryAction, {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AnalysisContextStrip$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AnalysisContextStrip"], {}, void 0, false, {
                fileName: "[project]/src/components/shared/EnterprisePage.tsx",
                lineNumber: 95,
                columnNumber: 7
            }, this),
            decisionContext,
            children,
            finalizationBar ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("footer", {
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
}),
"[project]/src/app/deepdive/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>DeepDivePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// Concept C — The Analytical Deep-Dive: three-pane split for the Atlas Forge
// 2L term-loan review. Source register + CP-5B evidence rail · full L0–L6 module
// launcher (bespoke CP-6A debate / CP-3B recovery / CP-4 covenants tabs +
// generic module views with clickable step-output registers) · IC verdict,
// CP-6E sizing and armed monitoring triggers. Loads complete; reset replays
// the run and outputs unlock as their producing modules clear.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/shared/lib/app-dynamic.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RequireAuth$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/RequireAuth.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ShellIdentity$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ShellIdentity.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$ExportToVaultButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/reports/ExportToVaultButton.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/reports/deal.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/data.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2d$date$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/format-date.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sim$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/sim.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/sev.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/pipeline/atoms.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/StatusGlyph.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$FirstRunHint$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/FirstRunHint.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$evidence$2d$sync$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/evidence-sync.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CrossDefaultDominoes$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/CrossDefaultDominoes.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$layout$2d$pref$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/deepdive/layout-pref.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$rails$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/src/components/deepdive/rails.tsx [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/Panel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$ModuleFinder$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/deepdive/ModuleFinder.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$StandingViewStrip$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/deepdive/StandingViewStrip.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useLiveRun$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/engine/useLiveRun.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/engine/types.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$caveat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/deepdive/caveat.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$provenance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/provenance.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$DecisionHeader$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/DecisionHeader.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$PersonaWorkbench$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/PersonaWorkbench.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Ask$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/Ask.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$EnterprisePage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/EnterprisePage.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/analysis-workbench.ts [app-ssr] (ecmascript)");
;
;
;
;
;
;
;
;
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
// Code-split the heavy, on-demand surfaces out of the initial /deepdive bundle:
// the tab renderers (tabs.tsx + its fixture/chart tree) load when a module tab is
// shown, and the chat / evidence overlays only when opened. ssr:false — this is a
// client-only, statically-exported route. Trims the route's First Load JS.
const TabLoading = ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "h-full flex items-center justify-center text-caos-muted tabular text-caos-md",
        children: "loading module…"
    }, void 0, false, {
        fileName: "[project]/src/app/deepdive/page.tsx",
        lineNumber: 48,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
const ScenarioNetworkLoading = ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        role: "status",
        className: "min-h-[153px] md:min-h-[127px] flex items-center justify-center text-caos-muted tabular text-caos-md",
        children: "loading scenario network…"
    }, void 0, false, {
        fileName: "[project]/src/app/deepdive/page.tsx",
        lineNumber: 51,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
const DebateTab = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"])(async ()=>{}, {
    loadableGenerated: {
        modules: [
            "[project]/src/components/deepdive/tabs.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false,
    loading: TabLoading
});
const RecoveryTab = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"])(async ()=>{}, {
    loadableGenerated: {
        modules: [
            "[project]/src/components/deepdive/tabs.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false,
    loading: TabLoading
});
const CovenantsTab = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"])(async ()=>{}, {
    loadableGenerated: {
        modules: [
            "[project]/src/components/deepdive/tabs.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false,
    loading: TabLoading
});
const ModuleView = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"])(async ()=>{}, {
    loadableGenerated: {
        modules: [
            "[project]/src/components/deepdive/tabs.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false,
    loading: TabLoading
});
const LiveCovenantCapacity = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"])(async ()=>{}, {
    loadableGenerated: {
        modules: [
            "[project]/src/components/deepdive/LiveCovenantCapacity.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false,
    loading: TabLoading
});
const ScenarioNetworkPanel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"])(async ()=>{}, {
    loadableGenerated: {
        modules: [
            "[project]/src/components/model/ScenarioNetworkPanel.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false,
    loading: ScenarioNetworkLoading
});
const IssuerChat = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"])(async ()=>{}, {
    loadableGenerated: {
        modules: [
            "[project]/src/components/deepdive/IssuerChat.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false
});
const EvidenceModal = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"])(async ()=>{}, {
    loadableGenerated: {
        modules: [
            "[project]/src/components/reports/EvidenceModal.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false
});
function DeepDivePage() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RequireAuth$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["RequireAuth"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Suspense"], {
            fallback: null,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DeepDive, {}, void 0, false, {
                fileName: "[project]/src/app/deepdive/page.tsx",
                lineNumber: 68,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/app/deepdive/page.tsx",
            lineNumber: 67,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/deepdive/page.tsx",
        lineNumber: 66,
        columnNumber: 5
    }, this);
}
const BESPOKE = {
    "CP-6A": {
        label: "Adversarial Debate",
        code: "CP-6A"
    },
    "CP-3B": {
        label: "Recovery Waterfall",
        code: "CP-3B"
    },
    "CP-4": {
        label: "Legal & Covenants",
        code: "CP-4 / 4C"
    }
};
const GATE = {
    "CP-4": "CP-4C"
};
// CP-4's analytical pane incorporates its CP-4C covenant gate. The live QA
// status therefore has to aggregate both persisted module rows; a Passed CP-4
// cannot override a Restricted/Blocked CP-4C in the same analyst pane.
const LIVE_QA_SCOPE = {
    "CP-4": [
        "CP-4",
        "CP-4C"
    ]
};
const LIVE_QA_WEIGHT = {
    idle: 4,
    "not-reviewed": 3,
    pass: 1,
    warning: 5,
    failed: 6
};
function liveQaState(status) {
    if (status === "Blocked" || status === "failed") return "failed";
    if (status === "Restricted" || status === "warning") return "warning";
    if (status === "Passed" || status === "pass") return "pass";
    // Unknown future statuses must not silently promote a module to Passed.
    return status === undefined ? "idle" : "not-reviewed";
}
function worstLiveQaState(statuses) {
    return statuses.map(liveQaState).reduce((worst, next)=>LIVE_QA_WEIGHT[next] > LIVE_QA_WEIGHT[worst] ? next : worst, "pass");
}
// Modules with a bespoke ATLF showcase renderer (debate / recovery / covenants).
// For a real issuer with live output they fall through to the generic ModuleView.
const BESPOKE_TABS = new Set([
    "CP-6A",
    "CP-6E",
    "CP-3B",
    "CP-4"
]);
const GROUPS = [
    {
        label: "L0 · ORCH",
        mods: [
            "CP-0",
            "CP-X"
        ]
    },
    {
        label: "L1 BASE",
        mods: [
            "CP-1",
            "CP-1A",
            "CP-1B",
            "CP-1C"
        ]
    },
    {
        label: "L2 SYNTHESIS",
        mods: [
            "CP-2",
            "CP-2B",
            "CP-2C",
            "CP-2D",
            "CP-2E",
            "CP-2F",
            "CP-2G"
        ]
    },
    {
        label: "L3 REL VALUE",
        mods: [
            "CP-3",
            "CP-3B",
            "CP-3C",
            "CP-3D"
        ]
    },
    {
        label: "L4 LEGAL",
        mods: [
            "CP-4",
            "CP-4D"
        ]
    },
    {
        label: "L5 GOV",
        mods: [
            "CP-5B",
            "CP-5"
        ]
    },
    {
        label: "L6 DEBATE",
        mods: [
            "CP-6A",
            "CP-6E"
        ]
    }
];
const layerSummaryParts = (group, stateFor, isReference)=>{
    const counts = {
        pass: 0,
        warning: 0,
        failed: 0,
        "not-reviewed": 0,
        idle: 0
    };
    for (const id of group.mods){
        const state = stateFor(id);
        if (state in counts) counts[state] += 1;
        else counts.idle += 1;
    }
    return [
        counts.pass ? {
            key: "ok",
            n: counts.pass,
            dot: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Dot"], {
                sev: "pass",
                glyph: true
            }, void 0, false, {
                fileName: "[project]/src/app/deepdive/page.tsx",
                lineNumber: 130,
                columnNumber: 53
            }, ("TURBOPACK compile-time value", void 0)),
            word: `${counts.pass} cleared`
        } : null,
        counts.warning ? {
            key: "concerns",
            n: counts.warning,
            dot: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Dot"], {
                sev: "warning",
                glyph: true
            }, void 0, false, {
                fileName: "[project]/src/app/deepdive/page.tsx",
                lineNumber: 131,
                columnNumber: 65
            }, ("TURBOPACK compile-time value", void 0)),
            word: `${counts.warning} w/ concerns`
        } : null,
        counts.failed ? {
            key: "fail",
            n: counts.failed,
            dot: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Dot"], {
                sev: "blocked",
                glyph: true
            }, void 0, false, {
                fileName: "[project]/src/app/deepdive/page.tsx",
                lineNumber: 132,
                columnNumber: 59
            }, ("TURBOPACK compile-time value", void 0)),
            word: `${counts.failed} failed`
        } : null,
        counts["not-reviewed"] ? {
            key: "review",
            n: counts["not-reviewed"],
            dot: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                kind: "idle"
            }, void 0, false, {
                fileName: "[project]/src/app/deepdive/page.tsx",
                lineNumber: 133,
                columnNumber: 79
            }, ("TURBOPACK compile-time value", void 0)),
            word: `${counts["not-reviewed"]} not reviewed`
        } : null,
        counts.idle ? {
            key: "pend",
            n: counts.idle,
            dot: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                kind: isReference ? "locked" : "idle"
            }, void 0, false, {
                fileName: "[project]/src/app/deepdive/page.tsx",
                lineNumber: 134,
                columnNumber: 55
            }, ("TURBOPACK compile-time value", void 0)),
            word: `${counts.idle} ${isReference ? "gated" : "no output"}`
        } : null
    ].filter(Boolean);
};
function CollapsedLayerSummary({ group, stateFor, isReference }) {
    const parts = layerSummaryParts(group, stateFor, isReference);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "flex items-center gap-1.5",
        "aria-label": parts.map((part)=>part.word).join(", "),
        children: parts.map((part)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "flex items-center gap-0.5",
                "aria-hidden": "true",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs text-caos-muted",
                        children: part.n
                    }, void 0, false, {
                        fileName: "[project]/src/app/deepdive/page.tsx",
                        lineNumber: 144,
                        columnNumber: 11
                    }, this),
                    part.dot,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "hidden xl:inline tabular text-caos-2xs text-caos-muted",
                        children: part.word.split(" ").slice(1).join(" ")
                    }, void 0, false, {
                        fileName: "[project]/src/app/deepdive/page.tsx",
                        lineNumber: 146,
                        columnNumber: 11
                    }, this)
                ]
            }, part.key, true, {
                fileName: "[project]/src/app/deepdive/page.tsx",
                lineNumber: 143,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/src/app/deepdive/page.tsx",
        lineNumber: 141,
        columnNumber: 5
    }, this);
}
const DEEP_DIVE_LAYOUTS = [
    {
        value: "summary",
        label: "Summary",
        title: "Clean layer read: verdict-first, no model outputs or workflow cards"
    },
    {
        value: "report",
        label: "Report",
        title: "Committee report: module outputs plus consolidated workflow cards"
    },
    {
        value: "dense",
        label: "Dense",
        title: "Audit view: module outputs plus every workflow card packed tight"
    }
];
function DeepDiveLayoutPicker({ layout, onPick, labelClassName = "" }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: `tabular text-caos-2xs uppercase tracking-wider text-caos-muted ${labelClassName}`,
                children: "Layout"
            }, void 0, false, {
                fileName: "[project]/src/app/deepdive/page.tsx",
                lineNumber: 161,
                columnNumber: 5
            }, this),
            DEEP_DIVE_LAYOUTS.map((option)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    type: "button",
                    "aria-pressed": layout === option.value,
                    onClick: ()=>onPick(option.value),
                    title: option.title,
                    className: "tabular text-caos-2xs px-1.5 py-0.5 rounded border transition-caos focus-ring " + (layout === option.value ? "bg-caos-elevated text-caos-text border-caos-accent" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50"),
                    children: option.label
                }, option.value, false, {
                    fileName: "[project]/src/app/deepdive/page.tsx",
                    lineNumber: 162,
                    columnNumber: 40
                }, this))
        ]
    }, void 0, true);
}
// fallow-ignore-next-line complexity -- Route, evidence, pane, and module state synchronize at this workbench boundary.
function DeepDive() {
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const modParam = searchParams.get("mod");
    const evidenceParam = searchParams.get("evidence");
    const exactRunId = searchParams.get("run");
    // Issuer opened from the directory (?issuer=). Absent → the ATLF reference deal
    // (the bespoke showcase). The live engine overlay is keyed off this id; the
    // bespoke debate/recovery/covenant tabs and DEAL narrative are ATLF fixtures,
    // so for a non-reference issuer we land on a live module and mark them as the
    // reference template rather than implying they are that issuer's own analysis.
    const issuerId = searchParams.get("issuer") || __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ATLF_REFERENCE_ISSUER_ID"];
    const isReference = issuerId === __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ATLF_REFERENCE_ISSUER_ID"];
    const [issuerMeta, setIssuerMeta] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    // A failed lookup must not read as an eternal "Loading issuer…" — track the
    // failure and offer a retry instead of a permanent loading label.
    const [issuerErr, setIssuerErr] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [issuerAttempt, setIssuerAttempt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (isReference) {
            setIssuerMeta(null);
            return;
        }
        let stale = false;
        setIssuerErr(false);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getIssuerProfile"])(issuerId).then((d)=>{
            if (!stale) setIssuerMeta({
                name: d.issuer.name,
                ticker: d.issuer.ticker,
                signals: d.signals
            });
        }).catch(()=>{
            if (!stale) {
                setIssuerMeta(null);
                setIssuerErr(true);
            }
        });
        return ()=>{
            stale = true;
        };
    }, [
        issuerId,
        isReference,
        issuerAttempt
    ]);
    const code = isReference ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].code : issuerMeta?.ticker || "—";
    const dealLabel = isReference ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].deal : issuerMeta?.name ?? (issuerErr ? "Issuer unavailable" : "Loading issuer…");
    const analysis = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAnalysisContext"])({
        name: `${dealLabel} credit view`
    });
    const [affirmState, setAffirmState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("idle");
    const [affirmNotice, setAffirmNotice] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [tab, setTab] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(modParam || (isReference ? "CP-6A" : "CP-1"));
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const onCycle = (e)=>{
            const customEvent = e;
            const dir = customEvent.detail?.direction || 1;
            const allMods = GROUPS.flatMap((g)=>g.mods);
            setTab((curr)=>{
                const idx = allMods.indexOf(curr);
                if (idx === -1) return allMods[0];
                const nextIdx = (idx + dir + allMods.length) % allMods.length;
                return allMods[nextIdx];
            });
        };
        window.addEventListener("caos:subview-cycle", onCycle);
        return ()=>window.removeEventListener("caos:subview-cycle", onCycle);
    }, []);
    // keep the open module in sync when the ?mod= param changes (back/forward,
    // repeated double-clicks from the Execution Graph)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (modParam) setTab(modParam);
    }, [
        modParam
    ]);
    const [evModal, setEvModal] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    // Layout (summary / report / dense) — toggled from the sub-header; browser-local.
    const [layout, setLayout] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$layout$2d$pref$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEFAULT_LAYOUT"]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>setLayout((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$layout$2d$pref$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["loadLayout"])()), []);
    const pickLayout = (l)=>{
        setLayout(l);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$layout$2d$pref$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["saveLayout"])(l);
    };
    // Module-launcher accordion. Wide screens (≥2xl) open every layer at once —
    // there is room for the whole tree. Below 2xl the accordion is EXCLUSIVE: one
    // layer open at a time (opening a layer closes the others), so the strip never
    // accumulates open layers and grows past the viewport into a scroll-hunt.
    // (critique: launcher overflow) The active tab's layer is always the open one
    // after a navigation.
    const activeLayer = GROUPS.find((g)=>g.mods.includes(tab))?.label ?? null;
    const [wide, setWide] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [openLayers, setOpenLayers] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(()=>new Set(activeLayer ? [
            activeLayer
        ] : []));
    // Track the 2xl breakpoint so the accordion knows whether to be all-open or
    // exclusive; matchMedia so it flips exactly at the layout boundary.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const mq = window.matchMedia("(min-width: 1536px)");
        const apply = ()=>setWide(mq.matches);
        apply();
        mq.addEventListener("change", apply);
        return ()=>mq.removeEventListener("change", apply);
    }, []);
    // Reset to the mode default when the breakpoint flips: all-open when wide,
    // just the active layer when narrow (collapses everything else).
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        setOpenLayers(wide ? new Set(GROUPS.map((g)=>g.label)) : new Set(activeLayer ? [
            activeLayer
        ] : []));
    // Only re-seed on a breakpoint flip; navigations are handled below so a
    // user's opened layer isn't wiped on every resize tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        wide
    ]);
    // Keep the active layer visible on tab navigation — exclusive when narrow.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!activeLayer) return;
        setOpenLayers((prev)=>wide ? new Set(prev).add(activeLayer) : new Set([
                activeLayer
            ]));
    }, [
        activeLayer,
        wide
    ]);
    const toggleLayer = (l)=>setOpenLayers((prev)=>{
            if (wide) {
                const n = new Set(prev);
                if (n.has(l)) n.delete(l);
                else n.add(l);
                return n;
            }
            // Narrow: exclusive. Re-clicking the only open layer collapses it.
            return prev.has(l) && prev.size === 1 ? new Set() : new Set([
                l
            ]);
        });
    // Launcher strip horizontal-scroll affordance: edge fades + chevrons that
    // appear only when there's more off-screen, and the active chip is scrolled
    // into view on navigation so it's never stranded past the fold. (critique:
    // active chip can sit outside the viewport / only affordance is a 7px bar)
    const stripRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [edges, setEdges] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        left: false,
        right: false
    });
    const syncEdges = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        const el = stripRef.current;
        if (!el) return;
        setEdges({
            left: el.scrollLeft > 4,
            right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4
        });
    }, []);
    const nudgeStrip = (dir)=>{
        const el = stripRef.current;
        // Instant paging, not smooth: this is a flow-state terminal control, and an
        // instant jump is also the correct reduced-motion behaviour.
        if (el) el.scrollBy({
            left: dir * el.clientWidth * 0.7
        });
    };
    // Re-measure the fades whenever the content width can change (layer open/close,
    // breakpoint flip) and on window resize.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        syncEdges();
        window.addEventListener("resize", syncEdges);
        return ()=>window.removeEventListener("resize", syncEdges);
    }, [
        syncEdges,
        openLayers,
        wide
    ]);
    // Bring the selected module chip into view after a navigation (click, ?mod=,
    // or Alt+,/. cycle) or when its layer (re)opens — but ONLY when it's actually
    // off-screen. Scrolling an already-visible chip on first paint slices the
    // left group label ("‹ …OUTPUTS"); leave the strip at its start instead.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const strip = stripRef.current;
        const chip = strip?.querySelector('[data-active-chip="true"]');
        if (!strip || !chip) return;
        const chipLeft = chip.offsetLeft;
        const chipRight = chipLeft + chip.offsetWidth;
        const offLeft = chipLeft < strip.scrollLeft;
        const offRight = chipRight > strip.scrollLeft + strip.clientWidth;
        if (offLeft || offRight) {
            // Scroll only the launcher. Element.scrollIntoView() also moved the
            // route's outer workbench scroll owner on narrow screens, shifting the
            // complete analysis pane off the left edge.
            const left = Math.max(0, chipLeft - (strip.clientWidth - chip.offsetWidth) / 2);
            strip.scrollTo?.({
                left,
                behavior: "auto"
            });
            requestAnimationFrame(syncEdges);
        }
    }, [
        tab,
        openLayers,
        syncEdges
    ]);
    // Evidence/source rail starts collapsed: traceability is on-demand (the E-xx
    // citation chips open the source directly), so it shouldn't hold prime
    // analytical real estate by default. The analyst expands it when they want it.
    const [railOpen, setRailOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [decisionOpen, setDecisionOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    // Issuer Q&A open-state is owned by the global Ask launcher (⌘K), so the
    // in-panel ASK ATLF button and the shortcut drive the same chat.
    const { open: chatOpen, setOpen: setChatOpen } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Ask$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAsk"])();
    const run = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sim$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useSimRun"])({
        prefill: true,
        plan: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIM_PLAN"]
    });
    // The tear-sheet report tree (builders.ts → model / ROWS / charts) is read only
    // when an evidence link is opened, so defer its import + build out of the initial
    // /deepdive bundle (PERF-2). Loads once, lazily, on the first evidence-modal open.
    const [reports, setReports] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!evModal || reports) return;
        let cancelled = false;
        void __turbopack_context__.A("[project]/src/lib/reports/builders.ts [app-ssr] (ecmascript, async loader)").then((m)=>{
            if (!cancelled) setReports(m.buildReports());
        });
        return ()=>{
            cancelled = true;
        };
    }, [
        evModal,
        reports
    ]);
    // Live engine output for the seeded ATLF deal, when a run exists. Falls back
    // to the seeded register otherwise (offline demo unaffected).
    const live = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useLiveRun$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useLiveRun"])(issuerId, exactRunId);
    // Honesty caveat for the sub-header: reference deal · resolving · live · no-run.
    const caveatKind = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$caveat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["deepDiveCaveatKind"])({
        isReference,
        loading: live.loading,
        runId: live.runId,
        phase: live.phase
    });
    // Adaptivity: the decision rail (IC verdict / sizing — analytical output)
    // earns its space and restores on wide screens, but auto-collapses below
    // ~1440px so the central analysis keeps a usable instrument width before the
    // verdict rail claims 352px. The evidence rail is left
    // user-controlled (default collapsed, see above) — width goes to analysis.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const NARROW = 1440;
        let narrow = window.innerWidth < NARROW;
        if (narrow) setDecisionOpen(false);
        const onResize = ()=>{
            const now = window.innerWidth < NARROW;
            if (now !== narrow) {
                narrow = now;
                setDecisionOpen(!now);
            }
        };
        window.addEventListener("resize", onResize);
        return ()=>window.removeEventListener("resize", onResize);
    }, []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const onCollapse = ()=>{
            const anyOpen = railOpen || decisionOpen;
            setRailOpen(!anyOpen);
            setDecisionOpen(!anyOpen);
        };
        window.addEventListener("caos:collapse-toggle", onCollapse);
        return ()=>window.removeEventListener("caos:collapse-toggle", onCollapse);
    }, [
        railOpen,
        decisionOpen
    ]);
    const gateState = (id)=>run.sim.mods[id]?.state || "idle";
    // Launcher/gate display state. A parent pane/layer takes the worst persisted
    // QA state in its scope: Blocked > Restricted > Not Reviewed/absent > Passed.
    // This prevents a green CP-4 pane when its CP-4C gate is still restricted or
    // blocked, and never turns a missing status into a clean pass.
    const qaScope = (id)=>LIVE_QA_SCOPE[id] ?? [
            id
        ];
    const modState = (id)=>isReference ? gateState(GATE[id] || id) : worstLiveQaState(qaScope(id).map((moduleId)=>live.liveStatus[moduleId]));
    const meta = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MODULES"].find((m)=>m.id === tab);
    const bespoke = BESPOKE[tab];
    const gateId = GATE[tab] || tab;
    // Reference deal → bespoke showcase tab. Real issuers never borrow ATLF
    // showcase output; they render live ModuleView data or an explicit no-output state.
    const useBespoke = BESPOKE_TABS.has(tab) && isReference;
    // Per-module live provenance: the open tab renders genuinely-live output only
    // when it goes through the generic ModuleView with this run's own module output
    // (not a bespoke ATLF showcase, and the module was actually produced this run).
    // Drives a per-module ● LIVE / ◦ REFERENCE badge instead of a run-scoped one. (#5)
    const moduleIsLive = !useBespoke && !!live.liveOuts[tab];
    const moduleQaState = !isReference ? modState(tab) : null;
    const moduleOwnQaState = !isReference ? liveQaState(live.liveStatus[tab]) : null;
    // A real issuer's open module that hit the engine's failure gate (qa_status
    // Blocked). Distinct from "no output" (never produced) — the row exists, the
    // analysis didn't complete. Drives a ✕ FAILED badge + an explicit failed pane
    // instead of an empty ModuleView under a ● LIVE badge.
    const moduleFailed = !isReference && moduleOwnQaState === "failed";
    const referenceUnavailable = isReference && (tab === "CP-2G" || tab === "CP-4D");
    // The replay sim gates the reference showcase only. A real issuer is never
    // sim-locked (its honest empty state is the module view's own no-output
    // screen), and live output is never held behind replay theater — otherwise
    // the pane reads "awaiting upstream" under a ● LIVE badge. (critique: two
    // state machines disagreeing)
    const unlocked = referenceUnavailable || !isReference || moduleIsLive || (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isCleared"])(gateState(gateId));
    // Use the bespoke title only when the bespoke tab is actually rendered; a live
    // generic render shows the module's own name, not the showcase label.
    const title = bespoke && useBespoke ? bespoke.label + " · " + bespoke.code : (meta?.name || tab) + " · " + tab;
    const decisionAsOf = live.asOf ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2d$date$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fmtUtcDateTime"])(live.asOf) : isReference ? "2026-05-31 · reference fixture" : null;
    const decisionProvenance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$provenance$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fromReportCaveat"])(caveatKind, caveatKind === "reference" && !!live.runId);
    const deepAuthority = decisionAsOf && decisionProvenance ? {
        provenance: {
            ...decisionProvenance,
            asOf: decisionAsOf
        },
        approval: live.committeeStatus === "Approved" ? "RATIFIED" : "UNRATIFIED"
    } : undefined;
    const unavailableDeepState = live.loading ? {
        kind: "loading",
        message: "Checking latest completed run…"
    } : live.phase === "error" ? {
        kind: "error",
        message: "Latest run could not be loaded"
    } : {
        kind: "unavailable",
        message: live.phase === "in_flight" ? "Latest run is still in flight" : "No completed run available"
    };
    const deepDecision = decisionAsOf && (caveatKind === "reference" || caveatKind === "live") ? {
        whatChanged: {
            kind: "ready",
            value: caveatKind === "reference" ? `${run.completed}/${run.total} modules cleared` : `${Object.keys(live.liveOuts).length} module${Object.keys(live.liveOuts).length === 1 ? "" : "s"} with live output`,
            asOf: decisionAsOf,
            authority: deepAuthority
        },
        whyItMatters: live.council[0] ? {
            kind: "ready",
            value: `${live.council[0].finding_id} — ${live.council[0].severity}${live.council.length > 1 ? ` (+${live.council.length - 1} more)` : ""}`,
            asOf: decisionAsOf,
            authority: deepAuthority
        } : live.committeeStatus ? {
            kind: "ready",
            value: `Committee status: ${live.committeeStatus}`,
            asOf: decisionAsOf,
            authority: deepAuthority
        } : {
            kind: "observed-empty",
            message: "No committee finding observed",
            asOf: decisionAsOf,
            authority: deepAuthority
        },
        requiredAction: {
            kind: "ready",
            value: live.council[0]?.required_remediation ?? (caveatKind === "reference" ? "Review CP-6A debate before committee" : "Review live module outputs"),
            asOf: decisionAsOf,
            authority: deepAuthority
        },
        evidenceHealth: {
            kind: "ready",
            value: decisionProvenance?.detail ?? "Evidence lineage available",
            asOf: decisionAsOf,
            authority: deepAuthority
        }
    } : {
        whatChanged: unavailableDeepState,
        whyItMatters: unavailableDeepState,
        requiredAction: unavailableDeepState,
        evidenceHealth: unavailableDeepState
    };
    const syncContext = analysis.context;
    const patchContext = analysis.patch;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const active = syncContext;
        if (!active) return;
        const issuerIds = active.issuer_ids.includes(issuerId) ? active.issuer_ids : [
            ...active.issuer_ids,
            issuerId
        ];
        const runId = live.runId ?? active.artifacts.issuer_run_id;
        if (issuerIds === active.issuer_ids && runId === active.artifacts.issuer_run_id) return;
        void patchContext({
            issuer_ids: issuerIds,
            artifacts: {
                issuer_run_id: runId
            }
        }).catch(()=>setAffirmNotice("Analysis context could not be updated."));
    }, [
        issuerId,
        live.runId,
        patchContext,
        syncContext
    ]);
    const affirmView = async ()=>{
        const context = analysis.context;
        if (isReference || !live.runId || !context) {
            setAffirmNotice(isReference ? "Reference output cannot be ratified." : analysis.error ?? "A completed owned run is required before affirmation.");
            return;
        }
        setAffirmState("saving");
        setAffirmNotice(null);
        try {
            const thesis = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createThesisVersion"])({
                issuer_id: issuerId,
                trigger: "manual",
                thesis_md: [
                    `# ${dealLabel} credit view`,
                    "",
                    `Run: ${live.runId}`,
                    `Observed: ${decisionAsOf ?? "unknown"}`,
                    `Committee state: ${live.committeeStatus ?? "unratified"}`,
                    `Module coverage: ${Object.keys(live.liveOuts).length}`,
                    live.council[0] ? `Required action: ${live.council[0].required_remediation}` : "Required action: review live module outputs"
                ].join("\n")
            });
            const nextSurfaceState = {
                ...context.surface_state,
                "deep-dive": {
                    ...context.surface_state["deep-dive"] ?? {},
                    active_id: thesis.id,
                    selected_ids: [
                        live.runId
                    ],
                    view: layout
                }
            };
            await analysis.patch({
                issuer_ids: context.issuer_ids.includes(issuerId) ? context.issuer_ids : [
                    ...context.issuer_ids,
                    issuerId
                ],
                artifacts: {
                    ...context.artifacts,
                    issuer_run_id: live.runId
                },
                surface_state: nextSurfaceState
            });
            const [findingResult] = await Promise.allSettled([
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["analysisApi"].createFinding({
                    context_id: context.id,
                    kind: "credit-view",
                    title: `${dealLabel} view affirmed`,
                    body: `Thesis v${thesis.version} affirmed from run ${live.runId.slice(0, 8)}.`,
                    source_surface: "deep-dive",
                    source_run_id: live.runId,
                    evidence: {
                        thesis_version_id: thesis.id,
                        module_id: tab
                    }
                }),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["updateAnalystWorkspace"])((workspace)=>{
                    const prior = Array.isArray(workspace.affirmations) ? workspace.affirmations : [];
                    return {
                        ...workspace,
                        affirmations: [
                            {
                                issuerId,
                                runId: live.runId,
                                stance: live.committeeStatus ?? "Analyst affirmed",
                                ts: new Date().toISOString(),
                                thesisVersionId: thesis.id
                            },
                            ...prior
                        ].slice(0, 20)
                    };
                })
            ]);
            if (findingResult.status === "rejected") {
                setAffirmState("partial");
                setAffirmNotice(`Thesis v${thesis.version} saved; finding pin needs retry.`);
            } else {
                setAffirmState("saved");
                setAffirmNotice(`Thesis v${thesis.version} saved and pinned.`);
            }
        } catch (reason) {
            setAffirmState("error");
            setAffirmNotice(reason instanceof Error ? reason.message : "View could not be affirmed.");
        }
    };
    const narrowContract = {
        essentialControls: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DeepDiveLayoutPicker, {
                    layout: layout,
                    onPick: pickLayout
                }, void 0, false, {
                    fileName: "[project]/src/app/deepdive/page.tsx",
                    lineNumber: 520,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SimControls"], {
                    run: run
                }, void 0, false, {
                    fileName: "[project]/src/app/deepdive/page.tsx",
                    lineNumber: 521,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true)
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$evidence$2d$sync$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["EvidenceSyncProvider"], {
        initialActive: evidenceParam,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$EnterprisePage$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["EnterprisePage"], {
            kind: "object",
            identity: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ShellIdentity$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ShellIdentity"], {
                tag: "DEEP-DIVE",
                title: dealLabel,
                children: [
                    issuerErr && !isReference ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>setIssuerAttempt((a)=>a + 1),
                        className: "tabular text-caos-xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50 transition-caos focus-ring whitespace-nowrap",
                        title: "Issuer lookup failed — retry",
                        children: "RETRY"
                    }, void 0, false, {
                        fileName: "[project]/src/app/deepdive/page.tsx",
                        lineNumber: 532,
                        columnNumber: 13
                    }, this) : null,
                    caveatKind === "reference" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-sm text-caos-muted whitespace-nowrap hidden xl:inline",
                        title: "Seeded ATLF reference showcase — illustrative run #2641, not a database run. Genuinely live engine output is marked ● LIVE per module.",
                        children: [
                            "SEEDED RUN #2641 · ",
                            run.completed,
                            "/",
                            run.total,
                            " modules"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/deepdive/page.tsx",
                        lineNumber: 541,
                        columnNumber: 13
                    }, this) : caveatKind === "loading" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs text-caos-muted whitespace-nowrap hidden xl:inline",
                        children: "checking for live run…"
                    }, void 0, false, {
                        fileName: "[project]/src/app/deepdive/page.tsx",
                        lineNumber: 548,
                        columnNumber: 13
                    }, this) : caveatKind === "error" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs whitespace-nowrap",
                        style: {
                            color: "var(--caos-critical)"
                        },
                        role: "note",
                        title: `Could not load ${code}'s live run — showing the last known state, not a confirmed no-run.`,
                        children: "could not load live run"
                    }, void 0, false, {
                        fileName: "[project]/src/app/deepdive/page.tsx",
                        lineNumber: 550,
                        columnNumber: 13
                    }, this) : caveatKind === "live" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs whitespace-nowrap",
                        style: {
                            color: "var(--caos-warning)"
                        },
                        title: "Live engine modules reflect this issuer; modules or rails without issuer-specific output show an explicit no-output state.",
                        children: "live engine output · missing panes show no output"
                    }, void 0, false, {
                        fileName: "[project]/src/app/deepdive/page.tsx",
                        lineNumber: 554,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xs whitespace-nowrap",
                        style: {
                            color: "var(--caos-warning)"
                        },
                        role: "note",
                        title: `No completed run for ${code}. Seeded ATLF output is suppressed for issuer-scoped views. Run a new simulation in pipeline or model builder to populate.`,
                        children: [
                            "no run for ",
                            code,
                            " · run analysis to populate"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/deepdive/page.tsx",
                        lineNumber: 558,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/deepdive/page.tsx",
                lineNumber: 530,
                columnNumber: 9
            }, this),
            primaryAction: {
                label: "Affirm thesis",
                onAction: ()=>{
                    void affirmView();
                },
                unavailableReason: isReference ? "Reference output cannot be ratified" : !live.runId ? "Run analysis first — there is no live view to affirm" : analysis.loading ? "Preparing analysis workspace…" : affirmState === "saving" ? "Affirmation is being saved…" : null,
                title: "Append an immutable thesis version and pin the affirmed view"
            },
            status: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "flex items-center gap-2",
                children: [
                    decisionAsOf ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs text-caos-muted",
                        children: [
                            "Observed ",
                            decisionAsOf
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/deepdive/page.tsx",
                        lineNumber: 580,
                        columnNumber: 27
                    }, this) : null,
                    affirmNotice ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        role: "status",
                        className: "tabular text-caos-2xs text-caos-muted",
                        children: affirmNotice
                    }, void 0, false, {
                        fileName: "[project]/src/app/deepdive/page.tsx",
                        lineNumber: 581,
                        columnNumber: 27
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/deepdive/page.tsx",
                lineNumber: 579,
                columnNumber: 9
            }, this),
            contextualControls: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: ()=>setChatOpen(!chatOpen),
                title: `Ask about ${code} (Alt+K)`,
                className: "caos-secondary-action focus-ring",
                children: [
                    "ASK ",
                    code
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/deepdive/page.tsx",
                lineNumber: 585,
                columnNumber: 9
            }, this),
            utilityLabel: "Layout and simulation",
            utilityControls: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-1 shrink-0",
                        role: "group",
                        "aria-label": "Deep-Dive layout",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DeepDiveLayoutPicker, {
                            layout: layout,
                            onPick: pickLayout,
                            labelClassName: "hidden xl:inline"
                        }, void 0, false, {
                            fileName: "[project]/src/app/deepdive/page.tsx",
                            lineNumber: 597,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/deepdive/page.tsx",
                        lineNumber: 596,
                        columnNumber: 11
                    }, this),
                    live.runId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$reports$2f$ExportToVaultButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ExportToVaultButton"], {
                        runId: live.runId
                    }, void 0, false, {
                        fileName: "[project]/src/app/deepdive/page.tsx",
                        lineNumber: 599,
                        columnNumber: 25
                    }, this) : null,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SimControls"], {
                        run: run
                    }, void 0, false, {
                        fileName: "[project]/src/app/deepdive/page.tsx",
                        lineNumber: 600,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true),
            narrowContract: narrowContract,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "caos-persona-route deepdive-workbench flex-1 min-h-0",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$PersonaWorkbench$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["PersonaWorkbench"], {
                    surface: "deep-dive",
                    decision: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$DecisionHeader$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DecisionHeader"], {
                        state: deepDecision,
                        defaultOpen: false
                    }, void 0, false, {
                        fileName: "[project]/src/app/deepdive/page.tsx",
                        lineNumber: 608,
                        columnNumber: 19
                    }, this),
                    primary: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "h-full min-h-0 flex flex-col",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "contents",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "px-2.5 py-2 bg-caos-panel border-b border-caos-border",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ScenarioNetworkPanel, {
                                        issuerId: issuerId,
                                        runId: live.runId
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                        lineNumber: 617,
                                        columnNumber: 9
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                    lineNumber: 616,
                                    columnNumber: 7
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative shrink-0 border-b border-caos-border",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            ref: stripRef,
                                            onScroll: syncEdges,
                                            className: "h-9 bg-caos-panel/40 flex items-center px-4 gap-2 overflow-x-auto caos-no-scrollbar",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap hidden lg:inline",
                                                    title: "Alt + , / .  cycles the open module",
                                                    children: "Module outputs"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                                    lineNumber: 629,
                                                    columnNumber: 9
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$ModuleFinder$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ModuleFinder"], {
                                                    onSelect: setTab,
                                                    activeId: tab
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                                    lineNumber: 630,
                                                    columnNumber: 9
                                                }, this),
                                                GROUPS.map((g)=>{
                                                    const open = openLayers.has(g.label);
                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center gap-1.5 pl-2.5 border-l border-caos-border shrink-0",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                onClick: ()=>toggleLayer(g.label),
                                                                "aria-expanded": open,
                                                                title: (open ? "Collapse " : "Expand ") + g.label,
                                                                className: "flex min-h-6 items-center gap-1.5 rounded px-1 py-0.5 hover:bg-caos-elevated/50 transition-caos focus-ring",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "tabular text-caos-2xs uppercase tracking-wider text-caos-muted whitespace-nowrap",
                                                                        children: g.label
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                                        lineNumber: 642,
                                                                        columnNumber: 17
                                                                    }, this),
                                                                    !open ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(CollapsedLayerSummary, {
                                                                        group: g,
                                                                        stateFor: modState,
                                                                        isReference: isReference
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                                        lineNumber: 643,
                                                                        columnNumber: 26
                                                                    }, this) : null,
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "tabular text-caos-2xs text-caos-muted",
                                                                        children: open ? "▾" : "▸"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                                        lineNumber: 644,
                                                                        columnNumber: 17
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/app/deepdive/page.tsx",
                                                                lineNumber: 636,
                                                                columnNumber: 15
                                                            }, this),
                                                            open ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "flex items-center gap-1",
                                                                children: g.mods.map((id)=>{
                                                                    const st = modState(id);
                                                                    const ok = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["isCleared"])(st);
                                                                    const sel = tab === id;
                                                                    const name = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MODULES"].find((m)=>m.id === id)?.name ?? id;
                                                                    const short = name.split(" ")[0];
                                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                        onClick: ()=>setTab(id),
                                                                        title: name,
                                                                        "aria-label": name,
                                                                        "aria-current": sel ? "true" : undefined,
                                                                        "data-active-chip": sel ? "true" : undefined,
                                                                        className: "flex items-center gap-1.5 tabular text-caos-sm px-2 py-1 rounded border transition-caos whitespace-nowrap focus-ring " + (sel ? "bg-caos-elevated text-caos-text border-caos-accent" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50"),
                                                                        children: [
                                                                            ok ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Dot"], {
                                                                                sev: st,
                                                                                pulse: st === "running"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/app/deepdive/page.tsx",
                                                                                lineNumber: 674,
                                                                                columnNumber: 31
                                                                            }, this) : st === "failed" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Dot"], {
                                                                                sev: "blocked",
                                                                                glyph: true
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/app/deepdive/page.tsx",
                                                                                lineNumber: 674,
                                                                                columnNumber: 93
                                                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: "opacity-60",
                                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                                                                                    kind: isReference ? "locked" : "idle"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                                                                    lineNumber: 674,
                                                                                    columnNumber: 152
                                                                                }, this)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/app/deepdive/page.tsx",
                                                                                lineNumber: 674,
                                                                                columnNumber: 123
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: "hidden 2xl:inline",
                                                                                children: name
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/app/deepdive/page.tsx",
                                                                                lineNumber: 675,
                                                                                columnNumber: 25
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: "2xl:hidden",
                                                                                children: short
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/app/deepdive/page.tsx",
                                                                                lineNumber: 676,
                                                                                columnNumber: 25
                                                                            }, this)
                                                                        ]
                                                                    }, id, true, {
                                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                                        lineNumber: 656,
                                                                        columnNumber: 23
                                                                    }, this);
                                                                })
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/app/deepdive/page.tsx",
                                                                lineNumber: 647,
                                                                columnNumber: 17
                                                            }, this) : null
                                                        ]
                                                    }, g.label, true, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 635,
                                                        columnNumber: 13
                                                    }, this);
                                                })
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/deepdive/page.tsx",
                                            lineNumber: 624,
                                            columnNumber: 7
                                        }, this),
                                        edges.left ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    "aria-hidden": true,
                                                    className: "pointer-events-none absolute left-0 inset-y-0 w-12",
                                                    style: {
                                                        background: "linear-gradient(to right, var(--caos-strip-bg), transparent)"
                                                    }
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                                    lineNumber: 690,
                                                    columnNumber: 13
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>nudgeStrip(-1),
                                                    "aria-label": "Scroll module layers left",
                                                    className: "absolute left-0 inset-y-0 min-w-6 px-1.5 flex items-center justify-center text-caos-lg text-caos-muted hover:text-caos-text transition-caos focus-ring",
                                                    style: {
                                                        background: "var(--caos-strip-bg)"
                                                    },
                                                    children: "‹"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                                    lineNumber: 691,
                                                    columnNumber: 13
                                                }, this)
                                            ]
                                        }, void 0, true) : null,
                                        edges.right ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    "aria-hidden": true,
                                                    className: "pointer-events-none absolute right-0 inset-y-0 w-12",
                                                    style: {
                                                        background: "linear-gradient(to left, var(--caos-strip-bg), transparent)"
                                                    }
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                                    lineNumber: 704,
                                                    columnNumber: 13
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "button",
                                                    onClick: ()=>nudgeStrip(1),
                                                    "aria-label": "Scroll module layers right",
                                                    className: "absolute right-0 inset-y-0 min-w-6 px-1.5 flex items-center justify-center text-caos-lg text-caos-muted hover:text-caos-text transition-caos focus-ring",
                                                    style: {
                                                        background: "var(--caos-strip-bg)"
                                                    },
                                                    children: "›"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                                    lineNumber: 705,
                                                    columnNumber: 13
                                                }, this)
                                            ]
                                        }, void 0, true) : null
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                    lineNumber: 623,
                                    columnNumber: 7
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$FirstRunHint$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FirstRunHint"], {
                                    id: "deepdive-panes",
                                    className: "mx-2 mt-2 shrink-0",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-white font-medium",
                                            children: "Three panes:"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/deepdive/page.tsx",
                                            lineNumber: 719,
                                            columnNumber: 9
                                        }, this),
                                        " sources & evidence (left) · module analysis (center) · the IC decision & sizing (right). Click any",
                                        " ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "tabular text-caos-accent",
                                            children: "E-xx"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/deepdive/page.tsx",
                                            lineNumber: 720,
                                            columnNumber: 9
                                        }, this),
                                        " chip to open its cited source.",
                                        " ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-caos-muted",
                                            children: [
                                                "Hold ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "tabular text-caos-text",
                                                    children: "Alt"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                                    lineNumber: 721,
                                                    columnNumber: 48
                                                }, this),
                                                " — ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "tabular text-caos-text",
                                                    children: ","
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                                    lineNumber: 721,
                                                    columnNumber: 102
                                                }, this),
                                                "/",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "tabular text-caos-text",
                                                    children: "."
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                                    lineNumber: 721,
                                                    columnNumber: 152
                                                }, this),
                                                " cycle modules, ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "tabular text-caos-text",
                                                    children: "C"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                                    lineNumber: 721,
                                                    columnNumber: 217
                                                }, this),
                                                " collapse panes, ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "tabular text-caos-text",
                                                    children: "K"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                                    lineNumber: 721,
                                                    columnNumber: 283
                                                }, this),
                                                " Ask."
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/deepdive/page.tsx",
                                            lineNumber: 721,
                                            columnNumber: 9
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                    lineNumber: 718,
                                    columnNumber: 7
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$StandingViewStrip$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["StandingViewStrip"], {
                                    isReference: isReference,
                                    issuerId: issuerId,
                                    runId: live.runId,
                                    onRevise: (id)=>setTab(id)
                                }, void 0, false, {
                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                    lineNumber: 726,
                                    columnNumber: 7
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "deepdive-analysis-grid flex-1 min-h-0 grid gap-2 p-2",
                                    style: {
                                        gridTemplateColumns: (railOpen ? "330px" : "42px") + " minmax(0,1fr) " + (decisionOpen ? "352px" : "42px")
                                    },
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$rails$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["SourceRail"], {
                                            ev: evModal,
                                            open: railOpen,
                                            onToggle: ()=>setRailOpen(!railOpen),
                                            isReference: isReference,
                                            issuerCode: code,
                                            issuerName: isReference ? undefined : dealLabel
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/deepdive/page.tsx",
                                            lineNumber: 738,
                                            columnNumber: 9
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Panel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Panel"], {
                                            title: title,
                                            className: "deepdive-analysis-primary",
                                            right: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "flex items-center gap-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "tabular text-caos-xs text-caos-muted",
                                                        children: code
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 744,
                                                        columnNumber: 15
                                                    }, this),
                                                    moduleQaState === "failed" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "tabular text-caos-xs",
                                                        style: {
                                                            color: "var(--caos-critical)"
                                                        },
                                                        title: "This module hit its failure gate (qa_status Blocked) and did not complete — no usable output.",
                                                        children: "✕ BLOCKED"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 749,
                                                        columnNumber: 17
                                                    }, this) : moduleQaState === "warning" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "tabular text-caos-xs",
                                                        style: {
                                                            color: "var(--caos-warning)"
                                                        },
                                                        title: "QA gate: this module's output is Restricted — committee-usable with caveats, not a clean pass.",
                                                        children: "△ RESTRICTED"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 753,
                                                        columnNumber: 17
                                                    }, this) : moduleQaState === "not-reviewed" && moduleIsLive ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "tabular text-caos-xs text-caos-muted",
                                                        title: "QA status: Not Reviewed. This persisted output is not a clean pass.",
                                                        children: "◦ NOT REVIEWED"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 757,
                                                        columnNumber: 17
                                                    }, this) : moduleQaState === "idle" && moduleIsLive ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "tabular text-caos-xs text-caos-muted",
                                                        title: "No persisted QA status is available for this live output; it is not a clean pass.",
                                                        children: "◦ NO QA STATUS"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 761,
                                                        columnNumber: 17
                                                    }, this) : moduleIsLive ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "tabular text-caos-xs",
                                                        style: {
                                                            color: "var(--caos-accent)"
                                                        },
                                                        title: "Rendering this issuer's live engine output for this module; QA status: Passed.",
                                                        children: "● LIVE · PASSED"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 765,
                                                        columnNumber: 17
                                                    }, this) : !isReference ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "tabular text-caos-xs text-caos-muted",
                                                        title: "This module has no issuer-specific output available.",
                                                        children: "◦ NO OUTPUT"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 769,
                                                        columnNumber: 17
                                                    }, this) : referenceUnavailable ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "tabular text-caos-xs text-caos-muted",
                                                        title: "No synthetic reference finding is supplied for this module.",
                                                        children: "◦ NO REFERENCE OUTPUT"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 773,
                                                        columnNumber: 17
                                                    }, this) : null
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/app/deepdive/page.tsx",
                                                lineNumber: 743,
                                                columnNumber: 13
                                            }, this),
                                            children: moduleFailed ? // The module ran but hit its failure gate (Blocked) — show that plainly
                                            // instead of an empty ModuleView, so a failed module is legible in the
                                            // pane, not just the launcher strip. (identify failed modules)
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "h-full flex flex-col items-center justify-center gap-2 text-caos-muted text-center px-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Dot"], {
                                                        sev: "blocked",
                                                        glyph: true
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 785,
                                                        columnNumber: 15
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "tabular text-caos-xl",
                                                        style: {
                                                            color: "var(--caos-critical)"
                                                        },
                                                        children: [
                                                            tab,
                                                            " failed"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 786,
                                                        columnNumber: 15
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-caos-md",
                                                        children: "this module hit its failure gate and produced no usable output"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 787,
                                                        columnNumber: 15
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-caos-xs tabular",
                                                        children: [
                                                            "any downstream module that depends on ",
                                                            tab,
                                                            " is gated in turn"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 788,
                                                        columnNumber: 15
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/app/deepdive/page.tsx",
                                                lineNumber: 784,
                                                columnNumber: 13
                                            }, this) : unlocked ? // The bespoke debate/recovery/covenant tabs are the ATLF reference
                                            // *showcase*. For a real issuer with a live run for that module, render
                                            // its honest engine output via the generic ModuleView instead of the
                                            // ATLF fixture; keep the bespoke tab for the reference deal (or when no
                                            // live output exists yet, where the "reference template" caveat applies).
                                            useBespoke ? tab === "CP-6A" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DebateTab, {
                                                onOpenEvidence: setEvModal,
                                                layout: layout
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/deepdive/page.tsx",
                                                lineNumber: 797,
                                                columnNumber: 33
                                            }, this) : tab === "CP-6E" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DebateTab, {
                                                variant: "CP-6E",
                                                onOpenEvidence: setEvModal,
                                                layout: layout
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/deepdive/page.tsx",
                                                lineNumber: 798,
                                                columnNumber: 33
                                            }, this) : tab === "CP-3B" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(RecoveryTab, {
                                                onOpenEvidence: setEvModal,
                                                layout: layout
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/deepdive/page.tsx",
                                                lineNumber: 799,
                                                columnNumber: 33
                                            }, this) : // CP-4: the ATLF showcase fixture PLUS the live cross-default domino
                                            // map (WP-4 G13) — the fixture has its own bespoke COVENANTS/CAPACITY
                                            // narrative, the domino section is real, run-sourced data (honestly
                                            // empty when this issuer_id has no completed run, which is the ATLF
                                            // reference's usual state).
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(CovenantsTab, {
                                                        onOpenEvidence: setEvModal,
                                                        layout: layout
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 806,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CrossDefaultDominoes$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CrossDefaultDominoes"], {
                                                        issuerId: issuerId,
                                                        hasRun: !!live.runId
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 807,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ModuleView, {
                                                        id: tab,
                                                        sim: run.sim,
                                                        onOpenEvidence: setEvModal,
                                                        liveOut: live.liveOuts[tab],
                                                        allowSeededFallback: isReference,
                                                        layout: layout
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 811,
                                                        columnNumber: 17
                                                    }, this),
                                                    tab === "CP-4" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(LiveCovenantCapacity, {
                                                        signals: issuerMeta?.signals ?? {}
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 812,
                                                        columnNumber: 35
                                                    }, this) : null,
                                                    tab === "CP-4" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CrossDefaultDominoes$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CrossDefaultDominoes"], {
                                                        issuerId: issuerId,
                                                        hasRun: !!live.runId
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 815,
                                                        columnNumber: 35
                                                    }, this) : null
                                                ]
                                            }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "h-full flex flex-col items-center justify-center gap-2 text-caos-muted",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Dot"], {
                                                        sev: gateState(gateId),
                                                        pulse: gateState(gateId) === "running"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 820,
                                                        columnNumber: 15
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "tabular text-caos-xl",
                                                        children: [
                                                            gateId,
                                                            " ",
                                                            gateState(gateId) === "running" ? "running…" : "awaiting upstream dependencies"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 821,
                                                        columnNumber: 15
                                                    }, this),
                                                    (()=>{
                                                        // "Awaiting" and "running…" are mutually exclusive truths: once
                                                        // the gate module is running its dependencies have cleared.
                                                        if (gateState(gateId) === "running") return null;
                                                        const planStep = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIM_PLAN"].find((s)=>s.id === gateId);
                                                        const upstreamDeps = planStep ? planStep.deps : [];
                                                        return upstreamDeps.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-caos-xs tabular text-caos-muted",
                                                            children: [
                                                                "Awaiting: ",
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    style: {
                                                                        color: "var(--caos-accent)"
                                                                    },
                                                                    children: upstreamDeps.join(", ")
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                                                    lineNumber: 830,
                                                                    columnNumber: 31
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/app/deepdive/page.tsx",
                                                            lineNumber: 829,
                                                            columnNumber: 19
                                                        }, this) : null;
                                                    })(),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-caos-md",
                                                        children: "output unlocks when the producing module clears its gate"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/deepdive/page.tsx",
                                                        lineNumber: 834,
                                                        columnNumber: 15
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/app/deepdive/page.tsx",
                                                lineNumber: 819,
                                                columnNumber: 13
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/deepdive/page.tsx",
                                            lineNumber: 739,
                                            columnNumber: 9
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$rails$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["DecisionRail"], {
                                            open: decisionOpen,
                                            onToggle: ()=>setDecisionOpen(!decisionOpen),
                                            council: live.council,
                                            councilState: isReference ? "ready" : live.loading ? "loading" : live.phase === "error" ? "error" : live.runId ? "ready" : "unavailable",
                                            isReference: isReference,
                                            issuerCode: code
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/deepdive/page.tsx",
                                            lineNumber: 838,
                                            columnNumber: 9
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                    lineNumber: 734,
                                    columnNumber: 7
                                }, this),
                                evModal && reports ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(EvidenceModal, {
                                    id: evModal,
                                    reports: reports,
                                    live: live.liveEvidence,
                                    isLiveRun: !isReference && !!live.runId,
                                    onClose: ()=>setEvModal(null)
                                }, void 0, false, {
                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                    lineNumber: 848,
                                    columnNumber: 29
                                }, this) : null,
                                chatOpen ? // Live-ground the chat for a real issuer run; the reference deal keeps its
                                // rich seeded showcase context (consistent with the bespoke tabs).
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(IssuerChat, {
                                    tab: tab,
                                    onClose: ()=>setChatOpen(false),
                                    live: isReference ? undefined : live,
                                    issuerName: isReference ? undefined : issuerMeta?.name
                                }, isReference ? "chat-ref" : "chat-" + (live.runId || "loading"), false, {
                                    fileName: "[project]/src/app/deepdive/page.tsx",
                                    lineNumber: 852,
                                    columnNumber: 9
                                }, this) : null
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/deepdive/page.tsx",
                            lineNumber: 610,
                            columnNumber: 7
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/deepdive/page.tsx",
                        lineNumber: 609,
                        columnNumber: 18
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/app/deepdive/page.tsx",
                    lineNumber: 606,
                    columnNumber: 7
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/app/deepdive/page.tsx",
                lineNumber: 605,
                columnNumber: 7
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/app/deepdive/page.tsx",
            lineNumber: 528,
            columnNumber: 5
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/deepdive/page.tsx",
        lineNumber: 527,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=src_1w7suk9._.js.map