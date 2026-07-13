import type { ModuleOutput, OutSection } from "@/lib/deepdive/module-outputs";
import type { Report, ReportSource, Section, TableRow } from "./builders";

interface LiveReportInput {
  issuerId: string;
  runId: string;
  asOf?: string | null;
  committeeStatus?: string | null;
  liveOuts: Record<string, ModuleOutput>;
  liveStatus: Record<string, string>;
}

interface PersistedVersionLike {
  id: string;
  run_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}

function sourceIds(section: OutSection): string[] {
  if (section.type === "text") return section.ev ?? [];
  if (section.type === "flags") return section.items.flatMap((item) => item.ev ?? []);
  return [];
}

function reportSection(section: OutSection): Section {
  if (section.type === "table") {
    return {
      t: "table",
      title: section.title,
      cols: section.cols,
      align: section.align ?? section.cols.map((_, index) => index === 0 ? 0 : 1),
      rows: section.rows.map((cells) => ({ cells })),
    };
  }
  if (section.type === "text") return { t: "text", title: section.title, body: section.body };
  return {
    t: "table",
    title: section.title,
    cols: ["Status", "Finding", "Evidence"],
    align: [0, 0, 0],
    rows: section.items.map((item) => ({ cells: [item.sev.toUpperCase(), item.text, (item.ev ?? []).join(", ")] })),
  };
}

export function buildLiveReports(input: LiveReportInput): Report[] {
  const moduleIds = Object.keys(input.liveOuts).sort();
  if (!input.runId || !moduleIds.length) return [];
  const sections: Section[] = [{
    t: "profile",
    title: "FROZEN ANALYSIS ENVELOPE",
    rows: [
      ["Issuer", input.issuerId],
      ["Run", input.runId],
      ["As of", input.asOf ?? "Unavailable"],
      ["Committee status", input.committeeStatus ?? "Unavailable"],
      ["Modules included", String(moduleIds.length)],
    ],
  }];
  const sources: ReportSource[] = [];
  for (const moduleId of moduleIds) {
    const output = input.liveOuts[moduleId];
    const evidence = Array.from(new Set(output.sections.flatMap(sourceIds)));
    sources.push({ chip: moduleId, ev: evidence });
    const kpiRows: TableRow[] = output.kpis.map((kpi) => ({ cells: [kpi.l, kpi.v, kpi.sev?.toUpperCase() ?? ""] }));
    if (kpiRows.length) {
      sections.push({
        t: "table",
        title: `${moduleId} · HEADLINE OUTPUTS`,
        sub: `QA ${input.liveStatus[moduleId] ?? "Not Reviewed"}`,
        cols: ["Measure", "Value", "Signal"],
        align: [0, 1, 0],
        rows: kpiRows,
      });
    }
    sections.push(...output.sections.map(reportSection));
  }
  return [{
    id: "live-committee-pack",
    title: "Live IC Credit Memo",
    file: `${input.issuerId}-IC-Credit-Memo`,
    subtitle: `${input.issuerId} · run ${input.runId} · ${input.asOf ?? "as-of unavailable"}`,
    icon: "document",
    srcs: sources,
    sections,
  }];
}

function fallbackSections(document: Record<string, unknown>): Section[] {
  const modules = Array.isArray(document.sections) ? document.sections : [];
  const sections: Section[] = [{
    t: "profile",
    title: "IMMUTABLE VERSION ENVELOPE",
    rows: [
      ["Issuer", String(document.issuer_id ?? "Unavailable")],
      ["Run", String(document.run_id ?? "Unavailable")],
      ["As of", String(document.as_of_date ?? "Unavailable")],
      ["Committee status", String(document.committee_status ?? "Unavailable")],
    ],
  }];
  for (const item of modules) {
    if (!item || typeof item !== "object") continue;
    const moduleRow = item as Record<string, unknown>;
    sections.push({
      t: "text",
      title: `${String(moduleRow.module_id ?? "MODULE")} · ${String(moduleRow.module_name ?? "Frozen output")}`,
      body: JSON.stringify(moduleRow.summary ?? {}, null, 2),
    });
  }
  return sections;
}

export function reportFromVersion(version: PersistedVersionLike): Report {
  const composition = version.payload.composition;
  if (composition && typeof composition === "object") {
    const rendered = (composition as Record<string, unknown>).rendered_report;
    if (rendered && typeof rendered === "object" && Array.isArray((rendered as Report).sections)) {
      return { ...(rendered as Report), id: version.id, title: `${(rendered as Report).title} · published` };
    }
  }
  const document = version.payload.document && typeof version.payload.document === "object"
    ? version.payload.document as Record<string, unknown>
    : {};
  return {
    id: version.id,
    title: "Published IC Credit Memo",
    file: `${String(document.issuer_id ?? "issuer")}-${version.id}`,
    subtitle: `Immutable version ${version.id} · ${version.created_at}`,
    icon: "document",
    srcs: [],
    sections: fallbackSections(document),
  };
}
