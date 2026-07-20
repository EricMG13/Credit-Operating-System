module.exports = [
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/util [external] (util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}),
"[externals]/stream [external] (stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("stream", () => require("stream"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[externals]/http [external] (http, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("http", () => require("http"));

module.exports = mod;
}),
"[externals]/https [external] (https, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("https", () => require("https"));

module.exports = mod;
}),
"[externals]/url [external] (url, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("url", () => require("url"));

module.exports = mod;
}),
"[externals]/fs [external] (fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/net [external] (net, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("net", () => require("net"));

module.exports = mod;
}),
"[externals]/tls [external] (tls, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("tls", () => require("tls"));

module.exports = mod;
}),
"[externals]/assert [external] (assert, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("assert", () => require("assert"));

module.exports = mod;
}),
"[externals]/tty [external] (tty, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("tty", () => require("tty"));

module.exports = mod;
}),
"[externals]/os [external] (os, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("os", () => require("os"));

module.exports = mod;
}),
"[externals]/events [external] (events, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("events", () => require("events"));

module.exports = mod;
}),
"[externals]/http2 [external] (http2, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("http2", () => require("http2"));

module.exports = mod;
}),
"[externals]/zlib [external] (zlib, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("zlib", () => require("zlib"));

module.exports = mod;
}),
"[project]/src/lib/api.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PRINCIPAL_STORAGE_KEY",
    ()=>PRINCIPAL_STORAGE_KEY,
    "RESEARCH_ABORTED",
    ()=>RESEARCH_ABORTED,
    "RESEARCH_GONE",
    ()=>RESEARCH_GONE,
    "api",
    ()=>api,
    "appendIngestionContext",
    ()=>appendIngestionContext,
    "askIssuer",
    ()=>askIssuer,
    "bindWorkspacePrincipal",
    ()=>bindWorkspacePrincipal,
    "buildRunCreatePayload",
    ()=>buildRunCreatePayload,
    "calculateModelV2",
    ()=>calculateModelV2,
    "clearWorkspaceStorage",
    ()=>clearWorkspaceStorage,
    "commitModelV2Workbook",
    ()=>commitModelV2Workbook,
    "createDecision",
    ()=>createDecision,
    "createIssuer",
    ()=>createIssuer,
    "createModelCheckpoint",
    ()=>createModelCheckpoint,
    "createModelV2Checkpoint",
    ()=>createModelV2Checkpoint,
    "createPortfolio",
    ()=>createPortfolio,
    "createProfile",
    ()=>createProfile,
    "createQaFlag",
    ()=>createQaFlag,
    "createRun",
    ()=>createRun,
    "createThesisVersion",
    ()=>createThesisVersion,
    "deepResearch",
    ()=>deepResearch,
    "edgarVaultUrl",
    ()=>edgarVaultUrl,
    "edgarVaultUrls",
    ()=>edgarVaultUrls,
    "exportModelV2Workbook",
    ()=>exportModelV2Workbook,
    "exportReport",
    ()=>exportReport,
    "exportReportVersionBinary",
    ()=>exportReportVersionBinary,
    "exportToVault",
    ()=>exportToVault,
    "getAlertEvents",
    ()=>getAlertEvents,
    "getAlertStates",
    ()=>getAlertStates,
    "getAnalystSettings",
    ()=>getAnalystSettings,
    "getAutonomyDraft",
    ()=>getAutonomyDraft,
    "getChunk",
    ()=>getChunk,
    "getContextFreshness",
    ()=>getContextFreshness,
    "getCrossDefaultMap",
    ()=>getCrossDefaultMap,
    "getDecisions",
    ()=>getDecisions,
    "getDigest",
    ()=>getDigest,
    "getIngestionGaps",
    ()=>getIngestionGaps,
    "getIssuer",
    ()=>getIssuer,
    "getIssuerFreshness",
    ()=>getIssuerFreshness,
    "getIssuerProfile",
    ()=>getIssuerProfile,
    "getIssuers",
    ()=>getIssuers,
    "getMe",
    ()=>getMe,
    "getMetricCatalog",
    ()=>getMetricCatalog,
    "getModelCheckpoints",
    ()=>getModelCheckpoints,
    "getModelV2",
    ()=>getModelV2,
    "getModelV2Checkpoints",
    ()=>getModelV2Checkpoints,
    "getModelV2History",
    ()=>getModelV2History,
    "getModule",
    ()=>getModule,
    "getModules",
    ()=>getModules,
    "getPortfolio",
    ()=>getPortfolio,
    "getPortfolioDetail",
    ()=>getPortfolioDetail,
    "getPortfolios",
    ()=>getPortfolios,
    "getQA",
    ()=>getQA,
    "getReportDraft",
    ()=>getReportDraft,
    "getReportVersion",
    ()=>getReportVersion,
    "getResearchStatus",
    ()=>getResearchStatus,
    "getRun",
    ()=>getRun,
    "getRunFreshness",
    ()=>getRunFreshness,
    "getSavedModel",
    ()=>getSavedModel,
    "getSectorFeeds",
    ()=>getSectorFeeds,
    "getSettings",
    ()=>getSettings,
    "getSponsorTrackRecord",
    ()=>getSponsorTrackRecord,
    "getSponsors",
    ()=>getSponsors,
    "getThesisVersions",
    ()=>getThesisVersions,
    "getWatchlist",
    ()=>getWatchlist,
    "isResearchAborted",
    ()=>isResearchAborted,
    "isResearchGone",
    ()=>isResearchGone,
    "listNotifications",
    ()=>listNotifications,
    "listQaFlags",
    ()=>listQaFlags,
    "listReportVersions",
    ()=>listReportVersions,
    "listRuns",
    ()=>listRuns,
    "login",
    ()=>login,
    "logout",
    ()=>logout,
    "markNotificationSeen",
    ()=>markNotificationSeen,
    "mutateModelV2Override",
    ()=>mutateModelV2Override,
    "mutateModelV2OverridesBatch",
    ()=>mutateModelV2OverridesBatch,
    "patchAlertEvent",
    ()=>patchAlertEvent,
    "patchAnalystSettings",
    ()=>patchAnalystSettings,
    "previewModelV2Workbook",
    ()=>previewModelV2Workbook,
    "previewReportVersion",
    ()=>previewReportVersion,
    "propagateScenario",
    ()=>propagateScenario,
    "publishReportVersion",
    ()=>publishReportVersion,
    "queryCapabilities",
    ()=>queryCapabilities,
    "queryGraph",
    ()=>queryGraph,
    "realizeThesisPrediction",
    ()=>realizeThesisPrediction,
    "recoverLogin",
    ()=>recoverLogin,
    "refreshAlertEvents",
    ()=>refreshAlertEvents,
    "register",
    ()=>register,
    "reopenDecision",
    ()=>reopenDecision,
    "replayModelV2Override",
    ()=>replayModelV2Override,
    "restoreModelCheckpoint",
    ()=>restoreModelCheckpoint,
    "restoreModelV2Checkpoint",
    ()=>restoreModelV2Checkpoint,
    "resumeResearch",
    ()=>resumeResearch,
    "saveAnalystSettings",
    ()=>saveAnalystSettings,
    "saveModel",
    ()=>saveModel,
    "saveModelV2",
    ()=>saveModelV2,
    "saveReportDraft",
    ()=>saveReportDraft,
    "saveWatchlist",
    ()=>saveWatchlist,
    "scenarioFromNL",
    ()=>scenarioFromNL,
    "setAlertState",
    ()=>setAlertState,
    "toErrorMessage",
    ()=>toErrorMessage,
    "updateAnalystWorkspace",
    ()=>updateAnalystWorkspace,
    "updateSectorFeeds",
    ()=>updateSectorFeeds,
    "uploadDocument",
    ()=>uploadDocument,
    "uploadPortfolioHoldings",
    ()=>uploadPortfolioHoldings,
    "uploadPricingSheet",
    ()=>uploadPricingSheet,
    "uploadVaultMemo",
    ()=>uploadVaultMemo,
    "voteDecision",
    ()=>voteDecision
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/axios/lib/axios.js [app-ssr] (ecmascript)");
;
;
const api = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"].create({
    headers: {
        "Content-Type": "application/json"
    },
    // Default timeout so a hung/dead API (or a proxy to a dead :8000) can't strand
    // the UI forever — live-overlay module fetches, the settings probe, run polls.
    // Deep Research is now a durable background job polled by short GETs, so it
    // relies on this default too (no long-held per-request override). P1/P2/L6.
    timeout: 20000
});
const UNSAFE_METHODS = new Set([
    "post",
    "put",
    "patch",
    "delete"
]);
function csrfCookie() {
    if (typeof document === "undefined") return undefined;
    const prefix = "caos_csrf=";
    const item = document.cookie.split("; ").find((part)=>part.startsWith(prefix));
    return item ? decodeURIComponent(item.slice(prefix.length)) : undefined;
}
// Per-analyst model mode → X-Model-Mode on every request. The server resolves it
// to a model tier per LLM lane (engine/presets.py); runs persist the mode they
// ran at. SSR has no localStorage, so this only attaches in the browser.
api.interceptors.request.use((config)=>{
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return config;
});
// SEAM4-1: surface a lost/rotated session. Any /api 401 (an expired or revoked
// profile cookie behind SSO, a lost cookie off-proxy) fires an app-level event
// that AuthProvider handles by re-resolving /api/auth/me — so the UI routes to the
// login landing instead of silently 401-ing every call over stale, still-rendered
// data. The /me probe is excluded (AuthProvider owns its own result), as are the
// exact unauthenticated credential-entry POSTs: their expected 401s belong to the
// mounted login form and must not remount it before its inline error renders.
// The error is re-thrown untouched so every per-call handler still runs.
const AUTH_ENTRY_POST_PATHS = new Set([
    "/api/auth/profile",
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/recover"
]);
function requestPath(url) {
    if (!url) return "";
    try {
        return new URL(url, "http://caos.local").pathname;
    } catch  {
        return "";
    }
}
function requestOwnsUnauthorizedError(url, method) {
    const path = requestPath(url);
    return path === "/api/auth/me" || method?.toLowerCase() === "post" && AUTH_ENTRY_POST_PATHS.has(path);
}
api.interceptors.response.use((response)=>response, (error)=>{
    if (("TURBOPACK compile-time value", "undefined") !== "undefined" && __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"].isAxiosError(error) && error.response?.status === 401 && !requestOwnsUnauthorizedError(error.config?.url, error.config?.method)) //TURBOPACK unreachable
    ;
    return Promise.reject(error);
});
function toErrorMessage(err, fallback) {
    const detail = err?.response?.data?.detail;
    if (typeof detail === "string" && detail) return detail;
    if (Array.isArray(detail)) {
        const msgs = detail.map((d)=>{
            if (typeof d === "string") return d;
            const { loc, msg } = d ?? {};
            if (typeof msg !== "string") return "";
            const field = Array.isArray(loc) && loc.length ? String(loc[loc.length - 1]) : "";
            return field ? `${field}: ${msg}` : msg;
        }).filter(Boolean);
        if (msgs.length) return msgs.join("; ");
    }
    if (detail && typeof detail === "object") {
        const message = detail.message;
        if (typeof message === "string" && message) return message;
    }
    const msg = err?.message;
    return typeof msg === "string" && msg ? msg : fallback;
}
const getMe = ()=>api.get("/api/auth/me", {
        timeout: 8000
    }).then((r)=>r.data);
const getPortfolio = ()=>api.get("/api/portfolio").then((r)=>r.data);
const createProfile = (code, name)=>api.post("/api/auth/profile", {
        code,
        name
    }, {
        timeout: 8000
    }).then((r)=>r.data);
const logout = ()=>api.post("/api/auth/logout", {}, {
        timeout: 8000
    });
const listNotifications = (cursor)=>api.get("/api/notifications", {
        params: cursor ? {
            cursor
        } : undefined,
        timeout: 8000
    }).then((r)=>r.data);
const markNotificationSeen = (notificationId)=>api.patch(`/api/notifications/${encodeURIComponent(notificationId)}/seen`, undefined, {
        timeout: 8000
    }).then((r)=>r.data);
const clearWorkspaceStorage = ()=>{
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
    const clearCaosKeys = undefined;
};
const PRINCIPAL_STORAGE_KEY = "caos.principal.id";
const bindWorkspacePrincipal = (principalId)=>{
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
    let prior;
};
const register = (data)=>api.post("/api/auth/register", data, {
        timeout: 8000
    }).then((r)=>r.data);
const login = (email, passcode)=>api.post("/api/auth/login", {
        email,
        passcode
    }, {
        timeout: 8000
    }).then((r)=>r.data);
const recoverLogin = (email, recovery_words)=>api.post("/api/auth/recover", {
        email,
        recovery_words
    }, {
        timeout: 8000
    }).then((r)=>r.data);
const getIssuers = (q)=>api.get("/api/issuers/", {
        params: q && q.trim() ? {
            q: q.trim()
        } : {}
    }).then((r)=>{
        if (Array.isArray(r.data)) return r.data;
        throw new Error("Invalid issuer response");
    });
const createIssuer = (data)=>api.post("/api/issuers/", data).then((r)=>r.data);
const getIssuer = (id)=>api.get(`/api/issuers/${id}`).then((r)=>r.data);
const getIssuerProfile = (id)=>api.get(`/api/issuers/${id}/profile`).then((r)=>r.data);
const getCrossDefaultMap = (id)=>api.get(`/api/issuers/${encodeURIComponent(id)}/cross-default`).then((r)=>r.data);
const getSponsors = ()=>api.get("/api/sponsors/").then((r)=>r.data);
const getSponsorTrackRecord = (name)=>api.get(`/api/sponsors/${encodeURIComponent(name)}`).then((r)=>r.data);
const getDigest = ()=>api.get("/api/digest/daily").then((r)=>r.data);
const getIssuerFreshness = (id, signal)=>api.get(`/api/issuers/${encodeURIComponent(id)}/freshness`, {
        signal
    }).then((r)=>r.data);
const getRunFreshness = (id, signal)=>api.get(`/api/runs/${encodeURIComponent(id)}/freshness`, {
        signal
    }).then((r)=>r.data);
const getContextFreshness = (id, signal)=>api.get(`/api/analysis/contexts/${encodeURIComponent(id)}/freshness`, {
        signal
    }).then((r)=>r.data);
const getIngestionGaps = ()=>api.get("/api/digest/ingestion-gaps").then((r)=>r.data);
const askIssuer = (messages)=>api.post("/api/chat/issuer", {
        messages
    }).then((r)=>r.data.reply);
const getSectorFeeds = ()=>api.get("/api/sector/feeds").then((r)=>r.data);
const updateSectorFeeds = (feeds)=>api.put("/api/sector/feeds", {
        feeds
    }).then((r)=>r.data);
const uploadDocument = (formData)=>api.post("/api/ingestion/upload/document", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        },
        timeout: 300_000
    }).then((r)=>r.data);
const uploadPricingSheet = (formData)=>api.post("/api/ingestion/upload/pricing-sheet", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        },
        timeout: 300_000
    }).then((r)=>r.data);
const appendIngestionContext = (formData, contextId)=>{
    if (contextId) formData.append("context_id", contextId);
    return formData;
};
const uploadVaultMemo = (formData)=>api.post("/api/ingestion/upload/memo", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        },
        // Same synchronous ingest pipeline (AV scan + parse) as the sibling uploads —
        // don't leave this one on the 20s instance default.
        timeout: 60_000
    }).then((r)=>r.data);
const getPortfolios = ()=>api.get("/api/portfolios/").then((r)=>r.data);
const getPortfolioDetail = (id)=>api.get(`/api/portfolios/${id}`).then((r)=>r.data);
const createPortfolio = (formData)=>api.post("/api/portfolios/", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        },
        timeout: 300_000
    }).then((r)=>r.data);
const uploadPortfolioHoldings = (id, formData)=>api.post(`/api/portfolios/${id}/holdings`, formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        },
        timeout: 300_000
    }).then((r)=>r.data);
const createRun = (issuerId, asOfDate, portfolioId, idempotencyKey, contextId)=>api.post("/api/runs", buildRunCreatePayload(issuerId, asOfDate, portfolioId, contextId), idempotencyKey ? {
        headers: {
            "Idempotency-Key": idempotencyKey
        }
    } : undefined).then((r)=>r.data);
const buildRunCreatePayload = (issuerId, asOfDate, portfolioId, contextId)=>({
        issuer_id: issuerId,
        as_of_date: asOfDate,
        portfolio_id: portfolioId,
        context_id: contextId
    });
const listRuns = (issuerId)=>api.get("/api/runs", {
        params: issuerId ? {
            issuer_id: issuerId
        } : {}
    }).then((r)=>r.data);
const getRun = (runId)=>api.get(`/api/runs/${runId}`).then((r)=>r.data);
const getModule = (runId, moduleId)=>api.get(`/api/runs/${runId}/modules/${moduleId}`).then((r)=>r.data);
const getModules = (runId)=>api.get(`/api/runs/${runId}/modules`).then((r)=>r.data);
const getQA = (runId)=>api.get(`/api/runs/${runId}/qa`).then((r)=>r.data);
const createQaFlag = (data)=>api.post("/api/qa/flags", data).then((r)=>r.data);
const listQaFlags = (params)=>api.get("/api/qa/flags", {
        params
    }).then((r)=>r.data);
const exportReport = (runId)=>api.post(`/api/runs/${runId}/report`).then((r)=>r.data);
const exportToVault = (runId)=>api.post(`/api/runs/${runId}/vault`).then((r)=>r.data);
const getMetricCatalog = ()=>api.get("/api/query/catalog").then((r)=>r.data.metrics);
const getChunk = (chunkId)=>api.get(`/api/query/chunk/${chunkId}`).then((r)=>r.data);
const queryCapabilities = ()=>api.get("/api/query/capabilities").then((r)=>r.data);
const queryGraph = (capabilityId, issuerId, theme, issuerIdB)=>api.post("/api/query/graph", {
        capability_id: capabilityId,
        issuer_id: issuerId,
        theme,
        issuer_id_b: issuerIdB
    }).then((r)=>r.data);
const getWatchlist = ()=>api.get("/api/query/watchlist").then((r)=>r.data);
const saveWatchlist = (issuer_ids)=>api.put("/api/query/watchlist", {
        issuer_ids
    }).then((r)=>r.data);
const scenarioFromNL = (text)=>api.post("/api/scenario/nl", {
        text
    }).then((r)=>r.data);
const propagateScenario = (body)=>api.post("/api/scenario/propagate", body).then((r)=>r.data);
const getDecisions = (issuerId)=>api.get("/api/decisions", {
        params: {
            issuer_id: issuerId
        }
    }).then((r)=>r.data);
const createDecision = (body)=>api.post("/api/decisions", body).then((r)=>r.data);
const voteDecision = (id, vote, dissentNote)=>api.post(`/api/decisions/${id}/votes`, {
        vote,
        dissent_note: dissentNote
    }).then((r)=>r.data);
const reopenDecision = (id, triggerAlertKey)=>api.post(`/api/decisions/${id}/reopen`, {
        trigger_alert_key: triggerAlertKey
    }).then((r)=>r.data);
const getThesisVersions = (issuerId)=>api.get("/api/thesis", {
        params: {
            issuer_id: issuerId
        }
    }).then((r)=>r.data);
const createThesisVersion = (body)=>api.post("/api/thesis", body).then((r)=>r.data);
const realizeThesisPrediction = (id, realized)=>api.patch(`/api/thesis/predictions/${id}`, {
        realized
    }).then((r)=>r.data);
const edgarVaultUrl = (issuerId, exhibitUrl, runMode = "legal")=>api.post("/api/edgar/vault-url", {
        issuer_id: issuerId,
        exhibit_url: exhibitUrl,
        run_mode: runMode
    }).then((r)=>r.data);
const edgarVaultUrls = async (issuerId, urls, runMode = "legal")=>{
    const list = urls.split(",").map((u)=>u.trim()).filter(Boolean);
    if (!list.length) return {
        ok: [],
        failed: []
    };
    const settled = await Promise.allSettled(list.map((u)=>edgarVaultUrl(issuerId, u, runMode)));
    const ok = settled.flatMap((s)=>s.status === "fulfilled" ? [
            s.value
        ] : []);
    // Throw only when every URL failed, so an all-fail 503 (not-configured) still
    // reaches the caller's catch instead of one bad URL sinking the whole batch.
    if (!ok.length) {
        const firstErr = settled.find((s)=>s.status === "rejected");
        throw firstErr ? firstErr.reason : new Error("EDGAR URL vaulting failed.");
    }
    const failed = settled.flatMap((s, i)=>s.status === "rejected" ? [
            {
                url: list[i],
                reason: toErrorMessage(s.reason, "vaulting failed")
            }
        ] : []);
    return {
        ok,
        failed
    };
};
// Durable Deep Research (M-3): POST persists a job and returns its id immediately,
// then we poll until terminal. Execution lives server-side and is independent of
// this loop, so a transient poll failure (a proxy 502/504, a slow GET, a network
// blip) must NOT abort the run — we tolerate consecutive transport errors and keep
// polling; only a server-reported `failed` ends it. A wall-clock cap stops the UI
// from spinning forever if a job ever wedges. Resolves with the report (or throws
// an axios-shaped error) to keep the caller's contract unchanged.
const _RESEARCH_POLL_MS = 2000;
const _RESEARCH_DEADLINE_MS = 15 * 60 * 1000; // generous backstop; deep research runs minutes
const _RESEARCH_MAX_POLL_ERRORS = 10; // ~20s of consecutive transport failures → give up
const _detail = (detail)=>({
        response: {
            data: {
                detail
            }
        }
    });
const RESEARCH_ABORTED = Symbol("research-aborted");
const _aborted = ()=>({
        [RESEARCH_ABORTED]: true
    });
const isResearchAborted = (e)=>typeof e === "object" && e !== null && e[RESEARCH_ABORTED] === true;
const RESEARCH_GONE = Symbol("research-gone");
const _gone = ()=>({
        [RESEARCH_GONE]: true
    });
const isResearchGone = (e)=>typeof e === "object" && e !== null && e[RESEARCH_GONE] === true;
function throwIfResearchAborted(signal) {
    if (signal?.aborted) throw _aborted();
}
function nextResearchPollError(error, current) {
    if (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"].isAxiosError(error) && error.response?.status === 404) throw _gone();
    const next = current + 1;
    if (next >= _RESEARCH_MAX_POLL_ERRORS) {
        throw _detail("Lost contact with the research backend — the run may still be completing; retry shortly.");
    }
    return next;
}
function completedResearch(job) {
    return {
        report: job.report,
        sources: job.sources,
        demo: job.demo,
        truncated: job.truncated,
        figures: job.figures ?? []
    };
}
function terminalResearch(job) {
    if (job.status === "complete") return completedResearch(job);
    if (job.status === "failed") throw _detail(job.error || "Research failed — try again.");
    return null;
}
// Poll an already-created durable job to terminal. Shared by a fresh run and by
// resume-on-reload, so both paths tolerate transport blips identically. Honors an
// AbortSignal so an unmount / detach stops the loop without touching the job.
const _pollResearch = async (id, onProgress, signal)=>{
    const deadline = Date.now() + _RESEARCH_DEADLINE_MS;
    let pollErrors = 0;
    let first = true;
    while(Date.now() < deadline){
        throwIfResearchAborted(signal);
        if (!first) await new Promise((r)=>setTimeout(r, _RESEARCH_POLL_MS));
        first = false; // poll immediately first so a fast/demo completion isn't delayed
        throwIfResearchAborted(signal);
        let job;
        try {
            job = (await api.get(`/api/research/${id}`)).data;
            pollErrors = 0;
        } catch (e) {
            // 404 = the job genuinely doesn't exist (or isn't ours) — retrying can't
            // recover it, so signal "gone" immediately instead of burning the retry
            // budget. The reattach path treats this as a quiet reset.
            // Any other transport error — the durable job is unaffected; keep polling.
            // Bail only after many consecutive failures (the backend is likely down).
            pollErrors = nextResearchPollError(e, pollErrors);
            continue;
        }
        const result = terminalResearch(job);
        if (result) return result;
        onProgress?.(job.progress ?? null); // still running — surface live counts
    }
    throw _detail("Research timed out on the client — it may still be completing; retry shortly.");
};
const deepResearch = async (brief, onProgress, onJobId, signal, contextId)=>{
    const { id } = (await api.post("/api/research", brief, {
        params: contextId ? {
            context_id: contextId
        } : undefined
    })).data;
    onJobId?.(id); // persist before the (multi-minute) poll, so a reload can reattach
    return _pollResearch(id, onProgress, signal);
};
const resumeResearch = (id, onProgress, signal)=>_pollResearch(id, onProgress, signal);
const getResearchStatus = async (id)=>{
    let job;
    try {
        job = (await api.get(`/api/research/${id}`)).data;
    } catch (e) {
        // Mirror _pollResearch: only an actual 404 means the job is genuinely gone
        // (server restart lost it, or a foreign id). Any other failure (network
        // blip, 5xx, timeout) is NOT the same as "gone" — misreporting a transient
        // failure as permanently deleted would be a real correctness bug, so
        // rethrow and let the caller treat it as an unknown/transient error.
        if (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"].isAxiosError(e) && e.response?.status === 404) return {
            state: "gone"
        };
        throw e;
    }
    if (job.status === "complete") return {
        state: "complete",
        result: {
            report: job.report,
            sources: job.sources,
            demo: job.demo,
            truncated: job.truncated,
            figures: job.figures ?? []
        }
    };
    if (job.status === "failed") return {
        state: "failed",
        error: job.error || "Research failed — try again."
    };
    return {
        state: "running"
    };
};
const getSettings = ()=>api.get("/api/settings").then((r)=>r.data);
const getAnalystSettings = ()=>api.get("/api/settings/analyst").then((r)=>r.data);
const saveAnalystSettings = (data)=>api.put("/api/settings/analyst", data).then((r)=>r.data);
const patchAnalystSettings = (expectedRevision, patch)=>api.patch("/api/settings/analyst", {
        expected_revision: expectedRevision,
        ...patch
    }).then((r)=>r.data);
const updateAnalystWorkspace = async (patch)=>{
    let current = await getAnalystSettings();
    try {
        return await patchAnalystSettings(current.revision ?? 0, {
            workspace: patch(current.workspace || {})
        });
    } catch (reason) {
        const detail = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"].isAxiosError(reason) && reason.response?.status === 409 ? reason.response.data?.detail : undefined;
        if (!detail?.current) throw reason;
        current = detail.current;
        return patchAnalystSettings(current.revision ?? 0, {
            workspace: patch(current.workspace || {})
        });
    }
};
const getSavedModel = (issuerId)=>api.get(`/api/models/${issuerId}`).then((r)=>r.data);
const saveModel = (issuerId, payload, expectedUpdatedAt)=>api.put(`/api/models/${issuerId}`, {
        payload,
        expected_updated_at: expectedUpdatedAt ?? undefined
    }).then((r)=>r.data);
const getModelCheckpoints = (issuerId)=>api.get(`/api/models/${issuerId}/checkpoints`).then((r)=>r.data);
const createModelCheckpoint = (issuerId, body)=>api.post(`/api/models/${issuerId}/checkpoints`, body).then((r)=>r.data);
const restoreModelCheckpoint = (checkpointId, expectedUpdatedAt)=>api.post(`/api/models/checkpoints/${checkpointId}/restore`, {
        expected_updated_at: expectedUpdatedAt ?? undefined
    }).then((r)=>r.data);
const modelV2Path = (issuerId)=>`/api/models/v2/${encodeURIComponent(issuerId)}`;
const getModelV2 = (issuerId, exactRunId, signal)=>api.get(modelV2Path(issuerId), {
        params: exactRunId ? {
            run_id: exactRunId
        } : undefined,
        signal
    }).then((r)=>r.data);
const calculateModelV2 = (issuerId, body, signal)=>api.post(`${modelV2Path(issuerId)}/calculate`, body, {
        signal
    }).then((r)=>r.data);
const saveModelV2 = (issuerId, body)=>api.put(modelV2Path(issuerId), body).then((r)=>r.data);
const getModelV2History = (issuerId, signal)=>api.get(`${modelV2Path(issuerId)}/history`, {
        signal
    }).then((r)=>r.data);
const mutateModelV2Override = (issuerId, body)=>api.post(`${modelV2Path(issuerId)}/overrides`, body).then((r)=>r.data);
const mutateModelV2OverridesBatch = (issuerId, body)=>api.post(`${modelV2Path(issuerId)}/overrides/batch`, body).then((r)=>r.data);
const replayModelV2Override = (issuerId, eventId, body)=>api.post(`${modelV2Path(issuerId)}/history/${encodeURIComponent(eventId)}/replay`, body).then((r)=>r.data);
const getModelV2Checkpoints = (issuerId, signal)=>api.get(`${modelV2Path(issuerId)}/checkpoints`, {
        signal
    }).then((r)=>r.data);
const createModelV2Checkpoint = (issuerId, body)=>api.post(`${modelV2Path(issuerId)}/checkpoints`, body).then((r)=>r.data);
const restoreModelV2Checkpoint = (issuerId, checkpointId, body)=>api.post(`${modelV2Path(issuerId)}/checkpoints/${encodeURIComponent(checkpointId)}/restore`, body).then((r)=>r.data);
const exportModelV2Workbook = (issuerId)=>api.get(`${modelV2Path(issuerId)}/workbook/export`, {
        responseType: "blob"
    }).then((response)=>{
        const disposition = String(response.headers["content-disposition"] ?? "");
        const revisionHeader = response.headers["x-caos-model-revision"];
        const parsedRevision = Number(revisionHeader);
        return {
            blob: response.data,
            filename: disposition.match(/filename="([^"]+)"/)?.[1] ?? `caos-model-${issuerId}.xlsx`,
            revision: Number.isInteger(parsedRevision) && parsedRevision >= 0 ? parsedRevision : null
        };
    });
const previewModelV2Workbook = (body)=>{
    const form = new FormData();
    form.append("file", body.file);
    form.append("mapping", body.mapping ? JSON.stringify(body.mapping) : "");
    form.append("expected_revision", String(body.expectedRevision));
    return api.post(`${modelV2Path(body.issuerId)}/workbook/import/preview`, form).then((response)=>response.data);
};
const commitModelV2Workbook = (body)=>{
    const form = new FormData();
    form.append("file", body.file);
    form.append("mapping", body.mapping ? JSON.stringify(body.mapping) : "");
    form.append("expected_revision", String(body.preview.expected_revision));
    form.append("preview_sha256", body.preview.workbook_sha256);
    form.append("preview_token", body.preview.preview_token ?? "");
    return api.post(`${modelV2Path(body.issuerId)}/workbook/import/commit`, form).then((response)=>response.data);
};
const getReportDraft = (contextId)=>api.get(`/api/reports/drafts/${contextId}`).then((r)=>r.data);
const saveReportDraft = (contextId, payload, expectedRevision)=>api.put(`/api/reports/drafts/${contextId}`, {
        payload,
        expected_revision: expectedRevision
    }).then((r)=>r.data);
const listReportVersions = (contextId)=>api.get("/api/reports/versions", {
        params: {
            context_id: contextId
        }
    }).then((r)=>r.data.map((version)=>({
                ...version,
                payload: {}
            })));
const getReportVersion = (versionId)=>api.get(`/api/reports/versions/${encodeURIComponent(versionId)}`).then((r)=>r.data);
const previewReportVersion = (body)=>api.post("/api/reports/versions/preview", body).then((r)=>r.data);
const publishReportVersion = (body)=>api.post("/api/reports/versions", body).then((r)=>r.data);
const exportReportVersionBinary = (versionId, format)=>api.post(`/api/reports/versions/${versionId}/export`, null, {
        params: {
            format
        },
        responseType: "blob"
    }).then((response)=>{
        const disposition = String(response.headers["content-disposition"] ?? "");
        const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `caos-report-${versionId}.${format}`;
        return {
            blob: response.data,
            filename
        };
    });
const getAutonomyDraft = (refresh = false)=>(refresh ? api.post("/api/autonomy/draft", undefined, {
        headers: {
            "X-CAOS-Action": "autonomy-refresh"
        }
    }) : api.get("/api/autonomy/draft")).then((r)=>r.data);
const setAlertState = (alertKey, state, opts)=>api.post("/api/alerts/state", {
        alert_key: alertKey,
        state,
        assignee: opts?.assignee,
        note: opts?.note,
        resolution_note: opts?.resolutionNote
    }).then((r)=>r.data);
const getAlertStates = (alertKey)=>api.get("/api/alerts/state", {
        params: alertKey ? {
            alert_key: alertKey
        } : {}
    }).then((r)=>r.data);
const refreshAlertEvents = ()=>api.post("/api/alerts/refresh").then((r)=>r.data);
const getAlertEvents = (state)=>api.get("/api/alerts/events", {
        params: state ? {
            state
        } : {}
    }).then((r)=>r.data);
const patchAlertEvent = (id, state, opts)=>api.patch(`/api/alerts/events/${id}`, {
        state,
        assignee: opts?.assignee,
        note: opts?.note,
        resolution_note: opts?.resolutionNote
    }).then((r)=>r.data);
}),
"[project]/src/components/shared/AuthProvider.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthProvider",
    ()=>AuthProvider,
    "useAuth",
    ()=>useAuth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// Identity context. Network access is governed at the edge proxy; on top of that
// the analyst self-registers a named profile via the code-gated login (see
// LoginLanding). This provider resolves the active identity via /api/auth/me:
// `source === "profile"` means a profile is signed in; anything else (proxy SSO,
// local dev, or a 401) means the login landing should show. A network/API error
// is kept distinct so RequireAuth shows "can't reach API", not the login form.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
const AuthContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])({
    user: null,
    principalGeneration: 0,
    loading: true,
    error: false,
    needsLogin: false,
    refresh: async ()=>{}
});
const LOGIN_BYPASS_USER = {
    id: "local-dev",
    email: "analyst@local.dev",
    full_name: "Local Analyst",
    role: "analyst",
    is_active: true,
    source: "local"
};
function loginBypassEnabled() {
    // ponytail: temporary local-preview bypass; remove when login testing resumes.
    return ("TURBOPACK compile-time value", "development") === "development" || ("TURBOPACK compile-time value", "development") !== "production" && process.env.NEXT_PUBLIC_CAOS_DISABLE_LOGIN === "1";
}
function useAuth() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(AuthContext);
}
function AuthProvider({ children }) {
    const [user, setUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [needsLogin, setNeedsLogin] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [principalGeneration, setPrincipalGeneration] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const refreshGeneration = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(0);
    const userRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    userRef.current = user;
    // fallow-ignore-next-line complexity -- Principal revalidation and workspace clearing must remain one atomic callback.
    const refresh = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(async (workspaceAlreadyCleared = false)=>{
        const generation = ++refreshGeneration.current;
        if (loginBypassEnabled()) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["bindWorkspacePrincipal"])(LOGIN_BYPASS_USER.id);
            if (generation !== refreshGeneration.current) return;
            setUser(LOGIN_BYPASS_USER);
            setError(false);
            setNeedsLogin(false);
            setLoading(false);
            return;
        }
        //TURBOPACK unreachable
        ;
    }, []);
    const invalidateAndRefresh = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((clearImmediately = true)=>{
        // Nothing authenticated is mounted yet (e.g. still on the login form, or
        // still loading) — there is no prior principal's state to tear down, so
        // skip the destructive remount below and just quietly re-check. Doing the
        // full reset here would flip the Fragment key (needs-login -> anonymous
        // -> needs-login) on every visibilitychange/storage event and wipe
        // LoginLanding's in-progress form fields and any just-set submit error.
        if (!userRef.current) {
            void refresh(clearImmediately);
            return;
        }
        // A 401 or a cross-tab principal-marker change is already evidence that
        // the mounted workspace belongs to a principal that is no longer current.
        // Tear it down synchronously; waiting for the /me round-trip would leave
        // the prior analyst's request-scoped React state visible and interactive.
        ++refreshGeneration.current;
        userRef.current = null;
        if (clearImmediately) (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clearWorkspaceStorage"])();
        setUser(null);
        setLoading(true);
        setError(false);
        setNeedsLogin(false);
        setPrincipalGeneration((value)=>value + 1);
        void refresh(clearImmediately);
    }, [
        refresh
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        refresh();
    }, [
        refresh
    ]);
    // SEAM4-1: identity is resolved once at mount, so a session lost mid-session is
    // otherwise invisible. Re-resolve when (a) any request reports a 401 — the
    // api.ts interceptor fires `caos:auth-lost`, covering the off-proxy cookie-loss
    // 401 storm that had no re-login route; and (b) the tab regains focus — which
    // catches the silent SSO principal swap where get_identity falls through from a
    // revoked profile cookie to the proxy identity (200s keep flowing under a
    // different id, so only a re-check of /me surfaces it).
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const onLost = ()=>{
            invalidateAndRefresh();
        };
        const onVisible = ()=>{
            // Visibility is the only signal for a same-tab silent SSO swap. Suspend
            // the old principal immediately, but retain its caches until /me proves a
            // different principal (bindWorkspacePrincipal) or a 401 (refresh catch).
            if (document.visibilityState === "visible") invalidateAndRefresh(false);
        };
        const onStorage = (event)=>{
            if (event.key !== __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["PRINCIPAL_STORAGE_KEY"]) return;
            if (event.newValue === userRef.current?.id) return;
            invalidateAndRefresh();
        };
        window.addEventListener("caos:auth-lost", onLost);
        window.addEventListener("storage", onStorage);
        document.addEventListener("visibilitychange", onVisible);
        return ()=>{
            window.removeEventListener("caos:auth-lost", onLost);
            window.removeEventListener("storage", onStorage);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [
        invalidateAndRefresh
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AuthContext.Provider, {
        value: {
            user,
            principalGeneration,
            loading,
            error,
            needsLogin,
            refresh
        },
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
            children: children
        }, user?.id ?? (needsLogin ? "needs-login" : "anonymous"), false, {
            fileName: "[project]/src/components/shared/AuthProvider.tsx",
            lineNumber: 173,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/AuthProvider.tsx",
        lineNumber: 172,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/components/shared/RoleViewProvider.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RoleViewProvider",
    ()=>RoleViewProvider,
    "useRoleView",
    ()=>useRoleView
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// Role views (Analyst / PM / QA) — a PRESENTATION preference, never
// authorization. Nothing here reads or writes auth state; the server field it
// persists to (AnalystSettings.role_view) is a rendering hint the backend
// never branches on (RT-2026-07-11-61).
//
// Persistence contract: PUT /api/settings/analyst REPLACES the whole settings
// blob, so every save here is a read-modify-write over the latest known blob —
// never a role-only body (it would wipe model_lanes / email_intelligence).
// localStorage gives instant paint before the GET reconciles, and remains the
// only store when the PUT 404s (local-dev bypass identity has no Analyst row).
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/axios/lib/axios.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
const LS_KEY = "caos_role_view";
const ROLE_VIEWS = [
    "analyst",
    "pm",
    "qa"
];
// Debounce trailing-edge saves so rapid toggling costs one PUT, staying polite
// under the settings route's 30-writes/min limit.
const SAVE_DEBOUNCE_MS = 800;
function coerce(v) {
    return ROLE_VIEWS.includes(v) ? v : null;
}
const RoleViewContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])({
    roleView: "analyst",
    setRoleView: ()=>{},
    ready: false
});
function useRoleView() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(RoleViewContext);
}
function RoleViewProvider({ children }) {
    const [roleView, setRoleViewState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("analyst");
    const [ready, setReady] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    // Latest server blob, so the debounced save spreads the real sibling maps
    // instead of clobbering them.
    const blobRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const timerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Server unreachable-for-this-identity (404) — keep localStorage-only.
    const localOnlyRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(false);
    // Instant paint from localStorage, then reconcile from the server once.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const cached = coerce(("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : null);
        if (cached) setRoleViewState(cached);
        let cancelled = false;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getAnalystSettings"])().then((s)=>{
            if (cancelled) return;
            blobRef.current = s;
            const server = coerce(s.role_view);
            // The server value wins over the cache UNLESS the user already toggled
            // this session (a pending save exists) — then the local choice wins.
            if (server && !timerRef.current) {
                setRoleViewState(server);
                window.localStorage.setItem(LS_KEY, server);
            }
        }).catch(()=>{
        // Offline / unauthenticated: localStorage value already applied.
        }).finally(()=>{
            if (!cancelled) setReady(true);
        });
        return ()=>{
            cancelled = true;
        };
    }, []);
    const setRoleView = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((v)=>{
        setRoleViewState(v);
        try {
            window.localStorage.setItem(LS_KEY, v);
        } catch  {
        /* private-mode storage failure — in-memory state still applies */ }
        if (localOnlyRef.current) return;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(async ()=>{
            timerRef.current = null;
            try {
                // Read-modify-write: refresh the blob if we never loaded one, then PUT
                // the WHOLE object with only role_view changed.
                const base = blobRef.current ?? await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getAnalystSettings"])();
                const next = {
                    ...base,
                    role_view: v
                };
                blobRef.current = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["saveAnalystSettings"])(next);
            } catch (err) {
                if (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"].isAxiosError(err) && err.response?.status === 404) {
                    // No analyst profile row (local-dev bypass) — localStorage carries it.
                    localOnlyRef.current = true;
                    return;
                }
            // 429/5xx: optimistic UI + localStorage stand; next toggle retries.
            }
        }, SAVE_DEBOUNCE_MS);
    }, []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>()=>{
            if (timerRef.current) clearTimeout(timerRef.current);
        }, []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(RoleViewContext.Provider, {
        value: {
            roleView,
            setRoleView,
            ready
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/shared/RoleViewProvider.tsx",
        lineNumber: 117,
        columnNumber: 5
    }, this);
}
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[project]/src/lib/nav.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Single source of truth for concept navigation: the workflow groups rendered
// by ConceptNav and the Alt+←/→ cycle order consumed by ConceptHotkeys.
// Cycle order = visual order, always — the two drifted before this file
// existed (ConceptHotkeys kept its own list that omitted /issuers and /upload
// and disagreed with ConceptNav's order).
__turbopack_context__.s([
    "CONCEPT_CYCLE",
    ()=>CONCEPT_CYCLE,
    "NAV_GROUPS",
    ()=>NAV_GROUPS,
    "activeGroupId",
    ()=>activeGroupId,
    "routeMatches",
    ()=>routeMatches
]);
const NAV_GROUPS = [
    {
        id: "intake",
        label: "Intake",
        items: [
            {
                href: "/issuers",
                icon: "directory",
                label: "Directory"
            },
            {
                href: "/upload",
                icon: "upload",
                label: "Upload"
            }
        ]
    },
    {
        id: "analyze",
        label: "Analyze",
        items: [
            {
                href: "/research",
                icon: "research",
                label: "Research"
            },
            {
                href: "/query",
                icon: "query",
                label: "Query"
            },
            {
                href: "/sector",
                icon: "sector",
                label: "Sector Review"
            },
            {
                href: "/sector-rv",
                icon: "sector-rv",
                label: "RV Screener"
            },
            {
                href: "/sponsors",
                icon: "sponsors",
                label: "Sponsors"
            }
        ]
    },
    {
        id: "decide",
        label: "Decide",
        items: [
            {
                href: "/command",
                icon: "command",
                label: "Command Center"
            },
            {
                href: "/portfolios",
                icon: "portfolio",
                label: "Portfolio Lab"
            },
            {
                href: "/deepdive",
                icon: "deepdive",
                label: "Deep-Dive"
            },
            {
                href: "/model",
                icon: "model",
                label: "Model Builder"
            },
            {
                href: "/decisions",
                icon: "decisions",
                label: "IC Book"
            }
        ]
    },
    {
        id: "publish",
        label: "Publish",
        items: [
            {
                href: "/reports",
                icon: "report",
                label: "Report Studio"
            }
        ]
    },
    {
        id: "monitor",
        label: "Monitor",
        items: [
            {
                href: "/pipeline",
                icon: "pipeline",
                label: "Pipeline"
            },
            {
                href: "/monitor",
                icon: "monitor",
                label: "Alert Monitor"
            }
        ]
    }
];
const CONCEPT_CYCLE = NAV_GROUPS.flatMap((g)=>g.items.map((i)=>i.href));
function routeMatches(pathname, href) {
    return pathname === href || pathname.startsWith(href + "/");
}
function activeGroupId(pathname) {
    for (const g of NAV_GROUPS){
        if (g.items.some((i)=>routeMatches(pathname, i.href))) return g.id;
    }
    return null;
}
}),
"[project]/src/components/shared/ModalBackdrop.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ModalBackdrop",
    ()=>ModalBackdrop
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
// Canonical dim tint for all z-modal backdrops (matches --caos-bg, not pure black).
const BACKDROP_COLOR = "rgba(5,5,7,0.72)";
function ModalBackdrop({ onClose, align = "center", padded = false, className = "", children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-modal flex " + (align === "end" ? "justify-end" : align === "top" ? "items-start justify-center pt-[12vh]" : "items-center justify-center") + (padded ? " p-6" : "") + (className ? " " + className : ""),
        style: {
            background: BACKDROP_COLOR
        },
        onClick: onClose,
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/shared/ModalBackdrop.tsx",
        lineNumber: 20,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/lib/use-modal-a11y.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "hasOpenModalA11yOverlay",
    ()=>hasOpenModalA11yOverlay,
    "useModalA11y",
    ()=>useModalA11y
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
;
// Body scroll-lock is refcounted across all open overlays, not saved/restored
// per-modal. Two reasons: (1) a per-modal save-string desyncs when overlay
// lifecycles interleave (open B while A is open, close A first) — A's unmount
// would unlock while B is still open, or leave a stuck `overflow:hidden` with no
// dialog on screen; (2) capturing a "previous" value is a trap here — this hook
// is the ONLY writer of body overflow in the app, so the previous value is
// always "". Once a buggy restore left "hidden" behind, every later modal
// captured and re-restored "hidden" forever. So: lock on first open, and on the
// last close clear the inline style outright rather than restore a captured one.
// ponytail: module-global counter — fine for one window; a portal/iframe multi-
// document app would need per-document state.
let scrollLockCount = 0;
// Shared topmost-overlay registry. Every useModalA11y instance registers a
// window-level keydown listener, and stopPropagation() on a window listener
// does not stop OTHER listeners on the same target — it only stops
// propagation to ANCESTOR nodes, which doesn't exist for window listeners.
// Without this, one Escape press fired every currently-mounted overlay's
// onClose at once (e.g. a citation viewer opened inside the Ask modal: Esc
// meant to dismiss just the citation closed the whole Ask stack instead,
// losing the in-progress query/graph/reader state). Each instance pushes a
// token on mount, pops it on unmount, and only the topmost (most recently
// opened) instance's Escape handler actually calls onClose.
const overlayStack = [];
function isTopOverlay(token) {
    return overlayStack[overlayStack.length - 1] === token;
}
function hasOpenModalA11yOverlay() {
    return overlayStack.length > 0;
}
function useModalA11y(onClose) {
    const ref = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Keep the latest onClose in a ref so the setup effect runs exactly once (on
    // mount) yet always calls the current handler. Callers pass inline arrows, and
    // timer-driven parents (e.g. the Command Center sim clock) re-render while a
    // modal is open — depending on [onClose] would re-run the whole effect each
    // tick, re-stealing focus and thrashing the scroll-lock.
    const onCloseRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(onClose);
    onCloseRef.current = onClose;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const panel = ref.current;
        // A consumer that calls this hook unconditionally but renders `null` while
        // closed (e.g. a globally-mounted overlay) must not engage the lock/trap —
        // otherwise it pins body scroll-lock the whole time it sits closed. No panel
        // on screen ⇒ no modal ⇒ no side effects.
        if (!panel) return;
        const prevFocus = document.activeElement;
        const token = Symbol("modal-a11y-overlay");
        overlayStack.push(token);
        if (scrollLockCount === 0) document.body.style.overflow = "hidden";
        scrollLockCount++;
        if (!panel.hasAttribute("tabindex")) panel.tabIndex = -1;
        const focusables = ()=>Array.from(panel.querySelectorAll('a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter((el)=>el.offsetParent !== null);
        // Prefer the first form field (a form modal should land on its first input,
        // not the close button); else the first focusable; else the panel itself.
        const initial = focusables();
        const firstField = initial.find((el)=>/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
        (firstField ?? initial[0] ?? panel)?.focus?.();
        const onKey = (e)=>{
            if (e.key === "Escape") {
                e.stopPropagation();
                // Not topmost — a nested overlay (e.g. a citation viewer opened over
                // this dialog) owns this Escape; its own handler will fire the same
                // event, since window listeners aren't stopped by stopPropagation.
                if (!isTopOverlay(token)) return;
                onCloseRef.current();
                return;
            }
            if (e.key !== "Tab") return;
            const els = focusables();
            if (els.length === 0) {
                e.preventDefault();
                panel.focus();
                return;
            }
            const first = els[0];
            const last = els[els.length - 1];
            const active = document.activeElement;
            // Recapture: if focus has escaped the panel (e.g. the control that had
            // focus re-rendered `disabled` and dropped focus to <body>), the next Tab
            // pulls it back in rather than walking the page behind the modal.
            if (!active || !panel.contains(active)) {
                e.preventDefault();
                first.focus();
            } else if (e.shiftKey && (active === first || active === panel)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };
        window.addEventListener("keydown", onKey);
        return ()=>{
            window.removeEventListener("keydown", onKey);
            const i = overlayStack.indexOf(token);
            if (i !== -1) overlayStack.splice(i, 1);
            scrollLockCount = Math.max(0, scrollLockCount - 1);
            if (scrollLockCount === 0) document.body.style.overflow = "";
            prevFocus?.focus?.();
        };
    }, []);
    return ref;
}
}),
"[project]/src/components/shared/NavigationGuardProvider.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "NavigationGuardProvider",
    ()=>NavigationGuardProvider,
    "useNavigationAttempt",
    ()=>useNavigationAttempt,
    "useNavigationGuard",
    ()=>useNavigationGuard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ModalBackdrop.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/use-modal-a11y.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
const NavigationGuardContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])(null);
const HISTORY_INDEX_KEY = "__caosNavigationGuardIndex";
function historyIndex(state) {
    if (!state || typeof state !== "object") return null;
    const value = state[HISTORY_INDEX_KEY];
    return typeof value === "number" && Number.isInteger(value) ? value : null;
}
function withHistoryIndex(state, index) {
    return state && typeof state === "object" && !Array.isArray(state) ? {
        ...state,
        [HISTORY_INDEX_KEY]: index
    } : {
        [HISTORY_INDEX_KEY]: index
    };
}
const guardedAnchorUrl = (event, hasActiveGuards)=>{
    if (!hasActiveGuards || event.defaultPrevented || event.button !== 0) return null;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!anchor || anchor.hasAttribute("download")) return null;
    if (anchor.target && anchor.target.toLowerCase() !== "_self") return null;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return url.pathname === window.location.pathname && url.search === window.location.search ? null : url;
};
const useBeforeUnloadGuard = (activeGuardCount)=>{
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (activeGuardCount === 0) return;
        const onBeforeUnload = (event)=>{
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return ()=>window.removeEventListener("beforeunload", onBeforeUnload);
    }, [
        activeGuardCount
    ]);
};
const useAnchorNavigationGuard = (activeGuards, queueAttempt, router)=>{
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const onClick = (event)=>{
            const url = guardedAnchorUrl(event, activeGuards().length > 0);
            if (!url) return;
            event.preventDefault();
            event.stopPropagation();
            queueAttempt(()=>router.push(`${url.pathname}${url.search}${url.hash}`));
        };
        document.addEventListener("click", onClick, true);
        return ()=>document.removeEventListener("click", onClick, true);
    }, [
        activeGuards,
        queueAttempt,
        router
    ]);
};
const useHistoryNavigationGuard = (activeGuards, pendingRef, setPending)=>{
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const history = window.history;
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        const originalIndex = historyIndex(history.state) ?? 0;
        const currentIndex = {
            value: originalIndex
        };
        originalReplaceState.call(history, withHistoryIndex(history.state, originalIndex), "", window.location.href);
        const wrappedPushState = (data, unused, url)=>{
            const next = currentIndex.value + 1;
            currentIndex.value = next;
            return originalPushState.call(history, withHistoryIndex(data, next), unused, url);
        };
        const wrappedReplaceState = (data, unused, url)=>originalReplaceState.call(history, withHistoryIndex(data, currentIndex.value), unused, url);
        history.pushState = wrappedPushState;
        history.replaceState = wrappedReplaceState;
        let allowNextPop = false;
        let bounce = null;
        const onPopState = (event)=>{
            const destination = historyIndex(event.state);
            if (allowNextPop) {
                allowNextPop = false;
                if (destination != null) currentIndex.value = destination;
                return;
            }
            if (bounce) {
                const resumed = bounce;
                bounce = null;
                currentIndex.value = resumed.origin;
                if (!pendingRef.current) {
                    const request = {
                        guards: resumed.guards,
                        proceed: ()=>{
                            allowNextPop = true;
                            history.go(resumed.delta);
                        }
                    };
                    pendingRef.current = request;
                    setPending(request);
                }
                return;
            }
            const delta = destination == null ? -1 : destination - currentIndex.value;
            if (delta === 0) return;
            const guards = activeGuards();
            if (guards.length === 0) {
                if (destination != null) currentIndex.value = destination;
                return;
            }
            bounce = {
                origin: currentIndex.value,
                delta,
                guards
            };
            history.go(-delta);
        };
        window.addEventListener("popstate", onPopState);
        return ()=>{
            window.removeEventListener("popstate", onPopState);
            if (history.pushState === wrappedPushState) history.pushState = originalPushState;
            if (history.replaceState === wrappedReplaceState) history.replaceState = originalReplaceState;
        };
    }, [
        activeGuards,
        pendingRef,
        setPending
    ]);
};
const useGuardRegistrations = ()=>{
    const registrations = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(new Map());
    const [activeGuardCount, setActiveGuardCount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const activeGuards = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>Array.from(registrations.current.values()).filter((guard)=>guard.enabled && guard.dirty), []);
    const syncActiveCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>setActiveGuardCount(activeGuards().length), [
        activeGuards
    ]);
    const registerGuard = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((id, registration)=>{
        registrations.current.set(id, registration);
        syncActiveCount();
        return ()=>{
            if (registrations.current.get(id) === registration) registrations.current.delete(id);
            syncActiveCount();
        };
    }, [
        syncActiveCount
    ]);
    return {
        activeGuards,
        activeGuardCount,
        registerGuard
    };
};
const usePendingNavigation = (activeGuards)=>{
    const pendingRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [pending, setPending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const queueAttempt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((proceed)=>{
        const guards = activeGuards();
        if (guards.length === 0) {
            proceed();
            return true;
        }
        if (pendingRef.current) return false;
        const request = {
            proceed,
            guards
        };
        pendingRef.current = request;
        setPending(request);
        return false;
    }, [
        activeGuards
    ]);
    const stay = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        pendingRef.current = null;
        setPending(null);
    }, []);
    const discardAndLeave = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        // NavigationGuardFrame only exposes this callback while `pending` exists.
        const request = pendingRef.current;
        pendingRef.current = null;
        setPending(null);
        request.guards.forEach((guard)=>{
            try {
                guard.onDiscard();
            } catch  {}
        });
        request.proceed();
    }, []);
    return {
        pendingRef,
        pending,
        setPending,
        queueAttempt,
        stay,
        discardAndLeave
    };
};
function NavigationGuardFrame({ value, children, pending, onStay, onDiscard }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(NavigationGuardContext.Provider, {
        value: value,
        children: [
            children,
            pending ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(NavigationConfirmDialog, {
                onStay: onStay,
                onDiscard: onDiscard
            }, void 0, false, {
                fileName: "[project]/src/components/shared/NavigationGuardProvider.tsx",
                lineNumber: 222,
                columnNumber: 18
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/NavigationGuardProvider.tsx",
        lineNumber: 220,
        columnNumber: 5
    }, this);
}
function NavigationGuardProvider({ children }) {
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const { activeGuards, activeGuardCount, registerGuard } = useGuardRegistrations();
    const { pendingRef, pending, setPending, queueAttempt, stay, discardAndLeave } = usePendingNavigation(activeGuards);
    useBeforeUnloadGuard(activeGuardCount);
    useAnchorNavigationGuard(activeGuards, queueAttempt, router);
    useHistoryNavigationGuard(activeGuards, pendingRef, setPending);
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>({
            registerGuard,
            attemptNavigation: queueAttempt
        }), [
        queueAttempt,
        registerGuard
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(NavigationGuardFrame, {
        value: value,
        pending: pending,
        onStay: stay,
        onDiscard: discardAndLeave,
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/shared/NavigationGuardProvider.tsx",
        lineNumber: 245,
        columnNumber: 10
    }, this);
}
function useNavigationGuard({ dirty, enabled, onDiscard }) {
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(NavigationGuardContext);
    if (!context) throw new Error("useNavigationGuard must be used inside NavigationGuardProvider");
    const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(Symbol("navigation-guard"));
    const onDiscardRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(onDiscard);
    onDiscardRef.current = onDiscard;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>context.registerGuard(id.current, {
            dirty,
            enabled,
            onDiscard: ()=>onDiscardRef.current()
        }), [
        context,
        dirty,
        enabled
    ]);
}
function useNavigationAttempt() {
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(NavigationGuardContext);
    if (!context) throw new Error("useNavigationAttempt must be used inside NavigationGuardProvider");
    return context.attemptNavigation;
}
function NavigationConfirmDialog({ onStay, onDiscard }) {
    const panelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useModalA11y"])(onStay);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ModalBackdrop"], {
        onClose: onStay,
        padded: true,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            ref: panelRef,
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "navigation-guard-title",
            "aria-describedby": "navigation-guard-description",
            onClick: (event)=>event.stopPropagation(),
            className: "w-full max-w-md rounded-md border border-caos-border bg-caos-panel p-4 shadow-2xl",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                    id: "navigation-guard-title",
                    className: "text-caos-lg font-semibold text-caos-text",
                    children: "Leave with unsaved changes?"
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/NavigationGuardProvider.tsx",
                    lineNumber: 282,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    id: "navigation-guard-description",
                    className: "mt-2 text-caos-sm leading-relaxed text-caos-muted",
                    children: "Your unsaved changes will be discarded. Nothing will be saved automatically."
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/NavigationGuardProvider.tsx",
                    lineNumber: 285,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mt-5 flex justify-end gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: onStay,
                            className: "caos-action-secondary focus-ring",
                            children: "Stay"
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/NavigationGuardProvider.tsx",
                            lineNumber: 289,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: onDiscard,
                            className: "caos-action-secondary focus-ring border-caos-critical text-caos-critical hover:bg-caos-critical hover:text-white",
                            children: "Discard & leave"
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/NavigationGuardProvider.tsx",
                            lineNumber: 292,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/shared/NavigationGuardProvider.tsx",
                    lineNumber: 288,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/shared/NavigationGuardProvider.tsx",
            lineNumber: 273,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/NavigationGuardProvider.tsx",
        lineNumber: 272,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/components/shared/ConceptHotkeys.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ConceptHotkeys",
    ()=>ConceptHotkeys
]);
// Global shortcuts: hold ALT and press ←/→ to cycle concepts; S opens the unified
// command palette; K opens Ask; C broadcasts collapse/open panes. Mounted once in the root
// layout. Inactive while typing in inputs/textareas/contenteditables.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/nav.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$NavigationGuardProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/NavigationGuardProvider.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
// Alt+←/→ stops come from the shared nav registry — cycle order is the visual
// nav order by construction (this file used to keep its own diverging list).
const CONCEPTS = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CONCEPT_CYCLE"];
const ALT_ACTION_EVENTS = {
    KeyS: "caos:command-palette-open",
    KeyC: "caos:collapse-toggle"
};
function isEditable(el) {
    const n = el;
    if (!n || !n.tagName) return false;
    return n.tagName === "INPUT" || n.tagName === "TEXTAREA" || n.tagName === "SELECT" || n.isContentEditable;
}
function openHelp(event) {
    if (event.key !== "?" || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    window.dispatchEvent(new Event("caos:help-open"));
}
function dispatchAltAction(event, path) {
    const eventName = ALT_ACTION_EVENTS[event.code];
    if (eventName) {
        event.preventDefault();
        window.dispatchEvent(new Event(eventName));
        return true;
    }
    if (event.code !== "KeyK") return false;
    event.preventDefault();
    window.dispatchEvent(new Event(path?.startsWith("/query") ? "caos:query-focus" : "caos:ask-toggle"));
    return true;
}
function subviewDirection(event) {
    if (event.key === "." || event.code === "Period") return 1;
    if (event.key === "," || event.code === "Comma") return -1;
    return null;
}
function dispatchSubviewCycle(event) {
    const direction = subviewDirection(event);
    if (direction === null) return false;
    event.preventDefault();
    window.dispatchEvent(new CustomEvent("caos:subview-cycle", {
        detail: {
            direction
        }
    }));
    return true;
}
function conceptDestination(key, path) {
    if (key !== "ArrowLeft" && key !== "ArrowRight") return null;
    const direction = key === "ArrowRight" ? 1 : -1;
    const current = CONCEPTS.findIndex((concept)=>path === concept || path?.startsWith(concept + "/"));
    const start = direction === 1 ? 0 : CONCEPTS.length - 1;
    const next = current === -1 ? start : (current + direction + CONCEPTS.length) % CONCEPTS.length;
    return CONCEPTS[next];
}
function handleHotkey(event, path, navigate) {
    if (isEditable(event.target)) return;
    if (!event.altKey) {
        openHelp(event);
        return;
    }
    if (dispatchAltAction(event, path) || dispatchSubviewCycle(event)) return;
    const destination = conceptDestination(event.key, path);
    if (!destination) return;
    event.preventDefault();
    navigate(destination);
}
function ConceptHotkeys() {
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const attemptNavigation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$NavigationGuardProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useNavigationAttempt"])();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["usePathname"])();
    const pathRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(pathname);
    pathRef.current = pathname;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const down = (e)=>{
            // Match letter chords on e.code: macOS Option resolves e.key to composed
            // characters (Alt+S → "ß", Alt+K → "˚", Alt+C → "ç").
            handleHotkey(e, pathRef.current, (destination)=>{
                attemptNavigation(()=>router.push(destination));
            });
        };
        window.addEventListener("keydown", down);
        return ()=>{
            window.removeEventListener("keydown", down);
        };
    }, [
        attemptNavigation,
        router
    ]);
    return null;
}
}),
"[project]/src/lib/shortcuts.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// The one registry of keyboard shortcuts. The help overlay renders exactly
// this list, so a binding documented here MUST exist in code — a help surface
// that lists a dead key costs more trust than no help surface at all.
// Global bindings live in ConceptHotkeys.tsx (Alt combos, "?") and
// CommandPalette.tsx (⌘K); route-scoped ones in their owning components.
// Scope discipline: an entry is global ONLY if a listener exists on every
// route (grep the event name before promoting one) — Alt+C and Alt+,/. were
// once listed global while only two surfaces listened, which the help card's
// own contract forbids.
__turbopack_context__.s([
    "SHORTCUTS",
    ()=>SHORTCUTS,
    "shortcutsFor",
    ()=>shortcutsFor
]);
const SHORTCUTS = [
    {
        keys: "⌘K / Ctrl+K · Alt + S",
        label: "Open the command palette"
    },
    {
        keys: "Alt + K",
        label: "Ask across coverage (focuses the composer on /query)"
    },
    {
        keys: "Alt + ← / →",
        label: "Cycle between concepts (Command, Monitor, Deep-Dive…)"
    },
    {
        keys: "?",
        label: "Open this shortcut reference"
    },
    {
        keys: "Alt + C",
        label: "Collapse / expand the workspace rails",
        routes: [
            "/deepdive",
            "/model"
        ],
        routeLabel: "Deep-Dive · Model"
    },
    {
        keys: "⌘M / Ctrl+M",
        label: "Find a module by code or name",
        routes: [
            "/deepdive",
            "/model"
        ],
        routeLabel: "Deep-Dive · Model"
    },
    {
        keys: "Alt + , / .",
        label: "Cycle sub-views within the surface",
        routes: [
            "/pipeline",
            "/deepdive"
        ],
        routeLabel: "Pipeline · Deep-Dive"
    },
    {
        keys: "+ / −",
        label: "Step the sheet zoom",
        routes: [
            "/reports"
        ],
        routeLabel: "Report Studio"
    },
    {
        keys: "F",
        label: "Fit the sheet to the preview width",
        routes: [
            "/reports"
        ],
        routeLabel: "Report Studio"
    },
    {
        keys: "1–9",
        label: "Jump to the nth deliverable",
        routes: [
            "/reports"
        ],
        routeLabel: "Report Studio"
    }
];
function shortcutsFor(pathname) {
    const global = SHORTCUTS.filter((entry)=>!entry.routes);
    const route = SHORTCUTS.filter((entry)=>entry.routes?.some((prefix)=>pathname.startsWith(prefix)));
    return {
        global,
        route
    };
}
}),
"[project]/src/components/shared/ShortcutHelp.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ShortcutHelp",
    ()=>ShortcutHelp
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// The "?" shortcut reference — a small desk card, not documentation. Opens on
// "?" (ConceptHotkeys) or the caos:help-open event; the list renders from the
// SHORTCUTS registry so it can never document a binding that doesn't exist.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/use-modal-a11y.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$shortcuts$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/shortcuts.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
function Row({ entry }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-baseline justify-between gap-4 border-b border-caos-border/40 py-1.5",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-caos-xs text-caos-text",
                children: entry.label
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ShortcutHelp.tsx",
                lineNumber: 15,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("kbd", {
                className: "tabular shrink-0 rounded-sm border border-caos-border bg-caos-elevated px-1.5 py-0.5 text-caos-2xs text-caos-muted",
                children: entry.keys
            }, void 0, false, {
                fileName: "[project]/src/components/shared/ShortcutHelp.tsx",
                lineNumber: 16,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/ShortcutHelp.tsx",
        lineNumber: 14,
        columnNumber: 5
    }, this);
}
function ShortcutHelp() {
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["usePathname"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        // One overlay at a time: join the shared caos:modal-open ownership protocol
        // (CommandPalette et al.) so invoking the palette while the reference is up
        // swaps dialogs instead of stacking them.
        const onOpen = ()=>{
            window.dispatchEvent(new CustomEvent("caos:modal-open", {
                detail: {
                    owner: "shortcut-help"
                }
            }));
            setOpen(true);
        };
        const onModalOpen = (event)=>{
            if (event.detail?.owner !== "shortcut-help") setOpen(false);
        };
        window.addEventListener("caos:help-open", onOpen);
        window.addEventListener("caos:modal-open", onModalOpen);
        return ()=>{
            window.removeEventListener("caos:help-open", onOpen);
            window.removeEventListener("caos:modal-open", onModalOpen);
        };
    }, []);
    if (!open) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ShortcutHelpDialog, {
        pathname: pathname ?? "/",
        onClose: ()=>setOpen(false)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/ShortcutHelp.tsx",
        lineNumber: 45,
        columnNumber: 10
    }, this);
}
function ShortcutHelpDialog({ pathname, onClose }) {
    const ref = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useModalA11y"])(onClose);
    const { global, route } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$shortcuts$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["shortcutsFor"])(pathname);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-50 grid place-items-center bg-black/50 p-4",
        onClick: onClose,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            ref: ref,
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "Keyboard shortcuts",
            onClick: (event)=>event.stopPropagation(),
            className: "w-full max-w-md rounded-md border border-caos-border bg-caos-panel p-4 shadow-xl",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            className: "tabular text-caos-xs font-semibold uppercase tracking-widest text-caos-text",
                            children: "Keyboard shortcuts"
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/ShortcutHelp.tsx",
                            lineNumber: 62,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: onClose,
                            className: "caos-action-secondary ml-auto focus-ring",
                            "aria-label": "Close shortcut reference",
                            children: "Close"
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/ShortcutHelp.tsx",
                            lineNumber: 63,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/shared/ShortcutHelp.tsx",
                    lineNumber: 61,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                    className: "mt-3 tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                    children: "Global"
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/ShortcutHelp.tsx",
                    lineNumber: 65,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mt-1",
                    children: global.map((entry)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                            entry: entry
                        }, entry.keys + entry.label, false, {
                            fileName: "[project]/src/components/shared/ShortcutHelp.tsx",
                            lineNumber: 66,
                            columnNumber: 54
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/ShortcutHelp.tsx",
                    lineNumber: 66,
                    columnNumber: 9
                }, this),
                route.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "mt-4 tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                            children: route.every((entry)=>entry.routeLabel === route[0].routeLabel) ? route[0].routeLabel ?? "This page" : "This page"
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/ShortcutHelp.tsx",
                            lineNumber: 72,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-1",
                            children: route.map((entry)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Row, {
                                    entry: entry
                                }, entry.keys + entry.label, false, {
                                    fileName: "[project]/src/components/shared/ShortcutHelp.tsx",
                                    lineNumber: 73,
                                    columnNumber: 57
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/ShortcutHelp.tsx",
                            lineNumber: 73,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true) : null,
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mt-3 text-caos-2xs leading-snug text-caos-muted",
                    children: "Press ? anywhere (outside an input) to reopen this reference."
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/ShortcutHelp.tsx",
                    lineNumber: 76,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/shared/ShortcutHelp.tsx",
            lineNumber: 53,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/ShortcutHelp.tsx",
        lineNumber: 52,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/components/shared/CloseButton.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Modal close control (✕) — the bordered-box dismiss button shared by every
// modal/dialog header. Centralizes the a11y (aria-label, focus-ring, type) that
// was hand-repeated across 8 modals. `size`: "sm" (w-6, default) or "md" (w-7).
__turbopack_context__.s([
    "CloseButton",
    ()=>CloseButton
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
function CloseButton({ onClick, label = "Close", title, size = "sm", className = "" }) {
    const dims = size === "md" ? "w-7 h-7 text-caos-xl" : "w-6 h-6 text-caos-lg";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        onClick: onClick,
        "aria-label": label,
        title: title,
        className: `${dims} rounded border border-caos-border flex items-center justify-center font-bold leading-none text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring ${className}`,
        children: "✕"
    }, void 0, false, {
        fileName: "[project]/src/components/shared/CloseButton.tsx",
        lineNumber: 20,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/components/shared/TextInput.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "INPUT_BASE",
    ()=>INPUT_BASE,
    "TextInput",
    ()=>TextInput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// Shared text input — the single-line field idiom used across the workspace
// (issuer search & create, issuer Q&A, cross-issuer query, scenario prompt,
// EDGAR search, upload). Consolidates the CAOS field chrome: bg/border/rounded,
// muted placeholder, accent focus border, and the keyboard `.focus-ring`, so
// every field focuses and reads identically. Pass width/padding/size via
// `className` (layout stays the caller's); all native <input> props pass
// through. forwardRef supports autofocus and form refs.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
const INPUT_BASE = "bg-caos-bg border border-caos-border rounded text-caos-text placeholder:text-caos-muted " + "outline-none focus:border-caos-accent/70 transition-caos focus-ring";
const TextInput = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["forwardRef"])(function TextInput({ className = "", ...props }, ref) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
        ref: ref,
        className: INPUT_BASE + (className ? " " + className : ""),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/shared/TextInput.tsx",
        lineNumber: 23,
        columnNumber: 12
    }, this);
});
}),
"[project]/src/lib/pipeline/data.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Pipeline Visualizer data — module taxonomy, CP-X route graph, sim plan,
// CP-5B drivers and run-mode templates (port of design bundle shared/data.js
// + shared/deal.js DRIVERS + concept-b.jsx RUN_MODES).
// Derived from Modular OS CP-X ROUTE GRAPH v2.2 plus the flagged CP-2G/CP-4D modules.
__turbopack_context__.s([
    "DRIVERS",
    ()=>DRIVERS,
    "EDGES",
    ()=>EDGES,
    "LAYERS",
    ()=>LAYERS,
    "MODULES",
    ()=>MODULES,
    "NODE_LIMITS",
    ()=>NODE_LIMITS,
    "NODE_QA",
    ()=>NODE_QA,
    "NODE_REQS",
    ()=>NODE_REQS,
    "RUN_MODES",
    ()=>RUN_MODES,
    "SIM_PLAN",
    ()=>SIM_PLAN,
    "ancestorsOf",
    ()=>ancestorsOf,
    "descendantsOf",
    ()=>descendantsOf
]);
const MODULES = [
    {
        id: "CP-0",
        name: "Source Readiness",
        layer: "L0",
        desc: "File classification · entity ID · gap & conflict logging · downstream readiness"
    },
    {
        id: "CP-X",
        name: "Execution Router",
        layer: "ORCH",
        desc: "Route plan · module readiness register · one-owner validation · limitation propagation"
    },
    {
        id: "CP-1",
        name: "Financial Spreading",
        layer: "L1",
        desc: "Normalization · coverage gates · derived periods · KPI calculation register"
    },
    {
        id: "CP-1A",
        name: "Business Profile",
        layer: "L1",
        desc: "Transaction summary · ownership register · operating model · credit translation"
    },
    {
        id: "CP-1B",
        name: "Earnings Assessment",
        layer: "L1",
        desc: "KPI dashboard · variance analysis · corporate actions · overall earnings view"
    },
    {
        id: "CP-1C",
        name: "Peer Benchmarking",
        layer: "L1",
        desc: "Peer universe · metric alignment · comps · implied EV · outlier register"
    },
    {
        id: "CP-2",
        name: "Fundamental Credit",
        layer: "L2",
        desc: "Drivers · Porter/PEST/SWOT · financial profile · issuer matrix · overall credit view"
    },
    {
        id: "CP-2B",
        name: "Downside Pathways",
        layer: "L2",
        desc: "Fragility map · stress transmission · downside sensitivity matrix"
    },
    {
        id: "CP-2C",
        name: "Catalyst Calendar",
        layer: "L2",
        desc: "Event risk register · probability-impact matrix · watchlist handoff"
    },
    {
        id: "CP-2D",
        name: "Sponsor & Governance",
        layer: "L2",
        desc: "Sponsor behavior flags · capital allocation risk · creditor alignment"
    },
    {
        id: "CP-2E",
        name: "Liquidity",
        layer: "L2",
        desc: "12-month liquidity bridge · months-to-empty · mitigants & constraints"
    },
    {
        id: "CP-2F",
        name: "Macro & Hedging",
        layer: "L2",
        desc: "Rate/FX exposure registers · unhedged floating · base-rate sensitivity"
    },
    {
        id: "CP-2G",
        name: "ESG Credit Risk",
        layer: "L2",
        desc: "Issuer-specific transition/social transmission · linked-debt mechanics · credit materiality"
    },
    {
        id: "CP-3",
        name: "Relative Value",
        layer: "L3",
        desc: "Scorecard · RV table · fundamental value matrix · final ranking"
    },
    {
        id: "CP-3B",
        name: "Instrument Selection",
        layer: "L3",
        desc: "Capital structure dashboard · recovery sensitivity · preference decision table"
    },
    {
        id: "CP-3C",
        name: "Portfolio Fit",
        layer: "L3",
        desc: "Sizing posture · risk budget flags · concentration & correlation register"
    },
    {
        id: "CP-3D",
        name: "Refinancing & LME",
        layer: "L3",
        desc: "Maturity wall · legal capacity for LME · vulnerability score · scenario map"
    },
    {
        id: "CP-4",
        name: "Legal & Covenants",
        layer: "L4",
        desc: "Covenant register · EBITDA definitions · leakage · aggressiveness score"
    },
    {
        id: "CP-4D",
        name: "Restricted Group & Guarantees",
        layer: "L4",
        desc: "Entity perimeter · guarantee/security map · structural priority · leakage and priming exposure"
    },
    {
        id: "CP-4C",
        name: "Covenant Capacity",
        layer: "L4",
        desc: "Headroom table · debt/lien/priming capacity · nearest pressure point"
    },
    {
        id: "CP-5",
        name: "QA Clearance",
        layer: "L5",
        desc: "Citation/evidence audit · math & logic audit · consolidated issue log · clearance"
    },
    {
        id: "CP-5B",
        name: "Traceability",
        layer: "L5",
        desc: "Decision-relevant drivers · source lineage register · auditability assessment"
    },
    {
        id: "CP-6A",
        name: "IC Debate",
        layer: "L6",
        desc: "Bull vs Bear adversarial debate · IC Chair evidence weighting · final memo"
    },
    {
        id: "CP-6E",
        name: "Portfolio Debate",
        layer: "L6",
        desc: "RV Trader vs Compliance · CIO weighting · final sizing posture"
    },
    {
        id: "CP-RENDER",
        name: "Render",
        layer: "INFRA",
        desc: "Committee-ready document assembly"
    },
    {
        id: "CP-EXTRACT",
        name: "Extract",
        layer: "INFRA",
        desc: "Structured export · master index"
    },
    {
        id: "CP-DB",
        name: "Persist",
        layer: "INFRA",
        desc: "Canonical state store"
    }
];
const LAYERS = [
    {
        id: "L0",
        label: "Readiness"
    },
    {
        id: "ORCH",
        label: "Routing"
    },
    {
        id: "L1",
        label: "Base Build"
    },
    {
        id: "L2",
        label: "Synthesis"
    },
    {
        id: "L3",
        label: "Rel. Value"
    },
    {
        id: "L4",
        label: "Legal"
    },
    {
        id: "L5",
        label: "Governance"
    },
    {
        id: "L6",
        label: "Debate"
    },
    {
        id: "INFRA",
        label: "Export"
    }
];
const EDGES = [
    [
        "CP-0",
        "CP-X"
    ],
    [
        "CP-X",
        "CP-1"
    ],
    [
        "CP-X",
        "CP-1A"
    ],
    [
        "CP-1",
        "CP-1B"
    ],
    [
        "CP-1",
        "CP-1C"
    ],
    [
        "CP-1",
        "CP-2"
    ],
    [
        "CP-1",
        "CP-2B"
    ],
    [
        "CP-1",
        "CP-2E"
    ],
    [
        "CP-1",
        "CP-3"
    ],
    [
        "CP-1",
        "CP-3D"
    ],
    [
        "CP-1",
        "CP-4"
    ],
    [
        "CP-1",
        "CP-4C"
    ],
    [
        "CP-1",
        "CP-6A"
    ],
    [
        "CP-1A",
        "CP-2"
    ],
    [
        "CP-1A",
        "CP-2D"
    ],
    [
        "CP-1B",
        "CP-2"
    ],
    [
        "CP-1B",
        "CP-2B"
    ],
    [
        "CP-1C",
        "CP-2"
    ],
    [
        "CP-1C",
        "CP-3"
    ],
    [
        "CP-1C",
        "CP-6A"
    ],
    [
        "CP-2",
        "CP-2B"
    ],
    [
        "CP-2",
        "CP-2C"
    ],
    [
        "CP-2",
        "CP-2D"
    ],
    [
        "CP-2",
        "CP-2E"
    ],
    [
        "CP-2",
        "CP-2F"
    ],
    [
        "CP-2",
        "CP-3"
    ],
    [
        "CP-2",
        "CP-6A"
    ],
    [
        "CP-1",
        "CP-2G"
    ],
    [
        "CP-1A",
        "CP-2G"
    ],
    [
        "CP-2",
        "CP-2G"
    ],
    [
        "CP-2G",
        "CP-6A"
    ],
    [
        "CP-2B",
        "CP-3D"
    ],
    [
        "CP-2B",
        "CP-6A"
    ],
    [
        "CP-2B",
        "CP-6E"
    ],
    [
        "CP-2C",
        "CP-6A"
    ],
    [
        "CP-2D",
        "CP-6A"
    ],
    [
        "CP-2E",
        "CP-3"
    ],
    [
        "CP-2E",
        "CP-3D"
    ],
    [
        "CP-2E",
        "CP-6A"
    ],
    [
        "CP-2F",
        "CP-6A"
    ],
    [
        "CP-3",
        "CP-3B"
    ],
    [
        "CP-3",
        "CP-3C"
    ],
    [
        "CP-3",
        "CP-6A"
    ],
    [
        "CP-3",
        "CP-6E"
    ],
    [
        "CP-3B",
        "CP-6A"
    ],
    [
        "CP-3C",
        "CP-6A"
    ],
    [
        "CP-3C",
        "CP-6E"
    ],
    [
        "CP-3D",
        "CP-4"
    ],
    [
        "CP-3D",
        "CP-6A"
    ],
    [
        "CP-1",
        "CP-4D"
    ],
    [
        "CP-1A",
        "CP-4D"
    ],
    [
        "CP-4",
        "CP-4D"
    ],
    [
        "CP-4D",
        "CP-4C"
    ],
    [
        "CP-4D",
        "CP-6A"
    ],
    [
        "CP-4",
        "CP-4C"
    ],
    [
        "CP-4",
        "CP-6A"
    ],
    [
        "CP-4C",
        "CP-6A"
    ],
    [
        "CP-4C",
        "CP-6E"
    ],
    [
        "CP-5B",
        "CP-5"
    ],
    [
        "CP-6A",
        "CP-6E"
    ],
    [
        "CP-6A",
        "CP-5B"
    ],
    [
        "CP-6A",
        "CP-RENDER"
    ],
    [
        "CP-6A",
        "CP-EXTRACT"
    ],
    [
        "CP-6E",
        "CP-5B"
    ],
    [
        "CP-6E",
        "CP-RENDER"
    ],
    [
        "CP-6E",
        "CP-EXTRACT"
    ],
    [
        "CP-EXTRACT",
        "CP-DB"
    ]
];
const SIM_PLAN = [
    {
        id: "CP-0",
        deps: [],
        dur: 4,
        outcome: "pass",
        event: "CP-0 PASS — 14 files classified · 2 gaps logged (Q4-25 mgmt accounts, hedging register) · readiness 0.91"
    },
    {
        id: "CP-X",
        deps: [
            "CP-0"
        ],
        dur: 2,
        outcome: "pass",
        event: "CP-X route plan locked — 24 modules in scope · CP-2F limitation propagated (no hedging register)"
    },
    {
        id: "CP-1",
        deps: [
            "CP-X"
        ],
        dur: 6,
        outcome: "pass",
        event: "CP-1 PASS — 12 periods normalized · 41 KPIs registered · coverage gate GREEN"
    },
    {
        id: "CP-1A",
        deps: [
            "CP-X"
        ],
        dur: 5,
        outcome: "pass",
        event: "CP-1A PASS — ownership register built · Kestrel Capital 68.4% control"
    },
    {
        id: "CP-1B",
        deps: [
            "CP-1"
        ],
        dur: 4,
        outcome: "warning",
        event: "CP-1B WARNING — Q1-26 EBITDA bridge variance −4.2% vs sponsor model; conflict logged"
    },
    {
        id: "CP-1C",
        deps: [
            "CP-1"
        ],
        dur: 5,
        outcome: "pass",
        event: "CP-1C PASS — 7-name peer universe · subject trades +61bps wide of median"
    },
    {
        id: "CP-2",
        deps: [
            "CP-1",
            "CP-1A",
            "CP-1B",
            "CP-1C"
        ],
        dur: 6,
        outcome: "pass",
        event: "CP-2 PASS — overall credit view: B2/stable · pricing power MODERATE"
    },
    {
        id: "CP-2B",
        deps: [
            "CP-1",
            "CP-1B",
            "CP-2"
        ],
        dur: 4,
        outcome: "pass",
        event: "CP-2B PASS — 3 downside pathways · auto OEM destocking = fastest transmission"
    },
    {
        id: "CP-2C",
        deps: [
            "CP-2"
        ],
        dur: 3,
        outcome: "pass",
        event: "CP-2C PASS — 9 catalysts on calendar · refi window flagged Q3-26"
    },
    {
        id: "CP-2D",
        deps: [
            "CP-1A",
            "CP-2"
        ],
        dur: 4,
        outcome: "warning",
        event: "CP-2D WARNING — sponsor behavior flag: 2 prior dividend recaps at portfolio cos"
    },
    {
        id: "CP-2E",
        deps: [
            "CP-1",
            "CP-2"
        ],
        dur: 4,
        outcome: "pass",
        event: "CP-2E PASS — 19.3 months-to-empty under base · RCF 78% undrawn"
    },
    {
        id: "CP-2F",
        deps: [
            "CP-2"
        ],
        dur: 3,
        outcome: "warning",
        event: "CP-2F WARNING — hedging register missing; floating exposure modeled from SFA only"
    },
    {
        id: "CP-3",
        deps: [
            "CP-1",
            "CP-1C",
            "CP-2",
            "CP-2E"
        ],
        dur: 5,
        outcome: "pass",
        event: "CP-3 PASS — 2L TL ranked 2/7 on fundamental value matrix · +38bps excess spread"
    },
    {
        id: "CP-3B",
        deps: [
            "CP-3"
        ],
        dur: 4,
        outcome: "pass",
        event: "CP-3B PASS — preference: 2L TL over TLB · recovery delta acceptable at 6.0x stress"
    },
    {
        id: "CP-3C",
        deps: [
            "CP-3"
        ],
        dur: 3,
        outcome: "pass",
        event: "CP-3C PASS — fits HY sleeve · concentration check OK (sector 6.1% post-add)"
    },
    {
        id: "CP-3D",
        deps: [
            "CP-1",
            "CP-2B",
            "CP-2E"
        ],
        dur: 4,
        outcome: "pass",
        event: "CP-3D PASS — LME vulnerability 4/10 · 2027 wall refinanceable in current market"
    },
    {
        id: "CP-4",
        deps: [
            "CP-1",
            "CP-3D"
        ],
        dur: 6,
        outcome: "pass",
        event: "CP-4 PASS — covenant aggressiveness 7.2/10 · J.Crew + Chewy blockers PRESENT, paths blocked"
    },
    {
        id: "CP-4C",
        deps: [
            "CP-1",
            "CP-4"
        ],
        dur: 4,
        outcome: "warning",
        event: "CP-4C WARNING — $612M day-one incremental + RP capacity; priming risk MEDIUM-HIGH"
    },
    {
        id: "CP-6A",
        deps: [
            "CP-1",
            "CP-1C",
            "CP-2",
            "CP-2B",
            "CP-2C",
            "CP-2D",
            "CP-2E",
            "CP-2F",
            "CP-3",
            "CP-3B",
            "CP-3C",
            "CP-3D",
            "CP-4",
            "CP-4C"
        ],
        dur: 7,
        outcome: "pass",
        event: "CP-6A PASS — IC verdict: CONSTRUCTIVE, bear case priced · greatest uncertainty: add-back realization"
    },
    {
        id: "CP-6E",
        deps: [
            "CP-2B",
            "CP-3",
            "CP-3C",
            "CP-4C",
            "CP-6A"
        ],
        dur: 5,
        outcome: "pass",
        event: "CP-6E PASS — CIO sizing: 75bps initial, 125bps max · add-on-weakness posture"
    },
    {
        id: "CP-5B",
        deps: [
            "CP-6A",
            "CP-6E"
        ],
        dur: 4,
        outcome: "pass",
        event: "CP-5B PASS — 5/5 decision drivers fully traced · auditability STRONG"
    },
    {
        id: "CP-5",
        deps: [
            "CP-5B"
        ],
        dur: 5,
        outcome: "warning",
        event: "CP-5 CONDITIONAL — 1 HIGH finding open (CP-1C citation E-44 unresolved) · export held"
    },
    {
        id: "CP-RENDER",
        deps: [
            "CP-5"
        ],
        dur: 2,
        outcome: "held",
        event: "CP-RENDER HELD — awaiting CP-5 remediation of QA-117 before committee pack assembly"
    },
    {
        id: "CP-EXTRACT",
        deps: [
            "CP-5"
        ],
        dur: 2,
        outcome: "held",
        event: "CP-EXTRACT HELD — structured export gated on clearance"
    },
    {
        id: "CP-DB",
        deps: [
            "CP-EXTRACT"
        ],
        dur: 1,
        outcome: "idle",
        event: ""
    }
];
const DRIVERS = [
    {
        n: 1,
        driver: "EBITDA quality — add-backs 18.2% of adj. EBITDA",
        lineage: "D-01 p.214 → CP-1 calc register K-09 → CP-4C add-back analysis",
        conf: 0.92,
        status: "verified",
        evs: [
            "E-09",
            "E-87",
            "E-103"
        ]
    },
    {
        n: 2,
        driver: "Customer concentration — top 3 OEMs = 38% revenue",
        lineage: "D-01 p.97 → CP-1A operating model → CP-2B fragility map F-2",
        conf: 0.95,
        status: "verified",
        evs: [
            "E-15",
            "E-31"
        ]
    },
    {
        n: 3,
        driver: "Incremental debt capacity $612M day-one (priming risk)",
        lineage: "D-03 §4.09 → CP-4 incurrence register → CP-4C capacity register",
        conf: 0.97,
        status: "verified",
        evs: [
            "E-63",
            "E-64"
        ]
    },
    {
        n: 4,
        driver: "FCF conversion 41% — capex-light vs peer median 33%",
        lineage: "D-04 p.31 → CP-1 KPI K-22 → CP-1C benchmark 04B",
        conf: 0.88,
        status: "verified",
        evs: [
            "E-22"
        ]
    },
    {
        n: 5,
        driver: "Peer margin citation E-44 — page mismatch in CIM Annex C",
        lineage: "D-01 Annex C → CP-1C metric alignment → CP-5 issue QA-117",
        conf: 0.41,
        status: "open",
        evs: [
            "E-44"
        ]
    }
];
const NODE_QA = {
    "CP-1C": {
        id: "QA-117",
        sev: "HIGH",
        text: "Citation E-44 unresolved — peer EBITDA margin page mismatch (CIM Annex C). Blocks CP-5 clearance."
    }
};
const NODE_LIMITS = {
    "CP-2F": "Limitation L-04 propagated by CP-X: hedging register absent — floating-rate exposure modeled from SFA margins only. Consumers (CP-6A) flagged."
};
const NODE_REQS = {
    "CP-1B": [
        {
            doc: "Q4-25 management accounts",
            why: "closes gap G-02 — the Dec-25 quarter is derived, not sourced; earnings bridge runs on a modeled period",
            tag: "missing"
        },
        {
            doc: "Sponsor model — cost-out phasing schedule",
            why: "reconciles the −4.2% EBITDA bridge variance logged against Q1-26 actuals",
            tag: "requested"
        },
        {
            doc: "Q2-26 compliance certificate (Jul 28)",
            why: "first realization read on the $30M add-back program — converts phasing risk to actuals",
            tag: "open"
        }
    ],
    "CP-1C": [
        {
            doc: "CIM Annex C — corrected peer-margin page",
            why: "re-anchors citation E-44 (page mismatch) and clears QA-117; restores the full RV band",
            tag: "open"
        },
        {
            doc: "Peer Q1-26 filings — 7-name universe",
            why: "re-verifies EBITDA margin alignment once E-44 is re-anchored",
            tag: "requested"
        }
    ],
    "CP-2D": [
        {
            doc: "Sponsor distribution-policy confirmation",
            why: "two prior dividend recaps at Kestrel portfolio companies — distribution intent unconfirmed",
            tag: "requested"
        },
        {
            doc: "RP builder-basket certificate",
            why: "confirms the $240M basket feeding monitoring trigger T-4",
            tag: "missing"
        }
    ],
    "CP-2F": [
        {
            doc: "Hedging register (gap G-01)",
            why: "floating-rate exposure modeled from SFA margins only — source of limitation L-04",
            tag: "missing"
        },
        {
            doc: "ISDA schedules + swap/cap confirmations",
            why: "replaces modeled base-rate sensitivity with actual hedge coverage and tenors",
            tag: "missing"
        }
    ],
    "CP-4C": [
        {
            doc: "Conformed credit agreement v2 + SFA amendment",
            why: "re-bases the $612M day-one capacity calculation on controlling documents",
            tag: "open"
        },
        {
            doc: "Sponsor intent letter — incremental capacity",
            why: "MEDIUM-HIGH priming risk stays open without use-of-capacity confirmation",
            tag: "requested"
        }
    ],
    "CP-5": [
        {
            doc: "Remediation R-1 — E-44 re-anchor",
            why: "HIGH finding QA-117: peer-margin citation page mismatch blocks full clearance",
            tag: "open"
        },
        {
            doc: "CP-1C re-run confirmation",
            why: "metric alignment must re-verify against the corrected CIM Annex C reference",
            tag: "gated"
        }
    ],
    "CP-RENDER": [
        {
            doc: "CP-5 clearance certificate",
            why: "committee pack assembly held until QA-117 closes (remediation R-1)",
            tag: "gated"
        }
    ],
    "CP-EXTRACT": [
        {
            doc: "CP-5 clearance certificate",
            why: "structured export and master index gated on QA clearance",
            tag: "gated"
        }
    ]
};
function scopedPlan(scope, overrides = {}) {
    const ids = new Set(scope);
    return SIM_PLAN.filter((m)=>ids.has(m.id)).map((m)=>({
            ...m,
            deps: m.deps.filter((d)=>ids.has(d)),
            ...overrides[m.id] || {}
        }));
}
const RUN_MODES = [
    {
        k: "full",
        label: "COMMITTEE",
        runId: "RUN #2641",
        title: "2L TL '31 new-issue review",
        sub: "CP-X route v2.2 · 24 analytical modules · J1 join",
        drivers: null,
        plan: SIM_PLAN,
        complete: null,
        done: {
            tag: "warning",
            text: "CLEARANCE: CONDITIONAL — QA-117 open · committee pack HELD"
        }
    },
    {
        k: "earnings",
        label: "EARNINGS",
        runId: "RUN #2647",
        title: "Q1-26 earnings update",
        sub: "delta route E-1 · 10 modules · registers inherited",
        drivers: [
            1,
            4
        ],
        done: {
            tag: "ok",
            text: "UPDATE CLEARED — thesis AFFIRMED · no committee action"
        },
        complete: {
            sev: "ok",
            text: "RUN COMPLETE — earnings update cleared · thesis AFFIRMED · next checkpoint Q3-26 cert"
        },
        plan: scopedPlan([
            "CP-0",
            "CP-X",
            "CP-1",
            "CP-1B",
            "CP-2",
            "CP-2E",
            "CP-5B",
            "CP-5",
            "CP-EXTRACT",
            "CP-DB"
        ], {
            "CP-0": {
                dur: 3,
                event: "CP-0 PASS — Q1-26 10-Q + compliance certificate ingested · 2 files · readiness 0.98"
            },
            "CP-X": {
                event: "CP-X delta route locked — earnings template E-1 · 10 modules in scope · prior registers inherited read-only"
            },
            "CP-1": {
                dur: 5,
                event: "CP-1 PASS — Q1-26 actuals spread · 41 KPIs refreshed · covenant calc ties to cert (5.68x)"
            },
            "CP-1B": {
                event: "CP-1B WARNING — EBITDA bridge −4.2% vs sponsor model · cost-out phasing slips one quarter"
            },
            "CP-2": {
                dur: 4,
                event: "CP-2 PASS — credit view AFFIRMED B2/stable · earnings within thesis tolerance"
            },
            "CP-2E": {
                event: "CP-2E PASS — months-to-empty 19.3 → 20.1 · RCF 78% undrawn"
            },
            "CP-5B": {
                deps: [
                    "CP-1B",
                    "CP-2",
                    "CP-2E"
                ],
                event: "CP-5B PASS — drivers #1/#4 re-traced to Q1-26 cert (E-103) · lineage current"
            },
            "CP-5": {
                outcome: "pass",
                dur: 3,
                event: "CP-5 PASS — 0 new findings · QA-117 unaffected (CP-1C not in scope) · update cleared"
            },
            "CP-EXTRACT": {
                outcome: "pass",
                event: "CP-EXTRACT PASS — monitoring registers updated · trigger T-1 armed for Q3-26 cert"
            },
            "CP-DB": {
                outcome: "pass",
                event: "CP-DB — canonical state v2.2.1 committed"
            }
        })
    },
    {
        k: "legal",
        label: "LEGAL",
        runId: "RUN #2652",
        title: "Covenant & docs deep-dive",
        sub: "route L-2 · 9 modules · conformed credit agreement v2",
        drivers: [
            3
        ],
        done: {
            tag: "ok",
            text: "REGISTER PUBLISHED — covenant memo v2 distributed"
        },
        complete: {
            sev: "ok",
            text: "RUN COMPLETE — covenant register v2 published · aggressiveness 7.2/10 · priming watch ARMED"
        },
        plan: scopedPlan([
            "CP-0",
            "CP-X",
            "CP-1",
            "CP-3D",
            "CP-4",
            "CP-4C",
            "CP-5B",
            "CP-5",
            "CP-RENDER"
        ], {
            "CP-0": {
                dur: 3,
                event: "CP-0 PASS — conformed credit agreement v2 + SFA amendment classified · controlling-doc check PASS"
            },
            "CP-X": {
                event: "CP-X route locked — legal template L-2 · 9 modules in scope · financial registers inherited read-only"
            },
            "CP-1": {
                dur: 3,
                event: "CP-1 PASS — EBITDA definition register synced to §1.01 · covenant calc basis confirmed"
            },
            "CP-3D": {
                event: "CP-3D PASS — LME vulnerability re-scored 4/10 → 5/10 · MFN sunset proximity flagged"
            },
            "CP-4": {
                dur: 7,
                event: "CP-4 PASS — 41 covenants registered · J.Crew/Chewy blockers PRESENT · uptier path open at 50.1% vote"
            },
            "CP-4C": {
                event: "CP-4C WARNING — $612M day-one capacity re-affirmed · RP builder basket $240M and growing"
            },
            "CP-5B": {
                deps: [
                    "CP-3D",
                    "CP-4",
                    "CP-4C"
                ],
                event: "CP-5B PASS — every covenant cite anchored to conformed credit agreement · doc lineage 100%"
            },
            "CP-5": {
                outcome: "pass",
                event: "CP-5 PASS — legal register cleared · 0 citation defects · memo released"
            },
            "CP-RENDER": {
                outcome: "pass",
                event: "CP-RENDER PASS — covenant memo v2 assembled · distributed legal + PM"
            }
        })
    },
    {
        k: "rv",
        label: "RV",
        runId: "RUN #2655",
        title: "Relative value refresh",
        sub: "route R-1 · 10 modules · desk marks Jun 9",
        drivers: [
            4,
            5
        ],
        done: {
            tag: "ok",
            text: "RV REFRESH PUBLISHED — OVERWEIGHT affirmed"
        },
        complete: {
            sev: "ok",
            text: "RUN COMPLETE — RV refresh published · ATLF holds OVERWEIGHT · next sweep T+1"
        },
        plan: scopedPlan([
            "CP-0",
            "CP-X",
            "CP-1",
            "CP-1C",
            "CP-3",
            "CP-3B",
            "CP-3C",
            "CP-6E",
            "CP-5",
            "CP-EXTRACT"
        ], {
            "CP-0": {
                dur: 2,
                event: "CP-0 PASS — market snapshot ingested · LoanX marks + dealer runs Jun 9 · 7 peer marks refreshed"
            },
            "CP-X": {
                event: "CP-X route locked — RV template R-1 · 10 modules in scope · fundamental registers inherited read-only"
            },
            "CP-1": {
                dur: 2,
                event: "CP-1 PASS — KPI register loaded read-only · no re-spread required"
            },
            "CP-1C": {
                outcome: "warning",
                event: "CP-1C WARNING — peer set re-marked · E-44 still open → ex-E-44 band in force (+325–340bps)"
            },
            "CP-3": {
                event: "CP-3 PASS — 2L TL slips 2/7 → 3/7 on value matrix · HELX tightened 9bps"
            },
            "CP-3B": {
                event: "CP-3B PASS — preference unchanged: 2L TL over TLB · recovery delta stable at 6.0x stress"
            },
            "CP-3C": {
                event: "CP-3C PASS — sizing headroom 50bps to max · sector concentration 6.1% unchanged"
            },
            "CP-6E": {
                event: "CP-6E PASS — CIO posture re-affirmed: add-on-weakness · standing order at +400bps"
            },
            "CP-5": {
                outcome: "pass",
                deps: [
                    "CP-6E"
                ],
                dur: 3,
                event: "CP-5 PASS — marks tie to LoanX within 0.1pt · spot-check audit clean"
            },
            "CP-EXTRACT": {
                outcome: "pass",
                event: "CP-EXTRACT PASS — RV table pushed to portfolio dashboard"
            }
        })
    }
];
function ancestorsOf(id) {
    const up = new Set();
    const walk = (n)=>EDGES.forEach(([a, b])=>{
            if (b === n && !up.has(a)) {
                up.add(a);
                walk(a);
            }
        });
    walk(id);
    return up;
}
function descendantsOf(id) {
    const down = new Set();
    const walk = (n)=>EDGES.forEach(([a, b])=>{
            if (a === n && !down.has(b)) {
                down.add(b);
                walk(b);
            }
        });
    walk(id);
    return down;
}
}),
"[project]/src/lib/reports/deal.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CAPACITY",
    ()=>CAPACITY,
    "CAPSTACK",
    ()=>CAPSTACK,
    "COVENANTS",
    ()=>COVENANTS,
    "DEAL",
    ()=>DEAL,
    "DEBATE",
    ()=>DEBATE,
    "DEBATE_6E",
    ()=>DEBATE_6E,
    "DOCS",
    ()=>DOCS,
    "MODULE_NAMES",
    ()=>MODULE_NAMES,
    "RECOVERY",
    ()=>RECOVERY,
    "SIZING",
    ()=>SIZING,
    "TRIGGERS",
    ()=>TRIGGERS
]);
// ATLF demo deal data for the Report Studio (port of design bundle shared/deal.js
// + module taxonomy from shared/data.js). Replace with live module outputs once
// CP-RENDER persistence lands (see docs/REMEDIATION_PLAN.md).
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/data.ts [app-ssr] (ecmascript)");
;
const MODULE_NAMES = Object.fromEntries(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MODULES"].map((m)=>[
        m.id,
        m.name
    ]));
const DEAL = {
    code: "ATLF",
    name: "Atlas Forge Industrials",
    sponsor: "Kestrel Capital Partners (Fund V, 68.4%)",
    rating: "B2 (stable) / B (stable)",
    sector: "Industrials — Engineered Components",
    deal: "2L TL '31 — new issue review",
    ebitda: 421,
    netLev: 5.68
};
const DOCS = [
    {
        id: "D-01",
        name: "Confidential Info Memo (2L TL '31)",
        type: "CIM",
        pages: 412,
        grade: "A",
        date: "May 2026",
        mnpi: false
    },
    {
        id: "D-02",
        name: "Senior Facilities Agreement",
        type: "SFA",
        pages: 386,
        grade: "A",
        date: "Mar 2024",
        mnpi: false
    },
    {
        id: "D-03",
        name: "2L Credit Agt (final)",
        type: "Credit Agt",
        pages: 298,
        grade: "A",
        date: "May 2026",
        mnpi: false
    },
    {
        id: "D-04",
        name: "FY23–FY25 Audited Financials",
        type: "Audit",
        pages: 214,
        grade: "A",
        date: "Feb 2026",
        mnpi: false
    },
    {
        id: "D-05",
        name: "Q1-26 Compliance Certificate",
        type: "Covenant",
        pages: 9,
        grade: "A",
        date: "Jun 2026",
        mnpi: false
    },
    {
        id: "D-06",
        name: "Lender Presentation",
        type: "LP",
        pages: 64,
        grade: "B",
        date: "May 2026",
        mnpi: true
    },
    {
        id: "D-07",
        name: "Sponsor Model (extract)",
        type: "Model",
        pages: 12,
        grade: "C",
        date: "May 2026",
        mnpi: true
    }
];
const DEBATE = {
    thesis: "Long 2L TL '31 at 96.4 (+388bps DM). Engineered-components platform with sticky aftermarket mix (44% of gross profit), 5.7x net leverage through the 2L TL, sponsor equity cushion ≈ 42% of capitalization at entry multiple.",
    rounds: [
        {
            who: "BULL",
            phase: "Opening Statement",
            points: [
                {
                    text: "Aftermarket revenue (44% of GP) is contract-locked with 92% renewal — recurring stream covers fixed charges 1.6x on its own.",
                    ev: [
                        "E-12",
                        "E-31"
                    ]
                },
                {
                    text: "FCF conversion 41% vs peer median 33%; deleveraging path to 4.9x by FY27 without multiple expansion.",
                    ev: [
                        "E-22",
                        "E-58"
                    ]
                },
                {
                    text: "At +388bps the 2L TL prices a B3 outcome; CP-1C fair-value band implies +325–340bps for the fundamental profile.",
                    ev: [
                        "E-44",
                        "E-71"
                    ]
                }
            ]
        },
        {
            who: "BEAR",
            phase: "Cross-Examination",
            points: [
                {
                    text: "Adj. EBITDA includes $76.6M add-backs (18.2%) — synergy and 'one-time' operational items recur in 3 of last 4 years. Real leverage nearer 6.9x.",
                    ev: [
                        "E-09",
                        "E-87"
                    ]
                },
                {
                    text: "Top-3 OEM concentration at 38%; Meridian-platform contract (14% of revenue) reprices Q2-27 amid OEM insourcing pressure.",
                    ev: [
                        "E-15"
                    ]
                },
                {
                    text: "CP-4C: $612M day-one incremental capacity, MFN sunset at 12 months, RP builder basket already at $240M — priming and leakage paths are open.",
                    ev: [
                        "E-63",
                        "E-64"
                    ]
                },
                {
                    text: "The +61bps 'cheapness' vs peers leans on citation E-44, which is the open QA-117 finding. Strike it and the RV case thins to +20bps.",
                    ev: [
                        "E-44"
                    ]
                }
            ]
        },
        {
            who: "BULL",
            phase: "Defense",
            points: [
                {
                    text: "Add-back realization is auditable: $41M of the $76.6M is closed-plant savings already in Q1-26 run-rate (compliance cert confirms 5.68x covenant calc).",
                    ev: [
                        "E-103"
                    ]
                },
                {
                    text: "Concentration is mitigated by 7-year LTAs with cost pass-through; CP-2B stress case still shows 14 months-to-empty.",
                    ev: [
                        "E-31",
                        "E-77"
                    ]
                },
                {
                    text: "Concede E-44 dependency — re-run CP-1C ex-E-44 still shows +20–25bps excess vs sector beta; thesis is carry + deleveraging, not spread convergence alone.",
                    ev: []
                }
            ]
        }
    ],
    weighting: [
        {
            claim: "EBITDA quality / true leverage",
            bull: 0.35,
            bear: 0.65,
            verdict: "BEAR — haircut adj. EBITDA by $35M in base case",
            lean: "con",
            ev: "E-09 · E-87 · E-103"
        },
        {
            claim: "Aftermarket stickiness & FCF",
            bull: 0.8,
            bear: 0.2,
            verdict: "BULL — strongest evidenced claim in record",
            lean: "pro",
            ev: "E-12 · E-22 · E-31"
        },
        {
            claim: "RV cheapness vs peers",
            bull: 0.45,
            bear: 0.55,
            verdict: "SPLIT — pending QA-117; use ex-E-44 band",
            lean: "split",
            ev: "E-44 (open)"
        },
        {
            claim: "Documentation / priming risk",
            bull: 0.25,
            bear: 0.75,
            verdict: "BEAR — capacity is real; price it via sizing, not exclusion",
            lean: "con",
            ev: "E-63 · E-64"
        },
        {
            claim: "Sponsor alignment",
            bull: 0.55,
            bear: 0.45,
            verdict: "NEUTRAL — Fund VI close supports, recap history offsets",
            lean: "split",
            ev: "E-91"
        }
    ],
    bias: "CONSTRUCTIVE — add on weakness",
    uncertainty: "Sustainability of the $41M closed-plant savings inside the add-back stack: if Q3-26 run-rate slips, true leverage re-rates to ~6.4x and the deleveraging narrative fails.",
    memo: "The Chair finds the bear case on EBITDA quality persuasive but fully priced at +388bps; the bull case on aftermarket durability survives cross-examination intact. Initiate at modest size with hard add/trim triggers tied to add-back realization (Q3-26 compliance cert) and resolution of QA-117. Escalate to IC re-vote if Meridian-platform contract renewal terms degrade."
};
const DEBATE_6E = {
    thesis: "Carry-adjusted return on the 2L TL '31 clears the hurdle at any size — the contest is conviction (max now at +388 DM) vs constraints: the B3-or-below quality bucket at 91% utilization, the E-44-dependent entry band, and SXAA correlation overlap. Three contested points, each with a named owner.",
    rounds: [
        {
            who: "RV",
            phase: "Trader's Pitch — max size now",
            points: [
                {
                    text: "+388 entry clears the hurdle hold-to-maturity with zero tightening assumed.",
                    ev: []
                },
                {
                    text: "Two-way depth ($4.2M avg prints) supports building the full position inside two weeks — live marks Jun 8 at 96.25 / 96.75.",
                    ev: [
                        "E-71"
                    ]
                },
                {
                    text: "The catalyst calendar is front-loaded — being underweight into the Jul 28 print wastes the entry.",
                    ev: []
                }
            ]
        },
        {
            who: "COMPLIANCE",
            phase: "Compliance Attack",
            points: [
                {
                    text: "B3-or-below bucket at 91% utilization — max size leaves 0.3% headroom for the entire book.",
                    ev: []
                },
                {
                    text: "The entry band leans on the open E-44 finding — this is sizing off a contested signal.",
                    ev: [
                        "E-44"
                    ]
                },
                {
                    text: "SXAA correlation overlap — same OEM exposure class; the cluster sits at 14% of the 16% limit.",
                    ev: []
                }
            ]
        },
        {
            who: "RV",
            phase: "Trader's Defense",
            points: [
                {
                    text: "Concede staging — propose the standing constraint: 75bps now at +388 or wider, max gated on T-1 plus a same-day bucket re-test.",
                    ev: []
                },
                {
                    text: "Standing limit order at +400bps; no concurrent SXAA adds.",
                    ev: []
                },
                {
                    text: "Each objection converts into a wired rule rather than a debate point.",
                    ev: []
                }
            ]
        }
    ],
    weighting: [
        {
            claim: "Size at max immediately (+388 entry)",
            bull: 0.35,
            bear: 0.65,
            verdict: "COMPLIANCE — start 75bps; max requires a bucket-headroom check",
            lean: "con",
            ev: "E-71"
        },
        {
            claim: "RV signal validity",
            bull: 0.45,
            bear: 0.55,
            verdict: "SPLIT — size off the ex-E-44 band (+20–25bps) until QA-117 clears",
            lean: "split",
            ev: "E-44 (open)"
        },
        {
            claim: "Correlation with auto/industrial cluster",
            bull: 0.5,
            bear: 0.5,
            verdict: "MANAGED — no concurrent SXAA adds; monitor weekly",
            lean: "split",
            ev: "—"
        }
    ],
    bias: "ADD-ON-WEAKNESS — 75bps initial, 125bps max",
    uncertainty: "Whether the B3-or-below bucket frees up before the entry window closes — at 91% utilization the path to max size depends on book-level turnover, not the credit itself.",
    memo: "Approve 75bps initial at +388 or wider; standing limit order at +400bps. The path to the 125bps max is gated on the Q3-26 add-back certificate (trigger T-1) and same-day B3-bucket headroom. Trim on RP-basket activation (T-4) or a CP-3 re-rank below 4/7. The position is sized so that being wrong costs a quarter's carry, not the year's budget."
};
const COVENANTS = [
    {
        ref: "2L Credit Agt §4.09(b)(1)",
        name: "Ratio Debt",
        agg: 8,
        headroom: "$310M ratio + $150M freebie",
        flag: "critical",
        clause: "…may Incur Indebtedness if the Fixed Charge Coverage Ratio … would be at least 2.00 to 1.00, determined on a pro forma basis (including a pro forma application of the net proceeds therefrom)…",
        read: "Open ratio basket. Pro-forma EBITDA includes uncapped 'expected cost savings' (24-month realization window) — effective capacity well above headline."
    },
    {
        ref: "2L Credit Agt §4.09(b)(14)",
        name: "Incremental / Freebie",
        agg: 9,
        headroom: "$612M day-one",
        flag: "critical",
        clause: "…the greater of $150.0 million and 35% of Consolidated EBITDA, plus unlimited amounts subject to 5.25x Secured Leverage…",
        read: "Grower freebie + ratio capacity = $612M day-one priming capacity ahead of the 2L TL. MFN protection sunsets after 12 months."
    },
    {
        ref: "2L Credit Agt §4.07(a)",
        name: "Restricted Payments",
        agg: 7,
        headroom: "$240M usable today",
        flag: "warning",
        clause: "…50% of Consolidated Net Income builder, plus the Available Amount, plus a starter basket of the greater of $100.0 million and 22.5% of Consolidated EBITDA…",
        read: "Builder at $240M and growing; no leverage governor on starter basket. Dividend recap possible without amendment by FY27."
    },
    {
        ref: "2L Credit Agt §4.15 / def. 'Unrestricted Subsidiary'",
        name: "Asset Transfer (J.Crew)",
        agg: 3,
        headroom: "Blocked",
        flag: "ok",
        clause: "…the Issuer may designate any Restricted Subsidiary as an Unrestricted Subsidiary if such designation would not cause a Default; provided that no Material Intellectual Property may be transferred…",
        read: "J.Crew blocker PRESENT and well-drafted ('Material IP' broadly defined). Chewy-style guarantee-release also blocked via §10.04 amendment."
    },
    {
        ref: "SFA §7.02 (springing)",
        name: "Financial Covenant",
        agg: 4,
        headroom: "28% EBITDA cushion",
        flag: "ok",
        clause: "…First Lien Net Leverage shall not exceed 7.10:1.00, tested only when RCF utilization (excl. LCs) exceeds 40%…",
        read: "Springing only; current utilization 22%. Cushion vs covenant ≈ 28% of EBITDA — not a near-term default vector."
    },
    {
        ref: "2L Credit Agt §2.05 (soft-call)",
        name: "Soft-Call / Prepayment",
        agg: 2,
        headroom: "101 soft-call to Nov-26",
        flag: "ok",
        clause: "…the Loans may be voluntarily prepaid at any time; provided that any prepayment on or prior to the date six months after the Closing Date shall be accompanied by a 1.00% prepayment premium (101 soft-call)…",
        read: "101 soft-call lapses six months after close; par-prepayable thereafter. Repricing / refi risk is the trade-off for loan format — monitor primary-market spreads for a repricing trigger."
    }
];
const CAPACITY = {
    nearest: "RP builder basket — usable $240M today; crosses $300M (≈ one full turn of dividend) at FY26 year-end on current CNI build",
    incDebt: 612,
    rpToday: 240,
    addback: 76.6,
    addbackPct: 18.2
};
const CAPSTACK = [
    {
        cls: "RCF (drawn)",
        key: "1l",
        claim: 120,
        rate: "S+350"
    },
    {
        cls: "Term Loan B",
        key: "1l",
        claim: 1850,
        rate: "S+375"
    },
    {
        cls: "2nd Lien Term Loan",
        key: "2l",
        claim: 900,
        rate: "S+425"
    },
    {
        cls: "Subordinated Notes",
        key: "sub",
        claim: 400,
        rate: "10.00%"
    },
    {
        cls: "Sponsor Equity",
        key: "eq",
        claim: 1640,
        rate: "—"
    }
];
const RECOVERY = [
    {
        scen: "Upside",
        mult: "7.5x",
        ebitda: 421,
        ev: 3158,
        note: "strategic sale; aftermarket re-rated"
    },
    {
        scen: "Base distress",
        mult: "6.0x",
        ebitda: 360,
        ev: 2160,
        note: "cyclical downturn; add-backs 50% realized"
    },
    {
        scen: "Severe",
        mult: "5.0x",
        ebitda: 295,
        ev: 1475,
        note: "OEM loss + destocking; LME attempted"
    }
];
const SIZING = {
    decision: "INITIATE — 2L TL '31",
    initial: "75bps of NAV",
    max: "125bps",
    entry: "≤ 96.75 / ≥ +380bps",
    constraint: "Single-issuer limit 150bps; B3-or-below bucket at 91% utilization — max size requires bucket headroom check at add.",
    addTriggers: [
        "Q3-26 compliance cert shows ≥ $38M add-back realization",
        "QA-117 resolved with E-44 re-verified",
        "DM ≥ +420bps on no new fundamental information"
    ],
    trimTriggers: [
        "Meridian-platform renewal priced > 200bps concession",
        "RP basket usage announced > $150M",
        "Months-to-empty < 12 on CP-2E refresh"
    ]
};
const TRIGGERS = [
    {
        id: "T-1",
        text: "Add-back realization < $30M at Q3-26 cert",
        owner: "CP-1 → CP-6A re-vote",
        sev: "critical"
    },
    {
        id: "T-2",
        text: "Incremental raise > $200M inside 12-month MFN sunset",
        owner: "CP-4C → CP-3B re-rank",
        sev: "critical"
    },
    {
        id: "T-3",
        text: "Top-3 OEM concentration > 42% on any quarter",
        owner: "CP-2B pathway P1",
        sev: "warning"
    },
    {
        id: "T-4",
        text: "Sponsor announces dividend recap exploration",
        owner: "CP-2D → CP-6E sizing review",
        sev: "warning"
    }
];
}),
"[project]/src/lib/deepdive/module-outputs.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// AUTO-PORTED from the Credit OS design bundle (shared/deal-modules.js).
// ATLF demo data — replace with live module outputs when CP backend persistence lands.
__turbopack_context__.s([
    "MODULE_OUTPUTS",
    ()=>MODULE_OUTPUTS,
    "NORMALIZED_FINANCIAL_ROWS",
    ()=>NORMALIZED_FINANCIAL_ROWS,
    "PEER_CREDIT_METRIC_ROWS",
    ()=>PEER_CREDIT_METRIC_ROWS
]);
const PEER_CREDIT_METRIC_ROWS = [
    [
        "Atlas Forge (subject)",
        "B2 / B",
        "5.7x",
        "15.0%",
        "41%",
        "+388"
    ],
    [
        "Forgeline Industries",
        "B2 / B",
        "5.9x",
        "13.8%",
        "31%",
        "+352"
    ],
    [
        "Karst Components",
        "B3 / B−",
        "6.4x",
        "12.1%",
        "27%",
        "+459"
    ],
    [
        "Veldt Precision",
        "B1 / B+",
        "4.8x",
        "16.2%",
        "38%",
        "+291"
    ],
    [
        "Ironvale Group",
        "B2 / B",
        "5.5x",
        "14.1%",
        "33%",
        "+327"
    ],
    [
        "Cascadia Metalworks",
        "B2 / B",
        "5.2x",
        "13.2%",
        "29%",
        "+341"
    ],
    [
        "Tarn Engineered Sys",
        "B3 / CCC+",
        "7.1x",
        "11.4%",
        "22%",
        "+577"
    ]
];
const NORMALIZED_FINANCIAL_ROWS = [
    [
        "Revenue",
        "2,410",
        "2,588",
        "2,742",
        "2,801"
    ],
    [
        "Adj. EBITDA",
        "358",
        "392",
        "415",
        "421"
    ],
    [
        "Adj. EBITDA margin",
        "14.9%",
        "15.1%",
        "15.1%",
        "15.0%"
    ],
    [
        "Reported EBITDA (pre add-back)",
        "318",
        "329",
        "341",
        "344"
    ],
    [
        "Capex",
        "(96)",
        "(108)",
        "(118)",
        "(121)"
    ],
    [
        "Free cash flow",
        "142",
        "158",
        "169",
        "172"
    ],
    [
        "Net debt",
        "2,392",
        "2,371",
        "2,380",
        "2,391"
    ],
    [
        "Net leverage (adj.)",
        "6.7x",
        "6.0x",
        "5.7x",
        "5.7x"
    ],
    [
        "Interest coverage",
        "1.9x",
        "2.0x",
        "2.1x",
        "2.1x"
    ]
];
const MODULE_OUTPUTS = {
    "CP-1": {
        kpis: [
            {
                l: "Periods normalized",
                v: "12"
            },
            {
                l: "KPIs registered",
                v: "41"
            },
            {
                l: "Coverage gate",
                v: "GREEN",
                sev: "ok"
            },
            {
                l: "Definition conflicts",
                v: "2",
                sev: "warning"
            }
        ],
        sections: [
            {
                type: "table",
                title: "CP-1-07 · Normalized financials ($M)",
                cols: [
                    "",
                    "FY23",
                    "FY24",
                    "FY25",
                    "LTM Q1-26"
                ],
                align: [
                    0,
                    1,
                    1,
                    1,
                    1
                ],
                rows: NORMALIZED_FINANCIAL_ROWS
            },
            {
                type: "flags",
                title: "CP-1-10 · Definition conflict register",
                items: [
                    {
                        sev: "warning",
                        text: "EBITDA definition: SFA caps cost-saving add-backs at 25% (24mo); 2L Credit Agt is uncapped — covenant calcs diverge by $14.2M.",
                        ev: [
                            "E-09",
                            "E-103"
                        ]
                    },
                    {
                        sev: "warning",
                        text: "Derived Q4-25 period constructed from sponsor model — Q4-25 management accounts not provided (gap G-02).",
                        ev: [
                            "E-58"
                        ]
                    }
                ]
            },
            {
                type: "text",
                title: "CP-1-12 · Coverage gate & downstream readiness",
                body: "All three statements covered FY23–LTM at quarterly grain. Calculation register complete for 41 KPIs; tie-out to audited financials within 0.3% on every line. Downstream readiness: GREEN for all consumers; CP-1B inherits the Q4-25 derived-period caveat."
            }
        ]
    },
    "CP-1A": {
        kpis: [
            {
                l: "Control",
                v: "Kestrel 68.4%"
            },
            {
                l: "Mgmt rollover",
                v: "9.2%"
            },
            {
                l: "Co-invest",
                v: "22.4%"
            },
            {
                l: "Segments",
                v: "3"
            }
        ],
        sections: [
            {
                type: "table",
                title: "CP-1A-07 · History & transaction timeline",
                cols: [
                    "Date",
                    "Event",
                    "Consideration",
                    "Multiple"
                ],
                align: [
                    0,
                    0,
                    1,
                    1
                ],
                rows: [
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
                ]
            },
            {
                type: "text",
                title: "CP-1A-06 · Operating model",
                body: "Engineered metal components for industrial OEMs across 3 segments: Drivetrain (46% rev), Fluid Systems (31%), Aftermarket & Services (23% rev / 44% gross profit). 14 plants (9 US, 4 EU, 1 MX); 71% of COGS is pass-through-indexed steel and alloys with 60–90 day lag. Aftermarket attaches to a 1.9M-unit installed base with 92% contract renewal."
            },
            {
                type: "flags",
                title: "CP-1A-08 · Credit translation",
                items: [
                    {
                        sev: "ok",
                        text: "Installed-base aftermarket annuity is the core credit support — recurring, high-margin, contract-locked.",
                        ev: [
                            "E-12",
                            "E-31"
                        ]
                    },
                    {
                        sev: "warning",
                        text: "Top-3 OEM relationships (38% of revenue) concentrate volume risk into Drivetrain.",
                        ev: [
                            "E-15"
                        ]
                    }
                ]
            }
        ]
    },
    "CP-1B": {
        kpis: [
            {
                l: "LTM EBITDA growth",
                v: "+6.2%",
                sev: "ok"
            },
            {
                l: "vs sponsor model",
                v: "−4.2%",
                sev: "warning"
            },
            {
                l: "Book-to-bill (Q1-26)",
                v: "1.06x"
            },
            {
                l: "Corporate actions",
                v: "2"
            }
        ],
        sections: [
            {
                type: "table",
                title: "CP-1B-06 · KPI dashboard (quarterly)",
                cols: [
                    "",
                    "Q2-25",
                    "Q3-25",
                    "Q4-25*",
                    "Q1-26"
                ],
                align: [
                    0,
                    1,
                    1,
                    1,
                    1
                ],
                rows: [
                    [
                        "Revenue ($M)",
                        "688",
                        "701",
                        "697",
                        "715"
                    ],
                    [
                        "Adj. EBITDA ($M)",
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
                    ]
                ]
            },
            {
                type: "flags",
                title: "CP-1B-07 · Variance analysis",
                items: [
                    {
                        sev: "warning",
                        text: "Q1-26 EBITDA bridge lands −4.2% below sponsor model — shortfall concentrated in Fluid Systems volume; conflict logged to CP-5.",
                        ev: [
                            "E-58"
                        ]
                    },
                    {
                        sev: "ok",
                        text: "Pricing actions held: +180bps realized price vs +140bps input inflation in Q1-26."
                    }
                ]
            },
            {
                type: "text",
                title: "CP-1B-13 · Overall earnings view",
                body: "Earnings trajectory is intact but the sponsor model runs hot. Use CP-1 normalized actuals as the base; treat the model as upside. * Q4-25 is a derived period (gap G-02)."
            }
        ]
    },
    "CP-1C": {
        kpis: [
            {
                l: "Peer universe",
                v: "7 names"
            },
            {
                l: "Subject vs median DM",
                v: "+61bps",
                sev: "ok"
            },
            {
                l: "Margin percentile",
                v: "64th"
            },
            {
                l: "Outliers excluded",
                v: "1"
            }
        ],
        sections: [
            {
                type: "table",
                title: "CP-1C-04C · Credit metric benchmark",
                cols: [
                    "Peer",
                    "Rating",
                    "Net lev",
                    "EBITDA mgn",
                    "FCF conv",
                    "DM"
                ],
                align: [
                    0,
                    0,
                    1,
                    1,
                    1,
                    1
                ],
                rows: PEER_CREDIT_METRIC_ROWS
            },
            {
                type: "flags",
                title: "CP-1C-05 · Outlier register & open items",
                items: [
                    {
                        sev: "critical",
                        text: "Citation E-44 (peer margin set, CIM Annex C) — page mismatch under QA-117. Benchmark conclusions carried ex-E-44 until re-verified.",
                        ev: [
                            "E-44"
                        ]
                    },
                    {
                        sev: "low",
                        text: "Tarn Engineered excluded from median (distressed outlier, +577bps)."
                    }
                ]
            },
            {
                type: "text",
                title: "CP-1C-09 · Overall peer benchmarking view",
                body: "Subject screens cheap: +61bps wide of the B2 median with top-quartile FCF conversion and above-median margin. Ex-E-44 the gap compresses to +20–25bps — still positive carry vs fundamentals."
            }
        ]
    },
    "CP-2": {
        kpis: [
            {
                l: "Overall credit view",
                v: "B2 / STABLE",
                sev: "ok"
            },
            {
                l: "Pricing power",
                v: "MODERATE"
            },
            {
                l: "Material factors",
                v: "6"
            },
            {
                l: "Monitoring triggers set",
                v: "4"
            }
        ],
        sections: [
            {
                type: "table",
                title: "CP-2-11 · Issuer matrix (material factors)",
                cols: [
                    "Factor",
                    "Assessment",
                    "Trend",
                    "Weight"
                ],
                align: [
                    0,
                    0,
                    0,
                    1
                ],
                rows: [
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
                ]
            },
            {
                type: "text",
                title: "CP-2-13 · Overall credit view",
                body: "A fundamentally sound B2: durable aftermarket economics and genuine FCF offset by aggressive EBITDA presentation and customer concentration. Deleveraging to ~4.9x by FY27 is credible on realized add-backs alone; the binding risks are documentation-enabled releveraging (CP-4C) and the Meridian contract cycle.",
                ev: [
                    "E-22",
                    "E-09"
                ]
            }
        ]
    },
    "CP-2B": {
        kpis: [
            {
                l: "Pathways modeled",
                v: "3"
            },
            {
                l: "Fastest transmission",
                v: "2 quarters",
                sev: "warning"
            },
            {
                l: "Worst EBITDA impact",
                v: "−18%",
                sev: "warning"
            },
            {
                l: "Stress M2E",
                v: "14.0mo"
            }
        ],
        sections: [
            {
                type: "table",
                title: "CP-2B-05 · Downside pathway register",
                cols: [
                    "Path",
                    "Trigger",
                    "Transmission",
                    "EBITDA impact",
                    "Prob."
                ],
                align: [
                    0,
                    0,
                    0,
                    1,
                    1
                ],
                rows: [
                    [
                        "P1",
                        "OEM destocking cycle",
                        "Drivetrain volumes −12% over 2 qtrs; absorption deleverage",
                        "−18%",
                        "25%"
                    ],
                    [
                        "P2",
                        "Warranty / recall cascade (SXAA read-across)",
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
                ]
            },
            {
                type: "text",
                title: "CP-2B-10 · Overall downside view",
                body: "No pathway breaks liquidity: P1 (worst) still leaves 14 months-to-empty and springing-covenant headroom. The danger is sequencing — P1 arriving while the 12-month MFN sunset is open invites a priming incremental at the bottom of the cycle.",
                ev: [
                    "E-77",
                    "E-64"
                ]
            }
        ]
    },
    "CP-2C": {
        kpis: [
            {
                l: "Catalysts on calendar",
                v: "9"
            },
            {
                l: "Next event",
                v: "Jul 28 · Q2-26"
            },
            {
                l: "Refi window",
                v: "Q3-26",
                sev: "warning"
            },
            {
                l: "Watchlist handoffs",
                v: "3"
            }
        ],
        sections: [
            {
                type: "table",
                title: "CP-2C-03 · Catalyst calendar (next 12 months)",
                cols: [
                    "Date",
                    "Event",
                    "Prob.",
                    "Impact",
                    "Route"
                ],
                align: [
                    0,
                    0,
                    1,
                    0,
                    0
                ],
                rows: [
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
                ]
            },
            {
                type: "text",
                title: "CP-2C-09 · Overall catalyst view",
                body: "Event risk is front-loaded into H2-26 reporting. The Q3-26 certificate is the thesis-defining print — it is wired to trigger T-1 and a CP-6A re-vote if add-back realization lands under $30M."
            }
        ]
    },
    "CP-2D": {
        kpis: [
            {
                l: "Sponsor behavior flags",
                v: "2",
                sev: "warning"
            },
            {
                l: "Disclosure quality",
                v: "B+"
            },
            {
                l: "Creditor alignment",
                v: "MODERATE"
            },
            {
                l: "Board independence",
                v: "1 of 7"
            }
        ],
        sections: [
            {
                type: "table",
                title: "CP-2D-04 · Sponsor behavior flags",
                cols: [
                    "Flag",
                    "Evidence",
                    "Severity"
                ],
                align: [
                    0,
                    0,
                    0
                ],
                rows: [
                    [
                        "Dividend recap history — 2 prior Kestrel portfolio cos within 24mo of refi",
                        "Fund V portfolio review",
                        "WARNING"
                    ],
                    [
                        "RP basket pre-positioning — builder already $240M with no stated use",
                        "Credit Agt §4.07 + cert",
                        "WARNING"
                    ],
                    [
                        "Fund VI close $4.2B — support capacity positive offset",
                        "Jun-26 press / LP letter",
                        "INFO"
                    ]
                ]
            },
            {
                type: "text",
                title: "CP-2D-12 · Overall governance view",
                body: "Kestrel is a competent operator with an extractive financial-policy record. Disclosure cadence is institutional-grade (monthly lender reporting), which partially offsets. Treat any RP-basket activation as a posture-changing event (T-4).",
                ev: [
                    "E-91"
                ]
            }
        ]
    },
    "CP-2E": {
        kpis: [
            {
                l: "Months-to-empty (base)",
                v: "19.3",
                sev: "ok"
            },
            {
                l: "RCF undrawn",
                v: "78%"
            },
            {
                l: "12-mo bridge",
                v: "+$96M",
                sev: "ok"
            },
            {
                l: "Springing test headroom",
                v: "28%"
            }
        ],
        sections: [
            {
                type: "table",
                title: "CP-2E-05 · 12-month liquidity bridge ($M)",
                cols: [
                    "",
                    "Amount"
                ],
                align: [
                    0,
                    1
                ],
                rows: [
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
                ]
            },
            {
                type: "text",
                title: "CP-2E-10 · Overall liquidity view",
                body: "Liquidity is a strength: 19.3 months-to-empty under base, 14.0 under the CP-2B P1 stress. No maturity inside 24 months; springing covenant tests only above 40% RCF utilization (currently 22%).",
                ev: [
                    "E-77"
                ]
            }
        ]
    },
    "CP-2F": {
        kpis: [
            {
                l: "Floating-rate share",
                v: "61%*",
                sev: "warning"
            },
            {
                l: "Confirmed hedges",
                v: "NONE",
                sev: "warning"
            },
            {
                l: "+100bps base rate",
                v: "−$12.1M FCF"
            },
            {
                l: "FX mismatch",
                v: "LOW"
            }
        ],
        sections: [
            {
                type: "flags",
                title: "Propagated limitation",
                items: [
                    {
                        sev: "warning",
                        text: "L-04: hedging register / swap confirms not provided — floating exposure modeled from SFA margins only (*). All figures on this tab carry the limitation downstream to CP-6A."
                    }
                ]
            },
            {
                type: "table",
                title: "CP-2F-02 · Debt rate exposure register",
                cols: [
                    "Instrument",
                    "Balance ($M)",
                    "Basis",
                    "Modeled hedge"
                ],
                align: [
                    0,
                    1,
                    0,
                    0
                ],
                rows: [
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
                ]
            },
            {
                type: "text",
                title: "CP-2F-10 · Overall macro view",
                body: "Rate sensitivity is the dominant macro channel: each +100bps costs ~$12.1M FCF (7% of LTM FCF) if truly unhedged. Commodity exposure is structurally pass-through with a 60–90 day lag. Resolution of gap G-01 (swap confirms) would likely improve this view."
            }
        ]
    },
    "CP-3": {
        kpis: [
            {
                l: "Final ranking",
                v: "2 of 7",
                sev: "ok"
            },
            {
                l: "Excess spread",
                v: "+38bps",
                sev: "ok"
            },
            {
                l: "Scorecard",
                v: "71 / 100"
            },
            {
                l: "Fair value band",
                v: "+325–340"
            }
        ],
        sections: [
            {
                type: "table",
                title: "CP-3-05 · Relative value table",
                cols: [
                    "Instrument",
                    "DM",
                    "Fair band",
                    "Excess",
                    "Rank"
                ],
                align: [
                    0,
                    1,
                    1,
                    1,
                    1
                ],
                rows: [
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
                ]
            },
            {
                type: "text",
                title: "CP-3-08 · Security selection conclusions",
                body: "Subject ranks 2/7 on the fundamental value matrix; Cascadia ranks above only on an unsecured-recovery adjustment the IC has historically discounted. Conviction is carry + deleveraging, not convergence: hold-to-maturity math clears the hurdle at +388 even with zero spread tightening.",
                ev: [
                    "E-71",
                    "E-44"
                ]
            }
        ]
    },
    "CP-3C": {
        kpis: [
            {
                l: "Sleeve fit",
                v: "PASS",
                sev: "ok"
            },
            {
                l: "Sector post-add",
                v: "6.1%"
            },
            {
                l: "B3-or-below bucket",
                v: "91%",
                sev: "warning"
            },
            {
                l: "Correlation cluster",
                v: "14%"
            }
        ],
        sections: [
            {
                type: "table",
                title: "CP-3C-05 · Concentration & correlation register",
                cols: [
                    "Constraint",
                    "Limit",
                    "Post-add",
                    "Headroom",
                    "Status"
                ],
                align: [
                    0,
                    1,
                    1,
                    1,
                    0
                ],
                rows: [
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
                ]
            },
            {
                type: "text",
                title: "CP-3C-10 · Overall portfolio fit view",
                body: "Initial 75bps fits all budgets. The binding constraint at max size (125bps) is the B3-or-below bucket — any add requires a same-day bucket headroom check, encoded in the CP-6E sizing constraint."
            }
        ]
    },
    "CP-3D": {
        kpis: [
            {
                l: "LME vulnerability",
                v: "4 / 10",
                sev: "ok"
            },
            {
                l: "Nearest maturity",
                v: "2027 RCF"
            },
            {
                l: "Refi need by 2029",
                v: "$1,970M"
            },
            {
                l: "Legal LME capacity",
                v: "OPEN",
                sev: "warning"
            }
        ],
        sections: [
            {
                type: "table",
                title: "CP-3D-02 · Maturity wall & refinancing register",
                cols: [
                    "Year",
                    "Instrument",
                    "Amount ($M)",
                    "Path assessment"
                ],
                align: [
                    0,
                    0,
                    1,
                    0
                ],
                rows: [
                    [
                        "2027",
                        "RCF commitment expiry",
                        "250",
                        "Extend H2-26 — relationship banks, likely +25–50bps"
                    ],
                    [
                        "2029",
                        "Term Loan B",
                        "1,850",
                        "Refinanceable in current market at ~SOFR+400"
                    ],
                    [
                        "2031",
                        "2L TL (subject)",
                        "900",
                        "Inside refi horizon post-deleveraging"
                    ],
                    [
                        "2032",
                        "Sub Notes",
                        "400",
                        "Candidate for discounted repurchase if px < 85"
                    ]
                ]
            },
            {
                type: "text",
                title: "CP-3D-12 · Overall refinancing & LME view",
                body: "Vulnerability 4/10: no near wall, real FCF, open market access. But legal capacity for an uptier exists ($612M incremental + open RP paths) — vulnerability re-rates to 7/10 if P1 stress coincides with the 2029 TLB approach.",
                ev: [
                    "E-63",
                    "E-64"
                ]
            }
        ]
    },
    "CP-0": {
        kpis: [
            {
                l: "Files classified",
                v: "14"
            },
            {
                l: "Gaps logged",
                v: "2",
                sev: "warning"
            },
            {
                l: "Unresolved conflicts",
                v: "0",
                sev: "ok"
            },
            {
                l: "Downstream readiness",
                v: "0.91",
                sev: "ok"
            }
        ],
        sections: [
            {
                type: "table",
                title: "CP-0-C/D · Document map & quality assignment",
                cols: [
                    "Doc",
                    "Name",
                    "Type",
                    "Grade",
                    "Handling"
                ],
                align: [
                    0,
                    0,
                    0,
                    0,
                    0
                ],
                rows: [
                    [
                        "D-01",
                        "Confidential Info Memo (2L TL '31)",
                        "CIM",
                        "A",
                        "—"
                    ],
                    [
                        "D-02",
                        "Senior Facilities Agreement",
                        "SFA",
                        "A",
                        "—"
                    ],
                    [
                        "D-03",
                        "2L Credit Agt (final)",
                        "Credit Agt",
                        "A",
                        "—"
                    ],
                    [
                        "D-04",
                        "FY23–FY25 Audited Financials",
                        "Audit",
                        "A",
                        "—"
                    ],
                    [
                        "D-05",
                        "Q1-26 Compliance Certificate",
                        "Covenant",
                        "A",
                        "—"
                    ],
                    [
                        "D-06",
                        "Lender Presentation",
                        "LP",
                        "B",
                        "MNPI"
                    ],
                    [
                        "D-07",
                        "Sponsor Model (extract)",
                        "Model",
                        "C",
                        "MNPI"
                    ]
                ]
            },
            {
                type: "flags",
                title: "CP-0-F/G · Gap & conflict log",
                items: [
                    {
                        sev: "warning",
                        text: "G-01: hedging register / swap confirms not provided — CP-2F routed in degraded mode (limitation L-04)."
                    },
                    {
                        sev: "low",
                        text: "G-02: Q4-25 management accounts missing — CP-1 instructed to construct derived period from sponsor model.",
                        ev: [
                            "E-58"
                        ]
                    },
                    {
                        sev: "ok",
                        text: "Conflict log: 0 unresolved — CIM vs audit tie-outs within tolerance at intake."
                    }
                ]
            },
            {
                type: "text",
                title: "CP-0-I · Downstream readiness",
                body: "Readiness 0.91 — all 24 analytical modules routable. Two gaps logged with degraded-mode instructions attached; neither is blocking. Master index updated; intake export assembled for CP-X."
            }
        ]
    },
    "CP-X": {
        kpis: [
            {
                l: "Modules in scope",
                v: "21"
            },
            {
                l: "Execution waves",
                v: "8"
            },
            {
                l: "Limitations propagated",
                v: "1",
                sev: "warning"
            },
            {
                l: "Ownership collisions",
                v: "0",
                sev: "ok"
            }
        ],
        sections: [
            {
                type: "table",
                title: "CP-X-02 · Module execution sequence",
                cols: [
                    "Wave",
                    "Modules",
                    "Gate condition"
                ],
                align: [
                    0,
                    0,
                    0
                ],
                rows: [
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
                ]
            },
            {
                type: "flags",
                title: "CP-X-06 · Limitation propagation register",
                items: [
                    {
                        sev: "warning",
                        text: "L-04 (from G-01): hedging register absent — CP-2F runs on SFA margins only; consumers CP-6A flagged to weight macro claims accordingly."
                    },
                    {
                        sev: "low",
                        text: "G-02 instruction: CP-1 derived Q4-25 carries [Analyst estimate] status; CP-1B told to caveat quarterly comparisons.",
                        ev: [
                            "E-58"
                        ]
                    }
                ]
            },
            {
                type: "text",
                title: "CP-X-07 · Route plan summary",
                body: "Full run authorized — status READY WITH LIMITATIONS. 24 modules sequenced across 8 waves with one-owner validation clean; CP-2F degraded mode is the only scope deviation. Route template v2.2, J1 join before governance layer."
            }
        ]
    },
    "CP-5": {
        kpis: [
            {
                l: "Modules audited",
                v: "21"
            },
            {
                l: "Citation defects",
                v: "1 HIGH",
                sev: "warning"
            },
            {
                l: "Math / logic defects",
                v: "0",
                sev: "ok"
            },
            {
                l: "Clearance",
                v: "CONDITIONAL",
                sev: "warning"
            }
        ],
        sections: [
            {
                type: "table",
                title: "CP-5-09 · Consolidated issue log",
                cols: [
                    "ID",
                    "Sev",
                    "Module",
                    "Finding",
                    "Status"
                ],
                align: [
                    0,
                    0,
                    0,
                    0,
                    0
                ],
                rows: [
                    [
                        "QA-117",
                        "HIGH",
                        "CP-1C",
                        "Citation E-44 — peer EBITDA margin set anchored to wrong page (CIM Annex C)",
                        "OPEN"
                    ],
                    [
                        "QA-121",
                        "LOW",
                        "CP-2C",
                        "Catalyst probability stated without basis — re-labeled [Analyst estimate]",
                        "RESOLVED"
                    ],
                    [
                        "QA-122",
                        "LOW",
                        "CP-3",
                        "RV table rounding (1dp) inconsistent with CP-1C alignment register",
                        "RESOLVED"
                    ]
                ]
            },
            {
                type: "flags",
                title: "CP-5-10 · Remediation priority map",
                items: [
                    {
                        sev: "critical",
                        text: "R-1 (blocks committee pack): re-anchor E-44 to conformed CIM p.391, re-run CP-1C metric alignment, then refresh CP-3 RV table and CP-6A weighting row 3.",
                        ev: [
                            "E-44"
                        ]
                    }
                ]
            },
            {
                type: "text",
                title: "CP-5-11 · Clearance decision",
                body: "CONDITIONAL — one HIGH citation defect open; math, legal, market and consistency audits clean across all 24 modules. CP-RENDER and CP-EXTRACT held until QA-117 remediation lands; no other gating findings."
            }
        ]
    },
    "CP-5B": {
        kpis: [
            {
                l: "Drivers traced",
                v: "5 / 5"
            },
            {
                l: "Avg lineage hops",
                v: "3.0"
            },
            {
                l: "Auditability",
                v: "STRONG",
                sev: "ok"
            },
            {
                l: "Weak-lineage flags",
                v: "1",
                sev: "warning"
            }
        ],
        sections: [
            {
                type: "table",
                title: "CP-5B-04 · Source lineage register (top-5 drivers)",
                cols: [
                    "#",
                    "Material driver",
                    "Lineage chain",
                    "Conf"
                ],
                align: [
                    0,
                    0,
                    0,
                    1
                ],
                rows: [
                    [
                        "1",
                        "EBITDA quality — add-backs 18.2%",
                        "D-01 p.214 → CP-1 calc reg K-09 → CP-4C add-back analysis",
                        "92%"
                    ],
                    [
                        "2",
                        "Top-3 OEM concentration 38%",
                        "D-01 p.97 → CP-1A operating model → CP-2B fragility F-2",
                        "95%"
                    ],
                    [
                        "3",
                        "$612M day-one incremental capacity",
                        "D-03 §4.09 → CP-4 incurrence reg → CP-4C capacity reg",
                        "97%"
                    ],
                    [
                        "4",
                        "FCF conversion 41%",
                        "D-04 p.31 → CP-1 KPI K-22 → CP-1C benchmark 04B",
                        "88%"
                    ],
                    [
                        "5",
                        "Peer margin citation E-44",
                        "D-01 Annex C → CP-1C alignment → CP-5 issue QA-117",
                        "41%"
                    ]
                ]
            },
            {
                type: "flags",
                title: "CP-5B-06 · Missing-citation & weak-lineage flags",
                items: [
                    {
                        sev: "warning",
                        text: "Driver #5 lineage terminates at a mismatched anchor — E-44 unresolved under QA-117; treated as weak lineage until re-anchored.",
                        ev: [
                            "E-44"
                        ]
                    }
                ]
            },
            {
                type: "text",
                title: "CP-5B-09 · Overall traceability view",
                body: "Four of five material drivers trace to grade-A sources within three hops; every figure in the committee pack resolves to a registered evidence ID. Auditability STRONG — the single weak chain is already on the CP-5 remediation map."
            }
        ]
    },
    "CP-6E": {
        kpis: [
            {
                l: "Initial size",
                v: "75bps"
            },
            {
                l: "Max size",
                v: "125bps"
            },
            {
                l: "Posture",
                v: "ADD-ON-WEAKNESS",
                sev: "ok"
            },
            {
                l: "Binding constraint",
                v: "B3 bucket",
                sev: "warning"
            }
        ],
        sections: [
            {
                type: "table",
                title: "CP-6E-07 · Allocation decision matrix",
                cols: [
                    "Contested point",
                    "RV Trader",
                    "Compliance",
                    "CIO ruling"
                ],
                align: [
                    0,
                    0,
                    0,
                    0
                ],
                rows: [
                    [
                        "Size at max immediately (+388 entry)",
                        "carry clears hurdle hold-to-maturity",
                        "B3-or-below bucket 91% utilized",
                        "start 75bps — max requires bucket headroom check"
                    ],
                    [
                        "RV signal validity",
                        "+48–63bps cheap vs fair band",
                        "band leans on open E-44",
                        "size off ex-E-44 band (+20–25bps) until QA-117 clears"
                    ],
                    [
                        "Correlation with auto/industrial cluster",
                        "different end-market mix vs SXAA",
                        "cluster at 14% of 16% limit",
                        "no concurrent adds with SXAA; monitor weekly"
                    ]
                ]
            },
            {
                type: "text",
                title: "CP-6E-10 · CIO final memo",
                body: "Approve 75bps initial at +388 or wider; standing limit order at +400bps. Path to 125bps max is gated on the Q3-26 add-back certificate (trigger T-1) and same-day B3-bucket headroom. Trim on RP-basket activation (T-4) or CP-3 re-rank below 4/7."
            }
        ]
    },
    "CP-3B": {
        kpis: [
            {
                l: "Preference",
                v: "2L TL over TLB",
                sev: "ok"
            },
            {
                l: "Recovery @ 6.0x stress",
                v: "21%"
            },
            {
                l: "Comp cross-check",
                v: "PASS",
                sev: "ok"
            },
            {
                l: "Monitoring triggers",
                v: "3"
            }
        ],
        sections: []
    },
    "CP-4": {
        kpis: [
            {
                l: "Aggressiveness",
                v: "7.2 / 10",
                sev: "warning"
            },
            {
                l: "Covenants registered",
                v: "41"
            },
            {
                l: "J.Crew / Chewy paths",
                v: "BLOCKED",
                sev: "ok"
            },
            {
                l: "Red flags",
                v: "2",
                sev: "warning"
            }
        ],
        sections: []
    },
    "CP-4C": {
        kpis: [
            {
                l: "Day-one capacity",
                v: "$612M",
                sev: "warning"
            },
            {
                l: "Springing headroom",
                v: "28%"
            },
            {
                l: "RP builder basket",
                v: "$240M",
                sev: "warning"
            },
            {
                l: "Nearest pressure point",
                v: "MFN Jun-27"
            }
        ],
        sections: []
    },
    "CP-6A": {
        kpis: [
            {
                l: "IC verdict",
                v: "CONSTRUCTIVE",
                sev: "ok"
            },
            {
                l: "Claims weighted",
                v: "5"
            },
            {
                l: "Action bias",
                v: "ADD on weakness"
            },
            {
                l: "Greatest uncertainty",
                v: "add-back realization",
                sev: "warning"
            }
        ],
        sections: []
    }
};
}),
"[project]/src/lib/reports/evidence.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// E-xx evidence registry for the Report Studio source viewer
// (port of design bundle shared/deal-modules.js EVIDENCE — entries cited by the 5 reports).
__turbopack_context__.s([
    "EVIDENCE",
    ()=>EVIDENCE
]);
const EVIDENCE = {
    "E-09": {
        doc: "D-01",
        page: 214,
        section: "Summary Historical Financials — Adjustments to EBITDA",
        status: "verified",
        conf: 0.93,
        module: "CP-1",
        excerpt: [
            {
                t: "The following table sets forth a reconciliation of net income to EBITDA and Adjusted EBITDA for the periods presented. Management believes Adjusted EBITDA provides investors with useful supplemental information regarding underlying operating performance."
            },
            {
                t: "Adjustments for the twelve months ended March 31, 2026 comprise: (i) $41.2 million of cost savings related to announced plant closures and footprint actions, a portion of which is reflected in run-rate results; (ii) $18.7 million of transaction, integration and advisory costs; (iii) $9.4 million of non-recurring operational items, including $4.1 million of warranty settlements; and (iv) $7.3 million of sponsor management fees.",
                hit: true
            },
            {
                t: "Aggregate adjustments of $76.6 million represent 18.2% of Adjusted EBITDA of $421.0 million for the LTM period."
            }
        ]
    },
    "E-12": {
        doc: "D-01",
        page: 97,
        section: "Business — Aftermarket & Services",
        status: "verified",
        conf: 0.95,
        module: "CP-1A",
        excerpt: [
            {
                t: "Our Aftermarket & Services segment supplies replacement components, remanufacturing and field services to an installed base of approximately 1.9 million units across more than 40 end markets."
            },
            {
                t: "For the twelve months ended March 31, 2026, Aftermarket & Services represented 23.4% of net revenue and approximately 44% of consolidated gross profit. Approximately 87% of segment revenue is generated under multi-year service agreements, which have historically renewed at rates in excess of 92%.",
                hit: true
            }
        ]
    },
    "E-15": {
        doc: "D-01",
        page: 99,
        section: "Business — Customers",
        status: "verified",
        conf: 0.95,
        module: "CP-1A",
        excerpt: [
            {
                t: "We maintain long-standing relationships with leading industrial OEMs, with average tenure among our top ten customers exceeding 18 years."
            },
            {
                t: "For the twelve months ended March 31, 2026, our three largest customers represented approximately 38% of net revenue, and our largest customer platform (Meridian) represented approximately 14% of net revenue. The Meridian platform agreement is subject to scheduled repricing in the second quarter of fiscal 2027.",
                hit: true
            },
            {
                t: "No other customer represented more than 5% of net revenue for the period."
            }
        ]
    },
    "E-22": {
        doc: "D-04",
        page: 31,
        section: "Consolidated Statements of Cash Flows — FY2025",
        status: "verified",
        conf: 0.91,
        module: "CP-1",
        excerpt: [
            {
                t: "Net cash provided by operating activities was $287.4 million for fiscal 2025, compared with $266.1 million in fiscal 2024."
            },
            {
                t: "Purchases of property, plant and equipment were $118.3 million (4.3% of net revenue), yielding free cash flow of $169.1 million — a conversion of 41% of Adjusted EBITDA, computed per the CP-1 calculation register K-22.",
                hit: true
            }
        ]
    },
    "E-31": {
        doc: "D-01",
        page: 98,
        section: "Business — Contracted Revenue & Renewal Rates",
        status: "verified",
        conf: 0.92,
        module: "CP-1A",
        excerpt: [
            {
                t: "Long-term agreements (LTAs) governing approximately 71% of OEM revenue include raw-material indexation mechanisms that adjust selling prices for changes in steel and alloy input costs, typically with a 60-to-90 day lag."
            },
            {
                t: "Aftermarket service agreements average 7 years in initial term. Over the last five fiscal years, renewal rates have averaged 92.4% by revenue, with pricing escalators of CPI or 3%, whichever is greater.",
                hit: true
            }
        ]
    },
    "E-44": {
        doc: "D-01",
        page: 388,
        section: "Annex C — Industry & Peer Data (UNRESOLVED)",
        status: "open",
        conf: 0.41,
        module: "CP-1C",
        qa: "QA-117 (HIGH): CP-1C cites 'Annex C, p.388' for the peer EBITDA margin set, but p.388 in the conformed CIM contains the auditor consent letter. The peer table appears at p.391 of the prior draft. Citation must be re-anchored to the conformed document before clearance.",
        excerpt: [
            {
                t: "[p.388 — conformed CIM] CONSENT OF INDEPENDENT REGISTERED PUBLIC ACCOUNTING FIRM. We hereby consent to the inclusion in this Confidential Info Memo of our report dated February 12, 2026…",
                hit: true
            },
            {
                t: "[expected content — peer margin benchmark table] Not present at the cited anchor. CP-5 remediation: re-extract Annex C table coordinates from conformed CIM and re-run CP-1C metric alignment."
            }
        ]
    },
    "E-58": {
        doc: "D-07",
        page: 6,
        section: "Sponsor Model Extract — EBITDA Bridge FY26E",
        status: "verified",
        conf: 0.61,
        module: "CP-1B",
        excerpt: [
            {
                t: "[Source grade C — sponsor-prepared, unaudited] FY26E bridge: FY25 Adj. EBITDA $415M → volume/mix +$22M → pricing net of inflation +$14M → cost-out program +$38M → FY26E $489M."
            },
            {
                t: "CP-1B variance: Q1-26 actuals track $108M vs model $112.7M (−4.2%). Shortfall concentrated in Fluid Systems volume (−$3.1M) and cost-out phasing (−$1.6M). Conflict logged; model treated as upside case only.",
                hit: true
            }
        ]
    },
    "E-63": {
        doc: "D-03",
        page: 162,
        section: "Credit Agt §4.09(b)(14) — Incremental Debt Capacity",
        status: "verified",
        conf: 0.97,
        module: "CP-4",
        excerpt: [
            {
                t: "…(14) Indebtedness in an aggregate principal amount not to exceed the greater of $150.0 million and 35% of Consolidated EBITDA, plus unlimited additional amounts so long as, on a pro forma basis, the Consolidated Secured Leverage Ratio does not exceed 5.25 to 1.00…",
                hit: true
            },
            {
                t: "CP-4C capacity register: freebie $150M (grower to $147M ≈ 35% × $421M) + ratio capacity $310M at current Secured Leverage of 4.68x + reclassification headroom $155M = $612M day-one, incurrable senior or pari to the 2L TL."
            }
        ]
    },
    "E-64": {
        doc: "D-03",
        page: 164,
        section: "Credit Agt §4.09(d) — MFN Protection & Sunset",
        status: "verified",
        conf: 0.96,
        module: "CP-4",
        excerpt: [
            {
                t: "…provided that, with respect to any Incremental Equivalent Debt incurred under clause (b)(14) that is secured on a pari passu basis and incurred within 12 months of the Issue Date, the All-in Yield shall not exceed the All-in Yield of the Term Loans by more than 50 basis points unless the interest rate on the Term Loans is increased accordingly…",
                hit: true
            },
            {
                t: "Translation: MFN protection applies only to pari incremental debt and only for 12 months. After June 2027, a priming or pari raise carries no yield protection for 2L lenders."
            }
        ]
    },
    "E-71": {
        doc: "MKT",
        page: null,
        section: "Desk Marks & LoanX Prints — Jun 8, 2026",
        status: "verified",
        conf: 0.84,
        module: "CP-1C",
        excerpt: [
            {
                t: "ATLF S+425 '31 last LoanX mark 96.40 (Jun 8, 14:21 ET), $4.2M institutional. Two-way desk markets 96.25 / 96.75. Discount margin +388bps (3Y) at the mark."
            },
            {
                t: "CP-1C fair-value band construction: B2 industrial 2L cohort regression (margin, FCF conversion, leverage, docs score) implies +325–340bps for the subject's fundamental profile — subject trades +48–63bps cheap to model.",
                hit: true
            }
        ]
    },
    "E-77": {
        doc: "D-04",
        page: 44,
        section: "Liquidity & Capital Resources",
        status: "verified",
        conf: 0.88,
        module: "CP-2E",
        excerpt: [
            {
                t: "As of March 31, 2026, we had $184.3 million of cash and cash equivalents and $195.0 million of undrawn availability under our Revolving Credit Facility, net of $12.4 million of outstanding letters of credit."
            },
            {
                t: "CP-2E months-to-empty: base case 19.3 months (bridge +$96M over 12 months). Under CP-2B pathway P1 (Drivetrain −12% over 2 quarters), months-to-empty compresses to 14.0 with the springing covenant untested.",
                hit: true
            }
        ]
    },
    "E-87": {
        doc: "D-04",
        page: 58,
        section: "Notes to Financials — Restructuring & Other Charges (FY22–FY25)",
        status: "verified",
        conf: 0.9,
        module: "CP-1",
        excerpt: [
            {
                t: "Restructuring and other charges were $31.2 million, $28.7 million, $9.1 million and $33.4 million for fiscal years 2022 through 2025, respectively, primarily comprising severance, facility exit costs and third-party consulting fees."
            },
            {
                t: "CP-1 observation: 'one-time' operational charges have recurred in 3 of the last 4 fiscal years, averaging $25.6M (≈ 6% of EBITDA) — supporting the bear adjustment that a portion of add-backs is structural.",
                hit: true
            }
        ]
    },
    "E-91": {
        doc: "D-06",
        page: 12,
        section: "Lender Presentation — Sponsor Overview",
        status: "verified",
        conf: 0.79,
        module: "CP-2D",
        excerpt: [
            {
                t: "Kestrel Capital Partners closed Fund VI at $4.2 billion in June 2026 (vs $3.1B Fund V), with industrials representing its largest sector allocation at 38% of deployed capital."
            },
            {
                t: "CP-2D translation: fresh fund capacity is a support-positive (follow-on equity available); offset by Kestrel's record of dividend recapitalizations at two Fund IV portfolio companies within 24 months of a refinancing window.",
                hit: true
            }
        ]
    },
    "E-103": {
        doc: "D-05",
        page: 3,
        section: "Q1-26 Compliance Certificate — Covenant Calculations",
        status: "verified",
        conf: 0.98,
        module: "CP-1",
        excerpt: [
            {
                t: "The undersigned, as an Authorized Officer of Atlas Forge Intermediate Holdings, Inc., hereby certifies that as of the Fiscal Quarter ended March 31, 2026: (a) Consolidated First Lien Net Leverage Ratio: 4.68:1.00; (b) Consolidated Total Net Leverage Ratio: 5.68:1.00; (c) no Default or Event of Default has occurred and is continuing.",
                hit: true
            },
            {
                t: "Covenant EBITDA of $421.4M includes $41.0M of run-rate cost savings under SFA §1.01 'Consolidated EBITDA' clause (k) — confirming the realization claimed for closed-plant actions within the capped SFA definition."
            }
        ]
    }
};
}),
"[project]/src/lib/evidence-sync.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EvidenceSyncProvider",
    ()=>EvidenceSyncProvider,
    "useEvidenceSync",
    ()=>useEvidenceSync
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// Cross-pane "Evidence Sync" selection store (Blueprint §4). A single focused
// evidence id is shared across the Deep-Dive: hovering or focusing any E-xx
// chip publishes its id; every other chip with that id — and every CP-5B source
// driver that cites it — subscribes and highlights, so a claim lights up its
// own provenance across panes. Panes stay decoupled: none calls another
// directly, they only publish/subscribe to this id.
//
// The default context is inert (no-op setter), so EvChip works unchanged on
// pages that don't mount the provider — the sync only activates under it.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
const Ctx = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])({
    active: null,
    setActive: ()=>{}
});
function useEvidenceSync() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(Ctx);
}
function EvidenceSyncProvider({ children, initialActive = null }) {
    const [active, setActive] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(initialActive);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>setActive(initialActive), [
        initialActive
    ]);
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>({
            active,
            setActive
        }), [
        active
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Ctx.Provider, {
        value: value,
        children: children
    }, void 0, false, {
        fileName: "[project]/src/lib/evidence-sync.tsx",
        lineNumber: 31,
        columnNumber: 10
    }, this);
}
}),
"[project]/src/lib/pipeline/sev.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Severity / state → CSS color utilities. Shared widely across the UI (status
// dots, tags, cards, tranche chips) — kept separate from the sim engine so
// color-only consumers don't transitively depend on the React sim hook and the
// CP-X module data. Pure, no React.
__turbopack_context__.s([
    "SEV_COLOR",
    ()=>SEV_COLOR,
    "isCleared",
    ()=>isCleared,
    "moduleLiveState",
    ()=>moduleLiveState,
    "sevSurface",
    ()=>sevSurface,
    "sevVar",
    ()=>sevVar
]);
const SEV_COLOR = {
    // high = the sanctioned bright-critical token; the old hardcoded #fb7185 was
    // an undocumented near-twin of --caos-critical-bright (#f87171).
    critical: "var(--caos-critical)",
    high: "var(--caos-critical-bright)",
    warning: "var(--caos-warning)",
    medium: "var(--caos-warning)",
    ok: "var(--caos-success)",
    pass: "var(--caos-success)",
    low: "var(--caos-muted)",
    info: "var(--caos-accent)",
    running: "var(--caos-accent)",
    idle: "var(--caos-idle)",
    held: "var(--caos-warning)",
    blocked: "var(--caos-critical)",
    queued: "#52525e",
    clear: "var(--caos-success)",
    conditional: "var(--caos-warning)"
};
const isCleared = (state)=>state === "pass" || state === "warning";
const moduleLiveState = (qaStatus)=>{
    if (qaStatus === undefined) return "idle";
    if (qaStatus === "Blocked") return "failed";
    if (qaStatus === "Restricted") return "warning";
    if (qaStatus === "Not Reviewed") return "not-reviewed";
    return "pass";
};
const sevVar = (sev)=>SEV_COLOR[sev] || "var(--caos-idle)";
function sevSurface(sev, opts) {
    const c = sevVar(sev);
    const border = opts?.border ?? 38;
    const wash = opts?.wash ?? 10;
    return {
        color: c,
        borderColor: `color-mix(in srgb, ${c} ${border}%, transparent)`,
        background: `color-mix(in srgb, ${c} ${wash}%, transparent)`
    };
}
}),
"[project]/src/components/shared/StatusGlyph.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Shared monochrome glyph set — replaces colored emoji in product chrome
// (e.g. the lock in the Deep-Dive module launcher) with drawn marks that
// inherit currentColor and sit in the same geometric vocabulary as the rest of
// the terminal. Honors `.impeccable.md`: no emoji in product chrome.
// Phase 0 foundation.
__turbopack_context__.s([
    "StatusGlyph",
    ()=>StatusGlyph
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
function StatusGlyph({ kind, size = 9, className = "" }) {
    if (kind === "locked") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            viewBox: "0 0 12 12",
            width: size,
            height: size,
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.2,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
            className: "shrink-0" + (className ? " " + className : ""),
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                    x: "2.4",
                    y: "5.4",
                    width: "7.2",
                    height: "4.8",
                    rx: "1"
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/StatusGlyph.tsx",
                    lineNumber: 30,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                    d: "M4 5.4V4.1a2 2 0 0 1 4 0v1.3"
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/StatusGlyph.tsx",
                    lineNumber: 31,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/shared/StatusGlyph.tsx",
            lineNumber: 18,
            columnNumber: 7
        }, this);
    }
    if (kind === "warning") {
        // Warning triangle — replaces the ⚠ emoji; inherits currentColor and sits
        // inline next to text (verticalAlign nudge), so the existing warning/critical
        // color still carries the semantic, now paired with a controlled glyph.
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            viewBox: "0 0 12 12",
            width: size,
            height: size,
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.2,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            "aria-hidden": "true",
            className: "inline-block shrink-0" + (className ? " " + className : ""),
            style: {
                verticalAlign: "-0.12em"
            },
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                    d: "M6 1.7 11.1 10.5H0.9z"
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/StatusGlyph.tsx",
                    lineNumber: 53,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                    d: "M6 5v2.3"
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/StatusGlyph.tsx",
                    lineNumber: 54,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                    d: "M6 9h.01"
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/StatusGlyph.tsx",
                    lineNumber: 55,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/shared/StatusGlyph.tsx",
            lineNumber: 40,
            columnNumber: 7
        }, this);
    }
    // Severity/state glyphs so a status dot's meaning is never carried by color
    // alone (Dot pairs these with its color). All inherit currentColor, share the
    // 12×12 box, and sit inline next to text.
    const base = {
        viewBox: "0 0 12 12",
        width: size,
        height: size,
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.3,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true,
        className: "inline-block shrink-0" + (className ? " " + className : ""),
        style: {
            verticalAlign: "-0.12em"
        }
    };
    if (kind === "success") {
        // check mark — pass / cleared
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            ...base,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M2.4 6.3 5 8.9 9.6 3.4"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/StatusGlyph.tsx",
                lineNumber: 77,
                columnNumber: 27
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/shared/StatusGlyph.tsx",
            lineNumber: 77,
            columnNumber: 12
        }, this);
    }
    if (kind === "critical" || kind === "blocked") {
        // ✕ in a ring — critical / blocked
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            ...base,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                    cx: "6",
                    cy: "6",
                    r: "4.4"
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/StatusGlyph.tsx",
                    lineNumber: 81,
                    columnNumber: 27
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                    d: "M4.3 4.3 7.7 7.7M7.7 4.3 4.3 7.7"
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/StatusGlyph.tsx",
                    lineNumber: 81,
                    columnNumber: 59
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/shared/StatusGlyph.tsx",
            lineNumber: 81,
            columnNumber: 12
        }, this);
    }
    if (kind === "running") {
        // open arc — in progress (pairs with the pulse on live nodes)
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            ...base,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                    d: "M10 6a4 4 0 1 1-1.2-2.85"
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/StatusGlyph.tsx",
                    lineNumber: 85,
                    columnNumber: 27
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                    d: "M10 2.2V4.4H7.8"
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/StatusGlyph.tsx",
                    lineNumber: 85,
                    columnNumber: 64
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/shared/StatusGlyph.tsx",
            lineNumber: 85,
            columnNumber: 12
        }, this);
    }
    if (kind === "held") {
        // pause bars — held
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            ...base,
            strokeWidth: 1.6,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M4.3 3.2v5.6M7.7 3.2v5.6"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/StatusGlyph.tsx",
                lineNumber: 89,
                columnNumber: 45
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/shared/StatusGlyph.tsx",
            lineNumber: 89,
            columnNumber: 12
        }, this);
    }
    if (kind === "idle") {
        // hollow dot — idle / queued / not produced
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            ...base,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: "6",
                cy: "6",
                r: "3.4"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/StatusGlyph.tsx",
                lineNumber: 93,
                columnNumber: 27
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/shared/StatusGlyph.tsx",
            lineNumber: 93,
            columnNumber: 12
        }, this);
    }
    return null;
}
}),
"[project]/src/components/pipeline/atoms.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Bar",
    ()=>Bar,
    "Dot",
    ()=>Dot,
    "SimControls",
    ()=>SimControls,
    "Tag",
    ()=>Tag,
    "ToggleGroup",
    ()=>ToggleGroup
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/sev.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/StatusGlyph.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
// Severity → the StatusGlyph kind that draws its shape, so a status can be read
// without relying on the dot color alone. Severities that share a glyph map to
// the same mark (high/medium → warning, pass/ok/clear → success).
const SEV_GLYPH = {
    critical: "critical",
    blocked: "blocked",
    high: "warning",
    warning: "warning",
    medium: "warning",
    conditional: "warning",
    held: "held",
    ok: "success",
    pass: "success",
    clear: "success",
    running: "running",
    info: "running",
    low: "idle",
    idle: "idle",
    queued: "idle"
};
function Dot({ sev, pulse, glyph }) {
    const s = sev || "idle";
    const color = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["sevVar"])(s);
    if (glyph) {
        const kind = SEV_GLYPH[s] ?? "idle";
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            "aria-hidden": "true",
            className: "inline-flex shrink-0 " + (pulse ? "caos-running" : ""),
            style: {
                color
            },
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                kind: kind,
                size: 10
            }, void 0, false, {
                fileName: "[project]/src/components/pipeline/atoms.tsx",
                lineNumber: 34,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/pipeline/atoms.tsx",
            lineNumber: 29,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        "aria-hidden": "true",
        className: "inline-block w-1.5 h-1.5 rounded-full shrink-0 " + (pulse ? "caos-running" : ""),
        style: {
            background: color
        }
    }, void 0, false, {
        fileName: "[project]/src/components/pipeline/atoms.tsx",
        lineNumber: 39,
        columnNumber: 5
    }, this);
}
function Tag({ sev, children }) {
    const s = sev || "idle";
    const { color: c, borderColor, background } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["sevSurface"])(s);
    const isIdle = s === "idle" || s === "queued" || c === "var(--caos-idle)";
    const textColor = isIdle ? "var(--caos-muted)" : c;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "tabular text-caos-xs uppercase tracking-wider px-1.5 py-px rounded border inline-flex items-center gap-1 whitespace-nowrap",
        style: {
            color: textColor,
            borderColor,
            background
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/pipeline/atoms.tsx",
        lineNumber: 53,
        columnNumber: 5
    }, this);
}
function Bar({ pct, color = "var(--caos-accent)", h = 3 }) {
    const safePct = typeof pct === "number" && !isNaN(pct) && isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
    const safeHeight = typeof h === "number" && !isNaN(h) && h >= 0 ? h : 3;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "w-full rounded-full overflow-hidden",
        style: {
            height: safeHeight,
            background: "var(--caos-border)"
        },
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "h-full rounded-full transition-caos",
            style: {
                width: safePct + "%",
                background: color
            }
        }, void 0, false, {
            fileName: "[project]/src/components/pipeline/atoms.tsx",
            lineNumber: 67,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/pipeline/atoms.tsx",
        lineNumber: 66,
        columnNumber: 5
    }, this);
}
function ToggleGroup({ options, value, onChange, size = "md", className = "" }) {
    if (!options || !Array.isArray(options)) return null;
    const pad = size === "sm" ? "text-caos-sm px-2.5 py-[7px]" : "text-caos-md px-3 py-1.5";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center rounded border border-caos-border overflow-hidden " + className,
        role: "group",
        "aria-label": "Toggle options",
        children: options.map((o)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>onChange(o.k),
                title: o.title,
                "aria-label": o.title || o.l,
                "aria-pressed": value === o.k,
                className: "tabular whitespace-nowrap transition-caos focus-ring " + pad + (value === o.k ? " bg-caos-elevated text-caos-text" : " text-caos-muted hover:text-caos-text"),
                children: o.l
            }, String(o.k), false, {
                fileName: "[project]/src/components/pipeline/atoms.tsx",
                lineNumber: 98,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/src/components/pipeline/atoms.tsx",
        lineNumber: 92,
        columnNumber: 5
    }, this);
}
const SPEED_OPTIONS = [
    1,
    2,
    4
];
function SimControls({ run }) {
    if (!run || !run.sim) return null;
    const isPlaying = !!run.playing;
    const isDone = !!run.sim.done;
    const currentSpeed = run.speed ?? 1;
    // At completion, ▶ replays from the top (run.reset restarts and autoplays) —
    // otherwise the button silently does nothing once the sim is done, since the
    // step loop is gated on !sim.done. Mid-run it toggles play/pause as usual.
    const playPauseTitle = isDone ? "Replay simulation" : isPlaying ? "Pause simulation" : "Play simulation";
    const onPlayPause = ()=>isDone ? run.reset() : run.setPlaying(!isPlaying);
    const showPause = isPlaying && !isDone;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center gap-1.5",
        role: "toolbar",
        "aria-label": "Simulation Controls",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: onPlayPause,
                className: "w-6 h-6 rounded border border-caos-border bg-caos-elevated flex items-center justify-center text-caos-text hover:border-caos-accent/60 transition-caos focus-ring",
                title: playPauseTitle,
                "aria-label": playPauseTitle,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                    viewBox: "0 0 16 16",
                    "aria-hidden": "true",
                    className: "w-3 h-3 fill-current",
                    children: showPause ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                                x: "4",
                                y: "3",
                                width: "3",
                                height: "10",
                                rx: "0.5"
                            }, void 0, false, {
                                fileName: "[project]/src/components/pipeline/atoms.tsx",
                                lineNumber: 146,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                                x: "9",
                                y: "3",
                                width: "3",
                                height: "10",
                                rx: "0.5"
                            }, void 0, false, {
                                fileName: "[project]/src/components/pipeline/atoms.tsx",
                                lineNumber: 147,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                        d: "M5 3.2v9.6a.6.6 0 0 0 .92.5l7.4-4.8a.6.6 0 0 0 0-1L5.92 2.7A.6.6 0 0 0 5 3.2Z"
                    }, void 0, false, {
                        fileName: "[project]/src/components/pipeline/atoms.tsx",
                        lineNumber: 150,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/components/pipeline/atoms.tsx",
                    lineNumber: 143,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/pipeline/atoms.tsx",
                lineNumber: 136,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: run.reset,
                className: "w-6 h-6 rounded border border-caos-border bg-caos-elevated flex items-center justify-center text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring",
                title: "Reset run",
                "aria-label": "Reset run",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                    viewBox: "0 0 16 16",
                    "aria-hidden": "true",
                    className: "w-3.5 h-3.5 stroke-current",
                    fill: "none",
                    strokeWidth: "1.6",
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                            d: "M12.5 5.5A5 5 0 1 0 13 9"
                        }, void 0, false, {
                            fileName: "[project]/src/components/pipeline/atoms.tsx",
                            lineNumber: 162,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                            d: "M12.7 2.6v3h-3"
                        }, void 0, false, {
                            fileName: "[project]/src/components/pipeline/atoms.tsx",
                            lineNumber: 163,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/pipeline/atoms.tsx",
                    lineNumber: 161,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/pipeline/atoms.tsx",
                lineNumber: 154,
                columnNumber: 7
            }, this),
            SPEED_OPTIONS.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    type: "button",
                    onClick: ()=>run.setSpeed(s),
                    className: "tabular text-caos-md px-1.5 h-6 rounded border transition-caos focus-ring " + (currentSpeed === s ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text"),
                    "aria-label": `Speed ${s}x`,
                    "aria-pressed": currentSpeed === s,
                    children: [
                        s,
                        "×"
                    ]
                }, s, true, {
                    fileName: "[project]/src/components/pipeline/atoms.tsx",
                    lineNumber: 167,
                    columnNumber: 9
                }, this))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/pipeline/atoms.tsx",
        lineNumber: 135,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/components/deepdive/IssuerChat.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "IssuerChat",
    ()=>IssuerChat,
    "caosChatContext",
    ()=>caosChatContext
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// ATLF issuer Q&A chat (port of design bundle concept-c-chat.jsx).
// Launched from the module output panel header; grounded in run #2641 module
// outputs. The grounding context travels as the first user message; the
// backend /api/chat/issuer endpoint forwards the conversation to Claude.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/CloseButton.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$TextInput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/TextInput.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/reports/deal.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/data.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$module$2d$outputs$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/deepdive/module-outputs.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$evidence$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/reports/evidence.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$evidence$2d$sync$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/evidence-sync.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/pipeline/atoms.tsx [app-ssr] (ecmascript)");
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
const flatSection = (s)=>{
    if (s.type === "table") return s.title + " — " + s.rows.map((r)=>r.join(" | ")).join(" ; ");
    if (s.type === "flags") return s.title + " — " + s.items.map((f)=>"[" + f.sev + "] " + f.text).join(" ; ");
    return s.title + " — " + s.body;
};
// Cross-pane Evidence Sync: ground the answer in the exact evidence the analyst
// is pointing at, so deictic questions ("is this a problem?") resolve correctly.
function focusLine(focusEv) {
    const ev = focusEv ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$evidence$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["EVIDENCE"][focusEv] : null;
    if (!focusEv || !ev) return null;
    const hit = ev.excerpt.find((e)=>e.hit) || ev.excerpt[0];
    return "ANALYST IS POINTING AT EVIDENCE " + focusEv + " — " + ev.section + " · " + ev.doc + (ev.page ? " p." + ev.page : "") + " · extracted by " + ev.module + " · status " + ev.status + (ev.qa ? " · QA: " + ev.qa : "") + (hit ? '. Cited passage: "' + hit.t.slice(0, 280) + '"' : "") + '. If the question says "this"/"it"/"that", it most likely refers to this.';
}
// Live path: a real run exists → ground STRICTLY in this issuer's own engine
// outputs (the adapted live module register + committee review), never the ATLF
// reference fixtures, which describe a different deal. This is what keeps the
// assistant honest on a non-reference issuer.
function liveContext(tab, live, issuerName, focusEv) {
    const mod = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MODULES"].find((m)=>m.id === tab);
    const lines = [
        "You are the Credit OS analyst assistant. You answer follow-up questions about ONE issuer for a credit analyst, grounded ONLY in the LIVE engine run outputs below (run " + live.runId + "). Never invent figures.",
        "Style: terse desk-note tone, under 150 words, plain text (no markdown headers). Cite module codes (CP-x) and evidence ids (E-xx) where they support a point. If the answer isn't in the data, say so and name the module that would produce it.",
        "",
        "ISSUER: " + (issuerName || "this issuer") + ". Committee status: " + (live.committeeStatus || "—") + "."
    ];
    if (live.council.length) {
        lines.push("COMMITTEE REVIEW (CP-5C): " + live.council.slice(0, 8).map((f)=>"[" + f.severity + "] " + f.description).join("; "));
    }
    // The current tab's module first, then the rest of the live register.
    const ids = Object.keys(live.liveOuts).sort((a, b)=>a === tab ? -1 : b === tab ? 1 : 0);
    for (const id of ids){
        const o = live.liveOuts[id];
        const kp = o.kpis.map((k)=>k.l + " " + k.v).join(", ");
        const body = o.sections.map(flatSection).join(" ; ");
        lines.push(id + (id === tab ? " (CURRENTLY VIEWING)" : "") + ": " + kp + (body ? " — " + body : ""));
    }
    // Only assert a specific view when we actually have one — a generic launcher
    // (Model/Pipeline/profile) passes no tab, so don't fabricate a module name.
    if (tab) lines.push("USER IS CURRENTLY VIEWING: " + tab + (mod ? " — " + mod.name : "") + ".");
    const fl = focusLine(focusEv);
    if (fl) lines.push(fl);
    return lines.join("\n");
}
function caosChatContext(tab, focusEv, live, issuerName) {
    if (live?.runId) return liveContext(tab, live, issuerName, focusEv);
    if (live) {
        const mod = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MODULES"].find((m)=>m.id === tab);
        const lines = [
            "You are the Credit OS analyst assistant. No completed issuer-specific run is available.",
            "Do not use Atlas Forge reference figures. Tell the analyst to run the issuer or open the reference demo for sample data.",
            "ISSUER: " + (issuerName || "this issuer") + "."
        ];
        if (tab) lines.push("USER IS CURRENTLY VIEWING: " + tab + (mod ? " — " + mod.name : "") + ".");
        return lines.join("\n");
    }
    // Fixture path (reference deal / no live run): the rich ATLF reference context.
    const mod = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MODULES"].find((m)=>m.id === tab);
    const out = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$deepdive$2f$module$2d$outputs$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MODULE_OUTPUTS"][tab];
    const lines = [
        "You are the Credit OS analyst assistant. You answer follow-up questions about ONE issuer for a credit analyst, grounded ONLY in the module outputs below (run #2641, all figures mock).",
        "Style: terse desk-note tone, under 150 words, plain text (no markdown headers). Cite module codes (CP-x) and evidence ids (E-xx) where they support a point. If the answer isn't in the data, say so and name the module that would produce it. Never invent figures.",
        "",
        "ISSUER: " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].name + " (" + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].code + ") — " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].sector + ". " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].sponsor + ". Rating " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].rating + ". LTM adj. EBITDA $" + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].ebitda + "M, net leverage " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].netLev + "x.",
        "DEAL: " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].deal + ".",
        "THESIS (CP-6A): " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEBATE"].thesis,
        "IC VERDICT: " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEBATE"].bias + ". Single greatest uncertainty: " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEBATE"].uncertainty,
        "CHAIR MEMO: " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEBATE"].memo,
        "SIZING (CP-6E): " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIZING"].decision + " — initial " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIZING"].initial + ", max " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIZING"].max + ", entry " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIZING"].entry + ". Constraint: " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SIZING"].constraint,
        "CLEARANCE (CP-5): CONDITIONAL — QA-117 (HIGH) open, citation E-44 page mismatch; committee pack held, debate verdict stands ex-E-44.",
        "CAPITAL STRUCTURE ($M claims): " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CAPSTACK"].map((c)=>c.cls + " " + c.claim).join(", ") + ".",
        "RECOVERY (CP-3B): " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["RECOVERY"].map((s)=>s.scen + " " + s.mult + "×$" + s.ebitda + "M=$" + s.ev + "M EV").join("; ") + ". Claims 1L $1,970 / 2L $900 / Sub $400. Market-implied 2L recovery ≈38% at px 96.4.",
        "COVENANTS (CP-4/4C): " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["COVENANTS"].map((c)=>c.name + " (agg " + c.agg + "/10, " + c.headroom + ")").join("; ") + ". Day-one incremental $" + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CAPACITY"].incDebt + "M; RP usable $" + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CAPACITY"].rpToday + "M; add-backs " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CAPACITY"].addbackPct + "% of adj. Nearest pressure: " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CAPACITY"].nearest,
        "TRIGGERS (CP-MON): " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TRIGGERS"].map((t)=>t.id + " " + t.text + " → " + t.owner).join("; "),
        "EVIDENCE DRIVERS (CP-5B): " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$data$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DRIVERS"].map((d)=>"#" + d.n + " " + d.driver + " [" + d.status + ", conf " + Math.round(d.conf * 100) + "%]").join("; "),
        "",
        "USER IS CURRENTLY VIEWING: " + tab + (mod ? " — " + mod.name : "") + "."
    ];
    const fl = focusLine(focusEv);
    if (fl) lines.push(fl);
    if (out) lines.push("CURRENT MODULE OUTPUTS:\n" + out.sections.map(flatSection).join("\n"));
    return lines.join("\n");
}
const CAOS_CHAT_STARTERS = [
    "Why is clearance conditional?",
    "Summarize the bear case in 3 bullets",
    "What trips trigger T-1?",
    "Is +388bps enough for the priming risk?"
];
function IssuerChat({ tab, onClose, live, issuerName }) {
    // Keep transcripts tab-scoped so sensitive analyst questions do not persist
    // on a shared workstation after the browser session ends.
    const cacheKey = "caos-chat-" + (live?.runId || "atlf-2641");
    const label = live?.runId ? issuerName || "this issuer" : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEAL"].code;
    const runLabel = live?.runId ? "run " + live.runId.slice(0, 8) : "RUN #2641";
    const [msgs, setMsgs] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(()=>{
        try {
            return JSON.parse(sessionStorage.getItem(cacheKey) || "[]") || [];
        } catch  {
            return [];
        }
    });
    const [input, setInput] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [loadedCacheKey, setLoadedCacheKey] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(cacheKey);
    const requestGeneration = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(0);
    const scrollRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const inputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Evidence Sync is hover-transient; keep the most recent focused evidence so
    // the assistant stays grounded in it after the pointer moves to the input.
    const { active } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$evidence$2d$sync$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEvidenceSync"])();
    const [focusEv, setFocusEv] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (active) setFocusEv(active);
    }, [
        active
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        requestGeneration.current += 1;
        let restored = [];
        try {
            restored = JSON.parse(sessionStorage.getItem(cacheKey) || "[]") || [];
        } catch  {}
        setMsgs(restored);
        setInput("");
        setBusy(false);
        setLoadedCacheKey(cacheKey);
    }, [
        cacheKey
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (loadedCacheKey !== cacheKey) return;
        try {
            sessionStorage.setItem(cacheKey, JSON.stringify(msgs));
        } catch  {}
    }, [
        cacheKey,
        loadedCacheKey,
        msgs
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [
        msgs,
        busy
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        inputRef.current?.focus();
    }, []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const h = (e)=>{
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", h);
        return ()=>window.removeEventListener("keydown", h);
    }, [
        onClose
    ]);
    const send = async (text)=>{
        const q = (text || input).trim();
        if (!q || busy) return;
        setInput("");
        const next = [
            ...msgs,
            {
                role: "user",
                content: q
            }
        ];
        const generation = requestGeneration.current;
        setMsgs(next);
        setBusy(true);
        try {
            const payload = [
                {
                    role: "user",
                    content: caosChatContext(tab, focusEv, live, issuerName)
                },
                {
                    role: "assistant",
                    content: "Understood. I'll answer strictly from " + runLabel + " outputs for " + label + ", citing CP-x / E-xx."
                },
                ...next.slice(-12).map(({ role, content })=>({
                        role,
                        content
                    }))
            ];
            const reply = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["askIssuer"])(payload);
            if (generation !== requestGeneration.current) return;
            setMsgs((m)=>[
                    ...m,
                    {
                        role: "assistant",
                        content: String(reply || "").trim() || "(no response)"
                    }
                ]);
        } catch (e) {
            if (generation !== requestGeneration.current) return;
            const detail = e?.response?.data?.detail || e?.message || "rate-limited or offline";
            setMsgs((m)=>[
                    ...m,
                    {
                        role: "assistant",
                        content: "Chat call failed (" + detail + "). Try again.",
                        err: true
                    }
                ]);
        } finally{
            if (generation !== requestGeneration.current) return;
            setBusy(false);
            inputRef.current?.focus();
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        role: "dialog",
        "aria-modal": false,
        "aria-label": label + " · Issuer Q&A",
        className: "fixed bottom-3 right-3 z-30 caos-enter flex flex-col bg-caos-panel border border-caos-accent/60 rounded-md overflow-hidden",
        style: {
            width: 408,
            height: 560,
            maxHeight: "78vh",
            boxShadow: "0 20px 64px -16px color-mix(in srgb, var(--caos-bg) 90%, transparent), 0 0 0 1px color-mix(in srgb, var(--tranche-2l) 12%, transparent)"
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "h-9 shrink-0 px-3 flex items-center gap-2 border-b border-caos-border bg-caos-elevated/70",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-caos-accent text-caos-2xl",
                        children: "✦"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                        lineNumber: 216,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-xl text-caos-text whitespace-nowrap",
                        children: [
                            label,
                            " · Issuer Q&A"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                        lineNumber: 217,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs px-1.5 py-px rounded border border-caos-border text-caos-muted whitespace-nowrap",
                        children: [
                            "grounded in ",
                            runLabel,
                            tab ? " · viewing " + tab : ""
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                        lineNumber: 218,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex-1"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                        lineNumber: 219,
                        columnNumber: 9
                    }, this),
                    msgs.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>setMsgs([]),
                        title: "Clear conversation",
                        className: "text-caos-muted hover:text-caos-text transition-caos text-caos-xl",
                        children: "⌫"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                        lineNumber: 221,
                        columnNumber: 11
                    }, this) : null,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CloseButton"], {
                        onClick: onClose,
                        label: "Close chat",
                        title: "Close chat"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                        lineNumber: 223,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                lineNumber: 215,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                ref: scrollRef,
                tabIndex: 0,
                "aria-label": "Conversation history",
                className: "flex-1 min-h-0 overflow-auto px-3 py-3 flex flex-col gap-2.5 bg-caos-bg focus-ring",
                children: [
                    !msgs.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-caos-md text-caos-muted leading-relaxed",
                                children: [
                                    "Ask follow-up questions about ",
                                    label,
                                    " — answers cite the module outputs (CP-x) and evidence (E-xx) from this run.",
                                    live?.runId ? "" : " All figures mock."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                                lineNumber: 229,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-col gap-1.5 mt-1",
                                children: CAOS_CHAT_STARTERS.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: ()=>send(s),
                                        className: "text-left tabular text-caos-md px-2.5 py-1.5 rounded border border-caos-border text-caos-text/85 hover:border-caos-accent/60 hover:bg-caos-elevated/60 transition-caos",
                                        children: s
                                    }, s, false, {
                                        fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                                        lineNumber: 234,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                                lineNumber: 232,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                        lineNumber: 228,
                        columnNumber: 11
                    }, this) : null,
                    msgs.map((m, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "max-w-[88%] rounded px-2.5 py-2 text-caos-lg leading-relaxed whitespace-pre-wrap border " + (m.role === "user" ? "self-end text-caos-text" : "self-start text-caos-text/90"),
                            style: m.role === "user" ? {
                                background: "color-mix(in srgb, var(--tranche-2l) 10%, transparent)",
                                borderColor: "color-mix(in srgb, var(--tranche-2l) 40%, transparent)"
                            } : {
                                background: "var(--caos-panel)",
                                borderColor: m.err ? "color-mix(in srgb, var(--caos-warning) 50%, transparent)" : "var(--caos-border)"
                            },
                            children: [
                                m.role === "assistant" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-1 flex items-center gap-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-caos-accent",
                                            children: "✦"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                                            lineNumber: 251,
                                            columnNumber: 17
                                        }, this),
                                        "Credit OS"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                                    lineNumber: 250,
                                    columnNumber: 15
                                }, this) : null,
                                m.content
                            ]
                        }, i, true, {
                            fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                            lineNumber: 242,
                            columnNumber: 11
                        }, this)),
                    busy ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "self-start rounded px-2.5 py-2 border border-caos-border bg-caos-panel flex items-center gap-1.5",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$pipeline$2f$atoms$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Dot"], {
                                sev: "running",
                                pulse: true
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                                lineNumber: 259,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "tabular text-caos-sm text-caos-muted",
                                children: "querying run outputs…"
                            }, void 0, false, {
                                fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                                lineNumber: 260,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                        lineNumber: 258,
                        columnNumber: 11
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                lineNumber: 226,
                columnNumber: 7
            }, this),
            focusEv && __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$evidence$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["EVIDENCE"][focusEv] ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "shrink-0 border-t border-caos-border bg-caos-elevated/40 px-2.5 py-1 flex items-center gap-1.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs uppercase tracking-wider text-caos-accent shrink-0",
                        children: "In focus"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                        lineNumber: 267,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-sm text-caos-accent shrink-0",
                        children: focusEv
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                        lineNumber: 268,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-caos-sm text-caos-muted truncate",
                        children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$evidence$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["EVIDENCE"][focusEv].section
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                        lineNumber: 269,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex-1"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                        lineNumber: 270,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>setFocusEv(null),
                        title: "Clear focus context",
                        "aria-label": "Clear focus context",
                        className: "shrink-0 rounded text-caos-muted hover:text-caos-text transition-caos text-caos-md focus-ring",
                        children: "✕"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                        lineNumber: 271,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                lineNumber: 266,
                columnNumber: 9
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "shrink-0 border-t border-caos-border bg-caos-panel px-2.5 py-2 flex items-center gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$TextInput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TextInput"], {
                        ref: inputRef,
                        name: "issuer-chat-query",
                        autoComplete: "off",
                        value: input,
                        onChange: (e)=>setInput(e.target.value),
                        onKeyDown: (e)=>{
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                send();
                            }
                        },
                        placeholder: "Ask about " + label + " — e.g. recovery, covenants" + (tab ? ", " + tab : "") + "…",
                        "aria-label": "Ask a question about this issuer",
                        maxLength: 600,
                        className: "flex-1 px-2.5 py-1.5 text-caos-lg"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                        lineNumber: 283,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>send(),
                        disabled: busy || !input.trim(),
                        title: "Send",
                        className: "shrink-0 w-8 h-8 rounded flex items-center justify-center transition-caos disabled:opacity-40 text-caos-xl",
                        style: {
                            background: "var(--caos-accent)",
                            color: "var(--caos-bg)"
                        },
                        children: "↑"
                    }, void 0, false, {
                        fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                        lineNumber: 295,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
                lineNumber: 282,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/deepdive/IssuerChat.tsx",
        lineNumber: 208,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/lib/engine/adapt.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Adapter: canonical engine payload (ModuleDetailDTO) -> the {kpis, sections}
// ModuleOutput the deep-dive renderer already consumes. This is the seam that
// lets LIVE module output drop into today's UI unchanged. The seeded constants
// in lib/deepdive/module-outputs.ts are the expected-shape fixtures this adapter
// reproduces (see adapt.test.ts).
//
// Per-module handling for the modules the engine produces live (CP-0, CP-1);
// every module additionally gets a generic "evidence-traced claims" section so
// each claim's E-xx chips render and resolve via the existing OutSections.
__turbopack_context__.s([
    "adaptModule",
    ()=>adaptModule,
    "humanize",
    ()=>humanize
]);
// lineage_class -> the renderer's severity vocabulary.
function lineageSev(lineageClass) {
    if ([
        "Conflicting",
        "Weak Lineage",
        "Untraced"
    ].includes(lineageClass)) return "warning";
    if (lineageClass === "Insufficient Information") return "low";
    return "ok";
}
function qaSev(qaStatus) {
    if (qaStatus === "Blocked") return "critical";
    if (qaStatus === "Restricted") return "warning";
    if (qaStatus === "Passed") return "ok";
    return undefined;
}
// Each claim becomes a flag carrying its evidence ids, so click-to-source chips
// render. The claim's severity is the worst lineage class across its evidence.
function claimsSection(claims) {
    if (!claims.length) return null;
    const items = claims.map((c)=>{
        const sevs = c.evidence.map((e)=>lineageSev(e.lineage_class));
        const sev = sevs.includes("warning") ? "warning" : sevs.includes("low") ? "low" : "ok";
        return {
            sev,
            text: c.claim_text,
            ev: c.evidence.map((e)=>e.evidence_id)
        };
    });
    return {
        type: "flags",
        title: "Evidence-traced claims (CP-5B lineage)",
        items
    };
}
function num(v) {
    if (v == null) return "—";
    if (typeof v === "number") return v.toLocaleString("en-US");
    // A nested object/array cell would otherwise stringify to "[object Object]".
    if (typeof v === "object") return Array.isArray(v) ? v.map(String).join(", ") : "{…}";
    return String(v);
}
function adaptCp0(rt) {
    const docMap = rt.document_map || [];
    const gaps = rt.gap_log || [];
    const sections = [];
    if (docMap.length) {
        sections.push({
            type: "table",
            title: "CP-0 · Document map & quality",
            // The fixture emits a per-doc `grade`; a LIVE run (readiness.py) emits the
            // engine's `categories` classification instead — fall through so the column
            // isn't permanently blank on real issuers. (mock↔live seam)
            cols: [
                "Doc",
                "Name",
                "Type",
                "Grade / Categories"
            ],
            align: [
                0,
                0,
                0,
                0
            ],
            rows: docMap.map((d)=>{
                const cats = d.categories;
                return [
                    d.doc,
                    d.name,
                    d.type,
                    d.grade ?? (Array.isArray(cats) ? cats.join(", ") : "—")
                ];
            })
        });
    }
    if (gaps.length) {
        sections.push({
            type: "flags",
            title: "CP-0 · Gap log",
            items: gaps.map((g)=>({
                    sev: g.severity || "low",
                    text: `${g.id}: ${g.text}`
                }))
        });
    }
    return {
        kpis: [
            {
                l: "Readiness",
                v: num(rt.readiness_score),
                sev: "ok"
            },
            {
                l: "Files classified",
                v: num(rt.files_classified)
            },
            // Derive the count from the emitted gap_log so a LIVE run (whose readiness
            // synth emits gap_log but not the demo-fixture's pre-counted gaps_logged)
            // shows the real number, not "—". (mock↔live seam)
            {
                l: "Gaps logged",
                v: num(rt.gaps_logged ?? gaps.length),
                sev: "warning"
            },
            {
                l: "Unresolved conflicts",
                v: num(rt.unresolved_conflicts),
                sev: "ok"
            }
        ],
        sections
    };
}
function reportedCp1Basis(basis) {
    return basis === "reported_gaap_xbrl" || basis === "reported_disclosure";
}
function cp1Currency(runtime) {
    return typeof runtime.currency === "string" && runtime.currency ? runtime.currency : "$";
}
function cp1FinancialSection(periods, revenue, ebitda, reported, currency, ebitdaLabel) {
    if (!periods.length) return null;
    return {
        type: "table",
        title: reported ? `CP-1 · Reported financials (${currency}M, GAAP proxy)` : `CP-1 · Normalized financials (${currency}M)`,
        cols: [
            "",
            ...periods.map(humanize)
        ],
        align: [
            0,
            ...periods.map(()=>1)
        ],
        rows: [
            [
                "Revenue",
                ...periods.map((period)=>num(revenue[period]))
            ],
            [
                ebitdaLabel,
                ...periods.map((period)=>num(ebitda[period]))
            ]
        ]
    };
}
function cp1ConflictSection(conflicts) {
    if (!conflicts.length) return null;
    return {
        type: "flags",
        title: "CP-1 · Definition conflict register",
        items: conflicts.map((conflict)=>({
                sev: "warning",
                text: conflict.text
            }))
    };
}
function multipleValue(value) {
    return value == null ? "—" : `${num(value)}x`;
}
function adaptCp1(rt) {
    const fin = rt.normalized_financials || {};
    const conflicts = rt.definition_conflicts || [];
    const rev = fin.revenue || {};
    const eb = fin.adj_ebitda || {};
    // An EDGAR-grounded CP-1 carries a REPORTED GAAP proxy — and the issuer-
    // disclosed lane (reported_cp1.py, basis "reported_disclosure") carries figures
    // "taken as reported — not covenant-adjusted" — in the same keys the fixture/
    // LLM use for covenant-adjusted figures. Neither may be labeled 'Adj.'. (#15)
    const reported = reportedCp1Basis(rt.basis);
    const ebLabel = reported ? "EBITDA (reported proxy)" : "Adj. EBITDA";
    const levLabel = reported ? "Net leverage (reported)" : "Net leverage (adj.)";
    // Currency symbol from the engine (reported-disclosure CP-1 carries £/€/$ for a
    // non-US issuer). EDGAR (us-gaap, USD) and the demo/LLM CP-1 omit it → default $.
    // Without this, a £/€ issuer's figures rendered under a hardcoded "$M" — a
    // material currency mislabel on the non-US reported-disclosure path.
    const cur = cp1Currency(rt);
    const periods = Object.keys(rev);
    const sections = [
        cp1FinancialSection(periods, rev, eb, reported, cur, ebLabel),
        cp1ConflictSection(conflicts)
    ].filter((section)=>section !== null);
    return {
        kpis: [
            // Unit suffix only on a real figure — "—x" reads as a broken render.
            {
                l: levLabel,
                v: multipleValue(fin.net_leverage_adj_ltm),
                sev: "warning"
            },
            // Derive from the emitted financial periods so a LIVE/EDGAR run (which
            // carries normalized_financials but not the demo-fixture's pre-counted
            // periods_normalized) shows the real count, not "—". (mock↔live seam)
            {
                l: "Periods normalized",
                v: num(rt.periods_normalized ?? periods.length)
            },
            {
                l: "KPIs registered",
                v: num(rt.kpis_registered)
            },
            // Live/EDGAR CP-1 emits interest_coverage_ltm (both bases, nested in
            // normalized_financials) but NOT the demo-only coverage_gate GREEN/RED.
            // Show the real coverage figure; the adaptModule "—" filter drops it (and
            // "KPIs registered") on a run that lacks the value. (mock↔live seam)
            {
                l: "Interest coverage",
                v: multipleValue(fin.interest_coverage_ltm),
                sev: "ok"
            }
        ],
        sections
    };
}
// Columns not worth a table header (opaque ids the analyst never reads).
const SKIP_COL = /(^|_)(id|chunk_id|issuer_id|figi)$/i;
const NON_MEASURE_COL = /(^|_)(?:id|identifier|code|name|label|date|as_of|period|quarter|year|rating|grade|ticker|cusip|isin|figi|version)(?:_|$)/i;
const INITIAL_DISCLOSURE_ROWS = 12;
// A live adapter may only infer number alignment from the payload schema, never
// from its formatted text. That keeps a digit-bearing CUSIP, as-of date, rating,
// or module code in the text lane even when every rendered value looks numeric.
function isFiniteMeasureColumn(key, rows) {
    if (NON_MEASURE_COL.test(key)) return false;
    const values = rows.map((row)=>row[key]).filter((value)=>value != null);
    return values.length > 0 && values.every((value)=>typeof value === "number" && Number.isFinite(value));
}
function inferredAlign(cols, rows) {
    return cols.map((key)=>isFiniteMeasureColumn(key, rows) ? 1 : 0);
}
// Finance acronyms humanize() would otherwise title-case into "Ebitda"/"Fcf".
// Whole-word, case-insensitive → upper.
const ACRONYMS = /\b(ebitda|ltm|fcf|dscr|fccr|wacc|roic|sofr|oid|mfn|nav|ev|dm|rcf|tlb|lme|yoy|qoq|ytd)\b/gi;
function humanize(k) {
    return k.replace(/_/g, " ").replace(/\bmusd\b/gi, "$M").replace(/\bpct\b/gi, "%")// Re-glue a quarter to its 2-digit year so "ltm_q1_26" reads "LTM Q1-26",
    // not the machine key "LTM Q1 26". (critique: raw keys leak into tables)
    .replace(/\bq([1-4])\s+'?(\d{2})\b/gi, (_m, q, y)=>`Q${q}-${y}`).replace(ACRONYMS, (m)=>m.toUpperCase()).replace(/^\w/, (c)=>c.toUpperCase());
}
// A scalar small enough to read as a headline KPI (long strings become text).
function isKpiScalar(v) {
    return typeof v === "number" || typeof v === "boolean" || typeof v === "string" && v.length <= 32;
}
function isObjArray(v) {
    return Array.isArray(v) && v.length > 0 && v.every((x)=>x !== null && typeof x === "object" && !Array.isArray(x));
}
// An array of {text, severity/id} reads as flags; anything else as a table.
function isFlagArray(arr) {
    return arr.every((o)=>typeof o.text === "string" && ("severity" in o || "sev" in o || "id" in o));
}
function toOutFlag(o) {
    const ev = o.ev;
    return {
        sev: String(o.severity ?? o.sev ?? "low"),
        text: o.id ? `${o.id}: ${o.text}` : String(o.text),
        ev: Array.isArray(ev) ? ev.map(String) : undefined
    };
}
function flagsFrom(title, arr) {
    const items = arr.slice(0, INITIAL_DISCLOSURE_ROWS).map(toOutFlag);
    // Keep bounded first paint, but retain every persisted adverse item. OutSections
    // owns the exact +N more disclosure using this additive metadata.
    return Object.assign({
        type: "flags",
        title,
        items
    }, arr.length > INITIAL_DISCLOSURE_ROWS ? {
        overflowItems: arr.slice(INITIAL_DISCLOSURE_ROWS).map(toOutFlag)
    } : {});
}
function tableFrom(title, arr) {
    const cols = Object.keys(arr[0]).filter((k)=>!SKIP_COL.test(k));
    if (!cols.length) return null;
    const toRow = (row)=>cols.map((col)=>num(row[col]));
    return Object.assign({
        type: "table",
        title,
        cols: cols.map(humanize),
        align: inferredAlign(cols, arr),
        rows: arr.slice(0, INITIAL_DISCLOSURE_ROWS).map(toRow)
    }, arr.length > INITIAL_DISCLOSURE_ROWS ? {
        overflowRows: arr.slice(INITIAL_DISCLOSURE_ROWS).map(toRow)
    } : {});
}
function tableFromAll(title, arr) {
    const cols = Object.keys(arr[0]).filter((k)=>!SKIP_COL.test(k));
    if (!cols.length) return null;
    return {
        type: "table",
        title,
        cols: cols.map(humanize),
        align: inferredAlign(cols, arr),
        rows: arr.map((o)=>cols.map((c)=>num(o[c])))
    };
}
function kvTable(title, obj) {
    const entries = Object.entries(obj).filter(([, v])=>isKpiScalar(v) || v == null);
    if (!entries.length) return null;
    return {
        type: "table",
        title,
        cols: [
            "",
            "Value"
        ],
        align: [
            0,
            1
        ],
        rows: entries.map(([k, v])=>[
                humanize(k),
                num(v)
            ])
    };
}
// Generic adapter for any module the engine persists but that has no bespoke
// mapping: scalars → KPIs, object-arrays → flags/tables, nested scalar objects →
// key/value tables, long strings → notes. Good enough to render real engine
// output with provenance for every module, not just CP-0/CP-1.
// fallow-ignore-next-line complexity -- Heterogeneous module shapes require one provenance-preserving dispatch pass.
function adaptGeneric(rt) {
    const kpis = Object.entries(rt).filter(([, v])=>isKpiScalar(v) && v !== "").map(([k, v])=>({
            l: humanize(k),
            v: num(v)
        }));
    const sections = [];
    for (const [k, v] of Object.entries(rt)){
        const title = humanize(k);
        if (isObjArray(v)) {
            const sec = isFlagArray(v) ? flagsFrom(title, v) : tableFrom(title, v);
            if (sec) sections.push(sec);
        } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
            // Nested object (e.g. CP-6A bull_case/bear_case): its scalars → a KV table,
            // and recurse one level so a `narrative` long-string and a `points[]`
            // object-array don't get silently dropped.
            const obj = v;
            const kv = kvTable(title, obj);
            if (kv) sections.push(kv);
            for (const [k2, v2] of Object.entries(obj)){
                const t2 = title + " · " + humanize(k2);
                if (isObjArray(v2)) {
                    const sec = isFlagArray(v2) ? flagsFrom(t2, v2) : tableFrom(t2, v2);
                    if (sec) sections.push(sec);
                } else if (typeof v2 === "string" && v2.length > 32) {
                    sections.push({
                        type: "text",
                        title: t2,
                        body: v2
                    });
                }
            }
        } else if (Array.isArray(v) && v.length) {
            sections.push({
                type: "text",
                title,
                body: v.map(String).join(", ")
            });
        } else if (typeof v === "string" && v.length > 32) {
            sections.push({
                type: "text",
                title,
                body: v
            });
        }
    }
    return {
        kpis,
        sections
    };
}
// CP-4C covenant register: the extracted terms in desk order, breach flagged in
// text as well as color. Absent terms are dropped (cov-lite runs extract little)
// rather than rendered as a row of dashes; sections stay generic (calculations
// table, add-back audit KV, claims).
function adaptCp4c(rt) {
    const fin = (v)=>typeof v === "number" && Number.isFinite(v) ? v : null;
    const musd = (v)=>{
        const x = fin(v);
        return x == null ? null : "$" + x.toLocaleString("en-US") + "M";
    };
    const audit = rt.addback_audit || {};
    const util = fin(audit.utilization_pct);
    const breach = audit.breach === true;
    const cap = fin(rt.addback_cap_pct);
    const capV = cap == null ? null : (cap * 100).toFixed(0) + "% of EBITDA" + (util != null ? ` · ${util.toFixed(0)}% used${breach ? " · BREACH" : ""}` : "");
    const kpis = [
        {
            l: "Structure",
            v: rt.covenant_structure ? String(rt.covenant_structure) : null
        },
        {
            l: "Net leverage",
            v: fin(rt.current_net_leverage) != null ? fin(rt.current_net_leverage).toFixed(2) + "×" : null
        },
        {
            l: "Leverage covenant",
            v: fin(rt.leverage_covenant_x) != null ? fin(rt.leverage_covenant_x).toFixed(2) + "×" : null
        },
        {
            l: "RP / builder basket",
            v: musd(rt.rp_basket_musd)
        },
        {
            l: "Cross-default trips at",
            v: musd(rt.cross_default_musd)
        },
        {
            l: "Add-back cap",
            v: capV,
            sev: breach ? "critical" : util != null && util >= 80 ? "warning" : undefined
        }
    ].filter((k)=>k.v != null);
    return {
        kpis,
        sections: adaptGeneric(rt).sections
    };
}
function adaptCp5b(rt) {
    const driverRegister = Array.isArray(rt.driver_register) ? rt.driver_register : null;
    const drivers = (driverRegister ?? []).filter((row)=>row !== null && typeof row === "object" && !Array.isArray(row));
    const sections = [];
    if (typeof rt.selection_basis === "string" && rt.selection_basis) {
        sections.push({
            type: "text",
            title: "CP-5B · Selection basis",
            body: rt.selection_basis
        });
    }
    if (driverRegister) {
        sections.push({
            type: "flags",
            title: "CP-5B · Decision-relevant driver lineage",
            items: drivers.map((driver)=>{
                const confidence = typeof driver.confidence === "number" && Number.isFinite(driver.confidence) ? `${Math.round(driver.confidence * 100)}% confidence` : "confidence unavailable";
                const qa = Array.isArray(driver.qa_findings) && driver.qa_findings.length ? ` · QA ${driver.qa_findings.map(String).join(", ")}` : "";
                const ev = Array.isArray(driver.evidence_ids) ? driver.evidence_ids.map(String) : undefined;
                return {
                    sev: driver.status === "open" ? "warning" : "ok",
                    text: `#${num(driver.rank)} [${String(driver.module_id || "CP")}] ${String(driver.driver || "Unnamed driver")} — ${String(driver.lineage || "lineage unavailable")} · ${confidence}${qa}`,
                    ev
                };
            })
        });
        if (!drivers.length) {
            sections.push({
                type: "text",
                title: "CP-5B · Driver register state",
                body: "No persisted analytical claims were available for deterministic driver selection."
            });
        }
    }
    return {
        kpis: [
            {
                l: "Decision drivers",
                v: num(drivers.length)
            },
            {
                l: "Claims traced",
                v: num(rt.claims_traced)
            },
            {
                l: "Weak lineage flags",
                v: num(rt.weak_lineage_flags),
                sev: Number(rt.weak_lineage_flags) > 0 ? "warning" : "ok"
            },
            {
                l: "Orphan claims",
                v: num(rt.orphan_claims),
                sev: Number(rt.orphan_claims) > 0 ? "critical" : "ok"
            },
            {
                l: "Auditability",
                v: num(rt.auditability),
                sev: rt.auditability === "STRONG" ? "ok" : "warning"
            }
        ],
        sections
    };
}
function adaptSpecialized(moduleId, rt) {
    const keys = specializedKeys(moduleId);
    return {
        kpis: specializedKpis(moduleId, rt, keys),
        sections: specializedSections(moduleId, rt, keys)
    };
}
function specializedKeys(moduleId) {
    return moduleId === "CP-2G" ? [
        "source_register",
        "transition_risks",
        "social_event_risks",
        "materiality_assessments",
        "sustainability_linked_instruments",
        "demand_access_implications",
        "credit_implications",
        "gaps"
    ] : [
        "source_gate_register",
        "entity_register",
        "guarantee_matrix",
        "collateral_matrix",
        "structural_priority",
        "leakage_routes",
        "priming_exposures",
        "gaps"
    ];
}
function specializedSections(moduleId, rt, keys) {
    const sections = [];
    const basis = typeof rt.status_basis === "string" ? rt.status_basis : null;
    if (basis) sections.push({
        type: "text",
        title: `${moduleId} · Source-gate basis`,
        body: basis
    });
    for (const key of keys){
        const rows = rt[key];
        if (isObjArray(rows)) {
            const section = tableFromAll(`${moduleId} · ${humanize(key)}`, rows);
            if (section) sections.push(section);
        }
    }
    const overallKey = moduleId === "CP-2G" ? "overall_credit_view" : "overall_structural_view";
    if (typeof rt[overallKey] === "string") {
        sections.push({
            type: "text",
            title: `${moduleId} · ${humanize(overallKey)}`,
            body: String(rt[overallKey])
        });
    }
    return sections;
}
function specializedStatusSeverity(status) {
    if (status === "Blocked") return "critical";
    if (status === "Completed with Limitations") return "warning";
    return "ok";
}
function specializedKpis(moduleId, rt, keys) {
    const status = typeof rt.module_status === "string" ? rt.module_status : "Unavailable";
    const sourceRows = rt[keys[0]];
    return [
        {
            l: "Module status",
            v: status,
            sev: specializedStatusSeverity(status)
        },
        {
            l: "Source rows",
            v: num(Array.isArray(sourceRows) ? sourceRows.length : 0)
        },
        {
            l: "Open gaps",
            v: num(Array.isArray(rt.gaps) ? rt.gaps.length : 0),
            sev: Array.isArray(rt.gaps) && rt.gaps.length ? "warning" : undefined
        }
    ];
}
function adaptRuntime(moduleId, runtime) {
    switch(moduleId){
        case "CP-0":
            return adaptCp0(runtime);
        case "CP-1":
            return adaptCp1(runtime);
        case "CP-2G":
            return adaptSpecialized("CP-2G", runtime);
        case "CP-4D":
            return adaptSpecialized("CP-4D", runtime);
        case "CP-4C":
            return adaptCp4c(runtime);
        case "CP-5B":
            return adaptCp5b(runtime);
        default:
            return adaptGeneric(runtime);
    }
}
function adaptModule(detail) {
    const rt = detail.runtime_output || {};
    const base = adaptRuntime(detail.module_id, rt);
    const sections = [
        ...base.sections
    ];
    const claims = claimsSection(detail.claims || []);
    if (claims) sections.push(claims);
    // Drop any KPI whose value is "—": several demo-fixture summary KPIs (coverage
    // gate, KPIs registered, unresolved conflicts) have no clean live source, and a
    // blank placeholder in a header reads as a broken render. A live header shows
    // only the KPIs it can back with real data. Fall back to the QA status only
    // when nothing real is left (also the old empty-base behavior). (mock↔live seam)
    const kpis = base.kpis.filter((k)=>k.v !== "—");
    return {
        kpis: kpis.length ? kpis : [
            {
                l: "QA status",
                v: detail.qa_status,
                sev: qaSev(detail.qa_status)
            }
        ],
        sections
    };
}
}),
"[project]/src/lib/engine/useLatestRun.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useLatestRunStatus",
    ()=>useLatestRunStatus
]);
// Shared "latest complete run" loader behind useLiveRun / useModelEngine /
// useLivePipeline. Loads the latest COMPLETE run for an issuer, builds T from it,
// and on no run / no backend / any error returns `empty` — the "prefer live,
// static fallback" contract every live hook shares. Side-effect-free (never
// creates a run) and cancel-safe (a stale issuerId can't clobber a newer load).
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
;
;
function useLatestRunStatus(issuerId, initial, empty, build, exactRunId) {
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        value: initial,
        phase: "loading",
        latest: null
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        let cancelled = false;
        // Reset to the loading sentinel synchronously on issuerId change, so the PRIOR
        // issuer's resolved run (badge / module output / vault export) can't show under
        // the new issuer's chrome during the listRuns round-trip. (review run-2 #FR1)
        setState({
            value: initial,
            phase: "loading",
            latest: null
        });
        (async ()=>{
            try {
                const runs = exactRunId ? [
                    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getRun"])(exactRunId).then((run)=>{
                        if (run.issuer_id !== issuerId) throw new Error("Run issuer mismatch");
                        return {
                            ...run,
                            created_at: null
                        };
                    })
                ] : await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["listRuns"])(issuerId);
                const complete = runs.find((r)=>r.status === "complete");
                if (!complete) {
                    // Latest run record by created_at, regardless of status, so the caller
                    // can distinguish "in flight / failed" from "no runs at all".
                    const latest = runs.length ? runs.reduce((a, b)=>(b.created_at ?? "") > (a.created_at ?? "") ? b : a) : null;
                    if (!cancelled) setState({
                        value: empty,
                        phase: latest ? "in_flight" : "none",
                        latest
                    });
                    return;
                }
                const next = await build(complete);
                if (!cancelled) setState({
                    value: next,
                    phase: "complete",
                    latest: complete
                });
            } catch  {
                // no backend / network error — surface as an error phase (not a silent
                // fallback) so the caller can choose to show an error state, not a demo.
                if (!cancelled) setState({
                    value: empty,
                    phase: "error",
                    latest: null
                });
            }
        })();
        return ()=>{
            cancelled = true;
        };
    // build/empty are recreated each render by callers; issuer/run identity are
    // the only real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        exactRunId,
        issuerId
    ]);
    return state;
}
}),
"[project]/src/lib/engine/useLiveRun.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useLiveRun",
    ()=>useLiveRun
]);
// Read-only hook: load the latest COMPLETE run for an issuer and adapt its
// module payloads into the {kpis, sections} shape the deep-dive renderer uses.
// Deliberately side-effect-free (never creates a run) and fully guarded — on no
// run, no backend, or any error it returns empty, so the offline sim demo falls
// back to the seeded constants unchanged ("prefer live, static fallback").
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$adapt$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/engine/adapt.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useLatestRun$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/engine/useLatestRun.ts [app-ssr] (ecmascript)");
;
;
;
// Modules the engine persists and ModuleView renders live (every module except
// the four with bespoke tabs — CP-6A/6E debate, CP-3B recovery, CP-4 covenants —
// which have their own renderers). adaptModule turns each ModuleDetailDTO into the
// {kpis, sections} shape; a module absent from a given run is skipped (catch →
// static fallback), so this list is the *eligible* set, not a per-run guarantee.
// ponytail: fetches all eligible modules up-front on deep-dive open; if that gets
// heavy, fetch the active tab's module on demand instead.
// The bespoke modules (CP-6A/6E/3B/4) are included too: their live output drives
// the generic ModuleView for a non-reference issuer (page.tsx `useBespoke`), while
// the reference deal keeps the bespoke showcase renderers.
const LIVE_MODULES = [
    "CP-0",
    "CP-1",
    "CP-1A",
    "CP-1B",
    "CP-1C",
    "CP-2",
    "CP-2B",
    "CP-2C",
    "CP-2D",
    "CP-2E",
    "CP-2F",
    "CP-2G",
    "CP-3",
    "CP-3B",
    "CP-3C",
    "CP-3D",
    "CP-4",
    "CP-4D",
    "CP-4C",
    "CP-5",
    "CP-5B",
    "CP-6A",
    "CP-6E"
];
const EMPTY = {
    liveOuts: {},
    liveStatus: {},
    liveEvidence: {},
    runId: null,
    asOf: null,
    committeeStatus: null,
    council: [],
    loading: false
};
function useLiveRun(issuerId, exactRunId) {
    const status = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useLatestRun$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useLatestRunStatus"])(issuerId, {
        ...EMPTY,
        loading: true
    }, EMPTY, async (latest)=>{
        // One bulk request for every produced module (server joins claims/evidence in
        // three queries) instead of the old 21-request fan-out per deep-dive open.
        // LIVE_MODULES still scopes which ids the UI adapts; extras are ignored.
        const eligible = new Set(LIVE_MODULES);
        const all = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getModules"])(latest.id);
        const details = all.filter((d)=>eligible.has(d.module_id));
        const liveOuts = {};
        const liveStatus = {};
        const liveEvidence = {};
        for (const detail of details){
            liveOuts[detail.module_id] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$adapt$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["adaptModule"])(detail);
            liveStatus[detail.module_id] = detail.qa_status;
            for (const c of detail.claims || []){
                for (const ev of c.evidence){
                    liveEvidence[ev.evidence_id] = {
                        ...ev,
                        module: detail.module_id,
                        claim: c.claim_text
                    };
                }
            }
        }
        // Committee review from CP-5C's own persisted output (issue_log) — the typed
        // channel, so the panel no longer depends on the backend's finding_id string
        // format ("CP-5C-…", an untyped coupling a mint reformat would silently
        // break). Runs persisted before CP-5C outputs existed fall back to the old
        // QA-findings prefix filter.
        const cp5c = all.find((d)=>d.module_id === "CP-5C");
        const log = cp5c?.runtime_output?.issue_log;
        let council;
        if (Array.isArray(log)) {
            council = log.map((e)=>({
                    finding_id: String(e.id ?? ""),
                    severity: String(e.severity ?? "MINOR"),
                    lane: typeof e.lane === "number" ? e.lane : null,
                    module_id: typeof e.module === "string" ? e.module : null,
                    description: String(e.finding ?? ""),
                    affected_claim_id: typeof e.claim === "string" ? e.claim : null,
                    required_remediation: null
                }));
        } else {
            const qa = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getQA"])(latest.id);
            council = qa.findings.filter((f)=>f.finding_id.startsWith("CP-5C-"));
        }
        return {
            liveOuts,
            liveStatus,
            liveEvidence,
            runId: latest.id,
            asOf: latest.as_of_date ?? latest.created_at,
            committeeStatus: latest.committee_status,
            council,
            loading: false
        };
    }, exactRunId);
    // Thread the underlying load phase through so a caller can distinguish a
    // genuine backend error from no-coverage-yet (M-1/M-2 fix) — see RunPhase.
    return {
        ...status.value,
        phase: status.phase
    };
}
}),
"[project]/src/lib/engine/types.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// DTOs for the analytical engine API (caos/server/routes/runs.py). Keys are
// snake_case to match the FastAPI response models verbatim.
// The seeded reference deal (Atlas Forge Industrials) — see
// caos/server/engine/fixtures.py. Used to pull the live run for the deep-dive.
__turbopack_context__.s([
    "ATLF_REFERENCE_ISSUER_ID",
    ()=>ATLF_REFERENCE_ISSUER_ID
]);
const ATLF_REFERENCE_ISSUER_ID = "a71f0000-0000-0000-0000-000000000001";
}),
"[project]/src/components/command/CitationViewer.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CitationViewer",
    ()=>CitationViewer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// Click-to-source: a lightweight modal that fetches and shows one ingested
// document chunk behind a citation chip (the `src` / E-xx markers in the
// cross-issuer query results). Esc / ✕ / backdrop to close.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/CloseButton.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/StatusGlyph.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/use-modal-a11y.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ModalBackdrop.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
;
function CitationViewer({ chunkId, label, onClose }) {
    const [chunk, setChunk] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [err, setErr] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        let cancelled = false;
        setChunk(null);
        setErr(null);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getChunk"])(chunkId).then((c)=>{
            if (!cancelled) setChunk(c);
        }).catch((e)=>{
            if (!cancelled) {
                const d = e?.response?.data?.detail || e?.message || "could not load source";
                setErr(String(d));
            }
        });
        return ()=>{
            cancelled = true;
        };
    }, [
        chunkId
    ]);
    const panelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useModalA11y"])(onClose);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ModalBackdrop"], {
        onClose: onClose,
        className: "caos-enter",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            ref: panelRef,
            className: "w-[520px] max-w-[92vw] max-h-[80vh] flex flex-col bg-caos-panel border border-caos-accent/50 rounded-md overflow-hidden",
            style: {
                boxShadow: "var(--shadow-modal)"
            },
            onClick: (e)=>e.stopPropagation(),
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "Source document chunk",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "h-9 shrink-0 px-3 flex items-center gap-2 border-b border-caos-border bg-caos-elevated/70",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-caos-accent text-caos-xl",
                            children: "❝"
                        }, void 0, false, {
                            fileName: "[project]/src/components/command/CitationViewer.tsx",
                            lineNumber: 49,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "tabular text-caos-md uppercase tracking-wider text-caos-muted",
                            children: "Source"
                        }, void 0, false, {
                            fileName: "[project]/src/components/command/CitationViewer.tsx",
                            lineNumber: 50,
                            columnNumber: 11
                        }, this),
                        label ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "tabular text-caos-xs px-1.5 py-px rounded border border-caos-accent/50 text-caos-accent",
                            children: label
                        }, void 0, false, {
                            fileName: "[project]/src/components/command/CitationViewer.tsx",
                            lineNumber: 51,
                            columnNumber: 20
                        }, this) : null,
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex-1"
                        }, void 0, false, {
                            fileName: "[project]/src/components/command/CitationViewer.tsx",
                            lineNumber: 52,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CloseButton"], {
                            onClick: onClose,
                            label: "Close source viewer"
                        }, void 0, false, {
                            fileName: "[project]/src/components/command/CitationViewer.tsx",
                            lineNumber: 53,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/command/CitationViewer.tsx",
                    lineNumber: 48,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex-1 min-h-0 overflow-auto px-3.5 py-3",
                    children: err ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "tabular text-caos-md",
                        style: {
                            color: "var(--caos-warning)"
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                                kind: "warning"
                            }, void 0, false, {
                                fileName: "[project]/src/components/command/CitationViewer.tsx",
                                lineNumber: 58,
                                columnNumber: 92
                            }, this),
                            " ",
                            err
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/command/CitationViewer.tsx",
                        lineNumber: 58,
                        columnNumber: 13
                    }, this) : !chunk ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "tabular text-caos-md text-caos-muted",
                        children: "Loading source…"
                    }, void 0, false, {
                        fileName: "[project]/src/components/command/CitationViewer.tsx",
                        lineNumber: 60,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-2 flex-wrap",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-caos-xl text-caos-text font-medium",
                                        children: chunk.issuer_name
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/command/CitationViewer.tsx",
                                        lineNumber: 64,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "tabular text-caos-2xs uppercase tracking-wide px-1.5 py-px rounded border border-caos-border text-caos-muted",
                                        children: chunk.doc_type
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/command/CitationViewer.tsx",
                                        lineNumber: 65,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "tabular text-caos-xs text-caos-muted",
                                        children: chunk.doc
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/command/CitationViewer.tsx",
                                        lineNumber: 66,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/command/CitationViewer.tsx",
                                lineNumber: 63,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-caos-xl text-caos-text/90 leading-relaxed whitespace-pre-wrap border-l-2 border-caos-accent/40 pl-2.5",
                                children: chunk.text
                            }, void 0, false, {
                                fileName: "[project]/src/components/command/CitationViewer.tsx",
                                lineNumber: 68,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "tabular text-caos-3xs uppercase tracking-wide text-caos-muted",
                                children: [
                                    "chunk ",
                                    chunk.chunk_id.slice(0, 8),
                                    " · seq ",
                                    chunk.seq
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/command/CitationViewer.tsx",
                                lineNumber: 71,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/command/CitationViewer.tsx",
                        lineNumber: 62,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/components/command/CitationViewer.tsx",
                    lineNumber: 56,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/command/CitationViewer.tsx",
            lineNumber: 39,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/command/CitationViewer.tsx",
        lineNumber: 38,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/lib/query/synthesis.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Deterministic plain-English answer line — rendered above the chart so every
// result leads with its "so what". Pure templates over the graph payload; no
// LLM, so it is exactly as defensible as the graph itself. Anything the
// templates can't ground falls back to title + meta.
__turbopack_context__.s([
    "synthesize",
    ()=>synthesize
]);
const fallback = (g)=>g.meta.length ? `${g.title} — ${g.meta.join(" · ")}.` : `${g.title}.`;
// Cluster pills ship their size as a "· N" label suffix (e.g. "Industrials · 3").
// That decoration must never leak into a sentence — it reads as part of the name
// and, worse, doubles as a count the sentence claims to have derived itself.
const stripCount = (label)=>label.replace(/\s*·\s*\d+\s*$/, "");
function synthesize(g) {
    if (g.nodes.length === 0) return g.meta[0] || g.title;
    // Capability-aware branches first: a few walks share a mode but carry a
    // different node vocabulary (memos are documents, not claims; scatter has no
    // clusters), so the generic mode template would misread them.
    switch(g.capability_id){
        case "analyst-memos":
            return memos(g);
        case "scatter":
            return scatter(g);
        case "covenant-register":
            return covenantRegister(g);
        case "sponsor-graph":
            return sponsorGraph(g);
        case "head-to-head":
            return headToHead(g);
    }
    switch(g.mode){
        case "peers":
            return peers(g);
        case "contagion":
            return contagion(g);
        case "concentration":
            return concentration(g);
        case "provenance":
            return provenance(g);
        default:
            return fallback(g);
    }
}
function peers(g) {
    const center = g.nodes.find((n)=>n.kind === "center" || n.center);
    const byId = new Map(g.nodes.map((n)=>[
            n.id,
            n
        ]));
    const first = g.edges.find((e)=>e.label === "#1");
    const nearest = first ? byId.get(first.target === center?.id ? first.source : first.target) : undefined;
    const count = g.nodes.filter((n)=>n.kind === "issuer").length;
    if (!center || !nearest || !count) return fallback(g);
    const sector = nearest.group ? ` (${nearest.group})` : "";
    return `${center.label}'s nearest peer on credit profile is ${nearest.label}${sector}, of ${count} ranked by profile distance.`;
}
function contagion(g) {
    const driver = g.nodes.find((n)=>n.kind === "driver");
    const issuers = g.nodes.filter((n)=>n.kind === "issuer");
    const exposed = issuers.filter((n)=>n.exposed).length;
    if (!driver || issuers.length === 0) return fallback(g);
    return `${exposed} of ${issuers.length} issuers in coverage link to the ${driver.label} driver — a shared-exposure overlay.`;
}
function genuineSectorMember(edge, sectorIds, byId) {
    if (edge.kind !== "member") return null;
    const sectorId = sectorIds.has(edge.source) ? edge.source : sectorIds.has(edge.target) ? edge.target : null;
    if (!sectorId) return null;
    const otherId = sectorId === edge.source ? edge.target : edge.source;
    return byId.get(otherId)?.kind === "issuer" ? sectorId : null;
}
function sectorMemberCounts(g, sectors) {
    const sectorIds = new Set(sectors.map((sector)=>sector.id));
    const byId = new Map(g.nodes.map((node)=>[
            node.id,
            node
        ]));
    const members = new Map(sectors.map((sector)=>[
            sector.id,
            0
        ]));
    for (const edge of g.edges){
        const sectorId = genuineSectorMember(edge, sectorIds, byId);
        if (sectorId) members.set(sectorId, (members.get(sectorId) ?? 0) + 1);
    }
    return members;
}
function concentrationSummary(sectors, members) {
    const counts = sectors.map((sector)=>members.get(sector.id) ?? 0);
    const max = Math.max(...counts);
    const clusters = `Coverage splits into ${sectors.length} ${sectors.length === 1 ? "cluster" : "clusters"}`;
    if (max === 0) return `${clusters}.`;
    const leaders = sectors.filter((sector)=>(members.get(sector.id) ?? 0) === max);
    if (leaders.length > 1) return `${clusters}${counts.every((count)=>count === max) ? " — evenly split" : ""}.`;
    const top = stripCount(leaders[0].label);
    return `${clusters}; the largest is ${top} with ${max} ${max === 1 ? "name" : "names"}.`;
}
function concentration(g) {
    const sectors = g.nodes.filter((n)=>n.kind === "sector");
    if (sectors.length === 0) return fallback(g);
    // Count only genuine issuer members of each sector: a "member" edge whose one
    // endpoint is a sector and whose *other* endpoint is an issuer node. This
    // excludes hub↔sector edges (the wiki walk hangs sectors off a "center"), which
    // otherwise inflated every cluster by one; the sector's own "· N" label suffix
    // is likewise never read as a count.
    // A superlative is only honest with a strict maximum (no tie for first) and a
    // grounded count. On a tie or an ungrounded count, stay neutral — and call an
    // even split what it is.
    return concentrationSummary(sectors, sectorMemberCounts(g, sectors));
}
function provenance(g) {
    const count = (k)=>g.nodes.filter((n)=>n.kind === k).length;
    const modules = count("module");
    const claims = count("claim");
    const sources = count("evidence") + count("chunk");
    const flagged = g.nodes.filter((n)=>n.flag).length;
    if (!claims || !modules) return fallback(g);
    const tail = flagged ? `; ${flagged} flagged weak` : "";
    return `${claims} ${claims === 1 ? "claim" : "claims"} traced through ${modules} ${modules === 1 ? "module" : "modules"} to ${sources} ${sources === 1 ? "source" : "sources"}${tail}.`;
}
// Analyst memos ride the provenance mode but are documents linked to one focus
// issuer, not claims through modules — so count the memos honestly against the
// focus rather than falling through to the (name-repeating) meta join.
function memos(g) {
    const focus = g.nodes.find((n)=>n.kind === "center" || n.center);
    const n = g.nodes.filter((n)=>n.kind === "claim").length;
    if (!focus) return fallback(g);
    return `${n} analyst ${n === 1 ? "memo" : "memos"} linked to ${focus.label} across the vault.`;
}
// Scatter positions issuers on two metric axes — there are no clusters to name.
// Read the axes off the "x = …" / "y = …" meta entries (the builder emits them);
// only fall back to the canonical pair if both are literally present.
function scatter(g) {
    const issuers = g.nodes.filter((n)=>n.kind === "issuer").length;
    const axis = (p)=>{
        const raw = g.meta.find((m)=>m.trim().toLowerCase().startsWith(`${p} =`));
        if (!raw) return null;
        // "x = net leverage →" → "net leverage" (drop the axis-direction arrow).
        return raw.slice(raw.indexOf("=") + 1).replace(/[→↑↓←]/g, "").trim() || null;
    };
    const x = axis("x");
    const y = axis("y");
    if (!issuers || !x || !y) return fallback(g);
    return `${issuers} ${issuers === 1 ? "issuer" : "issuers"} positioned by ${x} × ${y}.`;
}
// Covenant register: issuers split by structure (maintenance vs cov-lite), read
// off each issuer node's group. Cov-lite is the loan-market norm — the "so what"
// is how many maintenance names run thin headroom (<1.0x), never a "largest
// cluster" superlative (that would misread a register as sector concentration).
function covenantRegister(g) {
    const issuers = g.nodes.filter((n)=>n.kind === "issuer");
    if (issuers.length === 0) return fallback(g);
    const maint = issuers.filter((n)=>n.group === "Maintenance covenant");
    const covlite = issuers.filter((n)=>n.group === "Cov-lite");
    const thin = maint.filter((n)=>n.flag).length;
    const tail = thin ? `; ${thin} running thin headroom (<1.0x)` : "";
    return `${issuers.length} ${issuers.length === 1 ? "issuer" : "issuers"} by covenant structure — ${maint.length} maintenance, ${covlite.length} cov-lite${tail}.`;
}
// Sponsor graph: issuers hung off sponsor hubs (kind "sector"). Name the sponsor
// backing the most names only on a strict maximum >1 (a book of one-name sponsors
// has no meaningful "largest").
function sponsorGraph(g) {
    const sponsors = g.nodes.filter((n)=>n.kind === "sector");
    const issuers = g.nodes.filter((n)=>n.kind === "issuer");
    if (sponsors.length === 0 || issuers.length === 0) return fallback(g);
    const sizes = new Map(sponsors.map((s)=>[
            s.id,
            0
        ]));
    for (const e of g.edges){
        if (e.kind !== "member") continue;
        const hub = sponsors.find((s)=>s.id === e.source || s.id === e.target);
        if (hub) sizes.set(hub.id, (sizes.get(hub.id) ?? 0) + 1);
    }
    const max = Math.max(...sizes.values());
    const leaders = sponsors.filter((s)=>(sizes.get(s.id) ?? 0) === max);
    const lead = leaders.length === 1 && max > 1 ? `; ${stripCount(leaders[0].label)} backs the most (${max})` : "";
    return `${issuers.length} sponsor-owned ${issuers.length === 1 ? "issuer" : "issuers"} across ${sponsors.length} ${sponsors.length === 1 ? "sponsor" : "sponsors"}${lead}.`;
}
// Head-to-head: one "sector" group node per compared row, two "issuer" members
// (one per side) underneath. The "so what" is the CP-3 relative-value read when
// both sides have one — higher composite percentile = stronger vs peers
// (relval.py's own polarity, not a judgment made here); anything else stays a
// neutral row count so the sentence never claims more than the data supports.
function headToHead(g) {
    const rows = g.nodes.filter((n)=>n.kind === "sector").length;
    if (!rows) return fallback(g);
    const base = `${g.title} compared across ${rows} ${rows === 1 ? "row" : "rows"}`;
    const rv = g.nodes.filter((n)=>n.kind === "issuer" && n.group === "CP-3 relative value");
    const pctOf = (n)=>{
        const m = n.sub?.match(/^(\d+(?:\.\d+)?)th pctile/);
        return m ? Number(m[1]) : null;
    };
    if (rv.length === 2) {
        const [a, b] = rv;
        const pa = pctOf(a);
        const pb = pctOf(b);
        if (pa !== null && pb !== null && pa !== pb) {
            const [stronger, weaker] = pa > pb ? [
                a,
                b
            ] : [
                b,
                a
            ];
            return `${base} — ${stronger.label} screens stronger on relative value than ${weaker.label}.`;
        }
    }
    return `${base}.`;
}
}),
"[project]/src/lib/csv.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "csvCell",
    ()=>csvCell,
    "downloadCsv",
    ()=>downloadCsv
]);
function csvCell(v) {
    if (v == null) return "";
    // Numbers pass through as numerics (negative figures must stay numbers in the
    // sheet); a non-finite value has no meaningful cell value — emit empty.
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
    let s = String(v);
    // CSV-injection guard (matrix 6.8): a leading =, +, -, @ (or tab/CR) makes
    // Excel/Sheets execute the cell as a formula. Untrusted labels and override
    // values are not trusted spreadsheet code — neutralize with a leading quote.
    if (/^[=+\-@\t\r\n]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function downloadCsv(filename, content) {
    const blob = new Blob([
        content
    ], {
        type: "text/csv;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
}),
"[project]/src/lib/query/export.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "downloadQueryCsv",
    ()=>downloadQueryCsv,
    "graphToCsv",
    ()=>graphToCsv
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$query$2f$synthesis$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/query/synthesis.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$csv$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/csv.ts [app-ssr] (ecmascript)");
;
;
function graphToCsv(graph) {
    const lines = [];
    lines.push([
        "CAOS Query",
        graph.title,
        graph.mode
    ].map(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$csv$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["csvCell"]).join(","));
    lines.push([
        "Synthesis",
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$query$2f$synthesis$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["synthesize"])(graph)
    ].map(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$csv$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["csvCell"]).join(","));
    lines.push([
        "Meta",
        ...graph.meta
    ].map(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$csv$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["csvCell"]).join(","));
    lines.push("");
    lines.push([
        "Nodes"
    ].map(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$csv$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["csvCell"]).join(","));
    lines.push([
        "id",
        "label",
        "kind",
        "group",
        "sub"
    ].map(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$csv$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["csvCell"]).join(","));
    graph.nodes.forEach((n)=>lines.push([
            n.id,
            n.label,
            n.kind,
            n.group,
            n.sub
        ].map(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$csv$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["csvCell"]).join(",")));
    lines.push("");
    lines.push([
        "Edges"
    ].map(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$csv$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["csvCell"]).join(","));
    lines.push([
        "source",
        "target",
        "label",
        "weight"
    ].map(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$csv$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["csvCell"]).join(","));
    graph.edges.forEach((e)=>lines.push([
            e.source,
            e.target,
            e.label,
            e.weight
        ].map(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$csv$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["csvCell"]).join(",")));
    if (graph.caveats.length) {
        lines.push("");
        lines.push([
            "Caveats"
        ].map(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$csv$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["csvCell"]).join(","));
        graph.caveats.forEach((c)=>lines.push([
                c
            ].map(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$csv$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["csvCell"]).join(",")));
    }
    return lines.join("\n");
}
function downloadQueryCsv(graph) {
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$csv$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["downloadCsv"])("CAOS Query - " + graph.title.replace(/[^\w.-]+/g, "_") + ".csv", graphToCsv(graph));
}
}),
"[project]/src/lib/query/routing.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ANALYST_MEMO_PROMPT",
    ()=>ANALYST_MEMO_PROMPT,
    "QUERY_KEYWORDS",
    ()=>QUERY_KEYWORDS,
    "rankQueryCapabilities",
    ()=>rankQueryCapabilities
]);
const ANALYST_MEMO_PROMPT = {
    id: "analyst-memos",
    text: "Show analyst notes / memos",
    sub: "vault links"
};
const QUERY_KEYWORDS = [
    [
        "profile",
        "peer-profile"
    ],
    [
        "peer",
        "peer-set"
    ],
    [
        "energy",
        "contagion"
    ],
    [
        "co-move",
        "contagion"
    ],
    [
        "contagion",
        "contagion"
    ],
    [
        "theme",
        "shared-theme"
    ],
    [
        "flag",
        "shared-theme"
    ],
    [
        "mention",
        "shared-theme"
    ],
    [
        "note",
        "analyst-memos"
    ],
    [
        "notes",
        "analyst-memos"
    ],
    [
        "memo",
        "analyst-memos"
    ],
    [
        "memos",
        "analyst-memos"
    ],
    [
        "analyst note",
        "analyst-memos"
    ],
    [
        "commentary",
        "analyst-memos"
    ],
    [
        "sector",
        "concentration-map"
    ],
    [
        "concentration",
        "concentration-map"
    ],
    [
        "cluster",
        "concentration-map"
    ],
    [
        "scatter",
        "scatter"
    ],
    [
        "percentile",
        "distribution"
    ],
    [
        "rank",
        "distribution"
    ],
    [
        "trend",
        "metric-trend"
    ],
    // Metric keywords: the scatter walk IS leverage × interest-coverage, so route
    // "which issuers have leverage above 5x" there; net debt is the same cross-plot.
    [
        "leverage",
        "scatter"
    ],
    [
        "coverage",
        "scatter"
    ],
    [
        "interest coverage",
        "scatter"
    ],
    [
        "net debt",
        "scatter"
    ],
    [
        "ebitda",
        "distribution"
    ],
    [
        "margin",
        "distribution"
    ],
    [
        "verdict",
        "trace-source"
    ],
    [
        "trace",
        "trace-source"
    ],
    [
        "source",
        "trace-source"
    ],
    [
        "lineage",
        "lineage-audit"
    ],
    [
        "orphan",
        "orphan-claims"
    ],
    [
        "ungrounded",
        "orphan-claims"
    ],
    [
        "impact",
        "impact-analysis"
    ],
    [
        "coverage",
        "coverage-completeness"
    ],
    [
        "finding",
        "open-findings"
    ],
    [
        "lane",
        "gate-lane"
    ],
    [
        "committee",
        "committee-board"
    ],
    [
        "debate",
        "debate-digest"
    ],
    [
        "tension",
        "tension"
    ],
    [
        "disagree",
        "tension"
    ],
    [
        "sponsor",
        "sponsor-graph"
    ]
];
function rankQueryCapabilities(text, capabilities) {
    const q = text.trim().toLowerCase();
    const tokens = q.split(/\W+/).filter(Boolean);
    const aliasBy = new Map();
    for (const [kw, id] of QUERY_KEYWORDS)aliasBy.set(id, [
        ...aliasBy.get(id) ?? [],
        kw
    ]);
    return capabilities.map((c)=>{
        const labelWords = c.label.toLowerCase().split(/\W+/);
        let s = 0;
        for (const a of aliasBy.get(c.id) ?? [])if (q.includes(a)) s += 2;
        for (const t of tokens)if (labelWords.includes(t)) s += 1;
        return {
            c,
            s
        };
    }).filter((x)=>x.s > 0).sort((a, b)=>b.s - a.s || Number(b.c.enabled) - Number(a.c.enabled));
}
}),
"[project]/src/lib/query/views.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Which renderers make sense for a graph — keyed by capability first (specific
// overrides), then render mode. A view outside this list degrades into nonsense
// (a peer set has no lineage steps; layout x/y are not metric axes), so the
// switcher must never offer it. First entry = the native view a fresh run opens on.
__turbopack_context__.s([
    "VIEW_LABELS",
    ()=>VIEW_LABELS,
    "coerceView",
    ()=>coerceView,
    "nativeView",
    ()=>nativeView,
    "viewsFor",
    ()=>viewsFor
]);
const VIEW_LABELS = {
    graph: "Graph",
    trace: "Lineage",
    rv: "Table",
    scatter: "Scatter"
};
// Capability-first overrides, so the NATIVE (first) view fits the walk's actual
// shape. List-shaped walks (a ranked peer set, a handful of concentration
// clusters, a note list of memos) read as a table first — a sparse node-link
// graph buries the ranking they exist to convey — with graph kept one click away
// for the cases where topology is genuinely the answer. Scatter is the only
// honest metric-axis plot, so it stays scatter-native.
const BY_CAP = {
    scatter: [
        "scatter",
        "rv"
    ],
    "peer-set": [
        "rv",
        "graph"
    ],
    "concentration-map": [
        "rv",
        "graph"
    ],
    // Rating distribution is a bucket table first (IG/BB/B/CCC), hub-graph second.
    "rating-distribution": [
        "rv",
        "graph"
    ],
    // Portfolio exposure is a sector-concentration cluster graph first, table second.
    "portfolio-exposure": [
        "graph",
        "rv"
    ],
    // Memos are a note list with no lineage edges — Lineage renders empty columns,
    // so this override lands before BY_MODE provenance's trace-native default.
    "analyst-memos": [
        "rv",
        "graph"
    ],
    // A covenant register is a table of names × covenant terms first; hub-graph second.
    "covenant-register": [
        "rv",
        "graph"
    ],
    // Head-to-head is a table of compared rows (metric x two issuers) first;
    // hub-graph second — same shape as covenant-register.
    "head-to-head": [
        "rv",
        "graph"
    ],
    // Sponsor is a hub topology, not a lineage trace — pin it to graph, never the
    // "trace" renderer its provenance mode would otherwise default to.
    "sponsor-graph": [
        "graph",
        "rv"
    ]
};
const BY_MODE = {
    peers: [
        "graph",
        "rv"
    ],
    contagion: [
        "graph",
        "rv"
    ],
    concentration: [
        "graph",
        "rv"
    ],
    provenance: [
        "trace",
        "graph",
        "rv"
    ]
};
function viewsFor(capabilityId, mode) {
    if (capabilityId && BY_CAP[capabilityId]) return BY_CAP[capabilityId];
    if (mode && BY_MODE[mode]) return BY_MODE[mode];
    return [
        "graph",
        "rv"
    ];
}
function nativeView(capabilityId, mode) {
    return viewsFor(capabilityId, mode)[0];
}
function coerceView(view, capabilityId, mode) {
    const views = viewsFor(capabilityId, mode);
    return views.includes(view) ? view : views[0];
}
}),
"[project]/src/lib/analysis-workbench.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "activeFindings",
    ()=>activeFindings,
    "analysisApi",
    ()=>analysisApi,
    "contextHref",
    ()=>contextHref,
    "mergeContextIntoCurrentUrl",
    ()=>mergeContextIntoCurrentUrl,
    "useAnalysisContext",
    ()=>useAnalysisContext
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/axios/lib/axios.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AuthProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/AuthProvider.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function marketWorkbookForm(body) {
    const form = new FormData();
    form.append("file", body.file);
    form.append("mapping", JSON.stringify(body.mapping));
    form.append("issuer_mappings", JSON.stringify(body.issuerMappings ?? {}));
    return form;
}
const analysisApi = {
    getTaxonomy: ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].get("/api/analysis/taxonomy").then((response)=>response.data.sectors),
    createContext: (body)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].post("/api/analysis/contexts", body).then((response)=>response.data),
    getContext: (id)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].get(`/api/analysis/contexts/${encodeURIComponent(id)}`).then((response)=>response.data),
    patchContext: (id, body)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].patch(`/api/analysis/contexts/${id}`, body).then((response)=>response.data),
    listInsights: (contextId, filters = {})=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].get(`/api/analysis/contexts/${contextId}/insights`, {
            params: filters
        }).then((response)=>response.data),
    createInsight: (contextId, body)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].post(`/api/analysis/contexts/${contextId}/insights`, body).then((response)=>response.data),
    ratifyInsight: (id)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].post(`/api/analysis/insights/${id}/ratify`).then((response)=>response.data),
    rejectInsight: (id)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].post(`/api/analysis/insights/${id}/reject`).then((response)=>response.data),
    listFindings: (contextId)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].get("/api/analysis/findings", {
            params: {
                context_id: contextId
            }
        }).then((response)=>response.data),
    createFinding: (body)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].post("/api/analysis/findings", body).then((response)=>response.data),
    // Unpin = archive, not delete: the register keeps the row (audit trail) but
    // every tray/count reads findings through activeFindings() so an archived
    // finding disappears from downstream surfaces.
    archiveFinding: (id)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].patch(`/api/analysis/findings/${id}`, {
            status: "archived"
        }).then((response)=>response.data),
    createQueryRun: (body)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].post("/api/query/runs", body).then((response)=>response.data),
    listQueryRuns: (contextId)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].get("/api/query/runs", {
            params: {
                context_id: contextId
            }
        }).then((response)=>response.data),
    createSectorReview: (body)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].post("/api/sector/reviews", body).then((response)=>response.data),
    listSectorReviews: (contextId)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].get("/api/sector/reviews", {
            params: {
                context_id: contextId
            }
        }).then((response)=>response.data),
    ratifySectorReview: (reviewId, sections)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].post(`/api/sector/reviews/${reviewId}/ratifications`, {
            sections
        }).then((response)=>response.data),
    publishSectorReview: (reviewId)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].post(`/api/sector/reviews/${reviewId}/publish`).then((response)=>response.data),
    createRVScreen: (body)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].post("/api/rv/screens", body).then((response)=>response.data),
    listMarketSnapshots: ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].get("/api/rv/snapshots").then((response)=>response.data.snapshots),
    previewMarketWorkbook: (body)=>{
        const form = marketWorkbookForm(body);
        return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].post("/api/rv/snapshots/import/preview", form).then((response)=>response.data);
    },
    commitMarketWorkbook: (body)=>{
        const form = marketWorkbookForm(body);
        form.append("preview_sha256", body.preview.workbook_sha256);
        form.append("preview_token", body.preview.preview_token);
        form.append("source_label", body.sourceLabel);
        return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].post("/api/rv/snapshots/import/commit", form).then((response)=>response.data);
    },
    getRVScreen: (id)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].get(`/api/rv/screens/${id}`).then((response)=>response.data),
    ratifyRVCandidate: (runId, candidateId, analystOverride)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"].post(`/api/rv/screens/${runId}/ratifications`, {
            candidate_id: candidateId,
            analyst_override: analystOverride
        }).then((response)=>response.data)
};
function activeFindings(rows) {
    return rows.filter((finding)=>finding.status !== "archived");
}
function contextHref(path, contextId, params = {}) {
    const search = new URLSearchParams({
        context: contextId,
        ...params
    });
    return `${path}?${search.toString()}`;
}
function mergeContextIntoCurrentUrl(href, contextId) {
    const current = new URL(href);
    if (!current.searchParams.has("context")) current.searchParams.set("context", contextId);
    return `${current.pathname}${current.search}${current.hash}`;
}
function sameJsonValue(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
function sparseNestedDelta(incoming, current) {
    return Object.fromEntries(Object.entries(incoming).filter(([key, value])=>!sameJsonValue(value, current[key])));
}
const sparseArtifacts = (artifacts, current)=>sparseNestedDelta(artifacts, current.artifacts);
const sparseSurfaceEntry = (entry, currentEntry)=>{
    const entryDelta = sparseNestedDelta(entry, currentEntry);
    if (!entry.filters) return entryDelta;
    const filterDelta = sparseNestedDelta(entry.filters, currentEntry.filters ?? {});
    if (Object.keys(filterDelta).length > 0) entryDelta.filters = filterDelta;
    else delete entryDelta.filters;
    return entryDelta;
};
const sparseSurfaceState = (surfaceState, current)=>{
    const delta = {};
    for (const [surface, entry] of Object.entries(surfaceState)){
        if (!entry) continue;
        const entryDelta = sparseSurfaceEntry(entry, current.surface_state[surface] ?? {});
        if (Object.keys(entryDelta).length > 0) delta[surface] = entryDelta;
    }
    return delta;
};
function sparseContextPatch(changes, current) {
    const sparse = {
        ...changes
    };
    if (changes.artifacts) sparse.artifacts = sparseArtifacts(changes.artifacts, current);
    if (changes.surface_state) sparse.surface_state = sparseSurfaceState(changes.surface_state, current);
    if (changes.filters) sparse.filters = sparseNestedDelta(changes.filters, current.filters);
    if (changes.selected) sparse.selected = sparseNestedDelta(changes.selected, current.selected);
    return sparse;
}
const pendingContextCreates = new Map();
function createContextOnce(defaults, principalId, principalGeneration) {
    const key = `${principalId}@${principalGeneration}|${defaults.name}|${defaults.sector_id ?? ""}`;
    const pending = pendingContextCreates.get(key);
    if (pending) return pending;
    const created = analysisApi.createContext({
        name: defaults.name,
        sector_id: defaults.sector_id
    }).finally(()=>pendingContextCreates.delete(key));
    pendingContextCreates.set(key, created);
    return created;
}
const requestedContextFromLocation = (hasExplicitContextId, requestedContextId)=>hasExplicitContextId ? requestedContextId ?? null : new URL(window.location.href).searchParams.get("context");
const publishLoadedContext = (value, contextId)=>{
    window.dispatchEvent(new CustomEvent("caos:analysis-context", {
        detail: value
    }));
    if (contextId) return;
    window.history.replaceState(window.history.state, "", mergeContextIntoCurrentUrl(window.location.href, value.id));
    window.dispatchEvent(new PopStateEvent("popstate"));
};
const useContextLoad = (defaults, principalId, principalGeneration)=>{
    const defaultName = defaults.name;
    const defaultSectorId = defaults.sector_id;
    const hasExplicitContextId = Object.prototype.hasOwnProperty.call(defaults, "context_id");
    const requestedContextId = defaults.context_id;
    const [context, setContext] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const loadGeneration = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(0);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const generation = ++loadGeneration.current;
        let cancelled = false;
        const currentLoad = ()=>!cancelled && generation === loadGeneration.current;
        const load = async ()=>{
            setLoading(true);
            setError(null);
            setContext(null);
            const contextId = requestedContextFromLocation(hasExplicitContextId, requestedContextId);
            try {
                const value = contextId ? await analysisApi.getContext(contextId) : await createContextOnce({
                    name: defaultName,
                    sector_id: defaultSectorId
                }, principalId, principalGeneration);
                if (!currentLoad()) return;
                setContext(value);
                publishLoadedContext(value, contextId);
            } catch (reason) {
                if (!currentLoad()) return;
                setError((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toErrorMessage"])(reason, "Analysis context unavailable."));
                window.dispatchEvent(new Event("caos:analysis-context-error"));
            } finally{
                if (currentLoad()) setLoading(false);
            }
        };
        void load();
        return ()=>{
            cancelled = true;
        };
    }, [
        defaultName,
        defaultSectorId,
        hasExplicitContextId,
        principalGeneration,
        principalId,
        requestedContextId
    ]);
    return {
        context,
        setContext,
        loading,
        error
    };
};
const patchContextWithConflictRetry = async (contextId, current, sparseChanges, scopeIsCurrent)=>{
    try {
        return await analysisApi.patchContext(contextId, {
            ...sparseChanges,
            expected_revision: current.revision
        });
    } catch (reason) {
        const conflict = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"].isAxiosError(reason) && reason.response?.status === 409;
        if (!conflict) throw reason;
        const refreshed = await analysisApi.getContext(contextId);
        if (!scopeIsCurrent()) return null;
        return analysisApi.patchContext(contextId, {
            ...sparseChanges,
            expected_revision: refreshed.revision
        });
    }
};
const performContextPatch = async (contextId, sparseChanges, scopeGeneration, requestId, refs, setContext, setMutationState, setMutationError)=>{
    const current = refs.context.current;
    const scopeIsCurrent = ()=>scopeGeneration === refs.scopeGeneration.current;
    if (!current || current.id !== contextId || !scopeIsCurrent()) return null;
    try {
        const value = await patchContextWithConflictRetry(contextId, current, sparseChanges, scopeIsCurrent);
        if (!value || !scopeIsCurrent()) return null;
        refs.context.current = value;
        setContext((active)=>active?.id === contextId ? value : active);
        if (requestId === refs.request.current) {
            refs.lastPatch.current = null;
            setMutationState("idle");
            setMutationError(null);
        }
        return value;
    } catch (reason) {
        if (scopeIsCurrent() && requestId === refs.request.current) {
            setMutationState("error");
            setMutationError((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toErrorMessage"])(reason, "Analysis context was not saved."));
        }
        throw reason;
    }
};
const useContextMutation = (context, setContext, scopeKey)=>{
    const [mutationState, setMutationState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("idle");
    const [mutationError, setMutationError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const contextRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const scopeGeneration = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(0);
    const request = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(0);
    const lastPatch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const mutationQueue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(Promise.resolve());
    contextRef.current = context;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        scopeGeneration.current += 1;
        request.current += 1;
        lastPatch.current = null;
        mutationQueue.current = Promise.resolve();
        setMutationState("idle");
        setMutationError(null);
    }, [
        scopeKey
    ]);
    const patch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(async (changes)=>{
        const initial = contextRef.current;
        if (!initial) return null;
        const sparseChanges = sparseContextPatch(changes, initial);
        const contextId = initial.id;
        const patchScope = scopeGeneration.current;
        const requestId = ++request.current;
        lastPatch.current = sparseChanges;
        setMutationState("saving");
        setMutationError(null);
        const refs = {
            context: contextRef,
            scopeGeneration,
            request,
            lastPatch
        };
        const operation = mutationQueue.current.catch(()=>undefined).then(()=>performContextPatch(contextId, sparseChanges, patchScope, requestId, refs, setContext, setMutationState, setMutationError));
        mutationQueue.current = operation;
        return operation;
    }, [
        setContext
    ]);
    const retryLastPatch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        const changes = lastPatch.current;
        return changes ? patch(changes) : Promise.resolve(null);
    }, [
        patch
    ]);
    return {
        patch,
        mutationState,
        mutationError,
        retryLastPatch
    };
};
function useAnalysisContext(defaults) {
    const { user, principalGeneration = 0 } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AuthProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuth"])();
    const principalId = user?.id ?? "unresolved";
    const { context, setContext, loading, error } = useContextLoad(defaults, principalId, principalGeneration);
    const contextIdMode = Object.prototype.hasOwnProperty.call(defaults, "context_id") ? "explicit" : "implicit";
    const scopeKey = `${principalId}@${principalGeneration}|${defaults.name}|${defaults.sector_id ?? ""}|${contextIdMode}|${defaults.context_id ?? ""}`;
    const { patch, mutationState, mutationError, retryLastPatch } = useContextMutation(context, setContext, scopeKey);
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>({
            context,
            setContext,
            patch,
            loading,
            error,
            mutationState,
            mutationError,
            retryLastPatch
        }), [
        context,
        setContext,
        patch,
        loading,
        error,
        mutationState,
        mutationError,
        retryLastPatch
    ]);
}
}),
"[project]/src/components/shared/Ask.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AskLauncher",
    ()=>AskLauncher,
    "AskProvider",
    ()=>AskProvider,
    "useAsk",
    ()=>useAsk
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// Global "Ask" launcher — one entry point to the conversational surface, scoped
// by where the analyst is. Alt+K (or the ⌘K palette's Ask row) opens it; Esc closes.
// On the issuer-scoped concepts (Deep-Dive, Model) it opens the ATLF issuer Q&A;
// elsewhere it opens the cross-issuer NL query. Deep-Dive owns its own
// evidence-synced chat (rendered inside its EvidenceSyncProvider) and only reads
// `open` from this context, so the launcher never double-mounts a chat there.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/CloseButton.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/shared/lib/app-dynamic.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ModalBackdrop.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$IssuerChat$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/deepdive/IssuerChat.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useLiveRun$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/engine/useLiveRun.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/engine/types.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/use-modal-a11y.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AuthProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/AuthProvider.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/pipeline/sev.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$command$2f$CitationViewer$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/command/CitationViewer.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$query$2f$export$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/query/export.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$query$2f$routing$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/query/routing.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$query$2f$views$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/query/views.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/analysis-workbench.ts [app-ssr] (ecmascript)");
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
const loadGraphCanvas = ()=>__turbopack_context__.A("[project]/src/components/query/GraphCanvas.tsx [app-ssr] (ecmascript, async loader)").then((module)=>module.GraphCanvas);
const loadRelativeValueTable = ()=>__turbopack_context__.A("[project]/src/components/query/RelativeValueTable.tsx [app-ssr] (ecmascript, async loader)").then((module)=>module.RelativeValueTable);
const loadScatterCanvas = ()=>__turbopack_context__.A("[project]/src/components/query/ScatterCanvas.tsx [app-ssr] (ecmascript, async loader)").then((module)=>module.ScatterCanvas);
const loadLineageFlow = ()=>__turbopack_context__.A("[project]/src/components/query/LineageFlow.tsx [app-ssr] (ecmascript, async loader)").then((module)=>module.LineageFlow);
function AskResultRendererLoading() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        role: "status",
        "aria-live": "polite",
        className: "min-h-48 flex items-center justify-center tabular text-caos-xs text-caos-muted",
        children: "Loading result view…"
    }, void 0, false, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 36,
        columnNumber: 5
    }, this);
}
const GraphCanvas = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"])(loadGraphCanvas, {
    ssr: false,
    loading: AskResultRendererLoading
});
const RelativeValueTable = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"])(loadRelativeValueTable, {
    ssr: false,
    loading: AskResultRendererLoading
});
const ScatterCanvas = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"])(loadScatterCanvas, {
    ssr: false,
    loading: AskResultRendererLoading
});
const LineageFlow = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"])(loadLineageFlow, {
    ssr: false,
    loading: AskResultRendererLoading
});
function prefetchAskResultRenderers() {
    void Promise.all([
        loadGraphCanvas(),
        loadRelativeValueTable(),
        loadScatterCanvas(),
        loadLineageFlow()
    ]).catch(()=>undefined);
}
const Ctx = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])({
    open: false,
    setOpen: ()=>{},
    toggle: ()=>{},
    openWith: ()=>{},
    prefill: null
});
const useAsk = ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(Ctx);
const PROMPTS_BY_CONCEPT = {
    command: [
        {
            id: "peer-set",
            text: "Map today's closest credit peers",
            sub: "issuer graph · CP-1C"
        },
        {
            id: "scatter",
            text: "Plot leverage × interest coverage across covered names",
            sub: "cross-issuer scatter"
        },
        {
            id: "open-findings",
            text: "Show open QA findings",
            sub: "governance"
        },
        {
            id: "trace-source",
            text: "Trace an IC verdict to its sources",
            sub: "provenance walk"
        },
        {
            id: "concentration-map",
            text: "Cluster coverage by sector",
            sub: "sector clusters"
        }
    ],
    monitor: [
        {
            id: "open-findings",
            text: "Surface live QA exceptions",
            sub: "governance"
        },
        {
            id: "coverage-completeness",
            text: "Find coverage gaps",
            sub: "coverage health"
        },
        {
            id: "impact-analysis",
            text: "Map affected downstream conclusions",
            sub: "impact analysis"
        },
        {
            id: "lineage-audit",
            text: "Audit stale lineage",
            sub: "provenance"
        }
    ],
    research: [
        {
            id: "shared-theme",
            text: "Find repeated themes across notes",
            sub: "semantic theme walk"
        },
        {
            id: "trace-source",
            text: "Trace research claims to sources",
            sub: "provenance walk"
        },
        {
            id: "orphan-claims",
            text: "Show ungrounded claims",
            sub: "QA"
        },
        {
            id: "committee-board",
            text: "Build the committee question board",
            sub: "IC prep"
        },
        {
            id: "debate-digest",
            text: "Digest competing credit arguments",
            sub: "research synthesis"
        }
    ],
    pipeline: [
        {
            id: "coverage-completeness",
            text: "Find missing pipeline coverage",
            sub: "coverage health"
        },
        {
            id: "gate-lane",
            text: "Show items blocked at gates",
            sub: "workflow lane"
        },
        {
            id: "impact-analysis",
            text: "Map downstream impact of a blocker",
            sub: "impact analysis"
        },
        {
            id: "open-findings",
            text: "List QA findings by issuer",
            sub: "governance"
        }
    ],
    deepdive: [
        {
            id: "trace-source",
            text: "Trace this issuer's verdict to sources",
            sub: "provenance walk"
        },
        {
            id: "peer-set",
            text: "Map comparable issuers",
            sub: "issuer graph · CP-1C"
        },
        {
            id: "metric-trend",
            text: "Show metric trend context",
            sub: "time series"
        },
        {
            id: "tension",
            text: "Find tensions in the credit view",
            sub: "debate"
        },
        {
            id: "open-findings",
            text: "Show open QA findings",
            sub: "governance"
        }
    ],
    model: [
        {
            id: "metric-trend",
            text: "Show historical model drivers",
            sub: "time series"
        },
        {
            id: "scatter",
            text: "Plot leverage × coverage by issuer",
            sub: "cross-issuer scatter"
        },
        {
            id: "impact-analysis",
            text: "Map scenario impact",
            sub: "impact analysis"
        },
        {
            id: "distribution",
            text: "Rank issuers by downside pressure",
            sub: "distribution"
        },
        {
            id: "trace-source",
            text: "Trace model inputs to sources",
            sub: "provenance walk"
        }
    ],
    reports: [
        {
            id: "orphan-claims",
            text: "Find report claims without support",
            sub: "QA"
        },
        {
            id: "trace-source",
            text: "Trace report verdicts to evidence",
            sub: "provenance walk"
        },
        {
            id: "committee-board",
            text: "Build committee questions",
            sub: "IC prep"
        },
        {
            id: "debate-digest",
            text: "Digest the credit debate",
            sub: "research synthesis"
        },
        {
            id: "open-findings",
            text: "Show open report QA findings",
            sub: "governance"
        }
    ],
    query: [
        {
            id: "peer-set",
            text: "Map peers by credit profile",
            sub: "issuer graph · CP-1C"
        },
        {
            id: "contagion",
            text: "Co-move under an energy shock",
            sub: "contagion overlay · CP-2"
        },
        {
            id: "concentration-map",
            text: "Cluster coverage by sector",
            sub: "sector clusters"
        },
        {
            id: "scatter",
            text: "Plot leverage × coverage",
            sub: "cross-issuer scatter"
        },
        {
            id: "trace-source",
            text: "Trace the IC verdict to its sources",
            sub: "provenance walk"
        },
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$query$2f$routing$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ANALYST_MEMO_PROMPT"]
    ],
    "sector-rv": [
        {
            id: "peer-set",
            text: "Map RV tails to closest credit peers",
            sub: "issuer graph · CP-1C"
        },
        {
            id: "scatter",
            text: "Plot RV names against leverage and coverage",
            sub: "cross-issuer scatter"
        },
        {
            id: "distribution",
            text: "Rank downside pressure in this sector",
            sub: "distribution"
        },
        {
            id: "trace-source",
            text: "Trace RV conclusions to evidence",
            sub: "provenance walk"
        },
        {
            id: "debate-digest",
            text: "Digest the relative-value debate",
            sub: "research synthesis"
        }
    ]
};
function AskProvider({ children }) {
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [prefill, setPrefill] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["usePathname"])() || "";
    const pathRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(pathname);
    pathRef.current = pathname;
    // One toggle for the Ask entry points (Alt+K via ConceptHotkeys and the
    // header Ask button): the same gesture must do the same thing — on /query it
    // focuses the query bar, else it toggles the modal. ⌘K/Ctrl+K now belongs to
    // the global command palette (CommandPalette.tsx), whose "Ask CAOS" row
    // routes back here through openWith() — muscle-memory text is preserved.
    const openWith = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((text)=>{
        if (pathRef.current.startsWith("/query")) {
            // Carry the typed text through — a bare Event has no payload, so
            // ⌘K → type a question → Enter on /query used to focus (nothing,
            // actually — see below) an empty composer and silently drop the
            // question the analyst just typed.
            window.dispatchEvent(new CustomEvent("caos:query-focus", {
                detail: {
                    text
                }
            }));
            return;
        }
        window.dispatchEvent(new CustomEvent("caos:modal-open", {
            detail: {
                owner: "ask"
            }
        }));
        setPrefill(text ?? null);
        setOpen(true);
    }, []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const fire = ()=>{
            if (pathname.startsWith("/query")) {
                window.dispatchEvent(new Event("caos:query-focus"));
            } else {
                if (!open) window.dispatchEvent(new CustomEvent("caos:modal-open", {
                    detail: {
                        owner: "ask"
                    }
                }));
                setOpen(!open);
            }
        };
        const onKey = (e)=>{
            // AskModal (and anything opened over it, e.g. a citation viewer) is
            // itself a useModalA11y-tracked overlay whose own topmost-gated
            // handler already owns Escape correctly. This coordinator-level
            // listener exists for the inline issuer-scoped Ask panel, which isn't
            // a useModalA11y dialog — defer whenever a tracked overlay is open so
            // this doesn't fire in parallel and collapse the wrong layer.
            if (e.key === "Escape" && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["hasOpenModalA11yOverlay"])()) setOpen(false);
        };
        const onAskToggle = ()=>fire();
        const onModalOpen = (event)=>{
            if (event.detail?.owner !== "ask") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("caos:ask-toggle", onAskToggle);
        window.addEventListener("caos:modal-open", onModalOpen);
        return ()=>{
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("caos:ask-toggle", onAskToggle);
            window.removeEventListener("caos:modal-open", onModalOpen);
        };
    }, [
        pathname,
        open
    ]);
    // Clear the one-shot prefill when Ask closes so a later plain open is clean.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!open) setPrefill(null);
    }, [
        open
    ]);
    const setOpenCoordinated = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((next)=>{
        if (next) window.dispatchEvent(new CustomEvent("caos:modal-open", {
            detail: {
                owner: "ask"
            }
        }));
        setOpen(next);
    }, []);
    const toggle = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        if (!open) window.dispatchEvent(new CustomEvent("caos:modal-open", {
            detail: {
                owner: "ask"
            }
        }));
        setOpen(!open);
    }, [
        open
    ]);
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>({
            open,
            setOpen: setOpenCoordinated,
            toggle,
            openWith,
            prefill
        }), [
        open,
        setOpenCoordinated,
        toggle,
        openWith,
        prefill
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Ctx.Provider, {
        value: value,
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 225,
        columnNumber: 10
    }, this);
}
// Where the conversation is scoped. Deep-Dive is split out because it renders
// its own evidence-aware chat from `open`.
function scopeFor(pathname) {
    if (pathname.startsWith("/deepdive")) return "deepdive";
    if (pathname.startsWith("/model") || pathname.startsWith("/pipeline") || pathname.startsWith("/issuers/profile")) return "issuer";
    return "cross";
}
function conceptFor(pathname) {
    const first = pathname.split("/").filter(Boolean)[0] || "command";
    return first in PROMPTS_BY_CONCEPT ? first : "query";
}
// Issuer-scoped Ask: resolves the issuer from the route and grounds IssuerChat in
// that issuer's OWN live run. For the reference deal it passes live=undefined so the
// chat keeps the ATLF showcase fixtures; for a real issuer it passes the live run, so
// the assistant answers from the issuer's own numbers (or the explicit "no run — don't
// use Atlas Forge" branch in caosChatContext) instead of fabricating Atlas Forge's
// figures. Split into its own component so useLiveRun is unconditional and only
// mounts when the issuer-scoped Ask is actually open.
function IssuerScopedAsk({ onClose }) {
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const issuerId = searchParams?.get("issuer") || __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ATLF_REFERENCE_ISSUER_ID"];
    const isReference = issuerId === __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$types$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ATLF_REFERENCE_ISSUER_ID"];
    const live = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$useLiveRun$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useLiveRun"])(issuerId);
    const [issuerName, setIssuerName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(undefined);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (isReference) {
            setIssuerName(undefined);
            return;
        }
        let stale = false;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getIssuer"])(issuerId).then((d)=>{
            if (!stale) setIssuerName(d.name);
        }).catch(()=>{});
        return ()=>{
            stale = true;
        };
    }, [
        issuerId,
        isReference
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$deepdive$2f$IssuerChat$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["IssuerChat"], {
        tab: "",
        onClose: onClose,
        live: isReference ? undefined : live,
        issuerName: issuerName
    }, void 0, false, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 262,
        columnNumber: 5
    }, this);
}
function AskLauncher() {
    const { open, setOpen, toggle } = useAsk();
    const { user, needsLogin } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AuthProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuth"])();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["usePathname"])() || "";
    const scope = scopeFor(pathname);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (open) prefetchAskResultRenderers();
    }, [
        open
    ]);
    // Close on navigation — the overlay is transient, so changing concept
    // shouldn't carry a stale Ask (or pop the wrong-scope surface on arrival).
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        setOpen(false);
    }, [
        pathname,
        setOpen
    ]);
    // Gate on a signed-in profile: Ask queries need an analyst identity, and the
    // launcher must not float over the login landing (it sits in the root layout,
    // outside RequireAuth). Loading/error/needs-login all resolve to "not ready".
    if (!user || needsLogin) return null;
    if (pathname.startsWith("/query")) return null;
    const triggerPosition = pathname.startsWith("/sector") || pathname.startsWith("/command") ? "bottom-16 right-3" : "bottom-3 right-3";
    // Floating trigger, hidden while open. Deep-Dive also has an in-panel ASK
    // button, but this keeps ⌘K discoverable everywhere.
    const trigger = !open ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        onClick: toggle,
        onPointerEnter: prefetchAskResultRenderers,
        onFocus: prefetchAskResultRenderers,
        title: "Ask CAOS (Alt+K, or via the ⌘K palette) — cross-issuer query, or issuer Q&A in Deep-Dive / Model",
        className: `caos-ask-launcher fixed ${triggerPosition} z-overlay flex items-center gap-1.5 tabular text-caos-md px-2.5 py-1.5 rounded-full border border-caos-accent/60 bg-caos-panel text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring`,
        style: {
            boxShadow: "var(--shadow-pop)"
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskMark, {}, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 309,
                columnNumber: 7
            }, this),
            " Ask",
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xs px-1 rounded border border-caos-border",
                children: "Alt+K"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 310,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 301,
        columnNumber: 5
    }, this) : null;
    // Deep-Dive renders its own chat from `open`; the launcher only supplies the trigger.
    if (scope === "deepdive") return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "caos-ask-dock contents",
        children: trigger
    }, void 0, false, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 315,
        columnNumber: 36
    }, this);
    if (!open) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "caos-ask-dock contents",
        children: trigger
    }, void 0, false, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 316,
        columnNumber: 21
    }, this);
    // Model and other issuer-scoped concepts → the issuer Q&A slide-over, grounded in
    // the CURRENT issuer's live run (never the ATLF fixture, unless this IS the
    // reference deal). Only mounts when open, so useLiveRun fires only on demand. (F11)
    if (scope === "issuer") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "caos-ask-dock contents",
            children: [
                trigger,
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(IssuerScopedAsk, {
                    onClose: ()=>setOpen(false)
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/Ask.tsx",
                    lineNumber: 322,
                    columnNumber: 61
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/shared/Ask.tsx",
            lineNumber: 322,
            columnNumber: 12
        }, this);
    }
    // Everywhere else → the cross-issuer NL query, as a centered modal.
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "caos-ask-dock contents",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskModal, {
            pathname: pathname,
            onClose: ()=>setOpen(false)
        }, void 0, false, {
            fileName: "[project]/src/components/shared/Ask.tsx",
            lineNumber: 326,
            columnNumber: 50
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 326,
        columnNumber: 10
    }, this);
}
function useAskQueryState(prefill) {
    const [graph, setGraph] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [graphErr, setGraphErr] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [running, setRunning] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [text, setText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(prefill ?? "");
    const [note, setNote] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [suggest, setSuggest] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [cite, setCite] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [selectedNode, setSelectedNode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [readerOpen, setReaderOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [hasQueried, setHasQueried] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [layout, setLayout] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("graph");
    const [queryRun, setQueryRun] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const resetSearch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        setHasQueried(false);
        setGraph(null);
        setGraphErr(null);
        setNote(null);
        setSuggest([]);
        setText("");
    }, []);
    const openNode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((node)=>{
        setSelectedNode(node);
        setReaderOpen(true);
    }, []);
    return {
        graph,
        setGraph,
        graphErr,
        setGraphErr,
        running,
        setRunning,
        text,
        setText,
        note,
        setNote,
        suggest,
        setSuggest,
        cite,
        setCite,
        selectedNode,
        setSelectedNode,
        readerOpen,
        setReaderOpen,
        hasQueried,
        setHasQueried,
        layout,
        setLayout,
        queryRun,
        setQueryRun,
        resetSearch,
        openNode
    };
}
function useAskCapabilities(concept) {
    const [caps, setCaps] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [capsErr, setCapsErr] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const capById = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        const map = new Map();
        caps?.groups.forEach((group)=>group.capabilities.forEach((capability)=>map.set(capability.id, capability)));
        return map;
    }, [
        caps
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        let cancelled = false;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["queryCapabilities"])().then((result)=>{
            if (!cancelled) setCaps(result);
        }).catch((error)=>{
            if (!cancelled) setCapsErr(error?.message || "could not load capabilities");
        });
        return ()=>{
            cancelled = true;
        };
    }, []);
    const prompts = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        const promptSet = PROMPTS_BY_CONCEPT[concept] || [];
        return promptSet.filter((prompt)=>capById.get(prompt.id)?.enabled).slice(0, 4);
    }, [
        capById,
        concept
    ]);
    return {
        caps,
        capsErr,
        capById,
        prompts
    };
}
function useAskPinning(contextState, query) {
    const [pinned, setPinned] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [pinning, setPinning] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [pinError, setPinError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const pinningRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(false);
    const pinGeneration = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(0);
    const activeContextId = contextState.context?.id ?? null;
    const activeContextIdRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(activeContextId);
    const activeQueryRunIdRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(query.queryRun?.id ?? null);
    activeContextIdRef.current = activeContextId;
    activeQueryRunIdRef.current = query.queryRun?.id ?? null;
    const resetPinState = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        pinGeneration.current += 1;
        pinningRef.current = false;
        setPinning(false);
        setPinned(false);
        setPinError(null);
    }, []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        resetPinState();
    }, [
        activeContextId,
        query.queryRun?.id,
        resetPinState
    ]);
    const pinQueryFinding = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(async ()=>{
        const context = contextState.context;
        const queryRun = query.queryRun;
        if (!context || !queryRun || pinned || pinningRef.current) return;
        const generation = ++pinGeneration.current;
        const contextId = context.id;
        const queryRunId = queryRun.id;
        pinningRef.current = true;
        setPinning(true);
        setPinError(null);
        try {
            await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["analysisApi"].createFinding({
                context_id: contextId,
                kind: "global-ask-answer",
                title: query.graph?.title || queryRun.question,
                body: query.graph?.title ? queryRun.question : "",
                source_surface: "global-ask",
                source_run_id: queryRun.id,
                evidence: {
                    result: queryRun.result,
                    source_ids: queryRun.authority.source_ids
                }
            });
            if (generation === pinGeneration.current && activeContextIdRef.current === contextId && activeQueryRunIdRef.current === queryRunId) {
                setPinned(true);
            }
        } catch (error) {
            if (generation === pinGeneration.current && activeContextIdRef.current === contextId && activeQueryRunIdRef.current === queryRunId) {
                setPinError((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toErrorMessage"])(error, "Finding was not pinned"));
            }
        } finally{
            if (generation === pinGeneration.current) {
                pinningRef.current = false;
                setPinning(false);
            }
        }
    }, [
        contextState.context,
        pinned,
        query.graph?.title,
        query.queryRun
    ]);
    return {
        pinned,
        pinning,
        pinError,
        resetPinState,
        pinQueryFinding
    };
}
function queryRunFailure(run) {
    if (run.status === "ready" || run.status === "observed-empty") return null;
    const missing = Array.isArray(run.result.missing_dependencies) ? " Missing: " + run.result.missing_dependencies.join(", ") + "." : "";
    return run.error || "Query " + run.status + "." + missing;
}
function useAskRun(contextState, capabilities, query, pinning) {
    const runSeq = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(0);
    const resetPinState = pinning.resetPinState;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((capId)=>{
        const seq = ++runSeq.current;
        resetPinState();
        query.setHasQueried(true);
        query.setRunning(true);
        query.setGraphErr(null);
        query.setNote(null);
        query.setSuggest([]);
        query.setSelectedNode(null);
        query.setReaderOpen(false);
        const context = contextState.context;
        if (!context) {
            query.setGraphErr(contextState.error || "Analysis context is not ready.");
            query.setRunning(false);
            return;
        }
        const question = query.text.trim() || capabilities.capById.get(capId)?.label || capId;
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["analysisApi"].createQueryRun({
            context_id: context.id,
            question,
            selected_lane: "graph",
            capability_id: capId
        }).then((savedRun)=>{
            if (seq !== runSeq.current) return;
            query.setQueryRun(savedRun);
            const failure = queryRunFailure(savedRun);
            if (failure) throw new Error(failure);
            const graph = savedRun.result;
            query.setGraph(graph);
            query.setLayout((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$query$2f$views$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["nativeView"])(graph.capability_id, graph.mode));
        }).catch((error)=>{
            if (seq !== runSeq.current) return;
            const detail = error?.response?.data?.detail || error?.message || "could not run query";
            query.setGraphErr(String(detail));
        }).finally(()=>{
            if (seq === runSeq.current) query.setRunning(false);
        });
    }, [
        capabilities.capById,
        contextState.context,
        contextState.error,
        query,
        resetPinState
    ]);
}
function useAskSubmit(capabilities, query, run) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        const question = query.text.trim().toLowerCase();
        if (!question) return;
        const allCapabilities = capabilities.caps?.groups.flatMap((group)=>group.capabilities) ?? [];
        const scored = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$query$2f$routing$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["rankQueryCapabilities"])(question, allCapabilities);
        const runnable = scored.filter((candidate)=>candidate.c.enabled).map((candidate)=>candidate.c);
        if (!scored.length) {
            query.setHasQueried(true);
            query.setNote("No capability matched. Try one of these:");
            query.setSuggest(allCapabilities.filter((capability)=>capability.enabled).slice(0, 4));
            return;
        }
        const best = scored[0].c;
        if (best.enabled) {
            run(best.id);
            return;
        }
        query.setHasQueried(true);
        query.setNote(best.label + " — " + best.reason + ". Runnable instead:");
        query.setSuggest(runnable.slice(0, 4));
    }, [
        capabilities.caps,
        query,
        run
    ]);
}
function useAskModalController(pathname, onClose) {
    const contextState = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$analysis$2d$workbench$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAnalysisContext"])({
        name: "Global ASK investigation"
    });
    const panelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useModalA11y"])(onClose);
    const { prefill } = useAsk();
    const query = useAskQueryState(prefill);
    const capabilities = useAskCapabilities(conceptFor(pathname));
    const pinning = useAskPinning(contextState, query);
    const run = useAskRun(contextState, capabilities, query, pinning);
    const submit = useAskSubmit(capabilities, query, run);
    return {
        ...query,
        ...capabilities,
        ...pinning,
        panelRef,
        run,
        submit
    };
}
function AskQueryInput({ state, compact }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (compact ? "flex items-center gap-2 bg-caos-elevated px-3 py-2" : "flex-1 flex items-center gap-2 bg-caos-panel px-2.5 py-1") + " border border-caos-border rounded focus-within:border-caos-accent/70 transition-caos",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskMark, {}, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 570,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                name: "ask-query",
                autoComplete: "off",
                value: state.text,
                onChange: (event)=>state.setText(event.target.value),
                onKeyDown: (event)=>{
                    if (event.key === "Enter") state.submit();
                },
                placeholder: compact ? "Ask across coverage…" : "Type your query…",
                "aria-label": "Query coverage",
                className: "flex-1 bg-transparent outline-none tabular text-caos-md text-caos-text placeholder:text-caos-muted"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 571,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: state.submit,
                className: (compact ? "px-3 py-1" : "px-2.5 py-0.5") + " tabular text-caos-xs rounded bg-caos-accent text-caos-bg font-medium hover:opacity-90 transition-caos focus-ring",
                children: "Run"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 583,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 569,
        columnNumber: 5
    }, this);
}
function AskInitialView({ state, onClose }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between pb-1.5 border-b border-caos-border/50",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskMark, {}, void 0, false, {
                                fileName: "[project]/src/components/shared/Ask.tsx",
                                lineNumber: 598,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "tabular text-caos-xs text-caos-muted uppercase tracking-wider font-mono",
                                children: "Ask CAOS"
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/Ask.tsx",
                                lineNumber: 599,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 597,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CloseButton"], {
                        onClick: onClose,
                        title: "Close (Esc)"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 601,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 596,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskQueryInput, {
                state: state,
                compact: true
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 603,
                columnNumber: 7
            }, this),
            state.prompts.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-1 flex flex-col gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "tabular text-caos-3xs uppercase tracking-wider text-caos-muted font-mono",
                        children: "Suggested queries"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 606,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid gap-2 grid-cols-1 sm:grid-cols-2",
                        children: state.prompts.map((prompt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>state.run(prompt.id),
                                className: "text-left bg-caos-elevated border border-caos-border hover:border-caos-accent/50 rounded p-2 transition-caos focus-ring flex flex-col justify-between h-full cursor-pointer",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "tabular text-caos-sm text-caos-text leading-tight",
                                        children: prompt.text
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/shared/Ask.tsx",
                                        lineNumber: 614,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "tabular text-caos-3xs text-caos-muted font-mono mt-1",
                                        children: [
                                            "→ ",
                                            prompt.sub
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/shared/Ask.tsx",
                                        lineNumber: 615,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, prompt.id, true, {
                                fileName: "[project]/src/components/shared/Ask.tsx",
                                lineNumber: 609,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 607,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 605,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true);
}
function AskExpandedHeader({ state, onClose }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center gap-3 p-3 border-b border-caos-border bg-caos-elevated/70 shrink-0",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: state.resetSearch,
                title: "Back to search",
                className: "text-caos-muted hover:text-caos-text text-caos-xs px-2.5 py-1 rounded border border-caos-border bg-caos-panel font-mono uppercase tracking-wider transition-caos cursor-pointer",
                children: "← Back"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 628,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskQueryInput, {
                state: state,
                compact: false
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 635,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "h-6 w-px bg-caos-border"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 636,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$CloseButton$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CloseButton"], {
                onClick: onClose,
                title: "Close (Esc)"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 637,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 627,
        columnNumber: 5
    }, this);
}
function AskSuggestionNotice({ state }) {
    if (!state.note) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "-mt-1 flex items-center gap-2 flex-wrap",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-sm text-caos-warning",
                children: state.note
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 646,
                columnNumber: 7
            }, this),
            state.suggest.map((capability)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    onClick: ()=>state.run(capability.id),
                    className: "tabular text-caos-2xs px-2 py-0.5 rounded border border-caos-accent/50 text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos focus-ring cursor-pointer",
                    children: capability.label
                }, capability.id, false, {
                    fileName: "[project]/src/components/shared/Ask.tsx",
                    lineNumber: 648,
                    columnNumber: 9
                }, this))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 645,
        columnNumber: 5
    }, this);
}
function AskLayoutSwitcher({ state }) {
    const graph = state.graph;
    if (!graph) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex border border-caos-border rounded bg-caos-panel/40 p-0.5",
        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$query$2f$views$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["viewsFor"])(graph.capability_id, graph.mode).map((view)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: ()=>state.setLayout(view),
                className: "tabular text-caos-3xs uppercase tracking-wider px-2 py-0.5 rounded transition-caos cursor-pointer font-mono " + (state.layout === view ? "bg-caos-accent text-caos-bg font-semibold" : "text-caos-muted hover:text-caos-text hover:bg-caos-elevated/40"),
                children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$query$2f$views$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["VIEW_LABELS"][view]
            }, view, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 666,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 664,
        columnNumber: 5
    }, this);
}
function pinButtonLabel(state) {
    if (state.pinned) return "PINNED";
    if (state.pinning) return "PINNING…";
    if (state.pinError) return "RETRY PIN";
    return "PIN FINDING";
}
function AskResultActions({ state }) {
    const graph = state.graph;
    if (!graph) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center gap-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskLayoutSwitcher, {
                state: state
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 690,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "h-4 w-px bg-caos-border hidden sm:block"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 691,
                columnNumber: 7
            }, this),
            graph.meta.map((item, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "tabular text-caos-2xs text-caos-muted font-mono whitespace-nowrap hidden sm:inline",
                    children: [
                        item,
                        index < graph.meta.length - 1 ? " ·" : ""
                    ]
                }, index, true, {
                    fileName: "[project]/src/components/shared/Ask.tsx",
                    lineNumber: 693,
                    columnNumber: 9
                }, this)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex gap-1.5 ml-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: ()=>void state.pinQueryFinding(),
                        disabled: !state.queryRun || state.pinned || state.pinning,
                        className: "tabular text-caos-xs px-2 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos cursor-pointer focus-ring disabled:opacity-40",
                        children: pinButtonLabel(state)
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 698,
                        columnNumber: 9
                    }, this),
                    state.pinError ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        role: "alert",
                        className: "self-center text-caos-2xs text-caos-critical",
                        children: state.pinError
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 706,
                        columnNumber: 27
                    }, this) : null,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$query$2f$export$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["downloadQueryCsv"])(graph),
                        className: "tabular text-caos-xs px-2 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos cursor-pointer",
                        children: "CSV"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 707,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>window.print(),
                        className: "tabular text-caos-xs px-2 py-0.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos cursor-pointer",
                        children: "PDF"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 708,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 697,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 689,
        columnNumber: 5
    }, this);
}
function AskResultHeader({ state }) {
    if (!state.graph || state.graphErr) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center justify-between gap-2 flex-wrap shrink-0",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-2 flex-wrap",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-3xs uppercase tracking-wide text-caos-accent border border-caos-accent/40 bg-caos-accent/10 rounded px-1.5 py-px",
                        children: state.graph.mode
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 719,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-md text-caos-text",
                        children: state.graph.title
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 720,
                        columnNumber: 9
                    }, this),
                    state.running && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "tabular text-caos-2xs text-caos-muted caos-running",
                        children: "running…"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 721,
                        columnNumber: 27
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 718,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskResultActions, {
                state: state
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 723,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 717,
        columnNumber: 5
    }, this);
}
function AskCenteredStatus({ children, warning = false }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex-1 flex items-center justify-center text-center px-6",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "tabular text-caos-md " + (warning ? "text-caos-warning" : "text-caos-muted"),
            children: children
        }, void 0, false, {
            fileName: "[project]/src/components/shared/Ask.tsx",
            lineNumber: 731,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 730,
        columnNumber: 5
    }, this);
}
function AskGraphView({ state }) {
    const graph = state.graph;
    if (state.layout === "rv") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(RelativeValueTable, {
            graph: graph,
            selectedNodeId: state.selectedNode?.id,
            onSelectNode: state.openNode
        }, void 0, false, {
            fileName: "[project]/src/components/shared/Ask.tsx",
            lineNumber: 739,
            columnNumber: 12
        }, this);
    }
    if (state.layout === "scatter") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ScatterCanvas, {
            graph: graph,
            selectedNodeId: state.selectedNode?.id,
            onSelectNode: state.openNode
        }, void 0, false, {
            fileName: "[project]/src/components/shared/Ask.tsx",
            lineNumber: 742,
            columnNumber: 12
        }, this);
    }
    if (state.layout === "trace") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(LineageFlow, {
            graph: graph,
            selectedNodeId: state.selectedNode?.id,
            onSelectNode: state.openNode
        }, void 0, false, {
            fileName: "[project]/src/components/shared/Ask.tsx",
            lineNumber: 745,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(GraphCanvas, {
        graph: graph,
        onOpenChunk: (id, label)=>state.setCite({
                id,
                label
            }),
        onSelectNode: state.openNode
    }, void 0, false, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 747,
        columnNumber: 10
    }, this);
}
function AskResultSurface({ state }) {
    let content;
    if (state.capsErr) content = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskCenteredStatus, {
        warning: true,
        children: [
            "Couldn't load capabilities — ",
            state.capsErr
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 752,
        columnNumber: 32
    }, this);
    else if (state.graphErr) content = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskCenteredStatus, {
        warning: true,
        children: [
            "Query failed — ",
            state.graphErr
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 753,
        columnNumber: 38
    }, this);
    else if (state.running && !state.graph) content = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskCenteredStatus, {
        children: "Walking the graph…"
    }, void 0, false, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 754,
        columnNumber: 53
    }, this);
    else if (!state.graph) content = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskCenteredStatus, {
        children: "Submit a query to view results."
    }, void 0, false, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 755,
        columnNumber: 36
    }, this);
    else content = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskGraphView, {
        state: state
    }, void 0, false, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 756,
        columnNumber: 18
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex-1 min-h-0 flex flex-col bg-caos-bg border border-caos-border rounded-md p-2 relative",
        children: content
    }, void 0, false, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 757,
        columnNumber: 10
    }, this);
}
function AskCaveats({ state }) {
    if (!state.graph?.caveats.length) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "tabular text-caos-3xs text-caos-muted font-mono flex items-start gap-1.5 shrink-0",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                "aria-hidden": true,
                children: "ⓘ"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 764,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                children: state.graph.caveats.join(" · ")
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 765,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 763,
        columnNumber: 5
    }, this);
}
function AskResultMain({ state }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "flex-1 min-w-0 min-h-0 flex flex-col p-4 gap-3 overflow-hidden",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskSuggestionNotice, {
                state: state
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 773,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskResultHeader, {
                state: state
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 774,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskResultSurface, {
                state: state
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 775,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskCaveats, {
                state: state
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 776,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 772,
        columnNumber: 5
    }, this);
}
function AskReaderField({ label, children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "tabular text-caos-3xs uppercase tracking-wider text-caos-muted mb-0.5",
                children: label
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 784,
                columnNumber: 7
            }, this),
            children
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 783,
        columnNumber: 5
    }, this);
}
function AskReader({ state }) {
    const node = state.selectedNode;
    if (!state.readerOpen || !node) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
        className: "w-[380px] border-l border-caos-border bg-caos-panel flex flex-col p-4 gap-4 overflow-y-auto shrink-0 relative transition-caos",
        "aria-label": "Node detail reader",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-start justify-between pb-2 border-b border-caos-border",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "tabular text-caos-3xs uppercase tracking-wider text-caos-accent font-mono",
                                children: node.kind.replace("-", " ")
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/Ask.tsx",
                                lineNumber: 797,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "tabular text-caos-md font-mono text-caos-text mt-0.5 leading-snug break-all",
                                children: node.label
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/Ask.tsx",
                                lineNumber: 798,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 796,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>state.setReaderOpen(false),
                        className: "text-caos-muted hover:text-caos-text text-caos-xl font-bold px-1.5 focus-ring cursor-pointer",
                        "aria-label": "Close panel",
                        children: "×"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 800,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 795,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 flex flex-col gap-3 min-h-0",
                children: [
                    node.sub && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskReaderField, {
                        label: "Description",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-caos-sm text-caos-text leading-relaxed font-sans",
                            children: node.sub
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/Ask.tsx",
                            lineNumber: 803,
                            columnNumber: 58
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 803,
                        columnNumber: 22
                    }, this),
                    node.title && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskReaderField, {
                        label: "Summary / Detail",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-caos-xs text-caos-text/90 leading-relaxed bg-caos-bg/50 border border-caos-border rounded p-2 font-mono whitespace-pre-wrap",
                            children: node.title
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/Ask.tsx",
                            lineNumber: 804,
                            columnNumber: 65
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 804,
                        columnNumber: 24
                    }, this),
                    node.group && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskReaderField, {
                        label: "Category Group",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "tabular text-caos-3xs text-caos-text bg-caos-bg border border-caos-border rounded px-1.5 py-0.5 inline-block",
                            children: node.group
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/Ask.tsx",
                            lineNumber: 805,
                            columnNumber: 63
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 805,
                        columnNumber: 24
                    }, this),
                    node.confidence && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskReaderField, {
                        label: "Confidence",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "tabular text-caos-3xs font-semibold px-2 py-0.5 rounded border",
                            style: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$pipeline$2f$sev$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["sevSurface"])(node.confidence === "High" ? "ok" : "warning", {
                                border: 33,
                                wash: 7
                            }),
                            children: node.confidence
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/Ask.tsx",
                            lineNumber: 808,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 807,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 802,
                columnNumber: 7
            }, this),
            node.obsidian_url && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pt-3 border-t border-caos-border shrink-0",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                    href: node.obsidian_url,
                    className: "w-full flex items-center justify-center gap-1.5 tabular text-caos-xs font-semibold py-2 px-3 rounded bg-caos-accent text-caos-bg hover:opacity-90 transition-caos text-center focus-ring",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            children: "REVEAL IN OBSIDIAN WIKI"
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/Ask.tsx",
                            lineNumber: 815,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            "aria-hidden": true,
                            className: "text-caos-2xs",
                            children: "↗"
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/Ask.tsx",
                            lineNumber: 815,
                            columnNumber: 49
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/shared/Ask.tsx",
                    lineNumber: 814,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 813,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 794,
        columnNumber: 5
    }, this);
}
function AskExpandedView({ state, onClose }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskExpandedHeader, {
                state: state,
                onClose: onClose
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 826,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 min-h-0 flex overflow-hidden",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskResultMain, {
                        state: state
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 828,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskReader, {
                        state: state
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/Ask.tsx",
                        lineNumber: 829,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 827,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
function AskPanel({ state, onClose }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: state.panelRef,
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Ask with Query",
        onClick: (event)=>event.stopPropagation(),
        className: "caos-enter bg-caos-panel border-l border-caos-border h-full w-full flex flex-col overflow-hidden " + (state.hasQueried ? "max-w-4xl" : "max-w-md p-4 gap-3.5"),
        style: {
            boxShadow: "var(--shadow-modal)"
        },
        children: state.hasQueried ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskExpandedView, {
            state: state,
            onClose: onClose
        }, void 0, false, {
            fileName: "[project]/src/components/shared/Ask.tsx",
            lineNumber: 846,
            columnNumber: 27
        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskInitialView, {
            state: state,
            onClose: onClose
        }, void 0, false, {
            fileName: "[project]/src/components/shared/Ask.tsx",
            lineNumber: 846,
            columnNumber: 81
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 837,
        columnNumber: 5
    }, this);
}
function AskModal({ pathname, onClose }) {
    const state = useAskModalController(pathname, onClose);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ModalBackdrop"], {
        onClose: onClose,
        align: "end",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AskPanel, {
                state: state,
                onClose: onClose
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 855,
                columnNumber: 7
            }, this),
            state.cite && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$command$2f$CitationViewer$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CitationViewer"], {
                chunkId: state.cite.id,
                label: state.cite.label,
                onClose: ()=>state.setCite(null)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 856,
                columnNumber: 22
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 854,
        columnNumber: 5
    }, this);
}
function AskMark({ small = false }) {
    const size = small ? "w-3.5 h-3.5" : "w-4 h-4";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: `${size} shrink-0 rounded-sm border border-caos-accent/70 bg-caos-accent/15 text-caos-accent flex items-center justify-center`,
        "aria-hidden": "true",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            viewBox: "0 0 12 12",
            className: "w-2.5 h-2.5 stroke-current",
            fill: "none",
            strokeWidth: "1.5",
            strokeLinecap: "round",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M2 6h8M6 2v8"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Ask.tsx",
                lineNumber: 866,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/shared/Ask.tsx",
            lineNumber: 865,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/Ask.tsx",
        lineNumber: 864,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/components/shared/Notifications.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "NotificationProvider",
    ()=>NotificationProvider,
    "useNotify",
    ()=>useNotify
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
const pollingAllowed = (stopped, requestInFlight)=>!stopped && document.visibilityState !== "hidden" && !requestInFlight;
const ingestNotificationFeed = (feed, initialized, delivered, enqueue)=>{
    if (!initialized.current) {
        for (const event of feed.items)delivered.current.add(event.id);
        initialized.current = true;
        return;
    }
    for (const event of feed.items){
        if (delivered.current.has(event.id)) continue;
        delivered.current.add(event.id);
        enqueue({
            id: `event-${event.id}`,
            eventId: event.id,
            title: event.title,
            body: event.body ?? undefined,
            href: event.href ?? undefined
        });
    }
};
const Ctx = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])(()=>{});
function useNotify() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(Ctx);
}
function NotificationProvider({ children }) {
    const [items, setItems] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const cursor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const initialized = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(false);
    const requestInFlight = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(false);
    const delivered = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(new Set());
    const localSequence = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(0);
    const dismiss = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((id, eventId)=>{
        setItems((current)=>current.filter((item)=>item.id !== id));
        if (eventId) void (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["markNotificationSeen"])(eventId).catch(()=>undefined);
    }, []);
    const enqueue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((toast)=>{
        setItems((current)=>[
                ...current,
                toast
            ]);
        window.setTimeout(()=>dismiss(toast.id, toast.eventId), 7000);
    }, [
        dismiss
    ]);
    const notify = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((title, body)=>{
        const id = `local-${Date.now()}-${localSequence.current++}`;
        enqueue({
            id,
            title,
            body
        });
    }, [
        enqueue
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        let stopped = false;
        const poll = async ()=>{
            if (!pollingAllowed(stopped, requestInFlight.current)) return;
            requestInFlight.current = true;
            try {
                const feed = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["listNotifications"])(cursor.current);
                if (stopped) return;
                // Establish a high-water mark on the first read; later reads enqueue
                // only unseen events from the durable notification feed.
                ingestNotificationFeed(feed, initialized, delivered, enqueue);
                cursor.current = feed.next_cursor ?? cursor.current;
            } catch  {
            // A routine toast feed must never take down the application shell. The
            // next visible poll retries from the last confirmed high-water cursor.
            } finally{
                requestInFlight.current = false;
            }
        };
        const onVisibility = ()=>{
            if (document.visibilityState === "visible") void poll();
        };
        void poll();
        const interval = window.setInterval(()=>void poll(), 8000);
        window.addEventListener("focus", poll);
        document.addEventListener("visibilitychange", onVisibility);
        return ()=>{
            stopped = true;
            window.clearInterval(interval);
            window.removeEventListener("focus", poll);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [
        enqueue
    ]);
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>notify, [
        notify
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Ctx.Provider, {
        value: value,
        children: [
            children,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                "aria-live": "polite",
                className: "fixed bottom-14 right-3 z-toast flex max-h-[calc(100vh-96px)] w-[320px] max-w-[calc(100vw-24px)] flex-col gap-2 overflow-y-auto",
                children: items.map((t)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "rounded border border-caos-accent/50 bg-caos-panel px-3 py-2 shadow-lg",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-start justify-between gap-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "tabular text-caos-sm font-medium text-caos-text",
                                        children: t.title
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/shared/Notifications.tsx",
                                        lineNumber: 127,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>dismiss(t.id, t.eventId),
                                        className: "rounded px-1 text-caos-muted transition-caos hover:text-caos-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caos-accent",
                                        "aria-label": `Dismiss ${t.title}`,
                                        children: "×"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/shared/Notifications.tsx",
                                        lineNumber: 128,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/shared/Notifications.tsx",
                                lineNumber: 126,
                                columnNumber: 13
                            }, this),
                            t.body ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-0.5 tabular text-caos-xs text-caos-muted",
                                children: t.body
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/Notifications.tsx",
                                lineNumber: 137,
                                columnNumber: 23
                            }, this) : null,
                            t.href ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                href: t.href,
                                onClick: ()=>dismiss(t.id, t.eventId),
                                className: "mt-2 inline-flex rounded text-caos-xs font-semibold uppercase tracking-wider text-caos-accent transition-caos hover:text-caos-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caos-accent",
                                children: "Open execution graph"
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/Notifications.tsx",
                                lineNumber: 139,
                                columnNumber: 15
                            }, this) : null
                        ]
                    }, t.id, true, {
                        fileName: "[project]/src/components/shared/Notifications.tsx",
                        lineNumber: 125,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/components/shared/Notifications.tsx",
                lineNumber: 123,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/Notifications.tsx",
        lineNumber: 121,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/components/shared/SurfaceState.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SurfaceState",
    ()=>SurfaceState
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/StatusGlyph.tsx [app-ssr] (ecmascript)");
"use client";
;
;
const PRESENTATION = {
    loading: {
        label: "Loading",
        glyph: "running",
        color: "var(--caos-accent)"
    },
    // Distinct from "loading": a lightweight status probe (e.g. a key-posture
    // check) rather than a data fetch — same running glyph, lighter word, so a
    // caller isn't forced into either "no data yet" copy or a full loading
    // sentence for a check that resolves to a simple ready/not-ready fact.
    checking: {
        label: "Checking",
        glyph: "running",
        color: "var(--caos-accent)"
    },
    // Distinct from "empty": a real check ran and found nothing (empty) vs
    // nothing has been attempted yet (not-run). Collapsing them into one
    // "empty" state is what let a still-loading fetch assert "no versioned
    // dossier exists" as if the absence had been verified — this kind is for
    // the genuinely-correct "nothing has run" case, never a stand-in for
    // "loading" or "empty".
    "not-run": {
        label: "Not yet run",
        glyph: "idle",
        color: "var(--caos-muted)"
    },
    empty: {
        label: "No observed data",
        glyph: "idle",
        color: "var(--caos-muted)"
    },
    unavailable: {
        label: "Unavailable",
        glyph: "warning",
        color: "var(--caos-warning)"
    },
    stale: {
        label: "Stale",
        glyph: "warning",
        color: "var(--caos-warning)"
    },
    partial: {
        label: "Partial",
        glyph: "warning",
        color: "var(--caos-warning)"
    },
    offline: {
        label: "Offline",
        glyph: "held",
        color: "var(--caos-warning)"
    },
    error: {
        label: "Error",
        glyph: "critical",
        color: "var(--caos-critical-bright)"
    }
};
const HEADINGS = {
    2: "h2",
    3: "h3",
    4: "h4"
};
const LIVE_STATES = new Set([
    "loading",
    "checking"
]);
const ALERT_STATES = new Set([
    "error",
    "offline"
]);
function surfaceSemantics(kind) {
    const live = LIVE_STATES.has(kind);
    return {
        live,
        role: live ? "status" : ALERT_STATES.has(kind) ? "alert" : undefined
    };
}
function surfaceClassName(compact, className) {
    const spacing = compact ? "px-2.5 py-2" : "px-3 py-3.5";
    return `min-w-0 rounded-md border border-caos-border bg-caos-bg/45 ${spacing}${className ? ` ${className}` : ""}`;
}
function SurfaceStateStatus({ kind, live }) {
    const presentation = PRESENTATION[kind];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center gap-1.5 tabular text-caos-2xs uppercase tracking-wider",
        style: {
            color: presentation.color
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$StatusGlyph$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["StatusGlyph"], {
                kind: presentation.glyph,
                size: 10,
                className: live ? "caos-running" : ""
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SurfaceState.tsx",
                lineNumber: 72,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                children: presentation.label
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SurfaceState.tsx",
                lineNumber: 73,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/SurfaceState.tsx",
        lineNumber: 71,
        columnNumber: 5
    }, this);
}
function SurfaceStateBody({ detail, supporting, primaryAction, secondaryAction, compact }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            detail ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: (compact ? "mt-0.5" : "mt-1") + " max-w-[70ch] text-caos-md leading-relaxed text-caos-muted text-pretty [overflow-wrap:anywhere]",
                children: detail
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SurfaceState.tsx",
                lineNumber: 81,
                columnNumber: 17
            }, this) : null,
            supporting ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-2",
                children: supporting
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SurfaceState.tsx",
                lineNumber: 82,
                columnNumber: 21
            }, this) : null,
            primaryAction || secondaryAction ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-2.5 flex flex-wrap items-center gap-2",
                children: [
                    primaryAction,
                    secondaryAction
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/SurfaceState.tsx",
                lineNumber: 83,
                columnNumber: 43
            }, this) : null
        ]
    }, void 0, true);
}
function SurfaceState({ kind, title, detail, supporting, primaryAction, secondaryAction, headingLevel = 3, compact = false, className = "" }) {
    const semantics = surfaceSemantics(kind);
    const Heading = HEADINGS[headingLevel];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        role: semantics.role,
        "aria-live": semantics.live ? "polite" : undefined,
        className: surfaceClassName(compact, className),
        "data-surface-state": kind,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SurfaceStateStatus, {
                kind: kind,
                live: semantics.live
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SurfaceState.tsx",
                lineNumber: 114,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Heading, {
                className: (compact ? "mt-1 text-caos-xl" : "mt-1.5 text-caos-metric") + " font-semibold leading-tight text-caos-text text-balance [overflow-wrap:anywhere]",
                children: title
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SurfaceState.tsx",
                lineNumber: 115,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SurfaceStateBody, {
                detail: detail,
                supporting: supporting,
                primaryAction: primaryAction,
                secondaryAction: secondaryAction,
                compact: compact
            }, void 0, false, {
                fileName: "[project]/src/components/shared/SurfaceState.tsx",
                lineNumber: 116,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/SurfaceState.tsx",
        lineNumber: 108,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/components/shared/IssuerProfileOverlay.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "IssuerProfileOverlay",
    ()=>IssuerProfileOverlay,
    "IssuerProfileOverlayProvider",
    ()=>IssuerProfileOverlayProvider,
    "useIssuerProfileOverlay",
    ()=>useIssuerProfileOverlay
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/shared/lib/app-dynamic.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/use-modal-a11y.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/SurfaceState.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ModalBackdrop.tsx [app-ssr] (ecmascript)");
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
const Profile = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"])(async ()=>{}, {
    loadableGenerated: {
        modules: [
            "[project]/src/app/issuers/profile/ProfileContent.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false,
    loading: ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "h-full flex items-center justify-center bg-caos-bg p-6",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SurfaceState"], {
                kind: "loading",
                title: "Loading profile view",
                detail: "Preparing the issuer evidence workspace.",
                className: "w-full max-w-md"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/IssuerProfileOverlay.tsx",
                lineNumber: 18,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/src/components/shared/IssuerProfileOverlay.tsx",
            lineNumber: 17,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
});
const IssuerProfileOverlayContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])({
    openProfile: ()=>{},
    openProfileByQuery: ()=>{},
    closeProfile: ()=>{},
    isOpen: false,
    issuerId: null
});
const useIssuerProfileOverlay = ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(IssuerProfileOverlayContext);
function IssuerProfileOverlayProvider({ children }) {
    const [issuerId, setIssuerId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isOpen, setIsOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    // Open by issuer id. This is the source-of-truth path: the overlay fetches
    // GET /issuers/{id}/profile, and a bad id surfaces as "Issuer not found".
    // No search round-trip — getIssuers matches name/ticker/etc but NOT id, so
    // searching an id would always miss (and could open the wrong issuer if a
    // uuid fragment ever substring-hit a name/FIGI).
    const openProfile = (id)=>{
        const clean = id.trim();
        if (!clean) return;
        window.dispatchEvent(new CustomEvent("caos:modal-open", {
            detail: {
                owner: "issuer-profile"
            }
        }));
        setIssuerId(clean);
        setIsOpen(true);
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const onModalOpen = (event)=>{
            if (event.detail?.owner !== "issuer-profile") {
                setIsOpen(false);
                setIssuerId(null);
            }
        };
        window.addEventListener("caos:modal-open", onModalOpen);
        return ()=>window.removeEventListener("caos:modal-open", onModalOpen);
    }, []);
    // Resolve a free-text ticker/name (e.g. a Command Center row that only knows
    // a portfolio code) to an issuer id via search, then open. Falls back to the
    // lazily-loaded demo sleeve, then to a direct pass-through of the term.
    const openProfileByQuery = async (query)=>{
        const term = query.trim();
        if (!term) return;
        // 1. Try to resolve via the server API
        try {
            const results = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getIssuers"])(term);
            if (results && results.length > 0) {
                // Look for an exact match by ID, Ticker, or Name
                const exact = results.find((i)=>i.id === term || i.ticker?.toLowerCase() === term.toLowerCase() || i.name.toLowerCase() === term.toLowerCase());
                openProfile((exact || results[0]).id);
                return;
            }
        } catch (err) {
            console.error("Issuer lookup failed, falling back to local sleeve", err);
        }
        // 2. Client-side fallback to the demo sleeve. Load the large portfolio seed
        // only on this uncommon API-miss path, never in the root layout bundle.
        const { DEMO_UNIVERSE } = await __turbopack_context__.A("[project]/src/lib/issuer-demo.ts [app-ssr] (ecmascript, async loader)");
        const cleanQ = term.toLowerCase();
        const demoMatch = DEMO_UNIVERSE.find((i)=>i.id.toLowerCase() === cleanQ || i.ticker?.toLowerCase() === cleanQ || i.name.toLowerCase() === cleanQ) || DEMO_UNIVERSE.find((i)=>i.name.toLowerCase().includes(cleanQ) || i.ticker && i.ticker.toLowerCase().includes(cleanQ));
        // 3. Direct pass-through of the term if nothing matches
        openProfile(demoMatch ? demoMatch.id : term);
    };
    const closeProfile = ()=>{
        setIsOpen(false);
        setIssuerId(null);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(IssuerProfileOverlayContext.Provider, {
        value: {
            openProfile,
            openProfileByQuery,
            closeProfile,
            isOpen,
            issuerId
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/shared/IssuerProfileOverlay.tsx",
        lineNumber: 122,
        columnNumber: 5
    }, this);
}
function IssuerProfileOverlay() {
    const { isOpen, issuerId, closeProfile } = useIssuerProfileOverlay();
    const [data, setData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!isOpen || !issuerId) {
            setData(null);
            setError(null);
            setLoading(false);
            return;
        }
        let stale = false;
        setLoading(true);
        setError(null);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getIssuerProfile"])(issuerId).then((profileData)=>{
            if (!stale) {
                setData(profileData);
            }
        }).catch((err)=>{
            if (!stale) {
                const detail = err?.response;
                setError(detail?.status === 404 ? "Issuer not found." : detail?.data?.detail || "Couldn't load this profile.");
            }
        }).finally(()=>{
            if (!stale) {
                setLoading(false);
            }
        });
        return ()=>{
            stale = true;
        };
    }, [
        isOpen,
        issuerId
    ]);
    // The modal body — and its useModalA11y — live in a child that mounts only
    // while open. Calling the hook on this always-mounted component would engage
    // the body scroll-lock the entire time the overlay sits closed.
    if (!isOpen) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(IssuerProfileModal, {
        issuerId: issuerId,
        data: data,
        loading: loading,
        error: error,
        onClose: closeProfile
    }, void 0, false, {
        fileName: "[project]/src/components/shared/IssuerProfileOverlay.tsx",
        lineNumber: 179,
        columnNumber: 5
    }, this);
}
function IssuerProfileModal({ issuerId, data, loading, error, onClose }) {
    const panelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useModalA11y"])(onClose);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ModalBackdrop"], {
        onClose: onClose,
        padded: true,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            ref: panelRef,
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "Issuer Profile Overlay",
            onClick: (e)=>{
                e.stopPropagation();
                // This modal mounts in the root layout, ABOVE the router — a <Link>
                // inside it swaps the route underneath without unmounting the overlay,
                // stranding a scroll-locked focus trap over the new page. Delegated
                // close: a plain left-click on a same-origin link closes; modified
                // clicks (new tab/window) and external/protocol links ("OPEN IN
                // VAULT" obsidian://) don't navigate this page, so the overlay stays.
                const a = e.target.closest("a[href]");
                if (a && a.origin === window.location.origin && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) onClose();
            },
            className: "caos-enter bg-caos-panel border border-caos-border rounded-md w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden relative",
            style: {
                boxShadow: "var(--shadow-modal)"
            },
            children: loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "h-full flex items-center justify-center bg-caos-bg p-6",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SurfaceState"], {
                    kind: "loading",
                    title: "Loading issuer profile",
                    detail: "Retrieving the current house view, run history, and evidence health.",
                    className: "w-full max-w-md"
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/IssuerProfileOverlay.tsx",
                    lineNumber: 216,
                    columnNumber: 13
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/IssuerProfileOverlay.tsx",
                lineNumber: 215,
                columnNumber: 11
            }, this) : error || !data ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "h-full flex items-center justify-center bg-caos-bg p-6",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SurfaceState"], {
                    kind: "error",
                    title: error || "Issuer profile unavailable",
                    detail: "The overlay could not establish a current profile. No conclusion was drawn from the missing response.",
                    className: "w-full max-w-md",
                    primaryAction: issuerId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                        href: "/deepdive?issuer=" + encodeURIComponent(issuerId),
                        onClick: onClose,
                        className: "caos-action-primary no-underline focus-ring",
                        children: "Open Deep-Dive"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/IssuerProfileOverlay.tsx",
                        lineNumber: 226,
                        columnNumber: 17
                    }, this) : undefined,
                    secondaryAction: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: onClose,
                        className: "caos-action-secondary focus-ring",
                        children: "Close"
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/IssuerProfileOverlay.tsx",
                        lineNumber: 228,
                        columnNumber: 32
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/IssuerProfileOverlay.tsx",
                    lineNumber: 220,
                    columnNumber: 13
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/IssuerProfileOverlay.tsx",
                lineNumber: 219,
                columnNumber: 11
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Profile, {
                id: issuerId,
                data: data,
                isOverlay: true,
                onClose: onClose
            }, void 0, false, {
                fileName: "[project]/src/components/shared/IssuerProfileOverlay.tsx",
                lineNumber: 232,
                columnNumber: 11
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/shared/IssuerProfileOverlay.tsx",
            lineNumber: 194,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/IssuerProfileOverlay.tsx",
        lineNumber: 193,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/lib/palette.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PALETTE_ACTIONS",
    ()=>PALETTE_ACTIONS,
    "PALETTE_PAGES",
    ()=>PALETTE_PAGES,
    "staticRows",
    ()=>staticRows
]);
// Pure row model for the ⌘K command palette — sources and ranking live here
// (testable, no React). Pages come from the nav registry, actions are the few
// global gestures, and free text ALWAYS carries an `Ask CAOS: "<text>"` row:
// ranked FIRST when the input doesn't strongly match a page/action, so the
// old ⌘K→type→Enter Ask muscle memory still lands in Ask (RT-2026-07-11-62).
// Issuer rows are appended by the component (async search, same contract as
// the unified command palette).
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/nav.ts [app-ssr] (ecmascript)");
;
const PALETTE_PAGES = [
    ...__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["NAV_GROUPS"].flatMap((g)=>g.items.map((i)=>({
                kind: "page",
                href: i.href,
                label: i.label,
                group: g.label
            }))),
    {
        kind: "page",
        href: "/settings",
        label: "Settings",
        group: "Utility"
    }
];
const PALETTE_ACTIONS = [
    {
        kind: "action",
        id: "role-analyst",
        label: "Role view: Analyst"
    },
    {
        kind: "action",
        id: "role-pm",
        label: "Role view: PM"
    },
    {
        kind: "action",
        id: "role-qa",
        label: "Role view: QA"
    },
    {
        kind: "action",
        id: "collapse",
        label: "Collapse / expand panes"
    }
];
function staticRows(query) {
    const text = query.trim();
    const q = text.toLowerCase();
    if (!q) return [
        ...PALETTE_PAGES
    ];
    const scored = [];
    for (const p of PALETTE_PAGES){
        const l = p.label.toLowerCase();
        if (l.startsWith(q)) scored.push({
            row: p,
            score: 100
        });
        else if (l.includes(q)) scored.push({
            row: p,
            score: 60
        });
        else if (p.group.toLowerCase().startsWith(q)) scored.push({
            row: p,
            score: 40
        });
    }
    for (const a of PALETTE_ACTIONS){
        if (a.label.toLowerCase().includes(q)) scored.push({
            row: a,
            score: 50
        });
    }
    // Ask passthrough: first for question-shaped input, below a strong page hit.
    const strong = scored.some((s)=>s.score >= 100);
    scored.push({
        row: {
            kind: "ask",
            text
        },
        score: strong ? 10 : 90
    });
    return scored.sort((a, b)=>b.score - a.score).map((s)=>s.row);
}
}),
"[project]/src/lib/use-modal-list-focus.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useModalListFocus",
    ()=>useModalListFocus
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
;
function useModalListFocus(active, rowIdPrefix) {
    const inputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        inputRef.current?.focus();
    }, []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        document.getElementById(`${rowIdPrefix}${active}`)?.scrollIntoView?.({
            block: "nearest"
        });
    }, [
        active,
        rowIdPrefix
    ]);
    return inputRef;
}
}),
"[project]/src/components/shared/CommandPalette.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CommandPalette",
    ()=>CommandPalette
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// The global ⌘K command palette: pages (workflow-grouped from lib/nav),
// issuers (using the shared debounced issuer-search contract), global
// actions, and an ever-present `Ask CAOS: "<text>"` passthrough row that
// routes typed text into the Ask launcher via openWith() — the old ⌘K→Ask
// muscle memory keeps working for question-shaped input (RT-2026-07-11-62).
// Alt+K still opens Ask directly (ConceptHotkeys, unchanged).
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/use-modal-a11y.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$palette$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/palette.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerProfileOverlay$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/IssuerProfileOverlay.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Ask$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/Ask.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RoleViewProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/RoleViewProvider.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/ModalBackdrop.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/SurfaceState.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$NavigationGuardProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/NavigationGuardProvider.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$list$2d$focus$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/use-modal-list-focus.ts [app-ssr] (ecmascript)");
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
const usePaletteIssuers = (query)=>{
    const [issuers, setIssuers] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [issuerError, setIssuerError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            setIssuers([]);
            setIssuerError(false);
            return;
        }
        let stale = false;
        const timer = setTimeout(()=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getIssuers"])(trimmed).then((list)=>{
                if (stale) return;
                setIssuers(list.slice(0, 6).map((issuer)=>({
                        kind: "issuer",
                        id: issuer.id,
                        label: issuer.name,
                        sub: [
                            issuer.ticker,
                            issuer.sector
                        ].filter(Boolean).join(" · ")
                    })));
                setIssuerError(false);
            }).catch(()=>{
                if (stale) return;
                setIssuers([]);
                setIssuerError(true);
            });
        }, 150);
        return ()=>{
            stale = true;
            clearTimeout(timer);
        };
    }, [
        query
    ]);
    return {
        issuers,
        issuerError
    };
};
const mergeIssuerRows = (query, issuers)=>{
    const base = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$palette$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["staticRows"])(query);
    if (!issuers.length) return base;
    const rows = [];
    let inserted = false;
    const normalizedQuery = query.trim().toLowerCase();
    for (const row of base){
        const beforeAsk = row.kind === "ask";
        const beforeInexactPage = row.kind === "page" && !row.label.toLowerCase().startsWith(normalizedQuery);
        if (!inserted && (beforeAsk || beforeInexactPage)) {
            rows.push(...issuers);
            inserted = true;
        }
        rows.push(row);
    }
    if (!inserted) rows.push(...issuers);
    return rows;
};
const paletteRowKey = (row)=>{
    if (row.kind === "page") return `page${row.href}`;
    if (row.kind === "ask") return "ask";
    return `${row.kind}${row.id}`;
};
function PaletteRowContent({ row }) {
    if (row.kind === "page") return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xs uppercase tracking-widest text-caos-muted w-16 shrink-0",
                children: row.group
            }, void 0, false, {
                fileName: "[project]/src/components/shared/CommandPalette.tsx",
                lineNumber: 84,
                columnNumber: 37
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-md text-caos-text",
                children: row.label
            }, void 0, false, {
                fileName: "[project]/src/components/shared/CommandPalette.tsx",
                lineNumber: 84,
                columnNumber: 151
            }, this)
        ]
    }, void 0, true);
    if (row.kind === "issuer") return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xs uppercase tracking-widest text-caos-accent w-16 shrink-0",
                children: "Issuer"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/CommandPalette.tsx",
                lineNumber: 85,
                columnNumber: 39
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-md text-caos-text truncate",
                children: row.label
            }, void 0, false, {
                fileName: "[project]/src/components/shared/CommandPalette.tsx",
                lineNumber: 85,
                columnNumber: 149
            }, this),
            row.sub ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-xs text-caos-muted truncate",
                children: row.sub
            }, void 0, false, {
                fileName: "[project]/src/components/shared/CommandPalette.tsx",
                lineNumber: 85,
                columnNumber: 241
            }, this) : null
        ]
    }, void 0, true);
    if (row.kind === "action") return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xs uppercase tracking-widest text-caos-muted w-16 shrink-0",
                children: "Action"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/CommandPalette.tsx",
                lineNumber: 86,
                columnNumber: 39
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-md text-caos-text",
                children: row.label
            }, void 0, false, {
                fileName: "[project]/src/components/shared/CommandPalette.tsx",
                lineNumber: 86,
                columnNumber: 148
            }, this)
        ]
    }, void 0, true);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-2xs uppercase tracking-widest text-caos-accent w-16 shrink-0",
                children: "Ask"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/CommandPalette.tsx",
                lineNumber: 87,
                columnNumber: 12
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "tabular text-caos-md text-caos-text truncate",
                children: [
                    "Ask CAOS: “",
                    row.text,
                    "”"
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/CommandPalette.tsx",
                lineNumber: 87,
                columnNumber: 119
            }, this)
        ]
    }, void 0, true);
}
function PaletteResults({ rows, active, issuerError, onActiveChange, onExecute }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
        id: "palette-listbox",
        role: "listbox",
        "aria-label": "Results",
        className: "flex-1 overflow-y-auto py-1",
        children: [
            issuerError ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                role: "none",
                className: "px-2 py-1",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$SurfaceState$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SurfaceState"], {
                    kind: "offline",
                    title: "Issuer lookup unavailable",
                    detail: "Page and action commands remain available.",
                    compact: true
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/CommandPalette.tsx",
                    lineNumber: 105,
                    columnNumber: 60
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/CommandPalette.tsx",
                lineNumber: 105,
                columnNumber: 22
            }, this) : null,
            rows.map((row, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                    id: `palette-row-${index}`,
                    role: "option",
                    "aria-selected": index === active,
                    onMouseEnter: ()=>onActiveChange(index),
                    onMouseDown: (event)=>{
                        event.preventDefault();
                        onExecute(row);
                    },
                    className: "flex items-baseline gap-2 px-3 min-h-9 py-1.5 cursor-pointer caos-target " + (index === active ? "bg-caos-elevated" : ""),
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(PaletteRowContent, {
                        row: row
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/CommandPalette.tsx",
                        lineNumber: 116,
                        columnNumber: 11
                    }, this)
                }, paletteRowKey(row), false, {
                    fileName: "[project]/src/components/shared/CommandPalette.tsx",
                    lineNumber: 107,
                    columnNumber: 9
                }, this)),
            rows.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                className: "px-3 py-2 tabular text-caos-xs text-caos-muted",
                children: "no matches"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/CommandPalette.tsx",
                lineNumber: 119,
                columnNumber: 28
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/CommandPalette.tsx",
        lineNumber: 104,
        columnNumber: 5
    }, this);
}
const paletteKeyAction = (key)=>({
        ArrowDown: "next",
        ArrowUp: "previous",
        Enter: "execute"
    })[key] ?? null;
function PaletteDialog({ query, rows, issuerError, onQueryChange, onExecute, onClose }) {
    const panelRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$a11y$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useModalA11y"])(onClose);
    const [active, setActive] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const inputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$use$2d$modal$2d$list$2d$focus$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useModalListFocus"])(active, "palette-row-");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        setActive(0);
    }, [
        query,
        rows.length
    ]);
    const onKeyDown = (event)=>{
        const action = paletteKeyAction(event.key);
        if (!action) return;
        event.preventDefault();
        if (action === "execute") {
            if (rows[active]) onExecute(rows[active]);
            return;
        }
        setActive((current)=>action === "next" ? Math.min(current + 1, rows.length - 1) : Math.max(current - 1, 0));
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$ModalBackdrop$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ModalBackdrop"], {
        onClose: onClose,
        align: "top",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            ref: panelRef,
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "Command palette",
            onClick: (event)=>event.stopPropagation(),
            className: "caos-enter w-[560px] max-w-[92vw] max-h-[64vh] flex flex-col rounded-md border border-caos-border bg-caos-panel overflow-hidden",
            style: {
                boxShadow: "var(--shadow-modal)"
            },
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center gap-2 border-b border-caos-border px-3",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            "aria-hidden": "true",
                            className: "tabular text-caos-xs text-caos-muted",
                            children: "⌘K"
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/CommandPalette.tsx",
                            lineNumber: 167,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                            ref: inputRef,
                            name: "command-palette-query",
                            autoComplete: "off",
                            role: "combobox",
                            "aria-label": "Search commands and issuers",
                            "aria-expanded": "true",
                            "aria-controls": "palette-listbox",
                            "aria-activedescendant": rows[active] ? `palette-row-${active}` : undefined,
                            value: query,
                            onChange: (event)=>onQueryChange(event.target.value),
                            onKeyDown: onKeyDown,
                            placeholder: "Jump to a concept, find an issuer, run an action, or ask…",
                            className: "flex-1 bg-transparent outline-none tabular text-caos-md text-caos-text placeholder:text-caos-muted min-h-11"
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/CommandPalette.tsx",
                            lineNumber: 168,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            "aria-hidden": "true",
                            className: "tabular text-caos-2xs text-caos-muted border border-caos-border rounded px-1",
                            children: "esc"
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/CommandPalette.tsx",
                            lineNumber: 169,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/shared/CommandPalette.tsx",
                    lineNumber: 166,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(PaletteResults, {
                    rows: rows,
                    active: active,
                    issuerError: issuerError,
                    onActiveChange: setActive,
                    onExecute: onExecute
                }, void 0, false, {
                    fileName: "[project]/src/components/shared/CommandPalette.tsx",
                    lineNumber: 171,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/shared/CommandPalette.tsx",
            lineNumber: 165,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/CommandPalette.tsx",
        lineNumber: 164,
        columnNumber: 5
    }, this);
}
function CommandPalette() {
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    // Mirrors `open` for the keydown handler: dispatching caos:modal-open from
    // inside the setOpen updater ran other components' listeners during THIS
    // component's render phase (React: "Cannot update ShortcutHelp while
    // rendering CommandPalette"). The handler decides from the ref and
    // dispatches before setting state — never inside the updater.
    const openRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        openRef.current = open;
    }, [
        open
    ]);
    // ⌘K / Ctrl+K and the shared explicit-open event are owned here. Alt+S
    // dispatches the latter from ConceptHotkeys so issuer lookup and page/action
    // search stay one surface instead of competing global search widgets.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const onKey = (e)=>{
            if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
                e.preventDefault();
                const willOpen = !openRef.current;
                if (willOpen) window.dispatchEvent(new CustomEvent("caos:modal-open", {
                    detail: {
                        owner: "palette"
                    }
                }));
                setOpen(willOpen);
            }
        };
        const onOpen = ()=>{
            window.dispatchEvent(new CustomEvent("caos:modal-open", {
                detail: {
                    owner: "palette"
                }
            }));
            setOpen(true);
        };
        const onModalOpen = (event)=>{
            if (event.detail?.owner !== "palette") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("caos:command-palette-open", onOpen);
        window.addEventListener("caos:modal-open", onModalOpen);
        return ()=>{
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("caos:command-palette-open", onOpen);
            window.removeEventListener("caos:modal-open", onModalOpen);
        };
    }, []);
    if (!open) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(PalettePanel, {
        onClose: ()=>setOpen(false)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/CommandPalette.tsx",
        lineNumber: 217,
        columnNumber: 10
    }, this);
}
function PalettePanel({ onClose }) {
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const attemptNavigation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$NavigationGuardProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useNavigationAttempt"])();
    const { openProfile } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$IssuerProfileOverlay$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useIssuerProfileOverlay"])();
    const { openWith } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$Ask$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAsk"])();
    const { setRoleView } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RoleViewProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRoleView"])();
    const [query, setQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const { issuers, issuerError } = usePaletteIssuers(query);
    const rows = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>mergeIssuerRows(query, issuers), [
        query,
        issuers
    ]);
    const execute = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((row)=>{
        onClose();
        if (row.kind === "page") {
            attemptNavigation(()=>router.push(row.href));
        } else if (row.kind === "issuer") {
            openProfile(row.id);
        } else if (row.kind === "ask") {
            openWith(row.text || undefined);
        } else if (row.kind === "action") {
            if (row.id === "collapse") window.dispatchEvent(new Event("caos:collapse-toggle"));
            else setRoleView(row.id.replace("role-", ""));
        }
    }, [
        attemptNavigation,
        onClose,
        router,
        openProfile,
        openWith,
        setRoleView
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(PaletteDialog, {
        query: query,
        rows: rows,
        issuerError: issuerError,
        onQueryChange: setQuery,
        onExecute: execute,
        onClose: onClose
    }, void 0, false, {
        fileName: "[project]/src/components/shared/CommandPalette.tsx",
        lineNumber: 248,
        columnNumber: 10
    }, this);
}
}),
"[project]/src/components/shared/RouteHeading.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RouteHeading",
    ()=>RouteHeading
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// Route-level <h1> for every page — visually hidden (sr-only) so each route gets
// exactly one top heading landmark for assistive tech without touching the dense
// visual chrome. Lives in the root layout, so new routes inherit it for free.
// Visible in-page titles stay as <h2> content headings under this.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
"use client";
;
;
const TITLES = {
    "": "CAOS",
    command: "Command Center",
    pipeline: "Pipeline",
    deepdive: "Deep-Dive",
    model: "Model Builder",
    reports: "Report Studio",
    research: "Research",
    issuers: "Issuers",
    upload: "Upload",
    settings: "Settings",
    query: "Query",
    monitor: "Monitor",
    sector: "Sector Review",
    "sector-rv": "Sector RV",
    sponsors: "Sponsor Track Records"
};
function RouteHeading() {
    const seg = ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["usePathname"])() || "/").split("/")[1] || "";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
        className: "sr-only",
        children: TITLES[seg] ?? "CAOS"
    }, void 0, false, {
        fileName: "[project]/src/components/shared/RouteHeading.tsx",
        lineNumber: 29,
        columnNumber: 10
    }, this);
}
}),
"[project]/src/lib/useRovingTabs.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useRovingTabs",
    ()=>useRovingTabs
]);
// Roving-tabindex keyboard navigation for a horizontal or vertical group of
// items (radiogroup, tablist, segmented control) — the WAI-ARIA APG pattern:
// one item is in the Tab order (tabIndex 0), the rest are Tab-skipped
// (tabIndex -1), and arrow keys move focus AND activate the new item. Several
// hand-rolled groups in this app (RoleViewSwitch, login mode tabs, the
// Command dataset switcher) declared role="radio"/role="tab" — promising a
// screen-reader user arrow-key movement the markup never implemented, so Tab
// walked every option as a separate stop instead. This is the one place that
// logic lives now instead of being copy-pasted (and half-implemented) again.
//
// Scope: 1D groups only. A 2D grid (row + column navigation, e.g. the model
// sheet or a future DataTable) is a different shape — build that separately
// rather than forcing it through this hook's single active-index model.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
function useRovingTabs(count, activeIndex, onActivate, options) {
    const itemRefs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])([]);
    const orientation = options?.orientation ?? "horizontal";
    const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
    const prevKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const moveTo = (index)=>{
        onActivate(index);
        itemRefs.current[index]?.focus();
    };
    const onKeyDown = (event)=>{
        if (count === 0) return;
        if (event.key === nextKey) {
            event.preventDefault();
            moveTo((activeIndex + 1) % count);
        } else if (event.key === prevKey) {
            event.preventDefault();
            moveTo((activeIndex - 1 + count) % count);
        } else if (event.key === "Home") {
            event.preventDefault();
            moveTo(0);
        } else if (event.key === "End") {
            event.preventDefault();
            moveTo(count - 1);
        }
    };
    const getItemProps = (index)=>({
            ref: (el)=>{
                itemRefs.current[index] = el;
            },
            tabIndex: index === activeIndex ? 0 : -1,
            onKeyDown
        });
    return {
        getItemProps
    };
}
}),
"[project]/src/components/shared/RoleViewSwitch.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RoleViewSwitch",
    ()=>RoleViewSwitch
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// The Analyst / PM / QA presentation selector — persistent but secondary
// chrome, mounted beside the AnalystBadge on every surface. A radiogroup, not
// tabs: it changes how surfaces COMPOSE, never what the user may access.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RoleViewProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/RoleViewProvider.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingTabs$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/useRovingTabs.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
const OPTIONS = [
    {
        value: "analyst",
        label: "Analyst",
        hint: "Analyst view — full working density"
    },
    {
        value: "pm",
        label: "PM",
        hint: "PM view — posture and what-changed first"
    },
    {
        value: "qa",
        label: "QA",
        hint: "QA view — governance and gates first"
    }
];
function RoleViewSwitch() {
    const { roleView, setRoleView } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RoleViewProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRoleView"])();
    const activeIndex = OPTIONS.findIndex((o)=>o.value === roleView);
    // A role=radiogroup promises arrow-key movement per WAI-ARIA — this was
    // radio semantics with no keyboard behavior behind them (3 plain Tab stops,
    // no ArrowLeft/Right). setRoleView on activate matches the radiogroup
    // pattern: arrow keys move AND select, not just move.
    const { getItemProps } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$useRovingTabs$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRovingTabs"])(OPTIONS.length, Math.max(activeIndex, 0), (index)=>setRoleView(OPTIONS[index].value));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "inline-flex items-center gap-1.5 shrink-0",
        title: "Presentation only — permissions and approval authority do not change",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "inline tabular text-caos-2xs uppercase tracking-wider text-caos-muted",
                children: "View"
            }, void 0, false, {
                fileName: "[project]/src/components/shared/RoleViewSwitch.tsx",
                lineNumber: 27,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                role: "radiogroup",
                "aria-label": "View composition — presentation only, permissions unchanged",
                className: "flex items-center rounded border border-caos-border overflow-hidden",
                children: OPTIONS.map((o, i)=>{
                    const active = roleView === o.value;
                    const { ref, tabIndex, onKeyDown } = getItemProps(i);
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        ref: ref,
                        type: "button",
                        role: "radio",
                        "aria-checked": active,
                        tabIndex: tabIndex,
                        onKeyDown: onKeyDown,
                        title: o.hint,
                        onClick: ()=>setRoleView(o.value),
                        className: "tabular text-caos-2xs tracking-wider px-1.5 min-h-8 min-w-8 transition-caos focus-ring " + (active ? "bg-caos-elevated text-caos-accent font-semibold" : "text-caos-muted hover:text-caos-text"),
                        children: o.label
                    }, o.value, false, {
                        fileName: "[project]/src/components/shared/RoleViewSwitch.tsx",
                        lineNumber: 37,
                        columnNumber: 11
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/src/components/shared/RoleViewSwitch.tsx",
                lineNumber: 28,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "sr-only",
                children: "Presentation only — permissions unchanged."
            }, void 0, false, {
                fileName: "[project]/src/components/shared/RoleViewSwitch.tsx",
                lineNumber: 59,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/RoleViewSwitch.tsx",
        lineNumber: 26,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/lib/format.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fmtMult",
    ()=>fmtMult,
    "fmtMult2",
    ()=>fmtMult2,
    "fmtNum",
    ()=>fmtNum,
    "fmtPct",
    ()=>fmtPct,
    "fmtUsdAcct",
    ()=>fmtUsdAcct,
    "fmtUsdM",
    ()=>fmtUsdM,
    "initials",
    ()=>initials
]);
// Locale-aware number formatting for the cockpit and tear-sheet. Tabular-
// friendly (grouping + fixed decimals) so figures align under `.tabular`, and
// NaN/Infinity-safe (renders an em dash rather than "NaN"). Centralizes the
// ad-hoc toFixed / toLocaleString / "$"+x+"M" calls scattered across the UI.
const nf = (min, max)=>new Intl.NumberFormat("en-US", {
        minimumFractionDigits: min,
        maximumFractionDigits: max
    });
function fmtNum(n, dp = 0) {
    return Number.isFinite(n) ? nf(dp, dp).format(n) : "—";
}
function fmtUsdM(n, dp = 0) {
    return Number.isFinite(n) ? "$" + fmtNum(n, dp) + "M" : "—";
}
function fmtPct(ratio, dp = 0) {
    return Number.isFinite(ratio) ? fmtNum(ratio * 100, dp) + "%" : "—";
}
function fmtMult(n, dp = 1) {
    return Number.isFinite(n) ? fmtNum(n, dp) + "x" : "—";
}
function fmtMult2(n) {
    return Number.isFinite(n) ? n.toFixed(2) + "x" : "—";
}
function fmtUsdAcct(n) {
    if (!Number.isFinite(n)) return "—";
    const s = "$" + fmtNum(Math.abs(Math.round(n))) + "M";
    return n < 0 ? "(" + s + ")" : s;
}
function initials(name) {
    const w = (name || "").trim().split(/\s+/).filter(Boolean);
    if (w.length === 0) return "?";
    if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
    return (w[0][0] + w[w.length - 1][0]).toUpperCase();
}
}),
"[project]/src/components/shared/AnalystBadge.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AnalystBadge",
    ()=>AnalystBadge
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
// The signed-in analyst's initials, parked at the right of every concept header
// (PageSubHeader). Click to sign out (clears the profile cookie → login landing).
// Only renders for a real profile identity; proxy/local fallbacks show nothing.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AuthProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/AuthProvider.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/format.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
function AnalystBadge() {
    const { user, refresh } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AuthProvider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuth"])();
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    if (!user || user.source !== "profile") return null;
    const signOut = async ()=>{
        if (busy) return;
        if (!window.confirm(`Sign out ${user.full_name}?`)) return;
        setBusy(true);
        try {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["logout"])();
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clearWorkspaceStorage"])(); // don't leak this analyst's workspace state to the next login
            await refresh(); // re-resolve → RequireAuth shows the login landing (unmounts this)
        } catch  {
            // Logout failed (network/timeout): the cookie is still valid, so reset busy
            // and surface it — otherwise the button stays disabled for the rest of the
            // session with no way to retry short of a full reload. SEAM4-5.
            setBusy(false);
            window.alert("Sign-out failed — check your connection and try again.");
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        onClick: signOut,
        "aria-disabled": busy || undefined,
        title: `Signed in as ${user.full_name} — click to sign out`,
        "aria-label": `Signed in as ${user.full_name}. Sign out.`,
        className: "ml-auto shrink-0 inline-flex items-center justify-center min-h-8 min-w-8 px-1.5 rounded bg-caos-elevated border border-caos-border tabular text-caos-sm font-semibold text-caos-text hover:border-caos-accent hover:text-caos-accent transition-caos focus-ring aria-disabled:opacity-50",
        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$format$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["initials"])(user.full_name)
    }, void 0, false, {
        fileName: "[project]/src/components/shared/AnalystBadge.tsx",
        lineNumber: 36,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/components/shared/WorkflowRail.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WorkflowRail",
    ()=>WorkflowRail
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/nav.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RoleViewSwitch$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/RoleViewSwitch.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AnalystBadge$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/shared/AnalystBadge.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
function WorkflowRail() {
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["usePathname"])() || "/issuers";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
        className: "caos-workflow-rail",
        "aria-label": "Workspace navigation",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "h-14 px-5 flex items-center border-b border-caos-border",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                    href: "/command",
                    prefetch: false,
                    className: "no-underline focus-ring rounded-sm",
                    "aria-label": "CAOS Command Center",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "block text-caos-xl font-semibold tracking-[0.24em] text-caos-text",
                            children: "CAOS"
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/WorkflowRail.tsx",
                            lineNumber: 22,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "block mt-0.5 tabular text-caos-2xs tracking-[0.12em] text-caos-muted",
                            children: "CREDIT AGENT OS"
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/WorkflowRail.tsx",
                            lineNumber: 23,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/shared/WorkflowRail.tsx",
                    lineNumber: 21,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/shared/WorkflowRail.tsx",
                lineNumber: 20,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                id: "workspace-nav",
                "aria-label": "Workflow",
                className: "caos-rail-scroll flex-1 min-h-0 overflow-y-auto px-2.5 py-4",
                children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["NAV_GROUPS"].map((group)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        "aria-labelledby": `workflow-${group.id}`,
                        "data-active": group.items.some((item)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["routeMatches"])(pathname, item.href)),
                        className: "caos-rail-group mb-4 last:mb-0",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                id: `workflow-${group.id}`,
                                className: "px-2.5 mb-1.5 tabular text-caos-2xs font-medium uppercase tracking-[0.18em] text-caos-muted",
                                children: group.label
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/WorkflowRail.tsx",
                                lineNumber: 35,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-0.5",
                                children: group.items.map((item)=>{
                                    const active = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$nav$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["routeMatches"])(pathname, item.href);
                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                        href: item.href,
                                        prefetch: false,
                                        "aria-current": active ? "page" : undefined,
                                        className: `caos-rail-link focus-ring ${active ? "caos-rail-link-active" : ""}`,
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: item.label
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/shared/WorkflowRail.tsx",
                                            lineNumber: 52,
                                            columnNumber: 21
                                        }, this)
                                    }, item.href, false, {
                                        fileName: "[project]/src/components/shared/WorkflowRail.tsx",
                                        lineNumber: 45,
                                        columnNumber: 19
                                    }, this);
                                })
                            }, void 0, false, {
                                fileName: "[project]/src/components/shared/WorkflowRail.tsx",
                                lineNumber: 41,
                                columnNumber: 13
                            }, this)
                        ]
                    }, group.id, true, {
                        fileName: "[project]/src/components/shared/WorkflowRail.tsx",
                        lineNumber: 29,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/components/shared/WorkflowRail.tsx",
                lineNumber: 27,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "border-t border-caos-border p-2.5 space-y-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                        href: "/settings",
                        prefetch: false,
                        "aria-current": pathname.startsWith("/settings") ? "page" : undefined,
                        className: `caos-rail-link focus-ring ${pathname.startsWith("/settings") ? "caos-rail-link-active" : ""}`,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            children: "Settings"
                        }, void 0, false, {
                            fileName: "[project]/src/components/shared/WorkflowRail.tsx",
                            lineNumber: 68,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/shared/WorkflowRail.tsx",
                        lineNumber: 62,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between gap-2 px-1 pt-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$RoleViewSwitch$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["RoleViewSwitch"], {}, void 0, false, {
                                fileName: "[project]/src/components/shared/WorkflowRail.tsx",
                                lineNumber: 71,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$shared$2f$AnalystBadge$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AnalystBadge"], {}, void 0, false, {
                                fileName: "[project]/src/components/shared/WorkflowRail.tsx",
                                lineNumber: 72,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/shared/WorkflowRail.tsx",
                        lineNumber: 70,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/shared/WorkflowRail.tsx",
                lineNumber: 61,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/shared/WorkflowRail.tsx",
        lineNumber: 19,
        columnNumber: 5
    }, this);
}
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/dynamic-access-async-storage.external.js [external] (next/dist/server/app-render/dynamic-access-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/dynamic-access-async-storage.external.js", () => require("next/dist/server/app-render/dynamic-access-async-storage.external.js"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1npnwsa._.js.map