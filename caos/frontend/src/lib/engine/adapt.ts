// Adapter: canonical engine payload (ModuleDetailDTO) -> the {kpis, sections}
// ModuleOutput the deep-dive renderer already consumes. This is the seam that
// lets LIVE module output drop into today's UI unchanged. The seeded constants
// in lib/deepdive/module-outputs.ts are the expected-shape fixtures this adapter
// reproduces (see adapt.test.ts).
//
// Per-module handling for the modules the engine produces live (CP-0, CP-1);
// every module additionally gets a generic "evidence-traced claims" section so
// each claim's E-xx chips render and resolve via the existing OutSections.

import type { ModuleOutput, OutFlag, OutSection } from "@/lib/deepdive/module-outputs";
import type { ClaimDTO, ModuleDetailDTO } from "./types";

// lineage_class -> the renderer's severity vocabulary.
function lineageSev(lineageClass: string): string {
  if (["Conflicting", "Weak Lineage", "Untraced"].includes(lineageClass)) return "warning";
  if (lineageClass === "Insufficient Information") return "low";
  return "ok";
}

function qaSev(qaStatus: string): string | undefined {
  if (qaStatus === "Blocked") return "critical";
  if (qaStatus === "Restricted") return "warning";
  if (qaStatus === "Passed") return "ok";
  return undefined;
}

// Each claim becomes a flag carrying its evidence ids, so click-to-source chips
// render. The claim's severity is the worst lineage class across its evidence.
function claimsSection(claims: ClaimDTO[]): OutSection | null {
  if (!claims.length) return null;
  const items: OutFlag[] = claims.map((c) => {
    const sevs = c.evidence.map((e) => lineageSev(e.lineage_class));
    const sev = sevs.includes("warning") ? "warning" : sevs.includes("low") ? "low" : "ok";
    return { sev, text: c.claim_text, ev: c.evidence.map((e) => e.evidence_id) };
  });
  return { type: "flags", title: "Evidence-traced claims (CP-5B lineage)", items };
}

function num(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString("en-US");
  // A nested object/array cell would otherwise stringify to "[object Object]".
  if (typeof v === "object") return Array.isArray(v) ? v.map(String).join(", ") : "{…}";
  return String(v);
}

function adaptCp0(rt: Record<string, unknown>): Pick<ModuleOutput, "kpis"> & { sections: OutSection[] } {
  const docMap = (rt.document_map as Array<Record<string, string>>) || [];
  const gaps = (rt.gap_log as Array<Record<string, string>>) || [];
  const sections: OutSection[] = [];
  if (docMap.length) {
    sections.push({
      type: "table", title: "CP-0 · Document map & quality",
      // The fixture emits a per-doc `grade`; a LIVE run (readiness.py) emits the
      // engine's `categories` classification instead — fall through so the column
      // isn't permanently blank on real issuers. (mock↔live seam)
      cols: ["Doc", "Name", "Type", "Grade / Categories"], align: [0, 0, 0, 0],
      rows: docMap.map((d) => {
        const cats = (d as Record<string, unknown>).categories;
        return [d.doc, d.name, d.type, d.grade ?? (Array.isArray(cats) ? cats.join(", ") : "—")];
      }),
    });
  }
  if (gaps.length) {
    sections.push({
      type: "flags", title: "CP-0 · Gap log",
      items: gaps.map((g) => ({ sev: g.severity || "low", text: `${g.id}: ${g.text}` })),
    });
  }
  return {
    kpis: [
      { l: "Readiness", v: num(rt.readiness_score), sev: "ok" },
      { l: "Files classified", v: num(rt.files_classified) },
      // Derive the count from the emitted gap_log so a LIVE run (whose readiness
      // synth emits gap_log but not the demo-fixture's pre-counted gaps_logged)
      // shows the real number, not "—". (mock↔live seam)
      { l: "Gaps logged", v: num(rt.gaps_logged ?? gaps.length), sev: "warning" },
      { l: "Unresolved conflicts", v: num(rt.unresolved_conflicts), sev: "ok" },
    ],
    sections,
  };
}

function reportedCp1Basis(basis: unknown): boolean {
  return basis === "reported_gaap_xbrl" || basis === "reported_disclosure";
}

function cp1Currency(runtime: Record<string, unknown>): string {
  return typeof runtime.currency === "string" && runtime.currency ? runtime.currency : "$";
}

function cp1FinancialSection(periods: string[], revenue: Record<string, unknown>, ebitda: Record<string, unknown>, reported: boolean, currency: string, ebitdaLabel: string): OutSection | null {
  if (!periods.length) return null;
  return {
    type: "table",
    title: reported ? `CP-1 · Reported financials (${currency}M, GAAP proxy)` : `CP-1 · Normalized financials (${currency}M)`,
    cols: ["", ...periods.map(humanize)],
    align: [0, ...periods.map(() => 1)],
    rows: [
      ["Revenue", ...periods.map((period) => num(revenue[period]))],
      [ebitdaLabel, ...periods.map((period) => num(ebitda[period]))],
    ],
  };
}

function cp1ConflictSection(conflicts: Array<Record<string, string>>): OutSection | null {
  if (!conflicts.length) return null;
  return { type: "flags", title: "CP-1 · Definition conflict register", items: conflicts.map((conflict) => ({ sev: "warning", text: conflict.text })) };
}

function multipleValue(value: unknown): string {
  return value == null ? "—" : `${num(value)}x`;
}

function adaptCp1(rt: Record<string, unknown>): Pick<ModuleOutput, "kpis"> & { sections: OutSection[] } {
  const fin = (rt.normalized_financials as Record<string, unknown>) || {};
  const conflicts = (rt.definition_conflicts as Array<Record<string, string>>) || [];
  const rev = (fin.revenue as Record<string, unknown>) || {};
  const eb = (fin.adj_ebitda as Record<string, unknown>) || {};
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
  const sections = [cp1FinancialSection(periods, rev, eb, reported, cur, ebLabel), cp1ConflictSection(conflicts)].filter((section): section is OutSection => section !== null);
  return {
    kpis: [
      // Unit suffix only on a real figure — "—x" reads as a broken render.
      { l: levLabel, v: multipleValue(fin.net_leverage_adj_ltm), sev: "warning" },
      // Derive from the emitted financial periods so a LIVE/EDGAR run (which
      // carries normalized_financials but not the demo-fixture's pre-counted
      // periods_normalized) shows the real count, not "—". (mock↔live seam)
      { l: "Periods normalized", v: num(rt.periods_normalized ?? periods.length) },
      { l: "KPIs registered", v: num(rt.kpis_registered) },
      // Live/EDGAR CP-1 emits interest_coverage_ltm (both bases, nested in
      // normalized_financials) but NOT the demo-only coverage_gate GREEN/RED.
      // Show the real coverage figure; the adaptModule "—" filter drops it (and
      // "KPIs registered") on a run that lacks the value. (mock↔live seam)
      { l: "Interest coverage", v: multipleValue(fin.interest_coverage_ltm), sev: "ok" },
    ],
    sections,
  };
}

// Columns not worth a table header (opaque ids the analyst never reads).
const SKIP_COL = /(^|_)(id|chunk_id|issuer_id|figi)$/i;
const NON_MEASURE_COL = /(^|_)(?:id|identifier|code|name|label|date|as_of|period|quarter|year|rating|grade|ticker|cusip|isin|figi|version)(?:_|$)/i;
const INITIAL_DISCLOSURE_ROWS = 12;

// A live adapter may only infer number alignment from the payload schema, never
// from its formatted text. That keeps a digit-bearing CUSIP, as-of date, rating,
// or module code in the text lane even when every rendered value looks numeric.
function isFiniteMeasureColumn(key: string, rows: Record<string, unknown>[]): boolean {
  if (NON_MEASURE_COL.test(key)) return false;
  const values = rows.map((row) => row[key]).filter((value) => value != null);
  return values.length > 0 && values.every((value) => typeof value === "number" && Number.isFinite(value));
}

function inferredAlign(cols: string[], rows: Record<string, unknown>[]): number[] {
  return cols.map((key) => isFiniteMeasureColumn(key, rows) ? 1 : 0);
}

// Finance acronyms humanize() would otherwise title-case into "Ebitda"/"Fcf".
// Whole-word, case-insensitive → upper.
const ACRONYMS = /\b(ebitda|ltm|fcf|dscr|fccr|wacc|roic|sofr|oid|mfn|nav|ev|dm|rcf|tlb|lme|yoy|qoq|ytd)\b/gi;

export function humanize(k: string): string {
  return k
    .replace(/_/g, " ")
    .replace(/\bmusd\b/gi, "$M")
    .replace(/\bpct\b/gi, "%")
    // Re-glue a quarter to its 2-digit year so "ltm_q1_26" reads "LTM Q1-26",
    // not the machine key "LTM Q1 26". (critique: raw keys leak into tables)
    .replace(/\bq([1-4])\s+'?(\d{2})\b/gi, (_m, q, y) => `Q${q}-${y}`)
    .replace(ACRONYMS, (m) => m.toUpperCase())
    .replace(/^\w/, (c) => c.toUpperCase());
}

// A scalar small enough to read as a headline KPI (long strings become text).
function isKpiScalar(v: unknown): boolean {
  return typeof v === "number" || typeof v === "boolean" || (typeof v === "string" && v.length <= 32);
}

function isObjArray(v: unknown): v is Record<string, unknown>[] {
  return Array.isArray(v) && v.length > 0 && v.every((x) => x !== null && typeof x === "object" && !Array.isArray(x));
}

// An array of {text, severity/id} reads as flags; anything else as a table.
function isFlagArray(arr: Record<string, unknown>[]): boolean {
  return arr.every((o) => typeof o.text === "string" && ("severity" in o || "sev" in o || "id" in o));
}

function toOutFlag(o: Record<string, unknown>): OutFlag {
  const ev = o.ev as unknown;
  return {
    sev: String(o.severity ?? o.sev ?? "low"),
    text: o.id ? `${o.id}: ${o.text}` : String(o.text),
    ev: Array.isArray(ev) ? ev.map(String) : undefined,
  };
}

function flagsFrom(title: string, arr: Record<string, unknown>[]): OutSection {
  const items = arr.slice(0, INITIAL_DISCLOSURE_ROWS).map(toOutFlag);
  // Keep bounded first paint, but retain every persisted adverse item. OutSections
  // owns the exact +N more disclosure using this additive metadata.
  return Object.assign(
    { type: "flags" as const, title, items },
    arr.length > INITIAL_DISCLOSURE_ROWS ? { overflowItems: arr.slice(INITIAL_DISCLOSURE_ROWS).map(toOutFlag) } : {},
  ) as OutSection;
}

function tableFrom(title: string, arr: Record<string, unknown>[]): OutSection | null {
  const cols = Object.keys(arr[0]).filter((k) => !SKIP_COL.test(k));
  if (!cols.length) return null;
  const toRow = (row: Record<string, unknown>) => cols.map((col) => num(row[col]));
  return Object.assign(
    {
      type: "table" as const,
      title,
      cols: cols.map(humanize),
      align: inferredAlign(cols, arr),
      rows: arr.slice(0, INITIAL_DISCLOSURE_ROWS).map(toRow),
    },
    arr.length > INITIAL_DISCLOSURE_ROWS ? { overflowRows: arr.slice(INITIAL_DISCLOSURE_ROWS).map(toRow) } : {},
  ) as OutSection;
}

function tableFromAll(title: string, arr: Record<string, unknown>[]): OutSection | null {
  const cols = Object.keys(arr[0]).filter((k) => !SKIP_COL.test(k));
  if (!cols.length) return null;
  return {
    type: "table", title, cols: cols.map(humanize), align: inferredAlign(cols, arr),
    rows: arr.map((o) => cols.map((c) => num(o[c]))),
  };
}

function kvTable(title: string, obj: Record<string, unknown>): OutSection | null {
  const entries = Object.entries(obj).filter(([, v]) => isKpiScalar(v) || v == null);
  if (!entries.length) return null;
  return {
    type: "table", title, cols: ["", "Value"], align: [0, 1],
    rows: entries.map(([k, v]) => [humanize(k), num(v)]),
  };
}

// Generic adapter for any module the engine persists but that has no bespoke
// mapping: scalars → KPIs, object-arrays → flags/tables, nested scalar objects →
// key/value tables, long strings → notes. Good enough to render real engine
// output with provenance for every module, not just CP-0/CP-1.
// fallow-ignore-next-line complexity -- Heterogeneous module shapes require one provenance-preserving dispatch pass.
function adaptGeneric(rt: Record<string, unknown>): Pick<ModuleOutput, "kpis"> & { sections: OutSection[] } {
  const kpis = Object.entries(rt)
    .filter(([, v]) => isKpiScalar(v) && v !== "")
    .map(([k, v]) => ({ l: humanize(k), v: num(v) }));

  const sections: OutSection[] = [];
  for (const [k, v] of Object.entries(rt)) {
    const title = humanize(k);
    if (isObjArray(v)) {
      const sec = isFlagArray(v) ? flagsFrom(title, v) : tableFrom(title, v);
      if (sec) sections.push(sec);
    } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      // Nested object (e.g. CP-6A bull_case/bear_case): its scalars → a KV table,
      // and recurse one level so a `narrative` long-string and a `points[]`
      // object-array don't get silently dropped.
      const obj = v as Record<string, unknown>;
      const kv = kvTable(title, obj);
      if (kv) sections.push(kv);
      for (const [k2, v2] of Object.entries(obj)) {
        const t2 = title + " · " + humanize(k2);
        if (isObjArray(v2)) {
          const sec = isFlagArray(v2) ? flagsFrom(t2, v2) : tableFrom(t2, v2);
          if (sec) sections.push(sec);
        } else if (typeof v2 === "string" && v2.length > 32) {
          sections.push({ type: "text", title: t2, body: v2 });
        }
      }
    } else if (Array.isArray(v) && v.length) {
      sections.push({ type: "text", title, body: v.map(String).join(", ") });
    } else if (typeof v === "string" && v.length > 32) {
      sections.push({ type: "text", title, body: v });
    }
  }
  return { kpis, sections };
}

// CP-4C covenant register: the extracted terms in desk order, breach flagged in
// text as well as color. Absent terms are dropped (cov-lite runs extract little)
// rather than rendered as a row of dashes; sections stay generic (calculations
// table, add-back audit KV, claims).
function adaptCp4c(rt: Record<string, unknown>): Pick<ModuleOutput, "kpis"> & { sections: OutSection[] } {
  const fin = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const musd = (v: unknown): string | null => {
    const x = fin(v);
    return x == null ? null : "$" + x.toLocaleString("en-US") + "M";
  };
  const audit = (rt.addback_audit as Record<string, unknown>) || {};
  const util = fin(audit.utilization_pct);
  const breach = audit.breach === true;
  const cap = fin(rt.addback_cap_pct);
  const capV = cap == null ? null
    : (cap * 100).toFixed(0) + "% of EBITDA" + (util != null ? ` · ${util.toFixed(0)}% used${breach ? " · BREACH" : ""}` : "");
  const kpis = [
    { l: "Structure", v: rt.covenant_structure ? String(rt.covenant_structure) : null },
    { l: "Net leverage", v: fin(rt.current_net_leverage) != null ? fin(rt.current_net_leverage)!.toFixed(2) + "×" : null },
    { l: "Leverage covenant", v: fin(rt.leverage_covenant_x) != null ? fin(rt.leverage_covenant_x)!.toFixed(2) + "×" : null },
    { l: "RP / builder basket", v: musd(rt.rp_basket_musd) },
    { l: "Cross-default trips at", v: musd(rt.cross_default_musd) },
    { l: "Add-back cap", v: capV, sev: breach ? "critical" : util != null && util >= 80 ? "warning" : undefined },
  ].filter((k): k is { l: string; v: string; sev?: string } => k.v != null);
  return { kpis, sections: adaptGeneric(rt).sections };
}

function adaptCp5b(rt: Record<string, unknown>): Pick<ModuleOutput, "kpis"> & { sections: OutSection[] } {
  const driverRegister = Array.isArray(rt.driver_register) ? rt.driver_register : null;
  const drivers = (driverRegister ?? []).filter(
    (row: unknown): row is Record<string, unknown> => row !== null && typeof row === "object" && !Array.isArray(row),
  );
  const sections: OutSection[] = [];
  if (typeof rt.selection_basis === "string" && rt.selection_basis) {
    sections.push({ type: "text", title: "CP-5B · Selection basis", body: rt.selection_basis });
  }
  if (driverRegister) {
    sections.push({
      type: "flags",
      title: "CP-5B · Decision-relevant driver lineage",
      items: drivers.map((driver) => {
        const confidence = typeof driver.confidence === "number" && Number.isFinite(driver.confidence)
          ? `${Math.round(driver.confidence * 100)}% confidence`
          : "confidence unavailable";
        const qa = Array.isArray(driver.qa_findings) && driver.qa_findings.length
          ? ` · QA ${driver.qa_findings.map(String).join(", ")}`
          : "";
        const ev = Array.isArray(driver.evidence_ids) ? driver.evidence_ids.map(String) : undefined;
        return {
          sev: driver.status === "open" ? "warning" : "ok",
          text: `#${num(driver.rank)} [${String(driver.module_id || "CP")}] ${String(driver.driver || "Unnamed driver")} — ${String(driver.lineage || "lineage unavailable")} · ${confidence}${qa}`,
          ev,
        };
      }),
    });
    if (!drivers.length) {
      sections.push({
        type: "text",
        title: "CP-5B · Driver register state",
        body: "No persisted analytical claims were available for deterministic driver selection.",
      });
    }
  }
  return {
    kpis: [
      { l: "Decision drivers", v: num(drivers.length) },
      { l: "Claims traced", v: num(rt.claims_traced) },
      { l: "Weak lineage flags", v: num(rt.weak_lineage_flags), sev: Number(rt.weak_lineage_flags) > 0 ? "warning" : "ok" },
      { l: "Orphan claims", v: num(rt.orphan_claims), sev: Number(rt.orphan_claims) > 0 ? "critical" : "ok" },
      { l: "Auditability", v: num(rt.auditability), sev: rt.auditability === "STRONG" ? "ok" : "warning" },
    ],
    sections,
  };
}

function adaptSpecialized(
  moduleId: "CP-2G" | "CP-4D",
  rt: Record<string, unknown>,
): Pick<ModuleOutput, "kpis"> & { sections: OutSection[] } {
  const keys = specializedKeys(moduleId);
  return { kpis: specializedKpis(moduleId, rt, keys), sections: specializedSections(moduleId, rt, keys) };
}

function specializedKeys(moduleId: "CP-2G" | "CP-4D"): string[] {
  return moduleId === "CP-2G" ? [
        "source_register", "transition_risks", "social_event_risks",
        "materiality_assessments", "sustainability_linked_instruments",
        "demand_access_implications", "credit_implications", "gaps",
      ]
    : [
        "source_gate_register", "entity_register", "guarantee_matrix",
        "collateral_matrix", "structural_priority", "leakage_routes",
        "priming_exposures", "gaps",
      ];
}

function specializedSections(moduleId: "CP-2G" | "CP-4D", rt: Record<string, unknown>, keys: string[]): OutSection[] {
  const sections: OutSection[] = [];
  const basis = typeof rt.status_basis === "string" ? rt.status_basis : null;
  if (basis) sections.push({ type: "text", title: `${moduleId} · Source-gate basis`, body: basis });
  for (const key of keys) {
    const rows = rt[key];
    if (isObjArray(rows)) {
      const section = tableFromAll(`${moduleId} · ${humanize(key)}`, rows);
      if (section) sections.push(section);
    }
  }
  const overallKey = moduleId === "CP-2G" ? "overall_credit_view" : "overall_structural_view";
  if (typeof rt[overallKey] === "string") {
    sections.push({ type: "text", title: `${moduleId} · ${humanize(overallKey)}`, body: String(rt[overallKey]) });
  }
  return sections;
}

function specializedStatusSeverity(status: string): string {
  if (status === "Blocked") return "critical";
  if (status === "Completed with Limitations") return "warning";
  return "ok";
}

function specializedKpis(moduleId: "CP-2G" | "CP-4D", rt: Record<string, unknown>, keys: string[]) {
  const status = typeof rt.module_status === "string" ? rt.module_status : "Unavailable";
  const sourceRows = rt[keys[0]];
  return [
    { l: "Module status", v: status, sev: specializedStatusSeverity(status) },
    { l: "Source rows", v: num(Array.isArray(sourceRows) ? sourceRows.length : 0) },
    { l: "Open gaps", v: num(Array.isArray(rt.gaps) ? rt.gaps.length : 0), sev: Array.isArray(rt.gaps) && rt.gaps.length ? "warning" : undefined },
  ];
}

function adaptRuntime(moduleId: string, runtime: Record<string, unknown>): Pick<ModuleOutput, "kpis"> & { sections: OutSection[] } {
  switch (moduleId) {
    case "CP-0": return adaptCp0(runtime);
    case "CP-1": return adaptCp1(runtime);
    case "CP-2G": return adaptSpecialized("CP-2G", runtime);
    case "CP-4D": return adaptSpecialized("CP-4D", runtime);
    case "CP-4C": return adaptCp4c(runtime);
    case "CP-5B": return adaptCp5b(runtime);
    default: return adaptGeneric(runtime);
  }
}

/** Map a canonical module payload into the existing ModuleOutput shape. */
export function adaptModule(detail: ModuleDetailDTO): ModuleOutput {
  const rt = detail.runtime_output || {};
  const base = adaptRuntime(detail.module_id, rt);

  const sections = [...base.sections];
  const claims = claimsSection(detail.claims || []);
  if (claims) sections.push(claims);

  // Drop any KPI whose value is "—": several demo-fixture summary KPIs (coverage
  // gate, KPIs registered, unresolved conflicts) have no clean live source, and a
  // blank placeholder in a header reads as a broken render. A live header shows
  // only the KPIs it can back with real data. Fall back to the QA status only
  // when nothing real is left (also the old empty-base behavior). (mock↔live seam)
  const kpis = base.kpis.filter((k) => k.v !== "—");

  return {
    kpis: kpis.length
      ? kpis
      : [{ l: "QA status", v: detail.qa_status, sev: qaSev(detail.qa_status) }],
    sections,
  };
}
