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
      cols: ["Doc", "Name", "Type", "Grade"], align: [0, 0, 0, 0],
      rows: docMap.map((d) => [d.doc, d.name, d.type, d.grade]),
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

function adaptCp1(rt: Record<string, unknown>): Pick<ModuleOutput, "kpis"> & { sections: OutSection[] } {
  const fin = (rt.normalized_financials as Record<string, unknown>) || {};
  const conflicts = (rt.definition_conflicts as Array<Record<string, string>>) || [];
  const sections: OutSection[] = [];
  const rev = (fin.revenue as Record<string, unknown>) || {};
  const eb = (fin.adj_ebitda as Record<string, unknown>) || {};
  // An EDGAR-grounded CP-1 carries a REPORTED GAAP proxy in the same keys the
  // fixture/LLM use for covenant-adjusted figures — don't label it 'Adj.'. (#15)
  const reported = rt.basis === "reported_gaap_xbrl";
  const ebLabel = reported ? "EBITDA (reported proxy)" : "Adj. EBITDA";
  const levLabel = reported ? "Net leverage (reported)" : "Net leverage (adj.)";
  // Currency symbol from the engine (reported-disclosure CP-1 carries £/€/$ for a
  // non-US issuer). EDGAR (us-gaap, USD) and the demo/LLM CP-1 omit it → default $.
  // Without this, a £/€ issuer's figures rendered under a hardcoded "$M" — a
  // material currency mislabel on the non-US reported-disclosure path.
  const cur = (typeof rt.currency === "string" && rt.currency) || "$";
  const periods = Object.keys(rev);
  if (periods.length) {
    sections.push({
      type: "table",
      title: reported ? `CP-1 · Reported financials (${cur}M, GAAP proxy)` : `CP-1 · Normalized financials (${cur}M)`,
      // Humanize the period LABELS ("LTM_Q1_26" → "LTM Q1-26"); the raw key `p`
      // is still used below to index the data. (critique: machine keys in tables)
      cols: ["", ...periods.map(humanize)], align: [0, ...periods.map(() => 1)],
      rows: [
        ["Revenue", ...periods.map((p) => num(rev[p]))],
        [ebLabel, ...periods.map((p) => num(eb[p]))],
      ],
    });
  }
  if (conflicts.length) {
    sections.push({
      type: "flags", title: "CP-1 · Definition conflict register",
      items: conflicts.map((c) => ({ sev: "warning", text: c.text })),
    });
  }
  return {
    kpis: [
      // Unit suffix only on a real figure — "—x" reads as a broken render.
      { l: levLabel, v: fin.net_leverage_adj_ltm == null ? "—" : `${num(fin.net_leverage_adj_ltm)}x`, sev: "warning" },
      // Derive from the emitted financial periods so a LIVE/EDGAR run (which
      // carries normalized_financials but not the demo-fixture's pre-counted
      // periods_normalized) shows the real count, not "—". (mock↔live seam)
      { l: "Periods normalized", v: num(rt.periods_normalized ?? periods.length) },
      { l: "KPIs registered", v: num(rt.kpis_registered) },
      // Live/EDGAR CP-1 emits interest_coverage_ltm (both bases, nested in
      // normalized_financials) but NOT the demo-only coverage_gate GREEN/RED.
      // Show the real coverage figure; the adaptModule "—" filter drops it (and
      // "KPIs registered") on a run that lacks the value. (mock↔live seam)
      { l: "Interest coverage", v: fin.interest_coverage_ltm == null ? "—" : `${num(fin.interest_coverage_ltm)}x`, sev: "ok" },
    ],
    sections,
  };
}

// Columns not worth a table header (opaque ids the analyst never reads).
const SKIP_COL = /(^|_)(id|chunk_id|issuer_id|figi)$/i;

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

function flagsFrom(title: string, arr: Record<string, unknown>[]): OutSection {
  const items: OutFlag[] = arr.slice(0, 12).map((o) => {
    const ev = o.ev as unknown;
    return {
      sev: String(o.severity ?? o.sev ?? "low"),
      text: o.id ? `${o.id}: ${o.text}` : String(o.text),
      ev: Array.isArray(ev) ? ev.map(String) : undefined,
    };
  });
  return { type: "flags", title, items };
}

function tableFrom(title: string, arr: Record<string, unknown>[]): OutSection | null {
  const cols = Object.keys(arr[0]).filter((k) => !SKIP_COL.test(k));
  if (!cols.length) return null;
  return {
    type: "table", title, cols: cols.map(humanize),
    rows: arr.slice(0, 12).map((o) => cols.map((c) => num(o[c]))),
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
// fallow-ignore-next-line complexity
function adaptGeneric(rt: Record<string, unknown>): Pick<ModuleOutput, "kpis"> & { sections: OutSection[] } {
  const kpis = Object.entries(rt)
    .filter(([, v]) => isKpiScalar(v) && v !== "")
    .slice(0, 6)
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
  return { kpis, sections: sections.slice(0, 10) };
}

/** Map a canonical module payload into the existing ModuleOutput shape. */
export function adaptModule(detail: ModuleDetailDTO): ModuleOutput {
  const rt = detail.runtime_output || {};
  const base =
    detail.module_id === "CP-0" ? adaptCp0(rt) :
    detail.module_id === "CP-1" ? adaptCp1(rt) :
    adaptGeneric(rt);

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
