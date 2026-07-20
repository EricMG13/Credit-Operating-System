(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/lib/reports/assumptions.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ADDBACKS",
    ()=>ADDBACKS,
    "DEFAULT_ASSUMPTIONS",
    ()=>DEFAULT_ASSUMPTIONS,
    "DEFAULT_CASE",
    ()=>DEFAULT_CASE,
    "DEFAULT_DA_PCT",
    ()=>DEFAULT_DA_PCT,
    "FORECAST_LABELS",
    ()=>FORECAST_LABELS,
    "REFERENCE_SOFR_CURVES",
    ()=>REFERENCE_SOFR_CURVES,
    "caseModifiedCount",
    ()=>caseModifiedCount,
    "effectiveYear",
    ()=>effectiveYear,
    "loadAssumptions",
    ()=>loadAssumptions,
    "parseAssumptions",
    ()=>parseAssumptions,
    "saveAssumptions",
    ()=>saveAssumptions,
    "yearModifiedCount",
    ()=>yearModifiedCount
]);
// Forward-case assumptions — analyst nudges to the agent's BASE / DOWN forecast
// drivers, surfaced in the Model Builder's Assumptions panel. Each field is an
// adjustment *relative to the agent's baseline*, so the defaults are no-ops and
// buildModel reproduces the agent build exactly.
//
// Units:
//  - growth / margin fields are additive deltas in decimal (0.01 = +1pp),
//    applied to every forecast year;
//  - daPct is the D&A % of sales itself (absolute; agent baseline 4.6%);
//  - cash-flow lines (mInt … mDiss) are multipliers on the agent baseline $;
//  - divDelta is an absolute $/yr dividend (the agent forecasts none, so a
//    multiplier would be inert — negative = a sponsor distribution, CP-2D);
//  - sofrDelta is additive to each seeded annual SOFR point (0.01 = +100bp).
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/engine/types.ts [app-client] (ecmascript)");
;
const ADDBACKS = [
    {
        key: "abRestr",
        label: "Restructuring",
        w: 0.30
    },
    {
        key: "abMna",
        label: "Transaction / non-recurring",
        w: 0.22
    },
    {
        key: "abSbc",
        label: "Stock-based comp",
        w: 0.20
    },
    {
        key: "abSyn",
        label: "Run-rate synergies",
        w: 0.18
    },
    {
        key: "abOther",
        label: "Pro forma",
        w: 0.10
    }
];
const FORECAST_LABELS = [
    "FY26e",
    "FY27e",
    "FY28e"
];
const DEFAULT_DA_PCT = 0.046;
const REFERENCE_SOFR_CURVES = {
    base: [
        0.038,
        0.035,
        0.033
    ],
    down: [
        0.033,
        0.030,
        0.030
    ]
};
const LEGACY_DEFAULT_SOFR_RATE = 0.043;
const DEFAULT_CASE = {
    gDrive: 0,
    gFluid: 0,
    gAfter: 0,
    dGpm: 0,
    dAdjm: 0,
    daPct: DEFAULT_DA_PCT,
    mInt: 1,
    mLeases: 1,
    mTax: 1,
    mWc: 1,
    mCapex: 1,
    mAcq: 1,
    mDiss: 1,
    divDelta: 0,
    sofrDelta: 0,
    abRestr: 1,
    abMna: 1,
    abSbc: 1,
    abSyn: 1,
    abOther: 1
};
const DEFAULT_ASSUMPTIONS = {
    base: {
        ...DEFAULT_CASE
    },
    down: {
        ...DEFAULT_CASE
    },
    baseYears: {},
    downYears: {}
};
// Legacy global (pre-namespacing) key. Persisted state is now per-issuer under
// `caos-d-assumptions:${issuerId}`, so one issuer's nudges never contaminate
// another's. The reference (Atlas Forge demo) issuer inherits the old global
// value once, so the seeded demo keeps its saved state; live issuers start clean.
const LEGACY_KEY = "caos-d-assumptions";
const keyFor = (issuerId)=>`${LEGACY_KEY}:${issuerId}`;
function sanitizeCase(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const out = {
        ...DEFAULT_CASE
    };
    for (const key of Object.keys(DEFAULT_CASE)){
        const value = source[key];
        if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    }
    return out;
}
const finiteNumber = (value)=>typeof value === "number" && Number.isFinite(value);
function migrateLegacySofr(rawCase, rawYears, curve) {
    const ca = sanitizeCase(rawCase);
    const years = sanitizeYears(rawYears);
    const source = rawCase && typeof rawCase === "object" ? rawCase : {};
    const yearSource = rawYears && typeof rawYears === "object" ? rawYears : {};
    const legacyAll = finiteNumber(source.sofrRate) ? source.sofrRate : null;
    for (const year of [
        0,
        1,
        2
    ]){
        const rawYear = yearSource[year] && typeof yearSource[year] === "object" ? yearSource[year] : {};
        const legacyYear = finiteNumber(rawYear.sofrRate) ? rawYear.sofrRate : null;
        const alreadyMigrated = years[year]?.sofrDelta !== undefined;
        // The old 4.3% all-years value was the buggy default, not an analyst change;
        // adopting the seeded curve fixes untouched saved sessions. Non-default old
        // values and explicit year values retain their effective absolute rate.
        const absolute = legacyYear ?? (legacyAll !== null && legacyAll !== LEGACY_DEFAULT_SOFR_RATE ? legacyAll : null);
        if (alreadyMigrated || absolute === null) continue;
        const delta = Math.round((absolute - curve[year]) * 1e12) / 1e12;
        years[year] = {
            ...years[year] ?? {},
            sofrDelta: delta
        };
    }
    return {
        ca,
        years
    };
}
function parseAssumptions(raw) {
    try {
        const s = JSON.parse(raw || "null");
        if (s && typeof s === "object" && s.base && s.down) {
            const base = migrateLegacySofr(s.base, s.baseYears, REFERENCE_SOFR_CURVES.base);
            const down = migrateLegacySofr(s.down, s.downYears, REFERENCE_SOFR_CURVES.down);
            return {
                base: base.ca,
                down: down.ca,
                baseYears: base.years,
                downYears: down.years
            };
        }
    } catch  {}
    return null;
}
function loadAssumptions(issuerId) {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const namespaced = parseAssumptions(sessionStorage.getItem(keyFor(issuerId)));
    if (namespaced) return namespaced;
    // One-time migration: only the reference issuer adopts the legacy global value.
    if (issuerId === __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$engine$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ATLF_REFERENCE_ISSUER_ID"]) {
        const legacy = parseAssumptions(localStorage.getItem(LEGACY_KEY));
        if (legacy) {
            localStorage.removeItem(LEGACY_KEY);
            sessionStorage.setItem(keyFor(issuerId), JSON.stringify(legacy));
            return legacy;
        }
    }
    return DEFAULT_ASSUMPTIONS;
}
function saveAssumptions(issuerId, a) {
    const sanitized = {
        base: sanitizeCase(a.base),
        down: sanitizeCase(a.down),
        baseYears: sanitizeYears(a.baseYears),
        downYears: sanitizeYears(a.downYears)
    };
    try {
        sessionStorage.setItem(keyFor(issuerId), JSON.stringify(sanitized));
    } catch  {}
}
function caseModifiedCount(c) {
    return Object.keys(DEFAULT_CASE).filter((k)=>c[k] !== DEFAULT_CASE[k]).length;
}
function effectiveYear(all, ov) {
    return ov ? {
        ...all,
        ...ov
    } : all;
}
function yearModifiedCount(ov) {
    return ov ? Object.keys(ov).length : 0;
}
// Keep only known driver keys under valid year indices — guards persisted state.
function sanitizeYears(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    const keys = Object.keys(DEFAULT_CASE);
    for (const y of [
        0,
        1,
        2
    ]){
        const src = raw[y];
        if (!src || typeof src !== "object") continue;
        const ov = {};
        for (const k of keys){
            const v = src[k];
            if (typeof v === "number" && Number.isFinite(v)) ov[k] = v;
        }
        if (Object.keys(ov).length) out[y] = ov;
    }
    return out;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/reports/model.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// M-118 cash-flow model engine — full port of design bundle concept-d-model.js.
// Constructs the ATLF model grid from upstream module outputs: CP-1 normalized
// financials · CP-1A segments · CP-1B quarterly dashboard · CP-2E liquidity ·
// CP-2F rate registers · CP-3B capital structure · CP-2B P1 downside ·
// CP-6A base-case haircut.
//
// Consumed by both the Model Builder (/model — full grid incl. PF/BASE/DOWN,
// severity, manual overrides) and the Report Studio (/reports — historical
// columns only).
//
// Optionally grounded in a live CP-1 run: passing a `ModelAnchor` re-bases the
// LTM and PF columns onto the engine's reported figures (see `applyAnchor`),
// leaving historicals and the forecast on the seeded build.
__turbopack_context__.s([
    "OV_FIELDS",
    ()=>OV_FIELDS,
    "buildModel",
    ()=>buildModel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$assumptions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/reports/assumptions.ts [app-client] (ecmascript)");
;
/* ---- quarterly actuals Mar-24 … Mar-26 (CP-1B T6 grain; Dec-25 is derived period G-02) ---- */ const QL = [
    "Mar-24",
    "Jun-24",
    "Sep-24",
    "Dec-24",
    "Mar-25",
    "Jun-25",
    "Sep-25",
    "Dec-25",
    "Mar-26"
];
const REV = [
    615,
    640,
    655,
    678,
    656,
    688,
    701,
    697,
    715
];
const ADJ = [
    94,
    97,
    99,
    102,
    102,
    103,
    106,
    104,
    108
];
const AB = [
    15,
    16,
    16,
    16,
    18,
    18,
    19,
    19,
    21
];
const AFT = [
    0.218,
    0.22,
    0.222,
    0.224,
    0.226,
    0.228,
    0.23,
    0.231,
    0.234
];
const DRV = [
    0.465,
    0.463,
    0.461,
    0.459,
    0.457,
    0.455,
    0.453,
    0.452,
    0.45
];
const GPM = [
    0.262,
    0.263,
    0.264,
    0.264,
    0.265,
    0.265,
    0.266,
    0.265,
    0.266
];
const INT = [
    47,
    48,
    48,
    49,
    49,
    49,
    50,
    50,
    49
];
const TAX = [
    5,
    6,
    6,
    7,
    6,
    6,
    7,
    7,
    7
];
const WC = [
    -14,
    4,
    2,
    6,
    -15,
    5,
    2,
    7,
    -16
];
const DISS = [
    16.5,
    -3.5,
    -3.5,
    -3.5,
    -3.5,
    -3.5,
    -3.5,
    -3.5,
    -3.5
];
const DIV = [
    0,
    -30,
    0,
    0,
    0,
    -40,
    0,
    0,
    0
];
const OTHF = [
    -1,
    -1,
    -1,
    -1,
    -1.25,
    -1.25,
    -1.25,
    -1.25,
    -2.8
];
const TLBQ = [
    1448,
    1445,
    1441,
    1438,
    1434,
    1431,
    1427,
    1424,
    1420
];
const SOFRQ = [
    5.33,
    5.31,
    4.96,
    4.59,
    4.41,
    4.36,
    4.33,
    4.31,
    4.3
];
const DAYS_H = {
    dso: 52,
    dsi: 78,
    dpo: 45
};
const OV_FIELDS = [
    "rev",
    "adj",
    "ab",
    "int",
    "tax",
    "wc",
    "capex",
    "diss",
    "div"
];
function finishFlows(input) {
    const c = input;
    c.cogs = c.rev - c.gp;
    c.ebitda = c.adj - c.ab;
    // D&A is 4.6% of sales unless a forecast column sets its own assumption (daPct).
    c.da = c.rev * (typeof c.daPct === "number" ? c.daPct : 0.046);
    c.ebit = c.ebitda - c.da;
    c.opex = c.gp - c.ebit;
    c.ffo = c.adj - c.int - c.leases - c.tax - c.oth;
    c.cfo = c.ffo + c.wc;
    c.fcf = c.cfo - c.capex;
    c.ncf = c.fcf + c.acq + c.diss + c.div + c.othf;
    return input;
}
// The annual credit KPIs, derived from the column's debt stack + adj. EBITDA.
// Used by finishBalances (build) and the quarterly rolling-LTM pass — NOT by
// applyAnchor: on an anchored column these ratios would mix live figures with
// the seeded stack (finding 4.3), so applyAnchor sets its KPIs explicitly.
function deriveCreditKpis(input) {
    const c = input;
    // Guard each denominator so a degenerate column (adj ≤ 0 under deep margin
    // stress, no debt, zero interest) degrades to null rather than leaking
    // NaN/±Infinity into the grid — which `?.toFixed() ?? "—"` would print as
    // "Infinityx" since Infinity is a real number that survives optional chaining.
    const divByPositive = (num, den)=>Number.isFinite(num) && Number.isFinite(den) && den > 0 ? num / den : null;
    c.srsec = divByPositive(c.rcf + c.tlb + c.ssn - c.cash, c.adj);
    c.totlev = divByPositive(c.tdebt, c.adj);
    c.netlev = divByPositive(c.ndebt, c.adj);
    c.intcov = c.adj > 0 ? divByPositive(c.adj, c.int) : null;
    c.fcfdebt = divByPositive(c.fcf, c.tdebt);
}
function finishBalances(input) {
    const c = input;
    c.secured = c.rcf + c.tlb + c.ssn;
    c.tdebt = c.secured + c.sub;
    c.ndebt = c.tdebt - c.cash;
    c.gpm = c.gp / c.rev;
    c.adjm = c.adj / c.rev;
    const m = c.mult || 1;
    c.ar = c.rev * m * c.days.dso / 365;
    c.inv = c.cogs * m * c.days.dsi / 365;
    c.ap = c.cogs * m * c.days.dpo / 365;
    const annual = [
        "fy",
        "ltm",
        "pf",
        "b",
        "d"
    ].includes(c.kind);
    if (annual) {
        deriveCreditKpis(c);
        const ebt = c.ebit - c.int;
        c.taxrate = ebt > 5 ? c.tax / ebt : null;
    } else {
        c.srsec = null;
        c.totlev = null;
        c.netlev = null;
        c.intcov = null;
        c.fcfdebt = null;
        c.taxrate = null;
    }
    c.sga = (c.opex - c.da) / c.rev;
    c.dapc = c.da / c.rev;
    c.capexrev = c.capex / c.rev;
    // Default: split add-backs across the register by weight (forecast columns
    // pass their own per-account amounts, reflecting analyst acceptance).
    if (!c.abAccts) c.abAccts = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$assumptions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ADDBACKS"].map((a)=>c.ab * a.w);
    if (!c.ov) c.ov = {};
    return input;
}
// Ground an annual anchor column (LTM / PF) in a live CP-1 run: re-base its
// revenue, adj. EBITDA and net debt onto the engine's reported figures. Applied
// as a post-step *after* the forecast is built, so BASE/DOWN (which read the
// seeded l1.cash) and the historicals are untouched. Debt stack (tdebt) stays
// seeded; cash is back-solved from net debt to keep the column self-consistent —
// unless the back-solve goes negative (live net debt above the seeded stack):
// no honest cash figure exists then, so it degrades to NaN, which every
// formatter (fmt/fm/round3) renders blank.
//
// KPIs (finding 4.3): only net leverage is honestly live/live here. The other
// ratios would mix bases — totlev/srsec/fcfdebt divide the SEEDED debt stack by
// live adj. EBITDA, and a derived intcov would put live adj over seeded ATLF
// interest — fabricated figures a committee would read as reported. Null them,
// and take interest coverage from CP-1's own reported figure (null → "—").
function applyAnchor(c, a) {
    c.rev = a.ltmRevenue;
    c.adj = a.ltmAdjEbitda;
    c.adjm = c.adj / c.rev;
    // Keep the reported-EBITDA bridge footing after the re-base: reported + add-backs
    // = adj. The anchor carries no live add-back detail, so hold the seeded add-back
    // amount (c.ab) and back out reported EBITDA from the live adj — otherwise the
    // committee EBITDA-adjustments panel would print a bridge that doesn't tie.
    c.ebitda = c.adj - c.ab;
    c.ndebt = a.netDebt;
    // FE 4.3 / E2E-5d (branch re-base + main's mongrel-null, reconciled): re-base
    // interest from the anchor's own reported coverage so intcov ties to the live
    // figure AND is internally consistent (c.adj/c.int == a.intCov); suppress it when
    // the run reported none. Guard a negative cash back-solve to NaN. Then null the
    // debt-stack-derived KPIs the SEEDED stack can't honestly source for a live issuer.
    const cash = c.tdebt - c.ndebt;
    c.cash = cash >= 0 ? cash : NaN;
    const cov = a.intCov;
    if (cov != null && isFinite(cov) && cov > 0) {
        c.int = c.adj / cov;
        deriveCreditKpis(c);
    } else {
        deriveCreditKpis(c);
        c.intcov = null;
    }
    c.netlev = c.adj > 0 ? c.ndebt / c.adj : null;
    c.totlev = null;
    c.srsec = null;
    c.fcfdebt = null;
}
function qCtx(i, prevCash, A, capexOv) {
    const rev = A.rev[i];
    const c = {
        key: "q" + i,
        label: QL[i],
        kind: "q",
        mult: 4,
        derived: i === 7,
        rev,
        segA: rev * AFT[i],
        segD: rev * DRV[i],
        segF: rev * (1 - AFT[i] - DRV[i]),
        gp: rev * GPM[i],
        adj: A.adj[i],
        ab: A.ab[i],
        int: A.int[i],
        leases: 2.5,
        tax: A.tax[i],
        oth: 1,
        wc: A.wc[i],
        capex: capexOv[i] != null ? capexOv[i] : rev * 0.043,
        acq: 0,
        diss: A.diss[i],
        div: A.div[i],
        othf: OTHF[i],
        rcfSize: 250,
        rcf: 55,
        tlb: TLBQ[i],
        ssn: 900,
        sub: 200,
        sofr: SOFRQ[i],
        days: DAYS_H,
        gRev: i >= 4 ? A.rev[i] / A.rev[i - 4] - 1 : null,
        gAdj: i >= 4 ? A.adj[i] / A.adj[i - 4] - 1 : null,
        gSegD: i >= 4 ? A.rev[i] * DRV[i] / (A.rev[i - 4] * DRV[i - 4]) - 1 : null,
        gSegF: i >= 4 ? A.rev[i] * (1 - AFT[i] - DRV[i]) / (A.rev[i - 4] * (1 - AFT[i - 4] - DRV[i - 4])) - 1 : null,
        gSegA: i >= 4 ? A.rev[i] * AFT[i] / (A.rev[i - 4] * AFT[i - 4]) - 1 : null
    };
    finishFlows(c);
    c.cash = prevCash + c.ncf;
    return finishBalances(c);
}
function sumCtx(key, label, kind, qs, balOf, prior) {
    const S = (f)=>qs.reduce((s, q)=>s + q[f], 0);
    const gSeg = (sum, p)=>prior && p != null ? sum / p - 1 : null;
    const c = {
        key,
        label,
        kind,
        mult: kind === "ytd" ? 4 : 1,
        derived: qs.some((q)=>q.derived),
        rev: S("rev"),
        segA: S("segA"),
        segD: S("segD"),
        segF: S("segF"),
        gp: S("gp"),
        adj: S("adj"),
        ab: S("ab"),
        int: S("int"),
        leases: S("leases"),
        tax: S("tax"),
        oth: S("oth"),
        wc: S("wc"),
        capex: S("capex"),
        acq: S("acq"),
        diss: S("diss"),
        div: S("div"),
        othf: S("othf"),
        cash: balOf.cash,
        rcfSize: 250,
        rcf: balOf.rcf,
        tlb: balOf.tlb,
        ssn: balOf.ssn,
        sub: balOf.sub,
        sofr: qs[qs.length - 1].sofr,
        days: DAYS_H,
        gRev: prior ? S("rev") / prior.rev - 1 : null,
        gAdj: prior ? S("adj") / prior.adj - 1 : null,
        gSegD: gSeg(S("segD"), prior?.segD),
        gSegF: gSeg(S("segF"), prior?.segF),
        gSegA: gSeg(S("segA"), prior?.segA)
    };
    finishFlows(c);
    return finishBalances(c);
}
// FY22 / FY23 from CP-1 normalized history (pre-quarterly window)
function fyManual(key, label, p, prior) {
    const c = {
        key,
        label,
        kind: "fy",
        mult: 1,
        derived: false,
        rcfSize: 250,
        days: DAYS_H,
        gRev: prior ? p.rev / prior.rev - 1 : null,
        gAdj: prior ? p.adj / prior.adj - 1 : null,
        gSegD: prior ? p.segD / prior.segD - 1 : null,
        gSegF: prior ? p.segF / prior.segF - 1 : null,
        gSegA: prior ? p.segA / prior.segA - 1 : null,
        ...p
    };
    finishFlows(c);
    return finishBalances(c);
}
// Forecast year
function fCtx(key, label, kind, p, prevCash, prior) {
    const c = {
        key,
        label,
        kind,
        mult: 1,
        derived: false,
        rcfSize: 250,
        leases: 10,
        acq: p.acq || 0,
        div: 0,
        ...p
    };
    c.rev = c.segA + c.segD + c.segF;
    c.gp = c.rev * c.gpmF;
    c.capex = c.rev * c.capexPct;
    c.gRev = prior ? c.rev / prior.rev - 1 : null;
    c.gAdj = prior ? c.adj / prior.adj - 1 : null;
    c.gSegD = prior ? c.segD / prior.segD - 1 : null;
    c.gSegF = prior ? c.segF / prior.segF - 1 : null;
    c.gSegA = prior ? c.segA / prior.segA - 1 : null;
    finishFlows(c);
    c.cash = prevCash + c.ncf;
    return finishBalances(c);
}
function buildModel(sev = 1, OV = {}, anchor, asmp = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$assumptions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_ASSUMPTIONS"]) {
    const s = Math.max(0.25, Math.min(1.6, sev || 1));
    const g = (col, f, dflt)=>{
        const v = OV[col + ":" + f];
        return v != null ? v : dflt;
    };
    const ovOf = (col)=>{
        const o = {};
        OV_FIELDS.forEach((f)=>{
            if (OV[col + ":" + f] != null) o[f] = true;
        });
        return o;
    };
    // apply quarterly overrides onto cloned input arrays (growth ratios stay consistent)
    const A = {
        rev: REV.slice(),
        adj: ADJ.slice(),
        ab: AB.slice(),
        int: INT.slice(),
        tax: TAX.slice(),
        wc: WC.slice(),
        diss: DISS.slice(),
        div: DIV.slice()
    };
    const capexOv = {};
    Object.keys(OV).forEach((k)=>{
        const p = k.split(":"), col = p[0], f = p[1];
        if (col.charAt(0) === "q" && col.length <= 2) {
            const i = parseInt(col.slice(1), 10);
            if (!(i >= 0 && i < 9)) return;
            if (f === "capex") capexOv[i] = OV[k];
            else if (A[f]) A[f][i] = OV[k];
        }
    });
    // quarterly chain (cash rolls from Dec-23: 168)
    const q = [];
    let cash = 168;
    for(let i = 0; i < 9; i++){
        const c = qCtx(i, cash, A, capexOv);
        c.ov = ovOf("q" + i);
        cash = c.cash;
        q.push(c);
    }
    for(let i = 3; i < q.length; i++){
        const l4q = q.slice(i - 3, i + 1);
        const sum = (f)=>l4q.reduce((n, c)=>n + c[f], 0);
        const c = q[i];
        const saved = {
            adj: c.adj,
            int: c.int,
            fcf: c.fcf
        };
        c.adj = sum("adj");
        c.int = sum("int");
        c.fcf = sum("fcf");
        deriveCreditKpis(c);
        c.adj = saved.adj;
        c.int = saved.int;
        c.fcf = saved.fcf;
    }
    const r22 = g("f22", "rev", 2295);
    const f22 = fyManual("f22", "FY22", {
        rev: r22,
        segA: r22 * 0.21,
        segD: r22 * 0.47,
        segF: r22 * 0.32,
        gp: r22 * 0.258,
        adj: g("f22", "adj", 331),
        ab: g("f22", "ab", 24),
        int: g("f22", "int", 168),
        leases: 10,
        tax: g("f22", "tax", 18),
        oth: 4,
        wc: g("f22", "wc", -6),
        capex: g("f22", "capex", 96),
        acq: 0,
        diss: g("f22", "diss", -14),
        div: g("f22", "div", 0),
        othf: -2,
        cash: 161,
        rcf: 55,
        tlb: 1216,
        ssn: 900,
        sub: 200,
        sofr: 1.62
    }, null);
    f22.ov = ovOf("f22");
    const r23 = g("f23", "rev", 2410);
    const f23 = fyManual("f23", "FY23", {
        rev: r23,
        segA: r23 * 0.216,
        segD: r23 * 0.463,
        segF: r23 * 0.321,
        gp: r23 * 0.26,
        adj: g("f23", "adj", 358),
        ab: g("f23", "ab", 40),
        int: g("f23", "int", 178),
        leases: 10,
        tax: g("f23", "tax", 20),
        oth: 4,
        wc: g("f23", "wc", -8),
        capex: g("f23", "capex", 96),
        acq: -210,
        diss: g("f23", "diss", 216),
        div: g("f23", "div", 0),
        othf: -41,
        cash: 168,
        rcf: 55,
        tlb: 1202,
        ssn: 1130,
        sub: 200,
        sofr: 5.05
    }, f22);
    f23.ov = ovOf("f23");
    const f24 = sumCtx("f24", "FY24", "fy", q.slice(0, 4), q[3], f23);
    const f25 = sumCtx("f25", "FY25", "fy", q.slice(4, 8), q[7], f24);
    const y0 = sumCtx("y0", "Mar-25", "ytd", [
        q[4]
    ], q[4], {
        rev: q[0].rev,
        adj: q[0].adj,
        segD: q[0].segD,
        segF: q[0].segF,
        segA: q[0].segA
    });
    const y1 = sumCtx("y1", "Mar-26", "ytd", [
        q[8]
    ], q[8], {
        rev: q[4].rev,
        adj: q[4].adj,
        segD: q[4].segD,
        segF: q[4].segF,
        segA: q[4].segA
    });
    const l0 = sumCtx("l0", "Mar-25", "ltm", q.slice(1, 5), q[4], f24);
    const l1 = sumCtx("l1", "Mar-26", "ltm", q.slice(5, 9), q[8], l0);
    [
        "srsec",
        "totlev",
        "netlev",
        "intcov",
        "fcfdebt"
    ].forEach((k)=>{
        y0[k] = l0[k];
        y1[k] = l1[k];
    });
    // PF: LTM Mar-26 pro forma for the 2L TL '31 issue (refis 2L bridge; interest restated)
    const pf = {
        ...l1,
        key: "pf",
        label: "Jun-26",
        kind: "pf",
        int: 193
    };
    finishFlows(pf);
    pf.cash = l1.cash;
    finishBalances(pf);
    // base forecast — sponsor model less CP-6A chair haircut ($35M) and CP-1B phasing
    const segs25 = {
        a: f25.segA,
        d: f25.segD,
        f: f25.segF
    };
    const BASE = [
        {
            g: {
                d: 0.020,
                f: 0.030,
                a: 0.070
            },
            adj: 446,
            ab: 60,
            gpmF: 0.268,
            int: 196,
            tax: 30,
            oth: 4,
            wc: -10,
            capexPct: 0.043,
            acq: -24,
            diss: -14,
            othf: -4,
            tlb: 1406,
            sofr: 3.8,
            days: DAYS_H
        },
        {
            g: {
                d: 0.025,
                f: 0.030,
                a: 0.065
            },
            adj: 468,
            ab: 45,
            gpmF: 0.270,
            int: 188,
            tax: 36,
            oth: 4,
            wc: -10,
            capexPct: 0.043,
            acq: 0,
            diss: -14,
            othf: -4,
            tlb: 1392,
            sofr: 3.5,
            days: DAYS_H
        },
        {
            g: {
                d: 0.025,
                f: 0.030,
                a: 0.060
            },
            adj: 490,
            ab: 35,
            gpmF: 0.272,
            int: 180,
            tax: 42,
            oth: 4,
            wc: -12,
            capexPct: 0.043,
            acq: 0,
            diss: -18,
            othf: -4,
            tlb: 1374,
            sofr: 3.3,
            days: DAYS_H
        }
    ];
    // downside — CP-2B pathway P1 (OEM destocking), scaled by severity s
    const DOWN = [
        {
            g: {
                d: 0.020 - 0.140 * s,
                f: 0.030 - 0.070 * s,
                a: 0.070 - 0.040 * s
            },
            adjK: 0.18,
            ab: 60,
            gpmF: 0.258,
            int: 196 + 4 * s,
            tax: 12,
            oth: 10 + 15 * s,
            wc: 18 * s,
            capexPct: 0.038,
            acq: 0,
            diss: 60 * s - 14,
            othf: -4,
            rcfD: 55 + 60 * s,
            tlb: 1406,
            sofr: 3.3,
            days: {
                dso: 58,
                dsi: 86,
                dpo: 42
            }
        },
        {
            g: {
                d: 0.010,
                f: 0.010,
                a: 0.040
            },
            adjK: 0.16,
            ab: 45,
            gpmF: 0.260,
            int: 192 + 4 * s,
            tax: 16,
            oth: 12,
            wc: -2,
            capexPct: 0.038,
            acq: 0,
            diss: -34,
            othf: -4,
            rcfD: 55 + 40 * s,
            tlb: 1392,
            sofr: 3.0,
            days: {
                dso: 56,
                dsi: 83,
                dpo: 43
            }
        },
        {
            g: {
                d: 0.050,
                f: 0.040,
                a: 0.050
            },
            adjK: 0.12,
            ab: 35,
            gpmF: 0.263,
            int: 186 + 4 * s,
            tax: 24,
            oth: 6,
            wc: -8,
            capexPct: 0.040,
            acq: 0,
            diss: -34,
            othf: -4,
            rcfD: 55 + 20 * s,
            tlb: 1374,
            sofr: 3.0,
            days: {
                dso: 54,
                dsi: 80,
                dpo: 44
            }
        }
    ];
    const fLabels = [
        "FY26e",
        "FY27e",
        "FY28e"
    ];
    // Agent-baseline revenue per forecast year (segments grown with the agent's
    // own growth, no analyst delta). Used to hold the implied adj-EBITDA margin
    // fixed as the growth sliders move revenue, so a margin slider is the *only*
    // thing that moves the margin.
    const baseRevOf = (rows)=>{
        let sg = segs25;
        return rows.map((p)=>{
            sg = {
                a: sg.a * (1 + p.g.a),
                d: sg.d * (1 + p.g.d),
                f: sg.f * (1 + p.g.f)
            };
            return sg.a + sg.d + sg.f;
        });
    };
    // Build a forecast column applying a case's assumptions. `agentAdj` is the
    // agent's baseline adj. EBITDA for the year; we re-express it as a margin on
    // the agent-baseline revenue, then re-apply on the slider-adjusted revenue.
    const fcast = (key, kind, i, p, A, agentAdj, baseRev, prevSeg, pc, prior, rcf)=>{
        const seg = {
            a: prevSeg.a * (1 + p.g.a + A.gAfter),
            d: prevSeg.d * (1 + p.g.d + A.gDrive),
            f: prevSeg.f * (1 + p.g.f + A.gFluid)
        };
        const rev = seg.a + seg.d + seg.f;
        const adj = rev * (agentAdj / baseRev + A.dAdjm);
        // Add-back register. `abAccts` is the sponsor's gross claim per account.
        // Acceptance (A[account]) credits only the realised portion to Adj. EBITDA;
        // the unrealised remainder is deducted, leaving reported EBITDA unchanged.
        const abAccts = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$assumptions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ADDBACKS"].map((a)=>p.ab * a.w);
        const abAdj = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$assumptions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ADDBACKS"].reduce((s, a, i)=>s + abAccts[i] * A[a.key], 0);
        const baselineSofr = p.sofr / 100;
        const effectiveSofr = Math.max(0, baselineSofr + A.sofrDelta);
        const effectiveSofrPct = Math.round(effectiveSofr * 1e12) / 1e10;
        const floatingDebt = rcf + p.tlb + 900;
        const rateDeltaInterest = floatingDebt * (effectiveSofr - baselineSofr);
        return fCtx(key, fLabels[i], kind, {
            ab: abAdj,
            abAccts,
            oth: p.oth,
            othf: p.othf,
            tlb: p.tlb,
            sofr: effectiveSofrPct,
            days: p.days,
            adj: adj + (abAdj - p.ab),
            gpmF: p.gpmF + A.dGpm,
            daPct: A.daPct,
            int: (p.int + rateDeltaInterest) * A.mInt,
            leases: 10 * A.mLeases,
            tax: p.tax * A.mTax,
            wc: p.wc * A.mWc,
            capexPct: p.capexPct * A.mCapex,
            acq: p.acq * A.mAcq,
            diss: p.diss * A.mDiss,
            div: A.divDelta,
            segA: seg.a,
            segD: seg.d,
            segF: seg.f,
            rcf,
            ssn: 900,
            sub: 200
        }, pc, prior);
    };
    const baseRevB = baseRevOf(BASE);
    const base = [];
    let pc = l1.cash;
    let prevSeg = segs25;
    let prior = f25;
    BASE.forEach((p, i)=>{
        const A = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$assumptions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["effectiveYear"])(asmp.base, asmp.baseYears?.[i]);
        const c = fcast("b" + i, "b", i, p, A, p.adj, baseRevB[i], prevSeg, pc, prior, 55);
        base.push(c);
        pc = c.cash;
        prevSeg = {
            a: c.segA,
            d: c.segD,
            f: c.segF
        };
        prior = c;
    });
    const baseRevD = baseRevOf(DOWN);
    const down = [];
    pc = l1.cash;
    prevSeg = segs25;
    prior = f25;
    DOWN.forEach((p, i)=>{
        const agentAdj = BASE[i].adj * (1 - p.adjK * s); // agent downside adj before sliders
        const A = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$assumptions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["effectiveYear"])(asmp.down, asmp.downYears?.[i]);
        const c = fcast("d" + i, "d", i, p, A, agentAdj, baseRevD[i], prevSeg, pc, prior, p.rcfD);
        down.push(c);
        pc = c.cash;
        prevSeg = {
            a: c.segA,
            d: c.segD,
            f: c.segF
        };
        prior = c;
    });
    const cols = {};
    [
        ...q,
        f22,
        f23,
        f24,
        f25,
        y0,
        y1,
        l0,
        l1,
        pf,
        ...base,
        ...down
    ].forEach((c)=>{
        cols[c.key] = c;
    });
    const columns = [
        ...q.map((c)=>({
                key: c.key,
                group: "Q"
            })),
        {
            key: "y0",
            group: "YTD"
        },
        {
            key: "y1",
            group: "YTD"
        },
        {
            key: "f22",
            group: "HIST"
        },
        {
            key: "f23",
            group: "HIST"
        },
        {
            key: "f24",
            group: "HIST"
        },
        {
            key: "f25",
            group: "HIST"
        },
        {
            key: "l0",
            group: "LTM"
        },
        {
            key: "l1",
            group: "LTM"
        },
        {
            key: "pf",
            group: "PF"
        },
        {
            key: "b0",
            group: "BASE"
        },
        {
            key: "b1",
            group: "BASE"
        },
        {
            key: "b2",
            group: "BASE"
        },
        {
            key: "d0",
            group: "DOWN"
        },
        {
            key: "d1",
            group: "DOWN"
        },
        {
            key: "d2",
            group: "DOWN"
        }
    ];
    // Capture the model's own LTM net leverage before any anchor, so the UI can
    // reconcile the seeded build against CP-1's reported figure, then ground the
    // LTM (l1) and PF columns in the live run if one is supplied.
    const seededLtmNetlev = cols.l1.netlev ?? 0;
    if (anchor) {
        applyAnchor(cols.l1, anchor);
        applyAnchor(cols.pf, anchor);
    }
    return {
        cols,
        columns,
        provenance: {
            seededLtmNetlev,
            anchored: !!anchor
        }
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/model/rows.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Model Builder row + source-manifest definitions (port of design bundle concept-d.jsx).
__turbopack_context__.s([
    "ROWS",
    ()=>ROWS,
    "SRC",
    ()=>SRC
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$assumptions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/reports/assumptions.ts [app-client] (ecmascript)");
;
const SRC = {
    cp1: {
        chip: "CP-1 T4.7",
        name: "Normalized financials",
        ev: [
            "E-103"
        ]
    },
    cp1a: {
        chip: "CP-1A 06",
        name: "Operating model — segments",
        ev: [
            "E-12",
            "E-15"
        ]
    },
    cp1b: {
        chip: "CP-1B T6",
        name: "Quarterly KPI dashboard",
        ev: [
            "E-58"
        ],
        note: "Dec-25 derived (G-02)"
    },
    cp1ab: {
        chip: "CP-1 K-09",
        name: "Add-back register",
        ev: [
            "E-09",
            "E-87"
        ]
    },
    cp1k22: {
        chip: "CP-1 K-22",
        name: "FCF conversion calc",
        ev: [
            "E-22"
        ]
    },
    cp2e: {
        chip: "CP-2E T2E.5",
        name: "Liquidity bridge",
        ev: [
            "E-77"
        ]
    },
    cp2f: {
        chip: "CP-2F T2F.2",
        name: "Rate exposure register",
        ev: [],
        warn: "L-04"
    },
    cp3b: {
        chip: "CP-3B T3B.2",
        name: "Capital structure dashboard",
        ev: [
            "E-63"
        ]
    },
    cp2d: {
        chip: "CP-2D T2D.5",
        name: "Capital allocation risk",
        ev: [
            "E-91"
        ]
    },
    cp6a: {
        chip: "CP-6A 06",
        name: "Chair haircut → base case",
        ev: [
            "E-09"
        ],
        colGroup: "BASE"
    },
    cp2b: {
        chip: "CP-2B P1",
        name: "Downside pathway → downside case",
        ev: [
            "E-77"
        ],
        colGroup: "DOWN"
    }
};
const ROWS = [
    {
        sec: "Income Statement"
    },
    {
        id: "segD",
        l: "Drivetrain",
        g: (c)=>c.segD,
        f: "m",
        ind: 1,
        shade: 1,
        src: "cp1a"
    },
    {
        id: "gsegD",
        l: "% growth",
        g: (c)=>c.gSegD,
        f: "p",
        ind: 1,
        pct: 1,
        src: "cp1b"
    },
    {
        id: "segF",
        l: "Fluid Systems",
        g: (c)=>c.segF,
        f: "m",
        ind: 1,
        shade: 1,
        src: "cp1a"
    },
    {
        id: "gsegF",
        l: "% growth",
        g: (c)=>c.gSegF,
        f: "p",
        ind: 1,
        pct: 1,
        src: "cp1b"
    },
    {
        id: "segA",
        l: "Aftermarket & Services",
        g: (c)=>c.segA,
        f: "m",
        ind: 1,
        shade: 1,
        src: "cp1a"
    },
    {
        id: "gsegA",
        l: "% growth",
        g: (c)=>c.gSegA,
        f: "p",
        ind: 1,
        pct: 1,
        src: "cp1b"
    },
    // refNote-only: the Σ-divisions claim is ATLF-specific AND false on anchored
    // live columns (applyAnchor re-bases rev but not the segment rows).
    {
        id: "rev",
        l: "Total revenue",
        g: (c)=>c.rev,
        f: "m",
        bold: 1,
        line: 1,
        src: "cp1",
        refNote: "Total revenue = Σ divisions · CP-1 T4.7 normalized financials"
    },
    {
        id: "grev",
        l: "% growth",
        g: (c)=>c.gRev,
        f: "p",
        ind: 1,
        pct: 1,
        src: "cp1b"
    },
    {
        id: "cogs",
        l: "COGS",
        g: (c)=>-c.cogs,
        f: "m",
        ind: 1,
        shade: 1,
        src: "cp1"
    },
    {
        id: "gp",
        l: "Gross Profit",
        g: (c)=>c.gp,
        f: "m",
        bold: 1,
        src: "cp1"
    },
    {
        id: "gpm",
        l: "% margin",
        g: (c)=>c.gpm,
        f: "p",
        ind: 1,
        pct: 1
    },
    {
        id: "opex",
        l: "OPEX",
        g: (c)=>-c.opex,
        f: "m",
        ind: 1,
        shade: 1,
        src: "cp1"
    },
    {
        id: "ebit",
        l: "EBIT",
        g: (c)=>c.ebit,
        f: "m",
        bold: 1
    },
    {
        id: "da",
        l: "D&A",
        g: (c)=>c.da,
        f: "m",
        ind: 1,
        shade: 1,
        src: "cp1"
    },
    {
        id: "ebitda",
        l: "EBITDA",
        g: (c)=>c.ebitda,
        f: "m",
        bold: 1,
        formula: "EBITDA = EBIT + D&A (reported, pre add-backs)"
    },
    ...__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$assumptions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ADDBACKS"].map((a, i)=>({
            id: a.key,
            l: a.label,
            g: (c)=>c.abAccts[i],
            f: "m",
            ind: 1,
            shade: 1,
            src: "cp1ab",
            formula: `${a.label} add-back — illustrative split of the CP-1 K-09 register (engine discloses aggregate % + categories, not per-account amounts)`
        })),
    {
        id: "abunreal",
        l: "less: unrealised (deducted)",
        g: (c)=>c.ab - c.abAccts.reduce((s, x)=>s + x, 0),
        f: "m",
        ind: 1,
        shade: 1,
        src: "cp1ab",
        formula: "Unrealised sponsor add-backs deducted to a defensible buy-side basis — Σ gross × (1 − acceptance)"
    },
    {
        id: "ab",
        l: "Total add-backs (net)",
        g: (c)=>c.ab,
        f: "m",
        ind: 1,
        src: "cp1ab",
        formula: "Net realised add-backs credited to Adj. EBITDA — CP-1 K-09 register less unrealised"
    },
    {
        id: "adj",
        l: "Adj. EBITDA",
        g: (c)=>c.adj,
        f: "m",
        bold: 1,
        line: 1,
        src: "cp1ab"
    },
    {
        id: "adjm",
        l: "% margin",
        g: (c)=>c.adjm,
        f: "p",
        ind: 1,
        pct: 1
    },
    {
        id: "gadj",
        l: "% growth",
        g: (c)=>c.gAdj,
        f: "p",
        ind: 1,
        pct: 1,
        src: "cp1b"
    },
    {
        sec: "Cash Flow"
    },
    {
        id: "adj2",
        l: "Adj. EBITDA",
        g: (c)=>c.adj,
        f: "m",
        bold: 1
    },
    {
        id: "int",
        l: "Cash Interest",
        g: (c)=>-c.int,
        f: "m",
        ind: 1,
        shade: 1,
        src: "cp2f",
        formula: "Cash interest = Σ instrument balance × (base rate + margin)",
        refNote: "CP-2F T2F.2 — modeled, hedging register absent (L-04)"
    },
    {
        id: "leases",
        l: "Leases",
        g: (c)=>-c.leases,
        f: "m",
        ind: 1,
        shade: 1
    },
    {
        id: "tax",
        l: "Cash Taxes",
        g: (c)=>-c.tax,
        f: "m",
        ind: 1,
        shade: 1
    },
    {
        id: "oth",
        l: "Other",
        g: (c)=>-c.oth,
        f: "m",
        ind: 1,
        shade: 1
    },
    {
        id: "ffo",
        l: "FFO",
        g: (c)=>c.ffo,
        f: "m",
        bold: 1,
        formula: "FFO = Adj. EBITDA − cash interest − leases − cash taxes − other"
    },
    {
        id: "wc",
        l: "Changes in WC",
        g: (c)=>c.wc,
        f: "m",
        ind: 1,
        shade: 1,
        src: "cp2e"
    },
    {
        id: "cfo",
        l: "CFO",
        g: (c)=>c.cfo,
        f: "m",
        bold: 1,
        formula: "CFO = FFO + changes in working capital"
    },
    {
        id: "capex",
        l: "Capex & Intangibles",
        g: (c)=>-c.capex,
        f: "m",
        ind: 1,
        shade: 1,
        src: "cp1k22"
    },
    {
        id: "fcf",
        l: "FCF",
        g: (c)=>c.fcf,
        f: "m",
        bold: 1,
        src: "cp1k22",
        formula: "FCF = CFO − capex & intangible investment · CP-1 calc register K-22"
    },
    {
        id: "acq",
        l: "Acquisitions",
        g: (c)=>c.acq,
        f: "m",
        ind: 1,
        shade: 1
    },
    {
        id: "diss",
        l: "Debt Issue / (Repay)",
        g: (c)=>c.diss,
        f: "m",
        ind: 1,
        shade: 1,
        src: "cp3b"
    },
    {
        id: "div",
        l: "Dividends",
        g: (c)=>c.div,
        f: "m",
        ind: 1,
        shade: 1,
        src: "cp2d",
        formula: "Sponsor distributions",
        refNote: "watch CP-2D flag — RP basket $240M (trigger T-4)"
    },
    {
        id: "othf",
        l: "Other",
        g: (c)=>c.othf,
        f: "m",
        ind: 1,
        shade: 1
    },
    {
        id: "ncf",
        l: "NCF",
        g: (c)=>c.ncf,
        f: "m",
        bold: 1,
        line: 1,
        src: "cp2e",
        formula: "NCF = FCF + acquisitions + debt issue/(repay) + dividends + other",
        refNote: "ties CP-2E bridge"
    },
    {
        sec: "Balance Sheet"
    },
    {
        id: "cash",
        l: "Cash",
        g: (c)=>c.cash,
        f: "m",
        bold: 1,
        src: "cp2e",
        formula: "Cash rolls forward from NCF",
        refNote: "anchored to CP-2E beginning liquidity register ($184M Mar-26)"
    },
    {
        id: "rcfsize",
        l: "RCF size",
        g: (c)=>c.rcfSize,
        f: "m",
        ind: 1,
        shade: 1,
        src: "cp3b"
    },
    {
        id: "rcf",
        l: "RCF (drawn)",
        sub: "S+350",
        g: (c)=>c.rcf,
        f: "m",
        ind: 1,
        shade: 1,
        src: "cp3b"
    },
    {
        id: "tlb",
        l: "1L Term Loan",
        sub: "S+375",
        g: (c)=>c.tlb,
        f: "m",
        ind: 1,
        shade: 1,
        src: "cp3b"
    },
    // refNote-only: the bridge/refi story is an ATLF deal fact, not a formula.
    {
        id: "ssn",
        l: "2L TL '31",
        sub: "S+425",
        g: (c)=>c.ssn,
        f: "m",
        ind: 1,
        shade: 1,
        src: "cp3b",
        refNote: "2L bridge to May-26, refinanced by the subject 2L TL '31 at issue · CP-3B T3B.2"
    },
    {
        id: "sub",
        l: "Sub Notes '32",
        sub: "10.000%",
        g: (c)=>c.sub,
        f: "m",
        ind: 1,
        shade: 1,
        src: "cp3b"
    },
    {
        id: "secured",
        l: "Secured Debt",
        g: (c)=>c.secured,
        f: "m",
        bold: 1,
        src: "cp3b"
    },
    {
        id: "tdebt",
        l: "Total Debt",
        g: (c)=>c.tdebt,
        f: "m",
        bold: 1,
        line: 1,
        src: "cp3b"
    },
    {
        id: "ndebt",
        l: "Net Debt",
        g: (c)=>c.ndebt,
        f: "m",
        bold: 1,
        src: "cp3b"
    },
    {
        id: "ar",
        l: "Net A/R",
        g: (c)=>c.ar,
        f: "m",
        ind: 1,
        shade: 1
    },
    {
        id: "inv",
        l: "Inventories",
        g: (c)=>c.inv,
        f: "m",
        ind: 1,
        shade: 1
    },
    {
        id: "ap",
        l: "A/P",
        g: (c)=>c.ap,
        f: "m",
        ind: 1,
        shade: 1
    },
    {
        sec: "KPIs"
    },
    {
        id: "srsec",
        l: "Sr. Sec Net Leverage",
        g: (c)=>c.srsec,
        f: "x",
        ind: 1
    },
    {
        id: "totlev",
        l: "Total Leverage",
        g: (c)=>c.totlev,
        f: "x",
        ind: 1
    },
    {
        id: "netlev",
        l: "Total Net Leverage",
        g: (c)=>c.netlev,
        f: "x",
        bold: 1,
        src: "cp1",
        formula: "Total Net Leverage = (Total Debt − Cash) / Adj. EBITDA",
        refNote: "ties to Q1-26 compliance cert 5.68x"
    },
    {
        id: "intcov",
        l: "Interest Coverage",
        g: (c)=>c.intcov,
        f: "x",
        ind: 1
    },
    {
        id: "fcfd",
        l: "FCF as % of Debt",
        g: (c)=>c.fcfdebt,
        f: "p",
        ind: 1,
        pct: 1
    },
    {
        id: "sga",
        l: "SG&A % of Sales",
        g: (c)=>c.sga,
        f: "p",
        ind: 1,
        pct: 1,
        shade: 1
    },
    {
        id: "dapc",
        l: "D&A % of Sales",
        g: (c)=>c.dapc,
        f: "p",
        ind: 1,
        pct: 1,
        shade: 1
    },
    {
        id: "dso",
        l: "DSO",
        g: (c)=>c.days.dso,
        f: "d",
        ind: 1
    },
    {
        id: "dsi",
        l: "DSI",
        g: (c)=>c.days.dsi,
        f: "d",
        ind: 1
    },
    {
        id: "dpo",
        l: "DPO",
        g: (c)=>c.days.dpo,
        f: "d",
        ind: 1
    },
    {
        id: "taxr",
        l: "Tax Rate",
        g: (c)=>c.taxrate,
        f: "p",
        ind: 1,
        pct: 1
    },
    {
        id: "cpr",
        l: "Capex / Revenue",
        g: (c)=>c.capexrev,
        f: "p",
        ind: 1,
        pct: 1,
        src: "cp1k22"
    },
    {
        id: "sofr",
        l: "SOFR rate",
        g: (c)=>c.sofr / 100,
        f: "r",
        ind: 1,
        pct: 1,
        src: "cp2f"
    }
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/model/model-format.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Model Builder cell formatting, override-editing, and input-parsing logic,
// plus column layout constants. Split out of rows.ts so the pure money/parse
// logic is unit-testable and separate from the (large) ROWS/SRC data schema.
__turbopack_context__.s([
    "CW",
    ()=>CW,
    "GROUPS_META",
    ()=>GROUPS_META,
    "LBL",
    ()=>LBL,
    "OV_SIGN",
    ()=>OV_SIGN,
    "buildPastePatch",
    ()=>buildPastePatch,
    "fmt",
    ()=>fmt,
    "isEditCol",
    ()=>isEditCol,
    "isEditable",
    ()=>isEditable,
    "ovField",
    ()=>ovField,
    "parseNum",
    ()=>parseNum
]);
function fmt(v, f) {
    // Reject every non-finite value (NaN *and* ±Infinity): a divide-by-zero KPI
    // (e.g. interest 0 → intcov Infinity) must render blank, not "Infinityx".
    if (v == null || !Number.isFinite(v)) return "";
    if (f === "m") {
        const r = Math.round(v);
        if (r === 0) return "–";
        const s = Math.abs(r).toLocaleString("en-US");
        return r < 0 ? `(${s})` : s;
    }
    if (f === "p" || f === "r") return (v * 100).toFixed(1) + "%";
    if (f === "x") return v.toFixed(2) + "x";
    if (f === "d") return Math.round(v).toString();
    return String(v);
}
const GROUPS_META = {
    Q: "Quarterly",
    YTD: "YTD",
    HIST: "Historic",
    LTM: "LTM",
    PF: "PF",
    BASE: "Base Forecast",
    DOWN: "Downside Forecast",
    CUSTOM: "Analyst"
};
const CW = {
    Q: 56,
    YTD: 60,
    HIST: 62,
    LTM: 62,
    PF: 62,
    BASE: 68,
    DOWN: 68
};
const LBL = 196;
const OV_SIGN = {
    rev: 1,
    adj: 1,
    ab: 1,
    int: -1,
    tax: -1,
    wc: 1,
    capex: -1,
    diss: 1,
    div: 1
};
const ovField = (rowId)=>rowId === "adj2" ? "adj" : rowId;
const isEditCol = (key)=>key.charAt(0) === "q" && key.length <= 2 || key === "f22" || key === "f23";
const isEditable = (rowId, colKey)=>OV_SIGN[ovField(rowId)] != null && isEditCol(colKey);
function parseNum(input) {
    let s = String(input).trim().replace(/,/g, "").replace(/\$/g, "");
    if (!s) return null;
    let neg = false;
    const m = s.match(/^\((.*)\)$/);
    if (m) {
        neg = true;
        s = m[1];
    }
    const v = neg ? -parseFloat(s) : parseFloat(s);
    // Reject every non-finite result (NaN *and* ±Infinity): "1e999" parses to
    // Infinity, which would slip past a NaN-only guard and poison aggregates.
    if (!Number.isFinite(v)) return null;
    return v;
}
function buildPastePatch(rowIds, colKeys, anchor, clipboardText) {
    const result = {
        patch: {},
        applied: 0,
        skippedNotEditable: 0,
        invalid: []
    };
    const startRow = rowIds.indexOf(anchor.row);
    const startCol = colKeys.indexOf(anchor.col);
    if (startRow === -1 || startCol === -1) return result;
    // Excel/Sheets copies often end in a trailing newline — that must not read
    // as a phantom blank row one past the real block.
    const lines = clipboardText.replace(/\r/g, "").split("\n");
    if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
    lines.forEach((line, ri)=>{
        const rowId = rowIds[startRow + ri];
        if (rowId == null) return; // past the last grid row — stop silently, spreadsheet-style
        line.split("\t").forEach((raw, ci)=>{
            const colKey = colKeys[startCol + ci];
            if (colKey == null) return; // past the last grid column
            const trimmed = raw.trim();
            if (trimmed === "") return; // a blank pasted cell leaves its target untouched
            if (!isEditable(rowId, colKey)) {
                result.skippedNotEditable++;
                return;
            }
            const v = parseNum(trimmed);
            if (v == null) {
                result.invalid.push(`${rowId}:${colKey}`);
                return;
            }
            const field = ovField(rowId);
            result.patch[colKey + ":" + field] = v * (OV_SIGN[field] ?? 1);
            result.applied++;
        });
    });
    return result;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/model/cell-style.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "KPI_DISTRESS_GLYPH",
    ()=>KPI_DISTRESS_GLYPH,
    "cellBackground",
    ()=>cellBackground,
    "cellBoxShadow",
    ()=>cellBoxShadow,
    "cellTextColor",
    ()=>cellTextColor,
    "kpiDistressColor",
    ()=>kpiDistressColor,
    "kpiDistressLevel",
    ()=>kpiDistressLevel
]);
// Pure cell-styling logic for the Model Builder sheet, lifted out of Sheet's
// renderCell so the grid render stays readable. Every function is pure:
// same inputs → same CSS string. Behavior is identical to the former inline
// derivations.
// KPI distress shading: leverage worsens up (orange 6.0x → red 8.0x), interest
// coverage worsens down (orange 2.0x → red 0.5x). Returns null when the metric
// is benign (below/above the band) so the normal cell color applies.
const LEV_ROWS = new Set([
    "srsec",
    "totlev",
    "netlev"
]);
const ORANGE = [
    245,
    165,
    36
];
const RED = [
    239,
    68,
    68
];
function kpiDistressRatio(rowId, v) {
    if (v == null) return null;
    let t = null;
    if (LEV_ROWS.has(rowId)) t = (v - 6) / 2; // 6x → 0 (orange), 8x → 1 (red)
    else if (rowId === "intcov") t = (2 - v) / 1.5; // 2x → 0 (orange), 0.5x → 1 (red)
    return t == null || t < 0 ? null : t;
}
function kpiDistressColor(rowId, v) {
    const ratio = kpiDistressRatio(rowId, v);
    if (ratio == null) return null;
    const t = Math.min(1, ratio);
    const c = ORANGE.map((o, i)=>Math.round(o + (RED[i] - o) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function kpiDistressLevel(rowId, v) {
    const ratio = kpiDistressRatio(rowId, v);
    return ratio == null ? null : ratio >= 1 ? "crit" : "warn";
}
const KPI_DISTRESS_GLYPH = {
    warn: "■",
    crit: "▲"
};
const percentTextColor = (v)=>v != null && v < 0 ? "var(--caos-critical)" : "var(--caos-accent)";
const standardTextColor = (v, bold, rowFmt)=>{
    if (bold) return "var(--caos-text)";
    return v != null && v < 0 && rowFmt === "m" ? "var(--caos-muted)" : "var(--caos-text)";
};
function cellTextColor(opts) {
    const { rowId, v, isOv, pct, bold, rowFmt } = opts;
    const distress = kpiDistressColor(rowId, v);
    if (distress) return distress;
    if (isOv) return "var(--caos-warning)";
    return pct ? percentTextColor(v) : standardTextColor(v, bold, rowFmt);
}
function cellBackground(opts) {
    const { isSel, cellHl, colHl, isHl, shade } = opts;
    return isSel ? "color-mix(in srgb, var(--caos-accent) 22%, transparent)" : cellHl ? "rgba(79,140,255,0.28)" : colHl || isHl ? "rgba(79,140,255,0.08)" : shade ? "rgba(255,255,255,0.025)" : "transparent";
}
function cellBoxShadow(isSel, cellHl) {
    return isSel ? "inset 0 0 0 1px var(--caos-accent)" : cellHl ? "inset 0 0 0 1px rgba(79,140,255,0.6)" : "none";
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/reports/builders.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildReferenceReport",
    ()=>buildReferenceReport,
    "buildReports",
    ()=>buildReports,
    "citeCount",
    ()=>citeCount,
    "fm",
    ()=>fm,
    "fx",
    ()=>fx,
    "secLabel",
    ()=>secLabel
]);
// Report builders — assembles the 5 committee deliverables from the model
// + ATLF module outputs (port of design bundle concept-e-reports.js).
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$model$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/reports/model.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/reports/deal.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$model$2f$rows$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/model/rows.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$model$2f$model$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/model/model-format.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$model$2f$cell$2d$style$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/model/cell-style.ts [app-client] (ecmascript)");
;
;
;
;
;
const fm = (v)=>{
    // Number.isFinite (not just isNaN): a divide-by-zero Infinity must render
    // blank in the committee paper, exactly as model-format's fmt() renders it
    // blank in the grid — not "∞"/"Infinity%". (#R1)
    if (v == null || !Number.isFinite(v)) return "";
    const r = Math.round(v);
    if (r === 0) return "–";
    const s = Math.abs(r).toLocaleString("en-US");
    return r < 0 ? "(" + s + ")" : s;
};
const fp = (v)=>v == null || !Number.isFinite(v) ? "" : (v * 100).toFixed(1) + "%";
const fx = (v)=>v == null || !Number.isFinite(v) ? "" : v.toFixed(2) + "x";
function seniorityStackChart(rcf, tlb, ssn, sub, equity, page) {
    const total = rcf + tlb + ssn + sub + equity;
    const isThin = (v)=>total > 0 && v / total < 0.18;
    const thinRows = [
        [
            "RCF",
            rcf
        ],
        [
            "1L TLB",
            tlb
        ],
        [
            "2L TL '31",
            ssn
        ],
        [
            "Sub Notes '32",
            sub
        ],
        [
            "Implied equity",
            equity
        ]
    ].filter(([, v])=>isThin(v));
    return {
        ...page ? {
            page
        } : {},
        // Visible ink caption carrying the tranches too thin to label in-bar.
        ...thinRows.length ? {
            note: `Unlabeled thin tranches: ${thinRows.map(([k, v])=>`${k} $${v.toLocaleString()}M`).join(" · ")}`
        } : {},
        t: "chart",
        kind: "stacked-bar",
        title: "SENIORITY STACK — CLAIMS INCL. IMPLIED EQUITY",
        unit: "$M",
        sourceIds: [
            "CP-3B:T3B.2",
            "E-63"
        ],
        accessibleSummary: `The stack comprises $${rcf}M RCF, $${tlb}M first-lien term loan, $${ssn}M second-lien term loan, $${sub}M subordinated notes, and $${equity}M implied equity.`,
        columns: [
            {
                key: "cls",
                label: "Claim"
            },
            {
                key: "v",
                label: "$M"
            }
        ],
        h: 52,
        // Single stacked band, seniority left→right. (An earlier per-tranche-bar
        // workaround here mis-blamed this G2 build's transpose: the measured
        // "correct offset, fraction of extent" renders were G2's enter animation
        // frozen by rAF starvation in an occluded pane. G2Chart now defaults
        // animate:false, so the band paints its final geometry on frame one.)
        spec: {
            type: "interval",
            data: [
                {
                    slot: "stack",
                    cls: "RCF (drawn)",
                    v: rcf
                },
                {
                    slot: "stack",
                    cls: "1L Term Loan B",
                    v: tlb
                },
                {
                    slot: "stack",
                    cls: "2L TL '31 (subject)",
                    v: ssn
                },
                {
                    slot: "stack",
                    cls: "Sub Notes '32",
                    v: sub
                },
                {
                    slot: "stack",
                    cls: "Implied equity @ 9.5x",
                    v: equity
                }
            ],
            encode: {
                x: "slot",
                y: "v",
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
                    domain: [
                        "RCF (drawn)",
                        "1L Term Loan B",
                        "2L TL '31 (subject)",
                        "Sub Notes '32",
                        "Implied equity @ 9.5x"
                    ],
                    range: [
                        "#0f766e",
                        "#0d9488",
                        "#2563eb",
                        "#7c3aed",
                        "#94a3b8"
                    ]
                }
            },
            // Name + value label inside each segment — but only where it fits:
            // overflowHide is unreliable under transpose (the RCF sliver painted a
            // clipped "CF 120" onto the paper), so thin tranches are gated
            // deterministically in the text callback. The same isThin() predicate
            // builds the ink caption below, so the caption states exactly the
            // tranches that carry no in-bar label.
            labels: [
                {
                    text: (d)=>isThin(d.v) ? "" : d.cls.split(" ")[0] + " " + d.v.toLocaleString(),
                    position: "inside",
                    fontSize: 10,
                    fontWeight: 600,
                    transform: [
                        {
                            type: "contrastReverse"
                        },
                        {
                            type: "overflowHide"
                        },
                        {
                            type: "overlapHide"
                        }
                    ]
                }
            ]
        }
    };
}
const APPENDIX_PCT_BLUE = "#2f64b7";
const MODEL_GROUP_LABELS = {
    Q: "Quarterly",
    YTD: "YTD",
    HIST: "Historic",
    LTM: "LTM",
    PF: "Pro forma",
    BASE: "Base",
    DOWN: "Downside"
};
function modelTableGroups(columns) {
    const groups = [];
    columns.forEach((column, index)=>{
        if (index === 0 || columns[index - 1].group !== column.group) {
            groups.push({
                start: index + 1,
                key: column.group,
                label: MODEL_GROUP_LABELS[column.group]
            });
        }
    });
    return groups;
}
/* ---------- financials grid (FY22…LTM, template layout) ---------- */ const FIN_KEYS = [
    "f22",
    "f23",
    "f24",
    "f25",
    "y0",
    "y1",
    "l1"
];
const FIN_LBL = [
    "FY22",
    "FY23",
    "FY24",
    "FY25",
    "PYTD",
    "YTD",
    "LTM"
];
const PRIOR = {
    f23: "f22",
    f24: "f23",
    f25: "f24",
    y1: "y0"
};
function finSections(model) {
    const C = FIN_KEYS.map((k)=>model.cols[k]);
    const row = (label, f, fmt, opt)=>({
            cells: [
                label,
                ...C.map((c)=>fmt(f(c)))
            ],
            ...opt
        });
    const growth = (f)=>[
            "",
            ...FIN_KEYS.map((k)=>{
                const p = PRIOR[k];
                return p ? fp(f(model.cols[k]) / f(model.cols[p]) - 1) : "n.a.";
            })
        ];
    const fin = {
        t: "table",
        title: "FINANCIALS",
        sub: "US$ in Mns",
        cols: [
            "",
            ...FIN_LBL
        ],
        align: [
            0,
            1,
            1,
            1,
            1,
            1,
            1,
            1
        ],
        rows: [
            row("Revenue", (c)=>c.rev, fm, {
                b: 1
            }),
            {
                cells: growth((c)=>c.rev),
                it: 1,
                lbl0: "%Δ"
            },
            row("Gross Profit", (c)=>c.gp, fm, {
                b: 1,
                gap: 1
            }),
            {
                cells: growth((c)=>c.gp),
                it: 1,
                lbl0: "%Δ"
            },
            {
                ...row("% margin", (c)=>c.gpm, fp),
                it: 1
            },
            row("EBITDA (adj.)", (c)=>c.adj, fm, {
                b: 1,
                gap: 1
            }),
            {
                cells: growth((c)=>c.adj),
                it: 1,
                lbl0: "%Δ"
            },
            {
                ...row("% margin", (c)=>c.adjm, fp),
                it: 1
            },
            row("Cash Interest", (c)=>-c.int, fm, {
                gap: 1
            }),
            row("Leases", (c)=>-c.leases, fm),
            row("Cash tax", (c)=>-c.tax, fm),
            row("Other", (c)=>-c.oth, fm, {
                line: 1
            }),
            row("FFO", (c)=>c.ffo, fm, {
                b: 1
            }),
            row("WC", (c)=>c.wc, fm, {
                line: 1
            }),
            row("CFO", (c)=>c.cfo, fm, {
                b: 1
            }),
            row("Capex", (c)=>-c.capex, fm, {
                line: 1
            }),
            row("FCF", (c)=>c.fcf, fm, {
                b: 1
            }),
            row("M&A", (c)=>c.acq, fm),
            row("Δ in debt", (c)=>c.diss, fm),
            row("Dividends", (c)=>c.div, fm),
            row("Other", (c)=>c.othf, fm, {
                line: 1
            }),
            row("Net Δ in cash", (c)=>c.ncf, fm, {
                b: 1
            })
        ]
    };
    const bs = {
        t: "table",
        title: "BALANCE SHEET",
        cols: [
            "",
            ...FIN_LBL
        ],
        align: [
            0,
            1,
            1,
            1,
            1,
            1,
            1,
            1
        ],
        rows: [
            row("Cash", (c)=>c.cash, fm),
            row("Senior debt", (c)=>c.secured, fm),
            row("Total debt", (c)=>c.tdebt, fm),
            row("Net debt", (c)=>c.ndebt, fm, {
                b: 1
            })
        ]
    };
    const cm = {
        t: "table",
        title: "CREDIT METRICS",
        cols: [
            "",
            ...FIN_LBL
        ],
        align: [
            0,
            1,
            1,
            1,
            1,
            1,
            1,
            1
        ],
        rows: [
            row("Senior Leverage", (c)=>c.srsec, fx),
            row("Total Leverage", (c)=>c.totlev, fx),
            row("Net Leverage", (c)=>c.netlev, fx, {
                b: 1
            }),
            row("Interest Cover", (c)=>c.intcov, fx)
        ]
    };
    return [
        fin,
        bs,
        cm
    ];
}
// Canonical ATLF capital structure (CP-3B dashboard, step-outputs.ts) — the
// authoritative tranche set this committee snapshot must tie to. Was seeded ad hoc
// (rcf 55 / sub 200 / model tlb ~1,420 → total 2,575), contradicting the CP-3B
// total of 3,270 under the same facility names. (review run-2 #F2)
function getCapitalStructure(model) {
    const l1 = model.cols.l1;
    const reported = l1.ebitda, addbacks = l1.ab, adj = l1.adj;
    const structEbitda = adj - 35;
    const rcf = 120, tlb = 1850, ssn = 900, sub = 400;
    const secured = rcf + tlb + ssn, tdebt = secured + sub, cash = Math.round(l1.cash);
    const ev = Math.round(9.5 * structEbitda), equity = ev - tdebt;
    const xm = (d)=>{
        const m = d / structEbitda;
        return Number.isFinite(m) ? m.toFixed(2) + "x" : "";
    };
    const pev = (d)=>{
        const p = d / ev * 100;
        return Number.isFinite(p) ? p.toFixed(0) + "%" : "";
    };
    const pfInt = Math.round(l1.int);
    return {
        reported,
        addbacks,
        adj,
        structEbitda,
        rcf,
        tlb,
        ssn,
        sub,
        secured,
        tdebt,
        cash,
        ev,
        equity,
        xm,
        pev,
        pfInt
    };
}
const APPENDIX_SUBTOTAL_LINES = new Set([
    "gp",
    "ebit",
    "ffo",
    "cfo"
]);
const APPENDIX_KPI_GROUP_LINES = new Set([
    "intcov",
    "sga",
    "dso",
    "taxr"
]);
function modelAppendixTable(model, columns) {
    const appendixPctColor = (v, rowId, bold, rowFmt)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$model$2f$cell$2d$style$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cellTextColor"])({
            rowId,
            v,
            isOv: false,
            pct: true,
            bold,
            rowFmt
        }).replace("var(--caos-accent)", APPENDIX_PCT_BLUE);
    const labelFor = (key)=>{
        const cell = model.cols[key];
        const column = model.columns.find((candidate)=>candidate.key === key);
        if (!column) return cell.label;
        return column.group === "Q" ? `Q ${cell.label}` : `${column.group} ${cell.label}`;
    };
    const cols = [
        "Line",
        ...columns.map((column)=>labelFor(column.key))
    ];
    const rows = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$model$2f$rows$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ROWS"].map((row)=>row.sec ? {
            cells: [
                row.sec,
                ...columns.map(()=>"")
            ],
            b: 1,
            line: 1,
            gap: 1
        } : (()=>{
            const values = columns.map((column)=>row.g?.(model.cols[column.key]) ?? null);
            return {
                cells: [
                    row.sub ? `${row.l} (${row.sub})` : row.l || "",
                    ...values.map((value)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$model$2f$model$2d$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fmt"])(value, row.f))
                ],
                cellColors: row.pct && row.id ? [
                    undefined,
                    ...values.map((value)=>appendixPctColor(value, row.id, !!row.bold, row.f))
                ] : undefined,
                b: row.bold,
                line: row.line || (row.id && (APPENDIX_SUBTOTAL_LINES.has(row.id) || APPENDIX_KPI_GROUP_LINES.has(row.id)) ? 1 : undefined),
                gap: row.line || (row.id && APPENDIX_KPI_GROUP_LINES.has(row.id) ? 1 : undefined)
            };
        })());
    return {
        cols,
        rows
    };
}
function modelAppendix(model, currency = "USD") {
    const { cols, rows } = modelAppendixTable(model, model.columns);
    return {
        id: "model",
        title: "Model Appendix",
        file: "ATLF_Model_Appendix.pdf",
        subtitle: `Atlas Forge Industrials (ATLF) · full M-118 model · ${currency} in Mns`,
        icon: "▦",
        srcs: [
            {
                chip: "MODEL",
                ev: [
                    "E-103"
                ]
            }
        ],
        sections: [
            {
                t: "table",
                title: "FULL MODEL",
                sub: `${currency} in Mns except ratios`,
                cols,
                align: cols.map((_, i)=>i === 0 ? 0 : 1),
                rows,
                columnGroups: modelTableGroups(model.columns)
            }
        ]
    };
}
function onReportPage(section, page) {
    return page ? {
        ...section,
        page
    } : section;
}
function companySummarySections(page) {
    return [
        onReportPage({
            t: "cols",
            w: [
                1,
                1
            ],
            items: [
                [
                    {
                        t: "profile",
                        title: "COMPANY PROFILE",
                        rows: [
                            [
                                "Company",
                                "Atlas Forge Industrials (ATLF)"
                            ],
                            [
                                "Sector",
                                "Industrials — engineered metal components"
                            ],
                            [
                                "Shareholders",
                                "Kestrel Fund V 68.4% · co-invest 22.4% · mgmt 9.2%"
                            ],
                            [
                                "Corp Ratings (M/S/F)",
                                "B2 / B / —"
                            ],
                            [
                                "Country",
                                "United States"
                            ],
                            [
                                "Management",
                                "T. Renner (CEO) · M. Okafor (CFO)"
                            ],
                            [
                                "Sector Outlook",
                                "STABLE — order book 1.06x"
                            ],
                            [
                                "Sponsor Quality",
                                "Competent operator · extractive policy (CP-2D)"
                            ],
                            [
                                "Credit Score",
                                "71 / 100 (CP-3 T3.3)"
                            ],
                            [
                                "Credit Direction",
                                "IMPROVING — gated on Q3-26 certificate"
                            ]
                        ]
                    }
                ],
                [
                    {
                        t: "profile",
                        title: "RECOMMENDATION",
                        rows: [
                            [
                                "Analyst",
                                "CAOS · RUN #2641"
                            ],
                            [
                                "Date",
                                "Jun 10, 2026"
                            ],
                            [
                                "Recommendation",
                                "OVERWEIGHT — 75bps initial → 125bps max (CP-6E)"
                            ],
                            [
                                "Entry",
                                "+388bps or wider · limit at +400"
                            ],
                            [
                                "CLO",
                                "Market weight"
                            ],
                            [
                                "Indexed Loans",
                                "Market weight"
                            ],
                            [
                                "Indexed Lev Loan",
                                "Overweight"
                            ],
                            [
                                "Clearance",
                                "CP-5 CONDITIONAL — QA-117 open"
                            ]
                        ]
                    }
                ]
            ]
        }, page),
        onReportPage({
            t: "table",
            title: "TRANSACTION SUMMARY AND NEW DEBT ISSUES",
            cols: [
                "Borrower",
                "Instrument",
                "Debt Type",
                "UoP",
                "Tranche ($Mn)",
                "Guidance / IPT",
                "OID",
                "Maturity",
                "Exp. Ratings",
                "CR Score",
                "Commit"
            ],
            align: [
                0,
                0,
                0,
                0,
                1,
                1,
                1,
                1,
                0,
                1,
                0
            ],
            rows: [
                {
                    cells: [
                        "Atlas Forge Intermediate Holdings",
                        "2L TL '31",
                        "2nd Lien Term Loan",
                        "Refi 2L bridge + GCP",
                        "900",
                        "S+400–425 / IPT S+450",
                        "99.41",
                        "2031",
                        "B3 / B−",
                        "71",
                        "May-26"
                    ]
                }
            ]
        }, page)
    ];
}
function businessOverviewSection(capital, page, adjustmentsTitle = "EBITDA ADJUSTMENTS") {
    const { reported, addbacks, adj, structEbitda } = capital;
    return onReportPage({
        t: "cols",
        w: [
            3,
            2
        ],
        items: [
            [
                {
                    t: "text",
                    title: "BUSINESS DESCRIPTION",
                    body: "Engineered metal components for industrial OEMs across Drivetrain (46% of revenue), Fluid Systems (31%) and Aftermarket & Services (23% of revenue, 44% of gross profit). 14 plants (9 US, 4 EU, 1 MX); #1–2 share in 7 of 9 core lines. The credit rests on a 1.9M-unit installed base feeding contract-locked aftermarket revenue renewing at 92%; 71% of COGS is pass-through-indexed with a 60–90 day lag. Owned by Kestrel Capital Fund V since the 2021 LBO ($2,150M EV, 7.9x)."
                }
            ],
            [
                {
                    t: "profile",
                    title: adjustmentsTitle,
                    rows: [
                        [
                            "Reported EBITDA (LTM)",
                            fm(reported)
                        ],
                        [
                            "Company add-backs",
                            fm(addbacks)
                        ],
                        [
                            "Adj. EBITDA (company)",
                            fm(adj)
                        ],
                        [
                            "Analyst adj. 1 — recurring 'one-time' charges",
                            "(25)"
                        ],
                        [
                            "Analyst adj. 2 — cost-out phasing risk",
                            "(10)"
                        ],
                        [
                            "Analyst adj. 3",
                            "—"
                        ],
                        [
                            "Structuring EBITDA",
                            fm(structEbitda)
                        ]
                    ],
                    boldLast: 1
                }
            ]
        ]
    }, page);
}
function capitalStructureSections(capital, page) {
    const { rcf, tlb, ssn, sub, secured, tdebt, cash, ev, equity, xm, pev, pfInt, structEbitda } = capital;
    return [
        onReportPage({
            t: "table",
            title: "CAPITAL STRUCTURE",
            cols: [
                "Facility",
                "Spread / Coupon",
                "CCY",
                "Maturity",
                "Bid",
                "Ask",
                "Outstanding ($Mn)",
                "Multiple",
                "% EV",
                "Recommendation"
            ],
            align: [
                0,
                1,
                0,
                1,
                1,
                1,
                1,
                1,
                1,
                0
            ],
            rows: [
                {
                    cells: [
                        "RCF $250M (drawn)",
                        "S+350",
                        "USD",
                        "2027",
                        "—",
                        "—",
                        fm(rcf),
                        "",
                        "",
                        "—"
                    ]
                },
                {
                    cells: [
                        "1L Term Loan B",
                        "S+375",
                        "USD",
                        "2029",
                        "99.10",
                        "99.60",
                        fm(tlb),
                        "",
                        "",
                        "HOLD"
                    ]
                },
                {
                    cells: [
                        "2L TL '31 (subject)",
                        "S+425",
                        "USD",
                        "2031",
                        "96.25",
                        "96.75",
                        fm(ssn),
                        "",
                        "",
                        "BUY"
                    ]
                },
                {
                    cells: [
                        "Senior secured debt",
                        "",
                        "",
                        "",
                        "",
                        "",
                        fm(secured),
                        xm(secured),
                        pev(secured),
                        ""
                    ],
                    b: 1,
                    line: 1
                },
                {
                    cells: [
                        "Sub Notes '32",
                        "10.000%",
                        "USD",
                        "2032",
                        "88.50",
                        "89.80",
                        fm(sub),
                        "",
                        "",
                        "AVOID"
                    ]
                },
                {
                    cells: [
                        "Unsecured / subordinated",
                        "",
                        "",
                        "",
                        "",
                        "",
                        fm(sub),
                        xm(sub),
                        "",
                        ""
                    ],
                    b: 1,
                    line: 1
                },
                {
                    cells: [
                        "Total debt",
                        "",
                        "",
                        "",
                        "",
                        "",
                        fm(tdebt),
                        xm(tdebt),
                        pev(tdebt),
                        ""
                    ],
                    b: 1
                },
                {
                    cells: [
                        "Cash",
                        "",
                        "",
                        "",
                        "",
                        "",
                        fm(cash),
                        "",
                        "",
                        ""
                    ]
                },
                {
                    cells: [
                        "(Implied) Equity @ 9.5x",
                        "",
                        "",
                        "",
                        "",
                        "",
                        fm(equity),
                        "",
                        "",
                        ""
                    ]
                },
                {
                    cells: [
                        "EV @ 9.5x structuring EBITDA",
                        "",
                        "",
                        "",
                        "",
                        "",
                        fm(ev),
                        "9.50x",
                        "100%",
                        ""
                    ],
                    b: 1,
                    line: 1
                },
                {
                    cells: [
                        "PF interest",
                        "",
                        "",
                        "",
                        "",
                        "",
                        fm(pfInt),
                        fx(structEbitda / pfInt),
                        "",
                        ""
                    ],
                    it: 1
                }
            ]
        }, page),
        seniorityStackChart(rcf, tlb, ssn, sub, equity, page)
    ];
}
function varianceSection(page) {
    return onReportPage({
        t: "table",
        title: "VARIANCE VS ANALYST MODEL",
        cols: [
            "Line",
            "Saved base",
            "Actual",
            "Δ",
            "Driver"
        ],
        align: [
            0,
            1,
            1,
            1,
            0
        ],
        rows: [
            {
                cells: [
                    "Revenue",
                    "722.0",
                    "715.0",
                    "−1.0%",
                    "Fluid Systems volume"
                ]
            },
            {
                cells: [
                    "Adj. EBITDA",
                    "112.7",
                    "108.0",
                    "−4.2%",
                    "volume (−3.1) + cost-out phasing (−1.6)"
                ]
            },
            {
                cells: [
                    "Margin",
                    "15.6%",
                    "15.1%",
                    "−50bps",
                    "absorption"
                ]
            }
        ]
    }, page);
}
function catalystCalendarSection(page, title = "CATALYST CALENDAR — NEXT 12 MONTHS") {
    return onReportPage({
        t: "table",
        title,
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
            {
                cells: [
                    "Jul 28, 2026",
                    "Q2-26 earnings + first add-back realization print",
                    "100%",
                    "HIGH",
                    "CP-1B · CP-6A"
                ]
            },
            {
                cells: [
                    "Sep 2026",
                    "RCF extension / repricing window opens",
                    "70%",
                    "MED",
                    "CP-3D"
                ]
            },
            {
                cells: [
                    "Oct 2026",
                    "Q3-26 compliance certificate (add-back test)",
                    "100%",
                    "HIGH",
                    "CP-1 · T-1"
                ]
            },
            {
                cells: [
                    "Q4 2026",
                    "Kestrel Fund V exit-window commentary",
                    "40%",
                    "MED",
                    "CP-2D"
                ]
            },
            {
                cells: [
                    "Q2 2027",
                    "Meridian-platform contract repricing",
                    "100%",
                    "HIGH",
                    "CP-2B P1"
                ]
            }
        ]
    }, page);
}
function keyProvisionsSection(page) {
    return onReportPage({
        t: "table",
        title: "KEY PROVISIONS",
        cols: [
            "Provision · doc",
            "Feature",
            "Aggressiveness",
            "Headroom / capacity"
        ],
        align: [
            0,
            0,
            1,
            1
        ],
        rows: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["COVENANTS"].slice(0, 6).map((covenant)=>({
                cells: [
                    covenant.ref,
                    covenant.name,
                    covenant.agg + " / 10",
                    covenant.headroom
                ]
            }))
    }, page);
}
function capacityBuildSection(page, title = "CAPACITY BUILD ($M)") {
    return onReportPage({
        t: "table",
        title,
        cols: [
            "Component",
            "Amount",
            "Basis"
        ],
        align: [
            0,
            1,
            0
        ],
        rows: [
            {
                cells: [
                    "Freebie basket",
                    "150",
                    "greater of $150M / 35% × EBITDA"
                ]
            },
            {
                cells: [
                    "Ratio capacity",
                    "310",
                    "to 5.25x secured at 4.68x current"
                ]
            },
            {
                cells: [
                    "Reclassification headroom",
                    "155",
                    "basket migration mechanics"
                ]
            },
            {
                cells: [
                    "Total — incurrable pari or senior to 2L",
                    "612",
                    ""
                ],
                b: 1,
                line: 1
            }
        ]
    }, page);
}
/* ---------- Credit Snapshot ---------- */ function creditSnapshot(model) {
    const capital = getCapitalStructure(model);
    return {
        id: "snapshot",
        title: "Credit Snapshot",
        file: "ATLF Credit Snapshot",
        subtitle: "Atlas Forge Industrials (ATLF) · generated from RUN #2641 module outputs · Jun 10, 2026",
        icon: "dashboard",
        srcs: [
            {
                chip: "CP-1 T4.7",
                ev: [
                    "E-103"
                ]
            },
            {
                chip: "CP-1A 06",
                ev: [
                    "E-12",
                    "E-15"
                ]
            },
            {
                chip: "CP-1 K-09",
                ev: [
                    "E-09"
                ]
            },
            {
                chip: "CP-3B T3B.2",
                ev: [
                    "E-63"
                ]
            },
            {
                chip: "CP-6A 06",
                ev: []
            },
            {
                chip: "MKT",
                ev: [
                    "E-71"
                ]
            },
            {
                chip: "M-118",
                ev: []
            }
        ],
        sections: [
            ...companySummarySections(),
            ...capitalStructureSections(capital),
            businessOverviewSection(capital),
            {
                t: "text",
                title: "INVESTMENT THESIS",
                body: "Carry plus deleveraging, not convergence: at +388bps the 2L TL pays +48–63bps over the fair band (+20–25bps ex-E-44) for risks that are monitorable rather than structural. Base case deleverages to ~4.9x by FY27 on realized add-backs alone (sponsor model demoted to upside). The bear case — structural add-backs, $612M priming capacity, sponsor recap record — is real but priced; the IC haircuts base EBITDA by $35M and stages sizing accordingly. Verdict: CONSTRUCTIVE, add on weakness (CP-6A).",
                label: "Catalysts and near-term events",
                labelBody: "Jul 28 Q2-26 print (first add-back realization read) · Oct-26 Q3-26 compliance certificate (T-1 — thesis-defining) · Sep-26 RCF extension window · Jun-27 MFN sunset · Q2-27 Meridian repricing."
            },
            {
                t: "cols",
                w: [
                    1,
                    1
                ],
                items: [
                    [
                        {
                            t: "list",
                            title: "CREDIT SUMMARY",
                            subhead: "Strengths",
                            items: [
                                "Aftermarket annuity — 44% of gross profit, 92% renewal, 1.9M-unit installed base (E-12)",
                                "Genuine FCF and capex-light model — top-quartile conversion vs peers (E-22)",
                                "Liquidity — 19.3 months-to-empty; no maturity inside 24 months (E-77)"
                            ]
                        },
                        {
                            t: "list",
                            subhead: "Weaknesses",
                            items: [
                                "EBITDA quality — add-backs 18.2% of adj.; 'one-time' charges recurred 3 of last 4 years (E-09 · E-87)",
                                "Documentation — $612M day-one capacity pari/senior to 2L; MFN sunsets Jun-27 (E-63 · E-64)",
                                "Concentration — top-3 OEMs 38% of revenue; Meridian repricing Q2-27 (E-15)"
                            ]
                        },
                        {
                            t: "text",
                            subhead: "Historical Performance",
                            body: "Revenue compounded ~6.9% FY22–LTM with adj. margin pinned at 14.9–15.1% through an input-cost spike cycle. Deleveraging from 6.7x to 5.68x came entirely from EBITDA growth — net debt flat at ~$2.4B across four capital-structure events. Q1-26 tracked −4.2% below the sponsor model (Fluid Systems volume); conflict logged, model demoted to upside case."
                        }
                    ],
                    finSections(model)
                ]
            }
        ]
    };
}
/* ---------- Earnings Update ---------- */ function earningsUpdate() {
    return {
        id: "earnings",
        title: "Earnings Update — Q1-26",
        file: "ATLF Earnings Update Q1-26",
        subtitle: "Atlas Forge Industrials (ATLF) · CP-1B monitoring output · print date Jun 10, 2026",
        icon: "trend",
        srcs: [
            {
                chip: "CP-1B T6",
                ev: [
                    "E-58"
                ]
            },
            {
                chip: "CP-1 T4.7",
                ev: [
                    "E-103"
                ]
            },
            {
                chip: "CP-2C T5.2",
                ev: []
            }
        ],
        sections: [
            {
                t: "profile",
                title: "PRINT SUMMARY",
                rows: [
                    [
                        "Issuer / period",
                        "Atlas Forge Industrials — Q1 FY26 (Mar-26)"
                    ],
                    [
                        "Headline",
                        "In line — trajectory intact, sponsor model runs hot"
                    ],
                    [
                        "Thesis impact",
                        "NEUTRAL-POSITIVE · no trigger trips"
                    ],
                    [
                        "Next checkpoint",
                        "Jul 28 — Q2-26 print, first add-back realization read"
                    ]
                ]
            },
            {
                t: "table",
                title: "TOP SHEET",
                cols: [
                    "Metric",
                    "Q1-26",
                    "vs Q1-25",
                    "Read"
                ],
                align: [
                    0,
                    1,
                    1,
                    0
                ],
                rows: [
                    {
                        cells: [
                            "Revenue",
                            "$715M",
                            "+3.9%",
                            "in line"
                        ]
                    },
                    {
                        cells: [
                            "Adj. EBITDA",
                            "$108M",
                            "+4.9%",
                            "in line"
                        ]
                    },
                    {
                        cells: [
                            "Margin",
                            "15.1%",
                            "+10bps",
                            "stable"
                        ]
                    },
                    {
                        cells: [
                            "Book-to-bill",
                            "1.06x",
                            "+0.04x",
                            "supportive"
                        ]
                    },
                    {
                        cells: [
                            "Net leverage",
                            "5.68x",
                            "−0.3x",
                            "deleveraging on EBITDA"
                        ]
                    }
                ]
            },
            {
                t: "table",
                title: "KPI DASHBOARD (QUARTERLY)",
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
                    {
                        cells: [
                            "Revenue ($M)",
                            "688",
                            "701",
                            "697",
                            "715"
                        ]
                    },
                    {
                        cells: [
                            "Adj. EBITDA ($M)",
                            "103",
                            "106",
                            "104",
                            "108"
                        ]
                    },
                    {
                        cells: [
                            "Margin",
                            "15.0%",
                            "15.1%",
                            "14.9%",
                            "15.1%"
                        ]
                    },
                    {
                        cells: [
                            "Orders / book-to-bill",
                            "1.02x",
                            "1.04x",
                            "0.98x",
                            "1.06x"
                        ]
                    },
                    {
                        cells: [
                            "Aftermarket mix (rev)",
                            "22.4%",
                            "22.8%",
                            "23.1%",
                            "23.4%"
                        ]
                    }
                ],
                note: "* Q4-25 derived period — management accounts missing (gap G-02)"
            },
            {
                t: "chart",
                kind: "bar",
                title: "REVENUE & ADJ. EBITDA — TRAILING QUARTERS",
                unit: "$M",
                sourceIds: [
                    "CP-1B:T6",
                    "E-58",
                    "G-02"
                ],
                accessibleSummary: "Revenue rises from $688M in Q2-25 to $715M in Q1-26; adjusted EBITDA rises from $103M to $108M. Q4-25 is a derived period.",
                columns: [
                    {
                        key: "q",
                        label: "Quarter"
                    },
                    {
                        key: "m",
                        label: "Measure"
                    },
                    {
                        key: "v",
                        label: "$M"
                    }
                ],
                h: 168,
                spec: {
                    type: "interval",
                    data: [
                        {
                            q: "Q2-25",
                            m: "Revenue",
                            v: 688
                        },
                        {
                            q: "Q3-25",
                            m: "Revenue",
                            v: 701
                        },
                        {
                            q: "Q4-25*",
                            m: "Revenue",
                            v: 697
                        },
                        {
                            q: "Q1-26",
                            m: "Revenue",
                            v: 715
                        },
                        {
                            q: "Q2-25",
                            m: "Adj. EBITDA",
                            v: 103
                        },
                        {
                            q: "Q3-25",
                            m: "Adj. EBITDA",
                            v: 106
                        },
                        {
                            q: "Q4-25*",
                            m: "Adj. EBITDA",
                            v: 104
                        },
                        {
                            q: "Q1-26",
                            m: "Adj. EBITDA",
                            v: 108
                        }
                    ],
                    encode: {
                        x: "q",
                        y: "v",
                        color: "m"
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
                                "#16161e",
                                "#b45309"
                            ]
                        }
                    },
                    axis: {
                        x: {
                            title: false
                        },
                        y: {
                            title: false
                        }
                    },
                    legend: {
                        color: {
                            position: "top"
                        }
                    },
                    labels: [
                        {
                            text: "v",
                            position: "top",
                            fontSize: 10,
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
            varianceSection(),
            {
                t: "text",
                title: "OVERALL EARNINGS VIEW",
                body: "Earnings trajectory intact: +6.2% LTM EBITDA growth, realized price (+180bps) running ahead of input inflation (+140bps), and aftermarket mix grinding up (+100bps over four quarters) — the most thesis-supportive trend on the dashboard. The sponsor model runs hot; conflict logged to CP-5 and the model demoted to upside case. CP-1 normalized actuals remain the base for all downstream work."
            },
            {
                t: "table",
                title: "WATCH ITEMS → NEXT PRINT (JUL 28)",
                cols: [
                    "Item",
                    "Threshold",
                    "Routed to"
                ],
                align: [
                    0,
                    0,
                    0
                ],
                rows: [
                    {
                        cells: [
                            "Add-back realization (first print)",
                            "< $30M run-rate → T-1 trips",
                            "CP-6A re-vote"
                        ]
                    },
                    {
                        cells: [
                            "Fluid Systems volume",
                            "second consecutive miss",
                            "CP-2B P1 refresh"
                        ]
                    },
                    {
                        cells: [
                            "Book-to-bill",
                            "< 0.95x",
                            "CP-2B flag"
                        ]
                    }
                ]
            }
        ]
    };
}
/* ---------- IC Credit Memo ---------- */ function creditMemo(model) {
    const w = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEBATE"].weighting;
    const capital = getCapitalStructure(model);
    const nonQuarterColumns = model.columns.filter((c)=>c.group !== "Q");
    const { cols, rows: appendixRows } = modelAppendixTable(model, nonQuarterColumns);
    return {
        id: "memo",
        title: "IC Credit Memo",
        file: "ATLF IC Credit Memo",
        subtitle: "Atlas Forge Industrials (ATLF) · CP-6A / CP-6E committee output · HELD pending QA-117",
        icon: "gavel",
        watermark: "CONDITIONAL — QA-117 OPEN",
        srcs: [
            {
                chip: "CP-6A",
                ev: [
                    "E-09",
                    "E-87"
                ]
            },
            {
                chip: "CP-6E",
                ev: [
                    "E-71"
                ]
            },
            {
                chip: "CP-4C",
                ev: [
                    "E-63",
                    "E-64"
                ]
            },
            {
                chip: "CP-3B",
                ev: []
            },
            {
                chip: "CP-1B",
                ev: [
                    "E-58"
                ]
            }
        ],
        sections: [
            // Page 1: L1 Business
            ...companySummarySections("Page 1: Business"),
            businessOverviewSection(capital, "Page 1: Business", "EBITDA ADJUSTMENTS (CP-1 K-09)"),
            ...finSections(model).map((s)=>({
                    ...s,
                    page: "Page 1: Business"
                })),
            // Page 1: L1 Business — CP-1B Earnings Assessment
            {
                page: "Page 1: Business",
                t: "profile",
                title: "EARNINGS ASSESSMENT (CP-1B)",
                rows: [
                    [
                        "Period scope",
                        "Atlas Forge Industrials — Q1 FY26 (Mar-26)"
                    ],
                    [
                        "Headline",
                        "In line — trajectory intact, sponsor model runs hot"
                    ],
                    [
                        "Thesis impact",
                        "NEUTRAL-POSITIVE · no trigger trips"
                    ],
                    [
                        "Overall Earnings View",
                        "Earnings trajectory intact: +6.2% LTM EBITDA growth, realized price (+180bps) running ahead of input inflation (+140bps), and aftermarket mix grinding up (+100bps over four quarters) — the most thesis-supportive trend on the dashboard. The sponsor model runs hot; conflict logged to CP-5 and the model demoted to upside case."
                    ]
                ]
            },
            varianceSection("Page 1: Business"),
            // Page 2: L2 Risk
            {
                page: "Page 2: Risk",
                t: "cols",
                w: [
                    1,
                    1
                ],
                items: [
                    [
                        {
                            t: "list",
                            title: "CREDIT SUMMARY",
                            subhead: "Strengths",
                            items: [
                                "Aftermarket annuity — 44% of gross profit, 92% renewal, 1.9M-unit installed base (E-12)",
                                "Genuine FCF and capex-light model — top-quartile conversion vs peers (E-22)",
                                "Liquidity — 19.3 months-to-empty; no maturity inside 24 months (E-77)"
                            ]
                        },
                        {
                            t: "list",
                            subhead: "Weaknesses",
                            items: [
                                "EBITDA quality — add-backs 18.2% of adj.; 'one-time' charges recurred 3 of last 4 years (E-09 · E-87)",
                                "Documentation — $612M day-one capacity pari/senior to 2L; MFN sunsets Jun-27 (E-63 · E-64)",
                                "Concentration — top-3 OEMs 38% of revenue; Meridian repricing Q2-27 (E-15)"
                            ]
                        }
                    ],
                    [
                        {
                            t: "text",
                            title: "DOWNSIDE PATHWAYS (CP-2B)",
                            body: "Under CP-2B pathway P1 (Drivetrain −12% over 2 quarters), months-to-empty compresses to 14.0 with the springing covenant untested. Liquidity is highly resilient under base and mild stress conditions, but exposes severe vulnerability under deep structural contract losses."
                        },
                        {
                            t: "text",
                            title: "SINGLE GREATEST UNCERTAINTY",
                            body: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEBATE"].uncertainty
                        }
                    ]
                ]
            },
            catalystCalendarSection("Page 2: Risk", "CATALYST CALENDAR — NEXT 12 MONTHS (CP-2C)"),
            // Page 3: L3 Capital
            ...capitalStructureSections(capital, "Page 3: Capital"),
            {
                page: "Page 3: Capital",
                t: "cols",
                w: [
                    1,
                    1
                ],
                items: [
                    [
                        {
                            t: "table",
                            title: "RECOVERY SCENARIOS — 2L TL (CP-3B)",
                            cols: [
                                "Scenario",
                                "EV basis",
                                "1L",
                                "2L TL",
                                "Sub"
                            ],
                            align: [
                                0,
                                0,
                                1,
                                1,
                                1
                            ],
                            rows: [
                                {
                                    cells: [
                                        "Going concern",
                                        "7.0x × $421M",
                                        "100%",
                                        "100%",
                                        "100%"
                                    ]
                                },
                                {
                                    cells: [
                                        "Base distress",
                                        "5.5x × $360M",
                                        "100%",
                                        "22%",
                                        "0%"
                                    ]
                                },
                                {
                                    cells: [
                                        "Severe",
                                        "5.0x × $295M",
                                        "75%",
                                        "0%",
                                        "0%"
                                    ]
                                }
                            ],
                            note: "Market-implied 2L recovery at px 96.4 ≈ 38% under base-distress probability weights"
                        }
                    ],
                    [
                        {
                            t: "chart",
                            kind: "bar",
                            title: "RECOVERY BY TRANCHE",
                            unit: "% of par",
                            sourceIds: [
                                "CP-3B:T3B.2",
                                "E-63"
                            ],
                            accessibleSummary: "Going-concern recovery is 100% for all shown tranches; base-distress recovery is 100% for first lien, 22% for second lien, and 0% for subordinated debt; severe recovery is 75%, 0%, and 0% respectively.",
                            columns: [
                                {
                                    key: "scen",
                                    label: "Scenario"
                                },
                                {
                                    key: "tr",
                                    label: "Tranche"
                                },
                                {
                                    key: "rec",
                                    label: "Recovery (% of par)"
                                }
                            ],
                            h: 150,
                            spec: {
                                type: "interval",
                                data: [
                                    {
                                        scen: "Going concern",
                                        tr: "1L",
                                        rec: 100
                                    },
                                    {
                                        scen: "Going concern",
                                        tr: "2L TL",
                                        rec: 100
                                    },
                                    {
                                        scen: "Going concern",
                                        tr: "Sub",
                                        rec: 100
                                    },
                                    {
                                        scen: "Base distress",
                                        tr: "1L",
                                        rec: 100
                                    },
                                    {
                                        scen: "Base distress",
                                        tr: "2L TL",
                                        rec: 22
                                    },
                                    {
                                        scen: "Base distress",
                                        tr: "Sub",
                                        rec: 0
                                    },
                                    {
                                        scen: "Severe",
                                        tr: "1L",
                                        rec: 75
                                    },
                                    {
                                        scen: "Severe",
                                        tr: "2L TL",
                                        rec: 0
                                    },
                                    {
                                        scen: "Severe",
                                        tr: "Sub",
                                        rec: 0
                                    }
                                ],
                                encode: {
                                    x: "scen",
                                    y: "rec",
                                    color: "tr"
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
                                        domain: [
                                            "1L",
                                            "2L TL",
                                            "Sub"
                                        ],
                                        range: [
                                            "#0d9488",
                                            "#2563eb",
                                            "#7c3aed"
                                        ]
                                    }
                                },
                                axis: {
                                    x: {
                                        title: false
                                    },
                                    y: {
                                        title: false,
                                        labelFormatter: (d)=>d + "%"
                                    }
                                },
                                legend: {
                                    color: {
                                        position: "top"
                                    }
                                },
                                labels: [
                                    {
                                        text: (d)=>d.rec + "%",
                                        position: "inside",
                                        fontSize: 10,
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
                    ]
                ]
            },
            {
                page: "Page 3: Capital",
                t: "text",
                title: "INVESTMENT THESIS (CP-3)",
                body: "Carry plus deleveraging, not convergence: at +388bps the 2L TL pays +48–63bps over the fair band (+20–25bps ex-E-44) for risks that are monitorable rather than structural. Base case deleverages to ~4.9x by FY27 on realized add-backs alone (sponsor model demoted to upside). The bear case is real but priced."
            },
            // Page 4: L4 Model
            {
                page: "Page 4: Model",
                t: "table",
                title: "DOCUMENTATION RED FLAGS (CP-4)",
                cols: [
                    "Flag",
                    "Quantum",
                    "Trigger"
                ],
                align: [
                    0,
                    1,
                    0
                ],
                rows: [
                    {
                        cells: [
                            "Day-one incremental capacity — pari/senior to 2L",
                            "$612M",
                            "T-2 — raise >$200M in MFN window"
                        ]
                    },
                    {
                        cells: [
                            "MFN sunset",
                            "Jun-27",
                            "calendar — protection decays"
                        ]
                    },
                    {
                        cells: [
                            "RP capacity usable today",
                            "$310M",
                            "T-4 — any activation"
                        ]
                    },
                    {
                        cells: [
                            "Add-backs (uncapped credit agreement definition)",
                            "18.2% of adj.",
                            "T-1 — Q3-26 certificate"
                        ]
                    }
                ]
            },
            keyProvisionsSection("Page 4: Model"),
            capacityBuildSection("Page 4: Model", "CAPACITY BUILD ($M) (CP-4C)"),
            {
                page: "Page 4: Model",
                t: "text",
                title: "COVENANT INTERPRETATION",
                body: "This document set shifts risk from PD to LGD: default is not nearer (no maintenance covenant to trip; liquidity strong), but the creditor's position at default is erodible — used capacity cuts the 6.0x-stress 2L recovery from 21% to ~8%."
            },
            // Page 5: L6 Committee
            {
                page: "Page 5: Committee",
                t: "profile",
                title: "DECISION SUMMARY (CP-6E)",
                rows: [
                    [
                        "Deal",
                        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEAL"].deal
                    ],
                    [
                        "IC verdict",
                        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEBATE"].bias
                    ],
                    [
                        "Sizing",
                        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SIZING"].decision
                    ],
                    [
                        "Entry discipline",
                        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SIZING"].entry
                    ],
                    [
                        "Initial / max",
                        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SIZING"].initial + " / " + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SIZING"].max
                    ],
                    [
                        "Binding constraint",
                        "B3-or-below bucket — 91% utilized"
                    ],
                    [
                        "Clearance",
                        "CP-5 CONDITIONAL — pack held on QA-117 (E-44)"
                    ]
                ]
            },
            {
                page: "Page 5: Committee",
                t: "text",
                title: "PRE-DEBATE THESIS MAP (CP-6A)",
                body: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEBATE"].thesis
            },
            {
                page: "Page 5: Committee",
                t: "table",
                title: "CHAIR EVIDENCE WEIGHTING & RESOLUTION",
                cols: [
                    "Contested claim",
                    "Bull",
                    "Bear",
                    "Chair verdict"
                ],
                align: [
                    0,
                    1,
                    1,
                    0
                ],
                rows: w.map((x)=>({
                        cells: [
                            x.claim,
                            (x.bull * 100).toFixed(0),
                            (x.bear * 100).toFixed(0),
                            x.verdict
                        ]
                    }))
            },
            {
                page: "Page 5: Committee",
                t: "text",
                title: "IC CHAIR FINAL MEMO",
                body: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEBATE"].memo
            },
            {
                page: "Page 5: Committee",
                t: "list",
                title: "ADD / TRIM DISCIPLINE",
                items: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SIZING"].addTriggers.map((x)=>"ADD — " + x).concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SIZING"].trimTriggers.map((x)=>"TRIM — " + x))
            },
            {
                page: "Page 5: Committee",
                t: "table",
                title: "TRIGGERS ARMED",
                cols: [
                    "ID",
                    "Trigger",
                    "On trip"
                ],
                align: [
                    0,
                    0,
                    0
                ],
                rows: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TRIGGERS"].map((tr)=>({
                        cells: [
                            tr.id,
                            tr.text,
                            tr.owner
                        ]
                    }))
            },
            {
                page: "Page 5: Committee",
                t: "text",
                title: "STANDING POSTURE (CP-MON)",
                body: "ADD-ON-WEAKNESS at 75bps with a standing limit order at +400bps. Path to 125bps max runs through trigger T-1 (Q3-26 certificate ≥ $30M realized add-backs) plus a same-day B3-bucket headroom re-test. Open QA item: E-44 re-anchor (QA-117) — committee pack held until remediation R-1 lands."
            },
            // Page 6: L5 Appendix
            {
                page: "Page 6: Appendix",
                t: "table",
                title: "FULL MODEL",
                sub: `USD in Mns except ratios`,
                cols,
                align: cols.map((_, i)=>i === 0 ? 0 : 1),
                rows: appendixRows,
                columnGroups: modelTableGroups(nonQuarterColumns)
            }
        ]
    };
}
/* ---------- Covenant & Capacity Brief ---------- */ function covenantBrief() {
    return {
        id: "covenant",
        title: "Covenant & Capacity Brief",
        file: "ATLF Covenant Brief",
        subtitle: "Atlas Forge Industrials (ATLF) · CP-4 / CP-4C legal outputs · conformed docs control",
        icon: "scroll",
        srcs: [
            {
                chip: "CP-4 T4.11",
                ev: [
                    "E-63",
                    "E-64"
                ]
            },
            {
                chip: "CP-4C T4C.5",
                ev: [
                    "E-103"
                ]
            },
            {
                chip: "CP-1 K-09",
                ev: [
                    "E-09"
                ]
            }
        ],
        sections: [
            {
                t: "profile",
                title: "HEADLINE CAPACITY",
                rows: [
                    [
                        "Aggressiveness score",
                        "7.2 / 10 — Aggressive (2026 single-B norm: 6.1)"
                    ],
                    [
                        "Day-one incremental capacity",
                        "$612M — pari or senior to the 2L TL"
                    ],
                    [
                        "RP capacity usable today",
                        "$310M ($240M builder pre-positioned)"
                    ],
                    [
                        "EBITDA add-backs",
                        "18.2% of adj. — uncapped under the credit agreement"
                    ],
                    [
                        "Nearest pressure point",
                        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAPACITY"].nearest
                    ]
                ]
            },
            keyProvisionsSection(),
            capacityBuildSection(),
            {
                t: "text",
                title: "PD vs LGD TRANSLATION",
                body: "This document set shifts risk from PD to LGD: default is not nearer (no maintenance covenant to trip; liquidity strong), but the creditor's position at default is erodible — used capacity cuts the 6.0x-stress 2L recovery from 21% to ~8%. The single most consequential date in the documents is the MFN sunset, June 2027, after which a priming raise carries no yield protection for 2L lenders."
            }
        ]
    };
}
/* ---------- Monitoring Digest ---------- */ function monitoringDigest() {
    return {
        id: "monitor",
        title: "Monitoring Digest",
        file: "ATLF Monitoring Digest",
        subtitle: "Atlas Forge Industrials (ATLF) · CP-MON standing posture · week of Jun 8, 2026",
        icon: "bell",
        srcs: [
            {
                chip: "CP-2C T5.2",
                ev: []
            },
            {
                chip: "CP-2 T12",
                ev: []
            },
            {
                chip: "CP-6E",
                ev: []
            }
        ],
        sections: [
            {
                t: "table",
                title: "TRIGGERS ARMED",
                cols: [
                    "ID",
                    "Trigger",
                    "On trip"
                ],
                align: [
                    0,
                    0,
                    0
                ],
                rows: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TRIGGERS"].map((tr)=>({
                        cells: [
                            tr.id,
                            tr.text,
                            tr.owner
                        ]
                    }))
            },
            catalystCalendarSection(),
            {
                t: "list",
                title: "ADD / TRIM DISCIPLINE",
                items: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SIZING"].addTriggers.map((x)=>"ADD — " + x).concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$deal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SIZING"].trimTriggers.map((x)=>"TRIM — " + x))
            },
            {
                t: "text",
                title: "STANDING POSTURE",
                body: "ADD-ON-WEAKNESS at 75bps with a standing limit order at +400bps. Path to 125bps max runs through trigger T-1 (Q3-26 certificate ≥ $30M realized add-backs) plus a same-day B3-bucket headroom re-test. Open QA item: E-44 re-anchor (QA-117) — committee pack held until remediation R-1 lands."
            }
        ]
    };
}
function buildReports(inputs) {
    const model = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$model$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["buildModel"])(inputs?.severity ?? 1, inputs?.overrides ?? {}, inputs?.anchor, inputs?.assumptions);
    return [
        creditSnapshot(model),
        earningsUpdate(),
        creditMemo(model),
        covenantBrief(),
        monitoringDigest(),
        modelAppendix(model)
    ];
}
function buildReferenceReport(id, inputs) {
    const model = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$model$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["buildModel"])(inputs?.severity ?? 1, inputs?.overrides ?? {}, inputs?.anchor, inputs?.assumptions);
    const builders = {
        snapshot: ()=>creditSnapshot(model),
        earnings: earningsUpdate,
        memo: ()=>creditMemo(model),
        covenant: covenantBrief,
        monitor: monitoringDigest,
        model: ()=>modelAppendix(model)
    };
    return (builders[id ?? "snapshot"] ?? builders.snapshot)();
}
function citeCount(rep) {
    const set = new Set();
    rep.srcs.forEach((s)=>s.ev.forEach((e)=>set.add(e)));
    return set.size;
}
function secLabel(s) {
    if (s.title) return s.title;
    if (s.t === "cols") {
        const ts = [];
        s.items.forEach((col)=>col.forEach((x)=>{
                const l = x.title || ("subhead" in x ? x.subhead : undefined);
                if (l) ts.push(l);
            }));
        return ts.slice(0, 2).join(" · ") + (ts.length > 2 ? " · …" : "");
    }
    return "subhead" in s && s.subhead || s.t.toUpperCase();
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_0giq492._.js.map