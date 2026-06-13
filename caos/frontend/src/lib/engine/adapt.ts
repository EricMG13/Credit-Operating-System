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
  return typeof v === "number" ? v.toLocaleString("en-US") : String(v ?? "—");
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
      { l: "Gaps logged", v: num(rt.gaps_logged), sev: "warning" },
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
  const periods = Object.keys(rev);
  if (periods.length) {
    sections.push({
      type: "table", title: "CP-1 · Normalized financials ($M)",
      cols: ["", ...periods], align: [0, ...periods.map(() => 1)],
      rows: [
        ["Revenue", ...periods.map((p) => num(rev[p]))],
        ["Adj. EBITDA", ...periods.map((p) => num(eb[p]))],
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
      { l: "Net leverage (adj.)", v: `${num(fin.net_leverage_adj_ltm)}x`, sev: "warning" },
      { l: "Periods normalized", v: num(rt.periods_normalized) },
      { l: "KPIs registered", v: num(rt.kpis_registered) },
      { l: "Coverage gate", v: String(rt.coverage_gate ?? "—"), sev: "ok" },
    ],
    sections,
  };
}

function adaptGeneric(rt: Record<string, unknown>): Pick<ModuleOutput, "kpis"> & { sections: OutSection[] } {
  // Fallback: surface scalar runtime_output fields as KPIs.
  const kpis = Object.entries(rt)
    .filter(([, v]) => typeof v === "string" || typeof v === "number")
    .slice(0, 4)
    .map(([k, v]) => ({ l: k.replace(/_/g, " "), v: num(v) }));
  return { kpis, sections: [] };
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

  // Reflect the gate on the lead KPI so a Restricted/Blocked module reads as such.
  const kpis = base.kpis.length
    ? base.kpis
    : [{ l: "QA status", v: detail.qa_status, sev: qaSev(detail.qa_status) }];

  return { kpis, sections };
}
