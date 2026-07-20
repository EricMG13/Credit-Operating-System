module.exports = [
"[externals]/buffer [external] (buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("buffer", () => require("buffer"));

module.exports = mod;
}),
"[externals]/string_decoder [external] (string_decoder, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("string_decoder", () => require("string_decoder"));

module.exports = mod;
}),
"[externals]/constants [external] (constants, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("constants", () => require("constants"));

module.exports = mod;
}),
"[project]/src/components/model/export.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildWorkbook",
    ()=>buildWorkbook,
    "exportModel",
    ()=>exportModel
]);
// Committee-pack model export (C9, expansion 4.2) — a real .xlsx via
// ExcelJS, replacing the earlier dependency-free CSV stub. Five sheets:
// Model grid, Scenarios (best/base/worst 3y projection), Assumptions
// (base/down case), Headline Facts (metric_facts from the issuer profile),
// Overrides (manual input log). Every sheet opens with an
// ORIGIN/METHOD/RUN/AS-OF stamp row so a committee reader can trust the
// export exactly as far as the on-screen chip already does — no sheet's
// numbers can be quoted without also carrying that line.
//
// ExcelJS, not SheetJS (`xlsx`, the stub's original suggestion): the `xlsx`
// npm package carries two open, unpatched High-severity advisories
// (prototype pollution GHSA-4r6h-8v6p-xvw6, ReDoS GHSA-5pgg-2g8v-p4x9) that
// trip CI's `npm audit --audit-level=high` gate outright — ExcelJS's own
// residual (a Moderate uuid buffer-bounds issue, unrelated to file parsing)
// stays under that threshold. See SBOM.md.
//
// SECURITY: this module is write-only — it never calls Xlsx.load/readFile,
// only Workbook.addWorksheet/addRow + xlsx.writeBuffer. Do not add a read
// path here without re-auditing ExcelJS's own advisories first.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$exceljs$2f$excel$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/exceljs/excel.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$assumptions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/reports/assumptions.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$model$2f$scenarios$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/model/scenarios.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$model$2f$rows$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/model/rows.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$model$2f$model$2d$format$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/model/model-format.ts [app-ssr] (ecmascript)");
;
;
;
;
;
// Formula-injection guard — identical rule to lib/csv.ts's csvCell (matrix
// 6.8): a leading =+-@ (or tab/CR) makes Excel execute the cell as a formula
// on open. Applies to every string cell built from analyst/DB-sourced text
// (issuer names, metric keys); static hardcoded labels don't need it but
// running it over them is harmless.
function safeStr(v) {
    return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}
function stampRow(ws, prov, runId) {
    const parts = [
        `ORIGIN: ${prov.origin}`,
        prov.method ? `METHOD: ${prov.method}` : null,
        runId ? `RUN: ${runId}` : null,
        prov.asOf ? `AS OF: ${prov.asOf}` : null
    ].filter((p)=>p != null);
    ws.addRow([
        safeStr(parts.join(" · "))
    ]);
    ws.addRow([]);
}
const NUMFMT = {
    m: '#,##0;(#,##0);"–"',
    p: "0.0%",
    r: "0.0%",
    x: '0.00"x"',
    d: "0"
};
/* ---------- Sheet 1: Model grid ---------- */ function buildModelSheet(wb, model, showQ, meta, prov, runId) {
    const ws = wb.addWorksheet("Model");
    const colDefs = model.columns.filter((c)=>showQ || c.group !== "Q").map((c)=>({
            ...c,
            ctx: model.cols[c.key]
        }));
    // Number.isFinite, not isNaN: a zero-revenue override makes the ratio rows
    // (adjm/sga/dapc) ±Infinity, which the on-screen grid blanks but this exported
    // as a numeric Infinity cell with a "0.0%" numFmt — a grid/export divergence
    // on a committee deliverable (triage 2026-07-16 P3).
    const round3 = (v)=>!Number.isFinite(v) ? "" : Math.round(v * 1000) / 1000;
    stampRow(ws, prov, runId);
    ws.addRow([
        safeStr(meta.header),
        ...colDefs.map((c)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$model$2f$model$2d$format$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["GROUPS_META"][c.group])
    ]);
    ws.addRow([
        safeStr(meta.subheader),
        ...colDefs.map((c)=>safeStr(c.ctx.label + (c.ctx.derived ? "*" : "")))
    ]);
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$model$2f$rows$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ROWS"].forEach((row)=>{
        if (row.sec) {
            ws.addRow([
                safeStr(row.sec)
            ]);
            return;
        }
        const label = safeStr((row.ind ? "   " : "") + row.l + (row.sub ? " (" + row.sub + ")" : ""));
        const cells = [
            label
        ];
        colDefs.forEach((c)=>cells.push(round3(row.g(c.ctx))));
        const excelRow = ws.addRow(cells);
        if (row.f) {
            colDefs.forEach((_c, i)=>{
                const cell = excelRow.getCell(i + 2);
                if (typeof cell.value === "number") cell.numFmt = NUMFMT[row.f];
            });
        }
    });
    ws.columns = [
        {
            width: 32
        },
        ...colDefs.map(()=>({
                width: 10
            }))
    ];
}
const SCEN_METRICS = [
    {
        key: "revenue",
        label: "Revenue",
        f: "m"
    },
    {
        key: "adjEbitda",
        label: "Adj. EBITDA",
        f: "m"
    },
    {
        key: "fcf",
        label: "FCF",
        f: "m"
    },
    {
        key: "cash",
        label: "Cash",
        f: "m"
    },
    {
        key: "netDebt",
        label: "Net Debt",
        f: "m"
    },
    {
        key: "netLev",
        label: "Net Leverage",
        f: "x"
    },
    {
        key: "intCov",
        label: "Interest Coverage",
        f: "x"
    }
];
function buildScenariosSheet(wb, model, prov, runId) {
    const ws = wb.addWorksheet("Scenarios");
    const lens = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$model$2f$scenarios$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildScenarios"])(model);
    const projections = lens.scenarios.map((s)=>({
            s,
            p: lens.project(s.drivers)
        }));
    const years = projections[0]?.p.years ?? [];
    stampRow(ws, prov, runId);
    const header = [
        "Metric",
        ...projections.flatMap(({ s })=>years.map((y)=>`${s.label} ${y}`))
    ];
    ws.addRow(header);
    SCEN_METRICS.forEach((m)=>{
        const cells = [
            safeStr(m.label)
        ];
        projections.forEach(({ p })=>{
            years.forEach((_y, yi)=>{
                const raw = p[m.key][yi];
                cells.push(Number.isFinite(raw) ? Math.round(raw * 1000) / 1000 : "");
            });
        });
        const excelRow = ws.addRow(cells);
        for(let c = 2; c <= cells.length; c++){
            const cell = excelRow.getCell(c);
            if (typeof cell.value === "number") cell.numFmt = NUMFMT[m.f];
        }
    });
    ws.columns = [
        {
            width: 20
        },
        ...header.slice(1).map(()=>({
                width: 12
            }))
    ];
}
/* ---------- Sheet 3: Assumptions ---------- */ const CASE_FIELD_LABELS = [
    [
        "gDrive",
        "Δ Drivetrain growth",
        "p"
    ],
    [
        "gFluid",
        "Δ Fluid Systems growth",
        "p"
    ],
    [
        "gAfter",
        "Δ Aftermarket growth",
        "p"
    ],
    [
        "dGpm",
        "Δ gross margin",
        "p"
    ],
    [
        "dAdjm",
        "Δ adj. EBITDA margin",
        "p"
    ],
    [
        "daPct",
        "D&A % of sales",
        "p"
    ],
    [
        "mInt",
        "× cash interest",
        "x"
    ],
    [
        "mLeases",
        "× leases",
        "x"
    ],
    [
        "mTax",
        "× cash taxes",
        "x"
    ],
    [
        "mWc",
        "× changes in WC",
        "x"
    ],
    [
        "mCapex",
        "× capex",
        "x"
    ],
    [
        "mAcq",
        "× acquisitions",
        "x"
    ],
    [
        "mDiss",
        "× debt issue/(repay)",
        "x"
    ],
    [
        "divDelta",
        "Dividends $/yr",
        "m"
    ],
    [
        "sofrDelta",
        "SOFR delta",
        "p"
    ]
];
function buildAssumptionsSheet(wb, a, prov, runId) {
    const ws = wb.addWorksheet("Assumptions");
    stampRow(ws, prov, runId);
    ws.addRow([
        "Assumption",
        "Base case",
        "Downside case"
    ]);
    const push = (label, base, down, f)=>{
        const row = ws.addRow([
            safeStr(label),
            base,
            down
        ]);
        row.getCell(2).numFmt = NUMFMT[f];
        row.getCell(3).numFmt = NUMFMT[f];
    };
    CASE_FIELD_LABELS.forEach(([key, label, f])=>push(label, a.base[key], a.down[key], f));
    ws.addRow([]);
    ws.addRow([
        safeStr("Add-back acceptance (1 = accept in full, 0 = disallow)")
    ]);
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$reports$2f$assumptions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ADDBACKS"].forEach((ab)=>push(ab.label, a.base[ab.key], a.down[ab.key], "x"));
    ws.columns = [
        {
            width: 36
        },
        {
            width: 14
        },
        {
            width: 14
        }
    ];
}
/* ---------- Sheet 4: Headline Facts ---------- */ function buildFactsSheet(wb, metrics, prov, runId) {
    const ws = wb.addWorksheet("Headline Facts");
    stampRow(ws, prov, runId);
    ws.addRow([
        "Metric",
        "Period",
        "Value",
        "Unit",
        "Basis",
        "Provenance",
        "QA status"
    ]);
    const headline = metrics.filter((m)=>m.headline);
    headline.forEach((m)=>ws.addRow([
            safeStr(m.metric_key),
            safeStr(m.period),
            m.value,
            safeStr(m.unit || ""),
            safeStr(m.basis || ""),
            safeStr(m.provenance),
            safeStr(m.qa_status)
        ]));
    if (headline.length === 0) ws.addRow([
        safeStr("No headline metric_facts on file for this issuer.")
    ]);
    ws.columns = [
        {
            width: 22
        },
        {
            width: 10
        },
        {
            width: 12
        },
        {
            width: 8
        },
        {
            width: 14
        },
        {
            width: 14
        },
        {
            width: 14
        }
    ];
}
/* ---------- Sheet 5: Overrides ---------- */ const OVERRIDE_LABELS = {
    rev: "Revenues",
    adj: "Adj. EBITDA",
    ab: "Adjustments",
    int: "Cash interest",
    tax: "Cash taxes",
    wc: "Changes in WC",
    capex: "Capex",
    diss: "Debt issue/(repay)",
    div: "Dividends"
};
function buildOverridesSheet(wb, model, overrides, prov, runId) {
    const ws = wb.addWorksheet("Overrides");
    stampRow(ws, prov, runId);
    ws.addRow([
        "Period",
        "Account",
        "Override value ($m, model basis)"
    ]);
    const ovKeys = Object.keys(overrides || {});
    if (!ovKeys.length) {
        ws.addRow([
            safeStr("No manual overrides on this model.")
        ]);
    } else {
        ovKeys.forEach((k)=>{
            const [colKey, field] = k.split(":");
            const ctx = model.cols[colKey];
            ws.addRow([
                safeStr(ctx ? ctx.label + (ctx.kind === "q" ? " (Q)" : " (FY)") : colKey),
                safeStr(OVERRIDE_LABELS[field] || field),
                overrides[k]
            ]);
        });
    }
    ws.columns = [
        {
            width: 16
        },
        {
            width: 24
        },
        {
            width: 16
        }
    ];
}
function buildWorkbook(model, showQ, overrides, meta, ctx) {
    const { prov, runId, assumptions, metrics } = ctx;
    const wb = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$exceljs$2f$excel$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"].Workbook();
    buildModelSheet(wb, model, showQ, meta, prov, runId);
    buildScenariosSheet(wb, model, prov, runId);
    buildAssumptionsSheet(wb, assumptions, prov, runId);
    buildFactsSheet(wb, metrics, prov, runId);
    buildOverridesSheet(wb, model, overrides, prov, runId);
    return wb;
}
async function exportModel(model, showQ, overrides, meta, ctx) {
    const buf = await buildWorkbook(model, showQ, overrides, meta, ctx).xlsx.writeBuffer();
    const blob = new Blob([
        buf
    ], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = meta.filename;
    a.click();
    URL.revokeObjectURL(url);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1hgysyz._.js.map